<template>
  <div class="graph-area" ref="containerEl">
    <svg ref="svgEl" class="graph-svg"></svg>
    <div class="graph-search" :class="{ 'clean-hide-up': store.cleanTree }">
      <span class="search-icon">🔍</span>
      <input v-model="searchQuery" placeholder="Search family members…" @input="highlightSearch" />
    </div>
    <div class="bottom-bars" :class="{ 'clean-hide-down': store.cleanTree }">
      <div class="graph-controls">
        <button class="ctrl-btn" @click="zoomIn" title="Zoom in">＋</button>
        <button class="ctrl-btn" @click="zoomOut" title="Zoom out">－</button>
        <div class="ctrl-sep"></div>
        <button class="ctrl-btn" @click="fitAll" title="Fit all">⊡</button>
        <button class="ctrl-btn" @click="resetZoom" title="Reset view">⊕</button>
        <div class="ctrl-sep"></div>
        <button
          v-for="m in modes"
          :key="m.id"
          class="ctrl-btn ctrl-btn-wide"
          :class="{ 'ctrl-btn-active': currentMode === m.id }"
          @click="switchMode(m.id)"
          :title="m.title"
        >{{ m.label }}</button>
        <div class="ctrl-sep"></div>
        <button class="ctrl-btn" :class="{ 'ctrl-btn-lock': store.lockNodes }" @click="store.lockNodes = !store.lockNodes" title="Lock/unlock node clicks">{{ store.lockNodes ? '🔒' : '👤' }}</button>
        <button class="ctrl-btn" :class="{ 'ctrl-btn-lock': store.lockLines }" @click="store.lockLines = !store.lockLines" title="Lock/unlock line clicks">{{ store.lockLines ? '🔒' : '🔗' }}</button>
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
            >{{ name }}</button>
            <button class="state-menu-dot" @click.stop="openStateMenu($event, i)">⋯</button>
          </div>
        </template>
        <button class="state-btn state-btn-add" @click="addState" title="New state">＋</button>
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
        <div v-if="relPopupStatus" class="rel-popup-status" :class="relPopupStatus">{{ relPopupStatus }}</div>
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
          >{{ opt.label }}</button>
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
          >{{ opt.label }}</button>
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
          >{{ opt.label }}</button>
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
            @click="setDeceasedHighlight(opt.id)"
            :disabled="!store.currentDate"
          >{{ opt.label }}</button>
        </div>
      </div>
    </div>

    <div class="graph-legend">
      <div class="panel-title">Legend</div>
      <div class="leg-section">
        <div class="leg-section-label">Nodes</div>
        <div class="leg-row"><div class="leg-dot" style="background:#3a7bd5"></div>Male</div>
        <div class="leg-row"><div class="leg-dot" style="background:#c95fa0"></div>Female</div>
      </div>
      <div class="leg-section">
        <div class="leg-section-label">Lines</div>
        <div class="leg-row"><div class="leg-line" style="background:#8b6cc5"></div>Parent / Child</div>
        <div class="leg-row"><div class="leg-line leg-dashed" style="border-color:#f06292"></div>Spouse</div>
        <div class="leg-row"><div class="leg-line leg-dashed" style="border-color:#f5a623"></div>Adopted</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import * as d3 from 'd3'
import { useMainStore } from '../store/index.js'
import { nodeColor, linkPath, getLinkStroke, getLinkWidth, getLinkEmphOpacity, getLinkMarker, getDashArray } from './graph/linkHelpers.js'
import { computeAgeYPositions } from './graph/layoutAge.js'
import { computeGenLayout } from './graph/layoutGeneration.js'
import { drawYearGuides, drawGenGuides, removeGuides, updateGuideWidths, nearestGenRowY, updateGenPreview, removeGenPreview, resolveGenTarget, cleanupEmptyGenRows } from './graph/guideLines.js'
import { useGraphAnimation } from './graph/useGraphAnimation.js'

const store = useMainStore()
const svgEl = ref(null)
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
  simulation: null, zoomBehavior: null, svgSelection: null, rootGroup: null,
  nodesData: [], linksData: [],
  animTimer: null, resizeObserver: null,
  genRowYValues: [], genRowSpacing: 140, genPreviewLine: null, guideLineElements: [],
  modeSnapshots: { custom: null, auto: null, age: null, generation: null },
  containerRef: null,  // set in onMounted
  ticked: null,        // set below
}

const modeEmphasis = { custom: 'neutral', auto: 'neutral', age: 'neutral', generation: 'neutral' }

const { cancelAnimation, animateToPositions, animateToPositionsWithReset } = useGraphAnimation(ctx)

// ── Per-mode multi-state system ─────────────────────────────────────────────
// Each mode has an array of states (snapshots) the user can create and switch between
const modeStateNames = reactive({
  custom: ['State 1'], auto: ['State 1'], age: ['State 1'], generation: ['State 1']
})
const modeActiveStateIdx = reactive({
  custom: 0, auto: 0, age: 0, generation: 0
})
// Snapshots: modeStateSnapshots[mode][stateIdx] = { id: {x,y}, ... } or null
const modeStateSnapshots = reactive({
  custom: [null], auto: [null], age: [null], generation: [null]
})

const currentModeStates = computed(() => modeStateNames[currentMode.value])
const currentStateIndex = computed(() => modeActiveStateIdx[currentMode.value])

// ── Emphasis ────────────────────────────────────────────────────────────────
function emphVisual() { return activeEmphasis.value }

const lineageOptions = [
  { id: 'neutral', label: 'Default' },
  { id: 'paternal', label: 'Paternal' },
  { id: 'maternal', label: 'Maternal' },
]
const lineageIndex = computed(() => {
  const idx = lineageOptions.findIndex(o => o.id === activeEmphasis.value)
  return idx >= 0 ? idx : 0
})

const genderOptions = [
  { id: 'normal', label: 'Default' },
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
]
const activeGender = ref('normal')
const genderIndex = computed(() => {
  const idx = genderOptions.findIndex(o => o.id === activeGender.value)
  return idx >= 0 ? idx : 0
})

function setGenderHighlight(which) {
  if (activeGender.value === which) return
  activeGender.value = which
  applyGenderHighlight()
}

function applyGenderHighlight() {
  if (!ctx.rootGroup) return
  const g = activeGender.value
  const gs = store.graphSettings

  ctx.rootGroup.selectAll('g.graph-node')
    .transition().duration(250).ease(d3.easeCubicOut)
    .attr('opacity', d => {
      if (g === 'normal') return gs.nodeOpacity
      if (g === 'male') return d.gender === 'male' ? gs.nodeOpacity : gs.nodeOpacity * 0.25
      if (g === 'female') return d.gender === 'female' ? gs.nodeOpacity : gs.nodeOpacity * 0.25
      return gs.nodeOpacity
    })

  ctx.rootGroup.selectAll('g.graph-node').select('.node-circle')
    .transition().duration(250).ease(d3.easeCubicOut)
    .attr('r', d => {
      const base = gs.nodeRadius
      if (g === 'normal') return base
      if (g === 'male' && d.gender === 'male') return base * 1.15
      if (g === 'female' && d.gender === 'female') return base * 1.15
      return base
    })

  ctx.rootGroup.selectAll('g.graph-node').select('.node-shadow')
    .transition().duration(250).ease(d3.easeCubicOut)
    .attr('r', d => {
      const base = gs.nodeRadius + 2
      if (g === 'normal') return base
      if (g === 'male' && d.gender === 'male') return base + 2
      if (g === 'female' && d.gender === 'female') return base + 2
      return base
    })
}

// ── Couples highlight ────────────────────────────────────────────────────────
const couplesOptions = [
  { id: 'normal', label: 'Default' },
  { id: 'married', label: 'Married' },
  { id: 'divorced', label: 'Divorced' },
  { id: 'single', label: 'Single' },
]
const activeCouples = ref('normal')
const couplesIndex = computed(() => {
  const idx = couplesOptions.findIndex(o => o.id === activeCouples.value)
  return idx >= 0 ? idx : 0
})

function setCouplesHighlight(which) {
  if (activeCouples.value === which) return
  activeCouples.value = which
  applyCouplesHighlight()
}

function applyCouplesHighlight() {
  if (!ctx.rootGroup) return
  const c = activeCouples.value
  const gs = store.graphSettings
  const rels = store.relationships

  // Find persons who are in the target relationship
  const highlightedIds = new Set()
  if (c !== 'normal') {
    const allSpouseIds = new Set()
    const marriedIds = new Set()
    const divorcedIds = new Set()
    rels.forEach(r => {
      if (r.type !== 'spouse') return
      allSpouseIds.add(r.person_a_id); allSpouseIds.add(r.person_b_id)
      if (r.status === 'divorced') { divorcedIds.add(r.person_a_id); divorcedIds.add(r.person_b_id) }
      else { marriedIds.add(r.person_a_id); marriedIds.add(r.person_b_id) }
    })
    if (c === 'married') marriedIds.forEach(id => highlightedIds.add(id))
    else if (c === 'divorced') divorcedIds.forEach(id => highlightedIds.add(id))
    else if (c === 'single') {
      ctx.nodesData.forEach(n => { if (!allSpouseIds.has(n.id)) highlightedIds.add(n.id) })
    }
  }

  ctx.rootGroup.selectAll('g.graph-node')
    .transition().duration(250).ease(d3.easeCubicOut)
    .attr('opacity', d => {
      if (c === 'normal') return gs.nodeOpacity
      return highlightedIds.has(d.id) ? gs.nodeOpacity : gs.nodeOpacity * 0.2
    })

  ctx.rootGroup.selectAll('g.graph-node').select('.node-circle')
    .transition().duration(250).ease(d3.easeCubicOut)
    .attr('r', d => {
      const base = gs.nodeRadius
      if (c === 'normal') return base
      return highlightedIds.has(d.id) ? base * 1.15 : base
    })

  // Also highlight/dim the spouse lines
  ctx.rootGroup.selectAll('g.graph-link-group').select('.graph-link')
    .transition().duration(250).ease(d3.easeCubicOut)
    .attr('opacity', d => {
      if (c === 'normal') return gs.linkOpacity
      if (c === 'single') return d.type === 'spouse' ? gs.linkOpacity * 0.15 : gs.linkOpacity * 0.3
      if (d.type !== 'spouse') return gs.linkOpacity * 0.2
      if (c === 'married' && d.status !== 'divorced') return Math.min(1, gs.linkOpacity * 1.5)
      if (c === 'divorced' && d.status === 'divorced') return Math.min(1, gs.linkOpacity * 1.5)
      return gs.linkOpacity * 0.2
    })
    .attr('stroke-width', d => {
      const base = d.type === 'spouse' ? gs.spouseWidth : d.type === 'adopted' ? gs.adoptedWidth : gs.parentChildWidth
      if (c === 'normal' || c === 'single') return base
      if (d.type !== 'spouse') return base
      if (c === 'married' && d.status !== 'divorced') return base * 2
      if (c === 'divorced' && d.status === 'divorced') return base * 2
      return base
    })
}

// ── Date & Deceased highlight ───────────────────────────────────────────────
const deceasedOptions = [
  { id: 'normal', label: 'Default' },
  { id: 'deceased', label: 'Deceased' },
  { id: 'living', label: 'Living' },
]
const activeDeceased = ref('normal')
const deceasedIndex = computed(() => {
  const idx = deceasedOptions.findIndex(o => o.id === activeDeceased.value)
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
  if (!ctx.rootGroup) return
  const d = activeDeceased.value
  const gs = store.graphSettings

  ctx.rootGroup.selectAll('g.graph-node')
    .transition().duration(250).ease(d3.easeCubicOut)
    .attr('opacity', person => {
      if (d === 'normal') return gs.nodeOpacity
      if (d === 'deceased') return isDeceased(person) ? gs.nodeOpacity : gs.nodeOpacity * 0.2
      if (d === 'living') return isLiving(person) ? gs.nodeOpacity : gs.nodeOpacity * 0.2
      return gs.nodeOpacity
    })

  ctx.rootGroup.selectAll('g.graph-node').select('.node-circle')
    .transition().duration(250).ease(d3.easeCubicOut)
    .attr('r', person => {
      const base = gs.nodeRadius
      if (d === 'deceased' && isDeceased(person)) return base * 1.15
      if (d === 'living' && isLiving(person)) return base * 1.15
      return base
    })
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
  return store.persons.find(x => x.id === store.relPopup.rel.person_a_id)?.name || '?'
})
const relPopupPersonB = computed(() => {
  if (!store.relPopup) return ''
  return store.persons.find(x => x.id === store.relPopup.rel.person_b_id)?.name || '?'
})
const relPopupFormedLabel = computed(() => {
  if (!store.relPopup) return ''
  const r = store.relPopup.rel
  if (r.formed_date) return r.type === 'spouse' ? `Married: ${r.formed_date}` : `Since: ${r.formed_date}`
  if (r.type === 'parent_child') {
    const child = store.persons.find(x => x.id === r.person_b_id)
    if (child?.birth_year) return `Born: ${child.birth_year}`
  }
  return ''
})
const relPopupStatus = computed(() => store.relPopup?.rel?.status === 'divorced' ? 'divorced' : '')

// ── Snapshot helpers ────────────────────────────────────────────────────────
function snapshotMode(mode) {
  const snap = {}
  ctx.nodesData.forEach(n => { snap[n.id] = { x: n.x, y: n.y } })
  const idx = modeActiveStateIdx[mode]
  modeStateSnapshots[mode][idx] = snap
  ctx.modeSnapshots[mode] = snap
  store.markGraphDirty()
}
function hasSnapshot(mode) { return ctx.modeSnapshots[mode] && Object.keys(ctx.modeSnapshots[mode]).length > 0 }

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
  ctx.nodesData.forEach(n => { snap[n.id] = { x: n.x, y: n.y } })

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
  if (closeMenuListener) { document.removeEventListener('mousedown', closeMenuListener, true); closeMenuListener = null }

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
  if (closeMenuListener) { document.removeEventListener('mousedown', closeMenuListener, true); closeMenuListener = null }
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
    if (el) { el.focus(); el.select() }
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

  modeStateNames[mode].splice(idx, 1)
  modeStateSnapshots[mode].splice(idx, 1)

  // Adjust active index
  let newActive = modeActiveStateIdx[mode]
  if (newActive >= modeStateNames[mode].length) newActive = modeStateNames[mode].length - 1
  if (newActive === idx || idx < newActive) newActive = Math.max(0, newActive - (idx < newActive ? 1 : 0))
  modeActiveStateIdx[mode] = newActive
  ctx.modeSnapshots[mode] = modeStateSnapshots[mode][newActive] || null

  // If deleted the active state, reload
  if (idx === currentStateIndex.value || newActive !== modeActiveStateIdx[mode]) {
    removeGuides(ctx)
    if (mode === 'auto') enterAutoMode()
    else if (mode === 'custom') enterCustomMode()
    else if (mode === 'age') enterAgeMode()
    else if (mode === 'generation') enterGenerationMode()
    applyEmphasis()
  }
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
function ticked() {
  if (!ctx.rootGroup) return
  ctx.rootGroup.selectAll('g.graph-link-group').each(function (d) {
    const p = linkPath(d, store.graphSettings.lineCurvature)
    d3.select(this).select('.link-hit').attr('d', p)
    d3.select(this).select('.graph-link').attr('d', p)
  })
  ctx.rootGroup.selectAll('g.graph-node').attr('transform', d => `translate(${d.x},${d.y})`)
  updateGuideWidths(ctx)
}
ctx.ticked = ticked
ctx.theme = store.theme

// ── Init graph ──────────────────────────────────────────────────────────────
function initGraph() {
  const container = containerEl.value
  if (!container) return
  ctx.containerRef = container
  const { width, height } = container.getBoundingClientRect()

  ctx.svgSelection = d3.select(svgEl.value).attr('width', width).attr('height', height)
  const defs = ctx.svgSelection.append('defs')

  const nodeR = store.graphSettings.nodeRadius
  ;[{ id: 'arr', fill: '#8b6cc5' }, { id: 'arr-a', fill: '#f5a623' }, { id: 'arr-pat', fill: '#4a90d9' }, { id: 'arr-mat', fill: '#d94a8a' }, { id: 'arr-pat-ad', fill: '#7bb8f0' }, { id: 'arr-mat-ad', fill: '#eda0c4' }]
    .forEach(({ id, fill }) => {
      defs.append('marker').attr('id', id)
        .attr('markerWidth', 10).attr('markerHeight', 10)
        .attr('refX', nodeR + 10).attr('refY', 5)
        .attr('orient', 'auto').attr('markerUnits', 'userSpaceOnUse')
        .attr('viewBox', '0 0 10 10')
        .append('path').attr('d', 'M0,0 L0,10 L10,5z').attr('fill', fill).attr('opacity', 0.9)
    })

  const glowFilter = defs.append('filter').attr('id', 'glow')
  glowFilter.append('feGaussianBlur').attr('stdDeviation', 3).attr('result', 'coloredBlur')
  const fm = glowFilter.append('feMerge')
  fm.append('feMergeNode').attr('in', 'coloredBlur')
  fm.append('feMergeNode').attr('in', 'SourceGraphic')

  // Gradient drop shadow for nodes — dark mode
  const shadowDark = defs.append('filter').attr('id', 'node-shadow-dark')
    .attr('x', '-40%').attr('y', '-40%').attr('width', '180%').attr('height', '180%')
  shadowDark.append('feGaussianBlur').attr('in', 'SourceAlpha').attr('stdDeviation', 4).attr('result', 'blur')
  shadowDark.append('feOffset').attr('dx', 2).attr('dy', 3).attr('result', 'offsetBlur')
  shadowDark.append('feComponentTransfer').attr('in', 'offsetBlur').attr('result', 'shadow')
    .append('feFuncA').attr('type', 'linear').attr('slope', 0.35)
  const fmDark = shadowDark.append('feMerge')
  fmDark.append('feMergeNode').attr('in', 'shadow')
  fmDark.append('feMergeNode').attr('in', 'SourceGraphic')

  // Gradient drop shadow for nodes — light mode (softer, more diffuse)
  const shadowLight = defs.append('filter').attr('id', 'node-shadow-light')
    .attr('x', '-40%').attr('y', '-40%').attr('width', '180%').attr('height', '180%')
  shadowLight.append('feGaussianBlur').attr('in', 'SourceAlpha').attr('stdDeviation', 6).attr('result', 'blur')
  shadowLight.append('feOffset').attr('dx', 1).attr('dy', 2).attr('result', 'offsetBlur')
  shadowLight.append('feComponentTransfer').attr('in', 'offsetBlur').attr('result', 'shadow')
    .append('feFuncA').attr('type', 'linear').attr('slope', 0.15)
  const fmLight = shadowLight.append('feMerge')
  fmLight.append('feMergeNode').attr('in', 'shadow')
  fmLight.append('feMergeNode').attr('in', 'SourceGraphic')

  ctx.zoomBehavior = d3.zoom().scaleExtent([0.1, 4]).on('zoom', e => ctx.rootGroup.attr('transform', e.transform))
  ctx.svgSelection.call(ctx.zoomBehavior)
  ctx.svgSelection.on('click', () => { store.selectPerson(null); store.relPopup = null })

  ctx.rootGroup = ctx.svgSelection.append('g').attr('class', 'root-group')
  ctx.rootGroup.append('g').attr('class', 'guides-layer')
  ctx.rootGroup.append('g').attr('class', 'links-layer')
  ctx.rootGroup.append('g').attr('class', 'nodes-layer')

  ctx.simulation = d3.forceSimulation()
    .force('link', d3.forceLink().id(d => d.id).distance(160).strength(0.4))
    .force('charge', d3.forceManyBody().strength(-380))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide(52))
    .on('tick', ticked)

  ctx.resizeObserver = new ResizeObserver(() => {
    if (!container) return
    const r = container.getBoundingClientRect()
    ctx.svgSelection.attr('width', r.width).attr('height', r.height)
    if (currentMode.value === 'auto') {
      ctx.simulation.force('center', d3.forceCenter(r.width / 2, r.height / 2))
      ctx.simulation.alpha(0.1).restart()
    }
  })
  ctx.resizeObserver.observe(container)
}

// ── Data sync ───────────────────────────────────────────────────────────────
function updateGraph() {
  if (!ctx.simulation || !ctx.rootGroup) return
  const existingById = {}
  ctx.nodesData.forEach(n => { existingById[n.id] = n })

  const newNodes = store.persons.map(p => {
    if (existingById[p.id]) return Object.assign(existingById[p.id], p)
    const rel = store.relationships.find(r => r.person_a_id === p.id || r.person_b_id === p.id)
    let sx = (ctx.containerRef?.offsetWidth || 800) / 2, sy = (ctx.containerRef?.offsetHeight || 600) / 2
    if (rel) {
      const cid = rel.person_a_id === p.id ? rel.person_b_id : rel.person_a_id
      const cn = existingById[cid]
      if (cn) { sx = cn.x + (Math.random() - 0.5) * 40; sy = cn.y + (Math.random() - 0.5) * 40 }
    }
    return { ...p, x: sx, y: sy, vx: 0, vy: 0 }
  })

  const hadNew = newNodes.length > ctx.nodesData.length
  ctx.nodesData = newNodes
  ctx.linksData = store.relationships.map(r => ({ ...r, source: r.person_a_id, target: r.person_b_id }))
  ctx.simulation.nodes(ctx.nodesData)
  ctx.simulation.force('link').links(ctx.linksData)
  if (currentMode.value === 'auto') ctx.simulation.alpha(hadNew ? 0.3 : 0.1).restart()
  renderLinks()
  renderNodes()
}

// ── Rendering ───────────────────────────────────────────────────────────────
function renderLinks() {
  const layer = ctx.rootGroup.select('.links-layer')
  const link = layer.selectAll('g.graph-link-group').data(ctx.linksData, d => d.id)
  link.exit().remove()

  const entered = link.enter().append('g').attr('class', 'graph-link-group')
  entered.append('path').attr('class', 'link-hit').attr('fill', 'none')
    .attr('stroke', 'transparent').attr('stroke-width', 14).attr('cursor', 'pointer')
  entered.append('path').attr('class', 'graph-link').attr('fill', 'none')
    .attr('pointer-events', 'none').attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round')

  entered.select('.link-hit').on('click', (event, d) => {
    event.stopPropagation()
    if (store.lockLines) return
    const rect = ctx.containerRef.getBoundingClientRect()
    store.relPopup = { rel: d, x: event.clientX - rect.left, y: event.clientY - rect.top - 10 }
  })

  const gs = store.graphSettings, emph = emphVisual(), persons = store.persons
  entered.merge(link).select('.graph-link')
    .attr('stroke', d => getLinkStroke(d, emph, gs, persons))
    .attr('stroke-width', d => getLinkWidth(d, emph, gs, persons))
    .attr('stroke-dasharray', d => getDashArray(d))
    .attr('marker-end', d => getLinkMarker(d, emph, persons))
    .attr('opacity', d => getLinkEmphOpacity(d, emph, gs, persons))
}

function renderNodes() {
  const layer = ctx.rootGroup.select('.nodes-layer')
  const node = layer.selectAll('g.graph-node').data(ctx.nodesData, d => d.id)
  node.exit().transition().duration(300).attr('opacity', 0).remove()

  const gs = store.graphSettings, r = gs.nodeRadius
  const entered = node.enter().append('g').attr('class', 'graph-node').attr('opacity', 0).attr('cursor', 'pointer')
  const isLight = store.theme === 'light'
  entered.append('circle').attr('class', 'node-circle').attr('r', r).attr('stroke', 'rgba(255,255,255,0.18)').attr('stroke-width', 1.5)
    .attr('filter', isLight ? 'url(#node-shadow-light)' : 'url(#node-shadow-dark)')
  entered.append('text').attr('class', 'node-initials').attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
    .attr('fill', '#fff').attr('font-size', Math.max(9, r * 0.55)).attr('font-weight', 700)
    .attr('font-family', 'system-ui, sans-serif').attr('pointer-events', 'none')
  entered.append('text').attr('class', 'node-label').attr('text-anchor', 'middle').attr('y', r + 14)
    .attr('font-size', gs.labelSize).attr('font-weight', 500)
    .attr('font-family', 'system-ui, sans-serif').attr('pointer-events', 'none')

  entered
    .on('mouseenter', function () { if (gs.glowOnHover) d3.select(this).select('.node-circle').attr('filter', 'url(#glow)') })
    .on('mouseleave', function () { const d = d3.select(this).datum(); if (store.selectedPersonId !== d.id) d3.select(this).select('.node-circle').attr('filter', store.theme === 'light' ? 'url(#node-shadow-light)' : 'url(#node-shadow-dark)') })
    .on('click', (event, d) => { event.stopPropagation(); if (store.lockNodes) return; store.relPopup = null; store.selectPerson(d.id) })
  entered.transition().duration(400).attr('opacity', 1)

  const merged = entered.merge(node)
  merged.attr('opacity', gs.nodeOpacity)
  const isLightTheme = store.theme === 'light'
  const shadowFilter = isLightTheme ? 'url(#node-shadow-light)' : 'url(#node-shadow-dark)'
  merged.select('.node-circle').attr('r', gs.nodeRadius)
    .attr('fill', d => { const c = store.selectedPersonId === d.id ? d3.color(nodeColor(d.gender, gs))?.brighter(0.4)?.toString() : null; return c || nodeColor(d.gender, gs) })
    .attr('stroke', d => store.selectedPersonId === d.id ? '#6c8ef5' : 'rgba(255,255,255,0.18)')
    .attr('stroke-width', d => store.selectedPersonId === d.id ? 3 : 1.5)
    .attr('filter', d => store.selectedPersonId === d.id ? 'url(#glow)' : shadowFilter)
  merged.select('.node-initials').attr('font-size', Math.max(9, gs.nodeRadius * 0.55))
    .text(d => { const p = d.name.trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : d.name.substring(0, 2).toUpperCase() })
  merged.select('.node-label').attr('y', gs.nodeRadius + 14).attr('font-size', gs.labelSize)
    .attr('display', gs.showLabels ? null : 'none')
    .text(d => d.name.split(' ')[0])
    .attr('fill', d => store.selectedPersonId === d.id ? '#6c8ef5' : (isLightTheme ? '#4a5068' : 'rgba(232,234,246,0.85)'))
  applyDrag(merged)
}

// ── Drag ────────────────────────────────────────────────────────────────────
function applyDrag(sel) {
  sel.on('.drag', null)
  const mode = currentMode.value
  const filterDrag = () => !store.lockNodes

  if (mode === 'auto') {
    sel.call(d3.drag().filter(filterDrag)
      .on('start', (e, d) => { if (!e.active) ctx.simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y })
      .on('end', (e, d) => { if (!e.active) ctx.simulation.alphaTarget(0); d.fx = null; d.fy = null }))
  } else if (mode === 'custom') {
    sel.call(d3.drag().filter(filterDrag)
      .on('start', (e, d) => { d.fx = d.x; d.fy = d.y })
      .on('drag', (e, d) => { d.x = e.x; d.y = e.y; d.fx = e.x; d.fy = e.y; ticked() })
      .on('end', () => { snapshotMode('custom') }))
  } else if (mode === 'age') {
    sel.call(d3.drag().filter(filterDrag)
      .on('start', (e, d) => { d.fx = d.x })
      .on('drag', (e, d) => { d.x = e.x; d.fx = e.x; ticked() })
      .on('end', () => { snapshotMode('age') }))
  } else if (mode === 'generation') {
    sel.call(d3.drag().filter(filterDrag)
      .on('start', (e, d) => { d.fx = d.x; d.fy = d.y; removeGenPreview(ctx) })
      .on('drag', (e, d) => { d.x = e.x; d.y = e.y; d.fx = e.x; d.fy = e.y; ticked(); updateGenPreview(d.y, ctx) })
      .on('end', (e, d) => {
        removeGenPreview(ctx)
        const ty = resolveGenTarget(d.y, ctx); d.fx = d.x; d.fy = ty; d.y = ty; ticked()
        cleanupEmptyGenRows(ctx, snapshotGenMode, ticked)
      }))
  }
}
function reapplyDrag() { if (ctx.rootGroup) applyDrag(ctx.rootGroup.selectAll('g.graph-node')) }

// ── Mode switching ──────────────────────────────────────────────────────────
function switchMode(newMode) {
  if (newMode === currentMode.value) return
  cancelAnimation()
  if (!ctx.nodesData.length) { currentMode.value = newMode; return }

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
  if (hasSnapshot('auto')) {
    animateToPositionsWithReset(ctx.modeSnapshots['auto'], () => { ctx.nodesData.forEach(n => { n.fx = null; n.fy = null; n.vx = 0; n.vy = 0 }); ctx.simulation.alpha(0.15).restart(); reapplyDrag() })
  } else { ctx.nodesData.forEach(n => { n.fx = null; n.fy = null }); ctx.simulation.alpha(0.3).restart(); reapplyDrag() }
}

function enterCustomMode() {
  ctx.simulation.stop()
  if (hasSnapshot('custom')) {
    animateToPositionsWithReset(ctx.modeSnapshots['custom'], () => { ctx.nodesData.forEach(n => { n.fx = n.x; n.fy = n.y }); reapplyDrag() })
  } else { ctx.nodesData.forEach(n => { n.fx = n.x; n.fy = n.y }); snapshotMode('custom'); reapplyDrag() }
}

function enterAgeMode() {
  ctx.simulation.stop()
  const container = ctx.containerRef; if (!container) return
  const { width, height } = container.getBoundingClientRect()
  const ageInfo = computeAgeYPositions(ctx.nodesData, height)

  if (hasSnapshot('age')) {
    const snap = ctx.modeSnapshots['age'], targets = {}
    ctx.nodesData.forEach(n => { targets[n.id] = { x: snap[n.id]?.x ?? n.x, y: ageInfo.yMap[n.id] } })
    animateToPositionsWithReset(targets, () => { ctx.nodesData.forEach(n => { n.fx = n.x; n.fy = ageInfo.yMap[n.id] }); drawYearGuides(ctx, ageInfo.minYear, ageInfo.maxYear, ageInfo.padding, ageInfo.usableHeight); reapplyDrag() })
    return
  }

  const customSnap = ctx.modeSnapshots['custom'], byYear = {}, targets = {}
  ctx.nodesData.forEach(n => { const y = n.birth_year || ageInfo.maxYear; if (!byYear[y]) byYear[y] = []; byYear[y].push(n) })
  const bands = [], sortedYears = Object.keys(byYear).map(Number).sort((a, b) => a - b)
  sortedYears.forEach(yr => { const lb = bands[bands.length - 1]; if (lb && yr - lb.maxYear <= 3) { lb.maxYear = yr; lb.nodes.push(...byYear[yr]) } else bands.push({ minYear: yr, maxYear: yr, nodes: [...byYear[yr]] }) })
  bands.forEach(b => b.nodes.sort((a, c) => (customSnap?.[a.id]?.x ?? a.x) - (customSnap?.[c.id]?.x ?? c.x)))

  ctx.nodesData.forEach(n => {
    const yr = n.birth_year || ageInfo.maxYear, ty = ageInfo.yMap[n.id]
    const band = bands.find(b => yr >= b.minYear && yr <= b.maxYear), row = band ? band.nodes : [n]
    const idx = row.indexOf(n), cnt = row.length
    const sp = Math.max(80, Math.min(120, (width - 160) / Math.max(cnt, 1))), rw = (cnt - 1) * sp
    targets[n.id] = { x: customSnap?.[n.id] ? customSnap[n.id].x : (width - rw) / 2 + idx * sp, y: ty }
  })

  drawYearGuides(ctx, ageInfo.minYear, ageInfo.maxYear, ageInfo.padding, ageInfo.usableHeight)
  animateToPositionsWithReset(targets, () => { ctx.nodesData.forEach(n => { n.fx = n.x; n.fy = ageInfo.yMap[n.id] }); snapshotMode('age'); reapplyDrag() })
}

function enterGenerationMode() {
  ctx.simulation.stop()
  const container = ctx.containerRef; if (!container) return
  const { width, height } = container.getBoundingClientRect()

  if (hasSnapshot('generation')) {
    // Restore saved positions and saved row state exactly as they were
    const snap = ctx.modeSnapshots['generation']
    if (snap._genRowYValues) ctx.genRowYValues = [...snap._genRowYValues]
    if (snap._genRowSpacing) ctx.genRowSpacing = snap._genRowSpacing

    const targets = {}
    ctx.nodesData.forEach(n => { targets[n.id] = snap[n.id] ? { x: snap[n.id].x, y: snap[n.id].y } : { x: n.x, y: n.y } })

    // Build genInfo-like object for drawing guides from saved rows
    const savedGenInfo = { genLabels: ctx.genRowYValues.map((y, i) => ({ label: `Gen ${i + 1}`, y })) }
    animateToPositionsWithReset(targets, () => {
      ctx.nodesData.forEach(n => { n.fx = n.x; n.fy = n.y })
      drawGenGuides(ctx, savedGenInfo)
      reapplyDrag()
    })
    return
  }

  // First time: compute layout from relationships
  const genInfo = computeGenLayout(ctx.nodesData, store.relationships, width, height)
  ctx.genRowYValues = genInfo.genLabels.map(g => g.y)
  ctx.genRowSpacing = genInfo.rowHeight || 140

  drawGenGuides(ctx, genInfo)
  animateToPositionsWithReset(genInfo.targets, () => {
    ctx.nodesData.forEach(n => { n.fx = n.x; n.fy = genInfo.targets[n.id]?.y ?? n.y })
    snapshotGenMode()
    reapplyDrag()
  })
}

// Save generation snapshot including row state
function snapshotGenMode() {
  const snap = {}
  ctx.nodesData.forEach(n => { snap[n.id] = { x: n.x, y: n.y } })
  snap._genRowYValues = [...ctx.genRowYValues]
  snap._genRowSpacing = ctx.genRowSpacing
  const idx = modeActiveStateIdx['generation']
  modeStateSnapshots['generation'][idx] = snap
  ctx.modeSnapshots['generation'] = snap
  store.markGraphDirty()
}

// ── Emphasis ────────────────────────────────────────────────────────────────
function applyEmphasis() {
  if (!ctx.rootGroup || !ctx.svgSelection) return
  const emph = emphVisual(), gs = store.graphSettings, persons = store.persons

  ctx.rootGroup.selectAll('g.graph-link-group').select('.graph-link')
    .transition().duration(250).ease(d3.easeCubicOut)
    .attr('stroke', d => getLinkStroke(d, emph, gs, persons))
    .attr('stroke-width', d => getLinkWidth(d, emph, gs, persons))
    .attr('opacity', d => getLinkEmphOpacity(d, emph, gs, persons))
    .attr('marker-end', d => getLinkMarker(d, emph, persons))

  // Animate paternal/maternal marker sizes
  const isEmphPat = emph === 'paternal'
  const isEmphMat = emph === 'maternal'
  const patSize = isEmphPat ? 16 : 10
  const matSize = isEmphMat ? 16 : 10
  const nodeR = gs.nodeRadius

  ;['#arr-pat', '#arr-pat-ad'].forEach(id => {
    ctx.svgSelection.select(id).transition().duration(250).ease(d3.easeCubicOut)
      .attr('markerWidth', patSize).attr('markerHeight', patSize)
      .attr('refX', nodeR + (isEmphPat ? 14 : 10))
  })
  ;['#arr-mat', '#arr-mat-ad'].forEach(id => {
    ctx.svgSelection.select(id).transition().duration(250).ease(d3.easeCubicOut)
      .attr('markerWidth', matSize).attr('markerHeight', matSize)
      .attr('refX', nodeR + (isEmphMat ? 14 : 10))
  })
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
function zoomIn() { ctx.svgSelection?.transition().duration(300).call(ctx.zoomBehavior.scaleBy, 1.3) }
function zoomOut() { ctx.svgSelection?.transition().duration(300).call(ctx.zoomBehavior.scaleBy, 0.77) }
function resetZoom() {
  if (!ctx.nodesData.length || !ctx.containerRef) { ctx.svgSelection?.transition().duration(400).call(ctx.zoomBehavior.transform, d3.zoomIdentity); return }
  const { width, height } = ctx.containerRef.getBoundingClientRect()
  const xs = ctx.nodesData.map(d => d.x), ys = ctx.nodesData.map(d => d.y)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2
  ctx.svgSelection?.transition().duration(400).call(ctx.zoomBehavior.transform, d3.zoomIdentity.translate(width / 2 - cx, height / 2 - cy))
}
function fitAll() {
  if (!ctx.nodesData.length || !ctx.containerRef) return
  const { width, height } = ctx.containerRef.getBoundingClientRect()
  const xs = ctx.nodesData.map(d => d.x), ys = ctx.nodesData.map(d => d.y)
  const x0 = Math.min(...xs) - 60, x1 = Math.max(...xs) + 60, y0 = Math.min(...ys) - 60, y1 = Math.max(...ys) + 60
  const scale = Math.min(0.9 * width / (x1 - x0), 0.9 * height / (y1 - y0), 2)
  ctx.svgSelection?.transition().duration(600).call(ctx.zoomBehavior.transform, d3.zoomIdentity.translate(width / 2 - scale * (x0 + x1) / 2, height / 2 - scale * (y0 + y1) / 2).scale(scale))
}
function highlightSearch() {
  if (!ctx.rootGroup) return
  const q = searchQuery.value.toLowerCase().trim()
  ctx.rootGroup.selectAll('g.graph-node').attr('opacity', d => !q || d.name.toLowerCase().includes(q) ? 1 : 0.2)
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
    genRowYValues: [...ctx.genRowYValues],
    genRowSpacing: ctx.genRowSpacing,
  }
}

function restoreGraphState(state) {
  if (!state) return
  // Restore mode state names and snapshots
  for (const mode of ['custom', 'auto', 'age', 'generation']) {
    if (state.modeStateNames?.[mode]) modeStateNames[mode] = state.modeStateNames[mode]
    if (state.modeActiveStateIdx?.[mode] !== undefined) modeActiveStateIdx[mode] = state.modeActiveStateIdx[mode]
    if (state.modeStateSnapshots?.[mode]) modeStateSnapshots[mode] = state.modeStateSnapshots[mode]
    if (state.modeEmphasis?.[mode]) modeEmphasis[mode] = state.modeEmphasis[mode]
    // Restore the active snapshot for each mode
    const idx = modeActiveStateIdx[mode]
    ctx.modeSnapshots[mode] = modeStateSnapshots[mode]?.[idx] || null
  }
  if (state.genRowYValues) ctx.genRowYValues = state.genRowYValues
  if (state.genRowSpacing) ctx.genRowSpacing = state.genRowSpacing
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

onMounted(async () => {
  initGraph()
  updateGraph()
  // Load saved graph state after initial render
  await nextTick()
  await loadSavedGraphState()
  store.clearGraphDirty()
})
onUnmounted(() => { ctx.simulation?.stop(); ctx.resizeObserver?.disconnect(); cancelAnimation() })

watch([() => store.persons, () => store.relationships], () => updateGraph(), { deep: true })
watch(() => store.selectedPersonId, () => { if (ctx.rootGroup) renderNodes() })
watch(() => store.lockNodes, () => reapplyDrag())
watch(() => store.currentDate, () => {
  if (!store.currentDate && activeDeceased.value !== 'normal') {
    activeDeceased.value = 'normal'
    applyDeceasedHighlight()
  }
})
watch(() => store.theme, () => {
  ctx.theme = store.theme
  if (!ctx.rootGroup) return
  renderNodes(); renderLinks()
  // Update guide line colors for new theme
  const light = store.theme === 'light'
  const guideStroke = light ? 'rgba(0, 0, 0, 0.10)' : 'rgba(232, 234, 246, 0.12)'
  const guideFill = light ? 'rgba(0, 0, 0, 0.22)' : 'rgba(232, 234, 246, 0.25)'
  ctx.rootGroup.selectAll('.mode-guides line').attr('stroke', guideStroke)
  ctx.rootGroup.selectAll('.mode-guides text').attr('fill', guideFill)
})
watch(() => store.graphSettings, () => {
  if (!ctx.rootGroup || !ctx.simulation) return
  const gs = store.graphSettings, refX = gs.nodeRadius + 10
  ;['#arr', '#arr-a', '#arr-pat', '#arr-mat', '#arr-pat-ad', '#arr-mat-ad'].forEach(id => ctx.svgSelection?.select(id).attr('refX', refX))
  ctx.svgSelection?.select('#arr path').attr('fill', gs.parentChildColor)
  ctx.svgSelection?.select('#arr-a path').attr('fill', gs.adoptedColor)
  if (currentMode.value === 'auto') { ctx.simulation.force('link').distance(gs.linkDistance); ctx.simulation.force('charge').strength(gs.chargeStrength); ctx.simulation.force('collide').radius(gs.nodeRadius + 30); ctx.simulation.alpha(0.2).restart() }
  renderLinks(); renderNodes()
}, { deep: true })
</script>

<style scoped>
.graph-area { position: relative; background: var(--bg); overflow: hidden; }
.graph-svg { display: block; width: 100%; height: 100%; }
.graph-search { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 7px 14px; min-width: 260px; z-index: 5; box-shadow: var(--shadow); transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease; }
.graph-search input { background: none; border: none; outline: none; font: inherit; font-size: 13px; color: var(--t1); flex: 1; padding: 0; box-shadow: none; width: auto; }
.graph-search input::placeholder { color: var(--t3); }
.search-icon { font-size: 13px; flex-shrink: 0; }
.bottom-bars { position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; align-items: flex-end; z-index: 5; transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease; }
.graph-controls { display: flex; gap: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 5px; box-shadow: var(--shadow); }
.ctrl-btn { width: 30px; height: 30px; border-radius: 7px; border: none; background: transparent; cursor: pointer; color: var(--t2); font-size: 15px; display: flex; align-items: center; justify-content: center; transition: background 0.12s; font-family: var(--font); }
.ctrl-btn:hover { background: var(--hover); color: var(--t1); }
.ctrl-btn-wide { width: auto; padding: 0 10px; gap: 4px; font-size: 11px; font-weight: 600; position: relative; }
.ctrl-btn-active { background: var(--adim); color: var(--accent); border: 1px solid rgba(108, 142, 245, 0.3); }
.ctrl-sep { width: 1px; background: var(--border); margin: 3px 2px; }
.graph-legend { position: absolute; bottom: 18px; right: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; font-size: 11px; color: var(--t2); z-index: 5; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 10px; min-width: 140px; }
.panel-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--t3); }
.leg-section { display: flex; flex-direction: column; gap: 5px; }
.leg-section-label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: var(--t3); opacity: 0.7; }
.leg-row { display: flex; align-items: center; gap: 8px; font-weight: 500; }
.leg-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.leg-line { width: 22px; height: 2px; flex-shrink: 0; border-radius: 1px; }
.leg-dashed { height: 0; border-top: 2px dashed; background: none !important; }
.ctrl-btn-lock { background: rgba(239, 83, 80, 0.15); color: #ef5350; }
.rel-popup { position: absolute; z-index: 20; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 18px; min-width: 180px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45); transform: translateX(-50%) translateY(-100%); display: flex; flex-direction: column; gap: 6px; }
.rel-popup-close { position: absolute; top: 6px; right: 8px; width: 22px; height: 22px; border-radius: 5px; border: none; background: transparent; color: var(--t3); font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.rel-popup-close:hover { background: var(--hover); color: var(--t1); }
.rel-popup-type { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--accent); }
.rel-popup-people { font-size: 13px; font-weight: 600; color: var(--t1); }
.rel-popup-date { font-size: 12px; color: var(--t2); }
.rel-popup-status.divorced { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #ef5350; background: rgba(239, 83, 80, 0.12); padding: 2px 8px; border-radius: 6px; align-self: flex-start; }
.relpop-enter-active { transition: opacity 0.18s ease, transform 0.22s cubic-bezier(0.34, 1.3, 0.64, 1); }
.relpop-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.relpop-enter-from { opacity: 0; transform: translateX(-50%) translateY(-90%) scale(0.92); }
.relpop-leave-to { opacity: 0; transform: translateX(-50%) translateY(-100%) scale(0.95); }

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
  transition: background 0.15s, color 0.15s;
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
  transition: opacity 0.15s, background 0.12s, color 0.12s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.25);
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
  transition: background 0.1s, color 0.1s;
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
  transition: opacity 0.15s ease, transform 0.18s cubic-bezier(0.34, 1.4, 0.64, 1);
}
.ctx-menu-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
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

.clean-hide-up { transform: translateX(-50%) translateY(calc(-100% - 30px)); opacity: 0; pointer-events: none; }
.bottom-bars.clean-hide-down { transform: translateX(-50%) translateY(calc(100% + 30px)); opacity: 0; pointer-events: none; }
.clean-hide-right { transform: translateX(calc(100% + 30px)); opacity: 0; pointer-events: none; }

/* Highlights panel */
.highlights-panel {
  position: absolute;
  top: 14px;
  right: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 16px;
  z-index: 5;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 180px;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
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
  transition: left 0.25s cubic-bezier(0.4, 0.0, 0.2, 1), background 0.25s;
}

.seg-pos-0 { left: 0; }
.seg-pos-1 { left: calc(100% / 3); background: #4a90d9; }
.seg-pos-2 { left: calc(200% / 3); background: #d94a8a; }

.seg-thumb-gender.seg-pos-0 { background: var(--accent); }
.seg-thumb-gender.seg-pos-1 { background: #3a7bd5; }
.seg-thumb-gender.seg-pos-2 { background: #c95fa0; }

.seg-thumb-couples { width: calc(100% / 4); }
.seg-thumb-couples.seg-pos-0 { left: 0; background: var(--accent); }
.seg-thumb-couples.seg-pos-1 { left: calc(100% / 4); background: #f06292; }
.seg-thumb-couples.seg-pos-2 { left: calc(200% / 4); background: #ef5350; }
.seg-thumb-couples.seg-pos-3 { left: calc(300% / 4); background: #78909c; }

.seg-thumb-deceased.seg-pos-0 { background: var(--accent); }
.seg-thumb-deceased.seg-pos-1 { background: #78909c; }
.seg-thumb-deceased.seg-pos-2 { background: #4caf72; }

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
  padding: 5px 0;
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
