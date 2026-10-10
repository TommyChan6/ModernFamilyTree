// The single implementation of the app's data operations, keyed by API channel.
// Both shells consume it:
//   - Electron main (src/main/ipc.js)  — persists to the JSON file on disk
//   - browser-local backend (src/renderer/src/api/backends/local.ts) — IndexedDB
// A future HTTP/Supabase backend replaces this wholesale on the server side;
// until then this file IS the server, so desktop and web behave identically.
//
// Handlers mutate the raw DB object in place and return plain data (or throw).
// The shell wraps the result in the { success, data | error } envelope and
// persists after any channel listed in WRITE_CHANNELS.
//
// Channels NOT here (platform-specific, each shell provides its own):
//   images:openDialog — native file dialog vs <input type="file">
//   images:bytes      — fs read vs fetch of a data: URL

import type {
  AuthCtx,
  CharacterDoc,
  MapDoc,
  DB,
  EntityTag,
  Env,
  Era,
  StoryEvent,
  FieldDef,
  ImageRecord,
  Person,
  Project,
  ProjectOverview,
  PublicUser,
  Relationship,
  RelationshipTypeDef,
  Scene,
  SceneLayout,
  SceneTag,
  Session,
  SlotName,
  Tag,
  UsageInfo,
  User
} from './types'
import {
  CREATABLE_FIELD_TYPES,
  adoptLegacyPersonData,
  defsForProject,
  ensureProjectFields,
  isSingleSlot,
  recomputeSnapshots,
  removeValue,
  sanitizeConfig,
  slotAccepts,
  upsertValue,
  valuesForPerson
} from './fields'

export { migrateFieldSystem } from './fields'
import {
  clampWeight,
  coerceSymmetryRole,
  ensureProjectRelTypes,
  relTypeByKey,
  relTypesForProject
} from './relTypes'

export { migrateRelationshipTypes } from './relTypes'
import { applyMapPatch } from './maps'
import { sanitizeModel3D } from './character3d'
import { applyEraPatch, applyEventPatch } from './chronicle'
import { UNDOABLE_CHANNELS, historyHandlers, withHistory } from './history'

export { UNDOABLE_CHANNELS } from './history'
import {
  SESSION_DAYS,
  addDays,
  clearFailedLogins,
  generateSessionToken,
  hashPassword,
  isLockedOut,
  limitsFor,
  pruneSessions,
  recordFailedLogin,
  validatePassword,
  validateUsername,
  verifyPassword
} from './auth'

/** The pre-overhaul faction shape — consumed only by migrateFactionsToTags. */
interface LegacyFaction {
  id: string
  project_id: string
  scenario_id: string | null
  name: string
  color?: string
  icon?: string
  member_ids?: string[]
  x?: number
  y?: number
  visible?: boolean
  created_at: string
}
import { yearDate } from './calendarMath'
import { SHARE_ACCESS_LEVELS } from './types'
import {
  BILLING_WRITE_CHANNELS,
  EMPTY_BILLING,
  billingHandlers,
  settleSubscription
} from './billing'

function sortByDate<T extends { created_at: string }>(arr: T[]): T[] {
  return arr.slice().sort((a, b) => (a.created_at > b.created_at ? 1 : -1))
}

/** Coerce a form value to a finite number, or null (empty / garbage input). */
function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Filter a table down to rows belonging to the active project. */
function forProject<T extends { project_id: string }>(db: DB, table: Record<string, T>): T[] {
  return Object.values(table).filter((item) => item.project_id === db.activeProjectId)
}

function primaryImageOf(db: DB, personId: string): string | null {
  const primary = Object.values(db.images).find(
    (img) => img.person_id === personId && img.is_primary
  )
  return primary ? primary.file_path : null
}

export const EMPTY_DB = (): DB => ({
  users: {},
  sessions: {},
  projects: {},
  activeProjectId: null,
  persons: {},
  field_defs: {},
  field_values: {},
  relationships: {},
  rel_type_defs: {},
  tags: {},
  entity_tags: {},
  scenes: {},
  scene_tags: {},
  images: {},
  characters: {},
  maps: {},
  eras: {},
  events: {},
  settings: {},
  globalSettings: {},
  billing: EMPTY_BILLING()
})

/** Delete every entity_tags row touching the given tag or entity. */
function cascadeEntityTags(db: DB, { tagId, entityId }: { tagId?: string; entityId?: string }) {
  for (const [id, row] of Object.entries(db.entity_tags)) {
    if ((tagId && row.tag_id === tagId) || (entityId && row.entity_id === entityId)) {
      delete db.entity_tags[id]
    }
  }
}

/** Delete every scene_tags placement touching the given scene or tag. */
function cascadeSceneTags(db: DB, { sceneId, tagId }: { sceneId?: string; tagId?: string }) {
  for (const [id, row] of Object.entries(db.scene_tags)) {
    if ((sceneId && row.scene_id === sceneId) || (tagId && row.tag_id === tagId)) {
      delete db.scene_tags[id]
    }
  }
}

export function nowStr(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

// ── Migration: tree → project vocabulary ─────────────────────────────────────
// The container used to be called a "tree" (`trees`, `activeTreeId`, `tree_id`).
// Rename in place so old files keep loading. Idempotent — files already in the
// new format pass through untouched. Returns true when anything changed so the
// caller knows to persist. Both shells run this on load (db.js / local.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrateTreesToProjects(db: any): boolean {
  let changed = false
  if (db.trees) {
    db.projects = { ...db.trees, ...(db.projects || {}) }
    delete db.trees
    changed = true
  }
  if ('activeTreeId' in db) {
    db.activeProjectId = db.activeProjectId ?? db.activeTreeId
    delete db.activeTreeId
    changed = true
  }
  for (const table of ['persons', 'relationships', 'factions', 'scenarios', 'images']) {
    for (const row of Object.values(db[table] || {})) {
      const r = row as { tree_id?: string; project_id?: string }
      if ('tree_id' in r) {
        r.project_id = r.project_id ?? r.tree_id
        delete r.tree_id
        changed = true
      }
    }
  }
  return changed
}

// ── Migration: bare year numbers → DateValue ─────────────────────────────────
// Dates used to be stored as plain year numbers (`birth_year`, `death_year`,
// `formed_date`). Wrap them as year-precision Gregorian DateValues in place
// (null stays null). Idempotent — already-migrated rows pass through untouched.
// Returns true when anything changed. Both shells run this on load.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrateYearsToDateValues(db: any): boolean {
  let changed = false
  const move = (row: Record<string, unknown>, oldKey: string, newKey: string): void => {
    if (!(newKey in row)) {
      row[newKey] = yearDate(row[oldKey] as number | string | null)
      changed = true
    }
    if (oldKey in row) {
      delete row[oldKey]
      changed = true
    }
  }
  for (const p of Object.values(db.persons || {})) {
    move(p as Record<string, unknown>, 'birth_year', 'birth')
    move(p as Record<string, unknown>, 'death_year', 'death')
  }
  for (const r of Object.values(db.relationships || {})) {
    move(r as Record<string, unknown>, 'formed_date', 'formed')
  }
  return changed
}

// ── Migration: scenarios → groups scenes ─────────────────────────────────────
// The Factions view's "scenarios" became per-view Scenes. Convert each
// scenario 1:1 into a `view:'groups'` scene KEEPING ITS ID, so factions'
// `scenario_id` (and the saved activeScenarioId setting) still resolve without
// rewriting them. Idempotent; returns true when anything changed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrateScenariosToScenes(db: any): boolean {
  let changed = false
  db.scenes = db.scenes || {}
  for (const row of Object.values(db.scenarios || {})) {
    const s = row as {
      id: string
      project_id: string
      created_at: string
      updated_at: string
      name?: string
    }
    if (!db.scenes[s.id]) {
      const scene: Scene = {
        id: s.id,
        project_id: s.project_id,
        view: 'groups',
        name: s.name || 'Scenario',
        type: null,
        config: {},
        positions: {},
        created_at: s.created_at,
        updated_at: s.updated_at
      }
      db.scenes[s.id] = scene
    }
    changed = true
  }
  if ('scenarios' in db) {
    delete db.scenarios
    changed = true
  }
  return changed
}

// ── Migration: factions → tags + entity_tags + scene_tags ────────────────────
// A faction mashed two jobs together: WHO belongs (member_ids, copied per
// scenario) and WHERE it sits (x/y/visible per scenario). Split them:
//   - same-named factions across scenes collapse into ONE Tag per project
//     (name key is trimmed + case-insensitive; colour/icon come from the
//     first occurrence, oldest first)
//   - member_ids become entity_tags rows (one per distinct person↔tag pair)
//   - each faction becomes one scene_tags placement in the groups scene
//     migrated from its scenario (same id), copying x/y/visible
// The legacy factions collection is removed once converted.
// Idempotent: reruns find the tag by label and skip existing rows; once the
// factions key is gone the whole migration is a no-op.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrateFactionsToTags(db: any, env: Env): boolean {
  if (!('factions' in db)) return false
  const factions = (Object.values(db.factions || {}) as LegacyFaction[])
    .slice()
    .sort((a, b) => (a.created_at > b.created_at ? 1 : a.created_at < b.created_at ? -1 : 0))

  db.tags = db.tags || {}
  db.entity_tags = db.entity_tags || {}
  db.scene_tags = db.scene_tags || {}

  // project id + normalized name → tag id (pre-seeded with existing tags so
  // reruns and user-created tags dedupe against the same key space)
  const nameKey = (projectId: string, label: string) =>
    `${projectId}~${(label || '').trim().toLowerCase()}`
  const tagByName = new Map<string, string>()
  for (const t of Object.values(db.tags) as Tag[]) {
    const key = nameKey(t.project_id, t.label)
    if (!tagByName.has(key)) tagByName.set(key, t.id)
  }

  const hasJoin = (entityId: string, tagId: string) =>
    (Object.values(db.entity_tags) as EntityTag[]).some(
      (row) => row.entity_id === entityId && row.tag_id === tagId
    )
  const hasPlacement = (sceneId: string, tagId: string) =>
    (Object.values(db.scene_tags) as SceneTag[]).some(
      (row) => row.scene_id === sceneId && row.tag_id === tagId
    )

  for (const f of factions) {
    const key = nameKey(f.project_id, f.name)
    let tagId = tagByName.get(key)
    if (!tagId) {
      tagId = env.uuid()
      const now = env.nowStr()
      const tag: Tag = {
        id: tagId,
        project_id: f.project_id,
        label: (f.name || '').trim() || 'Unnamed',
        type: '',
        source: 'manual',
        color: f.color || '#6c8ef5',
        icon: f.icon || '',
        created_at: now,
        updated_at: now
      }
      db.tags[tagId] = tag
      tagByName.set(key, tagId)
    }
    for (const pid of f.member_ids || []) {
      if (!db.persons[pid] || hasJoin(pid, tagId)) continue
      const id = env.uuid()
      db.entity_tags[id] = { id, entity_id: pid, tag_id: tagId, created_at: env.nowStr() }
    }
    if (f.scenario_id && db.scenes[f.scenario_id] && !hasPlacement(f.scenario_id, tagId)) {
      const id = env.uuid()
      const now = env.nowStr()
      db.scene_tags[id] = {
        id,
        scene_id: f.scenario_id,
        tag_id: tagId,
        x: f.x ?? 0,
        y: f.y ?? 0,
        visible: f.visible !== false,
        created_at: now,
        updated_at: now
      }
    }
  }
  // Everything is converted — retire the legacy collection for good
  delete db.factions
  return true
}

// ── Migration: the serialized graphState setting → graph scenes ──────────────
// The Tree view used to keep its whole arrangement in one per-project setting:
// four mode buckets (custom/auto/age/generation), each holding named "states"
// with position snapshots. Flatten it: every saved state becomes ONE
// view:'graph' scene whose `type` is its former mode, carrying that state's
// node positions and any generation-row config in scene.config. The
// previously-active mode+state becomes the active graph scene (saved under the
// activeSceneId:graph setting) and the current-year override moves to its own
// userCurrentYear setting. Idempotent: a project that already has graph scenes
// is skipped. Scenes are the source of truth now, so the old graphState value
// is retired after conversion.
const MODE_TO_TYPE: Record<string, string> = {
  custom: 'free',
  auto: 'organic',
  age: 'birth',
  generation: 'generations'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrateGraphStateToScenes(db: any, env: Env): boolean {
  let changed = false
  db.scenes = db.scenes || {}
  db.settings = db.settings || {}
  for (const pid of Object.keys(db.projects || {})) {
    const stateKey = `${pid}:graphState`
    const retireBlob = () => {
      if (stateKey in db.settings) {
        delete db.settings[stateKey]
        changed = true
      }
    }
    const hasGraphScenes = (Object.values(db.scenes) as Scene[]).some(
      (s) => s.project_id === pid && s.view === 'graph'
    )
    if (hasGraphScenes) {
      retireBlob() // already migrated (or born on the new model) — drop leftovers
      continue
    }
    const raw = db.settings[stateKey]
    if (typeof raw !== 'string') continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let state: any
    try {
      state = JSON.parse(raw)
    } catch {
      retireBlob() // unreadable — nothing to convert
      continue
    }
    if (!state || typeof state !== 'object') {
      retireBlob()
      continue
    }

    // The old graphState kept a snapshot PER MODE for each saved "state" index
    // — i.e. state i already meant one arrangement that had a layout in every
    // mode. Group by that index so each becomes ONE scene holding all layout
    // types (the unified model), instead of one scene per (mode × index).
    const modes = ['custom', 'auto', 'age', 'generation']
    const stateCount = modes.reduce(
      (max, mode) =>
        Math.max(
          max,
          (state.modeStateNames?.[mode] || []).length,
          (state.modeStateSnapshots?.[mode] || []).length
        ),
      0
    )
    const activeType = MODE_TO_TYPE[state.currentMode as string] || 'organic'
    const now = env.nowStr()
    let activeSceneId: string | null = null

    for (let i = 0; i < stateCount; i++) {
      const layouts: Record<
        string,
        { positions: Record<string, { x: number; y: number }>; config: Record<string, unknown> }
      > = {}
      let sceneName = ''
      for (const mode of modes) {
        const snaps: unknown[] = state.modeStateSnapshots?.[mode] || []
        const names: string[] = state.modeStateNames?.[mode] || []
        if (names[i] && !sceneName) sceneName = names[i]
        if (i >= snaps.length) continue
        const snap = (snaps[i] || {}) as Record<string, { x?: number; y?: number } | unknown>
        const positions: Record<string, { x: number; y: number }> = {}
        for (const [key, v] of Object.entries(snap)) {
          if (key.startsWith('_')) continue
          const p = v as { x?: number; y?: number }
          if (p && typeof p.x === 'number' && typeof p.y === 'number') {
            positions[key] = { x: p.x, y: p.y }
          }
        }
        const config: Record<string, unknown> = {}
        const rows = (snap as { _genRowYValues?: number[] })._genRowYValues
        const spacing = (snap as { _genRowSpacing?: number })._genRowSpacing
        if (rows) config.genRowYValues = rows
        if (spacing) config.genRowSpacing = spacing
        else if (mode === 'generation' && state.genRowSpacing) {
          config.genRowSpacing = state.genRowSpacing
        }
        const emphasis = state.modeEmphasis?.[mode]
        if (emphasis && emphasis !== 'neutral') config.emphasis = emphasis
        layouts[MODE_TO_TYPE[mode]] = { positions, config }
      }

      const id = env.uuid()
      const active = layouts[activeType] ||
        Object.values(layouts)[0] || { positions: {}, config: {} }
      const scene: Scene = {
        id,
        project_id: pid,
        view: 'graph',
        name: sceneName || `Scene ${i + 1}`,
        type: activeType,
        config: JSON.parse(JSON.stringify(active.config)),
        positions: JSON.parse(JSON.stringify(active.positions)),
        layouts,
        created_at: now,
        updated_at: now
      }
      db.scenes[id] = scene
      // The formerly-active state index (of the active mode) stays active.
      const activeIdx = state.modeActiveStateIdx?.[state.currentMode as string] ?? 0
      if (i === activeIdx) activeSceneId = id
      changed = true
    }
    if (activeSceneId) {
      db.settings[`${pid}:activeSceneId:graph`] = activeSceneId
      changed = true
    }
    if (state.userCurrentYear != null && db.settings[`${pid}:userCurrentYear`] === undefined) {
      db.settings[`${pid}:userCurrentYear`] = state.userCurrentYear
      changed = true
    }
    retireBlob()
  }
  return changed
}

// Graph scenes gained a per-type `layouts` map (one scene holds Free/Organic/
// Birth/Generations/Space at once). Any graph scene still on the flat model
// gets its current type's arrangement folded into layouts[type]. Idempotent:
// scenes that already have `layouts` are left untouched.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrateSceneLayouts(db: any): boolean {
  let changed = false
  db.scenes = db.scenes || {}
  for (const scene of Object.values(db.scenes) as Scene[]) {
    if (scene.view !== 'graph' || scene.layouts) continue
    const type = scene.type || 'organic'
    scene.layouts = {
      [type]: {
        positions: JSON.parse(JSON.stringify(scene.positions || {})),
        config: JSON.parse(JSON.stringify(scene.config || {}))
      }
    }
    changed = true
  }
  return changed
}

// ── Sample family seeded on first run (shared so desktop and web start identical) ──
export function seedSampleData(db: DB, projectId: string, env: Env): void {
  const now = env.nowStr()
  const gp1 = env.uuid(),
    gp2 = env.uuid()
  const p1 = env.uuid(),
    p2 = env.uuid()
  const c1 = env.uuid(),
    c2 = env.uuid()

  const addP = (
    id: string,
    name: string,
    birthYear: number,
    gender: string,
    bio: string,
    occupation: string,
    location: string
  ) => {
    db.persons[id] = {
      id,
      project_id: projectId,
      name,
      birth: yearDate(birthYear),
      death: null,
      gender,
      bio,
      occupation,
      location,
      created_at: now,
      updated_at: now
    }
  }
  const addR = (a: string, b: string, type: string) => {
    const id = env.uuid()
    db.relationships[id] = {
      id,
      project_id: projectId,
      person_a_id: a,
      person_b_id: b,
      type,
      status: 'active',
      formed: null,
      created_at: now
    }
  }

  addP(
    gp1,
    'Robert Anderson',
    1948,
    'male',
    'Retired civil engineer who loved woodworking and jazz.',
    'Civil Engineer',
    'Chicago, IL'
  )
  addP(
    gp2,
    'Dorothy Anderson',
    1950,
    'female',
    'Retired school teacher with a passion for gardening.',
    'Teacher',
    'Chicago, IL'
  )
  addP(
    p1,
    'James Anderson',
    1975,
    'male',
    'Architect running his own firm in New York.',
    'Architect',
    'New York, NY'
  )
  addP(
    p2,
    'Sarah Anderson',
    1977,
    'female',
    'Pediatrician at Brooklyn General Hospital.',
    'Pediatrician',
    'New York, NY'
  )
  addP(
    c1,
    'Lucas Anderson',
    2005,
    'male',
    'High school student and basketball enthusiast.',
    'Student',
    'New York, NY'
  )
  addP(
    c2,
    'Olivia Anderson',
    2008,
    'female',
    'Middle school student who loves reading and art.',
    'Student',
    'New York, NY'
  )

  addR(gp1, gp2, 'spouse')
  addR(gp1, p1, 'parent_child')
  addR(gp2, p1, 'parent_child')
  addR(p1, p2, 'spouse')
  addR(p1, c1, 'parent_child')
  addR(p1, c2, 'parent_child')
  addR(p2, c1, 'parent_child')
  addR(p2, c2, 'parent_child')

  // Stand the project up on the trait system: default locked defs (name/
  // gender/birth/death slots + occupation/location/bio) and the sample
  // persons' columns adopted as trait values.
  ensureProjectFields(db, projectId, env)
  // …and on the relationship-type registry (built-in defs).
  ensureProjectRelTypes(db, projectId, env)
}

/** Fresh, seeded database for a first run (used by the browser-local backend). */
export function createInitialDB(env: Env): DB {
  const db = EMPTY_DB()
  const projectId = env.uuid()
  const now = env.nowStr()
  db.projects[projectId] = {
    id: projectId,
    name: 'Unnamed Project',
    created_at: now,
    updated_at: now
  }
  db.activeProjectId = projectId
  seedSampleData(db, projectId, env)
  return db
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

function publicUser(u: User): PublicUser {
  return {
    id: u.id,
    username: u.username,
    plan: u.plan,
    display_name: u.display_name ?? null,
    bio: u.bio ?? null,
    avatar_hue: u.avatar_hue ?? null,
    created_at: u.created_at
  }
}

/** All projects the user owns. Handlers scope everything else through the
 *  active project, so project ownership is the enforcement point. */
function projectsOf(db: DB, userId: string): Project[] {
  return Object.values(db.projects).filter((p) => p.user_id === userId)
}

function usageOf(db: DB, user: User): UsageInfo {
  const owned = new Set(projectsOf(db, user.id).map((p) => p.id))
  const limits = limitsFor(user)
  return {
    projects: owned.size,
    maxProjects: limits.maxProjects,
    persons: Object.values(db.persons).filter((p) => owned.has(p.project_id)).length,
    maxPersons: limits.maxPersons,
    images: Object.values(db.images).filter((img) => owned.has(img.project_id)).length,
    maxImages: limits.maxImages
  }
}

/** Point activeProjectId at a project the user owns, creating (and seeding)
 *  one when they own none — every signed-in user always has a project. */
function ensureActiveProjectFor(db: DB, user: User, env: Env): void {
  const active = db.activeProjectId ? db.projects[db.activeProjectId] : null
  if (active && active.user_id === user.id) return
  let target = projectsOf(db, user.id)[0]
  if (!target) {
    const id = env.uuid()
    const now = env.nowStr()
    target = { id, name: 'Unnamed Project', user_id: user.id, created_at: now, updated_at: now }
    db.projects[id] = target
    seedSampleData(db, id, env)
  }
  db.activeProjectId = target.id
}

function startSession(db: DB, user: User, env: Env): Session {
  const now = env.nowStr()
  const session: Session = {
    token: generateSessionToken(),
    user_id: user.id,
    created_at: now,
    expires_at: addDays(now, SESSION_DAYS)
  }
  db.sessions[session.token] = session
  return session
}

// ── Channel handlers ─────────────────────────────────────────────────────────

/** One person-payload entry point for both the legacy column contract
 *  (name/birth/death/gender/bio/occupation/location keys → system defs) and
 *  the trait contract (`values: [{ field_id, value, timeframe?,
 *  display_in_graph? }]` + `removals: [fieldId]`), then refresh the person's
 *  derived snapshot columns. */
function applyPersonPayload(db: DB, env: Env, person: Person, data: Record<string, unknown>): void {
  adoptLegacyPersonData(db, env, person, data)
  if (Array.isArray(data.values)) {
    for (const v of data.values as Array<Record<string, unknown>>) {
      const fieldId = String(v.field_id ?? v.fieldId ?? '')
      if (!db.field_defs[fieldId]) continue
      upsertValue(db, env, person.id, fieldId, v)
    }
  }
  if (Array.isArray(data.removals)) {
    for (const fieldId of data.removals as string[]) removeValue(db, person.id, fieldId)
  }
  recomputeSnapshots(db, [person.id])
}

/** Throw when adding `count` people would pass the signed-in user's plan cap. */
function assertPersonQuota(db: DB, ctx: AuthCtx | undefined, count: number): void {
  if (!ctx?.user) return
  const usage = usageOf(db, ctx.user)
  if (usage.persons + count > usage.maxPersons) {
    throw new Error(`Free plan limit reached: ${usage.maxPersons} people`)
  }
}

/** Insert a person in the active project from a create payload (legacy
 *  columns and/or a `values` array), trait values applied. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createPersonRow(db: DB, env: Env, data: Record<string, any>): Person {
  const id = env.uuid()
  const now = env.nowStr()
  const person: Person = {
    id,
    project_id: db.activeProjectId as string,
    name: data.name || '',
    birth: data.birth ?? null,
    death: data.death ?? null,
    gender: data.gender || 'unknown',
    bio: data.bio || '',
    occupation: data.occupation || '',
    location: data.location || '',
    created_at: now,
    updated_at: now
  }
  db.persons[id] = person
  applyPersonPayload(db, env, person, data)
  return person
}

/** Remove one person and everything hanging off them: relationships, trait
 *  values, images (files via env), character looks and tag memberships. */
function deletePersonCascade(db: DB, env: Env, id: string): void {
  for (const [rid, rel] of Object.entries(db.relationships)) {
    if (rel.person_a_id === id || rel.person_b_id === id) delete db.relationships[rid]
  }
  for (const [vid, v] of Object.entries(db.field_values)) {
    if (v.person_id === id) delete db.field_values[vid]
  }
  for (const [iid, img] of Object.entries(db.images)) {
    if (img.person_id === id) {
      env.removeImageFile(img.file_path)
      delete db.images[iid]
    }
  }
  for (const [cid, c] of Object.entries(db.characters || {})) {
    if (c.person_id === id) delete db.characters[cid]
  }
  // Story events outlive a participant — they just lose them from the cast.
  for (const ev of Object.values(db.events || {})) {
    if (ev.person_ids.includes(id)) ev.person_ids = ev.person_ids.filter((p) => p !== id)
  }
  cascadeEntityTags(db, { entityId: id })
  delete db.persons[id]
}

/** A fresh, empty story event (the sanitizer fills it in). */
function blankEvent(id: string, projectId: string, now: string): StoryEvent {
  return {
    id,
    project_id: projectId,
    title: 'Untitled event',
    kind: 'milestone',
    icon: '',
    color: '',
    date: null,
    end: null,
    importance: 2,
    person_ids: [],
    place: '',
    description: '',
    created_at: now,
    updated_at: now
  }
}

/** Create or patch one era in the active project (sanitized). */
function upsertEra(db: DB, data: Record<string, unknown>, env: Env): Era {
  db.eras = db.eras || {}
  const now = env.nowStr()
  const pid = db.activeProjectId as string
  const existing = data.id ? db.eras[String(data.id)] : null
  if (existing) {
    if (existing.project_id !== pid) throw new Error('Era not found')
    applyEraPatch(existing, data)
    existing.updated_at = now
    return existing
  }
  const id = env.uuid()
  const era: Era = {
    id,
    project_id: pid,
    name: 'Untitled era',
    start: null,
    end: null,
    color: '#6c8ef5',
    icon: '',
    description: '',
    created_at: now,
    updated_at: now
  }
  applyEraPatch(era, { name: '', ...data })
  db.eras[id] = era
  return era
}

/** Ids of every person in the active project (snapshot-recompute targets). */
function projectPersonIds(db: DB): string[] {
  return Object.values(db.persons)
    .filter((p) => p.project_id === db.activeProjectId)
    .map((p) => p.id)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (db: DB, data: any, env: Env, ctx?: AuthCtx) => unknown

// ── Project copy / file export / import ─────────────────────────────────────
// One remapping engine behind projects:duplicate, projects:import (a project
// file from projects:export) and anything else that needs a fresh-id copy:
// people (+ trait defs/values), relationships (+ the type registry,
// remapping custom-type keys), tags & memberships, scenes (+ placements,
// with position/style keys remapped onto the new person ids), characters,
// maps and project-scoped settings. Photos are NOT copied — image files belong
// to the source, and deleting a copy must never remove the original's files.
function copyProjectInto(
  src: DB,
  srcId: string,
  dst: DB,
  env: Env,
  overrides: Partial<Project>
): Project {
  const srcProject = src.projects[srcId]
  const now = env.nowStr()
  const pid = env.uuid()
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
  const project: Project = {
    ...clone(srcProject),
    ...overrides,
    id: pid,
    created_at: now,
    updated_at: now
  }
  dst.projects[pid] = project

  const personIds = new Map<string, string>()
  for (const p of Object.values(src.persons)) {
    if (p.project_id !== srcId) continue
    const id = env.uuid()
    personIds.set(p.id, id)
    dst.persons[id] = { ...clone(p), id, project_id: pid }
  }
  const defIds = new Map<string, string>()
  for (const def of Object.values(src.field_defs)) {
    if (def.project_id !== srcId) continue
    const id = env.uuid()
    defIds.set(def.id, id)
    dst.field_defs[id] = { ...clone(def), id, project_id: pid }
  }
  for (const v of Object.values(src.field_values)) {
    const personId = personIds.get(v.person_id)
    const fieldId = defIds.get(v.field_id)
    if (!personId || !fieldId) continue
    const id = env.uuid()
    dst.field_values[id] = { ...clone(v), id, person_id: personId, field_id: fieldId }
  }
  // Custom relationship types use their id as their key, so remap both;
  // builtin keys ('spouse', …) stay stable across projects.
  const typeKeys = new Map<string, string>()
  for (const def of Object.values(src.rel_type_defs || {})) {
    if (def.project_id !== srcId) continue
    const id = env.uuid()
    const key = def.builtin ? def.key : id
    typeKeys.set(def.key, key)
    dst.rel_type_defs[id] = { ...clone(def), id, key, project_id: pid }
  }
  const relIds = new Map<string, string>()
  for (const r of Object.values(src.relationships)) {
    if (r.project_id !== srcId) continue
    const a = personIds.get(r.person_a_id)
    const b = personIds.get(r.person_b_id)
    if (!a || !b) continue
    const id = env.uuid()
    relIds.set(r.id, id)
    dst.relationships[id] = {
      ...clone(r),
      id,
      project_id: pid,
      person_a_id: a,
      person_b_id: b,
      type: typeKeys.get(r.type) ?? r.type
    }
  }
  const tagIds = new Map<string, string>()
  for (const t of Object.values(src.tags)) {
    if (t.project_id !== srcId) continue
    const id = env.uuid()
    tagIds.set(t.id, id)
    dst.tags[id] = { ...clone(t), id, project_id: pid }
  }
  for (const et of Object.values(src.entity_tags)) {
    const entityId = personIds.get(et.entity_id)
    const tagId = tagIds.get(et.tag_id)
    if (!entityId || !tagId) continue
    const id = env.uuid()
    dst.entity_tags[id] = { ...clone(et), id, entity_id: entityId, tag_id: tagId }
  }
  // Position/style records inside scenes are keyed by person id.
  const remapKeys = (rec: unknown): unknown => {
    if (!rec || typeof rec !== 'object') return rec
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(rec as Record<string, unknown>)) {
      out[personIds.get(k) ?? k] = v
    }
    return out
  }
  const sceneIds = new Map<string, string>()
  for (const s of Object.values(src.scenes)) {
    if (s.project_id !== srcId) continue
    const id = env.uuid()
    sceneIds.set(s.id, id)
    const scene: Scene = { ...clone(s), id, project_id: pid }
    scene.positions = remapKeys(scene.positions) as Scene['positions']
    if (scene.layouts) {
      // Besides the per-type arrangements, the graph keeps two scene-wide
      // maps in the same bag: `styles` (per-node overrides, by person id)
      // and `curves` (hand-shaped bezier links, by relationship id — each
      // remembering the person it was shaped from as `s`).
      const bag = scene.layouts as Record<string, unknown>
      if (bag.styles) bag.styles = remapKeys(bag.styles)
      if (bag.curves && typeof bag.curves === 'object') {
        const curves: Record<string, unknown> = {}
        for (const [relId, rec] of Object.entries(bag.curves as Record<string, unknown>)) {
          const newRel = relIds.get(relId)
          if (!newRel || !rec || typeof rec !== 'object') continue
          const c = rec as { s?: string }
          curves[newRel] = { ...c, ...(c.s ? { s: personIds.get(c.s) ?? c.s } : {}) }
        }
        bag.curves = curves
      }
      for (const [key, layout] of Object.entries(scene.layouts)) {
        if (key === 'styles' || key === 'curves') continue
        layout.positions = remapKeys(layout.positions) as SceneLayout['positions']
        const extra = layout as SceneLayout & { styles?: unknown }
        if (extra.styles) extra.styles = remapKeys(extra.styles)
      }
    }
    dst.scenes[id] = scene
  }
  for (const st of Object.values(src.scene_tags)) {
    const sceneId = sceneIds.get(st.scene_id)
    const tagId = tagIds.get(st.tag_id)
    if (!sceneId || !tagId) continue
    const id = env.uuid()
    dst.scene_tags[id] = { ...clone(st), id, scene_id: sceneId, tag_id: tagId }
  }
  for (const c of Object.values(src.characters || {})) {
    if (c.project_id !== srcId) continue
    const personId = personIds.get(c.person_id)
    if (!personId) continue
    const id = env.uuid()
    dst.characters[id] = { ...clone(c), id, project_id: pid, person_id: personId }
  }
  // Maps carry over with their people tokens and tag links remapped (tokens
  // of people that no longer exist are dropped rather than copied as orphans).
  for (const m of Object.values(src.maps || {})) {
    if (m.project_id !== srcId) continue
    const id = env.uuid()
    const copy: MapDoc = { ...clone(m), id, project_id: pid }
    copy.tokens = copy.tokens
      .filter((tk) => personIds.has(tk.person_id))
      .map((tk) => ({ ...tk, id: env.uuid(), person_id: personIds.get(tk.person_id) as string }))
    copy.features = copy.features.map((f) =>
      f.tag_id ? { ...f, tag_id: tagIds.get(f.tag_id) ?? null } : f
    )
    dst.maps = dst.maps || {}
    dst.maps[id] = copy
  }
  // The chronicle: eras as-is, events with their cast remapped (people that no
  // longer exist simply leave the cast).
  for (const e of Object.values(src.eras || {})) {
    if (e.project_id !== srcId) continue
    const id = env.uuid()
    dst.eras = dst.eras || {}
    dst.eras[id] = { ...clone(e), id, project_id: pid }
  }
  for (const ev of Object.values(src.events || {})) {
    if (ev.project_id !== srcId) continue
    const id = env.uuid()
    dst.events = dst.events || {}
    dst.events[id] = {
      ...clone(ev),
      id,
      project_id: pid,
      person_ids: (ev.person_ids || [])
        .filter((p) => personIds.has(p))
        .map((p) => personIds.get(p) as string)
    }
  }
  // Project-scoped settings carry over (noun, wheel slots, active scenes —
  // with scene-id values remapped), except the checkpoint: its snapshot
  // references the source project's rows.
  for (const [key, value] of Object.entries(src.settings || {})) {
    if (!key.startsWith(`${srcId}:`)) continue
    const rest = key.slice(srcId.length + 1)
    if (rest === 'checkpoint') continue
    const mapped = typeof value === 'string' && sceneIds.has(value) ? sceneIds.get(value) : value
    dst.settings[`${pid}:${rest}`] = clone(mapped)
  }
  return project
}

/** The on-disk shape of an exported project (versioned; import accepts ≤ current). */
export const PROJECT_FILE_FORMAT = 'familytree-project'
export const PROJECT_FILE_VERSION = 1

// Tables a project file carries. `scoped` rows hold a project_id; the join
// tables are reached through their parents.
const PROJECT_TABLES = [
  ['persons', true],
  ['field_defs', true],
  ['field_values', false],
  ['relationships', true],
  ['rel_type_defs', true],
  ['tags', true],
  ['entity_tags', false],
  ['scenes', true],
  ['scene_tags', false],
  ['characters', true],
  ['maps', true],
  ['eras', true],
  ['events', true]
] as const
type ProjectTable = (typeof PROJECT_TABLES)[number][0]

function extractProject(db: DB, pid: string) {
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
  const own = <T extends { project_id?: string | null }>(rows: Record<string, T> | undefined) =>
    Object.values(rows || {}).filter((r) => r.project_id === pid)
  const persons = own(db.persons)
  const personIds = new Set(persons.map((p) => p.id))
  const tags = own(db.tags)
  const tagIds = new Set(tags.map((t) => t.id))
  const scenes = own(db.scenes)
  const sceneIds = new Set(scenes.map((sc) => sc.id))
  const rows: Record<ProjectTable, unknown[]> = {
    persons,
    field_defs: own(db.field_defs),
    field_values: Object.values(db.field_values).filter((v) => personIds.has(v.person_id)),
    relationships: own(db.relationships),
    rel_type_defs: own(db.rel_type_defs),
    tags,
    entity_tags: Object.values(db.entity_tags).filter((et) => tagIds.has(et.tag_id)),
    scenes,
    scene_tags: Object.values(db.scene_tags).filter((st) => sceneIds.has(st.scene_id)),
    characters: own(db.characters),
    maps: own(db.maps),
    eras: own(db.eras),
    events: own(db.events)
  }
  // Project settings travel without their `${pid}:` prefix (and never the
  // checkpoint, whose snapshot references this project's live rows).
  const settings: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(db.settings)) {
    if (!key.startsWith(`${pid}:`)) continue
    const rest = key.slice(pid.length + 1)
    if (rest !== 'checkpoint') settings[rest] = value
  }
  return clone({ rows, settings })
}

export const channelHandlers: Record<string, Handler> = {
  // ── auth ───────────────────────────────────────────────────────────────────
  // These mirror what the hosted server will expose: register/login hand back
  // a bearer token, session validates it, logout revokes it. Handlers never
  // return credential material, and login failures stay deliberately vague.
  async 'auth:register'(db, data, env) {
    const username = String(data?.username ?? '').trim()
    const password = String(data?.password ?? '')
    const usernameError = validateUsername(username)
    if (usernameError) throw new Error(usernameError)
    const passwordError = validatePassword(password)
    if (passwordError) throw new Error(passwordError)
    if (!data?.acceptedTerms) throw new Error('Please accept the Terms & Privacy Policy')
    const lower = username.toLowerCase()
    if (Object.values(db.users).some((u) => u.username_lower === lower)) {
      throw new Error('That username is already taken')
    }

    const now = env.nowStr()
    const user: User = {
      id: env.uuid(),
      username,
      username_lower: lower,
      ...(await hashPassword(password)),
      plan: 'free',
      tos_accepted_at: now,
      failed_logins: 0,
      locked_until: null,
      created_at: now
    }
    const firstUser = Object.keys(db.users).length === 0
    db.users[user.id] = user

    // The first account adopts the projects made before accounts existed, so
    // nobody's existing data is orphaned by the update. Later accounts start
    // with their own (seeded) project via ensureActiveProjectFor.
    if (firstUser) {
      for (const p of Object.values(db.projects)) {
        if (p.user_id == null) p.user_id = user.id
      }
    }
    ensureActiveProjectFor(db, user, env)
    pruneSessions(db, now)
    const session = startSession(db, user, env)
    return { user: publicUser(user), token: session.token, expires_at: session.expires_at }
  },

  async 'auth:login'(db, data, env) {
    const username = String(data?.username ?? '')
      .trim()
      .toLowerCase()
    const password = String(data?.password ?? '')
    const now = env.nowStr()
    const user = Object.values(db.users).find((u) => u.username_lower === username)
    if (!user) throw new Error('Invalid username or password')
    if (isLockedOut(user, now)) {
      throw new Error('Too many failed attempts — try again in a few minutes')
    }
    const ok = await verifyPassword(password, user)
    if (!ok) {
      recordFailedLogin(user, now)
      throw new Error('Invalid username or password')
    }
    clearFailedLogins(user)
    ensureActiveProjectFor(db, user, env)
    pruneSessions(db, now)
    const session = startSession(db, user, env)
    return { user: publicUser(user), token: session.token, expires_at: session.expires_at }
  },

  // Passwordless "just let me look around" access. A single shared guest
  // account (plan 'guest') is reused across guest sign-ins so its sample data
  // persists and the users table doesn't grow one row per visit. Guests are
  // gated out of Advanced mode client-side (the plan is the signal). When the
  // hosted backend lands this becomes an anonymous/ephemeral session.
  'auth:guest'(db, _data, env) {
    const now = env.nowStr()
    let user = Object.values(db.users).find((u) => u.plan === 'guest')
    if (!user) {
      user = {
        id: env.uuid(),
        username: 'Guest',
        // A key no real account can register (usernames can't contain spaces),
        // so guest access never collides with a registered login.
        username_lower: 'guest (visitor)',
        password_hash: '',
        password_salt: '',
        password_iterations: 0,
        plan: 'guest',
        tos_accepted_at: now,
        failed_logins: 0,
        locked_until: null,
        created_at: now
      }
      db.users[user.id] = user
    }
    ensureActiveProjectFor(db, user, env)
    pruneSessions(db, now)
    const session = startSession(db, user, env)
    return { user: publicUser(user), token: session.token, expires_at: session.expires_at }
  },

  'auth:logout'(db, _data, _env, ctx) {
    if (ctx?.token) delete db.sessions[ctx.token]
    return { ok: true }
  },

  // Validates the stored token on startup and hands back the account + usage.
  'auth:session'(db, _data, env, ctx) {
    if (!ctx?.user) throw new Error('Not signed in')
    ensureActiveProjectFor(db, ctx.user, env)
    settleSubscription(db, ctx.user, env.nowStr()) // a lapsed plan reverts before usage is read
    return { user: publicUser(ctx.user), usage: usageOf(db, ctx.user) }
  },

  'auth:usage'(db, _data, _env, ctx) {
    if (!ctx?.user) throw new Error('Not signed in')
    return usageOf(db, ctx.user)
  },

  // Profile fields only — username, plan, and credentials have their own flows.
  'auth:updateProfile'(db, data, _env, ctx) {
    if (!ctx?.user) throw new Error('Not signed in')
    const user = ctx.user
    if ('display_name' in (data ?? {})) {
      const name = String(data.display_name ?? '').trim()
      if (name.length > 40) throw new Error('Display name must be at most 40 characters')
      user.display_name = name || null
    }
    if ('bio' in (data ?? {})) {
      const bio = String(data.bio ?? '').trim()
      if (bio.length > 280) throw new Error('Bio must be at most 280 characters')
      user.bio = bio || null
    }
    if ('avatar_hue' in (data ?? {})) {
      const hue = data.avatar_hue
      if (hue == null) user.avatar_hue = null
      else {
        const n = Number(hue)
        if (!Number.isFinite(n) || n < 0 || n >= 360) throw new Error('Invalid avatar colour')
        user.avatar_hue = Math.round(n)
      }
    }
    return publicUser(user)
  },

  // Verifies the current password, re-hashes with a fresh salt, and revokes
  // every OTHER session — the standard "log out my other devices" semantics.
  async 'auth:changePassword'(db, data, _env, ctx) {
    if (!ctx?.user) throw new Error('Not signed in')
    const user = ctx.user
    const current = String(data?.currentPassword ?? '')
    const next = String(data?.newPassword ?? '')
    if (!(await verifyPassword(current, user))) throw new Error('Current password is incorrect')
    const passwordError = validatePassword(next)
    if (passwordError) throw new Error(passwordError)
    Object.assign(user, await hashPassword(next))
    for (const [token, s] of Object.entries(db.sessions)) {
      if (s.user_id === user.id && token !== ctx.token) delete db.sessions[token]
    }
    return { ok: true }
  },

  // ── projects ───────────────────────────────────────────────────────────────
  'projects:getAll'(db, _data, _env, ctx) {
    const list = ctx?.user ? projectsOf(db, ctx.user.id) : Object.values(db.projects)
    return { projects: sortByDate(list), activeProjectId: db.activeProjectId }
  },

  // Each owned project with its headline counts — the profile page's cards.
  'projects:overview'(db, _data, _env, ctx) {
    const list = ctx?.user ? projectsOf(db, ctx.user.id) : Object.values(db.projects)
    const counts = (pid: string) => ({
      persons: Object.values(db.persons).filter((p) => p.project_id === pid).length,
      relationships: Object.values(db.relationships).filter((r) => r.project_id === pid).length,
      images: Object.values(db.images).filter((img) => img.project_id === pid).length
    })
    const projects: ProjectOverview[] = sortByDate(list).map((p) => ({
      ...p,
      counts: counts(p.id)
    }))
    return { projects, activeProjectId: db.activeProjectId }
  },

  'projects:create'(db, data, env, ctx) {
    if (ctx?.user) {
      const limits = limitsFor(ctx.user)
      if (projectsOf(db, ctx.user.id).length >= limits.maxProjects) {
        throw new Error(`Free plan limit reached: ${limits.maxProjects} projects`)
      }
    }
    const id = env.uuid()
    const now = env.nowStr()
    const project: Project = {
      id,
      name: data?.name || 'Unnamed Project',
      user_id: ctx?.user?.id ?? null,
      created_at: now,
      updated_at: now
    }
    db.projects[id] = project
    // Even an empty project starts on the trait system (locked default defs)
    // and the relationship-type registry (built-in defs).
    ensureProjectFields(db, id, env)
    ensureProjectRelTypes(db, id, env)
    return project
  },

  'projects:rename'(db, data, env, ctx) {
    const project = db.projects[data.id]
    if (!project) throw new Error('Project not found')
    if (ctx?.user && project.user_id !== ctx.user.id) throw new Error('Project not found')
    project.name = data.name
    project.updated_at = env.nowStr()
    return project
  },

  // Card metadata edits from the Projects page: name, description, visibility,
  // accent hue, favorite. Favorite alone does not bump updated_at, so starring
  // never reshuffles a "recently updated" ordering.
  'projects:update'(db, data, env, ctx) {
    const project = db.projects[data?.id]
    if (!project) throw new Error('Project not found')
    if (ctx?.user && project.user_id !== ctx.user.id) throw new Error('Project not found')
    let touched = false
    if ('name' in data) {
      const name = String(data.name ?? '').trim()
      if (!name) throw new Error('Project name cannot be empty')
      if (name.length > 60) throw new Error('Project name must be at most 60 characters')
      project.name = name
      touched = true
    }
    if ('description' in data) {
      const desc = String(data.description ?? '').trim()
      if (desc.length > 200) throw new Error('Description must be at most 200 characters')
      project.description = desc || null
      touched = true
    }
    if ('visibility' in data) {
      if (data.visibility !== 'private' && data.visibility !== 'public') {
        throw new Error('Invalid visibility')
      }
      project.visibility = data.visibility
      touched = true
    }
    if ('access' in data) {
      if (!SHARE_ACCESS_LEVELS.includes(data.access)) throw new Error('Invalid access mode')
      project.access = data.access
      touched = true
    }
    if ('hue' in data) {
      if (data.hue == null) project.hue = null
      else {
        const n = Number(data.hue)
        if (!Number.isFinite(n) || n < 0 || n >= 360) throw new Error('Invalid colour')
        project.hue = Math.round(n)
      }
      touched = true
    }
    if ('favorite' in data) project.favorite = !!data.favorite
    if (touched) project.updated_at = env.nowStr()
    return project
  },

  'projects:duplicate'(db, data, env, ctx) {
    const src = db.projects[data?.id]
    if (!src) throw new Error('Project not found')
    if (ctx?.user && src.user_id !== ctx.user.id) throw new Error('Project not found')
    if (ctx?.user) {
      const usage = usageOf(db, ctx.user)
      if (usage.projects >= usage.maxProjects) {
        throw new Error(`Free plan limit reached: ${usage.maxProjects} projects`)
      }
      const copied = Object.values(db.persons).filter((p) => p.project_id === src.id).length
      if (usage.persons + copied > usage.maxPersons) {
        throw new Error(`Free plan limit reached: ${usage.maxPersons} people`)
      }
    }
    return copyProjectInto(db, src.id, db, env, {
      name: data?.name || `${src.name} copy`,
      favorite: false
    })
  },

  // A portable project file: everything projects:duplicate would copy, as
  // plain JSON. Defaults to the active project. Photos are left out (they are
  // files, not rows) — the file notes it so the importer can say so.
  'projects:export'(db, data, env, ctx) {
    const pid = data?.id || db.activeProjectId
    const project = pid ? db.projects[pid] : null
    if (!project) throw new Error('Project not found')
    if (ctx?.user && project.user_id !== ctx.user.id) throw new Error('Project not found')
    const { rows, settings } = extractProject(db, project.id)
    return {
      format: PROJECT_FILE_FORMAT,
      version: PROJECT_FILE_VERSION,
      exportedAt: env.nowStr(),
      project: {
        name: project.name,
        description: project.description ?? null,
        hue: project.hue ?? null
      },
      photosIncluded: false,
      rows,
      settings
    }
  },

  // Open a project file as a NEW project (fresh ids throughout, owned by the
  // caller, private). Unknown tables/keys are ignored; malformed rows are
  // skipped; maps are re-sanitized. Quotas apply as for projects:duplicate.
  'projects:import'(db, data, env, ctx) {
    const file = data?.file
    if (!file || typeof file !== 'object' || file.format !== PROJECT_FILE_FORMAT) {
      throw new Error('Not a project file')
    }
    if (!Number.isInteger(file.version) || file.version < 1) throw new Error('Not a project file')
    if (file.version > PROJECT_FILE_VERSION) {
      throw new Error('This project file was made by a newer version of the app')
    }
    const srcId = 'import'
    const now = env.nowStr()
    const src = EMPTY_DB()
    const meta = file.project && typeof file.project === 'object' ? file.project : {}
    const name =
      String(data?.name || meta.name || '')
        .trim()
        .slice(0, 60) || 'Imported project'
    src.projects[srcId] = { id: srcId, name, user_id: null, created_at: now, updated_at: now }
    const rows = file.rows && typeof file.rows === 'object' ? file.rows : {}
    for (const [table, scoped] of PROJECT_TABLES) {
      const list = Array.isArray(rows[table]) ? rows[table] : Object.values(rows[table] || {})
      const into = src[table] as Record<string, unknown>
      for (const raw of list) {
        if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') continue
        into[raw.id] = scoped ? { ...raw, project_id: srcId } : { ...raw }
      }
    }
    // Maps go back through the same sanitizer maps:save uses.
    for (const [id, raw] of Object.entries(src.maps)) {
      const doc: MapDoc = {
        id,
        project_id: srcId,
        name: 'Untitled map',
        style: 'parchment',
        base: 'sea',
        width: 2400,
        height: 1600,
        features: [],
        tokens: [],
        view: null,
        year: null,
        created_at: now,
        updated_at: now
      }
      applyMapPatch(doc, raw as unknown as Record<string, unknown>, env.uuid)
      src.maps[id] = doc
    }
    // Eras and events go back through the same sanitizers their channels use.
    for (const [id, raw] of Object.entries(src.eras)) {
      src.eras[id] = applyEraPatch(
        {
          id,
          project_id: srcId,
          name: 'Untitled era',
          start: null,
          end: null,
          color: '#6c8ef5',
          icon: '',
          description: '',
          created_at: now,
          updated_at: now
        },
        raw as unknown as Record<string, unknown>
      )
    }
    for (const [id, raw] of Object.entries(src.events)) {
      src.events[id] = applyEventPatch(
        blankEvent(id, srcId, now),
        raw as unknown as Record<string, unknown>,
        (pid) => !!src.persons[pid]
      )
    }
    if (file.settings && typeof file.settings === 'object') {
      for (const [key, value] of Object.entries(file.settings)) {
        if (key !== 'checkpoint') src.settings[`${srcId}:${key}`] = value
      }
    }
    if (ctx?.user) {
      const usage = usageOf(db, ctx.user)
      if (usage.projects >= usage.maxProjects) {
        throw new Error(`Free plan limit reached: ${usage.maxProjects} projects`)
      }
      const incoming = Object.keys(src.persons).length
      if (usage.persons + incoming > usage.maxPersons) {
        throw new Error(`Free plan limit reached: ${usage.maxPersons} people`)
      }
    }
    const hue = Number(meta.hue)
    const project = copyProjectInto(src, srcId, db, env, {
      name,
      user_id: ctx?.user?.id ?? null,
      description: typeof meta.description === 'string' ? meta.description.slice(0, 200) : null,
      hue: Number.isFinite(hue) && hue >= 0 && hue < 360 ? Math.round(hue) : null,
      visibility: 'private',
      favorite: false
    })
    // Self-heal files from older versions (or hand-edited ones): make sure the
    // project has its locked default traits and built-in relationship types.
    ensureProjectFields(db, project.id, env)
    ensureProjectRelTypes(db, project.id, env)
    return project
  },

  'projects:delete'(db, data, env, ctx) {
    const pid = data.id
    if (ctx?.user && db.projects[pid] && db.projects[pid].user_id !== ctx.user.id) {
      throw new Error('Project not found')
    }
    // Remove all persons, relationships, tags (+joins), factions, scenarios,
    // images for this project
    for (const [id, p] of Object.entries(db.persons)) {
      if (p.project_id === pid) {
        cascadeEntityTags(db, { entityId: id })
        for (const [vid, v] of Object.entries(db.field_values)) {
          if (v.person_id === id) delete db.field_values[vid]
        }
        delete db.persons[id]
      }
    }
    for (const [fid, def] of Object.entries(db.field_defs)) {
      if (def.project_id === pid) delete db.field_defs[fid]
    }
    for (const [rid, r] of Object.entries(db.relationships)) {
      if (r.project_id === pid) delete db.relationships[rid]
    }
    for (const [rtid, rt] of Object.entries(db.rel_type_defs || {})) {
      if (rt.project_id === pid) delete db.rel_type_defs[rtid]
    }
    for (const [tid, t] of Object.entries(db.tags)) {
      if (t.project_id === pid) {
        cascadeEntityTags(db, { tagId: tid })
        delete db.tags[tid]
      }
    }
    for (const [sid, s] of Object.entries(db.scenes)) {
      if (s.project_id === pid) {
        cascadeSceneTags(db, { sceneId: sid })
        delete db.scenes[sid]
      }
    }
    for (const [iid, img] of Object.entries(db.images)) {
      if (img.project_id === pid) {
        env.removeImageFile(img.file_path)
        delete db.images[iid]
      }
    }
    for (const [cid, c] of Object.entries(db.characters || {})) {
      if (c.project_id === pid) delete db.characters[cid]
    }
    for (const [mid, m] of Object.entries(db.maps || {})) {
      if (m.project_id === pid) delete db.maps[mid]
    }
    for (const [eid, e] of Object.entries(db.eras || {})) {
      if (e.project_id === pid) delete db.eras[eid]
    }
    for (const [eid, e] of Object.entries(db.events || {})) {
      if (e.project_id === pid) delete db.events[eid]
    }
    // Remove project-scoped settings
    for (const key of Object.keys(db.settings)) {
      if (key.startsWith(`${pid}:`)) delete db.settings[key]
    }
    delete db.projects[pid]

    // Switch active to another project if needed (never to another user's)
    if (db.activeProjectId === pid) {
      const remaining = ctx?.user
        ? projectsOf(db, ctx.user.id).map((p) => p.id)
        : Object.keys(db.projects)
      db.activeProjectId = remaining.length > 0 ? remaining[0] : null
    }
    return { id: pid, newActiveProjectId: db.activeProjectId }
  },

  'projects:setActive'(db, data, _env, ctx) {
    const project = db.projects[data.id]
    if (!project) throw new Error('Project not found')
    // Ownership is enforced like a server would: someone else's project id is
    // indistinguishable from a nonexistent one.
    if (ctx?.user && project.user_id !== ctx.user.id) throw new Error('Project not found')
    db.activeProjectId = data.id
    return { activeProjectId: data.id }
  },

  // ── persons ────────────────────────────────────────────────────────────────
  'persons:getAll'(db) {
    const list = sortByDate(forProject(db, db.persons))
    return list.map((p) => ({ ...p, primary_image: primaryImageOf(db, p.id) }))
  },

  'persons:create'(db, data, env, ctx) {
    assertPersonQuota(db, ctx, 1)
    const person = createPersonRow(db, env, data)
    return { ...person, primary_image: null }
  },

  // Create several people as ONE write (and one undo step) — the Sheet's
  // paste-past-the-last-row path. rows: [{ values? , ...legacy columns }].
  // The quota covers the whole batch: it's all or nothing.
  'persons:createMany'(db, data, env, ctx) {
    const rows = Array.isArray(data?.rows) ? data.rows : []
    assertPersonQuota(db, ctx, rows.length)
    const created = rows.map((r: Record<string, unknown>) => createPersonRow(db, env, r ?? {}))
    const ids = new Set(created.map((p: Person) => p.id))
    return {
      persons: created.map((p: Person) => ({ ...p, primary_image: null })),
      values: Object.values(db.field_values).filter((v) => ids.has(v.person_id))
    }
  },

  'persons:update'(db, data, env) {
    const existing = db.persons[data.id]
    if (!existing) throw new Error('Person not found')
    const updated: Person = {
      ...existing,
      name: data.name || '',
      birth: data.birth ?? null,
      death: data.death ?? null,
      gender: data.gender || 'unknown',
      bio: data.bio || '',
      occupation: data.occupation || '',
      location: data.location || '',
      updated_at: env.nowStr()
    }
    db.persons[data.id] = updated
    applyPersonPayload(db, env, updated, data)
    return { ...updated, primary_image: primaryImageOf(db, data.id) }
  },

  'persons:delete'(db, data, env) {
    deletePersonCascade(db, env, data.id)
    return { id: data.id }
  },

  // Delete several people as ONE write (and one undo step) — the Sheet's
  // multi-row delete. Every id must be a person in the active project; any
  // miss throws before anything is removed.
  // Optional `relationshipIds` also drops those bonds in the same write, so a
  // mixed graph selection (people + links) deletes as ONE undo step.
  'persons:deleteMany'(db, data, env) {
    const ids: string[] = [
      ...new Set<string>((Array.isArray(data?.ids) ? data.ids : []).map(String))
    ]
    const relIds: string[] = [
      ...new Set<string>(
        (Array.isArray(data?.relationshipIds) ? data.relationshipIds : []).map(String)
      )
    ]
    for (const id of ids) {
      if (db.persons[id]?.project_id !== db.activeProjectId) throw new Error('Person not found')
    }
    for (const id of relIds) {
      if (db.relationships[id]?.project_id !== db.activeProjectId) {
        throw new Error('Relationship not found')
      }
    }
    for (const id of relIds) delete db.relationships[id]
    for (const id of ids) deletePersonCascade(db, env, id)
    return { ids, relationshipIds: relIds }
  },

  // ── fields (the trait system: defs + per-person values) ────────────────────
  'fields:list'(db) {
    const defs = defsForProject(db, db.activeProjectId as string)
    const personIds = new Set(projectPersonIds(db))
    const values = Object.values(db.field_values).filter((v) => personIds.has(v.person_id))
    return { defs, values }
  },

  // Create a def. `personId` attaches it to that person right away (value may
  // be null — "attached but empty"), which is how an unlocked trait added on a
  // form survives being saved blank.
  'fields:createDef'(db, data, env) {
    const type = data?.type
    if (!CREATABLE_FIELD_TYPES.includes(type)) throw new Error('Unknown trait type')
    const id = env.uuid()
    const now = env.nowStr()
    const siblings = defsForProject(db, db.activeProjectId as string)
    const def: FieldDef = {
      id,
      project_id: db.activeProjectId as string,
      label: String(data?.label || 'New trait'),
      type,
      config: sanitizeConfig(type, data?.config),
      locked: !!data?.locked,
      order: siblings.length ? siblings[siblings.length - 1].order + 1 : 0,
      has_timeframe: false,
      slot: null,
      slot_order: 0,
      icon: String(data?.icon || ''),
      unit: String(data?.unit || ''),
      sys: '',
      created_at: now,
      updated_at: now
    }
    db.field_defs[id] = def
    let value = null
    if (data?.personId && db.persons[data.personId]) {
      value = upsertValue(db, env, data.personId, id, { value: data?.value ?? null })
      recomputeSnapshots(db, [data.personId])
    }
    return { def, value }
  },

  'fields:updateDef'(db, data, env) {
    const def = db.field_defs[data?.id]
    if (!def) throw new Error('Trait not found')
    if (data.locked === false && def.slot) {
      throw new Error('Remove the trait from its slot before unlocking it')
    }
    if (data.label !== undefined) def.label = String(data.label)
    if (data.config !== undefined) def.config = sanitizeConfig(def.type, data.config)
    if (data.locked !== undefined) def.locked = !!data.locked
    if (data.has_timeframe !== undefined) def.has_timeframe = !!data.has_timeframe
    if (data.icon !== undefined) def.icon = String(data.icon)
    if (data.unit !== undefined) def.unit = String(data.unit)
    def.updated_at = env.nowStr()
    // Label/config/unit feed the composed labels — refresh the project.
    recomputeSnapshots(db, projectPersonIds(db))
    return def
  },

  'fields:deleteDef'(db, data) {
    const def = db.field_defs[data?.id]
    if (!def) throw new Error('Trait not found')
    let removedValues = 0
    for (const [vid, v] of Object.entries(db.field_values)) {
      if (v.field_id === def.id) {
        delete db.field_values[vid]
        removedValues++
      }
    }
    delete db.field_defs[def.id]
    recomputeSnapshots(db, projectPersonIds(db))
    return { id: def.id, removedValues }
  },

  // One project-wide ordering: orderedIds is the full desired sequence.
  'fields:reorderDefs'(db, data, env) {
    const orderedIds: string[] = Array.isArray(data?.orderedIds) ? data.orderedIds : []
    const now = env.nowStr()
    orderedIds.forEach((id, idx) => {
      const def = db.field_defs[id]
      if (def && def.project_id === db.activeProjectId && def.order !== idx) {
        def.order = idx
        def.updated_at = now
      }
    })
    return defsForProject(db, db.activeProjectId as string)
  },

  // Move a def into / out of a slot. Slotting auto-locks; single slots evict
  // the current occupant back to the plain list.
  'fields:setSlot'(db, data, env) {
    const def = db.field_defs[data?.fieldId]
    if (!def) throw new Error('Trait not found')
    const slot: SlotName | null = data?.slot ?? null
    const now = env.nowStr()
    if (slot != null) {
      if (!slotAccepts(slot, def.type)) {
        throw new Error(
          slot === 'name'
            ? 'Only text traits can appear in the graph name'
            : `A ${def.type.replace('_', ' ')} trait cannot go in the ${slot} slot`
        )
      }
      if (isSingleSlot(slot)) {
        for (const other of Object.values(db.field_defs)) {
          if (other.project_id === def.project_id && other.slot === slot && other.id !== def.id) {
            other.slot = null
            other.slot_order = 0
            other.updated_at = now
          }
        }
      }
      const nameSiblings = Object.values(db.field_defs).filter(
        (d) => d.project_id === def.project_id && d.slot === 'name' && d.id !== def.id
      )
      def.slot = slot
      def.slot_order =
        data?.slotOrder ??
        (slot === 'name' ? Math.max(-1, ...nameSiblings.map((d) => d.slot_order)) + 1 : 0)
      def.locked = true
    } else {
      def.slot = null
      def.slot_order = 0
    }
    def.updated_at = now
    recomputeSnapshots(db, projectPersonIds(db))
    return defsForProject(db, db.activeProjectId as string)
  },

  'fields:setValue'(db, data, env) {
    if (!db.persons[data?.personId]) throw new Error('Person not found')
    const row = upsertValue(db, env, data.personId, data.fieldId, data)
    recomputeSnapshots(db, [data.personId])
    const person = db.persons[data.personId]
    return { value: row, person: { ...person, primary_image: primaryImageOf(db, person.id) } }
  },

  // Batch write for form save: upserts + removals, one snapshot recompute.
  'fields:setValues'(db, data, env) {
    const person = db.persons[data?.personId]
    if (!person) throw new Error('Person not found')
    applyPersonPayload(db, env, person, data)
    return {
      person: { ...person, primary_image: primaryImageOf(db, person.id) },
      values: valuesForPerson(db, person.id)
    }
  },

  // Several people's trait writes as ONE atomic write (and one undo step) —
  // the Sheet's paste / fill / clear-range path. updates: [{ personId,
  // values?, removals? }] with the same per-person shape as fields:setValues.
  // Every person is validated up front, so a bad id changes nothing.
  'fields:setValuesBatch'(db, data, env) {
    const updates = Array.isArray(data?.updates) ? data.updates : []
    const people = updates.map((u: Record<string, unknown>) => {
      const person = db.persons[String(u?.personId ?? '')]
      if (!person || person.project_id !== db.activeProjectId) throw new Error('Person not found')
      return person
    })
    updates.forEach((u: Record<string, unknown>, i: number) =>
      applyPersonPayload(db, env, people[i], { values: u.values, removals: u.removals })
    )
    const touched: string[] = [...new Set<string>(people.map((p: Person) => p.id))]
    const ids = new Set(touched)
    return {
      persons: touched.map((id) => ({
        ...db.persons[id],
        primary_image: primaryImageOf(db, id)
      })),
      values: Object.values(db.field_values).filter((v) => ids.has(v.person_id))
    }
  },

  'fields:removeValue'(db, data) {
    const person = db.persons[data?.personId]
    if (!person) throw new Error('Person not found')
    removeValue(db, data.personId, data.fieldId)
    recomputeSnapshots(db, [data.personId])
    return {
      personId: data.personId,
      fieldId: data.fieldId,
      person: { ...person, primary_image: primaryImageOf(db, person.id) }
    }
  },

  // Bulk "show in graph" across every person holding this trait. Locked defs
  // only — the option is meaningless for a one-person trait.
  'fields:applyDisplayAll'(db, data, env) {
    const def = db.field_defs[data?.fieldId]
    if (!def) throw new Error('Trait not found')
    if (!def.locked) throw new Error('Lock the trait to apply this everywhere')
    const on = !!data?.on
    const now = env.nowStr()
    const personIds: string[] = []
    for (const v of Object.values(db.field_values)) {
      if (v.field_id === def.id && v.display_in_graph !== on) {
        v.display_in_graph = on
        v.updated_at = now
        personIds.push(v.person_id)
      }
    }
    recomputeSnapshots(db, personIds)
    return {
      fieldId: def.id,
      on,
      values: Object.values(db.field_values).filter((v) => v.field_id === def.id)
    }
  },

  // ── relationships ──────────────────────────────────────────────────────────
  'relationships:getAll'(db) {
    return sortByDate(forProject(db, db.relationships))
  },

  'relationships:create'(db, data, env) {
    const pid = db.activeProjectId as string
    const def = relTypeByKey(db, pid, data.type)
    if (!def) throw new Error(`Unknown relationship type: ${data.type}`)
    const id = env.uuid()
    const rel: Relationship = {
      id,
      project_id: pid,
      person_a_id: data.person_a_id,
      person_b_id: data.person_b_id,
      type: data.type,
      status: data.status || def.statuses[0] || 'active',
      formed: data.formed ?? null,
      ended: data.ended ?? null,
      label: data.label ?? null,
      created_at: env.nowStr()
    }
    db.relationships[id] = rel
    return rel
  },

  'relationships:update'(db, data) {
    const existing = db.relationships[data.id]
    if (!existing) throw new Error('Relationship not found')
    if (data.type !== undefined) {
      if (!relTypeByKey(db, existing.project_id, data.type)) {
        throw new Error(`Unknown relationship type: ${data.type}`)
      }
      existing.type = data.type
    }
    if (data.status !== undefined) existing.status = data.status
    if (data.formed !== undefined) existing.formed = data.formed
    if (data.ended !== undefined) existing.ended = data.ended
    if (data.label !== undefined) existing.label = data.label
    if (data.person_a_id !== undefined) existing.person_a_id = data.person_a_id
    if (data.person_b_id !== undefined) existing.person_b_id = data.person_b_id
    return existing
  },

  'relationships:delete'(db, data) {
    delete db.relationships[data.id]
    return { id: data.id }
  },

  // ── relationship types (the registry — src/shared/relTypes.ts) ─────────────
  'relTypes:getAll'(db) {
    return relTypesForProject(db, db.activeProjectId as string)
  },

  'relTypes:create'(db, data, env) {
    const pid = db.activeProjectId as string
    const id = env.uuid()
    const now = env.nowStr()
    const defs = relTypesForProject(db, pid)
    const def: RelationshipTypeDef = {
      id,
      project_id: pid,
      key: id, // custom defs: the id doubles as the type slug
      label: String(data?.label ?? '').trim() || 'New type',
      weight: clampWeight(data?.weight ?? 0),
      directed: !!data?.directed,
      symmetryRole: coerceSymmetryRole(data?.symmetryRole),
      role_a: String(data?.role_a ?? ''),
      role_b: String(data?.role_b ?? ''),
      color: String(data?.color || '#8a93a6'),
      glyph: String(data?.glyph || 'diamond'),
      band: 'custom',
      builtin: false,
      statuses:
        Array.isArray(data?.statuses) && data.statuses.length
          ? data.statuses.map(String)
          : ['active', 'ended'],
      order: defs.length ? Math.max(...defs.map((d) => d.order)) + 1 : 0,
      created_at: now,
      updated_at: now
    }
    db.rel_type_defs[id] = def
    return def
  },

  'relTypes:update'(db, data, env) {
    const def = db.rel_type_defs[data.id]
    if (!def) throw new Error('Relationship type not found')
    if (data.label !== undefined) def.label = String(data.label).trim() || def.label
    if (data.weight !== undefined) def.weight = clampWeight(data.weight)
    if (data.color !== undefined) def.color = String(data.color)
    if (data.glyph !== undefined) def.glyph = String(data.glyph)
    if (Array.isArray(data.statuses) && data.statuses.length) {
      def.statuses = data.statuses.map(String)
    }
    // The generational (hierarchy) role is user-tunable on ANY type, including
    // builtins — it's how the generations layout is told to treat this type's
    // edges (vertical = parent→child, horizontal = same-generation couple,
    // none = ignored by the tree math). Changing it reinterprets existing edges,
    // which is the intended effect.
    if (data.symmetryRole !== undefined) def.symmetryRole = coerceSymmetryRole(data.symmetryRole)
    // Direction and role names define what a directed edge MEANS — only custom
    // defs may change them (flipping a builtin's direction would corrupt a→b).
    if (!def.builtin) {
      if (data.directed !== undefined) def.directed = !!data.directed
      if (data.role_a !== undefined) def.role_a = String(data.role_a)
      if (data.role_b !== undefined) def.role_b = String(data.role_b)
    }
    def.updated_at = env.nowStr()
    return def
  },

  // Deleting a custom type removes its relationships with it (like a tag
  // delete cascades its joins). Built-ins can be tuned but never deleted.
  'relTypes:delete'(db, data) {
    const def = db.rel_type_defs[data.id]
    if (!def) throw new Error('Relationship type not found')
    if (def.builtin) throw new Error('Built-in relationship types cannot be deleted')
    const removed: string[] = []
    for (const [rid, r] of Object.entries(db.relationships)) {
      if (r.project_id === def.project_id && r.type === def.key) {
        delete db.relationships[rid]
        removed.push(rid)
      }
    }
    delete db.rel_type_defs[data.id]
    return { id: data.id, removedRelationships: removed }
  },

  // ── tags ───────────────────────────────────────────────────────────────────
  'tags:getAll'(db) {
    return sortByDate(forProject(db, db.tags))
  },

  'tags:create'(db, data, env) {
    const id = env.uuid()
    const now = env.nowStr()
    const tag: Tag = {
      id,
      project_id: db.activeProjectId as string,
      label: data?.label || 'New Tag',
      type: data?.type || '',
      source: data?.source === 'derived' ? 'derived' : 'manual',
      color: data?.color || '#6c8ef5',
      icon: data?.icon || '',
      created_at: now,
      updated_at: now
    }
    db.tags[id] = tag
    return tag
  },

  'tags:update'(db, data, env) {
    const existing = db.tags[data.id]
    if (!existing) throw new Error('Tag not found')
    if (data.label !== undefined) existing.label = data.label
    if (data.type !== undefined) existing.type = data.type
    if (data.color !== undefined) existing.color = data.color
    if (data.icon !== undefined) existing.icon = data.icon
    existing.updated_at = env.nowStr()
    return existing
  },

  'tags:delete'(db, data) {
    cascadeEntityTags(db, { tagId: data.id })
    cascadeSceneTags(db, { tagId: data.id })
    delete db.tags[data.id]
    return { id: data.id }
  },

  // ── entity_tags (the many-to-many membership join) ─────────────────────────
  // Rows carry no project_id; they are scoped through their tag.
  'entity_tags:getAll'(db) {
    return sortByDate(
      Object.values(db.entity_tags).filter(
        (row) => db.tags[row.tag_id]?.project_id === db.activeProjectId
      )
    )
  },

  // Idempotent: adding an existing (entity, tag) pair returns the existing row.
  'entity_tags:add'(db, data, env) {
    const { entity_id, tag_id } = data
    if (!db.tags[tag_id]) throw new Error('Tag not found')
    if (!db.persons[entity_id]) throw new Error('Entity not found')
    const existing = Object.values(db.entity_tags).find(
      (row) => row.entity_id === entity_id && row.tag_id === tag_id
    )
    if (existing) return existing
    const id = env.uuid()
    const row: EntityTag = { id, entity_id, tag_id, created_at: env.nowStr() }
    db.entity_tags[id] = row
    return row
  },

  'entity_tags:remove'(db, data) {
    const { entity_id, tag_id } = data
    const removed: string[] = []
    for (const [id, row] of Object.entries(db.entity_tags)) {
      if (row.entity_id === entity_id && row.tag_id === tag_id) {
        delete db.entity_tags[id]
        removed.push(id)
      }
    }
    return { entity_id, tag_id, removed }
  },

  // ── scenes (per-view saved arrangements; groups scenes only for now) ───────
  'scenes:getAll'(db, data) {
    const list = sortByDate(forProject(db, db.scenes))
    return data?.view ? list.filter((s) => s.view === data.view) : list
  },

  'scenes:create'(db, data, env) {
    const id = env.uuid()
    const now = env.nowStr()
    const scene: Scene = {
      id,
      project_id: db.activeProjectId as string,
      view: data?.view || 'groups',
      name: data?.name || 'New Scene',
      type: data?.type ?? null,
      config: data?.config || {},
      positions: data?.positions || {},
      created_at: now,
      updated_at: now
    }
    // Graph scenes carry a per-type arrangement map (one scene = all layouts).
    if (data?.layouts) scene.layouts = data.layouts
    else if ((data?.view || 'groups') === 'graph') scene.layouts = {}
    db.scenes[id] = scene
    return scene
  },

  'scenes:rename'(db, data, env) {
    const scene = db.scenes[data.id]
    if (!scene) throw new Error('Scene not found')
    scene.name = data.name
    scene.updated_at = env.nowStr()
    return scene
  },

  // Deep-copies the scene (config/positions) plus its tag placements, so a
  // duplicated groups scene starts as an exact visual copy. Membership lives
  // on the tags and is shared — never duplicated.
  'scenes:duplicate'(db, data, env) {
    const src = db.scenes[data.id]
    if (!src) throw new Error('Scene not found')
    const id = env.uuid()
    const now = env.nowStr()
    const scene: Scene = {
      ...src,
      id,
      name: data?.name || `${src.name} copy`,
      config: JSON.parse(JSON.stringify(src.config || {})),
      positions: JSON.parse(JSON.stringify(src.positions || {})),
      created_at: now,
      updated_at: now
    }
    if (src.layouts) scene.layouts = JSON.parse(JSON.stringify(src.layouts))
    db.scenes[id] = scene
    const cloned: SceneTag[] = []
    for (const st of Object.values(db.scene_tags)) {
      if (st.scene_id !== src.id) continue
      const rid = env.uuid()
      const copy: SceneTag = { ...st, id: rid, scene_id: id, created_at: now, updated_at: now }
      db.scene_tags[rid] = copy
      cloned.push(copy)
    }
    return { scene, scene_tags: cloned }
  },

  // Persist a scene's arrangement: any of type/config/positions (and name).
  'scenes:save'(db, data, env) {
    const scene = db.scenes[data.id]
    if (!scene) throw new Error('Scene not found')
    if (data.name !== undefined) scene.name = data.name
    if (data.type !== undefined) scene.type = data.type
    if (data.config !== undefined) scene.config = data.config
    if (data.positions !== undefined) scene.positions = data.positions
    if (data.layouts !== undefined) scene.layouts = data.layouts
    scene.updated_at = env.nowStr()
    return scene
  },

  'scenes:delete'(db, data) {
    cascadeSceneTags(db, { sceneId: data.id })
    delete db.scenes[data.id]
    return { id: data.id }
  },

  // ── scene_tags (a tag placed in a scene = a "Group") ────────────────────────
  // Rows carry no project_id; they are scoped through their scene.
  'scene_tags:getAll'(db) {
    return sortByDate(
      Object.values(db.scene_tags).filter(
        (row) => db.scenes[row.scene_id]?.project_id === db.activeProjectId
      )
    )
  },

  // Idempotent per (scene, tag) pair — re-adding returns the existing placement.
  'scene_tags:add'(db, data, env) {
    const { scene_id, tag_id } = data
    if (!db.scenes[scene_id]) throw new Error('Scene not found')
    if (!db.tags[tag_id]) throw new Error('Tag not found')
    const existing = Object.values(db.scene_tags).find(
      (row) => row.scene_id === scene_id && row.tag_id === tag_id
    )
    if (existing) return existing
    const id = env.uuid()
    const now = env.nowStr()
    const row: SceneTag = {
      id,
      scene_id,
      tag_id,
      x: data.x ?? 0,
      y: data.y ?? 0,
      visible: data.visible !== false,
      created_at: now,
      updated_at: now
    }
    db.scene_tags[id] = row
    return row
  },

  'scene_tags:move'(db, data, env) {
    const row = db.scene_tags[data.id]
    if (!row) throw new Error('Placement not found')
    if (data.x !== undefined) row.x = data.x
    if (data.y !== undefined) row.y = data.y
    row.updated_at = env.nowStr()
    return row
  },

  'scene_tags:setVisible'(db, data, env) {
    const row = db.scene_tags[data.id]
    if (!row) throw new Error('Placement not found')
    row.visible = !!data.visible
    row.updated_at = env.nowStr()
    return row
  },

  'scene_tags:remove'(db, data) {
    delete db.scene_tags[data.id]
    return { id: data.id }
  },

  // ── images (metadata; byte access and file picking stay in the shells) ─────
  'images:getByPerson'(db, data) {
    const rows = sortByDate(
      Object.values(db.images).filter((img) => img.person_id === data.personId)
    )
    rows.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
    return rows
  },

  'images:add'(db, data, env, ctx) {
    if (ctx?.user) {
      const usage = usageOf(db, ctx.user)
      if (usage.images >= usage.maxImages) {
        throw new Error(`Free plan limit reached: ${usage.maxImages} photos`)
      }
    }
    const { personId, srcPath, isPrimary } = data
    const filePath = env.storeImageFile(srcPath)
    if (isPrimary) {
      for (const img of Object.values(db.images)) {
        if (img.person_id === personId) img.is_primary = false
      }
    }
    const role = ['portrait', 'fullbody', 'background'].includes(data.role) ? data.role : ''
    if (role) {
      // One image per named slot — the previous occupant becomes an extra.
      for (const img of Object.values(db.images)) {
        if (img.person_id === personId && img.role === role) img.role = ''
      }
    }
    const id = env.uuid()
    const img: ImageRecord = {
      id,
      project_id: db.activeProjectId as string,
      person_id: personId,
      file_path: filePath,
      is_primary: !!isPrimary,
      role,
      source: data.source || '',
      created_at: env.nowStr()
    }
    db.images[id] = img
    return img
  },

  // Assign an existing image to a named slot ('' clears it back to an extra).
  'images:setRole'(db, data) {
    const { imageId, personId } = data
    const role = ['portrait', 'fullbody', 'background', ''].includes(data.role) ? data.role : ''
    const target = db.images[imageId]
    if (!target) throw new Error('Image not found')
    if (role) {
      for (const img of Object.values(db.images)) {
        if (img.person_id === personId && img.role === role) img.role = ''
      }
    }
    target.role = role
    return target
  },

  'images:setPrimary'(db, data) {
    const { imageId, personId } = data
    for (const img of Object.values(db.images)) {
      if (img.person_id === personId) img.is_primary = false
    }
    if (db.images[imageId]) db.images[imageId].is_primary = true
    return { imageId }
  },

  'images:delete'(db, data, env) {
    const { imageId } = data
    const img = db.images[imageId]
    if (img) {
      env.removeImageFile(img.file_path)
      delete db.images[imageId]
    }
    return { imageId }
  },

  // ── characters (experimental — buildable portraits; Character view) ────────
  // A person can own several docs (different looks / age ranges); at most one
  // is the portrait. Docs store part IDS within a style pack — no geometry —
  // so they stay renderer-agnostic (see docs/CHARACTER_VIEW_PROPOSAL.md).
  'characters:getAll'(db) {
    return sortByDate(forProject(db, db.characters || {}))
  },

  // Upsert: with a known id, patch the given fields; without one, create.
  'characters:save'(db, data, env) {
    db.characters = db.characters || {}
    const now = env.nowStr()
    const existing = data?.id ? db.characters[data.id] : null
    if (existing) {
      if (data.label !== undefined) existing.label = String(data.label)
      if (data.style_id !== undefined) existing.style_id = String(data.style_id)
      if (data.age_from !== undefined) existing.age_from = numOrNull(data.age_from)
      if (data.age_to !== undefined) existing.age_to = numOrNull(data.age_to)
      if (data.parts !== undefined) existing.parts = data.parts
      if (data.palette !== undefined) existing.palette = data.palette
      if (data.morph !== undefined) existing.morph = data.morph
      if (data.expression !== undefined) existing.expression = String(data.expression || 'neutral')
      if (data.backdrop !== undefined) existing.backdrop = String(data.backdrop || 'studio')
      if (data.model3d !== undefined) {
        if (data.model3d) existing.model3d = sanitizeModel3D(data.model3d)
        else delete existing.model3d
      }
      existing.updated_at = now
      return existing
    }
    if (!data?.person_id || !db.persons[data.person_id]) throw new Error('Person not found')
    const id = data.id || env.uuid()
    const doc: CharacterDoc = {
      id,
      project_id: db.activeProjectId as string,
      person_id: data.person_id,
      version: 1,
      label: data.label || 'Look 1',
      style_id: data.style_id || 'cartoon',
      is_portrait: false,
      age_from: numOrNull(data.age_from),
      age_to: numOrNull(data.age_to),
      parts: data.parts || {},
      palette: data.palette || {},
      morph: data.morph || { height: 0, build: 0, headSize: 0, age: 0 },
      expression: data.expression ? String(data.expression) : 'neutral',
      backdrop: data.backdrop ? String(data.backdrop) : 'studio',
      ...(data.model3d ? { model3d: sanitizeModel3D(data.model3d) } : {}),
      created_at: now,
      updated_at: now
    }
    db.characters[id] = doc
    return doc
  },

  'characters:delete'(db, data) {
    if (db.characters) delete db.characters[data.id]
    return { id: data.id }
  },

  // Mark one of a person's docs as THE portrait (clearing the others), or
  // clear it entirely with characterId: null. The caller separately pushes a
  // rendered image through images:add — this only tracks which doc it was.
  'characters:setPortrait'(db, data, env) {
    const { personId, characterId } = data
    const now = env.nowStr()
    let target: CharacterDoc | null = null
    for (const c of Object.values(db.characters || {})) {
      if (c.person_id !== personId) continue
      const want = characterId != null && c.id === characterId
      if (c.is_portrait !== want) {
        c.is_portrait = want
        c.updated_at = now
      }
      if (want) target = c
    }
    if (characterId != null && !target) throw new Error('Character not found')
    return { personId, characterId: target?.id ?? null }
  },

  // ── maps (the Map view — drawn worlds with people placed over time) ────────
  // A MapDoc is saved whole or patched (applyMapPatch sanitizes every field it
  // touches). Tokens referencing a deleted person are kept but skipped by the
  // renderer, so undoing the person's deletion brings them back on the map;
  // maps aren't part of the undo snapshot — the Map view keeps its own stack.
  'maps:getAll'(db) {
    return sortByDate(forProject(db, db.maps || {}))
  },

  // Upsert: with a known id, patch the given fields; without one, create.
  'maps:save'(db, data, env) {
    db.maps = db.maps || {}
    const now = env.nowStr()
    const existing = data?.id ? db.maps[data.id] : null
    if (existing) {
      if (existing.project_id !== db.activeProjectId) throw new Error('Map not found')
      applyMapPatch(existing, data, env.uuid)
      existing.updated_at = now
      return existing
    }
    const id = data?.id || env.uuid()
    const doc: MapDoc = {
      id,
      project_id: db.activeProjectId as string,
      name: 'Untitled map',
      style: 'parchment',
      base: 'sea',
      width: 2400,
      height: 1600,
      features: [],
      tokens: [],
      view: null,
      year: null,
      created_at: now,
      updated_at: now
    }
    applyMapPatch(doc, data || {}, env.uuid)
    db.maps[id] = doc
    return doc
  },

  'maps:delete'(db, data) {
    const m = db.maps?.[data?.id]
    if (m && m.project_id === db.activeProjectId) delete db.maps[data.id]
    return { id: data?.id }
  },

  // ── chronicle: eras + story events (src/shared/chronicle.ts) ────────────────
  // Both are project-scoped data and undoable (history.ts snapshots them);
  // every write is sanitized. Saves upsert: a known id patches the given
  // fields, no id creates.
  'eras:getAll'(db) {
    return sortByDate(forProject(db, db.eras || {}))
  },

  'eras:save'(db, data, env) {
    return upsertEra(db, data || {}, env)
  },

  // Several eras as ONE write (and one undo step) — the preset packs.
  'eras:saveMany'(db, data, env) {
    const list = Array.isArray(data?.eras) ? data.eras : []
    return list.map((e: Record<string, unknown>) => upsertEra(db, e || {}, env))
  },

  'eras:delete'(db, data) {
    const e = db.eras?.[data?.id]
    if (!e || e.project_id !== db.activeProjectId) throw new Error('Era not found')
    delete db.eras[data.id]
    return { id: data.id }
  },

  'events:getAll'(db) {
    return sortByDate(forProject(db, db.events || {}))
  },

  'events:save'(db, data, env) {
    db.events = db.events || {}
    const now = env.nowStr()
    const pid = db.activeProjectId as string
    const personExists = (id: string) => db.persons[id]?.project_id === pid
    const existing = data?.id ? db.events[data.id] : null
    if (existing) {
      if (existing.project_id !== pid) throw new Error('Event not found')
      applyEventPatch(existing, data, personExists)
      existing.updated_at = now
      return existing
    }
    const id = env.uuid()
    const ev = applyEventPatch(blankEvent(id, pid, now), { title: '', ...data }, personExists)
    db.events[id] = ev
    return ev
  },

  'events:delete'(db, data) {
    const e = db.events?.[data?.id]
    if (!e || e.project_id !== db.activeProjectId) throw new Error('Event not found')
    delete db.events[data.id]
    return { id: data.id }
  },

  // ── checkpoint (manual save point over the autosaved working copy) ─────────
  // Everything autosaves through the normal channels; the checkpoint is the
  // user's explicit "Save": a snapshot of the project's ARRANGEMENT state
  // (scenes + tag placements + the current-year override) they can revert to.
  // Entity/relationship/tag data is not part of it — those edits are final.
  'checkpoint:save'(db) {
    const pid = db.activeProjectId as string
    const scenes: Record<string, Scene> = {}
    const scene_tags: Record<string, SceneTag> = {}
    for (const s of Object.values(db.scenes)) {
      if (s.project_id === pid) scenes[s.id] = JSON.parse(JSON.stringify(s))
    }
    for (const st of Object.values(db.scene_tags)) {
      if (db.scenes[st.scene_id]?.project_id === pid) {
        scene_tags[st.id] = JSON.parse(JSON.stringify(st))
      }
    }
    const checkpoint = {
      scenes,
      scene_tags,
      userCurrentYear: db.settings[`${pid}:userCurrentYear`] ?? null
    }
    db.settings[`${pid}:checkpoint`] = JSON.stringify(checkpoint)
    return checkpoint
  },

  // Wholesale-restore the project's arrangement from the saved checkpoint:
  // scenes and placements created since are dropped, deleted ones come back
  // (with their original ids). People/relationships/tags are untouched.
  'checkpoint:revert'(db) {
    const pid = db.activeProjectId as string
    const raw = db.settings[`${pid}:checkpoint`]
    if (typeof raw !== 'string') throw new Error('No saved checkpoint')
    const cp = JSON.parse(raw) as {
      scenes?: Record<string, Scene>
      scene_tags?: Record<string, SceneTag>
      userCurrentYear?: unknown
    }
    for (const [id, s] of Object.entries(db.scenes)) {
      if (s.project_id === pid) {
        cascadeSceneTags(db, { sceneId: id })
        delete db.scenes[id]
      }
    }
    for (const s of Object.values(cp.scenes || {})) db.scenes[s.id] = s
    for (const st of Object.values(cp.scene_tags || {})) db.scene_tags[st.id] = st
    if (cp.userCurrentYear != null) db.settings[`${pid}:userCurrentYear`] = cp.userCurrentYear
    else delete db.settings[`${pid}:userCurrentYear`]
    return cp
  },

  // ── settings (per-project) ─────────────────────────────────────────────────
  'settings:getAll'(db) {
    const result: Record<string, unknown> = {}
    const prefix = `${db.activeProjectId}:`
    for (const [key, value] of Object.entries(db.settings)) {
      if (key.startsWith(prefix)) {
        result[key.slice(prefix.length)] = value
      }
    }
    return result
  },

  'settings:set'(db, data) {
    const { key, value } = data
    db.settings[`${db.activeProjectId}:${key}`] = value
    return { key, value }
  },

  // ── global settings ────────────────────────────────────────────────────────
  'globalSettings:getAll'(db) {
    return { ...db.globalSettings }
  },

  'globalSettings:set'(db, data) {
    db.globalSettings[data.key] = data.value
    return { key: data.key, value: data.value }
  }
}

// ── Undo/redo (src/shared/history.ts) ────────────────────────────────────────
// Register the history:* channels and wrap every undoable data channel so it
// captures a before-snapshot as it runs. Applied here — not in the shells —
// so desktop, web and the tests all get identical history behavior.
Object.assign(channelHandlers, historyHandlers)

// Monetization (src/shared/billing.ts) — plans, quotes, sandbox checkout.
Object.assign(channelHandlers, billingHandlers)
for (const channel of UNDOABLE_CHANNELS) {
  const raw = channelHandlers[channel]
  if (raw) channelHandlers[channel] = withHistory(channel, raw)
}

/** Channels that mutate the DB — the shell persists after handling one. */
export const WRITE_CHANNELS = new Set([
  'auth:register',
  'auth:login',
  'auth:guest',
  'auth:logout',
  'auth:session', // may repair activeProjectId on restore
  'auth:updateProfile',
  'auth:changePassword',
  'projects:create',
  'projects:rename',
  'projects:update',
  'projects:duplicate',
  'projects:import',
  'projects:delete',
  'projects:setActive',
  'persons:create',
  'persons:createMany',
  'persons:update',
  'persons:delete',
  'persons:deleteMany',
  'fields:createDef',
  'fields:updateDef',
  'fields:deleteDef',
  'fields:reorderDefs',
  'fields:setSlot',
  'fields:setValue',
  'fields:setValues',
  'fields:setValuesBatch',
  'fields:removeValue',
  'fields:applyDisplayAll',
  'relationships:create',
  'relationships:update',
  'relationships:delete',
  'relTypes:create',
  'relTypes:update',
  'relTypes:delete',
  'tags:create',
  'tags:update',
  'tags:delete',
  'entity_tags:add',
  'entity_tags:remove',
  'scenes:create',
  'scenes:rename',
  'scenes:duplicate',
  'scenes:save',
  'scenes:delete',
  'scene_tags:add',
  'scene_tags:move',
  'scene_tags:setVisible',
  'scene_tags:remove',
  'checkpoint:save',
  'checkpoint:revert',
  'history:undo',
  'history:redo',
  'images:add',
  'images:setRole',
  'images:setPrimary',
  'images:delete',
  'characters:save',
  'characters:delete',
  'characters:setPortrait',
  'maps:save',
  'maps:delete',
  'eras:save',
  'eras:saveMany',
  'eras:delete',
  'events:save',
  'events:delete',
  'settings:set',
  'globalSettings:set',
  ...BILLING_WRITE_CHANNELS
])
