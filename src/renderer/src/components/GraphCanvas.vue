<template>
  <div ref="containerEl" class="graph-area">
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
      </div>
      <div class="states-bar">
        <template v-for="(name, i) in currentModeStates" :key="i">
          <input
            v-if="renamingState && renamingState.idx === i && renamingState.mode === currentMode"
            v-model="renameInput"
            class="state-rename-input"
            @keydown.enter="confirmRename"
            @keydown.escape="cancelRename"
            @blur="confirmRename"
          />
          <div v-else class="state-btn-wrap">
            <button
              class="state-btn"
              :class="{ 'state-btn-active': currentStateIndex === i }"
              @click="switchState(i)"
            >
              {{ name }}
            </button>
            <button class="state-menu-dot" @click.stop="openStateMenu($event, i)">⋯</button>
          </div>
        </template>
        <button class="state-btn state-btn-add" title="New state" @click="addState">＋</button>
      </div>
    </div>
    <!-- State context menu -->
    <Transition name="ctx-menu">
      <div v-if="stateMenu" class="state-context-menu" :style="stateMenuStyle" @click.stop>
        <button class="ctx-menu-item" @click="startRenameFromMenu">
          <span class="ctx-menu-icon">✏</span> Rename
        </button>
        <button class="ctx-menu-item" @click="duplicateStateFromMenu">
          <span class="ctx-menu-icon">⧉</span> Duplicate
        </button>
        <button
          v-if="currentModeStates.length > 1"
          class="ctx-menu-item ctx-menu-danger"
          @click="deleteStateFromMenu"
        >
          <span class="ctx-menu-icon">✕</span> Delete
        </button>
      </div>
    </Transition>
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
    <!-- Highlights panel -->
    <div class="highlights-panel" :class="{ 'clean-hide-right': store.cleanTree }">
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

    <div class="graph-legend">
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
import { ref, reactive, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import * as d3 from 'd3'
import { useMainStore } from '../store/index.js'
import {
  nodeColor,
  getLinkStroke,
  getLinkWidth,
  getLinkEmphOpacity,
  getLinkMarker,
  getDashArray
} from './graph/linkHelpers.js'
import { computeAgeYPositions } from './graph/layoutAge.js'
import { computeGenLayout } from './graph/layoutGeneration.js'
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

const store = useMainStore()
const glCanvasEl = ref(null)
const overlayEl = ref(null)
const containerEl = ref(null)
const searchQuery = ref('')
const currentMode = ref('auto')
const activeEmphasis = ref('neutral')

const modes = [
  { id: 'custom', label: '✋ Custom', title: 'Freely position nodes' },
  { id: 'auto', label: '⚡ Auto', title: 'Force-directed layout' },
  { id: 'age', label: '📅 Age', title: 'Sort by birth year' },
  { id: 'generation', label: '🏛 Gen', title: 'Generational layout' }
]

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
  modeSnapshots: { custom: null, auto: null, age: null, generation: null },
  containerRef: null, // set in onMounted
  ticked: null, // set below
  requestRedraw: null
}
let hoverId = null // node currently hovered (for glow)
let couplesHiSet = null // ids highlighted by the Marriage filter, or null

const modeEmphasis = { custom: 'neutral', auto: 'neutral', age: 'neutral', generation: 'neutral' }

const { cancelAnimation, animateToPositionsWithReset } = useGraphAnimation(ctx)

// ── Per-mode multi-state system ─────────────────────────────────────────────
// Each mode has an array of states (snapshots) the user can create and switch between
const modeStateNames = reactive({
  custom: ['State 1'],
  auto: ['State 1'],
  age: ['State 1'],
  generation: ['State 1']
})
const modeActiveStateIdx = reactive({
  custom: 0,
  auto: 0,
  age: 0,
  generation: 0
})
// Snapshots: modeStateSnapshots[mode][stateIdx] = { id: {x,y}, ... } or null
const modeStateSnapshots = reactive({
  custom: [null],
  auto: [null],
  age: [null],
  generation: [null]
})

const currentModeStates = computed(() => modeStateNames[currentMode.value])
const currentStateIndex = computed(() => modeActiveStateIdx[currentMode.value])

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
  return person.death_year && person.death_year <= store.currentDate.year
}

function isLiving(person) {
  if (!store.currentDate) return true
  return !person.death_year || person.death_year > store.currentDate.year
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
  if (r.formed_date)
    return r.type === 'spouse' ? `Married: ${r.formed_date}` : `Since: ${r.formed_date}`
  if (r.type === 'parent_child') {
    const child = store.persons.find((x) => x.id === r.person_b_id)
    if (child?.birth_year) return `Born: ${child.birth_year}`
  }
  return ''
})
const relPopupStatus = computed(() =>
  store.relPopup?.rel?.status === 'divorced' ? 'divorced' : ''
)

// ── Snapshot helpers ────────────────────────────────────────────────────────
function snapshotMode(mode) {
  const snap = {}
  ctx.nodesData.forEach((n) => {
    snap[n.id] = { x: n.x, y: n.y }
  })
  const idx = modeActiveStateIdx[mode]
  modeStateSnapshots[mode][idx] = snap
  ctx.modeSnapshots[mode] = snap
  store.markGraphDirty()
}
function hasSnapshot(mode) {
  return ctx.modeSnapshots[mode] && Object.keys(ctx.modeSnapshots[mode]).length > 0
}

function saveCurrentState() {
  const mode = currentMode.value
  if (mode === 'generation') snapshotGenMode()
  else snapshotMode(mode)
}

function switchState(idx) {
  const mode = currentMode.value
  if (idx === modeActiveStateIdx[mode]) return
  cancelAnimation()

  // Save current state
  saveCurrentState()

  // Switch to new state
  modeActiveStateIdx[mode] = idx
  const snap = modeStateSnapshots[mode][idx]
  ctx.modeSnapshots[mode] = snap

  // Re-enter mode to load the new state's snapshot
  removeGuides(ctx)
  if (mode === 'auto') enterAutoMode()
  else if (mode === 'custom') enterCustomMode()
  else if (mode === 'age') enterAgeMode()
  else if (mode === 'generation') enterGenerationMode()
  applyEmphasis()
}

function addState() {
  const mode = currentMode.value

  // Save current state first
  saveCurrentState()

  // Create new state (copy current positions as starting point)
  const newIdx = modeStateNames[mode].length
  modeStateNames[mode].push(`State ${newIdx + 1}`)
  const snap = {}
  ctx.nodesData.forEach((n) => {
    snap[n.id] = { x: n.x, y: n.y }
  })

  // For generation mode, also copy row state
  if (mode === 'generation') {
    snap._genRowYValues = [...ctx.genRowYValues]
    snap._genRowSpacing = ctx.genRowSpacing
  }

  modeStateSnapshots[mode].push(snap)
  modeActiveStateIdx[mode] = newIdx
  ctx.modeSnapshots[mode] = snap
}

const renamingState = ref(null) // { mode, idx }
const renameInput = ref('')
const stateMenu = ref(null) // { idx, x, y }
const stateMenuStyle = computed(() => {
  if (!stateMenu.value) return {}
  return { left: stateMenu.value.x + 'px', top: stateMenu.value.y + 'px' }
})

let closeMenuListener = null

function openStateMenu(event, idx) {
  event.stopPropagation()
  // Remove old listener if any
  if (closeMenuListener) {
    document.removeEventListener('mousedown', closeMenuListener, true)
    closeMenuListener = null
  }

  const container = containerEl.value
  if (!container) return
  const rect = container.getBoundingClientRect()

  // Position menu above the click point
  stateMenu.value = {
    idx,
    x: event.clientX - rect.left,
    y: event.clientY - rect.top - 120
  }

  // Close on mousedown outside the menu (delayed 2 frames to skip current event)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      closeMenuListener = (e) => {
        // Don't close if clicking inside the menu
        const menuEl = document.querySelector('.state-context-menu')
        if (menuEl && menuEl.contains(e.target)) return
        stateMenu.value = null
        document.removeEventListener('mousedown', closeMenuListener, true)
        closeMenuListener = null
      }
      document.addEventListener('mousedown', closeMenuListener, true)
    })
  })
}

function closeMenu() {
  stateMenu.value = null
  if (closeMenuListener) {
    document.removeEventListener('mousedown', closeMenuListener, true)
    closeMenuListener = null
  }
}

function startRenameFromMenu() {
  const idx = stateMenu.value?.idx
  const mode = currentMode.value
  closeMenu()
  if (idx === undefined) return
  renameInput.value = modeStateNames[mode][idx]
  renamingState.value = { mode, idx }
  nextTick(() => {
    const el = document.querySelector('.state-rename-input')
    if (el) {
      el.focus()
      el.select()
    }
  })
}

function duplicateStateFromMenu() {
  const idx = stateMenu.value?.idx
  const mode = currentMode.value
  closeMenu()
  if (idx === undefined) return
  saveCurrentState()
  const srcSnap = modeStateSnapshots[mode][idx]
  const newSnap = srcSnap ? JSON.parse(JSON.stringify(srcSnap)) : null
  const newIdx = modeStateNames[mode].length
  modeStateNames[mode].push(modeStateNames[mode][idx] + ' copy')
  modeStateSnapshots[mode].push(newSnap)
  modeActiveStateIdx[mode] = newIdx
  ctx.modeSnapshots[mode] = newSnap
}

function deleteStateFromMenu() {
  const idx = stateMenu.value?.idx
  closeMenu()
  if (idx === undefined) return
  const mode = currentMode.value
  if (modeStateNames[mode].length <= 1) return

  const wasActive = modeActiveStateIdx[mode] === idx

  modeStateNames[mode].splice(idx, 1)
  modeStateSnapshots[mode].splice(idx, 1)

  // Adjust active index
  let newActive = modeActiveStateIdx[mode]
  if (wasActive) {
    // Deleted the active state — switch to nearest
    newActive = Math.min(idx, modeStateNames[mode].length - 1)
  } else if (idx < newActive) {
    // Deleted before the active — shift index down
    newActive--
  }
  modeActiveStateIdx[mode] = newActive
  ctx.modeSnapshots[mode] = modeStateSnapshots[mode][newActive] || null

  // Reload if the active state was deleted
  if (wasActive) {
    removeGuides(ctx)
    if (mode === 'auto') enterAutoMode()
    else if (mode === 'custom') enterCustomMode()
    else if (mode === 'age') enterAgeMode()
    else if (mode === 'generation') enterGenerationMode()
    applyEmphasis()
  }
  store.markGraphDirty()
}

function confirmRename() {
  if (!renamingState.value) return
  const { mode, idx } = renamingState.value
  const val = renameInput.value.trim()
  if (val) modeStateNames[mode].splice(idx, 1, val)
  renamingState.value = null
}

function cancelRename() {
  renamingState.value = null
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
  return window.electronAPI?.getImageUrl?.(filePath) || null
}

// Age in years: counted to the current date (or today if none set), capped at death year.
function ageOf(d) {
  if (!d.birth_year) return null
  const refYear = store.currentDate?.year ?? new Date().getFullYear()
  const endYear = d.death_year ? Math.min(d.death_year, refYear) : refYear
  const age = endYear - d.birth_year
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

// ── Mode switching ──────────────────────────────────────────────────────────
function switchMode(newMode) {
  if (newMode === currentMode.value) return
  cancelAnimation()
  if (!ctx.nodesData.length) {
    currentMode.value = newMode
    return
  }

  const oldMode = currentMode.value
  saveCurrentState()
  removeGuides(ctx)
  modeEmphasis[oldMode] = activeEmphasis.value
  currentMode.value = newMode
  activeEmphasis.value = modeEmphasis[newMode] || 'neutral'

  // Restore the new mode's active state snapshot
  const newIdx = modeActiveStateIdx[newMode]
  ctx.modeSnapshots[newMode] = modeStateSnapshots[newMode][newIdx] || null

  if (newMode === 'auto') enterAutoMode()
  else if (newMode === 'custom') enterCustomMode()
  else if (newMode === 'age') enterAgeMode()
  else if (newMode === 'generation') enterGenerationMode()

  applyEmphasis()
}

function enterAutoMode() {
  ctx.simulation.stop()
  removeCurrentYearLine(ctx)
  if (hasSnapshot('auto')) {
    animateToPositionsWithReset(ctx.modeSnapshots['auto'], () => {
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
  if (hasSnapshot('custom')) {
    animateToPositionsWithReset(ctx.modeSnapshots['custom'], () => {
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
    snapshotMode('custom')
    reapplyDrag()
  }
}

function enterAgeMode() {
  ctx.simulation.stop()
  const container = ctx.containerRef
  if (!container) return
  const { width, height } = container.getBoundingClientRect()
  const ageInfo = computeAgeYPositions(ctx.nodesData, height)

  if (hasSnapshot('age')) {
    const snap = ctx.modeSnapshots['age'],
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

  const customSnap = ctx.modeSnapshots['custom'],
    byYear = {},
    targets = {}
  ctx.nodesData.forEach((n) => {
    const y = n.birth_year || ageInfo.maxYear
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
    const yr = n.birth_year || ageInfo.maxYear,
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
    snapshotMode('age')
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

  if (hasSnapshot('generation')) {
    // Restore saved positions and saved row state exactly as they were
    const snap = ctx.modeSnapshots['generation']
    if (snap._genRowYValues) ctx.genRowYValues = [...snap._genRowYValues]
    if (snap._genRowSpacing) ctx.genRowSpacing = snap._genRowSpacing

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

// Save generation snapshot including row state
function snapshotGenMode() {
  const snap = {}
  ctx.nodesData.forEach((n) => {
    snap[n.id] = { x: n.x, y: n.y }
  })
  snap._genRowYValues = [...ctx.genRowYValues]
  snap._genRowSpacing = ctx.genRowSpacing
  const idx = modeActiveStateIdx['generation']
  modeStateSnapshots['generation'][idx] = snap
  ctx.modeSnapshots['generation'] = snap
  store.markGraphDirty()
}

// ── Emphasis ────────────────────────────────────────────────────────────────
// Lineage emphasis (paternal/maternal) only affects links + arrowheads, all computed in
// linkVisual(); switching it just re-syncs link styles and repaints.
function applyEmphasis() {
  markLinkStyles()
}

function cycleEmphasis(which) {
  const mode = currentMode.value
  // Clicking the same state again = no-op
  if (activeEmphasis.value === which) return
  activeEmphasis.value = which
  modeEmphasis[mode] = which
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
// ── Save / Load graph layout ────────────────────────────────────────────────
function collectGraphState() {
  // Save current state before collecting
  saveCurrentState()
  return {
    currentMode: currentMode.value,
    activeEmphasis: activeEmphasis.value,
    modeEmphasis: { ...modeEmphasis },
    modeStateNames: JSON.parse(JSON.stringify(modeStateNames)),
    modeActiveStateIdx: { ...modeActiveStateIdx },
    modeStateSnapshots: JSON.parse(JSON.stringify(modeStateSnapshots)),
    genRowSpacing: ctx.genRowSpacing,
    userCurrentYear: store.userCurrentYear
  }
}

function restoreGraphState(state) {
  if (!state) return
  // Restore the saved current-year override (undefined in older saves → auto).
  store.userCurrentYear = state.userCurrentYear ?? null
  // Restore mode state names and snapshots
  for (const mode of ['custom', 'auto', 'age', 'generation']) {
    if (state.modeStateNames?.[mode]) modeStateNames[mode] = state.modeStateNames[mode]
    if (state.modeActiveStateIdx?.[mode] !== undefined)
      modeActiveStateIdx[mode] = state.modeActiveStateIdx[mode]
    if (state.modeStateSnapshots?.[mode]) modeStateSnapshots[mode] = state.modeStateSnapshots[mode]
    if (state.modeEmphasis?.[mode]) modeEmphasis[mode] = state.modeEmphasis[mode]
    // Restore the active snapshot for each mode
    const idx = modeActiveStateIdx[mode]
    ctx.modeSnapshots[mode] = modeStateSnapshots[mode]?.[idx] || null
  }

  // Restore genRowSpacing fallback; genRowYValues come from the active gen state snapshot
  if (state.genRowSpacing) ctx.genRowSpacing = state.genRowSpacing

  // Restore gen row state from the active generation snapshot
  const genIdx = modeActiveStateIdx['generation']
  const genSnap = modeStateSnapshots['generation']?.[genIdx]
  if (genSnap?._genRowYValues) ctx.genRowYValues = [...genSnap._genRowYValues]
  if (genSnap?._genRowSpacing) ctx.genRowSpacing = genSnap._genRowSpacing

  if (state.activeEmphasis) activeEmphasis.value = state.activeEmphasis
  if (state.currentMode) {
    currentMode.value = state.currentMode
    // Enter the saved mode
    removeGuides(ctx)
    if (state.currentMode === 'auto') enterAutoMode()
    else if (state.currentMode === 'custom') enterCustomMode()
    else if (state.currentMode === 'age') enterAgeMode()
    else if (state.currentMode === 'generation') enterGenerationMode()
    applyEmphasis()
  }
}

async function saveGraphLayout() {
  const state = collectGraphState()
  await store.saveGraphState(state)
}

async function loadSavedGraphState() {
  const state = await store.loadGraphState()
  if (state) restoreGraphState(state)
}

defineExpose({ saveGraphLayout, collectGraphState })

let graphStateRestored = false

onMounted(() => {
  initGraph()
  updateGraph()
})
onUnmounted(() => {
  ctx.simulation?.stop()
  ctx.resizeObserver?.disconnect()
  cancelAnimation()
  cancelGuideTimers(ctx)
  removePointerHandlers()
  ctx.renderer?.dispose()
})

watch(
  [() => store.persons, () => store.relationships],
  async () => {
    updateGraph()
    // Restore saved graph state once after data first loads
    if (!graphStateRestored && store.persons.length > 0) {
      graphStateRestored = true
      await nextTick()
      await loadSavedGraphState()
      store.clearGraphDirty()
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

/* Clean tree — slide panels out */
.states-bar {
  display: flex;
  gap: 3px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 4px;
  box-shadow: var(--shadow);
}

.state-btn {
  padding: 5px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--t3);
  font-family: var(--font);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
  white-space: nowrap;
}

.state-btn:hover {
  background: var(--hover);
  color: var(--t1);
}

.state-btn-active {
  background: var(--adim);
  color: var(--accent);
  font-weight: 700;
}

.state-btn-add {
  color: var(--t3);
  font-size: 14px;
  padding: 4px 10px;
  font-weight: 600;
}

.state-btn-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.state-menu-dot {
  position: absolute;
  right: -2px;
  top: -6px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: none;
  background: var(--surface);
  color: var(--t3);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition:
    opacity 0.15s,
    background 0.12s,
    color 0.12s;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  z-index: 2;
  line-height: 1;
  padding: 0;
}

.state-btn-wrap:hover .state-menu-dot {
  opacity: 1;
}

.state-menu-dot:hover {
  background: var(--hover);
  color: var(--t1);
}

.state-btn-add:hover {
  color: var(--accent);
  background: var(--adim);
}

/* State context menu */
.state-context-menu {
  position: absolute;
  z-index: 100;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 4px;
  min-width: 130px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  transform-origin: top left;
}

.ctx-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border: none;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 7px;
  transition:
    background 0.1s,
    color 0.1s;
  text-align: left;
}

.ctx-menu-item:hover {
  background: var(--hover);
  color: var(--t1);
}

.ctx-menu-icon {
  font-size: 12px;
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}

.ctx-menu-danger:hover {
  background: rgba(239, 83, 80, 0.12);
  color: #ef5350;
}

.ctx-menu-enter-active {
  transition:
    opacity 0.15s ease,
    transform 0.18s cubic-bezier(0.34, 1.4, 0.64, 1);
}
.ctx-menu-leave-active {
  transition:
    opacity 0.1s ease,
    transform 0.1s ease;
}
.ctx-menu-enter-from {
  opacity: 0;
  transform: scale(0.9);
}
.ctx-menu-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.state-rename-input {
  width: 80px;
  padding: 4px 8px;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 11px;
  font-weight: 600;
  outline: none;
  box-shadow: 0 0 0 2px rgba(108, 142, 245, 0.2);
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
