# The graph engine

The interactive family tree is the heart of the app. It is rendered with
[D3](https://d3js.org) (SVG + force simulation), driven from
[`GraphCanvas.vue`](../src/renderer/src/components/GraphCanvas.vue) with pure helper
modules in [`components/graph/`](../src/renderer/src/components/graph/).

## Vue ↔ D3 boundary

Vue owns application state; D3 owns the SVG DOM and per-frame node positions. To keep
60fps drag/animation, `GraphCanvas` deliberately steps **outside** Vue reactivity for
the hot path:

- A plain (non-reactive) `ctx` object holds the D3 simulation, selections, the
  working `nodesData` / `linksData` arrays, timers, and per-mode snapshots.
- `watch`ers on `store.persons`, `store.relationships`, `store.theme`,
  `store.selectedPersonId`, and `store.graphSettings` re-sync the SVG when the store
  changes.
- Node objects are mutated in place (`n.x`, `n.y`, `n.fx`, `n.fy`) — the same object
  identity is reused across data updates so the simulation stays warm.

`ticked()` is the single render function: it repaints link paths and applies
`transform: translate(x,y)` to each node group on every simulation/animation frame.

## Layout modes

Four modes, switched from the bottom control bar. Each is entered by an `enter*Mode`
function and can animate node positions via the
[`useGraphAnimation`](../src/renderer/src/components/graph/useGraphAnimation.js)
composable.

| Mode | ID | Behavior |
|------|-----|----------|
| ✋ Custom | `custom` | Nodes are pinned (`fx`/`fy`); the user drags them freely and positions persist. |
| ⚡ Auto | `auto` | D3 force-directed layout (`forceLink`, `forceManyBody`, `forceCenter`, `forceCollide`). Dragging perturbs the simulation. |
| 📅 Age | `age` | Y position is fixed by birth year (older = higher); X is free to drag. Draws year guide lines and a "Now" line. See [`layoutAge.js`](../src/renderer/src/components/graph/layoutAge.js). |
| 🏛 Generation | `generation` | Hierarchical top-down layout computed from parent/child + spouse relationships. Nodes snap to generation rows; dragging between rows previews and creates new rows. See [`layoutGeneration.js`](../src/renderer/src/components/graph/layoutGeneration.js). |

Layout math lives in **pure functions** (`computeAgeYPositions`, `computeGenLayout`)
that take data and dimensions and return target positions — no D3, no store, so they
are easy to reason about and test.

## Per-mode multi-state

Each mode holds an array of named **states** (layout snapshots) the user can create,
rename, duplicate, and delete from the states bar. This lets you keep several arranged
versions of the same tree per mode.

- `modeStateNames[mode]` — display names.
- `modeActiveStateIdx[mode]` — which state is live.
- `modeStateSnapshots[mode][idx]` — `{ [personId]: {x, y} }` (generation snapshots
  also carry `_genRowYValues` and `_genRowSpacing`).

Switching modes or states snapshots the current positions first, then animates into
the target snapshot (recomputing a fresh layout if none exists yet).

## Guides & generation rows

[`guideLines.js`](../src/renderer/src/components/graph/guideLines.js) draws the
non-node overlays in the `guides-layer`:

- **Age mode:** dashed horizontal year lines at a sensible interval, plus a
  highlighted **"Now · <year>"** line driven by `store.currentDate` that slides when
  the year changes.
- **Generation mode:** dashed generation-row lines. Dragging a node shows a live
  "New Gen" preview; dropping resolves the target row (`resolveGenTarget`), and empty
  rows are pruned and redistributed with an animated reflow
  (`cleanupEmptyGenRows` / `redistributeGenRows`).

## Styling helpers

[`linkHelpers.js`](../src/renderer/src/components/graph/linkHelpers.js) contains pure
functions for node/link appearance — `nodeColor`, `linkPath` (a quadratic Bézier with
a deterministic per-edge bend so parallel links don't overlap), and the
emphasis-aware `getLinkStroke` / `getLinkWidth` / `getLinkMarker` / `getDashArray`.
Line style encodes type: solid = parent/child, dashed = spouse, dotted-ish = adopted;
divorced spouses are faded and finely dashed.

## Highlights

The Highlights panel (top-right) layers non-destructive emphasis over any mode by
adjusting node/link opacity, size, and color. These are visual filters only — they
never mutate data.

| Highlight | Options |
|-----------|---------|
| Lineage | Default / Paternal / Maternal (traces father's vs mother's edges) |
| Gender | Default / Male / Female |
| Marriage | Default / Married / Divorced / Single |
| Deceased | Default / Deceased / Living — **requires** a current date set in the left sidebar |

## Nodes

Each node is a circular avatar: the person's primary photo clipped to a circle, or a
Material "person" silhouette fallback. A name label (first name) sits below; an
optional age label fades in when *Show age* is enabled, computed against the current
date (or today) and capped at the death year.

## Persistence {#persistence}

The full graph arrangement is serialized per tree and restored on load.

- `collectGraphState()` snapshots the current mode, emphasis, and **all** modes'
  state names, active indices, and position snapshots into one object.
- `saveGraphState` (store) writes it via `settings:set` under the `graphState` key,
  scoped to the active tree.
- On first data load, `GraphCanvas` restores the saved state
  (`restoreGraphState`) and re-enters the saved mode.

Because layout changes aren't auto-saved, the app tracks a `graphDirty` flag. The
**Save Layout** button pulses when there are unsaved changes, and closing the window
with unsaved layout changes prompts *Save & Close / Discard & Close / Cancel* — wired
from the main process via `window.__isGraphDirty` / `window.__saveGraphLayout`
(see [`index.js`](../src/main/index.js) and [`App.vue`](../src/renderer/src/App.vue)).

## Other views on the same data

The graph is one of five views; the others also read the store's persons/relationships:

- **People** ([`PeopleView.vue`](../src/renderer/src/components/PeopleView.vue)) —
  searchable, sortable card grid. A native-scroll, responsive CSS grid that windows
  to the visible rows (pure math in [`people/peopleLayout.js`](../src/renderer/src/components/people/peopleLayout.js),
  scroll/resize glue in [`people/useVirtualGrid.js`](../src/renderer/src/components/people/useVirtualGrid.js),
  the card in [`people/PersonCard.vue`](../src/renderer/src/components/people/PersonCard.vue)).
  Only one transform (a `translateY` on the grid) moves per scroll frame — never per
  card. Wheel/trackpad and grab-and-drag ([`people/useDragScroll.js`](../src/renderer/src/components/people/useDragScroll.js))
  both navigate. Avatars render **downscaled thumbnails**, never the full-resolution
  photo: [`people/useThumbnail.js`](../src/renderer/src/components/people/useThumbnail.js)
  fetches the file's bytes (`images:bytes`), decodes them off-thread with
  `createImageBitmap` (Chromium handles WebP — the app's photo format — which
  `nativeImage` can't), paints a 144px cover-crop to a canvas, and caches the small
  data URL. Generation is idle-gated (`requestIdleCallback`) so it never competes
  with an active fling, and a skeleton shimmer shows until each resolves. Net effect:
  scrolling a large tree never decodes or GPU-uploads multi-megapixel images —
  measured at a steady 1440p scroll with zero dropped frames.
- **Relationships**
  ([`RelationshipsView.vue`](../src/renderer/src/components/RelationshipsView.vue)) —
  editable table with data-integrity issue detection.
- **Timeline**
  ([`TimelineView.vue`](../src/renderer/src/components/TimelineView.vue)) — vertical
  lifelines on a year axis, ordered into lanes by `computeGenLayout`, with birth and
  marriage connectors and independent time/width zoom.
- **Factions**
  ([`FactionsView.vue`](../src/renderer/src/components/FactionsView.vue)) — people
  clustered into user-defined groups (families, companies, houses, …) by a small
  d3-force simulation; members of several factions settle between them (tether
  threads, orbiting ring segments, and a count badge mark them). Membership is
  edited by drag-and-drop (from the stage, the unassigned tray, or the member
  list). A bottom bar switches between **scenarios** — alternative faction
  configurations over the same people; same-name factions glide between
  scenarios while people shift with the simulation. Pure layout math lives in
  [`components/factions/factionLayout.js`](../src/renderer/src/components/factions/factionLayout.js).

The graph stays mounted (hidden) when another view is active, so its simulation and
layout state survive view switches.
