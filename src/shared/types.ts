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

/** A labelled set of entities (a family, a house, "Villains", …). Identity
 *  only — membership lives in the entity_tags join, so a tag can appear in any
 *  number of scenes without copying members. */
export interface Tag {
  id: string
  project_id: string
  label: string
  /** Free-form category (e.g. 'family', 'allegiance'). Empty for plain tags. */
  type: string
  /** 'manual' = user-assigned members; 'derived' = computed (planned, not stored). */
  source: 'manual' | 'derived'
  color: string
  icon: string
  created_at: string
  updated_at: string
}

/** Many-to-many join row: one entity's membership in one tag. */
export interface EntityTag {
  id: string
  entity_id: string
  tag_id: string
  created_at: string
}

/** A tag placed in a (groups) scene — this is what the UI calls a "Group".
 *  Position/visibility live here; membership stays on the tag's join. */
export interface SceneTag {
  id: string
  scene_id: string
  tag_id: string
  x: number
  y: number
  visible: boolean
  created_at: string
  updated_at: string
}

export interface Faction {
  id: string
  project_id: string
  /** The groups Scene this faction lives in (was the scenario id — scenes kept
   *  the same ids in the migration). Being dissolved into tags in Phase 4. */
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

/** A saved arrangement of ONE view. Groups scenes replace the old
 *  "scenarios"; graph scenes replace the serialized graphState "states"
 *  (Phase 5). Directory/Relationships have no positions → no scenes. */
export interface Scene {
  id: string
  project_id: string
  /** Which view owns this scene: 'groups' | 'graph' | 'timeline'. */
  view: string
  name: string
  /** Graph layout type (free/organic/birth/generations); null elsewhere. */
  type: string | null
  /** View-specific settings (e.g. generation-row config). */
  config: Record<string, unknown>
  /** Per-entity position snapshots (graph/timeline scenes). */
  positions: Record<string, unknown>
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
  tags: Record<string, Tag>
  entity_tags: Record<string, EntityTag>
  factions: Record<string, Faction>
  scenes: Record<string, Scene>
  scene_tags: Record<string, SceneTag>
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
