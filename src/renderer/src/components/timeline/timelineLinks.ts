// Pure relationship math for the Timeline — no Three.js, no store, no DOM.
//
//   families     one record per parent set (a couple or a single parent) with
//                the children they share; each child hangs off it by one
//                BRANCH, so a child gets one line from its parents instead of
//                one per parent
//   lane order   a local search over the tree order that only counts the
//                crossings that matter: a connector passing over a lane whose
//                person is alive at that time (empty lanes cost nothing; a
//                couple's stem is in the way until their last child)
//   sprout       the Sprout mode's lane packing: lanes are slots in time, reused
//                once their occupant is gone; each newborn takes the free slot
//                nearest its parents (git-graph style)
//   curves       screen-space control points for branches / sprouts, bridge
//                gaps where a branch passes under a living lifeline, and the
//                distance test used for hovering a line

export interface LinkPerson {
  id: string
  birthYear: number
  endYear: number
}
export interface LinkRel {
  id: string
  type: string
  person_a_id: string
  person_b_id: string
}
export interface LinkMarriage {
  id: string
  ids: string[]
  year: number
}
export type TypeRoles = ReadonlyMap<string, string> | null | undefined

export interface Family {
  id: string
  /** One or two parent ids (sorted). */
  parents: string[]
  /** Index into the layout's marriages of the rope joining the parents (-1 = none). */
  marriageIdx: number
  children: string[]
  firstYear: number
  lastYear: number
  adopted: boolean
}
export interface Branch {
  id: string
  famId: string
  famIdx: number
  /** Parents, then the child — what dimming / highlighting matches on. */
  ids: string[]
  parents: string[]
  childId: string
  year: number
  adopted: boolean
  relIds: string[]
  /** The child's main family (bio couple > bio single > adoptive). */
  primary: boolean
  /** Sprout mode: this child's lifeline grows out of the stem instead. */
  sprout: boolean
}

/** Parent → child edges: the registry's vertical role, or the built-in pair. */
export function isParentLink(type: string, roles?: TypeRoles): boolean {
  if (roles && roles.size) return roles.get(type) === 'vertical'
  return type === 'parent_child' || type === 'adopted'
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/** Split a child's parents into families: married pairs first, then a lone
 *  pair stays a couple (co-parents), everyone left over parents alone. */
function groupParents(ids: string[], married: Map<string, number[]>): string[][] {
  if (ids.length <= 2) return [ids]
  const left = new Set(ids)
  const out: string[][] = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i],
        b = ids[j]
      if (left.has(a) && left.has(b) && married.has(pairKey(a, b))) {
        out.push([a, b])
        left.delete(a)
        left.delete(b)
      }
    }
  }
  for (const id of left) out.push([id])
  return out
}

export function buildFamilies(
  people: readonly LinkPerson[],
  rels: readonly LinkRel[],
  marriages: readonly LinkMarriage[],
  roles?: TypeRoles
): { families: Family[]; branches: Branch[] } {
  const byId = new Map(people.map((p) => [p.id, p]))
  const married = new Map<string, number[]>()
  marriages.forEach((m, i) => {
    const k = pairKey(m.ids[0], m.ids[1])
    const list = married.get(k)
    if (list) list.push(i)
    else married.set(k, [i])
  })

  // child → (kind → parent → relationship id)
  const parentsOf = new Map<string, { bio: Map<string, string>; adopt: Map<string, string> }>()
  for (const r of rels) {
    if (!isParentLink(r.type, roles)) continue
    const parent = r.person_a_id,
      child = r.person_b_id
    if (parent === child || !byId.has(parent) || !byId.has(child)) continue
    let e = parentsOf.get(child)
    if (!e) parentsOf.set(child, (e = { bio: new Map(), adopt: new Map() }))
    const m = r.type === 'adopted' ? e.adopt : e.bio
    if (!m.has(parent)) m.set(parent, r.id)
  }

  const famMap = new Map<string, Family>()
  const families: Family[] = []
  const branches: Branch[] = []
  // Deterministic: children in birth order.
  const kids = [...parentsOf.keys()].sort(
    (a, b) => byId.get(a)!.birthYear - byId.get(b)!.birthYear || (a < b ? -1 : 1)
  )
  for (const childId of kids) {
    const e = parentsOf.get(childId)!
    const child = byId.get(childId)!
    const mine: Branch[] = []
    for (const adopted of [false, true]) {
      const m = adopted ? e.adopt : e.bio
      if (!m.size) continue
      for (const g of groupParents([...m.keys()], married)) {
        const parents = [...g].sort()
        const id = `fam:${parents.join('|')}${adopted ? ':a' : ''}`
        let fam = famMap.get(id)
        if (!fam) {
          fam = {
            id,
            parents,
            marriageIdx: -1,
            children: [],
            firstYear: child.birthYear,
            lastYear: child.birthYear,
            adopted
          }
          famMap.set(id, fam)
          families.push(fam)
        }
        fam.children.push(childId)
        fam.firstYear = Math.min(fam.firstYear, child.birthYear)
        fam.lastYear = Math.max(fam.lastYear, child.birthYear)
        const b: Branch = {
          id: `${id}>${childId}`,
          famId: id,
          famIdx: families.indexOf(fam),
          ids: [...parents, childId],
          parents,
          childId,
          year: child.birthYear,
          adopted,
          relIds: parents.map((p) => m.get(p)!),
          primary: false,
          sprout: false
        }
        mine.push(b)
        branches.push(b)
      }
    }
    // The child's main family: a bio couple, else bio single, else adoptive.
    const rank = (b: Branch) => (b.adopted ? 2 : 0) + (b.parents.length === 2 ? 0 : 1)
    let best: Branch | null = null
    for (const b of mine) if (!best || rank(b) < rank(best)) best = b
    if (best) best.primary = true
  }

  // The rope a couple's stem hangs from: the marriage before their first
  // child (else their earliest one).
  for (const fam of families) {
    if (fam.parents.length !== 2) continue
    const list = married.get(pairKey(fam.parents[0], fam.parents[1]))
    if (!list) continue
    let pick = -1
    for (const i of list) {
      const y = marriages[i].year
      if (y <= fam.firstYear && (pick < 0 || y > marriages[pick].year)) pick = i
    }
    if (pick < 0)
      for (const i of list) if (pick < 0 || marriages[i].year < marriages[pick].year) pick = i
    fam.marriageIdx = pick
  }
  return { families, branches }
}

// ── Lane order: count only the crossings that matter ────────────────────────
// A connector is "in the way" of any life alive during [y0, y1]: a branch at
// its birth year, a marriage from the wedding down to the couple's last child
// (their stem drops between them all that time).
interface Connector {
  a: number
  b: number
  y0: number
  y1: number
  w: number
}

function connectorsOf(
  idx: Map<string, number>,
  branches: readonly Branch[],
  marriages: readonly LinkMarriage[],
  wMarriage: number
): Connector[] {
  const out: Connector[] = []
  const lastChild = new Map<string, number>()
  for (const br of branches) {
    if (br.parents.length !== 2) continue
    const k = pairKey(br.parents[0], br.parents[1])
    lastChild.set(k, Math.max(lastChild.get(k) ?? -Infinity, br.year))
  }
  for (const m of marriages) {
    const a = idx.get(m.ids[0]),
      b = idx.get(m.ids[1])
    if (a == null || b == null || a === b) continue
    const y1 = Math.max(m.year, lastChild.get(pairKey(m.ids[0], m.ids[1])) ?? m.year)
    out.push({ a, b, y0: m.year, y1, w: wMarriage })
  }
  for (const br of branches) {
    const c = idx.get(br.childId)
    if (c == null) continue
    // A couple's branch leaves from between them: half a pull to each.
    const w = 1 / br.parents.length
    for (const p of br.parents) {
      const a = idx.get(p)
      if (a != null && a !== c) out.push({ a, b: c, y0: br.year, y1: br.year, w })
    }
  }
  return out
}

export interface LaneCostOpts {
  /** Cost of passing over one living lifeline. */
  wCross?: number
  /** Cost per lane of connector length (keeps families together). */
  wLen?: number
  /** Marriages pull harder than branches (couples stay side by side). */
  wMarriage?: number
}

/** Total cost of an order: live crossings + length (exported for tests). */
export function laneCost(
  order: readonly string[],
  people: readonly LinkPerson[],
  branches: readonly Branch[],
  marriages: readonly LinkMarriage[],
  { wCross = 1, wLen = 0.12, wMarriage = 1.25 }: LaneCostOpts = {}
): number {
  const byId = new Map(people.map((p) => [p.id, p]))
  const seq = order.filter((id) => byId.has(id))
  const idx = new Map(seq.map((id, i) => [id, i]))
  let cost = 0
  for (const c of connectorsOf(idx, branches, marriages, wMarriage)) {
    const lo = Math.min(c.a, c.b),
      hi = Math.max(c.a, c.b)
    let crossed = 0
    for (let k = lo + 1; k < hi; k++) {
      const q = byId.get(seq[k])!
      if (q.birthYear <= c.y1 && c.y0 <= q.endYear) crossed++
    }
    cost += c.w * (wCross * crossed + wLen * (hi - lo - 1))
  }
  return cost
}

/**
 * Refine a lane order by adjacent swaps that lower the live-crossing cost.
 * Each swap's cost change is local (only connectors touching the pair), so a
 * pass is linear. Ids not on the timeline keep their relative order at the end.
 */
export function optimizeLaneOrder(
  order: readonly string[],
  people: readonly LinkPerson[],
  branches: readonly Branch[],
  marriages: readonly LinkMarriage[],
  {
    wCross = 1,
    wLen = 0.12,
    wMarriage = 1.25,
    maxPasses = 40
  }: LaneCostOpts & {
    maxPasses?: number
  } = {}
): string[] {
  const byId = new Map(people.map((p) => [p.id, p]))
  const seen = new Set<string>()
  const ids: string[] = []
  for (const id of order) {
    if (!byId.has(id) || seen.has(id)) continue
    ids.push(id)
    seen.add(id)
  }
  const missing = people.filter((p) => !seen.has(p.id)).sort((a, b) => a.birthYear - b.birthYear)
  for (const p of missing) ids.push(p.id)
  const rest = order.filter((id) => !byId.has(id))
  const n = ids.length
  if (n < 3) return [...ids, ...rest]

  const k0 = new Map(ids.map((id, i) => [id, i])) // person → stable index
  const birth = ids.map((id) => byId.get(id)!.birthYear)
  const end = ids.map((id) => byId.get(id)!.endYear)
  const conns = connectorsOf(k0, branches, marriages, wMarriage)
  const adj: number[][] = ids.map(() => [])
  conns.forEach((c, i) => {
    adj[c.a].push(i)
    adj[c.b].push(i)
  })
  const seq = ids.map((_, i) => i) // position → person
  const pos = ids.map((_, i) => i) // person → position
  const alive = (k: number, c: Connector) => (birth[k] <= c.y1 && c.y0 <= end[k] ? 1 : 0)

  // Cost change of swapping the persons at positions i and i+1.
  const delta = (A: number, B: number, i: number) => {
    let d = 0
    for (const ci of adj[A]) {
      const c = conns[ci]
      const o = c.a === A ? c.b : c.a
      if (o === B) continue
      const step = c.w * (wCross * alive(B, c) + wLen)
      d += pos[o] > i + 1 ? -step : step
    }
    for (const ci of adj[B]) {
      const c = conns[ci]
      const o = c.a === B ? c.b : c.a
      if (o === A) continue
      const step = c.w * (wCross * alive(A, c) + wLen)
      d += pos[o] < i ? -step : step
    }
    return d
  }

  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false
    for (let i = 0; i < n - 1; i++) {
      const A = seq[i],
        B = seq[i + 1]
      if (delta(A, B, i) < -1e-9) {
        seq[i] = B
        seq[i + 1] = A
        pos[B] = i
        pos[A] = i + 1
        improved = true
      }
    }
    if (!improved) break
  }
  return [...seq.map((k) => ids[k]), ...rest]
}

// ── Sprout mode: lanes as slots in time ─────────────────────────────────────
/**
 * Pack lives into reusable lanes. In birth order, each person takes the free
 * lane (its last occupant gone `margin` years before) nearest their anchor:
 * their parents' stem, else a placed spouse, else just past a future spouse's
 * parents (leaving that spouse's own slot free), else their neighbour in
 * `rank` (the tree order). Opening a lane beyond the current edge costs half
 * a lane, so freed lanes get reused. Returns id → lane ≥ 0.
 */
export function packSproutLanes(
  people: readonly LinkPerson[],
  rank: ReadonlyMap<string, number>,
  branches: readonly Branch[],
  marriages: readonly LinkMarriage[],
  { margin = 2 }: { margin?: number } = {}
): Map<string, number> {
  const parentsOf = new Map<string, string[]>()
  for (const b of branches) if (b.primary) parentsOf.set(b.childId, b.parents)
  const spousesOf = new Map<string, string[]>()
  for (const m of marriages) {
    const [a, b] = m.ids
    if (!spousesOf.has(a)) spousesOf.set(a, [])
    if (!spousesOf.has(b)) spousesOf.set(b, [])
    spousesOf.get(a)!.push(b)
    spousesOf.get(b)!.push(a)
  }
  const rk = (id: string) => rank.get(id) ?? Number.MAX_SAFE_INTEGER
  const sorted = [...people].sort(
    (a, b) => a.birthYear - b.birthYear || rk(a.id) - rk(b.id) || (a.id < b.id ? -1 : 1)
  )
  const laneOf = new Map<string, number>()
  const lastEnd = new Map<number, number>()
  const placed: string[] = [] // in rank order (for the neighbour fallback)
  let lo = 0,
    hi = -1
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
  const side = (d: number) => (d < 0 ? -1 : 1)

  for (const p of sorted) {
    let anchor = 0
    let prefer = 1
    const r = rk(p.id)
    const ps = (parentsOf.get(p.id) || []).filter((id) => laneOf.has(id))
    const sp = (spousesOf.get(p.id) || []).filter((id) => laneOf.has(id))
    if (ps.length) {
      anchor = mean(ps.map((id) => laneOf.get(id)!))
      prefer = side(r - mean(ps.map(rk)))
    } else if (sp.length) {
      prefer = side(r - rk(sp[0]))
      anchor = laneOf.get(sp[0])! + prefer * 0.6
    } else {
      // Marrying in later: settle beside the future spouse's family.
      const inlaws = (spousesOf.get(p.id) || [])
        .flatMap((s) => parentsOf.get(s) || [])
        .filter((id) => laneOf.has(id))
      if (inlaws.length) {
        prefer = side(r - mean(inlaws.map(rk)))
        anchor = mean(inlaws.map((id) => laneOf.get(id)!)) + prefer * 2
      } else if (placed.length) {
        let q = placed[0]
        for (const id of placed) if (Math.abs(rk(id) - r) < Math.abs(rk(q) - r)) q = id
        prefer = side(r - rk(q))
        anchor = laneOf.get(q)! + prefer * 0.4
      }
    }
    let best = 0,
      bestScore = Infinity
    if (hi < lo) best = 0
    else {
      const from = Math.min(lo - 1, Math.floor(anchor) - 1),
        to = Math.max(hi + 1, Math.ceil(anchor) + 1)
      for (let c = from; c <= to; c++) {
        const e = lastEnd.get(c)
        if (e != null && e + margin > p.birthYear) continue
        const d = c - anchor
        const score =
          Math.abs(d) +
          (d !== 0 && side(d) !== prefer ? 0.01 : 0) +
          (c < lo || c > hi ? 0.5 : 0) +
          Math.abs(c) * 1e-6
        if (score < bestScore) {
          bestScore = score
          best = c
        }
      }
    }
    laneOf.set(p.id, best)
    lastEnd.set(best, Math.max(p.endYear, p.birthYear + 0.5))
    lo = Math.min(lo, best)
    hi = Math.max(hi, best)
    placed.push(p.id)
  }
  for (const [id, l] of laneOf) laneOf.set(id, l - lo)
  return laneOf
}

// ── Screen-space curves ─────────────────────────────────────────────────────
/** Cubic control points [x0,y0, x1,y1, x2,y2, x3,y3]. */
export type Cubic = [number, number, number, number, number, number, number, number]

/** How far above the birth a branch leaves its stem (longer reach, higher
 *  departure — siblings' branches nest instead of stacking). */
export function branchDrop(dx: number): number {
  return Math.min(90, 14 + Math.abs(dx) * 0.07)
}

/** A branch: straight down the stem from yDep, rounding out to land level on
 *  the child's lane at its birth y. `straight` = a tight elbow. */
export function branchCubic(
  sx: number,
  yDep: number,
  cx: number,
  y: number,
  straight = false
): Cubic {
  if (straight) return [sx, yDep, sx, y, sx, y, cx, y]
  const dy = y - yDep
  return [sx, yDep, sx, yDep + dy * 0.8, sx + (cx - sx) * 0.3, y, cx, y]
}

/** How far down a sprouting lifeline travels while it peels into its lane. */
export function sproutDrop(dx: number): number {
  return Math.min(64, 20 + Math.abs(dx) * 0.3)
}

/** A sprout: an S from the stem at the birth down into the child's lane. */
export function sproutCubic(sx: number, y0: number, x: number, dy: number): Cubic {
  return [sx, y0, sx, y0 + dy * 0.55, x, y0 + dy * 0.45, x, y0 + dy]
}

export function cubicPoint(c: Cubic, t: number): { x: number; y: number } {
  const u = 1 - t
  const a = u * u * u,
    b = 3 * u * u * t,
    d = 3 * u * t * t,
    e = t * t * t
  return {
    x: a * c[0] + b * c[2] + d * c[4] + e * c[6],
    y: a * c[1] + b * c[3] + d * c[5] + e * c[7]
  }
}

/** t where a curve that runs monotonically in x reaches `x` (bisection). */
export function cubicTAtX(c: Cubic, x: number): number {
  const rising = c[6] >= c[0]
  let lo = 0,
    hi = 1
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2
    const px = cubicPoint(c, mid).x
    if (px < x === rising) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Sample [t0, t1] of a cubic into `out` (seg + 1 points). */
export function sampleCubicRange(
  out: { x: number; y: number }[],
  seg: number,
  c: Cubic,
  t0 = 0,
  t1 = 1
): { x: number; y: number }[] {
  for (let i = 0; i <= seg; i++) {
    const p = cubicPoint(c, t0 + ((t1 - t0) * i) / seg)
    out[i].x = p.x
    out[i].y = p.y
  }
  return out
}

/**
 * Bridges: the solid t-pieces of a branch once it is cut open where it passes
 * under the lifelines at `crossings` (screen x + half gap). Ends within a gap
 * of the branch's own endpoints are never cut. At most `maxPieces` pieces —
 * beyond that the rest of the branch stays solid.
 */
export function bridgePieces(
  c: Cubic,
  crossings: readonly { x: number; half: number }[],
  maxPieces = 24
): [number, number][] {
  if (!crossings.length) return [[0, 1]]
  const x0 = c[0],
    x1 = c[6]
  const lo = Math.min(x0, x1),
    hi = Math.max(x0, x1)
  const gaps: [number, number][] = []
  for (const k of crossings) {
    if (k.x - k.half <= lo + 2 || k.x + k.half >= hi - 2) continue
    const ta = cubicTAtX(c, k.x - k.half),
      tb = cubicTAtX(c, k.x + k.half)
    gaps.push([Math.min(ta, tb), Math.max(ta, tb)])
  }
  if (!gaps.length) return [[0, 1]]
  gaps.sort((a, b) => a[0] - b[0])
  const pieces: [number, number][] = []
  let t = 0
  for (const [a, b] of gaps) {
    if (b <= t) continue
    if (a > t) {
      if (pieces.length >= maxPieces - 1) break
      pieces.push([t, a])
    }
    t = Math.max(t, b)
  }
  if (t < 1) pieces.push([t, 1])
  return pieces
}

/** Distance from (mx, my) to a polyline stored flat as x0,y0,x1,y1… at `off`. */
export function distToPolyline(
  pts: ArrayLike<number>,
  off: number,
  count: number,
  mx: number,
  my: number
): number {
  let best = Infinity
  for (let i = 0; i < count - 1; i++) {
    const ax = pts[off + i * 2],
      ay = pts[off + i * 2 + 1],
      bx = pts[off + i * 2 + 2],
      by = pts[off + i * 2 + 3]
    const dx = bx - ax,
      dy = by - ay
    const l2 = dx * dx + dy * dy
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((mx - ax) * dx + (my - ay) * dy) / l2)) : 0
    const d = Math.hypot(mx - (ax + dx * t), my - (ay + dy * t))
    if (d < best) best = d
  }
  return best
}
