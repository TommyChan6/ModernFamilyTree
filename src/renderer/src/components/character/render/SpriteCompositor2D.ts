// The 2D sprite-compositor rendering backend: paints the pure model's resolved
// layers onto a canvas. One composited frame is ~20–30 Path2D fills — cheap
// enough to redraw per frame for the idle animation. Painterly future styles
// slot in by adding image layers here without touching the model or the view.

import type { StylePack } from '../styleTypes'
import type { CharacterDoc } from '../../../../../shared/types'
import { resolveLayers, type ResolvedLayer, type TransformOp } from '../characterModel'

/** Where to point the camera, in character space. */
export interface Region {
  cx: number
  cy: number
  span: number
}

/** Device transform: character space × k + (tx, ty) = device pixels. */
export interface View {
  k: number
  tx: number
  ty: number
}

// Path2D construction is the only per-layer cost worth caching; keyed by the
// path string, shared across every canvas/instance.
const pathCache = new Map<string, Path2D>()
function pathOf(d: string): Path2D {
  let p = pathCache.get(d)
  if (!p) {
    p = new Path2D(d)
    pathCache.set(d, p)
  }
  return p
}

/** Fit a character-space region into a device-pixel box (contain + center). */
export function fitRegion(region: Region, width: number, height: number, pad = 0): View {
  const k = Math.min((width - pad * 2) / region.span, (height - pad * 2) / region.span)
  return {
    k,
    tx: width / 2 - region.cx * k,
    ty: height / 2 - region.cy * k
  }
}

function applyOps(ctx: CanvasRenderingContext2D, ops: TransformOp[]): void {
  for (const op of ops) {
    if (op.type === 'translate') ctx.translate(op.x, op.y)
    else {
      ctx.translate(op.cx, op.cy)
      ctx.scale(op.sx, op.sy)
      ctx.translate(-op.cx, -op.cy)
    }
  }
}

export interface DrawOptions {
  /** Slot to outline with a soft selection glow. */
  highlightSlot?: string | null
  highlightColor?: string
}

/** Paint resolved layers under the given view transform. The caller owns
 *  clearing/background; this only draws the figure. */
export function drawLayers(
  ctx: CanvasRenderingContext2D,
  layers: ResolvedLayer[],
  view: View,
  opts: DrawOptions = {}
): void {
  ctx.save()
  ctx.setTransform(view.k, 0, 0, view.k, view.tx, view.ty)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const layer of layers) {
    const path = pathOf(layer.d)
    ctx.save()
    applyOps(ctx, layer.ops)
    if (layer.fill) {
      ctx.fillStyle = layer.fill
      ctx.fill(path)
    }
    if (layer.stroke && layer.lineWidth > 0) {
      ctx.strokeStyle = layer.stroke
      ctx.lineWidth = layer.lineWidth
      ctx.stroke(path)
    }
    ctx.restore()
  }
  // Selection glow: re-stroke the highlighted slot's silhouette on top.
  if (opts.highlightSlot) {
    ctx.globalAlpha = 0.55
    ctx.strokeStyle = opts.highlightColor || '#6c8ef5'
    for (const layer of layers) {
      if (layer.slot !== opts.highlightSlot) continue
      ctx.save()
      applyOps(ctx, layer.ops)
      ctx.lineWidth = (layer.lineWidth || 4) + 4
      ctx.stroke(pathOf(layer.d))
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }
  ctx.restore()
}

/** Topmost slot under a device-pixel point (walks layers front to back).
 *  Strokes count via isPointInStroke so line-art parts (glasses, happy eyes)
 *  stay clickable. */
export function hitTest(
  ctx: CanvasRenderingContext2D,
  layers: ResolvedLayer[],
  x: number,
  y: number,
  view: View
): string | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i]
    const path = pathOf(layer.d)
    ctx.save()
    ctx.setTransform(view.k, 0, 0, view.k, view.tx, view.ty)
    applyOps(ctx, layer.ops)
    let hit = false
    if (layer.fill) hit = ctx.isPointInPath(path, x, y)
    if (!hit && layer.stroke && layer.lineWidth > 0) {
      ctx.lineWidth = Math.max(layer.lineWidth, 10)
      hit = ctx.isPointInStroke(path, x, y)
    }
    ctx.restore()
    if (hit) return layer.slot
  }
  return null
}

export interface RasterizeOptions {
  /** Output square size in pixels. */
  size?: number
  /** Character-space region to frame; defaults to the full figure. */
  region?: Region
  /** CSS background; omit for transparency. */
  background?: string
  mimeType?: string
  quality?: number
}

/** Render a doc to a data URL (WebP by default) — the portrait hand-off into
 *  the regular images pipeline, and the filmstrip thumbnails. */
export function rasterize(doc: CharacterDoc, pack: StylePack, opts: RasterizeOptions = {}): string {
  const size = opts.size ?? 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D unavailable')
  if (opts.background) {
    ctx.fillStyle = opts.background
    ctx.fillRect(0, 0, size, size)
  }
  const region = opts.region ?? {
    cx: pack.width / 2,
    cy: pack.height / 2,
    span: Math.max(pack.width, pack.height) * 1.04
  }
  drawLayers(ctx, resolveLayers(doc, pack), fitRegion(region, size, size))
  return canvas.toDataURL(opts.mimeType ?? 'image/webp', opts.quality ?? 0.9)
}

/** Head-and-shoulders crop — what the avatar pipeline wants. */
export function portraitRegion(pack: StylePack): Region {
  return { cx: pack.width / 2, cy: pack.height * 0.34, span: pack.width * 0.92 }
}
