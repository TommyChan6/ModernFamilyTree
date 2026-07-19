import type { ApiBackend } from './types'
import { ipcBackend } from './backends/ipc'
import { localBackend } from './backends/local'
import { wrapRequest } from '../../../shared/auth'
import { UNDOABLE_CHANNELS } from '../../../shared/history'
import { getSessionToken } from './session'

// The data-access seam. Everything above this line (store, components) is
// backend-agnostic; everything below is swappable:
//   - Electron desktop  → ipcBackend (preload bridge → main process → JSON file)
//   - plain browser     → localBackend (shared data core over IndexedDB)
//   - hosted web (later)→ an HTTP/Supabase backend added beside these and
//     selected via import.meta.env.VITE_API_BACKEND, per docs/DEPLOYMENT_PLAN.md
const backend: ApiBackend = window.electronAPI ? ipcBackend : localBackend

// Undoable-mutation listeners: every successful call to a channel the undo
// stack records is announced here, so the store can keep the topbar's
// undo/redo state fresh no matter where the call originated (some components
// invoke images:* directly, bypassing store actions).
type MutationListener = (channel: string) => void
const mutationListeners = new Set<MutationListener>()
export function onUndoableMutation(cb: MutationListener): () => void {
  mutationListeners.add(cb)
  return () => mutationListeners.delete(cb)
}

// Every request carries the session token, the way a browser attaches its
// session cookie — the shells resolve it back to a user before dispatching.
export const api: ApiBackend = {
  invoke: async (channel, data) => {
    const res = await backend.invoke(channel, wrapRequest(getSessionToken(), data))
    if (res?.success && UNDOABLE_CHANNELS.has(channel)) {
      for (const cb of mutationListeners) cb(channel)
    }
    return res
  },
  getImageUrl: (ref) => backend.getImageUrl(ref)
}
