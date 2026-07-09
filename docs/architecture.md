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
| [`ipc.js`](../src/main/ipc.js) | Registers all `ipcMain.handle` channels — the complete server-side API surface. See [ipc-api.md](./ipc-api.md). |

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

## Module map

| Area | Location | Notes |
|------|----------|-------|
| App shell | [`App.vue`](../src/renderer/src/App.vue) | Tree tabs, resizable sidebars, view routing, JSON export. |
| Global state | [`store/index.js`](../src/renderer/src/store/index.js) | Pinia store `main`. |
| IPC wrapper | [`api.js`](../src/renderer/src/api.js) | Thin `invoke` / `getImageUrl` façade. |
| Views | `components/{GraphCanvas,PeopleView,RelationshipsView,TimelineView,FactionsView}.vue` | Five main workspace views. |
| Panels & modals | `components/{LeftSidebar,RightSidebar,PersonModal,PersonForm,GraphSettings}.vue` | |
| Graph engine | [`components/graph/`](../src/renderer/src/components/graph/) | Pure layout/style helpers + the animation composable. |
| Styling | [`styles/global.css`](../src/renderer/src/styles/global.css) | Design tokens (CSS variables) and shared component classes. |

See also: [graph.md](./graph.md) · [data-model.md](./data-model.md) · [ipc-api.md](./ipc-api.md) · [design.md](./design.md)
