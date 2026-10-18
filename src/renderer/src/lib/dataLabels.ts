// Display-time translation of BUILT-IN data labels.
//
// Some labels are stored as data, in English, because the shared core seeds
// them: the built-in relationship types (and their end roles), the default
// trait set (Full name / Gender / Birth…, plus the Male/Female options), the
// project noun ('Person') and default names ('Untitled era', 'New Tag'…).
// The data layer must stay language-neutral, so these helpers translate at
// render time — but ONLY while the stored text still equals the seeded
// English default. A user's rename ("Ehefrau", "Liege") is shown verbatim.
//
// Every helper reads the active locale through `translate()`, so calling it in
// a template (or a computed) re-renders on a language switch.
import { translate as t } from '../i18n'
import { BUILTIN_REL_TYPES } from '../../../shared/relTypes'

interface RelTypeLike {
  key?: string
  label?: string
  builtin?: boolean
  role_a?: string
  role_b?: string
}
interface FieldDefLike {
  sys?: string | null
  label?: string
}
interface OptionLike {
  id?: string
  label?: string
}

const BUILTIN_BY_KEY = new Map(BUILTIN_REL_TYPES.map((s) => [s.key, s]))

/** Seeded English labels of the default trait set, keyed by `FieldDef.sys`. */
const DEFAULT_FIELD_LABELS: Record<string, string> = {
  name: 'Full name',
  gender: 'Gender',
  birth: 'Birth',
  death: 'Death',
  occupation: 'Occupation',
  location: 'Location',
  bio: 'Bio'
}

/** Default names the core gives new records → their translation keys. */
const DEFAULT_NAMES: Record<string, string> = {
  'Untitled event': 'data.defaults.untitledEvent',
  'Untitled era': 'data.defaults.untitledEra',
  'Untitled map': 'data.defaults.untitledMap',
  'New Tag': 'data.defaults.newTag',
  'Unnamed Project': 'data.defaults.unnamedProject',
  'New Scene': 'data.defaults.newScene',
  'Scene 1': 'data.defaults.scene1',
  Timeline: 'data.defaults.timeline'
}

/** A relationship type's display name (built-ins translated until renamed). */
export function relTypeLabel(def: RelTypeLike | null | undefined): string {
  if (!def) return ''
  const label = def.label || ''
  const spec = def.key ? BUILTIN_BY_KEY.get(def.key) : undefined
  if (spec && label === spec.label) return t(`data.relTypes.${spec.key}`) as string
  return label
}

/** The name of one end of a directed type ('Parent' / 'Child'…). */
export function relRoleLabel(def: RelTypeLike | null | undefined, end: 'a' | 'b'): string {
  if (!def) return ''
  const role = (end === 'a' ? def.role_a : def.role_b) || ''
  const spec = def.key ? BUILTIN_BY_KEY.get(def.key) : undefined
  const seeded = spec ? (end === 'a' ? spec.role_a : spec.role_b) : undefined
  if (spec && role && role === seeded) return t(`data.relRoles.${spec.key}.${end}`) as string
  return role
}

/** A relationship status id ('active', 'divorced', …) as display text. */
export function relStatusLabel(status: string | null | undefined): string {
  if (!status) return ''
  const v = t(`data.relStatus.${status}`) as string
  return v === `data.relStatus.${status}` ? status.charAt(0).toUpperCase() + status.slice(1) : v
}

/** A trait (FieldDef) label — the default trait set is translated until renamed. */
export function fieldLabel(def: FieldDefLike | null | undefined): string {
  if (!def) return ''
  const label = def.label || ''
  if (def.sys && DEFAULT_FIELD_LABELS[def.sys] === label)
    return t(`data.fields.${def.sys}`) as string
  return label
}

/** A select-trait option label (the seeded Male/Female options are translated). */
export function optionLabel(opt: OptionLike | null | undefined): string {
  if (!opt) return ''
  const label = opt.label || ''
  if ((opt.id === 'male' && label === 'Male') || (opt.id === 'female' && label === 'Female')) {
    return t(`data.gender.${opt.id}`) as string
  }
  return label
}

/** A gender snapshot label as stored on a person ('Male' / 'Female' / custom). */
export function genderLabel(label: string | null | undefined): string {
  if (!label) return ''
  if (label === 'Male' || label === 'male') return t('data.gender.male') as string
  if (label === 'Female' || label === 'female') return t('data.gender.female') as string
  return label
}

/** The project's noun for its entries — the default 'Person' is translated. */
export function nounLabel(noun: string | null | undefined): string {
  if (!noun || noun === 'Person') return t('data.noun.person') as string
  return noun
}

/** A record name that may still be a core default ('Untitled era', …). */
export function defaultNameLabel(name: string | null | undefined): string {
  if (!name) return ''
  const key = DEFAULT_NAMES[name]
  return key ? (t(key) as string) : name
}

/** An account's shown name — the built-in guest session's 'Guest' is translated. */
export function userNameLabel(
  user: { username?: string; display_name?: string; plan?: string } | null | undefined
): string {
  if (!user) return ''
  const name = user.display_name || user.username || ''
  if (user.plan === 'guest' && name === 'Guest') return t('data.defaults.guest') as string
  return name
}
