import type { ApiBackend } from './types'
import { ipcBackend } from './backends/ipc'
import { localBackend } from './backends/local'
import { wrapRequest } from '../../../shared/auth'
import { getSessionToken } from './session'

// The data-access seam. Everything above this line (store, components) is
// backend-agnostic; everything below is swappable:
//   - Electron desktop  → ipcBackend (preload bridge → main process → JSON file)
//   - plain browser     → localBackend (shared data core over IndexedDB)
//   - hosted web (later)→ an HTTP/Supabase backend added beside these and
//     selected via import.meta.env.VITE_API_BACKEND, per docs/DEPLOYMENT_PLAN.md
const backend: ApiBackend = window.electronAPI ? ipcBackend : localBackend

// Every request carries the session token, the way a browser attaches its
// session cookie — the shells resolve it back to a user before dispatching.
export const api: ApiBackend = {
  invoke: (channel, data) => backend.invoke(channel, wrapRequest(getSessionToken(), data)),
  getImageUrl: (ref) => backend.getImageUrl(ref)
}
