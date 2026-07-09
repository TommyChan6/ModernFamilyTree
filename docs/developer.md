# Developer guide

Everything you need to run, test, build, and find your way around the code.

## Prerequisites

- **Node.js 18+**
- npm (bundled with Node)

That's it. Unlike what older notes may suggest, the app uses a plain JSON file store
with **no native modules** — there is no SQLite, no `node-gyp`, no Windows Build
Tools, and no rebuild step.

## Setup

```bash
npm install
npm run dev      # launch the app with hot reload
```

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the app in development with electron-vite (HMR for the renderer). |
| `npm run build` | Build main, preload, and renderer bundles into `out/`. |
| `npm test` | Run the Vitest suite once. |
| `npm run test:watch` | Run Vitest in watch mode. |

> Note: `npm run build` produces the bundled app in `out/` but there is no
> distribution/packaging step configured (no electron-builder). Packaging into an
> installer would be a future addition.

## Project structure

```
newFamilyTree/
├── electron.vite.config.js   # build config for all 3 targets
├── package.json
├── src/
│   ├── main/                 # main process (Node)
│   │   ├── index.js          # window, protocol, close confirmation
│   │   ├── db.js             # JSON store, migrations, seed
│   │   └── ipc.js            # IPC channel handlers
│   ├── preload/
│   │   └── index.js          # contextBridge (electronAPI)
│   └── renderer/             # Vue 3 SPA
│       ├── index.html
│       └── src/
│           ├── main.js       # Vue + Pinia bootstrap
│           ├── api.js        # IPC wrapper
│           ├── store/index.js# Pinia store `main`
│           ├── styles/global.css
│           └── components/
│               ├── *.vue     # views, sidebars, modals
│               └── graph/    # D3 layout/style helpers + animation
├── tests/
│   └── db.test.js            # Vitest suite for the data layer
└── docs/                     # this documentation
```

## Where the data lives

At runtime the app writes to Electron's per-user `userData` directory:

| OS | Path |
|----|------|
| Windows | `%APPDATA%\family-tree\` |
| macOS | `~/Library/Application Support/family-tree/` |
| Linux | `~/.config/family-tree/` |

Inside it:

- `db/familytree.json` — all app data (see [data-model.md](./data-model.md)).
- `images/<uuid>.<ext>` — copied person photos.

To reset to a clean first-run (which re-seeds the sample family), delete the `db/`
folder while the app is closed.

## Testing {#testing}

Tests use [Vitest](https://vitest.dev) and focus on the data layer, which holds the
migration and cascade logic worth pinning down.
[`tests/db.test.js`](../tests/db.test.js) mocks Electron's `app` module to point
`userData` at a temp directory, then exercises `db.js` directly:

- first-run directory/file creation and sample seeding;
- multi-tree scoping of persons, relationships, and settings;
- single-tree → multi-tree migration;
- person create/delete with relationship cascade;
- per-tree graph-state persistence;
- round-trip field integrity (special characters, null fields).

When you change `db.js` or the data shape, update these tests. UI and graph logic are
not currently covered by automated tests — verify those manually via `npm run dev`.

## Debugging

- Open Chromium DevTools in the running app with **Ctrl+Shift+I**.
- Renderer logs appear in DevTools; main-process `console` logs appear in the
  terminal that ran `npm run dev`.
- A blank window almost always means a renderer error — check the DevTools console
  first.

## Build internals

electron-vite builds all three targets from one config. A small `strip-cjs-shim`
Rollup plugin removes the CommonJS `createRequire` shim electron-vite injects in ESM
mode, which Electron 31's ESM loader cannot pre-parse. Leave it in place unless you
change the Electron/electron-vite versions and confirm the shim is no longer emitted.

## Tech stack

| Concern | Choice |
|---------|--------|
| Shell | Electron 31 (ESM) |
| UI | Vue 3 (Composition API, `<script setup>`) |
| State | Pinia |
| Visualization | D3 v7 |
| Build/dev | electron-vite (Vite) |
| Tests | Vitest |
| Storage | JSON file (no DB engine) |

See [architecture.md](./architecture.md) for how these fit together, and
[contributing.md](./contributing.md) before opening a PR.
