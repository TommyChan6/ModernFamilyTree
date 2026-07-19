// Graph aesthetic theme presets — pure data, applied through
// store.applyGraphSettings(). A preset is a coordinated patch across the node
// shape, decor ornament, link route system, palette and atmosphere so one
// click restyles the whole canvas; every knob stays individually adjustable
// afterwards (which flips the preset chip to "custom").

export const GRAPH_THEMES = [
  {
    id: 'classic',
    name: 'Classic',
    tagline: 'The signature look — clean discs, organic lines',
    icon: '🌳',
    swatch: ['#8b6cc5', '#d4af37', '#3a7bd5'],
    settings: {
      nodeShape: 'circle',
      nodeDecor: 'none',
      decorColor: '#d4af37',
      linkRoute: 'organic',
      lineCurvature: 0.04,
      ambientFx: 'none',
      ambientColorA: '#ffd27a',
      ambientColorB: '#7ac9ff',
      ambientDensity: 0.5,
      maleColor: '#3a7bd5',
      femaleColor: '#c95fa0',
      unknownColor: '#5c6bc0',
      parentChildColor: '#8b6cc5',
      spouseColor: '#d4af37',
      adoptedColor: '#2bb3a3'
    }
  },
  {
    id: 'lineage',
    name: 'Lineage',
    tagline: 'Formal genealogy — sibling rails and couple bars',
    icon: '🏛️',
    swatch: ['#a8b2c1', '#d4af37', '#6b7f99'],
    settings: {
      nodeShape: 'square',
      nodeDecor: 'none',
      decorColor: '#c9b37e',
      linkRoute: 'trident',
      lineCurvature: 0.02,
      ambientFx: 'none',
      ambientColorA: '#e8ddc0',
      ambientColorB: '#aab6c8',
      ambientDensity: 0.4,
      maleColor: '#46689b',
      femaleColor: '#a85d7c',
      unknownColor: '#6f7d94',
      parentChildColor: '#9aa7b8',
      spouseColor: '#c9b37e',
      adoptedColor: '#79a08e'
    }
  },
  {
    id: 'storybook',
    name: 'Storybook',
    tagline: 'Fantasy — gilded shields and fireflies in the dark',
    icon: '🐉',
    swatch: ['#e8c15a', '#57a773', '#4f74c9'],
    settings: {
      nodeShape: 'shield',
      nodeDecor: 'aura',
      decorColor: '#e8c15a',
      linkRoute: 'organic',
      lineCurvature: 0.08,
      ambientFx: 'fireflies',
      ambientColorA: '#ffd27a',
      ambientColorB: '#a3e47f',
      ambientDensity: 0.55,
      maleColor: '#4f74c9',
      femaleColor: '#c95f8e',
      unknownColor: '#7a68b8',
      parentChildColor: '#b08d3f',
      spouseColor: '#e8c15a',
      adoptedColor: '#57a773'
    }
  },
  {
    id: 'neon',
    name: 'Neon Circuit',
    tagline: 'Sci-fi — hex cells on glowing traces under starlight',
    icon: '🛰️',
    swatch: ['#59f2ff', '#c86bfa', '#ff5ec4'],
    settings: {
      nodeShape: 'hexagon',
      nodeDecor: 'pulse',
      decorColor: '#59f2ff',
      linkRoute: 'circuit',
      lineCurvature: 0.0,
      ambientFx: 'stars',
      ambientColorA: '#9fdcff',
      ambientColorB: '#c86bfa',
      ambientDensity: 0.5,
      maleColor: '#38b6ff',
      femaleColor: '#ff5ec4',
      unknownColor: '#8f7bff',
      parentChildColor: '#59f2ff',
      spouseColor: '#c86bfa',
      adoptedColor: '#4ce0b3'
    }
  },
  {
    id: 'noir',
    name: 'Noir',
    tagline: 'Crime drama — hard edges, monochrome, endless rain',
    icon: '🕵️',
    swatch: ['#aab3bd', '#c25b6a', '#5c6670'],
    settings: {
      nodeShape: 'square',
      nodeDecor: 'none',
      decorColor: '#9aa3ad',
      linkRoute: 'elbow',
      lineCurvature: 0.0,
      ambientFx: 'rain',
      ambientColorA: '#9aa3ad',
      ambientColorB: '#5c6670',
      ambientDensity: 0.5,
      maleColor: '#7f8c9b',
      femaleColor: '#c25b6a',
      unknownColor: '#6b7280',
      parentChildColor: '#aab3bd',
      spouseColor: '#c25b6a',
      adoptedColor: '#7d97ad'
    }
  },
  {
    id: 'dynasty',
    name: 'Dynasty',
    tagline: '朝代 — vermillion, jade and gold; petals on the wind',
    icon: '🏮',
    swatch: ['#c04851', '#e3b341', '#3a8f7a'],
    settings: {
      nodeShape: 'octagon',
      nodeDecor: 'aura',
      decorColor: '#e3b341',
      linkRoute: 'trident',
      lineCurvature: 0.03,
      ambientFx: 'petals',
      ambientColorA: '#f2a7b3',
      ambientColorB: '#e3b341',
      ambientDensity: 0.5,
      maleColor: '#3b6ea5',
      femaleColor: '#c04851',
      unknownColor: '#7d9d8c',
      parentChildColor: '#c04851',
      spouseColor: '#e3b341',
      adoptedColor: '#3a8f7a'
    }
  },
  {
    id: 'wuxia',
    name: 'Ink & Blade',
    tagline: '武侠 — brush-stroke calm, ink motes drifting in water',
    icon: '⚔️',
    swatch: ['#6d7885', '#a5836a', '#9d6b7b'],
    settings: {
      nodeShape: 'oval',
      nodeDecor: 'runes',
      decorColor: '#8a939e',
      linkRoute: 'wave',
      lineCurvature: 0.05,
      ambientFx: 'motes',
      ambientColorA: '#aab4bd',
      ambientColorB: '#6d7680',
      ambientDensity: 0.45,
      maleColor: '#55606d',
      femaleColor: '#9d6b7b',
      unknownColor: '#75808c',
      parentChildColor: '#6d7885',
      spouseColor: '#a5836a',
      adoptedColor: '#7e9186'
    }
  },
  {
    id: 'celestial',
    name: 'Celestial',
    tagline: '仙侠 — jade crystals in arcs, spirit wisps ascending',
    icon: '🌙',
    swatch: ['#7fe7d2', '#b7a3f5', '#58a4d6'],
    settings: {
      nodeShape: 'diamond',
      nodeDecor: 'orbit',
      decorColor: '#7fe7d2',
      linkRoute: 'arc',
      lineCurvature: 0.12,
      ambientFx: 'embers',
      ambientColorA: '#7fe7d2',
      ambientColorB: '#b7a3f5',
      ambientDensity: 0.55,
      maleColor: '#58a4d6',
      femaleColor: '#d68ac9',
      unknownColor: '#8ea8c9',
      parentChildColor: '#7fe7d2',
      spouseColor: '#b7a3f5',
      adoptedColor: '#86c9a8'
    }
  },
  {
    id: 'rosewater',
    name: 'Rosewater',
    tagline: 'Romance — hearts, blush arcs and falling petals',
    icon: '🌹',
    swatch: ['#ff6f91', '#ffb3c6', '#7f9ddb'],
    settings: {
      nodeShape: 'heart',
      nodeDecor: 'pulse',
      decorColor: '#ff9db5',
      linkRoute: 'arc',
      lineCurvature: 0.1,
      ambientFx: 'petals',
      ambientColorA: '#ffb3c6',
      ambientColorB: '#ffe3ec',
      ambientDensity: 0.55,
      maleColor: '#7f9ddb',
      femaleColor: '#e87ea1',
      unknownColor: '#b98fc9',
      parentChildColor: '#e89ab5',
      spouseColor: '#ff6f91',
      adoptedColor: '#d9a7e0'
    }
  },
  {
    id: 'winter',
    name: 'Winterhold',
    tagline: 'Northern saga — burst crowns and quiet snowfall',
    icon: '❄️',
    swatch: ['#a8d8f0', '#e8f1f8', '#5b87a6'],
    settings: {
      nodeShape: 'hexagon',
      nodeDecor: 'burst',
      decorColor: '#cfe9f7',
      linkRoute: 'straight',
      lineCurvature: 0.0,
      ambientFx: 'snow',
      ambientColorA: '#e8f1f8',
      ambientColorB: '#a8d8f0',
      ambientDensity: 0.55,
      maleColor: '#5b87a6',
      femaleColor: '#a86f8e',
      unknownColor: '#7c93a8',
      parentChildColor: '#a8c6da',
      spouseColor: '#cfe9f7',
      adoptedColor: '#88b5a2'
    }
  }
]

/** The graphSettings keys a theme coordinates — changing any of them by hand
 *  flips the active preset chip to "custom". */
export const THEME_KEYS = new Set(Object.keys(GRAPH_THEMES[0].settings))
