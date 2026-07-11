// Data shapes shared by every backend (Electron main, browser-local, and the
// future HTTP/Supabase implementation). These are the client↔server contract.

export interface Project {
  id: string
  name: string
  created_at: string
  updated_at: string
}

/** A structured, mutable date. Only the Gregorian calendar (usually just a
 *  year) is used for now, but the shape lets custom calendars slot in later as
 *  a data-compatible change. `null` parts mean "unknown / not entered"; the
 *  precision says how much of the date is meaningful. */
export interface DateValue {
  year: number | null
  month: number | null
  day: number | null
  precision: 'year' | 'month' | 'day'
  calendar: 'gregorian'
}

export interface Person {
  id: string
  project_id: string
  name: string
  birth: DateValue | null
  death: DateValue | null
  gender: string
  bio: string
  occupation: string
  location: string
  created_at: string
  updated_at: string
}

export interface Relationship {
  id: string
  project_id: string
  person_a_id: string
  person_b_id: string
  type: string
  status: string
  formed: DateValue | null
  created_at: string
}

export interface Faction {
  id: string
  project_id: string
  scenario_id: string | null
  name: string
  description: string
  color: string
  icon: string
  member_ids: string[]
  x: number
  y: number
  visible: boolean
  created_at: string
  updated_at: string
}

export interface Scenario {
  id: string
  project_id: string
  name: string
  created_at: string
  updated_at: string
}

export interface ImageRecord {
  id: string
  project_id: string
  person_id: string
  /** Desktop: absolute path under userData/images. Web: a data: URL. */
  file_path: string
  is_primary: boolean
  created_at: string
}

export interface DB {
  projects: Record<string, Project>
  activeProjectId: string | null
  persons: Record<string, Person>
  relationships: Record<string, Relationship>
  factions: Record<string, Faction>
  scenarios: Record<string, Scenario>
  images: Record<string, ImageRecord>
  /** `${projectId}:key` → value for per-project settings */
  settings: Record<string, unknown>
  /** theme, etc. */
  globalSettings: Record<string, unknown>
}

/** Uniform result envelope every channel returns across the process/network boundary. */
export interface ApiResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/** Platform services the shared channel handlers need but cannot implement themselves. */
export interface Env {
  uuid(): string
  nowStr(): string
  /** Persist a picked image, returning the stored file_path (desktop copies the
   *  file into userData/images; web passes the data URL straight through). */
  storeImageFile(srcPath: string): string
  /** Best-effort removal of a stored image file (no-op where nothing external exists). */
  removeImageFile(filePath: string): void
}
