// Pure character assembly: CharacterDoc + StylePack → an ordered list of
// paintable layers with resolved colors and transform chains. No DOM, no
// canvas, no Vue — the rendering backends (SpriteCompositor2D for the live
// stage, svgExport for vector export) consume the output.
// Covered by tests/characterModel.test.js.

import type { CharacterDoc, CharacterSlotState } from '../../../../shared/types'
import type {
  BlendMode,
  StyleGradient,
  StyleLayer,
  StylePack,
  StylePart,
  StyleSlot
} from './styleTypes'

/** Transform ops, applied in order (outermost first) about character-space points. */
export type TransformOp =
  | { type: 'translate'; x: number; y: number }
  | { type: 'scale'; sx: number; sy: number; cx: number; cy: number }
  | { type: 'rotate'; a: number; cx: number; cy: number }

/** A gradient with concrete colors: stops are [offset, #rrggbb, alpha]. */
export type ResolvedGradient =
  | {
      type: 'linear'
      x1: number
      y1: number
      x2: number
      y2: number
      stops: [number, string, number][]
    }
  | {
      type: 'radial'
      cx: number
      cy: number
      r: number
      fx: number
      fy: number
      stops: [number, string, number][]
    }

export interface ResolvedLayer {
  slot: string
  d: string
  fill: string | null
  stroke: string | null
  lineWidth: number
  ops: TransformOp[]
  z: number
  grad: ResolvedGradient | null
  alpha: number
  blend: BlendMode | null
  /** Clip region (a mask layer's path under ITS transforms). */
  clip: { d: string; ops: TransformOp[] } | null
  /** Extra local offset applied after the clip (eye tracking). */
  offset: { x: number; y: number } | null
}

/** Live animation inputs; everything defaults to still. */
export interface CharacterAnim {
  /** 0..1 eyelid closure. */
  blink?: number
  /** 0..1 breathing phase. */
  breath?: number
  /** Where the character looks, each axis −1..1 (eyes track, head parallaxes). */
  look?: { x: number; y: number }
  /** Seconds — drives sway on hair/capes. Omit for a still pose. */
  time?: number
  /** slot id → momentary scale (the part-swap pop). */
  pop?: Record<string, number>
  /** Expression override (emote previews) — wins over doc.expression. */
  expression?: string
}

// Morph slider → geometry gains (how much ±1 moves the body).
const HEAD_GAIN = 0.22
const BUILD_GAIN = 0.18
const HEIGHT_GAIN = 0.14

// ── Expressions ───────────────────────────────────────────────────────────────
// Each swaps in shared semantic part ids (styleTypes CORE_PART_IDS) — a pack
// that lacks one keeps the look's own part — plus optional fx overlays.
export interface Expression {
  id: string
  icon: string
  parts: Partial<Record<string, string>>
  blush?: boolean
  tears?: boolean
}

export const EXPRESSIONS: Expression[] = [
  { id: 'neutral', icon: '😐', parts: {} },
  {
    id: 'happy',
    icon: '😊',
    parts: { eyes: 'eyes-happy', mouth: 'mouth-grin', brows: 'brows-soft' },
    blush: true
  },
  {
    id: 'laugh',
    icon: '😆',
    parts: { eyes: 'eyes-closed', mouth: 'mouth-open', brows: 'brows-raised' }
  },
  {
    id: 'surprised',
    icon: '😮',
    parts: { eyes: 'eyes-wide', brows: 'brows-raised', mouth: 'mouth-o' }
  },
  {
    id: 'angry',
    icon: '😠',
    parts: { eyes: 'eyes-sharp', brows: 'brows-angry', mouth: 'mouth-frown' }
  },
  { id: 'sad', icon: '😢', parts: { brows: 'brows-sad', mouth: 'mouth-frown' }, tears: true },
  {
    id: 'smug',
    icon: '😏',
    parts: { eyes: 'eyes-sleepy', brows: 'brows-arched', mouth: 'mouth-smirk' }
  },
  { id: 'shy', icon: '😳', parts: { brows: 'brows-sad', mouth: 'mouth-cat' }, blush: true }
]

const EXPRESSION_BY_ID = new Map(EXPRESSIONS.map((e) => [e.id, e]))

// ── Swatches (fallback rows when a pack defines none) ────────────────────────
export const SWATCHES: Record<string, string[]> = {
  skin: [
    '#fbe3d0',
    '#f6d2b5',
    '#f2c9a0',
    '#e8b48c',
    '#dca27a',
    '#c98a5b',
    '#b0744a',
    '#8d5a3b',
    '#6e4430',
    '#4e3024',
    '#b8d4c8',
    '#c9c2ec'
  ],
  hair: [
    '#141018',
    '#2e1d14',
    '#4a3628',
    '#6b4a2f',
    '#a0703f',
    '#c98f3d',
    '#e6c77a',
    '#a33f2e',
    '#d8d3cf',
    '#7a8aa8',
    '#e27aa8',
    '#5fb7c9',
    '#7b5fc9',
    '#3f9a6a'
  ],
  eyes: [
    '#3a2a1e',
    '#5a3d28',
    '#8a6a3a',
    '#5a8a52',
    '#4a6fae',
    '#6b7a8f',
    '#2f5d8a',
    '#8a3a3a',
    '#c9a13a',
    '#9b59b6',
    '#1ab5a0',
    '#e04a6a'
  ],
  outfit: [
    '#f2efe8',
    '#1f1f29',
    '#3f4a6b',
    '#6c8ef5',
    '#5c6bc0',
    '#2bb3a3',
    '#4caf72',
    '#f5a623',
    '#e8b04b',
    '#e86a5f',
    '#c95fa0',
    '#8b6cc5',
    '#8d6e63',
    '#607d8b'
  ]
}

/** The swatch row for a palette channel (pack override → shared fallback). */
export function swatchesFor(pack: StylePack, channel: string): string[] {
  return pack.swatches?.[channel] ?? SWATCHES[channel] ?? SWATCHES.outfit
}

// ── Color helpers ─────────────────────────────────────────────────────────────
/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb color, amt in −1..1. */
export function shadeColor(hex: string, amt: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  if (!Number.isFinite(n) || !amt) return hex
  const ch = (c: number) => {
    const v = amt > 0 ? c + (255 - c) * amt : c * (1 + amt)
    return Math.max(0, Math.min(255, Math.round(v)))
  }
  const r = ch((n >> 16) & 0xff)
  const g = ch((n >> 8) & 0xff)
  const b = ch(n & 0xff)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function rgbOf(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16) || 0
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toHex = (r: number, g: number, b: number): string =>
  '#' +
  [r, g, b]
    .map((c) =>
      Math.max(0, Math.min(255, Math.round(c)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')

/** Linear blend a → b by t (0..1). */
export function mixColor(a: string, b: string, t: number): string {
  const x = rgbOf(a)
  const y = rgbOf(b)
  return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t)
}

/** #rrggbb → [h 0..360, s 0..1, l 0..1]. */
export function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = rgbOf(hex).map((c) => c / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h *= 60
  return [h, s, l]
}

export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  return toHex((r + m) * 255, (g + m) * 255, (b + m) * 255)
}

export type HarmonyMode = 'complementary' | 'analogous' | 'triad' | 'mono'
export const HARMONY_MODES: HarmonyMode[] = ['complementary', 'analogous', 'triad', 'mono']

/** Outfit colors (outfitA/outfitB/accent) built around outfitA's hue by a
 *  color-harmony rule. Skin/hair/eyes are untouched. */
export function harmonize(
  palette: Record<string, string>,
  mode: HarmonyMode,
  rng: () => number = Math.random
): Record<string, string> {
  const [h0, s0, l0] = hexToHsl(palette.outfitA || '#6c8ef5')
  const h = h0 + (rng() - 0.5) * 24
  const s = Math.min(0.85, Math.max(0.35, s0 || 0.55))
  const l = Math.min(0.62, Math.max(0.38, l0))
  const offs =
    mode === 'complementary'
      ? [0, 180]
      : mode === 'analogous'
        ? [-32, 32]
        : mode === 'triad'
          ? [120, 240]
          : [0, 0]
  return {
    ...palette,
    outfitA: hslToHex(h, s, l),
    outfitB:
      mode === 'mono' ? hslToHex(h, s * 0.7, l * 0.55) : hslToHex(h + offs[0], s * 0.6, l * 0.62),
    accent:
      mode === 'mono'
        ? hslToHex(h, s, Math.min(0.8, l + 0.22))
        : hslToHex(h + offs[1], Math.min(0.9, s + 0.1), 0.58)
  }
}

/** A layer paint ('skin', 'ink', '#rrggbb', …) → a concrete color. */
export function resolvePaint(
  paint: string | undefined,
  palette: Record<string, string>,
  ink: string,
  shade = 0
): string | null {
  if (!paint || paint === 'none') return null
  const base = paint === 'ink' ? ink : paint.startsWith('#') ? paint : palette[paint] || '#8f87a3'
  return shade ? shadeColor(base, shade) : base
}

function resolveGrad(
  g: StyleGradient,
  palette: Record<string, string>,
  ink: string
): ResolvedGradient {
  const stops = g.stops.map(
    ([o, paint, shade, alpha]) =>
      [o, resolvePaint(paint, palette, ink, shade || 0) as string, alpha ?? 1] as [
        number,
        string,
        number
      ]
  )
  if (g.type === 'linear') return { type: 'linear', x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2, stops }
  return { type: 'radial', cx: g.cx, cy: g.cy, r: g.r, fx: g.fx ?? g.cx, fy: g.fy ?? g.cy, stops }
}

// ── Pack lookups ──────────────────────────────────────────────────────────────
export function slotOf(pack: StylePack, slotId: string): StyleSlot | undefined {
  return pack.slots.find((s) => s.id === slotId)
}

export function partsFor(pack: StylePack, slotId: string): StylePart[] {
  return pack.parts.filter((p) => p.slot === slotId)
}

export function partById(pack: StylePack, partId: string | null): StylePart | undefined {
  return partId ? pack.parts.find((p) => p.id === partId) : undefined
}

/** The doc's effective state for a slot (pack default when untouched). */
export function slotState(doc: CharacterDoc, pack: StylePack, slotId: string): CharacterSlotState {
  return doc.parts[slotId] ?? { partId: pack.defaults[slotId] ?? null, scale: 1 }
}

// ── Doc scaffolding ───────────────────────────────────────────────────────────
export function defaultParts(pack: StylePack): Record<string, CharacterSlotState> {
  const out: Record<string, CharacterSlotState> = {}
  for (const s of pack.slots) out[s.id] = { partId: pack.defaults[s.id] ?? null, scale: 1 }
  return out
}

export function defaultPalette(pack: StylePack): Record<string, string> {
  return { ...pack.palettePresets[0] }
}

export const MORPH_KEYS = ['height', 'build', 'headSize', 'age'] as const

export interface RandomizeOptions {
  /** Slot ids (plus 'palette' / 'morph') to keep from `base`. */
  locks?: string[]
  base?: Pick<CharacterDoc, 'parts' | 'palette' | 'morph'>
}

/** Random parts/palette/morph. `rng` is injected () => [0,1) for testability;
 *  optional slots come up empty more often than not. Locked slots (and the
 *  'palette' / 'morph' pseudo-slots) are copied from `opts.base`. */
export function randomizeDoc(
  pack: StylePack,
  rng: () => number = Math.random,
  opts: RandomizeOptions = {}
): Pick<CharacterDoc, 'parts' | 'palette' | 'morph'> {
  const locks = new Set(opts.locks || [])
  const base = opts.base
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]
  const parts: Record<string, CharacterSlotState> = {}
  for (const s of pack.slots) {
    if (base && locks.has(s.id)) {
      parts[s.id] = { ...(base.parts[s.id] ?? { partId: pack.defaults[s.id] ?? null, scale: 1 }) }
      continue
    }
    // Expression-only parts (closed eyes etc.) make odd resting faces
    const options = partsFor(pack, s.id).filter((p) => !EXPRESSION_ONLY.has(p.id))
    const noneOdds = s.id === 'nose' ? 0.1 : s.id === 'back' ? 0.8 : 0.6
    const none = s.optional && rng() < noneOdds
    parts[s.id] = { partId: none || !options.length ? null : pick(options).id, scale: 1 }
  }
  const palette =
    base && locks.has('palette') ? { ...base.palette } : { ...pick(pack.palettePresets) }
  const r = () => Math.round((rng() * 2 - 1) * 10) / 10
  const morph =
    base && locks.has('morph')
      ? { ...base.morph }
      : { height: r(), build: r(), headSize: r(), age: base?.morph?.age ?? 0 }
  return { parts, palette, morph }
}

/** Parts that only make sense as a passing expression. */
const EXPRESSION_ONLY = new Set(['eyes-closed', 'mouth-open', 'brows-angry', 'brows-sad'])

/** Carry a look into another style: parts with the same semantic id are kept,
 *  the rest fall back to the target pack's defaults; the palette carries
 *  over (missing channels from the target's default preset). */
export function remapDoc(
  doc: Pick<CharacterDoc, 'parts' | 'palette'>,
  to: StylePack
): { parts: Record<string, CharacterSlotState>; palette: Record<string, string> } {
  const parts: Record<string, CharacterSlotState> = {}
  for (const s of to.slots) {
    const st = doc.parts[s.id]
    if (st && (st.partId === null ? s.optional : partById(to, st.partId)?.slot === s.id)) {
      parts[s.id] = { ...st }
    } else parts[s.id] = { partId: to.defaults[s.id] ?? null, scale: st?.scale ?? 1 }
  }
  return { parts, palette: { ...defaultPalette(to), ...doc.palette } }
}

/** Camera region that frames a slot (the part grid's thumb region, widened). */
export function focusRegion(pack: StylePack, slotId: string) {
  const s = slotOf(pack, slotId)
  if (!s) return fullRegion(pack)
  return { cx: s.thumb.cx, cy: s.thumb.cy, span: Math.max(s.thumb.span * 1.55, pack.width * 0.55) }
}

export function fullRegion(pack: StylePack) {
  return { cx: pack.width / 2, cy: pack.height / 2, span: Math.max(pack.width, pack.height) * 1.08 }
}

// ── Age ───────────────────────────────────────────────────────────────────────
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** The age morph (−1 child … 0 adult … +1 elder) folded into proportions,
 *  greying, and wrinkle visibility. */
export function ageEffects(age = 0) {
  const child = Math.max(0, -age)
  const elder = Math.max(0, age)
  return {
    /** Whole-figure scale about the ground (kids are small). */
    bodyScale: 1 - 0.26 * child,
    /** Added to the headSize morph (kids have big heads). */
    headBoost: 0.6 * child,
    /** Added to the height morph (elders stoop a little). */
    heightBoost: -0.35 * elder,
    grey: clamp01((elder - 0.2) / 0.8) * 0.9,
    wrinkles: clamp01((elder - 0.1) / 0.9),
    hideFacialHair: child > 0.35
  }
}

// ── Assembly ──────────────────────────────────────────────────────────────────
interface OpsInput {
  pack: StylePack
  slotId: string
  state: CharacterSlotState
  morph: Record<string, number>
  anim: CharacterAnim
  socket: { x: number; y: number }
  age: ReturnType<typeof ageEffects>
}

/** Body-morph + animation transform chain for one slot (outermost first).
 *  Height stretches the legs about the ground (lifting the hips); everything
 *  above translates up by the lift so the figure stays connected. */
function slotOps({ pack, slotId, state, morph, anim, socket, age }: OpsInput): TransformOp[] {
  const { rig } = pack
  const ops: TransformOp[] = []
  const height = (morph.height || 0) + age.heightBoost
  const legScale = 1 + HEIGHT_GAIN * height
  const hipLift = (legScale - 1) * (rig.ground.y - rig.hips.y)
  const isLeg = rig.legSlots.includes(slotId)
  const isHead = rig.headSlots.includes(slotId)
  const breath = anim.breath || 0

  if (age.bodyScale !== 1) {
    ops.push({
      type: 'scale',
      sx: age.bodyScale,
      sy: age.bodyScale,
      cx: rig.ground.x,
      cy: rig.ground.y
    })
  }
  if (isLeg) {
    ops.push({ type: 'scale', sx: 1, sy: legScale, cx: rig.ground.x, cy: rig.ground.y })
  } else if (hipLift) {
    ops.push({ type: 'translate', x: 0, y: -hipLift })
  }
  if (rig.buildSlots.includes(slotId) && morph.build) {
    ops.push({
      type: 'scale',
      sx: 1 + BUILD_GAIN * morph.build,
      sy: 1,
      cx: rig.hips.x,
      cy: rig.hips.y
    })
  }
  if (isHead) {
    const headSize = (morph.headSize || 0) + age.headBoost
    if (headSize) {
      const s = 1 + HEAD_GAIN * headSize
      ops.push({ type: 'scale', sx: s, sy: s, cx: rig.neck.x, cy: rig.neck.y })
    }
    const look = anim.look
    const dy = -1.8 * breath + (look ? look.y * 1.4 : 0)
    const dx = look ? look.x * 2.2 : 0
    if (dx || dy) ops.push({ type: 'translate', x: dx, y: dy })
  } else if (slotId === 'torso' && breath) {
    ops.push({ type: 'scale', sx: 1, sy: 1 + 0.008 * breath, cx: rig.hips.x, cy: rig.hips.y })
  }
  if (state.flip) ops.push({ type: 'scale', sx: -1, sy: 1, cx: socket.x, cy: socket.y })
  if (state.scale !== 1) {
    ops.push({ type: 'scale', sx: state.scale, sy: state.scale, cx: socket.x, cy: socket.y })
  }
  const pop = anim.pop?.[slotId]
  if (pop && pop !== 1) {
    // Squash & stretch: wider when it grows, taller as it settles
    ops.push({ type: 'scale', sx: pop, sy: 2 - pop, cx: socket.x, cy: socket.y })
  }
  if (slotId === 'eyes' && anim.blink) {
    ops.push({
      type: 'scale',
      sx: 1,
      sy: Math.max(0.08, 1 - anim.blink),
      cx: socket.x,
      cy: socket.y
    })
  }
  return ops
}

/** The palette after procedural effects (greying hair with age). */
export function effectivePalette(doc: CharacterDoc, pack: StylePack): Record<string, string> {
  const age = ageEffects(doc.morph?.age || 0)
  if (!age.grey || !doc.palette.hair) return doc.palette
  return { ...doc.palette, hair: mixColor(doc.palette.hair, pack.greyHair || '#d9d6d0', age.grey) }
}

/** The part a slot shows right now (an expression can swap eyes/brows/mouth). */
export function effectivePartId(
  doc: CharacterDoc,
  pack: StylePack,
  slotId: string,
  expressionId?: string
): string | null {
  const exp = EXPRESSION_BY_ID.get(expressionId || doc.expression || 'neutral')
  const over = exp?.parts[slotId]
  if (over && partById(pack, over)?.slot === slotId) return over
  return slotState(doc, pack, slotId).partId
}

/** Resolve the whole figure into paint-ready layers, back to front. */
export function resolveLayers(
  doc: CharacterDoc,
  pack: StylePack,
  anim: CharacterAnim = {}
): ResolvedLayer[] {
  const out: ResolvedLayer[] = []
  const morph = (doc.morph || {}) as unknown as Record<string, number>
  const age = ageEffects(morph.age || 0)
  const palette = effectivePalette(doc, pack)
  const expressionId = anim.expression || doc.expression || 'neutral'
  const expression = EXPRESSION_BY_ID.get(expressionId)
  const look = anim.look
  const swaying = anim.time !== undefined

  const pushList = (
    slotDef: StyleSlot,
    layers: StyleLayer[],
    ops: TransformOp[],
    z: number,
    alphaMul = 1
  ) => {
    let mask: { d: string; ops: TransformOp[] } | null = null
    for (const l of layers) {
      let lops = ops
      if (l.sway && swaying) {
        const t = anim.time as number
        const phase = slotDef.socket.x * 0.013 + slotDef.z * 0.7
        const deg = l.sway * Math.sin(t * 1.35 + phase) - (look ? look.x * l.sway * 0.6 : 0)
        lops = [
          ...ops,
          { type: 'rotate', a: (deg * Math.PI) / 180, cx: slotDef.socket.x, cy: slotDef.socket.y }
        ]
      }
      const resolved: ResolvedLayer = {
        slot: slotDef.id,
        d: l.d,
        fill: l.grad ? null : resolvePaint(l.fill, palette, pack.ink, l.shade),
        stroke: resolvePaint(l.stroke, palette, pack.ink, l.shade),
        lineWidth: l.lineWidth ?? 0,
        ops: lops,
        z,
        grad: l.grad ? resolveGrad(l.grad, palette, pack.ink) : null,
        alpha: (l.alpha ?? 1) * alphaMul,
        blend: l.blend ?? null,
        clip: l.clip ? mask : null,
        offset: l.track && look ? { x: look.x * l.track, y: look.y * l.track * 0.8 } : null
      }
      if (resolved.alpha > 0.001) out.push(resolved)
      if (l.mask) mask = { d: l.d, ops: lops }
    }
  }

  for (const s of pack.slots) {
    if (s.id === 'facialHair' && age.hideFacialHair) continue
    const partId = effectivePartId(doc, pack, s.id, expressionId)
    const part = partById(pack, partId)
    if (!part) continue
    const state = slotState(doc, pack, s.id)
    const ops = slotOps({ pack, slotId: s.id, state, morph, anim, socket: s.socket, age })
    if (part.back?.length) {
      // Parallax: the back band lags the head a touch when the look moves
      const backOps: TransformOp[] =
        look && pack.rig.headSlots.includes(s.id)
          ? [...ops, { type: 'translate', x: -look.x * 1.6, y: -look.y * 0.6 }]
          : ops
      pushList(s, part.back, backOps, s.backZ ?? 0)
    }
    pushList(s, part.layers, ops, s.z)
  }

  // Procedural overlays ride the head's transforms
  const fx = pack.fx
  const headSlot = slotOf(pack, 'head')
  if (fx && headSlot) {
    const headOps = slotOps({
      pack,
      slotId: 'head',
      state: { partId: null, scale: 1 },
      morph,
      anim: { ...anim, pop: undefined },
      socket: headSlot.socket,
      age
    })
    const zOf = (id: string, fallback: number) => (slotOf(pack, id)?.z ?? fallback) + 0.5
    if (fx.aging && age.wrinkles > 0)
      pushList(headSlot, fx.aging, headOps, headSlot.z + 0.5, age.wrinkles)
    if (fx.blush && expression?.blush)
      pushList(headSlot, fx.blush, headOps, zOf('marks', headSlot.z + 1))
    if (fx.tears && expression?.tears)
      pushList(headSlot, fx.tears, headOps, zOf('eyes', headSlot.z + 2))
  }

  out.sort((a, b) => a.z - b.z)
  return out
}
