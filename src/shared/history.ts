// Undo/redo over the project's DATA (people, traits, relationships, types,
// tags, memberships, placements, images, characters). Arrangement state
// (scenes, positions, settings) stays outside — the checkpoint system owns it.
//
// How it works: dbCore wraps every channel in UNDOABLE_CHANNELS with
// withHistory(), which captures a before-snapshot of the active project's
// data rows, runs the real handler, and pushes the snapshot onto that
// project's undo stack. history:undo/redo swap the live rows against the
// top snapshot. Stacks live in memory only (a WeakMap keyed by the DB
// object) — history intentionally resets with the process, like an editor.
//
// Image files: handlers delete image files through env.removeImageFile as
// they cascade. Under history that would make undo restore a record whose
// file is gone, so withHistory intercepts removals and defers them. A file
// is physically deleted only once nothing references it anymore — neither
// the live DB nor any snapshot still sitting in an undo/redo stack.

import type {
  AuthCtx,
  CharacterDoc,
  DB,
  EntityTag,
  Env,
  FieldDef,
  FieldValue,
  ImageRecord,
  Person,
  Relationship,
  RelationshipTypeDef,
  SceneTag,
  Tag
} from './types'

// Matches dbCore's Handler shape (kept local to avoid a circular import).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (db: DB, data: any, env: Env, ctx?: AuthCtx) => unknown

/** Channels whose effects the undo stack records. Data edits only — scene
 *  arrangement (scenes:*, scene_tags:move) and settings autosave far too
 *  often to be meaningful undo steps and are covered by the checkpoint. */
export const UNDOABLE_CHANNELS = new Set([
  'persons:create',
  'persons:update',
  'persons:delete',
  'fields:createDef',
  'fields:updateDef',
  'fields:deleteDef',
  'fields:reorderDefs',
  'fields:setSlot',
  'fields:setValue',
  'fields:setValues',
  'fields:removeValue',
  'fields:applyDisplayAll',
  'relationships:create',
  'relationships:update',
  'relationships:delete',
  'relTypes:create',
  'relTypes:update',
  'relTypes:delete',
  'tags:create',
  'tags:update',
  'tags:delete',
  'entity_tags:add',
  'entity_tags:remove',
  'scene_tags:add',
  'scene_tags:remove',
  'images:add',
  'images:setRole',
  'images:setPrimary',
  'images:delete',
  'characters:save',
  'characters:delete',
  'characters:setPortrait'
])

/** Undo steps kept per project. Snapshots are full copies of the project's
 *  data rows, so the cap bounds memory. */
const HISTORY_CAP = 50

/** Every data table a snapshot covers (scenes/settings deliberately absent). */
interface HistorySnapshot {
  persons: Record<string, Person>
  field_defs: Record<string, FieldDef>
  field_values: Record<string, FieldValue>
  relationships: Record<string, Relationship>
  rel_type_defs: Record<string, RelationshipTypeDef>
  tags: Record<string, Tag>
  entity_tags: Record<string, EntityTag>
  scene_tags: Record<string, SceneTag>
  images: Record<string, ImageRecord>
  characters: Record<string, CharacterDoc>
}

interface HistoryEntry {
  /** The channel whose effect undoing this entry reverses (for UI labels). */
  channel: string
  /** The project's data rows as they were BEFORE that channel ran. */
  snapshot: HistorySnapshot
  /** File removals the handler requested, deferred until nothing needs them. */
  files: string[]
}

interface ProjectHistory {
  undo: HistoryEntry[]
  redo: HistoryEntry[]
  /** Paths whose deletion was deferred and whose owning entries are gone —
   *  candidates the GC deletes once no live row or snapshot references them. */
  managedFiles: Set<string>
}

// In-memory only, keyed weakly by the DB object each shell holds.
const histories = new WeakMap<DB, Map<string, ProjectHistory>>()

function historyOf(db: DB, pid: string): ProjectHistory {
  let perProject = histories.get(db)
  if (!perProject) {
    perProject = new Map()
    histories.set(db, perProject)
  }
  let h = perProject.get(pid)
  if (!h) {
    h = { undo: [], redo: [], managedFiles: new Set() }
    perProject.set(pid, h)
  }
  return h
}

// ── Snapshot capture / restore ───────────────────────────────────────────────

const clone = <T>(row: T): T => JSON.parse(JSON.stringify(row)) as T

/** Row-scope predicates for the active project, computed against a given DB
 *  state (capture uses the live state; restore reuses them to clear it). */
function projectScope(db: DB, pid: string) {
  const personIds = new Set<string>()
  for (const p of Object.values(db.persons)) if (p.project_id === pid) personIds.add(p.id)
  const tagIds = new Set<string>()
  for (const t of Object.values(db.tags)) if (t.project_id === pid) tagIds.add(t.id)
  const sceneIds = new Set<string>()
  for (const s of Object.values(db.scenes)) if (s.project_id === pid) sceneIds.add(s.id)
  return { personIds, tagIds, sceneIds }
}

function captureSnapshot(db: DB, pid: string): HistorySnapshot {
  const { personIds, tagIds, sceneIds } = projectScope(db, pid)
  const pick = <T extends { id: string }>(
    table: Record<string, T>,
    keep: (row: T) => boolean,
    copy: (row: T) => T = clone
  ): Record<string, T> => {
    const out: Record<string, T> = {}
    for (const row of Object.values(table || {})) if (keep(row)) out[row.id] = copy(row)
    return out
  }
  return {
    persons: pick(db.persons, (r) => r.project_id === pid),
    field_defs: pick(db.field_defs, (r) => r.project_id === pid),
    field_values: pick(db.field_values, (r) => personIds.has(r.person_id)),
    relationships: pick(db.relationships, (r) => r.project_id === pid),
    rel_type_defs: pick(db.rel_type_defs, (r) => r.project_id === pid),
    tags: pick(db.tags, (r) => r.project_id === pid),
    entity_tags: pick(db.entity_tags, (r) => tagIds.has(r.tag_id)),
    scene_tags: pick(db.scene_tags, (r) => sceneIds.has(r.scene_id)),
    // Image rows are flat, and on the web build file_path IS the photo (a
    // data: URL, possibly megabytes) — a shallow copy shares those strings
    // instead of re-serializing them into every snapshot.
    images: pick(
      db.images,
      (r) => r.project_id === pid,
      (r) => ({ ...r })
    ),
    characters: pick(db.characters || {}, (r) => r.project_id === pid)
  }
}

/** Replace the project's data rows wholesale with a snapshot's. Inserted rows
 *  are copies — the snapshot must survive the live rows being mutated later
 *  (undo → redo → undo replays it). */
function restoreSnapshot(db: DB, pid: string, snap: HistorySnapshot): void {
  const { personIds, tagIds, sceneIds } = projectScope(db, pid)
  const swap = <T extends { id: string }>(
    table: Record<string, T>,
    scoped: (row: T) => boolean,
    rows: Record<string, T>,
    copy: (row: T) => T = clone
  ) => {
    for (const [id, row] of Object.entries(table)) if (scoped(row)) delete table[id]
    for (const row of Object.values(rows)) table[row.id] = copy(row)
  }
  swap(db.persons, (r) => r.project_id === pid, snap.persons)
  swap(db.field_defs, (r) => r.project_id === pid, snap.field_defs)
  swap(db.field_values, (r) => personIds.has(r.person_id), snap.field_values)
  swap(db.relationships, (r) => r.project_id === pid, snap.relationships)
  swap(db.rel_type_defs, (r) => r.project_id === pid, snap.rel_type_defs)
  swap(db.tags, (r) => r.project_id === pid, snap.tags)
  swap(db.entity_tags, (r) => tagIds.has(r.tag_id), snap.entity_tags)
  // A placement only makes sense inside a scene that still exists (scenes are
  // not part of the snapshot — one may have been deleted since).
  swap(db.scene_tags, (r) => sceneIds.has(r.scene_id), snap.scene_tags)
  for (const [id, st] of Object.entries(db.scene_tags)) {
    if (!db.scenes[st.scene_id]) delete db.scene_tags[id]
  }
  swap(
    db.images,
    (r) => r.project_id === pid,
    snap.images,
    (r) => ({ ...r })
  )
  db.characters = db.characters || {}
  swap(db.characters, (r) => r.project_id === pid, snap.characters)
}

// ── Deferred image-file GC ───────────────────────────────────────────────────

/** Real files a snapshot references (data: URLs have no file to manage). */
function snapshotFilePaths(snap: HistorySnapshot): string[] {
  return Object.values(snap.images)
    .map((img) => img.file_path)
    .filter((p) => p && !p.startsWith('data:'))
}

/** Fold discarded entries' deferred removals + snapshot references into the
 *  GC candidate set. Call whenever a HistoryEntry leaves both stacks. */
function markDiscarded(h: ProjectHistory, entries: HistoryEntry[]): void {
  for (const e of entries) {
    for (const p of e.files) if (p && !p.startsWith('data:')) h.managedFiles.add(p)
    for (const p of snapshotFilePaths(e.snapshot)) h.managedFiles.add(p)
  }
}

/** Delete candidate files nothing references anymore — neither a live image
 *  row nor any snapshot still in an undo/redo stack. */
function gcFiles(db: DB, h: ProjectHistory, env: Env): void {
  if (!h.managedFiles.size) return
  const keep = new Set<string>()
  for (const img of Object.values(db.images)) keep.add(img.file_path)
  for (const stack of [h.undo, h.redo]) {
    for (const e of stack) {
      for (const p of e.files) keep.add(p)
      for (const p of snapshotFilePaths(e.snapshot)) keep.add(p)
    }
  }
  for (const p of [...h.managedFiles]) {
    if (!keep.has(p)) {
      env.removeImageFile(p)
      h.managedFiles.delete(p)
    }
  }
}

// ── The wrapper dbCore applies to every undoable channel ────────────────────

function pushEntry(db: DB, pid: string, env: Env, entry: HistoryEntry): void {
  const h = historyOf(db, pid)
  h.undo.push(entry)
  const dropped: HistoryEntry[] = []
  while (h.undo.length > HISTORY_CAP) dropped.push(h.undo.shift() as HistoryEntry)
  // A fresh action forks history — whatever was redoable is gone.
  if (h.redo.length) dropped.push(...h.redo.splice(0))
  if (dropped.length) {
    markDiscarded(h, dropped)
    gcFiles(db, h, env)
  }
}

/** Wrap an undoable channel handler: capture a before-snapshot, defer file
 *  removals, and push the undo entry once the handler succeeds. A throwing
 *  handler is rolled back to the snapshot, so failed writes can never leave
 *  the project half-mutated (and never enter history). */
export function withHistory(channel: string, handler: Handler): Handler {
  return (db, data, env, ctx) => {
    const pid = db.activeProjectId
    if (!pid) return handler(db, data, env, ctx)
    const snapshot = captureSnapshot(db, pid)
    const files: string[] = []
    const deferringEnv: Env = { ...env, removeImageFile: (p: string) => files.push(p) }
    const commit = <T>(result: T): T => {
      pushEntry(db, pid, env, { channel, snapshot, files })
      return result
    }
    const rollback = (err: unknown): never => {
      restoreSnapshot(db, pid, snapshot)
      throw err
    }
    try {
      const result = handler(db, data, deferringEnv, ctx)
      if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
        return (result as Promise<unknown>).then(commit, rollback)
      }
      return commit(result)
    } catch (err) {
      return rollback(err)
    }
  }
}

// ── The history:* channels ───────────────────────────────────────────────────

export interface HistoryStatus {
  canUndo: boolean
  canRedo: boolean
  /** Channel name of the step undo/redo would revert/replay (UI labels). */
  undoChannel: string | null
  redoChannel: string | null
}

function statusOf(db: DB): HistoryStatus {
  const pid = db.activeProjectId
  const h = pid ? histories.get(db)?.get(pid) : null
  return {
    canUndo: !!h?.undo.length,
    canRedo: !!h?.redo.length,
    undoChannel: h?.undo.at(-1)?.channel ?? null,
    redoChannel: h?.redo.at(-1)?.channel ?? null
  }
}

function shift(db: DB, env: Env, dir: 'undo' | 'redo') {
  const pid = db.activeProjectId
  if (!pid) throw new Error('No active project')
  const h = historyOf(db, pid)
  const from = dir === 'undo' ? h.undo : h.redo
  const to = dir === 'undo' ? h.redo : h.undo
  const entry = from.pop()
  if (!entry) throw new Error(dir === 'undo' ? 'Nothing to undo' : 'Nothing to redo')
  // The inverse step: where the project stands right now.
  to.push({ channel: entry.channel, snapshot: captureSnapshot(db, pid), files: [] })
  restoreSnapshot(db, pid, entry.snapshot)
  markDiscarded(h, [entry])
  gcFiles(db, h, env)
  return { channel: entry.channel, status: statusOf(db) }
}

export const historyHandlers: Record<string, Handler> = {
  'history:status'(db) {
    return statusOf(db)
  },
  'history:undo'(db, _data, env) {
    return shift(db, env, 'undo')
  },
  'history:redo'(db, _data, env) {
    return shift(db, env, 'redo')
  }
}
