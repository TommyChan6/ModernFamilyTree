// The painted map styles' sprite sheet: mountains, hills, groves and a boat
// cut from public-domain Song / Yuan landscape paintings (see
// assets/ink/map/CREDITS.md). Loaded once, lazily, the first time a painted
// style renders; every sprite is then "baked" per paper tone into a canvas
// that carries an opaque-ish paper silhouette under the brushwork, so a
// nearer ridge hides the one behind it instead of letting it show through.

import fankuanMassif from '../../assets/ink/map/fankuan-massif.webp'
import fankuanCrag from '../../assets/ink/map/fankuan-crag.webp'
import guoxiMain from '../../assets/ink/map/guoxi-main.webp'
import guoxiLeft from '../../assets/ink/map/guoxi-left.webp'
import guoxiFar from '../../assets/ink/map/guoxi-far.webp'
import litangPeak from '../../assets/ink/map/litang-peak.webp'
import litangSpires from '../../assets/ink/map/litang-spires.webp'
import miyourenRange from '../../assets/ink/map/miyouren-range.webp'
import miyourenPeaks from '../../assets/ink/map/miyouren-peaks.webp'
import miyourenTree from '../../assets/ink/map/miyouren-tree.webp'
import huangPines from '../../assets/ink/map/huang-pines.webp'
import huangSlopes from '../../assets/ink/map/huang-slopes.webp'
import huangBoat from '../../assets/ink/map/huang-boat.webp'
import wxPeakA from '../../assets/ink/map/wx-peak-a.webp'
import wxPeakB from '../../assets/ink/map/wx-peak-b.webp'
import wxPeakC from '../../assets/ink/map/wx-peak-c.webp'
import wxPeakD from '../../assets/ink/map/wx-peak-d.webp'
import wxPeakE from '../../assets/ink/map/wx-peak-e.webp'
import wxPeakF from '../../assets/ink/map/wx-peak-f.webp'
import wxHills from '../../assets/ink/map/wx-hills.webp'
import { inkBlotMaskUrl, inkFontsReady } from '../../lib/inkArt'

export type PaintSet = 'ink' | 'qinglu'
export type SpriteKind = 'mountains' | 'hills' | 'forest' | 'boat'

export interface SpriteDef {
  id: string
  url: string
  kind: SpriteKind
  sets: PaintSet[]
  /** Foot line as a fraction of the height (where the mist swallows it). */
  foot: number
  /** Height relative to the kind's spacing (tall massifs > squat ranges). */
  tall: number
  /** Ink passes when baking (2 = the faint silk-keyed washes read bolder). */
  passes?: number
}

const BOTH: PaintSet[] = ['ink', 'qinglu']

export const SPRITES: SpriteDef[] = [
  // Song ink mountains — 山水
  {
    id: 'fankuan-massif',
    url: fankuanMassif,
    kind: 'mountains',
    sets: ['ink'],
    foot: 0.78,
    tall: 1.9,
    passes: 2
  },
  {
    id: 'fankuan-crag',
    url: fankuanCrag,
    kind: 'mountains',
    sets: ['ink'],
    foot: 0.66,
    tall: 1.6,
    passes: 2
  },
  {
    id: 'guoxi-main',
    url: guoxiMain,
    kind: 'mountains',
    sets: ['ink'],
    foot: 0.82,
    tall: 1.7,
    passes: 2
  },
  {
    id: 'guoxi-left',
    url: guoxiLeft,
    kind: 'mountains',
    sets: ['ink'],
    foot: 0.8,
    tall: 1.5,
    passes: 2
  },
  {
    id: 'guoxi-far',
    url: guoxiFar,
    kind: 'mountains',
    sets: ['ink'],
    foot: 0.88,
    tall: 1.35,
    passes: 2
  },
  {
    id: 'litang-peak',
    url: litangPeak,
    kind: 'mountains',
    sets: ['ink'],
    foot: 0.62,
    tall: 1.6,
    passes: 2
  },
  {
    id: 'litang-spires',
    url: litangSpires,
    kind: 'mountains',
    sets: ['ink'],
    foot: 0.82,
    tall: 1.55,
    passes: 2
  },
  {
    id: 'miyouren-peaks',
    url: miyourenPeaks,
    kind: 'mountains',
    sets: ['ink'],
    foot: 0.86,
    tall: 0.95,
    passes: 2
  },
  // hills — Mi Youren's cloudy dots and Huang Gongwang's hemp-fibre slopes
  {
    id: 'miyouren-range',
    url: miyourenRange,
    kind: 'hills',
    sets: ['ink'],
    foot: 0.84,
    tall: 0.42,
    passes: 2
  },
  {
    id: 'huang-slopes',
    url: huangSlopes,
    kind: 'hills',
    sets: ['ink'],
    foot: 0.86,
    tall: 0.75,
    passes: 2
  },
  {
    id: 'miyouren-peaks-h',
    url: miyourenPeaks,
    kind: 'hills',
    sets: ['ink'],
    foot: 0.86,
    tall: 0.7,
    passes: 2
  },
  // groves — the trees stay ink in the blue-green style too, as Wang Ximeng's do
  { id: 'huang-pines', url: huangPines, kind: 'forest', sets: BOTH, foot: 0.9, tall: 0.75 },
  { id: 'miyouren-tree', url: miyourenTree, kind: 'forest', sets: BOTH, foot: 0.8, tall: 0.8 },
  // Wang Ximeng's mineral blue-green peaks — 青绿
  { id: 'wx-peak-a', url: wxPeakA, kind: 'mountains', sets: ['qinglu'], foot: 0.82, tall: 1.05 },
  { id: 'wx-peak-b', url: wxPeakB, kind: 'mountains', sets: ['qinglu'], foot: 0.86, tall: 1.0 },
  { id: 'wx-peak-c', url: wxPeakC, kind: 'mountains', sets: ['qinglu'], foot: 0.89, tall: 1.25 },
  { id: 'wx-peak-d', url: wxPeakD, kind: 'mountains', sets: ['qinglu'], foot: 0.91, tall: 1.25 },
  { id: 'wx-peak-e', url: wxPeakE, kind: 'mountains', sets: ['qinglu'], foot: 0.92, tall: 1.25 },
  { id: 'wx-peak-f', url: wxPeakF, kind: 'mountains', sets: ['qinglu'], foot: 0.91, tall: 1.15 },
  { id: 'wx-hills', url: wxHills, kind: 'hills', sets: ['qinglu'], foot: 0.82, tall: 0.3 },
  { id: 'wx-peak-a-h', url: wxPeakA, kind: 'hills', sets: ['qinglu'], foot: 0.82, tall: 0.62 },
  { id: 'wx-peak-b-h', url: wxPeakB, kind: 'hills', sets: ['qinglu'], foot: 0.86, tall: 0.6 },
  // the fisherman's skiff from 富春山居图
  { id: 'huang-boat', url: huangBoat, kind: 'boat', sets: BOTH, foot: 0.8, tall: 1 }
]

/** The sprites a set paints a terrain kind with. */
export function spritesFor(set: PaintSet, kind: SpriteKind): SpriteDef[] {
  return SPRITES.filter((s) => s.kind === kind && s.sets.includes(set))
}

// ── loading ──────────────────────────────────────────────────────────────────
const images = new Map<string, HTMLImageElement>()
let loadPromise: Promise<void> | null = null
let ready = false
let blot: HTMLCanvasElement | null = null

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => res(img)
    img.onerror = () => res(null)
    img.src = url
  })
}

/** Start (once) loading every sprite, the bloom mask and the calligraphy fonts. */
export function loadInkMapAssets(): Promise<void> {
  if (loadPromise) return loadPromise
  if (typeof document === 'undefined') return Promise.resolve()
  const urls = [...new Set(SPRITES.map((s) => s.url))]
  loadPromise = Promise.all([
    ...urls.map((u) =>
      loadImage(u).then((img) => {
        if (img) images.set(u, img)
      })
    ),
    loadImage(inkBlotMaskUrl(23)).then((img) => {
      if (!img) return
      // rasterise the filtered SVG once — redrawing it per frame re-runs its filters
      const c = document.createElement('canvas')
      c.width = c.height = 512
      ;(c.getContext('2d') as CanvasRenderingContext2D).drawImage(img, 0, 0, 512, 512)
      blot = c
    }),
    inkFontsReady()
  ]).then(() => {
    ready = true
  })
  return loadPromise
}

export const inkMapAssetsReady = () => ready

/** The ragged ink blot used as the style-switch reveal mask (null until loaded). */
export const bloomMask = () => blot

// ── baking ───────────────────────────────────────────────────────────────────
const baked = new Map<string, HTMLCanvasElement | null>()

/**
 * The sprite composed for a paper tone: a softened silhouette of the
 * brushwork filled with the paper (so it occludes what's behind), then the
 * painting itself on top. Null until the image has loaded.
 */
export function bakedSprite(def: SpriteDef, paper: string): HTMLCanvasElement | null {
  const key = def.url + '|' + paper + '|' + (def.passes || 1)
  const hit = baked.get(key)
  if (hit !== undefined) return hit
  const img = images.get(def.url)
  if (!img) return null
  const w = img.naturalWidth
  const h = img.naturalHeight
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d') as CanvasRenderingContext2D
  // 1. the body mask without pixel read-back (a file:// Electron page would
  //    taint the canvas): stack a blurred copy so its alpha saturates —
  //    1-(1-a)^6 lifts faint washes to "solid mountain" — then flood it with
  //    the paper tone via source-in
  g.filter = `blur(${Math.max(2, Math.round(Math.min(w, h) / 70))}px)`
  for (let i = 0; i < 6; i++) g.drawImage(img, 0, 0)
  g.filter = 'none'
  g.globalCompositeOperation = 'source-in'
  g.fillStyle = paperRgba(paper, 0.92)
  g.fillRect(0, 0, w, h)
  g.globalCompositeOperation = 'source-over'
  // 2. the painting over its own body
  for (let i = 0; i < (def.passes || 1); i++) g.drawImage(img, 0, 0)
  baked.set(key, c)
  return c
}

function paperRgba(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  const n = m ? parseInt(m[1], 16) : 0xefe7d4
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

/** The raw (unbaked) image of a sprite — for small moving things like boats. */
export function spriteImage(def: SpriteDef): HTMLImageElement | null {
  return images.get(def.url) || null
}
