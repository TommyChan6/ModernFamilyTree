import type { ApiBackend } from './types'
import { ipcBackend } from './backends/ipc'
import { localBackend } from './backends/local'

// The data-access seam. Everything above this line (store, components) is
// backend-agnostic; everything below is swappable:
//   - Electron desktop  → ipcBackend (preload bridge → main process → JSON file)
//   - plain browser     → localBackend (shared data core over IndexedDB)
//   - hosted web (later)→ an HTTP/Supabase backend added beside these and
//     selected via import.meta.env.VITE_API_BACKEND, per docs/DEPLOYMENT_PLAN.md
export const api: ApiBackend = window.electronAPI ? ipcBackend : localBackend
