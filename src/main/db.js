import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import {
  EMPTY_DB,
  nowStr,
  seedSampleData,
  migrateTreesToProjects,
  migrateYearsToDateValues
} from '../shared/dbCore'

// DB shape and the sample-family seed live in src/shared/dbCore.ts so the
// browser-local backend starts from the exact same state as the desktop app.

let _db = null
let _dbPath = null

function save() {
  fs.writeFileSync(_dbPath, JSON.stringify(_db, null, 2))
}

// ── Public API ─────────────────────────────────────────────────────────────────
export function initDB() {
  const userDataPath = app.getPath('userData')
  const dbDir = path.join(userDataPath, 'db')
  const imagesDir = path.join(userDataPath, 'images')
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true })

  _dbPath = path.join(dbDir, 'familytree.json')
  _db = fs.existsSync(_dbPath) ? JSON.parse(fs.readFileSync(_dbPath, 'utf8')) : EMPTY_DB()

  // Migration: rename the old "tree" container vocabulary to "project"
  // (trees → projects, activeTreeId → activeProjectId, tree_id → project_id)
  if (migrateTreesToProjects(_db)) save()

  // Migration: wrap bare year numbers (birth_year/death_year/formed_date) as
  // structured DateValues (birth/death/formed)
  if (migrateYearsToDateValues(_db)) save()

  // Migration: ensure all tables exist
  _db.projects = _db.projects || {}
  _db.persons = _db.persons || {}
  _db.relationships = _db.relationships || {}
  _db.factions = _db.factions || {}
  _db.scenarios = _db.scenarios || {}
  _db.images = _db.images || {}
  _db.settings = _db.settings || {}
  _db.globalSettings = _db.globalSettings || {}

  // Migration: adopt factions created before scenarios existed into a default
  // scenario per project (idempotent — only touches factions with no scenario_id)
  const orphanFactions = Object.values(_db.factions).filter((f) => !f.scenario_id)
  if (orphanFactions.length > 0) {
    const now = nowStr()
    const defaultScenarioByProject = {}
    for (const s of Object.values(_db.scenarios)) {
      defaultScenarioByProject[s.project_id] = defaultScenarioByProject[s.project_id] || s.id
    }
    for (const f of orphanFactions) {
      if (!defaultScenarioByProject[f.project_id]) {
        const sid = randomUUID()
        _db.scenarios[sid] = {
          id: sid,
          project_id: f.project_id,
          name: 'Scenario 1',
          created_at: now,
          updated_at: now
        }
        defaultScenarioByProject[f.project_id] = sid
      }
      f.scenario_id = defaultScenarioByProject[f.project_id]
    }
    save()
  }

  // Migration: convert an old single-container DB (no projects at all) to the
  // multi-project shape
  if (!_db.activeProjectId && Object.keys(_db.projects).length === 0) {
    const hasOldPersons = Object.values(_db.persons).some((p) => !p.project_id)
    const projectId = randomUUID()
    const now = nowStr()
    _db.projects[projectId] = {
      id: projectId,
      name: 'Unnamed Project',
      created_at: now,
      updated_at: now
    }
    _db.activeProjectId = projectId

    if (hasOldPersons) {
      // Tag existing persons/relationships/images with project_id
      for (const p of Object.values(_db.persons)) {
        p.project_id = p.project_id || projectId
      }
      for (const r of Object.values(_db.relationships)) {
        r.project_id = r.project_id || projectId
      }
      for (const img of Object.values(_db.images)) {
        img.project_id = img.project_id || projectId
      }
    } else if (Object.keys(_db.persons).length === 0) {
      // Fresh install: seed sample data
      seedSampleData(_db, projectId, { uuid: randomUUID, nowStr })
    }

    // Migrate old flat settings to prefixed per-project settings
    const oldSettings = { ..._db.settings }
    _db.settings = {}
    for (const [key, value] of Object.entries(oldSettings)) {
      if (key === 'theme') {
        _db.globalSettings.theme = value
      } else {
        _db.settings[`${projectId}:${key}`] = value
      }
    }

    save()
  }

  if (!_db.activeProjectId) {
    _db.activeProjectId = Object.keys(_db.projects)[0]
    save()
  }
}

export function getDB() {
  if (!_db) throw new Error('Database not initialised')
  return {
    db: _db,
    projects: _db.projects,
    activeProjectId: _db.activeProjectId,
    persons: _db.persons,
    relationships: _db.relationships,
    factions: _db.factions,
    scenarios: _db.scenarios,
    images: _db.images,
    settings: _db.settings,
    globalSettings: _db.globalSettings,
    setActiveProject(id) {
      _db.activeProjectId = id
    },
    save,
    nowStr
  }
}
