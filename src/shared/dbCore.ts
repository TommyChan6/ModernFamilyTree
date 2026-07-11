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
  Faction,
  ImageRecord,
  Person,
  Project,
  Relationship,
  Scenario,
  Tag
} from './types'
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
  factions: {},
  scenarios: {},
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
    for (const [fid, f] of Object.entries(db.factions)) {
      if (f.project_id === pid) delete db.factions[fid]
    }
    for (const [sid, s] of Object.entries(db.scenarios)) {
      if (s.project_id === pid) delete db.scenarios[sid]
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
    for (const f of Object.values(db.factions)) {
      if (Array.isArray(f.member_ids) && f.member_ids.includes(data.id)) {
        f.member_ids = f.member_ids.filter((pid) => pid !== data.id)
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

  // ── factions ───────────────────────────────────────────────────────────────
  'factions:getAll'(db) {
    return sortByDate(forProject(db, db.factions))
  },

  'factions:create'(db, data, env) {
    const id = env.uuid()
    const now = env.nowStr()
    const faction: Faction = {
      id,
      project_id: db.activeProjectId as string,
      scenario_id: data?.scenario_id || null,
      name: data?.name || 'New Faction',
      description: data?.description || '',
      color: data?.color || '#6c8ef5',
      icon: data?.icon || '⚑',
      member_ids: Array.isArray(data?.member_ids) ? data.member_ids : [],
      x: data?.x ?? 0,
      y: data?.y ?? 0,
      visible: data?.visible !== false,
      created_at: now,
      updated_at: now
    }
    db.factions[id] = faction
    return faction
  },

  'factions:update'(db, data, env) {
    const existing = db.factions[data.id]
    if (!existing) throw new Error('Faction not found')
    if (data.name !== undefined) existing.name = data.name
    if (data.description !== undefined) existing.description = data.description
    if (data.color !== undefined) existing.color = data.color
    if (data.icon !== undefined) existing.icon = data.icon
    if (data.member_ids !== undefined) existing.member_ids = data.member_ids
    if (data.x !== undefined) existing.x = data.x
    if (data.y !== undefined) existing.y = data.y
    if (data.visible !== undefined) existing.visible = data.visible
    existing.updated_at = env.nowStr()
    return existing
  },

  'factions:delete'(db, data) {
    delete db.factions[data.id]
    return { id: data.id }
  },

  // ── scenarios ──────────────────────────────────────────────────────────────
  'scenarios:getAll'(db) {
    return sortByDate(forProject(db, db.scenarios))
  },

  // With clone_from: duplicates that scenario's factions into the new one, so
  // the client gets scenario + factions in a single round-trip.
  'scenarios:create'(db, data, env) {
    const id = env.uuid()
    const now = env.nowStr()
    const scenario: Scenario = {
      id,
      project_id: db.activeProjectId as string,
      name: data?.name || 'New Scenario',
      created_at: now,
      updated_at: now
    }
    db.scenarios[id] = scenario
    const cloned: Faction[] = []
    if (data?.clone_from) {
      for (const f of Object.values(db.factions)) {
        if (f.scenario_id !== data.clone_from) continue
        const fid = env.uuid()
        const copy: Faction = {
          ...f,
          id: fid,
          scenario_id: id,
          member_ids: [...(f.member_ids || [])],
          created_at: now,
          updated_at: now
        }
        db.factions[fid] = copy
        cloned.push(copy)
      }
    }
    return { scenario, factions: cloned }
  },

  'scenarios:rename'(db, data, env) {
    const scenario = db.scenarios[data.id]
    if (!scenario) throw new Error('Scenario not found')
    scenario.name = data.name
    scenario.updated_at = env.nowStr()
    return scenario
  },

  'scenarios:delete'(db, data) {
    for (const [fid, f] of Object.entries(db.factions)) {
      if (f.scenario_id === data.id) delete db.factions[fid]
    }
    delete db.scenarios[data.id]
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
  'factions:create',
  'factions:update',
  'factions:delete',
  'scenarios:create',
  'scenarios:rename',
  'scenarios:delete',
  'images:add',
  'images:setPrimary',
  'images:delete',
  'settings:set',
  'globalSettings:set'
])
