// The Style Studio's catalogue — pure data + helpers, no Vue/store imports.
//
// Styling lives on two LAYERS, and the studio keeps them visibly apart:
//   app  — the foundation every view paints on: theme, accent, the shared
//          palette (gender + bond colours read by every view) and the person
//          profile's presentation.
//   view — what only the current view does with that foundation (graph nodes
//          and lines, timeline lifelines, directory cards, a map's style).
// Each layer is split into CHAPTERS (one shown at a time, instead of one long
// stacked scroll). Every control has an ENTRY here so search can find it and
// jump straight to it, and chapters list the setting keys they own so the
// studio can show "tuned" dots and reset a single chapter.

export type StyleLayer = 'app' | 'view'
/** Which settings object a chapter's keys live in. */
export type StyleSource = 'graph' | 'timeline' | 'store'

export interface StyleChapter {
  id: string
  icon: string
  labelKey: string
  /** Setting keys this chapter owns (for tuned dots + chapter reset). */
  keys?: string[]
  source?: StyleSource
  /** Program-mode gate: only shown when store.caps.style equals this. */
  cap?: 'full'
}

export interface StyleEntry {
  /** 'app' or a view id ('graph', 'timeline', 'directory', 'map'). */
  scope: string
  chapter: string
  /** Matches the control row's data-skey attribute. */
  key: string
  labelKey: string
  /** Extra search words (English; the translated label is searched too). */
  words?: string
}

/** The view ids the icon rail can show, in rail order (for the reach strip). */
export const RAIL_VIEWS = ['graph', 'directory', 'relationships', 'timeline', 'groups', 'map']

export const APP_CHAPTERS: StyleChapter[] = [
  { id: 'theme', icon: 'sun-moon', labelKey: 'styleStudio.chapters.theme' },
  {
    id: 'palette',
    icon: 'palette',
    labelKey: 'styleStudio.chapters.palette',
    source: 'graph',
    keys: [
      'maleColor',
      'femaleColor',
      'unknownColor',
      'parentChildColor',
      'spouseColor',
      'adoptedColor'
    ]
  },
  { id: 'profiles', icon: 'id-card', labelKey: 'styleStudio.chapters.profiles' }
]

export const VIEW_CHAPTERS: Record<string, StyleChapter[]> = {
  graph: [
    { id: 'looks', icon: 'wand-sparkles', labelKey: 'styleStudio.chapters.looks' },
    {
      id: 'nodes',
      icon: 'circle-dot',
      labelKey: 'styleStudio.chapters.nodes',
      source: 'graph',
      keys: [
        'nodeShape',
        'nodeDecor',
        'decorColor',
        'nodeRadius',
        'nodeOpacity',
        'labelSize',
        'showLabels',
        'showAge',
        'glowOnHover'
      ]
    },
    {
      id: 'lines',
      icon: 'spline',
      labelKey: 'styleStudio.chapters.lines',
      source: 'graph',
      keys: [
        'linkRoute',
        'linkOpacity',
        'lineCurvature',
        'parentChildWidth',
        'spouseWidth',
        'adoptedWidth'
      ]
    },
    {
      id: 'effects',
      icon: 'zap',
      labelKey: 'styleStudio.chapters.effects',
      source: 'graph',
      keys: ['lineFx', 'lineFxScope', 'lineFxSpeed', 'lineFxGlow', 'lineFxKeep']
    },
    {
      id: 'air',
      icon: 'cloud',
      labelKey: 'styleStudio.chapters.air',
      source: 'graph',
      keys: ['ambientFx', 'ambientColorA', 'ambientColorB', 'ambientDensity', 'renderQuality']
    },
    {
      id: 'camera',
      icon: 'rotate-3d',
      labelKey: 'styleStudio.chapters.camera',
      source: 'graph',
      keys: ['viewTilt', 'tiltAngle', 'tiltYaw']
    },
    {
      id: 'physics',
      icon: 'atom',
      labelKey: 'styleStudio.chapters.physics',
      source: 'graph',
      keys: ['linkDistance', 'chargeStrength'],
      cap: 'full'
    }
  ],
  timeline: [
    { id: 'looks', icon: 'wand-sparkles', labelKey: 'styleStudio.chapters.looks' },
    {
      id: 'lines',
      icon: 'spline',
      labelKey: 'styleStudio.chapters.lifelines',
      source: 'timeline',
      keys: [
        'lifelineStyle',
        'lifelineWidth',
        'avatarSize',
        'shadows',
        'fxSpeed',
        'fxGlow',
        'fxKeep'
      ]
    },
    {
      id: 'canvas',
      icon: 'grid-3x3',
      labelKey: 'styleStudio.chapters.canvas',
      source: 'timeline',
      keys: ['connectors', 'grid', 'labels', 'eventMarkers', 'ageTicks', 'eraIntensity']
    },
    {
      id: 'air',
      icon: 'cloud',
      labelKey: 'styleStudio.chapters.air',
      source: 'timeline',
      keys: ['ambientFx', 'ambientColorA', 'ambientColorB', 'ambientDensity']
    }
  ],
  directory: [{ id: 'cards', icon: 'id-card', labelKey: 'styleStudio.chapters.cards' }],
  map: [{ id: 'map', icon: 'map', labelKey: 'styleStudio.chapters.mapStyle' }]
}

/** Does this view have a style layer of its own? */
export function hasViewStyle(view: string): boolean {
  return !!VIEW_CHAPTERS[view]
}

/** The chapters a layer shows, after the program-mode gate. */
export function chaptersFor(scope: string, capsStyle = 'full'): StyleChapter[] {
  const list = scope === 'app' ? APP_CHAPTERS : VIEW_CHAPTERS[scope] || []
  return list.filter((c) => !c.cap || c.cap === capsStyle)
}

const G = 'graphStyle.labels.'
const TL = 'timeline.style.'

/** Every control the studio renders, for search. Labels reuse the keys the
 *  controls already display, so search reads exactly like the panel. */
export const STYLE_ENTRIES: StyleEntry[] = [
  // ── app ──
  {
    scope: 'app',
    chapter: 'theme',
    key: 'theme',
    labelKey: 'settings.theme.title',
    words: 'dark light ink mode'
  },
  {
    scope: 'app',
    chapter: 'theme',
    key: 'accent',
    labelKey: 'settings.accent.title',
    words: 'colour color highlight'
  },
  {
    scope: 'app',
    chapter: 'palette',
    key: 'maleColor',
    labelKey: 'data.gender.male',
    words: 'gender colour color'
  },
  {
    scope: 'app',
    chapter: 'palette',
    key: 'femaleColor',
    labelKey: 'data.gender.female',
    words: 'gender colour color'
  },
  {
    scope: 'app',
    chapter: 'palette',
    key: 'unknownColor',
    labelKey: G + 'unknown',
    words: 'gender colour color'
  },
  {
    scope: 'app',
    chapter: 'palette',
    key: 'parentChildColor',
    labelKey: 'data.relTypes.parent_child',
    words: 'line bond colour color'
  },
  {
    scope: 'app',
    chapter: 'palette',
    key: 'spouseColor',
    labelKey: 'data.relTypes.spouse',
    words: 'line bond colour color'
  },
  {
    scope: 'app',
    chapter: 'palette',
    key: 'adoptedColor',
    labelKey: 'data.relTypes.adopted',
    words: 'line bond colour color'
  },
  {
    scope: 'app',
    chapter: 'profiles',
    key: 'profileStyle',
    labelKey: 'styleStudio.profile.title',
    words: 'cinematic scroll person'
  },
  // ── graph ──
  {
    scope: 'graph',
    chapter: 'looks',
    key: 'themePreset',
    labelKey: 'graphStyle.groups.themes',
    words: 'preset look'
  },
  { scope: 'graph', chapter: 'nodes', key: 'nodeShape', labelKey: G + 'shape' },
  {
    scope: 'graph',
    chapter: 'nodes',
    key: 'nodeDecor',
    labelKey: G + 'ornament',
    words: 'decor aura'
  },
  { scope: 'graph', chapter: 'nodes', key: 'nodeRadius', labelKey: G + 'nodeSize' },
  { scope: 'graph', chapter: 'nodes', key: 'nodeOpacity', labelKey: G + 'nodeOpacity' },
  {
    scope: 'graph',
    chapter: 'nodes',
    key: 'labelSize',
    labelKey: G + 'labelSize',
    words: 'name text font'
  },
  {
    scope: 'graph',
    chapter: 'nodes',
    key: 'showLabels',
    labelKey: G + 'showLabels',
    words: 'name'
  },
  { scope: 'graph', chapter: 'nodes', key: 'showAge', labelKey: G + 'showAge' },
  { scope: 'graph', chapter: 'nodes', key: 'glowOnHover', labelKey: G + 'glowOnHover' },
  {
    scope: 'graph',
    chapter: 'lines',
    key: 'linkRoute',
    labelKey: G + 'lineStyle',
    words: 'route curve elbow trident'
  },
  { scope: 'graph', chapter: 'lines', key: 'linkOpacity', labelKey: G + 'lineOpacity' },
  { scope: 'graph', chapter: 'lines', key: 'lineCurvature', labelKey: G + 'lineCurvature' },
  {
    scope: 'graph',
    chapter: 'lines',
    key: 'widths',
    labelKey: G + 'width',
    words: 'thickness line'
  },
  {
    scope: 'graph',
    chapter: 'effects',
    key: 'lineFx',
    labelKey: 'graphStyle.groups.fx',
    words: 'neon river blood shader'
  },
  { scope: 'graph', chapter: 'effects', key: 'lineFxSpeed', labelKey: G + 'speed' },
  { scope: 'graph', chapter: 'effects', key: 'lineFxGlow', labelKey: G + 'glow' },
  {
    scope: 'graph',
    chapter: 'air',
    key: 'ambientFx',
    labelKey: 'graphStyle.groups.atmosphere',
    words: 'particles fireflies snow'
  },
  {
    scope: 'graph',
    chapter: 'air',
    key: 'renderQuality',
    labelKey: 'graphStyle.performance',
    words: 'quality speed fps'
  },
  {
    scope: 'graph',
    chapter: 'camera',
    key: 'viewTilt',
    labelKey: G + 'tilt',
    words: 'perspective 3d board'
  },
  { scope: 'graph', chapter: 'camera', key: 'tiltYaw', labelKey: G + 'tiltYaw', words: 'rotate' },
  {
    scope: 'graph',
    chapter: 'physics',
    key: 'linkDistance',
    labelKey: G + 'linkDistance',
    words: 'layout force'
  },
  {
    scope: 'graph',
    chapter: 'physics',
    key: 'chargeStrength',
    labelKey: G + 'repulsion',
    words: 'layout force'
  },
  // ── timeline ──
  {
    scope: 'timeline',
    chapter: 'looks',
    key: 'looks',
    labelKey: 'styleStudio.chapters.looks',
    words: 'preset'
  },
  {
    scope: 'timeline',
    chapter: 'lines',
    key: 'lifelineStyle',
    labelKey: 'styleStudio.chapters.lifelines',
    words: 'tube glass glow effect'
  },
  {
    scope: 'timeline',
    chapter: 'lines',
    key: 'lifelineWidth',
    labelKey: TL + 'thickness',
    words: 'width'
  },
  {
    scope: 'timeline',
    chapter: 'lines',
    key: 'avatarSize',
    labelKey: TL + 'portraits',
    words: 'avatar photo'
  },
  { scope: 'timeline', chapter: 'lines', key: 'shadows', labelKey: TL + 'shadows' },
  {
    scope: 'timeline',
    chapter: 'canvas',
    key: 'connectors',
    labelKey: TL + 'segs.connectors',
    words: 'bonds'
  },
  { scope: 'timeline', chapter: 'canvas', key: 'grid', labelKey: TL + 'segs.grid', words: 'year' },
  {
    scope: 'timeline',
    chapter: 'canvas',
    key: 'labels',
    labelKey: TL + 'segs.labels',
    words: 'names'
  },
  { scope: 'timeline', chapter: 'canvas', key: 'eventMarkers', labelKey: TL + 'segs.eventMarkers' },
  { scope: 'timeline', chapter: 'canvas', key: 'ageTicks', labelKey: TL + 'ageTicks' },
  {
    scope: 'timeline',
    chapter: 'canvas',
    key: 'eraIntensity',
    labelKey: TL + 'eraWash',
    words: 'chronicle era'
  },
  {
    scope: 'timeline',
    chapter: 'air',
    key: 'ambientFx',
    labelKey: 'graphStyle.groups.atmosphere',
    words: 'particles fireflies snow'
  },
  // ── directory / map ──
  {
    scope: 'directory',
    chapter: 'cards',
    key: 'cardStyle',
    labelKey: 'directory.cardStyle.title',
    words: 'holo neon poster'
  },
  {
    scope: 'map',
    chapter: 'map',
    key: 'mapStyle',
    labelKey: 'map.menu.style',
    words: 'parchment fantasy atlas'
  },
  { scope: 'map', chapter: 'map', key: 'mapBase', labelKey: 'map.menu.ground', words: 'sea land' }
]

/** Fold case + accents so "enso" finds "Ensō" and "Farge" finds "farge". */
export function foldText(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export interface StyleHit extends StyleEntry {
  label: string
  score: number
}

/**
 * Rank entries against a query. `label(entry)` returns the entry's display
 * text in the UI language (the studio passes `t(entry.labelKey)`). Every
 * query word must match the label, the chapter name or the extra words;
 * label prefix hits rank first, then label substring, then the rest. Within
 * a score, the app layer and then `prefer` (the current view) come first.
 */
export function searchStyleEntries(
  entries: StyleEntry[],
  query: string,
  label: (e: StyleEntry) => string,
  chapterLabel: (e: StyleEntry) => string = () => '',
  prefer = ''
): StyleHit[] {
  const words = foldText(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const hits: StyleHit[] = []
  for (const e of entries) {
    const text = label(e)
    const own = foldText(text)
    const hay = own + ' ' + foldText(chapterLabel(e)) + ' ' + foldText(e.words || '')
    if (!words.every((w) => hay.includes(w))) continue
    const first = words[0]
    const score =
      own.startsWith(first) || own.includes(' ' + first) ? 0 : own.includes(first) ? 1 : 2
    hits.push({ ...e, label: text, score })
  }
  const rank = (h: StyleHit) => (h.scope === 'app' ? 0 : h.scope === prefer ? 1 : 2)
  return hits.sort((a, b) => a.score - b.score || rank(a) - rank(b))
}

/** How many of `keys` differ from their defaults (a chapter's tuned count). */
export function countTuned(
  settings: Record<string, unknown>,
  defaults: Record<string, unknown>,
  keys: string[] = []
): number {
  let n = 0
  for (const k of keys) if (k in defaults && settings[k] !== defaults[k]) n++
  return n
}

/** The defaults for just `keys` — the patch that resets one chapter. */
export function defaultsPatch(
  defaults: Record<string, unknown>,
  keys: string[] = []
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of keys) if (k in defaults) out[k] = defaults[k]
  return out
}

/**
 * Direction of travel between two chapters in a strip, for the slide
 * transition: +1 = moving right (content enters from the right).
 */
export function chapterDirection(list: StyleChapter[], from: string, to: string): 1 | -1 {
  return list.findIndex((c) => c.id === to) >= list.findIndex((c) => c.id === from) ? 1 : -1
}
