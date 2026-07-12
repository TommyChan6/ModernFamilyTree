// The renderer-side contract for character art styles. A StylePack is what
// makes a style: its part catalog (SVG path data in the pack's own character
// space), slot layout/z-order, rig anchors for body morphs, and palette
// semantics. CharacterDocs (src/shared/types.ts) reference parts BY ID only,
// so packs can evolve — and other rendering backends can consume the same
// docs — without touching stored data.

/** One drawable of a part: an SVG path plus how to paint it. `fill`/`stroke`
 *  are either a palette channel name ('skin', 'hair', …), the literal 'ink'
 *  (the pack's outline color), or a literal '#rrggbb'. */
export interface StyleLayer {
  /** SVG path data in the pack's character space. */
  d: string
  fill?: string
  stroke?: string
  lineWidth?: number
  /** Lighten (+) / darken (−) the resolved paint, −1..1. */
  shade?: number
}

export interface StylePart {
  id: string
  slot: string
  /** Layers drawn in the slot's `backZ` band (long hair, hoods…). */
  back?: StyleLayer[]
  layers: StyleLayer[]
}

export interface StyleSlot {
  id: string
  /** Emoji for the wardrobe rail. */
  icon: string
  /** Anchor the slot's scale/flip pivots around, in character space. */
  socket: { x: number; y: number }
  z: number
  /** z band for parts' `back` layers (behind the body). */
  backZ?: number
  /** true = "none" is a valid choice (headwear, accessories…). */
  optional?: boolean
  /** Crop the part grid's preview tiles to this region. */
  thumb: { cx: number; cy: number; span: number }
}

/** Anchor points the body morphs pivot around — style-specific proportions. */
export interface StyleRig {
  neck: { x: number; y: number }
  hips: { x: number; y: number }
  ground: { x: number; y: number }
  /** Slots that ride the head (headSize morph, breathing). */
  headSlots: string[]
  /** Slots scaled horizontally by the build morph. */
  buildSlots: string[]
  /** Slots stretched vertically (about the ground) by the height morph. */
  legSlots: string[]
}

export interface StylePack {
  id: string
  name: string
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
  /** slot id → default part id (or null for optional slots). */
  defaults: Record<string, string | null>
  rig: StyleRig
}
