// 长卷 — paints the Handscroll's continuous landscape, one tile at a time.
// Every feature comes from handscrollLayout's seeded `landscapeFeatures`, so a
// tile only has to draw the features that overlap it (translated into tile
// space and clipped); its neighbours draw the same strokes and the seams
// vanish. Canvas-2D on top of lib/inkArt — tiles are cached by the view, so
// the bristle simulation runs once per tile, never per frame.

import {
  INK,
  rgba,
  rng,
  brushStroke,
  smoothPath,
  inkWash,
  mountainRange,
  paperCanvas,
  type Pt
} from '../../lib/inkArt'
import { DIMS, featuresIn, type Feature } from './handscrollLayout'

/** Band height the motif sizes were tuned at — they scale with the band. */
const H_REF = 640

type Ctx = CanvasRenderingContext2D

/** The scroll's paper tone (the painting is on paper in every theme). */
export const SCROLL_PAPER = '#efe6d0'

let paper: HTMLCanvasElement | null = null
function paperTex(): HTMLCanvasElement {
  if (!paper) paper = paperCanvas(512, 512, { tone: SCROLL_PAPER, fiber: 0.75, seed: 31 })
  return paper
}

/**
 * Paint tile `index` (world x ∈ [index·T, (index+1)·T)) of a band `bandH` px
 * tall into `canvas`, at `dpr` device pixels per CSS px.
 */
export function paintTile(
  canvas: HTMLCanvasElement,
  index: number,
  bandH: number,
  dpr: number,
  features: Feature[]
): void {
  const T = DIMS.tile
  canvas.width = Math.max(1, Math.round(T * dpr))
  canvas.height = Math.max(1, Math.round(bandH * dpr))
  const ctx = canvas.getContext('2d') as Ctx
  const x0 = index * T
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.translate(-x0, 0)
  ctx.beginPath()
  ctx.rect(x0, 0, T, bandH)
  ctx.clip()

  // Paper, anchored to world x so the fibres run on across tiles.
  const pat = ctx.createPattern(paperTex(), 'repeat')
  if (pat) {
    ctx.fillStyle = pat
    ctx.fillRect(x0, 0, T, bandH)
  }
  // Age: the long edges of an old scroll darken and foxing freckles the sheet.
  const edge = ctx.createLinearGradient(0, 0, 0, bandH)
  edge.addColorStop(0, 'rgba(120,88,40,0.16)')
  edge.addColorStop(0.08, 'rgba(120,88,40,0)')
  edge.addColorStop(0.92, 'rgba(120,88,40,0)')
  edge.addColorStop(1, 'rgba(120,88,40,0.2)')
  ctx.fillStyle = edge
  ctx.fillRect(x0, 0, T, bandH)
  const fr = rng(index * 7919 + 13)
  for (let i = 0; i < 3; i++) {
    if (fr() < 0.45) continue
    const fx = x0 + fr() * T
    const fy = fr() * bandH
    const rr = 6 + fr() * 26
    const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, rr)
    g.addColorStop(0, 'rgba(150,105,45,0.07)')
    g.addColorStop(1, 'rgba(150,105,45,0)')
    ctx.fillStyle = g
    ctx.fillRect(fx - rr, fy - rr, rr * 2, rr * 2)
  }

  const k = bandH / H_REF
  for (const f of featuresIn(features, x0 - 2, x0 + T + 2)) {
    switch (f.kind) {
      case 'range':
        drawRange(ctx, f, bandH)
        break
      case 'water':
        drawWater(ctx, f.x0, f.x1, f.y * bandH, f.seed, k)
        break
      case 'pine':
        drawPine(ctx, f.x, f.base * bandH, f.h * bandH, f.seed, f.lean, k)
        break
      case 'hut':
        drawHut(ctx, f.x, f.base * bandH, f.seed, k)
        break
      case 'boat':
        drawBoat(ctx, f.x, f.y * bandH, f.seed, k)
        break
      case 'birds':
        drawBirds(ctx, f.x, f.y * bandH, f.seed, k)
        break
    }
  }
}

function drawRange(ctx: Ctx, f: Extract<Feature, { kind: 'range' }>, H: number): void {
  const baseY = f.base * H
  const h = f.h * H
  mountainRange(ctx, f.x, baseY, f.w, h, {
    color: INK.ink,
    alpha: f.alpha,
    seed: f.seed,
    peaks: f.peaks,
    mist: f.layer === 0 ? 0.6 : 0.5,
    detail: f.detail
  })
  if (f.tint) {
    // 青绿 — mineral blue-green laid over the upper slopes, sparingly.
    mountainRange(ctx, f.x, baseY, f.w, h, {
      color: f.tint === 'azurite' ? INK.azurite : INK.malachite,
      alpha: f.layer === 0 ? 0.16 : 0.26,
      seed: f.seed,
      peaks: f.peaks,
      mist: 0.78,
      detail: false
    })
  }
}

function drawWater(ctx: Ctx, x0: number, x1: number, y: number, seed: number, k: number): void {
  const r = rng(seed)
  ctx.save()
  ctx.lineCap = 'round'
  const rows = 6
  for (let i = 0; i < rows; i++) {
    const yy = y + i * 9 * k + (r() - 0.5) * 3
    let x = x0 + r() * 40
    while (x < x1) {
      const len = (24 + r() * 80) * (1 - i * 0.06)
      ctx.strokeStyle = rgba(INK.ink, 0.1 + r() * 0.14)
      ctx.lineWidth = (0.6 + r() * 0.7) * Math.max(0.7, k)
      ctx.beginPath()
      ctx.moveTo(x, yy)
      ctx.quadraticCurveTo(x + len * 0.5, yy - (1 + r() * 2) * k, x + len, yy + (r() - 0.5) * 1.5)
      ctx.stroke()
      x += len + 12 + r() * 60
    }
  }
  ctx.restore()
}

/** 松 — a leaning pine: one confident trunk, a few branches, needle wheels. */
function drawPine(
  ctx: Ctx,
  x: number,
  baseY: number,
  h: number,
  seed: number,
  lean: number,
  k: number
): void {
  const r = rng(seed)
  const top: Pt = { x: x + lean * h * 0.55, y: baseY - h }
  const trunk = smoothPath(
    [
      { x, y: baseY },
      { x: x + lean * h * 0.12 + (r() - 0.5) * 8 * k, y: baseY - h * 0.33 },
      { x: x + lean * h * 0.38 - (r() - 0.5) * 6 * k, y: baseY - h * 0.68 },
      top
    ],
    8
  )
  brushStroke(ctx, trunk, {
    width: Math.max(3, h * 0.05),
    color: INK.ink,
    alpha: 0.82,
    seed,
    dry: 0.6,
    taperIn: 0.02,
    taperOut: 0.55,
    wobble: 0.4
  })
  // bark scales
  ctx.save()
  ctx.strokeStyle = rgba(INK.ink, 0.45)
  ctx.lineWidth = 0.8
  for (let i = 0; i < 6; i++) {
    const p = trunk[Math.floor((0.08 + r() * 0.55) * (trunk.length - 1))]
    ctx.beginPath()
    ctx.ellipse(p.x + (r() - 0.5) * 3, p.y, 2.2 * k + 1, 1.2 * k + 0.6, r() * 0.6, 0, Math.PI)
    ctx.stroke()
  }
  ctx.restore()

  const tiers = 4 + Math.floor(r() * 3)
  for (let t = 0; t < tiers; t++) {
    const f = 0.42 + (t / tiers) * 0.56
    const p = trunk[Math.min(trunk.length - 1, Math.floor(f * (trunk.length - 1)))]
    const side = t % 2 === 0 ? (lean >= 0 ? 1 : -1) : lean >= 0 ? -1 : 1
    const reach = h * (0.14 + r() * 0.16) * (1 - f * 0.35)
    const end: Pt = { x: p.x + side * reach, y: p.y - reach * (0.12 + r() * 0.2) }
    brushStroke(
      ctx,
      smoothPath([p, { x: (p.x + end.x) / 2, y: (p.y + end.y) / 2 + 3 * k }, end], 6),
      {
        width: Math.max(1.4, h * 0.016),
        color: INK.ink,
        alpha: 0.75,
        seed: seed + t * 11,
        dry: 0.5,
        taperIn: 0.05,
        taperOut: 0.6
      }
    )
    // a needle cluster at the branch end: a dark flat wash with radiating needles
    const cx = end.x
    const cy = end.y
    const cr = h * (0.08 + r() * 0.04)
    inkWash(ctx, cx, cy, cr * 1.1, {
      color: INK.ink,
      alpha: 0.3,
      seed: seed + t * 5,
      squash: 0.42,
      bleed: 0.6
    })
    ctx.save()
    ctx.strokeStyle = rgba(INK.ink, 0.62)
    ctx.lineWidth = 0.75 * Math.max(0.8, k)
    ctx.lineCap = 'round'
    const n = 16 + Math.floor(r() * 8)
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i / (n - 1)) * Math.PI + (r() - 0.5) * 0.12
      const len = cr * (0.75 + r() * 0.35)
      const ox = cx + (r() - 0.5) * cr * 0.5
      ctx.beginPath()
      ctx.moveTo(ox, cy + cr * 0.12)
      ctx.lineTo(ox + Math.cos(a) * len, cy + cr * 0.12 + Math.sin(a) * len * 0.62)
      ctx.stroke()
    }
    ctx.restore()
  }
}

/** A thatched pavilion — roof stroke, two posts, a railing. */
function drawHut(ctx: Ctx, x: number, baseY: number, seed: number, k: number): void {
  const r = rng(seed)
  const w = 52 * k
  const h = 34 * k
  const roofY = baseY - h * 0.78
  // a pale wash under the eave
  inkWash(ctx, x, baseY - h * 0.4, w * 0.55, { color: INK.ink, alpha: 0.12, seed, squash: 0.6 })
  brushStroke(
    ctx,
    smoothPath([
      { x: x - w * 0.66, y: roofY + 2 * k },
      { x: x - w * 0.15, y: roofY - h * 0.38 },
      { x: x + w * 0.2, y: roofY - h * 0.4 },
      { x: x + w * 0.68, y: roofY }
    ]),
    { width: 7 * k, color: INK.ink, alpha: 0.85, seed, dry: 0.55, taperIn: 0.08, taperOut: 0.35 }
  )
  for (const px of [-0.42, 0.42]) {
    brushStroke(
      ctx,
      [
        { x: x + w * px, y: roofY + 1 },
        { x: x + w * px + (r() - 0.5) * 2, y: baseY }
      ],
      {
        width: 2 * k,
        color: INK.ink,
        alpha: 0.7,
        seed: seed + 3,
        dry: 0.3,
        taperIn: 0.05,
        taperOut: 0.2
      }
    )
  }
  // railing + floor
  brushStroke(
    ctx,
    [
      { x: x - w * 0.6, y: baseY - h * 0.22 },
      { x: x + w * 0.6, y: baseY - h * 0.2 }
    ],
    { width: 1.4 * k, color: INK.ink, alpha: 0.6, seed: seed + 5, dry: 0.4 }
  )
  brushStroke(
    ctx,
    [
      { x: x - w * 0.75, y: baseY + 1 },
      { x: x + w * 0.8, y: baseY }
    ],
    { width: 2.2 * k, color: INK.ink, alpha: 0.65, seed: seed + 7, dry: 0.5 }
  )
}

/** A fishing skiff: hull, a figure in a straw hat, a pole, ripples. */
function drawBoat(ctx: Ctx, x: number, y: number, seed: number, k: number): void {
  const r = rng(seed)
  const w = (34 + r() * 14) * k
  const dir = r() < 0.5 ? -1 : 1
  brushStroke(
    ctx,
    smoothPath([
      { x: x - w * 0.5 * dir, y: y - 3 * k },
      { x: x - w * 0.1 * dir, y: y + 2.5 * k },
      { x: x + w * 0.5 * dir, y: y - 4 * k }
    ]),
    { width: 4 * k, color: INK.ink, alpha: 0.8, seed, dry: 0.4, taperIn: 0.2, taperOut: 0.35 }
  )
  // figure: body + hat
  const fx = x + w * 0.12 * dir
  brushStroke(
    ctx,
    [
      { x: fx, y: y - 13 * k },
      { x: fx + 0.5 * k, y: y - 2 * k }
    ],
    {
      width: 3.4 * k,
      color: INK.ink,
      alpha: 0.75,
      seed: seed + 1,
      dry: 0.2,
      taperIn: 0.2,
      taperOut: 0.2
    }
  )
  ctx.save()
  ctx.fillStyle = rgba(INK.ink, 0.8)
  ctx.beginPath()
  ctx.moveTo(fx - 5 * k, y - 13 * k)
  ctx.lineTo(fx, y - 17 * k)
  ctx.lineTo(fx + 5 * k, y - 13 * k)
  ctx.closePath()
  ctx.fill()
  // pole
  ctx.strokeStyle = rgba(INK.ink, 0.6)
  ctx.lineWidth = 0.9 * k
  ctx.beginPath()
  ctx.moveTo(fx + 1 * k, y - 10 * k)
  ctx.lineTo(fx + dir * 26 * k, y + 8 * k)
  ctx.stroke()
  // ripples
  ctx.strokeStyle = rgba(INK.ink, 0.22)
  ctx.lineWidth = 0.7
  for (let i = 0; i < 3; i++) {
    const yy = y + (4 + i * 4) * k
    const ww = w * (0.7 + i * 0.25)
    ctx.beginPath()
    ctx.moveTo(x - ww / 2, yy)
    ctx.quadraticCurveTo(x, yy - 1.5, x + ww / 2, yy)
    ctx.stroke()
  }
  ctx.restore()
}

/** A loose skein of birds — two-stroke checkmarks, larger near the leader. */
function drawBirds(ctx: Ctx, x: number, y: number, seed: number, k: number): void {
  const r = rng(seed)
  const n = 3 + Math.floor(r() * 4)
  ctx.save()
  ctx.strokeStyle = rgba(INK.ink, 0.7)
  ctx.lineCap = 'round'
  for (let i = 0; i < n; i++) {
    const bx = x + (i - n / 2) * 16 * k + (r() - 0.5) * 10 * k
    const by = y + Math.abs(i - n / 2) * 4 * k + (r() - 0.5) * 6 * k
    const s = (4 + r() * 3) * k * (i === 0 ? 1.2 : 1)
    const flap = 0.4 + r() * 0.6
    ctx.lineWidth = 1.1 * Math.max(0.8, k)
    ctx.beginPath()
    ctx.moveTo(bx - s, by - s * flap)
    ctx.quadraticCurveTo(bx - s * 0.35, by - s * 0.1, bx, by)
    ctx.quadraticCurveTo(bx + s * 0.4, by - s * 0.2, bx + s * 1.1, by - s * flap * 1.1)
    ctx.stroke()
  }
  ctx.restore()
}
