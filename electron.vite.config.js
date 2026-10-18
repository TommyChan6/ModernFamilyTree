import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync } from 'fs'

// package.json `version` → `__APP_VERSION__` (read by src/renderer/src/lib/appInfo.ts).
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// Strip the unused CJS shim that electron-vite injects in ESM mode.
// Electron 31's ESM loader cannot pre-parse "node:module" default import.
const stripCjsShim = {
  name: 'strip-cjs-shim',
  generateBundle(_, bundle) {
    for (const chunk of Object.values(bundle)) {
      if (chunk.type === 'chunk') {
        chunk.code = chunk.code
          .replace(/^import __cjs_mod__ from "node:module";\s*\n?/m, '')
          .replace(/^const require\w* = __cjs_mod__\.createRequire\([^)]*\);\s*\n?/m, '')
      }
    }
  }
}

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin(), stripCjsShim] },
  preload: { plugins: [externalizeDepsPlugin(), stripCjsShim] },
  renderer: {
    plugins: [vue()],
    define: { __APP_VERSION__: JSON.stringify(version) }
  }
})
