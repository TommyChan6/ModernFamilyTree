// 山水 map maths — the pure half of the painted (shanshui / qinglü) map styles:
// where painting sprites stand inside a mountain area, how a coast is split
// into pressure-varying brush runs, the zoom octaves of the 水纹 wave pattern,
// and the ambient choreography (geese crossing, boats drifting, the ink-bloom
// reveal). No canvas, no DOM — MapRenderer.ts draws what these return.

import { noise1 } from '../../lib/inkArt'
import { polygonArea, polylineLength, pointAlong, scatterInPolygon } from './mapMath'

/** World-unit spacing between painted sprites, per terrain kind. */
export const PAINT_SPACING: Record<string, number> = {
  mountains: 105,
  hills: 105,
  forest: 78
}

export interface Placement {
  /** The sprite's foot (bottom-centre anchor) in world units. */
  x: number
  y: number
  /** 0..1 — which sprite of the kind's set. */
  pick: number
  /** Height multiplier (0.78..1.22). */
  scale: number
  flip: boolean
}

const fract = (v: number) => v - Math.floor(v)

/**
 * Seeded, stable sprite placements inside an area polygon, sorted back to
 * front (by foot y) so later sprites overlap earlier ones like nearer ridges.
 */
export function paintingPlacements(
  pts: number[],
  kind: string,
  seed: number,
  size = 1,
  max = 400
): Placement[] {
  const base = (PAINT_SPACING[kind] || 110) * Math.max(0.4, size)
  // small areas pack their sprites closer so even a little range reads as a
  // cluster of peaks (sprite SIZE stays tied to the base spacing)
  const fit = Math.sqrt(Math.abs(polygonArea(pts))) / 3.4
  const spacing = Math.max(base * 0.4, Math.min(base, fit))
  const flat = scatterInPolygon(pts, spacing, seed, max)
  const out: Placement[] = []
  for (let i = 0; i < flat.length; i += 3) {
    const r = flat[i + 2]
    out.push({
      x: flat[i],
      // the scatter keeps points off the edge; let the foot sit a bit lower
      // so the ridge rises out of the area rather than floating above it
      y: flat[i + 1] + spacing * 0.22,
      pick: fract(r * 7.31 + i * 0.618),
      scale: 0.78 + fract(r * 13.7) * 0.44,
      flip: fract(r * 29.3) > 0.5
    })
  }
  out.sort((a, b) => a.y - b.y)
  return out
}

/** Index into a set of n sprites from a 0..1 pick. */
export function pickIndex(pick: number, n: number): number {
  return n <= 0 ? -1 : Math.min(n - 1, Math.floor(pick * n))
}

export interface BrushRun {
  /** First / last vertex index (inclusive) into the polyline's points. */
  i0: number
  i1: number
  /** Width multiplier of this run (brush pressure). */
  w: number
}

/**
 * Split a polyline (flat [x,y,…]) into short overlapping runs, each with its
 * own pressure — stroked one after another with round caps they read as a
 * single brush line that swells and thins. Closed shapes wrap around.
 */
export function brushRuns(pts: number[], closed: boolean, seed: number, perRun = 7): BrushRun[] {
  const n = pts.length / 2
  if (n < 2) return []
  const nz = noise1(seed)
  const runs: BrushRun[] = []
  const last = closed ? n : n - 1
  for (let i = 0, j = 0; i < last; i += perRun, j++) {
    const i1 = Math.min(i + perRun, last)
    // slow swell + an occasional heavy press where the brush turns
    const v = 0.5 + 0.5 * nz(j * 0.55)
    const press = fract(Math.sin((j + 1) * 12.9898 + seed) * 43758.5453) > 0.86 ? 0.45 : 0
    runs.push({ i0: i, i1, w: 0.45 + v * 0.85 + press })
  }
  return runs
}

/** Vertex i of a (possibly closed) flat polyline, wrapping. */
export function vertexAt(pts: number[], i: number): [number, number] {
  const n = pts.length / 2
  const k = ((i % n) + n) % n
  return [pts[k * 2], pts[k * 2 + 1]]
}

/**
 * The wave pattern's two zoom octaves: the tile lives in world space but is
 * re-scaled in powers of two so its lines stay a similar size on screen;
 * the two nearest octaves cross-fade so zooming never "pops".
 */
export function waveOctaves(k: number, base = 1): { scale: number; alpha: number }[] {
  const lv = Math.log2(Math.max(1e-4, k))
  const lo = Math.floor(lv)
  const f = lv - lo
  // smooth the hand-off
  const s = f * f * (3 - 2 * f)
  return [
    { scale: base / Math.pow(2, lo), alpha: 1 - s },
    { scale: base / Math.pow(2, lo + 1), alpha: s }
  ].filter((o) => o.alpha > 0.02)
}

export interface Flock {
  /** Leader position (world units) and heading (radians). */
  x: number
  y: number
  angle: number
  /** Each bird: offset from the leader along / across the heading, wing phase. */
  birds: { along: number; across: number; flap: number }[]
  /** 0..1 fade at the ends of the crossing. */
  alpha: number
}

/**
 * A skein of geese crossing the sheet: one crossing every `period` seconds,
 * alternating direction, at a seeded height in the upper sky. Null between
 * crossings.
 */
export function flockAt(
  time: number,
  seed: number,
  W: number,
  H: number,
  period = 56,
  flight = 34
): Flock | null {
  if (time < 0) return null
  const cycle = Math.floor(time / period)
  const u = (time - cycle * period) / flight
  if (u >= 1) return null
  const r = (i: number) =>
    fract(Math.sin((cycle + 1) * 78.233 + seed * 0.013 + i * 37.719) * 43758.5453)
  const ltr = cycle % 2 === 0
  const y0 = H * (0.1 + r(1) * 0.3)
  const y1 = y0 + H * (r(2) - 0.5) * 0.18
  const span = W * 1.3
  const xs = ltr ? -W * 0.15 : W * 1.15
  const x = xs + (ltr ? 1 : -1) * span * u
  const y = y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * H * 0.03
  const angle = Math.atan2(y1 - y0, ltr ? span : -span)
  const count = 5 + Math.floor(r(3) * 5)
  const birds = []
  for (let i = 0; i < count; i++) {
    const side = i === 0 ? 0 : i % 2 ? 1 : -1
    const rank = Math.ceil(i / 2)
    birds.push({ along: -rank * 1.0, across: side * rank * 0.8, flap: r(10 + i) * Math.PI * 2 })
  }
  const alpha = Math.min(1, u * 8, (1 - u) * 8)
  return { x, y, angle, birds, alpha }
}

/**
 * A boat's place on a route at `time`: it glides out and back (ping-pong) at
 * `speed` world units/second, starting at a seeded phase. Returns the point,
 * the heading it is sailing, and a gentle bob.
 */
export function boatAt(
  pts: number[],
  time: number,
  speed: number,
  phase: number
): { x: number; y: number; angle: number; dir: 1 | -1; bob: number } | null {
  const len = polylineLength(pts)
  if (len < 1) return null
  const cyc = (time * speed) / len + phase * 2
  const m = fract(cyc / 2) * 2 // 0..2
  const dir: 1 | -1 = m < 1 ? 1 : -1
  const u = m < 1 ? m : 2 - m
  // ease near the turns so the boat slows before it comes about
  const e = 0.04 + 0.92 * (u * u * (3 - 2 * u) * 0.35 + u * 0.65)
  const p = pointAlong(pts, e)
  return { x: p.x, y: p.y, angle: p.angle, dir, bob: Math.sin(time * 1.3 + phase * 9) }
}

/** Ink-bloom reveal: 0..1 progress of blot `i` (staggered) at `t` seconds since start. */
export function bloomProgress(t: number, i: number, dur = 1.5, stagger = 0.16): number {
  const u = (t - i * stagger) / dur
  if (u <= 0) return 0
  if (u >= 1) return 1
  // fast wet spread that settles — ink soaking into paper
  return 1 - Math.pow(1 - u, 2.6)
}
