// Display text for the chronicle's built-in catalogs (event kinds, era preset
// packs and the eras they seed). The catalogs live in src/shared/chronicle.ts
// in English; the renderer translates them here, by id, at render time —
// falling back to the stored English label when a key is missing.
import { translate } from '../../i18n'

function tr(key, fallback, params) {
  const v = translate(key, params)
  return typeof v === 'string' && v !== key ? v : fallback
}

/** An event kind's display name (EVENT_KINDS entry or eventKind() result). */
export function kindLabel(k) {
  if (!k) return ''
  return tr(`chronicle.kinds.${k.id}`, k.label)
}

/** An era preset pack's label / hint (ERA_PACKS entry). */
export function packLabel(p) {
  return tr(`chronicle.packs.${p.id}.label`, p.label)
}
export function packHint(p) {
  return tr(`chronicle.packs.${p.id}.hint`, p.hint)
}

// 'Age of Enlightenment' → 'ageOfEnlightenment' (the preset era's key).
function seedKey(name) {
  const words = String(name || '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
  return words
    .map((w, i) =>
      i ? w.charAt(0).toUpperCase() + w.slice(1) : w.charAt(0).toLowerCase() + w.slice(1)
    )
    .join('')
}

/**
 * A preset era seed in the UI language, as it will be saved: the user then
 * owns the text like any era they typed. Centuries are numbered; the named
 * packs translate by their English name; unknown seeds pass through.
 */
export function localizeSeed(packId, seed) {
  if (packId === 'centuries') {
    const n = Math.floor((seed.start ?? 0) / 100) + 1
    const ord = String(seed.name).split(' ')[0]
    return { ...seed, name: tr('chronicle.presets.century', seed.name, { n, ord }) }
  }
  const k = `chronicle.presets.eras.${seedKey(seed.name)}`
  return {
    ...seed,
    name: tr(`${k}.name`, seed.name),
    description: tr(`${k}.description`, seed.description)
  }
}
