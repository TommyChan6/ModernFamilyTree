// Image-export composition: pure layout math (testable, no DOM) plus the one
// canvas-drawing function that assembles the final picture. The WebGL views
// capture the *scene* (nodes/lifelines/zones on a transparent background); this
// module owns everything around it — background, padding, title/subtitle,
// stamp, crop — so the modal preview and the final download go through the
// exact same code path at different resolutions.

export interface ExportSize {
  width: number
  height: number
}

export interface ResolutionPreset extends ExportSize {
  id: string
  label: string
  hint: string
}

export const RESOLUTION_PRESETS: ResolutionPreset[] = [
  { id: 'fhd', label: 'Full HD', hint: '1920 × 1080', width: 1920, height: 1080 },
  { id: 'qhd', label: 'QHD', hint: '2560 × 1440', width: 2560, height: 1440 },
  { id: '4k', label: '4K UHD', hint: '3840 × 2160', width: 3840, height: 2160 },
  { id: 'square', label: 'Square', hint: '2048 × 2048', width: 2048, height: 2048 },
  { id: 'portrait', label: 'Portrait', hint: '1080 × 1920', width: 1080, height: 1920 },
  { id: 'a4', label: 'Print A4 · 300dpi', hint: '3508 × 2480', width: 3508, height: 2480 }
]

export const MIN_DIMENSION = 320
export const MAX_DIMENSION = 7680
// GPU-side cap for a single capture; crop zoom-ins soften past this.
export const MAX_CAPTURE_DIMENSION = 8192

export interface ExportFormat {
  id: 'png' | 'jpeg' | 'webp'
  label: string
  mime: string
  ext: string
  hasQuality: boolean
  alpha: boolean
}

export const EXPORT_FORMATS: ExportFormat[] = [
  { id: 'png', label: 'PNG', mime: 'image/png', ext: 'png', hasQuality: false, alpha: true },
  { id: 'jpeg', label: 'JPEG', mime: 'image/jpeg', ext: 'jpg', hasQuality: true, alpha: false },
  { id: 'webp', label: 'WebP', mime: 'image/webp', ext: 'webp', hasQuality: true, alpha: true }
]

// Fractional rect (0..1 in both axes) describing a crop of the captured scene.
export interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

export interface ComposeColors {
  bg: string // page background (ignored when transparent)
  t1: string // title text
  t2: string // subtitle text
  t3: string // stamp text
  tint: string | null // subtle radial wash colour (null = none)
}

export interface ComposeOptions extends ExportSize {
  transparent: boolean
  colors: ComposeColors
  paddingFrac: number // 0..0.2 of min(width,height) on every side
  title: string
  subtitle: string
  stamp: string // small caption bottom-right ('' = none)
  crop: CropRect | null
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface ComposeLayout {
  pad: number
  titleSize: number
  subtitleSize: number
  stampSize: number
  titleBaseline: number // y of the title baseline (0 when no title)
  subtitleBaseline: number
  content: Rect // where the scene image lives
}

// Clamp a user-entered dimension to something the GPU and the UI both accept.
export function clampDimension(v: number): number {
  if (!Number.isFinite(v)) return MIN_DIMENSION
  return Math.round(Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, v)))
}

// Everything scales off min(width, height) so the same options produce the
// same-looking image at preview size and at full export size.
export function computeComposeLayout(
  opts: Pick<ComposeOptions, 'width' | 'height' | 'paddingFrac' | 'title' | 'subtitle' | 'stamp'>
): ComposeLayout {
  const { width, height } = opts
  const base = Math.min(width, height)
  const pad = Math.round(base * Math.min(0.2, Math.max(0, opts.paddingFrac)))
  const titleSize = Math.round(base * 0.052)
  const subtitleSize = Math.round(base * 0.026)
  const stampSize = Math.max(9, Math.round(base * 0.016))

  let top = pad
  let titleBaseline = 0
  let subtitleBaseline = 0
  const hasTitle = !!opts.title.trim()
  const hasSubtitle = !!opts.subtitle.trim()
  if (hasTitle) {
    titleBaseline = top + titleSize
    top = titleBaseline + Math.round(titleSize * 0.35)
  }
  if (hasSubtitle) {
    subtitleBaseline = top + subtitleSize
    top = subtitleBaseline + Math.round(subtitleSize * 0.5)
  }
  if (hasTitle || hasSubtitle) top += Math.round(base * 0.02)

  const bottom = height - pad - (opts.stamp ? Math.round(stampSize * 1.9) : 0)
  const content: Rect = {
    x: pad,
    y: top,
    w: Math.max(1, width - pad * 2),
    h: Math.max(1, bottom - top)
  }
  return { pad, titleSize, subtitleSize, stampSize, titleBaseline, subtitleBaseline, content }
}

// Clamp a fractional crop to sane bounds (min 2% on a side, inside the unit square).
export function clampCrop(c: CropRect): CropRect {
  const w = Math.min(1, Math.max(0.02, c.w))
  const h = Math.min(1, Math.max(0.02, c.h))
  const x = Math.min(1 - w, Math.max(0, c.x))
  const y = Math.min(1 - h, Math.max(0, c.y))
  return { x, y, w, h }
}

// Map a fractional crop onto a source of sw×sh pixels.
export function cropToSourceRect(crop: CropRect | null, sw: number, sh: number): Rect {
  if (!crop) return { x: 0, y: 0, w: sw, h: sh }
  const c = clampCrop(crop)
  return {
    x: Math.round(c.x * sw),
    y: Math.round(c.y * sh),
    w: Math.max(1, Math.round(c.w * sw)),
    h: Math.max(1, Math.round(c.h * sh))
  }
}

// Contain-fit src into dst, centred (the scene keeps its aspect; the page
// background shows through any letterbox band).
export function fitRectContain(srcW: number, srcH: number, dst: Rect): Rect {
  if (srcW <= 0 || srcH <= 0 || dst.w <= 0 || dst.h <= 0) return { ...dst, w: 0, h: 0 }
  const s = Math.min(dst.w / srcW, dst.h / srcH)
  const w = srcW * s
  const h = srcH * s
  return { x: dst.x + (dst.w - w) / 2, y: dst.y + (dst.h - h) / 2, w, h }
}

// The pixel size the scene should be captured at so the (possibly cropped)
// region fills the content rect 1:1 — cropping zooms the capture up so the
// result stays crisp, capped so a tiny crop can't ask the GPU for a 40k canvas.
export function captureSizeFor(content: Rect, crop: CropRect | null): ExportSize {
  let w = content.w
  let h = content.h
  if (crop) {
    const c = clampCrop(crop)
    w = content.w / c.w
    h = content.h / c.h
  }
  const s = Math.min(1, MAX_CAPTURE_DIMENSION / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) }
}

export function sanitizeFilename(name: string, fallback = 'family-tree'): string {
  const clean = (name || '')
    // eslint-disable-next-line no-control-regex -- strip chars Windows filenames reject
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  return clean || fallback
}

// ── Drawing ──────────────────────────────────────────────────────────────────

const FONT_STACK = `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

// Assemble the final image. `scene` is the captured (transparent-background)
// view; returns a fresh canvas of opts.width × opts.height.
export function composeExport(
  scene: HTMLCanvasElement | null,
  opts: ComposeOptions
): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = opts.width
  out.height = opts.height
  const g = out.getContext('2d')
  if (!g) return out
  const L = computeComposeLayout(opts)
  const c = opts.colors

  if (!opts.transparent) {
    g.fillStyle = c.bg
    g.fillRect(0, 0, opts.width, opts.height)
    if (c.tint) {
      // The views' signature ambient wash: a wide radial tint from the top.
      const r = Math.max(opts.width, opts.height) * 0.85
      const grad = g.createRadialGradient(
        opts.width * 0.25,
        -opts.height * 0.1,
        0,
        opts.width * 0.25,
        -opts.height * 0.1,
        r
      )
      grad.addColorStop(0, c.tint)
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, opts.width, opts.height)
    }
  }

  if (scene && scene.width > 0 && scene.height > 0) {
    const src = cropToSourceRect(opts.crop, scene.width, scene.height)
    const dst = fitRectContain(src.w, src.h, L.content)
    if (dst.w >= 1 && dst.h >= 1) {
      g.imageSmoothingQuality = 'high'
      g.drawImage(scene, src.x, src.y, src.w, src.h, dst.x, dst.y, dst.w, dst.h)
    }
  }

  const cx = opts.width / 2
  if (opts.title.trim()) {
    g.font = `700 ${L.titleSize}px ${FONT_STACK}`
    g.fillStyle = c.t1
    g.textAlign = 'center'
    g.textBaseline = 'alphabetic'
    g.fillText(opts.title.trim(), cx, L.titleBaseline)
  }
  if (opts.subtitle.trim()) {
    g.font = `500 ${L.subtitleSize}px ${FONT_STACK}`
    g.fillStyle = c.t2
    g.textAlign = 'center'
    g.fillText(opts.subtitle.trim(), cx, L.subtitleBaseline)
  }
  if (opts.stamp) {
    g.font = `600 ${L.stampSize}px ${FONT_STACK}`
    g.fillStyle = c.t3
    g.textAlign = 'right'
    g.fillText(opts.stamp, opts.width - L.pad, opts.height - L.pad)
  }
  return out
}
