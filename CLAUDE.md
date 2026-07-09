# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # run the app with hot reload (electron-vite)
npm run build        # bundle main, preload, renderer into out/
npm test             # run the Vitest suite once
npm run test:watch   # Vitest watch mode
```

Run a single test file or test:

```bash
npx vitest run tests/db.test.js
npx vitest run -t "migrates an old single-tree database"   # by test name
```

Requires Node 18+. There are **no native modules** — no SQLite, no rebuild step, no
build tools. (Ignore any older notes mentioning `better-sqlite3` / `npm run rebuild`;
`sql.js` is listed in package.json but is unused.) There is no linter or formatter
configured.

## Architecture

Electron desktop app: **Vue 3 renderer** + **Node main process**, with a plain JSON
file as the datastore. Extended docs live in [`docs/`](docs/README.md) — this is the
condensed version.

**Process split:**
- `src/main/` — Node side. `index.js` (BrowserWindow, `appimg://` protocol, unsaved-
  changes close confirmation), `db.js` (the JSON store + migrations + seed), `ipc.js`
  (all `ipcMain.handle` channels = the entire server API).
- `src/preload/index.js` — the only bridge across the isolation boundary. Exposes
  `window.electronAPI.invoke(channel, data)` and `getImageUrl(path)`. `contextIsolation`
  is on and `nodeIntegration` is off — the renderer has no Node access by design.
- `src/renderer/` — Vue 3 SPA (Composition API, `<script setup>`).

**The mandatory data-access chain** — never skip a layer:
```
component → Pinia store action → api.invoke() → electronAPI → ipcRenderer
          → ipcMain.handle (main) → getDB() mutate + save() → { success, data }
```
Components must not call `api.invoke`/`window.electronAPI` directly for
persons/relationships/trees; add a store action instead. (Image lists are the one
pragmatic exception — some components call `images:*` directly.)

**Persistence** (`src/main/db.js`): all data is one pretty-printed JSON file at
`<userData>/db/familytree.json`, rewritten in full on every `save()`. Photos are
copied into `<userData>/images/<uuid>.<ext>` and served via the privileged `appimg://`
protocol (never `file://`). `initDB()` is idempotent and self-migrating (single-tree →
multi-tree) and seeds a sample family on first run. Data is scoped per tree via
`tree_id`; deletes cascade explicitly (person → its relationships + image files +
removal from faction `member_ids`).

**IPC conventions** (`src/main/ipc.js`): channels are named `domain:action`. Every
handler wraps its body in try/catch and returns `{ success: true, data }` or
`{ success: false, error }` — exceptions never cross the process boundary. Callers
check `success` before reading `data`. Write handlers call `save()` before returning.
Writes tag new records with the active `tree_id`; reads filter by it.

**State** (`src/renderer/src/store/index.js`): a single Pinia store `main` is the
source of truth for `persons`, `relationships`, `trees`, UI flags, and `graphSettings`.
Actions do the IPC round-trip and optimistically update reactive arrays only after
`res.success`.

**The graph engine** is the most complex area — see [docs/graph.md](docs/graph.md).
`GraphCanvas.vue` drives D3 (SVG + force simulation) and deliberately steps **outside
Vue reactivity** for the 60fps hot path: a plain `ctx` object holds the simulation,
selections, and node data; nodes are mutated in place (`n.x/y/fx/fy`); `ticked()` is
the single render function. Layout math is kept in **pure functions** under
`components/graph/` (`layoutAge.js`, `layoutGeneration.js`, `linkHelpers.js`) with no
D3 or store dependency; `guideLines.js` and `useGraphAnimation.js` handle overlays and
tweening. Four layout modes (custom/auto/age/generation), each with multiple saved
"states" (position snapshots). The full arrangement serializes to the per-tree
`graphState` setting; a `graphDirty` flag drives the Save Layout button and the
close-confirmation prompt (wired from main via `window.__isGraphDirty` /
`window.__saveGraphLayout`).

**Views:** the workspace shows one of five views (`store.activeView`): tree
(`GraphCanvas`), people (`PeopleView`), relationships (`RelationshipsView`), timeline
(`TimelineView`), factions (`FactionsView` — drag-and-drop clustering of people into
user-defined groups; pure layout math in `components/factions/factionLayout.js`).
The graph stays mounted (hidden) when another view is active so its
simulation/layout survive view switches.

## Conventions

- ES modules everywhere (`"type": "module"`); Node built-ins in the main process only.
- Vue: Composition API + `<script setup>`, scoped styles. All colors come from CSS
  variable design tokens in `src/renderer/src/styles/global.css` (never hard-code) so
  both dark/light themes work.
- Keep graph layout math pure and testable; confine D3 DOM mutation to `GraphCanvas.vue`.
- Preserve the sandbox: expose new capability via explicit preload + IPC, not by
  widening renderer privileges.
- IDs via `crypto.randomUUID()`; timestamps via the store's `nowStr()`.

## Testing

Vitest, focused on the data layer (`tests/db.test.js`), which mocks Electron's `app`
module to point `userData` at a temp dir and exercises `db.js` directly (migrations,
tree scoping, cascade deletes, graph-state persistence, field integrity). Update these
when changing `db.js` or the data shape. UI/graph logic has no automated coverage —
verify manually with `npm run dev` (test both themes for visual changes).
