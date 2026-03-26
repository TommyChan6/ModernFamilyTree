# FamilyTree Desktop App

## Requirements
- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Windows Build Tools** — needed to compile the SQLite native module

### Install Windows Build Tools (one-time setup)
Open PowerShell as Administrator and run:
```powershell
npm install --global windows-build-tools
```
Or install "Desktop development with C++" from Visual Studio Build Tools 2022.

## Setup & Run

```bash
# 1. Install dependencies
npm install

# 2. Rebuild better-sqlite3 for Electron
npm run rebuild

# 3. Start the app in development mode
npm run dev
```

## Build for distribution
```bash
npm run build
```

## Troubleshooting

**`npm run rebuild` fails with "python not found"**
Install Python 3.x and make sure it's in PATH, then retry.

**`npm run rebuild` fails with "MSBuild not found"**
Install Visual Studio Build Tools 2022 with "Desktop development with C++" workload.

**App shows blank window**
Check the DevTools console (Ctrl+Shift+I) for errors.

## Features
- Family tree graph with physics-based animations (D3 force simulation)
- Add/edit/delete family members
- Relationships: spouse, parent/child, adopted
- Photo uploads stored locally in your user data folder
- Dark and light themes
- Search and filter family members
- Zoom, pan, and fit-all on the graph
