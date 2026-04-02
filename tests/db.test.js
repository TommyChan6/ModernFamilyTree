import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

// ── Mock Electron's `app` module before importing db.js ─────────────────────
let tmpDir
vi.mock('electron', () => ({
  app: {
    getPath: (name) => {
      if (name === 'userData') return tmpDir
      return tmpDir
    }
  }
}))

let initDB, getDB
beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-test-'))
  vi.resetModules()
  const mod = await import('../src/main/db.js')
  initDB = mod.initDB
  getDB = mod.getDB
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Database initialization', () => {
  it('creates db directory and JSON file on first run', () => {
    initDB()
    const dbPath = path.join(tmpDir, 'db', 'familytree.json')
    expect(fs.existsSync(dbPath)).toBe(true)
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
    expect(data).toHaveProperty('trees')
    expect(data).toHaveProperty('persons')
    expect(data).toHaveProperty('relationships')
    expect(data).toHaveProperty('settings')
    expect(data).toHaveProperty('globalSettings')
  })

  it('creates a default tree on first run', () => {
    initDB()
    const { trees, activeTreeId } = getDB()
    const treeList = Object.values(trees)
    expect(treeList).toHaveLength(1)
    expect(treeList[0].name).toBe('Unnamed Family Tree')
    expect(activeTreeId).toBe(treeList[0].id)
  })

  it('seeds 6 sample persons tagged with the default tree', () => {
    initDB()
    const { persons, activeTreeId } = getDB()
    const treePersons = Object.values(persons).filter(p => p.tree_id === activeTreeId)
    expect(treePersons).toHaveLength(6)
  })

  it('seeds 8 relationships tagged with the default tree', () => {
    initDB()
    const { relationships, activeTreeId } = getDB()
    const treeRels = Object.values(relationships).filter(r => r.tree_id === activeTreeId)
    expect(treeRels).toHaveLength(8)
  })

  it('does not re-seed when database already exists', () => {
    initDB()
    const { persons, activeTreeId } = getDB()
    const ids = Object.values(persons).filter(p => p.tree_id === activeTreeId).map(p => p.id)
    expect(ids).toHaveLength(6)

    vi.resetModules()
    return import('../src/main/db.js').then(mod2 => {
      mod2.initDB()
      const db2 = mod2.getDB()
      const ids2 = Object.values(db2.persons).filter(p => p.tree_id === db2.activeTreeId).map(p => p.id)
      expect(ids2).toHaveLength(6)
      expect(ids2.sort()).toEqual(ids.sort())
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Multi-tree support', () => {
  it('can create a second tree', () => {
    initDB()
    const { trees, save, nowStr } = getDB()
    const id = 'tree-2'
    trees[id] = { id, name: 'Second Tree', created_at: nowStr(), updated_at: nowStr() }
    save()

    const dbPath = path.join(tmpDir, 'db', 'familytree.json')
    const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
    expect(Object.keys(raw.trees)).toHaveLength(2)
    expect(raw.trees[id].name).toBe('Second Tree')
  })

  it('persons are scoped to their tree via tree_id', () => {
    initDB()
    const { persons, trees, save, nowStr, activeTreeId } = getDB()

    // Create second tree
    const tree2Id = 'tree-second'
    trees[tree2Id] = { id: tree2Id, name: 'Other Family', created_at: nowStr(), updated_at: nowStr() }

    // Add person to second tree
    persons['p-other'] = {
      id: 'p-other', tree_id: tree2Id, name: 'Other Person',
      birth_year: 2000, death_year: null, gender: 'female',
      bio: '', occupation: '', location: '',
      created_at: nowStr(), updated_at: nowStr()
    }
    save()

    // Filter by tree
    const tree1Persons = Object.values(persons).filter(p => p.tree_id === activeTreeId)
    const tree2Persons = Object.values(persons).filter(p => p.tree_id === tree2Id)
    expect(tree1Persons).toHaveLength(6) // seed data
    expect(tree2Persons).toHaveLength(1)
    expect(tree2Persons[0].name).toBe('Other Person')
  })

  it('settings are scoped per tree', () => {
    initDB()
    const { settings, activeTreeId, save } = getDB()

    const tree2Id = 'tree-2'
    settings[`${activeTreeId}:graphState`] = '{"mode":"auto"}'
    settings[`${tree2Id}:graphState`] = '{"mode":"generation"}'
    save()

    const dbPath = path.join(tmpDir, 'db', 'familytree.json')
    const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'))

    // Each tree has separate settings
    expect(raw.settings[`${activeTreeId}:graphState`]).toBe('{"mode":"auto"}')
    expect(raw.settings[`${tree2Id}:graphState`]).toBe('{"mode":"generation"}')
  })

  it('global settings are separate from tree settings', () => {
    initDB()
    const { globalSettings, save } = getDB()
    globalSettings.theme = 'light'
    save()

    const dbPath = path.join(tmpDir, 'db', 'familytree.json')
    const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
    expect(raw.globalSettings.theme).toBe('light')
  })

  it('deleting a tree removes its persons and relationships', () => {
    initDB()
    const { trees, persons, relationships, activeTreeId, save, nowStr } = getDB()

    // Create second tree with data
    const tree2Id = 'tree-del'
    trees[tree2Id] = { id: tree2Id, name: 'Delete Me', created_at: nowStr(), updated_at: nowStr() }
    persons['dp1'] = { id: 'dp1', tree_id: tree2Id, name: 'Del Person', birth_year: 1990, death_year: null, gender: 'male', bio: '', occupation: '', location: '', created_at: nowStr(), updated_at: nowStr() }
    relationships['dr1'] = { id: 'dr1', tree_id: tree2Id, person_a_id: 'dp1', person_b_id: 'dp1', type: 'spouse', status: 'active', formed_date: null, created_at: nowStr() }
    save()

    expect(Object.values(persons).filter(p => p.tree_id === tree2Id)).toHaveLength(1)

    // Delete tree
    for (const [pid, p] of Object.entries(persons)) { if (p.tree_id === tree2Id) delete persons[pid] }
    for (const [rid, r] of Object.entries(relationships)) { if (r.tree_id === tree2Id) delete relationships[rid] }
    delete trees[tree2Id]
    save()

    expect(Object.values(persons).filter(p => p.tree_id === tree2Id)).toHaveLength(0)
    expect(Object.values(relationships).filter(r => r.tree_id === tree2Id)).toHaveLength(0)
    expect(trees[tree2Id]).toBeUndefined()
    // Original tree untouched
    expect(Object.values(persons).filter(p => p.tree_id === activeTreeId)).toHaveLength(6)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Migration from single-tree to multi-tree', () => {
  it('migrates an old single-tree database on init', () => {
    // Create an old-format database (no trees, no tree_id on persons)
    const dbDir = path.join(tmpDir, 'db')
    fs.mkdirSync(dbDir, { recursive: true })
    const oldDb = {
      persons: {
        'p1': { id: 'p1', name: 'Old Person', birth_year: 1980, death_year: null, gender: 'male', bio: '', occupation: '', location: '', created_at: '2024-01-01', updated_at: '2024-01-01' }
      },
      relationships: {
        'r1': { id: 'r1', person_a_id: 'p1', person_b_id: 'p1', type: 'spouse', created_at: '2024-01-01' }
      },
      images: {},
      settings: { theme: 'dark', graphState: '{"mode":"auto"}' }
    }
    fs.writeFileSync(path.join(dbDir, 'familytree.json'), JSON.stringify(oldDb))

    initDB()
    const db = getDB()

    // Should have created a tree
    const treeList = Object.values(db.trees)
    expect(treeList).toHaveLength(1)
    expect(treeList[0].name).toBe('Unnamed Family Tree')
    expect(db.activeTreeId).toBe(treeList[0].id)

    // Person should have tree_id
    expect(db.persons['p1'].tree_id).toBe(treeList[0].id)
    expect(db.relationships['r1'].tree_id).toBe(treeList[0].id)

    // Theme should be in globalSettings
    expect(db.globalSettings.theme).toBe('dark')

    // Tree-scoped settings should be prefixed
    const treeId = treeList[0].id
    expect(db.settings[`${treeId}:graphState`]).toBe('{"mode":"auto"}')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Person CRUD', () => {
  it('creates a person with tree_id and persists to disk', () => {
    initDB()
    const { persons, activeTreeId, save, nowStr } = getDB()
    const id = 'test-person-1'
    persons[id] = {
      id, tree_id: activeTreeId,
      name: 'Test Person', birth_year: 1990, death_year: null,
      gender: 'male', bio: 'A test person', occupation: 'Tester', location: 'Test City',
      created_at: nowStr(), updated_at: nowStr()
    }
    save()

    const dbPath = path.join(tmpDir, 'db', 'familytree.json')
    const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
    expect(raw.persons[id]).toBeDefined()
    expect(raw.persons[id].name).toBe('Test Person')
    expect(raw.persons[id].tree_id).toBe(activeTreeId)
  })

  it('deletes a person and cascades relationships', () => {
    initDB()
    const { persons, relationships, activeTreeId, save } = getDB()
    const personIds = Object.values(persons).filter(p => p.tree_id === activeTreeId).map(p => p.id)
    const targetId = personIds[2]

    const relsBefore = Object.values(relationships).filter(
      r => r.person_a_id === targetId || r.person_b_id === targetId
    )
    expect(relsBefore.length).toBeGreaterThan(0)

    for (const [rid, rel] of Object.entries(relationships)) {
      if (rel.person_a_id === targetId || rel.person_b_id === targetId) delete relationships[rid]
    }
    delete persons[targetId]
    save()

    const dbPath = path.join(tmpDir, 'db', 'familytree.json')
    const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
    expect(raw.persons[targetId]).toBeUndefined()
    const relsAfter = Object.values(raw.relationships).filter(
      r => r.person_a_id === targetId || r.person_b_id === targetId
    )
    expect(relsAfter).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Graph state persistence (per-tree)', () => {
  it('saves and restores graph state scoped to tree', () => {
    initDB()
    const { persons, settings, activeTreeId, save } = getDB()
    const personIds = Object.values(persons).filter(p => p.tree_id === activeTreeId).map(p => p.id)

    const graphState = {
      currentMode: 'generation',
      activeEmphasis: 'paternal',
      modeEmphasis: { custom: 'default', auto: 'default', age: 'default', generation: 'paternal' },
      modeStateNames: { custom: ['State 1'], auto: ['State 1'], age: ['State 1'], generation: ['State 1', 'State 2'] },
      modeActiveStateIdx: { custom: 0, auto: 0, age: 0, generation: 0 },
      modeStateSnapshots: {
        custom: [Object.fromEntries(personIds.map((id, i) => [id, { x: 100 + i * 50, y: 200 }]))],
        auto: [Object.fromEntries(personIds.map((id, i) => [id, { x: 150 + i * 40, y: 300 }]))],
        age: [Object.fromEntries(personIds.map((id, i) => [id, { x: 120 + i * 60, y: 100 + i * 80 }]))],
        generation: [{
          ...Object.fromEntries(personIds.map((id, i) => [id, { x: 100 + i * 70, y: [100, 100, 250, 250, 400, 400][i] }])),
          _genRowYValues: [100, 250, 400],
          _genRowSpacing: 150
        }]
      },
      genRowSpacing: 150
    }

    // Save scoped to tree
    settings[`${activeTreeId}:graphState`] = JSON.stringify(graphState)
    save()

    // Read back
    const dbPath = path.join(tmpDir, 'db', 'familytree.json')
    const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
    const restored = JSON.parse(raw.settings[`${activeTreeId}:graphState`])

    expect(restored.currentMode).toBe('generation')
    expect(restored.modeStateSnapshots.generation[0]._genRowYValues).toEqual([100, 250, 400])
    expect(restored.modeStateSnapshots.generation[0][personIds[0]]).toEqual({ x: 100, y: 100 })
  })

  it('different trees have independent graph states', () => {
    initDB()
    const { trees, settings, activeTreeId, save, nowStr } = getDB()

    const tree2Id = 'tree-2-gs'
    trees[tree2Id] = { id: tree2Id, name: 'Tree 2', created_at: nowStr(), updated_at: nowStr() }

    settings[`${activeTreeId}:graphState`] = JSON.stringify({ currentMode: 'auto' })
    settings[`${tree2Id}:graphState`] = JSON.stringify({ currentMode: 'generation' })
    save()

    const dbPath = path.join(tmpDir, 'db', 'familytree.json')
    const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'))

    expect(JSON.parse(raw.settings[`${activeTreeId}:graphState`]).currentMode).toBe('auto')
    expect(JSON.parse(raw.settings[`${tree2Id}:graphState`]).currentMode).toBe('generation')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Data integrity', () => {
  it('person fields are all preserved through save/load cycle', () => {
    initDB()
    const { persons, activeTreeId, save, nowStr } = getDB()
    const id = 'integrity-test'
    persons[id] = {
      id, tree_id: activeTreeId,
      name: 'Full Field Test', birth_year: 1985, death_year: 2050,
      gender: 'female', bio: 'Bio with special chars: "quotes", <tags>, & ampersand',
      occupation: 'Engineer & Designer', location: 'New York, NY',
      created_at: '2026-01-15 10:30:00', updated_at: '2026-03-31 12:00:00'
    }
    save()

    const dbPath = path.join(tmpDir, 'db', 'familytree.json')
    const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
    const p = raw.persons[id]
    expect(p.name).toBe('Full Field Test')
    expect(p.bio).toBe('Bio with special chars: "quotes", <tags>, & ampersand')
    expect(p.tree_id).toBe(activeTreeId)
  })

  it('empty/null fields do not corrupt the database', () => {
    initDB()
    const { persons, activeTreeId, save, nowStr } = getDB()
    persons['null-test'] = {
      id: 'null-test', tree_id: activeTreeId,
      name: '', birth_year: null, death_year: null, gender: 'unknown',
      bio: '', occupation: '', location: '',
      created_at: nowStr(), updated_at: nowStr()
    }
    save()
    expect(() => getDB()).not.toThrow()
  })
})
