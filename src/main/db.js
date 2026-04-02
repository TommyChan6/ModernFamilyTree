import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'

const EMPTY_DB = () => ({
  trees: {},       // { treeId: { id, name, created_at, updated_at } }
  activeTreeId: null,
  persons: {},     // { personId: { ...fields, tree_id } }
  relationships: {},
  images: {},
  settings: {},    // { `${treeId}:key`: value } for per-tree settings, or global keys
  globalSettings: {} // theme, etc.
})

let _db = null
let _dbPath = null

function save() {
  fs.writeFileSync(_dbPath, JSON.stringify(_db, null, 2))
}

function nowStr() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

// ── Public API ─────────────────────────────────────────────────────────────────
export function initDB() {
  const userDataPath = app.getPath('userData')
  const dbDir = path.join(userDataPath, 'db')
  const imagesDir = path.join(userDataPath, 'images')
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true })

  _dbPath = path.join(dbDir, 'familytree.json')
  _db = fs.existsSync(_dbPath)
    ? JSON.parse(fs.readFileSync(_dbPath, 'utf8'))
    : EMPTY_DB()

  // Migration: ensure all tables exist
  _db.trees = _db.trees || {}
  _db.persons = _db.persons || {}
  _db.relationships = _db.relationships || {}
  _db.images = _db.images || {}
  _db.settings = _db.settings || {}
  _db.globalSettings = _db.globalSettings || {}

  // Migration: convert old single-tree DB to multi-tree
  if (!_db.activeTreeId && Object.keys(_db.trees).length === 0) {
    const hasOldPersons = Object.values(_db.persons).some(p => !p.tree_id)
    const treeId = randomUUID()
    const now = nowStr()
    _db.trees[treeId] = { id: treeId, name: 'Unnamed Family Tree', created_at: now, updated_at: now }
    _db.activeTreeId = treeId

    if (hasOldPersons) {
      // Tag existing persons/relationships/images with tree_id
      for (const p of Object.values(_db.persons)) { p.tree_id = p.tree_id || treeId }
      for (const r of Object.values(_db.relationships)) { r.tree_id = r.tree_id || treeId }
      for (const img of Object.values(_db.images)) { img.tree_id = img.tree_id || treeId }
    } else if (Object.keys(_db.persons).length === 0) {
      // Fresh install: seed sample data
      seedSampleData(treeId)
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

function seedSampleData(treeId) {
  const now = nowStr()
  const gp1 = randomUUID(), gp2 = randomUUID()
  const p1 = randomUUID(), p2 = randomUUID()
  const c1 = randomUUID(), c2 = randomUUID()

  const addP = (id, name, birth_year, gender, bio, occupation, location) => {
    _db.persons[id] = { id, tree_id: treeId, name, birth_year, death_year: null, gender, bio, occupation, location, created_at: now, updated_at: now }
  }
  const addR = (a, b, type) => {
    const id = randomUUID()
    _db.relationships[id] = { id, tree_id: treeId, person_a_id: a, person_b_id: b, type, status: 'active', formed_date: null, created_at: now }
  }

  addP(gp1, 'Robert Anderson', 1948, 'male', 'Retired civil engineer who loved woodworking and jazz.', 'Civil Engineer', 'Chicago, IL')
  addP(gp2, 'Dorothy Anderson', 1950, 'female', 'Retired school teacher with a passion for gardening.', 'Teacher', 'Chicago, IL')
  addP(p1, 'James Anderson', 1975, 'male', 'Architect running his own firm in New York.', 'Architect', 'New York, NY')
  addP(p2, 'Sarah Anderson', 1977, 'female', 'Pediatrician at Brooklyn General Hospital.', 'Pediatrician', 'New York, NY')
  addP(c1, 'Lucas Anderson', 2005, 'male', 'High school student and basketball enthusiast.', 'Student', 'New York, NY')
  addP(c2, 'Olivia Anderson', 2008, 'female', 'Middle school student who loves reading and art.', 'Student', 'New York, NY')

  addR(gp1, gp2, 'spouse')
  addR(gp1, p1, 'parent_child')
  addR(gp2, p1, 'parent_child')
  addR(p1, p2, 'spouse')
  addR(p1, c1, 'parent_child')
  addR(p1, c2, 'parent_child')
  addR(p2, c1, 'parent_child')
  addR(p2, c2, 'parent_child')
}

export function getDB() {
  if (!_db) throw new Error('Database not initialised')
  return {
    db: _db,
    trees: _db.trees,
    activeTreeId: _db.activeTreeId,
    persons: _db.persons,
    relationships: _db.relationships,
    images: _db.images,
    settings: _db.settings,
    globalSettings: _db.globalSettings,
    setActiveTree(id) { _db.activeTreeId = id },
    save,
    nowStr
  }
}
