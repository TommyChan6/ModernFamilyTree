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
  /** UiIcon / drawIcon name (lucideIcons.js registry). */
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
    icon: 'mouse-pointer-2',
    tools: [
      { id: 'select', icon: 'mouse-pointer-2', hotkey: 'v' },
      { id: 'pan', icon: 'hand', hotkey: 'h' },
      { id: 'erase', icon: 'eraser', hotkey: 'e' }
    ]
  },
  {
    id: 'terrain',
    icon: 'mountain',
    tools: [
      { id: 'land', icon: 'tree-palm', hotkey: 'l' },
      { id: 'water', icon: 'waves', hotkey: 'w' },
      { id: 'forest', icon: 'trees', hotkey: 'f' },
      { id: 'mountains', icon: 'mountain', hotkey: 'm' },
      { id: 'hills', icon: 'sunrise' },
      { id: 'grass', icon: 'wheat' },
      { id: 'desert', icon: 'sun' },
      { id: 'swamp', icon: 'droplets' },
      { id: 'snow', icon: 'snowflake' }
    ]
  },
  {
    id: 'realm',
    icon: 'crown',
    tools: [{ id: 'territory', icon: 'crown', hotkey: 'k' }]
  },
  {
    id: 'lines',
    icon: 'spline',
    tools: [
      { id: 'river', icon: 'spline', hotkey: 'r' },
      { id: 'road', icon: 'route', hotkey: 'd' },
      { id: 'rail', icon: 'train-front' },
      { id: 'searoute', icon: 'sailboat' },
      { id: 'wall', icon: 'brick-wall' },
      { id: 'border', icon: 'square-dashed' }
    ]
  },
  {
    id: 'places',
    icon: 'castle',
    tools: [
      { id: 'place:capital', icon: 'star', glyph: 'capital', hotkey: 'c' },
      { id: 'place:city', icon: 'building-2', glyph: 'city' },
      { id: 'place:town', icon: 'building', glyph: 'town' },
      { id: 'place:village', icon: 'house', glyph: 'village' },
      { id: 'place:castle', icon: 'castle', glyph: 'castle' },
      { id: 'place:port', icon: 'anchor', glyph: 'port' },
      { id: 'place:temple', icon: 'church', glyph: 'temple' },
      { id: 'place:tower', icon: 'tower-control', glyph: 'tower' },
      { id: 'place:ruin', icon: 'landmark', glyph: 'ruin' },
      { id: 'place:cave', icon: 'circle-dot', glyph: 'cave' },
      { id: 'place:camp', icon: 'tent', glyph: 'camp' },
      { id: 'place:mine', icon: 'pickaxe', glyph: 'mine' },
      { id: 'place:station', icon: 'warehouse', glyph: 'station' },
      { id: 'place:landmark', icon: 'milestone', glyph: 'landmark' }
    ]
  },
  {
    id: 'events',
    icon: 'swords',
    tools: [
      { id: 'event:battle', icon: 'swords', glyph: 'battle', hotkey: 'b' },
      { id: 'event:fire', icon: 'flame', glyph: 'fire' },
      { id: 'event:crown', icon: 'crown', glyph: 'crown' },
      { id: 'event:heart', icon: 'heart', glyph: 'heart' },
      { id: 'event:skull', icon: 'skull', glyph: 'skull' },
      { id: 'event:star', icon: 'sparkles', glyph: 'star' },
      { id: 'event:flag', icon: 'flag', glyph: 'flag' },
      { id: 'arrow', icon: 'arrow-up-right', hotkey: 'a' },
      { id: 'zone', icon: 'circle-dashed', hotkey: 'z' }
    ]
  },
  {
    id: 'text',
    icon: 'type',
    tools: [{ id: 'label', icon: 'type', hotkey: 't' }]
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
