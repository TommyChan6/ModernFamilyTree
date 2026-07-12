// The renderer's copy of the session token — the local stand-in for a session
// cookie. index.ts attaches it to every api.invoke; it survives restarts via
// localStorage (works identically in the Electron renderer and the browser).

const STORAGE_KEY = 'familytree.sessionToken'

let token: string | null = null
try {
  token = localStorage.getItem(STORAGE_KEY)
} catch {
  token = null
}

export function getSessionToken(): string | null {
  return token
}

export function setSessionToken(value: string): void {
  token = value
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    /* private mode / storage denied — session just won't survive a restart */
  }
}

export function clearSessionToken(): void {
  token = null
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
