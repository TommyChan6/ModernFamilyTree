import type { ApiBackend } from '../types'

// Electron backend: a direct passthrough to the preload bridge. Kept as thin
// as possible — this sits under every data access in the desktop app.
export const ipcBackend: ApiBackend = {
  invoke: (channel, data) => window.electronAPI!.invoke(channel, data),
  getImageUrl: (ref) => window.electronAPI!.getImageUrl(ref)
}
