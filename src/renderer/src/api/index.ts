import type { ApiBackend } from './types'
import { ipcBackend } from './backends/ipc'
import { localBackend } from './backends/local'
import { supabaseBackend } from './backends/supabase'
import { wrapRequest } from '../../../shared/auth'
import { UNDOABLE_CHANNELS } from '../../../shared/history'
import { getSessionToken } from './session'

// The data-access seam. Everything above this line (store, components) is
// backend-agnostic; everything below is swappable:
//   - VITE_API_BACKEND=supabase → supabaseBackend (hosted Postgres via
//     supabase-js; see docs/DEPLOYMENT_PLAN.md)
//   - Electron desktop  → ipcBackend (preload bridge → main process → JSON file)
//   - plain browser     → localBackend (shared data core over IndexedDB)
const backend: ApiBackend =
  import.meta.env.VITE_API_BACKEND === 'supabase'
    ? supabaseBackend
    : window.electronAPI
      ? ipcBackend
      : localBackend

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

// Plan-limit listeners: any channel refusing with a quota error ("Free plan
// limit reached: …") is announced here, so ONE place (App.vue) can offer the
// upgrade — however deep in the UI the refused action started.
type PlanLimitListener = (channel: string, error: string) => void
const planLimitListeners = new Set<PlanLimitListener>()
export function onPlanLimit(cb: PlanLimitListener): () => void {
  planLimitListeners.add(cb)
  return () => planLimitListeners.delete(cb)
}
const PLAN_LIMIT_RE = /plan limit reached/i

// Every request carries the session token, the way a browser attaches its
// session cookie — the shells resolve it back to a user before dispatching.
export const api: ApiBackend = {
  invoke: async (channel, data) => {
    const res = await backend.invoke(channel, wrapRequest(getSessionToken(), data))
    if (res?.success && UNDOABLE_CHANNELS.has(channel)) {
      for (const cb of mutationListeners) cb(channel)
    }
    if (res && !res.success && PLAN_LIMIT_RE.test(res.error || '')) {
      for (const cb of planLimitListeners) cb(channel, res.error as string)
    }
    return res
  },
  getImageUrl: (ref) => backend.getImageUrl(ref)
}
