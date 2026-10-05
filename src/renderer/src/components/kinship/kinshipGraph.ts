// Kinship engine — pure graph math over persons + relationships (no Vue, D3,
// Three or store dependency; unit-tested in tests/kinship.test.js).
//
// It answers "what IS this person to that one?" the way a genealogist would:
// walk up to the closest common ancestor, count the generations on each side,
// and read the pair (up, down) off the classic cousin chart — then layer the
// marriage-made relatives (spouses, in-laws, step-kin, co-parents-in-law) and
// the social edges (friends, mentors…) on top. Everything reads the
// relationship-type registry's symmetryRole, never type literals, except the
// two built-ins that carry genealogical meaning of their own: `parent_child`
// (biological — counts toward shared DNA) and `adopted` (legal kin, no DNA).
//
// Naming lives in kinshipNames.ts; this module only produces structure.

export type Sex = 'm' | 'f' | 'x'
export type SymRole = 'vertical' | 'horizontal' | 'none'

export interface KDate {
  year?: number | null
  month?: number | null
  day?: number | null
}
export interface KPerson {
  id: string
  name?: string
  gender?: string
  gender_t?: number | null
  birth?: KDate | null
  death?: KDate | null
}
export interface KRel {
  id: string
  person_a_id: string
  person_b_id: string
  type: string
  status?: string
  ended?: KDate | null
  label?: string | null
}

interface ParentLink {
  id: string
  /** the edge is `adopted` — legal kin, no shared DNA */
  adoptive: boolean
  /** the edge is biological `parent_child` (counts toward DNA) */
  bio: boolean
}
interface SpouseLink {
  id: string
  ended: boolean
  type: string
  status: string
}
interface SocialLink {
  id: string
  rel: KRel
}

export interface KinIndex {
  ids: Set<string>
  sex: Map<string, Sex>
  /** fractional birth year, or null when undated */
  born: Map<string, number | null>
  parents: Map<string, ParentLink[]>
  children: Map<string, ParentLink[]>
  spouses: Map<string, SpouseLink[]>
  social: Map<string, SocialLink[]>
  /** explicit `sibling` rows (half/step/undocumented-parent cases) */
  explicitSiblings: Map<string, Set<string>>
  /** topological rank over biological edges (ancestors < descendants) */
  topo: Map<string, number>
  /** undirected adjacency over every edge type (for hops / bridges) */
  adj: Map<string, Set<string>>
}

const LEGACY_ROLE = (t: string): SymRole =>
  t === 'parent_child' || t === 'adopted' ? 'vertical' : t === 'spouse' ? 'horizontal' : 'none'

/** Map a person's gender snapshot onto m / f / x (the 0..1 gradient wins). */
export function sexOf(p: KPerson | undefined | null): Sex {
  if (!p) return 'x'
  const t = p.gender_t
  if (typeof t === 'number' && Number.isFinite(t)) return t <= 0.35 ? 'm' : t >= 0.65 ? 'f' : 'x'
  const g = String(p.gender || '').trim()
  if (/^(female|woman|f$|girl|fem|lady)/i.test(g)) return 'f'
  if (/^(male|man|m$|boy|masc|gentleman)/i.test(g)) return 'm'
  return 'x'
}

export function dateNum(d: KDate | null | undefined): number | null {
  if (!d || d.year == null || !Number.isFinite(Number(d.year))) return null
  return Number(d.year) + ((d.month || 1) - 1) / 12 + ((d.day || 1) - 1) / 372
}

function pushMap<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const a = m.get(k)
  if (a) a.push(v)
  else m.set(k, [v])
}

export function buildKinIndex(
  persons: KPerson[],
  relationships: KRel[],
  roleOf: (type: string) => SymRole = LEGACY_ROLE
): KinIndex {
  const ids = new Set(persons.map((p) => p.id))
  const sex = new Map<string, Sex>()
  const born = new Map<string, number | null>()
  for (const p of persons) {
    sex.set(p.id, sexOf(p))
    born.set(p.id, dateNum(p.birth))
  }
  const parents = new Map<string, ParentLink[]>()
  const children = new Map<string, ParentLink[]>()
  const spouses = new Map<string, SpouseLink[]>()
  const social = new Map<string, SocialLink[]>()
  const explicitSiblings = new Map<string, Set<string>>()
  const adj = new Map<string, Set<string>>()
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set())
    if (!adj.has(b)) adj.set(b, new Set())
    adj.get(a)!.add(b)
    adj.get(b)!.add(a)
  }

  for (const r of relationships) {
    const a = r.person_a_id
    const b = r.person_b_id
    if (!a || !b || a === b || !ids.has(a) || !ids.has(b)) continue
    link(a, b)
    const role = roleOf(r.type)
    if (role === 'vertical') {
      // Dedupe: parent_child + adopted rows for the same pair collapse to one
      // link, biological if either row is.
      const bio = r.type === 'parent_child'
      const adoptive = r.type === 'adopted'
      const existing = (parents.get(b) || []).find((l) => l.id === a)
      if (existing) {
        existing.bio = existing.bio || bio
        existing.adoptive = existing.adoptive && adoptive
        const c = (children.get(a) || []).find((l) => l.id === b)!
        c.bio = existing.bio
        c.adoptive = existing.adoptive
        continue
      }
      pushMap(parents, b, { id: a, adoptive, bio })
      pushMap(children, a, { id: b, adoptive, bio })
    } else if (role === 'horizontal') {
      const ended =
        !!(r.ended && r.ended.year != null) || r.status === 'divorced' || r.status === 'ended'
      const s = r.status || ''
      pushMap(spouses, a, { id: b, ended, type: r.type, status: s })
      pushMap(spouses, b, { id: a, ended, type: r.type, status: s })
    } else if (r.type === 'sibling') {
      if (!explicitSiblings.has(a)) explicitSiblings.set(a, new Set())
      if (!explicitSiblings.has(b)) explicitSiblings.set(b, new Set())
      explicitSiblings.get(a)!.add(b)
      explicitSiblings.get(b)!.add(a)
    } else {
      pushMap(social, a, { id: b, rel: r })
      pushMap(social, b, { id: a, rel: r })
    }
  }

  // Topological rank over biological edges (Kahn). People caught in a
  // (bad-data) cycle get no rank; DNA math treats them as unrelated.
  const topo = new Map<string, number>()
  const indeg = new Map<string, number>()
  for (const id of ids) indeg.set(id, 0)
  for (const [child, ps] of parents) {
    indeg.set(child, ps.filter((p) => p.bio).length)
  }
  const queue: string[] = []
  for (const [id, d] of indeg) if (d === 0) queue.push(id)
  for (let i = 0; i < queue.length; i++) {
    const u = queue[i]
    topo.set(u, i)
    for (const c of children.get(u) || []) {
      if (!c.bio) continue
      const d = (indeg.get(c.id) || 0) - 1
      indeg.set(c.id, d)
      if (d === 0) queue.push(c.id)
    }
  }

  return { ids, sex, born, parents, children, spouses, social, explicitSiblings, topo, adj }
}

// ── Blood relations ─────────────────────────────────────────────────────────

export interface BloodHit {
  /** generations from the anchor UP to the common ancestor */
  up: number
  /** generations from the common ancestor DOWN to the target */
  down: number
  /** the closest common ancestor(s) at this (up, down) */
  cas: string[]
  /** anchor → … → common ancestor */
  upPath: string[]
  /** common ancestor → … → target */
  downPath: string[]
  /** any edge on the route is an adoption */
  adoptive: boolean
  /** share only one of the two parents of the connecting generation */
  half: boolean
  /** other distinct (up, down) routes — pedigree collapse / double kinship */
  alts: { up: number; down: number; ca: string }[]
  /** an explicit `sibling` row supplied this (no recorded shared parent) */
  explicit?: boolean
}

interface Reach {
  depth: number
  path: string[]
  adoptive: boolean
}

/** Every ancestor of `id` (incl. itself at depth 0) with its shortest path. */
export function ancestorsOf(index: KinIndex, id: string, maxUp = 24): Map<string, Reach> {
  const out = new Map<string, Reach>([[id, { depth: 0, path: [id], adoptive: false }]])
  let frontier = [id]
  for (let d = 1; d <= maxUp && frontier.length; d++) {
    const next: string[] = []
    for (const cur of frontier) {
      const base = out.get(cur)!
      for (const p of index.parents.get(cur) || []) {
        if (out.has(p.id)) continue
        out.set(p.id, {
          depth: d,
          path: [...base.path, p.id],
          adoptive: base.adoptive || p.adoptive
        })
        next.push(p.id)
      }
    }
    frontier = next
  }
  return out
}

function isBetter(a: { up: number; down: number }, b: { up: number; down: number }) {
  const sa = a.up + a.down
  const sb = b.up + b.down
  if (sa !== sb) return sa < sb
  return Math.abs(a.up - a.down) < Math.abs(b.up - b.down)
}

/**
 * Blood relatives of `anchor`: walk up to each ancestor, then down its side
 * branches. The best (up, down) per person is the closest common ancestor on
 * the cousin chart; ties at the same (up, down) collect every shared ancestor
 * (both parents → a full relation; one → half).
 */
export function bloodFrom(index: KinIndex, anchor: string, maxUp = 16): Map<string, BloodHit> {
  const hits = new Map<string, BloodHit>()
  if (!index.ids.has(anchor)) return hits
  const anc = ancestorsOf(index, anchor, maxUp)
  const ordered = [...anc.entries()].sort((a, b) => a[1].depth - b[1].depth)

  for (const [ca, reach] of ordered) {
    const up = reach.depth
    // The ancestor itself (a direct line: parent, grandparent…).
    if (ca !== anchor) {
      record(ca, { up, down: 0, ca, upPath: reach.path, downPath: [ca], adoptive: reach.adoptive })
    }
    // Descend its side branches, never re-entering the anchor's own line —
    // anything below an ancestor is better reached from that ancestor.
    let frontier: { id: string; path: string[]; adoptive: boolean }[] = [
      { id: ca, path: [ca], adoptive: reach.adoptive }
    ]
    const seen = new Set<string>([ca])
    for (let down = 1; frontier.length; down++) {
      const next: typeof frontier = []
      for (const f of frontier) {
        for (const c of index.children.get(f.id) || []) {
          if (seen.has(c.id) || anc.has(c.id)) continue
          seen.add(c.id)
          const item = { id: c.id, path: [...f.path, c.id], adoptive: f.adoptive || c.adoptive }
          record(c.id, {
            up,
            down,
            ca,
            upPath: reach.path,
            downPath: item.path,
            adoptive: item.adoptive
          })
          next.push(item)
        }
      }
      frontier = next
    }
  }

  // Explicit sibling rows: half/step/undocumented siblings the parent edges
  // can't see. They only fill gaps — derived kinship always wins.
  for (const sib of index.explicitSiblings.get(anchor) || []) {
    if (hits.has(sib) || sib === anchor) continue
    hits.set(sib, {
      up: 1,
      down: 1,
      cas: [],
      upPath: [anchor],
      downPath: [sib],
      adoptive: false,
      half: false,
      alts: [],
      explicit: true
    })
  }

  // Half vs full: one shared ancestor at the connecting generation, and both
  // sides have a second (different) parent on record → half. Missing data
  // (a parent never entered) reads as full rather than guessing "half".
  for (const h of hits.values()) {
    if (h.explicit || h.up === 0 || h.down === 0 || h.cas.length !== 1) continue
    const aSide = h.upPath[h.upPath.length - 2]
    const bSide = h.downPath[1]
    const pa = index.parents.get(aSide)?.length || 0
    const pb = index.parents.get(bSide)?.length || 0
    h.half = pa >= 2 && pb >= 2
  }
  return hits

  function record(
    id: string,
    c: {
      up: number
      down: number
      ca: string
      upPath: string[]
      downPath: string[]
      adoptive: boolean
    }
  ) {
    const cur = hits.get(id)
    if (!cur) {
      hits.set(id, {
        up: c.up,
        down: c.down,
        cas: [c.ca],
        upPath: c.upPath,
        downPath: c.downPath,
        adoptive: c.adoptive,
        half: false,
        alts: []
      })
      return
    }
    if (cur.up === c.up && cur.down === c.down) {
      if (!cur.cas.includes(c.ca)) cur.cas.push(c.ca)
      if (!c.adoptive) cur.adoptive = cur.adoptive && c.adoptive
      return
    }
    const alt = { up: c.up, down: c.down, ca: c.ca }
    if (isBetter(c, cur)) {
      const demoted = { up: cur.up, down: cur.down, ca: cur.cas[0] }
      Object.assign(cur, {
        up: c.up,
        down: c.down,
        cas: [c.ca],
        upPath: c.upPath,
        downPath: c.downPath,
        adoptive: c.adoptive
      })
      cur.alts = [demoted, ...cur.alts].filter((a) => !(a.up === cur.up && a.down === cur.down))
    } else if (!cur.alts.some((a) => a.up === alt.up && a.down === alt.down)) {
      if (cur.alts.length < 6) cur.alts.push(alt)
    }
  }
}

// ── The full lens: everyone, as seen from one person ────────────────────────

export type KinKind =
  'self' | 'blood' | 'spouse' | 'inlaw' | 'affine' | 'step' | 'coparent' | 'social' | 'distant'

export interface Kin {
  kind: KinKind
  /** blood: anchor→target · inlaw: spouse→target · affine: anchor→relative ·
   *  step: the step-relation's own (up, down) (1,0 stepparent, 0,1 stepchild,
   *  1,1 stepsibling, 2,0 step-grandparent, 0,2 step-grandchild) */
  up: number
  down: number
  half: boolean
  adoptive: boolean
  /** target's sex */
  sex: Sex
  /** blood: routes; inlaw: from the spouse; affine: to the relative */
  upPath: string[]
  downPath: string[]
  cas: string[]
  alts: { up: number; down: number; ca: string }[]
  /** the spouse (inlaw/step-child) or relative (affine/step-parent) linking us */
  via?: string
  /** that link is an ended marriage (former in-law / ex-spouse) */
  viaEnded?: boolean
  /** spouse: the partnership ended; its registry type + status */
  ended?: boolean
  spouseType?: string
  status?: string
  /** social: the edge itself (the naming layer reads its registry role) */
  rel?: KRel
  /** distant: undirected hops */
  hops?: number
  /** a second, different relation to the same person (a wife who is also a
   *  cousin — the tangled-roots case) */
  also?: Kin[]
}

function blank(kind: KinKind, sex: Sex): Kin {
  return {
    kind,
    up: 0,
    down: 0,
    half: false,
    adoptive: false,
    sex,
    upPath: [],
    downPath: [],
    cas: [],
    alts: []
  }
}

function fromHit(h: BloodHit, sex: Sex, kind: KinKind = 'blood'): Kin {
  return {
    kind,
    up: h.up,
    down: h.down,
    half: h.half,
    adoptive: h.adoptive,
    sex,
    upPath: h.upPath,
    downPath: h.downPath,
    cas: h.cas,
    alts: h.alts
  }
}

/** Undirected hop distances over every edge type. */
export function hopsFrom(index: KinIndex, start: string, maxDepth = Infinity): Map<string, number> {
  const dist = new Map([[start, 0]])
  let frontier = [start]
  for (let d = 1; frontier.length && d <= maxDepth; d++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const o of index.adj.get(id) || []) {
        if (dist.has(o)) continue
        dist.set(o, d)
        next.push(o)
      }
    }
    frontier = next
  }
  return dist
}

/**
 * Everyone's relation to `anchor`, keyed by person id (the anchor is 'self').
 * Priority: spouse > blood > step > in-law > affine > co-parent-in-law >
 * social > distant; a spouse who is ALSO blood keeps the blood kin in `also`.
 */
export function kinshipLens(index: KinIndex, anchor: string): Map<string, Kin> {
  const out = new Map<string, Kin>()
  if (!index.ids.has(anchor)) return out
  const sx = (id: string) => index.sex.get(id) || 'x'
  out.set(anchor, blank('self', sx(anchor)))

  const blood = bloodFrom(index, anchor)
  const mySpouses = index.spouses.get(anchor) || []

  // 1. Spouses (with any blood tie kept as `also`).
  for (const s of mySpouses) {
    if (s.id === anchor) continue
    const k = blank('spouse', sx(s.id))
    k.ended = s.ended
    k.spouseType = s.type
    k.status = s.status
    const hit = blood.get(s.id)
    if (hit) k.also = [fromHit(hit, sx(s.id))]
    const prev = out.get(s.id)
    // Prefer the ongoing marriage when a couple has several rows.
    if (!prev || (prev.kind === 'spouse' && prev.ended && !s.ended)) out.set(s.id, k)
  }

  // 2. Blood.
  for (const [id, h] of blood) {
    if (!out.has(id)) out.set(id, fromHit(h, sx(id)))
  }

  // 3. Step-parents: a parent's partner who isn't my parent. Step-grandparents
  //    likewise one level up.
  for (const [id, h] of blood) {
    if (h.down !== 0 || (h.up !== 1 && h.up !== 2)) continue
    for (const s of index.spouses.get(id) || []) {
      if (out.has(s.id)) continue
      const k = blank('step', sx(s.id))
      k.up = h.up
      k.down = 0
      k.via = id
      k.viaEnded = s.ended
      k.upPath = [...h.upPath]
      out.set(s.id, k)
    }
  }

  // 4. Step-siblings: my step-parent's children who aren't blood.
  for (const [id, k] of [...out]) {
    if (k.kind !== 'step' || k.up !== 1) continue
    for (const c of index.children.get(id) || []) {
      if (out.has(c.id)) continue
      const s = blank('step', sx(c.id))
      s.up = 1
      s.down = 1
      s.via = id
      out.set(c.id, s)
    }
  }

  // 5. In-laws: my spouse's blood relatives (their children and grandchildren
  //    who aren't mine are step-children / step-grandchildren).
  for (const s of mySpouses) {
    const theirs = bloodFrom(index, s.id)
    for (const [id, h] of theirs) {
      if (id === anchor || out.has(id)) continue
      if (h.up === 0 && (h.down === 1 || h.down === 2)) {
        const k = blank('step', sx(id))
        k.up = 0
        k.down = h.down
        k.via = s.id
        k.viaEnded = s.ended
        k.downPath = h.downPath
        out.set(id, k)
        continue
      }
      const k = fromHit(h, sx(id), 'inlaw')
      k.via = s.id
      k.viaEnded = s.ended
      out.set(id, k)
    }
  }

  // 6. Affines: the spouses of my blood relatives (son-in-law, sister-in-law,
  //    uncle by marriage…).
  for (const [id, h] of blood) {
    for (const s of index.spouses.get(id) || []) {
      if (s.id === anchor || out.has(s.id)) continue
      const k = fromHit(h, sx(s.id), 'affine')
      k.via = id
      k.viaEnded = s.ended
      out.set(s.id, k)
    }
  }

  // 7. Co-parents-in-law: my children's spouses' parents.
  for (const [id, h] of blood) {
    if (h.up !== 0 || h.down !== 1) continue
    for (const s of index.spouses.get(id) || []) {
      for (const p of index.parents.get(s.id) || []) {
        if (p.id === anchor || out.has(p.id)) continue
        const k = blank('coparent', sx(p.id))
        k.via = id
        k.downPath = [anchor, id, s.id]
        out.set(p.id, k)
      }
    }
  }

  // 8. Direct social edges (friend, mentor, rival…).
  for (const s of index.social.get(anchor) || []) {
    if (out.has(s.id)) continue
    const k = blank('social', sx(s.id))
    k.rel = s.rel
    out.set(s.id, k)
  }

  // 9. Everyone else still reachable: "N hops away".
  const hops = hopsFrom(index, anchor)
  for (const [id, d] of hops) {
    if (out.has(id)) continue
    const k = blank('distant', sx(id))
    k.hops = d
    out.set(id, k)
  }
  return out
}

/** One pair's relation in both directions: what B is to A, and A to B. */
export function kinshipBetween(index: KinIndex, a: string, b: string) {
  return {
    ab: kinshipLens(index, a).get(b) || null,
    ba: kinshipLens(index, b).get(a) || null
  }
}

/** An alternate blood route (BloodHit.alts entry) as a full Kin record, so it
 *  can be named in any language — "…and also her second cousin". */
export function altAsKin(
  index: KinIndex,
  anchor: string,
  target: string,
  alt: { up: number; down: number; ca: string }
): Kin {
  const up = ancestorsOf(index, anchor).get(alt.ca)?.path || [anchor]
  const down = [...(ancestorsOf(index, target).get(alt.ca)?.path || [target])].reverse()
  return {
    kind: 'blood',
    up: up.length - 1,
    down: down.length - 1,
    half: false,
    adoptive: false,
    sex: index.sex.get(target) || 'x',
    upPath: up,
    downPath: down,
    cas: [alt.ca],
    alts: []
  }
}

/** Is B older than A? null when either is undated. */
export function isOlder(index: KinIndex, b: string, a: string): boolean | null {
  const bb = index.born.get(b)
  const ba = index.born.get(a)
  if (bb == null || ba == null || bb === ba) return null
  return bb < ba
}

// ── Chain tokens (the kinship "sentence" — used by naming + the walker) ─────
//  F M P  father / mother / parent      S D C  son / daughter / child
//  B Z X  brother / sister / sibling    H W E  husband / wife / spouse
export type Tok = 'F' | 'M' | 'P' | 'S' | 'D' | 'C' | 'B' | 'Z' | 'X' | 'H' | 'W' | 'E'
export interface ChainStep {
  t: Tok
  /** the person this step lands on */
  id: string
  /** sibling steps: older than the previous person in the chain */
  older?: boolean | null
}

const PAR: Record<Sex, Tok> = { m: 'F', f: 'M', x: 'P' }
const CHI: Record<Sex, Tok> = { m: 'S', f: 'D', x: 'C' }
const SIB: Record<Sex, Tok> = { m: 'B', f: 'Z', x: 'X' }
const SPO: Record<Sex, Tok> = { m: 'H', f: 'W', x: 'E' }

/** Blood route (up, down) from `from` as a token chain. */
function bloodChain(index: KinIndex, from: string, up: string[], down: string[]): ChainStep[] {
  const sx = (id: string) => index.sex.get(id) || 'x'
  const u = up.length - 1
  const d = down.length - 1
  const steps: ChainStep[] = []
  if (d === 0) {
    for (let i = 1; i <= u; i++) steps.push({ t: PAR[sx(up[i])], id: up[i] })
    return steps
  }
  if (u === 0) {
    for (let i = 1; i <= d; i++) steps.push({ t: CHI[sx(down[i])], id: down[i] })
    return steps
  }
  // parents up to (not incl.) the common ancestor, one sibling hop across,
  // then children down to the target.
  for (let i = 1; i < u; i++) steps.push({ t: PAR[sx(up[i])], id: up[i] })
  const prev = up[u - 1] || from
  steps.push({ t: SIB[sx(down[1])], id: down[1], older: isOlder(index, down[1], prev) })
  for (let i = 2; i <= d; i++) steps.push({ t: CHI[sx(down[i])], id: down[i] })
  return steps
}

/** The kinship chain from `anchor` to the target of `kin` (targetId). */
export function kinChain(index: KinIndex, anchor: string, targetId: string, kin: Kin): ChainStep[] {
  const sx = (id: string) => index.sex.get(id) || 'x'
  switch (kin.kind) {
    case 'self':
      return []
    case 'blood':
      if (!kin.upPath.length) {
        // explicit sibling row
        return [{ t: SIB[kin.sex], id: targetId, older: isOlder(index, targetId, anchor) }]
      }
      return bloodChain(index, anchor, kin.upPath, kin.downPath)
    case 'spouse':
      return [{ t: SPO[kin.sex], id: targetId }]
    case 'inlaw': {
      const s = kin.via!
      return [{ t: SPO[sx(s)], id: s }, ...bloodChain(index, s, kin.upPath, kin.downPath)]
    }
    case 'affine':
      return [
        ...bloodChain(index, anchor, kin.upPath, kin.downPath),
        { t: SPO[kin.sex], id: targetId }
      ]
    case 'step': {
      if (kin.down === 0) {
        // step-parent: [..parents to the via person] + spouse
        const via = kin.via!
        const up = kin.upPath
        const steps: ChainStep[] = []
        for (let i = 1; i < up.length; i++) steps.push({ t: PAR[sx(up[i])], id: up[i] })
        if (!steps.length) steps.push({ t: PAR[sx(via)], id: via })
        steps.push({ t: SPO[kin.sex], id: targetId })
        return steps
      }
      if (kin.up === 0) {
        // step-child: spouse + their children
        const s = kin.via!
        const steps: ChainStep[] = [{ t: SPO[sx(s)], id: s }]
        const dp = kin.downPath
        for (let i = 1; i < dp.length; i++) steps.push({ t: CHI[sx(dp[i])], id: dp[i] })
        if (dp.length < 2) steps.push({ t: CHI[kin.sex], id: targetId })
        return steps
      }
      // step-sibling: parent + their spouse + that spouse's child
      const stepParent = kin.via!
      const myParent =
        (index.spouses.get(stepParent) || [])
          .map((s) => s.id)
          .find((id) => (index.parents.get(anchor) || []).some((p) => p.id === id)) || stepParent
      return [
        { t: PAR[sx(myParent)], id: myParent },
        { t: SPO[sx(stepParent)], id: stepParent },
        { t: CHI[kin.sex], id: targetId }
      ]
    }
    case 'coparent': {
      const [, child, childSpouse] = kin.downPath
      return [
        { t: CHI[sx(child)], id: child },
        { t: SPO[sx(childSpouse)], id: childSpouse },
        { t: PAR[kin.sex], id: targetId }
      ]
    }
    default:
      return []
  }
}

// ── Route: the path drawn by the kinship diagram ───────────────────────────

export interface RoutePoint {
  id: string
  /** generation level relative to the anchor (+ = older generations) */
  level: number
  /** how this point was reached from the previous one */
  via: 'start' | 'up' | 'down' | 'marriage' | 'sibling'
  /** a common ancestor (the arch's keystone) */
  keystone?: boolean
}

/** The anchor→target route as generation-levelled points: blood routes pass
 *  THROUGH the common ancestor (a Λ arch), marriages are level hops. */
export function kinRoute(index: KinIndex, anchor: string, target: string, kin: Kin): RoutePoint[] {
  const pts: RoutePoint[] = [{ id: anchor, level: 0, via: 'start' }]
  let level = 0
  const blood = (up: string[], down: string[], cas: string[]) => {
    for (let i = 1; i < up.length; i++) pts.push({ id: up[i], level: ++level, via: 'up' })
    if (up.length && cas.includes(up[up.length - 1])) pts[pts.length - 1].keystone = true
    if (up.length === 1 && cas.includes(up[0])) pts[pts.length - 1].keystone = true
    for (let j = 1; j < down.length; j++) pts.push({ id: down[j], level: --level, via: 'down' })
  }
  const marry = (id: string) => pts.push({ id, level, via: 'marriage' })
  switch (kin.kind) {
    case 'self':
      return pts
    case 'blood':
      if (!kin.upPath.length) pts.push({ id: target, level: 0, via: 'sibling' })
      else blood(kin.upPath, kin.downPath, kin.cas)
      return pts
    case 'spouse':
      marry(target)
      return pts
    case 'inlaw':
      marry(kin.via!)
      blood(kin.upPath, kin.downPath, kin.cas)
      return pts
    case 'affine':
      blood(kin.upPath, kin.downPath, kin.cas)
      marry(target)
      return pts
    case 'step':
    case 'coparent': {
      // Follow the token chain: parents up, children down, spouses level.
      for (const st of kinChain(index, anchor, target, kin)) {
        if ('FMP'.includes(st.t)) pts.push({ id: st.id, level: ++level, via: 'up' })
        else if ('SDC'.includes(st.t)) pts.push({ id: st.id, level: --level, via: 'down' })
        else if ('HWE'.includes(st.t)) marry(st.id)
        else pts.push({ id: st.id, level, via: 'sibling' })
      }
      return pts
    }
    default:
      return pts
  }
}

// ── Kin walker: follow a chain of steps from a person ──────────────────────

export const WALK_TOKENS: Tok[] = ['F', 'M', 'P', 'B', 'Z', 'X', 'S', 'D', 'C', 'H', 'W', 'E']

function siblingsOf(index: KinIndex, id: string): Set<string> {
  const out = new Set<string>()
  for (const p of index.parents.get(id) || []) {
    for (const c of index.children.get(p.id) || []) if (c.id !== id) out.add(c.id)
  }
  for (const s of index.explicitSiblings.get(id) || []) out.add(s)
  return out
}

/** Everyone reached from `start` by following `tokens` in order. */
export function walkChain(index: KinIndex, start: string, tokens: Tok[]): Set<string> {
  let cur = new Set([start])
  const want = (t: Tok): Sex | null => ('FSBH'.includes(t) ? 'm' : 'MDZW'.includes(t) ? 'f' : null)
  for (const t of tokens) {
    const next = new Set<string>()
    const sexWanted = want(t)
    const ok = (id: string) => !sexWanted || index.sex.get(id) === sexWanted
    for (const id of cur) {
      let cands: Iterable<string> = []
      if ('FMP'.includes(t)) cands = (index.parents.get(id) || []).map((p) => p.id)
      else if ('SDC'.includes(t)) cands = (index.children.get(id) || []).map((c) => c.id)
      else if ('BZX'.includes(t)) cands = siblingsOf(index, id)
      else cands = (index.spouses.get(id) || []).map((s) => s.id)
      for (const c of cands) if (ok(c)) next.add(c)
    }
    cur = next
    if (!cur.size) break
  }
  cur.delete(start)
  return cur
}

// ── Shared blood: kinship coefficient, relatedness, inbreeding ─────────────

/** A memoised kinship-coefficient (φ) calculator over biological edges —
 *  φ(a,b) is the chance that an allele drawn from each is identical by
 *  descent; a couple's φ is their child's inbreeding coefficient F. */
export function makeKinshipCoefficient(index: KinIndex) {
  const memo = new Map<string, number>()
  const bioParents = (id: string) =>
    (index.parents.get(id) || [])
      .filter((p) => p.bio)
      .slice(0, 2)
      .map((p) => p.id)
  const F = (id: string): number => {
    const ps = bioParents(id)
    return ps.length === 2 ? phi(ps[0], ps[1]) : 0
  }
  function phi(a: string, b: string): number {
    const ta = index.topo.get(a)
    const tb = index.topo.get(b)
    if (ta == null || tb == null) return 0
    if (a === b) return (1 + F(a)) / 2
    // Expand the younger one (higher rank): it can't be the other's ancestor.
    let x = a
    let y = b
    if (ta < tb) {
      x = b
      y = a
    }
    const key = x + '|' + y
    const m = memo.get(key)
    if (m !== undefined) return m
    memo.set(key, 0) // cycle guard
    const ps = bioParents(x)
    let v = 0
    for (const p of ps) v += 0.5 * phi(p, y)
    memo.set(key, v)
    return v
  }
  /** Wright's coefficient of relationship r (≈ fraction of DNA shared). */
  const relatedness = (a: string, b: string) => {
    if (a === b) return 1
    const p = phi(a, b)
    if (!p) return 0
    return (2 * p) / Math.sqrt((1 + F(a)) * (1 + F(b)))
  }
  return { phi, F, relatedness }
}

/** Average autosomal genome length used for the "≈ shared cM" estimate. */
export const GENOME_CM = 6950

/** Expected shared centimorgans for relatedness r (full siblings share less
 *  measurable "half-identical" DNA than parent/child at the same r). */
export function expectedCM(r: number, fullSiblings = false) {
  return Math.round(r * GENOME_CM * (fullSiblings ? 0.752 : 1))
}

/** Consanguinity bands for a couple's φ — the Bloodline meter. */
export const BLOOD_BANDS = [
  { max: 0, key: 'none' },
  { max: 1 / 256, key: 'echo' },
  { max: 1 / 64, key: 'distant' },
  { max: 1 / 16, key: 'cousins' },
  { max: 1 / 8, key: 'close' },
  { max: 0.2, key: 'royal' },
  { max: Infinity, key: 'habsburg' }
] as const

export function bloodBand(phiValue: number): (typeof BLOOD_BANDS)[number]['key'] {
  if (!(phiValue > 0)) return 'none'
  for (const b of BLOOD_BANDS) if (b.max > 0 && phiValue <= b.max + 1e-12) return b.key
  return 'habsburg'
}

// ── Pedigree: fan slots, completeness, collapse ─────────────────────────────

/** The ancestor fan: rings[g][i] is the person in slot i of generation g
 *  (slot bits: 0 = paternal side, 1 = maternal side, most-significant first).
 *  `dup` marks ancestors who fill more than one slot (pedigree collapse). */
export function ancestorFan(index: KinIndex, id: string, generations = 5) {
  const rings: { id: string | null; dup: boolean }[][] = [[{ id, dup: false }]]
  const count = new Map<string, number>()
  const orderedParents = (pid: string | null): [string | null, string | null] => {
    if (!pid) return [null, null]
    const ps = (index.parents.get(pid) || []).map((p) => p.id)
    let father = ps.find((p) => index.sex.get(p) === 'm') || null
    let mother = ps.find((p) => index.sex.get(p) === 'f') || null
    for (const p of ps) {
      if (p === father || p === mother) continue
      if (!father) father = p
      else if (!mother) mother = p
    }
    return [father, mother]
  }
  for (let g = 1; g <= generations; g++) {
    const prev = rings[g - 1]
    const ring: { id: string | null; dup: boolean }[] = []
    for (const slot of prev) {
      const [f, m] = orderedParents(slot.id)
      ring.push({ id: f, dup: false }, { id: m, dup: false })
      if (f) count.set(f, (count.get(f) || 0) + 1)
      if (m) count.set(m, (count.get(m) || 0) + 1)
    }
    rings.push(ring)
  }
  for (const ring of rings)
    for (const s of ring) if (s.id && (count.get(s.id) || 0) > 1) s.dup = true
  return rings
}

/** Per-generation pedigree stats: slots known, distinct ancestors, collapse. */
export function pedigreeStats(index: KinIndex, id: string, generations = 8) {
  const rings = ancestorFan(index, id, generations)
  const gens: { g: number; slots: number; known: number; unique: number }[] = []
  let known = 0
  const all = new Set<string>()
  for (let g = 1; g < rings.length; g++) {
    const ids = rings[g].map((s) => s.id).filter(Boolean) as string[]
    const uniq = new Set(ids)
    uniq.forEach((x) => all.add(x))
    known += ids.length
    gens.push({ g, slots: 2 ** g, known: ids.length, unique: uniq.size })
  }
  return {
    gens,
    known,
    unique: all.size,
    /** share of filled slots taken by a repeat ancestor (0 = none) */
    collapse: known ? 1 - all.size / known : 0,
    deepest: gens.reduce((m, x) => (x.known ? x.g : m), 0)
  }
}

// ── Structure: linchpins, founders, islands ────────────────────────────────

/**
 * Bridge people (articulation points): removing one splits the network.
 * `cut` = how many people would be cut off from the largest remaining piece.
 * Iterative Tarjan, O(V+E).
 */
export function linchpins(index: KinIndex): { id: string; cut: number }[] {
  const disc = new Map<string, number>()
  const low = new Map<string, number>()
  const size = new Map<string, number>()
  const out: { id: string; cut: number }[] = []
  let time = 0
  for (const root of index.ids) {
    if (disc.has(root) || !index.adj.has(root)) continue
    // First pass: component size.
    const comp: string[] = []
    const seen = new Set([root])
    for (let i = 0, q = [root]; i < q.length; i++) {
      comp.push(q[i])
      for (const o of index.adj.get(q[i]) || []) {
        if (seen.has(o)) continue
        seen.add(o)
        q.push(o)
      }
    }
    const total = comp.length
    const parts = new Map<string, number[]>() // v → separated child-subtree sizes
    const stack: { v: string; parent: string | null; it: Iterator<string> }[] = []
    disc.set(root, time)
    low.set(root, time++)
    size.set(root, 1)
    stack.push({ v: root, parent: null, it: (index.adj.get(root) || new Set()).values() })
    while (stack.length) {
      const top = stack[stack.length - 1]
      const n = top.it.next()
      if (!n.done) {
        const w = n.value
        if (w === top.parent) continue
        if (disc.has(w)) {
          low.set(top.v, Math.min(low.get(top.v)!, disc.get(w)!))
        } else {
          disc.set(w, time)
          low.set(w, time++)
          size.set(w, 1)
          stack.push({ v: w, parent: top.v, it: (index.adj.get(w) || new Set()).values() })
        }
        continue
      }
      stack.pop()
      const p = top.parent
      if (p == null) continue
      low.set(p, Math.min(low.get(p)!, low.get(top.v)!))
      size.set(p, size.get(p)! + size.get(top.v)!)
      if (low.get(top.v)! >= disc.get(p)!) pushMap(parts, p, size.get(top.v)!)
    }
    for (const [v, ps] of parts) {
      const sum = ps.reduce((a, b) => a + b, 0)
      const rest = total - 1 - sum
      const pieces = rest > 0 ? [...ps, rest] : ps
      if (pieces.length < 2) continue
      out.push({ id: v, cut: total - 1 - Math.max(...pieces) })
    }
  }
  return out.filter((x) => x.cut > 0).sort((a, b) => b.cut - a.cut)
}

/** Connected groups of people (any edge type), largest first. */
export function islands(index: KinIndex): string[][] {
  const seen = new Set<string>()
  const out: string[][] = []
  for (const id of index.ids) {
    if (seen.has(id)) continue
    const comp: string[] = []
    seen.add(id)
    for (let i = 0, q = [id]; i < q.length; i++) {
      comp.push(q[i])
      for (const o of index.adj.get(q[i]) || []) {
        if (seen.has(o)) continue
        seen.add(o)
        q.push(o)
      }
    }
    out.push(comp)
  }
  return out.sort((a, b) => b.length - a.length)
}

/** Dynasty founders: people with no recorded parents, ranked by how many
 *  descendants they have (and how many generations those span). */
export function founders(index: KinIndex, limit = 5) {
  const res: { id: string; descendants: number; generations: number }[] = []
  for (const id of index.ids) {
    if ((index.parents.get(id) || []).length) continue
    const seen = new Set<string>()
    let frontier = [id]
    let gen = 0
    while (frontier.length) {
      const next: string[] = []
      for (const f of frontier) {
        for (const c of index.children.get(f) || []) {
          if (seen.has(c.id)) continue
          seen.add(c.id)
          next.push(c.id)
        }
      }
      if (next.length) gen++
      frontier = next
    }
    if (seen.size) res.push({ id, descendants: seen.size, generations: gen })
  }
  return res
    .sort((a, b) => b.descendants - a.descendants || b.generations - a.generations)
    .slice(0, limit)
}

/** Couples (horizontal edges) who are also blood relatives, closest first. */
export function tangledCouples(index: KinIndex) {
  const coef = makeKinshipCoefficient(index)
  const seen = new Set<string>()
  const res: { a: string; b: string; phi: number }[] = []
  for (const [a, list] of index.spouses) {
    for (const s of list) {
      const key = [a, s.id].sort().join('~')
      if (seen.has(key)) continue
      seen.add(key)
      const p = coef.phi(a, s.id)
      if (p > 0) res.push({ a, b: s.id, phi: p })
    }
  }
  return res.sort((x, y) => y.phi - x.phi)
}

/** Everyone's inbreeding coefficient F > 0, highest first. */
export function inbredPeople(index: KinIndex, limit = 5) {
  const coef = makeKinshipCoefficient(index)
  const res: { id: string; F: number }[] = []
  for (const id of index.ids) {
    const f = coef.F(id)
    if (f > 0) res.push({ id, F: f })
  }
  return res.sort((a, b) => b.F - a.F).slice(0, limit)
}
