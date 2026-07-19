---
name: verify
description: Drive this app's UI end-to-end (web build via headless Edge, or Electron via playwright _electron) to verify renderer/data changes at the real surface.
---

# Verifying changes in the running app

Fastest safe path — the **web build** (IndexedDB backend, never touches real user
data; same shared core `src/shared/dbCore.ts` as desktop):

1. `npm run dev:web` in the background, log to a file; poll `curl -s http://localhost:5173/`.
2. Driver script (ESM, run with `node` from the project root). `playwright-core`
   is available in the project's `node_modules`; import it by absolute file URL:
   `import { chromium } from 'file:///C:/Users/tommy/OneDrive/Desktop/newFamilyTree/node_modules/playwright-core/index.mjs'`
3. `chromium.launch({ channel: 'msedge', headless: true })` — Edge is installed,
   no browser download.
4. The app opens on the marketing landing; enter a seeded guest session with
   `page.locator('text=Try the live demo').click()`, then wait ~3s for the
   curtain + initial load.
5. The Pinia store (real actions → real channels) is reachable from page context:
   `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('main')`
   — use store actions to set up data, but click/keyboard the actual UI under test.
6. Collect `pageerror` + `console.error` events; screenshot in BOTH themes
   (`store.setTheme('light'|'dark')`).

Gotchas: inputs blur spuriously in headless Edge (never rely on @blur commits);
`button:has-text()` is not strict — hidden-but-mounted views (GraphCanvas,
TimelineView) shadow same-text controls, use precise class selectors.

For desktop-only surfaces (native dialogs, appimg://, close confirmation): build
first, then Playwright `_electron.launch` with `ELECTRON_RUN_AS_NODE` **deleted**
from env, and redirect userData via a wrapper module that calls
`app.setPath('userData', tmp)` before importing `./out/main/index.js` — details in
the auto-memory note `driving-electron-app-for-verification`. Never run write
channels against the real userData (real family data lives there).
