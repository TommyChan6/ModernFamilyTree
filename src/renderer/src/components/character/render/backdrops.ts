// Stage backdrops for the Character view (and the photo-mode cards / framed
// portraits). Each painter fills a device-space box. Particles are STATELESS
// — every mote's position is a pure function of (index, time) — so there's no
// simulation to tick, a still render (t = 0) is deterministic, and a frame
// allocates nothing. Soft glows are one cached sprite drawn with drawImage
// (no per-frame gradients, no filters).

export interface BackdropDef {
  id: string
  icon: string
  /** Ground-shadow tint under the figure. */
  floor: string
}

export const BACKDROPS: BackdropDef[] = [
  { id: 'studio', icon: '💡', floor: 'accent' },
  { id: 'sunset', icon: '🌅', floor: '#5a2d4a' },
  { id: 'night', icon: '🌙', floor: '#0a0f24' },
  { id: 'sakura', icon: '🌸', floor: '#c97a9a' },
  { id: 'forest', icon: '🌲', floor: '#10261c' },
  { id: 'arcade', icon: '🕹', floor: '#ff3ea5' },
  { id: 'paper', icon: '📄', floor: '#8a7f6a' },
  { id: 'none', icon: '⬚', floor: 'accent' }
]

export interface BackdropOptions {
  /** Theme accent (#rrggbb) — studio lighting. */
  accent: string
  /** Theme base background — studio / none. */
  base: string
  /** false = no particles/motion (reduced motion, thumbnails). */
  motion?: boolean
}

// ── helpers ───────────────────────────────────────────────────────────────────
const hash = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

let glowSprite: HTMLCanvasElement | null = null
/** A 64px white radial falloff, tinted at draw time via globalAlpha + fill. */
function glow(): HTMLCanvasElement {
  if (glowSprite) return glowSprite
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d') as CanvasRenderingContext2D
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  rg.addColorStop(0, 'rgba(255,255,255,1)')
  rg.addColorStop(0.35, 'rgba(255,255,255,0.45)')
  rg.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = rg
  g.fillRect(0, 0, 64, 64)
  glowSprite = c
  return c
}

// Tinted glow sprites, one per color (lazily built, tiny).
const tinted = new Map<string, HTMLCanvasElement>()
function glowOf(color: string): HTMLCanvasElement {
  let c = tinted.get(color)
  if (c) return c
  c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d') as CanvasRenderingContext2D
  g.drawImage(glow(), 0, 0)
  g.globalCompositeOperation = 'source-in'
  g.fillStyle = color
  g.fillRect(0, 0, 64, 64)
  tinted.set(color, c)
  return c
}

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  if (!Number.isFinite(n)) return `rgba(108,142,245,${a})`
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

function vertical(ctx: CanvasRenderingContext2D, w: number, h: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  for (const [o, c] of stops) g.addColorStop(o, c)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

// ── painters ──────────────────────────────────────────────────────────────────
type Painter = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  o: BackdropOptions
) => void

const studio: Painter = (ctx, w, h, t, o) => {
  ctx.fillStyle = o.base
  ctx.fillRect(0, 0, w, h)
  const s = Math.max(w, h)
  const g = ctx.createRadialGradient(w / 2, h * 0.38, s * 0.02, w / 2, h * 0.45, s * 0.62)
  g.addColorStop(0, rgba(o.accent, 0.2))
  g.addColorStop(0.5, rgba(o.accent, 0.06))
  g.addColorStop(1, rgba(o.accent, 0))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  // Light cone from above
  const cone = ctx.createLinearGradient(0, 0, 0, h)
  cone.addColorStop(0, rgba(o.accent, 0.12))
  cone.addColorStop(1, rgba(o.accent, 0))
  ctx.fillStyle = cone
  ctx.beginPath()
  ctx.moveTo(w / 2 - s * 0.08, 0)
  ctx.lineTo(w / 2 + s * 0.08, 0)
  ctx.lineTo(w / 2 + s * 0.34, h)
  ctx.lineTo(w / 2 - s * 0.34, h)
  ctx.fill()
  if (o.motion === false) return
  // Dust motes drifting up through the light
  const sprite = glowOf(o.accent)
  for (let i = 0; i < 26; i++) {
    const sp = 0.012 + hash(i) * 0.02
    const y = h - ((hash(i + 40) + t * sp) % 1) * h
    const x = w / 2 + (hash(i + 80) - 0.5) * s * 0.5 + Math.sin(t * 0.6 + i) * 10
    const r = (2 + hash(i + 120) * 5) * (s / 900)
    ctx.globalAlpha = 0.25 + 0.35 * Math.sin(t * 1.3 + i * 2.1) ** 2
    ctx.drawImage(sprite, x - r * 3, y - r * 3, r * 6, r * 6)
  }
  ctx.globalAlpha = 1
}

const sunset: Painter = (ctx, w, h, t, o) => {
  vertical(ctx, w, h, [
    [0, '#2b1b4a'],
    [0.45, '#b8456e'],
    [0.7, '#f28a5b'],
    [1, '#ffd08a']
  ])
  const s = Math.max(w, h)
  // Sun + halo
  ctx.drawImage(glowOf('#ffe3a1'), w * 0.5 - s * 0.35, h * 0.72 - s * 0.35, s * 0.7, s * 0.7)
  ctx.fillStyle = '#ffe8b0'
  ctx.beginPath()
  ctx.arc(w * 0.5, h * 0.74, s * 0.09, 0, Math.PI * 2)
  ctx.fill()
  // Drifting clouds (long soft sprites)
  const cloud = glowOf('#ffd3c4')
  for (let i = 0; i < 5; i++) {
    const x =
      ((hash(i) + (o.motion === false ? 0 : t * 0.006 * (1 + hash(i + 9)))) % 1.4) * w * 1.1 -
      w * 0.2
    const y = h * (0.12 + hash(i + 3) * 0.35)
    ctx.globalAlpha = 0.25
    ctx.drawImage(cloud, x, y, s * 0.4, s * 0.06)
  }
  ctx.globalAlpha = 1
  // Hills
  ctx.fillStyle = '#6b2f55'
  ctx.beginPath()
  ctx.moveTo(0, h * 0.8)
  ctx.quadraticCurveTo(w * 0.25, h * 0.7, w * 0.55, h * 0.8)
  ctx.quadraticCurveTo(w * 0.8, h * 0.88, w, h * 0.76)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.fill()
  ctx.fillStyle = '#4a2240'
  ctx.beginPath()
  ctx.moveTo(0, h * 0.9)
  ctx.quadraticCurveTo(w * 0.4, h * 0.8, w, h * 0.9)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.fill()
}

const night: Painter = (ctx, w, h, t, o) => {
  vertical(ctx, w, h, [
    [0, '#050816'],
    [0.6, '#131a3f'],
    [1, '#2a2350']
  ])
  const s = Math.max(w, h)
  const motion = o.motion !== false
  for (let i = 0; i < 90; i++) {
    const x = hash(i) * w
    const y = hash(i + 200) * h * 0.85
    const tw = motion ? 0.35 + 0.65 * Math.abs(Math.sin(t * (0.6 + hash(i + 50) * 1.6) + i)) : 0.7
    const r = (0.6 + hash(i + 300) * 1.6) * (s / 1000)
    ctx.globalAlpha = tw
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  ctx.globalAlpha = 1
  // Moon
  ctx.drawImage(glowOf('#bcd0ff'), w * 0.8 - s * 0.16, h * 0.16 - s * 0.16, s * 0.32, s * 0.32)
  ctx.fillStyle = '#eef2ff'
  ctx.beginPath()
  ctx.arc(w * 0.8, h * 0.16, s * 0.045, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0d1331'
  ctx.beginPath()
  ctx.arc(w * 0.8 + s * 0.018, h * 0.16 - s * 0.01, s * 0.04, 0, Math.PI * 2)
  ctx.fill()
  // A shooting star every ~7s
  if (motion) {
    const cycle = t % 7
    if (cycle < 0.9) {
      const k = cycle / 0.9
      const seed = Math.floor(t / 7)
      const x0 = w * (0.1 + hash(seed) * 0.5)
      const y0 = h * (0.05 + hash(seed + 1) * 0.2)
      const x = x0 + k * s * 0.35
      const y = y0 + k * s * 0.14
      const g = ctx.createLinearGradient(x, y, x - s * 0.12, y - s * 0.05)
      g.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - k)})`)
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.strokeStyle = g
      ctx.lineWidth = Math.max(1, s / 600)
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - s * 0.12, y - s * 0.05)
      ctx.stroke()
    }
  }
}

const sakura: Painter = (ctx, w, h, t, o) => {
  vertical(ctx, w, h, [
    [0, '#fde4ef'],
    [0.6, '#f6c6da'],
    [1, '#e9a8c4']
  ])
  const s = Math.max(w, h)
  // God rays
  ctx.globalAlpha = 0.18
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 4; i++) {
    const x = w * (0.1 + i * 0.22)
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + s * 0.06, 0)
    ctx.lineTo(x + s * 0.3, h)
    ctx.lineTo(x + s * 0.18, h)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  const motion = o.motion !== false
  const tt = motion ? t : 0
  for (let i = 0; i < 30; i++) {
    const fall = 0.03 + hash(i) * 0.04
    const y = ((hash(i + 10) + tt * fall) % 1) * (h + 40) - 20
    const x = ((hash(i + 20) + tt * 0.01 + Math.sin(tt * 0.8 + i) * 0.02) % 1) * w
    const r = (5 + hash(i + 30) * 6) * (s / 1000)
    const rot = tt * (0.8 + hash(i + 40)) + i
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    ctx.scale(1, 0.55 + 0.45 * Math.sin(tt * 2 + i))
    ctx.globalAlpha = 0.85
    ctx.fillStyle = i % 3 ? '#f7a8c8' : '#ffd1e3'
    ctx.beginPath()
    ctx.ellipse(0, 0, r, r * 0.6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.globalAlpha = 1
}

const forest: Painter = (ctx, w, h, t, o) => {
  vertical(ctx, w, h, [
    [0, '#0d2a22'],
    [0.55, '#1c4a37'],
    [1, '#0f2a1f']
  ])
  const s = Math.max(w, h)
  // Bokeh
  const cols = ['#9be38a', '#e8f59a', '#7fd6b0']
  for (let i = 0; i < 16; i++) {
    const x = hash(i) * w
    const y = hash(i + 7) * h * 0.8
    const r = (30 + hash(i + 3) * 70) * (s / 1000)
    ctx.globalAlpha = 0.12 + hash(i + 5) * 0.12
    ctx.drawImage(glowOf(cols[i % 3]), x - r, y - r, r * 2, r * 2)
  }
  // Tree silhouettes
  ctx.globalAlpha = 1
  ctx.fillStyle = '#0a1d16'
  for (let i = 0; i < 7; i++) {
    const x = (i / 6) * w + (hash(i + 90) - 0.5) * w * 0.1
    const tw = s * (0.03 + hash(i + 70) * 0.03)
    ctx.fillRect(x - tw / 2, 0, tw, h)
  }
  if (o.motion === false) return
  // Fireflies
  const fly = glowOf('#f4ff9a')
  for (let i = 0; i < 18; i++) {
    const x = w * (0.1 + 0.8 * hash(i + 11)) + Math.sin(t * (0.3 + hash(i)) + i) * s * 0.05
    const y = h * (0.35 + 0.55 * hash(i + 13)) + Math.cos(t * (0.4 + hash(i + 1)) + i) * s * 0.04
    const r = (6 + hash(i + 15) * 6) * (s / 1000)
    ctx.globalAlpha = 0.2 + 0.8 * Math.max(0, Math.sin(t * (0.8 + hash(i + 17)) + i * 1.7))
    ctx.drawImage(fly, x - r * 2, y - r * 2, r * 4, r * 4)
  }
  ctx.globalAlpha = 1
}

const arcade: Painter = (ctx, w, h, t, o) => {
  vertical(ctx, w, h, [
    [0, '#12002b'],
    [0.55, '#3b0a5e'],
    [0.62, '#ff3ea5'],
    [0.63, '#1a0433'],
    [1, '#0c0220']
  ])
  const s = Math.max(w, h)
  const horizon = h * 0.62
  // Striped sun
  ctx.save()
  ctx.beginPath()
  ctx.arc(w / 2, horizon, s * 0.16, Math.PI, 0)
  ctx.clip()
  const sg = ctx.createLinearGradient(0, horizon - s * 0.16, 0, horizon)
  sg.addColorStop(0, '#ffe66d')
  sg.addColorStop(1, '#ff3ea5')
  ctx.fillStyle = sg
  ctx.fillRect(w / 2 - s * 0.16, horizon - s * 0.16, s * 0.32, s * 0.16)
  ctx.fillStyle = '#3b0a5e'
  // Stripes: thickest at the horizon, thinning upward
  for (let i = 0; i < 5; i++) {
    const y = horizon - s * (0.018 + 0.026 * i)
    ctx.fillRect(w / 2 - s * 0.16, y, s * 0.32, s * (0.011 - 0.002 * i))
  }
  ctx.restore()
  // Perspective grid rushing toward the viewer
  ctx.strokeStyle = 'rgba(255,62,165,0.65)'
  ctx.lineWidth = Math.max(1, s / 700)
  const scroll = o.motion === false ? 0 : (t * 0.35) % 1
  for (let i = 0; i < 14; i++) {
    const k = (i + scroll) / 14
    const y = horizon + (h - horizon) * k * k
    ctx.globalAlpha = 0.3 + 0.7 * k
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
  ctx.globalAlpha = 0.7
  for (let i = -12; i <= 12; i++) {
    ctx.beginPath()
    ctx.moveTo(w / 2 + i * s * 0.015, horizon)
    ctx.lineTo(w / 2 + i * s * 0.16, h)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

const paper: Painter = (ctx, w, h, _t, o) => {
  ctx.fillStyle = '#f5f0e6'
  ctx.fillRect(0, 0, w, h)
  const s = Math.max(w, h)
  const step = Math.max(14, s / 40)
  ctx.fillStyle = 'rgba(120,105,80,0.18)'
  for (let x = step / 2; x < w; x += step) {
    for (let y = step / 2; y < h; y += step) ctx.fillRect(x - 1, y - 1, 2, 2)
  }
  // A soft accent blob behind the figure
  ctx.globalAlpha = 0.18
  ctx.drawImage(glowOf(o.accent), w / 2 - s * 0.35, h * 0.45 - s * 0.35, s * 0.7, s * 0.7)
  ctx.globalAlpha = 1
}

const none: Painter = (ctx, w, h, _t, o) => {
  ctx.fillStyle = o.base
  ctx.fillRect(0, 0, w, h)
}

const PAINTERS: Record<string, Painter> = {
  studio,
  sunset,
  night,
  sakura,
  forest,
  arcade,
  paper,
  none
}

/** Fill a w × h device box with a backdrop at time t (seconds). */
export function paintBackdrop(
  ctx: CanvasRenderingContext2D,
  id: string | undefined,
  w: number,
  h: number,
  t: number,
  opts: BackdropOptions
): void {
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ;(PAINTERS[id || 'studio'] || studio)(ctx, w, h, t, opts)
  ctx.restore()
}

export function backdropOf(id: string | undefined): BackdropDef {
  return BACKDROPS.find((b) => b.id === id) || BACKDROPS[0]
}

/** Whether a backdrop animates (the stage can idle-throttle the still ones). */
export const isAnimatedBackdrop = (id: string | undefined): boolean =>
  id !== 'paper' && id !== 'none'
