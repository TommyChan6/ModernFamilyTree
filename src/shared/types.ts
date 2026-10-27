import type { BillingStore } from './billing'
import type { Human3DState } from './character3d'

// Data shapes shared by every backend (Electron main, browser-local, and the
// future HTTP/Supabase implementation). These are the client↔server contract.

export interface Project {
  id: string
  name: string
  /** Owning account. null on projects created before accounts existed —
   *  the first registered user claims those. */
  user_id?: string | null
  /** Short blurb shown on the Projects page card. */
  description?: string | null
  /** Sharing intent. Local builds store it only — nothing is actually
   *  published until the hosted backend lands (ProjectShare below). */
  visibility?: 'private' | 'public'
  /** What visitors may do with a public project (Browse page modes). Unset
   *  reads as 'glasshouse'; ignored while the project is private. */
  access?: ShareAccess
  /** Card accent hue (0–359) for the Projects page; null = derived from id. */
  hue?: number | null
  /** Starred on the Projects page (floats to the top of the grid). */
  favorite?: boolean
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

/** Visitor permissions on a shared project — a cumulative ladder:
 *  glasshouse = look only · seedbank = + download the project file ·
 *  graft = + fork a copy into your own projects · grove = + co-edit. */
export type ShareAccess = 'glasshouse' | 'seedbank' | 'graft' | 'grove'
export const SHARE_ACCESS_LEVELS: readonly ShareAccess[] = [
  'glasshouse',
  'seedbank',
  'graft',
  'grove'
]

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
  /** Special effects for everyone whose value matches a rule (auras.ts).
   *  Optional: absent on older data = none. */
  auras?: TraitAura[]
  created_at: string
  updated_at: string
}

// ── Auras (special effects attached to a tag or a trait) ────────────────────
// Everyone carrying the tag / matching the trait rule wears the effect in the
// Graph and the Timeline: an ornament around their node / avatar pin, a line
// effect on their lifeline (and on graph bonds between two bearers), and an
// optional tint. Resolution + sanitizing live in src/shared/auras.ts.

/** Ornament ids drawn around a node (the node shader's aura branch). */
export type AuraOrnament =
  | 'none'
  | 'halo'
  | 'flame'
  | 'frost'
  | 'sparkle'
  | 'crown'
  | 'shadow'
  | 'storm'
  | 'bloom'
  | 'aura'
  | 'runes'
  | 'orbit'
  | 'burst'
  | 'pulse'

export interface Aura {
  ornament: AuraOrnament
  /** '#rrggbb' — the ornament's colour (and the tint). */
  color: string
  /** A graph line-effect id (lineFx.js) or 'none'. */
  line: string
  /** Ring the node / pin and colour the lifeline in `color`. */
  tint: boolean
}

/** When a trait rule applies. 'any' = has a (truthy) value; 'is' = one of
 *  `values` (select option ids; text: contains, case-insensitive); 'range' =
 *  min ≤ value ≤ max (numbers, sliders; dates compare by year). */
export interface AuraWhen {
  op: 'any' | 'is' | 'range'
  values: string[]
  min: number | null
  max: number | null
}

export interface TraitAura extends Aura {
  id: string
  when: AuraWhen
  /** Numeric traits: the ornament's strength follows the value. */
  scale: boolean
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
  /** Per-edge feeling −1 cold … +1 warm; null = inherit the type's sentiment
   *  (src/shared/sentiment.ts). */
  sentiment?: number | null
  /** How strongly it's felt, 0..1; null = the default (DEFAULT_INTENSITY). */
  intensity?: number | null
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
  /** Emotional default of this type's edges, −1 cold … +1 warm (the Dynamics
   *  lens; edges may override it). Built-ins seed from BUILTIN_SENTIMENT. */
  sentiment: number
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
  /** A special effect every member wears (auras.ts). null/absent = none. */
  aura?: Aura | null
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
  /** Body morphs, each −1..1 (0 = the style's default proportions). `age`
   *  runs child (−1) … adult (0) … elder (+1); absent = adult. */
  morph: { height: number; build: number; headSize: number; age?: number }
  /** Resting expression id (characterModel EXPRESSIONS); absent = neutral. */
  expression?: string
  /** Stage backdrop id (also framed into photo-mode cards); absent = studio. */
  backdrop?: string
  /** The 3D look (style_id 'human3d'): sliders, colours, catalogue ids —
   *  sanitized by sanitizeModel3D. Kept when switching to a 2D style so
   *  switching back restores it. */
  model3d?: Human3DState
  created_at: string
  updated_at: string
}

// ── Maps (the Map view — user-drawn worlds with people placed over time) ──────
/** What a map feature is. Areas are closed shapes, lines are open polylines,
 *  places/events are single points (see MAP_KIND_GEOMETRY in mapKinds.ts). */
export type MapFeatureKind =
  // areas
  | 'land'
  | 'water'
  | 'forest'
  | 'mountains'
  | 'hills'
  | 'desert'
  | 'grass'
  | 'swamp'
  | 'snow'
  | 'territory'
  | 'zone'
  // lines
  | 'river'
  | 'road'
  | 'rail'
  | 'wall'
  | 'border'
  | 'searoute'
  | 'arrow'
  // points
  | 'place'
  | 'label'
  | 'event'

/** One drawn thing on a map. Geometry lives in `pts` as a flat [x0,y0,x1,y1…]
 *  array in map world units (0..width × 0..height). */
export interface MapFeature {
  id: string
  kind: MapFeatureKind
  pts: number[]
  name?: string
  /** Hex override; '' / absent = the map style's color for the kind. */
  color?: string
  /** Line width / point size multiplier (1 = the style default). */
  size?: number
  /** Place glyph ('city', 'castle', 'port'…) or event glyph ('battle', 'star'…). */
  icon?: string
  /** Optional time window (inclusive years) — hidden outside it; null = always. */
  from?: number | null
  to?: number | null
  /** Territories can stand for a project tag (a Group / faction / kingdom). */
  tag_id?: string | null
  /** Free-text notes shown in the inspector / hover card. */
  note?: string
  /** Label rotation in radians (labels only). */
  rot?: number
}

/** One point on a person's journey: where they are in a given year. */
export interface MapKey {
  t: number
  x: number
  y: number
  /** Optional note for this stop ("Exiled", "Crowned"…). */
  note?: string
}

/** A person placed on a map. With one key they stand still; with several
 *  they travel between keys as the map's timeline plays. */
export interface MapToken {
  id: string
  person_id: string
  keys: MapKey[]
}

export interface MapDoc {
  id: string
  project_id: string
  name: string
  /** Visual style id (mapStyles.ts: parchment / fantasy / ink / hightech / atlas). */
  style: string
  /** What unpainted ground is: open sea (paint land) or land (paint water). */
  base: 'sea' | 'land'
  width: number
  height: number
  features: MapFeature[]
  tokens: MapToken[]
  /** Last camera, restored when the map reopens. */
  view?: { x: number; y: number; k: number } | null
  /** The year the map's timeline was last left at (null = the project's present). */
  year?: number | null
  created_at: string
  updated_at: string
}

// ── Chronicle: eras + story events on the shared date axis ────────────────────
/** A named stretch of time ("The Regency", "World War II", "Age of Dragons").
 *  Open ends (null) run to the edge of the project's time. */
export interface Era {
  id: string
  project_id: string
  name: string
  start: DateValue | null
  end: DateValue | null
  /** Hex colour of its band. */
  color: string
  /** Emoji shown with its name. */
  icon: string
  description: string
  created_at: string
  updated_at: string
}

/** Something that happened — a battle, a coronation, a migration, a first
 *  meeting — on a date (or over a span), with the people who took part. */
export interface StoryEvent {
  id: string
  project_id: string
  title: string
  /** Catalog id (chronicle.ts EVENT_KINDS) or 'custom'. */
  kind: string
  /** Emoji; '' = the kind's own. */
  icon: string
  /** Hex; '' = the kind's own colour. */
  color: string
  date: DateValue | null
  /** Optional end for events that last (a war, a voyage); null = a moment. */
  end: DateValue | null
  /** 1 minor · 2 notable · 3 major — drives marker size and zoom-out culling. */
  importance: number
  /** Participants (people in the same project). */
  person_ids: string[]
  place: string
  description: string
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
  maps: Record<string, MapDoc>
  eras: Record<string, Era>
  events: Record<string, StoryEvent>
  /** `${projectId}:key` → value for per-project settings */
  settings: Record<string, unknown>
  /** theme, etc. */
  globalSettings: Record<string, unknown>
  /** Subscriptions, checkout sessions and invoices (src/shared/billing.ts).
   *  Sandbox-only today — a hosted backend keeps these in sync from the
   *  payment provider's webhooks. Created lazily. */
  billing?: BillingStore
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
  /** Let billing:* complete simulated checkouts (dev builds only). Off = the
   *  checkout refuses with "payments aren't live yet". See billing.ts. */
  billingSandbox?: boolean
}
