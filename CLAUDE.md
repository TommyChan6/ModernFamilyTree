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
`entity_tags` rows; tag/scene → their join/placement rows; project → its maps). On the web build the same data (including the
same seed) lives in a single IndexedDB record instead, with photos stored inline as
data URLs — see `src/renderer/src/api/backends/local.ts`.

**Channel conventions** (`src/shared/dbCore.ts` + shells): channels are named
`domain:action`. Handlers mutate the raw DB and return plain data or throw; the shell
wraps that in `{ success: true, data }` / `{ success: false, error }` — exceptions
never cross the seam. Callers check `success` before reading `data`. The shell
persists after any channel in `WRITE_CHANNELS` before returning. Writes tag new
records with the active `project_id`; reads filter by it. Handlers may be async
(the auth ones are) — both shells `await` them.

**Undo/redo** (`src/shared/history.ts` + the `history:*` channels): dbCore wraps
every channel in `UNDOABLE_CHANNELS` (data edits: persons/fields/relationships/
relTypes/tags/entity_tags/scene_tags add-remove/images/characters — NOT scenes or
settings, which the checkpoint owns) with a before-snapshot of the active
project's rows; `history:undo`/`redo` swap the live rows against the top snapshot
(per-project stacks, in-memory only, cap 50). A throwing handler rolls back to
its snapshot, so writes are atomic. Image-file deletion is deferred + GC'd so
undoing a delete keeps photos. The store's `undo()`/`redo()` reload the data
slices and `historyStatus` drives the topbar buttons (Ctrl+Z / Ctrl+X; the api
seam's `onUndoableMutation` keeps status fresh). Tests: `tests/history.test.js`.
On top sits ONE client-side **undo timeline** per project in the store (the
journal): data steps (mirroring the server stack 1:1) interleaved with
**arrangement steps** — graph node drags, bezier curve reshapes/resets, node
size/colour styles, layout refreshes, Directory drops, Spotlight recasts (mementos
from GraphCanvas `captureLayoutState`, restored by `restoreLayoutState`, which
the store calls through `registerLayoutHistory`), and Groups ring moves
(`recordGroupMoves`, restored in the store). Ctrl+Z reverts the newest step of
either kind; `historyStatus` is computed from the journal (`undoChannel`
'layout:<label>' for arrangement steps, so `undoToast` never reverts the wrong
edit). A checkpoint revert drops the arrangement steps.

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

**Monetization** (`src/shared/billing.ts` + the `billing:*` channels,
`components/billing/`, `lib/ads.ts`; full status + backend to-do in
[`docs/MONETIZATION.md`](docs/MONETIZATION.md)): plans Free/Plus/Pro
(`PLAN_CATALOG` prices + `PLAN_LIMITS`; paid `PLAN_FEATURES` are `'*'` — paying
never removes a feature). Ads/badges are plan **perks** (`planHasPerk`), not caps
flags. NO real payments exist: checkout runs a **sandbox** provider, enabled only
when the shell sets `env.billingSandbox` (dev builds); otherwise checkout refuses.
The server owns the plan — the renderer adopts `billing:status`
(`store.applyBillingStatus`), never sets it itself. UI: `PricingModal.vue`
(`store.openPricing(ctx)`), `BillingPanel.vue` on the profile page, `PlanBadge.vue`,
topbar ✦ Go Plus, and `AdSlot.vue` house ads on discovery surfaces only (Browse,
Projects page — never editor views, never paid plans). Quota refusals anywhere
surface an upgrade toast via `onPlanLimit()` in `api/index.ts`. Tests:
`tests/billing.test.js`.

**Browse page** (`BrowsePage.vue` + `components/browse/`, topbar 🧭 Browse,
`store.browsePageOpen`): community trees in four cumulative **access modes**
(`ShareAccess` in `types.ts`: glasshouse = view · seedbank = + download ·
graft = + fork · grove = + co-edit; owners set theirs as `Project.access` in
the Projects page edit dialog, validated by `projects:update`). The community
is MOCK until the hosted backend (`browseData.ts`: profiles + projects with real
people/edges in a tiny edge DSL); pure search/filter/recommend/layout/fun-facts
and the graft file builder live in `browseModel.ts` (tests:
`tests/browseModel.test.js`). Grafting = `toProjectFile()` → the ordinary
`projects:import`. Viewer likes/saves/follows are per-account localStorage
(`browseSignals.ts`). Full-screen pages gate hotkeys on
`userPageOpen || projectsPageOpen || browsePageOpen`.

**The trait system** (`src/shared/fields.ts` + the `fields:*` channels): every
person property is a user-defined typed **FieldDef** (text/boolean/number/
number_range/select/slider/date/date_range; `custom_date*` reserved for custom
calendars) with per-person **FieldValue** rows — all optional. Defs are
project-scoped; `locked` = rendered on every form; five **slots**
(name/gender/birth/death/highlight) drive graph rendering — gender resolves to
a 0..1 gradient position (`gender_t`) between the Style Studio palette's male/female
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
legacy trio keeps color '' → the Style Studio palette's per-type colors. UI: PersonForm
intent chips are generated from the registry (grouped by `band`; Simple mode =
family band only, per `caps.relTypePicker`/`customRelTypes`), and
`RelTypesPanel.vue` (Relationships view → ⚙ Types) edits defs — the weight
slider needs `caps.tuneAffinity` (Advanced). Tests: `tests/relTypes.test.js`.
**Chronicle** (`src/shared/chronicle.ts` + the `eras:*` / `events:*` channels;
UI in `components/chronicle/`, 📜 toggle on the Timeline and Graph): project-scoped
**eras** (named spans, open ends allowed, colour + icon) and **story events** (a
date or span, kind from `EVENT_KINDS`, importance 1–3, a cast of `person_ids`,
place, description). Sanitized on every write (`applyEraPatch` /
`applyEventPatch`), undoable (history.ts snapshots both), carried by project
copy/export/import, cascaded on project delete; deleting a person drops them from
casts. `eras:saveMany` adds a preset pack (`presetEras`: world history,
generations, centuries, fantasy ages) as one undo step. One dialog
(`ChronicleEditor.vue`, `store.openEraEditor` / `openEventEditor`) edits both.
Drawn on the Timeline by `timeline/chronicleDraw.js` (era bands + gutter rail +
sticky headers, event pills on a rail with hairlines and cast rings; classic and
ink renderers), on the Birth layout by `TextGuideOverlay._drawChronicle`, in the
profile's Chronicle section ("Lived through", events, era dawns) and as the
current-era chip + track stripes on the Time slider. Dated events stretch the
Timeline axis (`computeTimelineLayout` `extraYears`). Not yet in `supabase.ts`
(the store treats a failed load as an empty chronicle). Tests:
`tests/chronicle.test.js`.
**Kinship** (`components/kinship/`, graph header 🧬): a pure engine in
`kinshipGraph.ts` (KinIndex from persons + relationships via `symmetryRole`;
`bloodFrom` = closest common ancestor → (up, down) on the cousin chart with
half/adoptive flags; `kinshipLens` = everyone's relation to one person incl.
spouse/in-law/affine/step/co-parent/social; kinship coefficient φ → shared-DNA r,
inbreeding F, the Bloodline meter bands; ancestor fan + pedigree collapse;
linchpins (articulation points), founders, tangled couples, `walkChain`) and
`kinshipNames.ts` naming in **English / Norsk / 简体 / 繁體** (Chinese reads the
link chain: 堂/表, 伯/叔 by age, 的-chain fallback). The naming language is its
own per-viewer choice (`kinshipLang.ts`, localStorage). `useKinship()` shares
one index + a per-anchor lens cache. UI: `KinshipPane` (Lens — node rings +
overlay pills drawn by `TextGuideOverlay._drawKin`, ripple reveal; Walk; Insights),
`KinshipCard` (trace card headline + `KinArch` + DNA + `BloodMeter`),
`KinshipSection` in the profile (named relatives + `FanChart`), `KinshipQuiz`.
Only `parent_child` counts toward DNA; `adopted` is legal kin. Tests:
`tests/kinship.test.js`.
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

**The Style Studio** (`components/style/`, left-rail Style button /
`store.settingsOpen` + `store.styleLayer`; the Timeline toolbar's style toggle opens
it too) is the one place for looks, split into two LAYERS drawn as a shuffleable
deck: **Whole app** (`AppStyleSheet.vue`: theme + accent, the shared palette —
gender + bond colours every view reads from `graphSettings` — and the profile
style) and **this view** on top (`GraphStyleSheet` / `TimelineStyleSheet` /
`DirectoryStyleSheet` / `MapStyleSheet`; views with nothing of their own show an
"inherits the app" state). Each layer is split into chapters (one at a time); the
scope ribbon says where a chapter is saved, tuned dots + per-chapter reset come
from chapter `keys`. All chapters, their keys and the searchable control index
live in the pure `styleCatalog.ts` (tests: `tests/styleCatalog.test.js`) — a new
style control needs an entry there and a matching `data-skey` on its row so
search can jump to it. Rows use `StSlider`/`StSwitch`/`StColor`/`StSeg` and the
unscoped `studio.css` (`st-` classes). A map's style lives on the MapDoc, so the
studio edits it through `styleBridge.js` (MapView lends its undo + autosave).
Gotcha: a sheet's template must have ONE element root (no top-level comment) or
the out-in chapter transition never finishes.

**The graph engine** is the most complex area — see [docs/graph.md](docs/graph.md).
`GraphCanvas.vue` keeps the d3-force simulation and all interaction logic and hands
drawing to a **Three.js/WebGL renderer** (`components/graph/webgl/`) that draws every
node and link in a handful of instanced draw calls, with an on-demand frame loop
(idles at 0% CPU) and tweened style changes. The hot path deliberately steps
**outside Vue reactivity**: a plain `ctx` object holds the simulation and node data;
nodes are mutated in place (`n.x/y/fx/fy`); `ticked()` just pokes the renderer.
Layout math is kept in **pure functions** under `components/graph/` (`layoutAge.js`,
`familyTreeLayout.ts`, `linkHelpers.js`, `graph3d/layout3D.js`) with no D3/Three or
store dependency. Six layout types (free/organic/birth/generations/spotlight/space);
**Spotlight** (`spotlightLayout.ts`, tests `tests/spotlightLayout.test.js`) puts a
main character (per scene: `layouts.spotlight.config.mainId`) at centre stage with
everyone else on kinship-closeness rings, kin titles from the kinship engine and
ring guides drawn by `TextGuideOverlay._drawSpotlight`. **Line effects** (Style →
Line Effects; `graph/webgl/lineFx.js`: Bloodstream, River, Neon, Helix, Ember,
Aurora, Storm, Starlight, Gilded) are shader branches in the link material keyed by a
per-link `aFx` attribute (effect id, core fraction, padded half-width); `linkVisual`
picks them per `lineFxScope` (lineage / family / all) and they pause under the 水墨
brush look. **Perspective tilt**
(Style → Perspective, bottom-bar rotate-3d / **T**, **Q/E** to turn, Alt-drag for angle/turn;
`viewTilt`/`tiltAngle`/`tiltYaw` settings) lays any 2D layout down as a board: the tilt
and turn ride on the camera transform (`tl`/`yw`/`vw`/`vh`) as a yaw + plane homography
in `graph/webgl/coords.js` (pan/zoom under it solved exactly by `translateToPin`; standing
nodes painted back-to-front via `depthOrder`, covered names dimmed by `occlusion.js`), so every
`worldToScreen`/`screenToWorld` (overlay, picking, drag) follows it and
`tiltProjection()` puts the same mapping in the GPU projection; nodes are screen-space
billboards (NodeMaterial adds the corner offset in clip space), the atmosphere draws in a
separate flat pass, and `GroundGrid.js` fades in a floor (tests: `tests/graphTilt.test.js`).
Node shapes/anchors live in `graph/webgl/nodeShapes.js`; the `gravestone` shape stands ON
its point (so in Birth it rests on its birth-year line) — the `graveyard` theme preset uses it. One graph
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

**Views:** the workspace shows one of six views (`store.activeView`), all built to
stay smooth with thousands of people:
- graph (`GraphCanvas`) — WebGL, see above; stays mounted (hidden) when another view
  is active so its simulation/layout survive view switches.
- timeline (`TimelineView`) — WebGL. Pure layout in
  `components/timeline/timelineLayout.js` (world units, recomputed on data changes
  only); drawing in `components/timeline/TimelineRenderer.js` — instanced lifelines,
  pulsing dots, marriage/birth ribbons and avatar pins, with a bg canvas for the year
  grid and an fg canvas for viewport-culled labels/badges/gutter. Hit tests are
  analytic; style changes tween. Lifelines are a `LifelineLayer` (looks: classic/
  tube/glass/glow + every graph line effect, a drop-shadow pass, selection halo),
  styled by `store.timelineSettings` (`timeline_*` settings keys; edited in the
  Style Studio's Timeline layer, `style/TimelineStyleSheet.vue`: looks, canvas
  options, atmosphere via the graph's `AmbientLayer`, one-click looks). Editing mirrors the graph: click = select (the
  shared `GraphActionPane`, graph-only verbs hidden), dblclick = profile, ctrl-click
  = trace (`kinship/TraceCard.vue`), 🧬 = KinshipPane + lens pills (`kinPills.js`).
  Edit tools (Edit rail / keys 1–6: add, child, link, event span, retime, delete) —
  pure helpers + catalog in `timeline/timelineEdit.js` (tests:
  `tests/timelineEdit.test.js`); ghosts, bursts and the traced chain draw on the
  canvas-2D `TimelineFx.js` layer. Retime writes through the birth/death **slot**
  traits (`retimeSlotValue`), never the snapshot columns. Dragging a life (or the
  selection) sideways moves its lane (`moveLanes`; renderer `setLaneOverride` pins
  carried lanes to the cursor); Shift+←/→ nudges. The lane order is per timeline
  scene (`scene.config.laneOrder`, also written by refresh + canvas-created
  people) and each move is a journal arrangement step (`{ view: 'timeline' }`
  mementos — the store keys restore handlers by view via `registerLayoutHistory(fn,
  view)`). The header's **Time drag** toggle (`store.timeDrag`, shared with the
  graph) turns a mostly-vertical drag on a life/selection into a retime: birth +
  death shift together via `shiftLivesUpdates` → ONE `fields:setValuesBatch`
  (one undo step). On the graph it applies in the Birth layout (turning it on
  switches there): vertical-only, year-snapped, and `realignAgeAxis()` re-seats
  Birth nodes whenever a birth year changes (so undo moves them back). The graph's
  **Retime** edit mode (wheel kind `retime`, auto-added to the Edit rail in Birth)
  is the same drag with `{ birthOnly: true }`: only the birth moves, clamped at the
  death.
- groups (`FactionsView`) — WebGL. Drag-and-drop clustering of people by their
  tags (a Group = a tag placed in a groups scene via `scene_tags`; membership is
  the shared `entity_tags` join), with switchable per-view scenes; pure math in
  `components/factions/factionLayout.js`, drawing
  in `components/factions/webgl/FactionsRenderer.js` (zone discs, dash-flow tethers,
  membership arcs, person nodes; overlay canvas for header pills/labels/ghost). The
  d3-force simulation stays in the view and pokes the renderer per tick.
- directory (`PeopleView`) and relationships (`RelationshipsView`) — DOM, but
  **virtualized**: only cards/rows near the viewport exist in the DOM. The right
  dock's Directory roster is virtualized the same way. The Directory's viewing
  modes (`store.viewMode`, `ViewModeSwitch.vue`) are the card modes (grid +
  `CardStage` wheel/flow/fan/deck), the Hive/Reel mediums, and six **showcase**
  mediums behind the ✦ gallery — Roster, Codex, Evidence Board, Elements, Ranks,
  Bubbles (`people/<Name>View.vue`, each with pure math in `people/<name>Layout.js`
  / `ranksMetrics.js` + a test). Every medium takes the same props (`persons`
  filtered+sorted by the toolbar, `statsOf`, `refYear`) and windows/culls itself.
  The **Sheet** mode (`people/SheetView.vue` + `SheetPicker.vue`, pure model in
  `people/sheetModel.ts`, tests: `tests/sheetModel.test.js`) is an editable
  spreadsheet: every FieldDef is a column (name-slot traits frozen left) plus
  derived Age/Ties/Groups; row-virtualized, typed in-cell editors, TSV copy/paste
  (rows past the end become new people), fill down, column sort/resize/hide/add
  (layout persisted as the `sheetPrefs` setting). All its writes go through ONE
  serial queue with token-keyed optimistic cells, and multi-cell ops use the
  atomic batch channels (`fields:setValuesBatch`, `persons:createMany`/
  `deleteMany`) so each is one undo step. Row order is frozen during edits
  ("Re-sort" pill when it drifts). Its hidden key-sink textarea carries
  `data-grid-keys` so App.vue's undo/redo hotkeys stay live there.

- map (`MapView.vue` + `components/map/`) — Canvas-2D map maker. A project owns
  several `MapDoc`s (`db.maps`, `maps:*` channels, sanitized by `src/shared/maps.ts`):
  flat-array `features` (terrain areas, realms — optionally linked to a tag —
  roads/rivers/rails/walls/borders/sea routes, places, labels, and animated events:
  arrows/zones/incidents, each with an optional `from`/`to` year window) and
  `tokens` (a person + journey `keys` [{t,x,y}]; dragging a token at year Y
  records a stop). The view edits a non-reactive working copy (`draft` +
  a `version` counter — template reads go through the `meta` computed), autosaves
  via `store.saveMap`, and owns its own undo stack (Ctrl+Z/X while the view is up;
  maps aren't in `history.ts`). Pure math in `map/mapMath.ts` (camera, geometry,
  hit-testing, time interpolation), the seeded world generator in `map/mapGen.ts`,
  styles as data in `map/mapStyles.ts` (parchment/fantasy/ink/hightech/atlas),
  drawing in `map/MapRenderer.ts` (cached static layer + live layer for people,
  events and ambient motion) and `map/mapGlyphs.ts`. Editing aids: the selected
  line/area shows vertex + midpoint handles (drag a midpoint = insert, Alt-click /
  dblclick a vertex = remove; `insertVertex`/`removeVertex`/`hitMidpoint`), drawing
  and vertex drags magnet-snap to places and corners (`snapPoint`; Alt or the Layers
  switch turns it off), a ruler tool (U), right-click `MapContextMenu.vue`, feature
  copy/paste across maps (clipboard in a plain `<script>` block), `MapFind.vue`
  (Ctrl+F, `matchScore`), per-viewer layer visibility (`MAP_LAYERS` in
  `mapKinds.ts`, localStorage `familytree.map.layers`; renderer `hiddenKinds`),
  `MapShortcuts.vue` (?), PNG export of the whole sheet or the current view. Each
  style names its distance `unit` (`MAP_UNITS`; labels via `map.units.*`). The frame
  loop skips draws whose signature hasn't changed (idle = 0 draws, ambient-only
  ~30 fps) and the renderer freezes all time-driven motion under reduced motion.
  Tests: `tests/mapMath.test.js` + the Maps block in `tests/db.test.js`.
- character (`character/CharacterView.vue`, Advanced + 🧪 Labs) — Canvas-2D character
  creator. Looks are renderer-agnostic `CharacterDoc`s (part ids + palette + morphs);
  art styles are data-only `StylePack`s in `character/styles/` (anime/realistic/simple/
  cartoon) that must honor the shared slot/part-id contract in `styleTypes.ts` (enforced by
  `tests/characterStyles.test.js`). Pure logic: `characterModel.ts` (layer resolution,
  expressions, age morph) and `characterGenes.ts` (inheritance, DNA codes); drawing in
  `character/render/`. See `docs/CHARACTER_VIEW_PROPOSAL.md`.
  **🧊 3D style** (`style_id` `'human3d'`, `character/human3d/`): a game-style 3D creator.
  The look lives in `CharacterDoc.model3d` (`src/shared/character3d.ts`:
  `Human3DState`, sanitized by `sanitizeModel3D` in `characters:save`). The human is
  MakeHuman's CC0 hm08 mesh + morph targets + skeleton compiled into
  `human3d/assets/human3d.bin` by `scripts/human3d/build.py` (+ `masks.py` region masks;
  lazy-loaded, gzip). Engine: `HumanBody` (CPU morphs → Catmull–Clark stencil
  `subdivision.ts` → skinning; blink = relative GPU morphs), `skinMaterial`/`humanEyes`/
  `fabricMaterial` (onBeforeCompile-extended physical materials), `hairSystem` +
  `hairGroom`/`hairStyles` (strands grown per style against head/torso radial hulls,
  drawn as INSTANCED ribbons from a float point texture — never expand ribbons on the
  CPU, it exhausts GPU memory), `wardrobe` (garments = offset/relaxed body shells with
  alpha-clipped hems; skirt helper for dresses), `poses` (`twist` = extrinsic, `roll` =
  intrinsic; left-arm z− lowers), `HumanStage` (lights, GTAO — strands live on layer 1
  so the AO normal pass skips them — camera focus, sculpt picking, snapshots).
  UI: `Character3DEditor.vue` + `H3Slider.vue`; slider catalogue `catalog.ts`, pure look
  logic (presets, 2D↔3D, randomize, genetics) `model3d.ts`; strings under `human3d.*`.
  Tests: `tests/human3dMath.test.js`.

Generic instanced draw layers shared by the WebGL views (capsules, dots, ribbons,
arcs) and the overlay-canvas helpers live in `components/webgl/`. Ambient animations
(pulsing dots, orbiting arcs, dash flow, marching ants) run off a `uTime` uniform —
no per-frame buffer writes — and each renderer releases its GL context on unmount.

**The 水墨 Ink theme** — a third app theme (`store.theme === 'ink'`; `store.isInk`,
`store.isLightTheme` = light OR ink — pass that to renderers' `setTheme(isLight)`,
never `theme === 'light'`; `store.toggleInk()` = the topbar 墨 seal). Rice paper,
calligraphy, cinnabar accent (locked — `!important` over the user accent). Tokens,
@font-faces and shared ink chrome classes (`.ink-mount`, `.ink-unroll`, `.ink-rollers`,
`.ink-veil`, `.ink-underline`, `.ink-seal`, `.ink-enso`…) live in `styles/ink.css`;
fonts are bundled SIL-OFL woff2s in `assets/ink/fonts/` (Ink Kai/Xing/Cao/Serif, split
latin/cjk by unicode-range so CJK only downloads when shown). `lib/inkArt.ts` holds the
deterministic Canvas-2D primitives every view paints with (paper, `brushStroke` with
飞白, `inkWash`, `mountainRange`, `sealCanvas`, `inkFontsReady()`); `installInkAssets()`
publishes its textures as `--ink-*` url() custom properties. Theme switches into/out of
ink reveal as an ink blot (`themeReveal.js`). Per view: graph (`graph/inkStyle.js`,
brush link route + `enso` decor + `mist`/`plum` ambient, Shuimo/Qinglü/Ink Plum presets,
`graph/InkBackdrop.js`), timeline/groups (`components/webgl/Ink*Layer.js` + pure
`inkMath.ts`, `timeline/TimelineInk.js`, `factions/webgl/FactionsInk.js`), map
(`shanshui`/`qinglu` styles: public-domain painting sprites in `assets/ink/map/` with
`CREDITS.md`, built by `scripts/inkMapSprites/process.py`; `map/inkPaint.ts` +
`map/inkSprites.ts`), directory (card styles `scroll`/`moonfan`, the `handscroll`
medium — `people/handscrollLayout.ts`), profile (`store.profileStyle`:
`cinematic`|`scroll` → `profile/ProfileScroll.vue`). Gotcha: a scoped selector that
ENDS in `:is(...)` gets Vue's scope attribute on `:root` and silently never matches —
expand it. Tests: `tests/inkArt.test.js`, `inkChrome`, `profileScroll`,
`handscrollLayout`, plus ink blocks in `graphMath`/`viewMath`/`mapMath`.

## Conventions

- ES modules everywhere (`"type": "module"`); Node built-ins in the main process only.
- Vue: Composition API + `<script setup>`, scoped styles. All colors come from CSS
  variable design tokens in `src/renderer/src/styles/global.css` (never hard-code) so
  both dark/light themes and the user's **accent colour** work. The accent is
  user-selectable (Settings → General; `store.setAccent`, pure math in
  `lib/accent.js`): use `var(--accent)` / `rgba(var(--accent-rgb), a)` — never the
  literal default blue — and `var(--danger)` / `rgba(var(--danger-rgb), a)` for red.
  Radius/motion/elevation scales live there too (`--r-*`, `--ease-*`, `--dur*`,
  `--shadow-sm/-lg`).
- UI primitives (global.css): `.btn` + `.btn-primary|soft|ghost|outline|danger|
  danger-solid`, sizes `.btn-xs|sm|lg`, `.btn-icon`, `.is-loading`; `.icon-btn`,
  `.chip`, `.seg`/`.seg-btn`, `input.switch`, `kbd`, `.card`, `.eyebrow`,
  `.skeleton`, `.spinner`. Every `<button>` gets a baseline focus ring + press
  feedback. Control heights `--ctl-xs/sm/md/lg` (24/28/32/40px) and text sizes
  `--fs-xs…xl`: every control in one toolbar/strip shares ONE height step.
  Readable copy never below 11px; dim text with `--t2`/`--t3`, never `opacity`.
- **Icons: no emoji, ever** (their per-OS font metrics knock button contents
  off-centre; `tests/uiIcons.test.js` fails on emoji in source). Every icon is a
  NAME from `components/ui/icons.js` — Lucide kebab-case names from the curated
  `ui/lucideIcons.js` registry (add imports there; only listed names bundle) plus
  app icons (graph/directory/timeline/…). DOM: `<UiIcon name="trash-2" :size="16" />`;
  canvas: `drawIcon()` / `iconCanvas()` from `lib/canvasIcon.js`. Data catalogs
  store names; anything rendering a data `icon`/`glyph` goes through UiIcon (it
  also resolves legacy emoji saved in old DBs via `LEGACY_GLYPHS`). Users pick
  icons with `ui/IconPicker.vue`; every search box is `ui/SearchField.vue`.
- **i18n:** every visible string — template text, `title`/`aria-label`/`placeholder`,
  toasts, confirm texts AND canvas-drawn labels (e.g. the graph's "Gen N" guides) —
  goes through `t()` from `i18n/`, with keys in all four locales (`en`, `zh-Hans`,
  `zh-Hant`, `nb`). Catalog constants store ids/`labelKey`s and translate at render
  time; canvas renderers redraw on a `locale` watch; pure layout modules stay
  i18n-free (translate where they're drawn). Built-in DATA stored in English (built-in
  relationship types/roles/statuses, the default traits, Male/Female, the 'Person'
  noun, default names like 'Scene 1' / 'Untitled era') is shown through
  `lib/dataLabels.ts` (`relTypeLabel`, `fieldLabel`, `nounLabel`, `defaultNameLabel`…),
  which translates only while the stored text is still the seeded default.
  `tests/i18n.test.js` fails on key drift between locales, lost `{placeholders}`, or a
  `t('…')` key missing from `en.js`. `LegalModal.vue` (legal text) stays English.
- Never use native `alert`/`confirm`: `await confirmDialog({...})` / `toast(msg,
  { tone })` from `lib/dialogs.js` (rendered by `components/ui/DialogHost.vue`), and
  `undoToast(msg, channel)` (`lib/undoToast.js`) after undoable deletes — its Undo
  only ever reverts that exact edit.
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
`tests/projectFile.test.js` covers project files (`projects:export` →
`projects:import`, sharing `copyProjectInto` with `projects:duplicate`) — update it
with the project data shape. `tests/graphMath.test.js`,
`tests/viewMath.test.js` and `tests/calendarMath.test.js` cover the pure view/date
math (camera transforms, link curves, timeline layout, membership arc spans,
DateValue ordinals). Rendering/interaction has no automated coverage —
verify manually with `npm run dev` (test both themes for visual changes).
