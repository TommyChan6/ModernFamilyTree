// The living census — pure demographic math behind the Time slider's Census
// ticker (WILD_IDEAS B2). No store, DOM, Vue or renderer dependency.
//
// `buildCensus` runs once per data change and sweeps every whole year of the
// data span, so `censusAt(index, year)` is an O(1) array read — scrubbing at
// 60 fps over thousands of people does no per-frame work beyond a lookup.
//
// The rules (whole years, the granularity the slider's readout shows):
//   - Only people with a known birth year are counted.
//   - Alive in year Y  ⇔  birthYear ≤ Y ≤ endYear — someone born in Y or who
//     died in Y lived part of it, so they count in Y's census.
//   - endYear = the death year when known. Unknown death: alive for at most
//     `maxAge` (default 100) years, and — for anyone born by the project's
//     present (`refYear`) — no later than that present. A death recorded
//     before the birth (bad data) collapses the life to its birth year.
//   - Couples = relationships whose type has the 'horizontal' symmetryRole
//     (spouse, partner, custom couple types — never matched by type key).
//     Active in Y ⇔ startYear ≤ Y, both partners alive in Y, and Y is before
//     the bond's `ended` year (divorced in Y no longer counts in Y). An undated
//     bond starts where the Timeline draws it: 25 years into the partners'
//     shared lifespan (or at its end, if shorter). A bond formed before one
//     partner's birth starts at the later birth.
//   - Ages are whole-year differences (Y − birthYear).
//   - "This decade" counts are decade-to-date: births/deaths in [decade, Y],
//     so the ticker never reveals the future. Deaths only count recorded ones.
//   - Generation = longest chain of 'vertical' (parent→child) links above a
//     person; a married-in partner with no recorded parents adopts their
//     partner's generation. "Generations alive" = distinct generations with
//     at least one living member.
//   - Gender buckets from `gender_t` (0 = the palette's male end, 1 = female):
//     ≤ 0.35 male, ≥ 0.65 female, in between = other, null = unknown.

import type { DateValue, SymmetryRole } from '../../../../shared/types'
import { toOrdinal } from '../../../../shared/calendarMath'

export interface CensusPerson {
  id: string
  birth?: DateValue | null
  death?: DateValue | null
  gender_t?: number | null
}

export interface CensusRelationship {
  type: string
  person_a_id: string
  person_b_id: string
  formed?: DateValue | null
  ended?: DateValue | null
}

export type CensusTypeRoles = ReadonlyMap<string, SymmetryRole>

export interface CensusOptions {
  /** The project's "present" — caps assumed lifespans of the undated dead. */
  refYear?: number
  /** Longest assumed lifespan for someone with no recorded death. */
  maxAge?: number
  /** Safety cap on the swept span (years); the span is clipped beyond it. */
  maxSpan?: number
}

export const CENSUS_MAX_AGE = 100
export const CENSUS_MAX_SPAN = 50000
// Undated couples start this many years into their shared lifespan — the same
// estimate the Timeline uses to place an undated marriage rope.
const UNDATED_BOND_OFFSET = 25

export interface CensusIndex {
  /** Number of people with a known birth (the census population at large). */
  dated: number
  /** First and last whole year the sweep covers (null when nothing is dated). */
  minYear: number | null
  maxYear: number | null
  /** Person ids in the index's internal order (oldest[] points into this). */
  ids: string[]
  /** Per-year series, index = year − minYear. */
  alive: Int32Array
  couples: Int32Array
  meanAge: Float64Array
  medianAge: Float64Array
  generations: Int32Array
  /** Index into `ids` of the oldest living person (−1 = nobody alive). */
  oldest: Int32Array
  male: Int32Array
  female: Int32Array
  otherGender: Int32Array
  unknownGender: Int32Array
  /** Cumulative births / recorded deaths up to and including each year. */
  cumBirths: Int32Array
  cumDeaths: Int32Array
  /** Birth year of each id (for the oldest person's age). */
  birthYearOf: Int32Array
}

export interface CensusSnapshot {
  year: number
  alive: number
  couples: number
  /** null when nobody is alive. */
  meanAge: number | null
  medianAge: number | null
  /** First year of the decade Y sits in (1950 for 1957; −10 for −3). */
  decade: number
  /** Births / recorded deaths in [decade, year]. */
  birthsDecade: number
  deathsDecade: number
  generations: number
  oldestId: string | null
  oldestAge: number | null
  gender: { male: number; female: number; other: number; unknown: number }
}

const yearOf = (d: DateValue | null | undefined): number | null => {
  const o = toOrdinal(d)
  return o == null ? null : Math.floor(o)
}

/** Whole-year end of a life under the census rules (see the header). */
export function censusLifeEnd(
  birthYear: number,
  deathYear: number | null,
  refYear: number,
  maxAge: number = CENSUS_MAX_AGE
): number {
  if (deathYear != null) return Math.max(birthYear, deathYear)
  const cap = birthYear + maxAge
  return birthYear <= refYear ? Math.min(cap, refYear) : cap
}

/** Generation depth per person: longest vertical chain above them, with
 *  parentless married-in partners adopting their partner's depth. */
function generationsOf(
  idx: Map<string, number>,
  relationships: readonly CensusRelationship[],
  roleOf: (type: string) => SymmetryRole
): Int32Array {
  const n = idx.size
  const parents: number[][] = Array.from({ length: n }, () => [])
  const children: number[][] = Array.from({ length: n }, () => [])
  const partners: number[][] = Array.from({ length: n }, () => [])
  for (const r of relationships) {
    const a = idx.get(r.person_a_id)
    const b = idx.get(r.person_b_id)
    if (a == null || b == null || a === b) continue
    const role = roleOf(r.type)
    if (role === 'vertical') {
      parents[b].push(a)
      children[a].push(b)
    } else if (role === 'horizontal') {
      partners[a].push(b)
      partners[b].push(a)
    }
  }
  const gen = new Int32Array(n)
  // Kahn's topological order; people caught in a (bad-data) cycle keep 0.
  const indeg = new Int32Array(n)
  for (let i = 0; i < n; i++) indeg[i] = parents[i].length
  const order: number[] = []
  for (let i = 0; i < n; i++) if (indeg[i] === 0) order.push(i)
  for (let h = 0; h < order.length; h++) {
    const u = order[h]
    for (const c of children[u]) if (--indeg[c] === 0) order.push(c)
  }
  const relax = (): void => {
    for (const u of order) for (const c of children[u]) if (gen[u] + 1 > gen[c]) gen[c] = gen[u] + 1
  }
  relax()
  // Married-in partners (no recorded parents) sit in their partner's row.
  let moved = false
  for (let i = 0; i < n; i++) {
    if (parents[i].length || !partners[i].length) continue
    let g = gen[i]
    for (const p of partners[i]) if (parents[p].length && gen[p] > g) g = gen[p]
    if (g !== gen[i]) {
      gen[i] = g
      moved = true
    }
  }
  if (moved) relax()
  return gen
}

/** Precompute the census for every whole year of the data span. */
export function buildCensus(
  persons: readonly CensusPerson[],
  relationships: readonly CensusRelationship[],
  typeRoles?: CensusTypeRoles | null,
  opts: CensusOptions = {}
): CensusIndex {
  const refYear = opts.refYear ?? new Date().getFullYear()
  const maxAge = opts.maxAge ?? CENSUS_MAX_AGE
  const maxSpan = Math.max(1, opts.maxSpan ?? CENSUS_MAX_SPAN)
  const roleOf = (type: string): SymmetryRole =>
    typeRoles?.get(type) ??
    (type === 'parent_child' || type === 'adopted'
      ? 'vertical'
      : type === 'spouse'
        ? 'horizontal'
        : 'none')

  // ── Dated people, in birth order ───────────────────────────────────────────
  const rows: { id: string; b: number; bo: number; e: number; d: number | null; g: number }[] = []
  for (const p of persons) {
    const bo = toOrdinal(p.birth)
    if (bo == null) continue
    const b = Math.floor(bo)
    const d = yearOf(p.death)
    const t = p.gender_t
    const g = t == null || !Number.isFinite(t) ? 3 : t <= 0.35 ? 0 : t >= 0.65 ? 1 : 2
    rows.push({ id: p.id, b, bo, e: censusLifeEnd(b, d, refYear, maxAge), d, g })
  }
  rows.sort((x, y) => x.bo - y.bo || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
  const n = rows.length
  const ids = rows.map((r) => r.id)
  const idx = new Map<string, number>()
  ids.forEach((id, i) => idx.set(id, i))
  const birthYearOf = Int32Array.from(rows, (r) => r.b)

  const empty = (len: number): CensusIndex => ({
    dated: n,
    minYear: null,
    maxYear: null,
    ids,
    alive: new Int32Array(len),
    couples: new Int32Array(len),
    meanAge: new Float64Array(len),
    medianAge: new Float64Array(len),
    generations: new Int32Array(len),
    oldest: new Int32Array(len),
    male: new Int32Array(len),
    female: new Int32Array(len),
    otherGender: new Int32Array(len),
    unknownGender: new Int32Array(len),
    cumBirths: new Int32Array(len),
    cumDeaths: new Int32Array(len),
    birthYearOf
  })
  if (!n) return empty(0)

  let minYear = Infinity
  let maxYear = -Infinity
  for (const r of rows) {
    if (r.b < minYear) minYear = r.b
    if (r.e > maxYear) maxYear = r.e
  }
  maxYear = Math.min(maxYear, minYear + maxSpan - 1)
  const L = maxYear - minYear + 1
  const out = empty(L)
  out.minYear = minYear
  out.maxYear = maxYear

  // ── Per-year births / recorded deaths, and who leaves the living when ──
  const birthsAt = new Int32Array(L)
  const deathsAt = new Int32Array(L)
  // leavers[k]: people whose last living year is minYear + k − 1.
  const leavers: number[][] = Array.from({ length: L + 1 }, () => [])
  for (let i = 0; i < n; i++) {
    const r = rows[i]
    const k0 = r.b - minYear
    if (k0 >= L) continue
    birthsAt[k0]++
    leavers[Math.min(L, r.e - minYear + 1)].push(i)
    if (r.d != null) {
      const kd = Math.max(r.b, r.d) - minYear
      if (kd >= 0 && kd < L) deathsAt[kd]++
    }
  }

  // ── Couples: [start, end] intervals → difference array ───────────────────
  const coupleDiff = new Int32Array(L + 1)
  for (const rel of relationships) {
    if (roleOf(rel.type) !== 'horizontal') continue
    const a = idx.get(rel.person_a_id)
    const b = idx.get(rel.person_b_id)
    if (a == null || b == null || a === b) continue
    const ra = rows[a]
    const rb = rows[b]
    const lo = Math.max(ra.b, rb.b)
    const hi = Math.min(ra.e, rb.e)
    if (hi < lo) continue
    const formed = yearOf(rel.formed)
    let start = formed != null ? Math.max(formed, lo) : Math.min(lo + UNDATED_BOND_OFFSET, hi)
    let end = hi
    const ended = yearOf(rel.ended)
    if (ended != null) end = Math.min(end, ended - 1)
    start = Math.max(start, minYear)
    end = Math.min(end, maxYear)
    if (end < start) continue
    coupleDiff[start - minYear]++
    coupleDiff[end - minYear + 1]--
  }

  // ── The sweep ──────────────────────────────────────────────────────────────
  const gen = generationsOf(idx, relationships, roleOf)
  let maxGen = 0
  for (let i = 0; i < n; i++) if (gen[i] > maxGen) maxGen = gen[i]
  const perGen = new Int32Array(maxGen + 1)
  let gensAlive = 0
  const genderCount = [0, 0, 0, 0]
  // Fenwick tree over birth-year offsets → the median age by order statistic.
  const fen = new Int32Array(L + 1)
  const fenAdd = (k: number, v: number): void => {
    for (let x = k + 1; x <= L; x += x & -x) fen[x] += v
  }
  let fenTop = 1
  while (fenTop * 2 <= L) fenTop *= 2
  const fenKth = (k: number): number => {
    // smallest offset whose prefix count ≥ k (k is 1-based)
    let pos = 0
    let rem = k
    for (let step = fenTop; step > 0; step >>= 1) {
      const nx = pos + step
      if (nx <= L && fen[nx] < rem) {
        pos = nx
        rem -= fen[nx]
      }
    }
    return pos // 0-based offset
  }

  let alive = 0
  let couples = 0
  let sumBirth = 0
  let born = 0 // rows[0..born) have entered (rows are in birth order)
  let head = 0 // oldest-living pointer into rows (pop the dead off the front)
  let cumB = 0
  let cumD = 0
  for (let k = 0; k < L; k++) {
    const Y = minYear + k
    // leave first: leavers[k] are people whose last year was Y − 1
    for (const i of leavers[k]) {
      alive--
      sumBirth -= rows[i].b
      genderCount[rows[i].g]--
      if (--perGen[gen[i]] === 0) gensAlive--
      fenAdd(rows[i].b - minYear, -1)
    }
    while (born < n && rows[born].b <= Y) {
      const r = rows[born]
      alive++
      sumBirth += r.b
      genderCount[r.g]++
      if (perGen[gen[born]]++ === 0) gensAlive++
      fenAdd(r.b - minYear, 1)
      born++
    }
    couples += coupleDiff[k]
    while (head < born && rows[head].e < Y) head++
    cumB += birthsAt[k]
    cumD += deathsAt[k]

    out.alive[k] = alive
    out.couples[k] = couples
    out.generations[k] = gensAlive
    out.oldest[k] = alive > 0 && head < born ? head : -1
    out.male[k] = genderCount[0]
    out.female[k] = genderCount[1]
    out.otherGender[k] = genderCount[2]
    out.unknownGender[k] = genderCount[3]
    out.cumBirths[k] = cumB
    out.cumDeaths[k] = cumD
    if (alive > 0) {
      out.meanAge[k] = Y - sumBirth / alive
      // median birth year → median age (average the middle pair when even)
      const lo = fenKth(Math.floor((alive + 1) / 2))
      const hi = alive % 2 ? lo : fenKth(alive / 2 + 1)
      out.medianAge[k] = Y - (minYear + (lo + hi) / 2)
    } else {
      out.meanAge[k] = NaN
      out.medianAge[k] = NaN
    }
  }
  return out
}

const floorDecade = (y: number): number => Math.floor(y / 10) * 10

/** The census in a (fractional) year — O(1). Outside the swept span nobody is
 *  alive; decade counts still clamp correctly. */
export function censusAt(index: CensusIndex, year: number): CensusSnapshot {
  const Y = Math.floor(year)
  const decade = floorDecade(Y)
  const snap: CensusSnapshot = {
    year: Y,
    alive: 0,
    couples: 0,
    meanAge: null,
    medianAge: null,
    decade,
    birthsDecade: 0,
    deathsDecade: 0,
    generations: 0,
    oldestId: null,
    oldestAge: null,
    gender: { male: 0, female: 0, other: 0, unknown: 0 }
  }
  if (index.minYear == null || index.maxYear == null) return snap
  const { minYear, maxYear } = index
  const cum = (arr: Int32Array, y: number): number =>
    y < minYear ? 0 : arr[Math.min(maxYear, y) - minYear]
  snap.birthsDecade = cum(index.cumBirths, Y) - cum(index.cumBirths, decade - 1)
  snap.deathsDecade = cum(index.cumDeaths, Y) - cum(index.cumDeaths, decade - 1)
  if (Y < minYear || Y > maxYear) return snap
  const k = Y - minYear
  snap.alive = index.alive[k]
  snap.couples = index.couples[k]
  snap.generations = index.generations[k]
  snap.gender = {
    male: index.male[k],
    female: index.female[k],
    other: index.otherGender[k],
    unknown: index.unknownGender[k]
  }
  if (snap.alive > 0) {
    snap.meanAge = index.meanAge[k]
    snap.medianAge = index.medianAge[k]
    const o = index.oldest[k]
    if (o >= 0) {
      snap.oldestId = index.ids[o]
      snap.oldestAge = Y - index.birthYearOf[o]
    }
  }
  return snap
}

/** `samples` evenly spaced population readings across [from, to] — the
 *  population sparkline. O(samples). */
export function populationSeries(
  index: CensusIndex,
  from: number,
  to: number,
  samples: number
): number[] {
  const out = new Array<number>(Math.max(0, samples)).fill(0)
  if (index.minYear == null || index.maxYear == null || samples <= 0) return out
  const span = to - from
  for (let i = 0; i < samples; i++) {
    const y = Math.floor(from + (samples === 1 ? 0 : (span * i) / (samples - 1)))
    if (y >= index.minYear && y <= index.maxYear) out[i] = index.alive[y - index.minYear]
  }
  return out
}

export interface DecadeSeries {
  /** First year of each decade, ascending. */
  decades: number[]
  births: number[]
  deaths: number[]
}

/** Births and recorded deaths per decade over [from, to] (the decades that
 *  intersect it) — the mortality sparkline. O(decades). */
export function decadeSeries(index: CensusIndex, from: number, to: number): DecadeSeries {
  const out: DecadeSeries = { decades: [], births: [], deaths: [] }
  const d0 = floorDecade(Math.floor(Math.min(from, to)))
  const d1 = floorDecade(Math.floor(Math.max(from, to)))
  const has = index.minYear != null && index.maxYear != null
  const cum = (arr: Int32Array, y: number): number => {
    if (!has || y < (index.minYear as number)) return 0
    return arr[Math.min(index.maxYear as number, y) - (index.minYear as number)]
  }
  for (let d = d0; d <= d1; d += 10) {
    out.decades.push(d)
    out.births.push(cum(index.cumBirths, d + 9) - cum(index.cumBirths, d - 1))
    out.deaths.push(cum(index.cumDeaths, d + 9) - cum(index.cumDeaths, d - 1))
  }
  return out
}

/** Sum consecutive runs of `size` values (the last run may be shorter) —
 *  folds a long decade series into fewer, wider bars. */
export function groupSum(values: readonly number[], size: number): number[] {
  const g = Math.max(1, Math.floor(size))
  if (g === 1) return values.slice()
  const out = new Array<number>(Math.ceil(values.length / g)).fill(0)
  for (let i = 0; i < values.length; i++) out[Math.floor(i / g)] += values[i]
  return out
}
