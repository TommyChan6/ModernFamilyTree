// Pure perspective-tilt math for the Timeline — the graph's board tilt
// (graph/webgl/coords.js: the tilt `tl` + yaw `yw` plane homography) reused
// over the Timeline's FLAT stage pixels, plus the one thing the graph never
// needed: points lifted OFF the board.
//
// Spaces:
//   flat    the Timeline as drawn untilted (stage px: x = lane, y = time).
//           Everything the renderer lays out lives here; flat == screen when
//           the view is not tilted.
//   screen  the stage after the yaw + perspective tilt (coords.worldToScreen
//           with an identity camera — the TiltView below).
//
// Family arcs rise out of the plane: a point at flat (u, v) lifted h px along
// the board's normal lands on screen at projectLifted(u, v, h). liftPoint
// expresses that screen point back as the flat point UNDER it on the board, so
// lifted geometry can ride the same GPU projection (tiltProjection) as
// everything else — no shader or attribute changes. With no tilt both are the
// identity, so the flat view stays pixel-identical.

import {
  tiltParams,
  worldToScreen,
  screenToFlatPoint,
  type ViewTransform
} from '../graph/webgl/coords.js'

/** The tilt reaches full arc lift / depth haze at this angle (as the graph). */
export const TILT_FULL = (50 * Math.PI) / 180

export interface TiltView extends ViewTransform {
  x: 0
  y: 0
  k: 1
  tl: number
  yw: number
  vw: number
  vh: number
}

export interface Pt {
  x: number
  y: number
}
export interface ScreenPt extends Pt {
  /** Perspective scale (1/depth) of something standing there. */
  s: number
}

/** The coords.js transform for a Timeline stage: identity camera + tilt/yaw. */
export function tiltView(tl: number, yw: number, W: number, H: number): TiltView {
  return { x: 0, y: 0, k: 1, tl: tl || 0, yw: yw || 0, vw: Math.max(1, W), vh: Math.max(1, H) }
}

export function isTilted(T: ViewTransform | null | undefined): boolean {
  return !!tiltParams(T)
}

/** 0 (flat) … 1 (at TILT_FULL and beyond). */
export function tiltAmount(T: ViewTransform | null | undefined): number {
  return Math.min(1, Math.abs((T && T.tl) || 0) / TILT_FULL)
}

/** flat → screen (board point, h = 0). */
export function projectFlat(u: number, v: number, T: ViewTransform): ScreenPt {
  return worldToScreen(u, v, T)
}

/** screen → flat (the board point under a screen pixel). */
export function unprojectFlat(px: number, py: number, T: ViewTransform): Pt {
  return screenToFlatPoint(px, py, T)
}

/** Screen position of flat (u, v) lifted `h` px off the board (toward the
 *  viewer, along the board's normal). h = 0 is projectFlat. */
export function projectLifted(u: number, v: number, h: number, T: ViewTransform): ScreenPt {
  const p = tiltParams(T)
  if (!p || !h) return worldToScreen(u, v, T)
  const du = u - p.cx,
    dv0 = v - p.cy
  const ru = p.yc * du - p.ys * dv0
  const dv = p.ys * du + p.yc * dv0
  // The board's normal in camera space is (0, -sin, -cos): up the screen and
  // toward the camera, so a lifted point both rises and comes nearer.
  const w = Math.max(0.05, 1 - (dv * p.s) / p.f - (h * p.c) / p.f)
  return { x: p.cx + ru / w, y: p.cy + (dv * p.c - h * p.s) / w, s: 1 / w }
}

/** The flat board point that projects where flat (u, v) lifted by h does —
 *  lifted geometry expressed in flat px for the GPU's board projection. */
export function liftPoint(u: number, v: number, h: number, T: ViewTransform): Pt {
  if (!h || !tiltParams(T)) return { x: u, y: v }
  const s = projectLifted(u, v, h, T)
  return screenToFlatPoint(s.x, s.y, T)
}

/** Yawed depth coordinate of a flat point (+ toward the viewer / screen
 *  bottom). Board points with dv ≥ f / sin(tl) are behind the camera. */
export function boardDepth(u: number, v: number, T: ViewTransform): number {
  const p = tiltParams(T)
  if (!p) return 0
  return p.ys * (u - p.cx) + p.yc * (v - p.cy)
}

/** The nearest depth the 2D overlays draw to (a margin short of the camera
 *  plane, so nothing projects through infinity). Infinity when flat. */
export function nearLimit(T: ViewTransform): number {
  const p = tiltParams(T)
  if (!p || p.s < 1e-6) return Infinity
  return (0.9 * p.f) / p.s
}

/** Clip flat segment a→b to the in-front half plane (depth ≤ lim). Returns the
 *  kept part with its parameter range, or null when none is in front. */
export function clipSegmentNear(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  T: ViewTransform,
  lim = nearLimit(T)
): { x0: number; y0: number; x1: number; y1: number; t0: number; t1: number } | null {
  if (!Number.isFinite(lim)) return { x0, y0, x1, y1, t0: 0, t1: 1 }
  const d0 = boardDepth(x0, y0, T) - lim,
    d1 = boardDepth(x1, y1, T) - lim
  if (d0 > 0 && d1 > 0) return null
  if (d0 <= 0 && d1 <= 0) return { x0, y0, x1, y1, t0: 0, t1: 1 }
  const t = d0 / (d0 - d1)
  const xm = x0 + (x1 - x0) * t,
    ym = y0 + (y1 - y0) * t
  return d0 > 0
    ? { x0: xm, y0: ym, x1, y1, t0: t, t1: 1 }
    : { x0, y0, x1: xm, y1: ym, t0: 0, t1: t }
}

/** Clip a flat polygon (flat [x0, y0, x1, y1, …]) to the in-front half plane
 *  (one Sutherland–Hodgman pass). */
export function clipPolygonNear(pts: number[], T: ViewTransform, lim = nearLimit(T)): number[] {
  if (!Number.isFinite(lim)) return pts
  const out: number[] = []
  const n = pts.length / 2
  for (let i = 0; i < n; i++) {
    const ax = pts[i * 2],
      ay = pts[i * 2 + 1]
    const j = (i + 1) % n
    const bx = pts[j * 2],
      by = pts[j * 2 + 1]
    const da = boardDepth(ax, ay, T) - lim,
      db = boardDepth(bx, by, T) - lim
    if (da <= 0) out.push(ax, ay)
    if (da <= 0 !== db <= 0) {
      const t = da / (da - db)
      out.push(ax + (bx - ax) * t, ay + (by - ay) * t)
    }
  }
  return out
}

/** Flat bounding box of what the tilted stage shows (the images of the
 *  screen's corners and edge midpoints), padded. The viewport when flat. */
export function visibleFlatBounds(
  T: ViewTransform,
  W: number,
  H: number,
  pad = 0
): { x0: number; y0: number; x1: number; y1: number } {
  if (!tiltParams(T)) return { x0: 0 - pad, y0: 0 - pad, x1: W + pad, y1: H + pad }
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity
  for (const [sx, sy] of [
    [0, 0],
    [W / 2, 0],
    [W, 0],
    [W, H / 2],
    [W, H],
    [W / 2, H],
    [0, H],
    [0, H / 2]
  ]) {
    const f = screenToFlatPoint(sx, sy, T)
    if (f.x < x0) x0 = f.x
    if (f.y < y0) y0 = f.y
    if (f.x > x1) x1 = f.x
    if (f.y > y1) y1 = f.y
  }
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad }
}

// ── Arc lift ──────────────────────────────────────────────────────────────────
// How high a family line rises off the board: grows with how far it reaches
// across the lanes (so overlapping arcs of different reach separate by parallax
// when the board turns), capped so a tree-wide marriage doesn't leave orbit.
export const ARC_LIFT_MAX = 240

/** Peak height (px) of an arc spanning `span` flat px, times `k` (the tilt
 *  amount × the user's arc-lift setting). */
export function arcHeight(span: number, k = 1): number {
  if (!(k > 0)) return 0
  return k * Math.min(ARC_LIFT_MAX, 8 + 0.42 * Math.abs(span))
}

/** A rope / bar hung between two lifelines: 0 at both ends, 1 mid-span. */
export function ropeLift(t: number): number {
  return 4 * t * (1 - t)
}

/** A child's branch: leaves its parents' (raised) stem at h0, arches by hb,
 *  and lands on the child's pin (0). */
export function branchLift(t: number, h0: number, hb: number): number {
  return h0 * (1 - t) + hb * 4 * t * (1 - t)
}

/** A Sprout lifeline peeling out of the raised stem down onto its lane. */
export function sproutLift(t: number, h0: number): number {
  return h0 * (1 - t) * (1 - t)
}

/** Lift sampled curve points in place: point k of n+1 rises heightAt(k / n). */
export function liftSamples(
  pts: Pt[],
  n: number,
  T: ViewTransform,
  heightAt: (t: number) => number
): void {
  for (let k = 0; k <= n; k++) {
    const h = heightAt(k / n)
    if (!h) continue
    const q = liftPoint(pts[k].x, pts[k].y, h, T)
    pts[k].x = q.x
    pts[k].y = q.y
  }
}

/** Distance from (px, py) to segment a→b. */
export function distToSegment(
  px: number,
  py: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): number {
  const dx = x1 - x0,
    dy = y1 - y0
  const L2 = dx * dx + dy * dy
  const t = L2 > 0 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / L2)) : 0
  return Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t))
}

/** Screen-space pin hit: is screen (mx, my) on the billboard of radius r
 *  (flat px, shrunk by perspective) standing at flat (x, y)? */
export function pinHit(
  mx: number,
  my: number,
  x: number,
  y: number,
  r: number,
  T: ViewTransform
): boolean {
  const s = worldToScreen(x, y, T)
  return Math.hypot(mx - s.x, my - s.y) <= r * s.s
}

/** A billboard's group frame: local flat coords around anchor (ax, ay) map to
 *  screen by X + (p − a)·s. */
export interface BillboardFrame {
  ax: number
  ay: number
  h: number
  X: number
  Y: number
  s: number
}

/** The frame a billboard anchored at flat (ax, ay), lifted h, is drawn in;
 *  null when the anchor is behind the camera. */
export function billboardFrame(
  ax: number,
  ay: number,
  h: number,
  T: ViewTransform
): BillboardFrame | null {
  if (boardDepth(ax, ay, T) > nearLimit(T)) return null
  const P = projectLifted(ax, ay, h, T)
  if (!Number.isFinite(P.x + P.y + P.s)) return null
  return { ax, ay, h, X: P.x, Y: P.y, s: P.s }
}

/** A rect drawn in a billboard frame, as the flat rect it covers on the board
 *  (centre under its screen centre, size rescaled by the perspective there) —
 *  so flat-space hit tests and ghosts line up with what was drawn. */
export function frameRectToFlat(
  r: { x: number; y: number; w: number; h: number },
  g: BillboardFrame | null,
  T: ViewTransform
): { x: number; y: number; w: number; h: number } {
  if (!g || !tiltParams(T)) return { x: r.x, y: r.y, w: r.w, h: r.h }
  const cx = g.X + (r.x + r.w / 2 - g.ax) * g.s
  const cy = g.Y + (r.y + r.h / 2 - g.ay) * g.s
  const f = screenToFlatPoint(cx, cy, T)
  const m = g.s / Math.max(1e-3, worldToScreen(f.x, f.y, T).s)
  return { x: f.x - (r.w * m) / 2, y: f.y - (r.h * m) / 2, w: r.w * m, h: r.h * m }
}
