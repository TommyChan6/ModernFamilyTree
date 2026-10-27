// Auras — special effects attached to a tag or a trait.
//
// A Tag carries at most one `aura`; a FieldDef carries a list of rules
// (`auras`), each with a condition on the trait's value ("Element is Fire",
// "Magic ≥ 60", "born 1800–1899"). Everyone who carries the tag or matches a
// rule wears the effect in the Graph and the Timeline. This module is pure:
// sanitizing (every write + every read of untrusted data), matching, and the
// per-person resolution the views draw from. No store, no DOM, no i18n.

import type {
  Aura,
  AuraOrnament,
  AuraWhen,
  DateValue,
  EntityTag,
  FieldDef,
  FieldValue,
  Tag,
  TraitAura
} from './types'

/** Ornament ids, in picker order. 'none' = no ornament (line/tint only). */
export const AURA_ORNAMENTS: readonly AuraOrnament[] = [
  'none',
  'halo',
  'flame',
  'frost',
  'sparkle',
  'crown',
  'shadow',
  'storm',
  'bloom',
  'aura',
  'runes',
  'orbit',
  'burst',
  'pulse'
]

/** Line-effect ids (must match LINE_FX in graph/webgl/lineFx.js — tested). */
export const AURA_LINES: readonly string[] = [
  'none',
  'blood',
  'river',
  'neon',
  'helix',
  'ember',
  'aurora',
  'storm',
  'stars',
  'gilded',
  'starline'
]

/** Most rules one trait may carry (one per select option is the common case). */
export const MAX_TRAIT_AURAS = 24
const MAX_WHEN_VALUES = 32
const FALLBACK_COLOR = '#f5c542'

const HEX = /^#[0-9a-f]{6}$/i

function obj(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
}
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** A clean Aura, or null when it would draw nothing (that's "no aura"). */
export function sanitizeAura(raw: unknown): Aura | null {
  if (!raw || typeof raw !== 'object') return null
  const o = obj(raw)
  const ornament = AURA_ORNAMENTS.includes(o.ornament as AuraOrnament)
    ? (o.ornament as AuraOrnament)
    : 'none'
  const line = AURA_LINES.includes(String(o.line)) ? String(o.line) : 'none'
  const tint = !!o.tint
  if (ornament === 'none' && line === 'none' && !tint) return null
  const color = HEX.test(String(o.color)) ? String(o.color).toLowerCase() : FALLBACK_COLOR
  return { ornament, color, line, tint }
}

/** The condition ops a trait type supports (first = default). */
export function whenOpsFor(def: Pick<FieldDef, 'type'>): AuraWhen['op'][] {
  switch (def.type) {
    case 'select':
    case 'text':
      return ['any', 'is']
    case 'number':
    case 'slider':
    case 'number_range':
    case 'date':
    case 'date_range':
      return ['any', 'range']
    default:
      return ['any'] // boolean (= true), custom dates
  }
}

/** Numeric traits whose value can drive the ornament's strength. */
export function canScale(def: Pick<FieldDef, 'type'>): boolean {
  return def.type === 'number' || def.type === 'slider' || def.type === 'number_range'
}

export function sanitizeWhen(raw: unknown, def: Pick<FieldDef, 'type' | 'config'>): AuraWhen {
  const o = obj(raw)
  const ops = whenOpsFor(def)
  let op = ops.includes(o.op as AuraWhen['op']) ? (o.op as AuraWhen['op']) : 'any'
  let values: string[] = []
  let min: number | null = null
  let max: number | null = null
  if (op === 'is') {
    const list = Array.isArray(o.values) ? o.values : []
    if (def.type === 'select') {
      const ids = new Set((def.config?.options || []).map((x) => x.id))
      values = [...new Set(list.map(String))].filter((v) => ids.has(v))
    } else {
      values = [...new Set(list.map((v) => String(v).trim()).filter(Boolean))]
    }
    values = values.slice(0, MAX_WHEN_VALUES)
    if (!values.length) op = 'any' // an empty "is one of" can never match
  } else if (op === 'range') {
    min = numOrNull(o.min)
    max = numOrNull(o.max)
    if (min != null && max != null && min > max) [min, max] = [max, min]
    if (min == null && max == null) op = 'any'
  }
  return { op, values, min, max }
}

/** Clean a trait's rule list against its def (dangling option ids drop out). */
export function sanitizeTraitAuras(
  raw: unknown,
  def: Pick<FieldDef, 'type' | 'config'>,
  makeId: (i: number) => string = (i) => `aura-${i}`
): TraitAura[] {
  if (!Array.isArray(raw)) return []
  const out: TraitAura[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    if (out.length >= MAX_TRAIT_AURAS) break
    const aura = sanitizeAura(r)
    if (!aura) continue
    const o = obj(r)
    let id = typeof o.id === 'string' && o.id ? o.id.slice(0, 64) : ''
    if (!id || seen.has(id)) id = makeId(out.length)
    seen.add(id)
    out.push({
      id,
      ...aura,
      when: sanitizeWhen(o.when, def),
      scale: canScale(def) && !!o.scale
    })
  }
  return out
}

// ── Matching ─────────────────────────────────────────────────────────────────

function yearOf(v: unknown): number | null {
  const y = (v as DateValue | null)?.year
  return typeof y === 'number' && Number.isFinite(y) ? y : null
}

/** The comparable number of a value (numbers, ranges' midpoint, a date's year). */
function numericOf(def: Pick<FieldDef, 'type'>, value: unknown): number | null {
  switch (def.type) {
    case 'number':
    case 'slider':
      return typeof value === 'number' && Number.isFinite(value) ? value : null
    case 'number_range': {
      const { a, b } = obj(value)
      const na = numOrNull(a)
      const nb = numOrNull(b)
      if (na == null && nb == null) return null
      return na == null ? nb : nb == null ? na : (na + nb) / 2
    }
    case 'date':
      return yearOf(value)
    case 'date_range': {
      const { from, to } = obj(value)
      const ya = yearOf(from)
      const yb = yearOf(to)
      return ya ?? yb
    }
    default:
      return null
  }
}

function hasValue(def: Pick<FieldDef, 'type'>, value: unknown): boolean {
  if (value == null) return false
  switch (def.type) {
    case 'boolean':
      return value === true
    case 'text':
      return String(value).trim() !== ''
    case 'select':
      return value !== ''
    case 'number_range':
      return numericOf(def, value) != null // { a: null, b: null } is empty
    default:
      return true
  }
}

/** How strongly a rule applies to one value: 0 = not at all, else (0, 1].
 *  Only scaled numeric rules return less than 1. */
export function matchStrength(
  rule: Pick<TraitAura, 'when' | 'scale'>,
  def: Pick<FieldDef, 'type' | 'config'>,
  value: unknown
): number {
  if (!hasValue(def, value)) return 0
  const w = rule.when
  if (w.op === 'is') {
    if (def.type === 'select') return w.values.includes(String(value)) ? 1 : 0
    const hay = String(value).toLowerCase()
    return w.values.some((v) => hay.includes(v.toLowerCase())) ? 1 : 0
  }
  const n = numericOf(def, value)
  if (w.op === 'range') {
    if (n == null) return 0
    if (w.min != null && n < w.min) return 0
    if (w.max != null && n > w.max) return 0
  }
  if (!rule.scale || n == null) return 1
  // Strength follows the value across the rule's range (or the trait's own).
  const lo = w.min ?? def.config?.min ?? null
  const hi = w.max ?? def.config?.max ?? null
  if (lo == null || hi == null || hi <= lo) return 1
  const t = Math.min(1, Math.max(0, (n - lo) / (hi - lo)))
  return 0.3 + 0.7 * t
}

// ── Resolution ───────────────────────────────────────────────────────────────

export interface AuraSource {
  kind: 'tag' | 'trait'
  /** Tag id, or the trait's def id. */
  id: string
  /** The trait rule's id (traits only). */
  ruleId?: string
}

/** What one person wears. Each slot comes from the highest-priority source
 *  that sets it, so a tag's crown and a trait's flaming lifeline combine. */
export interface ResolvedAura {
  ornament: AuraOrnament
  /** The ornament's colour. */
  color: string
  /** Ornament strength (0, 1]. */
  intensity: number
  line: string
  /** Tint colour, or null. */
  tint: string | null
  /** Every source that matched, in priority order. */
  sources: AuraSource[]
}

export interface AuraInput {
  tags: Tag[]
  entityTags: EntityTag[]
  /** Project defs; resolution follows their `order`. */
  defs: FieldDef[]
  values: FieldValue[]
  /** Restrict to these people (e.g. the project's); omit = everyone found. */
  personIds?: Iterable<string>
}

export interface AuraResolution {
  byPerson: Map<string, ResolvedAura>
  /** Bearers per source: 'tag:<id>' / 'trait:<defId>:<ruleId>'. */
  counts: Map<string, number>
}

export function sourceKey(s: AuraSource): string {
  return s.kind === 'tag' ? `tag:${s.id}` : `trait:${s.id}:${s.ruleId}`
}

interface Hit {
  tier: number
  rank: number
  aura: Aura
  strength: number
  source: AuraSource
}

/** Who wears what. Priority: specific trait rules ("is" / "range") first, then
 *  tags, then broad trait rules ("has any value"); ties follow trait order /
 *  tag order. Every input is re-sanitized, so imported data can't misbehave. */
export function resolveAuras(input: AuraInput): AuraResolution {
  const only = input.personIds ? new Set(input.personIds) : null
  const hits = new Map<string, Hit[]>()
  const counts = new Map<string, number>()
  const add = (pid: string, hit: Hit) => {
    if (only && !only.has(pid)) return
    let list = hits.get(pid)
    if (!list) hits.set(pid, (list = []))
    list.push(hit)
    const k = sourceKey(hit.source)
    counts.set(k, (counts.get(k) || 0) + 1)
  }

  // Tags → their members.
  const tagRank = new Map<string, number>()
  const tagAura = new Map<string, Aura>()
  input.tags.forEach((t, i) => {
    const a = sanitizeAura(t.aura)
    if (!a) return
    tagAura.set(t.id, a)
    tagRank.set(t.id, i)
  })
  if (tagAura.size) {
    const dup = new Set<string>()
    for (const row of input.entityTags) {
      const a = tagAura.get(row.tag_id)
      if (!a) continue
      const k = row.tag_id + '|' + row.entity_id
      if (dup.has(k)) continue
      dup.add(k)
      add(row.entity_id, {
        tier: 1,
        rank: tagRank.get(row.tag_id) as number,
        aura: a,
        strength: 1,
        source: { kind: 'tag', id: row.tag_id }
      })
    }
  }

  // Traits → people whose value matches a rule.
  const defs = [...input.defs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const ruled = new Map<string, { def: FieldDef; rules: TraitAura[]; rank: number }>()
  defs.forEach((def, i) => {
    const rules = sanitizeTraitAuras(def.auras, def)
    if (rules.length) ruled.set(def.id, { def, rules, rank: i })
  })
  if (ruled.size) {
    for (const v of input.values) {
      const r = ruled.get(v.field_id)
      if (!r) continue
      r.rules.forEach((rule, j) => {
        const strength = matchStrength(rule, r.def, v.value)
        if (!strength) return
        add(v.person_id, {
          tier: rule.when.op === 'any' ? 2 : 0,
          rank: r.rank * (MAX_TRAIT_AURAS + 1) + j,
          aura: rule,
          strength,
          source: { kind: 'trait', id: r.def.id, ruleId: rule.id }
        })
      })
    }
  }

  const byPerson = new Map<string, ResolvedAura>()
  for (const [pid, list] of hits) {
    list.sort((a, b) => a.tier - b.tier || a.rank - b.rank)
    const orn = list.find((h) => h.aura.ornament !== 'none')
    const line = list.find((h) => h.aura.line !== 'none')
    const tint = list.find((h) => h.aura.tint)
    byPerson.set(pid, {
      ornament: orn ? orn.aura.ornament : 'none',
      color: orn ? orn.aura.color : (tint?.aura.color ?? FALLBACK_COLOR),
      intensity: orn ? orn.strength : 1,
      line: line ? line.aura.line : 'none',
      tint: tint ? tint.aura.color : null,
      sources: list.map((h) => h.source)
    })
  }
  return { byPerson, counts }
}

/** The line effect a bond between two people wears: only when both carry the
 *  same one (a flaming bloodline runs between two flame-bearers). */
export function auraLineBetween(
  a: Pick<ResolvedAura, 'line'> | null | undefined,
  b: Pick<ResolvedAura, 'line'> | null | undefined
): string | null {
  if (!a || !b || a.line === 'none' || a.line !== b.line) return null
  return a.line
}
