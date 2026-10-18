// The action wheel's mode catalog — pure, no store/D3/Three dependency.
//
// The wheel has eight directional slots (N, clockwise through NW). Each slot
// holds a small descriptor of an EDIT MODE the canvas can enter:
//   { kind: 'add' }                  — click empty canvas to create a person
//   { kind: 'delete' }               — click a node/bond, click again to confirm
//   { kind: 'link', type: 'friends' }— click two people in a row to bond them
//   { kind: 'tag', tagId: '…' }      — click people to toggle a tag
//   { kind: 'paint', color: '#…' }   — click people to tint their node
//   { kind: 'pin' }                  — click people to pin / release them
//   { kind: 'end' }                  — click a bond to mark it ended
//   { kind: 'swap' }                 — click a directed bond to flip it
//   { kind: 'retime' }               — Birth layout: drag people up/down to
//                                      change their birth year (death stays)
//   null                             — empty slot (release opens the editor)
//
// `resolveWheelSlot` turns a stored descriptor into everything the UI needs
// (label/icon/color/hint + gating), validating that referenced relationship
// types / tags still exist. Sector geometry helpers live here too so the wheel
// and the config editor draw identical rings.

import { hasIcon } from '../ui/icons.js'
import { translate as t } from '../../i18n'
import { relTypeLabel, nounLabel, defaultNameLabel } from '../../lib/dataLabels'

export const WHEEL_SLOT_COUNT = 8

export const WHEEL_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

// Same accent presets the Groups view and the action pane offer.
export const WHEEL_PAINT_COLORS = [
  '#6c8ef5',
  '#f06292',
  '#f5a623',
  '#4caf72',
  '#a06cf5',
  '#26c6da',
  '#ef5350',
  '#8a93a6'
]

export const DEFAULT_WHEEL_SLOTS = [
  { kind: 'add' }, // N — grow the tree
  { kind: 'link', type: 'parent_child' }, // NE
  { kind: 'link', type: 'spouse' }, // E
  { kind: 'link', type: 'friends' }, // SE
  { kind: 'delete' }, // S — destructive points down
  { kind: 'pin' }, // SW
  { kind: 'paint', color: '#f5a623' }, // W
  null // NW — an open invitation to customize
]

// Icons are names from components/ui/icons.js (rendered by UiIcon / drawIcon).
const KIND_META = {
  add: { icon: 'plus', color: '#4caf72' },
  delete: { icon: 'trash-2', color: '#ef5350' },
  pin: { icon: 'pin', color: '#f5a623' },
  paint: { icon: 'paintbrush', color: '#a06cf5' },
  tag: { icon: 'tag', color: '#26c6da' },
  end: { icon: 'hourglass', color: '#8a93a6' },
  swap: { icon: 'arrow-right-left', color: '#26c6da' },
  retime: { icon: 'move-vertical', color: '#26c6da' },
  link: { icon: 'link', color: '#6c8ef5' }
}

/** A stored icon (tag icon / relationship glyph — a name or a legacy glyph)
 *  when it resolves to a real icon, else the kind's fallback. */
function iconOr(value, fallback) {
  return value && hasIcon(value) ? value : fallback
}

/** The legacy trio reads its color from the Style panel; every other type
 *  carries its own swatch (mirrors relTypeColor in the canvas / action pane). */
function linkTypeColor(def, graphSettings) {
  const gs = graphSettings || {}
  if (def.key === 'spouse') return gs.spouseColor || KIND_META.link.color
  if (def.key === 'adopted') return gs.adoptedColor || KIND_META.link.color
  if (def.key === 'parent_child') return gs.parentChildColor || KIND_META.link.color
  return def.color || gs.parentChildColor || KIND_META.link.color
}

/**
 * Resolve a stored slot descriptor into display + gating info for the wheel,
 * the HUD chip and the config editor.
 *
 * env: { relTypeByKey: Map, tagById: Map, graphSettings, caps, noun }
 * Returns { id, kind, slot, label, icon, color, hint, empty?, disabled?, disabledHint? }
 */
export function resolveWheelSlot(slot, env) {
  // Labels are translated here, at resolve time — callers resolve inside a
  // computed, so a language switch re-resolves every slot.
  const noun = nounLabel(env.noun).toLowerCase()
  const empty = {
    id: 'empty',
    empty: true,
    slot: null,
    label: t('graphWheel.addMode'),
    icon: 'plus'
  }
  if (!slot || !slot.kind) return { ...empty, color: null }
  const meta = KIND_META[slot.kind] || KIND_META.link
  const base = {
    id: slot.kind,
    kind: slot.kind,
    slot,
    icon: meta.icon,
    color: meta.color,
    label: slot.kind,
    hint: ''
  }
  switch (slot.kind) {
    case 'add':
      return {
        ...base,
        label: t('graphWheel.kinds.add.label', { noun }),
        hint: t('graphWheel.kinds.add.hint', { noun })
      }
    case 'delete':
      return {
        ...base,
        label: t('graphWheel.kinds.delete.label'),
        hint: t('graphWheel.kinds.delete.hint')
      }
    case 'pin':
      return {
        ...base,
        label: t('graphWheel.kinds.pin.label'),
        hint: t('graphWheel.kinds.pin.hint')
      }
    case 'end':
      return {
        ...base,
        label: t('graphWheel.kinds.end.label'),
        hint: t('graphWheel.kinds.end.hint')
      }
    case 'swap':
      return {
        ...base,
        label: t('graphWheel.kinds.swap.label'),
        hint: t('graphWheel.kinds.swap.hint')
      }
    case 'retime':
      return {
        ...base,
        label: t('graphWheel.kinds.retime.label'),
        hint: t('graphWheel.kinds.retime.hint')
      }
    case 'paint': {
      const color = slot.color || WHEEL_PAINT_COLORS[2]
      return {
        ...base,
        id: `paint:${color}`,
        color,
        label: t('graphWheel.kinds.paint.label'),
        hint: t('graphWheel.kinds.paint.hint'),
        disabled: env.caps && env.caps.style === 'none',
        disabledHint: t('graphWheel.kinds.paint.disabled')
      }
    }
    case 'tag': {
      const tag = env.tagById?.get(slot.tagId)
      if (!tag) return empty
      const label = defaultNameLabel(tag.label)
      return {
        ...base,
        id: `tag:${tag.id}`,
        icon: iconOr(tag.icon, meta.icon),
        color: tag.color || meta.color,
        label,
        hint: t('graphWheel.kinds.tag.hint', { tag: label }),
        disabled: env.caps ? !env.caps.tags : false,
        disabledHint: t('graphWheel.kinds.tag.disabled')
      }
    }
    case 'link': {
      const def = env.relTypeByKey?.get(slot.type)
      if (!def) return empty
      const gated = env.caps && !env.caps.relTypePicker && def.band !== 'family'
      const label = relTypeLabel(def)
      return {
        ...base,
        id: `link:${def.key}`,
        icon: iconOr(def.glyph, meta.icon),
        color: linkTypeColor(def, env.graphSettings),
        label,
        hint: t('graphWheel.kinds.link.hint', { type: label.toLowerCase() }),
        disabled: !!gated,
        disabledHint: t('graphWheel.kinds.link.disabled')
      }
    }
    default:
      return empty
  }
}

/** Resolve a whole stored config (or null → defaults) into 8 display slots. */
export function resolveWheelSlots(stored, env) {
  const raw =
    Array.isArray(stored) && stored.length === WHEEL_SLOT_COUNT ? stored : DEFAULT_WHEEL_SLOTS
  return raw.map((s) => resolveWheelSlot(s, env))
}

// ── Sector geometry ──────────────────────────────────────────────────────────
// Slot 0 points up (north) and the ring runs clockwise. Each sector spans 45°,
// centered on its direction, with a small angular gap between neighbours.

/** The angle (radians) at the CENTER of sector i, 0 = up, clockwise. */
export function sectorAngle(i) {
  return (i * Math.PI) / 4 - Math.PI / 2
}

/** Which sector a pointer offset (dx, dy from the wheel center) falls in,
 *  or null inside the dead zone. */
export function sectorFromPoint(dx, dy, deadZone = 28) {
  if (Math.hypot(dx, dy) < deadZone) return null
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI // -180..180, 0 = east
  return (Math.round((deg + 90) / 45) + WHEEL_SLOT_COUNT) % WHEEL_SLOT_COUNT
}

/** SVG path for sector i as a donut wedge between radii r0..r1 (origin 0,0). */
export function sectorPath(i, r0, r1, gap = 0.045) {
  const half = Math.PI / 8 - gap
  const c = sectorAngle(i)
  const a0 = c - half
  const a1 = c + half
  const p = (r, a) => `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`
  return [
    `M ${p(r0, a0)}`,
    `A ${r0} ${r0} 0 0 1 ${p(r0, a1)}`,
    `L ${p(r1, a1)}`,
    `A ${r1} ${r1} 0 0 0 ${p(r1, a0)}`,
    'Z'
  ].join(' ')
}

/** The centroid of sector i at radius r (for icon placement). */
export function sectorCentroid(i, r) {
  const a = sectorAngle(i)
  return { x: r * Math.cos(a), y: r * Math.sin(a) }
}

/** Unit direction of sector i — the highlight nudge direction. */
export function sectorUnit(i) {
  const a = sectorAngle(i)
  return { x: Math.cos(a), y: Math.sin(a) }
}
