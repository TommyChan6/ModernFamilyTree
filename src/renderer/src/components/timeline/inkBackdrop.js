// 水墨 — cached Canvas-2D assets for the Timeline's ink look: a seamlessly
// tiling misty mountain strip (parallaxed along the bottom), brushed rules for
// the year grid / "now" line, a hand-drawn ensō for the selection ring, and
// seal impressions for the avatar pins. Everything is generated once with the
// shared inkArt primitives and reused on every redraw (brushStroke is costly).
import {
  INK,
  rng,
  mountainRange,
  brushStroke,
  smoothPath,
  sealCanvas,
  sealChars,
  hashStr
} from '../../lib/inkArt'

const cache = new Map()
function memo(key, make) {
  let v = cache.get(key)
  if (!v) cache.set(key, (v = make()))
  return v
}

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

/**
 * A horizontally tiling band of mountains, foot fading into transparent mist.
 * Ranges that cross the right edge are also drawn shifted by −w (and vice
 * versa), so tile n and n+1 meet without a seam.
 */
export function mountainStrip({
  w = 1600,
  h = 200,
  seed = 3,
  color = INK.ink,
  alpha = 0.4,
  detail = true,
  n = 5
} = {}) {
  return memo(`strip|${w}|${h}|${seed}|${color}|${alpha}|${detail}|${n}`, () => {
    const c = canvas(w, h)
    const ctx = c.getContext('2d')
    const r = rng(seed)
    let x = -w * 0.08
    let i = 0
    while (x < w * 0.98) {
      const ww = w * (0.18 + r() * 0.2) * (5 / n)
      const hh = h * (0.5 + r() * 0.48)
      const opts = {
        color,
        alpha: alpha * (0.75 + r() * 0.35),
        seed: seed * 97 + i * 13,
        peaks: 2 + Math.floor(r() * 3),
        mist: 0.6,
        detail
      }
      const offs = [0]
      if (x + ww > w) offs.push(-w)
      if (x < 0) offs.push(w)
      for (const ox of offs) mountainRange(ctx, x + ox, h, ww, hh, opts)
      x += ww * (0.5 + r() * 0.35)
      i++
    }
    return c
  })
}

/** A long brushed rule, drawn in `color` (horizontal; rotate for vertical). */
export function brushRule({ w = 1400, h = 14, seed = 5, color = INK.ink, dry = 0.55 } = {}) {
  return memo(`rule|${w}|${h}|${seed}|${color}|${dry}`, () => {
    const c = canvas(w, h)
    const ctx = c.getContext('2d')
    const r = rng(seed)
    const mid = h / 2
    const thick = h * 0.42
    brushStroke(
      ctx,
      smoothPath([
        { x: h * 0.4, y: mid + (r() - 0.5) * 1.5 },
        { x: w * 0.33, y: mid + (r() - 0.5) * 2 },
        { x: w * 0.66, y: mid + (r() - 0.5) * 2 },
        { x: w - h * 0.4, y: mid + (r() - 0.5) * 1.5 }
      ]),
      { width: thick, color, seed, dry, taperIn: 0.02, taperOut: 0.12, wobble: 0.35 }
    )
    return c
  })
}

/** 円相 — a single-breath circle, slightly open, for the selection ring. */
export function ensoRing({ size = 96, seed = 4, color = INK.ink } = {}) {
  return memo(`enso|${size}|${seed}|${color}`, () => {
    const c = canvas(size, size)
    const ctx = c.getContext('2d')
    const R = size * 0.4
    const pts = []
    const start = -Math.PI * 0.6
    const sweep = Math.PI * 1.84
    for (let i = 0; i <= 72; i++) {
      const a = start + (i / 72) * sweep
      const rr = R * (1 + 0.03 * Math.sin(i * 0.31 + seed))
      pts.push({ x: size / 2 + Math.cos(a) * rr, y: size / 2 + Math.sin(a) * rr })
    }
    brushStroke(ctx, pts, {
      width: size * 0.07,
      color,
      seed,
      dry: 0.6,
      taperIn: 0.04,
      taperOut: 0.3
    })
    return c
  })
}

/** A round cinnabar seal (白文: characters cut out of the red) for a name.
 *  Keyed by the seal characters, so people sharing initials share a canvas. */
export function personSeal(name, { size = 72, color = INK.cinnabar } = {}) {
  const chars = sealChars(name || '')
  return memo(`seal|${chars}|${size}|${color}`, () =>
    sealCanvas(chars, { size, color, mode: 'yin', round: true, seed: hashStr(chars) })
  )
}

/** Deterministic small rotation (radians) for a hand-stamped seal. */
export function sealTilt(id) {
  return (((hashStr(String(id)) % 1000) / 1000) * 2 - 1) * 0.08
}

/** Stable per-id float in [0, 100) for shader texture seeds. */
export function inkSeed(id) {
  return (hashStr(String(id)) % 100000) / 1000
}
