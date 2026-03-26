import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'

const EMPTY_DB = () => ({
  persons: {},
  relationships: {},
  images: {},
  settings: {}
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

  // Ensure all tables exist (migration-safe)
  _db.persons = _db.persons || {}
  _db.relationships = _db.relationships || {}
  _db.images = _db.images || {}
  _db.settings = _db.settings || {}

  // Seed sample data on first run
  if (Object.keys(_db.persons).length === 0) {
    const gp1 = randomUUID(), gp2 = randomUUID()
    const p1 = randomUUID(), p2 = randomUUID()
    const c1 = randomUUID(), c2 = randomUUID()
    const now = nowStr()

    const addP = (id, name, birth_year, gender, bio, occupation, location) => {
      _db.persons[id] = { id, name, birth_year, death_year: null, gender, bio, occupation, location, created_at: now, updated_at: now }
    }
    const addR = (a, b, type) => {
      const id = randomUUID()
      _db.relationships[id] = { id, person_a_id: a, person_b_id: b, type, created_at: now }
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

    save()
  }
}

export function getDB() {
  if (!_db) throw new Error('Database not initialised')
  return {
    persons: _db.persons,
    relationships: _db.relationships,
    images: _db.images,
    settings: _db.settings,
    save,
    nowStr
  }
}
