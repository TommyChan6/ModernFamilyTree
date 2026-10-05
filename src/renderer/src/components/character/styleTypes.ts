// The renderer-side contract for character art styles. A StylePack is what
// makes a style: its part catalog (SVG path data in the pack's own character
// space), slot layout/z-order, rig anchors for body morphs, and palette
// semantics. CharacterDocs (src/shared/types.ts) reference parts BY ID only,
// so packs can evolve — and other rendering backends can consume the same
// docs — without touching stored data.
//
// Cross-style contract: every pack declares the SAME slot ids (SLOT_IDS) and
// reuses the shared semantic part ids (CORE_PART_IDS) where it has an
// equivalent, so switching a look's style keeps "long hair" long and the
// expressions (characterModel EXPRESSIONS) find their eyes/brows/mouths.

/** A paint: a palette channel name ('skin', 'hair', …), the literal 'ink'
 *  (the pack's outline color), or a literal '#rrggbb'. */
export type Paint = string

/** One gradient stop: [offset 0..1, paint, shade −1..1, alpha 0..1]. */
export type GradientStop = [number, Paint, number?, number?]

/** A gradient in the layer's own path space (it rides the layer's transforms). */
export type StyleGradient =
  | { type: 'linear'; x1: number; y1: number; x2: number; y2: number; stops: GradientStop[] }
  | {
      type: 'radial'
      cx: number
      cy: number
      r: number
      /** Focal point (defaults to the center). */
      fx?: number
      fy?: number
      stops: GradientStop[]
    }

export type BlendMode = 'multiply' | 'screen' | 'overlay' | 'soft-light'

/** One drawable of a part: an SVG path plus how to paint it. */
export interface StyleLayer {
  /** SVG path data in the pack's character space. */
  d: string
  fill?: Paint
  /** Gradient fill — wins over `fill` when both are set. */
  grad?: StyleGradient
  stroke?: Paint
  lineWidth?: number
  /** Lighten (+) / darken (−) the resolved fill/stroke paint, −1..1. */
  shade?: number
  /** Layer opacity 0..1 (default 1). */
  alpha?: number
  blend?: BlendMode
  /** This layer's path becomes the clip for later `clip` layers of the same
   *  part list (cel shadows inside a face, strands inside a hair mass…). The
   *  mask layer itself still paints normally — give it `alpha: 0` for a
   *  clip-only mask (it is recorded as the clip but never drawn or hit). */
  mask?: boolean
  /** Clip to the most recent `mask` layer in the same part list. */
  clip?: boolean
  /** Eye-tracking gain (character units at full look) — irises/pupils/
   *  highlights. Their clip (the eye white) stays put, so irises roll
   *  inside the socket. */
  track?: number
  /** Idle sway amplitude in degrees about the slot socket (loose hair, capes). */
  sway?: number
}

export interface StylePart {
  id: string
  slot: string
  /** Layers drawn in the slot's `backZ` band (long hair, hoods, cape backs…). */
  back?: StyleLayer[]
  layers: StyleLayer[]
}

export interface StyleSlot {
  id: string
  /** Emoji for the wardrobe rail. */
  icon: string
  /** Anchor the slot's scale/flip/pop pivots around, in character space. */
  socket: { x: number; y: number }
  z: number
  /** z band for parts' `back` layers (behind the body). */
  backZ?: number
  /** true = "none" is a valid choice (headwear, accessories…). */
  optional?: boolean
  /** Crop the part grid's preview tiles (and the camera focus) to this region. */
  thumb: { cx: number; cy: number; span: number }
}

/** Anchor points the body morphs pivot around — style-specific proportions. */
export interface StyleRig {
  neck: { x: number; y: number }
  hips: { x: number; y: number }
  ground: { x: number; y: number }
  /** Slots that ride the head (headSize morph, breathing, look parallax). */
  headSlots: string[]
  /** Slots scaled horizontally by the build morph. */
  buildSlots: string[]
  /** Slots stretched vertically (about the ground) by the height morph. */
  legSlots: string[]
}

/** Procedural overlays the model mixes in (all drawn with the head's transforms). */
export interface StyleFx {
  /** Cheek blush for the happy/shy expressions. */
  blush?: StyleLayer[]
  /** Tear streaks for the sad expression. */
  tears?: StyleLayer[]
  /** Wrinkles/age lines; faded in by the age morph (elder side). */
  aging?: StyleLayer[]
}

export interface StylePack {
  id: string
  /** Display name fallback (the UI prefers i18n `character.styleNames.<id>`). */
  name: string
  /** Emoji badge for the style picker. */
  icon: string
  /** Character-space dimensions all part paths are authored in. */
  width: number
  height: number
  /** Outline color ('ink' in layer paints). */
  ink: string
  slots: StyleSlot[]
  parts: StylePart[]
  paletteChannels: string[]
  /** Curated full palettes; [0] is the default, randomize samples them. */
  palettePresets: Record<string, string>[]
  /** Optional per-channel swatch rows (fallback: characterModel SWATCHES). */
  swatches?: Partial<Record<string, string[]>>
  /** slot id → default part id (or null for optional slots). */
  defaults: Record<string, string | null>
  rig: StyleRig
  /** Head-and-shoulders crop for avatars/thumbnails (character space). */
  portrait: { cx: number; cy: number; span: number }
  /** Face close-up for the camera's Face preset. */
  face: { cx: number; cy: number; span: number }
  fx?: StyleFx
  /** Hair color the elder side of the age morph greys toward. */
  greyHair?: string
}

/** Every pack declares exactly these slots (its own sockets/z/thumbs). */
export const SLOT_IDS = [
  'back',
  'head',
  'hair',
  'eyes',
  'brows',
  'nose',
  'mouth',
  'facialHair',
  'marks',
  'torso',
  'legs',
  'feet',
  'headwear',
  'accessory'
] as const

/** Slots where "none" is allowed. */
export const OPTIONAL_SLOTS = ['back', 'nose', 'facialHair', 'marks', 'headwear', 'accessory']

/** Shared semantic part ids — every pack provides all of these (so style
 *  switching and expressions line up); packs may add their own extras. */
export const CORE_PART_IDS: Record<string, string[]> = {
  back: ['back-cape', 'back-wings', 'back-backpack', 'back-sword'],
  head: ['head-round', 'head-slim', 'head-soft', 'head-square', 'head-heart'],
  hair: [
    'hair-short',
    'hair-spiky',
    'hair-bob',
    'hair-long',
    'hair-buns',
    'hair-ponytail',
    'hair-curly',
    'hair-sidepart',
    'hair-none'
  ],
  eyes: [
    'eyes-round',
    'eyes-spark',
    'eyes-sharp',
    'eyes-sleepy',
    'eyes-happy',
    'eyes-closed',
    'eyes-wide'
  ],
  brows: [
    'brows-straight',
    'brows-arched',
    'brows-soft',
    'brows-thick',
    'brows-angry',
    'brows-sad',
    'brows-raised'
  ],
  nose: ['nose-button', 'nose-small', 'nose-long'],
  mouth: [
    'mouth-smile',
    'mouth-grin',
    'mouth-neutral',
    'mouth-o',
    'mouth-frown',
    'mouth-smirk',
    'mouth-cat',
    'mouth-open'
  ],
  facialHair: ['beard-stubble', 'beard-full', 'beard-goatee', 'mustache'],
  marks: ['marks-blush', 'marks-freckles', 'marks-scar', 'marks-mole', 'marks-paint'],
  torso: [
    'torso-tee',
    'torso-hoodie',
    'torso-dress',
    'torso-suit',
    'torso-sweater',
    'torso-robe',
    'torso-armor'
  ],
  legs: ['legs-pants', 'legs-shorts', 'legs-skirt', 'legs-longskirt'],
  feet: ['feet-sneakers', 'feet-boots', 'feet-sandals'],
  headwear: ['hat-cap', 'hat-beanie', 'hat-crown', 'hat-witch', 'hat-top', 'hat-headband'],
  accessory: ['acc-glasses', 'acc-shades', 'acc-earrings', 'acc-necklace', 'acc-monocle']
}

/** The six palette channels every pack paints through. */
export const PALETTE_CHANNELS = ['skin', 'hair', 'eyes', 'outfitA', 'outfitB', 'accent']
