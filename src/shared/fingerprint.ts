// The family fingerprint (WILD_IDEAS D4): a compact, JSON-safe summary of a
// project's STRUCTURE — generations, families and their branching, couples,
// founders, islands, time span, gender balance, tag colours — that the
// renderer turns into a deterministic mandala (lib/familyFingerprint.ts).
//
// Pure and platform-free (shared by dbCore's `projects:fingerprints`, the
// Supabase backend and the store's live fingerprint of the active project).
// Everything is O(n + e): one pass over people, one over relationships, a
// union-find for components and two Kahn passes for generations. Hierarchy
// edges come from each type's symmetryRole (never type literals), with the
// legacy trio as the fallback when no registry is supplied.

import type { DB, SymmetryRole } from './types'

export const FINGERPRINT_VERSION = 1

/** Children-per-family histogram buckets: index k = families with k children;
 *  the last bucket collects BRANCH_CAP or more. */
export const BRANCH_CAP = 12
/** Generations beyond this are folded into the last one (keeps JSON small). */
export const GEN_CAP = 48

export interface FingerprintFeatures {
  v: number
  /** Stable 32-bit seed from the project id (FNV-1a). */
  seed: number
  people: number
  /** Valid relationships (both ends exist, not self-links), deduplicated per pair+role. */
  bonds: number
  /** People per generation, founders' generation first. */
  generations: number[]
  /** Families (distinct parent sets with ≥1 child) rooted in each generation. */
  genFamilies: number[]
  /** Children of those families, per generation (genChildren[g] / genFamilies[g] = mean branching). */
  genChildren: number[]
  families: number
  /** branching[k] = families with k children (k ≥ 1; last bucket = BRANCH_CAP+). */
  branching: number[]
  branchMean: number
  /** Coefficient of variation of children per family (0 = all equal). */
  branchSpread: number
  couples: number
  /** People with two or more distinct partners. */
  remarried: number
  /** Parentless people with children whose partners are parentless too. */
  founders: number
  /** Founders grouped into couples — the number of founding lines. */
  founderLines: number
  /** Social (non-hierarchy, non-couple) bonds: friends, rivals, mentors… */
  social: number
  components: number
  largest: number
  /** Sizes of the other connected groups with ≥ 2 people (largest first, top 8). */
  islands: number[]
  /** People with no bonds at all. */
  loners: number
  /** Earliest and latest dated year (births and deaths), or null. */
  span: { from: number; to: number } | null
  /** People with a birth year. */
  dated: number
  /** People with a known gender position and their mean gender_t (0 = male end, 1 = female end). */
  gender: { known: number; mean: number }
  tagCount: number
  /** Colours of the most-populated tags (up to 5), '#rrggbb'. */
  tagColors: string[]
  /** True when built from counts only (no structure available). */
  partial?: boolean
}

export interface FingerprintPerson {
  id: string
  birth?: { year?: number | null } | null
  death?: { year?: number | null } | null
  gender_t?: number | null
}
export interface FingerprintRelationship {
  person_a_id: string
  person_b_id: string
  type: string
}
export interface FingerprintTag {
  id: string
  color?: string | null
}
export interface FingerprintEntityTag {
  entity_id: string
  tag_id: string
}

export interface FingerprintInput {
  projectId: string
  persons: readonly FingerprintPerson[]
  relationships: readonly FingerprintRelationship[]
  /** rel.type → symmetryRole (a Map or a plain record). */
  typeRoles?: ReadonlyMap<string, SymmetryRole> | Record<string, SymmetryRole> | null
  tags?: readonly FingerprintTag[]
  entityTags?: readonly FingerprintEntityTag[]
}

/** FNV-1a — the same string always gives the same seed. */
export function fingerprintSeed(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const legacyRoleOf = (type: string): SymmetryRole =>
  type === 'parent_child' || type === 'adopted'
    ? 'vertical'
    : type === 'spouse'
      ? 'horizontal'
      : 'none'

const round3 = (x: number): number => Math.round(x * 1000) / 1000

function normHex(c: unknown): string | null {
  if (typeof c !== 'string') return null
  const s = c.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(s)) return s
  if (/^#[0-9a-f]{3}$/.test(s)) return '#' + [...s.slice(1)].map((ch) => ch + ch).join('')
  return null
}

function yearOf(d: { year?: number | null } | null | undefined): number | null {
  const y = d?.year
  return typeof y === 'number' && Number.isFinite(y) ? y : null
}

/** An empty-but-valid fingerprint (a brand-new project). */
export function emptyFeatures(projectId: string): FingerprintFeatures {
  return {
    v: FINGERPRINT_VERSION,
    seed: fingerprintSeed(projectId || ''),
    people: 0,
    bonds: 0,
    generations: [],
    genFamilies: [],
    genChildren: [],
    families: 0,
    branching: new Array(BRANCH_CAP + 1).fill(0),
    branchMean: 0,
    branchSpread: 0,
    couples: 0,
    remarried: 0,
    founders: 0,
    founderLines: 0,
    social: 0,
    components: 0,
    largest: 0,
    islands: [],
    loners: 0,
    span: null,
    dated: 0,
    gender: { known: 0, mean: 0.5 },
    tagCount: 0,
    tagColors: []
  }
}

/** A degraded fingerprint from headline counts alone (backends that cannot
 *  afford the full structure). Draws a plausible, still-deterministic crest. */
export function countsOnlyFeatures(
  projectId: string,
  counts: { persons?: number; relationships?: number }
): FingerprintFeatures {
  const f = emptyFeatures(projectId)
  const n = Math.max(0, Math.floor(counts.persons || 0))
  const e = Math.max(0, Math.floor(counts.relationships || 0))
  f.people = n
  f.bonds = e
  f.partial = true
  if (n) {
    // A rough family shape: ~3 people per generation band, widening outwards.
    const g = Math.max(1, Math.min(8, Math.round(Math.log2(n + 1))))
    let left = n
    for (let i = 0; i < g; i++) {
      const share =
        i === g - 1 ? left : Math.max(1, Math.round((n * (i + 1)) / ((g * (g + 1)) / 2)))
      const take = Math.min(left, share)
      f.generations.push(take)
      left -= take
    }
    f.components = 1
    f.largest = n
  }
  return f
}

/** Union-find with path halving + union by size. */
function makeDSU(n: number) {
  const parent = new Int32Array(n)
  const size = new Int32Array(n).fill(1)
  for (let i = 0; i < n; i++) parent[i] = i
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }
  const union = (a: number, b: number): void => {
    let ra = find(a)
    let rb = find(b)
    if (ra === rb) return
    if (size[ra] < size[rb]) [ra, rb] = [rb, ra]
    parent[rb] = ra
    size[ra] += size[rb]
  }
  return { find, union, size }
}

export function computeFingerprintFeatures(input: FingerprintInput): FingerprintFeatures {
  const f = emptyFeatures(input.projectId)
  const persons = Array.isArray(input.persons) ? input.persons : []
  const idx = new Map<string, number>()
  for (const p of persons) {
    if (p && typeof p.id === 'string' && !idx.has(p.id)) idx.set(p.id, idx.size)
  }
  const n = idx.size
  f.people = n
  if (!n) return f
  const people: FingerprintPerson[] = new Array(n)
  for (const p of persons) {
    const i = idx.get(p?.id)
    if (i !== undefined && !people[i]) people[i] = p
  }

  const rolesIn = input.typeRoles
  const roleOf: (t: string) => SymmetryRole = !rolesIn
    ? legacyRoleOf
    : rolesIn instanceof Map
      ? (t) => (rolesIn as ReadonlyMap<string, SymmetryRole>).get(t) ?? legacyRoleOf(t)
      : (t) => (rolesIn as Record<string, SymmetryRole>)[t] ?? legacyRoleOf(t)

  // ── edges ─────────────────────────────────────────────────────────────────
  const parents: number[][] = Array.from({ length: n }, () => [])
  const children: number[][] = Array.from({ length: n }, () => [])
  const partners: number[][] = Array.from({ length: n }, () => [])
  const seen = new Set<string>()
  const dsu = makeDSU(n)
  const touched = new Uint8Array(n)
  for (const r of Array.isArray(input.relationships) ? input.relationships : []) {
    if (!r) continue
    const a = idx.get(r.person_a_id)
    const b = idx.get(r.person_b_id)
    if (a === undefined || b === undefined || a === b) continue
    const role = roleOf(String(r.type ?? ''))
    const key = role === 'vertical' ? `v${a}>${b}` : `${role[0]}${Math.min(a, b)}-${Math.max(a, b)}`
    if (seen.has(key)) continue
    seen.add(key)
    f.bonds++
    touched[a] = 1
    touched[b] = 1
    dsu.union(a, b)
    if (role === 'vertical') {
      // A reversed duplicate (b→a after a→b) would be a 2-cycle; Kahn copes.
      parents[b].push(a)
      children[a].push(b)
    } else if (role === 'horizontal') {
      partners[a].push(b)
      partners[b].push(a)
      f.couples++
    } else {
      f.social++
    }
  }

  // ── generations: longest-path layering (Kahn), married-in roots aligned ──
  const depth = new Int32Array(n)
  const layer = (start: Int32Array): void => {
    const indeg = new Int32Array(n)
    for (let i = 0; i < n; i++) indeg[i] = parents[i].length
    const queue: number[] = []
    for (let i = 0; i < n; i++) {
      depth[i] = start[i]
      if (!indeg[i]) queue.push(i)
    }
    for (let qi = 0; qi < queue.length; qi++) {
      const u = queue[qi]
      for (const c of children[u]) {
        if (depth[c] < depth[u] + 1) depth[c] = depth[u] + 1
        if (--indeg[c] === 0) queue.push(c)
      }
    }
    // Nodes caught in a cycle never reach indegree 0: they keep the deepest
    // value propagated to them (finite — every node is relaxed at most once
    // per incoming edge from a processed node).
  }
  layer(new Int32Array(n))
  // A parentless spouse (married in) sits on their partner's generation.
  const start = new Int32Array(n)
  let bumped = false
  for (let i = 0; i < n; i++) {
    if (parents[i].length) continue
    let d = 0
    for (const q of partners[i]) if (depth[q] > d && parents[q].length) d = depth[q]
    if (d > 0) {
      start[i] = d
      bumped = true
    }
  }
  if (bumped) layer(start)
  let maxDepth = 0
  for (let i = 0; i < n; i++) {
    if (depth[i] >= GEN_CAP) depth[i] = GEN_CAP - 1
    if (depth[i] > maxDepth) maxDepth = depth[i]
  }
  // Collapse empty layers (possible after the spouse bump / caps) so the
  // ring count is the number of populated generations.
  const pop = new Int32Array(maxDepth + 1)
  for (let i = 0; i < n; i++) pop[depth[i]]++
  const remap = new Int32Array(maxDepth + 1)
  let g = 0
  for (let d = 0; d <= maxDepth; d++) {
    remap[d] = g
    if (pop[d]) g++
  }
  const gens = g
  f.generations = new Array(gens).fill(0)
  f.genFamilies = new Array(gens).fill(0)
  f.genChildren = new Array(gens).fill(0)
  for (let i = 0; i < n; i++) {
    depth[i] = remap[depth[i]]
    f.generations[depth[i]]++
  }

  // ── families: distinct parent sets with their children ────────────────────
  const fam = new Map<string, { kids: number; gen: number }>()
  for (let i = 0; i < n; i++) {
    const ps = parents[i]
    if (!ps.length) continue
    const key = ps.length === 1 ? String(ps[0]) : [...ps].sort((x, y) => x - y).join(',')
    let rec = fam.get(key)
    if (!rec) {
      let gen = 0
      for (const p of ps) if (depth[p] > gen) gen = depth[p]
      rec = { kids: 0, gen }
      fam.set(key, rec)
    }
    rec.kids++
  }
  let sum = 0
  let sum2 = 0
  for (const { kids, gen } of fam.values()) {
    f.families++
    f.branching[Math.min(BRANCH_CAP, kids)]++
    f.genFamilies[gen]++
    f.genChildren[gen] += kids
    sum += kids
    sum2 += kids * kids
  }
  if (f.families) {
    const mean = sum / f.families
    const variance = Math.max(0, sum2 / f.families - mean * mean)
    f.branchMean = round3(mean)
    f.branchSpread = round3(mean ? Math.sqrt(variance) / mean : 0)
  }

  // ── couples, founders ─────────────────────────────────────────────────────
  for (let i = 0; i < n; i++) {
    if (partners[i].length >= 2 && new Set(partners[i]).size >= 2) f.remarried++
  }
  const isFounder = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    if (parents[i].length || !children[i].length) continue
    let marriedIn = false
    for (const q of partners[i]) if (parents[q].length) marriedIn = true
    if (!marriedIn) {
      isFounder[i] = 1
      f.founders++
    }
  }
  if (f.founders) {
    const lines = makeDSU(n)
    for (let i = 0; i < n; i++) {
      if (!isFounder[i]) continue
      for (const q of partners[i]) if (isFounder[q]) lines.union(i, q)
      // Founders who share a child are one line even without a couple bond.
      for (const c of children[i]) {
        for (const p of parents[c]) if (p !== i && isFounder[p]) lines.union(i, p)
      }
    }
    const roots = new Set<number>()
    for (let i = 0; i < n; i++) if (isFounder[i]) roots.add(lines.find(i))
    f.founderLines = roots.size
  }

  // ── components ────────────────────────────────────────────────────────────
  const compSize = new Map<number, number>()
  for (let i = 0; i < n; i++) {
    if (!touched[i]) {
      f.loners++
      continue
    }
    const r = dsu.find(i)
    compSize.set(r, (compSize.get(r) || 0) + 1)
  }
  const sizes = [...compSize.values()].sort((a, b) => b - a)
  f.components = sizes.length + f.loners
  f.largest = sizes[0] ?? (f.loners ? 1 : 0)
  f.islands = sizes.slice(1, 9)

  // ── time span, gender ─────────────────────────────────────────────────────
  let lo = Infinity
  let hi = -Infinity
  let gSum = 0
  for (const p of people) {
    const b = yearOf(p.birth)
    const d = yearOf(p.death)
    if (b !== null) {
      f.dated++
      if (b < lo) lo = b
      if (b > hi) hi = b
    }
    if (d !== null) {
      if (d < lo) lo = d
      if (d > hi) hi = d
    }
    const t = p.gender_t
    if (typeof t === 'number' && Number.isFinite(t)) {
      f.gender.known++
      gSum += Math.max(0, Math.min(1, t))
    }
  }
  if (lo !== Infinity) f.span = { from: Math.round(lo), to: Math.round(hi) }
  if (f.gender.known) f.gender.mean = round3(gSum / f.gender.known)

  // ── tags ──────────────────────────────────────────────────────────────────
  const tags = Array.isArray(input.tags) ? input.tags : []
  if (tags.length) {
    const members = new Map<string, number>()
    for (const t of tags) if (t && typeof t.id === 'string') members.set(t.id, 0)
    f.tagCount = members.size
    for (const et of Array.isArray(input.entityTags) ? input.entityTags : []) {
      if (!et || !idx.has(et.entity_id)) continue
      const c = members.get(et.tag_id)
      if (c !== undefined) members.set(et.tag_id, c + 1)
    }
    const order = new Map(tags.map((t, i) => [t?.id, i]))
    const ranked = tags
      .filter((t) => t && members.has(t.id) && normHex(t.color))
      .sort(
        (a, b) =>
          (members.get(b.id) || 0) - (members.get(a.id) || 0) ||
          (order.get(a.id) || 0) - (order.get(b.id) || 0)
      )
    const colors: string[] = []
    for (const t of ranked) {
      const c = normHex(t.color) as string
      if (!colors.includes(c)) colors.push(c)
      if (colors.length >= 5) break
    }
    f.tagColors = colors
  }
  return f
}

/** Fingerprints for several projects straight from a DB object, bucketing
 *  every table once (O(total rows)). Used by dbCore's `projects:fingerprints`. */
export function fingerprintsFromDb(
  db: DB,
  projectIds: readonly string[]
): Record<string, FingerprintFeatures> {
  const want = new Set(projectIds)
  type Bucket = {
    persons: FingerprintPerson[]
    relationships: FingerprintRelationship[]
    roles: Map<string, SymmetryRole>
    tags: FingerprintTag[]
    entityTags: FingerprintEntityTag[]
  }
  const buckets = new Map<string, Bucket>()
  for (const id of want) {
    buckets.set(id, { persons: [], relationships: [], roles: new Map(), tags: [], entityTags: [] })
  }
  for (const p of Object.values(db.persons || {})) buckets.get(p.project_id)?.persons.push(p)
  for (const r of Object.values(db.relationships || {}))
    buckets.get(r.project_id)?.relationships.push(r)
  for (const d of Object.values(db.rel_type_defs || {}))
    buckets.get(d.project_id)?.roles.set(d.key, d.symmetryRole)
  const tagProject = new Map<string, string>()
  for (const t of Object.values(db.tags || {})) {
    const b = buckets.get(t.project_id)
    if (!b) continue
    b.tags.push(t)
    tagProject.set(t.id, t.project_id)
  }
  for (const et of Object.values(db.entity_tags || {})) {
    const pid = tagProject.get(et.tag_id)
    if (pid) buckets.get(pid)?.entityTags.push(et)
  }
  const out: Record<string, FingerprintFeatures> = {}
  for (const [id, b] of buckets) {
    out[id] = computeFingerprintFeatures({
      projectId: id,
      persons: b.persons,
      relationships: b.relationships,
      typeRoles: b.roles.size ? b.roles : null,
      tags: b.tags,
      entityTags: b.entityTags
    })
  }
  return out
}
