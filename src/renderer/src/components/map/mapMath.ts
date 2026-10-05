// Pure math for the Map view — camera, geometry, and time. No canvas, DOM,
// store, or Vue here, so all of it is unit-tested (tests/mapMath.test.js).
//
// Coordinates: features live in map WORLD units (0..width × 0..height).
// The camera maps world → screen as  screen = world · k + (x, y).
// Polylines/polygons are flat number arrays [x0, y0, x1, y1, …].

import type { MapFeature, MapKey, MapToken } from '../../../../shared/types'

export interface Camera {
  x: number
  y: number
  k: number
}
export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

export const MIN_ZOOM = 0.05
export const MAX_ZOOM = 24

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smoothstep = (e0: number, e1: number, v: number) => {
  if (e0 === e1) return v < e0 ? 0 : 1
  const t = clamp((v - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

// ── camera ────────────────────────────────────────────────────────────────────
export function toScreen(cam: Camera, wx: number, wy: number): [number, number] {
  return [wx * cam.k + cam.x, wy * cam.k + cam.y]
}
export function toWorld(cam: Camera, sx: number, sy: number): [number, number] {
  return [(sx - cam.x) / cam.k, (sy - cam.y) / cam.k]
}

/** Zoom by `factor` keeping the screen point (sx, sy) fixed under the cursor. */
export function zoomAt(cam: Camera, sx: number, sy: number, factor: number): Camera {
  const k = clamp(cam.k * factor, MIN_ZOOM, MAX_ZOOM)
  const r = k / cam.k
  return { k, x: sx - (sx - cam.x) * r, y: sy - (sy - cam.y) * r }
}

/** The camera that frames `box` inside a viewW×viewH viewport with `pad` px. */
export function fitCamera(box: Box, viewW: number, viewH: number, pad = 40): Camera {
  const bw = Math.max(1, box.x1 - box.x0)
  const bh = Math.max(1, box.y1 - box.y0)
  const k = clamp(Math.min((viewW - pad * 2) / bw, (viewH - pad * 2) / bh), MIN_ZOOM, MAX_ZOOM)
  return {
    k,
    x: viewW / 2 - ((box.x0 + box.x1) / 2) * k,
    y: viewH / 2 - ((box.y0 + box.y1) / 2) * k
  }
}

/** Camera centred on a world point at zoom k. */
export function centerOn(wx: number, wy: number, k: number, viewW: number, viewH: number): Camera {
  return { k, x: viewW / 2 - wx * k, y: viewH / 2 - wy * k }
}

/** Interpolate cameras in log-zoom space so a fly-to feels even at any scale. */
export function lerpCamera(a: Camera, b: Camera, t: number, viewW: number, viewH: number): Camera {
  const k = Math.exp(lerp(Math.log(a.k), Math.log(b.k), t))
  // interpolate the world point at the viewport centre, then rebuild
  const [ax, ay] = toWorld(a, viewW / 2, viewH / 2)
  const [bx, by] = toWorld(b, viewW / 2, viewH / 2)
  return centerOn(lerp(ax, bx, t), lerp(ay, by, t), k, viewW, viewH)
}

/** The world-space box currently on screen. */
export function viewBox(cam: Camera, viewW: number, viewH: number): Box {
  const [x0, y0] = toWorld(cam, 0, 0)
  const [x1, y1] = toWorld(cam, viewW, viewH)
  return { x0, y0, x1, y1 }
}

// ── geometry ──────────────────────────────────────────────────────────────────
export function bboxOf(pts: number[]): Box {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let i = 0; i < pts.length; i += 2) {
    const x = pts[i]
    const y = pts[i + 1]
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  return { x0, y0, x1, y1 }
}

export function boxesOverlap(a: Box, b: Box, margin = 0): boolean {
  return !(
    a.x1 + margin < b.x0 ||
    a.x0 - margin > b.x1 ||
    a.y1 + margin < b.y0 ||
    a.y0 - margin > b.y1
  )
}

/** Signed shoelace area (positive = clockwise in screen coords). */
export function polygonArea(pts: number[]): number {
  let a = 0
  const n = pts.length
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n
    a += pts[i] * pts[j + 1] - pts[j] * pts[i + 1]
  }
  return a / 2
}

/** Area-weighted centroid; falls back to the vertex mean for degenerate shapes. */
export function polygonCentroid(pts: number[]): [number, number] {
  const n = pts.length
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n
    const cross = pts[i] * pts[j + 1] - pts[j] * pts[i + 1]
    a += cross
    cx += (pts[i] + pts[j]) * cross
    cy += (pts[i + 1] + pts[j + 1]) * cross
  }
  if (Math.abs(a) < 1e-9) {
    let sx = 0
    let sy = 0
    for (let i = 0; i < n; i += 2) {
      sx += pts[i]
      sy += pts[i + 1]
    }
    const m = Math.max(1, n / 2)
    return [sx / m, sy / m]
  }
  return [cx / (3 * a), cy / (3 * a)]
}

/** Even-odd point-in-polygon. */
export function pointInPolygon(x: number, y: number, pts: number[]): boolean {
  let inside = false
  const n = pts.length
  for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
    const xi = pts[i]
    const yi = pts[i + 1]
    const xj = pts[j]
    const yj = pts[j + 1]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 ? clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1) : 0
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

export function distToPolyline(px: number, py: number, pts: number[], closed = false): number {
  let best = Infinity
  const n = pts.length
  if (n === 2) return Math.hypot(px - pts[0], py - pts[1])
  const last = closed ? n : n - 2
  for (let i = 0; i < last; i += 2) {
    const j = (i + 2) % n
    const d = distToSegment(px, py, pts[i], pts[i + 1], pts[j], pts[j + 1])
    if (d < best) best = d
  }
  return best
}

export function polylineLength(pts: number[], closed = false): number {
  let len = 0
  const n = pts.length
  const last = closed ? n : n - 2
  for (let i = 0; i < last; i += 2) {
    const j = (i + 2) % n
    len += Math.hypot(pts[j] - pts[i], pts[j + 1] - pts[i + 1])
  }
  return len
}

/** The point (and heading) at fraction t ∈ [0,1] along an open polyline. */
export function pointAlong(pts: number[], t: number): { x: number; y: number; angle: number } {
  const total = polylineLength(pts)
  if (pts.length < 4 || total === 0) return { x: pts[0] ?? 0, y: pts[1] ?? 0, angle: 0 }
  let target = clamp(t, 0, 1) * total
  for (let i = 0; i < pts.length - 2; i += 2) {
    const seg = Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1])
    if (target <= seg || i === pts.length - 4) {
      const u = seg ? clamp(target / seg, 0, 1) : 0
      return {
        x: lerp(pts[i], pts[i + 2], u),
        y: lerp(pts[i + 1], pts[i + 3], u),
        angle: Math.atan2(pts[i + 3] - pts[i + 1], pts[i + 2] - pts[i])
      }
    }
    target -= seg
  }
  return { x: pts[pts.length - 2], y: pts[pts.length - 1], angle: 0 }
}

/** Ramer–Douglas–Peucker simplification of an open polyline. */
export function simplify(pts: number[], tolerance: number): number[] {
  const n = pts.length / 2
  if (n <= 2) return pts.slice()
  const keep = new Uint8Array(n)
  keep[0] = 1
  keep[n - 1] = 1
  const stack: [number, number][] = [[0, n - 1]]
  while (stack.length) {
    const [a, b] = stack.pop() as [number, number]
    let maxD = 0
    let idx = -1
    for (let i = a + 1; i < b; i++) {
      const d = distToSegment(
        pts[i * 2],
        pts[i * 2 + 1],
        pts[a * 2],
        pts[a * 2 + 1],
        pts[b * 2],
        pts[b * 2 + 1]
      )
      if (d > maxD) {
        maxD = d
        idx = i
      }
    }
    if (idx !== -1 && maxD > tolerance) {
      keep[idx] = 1
      stack.push([a, idx], [idx, b])
    }
  }
  const out: number[] = []
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * 2], pts[i * 2 + 1])
  return out
}

/** Chaikin corner-cutting — turns a hand-drawn polyline into a smooth curve. */
export function chaikin(pts: number[], closed: boolean, iterations = 2): number[] {
  let cur = pts
  for (let it = 0; it < iterations; it++) {
    const n = cur.length
    if (n < 6) return cur
    const out: number[] = []
    if (!closed) out.push(cur[0], cur[1])
    const last = closed ? n : n - 2
    for (let i = 0; i < last; i += 2) {
      const j = (i + 2) % n
      const x0 = cur[i]
      const y0 = cur[i + 1]
      const x1 = cur[j]
      const y1 = cur[j + 1]
      out.push(
        0.75 * x0 + 0.25 * x1,
        0.75 * y0 + 0.25 * y1,
        0.25 * x0 + 0.75 * x1,
        0.25 * y0 + 0.75 * y1
      )
    }
    if (!closed) out.push(cur[n - 2], cur[n - 1])
    cur = out
  }
  return cur
}

/** Translate a flat point list. */
export function translatePts(pts: number[], dx: number, dy: number): number[] {
  const out = new Array(pts.length)
  for (let i = 0; i < pts.length; i += 2) {
    out[i] = Math.round((pts[i] + dx) * 10) / 10
    out[i + 1] = Math.round((pts[i + 1] + dy) * 10) / 10
  }
  return out
}

// ── deterministic randomness ──────────────────────────────────────────────────
/** mulberry32 — tiny seeded PRNG (same seed → same map every time). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stable 32-bit hash of a string (feature ids seed their symbol scatter). */
export function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Jittered-grid points inside a polygon, sorted top→bottom so symbols
 *  overlap like a hand-drawn map (nearer = lower = drawn later). */
export function scatterInPolygon(
  pts: number[],
  spacing: number,
  seed: number,
  maxCount = 5000
): number[] {
  const box = bboxOf(pts)
  const rand = rng(seed)
  const out: [number, number, number][] = []
  const rowH = spacing * 0.8
  let row = 0
  for (let y = box.y0 + rowH / 2; y < box.y1; y += rowH, row++) {
    const off = row % 2 ? spacing / 2 : 0
    for (let x = box.x0 + off; x < box.x1; x += spacing) {
      const jx = x + (rand() - 0.5) * spacing * 0.7
      const jy = y + (rand() - 0.5) * rowH * 0.7
      const r = rand()
      if (!pointInPolygon(jx, jy, pts)) continue
      // keep symbols off the very edge so they don't spill out of the shape
      if (distToPolyline(jx, jy, pts, true) < spacing * 0.35) continue
      out.push([jx, jy, r])
      if (out.length >= maxCount) break
    }
    if (out.length >= maxCount) break
  }
  out.sort((a, b) => a[1] - b[1])
  const flat: number[] = []
  for (const [x, y, r] of out) flat.push(x, y, r)
  return flat
}

// ── time ──────────────────────────────────────────────────────────────────────
/** How visible a feature is at `year` (0..1). Features without a window are
 *  always fully visible; windowed ones fade in/out over `fade` years around
 *  their inclusive [from, to] span (so year `to` itself is fully visible). */
export function windowAlpha(
  f: Pick<MapFeature, 'from' | 'to'>,
  year: number | null,
  fade = 0.5
): number {
  if (year == null) return 1
  let a = 1
  if (f.from != null) a *= smoothstep(f.from - fade, f.from, year)
  if (f.to != null) a *= 1 - smoothstep(f.to + 1, f.to + 1 + fade, year)
  return a
}

export interface TokenState {
  x: number
  y: number
  /** 0..1 progress through the current leg, or -1 while resting at a stop. */
  leg: number
  /** Index of the key the token last passed. */
  from: number
  /** Heading while travelling (radians). */
  angle: number
}

/** Where a token stands at `year`: at its first stop before the journey
 *  begins, at its last after it ends, eased between stops in between. */
export function tokenStateAt(keys: MapKey[], year: number | null): TokenState {
  const n = keys.length
  if (!n) return { x: 0, y: 0, leg: -1, from: 0, angle: 0 }
  if (year == null || n === 1 || year <= keys[0].t) {
    const k = year == null ? keys[n - 1] : keys[0]
    return { x: k.x, y: k.y, leg: -1, from: year == null ? n - 1 : 0, angle: 0 }
  }
  if (year >= keys[n - 1].t) {
    return { x: keys[n - 1].x, y: keys[n - 1].y, leg: -1, from: n - 1, angle: 0 }
  }
  // binary search for the leg
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (keys[mid].t <= year) lo = mid
    else hi = mid
  }
  const a = keys[lo]
  const b = keys[hi]
  const u = (year - a.t) / (b.t - a.t)
  const e = easeInOut(u)
  const still = a.x === b.x && a.y === b.y
  return {
    x: lerp(a.x, b.x, e),
    y: lerp(a.y, b.y, e),
    leg: still ? -1 : u,
    from: lo,
    angle: Math.atan2(b.y - a.y, b.x - a.x)
  }
}

/** Set (or add) the token's stop at `year` — the Map view's "drag = record a
 *  move" rule. Returns a new, sorted key array; the input is not mutated. */
export function upsertKey(keys: MapKey[], year: number, x: number, y: number): MapKey[] {
  const t = Math.round(year)
  const out = keys.filter((k) => k.t !== t).map((k) => ({ ...k }))
  const prev = keys.find((k) => k.t === t)
  out.push({ ...(prev || {}), t, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 })
  out.sort((a, b) => a.t - b.t)
  return out
}

/** Shift every stop of a journey (Alt-drag moves the whole path). */
export function shiftKeys(keys: MapKey[], dx: number, dy: number): MapKey[] {
  return keys.map((k) => ({
    ...k,
    x: Math.round((k.x + dx) * 10) / 10,
    y: Math.round((k.y + dy) * 10) / 10
  }))
}

/** How present a person is at `year`: 0 before birth, 1 alive, a ghostly
 *  0.4 after death. Fades over `fade` years at both edges. */
export function lifeAlpha(
  birth: number | null,
  death: number | null,
  year: number | null,
  fade = 0.5
): number {
  if (year == null) return 1
  let a = 1
  if (birth != null) a *= smoothstep(birth - fade, birth, year)
  if (death != null) a *= 1 - 0.6 * smoothstep(death, death + fade, year)
  return a
}

export interface YearRange {
  min: number
  max: number
}

/** The span the map's timeline covers: the project's dated range widened by
 *  every journey stop and feature window on the map. Null = nothing dated. */
export function mapTimeRange(
  features: Pick<MapFeature, 'from' | 'to'>[],
  tokens: Pick<MapToken, 'keys'>[],
  project: YearRange | null
): YearRange | null {
  let min = project ? project.min : Infinity
  let max = project ? project.max : -Infinity
  const see = (v: number | null | undefined) => {
    if (v == null || !Number.isFinite(v)) return
    if (v < min) min = v
    if (v > max) max = v
  }
  for (const f of features) {
    see(f.from)
    see(f.to)
  }
  for (const tk of tokens) {
    if (tk.keys.length > 1) for (const k of tk.keys) see(k.t)
  }
  if (!Number.isFinite(min)) return null
  min = Math.floor(min)
  max = Math.ceil(max)
  if (max - min < 10) {
    const mid = (min + max) / 2
    min = Math.floor(mid - 5)
    max = Math.ceil(mid + 5)
  }
  return { min, max }
}

/** Tokens that sit on (nearly) the same screen spot get fanned out around it
 *  so every face stays visible. Input/output are screen positions. */
export function fanOut(
  pos: { x: number; y: number }[],
  cell = 26,
  radius = 22
): { x: number; y: number }[] {
  const groups = new Map<string, number[]>()
  pos.forEach((p, i) => {
    const key = Math.round(p.x / cell) + ',' + Math.round(p.y / cell)
    const g = groups.get(key)
    if (g) g.push(i)
    else groups.set(key, [i])
  })
  const out = pos.map((p) => ({ x: p.x, y: p.y }))
  for (const idx of groups.values()) {
    if (idx.length < 2) continue
    let cx = 0
    let cy = 0
    for (const i of idx) {
      cx += pos[i].x
      cy += pos[i].y
    }
    cx /= idx.length
    cy /= idx.length
    const r = radius * Math.min(2.2, 0.7 + idx.length * 0.18)
    idx.forEach((i, j) => {
      const a = -Math.PI / 2 + (j / idx.length) * Math.PI * 2
      out[i] = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }
    })
  }
  return out
}

export type GeometryOf = (kind: string) => 'area' | 'line' | 'point'

/** Topmost feature under a world point: points first, then lines, then the
 *  smallest enclosing area (so a forest inside a kingdom wins over the
 *  kingdom, and land/water only when nothing else is there). Features faded
 *  out by the timeline can't be hit. `tol` is the pick radius in world units. */
export function hitFeature(
  features: MapFeature[],
  wx: number,
  wy: number,
  tol: number,
  year: number | null,
  geometryOf: GeometryOf,
  opts: { skipBase?: boolean } = {}
): string | null {
  let bestPoint: string | null = null
  let bestPointD = Infinity
  let bestLine: string | null = null
  let bestLineD = Infinity
  let bestArea: string | null = null
  let bestAreaA = Infinity
  let baseArea: string | null = null
  let baseAreaA = Infinity
  for (let i = features.length - 1; i >= 0; i--) {
    const f = features[i]
    if (windowAlpha(f, year) < 0.3) continue
    const geo = geometryOf(f.kind)
    if (geo === 'point') {
      const d = Math.hypot(wx - f.pts[0], wy - f.pts[1])
      if (d <= tol * 1.8 && d < bestPointD) {
        bestPointD = d
        bestPoint = f.id
      }
    } else if (geo === 'line') {
      const d = distToPolyline(wx, wy, f.pts)
      if (d <= tol && d < bestLineD) {
        bestLineD = d
        bestLine = f.id
      }
    } else if (f.pts.length >= 6 && pointInPolygon(wx, wy, f.pts)) {
      const a = Math.abs(polygonArea(f.pts))
      if (f.kind === 'land' || f.kind === 'water') {
        if (!opts.skipBase && a < baseAreaA) {
          baseAreaA = a
          baseArea = f.id
        }
      } else if (a < bestAreaA) {
        bestAreaA = a
        bestArea = f.id
      }
    }
  }
  return bestPoint || bestLine || bestArea || baseArea
}

/** Index of the raw vertex within `tol` of a world point, or -1. */
export function hitVertex(pts: number[], wx: number, wy: number, tol: number): number {
  let best = -1
  let bestD = tol
  for (let i = 0; i < pts.length; i += 2) {
    const d = Math.hypot(wx - pts[i], wy - pts[i + 1])
    if (d <= bestD) {
      bestD = d
      best = i / 2
    }
  }
  return best
}

/** A "nice" scale-bar length (1/2/5 × 10ⁿ) close to `target`. */
export function niceLength(target: number): number {
  if (!(target > 0)) return 1
  const p = Math.pow(10, Math.floor(Math.log10(target)))
  const m = target / p
  return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p
}
