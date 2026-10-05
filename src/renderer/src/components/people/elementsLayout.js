// Pure math for the Elements medium (the Directory's "periodic table of the
// family") — no Vue, DOM, or store. Symbols, generations, column grouping and
// cell placement all live here so they can be unit-tested
// (tests/elementsLayout.test.js).

// ── Tile geometry (px) — the single source of truth for view + culling ─────
export const TILE_W = 74
export const TILE_H = 84
export const GAP_X = 8
export const GAP_Y = 8
export const PAD = 18
export const COL_PITCH = TILE_W + GAP_X
export const ROW_PITCH = TILE_H + GAP_Y

// ── Chemical-style symbols ─────────────────────────────────────────────────
// Letters of a name with diacritics stripped (so "Émile" → "Emile"); any
// Unicode letter survives, so CJK names keep their characters.
function lettersOf(name) {
  const clean = String(name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
  return [...clean].filter((ch) => /\p{L}/u.test(ch))
}

const cased = (ch) => ch.toUpperCase() !== ch.toLowerCase()

/** Candidate symbols for one name, most "chemical" first:
 *  first + second letter (Jo), first + last-name initial (Js), first + each
 *  later letter in order, then three-letter "systematic" symbols from the
 *  name's own letters, then first + any a–z letter. Caseless scripts (CJK)
 *  get the single character first. Always non-empty. */
export function symbolCandidates(name) {
  const letters = lettersOf(name)
  if (!letters.length) return ['Xx', 'X']
  const head = letters[0]
  const out = []
  const push = (s) => {
    if (s && !out.includes(s)) out.push(s)
  }
  if (!cased(head)) {
    push(head)
    for (const ch of letters.slice(1)) push(head + ch)
    return out
  }
  const H = head.toUpperCase()
  const words = String(name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .split(/\s+/)
    .map((w) => [...w].filter((ch) => /\p{L}/u.test(ch)))
    .filter((w) => w.length)
  const low = (ch) => ch.toLowerCase()
  if (letters.length > 1) push(H + low(letters[1]))
  if (words.length > 1) push(H + low(words[words.length - 1][0]))
  const rest = letters.slice(1, 13).filter(cased).map(low)
  for (const ch of rest) push(H + ch)
  if (letters.length === 1) push(H)
  // Systematic-name style triples from the name's own letters (Jhn, Jsm, …)
  for (let i = 0; i < rest.length; i++)
    for (let j = i + 1; j < rest.length; j++) push(H + rest[i] + rest[j])
  for (let c = 97; c <= 122; c++) push(H + String.fromCharCode(c))
  push(H)
  return out
}

/** Unique symbol per person, assigned greedily in roster order so the result
 *  is deterministic (earlier people win the nicer symbols). When every
 *  candidate is taken, the preferred one gains a digit: Jo2, Jo3, …
 *  @param {{id:string,name?:string}[]} persons
 *  @returns {Map<string,string>} id → symbol */
export function assignSymbols(persons) {
  const taken = new Set()
  const out = new Map()
  for (const p of persons) {
    const cands = symbolCandidates(p.name)
    let sym = cands.find((s) => !taken.has(s))
    if (!sym) {
      let n = 2
      while (taken.has(cands[0] + n)) n++
      sym = cands[0] + n
    }
    taken.add(sym)
    out.set(p.id, sym)
  }
  return out
}

// ── Generations ────────────────────────────────────────────────────────────
/** Generation (1-based) of every person: depth along parent→child edges
 *  (relationships whose type has symmetryRole 'vertical'; person_a is the
 *  parent). A child sits one below its deepest parent. People with no parents
 *  who partner someone (a 'horizontal' edge) adopt their partner's
 *  generation, so married-in spouses line up with their family. Cycles are
 *  tolerated (their members keep the depth reached before the loop).
 *  @returns {Map<string,number>} */
export function generationsOf(persons, relationships, roles) {
  const ids = new Set(persons.map((p) => p.id))
  const parents = new Map()
  const children = new Map()
  const partners = new Map()
  const add = (m, k, v) => {
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(v)
  }
  for (const r of relationships || []) {
    const a = r.person_a_id
    const b = r.person_b_id
    if (!ids.has(a) || !ids.has(b) || a === b) continue
    const role = roles?.get ? roles.get(r.type) : undefined
    if (role === 'vertical') {
      add(parents, b, a)
      add(children, a, b)
    } else if (role === 'horizontal') {
      add(partners, a, b)
      add(partners, b, a)
    }
  }

  // Longest-path depth via Kahn's topological order, seeded by `seed`.
  const run = (seed) => {
    const gen = new Map()
    const indeg = new Map()
    for (const id of ids) {
      indeg.set(id, (parents.get(id) || []).length)
      gen.set(id, seed.get(id) || 1)
    }
    const queue = []
    for (const id of ids) if (indeg.get(id) === 0) queue.push(id)
    for (let qi = 0; qi < queue.length; qi++) {
      const id = queue[qi]
      for (const c of children.get(id) || []) {
        gen.set(c, Math.max(gen.get(c), gen.get(id) + 1))
        indeg.set(c, indeg.get(c) - 1)
        if (indeg.get(c) === 0) queue.push(c)
      }
    }
    return gen
  }

  let seed = new Map()
  let gen = run(seed)
  for (let pass = 0; pass < 4; pass++) {
    let changed = false
    const next = new Map(seed)
    for (const id of ids) {
      if ((parents.get(id) || []).length) continue
      const ps = partners.get(id)
      if (!ps) continue
      const g = Math.max(...ps.map((q) => gen.get(q)))
      if (g > (next.get(id) || 1)) {
        next.set(id, g)
        changed = true
      }
    }
    if (!changed) break
    seed = next
    gen = run(seed)
  }
  return gen
}

// ── Grouping (columns) ─────────────────────────────────────────────────────
export const UNKNOWN_KEY = '?'

/** Column descriptor for one person under a grouping, or null (→ the "?"
 *  column). `order` sorts columns; `label` heads them.
 *  ctx: { gens: Map, tagsOf: Map } */
export function groupOf(p, grouping, ctx = {}) {
  if (grouping === 'generation') {
    const g = ctx.gens?.get(p.id)
    return g ? { key: 'g' + g, label: 'Gen ' + g, order: g } : null
  }
  if (grouping === 'tag') {
    const t = ctx.tagsOf?.get(p.id)?.[0]
    return t
      ? { key: 't' + t.id, label: t.label || 'Tag', order: t.label || '', color: t.color }
      : null
  }
  const y = p.birth?.year
  if (y == null || !Number.isFinite(Number(y))) return null
  const d = Math.floor(Number(y) / 10) * 10
  return { key: 'd' + d, label: (d < 0 ? '−' + -d : d) + 's', order: d }
}

/** Place `persons` into columns (groups) and rows (periods, roster order).
 *  Columns sort by `order` (numbers ascending, strings by locale); the
 *  unknown column trails. Returns columns (with their member ids), a
 *  per-person cell map, and the table's content size.
 *  @param {object[]} persons
 *  @param {(p:object)=>({key,label,order,color?}|null)} keyOf
 *  @param {{originX?:number, originY?:number}} opts */
export function layoutTable(persons, keyOf, opts = {}) {
  const originX = opts.originX ?? PAD
  const originY = opts.originY ?? PAD
  const byKey = new Map()
  for (const p of persons) {
    const g = keyOf(p) || { key: UNKNOWN_KEY, label: '?', order: null, unknown: true }
    let col = byKey.get(g.key)
    if (!col) {
      col = {
        key: g.key,
        label: g.label,
        order: g.order,
        color: g.color || '',
        unknown: !!g.unknown,
        ids: []
      }
      byKey.set(g.key, col)
    }
    col.ids.push(p.id)
  }
  const columns = [...byKey.values()].sort((a, b) => {
    if (a.unknown !== b.unknown) return a.unknown ? 1 : -1
    if (typeof a.order === 'number' && typeof b.order === 'number') return a.order - b.order
    return String(a.order ?? '').localeCompare(String(b.order ?? ''))
  })
  const cells = new Map()
  let maxRows = 0
  columns.forEach((col, ci) => {
    col.index = ci
    col.x = originX + ci * COL_PITCH
    maxRows = Math.max(maxRows, col.ids.length)
    col.ids.forEach((id, ri) => {
      cells.set(id, { col: ci, row: ri, x: col.x, y: originY + ri * ROW_PITCH })
    })
  })
  const contentW = columns.length ? columns.length * COL_PITCH - GAP_X : 0
  const contentH = maxRows ? maxRows * ROW_PITCH - GAP_Y : 0
  return { columns, cells, maxRows, contentW, contentH }
}

/** Visible index ranges [first, last] (inclusive, clamped) of a pitch-spaced
 *  track for a scroll window, with `overscan` extra slots each side. */
export function visibleRange(scroll, view, origin, pitch, count, overscan = 1) {
  if (count <= 0) return [0, -1]
  const first = Math.max(0, Math.floor((scroll - origin) / pitch) - overscan)
  const last = Math.min(count - 1, Math.ceil((scroll + view - origin) / pitch) + overscan)
  return [first, last]
}
