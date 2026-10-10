// The 3D editor's slider catalogue: every MakeHuman modelling target the
// asset ships, grouped the way game character creators group them (Head,
// Eyes, Nose, Mouth, Jaw…, then Torso, Arms, Legs). Left/right pairs are
// ONE symmetric slider (`sides` keeps the per-side targets for asymmetry
// mode, stored as `id@l` / `id@r` offsets). Pure data + the pure
// state → target-weights function; no THREE.

import type { Human3DState } from '../../../../../shared/character3d'
import { addModifier, macroTargetWeights, type ModifierDef } from './humanMorph'

export interface ShapeSlider {
  id: string
  label: string
  /** Target names for the negative / positive end (both sides when paired). */
  min: string[]
  max: string[]
  /** Unipolar (0..1) blend shapes like "Oval". */
  unipolar?: boolean
  /** Per-side targets for asymmetry offsets. */
  sides?: { l: ModifierDef; r: ModifierDef }
  /** End labels shown under the slider (e.g. "Narrow" / "Wide"). */
  ends?: [string, string]
}

export interface ShapeGroup {
  id: string
  label: string
  /** Camera focus region for this group (see HumanStage.focusRegion). */
  focus: string
  /** Region on the face/body the stage highlights + sculpts by drag. */
  sliders: ShapeSlider[]
}

function single(
  id: string,
  label: string,
  min: string | null,
  max: string,
  ends?: [string, string]
): ShapeSlider {
  return { id, label, min: min ? [min] : [], max: [max], ends }
}

/** `base` like "nose-trans" with ends "down"/"up" → nose-trans-down / -up. */
function bi(
  base: string,
  lo: string,
  hi: string,
  label: string,
  ends?: [string, string]
): ShapeSlider {
  return single(`${base}-${lo}-${hi}`, label, `${base}-${lo}`, `${base}-${hi}`, ends)
}

/** A left/right pair: "{l,r}-{base}-{lo|hi}". */
function lr(
  base: string,
  lo: string,
  hi: string,
  label: string,
  ends?: [string, string]
): ShapeSlider {
  const side = (s: 'l' | 'r'): ModifierDef => ({
    id: `${s}-${base}`,
    min: `${s}-${base}-${lo}`,
    max: `${s}-${base}-${hi}`
  })
  return {
    id: `${base}-${lo}-${hi}`,
    label,
    min: [`l-${base}-${lo}`, `r-${base}-${lo}`],
    max: [`l-${base}-${hi}`, `r-${base}-${hi}`],
    sides: { l: side('l'), r: side('r') },
    ends
  }
}

function uni(target: string, label: string): ShapeSlider {
  return { id: target, label, min: [], max: [target], unipolar: true }
}

const SMALL_BIG: [string, string] = ['Smaller', 'Bigger']
const DOWN_UP: [string, string] = ['Down', 'Up']
const IN_OUT: [string, string] = ['In', 'Out']
const BACK_FWD: [string, string] = ['Back', 'Forward']
const NARROW_WIDE: [string, string] = ['Narrow', 'Wide']
const LESS_MORE: [string, string] = ['Less', 'More']

export const FACE_GROUPS: ShapeGroup[] = [
  {
    id: 'head',
    label: 'Head shape',
    focus: 'head',
    sliders: [
      uni('head-oval', 'Oval'),
      uni('head-round', 'Round'),
      uni('head-rectangular', 'Rectangular'),
      uni('head-square', 'Square'),
      uni('head-triangular', 'Triangular'),
      uni('head-invertedtriangular', 'Inverted triangle'),
      uni('head-diamond', 'Diamond'),
      bi('head-scale-horiz', 'decr', 'incr', 'Width', NARROW_WIDE),
      bi('head-scale-vert', 'decr', 'incr', 'Height', SMALL_BIG),
      bi('head-scale-depth', 'decr', 'incr', 'Depth', SMALL_BIG),
      bi('head-back-scale-depth', 'decr', 'incr', 'Back of head', SMALL_BIG),
      bi('head-fat', 'decr', 'incr', 'Fullness', LESS_MORE),
      bi('head-age', 'decr', 'incr', 'Face age', ['Younger', 'Older']),
      bi('head-angle', 'in', 'out', 'Tilt', IN_OUT),
      bi('head-trans', 'down', 'up', 'Head height', DOWN_UP),
      bi('head-trans', 'backward', 'forward', 'Head forward', BACK_FWD),
      bi('head-trans', 'in', 'out', 'Head sideways', IN_OUT)
    ]
  },
  {
    id: 'forehead',
    label: 'Forehead',
    focus: 'forehead',
    sliders: [
      bi('forehead-scale-vert', 'decr', 'incr', 'Height', ['Low', 'High']),
      bi('forehead-trans', 'backward', 'forward', 'Slope', BACK_FWD),
      bi('forehead-nubian', 'decr', 'incr', 'Brow bulge', LESS_MORE),
      bi('forehead-temple', 'decr', 'incr', 'Temples', ['Hollow', 'Full']),
      bi('eyebrows-trans', 'down', 'up', 'Brow height', DOWN_UP),
      bi('eyebrows-trans', 'backward', 'forward', 'Brow ridge', BACK_FWD),
      bi('eyebrows-angle', 'down', 'up', 'Brow angle', DOWN_UP)
    ]
  },
  {
    id: 'eyes',
    label: 'Eyes',
    focus: 'eyes',
    sliders: [
      lr('eye-scale', 'decr', 'incr', 'Size', SMALL_BIG),
      lr('eye-trans', 'in', 'out', 'Spacing', ['Close', 'Apart']),
      lr('eye-trans', 'down', 'up', 'Height', DOWN_UP),
      lr('eye-height1', 'decr', 'incr', 'Inner opening', ['Narrow', 'Open']),
      lr('eye-height2', 'decr', 'incr', 'Middle opening', ['Narrow', 'Open']),
      lr('eye-height3', 'decr', 'incr', 'Outer opening', ['Narrow', 'Open']),
      lr('eye-corner1', 'down', 'up', 'Inner corner', DOWN_UP),
      lr('eye-corner2', 'down', 'up', 'Outer corner (tilt)', DOWN_UP),
      lr('eye-push1', 'in', 'out', 'Inner depth', IN_OUT),
      lr('eye-push2', 'in', 'out', 'Outer depth', IN_OUT),
      lr('eye-epicanthus', 'in', 'out', 'Epicanthic fold', LESS_MORE),
      lr('eye-eyefold', 'down', 'up', 'Lid fold', DOWN_UP),
      lr('eye-eyefold', 'concave', 'convex', 'Lid fullness', ['Hollow', 'Full']),
      lr('eye-eyefold-angle', 'down', 'up', 'Lid angle', DOWN_UP),
      lr('eye-bag', 'decr', 'incr', 'Under-eye bags', LESS_MORE),
      lr('eye-bag-height', 'decr', 'incr', 'Bag height', DOWN_UP),
      lr('eye-bag', 'in', 'out', 'Bag depth', IN_OUT)
    ]
  },
  {
    id: 'nose',
    label: 'Nose',
    focus: 'nose',
    sliders: [
      bi('nose-scale-vert', 'decr', 'incr', 'Length', ['Short', 'Long']),
      bi('nose-scale-horiz', 'decr', 'incr', 'Width', NARROW_WIDE),
      bi('nose-scale-depth', 'decr', 'incr', 'Projection', ['Flat', 'Prominent']),
      bi('nose-trans', 'down', 'up', 'Height', DOWN_UP),
      bi('nose-trans', 'backward', 'forward', 'Depth', BACK_FWD),
      bi('nose-trans', 'in', 'out', 'Sideways', IN_OUT),
      bi('nose-width1', 'decr', 'incr', 'Bridge width', NARROW_WIDE),
      bi('nose-width2', 'decr', 'incr', 'Middle width', NARROW_WIDE),
      bi('nose-width3', 'decr', 'incr', 'Base width', NARROW_WIDE),
      bi('nose-hump', 'decr', 'incr', 'Bridge hump', LESS_MORE),
      bi('nose-curve', 'concave', 'convex', 'Profile curve', ['Concave', 'Convex']),
      bi('nose-greek', 'decr', 'incr', 'Greek line', LESS_MORE),
      bi('nose-point-width', 'decr', 'incr', 'Tip width', NARROW_WIDE),
      bi('nose-point', 'down', 'up', 'Tip angle', DOWN_UP),
      bi('nose-volume', 'decr', 'incr', 'Volume', LESS_MORE),
      bi('nose-nostrils-width', 'decr', 'incr', 'Nostril width', NARROW_WIDE),
      bi('nose-nostrils-angle', 'down', 'up', 'Nostril angle', DOWN_UP),
      bi('nose-flaring', 'decr', 'incr', 'Nostril flare', LESS_MORE),
      bi('nose-base', 'down', 'up', 'Base', DOWN_UP),
      bi('nose-septumangle', 'decr', 'incr', 'Septum angle', LESS_MORE),
      bi('nose-compression', 'compress', 'uncompress', 'Compression', ['Pinched', 'Relaxed'])
    ]
  },
  {
    id: 'mouth',
    label: 'Mouth & lips',
    focus: 'mouth',
    sliders: [
      bi('mouth-scale-horiz', 'decr', 'incr', 'Width', NARROW_WIDE),
      bi('mouth-scale-vert', 'decr', 'incr', 'Height', SMALL_BIG),
      bi('mouth-scale-depth', 'decr', 'incr', 'Depth', SMALL_BIG),
      bi('mouth-trans', 'down', 'up', 'Position', DOWN_UP),
      bi('mouth-trans', 'backward', 'forward', 'Protrusion', BACK_FWD),
      bi('mouth-trans', 'in', 'out', 'Sideways', IN_OUT),
      bi('mouth-upperlip-volume', 'decr', 'incr', 'Upper lip fullness', ['Thin', 'Full']),
      bi('mouth-lowerlip-volume', 'decr', 'incr', 'Lower lip fullness', ['Thin', 'Full']),
      bi('mouth-upperlip-height', 'decr', 'incr', 'Upper lip height', SMALL_BIG),
      bi('mouth-lowerlip-height', 'decr', 'incr', 'Lower lip height', SMALL_BIG),
      bi('mouth-upperlip-width', 'decr', 'incr', 'Upper lip width', NARROW_WIDE),
      bi('mouth-lowerlip-width', 'decr', 'incr', 'Lower lip width', NARROW_WIDE),
      bi('mouth-upperlip-middle', 'down', 'up', 'Upper lip centre', DOWN_UP),
      bi('mouth-lowerlip-middle', 'down', 'up', 'Lower lip centre', DOWN_UP),
      bi('mouth-upperlip-ext', 'down', 'up', 'Upper lip ends', DOWN_UP),
      bi('mouth-lowerlip-ext', 'down', 'up', 'Lower lip ends', DOWN_UP),
      bi('mouth-cupidsbow', 'decr', 'incr', "Cupid's bow", LESS_MORE),
      bi('mouth-cupidsbow-width', 'decr', 'incr', "Cupid's bow width", NARROW_WIDE),
      bi('mouth-angles', 'down', 'up', 'Corners', DOWN_UP),
      bi('mouth-philtrum-volume', 'decr', 'incr', 'Philtrum', LESS_MORE),
      bi('mouth-dimples', 'in', 'out', 'Dimples', IN_OUT),
      bi('mouth-laugh-lines', 'in', 'out', 'Laugh lines', IN_OUT)
    ]
  },
  {
    id: 'cheeks',
    label: 'Cheeks',
    focus: 'cheeks',
    sliders: [
      lr('cheek-bones', 'decr', 'incr', 'Cheekbones', ['Soft', 'High']),
      lr('cheek-volume', 'decr', 'incr', 'Fullness', ['Hollow', 'Full']),
      lr('cheek-inner', 'decr', 'incr', 'Inner cheek', LESS_MORE),
      lr('cheek-trans', 'down', 'up', 'Height', DOWN_UP)
    ]
  },
  {
    id: 'jaw',
    label: 'Jaw & chin',
    focus: 'jaw',
    sliders: [
      bi('chin-width', 'decr', 'incr', 'Chin width', NARROW_WIDE),
      bi('chin-height', 'decr', 'incr', 'Chin height', SMALL_BIG),
      bi('chin-prominent', 'decr', 'incr', 'Chin projection', ['Receding', 'Strong']),
      bi('chin-cleft', 'decr', 'incr', 'Cleft', LESS_MORE),
      bi('chin-jaw-drop', 'decr', 'incr', 'Jaw depth', LESS_MORE),
      bi('chin-bones', 'decr', 'incr', 'Jaw width', NARROW_WIDE),
      bi('chin-prognathism', 'decr', 'incr', 'Underbite', LESS_MORE)
    ]
  },
  {
    id: 'ears',
    label: 'Ears',
    focus: 'ears',
    sliders: [
      lr('ear-scale', 'decr', 'incr', 'Size', SMALL_BIG),
      lr('ear-scale-vert', 'decr', 'incr', 'Height', SMALL_BIG),
      lr('ear-scale-depth', 'decr', 'incr', 'Depth', SMALL_BIG),
      lr('ear-trans', 'down', 'up', 'Position', DOWN_UP),
      lr('ear-trans', 'backward', 'forward', 'Forward', BACK_FWD),
      lr('ear-rot', 'backward', 'forward', 'Rotation', BACK_FWD),
      lr('ear-lobe', 'decr', 'incr', 'Lobe', SMALL_BIG),
      lr('ear-shape', 'pointed', 'triangle', 'Pointed ↔ triangle', ['Pointed', 'Triangle']),
      lr('ear-shape', 'square', 'round', 'Square ↔ round', ['Square', 'Round']),
      lr('ear-wing', 'decr', 'incr', 'Stick-out', LESS_MORE),
      lr('ear-flap', 'decr', 'incr', 'Flap', LESS_MORE)
    ]
  },
  {
    id: 'neck',
    label: 'Neck',
    focus: 'neck',
    sliders: [
      bi('neck-scale-horiz', 'decr', 'incr', 'Width', NARROW_WIDE),
      bi('neck-scale-depth', 'decr', 'incr', 'Depth', SMALL_BIG),
      bi('neck-scale-vert', 'decr', 'incr', 'Length', ['Short', 'Long']),
      bi('neck-double', 'decr', 'incr', 'Double chin', LESS_MORE),
      bi('neck-back-scale-depth', 'decr', 'incr', 'Nape', SMALL_BIG),
      bi('neck-trans', 'backward', 'forward', 'Forward', BACK_FWD),
      bi('neck-trans', 'down', 'up', 'Height', DOWN_UP),
      bi('measure-neck-circ', 'decr', 'incr', 'Thickness', ['Thin', 'Thick'])
    ]
  }
]

export const BODY_GROUPS: ShapeGroup[] = [
  {
    id: 'torso',
    label: 'Torso',
    focus: 'torso',
    sliders: [
      bi('measure-shoulder-dist', 'decr', 'incr', 'Shoulder width', NARROW_WIDE),
      bi('torso-vshape', 'decr', 'incr', 'V-shape', LESS_MORE),
      bi('torso-scale-horiz', 'decr', 'incr', 'Torso width', NARROW_WIDE),
      bi('torso-scale-depth', 'decr', 'incr', 'Torso depth', SMALL_BIG),
      bi('torso-scale-vert', 'decr', 'incr', 'Torso length', ['Short', 'Long']),
      bi('measure-napetowaist-dist', 'decr', 'incr', 'Back length', ['Short', 'Long']),
      bi('torso-muscle-pectoral', 'decr', 'incr', 'Pectorals', LESS_MORE),
      bi('torso-muscle-dorsi', 'decr', 'incr', 'Lats', LESS_MORE),
      bi('measure-bust-circ', 'decr', 'incr', 'Chest', SMALL_BIG),
      bi('measure-underbust-circ', 'decr', 'incr', 'Ribcage', SMALL_BIG),
      bi('measure-frontchest-dist', 'decr', 'incr', 'Chest spread', NARROW_WIDE),
      bi('breast-dist', 'decr', 'incr', 'Breast spacing', ['Close', 'Apart']),
      bi('breast-point', 'decr', 'incr', 'Breast shape', ['Round', 'Pointed']),
      bi('breast-trans', 'down', 'up', 'Breast height', DOWN_UP),
      bi('breast-volume-vert', 'down', 'up', 'Breast lift', DOWN_UP),
      bi('measure-waist-circ', 'decr', 'incr', 'Waist', ['Slim', 'Wide']),
      bi('stomach-pregnant', 'decr', 'incr', 'Belly', ['Flat', 'Round']),
      bi('stomach-tone', 'decr', 'incr', 'Abdominal tone', LESS_MORE),
      bi('stomach-navel', 'down', 'up', 'Navel height', DOWN_UP)
    ]
  },
  {
    id: 'hips',
    label: 'Hips',
    focus: 'hips',
    sliders: [
      bi('measure-hips-circ', 'decr', 'incr', 'Hips', ['Narrow', 'Wide']),
      bi('hip-scale-horiz', 'decr', 'incr', 'Hip width', NARROW_WIDE),
      bi('hip-scale-depth', 'decr', 'incr', 'Hip depth', SMALL_BIG),
      bi('hip-scale-vert', 'decr', 'incr', 'Hip height', SMALL_BIG),
      bi('hip-waist', 'down', 'up', 'Waistline', DOWN_UP),
      bi('measure-waisttohip-dist', 'decr', 'incr', 'Waist to hip', ['Short', 'Long']),
      bi('buttocks-volume', 'decr', 'incr', 'Glutes', LESS_MORE),
      bi('hip-trans', 'backward', 'forward', 'Pelvis tilt', BACK_FWD)
    ]
  },
  {
    id: 'arms',
    label: 'Arms & hands',
    focus: 'arms',
    sliders: [
      bi('measure-upperarm-length', 'decr', 'incr', 'Upper arm length', ['Short', 'Long']),
      bi('measure-lowerarm-length', 'decr', 'incr', 'Forearm length', ['Short', 'Long']),
      bi('measure-upperarm-circ', 'decr', 'incr', 'Upper arm size', ['Thin', 'Thick']),
      lr('upperarm-muscle', 'decr', 'incr', 'Biceps', LESS_MORE),
      lr('upperarm-shoulder-muscle', 'decr', 'incr', 'Deltoids', LESS_MORE),
      lr('upperarm-fat', 'decr', 'incr', 'Upper arm softness', LESS_MORE),
      lr('lowerarm-muscle', 'decr', 'incr', 'Forearm muscle', LESS_MORE),
      lr('lowerarm-fat', 'decr', 'incr', 'Forearm softness', LESS_MORE),
      bi('measure-wrist-circ', 'decr', 'incr', 'Wrist', ['Thin', 'Thick']),
      lr('hand-scale', 'decr', 'incr', 'Hand size', SMALL_BIG),
      lr('hand-fingers-length', 'decr', 'incr', 'Finger length', ['Short', 'Long']),
      lr('hand-fingers-diameter', 'decr', 'incr', 'Finger thickness', ['Slender', 'Thick']),
      lr('hand-fingers-distance', 'decr', 'incr', 'Finger spread', ['Close', 'Spread'])
    ]
  },
  {
    id: 'legs',
    label: 'Legs & feet',
    focus: 'legs',
    sliders: [
      bi('upperlegs-height', 'decr', 'incr', 'Thigh length', ['Short', 'Long']),
      bi('lowerlegs-height', 'decr', 'incr', 'Shin length', ['Short', 'Long']),
      bi('measure-thigh-circ', 'decr', 'incr', 'Thighs', ['Thin', 'Thick']),
      lr('upperleg-muscle', 'decr', 'incr', 'Quads', LESS_MORE),
      lr('upperleg-fat', 'decr', 'incr', 'Thigh softness', LESS_MORE),
      bi('measure-knee-circ', 'decr', 'incr', 'Knees', ['Slim', 'Thick']),
      bi('measure-calf-circ', 'decr', 'incr', 'Calves', ['Thin', 'Thick']),
      lr('lowerleg-muscle', 'decr', 'incr', 'Calf muscle', LESS_MORE),
      bi('measure-ankle-circ', 'decr', 'incr', 'Ankles', ['Slim', 'Thick']),
      lr('leg-valgus', 'decr', 'incr', 'Knee angle', ['Bowed', 'Knock']),
      lr('foot-scale', 'decr', 'incr', 'Foot size', SMALL_BIG)
    ]
  }
]

export const ALL_SHAPE_GROUPS = [...FACE_GROUPS, ...BODY_GROUPS]

export const SLIDER_BY_ID = new Map<string, ShapeSlider>(
  ALL_SHAPE_GROUPS.flatMap((g) => g.sliders.map((s) => [s.id, s] as const))
)

/** The macro sliders in the Body category (state.body keys). */
export const MACRO_SLIDERS: {
  key: string
  label: string
  ends: [string, string]
  min?: number
  max?: number
  step?: number
}[] = [
  { key: 'gender', label: 'Sex', ends: ['Female', 'Male'] },
  { key: 'age', label: 'Age', ends: ['11', '90'], min: 11, max: 90, step: 1 },
  { key: 'height', label: 'Height', ends: ['Petite', 'Tall'] },
  { key: 'weight', label: 'Weight', ends: ['Slender', 'Heavy'] },
  { key: 'muscle', label: 'Muscle', ends: ['Soft', 'Athletic'] },
  { key: 'proportions', label: 'Proportions', ends: ['Uncommon', 'Ideal'] },
  { key: 'breastSize', label: 'Bust', ends: ['Small', 'Full'] },
  { key: 'breastFirmness', label: 'Bust firmness', ends: ['Soft', 'Firm'] }
]

export const ANCESTRY_KEYS = ['african', 'asian', 'caucasian'] as const

/** Every target weight for a state: macros + shape sliders + expression. */
export function shapeTargetWeights(
  state: Human3DState,
  expression?: Map<string, number>
): Map<string, number> {
  const w = macroTargetWeights(state.body)
  for (const [key, value] of Object.entries(state.shape)) {
    const at = key.indexOf('@')
    if (at > 0) {
      const slider = SLIDER_BY_ID.get(key.slice(0, at))
      const side = key.slice(at + 1) as 'l' | 'r'
      if (slider?.sides) addModifier(w, slider.sides[side], value)
      continue
    }
    const slider = SLIDER_BY_ID.get(key)
    if (!slider) continue
    if (slider.unipolar) {
      if (value > 0) for (const t of slider.max) w.set(t, (w.get(t) || 0) + value)
      continue
    }
    const v = Math.max(-1, Math.min(1, value))
    const list = v < 0 ? slider.min : slider.max
    for (const t of list) w.set(t, (w.get(t) || 0) + Math.abs(v))
  }
  if (expression) for (const [t, v] of expression) w.set(t, (w.get(t) || 0) + v)
  return w
}
