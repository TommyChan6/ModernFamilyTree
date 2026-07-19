# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # run the app with hot reload (electron-vite)
npm run build        # bundle main, preload, renderer into out/
npm run dev:web      # run the app as a plain website (browser, IndexedDB backend)
npm run build:web    # static web build into dist/ (plain Vite, no Electron code)
npm run preview:web  # serve the built dist/ locally
npm run typecheck    # tsc --noEmit over the TS files (CI runs this)
npm test             # run the Vitest suite once
npm run test:watch   # Vitest watch mode
npm run lint         # ESLint (flat config, eslint.config.js)
npm run lint:fix     # ESLint with auto-fix
npm run format       # Prettier write
npm run format:check # Prettier check (CI runs this)
```

Run a single test file or test:

```bash
npx vitest run tests/db.test.js
npx vitest run -t "migrates an old single-tree database"   # by test name
```

Requires Node 18.18+. There are **no native modules** — no SQLite, no rebuild step, no
build tools. (Ignore any older notes mentioning `better-sqlite3` / `npm run rebuild` /
`sql.js`.) ESLint + Prettier are configured; CI (`.github/workflows/ci.yml`) gates on
lint, format check, typecheck, and the Vitest suite. New source files should be
TypeScript per the Step 0 decision in `docs/MID_DEVELOPMENT.md`; `src/shared/` and the
api module already are; existing JS converts opportunistically (store next).

**Project constraints (2026-07-10):** deployment is deferred — current work is
client-side features in the local app, but web parity is mandatory (check changes in
`npm run dev:web` too). **Zero cost**: no paid services and nothing that asks for
card/bank details, even free tiers. Mobile is planned web-first (responsive → PWA;
store apps deferred). See `docs/DEPLOYMENT_PLAN.md` and `docs/MID_DEVELOPMENT.md`.

## Architecture

Electron desktop app **and** browser web app from one codebase: **Vue 3 renderer** +
swappable data backends behind one seam. Desktop persists to a plain JSON file via the
Node main process; the web build runs the same logic in-page against IndexedDB.
Extended docs live in [`docs/`](docs/README.md) — this is the condensed version.

**Process split:**
- `src/shared/` — platform-free TypeScript used by BOTH the main process and the
  browser backend. `dbCore.ts` holds every API channel's business logic
  (`channelHandlers`, pure functions over the DB object), the empty-DB shape, the
  first-run seed, and `WRITE_CHANNELS`; `types.ts` holds the entity types + `Env`
  (injected platform services: uuid, clock, image-file storage). **New data
  operations go here**, not in bespoke `ipcMain.handle`s — then they work on desktop
  and web at once.
- `src/main/` — Node side. `index.js` (BrowserWindow, `appimg://` protocol, unsaved-
  changes close confirmation), `db.js` (the JSON file store + migrations), `ipc.js`
  (a thin Electron shell that registers every `channelHandlers` entry with `ipcMain`
  plus the platform-bound channels `images:openDialog` / `images:bytes`).
- `src/preload/index.js` — the only bridge across the isolation boundary. Exposes
  `window.electronAPI.invoke(channel, data)` and `getImageUrl(path)`. `contextIsolation`
  is on and `nodeIntegration` is off — the renderer has no Node access by design.
- `src/renderer/` — Vue 3 SPA (Composition API, `<script setup>`), identical on
  desktop and web. `src/api/` is the data-access seam: `index.ts` auto-selects
  `backends/ipc.ts` (Electron) or `backends/local.ts` (browser: shared core over
  IndexedDB; photos as data URLs); a future HTTP/Supabase backend slots in beside
  them (`VITE_API_BACKEND`).

**The mandatory data-access chain** — never skip a layer:
```
component → Pinia store action → api.invoke()
   desktop: → electronAPI → ipcRenderer → ipcMain.handle (main)
                → channelHandlers[channel](db, data, env) + save() → { success, data }
   web:     → backends/local.ts → same channelHandlers → IndexedDB persist
```
Components must not call `api.invoke`/`window.electronAPI` directly for
persons/relationships/trees; add a store action instead. (Image lists are the one
pragmatic exception — some components call `images:*` directly.) `window.electronAPI`
may only be referenced inside `api/backends/ipc.ts` (plus feature-detection), so the
web build keeps working.

**Persistence** (`src/main/db.js`): all data is one pretty-printed JSON file at
`<userData>/db/familytree.json`, rewritten in full on every `save()`. Photos are
copied into `<userData>/images/<uuid>.<ext>` and served via the privileged `appimg://`
protocol (never `file://`). `initDB()` is idempotent and self-migrating (tree→project rename,
years→DateValues, scenarios→scenes, factions→tags, graphState→graph scenes) and
seeds a sample family on first run. Data is scoped per project via `project_id`;
deletes cascade explicitly (person → its relationships + image files +
`entity_tags` rows; tag/scene → their join/placement rows). On the web build the same data (including the
same seed) lives in a single IndexedDB record instead, with photos stored inline as
data URLs — see `src/renderer/src/api/backends/local.ts`.

**Channel conventions** (`src/shared/dbCore.ts` + shells): channels are named
`domain:action`. Handlers mutate the raw DB and return plain data or throw; the shell
wraps that in `{ success: true, data }` / `{ success: false, error }` — exceptions
never cross the seam. Callers check `success` before reading `data`. The shell
persists after any channel in `WRITE_CHANNELS` before returning. Writes tag new
records with the active `project_id`; reads filter by it. Handlers may be async
(the auth ones are) — both shells `await` them.

**Accounts & auth** (`src/shared/auth.ts` + the `auth:*` channels in `dbCore.ts`):
the app is username/password gated, built website-shaped so the hosted backend can
adopt it wholesale. Passwords are PBKDF2-SHA256 (Web Crypto, 600k iterations,
per-user salt + stored iteration count); login is throttled (5 fails → 5-minute
lock) and failures stay deliberately vague. `auth:register`/`auth:login` return a
30-day bearer token; the api seam (`api/index.ts` + `api/session.ts`, token in
localStorage) wraps EVERY `invoke` payload in a request envelope with that token —
the local stand-in for a session cookie. Both shells run the same middleware:
`unwrapRequest` → `resolveSession` → an `AuthCtx` (`{ user, token }`) passed as the
handlers' 4th arg; channels outside `PUBLIC_CHANNELS` (auth + globalSettings) are
rejected without a live session. Projects carry `user_id` (the first registered
account claims pre-auth projects; ownership violations read as "not found"), and
per-plan quotas (`PLAN_LIMITS` — people/projects/photos on the free tier) are
enforced in `persons:create`/`projects:create`/`images:add`. UI: `AuthGate.vue`
(sign in / register + `LegalModal.vue` Terms & Privacy), `AccountMenu.vue` (topbar
chip: plan, usage bars, sign out), `UserPage.vue` (full-screen profile page —
profile fields via `auth:updateProfile`, password via `auth:changePassword`,
project cards via `projects:overview`, plus a disabled preview of the planned
sharing feature; see the `ProjectShare` placeholder in `types.ts`); `App.vue`
only loads data behind a restored session. When adding a channel, decide whether
it needs `ctx` and NEVER return password/salt fields to the renderer.

**The trait system** (`src/shared/fields.ts` + the `fields:*` channels): every
person property is a user-defined typed **FieldDef** (text/boolean/number/
number_range/select/slider/date/date_range; `custom_date*` reserved for custom
calendars) with per-person **FieldValue** rows — all optional. Defs are
project-scoped; `locked` = rendered on every form; five **slots**
(name/gender/birth/death/highlight) drive graph rendering — gender resolves to
a 0..1 gradient position (`gender_t`) between the Style panel's male/female
colors. The legacy Person columns (`name`, `birth`, `death`, `gender`,
bio/occupation/location, plus `graph_label` and `highlight`) are **derived
snapshots** recomputed by `recomputeSnapshots()` on every trait write, so views
and layout math read them unchanged — never write them directly.
`persons:create/update` still accept the legacy column payload (adapted onto
the system defs via `sys` keys) and/or a `values` array.
`migrateFieldSystem` gives old projects default locked defs and adopts their
column values; the seed and `projects:create` do the same for new ones. The
Add/Edit Person form (`PersonForm.vue` + `components/personForm/`) is a
two-panel sheet: live node preview, Slot Dock, drag-reorderable trait list,
searchable `PersonPicker` (inline person creation — also used in
RelationshipsView), named image slots (`ImageRecord.role`), typed tags. UI
labels come from `store.noun` (per-project setting; the data layer stays
"person"). **Payloads crossing `api.invoke` must be plain JSON** — Vue
reactive proxies make Electron IPC throw "An object could not be cloned".
Tests: `tests/fields.test.js`.

**The relationship-type registry** (`src/shared/relTypes.ts` + the `relTypes:*`
channels): every `Relationship.type` points at a project-scoped
**RelationshipTypeDef** (like traits point at FieldDefs). Built-in defs
(parent_child/adopted/spouse/sibling/partner/friends/likes/rival/mentor/
subordinate) are seeded per project by `migrateRelationshipTypes` / the seed /
`projects:create`; they can be tuned (label/weight/color/glyph/statuses) but
never deleted; custom defs are user-created (key = their id; deleting one
cascades its relationships). Two def fields drive ALL graph behavior — never
match type literals in layout/render code: **`weight`** (−1..+1 structural↔
affinity spectrum) is each link's spring strength in the 2D and 3D force
simulations (0 = decorative overlay, negative = the `repelLinks` force pushes
the pair apart), and **`symmetryRole`** ('vertical' | 'horizontal' | 'none')
tells the hierarchy math (`familyTreeLayout.ts` — pure, takes an optional
`typeRoles` map) which edges are parent→child vs couple vs invisible to the
tree. `relationships:create/update` validate the type against the registry;
rows also carry optional `label` (per-edge display text) and `ended`. The
legacy trio keeps color '' → the Style panel's per-type colors. UI: PersonForm
intent chips are generated from the registry (grouped by `band`; Simple mode =
family band only, per `caps.relTypePicker`/`customRelTypes`), and
`RelTypesPanel.vue` (Relationships view → ⚙ Types) edits defs — the weight
slider needs `caps.tuneAffinity` (Advanced). Tests: `tests/relTypes.test.js`.
Graph-side insight math (BFS `shortestPath`/`egoDistances`, `derivedSiblings`
from shared vertical-edge parents, `romanceInsights` over directed likes) is
pure in `components/graph/graphInsights.js` (tests:
`tests/graphInsights.test.js`) and drives the graph's connection trace
(shift-click two people → flowing marching-ants chain + hop card), the Focus
pane's Orbit rings, the Relationships pane's Romance section + Social gravity,
redundant-sibling issue flags, and read-only sibling chips (PersonModal /
PersonForm). Siblinghood is derived — explicit `sibling` rows are for
half/step exceptions. `Relationship.ended` is editable (RelationshipsView +
PersonForm), and time travel fades ended bonds to dashed ghosts (`_tEnd`).
The link shader supports per-link dash **flow** (`aFlow` vs `uTime` — the
renderer keeps a live rAF loop only while any link flows) and per-vertex
opacity gradients (`fadeTo`, one-way likes).

**State** (`src/renderer/src/store/index.js`): a single Pinia store `main` is the
source of truth for `persons`, `fieldDefs`/`fieldValues` (+ the
`fieldDefById`/`fieldValuesOf` index Maps), `relationships`, `relTypes` (+ the
`relTypeByKey`/`relTypeRoles` index Maps), `tags`/`entityTags`
(+ the `tagsOf`/`membersOf` index Maps), `scenes`/`sceneTags` (+ per-view
`activeSceneIds`), `projects`, the `programMode` capability flags (`caps`), UI
flags, and `graphSettings`.
Actions do the IPC round-trip and optimistically update reactive arrays only after
`res.success`.

**The graph engine** is the most complex area — see [docs/graph.md](docs/graph.md).
`GraphCanvas.vue` keeps the d3-force simulation and all interaction logic and hands
drawing to a **Three.js/WebGL renderer** (`components/graph/webgl/`) that draws every
node and link in a handful of instanced draw calls, with an on-demand frame loop
(idles at 0% CPU) and tweened style changes. The hot path deliberately steps
**outside Vue reactivity**: a plain `ctx` object holds the simulation and node data;
nodes are mutated in place (`n.x/y/fx/fy`); `ticked()` just pokes the renderer.
Layout math is kept in **pure functions** under `components/graph/` (`layoutAge.js`,
`familyTreeLayout.ts`, `linkHelpers.js`, `graph3d/layout3D.js`) with no D3/Three or
store dependency. Five layout types (free/organic/birth/generations/space); one graph
**Scene** spans them all — `scene.layouts[type]` holds each type's own
`{positions,config}` and `scene.type` names the active one, so switching type
stays in the same scene and reveals that type's arrangement (flat
`positions`/`config` mirror the active type for legacy readers). Each type
animates in with its own signature motion (`useGraphAnimation` stagger opts). The `space` type is **experimental**: the graph in 3D
(`Graph3DView.vue` + `components/graph/graph3d/`, d3-force-3d + OrbitControls),
gated behind Advanced mode plus the topbar **🧪 Labs** toggle (`caps.space3d`);
with the gate off it degrades to Free over the same positions. Holding **Tab** opens a radial
**action wheel** of edit modes (delete, add, link-as-type, tag, paint, pin…) —
catalog in `components/graph/wheelModes.js`, slots configurable per project via
`WheelConfigModal.vue` (persisted as the `wheelSlots` setting). Arrangements
autosave through `scenes:save`; a manual checkpoint (`checkpoint:save`/`revert`,
Ctrl+S / Project ▾ menu) plus `hasUnsavedChanges` drive the close-confirmation
prompt (wired from main via `window.__hasUnsavedChanges` / `window.__saveCheckpoint`
/ `window.__discardChanges`).

**Views:** the workspace shows one of five views (`store.activeView`), all built to
stay smooth with thousands of people:
- graph (`GraphCanvas`) — WebGL, see above; stays mounted (hidden) when another view
  is active so its simulation/layout survive view switches.
- timeline (`TimelineView`) — WebGL. Pure layout in
  `components/timeline/timelineLayout.js` (world units, recomputed on data changes
  only); drawing in `components/timeline/TimelineRenderer.js` — instanced lifelines,
  pulsing dots, marriage/birth ribbons and avatar pins, with a bg canvas for the year
  grid and an fg canvas for viewport-culled labels/badges/gutter. Hit tests are
  analytic; style changes tween.
- groups (`FactionsView`) — WebGL. Drag-and-drop clustering of people by their
  tags (a Group = a tag placed in a groups scene via `scene_tags`; membership is
  the shared `entity_tags` join), with switchable per-view scenes; pure math in
  `components/factions/factionLayout.js`, drawing
  in `components/factions/webgl/FactionsRenderer.js` (zone discs, dash-flow tethers,
  membership arcs, person nodes; overlay canvas for header pills/labels/ghost). The
  d3-force simulation stays in the view and pokes the renderer per tick.
- directory (`PeopleView`) and relationships (`RelationshipsView`) — DOM, but
  **virtualized**: only cards/rows near the viewport exist in the DOM. The right
  dock's Directory roster is virtualized the same way.

Generic instanced draw layers shared by the WebGL views (capsules, dots, ribbons,
arcs) and the overlay-canvas helpers live in `components/webgl/`. Ambient animations
(pulsing dots, orbiting arcs, dash flow, marching ants) run off a `uTime` uniform —
no per-frame buffer writes — and each renderer releases its GL context on unmount.

## Conventions

- ES modules everywhere (`"type": "module"`); Node built-ins in the main process only.
- Vue: Composition API + `<script setup>`, scoped styles. All colors come from CSS
  variable design tokens in `src/renderer/src/styles/global.css` (never hard-code) so
  both dark/light themes work.
- Keep view layout math pure and testable (`components/graph/`, `components/timeline/
  timelineLayout.js`, `components/factions/factionLayout.js`); keep Three.js/canvas
  drawing inside the renderer modules and interaction/state in the view components.
- Preserve the sandbox: expose new capability via explicit preload + IPC, not by
  widening renderer privileges.
- IDs via `crypto.randomUUID()`; timestamps via the store's `nowStr()`.

## Testing

Vitest. `tests/db.test.js` covers the data layer (mocks Electron's `app` module to
point `userData` at a temp dir and exercises `db.js` + the shared channel handlers:
migrations, project scoping, cascade deletes, scene/checkpoint persistence, field
integrity) — update it when
changing `db.js`, `src/shared/dbCore.ts`, or the data shape. `tests/auth.test.js`
covers accounts (hashing, sessions, lockout, per-user scoping, quotas, the request
envelope) — it dials PBKDF2 down via `__setPbkdf2IterationsForTesting`; update it
with `src/shared/auth.ts` or the `auth:*` channels. `tests/relTypes.test.js`
covers the relationship-type registry (seeding, migration, channel validation,
builtin protection, custom-delete cascade) — update it with
`src/shared/relTypes.ts` or the `relTypes:*`/`relationships:*` channels. `tests/setup.js` (wired in
`vitest.config.js`) backfills `globalThis.crypto` for Node 18 workers.
`tests/graphMath.test.js`,
`tests/viewMath.test.js` and `tests/calendarMath.test.js` cover the pure view/date
math (camera transforms, link curves, timeline layout, membership arc spans,
DateValue ordinals). Rendering/interaction has no automated coverage —
verify manually with `npm run dev` (test both themes for visual changes).
