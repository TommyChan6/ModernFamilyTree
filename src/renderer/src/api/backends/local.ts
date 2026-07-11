import type { ApiBackend } from '../types'
import type { DB, Env } from '../../../../shared/types'
import {
  channelHandlers,
  WRITE_CHANNELS,
  createInitialDB,
  EMPTY_DB,
  migrateTreesToProjects,
  migrateYearsToDateValues,
  nowStr
} from '../../../../shared/dbCore'

// Browser-local backend: the same shared data core the Electron main process
// runs (src/shared/dbCore.ts), persisted to IndexedDB instead of a file on
// disk. This is what `npm run dev:web` uses, so the app runs end-to-end in a
// plain browser — no server, no account, no cost — and behaves identically to
// the desktop app by construction. The hosted deployment later adds an HTTP/
// Supabase backend beside this one; this local store then doubles as the
// offline/demo mode.
//
// Photos are stored as data: URLs inside the DB record itself (no separate
// file store), so getImageUrl is a passthrough and cascade deletes need no
// file cleanup.

// ── IndexedDB persistence (single key-value record holding the whole DB) ────
const IDB_NAME = 'familytree'
const IDB_STORE = 'kv'
const IDB_KEY = 'db'

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(key: string): Promise<unknown> {
  const idb = await openIDB()
  try {
    return await new Promise((resolve, reject) => {
      const req = idb.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    idb.close()
  }
}

async function idbPut(key: string, value: unknown): Promise<void> {
  const idb = await openIDB()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    idb.close()
  }
}

// ── The in-memory DB, loaded once and written back after every mutation ─────
const env: Env = {
  uuid: () => crypto.randomUUID(),
  nowStr,
  storeImageFile: (srcPath) => srcPath, // already a data: URL — store as-is
  removeImageFile: () => {} // nothing external to delete
}

let dbPromise: Promise<DB> | null = null
function getLocalDB(): Promise<DB> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const stored = (await idbGet(IDB_KEY).catch(() => null)) as DB | null
      // Merge over the empty shape so tables added later always exist
      if (stored) {
        const merged = { ...EMPTY_DB(), ...stored }
        // One-time migrations for stores written before the overhaul:
        // tree → project rename, then bare years → DateValues
        const renamed = migrateTreesToProjects(merged)
        const datesWrapped = migrateYearsToDateValues(merged)
        if (renamed || datesWrapped) void persist(merged)
        return merged
      }
      const db = createInitialDB(env)
      void persist(db)
      return db
    })()
  }
  return dbPromise
}

// Writes are chained so snapshots reach IndexedDB in mutation order.
let writeChain: Promise<void> = Promise.resolve()
function persist(db: DB): Promise<void> {
  const snapshot = structuredClone(db) // decouple from ongoing mutations
  writeChain = writeChain
    .then(() => idbPut(IDB_KEY, snapshot))
    .catch((err) => console.error('Local DB persist failed:', err))
  return writeChain
}

// ── Platform channels (the desktop uses a native dialog / fs for these) ─────
function pickImageAsDataUrl(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/png,image/gif,image/webp'
    input.onchange = () => {
      const file = input.files && input.files[0]
      if (!file) return resolve(null)
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    }
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}

async function imageBytes(filePath: string): Promise<Uint8Array> {
  const res = await fetch(filePath) // data: URLs are fetchable
  return new Uint8Array(await res.arrayBuffer())
}

// ── The backend ──────────────────────────────────────────────────────────────
export const localBackend: ApiBackend = {
  async invoke(channel, data) {
    try {
      if (channel === 'images:openDialog') {
        return { success: true, data: await pickImageAsDataUrl() }
      }
      if (channel === 'images:bytes') {
        const { filePath } = (data || {}) as { filePath?: string }
        if (!filePath) return { success: false, error: 'missing' }
        return { success: true, data: await imageBytes(filePath) }
      }
      const handler = channelHandlers[channel]
      if (!handler) return { success: false, error: `Unknown channel: ${channel}` }
      const db = await getLocalDB()
      const result = handler(db, data, env)
      if (WRITE_CHANNELS.has(channel)) void persist(db)
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  },
  getImageUrl: (ref) => ref || null
}
