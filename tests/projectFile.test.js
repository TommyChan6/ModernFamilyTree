import { describe, it, expect, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'
import {
  channelHandlers,
  createInitialDB,
  PROJECT_FILE_FORMAT,
  PROJECT_FILE_VERSION,
  WRITE_CHANNELS
} from '../src/shared/dbCore'

// Project files (projects:export → projects:import): a whole project as
// portable JSON that re-imports as a NEW project with fresh ids — the same
// remapping engine as projects:duplicate.

const env = {
  uuid: () => randomUUID(),
  nowStr: () => '2026-01-01 00:00:00',
  storeImageFile: (p) => p,
  removeImageFile: () => {}
}
const invoke = (db, channel, data, ctx) => channelHandlers[channel](db, data, env, ctx)
const rowsOf = (db, table, pid) =>
  Object.values(db[table] || {}).filter((r) => r.project_id === pid)
// JSON round-trip, exactly what a download → upload does to the payload.
const viaDisk = (v) => JSON.parse(JSON.stringify(v))

let db
let srcId
beforeEach(() => {
  db = createInitialDB(env)
  srcId = db.activeProjectId
})

describe('projects:export', () => {
  it('writes a versioned file with every project table and no checkpoint', () => {
    db.settings[`${srcId}:noun`] = 'Character'
    db.settings[`${srcId}:checkpoint`] = { huge: true }
    const file = invoke(db, 'projects:export', {})
    expect(file.format).toBe(PROJECT_FILE_FORMAT)
    expect(file.version).toBe(PROJECT_FILE_VERSION)
    expect(file.photosIncluded).toBe(false)
    expect(file.project.name).toBe(db.projects[srcId].name)
    expect(file.rows.persons).toHaveLength(rowsOf(db, 'persons', srcId).length)
    expect(file.rows.relationships).toHaveLength(rowsOf(db, 'relationships', srcId).length)
    expect(file.rows.field_defs.length).toBeGreaterThan(0)
    expect(file.settings.noun).toBe('Character')
    expect(file.settings.checkpoint).toBeUndefined()
  })

  it('only exports the requested project', () => {
    const other = invoke(db, 'projects:create', { name: 'Other' })
    const file = invoke(db, 'projects:export', { id: other.id })
    expect(file.project.name).toBe('Other')
    expect(file.rows.persons).toHaveLength(0)
  })

  it('refuses a project owned by someone else', () => {
    const ctx = { user: { id: 'intruder', plan: 'free' }, token: 't' }
    expect(() => invoke(db, 'projects:export', { id: srcId }, ctx)).toThrow(/not found/i)
  })
})

describe('projects:import', () => {
  it('round-trips a project as a new one with fresh ids', () => {
    const file = viaDisk(invoke(db, 'projects:export', {}))
    const created = invoke(db, 'projects:import', { file })
    expect(created.id).not.toBe(srcId)
    expect(created.name).toBe(db.projects[srcId].name)
    expect(created.visibility).toBe('private')

    for (const table of ['persons', 'relationships', 'tags', 'scenes', 'field_defs']) {
      expect(rowsOf(db, table, created.id)).toHaveLength(rowsOf(db, table, srcId).length)
    }
    const oldIds = new Set(rowsOf(db, 'persons', srcId).map((p) => p.id))
    const newPersons = rowsOf(db, 'persons', created.id)
    expect(newPersons.some((p) => oldIds.has(p.id))).toBe(false)
    expect(newPersons.map((p) => p.name).sort()).toEqual(
      rowsOf(db, 'persons', srcId)
        .map((p) => p.name)
        .sort()
    )
    // Relationships point at the imported people, not the originals.
    const newIds = new Set(newPersons.map((p) => p.id))
    for (const r of rowsOf(db, 'relationships', created.id)) {
      expect(newIds.has(r.person_a_id) && newIds.has(r.person_b_id)).toBe(true)
    }
    // Trait values were remapped too.
    const values = Object.values(db.field_values).filter((v) => newIds.has(v.person_id))
    expect(values.length).toBeGreaterThan(0)
  })

  it('remaps scene positions onto the imported person ids', () => {
    const [p] = rowsOf(db, 'persons', srcId)
    const scene = invoke(db, 'scenes:create', {
      view: 'graph',
      name: 'Layout',
      positions: { [p.id]: { x: 11, y: 22 } }
    })
    const created = invoke(db, 'projects:import', {
      file: viaDisk(invoke(db, 'projects:export', {}))
    })
    const copy = rowsOf(db, 'scenes', created.id).find((s) => s.name === scene.name)
    const [newId] = Object.keys(copy.positions)
    expect(newId).not.toBe(p.id)
    expect(db.persons[newId].name).toBe(p.name)
    expect(copy.positions[newId]).toEqual({ x: 11, y: 22 })
  })

  it('takes a name override and keeps the original untouched', () => {
    const before = rowsOf(db, 'persons', srcId).length
    const created = invoke(db, 'projects:import', {
      file: viaDisk(invoke(db, 'projects:export', {})),
      name: 'Restored'
    })
    expect(created.name).toBe('Restored')
    expect(rowsOf(db, 'persons', srcId)).toHaveLength(before)
  })

  it('rejects things that are not project files', () => {
    expect(() => invoke(db, 'projects:import', { file: null })).toThrow(/Not a project file/)
    expect(() => invoke(db, 'projects:import', { file: { persons: [] } })).toThrow(
      /Not a project file/
    )
    expect(() =>
      invoke(db, 'projects:import', { file: { format: PROJECT_FILE_FORMAT, version: 0 } })
    ).toThrow(/Not a project file/)
  })

  it('rejects files from a newer app version', () => {
    const file = viaDisk(invoke(db, 'projects:export', {}))
    file.version = PROJECT_FILE_VERSION + 1
    expect(() => invoke(db, 'projects:import', { file })).toThrow(/newer version/)
  })

  it('skips malformed rows and self-heals a minimal file', () => {
    const created = invoke(db, 'projects:import', {
      file: {
        format: PROJECT_FILE_FORMAT,
        version: 1,
        project: { name: '  Minimal  ', hue: 999 },
        rows: { persons: [{ id: 'p1', name: 'Solo' }, null, { name: 'no id' }, 'junk'] }
      }
    })
    expect(created.name).toBe('Minimal')
    expect(created.hue).toBeNull()
    const persons = rowsOf(db, 'persons', created.id)
    expect(persons).toHaveLength(1)
    // Locked default traits + built-in relationship types are ensured.
    expect(rowsOf(db, 'field_defs', created.id).length).toBeGreaterThan(0)
    expect(rowsOf(db, 'rel_type_defs', created.id).some((d) => d.key === 'spouse')).toBe(true)
  })

  it('carries relationship dynamics (edge + type sentiment) and backfills old files', () => {
    const [a, b] = rowsOf(db, 'persons', srcId)
    invoke(db, 'relationships:create', {
      person_a_id: a.id,
      person_b_id: b.id,
      type: 'rival',
      sentiment: -0.6,
      intensity: 0.9
    })
    const rival = rowsOf(db, 'rel_type_defs', srcId).find((d) => d.key === 'rival')
    invoke(db, 'relTypes:update', { id: rival.id, sentiment: -0.3 })
    const file = viaDisk(invoke(db, 'projects:export', {}))
    const created = invoke(db, 'projects:import', { file })
    const edge = rowsOf(db, 'relationships', created.id).find((r) => r.type === 'rival')
    expect(edge.sentiment).toBe(-0.6)
    expect(edge.intensity).toBe(0.9)
    const def = rowsOf(db, 'rel_type_defs', created.id).find((d) => d.key === 'rival')
    expect(def.sentiment).toBe(-0.3)
    // A file from before the sentiment layer gets defaults on import.
    for (const d of file.rows.rel_type_defs) delete d.sentiment
    const old = invoke(db, 'projects:import', { file })
    const oldSpouse = rowsOf(db, 'rel_type_defs', old.id).find((d) => d.key === 'spouse')
    expect(typeof oldSpouse.sentiment).toBe('number')
    expect(oldSpouse.sentiment).toBeGreaterThan(0)
  })

  it('enforces the project quota for signed-in users', () => {
    const user = { id: 'u1', plan: 'free' }
    db.users = { u1: { ...user, username: 'u1' } }
    const ctx = { user, token: 't' }
    const file = viaDisk(invoke(db, 'projects:export', {}))
    let err = null
    try {
      for (let i = 0; i < 50; i++) invoke(db, 'projects:import', { file }, ctx)
    } catch (e) {
      err = e
    }
    expect(err?.message).toMatch(/limit reached/)
  })

  it('is a persisted write channel', () => {
    expect(WRITE_CHANNELS.has('projects:import')).toBe(true)
    expect(WRITE_CHANNELS.has('projects:export')).toBe(false)
  })
})
