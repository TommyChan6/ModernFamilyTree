// Pure look logic for the 3D style: curated palettes, archetype presets,
// seeding a look from the person's data, 2D ↔ 3D mapping (switching a look's
// style keeps its colours / hair / outfit), lock-aware randomize, and
// genetics (a child's face from its parents' 3D looks). No THREE / DOM.
//
// Tests: tests/human3dMath.test.js

import {
  DEFAULT_HUMAN3D,
  defaultModel3D,
  sanitizeModel3D,
  type Human3DState
} from '../../../../../shared/character3d'
import { ALL_SHAPE_GROUPS, FACE_GROUPS } from './catalog'

// ── Palettes ─────────────────────────────────────────────────────────────────
/** Skin tones, very fair → very deep, with warm/cool/olive undertones mixed in. */
export const SKIN_TONES = [
  '#f6dccb',
  '#f1cfb8',
  '#efc3a4',
  '#e8b593',
  '#dfa684',
  '#d9a184',
  '#c98f6c',
  '#c08562',
  '#b07650',
  '#a06a48',
  '#8f5c3d',
  '#7c4e33',
  '#6a412b',
  '#583524',
  '#46291c',
  '#3a2218'
]
export const HAIR_COLORS = [
  '#0f0c0b',
  '#231a15',
  '#3b2a1e',
  '#56392a',
  '#6f4a33',
  '#8a5a3a',
  '#a8794d',
  '#c79a5b',
  '#dcb87a',
  '#ecd5a0',
  '#a8462b',
  '#c25a2c',
  '#8e8a85',
  '#cfcac2',
  '#f2efe9'
]
export const FANTASY_HAIR = [
  '#2b3a8f',
  '#5a2b8f',
  '#c2347e',
  '#2a8f7a',
  '#e05a2b',
  '#7fd0ff',
  '#b8f06a'
]
export const EYE_COLORS = [
  '#3a2416',
  '#5b3a22',
  '#7a5230',
  '#8c6a3a',
  '#6b6a3a',
  '#5b7a3a',
  '#3f6b4a',
  '#2f6a6a',
  '#4a6f8f',
  '#5b84b0',
  '#7aa2c8',
  '#8a8f98'
]
export const FANTASY_EYES = ['#c23a3a', '#d9a02b', '#9b4ad8', '#2bd9a0', '#e8e8f0']
export const LIP_COLORS = [
  '#b0474f',
  '#c2185b',
  '#8e2430',
  '#d4776e',
  '#e09a8a',
  '#7a3048',
  '#5a2a3a',
  '#ff6f61'
]
export const SHADOW_COLORS = [
  '#7a5a8c',
  '#5a4a3a',
  '#a07850',
  '#3a4a6a',
  '#6a8a5a',
  '#c98fb0',
  '#1d1d24',
  '#b08a4a'
]
export const BLUSH_COLORS = ['#e07a7a', '#e89a8a', '#d4606a', '#f0a090', '#c0706a']
export const CLOTH_COLORS = [
  '#f2efe8',
  '#d8d0c4',
  '#9a9a9a',
  '#3d3d42',
  '#15161a',
  '#2b2f38',
  '#3d4a5c',
  '#345c8a',
  '#2e6b5a',
  '#5a6b2e',
  '#8a6b3a',
  '#8a3b2e',
  '#b03a62',
  '#6a3a8a',
  '#c9a45c',
  '#e8c35a'
]
export const METAL_COLORS = ['#c9a45c', '#d8d8dc', '#b87333', '#2b2b2e', '#e8c9b0']

export type Rng = () => number

export function seeded(seed: number): Rng {
  let s = seed >>> 0 || 0x2545f491
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

const pick = <T>(R: Rng, list: readonly T[]): T => list[Math.floor(R() * list.length) % list.length]
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const gauss = (R: Rng) => (R() + R() + R() - 1.5) / 1.5 // ≈ N(0, 0.33²) in −1..1

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = (v: number, s: number) => (v >> s) & 255
  const out = [16, 8, 0].map((s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t))
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('')
}

export function darken(hex: string, k: number) {
  return mixHex(hex, '#000000', k)
}

// ── Hair / outfit pools ──────────────────────────────────────────────────────
const FEMININE_HAIR = [
  'long',
  'long-wavy',
  'bob',
  'shoulder',
  'ponytail',
  'bun',
  'pixie',
  'curly-long',
  'braid',
  'hime',
  'low-ponytail',
  'twin-tails'
]
const MASCULINE_HAIR = [
  'side-part',
  'crew',
  'slick-back',
  'messy',
  'undercut',
  'buzz',
  'pompadour',
  'curly-short',
  'man-bun',
  'afro'
]
const TOPS_F = ['tee', 'vneck', 'longsleeve', 'sweater', 'dress', 'shirt', 'turtleneck', 'tank']
const TOPS_M = ['tee', 'longsleeve', 'shirt', 'sweater', 'vneck', 'turtleneck']
const BOTTOMS_F = ['jeans', 'trousers', 'skirt', 'midi-skirt', 'leggings', 'long-skirt']
const BOTTOMS_M = ['jeans', 'trousers', 'shorts']

// ── Presets ──────────────────────────────────────────────────────────────────
export interface Preset3D {
  id: string
  label: string
  icon: string
  apply: (m: Human3DState) => void
}

export const PRESETS_3D: Preset3D[] = [
  {
    id: 'young-woman',
    label: 'Young woman',
    icon: '👩',
    apply: (m) => {
      Object.assign(m.body, {
        gender: 0.05,
        age: 24,
        muscle: 0.45,
        weight: 0.42,
        height: 0.45,
        breastSize: 0.55
      })
      Object.assign(m.hair, { style: 'long-wavy', length: 0.55, fringe: 'curtain', curl: 0.25 })
      Object.assign(m.makeup, { lips: 0.35, mascara: 0.5, blush: 0.25 })
      m.beard.style = 'none'
      Object.assign(m.outfit, {
        top: 'vneck',
        bottom: 'jeans',
        shoes: 'sneakers',
        accessories: ['earrings']
      })
    }
  },
  {
    id: 'young-man',
    label: 'Young man',
    icon: '👨',
    apply: (m) => {
      Object.assign(m.body, { gender: 0.95, age: 27, muscle: 0.6, weight: 0.5, height: 0.6 })
      Object.assign(m.hair, { style: 'side-part', length: 0.5, fringe: 'none' })
      Object.assign(m.beard, { style: 'stubble', stubble: 0.4 })
      Object.assign(m.makeup, { lips: 0, mascara: 0, blush: 0, shadow: 0, liner: 0 })
      Object.assign(m.outfit, { top: 'tee', bottom: 'jeans', shoes: 'sneakers', accessories: [] })
    }
  },
  {
    id: 'elder',
    label: 'Grandparent',
    icon: '🧓',
    apply: (m) => {
      Object.assign(m.body, { age: 76, muscle: 0.35, weight: 0.58, height: 0.4 })
      Object.assign(m.hair, { grey: 0.9, color: '#cfcac2', volume: 0.35 })
      m.skin.wrinkles = 0.6
      m.skin.circles = 0.45
      Object.assign(m.outfit, {
        top: 'sweater',
        bottom: 'trousers',
        shoes: 'loafers',
        accessories: ['glasses']
      })
    }
  },
  {
    id: 'child',
    label: 'Child',
    icon: '🧒',
    apply: (m) => {
      Object.assign(m.body, { age: 11, muscle: 0.4, weight: 0.45, height: 0.45 })
      Object.assign(m.makeup, { lips: 0, mascara: 0, blush: 0, shadow: 0, liner: 0 })
      m.beard.style = 'none'
      m.skin.flush = 0.5
      m.skin.freckles = 0.25
      Object.assign(m.outfit, { top: 'tee', bottom: 'shorts', shoes: 'sneakers', accessories: [] })
    }
  },
  {
    id: 'athlete',
    label: 'Athlete',
    icon: '🏃',
    apply: (m) => {
      Object.assign(m.body, {
        age: 26,
        muscle: 0.95,
        weight: 0.45,
        height: 0.65,
        proportions: 0.85
      })
      Object.assign(m.outfit, {
        top: 'tank',
        bottom: 'shorts',
        shoes: 'sneakers',
        accessories: ['watch']
      })
    }
  },
  {
    id: 'scholar',
    label: 'Scholar',
    icon: '🧑‍🏫',
    apply: (m) => {
      Object.assign(m.body, { age: 45, muscle: 0.35, weight: 0.55 })
      Object.assign(m.outfit, {
        top: 'shirt',
        topPattern: 'pinstripe',
        bottom: 'trousers',
        shoes: 'loafers',
        accessories: ['glasses', 'watch']
      })
      Object.assign(m.hair, { style: m.body.gender > 0.5 ? 'slick-back' : 'bun', grey: 0.25 })
    }
  },
  {
    id: 'royal',
    label: 'Royalty',
    icon: '👑',
    apply: (m) => {
      Object.assign(m.outfit, {
        top: m.body.gender > 0.5 ? 'robe' : 'gown',
        topColor: '#6a3a8a',
        topColor2: '#c9a45c',
        topPattern: 'solid',
        shoes: 'loafers',
        accessories: ['crown', 'necklace'],
        metal: '#c9a45c'
      })
      m.light = 'golden'
    }
  },
  {
    id: 'knight',
    label: 'Knight',
    icon: '🛡',
    apply: (m) => {
      Object.assign(m.body, { muscle: 0.85 })
      Object.assign(m.outfit, {
        top: 'armor',
        topColor: '#9aa0a8',
        bottom: 'trousers',
        bottomColor: '#3a2e26',
        shoes: 'boots',
        shoesColor: '#3a2e26',
        accessories: []
      })
      m.light = 'noir'
    }
  }
]

// ── Seeding from the person ──────────────────────────────────────────────────
export interface PersonLike {
  gender?: string | null
  gender_t?: number | null
  birth?: { year: number | null } | null
  death?: { year: number | null } | null
}

/** A sensible starting look for a person (sex + age from their data). */
export function model3dForPerson(
  person: PersonLike | null,
  refYear: number,
  seed = 1
): Human3DState {
  const m = defaultModel3D()
  const R = seeded(seed)
  // The gender label wins; gender_t (0 = male colour … 1 = female colour in
  // the Style panel) is the fallback — MakeHuman's axis runs the other way.
  const label = (person?.gender || '').toLowerCase()
  let g = /^(f|woman|girl|lady|mother|wife|daughter)/.test(label)
    ? 0.05
    : /^(m|man|boy|father|husband|son)/.test(label)
      ? 0.95
      : typeof person?.gender_t === 'number'
        ? clamp(1 - person.gender_t, 0, 1)
        : 0.5
  if (!Number.isFinite(g)) g = 0.5
  m.body.gender = g
  const born = person?.birth?.year
  const died = person?.death?.year
  if (typeof born === 'number') {
    const at = typeof died === 'number' ? Math.min(died, refYear) : refYear
    m.body.age = clamp(at - born, 11, 90)
  }
  m.skin.tone = pick(R, SKIN_TONES.slice(1, 12))
  m.hair.color = pick(R, HAIR_COLORS.slice(0, 9))
  m.brows.color = darken(m.hair.color, 0.15)
  m.beard.color = m.hair.color
  m.eyes.iris = pick(R, EYE_COLORS)
  m.eyes.irisOuter = darken(m.eyes.iris, 0.45)
  m.hair.style =
    g < 0.4
      ? pick(R, FEMININE_HAIR.slice(0, 7))
      : g > 0.6
        ? pick(R, MASCULINE_HAIR.slice(0, 6))
        : 'bob'
  if (g < 0.4) {
    m.outfit.top = 'vneck'
    m.makeup.mascara = 0.3
  }
  if (m.body.age > 55) m.hair.grey = clamp((m.body.age - 50) / 35, 0, 1)
  return m
}

// ── 2D ↔ 3D ──────────────────────────────────────────────────────────────────
const HAIR_2D: Record<string, string> = {
  'hair-short': 'side-part',
  'hair-spiky': 'messy',
  'hair-bob': 'bob',
  'hair-long': 'long',
  'hair-buns': 'bun',
  'hair-ponytail': 'ponytail',
  'hair-curly': 'curly-short',
  'hair-sidepart': 'side-part',
  'hair-none': 'bald'
}
const BEARD_2D: Record<string, string> = {
  'beard-stubble': 'stubble',
  'beard-full': 'full-beard',
  'beard-goatee': 'goatee',
  mustache: 'mustache'
}
const TOP_2D: Record<string, string> = {
  'torso-tee': 'tee',
  'torso-hoodie': 'sweater',
  'torso-dress': 'dress',
  'torso-suit': 'shirt',
  'torso-sweater': 'sweater',
  'torso-robe': 'robe',
  'torso-armor': 'armor'
}
const LEGS_2D: Record<string, string> = {
  'legs-pants': 'trousers',
  'legs-shorts': 'shorts',
  'legs-skirt': 'skirt',
  'legs-longskirt': 'long-skirt'
}
const FEET_2D: Record<string, string> = {
  'feet-sneakers': 'sneakers',
  'feet-boots': 'boots',
  'feet-sandals': 'loafers'
}
const HAT_2D: Record<string, string> = {
  'hat-cap': 'cap',
  'hat-beanie': 'beanie',
  'hat-crown': 'crown',
  'hat-headband': 'headband'
}
const ACC_2D: Record<string, string> = {
  'acc-glasses': 'glasses',
  'acc-shades': 'sunglasses',
  'acc-earrings': 'earrings',
  'acc-necklace': 'necklace',
  'acc-monocle': 'glasses'
}
export const EXPR_2D_TO_3D: Record<string, string> = {
  neutral: 'neutral',
  happy: 'smile',
  laugh: 'laugh',
  surprised: 'surprised',
  angry: 'angry',
  sad: 'sad',
  smug: 'smirk',
  shy: 'smile'
}

interface Doc2D {
  parts?: Record<string, { partId: string | null } | undefined>
  palette?: Record<string, string>
  morph?: { height?: number; build?: number; headSize?: number; age?: number }
  expression?: string
}

/** Best-effort 3D look from a 2D look (on top of `base`, e.g. a person seed). */
export function model3dFrom2D(doc: Doc2D, base: Human3DState = defaultModel3D()): Human3DState {
  const m: Human3DState = JSON.parse(JSON.stringify(base))
  const pal = doc.palette || {}
  const part = (slot: string) => doc.parts?.[slot]?.partId ?? null
  if (pal.skin) m.skin.tone = pal.skin
  if (pal.hair) {
    m.hair.color = pal.hair
    m.brows.color = darken(pal.hair, 0.12)
    m.beard.color = pal.hair
  }
  if (pal.eyes) {
    m.eyes.iris = pal.eyes
    m.eyes.irisOuter = darken(pal.eyes, 0.45)
  }
  if (pal.outfitA) m.outfit.topColor = pal.outfitA
  if (pal.outfitB) m.outfit.bottomColor = pal.outfitB
  if (pal.accent) {
    m.outfit.shoesColor = pal.accent
    m.outfit.topColor2 = pal.accent
  }
  const age = doc.morph?.age
  if (typeof age === 'number') m.body.age = age < 0 ? 28 + age * 16 : 28 + age * 52
  if (typeof doc.morph?.height === 'number')
    m.body.height = clamp(0.5 + doc.morph.height * 0.35, 0, 1)
  if (typeof doc.morph?.build === 'number')
    m.body.weight = clamp(0.5 + doc.morph.build * 0.35, 0, 1)
  const hair = part('hair')
  if (hair && HAIR_2D[hair]) m.hair.style = HAIR_2D[hair]
  const fh = part('facialHair')
  m.beard.style = (fh && BEARD_2D[fh]) || 'none'
  const top = part('torso')
  if (top && TOP_2D[top]) m.outfit.top = TOP_2D[top]
  const legs = part('legs')
  if (legs && LEGS_2D[legs]) m.outfit.bottom = LEGS_2D[legs]
  const feet = part('feet')
  if (feet && FEET_2D[feet]) m.outfit.shoes = FEET_2D[feet]
  const acc: string[] = []
  const hat = part('headwear')
  if (hat && HAT_2D[hat]) acc.push(HAT_2D[hat])
  const a = part('accessory')
  if (a && ACC_2D[a]) acc.push(ACC_2D[a])
  m.outfit.accessories = acc
  if (doc.expression) m.expression = EXPR_2D_TO_3D[doc.expression] || 'neutral'
  return sanitizeModel3D(m)
}

/** The 2D palette channels a 3D look implies (so switching back looks alike). */
export function paletteFrom3D(m: Human3DState): Record<string, string> {
  return {
    skin: m.skin.tone,
    hair: m.hair.color,
    eyes: m.eyes.iris,
    outfitA: m.outfit.topColor,
    outfitB: m.outfit.bottomColor,
    accent: m.outfit.shoesColor
  }
}

// ── Randomize ────────────────────────────────────────────────────────────────
export type Lock3D = 'body' | 'face' | 'skin' | 'hair' | 'eyes' | 'makeup' | 'outfit'

/** A fresh random look, keeping locked sections from `base`. */
export function randomizeModel3D(
  base: Human3DState,
  R: Rng = Math.random,
  locks: Lock3D[] = []
): Human3DState {
  const m: Human3DState = JSON.parse(JSON.stringify(base))
  const has = (k: Lock3D) => locks.includes(k)
  if (!has('body')) {
    const g = R() < 0.5 ? 0.02 + R() * 0.12 : 0.86 + R() * 0.12
    Object.assign(m.body, {
      gender: g,
      age: Math.round(16 + Math.pow(R(), 1.6) * 62),
      muscle: clamp(0.5 + gauss(R) * 0.6, 0.1, 0.95),
      weight: clamp(0.5 + gauss(R) * 0.55, 0.15, 0.9),
      height: clamp(0.5 + gauss(R) * 0.6, 0.1, 0.9),
      proportions: clamp(0.55 + gauss(R) * 0.4, 0.2, 1),
      breastSize: clamp(0.5 + gauss(R) * 0.6, 0.1, 0.95),
      breastFirmness: clamp(0.5 + gauss(R) * 0.5, 0.2, 0.9)
    })
    const w = [R(), R(), R()]
    const sum = w[0] + w[1] + w[2]
    m.body.african = w[0] / sum
    m.body.asian = w[1] / sum
    m.body.caucasian = w[2] / sum
  }
  if (!has('face')) {
    const shape: Record<string, number> = {}
    for (const g of FACE_GROUPS) {
      for (const s of g.sliders) {
        if (R() > 0.45) continue
        const v = s.unipolar ? R() * 0.6 : gauss(R) * 0.7
        if (Math.abs(v) > 0.04) shape[s.id] = Math.round(v * 100) / 100
      }
    }
    // keep body sliders from the base
    for (const [k, v] of Object.entries(m.shape)) {
      const id = k.split('@')[0]
      if (!FACE_GROUPS.some((g) => g.sliders.some((s) => s.id === id))) shape[k] = v
    }
    m.shape = shape
  }
  const female = m.body.gender < 0.5
  if (!has('skin')) {
    Object.assign(m.skin, {
      tone: pick(R, SKIN_TONES),
      flush: clamp(0.3 + gauss(R) * 0.5, 0, 1),
      freckles: R() < 0.25 ? R() * 0.8 : 0,
      moles: R() * 0.4,
      circles: R() * 0.5
    })
  }
  if (!has('hair')) {
    const style = female
      ? pick(R, FEMININE_HAIR)
      : R() < 0.12
        ? pick(R, ['bald', 'long', 'shoulder'])
        : pick(R, MASCULINE_HAIR)
    const natural = R() < 0.9
    const color = natural ? pick(R, HAIR_COLORS.slice(0, 12)) : pick(R, FANTASY_HAIR)
    Object.assign(m.hair, {
      style,
      color,
      tip: R() < 0.15 ? pick(R, HAIR_COLORS.slice(6, 10)) : '',
      highlight: R() < 0.15 ? pick(R, HAIR_COLORS.slice(6, 10)) : '',
      length: clamp(0.5 + gauss(R) * 0.6, 0.1, 1),
      volume: clamp(0.45 + gauss(R) * 0.5, 0.1, 1),
      curl: R() < 0.3 ? R() * 0.8 : R() * 0.2,
      part: Math.round(gauss(R) * 100) / 100,
      fringe: female && R() < 0.4 ? pick(R, ['blunt', 'side', 'curtain', 'wispy']) : 'none',
      grey: m.body.age > 50 ? clamp((m.body.age - 45) / 40 + gauss(R) * 0.2, 0, 1) : 0
    })
    m.brows = {
      style: pick(R, ['natural', 'natural', 'straight', 'arched', 'thick', 'thin']),
      color: darken(color, 0.15),
      thickness: clamp(0.5 + gauss(R) * 0.5, 0.1, 1),
      density: clamp(0.65 + gauss(R) * 0.4, 0.2, 1),
      arch: Math.round(gauss(R) * 80) / 100
    }
    m.beard = {
      ...m.beard,
      style: female
        ? 'none'
        : pick(R, [
            'none',
            'none',
            'stubble',
            'short-beard',
            'full-beard',
            'goatee',
            'mustache',
            'van-dyke'
          ]),
      color,
      length: R(),
      density: clamp(0.6 + gauss(R) * 0.4, 0.2, 1)
    }
  }
  if (!has('eyes')) {
    const iris = R() < 0.95 ? pick(R, EYE_COLORS) : pick(R, FANTASY_EYES)
    Object.assign(m.eyes, {
      iris,
      irisOuter: darken(iris, 0.4 + R() * 0.2),
      irisRight: R() < 0.03 ? pick(R, EYE_COLORS) : '',
      pupil: 0.3 + R() * 0.3,
      pattern: 0.4 + R() * 0.6,
      lashLength: clamp(0.5 + gauss(R) * 0.4, 0.1, 1)
    })
  }
  if (!has('makeup')) {
    const on = female && R() < 0.6
    Object.assign(m.makeup, {
      lipColor: pick(R, LIP_COLORS),
      lips: on ? R() * 0.7 : 0,
      gloss: R() * 0.6,
      shadowColor: pick(R, SHADOW_COLORS),
      shadow: on && R() < 0.5 ? R() * 0.6 : 0,
      liner: on && R() < 0.4 ? R() * 0.7 : 0,
      blushColor: pick(R, BLUSH_COLORS),
      blush: on ? R() * 0.4 : 0,
      mascara: on ? R() * 0.8 : 0
    })
  }
  if (!has('outfit')) {
    const top = female ? pick(R, TOPS_F) : pick(R, TOPS_M)
    m.outfit = {
      top,
      topColor: pick(R, CLOTH_COLORS),
      topColor2: pick(R, CLOTH_COLORS),
      topPattern: R() < 0.7 ? 'solid' : pick(R, ['stripes', 'plaid', 'dots', 'pinstripe']),
      bottom: female ? pick(R, BOTTOMS_F) : pick(R, BOTTOMS_M),
      bottomColor: pick(R, CLOTH_COLORS.slice(2, 12)),
      shoes: pick(R, ['sneakers', 'sneakers', 'boots', 'loafers']),
      shoesColor: pick(R, CLOTH_COLORS),
      accessories: [
        ...(R() < 0.2 ? ['glasses'] : []),
        ...(female && R() < 0.4 ? ['earrings'] : []),
        ...(R() < 0.15 ? ['necklace'] : []),
        ...(R() < 0.15 ? ['watch'] : [])
      ],
      metal: pick(R, ['#c9a45c', '#d8d8dc'])
    }
  }
  return sanitizeModel3D(m)
}

// ── Genetics ─────────────────────────────────────────────────────────────────
/**
 * A child's look from its parents' 3D looks: body/face sliders are a
 * weighted blend + mutation, colours inherit with a dominance bias toward the
 * darker parent, hair texture from either side. `resemblance` 1 = close to
 * the parents, 0 = wild card.
 */
export function inheritModel3D(
  parents: Human3DState[],
  base: Human3DState,
  opts: { resemblance?: number } = {},
  R: Rng = Math.random
): Human3DState {
  const ps = parents.filter(Boolean)
  if (!ps.length) return sanitizeModel3D(base)
  const res = clamp(opts.resemblance ?? 0.8, 0, 1)
  const m: Human3DState = JSON.parse(JSON.stringify(base))
  const w = ps.map(() => 0.3 + R())
  const sw = w.reduce((a, b) => a + b, 0)
  const blend = (get: (p: Human3DState) => number) =>
    ps.reduce((acc, p, i) => acc + get(p) * (w[i] / sw), 0)
  const mutate = (v: number, span: number) => v + gauss(R) * span * (1 - res + 0.15)
  // ancestry + shape blend; the child's own sex/age stay
  for (const k of [
    'african',
    'asian',
    'caucasian',
    'muscle',
    'weight',
    'height',
    'proportions'
  ] as const) {
    m.body[k] = clamp(
      mutate(
        blend((p) => p.body[k]),
        0.25
      ),
      0,
      1
    )
  }
  const keys = new Set(ps.flatMap((p) => Object.keys(p.shape)))
  const shape: Record<string, number> = {}
  for (const k of keys) {
    const v = clamp(
      mutate(
        blend((p) => p.shape[k] || 0),
        0.35
      ),
      -1,
      1
    )
    if (Math.abs(v) > 0.03) shape[k] = Math.round(v * 100) / 100
  }
  m.shape = shape
  const dominant = ps.slice().sort((a, b) => lum(a.skin.tone) - lum(b.skin.tone))
  const pa = dominant[0]
  const pb = dominant[dominant.length - 1]
  m.skin.tone = mixHex(pa.skin.tone, pb.skin.tone, 0.35 + R() * 0.3)
  m.skin.freckles = clamp(blend((p) => p.skin.freckles) + (R() - 0.5) * 0.2, 0, 1)
  const hairParent = pick(R, ps)
  const darkHair = ps.slice().sort((a, b) => lum(a.hair.color) - lum(b.hair.color))[0]
  m.hair.color = R() < 0.65 ? darkHair.hair.color : hairParent.hair.color
  m.hair.curl = clamp(
    blend((p) => p.hair.curl),
    0,
    1
  )
  m.brows.color = darken(m.hair.color, 0.15)
  m.beard.color = m.hair.color
  const eyeParent = ps.slice().sort((a, b) => lum(a.eyes.iris) - lum(b.eyes.iris))[
    R() < 0.7 ? 0 : ps.length - 1
  ]
  m.eyes.iris = eyeParent.eyes.iris
  m.eyes.irisOuter = eyeParent.eyes.irisOuter
  return sanitizeModel3D(m)
}

function lum(hex: string) {
  const v = parseInt(hex.slice(1), 16)
  return 0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)
}

/** Reset every slider in a shape group (or all) to neutral. */
export function resetShape(m: Human3DState, groupId?: string) {
  if (!groupId) {
    m.shape = {}
    return
  }
  const g = ALL_SHAPE_GROUPS.find((x) => x.id === groupId)
  if (!g) return
  const ids = new Set(g.sliders.map((s) => s.id))
  for (const k of Object.keys(m.shape)) if (ids.has(k.split('@')[0])) delete m.shape[k]
}

export { DEFAULT_HUMAN3D }
