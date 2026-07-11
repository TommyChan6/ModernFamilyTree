<template>
  <div
    ref="containerEl"
    class="graph-area"
    @dragover.prevent="onDirectoryDragOver"
    @drop.prevent="onDirectoryDrop"
  >
    <canvas ref="glCanvasEl" class="graph-gl"></canvas>
    <canvas ref="overlayEl" class="graph-overlay"></canvas>
    <div class="graph-search" :class="{ 'clean-hide-up': store.cleanTree }">
      <span class="search-icon">🔍</span>
      <input v-model="searchQuery" placeholder="Search family members…" @input="highlightSearch" />
    </div>
    <div class="bottom-bars" :class="{ 'clean-hide-down': store.cleanTree }">
      <div class="graph-controls">
        <button class="ctrl-btn" title="Zoom in" @click="zoomIn">＋</button>
        <button class="ctrl-btn" title="Zoom out" @click="zoomOut">－</button>
        <div class="ctrl-sep"></div>
        <button class="ctrl-btn" title="Fit all" @click="fitAll">⊡</button>
        <button class="ctrl-btn" title="Reset view" @click="resetZoom">⊕</button>
        <div class="ctrl-sep"></div>
        <button
          v-for="m in modes"
          :key="m.id"
          class="ctrl-btn ctrl-btn-wide"
          :class="{ 'ctrl-btn-active': currentMode === m.id }"
          :title="m.title"
          @click="switchMode(m.id)"
        >
          {{ m.label }}
        </button>
        <div class="ctrl-sep"></div>
        <button
          class="ctrl-btn ctrl-btn-refresh"
          :class="{ 'ctrl-btn-refreshing': refreshSpinning }"
          title="Refresh layout — re-run the family tree algorithm"
          @click="refreshLayout"
        >
          <span class="refresh-icon">⟳</span>
        </button>
        <div class="ctrl-sep"></div>
        <button
          class="ctrl-btn"
          :class="{ 'ctrl-btn-lock': store.lockNodes }"
          title="Lock/unlock node clicks"
          @click="store.lockNodes = !store.lockNodes"
        >
          {{ store.lockNodes ? '🔒' : '👤' }}
        </button>
        <button
          class="ctrl-btn"
          :class="{ 'ctrl-btn-lock': store.lockLines }"
          title="Lock/unlock line clicks"
          @click="store.lockLines = !store.lockLines"
        >
          {{ store.lockLines ? '🔒' : '🔗' }}
        </button>
        <div class="ctrl-sep"></div>
        <button
          class="ctrl-btn"
          :class="{ 'ctrl-btn-active': focusOpen }"
          title="Highlights"
          @click="focusOpen = !focusOpen"
        >
          🎯
        </button>
        <button
          class="ctrl-btn"
          :class="{ 'ctrl-btn-active': legendOpen }"
          title="Legend"
          @click="legendOpen = !legendOpen"
        >
          🗺
        </button>
        <button
          class="ctrl-btn"
          :class="{ 'ctrl-btn-active': store.cleanTree }"
          title="Clean view — hide canvas overlays"
          @click="store.cleanTree = !store.cleanTree"
        >
          ✨
        </button>
      </div>
      <SceneTabs
        class="graph-scene-tabs"
        :scenes="graphScenes"
        :active-id="activeSceneId"
        label="Scenes"
        add-title="New scene"
        duplicate-title="Duplicate current scene"
        delete-title="Delete scene"
        @switch="switchScene"
        @create="addScene"
        @duplicate="duplicateActiveScene"
        @rename="(id, name) => store.renameScene(id, name)"
        @remove="removeScene"
      />
    </div>
    <Transition name="relpop">
      <div v-if="store.relPopup" class="rel-popup" :style="relPopupStyle" @click.stop>
        <button class="rel-popup-close" @click="store.relPopup = null">✕</button>
        <div class="rel-popup-type">{{ relPopupTypeLabel }}</div>
        <div class="rel-popup-people">{{ relPopupPersonA }} — {{ relPopupPersonB }}</div>
        <div v-if="relPopupFormedLabel" class="rel-popup-date">{{ relPopupFormedLabel }}</div>
        <div v-if="relPopupStatus" class="rel-popup-status" :class="relPopupStatus">
          {{ relPopupStatus }}
        </div>
      </div>
    </Transition>
    <!-- Restore button while Clean view hides the tool pill -->
    <button
      v-if="store.cleanTree"
      class="clean-restore"
      title="Exit clean view"
      @click="store.cleanTree = false"
    >
      ✨
    </button>
    <!-- Highlights (Focus) popover, toggled from the tool pill -->
    <div v-if="focusOpen" class="highlights-panel" :class="{ 'clean-hide-right': store.cleanTree }">
      <div class="highlights-title">Highlights</div>
      <div class="highlight-row">
        <div class="highlight-label">Lineage</div>
        <div class="seg-slider">
          <div class="seg-track">
            <div class="seg-thumb" :class="'seg-pos-' + lineageIndex"></div>
          </div>
          <button
            v-for="opt in lineageOptions"
            :key="opt.id"
            class="seg-option"
            :class="{ 'seg-active': activeEmphasis === opt.id }"
            @click="cycleEmphasis(opt.id)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
      <div class="highlight-row">
        <div class="highlight-label">Gender</div>
        <div class="seg-slider">
          <div class="seg-track">
            <div class="seg-thumb seg-thumb-gender" :class="'seg-pos-' + genderIndex"></div>
          </div>
          <button
            v-for="opt in genderOptions"
            :key="opt.id"
            class="seg-option"
            :class="{ 'seg-active': activeGender === opt.id }"
            @click="setGenderHighlight(opt.id)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
      <div class="highlight-row">
        <div class="highlight-label">Marriage</div>
        <div class="seg-slider">
          <div class="seg-track">
            <div class="seg-thumb seg-thumb-couples" :class="'seg-pos-' + couplesIndex"></div>
          </div>
          <button
            v-for="opt in couplesOptions"
            :key="opt.id"
            class="seg-option"
            :class="{ 'seg-active': activeCouples === opt.id }"
            @click="setCouplesHighlight(opt.id)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
      <div class="highlight-divider"></div>
      <div
        class="highlight-row"
        :class="{ 'highlight-disabled': !store.currentDate }"
        :title="!store.currentDate ? 'Set current date first to use this filter' : ''"
      >
        <div class="highlight-label">Deceased</div>
        <div class="seg-slider" :class="{ 'seg-disabled': !store.currentDate }">
          <div class="seg-track">
            <div class="seg-thumb seg-thumb-deceased" :class="'seg-pos-' + deceasedIndex"></div>
          </div>
          <button
            v-for="opt in deceasedOptions"
            :key="opt.id"
            class="seg-option"
            :class="{ 'seg-active': activeDeceased === opt.id }"
            :disabled="!store.currentDate"
            @click="setDeceasedHighlight(opt.id)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="legendOpen" class="graph-legend" :class="{ 'clean-hide-right': store.cleanTree }">
      <div class="panel-title">Legend</div>
      <div class="leg-section">
        <div class="leg-section-label">Nodes</div>
        <div class="leg-row">
          <div class="leg-dot" style="background: #3a7bd5"></div>
          Male
        </div>
        <div class="leg-row">
          <div class="leg-dot" style="background: #c95fa0"></div>
          Female
        </div>
      </div>
      <div class="leg-section">
        <div class="leg-section-label">Lines</div>
        <div class="leg-row">
          <div class="leg-line" style="background: #8b6cc5"></div>
          Parent / Child
        </div>
        <div class="leg-row">
          <div class="leg-line leg-dashed" style="border-color: #f06292"></div>
          Spouse
        </div>
        <div class="leg-row">
          <div class="leg-line leg-dashed" style="border-color: #f5a623"></div>
          Adopted
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import * as d3 from 'd3'
import { useMainStore } from '../store/index.js'
import { api } from '../api'
import {
  nodeColor,
  getLinkStroke,
  getLinkWidth,
  getLinkEmphOpacity,
  getLinkMarker,
  getDashArray
} from './graph/linkHelpers.js'
import { computeAgeYPositions } from './graph/layoutAge.js'
import { computeGenLayout } from './graph/familyTreeLayout'
import {
  drawYearGuides,
  drawGenGuides,
  removeGuides,
  updateGenPreview,
  removeGenPreview,
  resolveGenTarget,
  cleanupEmptyGenRows,
  drawCurrentYearLine,
  removeCurrentYearLine,
  cancelGuideTimers
} from './graph/guideLines.js'
import { useGraphAnimation } from './graph/useGraphAnimation.js'
import { WebGLGraphRenderer } from './graph/webgl/WebGLGraphRenderer.js'
import { screenToWorld } from './graph/webgl/coords.js'
import SceneTabs from './SceneTabs.vue'

const store = useMainStore()
const glCanvasEl = ref(null)
const overlayEl = ref(null)
const containerEl = ref(null)
const searchQuery = ref('')
const activeEmphasis = ref('neutral')
const focusOpen = ref(false) // Highlights popover (from the tool pill)
const legendOpen = ref(true) // Legend panel toggle (from the tool pill)

const modes = [
  { id: 'custom', label: '✋ Custom', title: 'Freely position nodes' },
  { id: 'auto', label: '⚡ Auto', title: 'Force-directed layout' },
  { id: 'age', label: '📅 Age', title: 'Sort by birth year' },
  { id: 'generation', label: '🏛 Gen', title: 'Generational layout' }
]

// ── Scenes ──────────────────────────────────────────────────────────────────
// The graph runs off view:'graph' Scenes: each carries a layout *type*
// (free/organic/birth/generations) plus its node positions and config. The
// interaction code below still thinks in the legacy internal mode ids, so map
// scene types onto them (labels get their user-facing rename in Phase 7).
const MODE_TO_TYPE = { custom: 'free', auto: 'organic', age: 'birth', generation: 'generations' }
const TYPE_TO_MODE = { free: 'custom', organic: 'auto', birth: 'age', generations: 'generation' }

const graphScenes = computed(() => store.graphScenes)
const activeSceneId = computed(() => store.activeSceneIds.graph)
const activeScene = computed(
  () => graphScenes.value.find((s) => s.id === activeSceneId.value) || null
)
const currentMode = computed(() => TYPE_TO_MODE[activeScene.value?.type] || 'auto')

// Live working copies of each scene's arrangement, mutated as the user drags
// and persisted by Save Layout (Phase 5.4 turns this into autosave).
// sceneId → { positions: {personId: {x,y}}, config: {...} }
const working = new Map()
function workingOf(sceneId) {
  if (!sceneId) return null
  if (!working.has(sceneId)) {
    const s = store.scenes.find((sc) => sc.id === sceneId)
    working.set(sceneId, {
      positions: JSON.parse(JSON.stringify(s?.positions || {})),
      config: JSON.parse(JSON.stringify(s?.config || {}))
    })
  }
  return working.get(sceneId)
}

// ── Shared mutable context ──────────────────────────────────────────────────
const ctx = {
  simulation: null,
  zoomBehavior: null,
  zoomSelection: null,
  renderer: null,
  nodesData: [],
  linksData: [],
  animTimer: null,
  resizeObserver: null,
  transform: { x: 0, y: 0, k: 1 },
  genRowYValues: [],
  genRowSpacing: 140,
  arrowSize: 9, // animated arrowhead size for lineage emphasis
  activeSnapshot: null, // the active scene's working positions ({id:{x,y}} | null)
  containerRef: null, // set in onMounted
  ticked: null, // set below
  requestRedraw: null
}
let hoverId = null // node currently hovered (for glow)
let couplesHiSet = null // ids highlighted by the Marriage filter, or null

const { cancelAnimation, animateToPositionsWithReset } = useGraphAnimation(ctx)

// ── Emphasis ────────────────────────────────────────────────────────────────
function emphVisual() {
  return activeEmphasis.value
}

const lineageOptions = [
  { id: 'neutral', label: 'Default' },
  { id: 'paternal', label: 'Paternal' },
  { id: 'maternal', label: 'Maternal' }
]
const lineageIndex = computed(() => {
  const idx = lineageOptions.findIndex((o) => o.id === activeEmphasis.value)
  return idx >= 0 ? idx : 0
})

const genderOptions = [
  { id: 'normal', label: 'Default' },
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' }
]
const activeGender = ref('normal')
const genderIndex = computed(() => {
  const idx = genderOptions.findIndex((o) => o.id === activeGender.value)
  return idx >= 0 ? idx : 0
})

function setGenderHighlight(which) {
  if (activeGender.value === which) return
  activeGender.value = which
  applyGenderHighlight()
}

// Highlights are now visual filters computed at draw time in nodeVisual()/linkVisual().
// Toggling one just flags the renderer to re-sync node/link styles and redraw.
function markNodeStyles() {
  ctx.renderer?.markNodeStylesDirty()
  ctx.requestRedraw?.()
}
function markLinkStyles() {
  ctx.renderer?.markLinkStylesDirty()
  ctx.requestRedraw?.()
}

function applyGenderHighlight() {
  markNodeStyles()
}

// ── Couples highlight ────────────────────────────────────────────────────────
const couplesOptions = [
  { id: 'normal', label: 'Default' },
  { id: 'married', label: 'Married' },
  { id: 'divorced', label: 'Divorced' },
  { id: 'single', label: 'Single' }
]
const activeCouples = ref('normal')
const couplesIndex = computed(() => {
  const idx = couplesOptions.findIndex((o) => o.id === activeCouples.value)
  return idx >= 0 ? idx : 0
})

function setCouplesHighlight(which) {
  if (activeCouples.value === which) return
  activeCouples.value = which
  applyCouplesHighlight()
}

// Precompute the id set highlighted by the Marriage filter (read by nodeVisual/linkVisual).
function recomputeCouplesSet() {
  const c = activeCouples.value
  if (c === 'normal') {
    couplesHiSet = null
    return
  }
  const rels = store.relationships
  const allSpouseIds = new Set(),
    marriedIds = new Set(),
    divorcedIds = new Set()
  rels.forEach((r) => {
    if (r.type !== 'spouse') return
    allSpouseIds.add(r.person_a_id)
    allSpouseIds.add(r.person_b_id)
    if (r.status === 'divorced') {
      divorcedIds.add(r.person_a_id)
      divorcedIds.add(r.person_b_id)
    } else {
      marriedIds.add(r.person_a_id)
      marriedIds.add(r.person_b_id)
    }
  })
  const set = new Set()
  if (c === 'married') marriedIds.forEach((id) => set.add(id))
  else if (c === 'divorced') divorcedIds.forEach((id) => set.add(id))
  else if (c === 'single')
    ctx.nodesData.forEach((n) => {
      if (!allSpouseIds.has(n.id)) set.add(n.id)
    })
  couplesHiSet = set
}

function applyCouplesHighlight() {
  recomputeCouplesSet()
  markNodeStyles()
  markLinkStyles()
}

// ── Date & Deceased highlight ───────────────────────────────────────────────
const deceasedOptions = [
  { id: 'normal', label: 'Default' },
  { id: 'deceased', label: 'Deceased' },
  { id: 'living', label: 'Living' }
]
const activeDeceased = ref('normal')
const deceasedIndex = computed(() => {
  const idx = deceasedOptions.findIndex((o) => o.id === activeDeceased.value)
  return idx >= 0 ? idx : 0
})

function isDeceased(person) {
  if (!store.currentDate) return false
  return person.death?.year && person.death.year <= store.currentDate.year
}

function isLiving(person) {
  if (!store.currentDate) return true
  return !person.death?.year || person.death.year > store.currentDate.year
}

function setDeceasedHighlight(which) {
  if (!store.currentDate) return
  if (activeDeceased.value === which) return
  activeDeceased.value = which
  applyDeceasedHighlight()
}

function applyDeceasedHighlight() {
  markNodeStyles()
}

// ── Popup computeds ─────────────────────────────────────────────────────────
const relPopupStyle = computed(() => {
  if (!store.relPopup) return {}
  return { left: store.relPopup.x + 'px', top: store.relPopup.y + 'px' }
})
const relPopupTypeLabel = computed(() => {
  if (!store.relPopup) return ''
  const r = store.relPopup.rel
  if (r.type === 'spouse') return r.status === 'divorced' ? 'Divorced' : 'Married'
  if (r.type === 'parent_child') return 'Parent / Child'
  if (r.type === 'adopted') return 'Adopted'
  return r.type
})
const relPopupPersonA = computed(() => {
  if (!store.relPopup) return ''
  return store.persons.find((x) => x.id === store.relPopup.rel.person_a_id)?.name || '?'
})
const relPopupPersonB = computed(() => {
  if (!store.relPopup) return ''
  return store.persons.find((x) => x.id === store.relPopup.rel.person_b_id)?.name || '?'
})
const relPopupFormedLabel = computed(() => {
  if (!store.relPopup) return ''
  const r = store.relPopup.rel
  if (r.formed?.year)
    return r.type === 'spouse' ? `Married: ${r.formed.year}` : `Since: ${r.formed.year}`
  if (r.type === 'parent_child') {
    const child = store.persons.find((x) => x.id === r.person_b_id)
    if (child?.birth?.year) return `Born: ${child.birth.year}`
  }
  return ''
})
const relPopupStatus = computed(() =>
  store.relPopup?.rel?.status === 'divorced' ? 'divorced' : ''
)

// ── Snapshot helpers ────────────────────────────────────────────────────────
// Snapshot the live node positions (and generation rows / emphasis) into the
// active scene's working copy. All the legacy per-mode snapshot entry points
// funnel here — a scene has exactly one arrangement.
function snapshotActiveScene() {
  const w = workingOf(activeSceneId.value)
  if (!w) return
  const snap = {}
  ctx.nodesData.forEach((n) => {
    snap[n.id] = { x: n.x, y: n.y }
  })
  w.positions = snap
  if (currentMode.value === 'generation') {
    w.config.genRowYValues = [...ctx.genRowYValues]
    w.config.genRowSpacing = ctx.genRowSpacing
  }
  w.config.emphasis = activeEmphasis.value
  ctx.activeSnapshot = snap
  schedulePersist(activeSceneId.value)
}
const snapshotMode = snapshotActiveScene
const snapshotGenMode = snapshotActiveScene
const saveCurrentState = snapshotActiveScene

// Autosave: every snapshot persists its scene through the data-access chain,
// lightly debounced so bursts (drags, row cleanups) coalesce into one write.
let persistTimer = null
let pendingPersistId = null
function schedulePersist(sceneId) {
  if (!sceneId) return
  if (persistTimer && pendingPersistId !== sceneId) {
    // switching scenes mid-debounce: flush the previous scene's write now
    clearTimeout(persistTimer)
    persistScene(pendingPersistId)
  }
  pendingPersistId = sceneId
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    pendingPersistId = null
    persistScene(sceneId)
  }, 400)
}

function hasSnapshot() {
  return ctx.activeSnapshot && Object.keys(ctx.activeSnapshot).length > 0
}

// Point ctx at the active scene's working arrangement and run its layout
// type's entry (same snapshot-then-animate transition as always).
function enterActiveScene() {
  const w = workingOf(activeSceneId.value)
  ctx.activeSnapshot = w && Object.keys(w.positions).length ? w.positions : null
  activeEmphasis.value = w?.config?.emphasis || 'neutral'
  removeGuides(ctx)
  const mode = currentMode.value
  if (mode === 'auto') enterAutoMode()
  else if (mode === 'custom') enterCustomMode()
  else if (mode === 'age') enterAgeMode()
  else if (mode === 'generation') enterGenerationMode()
  applyEmphasis()
}

// ── Scene tab operations ────────────────────────────────────────────────────
function switchScene(id) {
  if (id === activeSceneId.value) return
  cancelAnimation()
  if (ctx.nodesData.length) saveCurrentState()
  store.setActiveScene('graph', id)
  enterActiveScene()
}

// New scene: keeps the current type and starts from the current positions
// (the old "add state" behaviour).
async function addScene() {
  if (ctx.nodesData.length) saveCurrentState()
  const snap = {}
  ctx.nodesData.forEach((n) => {
    snap[n.id] = { x: n.x, y: n.y }
  })
  const config = {}
  if (currentMode.value === 'generation') {
    config.genRowYValues = [...ctx.genRowYValues]
    config.genRowSpacing = ctx.genRowSpacing
  }
  const res = await store.createScene('graph', `State ${graphScenes.value.length + 1}`, {
    type: activeScene.value?.type || 'organic',
    positions: snap,
    config
  })
  if (res?.success) {
    store.setActiveScene('graph', res.data.id)
    enterActiveScene()
  }
}

async function duplicateActiveScene() {
  const id = activeSceneId.value
  if (!id) return
  saveCurrentState()
  await persistScene(id) // the copy must include unsaved working changes
  const res = await store.duplicateScene(id)
  if (res?.success) {
    store.setActiveScene('graph', res.data.scene.id)
    enterActiveScene()
  }
}

async function removeScene(scene) {
  if (graphScenes.value.length <= 1) return
  if (!confirm(`Delete scene "${scene.name}"?`)) return
  const wasActive = scene.id === activeSceneId.value
  working.delete(scene.id)
  await store.deleteScene(scene.id) // re-activates the view's first scene
  if (wasActive) enterActiveScene()
}

/** Persist one scene's working arrangement through the data-access chain. */
async function persistScene(sceneId) {
  const w = working.get(sceneId)
  if (!w || !store.scenes.some((s) => s.id === sceneId)) return
  await store.saveScene({ id: sceneId, positions: w.positions, config: w.config })
}

// ── Ticked ──────────────────────────────────────────────────────────────────
// The single render sink. Under WebGL it just marks the picker stale and requests a redraw;
// the renderer's on-demand loop reads node positions and repaints (nodes + links + overlay).
function ticked() {
  if (!ctx.renderer) return
  ctx.renderer.invalidatePicker()
  ctx.renderer.requestRedraw()
}
ctx.ticked = ticked
ctx.requestRedraw = () => ctx.renderer?.requestRedraw()

function getImageUrl(filePath) {
  return api.getImageUrl(filePath)
}

// Age in years: counted to the current date (or today if none set), capped at death year.
function ageOf(d) {
  if (!d.birth?.year) return null
  const refYear = store.currentDate?.year ?? new Date().getFullYear()
  const endYear = d.death?.year ? Math.min(d.death.year, refYear) : refYear
  const age = endYear - d.birth.year
  return age >= 0 ? age : null
}

// ── Per-node / per-link visual descriptors (single source of truth for styling) ──────
// These reproduce the old SVG renderNodes/renderLinks styling, including the Highlights
// panel filters, but as plain values consumed by the WebGL layers each redraw.
function nodeVisual(n) {
  const gs = store.graphSettings
  const selected = store.selectedPersonId === n.id
  const fill = selected
    ? d3.color(nodeColor(n.gender, gs))?.brighter(0.4)?.toString() || nodeColor(n.gender, gs)
    : nodeColor(n.gender, gs)

  let opacityMul = 1,
    radiusMul = 1
  const g = activeGender.value
  if (g === 'male') {
    if (n.gender === 'male') radiusMul = 1.15
    else opacityMul *= 0.25
  } else if (g === 'female') {
    if (n.gender === 'female') radiusMul = 1.15
    else opacityMul *= 0.25
  }
  if (couplesHiSet) {
    if (couplesHiSet.has(n.id)) radiusMul = Math.max(radiusMul, 1.15)
    else opacityMul *= 0.2
  }
  const dc = activeDeceased.value
  if (dc === 'deceased') {
    if (isDeceased(n)) radiusMul = Math.max(radiusMul, 1.15)
    else opacityMul *= 0.2
  } else if (dc === 'living') {
    if (isLiving(n)) radiusMul = Math.max(radiusMul, 1.15)
    else opacityMul *= 0.2
  }
  const q = searchQuery.value.toLowerCase().trim()
  if (q && !(n.name || '').toLowerCase().includes(q)) opacityMul *= 0.2

  return {
    radius: gs.nodeRadius * radiusMul,
    fill,
    border: selected ? '#6c8ef5' : '#ffffff',
    borderPx: selected ? 3 : 1.5,
    borderA: selected ? 0.95 : 0.18,
    opacity: gs.nodeOpacity * opacityMul,
    selected,
    glow: selected || (hoverId === n.id && gs.glowOnHover) ? 1 : 0,
    imageUrl: n.primary_image ? getImageUrl(n.primary_image) : null
  }
}

const MARKER_COLORS = {
  'url(#arr-pat)': '#4a90d9',
  'url(#arr-mat)': '#d94a8a',
  'url(#arr-pat-ad)': '#7bb8f0',
  'url(#arr-mat-ad)': '#eda0c4'
}
function markerColor(marker, gs) {
  if (marker === 'url(#arr)') return gs.parentChildColor
  if (marker === 'url(#arr-a)') return gs.adoptedColor
  return MARKER_COLORS[marker] || gs.parentChildColor
}

function linkVisual(d) {
  const gs = store.graphSettings,
    emph = emphVisual(),
    persons = store.persons
  const colorHex = getLinkStroke(d, emph, gs, persons)
  let width = getLinkWidth(d, emph, gs, persons)
  let opacity = getLinkEmphOpacity(d, emph, gs, persons)

  // Marriage highlight overrides opacity/width for spouse vs non-spouse (mirrors SVG).
  const c = activeCouples.value
  if (c !== 'normal') {
    const base =
      d.type === 'spouse'
        ? gs.spouseWidth
        : d.type === 'adopted'
          ? gs.adoptedWidth
          : gs.parentChildWidth
    if (c === 'single') {
      opacity = d.type === 'spouse' ? gs.linkOpacity * 0.15 : gs.linkOpacity * 0.3
      width = base
    } else if (d.type !== 'spouse') {
      opacity = gs.linkOpacity * 0.2
      width = base
    } else if (c === 'married' && d.status !== 'divorced') {
      opacity = Math.min(1, gs.linkOpacity * 1.5)
      width = base * 2
    } else if (c === 'divorced' && d.status === 'divorced') {
      opacity = Math.min(1, gs.linkOpacity * 1.5)
      width = base * 2
    } else {
      opacity = gs.linkOpacity * 0.2
      width = base
    }
  }

  const dashStr = getDashArray(d)
  let dashLen = 0,
    dashGap = 0
  if (dashStr) {
    const p = dashStr.split(',').map(Number)
    dashLen = p[0]
    dashGap = p[1]
  }

  const marker = getLinkMarker(d, emph, persons)
  const isPatMat = marker && (marker.includes('pat') || marker.includes('mat'))
  return {
    colorHex,
    width,
    opacity,
    dashLen,
    dashGap,
    arrowColor: marker ? markerColor(marker, gs) : null,
    arrowSize: isPatMat ? 14 : 9
  }
}

// ── Init graph ──────────────────────────────────────────────────────────────
function initGraph() {
  const container = containerEl.value
  if (!container) return
  ctx.containerRef = container
  const { width, height } = container.getBoundingClientRect()

  const hooks = {
    getSettings: () => store.graphSettings,
    getTheme: () => store.theme,
    getNodes: () => ctx.nodesData,
    getLinks: () => ctx.linksData,
    getPersons: () => store.persons,
    getEmphasis: () => emphVisual(),
    nodeVisual,
    linkVisual,
    overlayOpts: () => ({
      gs: store.graphSettings,
      nodes: ctx.nodesData,
      showLabels: store.graphSettings.showLabels,
      showAge: store.graphSettings.showAge,
      selectedId: store.selectedPersonId,
      labelOpacityOf: (n) => Math.min(1, nodeVisual(n).opacity),
      ageOf
    })
  }
  ctx.renderer = new WebGLGraphRenderer({
    glCanvas: glCanvasEl.value,
    overlayCanvas: overlayEl.value,
    hooks
  })
  ctx.renderer.resize(width, height)
  ctx.renderer.setTheme(store.theme === 'light')

  // d3.zoom on the (topmost) overlay canvas drives the shared camera transform.
  ctx.zoomBehavior = d3
    .zoom()
    .scaleExtent([0.1, 4])
    .filter(zoomFilter)
    .on('zoom', (e) => {
      ctx.transform = { x: e.transform.x, y: e.transform.y, k: e.transform.k }
      ctx.renderer.setCamera(ctx.transform)
    })
  ctx.zoomSelection = d3.select(overlayEl.value)
  ctx.zoomSelection.call(ctx.zoomBehavior)
  installPointerHandlers()

  ctx.simulation = d3
    .forceSimulation()
    .force(
      'link',
      d3
        .forceLink()
        .id((d) => d.id)
        .distance(160)
        .strength(0.4)
    )
    .force('charge', d3.forceManyBody().strength(-380))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide(52))
    .on('tick', ticked)

  ctx.resizeObserver = new ResizeObserver(() => {
    if (!container) return
    const r = container.getBoundingClientRect()
    ctx.renderer.resize(r.width, r.height)
    if (currentMode.value === 'auto') {
      ctx.simulation.force('center', d3.forceCenter(r.width / 2, r.height / 2))
      ctx.simulation.alpha(0.1).restart()
    }
  })
  ctx.resizeObserver.observe(container)
}

// ── Data sync ───────────────────────────────────────────────────────────────
function updateGraph() {
  if (!ctx.simulation || !ctx.renderer) return
  const existingById = {}
  ctx.nodesData.forEach((n) => {
    existingById[n.id] = n
  })

  const newNodes = store.persons.map((p) => {
    if (existingById[p.id]) return Object.assign(existingById[p.id], p)
    const rel = store.relationships.find((r) => r.person_a_id === p.id || r.person_b_id === p.id)
    let sx = (ctx.containerRef?.offsetWidth || 800) / 2,
      sy = (ctx.containerRef?.offsetHeight || 600) / 2
    if (rel) {
      const cid = rel.person_a_id === p.id ? rel.person_b_id : rel.person_a_id
      const cn = existingById[cid]
      if (cn) {
        sx = cn.x + (Math.random() - 0.5) * 40
        sy = cn.y + (Math.random() - 0.5) * 40
      }
    }
    return { ...p, x: sx, y: sy, vx: 0, vy: 0 }
  })

  const hadNew = newNodes.length > ctx.nodesData.length
  ctx.nodesData = newNodes
  ctx.linksData = store.relationships.map((r) => ({
    ...r,
    source: r.person_a_id,
    target: r.person_b_id
  }))
  // Drop stale interaction refs to nodes that no longer exist.
  if (hoverId && !newNodes.some((n) => n.id === hoverId)) hoverId = null
  if (drag && !newNodes.includes(drag.node)) drag = null
  ctx.simulation.nodes(ctx.nodesData)
  ctx.simulation.force('link').links(ctx.linksData)
  if (currentMode.value === 'auto') ctx.simulation.alpha(hadNew ? 0.3 : 0.1).restart()
  recomputeCouplesSet()
  ctx.renderer.setData(ctx.nodesData, ctx.linksData)
}

// ── Interaction: zoom + node drag + hover + click ────────────────────────────
// Zoom/pan is handled by d3.zoom on the overlay canvas; node dragging is our own pointer
// logic (there are no per-node DOM elements to attach d3.drag to). The zoom filter blocks
// panning when the press lands on a draggable node so the two gestures never conflict.
let drag = null // { node, moved, downX, downY }
let grab = { dx: 0, dy: 0 } // grab offset so the node doesn't jump to the cursor
let pending = null // potential click (press that didn't grab a node)

function clientToWorld(clientX, clientY) {
  const rect = overlayEl.value.getBoundingClientRect()
  return screenToWorld(clientX - rect.left, clientY - rect.top, ctx.transform)
}
function hitRadius() {
  return store.graphSettings.nodeRadius
}

function zoomFilter(event) {
  if (event.type === 'wheel') return !event.ctrlKey
  if (event.button != null && event.button !== 0) return false
  const w = clientToWorld(event.clientX, event.clientY)
  const hit = ctx.renderer?.pickNode(w.x, w.y, hitRadius())
  if (hit && !store.lockNodes) return false // grabbing a node -> no pan
  return true
}

function installPointerHandlers() {
  const el = overlayEl.value
  el.addEventListener('pointerdown', onPointerDown)
  el.addEventListener('pointermove', onHoverMove)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}
function removePointerHandlers() {
  const el = overlayEl.value
  if (el) {
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointermove', onHoverMove)
  }
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

function onPointerDown(e) {
  if (e.button !== 0) return
  const w = clientToWorld(e.clientX, e.clientY)
  const node = ctx.renderer?.pickNode(w.x, w.y, hitRadius())
  if (node && !store.lockNodes) {
    drag = { node, moved: false, downX: e.clientX, downY: e.clientY }
    grab = { dx: w.x - node.x, dy: w.y - node.y }
    try {
      overlayEl.value.setPointerCapture(e.pointerId)
    } catch {}
    const m = currentMode.value
    if (m === 'auto') {
      ctx.simulation.alphaTarget(0.3).restart()
      node.fx = node.x
      node.fy = node.y
    } else if (m === 'custom') {
      node.fx = node.x
      node.fy = node.y
    } else if (m === 'age') {
      node.fx = node.x
    } else if (m === 'generation') {
      node.fx = node.x
      node.fy = node.y
      removeGenPreview(ctx)
    }
  } else {
    pending = { downX: e.clientX, downY: e.clientY, moved: false }
  }
}

function onPointerMove(e) {
  if (drag) {
    if (!drag.moved && Math.hypot(e.clientX - drag.downX, e.clientY - drag.downY) > 3)
      drag.moved = true
    const w = clientToWorld(e.clientX, e.clientY)
    const tx = w.x - grab.dx,
      ty = w.y - grab.dy
    const d = drag.node,
      m = currentMode.value
    if (m === 'auto') {
      d.fx = tx
      d.fy = ty
    } else if (m === 'custom') {
      d.x = tx
      d.y = ty
      d.fx = tx
      d.fy = ty
      ticked()
    } else if (m === 'age') {
      d.x = tx
      d.fx = tx
      ticked()
    } else if (m === 'generation') {
      d.x = tx
      d.y = ty
      d.fx = tx
      d.fy = ty
      ticked()
      updateGenPreview(d.y, ctx)
    }
  } else if (pending) {
    if (Math.hypot(e.clientX - pending.downX, e.clientY - pending.downY) > 3) pending.moved = true
  }
}

function onPointerUp(_e) {
  if (drag) {
    const d = drag.node,
      m = currentMode.value
    if (m === 'auto') {
      ctx.simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    } else if (m === 'custom') {
      snapshotMode('custom')
    } else if (m === 'age') {
      snapshotMode('age')
    } else if (m === 'generation') {
      removeGenPreview(ctx)
      const ty = resolveGenTarget(d.y, ctx)
      d.fx = d.x
      d.fy = ty
      d.y = ty
      ticked()
      cleanupEmptyGenRows(ctx, snapshotGenMode, ticked)
    }
    ctx.renderer.invalidatePicker()
    drag = null
    return
  }
  // Click (press with no meaningful movement) → select node / open rel popup / deselect.
  if (pending && !pending.moved) {
    const w = clientToWorld(pending.downX, pending.downY)
    const node = ctx.renderer?.pickNode(w.x, w.y, hitRadius())
    if (node) {
      if (!store.lockNodes) {
        store.relPopup = null
        store.selectPerson(node.id)
      }
    } else {
      const link = store.lockLines ? null : ctx.renderer?.pickLink(w.x, w.y, store.graphSettings)
      if (link) {
        const rect = ctx.containerRef.getBoundingClientRect()
        store.relPopup = {
          rel: link,
          x: pending.downX - rect.left,
          y: pending.downY - rect.top - 10
        }
      } else {
        store.selectPerson(null)
        store.relPopup = null
      }
    }
  }
  pending = null
}

// ── Drag-to-place from the Directory tab ────────────────────────────────────
// Dropping a person from the right dock's roster moves their node to the drop
// point and snapshots it into the active scene (which autosaves).
function onDirectoryDragOver(e) {
  if (store.draggingPersonId) e.dataTransfer.dropEffect = 'move'
}

function onDirectoryDrop(e) {
  const pid = store.draggingPersonId || e.dataTransfer.getData('text/plain')
  if (!pid) return
  const node = ctx.nodesData.find((n) => n.id === pid)
  if (!node) return
  const w = clientToWorld(e.clientX, e.clientY)
  const m = currentMode.value
  node.x = w.x
  node.fx = w.x
  if (m !== 'age') node.y = w.y // Birth layout keeps Y locked to the year axis
  if (m === 'auto') {
    // Organic: seed the position and let the simulation settle around it
    node.fx = null
    node.fy = null
    node.vx = 0
    node.vy = 0
    ctx.simulation.alpha(0.1).restart()
  } else if (m !== 'age') {
    node.fy = w.y
  }
  ticked()
  ctx.renderer?.invalidatePicker()
  saveCurrentState()
}

// Hover glow (only meaningful when not dragging).
function onHoverMove(e) {
  if (drag) return
  const w = clientToWorld(e.clientX, e.clientY)
  const node = ctx.renderer?.pickNode(w.x, w.y, hitRadius())
  const id = node ? node.id : null
  if (id !== hoverId) {
    hoverId = id
    markNodeStyles()
  }
}

// Positions/handlers are global now; kept as a no-op hook so mode-enter code is unchanged.
function reapplyDrag() {
  ctx.renderer?.invalidatePicker()
}

// ── Type switching ──────────────────────────────────────────────────────────
// The layout type is a property of the scene: picking a different type
// retypes the ACTIVE scene and re-runs that type's layout math over the same
// arrangement (scene switching is what changes positions).
function switchMode(newMode) {
  if (newMode === currentMode.value) return
  const scene = activeScene.value
  if (!scene) return
  cancelAnimation()
  if (ctx.nodesData.length) saveCurrentState()
  removeGuides(ctx)

  const type = MODE_TO_TYPE[newMode]
  scene.type = type // optimistic — currentMode flips immediately
  store.saveScene({ id: scene.id, type })

  if (!ctx.nodesData.length) return
  ctx.activeSnapshot =
    workingOf(scene.id) && Object.keys(workingOf(scene.id).positions).length
      ? workingOf(scene.id).positions
      : null

  if (newMode === 'auto') enterAutoMode()
  else if (newMode === 'custom') enterCustomMode()
  else if (newMode === 'age') enterAgeMode()
  else if (newMode === 'generation') enterGenerationMode()

  applyEmphasis()
}

function enterAutoMode() {
  ctx.simulation.stop()
  removeCurrentYearLine(ctx)
  if (hasSnapshot()) {
    animateToPositionsWithReset(ctx.activeSnapshot, () => {
      ctx.nodesData.forEach((n) => {
        n.fx = null
        n.fy = null
        n.vx = 0
        n.vy = 0
      })
      ctx.simulation.alpha(0.15).restart()
      reapplyDrag()
    })
  } else {
    ctx.nodesData.forEach((n) => {
      n.fx = null
      n.fy = null
    })
    ctx.simulation.alpha(0.3).restart()
    reapplyDrag()
  }
}

function enterCustomMode() {
  ctx.simulation.stop()
  removeCurrentYearLine(ctx)
  if (hasSnapshot()) {
    animateToPositionsWithReset(ctx.activeSnapshot, () => {
      ctx.nodesData.forEach((n) => {
        n.fx = n.x
        n.fy = n.y
      })
      reapplyDrag()
    })
  } else {
    ctx.nodesData.forEach((n) => {
      n.fx = n.x
      n.fy = n.y
    })
    snapshotMode()
    reapplyDrag()
  }
}

function enterAgeMode() {
  ctx.simulation.stop()
  const container = ctx.containerRef
  if (!container) return
  const { width, height } = container.getBoundingClientRect()
  const ageInfo = computeAgeYPositions(ctx.nodesData, height)

  if (hasSnapshot()) {
    const snap = ctx.activeSnapshot,
      targets = {}
    ctx.nodesData.forEach((n) => {
      targets[n.id] = { x: snap[n.id]?.x ?? n.x, y: ageInfo.yMap[n.id] }
    })
    animateToPositionsWithReset(targets, () => {
      ctx.nodesData.forEach((n) => {
        n.fx = n.x
        n.fy = ageInfo.yMap[n.id]
      })
      drawYearGuides(ctx, ageInfo.minYear, ageInfo.maxYear, ageInfo.padding, ageInfo.usableHeight)
      drawCurrentYearLine(ctx, ageInfo, store.currentDate?.year ?? null, false)
      reapplyDrag()
    })
    return
  }

  // Fresh Birth layout for a scene with no positions yet: band by year and
  // order by the nodes' current x (there is no cross-scene snapshot to seed
  // from — a scene owns exactly one arrangement).
  const customSnap = null,
    byYear = {},
    targets = {}
  ctx.nodesData.forEach((n) => {
    const y = n.birth?.year || ageInfo.maxYear
    if (!byYear[y]) byYear[y] = []
    byYear[y].push(n)
  })
  const bands = [],
    sortedYears = Object.keys(byYear)
      .map(Number)
      .sort((a, b) => a - b)
  sortedYears.forEach((yr) => {
    const lb = bands[bands.length - 1]
    if (lb && yr - lb.maxYear <= 3) {
      lb.maxYear = yr
      lb.nodes.push(...byYear[yr])
    } else bands.push({ minYear: yr, maxYear: yr, nodes: [...byYear[yr]] })
  })
  bands.forEach((b) =>
    b.nodes.sort((a, c) => (customSnap?.[a.id]?.x ?? a.x) - (customSnap?.[c.id]?.x ?? c.x))
  )

  ctx.nodesData.forEach((n) => {
    const yr = n.birth?.year || ageInfo.maxYear,
      ty = ageInfo.yMap[n.id]
    const band = bands.find((b) => yr >= b.minYear && yr <= b.maxYear),
      row = band ? band.nodes : [n]
    const idx = row.indexOf(n),
      cnt = row.length
    const sp = Math.max(80, Math.min(120, (width - 160) / Math.max(cnt, 1))),
      rw = (cnt - 1) * sp
    targets[n.id] = {
      x: customSnap?.[n.id] ? customSnap[n.id].x : (width - rw) / 2 + idx * sp,
      y: ty
    }
  })

  drawYearGuides(ctx, ageInfo.minYear, ageInfo.maxYear, ageInfo.padding, ageInfo.usableHeight)
  drawCurrentYearLine(ctx, ageInfo, store.currentDate?.year ?? null, false)
  animateToPositionsWithReset(targets, () => {
    ctx.nodesData.forEach((n) => {
      n.fx = n.x
      n.fy = ageInfo.yMap[n.id]
    })
    snapshotMode()
    reapplyDrag()
  })
}

// Re-position the Age-mode "current year" line (e.g. when the current year is set/changed/theme).
function refreshCurrentYearLine(animate) {
  if (currentMode.value !== 'age' || !ctx.renderer || !ctx.containerRef) return
  const { height } = ctx.containerRef.getBoundingClientRect()
  const ageInfo = computeAgeYPositions(ctx.nodesData, height)
  drawCurrentYearLine(ctx, ageInfo, store.currentDate?.year ?? null, animate)
}

function enterGenerationMode() {
  ctx.simulation.stop()
  removeCurrentYearLine(ctx)
  const container = ctx.containerRef
  if (!container) return
  const { width, height } = container.getBoundingClientRect()

  const w = workingOf(activeSceneId.value)
  if (hasSnapshot() && w?.config?.genRowYValues) {
    // Restore saved positions and saved row state exactly as they were
    const snap = ctx.activeSnapshot
    ctx.genRowYValues = [...w.config.genRowYValues]
    if (w.config.genRowSpacing) ctx.genRowSpacing = w.config.genRowSpacing

    const targets = {}
    ctx.nodesData.forEach((n) => {
      targets[n.id] = snap[n.id] ? { x: snap[n.id].x, y: snap[n.id].y } : { x: n.x, y: n.y }
    })

    // Build genInfo-like object for drawing guides from saved rows
    const savedGenInfo = {
      genLabels: ctx.genRowYValues.map((y, i) => ({ label: `Gen ${i + 1}`, y }))
    }
    animateToPositionsWithReset(targets, () => {
      ctx.nodesData.forEach((n) => {
        n.fx = n.x
        n.fy = n.y
      })
      drawGenGuides(ctx, savedGenInfo)
      reapplyDrag()
    })
    return
  }

  // First time: compute layout from relationships
  const genInfo = computeGenLayout(ctx.nodesData, store.relationships, width, height)

  // If no nodes or no generations computed, create default guide lines
  if (genInfo.genLabels.length === 0) {
    const defaultRows = 3
    const spacing = 140
    const totalH = (defaultRows - 1) * spacing
    const startY = (height - totalH) / 2
    for (let i = 0; i < defaultRows; i++) {
      genInfo.genLabels.push({ label: `Gen ${i + 1}`, y: startY + i * spacing })
    }
    genInfo.rowHeight = spacing
  }

  ctx.genRowYValues = genInfo.genLabels.map((g) => g.y)
  ctx.genRowSpacing = genInfo.rowHeight || 140

  drawGenGuides(ctx, genInfo)
  if (ctx.nodesData.length === 0) {
    snapshotGenMode()
    reapplyDrag()
  } else {
    animateToPositionsWithReset(genInfo.targets, () => {
      ctx.nodesData.forEach((n) => {
        n.fx = n.x
        n.fy = genInfo.targets[n.id]?.y ?? n.y
      })
      snapshotGenMode()
      reapplyDrag()
    })
  }
}

// ── Refresh layout ──────────────────────────────────────────────────────────
// Re-runs the family-tree layout algorithm on the current data and animates the
// nodes into the fresh arrangement. Mode-aware: Generation rebuilds its rows,
// Age keeps the year axis and only re-orders horizontally, Auto uses the
// arrangement as a seed and lets the simulation relax from it.
const refreshSpinning = ref(false)
let refreshSpinTimer = null

function refreshLayout() {
  if (!ctx.nodesData.length || !ctx.containerRef) return
  cancelAnimation()
  ctx.simulation.stop()
  refreshSpinning.value = true
  if (refreshSpinTimer) clearTimeout(refreshSpinTimer)
  refreshSpinTimer = setTimeout(() => {
    refreshSpinning.value = false
    refreshSpinTimer = null
  }, 700)

  const { width, height } = ctx.containerRef.getBoundingClientRect()
  const mode = currentMode.value
  const genInfo = computeGenLayout(ctx.nodesData, store.relationships, width, height)

  if (mode === 'age') {
    const ageInfo = computeAgeYPositions(ctx.nodesData, height)
    const targets = {}
    ctx.nodesData.forEach((n) => {
      targets[n.id] = { x: genInfo.targets[n.id]?.x ?? n.x, y: ageInfo.yMap[n.id] }
    })
    animateToPositionsWithReset(targets, () => {
      ctx.nodesData.forEach((n) => {
        n.fx = n.x
        n.fy = ageInfo.yMap[n.id]
      })
      snapshotMode('age')
      reapplyDrag()
    })
  } else if (mode === 'generation') {
    removeGenPreview(ctx)
    ctx.genRowYValues = genInfo.genLabels.map((g) => g.y)
    ctx.genRowSpacing = genInfo.rowHeight || 140
    drawGenGuides(ctx, genInfo)
    animateToPositionsWithReset(genInfo.targets, () => {
      ctx.nodesData.forEach((n) => {
        n.fx = n.x
        n.fy = n.y
      })
      snapshotGenMode()
      reapplyDrag()
    })
  } else if (mode === 'auto') {
    animateToPositionsWithReset(genInfo.targets, () => {
      ctx.nodesData.forEach((n) => {
        n.fx = null
        n.fy = null
        n.vx = 0
        n.vy = 0
      })
      ctx.simulation.alpha(0.12).restart()
      reapplyDrag()
    })
  } else {
    animateToPositionsWithReset(genInfo.targets, () => {
      ctx.nodesData.forEach((n) => {
        n.fx = n.x
        n.fy = n.y
      })
      snapshotMode('custom')
      reapplyDrag()
    })
  }
}

// ── Emphasis ────────────────────────────────────────────────────────────────
// Lineage emphasis (paternal/maternal) only affects links + arrowheads, all computed in
// linkVisual(); switching it just re-syncs link styles and repaints.
function applyEmphasis() {
  markLinkStyles()
}

function cycleEmphasis(which) {
  // Clicking the same state again = no-op
  if (activeEmphasis.value === which) return
  activeEmphasis.value = which
  const w = workingOf(activeSceneId.value)
  if (w) w.config.emphasis = which
  applyEmphasis()
}

// ── Zoom / search ───────────────────────────────────────────────────────────
// These call the zoom behaviour on the overlay selection, so the 'zoom' handler drives the
// camera transform for us (with d3's transition for smooth zoom buttons / fit / reset).
function zoomIn() {
  ctx.zoomSelection?.transition().duration(300).call(ctx.zoomBehavior.scaleBy, 1.3)
}
function zoomOut() {
  ctx.zoomSelection?.transition().duration(300).call(ctx.zoomBehavior.scaleBy, 0.77)
}
function resetZoom() {
  if (!ctx.nodesData.length || !ctx.containerRef) {
    ctx.zoomSelection?.transition().duration(400).call(ctx.zoomBehavior.transform, d3.zoomIdentity)
    return
  }
  const { width, height } = ctx.containerRef.getBoundingClientRect()
  const xs = ctx.nodesData.map((d) => d.x),
    ys = ctx.nodesData.map((d) => d.y)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2,
    cy = (Math.min(...ys) + Math.max(...ys)) / 2
  ctx.zoomSelection
    ?.transition()
    .duration(400)
    .call(ctx.zoomBehavior.transform, d3.zoomIdentity.translate(width / 2 - cx, height / 2 - cy))
}
function fitAll() {
  if (!ctx.nodesData.length || !ctx.containerRef) return
  const { width, height } = ctx.containerRef.getBoundingClientRect()
  const xs = ctx.nodesData.map((d) => d.x),
    ys = ctx.nodesData.map((d) => d.y)
  const x0 = Math.min(...xs) - 60,
    x1 = Math.max(...xs) + 60,
    y0 = Math.min(...ys) - 60,
    y1 = Math.max(...ys) + 60
  const scale = Math.min((0.9 * width) / (x1 - x0), (0.9 * height) / (y1 - y0), 2)
  ctx.zoomSelection
    ?.transition()
    .duration(600)
    .call(
      ctx.zoomBehavior.transform,
      d3.zoomIdentity
        .translate(width / 2 - (scale * (x0 + x1)) / 2, height / 2 - (scale * (y0 + y1)) / 2)
        .scale(scale)
    )
}
function highlightSearch() {
  markNodeStyles()
}

// ── Lifecycle & watchers ────────────────────────────────────────────────────
// ── Save / restore (scenes are the source of truth) ─────────────────────────
// Flush the live arrangement to disk right now (checkpoint save, project
// switch, exit) — snapshots the current positions and writes every scene's
// working copy without waiting for the autosave debounce.
async function flushLayout() {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
    pendingPersistId = null
  }
  if (ctx.nodesData.length) saveCurrentState()
  for (const sceneId of working.keys()) {
    await persistScene(sceneId)
  }
}

// First entry after data loads: make sure the project has a graph scene, then
// enter the saved active one (restored from settings by the store).
async function initScenes() {
  if (!store.graphScenes.length) {
    await store.ensureScene('graph', 'State 1', { type: 'organic' })
  }
  if (!activeSceneId.value || !graphScenes.value.some((s) => s.id === activeSceneId.value)) {
    store.setActiveScene('graph', graphScenes.value[0]?.id ?? null)
  }
  if (activeSceneId.value) enterActiveScene()
}

// After a checkpoint revert the persisted scenes ARE the truth again — drop
// the working copies and re-enter the (re-validated) active scene.
async function reloadScenes() {
  cancelAnimation()
  working.clear()
  await initScenes()
}

defineExpose({ flushLayout, reloadScenes })

let scenesInitialized = false

onMounted(() => {
  initGraph()
  updateGraph()
})
onUnmounted(() => {
  ctx.simulation?.stop()
  ctx.resizeObserver?.disconnect()
  cancelAnimation()
  if (refreshSpinTimer) clearTimeout(refreshSpinTimer)
  if (persistTimer) {
    // flush the pending autosave (fire-and-forget — the component is going away)
    clearTimeout(persistTimer)
    persistScene(pendingPersistId)
    persistTimer = null
  }
  cancelGuideTimers(ctx)
  removePointerHandlers()
  ctx.renderer?.dispose()
})

watch(
  [() => store.persons, () => store.relationships],
  async () => {
    updateGraph()
    // Enter the saved active scene once after data first loads
    if (!scenesInitialized && store.persons.length > 0) {
      scenesInitialized = true
      await nextTick()
      await initScenes()
    }
  },
  { deep: true }
)
watch(
  () => store.selectedPersonId,
  () => markNodeStyles()
)
watch(
  () => store.lockNodes,
  () => reapplyDrag()
)
watch(
  () => store.currentDate,
  () => {
    if (!store.currentDate && activeDeceased.value !== 'normal') {
      activeDeceased.value = 'normal'
      applyDeceasedHighlight()
    }
    if (store.graphSettings.showAge) markNodeStyles()
    refreshCurrentYearLine(true)
  }
)
watch(
  () => store.theme,
  () => {
    if (!ctx.renderer) return
    ctx.renderer.setTheme(store.theme === 'light') // marks node+link dirty + redraws; overlay recolours
    refreshCurrentYearLine(false)
  }
)
watch(
  () => store.graphSettings,
  () => {
    if (!ctx.renderer || !ctx.simulation) return
    const gs = store.graphSettings
    if (currentMode.value === 'auto') {
      ctx.simulation.force('link').distance(gs.linkDistance)
      ctx.simulation.force('charge').strength(gs.chargeStrength)
      ctx.simulation.force('collide').radius(gs.nodeRadius + 30)
      ctx.simulation.alpha(0.2).restart()
    }
    markNodeStyles()
    markLinkStyles()
  },
  { deep: true }
)
</script>

<style scoped>
.graph-area {
  position: relative;
  background: var(--bg);
  overflow: hidden;
}
.graph-gl {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}
.graph-overlay {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}
.graph-search {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 7px 14px;
  min-width: 260px;
  z-index: 5;
  box-shadow: var(--shadow);
  transition:
    transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s ease;
}
.graph-search input {
  background: none;
  border: none;
  outline: none;
  font: inherit;
  font-size: 13px;
  color: var(--t1);
  flex: 1;
  padding: 0;
  box-shadow: none;
  width: auto;
}
.graph-search input::placeholder {
  color: var(--t3);
}
.search-icon {
  font-size: 13px;
  flex-shrink: 0;
}
.bottom-bars {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  align-items: flex-end;
  z-index: 5;
  transition:
    transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s ease;
}
.graph-controls {
  display: flex;
  gap: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 5px;
  box-shadow: var(--shadow);
}
.ctrl-btn {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--t2);
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s;
  font-family: var(--font);
}
.ctrl-btn:hover {
  background: var(--hover);
  color: var(--t1);
}
.ctrl-btn-wide {
  width: auto;
  padding: 0 10px;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  position: relative;
}
.ctrl-btn-active {
  background: var(--adim);
  color: var(--accent);
  border: 1px solid rgba(108, 142, 245, 0.3);
}
.ctrl-sep {
  width: 1px;
  background: var(--border);
  margin: 3px 2px;
}
.ctrl-btn-refresh .refresh-icon {
  display: inline-block;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.ctrl-btn-refresh:hover .refresh-icon {
  transform: rotate(45deg);
}
.ctrl-btn-refreshing .refresh-icon {
  animation: refresh-spin 0.65s cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes refresh-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.graph-legend {
  position: absolute;
  bottom: 18px;
  right: 16px;
  background: var(--glass-soft);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 11px;
  color: var(--t2);
  z-index: 5;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 140px;
}
.panel-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--t3);
}
.leg-section {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.leg-section-label {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--t3);
  opacity: 0.7;
}
.leg-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}
.leg-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.leg-line {
  width: 22px;
  height: 2px;
  flex-shrink: 0;
  border-radius: 1px;
}
.leg-dashed {
  height: 0;
  border-top: 2px dashed;
  background: none !important;
}
.ctrl-btn-lock {
  background: rgba(239, 83, 80, 0.15);
  color: #ef5350;
}
.rel-popup {
  position: absolute;
  z-index: 20;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 18px;
  min-width: 180px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
  transform: translateX(-50%) translateY(-100%);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rel-popup-close {
  position: absolute;
  top: 6px;
  right: 8px;
  width: 22px;
  height: 22px;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: var(--t3);
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rel-popup-close:hover {
  background: var(--hover);
  color: var(--t1);
}
.rel-popup-type {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--accent);
}
.rel-popup-people {
  font-size: 13px;
  font-weight: 600;
  color: var(--t1);
}
.rel-popup-date {
  font-size: 12px;
  color: var(--t2);
}
.rel-popup-status.divorced {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #ef5350;
  background: rgba(239, 83, 80, 0.12);
  padding: 2px 8px;
  border-radius: 6px;
  align-self: flex-start;
}
.relpop-enter-active {
  transition:
    opacity 0.18s ease,
    transform 0.22s cubic-bezier(0.34, 1.3, 0.64, 1);
}
.relpop-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}
.relpop-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-90%) scale(0.92);
}
.relpop-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-100%) scale(0.95);
}

/* Scene tab strip inside the floating bottom bar: restyle the shared banner
   component into the old states-bar pill */
.graph-scene-tabs {
  border-top: none;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow);
  padding: 4px 10px;
  min-height: 0;
  backdrop-filter: none;
}

/* Clean tree — slide panels out */
.clean-restore {
  position: absolute;
  bottom: 18px;
  right: 16px;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--accent);
  font-size: 15px;
  cursor: pointer;
  z-index: 6;
  box-shadow: var(--shadow);
}

.clean-hide-up {
  transform: translateX(-50%) translateY(calc(-100% - 30px));
  opacity: 0;
  pointer-events: none;
}
.bottom-bars.clean-hide-down {
  transform: translateX(-50%) translateY(calc(100% + 30px));
  opacity: 0;
  pointer-events: none;
}
.clean-hide-right {
  transform: translateX(calc(100% + 30px));
  opacity: 0;
  pointer-events: none;
}

/* Highlights panel */
.highlights-panel {
  position: absolute;
  top: 14px;
  right: 16px;
  background: var(--glass-strong);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 16px;
  z-index: 5;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 220px;
  transition:
    transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s ease;
}

.highlights-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--t3);
}

.highlight-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.highlight-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--t2);
  min-width: 52px;
  flex-shrink: 0;
}

/* Segmented slider */
.seg-slider {
  position: relative;
  display: flex;
  flex: 1;
  background: var(--elevated);
  border-radius: 8px;
  padding: 2px;
  gap: 0;
}

.seg-track {
  position: absolute;
  inset: 2px;
  pointer-events: none;
}

.seg-thumb {
  position: absolute;
  top: 0;
  bottom: 0;
  width: calc(100% / 3);
  background: var(--accent);
  border-radius: 6px;
  opacity: 0.18;
  transition:
    left 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.25s;
}

.seg-pos-0 {
  left: 0;
}
.seg-pos-1 {
  left: calc(100% / 3);
  background: #4a90d9;
}
.seg-pos-2 {
  left: calc(200% / 3);
  background: #d94a8a;
}

.seg-thumb-gender.seg-pos-0 {
  background: var(--accent);
}
.seg-thumb-gender.seg-pos-1 {
  background: #3a7bd5;
}
.seg-thumb-gender.seg-pos-2 {
  background: #c95fa0;
}

.seg-thumb-couples {
  width: calc(100% / 4);
}
.seg-thumb-couples.seg-pos-0 {
  left: 0;
  background: var(--accent);
}
.seg-thumb-couples.seg-pos-1 {
  left: calc(100% / 4);
  background: #f06292;
}
.seg-thumb-couples.seg-pos-2 {
  left: calc(200% / 4);
  background: #ef5350;
}
.seg-thumb-couples.seg-pos-3 {
  left: calc(300% / 4);
  background: #78909c;
}

.seg-thumb-deceased.seg-pos-0 {
  background: var(--accent);
}
.seg-thumb-deceased.seg-pos-1 {
  background: #78909c;
}
.seg-thumb-deceased.seg-pos-2 {
  background: #4caf72;
}

.highlight-divider {
  height: 1px;
  background: var(--border);
  margin: 2px 0;
}

.highlight-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.highlight-disabled .highlight-label {
  cursor: not-allowed;
}

.seg-disabled {
  pointer-events: none;
  opacity: 0.5;
}

.seg-disabled .seg-option {
  cursor: not-allowed;
}

.seg-option {
  flex: 1;
  padding: 5px 12px;
  border: none;
  background: transparent;
  font-family: var(--font);
  font-size: 11px;
  font-weight: 500;
  color: var(--t3);
  cursor: pointer;
  text-align: center;
  position: relative;
  z-index: 1;
  border-radius: 6px;
  transition: color 0.2s;
}

.seg-option:hover {
  color: var(--t1);
}

.seg-option.seg-active {
  color: var(--t1);
  font-weight: 700;
}
</style>
