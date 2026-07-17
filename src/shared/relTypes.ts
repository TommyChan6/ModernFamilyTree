// The relationship-type registry: every relationship's `type` string points at
// a project-scoped RelationshipTypeDef, mirroring how person traits point at
// FieldDefs. Built-in defs are seeded per project (tunable, not deletable);
// custom defs are user-created in Standard/Advanced mode. The def's `weight`
// is the structural↔affinity spectrum the force simulations read:
//   +1 pure structural (family skeleton, strong spring)
//    0 pure affinity   (decorative overlay, no layout force)
//   −1 repulsion       (rivals push apart)
// Layout hierarchy math never matches type literals — it reads symmetryRole.

import type { DB, Env, RelationshipTypeDef, SymmetryRole } from './types'

/** Picker bands (UI grouping only — no behavior attached). */
export const REL_BANDS = ['family', 'social', 'power', 'custom'] as const

type BuiltinRelTypeSpec = Omit<
  RelationshipTypeDef,
  'id' | 'project_id' | 'builtin' | 'order' | 'created_at' | 'updated_at'
>

/** The per-project seed, in canonical picker order. Keys are stable — existing
 *  relationships ('parent_child'/'spouse'/'adopted') match without rewriting.
 *  color '' = the graph Style panel's per-type color keeps driving that type
 *  (the legacy trio); every new type carries its own swatch. */
export const BUILTIN_REL_TYPES: BuiltinRelTypeSpec[] = [
  {
    key: 'parent_child',
    label: 'Parent / Child',
    weight: 1,
    directed: true,
    symmetryRole: 'vertical',
    role_a: 'Parent',
    role_b: 'Child',
    color: '',
    glyph: '↓',
    band: 'family',
    statuses: ['active']
  },
  {
    key: 'adopted',
    label: 'Adopted',
    weight: 0.95,
    directed: true,
    symmetryRole: 'vertical',
    role_a: 'Adoptive parent',
    role_b: 'Adopted child',
    color: '',
    glyph: '☂',
    band: 'family',
    statuses: ['active']
  },
  {
    key: 'spouse',
    label: 'Spouse',
    weight: 0.9,
    directed: false,
    symmetryRole: 'horizontal',
    role_a: '',
    role_b: '',
    color: '',
    glyph: '⚭',
    band: 'family',
    statuses: ['active', 'engaged', 'divorced', 'widowed']
  },
  {
    key: 'sibling',
    label: 'Sibling',
    weight: 0.7,
    directed: false,
    // NOT 'horizontal' — that would treat explicit siblings as couples in the
    // generations math. Siblings normally derive from shared parents; explicit
    // rows exist for half/step/undocumented-parent cases and only pull in the
    // force layouts.
    symmetryRole: 'none',
    role_a: '',
    role_b: '',
    color: '#58b5bc',
    glyph: '⇄',
    band: 'family',
    statuses: ['active']
  },
  {
    key: 'partner',
    label: 'Partner',
    weight: 0.8,
    directed: false,
    symmetryRole: 'horizontal',
    role_a: '',
    role_b: '',
    color: '#e0669e',
    glyph: '♥',
    band: 'social',
    statuses: ['active', 'ended']
  },
  {
    key: 'friends',
    label: 'Friend',
    weight: 0.2,
    directed: false,
    symmetryRole: 'none',
    role_a: '',
    role_b: '',
    color: '#5cb85c',
    glyph: '✦',
    band: 'social',
    statuses: ['active', 'estranged']
  },
  {
    key: 'likes',
    label: 'Likes',
    weight: 0.05,
    directed: true,
    symmetryRole: 'none',
    // a likes b: a is the admirer, b is a's crush — role names double as the
    // form's picker-chip labels ("pick their crush" / "pick their admirer").
    role_a: 'Admirer',
    role_b: 'Crush',
    color: '#e8a33d',
    glyph: '➜',
    band: 'social',
    statuses: ['active', 'ended']
  },
  {
    key: 'rival',
    label: 'Rival',
    weight: -0.3,
    directed: false,
    symmetryRole: 'none',
    role_a: '',
    role_b: '',
    color: '#d9534f',
    glyph: '⚔',
    band: 'social',
    statuses: ['active', 'resolved']
  },
  {
    key: 'mentor',
    label: 'Mentor / Student',
    weight: 0.3,
    directed: true,
    symmetryRole: 'none',
    role_a: 'Mentor',
    role_b: 'Student',
    color: '#9d7ff0',
    glyph: '★',
    band: 'power',
    statuses: ['active', 'ended']
  },
  {
    key: 'subordinate',
    label: 'Subordinate',
    weight: 0.4,
    directed: true,
    symmetryRole: 'none',
    role_a: 'Superior',
    role_b: 'Subordinate',
    color: '#8a93a6',
    glyph: '↳',
    band: 'power',
    statuses: ['active', 'ended']
  }
]

/** Coerce anything to a finite structural weight in −1..+1 (garbage → 0). */
export function clampWeight(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.max(-1, Math.min(1, n))
}

export function coerceSymmetryRole(v: unknown): SymmetryRole {
  return v === 'vertical' || v === 'horizontal' ? v : 'none'
}

export function relTypesForProject(db: DB, projectId: string): RelationshipTypeDef[] {
  return Object.values(db.rel_type_defs || {})
    .filter((d) => d.project_id === projectId)
    .sort((a, b) => a.order - b.order)
}

export function relTypeByKey(
  db: DB,
  projectId: string,
  key: string
): RelationshipTypeDef | undefined {
  return Object.values(db.rel_type_defs || {}).find(
    (d) => d.project_id === projectId && d.key === key
  )
}

/** Seed one project's built-in relationship types. No-op (false) when the
 *  project already has any defs. */
export function ensureProjectRelTypes(db: DB, projectId: string, env: Env): boolean {
  db.rel_type_defs = db.rel_type_defs || {}
  if (Object.values(db.rel_type_defs).some((d) => d.project_id === projectId)) return false
  const now = env.nowStr()
  BUILTIN_REL_TYPES.forEach((spec, i) => {
    const id = env.uuid()
    db.rel_type_defs[id] = {
      ...spec,
      statuses: [...spec.statuses],
      id,
      project_id: projectId,
      builtin: true,
      order: i,
      created_at: now,
      updated_at: now
    }
  })
  return true
}

// ── Migration: fixed relationship types → the registry ───────────────────────
// Every project gains the built-in defs; existing relationship rows already
// use built-in keys so nothing is rewritten. Idempotent per project (a project
// with any defs is skipped). Both shells run this on load.
export function migrateRelationshipTypes(db: DB, env: Env): boolean {
  let changed = false
  if (!db.rel_type_defs) {
    db.rel_type_defs = {}
    changed = true
  }
  for (const pid of Object.keys(db.projects || {})) {
    if (ensureProjectRelTypes(db, pid, env)) changed = true
  }
  return changed
}
