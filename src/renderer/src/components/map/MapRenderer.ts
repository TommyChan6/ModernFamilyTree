// The Map view's Canvas-2D renderer.
//
// Two layers:
//  • STATIC — sheet, coasts, terrain + scattered symbols, territories, roads,
//    rivers, places, labels, frame, compass, grain. Rendered into an offscreen
//    canvas and re-rendered only when its key (camera, data version, style,
//    year, theme, size) changes — so an idle map costs one blit per frame.
//  • LIVE — ambient motion (waves, clouds, mist, scanlines, radar), animated
//    events (flowing arrows, marching zones, pulsing incidents), people and
//    their journeys, selection/hover, and the in-progress stroke.
//
// Everything is drawn from plain data handed in via render(state); the view
// owns interaction and state. Geometry math lives in mapMath.ts.

import type { MapDoc, MapFeature, MapKey } from '../../../../shared/types'
import type { MapStyle } from './mapStyles'
import { KIND_Z, LIVE_KINDS, MAP_KIND_GEOMETRY, PLACE_RANK } from './mapKinds'
import { drawCompass, drawEventGlyph, drawPlaceGlyph, drawTerrainMark } from './mapGlyphs'
import { rgba, sealCanvas } from '../../lib/inkArt'
import {
  type Placement,
  PAINT_SPACING,
  bloomProgress,
  boatAt,
  brushRuns,
  flockAt,
  paintingPlacements,
  pickIndex,
  vertexAt,
  waveOctaves
} from './inkPaint'
import {
  type SpriteKind,
  SPRITES,
  bakedSprite,
  bloomMask,
  inkMapAssetsReady,
  loadInkMapAssets,
  spriteImage,
  spritesFor
} from './inkSprites'
import {
  type Box,
  type Camera,
  bboxOf,
  boxesOverlap,
  chaikin,
  clamp,
  fanOut,
  hashStr,
  pointAlong,
  pointInPolygon,
  polygonArea,
  polygonCentroid,
  polylineLength,
  rng,
  scatterInPolygon,
  toScreen,
  tokenStateAt,
  viewBox,
  windowAlpha
} from './mapMath'

type Ctx = CanvasRenderingContext2D

export interface TokenView {
  id: string
  name: string
  color: string
  initial: string
  img: HTMLImageElement | null
  keys: MapKey[]
  /** 0 = not yet born … 1 = alive; ~0.4 = gone (after death). */
  life: number
  dead: boolean
}

export interface Burst {
  x: number
  y: number
  t0: number
  color: string
}

export interface RenderState {
  doc: MapDoc
  version: number
  style: MapStyle
  cam: Camera
  year: number | null
  time: number
  theme: 'dark' | 'light' | 'ink'
  /** prefers-reduced-motion: ambient life holds still, no reveal bloom. */
  reducedMotion?: boolean
  tokens: TokenView[]
  tagColors: Map<string, string>
  selectedFeatureId: string | null
  selectedTokenId: string | null
  hoverFeatureId: string | null
  hoverTokenId: string | null
  preview: { kind: string; pts: number[]; closed: boolean; color: string } | null
  showTrails: boolean
  showLabels: boolean
  bursts: Burst[]
  /** Hide chrome (selection, handles) — used for PNG export. */
  exporting?: boolean
}

/** One painting sprite queued for the back-to-front terrain pass (world units). */
interface PaintedSprite {
  c: HTMLCanvasElement
  /** Centre x, top y, size. */
  x: number
  y: number
  w: number
  h: number
  /** Foot y — the depth key. */
  fy: number
  flip: boolean
  a: number
}

export interface TokenHit {
  id: string
  x: number
  y: number
  r: number
}

const SYMBOL_SPACING: Record<string, number> = {
  forest: 20,
  mountains: 36,
  hills: 30,
  desert: 34,
  grass: 28,
  swamp: 30,
  snow: 34
}

const CJK = /[㐀-鿿豈-﫿]/

const CJK_G = new RegExp(CJK.source, 'g')

/** The desk under every style when the app wears its ink (paper) theme. */
const INK_DESK = '#e4dac4'

const PAINT_KINDS = new Set(['mountains', 'hills', 'forest'])

/** Short CJK names (<= 8 chars) are written in a vertical column. */
const isVerticalName = (name: string) => CJK.test(name) && [...name].length <= 8

/** Classical pigments a painted map grinds every realm colour into. */
const PIGMENTS = ['#b3352a', '#3d5a73', '#4c8a72', '#b4884c', '#2f5f8a', '#8a5a6a', '#6e6a61']

/** The pigment nearest in hue to a colour (greys → ink wash). */
export function pigmentOf(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return hex
  const hue = (h: string) => {
    const n = parseInt(h.replace('#', ''), 16)
    const r = ((n >> 16) & 255) / 255
    const g = ((n >> 8) & 255) / 255
    const b = (n & 255) / 255
    const mx = Math.max(r, g, b)
    const mn = Math.min(r, g, b)
    const d = mx - mn
    if (d < 0.08) return -1
    const hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
    return (hh * 60 + 360) % 360
  }
  const h0 = hue(m[1])
  if (h0 < 0) return PIGMENTS[6]
  let best = PIGMENTS[0]
  let bd = 1e9
  for (const p of PIGMENTS.slice(0, 6)) {
    const d = Math.abs(((hue(p) - h0 + 540) % 360) - 180)
    if (d < bd) {
      bd = d
      best = p
    }
  }
  return best
}

/** The feature's own color, or its linked tag's, or the style default. */
function featureColor(f: MapFeature, style: MapStyle, tagColors: Map<string, string>): string {
  if (f.color) return f.color
  if (f.tag_id && tagColors.get(f.tag_id)) return tagColors.get(f.tag_id) as string
  if (f.kind === 'territory') return style.accent
  const line = style.lines[f.kind]
  if (line) return line.color
  const area = style.areas[f.kind]
  if (area) return area.fill
  return style.accent
}

export class MapRenderer {
  canvas: HTMLCanvasElement
  ctx: Ctx
  w = 1
  h = 1
  dpr = 1
  tokenHits: TokenHit[] = []

  private stat: HTMLCanvasElement
  private sctx: Ctx
  private staticKey = ''
  private paths = new WeakMap<number[], Path2D>()
  private smooth = new WeakMap<number[], number[]>()
  private boxes = new WeakMap<number[], Box>()
  private scatter = new WeakMap<number[], number[]>()
  private grain = new Map<string, CanvasPattern | null>()
  private waves: { key: string; pts: number[] } = { key: '', pts: [] }
  private placements = new WeakMap<number[], Placement[]>()
  private waveTiles = new Map<string, CanvasPattern | null>()
  private mist: { key: string; bands: number[] } = { key: '', bands: [] }
  private assetsHooked = false
  private prevStyleId = ''
  private reveal: {
    from: HTMLCanvasElement
    t0: number
    centers: [number, number, number][]
  } | null = null
  private revealTmp: HTMLCanvasElement | null = null
  /** Called once the painted styles' sprites + fonts finish loading. */
  onAssets: (() => void) | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d') as Ctx
    this.stat = document.createElement('canvas')
    this.sctx = this.stat.getContext('2d') as Ctx
  }

  resize(w: number, h: number, dpr: number) {
    this.w = Math.max(1, w)
    this.h = Math.max(1, h)
    this.dpr = dpr
    for (const c of [this.canvas, this.stat]) {
      c.width = Math.round(this.w * dpr)
      c.height = Math.round(this.h * dpr)
    }
    this.canvas.style.width = this.w + 'px'
    this.canvas.style.height = this.h + 'px'
    this.staticKey = ''
  }

  dispose() {
    this.canvas.width = 1
    this.canvas.height = 1
    this.stat.width = 1
    this.stat.height = 1
  }

  // ── caches ──────────────────────────────────────────────────────────────────
  private smoothPts(f: MapFeature): number[] {
    let s = this.smooth.get(f.pts)
    if (!s) {
      const geo = MAP_KIND_GEOMETRY[f.kind]
      s = geo === 'point' ? f.pts : chaikin(f.pts, geo === 'area', f.kind === 'rail' ? 1 : 2)
      this.smooth.set(f.pts, s)
    }
    return s
  }

  private pathOf(f: MapFeature): Path2D {
    let p = this.paths.get(f.pts)
    if (!p) {
      const s = this.smoothPts(f)
      p = new Path2D()
      for (let i = 0; i < s.length; i += 2) {
        if (i === 0) p.moveTo(s[0], s[1])
        else p.lineTo(s[i], s[i + 1])
      }
      if (MAP_KIND_GEOMETRY[f.kind] === 'area') p.closePath()
      this.paths.set(f.pts, p)
    }
    return p
  }

  private boxOf(f: MapFeature): Box {
    let b = this.boxes.get(f.pts)
    if (!b) {
      b = bboxOf(f.pts)
      this.boxes.set(f.pts, b)
    }
    return b
  }

  private scatterOf(f: MapFeature): number[] {
    let s = this.scatter.get(f.pts)
    if (!s) {
      s = scatterInPolygon(this.smoothPts(f), SYMBOL_SPACING[f.kind] || 30, hashStr(f.id), 6000)
      this.scatter.set(f.pts, s)
    }
    return s
  }

  private grainPattern(ctx: Ctx, kind: MapStyle['grain']): CanvasPattern | null {
    if (kind === 'none') return null
    if (this.grain.has(kind)) return this.grain.get(kind) as CanvasPattern | null
    const c = document.createElement('canvas')
    const N = 256
    c.width = N
    c.height = N
    const g = c.getContext('2d') as Ctx
    const rand = rng(kind === 'rice' ? 7 : kind === 'grid' ? 11 : 3)
    if (kind === 'grid') {
      g.strokeStyle = 'rgba(0,229,255,0.07)'
      g.lineWidth = 1
      for (let i = 0; i <= N; i += 32) {
        g.beginPath()
        g.moveTo(i + 0.5, 0)
        g.lineTo(i + 0.5, N)
        g.moveTo(0, i + 0.5)
        g.lineTo(N, i + 0.5)
        g.stroke()
      }
      g.fillStyle = 'rgba(0,229,255,0.12)'
      for (let i = 0; i <= N; i += 32)
        for (let j = 0; j <= N; j += 32) g.fillRect(i - 1, j - 1, 2, 2)
    } else {
      const img = g.createImageData(N, N)
      for (let i = 0; i < N * N; i++) {
        const v = rand()
        const a = kind === 'rice' ? (v > 0.985 ? 60 : v * 18) : v * 26
        img.data[i * 4] = 70
        img.data[i * 4 + 1] = 50
        img.data[i * 4 + 2] = 30
        img.data[i * 4 + 3] = a
      }
      g.putImageData(img, 0, 0)
      if (kind === 'rice') {
        // long paper fibres
        g.strokeStyle = 'rgba(90,80,60,0.12)'
        for (let i = 0; i < 40; i++) {
          g.lineWidth = 0.5 + rand()
          g.beginPath()
          const x = rand() * N
          const y = rand() * N
          g.moveTo(x, y)
          g.bezierCurveTo(
            x + rand() * 30,
            y + rand() * 10,
            x + rand() * 40,
            y - rand() * 10,
            x + 20 + rand() * 40,
            y + rand() * 20
          )
          g.stroke()
        }
      } else {
        // soft blotches (aged paper)
        for (let i = 0; i < 18; i++) {
          const x = rand() * N
          const y = rand() * N
          const r = 20 + rand() * 50
          const grd = g.createRadialGradient(x, y, 0, x, y, r)
          grd.addColorStop(0, 'rgba(120,80,40,0.07)')
          grd.addColorStop(1, 'rgba(120,80,40,0)')
          g.fillStyle = grd
          g.fillRect(x - r, y - r, r * 2, r * 2)
        }
      }
    }
    const pat = ctx.createPattern(c, 'repeat')
    this.grain.set(kind, pat)
    return pat
  }

  // ── frame ───────────────────────────────────────────────────────────────────
  render(s: RenderState) {
    const painted = !!(s.style.painting || s.style.calligraphy)
    if (painted && !this.assetsHooked) {
      this.assetsHooked = true
      loadInkMapAssets().then(() => {
        this.invalidate()
        this.onAssets?.()
      })
    }
    // switching INTO a painted style blooms it in like ink soaking the paper
    if (
      this.prevStyleId &&
      this.prevStyleId !== s.style.id &&
      s.style.painting &&
      !s.exporting &&
      !s.reducedMotion
    )
      this.startReveal(s)
    this.prevStyleId = s.style.id
    const key = [
      s.version,
      s.style.id,
      s.theme,
      s.cam.x.toFixed(2),
      s.cam.y.toFixed(2),
      s.cam.k.toFixed(5),
      s.year == null ? 'n' : s.year.toFixed(3),
      s.showLabels ? 1 : 0,
      this.w,
      this.h,
      s.tagColors.size,
      inkMapAssetsReady() ? 1 : 0
    ].join('|')
    if (key !== this.staticKey) {
      this.staticKey = key
      this.renderStatic(s)
    }
    const ctx = this.ctx
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.drawImage(this.stat, 0, 0)
    this.renderLive(s)
    if (this.reveal) this.drawReveal(s)
  }

  /** Force the static layer to re-render next frame (e.g. an avatar loaded). */
  invalidate() {
    this.staticKey = ''
  }

  private worldTransform(ctx: Ctx, cam: Camera) {
    const d = this.dpr
    ctx.setTransform(cam.k * d, 0, 0, cam.k * d, cam.x * d, cam.y * d)
  }

  private screenTransform(ctx: Ctx) {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  // ── static layer ────────────────────────────────────────────────────────────
  private renderStatic(s: RenderState) {
    const ctx = this.sctx
    const { doc, style, cam } = s
    const W = doc.width
    const H = doc.height
    const k = cam.k
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 1
    ctx.fillStyle =
      s.theme === 'ink'
        ? style.desk.ink || INK_DESK
        : s.theme === 'light'
          ? style.desk.light
          : style.desk.dark
    ctx.fillRect(0, 0, this.stat.width, this.stat.height)

    const vb = viewBox(cam, this.w, this.h)
    const visible = (f: MapFeature) => boxesOverlap(this.boxOf(f), vb, 80)

    // sheet shadow + base
    this.worldTransform(ctx, cam)
    if (style.frame === 'scroll') this.mountUnder(ctx, s)
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = 28 * this.dpr
    ctx.shadowOffsetY = 8 * this.dpr
    ctx.fillStyle = doc.base === 'land' ? style.land : style.sea
    ctx.fillRect(0, 0, W, H)
    ctx.restore()
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, W, H)
    ctx.clip()
    if (doc.base === 'sea') {
      const g = ctx.createRadialGradient(
        W / 2,
        H / 2,
        Math.min(W, H) * 0.2,
        W / 2,
        H / 2,
        Math.max(W, H) * 0.75
      )
      g.addColorStop(0, style.sea)
      g.addColorStop(1, style.seaDeep)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
    }
    if (style.frame === 'thin' && doc.base === 'sea')
      this.graticule(ctx, W, H, k, 'rgba(255,255,255,0.45)')
    // 水纹 — the sea as classical wave lines (land paints over it)
    if (style.seaWaves && doc.base === 'sea') this.seaWaves(ctx, style, k, 0, 0, W, H)

    // time-filtered features, painter's order
    const feats = doc.features
      .map((f) => ({ f, a: windowAlpha(f, s.year) }))
      .filter((e) => e.a > 0.01)
      .sort((a, b) => (KIND_Z[a.f.kind] ?? 0) - (KIND_Z[b.f.kind] ?? 0))
    const lands = feats.filter((e) => e.f.kind === 'land')
    const waters = feats.filter((e) => e.f.kind === 'water')

    const landPath = new Path2D()
    for (const e of lands) landPath.addPath(this.pathOf(e.f))

    // ── coasts: ripples out to sea, then the land itself ───────────────────────
    if (lands.length) {
      this.ripples(ctx, landPath, style, style.sea, k, false)
      if (style.coastGlow) {
        ctx.save()
        ctx.shadowColor = style.coastGlow
        ctx.shadowBlur = (style.symbols === 'tech' ? 14 : 22) * this.dpr
        ctx.strokeStyle = style.coastGlow
        ctx.lineWidth = (style.symbols === 'tech' ? 2 : 10) / k
        ctx.stroke(landPath)
        ctx.restore()
      }
      for (const e of lands) {
        ctx.globalAlpha = e.a
        ctx.fillStyle = e.f.color || style.land
        ctx.fill(this.pathOf(e.f))
      }
      ctx.globalAlpha = 1
      // soft inner shade along the coast so land reads as raised
      if (style.symbols === 'drawn' || style.symbols === 'ink') {
        ctx.save()
        ctx.clip(landPath)
        ctx.strokeStyle = style.symbols === 'ink' ? 'rgba(40,40,40,0.08)' : 'rgba(80,60,30,0.12)'
        ctx.lineWidth = 16 / Math.max(0.3, k) + 6
        ctx.stroke(landPath)
        ctx.restore()
      }
    }

    // ── lakes / seas painted onto land ─────────────────────────────────────────
    for (const e of waters) {
      const p = this.pathOf(e.f)
      ctx.globalAlpha = e.a
      ctx.fillStyle = e.f.color || style.sea
      ctx.fill(p)
      ctx.save()
      ctx.clip(p)
      this.ripples(ctx, p, style, e.f.color || style.sea, k, true)
      if (style.seaWaves) {
        const b = this.boxOf(e.f)
        this.seaWaves(ctx, style, k, b.x0, b.y0, b.x1, b.y1)
      }
      ctx.restore()
    }
    ctx.globalAlpha = 1

    // coast outlines
    const coastW = style.coastWidth
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    for (const e of [...lands, ...waters]) {
      ctx.globalAlpha = e.a
      ctx.strokeStyle = style.coast
      ctx.lineWidth = coastW / Math.sqrt(Math.max(k, 0.05)) / Math.max(1, Math.sqrt(k))
      if (style.coastBrush) {
        // a loaded brush traced round the shore, swelling and thinning
        this.brushLine(ctx, e.f, true, ctx.lineWidth * 1.15, style.coast, 0)
      } else if (style.symbols === 'tech') {
        ctx.save()
        ctx.shadowColor = style.coast
        ctx.shadowBlur = 6 * this.dpr
        ctx.lineWidth = coastW / k
        ctx.stroke(this.pathOf(e.f))
        ctx.restore()
      } else ctx.stroke(this.pathOf(e.f))
    }
    ctx.globalAlpha = 1

    // ── terrain ────────────────────────────────────────────────────────────────
    // painted styles collect every sprite first and draw them back to front
    // across ALL areas, so a range in front overlaps the grove behind it
    const sprites: PaintedSprite[] = []
    const paintedTerrain = !!style.painting && inkMapAssetsReady()
    for (const e of feats) {
      const f = e.f
      const paint = style.areas[f.kind]
      if (!paint || f.kind === 'land' || f.kind === 'water' || f.kind === 'zone') continue
      if (!visible(f)) continue
      const p = this.pathOf(f)
      ctx.globalAlpha = e.a * paint.alpha
      ctx.fillStyle = f.color || paint.fill
      ctx.fill(p)
      ctx.globalAlpha = e.a
      if (paintedTerrain && PAINT_KINDS.has(f.kind)) {
        this.collectPaintings(f, style, e.a, k, vb, sprites)
        continue
      }
      if (paint.stroke) {
        ctx.save()
        ctx.strokeStyle = f.color || paint.stroke
        ctx.lineWidth = 1.2 / k
        ctx.setLineDash([6 / k, 5 / k])
        if (style.symbols === 'tech') {
          ctx.shadowColor = paint.stroke
          ctx.shadowBlur = 5 * this.dpr
        }
        ctx.stroke(p)
        ctx.restore()
      }
      this.symbols(ctx, f, style, paint.mark, paint.mark2, k, vb)
    }
    ctx.globalAlpha = 1
    if (sprites.length) {
      sprites.sort((a, b) => a.fy - b.fy)
      ctx.imageSmoothingQuality = 'high'
      for (const sp of sprites) {
        ctx.globalAlpha = sp.a
        if (sp.flip) {
          ctx.save()
          ctx.translate(sp.x, 0)
          ctx.scale(-1, 1)
          ctx.drawImage(sp.c, -sp.w / 2, sp.y, sp.w, sp.h)
          ctx.restore()
        } else ctx.drawImage(sp.c, sp.x - sp.w / 2, sp.y, sp.w, sp.h)
      }
      ctx.globalAlpha = 1
    }

    // ── territories (kingdoms / factions) ──────────────────────────────────────
    const terr = feats.filter((e) => e.f.kind === 'territory')
    if (terr.length) {
      ctx.save()
      if (doc.base === 'sea' && lands.length) ctx.clip(landPath)
      for (const e of terr) {
        const f = e.f
        const p = this.pathOf(f)
        const raw = featureColor(f, style, s.tagColors)
        // painted maps grind realm colours into mineral pigments
        const col = style.painting ? pigmentOf(raw) : raw
        ctx.globalAlpha = e.a * style.territoryAlpha
        ctx.fillStyle = col
        ctx.fill(p)
        // inner glow along the border
        ctx.save()
        ctx.clip(p)
        ctx.globalAlpha =
          e.a * (style.territoryBorder === 'glow' ? 0.55 : style.painting ? 0.16 : 0.35)
        ctx.strokeStyle = col
        ctx.lineWidth = 16 / Math.max(0.35, k)
        ctx.filter = style.territoryBorder === 'brush' ? 'blur(3px)' : 'none'
        ctx.stroke(p)
        ctx.restore()
        ctx.globalAlpha = e.a
        ctx.strokeStyle = col
        ctx.lineWidth = (style.territoryBorder === 'brush' ? 2.4 : 1.6) / Math.sqrt(k)
        if (style.territoryBorder === 'dash') ctx.setLineDash([10 / Math.sqrt(k), 5 / Math.sqrt(k)])
        if (style.territoryBorder === 'glow') {
          ctx.shadowColor = col
          ctx.shadowBlur = 10 * this.dpr
        }
        ctx.stroke(p)
        ctx.setLineDash([])
        ctx.shadowBlur = 0
      }
      ctx.restore()
    }
    ctx.globalAlpha = 1

    // ── lines (roads, rivers, rails, walls…) ───────────────────────────────────
    for (const e of feats) {
      const f = e.f
      if (MAP_KIND_GEOMETRY[f.kind] !== 'line' || LIVE_KINDS.has(f.kind)) continue
      if (!visible(f)) continue
      ctx.globalAlpha = e.a
      this.drawLine(ctx, f, style, k, s.tagColors)
    }
    ctx.globalAlpha = 1

    ctx.restore() // sheet clip

    // ── frame, compass, title ──────────────────────────────────────────────────
    this.worldTransform(ctx, cam)
    this.frame(ctx, s)

    // ── grain + vignette (screen space) ────────────────────────────────────────
    this.screenTransform(ctx)
    const pat = this.grainPattern(ctx, style.grain)
    if (pat) {
      const [sx0, sy0] = toScreen(cam, 0, 0)
      const [sx1, sy1] = toScreen(cam, W, H)
      ctx.save()
      ctx.beginPath()
      ctx.rect(sx0, sy0, sx1 - sx0, sy1 - sy0)
      ctx.clip()
      ctx.globalAlpha = style.grainAlpha
      ctx.fillStyle = pat
      ctx.fillRect(0, 0, this.w, this.h)
      ctx.restore()
    }

    // ── points (screen space, crisp at every zoom) ─────────────────────────────
    this.screenTransform(ctx)
    const labels: (() => void)[] = []
    for (const e of feats) {
      const f = e.f
      if (f.kind !== 'place') continue
      if (!visible(f)) continue
      this.drawPlace(ctx, f, style, cam, e.a, labels, s.showLabels)
    }
    // area + territory names, free labels
    if (s.showLabels) {
      for (const e of feats) {
        const f = e.f
        if (!f.name && f.kind !== 'label') continue
        if (f.kind === 'label') {
          this.freeLabel(ctx, f, style, cam, e.a)
          continue
        }
        const geo = MAP_KIND_GEOMETRY[f.kind]
        if (geo === 'area' && f.name && visible(f))
          this.areaLabel(ctx, f, style, cam, e.a, s.tagColors)
        if (geo === 'line' && f.name && !LIVE_KINDS.has(f.kind) && visible(f))
          this.lineLabel(ctx, f, style, cam, e.a)
      }
      for (const l of labels) l()
    }
    ctx.globalAlpha = 1

    if (style.vignette > 0) {
      const g = ctx.createRadialGradient(
        this.w / 2,
        this.h / 2,
        Math.min(this.w, this.h) * 0.35,
        this.w / 2,
        this.h / 2,
        Math.max(this.w, this.h) * 0.75
      )
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(1, `rgba(0,0,0,${style.vignette})`)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, this.w, this.h)
    }
  }

  private graticule(ctx: Ctx, W: number, H: number, k: number, color: string) {
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = 1 / k
    const step = Math.min(W, H) / 8
    ctx.beginPath()
    for (let x = step; x < W; x += step) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H)
    }
    for (let y = step; y < H; y += step) {
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
    }
    ctx.stroke()
    ctx.restore()
  }

  /** Concentric coast lines (water side). `inside` = draw inward (lakes). */
  private ripples(
    ctx: Ctx,
    path: Path2D,
    style: MapStyle,
    water: string,
    k: number,
    inside: boolean
  ) {
    const rings = style.ripples
    if (!rings.length) return
    const gap = 7
    if (gap * k < 1.6) return
    const t = Math.max(0.6, 1.1 / k)
    ctx.save()
    ctx.lineJoin = 'round'
    for (let i = rings.length; i >= 1; i--) {
      const w = gap * i * 2 * (inside ? 0.8 : 1)
      ctx.strokeStyle = rings[rings.length - i]
      ctx.lineWidth = w
      ctx.stroke(path)
      ctx.strokeStyle = water
      ctx.lineWidth = Math.max(0, w - t * 2)
      ctx.stroke(path)
    }
    ctx.restore()
  }

  private symbols(
    ctx: Ctx,
    f: MapFeature,
    style: MapStyle,
    mark: string,
    mark2: string,
    k: number,
    vb: Box
  ) {
    const spacing = SYMBOL_SPACING[f.kind]
    if (!spacing) return
    // symbols grow with the zoom up to ~46px on screen, then hold that size
    // (deep zoom reveals the space between trees rather than giant trees)
    const size = Math.min(spacing * 0.95 * (f.size || 1), 46 / k)
    const px = size * k
    if (px < 4.5) return
    // extremely zoomed out on a huge forest: thin the crowd
    const skip = px < 7 ? 2 : 1
    const pts = this.scatterOf(f)
    const lw = Math.max(0.5 / k, size * (style.symbols === 'tech' ? 0.035 : 0.055))
    const baseAlpha = ctx.globalAlpha
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    const m = size
    for (let i = 0, n = 0; i < pts.length; i += 3, n++) {
      if (skip > 1 && n % skip) continue
      const x = pts[i]
      const y = pts[i + 1]
      if (x < vb.x0 - m || x > vb.x1 + m || y < vb.y0 - m || y > vb.y1 + m) continue
      ctx.globalAlpha = baseAlpha
      drawTerrainMark(
        ctx,
        f.kind,
        style.symbols,
        x,
        y + size * 0.3,
        size,
        pts[i + 2],
        f.color ? f.color : mark,
        mark2,
        lw
      )
    }
    ctx.globalAlpha = baseAlpha
  }

  private drawLine(
    ctx: Ctx,
    f: MapFeature,
    style: MapStyle,
    k: number,
    tagColors: Map<string, string>
  ) {
    const paint = style.lines[f.kind]
    if (!paint) return
    const p = this.pathOf(f)
    const color = featureColor(f, style, tagColors)
    const size = f.size || 1
    // lines keep a readable screen width: grow slower than the zoom
    const w = (paint.width * size) / Math.pow(k, 0.55)
    ctx.save()
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    const glow = style.symbols === 'tech'
    if (glow) {
      ctx.shadowColor = color
      ctx.shadowBlur = 6 * this.dpr
    }
    switch (f.kind) {
      case 'river': {
        if (style.coastBrush) {
          // a river is one long brush stroke, thin at the source and
          // swelling toward the mouth, with a pale wash bled around it
          ctx.globalAlpha *= 0.85
          this.brushLine(ctx, f, false, w * 1.1, color, 1)
          break
        }
        if (paint.casing) {
          ctx.strokeStyle = paint.casing
          ctx.lineWidth = w + 1.6 / k
          ctx.stroke(p)
        }
        ctx.strokeStyle = color
        ctx.lineWidth = w
        ctx.stroke(p)
        if (style.symbols === 'drawn' || style.symbols === 'flat') {
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'
          ctx.lineWidth = w * 0.3
          ctx.stroke(p)
        }
        break
      }
      case 'road': {
        if (paint.casing) {
          ctx.strokeStyle = paint.casing
          ctx.lineWidth = w + 1.5 / k
          ctx.stroke(p)
          ctx.strokeStyle = color
          ctx.lineWidth = w
          ctx.stroke(p)
        } else {
          ctx.strokeStyle = color
          ctx.lineWidth = w
          ctx.setLineDash(style.symbols === 'ink' ? [w * 0.5, w * 2.5] : [w * 4, w * 2.2])
          ctx.stroke(p)
        }
        break
      }
      case 'rail': {
        if (style.symbols === 'flat' || style.symbols === 'tech') {
          ctx.strokeStyle = color
          ctx.lineWidth = w * 2.2
          ctx.stroke(p)
          ctx.shadowBlur = 0
          ctx.strokeStyle = style.symbols === 'tech' ? '#03101c' : '#ffffff'
          ctx.lineWidth = w * 1.1
          ctx.setLineDash([w * 3.5, w * 3.5])
          ctx.stroke(p)
        } else {
          // sleepers + a steel line
          ctx.strokeStyle = color
          ctx.lineWidth = w * 4.4
          ctx.setLineDash([w * 0.8, w * 3])
          ctx.lineCap = 'butt'
          ctx.stroke(p)
          ctx.setLineDash([])
          ctx.lineWidth = w
          ctx.stroke(p)
        }
        break
      }
      case 'wall': {
        if (paint.casing) {
          ctx.strokeStyle = paint.casing
          ctx.lineWidth = w + 1.5 / k
          ctx.stroke(p)
        }
        ctx.strokeStyle = color
        ctx.lineWidth = w
        ctx.stroke(p)
        ctx.lineCap = 'butt'
        ctx.lineWidth = w * 1.9
        ctx.setLineDash([w * 0.9, w * 0.9])
        ctx.stroke(p)
        break
      }
      case 'border': {
        ctx.strokeStyle = color
        ctx.lineWidth = w
        ctx.setLineDash([w * 6, w * 2.5, w * 1.2, w * 2.5])
        ctx.stroke(p)
        break
      }
      case 'searoute': {
        ctx.strokeStyle = color
        ctx.lineWidth = w
        ctx.setLineDash([w * 0.1, w * 3.2])
        ctx.stroke(p)
        break
      }
    }
    ctx.restore()
  }

  private text(
    ctx: Ctx,
    str: string,
    x: number,
    y: number,
    px: number,
    style: MapStyle,
    opts: {
      color?: string
      italic?: boolean
      bold?: boolean
      spacing?: number
      title?: boolean
      align?: CanvasTextAlign
      alpha?: number
    } = {}
  ) {
    if (px < 6 || !str) return
    const text = style.upper ? str.toUpperCase() : str
    ctx.save()
    ctx.globalAlpha = opts.alpha ?? 1
    ctx.font = `${opts.italic ? 'italic ' : ''}${opts.bold ? '700 ' : ''}${Math.round(px)}px ${opts.title ? style.fontTitle : style.fontLabel}`
    ;(ctx as Ctx & { letterSpacing?: string }).letterSpacing = `${(opts.spacing || 0) * px}px`
    ctx.textAlign = opts.align || 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = style.halo
    ctx.lineWidth = Math.max(2, px * 0.22)
    ctx.strokeText(text, x, y)
    ctx.fillStyle = opts.color || style.ink
    if (style.symbols === 'tech') {
      ctx.shadowColor = opts.color || style.accent
      ctx.shadowBlur = 6 * this.dpr
    }
    ctx.fillText(text, x, y)
    ctx.restore()
  }

  /** Stacked characters — the ink style writes CJK names top-to-bottom. */
  private verticalText(
    ctx: Ctx,
    str: string,
    x: number,
    y: number,
    px: number,
    style: MapStyle,
    color: string,
    alpha: number,
    /** 'center' = centred on y; 'top' = the column starts at y. */
    anchor: 'center' | 'top' = 'center',
    title = true
  ) {
    const chars = [...str]
    const lh = px * 1.08
    const y0 = anchor === 'top' ? y + px / 2 : y - ((chars.length - 1) * lh) / 2
    chars.forEach((ch, i) => this.text(ctx, ch, x, y0 + i * lh, px, style, { color, title, alpha }))
  }

  private areaLabel(
    ctx: Ctx,
    f: MapFeature,
    style: MapStyle,
    cam: Camera,
    alpha: number,
    tagColors: Map<string, string>
  ) {
    const pts = this.smoothPts(f)
    const area = Math.abs(polygonArea(pts))
    const [cx, cy] = polygonCentroid(pts)
    const [sx, sy] = toScreen(cam, cx, cy)
    const isRealm = f.kind === 'territory'
    const worldPx = Math.sqrt(area) * (isRealm ? 0.085 : 0.06) * (f.size || 1)
    const px = clamp(worldPx * cam.k, 0, isRealm ? 54 : 30)
    if (px < (isRealm ? 9 : 8)) return
    const color = isRealm ? featureColor(f, style, tagColors) : style.ink
    const name = f.name as string
    if ((style.id === 'ink' || style.calligraphy) && isVerticalName(name)) {
      this.verticalText(ctx, name, sx, sy, px, style, isRealm ? style.ink : color, alpha * 0.9)
      return
    }
    // dark styles light their realm names; paper styles ink them darker
    const realmInk = style.symbols === 'tech' ? color : this.darken(color)
    this.text(ctx, name, sx, sy, px, style, {
      color: isRealm ? realmInk : style.ink,
      italic: !isRealm && !style.calligraphy,
      spacing: isRealm ? 0.28 : 0.12,
      title: isRealm,
      bold: isRealm && style.id === 'atlas',
      alpha: alpha * (isRealm ? 0.85 : 0.75)
    })
  }

  private lineLabel(ctx: Ctx, f: MapFeature, style: MapStyle, cam: Camera, alpha: number) {
    const pts = this.smoothPts(f)
    if (polylineLength(pts) * cam.k < 120) return
    const mid = pointAlong(pts, 0.5)
    const [sx, sy] = toScreen(cam, mid.x, mid.y)
    let a = mid.angle
    if (a > Math.PI / 2) a -= Math.PI
    if (a < -Math.PI / 2) a += Math.PI
    const px = clamp(11 * Math.pow(cam.k, 0.3), 9, 16)
    ctx.save()
    ctx.translate(sx, sy)
    ctx.rotate(a)
    this.text(ctx, f.name as string, 0, -px * 0.9, px, style, {
      italic: !style.calligraphy,
      color: f.kind === 'river' ? this.darken(style.lines.river.color) : style.ink,
      spacing: 0.08,
      alpha
    })
    ctx.restore()
  }

  private freeLabel(ctx: Ctx, f: MapFeature, style: MapStyle, cam: Camera, alpha: number) {
    const [sx, sy] = toScreen(cam, f.pts[0], f.pts[1])
    if (sx < -400 || sy < -200 || sx > this.w + 400 || sy > this.h + 200) return
    const px = clamp(26 * (f.size || 1) * cam.k, 0, 140)
    if (px < 7) return
    const sea = f.icon === 'sea'
    const name = f.name || '…'
    const seaInk = style.symbols === 'tech' ? style.coast : this.darken(style.seaDeep, 0.45)
    ctx.save()
    ctx.translate(sx, sy)
    if (f.rot) ctx.rotate(f.rot)
    if ((style.id === 'ink' || style.calligraphy) && isVerticalName(name) && !f.rot) {
      this.verticalText(ctx, name, 0, 0, px, style, f.color || (sea ? '#4a5a60' : style.ink), alpha)
    } else {
      this.text(ctx, name, 0, 0, px, style, {
        color: f.color || (sea ? seaInk : style.ink),
        italic: sea && !style.calligraphy,
        title: true,
        spacing: sea ? 0.3 : 0.12,
        alpha
      })
    }
    ctx.restore()
  }

  private drawPlace(
    ctx: Ctx,
    f: MapFeature,
    style: MapStyle,
    cam: Camera,
    alpha: number,
    labels: (() => void)[],
    showLabels: boolean
  ) {
    const glyph = f.icon || 'town'
    const rank = PLACE_RANK[glyph] ?? 2
    const k = cam.k
    // small places appear as you zoom in
    const appear = rank >= 4 ? 0 : rank >= 3 ? 0.18 : rank >= 2 ? 0.3 : 0.5
    if (k < appear) return
    const fade = clamp((k - appear) / (appear * 0.5 + 0.05), 0, 1)
    const [sx, sy] = toScreen(cam, f.pts[0], f.pts[1])
    if (sx < -50 || sy < -50 || sx > this.w + 50 || sy > this.h + 50) return
    const zs = clamp(Math.pow(k * 2, 0.35), 0.7, 1.9)
    const sz = (4.2 + rank * 1.2) * zs * (f.size || 1)
    ctx.globalAlpha = alpha * fade
    if (style.calligraphy) {
      this.inkPlace(ctx, f, glyph, rank, sx, sy, sz, style, alpha * fade, labels, showLabels)
      return
    }
    const tech = style.symbols === 'tech'
    const color = f.color || (tech ? style.accent : style.ink)
    if (tech) {
      ctx.save()
      ctx.shadowColor = color
      ctx.shadowBlur = 8 * this.dpr
    }
    drawPlaceGlyph(ctx, glyph, sx, sy, sz, {
      fill: tech ? 'rgba(3,16,28,0.9)' : style.id === 'atlas' ? '#ffffff' : style.halo,
      stroke: color,
      lw: Math.max(1, sz * 0.16)
    })
    if (tech) ctx.restore()
    if (showLabels && f.name) {
      const px = clamp((9.5 + rank * 1.4) * zs, 9, 22)
      const a = alpha * fade
      labels.push(() =>
        this.text(ctx, f.name as string, sx + sz + 4, sy, px, style, {
          align: 'left',
          bold: rank >= 3,
          title: rank >= 4,
          spacing: rank >= 4 ? 0.06 : 0.02,
          alpha: a
        })
      )
    }
  }

  private frame(ctx: Ctx, s: RenderState) {
    const { doc, style, cam } = s
    const W = doc.width
    const H = doc.height
    const S = Math.min(W, H)
    const k = cam.k
    ctx.save()
    ctx.lineJoin = 'miter'
    switch (style.frame) {
      case 'double': {
        ctx.strokeStyle = style.ink
        ctx.lineWidth = S * 0.006
        ctx.strokeRect(S * 0.012, S * 0.012, W - S * 0.024, H - S * 0.024)
        ctx.lineWidth = S * 0.0015
        ctx.strokeRect(S * 0.024, S * 0.024, W - S * 0.048, H - S * 0.048)
        const c = S * 0.024
        for (const [x, y] of [
          [c, c],
          [W - c, c],
          [c, H - c],
          [W - c, H - c]
        ]) {
          ctx.fillStyle = style.ink
          ctx.fillRect(x - S * 0.01, y - S * 0.01, S * 0.02, S * 0.02)
        }
        break
      }
      case 'ornate': {
        const b = S * 0.018
        ctx.fillStyle = '#2d2a1e'
        ctx.fillRect(0, 0, W, b)
        ctx.fillRect(0, H - b, W, b)
        ctx.fillRect(0, 0, b, H)
        ctx.fillRect(W - b, 0, b, H)
        // graduated lat/long bars
        ctx.fillStyle = '#f3ecd8'
        const seg = S * 0.05
        for (let x = b; x < W - b; x += seg * 2) {
          ctx.fillRect(x, b * 0.3, seg, b * 0.4)
          ctx.fillRect(x, H - b * 0.7, seg, b * 0.4)
        }
        for (let y = b; y < H - b; y += seg * 2) {
          ctx.fillRect(b * 0.3, y, b * 0.4, seg)
          ctx.fillRect(W - b * 0.7, y, b * 0.4, seg)
        }
        break
      }
      case 'seal': {
        ctx.strokeStyle = 'rgba(30,30,30,0.55)'
        ctx.lineWidth = S * 0.002
        ctx.strokeRect(S * 0.02, S * 0.02, W - S * 0.04, H - S * 0.04)
        // the red seal (印章) with the map's name
        const r = S * 0.05
        const x = W - S * 0.1
        const y = S * 0.1
        ctx.fillStyle = 'rgba(178,34,34,0.88)'
        ctx.beginPath()
        ctx.roundRect(x - r, y - r, r * 2, r * 2, r * 0.18)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,240,230,0.9)'
        ctx.lineWidth = r * 0.06
        ctx.beginPath()
        ctx.roundRect(x - r * 0.84, y - r * 0.84, r * 1.68, r * 1.68, r * 0.12)
        ctx.stroke()
        // a seal carves characters — a Latin-named map gets 天下 ("all under heaven")
        const cjk = [...(doc.name || '')].filter((c) => CJK.test(c))
        const chars = (cjk.length ? cjk : ['天', '下']).slice(0, 4)
        ctx.fillStyle = 'rgba(255,244,236,0.95)'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const grid = chars.length > 2
        ctx.font = `${Math.round(r * (grid ? 0.62 : chars.length === 1 ? 1.1 : 0.72))}px ${style.fontTitle}`
        chars.forEach((ch, i) => {
          // traditional reading order: right column first, top to bottom
          const col = grid ? (i < 2 ? 1 : 0) : 0
          const row = grid ? i % 2 : i
          const cx = grid ? x + (col ? r * 0.38 : -r * 0.38) : x
          const cy = grid
            ? y + (row ? r * 0.38 : -r * 0.38)
            : chars.length === 1
              ? y
              : y + (row ? r * 0.4 : -r * 0.4)
          ctx.fillText(ch, cx, cy)
        })
        break
      }
      case 'tech': {
        ctx.strokeStyle = style.accent
        ctx.shadowColor = style.accent
        ctx.shadowBlur = 8 * this.dpr
        ctx.lineWidth = 2 / k
        const L = S * 0.06
        const m = S * 0.015
        for (const [x, y, dx, dy] of [
          [m, m, 1, 1],
          [W - m, m, -1, 1],
          [m, H - m, 1, -1],
          [W - m, H - m, -1, -1]
        ]) {
          ctx.beginPath()
          ctx.moveTo(x + dx * L, y)
          ctx.lineTo(x, y)
          ctx.lineTo(x, y + dy * L)
          ctx.stroke()
        }
        ctx.shadowBlur = 0
        ctx.lineWidth = 1 / k
        ctx.globalAlpha = 0.5
        const step = S / 16
        ctx.beginPath()
        for (let x = step; x < W; x += step) {
          ctx.moveTo(x, 0)
          ctx.lineTo(x, S * 0.012)
          ctx.moveTo(x, H)
          ctx.lineTo(x, H - S * 0.012)
        }
        for (let y = step; y < H; y += step) {
          ctx.moveTo(0, y)
          ctx.lineTo(S * 0.012, y)
          ctx.moveTo(W, y)
          ctx.lineTo(W - S * 0.012, y)
        }
        ctx.stroke()
        ctx.globalAlpha = 1
        break
      }
      case 'thin': {
        ctx.strokeStyle = 'rgba(41,49,61,0.5)'
        ctx.lineWidth = 1.2 / k
        ctx.strokeRect(0, 0, W, H)
        break
      }
      case 'scroll':
        ctx.restore()
        ctx.save()
        this.scrollFrame(ctx, s)
        break
    }
    ctx.restore()

    // compass rose — bottom-right of the sheet
    const r = S * 0.055
    drawCompass(
      ctx,
      style.symbols,
      W - S * 0.11,
      H - S * 0.13,
      r,
      style.ink,
      style.accent,
      style.fontTitle,
      0
    )

    // title cartouche — top-left
    if (s.showLabels && doc.name && style.frame !== 'seal' && style.frame !== 'scroll') {
      this.screenTransform(ctx)
      const [sx, sy] = toScreen(cam, S * 0.07, S * 0.075)
      const px = clamp(S * 0.034 * k, 0, 80)
      if (px >= 9) {
        this.text(ctx, doc.name, sx, sy, px, style, {
          title: true,
          align: 'left',
          spacing: style.upper ? 0.3 : 0.08,
          italic: style.id === 'parchment',
          bold: style.id === 'atlas'
        })
      }
      this.worldTransform(ctx, cam)
    }
  }

  // ── live layer ──────────────────────────────────────────────────────────────
  private renderLive(s: RenderState) {
    const ctx = this.ctx
    const { doc, style, cam, time } = s
    const W = doc.width
    const H = doc.height
    const k = cam.k
    const vb = viewBox(cam, this.w, this.h)

    // ── ambient ────────────────────────────────────────────────────────────────
    this.worldTransform(ctx, cam)
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, W, H)
    ctx.clip()
    // ambient motion reads as noise in a still (PNG export / thumbnails)
    const still = !!s.exporting
    if (style.ambient.waves && !still) this.ambientWaves(ctx, s, vb)
    if (style.ambient.clouds && !still) this.ambientClouds(ctx, s)
    if (style.ambient.mist && !still) this.ambientMist(ctx, s)
    // 山水 life: skiffs on the water, mist at the mountains' feet, geese
    // overhead — the ambient clock stops for reduced motion
    const at = s.reducedMotion ? 0 : time
    if (style.ambient.boats && !still) this.inkBoats(ctx, s, vb, at)
    if (style.ambient.mountainMist && !still) this.inkMist(ctx, s, vb, at)
    if (style.ambient.geese && !still && !s.reducedMotion) this.inkGeese(ctx, s)
    if (style.ambient.radar && !still) {
      const R = Math.hypot(W, H) * 0.6
      const a = (time * 0.6) % (Math.PI * 2)
      const cg = ctx.createConicGradient(a, W / 2, H / 2)
      cg.addColorStop(0, 'rgba(39,225,255,0.16)')
      cg.addColorStop(0.08, 'rgba(39,225,255,0.0)')
      cg.addColorStop(1, 'rgba(39,225,255,0.0)')
      ctx.fillStyle = cg
      ctx.beginPath()
      ctx.arc(W / 2, H / 2, R, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // ── live features: zones, arrows, events ──────────────────────────────────
    const live = doc.features.filter((f) => LIVE_KINDS.has(f.kind))
    for (const f of live) {
      const a = windowAlpha(f, s.year)
      if (a < 0.01 || !boxesOverlap(this.boxOf(f), vb, 120)) continue
      this.worldTransform(ctx, cam)
      ctx.globalAlpha = a
      const color = featureColor(f, style, s.tagColors)
      if (f.kind === 'zone' || f.kind === 'arrow') {
        if (f.kind === 'zone') this.drawZone(ctx, f, color, k, time)
        else this.drawArrow(ctx, f, color, style, k, time)
        if (f.name && s.showLabels) {
          const pts = this.smoothPts(f)
          const [wx, wy] =
            f.kind === 'zone' ? polygonCentroid(pts) : ((q) => [q.x, q.y])(pointAlong(pts, 0.5))
          const [sx, sy] = toScreen(cam, wx, wy)
          this.screenTransform(ctx)
          this.text(ctx, f.name, sx, sy - (f.kind === 'arrow' ? 14 : 0), 12.5, style, {
            color: this.darken(color),
            bold: true,
            italic: true,
            alpha: a
          })
        }
      } else if (f.kind === 'event') {
        this.screenTransform(ctx)
        const [sx, sy] = toScreen(cam, f.pts[0], f.pts[1])
        this.drawEvent(ctx, f, sx, sy, color, style, time, a, s.showLabels)
      }
    }
    ctx.globalAlpha = 1

    // ── journeys ───────────────────────────────────────────────────────────────
    if (s.showTrails) {
      this.worldTransform(ctx, cam)
      for (const tk of s.tokens) {
        if (tk.keys.length < 2 || tk.life < 0.02) continue
        const sel = tk.id === s.selectedTokenId || tk.id === s.hoverTokenId
        this.drawTrail(ctx, tk, s, sel)
      }
    }

    // ── people ─────────────────────────────────────────────────────────────────
    this.screenTransform(ctx)
    const states = s.tokens.map((tk) => ({ tk, st: tokenStateAt(tk.keys, s.year) }))
    const raw = states.map(({ st }) => {
      const [x, y] = toScreen(cam, st.x, st.y)
      return { x, y }
    })
    const placed = fanOut(raw, 24, 20)
    const R = clamp(13 * Math.pow(k * 2, 0.2), 11, 22)
    this.tokenHits = []
    // selected / hovered on top
    const order = states.map((_, i) => i)
    order.sort((a, b) => {
      const pa = states[a].tk.id === s.selectedTokenId || states[a].tk.id === s.hoverTokenId ? 1 : 0
      const pb = states[b].tk.id === s.selectedTokenId || states[b].tk.id === s.hoverTokenId ? 1 : 0
      return pa - pb || placed[a].y - placed[b].y
    })
    for (const i of order) {
      const { tk, st } = states[i]
      if (tk.life < 0.02) continue
      const p = placed[i]
      if (p.x < -60 || p.y < -60 || p.x > this.w + 60 || p.y > this.h + 60) continue
      const bob = st.leg >= 0 ? Math.sin(time * 14 + i) * 1.6 : 0
      this.drawToken(ctx, tk, p.x, p.y + bob, R, st, s, time)
      this.tokenHits.push({ id: tk.id, x: p.x, y: p.y, r: R + 3 })
    }

    // ── bursts (an event just happened) ────────────────────────────────────────
    for (const b of s.bursts) {
      const age = time - b.t0
      if (age < 0 || age > 1.6) continue
      const [x, y] = toScreen(cam, b.x, b.y)
      for (let j = 0; j < 3; j++) {
        const u = clamp((age - j * 0.18) / 1.2, 0, 1)
        if (u <= 0) continue
        ctx.globalAlpha = (1 - u) * 0.85
        ctx.strokeStyle = b.color
        ctx.lineWidth = 3 * (1 - u) + 0.5
        ctx.beginPath()
        ctx.arc(x, y, 8 + u * 70, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1

    // ── hover / selection ──────────────────────────────────────────────────────
    if (!s.exporting) {
      const hov =
        s.hoverFeatureId && s.hoverFeatureId !== s.selectedFeatureId
          ? doc.features.find((f) => f.id === s.hoverFeatureId)
          : null
      if (hov) this.outline(ctx, hov, s, false)
      const sel = s.selectedFeatureId
        ? doc.features.find((f) => f.id === s.selectedFeatureId)
        : null
      if (sel) this.outline(ctx, sel, s, true)
      if (s.preview) this.drawPreview(ctx, s)
    }

    // high-tech scanlines over everything
    if (style.ambient.scan && !s.exporting) {
      this.screenTransform(ctx)
      const y = ((time * 90) % (this.h + 200)) - 100
      const g = ctx.createLinearGradient(0, y - 60, 0, y + 60)
      g.addColorStop(0, 'rgba(39,225,255,0)')
      g.addColorStop(0.5, 'rgba(39,225,255,0.06)')
      g.addColorStop(1, 'rgba(39,225,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, y - 60, this.w, 120)
    }
  }

  private ambientWaves(ctx: Ctx, s: RenderState, vb: Box) {
    const { doc, style, cam, time } = s
    const key = s.version + '|' + doc.width + 'x' + doc.height
    if (this.waves.key !== key) {
      // wave marks scattered over open water only
      const lands = doc.features.filter((f) => f.kind === 'land').map((f) => f.pts)
      const rand = rng(hashStr(doc.id))
      const pts: number[] = []
      const inLand = (x: number, y: number) => lands.some((p) => pointInPolygon(x, y, p))
      const count = Math.round((doc.width * doc.height) / 26000)
      for (let i = 0; i < count * 3 && pts.length < count * 3; i++) {
        const x = rand() * doc.width
        const y = rand() * doc.height
        const baseIsSea = doc.base === 'sea'
        if (baseIsSea ? inLand(x, y) : true) continue
        pts.push(x, y, rand())
      }
      this.waves = { key, pts }
    }
    const k = cam.k
    const size = 9
    if (size * k < 3.5) return
    ctx.save()
    ctx.strokeStyle =
      style.symbols === 'drawn' && style.id === 'parchment'
        ? 'rgba(74,53,32,0.45)'
        : 'rgba(255,255,255,0.55)'
    ctx.lineWidth = Math.max(0.6 / k, 1.1)
    ctx.lineCap = 'round'
    const P = this.waves.pts
    for (let i = 0; i < P.length; i += 3) {
      const x = P[i]
      const y = P[i + 1]
      if (x < vb.x0 - 20 || x > vb.x1 + 20 || y < vb.y0 - 20 || y > vb.y1 + 20) continue
      const ph = P[i + 2] * Math.PI * 2
      const a = 0.5 + 0.5 * Math.sin(time * 0.8 + ph)
      ctx.globalAlpha = a * 0.9
      const dx = Math.sin(time * 0.5 + ph) * 2
      ctx.beginPath()
      ctx.moveTo(x - size + dx, y)
      ctx.quadraticCurveTo(x - size / 2 + dx, y - size * 0.45, x + dx, y)
      ctx.quadraticCurveTo(x + size / 2 + dx, y + size * 0.45, x + size + dx, y)
      ctx.stroke()
    }
    ctx.restore()
  }

  private ambientClouds(ctx: Ctx, s: RenderState) {
    const { doc, cam, time } = s
    // clouds fade away as you zoom in, like flying below them
    const vis = clamp(1.1 - cam.k * 1.6, 0, 0.32)
    if (vis <= 0.01) return
    const rand = rng(hashStr(doc.id + 'clouds'))
    ctx.save()
    for (let i = 0; i < 7; i++) {
      const baseX = rand() * doc.width
      const y = rand() * doc.height
      const r = doc.width * (0.06 + rand() * 0.06)
      const speed = 6 + rand() * 10
      const span = doc.width + r * 4
      const x = ((baseX + time * speed) % span) - r * 2
      for (let j = 0; j < 4; j++) {
        const ox = (j - 1.5) * r * 0.55
        const oy = Math.sin(j * 1.7 + i) * r * 0.18
        const rr = r * (0.55 + ((j * 37 + i * 11) % 10) / 25)
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr)
        g.addColorStop(0, `rgba(255,255,255,${vis})`)
        g.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = g
        ctx.fillRect(x + ox - rr, y + oy - rr, rr * 2, rr * 2)
      }
    }
    ctx.restore()
  }

  private ambientMist(ctx: Ctx, s: RenderState) {
    const { doc, time } = s
    ctx.save()
    for (let i = 0; i < 4; i++) {
      const y = doc.height * (0.2 + i * 0.22) + Math.sin(time * 0.15 + i) * 30
      const hh = doc.height * 0.06
      const x = ((time * (8 + i * 3) + i * 500) % (doc.width * 1.6)) - doc.width * 0.3
      const g = ctx.createRadialGradient(x, y, 0, x, y, doc.width * 0.35)
      g.addColorStop(0, 'rgba(250,248,240,0.45)')
      g.addColorStop(1, 'rgba(250,248,240,0)')
      ctx.fillStyle = g
      ctx.save()
      ctx.translate(x, y)
      ctx.scale(1, hh / (doc.width * 0.35))
      ctx.translate(-x, -y)
      ctx.fillRect(x - doc.width * 0.35, y - doc.width * 0.35, doc.width * 0.7, doc.width * 0.7)
      ctx.restore()
    }
    ctx.restore()
  }

  private drawZone(ctx: Ctx, f: MapFeature, color: string, k: number, time: number) {
    const p = this.pathOf(f)
    const base = ctx.globalAlpha
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.2)
    ctx.fillStyle = color
    ctx.globalAlpha = base * (0.1 + pulse * 0.08)
    ctx.fill(p)
    // diagonal hatching
    ctx.save()
    ctx.clip(p)
    const b = this.boxOf(f)
    ctx.globalAlpha = base * 0.25
    ctx.strokeStyle = color
    ctx.lineWidth = 1.2 / k
    const step = 14 / Math.sqrt(k)
    ctx.beginPath()
    for (let x = b.x0 - (b.y1 - b.y0); x < b.x1; x += step) {
      ctx.moveTo(x, b.y1)
      ctx.lineTo(x + (b.y1 - b.y0), b.y0)
    }
    ctx.stroke()
    ctx.restore()
    ctx.globalAlpha = base
    ctx.strokeStyle = color
    ctx.lineWidth = 2.2 / k
    ctx.setLineDash([9 / k, 6 / k])
    ctx.lineDashOffset = (-time * 30) / k
    ctx.stroke(p)
    ctx.setLineDash([])
    ctx.lineDashOffset = 0
  }

  private drawArrow(
    ctx: Ctx,
    f: MapFeature,
    color: string,
    style: MapStyle,
    k: number,
    time: number
  ) {
    const pts = this.smoothPts(f)
    if (pts.length < 4) return
    const p = this.pathOf(f)
    const w = ((style.lines.arrow?.width || 6) * (f.size || 1)) / Math.pow(k, 0.5)
    ctx.save()
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    const base = ctx.globalAlpha
    ctx.globalAlpha = base * 0.28
    ctx.strokeStyle = color
    ctx.lineWidth = w
    ctx.stroke(p)
    ctx.globalAlpha = base
    ctx.lineWidth = w * 0.45
    ctx.setLineDash([w * 1.6, w * 1.1])
    ctx.lineDashOffset = -time * w * 5
    if (style.symbols === 'tech') {
      ctx.shadowColor = color
      ctx.shadowBlur = 8 * this.dpr
    }
    ctx.stroke(p)
    ctx.setLineDash([])
    // arrowhead
    const n = pts.length
    const ex = pts[n - 2]
    const ey = pts[n - 1]
    // heading from a point a little way back so hand-drawn wobble doesn't skew it
    let bi = n - 4
    while (bi > 0 && Math.hypot(ex - pts[bi], ey - pts[bi + 1]) < w * 2.5) bi -= 2
    const a = Math.atan2(ey - pts[bi + 1], ex - pts[bi])
    const hl = w * 2.6
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(ex + Math.cos(a) * hl * 0.35, ey + Math.sin(a) * hl * 0.35)
    ctx.lineTo(ex + Math.cos(a + 2.5) * hl, ey + Math.sin(a + 2.5) * hl)
    ctx.lineTo(ex + Math.cos(a) * -hl * 0.25, ey + Math.sin(a) * -hl * 0.25)
    ctx.lineTo(ex + Math.cos(a - 2.5) * hl, ey + Math.sin(a - 2.5) * hl)
    ctx.closePath()
    ctx.fill()
    // a runner travelling along the arrow
    const u = (time * 0.18) % 1
    const q = pointAlong(pts, u)
    ctx.globalAlpha = base * Math.sin(u * Math.PI)
    ctx.beginPath()
    ctx.arc(q.x, q.y, w * 0.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  private drawEvent(
    ctx: Ctx,
    f: MapFeature,
    sx: number,
    sy: number,
    color: string,
    style: MapStyle,
    time: number,
    alpha: number,
    showLabels: boolean
  ) {
    if (sx < -60 || sy < -60 || sx > this.w + 60 || sy > this.h + 60) return
    const s = 9 * (f.size || 1)
    const ph = (hashStr(f.id) % 100) / 100
    for (let j = 0; j < 2; j++) {
      const u = (time * 0.6 + ph + j * 0.5) % 1
      ctx.globalAlpha = alpha * (1 - u) * 0.7
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(sx, sy, s + u * s * 2.6, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = alpha
    ctx.fillStyle = style.symbols === 'tech' ? 'rgba(3,16,28,0.9)' : style.halo
    ctx.beginPath()
    ctx.arc(sx, sy, s * 1.35, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.stroke()
    drawEventGlyph(ctx, f.icon || 'star', sx, sy, s * 0.85, color, style.ink)
    if (showLabels && f.name) {
      this.text(ctx, f.name, sx, sy + s * 2.6, 12, style, {
        color: this.darken(color),
        bold: true,
        alpha
      })
      const yr =
        f.from != null ? (f.to != null && f.to !== f.from ? `${f.from}–${f.to}` : `${f.from}`) : ''
      if (yr)
        this.text(ctx, yr, sx, sy + s * 2.6 + 13, 10, style, {
          color: style.ink,
          alpha: alpha * 0.8
        })
    }
  }

  private drawTrail(ctx: Ctx, tk: TokenView, s: RenderState, sel: boolean) {
    const { style, cam, year } = s
    const k = cam.k
    const keys = tk.keys
    const color = tk.color || style.token.trail
    ctx.save()
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    const base = tk.life * (sel ? 1 : 0.55)
    // full route, faint and dashed
    ctx.globalAlpha = base * 0.5
    ctx.strokeStyle = color
    ctx.lineWidth = (sel ? 2.4 : 1.6) / k
    ctx.setLineDash([6 / k, 5 / k])
    ctx.beginPath()
    keys.forEach((kk, i) => (i ? ctx.lineTo(kk.x, kk.y) : ctx.moveTo(kk.x, kk.y)))
    ctx.stroke()
    // travelled part, solid with marching flow
    if (year != null) {
      const st = tokenStateAt(keys, year)
      ctx.globalAlpha = base
      ctx.setLineDash([10 / k, 4 / k])
      ctx.lineDashOffset = (-s.time * 24) / k
      ctx.lineWidth = (sel ? 3 : 2.2) / k
      ctx.beginPath()
      ctx.moveTo(keys[0].x, keys[0].y)
      for (let i = 1; i <= st.from && i < keys.length; i++) ctx.lineTo(keys[i].x, keys[i].y)
      ctx.lineTo(st.x, st.y)
      ctx.stroke()
    }
    ctx.setLineDash([])
    // stops
    this.screenTransform(ctx)
    keys.forEach((kk) => {
      const [x, y] = toScreen(cam, kk.x, kk.y)
      const reached = year == null || kk.t <= year
      ctx.globalAlpha = base * (reached ? 1 : 0.5)
      ctx.fillStyle = reached ? color : style.token.plate
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(x, y, sel ? 4.5 : 3.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      if (sel)
        this.text(
          ctx,
          String(Math.round(kk.t)) + (kk.note ? ` · ${kk.note}` : ''),
          x,
          y - 11,
          10.5,
          style,
          { color, bold: true, alpha: base }
        )
    })
    ctx.restore()
    this.worldTransform(ctx, cam)
  }

  private drawToken(
    ctx: Ctx,
    tk: TokenView,
    x: number,
    y: number,
    R: number,
    st: ReturnType<typeof tokenStateAt>,
    s: RenderState,
    time: number
  ) {
    const { style } = s
    if (style.calligraphy) {
      this.sealToken(ctx, tk, x, y, R, st, s, time)
      return
    }
    const sel = tk.id === s.selectedTokenId
    const hov = tk.id === s.hoverTokenId
    const ring = tk.color || style.token.ring
    ctx.save()
    ctx.globalAlpha = tk.life
    // motion dust behind a traveller
    if (st.leg >= 0) {
      for (let j = 1; j <= 4; j++) {
        const d = R * 0.55 * j
        ctx.globalAlpha = tk.life * (0.35 - j * 0.07)
        ctx.fillStyle = ring
        ctx.beginPath()
        ctx.arc(
          x - Math.cos(st.angle) * d,
          y + R * 0.6 - Math.sin(st.angle) * d,
          R * (0.32 - j * 0.05),
          0,
          Math.PI * 2
        )
        ctx.fill()
      }
      ctx.globalAlpha = tk.life
    }
    // selection halo
    if (sel || hov) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 4)
      ctx.strokeStyle = style.accent
      ctx.globalAlpha = tk.life * (sel ? 0.5 + pulse * 0.5 : 0.6)
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(x, y, R + 5 + (sel ? pulse * 3 : 0), 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = tk.life
    }
    // pin shadow + body
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 3
    ctx.fillStyle = ring
    ctx.beginPath()
    ctx.arc(x, y, R + 2.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.save()
    ctx.beginPath()
    ctx.arc(x, y, R, 0, Math.PI * 2)
    ctx.clip()
    if (tk.img && tk.img.complete && tk.img.naturalWidth) {
      const iw = tk.img.naturalWidth
      const ih = tk.img.naturalHeight
      const sc = (R * 2) / Math.min(iw, ih)
      if (tk.dead) ctx.filter = 'grayscale(1)'
      ctx.drawImage(tk.img, x - (iw * sc) / 2, y - (ih * sc) / 2, iw * sc, ih * sc)
      ctx.filter = 'none'
    } else {
      const g = ctx.createLinearGradient(x - R, y - R, x + R, y + R)
      g.addColorStop(0, tk.dead ? '#888' : ring)
      g.addColorStop(1, tk.dead ? '#555' : this.darken(ring, 0.55))
      ctx.fillStyle = g
      ctx.fillRect(x - R, y - R, R * 2, R * 2)
      ctx.fillStyle = '#fff'
      ctx.font = `700 ${Math.round(R * 0.95)}px ${style.fontLabel}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(tk.initial, x, y + 1)
    }
    ctx.restore()
    if (tk.dead) {
      ctx.fillStyle = 'rgba(20,20,20,0.85)'
      ctx.beginPath()
      ctx.arc(x + R * 0.72, y - R * 0.72, R * 0.42, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = `700 ${Math.round(R * 0.55)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('†', x + R * 0.72, y - R * 0.7)
    }
    // name plate
    if (s.showLabels || sel || hov) {
      const px = 11
      ctx.font = `600 ${px}px ${style.fontLabel}`
      const name = tk.name.length > 22 ? tk.name.slice(0, 21) + '…' : tk.name
      const tw = ctx.measureText(name).width
      const py = y + R + 11
      ctx.fillStyle = style.token.plate
      ctx.beginPath()
      ctx.roundRect(x - tw / 2 - 6, py - 8, tw + 12, 16, 8)
      ctx.fill()
      ctx.fillStyle = style.token.text
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(name, x, py + 0.5)
    }
    ctx.restore()
  }

  private outline(ctx: Ctx, f: MapFeature, s: RenderState, selected: boolean) {
    const { cam, style, time } = s
    const geo = MAP_KIND_GEOMETRY[f.kind]
    ctx.save()
    if (geo === 'point') {
      this.screenTransform(ctx)
      const [x, y] = toScreen(cam, f.pts[0], f.pts[1])
      ctx.strokeStyle = style.accent
      ctx.lineWidth = 2
      ctx.setLineDash([4, 3])
      ctx.lineDashOffset = -time * 12
      ctx.beginPath()
      ctx.arc(x, y, 18, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
      return
    }
    this.worldTransform(ctx, cam)
    const p = this.pathOf(f)
    ctx.strokeStyle = selected ? '#ffffff' : style.accent
    ctx.globalAlpha = selected ? 0.9 : 0.6
    ctx.lineWidth = (selected ? 4 : 3) / cam.k
    ctx.stroke(p)
    ctx.strokeStyle = style.accent
    ctx.globalAlpha = 1
    ctx.lineWidth = 2 / cam.k
    ctx.setLineDash([7 / cam.k, 5 / cam.k])
    ctx.lineDashOffset = (-time * 20) / cam.k
    ctx.stroke(p)
    ctx.setLineDash([])
    if (selected) {
      // vertex handles (only the raw control points — smoothing is derived)
      this.screenTransform(ctx)
      const pts = f.pts
      const stride = pts.length / 2 > 80 ? Math.ceil(pts.length / 2 / 80) : 1
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = style.accent
      ctx.lineWidth = 1.5
      for (let i = 0; i < pts.length; i += 2 * stride) {
        const [x, y] = toScreen(cam, pts[i], pts[i + 1])
        ctx.beginPath()
        ctx.rect(x - 3.5, y - 3.5, 7, 7)
        ctx.fill()
        ctx.stroke()
      }
    }
    ctx.restore()
  }

  private drawPreview(ctx: Ctx, s: RenderState) {
    const pv = s.preview
    if (!pv || pv.pts.length < 2) return
    const { cam, style, time } = s
    ctx.save()
    this.screenTransform(ctx)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    for (let i = 0; i < pv.pts.length; i += 2) {
      const [x, y] = toScreen(cam, pv.pts[i], pv.pts[i + 1])
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    if (pv.closed) {
      ctx.closePath()
      ctx.fillStyle = pv.color
      ctx.globalAlpha = 0.22
      ctx.fill()
      ctx.globalAlpha = 1
    }
    ctx.strokeStyle = pv.color
    ctx.lineWidth = 2.5
    ctx.setLineDash(pv.closed ? [6, 4] : [])
    ctx.lineDashOffset = -time * 20
    ctx.stroke()
    // vertex dots for click-to-place polylines
    ctx.setLineDash([])
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = style.accent
    if (pv.pts.length <= 80) {
      for (let i = 0; i < pv.pts.length; i += 2) {
        const [x, y] = toScreen(cam, pv.pts[i], pv.pts[i + 1])
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    }
    ctx.restore()
  }

  // ── 山水 painted styles ─────────────────────────────────────────────────────

  /** Queue the painting sprites standing in one mountains / hills / forest area. */
  private collectPaintings(
    f: MapFeature,
    style: MapStyle,
    alpha: number,
    k: number,
    vb: Box,
    out: PaintedSprite[]
  ) {
    const set = style.painting
    if (!set) return
    const defs = spritesFor(set, f.kind as SpriteKind)
    if (!defs.length) return
    const pl = this.placementsOf(f)
    // mountains stand taller than their spacing — they are the picture's heroes
    const unit = (PAINT_SPACING[f.kind] || 110) * (f.size || 1) * (f.kind === 'mountains' ? 1.4 : 1)
    const paper = style.land
    for (const p of pl) {
      const def = defs[pickIndex(p.pick, defs.length)]
      const c = bakedSprite(def, paper)
      if (!c) continue
      const h = unit * def.tall * p.scale
      if (h * k < 2.5) continue
      const w = (h * c.width) / c.height
      const top = p.y - h * def.foot
      if (p.x + w / 2 < vb.x0 || p.x - w / 2 > vb.x1 || top > vb.y1 || top + h < vb.y0) continue
      out.push({ c, x: p.x, y: top, w, h, fy: p.y, flip: p.flip, a: alpha })
    }
  }

  private placementsOf(f: MapFeature): Placement[] {
    let pl = this.placements.get(f.pts)
    if (!pl) {
      pl = paintingPlacements(this.smoothPts(f), f.kind, hashStr(f.id), f.size || 1)
      this.placements.set(f.pts, pl)
    }
    return pl
  }

  /** The 水纹 tile: stacked double wave lines with a curl at each crest. */
  private waveTile(ctx: Ctx, color: string): CanvasPattern | null {
    if (this.waveTiles.has(color)) return this.waveTiles.get(color) as CanvasPattern | null
    const TW = 192
    const TH = 96
    const c = document.createElement('canvas')
    c.width = TW
    c.height = TH
    const g = c.getContext('2d') as Ctx
    g.strokeStyle = color
    g.lineCap = 'round'
    g.lineJoin = 'round'
    const rows = 4
    const gap = TH / rows
    const amp = 3.4
    for (let row = 0; row < rows; row++) {
      const y0 = row * gap + gap / 2
      const ph = row % 2 ? Math.PI : 0
      const yAt = (x: number) => y0 + Math.sin((x / TW) * Math.PI * 4 + ph) * amp
      // the main wave, then a fainter echo under it
      for (const [dy, lw, a] of [
        [0, 1.35, 1],
        [4.2, 0.75, 0.55]
      ]) {
        g.globalAlpha = a
        g.lineWidth = lw
        g.beginPath()
        for (let x = 0; x <= TW; x += 2) {
          if (x === 0) g.moveTo(x, yAt(x) + dy)
          else g.lineTo(x, yAt(x) + dy)
        }
        g.stroke()
      }
      // a small curl breaking off each crest
      g.globalAlpha = 0.9
      g.lineWidth = 1.1
      for (let j = 0; j < 2; j++) {
        const cx = ((0.75 - ph / (Math.PI * 2) + j) / 2) * TW
        const cy = yAt(cx)
        g.beginPath()
        g.arc(cx + 2.6, cy + 2.4, 2.6, Math.PI * 1.05, Math.PI * 1.95)
        g.stroke()
      }
    }
    const pat = ctx.createPattern(c, 'repeat')
    this.waveTiles.set(color, pat)
    return pat
  }

  /** Fill a world-space box with the wave pattern, two zoom octaves cross-faded. */
  private seaWaves(
    ctx: Ctx,
    style: MapStyle,
    k: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ) {
    const pat = style.seaWaves ? this.waveTile(ctx, style.seaWaves) : null
    if (!pat || typeof DOMMatrix === 'undefined') return
    const base = ctx.globalAlpha
    for (const o of waveOctaves(k, 0.62)) {
      pat.setTransform(new DOMMatrix([o.scale, 0, 0, o.scale, 0, 0]))
      ctx.globalAlpha = base * o.alpha
      ctx.fillStyle = pat
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
    }
    ctx.globalAlpha = base
  }

  /**
   * A brush line along a feature: a pale bleed, then short overlapping runs
   * of varying pressure, then "flying white" — paper-coloured broken streaks
   * where the brush ran dry. `taper` 1 = thin at the start (a river's source).
   */
  private brushLine(
    ctx: Ctx,
    f: MapFeature,
    closed: boolean,
    width: number,
    color: string,
    taper: number
  ) {
    const pts = this.smoothPts(f)
    const n = pts.length / 2
    if (n < 2) return
    const runs = brushRuns(pts, closed, hashStr(f.id))
    const base = ctx.globalAlpha
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = color
    ctx.globalAlpha = base * 0.1
    ctx.lineWidth = width * 3.4
    ctx.stroke(this.pathOf(f))
    ctx.globalAlpha = base * 0.92
    for (const r of runs) {
      const u = (r.i0 + r.i1) / 2 / n
      const tw = taper ? 0.3 + 0.95 * Math.pow(u, 0.8) : 1
      ctx.lineWidth = width * r.w * tw
      ctx.beginPath()
      for (let i = r.i0; i <= r.i1; i++) {
        const [x, y] = vertexAt(pts, i)
        if (i === r.i0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = base * 0.55
    ctx.strokeStyle = 'rgba(246,240,226,0.9)'
    ctx.lineWidth = Math.max(width * 0.16, 0.2)
    ctx.setLineDash([width * 5, width * 11, width * 2, width * 7])
    ctx.lineDashOffset = hashStr(f.id) % 97
    ctx.stroke(this.pathOf(f))
    ctx.restore()
  }

  /** 装裱 — the silk mounting, edge strips and rollers, drawn under the sheet. */
  private mountUnder(ctx: Ctx, s: RenderState) {
    const { doc, style } = s
    const m = style.mount
    if (!m) return
    const W = doc.width
    const H = doc.height
    const S = Math.min(W, H)
    const b = S * 0.045
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.38)'
    ctx.shadowBlur = 26 * this.dpr
    ctx.shadowOffsetY = 7 * this.dpr
    ctx.fillStyle = m.silk
    ctx.fillRect(-b, -b, W + b * 2, H + b * 2)
    ctx.restore()

    // brocade: a faint woven lattice in the border only
    ctx.save()
    const ring = new Path2D()
    ring.rect(-b, -b, W + b * 2, H + b * 2)
    ring.rect(0, 0, W, H)
    ctx.clip(ring, 'evenodd')
    ctx.strokeStyle = 'rgba(255,255,255,0.09)'
    ctx.lineWidth = S * 0.0012
    const step = b * 0.34
    ctx.beginPath()
    for (let d = -H - b * 2; d < W + b * 2; d += step) {
      ctx.moveTo(d - b, -b)
      ctx.lineTo(d + H + b, H + b)
      ctx.moveTo(d - b, H + b)
      ctx.lineTo(d + H + b, -b)
    }
    ctx.stroke()
    // tiny woven dots at the lattice crossings read as damask
    ctx.fillStyle = 'rgba(0,0,0,0.05)'
    ctx.fillRect(-b, -b, W + b * 2, H + b * 2)
    ctx.restore()

    // 隔水 strips hugging the painting, and the mount's outer hairline
    ctx.strokeStyle = m.edge
    ctx.lineWidth = b * 0.16
    ctx.strokeRect(-b * 0.08, -b * 0.08, W + b * 0.16, H + b * 0.16)
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'
    ctx.lineWidth = S * 0.0012
    ctx.strokeRect(-b, -b, W + b * 2, H + b * 2)

    // rollers: a handscroll lies open between two rolls; a hanging scroll
    // has a slim top stave and a heavy bottom roller with knobs
    const roll = (x: number, y: number, w: number, h: number, vertical: boolean, tone: string) => {
      const g = vertical
        ? ctx.createLinearGradient(x, 0, x + w, 0)
        : ctx.createLinearGradient(0, y, 0, y + h)
      g.addColorStop(0, this.darken(tone, 0.55))
      g.addColorStop(0.32, tone)
      g.addColorStop(0.45, this.lighten(tone, 0.22))
      g.addColorStop(0.7, tone)
      g.addColorStop(1, this.darken(tone, 0.5))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, Math.min(w, h) * 0.18)
      ctx.fill()
    }
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.35)'
    ctx.shadowBlur = 10 * this.dpr
    ctx.shadowOffsetY = 4 * this.dpr
    if (W >= H) {
      const rw = S * 0.05
      const ext = S * 0.018
      const knob = S * 0.03
      // left: the rolled-up remainder of the scroll, in its silk
      roll(-b - rw, -b - ext, rw, H + b * 2 + ext * 2, true, m.silk)
      // right: the wooden stave
      const sw = S * 0.022
      roll(W + b, -b - ext, sw, H + b * 2 + ext * 2, true, m.roller)
      for (const [x, w] of [
        [-b - rw * 0.78, rw * 0.56],
        [W + b + sw * 0.1, sw * 0.8]
      ]) {
        roll(x, -b - ext - knob, w, knob, true, m.knob)
        roll(x, H + b + ext, w, knob, true, m.knob)
      }
    } else {
      const top = S * 0.022
      roll(-b - S * 0.01, -b - top, W + b * 2 + S * 0.02, top, false, m.roller)
      const bh = S * 0.04
      const ext = S * 0.05
      roll(-b - ext, H + b, W + b * 2 + ext * 2, bh, false, m.roller)
      roll(-b - ext - S * 0.03, H + b + bh * 0.15, S * 0.032, bh * 0.7, false, m.knob)
      roll(W + b + ext, H + b + bh * 0.15, S * 0.032, bh * 0.7, false, m.knob)
    }
    ctx.restore()
  }

  /** Inside the sheet: a fine border, the title slip (题签) with its seal, and
   *  a collector's seal in the corner. World transform. */
  private scrollFrame(ctx: Ctx, s: RenderState) {
    const { doc, style } = s
    const W = doc.width
    const H = doc.height
    const S = Math.min(W, H)
    ctx.strokeStyle = 'rgba(28,26,23,0.4)'
    ctx.lineWidth = S * 0.0015
    ctx.strokeRect(S * 0.016, S * 0.016, W - S * 0.032, H - S * 0.032)
    if (style.mount) {
      const cs = sealCanvas(style.mount.seal, {
        size: 128,
        mode: 'yang',
        seed: hashStr(style.mount.seal)
      })
      const d = S * 0.055
      ctx.globalAlpha = 0.85
      ctx.drawImage(cs, S * 0.04, H - S * 0.04 - d, d, d)
      ctx.globalAlpha = 1
    }
    const name = doc.name || ''
    if (!s.showLabels || !name) return
    const px = S * 0.034
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `${px}px ${style.fontTitle}`
    const paperSlip = (x: number, y: number, w: number, h: number) => {
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.12)'
      ctx.shadowBlur = 4 * this.dpr
      ctx.fillStyle = 'rgba(248,243,230,0.94)'
      ctx.fillRect(x, y, w, h)
      ctx.restore()
      ctx.strokeStyle = 'rgba(28,26,23,0.5)'
      ctx.lineWidth = S * 0.0012
      ctx.strokeRect(x + w * 0.06, y + w * 0.06, w - w * 0.12, h - w * 0.12)
    }
    const seal = sealCanvas(name, { size: 128, mode: 'yin', seed: hashStr(doc.id) })
    const ss = S * 0.042
    if (isVerticalName(name)) {
      const chars = [...name]
      const w = px * 1.7
      const h = chars.length * px * 1.12 + px * 1.1
      const x = W - S * 0.05 - w
      const y = S * 0.05
      paperSlip(x, y, w, h)
      ctx.fillStyle = style.ink
      chars.forEach((ch, i) => ctx.fillText(ch, x + w / 2, y + px * 1.1 + i * px * 1.12))
      ctx.globalAlpha = 0.92
      ctx.drawImage(seal, x + w / 2 - ss / 2, y + h + S * 0.012, ss, ss)
      ctx.globalAlpha = 1
    } else {
      const tw = ctx.measureText(name).width
      const w = tw + px * 1.4
      const h = px * 1.7
      const x = S * 0.05
      const y = S * 0.05
      paperSlip(x, y, w, h)
      ctx.fillStyle = style.ink
      ctx.fillText(name, x + w / 2, y + h / 2 + px * 0.04)
      ctx.globalAlpha = 0.92
      ctx.drawImage(seal, x + w + S * 0.012, y + (h - ss) / 2, ss, ss)
      ctx.globalAlpha = 1
    }
  }

  /** A place in the calligraphy styles: capitals as cinnabar seals, prefectures
   *  as double squares, counties as squares, villages as ink dots. Screen space. */
  private inkPlace(
    ctx: Ctx,
    f: MapFeature,
    glyph: string,
    rank: number,
    sx: number,
    sy: number,
    sz: number,
    style: MapStyle,
    a: number,
    labels: (() => void)[],
    showLabels: boolean
  ) {
    const ink = f.color || style.ink
    const paper = style.halo
    ctx.save()
    ctx.globalAlpha = a
    ctx.lineJoin = 'miter'
    switch (glyph) {
      case 'capital': {
        const chars = ((f.name || '').match(CJK_G) || []).slice(0, 2).join('') || '都'
        const c = sealCanvas(chars, { size: 96, mode: 'yin', seed: hashStr(f.id) })
        const d = sz * 2.5
        ctx.drawImage(c, sx - d / 2, sy - d / 2, d, d)
        break
      }
      case 'city': {
        const r = sz * 0.9
        ctx.fillStyle = paper
        ctx.fillRect(sx - r, sy - r, r * 2, r * 2)
        ctx.strokeStyle = ink
        ctx.lineWidth = Math.max(1.2, sz * 0.17)
        ctx.strokeRect(sx - r, sy - r, r * 2, r * 2)
        ctx.lineWidth = Math.max(0.8, sz * 0.09)
        ctx.strokeRect(sx - r * 0.55, sy - r * 0.55, r * 1.1, r * 1.1)
        break
      }
      case 'town': {
        const r = sz * 0.72
        ctx.fillStyle = paper
        ctx.fillRect(sx - r, sy - r, r * 2, r * 2)
        ctx.strokeStyle = ink
        ctx.lineWidth = Math.max(1.1, sz * 0.16)
        ctx.strokeRect(sx - r, sy - r, r * 2, r * 2)
        break
      }
      case 'village': {
        ctx.fillStyle = ink
        ctx.beginPath()
        ctx.arc(sx, sy, sz * 0.42, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      default:
        drawPlaceGlyph(ctx, glyph, sx, sy, sz, {
          fill: paper,
          stroke: ink,
          lw: Math.max(1, sz * 0.15)
        })
    }
    ctx.restore()
    if (!showLabels || !f.name) return
    const name = f.name
    const px = clamp(sz * 1.2 + 4, 10, 24)
    if (isVerticalName(name)) {
      const gx = sx + sz + px * 0.72
      labels.push(() =>
        this.verticalText(ctx, name, gx, sy - sz * 0.95, px, style, style.ink, a, 'top', rank >= 4)
      )
    } else {
      labels.push(() =>
        this.text(ctx, name, sx + sz + 5, sy, px, style, {
          align: 'left',
          title: rank >= 4,
          spacing: 0.03,
          alpha: a
        })
      )
    }
  }

  /** A person on a calligraphy map: a round cinnabar seal (their portrait
   *  framed in cinnabar, or their name's first character carved in it). */
  private sealToken(
    ctx: Ctx,
    tk: TokenView,
    x: number,
    y: number,
    R: number,
    st: ReturnType<typeof tokenStateAt>,
    s: RenderState,
    time: number
  ) {
    const { style } = s
    const sel = tk.id === s.selectedTokenId
    const hov = tk.id === s.hoverTokenId
    const red = tk.dead ? '#57524a' : style.token.ring
    ctx.save()
    ctx.globalAlpha = tk.life
    // travelling: ink dabs fading behind
    if (st.leg >= 0) {
      ctx.fillStyle = style.ink
      for (let j = 1; j <= 3; j++) {
        const d = R * 0.7 * j
        ctx.globalAlpha = tk.life * (0.3 - j * 0.08)
        ctx.beginPath()
        ctx.arc(
          x - Math.cos(st.angle) * d,
          y + R * 0.5 - Math.sin(st.angle) * d,
          R * (0.28 - j * 0.05),
          0,
          Math.PI * 2
        )
        ctx.fill()
      }
      ctx.globalAlpha = tk.life
    }
    // selection: a brush ensō drawing itself round the seal
    if (sel || hov) {
      const u = sel ? 0.86 + 0.08 * Math.sin(time * 2.4) : 0.7
      ctx.strokeStyle = style.ink
      ctx.lineCap = 'round'
      ctx.globalAlpha = tk.life * (sel ? 0.85 : 0.55)
      ctx.lineWidth = 2.6
      ctx.beginPath()
      ctx.arc(x, y, R + 6, -Math.PI * 0.4, -Math.PI * 0.4 + Math.PI * 2 * u)
      ctx.stroke()
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(x, y, R + 8.5, -Math.PI * 0.3, -Math.PI * 0.3 + Math.PI * 2 * u * 0.8)
      ctx.stroke()
      ctx.globalAlpha = tk.life
    }
    ctx.shadowColor = 'rgba(40,20,10,0.28)'
    ctx.shadowBlur = 5
    ctx.shadowOffsetY = 1.5
    if (tk.img && tk.img.complete && tk.img.naturalWidth) {
      ctx.fillStyle = red
      ctx.beginPath()
      ctx.arc(x, y, R + 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.save()
      ctx.beginPath()
      ctx.arc(x, y, R - 0.5, 0, Math.PI * 2)
      ctx.clip()
      const iw = tk.img.naturalWidth
      const ih = tk.img.naturalHeight
      const sc = (R * 2) / Math.min(iw, ih)
      ctx.filter = tk.dead ? 'grayscale(1) contrast(0.9)' : 'sepia(0.4) saturate(0.75)'
      ctx.drawImage(tk.img, x - (iw * sc) / 2, y - (ih * sc) / 2, iw * sc, ih * sc)
      ctx.filter = 'none'
      ctx.restore()
      ctx.strokeStyle = 'rgba(246,236,222,0.75)'
      ctx.lineWidth = 1.1
      ctx.beginPath()
      ctx.arc(x, y, R + 1.3, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      const ch = (tk.name.match(CJK_G) || [])[0] || tk.initial || '?'
      const c = sealCanvas(ch, {
        size: 96,
        mode: 'yin',
        round: true,
        seed: hashStr(tk.id),
        color: red
      })
      const d = (R + 3) * 2.13
      ctx.drawImage(c, x - d / 2, y - d / 2, d, d)
    }
    ctx.shadowColor = 'transparent'
    // name slip
    if (s.showLabels || sel || hov) {
      const px = 12
      ctx.font = `${px}px ${style.fontLabel}`
      const name = tk.name.length > 22 ? tk.name.slice(0, 21) + '…' : tk.name
      const tw = ctx.measureText(name).width
      const py = y + R + 12
      ctx.fillStyle = style.token.plate
      ctx.fillRect(x - tw / 2 - 6, py - 8.5, tw + 12, 17)
      ctx.strokeStyle = 'rgba(28,26,23,0.35)'
      ctx.lineWidth = 0.8
      ctx.strokeRect(x - tw / 2 - 4, py - 6.5, tw + 8, 13)
      ctx.fillStyle = style.token.text
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(name, x, py + 0.5)
    }
    ctx.restore()
  }

  /** Mist bands drifting across the feet of the painted ranges. World transform. */
  private inkMist(ctx: Ctx, s: RenderState, vb: Box, t: number) {
    const { doc, style } = s
    const key = s.version + '|' + doc.id
    if (this.mist.key !== key) {
      const bands: number[] = []
      for (const f of doc.features) {
        if (f.kind !== 'mountains' && f.kind !== 'hills') continue
        const unit = (PAINT_SPACING[f.kind] || 110) * (f.size || 1)
        const pl = this.placementsOf(f)
        for (let i = 0; i < pl.length && bands.length < 70 * 5; i += 2) {
          const p = pl[i]
          bands.push(
            p.x,
            p.y - unit * 0.1,
            unit * (1.3 + p.scale * 0.6),
            unit * 0.2,
            p.pick * 6.283
          )
        }
      }
      this.mist = { key, bands }
    }
    const B = this.mist.bands
    if (!B.length) return
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
    const paper = /^#[0-9a-f]{6}$/i.test(style.land) ? style.land : '#f1ead8'
    g.addColorStop(0, rgba(paper, 0.78))
    g.addColorStop(0.55, rgba(paper, 0.42))
    g.addColorStop(1, rgba(paper, 0))
    ctx.save()
    ctx.fillStyle = g
    for (let i = 0; i < B.length; i += 5) {
      const rx = B[i + 2]
      const x = B[i] + Math.sin(t * 0.045 + B[i + 4]) * rx * 0.45
      const y = B[i + 1] + Math.sin(t * 0.03 + B[i + 4] * 1.7) * B[i + 3] * 0.5
      if (x + rx < vb.x0 || x - rx > vb.x1 || y < vb.y0 - rx || y > vb.y1 + rx) continue
      ctx.globalAlpha = 0.5 + 0.35 * Math.sin(t * 0.06 + B[i + 4] * 2.3)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      this.worldTransform(ctx, s.cam)
      ctx.translate(x, y)
      ctx.scale(rx, B[i + 3])
      ctx.beginPath()
      ctx.arc(0, 0, 1, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  /** A skein of geese crossing the sky now and then. World transform. */
  private inkGeese(ctx: Ctx, s: RenderState) {
    const { doc, style, cam } = s
    const fl = flockAt(s.time, hashStr(doc.id), doc.width, doc.height)
    if (!fl) return
    const k = cam.k
    const sz = 6.5 / Math.pow(k, 0.85)
    const sp = sz * 2.6
    const ca = Math.cos(fl.angle)
    const sa = Math.sin(fl.angle)
    ctx.save()
    ctx.strokeStyle = style.ink
    ctx.lineWidth = 1.3 / k
    ctx.lineCap = 'round'
    ctx.globalAlpha = 0.6 * fl.alpha
    ctx.beginPath()
    for (const b of fl.birds) {
      const ax = b.along * sp
      const ay = b.across * sp
      const x = fl.x + ax * ca - ay * sa
      const y = fl.y + ax * sa + ay * ca
      const wing = -sz * (0.2 + 0.38 * Math.sin(s.time * 5.2 + b.flap))
      ctx.moveTo(x - sz, y + wing)
      ctx.quadraticCurveTo(x - sz * 0.4, y - sz * 0.04, x, y + sz * 0.14)
      ctx.quadraticCurveTo(x + sz * 0.4, y - sz * 0.04, x + sz, y + wing)
    }
    ctx.stroke()
    ctx.restore()
  }

  /** Fishermen's skiffs gliding out and back along sea routes and rivers. */
  private inkBoats(ctx: Ctx, s: RenderState, vb: Box, t: number) {
    const { doc, cam } = s
    const def = SPRITES.find((d) => d.kind === 'boat')
    const img = def ? spriteImage(def) : null
    if (!img) return
    const k = cam.k
    const h = clamp(15 * Math.pow(k, 0.35), 10, 28) / k
    const w = (h * img.naturalWidth) / img.naturalHeight
    let n = 0
    ctx.save()
    for (const f of doc.features) {
      if (f.kind !== 'searoute' && f.kind !== 'river') continue
      if (n >= 12) break
      if (windowAlpha(f, s.year) < 0.2) continue
      const pts = this.smoothPts(f)
      if (polylineLength(pts) * k < 140) continue
      n++
      const speed = f.kind === 'river' ? 3.2 : 5.5
      const b = boatAt(pts, t, speed, (hashStr(f.id) % 1000) / 1000)
      if (!b) continue
      if (b.x < vb.x0 - w || b.x > vb.x1 + w || b.y < vb.y0 - h || b.y > vb.y1 + h) continue
      const east = Math.cos(b.angle) * b.dir >= 0
      const y = b.y + b.bob * h * 0.05
      // a faint wake trailing behind
      ctx.globalAlpha = 0.35
      ctx.strokeStyle = s.style.ink
      ctx.lineWidth = 0.9 / k
      const back = east ? -1 : 1
      ctx.beginPath()
      ctx.moveTo(b.x + back * w * 0.35, y + h * 0.18)
      ctx.quadraticCurveTo(b.x + back * w * 0.7, y + h * 0.28, b.x + back * w * 0.95, y + h * 0.22)
      ctx.stroke()
      ctx.globalAlpha = 0.95
      ctx.save()
      ctx.translate(b.x, y)
      if (!east) ctx.scale(-1, 1)
      ctx.drawImage(img, -w / 2, -h * 0.75, w, h)
      ctx.restore()
    }
    ctx.restore()
  }

  // ── the ink-bloom reveal ─────────────────────────────────────────────────────
  private startReveal(s: RenderState) {
    const cw = this.canvas.width
    const ch = this.canvas.height
    if (cw < 4 || ch < 4) return
    const from = document.createElement('canvas')
    from.width = cw
    from.height = ch
    ;(from.getContext('2d') as Ctx).drawImage(this.canvas, 0, 0)
    // blots bloom from the middle, then from each range of mountains
    const centers: [number, number, number][] = [[cw / 2, ch / 2, Math.hypot(cw, ch) * 0.62]]
    for (const f of s.doc.features) {
      if (centers.length >= 5) break
      if (f.kind !== 'mountains') continue
      const [wx, wy] = polygonCentroid(this.smoothPts(f))
      const [sx, sy] = toScreen(s.cam, wx, wy)
      if (sx < 0 || sy < 0 || sx > this.w || sy > this.h) continue
      centers.push([sx * this.dpr, sy * this.dpr, Math.hypot(cw, ch) * 0.4])
    }
    this.reveal = { from, t0: s.time, centers }
  }

  private drawReveal(s: RenderState) {
    const r = this.reveal
    if (!r) return
    const t = s.time - r.t0
    if (r.centers.every((_, i) => bloomProgress(t, i) >= 1)) {
      this.reveal = null
      this.revealTmp = null
      return
    }
    const cw = this.canvas.width
    const ch = this.canvas.height
    if (!this.revealTmp || this.revealTmp.width !== cw || this.revealTmp.height !== ch) {
      this.revealTmp = document.createElement('canvas')
      this.revealTmp.width = cw
      this.revealTmp.height = ch
    }
    const g = this.revealTmp.getContext('2d') as Ctx
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalCompositeOperation = 'copy'
    g.drawImage(r.from, 0, 0, cw, ch)
    g.globalCompositeOperation = 'destination-out'
    const blot = bloomMask()
    r.centers.forEach(([x, y, R], i) => {
      const p = bloomProgress(t, i)
      if (p <= 0) return
      const rad = R * p
      if (blot) {
        const d = (rad * 2) / 0.84
        g.drawImage(blot, x - d / 2, y - d / 2, d, d)
      } else {
        g.beginPath()
        g.arc(x, y, rad, 0, Math.PI * 2)
        g.fill()
      }
    })
    g.globalCompositeOperation = 'source-over'
    const ctx = this.ctx
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 1
    ctx.drawImage(this.revealTmp, 0, 0)
  }

  /** Mix a hex color toward white (amount 0..1 of white mixed in). */
  lighten(hex: string, amt = 0.2): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
    if (!m) return hex
    const n = parseInt(m[1], 16)
    const f = (c: number) => Math.round(c + (255 - c) * amt)
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`
  }

  /** Mix a hex color toward black (amount 0..1 of the original kept). */
  darken(hex: string, keep = 0.62): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
    if (!m) return hex
    const n = parseInt(m[1], 16)
    const r = Math.round(((n >> 16) & 255) * keep)
    const g = Math.round(((n >> 8) & 255) * keep)
    const b = Math.round((n & 255) * keep)
    return `rgb(${r},${g},${b})`
  }
}
