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
protocol (never `file://`). `initDB()` is idempotent and self-migrating (single-tree →
multi-tree) and seeds a sample family on first run. Data is scoped per tree via
`tree_id`; deletes cascade explicitly (person → its relationships + image files +
removal from faction `member_ids`). On the web build the same data (including the
same seed) lives in a single IndexedDB record instead, with photos stored inline as
data URLs — see `src/renderer/src/api/backends/local.ts`.

**Channel conventions** (`src/shared/dbCore.ts` + shells): channels are named
`domain:action`. Handlers mutate the raw DB and return plain data or throw; the shell
wraps that in `{ success: true, data }` / `{ success: false, error }` — exceptions
never cross the seam. Callers check `success` before reading `data`. The shell
persists after any channel in `WRITE_CHANNELS` before returning. Writes tag new
records with the active `tree_id`; reads filter by it.

**State** (`src/renderer/src/store/index.js`): a single Pinia store `main` is the
source of truth for `persons`, `relationships`, `trees`, UI flags, and `graphSettings`.
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
`familyTreeLayout.ts`, `linkHelpers.js`) with no D3/Three or store dependency. Four
layout modes (custom/auto/age/generation), each with multiple saved "states"
(position snapshots). The full arrangement serializes to the per-tree `graphState`
setting; a `graphDirty` flag drives the Save Layout button and the close-confirmation
prompt (wired from main via `window.__isGraphDirty` / `window.__saveGraphLayout`).

**Views:** the workspace shows one of five views (`store.activeView`), all built to
stay smooth with thousands of people:
- tree (`GraphCanvas`) — WebGL, see above; stays mounted (hidden) when another view
  is active so its simulation/layout survive view switches.
- timeline (`TimelineView`) — WebGL. Pure layout in
  `components/timeline/timelineLayout.js` (world units, recomputed on data changes
  only); drawing in `components/timeline/TimelineRenderer.js` — instanced lifelines,
  pulsing dots, marriage/birth ribbons and avatar pins, with a bg canvas for the year
  grid and an fg canvas for viewport-culled labels/badges/gutter. Hit tests are
  analytic; style changes tween.
- factions (`FactionsView`) — WebGL. Drag-and-drop clustering into switchable
  per-tree "scenarios"; pure math in `components/factions/factionLayout.js`, drawing
  in `components/factions/webgl/FactionsRenderer.js` (zone discs, dash-flow tethers,
  membership arcs, person nodes; overlay canvas for header pills/labels/ghost). The
  d3-force simulation stays in the view and pokes the renderer per tick.
- people (`PeopleView`) and relationships (`RelationshipsView`) — DOM, but
  **virtualized**: only cards/rows near the viewport exist in the DOM. The right
  sidebar member list is virtualized the same way.

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
point `userData` at a temp dir and exercises `db.js` directly: migrations, tree
scoping, cascade deletes, graph-state persistence, field integrity) — update it when
changing `db.js`, `src/shared/dbCore.ts`, or the data shape. `tests/graphMath.test.js` and
`tests/viewMath.test.js` cover the pure view math (camera transforms, link curves,
timeline layout, faction arc spans). Rendering/interaction has no automated coverage —
verify manually with `npm run dev` (test both themes for visual changes).
