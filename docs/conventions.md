# Coding conventions

Conventions distilled from the existing codebase. Match the surrounding code first;
the guidance below captures the patterns already in use.

## Language & modules

- **ES modules everywhere** (`"type": "module"`). Use `import`/`export`, not
  `require`. This applies to main, preload, and renderer.
- Modern JavaScript, no TypeScript. No build-time type checking — keep functions
  small and well-named so intent is clear without types.
- Node built-ins in the main process only (`fs`, `path`, `crypto`). The renderer must
  never import Node APIs — it goes through the [preload bridge](./ipc-api.md).

## Formatting

There is no linter or formatter config in the repo; follow the prevailing style:

- 2-space indentation.
- No semicolons at statement ends are **not** the style — this codebase **omits**
  trailing semicolons in most renderer files but is not strict. Match the file you
  are editing.
- Single quotes for strings.
- Section headers use a boxed comment style, e.g.
  `// ── Data actions ──────────────────────────────`. Reuse it to structure longer
  files.
- Prefer short, dense helpers over deep abstraction; the graph code favors compact
  one-liners for hot paths.

## Vue

- **Composition API with `<script setup>`** for every component.
- Single-file components: `<template>`, `<script setup>`, scoped `<style>`.
- Reach for the Pinia store (`useMainStore`) for shared state; use local `ref`/
  `reactive` for component-only UI state.
- Styles are **scoped** per component. Shared primitives (`.btn`, `.badge`, inputs)
  and all design tokens live in
  [`styles/global.css`](../src/renderer/src/styles/global.css) — use the CSS
  variables (`var(--accent)`, `var(--surface)`, …) rather than hard-coded colors so
  both themes work. See [design.md](./design.md).

## State & data access

- **Components → store → api → IPC.** Views must not call `api.invoke` or
  `window.electronAPI` directly; add a store action instead. (A few components read
  images directly via `api.invoke('images:*')` for local, component-owned lists — but
  all persons/relationships/trees flow through the store.)
- Store actions do the IPC round-trip and **optimistically update** the reactive
  arrays only after `res.success`.
- Keep the store the single source of truth for `persons`, `relationships`, `trees`,
  and shared UI flags.

## IPC handlers (main process)

- One channel per operation, named `domain:action` (`persons:create`,
  `trees:setActive`, …).
- Wrap the whole body in `try/catch` and return the envelope:
  `{ success: true, data }` or `{ success: false, error: err.message }`. Never let an
  exception cross the process boundary.
- Call `save()` after any mutation, before returning success.
- Tag new records with the active tree's `tree_id`; filter reads by active tree.

## IDs, dates, cascades

- Generate IDs with `crypto.randomUUID()`.
- Timestamps via the store's `nowStr()` → `"YYYY-MM-DD HH:MM:SS"`.
- Deletes cascade explicitly (a deleted person removes its relationships and image
  files). Keep cascade logic in the handler, not the renderer.

## Graph code

- Keep **layout math pure** — functions that take data + dimensions and return
  positions, with no D3 or store dependency (`computeAgeYPositions`,
  `computeGenLayout`, the `linkHelpers` functions). This keeps them testable and
  predictable.
- Confine D3 DOM mutation and the mutable simulation to `GraphCanvas.vue` and the
  `ctx` object. Do not make per-frame node data reactive — it kills performance.
- See [graph.md](./graph.md) for the full engine design.

## Security

- Preserve the sandbox posture: `contextIsolation: true`, `nodeIntegration: false`.
  Expose new capabilities through explicit preload methods and IPC channels, never by
  widening renderer privileges.
- Serve local files through the `appimg://` protocol, not `file://`.
