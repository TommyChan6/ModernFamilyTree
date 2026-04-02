import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import { getDB } from './db.js'

function sortByDate(arr) {
  return arr.slice().sort((a, b) => (a.created_at > b.created_at ? 1 : -1))
}

/** Get the active tree ID from the DB */
function activeTree() {
  const { activeTreeId } = getDB()
  return activeTreeId
}

/** Filter objects by tree_id matching active tree */
function forTree(obj) {
  const tid = activeTree()
  return Object.values(obj).filter(item => item.tree_id === tid)
}

export function registerHandlers(ipcMain, _app, dialog) {
  // ── trees:getAll ───────────────────────────────────────────────────────────
  ipcMain.handle('trees:getAll', async () => {
    try {
      const { trees, activeTreeId } = getDB()
      return { success: true, data: { trees: sortByDate(Object.values(trees)), activeTreeId } }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── trees:create ───────────────────────────────────────────────────────────
  ipcMain.handle('trees:create', async (_event, data) => {
    try {
      const { trees, save, nowStr } = getDB()
      const id = randomUUID()
      const now = nowStr()
      const tree = { id, name: data?.name || 'Unnamed Family Tree', created_at: now, updated_at: now }
      trees[id] = tree
      save()
      return { success: true, data: tree }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── trees:rename ───────────────────────────────────────────────────────────
  ipcMain.handle('trees:rename', async (_event, data) => {
    try {
      const { trees, save, nowStr } = getDB()
      const tree = trees[data.id]
      if (!tree) return { success: false, error: 'Tree not found' }
      tree.name = data.name
      tree.updated_at = nowStr()
      save()
      return { success: true, data: tree }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── trees:delete ───────────────────────────────────────────────────────────
  ipcMain.handle('trees:delete', async (_event, data) => {
    try {
      const db = getDB()
      const tid = data.id
      // Remove all persons, relationships, images for this tree
      for (const [pid, p] of Object.entries(db.persons)) {
        if (p.tree_id === tid) delete db.persons[pid]
      }
      for (const [rid, r] of Object.entries(db.relationships)) {
        if (r.tree_id === tid) delete db.relationships[rid]
      }
      for (const [iid, img] of Object.entries(db.images)) {
        if (img.tree_id === tid) {
          try { fs.unlinkSync(img.file_path) } catch (_) { /* ignore */ }
          delete db.images[iid]
        }
      }
      // Remove tree-scoped settings
      for (const key of Object.keys(db.settings)) {
        if (key.startsWith(`${tid}:`)) delete db.settings[key]
      }
      delete db.trees[tid]

      // Switch active to another tree if needed
      if (db.activeTreeId === tid) {
        const remaining = Object.keys(db.trees)
        db.setActiveTree(remaining.length > 0 ? remaining[0] : null)
      }
      db.save()
      return { success: true, data: { id: tid, newActiveTreeId: db.activeTreeId } }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── trees:setActive ────────────────────────────────────────────────────────
  ipcMain.handle('trees:setActive', async (_event, data) => {
    try {
      const db = getDB()
      if (!db.trees[data.id]) return { success: false, error: 'Tree not found' }
      db.setActiveTree(data.id)
      db.save()
      return { success: true, data: { activeTreeId: data.id } }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── persons:getAll ─────────────────────────────────────────────────────────
  ipcMain.handle('persons:getAll', async () => {
    try {
      const { persons, images } = getDB()
      const list = sortByDate(forTree(persons))
      const enriched = list.map(p => {
        const primary = Object.values(images).find(img => img.person_id === p.id && img.is_primary)
        return { ...p, primary_image: primary ? primary.file_path : null }
      })
      return { success: true, data: enriched }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── persons:create ─────────────────────────────────────────────────────────
  ipcMain.handle('persons:create', async (_event, data) => {
    try {
      const { persons, save, nowStr } = getDB()
      const id = randomUUID()
      const now = nowStr()
      const person = {
        id,
        tree_id: activeTree(),
        name: data.name || '',
        birth_year: data.birth_year || null,
        death_year: data.death_year || null,
        gender: data.gender || 'unknown',
        bio: data.bio || '',
        occupation: data.occupation || '',
        location: data.location || '',
        created_at: now,
        updated_at: now
      }
      persons[id] = person
      save()
      return { success: true, data: { ...person, primary_image: null } }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── persons:update ─────────────────────────────────────────────────────────
  ipcMain.handle('persons:update', async (_event, data) => {
    try {
      const { persons, images, save, nowStr } = getDB()
      const existing = persons[data.id]
      if (!existing) return { success: false, error: 'Person not found' }
      const updated = {
        ...existing,
        name: data.name || '',
        birth_year: data.birth_year || null,
        death_year: data.death_year || null,
        gender: data.gender || 'unknown',
        bio: data.bio || '',
        occupation: data.occupation || '',
        location: data.location || '',
        updated_at: nowStr()
      }
      persons[data.id] = updated
      save()
      const primary = Object.values(images).find(img => img.person_id === data.id && img.is_primary)
      return { success: true, data: { ...updated, primary_image: primary ? primary.file_path : null } }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── persons:delete ─────────────────────────────────────────────────────────
  ipcMain.handle('persons:delete', async (_event, data) => {
    try {
      const { persons, relationships, images, save } = getDB()
      for (const [rid, rel] of Object.entries(relationships)) {
        if (rel.person_a_id === data.id || rel.person_b_id === data.id) {
          delete relationships[rid]
        }
      }
      for (const [iid, img] of Object.entries(images)) {
        if (img.person_id === data.id) {
          try { fs.unlinkSync(img.file_path) } catch (_) { /* ignore */ }
          delete images[iid]
        }
      }
      delete persons[data.id]
      save()
      return { success: true, data: { id: data.id } }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── relationships:getAll ───────────────────────────────────────────────────
  ipcMain.handle('relationships:getAll', async () => {
    try {
      const { relationships } = getDB()
      return { success: true, data: sortByDate(forTree(relationships)) }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── relationships:create ───────────────────────────────────────────────────
  ipcMain.handle('relationships:create', async (_event, data) => {
    try {
      const { relationships, save, nowStr } = getDB()
      const id = randomUUID()
      const rel = {
        id,
        tree_id: activeTree(),
        person_a_id: data.person_a_id,
        person_b_id: data.person_b_id,
        type: data.type,
        status: data.status || 'active',
        formed_date: data.formed_date || null,
        created_at: nowStr()
      }
      relationships[id] = rel
      save()
      return { success: true, data: rel }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── relationships:update ───────────────────────────────────────────────────
  ipcMain.handle('relationships:update', async (_event, data) => {
    try {
      const { relationships, save } = getDB()
      const existing = relationships[data.id]
      if (!existing) return { success: false, error: 'Relationship not found' }
      if (data.status !== undefined) existing.status = data.status
      if (data.formed_date !== undefined) existing.formed_date = data.formed_date
      save()
      return { success: true, data: existing }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── relationships:delete ───────────────────────────────────────────────────
  ipcMain.handle('relationships:delete', async (_event, data) => {
    try {
      const { relationships, save } = getDB()
      delete relationships[data.id]
      save()
      return { success: true, data: { id: data.id } }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── images:getByPerson ─────────────────────────────────────────────────────
  ipcMain.handle('images:getByPerson', async (_event, data) => {
    try {
      const { images } = getDB()
      const rows = sortByDate(Object.values(images).filter(img => img.person_id === data.personId))
      rows.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
      return { success: true, data: rows }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── images:openDialog ──────────────────────────────────────────────────────
  ipcMain.handle('images:openDialog', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }]
      })
      if (result.canceled || !result.filePaths.length) return { success: true, data: null }
      return { success: true, data: result.filePaths[0] }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── images:add ─────────────────────────────────────────────────────────────
  ipcMain.handle('images:add', async (_event, data) => {
    try {
      const { images, save, nowStr } = getDB()
      const { personId, srcPath, isPrimary } = data
      const ext = path.extname(srcPath)
      const uuid = randomUUID()
      const filename = uuid + ext
      const destPath = path.join(app.getPath('userData'), 'images', filename)
      fs.copyFileSync(srcPath, destPath)
      if (isPrimary) {
        for (const img of Object.values(images)) {
          if (img.person_id === personId) img.is_primary = false
        }
      }
      const id = randomUUID()
      const img = { id, tree_id: activeTree(), person_id: personId, file_path: destPath, is_primary: !!isPrimary, created_at: nowStr() }
      images[id] = img
      save()
      return { success: true, data: img }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── images:setPrimary ──────────────────────────────────────────────────────
  ipcMain.handle('images:setPrimary', async (_event, data) => {
    try {
      const { images, save } = getDB()
      const { imageId, personId } = data
      for (const img of Object.values(images)) {
        if (img.person_id === personId) img.is_primary = false
      }
      if (images[imageId]) images[imageId].is_primary = true
      save()
      return { success: true, data: { imageId } }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── images:delete ──────────────────────────────────────────────────────────
  ipcMain.handle('images:delete', async (_event, data) => {
    try {
      const { images, save } = getDB()
      const { imageId } = data
      const img = images[imageId]
      if (img) {
        try { fs.unlinkSync(img.file_path) } catch (_) { /* gone */ }
        delete images[imageId]
        save()
      }
      return { success: true, data: { imageId } }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── settings:getAll (per-tree) ─────────────────────────────────────────────
  ipcMain.handle('settings:getAll', async () => {
    try {
      const { settings } = getDB()
      const tid = activeTree()
      const result = {}
      const prefix = `${tid}:`
      for (const [key, value] of Object.entries(settings)) {
        if (key.startsWith(prefix)) {
          result[key.slice(prefix.length)] = value
        }
      }
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── settings:set (per-tree) ────────────────────────────────────────────────
  ipcMain.handle('settings:set', async (_event, data) => {
    try {
      const { settings, save } = getDB()
      const tid = activeTree()
      const { key, value } = data
      settings[`${tid}:${key}`] = value
      save()
      return { success: true, data: { key, value } }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── globalSettings:getAll ──────────────────────────────────────────────────
  ipcMain.handle('globalSettings:getAll', async () => {
    try {
      const { globalSettings } = getDB()
      return { success: true, data: { ...globalSettings } }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── globalSettings:set ─────────────────────────────────────────────────────
  ipcMain.handle('globalSettings:set', async (_event, data) => {
    try {
      const { globalSettings, save } = getDB()
      globalSettings[data.key] = data.value
      save()
      return { success: true, data: { key: data.key, value: data.value } }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}
