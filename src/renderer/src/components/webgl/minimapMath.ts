// Pure math for the corner minimaps (graph / timeline / groups / space).
//
// A minimap projection maps world coordinates onto the minimap canvas:
//
//     mapX = worldX * sx + ox
//     mapY = worldY * sy + oy
//
// The world can be anything the view thinks in — graph pixels, (laneX, year)
// for the timeline, the x/z ground plane for 3D. No DOM, no store.

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Projection {
  sx: number
  sy: number
  ox: number
  oy: number
}

export function rectToBounds(r: Rect): Bounds {
  return { minX: r.x, minY: r.y, maxX: r.x + r.w, maxY: r.y + r.h }
}

export function unionBounds(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a) return b
  if (!b) return a
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY)
  }
}

// Breathing room around the fitted world, as a fraction of the larger side.
export function padBounds(b: Bounds, frac = 0.05): Bounds {
  const pad = frac * Math.max(b.maxX - b.minX, b.maxY - b.minY, 1)
  return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad }
}

// Centre the bounds inside a mapW×mapH canvas with a pixel margin. With
// preserveAspect the world keeps its shape (graph, groups); without it each
// axis stretches independently (timeline: lanes vs years share no unit).
export function fitProjection(
  b: Bounds,
  mapW: number,
  mapH: number,
  margin = 8,
  preserveAspect = true
): Projection {
  const w = Math.max(1e-6, b.maxX - b.minX)
  const h = Math.max(1e-6, b.maxY - b.minY)
  let sx = Math.max(1e-6, mapW - margin * 2) / w
  let sy = Math.max(1e-6, mapH - margin * 2) / h
  if (preserveAspect) sx = sy = Math.min(sx, sy)
  return {
    sx,
    sy,
    ox: mapW / 2 - (sx * (b.minX + b.maxX)) / 2,
    oy: mapH / 2 - (sy * (b.minY + b.maxY)) / 2
  }
}

export function worldToMap(wx: number, wy: number, p: Projection): { x: number; y: number } {
  return { x: wx * p.sx + p.ox, y: wy * p.sy + p.oy }
}

export function mapToWorld(mx: number, my: number, p: Projection): { x: number; y: number } {
  return { x: (mx - p.ox) / p.sx, y: (my - p.oy) / p.sy }
}

// One step of the exponential glide the minimap uses so reframes (bounds or
// viewport changes) ease in instead of snapping.
export function lerpProjection(cur: Projection, target: Projection, t: number): Projection {
  return {
    sx: cur.sx + (target.sx - cur.sx) * t,
    sy: cur.sy + (target.sy - cur.sy) * t,
    ox: cur.ox + (target.ox - cur.ox) * t,
    oy: cur.oy + (target.oy - cur.oy) * t
  }
}

// Converged enough to stop animating: scales within 0.1% and offsets within a
// quarter pixel.
export function projectionsClose(a: Projection, b: Projection): boolean {
  return (
    Math.abs(a.sx - b.sx) <= 0.001 * Math.abs(b.sx) &&
    Math.abs(a.sy - b.sy) <= 0.001 * Math.abs(b.sy) &&
    Math.abs(a.ox - b.ox) <= 0.25 &&
    Math.abs(a.oy - b.oy) <= 0.25
  )
}

// Visible world rect for the shared screen-transform camera used by the graph
// and groups views ({ x, y, k }: screen = world * k + x).
export function viewRectXYK(
  t: { x: number; y: number; k: number },
  screenW: number,
  screenH: number
): Rect {
  return { x: -t.x / t.k, y: -t.y / t.k, w: screenW / t.k, h: screenH / t.k }
}
