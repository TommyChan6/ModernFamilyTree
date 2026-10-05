// Pure logic behind the Browse page — no Vue, DOM or store. Covers the access
// ladder, the relationship DSL used by browseData, a small generations layout
// for tree previews, search / filter / sort, recommendations, fun facts and
// the project file a graft imports. Tests: tests/browseModel.test.js.

import type { ShareAccess } from '../../../../shared/types'
import type { BrowseProfile, BrowseProject, Genre, Lang, PersonRow } from './browseData'

// ── Access ladder ────────────────────────────────────────────────────────────
export type Capability = 'view' | 'export' | 'fork' | 'edit'
export const CAPABILITIES: Capability[] = ['view', 'export', 'fork', 'edit']
export const ACCESS_MODES: ShareAccess[] = ['glasshouse', 'seedbank', 'graft', 'grove']
export const ACCESS_ICONS: Record<ShareAccess, string> = {
  glasshouse: '🔭',
  seedbank: '🌰',
  graft: '🌿',
  grove: '🤝'
}

/** The ladder is cumulative: each mode grants everything below it. */
export function can(mode: ShareAccess | null | undefined, cap: Capability): boolean {
  const level = ACCESS_MODES.indexOf(mode || 'glasshouse')
  return level >= CAPABILITIES.indexOf(cap)
}

// ── Relationship DSL ─────────────────────────────────────────────────────────
export interface ParsedRel {
  a: string
  b: string
  type: string
  formed: number | null
  ended: number | null
  label: string
}

const OPS: Record<string, string> = {
  '>': 'parent_child',
  '>>': 'adopted',
  '=': 'spouse',
  '~': 'partner',
  '&': 'sibling',
  '+': 'friends',
  '!': 'rival',
  '^': 'mentor',
  '*': 'likes',
  _: 'subordinate'
}

/** Parse one DSL line (see browseData.ts) into one row per (a, b) pair. */
export function parseRel(line: string): ParsedRel[] {
  const cut = line.indexOf(' : ')
  const label = cut === -1 ? '' : line.slice(cut + 3).trim()
  const tokens = (cut === -1 ? line : line.slice(0, cut)).trim().split(/\s+/)
  const [left, op, right, ...mods] = tokens
  const type = OPS[op]
  if (!left || !right || !type) throw new Error(`Bad relationship line: ${line}`)
  let formed: number | null = null
  let ended: number | null = null
  for (const m of mods) {
    if (m.startsWith('@')) formed = Number(m.slice(1))
    else if (m.startsWith('|')) ended = Number(m.slice(1))
  }
  const out: ParsedRel[] = []
  for (const a of left.split(',')) {
    for (const b of right.split(',')) out.push({ a, b, type, formed, ended, label })
  }
  return out
}

const relCache = new WeakMap<BrowseProject, ParsedRel[]>()
export function relsOf(project: BrowseProject): ParsedRel[] {
  let rels = relCache.get(project)
  if (!rels) {
    rels = project.rels.flatMap(parseRel)
    relCache.set(project, rels)
  }
  return rels
}

const VERTICAL = new Set(['parent_child', 'adopted'])
const HORIZONTAL = new Set(['spouse', 'partner'])

// ── Tree layout (generations) ───────────────────────────────────────────────
export interface TreeNode {
  id: string
  name: string
  gender: 'm' | 'f' | ''
  role: string
  gen: number
  x: number
  y: number
}
export interface TreeLink {
  a: string
  b: string
  kind: 'parent' | 'spouse' | 'other'
  type: string
  label: string
}
export interface TreeLayout {
  nodes: TreeNode[]
  links: TreeLink[]
  /** Extent in layout units (1 unit = the gap between neighbours). */
  width: number
  generations: number
}

/**
 * A compact generations layout for previews: parents above children,
 * married-in spouses beside their partner, each row ordered by the mean
 * position of the parents above it. Deliberately simple — the real graph
 * view has the full engine; this only needs to read well at a glance.
 */
export function layoutTree(people: PersonRow[], rels: ParsedRel[]): TreeLayout {
  const ids = people.map((p) => p[0])
  const known = new Set(ids)
  const parents = new Map<string, string[]>()
  const children = new Map<string, string[]>()
  const spouses = new Map<string, string[]>()
  const push = (m: Map<string, string[]>, k: string, v: string) => {
    const list = m.get(k)
    if (list) {
      if (!list.includes(v)) list.push(v)
    } else m.set(k, [v])
  }
  for (const r of rels) {
    if (!known.has(r.a) || !known.has(r.b) || r.a === r.b) continue
    if (VERTICAL.has(r.type)) {
      push(parents, r.b, r.a)
      push(children, r.a, r.b)
    } else if (HORIZONTAL.has(r.type)) {
      push(spouses, r.a, r.b)
      push(spouses, r.b, r.a)
    }
  }
  const isRoot = (id: string) => !parents.has(id)
  // A spouse may be pulled down to their partner's row when nothing above
  // them would be contradicted: they are a root, or all their parents are.
  const movable = (id: string) => isRoot(id) || (parents.get(id) || []).every(isRoot)

  const gen = new Map(ids.map((id) => [id, 0]))
  const cap = ids.length
  for (let iter = 0; iter < 80; iter++) {
    let changed = false
    const raise = (id: string, g: number) => {
      if (g > (gen.get(id) as number) && g <= cap) {
        gen.set(id, g)
        changed = true
      }
    }
    for (const [child, ps] of parents) {
      raise(child, Math.max(...ps.map((p) => gen.get(p) as number)) + 1)
    }
    for (const [id, ss] of spouses) {
      for (const s of ss) {
        const g = gen.get(s) as number
        if (g > (gen.get(id) as number) && movable(id)) raise(id, g)
      }
    }
    for (const id of ids) {
      const kids = children.get(id)
      if (!kids || !isRoot(id)) continue
      raise(id, Math.min(...kids.map((k) => gen.get(k) as number)) - 1)
    }
    if (!changed) break
  }

  // Depth-first family order: a person, their spouses, then their children.
  const dfs = new Map<string, number>()
  const visit = (id: string) => {
    if (dfs.has(id)) return
    dfs.set(id, dfs.size)
    const partners = spouses.get(id) || []
    for (const s of partners) if (!dfs.has(s) && gen.get(s) === gen.get(id)) dfs.set(s, dfs.size)
    for (const c of children.get(id) || []) visit(c)
    for (const s of partners) for (const c of children.get(s) || []) visit(c)
  }
  for (const id of ids) if (isRoot(id)) visit(id)
  for (const id of ids) visit(id)

  const maxGen = Math.max(0, ...gen.values())
  const x = new Map<string, number>()
  for (let g = 0; g <= maxGen; g++) {
    const row = ids.filter((id) => gen.get(id) === g).sort((a, b) => dfs.get(a)! - dfs.get(b)!)
    if (!row.length) continue
    const desired = new Map<string, number>()
    const tie = new Map<string, number>()
    let last = -1
    for (const id of row) {
      const placed = (parents.get(id) || []).filter((p) => x.has(p))
      let d: number | null = null
      if (placed.length) d = placed.reduce((s, p) => s + (x.get(p) as number), 0) / placed.length
      tie.set(id, dfs.get(id)!)
      if (d == null) {
        const partner = (spouses.get(id) || []).find(
          (s) => gen.get(s) === g && (parents.get(s) || []).some((p) => x.has(p))
        )
        if (partner) {
          const pp = (parents.get(partner) || []).filter((p) => x.has(p))
          d = pp.reduce((s, p) => s + (x.get(p) as number), 0) / pp.length
          tie.set(id, dfs.get(partner)! + 0.5)
        }
      }
      if (d == null) d = last + 1
      desired.set(id, d)
      last = d
    }
    row.sort((a, b) => desired.get(a)! - desired.get(b)! || tie.get(a)! - tie.get(b)!)
    const xs: number[] = []
    row.forEach((id, i) =>
      xs.push(i === 0 ? desired.get(id)! : Math.max(desired.get(id)!, xs[i - 1] + 1))
    )
    // Keep the row centred on where it wanted to be.
    const shift =
      row.reduce((s, id) => s + desired.get(id)!, 0) / row.length -
      xs.reduce((s, v) => s + v, 0) / row.length
    row.forEach((id, i) => x.set(id, xs[i] + shift))
  }
  const minX = Math.min(...x.values())
  const byId = new Map(people.map((p) => [p[0], p]))
  const nodes: TreeNode[] = ids.map((id) => {
    const p = byId.get(id) as PersonRow
    return {
      id,
      name: p[1],
      gender: p[2],
      role: p[5] || '',
      gen: gen.get(id) as number,
      x: (x.get(id) as number) - minX,
      y: gen.get(id) as number
    }
  })
  const links: TreeLink[] = rels
    .filter((r) => known.has(r.a) && known.has(r.b) && r.a !== r.b)
    .map((r) => ({
      a: r.a,
      b: r.b,
      type: r.type,
      label: r.label,
      kind: VERTICAL.has(r.type) ? 'parent' : HORIZONTAL.has(r.type) ? 'spouse' : 'other'
    }))
  return {
    nodes,
    links,
    width: Math.max(0, ...nodes.map((n) => n.x)),
    generations: maxGen + 1
  }
}

const layoutCache = new WeakMap<BrowseProject, TreeLayout>()
export function treeOf(project: BrowseProject): TreeLayout {
  let t = layoutCache.get(project)
  if (!t) {
    t = layoutTree(project.people, relsOf(project))
    layoutCache.set(project, t)
  }
  return t
}

// ── Search ───────────────────────────────────────────────────────────────────
/** Lower-case, width-fold and strip Latin diacritics ("Ōtsutsuki" → "otsutsuki"). */
export function fold(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export interface SearchHit {
  project: BrowseProject
  score: number
  /** Names of people inside the project that matched the query. */
  people: string[]
}

export function searchProjects(
  projects: BrowseProject[],
  profiles: BrowseProfile[],
  query: string
): SearchHit[] {
  const terms = fold(query).split(/\s+/).filter(Boolean)
  if (!terms.length) return projects.map((project) => ({ project, score: 0, people: [] }))
  const byId = new Map(profiles.map((p) => [p.id, p]))
  const hits: SearchHit[] = []
  for (const project of projects) {
    const author = byId.get(project.authorId)
    const authorText = fold(`${author?.username || ''} ${author?.displayName || ''}`)
    const title = fold(project.title)
    const tags = project.tags.map(fold)
    let score = 0
    const people = new Set<string>()
    let ok = true
    for (const term of terms) {
      if (term.startsWith('@')) {
        const handle = term.slice(1)
        if (handle && !authorText.includes(handle)) ok = false
        else score += 3
        continue
      }
      let s = 0
      if (title.startsWith(term)) s += 8
      else if (title.includes(term)) s += 5
      if (tags.some((t) => t === term)) s += 4
      else if (tags.some((t) => t.includes(term))) s += 2.5
      if (authorText.includes(term)) s += 2
      for (const p of project.people) {
        if (fold(p[1]).includes(term)) {
          s += people.size < 6 ? 2 : 0.2
          people.add(p[1])
        } else if (p[5] && fold(p[5]).includes(term)) s += 0.8
      }
      if (fold(project.blurb).includes(term)) s += 1
      if (fold(project.era).includes(term)) s += 0.5
      if (s === 0) ok = false
      score += s
    }
    if (ok) hits.push({ project, score, people: [...people].slice(0, 4) })
  }
  return hits.sort((a, b) => b.score - a.score)
}

// ── Filters & sorting ────────────────────────────────────────────────────────
export type SizeBucket = 'any' | 'cozy' | 'clan' | 'dynasty'
export interface BrowseFilters {
  genre: Genre | 'all'
  access: ShareAccess[] // empty = any
  size: SizeBucket
  lang: Lang | 'any'
}
export const EMPTY_FILTERS: BrowseFilters = { genre: 'all', access: [], size: 'any', lang: 'any' }

export function sizeOf(project: BrowseProject): Exclude<SizeBucket, 'any'> {
  const n = project.people.length
  return n <= 15 ? 'cozy' : n <= 21 ? 'clan' : 'dynasty'
}

export function matchesFilters(project: BrowseProject, f: BrowseFilters): boolean {
  if (f.genre !== 'all' && project.genre !== f.genre) return false
  if (f.access.length && !f.access.includes(project.access)) return false
  if (f.size !== 'any' && sizeOf(project) !== f.size) return false
  if (f.lang !== 'any' && project.lang !== f.lang) return false
  return true
}

export function isFiltering(f: BrowseFilters, query: string): boolean {
  return (
    !!query.trim() ||
    f.genre !== 'all' ||
    f.access.length > 0 ||
    f.size !== 'any' ||
    f.lang !== 'any'
  )
}

/** Popularity decayed by staleness — fresh activity beats old fame. */
export function trendScore(p: BrowseProject): number {
  return (p.likes + p.forks * 4 + p.views / 25) / Math.pow(p.updatedAgo + 2, 0.9)
}

/** Earliest real-world year in the tree. Fictional calendars (Westeros' AC,
 *  Dragon Ball's "Age 737") don't compete, so only historical genres count. */
export function earliestYear(p: BrowseProject): number | null {
  if (p.genre !== 'history' && p.genre !== 'dynasty') return null
  const years = p.people.map((r) => r[3]).filter((y): y is number => y != null)
  return years.length ? Math.min(...years) : null
}

export type SortKey = 'forYou' | 'trending' | 'loved' | 'fresh' | 'largest' | 'deepest' | 'ancient'
export const SORT_KEYS: SortKey[] = [
  'forYou',
  'trending',
  'loved',
  'fresh',
  'largest',
  'deepest',
  'ancient'
]

/** Sort (a copy). 'forYou' uses the given recommendation scores. */
export function sortProjects(
  list: BrowseProject[],
  key: SortKey,
  forYou?: Map<string, number>
): BrowseProject[] {
  const out = [...list]
  const by = (f: (p: BrowseProject) => number) => out.sort((a, b) => f(b) - f(a))
  switch (key) {
    case 'forYou':
      return by((p) => forYou?.get(p.id) ?? trendScore(p) / 1e6)
    case 'trending':
      return by(trendScore)
    case 'loved':
      return by((p) => p.likes)
    case 'fresh':
      return by((p) => -p.updatedAgo)
    case 'largest':
      return by((p) => p.people.length)
    case 'deepest':
      return by((p) => treeOf(p).generations * 1000 + p.people.length)
    case 'ancient':
      return by((p) => -(earliestYear(p) ?? 1e9))
  }
}

// ── Recommendations ──────────────────────────────────────────────────────────
export interface Signals {
  liked: string[]
  saved: string[]
  viewed: string[] // most recent first
  followed: string[]
  grafted: string[]
  locale: string
  /** The viewer's own project names + descriptions, for "matches your X". */
  ownText?: string
}

export type Reason =
  | { kind: 'because'; ref: string }
  | { kind: 'creator'; ref: string }
  | { kind: 'yours'; ref: string }
  | { kind: 'lang' }
  | { kind: 'trending' }

export interface Recommendation {
  project: BrowseProject
  score: number
  reason: Reason
}

/** 0..1 — same genre dominates, shared tags and author add to it. */
export function similarity(a: BrowseProject, b: BrowseProject): number {
  if (a.id === b.id) return 1
  const ta = new Set(a.tags.map(fold))
  const tb = new Set(b.tags.map(fold))
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  const union = ta.size + tb.size - inter
  const jaccard = union ? inter / union : 0
  return (
    (a.genre === b.genre ? 0.55 : 0) +
    Math.min(1, jaccard * 3) * 0.3 +
    (a.authorId === b.authorId ? 0.15 : 0)
  )
}

export function similarProjects(p: BrowseProject, all: BrowseProject[], n = 4): BrowseProject[] {
  return all
    .filter((o) => o.id !== p.id)
    .map((o) => ({ o, s: similarity(p, o) + trendScore(o) / 1e5 }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.o)
}

// English is the community's default, so matching it is only a nudge (and
// never the headline reason); other languages get a real lift.
function langAffinity(locale: string, lang: Lang): number {
  if (locale === 'en') return lang === 'en' ? 0.15 : 0
  if (locale === lang) return 0.8
  if (locale.startsWith('zh') && lang.startsWith('zh')) return 0.6
  return 0
}

/**
 * Rank projects for the viewer. Cold start (no signals) falls back to
 * trending + language; every pick carries the strongest reason behind it.
 * Projects the viewer already liked or grafted are left out.
 */
export function recommend(
  projects: BrowseProject[],
  signals: Signals,
  limit = 8
): Recommendation[] {
  const byId = new Map(projects.map((p) => [p.id, p]))
  const seeds: Array<[BrowseProject, number]> = []
  const addSeeds = (ids: string[], w: number) => {
    for (const id of ids) {
      const p = byId.get(id)
      if (p) seeds.push([p, w])
    }
  }
  addSeeds(signals.liked, 3)
  addSeeds(signals.grafted, 3)
  addSeeds(signals.saved, 2)
  signals.viewed.slice(0, 5).forEach((id, i) => addSeeds([id], 1 - i * 0.15))
  const exclude = new Set([...signals.liked, ...signals.grafted])
  const maxTrend = Math.max(1, ...projects.map(trendScore))
  const own = fold(signals.ownText || '')
  const ownWords = new Set(own.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2))

  const out: Recommendation[] = []
  for (const p of projects) {
    if (exclude.has(p.id)) continue
    let seedScore = 0
    let bestSeed: BrowseProject | null = null
    let bestSeedPart = 0
    for (const [seed, w] of seeds) {
      if (seed.id === p.id) continue
      const part = similarity(seed, p) * w
      seedScore += part
      if (part > bestSeedPart) {
        bestSeedPart = part
        bestSeed = seed
      }
    }
    const creator = signals.followed.includes(p.authorId) ? 1.2 : 0
    const lang = langAffinity(signals.locale, p.lang)
    // Whole-word hits only for Latin text; CJK has no spaces, so any tag
    // appearing inside the viewer's project text counts.
    const yoursTag = own
      ? p.tags.find((t) => {
          const f = fold(t)
          return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(f)
            ? f.length >= 2 && own.includes(f)
            : ownWords.has(f)
        })
      : undefined
    const yours = yoursTag ? 0.8 : 0
    const pop = (trendScore(p) / maxTrend) * 0.35
    const score = seedScore + creator + lang + yours + pop
    let reason: Reason = { kind: 'trending' }
    const parts: Array<[number, Reason]> = [
      [
        bestSeed && bestSeedPart >= 0.4 ? bestSeedPart : 0,
        { kind: 'because', ref: bestSeed?.id || '' }
      ],
      [creator, { kind: 'creator', ref: p.authorId }],
      [yours, { kind: 'yours', ref: yoursTag || '' }],
      [lang >= 0.6 ? lang * 0.7 : 0, { kind: 'lang' }]
    ]
    let best = 0
    for (const [v, r] of parts) {
      if (v > best) {
        best = v
        reason = r
      }
    }
    out.push({ project: p, score, reason })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit)
}

// ── Fun facts ────────────────────────────────────────────────────────────────
export interface FunFact {
  key: 'longest' | 'children' | 'married' | 'connected' | 'rivals' | 'span' | 'gens'
  icon: string
  n: number
  name?: string
}

export function funFacts(project: BrowseProject): FunFact[] {
  const rels = relsOf(project)
  const names = new Map(project.people.map((p) => [p[0], p[1]]))
  const facts: FunFact[] = []
  const top = (counts: Map<string, number>): [string, number] | null => {
    let best: [string, number] | null = null
    for (const [id, n] of counts) if (!best || n > best[1]) best = [id, n]
    return best
  }
  const tally = (pred: (r: ParsedRel) => boolean, both: boolean) => {
    const m = new Map<string, number>()
    for (const r of rels) {
      if (!pred(r) || !names.has(r.a) || !names.has(r.b)) continue
      m.set(r.a, (m.get(r.a) || 0) + 1)
      if (both) m.set(r.b, (m.get(r.b) || 0) + 1)
    }
    return m
  }

  let longest: [string, number] | null = null
  for (const p of project.people) {
    if (p[3] == null || p[4] == null) continue
    const age = p[4] - p[3]
    if (!longest || age > longest[1]) longest = [p[1], age]
  }
  if (longest) facts.push({ key: 'longest', icon: '🕰️', n: longest[1], name: longest[0] })

  const kids = top(tally((r) => VERTICAL.has(r.type), false))
  if (kids && kids[1] >= 2)
    facts.push({ key: 'children', icon: '👶', n: kids[1], name: names.get(kids[0]) })

  const married = top(tally((r) => r.type === 'spouse', true))
  if (married && married[1] >= 2) {
    facts.push({ key: 'married', icon: '💍', n: married[1], name: names.get(married[0]) })
  }

  const degree = top(tally(() => true, true))
  if (degree) facts.push({ key: 'connected', icon: '🕸️', n: degree[1], name: names.get(degree[0]) })

  const rivals = rels.filter((r) => r.type === 'rival').length
  if (rivals) facts.push({ key: 'rivals', icon: '⚔️', n: rivals })

  const years = project.people.flatMap((p) => [p[3], p[4]]).filter((y): y is number => y != null)
  if (years.length >= 2) {
    const span = Math.max(...years) - Math.min(...years)
    if (span > 0) facts.push({ key: 'span', icon: '📜', n: span })
  }
  facts.push({ key: 'gens', icon: '🌳', n: treeOf(project).generations })
  return facts
}

// ── Project file (what "Download" saves and "Graft" imports) ────────────────
// Mirrors projects:export's shape (dbCore PROJECT_FILE_FORMAT/VERSION — kept
// literal here so the renderer bundle doesn't pull in the whole core; the
// test pins them to the core's constants). Only legacy person columns are
// written: projects:import gives the copy its default traits and adopts them.
const FILE_FORMAT = 'familytree-project'
const FILE_VERSION = 1
const GROUP_COLORS = ['#e8845c', '#6c8ef5', '#4caf72', '#b07cf5', '#f5a623', '#f06292']

const yearValue = (y: number | null) =>
  y == null ? null : { year: y, month: null, day: null, precision: 'year', calendar: 'gregorian' }

function statusFor(r: ParsedRel): string {
  if (r.type !== 'spouse') return 'active'
  const divorced = /divorc|annul|離|离/i.test(r.label)
  if (divorced) return 'divorced'
  return r.ended != null ? 'widowed' : 'active'
}

export function toProjectFile(
  project: BrowseProject,
  author: BrowseProfile | undefined,
  now: string
) {
  const pid = `browse-${project.id}`
  const id = (kind: string, key: string | number) => `${pid}:${kind}:${key}`
  const persons = project.people.map((p) => ({
    id: id('p', p[0]),
    project_id: pid,
    name: p[1],
    gender: p[2] === 'm' ? 'male' : p[2] === 'f' ? 'female' : 'unknown',
    birth: yearValue(p[3]),
    death: yearValue(p[4]),
    occupation: p[5] || '',
    bio: p[6] || '',
    location: '',
    created_at: now,
    updated_at: now
  }))
  const relationships = relsOf(project).map((r, i) => ({
    id: id('r', i),
    project_id: pid,
    person_a_id: id('p', r.a),
    person_b_id: id('p', r.b),
    type: r.type,
    status: statusFor(r),
    formed: yearValue(r.formed),
    ended: yearValue(r.ended),
    label: r.label || null,
    created_at: now
  }))
  const tags: unknown[] = []
  const entity_tags: unknown[] = []
  Object.entries(project.groups || {}).forEach(([label, members], gi) => {
    const tagId = id('t', gi)
    tags.push({
      id: tagId,
      project_id: pid,
      label,
      type: 'group',
      source: 'manual',
      color: GROUP_COLORS[gi % GROUP_COLORS.length],
      icon: '',
      created_at: now,
      updated_at: now
    })
    for (const m of members) {
      entity_tags.push({
        id: id('et', `${gi}:${m}`),
        entity_id: id('p', m),
        tag_id: tagId,
        created_at: now
      })
    }
  })
  // Open on the generations layout — these are family trees first.
  const scenes = [
    {
      id: id('s', 'graph'),
      project_id: pid,
      view: 'graph',
      name: 'Family tree',
      type: 'generations',
      config: {},
      positions: {},
      layouts: {},
      created_at: now,
      updated_at: now
    }
  ]
  const credit = author ? ` — by @${author.username}` : ''
  return {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    exportedAt: now,
    project: {
      name: project.title.slice(0, 60),
      description: `${project.blurb}${credit}`.slice(0, 200),
      hue: project.hue
    },
    photosIncluded: false,
    source: { kind: 'browse', id: project.id, author: author?.username ?? null },
    rows: { persons, relationships, tags, entity_tags, scenes },
    settings: project.noun ? { noun: project.noun } : {}
  }
}
