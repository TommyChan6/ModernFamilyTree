// Pure character assembly: CharacterDoc + StylePack → an ordered list of
// paintable layers with resolved colors and transform chains. No DOM, no
// canvas, no Vue — the rendering backend (SpriteCompositor2D today, a mesh
// renderer some day) consumes the output. Covered by tests/characterModel.test.js.

import type { CharacterDoc, CharacterSlotState } from '../../../../shared/types'
import type { StyleLayer, StylePack, StylePart, StyleSlot } from './styleTypes'

/** Transform ops, applied in order (outermost first) about character-space points. */
export type TransformOp =
  | { type: 'translate'; x: number; y: number }
  | { type: 'scale'; sx: number; sy: number; cx: number; cy: number }

export interface ResolvedLayer {
  slot: string
  d: string
  fill: string | null
  stroke: string | null
  lineWidth: number
  ops: TransformOp[]
  z: number
}

/** Live animation inputs (both 0..1); everything defaults to still. */
export interface CharacterAnim {
  blink?: number
  breath?: number
}

// Morph slider → geometry gains (how much ±1 moves the body).
const HEAD_GAIN = 0.22
const BUILD_GAIN = 0.18
const HEIGHT_GAIN = 0.14

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

/** A layer paint ('skin', 'ink', '#rrggbb', …) → a concrete color. */
export function resolvePaint(
  paint: string | undefined,
  palette: Record<string, string>,
  ink: string,
  shade = 0
): string | null {
  if (!paint) return null
  const base = paint === 'ink' ? ink : paint.startsWith('#') ? paint : palette[paint] || '#8f87a3'
  return shade ? shadeColor(base, shade) : base
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
  for (const slot of pack.slots) out[slot.id] = { partId: pack.defaults[slot.id] ?? null, scale: 1 }
  return out
}

export function defaultPalette(pack: StylePack): Record<string, string> {
  return { ...pack.palettePresets[0] }
}

/** Random parts/palette/morph. `rng` is injected () => [0,1) for testability;
 *  optional slots come up empty more often than not. */
export function randomizeDoc(
  pack: StylePack,
  rng: () => number = Math.random
): Pick<CharacterDoc, 'parts' | 'palette' | 'morph'> {
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]
  const parts: Record<string, CharacterSlotState> = {}
  for (const slot of pack.slots) {
    const options = partsFor(pack, slot.id)
    const none = slot.optional && rng() < 0.6
    parts[slot.id] = { partId: none || !options.length ? null : pick(options).id, scale: 1 }
  }
  const palette = { ...pick(pack.palettePresets) }
  const morph = {
    height: Math.round((rng() * 2 - 1) * 10) / 10,
    build: Math.round((rng() * 2 - 1) * 10) / 10,
    headSize: Math.round((rng() * 2 - 1) * 10) / 10
  }
  return { parts, palette, morph }
}

// ── Assembly ──────────────────────────────────────────────────────────────────
/** Body-morph + animation transform chain for one slot (outermost first).
 *  Height stretches the legs about the ground (lifting the hips); everything
 *  above translates up by the lift so the figure stays connected. */
function slotOps(
  pack: StylePack,
  slotId: string,
  state: CharacterSlotState,
  morph: CharacterDoc['morph'],
  anim: CharacterAnim,
  socket: { x: number; y: number }
): TransformOp[] {
  const { rig } = pack
  const ops: TransformOp[] = []
  const legScale = 1 + HEIGHT_GAIN * (morph.height || 0)
  const hipLift = (legScale - 1) * (rig.ground.y - rig.hips.y)
  const isLeg = rig.legSlots.includes(slotId)
  const isHead = rig.headSlots.includes(slotId)
  const breath = anim.breath || 0

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
    if (morph.headSize) {
      const s = 1 + HEAD_GAIN * morph.headSize
      ops.push({ type: 'scale', sx: s, sy: s, cx: rig.neck.x, cy: rig.neck.y })
    }
    if (breath) ops.push({ type: 'translate', x: 0, y: -1.8 * breath })
  } else if (slotId === 'torso' && breath) {
    ops.push({ type: 'scale', sx: 1, sy: 1 + 0.008 * breath, cx: rig.hips.x, cy: rig.hips.y })
  }
  if (state.flip) ops.push({ type: 'scale', sx: -1, sy: 1, cx: socket.x, cy: socket.y })
  if (state.scale !== 1) {
    ops.push({ type: 'scale', sx: state.scale, sy: state.scale, cx: socket.x, cy: socket.y })
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

/** Resolve the whole figure into paint-ready layers, back to front. */
export function resolveLayers(
  doc: CharacterDoc,
  pack: StylePack,
  anim: CharacterAnim = {}
): ResolvedLayer[] {
  const out: ResolvedLayer[] = []
  for (const slot of pack.slots) {
    const state = slotState(doc, pack, slot.id)
    const part = partById(pack, state.partId)
    if (!part) continue
    const ops = slotOps(pack, slot.id, state, doc.morph, anim, slot.socket)
    const push = (layers: StyleLayer[], z: number) => {
      for (const l of layers) {
        out.push({
          slot: slot.id,
          d: l.d,
          fill: resolvePaint(l.fill, doc.palette, pack.ink, l.shade),
          stroke: resolvePaint(l.stroke, doc.palette, pack.ink, l.shade),
          lineWidth: l.lineWidth ?? 0,
          ops,
          z
        })
      }
    }
    if (part.back?.length) push(part.back, slot.backZ ?? 0)
    push(part.layers, slot.z)
  }
  out.sort((a, b) => a.z - b.z)
  return out
}
