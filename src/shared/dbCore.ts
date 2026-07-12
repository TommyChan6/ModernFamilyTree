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
  DB,
  EntityTag,
  Env,
  ImageRecord,
  Person,
  Project,
  ProjectOverview,
  PublicUser,
  Relationship,
  Scene,
  SceneTag,
  Session,
  Tag,
  UsageInfo,
  User
} from './types'
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

function sortByDate<T extends { created_at: string }>(arr: T[]): T[] {
  return arr.slice().sort((a, b) => (a.created_at > b.created_at ? 1 : -1))
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
  relationships: {},
  tags: {},
  entity_tags: {},
  scenes: {},
  scene_tags: {},
  images: {},
  settings: {},
  globalSettings: {}
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

    let activeSceneId: string | null = null
    for (const mode of ['custom', 'auto', 'age', 'generation']) {
      const names: string[] = state.modeStateNames?.[mode] || []
      const snaps: unknown[] = state.modeStateSnapshots?.[mode] || []
      const count = Math.max(names.length, snaps.length)
      for (let i = 0; i < count; i++) {
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

        const id = env.uuid()
        const now = env.nowStr()
        const scene: Scene = {
          id,
          project_id: pid,
          view: 'graph',
          name: names[i] || `State ${i + 1}`,
          type: MODE_TO_TYPE[mode],
          config,
          positions,
          created_at: now,
          updated_at: now
        }
        db.scenes[id] = scene
        const activeIdx = state.modeActiveStateIdx?.[mode] ?? 0
        if (mode === (state.currentMode || 'auto') && i === activeIdx) activeSceneId = id
        changed = true
      }
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (db: DB, data: any, env: Env, ctx?: AuthCtx) => unknown

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
        delete db.persons[id]
      }
    }
    for (const [rid, r] of Object.entries(db.relationships)) {
      if (r.project_id === pid) delete db.relationships[rid]
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
    if (ctx?.user) {
      const usage = usageOf(db, ctx.user)
      if (usage.persons >= usage.maxPersons) {
        throw new Error(`Free plan limit reached: ${usage.maxPersons} people`)
      }
    }
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
    return { ...person, primary_image: null }
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
    return { ...updated, primary_image: primaryImageOf(db, data.id) }
  },

  'persons:delete'(db, data, env) {
    for (const [rid, rel] of Object.entries(db.relationships)) {
      if (rel.person_a_id === data.id || rel.person_b_id === data.id) {
        delete db.relationships[rid]
      }
    }
    for (const [iid, img] of Object.entries(db.images)) {
      if (img.person_id === data.id) {
        env.removeImageFile(img.file_path)
        delete db.images[iid]
      }
    }
    cascadeEntityTags(db, { entityId: data.id })
    delete db.persons[data.id]
    return { id: data.id }
  },

  // ── relationships ──────────────────────────────────────────────────────────
  'relationships:getAll'(db) {
    return sortByDate(forProject(db, db.relationships))
  },

  'relationships:create'(db, data, env) {
    const id = env.uuid()
    const rel: Relationship = {
      id,
      project_id: db.activeProjectId as string,
      person_a_id: data.person_a_id,
      person_b_id: data.person_b_id,
      type: data.type,
      status: data.status || 'active',
      formed: data.formed ?? null,
      created_at: env.nowStr()
    }
    db.relationships[id] = rel
    return rel
  },

  'relationships:update'(db, data) {
    const existing = db.relationships[data.id]
    if (!existing) throw new Error('Relationship not found')
    if (data.status !== undefined) existing.status = data.status
    if (data.formed !== undefined) existing.formed = data.formed
    if (data.type !== undefined) existing.type = data.type
    if (data.person_a_id !== undefined) existing.person_a_id = data.person_a_id
    if (data.person_b_id !== undefined) existing.person_b_id = data.person_b_id
    return existing
  },

  'relationships:delete'(db, data) {
    delete db.relationships[data.id]
    return { id: data.id }
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
    const id = env.uuid()
    const img: ImageRecord = {
      id,
      project_id: db.activeProjectId as string,
      person_id: personId,
      file_path: filePath,
      is_primary: !!isPrimary,
      created_at: env.nowStr()
    }
    db.images[id] = img
    return img
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
  'projects:delete',
  'projects:setActive',
  'persons:create',
  'persons:update',
  'persons:delete',
  'relationships:create',
  'relationships:update',
  'relationships:delete',
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
  'images:add',
  'images:setPrimary',
  'images:delete',
  'settings:set',
  'globalSettings:set'
])
