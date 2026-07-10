import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import { EMPTY_DB, nowStr, seedSampleData } from '../shared/dbCore'

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

  // Migration: ensure all tables exist
  _db.trees = _db.trees || {}
  _db.persons = _db.persons || {}
  _db.relationships = _db.relationships || {}
  _db.factions = _db.factions || {}
  _db.scenarios = _db.scenarios || {}
  _db.images = _db.images || {}
  _db.settings = _db.settings || {}
  _db.globalSettings = _db.globalSettings || {}

  // Migration: adopt factions created before scenarios existed into a default
  // scenario per tree (idempotent — only touches factions with no scenario_id)
  const orphanFactions = Object.values(_db.factions).filter((f) => !f.scenario_id)
  if (orphanFactions.length > 0) {
    const now = nowStr()
    const defaultScenarioByTree = {}
    for (const s of Object.values(_db.scenarios)) {
      defaultScenarioByTree[s.tree_id] = defaultScenarioByTree[s.tree_id] || s.id
    }
    for (const f of orphanFactions) {
      if (!defaultScenarioByTree[f.tree_id]) {
        const sid = randomUUID()
        _db.scenarios[sid] = {
          id: sid,
          tree_id: f.tree_id,
          name: 'Scenario 1',
          created_at: now,
          updated_at: now
        }
        defaultScenarioByTree[f.tree_id] = sid
      }
      f.scenario_id = defaultScenarioByTree[f.tree_id]
    }
    save()
  }

  // Migration: convert old single-tree DB to multi-tree
  if (!_db.activeTreeId && Object.keys(_db.trees).length === 0) {
    const hasOldPersons = Object.values(_db.persons).some((p) => !p.tree_id)
    const treeId = randomUUID()
    const now = nowStr()
    _db.trees[treeId] = {
      id: treeId,
      name: 'Unnamed Family Tree',
      created_at: now,
      updated_at: now
    }
    _db.activeTreeId = treeId

    if (hasOldPersons) {
      // Tag existing persons/relationships/images with tree_id
      for (const p of Object.values(_db.persons)) {
        p.tree_id = p.tree_id || treeId
      }
      for (const r of Object.values(_db.relationships)) {
        r.tree_id = r.tree_id || treeId
      }
      for (const img of Object.values(_db.images)) {
        img.tree_id = img.tree_id || treeId
      }
    } else if (Object.keys(_db.persons).length === 0) {
      // Fresh install: seed sample data
      seedSampleData(_db, treeId, { uuid: randomUUID, nowStr })
    }

    // Migrate old flat settings to prefixed per-tree settings
    const oldSettings = { ..._db.settings }
    _db.settings = {}
    for (const [key, value] of Object.entries(oldSettings)) {
      if (key === 'theme') {
        _db.globalSettings.theme = value
      } else {
        _db.settings[`${treeId}:${key}`] = value
      }
    }

    save()
  }

  if (!_db.activeTreeId) {
    _db.activeTreeId = Object.keys(_db.trees)[0]
    save()
  }
}

export function getDB() {
  if (!_db) throw new Error('Database not initialised')
  return {
    db: _db,
    trees: _db.trees,
    activeTreeId: _db.activeTreeId,
    persons: _db.persons,
    relationships: _db.relationships,
    factions: _db.factions,
    scenarios: _db.scenarios,
    images: _db.images,
    settings: _db.settings,
    globalSettings: _db.globalSettings,
    setActiveTree(id) {
      _db.activeTreeId = id
    },
    save,
    nowStr
  }
}
