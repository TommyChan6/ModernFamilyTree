// Data shapes shared by every backend (Electron main, browser-local, and the
// future HTTP/Supabase implementation). These are the client↔server contract.

export interface Project {
  id: string
  name: string
  /** Owning account. null on projects created before accounts existed —
   *  the first registered user claims those. */
  user_id?: string | null
  created_at: string
  updated_at: string
}

/** A registered account. Password fields follow src/shared/auth.ts
 *  (PBKDF2-SHA256; per-user salt and iteration count). */
export interface User {
  id: string
  /** Display form, as typed at registration. */
  username: string
  /** Lower-cased lookup key — usernames are unique case-insensitively. */
  username_lower: string
  password_hash: string
  password_salt: string
  password_iterations: number
  /** Data tier — 'free' for now; paid tiers slot in later. */
  plan: string
  /** When the user accepted the Terms & Privacy Policy (registration). */
  tos_accepted_at: string
  /** Login throttling: consecutive failures + lockout expiry. */
  failed_logins: number
  locked_until: string | null
  /** Profile: optional friendly name shown instead of the username. */
  display_name?: string | null
  /** Profile: short free-form "about me" blurb. */
  bio?: string | null
  /** Profile: avatar hue override (0–359). null = derive from the username. */
  avatar_hue?: number | null
  created_at: string
}

/** A signed-in device. The token is the bearer credential the renderer
 *  attaches to every request (the local stand-in for a session cookie). */
export interface Session {
  token: string
  user_id: string
  created_at: string
  expires_at: string
}

/** The User shape safe to send to the renderer — no credential material. */
export interface PublicUser {
  id: string
  username: string
  plan: string
  display_name: string | null
  bio: string | null
  avatar_hue: number | null
  created_at: string
}

/** One project's headline numbers for the profile page's project cards. */
export interface ProjectOverview extends Project {
  counts: { persons: number; relationships: number; images: number }
}

// ── Sharing (planned) ─────────────────────────────────────────────────────────
// Not implemented yet — the profile page shows a preview of it. When the hosted
// backend lands, a `shares` table of these rows drives both "share a project"
// and "share an image of a project"; the profile page becomes its manager.
export type ShareVisibility = 'private' | 'link' | 'public'

export interface ProjectShare {
  id: string
  project_id: string
  user_id: string
  /** 'project' shares live data read-only; 'image' shares a rendered snapshot. */
  kind: 'project' | 'image'
  visibility: ShareVisibility
  /** Unguessable slug for link sharing (`/s/<slug>`). */
  slug: string
  created_at: string
}

/** Current consumption against the user's plan limits (for the account menu
 *  and quota errors). */
export interface UsageInfo {
  projects: number
  maxProjects: number
  persons: number
  maxPersons: number
  images: number
  maxImages: number
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

// ── Trait system (user-defined typed fields) ─────────────────────────────────
// Every person property is a user-defined "trait": a project-scoped FieldDef
// (what the trait is) plus per-person FieldValue rows (what it holds). Special
// slots (name/gender/birth/death/highlight) tell the graph which traits drive
// rendering. The legacy Person columns below survive as DERIVED SNAPSHOTS —
// recomputed by dbCore on every trait write — so views keep reading
// person.name / birth / death / gender untouched.

export type FieldType =
  | 'text' //           config: { multiline? }
  | 'boolean'
  | 'number' //         config: { min?, max?, step? }
  | 'number_range' //   value { a, b } — uncertainty range
  | 'select' //         config: { options: SelectOption[] }
  | 'slider' //         config: { min, max, step, leftLabel?, rightLabel? }
  | 'date' //           value: DateValue
  | 'date_range' //     value { from, to } — uncertainty range
  // Reserved for the custom-calendars feature (docs/design.md) — accepted by
  // the birth/death slots but not creatable yet:
  | 'custom_date'
  | 'custom_date_range'

export interface SelectOption {
  id: string
  label: string
  /** Optional swatch — doubles as the highlight-ring color when slotted. */
  color?: string
}

export interface FieldConfig {
  multiline?: boolean
  min?: number
  max?: number
  step?: number
  /** Slider end labels (also name a boolean's two states in the gender slot). */
  leftLabel?: string
  rightLabel?: string
  options?: SelectOption[]
  /** Highlight-slot ring color ('' = theme accent). */
  slotColor?: string
}

export type SlotName = 'name' | 'gender' | 'birth' | 'death' | 'highlight'

/** When a trait applied ("captain 1910–1915"). Either side may be open. */
export interface Timeframe {
  from: DateValue | null
  to: DateValue | null
}

/** A trait definition. Project-scoped; `locked` = template trait rendered on
 *  every person's form. Slotted defs are always locked. */
export interface FieldDef {
  id: string
  project_id: string
  label: string
  type: FieldType
  config: FieldConfig
  locked: boolean
  /** Vertical order in the form (one project-wide ordering). */
  order: number
  /** Timeframe inputs enabled for this trait (Advanced mode). */
  has_timeframe: boolean
  /** Which slot this def occupies; null = plain list trait. */
  slot: SlotName | null
  /** Order inside the name slot (multi-trait names → word order). */
  slot_order: number
  /** Optional emoji shown before the label. */
  icon: string
  /** Unit suffix for numeric traits ("cm", "kg"). */
  unit: string
  /** System origin for seeded/migrated defs ('' = user-created). Lets the
   *  legacy persons:create/update payload keep working as an adapter. */
  sys: string
  created_at: string
  updated_at: string
}

/** One person's value for one trait. A row with value null means "attached
 *  but empty" (keeps an unlocked trait on that person's form); no row at all
 *  means the trait isn't set. */
export interface FieldValue {
  id: string
  person_id: string
  field_id: string
  /** Shape depends on the def's FieldType — see coerceValue in fields.ts. */
  value: unknown
  /** Append this value to the node label after the name (per person). */
  display_in_graph: boolean
  timeframe: Timeframe | null
  created_at: string
  updated_at: string
}

export interface Person {
  id: string
  project_id: string
  // ↓ derived snapshots — recomputed from trait values by recomputeSnapshots();
  //   kept so every view (graph/timeline/layout math) reads them unchanged.
  name: string
  birth: DateValue | null
  death: DateValue | null
  /** Gender label ('male'/'female'/custom, 'unknown' when unset). */
  gender: string
  bio: string
  occupation: string
  location: string
  /** name + every display_in_graph value ("Ellen Ripley · Lieutenant"). */
  graph_label?: string
  /** Gender as a 0..1 gradient position (null = unknown). */
  gender_t?: number | null
  /** Highlight-slot ring; color '' = theme accent. null = no ring. */
  highlight?: { color: string } | null
  created_at: string
  updated_at: string
}

export interface Relationship {
  id: string
  project_id: string
  person_a_id: string
  person_b_id: string
  /** A RelationshipTypeDef key in this project ('parent_child', 'spouse', a
   *  custom def's id, …). For directed defs, a→b follows role_a→role_b
   *  (parent→child, mentor→student, likes→liked-by). */
  type: string
  status: string
  formed: DateValue | null
  /** When the relationship ended (divorce, falling-out); null = ongoing. */
  ended?: DateValue | null
  /** Optional per-edge label shown instead of the type's ("estranged uncle"). */
  label?: string | null
  created_at: string
}

// ── Relationship types (user-definable registry — src/shared/relTypes.ts) ────

/** How the hierarchy math treats a type: 'vertical' = parent→child edge,
 *  'horizontal' = couple edge, 'none' = ignored by generation/tree layouts
 *  (still drawn, still pulls in force layouts per its weight). */
export type SymmetryRole = 'vertical' | 'horizontal' | 'none'

/** A relationship type. Project-scoped, like FieldDef. `builtin` defs are
 *  seeded per project and can be tuned (label/weight/color/…) but never
 *  deleted; custom defs are user-created (their `key` is their id). */
export interface RelationshipTypeDef {
  id: string
  project_id: string
  /** Stable slug Relationship.type points at. */
  key: string
  label: string
  /** Structural weight −1..+1: +1 pure structural (strong layout spring),
   *  0 pure affinity (decorative overlay, no force), negative = repulsion. */
  weight: number
  /** Directed a→b (arrowed) vs symmetric. */
  directed: boolean
  symmetryRole: SymmetryRole
  /** End-role names of a directed edge ('Parent'/'Child'); '' when symmetric. */
  role_a: string
  role_b: string
  /** Hex swatch; '' = the Style panel's per-type color (the legacy trio). */
  color: string
  /** Glyph shown in pickers and linked-relationship rows. */
  glyph: string
  /** Picker grouping band: 'family' | 'social' | 'power' | 'custom'. */
  band: string
  builtin: boolean
  /** Selectable status values; the first is the default for new edges. */
  statuses: string[]
  /** Order within pickers (one project-wide ordering). */
  order: number
  created_at: string
  updated_at: string
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

/** One layout type's arrangement within a graph scene: where each node sits
 *  (plus `z` for the experimental 3D type) and that layout's own config
 *  (generation rows, emphasis, 3D camera). */
export interface SceneLayout {
  positions: Record<string, unknown>
  config: Record<string, unknown>
}

/** A saved arrangement of ONE view. Groups scenes replace the old
 *  "scenarios"; graph scenes replace the serialized graphState "states"
 *  (Phase 5). Directory/Relationships have no positions → no scenes.
 *
 *  A **graph** scene is a single container that holds ALL layout types at
 *  once: `layouts` maps each type (free/organic/birth/generations/space) to
 *  its own arrangement, and `type` names the one currently on screen.
 *  Switching type stays in the same scene and reveals that type's saved
 *  arrangement. Groups/timeline scenes have one arrangement, kept in the flat
 *  `positions`/`config` fields (and `layouts` stays undefined). */
export interface Scene {
  id: string
  project_id: string
  /** Which view owns this scene: 'groups' | 'graph' | 'timeline'. */
  view: string
  name: string
  /** Graph: the layout type currently shown (free/organic/birth/generations/
   *  space). null elsewhere. */
  type: string | null
  /** Flat, single-arrangement fields (groups/timeline scenes, and a mirror of
   *  the active layout on graph scenes for legacy readers). */
  config: Record<string, unknown>
  positions: Record<string, unknown>
  /** Graph scenes only: per-layout-type arrangements, so one scene holds
   *  Free, Organic, Birth, Generations (and Space) side by side. */
  layouts?: Record<string, SceneLayout>
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
  /** Named image slot: 'portrait' | 'fullbody' | 'background' | '' (extra).
   *  The portrait doubles as the avatar (kept in sync with is_primary). */
  role?: string
  /** Where the image came from: '' = user-picked photo; 'character' = a
   *  portrait rendered from a CharacterDoc (re-saving replaces it). */
  source?: string
  created_at: string
}

// ── Characters (experimental — the Character view, Advanced + Labs) ──────────
/** One slot's chosen part + adjustments. Parts are referenced BY ID within the
 *  doc's style pack — never by geometry — so the same doc can later render
 *  through a different backend (e.g. 3D) or an updated part library. */
export interface CharacterSlotState {
  /** A part id within the doc's style pack; null = slot intentionally empty. */
  partId: string | null
  /** Uniform scale about the slot's socket (anchor) point. */
  scale: number
  flip?: boolean
}

/** A buildable portrait for a person. A person can own several (e.g. young /
 *  adult / old looks); at most one carries is_portrait and feeds the app's
 *  avatar pipeline (via an images row with source 'character'). Rendering is
 *  backend-agnostic: the doc stores part ids, palette channels, and morph
 *  values only. */
export interface CharacterDoc {
  id: string
  project_id: string
  person_id: string
  /** Schema version for future migration. */
  version: 1
  /** User label ("Young Ellen", "Coronation", …). */
  label: string
  /** Which style pack the parts belong to (e.g. 'cartoon'). */
  style_id: string
  /** Explicitly chosen to feed the person's avatar (≤1 per person). */
  is_portrait: boolean
  /** Optional age range (inclusive years) so the timeline can pick the right
   *  look for a moment; null = ageless. */
  age_from: number | null
  age_to: number | null
  /** slot id → chosen part + adjustments (only slots the user touched). */
  parts: Record<string, CharacterSlotState>
  /** palette channel (skin/hair/eyes/outfitA/outfitB/accent) → hex color. */
  palette: Record<string, string>
  /** Body morphs, each −1..1 (0 = the style's default proportions). */
  morph: { height: number; build: number; headSize: number }
  created_at: string
  updated_at: string
}

export interface DB {
  users: Record<string, User>
  /** token → Session */
  sessions: Record<string, Session>
  projects: Record<string, Project>
  activeProjectId: string | null
  persons: Record<string, Person>
  field_defs: Record<string, FieldDef>
  field_values: Record<string, FieldValue>
  relationships: Record<string, Relationship>
  rel_type_defs: Record<string, RelationshipTypeDef>
  tags: Record<string, Tag>
  entity_tags: Record<string, EntityTag>
  scenes: Record<string, Scene>
  scene_tags: Record<string, SceneTag>
  images: Record<string, ImageRecord>
  characters: Record<string, CharacterDoc>
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

/** Per-request context the shells resolve from the session token before
 *  dispatching to a handler — the moral equivalent of `req.user`. */
export interface AuthCtx {
  user: User | null
  token: string | null
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
