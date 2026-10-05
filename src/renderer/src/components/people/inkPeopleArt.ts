// 水墨 art assets for the Directory (the 'scroll' card face and the Handscroll
// medium): cached data URLs built on lib/inkArt, plus a tiny composable that
// waits for the calligraphy fonts before carving a seal (a seal drawn with a
// fallback face would otherwise be cached forever).

import { ref, watch, type Ref } from 'vue'
import {
  INK,
  rng,
  hashStr,
  noise1,
  sealDataUrl,
  strokeDataUrl,
  mountainRange,
  brushStroke,
  smoothPath,
  inkWash,
  rgba,
  paperDataUrl,
  inkFontsReady
} from '../../lib/inkArt'

const cache = new Map<string, string>()

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/** Rice paper for painted surfaces (always light — a painting is on paper in
 *  every theme). */
export function paintingPaperUrl(): string {
  return paperDataUrl(256, 256, { tone: INK.paperLight, fiber: 0.6, seed: 23 })
}

/** Slightly warmer, older paper (colophons, the handscroll's end panels). */
export function oldPaperUrl(): string {
  return paperDataUrl(256, 256, { tone: '#ece0c4', fiber: 0.7, seed: 29, age: 0.2 })
}

/**
 * A feathered, ragged ink-wash blob as an alpha mask — portraits fade into
 * the paper the way a wash bleeds, instead of being clipped to a hard circle.
 */
export function washMaskUrl(seed = 1, size = 256): string {
  const key = `wash|${seed}|${size}`
  const hit = cache.get(key)
  if (hit) return hit
  const c = canvas(size, size)
  const ctx = c.getContext('2d') as CanvasRenderingContext2D
  const cx = size / 2
  const R = size * 0.4
  ctx.filter = `blur(${Math.round(size * 0.025)}px)`
  for (let l = 0; l < 5; l++) {
    const nz = noise1(seed * 13 + l * 7)
    const rr = R * (1.06 - l * 0.07)
    ctx.fillStyle = `rgba(0,0,0,${0.22 + l * 0.17})`
    ctx.beginPath()
    for (let i = 0; i <= 90; i++) {
      const a = (i / 90) * Math.PI * 2
      const k = 1 + 0.09 * nz(i * 0.21) + 0.035 * nz(i * 0.8 + 11)
      const x = cx + Math.cos(a) * rr * k
      const y = cx + Math.sin(a) * rr * k * 1.04
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
  }
  const u = c.toDataURL('image/png')
  cache.set(key, u)
  return u
}

/** A soft ink bloom (晕染) — the wash that spreads behind a figure on hover. */
export function bloomUrl(seed = 1, size = 200, color = INK.ink): string {
  const key = `bloom|${seed}|${size}|${color}`
  const hit = cache.get(key)
  if (hit) return hit
  const c = canvas(size, size)
  const ctx = c.getContext('2d') as CanvasRenderingContext2D
  const r = rng(seed)
  const nz = noise1(seed + 5)
  const cx = size / 2
  for (let l = 0; l < 6; l++) {
    const rr = size * (0.44 - l * 0.055)
    const g = ctx.createRadialGradient(cx, cx, rr * 0.2, cx, cx, rr)
    g.addColorStop(0, `rgba(28,26,23,${0.1 + l * 0.04})`)
    g.addColorStop(1, 'rgba(28,26,23,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    const ph = r() * 9
    for (let i = 0; i <= 60; i++) {
      const a = (i / 60) * Math.PI * 2
      const k = 1 + 0.16 * nz(i * 0.33 + ph)
      const x = cx + Math.cos(a) * rr * k
      const y = cx + Math.sin(a) * rr * k * 0.92
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
  }
  const u = c.toDataURL('image/png')
  cache.set(key, u)
  return u
}

/** One of a handful of seeded ensō circles (圆相), in ink. */
export function ensoUrl(seed = 1): string {
  return strokeDataUrl('enso', { seed: 30 + (seed % 5), w: 240, h: 240 })
}

/**
 * One of six small misty landscapes for card paintings (transparent PNG), in
 * the Southern Song "one-corner" manner (边角): a near hill weighted into one
 * lower corner, a pale far peak across the water, the rest left as mist.
 */
export function miniLandscapeUrl(seed = 0): string {
  const v = seed % 6
  const key = `miniland|${v}`
  const hit = cache.get(key)
  if (hit) return hit
  const W = 320
  const H = 170
  const c = canvas(W, H)
  const ctx = c.getContext('2d') as CanvasRenderingContext2D
  const r = rng(90 + v * 17)
  const left = v % 2 === 0
  // far peaks across the water — pale, on the open side
  const fx = left ? W * (0.42 + r() * 0.1) : W * (0.02 + r() * 0.1)
  mountainRange(ctx, fx, H * 0.78, W * 0.55, H * (0.36 + r() * 0.16), {
    color: INK.ink,
    alpha: 0.13,
    seed: 300 + v,
    peaks: 2 + Math.floor(r() * 2),
    mist: 0.7,
    detail: false
  })
  if (v % 3 === 1) {
    mountainRange(ctx, fx + W * 0.05, H * 0.78, W * 0.4, H * 0.3, {
      color: INK.azurite,
      alpha: 0.12,
      seed: 330 + v,
      peaks: 2,
      mist: 0.8,
      detail: false
    })
  }
  // the near hill in one corner, with texture strokes
  const nx = left ? -W * 0.08 : W * 0.5
  mountainRange(ctx, nx, H * 1.02, W * 0.58, H * (0.42 + r() * 0.14), {
    color: INK.ink,
    alpha: 0.42,
    seed: 360 + v,
    peaks: 2,
    mist: 0.4,
    detail: true
  })
  // water lines on the open side
  ctx.strokeStyle = 'rgba(28,26,23,0.2)'
  ctx.lineCap = 'round'
  for (let i = 0; i < 5; i++) {
    const y = H * (0.84 + i * 0.035)
    const x0 = left ? W * (0.5 + r() * 0.2) : W * (0.05 + r() * 0.15)
    const len = W * (0.12 + r() * 0.18)
    ctx.lineWidth = 0.7 + r() * 0.5
    ctx.beginPath()
    ctx.moveTo(x0, y)
    ctx.quadraticCurveTo(x0 + len / 2, y - 1.5, x0 + len, y + 0.5)
    ctx.stroke()
  }
  const u = c.toDataURL('image/png')
  cache.set(key, u)
  return u
}

/** A short dry brush mark (for dividers / ground lines). */
export function brushDabUrl(seed = 1): string {
  return strokeDataUrl('divider', { seed: 50 + (seed % 4), w: 420, h: 24 })
}

// ── Seals ─────────────────────────────────────────────────────────────────────

const fontsReady = ref(false)
let asked = false
/** Reactive flag: true once the calligraphy faces are ready for canvas use. */
export function useInkFontsReady(): Ref<boolean> {
  askFonts()
  return fontsReady
}
function askFonts(): void {
  if (asked) return
  asked = true
  inkFontsReady().then(() => (fontsReady.value = true))
}

/** A person's name seal: CJK characters from the name, else initials;
 *  mostly 白文 (red ground) with the odd 朱文, seeded by id. */
export function personSealUrl(name: string, id: string, size = 72): string {
  const h = hashStr(id || name || '印')
  return sealDataUrl(name || '印', { size, mode: h % 4 === 0 ? 'yang' : 'yin', seed: h })
}

/** Reactive seal URL that is only carved once the ink fonts have loaded. */
export function useInkSeal(name: () => string, id: () => string, size = 72): Ref<string> {
  askFonts()
  const url = ref('')
  watch(
    [fontsReady, name, id],
    ([ready, n, i]) => {
      url.value = ready ? personSealUrl(n as string, i as string, size) : ''
    },
    { immediate: true }
  )
  return url
}

/** Fixed (non-person) seals, e.g. the handscroll's title and end seals. */
export function useFixedSeal(
  text: string,
  opts: { size?: number; mode?: 'yin' | 'yang'; seed?: number; round?: boolean } = {}
): Ref<string> {
  askFonts()
  const url = ref('')
  watch(
    fontsReady,
    (ready) => {
      url.value = ready ? sealDataUrl(text, { size: 96, ...opts }) : ''
    },
    { immediate: true }
  )
  return url
}

/** Latin names sit sideways in a vertical column; CJK stays upright. */
export function isCjkName(name: string | undefined): boolean {
  return /^[\s㐀-鿿豈-﫿·・]+$/.test((name || '').trim())
}

// ── 团扇 moon-fan motifs ──────────────────────────────────────────────────────

/** The four classic fan subjects, painted once each (transparent PNG):
 *  0 plum blossom 梅 · 1 bamboo 竹 · 2 orchid 兰 · 3 moon over hills 月. */
export const FAN_MOTIFS = 4

export function fanMotifUrl(variant = 0): string {
  const v = ((variant % FAN_MOTIFS) + FAN_MOTIFS) % FAN_MOTIFS
  const key = `fan|${v}`
  const hit = cache.get(key)
  if (hit) return hit
  const S = 360
  const c = canvas(S, S)
  const ctx = c.getContext('2d') as CanvasRenderingContext2D
  const r = rng(700 + v * 31)
  if (v === 0) paintPlum(ctx, S, r)
  else if (v === 1) paintBamboo(ctx, S, r)
  else if (v === 2) paintOrchid(ctx, S, r)
  else paintMoon(ctx, S, r)
  const u = c.toDataURL('image/png')
  cache.set(key, u)
  return u
}

type Ctx2 = CanvasRenderingContext2D

function paintPlum(ctx: Ctx2, S: number, r: () => number): void {
  // an old branch entering from the upper right, a younger shoot off it
  const main = smoothPath([
    { x: S * 1.02, y: S * 0.12 },
    { x: S * 0.78, y: S * 0.2 },
    { x: S * 0.62, y: S * 0.17 },
    { x: S * 0.46, y: S * 0.3 }
  ])
  brushStroke(ctx, main, {
    width: 15,
    color: INK.ink,
    alpha: 0.9,
    seed: 3,
    dry: 0.75,
    taperIn: 0.02,
    taperOut: 0.5,
    wobble: 0.6
  })
  const shoot = smoothPath([
    { x: S * 0.7, y: S * 0.19 },
    { x: S * 0.66, y: S * 0.32 },
    { x: S * 0.7, y: S * 0.44 }
  ])
  brushStroke(ctx, shoot, {
    width: 6,
    color: INK.ink,
    alpha: 0.85,
    seed: 5,
    dry: 0.5,
    taperIn: 0.05,
    taperOut: 0.7
  })
  const twig = [
    { x: S * 0.55, y: S * 0.24 },
    { x: S * 0.5, y: S * 0.13 }
  ]
  brushStroke(ctx, twig, {
    width: 4,
    color: INK.ink,
    alpha: 0.8,
    seed: 7,
    dry: 0.4,
    taperIn: 0.1,
    taperOut: 0.8
  })
  const blossoms = [
    [0.47, 0.31, 1],
    [0.58, 0.2, 0.85],
    [0.69, 0.43, 0.9],
    [0.5, 0.12, 0.7],
    [0.8, 0.22, 0.75],
    [0.64, 0.33, 0.6]
  ]
  for (const [bx, by, s] of blossoms) {
    const cx = bx * S
    const cy = by * S
    const R = 11 * s
    inkWash(ctx, cx, cy, R * 1.5, {
      color: INK.cinnabar,
      alpha: 0.32,
      seed: Math.floor(cx),
      bleed: 0.4
    })
    ctx.strokeStyle = rgba(INK.ink, 0.6)
    ctx.lineWidth = 1.1
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + r()
      ctx.beginPath()
      ctx.arc(cx + Math.cos(a) * R * 0.62, cy + Math.sin(a) * R * 0.62, R * 0.46, a + 0.9, a + 5.3)
      ctx.stroke()
    }
    ctx.fillStyle = rgba(INK.ink, 0.85)
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + r()
      ctx.beginPath()
      ctx.arc(cx + Math.cos(a) * R * 0.32, cy + Math.sin(a) * R * 0.32, 1.1, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // buds
  ctx.fillStyle = rgba(INK.cinnabarDeep, 0.75)
  for (let i = 0; i < 5; i++) {
    const p = main[Math.floor((0.3 + r() * 0.65) * (main.length - 1))]
    ctx.beginPath()
    ctx.ellipse(p.x + (r() - 0.5) * 10, p.y - 6 - r() * 6, 2.6, 3.4, r(), 0, Math.PI * 2)
    ctx.fill()
  }
}

function paintBamboo(ctx: Ctx2, S: number, r: () => number): void {
  // two culms rising from the lower right, leaves dropping from the upper one
  for (const [x0, w, a] of [
    [0.82, 12, 0.8],
    [0.7, 8, 0.45]
  ] as const) {
    let y = S * 1.02
    let x = x0 * S
    for (let seg = 0; seg < 6; seg++) {
      const len = S * (0.13 + r() * 0.04)
      const nx = x - 2 - r() * 3
      brushStroke(
        ctx,
        [
          { x, y },
          { x: nx, y: y - len + 4 }
        ],
        {
          width: w,
          color: INK.ink,
          alpha: a,
          seed: seg + Math.floor(x),
          dry: 0.35,
          taperIn: 0.04,
          taperOut: 0.06,
          wobble: 0.1
        }
      )
      ctx.strokeStyle = rgba(INK.ink, a)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(nx - w * 0.6, y - len + 3)
      ctx.quadraticCurveTo(nx, y - len + 6, nx + w * 0.6, y - len + 3)
      ctx.stroke()
      x = nx
      y -= len
    }
  }
  const leaf = (x: number, y: number, ang: number, len: number, a: number, seed: number) =>
    brushStroke(
      ctx,
      smoothPath([
        { x, y },
        { x: x + Math.cos(ang) * len * 0.5, y: y + Math.sin(ang) * len * 0.5 + 3 },
        { x: x + Math.cos(ang) * len, y: y + Math.sin(ang) * len }
      ]),
      { width: 10, color: INK.ink, alpha: a, seed, dry: 0.15, taperIn: 0.12, taperOut: 0.85 }
    )
  const clusters = [
    [0.78, 0.36],
    [0.66, 0.52],
    [0.8, 0.62]
  ]
  clusters.forEach(([cx, cy], ci) => {
    for (let i = 0; i < 4; i++) {
      const ang = Math.PI * (0.55 + i * 0.16 + (r() - 0.5) * 0.1)
      leaf(cx * S, cy * S, ang, S * (0.14 + r() * 0.08), ci === 1 ? 0.5 : 0.85, ci * 10 + i)
    }
  })
}

function paintOrchid(ctx: Ctx2, S: number, r: () => number): void {
  const base = { x: S * 0.72, y: S * 0.86 }
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * (0.2 + i * 0.1 + (r() - 0.5) * 0.05)
    const len = S * (0.35 + r() * 0.25)
    const bend = (r() - 0.3) * 0.9
    const pts = smoothPath([
      base,
      { x: base.x + Math.cos(a) * len * 0.4, y: base.y + Math.sin(a) * len * 0.45 },
      {
        x: base.x + Math.cos(a + bend * 0.5) * len * 0.75,
        y: base.y + Math.sin(a + bend * 0.5) * len * 0.72
      },
      { x: base.x + Math.cos(a + bend) * len, y: base.y + Math.sin(a + bend) * len * 0.8 }
    ])
    brushStroke(ctx, pts, {
      width: 5.5,
      color: INK.ink,
      alpha: 0.85,
      seed: 40 + i,
      dry: 0.2,
      taperIn: 0.05,
      taperOut: 0.6,
      wobble: 0.7
    })
  }
  // two flowers on a slender stem
  brushStroke(ctx, smoothPath([base, { x: S * 0.6, y: S * 0.6 }, { x: S * 0.52, y: S * 0.42 }]), {
    width: 2,
    color: INK.ink,
    alpha: 0.6,
    seed: 61,
    dry: 0.3
  })
  for (const [fx, fy] of [
    [0.52, 0.42],
    [0.58, 0.56]
  ]) {
    for (let k = 0; k < 4; k++) {
      const a = -Math.PI / 2 + (k - 1.5) * 0.7
      brushStroke(
        ctx,
        [
          { x: fx * S, y: fy * S },
          { x: fx * S + Math.cos(a) * 16, y: fy * S + Math.sin(a) * 16 }
        ],
        {
          width: 6,
          color: INK.ink,
          alpha: 0.45,
          seed: 70 + k,
          dry: 0.1,
          taperIn: 0.3,
          taperOut: 0.7
        }
      )
    }
    ctx.fillStyle = rgba(INK.ink, 0.9)
    ctx.beginPath()
    ctx.arc(fx * S, fy * S - 2, 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

function paintMoon(ctx: Ctx2, S: number, r: () => number): void {
  // a pale moon in a washed sky, hills dissolving into mist below
  const mx = S * 0.68
  const my = S * 0.3
  const g = ctx.createRadialGradient(mx, my, S * 0.05, mx, my, S * 0.36)
  g.addColorStop(0, 'rgba(60,70,85,0)')
  g.addColorStop(0.32, 'rgba(60,70,85,0.02)')
  g.addColorStop(0.36, 'rgba(60,70,85,0.12)')
  g.addColorStop(1, 'rgba(60,70,85,0.02)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S * 0.75)
  mountainRange(ctx, -S * 0.1, S * 0.82, S * 0.8, S * 0.3, {
    color: INK.ink,
    alpha: 0.16,
    seed: 81,
    peaks: 3,
    mist: 0.7,
    detail: false
  })
  mountainRange(ctx, S * 0.35, S * 0.96, S * 0.8, S * 0.3, {
    color: INK.ink,
    alpha: 0.4,
    seed: 83,
    peaks: 2,
    mist: 0.45,
    detail: true
  })
  mountainRange(ctx, S * 0.4, S * 0.96, S * 0.6, S * 0.22, {
    color: INK.azurite,
    alpha: 0.18,
    seed: 83,
    peaks: 2,
    mist: 0.8,
    detail: false
  })
  void r
}
