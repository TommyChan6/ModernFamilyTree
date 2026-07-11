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

- Interactive family graph with physics-based animation (D3 force simulation)
- Four layout types — **Free** (drag anywhere), **Organic** (force-directed),
  **Birth** (by birth date), and **Generations** (hierarchical) — with multiple
  saved **scenes** per view
- Add / edit / delete family members with photos, bio, occupation, and location
- Relationships: parent/child, spouse (with divorce), and adopted
- **Tags & Groups**: label people once, cluster them per scene in the Groups view
- Non-destructive Focus filters: lineage (paternal/maternal), gender, marriage, deceased
- Multiple **projects**, switchable via tabs; everything autosaves, with a manual
  Save/Revert checkpoint
- Alternate views: **Directory** cards, **Relationships** table (with issue
  detection), and a **Timeline**
- **Program Modes** (Simple / Standard / Advanced) tune how much of the app is shown
- Photo uploads stored locally in your user-data folder
- Dark and light themes; search (Ctrl+K), zoom, pan, and fit-all
- JSON export
- Runs as an Electron desktop app **or** a plain website (`npm run dev:web`)

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
