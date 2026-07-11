import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { randomUUID } from 'crypto'
import { yearDate } from '../src/shared/calendarMath'
import { channelHandlers } from '../src/shared/dbCore'

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
    expect(data).toHaveProperty('projects')
    expect(data).toHaveProperty('persons')
    expect(data).toHaveProperty('relationships')
    expect(data).toHaveProperty('factions')
    expect(data).toHaveProperty('scenes')
    expect(data).toHaveProperty('settings')
    expect(data).toHaveProperty('globalSettings')
  })

  it('creates a default project on first run', () => {
    initDB()
    const { projects, activeProjectId } = getDB()
    const projectList = Object.values(projects)
    expect(projectList).toHaveLength(1)
    expect(projectList[0].name).toBe('Unnamed Project')
    expect(activeProjectId).toBe(projectList[0].id)
  })

  it('seeds 6 sample persons tagged with the default project', () => {
    initDB()
    const { persons, activeProjectId } = getDB()
    const projectPersons = Object.values(persons).filter((p) => p.project_id === activeProjectId)
    expect(projectPersons).toHaveLength(6)
  })

  it('seeds 8 relationships tagged with the default project', () => {
    initDB()
    const { relationships, activeProjectId } = getDB()
    const projectRels = Object.values(relationships).filter((r) => r.project_id === activeProjectId)
    expect(projectRels).toHaveLength(8)
  })

  it('does not re-seed when database already exists', () => {
    initDB()
    const { persons, activeProjectId } = getDB()
    const ids = Object.values(persons)
      .filter((p) => p.project_id === activeProjectId)
      .map((p) => p.id)
    expect(ids).toHaveLength(6)

    vi.resetModules()
    return import('../src/main/db.js').then((mod2) => {
      mod2.initDB()
      const db2 = mod2.getDB()
      const ids2 = Object.values(db2.persons)
        .filter((p) => p.project_id === db2.activeProjectId)
        .map((p) => p.id)
      expect(ids2).toHaveLength(6)
      expect(ids2.sort()).toEqual(ids.sort())
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Multi-project support', () => {
  it('can create a second project', () => {
    initDB()
    const { projects, save, nowStr } = getDB()
    const id = 'project-2'
    projects[id] = { id, name: 'Second Project', created_at: nowStr(), updated_at: nowStr() }
    save()

    const dbPath = path.join(tmpDir, 'db', 'familytree.json')
    const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
    expect(Object.keys(raw.projects)).toHaveLength(2)
    expect(raw.projects[id].name).toBe('Second Project')
  })

  it('persons are scoped to their project via project_id', () => {
    initDB()
    const { persons, projects, save, nowStr, activeProjectId } = getDB()

    // Create second project
    const project2Id = 'project-second'
    projects[project2Id] = {
      id: project2Id,
      name: 'Other Family',
      created_at: nowStr(),
      updated_at: nowStr()
    }

    // Add person to second project
    persons['p-other'] = {
      id: 'p-other',
      project_id: project2Id,
      name: 'Other Person',
      birth: yearDate(2000),
      death: null,
      gender: 'female',
      bio: '',
      occupation: '',
      location: '',
      created_at: nowStr(),
      updated_at: nowStr()
    }
    save()

    // Filter by project
    const p1Persons = Object.values(persons).filter((p) => p.project_id === activeProjectId)
    const p2Persons = Object.values(persons).filter((p) => p.project_id === project2Id)
    expect(p1Persons).toHaveLength(6) // seed data
    expect(p2Persons).toHaveLength(1)
    expect(p2Persons[0].name).toBe('Other Person')
  })

  it('settings are scoped per project', () => {
    initDB()
    const { settings, activeProjectId, save } = getDB()

    const project2Id = 'project-2'
    settings[`${activeProjectId}:graphState`] = '{"mode":"auto"}'
    settings[`${project2Id}:graphState`] = '{"mode":"generation"}'
    save()

    const dbPath = path.join(tmpDir, 'db', 'familytree.json')
    const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'))

    // Each project has separate settings
    expect(raw.settings[`${activeProjectId}:graphState`]).toBe('{"mode":"auto"}')
    expect(raw.settings[`${project2Id}:graphState`]).toBe('{"mode":"generation"}')
  })

  it('global settings are separate from project settings', () => {
    initDB()
    const { globalSettings, save } = getDB()
    globalSettings.theme = 'light'
    save()

    const dbPath = path.join(tmpDir, 'db', 'familytree.json')
    const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
    expect(raw.globalSettings.theme).toBe('light')
  })

  it('deleting a project removes its persons and relationships', () => {
    initDB()
    const { projects, persons, relationships, activeProjectId, save, nowStr } = getDB()

    // Create second project with data
    const project2Id = 'project-del'
    projects[project2Id] = {
      id: project2Id,
      name: 'Delete Me',
      created_at: nowStr(),
      updated_at: nowStr()
    }
    persons['dp1'] = {
      id: 'dp1',
      project_id: project2Id,
      name: 'Del Person',
      birth: yearDate(1990),
      death: null,
      gender: 'male',
      bio: '',
      occupation: '',
      location: '',
      created_at: nowStr(),
      updated_at: nowStr()
    }
    relationships['dr1'] = {
      id: 'dr1',
      project_id: project2Id,
      person_a_id: 'dp1',
      person_b_id: 'dp1',
      type: 'spouse',
      status: 'active',
      formed: null,
      created_at: nowStr()
    }
    save()

    expect(Object.values(persons).filter((p) => p.project_id === project2Id)).toHaveLength(1)

    // Delete project
    for (const [pid, p] of Object.entries(persons)) {
      if (p.project_id === project2Id) delete persons[pid]
    }
    for (const [rid, r] of Object.entries(relationships)) {
      if (r.project_id === project2Id) delete relationships[rid]
    }
    delete projects[project2Id]
    save()

    expect(Object.values(persons).filter((p) => p.project_id === project2Id)).toHaveLength(0)
    expect(Object.values(relationships).filter((r) => r.project_id === project2Id)).toHaveLength(0)
    expect(projects[project2Id]).toBeUndefined()
    // Original project untouched
    expect(Object.values(persons).filter((p) => p.project_id === activeProjectId)).toHaveLength(6)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Migration from tree vocabulary to project vocabulary', () => {
  it('migrates an old multi-tree database (trees/tree_id/activeTreeId) in place', () => {
    const dbDir = path.join(tmpDir, 'db')
    fs.mkdirSync(dbDir, { recursive: true })
    const oldDb = {
      trees: {
        t1: { id: 't1', name: 'Old Tree', created_at: '2024-01-01', updated_at: '2024-01-01' },
        t2: { id: 't2', name: 'Other Tree', created_at: '2024-01-02', updated_at: '2024-01-02' }
      },
      activeTreeId: 't2',
      persons: {
        p1: {
          id: 'p1',
          tree_id: 't1',
          name: 'Old Person',
          birth_year: 1980,
          death_year: null,
          gender: 'male',
          bio: '',
          occupation: '',
          location: '',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        }
      },
      relationships: {
        r1: {
          id: 'r1',
          tree_id: 't1',
          person_a_id: 'p1',
          person_b_id: 'p1',
          type: 'spouse',
          status: 'active',
          formed_date: null,
          created_at: '2024-01-01'
        }
      },
      factions: {
        f1: {
          id: 'f1',
          tree_id: 't1',
          scenario_id: 's1',
          name: 'F',
          description: '',
          color: '#6c8ef5',
          icon: '⚑',
          member_ids: ['p1'],
          x: 0,
          y: 0,
          visible: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        }
      },
      scenarios: {
        s1: {
          id: 's1',
          tree_id: 't1',
          name: 'S',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        }
      },
      images: {},
      settings: { 't1:graphState': '{"currentMode":"auto"}' },
      globalSettings: { theme: 'dark' }
    }
    fs.writeFileSync(path.join(dbDir, 'familytree.json'), JSON.stringify(oldDb))

    initDB()
    const db = getDB()

    // Renamed collections and pointer
    expect(db.db.trees).toBeUndefined()
    expect(db.db.activeTreeId).toBeUndefined()
    expect(Object.keys(db.projects).sort()).toEqual(['t1', 't2'])
    expect(db.projects.t1.name).toBe('Old Tree')
    expect(db.activeProjectId).toBe('t2')

    // Rows renamed tree_id → project_id
    expect(db.persons.p1.project_id).toBe('t1')
    expect(db.persons.p1.tree_id).toBeUndefined()
    expect(db.relationships.r1.project_id).toBe('t1')
    expect(db.factions.f1.project_id).toBe('t1')

    // The old scenario became a groups scene with the same id
    expect(db.scenes.s1.project_id).toBe('t1')
    expect(db.scenes.s1.view).toBe('groups')
    expect(db.db.scenarios).toBeUndefined()

    // Year numbers wrapped as DateValues
    expect(db.persons.p1.birth).toEqual(yearDate(1980))
    expect(db.persons.p1.death).toBeNull()
    expect(db.persons.p1.birth_year).toBeUndefined()
    expect(db.relationships.r1.formed).toBeNull()
    expect(db.relationships.r1.formed_date).toBeUndefined()

    // Settings keys (keyed by id, not name) survive untouched
    expect(db.settings['t1:graphState']).toBe('{"currentMode":"auto"}')

    // Persisted to disk in the new format
    const raw = JSON.parse(fs.readFileSync(path.join(dbDir, 'familytree.json'), 'utf8'))
    expect(raw.trees).toBeUndefined()
    expect(raw.projects.t1.name).toBe('Old Tree')
    expect(raw.activeProjectId).toBe('t2')
  })

  it('is idempotent — a second init changes nothing', () => {
    const dbDir = path.join(tmpDir, 'db')
    fs.mkdirSync(dbDir, { recursive: true })
    fs.writeFileSync(
      path.join(dbDir, 'familytree.json'),
      JSON.stringify({
        trees: {
          t1: { id: 't1', name: 'T', created_at: '2024-01-01', updated_at: '2024-01-01' }
        },
        activeTreeId: 't1',
        persons: {},
        relationships: {},
        factions: {},
        scenarios: {},
        images: {},
        settings: {},
        globalSettings: {}
      })
    )

    initDB()
    const first = JSON.parse(fs.readFileSync(path.join(dbDir, 'familytree.json'), 'utf8'))

    vi.resetModules()
    return import('../src/main/db.js').then((mod2) => {
      mod2.initDB()
      const second = JSON.parse(fs.readFileSync(path.join(dbDir, 'familytree.json'), 'utf8'))
      expect(second).toEqual(first)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Migration from year numbers to DateValues', () => {
  const writeOldDatesDb = () => {
    const dbDir = path.join(tmpDir, 'db')
    fs.mkdirSync(dbDir, { recursive: true })
    fs.writeFileSync(
      path.join(dbDir, 'familytree.json'),
      JSON.stringify({
        projects: {
          t1: { id: 't1', name: 'T', created_at: '2024-01-01', updated_at: '2024-01-01' }
        },
        activeProjectId: 't1',
        persons: {
          p1: {
            id: 'p1',
            project_id: 't1',
            name: 'Dated',
            birth_year: 1950,
            death_year: 2001,
            gender: 'male',
            bio: '',
            occupation: '',
            location: '',
            created_at: '2024-01-01',
            updated_at: '2024-01-01'
          },
          p2: {
            id: 'p2',
            project_id: 't1',
            name: 'Undated',
            birth_year: null,
            death_year: null,
            gender: 'female',
            bio: '',
            occupation: '',
            location: '',
            created_at: '2024-01-01',
            updated_at: '2024-01-01'
          }
        },
        relationships: {
          r1: {
            id: 'r1',
            project_id: 't1',
            person_a_id: 'p1',
            person_b_id: 'p2',
            type: 'spouse',
            status: 'active',
            formed_date: '1975',
            created_at: '2024-01-01'
          }
        },
        factions: {},
        scenarios: {},
        images: {},
        settings: {},
        globalSettings: {}
      })
    )
  }

  it('wraps bare year numbers (and numeric strings) as year-precision DateValues', () => {
    writeOldDatesDb()
    initDB()
    const { persons, relationships } = getDB()

    expect(persons.p1.birth).toEqual({
      year: 1950,
      month: null,
      day: null,
      precision: 'year',
      calendar: 'gregorian'
    })
    expect(persons.p1.death.year).toBe(2001)
    expect(persons.p1.birth_year).toBeUndefined()
    expect(persons.p1.death_year).toBeUndefined()

    // null stays null
    expect(persons.p2.birth).toBeNull()
    expect(persons.p2.death).toBeNull()

    // string year on a relationship becomes a numeric DateValue year
    expect(relationships.r1.formed.year).toBe(1975)
    expect(relationships.r1.formed_date).toBeUndefined()
  })

  it('round-trips: migrated DateValues persist to disk and reload unchanged', () => {
    writeOldDatesDb()
    initDB()
    const first = JSON.parse(fs.readFileSync(path.join(tmpDir, 'db', 'familytree.json'), 'utf8'))
    expect(first.persons.p1.birth.year).toBe(1950)

    vi.resetModules()
    return import('../src/main/db.js').then((mod2) => {
      mod2.initDB()
      const second = JSON.parse(fs.readFileSync(path.join(tmpDir, 'db', 'familytree.json'), 'utf8'))
      expect(second).toEqual(first) // second init is a no-op
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Migration from single-container to multi-project', () => {
  it('migrates an old single-tree database on init', () => {
    // Create an old-format database (no container at all, no tree_id on persons)
    const dbDir = path.join(tmpDir, 'db')
    fs.mkdirSync(dbDir, { recursive: true })
    const oldDb = {
      persons: {
        p1: {
          id: 'p1',
          name: 'Old Person',
          birth_year: 1980,
          death_year: null,
          gender: 'male',
          bio: '',
          occupation: '',
          location: '',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        }
      },
      relationships: {
        r1: {
          id: 'r1',
          person_a_id: 'p1',
          person_b_id: 'p1',
          type: 'spouse',
          created_at: '2024-01-01'
        }
      },
      images: {},
      settings: { theme: 'dark', graphState: '{"mode":"auto"}' }
    }
    fs.writeFileSync(path.join(dbDir, 'familytree.json'), JSON.stringify(oldDb))

    initDB()
    const db = getDB()

    // Should have created a project
    const projectList = Object.values(db.projects)
    expect(projectList).toHaveLength(1)
    expect(projectList[0].name).toBe('Unnamed Project')
    expect(db.activeProjectId).toBe(projectList[0].id)

    // Person should have project_id
    expect(db.persons['p1'].project_id).toBe(projectList[0].id)
    expect(db.relationships['r1'].project_id).toBe(projectList[0].id)

    // Year numbers wrapped as DateValues
    expect(db.persons['p1'].birth).toEqual(yearDate(1980))
    expect(db.persons['p1'].birth_year).toBeUndefined()

    // Theme should be in globalSettings
    expect(db.globalSettings.theme).toBe('dark')

    // Project-scoped settings should be prefixed
    const projectId = projectList[0].id
    expect(db.settings[`${projectId}:graphState`]).toBe('{"mode":"auto"}')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Person CRUD', () => {
  it('creates a person with project_id and persists to disk', () => {
    initDB()
    const { persons, activeProjectId, save, nowStr } = getDB()
    const id = 'test-person-1'
    persons[id] = {
      id,
      project_id: activeProjectId,
      name: 'Test Person',
      birth: yearDate(1990),
      death: null,
      gender: 'male',
      bio: 'A test person',
      occupation: 'Tester',
      location: 'Test City',
      created_at: nowStr(),
      updated_at: nowStr()
    }
    save()

    const dbPath = path.join(tmpDir, 'db', 'familytree.json')
    const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
    expect(raw.persons[id]).toBeDefined()
    expect(raw.persons[id].name).toBe('Test Person')
    expect(raw.persons[id].project_id).toBe(activeProjectId)
  })

  it('deletes a person and cascades relationships', () => {
    initDB()
    const { persons, relationships, activeProjectId, save } = getDB()
    const personIds = Object.values(persons)
      .filter((p) => p.project_id === activeProjectId)
      .map((p) => p.id)
    const targetId = personIds[2]

    const relsBefore = Object.values(relationships).filter(
      (r) => r.person_a_id === targetId || r.person_b_id === targetId
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
      (r) => r.person_a_id === targetId || r.person_b_id === targetId
    )
    expect(relsAfter).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Graph state persistence (per-project)', () => {
  it('saves and restores graph state scoped to project', () => {
    initDB()
    const { persons, settings, activeProjectId, save } = getDB()
    const personIds = Object.values(persons)
      .filter((p) => p.project_id === activeProjectId)
      .map((p) => p.id)

    const graphState = {
      currentMode: 'generation',
      activeEmphasis: 'paternal',
      modeEmphasis: { custom: 'default', auto: 'default', age: 'default', generation: 'paternal' },
      modeStateNames: {
        custom: ['State 1'],
        auto: ['State 1'],
        age: ['State 1'],
        generation: ['State 1', 'State 2']
      },
      modeActiveStateIdx: { custom: 0, auto: 0, age: 0, generation: 0 },
      modeStateSnapshots: {
        custom: [Object.fromEntries(personIds.map((id, i) => [id, { x: 100 + i * 50, y: 200 }]))],
        auto: [Object.fromEntries(personIds.map((id, i) => [id, { x: 150 + i * 40, y: 300 }]))],
        age: [
          Object.fromEntries(personIds.map((id, i) => [id, { x: 120 + i * 60, y: 100 + i * 80 }]))
        ],
        generation: [
          {
            ...Object.fromEntries(
              personIds.map((id, i) => [
                id,
                { x: 100 + i * 70, y: [100, 100, 250, 250, 400, 400][i] }
              ])
            ),
            _genRowYValues: [100, 250, 400],
            _genRowSpacing: 150
          }
        ]
      },
      genRowSpacing: 150
    }

    // Save scoped to project
    settings[`${activeProjectId}:graphState`] = JSON.stringify(graphState)
    save()

    // Read back
    const dbPath = path.join(tmpDir, 'db', 'familytree.json')
    const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
    const restored = JSON.parse(raw.settings[`${activeProjectId}:graphState`])

    expect(restored.currentMode).toBe('generation')
    expect(restored.modeStateSnapshots.generation[0]._genRowYValues).toEqual([100, 250, 400])
    expect(restored.modeStateSnapshots.generation[0][personIds[0]]).toEqual({ x: 100, y: 100 })
  })

  it('different projects have independent graph states', () => {
    initDB()
    const { projects, settings, activeProjectId, save, nowStr } = getDB()

    const project2Id = 'project-2-gs'
    projects[project2Id] = {
      id: project2Id,
      name: 'Project 2',
      created_at: nowStr(),
      updated_at: nowStr()
    }

    settings[`${activeProjectId}:graphState`] = JSON.stringify({ currentMode: 'auto' })
    settings[`${project2Id}:graphState`] = JSON.stringify({ currentMode: 'generation' })
    save()

    const dbPath = path.join(tmpDir, 'db', 'familytree.json')
    const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'))

    expect(JSON.parse(raw.settings[`${activeProjectId}:graphState`]).currentMode).toBe('auto')
    expect(JSON.parse(raw.settings[`${project2Id}:graphState`]).currentMode).toBe('generation')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Factions', () => {
  it('adds an empty factions table when loading an older database', () => {
    // Old-format database written before factions existed
    const dbDir = path.join(tmpDir, 'db')
    fs.mkdirSync(dbDir, { recursive: true })
    fs.writeFileSync(
      path.join(dbDir, 'familytree.json'),
      JSON.stringify({
        projects: {
          t1: { id: 't1', name: 'T', created_at: '2024-01-01', updated_at: '2024-01-01' }
        },
        activeProjectId: 't1',
        persons: {},
        relationships: {},
        images: {},
        settings: {},
        globalSettings: {}
      })
    )

    initDB()
    const { factions } = getDB()
    expect(factions).toEqual({})
  })

  it('faction fields survive a save/load cycle', () => {
    initDB()
    const { factions, persons, activeProjectId, save, nowStr } = getDB()
    const memberIds = Object.values(persons)
      .filter((p) => p.project_id === activeProjectId)
      .slice(0, 2)
      .map((p) => p.id)
    factions['f1'] = {
      id: 'f1',
      project_id: activeProjectId,
      name: 'House Anderson',
      description: 'The founding family',
      color: '#f5a623',
      icon: '🏰',
      member_ids: memberIds,
      x: 120,
      y: -40,
      visible: true,
      created_at: nowStr(),
      updated_at: nowStr()
    }
    save()

    const dbPath = path.join(tmpDir, 'db', 'familytree.json')
    const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
    expect(raw.factions['f1'].name).toBe('House Anderson')
    expect(raw.factions['f1'].member_ids).toEqual(memberIds)
    expect(raw.factions['f1'].x).toBe(120)
    expect(raw.factions['f1'].project_id).toBe(activeProjectId)
  })

  it('factions are scoped to their project via project_id', () => {
    initDB()
    const { factions, projects, activeProjectId, save, nowStr } = getDB()
    const project2Id = 'project-fx'
    projects[project2Id] = {
      id: project2Id,
      name: 'Other',
      created_at: nowStr(),
      updated_at: nowStr()
    }
    factions['fa'] = {
      id: 'fa',
      project_id: activeProjectId,
      name: 'A',
      description: '',
      color: '#6c8ef5',
      icon: '⚑',
      member_ids: [],
      x: 0,
      y: 0,
      visible: true,
      created_at: nowStr(),
      updated_at: nowStr()
    }
    factions['fb'] = {
      id: 'fb',
      project_id: project2Id,
      name: 'B',
      description: '',
      color: '#f06292',
      icon: '⚑',
      member_ids: [],
      x: 0,
      y: 0,
      visible: true,
      created_at: nowStr(),
      updated_at: nowStr()
    }
    save()

    expect(Object.values(factions).filter((f) => f.project_id === activeProjectId)).toHaveLength(1)
    expect(Object.values(factions).filter((f) => f.project_id === project2Id)).toHaveLength(1)
  })

  it('removing a deleted person from member lists keeps other members intact', () => {
    initDB()
    const { factions, persons, activeProjectId, save, nowStr } = getDB()
    const ids = Object.values(persons)
      .filter((p) => p.project_id === activeProjectId)
      .map((p) => p.id)
    factions['f1'] = {
      id: 'f1',
      project_id: activeProjectId,
      name: 'F',
      description: '',
      color: '#6c8ef5',
      icon: '⚑',
      member_ids: [ids[0], ids[1]],
      x: 0,
      y: 0,
      visible: true,
      created_at: nowStr(),
      updated_at: nowStr()
    }

    // Mirror the persons:delete cascade
    delete persons[ids[0]]
    for (const f of Object.values(factions)) {
      if (f.member_ids.includes(ids[0])) f.member_ids = f.member_ids.filter((pid) => pid !== ids[0])
    }
    save()

    const raw = JSON.parse(fs.readFileSync(path.join(tmpDir, 'db', 'familytree.json'), 'utf8'))
    expect(raw.factions['f1'].member_ids).toEqual([ids[1]])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Scenes (groups)', () => {
  it('migrates scenarios into groups scenes with the same ids', () => {
    const dbDir = path.join(tmpDir, 'db')
    fs.mkdirSync(dbDir, { recursive: true })
    fs.writeFileSync(
      path.join(dbDir, 'familytree.json'),
      JSON.stringify({
        projects: {
          t1: { id: 't1', name: 'T', created_at: '2024-01-01', updated_at: '2024-01-01' }
        },
        activeProjectId: 't1',
        persons: {},
        relationships: {},
        images: {},
        settings: { 't1:activeScenarioId': 's2' },
        globalSettings: {},
        scenarios: {
          s1: {
            id: 's1',
            project_id: 't1',
            name: 'By family',
            created_at: '2024-01-01',
            updated_at: '2024-01-01'
          },
          s2: {
            id: 's2',
            project_id: 't1',
            name: 'Allegiance',
            created_at: '2024-01-02',
            updated_at: '2024-01-02'
          }
        },
        factions: {
          f1: {
            id: 'f1',
            project_id: 't1',
            scenario_id: 's1',
            name: 'F',
            description: '',
            color: '#6c8ef5',
            icon: '⚑',
            member_ids: [],
            x: 5,
            y: 6,
            visible: true,
            created_at: '2024-01-01',
            updated_at: '2024-01-01'
          }
        }
      })
    )

    initDB()
    const { db, scenes, factions } = getDB()

    expect(db.scenarios).toBeUndefined()
    expect(Object.keys(scenes).sort()).toEqual(['s1', 's2'])
    expect(scenes.s1).toMatchObject({ view: 'groups', name: 'By family', project_id: 't1' })
    expect(scenes.s2.name).toBe('Allegiance')
    // Factions still resolve — the scene kept the scenario's id
    expect(factions.f1.scenario_id).toBe('s1')

    // Idempotent: a second init changes nothing on disk
    const first = JSON.parse(fs.readFileSync(path.join(dbDir, 'familytree.json'), 'utf8'))
    vi.resetModules()
    return import('../src/main/db.js').then((mod2) => {
      mod2.initDB()
      const second = JSON.parse(fs.readFileSync(path.join(dbDir, 'familytree.json'), 'utf8'))
      expect(second).toEqual(first)
    })
  })

  it('adopts pre-scenario factions into a default groups scene per project', () => {
    // Database written before scenarios/scenes existed: factions with no scenario_id
    const dbDir = path.join(tmpDir, 'db')
    fs.mkdirSync(dbDir, { recursive: true })
    fs.writeFileSync(
      path.join(dbDir, 'familytree.json'),
      JSON.stringify({
        projects: {
          t1: { id: 't1', name: 'A', created_at: '2024-01-01', updated_at: '2024-01-01' },
          t2: { id: 't2', name: 'B', created_at: '2024-01-01', updated_at: '2024-01-01' }
        },
        activeProjectId: 't1',
        persons: {},
        relationships: {},
        images: {},
        settings: {},
        globalSettings: {},
        factions: {
          f1: {
            id: 'f1',
            project_id: 't1',
            name: 'F1',
            member_ids: [],
            x: 0,
            y: 0,
            visible: true,
            created_at: '2024-01-01',
            updated_at: '2024-01-01'
          },
          f2: {
            id: 'f2',
            project_id: 't1',
            name: 'F2',
            member_ids: [],
            x: 0,
            y: 0,
            visible: true,
            created_at: '2024-01-01',
            updated_at: '2024-01-01'
          },
          f3: {
            id: 'f3',
            project_id: 't2',
            name: 'F3',
            member_ids: [],
            x: 0,
            y: 0,
            visible: true,
            created_at: '2024-01-01',
            updated_at: '2024-01-01'
          }
        }
      })
    )

    initDB()
    const { factions, scenes } = getDB()

    // One default groups scene per project that had factions
    const t1Scenes = Object.values(scenes).filter((s) => s.project_id === 't1')
    const t2Scenes = Object.values(scenes).filter((s) => s.project_id === 't2')
    expect(t1Scenes).toHaveLength(1)
    expect(t2Scenes).toHaveLength(1)
    expect(t1Scenes[0].name).toBe('Scenario 1')
    expect(t1Scenes[0].view).toBe('groups')

    // Factions adopted into their project's scene
    expect(factions.f1.scenario_id).toBe(t1Scenes[0].id)
    expect(factions.f2.scenario_id).toBe(t1Scenes[0].id)
    expect(factions.f3.scenario_id).toBe(t2Scenes[0].id)
  })

  it('adoption is idempotent — a second init creates no extra scenes', () => {
    initDB()
    const { db, factions, save } = getDB()
    const scene = channelHandlers['scenes:create'](db, { view: 'groups', name: 'S' }, handlerEnv)
    factions['f1'] = {
      id: 'f1',
      project_id: db.activeProjectId,
      scenario_id: scene.scene.id,
      name: 'F',
      description: '',
      color: '#6c8ef5',
      icon: '⚑',
      member_ids: [],
      x: 0,
      y: 0,
      visible: true,
      created_at: '2026-01-01 00:00:00',
      updated_at: '2026-01-01 00:00:00'
    }
    save()

    vi.resetModules()
    return import('../src/main/db.js').then((mod2) => {
      mod2.initDB()
      const db2 = mod2.getDB()
      expect(Object.keys(db2.scenes)).toHaveLength(1)
      expect(db2.factions.f1.scenario_id).toBe(scene.scene.id)
    })
  })

  it('cloning a scene duplicates only that scene’s factions', () => {
    initDB()
    const { db } = getDB()
    const a = channelHandlers['scenes:create'](db, { view: 'groups', name: 'A' }, handlerEnv)
    channelHandlers['factions:create'](
      db,
      { scenario_id: a.scene.id, name: 'FA', member_ids: ['p1'] },
      handlerEnv
    )
    const b = channelHandlers['scenes:create'](
      db,
      { view: 'groups', name: 'B', clone_from: a.scene.id },
      handlerEnv
    )
    expect(b.factions).toHaveLength(1)
    expect(b.factions[0].scenario_id).toBe(b.scene.id)
    expect(b.factions[0].member_ids).toEqual(['p1'])
    expect(Object.keys(db.factions)).toHaveLength(2)
  })

  it('deleting a scene cascades its factions but not other scenes’ factions', () => {
    initDB()
    const { db } = getDB()
    const a = channelHandlers['scenes:create'](db, { view: 'groups', name: 'A' }, handlerEnv)
    const b = channelHandlers['scenes:create'](db, { view: 'groups', name: 'B' }, handlerEnv)
    const fA = channelHandlers['factions:create'](
      db,
      { scenario_id: a.scene.id, name: 'FA' },
      handlerEnv
    )
    const fB = channelHandlers['factions:create'](
      db,
      { scenario_id: b.scene.id, name: 'FB' },
      handlerEnv
    )

    channelHandlers['scenes:delete'](db, { id: a.scene.id })

    expect(db.scenes[a.scene.id]).toBeUndefined()
    expect(db.scenes[b.scene.id]).toBeDefined()
    expect(db.factions[fA.id]).toBeUndefined()
    expect(db.factions[fB.id]).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Tags & the entity_tags join', () => {
  it('adds empty tags/entity_tags tables when loading an older database', () => {
    const dbDir = path.join(tmpDir, 'db')
    fs.mkdirSync(dbDir, { recursive: true })
    fs.writeFileSync(
      path.join(dbDir, 'familytree.json'),
      JSON.stringify({
        projects: {
          t1: { id: 't1', name: 'T', created_at: '2024-01-01', updated_at: '2024-01-01' }
        },
        activeProjectId: 't1',
        persons: {},
        relationships: {},
        factions: {},
        scenarios: {},
        images: {},
        settings: {},
        globalSettings: {}
      })
    )

    initDB()
    const { tags, entityTags } = getDB()
    expect(tags).toEqual({})
    expect(entityTags).toEqual({})
  })

  it('creates a tag scoped to the active project and persists it', () => {
    initDB()
    const { db, save, activeProjectId } = getDB()
    const tag = channelHandlers['tags:create'](
      db,
      { label: 'House Anderson', color: '#f5a623', icon: '🏰', type: 'family' },
      handlerEnv
    )
    save()

    const raw = JSON.parse(fs.readFileSync(path.join(tmpDir, 'db', 'familytree.json'), 'utf8'))
    expect(raw.tags[tag.id].label).toBe('House Anderson')
    expect(raw.tags[tag.id].project_id).toBe(activeProjectId)
    expect(raw.tags[tag.id].source).toBe('manual')
    expect(raw.tags[tag.id].color).toBe('#f5a623')
  })

  it('joins an entity to a tag exactly once (duplicate add returns the same row)', () => {
    initDB()
    const { db } = getDB()
    const personId = Object.keys(db.persons)[0]
    const tag = channelHandlers['tags:create'](db, { label: 'T' }, handlerEnv)

    const row1 = channelHandlers['entity_tags:add'](
      db,
      { entity_id: personId, tag_id: tag.id },
      handlerEnv
    )
    const row2 = channelHandlers['entity_tags:add'](
      db,
      { entity_id: personId, tag_id: tag.id },
      handlerEnv
    )
    expect(row2.id).toBe(row1.id)
    expect(Object.keys(db.entity_tags)).toHaveLength(1)

    const rows = channelHandlers['entity_tags:getAll'](db)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ entity_id: personId, tag_id: tag.id })
  })

  it('entity_tags:remove deletes the pair and leaves other joins alone', () => {
    initDB()
    const { db } = getDB()
    const [p1, p2] = Object.keys(db.persons)
    const tag = channelHandlers['tags:create'](db, { label: 'T' }, handlerEnv)
    channelHandlers['entity_tags:add'](db, { entity_id: p1, tag_id: tag.id }, handlerEnv)
    channelHandlers['entity_tags:add'](db, { entity_id: p2, tag_id: tag.id }, handlerEnv)

    channelHandlers['entity_tags:remove'](db, { entity_id: p1, tag_id: tag.id })
    const rows = Object.values(db.entity_tags)
    expect(rows).toHaveLength(1)
    expect(rows[0].entity_id).toBe(p2)
  })

  it('deleting a person cascades its join rows; the tag and other members stay', () => {
    initDB()
    const { db } = getDB()
    const [p1, p2] = Object.keys(db.persons)
    const tag = channelHandlers['tags:create'](db, { label: 'T' }, handlerEnv)
    channelHandlers['entity_tags:add'](db, { entity_id: p1, tag_id: tag.id }, handlerEnv)
    channelHandlers['entity_tags:add'](db, { entity_id: p2, tag_id: tag.id }, handlerEnv)

    channelHandlers['persons:delete'](db, { id: p1 }, handlerEnv)

    expect(db.persons[p1]).toBeUndefined()
    expect(db.tags[tag.id]).toBeDefined()
    const rows = Object.values(db.entity_tags)
    expect(rows).toHaveLength(1)
    expect(rows[0].entity_id).toBe(p2)
  })

  it('deleting a tag cascades its join rows; people are untouched', () => {
    initDB()
    const { db } = getDB()
    const personCount = Object.keys(db.persons).length
    const [p1, p2] = Object.keys(db.persons)
    const keep = channelHandlers['tags:create'](db, { label: 'Keep' }, handlerEnv)
    const drop = channelHandlers['tags:create'](db, { label: 'Drop' }, handlerEnv)
    channelHandlers['entity_tags:add'](db, { entity_id: p1, tag_id: keep.id }, handlerEnv)
    channelHandlers['entity_tags:add'](db, { entity_id: p1, tag_id: drop.id }, handlerEnv)
    channelHandlers['entity_tags:add'](db, { entity_id: p2, tag_id: drop.id }, handlerEnv)

    channelHandlers['tags:delete'](db, { id: drop.id })

    expect(db.tags[drop.id]).toBeUndefined()
    expect(db.tags[keep.id]).toBeDefined()
    const rows = Object.values(db.entity_tags)
    expect(rows).toHaveLength(1)
    expect(rows[0].tag_id).toBe(keep.id)
    expect(Object.keys(db.persons)).toHaveLength(personCount)
  })

  it('deleting a project removes its tags and their join rows', () => {
    initDB()
    const { db, activeProjectId } = getDB()
    const personId = Object.keys(db.persons)[0]
    const tag = channelHandlers['tags:create'](db, { label: 'T' }, handlerEnv)
    channelHandlers['entity_tags:add'](db, { entity_id: personId, tag_id: tag.id }, handlerEnv)

    // A second project must survive the delete
    const other = channelHandlers['projects:create'](db, { name: 'Other' }, handlerEnv)
    channelHandlers['projects:delete'](db, { id: activeProjectId }, handlerEnv)

    expect(db.projects[other.id]).toBeDefined()
    expect(Object.keys(db.tags)).toHaveLength(0)
    expect(Object.keys(db.entity_tags)).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Data integrity', () => {
  it('person fields are all preserved through save/load cycle', () => {
    initDB()
    const { persons, activeProjectId, save } = getDB()
    const id = 'integrity-test'
    persons[id] = {
      id,
      project_id: activeProjectId,
      name: 'Full Field Test',
      birth: yearDate(1985),
      death: yearDate(2050),
      gender: 'female',
      bio: 'Bio with special chars: "quotes", <tags>, & ampersand',
      occupation: 'Engineer & Designer',
      location: 'New York, NY',
      created_at: '2026-01-15 10:30:00',
      updated_at: '2026-03-31 12:00:00'
    }
    save()

    const dbPath = path.join(tmpDir, 'db', 'familytree.json')
    const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
    const p = raw.persons[id]
    expect(p.name).toBe('Full Field Test')
    expect(p.bio).toBe('Bio with special chars: "quotes", <tags>, & ampersand')
    expect(p.project_id).toBe(activeProjectId)
    // DateValues round-trip structurally intact
    expect(p.birth).toEqual({
      year: 1985,
      month: null,
      day: null,
      precision: 'year',
      calendar: 'gregorian'
    })
    expect(p.death.year).toBe(2050)
  })

  it('empty/null fields do not corrupt the database', () => {
    initDB()
    const { persons, activeProjectId, save, nowStr } = getDB()
    persons['null-test'] = {
      id: 'null-test',
      project_id: activeProjectId,
      name: '',
      birth: null,
      death: null,
      gender: 'unknown',
      bio: '',
      occupation: '',
      location: '',
      created_at: nowStr(),
      updated_at: nowStr()
    }
    save()
    expect(() => getDB()).not.toThrow()
  })
})
