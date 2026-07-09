# FamilyTree Desktop App

A desktop application for building and exploring family trees — for your own family,
historical figures, or fictional casts. Add people and relationships, arrange them in
an interactive graph, and view them as cards, a relationships table, or a timeline.

Built with **Electron**, **Vue 3**, **Pinia**, and **D3**.

## Requirements

- **Node.js 18+** — [nodejs.org](https://nodejs.org)

No native build tools are required — the app stores data as a plain JSON file and has
no compiled dependencies.

## Setup & run

```bash
# 1. Install dependencies
npm install

# 2. Start the app in development mode (hot reload)
npm run dev
```

## Build

```bash
npm run build      # bundles main, preload, and renderer into out/
```

> `build` produces the app bundle in `out/`; packaging into a distributable installer
> is not yet configured.

## Test

```bash
npm test           # run the Vitest suite once
npm run test:watch # watch mode
```

## Features

- Interactive family tree graph with physics-based animation (D3 force simulation)
- Four layout modes — **Custom** (free drag), **Auto** (force-directed), **Age** (by
  birth year), and **Generation** (hierarchical) — each with multiple saved arrangements
- Add / edit / delete family members with photos, bio, occupation, and location
- Relationships: parent/child, spouse (with divorce), and adopted
- Non-destructive highlights: lineage (paternal/maternal), gender, marriage, deceased
- Multiple family trees, switchable via tabs
- Alternate views: **People** cards, **Relationships** table (with issue detection),
  and a **Timeline**
- Photo uploads stored locally in your user-data folder
- Dark and light themes; search, zoom, pan, and fit-all
- JSON export

## Troubleshooting

**App shows a blank window** — open DevTools (`Ctrl+Shift+I`) and check the console
for renderer errors.

**Want to reset to a clean state** — close the app and delete the `db/` folder in the
app's user-data directory (see below); it re-seeds sample data on next launch.

## Where your data is stored

The app writes to Electron's per-user data directory:

| OS | Path |
|----|------|
| Windows | `%APPDATA%\family-tree\` |
| macOS | `~/Library/Application Support/family-tree/` |
| Linux | `~/.config/family-tree/` |

with `db/familytree.json` for data and `images/` for copied photos.

## Documentation

Full developer and design documentation lives in [`docs/`](./docs/README.md):

- [Architecture](./docs/architecture.md) · [Data model](./docs/data-model.md) ·
  [IPC API](./docs/ipc-api.md) · [Graph engine](./docs/graph.md)
- [Conventions](./docs/conventions.md) · [Developer guide](./docs/developer.md) ·
  [Contributing](./docs/contributing.md) · [Design](./docs/design.md)
