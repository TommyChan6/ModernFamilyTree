// Pure trait-system logic — no store, DOM, or platform dependency (mirrors
// calendarMath.ts). Everything the fields:* channels and the person form need
// to validate values, resolve slots, and derive the Person snapshot columns
// (name / graph_label / birth / death / gender / gender_t / highlight) that
// the graph, timeline and layout math keep reading unchanged.

import type {
  DB,
  DateValue,
  Env,
  FieldConfig,
  FieldDef,
  FieldType,
  FieldValue,
  Person,
  SelectOption,
  SlotName,
  Timeframe
} from './types'
import { format as formatDate, yearDate } from './calendarMath'

/** Types the user can create today (custom_date* are reserved, not creatable). */
export const CREATABLE_FIELD_TYPES: FieldType[] = [
  'text',
  'boolean',
  'number',
  'number_range',
  'select',
  'slider',
  'date',
  'date_range'
]

/** Which trait types each slot accepts ('any' = everything non-null rings). */
export const SLOT_ACCEPTS: Record<SlotName, FieldType[] | 'any'> = {
  name: ['text'],
  gender: ['select', 'slider', 'boolean', 'number_range'],
  birth: ['date', 'number', 'date_range', 'number_range', 'custom_date', 'custom_date_range'],
  death: ['date', 'number', 'date_range', 'number_range', 'custom_date', 'custom_date_range'],
  highlight: 'any'
}

export function slotAccepts(slot: SlotName, type: FieldType): boolean {
  const spec = SLOT_ACCEPTS[slot]
  return spec === 'any' || spec.includes(type)
}

/** Every slot but the name holds at most one trait. */
export function isSingleSlot(slot: SlotName): boolean {
  return slot !== 'name'
}

// ── Value coercion ────────────────────────────────────────────────────────────

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Validate a raw object into a DateValue, or null. */
function asDateValue(v: unknown): DateValue | null {
  if (!v || typeof v !== 'object') return null
  const d = v as Partial<DateValue>
  const year = numOrNull(d.year)
  if (year == null || year === 0) return null
  return {
    year,
    month: numOrNull(d.month),
    day: numOrNull(d.day),
    precision: d.precision === 'day' || d.precision === 'month' ? d.precision : 'year',
    calendar: 'gregorian'
  }
}

/** Normalize a raw form value to the def's canonical shape. null = empty /
 *  unparseable — the universal "not set". (boolean false IS a value.) */
export function coerceValue(def: FieldDef, raw: unknown): unknown {
  switch (def.type) {
    case 'text': {
      const s = raw == null ? '' : String(raw)
      return s.trim() === '' ? null : s
    }
    case 'boolean':
      return raw == null ? null : Boolean(raw)
    case 'number':
      return numOrNull(raw)
    case 'number_range': {
      const o = (raw ?? {}) as { a?: unknown; b?: unknown }
      const a = numOrNull(o.a)
      const b = numOrNull(o.b)
      return a == null && b == null ? null : { a, b }
    }
    case 'select': {
      const id = raw == null ? '' : String(raw)
      return (def.config.options || []).some((o) => o.id === id) ? id : null
    }
    case 'slider': {
      const n = numOrNull(raw)
      if (n == null) return null
      const min = def.config.min ?? 0
      const max = def.config.max ?? 100
      return Math.min(max, Math.max(min, n))
    }
    case 'date':
      return asDateValue(raw)
    case 'date_range': {
      const o = (raw ?? {}) as { from?: unknown; to?: unknown }
      const from = asDateValue(o.from)
      const to = asDateValue(o.to)
      return from == null && to == null ? null : { from, to }
    }
    default:
      return null // custom_date* — not implemented yet
  }
}

export function coerceTimeframe(raw: unknown): Timeframe | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as { from?: unknown; to?: unknown }
  const from = asDateValue(o.from)
  const to = asDateValue(o.to)
  return from == null && to == null ? null : { from, to }
}

/** Fill in type-specific config defaults and drop garbage. */
export function sanitizeConfig(type: FieldType, raw: unknown): FieldConfig {
  const c = (raw && typeof raw === 'object' ? raw : {}) as FieldConfig
  const out: FieldConfig = {}
  if (type === 'text' && c.multiline) out.multiline = true
  if (type === 'number' || type === 'slider' || type === 'number_range') {
    if (numOrNull(c.min) != null) out.min = Number(c.min)
    if (numOrNull(c.max) != null) out.max = Number(c.max)
    if (numOrNull(c.step) != null) out.step = Number(c.step)
  }
  if (type === 'slider') {
    out.min = out.min ?? 0
    out.max = out.max ?? 100
    out.step = out.step ?? 1
  }
  if (type === 'slider' || type === 'boolean') {
    if (c.leftLabel) out.leftLabel = String(c.leftLabel)
    if (c.rightLabel) out.rightLabel = String(c.rightLabel)
  }
  if (type === 'select') {
    out.options = (Array.isArray(c.options) ? c.options : []).map(
      (o: SelectOption, i: number): SelectOption => ({
        id: String(o?.id ?? o?.label ?? `opt-${i}`),
        label: String(o?.label ?? o?.id ?? `Option ${i + 1}`),
        ...(o?.color ? { color: String(o.color) } : {})
      })
    )
  }
  if (c.slotColor) out.slotColor = String(c.slotColor)
  return out
}

// ── Display formatting ────────────────────────────────────────────────────────

/** Human-readable form of a (coerced) value, used for the graph-label suffix.
 *  Empty value → ''. */
export function formatValue(def: FieldDef, value: unknown): string {
  if (value == null) return ''
  const unit = def.unit ? ` ${def.unit}` : ''
  switch (def.type) {
    case 'text':
      return String(value)
    case 'boolean':
      // A true boolean reads as the trait itself ("Knight"); false shows nothing.
      return value === true ? def.label : ''
    case 'number':
    case 'slider':
      return `${value}${unit}`
    case 'number_range': {
      const { a, b } = value as { a: number | null; b: number | null }
      return `${a ?? '?'}–${b ?? '?'}${unit}`
    }
    case 'select': {
      const opt = (def.config.options || []).find((o) => o.id === value)
      return opt ? opt.label : ''
    }
    case 'date':
      return formatDate(value as DateValue)
    case 'date_range': {
      const { from, to } = value as { from: DateValue | null; to: DateValue | null }
      return `${formatDate(from) || '?'}–${formatDate(to) || '?'}`
    }
    default:
      return ''
  }
}

// ── Slot semantics ────────────────────────────────────────────────────────────

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t))

/** Resolve a gender-slot value to a gradient position t ∈ [0,1] + a label.
 *  t: select → option index / (n−1); boolean → 0/1; slider → normalized;
 *  number_range → normalized midpoint (needs config min/max). */
export function genderInfo(def: FieldDef, value: unknown): { t: number | null; label: string } {
  if (value == null) return { t: null, label: '' }
  switch (def.type) {
    case 'select': {
      const options = def.config.options || []
      const idx = options.findIndex((o) => o.id === value)
      if (idx < 0) return { t: null, label: '' }
      const t = options.length > 1 ? idx / (options.length - 1) : 0.5
      return { t, label: options[idx].label.toLowerCase() }
    }
    case 'boolean': {
      const on = value === true
      const label = (on ? def.config.rightLabel : def.config.leftLabel) || ''
      return { t: on ? 1 : 0, label: label.toLowerCase() }
    }
    case 'slider': {
      const min = def.config.min ?? 0
      const max = def.config.max ?? 100
      const t = max > min ? clamp01(((value as number) - min) / (max - min)) : 0.5
      return { t, label: '' }
    }
    case 'number_range': {
      const { a, b } = value as { a: number | null; b: number | null }
      const mid = a != null && b != null ? (a + b) / 2 : (a ?? b)
      const { min, max } = def.config
      if (mid == null || min == null || max == null || max <= min) return { t: null, label: '' }
      return { t: clamp01((mid - min) / (max - min)), label: '' }
    }
    default:
      return { t: null, label: '' }
  }
}

/** Resolve a birth/death-slot value to the snapshot DateValue. Ranges mean
 *  uncertainty — the snapshot takes the midpoint (raw range stays on the row). */
export function dateFromValue(def: FieldDef, value: unknown): DateValue | null {
  if (value == null) return null
  switch (def.type) {
    case 'date':
      return value as DateValue
    case 'number':
      return yearDate(value as number)
    case 'number_range': {
      const { a, b } = value as { a: number | null; b: number | null }
      if (a != null && b != null) return yearDate(Math.round((a + b) / 2))
      return yearDate(a ?? b)
    }
    case 'date_range': {
      const { from, to } = value as { from: DateValue | null; to: DateValue | null }
      if (from?.year != null && to?.year != null) {
        return yearDate(Math.round((from.year + to.year) / 2))
      }
      return from ?? to
    }
    default:
      return null // custom_date* — awaiting custom calendars
  }
}

/** Highlight slot: any non-null value rings the node (boolean must be true).
 *  Color: the chosen select option's color, else the def's slotColor,
 *  else '' (theme accent). */
export function highlightFrom(def: FieldDef, value: unknown): { color: string } | null {
  if (value == null) return null
  if (def.type === 'boolean' && value !== true) return null
  let color = def.config.slotColor || ''
  if (def.type === 'select') {
    const opt = (def.config.options || []).find((o) => o.id === value)
    if (opt?.color) color = opt.color
  }
  return { color }
}

/** Lerp two #rrggbb colors — the gender-gradient node fill. */
export function lerpColorHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  if (!Number.isFinite(pa) || !Number.isFinite(pb)) return a
  const k = clamp01(t)
  const ch = (sh: number): number =>
    Math.round(((pa >> sh) & 0xff) + (((pb >> sh) & 0xff) - ((pa >> sh) & 0xff)) * k)
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`
}

// ── Snapshot composition ──────────────────────────────────────────────────────

const byOrder = (a: FieldDef, b: FieldDef): number =>
  a.order - b.order || (a.created_at > b.created_at ? 1 : -1)

/** Name-slot values joined in slot_order — the node's base name. */
export function composeName(defs: FieldDef[], valueOf: (fieldId: string) => unknown): string {
  return defs
    .filter((d) => d.slot === 'name')
    .sort((a, b) => a.slot_order - b.slot_order || byOrder(a, b))
    .map((d) => coerceValue(d, valueOf(d.id)))
    .filter((v): v is string => typeof v === 'string' && v !== '')
    .join(' ')
}

/** name + every displayed value, "Ellen Ripley · Lieutenant · 180 cm". */
export function composeGraphLabel(
  name: string,
  defs: FieldDef[],
  valueOf: (fieldId: string) => unknown,
  isDisplayed: (fieldId: string) => boolean
): string {
  const extras = defs
    .filter((d) => d.slot !== 'name' && isDisplayed(d.id))
    .sort(byOrder)
    .map((d) => formatValue(d, coerceValue(d, valueOf(d.id))))
    .filter(Boolean)
  return [name, ...extras].filter(Boolean).join(' · ')
}

// ── DB helpers (mutate in place, like dbCore handlers) ───────────────────────

export function defsForProject(db: DB, projectId: string): FieldDef[] {
  return Object.values(db.field_defs || {})
    .filter((d) => d.project_id === projectId)
    .sort(byOrder)
}

/** Map of a project's system defs (sys key → def) for the legacy adapter. */
function defsBySys(db: DB, projectId: string): Record<string, FieldDef> {
  const out: Record<string, FieldDef> = {}
  for (const d of Object.values(db.field_defs || {})) {
    if (d.project_id === projectId && d.sys) out[d.sys] = d
  }
  return out
}

export function valuesForPerson(db: DB, personId: string): FieldValue[] {
  return Object.values(db.field_values || {}).filter((v) => v.person_id === personId)
}

/** Upsert one person's value row for a def. A row with value null stays —
 *  it marks an unlocked trait as attached-but-empty. */
export function upsertValue(
  db: DB,
  env: Env,
  personId: string,
  fieldId: string,
  patch: { value?: unknown; display_in_graph?: boolean; timeframe?: unknown }
): FieldValue {
  const def = db.field_defs[fieldId]
  if (!def) throw new Error('Trait not found')
  let row = Object.values(db.field_values).find(
    (v) => v.person_id === personId && v.field_id === fieldId
  )
  const now = env.nowStr()
  if (!row) {
    row = {
      id: env.uuid(),
      person_id: personId,
      field_id: fieldId,
      value: null,
      display_in_graph: false,
      timeframe: null,
      created_at: now,
      updated_at: now
    }
    db.field_values[row.id] = row
  }
  if ('value' in patch) row.value = coerceValue(def, patch.value)
  if ('display_in_graph' in patch) row.display_in_graph = !!patch.display_in_graph
  if ('timeframe' in patch) row.timeframe = coerceTimeframe(patch.timeframe)
  row.updated_at = now
  return row
}

export function removeValue(db: DB, personId: string, fieldId: string): boolean {
  let removed = false
  for (const [id, v] of Object.entries(db.field_values || {})) {
    if (v.person_id === personId && v.field_id === fieldId) {
      delete db.field_values[id]
      removed = true
    }
  }
  return removed
}

/** Recompute the derived Person snapshot columns from trait values. Pass
 *  personIds to target specific people; omit for everyone. People in projects
 *  without defs (pre-migration) are left untouched. */
export function recomputeSnapshots(db: DB, personIds?: string[] | null): void {
  const targets = personIds
    ? personIds.map((id) => db.persons[id]).filter((p): p is Person => !!p)
    : Object.values(db.persons)
  if (targets.length === 0) return

  const defsByProject = new Map<string, FieldDef[]>()
  for (const d of Object.values(db.field_defs || {})) {
    const list = defsByProject.get(d.project_id)
    if (list) list.push(d)
    else defsByProject.set(d.project_id, [d])
  }
  const targetIds = new Set(targets.map((p) => p.id))
  const valuesByPerson = new Map<string, Map<string, FieldValue>>()
  for (const v of Object.values(db.field_values || {})) {
    if (!targetIds.has(v.person_id)) continue
    const m = valuesByPerson.get(v.person_id)
    if (m) m.set(v.field_id, v)
    else valuesByPerson.set(v.person_id, new Map([[v.field_id, v]]))
  }

  for (const p of targets) {
    const defs = defsByProject.get(p.project_id)
    if (!defs || defs.length === 0) continue
    const vals = valuesByPerson.get(p.id)
    const valueOf = (fieldId: string): unknown => vals?.get(fieldId)?.value ?? null
    const isDisplayed = (fieldId: string): boolean => !!vals?.get(fieldId)?.display_in_graph

    const name = composeName(defs, valueOf)
    p.name = name
    p.graph_label = composeGraphLabel(name, defs, valueOf, isDisplayed)

    const inSlot = (slot: SlotName): FieldDef | undefined => defs.find((d) => d.slot === slot)
    const birthDef = inSlot('birth')
    const deathDef = inSlot('death')
    const genderDef = inSlot('gender')
    const hlDef = inSlot('highlight')
    p.birth = birthDef ? dateFromValue(birthDef, coerceValue(birthDef, valueOf(birthDef.id))) : null
    p.death = deathDef ? dateFromValue(deathDef, coerceValue(deathDef, valueOf(deathDef.id))) : null
    const g = genderDef
      ? genderInfo(genderDef, coerceValue(genderDef, valueOf(genderDef.id)))
      : { t: null, label: '' }
    p.gender = g.label || 'unknown'
    p.gender_t = g.t
    p.highlight = hlDef ? highlightFrom(hlDef, coerceValue(hlDef, valueOf(hlDef.id))) : null

    // Legacy convenience columns some views still show.
    const sys = defsBySys(db, p.project_id)
    for (const key of ['bio', 'occupation', 'location'] as const) {
      if (sys[key]) p[key] = (coerceValue(sys[key], valueOf(sys[key].id)) as string) ?? ''
    }
  }
}

// ── Default defs, seeding, legacy adapter, migration ──────────────────────────

/** The trait set every project starts with (mirrors the old fixed columns). */
export function createDefaultDefs(db: DB, projectId: string, env: Env): Record<string, FieldDef> {
  db.field_defs = db.field_defs || {}
  db.field_values = db.field_values || {}
  const now = env.nowStr()
  const out: Record<string, FieldDef> = {}
  const mk = (
    sys: string,
    label: string,
    type: FieldType,
    order: number,
    extra: Partial<FieldDef> = {}
  ): void => {
    const id = env.uuid()
    const def: FieldDef = {
      id,
      project_id: projectId,
      label,
      type,
      config: {},
      locked: true,
      order,
      has_timeframe: false,
      slot: null,
      slot_order: 0,
      icon: '',
      unit: '',
      sys,
      created_at: now,
      updated_at: now,
      ...extra
    }
    db.field_defs[id] = def
    out[sys] = def
  }
  mk('name', 'Full name', 'text', 0, { slot: 'name' })
  mk('gender', 'Gender', 'select', 1, {
    slot: 'gender',
    config: {
      options: [
        { id: 'male', label: 'Male' },
        { id: 'female', label: 'Female' }
      ]
    }
  })
  mk('birth', 'Birth', 'date', 2, { slot: 'birth' })
  mk('death', 'Death', 'date', 3, { slot: 'death' })
  mk('occupation', 'Occupation', 'text', 4)
  mk('location', 'Location', 'text', 5)
  mk('bio', 'Bio', 'text', 6, { config: { multiline: true } })
  return out
}

/** Write a legacy person payload (name/birth/death/gender/bio/occupation/
 *  location keys) into the project's system defs. Only keys present in `data`
 *  are touched; empty values clear the row. This keeps the pre-trait
 *  persons:create/update contract (and the migration) on one code path. */
export function adoptLegacyPersonData(
  db: DB,
  env: Env,
  person: Person,
  data: Record<string, unknown>
): void {
  const sys = defsBySys(db, person.project_id)
  const put = (def: FieldDef | undefined, raw: unknown): void => {
    if (!def) return
    const value = coerceValue(def, raw)
    if (value == null) removeValue(db, person.id, def.id)
    else upsertValue(db, env, person.id, def.id, { value })
  }
  for (const key of ['name', 'birth', 'death', 'bio', 'occupation', 'location'] as const) {
    if (key in data) put(sys[key], data[key])
  }
  if ('gender' in data && sys.gender) {
    const label = String(data.gender ?? '').trim()
    if (!label || label.toLowerCase() === 'unknown') {
      removeValue(db, person.id, sys.gender.id)
    } else {
      const options = sys.gender.config.options || []
      let opt = options.find((o) => o.id === label || o.label.toLowerCase() === label.toLowerCase())
      if (!opt) {
        // A gender outside the configured options ('other', imports…) becomes
        // a new option so the value round-trips instead of vanishing.
        opt = { id: label.toLowerCase(), label: label[0].toUpperCase() + label.slice(1) }
        sys.gender.config.options = [...options, opt]
        sys.gender.updated_at = env.nowStr()
      }
      upsertValue(db, env, person.id, sys.gender.id, { value: opt.id })
    }
  }
}

/** Give one project its default defs and adopt its persons' legacy columns as
 *  values. No-op (false) when the project already has defs. */
export function ensureProjectFields(db: DB, projectId: string, env: Env): boolean {
  db.field_defs = db.field_defs || {}
  db.field_values = db.field_values || {}
  if (Object.values(db.field_defs).some((d) => d.project_id === projectId)) return false
  createDefaultDefs(db, projectId, env)
  const ids: string[] = []
  for (const p of Object.values(db.persons)) {
    if (p.project_id !== projectId) continue
    adoptLegacyPersonData(db, env, p, p as unknown as Record<string, unknown>)
    ids.push(p.id)
  }
  recomputeSnapshots(db, ids)
  return true
}

// ── Migration: fixed person columns → the trait system ───────────────────────
// Every project gains the default locked defs (Full name → name slot, Gender
// select → gender slot, Birth/Death dates → their slots, Occupation/Location/
// Bio as plain traits) and each person's column values become FieldValue rows.
// The columns live on as derived snapshots. Idempotent per project (a project
// with any defs is skipped). Both shells run this on load.
export function migrateFieldSystem(db: DB, env: Env): boolean {
  let changed = false
  if (!db.field_defs) {
    db.field_defs = {}
    changed = true
  }
  if (!db.field_values) {
    db.field_values = {}
    changed = true
  }
  for (const pid of Object.keys(db.projects || {})) {
    if (ensureProjectFields(db, pid, env)) changed = true
  }
  return changed
}
