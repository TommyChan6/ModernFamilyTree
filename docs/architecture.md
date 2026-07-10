# Architecture

FamilyTree is a desktop application built on **Electron**. It follows Electron's
standard two-process model, with a **Vue 3** single-page app in the renderer and a
thin, file-backed data layer in the main process.

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Electron application                          │
│                                                                        │
│  ┌───────────────────────────┐        ┌──────────────────────────────┐│
│  │      Main process          │        │        Renderer process       ││
│  │      (Node.js)             │        │        (Chromium + Vue 3)      ││
│  │                            │        │                                ││
│  │  src/main/index.js         │        │  src/renderer/src/main.js      ││
│  │   • BrowserWindow          │        │   • Vue app + Pinia            ││
│  │   • appimg:// protocol     │        │  App.vue (shell)               ││
│  │   • close confirmation     │        │   • tree tabs                  ││
│  │                            │        │   • resizable sidebars         ││
│  │  src/main/db.js            │        │   • view switching             ││
│  │   • JSON file store        │        │  store/index.js (Pinia)        ││
│  │   • migrations + seed      │        │  components/ (views, modals)   ││
│  │                            │        │  components/graph/ (D3 engine) ││
│  │  src/main/ipc.js           │        │                                ││
│  │   • ipcMain.handle(...)    │        │                                ││
│  └───────────▲────────────────┘        └───────────────┬───────────────┘│
│              │                                          │                │
│              │      ipcRenderer.invoke(channel, data)   │                │
│              └──────────────────────────────────────────┘                │
│                         (via preload bridge)                             │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              userData/
                ├── db/familytree.json     (all app data)
                └── images/<uuid>.<ext>    (copied photos)
```

## Process model

### Main process (`src/main/`)

Runs in Node.js and owns everything the sandboxed renderer cannot touch: the
filesystem, native dialogs, the app lifecycle, and custom protocols.

| File | Responsibility |
|------|----------------|
| [`index.js`](../src/main/index.js) | App entry. Creates the `BrowserWindow`, registers the `appimg://` protocol, wires the unsaved-changes close confirmation, and binds a custom `Ctrl+=` zoom accelerator. |
| [`db.js`](../src/main/db.js) | The data store. Loads/saves `familytree.json`, runs schema migrations, and seeds sample data on first run. Exposes `initDB()` and `getDB()`. |
| [`ipc.js`](../src/main/ipc.js) | Registers all `ipcMain.handle` channels — the complete server-side API surface. A thin shell: the actual channel logic lives in the shared data core. See [ipc-api.md](./ipc-api.md). |

### Shared data core (`src/shared/`)

Platform-free TypeScript used on *both* sides of the boundary — and by the web build,
which has no boundary at all:

| File | Responsibility |
|------|----------------|
| [`dbCore.ts`](../src/shared/dbCore.ts) | Every API channel's business logic as pure functions over the DB object (`channelHandlers`), plus the empty-DB shape, the first-run seed, and `WRITE_CHANNELS` (which channels persist). The Electron main process and the browser-local backend are both thin shells around this, so desktop and web behave identically. |
| [`types.ts`](../src/shared/types.ts) | The entity types (`Person`, `Tree`, …), the `{ success, data | error }` envelope, and the `Env` interface for the few platform services handlers need (uuid, clock, image file storage). |

### Preload bridge (`src/preload/index.js`)

The only code that spans the isolation boundary. With `contextIsolation: true` and
`nodeIntegration: false`, the renderer has no direct access to Node or Electron. The
preload script uses `contextBridge.exposeInMainWorld` to expose a minimal,
explicit surface as `window.electronAPI`:

- `invoke(channel, data)` — a pass-through to `ipcRenderer.invoke`.
- `getImageUrl(filePath)` — converts an absolute image path into an `appimg://` URL.

This is a deliberate security posture: the renderer can only call the specific IPC
channels the main process chooses to handle, never arbitrary Node APIs.

### Renderer process (`src/renderer/`)

A standard Vue 3 SPA using the Composition API and `<script setup>`. State lives in a
single Pinia store; the D3-driven graph is the one place we reach outside the Vue
reactivity model for performance (see [graph.md](./graph.md)).

## Data flow

All persistence flows through a single request/response pattern. Components never
talk to `ipcRenderer` directly — they go through the store, which goes through the
`api` wrapper, which goes through the preload bridge.

```
Component  →  Pinia store action  →  api.invoke(channel, data)
                                        →  window.electronAPI.invoke
                                          →  ipcRenderer.invoke
                                            →  ipcMain.handle(channel)  [main]
                                              →  getDB() read/mutate + save()
                                        ←  { success, data } | { success:false, error }
           ←  store updates reactive refs  ←
```

Every IPC handler returns a uniform envelope — `{ success: true, data }` on success
or `{ success: false, error }` on failure — so the renderer never sees a thrown
exception cross the process boundary. See [conventions.md](./conventions.md).

In the **web build** (`npm run dev:web`) the chain is identical down to
`api.invoke`, which then routes to the browser-local backend
([`api/backends/local.ts`](../src/renderer/src/api/backends/local.ts)) instead of the
preload bridge: the same shared channel handlers run in-page against an IndexedDB
store. Components and the store cannot tell the difference — that is the point.

### Reactive state

[`store/index.js`](../src/renderer/src/store/index.js) is the single source of truth
for the renderer. It holds the loaded `persons` and `relationships`, the list of
`trees`, UI flags (`modalOpen`, `formOpen`, `activeView`, `theme`, …), and the
`graphSettings` object. Components read from it and call its actions; the actions
optimistically update the reactive arrays after a successful IPC round-trip.

## Persistence layer

There is **no database engine and no native module**. All data is stored as a single
pretty-printed JSON file (`familytree.json`) under Electron's `userData` directory,
rewritten in full on every `save()`. Photos are copied into a sibling `images/`
folder and referenced by absolute path. See [data-model.md](./data-model.md) for the
exact shape, and [developer.md](./developer.md) for where these files live per-OS.

Because images live outside the app bundle at absolute paths, they cannot be loaded
with `file://` under the renderer's security settings. The main process registers a
privileged `appimg://` scheme and streams the file through `net.fetch`, so images
render without weakening the CSP or enabling `file://` access.

## Build tooling

[`electron-vite`](https://electron-vite.org) drives dev and build for all three
targets (main, preload, renderer) from one [`electron.vite.config.js`](../electron.vite.config.js).
The app ships as ESM; a small `strip-cjs-shim` plugin removes the CommonJS
`createRequire` shim that electron-vite injects, which Electron 31's ESM loader
cannot pre-parse. See [developer.md](./developer.md) for commands.

A second, plain-Vite config ([`vite.config.web.js`](../vite.config.web.js)) builds the
renderer alone as a static website: `npm run dev:web` (dev server), `npm run build:web`
(static `dist/`), `npm run preview:web`. No Electron or Node code is included; the app
detects the missing preload bridge and uses the browser-local backend.

## Module map

| Area | Location | Notes |
|------|----------|-------|
| App shell | [`App.vue`](../src/renderer/src/App.vue) | Tree tabs, resizable sidebars, view routing, JSON export. |
| Global state | [`store/index.js`](../src/renderer/src/store/index.js) | Pinia store `main`. |
| API seam | [`api/`](../src/renderer/src/api/index.ts) | `invoke` / `getImageUrl` façade over swappable backends: `backends/ipc.ts` (Electron) or `backends/local.ts` (browser IndexedDB, used by the web build); auto-selected at startup. Future HTTP/Supabase backend slots in here. |
| Shared data core | [`src/shared/`](../src/shared/dbCore.ts) | Channel handlers + entity types used by the main process *and* the browser backend (see above). |
| Views | `components/{GraphCanvas,PeopleView,RelationshipsView,TimelineView,FactionsView}.vue` | Five main workspace views. Tree/timeline/factions draw with Three.js; people/relationships virtualize their DOM lists. |
| Panels & modals | `components/{LeftSidebar,RightSidebar,PersonModal,PersonForm,GraphSettings}.vue` | Right sidebar member list is virtualized. |
| Graph engine | [`components/graph/`](../src/renderer/src/components/graph/) | Pure layout/style helpers + the animation composable + the tree's WebGL renderer (`graph/webgl/`). |
| Shared WebGL layers | [`components/webgl/`](../src/renderer/src/components/webgl/) | Instanced capsule/dot/ribbon/arc draw layers + overlay-canvas helpers, shared by the timeline and factions renderers. |
| Timeline engine | [`components/timeline/`](../src/renderer/src/components/timeline/) | Pure layout math (`timelineLayout.js`) + Three.js renderer (`TimelineRenderer.js`). |
| Factions engine | [`components/factions/`](../src/renderer/src/components/factions/) | Pure layout math (`factionLayout.js`) + Three.js renderer (`webgl/`). |
| Styling | [`styles/global.css`](../src/renderer/src/styles/global.css) | Design tokens (CSS variables) and shared component classes. |

See also: [graph.md](./graph.md) · [data-model.md](./data-model.md) · [ipc-api.md](./ipc-api.md) · [design.md](./design.md)
