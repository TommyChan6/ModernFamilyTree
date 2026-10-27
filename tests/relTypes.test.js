import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { randomUUID } from 'crypto'
import { channelHandlers } from '../src/shared/dbCore'
import { BUILTIN_REL_TYPES } from '../src/shared/relTypes'
import { BUILTIN_SENTIMENT } from '../src/shared/sentiment'

// Env for exercising the shared channel handlers directly
const handlerEnv = {
  uuid: () => randomUUID(),
  nowStr: () => '2026-01-01 00:00:00',
  storeImageFile: (p) => p,
  removeImageFile: () => {}
}

// ── Mock Electron's `app` module before importing db.js ─────────────────────
let tmpDir
vi.mock('electron', () => ({
  app: {
    getPath: () => tmpDir
  }
}))

let initDB, getDB
beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-rt-test-'))
  vi.resetModules()
  const mod = await import('../src/main/db.js')
  initDB = mod.initDB
  getDB = mod.getDB
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

const defsOf = (db, pid) => Object.values(db.rel_type_defs).filter((d) => d.project_id === pid)

// ─────────────────────────────────────────────────────────────────────────────
describe('Relationship-type registry — seeding & migration', () => {
  it('seeds the built-in defs for the default project on first run', () => {
    initDB()
    const { db, activeProjectId } = getDB()
    const defs = defsOf(db, activeProjectId)
    expect(defs).toHaveLength(BUILTIN_REL_TYPES.length)
    expect(defs.every((d) => d.builtin)).toBe(true)
    const keys = defs.map((d) => d.key)
    for (const spec of BUILTIN_REL_TYPES) expect(keys).toContain(spec.key)
    // Canonical picker order survives
    const ordered = defs.sort((a, b) => a.order - b.order).map((d) => d.key)
    expect(ordered).toEqual(BUILTIN_REL_TYPES.map((s) => s.key))
  })

  it('is idempotent — re-initializing never duplicates defs', async () => {
    initDB()
    const first = defsOf(getDB().db, getDB().activeProjectId).length
    vi.resetModules()
    const mod2 = await import('../src/main/db.js')
    mod2.initDB()
    const db2 = mod2.getDB()
    expect(defsOf(db2.db, db2.activeProjectId)).toHaveLength(first)
  })

  it('migrates a pre-registry file: defs appear, existing rows keep their keys', async () => {
    initDB()
    const dbPath = path.join(tmpDir, 'db', 'familytree.json')
    const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
    delete raw.rel_type_defs // simulate a file written before the registry
    fs.writeFileSync(dbPath, JSON.stringify(raw))

    vi.resetModules()
    const mod2 = await import('../src/main/db.js')
    mod2.initDB()
    const { db, activeProjectId, relationships } = mod2.getDB()
    expect(defsOf(db, activeProjectId).length).toBe(BUILTIN_REL_TYPES.length)
    // Every seeded relationship's type resolves against the registry
    const keys = new Set(defsOf(db, activeProjectId).map((d) => d.key))
    for (const r of Object.values(relationships)) expect(keys.has(r.type)).toBe(true)
  })

  it('projects:create seeds defs for the new project', () => {
    initDB()
    const { db } = getDB()
    const project = channelHandlers['projects:create'](db, { name: 'P2' }, handlerEnv)
    expect(defsOf(db, project.id)).toHaveLength(BUILTIN_REL_TYPES.length)
  })

  it('projects:delete cascades the project’s defs', () => {
    initDB()
    const { db } = getDB()
    const project = channelHandlers['projects:create'](db, { name: 'Doomed' }, handlerEnv)
    expect(defsOf(db, project.id).length).toBeGreaterThan(0)
    channelHandlers['projects:delete'](db, { id: project.id }, handlerEnv)
    expect(defsOf(db, project.id)).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('relTypes channels', () => {
  it('relTypes:getAll returns the active project’s defs in order', () => {
    initDB()
    const { db } = getDB()
    const defs = channelHandlers['relTypes:getAll'](db, {}, handlerEnv)
    expect(defs.map((d) => d.key)).toEqual(BUILTIN_REL_TYPES.map((s) => s.key))
  })

  it('relTypes:create makes a custom overlay def (weight 0, key = id, appended order)', () => {
    initDB()
    const { db } = getDB()
    const def = channelHandlers['relTypes:create'](db, { label: 'Sworn enemies' }, handlerEnv)
    expect(def.builtin).toBe(false)
    expect(def.key).toBe(def.id)
    expect(def.weight).toBe(0)
    expect(def.band).toBe('custom')
    expect(def.statuses).toEqual(['active', 'ended'])
    const all = channelHandlers['relTypes:getAll'](db, {}, handlerEnv)
    expect(all[all.length - 1].id).toBe(def.id)
  })

  it('relTypes:update clamps weight to −1..1 and tunes builtins', () => {
    initDB()
    const { db } = getDB()
    const spouse = channelHandlers['relTypes:getAll'](db, {}, handlerEnv).find(
      (d) => d.key === 'spouse'
    )
    const updated = channelHandlers['relTypes:update'](
      db,
      { id: spouse.id, weight: 5, color: '#123456' },
      handlerEnv
    )
    expect(updated.weight).toBe(1)
    expect(updated.color).toBe('#123456')
  })

  it('relTypes:update refuses direction/role changes on builtins but allows the generational role', () => {
    initDB()
    const { db } = getDB()
    const pc = channelHandlers['relTypes:getAll'](db, {}, handlerEnv).find(
      (d) => d.key === 'parent_child'
    )
    // directed + role names stay locked on builtins; the generational role is
    // user-tunable on any type (it just tells the layout how to read the edge).
    const after = channelHandlers['relTypes:update'](
      db,
      { id: pc.id, directed: false, symmetryRole: 'none', role_a: 'X' },
      handlerEnv
    )
    expect(after.directed).toBe(true)
    expect(after.role_a).toBe('Parent')
    expect(after.symmetryRole).toBe('none')
    // …and it can be set back.
    const restored = channelHandlers['relTypes:update'](
      db,
      { id: pc.id, symmetryRole: 'vertical' },
      handlerEnv
    )
    expect(restored.symmetryRole).toBe('vertical')

    const custom = channelHandlers['relTypes:create'](db, { label: 'Liege' }, handlerEnv)
    const flipped = channelHandlers['relTypes:update'](
      db,
      { id: custom.id, directed: true, symmetryRole: 'vertical', role_a: 'Lord', role_b: 'Vassal' },
      handlerEnv
    )
    expect(flipped.directed).toBe(true)
    expect(flipped.symmetryRole).toBe('vertical')
    expect(flipped.role_a).toBe('Lord')
  })

  it('relTypes:delete refuses builtins and cascades a custom type’s relationships', () => {
    initDB()
    const { db, activeProjectId } = getDB()
    const builtin = channelHandlers['relTypes:getAll'](db, {}, handlerEnv)[0]
    expect(() => channelHandlers['relTypes:delete'](db, { id: builtin.id }, handlerEnv)).toThrow()

    const custom = channelHandlers['relTypes:create'](db, { label: 'Nemesis' }, handlerEnv)
    const [a, b] = Object.values(db.persons).filter((p) => p.project_id === activeProjectId)
    const rel = channelHandlers['relationships:create'](
      db,
      { person_a_id: a.id, person_b_id: b.id, type: custom.key },
      handlerEnv
    )
    const res = channelHandlers['relTypes:delete'](db, { id: custom.id }, handlerEnv)
    expect(res.removedRelationships).toContain(rel.id)
    expect(db.relationships[rel.id]).toBeUndefined()
    expect(db.rel_type_defs[custom.id]).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('relationships channels against the registry', () => {
  it('relationships:create rejects a type with no def', () => {
    initDB()
    const { db, activeProjectId } = getDB()
    const [a, b] = Object.values(db.persons).filter((p) => p.project_id === activeProjectId)
    expect(() =>
      channelHandlers['relationships:create'](
        db,
        { person_a_id: a.id, person_b_id: b.id, type: 'nonsense' },
        handlerEnv
      )
    ).toThrow(/Unknown relationship type/)
  })

  it('relationships:create accepts new built-in types and defaults status from the def', () => {
    initDB()
    const { db, activeProjectId } = getDB()
    const [a, b] = Object.values(db.persons).filter((p) => p.project_id === activeProjectId)
    const rel = channelHandlers['relationships:create'](
      db,
      { person_a_id: a.id, person_b_id: b.id, type: 'friends' },
      handlerEnv
    )
    expect(rel.type).toBe('friends')
    expect(rel.status).toBe('active')
    expect(rel.ended).toBeNull()
    expect(rel.label).toBeNull()
  })

  it('relationships:update round-trips label, ended, and a validated type change', () => {
    initDB()
    const { db, activeProjectId } = getDB()
    const [a, b] = Object.values(db.persons).filter((p) => p.project_id === activeProjectId)
    const rel = channelHandlers['relationships:create'](
      db,
      { person_a_id: a.id, person_b_id: b.id, type: 'friends' },
      handlerEnv
    )
    const updated = channelHandlers['relationships:update'](
      db,
      {
        id: rel.id,
        type: 'rival',
        label: 'old sparring partners',
        ended: { year: 1999, month: null, day: null, precision: 'year', calendar: 'gregorian' }
      },
      handlerEnv
    )
    expect(updated.type).toBe('rival')
    expect(updated.label).toBe('old sparring partners')
    expect(updated.ended.year).toBe(1999)
    expect(() =>
      channelHandlers['relationships:update'](db, { id: rel.id, type: 'bogus' }, handlerEnv)
    ).toThrow(/Unknown relationship type/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('relationship dynamics — the sentiment layer', () => {
  it('seeds every builtin with its default sentiment', () => {
    initDB()
    const { db } = getDB()
    const defs = channelHandlers['relTypes:getAll'](db, {}, handlerEnv)
    for (const spec of BUILTIN_REL_TYPES) {
      expect(defs.find((d) => d.key === spec.key).sentiment).toBe(spec.sentiment)
    }
    const p = channelHandlers['projects:create'](db, { name: 'Warm' }, handlerEnv)
    const spouse = defsOf(db, p.id).find((d) => d.key === 'spouse')
    expect(spouse.sentiment).toBe(BUILTIN_SENTIMENT.spouse)
  })

  it('migration backfills sentiment on defs saved before the layer', async () => {
    initDB()
    const dbPath = path.join(tmpDir, 'db', 'familytree.json')
    const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
    const custom = {
      ...Object.values(raw.rel_type_defs)[0],
      id: 'custom-1',
      key: 'custom-1',
      builtin: false
    }
    raw.rel_type_defs[custom.id] = custom
    for (const d of Object.values(raw.rel_type_defs)) delete d.sentiment
    fs.writeFileSync(dbPath, JSON.stringify(raw))

    vi.resetModules()
    const mod2 = await import('../src/main/db.js')
    mod2.initDB()
    const { db, activeProjectId } = mod2.getDB()
    const defs = defsOf(db, activeProjectId)
    expect(defs.find((d) => d.key === 'rival').sentiment).toBe(BUILTIN_SENTIMENT.rival)
    expect(defs.find((d) => d.key === 'spouse').sentiment).toBe(BUILTIN_SENTIMENT.spouse)
    expect(defs.find((d) => d.id === 'custom-1').sentiment).toBe(0)
    // persisted, and a second pass is a no-op
    const saved = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
    expect(saved.rel_type_defs['custom-1'].sentiment).toBe(0)
  })

  it('relTypes:create/update clamp sentiment; builtins stay tunable', () => {
    initDB()
    const { db } = getDB()
    const fresh = channelHandlers['relTypes:create'](db, { label: 'Feud' }, handlerEnv)
    expect(fresh.sentiment).toBe(0)
    const cold = channelHandlers['relTypes:create'](
      db,
      { label: 'Nemesis', sentiment: -7 },
      handlerEnv
    )
    expect(cold.sentiment).toBe(-1)
    const rival = channelHandlers['relTypes:getAll'](db, {}, handlerEnv).find(
      (d) => d.key === 'rival'
    )
    const upd = channelHandlers['relTypes:update'](
      db,
      { id: rival.id, sentiment: 'junk' },
      handlerEnv
    )
    expect(upd.sentiment).toBe(0)
    expect(
      channelHandlers['relTypes:update'](db, { id: rival.id, sentiment: 0.4 }, handlerEnv).sentiment
    ).toBe(0.4)
    expect(upd.builtin).toBe(true)
  })

  it('relationships:create/update clamp edge sentiment & intensity (null = inherit)', () => {
    initDB()
    const { db, activeProjectId } = getDB()
    const [a, b] = Object.values(db.persons).filter((p) => p.project_id === activeProjectId)
    const plain = channelHandlers['relationships:create'](
      db,
      { person_a_id: a.id, person_b_id: b.id, type: 'friends' },
      handlerEnv
    )
    expect(plain.sentiment).toBe(null)
    expect(plain.intensity).toBe(null)
    const rel = channelHandlers['relationships:create'](
      db,
      { person_a_id: a.id, person_b_id: b.id, type: 'rival', sentiment: -4, intensity: 3 },
      handlerEnv
    )
    expect(rel.sentiment).toBe(-1)
    expect(rel.intensity).toBe(1)
    let upd = channelHandlers['relationships:update'](
      db,
      { id: rel.id, sentiment: 0.35, intensity: -1 },
      handlerEnv
    )
    expect(upd.sentiment).toBe(0.35)
    expect(upd.intensity).toBe(0)
    upd = channelHandlers['relationships:update'](
      db,
      { id: rel.id, sentiment: null, intensity: 'x' },
      handlerEnv
    )
    expect(upd.sentiment).toBe(null)
    expect(upd.intensity).toBe(null)
    // untouched when absent from the patch
    channelHandlers['relationships:update'](db, { id: rel.id, intensity: 0.8 }, handlerEnv)
    upd = channelHandlers['relationships:update'](db, { id: rel.id, label: 'x' }, handlerEnv)
    expect(upd.intensity).toBe(0.8)
  })

  it('edge feelings survive undo/redo', () => {
    initDB()
    const { db, activeProjectId } = getDB()
    const [a, b] = Object.values(db.persons).filter((p) => p.project_id === activeProjectId)
    const rel = channelHandlers['relationships:create'](
      db,
      { person_a_id: a.id, person_b_id: b.id, type: 'friends', sentiment: 0.2 },
      handlerEnv
    )
    channelHandlers['relationships:update'](db, { id: rel.id, sentiment: -0.9 }, handlerEnv)
    expect(db.relationships[rel.id].sentiment).toBe(-0.9)
    channelHandlers['history:undo'](db, {}, handlerEnv)
    expect(db.relationships[rel.id].sentiment).toBe(0.2)
    channelHandlers['history:redo'](db, {}, handlerEnv)
    expect(db.relationships[rel.id].sentiment).toBe(-0.9)
  })
})
