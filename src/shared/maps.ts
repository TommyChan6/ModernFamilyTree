// Maps — the data half of the Map view. A MapDoc is a self-contained drawing
// (features + people tokens) scoped to a project. The renderer owns every
// visual decision; this module only guarantees the stored shape is sane, so a
// hand-edited or half-written payload can never poison the file.

import type { MapDoc, MapFeature, MapFeatureKind, MapKey, MapToken } from './types'

export const MAP_FEATURE_KINDS: readonly MapFeatureKind[] = [
  'land',
  'water',
  'forest',
  'mountains',
  'hills',
  'desert',
  'grass',
  'swamp',
  'snow',
  'territory',
  'zone',
  'river',
  'road',
  'rail',
  'wall',
  'border',
  'searoute',
  'arrow',
  'place',
  'label',
  'event'
]
const KIND_SET = new Set<string>(MAP_FEATURE_KINDS)

export const MAP_STYLE_IDS = [
  'parchment',
  'fantasy',
  'ink',
  'shanshui',
  'qinglu',
  'hightech',
  'atlas'
] as const

/** Hard caps — generous for hand-drawn maps, small enough to keep the JSON file sane. */
export const MAP_LIMITS = {
  features: 6000,
  tokens: 2000,
  pointsPerFeature: 8000, // numbers, i.e. 4000 vertices
  keysPerToken: 500,
  minSize: 200,
  maxSize: 20000
}

function num(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function yearOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

/** Round world coordinates to 0.1 unit — plenty of precision, far smaller JSON. */
function coord(v: unknown): number {
  return Math.round(num(v, 0) * 10) / 10
}

export function sanitizeFeature(raw: unknown, uuid: () => string): MapFeature | null {
  if (!raw || typeof raw !== 'object') return null
  const f = raw as Record<string, unknown>
  if (!KIND_SET.has(String(f.kind))) return null
  const pts = Array.isArray(f.pts) ? f.pts.slice(0, MAP_LIMITS.pointsPerFeature).map(coord) : []
  if (pts.length % 2 === 1) pts.pop()
  if (pts.length < 2) return null
  const out: MapFeature = {
    id: typeof f.id === 'string' && f.id ? f.id : uuid(),
    kind: f.kind as MapFeatureKind,
    pts
  }
  if (f.name != null) out.name = str(f.name, 120)
  if (f.color != null) out.color = str(f.color, 32)
  if (f.size != null) out.size = Math.min(12, Math.max(0.1, num(f.size, 1)))
  if (f.icon != null) out.icon = str(f.icon, 32)
  const from = yearOrNull(f.from)
  const to = yearOrNull(f.to)
  if (from != null) out.from = from
  if (to != null) out.to = to
  if (typeof f.tag_id === 'string' && f.tag_id) out.tag_id = f.tag_id
  if (f.note != null) out.note = str(f.note, 2000)
  if (f.rot != null) out.rot = num(f.rot, 0)
  return out
}

function sanitizeKey(raw: unknown): MapKey | null {
  if (!raw || typeof raw !== 'object') return null
  const k = raw as Record<string, unknown>
  const t = yearOrNull(k.t)
  if (t == null) return null
  const key: MapKey = { t, x: coord(k.x), y: coord(k.y) }
  if (k.note != null && k.note !== '') key.note = str(k.note, 200)
  return key
}

export function sanitizeToken(raw: unknown, uuid: () => string): MapToken | null {
  if (!raw || typeof raw !== 'object') return null
  const tk = raw as Record<string, unknown>
  if (typeof tk.person_id !== 'string' || !tk.person_id) return null
  const keys = (Array.isArray(tk.keys) ? tk.keys : [])
    .slice(0, MAP_LIMITS.keysPerToken)
    .map(sanitizeKey)
    .filter((k): k is MapKey => !!k)
    .sort((a, b) => a.t - b.t)
  // One key per year: the later write wins.
  const dedup: MapKey[] = []
  for (const k of keys) {
    if (dedup.length && dedup[dedup.length - 1].t === k.t) dedup[dedup.length - 1] = k
    else dedup.push(k)
  }
  if (!dedup.length) return null
  return {
    id: typeof tk.id === 'string' && tk.id ? tk.id : uuid(),
    person_id: tk.person_id,
    keys: dedup
  }
}

/** Apply a (partial) payload onto a doc, sanitizing every field it touches. */
export function applyMapPatch(doc: MapDoc, data: Record<string, unknown>, uuid: () => string) {
  if (data.name !== undefined) doc.name = str(data.name, 80) || 'Untitled map'
  if (data.style !== undefined) {
    const s = String(data.style)
    doc.style = (MAP_STYLE_IDS as readonly string[]).includes(s) ? s : 'parchment'
  }
  if (data.base !== undefined) doc.base = data.base === 'land' ? 'land' : 'sea'
  if (data.width !== undefined) {
    doc.width = Math.min(MAP_LIMITS.maxSize, Math.max(MAP_LIMITS.minSize, num(data.width, 2400)))
  }
  if (data.height !== undefined) {
    doc.height = Math.min(MAP_LIMITS.maxSize, Math.max(MAP_LIMITS.minSize, num(data.height, 1600)))
  }
  if (data.features !== undefined) {
    const list = Array.isArray(data.features) ? data.features : []
    const seen = new Set<string>()
    doc.features = []
    for (const raw of list.slice(0, MAP_LIMITS.features)) {
      const f = sanitizeFeature(raw, uuid)
      if (!f) continue
      if (seen.has(f.id)) f.id = uuid()
      seen.add(f.id)
      doc.features.push(f)
    }
  }
  if (data.tokens !== undefined) {
    const list = Array.isArray(data.tokens) ? data.tokens : []
    const people = new Set<string>()
    doc.tokens = []
    for (const raw of list.slice(0, MAP_LIMITS.tokens)) {
      const tk = sanitizeToken(raw, uuid)
      // a person appears at most once per map (their journey is one token)
      if (!tk || people.has(tk.person_id)) continue
      people.add(tk.person_id)
      doc.tokens.push(tk)
    }
  }
  if (data.view !== undefined) {
    const v = data.view as Record<string, unknown> | null
    doc.view =
      v && typeof v === 'object'
        ? { x: num(v.x, 0), y: num(v.y, 0), k: Math.min(64, Math.max(0.01, num(v.k, 1))) }
        : null
  }
  if (data.year !== undefined) doc.year = yearOrNull(data.year)
}
