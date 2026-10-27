// Auras UI catalogue — pure data + helpers (no Vue, no store, no i18n calls).
// Labels are i18n KEYS translated where they're rendered (auras.* in the
// locales). The ornament / line ids themselves come from src/shared/auras.ts.

import { AURA_ORNAMENTS, canScale } from '../../../../shared/auras'

const ORNAMENT_META = {
  none: { icon: 'ban', color: '#f5c542' },
  halo: { icon: 'sun', color: '#ffe9a3' },
  flame: { icon: 'flame', color: '#ff7a1a' },
  frost: { icon: 'snowflake', color: '#8fd8ff' },
  sparkle: { icon: 'sparkles', color: '#c9a7ff' },
  crown: { icon: 'crown', color: '#f5c542' },
  shadow: { icon: 'ghost', color: '#7a4fc0' },
  storm: { icon: 'cloud-lightning', color: '#4fe3ff' },
  bloom: { icon: 'flower-2', color: '#ff9ec7' },
  aura: { icon: 'circle-dashed', color: '#d4af37' },
  runes: { icon: 'hexagon', color: '#7fd1b9' },
  orbit: { icon: 'orbit', color: '#7aa2ff' },
  burst: { icon: 'star', color: '#ffb347' },
  pulse: { icon: 'radio', color: '#ff5d73' }
}

/** Every ornament in picker order: { id, icon, labelKey, hintKey, color }. */
export const ORNAMENTS = AURA_ORNAMENTS.map((id) => ({
  id,
  icon: ORNAMENT_META[id]?.icon || 'sparkles',
  color: ORNAMENT_META[id]?.color || '#f5c542',
  labelKey: `auras.ornaments.${id}.label`,
  hintKey: `auras.ornaments.${id}.hint`
}))

const BY_ID = new Map(ORNAMENTS.map((o) => [o.id, o]))
/** Ornament meta by id (unknown → 'none'). */
export function ornamentMeta(id) {
  return BY_ID.get(id) || BY_ID.get('none')
}

/** One-click looks: an ornament + line effect + colour (+ tint). `words` are
 *  English keywords that suggest the preset for a new tag / trait. */
export const AURA_PRESETS = [
  {
    id: 'royal',
    icon: 'crown',
    aura: { ornament: 'crown', line: 'gilded', color: '#f5c542', tint: false },
    words: ['king', 'queen', 'royal', 'crown', 'noble', 'prince', 'princess', 'lord', 'lady']
  },
  {
    id: 'saint',
    icon: 'sun',
    aura: { ornament: 'halo', line: 'stars', color: '#ffe9a3', tint: false },
    words: ['saint', 'holy', 'priest', 'church', 'blessed', 'angel', 'faith', 'monk', 'nun']
  },
  {
    id: 'inferno',
    icon: 'flame',
    aura: { ornament: 'flame', line: 'ember', color: '#ff7a1a', tint: false },
    words: ['fire', 'flame', 'burn', 'dragon', 'inferno', 'ember', 'sun']
  },
  {
    id: 'frostborn',
    icon: 'snowflake',
    aura: { ornament: 'frost', line: 'aurora', color: '#8fd8ff', tint: false },
    words: ['ice', 'frost', 'snow', 'winter', 'north', 'cold', 'glacier']
  },
  {
    id: 'arcane',
    icon: 'wand-sparkles',
    aura: { ornament: 'sparkle', line: 'neon', color: '#a77bff', tint: false },
    words: ['magic', 'mage', 'wizard', 'witch', 'arcane', 'spell', 'sorcer', 'psychic']
  },
  {
    id: 'cursed',
    icon: 'ghost',
    aura: { ornament: 'shadow', line: 'storm', color: '#6b3fa0', tint: true },
    words: ['curse', 'dark', 'shadow', 'villain', 'evil', 'death', 'undead', 'ghost', 'exile']
  },
  {
    id: 'stormcaller',
    icon: 'cloud-lightning',
    aura: { ornament: 'storm', line: 'storm', color: '#4fe3ff', tint: false },
    words: ['storm', 'thunder', 'lightning', 'sky', 'wind', 'tempest']
  },
  {
    id: 'blossom',
    icon: 'flower-2',
    aura: { ornament: 'bloom', line: 'none', color: '#ff9ec7', tint: true },
    words: ['flower', 'bloom', 'spring', 'love', 'nature', 'garden', 'healer', 'druid']
  },
  {
    id: 'bloodline',
    icon: 'droplet',
    aura: { ornament: 'pulse', line: 'blood', color: '#d6283c', tint: false },
    words: ['blood', 'heir', 'line', 'vampire', 'founder', 'dynasty', 'clan']
  }
].map((p) => ({ ...p, labelKey: `auras.presets.${p.id}` }))

/** The preset a new effect starts from: a keyword match on the source's
 *  label, else rotate through the presets (so each new effect differs). */
export function suggestPreset(label, index = 0) {
  const low = String(label || '').toLowerCase()
  if (low) {
    const hit = AURA_PRESETS.find((p) => p.words.some((w) => low.includes(w)))
    if (hit) return hit
  }
  const n = AURA_PRESETS.length
  return AURA_PRESETS[(((index | 0) % n) + n) % n]
}

/** The preset an aura currently is (exact look), or null. */
export function presetOf(aura) {
  if (!aura) return null
  const c = String(aura.color || '').toLowerCase()
  return (
    AURA_PRESETS.find(
      (p) =>
        p.aura.ornament === aura.ornament &&
        p.aura.line === aura.line &&
        p.aura.color === c &&
        p.aura.tint === !!aura.tint
    ) || null
  )
}

/** A plain-JSON copy of the four look fields. */
export function lookOf(aura) {
  return {
    ornament: aura?.ornament || 'none',
    color: aura?.color || '#f5c542',
    line: aura?.line || 'none',
    tint: !!aura?.tint
  }
}

/** True when an aura would draw nothing (the data layer treats it as none). */
export function isEmptyLook(aura) {
  return (
    !aura ||
    ((aura.ornament || 'none') === 'none' && (aura.line || 'none') === 'none' && !aura.tint)
  )
}

/** Picking a new ornament: the colour follows the ornament's own default
 *  unless the user has picked a colour of their own. */
export function colorAfterOrnament(prevOrnament, nextOrnament, color) {
  const prevDefault = ornamentMeta(prevOrnament).color
  const custom = String(color || '').toLowerCase() !== prevDefault
  return custom ? color : ornamentMeta(nextOrnament).color
}

const DATE_TYPES = new Set(['date', 'date_range'])

/** Is a rule's condition complete enough to save? (An empty "is one of" or
 *  an unbounded range would quietly fall back to "has any value".) */
export function whenComplete(when) {
  if (!when) return true
  if (when.op === 'is') return Array.isArray(when.values) && when.values.length > 0
  if (when.op === 'range') return when.min != null || when.max != null
  return true
}

/** The default condition for a new rule on a trait: a select starts on its
 *  first option ("Element is Fire"), everything else on "has any value". */
export function defaultWhen(def) {
  const first = def?.type === 'select' ? def.config?.options?.[0]?.id : null
  if (first) return { op: 'is', values: [first], min: null, max: null }
  return { op: 'any', values: [], min: null, max: null }
}

/** A short, translatable summary of a rule's condition:
 *  { key, params, scaled } — render as t(key, params) (+ the scaled note).
 *  `optionName(opt)` names a select option (pass optionLabel from dataLabels). */
export function conditionSummary(rule, def, optionName = (o) => o.label) {
  const w = rule?.when || { op: 'any', values: [], min: null, max: null }
  const scaled = !!rule?.scale && !!def && canScale(def)
  if (def?.type === 'boolean') return { key: 'auras.when.sumChecked', params: {}, scaled }
  if (w.op === 'is' && w.values?.length) {
    if (def?.type === 'select') {
      const opts = def.config?.options || []
      const names = w.values
        .map((id) => opts.find((o) => o.id === id))
        .filter(Boolean)
        .map((o) => optionName(o))
      return { key: 'auras.when.sumIs', params: { v: names.join(', ') }, scaled }
    }
    return { key: 'auras.when.sumContains', params: { v: w.values.join(', ') }, scaled }
  }
  if (w.op === 'range' && (w.min != null || w.max != null)) {
    const years = DATE_TYPES.has(def?.type)
    const params = { min: w.min ?? '', max: w.max ?? '' }
    let key
    if (w.min != null && w.max != null) key = years ? 'sumYearBetween' : 'sumBetween'
    else if (w.min != null) key = years ? 'sumYearFrom' : 'sumAtLeast'
    else key = years ? 'sumYearUntil' : 'sumAtMost'
    return { key: 'auras.when.' + key, params, scaled }
  }
  return { key: 'auras.when.sumAny', params: {}, scaled }
}

/** Hex '#rrggbb' → [r, g, b] in 0..1 (bad input → warm gold). */
export function hexToRgb01(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  const n = parseInt(m ? m[1] : 'f5c542', 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
