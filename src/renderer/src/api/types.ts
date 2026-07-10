import type { ApiResult } from '../../../shared/types'

// The renderer-side data-access contract. Components and the Pinia store only
// ever see this surface; which backend sits behind it is decided in index.ts.
export interface ApiBackend {
  invoke(channel: string, data?: unknown): Promise<ApiResult>
  /** Turn a stored image reference (file path or data URL) into a displayable URL. */
  getImageUrl(ref: string | null | undefined): string | null
}

declare global {
  interface Window {
    /** Present only inside Electron — exposed by src/preload/index.js. */
    electronAPI?: {
      invoke(channel: string, data?: unknown): Promise<ApiResult>
      getImageUrl(filePath: string | null | undefined): string | null
    }
  }
}
