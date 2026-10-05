// 水墨 — shared ink-painting primitives for the Ink theme and every view that
// paints in it (map, timeline, groups, directory, profile…). Canvas-2D only, no
// store/DOM-state dependency, and fully deterministic: every random choice
// comes from a seeded generator so a stroke looks the same on every redraw.
//
//   paperCanvas / paperDataUrl   rice paper (宣纸): warm tone, fibres, speckles
//   brushStroke                  a loaded brush dragged along a polyline —
//                                pressure taper + dry-brush "flying white" (飞白)
//   inkWash                      a bleeding wash blot (晕染) with a soft, ragged edge
//   mountainRange                a 山水 ridge: wash body fading into mist + texture strokes
//   sealCanvas / sealDataUrl     a cinnabar seal (印章), yang (red chars) or yin (red ground)
//   strokeDataUrl                one-off brush marks for CSS (underline, divider, ensō)
//   installInkAssets             generates the CSS-facing textures once and
//                                exposes them as custom properties on <html>

export const INK = {
  ink: '#1c1a17',
  ink2: '#3a3730',
  wash: '#6e6a61',
  mist: '#a9a497',
  paper: '#efe7d4',
  paperLight: '#f6f0e2',
  paperDeep: '#e2d6bb',
  cinnabar: '#b3352a',
  cinnabarDeep: '#8c241c',
  indigo: '#3d5a73', // 花青
  malachite: '#4c8a72', // 石绿
  azurite: '#2f5f8a', // 石青
  ochre: '#b4884c', // 赭石
  gold: '#b8923a'
}

type Ctx = CanvasRenderingContext2D
export interface Pt {
  x: number
  y: number
}

// ── Determinism ────────────────────────────────────────────────────────────────

/** mulberry32 — tiny, fast, good enough for brush jitter. Returns [0,1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0 || 0x9e3779b9
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stable 32-bit hash of a string (FNV-1a) — seed strokes from ids/names. */
export function hashStr(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Smooth 1-D value noise in [-1,1], periodic-free; cheap wobble for edges. */
export function noise1(seed: number): (x: number) => number {
  const r = rng(seed)
  const table = Array.from({ length: 64 }, () => r() * 2 - 1)
  return (x: number) => {
    const i = Math.floor(x)
    const f = x - i
    const a = table[((i % 64) + 64) % 64]
    const b = table[(((i + 1) % 64) + 64) % 64]
    const u = f * f * (3 - 2 * f)
    return a + (b - a) * u
  }
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [28, 26, 23]
  let s = m[1]
  if (s.length === 3) s = s.replace(/./g, (c) => c + c)
  const n = parseInt(s, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}

// ── Rice paper ────────────────────────────────────────────────────────────────

export interface PaperOpts {
  /** Base paper color. */
  tone?: string
  /** 0..1 — how many long fibres / speckles. */
  fiber?: number
  seed?: number
  /** Darken the sheet toward its edges a little (aged mounting). */
  age?: number
}

const paperCache = new Map<string, HTMLCanvasElement>()

/** A tileable-looking sheet of 宣纸. Cached per (size, opts). */
export function paperCanvas(w = 512, h = 512, opts: PaperOpts = {}): HTMLCanvasElement {
  const { tone = INK.paper, fiber = 0.6, seed = 7, age = 0 } = opts
  const key = `${w}x${h}|${tone}|${fiber}|${seed}|${age}`
  const hit = paperCache.get(key)
  if (hit) return hit
  const c = makeCanvas(w, h)
  const ctx = c.getContext('2d') as Ctx
  const r = rng(seed)
  ctx.fillStyle = tone
  ctx.fillRect(0, 0, w, h)

  // Cloudy pulp density — many small, faint blotches a shade lighter/darker.
  // (Few big ones read as a visible repeat every tile over large flat areas.)
  for (let i = 0; i < 70; i++) {
    const x = r() * w
    const y = r() * h
    const rad = (0.05 + r() * 0.13) * Math.max(w, h)
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
    const dark = r() < 0.5
    g.addColorStop(0, dark ? 'rgba(120,95,55,0.022)' : 'rgba(255,252,240,0.03)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    // draw with wrap so the texture tiles reasonably
    for (const ox of [-w, 0, w])
      for (const oy of [-h, 0, h]) {
        ctx.save()
        ctx.translate(ox, oy)
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2)
        ctx.restore()
      }
  }

  // Fine grain — per-pixel noise.
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 9
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n * 0.9
  }
  ctx.putImageData(img, 0, 0)

  // Long hemp/mulberry fibres — thin curved hairlines, lighter and darker.
  const fibres = Math.round((140 * fiber * (w * h)) / (512 * 512))
  ctx.lineCap = 'round'
  for (let i = 0; i < fibres; i++) {
    let x = r() * w
    let y = r() * h
    let a = r() * Math.PI * 2
    const len = 8 + r() * 46
    const light = r() < 0.55
    ctx.strokeStyle = light
      ? `rgba(255,253,245,${0.25 + r() * 0.3})`
      : `rgba(110,90,60,${0.06 + r() * 0.1})`
    ctx.lineWidth = 0.4 + r() * 0.7
    ctx.beginPath()
    ctx.moveTo(x, y)
    const steps = 6
    for (let s = 0; s < steps; s++) {
      a += (r() - 0.5) * 0.7
      x += (Math.cos(a) * len) / steps
      y += (Math.sin(a) * len) / steps
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  // Speckles: bark flecks and tiny ink motes.
  const specks = Math.round((220 * fiber * (w * h)) / (512 * 512))
  for (let i = 0; i < specks; i++) {
    const x = r() * w
    const y = r() * h
    const s = r() < 0.92 ? 0.4 + r() * 0.9 : 1.2 + r() * 1.6
    ctx.fillStyle =
      r() < 0.8 ? `rgba(120,96,60,${0.12 + r() * 0.2})` : `rgba(30,28,24,${0.1 + r() * 0.2})`
    ctx.beginPath()
    ctx.ellipse(x, y, s, s * (0.5 + r() * 0.5), r() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }

  if (age > 0) {
    const g = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.3,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.75
    )
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, `rgba(120,90,45,${0.25 * age})`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
  paperCache.set(key, c)
  return c
}

const urlCache = new Map<string, string>()

export function paperDataUrl(w = 512, h = 512, opts: PaperOpts = {}): string {
  const key = `paper|${w}|${h}|${JSON.stringify(opts)}`
  let u = urlCache.get(key)
  if (!u) {
    u = paperCanvas(w, h, opts).toDataURL('image/png')
    urlCache.set(key, u)
  }
  return u
}

// ── Brush strokes ─────────────────────────────────────────────────────────────

export interface BrushOpts {
  width?: number
  color?: string
  alpha?: number
  seed?: number
  /** 0..1 — how much the brush runs dry toward the end (飞白). */
  dry?: number
  /** Fraction of the length spent pressing in / lifting out. */
  taperIn?: number
  taperOut?: number
  /** Width wobble 0..1. */
  wobble?: number
  /** Only draw the first `progress` (0..1) of the stroke — for write-on animation. */
  progress?: number
}

/** Resample a polyline evenly every `step` px, returning points with tangent. */
function resample(
  pts: Pt[],
  step: number
): { x: number; y: number; tx: number; ty: number; t: number }[] {
  if (pts.length < 2) return []
  const seg: number[] = []
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    seg.push(l)
    total += l
  }
  if (total < 0.01) return []
  const n = Math.max(2, Math.ceil(total / step))
  const out: { x: number; y: number; tx: number; ty: number; t: number }[] = []
  let si = 0
  let acc = 0
  for (let k = 0; k <= n; k++) {
    const target = (k / n) * total
    while (si < seg.length - 1 && acc + seg[si] < target) {
      acc += seg[si]
      si++
    }
    const a = pts[si]
    const b = pts[si + 1]
    const f = seg[si] > 0 ? Math.min(1, (target - acc) / seg[si]) : 0
    const tx = (b.x - a.x) / (seg[si] || 1)
    const ty = (b.y - a.y) / (seg[si] || 1)
    out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, tx, ty, t: k / n })
  }
  // smooth tangents a touch so joints don't kink
  for (let k = 1; k < out.length - 1; k++) {
    const tx = out[k - 1].tx + out[k].tx + out[k + 1].tx
    const ty = out[k - 1].ty + out[k].ty + out[k + 1].ty
    const l = Math.hypot(tx, ty) || 1
    out[k].tx = tx / l
    out[k].ty = ty / l
  }
  return out
}

/** Catmull-Rom → dense polyline, so 3–4 control points give a fluent curve. */
export function smoothPath(ctrl: Pt[], perSeg = 10): Pt[] {
  if (ctrl.length < 3) return ctrl.slice()
  const out: Pt[] = []
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)]
    const p1 = ctrl[i]
    const p2 = ctrl[i + 1]
    const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)]
    for (let s = 0; s < perSeg; s++) {
      const t = s / perSeg
      const t2 = t * t
      const t3 = t2 * t
      out.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
      })
    }
  }
  out.push(ctrl[ctrl.length - 1])
  return out
}

/**
 * Drag a loaded brush along `pts`. The body is a pressure-tapered ribbon; on
 * top, individual bristles streak along it and break up toward the end of the
 * stroke as the ink runs out, leaving the paper showing through (飞白).
 */
export function brushStroke(ctx: Ctx, pts: Pt[], opts: BrushOpts = {}): void {
  const {
    width = 6,
    color = INK.ink,
    alpha = 1,
    seed = 1,
    dry = 0.35,
    taperIn = 0.12,
    taperOut = 0.3,
    wobble = 0.25,
    progress = 1
  } = opts
  if (progress <= 0) return
  const samples = resample(pts, Math.max(0.8, width * 0.22))
  if (samples.length < 2) return
  const cut = Math.max(2, Math.ceil(samples.length * Math.min(1, progress)))
  const S = samples.slice(0, cut)
  const r = rng(seed)
  const nz = noise1(seed ^ 0x5bd1e995)

  // pressure profile: quick press-in (slightly bulbous head), long lift-out
  const prof = (t: number) => {
    const head = taperIn > 0 ? Math.min(1, t / taperIn) : 1
    const tail = taperOut > 0 ? Math.min(1, (1 - t) / taperOut) : 1
    const press = Math.sqrt(head) * (1 + 0.18 * Math.exp(-((t - taperIn) ** 2) / 0.004))
    return Math.max(0.04, press * Math.pow(Math.max(0, tail), 0.7))
  }
  const halfW = (k: number) => {
    const s = S[k]
    return (width / 2) * prof(s.t) * (1 + wobble * 0.35 * nz(s.t * 9))
  }

  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Body ribbon — it thins and fades where the brush runs dry, so the
  // bristles take over without a visible seam.
  const bodyEnd = dry > 0 ? 1 - dry * 0.6 : 1.01
  const fadeLen = Math.max(0.08, dry * 0.35)
  const bodyK = (t: number) => (t <= bodyEnd - fadeLen ? 1 : Math.max(0, (bodyEnd - t) / fadeLen))
  const left: Pt[] = []
  const right: Pt[] = []
  for (let k = 0; k < S.length; k++) {
    const s = S[k]
    const f = bodyK(s.t)
    if (f <= 0 && k > 1) break
    const hw = halfW(k) * (0.3 + 0.7 * Math.sqrt(f))
    // ragged edge
    const e1 = 1 + 0.12 * nz(k * 0.7 + 3)
    const e2 = 1 + 0.12 * nz(k * 0.7 + 40)
    left.push({ x: s.x - s.ty * hw * e1, y: s.y + s.tx * hw * e1 })
    right.push({ x: s.x + s.ty * hw * e2, y: s.y - s.tx * hw * e2 })
  }
  if (left.length > 1) {
    ctx.globalAlpha = alpha * 0.9
    ctx.beginPath()
    ctx.moveTo(left[0].x, left[0].y)
    for (const p of left) ctx.lineTo(p.x, p.y)
    for (let k = right.length - 1; k >= 0; k--) ctx.lineTo(right[k].x, right[k].y)
    ctx.closePath()
    ctx.fill()
  }

  // Bristles — each carries its own ink load and runs dry at its own point.
  const n = Math.max(3, Math.min(26, Math.round(width / 1.3)))
  for (let b = 0; b < n; b++) {
    const lane = n === 1 ? 0 : (b / (n - 1)) * 2 - 1 // -1..1 across the brush
    const load = 0.55 + r() * 0.9 - Math.abs(lane) * 0.25
    const lw = Math.max(0.35, (width / n) * (0.9 + r() * 0.9))
    ctx.lineWidth = lw
    ctx.globalAlpha = alpha * (0.55 + r() * 0.4)
    let drawing = false
    ctx.beginPath()
    for (let k = 0; k < S.length; k++) {
      const s = S[k]
      const hw = halfW(k)
      const ink =
        load - s.t * dry * 1.6 + 0.22 * nz(k * 0.23 + b * 7.3) + 0.12 * nz(k * 0.9 + b * 3.1)
      const alive = dry <= 0 || ink > 0.18
      const off = lane * hw * 0.92
      const x = s.x - s.ty * off
      const y = s.y + s.tx * off
      if (alive) {
        if (!drawing) {
          ctx.moveTo(x, y)
          drawing = true
        } else ctx.lineTo(x, y)
      } else drawing = false
    }
    ctx.stroke()
  }
  ctx.restore()
}

// ── Ink wash ──────────────────────────────────────────────────────────────────

export interface WashOpts {
  color?: string
  alpha?: number
  seed?: number
  /** Edge raggedness 0..1. */
  bleed?: number
  /** Vertical squash (mountains are wider than tall). */
  squash?: number
}

/** A soft bleeding blot — several translucent ragged layers, darkest at the core. */
export function inkWash(ctx: Ctx, x: number, y: number, rad: number, opts: WashOpts = {}): void {
  const { color = INK.ink, alpha = 0.35, seed = 3, bleed = 0.5, squash = 1 } = opts
  const r = rng(seed)
  const layers = 5
  ctx.save()
  for (let l = 0; l < layers; l++) {
    const k = 1 - l / layers // outer → inner
    const R = rad * (0.45 + 0.55 * k)
    const nz = noise1(seed + l * 101)
    const g = ctx.createRadialGradient(x, y, 0, x, y, R)
    g.addColorStop(0, rgba(color, alpha * (0.22 + 0.2 * (1 - k))))
    g.addColorStop(0.7, rgba(color, alpha * 0.12))
    g.addColorStop(1, rgba(color, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    const steps = 40
    const phase = r() * 10
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2
      const rr = R * (1 + bleed * 0.28 * nz(i * 0.45 + phase))
      const px = x + Math.cos(a) * rr
      const py = y + Math.sin(a) * rr * squash
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

// ── Mountains ─────────────────────────────────────────────────────────────────

export interface MountainOpts {
  color?: string
  /** Body wash opacity. */
  alpha?: number
  seed?: number
  /** Number of peaks along the range. */
  peaks?: number
  /** 0..1 — fraction of the height lost in mist at the foot. */
  mist?: number
  /** Draw texture strokes (皴法) and ridge line. */
  detail?: boolean
  /** Mist color the foot fades into (the paper). */
  mistColor?: string
}

/** Ridge heights for a range: an array of [x, y] along the top edge. */
export function ridgeLine(
  x: number,
  w: number,
  baseY: number,
  h: number,
  seed: number,
  peaks = 3
): Pt[] {
  const r = rng(seed)
  const nz = noise1(seed * 3 + 1)
  const tops: { c: number; hgt: number; wid: number }[] = []
  for (let i = 0; i < peaks; i++) {
    tops.push({
      c: (i + 0.5 + (r() - 0.5) * 0.6) / peaks,
      hgt: i === Math.floor(peaks / 2) ? 1 : 0.45 + r() * 0.45,
      wid: (0.5 + r() * 0.5) / peaks
    })
  }
  const pts: Pt[] = []
  const N = 90
  for (let i = 0; i <= N; i++) {
    const u = i / N
    let v = 0
    for (const t of tops) {
      const d = (u - t.c) / (t.wid * 1.3)
      // steep, slightly rounded peak — the 山 profile of a Song landscape
      v = Math.max(v, t.hgt * Math.exp(-(Math.abs(d) ** 1.5) * 1.6))
    }
    v *= Math.min(1, u * 6, (1 - u) * 6) // fall off at range ends
    v += 0.04 * nz(u * 14) * v
    pts.push({ x: x + u * w, y: baseY - v * h })
  }
  return pts
}

/** A 山水 mountain range: a wash body that dissolves into mist at its foot,
 *  layered darker toward the ridge, with texture strokes and moss dots (点苔). */
export function mountainRange(
  ctx: Ctx,
  x: number,
  baseY: number,
  w: number,
  h: number,
  opts: MountainOpts = {}
): void {
  const {
    color = INK.ink,
    alpha = 0.55,
    seed = 11,
    peaks = 3,
    mist = 0.45,
    detail = true,
    mistColor
  } = opts
  const ridge = ridgeLine(x, w, baseY, h, seed, peaks)
  const r = rng(seed + 9)
  ctx.save()
  // body: vertical gradient, dark ridge → clear foot
  const g = ctx.createLinearGradient(0, baseY - h, 0, baseY)
  g.addColorStop(0, rgba(color, alpha))
  g.addColorStop(Math.max(0.05, 1 - mist), rgba(color, alpha * 0.35))
  g.addColorStop(1, rgba(color, 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(ridge[0].x, baseY)
  for (const p of ridge) ctx.lineTo(p.x, p.y)
  ctx.lineTo(ridge[ridge.length - 1].x, baseY)
  ctx.closePath()
  ctx.fill()

  // inner darker fold — the shadowed face of the main peak
  ctx.save()
  ctx.clip()
  for (let i = 0; i < 3; i++) {
    const cx = x + w * (0.3 + r() * 0.4)
    inkWash(ctx, cx, baseY - h * (0.55 + r() * 0.3), h * (0.35 + r() * 0.2), {
      color,
      alpha: alpha * 0.55,
      seed: seed + i * 13,
      squash: 1.6
    })
  }
  if (detail) {
    // 披麻皴 — long hemp-fibre texture strokes following the slope
    const strokes = Math.round(6 + w / 26)
    for (let i = 0; i < strokes; i++) {
      const u = r()
      const top = ridge[Math.round(u * (ridge.length - 1))]
      const len = h * (0.2 + r() * 0.35)
      const dir = u < 0.5 ? -1 : 1
      const sx = top.x
      const sy = top.y + h * 0.04 + r() * h * 0.15
      brushStroke(
        ctx,
        smoothPath([
          { x: sx, y: sy },
          { x: sx + dir * len * 0.18, y: sy + len * 0.5 },
          { x: sx + dir * len * 0.3, y: sy + len }
        ]),
        {
          width: 1.2 + r() * 1.8,
          color,
          alpha: alpha * 0.55,
          seed: seed + i * 7,
          dry: 0.7,
          taperIn: 0.05,
          taperOut: 0.6
        }
      )
    }
  }
  ctx.restore()

  if (detail) {
    // ridge contour — broken strokes, heavier near the summit, gone in the
    // low foothills where the mountain melts into the wash
    let i = 0
    let si = 0
    while (i < ridge.length - 2) {
      const len = 8 + Math.floor(r() * 22)
      const seg = ridge.slice(i, Math.min(ridge.length, i + len))
      const lift = Math.min(...seg.map((p) => p.y))
      const tall = (baseY - lift) / h
      if (tall > 0.18 && seg.length > 2) {
        brushStroke(
          ctx,
          seg.filter((_, j) => j % 2 === 0 || j === seg.length - 1),
          {
            width: Math.max(1, h * 0.02 * (0.5 + tall)),
            color,
            alpha: Math.min(1, alpha * (0.9 + tall)),
            seed: seed + 77 + si++,
            dry: 0.45,
            taperIn: 0.15,
            taperOut: 0.35
          }
        )
      }
      i += len + Math.floor(r() * 5)
    }
    // 点苔 moss dots along the ridge
    const dots = Math.round(4 + w / 40)
    ctx.fillStyle = rgba(color, Math.min(1, alpha * 1.6))
    for (let i = 0; i < dots; i++) {
      const p = ridge[Math.round(r() * (ridge.length - 1))]
      if (baseY - p.y < h * 0.25) continue
      const s = 0.8 + r() * 1.6
      ctx.beginPath()
      ctx.ellipse(p.x + (r() - 0.5) * 4, p.y + r() * 3, s * 1.3, s, r() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (mistColor) {
    const m = ctx.createLinearGradient(0, baseY - h * mist, 0, baseY)
    m.addColorStop(0, rgba(mistColor, 0))
    m.addColorStop(1, rgba(mistColor, 0.9))
    ctx.fillStyle = m
    ctx.fillRect(x - 2, baseY - h * mist, w + 4, h * mist + 1)
  }
  ctx.restore()
}

// ── Seals ─────────────────────────────────────────────────────────────────────

export interface SealOpts {
  size?: number
  color?: string
  /** 'yang' 朱文 = red characters on paper; 'yin' 白文 = paper characters cut from red. */
  mode?: 'yang' | 'yin'
  seed?: number
  font?: string
  /** Round seal instead of square. */
  round?: boolean
}

/** Up to four characters for a seal: CJK characters from the text, else initials. */
export function sealChars(text: string): string {
  const cjk = (text || '').match(/[㐀-鿿豈-﫿]/g)
  if (cjk && cjk.length) return cjk.slice(0, 4).join('')
  const words = (text || '').trim().split(/\s+/).filter(Boolean)
  const ini = words.map((w) => w[0].toUpperCase()).join('')
  return (ini || '印').slice(0, 2)
}

const sealCache = new Map<string, HTMLCanvasElement>()

/** A cinnabar seal impression with eroded edges and uneven paste coverage. */
export function sealCanvas(text: string, opts: SealOpts = {}): HTMLCanvasElement {
  const {
    size = 96,
    color = INK.cinnabar,
    mode = 'yin',
    seed = hashStr(text),
    font = '"Ink Kai", "Ink Xing", "STKaiti", "KaiTi", serif',
    round = false
  } = opts
  const key = `${text}|${size}|${color}|${mode}|${seed}|${round}`
  const hit = sealCache.get(key)
  if (hit) return hit
  const chars = sealChars(text)
  const c = makeCanvas(size, size)
  const ctx = c.getContext('2d') as Ctx
  const r = rng(seed)
  const pad = size * 0.06
  const s = size - pad * 2
  ctx.fillStyle = color
  ctx.strokeStyle = color

  // the stone's outline — not quite square
  const outline = () => {
    ctx.beginPath()
    if (round) {
      ctx.ellipse(size / 2, size / 2, s / 2, s / 2, 0, 0, Math.PI * 2)
      return
    }
    const j = () => (r() - 0.5) * size * 0.025
    ctx.moveTo(pad + j(), pad + j())
    ctx.lineTo(size - pad + j(), pad + j())
    ctx.lineTo(size - pad + j(), size - pad + j())
    ctx.lineTo(pad + j(), size - pad + j())
    ctx.closePath()
  }

  // character layout: seals read right column first, top to bottom
  const n = chars.length
  const cells: { ch: string; x: number; y: number; fs: number }[] = []
  const inner = s * 0.84
  const o = (size - inner) / 2
  const isLatin = /^[A-Z]+$/.test(chars)
  if (n === 1) cells.push({ ch: chars, x: size / 2, y: size / 2, fs: inner * 0.92 })
  else if (n === 2 && isLatin) {
    cells.push({ ch: chars[0], x: size / 2 - inner * 0.22, y: size / 2, fs: inner * 0.62 })
    cells.push({ ch: chars[1], x: size / 2 + inner * 0.22, y: size / 2, fs: inner * 0.62 })
  } else if (n === 2) {
    cells.push({ ch: chars[0], x: size / 2, y: o + inner * 0.27, fs: inner * 0.5 })
    cells.push({ ch: chars[1], x: size / 2, y: o + inner * 0.75, fs: inner * 0.5 })
  } else if (n === 3) {
    cells.push({ ch: chars[0], x: o + inner * 0.73, y: size / 2, fs: inner * 0.56 })
    cells.push({ ch: chars[1], x: o + inner * 0.27, y: o + inner * 0.27, fs: inner * 0.47 })
    cells.push({ ch: chars[2], x: o + inner * 0.27, y: o + inner * 0.75, fs: inner * 0.47 })
  } else {
    const pos = [
      [0.73, 0.27],
      [0.73, 0.75],
      [0.27, 0.27],
      [0.27, 0.75]
    ]
    chars
      .split('')
      .forEach((ch, i) =>
        cells.push({ ch, x: o + inner * pos[i][0], y: o + inner * pos[i][1], fs: inner * 0.47 })
      )
  }
  const drawChars = () => {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const cell of cells) {
      ctx.font = `${Math.round(cell.fs)}px ${font}`
      ctx.fillText(cell.ch, cell.x, cell.y + cell.fs * 0.04)
    }
  }

  if (mode === 'yin') {
    outline()
    ctx.fill()
    ctx.globalCompositeOperation = 'destination-out'
    drawChars()
  } else {
    outline()
    ctx.lineWidth = size * 0.055
    ctx.stroke()
    drawChars()
  }

  // erosion: chip the edges and knock speckles out of the paste
  ctx.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < size * 0.9; i++) {
    const edge = r() < 0.55
    let x: number
    let y: number
    if (edge) {
      const side = Math.floor(r() * 4)
      const u = r() * size
      const d = pad + (r() - 0.3) * size * 0.05
      x = side === 0 ? u : side === 1 ? size - d : side === 2 ? u : d
      y = side === 0 ? d : side === 1 ? u : side === 2 ? size - d : u
    } else {
      x = r() * size
      y = r() * size
    }
    const rr = (edge ? 0.6 + r() * 2.2 : 0.3 + r() * 1.1) * (size / 96)
    ctx.globalAlpha = edge ? 1 : 0.4 + r() * 0.6
    ctx.beginPath()
    ctx.arc(x, y, rr, 0, Math.PI * 2)
    ctx.fill()
  }
  // uneven paste: a few lighter patches
  ctx.globalAlpha = 1
  for (let i = 0; i < 5; i++) {
    const x = r() * size
    const y = r() * size
    const g = ctx.createRadialGradient(x, y, 0, x, y, size * (0.1 + r() * 0.18))
    g.addColorStop(0, 'rgba(0,0,0,0.28)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  ctx.globalCompositeOperation = 'source-over'
  sealCache.set(key, c)
  return c
}

export function sealDataUrl(text: string, opts: SealOpts = {}): string {
  const key = `seal|${text}|${JSON.stringify(opts)}`
  let u = urlCache.get(key)
  if (!u) {
    u = sealCanvas(text, opts).toDataURL('image/png')
    urlCache.set(key, u)
  }
  return u
}

// ── CSS-facing brush marks ────────────────────────────────────────────────────

export type StrokeKind = 'underline' | 'divider' | 'enso' | 'dab' | 'frame'

/** A single brush mark as a transparent PNG data URL (for backgrounds/masks).
 *  Drawn in `color` — use it as a mask-image to tint it with CSS instead. */
export function strokeDataUrl(
  kind: StrokeKind,
  opts: { w?: number; h?: number; seed?: number; color?: string; dry?: number } = {}
): string {
  const { seed = 5, color = INK.ink, dry } = opts
  const dims: Record<StrokeKind, [number, number]> = {
    underline: [420, 40],
    divider: [900, 28],
    enso: [320, 320],
    dab: [160, 90],
    frame: [600, 400]
  }
  const [w, h] = [opts.w ?? dims[kind][0], opts.h ?? dims[kind][1]]
  const key = `stroke|${kind}|${w}|${h}|${seed}|${color}|${dry}`
  const hit = urlCache.get(key)
  if (hit) return hit
  const c = makeCanvas(w, h)
  const ctx = c.getContext('2d') as Ctx
  const r = rng(seed)
  if (kind === 'underline' || kind === 'divider') {
    const thick = kind === 'underline' ? h * 0.42 : h * 0.3
    const mid = h / 2
    brushStroke(
      ctx,
      smoothPath([
        { x: h * 0.4, y: mid + thick * 0.15 },
        { x: w * 0.3, y: mid - thick * 0.12 + (r() - 0.5) * 3 },
        { x: w * 0.7, y: mid + (r() - 0.5) * 4 },
        { x: w - h * 0.3, y: mid - thick * 0.2 }
      ]),
      { width: thick, color, seed, dry: dry ?? 0.55, taperIn: 0.04, taperOut: 0.35 }
    )
  } else if (kind === 'enso') {
    // 円相 — one breath, a circle left slightly open
    const cx = w / 2
    const cy = h / 2
    const R = w * 0.38
    const pts: Pt[] = []
    const start = -Math.PI * 0.55
    const sweep = Math.PI * 1.86
    for (let i = 0; i <= 80; i++) {
      const a = start + (i / 80) * sweep
      const rr = R * (1 + 0.03 * Math.sin(i * 0.3 + seed))
      pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr })
    }
    brushStroke(ctx, pts, {
      width: w * 0.085,
      color,
      seed,
      dry: dry ?? 0.6,
      taperIn: 0.03,
      taperOut: 0.25
    })
  } else if (kind === 'dab') {
    brushStroke(
      ctx,
      smoothPath([
        { x: w * 0.12, y: h * 0.6 },
        { x: w * 0.45, y: h * 0.42 },
        { x: w * 0.88, y: h * 0.5 }
      ]),
      { width: h * 0.7, color, seed, dry: dry ?? 0.45, taperIn: 0.1, taperOut: 0.45 }
    )
  } else {
    // frame: four strokes, slightly overshooting at the corners
    const m = 10
    const sides: Pt[][] = [
      [
        { x: m, y: m + 2 },
        { x: w - m, y: m }
      ],
      [
        { x: w - m - 1, y: m - 3 },
        { x: w - m + 1, y: h - m }
      ],
      [
        { x: w - m + 3, y: h - m - 1 },
        { x: m, y: h - m + 1 }
      ],
      [
        { x: m + 1, y: h - m + 3 },
        { x: m - 1, y: m - 2 }
      ]
    ]
    sides.forEach((s, i) =>
      brushStroke(
        ctx,
        smoothPath([
          s[0],
          {
            x: (s[0].x + s[1].x) / 2 + (r() - 0.5) * 3,
            y: (s[0].y + s[1].y) / 2 + (r() - 0.5) * 3
          },
          s[1]
        ]),
        {
          width: 3.2,
          color,
          seed: seed + i,
          dry: 0.5,
          taperIn: 0.05,
          taperOut: 0.25
        }
      )
    )
  }
  const u = c.toDataURL('image/png')
  urlCache.set(key, u)
  return u
}

/** A wide misty-mountain backdrop band (transparent PNG data URL), used for
 *  page headers and empty states. */
export function landscapeDataUrl(w = 1200, h = 260, seed = 21, color = INK.ink): string {
  const key = `land|${w}|${h}|${seed}|${color}`
  const hit = urlCache.get(key)
  if (hit) return hit
  const c = makeCanvas(w, h)
  const ctx = c.getContext('2d') as Ctx
  const r = rng(seed)
  // far → near: paler, then darker and more detailed
  const layers = [
    { a: 0.12, hh: 0.75, n: 5, detail: false },
    { a: 0.22, hh: 0.6, n: 4, detail: false },
    { a: 0.45, hh: 0.5, n: 3, detail: true }
  ]
  layers.forEach((L, li) => {
    let x = -w * 0.05
    while (x < w) {
      const ww = w * (0.22 + r() * 0.28)
      mountainRange(ctx, x, h, ww, h * L.hh * (0.7 + r() * 0.5), {
        color,
        alpha: L.a,
        seed: seed + li * 100 + Math.round(x),
        peaks: 2 + Math.floor(r() * L.n),
        mist: 0.55,
        detail: L.detail
      })
      x += ww * (0.55 + r() * 0.3)
    }
  })
  const u = c.toDataURL('image/png')
  urlCache.set(key, u)
  return u
}

// ── Theme install ─────────────────────────────────────────────────────────────

let installed = false

/** Generate the Ink theme's CSS textures once and publish them on <html> as
 *  custom properties (url(...) values). Cheap to call repeatedly. */
export function installInkAssets(): void {
  if (installed || typeof document === 'undefined') return
  installed = true
  const st = document.documentElement.style
  const set = (k: string, url: string) => st.setProperty(k, `url("${url}")`)
  set('--ink-paper', paperDataUrl(512, 512, { tone: INK.paper, fiber: 0.7, seed: 11 }))
  set('--ink-paper-light', paperDataUrl(512, 512, { tone: INK.paperLight, fiber: 0.55, seed: 12 }))
  set('--ink-underline', strokeDataUrl('underline', { seed: 3 }))
  set('--ink-divider', strokeDataUrl('divider', { seed: 8 }))
  set('--ink-enso', strokeDataUrl('enso', { seed: 4 }))
  set('--ink-dab', strokeDataUrl('dab', { seed: 6 }))
  set('--ink-frame', strokeDataUrl('frame', { seed: 9 }))
  set('--ink-landscape', landscapeDataUrl(1400, 280, 21))
  // the seal carves glyphs from the calligraphy font — wait for it
  inkFontsReady().then(() =>
    set('--ink-seal', sealDataUrl('家譜', { size: 120, mode: 'yin', seed: 41 }))
  )
}

/** The ink theme's font stacks (also declared as CSS vars in styles/ink.css). */
export const INK_FONTS = {
  kai: '"Ink Kai", "STKaiti", "KaiTi", "Kaiti SC", "BiauKai", serif',
  xing: '"Ink Xing", "Ink Kai", "STXingkai", "STKaiti", "KaiTi", serif',
  cao: '"Ink Cao", "Ink Xing", "STXingkai", "KaiTi", serif',
  serif: '"Ink Serif", "Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", Georgia, serif'
}

let fontsPromise: Promise<void> | null = null

/** Resolves once the calligraphy faces are loaded (or after 2.5s regardless),
 *  so canvas renderers can draw text with them instead of a fallback. */
export function inkFontsReady(): Promise<void> {
  if (fontsPromise) return fontsPromise
  if (typeof document === 'undefined' || !document.fonts?.load) return Promise.resolve()
  const loads = [
    document.fonts.load('32px "Ink Kai"', 'Aa家'),
    document.fonts.load('32px "Ink Xing"', 'Aa家'),
    document.fonts.load('32px "Ink Cao"', 'Aa家'),
    document.fonts.load('16px "Ink Serif"', 'Aa')
  ]
  fontsPromise = Promise.race([
    Promise.allSettled(loads).then(() => undefined),
    new Promise<void>((res) => setTimeout(res, 2500))
  ])
  return fontsPromise
}

/** An opaque ink blot with ragged, bleeding edges, capillary tendrils and a
 *  few splatters, as a VECTOR (SVG) data URL so it stays crisp when scaled to
 *  full-screen — the alpha mask for the theme switch's "ink spreading on
 *  paper" reveal. The blot fills the central ~84% of its box (radius 0.42). */
export function inkBlotMaskUrl(seed = 17): string {
  const key = `blot|${seed}`
  const hit = urlCache.get(key)
  if (hit) return hit
  const r = rng(seed)
  const S = 1000
  const cx = S / 2
  const R = S * 0.42
  const f = (n: number) => n.toFixed(1)
  const ring = (rr: number, amp: number, s: number) => {
    const nz = noise1(s)
    let d = ''
    for (let i = 0; i <= 180; i++) {
      const a = (i / 180) * Math.PI * 2
      const k = 1 + amp * nz(i * 0.2) + amp * 0.4 * nz(i * 0.8 + 7)
      d += `${i ? 'L' : 'M'}${f(cx + Math.cos(a) * rr * k)} ${f(cx + Math.sin(a) * rr * k)}`
    }
    return d + 'Z'
  }
  // one solid core whose edge is roughened by turbulence (paper fibres
  // wicking the ink) and feathered slightly — no stepped halo rings
  const body = `<path d="${ring(R, 0.06, seed)}"/>`
  let dots = ''
  for (let i = 0; i < 18; i++) {
    const a = r() * Math.PI * 2
    const d = R * (1.05 + r() * 0.12)
    dots += `<circle cx="${f(cx + Math.cos(a) * d)}" cy="${f(cx + Math.sin(a) * d)}" r="${f(2 + r() * 9)}"/>`
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">` +
    `<filter id="b" x="-10%" y="-10%" width="120%" height="120%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="${seed}"/>` +
    `<feDisplacementMap in="SourceGraphic" scale="34" xChannelSelector="R" yChannelSelector="G"/>` +
    `<feGaussianBlur stdDeviation="1.6"/></filter>` +
    `<g fill="#000" filter="url(#b)">${body}${dots}</g></svg>`
  const u = `data:image/svg+xml,${encodeURIComponent(svg)}`
  urlCache.set(key, u)
  return u
}
