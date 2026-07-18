<template>
  <div class="graph-view">
    <ViewHeader icon="🕸" title="Graph" :count="store.persons.length">
      <CanvasToggles
        :show-focus="store.caps.focus && !spaceActive"
        show-rel-types
        :focus="focusOpen"
        :legend="legendOpen"
        :rel-types="relTypesOpen"
        @update:focus="focusOpen = $event"
        @update:legend="legendOpen = $event"
        @update:rel-types="relTypesOpen = $event"
      />
    </ViewHeader>
    <div
      ref="containerEl"
      class="graph-area"
      @dragover.prevent="onDirectoryDragOver"
      @drop.prevent="onDirectoryDrop"
    >
      <canvas v-show="!spaceActive" ref="glCanvasEl" class="graph-gl"></canvas>
      <canvas v-show="!spaceActive" ref="overlayEl" class="graph-overlay"></canvas>
      <!-- Experimental Space (3D) type takes over the stage; the 2D canvases keep
         their state hidden underneath, like the graph itself does across views -->
      <Graph3DView
        v-if="spaceActive"
        :key="activeSceneId + ':' + reloadTick"
        ref="graph3dRef"
        :scene-id="activeSceneId"
        :working="spaceWorking"
        :search-query="searchQuery"
        @persist="(id) => schedulePersist(id || activeSceneId)"
      />
      <div class="graph-search" :class="{ 'clean-hide-up': store.cleanView }">
        <span class="search-icon">🔍</span>
        <input
          v-model="searchQuery"
          placeholder="Search family members…"
          @input="highlightSearch"
        />
      </div>
      <MiniMap
        v-if="!spaceActive && store.persons.length"
        ref="minimapRef"
        :adapter="minimapAdapter"
        class="graph-minimap"
        :class="{ 'clean-hide-left': store.cleanView }"
      />
      <div class="bottom-bars" :class="{ 'clean-hide-down': store.cleanView }">
        <div class="graph-controls">
          <button
            class="ctrl-btn"
            title="Zoom in"
            @click="spaceActive ? graph3dRef?.dollyIn() : zoomIn()"
          >
            ＋
          </button>
          <button
            class="ctrl-btn"
            title="Zoom out"
            @click="spaceActive ? graph3dRef?.dollyOut() : zoomOut()"
          >
            －
          </button>
          <div class="ctrl-sep"></div>
          <button
            class="ctrl-btn"
            title="Fit all"
            @click="spaceActive ? graph3dRef?.fitAll() : fitAll()"
          >
            ⊡
          </button>
          <button
            class="ctrl-btn"
            title="Reset view"
            @click="spaceActive ? graph3dRef?.resetView() : resetZoom()"
          >
            ⊕
          </button>
          <div class="ctrl-sep"></div>
          <button
            v-for="m in visibleModes"
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
            @click="spaceActive ? graph3dRef?.refreshLayout() : refreshLayout()"
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
          <template v-if="spaceActive">
            <div class="ctrl-sep"></div>
            <button
              class="ctrl-btn"
              :class="{ 'ctrl-btn-active': graph3dRef?.autoRotateOn }"
              title="Auto-rotate (R)"
              @click="graph3dRef?.toggleAutoRotate()"
            >
              🌀
            </button>
            <button
              class="ctrl-btn"
              :class="{ 'ctrl-btn-active': graph3dRef?.layeredOn }"
              title="Generation layers (G)"
              @click="graph3dRef?.toggleLayers()"
            >
              ≡
            </button>
            <button
              class="ctrl-btn ctrl-btn-help"
              title="How to navigate in 3D (?)"
              @click="graph3dRef?.openHelp()"
            >
              ?
            </button>
          </template>
        </div>
        <SceneTabs
          v-if="store.caps.scenes"
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
      <!-- Action pane (lower-left, clear of the time slider): contextual verbs
         for whatever is selected — a person, a pair, a crowd, or a bond. -->
      <GraphActionPane
        :mode3d="spaceActive"
        :can-pin="currentMode === 'auto' && !spaceActive"
        :pinned="selPinned"
        :style-size="selStyle.size"
        :style-color="selStyle.color"
        :solo-type="soloType"
        @focus-person="focusOnPerson"
        @trace="traceFrom"
        @trace-pair="tracePair"
        @toggle-pin="togglePinSelected"
        @set-size="(v) => setSelectedStyle({ size: v })"
        @set-color="(c) => setSelectedStyle({ color: c })"
        @solo="toggleSolo"
      />

      <!-- Connection trace: armed hint / the traced chain / no-connection notice -->
      <Transition name="pathcard">
        <div v-if="pathAnchor && !pathInfo" key="armed" class="path-card path-armed">
          <span class="path-armed-beacon"></span>
          <span class="path-armed-name">{{ personName(pathAnchor) }}</span>
          <span class="path-armed-hint">ctrl-click another person to trace the connection</span>
          <button class="path-close" title="Cancel (Esc)" @click="clearPath">✕</button>
        </div>
        <div v-else-if="pathInfo && pathInfo.none" key="none" class="path-card path-none">
          <span class="path-none-icon">🛰</span>
          <span>
            No connection between <b>{{ personName(pathInfo.fromId) }}</b> and
            <b>{{ personName(pathInfo.toId) }}</b>
          </span>
          <button class="path-close" title="Dismiss (Esc)" @click="clearPath">✕</button>
        </div>
        <div v-else-if="pathActive" key="path" class="path-card">
          <div class="path-title">
            <span class="path-title-icon">🧭</span>
            Connection
            <span class="path-count">
              {{ pathHops.length - 1 }} hop{{ pathHops.length > 2 ? 's' : '' }}
            </span>
          </div>
          <div class="path-chain">
            <template v-for="(hop, i) in pathHops" :key="hop.id">
              <div v-if="hop.via" class="path-via" :style="{ '--i': i * 2 - 1 }">
                <span class="path-via-label">{{ hop.via.glyph }} {{ hop.via.text }}</span>
                <span class="path-via-line"></span>
              </div>
              <button
                class="path-person"
                :style="{ '--i': i * 2, '--pc': hop.color }"
                :title="'View ' + hop.name"
                @click="store.selectPerson(hop.id)"
              >
                <span class="path-person-dot"></span>
                {{ hop.name }}
              </button>
            </template>
          </div>
          <button class="path-close" title="Clear (Esc)" @click="clearPath">✕</button>
        </div>
      </Transition>
      <!-- Right-docked overlay panes: Focus, Relationships, Legend. They stack and
         spring in from the header toggle cluster; Clean view sweeps them away. -->
      <div class="canvas-pane-stack" :class="{ 'clean-hidden': store.cleanView }">
        <!-- Highlights (Focus) -->
        <Transition name="pane">
          <div
            v-if="focusOpen && store.caps.focus && !spaceActive"
            class="canvas-pane highlights-panel"
          >
            <div class="highlights-title">Focus</div>
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
                  <div
                    class="seg-thumb seg-thumb-deceased"
                    :class="'seg-pos-' + deceasedIndex"
                  ></div>
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
            <div class="highlight-divider"></div>
            <!-- Orbit rings: keep N hops around the selected person lit -->
            <div
              class="highlight-row"
              :class="{ 'highlight-disabled': !store.selectedPersonId }"
              :title="!store.selectedPersonId ? 'Select a person first' : ''"
            >
              <div class="highlight-label">Orbit</div>
              <div class="orbit-opts">
                <button
                  v-for="d in [0, 1, 2, 3]"
                  :key="d"
                  class="orbit-opt"
                  :class="{ on: egoDepth === d, rings: d > 0 }"
                  :disabled="!store.selectedPersonId && d > 0"
                  :title="d === 0 ? 'Off' : `${d} hop${d > 1 ? 's' : ''} around the selection`"
                  @click="egoDepth = d"
                >
                  <template v-if="d === 0">Off</template>
                  <template v-else>
                    <span v-for="r in d" :key="r" class="orbit-ring" :style="{ '--r': r }"></span>
                    <span class="orbit-num">{{ d }}</span>
                  </template>
                </button>
              </div>
            </div>
          </div>
        </Transition>

        <!-- Relationships: types, weight meters & the solo lens -->
        <Transition name="pane">
          <div v-if="relTypesOpen" class="canvas-pane reltypes-pane">
            <div class="panel-title">Relationships</div>
            <div class="rtl-scroll">
              <button
                v-for="(row, i) in relTypeRows"
                :key="row.key"
                class="rtl-row cp-stagger"
                :class="{ solo: soloType === row.key, faded: soloType && soloType !== row.key }"
                :style="{ '--i': i, '--rc': row.color }"
                :title="`${row.count} in use — click to isolate on the canvas`"
                @click="toggleSolo(row.key)"
              >
                <span class="rtl-glyph">{{ row.glyph }}</span>
                <span class="rtl-name">{{ row.label }}</span>
                <span class="rtl-count">{{ row.count }}</span>
                <span class="rtl-meter" title="structural ← → affinity / repel">
                  <span class="rtl-meter-axis"></span>
                  <span
                    class="rtl-meter-fill"
                    :class="{ neg: row.weight < 0 }"
                    :style="meterStyle(row.weight)"
                  ></span>
                </span>
              </button>
            </div>
            <!-- Romance intel: mutual sparks, longing, triangles & rivalries -->
            <div v-if="hasRomance" class="rtl-romance">
              <div class="rtl-romance-title">Romance</div>
              <div
                v-for="(m, i) in romance.mutual"
                :key="'m' + i"
                class="rtl-rom-row cp-stagger"
                :style="{ '--i': i }"
              >
                <span class="rtl-rom-icon rom-beat">💞</span>
                <span class="rtl-rom-text">
                  <b>{{ personName(m.a) }}</b> ⇆ <b>{{ personName(m.b) }}</b>
                </span>
              </div>
              <div
                v-for="(u, i) in romance.unrequited"
                :key="'u' + i"
                class="rtl-rom-row cp-stagger"
                :style="{ '--i': romance.mutual.length + i }"
              >
                <span class="rtl-rom-icon rom-drift">💘</span>
                <span class="rtl-rom-text">
                  <b>{{ personName(u.from) }}</b> pines for <b>{{ personName(u.to) }}</b>
                </span>
              </div>
              <div
                v-for="(t, i) in romance.triangles"
                :key="'t' + i"
                class="rtl-rom-row rtl-rom-triangle cp-stagger"
                :style="{ '--i': romance.mutual.length + romance.unrequited.length + i }"
              >
                <span class="rtl-rom-icon rom-spin">🔺</span>
                <span class="rtl-rom-text">
                  {{ t.map((id) => personName(id)).join(' → ') }} → …
                </span>
              </div>
              <div
                v-for="(rv, i) in romance.rivals"
                :key="'r' + i"
                class="rtl-rom-row cp-stagger"
                :style="{
                  '--i':
                    romance.mutual.length + romance.unrequited.length + romance.triangles.length + i
                }"
              >
                <span class="rtl-rom-icon rom-clash">⚔</span>
                <span class="rtl-rom-text">
                  {{ rv.admirers.map((id) => personName(id)).join(' & ') }} vie for
                  <b>{{ personName(rv.crush) }}</b>
                </span>
              </div>
            </div>

            <!-- Social gravity: pull friend/crush clusters together (organic layout) -->
            <div class="rtl-gravity" :title="'Boosts social-edge springs in the Organic layout'">
              <span class="rtl-gravity-icon" :class="{ pulling: socialPull > 1 }">🪐</span>
              <span class="rtl-gravity-label">Social gravity</span>
              <input
                v-model.number="socialPull"
                class="rtl-gravity-slider"
                type="range"
                min="1"
                max="4"
                step="0.5"
              />
              <span class="rtl-gravity-val">×{{ socialPull.toFixed(1) }}</span>
            </div>

            <div class="rtl-hint">
              {{
                soloType
                  ? '✦ Isolating one type — click again to reset'
                  : 'Click a type to isolate · Ctrl-click two people to trace their connection'
              }}
            </div>
          </div>
        </Transition>

        <!-- Legend -->
        <Transition name="pane">
          <div v-if="legendOpen" class="canvas-pane graph-legend">
            <div class="panel-title">Legend</div>
            <div class="leg-section">
              <div class="leg-section-label">Nodes</div>
              <div class="leg-row cp-stagger" :style="{ '--i': 0 }">
                <div class="leg-dot" :style="{ background: store.graphSettings.maleColor }"></div>
                Male
              </div>
              <div class="leg-row cp-stagger" :style="{ '--i': 1 }">
                <div class="leg-dot" :style="{ background: store.graphSettings.femaleColor }"></div>
                Female
              </div>
            </div>
            <div class="leg-section">
              <div class="leg-section-label">Lines</div>
              <div class="leg-row cp-stagger" :style="{ '--i': 2 }">
                <div
                  class="leg-line"
                  :style="{ background: store.graphSettings.parentChildColor }"
                ></div>
                Parent / Child
              </div>
              <div class="leg-row cp-stagger" :style="{ '--i': 3 }">
                <div
                  class="leg-line leg-dashed"
                  :style="{ borderColor: store.graphSettings.spouseColor }"
                ></div>
                Spouse
              </div>
              <div class="leg-row cp-stagger" :style="{ '--i': 4 }">
                <div
                  class="leg-line leg-dashed"
                  :style="{ borderColor: store.graphSettings.adoptedColor }"
                ></div>
                Adopted
              </div>
            </div>
          </div>
        </Transition>
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
  shortestPath,
  egoDistances,
  mutualLikesKeys,
  romanceInsights
} from './graph/graphInsights.js'
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
import { useTimeTravel } from './time/useTimeTravel'
import { toOrdinal } from '../../../shared/calendarMath'
import { WebGLGraphRenderer } from './graph/webgl/WebGLGraphRenderer.js'
import { screenToWorld, nodesExtent, fitExtent } from './graph/webgl/coords.js'
import { viewRectXYK } from './webgl/minimapMath'
import { withAlpha } from './webgl/overlayUtils.js'
import SceneTabs from './SceneTabs.vue'
import GraphActionPane from './graph/GraphActionPane.vue'
import Graph3DView from './Graph3DView.vue'
import MiniMap from './MiniMap.vue'
import ViewHeader from './ViewHeader.vue'
import CanvasToggles from './CanvasToggles.vue'

const store = useMainStore()
const tt = useTimeTravel()
const glCanvasEl = ref(null)
const overlayEl = ref(null)
const containerEl = ref(null)
const searchQuery = ref('')
const activeEmphasis = ref('neutral')
const focusOpen = ref(false) // Highlights pane (from the header toggle cluster)
const legendOpen = ref(true) // Legend pane toggle
const relTypesOpen = ref(false) // Relationships pane toggle
const soloType = ref(null) // when set, only this relationship type stays lit
const pathAnchor = ref(null) // first ctrl-clicked person (armed, waiting for the second)
const pathInfo = ref(null) // { ids, rels } | { none, fromId, toId } — the traced connection
const egoDepth = ref(0) // Orbit rings: 0 = off, 1..3 = hops kept lit around the selection
const socialPull = ref(1) // Social gravity ×1..×4 — boosts affinity-edge springs (organic)

const modes = [
  { id: 'custom', label: '✋ Free', title: 'Free — nodes stay where you put them' },
  { id: 'auto', label: '⚡ Organic', title: 'Organic — force-directed layout' },
  { id: 'age', label: '📅 Birth', title: 'Birth — vertical position by birth date' },
  { id: 'generation', label: '🏛 Generations', title: 'Generations — top-down hierarchy' },
  { id: 'space', label: '🪐 Space', title: 'Space — experimental 3D layout (Labs)' }
]

// Program-mode gating: Simple offers the Organic type only; the experimental
// Space type additionally needs Advanced mode + the Labs toggle (caps.space3d).
const visibleModes = computed(() => {
  if (!store.caps.typePicker) return modes.filter((m) => m.id === 'auto')
  return store.caps.space3d ? modes : modes.filter((m) => m.id !== 'space')
})

// ── Scenes ──────────────────────────────────────────────────────────────────
// The graph runs off view:'graph' Scenes: each carries a layout *type*
// (free/organic/birth/generations) plus its node positions and config. The
// interaction code below still thinks in the legacy internal mode ids, so map
// scene types onto them (labels get their user-facing rename in Phase 7).
const MODE_TO_TYPE = {
  custom: 'free',
  auto: 'organic',
  age: 'birth',
  generation: 'generations',
  space: 'space'
}
const TYPE_TO_MODE = {
  free: 'custom',
  organic: 'auto',
  birth: 'age',
  generations: 'generation',
  space: 'space'
}

const graphScenes = computed(() => store.graphScenes)
const activeSceneId = computed(() => store.activeSceneIds.graph)
const activeScene = computed(
  () => graphScenes.value.find((s) => s.id === activeSceneId.value) || null
)
const currentMode = computed(() => {
  const mode = TYPE_TO_MODE[activeScene.value?.type] || 'auto'
  // A 'space' scene degrades gracefully to Free when the experimental type is
  // gated off (Labs off / not Advanced): same positions, no 3D.
  if (mode === 'space' && !store.caps.space3d) return 'custom'
  return mode
})

// ── Experimental Space (3D) handoff ─────────────────────────────────────────
// While a space scene is active, Graph3DView owns the stage AND the working
// copy: the 2D snapshot machinery stands down (see snapshotActiveScene).
const spaceActive = computed(() => currentMode.value === 'space')
const graph3dRef = ref(null)
// Bumped by reloadScenes() (checkpoint revert) so the 3D view re-reads the
// recreated working copy — the working Map itself is not reactive.
const reloadTick = ref(0)
const spaceWorking = computed(() => {
  void reloadTick.value
  void activeScene.value?.type
  return workingOf(activeSceneId.value, 'space')
})

// Live working copies of each scene's arrangement, mutated as the user drags
// and autosaved. A scene holds ONE arrangement PER layout type, so switching
// type reveals that type's own layout without disturbing the others.
//   sceneId → { [layoutType]: { positions: {personId:{x,y}}, config: {...} } }
const working = new Map()
// The per-scene layouts bag, seeded from the stored scene (new `layouts` map,
// or the legacy flat positions/config folded into the scene's own type slot).
function layoutsOf(sceneId) {
  if (!sceneId) return null
  if (!working.has(sceneId)) {
    const s = store.scenes.find((sc) => sc.id === sceneId)
    const bag = s?.layouts ? JSON.parse(JSON.stringify(s.layouts)) : {}
    if (!s?.layouts && s) {
      bag[s.type || 'organic'] = {
        positions: JSON.parse(JSON.stringify(s.positions || {})),
        config: JSON.parse(JSON.stringify(s.config || {}))
      }
    }
    working.set(sceneId, bag)
  }
  return working.get(sceneId)
}
// The arrangement for one layout type (defaults to the scene's active type),
// created empty on first touch so a fresh type computes its layout on entry.
function workingOf(sceneId, type) {
  const bag = layoutsOf(sceneId)
  if (!bag) return null
  const t = type || activeScene.value?.type || 'organic'
  if (!bag[t]) bag[t] = { positions: {}, config: {} }
  return bag[t]
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

// Each layout type gets a signature transition, so switching type reads as a
// deliberate rearrangement rather than a jump:
//   • Free    — a soft settle, nodes near the centre easing out first (bloom).
//   • Organic — a quick relax before the force sim takes over.
//   • Birth   — a top-down cascade down the year axis, like sediment falling.
//   • Gens    — a springy top-to-bottom snap into generation rows.
// Scene switches use the bloom so a whole new arrangement unfolds from the
// middle outward.
function centerOf(nodes) {
  if (!nodes.length) return { x: 0, y: 0 }
  const xs = nodes.map((n) => n.x),
    ys = nodes.map((n) => n.y)
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
}
function bloomStagger(spread = 260) {
  const c = centerOf(ctx.nodesData)
  return {
    stagger: spread,
    staggerBy: (n, t) => Math.hypot((t?.x ?? n.x) - c.x, (t?.y ?? n.y) - c.y)
  }
}
// Durations + stagger are kept so the whole transition (duration + stagger)
// always finishes in under 0.5s.
const MOTION = {
  auto: () => ({ ease: d3.easeCubicOut, duration: 340 }),
  custom: () => ({ ease: d3.easeCubicInOut, duration: 320, ...bloomStagger(140) }),
  age: () => ({
    ease: d3.easeCubicOut,
    duration: 300,
    stagger: 170,
    staggerBy: (n, t) => t?.y ?? n.y
  }),
  generation: () => ({
    ease: d3.easeBackOut.overshoot(1.4),
    duration: 320,
    stagger: 160,
    staggerBy: (n, t) => t?.y ?? n.y
  })
}

// ── Minimap (top-left) ──────────────────────────────────────────────────────
// Reads the hot ctx directly and pans by driving the shared d3.zoom behaviour,
// so the camera transform stays the single source of truth.
const minimapRef = ref(null)
const minimapAdapter = {
  // The minimap works in render-space (logical × view stretch) so its dot cloud and
  // viewport box match the stretched on-screen layout; the uniform camera (x,y,k)
  // maps that space to the screen, so getView/panTo need no stretch awareness.
  getBounds: () => {
    const e = nodesExtent(ctx.nodesData)
    if (!e) return e
    const sx = ctx.transform.sx ?? 1,
      sy = ctx.transform.sy ?? 1
    return { minX: e.minX * sx, minY: e.minY * sy, maxX: e.maxX * sx, maxY: e.maxY * sy }
  },
  getView: () => {
    const el = ctx.containerRef
    return viewRectXYK(ctx.transform, el?.clientWidth || 0, el?.clientHeight || 0)
  },
  drawContent: (g, proj, colors) => {
    const sel = store.selectedPersonId
    const gsx = ctx.transform.sx ?? 1,
      gsy = ctx.transform.sy ?? 1
    let selNode = null
    g.fillStyle = withAlpha(colors.t2, 0.55)
    for (const n of ctx.nodesData) {
      if (n.id === sel) {
        selNode = n
        continue
      }
      g.fillRect(n.x * gsx * proj.sx + proj.ox - 1, n.y * gsy * proj.sy + proj.oy - 1, 2, 2)
    }
    if (selNode) {
      g.fillStyle = colors.accent
      g.beginPath()
      g.arc(
        selNode.x * gsx * proj.sx + proj.ox,
        selNode.y * gsy * proj.sy + proj.oy,
        2.5,
        0,
        Math.PI * 2
      )
      g.fill()
    }
  },
  panTo: (wx, wy, opts) => {
    const el = ctx.containerRef
    if (!el || !ctx.zoomBehavior || !ctx.zoomSelection) return
    const k = ctx.transform.k
    const t = d3.zoomIdentity
      .translate(el.clientWidth / 2 - wx * k, el.clientHeight / 2 - wy * k)
      .scale(k)
    if (opts?.smooth) {
      ctx.zoomSelection.transition().duration(260).call(ctx.zoomBehavior.transform, t)
    } else {
      ctx.zoomSelection.interrupt().call(ctx.zoomBehavior.transform, t)
    }
  }
}

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

// ── Relationships pane (types, weights & the solo lens) ─────────────────────
// The legacy trio still reads its colour from the Style panel; every other
// registry type carries its own swatch.
function relTypeColor(def) {
  const gs = store.graphSettings
  if (def.key === 'spouse') return gs.spouseColor
  if (def.key === 'adopted') return gs.adoptedColor
  if (def.key === 'parent_child') return gs.parentChildColor
  return def.color || gs.parentChildColor
}
const relTypeRows = computed(() => {
  const counts = new Map()
  for (const r of store.relationships) counts.set(r.type, (counts.get(r.type) || 0) + 1)
  return store.relTypes.map((d) => ({
    key: d.key,
    label: d.label,
    glyph: d.glyph,
    weight: d.weight,
    directed: d.directed,
    color: relTypeColor(d),
    count: counts.get(d.key) || 0
  }))
})
// Weight meter geometry: a centre-anchored bar. Positive (structural) fills to
// the right in the type colour; negative (repel) fills left in a warning red.
function meterStyle(weight) {
  const pct = Math.min(1, Math.abs(weight)) * 50
  return weight >= 0 ? { left: '50%', width: pct + '%' } : { right: '50%', width: pct + '%' }
}
// Click a type to "solo" it — every other edge fades back (an edge lens). The
// dimming happens in linkVisual; here we just flip state and restyle.
function toggleSolo(key) {
  soloType.value = soloType.value === key ? null : key
  markLinkStyles()
}
watch(soloType, () => markLinkStyles())

// ── Connection trace (ctrl-click two people) ────────────────────────────────
// First ctrl-click arms an anchor; the second runs a BFS over EVERY edge type
// and lights the shortest chain — nodes stay lit, path links become flowing
// marching-ants, everything else recedes. Esc or ✕ clears.
const pathIdSet = computed(() => new Set(pathInfo.value?.ids || []))
const pathRelIdSet = computed(() => new Set((pathInfo.value?.rels || []).map((r) => r.id)))
const pathActive = computed(() => !!pathInfo.value && !pathInfo.value.none)

function handlePathClick(node) {
  store.relPopup = null
  if (!pathAnchor.value || pathInfo.value) {
    // (Re)arm on this person.
    pathInfo.value = null
    pathAnchor.value = node.id
  } else if (pathAnchor.value === node.id) {
    pathAnchor.value = null // disarm
  } else {
    const res = shortestPath(pathAnchor.value, node.id, store.relationships)
    pathInfo.value = res || { none: true, fromId: pathAnchor.value, toId: node.id }
    pathAnchor.value = null
  }
}

function clearPath() {
  pathInfo.value = null
  pathAnchor.value = null
}

function personName(id) {
  return store.persons.find((p) => p.id === id)?.name || 'Unnamed'
}
function personColor(id) {
  const p = store.persons.find((x) => x.id === id)
  return p ? nodeColor(p.gender, store.graphSettings, p.gender_t) : 'var(--accent)'
}

/** The traced chain as displayable hops: person chips + the joining role label. */
const pathHops = computed(() => {
  const info = pathInfo.value
  if (!info || info.none) return []
  return info.ids.map((id, i) => {
    let via = null
    if (i > 0) {
      const r = info.rels[i - 1]
      const def = store.relTypeByKey.get(r.type)
      if (r.label) via = { text: r.label, glyph: def?.glyph || '·' }
      else if (!def) via = { text: r.type, glyph: '·' }
      else if (def.directed) {
        // rels[i-1] joins ids[i-1] → ids[i]; name the PREVIOUS person's role.
        const prevIsA = r.person_a_id === info.ids[i - 1]
        via = { text: `${prevIsA ? def.role_a : def.role_b} of`, glyph: def.glyph }
      } else via = { text: def.label, glyph: def.glyph }
    }
    return { id, name: personName(id), color: personColor(id), via }
  })
})

// Members vanished (person/relationship deleted) → the trace no longer holds,
// and a selected bond that no longer exists must leave the action pane.
watch(
  () => store.relationships.length + ':' + store.persons.length,
  () => {
    if (pathInfo.value || pathAnchor.value) clearPath()
    const selRel = store.relPopup?.rel
    if (selRel && !store.relationships.some((r) => r.id === selRel.id)) store.relPopup = null
  }
)
watch([pathInfo, pathAnchor], () => {
  markNodeStyles()
  markLinkStyles()
})

// ── Orbit rings (ego view) ──────────────────────────────────────────────────
// With a person selected, everyone fades by hop distance beyond the chosen
// ring count. Recomputed only while active.
const egoMap = computed(() => {
  if (!egoDepth.value || !store.selectedPersonId) return null
  return egoDistances(store.selectedPersonId, store.relationships)
})
watch([egoDepth, egoMap], () => {
  markNodeStyles()
  markLinkStyles()
})

// ── Romance intel (likes edges) ─────────────────────────────────────────────
const mutualLikes = computed(() => mutualLikesKeys(store.relationships))
const romance = computed(() => romanceInsights(store.relationships))
const hasRomance = computed(() => {
  const r = romance.value
  return r.mutual.length + r.unrequited.length + r.triangles.length + r.rivals.length > 0
})

// Social gravity: re-parameterize the springs live as the slider moves.
watch(socialPull, () => {
  applyLinkForceParams()
  if (currentMode.value === 'auto') ctx.simulation?.alpha(0.4).restart()
})

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

// ── Action pane support (selection verbs + per-node style overrides) ────────
// Per-node visual overrides ({ size?, color? } by person id) live in the active
// scene's layouts bag under a `styles` key, so they persist through the normal
// scenes:save autosave and follow duplicates/checkpoints like positions do.
// `activeStyles` is the live (non-reactive) object nodeVisual() reads; `uiTick`
// lets the pane's computeds see mutations to it (and to node pins).
let activeStyles = {}
const uiTick = ref(0)

function refreshActiveStyles() {
  const bag = layoutsOf(activeSceneId.value)
  if (bag) {
    if (!bag.styles) bag.styles = {}
    activeStyles = bag.styles
  } else {
    activeStyles = {}
  }
  uiTick.value++
}

/** Apply a style patch ({size} and/or {color}; 1 / null clear back to default)
 *  to every selected person, restyle, and autosave the scene. */
function setSelectedStyle(patch) {
  const bag = layoutsOf(activeSceneId.value)
  if (!bag || !store.selectedPersonIds.length) return
  if (!bag.styles) bag.styles = {}
  activeStyles = bag.styles
  for (const id of store.selectedPersonIds) {
    const next = { ...(activeStyles[id] || {}) }
    if ('size' in patch) {
      if (!patch.size || patch.size === 1) delete next.size
      else next.size = patch.size
    }
    if ('color' in patch) {
      if (!patch.color) delete next.color
      else next.color = patch.color
    }
    if (Object.keys(next).length) activeStyles[id] = next
    else delete activeStyles[id]
  }
  uiTick.value++
  markNodeStyles()
  schedulePersist(activeSceneId.value)
}

// The pane's chips reflect the primary (last-touched) selected person.
const selStyle = computed(() => {
  void uiTick.value
  const ids = store.selectedPersonIds
  const ov = ids.length ? activeStyles[ids[ids.length - 1]] : null
  return { size: ov?.size ?? 1, color: ov?.color ?? null }
})

const selPinned = computed(() => {
  void uiTick.value
  const id = store.selectedPersonId
  if (!id) return false
  const n = ctx.nodesData.find((x) => x.id === id)
  return !!n && n.fx != null
})

function togglePinSelected() {
  const id = store.selectedPersonId
  const n = id && ctx.nodesData.find((x) => x.id === id)
  if (!n) return
  if (n.fx != null) {
    n.fx = null
    n.fy = null
    if (currentMode.value === 'auto') ctx.simulation?.alpha(0.15).restart()
  } else {
    n.fx = n.x
    n.fy = n.y
  }
  uiTick.value++
}

/** Glide the camera to a person (kept at ≥1.1× so the arrival feels close). */
function focusOnPerson(id) {
  const n = ctx.nodesData.find((x) => x.id === id)
  const el = ctx.containerRef
  if (!n || !el || !ctx.zoomBehavior) return
  const k = Math.max(ctx.transform.k, 1.1)
  const sx = ctx.transform.sx ?? 1,
    sy = ctx.transform.sy ?? 1
  const t = d3.zoomIdentity
    .translate(el.clientWidth / 2 - n.x * sx * k, el.clientHeight / 2 - n.y * sy * k)
    .scale(k)
  ctx.zoomSelection
    ?.transition()
    .duration(520)
    .ease(d3.easeCubicInOut)
    .call(ctx.zoomBehavior.transform, t)
}

/** Arm the connection trace from this person (pane's Trace button). */
function traceFrom(id) {
  pathInfo.value = null
  pathAnchor.value = id
}

/** Trace the chain between the two selected people directly. */
function tracePair([a, b]) {
  pathAnchor.value = null
  pathInfo.value = shortestPath(a, b, store.relationships) || { none: true, fromId: a, toId: b }
}

// ── Snapshot helpers ────────────────────────────────────────────────────────
// Snapshot the live node positions (and generation rows / emphasis) into the
// active scene's working copy. All the legacy per-mode snapshot entry points
// funnel here — a scene has exactly one arrangement.
function snapshotActiveScene() {
  // In the Space (3D) type the 3D view owns the arrangement and writes the
  // working copy itself — snapshotting the (stale) 2D nodes would clobber it.
  if (currentMode.value === 'space') return
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
  refreshActiveStyles() // point nodeVisual at this scene's per-node overrides
  removeGuides(ctx)
  const mode = currentMode.value
  if (mode === 'space') {
    // Graph3DView (mounted by spaceActive) enters the scene itself; just make
    // sure the hidden 2D stage is quiet.
    ctx.simulation.stop()
    removeCurrentYearLine(ctx)
    return
  }
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
  graph3dRef.value?.writeBack?.() // fold in a live 3D arrangement first
  if (ctx.nodesData.length) saveCurrentState()
  store.setActiveScene('graph', id)
  enterActiveScene()
}

// New scene: a clean slate. Starts on Organic with empty layouts, so every
// layout type computes fresh on first entry — a genuinely new arrangement of
// the same people. (Duplicate is the "copy what I have" path.)
async function addScene() {
  graph3dRef.value?.writeBack?.()
  if (ctx.nodesData.length) saveCurrentState()
  const res = await store.createScene('graph', `Scene ${graphScenes.value.length + 1}`, {
    type: 'organic',
    layouts: {},
    positions: {},
    config: {}
  })
  if (res?.success) {
    store.setActiveScene('graph', res.data.id)
    enterActiveScene()
  }
}

async function duplicateActiveScene() {
  const id = activeSceneId.value
  if (!id) return
  graph3dRef.value?.writeBack?.()
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

/** Persist one scene's working arrangement (every layout type) through the
 *  data-access chain. The active type is also mirrored into the flat
 *  positions/config so legacy readers, checkpoints and duplicates still see
 *  the visible arrangement. */
async function persistScene(sceneId) {
  const bag = working.get(sceneId)
  const scene = store.scenes.find((s) => s.id === sceneId)
  if (!bag || !scene) return
  const type = scene.type || 'organic'
  const active = bag[type] || { positions: {}, config: {} }
  await store.saveScene({
    id: sceneId,
    layouts: JSON.parse(JSON.stringify(bag)),
    positions: JSON.parse(JSON.stringify(active.positions || {})),
    config: JSON.parse(JSON.stringify(active.config || {}))
  })
}

// ── Ticked ──────────────────────────────────────────────────────────────────
// The single render sink. Under WebGL it just marks the picker stale and requests a redraw;
// the renderer's on-demand loop reads node positions and repaints (nodes + links + overlay).
function ticked() {
  if (!ctx.renderer) return
  ctx.renderer.invalidatePicker()
  ctx.renderer.requestRedraw()
  minimapRef.value?.redraw()
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

// ── Time travel ─────────────────────────────────────────────────────────────
// While the Time slider is active (tt.gateYear < Infinity) people outside the
// framed window — not yet born, or born before the start nub — collapse to
// opacity 0 (the renderer's style tweens animate the pop-in/out); the freshly-
// appeared get a glow/width flash. Nodes stay in the simulation either way so
// positions never reshuffle while scrubbing. `_tBirth` / `_tAppear` are stamped
// in updateGraph().
const FRESH_YEARS = 1.6

function nodeTimeHidden(n) {
  if (n._tBirth == null) return false
  return n._tBirth > tt.gateYear.value || n._tBirth < tt.gateStartYear.value
}

function linkTimeHidden(d) {
  if (tt.gateYear.value === Infinity) return false
  // After the simulation wires links, source/target are the node objects.
  if (typeof d.source === 'object' && nodeTimeHidden(d.source)) return true
  if (typeof d.target === 'object' && nodeTimeHidden(d.target)) return true
  if (d._tAppear == null) return false
  return d._tAppear > tt.gateYear.value || d._tAppear < tt.gateStartYear.value
}

// ── Per-node / per-link visual descriptors (single source of truth for styling) ──────
// These reproduce the old SVG renderNodes/renderLinks styling, including the Highlights
// panel filters, but as plain values consumed by the WebGL layers each redraw.
function nodeVisual(n) {
  const gs = store.graphSettings
  const selected = store.selectedPersonId === n.id || store.selectedPersonIds.includes(n.id)
  // Per-node overrides from the action pane (scene-scoped): custom fill + size.
  const ov = activeStyles[n.id]
  const baseFill = ov?.color || nodeColor(n.gender, gs, n.gender_t)
  const fill = selected ? d3.color(baseFill)?.brighter(0.4)?.toString() || baseFill : baseFill

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

  // Connection trace: the chain stays lit (endpoints swell), the rest recede.
  let pathGlow = false
  if (pathActive.value) {
    if (pathIdSet.value.has(n.id)) {
      const ids = pathInfo.value.ids
      if (n.id === ids[0] || n.id === ids[ids.length - 1]) {
        radiusMul = Math.max(radiusMul, 1.2)
        pathGlow = true
      }
    } else {
      opacityMul *= 0.1
    }
  } else if (egoMap.value) {
    // Orbit rings: fade with hop distance beyond the chosen ring count.
    const dist = egoMap.value.get(n.id)
    if (dist === 0) {
      radiusMul = Math.max(radiusMul, 1.18)
      pathGlow = true
    } else if (dist == null || dist > egoDepth.value) {
      opacityMul *= 0.07
    } else {
      opacityMul *= Math.max(0.45, 1 - dist * 0.16)
    }
  }
  // Armed trace anchor: a beacon while waiting for the second ctrl-click.
  if (pathAnchor.value === n.id && !pathInfo.value) {
    pathGlow = true
    radiusMul = Math.max(radiusMul, 1.2)
  }

  const tY = tt.gateYear.value
  const tStart = tt.gateStartYear.value
  let timeGlow = false
  if (tY !== Infinity) {
    if (n._tBirth == null) {
      opacityMul *= 0.45 // undated people can't "appear" — keep them as faint context
    } else if (n._tBirth > tY || n._tBirth < tStart) {
      opacityMul = 0
      radiusMul *= 0.2 // scale-in pop when the tween brings them back into the window
    } else if (tY - n._tBirth < FRESH_YEARS) {
      timeGlow = true // birth flash while time flows past them
    }
  }

  // Highlight-slot ring: a colored border (selection still wins).
  const hl = n.highlight ? n.highlight.color || '#f5a623' : null
  return {
    radius: gs.nodeRadius * radiusMul * (ov?.size ?? 1),
    fill,
    border: selected ? '#6c8ef5' : hl || '#ffffff',
    borderPx: selected ? 3 : hl ? 2.6 : 1.5,
    borderA: selected ? 0.95 : hl ? 0.92 : 0.18,
    opacity: gs.nodeOpacity * opacityMul,
    selected,
    glow: selected || timeGlow || pathGlow || (hoverId === n.id && gs.glowOnHover) ? 1 : 0,
    imageUrl: n.primary_image ? getImageUrl(n.primary_image) : null
  }
}

const MARKER_COLORS = {
  'url(#arr-pat)': '#4a90d9',
  'url(#arr-mat)': '#d94a8a',
  'url(#arr-pat-ad)': '#7bb8f0',
  'url(#arr-mat-ad)': '#eda0c4'
}
function markerColor(marker, gs, def) {
  // Directed registry types (likes, mentor, custom…) arrow in their own color.
  if (marker === 'url(#arr)') return def?.color || gs.parentChildColor
  if (marker === 'url(#arr-a)') return gs.adoptedColor
  return MARKER_COLORS[marker] || gs.parentChildColor
}

function linkVisual(d) {
  const gs = store.graphSettings,
    emph = emphVisual(),
    persons = store.persons
  const def = store.relTypeByKey.get(d.type)
  const colorHex = getLinkStroke(d, emph, gs, persons, def)
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

  const tY = tt.gateYear.value
  let timeHidden = false
  let timeDissolved = false
  if (tY !== Infinity) {
    if (linkTimeHidden(d)) {
      opacity = 0
      timeHidden = true // arrowheads don't fade with opacity — shrink them away too
    } else if (d._tEnd != null && tY > d._tEnd) {
      // The bond ended before the scrubbed year: a faint dashed ghost of it.
      opacity *= 0.16
      timeDissolved = true
    } else if (d._tAppear != null && tY - d._tAppear < FRESH_YEARS) {
      // Just formed/born: a brief width + opacity surge as time flows past
      width *= 1.6
      opacity = Math.min(1, opacity * 1.6)
    }
  }

  const dashStr = getDashArray(d, def)
  let dashLen = 0,
    dashGap = 0
  if (dashStr) {
    const p = dashStr.split(',').map(Number)
    dashLen = p[0]
    dashGap = p[1]
  }
  if (timeDissolved) {
    dashLen = 3
    dashGap = 4
  }

  // Solo lens (Relationships pane): the chosen type stays lit, the rest fade.
  if (soloType.value && d.type !== soloType.value) {
    opacity *= 0.07
  }

  // Orbit rings: links out past the lit rings recede with their people.
  if (!pathActive.value && egoMap.value) {
    const da = egoMap.value.get(d.person_a_id)
    const db = egoMap.value.get(d.person_b_id)
    const dmax = da == null || db == null ? Infinity : Math.max(da, db)
    if (dmax > egoDepth.value) opacity *= 0.05
  }

  // ── Ambient life ──────────────────────────────────────────────────────────
  // flow drifts the dash pattern along the curve (LinkMaterial's uTime);
  // fadeTo ramps opacity toward the target — the "longing gradient".
  let flow = 0
  let fadeTo = 1
  if (d.type === 'likes') {
    const mutual = mutualLikes.value.has([d.person_a_id, d.person_b_id].sort().join('~'))
    if (mutual) {
      flow = 16 // requited: both arcs shimmer toward each other
      opacity = Math.min(1, opacity * 1.25)
    } else {
      fadeTo = 0.15 // dissolves as it reaches the crush
      flow = 26 // dashes drift toward them — animated longing
    }
  } else if (def && def.weight < 0) {
    flow = -22 // rivalry: tension marching back toward the aggressor
  }
  // The solo lens brings its isolated type to life.
  if (soloType.value === d.type && dashLen > 0 && !flow) flow = 24

  // Connection trace: the chain becomes flowing marching-ants; everything
  // off-path recedes. Applied last — the trace always wins.
  if (pathActive.value) {
    if (pathRelIdSet.value.has(d.id)) {
      opacity = Math.min(1, gs.linkOpacity * 1.9)
      width = Math.max(width * 1.6, 3.2)
      dashLen = 7
      dashGap = 5
      flow = 34
      fadeTo = 1
    } else {
      opacity *= 0.05
      flow = 0
    }
  }

  const marker = getLinkMarker(d, emph, persons, def)
  const isPatMat = marker && (marker.includes('pat') || marker.includes('mat'))
  return {
    colorHex,
    width,
    opacity,
    dashLen,
    dashGap,
    flow,
    fadeTo,
    arrowColor: marker ? markerColor(marker, gs, def) : null,
    arrowSize: timeHidden ? 0 : isPatMat ? 14 : 9
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
      // d3 owns pan/uniform-zoom (x,y,k); the per-axis stretch (sx,sy) is layered
      // on outside d3 by onStretchWheel — carry it across so it isn't wiped here.
      ctx.transform = {
        x: e.transform.x,
        y: e.transform.y,
        k: e.transform.k,
        sx: ctx.transform.sx ?? 1,
        sy: ctx.transform.sy ?? 1
      }
      ctx.renderer.setCamera(ctx.transform)
      minimapRef.value?.redraw()
    })
  ctx.zoomSelection = d3.select(overlayEl.value)
  ctx.zoomSelection.call(ctx.zoomBehavior)
  // Double-click opens the profile card (see onDblClick) — not a d3 zoom step.
  ctx.zoomSelection.on('dblclick.zoom', null)
  overlayEl.value.addEventListener('wheel', onStretchWheel, { passive: false })
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
    .force('repelLinks', repelLinksForce())
    .force('charge', d3.forceManyBody().strength(-380))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide(52))
    .on('tick', ticked)
  applyLinkForceParams()

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

// ── Structural-weight force wiring ──────────────────────────────────────────
// Every link's spring reads its type's structural weight from the registry:
// +1 = family skeleton (full spring), 0 = decorative overlay (no force),
// negative = rivals (no spring; the repelLinks force pushes them apart).
function linkWeightOf(d) {
  return store.relTypeByKey.get(d.type)?.weight ?? 0
}

/** (Re)apply the per-link distance/strength functions. d3 caches per-link
 *  values at initialize time, so this must be recalled whenever
 *  gs.linkDistance or a type's weight changes. */
function applyLinkForceParams() {
  if (!ctx.simulation) return
  const link = ctx.simulation.force('link')
  if (!link) return
  // Social gravity (Relationships pane): boosts affinity-band springs so
  // friend/crush clusters visibly pull together, capped below family bonds.
  const effWeight = (d) => {
    const w = linkWeightOf(d)
    if (w <= 0 || w >= 0.5) return w
    return Math.min(0.85, w * socialPull.value)
  }
  link
    .distance((d) => {
      // Weaker bonds sit a little longer, up to 1.6× for pure-affinity edges.
      const w = Math.max(0, Math.min(1, effWeight(d)))
      return store.graphSettings.linkDistance * (1 + (1 - w) * 0.6)
    })
    .strength((d) => 0.4 * Math.max(0, effWeight(d)))
}

/** Soft pairwise repulsion for negative-weight edges: pushes the two endpoints
 *  apart inside an influence radius, scaled by |weight| and alpha (a spring
 *  with a negative strength is unstable in d3, so rivals get this instead). */
function repelLinksForce() {
  let links = []
  const R = 420 // influence radius (world px)
  const force = (alpha) => {
    for (const l of links) {
      const w = linkWeightOf(l)
      if (w >= 0) continue
      const s = l.source
      const t = l.target
      if (typeof s !== 'object' || typeof t !== 'object') continue
      let dx = t.x - s.x
      let dy = t.y - s.y
      let dist = Math.hypot(dx, dy)
      if (dist < 1) {
        dx = 1
        dy = 0
        dist = 1
      }
      if (dist >= R) continue
      const k = -w * alpha * 30 * (1 - dist / R)
      const fx = (dx / dist) * k
      const fy = (dy / dist) * k
      t.vx += fx
      t.vy += fy
      s.vx -= fx
      s.vy -= fy
    }
  }
  force.links = (l) => {
    links = l
    return force
  }
  return force
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
  // Stamp the Time-travel ordinals: a person appears at their birth; a spouse
  // link at its formed date (else when both partners exist); a parent/child or
  // adopted link when the child (person_b) is born.
  newNodes.forEach((n) => {
    n._tBirth = toOrdinal(n.birth)
  })
  const birthOrdById = new Map(newNodes.map((n) => [n.id, n._tBirth]))
  ctx.linksData = store.relationships.map((r) => {
    let appear = toOrdinal(r.formed)
    const ba = birthOrdById.get(r.person_a_id) ?? null
    const bb = birthOrdById.get(r.person_b_id) ?? null
    if (r.type === 'spouse') {
      if (appear == null) appear = ba != null && bb != null ? Math.max(ba, bb) : null
    } else {
      appear = bb ?? appear
    }
    return {
      ...r,
      source: r.person_a_id,
      target: r.person_b_id,
      _tAppear: appear,
      // When the bond ended (divorce, falling-out): time travel past this year
      // fades the edge to a dashed ghost instead of hiding it.
      _tEnd: toOrdinal(r.ended)
    }
  })
  // Drop stale interaction refs to nodes that no longer exist.
  if (hoverId && !newNodes.some((n) => n.id === hoverId)) hoverId = null
  if (drag && !newNodes.includes(drag.node)) drag = null
  ctx.simulation.nodes(ctx.nodesData)
  ctx.simulation.force('link').links(ctx.linksData)
  ctx.simulation.force('repelLinks')?.links(ctx.linksData)
  if (currentMode.value === 'auto') ctx.simulation.alpha(hadNew ? 0.3 : 0.1).restart()
  recomputeCouplesSet()
  ctx.renderer.setData(ctx.nodesData, ctx.linksData)
  minimapRef.value?.redraw()
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

// Picker that ignores nodes hidden by the Time slider (they're invisible but
// still live in the quadtree, since they never leave the simulation).
function pickVisibleNode(wx, wy) {
  const n = ctx.renderer?.pickNode(wx, wy, hitRadius())
  return n && nodeTimeHidden(n) ? null : n
}

function zoomFilter(event) {
  // Plain wheel → d3 uniform zoom. Holding X / Z arms directional stretch,
  // handled by onStretchWheel instead, so keep d3 out of it.
  if (event.type === 'wheel') return !stretchArmed()
  if (event.button != null && event.button !== 0) return false
  const w = clientToWorld(event.clientX, event.clientY)
  const hit = pickVisibleNode(w.x, w.y)
  if (hit && !store.lockNodes) return false // grabbing a node -> no pan
  return true
}

// ── Directional (per-axis) stretch-zoom ──────────────────────────────────────
// Hold X and scroll to stretch the layout horizontally, Z to stretch it
// vertically. The stretch lives on the camera transform as sx/sy and is baked
// into positions by the renderer, so nodes stay perfectly round and link strokes
// keep a uniform width. The point under the cursor is held fixed on the stretched
// axis; we push the anchored pan back through d3 so its internal transform stays
// in sync with ours. The keys are ignored while a text field is focused, so
// typing "x"/"z" never arms a zoom.
const stretchKeys = new Set() // 'x' (horizontal) and/or 'z' (vertical) held
const stretchArmed = () => stretchKeys.size > 0

function isTypingTarget(el) {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true
}
function onStretchKeyDown(e) {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
  if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return
  const k = e.key.toLowerCase()
  if (k === 'x' || k === 'z') stretchKeys.add(k)
}
function onStretchKeyUp(e) {
  const k = e.key.toLowerCase()
  if (k === 'x' || k === 'z') stretchKeys.delete(k)
}
function clearStretchKeys() {
  stretchKeys.clear()
}

const STRETCH_MIN = 0.25
const STRETCH_MAX = 4
function onStretchWheel(e) {
  // A focused text field disables directional zoom entirely.
  if (isTypingTarget(document.activeElement)) return
  const horiz = stretchKeys.has('x')
  const vert = stretchKeys.has('z')
  if (!horiz && !vert) return // plain wheel → let d3 do uniform zoom
  if (spaceActive.value) return // 3D space owns its own camera
  e.preventDefault()
  const rect = overlayEl.value.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX
  const factor = Math.exp(-delta * 0.0022)
  const t = ctx.transform
  let sx = t.sx ?? 1,
    sy = t.sy ?? 1
  let tx = t.x,
    ty = t.y
  if (horiz) {
    const ns = Math.min(STRETCH_MAX, Math.max(STRETCH_MIN, sx * factor))
    tx = mx - (mx - tx) * (ns / sx)
    sx = ns
  }
  if (vert) {
    const ns = Math.min(STRETCH_MAX, Math.max(STRETCH_MIN, sy * factor))
    ty = my - (my - ty) * (ns / sy)
    sy = ns
  }
  ctx.transform.sx = sx
  ctx.transform.sy = sy
  // Re-emit through d3 with the anchored pan; the zoom handler rebuilds
  // ctx.transform and preserves the sx/sy we just set.
  ctx.zoomSelection
    ?.interrupt()
    .call(ctx.zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(t.k))
}

function installPointerHandlers() {
  const el = overlayEl.value
  el.addEventListener('pointerdown', onPointerDown)
  el.addEventListener('pointermove', onHoverMove)
  el.addEventListener('dblclick', onDblClick)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}
function removePointerHandlers() {
  const el = overlayEl.value
  if (el) {
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointermove', onHoverMove)
    el.removeEventListener('dblclick', onDblClick)
    el.removeEventListener('wheel', onStretchWheel)
  }
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

function onPointerDown(e) {
  if (e.button !== 0) return
  // Modifier-clicks are graph gestures, never text-selection gestures — without
  // this a shift-click extends whatever DOM selection exists and floods the
  // whole app with highlighted text.
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    e.preventDefault()
    window.getSelection?.()?.removeAllRanges?.()
  }
  const w = clientToWorld(e.clientX, e.clientY)
  const node = pickVisibleNode(w.x, w.y)
  // Ctrl/Cmd-click = connection trace (arm an anchor / trace to the second person)
  // — intercepted before dragging so the node never budges.
  if ((e.ctrlKey || e.metaKey) && node) {
    handlePathClick(node)
    return
  }
  // Shift-click = toggle this person in the multi-selection (no drag, no modal).
  if (e.shiftKey && node) {
    store.relPopup = null
    store.toggleSelectPerson(node.id)
    return
  }
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

function onPointerUp(e) {
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
    // A press that never moved is a plain click → select the person (the
    // action pane appears; Details / double-click opens the profile card).
    if (!drag.moved) {
      store.relPopup = null
      store.selectPerson(d.id, { modal: false })
    }
    drag = null
    return
  }
  // Click (press with no meaningful movement) → select node / select line / deselect.
  if (pending && !pending.moved) {
    const w = clientToWorld(pending.downX, pending.downY)
    const node = pickVisibleNode(w.x, w.y)
    if (node) {
      if (!store.lockNodes) {
        store.relPopup = null
        store.selectPerson(node.id, { modal: false })
      }
    } else {
      let link = store.lockLines ? null : ctx.renderer?.pickLink(w.x, w.y, store.graphSettings)
      if (link && linkTimeHidden(link)) link = null
      if (link) {
        store.selectPerson(null, { modal: false })
        store.relPopup = { rel: link }
      } else if (!e.shiftKey) {
        // A missed shift-click keeps the multi-selection — the user is mid-way
        // through building it, and a stray click shouldn't wipe it.
        store.selectPerson(null, { modal: false })
        store.relPopup = null
      }
    }
  }
  pending = null
}

// Double-click a person → the full profile card (single click just selects).
function onDblClick(e) {
  const w = clientToWorld(e.clientX, e.clientY)
  const node = pickVisibleNode(w.x, w.y)
  if (node && !store.lockNodes) {
    store.relPopup = null
    store.selectPerson(node.id)
  }
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
  const node = pickVisibleNode(w.x, w.y)
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
  // Leaving the 3D stage: fold its live arrangement into the working copy
  // BEFORE the mode flips (the 2D entry below animates to these positions).
  if (currentMode.value === 'space') graph3dRef.value?.writeBack?.()
  if (ctx.nodesData.length) saveCurrentState()
  removeGuides(ctx)

  const type = MODE_TO_TYPE[newMode]
  scene.type = type // optimistic — currentMode flips immediately
  store.saveScene({ id: scene.id, type })

  if (newMode === 'space') {
    // Graph3DView mounts via spaceActive and enters the scene itself.
    ctx.simulation.stop()
    removeCurrentYearLine(ctx)
    return
  }

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
    animateToPositionsWithReset(
      ctx.activeSnapshot,
      () => {
        ctx.nodesData.forEach((n) => {
          n.fx = null
          n.fy = null
          n.vx = 0
          n.vy = 0
        })
        ctx.simulation.alpha(0.15).restart()
        reapplyDrag()
      },
      MOTION.auto()
    )
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
    animateToPositionsWithReset(
      ctx.activeSnapshot,
      () => {
        ctx.nodesData.forEach((n) => {
          n.fx = n.x
          n.fy = n.y
        })
        reapplyDrag()
      },
      MOTION.custom()
    )
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
    animateToPositionsWithReset(
      targets,
      () => {
        ctx.nodesData.forEach((n) => {
          n.fx = n.x
          n.fy = ageInfo.yMap[n.id]
        })
        drawYearGuides(ctx, ageInfo.minYear, ageInfo.maxYear, ageInfo.padding, ageInfo.usableHeight)
        drawCurrentYearLine(ctx, ageInfo, store.currentDate?.year ?? null, false)
        reapplyDrag()
      },
      MOTION.age()
    )
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
  animateToPositionsWithReset(
    targets,
    () => {
      ctx.nodesData.forEach((n) => {
        n.fx = n.x
        n.fy = ageInfo.yMap[n.id]
      })
      snapshotMode()
      reapplyDrag()
    },
    MOTION.age()
  )
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
    animateToPositionsWithReset(
      targets,
      () => {
        ctx.nodesData.forEach((n) => {
          n.fx = n.x
          n.fy = n.y
        })
        drawGenGuides(ctx, savedGenInfo)
        reapplyDrag()
      },
      MOTION.generation()
    )
    return
  }

  // First time: compute layout from relationships
  const genInfo = computeGenLayout(
    ctx.nodesData,
    store.relationships,
    width,
    height,
    store.relTypeRoles
  )

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
    animateToPositionsWithReset(
      genInfo.targets,
      () => {
        ctx.nodesData.forEach((n) => {
          n.fx = n.x
          n.fy = genInfo.targets[n.id]?.y ?? n.y
        })
        snapshotGenMode()
        reapplyDrag()
      },
      MOTION.generation()
    )
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
  const genInfo = computeGenLayout(
    ctx.nodesData,
    store.relationships,
    width,
    height,
    store.relTypeRoles
  )

  if (mode === 'age') {
    const ageInfo = computeAgeYPositions(ctx.nodesData, height)
    const targets = {}
    ctx.nodesData.forEach((n) => {
      targets[n.id] = { x: genInfo.targets[n.id]?.x ?? n.x, y: ageInfo.yMap[n.id] }
    })
    animateToPositionsWithReset(
      targets,
      () => {
        ctx.nodesData.forEach((n) => {
          n.fx = n.x
          n.fy = ageInfo.yMap[n.id]
        })
        snapshotMode('age')
        reapplyDrag()
      },
      MOTION.age()
    )
  } else if (mode === 'generation') {
    removeGenPreview(ctx)
    ctx.genRowYValues = genInfo.genLabels.map((g) => g.y)
    ctx.genRowSpacing = genInfo.rowHeight || 140
    drawGenGuides(ctx, genInfo)
    animateToPositionsWithReset(
      genInfo.targets,
      () => {
        ctx.nodesData.forEach((n) => {
          n.fx = n.x
          n.fy = n.y
        })
        snapshotGenMode()
        reapplyDrag()
      },
      MOTION.generation()
    )
  } else if (mode === 'auto') {
    animateToPositionsWithReset(
      genInfo.targets,
      () => {
        ctx.nodesData.forEach((n) => {
          n.fx = null
          n.fy = null
          n.vx = 0
          n.vy = 0
        })
        ctx.simulation.alpha(0.12).restart()
        reapplyDrag()
      },
      MOTION.auto()
    )
  } else {
    animateToPositionsWithReset(
      genInfo.targets,
      () => {
        ctx.nodesData.forEach((n) => {
          n.fx = n.x
          n.fy = n.y
        })
        snapshotMode('custom')
        reapplyDrag()
      },
      MOTION.custom()
    )
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
  // Clear any directional stretch too — the zoom handler preserves whatever
  // sx/sy is on ctx.transform, so reset it before re-emitting the transform.
  ctx.transform.sx = 1
  ctx.transform.sy = 1
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
  ctx.transform.sx = 1 // fit the undistorted layout — drop any directional stretch
  ctx.transform.sy = 1
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
  graph3dRef.value?.writeBack?.() // live 3D arrangement → working copy
  if (ctx.nodesData.length) saveCurrentState()
  for (const sceneId of working.keys()) {
    await persistScene(sceneId)
  }
}

// First entry after data loads: make sure the project has a graph scene, then
// enter the saved active one (restored from settings by the store).
async function initScenes() {
  if (!store.graphScenes.length) {
    await store.ensureScene('graph', 'Scene 1', { type: 'organic', layouts: {} })
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
  reloadTick.value++ // remount an active 3D scene onto the reverted arrangement
  await initScenes()
}

// Capture the whole graph, fit-all, at the requested pixel size (for the image
// export). Returns a fresh canvas or null when there is nothing to draw.
function exportImage({ width, height, light = null }) {
  if (!ctx.renderer || !ctx.nodesData.length) return null
  const ext = nodesExtent(ctx.nodesData)
  // Generous zoom-in cap: a small tree may fill a large poster (everything is
  // drawn resolution-independently, so it stays crisp).
  const maxK = Math.max(2, (2.5 * width) / 1200)
  const t = fitExtent(ext.minX, ext.minY, ext.maxX, ext.maxY, width, height, 80, maxK)
  return ctx.renderer.exportFrame({
    width,
    height,
    transform: t,
    light,
    overlayOpts: ctx.renderer.hooks.overlayOpts()
  })
}

defineExpose({ flushLayout, reloadScenes, exportImage })

let scenesInitialized = false

// Esc peels back one layer at a time: trace → selected bond → selected people.
// Overlays (modal/form) own Esc while they're up.
function onGlobalKeydown(e) {
  if (e.key !== 'Escape') return
  if (store.modalOpen || store.formOpen) return
  if (pathInfo.value || pathAnchor.value) clearPath()
  else if (store.relPopup) store.relPopup = null
  else if (store.selectedPersonIds.length) store.selectPerson(null, { modal: false })
}

onMounted(() => {
  initGraph()
  updateGraph()
  window.addEventListener('keydown', onGlobalKeydown)
  window.addEventListener('keydown', onStretchKeyDown)
  window.addEventListener('keyup', onStretchKeyUp)
  window.addEventListener('blur', clearStretchKeys)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener('keydown', onStretchKeyDown)
  window.removeEventListener('keyup', onStretchKeyUp)
  window.removeEventListener('blur', clearStretchKeys)
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
  () => store.selectedPersonIds,
  () => markNodeStyles()
)
// Time travel: re-sync styles per scrub/playback step, but only while this view
// is actually on screen (it stays mounted, hidden, behind the other views);
// watching activeView too re-syncs on the way back in if time moved meanwhile.
watch(
  [() => tt.gateYear.value, () => tt.gateStartYear.value, () => store.activeView],
  ([, , view]) => {
    if (view !== 'graph' || spaceActive.value) return
    markNodeStyles()
    markLinkStyles()
  }
)
// Labs switched off (or mode dropped below Advanced) while a space scene is
// open: re-enter it as its 2D fallback (Free over the same positions).
watch(
  () => store.caps.space3d,
  (on) => {
    if (!on && activeScene.value?.type === 'space') enterActiveScene()
  }
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
      applyLinkForceParams()
      ctx.simulation.force('charge').strength(gs.chargeStrength)
      ctx.simulation.force('collide').radius(gs.nodeRadius + 30)
      ctx.simulation.alpha(0.2).restart()
    }
    markNodeStyles()
    markLinkStyles()
  },
  { deep: true }
)
// Tuning a type's weight/color in the registry re-parameterizes the springs
// (d3 caches per-link values, so the functions must be re-applied) and
// restyles the links.
watch(
  () => store.relTypes,
  () => {
    if (!ctx.simulation) return
    applyLinkForceParams()
    if (currentMode.value === 'auto') ctx.simulation.alpha(0.3).restart()
    markLinkStyles()
  },
  { deep: true }
)
</script>

<style scoped>
.graph-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.graph-area {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  background: var(--bg);
  overflow: hidden;
  /* Canvas gestures (shift-click multi-select, ctrl-click trace) must never
     start or extend a DOM text selection. Text fields opt back in below. */
  user-select: none;
  -webkit-user-select: none;
}
.graph-area input,
.graph-area textarea {
  user-select: text;
  -webkit-user-select: text;
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
.ctrl-btn-help {
  font-weight: 700;
  font-size: 13px;
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
/* Legend/Focus/Relationships now live inside .canvas-pane-stack, which supplies
   the glass card chrome + spring-in; these classes only set inner layout. */
.graph-legend {
  padding: 12px 16px;
  font-size: 11px;
  color: var(--t2);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 150px;
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

/* Clean view — slide overlays out */
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

/* Shift the graph minimap right so the full-height time slider clears its
   inner (left) edge — the slider hugs the far-left rail, the minimap sits
   just past it. */
.mini-map.graph-minimap {
  left: 84px;
}

/* Compound selector so it outweighs the MiniMap's own base styles */
.mini-map.clean-hide-left {
  transform: translateX(calc(-100% - 30px));
  opacity: 0;
  pointer-events: none;
}

/* Highlights panel */
.highlights-panel {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 220px;
}

/* Pane enter/leave (the .canvas-pane keyframe does the springy entrance; this
   adds a graceful exit as panes toggle off). */
.pane-leave-active {
  transition:
    opacity 0.24s ease,
    transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    filter 0.24s ease;
}
.pane-leave-to {
  opacity: 0;
  transform: translateX(22px) scale(0.95);
  filter: blur(5px);
}

/* ── Relationships pane ─────────────────────────────────────────────────── */
.reltypes-pane {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 244px;
  max-width: 268px;
}
.rtl-scroll {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 340px;
  overflow-y: auto;
  margin: 0 -4px;
  padding: 0 4px;
}
.rtl-row {
  --rc: var(--accent);
  display: grid;
  grid-template-columns: 18px 1fr auto;
  grid-template-areas:
    'glyph name count'
    'meter meter meter';
  align-items: center;
  gap: 3px 8px;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    transform 0.16s cubic-bezier(0.34, 1.5, 0.5, 1),
    opacity 0.2s ease;
}
.rtl-row:hover {
  background: color-mix(in srgb, var(--rc) 12%, transparent);
  border-color: color-mix(in srgb, var(--rc) 32%, transparent);
  transform: translateX(-2px);
}
.rtl-row.solo {
  background: color-mix(in srgb, var(--rc) 18%, transparent);
  border-color: color-mix(in srgb, var(--rc) 55%, transparent);
  box-shadow: 0 0 14px color-mix(in srgb, var(--rc) 26%, transparent);
}
.rtl-row.faded {
  opacity: 0.4;
}
.rtl-row.faded:hover {
  opacity: 0.85;
}
.rtl-glyph {
  grid-area: glyph;
  color: var(--rc);
  font-size: 13px;
  text-align: center;
}
.rtl-name {
  grid-area: name;
  color: var(--t1);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rtl-count {
  grid-area: count;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--t3);
  font-variant-numeric: tabular-nums;
}
/* Weight meter: a centre line with a fill that grows out from the middle —
   right/tinted = structural, left/red = repel. Width animates on mount. */
.rtl-meter {
  grid-area: meter;
  position: relative;
  height: 4px;
  margin-top: 3px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--t3) 40%, transparent);
  overflow: hidden;
}
.rtl-meter-axis {
  position: absolute;
  left: 50%;
  top: -1px;
  bottom: -1px;
  width: 1px;
  background: var(--t2);
  opacity: 0.5;
}
.rtl-meter-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  background: var(--rc);
  border-radius: 2px;
  animation: rtl-meter-grow 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: calc(0.12s + var(--i, 0) * 0.045s);
}
.rtl-meter-fill.neg {
  background: #ef5350;
}
@keyframes rtl-meter-grow {
  from {
    transform: scaleX(0);
  }
}
.rtl-meter-fill {
  transform-origin: left center;
}
.rtl-meter-fill.neg {
  transform-origin: right center;
}
.rtl-hint {
  font-size: 10px;
  color: var(--t3);
  padding-top: 4px;
  border-top: 1px solid var(--border);
  text-align: center;
}

/* ── Romance intel ─────────────────────────────────────────────────────── */
.rtl-romance {
  border-top: 1px solid var(--border);
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 150px;
  overflow-y: auto;
}
.rtl-romance-title {
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--pink);
}
.rtl-rom-row {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  color: var(--t2);
  line-height: 1.35;
}
.rtl-rom-row b {
  color: var(--t1);
  font-weight: 600;
}
.rtl-rom-icon {
  flex-shrink: 0;
  font-size: 12px;
  line-height: 1;
}
/* Each romance glyph gets its own idle life */
.rom-beat {
  animation: rom-beat 1.6s ease-in-out infinite;
}
@keyframes rom-beat {
  0%,
  100% {
    transform: scale(1);
  }
  12% {
    transform: scale(1.3);
  }
  24% {
    transform: scale(1);
  }
  36% {
    transform: scale(1.22);
  }
  48% {
    transform: scale(1);
  }
}
.rom-drift {
  animation: rom-drift 3.2s ease-in-out infinite;
}
@keyframes rom-drift {
  0%,
  100% {
    transform: translateX(0);
    opacity: 1;
  }
  50% {
    transform: translateX(4px);
    opacity: 0.55;
  }
}
.rom-spin {
  animation: rom-spin 5s linear infinite;
}
@keyframes rom-spin {
  to {
    transform: rotate(1turn);
  }
}
.rom-clash {
  animation: rom-clash 2.2s ease-in-out infinite;
}
@keyframes rom-clash {
  0%,
  100% {
    transform: rotate(0deg);
  }
  8% {
    transform: rotate(-14deg);
  }
  16% {
    transform: rotate(12deg);
  }
  24% {
    transform: rotate(0deg);
  }
}

/* ── Social gravity ────────────────────────────────────────────────────── */
.rtl-gravity {
  display: flex;
  align-items: center;
  gap: 7px;
  border-top: 1px solid var(--border);
  padding-top: 8px;
}
.rtl-gravity-icon {
  font-size: 12px;
  line-height: 1;
}
.rtl-gravity-icon.pulling {
  animation: gravity-wobble 2.4s ease-in-out infinite;
}
@keyframes gravity-wobble {
  0%,
  100% {
    transform: scale(1) rotate(0deg);
  }
  50% {
    transform: scale(1.2) rotate(20deg);
  }
}
.rtl-gravity-label {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--t2);
  white-space: nowrap;
}
.rtl-gravity-slider {
  flex: 1;
  min-width: 0;
  height: 18px;
  accent-color: var(--accent);
  background: transparent;
  border: none;
  padding: 0;
  box-shadow: none;
}
.rtl-gravity-val {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--accent);
  width: 32px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* ── Orbit rings control (Focus pane) ─────────────────────────────────── */
.orbit-opts {
  display: flex;
  gap: 5px;
  flex: 1;
}
.orbit-opt {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 26px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
  overflow: hidden;
  transition:
    border-color 0.18s ease,
    color 0.18s ease,
    background 0.18s ease,
    transform 0.2s cubic-bezier(0.34, 1.55, 0.5, 1);
}
.orbit-opt:hover:not(:disabled) {
  transform: translateY(-1px);
  color: var(--t1);
}
.orbit-opt:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.orbit-opt.on {
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  background: var(--adim);
  color: var(--accent);
}
.orbit-num {
  position: relative;
  z-index: 2;
}
/* Concentric rings that ripple outward while that depth is active */
.orbit-ring {
  position: absolute;
  inset: 0;
  margin: auto;
  width: calc(var(--r) * 11px);
  height: calc(var(--r) * 11px);
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  border-radius: 50%;
  opacity: 0.4;
  pointer-events: none;
}
.orbit-opt.on .orbit-ring {
  animation: orbit-ripple 2.2s ease-out infinite;
  animation-delay: calc(var(--r) * 0.25s);
}
@keyframes orbit-ripple {
  0% {
    transform: scale(0.6);
    opacity: 0.7;
  }
  70% {
    transform: scale(1.25);
    opacity: 0;
  }
  100% {
    transform: scale(1.25);
    opacity: 0;
  }
}

/* ── Connection trace card ─────────────────────────────────────────────── */
.path-card {
  position: absolute;
  left: 50%;
  bottom: 84px;
  transform: translateX(-50%);
  z-index: 7;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: min(860px, calc(100% - 48px));
  padding: 11px 40px 11px 16px;
  border-radius: 16px;
  background: var(--glass-strong);
  backdrop-filter: blur(16px) saturate(1.25);
  -webkit-backdrop-filter: blur(16px) saturate(1.25);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
  box-shadow:
    var(--shadow),
    0 0 34px color-mix(in srgb, var(--accent) 16%, transparent);
}
.path-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--t3);
  white-space: nowrap;
}
.path-title-icon {
  font-size: 14px;
  animation: compass-wander 5s ease-in-out infinite;
}
@keyframes compass-wander {
  0%,
  100% {
    transform: rotate(0deg);
  }
  30% {
    transform: rotate(-22deg);
  }
  65% {
    transform: rotate(16deg);
  }
}
.path-count {
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  background: var(--adim);
  padding: 1px 7px;
  border-radius: 12px;
  text-transform: none;
  letter-spacing: 0;
}
.path-chain {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  min-width: 0;
}
.path-person {
  --pc: var(--accent);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 11px 4px 6px;
  border: 1px solid color-mix(in srgb, var(--pc) 45%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--pc) 12%, transparent);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  animation: path-pop 0.5s cubic-bezier(0.3, 1.6, 0.4, 1) backwards;
  animation-delay: calc(var(--i) * 0.09s);
  transition:
    transform 0.18s cubic-bezier(0.34, 1.55, 0.5, 1),
    box-shadow 0.18s ease;
}
.path-person:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--pc) 35%, transparent);
}
@keyframes path-pop {
  from {
    opacity: 0;
    transform: scale(0.4) translateY(8px);
  }
}
.path-person-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--pc);
  box-shadow: 0 0 8px color-mix(in srgb, var(--pc) 60%, transparent);
  flex-shrink: 0;
}
.path-via {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  animation: path-pop 0.5s cubic-bezier(0.3, 1.6, 0.4, 1) backwards;
  animation-delay: calc(var(--i) * 0.09s);
}
.path-via-label {
  font-size: 9px;
  font-weight: 700;
  color: var(--t3);
  white-space: nowrap;
  letter-spacing: 0.02em;
}
/* The connector itself: an energy line whose gradient streams start→end */
.path-via-line {
  width: 34px;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--accent) 15%, transparent),
    var(--accent),
    color-mix(in srgb, var(--accent) 15%, transparent)
  );
  background-size: 200% 100%;
  animation: path-stream 1.1s linear infinite;
}
@keyframes path-stream {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}
.path-close {
  position: absolute;
  top: 7px;
  right: 9px;
  border: none;
  background: transparent;
  color: var(--t3);
  font-size: 12px;
  cursor: pointer;
  padding: 3px 5px;
  border-radius: 6px;
  transition:
    color 0.15s,
    background 0.15s;
}
.path-close:hover {
  color: var(--t1);
  background: var(--hover);
}

/* Armed state: a pulsing beacon while waiting for the second person */
.path-armed {
  padding-right: 40px;
}
.path-armed-beacon {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
  animation: beacon 1.4s ease-out infinite;
}
@keyframes beacon {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 65%, transparent);
  }
  100% {
    box-shadow: 0 0 0 12px transparent;
  }
}
.path-armed-name {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--t1);
  white-space: nowrap;
}
.path-armed-hint {
  font-size: 11.5px;
  color: var(--t2);
}
.path-none {
  font-size: 12px;
  color: var(--t2);
  padding-right: 40px;
}
.path-none b {
  color: var(--t1);
}
.path-none-icon {
  font-size: 15px;
  animation: satellite-drift 4s ease-in-out infinite;
}
@keyframes satellite-drift {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-3px) rotate(14deg);
  }
}

/* Card enter/leave: rises with a blur-focus, sinks away on clear */
.pathcard-enter-active {
  transition:
    opacity 0.34s ease,
    transform 0.42s cubic-bezier(0.22, 1.3, 0.36, 1),
    filter 0.34s ease;
}
.pathcard-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.26s ease,
    filter 0.22s ease;
}
.pathcard-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(18px) scale(0.92);
  filter: blur(6px);
}
.pathcard-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px) scale(0.95);
  filter: blur(4px);
}

@media (prefers-reduced-motion: reduce) {
  .rom-beat,
  .rom-drift,
  .rom-spin,
  .rom-clash,
  .rtl-gravity-icon.pulling,
  .orbit-opt.on .orbit-ring,
  .path-title-icon,
  .path-via-line,
  .path-armed-beacon,
  .path-none-icon {
    animation: none;
  }
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
