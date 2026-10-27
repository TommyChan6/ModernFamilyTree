// Medieval theme art — the illuminated-manuscript counterpart of lib/inkArt.ts.
// Deterministic Canvas-2D / SVG painters for the theme's textures, plus the
// pure heraldry and geometry they are built on (tests: tests/medievalArt.test.js).
//
//   vellumCanvas / vellumDataUrl   calfskin parchment: mottling, hair pores,
//                                  faint veins, foxing spots; tiles seamlessly
//   nibStroke                      a broad-nib pen stroke (width follows the
//                                  angle of the pen, like a scribe's quill)
//   flourishDataUrl                pen-work ornaments: the rubric divider, a
//                                  swash underline, the gilded corner fleuron
//   roseDataUrl                    the compass rose with its fleur-de-lis north
//   skylineDataUrl                 rolling hills, a forest and castles with
//                                  pennants, tiling seamlessly along x
//   waxSealDataUrl                 a red wax seal pressed with the family tree
//   burnMaskUrl                    the ragged burning hole of the theme reveal
//   blazonFor / heraldicFieldCss   per-person coats of arms as CSS backgrounds
//   installMedievalAssets          publishes the textures on <html> as --med-*
//
// Only the pure helpers run without a DOM; the painters need a canvas.

import { rng, hashStr, noise1, rgba } from './inkArt'

export const MED = {
  vellum: '#ead9b5',
  vellumLight: '#f4e8cb',
  vellumDeep: '#d8bf8f',
  ink: '#2b1d12', // iron-gall ink
  ink2: '#4a3524',
  gold: '#c9a043',
  goldLight: '#f1d88c',
  goldDeep: '#8a641c',
  lapis: '#24478a', // ultramarine
  lapisDeep: '#172f5e',
  vermilion: '#a8321e', // the rubricator's red
  verdigris: '#2f6b4f',
  wax: '#8e1f1a',
  oak: '#4a2f17'
}

type Ctx = CanvasRenderingContext2D
export interface Pt {
  x: number
  y: number
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

const urlCache = new Map<string, string>()
function cached(key: string, paint: () => string): string {
  let u = urlCache.get(key)
  if (!u) {
    u = paint()
    urlCache.set(key, u)
  }
  return u
}

// ── Heraldry (pure) ──────────────────────────────────────────────────────────

/** The heraldic tinctures: two metals and five colours. */
export const TINCTURES = {
  or: '#c9a043',
  argent: '#ece4d2',
  gules: '#a8321e',
  azure: '#24478a',
  vert: '#2f6b4f',
  purpure: '#6b3a6e',
  sable: '#2a211b'
} as const
export type Tincture = keyof typeof TINCTURES

const METALS: Tincture[] = ['or', 'argent']
export const DIVISIONS = [
  'plain',
  'per-pale',
  'per-fess',
  'per-bend',
  'per-bend-sinister',
  'quarterly',
  'per-saltire',
  'paly',
  'bendy',
  'chequy'
] as const
export type Division = (typeof DIVISIONS)[number]

export interface Blazon {
  /** The colour (never a metal) — carries the person's gender, as the
   *  avatars of the other themes do. */
  colour: Tincture
  /** The metal it is paired with: or or argent. */
  metal: Tincture
  division: Division
}

/** The colour a gender is blazoned in: azure, gules, else vert. */
export function genderTincture(gender: string | null | undefined): Tincture {
  return gender === 'male' ? 'azure' : gender === 'female' ? 'gules' : 'vert'
}

/**
 * A person's coat of arms, stable for their id. The rule of tincture holds —
 * a metal is always set against a colour, so every field reads.
 */
export function blazonFor(seed: string | number, gender?: string | null): Blazon {
  const h = typeof seed === 'number' ? seed >>> 0 : hashStr(String(seed ?? ''))
  const r = rng(h)
  return {
    colour: genderTincture(gender),
    metal: METALS[Math.floor(r() * METALS.length)],
    division: DIVISIONS[Math.floor(r() * DIVISIONS.length)]
  }
}

/** The field of a blazon as a CSS `background` value (with a soft enamel sheen). */
export function heraldicFieldCss(b: Blazon): string {
  const A = TINCTURES[b.colour]
  const B = TINCTURES[b.metal]
  const sheen = 'radial-gradient(circle at 32% 26%, rgba(255,250,235,0.32), transparent 58%)'
  const rim = 'radial-gradient(circle, transparent 62%, rgba(40,24,10,0.28) 100%)'
  let field: string
  switch (b.division) {
    case 'per-pale':
      field = `linear-gradient(90deg, ${A} 50%, ${B} 50%)`
      break
    case 'per-fess':
      field = `linear-gradient(180deg, ${A} 50%, ${B} 50%)`
      break
    case 'per-bend':
      field = `linear-gradient(135deg, ${A} 50%, ${B} 50%)`
      break
    case 'per-bend-sinister':
      field = `linear-gradient(45deg, ${B} 50%, ${A} 50%)`
      break
    case 'quarterly':
      field = `conic-gradient(${A} 0 25%, ${B} 0 50%, ${A} 0 75%, ${B} 0)`
      break
    case 'per-saltire':
      field = `conic-gradient(from 45deg, ${A} 0 25%, ${B} 0 50%, ${A} 0 75%, ${B} 0)`
      break
    case 'paly':
      field = `repeating-linear-gradient(90deg, ${A} 0 16.667%, ${B} 16.667% 33.333%)`
      break
    case 'bendy':
      field = `repeating-linear-gradient(135deg, ${A} 0 12.5%, ${B} 12.5% 25%)`
      break
    case 'chequy':
      field = `conic-gradient(${A} 0 25%, ${B} 0 50%, ${A} 0 75%, ${B} 0) 0 0 / 34% 34%`
      break
    default:
      field = `linear-gradient(${A}, ${A})`
  }
  return `${sheen}, ${rim}, ${field}`
}

/** CSS background for a person's avatar disc in the medieval theme: their
 *  arms when an id is known, else a plain field of their gender's colour. */
export function medievalAvatarBg(gender: string | null | undefined, seed?: string | null): string {
  if (seed == null || seed === '')
    return heraldicFieldCss({ colour: genderTincture(gender), metal: 'or', division: 'plain' })
  return heraldicFieldCss(blazonFor(seed, gender))
}

// ── Geometry (pure) ──────────────────────────────────────────────────────────

export interface HillWave {
  k: number // whole cycles across the tile — keeps the strip seamless
  a: number // amplitude, 0..1 of the layer height
  p: number // phase
}

/** A seamlessly-tiling ridge: a few sine waves with whole cycle counts. */
export function hillWaves(seed: number, n = 4): HillWave[] {
  const r = rng(seed)
  return Array.from({ length: n }, (_, i) => ({
    k: 1 + i * 2 + Math.floor(r() * 2),
    a: (0.5 / (i + 1)) * (0.6 + r() * 0.6),
    p: r() * Math.PI * 2
  }))
}

/** Height 0..1 of a ridge at x on a tile w wide (h(0) === h(w)). */
export function hillHeight(waves: HillWave[], x: number, w: number): number {
  let s = 0
  let norm = 0
  for (const v of waves) {
    s += v.a * Math.sin((2 * Math.PI * v.k * x) / w + v.p)
    norm += v.a
  }
  return norm > 0 ? 0.5 + (0.5 * s) / norm : 0.5
}

export interface TowerPlan {
  dx: number // offset from the castle centre, in castle units
  w: number
  h: number
  roof: 'cone' | 'crenel'
  flag: boolean
}

/** A castle as towers along a curtain wall, the keep tallest in the middle.
 *  Units are relative to the castle's scale (the wall is 1 unit high). */
export function castlePlan(seed: number): { wallW: number; towers: TowerPlan[] } {
  const r = rng(seed)
  const n = 2 + Math.floor(r() * 3) // 2..4 towers + the keep
  const wallW = 4 + r() * 3
  const towers: TowerPlan[] = []
  for (let i = 0; i < n; i++) {
    const dx = -wallW / 2 + (wallW * i) / Math.max(1, n - 1)
    towers.push({
      dx,
      w: 0.7 + r() * 0.35,
      h: 1.6 + r() * 0.9,
      roof: r() < 0.6 ? 'cone' : 'crenel',
      flag: r() < 0.5
    })
  }
  towers.push({ dx: (r() - 0.5) * 0.8, w: 1.3, h: 2.9 + r() * 0.8, roof: 'crenel', flag: true })
  return { wallW, towers }
}

/** The points of a compass rose: `n` rays alternating long/short, as
 *  [angle, length 0..1] pairs starting at north, clockwise. */
export function roseRays(n = 16): Array<[number, number]> {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2
    const len = i % 4 === 0 ? 1 : i % 2 === 0 ? 0.68 : 0.42
    return [a, len] as [number, number]
  })
}

// ── Vellum ───────────────────────────────────────────────────────────────────

export interface VellumOpts {
  tone?: string
  /** 0..1 — mottling, pores and foxing. */
  age?: number
  seed?: number
}

/** A tileable sheet of calfskin vellum. */
export function vellumCanvas(w = 512, h = 512, opts: VellumOpts = {}): HTMLCanvasElement {
  const { tone = MED.vellum, age = 0.6, seed = 5 } = opts
  const c = makeCanvas(w, h)
  const ctx = c.getContext('2d') as Ctx
  const r = rng(seed)
  ctx.fillStyle = tone
  ctx.fillRect(0, 0, w, h)
  const wrapped = (x: number, y: number, rad: number, draw: () => void) => {
    for (const ox of [-w, 0, w])
      for (const oy of [-h, 0, h]) {
        if (x + ox + rad < 0 || x + ox - rad > w || y + oy + rad < 0 || y + oy - rad > h) continue
        ctx.save()
        ctx.translate(ox, oy)
        draw()
        ctx.restore()
      }
  }
  // Mottling: the skin was never an even colour — warm patches and pale flats.
  for (let i = 0; i < 80; i++) {
    const x = r() * w
    const y = r() * h
    const rad = (0.06 + r() * 0.16) * Math.max(w, h)
    const dark = r() < 0.55
    const a = (dark ? 0.035 : 0.04) * (0.5 + age)
    wrapped(x, y, rad, () => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
      g.addColorStop(0, dark ? `rgba(150,105,45,${a})` : `rgba(255,248,226,${a})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    })
  }
  // Grain.
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 8
    d[i] += n
    d[i + 1] += n * 0.95
    d[i + 2] += n * 0.8
  }
  ctx.putImageData(img, 0, 0)
  // Veins: long faint sinuous darker lines where the skin was stretched.
  const nz = noise1(seed + 3)
  ctx.lineCap = 'round'
  for (let i = 0; i < 7; i++) {
    let x = r() * w
    let y = r() * h
    let a = r() * Math.PI * 2
    const len = 90 + r() * 160
    ctx.strokeStyle = `rgba(130,90,45,${0.035 + r() * 0.04})`
    ctx.lineWidth = 1.2 + r() * 2.4
    const pts: Pt[] = [{ x, y }]
    for (let s = 0; s < 24; s++) {
      a += nz(i * 9 + s * 0.4) * 0.35
      x += (Math.cos(a) * len) / 24
      y += (Math.sin(a) * len) / 24
      pts.push({ x, y })
    }
    wrapped(pts[12].x, pts[12].y, len, () => {
      ctx.beginPath()
      pts.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
      ctx.stroke()
    })
  }
  // Hair pores: tiny dark dots in loose drifts (the grain side of the skin).
  const pores = Math.round(((900 * (w * h)) / (512 * 512)) * (0.4 + age))
  for (let i = 0; i < pores; i++) {
    const x = r() * w
    const y = r() * h
    ctx.fillStyle = `rgba(95,62,28,${0.06 + r() * 0.12})`
    ctx.beginPath()
    ctx.arc(x, y, 0.35 + r() * 0.6, 0, Math.PI * 2)
    ctx.fill()
  }
  // Foxing: rust-brown spots, in small clusters.
  const clusters = Math.round(3 + age * 5)
  for (let i = 0; i < clusters; i++) {
    const cx = r() * w
    const cy = r() * h
    const k = 2 + Math.floor(r() * 5)
    for (let j = 0; j < k; j++) {
      const x = cx + (r() - 0.5) * 40
      const y = cy + (r() - 0.5) * 40
      const rad = 1.5 + r() * 5
      wrapped(x, y, rad, () => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
        g.addColorStop(0, `rgba(140,82,32,${0.12 + r() * 0.12})`)
        g.addColorStop(0.7, 'rgba(140,82,32,0.05)')
        g.addColorStop(1, 'rgba(140,82,32,0)')
        ctx.fillStyle = g
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2)
      })
    }
  }
  return c
}

export function vellumDataUrl(w = 512, h = 512, opts: VellumOpts = {}): string {
  return cached(`vellum|${w}|${h}|${JSON.stringify(opts)}`, () =>
    vellumCanvas(w, h, opts).toDataURL('image/png')
  )
}

// ── The broad-nib pen ────────────────────────────────────────────────────────

export interface NibOpts {
  /** Nib width (px). */
  width?: number
  /** Nib angle (radians) — 30–40° is the textura scribe's hold. */
  angle?: number
  /** Hairline width where the stroke runs along the nib. */
  hair?: number
  /** Taper the first/last fraction of the stroke to the hairline. */
  taper?: number
  color?: string
}

/** Stroke width at a point: the projection of the nib across the direction
 *  of travel (pure; exported for tests). */
export function nibWidth(dir: number, angle: number, width: number, hair: number): number {
  return Math.max(hair, width * Math.abs(Math.sin(dir - angle)))
}

/** Fill a polyline as a broad-nib pen stroke. */
export function nibStroke(ctx: Ctx, pts: Pt[], opts: NibOpts = {}): void {
  const { width = 6, angle = Math.PI / 5, hair = 0.8, taper = 0.12, color = MED.ink } = opts
  if (pts.length < 2) return
  const L: Pt[] = []
  const R: Pt[] = []
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(n - 1, i + 1)]
    const dir = Math.atan2(b.y - a.y, b.x - a.x)
    const u = i / (n - 1)
    const t = taper > 0 ? Math.min(1, u / taper, (1 - u) / taper) : 1
    const hw = (nibWidth(dir, angle, width, hair) * (0.25 + 0.75 * t)) / 2
    const nx = -Math.sin(dir)
    const ny = Math.cos(dir)
    L.push({ x: pts[i].x + nx * hw, y: pts[i].y + ny * hw })
    R.push({ x: pts[i].x - nx * hw, y: pts[i].y - ny * hw })
  }
  ctx.fillStyle = color
  ctx.beginPath()
  L.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i].x, R[i].y)
  ctx.closePath()
  ctx.fill()
}

/** Points along a spiral volute — the curl that ends a pen flourish. */
export function volute(cx: number, cy: number, r0: number, turns: number, dir = 1, a0 = 0): Pt[] {
  const pts: Pt[] = []
  const steps = Math.max(12, Math.round(turns * 40))
  for (let i = 0; i <= steps; i++) {
    const u = i / steps
    const a = a0 + dir * u * turns * Math.PI * 2
    const rr = r0 * (1 - u * 0.82)
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr })
  }
  return pts
}

function quad(p0: Pt, p1: Pt, p2: Pt, steps = 24): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const m = 1 - t
    out.push({
      x: m * m * p0.x + 2 * m * t * p1.x + t * t * p2.x,
      y: m * m * p0.y + 2 * m * t * p1.y + t * t * p2.y
    })
  }
  return out
}

function leaf(ctx: Ctx, x: number, y: number, len: number, rot: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(len * 0.5, -len * 0.42, len, 0)
  ctx.quadraticCurveTo(len * 0.5, len * 0.42, 0, 0)
  ctx.fill()
  ctx.restore()
}

// ── Flourishes ───────────────────────────────────────────────────────────────

export type FlourishKind = 'divider' | 'underline' | 'corner'

/**
 * Pen-work ornaments as PNG data URLs.
 *   divider   — a rubric rule: a lozenge between two dots, the rule tapering
 *               out to curling volutes with a leaf (a mask: paint it with
 *               background-color)
 *   underline — a swash under a word, ending in a loop (a mask)
 *   corner    — the gilded corner fleuron of an illuminated page (in colour:
 *               raised gold with an ink outline); drawn for the top-left corner
 */
export function flourishDataUrl(kind: FlourishKind, seed = 1): string {
  return cached(`flourish|${kind}|${seed}`, () => {
    if (kind === 'corner') return cornerCanvas(seed).toDataURL('image/png')
    const W = kind === 'divider' ? 640 : 360
    const H = kind === 'divider' ? 44 : 34
    const c = makeCanvas(W, H)
    const ctx = c.getContext('2d') as Ctx
    const r = rng(seed)
    const col = '#000'
    if (kind === 'divider') {
      const cy = H / 2
      // the rule, broad at the centre, hairline at the ends
      for (const side of [-1, 1]) {
        const pts: Pt[] = []
        for (let i = 0; i <= 40; i++) {
          const u = i / 40
          pts.push({
            x: W / 2 + side * (22 + u * (W / 2 - 84)),
            y: cy + Math.sin(u * Math.PI) * 1.2
          })
        }
        nibStroke(ctx, pts, { width: 4.2, angle: Math.PI / 2, hair: 0.9, taper: 0.5, color: col })
        const ex = W / 2 + side * (W / 2 - 62)
        nibStroke(ctx, volute(ex, cy - 6, 12, 1.15, side, Math.PI / 2 + (side < 0 ? Math.PI : 0)), {
          width: 3,
          angle: Math.PI / 4,
          hair: 0.8,
          taper: 0.15,
          color: col
        })
        leaf(ctx, ex - side * 2, cy + 3, 15, side > 0 ? 0.5 : Math.PI - 0.5, col)
        ctx.fillStyle = col
        ctx.beginPath()
        ctx.arc(W / 2 + side * 15, cy, 2.2, 0, Math.PI * 2)
        ctx.fill()
      }
      // the lozenge, voided
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.moveTo(W / 2, cy - 9)
      ctx.lineTo(W / 2 + 8, cy)
      ctx.lineTo(W / 2, cy + 9)
      ctx.lineTo(W / 2 - 8, cy)
      ctx.closePath()
      ctx.moveTo(W / 2, cy - 4)
      ctx.lineTo(W / 2 - 3.5, cy)
      ctx.lineTo(W / 2, cy + 4)
      ctx.lineTo(W / 2 + 3.5, cy)
      ctx.closePath()
      ctx.fill('evenodd')
    } else {
      // underline swash: a long shallow S, thick in its belly, with an end loop
      const wob = noise1(seed)
      const pts: Pt[] = []
      for (let i = 0; i <= 60; i++) {
        const u = i / 60
        pts.push({
          x: 8 + u * (W - 60),
          y: H * 0.55 + Math.sin(u * Math.PI * 1.4 + 0.3) * 4 + wob(u * 6) * 1.2
        })
      }
      const end = pts[pts.length - 1]
      const loop = volute(end.x + 12, end.y - 6, 12, 0.9 + r() * 0.1, -1, Math.PI * 0.9)
      nibStroke(ctx, pts.concat(loop), {
        width: 5,
        angle: Math.PI / 5,
        hair: 0.9,
        taper: 0.18,
        color: col
      })
    }
    return c.toDataURL('image/png')
  })
}

function cornerCanvas(seed: number): HTMLCanvasElement {
  const S = 128
  const c = makeCanvas(S, S)
  const ctx = c.getContext('2d') as Ctx
  const r = rng(seed)
  const gold = ctx.createLinearGradient(0, 0, S, S)
  gold.addColorStop(0, MED.goldLight)
  gold.addColorStop(0.45, MED.gold)
  gold.addColorStop(1, MED.goldDeep)
  const outline = rgba(MED.ink, 0.85)
  const draw = (fill: string | CanvasGradient, grow: number) => {
    // the double rule along both edges, joined by a square boss at the corner
    ctx.fillStyle = fill
    ctx.fillRect(6 - grow, 6 - grow, S - 6 + grow, 5 + grow * 2)
    ctx.fillRect(6 - grow, 6 - grow, 5 + grow * 2, S - 6 + grow)
    ctx.fillRect(15 - grow, 15 - grow, S - 15 + grow, 1.6 + grow * 2)
    ctx.fillRect(15 - grow, 15 - grow, 1.6 + grow * 2, S - 15 + grow)
    ctx.fillRect(2 - grow, 2 - grow, 15 + grow * 2, 15 + grow * 2)
    // the vine: a curl out of the corner with a trefoil bud
    const vine = quad({ x: 18, y: 18 }, { x: 46, y: 22 }, { x: 52, y: 46 })
    const curl = volute(42, 46, 10, 0.85, 1, 0)
    nibStroke(ctx, vine.concat(curl), {
      width: 5 + grow * 2,
      angle: Math.PI / 4,
      hair: 1.4 + grow * 2,
      taper: 0.1,
      color: typeof fill === 'string' ? fill : MED.gold
    })
    for (const [x, y, rot] of [
      [30, 30, 0.6],
      [60, 18, -0.3],
      [18, 60, Math.PI / 2 + 0.3]
    ]) {
      ctx.save()
      ctx.fillStyle = fill
      ctx.translate(x, y)
      ctx.rotate(rot)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.quadraticCurveTo(7 + grow, -6 - grow, 14 + grow, 0)
      ctx.quadraticCurveTo(7 + grow, 6 + grow, 0, 0)
      ctx.fill()
      ctx.restore()
    }
  }
  draw(outline, 1.1)
  draw(gold, 0)
  // a red jewel in the boss and a few gold dots along the rules
  ctx.fillStyle = MED.vermilion
  ctx.beginPath()
  ctx.arc(9.5, 9.5, 3.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,240,200,0.7)'
  ctx.beginPath()
  ctx.arc(8.5, 8.5, 1, 0, Math.PI * 2)
  ctx.fill()
  for (let i = 0; i < 3; i++) {
    const t = 76 + i * 16 + r() * 2
    for (const [x, y] of [
      [t, 22],
      [22, t]
    ]) {
      ctx.fillStyle = outline
      ctx.beginPath()
      ctx.arc(x, y, 2.3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = MED.gold
      ctx.beginPath()
      ctx.arc(x, y, 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  return c
}

/** The corner fleuron mirrored into each corner: tl, tr, bl, br. */
export function cornerSetDataUrls(seed = 2): Record<'tl' | 'tr' | 'bl' | 'br', string> {
  const base = cornerCanvas(seed)
  const flip = (sx: number, sy: number) =>
    cached(`corner|${seed}|${sx}|${sy}`, () => {
      const c = makeCanvas(base.width, base.height)
      const ctx = c.getContext('2d') as Ctx
      ctx.translate(sx < 0 ? c.width : 0, sy < 0 ? c.height : 0)
      ctx.scale(sx, sy)
      ctx.drawImage(base, 0, 0)
      return c.toDataURL('image/png')
    })
  return { tl: flip(1, 1), tr: flip(-1, 1), bl: flip(1, -1), br: flip(-1, -1) }
}

// ── The compass rose ─────────────────────────────────────────────────────────

/**
 * A portolan compass rose. `mode: 'mask'` paints solid black (the spinner and
 * masks); `'color'` paints it illuminated — gold and ink points, a vermilion
 * ring and a fleur-de-lis at north.
 */
export function roseDataUrl(mode: 'mask' | 'color' = 'mask', size = 256): string {
  return cached(`rose|${mode}|${size}`, () => {
    const c = makeCanvas(size, size)
    const ctx = c.getContext('2d') as Ctx
    const C = size / 2
    const R = size * 0.46
    const mask = mode === 'mask'
    const ink = mask ? '#000' : MED.ink
    const pale = mask ? 'rgba(0,0,0,0.55)' : MED.goldLight
    // rings with ticks
    ctx.strokeStyle = mask ? '#000' : MED.vermilion
    ctx.lineWidth = size * 0.012
    ctx.beginPath()
    ctx.arc(C, C, R * 0.8, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = size * 0.006
    ctx.beginPath()
    ctx.arc(C, C, R * 0.72, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = ink
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2
      const l = i % 4 === 0 ? 0.06 : 0.03
      ctx.beginPath()
      ctx.moveTo(C + Math.cos(a) * R * 0.72, C + Math.sin(a) * R * 0.72)
      ctx.lineTo(C + Math.cos(a) * R * (0.72 + l), C + Math.sin(a) * R * (0.72 + l))
      ctx.stroke()
    }
    // the points, shortest first so the cardinals sit on top; each is split
    // into a lit and a shaded half, as on the charts
    const rays = roseRays(32)
      .map((p, i) => ({
        a: p[0],
        len: i % 8 === 0 ? 1 : i % 4 === 0 ? 0.74 : i % 2 === 0 ? 0.5 : 0.32
      }))
      .sort((x, y) => x.len - y.len)
    for (const { a, len } of rays) {
      const tip = { x: C + Math.cos(a) * R * len, y: C + Math.sin(a) * R * len }
      const half = len >= 0.74 ? 0.075 : 0.05
      const l = {
        x: C + Math.cos(a - Math.PI / 2) * R * half,
        y: C + Math.sin(a - Math.PI / 2) * R * half
      }
      const rt = {
        x: C + Math.cos(a + Math.PI / 2) * R * half,
        y: C + Math.sin(a + Math.PI / 2) * R * half
      }
      for (const [side, fill] of [
        [l, len === 1 && !mask ? MED.gold : ink],
        [rt, pale]
      ] as Array<[Pt, string]>) {
        ctx.fillStyle = fill
        ctx.beginPath()
        ctx.moveTo(C, C)
        ctx.lineTo(side.x, side.y)
        ctx.lineTo(tip.x, tip.y)
        ctx.closePath()
        ctx.fill()
      }
      if (!mask) {
        ctx.strokeStyle = rgba(MED.ink, 0.8)
        ctx.lineWidth = size * 0.003
        ctx.beginPath()
        ctx.moveTo(l.x, l.y)
        ctx.lineTo(tip.x, tip.y)
        ctx.lineTo(rt.x, rt.y)
        ctx.stroke()
      }
    }
    // hub
    ctx.fillStyle = mask ? '#000' : MED.vermilion
    ctx.beginPath()
    ctx.arc(C, C, R * 0.07, 0, Math.PI * 2)
    ctx.fill()
    if (!mask) {
      ctx.fillStyle = MED.goldLight
      ctx.beginPath()
      ctx.arc(C, C, R * 0.03, 0, Math.PI * 2)
      ctx.fill()
    }
    // the fleur-de-lis that marks north on every portolan
    fleur(ctx, C, C - R * 1.0, R * 0.16, mask ? '#000' : MED.vermilion)
    return c.toDataURL('image/png')
  })
}

function fleur(ctx: Ctx, x: number, y: number, s: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = color
  ctx.beginPath()
  // central petal
  ctx.moveTo(0, -s)
  ctx.quadraticCurveTo(s * 0.45, -s * 0.35, 0, s * 0.35)
  ctx.quadraticCurveTo(-s * 0.45, -s * 0.35, 0, -s)
  // side petals curling out and down
  for (const k of [-1, 1]) {
    ctx.moveTo(k * s * 0.12, s * 0.15)
    ctx.quadraticCurveTo(k * s * 0.9, -s * 0.75, k * s * 0.85, s * 0.1)
    ctx.quadraticCurveTo(k * s * 0.7, -s * 0.25, k * s * 0.12, s * 0.35)
  }
  ctx.fill()
  // the band
  ctx.fillRect(-s * 0.45, s * 0.3, s * 0.9, s * 0.16)
  ctx.restore()
}

// ── The skyline ──────────────────────────────────────────────────────────────

function drawCastle(ctx: Ctx, cx: number, ground: number, u: number, seed: number) {
  const plan = castlePlan(seed)
  const crenels = (x0: number, x1: number, top: number, h: number) => {
    const n = Math.max(2, Math.round((x1 - x0) / (u * 0.36)))
    const cw = (x1 - x0) / (n * 2 - 1)
    for (let i = 0; i < n; i++) ctx.fillRect(x0 + i * 2 * cw, top - h, cw, h + 1)
  }
  // curtain wall
  const wx0 = cx - (plan.wallW / 2) * u
  const wx1 = cx + (plan.wallW / 2) * u
  ctx.fillRect(wx0, ground - u, wx1 - wx0, u + 2)
  crenels(wx0, wx1, ground - u, u * 0.22)
  for (const t of plan.towers) {
    const x0 = cx + t.dx * u - (t.w * u) / 2
    const x1 = x0 + t.w * u
    const top = ground - t.h * u
    ctx.fillRect(x0, top, x1 - x0, t.h * u + 2)
    let peak = top
    if (t.roof === 'cone') {
      peak = top - t.w * u * 1.15
      ctx.beginPath()
      ctx.moveTo(x0 - u * 0.12, top)
      ctx.lineTo((x0 + x1) / 2, peak)
      ctx.lineTo(x1 + u * 0.12, top)
      ctx.closePath()
      ctx.fill()
    } else crenels(x0 - u * 0.08, x1 + u * 0.08, top, u * 0.24)
    if (t.flag) {
      const fx = (x0 + x1) / 2
      const fy = (t.roof === 'cone' ? peak : top - u * 0.24) - u * 0.7
      ctx.fillRect(fx - 0.6, fy, 1.2, u * 0.75)
      ctx.beginPath()
      ctx.moveTo(fx, fy)
      ctx.quadraticCurveTo(fx + u * 0.4, fy + u * 0.02, fx + u * 0.75, fy + u * 0.14)
      ctx.lineTo(fx, fy + u * 0.3)
      ctx.closePath()
      ctx.fill()
    }
  }
  // arrow slits and the gate, cut through
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  for (const t of plan.towers) {
    const x = cx + t.dx * u
    ctx.fillRect(x - u * 0.05, ground - t.h * u * 0.62, u * 0.1, u * 0.32)
  }
  ctx.beginPath()
  ctx.moveTo(cx - u * 0.32, ground + 2)
  ctx.lineTo(cx - u * 0.32, ground - u * 0.45)
  ctx.arc(cx, ground - u * 0.45, u * 0.32, Math.PI, 0)
  ctx.lineTo(cx + u * 0.32, ground + 2)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawPine(ctx: Ctx, x: number, ground: number, h: number) {
  const w = h * 0.36
  ctx.beginPath()
  ctx.moveTo(x, ground - h)
  for (let i = 1; i <= 3; i++) {
    const y = ground - h + (h * 0.82 * i) / 3
    const ww = (w * i) / 3
    ctx.lineTo(x + ww, y)
    ctx.lineTo(x + ww * 0.45, y - h * 0.06)
  }
  ctx.lineTo(x + w * 0.1, ground - h * 0.18)
  ctx.lineTo(x + w * 0.1, ground + 2)
  ctx.lineTo(x - w * 0.1, ground + 2)
  ctx.lineTo(x - w * 0.1, ground - h * 0.18)
  for (let i = 3; i >= 1; i--) {
    const y = ground - h + (h * 0.82 * i) / 3
    const ww = (w * i) / 3
    ctx.lineTo(x - ww * 0.45, y - h * 0.06)
    ctx.lineTo(x - ww, y)
  }
  ctx.closePath()
  ctx.fill()
}

/**
 * A wide band of distant country (transparent PNG data URL): three ranges of
 * rolling hills, pine woods along the ridges, and castles with pennants on the
 * high ground. Every ridge is built from whole sine cycles, so the band tiles
 * seamlessly along x (background-repeat: repeat-x).
 */
export function skylineDataUrl(w = 1400, h = 260, seed = 31, color = MED.ink): string {
  return cached(`skyline|${w}|${h}|${seed}|${color}`, () => {
    const c = makeCanvas(w, h)
    const ctx = c.getContext('2d') as Ctx
    const r = rng(seed)
    const layers = [
      { a: 0.14, base: 0.42, amp: 0.3, trees: 0, castles: 1, u: 7 },
      { a: 0.28, base: 0.62, amp: 0.22, trees: 34, castles: 1, u: 10 },
      { a: 0.5, base: 0.84, amp: 0.14, trees: 60, castles: 0, u: 0 }
    ]
    layers.forEach((L, li) => {
      const waves = hillWaves(seed + li * 17)
      const ridge = (x: number) => h * (L.base - L.amp * hillHeight(waves, x, w))
      const lc = makeCanvas(w, h)
      const lx = lc.getContext('2d') as Ctx
      lx.fillStyle = color
      lx.beginPath()
      lx.moveTo(0, h)
      for (let x = 0; x <= w; x += 4) lx.lineTo(x, ridge(x))
      lx.lineTo(w, h)
      lx.closePath()
      lx.fill()
      // pines along the ridge, in clumps (wrapped so the tile stays seamless)
      for (let i = 0; i < L.trees; i++) {
        const x = r() * w
        if (r() < 0.35) continue
        const th = h * (0.05 + r() * 0.06) * (li === 2 ? 1.3 : 1)
        for (const off of [0, -w, w]) drawPine(lx, x + off, ridge(x) + 3, th)
      }
      // castles on the high ground, away from the tile seam
      for (let k = 0; k < L.castles; k++) {
        let best = w * 0.2
        for (let x = w * 0.15; x < w * 0.85; x += 6) if (ridge(x) < ridge(best)) best = x
        drawCastle(lx, best, ridge(best) + 4, L.u, seed + li * 7 + k)
      }
      ctx.globalAlpha = L.a
      ctx.drawImage(lc, 0, 0)
    })
    ctx.globalAlpha = 1
    // the foot dissolves into morning haze
    ctx.globalCompositeOperation = 'destination-out'
    const g = ctx.createLinearGradient(0, h * 0.7, 0, h)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,0.85)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    return c.toDataURL('image/png')
  })
}

// ── The wax seal ─────────────────────────────────────────────────────────────

/** A disc of red sealing wax pressed with a tree (the family's arms), with a
 *  ragged spill edge and an embossed rim. */
export function waxSealDataUrl(size = 128, seed = 7, wax = MED.wax): string {
  return cached(`wax|${size}|${seed}|${wax}`, () => {
    const c = makeCanvas(size, size)
    const ctx = c.getContext('2d') as Ctx
    const C = size / 2
    const R = size * 0.44
    const nz = noise1(seed)
    // the spill
    ctx.beginPath()
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2
      const k = 1 + 0.05 * nz(i * 0.35) + 0.025 * nz(i * 1.3 + 9)
      const x = C + Math.cos(a) * R * k
      const y = C + Math.sin(a) * R * k
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    }
    ctx.closePath()
    const g = ctx.createRadialGradient(C - R * 0.3, C - R * 0.35, R * 0.1, C, C, R * 1.05)
    g.addColorStop(0, '#c9473b')
    g.addColorStop(0.55, wax)
    g.addColorStop(1, '#4e0f0b')
    ctx.fillStyle = g
    ctx.fill()
    // the pressed matrix: a sunken disc with a raised rim
    const emboss = (draw: () => void) => {
      ctx.save()
      ctx.translate(1.2, 1.4)
      ctx.strokeStyle = ctx.fillStyle = 'rgba(40,5,3,0.55)'
      draw()
      ctx.restore()
      ctx.save()
      ctx.translate(-0.8, -0.9)
      ctx.strokeStyle = ctx.fillStyle = 'rgba(255,190,170,0.35)'
      draw()
      ctx.restore()
      ctx.strokeStyle = ctx.fillStyle = '#9a2a20'
      draw()
    }
    ctx.lineWidth = size * 0.025
    emboss(() => {
      ctx.beginPath()
      ctx.arc(C, C, R * 0.74, 0, Math.PI * 2)
      ctx.stroke()
    })
    // beads around the rim
    emboss(() => {
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2
        ctx.beginPath()
        ctx.arc(
          C + Math.cos(a) * R * 0.86,
          C + Math.sin(a) * R * 0.86,
          size * 0.014,
          0,
          Math.PI * 2
        )
        ctx.fill()
      }
    })
    // the tree: a trunk, three boughs, a crown of five round lobes, roots
    emboss(() => {
      const s = R * 0.5
      ctx.beginPath()
      ctx.moveTo(C - s * 0.12, C + s * 0.9)
      ctx.lineTo(C - s * 0.08, C - s * 0.05)
      ctx.lineTo(C + s * 0.08, C - s * 0.05)
      ctx.lineTo(C + s * 0.12, C + s * 0.9)
      ctx.closePath()
      ctx.fill()
      for (const [dx, dy, rr] of [
        [0, -0.52, 0.42],
        [-0.48, -0.22, 0.34],
        [0.48, -0.22, 0.34],
        [-0.3, -0.72, 0.28],
        [0.3, -0.72, 0.28]
      ]) {
        ctx.beginPath()
        ctx.arc(C + dx * s, C + dy * s, rr * s, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillRect(C - s * 0.6, C + s * 0.86, s * 1.2, s * 0.12)
    })
    return c.toDataURL('image/png')
  })
}

// ── The theme reveal ─────────────────────────────────────────────────────────

/** A burning hole in the page (vector SVG data URL, scales crisply): a ragged,
 *  flame-licked edge with a few sparks flying ahead of it. The hole fills the
 *  central ~84% of its box, like lib/inkArt's blot, so themeReveal sizes both
 *  the same way. */
export function burnMaskUrl(seed = 23): string {
  return cached(`burn|${seed}`, () => {
    const r = rng(seed)
    const S = 1000
    const cx = S / 2
    const R = S * 0.42
    const f = (n: number) => n.toFixed(1)
    const nz = noise1(seed)
    let d = ''
    for (let i = 0; i <= 240; i++) {
      const a = (i / 240) * Math.PI * 2
      // tongues of flame: sharp, uneven bumps on a rough circle
      const tongue = Math.pow(Math.abs(Math.sin(i * 0.55 + nz(i * 0.1) * 3)), 6) * 0.07
      const k = 1 + 0.05 * nz(i * 0.25) + tongue
      d += `${i ? 'L' : 'M'}${f(cx + Math.cos(a) * R * k)} ${f(cx + Math.sin(a) * R * k)}`
    }
    let sparks = ''
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2
      const dd = R * (1.06 + r() * 0.1)
      sparks += `<circle cx="${f(cx + Math.cos(a) * dd)}" cy="${f(cx + Math.sin(a) * dd)}" r="${f(1.5 + r() * 4)}"/>`
    }
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">` +
      `<filter id="b" x="-10%" y="-10%" width="120%" height="120%">` +
      `<feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="2" seed="${seed}"/>` +
      `<feDisplacementMap in="SourceGraphic" scale="26" xChannelSelector="R" yChannelSelector="G"/>` +
      `<feGaussianBlur stdDeviation="0.8"/></filter>` +
      `<g fill="#000" filter="url(#b)"><path d="${d}Z"/>${sparks}</g></svg>`
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
  })
}

// ── Fonts + install ──────────────────────────────────────────────────────────

/** The medieval theme's font stacks (also declared as CSS vars in
 *  styles/medieval.css). CJK falls back to a book serif — no blackletter has it. */
export const MEDIEVAL_FONTS = {
  gothic: '"Codex Gothic", "Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", serif',
  fraktur: '"Codex Fraktur", "Codex Gothic", serif',
  caps: '"Codex Caps", "Ink Serif", "Songti SC", "STSong", Georgia, serif',
  serif: '"Ink Serif", "Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", Georgia, serif'
}

let fontsPromise: Promise<void> | null = null

/** Resolves once the codex faces are loaded (or after 2.5s regardless). */
export function medievalFontsReady(): Promise<void> {
  if (fontsPromise) return fontsPromise
  if (typeof document === 'undefined' || !document.fonts?.load) return Promise.resolve()
  const loads = [
    document.fonts.load('32px "Codex Gothic"', 'Aa'),
    document.fonts.load('32px "Codex Fraktur"', 'Aa'),
    document.fonts.load('16px "Codex Caps"', 'Aa'),
    document.fonts.load('16px "Ink Serif"', 'Aa')
  ]
  fontsPromise = Promise.race([
    Promise.allSettled(loads).then(() => undefined),
    new Promise<void>((res) => setTimeout(res, 2500))
  ])
  return fontsPromise
}

/** A base64 data: URL as a short blob: URL — custom properties are substituted
 *  as strings on every style recalc, so long data URLs make recalcs slow (see
 *  the note on inkArt's blobUrlOf). */
function blobUrlOf(dataUrl: string): string {
  try {
    const comma = dataUrl.indexOf(',')
    const meta = dataUrl.slice(5, comma)
    if (!dataUrl.startsWith('data:') || !meta.endsWith(';base64') || !URL.createObjectURL) {
      return dataUrl
    }
    const bin = atob(dataUrl.slice(comma + 1))
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return URL.createObjectURL(new Blob([bytes], { type: meta.split(';')[0] || 'image/png' }))
  } catch {
    return dataUrl
  }
}

let installed = false

/** Generate the medieval theme's CSS textures once and publish them on <html>
 *  as custom properties (url(...) values). Cheap to call repeatedly. */
export function installMedievalAssets(): void {
  if (installed || typeof document === 'undefined') return
  installed = true
  const st = document.documentElement.style
  const set = (k: string, url: string) => st.setProperty(k, `url("${blobUrlOf(url)}")`)
  set('--med-vellum', vellumDataUrl(512, 512, { tone: MED.vellum, age: 0.7, seed: 5 }))
  set('--med-vellum-light', vellumDataUrl(512, 512, { tone: MED.vellumLight, age: 0.35, seed: 6 }))
  set('--med-divider', flourishDataUrl('divider', 3))
  set('--med-underline', flourishDataUrl('underline', 4))
  set('--med-rose', roseDataUrl('mask', 128))
  set('--med-rose-color', roseDataUrl('color', 512))
  set('--med-skyline', skylineDataUrl(1400, 260, 31))
  set('--med-seal', waxSealDataUrl(128, 7))
  const corners = cornerSetDataUrls(2)
  for (const k of ['tl', 'tr', 'bl', 'br'] as const) set(`--med-corner-${k}`, corners[k])
}
