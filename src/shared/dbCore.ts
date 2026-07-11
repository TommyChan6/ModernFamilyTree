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
  DB,
  EntityTag,
  Env,
  ImageRecord,
  Person,
  Project,
  Relationship,
  Scene,
  SceneTag,
  Tag
} from './types'

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

// ── Channel handlers ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (db: DB, data: any, env: Env) => unknown

export const channelHandlers: Record<string, Handler> = {
  // ── projects ───────────────────────────────────────────────────────────────
  'projects:getAll'(db) {
    return { projects: sortByDate(Object.values(db.projects)), activeProjectId: db.activeProjectId }
  },

  'projects:create'(db, data, env) {
    const id = env.uuid()
    const now = env.nowStr()
    const project: Project = {
      id,
      name: data?.name || 'Unnamed Project',
      created_at: now,
      updated_at: now
    }
    db.projects[id] = project
    return project
  },

  'projects:rename'(db, data, env) {
    const project = db.projects[data.id]
    if (!project) throw new Error('Project not found')
    project.name = data.name
    project.updated_at = env.nowStr()
    return project
  },

  'projects:delete'(db, data, env) {
    const pid = data.id
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

    // Switch active to another project if needed
    if (db.activeProjectId === pid) {
      const remaining = Object.keys(db.projects)
      db.activeProjectId = remaining.length > 0 ? remaining[0] : null
    }
    return { id: pid, newActiveProjectId: db.activeProjectId }
  },

  'projects:setActive'(db, data) {
    if (!db.projects[data.id]) throw new Error('Project not found')
    db.activeProjectId = data.id
    return { activeProjectId: data.id }
  },

  // ── persons ────────────────────────────────────────────────────────────────
  'persons:getAll'(db) {
    const list = sortByDate(forProject(db, db.persons))
    return list.map((p) => ({ ...p, primary_image: primaryImageOf(db, p.id) }))
  },

  'persons:create'(db, data, env) {
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

  // With clone_from: duplicates that scene's tag placements into the new one,
  // so the client gets scene + placements in a single round-trip. Membership
  // lives on the tags and is shared — only positions/visibility are copied.
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
    const cloned: SceneTag[] = []
    if (data?.clone_from) {
      for (const st of Object.values(db.scene_tags)) {
        if (st.scene_id !== data.clone_from) continue
        const rid = env.uuid()
        const copy: SceneTag = { ...st, id: rid, scene_id: id, created_at: now, updated_at: now }
        db.scene_tags[rid] = copy
        cloned.push(copy)
      }
    }
    return { scene, scene_tags: cloned }
  },

  'scenes:rename'(db, data, env) {
    const scene = db.scenes[data.id]
    if (!scene) throw new Error('Scene not found')
    scene.name = data.name
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

  'images:add'(db, data, env) {
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
  'scenes:delete',
  'scene_tags:add',
  'scene_tags:move',
  'scene_tags:setVisible',
  'scene_tags:remove',
  'images:add',
  'images:setPrimary',
  'images:delete',
  'settings:set',
  'globalSettings:set'
])
