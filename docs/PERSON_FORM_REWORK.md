# Person Form Rework — the Trait System

> Status: **shipped 2026-07-14** (P1–P7 below are implemented; this doc remains
> as the design record). Notable deltas from the plan: the gender gradient
> reuses the Style panel's existing male/female colors (no new setting); the
> highlight ring reuses the WebGL node border (a breathing ring stays a future
> polish); "change type" and "default value" menu items are deferred; name-slot
> reordering uses ‹ › buttons; drag-into-slot works from the trait list via the
> ⠿ handle. Data-layer gotcha discovered en route: renderer payloads must be
> plain JSON before `api.invoke` — Vue reactive proxies fail Electron IPC
> ("An object could not be cloned").

The Add/Edit Person form is rebuilt around a **schema-free trait system**: every
property of a person becomes a user-defined, typed, reorderable, optional **field**.
Special **slots** (Name, Gender, Birth, Death, Highlight) tell the graph which
fields drive rendering. Relationships get the searchable PersonPicker (see chat
plan), images get three named slots, tags expose their existing `type`.

Everything ships on desktop **and** web (`npm run dev:web`) — all data logic goes
through `src/shared/dbCore.ts` per the architecture rules.

---

## 0 · Product decisions baked into this plan

- **"Person" stays the data-layer name** (`persons`, `person_id`, channels) — a
  rename would touch every file and migration for zero user value. Instead the UI
  noun becomes a **per-project setting** (`settings['<pid>:noun']`): `Person`
  (default) / `Character` / free text ("Ship", "House", "Object"). One store
  computed `store.noun` feeds every label ("Add {noun}", "{noun}s" counter…).
- **UI name for fields: "Traits."** Reads better than "custom fields" for a tool
  that models characters, objects and worlds. Code keeps `field` in identifiers.
- **All traits are optional.** A person with zero values is valid; views render
  an italic *Unnamed* placeholder when the name slot is empty.
- **Old person columns become derived snapshots.** `person.name`, `gender`,
  `birth`, `death` remain on the record but are *recomputed by dbCore* from slot
  values on every write. Graph/timeline/layout code keeps working untouched in
  phase 1; only the gradient-gender coloring changes them later. This is the
  single biggest scope-reducer in the plan — do not skip it.

---

## 1 · Data model (`src/shared/types.ts`)

```ts
/** Trait definition. Project-scoped. `locked` = appears on every person's form. */
export interface FieldDef {
  id: string
  project_id: string
  label: string
  type: FieldType
  /** type-specific config, see table below */
  config: FieldConfig
  /** true → template field: rendered on every add/edit form */
  locked: boolean
  /** vertical order in the form (single project-wide ordering) */
  order: number
  /** timeframe inputs enabled (Advanced mode) */
  has_timeframe: boolean
  /** which slot this def sits in, null = plain list field */
  slot: 'name' | 'gender' | 'birth' | 'death' | 'highlight' | null
  /** order inside the name slot (multi-field names) */
  slot_order: number
  /** optional emoji/icon + unit suffix ("cm") */
  icon: string
  unit: string
  created_at: string
  updated_at: string
}

export type FieldType =
  | 'text'          // config: { multiline?: boolean }
  | 'boolean'
  | 'number'        // config: { min?, max?, step? }
  | 'number_range'  // start/end pair, uncertainty ranges
  | 'select'        // config: { options: { id, label, color? }[] }
  | 'slider'        // config: { min, max, step, leftLabel?, rightLabel? }
  | 'date'          // DateValue
  | 'date_range'    // { from: DateValue, to: DateValue }
  // reserved, NOT implemented — accepted by birth/death slots when they land:
  | 'custom_date' | 'custom_date_range'

/** One person's value for one def. Missing row = "not set". */
export interface FieldValue {
  id: string
  person_id: string
  field_id: string
  value: unknown                     // shape depends on FieldType
  /** per-person: append this value to the node label after the name */
  display_in_graph: boolean
  /** when this trait was true of the person (Advanced) */
  timeframe: { from: DateValue | null; to: DateValue | null } | null
  created_at: string
  updated_at: string
}
```

`DB` gains `field_defs: Record<string, FieldDef>` and
`field_values: Record<string, FieldValue>`.

**Gender gradient** is a per-project setting
`settings['<pid>:genderGradient'] = { a: '#hex', b: '#hex' }` (defaults come from
the theme's current male/female tokens). Gender resolves to a scalar **t ∈ [0,1]**:

| field type in gender slot | t |
|---|---|
| select (n options) | option index / (n−1) |
| boolean | false→0, true→1 |
| slider | (value−min)/(max−min) |
| number_range | midpoint normalized by min/max |

Node color = `lerp(a, b, t)`; derived snapshot `person.gender` stores
`{ t, label }` — `linkHelpers.nodeColor` switches from the male/female branch to
the lerp (legacy strings 'male'/'female' map to t=0/1 during migration).

**Derived snapshots** (recomputed in dbCore whenever a person's values / defs /
slots change):

- `person.name` — name-slot values joined by spaces, in `slot_order`.
- `person.graph_label` — name + every value with `display_in_graph`, formatted
  (`Ellen Ripley · Lieutenant`). Renderers read this instead of `name`.
- `person.birth` / `person.death` — DateValue from the slot value (number →
  `{year}`, range → midpoint with the range kept in the raw value).
- `person.gender` — the `{ t, label }` above.
- `person.highlight` — `null` or `{ color }` (see slot rules §3).

**Migration** (in `db.js` `initDB` + mirrored in `local.ts`, idempotent):
for each project missing `field_defs`, create locked defs — *Full name* (text →
name slot), *Gender* (select male/female → gender slot), *Birth*/*Death* (date →
their slots), *Bio* (text multiline), *Occupation*, *Location* (text) — and turn
each person's existing column values into `FieldValue` rows. Old columns stay as
snapshots. First-run **seed** builds the same defs (highlight slot starts empty)
and gives sample persons values through the new system.

---

## 2 · Channels (`src/shared/dbCore.ts`)

All in `WRITE_CHANNELS` except the list. Every write ends by recomputing the
affected persons' snapshots (`recomputeSnapshots(db, personIds)` — a pure helper
in a new `src/shared/fields.ts` alongside gradient math, label composition,
slot-acceptance rules and value validation; unit-test all of it).

- `fields:list` → `{ defs, values }` for the active project
- `fields:createDef` / `fields:updateDef` (label, config, locked, icon, unit,
  has_timeframe) / `fields:deleteDef` (cascades its values) /
  `fields:reorderDefs` (`{ orderedIds }`)
- `fields:setSlot` (`{ fieldId, slot, slotOrder }`) — validates slot acceptance
  (§3), **auto-locks** the def when slotted, recomputes all persons
- `fields:setValue` (`{ personId, fieldId, value, timeframe?, display_in_graph? }`,
  null value deletes the row) and `fields:setValues` (batch, used on form save)
- `fields:applyDisplayAll` (`{ fieldId, on }`) — bulk `display_in_graph` across
  all persons; **rejects unlocked defs**
- `persons:create` stays as-is (quota check intact) but accepts an optional
  `values` array so a new person + traits is one call.

Update `tests/db.test.js` (migration, cascade: deleting a person removes its
`field_values`; deleting a def removes values + vacates its slot) and add
`tests/fields.test.js` for `fields.ts` pure math.

---

## 3 · The Slot Dock (top of the form)

Five docking bays in a horizontal strip above the trait list. Fields are dragged
**into** slots from the list (or ejected back). Slotting a field locks it.

| Slot | Accepts | Multiplicity | Behaviour |
|---|---|---|---|
| **Name** | `text` only — anything else bounces out with a shake + toast “Only text traits can appear in the graph name” | many, ordered; bay widens as chips are added | chip order = word order in the node label; live mini-node preview underneath renders the composed name in real time |
| **Gender** | `select`, `slider`, `boolean`, `number_range` | one | a two-stop **gradient bar** header with two color pickers (project setting); the field's control below renders *on* the gradient — slider thumb tinted by the sampled color, select options shown as evenly-spaced tinted stops |
| **Birth** | `date`, `number`, `date_range`, `number_range` (+ `custom_date`, `custom_date_range` when custom calendars land — acceptance list already includes them) | one | ranges mean *uncertainty*: snapshot uses the midpoint, raw range preserved |
| **Death** | same as Birth | one | — |
| **Highlight** | any type | one | non-null value → glowing ring around the node. Ring color: select-option color if the field is a select, else a color picked on the slot itself. Live pulsing ring on the preview node. Starts **empty** |

New-project defaults: Full name → Name, Gender select (male/female) → Gender,
date fields → Birth/Death, all locked.

---

## 4 · The trait list

Each row: `⠿ drag handle │ icon+label │ typed input │ ⋯ options`.

- **Reorder**: press-and-hold the `⠿` handle → row lifts (scale 1.02, shadow,
  1° tilt), siblings FLIP-animate around it with a spring; drop settles with a
  soft bounce. Implemented as a `useDragList` composable (pointer events +
  manual FLIP — no new dependency), reused later by the Name-slot chips and
  image extras.
- **Add trait**: a `＋ Add trait` bar at the bottom blooms into a **type
  palette** — one chip per type, each showing a live micro-preview of its input
  (a wiggling slider, a flipping toggle…). Pick type → inline label input →
  row springs into the list.
- **Options menu** (`⋯`, blooms open as a popover, staggered item entrance):
  - **Delete** (unlocked) / with confirm listing how many persons have values (locked)
  - **Lock** — toggle template status; locking animates a padlock snap
  - **Set timeframe** (Advanced mode only) — row expands with sliding from/to inputs
  - **Show in graph** (per-person `display_in_graph`) + an **“apply to all”**
    button beside it (enabled only when locked → `fields:applyDisplayAll`)
  - *Added suggestions:* **Rename**, **Duplicate**, **Default value** (locked
    defs pre-fill on new persons), **Icon** (emoji picker), **Unit** (numbers:
    "cm", "kg" suffix), **Change type** (safe conversions only — text↔select,
    number↔slider; warn when values can't convert)

Unlocked defs appear only on persons that have a value for them (creating one
attaches it to the current person). Locked defs appear on every form.

---

## 5 · Relationships, Images, Tags sections

- **Relationships**: as agreed in chat — intent buttons (`+ Father · + Mother ·
  + Spouse · + Child`) each opening the new **`PersonPicker.vue`** searchable
  combobox (type-to-filter, avatar + birth year rows, arrow keys, and an inline
  **“＋ Create '<typed>' as new person”** row that creates + links in one step).
  Pending links keep the current preview-card + save-on-submit flow.
- **Images**: three named slots — **Portrait**, **Full body**, **Background** —
  rendered as shaped drop targets (circle bust / tall rect / wide rect) with a
  shimmer sweep while empty and a cross-fade+scale settle when filled, plus an
  “Extras” strip. Data: `ImageRecord.role: 'portrait' | 'fullbody' |
  'background' | ''` (migration: `is_primary` → `role='portrait'`; the avatar
  pipeline reads portrait-or-primary so nothing breaks).
- **Tags**: chips with a small **type badge** (`Dex family ⌁family`). Add-tag
  combobox searches existing tags, and the create path exposes the existing
  `Tag.type` field (free text with suggestions from types already in use) —
  data model needs **no change**; groups-view generation by type comes later.

---

## 6 · Design & motion language

Consistent with the app (design tokens from `global.css`, both themes, scoped
styles, Composition API). Motion rules:

- **Transforms + opacity only** (no layout-property animation); FLIP for
  reorder; `transition` springs via CSS `cubic-bezier` or small rAF tweens.
- Everything answers the pointer in <100ms; animations are 150–300ms, cut to
  near-zero under `prefers-reduced-motion`.
- Signature moments: slot bays glow + magnet-pull when a compatible field is
  dragged near (incompatible bays dim); the mini node preview is a *live*
  render — typing in a name-slot field updates the node text letter-by-letter;
  the gender gradient bar sweeps its color across the preview node when moved;
  the highlight ring breathes.
- The form itself opens as a **two-panel sheet**: left = live preview column
  (node preview, portrait, tag chips), right = scrolling sections with a sticky
  section rail; sections cross-fade/slide on scroll-spy.

---

## 7 · Phases (each ends green: `npm run typecheck && npm test && lint`, then verify desktop **and** `npm run dev:web`, both themes)

**P1 — Data layer.** `types.ts` + `fields.ts` (pure helpers + tests) + dbCore
channels + migration + seed + snapshot recompute + store state/actions
(`fieldDefs`, `fieldValues`, indexes `valuesOf(personId)`). Old form still
works via snapshots. *Touches:* `src/shared/*`, `db.js`, `local.ts`,
`store/index.js`, tests.

**P2 — Form shell + typed inputs.** Rewrite `PersonForm.vue` into the two-panel
sheet with section rail; new `components/personForm/` — `FieldList.vue`,
`FieldRow.vue`, `inputs/` (one component per FieldType), `AddFieldBar.vue`.
Saving writes `fields:setValues`. No slots/drag yet (slots render read-only
from P1 data).

**P3 — Drag + options.** `useDragList` composable (FLIP), row reorder →
`fields:reorderDefs`; `FieldMenu.vue` with the full §4 option set incl.
timeframe (Advanced-gated) and apply-to-all.

**P4 — Slot Dock.** `SlotDock.vue`, drag fields ↔ slots with acceptance rules,
`NamePreview.vue` live mini-node, `GenderGradientBar.vue` + project gradient
setting, highlight ring config. Graph switch: renderers read `graph_label`;
`nodeColor` lerps the gradient; highlight ring drawn from `person.highlight`
(reuse the existing ring/arc layers in `components/webgl/`).

**P5 — Relationships.** `PersonPicker.vue` + intent buttons in the form; also
swap the two dropdowns in `RelationshipsView.vue` for the picker.

**P6 — Images + Tags.** Image roles (+migration), slot UI; tag type badges +
typed create in the form's tag section.

**P7 — Polish.** Motion pass per §6, `store.noun` project setting + UI labels,
empty-person path (*Unnamed* placeholders in directory/graph/timeline), perf
check with a 1k-person project, docs update (`data-model.md`, `design.md`).

---

## 8 · Future hooks (keep in mind, don't build)

- **In-graph editing** reuses the same primitives: PersonPicker popover on the
  canvas, quick-add handles; slots/snapshots make node rendering data-driven
  already.
- **Custom calendars**: birth/death slots already accept the reserved
  `custom_date*` types; `DateValue.calendar` is the extension point.
- **Derived/smart tags** and groups-view generation from `Tag.type`.
- Hosted backend: field tables are plain rows — same shape works in Supabase.
