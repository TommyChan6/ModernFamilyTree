// Star-chart poster — the export framing for the constellation skin (graph
// nodeShape 'star'). The captured graph (glowing stars on a transparent
// ground) is set into a celestial chart: a night-sky sheet with its own faint
// star field and Milky Way, a circular (planisphere) or rectangular (atlas
// plate) frame with degree ticks and a right-ascension hour ring, the project
// name as a spaced title, a subtitle line and a legend ("brightness =
// descendants"). Pure layout math up top (tested), one canvas painter below.
// Every visible string arrives translated in the options.

import {
  clampCrop,
  cropToSourceRect,
  fitRectContain,
  type CropRect,
  type Rect
} from './exportCompose'

export type StarChartFrame = 'circle' | 'rect'

export interface StarChartOptions {
  width: number
  height: number
  frame: StarChartFrame
  title: string
  subtitle: string
  /** legend caption, e.g. "Brightness = descendants" */
  legend: string
  /** small caption bottom-right ('' = none) */
  stamp: string
  crop: CropRect | null
  /** hour-ring label for hour h (0–23), e.g. "6h" */
  hourLabel: (h: number) => string
}

export interface StarChartLayout {
  base: number
  pad: number
  titleSize: number
  subtitleSize: number
  legendSize: number
  titleBaseline: number
  subtitleBaseline: number
  legendBaseline: number
  /** width of the tick / hour-label band around the chart */
  ring: number
  /** circle frame: the chart disc (centre + radius) */
  cx: number
  cy: number
  r: number
  /** where the scene image lives (the disc's square, or the plate) */
  content: Rect
}

/** Layout for a poster of width × height; everything scales off min(w, h) so
 *  the preview and the full-size download look the same. */
export function starChartLayout(
  opts: Pick<StarChartOptions, 'width' | 'height' | 'frame' | 'title' | 'subtitle' | 'legend'>
): StarChartLayout {
  const { width, height } = opts
  const base = Math.max(1, Math.min(width, height))
  const pad = Math.round(base * 0.05)
  const titleSize = Math.round(base * 0.046)
  const subtitleSize = Math.round(base * 0.021)
  const legendSize = Math.max(9, Math.round(base * 0.017))
  let top = pad
  let titleBaseline = 0
  let subtitleBaseline = 0
  if (opts.title.trim()) {
    titleBaseline = top + titleSize
    top = titleBaseline + Math.round(titleSize * 0.45)
  }
  if (opts.subtitle.trim()) {
    subtitleBaseline = top + subtitleSize
    top = subtitleBaseline + Math.round(subtitleSize * 0.6)
  }
  top += Math.round(base * 0.015)
  const legendBaseline = height - pad
  const bottom = legendBaseline - Math.round(legendSize * 2.6)
  const ring = Math.round(base * 0.05)
  const areaW = Math.max(1, width - pad * 2)
  const areaH = Math.max(1, bottom - top)
  const cx = width / 2
  const cy = top + areaH / 2
  if (opts.frame === 'circle') {
    const r = Math.max(4, Math.min(areaW, areaH) / 2 - ring)
    return {
      base,
      pad,
      titleSize,
      subtitleSize,
      legendSize,
      titleBaseline,
      subtitleBaseline,
      legendBaseline,
      ring,
      cx,
      cy,
      r,
      content: { x: cx - r, y: cy - r, w: r * 2, h: r * 2 }
    }
  }
  const content: Rect = {
    x: pad + ring,
    y: top + ring,
    w: Math.max(1, areaW - ring * 2),
    h: Math.max(1, areaH - ring * 2)
  }
  return {
    base,
    pad,
    titleSize,
    subtitleSize,
    legendSize,
    titleBaseline,
    subtitleBaseline,
    legendBaseline,
    ring,
    cx,
    cy,
    r: Math.min(content.w, content.h) / 2,
    content
  }
}

/** Tick marks round a circular frame: one per degree; every 5° medium, every
 *  15° (one hour of right ascension) long and labelled. Angles in radians,
 *  0h at the top, increasing clockwise. */
export function ringTicks(): { angle: number; len: 0 | 1 | 2; hour: number | null }[] {
  const out: { angle: number; len: 0 | 1 | 2; hour: number | null }[] = []
  for (let d = 0; d < 360; d++) {
    const hour = d % 15 === 0 ? d / 15 : null
    out.push({
      angle: (d / 360) * Math.PI * 2 - Math.PI / 2,
      len: hour != null ? 2 : d % 5 === 0 ? 1 : 0,
      hour
    })
  }
  return out
}

/** Evenly spaced ticks along a plate edge of `length` px: about one every
 *  `step` px, every 5th long. Positions are 0..length. */
export function edgeTicks(length: number, step: number): { at: number; long: boolean }[] {
  const n = Math.max(2, Math.round(length / Math.max(1, step)))
  const out: { at: number; long: boolean }[] = []
  for (let i = 0; i <= n; i++) out.push({ at: (i / n) * length, long: i % 5 === 0 })
  return out
}

/** Hours between labels on a rectangular plate `width` px wide whose labels
 *  are `labelSize` px: every 1, 2, 3, 4 or 6 h, the densest that leaves each
 *  label about four label-heights of room. */
export function plateHourStep(width: number, labelSize: number): number {
  for (const h of [1, 2, 3, 4, 6]) if ((width * h) / 24 >= labelSize * 4) return h
  return 12
}

/** Tiny deterministic PRNG (mulberry32) — the sheet's star field is the same
 *  in the preview and the download. */
export function chartRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Drawing ──────────────────────────────────────────────────────────────────

// The chart's own pigments (like a preset's shader palette): night ink,
// silver-blue grid, pale gold frame.
const SKY_IN = '#0d1638'
const SKY_OUT = '#03050f'
const GRID = 'rgba(170, 190, 235, 0.16)'
const GOLD = '#d9c89a'
const GOLD_DIM = 'rgba(217, 200, 154, 0.55)'
const TEXT = '#e9e4d4'
const TEXT_DIM = 'rgba(233, 228, 212, 0.62)'
const SERIF = `Georgia, 'Times New Roman', serif`

/** A four-point star glyph (core + bloom + spikes), size = spike reach in px. */
function starGlyph(g: CanvasRenderingContext2D, x: number, y: number, size: number, alpha = 1) {
  g.save()
  g.globalAlpha = alpha
  const bloom = g.createRadialGradient(x, y, 0, x, y, size * 0.7)
  bloom.addColorStop(0, 'rgba(255,255,255,0.95)')
  bloom.addColorStop(0.18, 'rgba(220,232,255,0.55)')
  bloom.addColorStop(1, 'rgba(200,215,255,0)')
  g.fillStyle = bloom
  g.beginPath()
  g.arc(x, y, size * 0.7, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = 'rgba(230,238,255,0.7)'
  g.lineWidth = Math.max(0.6, size * 0.05)
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(x - size, y)
  g.lineTo(x + size, y)
  g.moveTo(x, y - size)
  g.lineTo(x, y + size)
  g.stroke()
  g.fillStyle = '#ffffff'
  g.beginPath()
  g.arc(x, y, Math.max(0.8, size * 0.12), 0, Math.PI * 2)
  g.fill()
  g.restore()
}

function spacedText(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacingPx: number
) {
  const ctx = g as CanvasRenderingContext2D & { letterSpacing?: string }
  const has = 'letterSpacing' in ctx
  if (has) ctx.letterSpacing = `${spacingPx.toFixed(2)}px`
  // letterSpacing also pads after the last glyph — nudge so it stays centred.
  g.fillText(text, has && g.textAlign === 'center' ? x + spacingPx / 2 : x, y)
  if (has) ctx.letterSpacing = '0px'
}

function paintSky(g: CanvasRenderingContext2D, w: number, h: number, base: number) {
  const sky = g.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.hypot(w, h) * 0.62)
  sky.addColorStop(0, SKY_IN)
  sky.addColorStop(1, SKY_OUT)
  g.fillStyle = sky
  g.fillRect(0, 0, w, h)
  // A faint Milky Way: a long soft ellipse across the sheet.
  g.save()
  g.translate(w / 2, h / 2)
  g.rotate(-0.5)
  g.scale(1, 0.2)
  const band = g.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) * 0.7)
  band.addColorStop(0, 'rgba(190, 200, 240, 0.12)')
  band.addColorStop(0.5, 'rgba(160, 170, 230, 0.05)')
  band.addColorStop(1, 'rgba(160, 170, 230, 0)')
  g.fillStyle = band
  g.beginPath()
  g.arc(0, 0, Math.max(w, h) * 0.7, 0, Math.PI * 2)
  g.fill()
  g.restore()
  // Field stars: deterministic, density by area.
  const rnd = chartRng(0x5eed)
  const n = Math.round(((w * h) / (base * base)) * 520)
  for (let i = 0; i < n; i++) {
    const x = rnd() * w
    const y = rnd() * h
    const m = rnd()
    const rad = (0.35 + 1.3 * m * m * m) * (base / 1100)
    g.globalAlpha = 0.25 + 0.6 * rnd()
    g.fillStyle = rnd() > 0.8 ? '#ffe6c2' : rnd() > 0.5 ? '#dfe8ff' : '#ffffff'
    g.beginPath()
    g.arc(x, y, Math.max(0.4, rad), 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
}

function circleFrame(g: CanvasRenderingContext2D, L: StarChartLayout, opts: StarChartOptions) {
  const { cx, cy, r, ring, base } = L
  const lw = Math.max(1, base / 900)
  // Declination rings + hour lines inside the disc.
  g.save()
  g.beginPath()
  g.arc(cx, cy, r, 0, Math.PI * 2)
  g.clip()
  g.strokeStyle = GRID
  g.lineWidth = lw
  g.setLineDash([lw * 4, lw * 5])
  for (const f of [0.25, 0.5, 0.75]) {
    g.beginPath()
    g.arc(cx, cy, r * f, 0, Math.PI * 2)
    g.stroke()
  }
  g.setLineDash([])
  for (let hgt = 0; hgt < 12; hgt++) {
    const a = (hgt / 12) * Math.PI * 2 - Math.PI / 2
    g.beginPath()
    g.moveTo(cx + Math.cos(a) * r * 0.06, cy + Math.sin(a) * r * 0.06)
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    g.stroke()
  }
  g.restore()
  // The frame: an inner hairline, the tick band, a strong outer rule.
  g.strokeStyle = GOLD
  g.lineWidth = lw * 1.6
  g.beginPath()
  g.arc(cx, cy, r, 0, Math.PI * 2)
  g.stroke()
  const tickR = r + ring * 0.08
  const outer = r + ring * 0.92
  g.lineWidth = lw * 2.4
  g.beginPath()
  g.arc(cx, cy, outer, 0, Math.PI * 2)
  g.stroke()
  g.lineWidth = lw * 0.8
  g.beginPath()
  g.arc(cx, cy, outer - ring * 0.08, 0, Math.PI * 2)
  g.stroke()
  const labelSize = Math.max(8, Math.round(ring * 0.32))
  g.font = `italic 400 ${labelSize}px ${SERIF}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  for (const tk of ringTicks()) {
    const len = tk.len === 2 ? ring * 0.3 : tk.len === 1 ? ring * 0.17 : ring * 0.09
    const c = Math.cos(tk.angle)
    const s = Math.sin(tk.angle)
    g.strokeStyle = tk.len ? GOLD : GOLD_DIM
    g.lineWidth = tk.len === 2 ? lw * 1.4 : lw * 0.8
    g.beginPath()
    g.moveTo(cx + c * tickR, cy + s * tickR)
    g.lineTo(cx + c * (tickR + len), cy + s * (tickR + len))
    g.stroke()
    if (tk.hour != null) {
      const lr = tickR + ring * 0.55
      g.fillStyle = TEXT_DIM
      g.fillText(opts.hourLabel(tk.hour), cx + c * lr, cy + s * lr)
    }
  }
}

function rectFrame(g: CanvasRenderingContext2D, L: StarChartLayout, opts: StarChartOptions) {
  const { content: c, ring, base } = L
  const lw = Math.max(1, base / 900)
  // Grid lines inside the plate.
  g.save()
  g.beginPath()
  g.rect(c.x, c.y, c.w, c.h)
  g.clip()
  g.strokeStyle = GRID
  g.lineWidth = lw
  g.setLineDash([lw * 4, lw * 5])
  for (let i = 1; i < 6; i++) {
    const x = c.x + (c.w * i) / 6
    g.beginPath()
    g.moveTo(x, c.y)
    g.lineTo(x, c.y + c.h)
    g.stroke()
  }
  for (let i = 1; i < 4; i++) {
    const y = c.y + (c.h * i) / 4
    g.beginPath()
    g.moveTo(c.x, y)
    g.lineTo(c.x + c.w, y)
    g.stroke()
  }
  g.setLineDash([])
  g.restore()
  g.strokeStyle = GOLD
  g.lineWidth = lw * 1.6
  g.strokeRect(c.x, c.y, c.w, c.h)
  const o = ring * 0.82
  g.lineWidth = lw * 2.4
  g.strokeRect(c.x - o, c.y - o, c.w + o * 2, c.h + o * 2)
  // Ticks along all four edges; the top edge labelled in hours.
  const step = Math.max(4, base / 160)
  const labelSize = Math.max(8, Math.round(ring * 0.3))
  g.font = `italic 400 ${labelSize}px ${SERIF}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const top = edgeTicks(c.w, step)
  const side = edgeTicks(c.h, step)
  const tick = (x0: number, y0: number, dx: number, dy: number, long: boolean) => {
    const len = long ? ring * 0.26 : ring * 0.12
    g.strokeStyle = long ? GOLD : GOLD_DIM
    g.lineWidth = long ? lw * 1.3 : lw * 0.8
    g.beginPath()
    g.moveTo(x0, y0)
    g.lineTo(x0 + dx * len, y0 + dy * len)
    g.stroke()
  }
  for (const tk of top) {
    tick(c.x + tk.at, c.y, 0, -1, tk.long)
    tick(c.x + tk.at, c.y + c.h, 0, 1, tk.long)
  }
  // Right ascension across the top: 24 h over the plate's width, labelled
  // every 2 h (every 3 h on a narrow plate), each on its own long tick.
  const every = plateHourStep(c.w, labelSize)
  g.fillStyle = TEXT_DIM
  for (let h = 0; h <= 24; h += every) {
    const x = c.x + (c.w * h) / 24
    tick(x, c.y, 0, -1, true)
    g.fillText(opts.hourLabel(h % 24), x, c.y - ring * 0.52)
  }
  for (const tk of side) {
    tick(c.x, c.y + tk.at, -1, 0, tk.long)
    tick(c.x + c.w, c.y + tk.at, 1, 0, tk.long)
  }
}

function legendLine(g: CanvasRenderingContext2D, L: StarChartLayout, opts: StarChartOptions) {
  const y = L.legendBaseline - L.legendSize * 0.35
  const s = L.legendSize
  g.font = `italic 400 ${s}px ${SERIF}`
  g.textBaseline = 'middle'
  g.textAlign = 'left'
  const text = opts.legend.trim()
  const textW = text ? g.measureText(text).width : 0
  // A magnitude scale: five stars, faint → bright.
  const sizes = [0.35, 0.5, 0.7, 0.95, 1.25].map((k) => k * s)
  const gap = s * 0.9
  const scaleW = sizes.reduce((a, b) => a + b * 2, 0) + gap * (sizes.length - 1)
  const total = scaleW + (text ? s * 1.2 + textW : 0)
  // Centred, or left-aligned when the stamp takes the right corner.
  let x = opts.stamp ? L.pad : (g.canvas.width - total) / 2
  sizes.forEach((sz, i) => {
    x += sz
    starGlyph(g, x, y, sz, 0.55 + 0.1 * i)
    x += sz + gap
  })
  if (text) {
    g.fillStyle = TEXT_DIM
    g.fillText(text, x - gap + s * 1.2, y)
  }
}

/** Paint the poster; `scene` is the captured graph (transparent ground). */
export function composeStarChart(
  scene: HTMLCanvasElement | null,
  opts: StarChartOptions
): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = opts.width
  out.height = opts.height
  const g = out.getContext('2d')
  if (!g) return out
  const L = starChartLayout(opts)
  paintSky(g, opts.width, opts.height, L.base)

  // The chart face: a slightly deeper disc / plate under the scene.
  g.save()
  g.beginPath()
  if (opts.frame === 'circle') g.arc(L.cx, L.cy, L.r, 0, Math.PI * 2)
  else g.rect(L.content.x, L.content.y, L.content.w, L.content.h)
  g.fillStyle = 'rgba(2, 4, 14, 0.42)'
  g.fill()
  g.restore()
  if (opts.frame === 'circle') circleFrame(g, L, opts)
  else rectFrame(g, L, opts)

  if (scene && scene.width > 0 && scene.height > 0) {
    const src = cropToSourceRect(opts.crop ? clampCrop(opts.crop) : null, scene.width, scene.height)
    const dst = fitRectContain(src.w, src.h, L.content)
    if (dst.w >= 1 && dst.h >= 1) {
      g.save()
      g.beginPath()
      if (opts.frame === 'circle') g.arc(L.cx, L.cy, L.r, 0, Math.PI * 2)
      else g.rect(L.content.x, L.content.y, L.content.w, L.content.h)
      g.clip()
      g.imageSmoothingQuality = 'high'
      g.drawImage(scene, src.x, src.y, src.w, src.h, dst.x, dst.y, dst.w, dst.h)
      g.restore()
    }
  }

  const cx = opts.width / 2
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  if (opts.title.trim()) {
    g.font = `400 ${L.titleSize}px ${SERIF}`
    g.fillStyle = TEXT
    const title = opts.title.trim().toLocaleUpperCase()
    spacedText(g, title, cx, L.titleBaseline, L.titleSize * 0.18)
    // Small stars either side of the title, on a hairline.
    const tw = g.measureText(title).width + title.length * L.titleSize * 0.18
    const y = L.titleBaseline - L.titleSize * 0.34
    const reach = Math.min(L.titleSize * 3, (opts.width - tw) / 2 - L.pad)
    if (reach > L.titleSize * 0.8) {
      g.strokeStyle = GOLD_DIM
      g.lineWidth = Math.max(1, L.base / 1200)
      for (const dir of [-1, 1]) {
        const x0 = cx + dir * (tw / 2 + L.titleSize * 0.5)
        g.beginPath()
        g.moveTo(x0, y)
        g.lineTo(x0 + dir * reach, y)
        g.stroke()
        starGlyph(g, x0 + dir * reach, y, L.titleSize * 0.22)
      }
    }
  }
  if (opts.subtitle.trim()) {
    g.font = `italic 400 ${L.subtitleSize}px ${SERIF}`
    g.fillStyle = TEXT_DIM
    spacedText(g, opts.subtitle.trim(), cx, L.subtitleBaseline, L.subtitleSize * 0.05)
  }
  legendLine(g, L, opts)
  if (opts.stamp) {
    g.font = `400 ${L.legendSize}px ${SERIF}`
    g.fillStyle = TEXT_DIM
    g.textAlign = 'right'
    g.textBaseline = 'middle'
    g.fillText(opts.stamp, opts.width - L.pad, L.legendBaseline - L.legendSize * 0.35)
  }
  return out
}
