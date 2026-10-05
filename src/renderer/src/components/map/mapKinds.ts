// The Map view's catalog: every drawable kind, how it's drawn (area / line /
// point), and how the toolbar groups them. Pure data — no canvas, no store.

import type { MapFeatureKind } from '../../../../shared/types'

export type MapGeometry = 'area' | 'line' | 'point'

export const MAP_KIND_GEOMETRY: Record<MapFeatureKind, MapGeometry> = {
  land: 'area',
  water: 'area',
  forest: 'area',
  mountains: 'area',
  hills: 'area',
  desert: 'area',
  grass: 'area',
  swamp: 'area',
  snow: 'area',
  territory: 'area',
  zone: 'area',
  river: 'line',
  road: 'line',
  rail: 'line',
  wall: 'line',
  border: 'line',
  searoute: 'line',
  arrow: 'line',
  place: 'point',
  label: 'point',
  event: 'point'
}

/** Paint order, bottom → top. Territories sit over terrain so their tint
 *  reads as "owned land"; lines over areas; points on top. */
export const MAP_KIND_ORDER: MapFeatureKind[] = [
  'land',
  'water',
  'grass',
  'desert',
  'snow',
  'swamp',
  'forest',
  'hills',
  'mountains',
  'territory',
  'zone',
  'river',
  'border',
  'wall',
  'road',
  'rail',
  'searoute',
  'arrow',
  'place',
  'event',
  'label'
]
export const KIND_Z: Record<string, number> = Object.fromEntries(
  MAP_KIND_ORDER.map((k, i) => [k, i])
)

/** Kinds that animate every frame (drawn in the renderer's live layer). */
export const LIVE_KINDS = new Set<MapFeatureKind>(['zone', 'arrow', 'event'])

export interface ToolDef {
  /** Tool id: a feature kind, or 'select' / 'pan' / 'erase'. */
  id: string
  icon: string
  /** Default place/event glyph when this tool draws a point. */
  glyph?: string
  hotkey?: string
}

export interface ToolGroup {
  id: string
  icon: string
  tools: ToolDef[]
}

/** The left palette. Groups open a flyout of their tools; the last tool
 *  used in a group becomes that group's face. */
export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'select',
    icon: '➤',
    tools: [
      { id: 'select', icon: '➤', hotkey: 'v' },
      { id: 'pan', icon: '✋', hotkey: 'h' },
      { id: 'erase', icon: '⌫', hotkey: 'e' }
    ]
  },
  {
    id: 'terrain',
    icon: '⛰',
    tools: [
      { id: 'land', icon: '🏝', hotkey: 'l' },
      { id: 'water', icon: '🌊', hotkey: 'w' },
      { id: 'forest', icon: '🌲', hotkey: 'f' },
      { id: 'mountains', icon: '⛰', hotkey: 'm' },
      { id: 'hills', icon: '🌄' },
      { id: 'grass', icon: '🌾' },
      { id: 'desert', icon: '🏜' },
      { id: 'swamp', icon: '🪷' },
      { id: 'snow', icon: '❄' }
    ]
  },
  {
    id: 'realm',
    icon: '👑',
    tools: [{ id: 'territory', icon: '👑', hotkey: 'k' }]
  },
  {
    id: 'lines',
    icon: '〰',
    tools: [
      { id: 'river', icon: '〰', hotkey: 'r' },
      { id: 'road', icon: '🛣', hotkey: 'd' },
      { id: 'rail', icon: '🚆' },
      { id: 'searoute', icon: '⛵' },
      { id: 'wall', icon: '🧱' },
      { id: 'border', icon: '┅' }
    ]
  },
  {
    id: 'places',
    icon: '🏰',
    tools: [
      { id: 'place:capital', icon: '⭐', glyph: 'capital', hotkey: 'c' },
      { id: 'place:city', icon: '🏙', glyph: 'city' },
      { id: 'place:town', icon: '🏘', glyph: 'town' },
      { id: 'place:village', icon: '🛖', glyph: 'village' },
      { id: 'place:castle', icon: '🏰', glyph: 'castle' },
      { id: 'place:port', icon: '⚓', glyph: 'port' },
      { id: 'place:temple', icon: '⛩', glyph: 'temple' },
      { id: 'place:tower', icon: '🗼', glyph: 'tower' },
      { id: 'place:ruin', icon: '🏛', glyph: 'ruin' },
      { id: 'place:cave', icon: '🕳', glyph: 'cave' },
      { id: 'place:camp', icon: '⛺', glyph: 'camp' },
      { id: 'place:mine', icon: '⛏', glyph: 'mine' },
      { id: 'place:station', icon: '🚉', glyph: 'station' },
      { id: 'place:landmark', icon: '🗿', glyph: 'landmark' }
    ]
  },
  {
    id: 'events',
    icon: '⚔',
    tools: [
      { id: 'event:battle', icon: '⚔', glyph: 'battle', hotkey: 'b' },
      { id: 'event:fire', icon: '🔥', glyph: 'fire' },
      { id: 'event:crown', icon: '👑', glyph: 'crown' },
      { id: 'event:heart', icon: '💞', glyph: 'heart' },
      { id: 'event:skull', icon: '☠', glyph: 'skull' },
      { id: 'event:star', icon: '✨', glyph: 'star' },
      { id: 'event:flag', icon: '🚩', glyph: 'flag' },
      { id: 'arrow', icon: '➶', hotkey: 'a' },
      { id: 'zone', icon: '◌', hotkey: 'z' }
    ]
  },
  {
    id: 'text',
    icon: '𝐓',
    tools: [{ id: 'label', icon: '𝐓', hotkey: 't' }]
  }
]

export const ALL_TOOLS: ToolDef[] = TOOL_GROUPS.flatMap((g) => g.tools)
export const TOOL_BY_ID = new Map(ALL_TOOLS.map((t) => [t.id, t]))

/** Split a tool id into the feature kind it draws + its glyph. */
export function toolKind(toolId: string): { kind: MapFeatureKind | null; glyph?: string } {
  if (toolId === 'select' || toolId === 'pan' || toolId === 'erase') return { kind: null }
  const [kind, glyph] = toolId.split(':')
  return { kind: kind as MapFeatureKind, glyph }
}

export const PLACE_GLYPHS = ALL_TOOLS.filter((t) => t.id.startsWith('place:')).map(
  (t) => t.glyph as string
)
export const EVENT_GLYPHS = ALL_TOOLS.filter((t) => t.id.startsWith('event:')).map(
  (t) => t.glyph as string
)

/** How prominent a place is — drives label size and the zoom it appears at. */
export const PLACE_RANK: Record<string, number> = {
  capital: 4,
  city: 3,
  castle: 3,
  port: 2.5,
  town: 2,
  temple: 2,
  station: 2,
  landmark: 2,
  tower: 1.5,
  ruin: 1.5,
  mine: 1.5,
  cave: 1.5,
  camp: 1,
  village: 1
}
