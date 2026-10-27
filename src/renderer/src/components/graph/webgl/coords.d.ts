// Types for the pure camera/tilt helpers in coords.js (so TypeScript modules —
// e.g. the Timeline's tilt math — can reuse them).

export interface ViewTransform {
  x: number
  y: number
  k: number
  sx?: number
  sy?: number
  /** Perspective tilt (radians) and yaw (radians); vw/vh = viewport size. */
  tl?: number
  yw?: number
  vw?: number
  vh?: number
}

export interface TiltParams {
  cx: number
  cy: number
  f: number
  s: number
  c: number
  ys: number
  yc: number
}

export const TILT_FOCAL: number
export const TILT_MAX: number
export function tiltParams(t: ViewTransform | null | undefined): TiltParams | null
export function clipSegment(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): { x0: number; y0: number; x1: number; y1: number; t0: number } | null
export function worldToScreen(
  wx: number,
  wy: number,
  t: ViewTransform
): { x: number; y: number; s: number }
export function screenToWorld(px: number, py: number, t: ViewTransform): { x: number; y: number }
export function screenToFlatPoint(
  px: number,
  py: number,
  t: ViewTransform
): { x: number; y: number }
export function translateToPin(
  wx: number,
  wy: number,
  px: number,
  py: number,
  t: ViewTransform,
  k?: number
): { x: number; y: number }
export function perspectiveScale(wx: number, wy: number, t: ViewTransform): number
export function tiltProjection(t: ViewTransform, W: number, H: number): number[]
export function depthOrder(
  nodes: ArrayLike<{ x: number; y: number }>,
  t: ViewTransform,
  prev?: ArrayLike<number> | null
): number[] | null
export function pickNodeOnScreen<N extends { x: number; y: number }>(
  px: number,
  py: number,
  nodes: Iterable<N>,
  t: ViewTransform,
  radiusOf: (n: N) => number,
  lift?: number,
  slack?: number
): N | null
export function fitExtent(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  width: number,
  height: number,
  pad?: number,
  maxScale?: number
): { x: number; y: number; k: number }
export function nodesExtent(
  nodes: ArrayLike<{ x: number; y: number }> | null | undefined
): { minX: number; minY: number; maxX: number; maxY: number } | null
