// Pure layout for the Timeline's Household rivers mode — no Three.js, no store,
// no DOM, no i18n.
//
// Columns are households, not people. A couple's lives run side by side in one
// channel; their children are born INSIDE it, between them, so parentage reads
// by containment and no birth lines are needed. A life only crosses to another
// channel when it changes household:
//
//   marriage     both spouses move into the couple's new channel (the
//                confluence) in the year they marry
//   divorce      with a recorded end year, one spouse leaves for a channel of
//                their own; the children stay with the other
//   leaving home an adult still in a household they don't head leaves for their
//                own channel at `leaveHomeAge` (unless they married first)
//   following    a child still at home moves along when the last of its parents
//                in its channel moves on (a widow remarrying takes the children)
//
// Deaths narrow a channel; births widen it. Channels are placed greedily in
// start order, each at the free position nearest where its members come from,
// and x-space is reused once a household is gone (like Sprout reuses lanes).
// Output is in world units (x = unscaled lane px, y = years), so the renderer
// maps every point through its own year → screen mapping.

import type { Family, Branch, LinkPerson } from './timelineLinks'

export interface RiverMarriage {
  id: string
  ids: string[]
  year: number
  estimated?: boolean
  /** The year the marriage ended (divorce / separation), when recorded. */
  endedYear?: number | null
}

export interface RiverOpts {
  /** Age at which an unmarried adult leaves for a channel of their own. */
  leaveHomeAge?: number
  /** World units between two members of one channel. */
  spacing?: number
  /** Band padding beyond the outermost member. */
  pad?: number
  /** World units between two channels' banks. */
  gap?: number
  /** World x of the leftmost member. */
  x0?: number
  /** Years a channel takes to widen / narrow around a birth or death. */
  shiftYears?: number
  /** Shortest crossing (years); longer crossings take longer. */
  moveYears?: number
  /** Straight pieces per S-curve. */
  subdiv?: number
}

export type HouseholdKind = 'couple' | 'coparents' | 'solo'

export interface Household {
  id: string
  kind: HouseholdKind
  /** The couple / co-parents / the person whose own channel it is. */
  heads: string[]
  marriageId: string | null
  famId: string | null
  start: number
  end: number
  /** Channel centre (world x). */
  x: number
  /** Widest the channel ever gets (world units). */
  width: number
  /** Everyone who ever lived in it, in channel order (left → right). */
  members: string[]
  /** Born (or adopted at birth) into it. */
  children: string[]
  /** The channel's banks over time: flat [year, left, right, …]. */
  edges: number[]
  rank: number
}

export interface Stint {
  h: string
  from: number
  to: number
  /** How the stint ends: moving on to `next`, or the life (or now) ending. */
  exit: 'move' | 'end'
  next: string | null
}

export interface RiverLayout {
  households: Household[]
  householdById: Map<string, Household>
  /** Per person: the lifeline as a polyline, flat [year, x, year, x, …]. */
  paths: Map<string, number[]>
  birthX: Map<string, number>
  stints: Map<string, Stint[]>
  /** Per marriage: where the two lives meet ({ year, xa, xb } — xa = ids[0]). */
  confluences: Map<string, { year: number; xa: number; xb: number }>
  minX: number
  maxX: number
}

const EPS = 1e-6
const BIG = Number.MAX_SAFE_INTEGER

interface Member {
  pid: string
  from: number
  to: number
  exit: 'move' | 'end'
  next: string | null
}
interface H {
  id: string
  kind: HouseholdKind
  heads: string[]
  marriageId: string | null
  famId: string | null
  open: number
  rank: number
  members: Member[]
  children: string[]
  start: number
  end: number
  x: number
  width: number
  placed: boolean
  flowTo: Set<string>
}
interface Move {
  year: number
  to: string // household id, or SOLO
  order: number
}
const SOLO = '\u0000solo'

const smooth = (u: number) => u * u * (3 - 2 * u)

/** x of a flat [year, x, …] polyline at `year` (clamped to its ends). */
export function pathXAt(path: ArrayLike<number>, year: number): number {
  const n = path.length >> 1
  if (!n) return 0
  if (year <= path[0]) return path[1]
  if (year >= path[(n - 1) * 2]) return path[(n - 1) * 2 + 1]
  let lo = 0,
    hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (path[mid * 2] <= year) lo = mid
    else hi = mid
  }
  const t0 = path[lo * 2],
    t1 = path[hi * 2]
  const u = t1 > t0 ? (year - t0) / (t1 - t0) : 1
  return path[lo * 2 + 1] + (path[hi * 2 + 1] - path[lo * 2 + 1]) * u
}

/** A flat polyline as segments { y0, y1, x0, x1 } (years → world x). */
export function pathSegments(
  path: ArrayLike<number>
): { y0: number; y1: number; x0: number; x1: number }[] {
  const out: { y0: number; y1: number; x0: number; x1: number }[] = []
  for (let i = 0; i + 3 < path.length; i += 2)
    out.push({ y0: path[i], x0: path[i + 1], y1: path[i + 2], x1: path[i + 3] })
  return out
}

/** Banks of a household at `year` ({ left, right } | null outside its span). */
export function bandAt(h: Household, year: number): { left: number; right: number } | null {
  const e = h.edges
  const n = e.length / 3
  if (!n || year < e[0] - EPS || year > e[(n - 1) * 3] + EPS) return null
  for (let i = 1; i < n; i++) {
    if (e[i * 3] >= year) {
      const t0 = e[(i - 1) * 3],
        t1 = e[i * 3]
      const u = t1 > t0 ? (year - t0) / (t1 - t0) : 1
      return {
        left: e[(i - 1) * 3 + 1] + (e[i * 3 + 1] - e[(i - 1) * 3 + 1]) * u,
        right: e[(i - 1) * 3 + 2] + (e[i * 3 + 2] - e[(i - 1) * 3 + 2]) * u
      }
    }
  }
  return { left: e[(n - 1) * 3 + 1], right: e[(n - 1) * 3 + 2] }
}

// Keyframes: times, values, and whether the piece ending at a key eases (S).
interface Keys {
  t: number[]
  v: number[]
  s: boolean[]
}
function evalKeys(k: Keys, year: number): number {
  const n = k.t.length
  if (!n) return 0
  if (year <= k.t[0]) return k.v[0]
  for (let i = 1; i < n; i++) {
    if (k.t[i] >= year) {
      const t0 = k.t[i - 1],
        t1 = k.t[i]
      let u = t1 > t0 ? (year - t0) / (t1 - t0) : 1
      if (k.s[i]) u = smooth(u)
      return k.v[i - 1] + (k.v[i] - k.v[i - 1]) * u
    }
  }
  return k.v[n - 1]
}
function pushKey(k: Keys, t: number, v: number, s: boolean) {
  const n = k.t.length
  if (n && Math.abs(k.t[n - 1] - t) < EPS && Math.abs(k.v[n - 1] - v) < EPS) return
  k.t.push(t)
  k.v.push(v)
  k.s.push(s)
}
/** Expand eased pieces into `sub` straight ones; drop redundant hold points. */
function flatten(k: Keys, sub: number, width = 1, values?: number[][]): number[] {
  const out: number[] = []
  const n = k.t.length
  const emit = (t: number, i: number, u: number) => {
    out.push(t)
    if (width === 1) out.push(k.v[i - 1] + (k.v[i] - k.v[i - 1]) * u)
    else for (const vs of values!) out.push(vs[i - 1] + (vs[i] - vs[i - 1]) * u)
  }
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      out.push(k.t[0])
      if (width === 1) out.push(k.v[0])
      else for (const vs of values!) out.push(vs[0])
      continue
    }
    const t0 = k.t[i - 1],
      t1 = k.t[i]
    const moving = width === 1 ? k.v[i] !== k.v[i - 1] : values!.some((vs) => vs[i] !== vs[i - 1])
    if (k.s[i] && moving && t1 - t0 > EPS) {
      for (let j = 1; j <= sub; j++) emit(t0 + ((t1 - t0) * j) / sub, i, smooth(j / sub))
    } else emit(t1, i, 1)
  }
  // Merge holds: a point whose neighbours share its value(s) adds nothing.
  const w = width + 1
  const m = out.length / w
  if (m <= 2) return out
  const res: number[] = out.slice(0, w)
  for (let i = 1; i < m - 1; i++) {
    let same = true
    for (let c = 1; c < w && same; c++) {
      const a = res[res.length - w + c],
        b = out[i * w + c],
        d = out[(i + 1) * w + c]
      if (Math.abs(a - b) > 1e-6 || Math.abs(b - d) > 1e-6) same = false
    }
    if (!same) for (let c = 0; c < w; c++) res.push(out[i * w + c])
  }
  for (let c = 0; c < w; c++) res.push(out[(m - 1) * w + c])
  return res
}

export function layoutHouseholdRivers(
  people: readonly LinkPerson[],
  families: readonly Family[],
  branches: readonly Branch[],
  marriages: readonly RiverMarriage[],
  rank: ReadonlyMap<string, number>,
  opts: RiverOpts = {}
): RiverLayout {
  const leaveAge = Math.max(1, opts.leaveHomeAge ?? 25)
  const spacing = opts.spacing ?? 56
  const pad = opts.pad ?? 24
  const gap = opts.gap ?? 36
  const x0 = opts.x0 ?? 110
  const shift = opts.shiftYears ?? 1.2
  const moveMin = opts.moveYears ?? 1.6
  const sub = Math.max(1, Math.round(opts.subdiv ?? 5))
  const maxMove = 7 // longest crossing (years)

  const byId = new Map(people.map((p) => [p.id, p]))
  const rk = (id: string) => rank.get(id) ?? BIG
  const primaryFam = new Map<string, Family>()
  for (const b of branches) {
    if (!b.primary) continue
    const f = families[b.famIdx]
    if (f) primaryFam.set(b.childId, f)
  }

  const hs = new Map<string, H>()
  const mkH = (
    id: string,
    kind: HouseholdKind,
    heads: string[],
    open: number,
    marriageId: string | null = null,
    famId: string | null = null
  ): H => {
    const h: H = {
      id,
      kind,
      heads,
      marriageId,
      famId,
      open,
      rank: heads.reduce((s, x) => s + Math.min(rk(x), 1e9), 0) / Math.max(1, heads.length),
      members: [],
      children: [],
      start: Infinity,
      end: -Infinity,
      x: 0,
      width: 0,
      placed: false,
      flowTo: new Set()
    }
    hs.set(id, h)
    return h
  }

  // ── Couple households: one per marriage ──────────────────────────────────
  // A couple's channel opens at the wedding — or at their first child, when
  // that came first (an estimated wedding opens the year before it).
  const marriageH = new Map<string, H>()
  const movesOf = new Map<string, Move[]>()
  const addMove = (pid: string, m: Move) => {
    let l = movesOf.get(pid)
    if (!l) movesOf.set(pid, (l = []))
    l.push(m)
  }
  const firstChildOf = new Map<number, number>()
  for (const f of families) {
    if (f.marriageIdx < 0) continue
    firstChildOf.set(
      f.marriageIdx,
      Math.min(firstChildOf.get(f.marriageIdx) ?? Infinity, f.firstYear)
    )
  }
  marriages.forEach((m, j) => {
    const [a, b] = m.ids
    const pa = byId.get(a),
      pb = byId.get(b)
    if (!pa || !pb || a === b || !Number.isFinite(m.year)) return
    let open = m.year
    const fc = firstChildOf.get(j)
    if (fc != null && Number.isFinite(fc)) open = Math.min(open, m.estimated ? fc - 1 : fc)
    open = Math.max(open, Math.min(pa.birthYear, pb.birthYear))
    const h = mkH(`hm:${m.id}`, 'couple', [a, b], open, m.id, null)
    marriageH.set(m.id, h)
    for (const pid of [a, b]) addMove(pid, { year: open, to: h.id, order: 1 })
  })
  const marriagesOf = new Map<string, number[]>()
  marriages.forEach((m, j) => {
    if (!marriageH.has(m.id)) return
    for (const pid of m.ids) {
      let l = marriagesOf.get(pid)
      if (!l) marriagesOf.set(pid, (l = []))
      l.push(j)
    }
  })
  // Divorce with a recorded year: the spouse who remarries first leaves for a
  // channel of their own; the other keeps the household (and the children).
  const nextEntry = (pid: string, after: number) => {
    let best = Infinity
    for (const j of marriagesOf.get(pid) || []) {
      const y = marriageH.get(marriages[j].id)!.open
      if (y > after + EPS && y < best) best = y
    }
    return best
  }
  marriages.forEach((m) => {
    const h = marriageH.get(m.id)
    const E = m.endedYear
    if (!h || E == null || !Number.isFinite(E) || E <= h.open + EPS) return
    const [a, b] = m.ids
    const na = nextEntry(a, E),
      nb = nextEntry(b, E)
    const leaver = na < nb ? a : b
    addMove(leaver, { year: E, to: SOLO, order: 0 })
  })

  // ── Co-parents without a marriage: their own channel, unless one of them
  // is in a marriage at the first child's birth (then the child is simply
  // born into that parent's household).
  const coparentH = new Map<string, H>()
  const inMarriageAt = (pid: string, year: number) =>
    (marriagesOf.get(pid) || []).some((j) => {
      const m = marriages[j]
      const open = marriageH.get(m.id)!.open
      return open <= year + EPS && (m.endedYear == null || m.endedYear > year)
    })
  for (const f of families) {
    if (f.parents.length !== 2 || f.marriageIdx >= 0) continue
    const [a, b] = f.parents
    const pa = byId.get(a),
      pb = byId.get(b)
    if (!pa || !pb) continue
    if (inMarriageAt(a, f.firstYear) || inMarriageAt(b, f.firstYear)) continue
    const open = Math.max(f.firstYear - 1, Math.min(pa.birthYear, pb.birthYear))
    const h = mkH(`hc:${f.id}`, 'coparents', [a, b], open, null, f.id)
    coparentH.set(f.id, h)
    for (const pid of [a, b]) addMove(pid, { year: open, to: h.id, order: 1 })
  }

  // ── Stints: who lives where, when (birth order — parents before children) ─
  const stints = new Map<string, Stint[]>()
  const soloCount = new Map<string, number>()
  const newSolo = (pid: string, year: number) => {
    const k = soloCount.get(pid) ?? 0
    soloCount.set(pid, k + 1)
    return mkH(`hs:${pid}:${k}`, 'solo', [pid], year)
  }
  const householdAt = (pid: string, year: number): string | null => {
    const l = stints.get(pid)
    if (!l) return null
    for (const s of l) if (s.from <= year + EPS && year < s.to - EPS) return s.h
    const last = l[l.length - 1]
    return last && Math.abs(last.to - year) < EPS ? last.h : null
  }
  const sorted = [...people].sort(
    (a, b) => a.birthYear - b.birthYear || rk(a.id) - rk(b.id) || (a.id < b.id ? -1 : 1)
  )
  for (const p of sorted) {
    const b = p.birthYear
    const e = Math.max(p.endYear, b)
    const list: Stint[] = []
    stints.set(p.id, list)
    const push = (
      h: string,
      from: number,
      to: number,
      exit: 'move' | 'end',
      next: string | null
    ) => {
      if (to - from <= EPS) return
      const H = hs.get(h)!
      if (!list.length && !H.heads.includes(p.id)) H.children.push(p.id)
      list.push({ h, from, to, exit, next })
      H.members.push({ pid: p.id, from, to, exit, next })
    }

    // Where the life begins: the parents' channel (by containment), else one
    // of the parents' current household, else a channel of its own.
    const fam = primaryFam.get(p.id)
    let h0: string | null = null
    if (fam) {
      if (fam.parents.length === 2 && fam.marriageIdx >= 0) {
        h0 = marriageH.get(marriages[fam.marriageIdx]?.id)?.id ?? null
      } else if (fam.parents.length === 2 && coparentH.has(fam.id)) {
        h0 = coparentH.get(fam.id)!.id
      }
      if (!h0) for (const par of fam.parents) if (!h0) h0 = householdAt(par, b)
    }
    let cur = h0 ?? newSolo(p.id, b).id
    let t = b
    const own = (movesOf.get(p.id) || [])
      .filter((m) => m.year < e - EPS)
      .sort((x, y) => x.year - y.year || x.order - y.order)
    const heads = (id: string) => hs.get(id)!.heads.includes(p.id)
    const firstOwn = own.find((m) => m.to !== SOLO)?.year ?? Infinity
    let atHome = !heads(cur)
    const leave = atHome ? b + leaveAge : Infinity
    const homeEnd = Math.min(firstOwn, leave, e)

    // At home: follow the last parent in the channel when they move on.
    const guardians = fam ? fam.parents : []
    for (let guard = 0; atHome && guard < 32; guard++) {
      let lastS: Stint | null = null
      for (const g of guardians) {
        for (const s of stints.get(g) || []) {
          if (s.h === cur && s.from <= t + EPS && s.to > t + EPS && (!lastS || s.to > lastS.to))
            lastS = s
        }
      }
      if (!lastS || lastS.exit !== 'move' || !lastS.next || lastS.to >= homeEnd - EPS) break
      if (heads(lastS.next)) break
      push(cur, t, lastS.to, 'move', lastS.next)
      cur = lastS.next
      t = Math.max(t, lastS.to)
    }
    if (atHome && leave < firstOwn && leave < e - EPS) {
      const solo = newSolo(p.id, leave).id
      push(cur, t, leave, 'move', solo)
      cur = solo
      t = leave
      atHome = false
    }
    for (const mv of own) {
      const y = Math.max(mv.year, t)
      if (y >= e - EPS) break
      let target = mv.to
      if (target === SOLO) {
        const ch = hs.get(cur)!
        if (ch.kind === 'solo' && ch.heads[0] === p.id) continue
        target = newSolo(p.id, y).id
      }
      if (target === cur) continue
      push(cur, t, y, 'move', target)
      cur = target
      t = y
    }
    push(cur, t, e, 'end', null)
    if (!list.length) {
      // a life with no length at all: one zero stint keeps it on the map
      const H = hs.get(cur)!
      list.push({ h: cur, from: b, to: e, exit: 'end', next: null })
      H.members.push({ pid: p.id, from: b, to: e, exit: 'end', next: null })
    }
  }

  // Spans, widest moment and where each household flows into at its end.
  const all: H[] = []
  for (const h of hs.values()) {
    if (!h.members.length) continue
    const ev: [number, number][] = []
    for (const m of h.members) {
      h.start = Math.min(h.start, m.from)
      h.end = Math.max(h.end, m.to)
      ev.push([m.from, 1], [m.to, -1])
    }
    ev.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    let c = 0,
      mx = 1
    for (const [, d] of ev) {
      c += d
      if (c > mx) mx = c
    }
    h.width = (mx - 1) * spacing + 2 * pad
    for (const m of h.members)
      if (m.exit === 'move' && m.next && Math.abs(m.to - h.end) < EPS) h.flowTo.add(m.next)
    all.push(h)
  }

  // ── Placement: start order, each at the free x nearest its origins ────────
  all.sort((a, b) => a.start - b.start || a.rank - b.rank || (a.id < b.id ? -1 : 1))
  const prevStint = (pid: string, from: number): Stint | null => {
    const l = stints.get(pid) || []
    let best: Stint | null = null
    for (const s of l) if (s.to <= from + EPS && (!best || s.to > best.to)) best = s
    return best
  }
  const wMax = all.reduce((m, h) => Math.max(m, h.width), 0)
  const margin = maxMove + shift // a crossing may approach for up to maxMove years
  let live: H[] = []
  const byRank: H[] = [] // placed, sorted by rank (founder fallback)
  all.forEach((h, idx) => {
    if ((idx & 63) === 0) live = live.filter((g) => g.end + margin >= h.start)
    // Anchor: the mean x of the channels its first members come from.
    const xs: number[] = []
    for (const m of h.members) {
      if (m.from > h.start + 2) continue
      const ps = prevStint(m.pid, m.from)
      const g = ps ? hs.get(ps.h) : null
      if (g?.placed) xs.push(g.x)
    }
    let anchor = 0
    let prefer = 1
    if (xs.length) anchor = xs.reduce((s, x) => s + x, 0) / xs.length
    else {
      // A founder: settle beside a future spouse's family, else beside the
      // nearest household in tree order.
      let found = false
      const pid = h.heads[0]
      for (const j of marriagesOf.get(pid) || []) {
        const sp = marriages[j].ids.find((x) => x !== pid)
        const first = sp ? stints.get(sp)?.[0] : null
        const g = first ? hs.get(first.h) : null
        if (g?.placed) {
          prefer = h.rank < g.rank ? -1 : 1
          anchor = g.x + prefer * (g.width / 2 + gap + h.width / 2)
          found = true
          break
        }
      }
      if (!found && byRank.length) {
        let lo = 0,
          hi = byRank.length
        while (lo < hi) {
          const mid = (lo + hi) >> 1
          if (byRank[mid].rank < h.rank) lo = mid + 1
          else hi = mid
        }
        const cand = [byRank[lo - 1], byRank[lo]].filter(Boolean)
        let g = cand[0]
        for (const c of cand) if (Math.abs(c.rank - h.rank) < Math.abs(g.rank - h.rank)) g = c
        prefer = h.rank < g.rank ? -1 : 1
        anchor = g.x + prefer * (g.width / 2 + gap + h.width / 2)
      }
    }
    // Forbidden centres: every channel alive around the same time, except the
    // ones that flow straight into this one (their x is free to inherit).
    // `live` is kept sorted by left bank, so the forbidden spans arrive in
    // order and merge in one pass.
    const reach = h.width / 2 + gap
    const skip = (g: H) =>
      g.end <= h.start + EPS && (g.end + margin < h.start || g.flowTo.has(h.id))
    // Spans starting further left than this all end before the anchor.
    const far = anchor - (wMax + 2 * reach)
    let i0 = 0,
      i1 = live.length
    while (i0 < i1) {
      const mid = (i0 + i1) >> 1
      if (live[mid].x - live[mid].width / 2 - reach < far) i0 = mid + 1
      else i1 = mid
    }
    let runLo = NaN,
      runHi = NaN,
      hit = false,
      firstRun = true
    for (let i = i0; i < live.length; i++) {
      const g = live[i]
      if (skip(g)) continue
      const a = g.x - g.width / 2 - reach,
        b = g.x + g.width / 2 + reach
      if (!(a <= runHi + EPS)) {
        if (runHi > anchor) {
          hit = true
          break
        }
        if (a >= anchor) break
        if (runHi === runHi) firstRun = false
        runLo = a
        runHi = b
      } else if (b > runHi) runHi = b
    }
    if (!hit && runLo < anchor && anchor < runHi) hit = true
    // The run holding the anchor may reach further left than the window.
    if (hit && firstRun) {
      for (let j = i0 - 1; j >= 0; j--) {
        const g = live[j]
        const a = g.x - g.width / 2 - reach
        if (a < runLo - (wMax + 2 * reach)) break
        if (skip(g)) continue
        if (g.x + g.width / 2 + reach >= runLo - EPS && a < runLo) runLo = a
      }
    }
    let x = anchor
    if (hit) {
      const dl = anchor - runLo,
        dr = runHi - anchor
      x = dl < dr - 1 ? runLo : dr < dl - 1 ? runHi : prefer < 0 ? runLo : runHi
    }
    h.x = x
    h.placed = true
    const bank = x - h.width / 2
    let lo1 = 0,
      hi1 = live.length
    while (lo1 < hi1) {
      const mid = (lo1 + hi1) >> 1
      if (live[mid].x - live[mid].width / 2 <= bank) lo1 = mid + 1
      else hi1 = mid
    }
    live.splice(lo1, 0, h)
    let lo2 = 0,
      hi2 = byRank.length
    while (lo2 < hi2) {
      const mid = (lo2 + hi2) >> 1
      if (byRank[mid].rank <= h.rank) lo2 = mid + 1
      else hi2 = mid
    }
    byRank.splice(lo2, 0, h)
  })

  // ── Inside each channel: order, offsets over time, banks ───────────────────
  const memberKeys = new Map<string, Keys>() // `${hid}|${pid}|${from}`
  const outHouseholds: Household[] = []
  for (const h of all) {
    const firstFrom = new Map<string, number>()
    for (const m of h.members)
      firstFrom.set(m.pid, Math.min(firstFrom.get(m.pid) ?? Infinity, m.from))
    const headsIn = h.heads.filter((id) => firstFrom.has(id))
    const prevX = (pid: string) => {
      const ps = prevStint(pid, firstFrom.get(pid)!)
      const g = ps ? hs.get(ps.h) : null
      return g ? g.x : h.x + (rk(pid) < h.rank ? -1 : 1)
    }
    if (headsIn.length === 2 && prevX(headsIn[0]) > prevX(headsIn[1])) headsIn.reverse()
    const others = [...firstFrom.keys()]
      .filter((id) => !headsIn.includes(id))
      .sort((a, b) => firstFrom.get(a)! - firstFrom.get(b)! || rk(a) - rk(b))
    const order =
      headsIn.length === 2 ? [headsIn[0], ...others, headsIn[1]] : [...headsIn, ...others]
    const pos = new Map(order.map((id, i) => [id, i]))

    // Config events: whenever someone arrives or leaves.
    const times = [...new Set(h.members.flatMap((m) => [m.from, m.to]))].sort((a, b) => a - b)
    const present = (y: number) =>
      h.members
        .filter((m) => m.from <= y + EPS && m.to > y + EPS)
        .sort((a, b) => pos.get(a.pid)! - pos.get(b.pid)!)
    const offs: Map<string, number>[] = []
    const hw: number[] = []
    const win: [number, number][] = []
    let prevEnd = -Infinity
    for (let k = 0; k < times.length; k++) {
      const Y = times[k]
      const pr = present(Y)
      const o = new Map<string, number>()
      pr.forEach((m, i) => o.set(m.pid, (i - (pr.length - 1) / 2) * spacing))
      offs.push(o)
      hw.push(Math.max(0, pr.length - 1) * spacing * 0.5 + pad)
      // Arrivals (and departures by moving) make room beforehand; deaths
      // close up afterwards.
      const before = h.members.some(
        (m) => Math.abs(m.from - Y) < EPS || (m.exit === 'move' && Math.abs(m.to - Y) < EPS)
      )
      let w0: number, w1: number
      if (before || k === 0) {
        w1 = Y
        w0 = Math.min(Y, Math.max(prevEnd, Y - shift, k > 0 ? times[k - 1] : Y))
      } else {
        w0 = Y
        w1 = k + 1 < times.length ? Math.min(times[k + 1], Y + shift) : Y + shift
      }
      win.push([w0, w1])
      prevEnd = w1
    }

    for (const m of h.members) {
      const keys: Keys = { t: [], v: [], s: [] }
      for (let k = 0; k < times.length; k++) {
        const Y = times[k]
        if (Y < m.from - EPS || Y > m.to + EPS) continue
        if (Math.abs(Y - m.from) < EPS) {
          pushKey(keys, Y, offs[k].get(m.pid) ?? 0, false)
          continue
        }
        const vb = keys.v[keys.v.length - 1]
        if (Math.abs(Y - m.to) < EPS) {
          pushKey(keys, Y, vb, false)
          break
        }
        const va = offs[k].get(m.pid) ?? vb
        if (Math.abs(va - vb) < EPS) continue
        const [w0, w1] = win[k]
        const a = Math.max(w0, keys.t[keys.t.length - 1])
        const b = Math.min(w1, m.to)
        pushKey(keys, a, vb, false)
        pushKey(keys, Math.max(a, b), va, true)
      }
      if (keys.t[keys.t.length - 1] < m.to - EPS)
        pushKey(keys, m.to, keys.v[keys.v.length - 1], false)
      for (let i = 0; i < keys.v.length; i++) keys.v[i] += h.x
      memberKeys.set(`${h.id}|${m.pid}|${m.from}`, keys)
    }

    // Banks: the channel's half width follows its head count.
    const bk: Keys = { t: [], v: [], s: [] }
    for (let k = 0; k < times.length; k++) {
      const Y = times[k]
      const last = k === times.length - 1
      if (k === 0) {
        pushKey(bk, Y, hw[0], false)
        continue
      }
      const vb = bk.v[bk.v.length - 1]
      if (last) {
        pushKey(bk, Y, vb, false)
        break
      }
      const va = hw[k]
      if (Math.abs(va - vb) < EPS) continue
      const [w0, w1] = win[k]
      const a = Math.max(w0, bk.t[bk.t.length - 1])
      pushKey(bk, a, vb, false)
      pushKey(bk, Math.max(a, w1), va, true)
    }
    const left = bk.v.map((v) => h.x - v)
    const right = bk.v.map((v) => h.x + v)
    const flat = flatten(bk, sub, 2, [left, right])
    outHouseholds.push({
      id: h.id,
      kind: h.kind,
      heads: headsIn.length ? headsIn : h.heads,
      marriageId: h.marriageId,
      famId: h.famId,
      start: h.start,
      end: h.end,
      x: h.x,
      width: h.width,
      members: order,
      children: h.children,
      edges: flat,
      rank: h.rank
    })
  }

  // ── Lifelines: stints joined by S-curve crossings ──────────────────────────
  const paths = new Map<string, number[]>()
  const birthX = new Map<string, number>()
  for (const p of people) {
    const list = stints.get(p.id) || []
    const K: Keys = { t: [], v: [], s: [] }
    list.forEach((s, si) => {
      const mk = memberKeys.get(`${s.h}|${p.id}|${s.from}`)
      if (!mk || !mk.t.length) return
      if (si === 0 || !K.t.length) {
        for (let i = 0; i < mk.t.length; i++) pushKey(K, mk.t[i], mk.v[i], mk.s[i])
        return
      }
      const Y = s.from
      const xNew = mk.v[0]
      const xOld = evalKeys(K, Y)
      const dur = Math.min(maxMove, moveMin + Math.abs(xNew - xOld) / 80)
      const t0 = Math.max(list[si - 1].from, Y - dur)
      const x0v = evalKeys(K, t0)
      let wasSmooth = false
      while (K.t.length > 1 && K.t[K.t.length - 1] > t0 + EPS) {
        wasSmooth = K.s.pop()! || wasSmooth
        K.t.pop()
        K.v.pop()
      }
      if (K.t[K.t.length - 1] > t0 + EPS) {
        K.t[K.t.length - 1] = t0
        K.v[K.v.length - 1] = x0v
      } else pushKey(K, t0, x0v, wasSmooth)
      K.t.push(Y)
      K.v.push(xNew)
      K.s.push(true)
      for (let i = 1; i < mk.t.length; i++) pushKey(K, mk.t[i], mk.v[i], mk.s[i])
    })
    if (!K.t.length) continue
    if (K.t.length === 1) pushKey(K, K.t[0] + EPS * 2, K.v[0], false)
    const path = flatten(K, sub)
    paths.set(p.id, path)
    birthX.set(p.id, path[1])
  }

  // Confluences: where the two spouses meet (their rope / badge).
  const confluences = new Map<string, { year: number; xa: number; xb: number }>()
  marriages.forEach((m) => {
    const h = marriageH.get(m.id)
    const pa = paths.get(m.ids[0]),
      pb = paths.get(m.ids[1])
    if (!h || !pa || !pb) return
    const year = m.estimated && Number.isFinite(h.start) ? h.start : m.year
    confluences.set(m.id, { year, xa: pathXAt(pa, year), xb: pathXAt(pb, year) })
  })

  // Shift everything so the leftmost member sits at x0.
  let minX = Infinity,
    maxX = -Infinity
  for (const h of outHouseholds) {
    minX = Math.min(minX, h.x - h.width / 2)
    maxX = Math.max(maxX, h.x + h.width / 2)
  }
  if (!Number.isFinite(minX)) minX = maxX = x0
  const dx = x0 - (minX + pad)
  for (const h of outHouseholds) {
    h.x += dx
    for (let i = 0; i < h.edges.length; i += 3) {
      h.edges[i + 1] += dx
      h.edges[i + 2] += dx
    }
  }
  for (const [id, path] of paths) {
    for (let i = 1; i < path.length; i += 2) path[i] += dx
    birthX.set(id, path[1])
  }
  for (const c of confluences.values()) {
    c.xa += dx
    c.xb += dx
  }
  return {
    households: outHouseholds,
    householdById: new Map(outHouseholds.map((h) => [h.id, h])),
    paths,
    birthX,
    stints,
    confluences,
    minX: minX + dx,
    maxX: maxX + dx
  }
}
