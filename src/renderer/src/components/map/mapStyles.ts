// Map styles — every visual decision the renderer makes that differs between
// looks. A style is pure data; MapRenderer.ts reads it. These colors are the
// MAP's own palette (the map is a drawn artifact, like a photo) — the app
// chrome around it still comes from the design tokens in global.css.

import { INK_FONTS } from '../../lib/inkArt'
import type { PaintSet } from './inkSprites'

export type SymbolSet = 'drawn' | 'ink' | 'tech' | 'flat'

export interface AreaPaint {
  fill: string
  /** Fill opacity (0..1). */
  alpha: number
  /** Outline color; '' = no outline. */
  stroke: string
  /** Symbol ink color for scattered glyphs (trees, peaks, dunes…). */
  mark: string
  /** Secondary mark color (shading side of peaks, tree trunks…). */
  mark2: string
}

export interface LinePaint {
  color: string
  /** Casing drawn underneath (roads/rivers); '' = none. */
  casing: string
  width: number
}

/** One world unit is one kilometre; each style measures in its own unit. */
export type MapUnitId = 'league' | 'li' | 'km'
/** Units per world unit (a league ≈ 4.8 km, a 里 ≈ 0.5 km). */
export const MAP_UNITS: Record<MapUnitId, number> = { league: 1 / 4.8, li: 2, km: 1 }

export interface MapStyle {
  id: string
  /** The distance unit its scale bar and ruler speak (see MAP_UNITS). */
  unit: MapUnitId
  icon: string
  /** The desk around the sheet in dark / light (and, optionally, ink) app themes. */
  desk: { dark: string; light: string; ink?: string }
  sea: string
  seaDeep: string
  land: string
  /** Paper grain: which procedural texture overlays the sheet. */
  grain: 'paper' | 'rice' | 'grid' | 'none'
  grainAlpha: number
  /** Concentric coast ripple colors, outermost first ([] = none). */
  ripples: string[]
  coast: string
  coastWidth: number
  /** Soft glow drawn along coasts (tech neon / ink wash); '' = none. */
  coastGlow: string
  ink: string
  halo: string
  fontTitle: string
  fontLabel: string
  upper: boolean
  symbols: SymbolSet
  areas: Record<string, AreaPaint>
  lines: Record<string, LinePaint>
  territoryAlpha: number
  territoryBorder: 'dash' | 'solid' | 'glow' | 'brush'
  frame: 'double' | 'seal' | 'tech' | 'thin' | 'ornate' | 'scroll'
  vignette: number
  ambient: {
    waves?: boolean
    clouds?: boolean
    mist?: boolean
    scan?: boolean
    radar?: boolean
    /** 山水: mist bands drifting across the mountains' feet. */
    mountainMist?: boolean
    /** 山水: a skein of geese crossing now and then. */
    geese?: boolean
    /** 山水: skiffs drifting along sea routes and rivers. */
    boats?: boolean
  }
  /** Token ring + name plate. */
  token: { ring: string; plate: string; text: string; trail: string }
  accent: string
  /** Generated worlds get Chinese place names. */
  eastern?: boolean
  /** Painted styles: terrain is drawn with sprites cut from Song paintings. */
  painting?: PaintSet
  /** The sea is a classical wave-line pattern (水纹) in this colour. */
  seaWaves?: string
  /** Coasts are written as a pressure-varying brush line. */
  coastBrush?: boolean
  /** Calligraphy labelling: CJK names run vertically, capitals are seals,
   *  people are round seals. */
  calligraphy?: boolean
  /** Scroll mounting (装裱) around the sheet; `seal` = the collector's seal text. */
  mount?: { silk: string; edge: string; roller: string; knob: string; seal: string }
}

const area = (
  fill: string,
  alpha: number,
  stroke: string,
  mark: string,
  mark2 = mark
): AreaPaint => ({
  fill,
  alpha,
  stroke,
  mark,
  mark2
})
const line = (color: string, width: number, casing = ''): LinePaint => ({ color, width, casing })

export const MAP_STYLES: Record<string, MapStyle> = {
  // ── Parchment: an explorer's chart in sepia ink ─────────────────────────────
  parchment: {
    id: 'parchment',
    unit: 'league',
    icon: 'scroll',
    desk: { dark: '#17130e', light: '#d9cfbd' },
    sea: '#d9c7a1',
    seaDeep: '#cdb78d',
    land: '#efe2c3',
    grain: 'paper',
    grainAlpha: 0.55,
    ripples: ['rgba(92,64,34,0.10)', 'rgba(92,64,34,0.16)', 'rgba(92,64,34,0.24)'],
    coast: '#4a3520',
    coastWidth: 2.2,
    coastGlow: '',
    ink: '#3d2b18',
    halo: 'rgba(239,226,195,0.85)',
    fontTitle: '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif',
    fontLabel: '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif',
    upper: false,
    symbols: 'drawn',
    areas: {
      land: area('#efe2c3', 1, '#4a3520', '#4a3520'),
      water: area('#d9c7a1', 1, '#4a3520', '#4a3520'),
      forest: area('#b9b685', 0.35, '', '#4a3a22', '#7a6a3a'),
      mountains: area('#c9b48a', 0.25, '', '#3d2b18', '#8a6d45'),
      hills: area('#d8c49a', 0.25, '', '#5a4128', '#8a6d45'),
      desert: area('#e8cf94', 0.45, '', '#8a6a35'),
      grass: area('#d9d6a0', 0.35, '', '#6a6a35'),
      swamp: area('#b7b58e', 0.4, '', '#4d5a33'),
      snow: area('#f7f2e6', 0.8, '', '#8a8170'),
      zone: area('#8b1e1e', 0.12, '#8b1e1e', '#8b1e1e')
    },
    lines: {
      river: line('#8aa0a8', 3.2, '#4a3520'),
      road: line('#6b4a2b', 1.8),
      rail: line('#2b1d10', 1.6),
      wall: line('#5a4633', 4),
      border: line('#7a2d1e', 2),
      searoute: line('#5a4633', 1.6),
      arrow: line('#8b1e1e', 7)
    },
    territoryAlpha: 0.2,
    territoryBorder: 'dash',
    frame: 'double',
    vignette: 0.35,
    ambient: { waves: true },
    token: { ring: '#3d2b18', plate: 'rgba(239,226,195,0.92)', text: '#3d2b18', trail: '#8b1e1e' },
    accent: '#8b1e1e'
  },

  // ── Fantasy: a storybook atlas in watercolor ────────────────────────────────
  fantasy: {
    id: 'fantasy',
    unit: 'league',
    icon: 'wand-sparkles',
    desk: { dark: '#0c1418', light: '#c9d8dc' },
    sea: '#5f9fb3',
    seaDeep: '#3f7f98',
    land: '#c9d59a',
    grain: 'paper',
    grainAlpha: 0.3,
    ripples: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0.26)'],
    coast: '#3b4a2a',
    coastWidth: 2,
    coastGlow: '',
    ink: '#2d2a1e',
    halo: 'rgba(255,250,230,0.8)',
    fontTitle: '"Cinzel", "Trajan Pro", "Palatino Linotype", Georgia, serif',
    fontLabel: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
    upper: false,
    symbols: 'drawn',
    areas: {
      land: area('#c9d59a', 1, '#3b4a2a', '#3b4a2a'),
      water: area('#5f9fb3', 1, '#3b4a2a', '#2d4a55'),
      forest: area('#6f9a4e', 0.45, '', '#2f5a2a', '#4f7f3a'),
      mountains: area('#a89f86', 0.35, '', '#4a4336', '#f3efe2'),
      hills: area('#b3b77a', 0.4, '', '#5f6a3a', '#dfe0b0'),
      desert: area('#e6c77f', 0.7, '', '#b08a45'),
      grass: area('#b5cf7a', 0.45, '', '#6f8a3a'),
      swamp: area('#7f9a6a', 0.5, '', '#3f5a3a'),
      snow: area('#f4f7fa', 0.9, '', '#a9b8c6'),
      zone: area('#d0342c', 0.14, '#d0342c', '#d0342c')
    },
    lines: {
      river: line('#5f9fb3', 3.4, '#2d4a55'),
      road: line('#a0784a', 2.4, '#5a4128'),
      rail: line('#3a3326', 1.8),
      wall: line('#7a756a', 4.5, '#3a3326'),
      border: line('#8b2d5a', 2.2),
      searoute: line('#fdfbf2', 1.8),
      arrow: line('#d0342c', 7)
    },
    territoryAlpha: 0.26,
    territoryBorder: 'dash',
    frame: 'ornate',
    vignette: 0.28,
    ambient: { waves: true, clouds: true },
    token: { ring: '#fdfbf2', plate: 'rgba(45,42,30,0.82)', text: '#fdfbf2', trail: '#d0342c' },
    accent: '#d0342c'
  },

  // ── Ink: 水墨 — a Chinese ink-wash landscape on rice paper ──────────────────
  ink: {
    id: 'ink',
    unit: 'li',
    icon: 'brush',
    eastern: true,
    desk: { dark: '#121212', light: '#dcd6c8' },
    sea: '#ece6d6',
    seaDeep: '#e2dac6',
    land: '#f4efe2',
    grain: 'rice',
    grainAlpha: 0.6,
    ripples: ['rgba(30,30,30,0.05)', 'rgba(30,30,30,0.08)'],
    coast: '#1d1d1d',
    coastWidth: 1.6,
    coastGlow: 'rgba(40,40,40,0.22)',
    ink: '#1a1a1a',
    halo: 'rgba(244,239,226,0.85)',
    fontTitle: '"STKaiti", "KaiTi", "Kaiti SC", "BiauKai", "DFKai-SB", "Noto Serif SC", serif',
    fontLabel: '"STKaiti", "KaiTi", "Kaiti SC", "BiauKai", "DFKai-SB", "Noto Serif SC", serif',
    upper: false,
    symbols: 'ink',
    areas: {
      land: area('#f4efe2', 1, '#1d1d1d', '#1d1d1d'),
      water: area('#ece6d6', 1, '#1d1d1d', '#555'),
      forest: area('#6f7a62', 0.12, '', '#2a3326', '#6f7a62'),
      mountains: area('#555', 0.05, '', '#1a1a1a', '#7a8a8a'),
      hills: area('#777', 0.05, '', '#333', '#9aa'),
      desert: area('#c9b48a', 0.22, '', '#7a6a4a'),
      grass: area('#8a9a6a', 0.12, '', '#5a6a4a'),
      swamp: area('#6a7a6a', 0.14, '', '#3a4a3a'),
      snow: area('#ffffff', 0.6, '', '#999'),
      zone: area('#b22222', 0.1, '#b22222', '#b22222')
    },
    lines: {
      river: line('#6a7f86', 2.6, ''),
      road: line('#5a5048', 1.3),
      rail: line('#1a1a1a', 1.4),
      wall: line('#3a3a3a', 3.5),
      border: line('#b22222', 1.6),
      searoute: line('#555', 1.3),
      arrow: line('#b22222', 6)
    },
    territoryAlpha: 0.12,
    territoryBorder: 'brush',
    frame: 'seal',
    vignette: 0.18,
    ambient: { mist: true },
    token: { ring: '#1a1a1a', plate: 'rgba(244,239,226,0.9)', text: '#1a1a1a', trail: '#b22222' },
    accent: '#b22222'
  },

  // ── Shanshui 山水: a Song ink landscape mounted as a scroll ─────────────────
  shanshui: {
    id: 'shanshui',
    unit: 'li',
    icon: 'mountain',
    eastern: true,
    painting: 'ink',
    seaWaves: 'rgba(52,58,60,0.26)',
    coastBrush: true,
    calligraphy: true,
    desk: { dark: '#151412', light: '#d8cfba', ink: '#e2d8c1' },
    sea: '#e9e1cb',
    seaDeep: '#e2d8bd',
    land: '#f1ead8',
    grain: 'rice',
    grainAlpha: 0.55,
    ripples: [],
    coast: '#1c1a17',
    coastWidth: 2.4,
    coastGlow: 'rgba(60,56,50,0.13)',
    ink: '#1c1a17',
    halo: 'rgba(241,234,216,0.82)',
    fontTitle: INK_FONTS.xing,
    fontLabel: INK_FONTS.kai,
    upper: false,
    symbols: 'ink',
    areas: {
      land: area('#f1ead8', 1, '#1c1a17', '#1c1a17'),
      water: area('#e9e1cb', 1, '#1c1a17', '#555555'),
      forest: area('#5f6b58', 0.06, '', '#2a3326', '#6f7a62'),
      mountains: area('#6e6a61', 0.04, '', '#1c1a17', '#7a7a72'),
      hills: area('#8a857a', 0.04, '', '#3a3730', '#9a968c'),
      desert: area('#c9b48a', 0.2, '', '#7a6a4a'),
      grass: area('#8a9a6a', 0.08, '', '#a3ab90'),
      swamp: area('#6a7a6a', 0.1, '', '#3a4a3a'),
      snow: area('#ffffff', 0.55, '', '#999999'),
      zone: area('#b3352a', 0.1, '#b3352a', '#b3352a')
    },
    lines: {
      river: line('#5d7075', 2.3, ''),
      road: line('#6b5f50', 1.2),
      rail: line('#1c1a17', 1.3),
      wall: line('#3a3730', 3.2),
      border: line('#b3352a', 1.5),
      searoute: line('#4a4740', 1.2),
      arrow: line('#b3352a', 6)
    },
    territoryAlpha: 0.1,
    territoryBorder: 'brush',
    frame: 'scroll',
    vignette: 0.1,
    ambient: { mountainMist: true, geese: true, boats: true },
    token: { ring: '#b3352a', plate: 'rgba(241,234,216,0.92)', text: '#1c1a17', trail: '#b3352a' },
    accent: '#b3352a',
    mount: { silk: '#cfc6ad', edge: '#a8987a', roller: '#4a3426', knob: '#e8e0cc', seal: '山水' }
  },

  // ── Qinglü 青绿: Wang Ximeng's mineral blue-green on aged silk ──────────────
  qinglu: {
    id: 'qinglu',
    unit: 'li',
    icon: 'mountain-snow',
    eastern: true,
    painting: 'qinglu',
    seaWaves: 'rgba(47,95,138,0.28)',
    coastBrush: true,
    calligraphy: true,
    desk: { dark: '#10161a', light: '#cfd3c6', ink: '#ddd4bc' },
    sea: '#e5dfc8',
    seaDeep: '#d9d6bf',
    land: '#efe3c3',
    grain: 'rice',
    grainAlpha: 0.5,
    ripples: [],
    coast: '#2b3a3c',
    coastWidth: 2.2,
    coastGlow: 'rgba(47,95,138,0.16)',
    ink: '#24282a',
    halo: 'rgba(239,227,195,0.82)',
    fontTitle: INK_FONTS.xing,
    fontLabel: INK_FONTS.kai,
    upper: false,
    symbols: 'ink',
    areas: {
      land: area('#efe3c3', 1, '#2b3a3c', '#2b3a3c'),
      water: area('#e5dfc8', 1, '#2b3a3c', '#2f5f8a'),
      forest: area('#4c8a72', 0.1, '', '#2a3a30', '#4c8a72'),
      mountains: area('#4c8a72', 0.06, '', '#2f5f8a', '#4c8a72'),
      hills: area('#7aa58a', 0.07, '', '#3d5a73', '#7aa58a'),
      desert: area('#b4884c', 0.22, '', '#8a6a3a'),
      grass: area('#8fb58a', 0.12, '', '#94b29a'),
      swamp: area('#6a8a7a', 0.14, '', '#3a5a4a'),
      snow: area('#ffffff', 0.55, '', '#99aabb'),
      zone: area('#b3352a', 0.1, '#b3352a', '#b3352a')
    },
    lines: {
      river: line('#2f5f8a', 2.4, ''),
      road: line('#8a6a3a', 1.2),
      rail: line('#24282a', 1.3),
      wall: line('#3a3730', 3.2),
      border: line('#b3352a', 1.5),
      searoute: line('#2f5f8a', 1.2),
      arrow: line('#b3352a', 6)
    },
    territoryAlpha: 0.12,
    territoryBorder: 'brush',
    frame: 'scroll',
    vignette: 0.1,
    ambient: { mountainMist: true, geese: true, boats: true },
    token: { ring: '#b3352a', plate: 'rgba(239,227,195,0.92)', text: '#24282a', trail: '#b3352a' },
    accent: '#b3352a',
    mount: { silk: '#3f5f66', edge: '#c9a86a', roller: '#3a2a20', knob: '#d9cfb0', seal: '江山' }
  },

  // ── High-tech: a holographic tactical display ───────────────────────────────
  hightech: {
    id: 'hightech',
    unit: 'km',
    icon: 'satellite',
    desk: { dark: '#03060b', light: '#0b1220', ink: '#0b1220' },
    sea: '#061321',
    seaDeep: '#040d18',
    land: '#0b2236',
    grain: 'grid',
    grainAlpha: 0.5,
    ripples: ['rgba(0,229,255,0.05)', 'rgba(0,229,255,0.08)', 'rgba(0,229,255,0.12)'],
    coast: '#27e1ff',
    coastWidth: 1.4,
    coastGlow: 'rgba(0,229,255,0.55)',
    ink: '#b6f4ff',
    halo: 'rgba(3,10,20,0.85)',
    fontTitle: '"Orbitron", "Consolas", "Cascadia Mono", "Courier New", monospace',
    fontLabel: '"Consolas", "Cascadia Mono", "SF Mono", "Courier New", monospace',
    upper: true,
    symbols: 'tech',
    areas: {
      land: area('#0b2236', 1, '#27e1ff', '#27e1ff'),
      water: area('#061321', 1, '#27e1ff', '#27e1ff'),
      forest: area('#00ff9d', 0.07, '#00ff9d', '#00ff9d'),
      mountains: area('#b388ff', 0.07, '#b388ff', '#b388ff'),
      hills: area('#7c9cff', 0.06, '#7c9cff', '#7c9cff'),
      desert: area('#ffb347', 0.07, '#ffb347', '#ffb347'),
      grass: area('#9cff57', 0.05, '#9cff57', '#9cff57'),
      swamp: area('#3dffcf', 0.06, '#3dffcf', '#3dffcf'),
      snow: area('#e0f7ff', 0.08, '#e0f7ff', '#e0f7ff'),
      zone: area('#ff3d71', 0.1, '#ff3d71', '#ff3d71')
    },
    lines: {
      river: line('#27e1ff', 1.8),
      road: line('#ffd166', 1.2),
      rail: line('#ff7ae0', 1.4),
      wall: line('#ff3d71', 2.2),
      border: line('#ff3d71', 1.4),
      searoute: line('#7c9cff', 1.2),
      arrow: line('#ff3d71', 5)
    },
    territoryAlpha: 0.12,
    territoryBorder: 'glow',
    frame: 'tech',
    vignette: 0.5,
    ambient: { scan: true, radar: true },
    token: { ring: '#27e1ff', plate: 'rgba(3,16,28,0.88)', text: '#b6f4ff', trail: '#ff3d71' },
    accent: '#27e1ff'
  },

  // ── Atlas: a clean modern political map ─────────────────────────────────────
  atlas: {
    id: 'atlas',
    unit: 'km',
    icon: 'map',
    desk: { dark: '#10141c', light: '#e6eaf0' },
    sea: '#a9d3ec',
    seaDeep: '#8fc3e3',
    land: '#f3f1ea',
    grain: 'none',
    grainAlpha: 0,
    ripples: [],
    coast: '#6a8fa6',
    coastWidth: 1.2,
    coastGlow: '',
    ink: '#29313d',
    halo: 'rgba(255,255,255,0.9)',
    fontTitle: '"Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif',
    fontLabel: '"Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif',
    upper: false,
    symbols: 'flat',
    areas: {
      land: area('#f3f1ea', 1, '#6a8fa6', '#6a8fa6'),
      water: area('#a9d3ec', 1, '#6a8fa6', '#6a8fa6'),
      forest: area('#a8d5a2', 0.75, '', '#6aa864'),
      mountains: area('#d9c8b0', 0.8, '', '#9a8468', '#fff'),
      hills: area('#e3d9c2', 0.7, '', '#b3a282'),
      desert: area('#f5e3b0', 0.85, '', '#d6b870'),
      grass: area('#d6ebb5', 0.7, '', '#9ac070'),
      swamp: area('#b9d8c4', 0.75, '', '#6aa088'),
      snow: area('#ffffff', 0.95, '', '#c0ccd8'),
      zone: area('#e53935', 0.12, '#e53935', '#e53935')
    },
    lines: {
      river: line('#6fb2dc', 2.2),
      road: line('#ffffff', 2.4, '#c9a86a'),
      rail: line('#4a4f5a', 1.8),
      wall: line('#8a6a4a', 3),
      border: line('#8a7fa0', 1.6),
      searoute: line('#4f86b3', 1.4),
      arrow: line('#e53935', 6)
    },
    territoryAlpha: 0.32,
    territoryBorder: 'solid',
    frame: 'thin',
    vignette: 0,
    ambient: {},
    token: { ring: '#ffffff', plate: 'rgba(41,49,61,0.88)', text: '#ffffff', trail: '#e53935' },
    accent: '#1e88e5'
  }
}

export const MAP_STYLE_LIST = [
  'parchment',
  'fantasy',
  'ink',
  'shanshui',
  'qinglu',
  'hightech',
  'atlas'
].map((id) => MAP_STYLES[id])

export function styleOf(id: string | undefined): MapStyle {
  return MAP_STYLES[id || ''] || MAP_STYLES.parchment
}
