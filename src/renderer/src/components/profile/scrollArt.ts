// 卷 — the painted parts of the handscroll profile, built on lib/inkArt's
// primitives. Everything is seeded (a person's painting is always the same
// painting) and cached, so re-opening a profile costs nothing.

import {
  INK,
  rng,
  rgba,
  brushStroke,
  smoothPath,
  inkWash,
  mountainRange,
  type Pt
} from '../../lib/inkArt'

type Ctx = CanvasRenderingContext2D

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

const urlCache = new Map<string, string>()
function cached(key: string, make: () => HTMLCanvasElement): string {
  let u = urlCache.get(key)
  if (!u) {
    u = make().toDataURL('image/png')
    urlCache.set(key, u)
  }
  return u
}

/**
 * A 山水 handscroll landscape painted into `ctx` across `w`×`h`: pale indigo
 * far ranges, grey middle hills drowned in cloud belts, two or three near
 * peaks with texture strokes and pines, a river with a lone boat, a few
 * birds — and the space above left empty (留白). A touch of 青绿 mineral
 * colour on one peak; never more.
 */
export function paintLandscape(ctx: Ctx, w: number, h: number, seed: number): void {
  const r = rng(seed)
  ctx.clearRect(0, 0, w, h)

  // far ranges — pale indigo, no detail, high up in the mist
  let x = -w * 0.04
  let k = 0
  while (x < w) {
    const ww = w * (0.16 + r() * 0.16)
    mountainRange(ctx, x, h * 0.62, ww, h * (0.32 + r() * 0.2), {
      color: INK.indigo,
      alpha: 0.13 + r() * 0.05,
      seed: seed + 11 + k * 31,
      peaks: 2 + Math.floor(r() * 3),
      mist: 0.7,
      detail: false
    })
    x += ww * (0.55 + r() * 0.35)
    k++
  }

  // cloud belt swallowing the feet of the far range
  mistBand(ctx, w, h * 0.6, h * 0.12, r)

  // middle hills — warm grey wash
  x = -w * 0.06
  k = 0
  while (x < w) {
    const ww = w * (0.12 + r() * 0.14)
    mountainRange(ctx, x, h * 0.8, ww, h * (0.22 + r() * 0.18), {
      color: INK.wash,
      alpha: 0.2 + r() * 0.08,
      seed: seed + 400 + k * 17,
      peaks: 1 + Math.floor(r() * 3),
      mist: 0.65,
      detail: false
    })
    x += ww * (0.7 + r() * 0.5)
    k++
  }
  mistBand(ctx, w, h * 0.79, h * 0.1, r)

  // near peaks — the painting's anchors, spaced so content leaves sit between
  const anchors = [0.04 + r() * 0.08, 0.42 + r() * 0.12, 0.8 + r() * 0.12]
  const greenAt = Math.floor(r() * anchors.length)
  anchors.forEach((u, i) => {
    const ww = w * (0.15 + r() * 0.08)
    const hh = h * (0.4 + r() * 0.2)
    const px = w * u - ww / 2
    mountainRange(ctx, px, h * 1.02, ww, hh, {
      color: INK.ink2,
      alpha: 0.4 + r() * 0.12,
      seed: seed + 900 + i * 53,
      peaks: 3 + Math.floor(r() * 2),
      mist: 0.55,
      detail: true
    })
    // 青绿 — one peak carries a breath of malachite / azurite on its crown
    if (i === greenAt) {
      inkWash(ctx, px + ww * 0.5, h * 1.02 - hh * 0.7, ww * 0.26, {
        color: INK.malachite,
        alpha: 0.2,
        seed: seed + 5,
        squash: 0.8
      })
      inkWash(ctx, px + ww * 0.44, h * 1.02 - hh * 0.84, ww * 0.14, {
        color: INK.azurite,
        alpha: 0.16,
        seed: seed + 6,
        squash: 0.7
      })
    }
    // a stand of trees on the shoulder of the slope
    const tx = px + ww * (0.22 + r() * 0.2)
    trees(ctx, tx, h * 1.02 - hh * (0.32 + r() * 0.12), h * 0.045, seed + i * 7)
  })

  // river ripples + a lone boat in the open water between two near peaks
  const riverY = h * 0.9
  for (let i = 0; i < 9; i++) {
    const rx = w * (0.15 + r() * 0.7)
    const len = w * (0.02 + r() * 0.05)
    brushStroke(
      ctx,
      [
        { x: rx, y: riverY + r() * h * 0.06 },
        { x: rx + len, y: riverY + r() * h * 0.06 }
      ],
      { width: 1.4, color: INK.wash, alpha: 0.35, seed: seed + 70 + i, dry: 0.7, taperOut: 0.6 }
    )
  }
  boat(ctx, w * (0.24 + r() * 0.12), riverY - 2, h * 0.035, seed)

  // birds — two or three ticks of the brush high in the empty sky
  const flock = 2 + Math.floor(r() * 3)
  const bx = w * (0.55 + r() * 0.3)
  const by = h * (0.12 + r() * 0.12)
  for (let i = 0; i < flock; i++) {
    const s = h * (0.012 + r() * 0.008)
    const cx = bx + i * s * 4.5 + r() * s * 3
    const cy = by + (r() - 0.5) * s * 5
    brushStroke(
      ctx,
      smoothPath([
        { x: cx - s * 1.6, y: cy - s * 0.4 },
        { x: cx - s * 0.5, y: cy - s * 0.1 },
        { x: cx, y: cy + s * 0.35 }
      ]),
      {
        width: 1.6,
        color: INK.ink,
        alpha: 0.6,
        seed: seed + 300 + i,
        dry: 0.2,
        taperIn: 0.3,
        taperOut: 0.5
      }
    )
    brushStroke(
      ctx,
      smoothPath([
        { x: cx, y: cy + s * 0.35 },
        { x: cx + s * 0.6, y: cy - s * 0.2 },
        { x: cx + s * 1.7, y: cy - s * 0.6 }
      ]),
      {
        width: 1.6,
        color: INK.ink,
        alpha: 0.6,
        seed: seed + 320 + i,
        dry: 0.2,
        taperIn: 0.2,
        taperOut: 0.6
      }
    )
  }
}

function mistBand(ctx: Ctx, w: number, y: number, hh: number, r: () => number): void {
  ctx.save()
  for (let i = 0; i < 7; i++) {
    const cx = w * (i / 6) + (r() - 0.5) * w * 0.1
    const rad = w * (0.12 + r() * 0.1)
    const g = ctx.createRadialGradient(cx, y, 0, cx, y, rad)
    g.addColorStop(0, rgba(INK.paper, 0.85))
    g.addColorStop(1, rgba(INK.paper, 0))
    ctx.fillStyle = g
    ctx.setTransform(1, 0, 0, hh / rad, 0, y - (y * hh) / rad)
    ctx.fillRect(cx - rad, y - rad, rad * 2, rad * 2)
  }
  ctx.restore()
}

/** A stand of 点叶 trees: thin crooked trunks under clouds of leaf dots —
 *  the dotted foliage of a Song/Yuan landscape, not a cartoon pine. */
function trees(ctx: Ctx, x: number, y: number, s: number, seed: number): void {
  const r = rng(seed)
  const n = 2 + Math.floor(r() * 3)
  ctx.save()
  for (let i = 0; i < n; i++) {
    const tx = x + i * s * 0.75 + (r() - 0.5) * s * 0.3
    const ty = y + (r() - 0.5) * s * 0.3
    const th = s * (1.2 + r() * 0.7)
    const lean = (r() - 0.5) * s * 0.5
    brushStroke(
      ctx,
      smoothPath([
        { x: tx, y: ty },
        { x: tx + lean * 0.4 + (r() - 0.5) * s * 0.15, y: ty - th * 0.5 },
        { x: tx + lean, y: ty - th }
      ]),
      {
        width: Math.max(1, s * 0.08),
        color: INK.ink,
        alpha: 0.75,
        seed: seed + i,
        dry: 0.25,
        taperIn: 0.05,
        taperOut: 0.5
      }
    )
    // foliage: overlapping dot clusters, darker in the core
    const cx = tx + lean
    const cy = ty - th * 0.92
    const dots = 22 + Math.floor(r() * 12)
    for (let d = 0; d < dots; d++) {
      const a = r() * Math.PI * 2
      const rr = Math.sqrt(r()) * s * 0.55
      const dx = cx + Math.cos(a) * rr * 1.2
      const dy = cy + Math.sin(a) * rr * 0.75
      const ds = s * (0.05 + r() * 0.06)
      ctx.fillStyle = rgba(INK.ink, 0.35 + (1 - rr / (s * 0.55)) * 0.45)
      ctx.beginPath()
      ctx.ellipse(dx, dy, ds * 1.5, ds, -0.3 + r() * 0.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

/** 一叶扁舟 — a sliver of a boat, a fisherman in a rain hat, his pole. */
function boat(ctx: Ctx, x: number, y: number, s: number, seed: number): void {
  brushStroke(
    ctx,
    smoothPath([
      { x: x - s * 2.1, y: y - s * 0.35 },
      { x: x - s * 0.6, y: y + s * 0.12 },
      { x: x + s * 1.0, y: y + s * 0.1 },
      { x: x + s * 2.2, y: y - s * 0.45 }
    ]),
    {
      width: s * 0.22,
      color: INK.ink,
      alpha: 0.8,
      seed: seed + 900,
      dry: 0.3,
      taperIn: 0.25,
      taperOut: 0.3
    }
  )
  ctx.save()
  ctx.fillStyle = rgba(INK.ink, 0.72)
  // seated body
  ctx.beginPath()
  ctx.ellipse(x - s * 0.15, y - s * 0.35, s * 0.2, s * 0.32, 0.15, 0, Math.PI * 2)
  ctx.fill()
  // conical hat (斗笠)
  ctx.beginPath()
  ctx.moveTo(x - s * 0.6, y - s * 0.62)
  ctx.lineTo(x - s * 0.12, y - s * 0.98)
  ctx.lineTo(x + s * 0.34, y - s * 0.6)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  // the pole, angled into the water
  brushStroke(
    ctx,
    [
      { x: x + s * 0.1, y: y - s * 0.5 },
      { x: x + s * 2.6, y: y - s * 2.3 }
    ],
    { width: 1.1, color: INK.ink, alpha: 0.6, seed: seed + 901, dry: 0.4, taperOut: 0.6 }
  )
  // its wake
  brushStroke(
    ctx,
    [
      { x: x - s * 3.6, y: y + s * 0.3 },
      { x: x - s * 2.2, y: y + s * 0.2 }
    ],
    { width: 1, color: INK.wash, alpha: 0.5, seed: seed + 902, dry: 0.6, taperIn: 0.6 }
  )
}

/** Paint the landscape at most once per (seed, size bucket); returns a canvas
 *  the caller can blit or show. Sizes snap to 64px so resizes reuse work. */
const landCache = new Map<string, HTMLCanvasElement>()
export function landscapeCanvas(w: number, h: number, seed: number): HTMLCanvasElement {
  const W = Math.max(256, Math.ceil(w / 64) * 64)
  const H = Math.max(128, Math.ceil(h / 64) * 64)
  const key = `${W}x${H}|${seed}`
  const hit = landCache.get(key)
  if (hit) return hit
  const c = canvas(W, H)
  paintLandscape(c.getContext('2d') as Ctx, W, H, seed)
  if (landCache.size > 12) landCache.delete(landCache.keys().next().value as string)
  landCache.set(key, c)
  return c
}

/** The ensō (円相) that rings the portrait — one dry breath of ink, left a
 *  little open. Starts at `ENSO_START_DEG` (CSS conic angle: 0 = 12 o'clock,
 *  clockwise) so a conic mask can draw it in along the stroke. */
export const ENSO_START_DEG = -14
export function ensoUrl(seed: number, size = 480): string {
  return cached(`enso|${seed}|${size}`, () => {
    const c = canvas(size, size)
    const ctx = c.getContext('2d') as Ctx
    const r = rng(seed)
    const cx = size / 2
    const cy = size / 2
    const R = size * 0.4
    // canvas angle 0 = 3 o'clock; CSS conic 0 = 12 o'clock
    const a0 = ((ENSO_START_DEG - 90) * Math.PI) / 180
    const sweep = Math.PI * (1.8 + r() * 0.08)
    const pts: Pt[] = []
    for (let i = 0; i <= 96; i++) {
      const t = i / 96
      const a = a0 + t * sweep
      // the brush drifts outward a touch as the wrist comes round
      const rr = R * (1 + 0.025 * Math.sin(t * 7 + seed) + t * 0.035)
      pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr })
    }
    // a wet ghost under the dry stroke — ink that bled into the paper
    brushStroke(ctx, pts, {
      width: size * 0.1,
      color: INK.wash,
      alpha: 0.22,
      seed: seed + 1,
      dry: 0.2,
      taperIn: 0.04,
      taperOut: 0.2
    })
    brushStroke(ctx, pts, {
      width: size * 0.064,
      color: INK.ink,
      alpha: 0.92,
      seed,
      dry: 0.62,
      taperIn: 0.03,
      taperOut: 0.28,
      wobble: 0.4
    })
    return c
  })
}

/** A tall dry brush stroke dividing two album leaves. */
export function vDividerUrl(seed: number, h = 640): string {
  return cached(`vdiv|${seed}|${h}`, () => {
    const w = 36
    const c = canvas(w, h)
    const ctx = c.getContext('2d') as Ctx
    const r = rng(seed)
    brushStroke(
      ctx,
      smoothPath([
        { x: w / 2 + 2, y: h * 0.02 },
        { x: w / 2 + (r() - 0.5) * 6, y: h * 0.35 },
        { x: w / 2 + (r() - 0.5) * 6, y: h * 0.7 },
        { x: w / 2 - 2, y: h * 0.98 }
      ]),
      { width: 7, color: INK.ink, seed, dry: 0.7, taperIn: 0.05, taperOut: 0.45 }
    )
    return c
  })
}

/** A horizontal brush rule (section underline / slider track). */
export function hStrokeUrl(seed: number, w = 520, h = 30, dry = 0.55): string {
  return cached(`hst|${seed}|${w}|${h}|${dry}`, () => {
    const c = canvas(w, h)
    const ctx = c.getContext('2d') as Ctx
    const r = rng(seed)
    brushStroke(
      ctx,
      smoothPath([
        { x: h * 0.3, y: h * 0.56 },
        { x: w * 0.35, y: h * 0.46 + (r() - 0.5) * 3 },
        { x: w * 0.7, y: h * 0.52 + (r() - 0.5) * 3 },
        { x: w - h * 0.3, y: h * 0.42 }
      ]),
      { width: h * 0.5, color: INK.ink, seed, dry, taperIn: 0.05, taperOut: 0.3 }
    )
    return c
  })
}

/** A soft wash blot — the pooled ink behind a monogram. */
export function washUrl(seed: number, size = 360): string {
  return cached(`wash|${seed}|${size}`, () => {
    const c = canvas(size, size)
    const ctx = c.getContext('2d') as Ctx
    inkWash(ctx, size / 2, size / 2, size * 0.42, { color: INK.wash, alpha: 0.5, seed, bleed: 0.8 })
    inkWash(ctx, size * 0.56, size * 0.46, size * 0.22, {
      color: INK.ink2,
      alpha: 0.35,
      seed: seed + 3,
      bleed: 0.6
    })
    return c
  })
}
