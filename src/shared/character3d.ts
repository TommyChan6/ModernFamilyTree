// The 3D character state (Character view → 🧊 3D style): what a CharacterDoc
// stores in `model3d` when its style is HUMAN3D_STYLE. Pure data — sliders,
// colours and catalogue ids, never geometry — so the renderer can evolve
// (new targets, new hair generators) without migrating stored looks.
//
// `sanitizeModel3D` is the single gate: dbCore runs it on every
// characters:save, the renderer runs it on load/paste. Unknown keys are
// dropped, numbers clamped, colours validated, ids bounded — an old, foreign
// or hostile payload always comes out as a valid state.
//
// Tests: tests/character3d.test.js

export const HUMAN3D_STYLE = 'human3d'

/** Body macros (MakeHuman semantics). All 0..1 except `age` in years. */
export interface Human3DBody {
  /** 0 = female … 1 = male. */
  gender: number
  age: number
  muscle: number
  weight: number
  height: number
  proportions: number
  african: number
  asian: number
  caucasian: number
  breastSize: number
  breastFirmness: number
  /** 0 = as sculpted … 1 = idealized (the game-creator beauty pass). */
  ideal: number
}

export interface Human3DSkin {
  tone: string
  /** Natural redness in cheeks / nose / ears. */
  flush: number
  freckles: number
  moles: number
  /** Under-eye shadows. */
  circles: number
  /** 0 matte … 1 dewy/oily. */
  sheen: number
  /** Pore / micro-detail strength. */
  detail: number
  /** Subsurface softness (how much light bleeds through). */
  sss: number
  /** Age lines (forehead, crow's feet, nasolabial), on top of the age macro. */
  wrinkles: number
  /** Scar / face-paint decal ids are future work — kept as a slot. */
  tattoo: string
  tattooColor: string
}

export interface Human3DMakeup {
  lipColor: string
  lips: number
  gloss: number
  shadowColor: string
  shadow: number
  liner: number
  blushColor: string
  blush: number
  /** Mascara darkens + thickens lashes. */
  mascara: number
}

export interface Human3DEyes {
  iris: string
  /** Outer ring / limbal colour. */
  irisOuter: string
  /** Optional second eye colour (heterochromia); '' = same. */
  irisRight: string
  pupil: number
  /** Iris pattern detail 0..1. */
  pattern: number
  scleraRed: number
  /** Eyelash length / density. */
  lashLength: number
  lashDensity: number
}

export interface Human3DHair {
  style: string
  color: string
  /** Tip colour for ombré / sun-bleach; '' = same as `color`. */
  tip: string
  /** Strand-highlight streak colour; '' = none. */
  highlight: string
  length: number
  volume: number
  curl: number
  frizz: number
  /** −1 left part … +1 right part (0 = centre). */
  part: number
  fringe: string
  gloss: number
  /** Salt & pepper greying 0..1. */
  grey: number
  density: number
}

export interface Human3DBrows {
  style: string
  color: string
  thickness: number
  density: number
  arch: number
}

export interface Human3DBeard {
  style: string
  color: string
  length: number
  density: number
  /** Painted stubble shadow under/around the beard. */
  stubble: number
}

export interface Human3DOutfit {
  top: string
  topColor: string
  topColor2: string
  topPattern: string
  bottom: string
  bottomColor: string
  shoes: string
  shoesColor: string
  /** Accessory ids (glasses, earrings, necklace, hat…). */
  accessories: string[]
  /** Metal / accent colour for buttons, jewellery, frames. */
  metal: string
}

export interface Human3DState {
  v: 1
  body: Human3DBody
  /** Modifier id → −1..1 (only non-zero kept). `id@l` / `id@r` are per-side offsets. */
  shape: Record<string, number>
  skin: Human3DSkin
  makeup: Human3DMakeup
  eyes: Human3DEyes
  hair: Human3DHair
  brows: Human3DBrows
  beard: Human3DBeard
  outfit: Human3DOutfit
  pose: string
  expression: string
  /** Studio lighting preset id. */
  light: string
}

export const DEFAULT_HUMAN3D: Human3DState = {
  v: 1,
  body: {
    gender: 0.5,
    age: 25,
    muscle: 0.5,
    weight: 0.5,
    height: 0.5,
    proportions: 0.5,
    african: 0.333,
    asian: 0.333,
    caucasian: 0.334,
    breastSize: 0.5,
    breastFirmness: 0.5,
    ideal: 0.6
  },
  shape: {},
  skin: {
    tone: '#d9a184',
    flush: 0.35,
    freckles: 0,
    moles: 0.15,
    circles: 0.2,
    sheen: 0.35,
    detail: 0.6,
    sss: 0.6,
    wrinkles: 0,
    tattoo: '',
    tattooColor: '#1d2733'
  },
  makeup: {
    lipColor: '#b0474f',
    lips: 0,
    gloss: 0.2,
    shadowColor: '#7a5a8c',
    shadow: 0,
    liner: 0,
    blushColor: '#e07a7a',
    blush: 0,
    mascara: 0
  },
  eyes: {
    iris: '#5b7a3a',
    irisOuter: '#2e3b22',
    irisRight: '',
    pupil: 0.4,
    pattern: 0.7,
    scleraRed: 0.1,
    lashLength: 0.5,
    lashDensity: 0.6
  },
  hair: {
    style: 'side-part',
    color: '#3b2a1e',
    tip: '',
    highlight: '',
    length: 0.5,
    volume: 0.5,
    curl: 0.1,
    frizz: 0.15,
    part: 0.4,
    fringe: 'none',
    gloss: 0.5,
    grey: 0,
    density: 0.7
  },
  brows: { style: 'natural', color: '#2f2219', thickness: 0.5, density: 0.7, arch: 0.4 },
  beard: { style: 'none', color: '#3b2a1e', length: 0.4, density: 0.7, stubble: 0 },
  outfit: {
    top: 'tee',
    topColor: '#3d4a5c',
    topColor2: '#e8e2d6',
    topPattern: 'solid',
    bottom: 'trousers',
    bottomColor: '#2b2f38',
    shoes: 'sneakers',
    shoesColor: '#e9e6df',
    accessories: [],
    metal: '#c9a45c'
  },
  pose: 'relaxed',
  expression: 'neutral',
  light: 'studio'
}

/** Numeric ranges that aren't the default 0..1. */
const RANGES: Record<string, [number, number]> = {
  'body.age': [11, 90],
  'hair.part': [-1, 1],
  'brows.arch': [-1, 1]
}

const HEX = /^#[0-9a-f]{6}$/i
const ID = /^[a-z0-9][a-z0-9_-]{0,39}$/i
const SHAPE_KEY = /^[a-z0-9][a-z0-9_.-]{0,59}(@[lr])?$/i
const MAX_SHAPE_KEYS = 400
const MAX_ACCESSORIES = 12

function clampNum(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  if (!Number.isFinite(n)) return fallback
  return Math.min(hi, Math.max(lo, Math.round(n * 10000) / 10000))
}

function cleanString(key: string, v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback
  const s = v.trim()
  // Colour-ish keys: hex only ('' allowed where the default is '')
  if (HEX.test(fallback) || /color|colour|tone|tip|highlight|iris|metal/i.test(key)) {
    if (s === '' && fallback === '') return ''
    return HEX.test(s) ? s.toLowerCase() : fallback
  }
  if (s === '') return fallback === '' ? '' : fallback
  return ID.test(s) ? s : fallback
}

function cleanSection<T extends object>(section: string, raw: unknown, defaults: T): T {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out: Record<string, unknown> = {}
  for (const [k, def] of Object.entries(defaults)) {
    const v = src[k]
    if (typeof def === 'number') {
      const [lo, hi] = RANGES[`${section}.${k}`] || [0, 1]
      out[k] = clampNum(v, lo, hi, def)
    } else if (typeof def === 'string') {
      out[k] = cleanString(k, v, def)
    } else if (Array.isArray(def)) {
      out[k] = Array.isArray(v)
        ? [...new Set(v.filter((x) => typeof x === 'string' && ID.test(x)))].slice(
            0,
            MAX_ACCESSORIES
          )
        : [...def]
    }
  }
  return out as T
}

/** Coerce anything into a valid Human3DState (defaults fill the gaps). */
export function sanitizeModel3D(raw: unknown): Human3DState {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const d = DEFAULT_HUMAN3D
  const shape: Record<string, number> = {}
  if (src.shape && typeof src.shape === 'object') {
    let n = 0
    for (const [k, v] of Object.entries(src.shape as Record<string, unknown>)) {
      if (n >= MAX_SHAPE_KEYS) break
      if (!SHAPE_KEY.test(k)) continue
      const x = clampNum(v, -1, 1, 0)
      if (x !== 0) {
        shape[k] = x
        n++
      }
    }
  }
  return {
    v: 1,
    body: cleanSection('body', src.body, d.body),
    shape,
    skin: cleanSection('skin', src.skin, d.skin),
    makeup: cleanSection('makeup', src.makeup, d.makeup),
    eyes: cleanSection('eyes', src.eyes, d.eyes),
    hair: cleanSection('hair', src.hair, d.hair),
    brows: cleanSection('brows', src.brows, d.brows),
    beard: cleanSection('beard', src.beard, d.beard),
    outfit: cleanSection('outfit', src.outfit, d.outfit),
    pose: cleanString('pose', src.pose, d.pose),
    expression: cleanString('expression', src.expression, d.expression),
    light: cleanString('light', src.light, d.light)
  }
}

/** A deep, plain copy of the defaults (safe to mutate). */
export function defaultModel3D(): Human3DState {
  return sanitizeModel3D(JSON.parse(JSON.stringify(DEFAULT_HUMAN3D)))
}
