import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import JavaScriptObfuscator from 'javascript-obfuscator'

// ── Code scrambling (deployment plan Step 3.2b) ──────────────────────────────
// Production web builds only (`apply: 'build'`; never dev, Electron, or tests).
//
// Scope: src/shared/ ONLY — the app's crown-jewel logic (the channel handlers,
// data model, auth, trait/relationship math). Obfuscating the Vue COMPONENT
// layer broke the signed-in build (Step 3.2c: a `.toLowerCase()` crash), and
// components are the low-value part anyway. src/shared survives obfuscation
// cleanly — verified by running the full seed + data ops through an obfuscated
// bundle. node_modules is never touched (public code; scrambling it protects
// nothing and bloats downloads).
//
// LIGHT transforms only: the heavy ones (control-flow flattening, dead code,
// debug traps) can slow code ~10× and break browsers, so they're pinned OFF.

const OBFUSCATOR_OPTIONS = {
  // What's ON (light):
  identifierNamesGenerator: 'hexadecimal',
  stringArray: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  // Without encoding the array still holds readable strings (a grep finds
  // every channel name); base64 makes the shipped text actually opaque.
  // Decode cost lands on app-logic strings only — hot paths are excluded.
  stringArrayEncoding: ['base64'],
  simplify: true,
  compact: true,
  // Module-path strings must stay literal: stringArray would rewrite dynamic
  // `import('./x')` specifiers into lookup calls, which blinds Vite's chunk
  // analysis (the paid-* split silently broke) and breaks lazy imports at
  // runtime. Paths aren't secrets — leave every './ ../' string alone.
  reservedStrings: ['^\\.{1,2}/'],
  // What's OFF (heavy — banned for performance/stability):
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  selfDefending: false,
  sourceMap: false
}

function obfuscateOwnCode() {
  return {
    name: 'obfuscate-own-code',
    apply: 'build', // never in `vite dev`
    enforce: 'post', // after Vue SFC + TS compilation → plain JS arrives here
    transform(code, id) {
      const p = id.split('\\').join('/')
      // src/shared only — the component layer is left readable-but-minified
      // (obfuscating it broke the app; see the note above).
      if (!p.includes('/src/shared/')) return null
      if (!/\.(js|ts)(\?|$)/.test(p)) return null
      const out = JavaScriptObfuscator.obfuscate(code, OBFUSCATOR_OPTIONS)
      return { code: out.getObfuscatedCode(), map: null }
    }
  }
}

// The web build: just the Vue renderer as a static site, no Electron anywhere.
// Without window.electronAPI the app picks the browser-local IndexedDB backend
// (src/renderer/src/api/backends/local.ts), so `npm run dev:web` runs the full
// app in a plain browser. Deploying later = `npm run build:web` + upload dist/
// to any static host (see docs/DEPLOYMENT_PLAN.md).
export default defineConfig({
  root: fileURLToPath(new URL('./src/renderer', import.meta.url)),
  // `.env` lives at the project root, but Vite's envDir defaults to `root`
  // (src/renderer here) — so point it back at the project root, or VITE_* vars
  // (VITE_API_BACKEND, VITE_SUPABASE_*) silently never load in the web build.
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  // Obfuscation now scoped to src/shared only (see the plugin's note); the
  // component layer is left alone because obfuscating it broke the signed-in
  // build. NO_OBFUSCATE=1 skips it entirely (diagnostics / faster builds).
  plugins: [vue(), ...(process.env.NO_OBFUSCATE ? [] : [obfuscateOwnCode()])],
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    // Never ship maps of the (scrambled) source (Step 3.2b).
    sourcemap: false,
    rollupOptions: {
      output: {
        // Ownership stamp on every built chunk — the `/*!` marker survives
        // minification. This line is what a DMCA takedown points at.
        banner:
          '/*! © 2026 Tommy Chan — all rights reserved. ' +
          'Unauthorized copying, redistribution, or re-hosting prohibited. */',
        // Capability-gated features land in `paid-*` chunks (deployment plan
        // Step 2.8). They're only reachable via dynamic import() in
        // src/renderer/src/paid/, so a browser downloads them exclusively when
        // the plan/caps gate approves — free users never receive the code, and
        // everyone's first load gets lighter.
        //
        // Deliberately NOT manualChunks: hand-coloring modules fights rollup's
        // shared-dependency placement (it merged three, then the store/api/i18n
        // core, INTO the paid chunks, which the entry then imported statically —
        // silently defeating the split). Vite's default dynamic-import
        // splitting gets the contents right by construction; we only rename
        // the resulting chunk files.
        chunkFileNames(chunkInfo) {
          const facade = (chunkInfo.facadeModuleId || '').split('\\').join('/')
          if (facade.endsWith('/components/Graph3DView.vue')) {
            return 'assets/paid-space3d-[hash].js'
          }
          if (facade.endsWith('/components/character/CharacterView.vue')) {
            return 'assets/paid-character-[hash].js'
          }
          return 'assets/[name]-[hash].js'
        }
      }
    }
  }
})
