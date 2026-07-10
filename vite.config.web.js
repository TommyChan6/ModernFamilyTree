import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// The web build: just the Vue renderer as a static site, no Electron anywhere.
// Without window.electronAPI the app picks the browser-local IndexedDB backend
// (src/renderer/src/api/backends/local.ts), so `npm run dev:web` runs the full
// app in a plain browser. Deploying later = `npm run build:web` + upload dist/
// to any static host (see docs/DEPLOYMENT_PLAN.md).
export default defineConfig({
  root: fileURLToPath(new URL('./src/renderer', import.meta.url)),
  plugins: [vue()],
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true
  }
})
