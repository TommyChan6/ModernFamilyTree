import { describe, it, expect, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'
import { channelHandlers, createInitialDB } from '../src/shared/dbCore'

// Undo/redo (src/shared/history.ts): the shared core wraps every undoable
// data channel with a before-snapshot, and history:undo / history:redo swap
// the live project rows against those snapshots. Stacks are in-memory and
// per project; image-file removals are deferred until nothing (live rows or
// stack snapshots) references the file anymore.

let removedFiles
const env = {
  uuid: () => randomUUID(),
  nowStr: () => '2026-01-01 00:00:00',
  storeImageFile: (p) => p,
  removeImageFile: (p) => removedFiles.push(p)
}

const invoke = (db, channel, data) => channelHandlers[channel](db, data, env)
const status = (db) => invoke(db, 'history:status')
const personsOf = (db) =>
  Object.values(db.persons).filter((p) => p.project_id === db.activeProjectId)

let db
beforeEach(() => {
  removedFiles = []
  db = createInitialDB(env)
})

describe('history — status & basic undo/redo', () => {
  it('starts with nothing to undo or redo', () => {
    expect(status(db)).toEqual({
      canUndo: false,
      canRedo: false,
      undoChannel: null,
      redoChannel: null
    })
  })

  it('undoes and redoes a person creation', () => {
    const before = personsOf(db).length
    const created = invoke(db, 'persons:create', { name: 'Undo Me' })
    expect(status(db)).toMatchObject({
      canUndo: true,
      canRedo: false,
      undoChannel: 'persons:create'
    })

    const undone = invoke(db, 'history:undo')
    expect(undone.channel).toBe('persons:create')
    expect(db.persons[created.id]).toBeUndefined()
    expect(personsOf(db)).toHaveLength(before)
    expect(status(db)).toMatchObject({
      canUndo: false,
      canRedo: true,
      redoChannel: 'persons:create'
    })

    const redone = invoke(db, 'history:redo')
    expect(redone.channel).toBe('persons:create')
    expect(db.persons[created.id]).toMatchObject({ id: created.id, name: 'Undo Me' })
    expect(status(db)).toMatchObject({ canUndo: true, canRedo: false })
  })

  it('undo restores the pre-edit state of an update (and its trait values)', () => {
    const person = invoke(db, 'persons:create', { name: 'Original', occupation: 'Farmer' })
    invoke(db, 'persons:update', { id: person.id, name: 'Renamed', occupation: 'Sailor' })
    expect(db.persons[person.id].name).toBe('Renamed')

    invoke(db, 'history:undo')
    expect(db.persons[person.id].name).toBe('Original')
    expect(db.persons[person.id].occupation).toBe('Farmer')
    // The derived snapshot columns come from field_values — they were restored too
    const values = Object.values(db.field_values).filter((v) => v.person_id === person.id)
    expect(values.length).toBeGreaterThan(0)
  })

  it('undo of a delete brings back the person with relationships and values', () => {
    const a = invoke(db, 'persons:create', { name: 'A' })
    const b = invoke(db, 'persons:create', { name: 'B' })
    const rel = invoke(db, 'relationships:create', {
      person_a_id: a.id,
      person_b_id: b.id,
      type: 'spouse'
    })
    invoke(db, 'persons:delete', { id: a.id })
    expect(db.persons[a.id]).toBeUndefined()
    expect(db.relationships[rel.id]).toBeUndefined()

    invoke(db, 'history:undo')
    expect(db.persons[a.id]).toMatchObject({ name: 'A' })
    expect(db.relationships[rel.id]).toMatchObject({ type: 'spouse' })
  })

  it('a fresh edit after undo clears the redo stack', () => {
    invoke(db, 'persons:create', { name: 'One' })
    invoke(db, 'history:undo')
    expect(status(db).canRedo).toBe(true)
    invoke(db, 'persons:create', { name: 'Two' })
    expect(status(db)).toMatchObject({ canUndo: true, canRedo: false })
    expect(() => invoke(db, 'history:redo')).toThrow('Nothing to redo')
  })

  it('throws when there is nothing to undo', () => {
    expect(() => invoke(db, 'history:undo')).toThrow('Nothing to undo')
  })
})

describe('history — atomicity & scoping', () => {
  it('a failing handler records nothing and leaves the DB untouched', () => {
    const before = JSON.stringify(db.relationships)
    expect(() =>
      invoke(db, 'relationships:create', {
        person_a_id: 'nope',
        person_b_id: 'nada',
        type: 'no-such-type'
      })
    ).toThrow()
    expect(JSON.stringify(db.relationships)).toBe(before)
    expect(status(db).canUndo).toBe(false)
  })

  it('stacks are per project — switching projects switches history', () => {
    const projectA = db.activeProjectId
    const aPerson = invoke(db, 'persons:create', { name: 'In project A' })
    expect(status(db).canUndo).toBe(true)

    const projectB = invoke(db, 'projects:create', { name: 'B' })
    invoke(db, 'projects:setActive', { id: projectB.id })
    expect(status(db)).toMatchObject({ canUndo: false, canRedo: false })

    const bPerson = invoke(db, 'persons:create', { name: 'In project B' })
    invoke(db, 'history:undo')
    expect(db.persons[bPerson.id]).toBeUndefined()

    // Back in A, its own step is still undoable and undoing it leaves B alone
    invoke(db, 'projects:setActive', { id: projectA })
    expect(status(db)).toMatchObject({ canUndo: true, undoChannel: 'persons:create' })
    const bCount = Object.values(db.persons).filter((p) => p.project_id === projectB.id).length
    invoke(db, 'history:undo')
    expect(db.persons[aPerson.id]).toBeUndefined()
    expect(Object.values(db.persons).filter((p) => p.project_id === projectB.id)).toHaveLength(
      bCount
    )
  })

  it('scene placements survive a tag delete + undo round-trip', () => {
    const tag = invoke(db, 'tags:create', { label: 'House Stark' })
    const scene = invoke(db, 'scenes:create', { view: 'groups', name: 'Scene 1' })
    const placement = invoke(db, 'scene_tags:add', {
      scene_id: scene.id,
      tag_id: tag.id,
      x: 5,
      y: 7
    })
    invoke(db, 'tags:delete', { id: tag.id })
    expect(db.tags[tag.id]).toBeUndefined()
    expect(db.scene_tags[placement.id]).toBeUndefined()

    invoke(db, 'history:undo')
    expect(db.tags[tag.id]).toMatchObject({ label: 'House Stark' })
    expect(db.scene_tags[placement.id]).toMatchObject({ x: 5, y: 7 })
  })
})

describe('history — deferred image-file deletion', () => {
  it('deleting a person defers the file removal so undo restores the photo', () => {
    const p = invoke(db, 'persons:create', { name: 'Photographed' })
    invoke(db, 'images:add', { personId: p.id, srcPath: '/imgs/f.png', isPrimary: true })
    invoke(db, 'persons:delete', { id: p.id })
    // The record cascade ran, but the file itself is still needed by history
    expect(Object.values(db.images).some((i) => i.person_id === p.id)).toBe(false)
    expect(removedFiles).toEqual([])

    invoke(db, 'history:undo')
    const restored = Object.values(db.images).find((i) => i.person_id === p.id)
    expect(restored).toMatchObject({ file_path: '/imgs/f.png', is_primary: true })
    expect(removedFiles).toEqual([])
  })

  it('physically deletes the file once no snapshot references it anymore', () => {
    const p = invoke(db, 'persons:create', { name: 'Photographed' })
    invoke(db, 'images:add', { personId: p.id, srcPath: '/imgs/gone.png' })
    invoke(db, 'persons:delete', { id: p.id })
    expect(removedFiles).toEqual([])
    // Push the delete entry (and every snapshot that saw the file) off the
    // capped undo stack — only then is the file unreferenced and removed.
    for (let i = 0; i < 55; i++) invoke(db, 'persons:create', { name: `filler ${i}` })
    expect(removedFiles).toContain('/imgs/gone.png')
    expect(removedFiles.filter((f) => f === '/imgs/gone.png')).toHaveLength(1)
  })

  it('an added photo is cleaned up when its redo entry is discarded', () => {
    const p = invoke(db, 'persons:create', { name: 'P' })
    invoke(db, 'images:add', { personId: p.id, srcPath: '/imgs/added.png' })
    invoke(db, 'history:undo') // record gone; file only referenced by the redo snapshot
    expect(removedFiles).toEqual([])
    invoke(db, 'persons:update', { id: p.id, name: 'P2' }) // forks history — redo dropped
    expect(removedFiles).toContain('/imgs/added.png')
  })
})

describe('history — cap', () => {
  it('keeps at most 50 undo steps', () => {
    for (let i = 0; i < 60; i++) invoke(db, 'persons:create', { name: `n${i}` })
    let undone = 0
    while (status(db).canUndo) {
      invoke(db, 'history:undo')
      undone++
    }
    expect(undone).toBe(50)
  })
})

describe('history — write channel registration', () => {
  it('history channels persist through the shells', async () => {
    const { WRITE_CHANNELS } = await import('../src/shared/dbCore')
    expect(WRITE_CHANNELS.has('history:undo')).toBe(true)
    expect(WRITE_CHANNELS.has('history:redo')).toBe(true)
  })
})
