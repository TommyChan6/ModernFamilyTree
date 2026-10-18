<template>
  <div class="mv">
    <ViewHeader
      icon="map"
      :title="t('rail.map')"
      :count="store.maps.length || null"
      :hint="meta ? defaultNameLabel(meta.name) : ''"
    >
      <div v-if="draft" class="mv-actions" @pointerdown.stop>
        <!-- map switcher -->
        <div class="mv-menu-wrap">
          <button class="mv-pill" :class="{ open: menu === 'maps' }" @click="toggleMenu('maps')">
            <UiIcon name="map" :size="16" />
            <span class="mv-pill-text">{{ defaultNameLabel(meta.name) }}</span>
            <UiIcon class="mv-caret" name="chevron-down" :size="14" />
          </button>
          <Transition name="mv-pop">
            <div v-if="menu === 'maps'" class="mv-menu">
              <div class="mv-menu-title">{{ t('map.menu.yourMaps') }}</div>
              <button
                v-for="m in store.maps"
                :key="m.id"
                class="mv-menu-item"
                :class="{ on: m.id === meta.id }"
                @click="openMap(m.id)"
              >
                <UiIcon :name="styleIcon(m.style)" :size="16" />
                <span class="mv-menu-name">{{ defaultNameLabel(m.name) }}</span>
                <span class="mv-menu-meta">
                  <UiIcon name="shapes" :size="12" />{{ m.features.length }}
                  <UiIcon class="mv-menu-meta-gap" name="user" :size="12" />{{ m.tokens.length }}
                </span>
              </button>
              <div class="mv-menu-sep"></div>
              <label class="mv-menu-rename">
                <UiIcon name="pencil" :size="16" />
                <input
                  :value="meta.name"
                  :placeholder="t('map.menu.rename')"
                  maxlength="80"
                  @change="renameMap($event.target.value)"
                />
              </label>
              <button class="mv-menu-item" @click="openNew">
                <UiIcon name="plus" :size="16" />
                {{ t('map.menu.new') }}
              </button>
              <button class="mv-menu-item" @click="duplicateMap">
                <UiIcon name="copy" :size="16" />
                {{ t('map.menu.duplicate') }}
              </button>
              <button class="mv-menu-item mv-danger" @click="deleteMap">
                <UiIcon name="trash-2" :size="16" />
                {{ t('map.menu.delete') }}
              </button>
            </div>
          </Transition>
        </div>

        <!-- style switcher: the user's own map in every look -->
        <div class="mv-menu-wrap">
          <button class="mv-pill" :class="{ open: menu === 'style' }" @click="toggleMenu('style')">
            <UiIcon :name="style.icon" :size="16" />
            <span class="mv-pill-text">{{ t('map.styles.' + style.id) }}</span>
            <UiIcon class="mv-caret" name="chevron-down" :size="14" />
          </button>
          <Transition name="mv-pop">
            <div v-if="menu === 'style'" class="mv-menu mv-style-menu">
              <div class="mv-menu-title">{{ t('map.menu.style') }}</div>
              <div class="mv-style-grid">
                <button
                  v-for="(st, i) in MAP_STYLE_LIST"
                  :key="st.id"
                  class="mv-style-card"
                  :class="{ on: st.id === meta.style }"
                  :style="{ '--i': i }"
                  @click="setStyle(st.id)"
                >
                  <MapStyleThumb
                    :doc="thumbDoc"
                    :style-id="st.id"
                    :width="150"
                    :height="thumbH"
                    :theme="store.theme"
                  />
                  <span class="mv-style-name">
                    <UiIcon :name="st.icon" :size="14" />
                    {{ t('map.styles.' + st.id) }}
                  </span>
                </button>
              </div>
              <div class="mv-menu-title">{{ t('map.menu.ground') }}</div>
              <div class="mv-seg">
                <button :class="{ on: meta.base === 'sea' }" @click="setBase('sea')">
                  <UiIcon name="waves" :size="14" />
                  {{ t('map.menu.groundSea') }}
                </button>
                <button :class="{ on: meta.base === 'land' }" @click="setBase('land')">
                  <UiIcon name="wheat" :size="14" />
                  {{ t('map.menu.groundLand') }}
                </button>
              </div>
            </div>
          </Transition>
        </div>

        <!-- find a place or a person -->
        <div class="mv-menu-wrap">
          <button
            class="mv-toggle"
            :class="{ open: menu === 'find' }"
            :title="t('map.find.title')"
            :aria-label="t('map.find.title')"
            @click="toggleMenu('find')"
          >
            <UiIcon name="search" :size="16" />
          </button>
          <Transition name="mv-pop">
            <div v-if="menu === 'find'" class="mv-menu mv-find-menu">
              <MapFind :items="findItems" @pick="onFindPick" @close="menu = null" />
            </div>
          </Transition>
        </div>

        <!-- layers: what shows while you work -->
        <div class="mv-menu-wrap">
          <button
            class="mv-toggle"
            :class="{ open: menu === 'layers', on: layersFiltered }"
            :title="t('map.layers.title')"
            :aria-label="t('map.layers.title')"
            @click="toggleMenu('layers')"
          >
            <UiIcon name="layers" :size="16" />
          </button>
          <Transition name="mv-pop">
            <div v-if="menu === 'layers'" class="mv-menu mv-layers-menu">
              <div class="mv-menu-title">{{ t('map.layers.title') }}</div>
              <button
                v-for="ly in MAP_LAYERS"
                :key="ly.id"
                class="mv-layer"
                :class="{ off: hiddenLayers.includes(ly.id) }"
                role="switch"
                :aria-checked="!hiddenLayers.includes(ly.id)"
                @click="toggleLayer(ly.id)"
              >
                <UiIcon :name="ly.icon" :size="16" />
                <span class="mv-layer-name">{{ t('map.layers.' + ly.id) }}</span>
                <span class="mv-layer-n">{{ layerCounts[ly.id] || '' }}</span>
                <UiIcon
                  class="mv-layer-eye"
                  :name="hiddenLayers.includes(ly.id) ? 'eye-off' : 'eye'"
                  :size="16"
                />
              </button>
              <div class="mv-menu-sep"></div>
              <button
                class="mv-layer"
                :class="{ off: !showPeople }"
                role="switch"
                :aria-checked="showPeople"
                @click="showPeople = !showPeople"
              >
                <UiIcon name="users" :size="16" />
                <span class="mv-layer-name">{{ t('map.layers.people') }}</span>
                <span class="mv-layer-n">{{ tokenBase.length || '' }}</span>
                <UiIcon class="mv-layer-eye" :name="showPeople ? 'eye' : 'eye-off'" :size="16" />
              </button>
              <button
                class="mv-layer"
                :class="{ off: !showTrails }"
                role="switch"
                :aria-checked="showTrails"
                @click="showTrails = !showTrails"
              >
                <UiIcon name="footprints" :size="16" />
                <span class="mv-layer-name">{{ t('map.layers.journeys') }}</span>
                <span class="mv-layer-n"></span>
                <UiIcon class="mv-layer-eye" :name="showTrails ? 'eye' : 'eye-off'" :size="16" />
              </button>
              <button
                class="mv-layer"
                :class="{ off: !showLabels }"
                role="switch"
                :aria-checked="showLabels"
                @click="showLabels = !showLabels"
              >
                <UiIcon name="tag" :size="16" />
                <span class="mv-layer-name">{{ t('map.layers.names') }}</span>
                <span class="mv-layer-n"></span>
                <UiIcon class="mv-layer-eye" :name="showLabels ? 'eye' : 'eye-off'" :size="16" />
              </button>
              <button v-if="layersFiltered" class="mv-menu-item mv-layers-reset" @click="showAll">
                <UiIcon name="eye" :size="16" />
                {{ t('map.layers.showAll') }}
              </button>
              <div class="mv-menu-sep"></div>
              <label class="mv-layer mv-snap" :title="t('map.layers.snapHint')">
                <UiIcon name="magnet" :size="16" />
                <span class="mv-layer-name">{{ t('map.layers.snap') }}</span>
                <input v-model="snapOn" type="checkbox" class="switch" />
              </label>
            </div>
          </Transition>
        </div>

        <!-- export -->
        <div class="mv-menu-wrap">
          <button
            class="mv-toggle"
            :class="{ open: menu === 'export' }"
            :title="t('map.menu.export')"
            :aria-label="t('map.menu.export')"
            @click="toggleMenu('export')"
          >
            <UiIcon name="download" :size="16" />
          </button>
          <Transition name="mv-pop">
            <div v-if="menu === 'export'" class="mv-menu">
              <div class="mv-menu-title">{{ t('map.menu.export') }}</div>
              <button class="mv-menu-item mv-menu-rich" @click="exportPng('sheet')">
                <UiIcon name="map" :size="16" />
                <span class="mv-menu-rich-text">
                  <span>{{ t('map.export.sheet') }}</span>
                  <small>{{ t('map.export.sheetHint', { y: yearInt }) }}</small>
                </span>
              </button>
              <button class="mv-menu-item mv-menu-rich" @click="exportPng('view')">
                <UiIcon name="crop" :size="16" />
                <span class="mv-menu-rich-text">
                  <span>{{ t('map.export.view') }}</span>
                  <small>{{ t('map.export.viewHint') }}</small>
                </span>
              </button>
            </div>
          </Transition>
        </div>

        <button
          class="mv-toggle"
          :class="{ on: keysOpen }"
          :title="t('map.keys.title') + ' (?)'"
          :aria-label="t('map.keys.title')"
          @click="keysOpen = !keysOpen"
        >
          <UiIcon name="keyboard" :size="16" />
        </button>
      </div>
    </ViewHeader>

    <div
      ref="stageEl"
      class="mv-stage"
      :class="{ 'mv-drop': dropHover }"
      @dragover.prevent="onDragOver"
      @dragleave="dropHover = false"
      @drop.prevent="onDrop"
    >
      <canvas
        ref="canvasEl"
        class="mv-canvas"
        :style="{ cursor }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @pointerleave="onPointerLeave"
        @wheel.prevent="onWheel"
        @dblclick="onDblClick"
        @contextmenu.prevent
      ></canvas>

      <template v-if="draft">
        <MapToolbar
          ref="toolbarRef"
          v-model:tool="tool"
          :people-open="peopleOpen"
          @toggle-people="peopleOpen = !peopleOpen"
        />

        <Transition name="mv-side">
          <MapPeopleDrawer
            v-if="peopleOpen"
            :people="drawerPeople"
            :placed-ids="placedIds"
            :noun="store.noun"
            :auto-count="autoPlaceable.length"
            @close="peopleOpen = false"
            @place="placeAtCenter"
            @fly-to="flyToPerson"
            @auto-place="autoPlace"
          />
        </Transition>

        <Transition name="mv-side-r">
          <MapInspector
            v-if="selFeature || selToken"
            ref="inspectorRef"
            :key="selFeature ? selFeature.id : selToken.id"
            :feature="selFeature"
            :token="selToken"
            :year="yearInt"
            :tags="store.tags"
            :following="following"
            :measure-text="selMeasure"
            @patch="patchSelected"
            @close="clearSelection"
            @delete="deleteSelected"
            @duplicate="duplicateSelected"
            @order="reorderSelected"
            @fork-era="forkEra"
            @token-keys="setTokenKeys"
            @token-remove="deleteSelected"
            @open-person="openPerson"
            @follow="following = !following"
            @goto-stop="gotoStop"
          />
        </Transition>

        <!-- what the current tool does, in plain words -->
        <Transition name="mv-hint" mode="out-in">
          <div :key="hintText" class="mv-hint">
            <UiIcon class="mv-hint-icon" :name="hintIcon" :size="16" />
            <span>{{ hintText }}</span>
          </div>
        </Transition>

        <!-- something just happened on the timeline -->
        <TransitionGroup name="mv-toast" tag="div" class="mv-toasts">
          <div
            v-for="tst in toasts"
            :key="tst.id"
            class="mv-toast"
            :style="{ '--c': tst.color || 'var(--accent)' }"
          >
            <UiIcon v-if="tst.icon" class="mv-toast-icon" :name="tst.icon" :size="16" />
            {{ tst.text }}
          </div>
        </TransitionGroup>

        <!-- zoom + scale -->
        <div class="mv-zoom" @pointerdown.stop>
          <button
            :title="t('map.zoom.undo')"
            :aria-label="t('map.zoom.undo')"
            :disabled="!histN.undo"
            @click="undo"
          >
            <UiIcon name="undo-2" :size="16" />
          </button>
          <button
            :title="t('map.zoom.redo')"
            :aria-label="t('map.zoom.redo')"
            :disabled="!histN.redo"
            @click="redo"
          >
            <UiIcon name="redo-2" :size="16" />
          </button>
          <span class="mv-zoom-sep"></span>
          <button :title="t('map.zoom.in')" :aria-label="t('map.zoom.in')" @click="zoomBy(1.6)">
            <UiIcon name="plus" :size="16" />
          </button>
          <button
            :title="t('map.zoom.out')"
            :aria-label="t('map.zoom.out')"
            @click="zoomBy(1 / 1.6)"
          >
            <UiIcon name="minus" :size="16" />
          </button>
          <button :title="t('map.zoom.fit')" :aria-label="t('map.zoom.fit')" @click="fitView(true)">
            <UiIcon name="maximize" :size="16" />
          </button>
          <div class="mv-scale">
            <div class="mv-scale-bar" :style="{ width: scaleBar.px + 'px' }"></div>
            <span>{{ scaleBar.label }}</span>
          </div>
        </div>

        <MapTimeline
          :year="year"
          :range="range"
          :playing="playing"
          :speed-label="SPEEDS[speedIdx].label"
          :markers="timelineMarkers"
          :spans="timelineSpans"
          @scrub="scrubTo"
          @scrub-end="onScrubEnd"
          @toggle-play="togglePlay"
          @step="stepYear"
          @jump="jumpEvent"
          @cycle-speed="speedIdx = (speedIdx + 1) % SPEEDS.length"
        />

        <Transition name="mv-card">
          <div
            v-if="hoverCard"
            class="mv-hover"
            :style="{ left: hoverCard.x + 'px', top: hoverCard.y + 'px' }"
          >
            <div class="mv-hover-title">{{ hoverCard.title }}</div>
            <div v-if="hoverCard.sub" class="mv-hover-sub">{{ hoverCard.sub }}</div>
            <div v-if="hoverCard.note" class="mv-hover-note">{{ hoverCard.note }}</div>
          </div>
        </Transition>

        <MapContextMenu
          v-if="ctxMenu"
          :key="ctxMenu.key"
          :x="ctxMenu.x"
          :y="ctxMenu.y"
          :title="ctxMenu.title"
          :items="ctxMenu.items"
          :bounds="viewSize"
          @pick="onCtxPick"
        />

        <MapShortcuts v-if="keysOpen" @close="keysOpen = false" />
      </template>
    </div>

    <MapNewDialog
      v-if="!draft || newOpen"
      :first="!draft"
      :theme="store.theme"
      @create="createMap"
      @close="newOpen = false"
    />
  </div>
</template>

<script>
// The feature clipboard lives outside the component instance so a copy
// survives switching maps (and the view remounting): copy here, paste there.
let clipboard = null
</script>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useMainStore } from '../store/index.js'
import { useI18n } from '../i18n'
import { defaultNameLabel } from '../lib/dataLabels'
import { api } from '../api'
import ViewHeader from './ViewHeader.vue'
import UiIcon from './ui/UiIcon.js'
import MapToolbar from './map/MapToolbar.vue'
import MapInspector from './map/MapInspector.vue'
import MapTimeline from './map/MapTimeline.vue'
import MapPeopleDrawer from './map/MapPeopleDrawer.vue'
import MapNewDialog from './map/MapNewDialog.vue'
import MapStyleThumb from './map/MapStyleThumb.vue'
import MapFind from './map/MapFind.vue'
import MapContextMenu from './map/MapContextMenu.vue'
import MapShortcuts from './map/MapShortcuts.vue'
import { mapStyleBridge } from './style/styleBridge.js'
import { MapRenderer, HANDLE_MIN_SEG_PX, MAX_VERTEX_HANDLES } from './map/MapRenderer'
import { MAP_STYLE_LIST, MAP_UNITS, styleOf } from './map/mapStyles'
import { loadInkMapAssets } from './map/inkSprites'
import {
  MAP_KIND_GEOMETRY,
  MAP_LAYERS,
  TOOL_BY_ID,
  ALL_TOOLS,
  LIVE_KINDS,
  PLACE_RANK,
  hiddenKindsOf,
  layerOf,
  toolKind
} from './map/mapKinds'
import { KINGDOM_COLORS } from './map/mapGen'
import {
  bboxOf,
  centerOn,
  clamp,
  fitCamera,
  hitFeature,
  hitMidpoint,
  hitVertex,
  insertVertex,
  removeVertex,
  segmentMidpoint,
  snapPoint,
  windowAlpha,
  lerpCamera,
  lifeAlpha,
  mapTimeRange,
  niceLength,
  pointAlong,
  polygonArea,
  polygonCentroid,
  polylineLength,
  shiftKeys,
  simplify,
  toWorld,
  tokenStateAt,
  translatePts,
  upsertKey,
  zoomAt,
  easeInOut
} from './map/mapMath'
import { computeTimeRange } from './time/timeMath'
import { toOrdinal } from '../../../shared/calendarMath'
import { confirmDialog } from '../lib/dialogs.js'

// The Map view: user-drawn maps (terrain, realms, roads, rails, places,
// events) with the project's people placed on them and travelling over time.
// The map is edited as a local working copy (`draft`, outside Vue reactivity
// for speed — `version` bumps on every change) and autosaved through the
// store's saveMap action. Undo/redo here is the map's own stack; the app's
// data undo doesn't cover maps. Drawing lives in map/MapRenderer.ts, the
// math in map/mapMath.ts.
const props = defineProps({ active: { type: Boolean, default: true } })
const store = useMainStore()
const { t, locale } = useI18n()

const SPEEDS = [
  { label: '½×', yps: 1 },
  { label: '1×', yps: 2.5 },
  { label: '2×', yps: 6 },
  { label: '4×', yps: 14 },
  { label: '8×', yps: 30 }
]

const canvasEl = ref(null)
const stageEl = ref(null)
const toolbarRef = ref(null)
const inspectorRef = ref(null)

const draft = shallowRef(null)
const version = ref(0)
const tool = ref('select')
const selectedFeatureId = ref(null)
const selectedTokenId = ref(null)
const hoverFeatureId = ref(null)
const hoverTokenId = ref(null)
const peopleOpen = ref(false)
const menu = ref(null)
const newOpen = ref(false)
const playing = ref(false)
const speedIdx = ref(1)
const year = ref(0)
const following = ref(false)
const toasts = ref([])
const hoverCard = ref(null)
const dropHover = ref(false)
const strokeMode = ref(null) // null | 'free' | 'click' — drives the hint text
const viewSize = ref({ w: 1, h: 1 })
const camK = ref(1) // reactive mirror of the camera zoom (scale bar)
const keysOpen = ref(false) // the shortcuts sheet
const ctxMenu = ref(null) // { key, x, y, title, items, target }
const histN = ref({ undo: 0, redo: 0 }) // undo/redo button state
// the ruler: committed points + whether it's still being laid out
const ruler = ref({ pts: [], live: false })
const measureCursor = ref(null) // [wx, wy] while the ruler follows the pointer

// ── per-viewer layer prefs (what shows while you work) ────────────────────────
const LAYER_PREFS = 'familytree.map.layers'
function readLayerPrefs() {
  try {
    return JSON.parse(localStorage.getItem(LAYER_PREFS) || '{}') || {}
  } catch {
    return {}
  }
}
const layerPrefs = readLayerPrefs()
const showLabels = ref(layerPrefs.labels !== false)
const showTrails = ref(layerPrefs.trails !== false)
const showPeople = ref(layerPrefs.people !== false)
const snapOn = ref(layerPrefs.snap !== false)
const hiddenLayers = ref(
  Array.isArray(layerPrefs.hidden)
    ? layerPrefs.hidden.filter((id) => MAP_LAYERS.some((l) => l.id === id))
    : []
)
watch([showLabels, showTrails, showPeople, snapOn, hiddenLayers], () => {
  try {
    localStorage.setItem(
      LAYER_PREFS,
      JSON.stringify({
        labels: showLabels.value,
        trails: showTrails.value,
        people: showPeople.value,
        snap: snapOn.value,
        hidden: hiddenLayers.value
      })
    )
  } catch {
    /* private window / storage off — prefs just won't stick */
  }
})
const hiddenKinds = computed(() => hiddenKindsOf(hiddenLayers.value))
const hiddenKey = computed(() => hiddenLayers.value.slice().sort().join(','))
const layersFiltered = computed(
  () => hiddenLayers.value.length > 0 || !showPeople.value || !showLabels.value || !showTrails.value
)
function toggleLayer(id) {
  const on = hiddenLayers.value.includes(id)
  hiddenLayers.value = on ? hiddenLayers.value.filter((x) => x !== id) : [...hiddenLayers.value, id]
  // hidden things can't stay selected (you couldn't see what you're editing)
  const f =
    selectedFeatureId.value && draft.value?.features.find((x) => x.id === selectedFeatureId.value)
  if (f && hiddenKinds.value.has(f.kind)) selectedFeatureId.value = null
}
/** How many features each layer holds (shown beside its switch). */
const layerCounts = computed(() => {
  version.value
  const out = {}
  for (const f of draft.value?.features || []) {
    const ly = layerOf(f.kind)
    if (ly) out[ly.id] = (out[ly.id] || 0) + 1
  }
  return out
})
function showAll() {
  hiddenLayers.value = []
  showPeople.value = true
  showLabels.value = true
  showTrails.value = true
}
watch(showPeople, (on) => {
  if (!on && selectedTokenId.value) {
    selectedTokenId.value = null
    following.value = false
  }
})

let renderer = null
let cam = { x: 0, y: 0, k: 1 }
let camTarget = null // smooth wheel zoom goal
let flight = null // { from, to, t0, dur }
let displayYear = 0
let raf = 0
let lastFrame = 0
const t0 = performance.now()
let bursts = []
let stroke = null // { kind, glyph, pts, mode, sx0, sy0, cursor }
let gesture = null
const pointers = new Map()
let spaceDown = false
let resizeObs = null
const undoStack = []
const redoStack = []
let snapHit = null // the magnet target under the pointer while drawing / dragging
let hoverHandle = null // { type: 'vertex' | 'mid', i } on the selected shape
let lastWorld = null // last pointer position over the map (paste lands here)
let needsFrame = true // something changed that the frame signature can't see
let lastSig = ''
// ambient map life (mist, boats, geese, the style bloom) holds still for
// people who asked the OS for less motion
const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
const reducedMotion = ref(!!motionQuery?.matches)
const onMotionPref = (e) => (reducedMotion.value = e.matches)
motionQuery?.addEventListener?.('change', onMotionPref)

const bump = () => version.value++
/** Mirror the undo/redo stack depths into the buttons (only when they change). */
function syncHist() {
  const u = undoStack.length
  const r = redoStack.length
  if (histN.value.undo !== u || histN.value.redo !== r) histN.value = { undo: u, redo: r }
}
// The draft lives outside reactivity, so anything the template or a computed
// reads from it goes through `meta` (re-derived whenever `version` bumps).
const meta = computed(() => {
  version.value
  const d = draft.value
  return d ? { id: d.id, name: d.name, style: d.style, base: d.base } : null
})
const style = computed(() => styleOf(meta.value?.style))
// whole-year mirror of `year` — cheap UI reads it so playback (which moves
// `year` every frame) doesn't recompute lists at 60fps
const yearInt = computed(() => Math.round(year.value))

// ── loading a map ─────────────────────────────────────────────────────────────
function clone(o) {
  return JSON.parse(JSON.stringify(o))
}

function loadMap(id) {
  const doc = store.maps.find((m) => m.id === id)
  if (!doc) {
    draft.value = null
    return
  }
  draft.value = clone(doc)
  undoStack.length = 0
  redoStack.length = 0
  syncHist()
  clearMeasure()
  ctxMenu.value = null
  selectedFeatureId.value = null
  selectedTokenId.value = null
  stroke = null
  strokeMode.value = null
  playing.value = false
  following.value = false
  const y = doc.year ?? store.currentDate?.year ?? range.value.max
  year.value = Math.round(y)
  displayYear = year.value
  bump()
  nextTick(() => {
    const v = doc.view
    const { w, h } = viewSize.value
    if (v && w > 1) cam = centerOn(v.x, v.y, v.k, w, h)
    else fitView(false)
    camK.value = cam.k
  })
}

watch(
  () => store.activeMapId,
  async (id, old) => {
    if (old && draft.value?.id === old) await flushSave()
    if (!id && store.maps.length) {
      store.setActiveMapId(store.maps[0].id)
      return
    }
    loadMap(id)
  },
  { immediate: true }
)
// the static layer caches the (possibly translated default) map title
watch(locale, () => {
  renderer?.invalidate()
  needsFrame = true
})
// a map created/deleted elsewhere (or first load finishing)
watch(
  () => store.maps.length,
  () => {
    if (!store.activeMapId && store.maps.length) store.setActiveMapId(store.maps[0].id)
    else if (store.activeMapId && !draft.value) loadMap(store.activeMapId)
  }
)

function openMap(id) {
  menu.value = null
  store.setActiveMapId(id)
}
function openNew() {
  menu.value = null
  newOpen.value = true
}

async function createMap(data) {
  await flushSave()
  const res = await store.saveMap(data)
  newOpen.value = false
  if (res.success) {
    store.setActiveMapId(res.data.id)
    toast(t('map.toast.created', { name: res.data.name }))
  }
}

async function duplicateMap() {
  menu.value = null
  await flushSave()
  const d = draft.value
  const res = await store.saveMap(
    clone({
      name: t('map.menu.copyName', { name: d.name }),
      style: d.style,
      base: d.base,
      width: d.width,
      height: d.height,
      features: d.features,
      tokens: d.tokens
    })
  )
  if (res.success) store.setActiveMapId(res.data.id)
}

async function deleteMap() {
  menu.value = null
  const d = draft.value
  const ok = await confirmDialog({
    title: t('map.menu.confirmDelete', { name: d.name }),
    confirmLabel: t('confirm.deleteMap'),
    tone: 'danger'
  })
  if (!ok || draft.value !== d) return
  clearTimeout(saveTimer)
  pendingData = false
  pendingView = false
  draft.value = null
  await store.deleteMap(d.id) // the activeMapId watcher opens the next map
}

function renameMap(name) {
  const n = name.trim()
  if (!n) return
  draft.value.name = n
  bump()
  scheduleSave()
}

function setStyle(id) {
  if (draft.value.style === id) return
  pushUndo()
  draft.value.style = id
  bump()
  scheduleSave()
  toast(t('map.styles.' + id), null, styleOf(id).icon)
}
function setBase(b) {
  if (draft.value.base === b) return
  pushUndo()
  draft.value.base = b
  bump()
  scheduleSave()
}
function toggleMenu(m) {
  menu.value = menu.value === m ? null : m
}
function styleIcon(id) {
  return styleOf(id).icon
}

// the style menu previews the user's own map (features only — no people)
const thumbDoc = computed(() => {
  version.value
  const d = draft.value
  return d ? { ...d, tokens: [] } : null
})
const thumbH = computed(() =>
  draft.value ? Math.round((150 * draft.value.height) / draft.value.width) : 100
)
// The handle this map lends the Style Studio (components/style/styleBridge.js).
const bridgeHandle = {
  meta,
  thumbDoc,
  thumbH,
  setStyle: (id) => draft.value && setStyle(id),
  setBase: (b) => draft.value && setBase(b)
}

// ── autosave ─────────────────────────────────────────────────────────────────
let saveTimer = null
let pendingData = false
let pendingView = false

function scheduleSave(kind = 'data') {
  if (kind === 'data') pendingData = true
  else pendingView = true
  clearTimeout(saveTimer)
  saveTimer = setTimeout(flushSave, kind === 'data' || pendingData ? 450 : 1500)
}

async function flushSave() {
  clearTimeout(saveTimer)
  const d = draft.value
  if (!d || (!pendingData && !pendingView)) return
  const payload = { id: d.id }
  if (pendingData)
    Object.assign(payload, {
      name: d.name,
      style: d.style,
      base: d.base,
      features: d.features,
      tokens: d.tokens
    })
  if (pendingView) {
    const { w, h } = viewSize.value
    const [cx, cy] = toWorld(cam, w / 2, h / 2)
    payload.view = { x: Math.round(cx), y: Math.round(cy), k: +cam.k.toFixed(4) }
    payload.year = Math.round(year.value)
  }
  pendingData = false
  pendingView = false
  await store.saveMap(clone(payload))
}

// ── the map's own undo stack ─────────────────────────────────────────────────
// (undoStack / redoStack are declared up top: the immediate activeMapId
// watcher's loadMap clears them before this point of setup runs)
let lastCoalesce = null
let lastCoalesceAt = 0

function snapshot() {
  const d = draft.value
  return JSON.stringify({
    features: d.features,
    tokens: d.tokens,
    style: d.style,
    base: d.base,
    name: d.name
  })
}
function pushUndo(coalesce) {
  if (!draft.value) return
  const now = performance.now()
  if (coalesce && coalesce === lastCoalesce && now - lastCoalesceAt < 1500) {
    lastCoalesceAt = now
    return
  }
  lastCoalesce = coalesce || null
  lastCoalesceAt = now
  undoStack.push(snapshot())
  if (undoStack.length > 80) undoStack.shift()
  redoStack.length = 0
  syncHist()
}
function restore(json) {
  const s = JSON.parse(json)
  Object.assign(draft.value, s)
  if (
    selectedFeatureId.value &&
    !draft.value.features.some((f) => f.id === selectedFeatureId.value)
  ) {
    selectedFeatureId.value = null
  }
  if (selectedTokenId.value && !draft.value.tokens.some((tk) => tk.id === selectedTokenId.value)) {
    selectedTokenId.value = null
  }
  lastCoalesce = null
  syncHist()
  bump()
  scheduleSave()
}
function undo() {
  if (!undoStack.length) return toast(t('map.toast.nothingToUndo'))
  redoStack.push(snapshot())
  restore(undoStack.pop())
  toast(t('map.toast.undo'), null, 'undo-2')
}
function redo() {
  if (!redoStack.length) return toast(t('map.toast.nothingToRedo'))
  undoStack.push(snapshot())
  restore(redoStack.pop())
  toast(t('map.toast.redo'), null, 'redo-2')
}

/** Apply one committed edit: snapshot for undo, mutate, re-render, autosave. */
function commit(fn, coalesce) {
  if (!draft.value) return
  pushUndo(coalesce)
  fn(draft.value)
  bump()
  scheduleSave()
}

// ── people ───────────────────────────────────────────────────────────────────
const imgCache = new Map()
function imageFor(url) {
  if (!url) return null
  let img = imgCache.get(url)
  if (!img) {
    img = new Image()
    img.decoding = 'async'
    img.onload = () => (needsFrame = true)
    img.src = url
    imgCache.set(url, img)
  }
  return img
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function mix(a, b, u) {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  if (!A || !B) return a
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * u))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
function personColor(p) {
  const tags = store.tagsOf.get(p.id)
  if (tags?.length && tags[0].color) return tags[0].color
  if (p.highlight?.color) return p.highlight.color
  const gs = store.graphSettings
  if (p.gender_t != null)
    return mix(gs.maleColor || '#3a7bd5', gs.femaleColor || '#c95fa0', p.gender_t)
  return '#7d8397'
}

const personById = computed(() => new Map(store.persons.map((p) => [p.id, p])))
// realms linked to a Group take its colour; the key re-renders the static
// layer whenever ANY tag colour changes (not just how many there are)
const tagColors = computed(
  () => new Map(store.tags.filter((tg) => tg.color).map((tg) => [tg.id, tg.color]))
)
const tagColorsKey = computed(() =>
  [...tagColors.value].map(([id, c]) => id.slice(0, 8) + c).join(',')
)

function personInfo(p) {
  const url = p.primary_image ? api.getImageUrl(p.primary_image) || '' : ''
  return {
    id: p.id,
    name: p.name || t('map.people.unnamed'),
    color: personColor(p),
    initial: (p.name || '?').trim().charAt(0).toUpperCase() || '?',
    imgUrl: url,
    birth: toOrdinal(p.birth),
    death: toOrdinal(p.death)
  }
}

/** Token view models (everything but the per-frame life/position). */
const tokenBase = computed(() => {
  version.value
  const d = draft.value
  if (!d) return []
  const out = []
  for (const tk of d.tokens) {
    const p = personById.value.get(tk.person_id)
    if (!p) continue // person deleted — kept in the doc so undoing the delete restores them
    const info = personInfo(p)
    out.push({ ...info, id: tk.id, personId: p.id, keys: tk.keys, img: imageFor(info.imgUrl) })
  }
  return out
})

// a person renamed / recoloured / re-photographed → redraw their token
watch(tokenBase, () => (needsFrame = true))

const placedIds = computed(() => {
  version.value
  return new Set((draft.value?.tokens || []).map((tk) => tk.person_id))
})

const drawerPeople = computed(() =>
  store.persons.map((p) => {
    const info = personInfo(p)
    return { ...info, visible: lifeAlpha(info.birth, info.death, yearInt.value) > 0.05 }
  })
)

// People whose Location trait names a place on this map
const autoPlaceable = computed(() => {
  version.value
  const d = draft.value
  if (!d) return []
  const places = d.features.filter((f) => (f.kind === 'place' || f.kind === 'territory') && f.name)
  if (!places.length) return []
  const out = []
  for (const p of store.persons) {
    if (placedIds.value.has(p.id)) continue
    const loc = (p.location || '').trim().toLowerCase()
    if (!loc) continue
    const hit = places.find((f) => {
      const n = f.name.toLowerCase()
      return n === loc || loc.includes(n) || n.includes(loc)
    })
    if (hit) out.push({ person: p, feature: hit })
  }
  return out
})

// ── selection ────────────────────────────────────────────────────────────────
const selFeature = computed(() => {
  version.value
  const f = draft.value?.features.find((x) => x.id === selectedFeatureId.value)
  return f ? { ...f } : null
})
const selToken = computed(() => {
  version.value
  const tk = tokenBase.value.find((x) => x.id === selectedTokenId.value)
  if (!tk) return null
  const b = tk.birth != null ? Math.floor(tk.birth) : null
  const dd = tk.death != null ? Math.floor(tk.death) : null
  const life = b != null || dd != null ? `${b ?? '?'} – ${dd ?? ''}` : ''
  return { ...tk, keys: tk.keys.map((k) => ({ ...k })), life }
})

function selectFeature(id) {
  selectedFeatureId.value = id
  selectedTokenId.value = null
  following.value = false
}
function selectToken(id) {
  selectedTokenId.value = id
  selectedFeatureId.value = null
}
function clearSelection() {
  selectedFeatureId.value = null
  selectedTokenId.value = null
  following.value = false
}

function patchSelected(fields, key) {
  const id = selectedFeatureId.value
  if (!id) return
  commit(
    (d) => {
      const i = d.features.findIndex((f) => f.id === id)
      if (i === -1) return
      const next = { ...d.features[i], ...fields }
      for (const k of Object.keys(fields))
        if (fields[k] === null || fields[k] === '') delete next[k]
      d.features[i] = next
    },
    key ? key + ':' + id : null
  )
}

function deleteSelected() {
  if (selectedFeatureId.value) {
    const id = selectedFeatureId.value
    commit((d) => (d.features = d.features.filter((f) => f.id !== id)))
    selectedFeatureId.value = null
    toast(t('map.toast.deleted'), null, 'trash-2')
  } else if (selectedTokenId.value) {
    const id = selectedTokenId.value
    commit((d) => (d.tokens = d.tokens.filter((tk) => tk.id !== id)))
    selectedTokenId.value = null
    following.value = false
  }
}

function duplicateSelected() {
  const f = draft.value.features.find((x) => x.id === selectedFeatureId.value)
  if (!f) return
  const off = 24 / cam.k
  const copy = { ...clone(f), id: crypto.randomUUID(), pts: translatePts(f.pts, off, off) }
  commit((d) => d.features.push(copy))
  selectFeature(copy.id)
}

function reorderSelected(dir) {
  const id = selectedFeatureId.value
  commit((d) => {
    const i = d.features.findIndex((f) => f.id === id)
    if (i === -1) return
    const [f] = d.features.splice(i, 1)
    if (dir > 0) d.features.push(f)
    else d.features.unshift(f)
  })
}

/** "New era": end the selection the year before now, and start an editable
 *  copy from now — how borders shift and roads get rebuilt over time. */
function forkEra() {
  const f = draft.value.features.find((x) => x.id === selectedFeatureId.value)
  if (!f) return
  const y = Math.round(year.value)
  if (f.from != null && f.from >= y) return toast(t('map.toast.forkTooEarly'))
  const copy = { ...clone(f), id: crypto.randomUUID(), from: y }
  if (f.to == null) delete copy.to
  commit((d) => {
    const i = d.features.findIndex((x) => x.id === f.id)
    d.features[i] = { ...f, to: y - 1 }
    d.features.splice(i + 1, 0, copy)
  })
  selectFeature(copy.id)
  toast(t('map.toast.forked', { y }), null, 'scissors')
}

function setTokenKeys(keys, key) {
  const id = selectedTokenId.value
  if (!keys.length) return
  const sorted = keys.slice().sort((a, b) => a.t - b.t)
  commit(
    (d) => {
      const i = d.tokens.findIndex((tk) => tk.id === id)
      if (i !== -1) d.tokens[i] = { ...d.tokens[i], keys: sorted }
    },
    key ? key + ':' + id : null
  )
}

function openPerson() {
  const tk = selToken.value
  if (tk) store.selectPerson(tk.personId)
}

function gotoStop(k) {
  scrubTo(k.t)
  onScrubEnd()
  flyTo(centerOn(k.x, k.y, Math.max(cam.k, 1), viewSize.value.w, viewSize.value.h))
}

// ── placing people ───────────────────────────────────────────────────────────
function placeToken(personId, wx, wy) {
  const y = Math.round(year.value)
  const existing = draft.value.tokens.find((tk) => tk.person_id === personId)
  commit((d) => {
    if (existing) {
      const i = d.tokens.findIndex((tk) => tk.id === existing.id)
      d.tokens[i] = { ...existing, keys: upsertKey(existing.keys, y, wx, wy) }
    } else {
      d.tokens.push({
        id: crypto.randomUUID(),
        person_id: personId,
        keys: [{ t: y, x: Math.round(wx), y: Math.round(wy) }]
      })
    }
  })
  const tk = draft.value.tokens.find((x) => x.person_id === personId)
  selectToken(tk.id)
  burst(wx, wy, style.value.accent)
  const p = personById.value.get(personId)
  toast(`${p?.name || ''} · ${y}`, null, 'map-pin')
}

function placeAtCenter(personId) {
  const [wx, wy] = toWorld(cam, viewSize.value.w / 2, viewSize.value.h / 2)
  placeToken(personId, wx, wy)
}

function autoPlace() {
  const list = autoPlaceable.value
  if (!list.length) return
  const y = Math.round(year.value)
  commit((d) => {
    list.forEach(({ person, feature }, i) => {
      let [x, y0] = feature.pts
      if (feature.kind === 'territory') [x, y0] = polygonCentroid(feature.pts)
      const a = i * 2.4
      const r = 10 + (i % 5) * 6
      d.tokens.push({
        id: crypto.randomUUID(),
        person_id: person.id,
        keys: [{ t: y, x: Math.round(x + Math.cos(a) * r), y: Math.round(y0 + Math.sin(a) * r) }]
      })
      burst(x, y0, style.value.accent, i * 0.05)
    })
  })
  toast(t('map.toast.autoPlaced', { n: list.length }), null, 'sparkles')
}

function flyToPerson(personId) {
  const tk = draft.value.tokens.find((x) => x.person_id === personId)
  if (!tk) return
  const st = tokenStateAt(tk.keys, displayYear)
  selectToken(tk.id)
  flyTo(centerOn(st.x, st.y, Math.max(cam.k, 1.2), viewSize.value.w, viewSize.value.h))
}

function onDragOver(e) {
  if (e.dataTransfer?.types?.includes('text/x-map-person')) {
    e.dataTransfer.dropEffect = 'copy'
    dropHover.value = true
  }
}
function onDrop(e) {
  dropHover.value = false
  const id = e.dataTransfer?.getData('text/x-map-person')
  if (!id || !draft.value) return
  const r = canvasEl.value.getBoundingClientRect()
  const [wx, wy] = toWorld(cam, e.clientX - r.left, e.clientY - r.top)
  placeToken(id, wx, wy)
}

// ── time ─────────────────────────────────────────────────────────────────────
const projectRange = computed(() => {
  const r = computeTimeRange(store.persons, store.relationships)
  return r ? { min: r.minYear, max: r.maxYear } : null
})
const range = computed(() => {
  version.value
  const d = draft.value
  const r = mapTimeRange(d?.features || [], d?.tokens || [], projectRange.value)
  if (r) return r
  const y = Math.round(store.currentDate?.year ?? 1000)
  return { min: y - 50, max: y + 50 }
})

const timelineMarkers = computed(() => {
  version.value
  const out = []
  for (const tk of tokenBase.value) {
    if (tk.keys.length < 2) continue
    for (const k of tk.keys)
      out.push({
        t: k.t,
        color: tk.color,
        type: 'stop',
        label: `${tk.name} · ${k.t}${k.note ? ' · ' + k.note : ''}`
      })
  }
  for (const f of draft.value?.features || []) {
    if (!LIVE_KINDS.has(f.kind) || f.from == null) continue
    out.push({
      t: f.from,
      color: f.color || style.value.accent,
      type: 'event',
      label: `${f.name || t('map.kinds.' + f.kind)} · ${f.from}`
    })
  }
  return out
})
const timelineSpans = computed(() => {
  version.value
  return (draft.value?.features || [])
    .filter((f) => f.from != null || f.to != null)
    .map((f) => ({
      from: f.from ?? range.value.min,
      to: f.to ?? range.value.max,
      color:
        f.color ||
        style.value.areas[f.kind]?.fill ||
        style.value.lines[f.kind]?.color ||
        style.value.accent
    }))
})

/** Every moment worth jumping to: journey stops and feature start/end years. */
const moments = computed(() => {
  version.value
  const s = new Set()
  for (const tk of draft.value?.tokens || [])
    if (tk.keys.length > 1) tk.keys.forEach((k) => s.add(k.t))
  for (const f of draft.value?.features || []) {
    if (f.from != null) s.add(f.from)
    if (f.to != null) s.add(f.to + 1)
  }
  return [...s].sort((a, b) => a - b)
})

function scrubTo(y) {
  playing.value = false
  year.value = y
}
function onScrubEnd() {
  year.value = Math.round(year.value)
  scheduleSave('view')
}
function stepYear(n) {
  scrubTo(Math.round(year.value) + n)
  onScrubEnd()
}
function jumpEvent(dir) {
  const y = Math.round(year.value)
  const list = moments.value
  const next = dir > 0 ? list.find((m) => m > y) : [...list].reverse().find((m) => m < y)
  if (next == null) return toast(t(dir > 0 ? 'map.toast.noLater' : 'map.toast.noEarlier'))
  scrubTo(next)
  onScrubEnd()
}
function togglePlay() {
  if (playing.value) {
    playing.value = false
    year.value = Math.round(year.value)
    scheduleSave('view')
    return
  }
  if (year.value >= range.value.max) {
    year.value = range.value.min
    displayYear = year.value
  }
  playing.value = true
}

/** Announce events whose start the playhead just crossed. */
function checkEvents(prev, cur) {
  if (cur <= prev) return
  for (const f of draft.value.features) {
    if (!LIVE_KINDS.has(f.kind) || f.from == null) continue
    if (prev < f.from && cur >= f.from) {
      const pts =
        f.kind === 'zone'
          ? polygonCentroid(f.pts)
          : f.kind === 'arrow'
            ? [pointAlong(f.pts, 0).x, pointAlong(f.pts, 0).y]
            : f.pts
      burst(pts[0], pts[1], f.color || style.value.accent)
      const icon =
        (f.kind === 'event'
          ? TOOL_BY_ID.get('event:' + (f.icon || 'star'))?.icon
          : TOOL_BY_ID.get(f.kind)?.icon) || 'sparkles'
      toast(`${f.name || t('map.kinds.' + f.kind)} · ${f.from}`, f.color, icon)
    }
  }
}

// ── feedback ─────────────────────────────────────────────────────────────────
let toastN = 0
function toast(text, color, icon) {
  const id = ++toastN
  toasts.value = [...toasts.value.slice(-2), { id, text, color, icon }]
  setTimeout(() => (toasts.value = toasts.value.filter((x) => x.id !== id)), 2600)
}
function burst(x, y, color, delay = 0) {
  bursts.push({ x, y, t0: (performance.now() - t0) / 1000 + delay, color })
  if (bursts.length > 30) bursts = bursts.slice(-30)
}

// ── camera ───────────────────────────────────────────────────────────────────
function fitView(animate) {
  const d = draft.value
  if (!d) return
  const { w, h } = viewSize.value
  const target = fitCamera({ x0: 0, y0: 0, x1: d.width, y1: d.height }, w, h, 50)
  if (animate) flyTo(target)
  else {
    cam = target
    camK.value = cam.k
  }
}
function flyTo(target, dur = 0.85) {
  camTarget = null
  flight = { from: { ...cam }, to: target, t0: performance.now(), dur: dur * 1000 }
}
function zoomBy(f) {
  const { w, h } = viewSize.value
  camTarget = zoomAt(camTarget || cam, w / 2, h / 2, f)
  flight = null
}

// one world unit = 1 km; each style measures in its own unit (MAP_UNITS)
const unitPer = computed(() => MAP_UNITS[style.value.unit] || 1)
const numFmt = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }))
/** A world distance in the style's unit, e.g. "12.5 leagues" / "25 里". */
function fmtDistance(world) {
  const v = world * unitPer.value
  const n = numFmt.value.format(v >= 100 ? Math.round(v) : Math.round(v * 10) / 10)
  return t('map.units.' + style.value.unit, { n })
}
/** A world area in the style's unit squared. */
function fmtArea(world2) {
  const v = world2 * unitPer.value * unitPer.value
  const n = numFmt.value.format(v >= 100 ? Math.round(v) : Math.round(v * 10) / 10)
  return t('map.units.' + style.value.unit + '2', { n })
}
const scaleBar = computed(() => {
  const perPx = unitPer.value / camK.value
  const len = niceLength(110 * perPx)
  return {
    px: Math.round(len / perPx),
    label: t('map.units.' + style.value.unit, { n: numFmt.value.format(len) })
  }
})

// ── frame loop ───────────────────────────────────────────────────────────────
// The loop runs every animation frame but only DRAWS when something changed
// (the frame signature) or something is moving: interaction at full rate,
// the slow ambient life (waves, clouds, flowing arrows) at ~30 fps, and an
// untouched still map not at all.
const liveCount = computed(() => {
  version.value
  return (draft.value?.features || []).filter((f) => LIVE_KINDS.has(f.kind)).length
})
const journeyCount = computed(() => tokenBase.value.filter((tk) => tk.keys.length > 1).length)
let lastDraw = 0

/** 'full' = draw every frame · 'slow' = ambient only (~30 fps) · 'idle' = only on change */
function frameMode() {
  if (playing.value || flight || camTarget || gesture || stroke) return 'full'
  if (displayYear !== year.value || renderer.revealing) return 'full'
  if (reducedMotion.value) return 'idle'
  const now = (performance.now() - t0) / 1000
  if (bursts.some((b) => now - b.t0 < 1.7)) return 'full'
  if (following.value || ruler.value.live) return 'full'
  if (selectedFeatureId.value || selectedTokenId.value) return 'slow'
  if (hoverFeatureId.value || hoverTokenId.value) return 'slow'
  const amb = style.value.ambient
  if (Object.values(amb).some(Boolean) || liveCount.value) return 'slow'
  if (showTrails.value && showPeople.value && journeyCount.value) return 'slow'
  return 'idle'
}

/** Everything a still frame depends on — unchanged signature, nothing to draw. */
function frameSig() {
  const d = draft.value
  let imgs = 0
  for (const tk of tokenBase.value) if (tk.img?.complete) imgs++
  const sn = snapHit
  const hh = hoverHandle
  const mc = measureCursor.value
  return [
    d.id,
    version.value,
    cam.x,
    cam.y,
    cam.k,
    displayYear,
    mapTheme(),
    style.value.id,
    viewSize.value.w,
    viewSize.value.h,
    showLabels.value,
    showTrails.value,
    showPeople.value,
    hiddenKey.value,
    tagColorsKey.value,
    selectedFeatureId.value,
    selectedTokenId.value,
    hoverFeatureId.value,
    hoverTokenId.value,
    hh ? hh.type + hh.i : '',
    sn ? sn.x + ',' + sn.y : '',
    ruler.value.pts.length,
    mc ? mc[0] + ',' + mc[1] : '',
    imgs,
    tokenBase.value.length
  ].join('|')
}

function frame(now) {
  raf = requestAnimationFrame(frame)
  const d = draft.value
  if (!d || !renderer) return
  const dt = Math.min(0.05, (now - (lastFrame || now)) / 1000)
  lastFrame = now
  const time = (now - t0) / 1000

  // time: play forward, or glide the displayed year toward the scrubbed one
  if (playing.value) {
    const prev = displayYear
    let next = year.value + dt * SPEEDS[speedIdx.value].yps
    if (next >= range.value.max) {
      next = range.value.max
      playing.value = false
    }
    year.value = next
    displayYear = next
    checkEvents(prev, next)
  } else if (displayYear !== year.value) {
    displayYear += (year.value - displayYear) * (1 - Math.exp(-dt * 9))
    if (Math.abs(displayYear - year.value) < 0.004) displayYear = year.value
  }

  // camera: fly-to tween > smooth zoom > follow a traveller
  if (flight) {
    const u = clamp((now - flight.t0) / flight.dur, 0, 1)
    cam = lerpCamera(flight.from, flight.to, easeInOut(u), viewSize.value.w, viewSize.value.h)
    if (u >= 1) {
      flight = null
      scheduleSave('view')
    }
  } else if (camTarget) {
    const u = 1 - Math.exp(-dt * 16)
    cam = {
      x: cam.x + (camTarget.x - cam.x) * u,
      y: cam.y + (camTarget.y - cam.y) * u,
      k: cam.k + (camTarget.k - cam.k) * u
    }
    if (Math.abs(cam.k - camTarget.k) / camTarget.k < 0.001) {
      cam = camTarget
      camTarget = null
      scheduleSave('view')
    }
  }
  if (following.value && selToken.value && !gesture) {
    const st = tokenStateAt(selToken.value.keys, displayYear)
    const goal = centerOn(st.x, st.y, cam.k, viewSize.value.w, viewSize.value.h)
    const u = 1 - Math.exp(-dt * 4)
    cam = { k: cam.k, x: cam.x + (goal.x - cam.x) * u, y: cam.y + (goal.y - cam.y) * u }
  }
  if (camK.value !== cam.k) camK.value = cam.k

  // skip frames that would draw exactly what's already on screen
  const mode = frameMode()
  const sig = frameSig()
  if (!needsFrame && sig === lastSig) {
    if (mode === 'idle') return
    if (mode === 'slow' && now - lastDraw < 32) return
  }
  needsFrame = false
  lastSig = sig
  lastDraw = now

  renderer.render({
    ...sceneState(),
    cam,
    year: displayYear,
    time,
    selectedFeatureId: selectedFeatureId.value,
    selectedTokenId: selectedTokenId.value,
    hoverFeatureId: hoverFeatureId.value,
    hoverTokenId: hoverTokenId.value,
    preview: stroke ? previewOf(stroke) : null,
    bursts,
    reducedMotion: reducedMotion.value,
    snap: snapHit,
    measure: measureView(),
    hoverHandle
  })
}

/** What the map shows (shared by the live canvas and PNG export). */
function sceneState() {
  const tokens = showPeople.value
    ? tokenBase.value.map((tk) => ({
        id: tk.id,
        name: tk.name,
        color: tk.color,
        initial: tk.initial,
        img: tk.img,
        keys: tk.keys,
        life: lifeAlpha(tk.birth, tk.death, displayYear),
        dead: tk.death != null && displayYear > tk.death + 0.5
      }))
    : []
  return {
    doc: draft.value,
    version: version.value,
    style: style.value,
    theme: mapTheme(),
    tokens,
    tagColors: tagColors.value,
    tagColorsKey: tagColorsKey.value,
    hiddenKinds: hiddenKinds.value,
    hiddenKey: hiddenKey.value,
    showTrails: showTrails.value,
    showLabels: showLabels.value
  }
}

/** The renderer's desk tone: the paper theme gets its own. */
function mapTheme() {
  return store.isInk ? 'ink' : store.isLightTheme ? 'light' : 'dark'
}

function previewOf(s) {
  const pts = s.mode === 'click' && s.cursor ? [...s.pts, ...s.cursor] : s.pts
  const geo = MAP_KIND_GEOMETRY[s.kind]
  const st = style.value
  const color =
    st.lines[s.kind]?.color ||
    (s.kind === 'territory' ? KINGDOM_COLORS[0] : st.areas[s.kind]?.mark || st.accent)
  return { kind: s.kind, pts, closed: geo === 'area', color }
}

// ── the ruler ────────────────────────────────────────────────────────────────
function clearMeasure() {
  ruler.value = { pts: [], live: false }
  measureCursor.value = null
}
/** The ruler's polyline (with the rubber-band leg to the pointer). */
function measurePts() {
  const m = ruler.value
  return m.live && measureCursor.value && m.pts.length ? [...m.pts, ...measureCursor.value] : m.pts
}
const measureTotal = computed(() => polylineLength(measurePts()))
function measureView() {
  const pts = measurePts()
  if (pts.length < 4) return null
  const labels = []
  const segs = pts.length / 2 - 1
  if (segs > 1) {
    for (let i = 0; i < pts.length - 2; i += 2) {
      const len = Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1])
      if (len * cam.k < 70) continue // too short on screen to label
      labels.push({
        x: (pts[i] + pts[i + 2]) / 2,
        y: (pts[i + 1] + pts[i + 3]) / 2,
        text: fmtDistance(len)
      })
    }
  }
  labels.push({
    x: pts[pts.length - 2],
    y: pts[pts.length - 1],
    text: fmtDistance(polylineLength(pts)),
    total: true
  })
  return { pts, labels }
}
function measureClick(wx, wy) {
  const m = ruler.value
  if (!m.live) ruler.value = { pts: [wx, wy], live: true }
  else ruler.value = { pts: [...m.pts, wx, wy], live: true }
}
function finishMeasure() {
  if (!ruler.value.live) return
  ruler.value = { pts: ruler.value.pts, live: false }
  measureCursor.value = null
  if (ruler.value.pts.length < 4) clearMeasure()
}

// ── snapping ─────────────────────────────────────────────────────────────────
/** Pull a world point onto the nearest place / vertex (Alt or the Layers
 *  switch turns the magnet off). Sets snapHit for the on-canvas ring. */
function snapAt(wx, wy, e, excludeId = null) {
  snapHit = null
  if (!snapOn.value || e?.altKey || !draft.value) return [wx, wy]
  const hit = snapPoint(draft.value.features, wx, wy, 11 / cam.k, displayYear, geoOf, {
    excludeId,
    hidden: hiddenKinds.value
  })
  if (!hit) return [wx, wy]
  snapHit = hit
  return [hit.x, hit.y]
}
/** Does the current tool draw something that should snap (lines, areas, ruler)? */
function toolSnaps() {
  if (tool.value === 'measure') return true
  const { kind } = toolKind(tool.value)
  return !!kind && geoOf(kind) !== 'point'
}

// ── hit testing ──────────────────────────────────────────────────────────────
const geoOf = (k) => MAP_KIND_GEOMETRY[k]
function localXY(e) {
  const r = canvasEl.value.getBoundingClientRect()
  return [e.clientX - r.left, e.clientY - r.top]
}
function hitToken(sx, sy) {
  if (!showPeople.value) return null
  const hits = renderer?.tokenHits || []
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i]
    if (Math.hypot(sx - h.x, sy - h.y) <= h.r) return h.id
  }
  return null
}
function hitAt(wx, wy, opts = {}) {
  return hitFeature(draft.value.features, wx, wy, 9 / cam.k, displayYear, geoOf, {
    ...opts,
    hidden: hiddenKinds.value
  })
}
/** The selected line/area — the only shape that shows edit handles. */
function selectedShape() {
  const f = draft.value?.features.find((x) => x.id === selectedFeatureId.value)
  return f && geoOf(f.kind) !== 'point' ? f : null
}
/** Which handle of the selected shape sits under a world point, if any. */
function handleAt(wx, wy) {
  const f = selectedShape()
  if (!f) return null
  const vi = hitVertex(f.pts, wx, wy, 7 / cam.k)
  if (vi >= 0) return { type: 'vertex', i: vi, f }
  // midpoint handles exist only while every vertex shows one (see the renderer)
  if (f.pts.length / 2 > MAX_VERTEX_HANDLES) return null
  const closed = geoOf(f.kind) === 'area'
  const mi = hitMidpoint(f.pts, closed, wx, wy, 7 / cam.k, HANDLE_MIN_SEG_PX / cam.k)
  return mi >= 0 ? { type: 'mid', i: mi, f } : null
}
/** Remove one corner of the selected shape (one undo step). */
function deleteVertex(f, vi) {
  const pts = removeVertex(f.pts, vi, geoOf(f.kind) === 'area')
  if (!pts) return toast(t('map.toast.minPoints'))
  commit((d) => {
    const i = d.features.findIndex((x) => x.id === f.id)
    if (i !== -1) d.features[i] = { ...d.features[i], pts }
  })
  hoverHandle = null
  burst(f.pts[vi * 2], f.pts[vi * 2 + 1], style.value.accent)
}

// ── pointer interaction ──────────────────────────────────────────────────────
let pointerInside = false
// reactive mirror of hoverHandle's type, for the cursor
const hoverHandleType = ref(null)

function onPointerDown(e) {
  if (!draft.value) return
  canvasEl.value.setPointerCapture?.(e.pointerId)
  const [sx, sy] = localXY(e)
  pointers.set(e.pointerId, { x: sx, y: sy })
  menu.value = null
  ctxMenu.value = null
  hoverCard.value = null
  flight = null
  if (camTarget) {
    cam = camTarget
    camTarget = null
  }

  // two fingers: pinch-zoom (abandons whatever one finger started)
  if (pointers.size === 2) {
    if (gesture?.type === 'draw' && stroke?.mode !== 'click') cancelStroke()
    const [a, b] = [...pointers.values()]
    gesture = {
      type: 'pinch',
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      mid: [(a.x + b.x) / 2, (a.y + b.y) / 2],
      cam0: { ...cam }
    }
    return
  }
  const [wx, wy] = toWorld(cam, sx, sy)
  lastWorld = [wx, wy]
  if (e.button === 1 || e.button === 2 || spaceDown || tool.value === 'pan') {
    // a right-click that doesn't move opens the context menu (on release)
    gesture = { type: 'pan', sx, sy, cam0: { ...cam }, moved: false, button: e.button }
    return
  }

  if (tool.value === 'select') {
    const tid = hitToken(sx, sy)
    if (tid) {
      const tk = draft.value.tokens.find((x) => x.id === tid)
      selectToken(tid)
      pushUndo()
      const st = tokenStateAt(tk.keys, displayYear)
      gesture = {
        type: 'moveToken',
        id: tid,
        sx,
        sy,
        wx,
        wy,
        keys0: tk.keys,
        x0: st.x,
        y0: st.y,
        alt: e.altKey,
        moved: false
      }
      return
    }
    const h = handleAt(wx, wy)
    if (h?.type === 'vertex') {
      // Alt-click a corner removes it; a plain press drags it
      if (e.altKey) return deleteVertex(h.f, h.i)
      pushUndo()
      gesture = { type: 'moveVertex', id: h.f.id, vi: h.i, sx, sy, moved: false }
      return
    }
    if (h?.type === 'mid') {
      // pressing an edge's midpoint drops a new corner there and drags it
      pushUndo()
      const i = draft.value.features.findIndex((x) => x.id === h.f.id)
      const [mx, my] = segmentMidpoint(h.f.pts, h.i)
      draft.value.features[i] = { ...h.f, pts: insertVertex(h.f.pts, h.i, mx, my) }
      hoverHandle = { type: 'vertex', i: h.i + 1 }
      bump()
      scheduleSave()
      gesture = { type: 'moveVertex', id: h.f.id, vi: h.i + 1, sx, sy, moved: true }
      return
    }
    // Land / water only take a single click once selected (double-click
    // selects them) — otherwise every click on the continent would grab it.
    let fid = hitAt(wx, wy, { skipBase: true })
    if (!fid) {
      const base = hitAt(wx, wy)
      if (base && base === selectedFeatureId.value) fid = base
    }
    if (fid) {
      const f = draft.value.features.find((x) => x.id === fid)
      const already = fid === selectedFeatureId.value
      selectFeature(fid)
      // Big areas only move once selected — otherwise dragging across land pans.
      if (geoOf(f.kind) !== 'area' || already) {
        gesture = { type: 'moveFeature', id: fid, sx, sy, wx, wy, pts0: f.pts, moved: false }
      } else {
        gesture = { type: 'pan', sx, sy, cam0: { ...cam }, moved: false }
      }
      return
    }
    clearSelection()
    gesture = { type: 'pan', sx, sy, cam0: { ...cam }, moved: false }
    return
  }

  if (tool.value === 'erase') {
    pushUndo()
    gesture = { type: 'erase', erased: 0 }
    eraseAt(sx, sy)
    return
  }

  if (tool.value === 'measure') {
    const [mx, my] = snapAt(wx, wy, e)
    const fresh = !ruler.value.live
    measureClick(mx, my)
    measureCursor.value = [mx, my]
    // press-drag-release measures one straight leg in a single gesture
    gesture = { type: 'measure', sx, sy, fresh, moved: false }
    return
  }

  const { kind, glyph } = toolKind(tool.value)
  if (!kind) return
  const geo = geoOf(kind)
  if (geo === 'point') {
    placePoint(kind, glyph, wx, wy)
    return
  }
  const [px, py] = snapAt(wx, wy, e)
  // click-to-place polyline in progress: add a vertex (or close the shape)
  if (stroke && stroke.mode === 'click' && stroke.kind === kind) {
    const [fx, fy] = [stroke.pts[0], stroke.pts[1]]
    const closeHit =
      geo === 'area' &&
      stroke.pts.length >= 6 &&
      Math.hypot((fx - wx) * cam.k, (fy - wy) * cam.k) < 12
    if (closeHit) finishStroke()
    else stroke.pts.push(px, py)
    gesture = { type: 'clickVertex' }
    return
  }
  stroke = {
    kind,
    glyph,
    pts: [px, py],
    mode: 'pending',
    sx0: sx,
    sy0: sy,
    lsx: sx,
    lsy: sy,
    cursor: null
  }
  gesture = { type: 'draw' }
}

function onPointerMove(e) {
  if (!draft.value) return
  pointerInside = true
  const [sx, sy] = localXY(e)
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: sx, y: sy })
  const [wx, wy] = toWorld(cam, sx, sy)
  lastWorld = [wx, wy]

  if (gesture?.type === 'pinch' && pointers.size >= 2) {
    const [a, b] = [...pointers.values()]
    const dist = Math.hypot(a.x - b.x, a.y - b.y)
    const mid = [(a.x + b.x) / 2, (a.y + b.y) / 2]
    const g = gesture
    let c = zoomAt(g.cam0, g.mid[0], g.mid[1], dist / Math.max(1, g.dist))
    c = { ...c, x: c.x + (mid[0] - g.mid[0]), y: c.y + (mid[1] - g.mid[1]) }
    cam = c
    return
  }
  if (!gesture) {
    updateHover(sx, sy, wx, wy)
    // the magnet previews where the next click would land
    if (toolSnaps()) {
      const p = snapAt(wx, wy, e)
      if (stroke?.mode === 'click') stroke.cursor = p
      if (ruler.value.live) measureCursor.value = p
    } else snapHit = null
    return
  }
  const g = gesture
  const far = () => Math.hypot(sx - g.sx, sy - g.sy) > 3
  switch (g.type) {
    case 'pan':
      if (!g.moved && !far()) return
      g.moved = true
      cam = { k: g.cam0.k, x: g.cam0.x + (sx - g.sx), y: g.cam0.y + (sy - g.sy) }
      return
    case 'moveToken': {
      if (!g.moved && !far()) return
      g.moved = true
      const dx = wx - g.wx
      const dy = wy - g.wy
      const i = draft.value.tokens.findIndex((tk) => tk.id === g.id)
      if (i === -1) return
      const keys =
        g.alt || e.altKey
          ? shiftKeys(g.keys0, dx, dy)
          : upsertKey(g.keys0, year.value, g.x0 + dx, g.y0 + dy)
      draft.value.tokens[i] = { ...draft.value.tokens[i], keys }
      bump()
      return
    }
    case 'moveVertex': {
      if (!g.moved && !far()) return
      g.moved = true
      const i = draft.value.features.findIndex((f) => f.id === g.id)
      if (i === -1) return
      const [vx, vy] = snapAt(wx, wy, e, g.id)
      const pts = draft.value.features[i].pts.slice()
      pts[g.vi * 2] = Math.round(vx * 10) / 10
      pts[g.vi * 2 + 1] = Math.round(vy * 10) / 10
      draft.value.features[i] = { ...draft.value.features[i], pts }
      bump()
      return
    }
    case 'moveFeature': {
      if (!g.moved && !far()) return
      if (!g.moved) pushUndo()
      g.moved = true
      const i = draft.value.features.findIndex((f) => f.id === g.id)
      if (i === -1) return
      draft.value.features[i] = {
        ...draft.value.features[i],
        pts: translatePts(g.pts0, wx - g.wx, wy - g.wy)
      }
      bump()
      return
    }
    case 'measure':
      if (!g.moved && !far()) return
      g.moved = true
      measureCursor.value = snapAt(wx, wy, e)
      return
    case 'draw': {
      const s = stroke
      if (!s) return
      if (s.mode === 'pending') {
        if (Math.hypot(sx - s.sx0, sy - s.sy0) < 5) return
        s.mode = 'free'
        strokeMode.value = 'free'
      }
      if (s.mode === 'free') {
        // show where the stroke's end would snap; the point lands on release
        snapAt(wx, wy, e)
        if (Math.hypot(sx - s.lsx, sy - s.lsy) >= 3) {
          s.pts.push(wx, wy)
          s.lsx = sx
          s.lsy = sy
        }
      }
      return
    }
    case 'erase':
      eraseAt(sx, sy)
      return
  }
}

function onPointerUp(e) {
  pointers.delete(e.pointerId)
  const g = gesture
  if (!g) return
  if (g.type === 'pinch') {
    if (pointers.size === 0) {
      gesture = null
      scheduleSave('view')
    }
    return
  }
  gesture = null
  switch (g.type) {
    case 'pan':
      if (g.moved) scheduleSave('view')
      else if (g.button === 2) {
        // right-click: finish whatever is being laid out, else the menu
        if (stroke?.mode === 'click') finishStroke()
        else if (ruler.value.live) finishMeasure()
        else openContextMenu(...localXY(e))
      }
      break
    case 'moveToken':
    case 'moveVertex':
    case 'moveFeature':
      if (g.moved) {
        scheduleSave()
        if (g.type === 'moveToken') {
          const tk = tokenBase.value.find((x) => x.id === g.id)
          if (tk && !(g.alt || e.altKey)) {
            toast(`${tk.name} · ${Math.round(year.value)}`, null, 'map-pin')
            if (tk.keys.length === 2 && g.keys0.length === 1)
              toast(t('map.toast.firstJourney'), null, 'footprints')
          }
        }
      } else if (g.type !== 'moveFeature') {
        undoStack.pop()
        syncHist()
      }
      snapHit = null
      break
    case 'measure':
      // a dragged first leg is a finished measurement on release
      if (g.moved && g.fresh) {
        const c = measureCursor.value
        if (c) ruler.value = { pts: [...ruler.value.pts, ...c], live: false }
        measureCursor.value = null
        snapHit = null
      }
      break
    case 'draw':
      if (!stroke) break
      if (stroke.mode === 'pending') {
        stroke.mode = 'click'
        strokeMode.value = 'click'
        stroke.cursor = stroke.pts.slice(0, 2)
      } else if (stroke.mode === 'free') {
        // the stroke ends ON the snapped town / vertex, if there was one
        if (snapHit) stroke.pts.push(snapHit.x, snapHit.y)
        finishStroke()
      }
      break
    case 'erase':
      if (!g.erased) {
        undoStack.pop()
        syncHist()
      } else scheduleSave()
      break
  }
}

function onPointerLeave() {
  pointerInside = false
  if (!gesture) {
    hoverFeatureId.value = null
    hoverTokenId.value = null
    hoverCard.value = null
    hoverHandle = null
    hoverHandleType.value = null
    snapHit = null
  }
}

/** Plain-language name of a feature's kind ("Castle", "River", "Battle"). */
function kindLabelOf(f) {
  return f.kind === 'place' || f.kind === 'event'
    ? t('map.tools.' + f.kind + '_' + (f.icon || (f.kind === 'place' ? 'town' : 'star')))
    : t('map.kinds.' + f.kind)
}
/** The icon a feature shows in lists (its glyph's tool icon, else its kind's). */
function featureIcon(f) {
  const byGlyph = f.icon && ALL_TOOLS.find((tl) => tl.glyph === f.icon)
  return byGlyph?.icon || TOOL_BY_ID.get(f.kind)?.icon || 'map-pin'
}
function whenOf(f) {
  return f.from != null || f.to != null ? `${f.from ?? '…'}–${f.to ?? '…'}` : ''
}

function updateHover(sx, sy, wx, wy) {
  const tid = hitToken(sx, sy)
  let fid = null
  hoverHandle = null
  if (!tid && tool.value === 'select') {
    const h = handleAt(wx, wy)
    if (h) hoverHandle = { type: h.type, i: h.i }
  }
  hoverHandleType.value = hoverHandle?.type || null
  if (!tid && !hoverHandle && (tool.value === 'select' || tool.value === 'erase'))
    fid = hitAt(wx, wy, { skipBase: tool.value === 'select' })
  hoverTokenId.value = tid
  hoverFeatureId.value = fid
  if (tid) {
    const tk = tokenBase.value.find((x) => x.id === tid)
    const st = tokenStateAt(tk.keys, displayYear)
    const leg = tk.keys[st.from]
    hoverCard.value = {
      x: sx + 16,
      y: sy + 14,
      title: tk.name,
      sub:
        tk.keys.length > 1 ? t('map.hover.stops', { n: tk.keys.length }) : t('map.hover.dragHint'),
      note: leg?.note || ''
    }
  } else if (fid) {
    const f = draft.value.features.find((x) => x.id === fid)
    const when = whenOf(f) ? ` · ${whenOf(f)}` : ''
    const kindLabel = kindLabelOf(f)
    hoverCard.value =
      f.name || f.note || when
        ? {
            x: sx + 16,
            y: sy + 14,
            title: f.name || kindLabel,
            sub: (f.name ? kindLabel : '') + when,
            note: (f.note || '').slice(0, 140)
          }
        : null
  } else hoverCard.value = null
}

function eraseAt(sx, sy) {
  const tid = hitToken(sx, sy)
  if (tid) {
    draft.value.tokens = draft.value.tokens.filter((tk) => tk.id !== tid)
    gesture.erased++
    bump()
    return
  }
  const [wx, wy] = toWorld(cam, sx, sy)
  const fid = hitAt(wx, wy)
  if (!fid) return
  const f = draft.value.features.find((x) => x.id === fid)
  draft.value.features = draft.value.features.filter((x) => x.id !== fid)
  const c = geoOf(f.kind) === 'area' ? polygonCentroid(f.pts) : f.pts
  burst(c[0], c[1], dangerColor())
  if (selectedFeatureId.value === fid) selectedFeatureId.value = null
  gesture.erased++
  bump()
}
/** The theme's danger red, read from the design tokens (canvas can't use var()). */
function dangerColor() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--danger').trim()
  return v || '#ef5350'
}

function placePoint(kind, glyph, wx, wy) {
  const f = {
    id: crypto.randomUUID(),
    kind,
    pts: [Math.round(wx * 10) / 10, Math.round(wy * 10) / 10]
  }
  if (glyph) f.icon = glyph
  if (kind === 'event') f.from = Math.round(year.value)
  if (kind === 'label') f.name = t('map.defaults.label')
  commit((d) => d.features.push(f))
  selectFeature(f.id)
  burst(wx, wy, style.value.accent)
  nextTick(() => inspectorRef.value?.focusName?.())
}

function finishStroke() {
  const s = stroke
  stroke = null
  strokeMode.value = null
  snapHit = null
  if (!s) return
  const geo = geoOf(s.kind)
  let pts = s.pts.slice()
  if (s.mode === 'free') {
    // simplify the hand-drawn wobble, but keep a snapped start / end exact
    const [x0, y0] = [pts[0], pts[1]]
    const [x1, y1] = [pts[pts.length - 2], pts[pts.length - 1]]
    pts = simplify(pts, 1.4 / cam.k)
    pts[0] = x0
    pts[1] = y0
    pts[pts.length - 2] = x1
    pts[pts.length - 1] = y1
  }
  if (geo === 'area') {
    if (pts.length < 6 || Math.abs(polygonArea(pts)) * cam.k * cam.k < 200)
      return toast(t('map.toast.tooSmall'))
  } else if (pts.length < 4 || polylineLength(pts) * cam.k < 10)
    return toast(t('map.toast.tooSmall'))
  pts = pts.map((v) => Math.round(v * 10) / 10)
  const f = { id: crypto.randomUUID(), kind: s.kind, pts }
  if (s.kind === 'territory') {
    const n = draft.value.features.filter((x) => x.kind === 'territory').length
    f.color = KINGDOM_COLORS[n % KINGDOM_COLORS.length]
  }
  if (s.kind === 'zone' || s.kind === 'arrow') f.from = Math.round(year.value)
  commit((d) => d.features.push(f))
  selectFeature(f.id)
  const c = geo === 'area' ? polygonCentroid(pts) : [pts[pts.length - 2], pts[pts.length - 1]]
  burst(c[0], c[1], previewOf({ ...s, pts }).color)
  if (s.kind === 'territory' || s.kind === 'arrow' || s.kind === 'zone')
    nextTick(() => inspectorRef.value?.focusName?.())
}

function cancelStroke() {
  stroke = null
  strokeMode.value = null
  snapHit = null
}

function onWheel(e) {
  if (!draft.value) return
  const [sx, sy] = localXY(e)
  flight = null
  ctxMenu.value = null
  const scale = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1
  if (e.shiftKey && !e.ctrlKey) {
    const base = camTarget || cam
    camTarget = { ...base, x: base.x - (e.deltaY + e.deltaX) * scale, y: base.y }
    return
  }
  const f = Math.exp(-e.deltaY * scale * (e.ctrlKey ? 0.012 : 0.0018))
  camTarget = zoomAt(camTarget || cam, sx, sy, f)
  hoverCard.value = null
}

function onDblClick(e) {
  if (!draft.value) return
  const [sx, sy] = localXY(e)
  if (stroke?.mode === 'click') {
    // A real double-click's two presses land on the same spot, adding the
    // same point twice — drop the echo and finish. Two quick clicks far apart
    // (the browser may still call that a dblclick) are just two vertices.
    const p = stroke.pts
    const n = p.length
    if (n >= 4 && Math.hypot(p[n - 2] - p[n - 4], p[n - 1] - p[n - 3]) * cam.k < 8) {
      p.splice(-2, 2)
      finishStroke()
    }
    return
  }
  if (tool.value === 'measure') {
    const p = ruler.value.pts
    const n = p.length
    if (n >= 6 && Math.hypot(p[n - 2] - p[n - 4], p[n - 1] - p[n - 3]) * cam.k < 8)
      ruler.value = { pts: p.slice(0, -2), live: true }
    finishMeasure()
    return
  }
  if (tool.value !== 'select') return
  const tid = hitToken(sx, sy)
  if (tid) {
    const tk = tokenBase.value.find((x) => x.id === tid)
    if (tk) store.selectPerson(tk.personId)
    return
  }
  const [wx, wy] = toWorld(cam, sx, sy)
  // double-clicking a corner removes it (the press before it started a no-op drag)
  const h = handleAt(wx, wy)
  if (h?.type === 'vertex') return deleteVertex(h.f, h.i)
  const fid = hitAt(wx, wy, { skipBase: true })
  if (fid) {
    selectFeature(fid)
    nextTick(() => inspectorRef.value?.focusName?.())
    return
  }
  const base = hitAt(wx, wy)
  if (base) {
    selectFeature(base)
    return
  }
  camTarget = zoomAt(cam, sx, sy, 2)
}

const cursor = computed(() => {
  if (dropHover.value) return 'copy'
  if (tool.value === 'pan') return 'grab'
  if (tool.value === 'erase' || tool.value === 'measure') return 'crosshair'
  if (tool.value === 'select') {
    if (hoverTokenId.value) return 'pointer'
    if (hoverHandleType.value === 'vertex') return 'move'
    if (hoverHandleType.value === 'mid') return 'copy'
    return hoverFeatureId.value ? 'pointer' : 'default'
  }
  return 'crosshair'
})

// ── context menu ─────────────────────────────────────────────────────────────
let ctxN = 0
function openContextMenu(sx, sy) {
  const [wx, wy] = toWorld(cam, sx, sy)
  const mod = /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘' : 'Ctrl+'
  const base = { key: ++ctxN, x: sx, y: sy, at: [wx, wy] }
  const tid = hitToken(sx, sy)
  if (tid) {
    selectToken(tid)
    const tk = tokenBase.value.find((x) => x.id === tid)
    ctxMenu.value = {
      ...base,
      title: tk?.name || '',
      items: [
        { id: 'profile', icon: 'user', label: t('map.inspector.profile') },
        {
          id: 'follow',
          icon: 'video',
          label: following.value ? t('map.inspector.following') : t('map.inspector.follow')
        },
        { id: 'sep1', sep: true },
        {
          id: 'removeToken',
          icon: 'trash-2',
          label: t('map.inspector.removeFromMap'),
          danger: true
        }
      ]
    }
    return
  }
  const h = handleAt(wx, wy)
  if (h?.type === 'vertex') {
    ctxMenu.value = {
      ...base,
      title: h.f.name || kindLabelOf(h.f),
      vertex: h,
      items: [
        {
          id: 'deleteVertex',
          icon: 'circle-minus',
          label: t('map.ctx.deletePoint'),
          kbd: 'Alt+click'
        }
      ]
    }
    return
  }
  const fid = hitAt(wx, wy, { skipBase: true }) || hitAt(wx, wy)
  if (fid) {
    selectFeature(fid)
    const f = draft.value.features.find((x) => x.id === fid)
    const geo = geoOf(f.kind)
    ctxMenu.value = {
      ...base,
      title: f.name || kindLabelOf(f),
      items: [
        { id: 'rename', icon: 'pencil', label: t('map.ctx.rename') },
        { id: 'duplicate', icon: 'copy', label: t('map.ctx.duplicate'), kbd: mod + 'D' },
        { id: 'copy', icon: 'clipboard', label: t('map.ctx.copy'), kbd: mod + 'C' },
        { id: 'sep1', sep: true },
        { id: 'front', icon: 'bring-to-front', label: t('map.inspector.front') },
        { id: 'back', icon: 'send-to-back', label: t('map.inspector.back') },
        ...(geo !== 'point'
          ? [
              {
                id: 'era',
                icon: 'scissors',
                label: t('map.inspector.newEra', { y: yearInt.value })
              }
            ]
          : []),
        { id: 'sep2', sep: true },
        { id: 'delete', icon: 'trash-2', label: t('map.ctx.delete'), kbd: 'Del', danger: true }
      ]
    }
    return
  }
  ctxMenu.value = {
    ...base,
    title: '',
    items: [
      {
        id: 'paste',
        icon: 'clipboard-paste',
        label: t('map.ctx.pasteHere'),
        kbd: mod + 'V',
        disabled: !clipboard
      },
      { id: 'label', icon: 'type', label: t('map.ctx.labelHere') },
      { id: 'measure', icon: 'ruler', label: t('map.ctx.measureFrom') },
      { id: 'sep1', sep: true },
      { id: 'fit', icon: 'maximize', label: t('map.zoom.fit'), kbd: '0' }
    ]
  }
}

function onCtxPick(id) {
  const m = ctxMenu.value
  ctxMenu.value = null
  if (!m) return
  const [wx, wy] = m.at
  switch (id) {
    case 'profile':
      return openPerson()
    case 'follow':
      following.value = !following.value
      return
    case 'removeToken':
      return deleteSelected()
    case 'deleteVertex':
      return deleteVertex(m.vertex.f, m.vertex.i)
    case 'rename':
      return nextTick(() => inspectorRef.value?.focusName?.())
    case 'duplicate':
      return duplicateSelected()
    case 'copy':
      return copySelected()
    case 'front':
      return reorderSelected(1)
    case 'back':
      return reorderSelected(-1)
    case 'era':
      return forkEra()
    case 'delete':
      return deleteSelected()
    case 'paste':
      return pasteAt(wx, wy)
    case 'label':
      return placePoint('label', undefined, wx, wy)
    case 'measure':
      tool.value = 'measure'
      ruler.value = { pts: [wx, wy], live: true }
      measureCursor.value = [wx, wy]
      return
    case 'fit':
      return fitView(true)
  }
}

// ── copy / paste ─────────────────────────────────────────────────────────────
function copySelected() {
  const f = draft.value?.features.find((x) => x.id === selectedFeatureId.value)
  if (!f) return false
  clipboard = clone(f)
  toast(t('map.toast.copied', { name: f.name || kindLabelOf(f) }), null, 'copy')
  return true
}
/** Paste the copied feature centred on a world point (any map — the
 *  clipboard outlives switching maps). One undo step. */
function pasteAt(wx, wy) {
  if (!clipboard || !draft.value) return toast(t('map.toast.nothingToPaste'))
  const src = clipboard
  const b = bboxOf(src.pts)
  const copy = {
    ...clone(src),
    id: crypto.randomUUID(),
    pts: translatePts(src.pts, wx - (b.x0 + b.x1) / 2, wy - (b.y0 + b.y1) / 2)
  }
  // a paste you can't see is a dead click: bring it into the current year
  const y = Math.round(year.value)
  if (windowAlpha(copy, y) < 0.3) {
    copy.from = y
    if (copy.to != null && copy.to < y) delete copy.to
  }
  if (hiddenKinds.value.has(copy.kind)) revealKind(copy.kind)
  commit((d) => d.features.push(copy))
  selectFeature(copy.id)
  burst(wx, wy, style.value.accent)
}
function pasteHere() {
  const { w, h } = viewSize.value
  const [wx, wy] = pointerInside && lastWorld ? lastWorld : toWorld(cam, w / 2, h / 2)
  pasteAt(wx, wy)
}

/** Switch a hidden layer back on (you just drew / pasted / found into it). */
function revealKind(kind) {
  const ly = layerOf(kind)
  if (!ly || !hiddenLayers.value.includes(ly.id)) return
  hiddenLayers.value = hiddenLayers.value.filter((x) => x !== ly.id)
  toast(t('map.toast.layerShown', { layer: t('map.layers.' + ly.id) }), null, 'eye')
}

// ── find ─────────────────────────────────────────────────────────────────────
const findItems = computed(() => {
  if (menu.value !== 'find') return []
  version.value
  const out = []
  for (const f of draft.value?.features || []) {
    if (!f.name) continue
    const when = whenOf(f)
    out.push({
      id: f.id,
      type: 'feature',
      name: f.name,
      sub: kindLabelOf(f) + (when ? ' · ' + when : ''),
      icon: featureIcon(f),
      color: f.color || '',
      faded: windowAlpha(f, yearInt.value) < 0.3 || hiddenKinds.value.has(f.kind),
      rank: f.kind === 'place' ? -(PLACE_RANK[f.icon || 'town'] ?? 2) : 0
    })
  }
  for (const tk of tokenBase.value) {
    out.push({
      id: tk.id,
      type: 'token',
      name: tk.name,
      sub: tk.keys.length > 1 ? t('map.hover.stops', { n: tk.keys.length }) : t('map.find.person'),
      color: tk.color,
      imgUrl: tk.imgUrl,
      initial: tk.initial,
      faded: !showPeople.value
    })
  }
  return out
})

function onFindPick(it) {
  menu.value = null
  if (it.type === 'token') {
    showPeople.value = true
    const tk = draft.value.tokens.find((x) => x.id === it.id)
    if (tk) flyToPerson(tk.person_id)
    return
  }
  const f = draft.value.features.find((x) => x.id === it.id)
  if (f) flyToFeature(f)
}

/** Frame a feature (bringing it into time and out of a hidden layer first). */
function flyToFeature(f) {
  revealKind(f.kind)
  if (windowAlpha(f, year.value) < 0.3) {
    scrubTo(f.from ?? f.to)
    onScrubEnd()
  }
  const { w, h } = viewSize.value
  if (geoOf(f.kind) === 'point') {
    flyTo(centerOn(f.pts[0], f.pts[1], Math.max(cam.k, 1.6), w, h))
  } else {
    const c = fitCamera(bboxOf(f.pts), w, h, Math.min(w, h) * 0.2)
    // don't dive into a tiny shape — hold at a readable zoom
    flyTo(c.k > 6 ? centerOn(...polygonCentroid(f.pts), 6, w, h) : c)
  }
  selectFeature(f.id)
}

/** The selection's size, in the style's unit, for the inspector. */
const selMeasure = computed(() => {
  const f = selFeature.value
  if (!f) return ''
  const geo = geoOf(f.kind)
  if (geo === 'line') return t('map.inspector.length', { d: fmtDistance(polylineLength(f.pts)) })
  if (geo === 'area')
    return t('map.inspector.area', {
      a: fmtArea(Math.abs(polygonArea(f.pts))),
      d: fmtDistance(polylineLength(f.pts, true))
    })
  return ''
})

// ── hints ────────────────────────────────────────────────────────────────────
const hintIcon = computed(() => TOOL_BY_ID.get(tool.value)?.icon || 'mouse-pointer-2')
const hintText = computed(() => {
  const tl = tool.value
  if (strokeMode.value === 'click') return t('map.hint.clickMode')
  if (tl === 'select') {
    if (selToken.value) return t('map.hint.token', { name: selToken.value.name, y: yearInt.value })
    if (selFeature.value && geoOf(selFeature.value.kind) !== 'point') return t('map.hint.shape')
    return t('map.hint.select')
  }
  if (tl === 'measure') {
    const m = ruler.value
    if (m.pts.length >= 2 && (m.live || m.pts.length >= 4))
      return t(m.live ? 'map.hint.measuring' : 'map.hint.measured', {
        d: fmtDistance(measureTotal.value)
      })
    return t('map.hint.measure')
  }
  if (tl === 'pan' || tl === 'erase') return t('map.hint.' + tl)
  const { kind } = toolKind(tl)
  const name = t('map.tools.' + tl.replace(':', '_'))
  const geo = geoOf(kind)
  return t('map.hint.' + geo, { name })
})

// remember hotkey-picked tools as their group's face; leaving a draw tool
// abandons any half-drawn stroke; drawing into a hidden layer reveals it
watch(tool, (tl) => {
  toolbarRef.value?.remember(tl)
  if (stroke && toolKind(tl).kind !== stroke.kind) cancelStroke()
  if (tl !== 'measure') clearMeasure()
  snapHit = null
  ctxMenu.value = null
  const { kind } = toolKind(tl)
  if (kind) revealKind(kind)
})

// ── keyboard ─────────────────────────────────────────────────────────────────
function isTyping(e) {
  const el = e.target
  return (
    !!el &&
    (el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      el.isContentEditable)
  )
}
function hotkeysBlocked() {
  return (
    !props.active ||
    !draft.value ||
    newOpen.value ||
    !store.authUser ||
    store.curtain?.active ||
    store.userPageOpen ||
    store.projectsPageOpen ||
    store.browsePageOpen ||
    store.formOpen ||
    store.modalOpen ||
    !!document.querySelector('.home')
  )
}
const HOTKEYS = new Map(ALL_TOOLS.filter((tl) => tl.hotkey).map((tl) => [tl.hotkey, tl.id]))

function onKeydown(e) {
  if (hotkeysBlocked() || isTyping(e)) return
  const key = e.key.toLowerCase()
  const mod = e.ctrlKey || e.metaKey
  if (mod && !e.altKey) {
    // the map's own undo (the app-wide data undo doesn't cover maps)
    if (key === 'z' || key === 'x' || key === 'y') {
      e.preventDefault()
      e.stopPropagation()
      if (key === 'z' && !e.shiftKey) undo()
      else redo()
      return
    }
    let act = null
    if (key === 'f') act = () => (menu.value = 'find')
    else if (key === 'v' && clipboard) act = pasteHere
    else if (key === 'c' && selectedFeatureId.value) act = copySelected
    else if (key === 'd' && selectedFeatureId.value) act = duplicateSelected
    if (act) {
      e.preventDefault()
      e.stopPropagation()
      act()
    }
    return
  }
  if (e.altKey) return
  if (e.key === '?') {
    // the map's own sheet instead of the app-wide Help page
    e.preventDefault()
    e.stopPropagation()
    keysOpen.value = !keysOpen.value
    return
  }
  if (e.key === ' ') {
    spaceDown = true
    e.preventDefault()
    return
  }
  if (e.key === 'Escape') {
    if (ctxMenu.value) ctxMenu.value = null
    else if (keysOpen.value) keysOpen.value = false
    else if (stroke) cancelStroke()
    else if (menu.value) menu.value = null
    else if (ruler.value.pts.length) clearMeasure()
    else if (selectedFeatureId.value || selectedTokenId.value) clearSelection()
    else tool.value = 'select'
    return
  }
  if (e.key === 'Enter') {
    if (stroke?.mode === 'click') finishStroke()
    else if (ruler.value.live) finishMeasure()
    return
  }
  if (e.key === 'Backspace' || e.key === 'Delete') {
    if (stroke?.mode === 'click') {
      if (stroke.pts.length > 2) stroke.pts.splice(-2, 2)
      else cancelStroke()
    } else if (tool.value === 'measure' && ruler.value.pts.length) {
      const p = ruler.value.pts
      if (p.length > 2) ruler.value = { pts: p.slice(0, -2), live: ruler.value.live }
      else clearMeasure()
    } else deleteSelected()
    e.preventDefault()
    return
  }
  if (e.key.startsWith('Arrow') && (selectedFeatureId.value || selectedTokenId.value)) {
    const step = (e.shiftKey ? 10 : 1) / cam.k
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
    nudge(dx, dy)
    e.preventDefault()
    return
  }
  if (key === '+' || key === '=') return zoomBy(1.4)
  if (key === '-' || key === '_') return zoomBy(1 / 1.4)
  if (key === '0') return fitView(true)
  if (key === 'p') return togglePlay()
  if (key === '[' || key === ',') return stepYear(-1)
  if (key === ']' || key === '.') return stepYear(1)
  if (key === 'g') return (peopleOpen.value = !peopleOpen.value)
  const tl = HOTKEYS.get(key)
  if (tl) tool.value = tl
}
function onKeyup(e) {
  if (e.key === ' ') spaceDown = false
}

function nudge(dx, dy) {
  if (selectedFeatureId.value) {
    const id = selectedFeatureId.value
    commit((d) => {
      const i = d.features.findIndex((f) => f.id === id)
      d.features[i] = { ...d.features[i], pts: translatePts(d.features[i].pts, dx, dy) }
    }, 'nudge:' + id)
  } else if (selectedTokenId.value) {
    const id = selectedTokenId.value
    commit((d) => {
      const i = d.tokens.findIndex((tk) => tk.id === id)
      const st = tokenStateAt(d.tokens[i].keys, displayYear)
      d.tokens[i] = {
        ...d.tokens[i],
        keys: upsertKey(d.tokens[i].keys, year.value, st.x + dx, st.y + dy)
      }
    }, 'nudge:' + id)
  }
}

// ── export ───────────────────────────────────────────────────────────────────
/** Save a PNG: 'sheet' = the whole map at up to 4096px, 'view' = exactly what
 *  is on screen at 2× — both as the map looks now (year, layers, style). */
async function exportPng(mode = 'sheet') {
  menu.value = null
  const d = draft.value
  if (!d) return
  await flushSave()
  // painted styles need their sprites + calligraphy fonts before the still
  if (style.value.painting || style.value.calligraphy) await loadInkMapAssets()
  const c = document.createElement('canvas')
  const r = new MapRenderer(c)
  let shotCam
  if (mode === 'view') {
    r.resize(viewSize.value.w, viewSize.value.h, 2)
    shotCam = { ...cam }
  } else {
    const scale = Math.min(2, 4096 / Math.max(d.width, d.height))
    r.resize(Math.round(d.width * scale), Math.round(d.height * scale), 1)
    shotCam = { x: 0, y: 0, k: scale }
  }
  r.render({
    ...sceneState(),
    version: -1,
    cam: shotCam,
    year: displayYear,
    time: 0,
    selectedFeatureId: null,
    selectedTokenId: null,
    hoverFeatureId: null,
    hoverTokenId: null,
    preview: null,
    bursts: [],
    exporting: true
  })
  c.toBlob((blob) => {
    r.dispose()
    if (!blob) return toast(t('map.toast.exportFailed'), null, 'triangle-alert')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const base = defaultNameLabel(d.name) || 'map'
    a.download = `${base.replace(/[\\/:*?"<>|]+/g, '_')} ${Math.round(year.value)}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    toast(t('map.toast.exported'), null, 'download')
  }, 'image/png')
}

// ── lifecycle ────────────────────────────────────────────────────────────────
function measure() {
  const el = stageEl.value
  if (!el || !renderer) return
  const w = el.clientWidth
  const h = el.clientHeight
  if (w < 2 || h < 2) return
  const prev = viewSize.value
  // keep the world point at the centre steady through a resize
  const [cx, cy] = prev.w > 1 ? toWorld(cam, prev.w / 2, prev.h / 2) : [null, null]
  viewSize.value = { w, h }
  renderer.resize(w, h, Math.min(2, window.devicePixelRatio || 1))
  needsFrame = true // resizing wiped the canvas
  if (cx != null) cam = centerOn(cx, cy, cam.k, w, h)
  else fitView(false)
}

function start() {
  needsFrame = true
  if (!raf) {
    lastFrame = 0
    raf = requestAnimationFrame(frame)
  }
}
function stop() {
  cancelAnimationFrame(raf)
  raf = 0
}

onMounted(() => {
  // the Style Studio edits this map's style through our undo + autosave
  mapStyleBridge.value = bridgeHandle
  renderer = new MapRenderer(canvasEl.value)
  renderer.onAssets = () => (needsFrame = true)
  resizeObs = new ResizeObserver(measure)
  resizeObs.observe(stageEl.value)
  measure()
  if (draft.value && !draft.value.view) fitView(false)
  else if (draft.value?.view)
    cam = centerOn(
      draft.value.view.x,
      draft.value.view.y,
      draft.value.view.k,
      viewSize.value.w,
      viewSize.value.h
    )
  window.addEventListener('keydown', onKeydown, true)
  window.addEventListener('keyup', onKeyup)
  if (props.active) start()
})
watch(
  () => props.active,
  (on) => {
    if (on) {
      measure()
      start()
    } else {
      stop()
      playing.value = false
      flushSave()
    }
  }
)
onBeforeUnmount(() => {
  if (mapStyleBridge.value === bridgeHandle) mapStyleBridge.value = null
  stop()
  flushSave()
  resizeObs?.disconnect()
  window.removeEventListener('keydown', onKeydown, true)
  window.removeEventListener('keyup', onKeyup)
  motionQuery?.removeEventListener?.('change', onMotionPref)
  renderer?.dispose()
  renderer = null
})

// a person deleted / renamed / re-photographed → tokens re-derive; nothing to do
// but keep the hover card honest
watch(
  () => store.persons.length,
  () => (hoverCard.value = null)
)

defineExpose({ undo, redo, flushSave })
</script>

<style scoped>
.mv {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  z-index: 2;
}
/* the header's dropdowns must open over the stage's panels (inspector, drawer) */
.mv > .vh {
  z-index: 20;
}
.mv-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.mv-stage.mv-drop::after {
  content: '';
  position: absolute;
  inset: 8px;
  border: 2px dashed var(--accent);
  border-radius: 14px;
  pointer-events: none;
  animation: mv-drop 1s ease-in-out infinite;
}
@keyframes mv-drop {
  50% {
    opacity: 0.4;
  }
}
.mv-canvas {
  position: absolute;
  inset: 0;
  display: block;
  touch-action: none;
}

/* ── header actions ── */
.mv-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.mv-menu-wrap {
  position: relative;
}
.mv-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 220px;
  height: var(--ctl-md);
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.12s,
    border-color 0.12s;
}
.mv-pill:hover,
.mv-pill.open {
  background: var(--hover);
  border-color: var(--accent);
}
.mv-pill-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mv-pill .ui-icon {
  flex: 0 0 auto;
}
.mv-caret {
  color: var(--t3);
}
.mv-toggle {
  width: var(--ctl-md);
  height: var(--ctl-md);
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
}
.mv-toggle:hover {
  background: var(--hover);
  color: var(--t1);
}
.mv-toggle.on {
  color: var(--accent);
  background: var(--adim);
  border-color: var(--accent);
}
.mv-toggle.open {
  background: var(--hover);
  color: var(--t1);
  border-color: var(--accent);
}
.mv-find-menu {
  min-width: 0;
}
.mv-layers-menu {
  width: 270px;
}
.mv-layer {
  display: flex;
  align-items: center;
  gap: 9px;
  height: var(--ctl-md);
  padding: 0 9px;
  border: none;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--t1);
  font-family: var(--font);
  font-size: var(--fs-md);
  text-align: left;
  cursor: pointer;
  transition: background var(--dur-fast);
}
.mv-layer:hover {
  background: var(--hover);
}
.mv-layer.off {
  color: var(--t3);
}
.mv-layer-name {
  flex: 1;
  white-space: nowrap;
}
.mv-layer-n {
  font-size: var(--fs-xs);
  color: var(--t3);
  font-variant-numeric: tabular-nums;
}
.mv-layer-eye {
  flex: 0 0 auto;
  color: var(--t2);
}
.mv-layer.off .mv-layer-eye {
  color: var(--t3);
}
.mv-layers-reset {
  color: var(--accent);
}
.mv-menu-rich {
  align-items: flex-start;
  padding: 8px 9px;
}
.mv-menu-rich .ui-icon {
  margin-top: 1px;
  flex: 0 0 auto;
}
.mv-menu-rich-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.mv-menu-rich-text small {
  font-size: var(--fs-xs);
  color: var(--t3);
}
.mv-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  min-width: 260px;
  max-height: 70vh;
  overflow-y: auto;
  padding: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mv-menu-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--t3);
  padding: 6px 8px 4px;
}
.mv-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--t1);
  font-family: var(--font);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}
.mv-menu-item:hover {
  background: var(--hover);
}
.mv-menu-item.on {
  background: var(--adim);
  color: var(--accent);
}
.mv-menu-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mv-menu-meta {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11.5px;
  color: var(--t3);
  font-variant-numeric: tabular-nums;
}
.mv-menu-meta-gap {
  margin-left: 6px;
}
.mv-menu-sep {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}
.mv-menu-rename {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 9px;
  color: var(--t3);
}
.mv-menu-rename input {
  flex: 1;
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t1);
  border-radius: 7px;
  padding: 5px 8px;
  font-family: var(--font);
  font-size: 13px;
  outline: none;
}
.mv-menu-rename input:focus {
  border-color: var(--accent);
}
.mv-danger:hover {
  background: rgba(var(--danger-rgb), 0.16);
}
.mv-style-menu {
  width: 520px;
}
.mv-style-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 2px 4px 8px;
}
.mv-style-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.mv-style-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 6px;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  animation: mv-card-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: calc(var(--i) * 40ms);
  transition:
    transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
    border-color 0.15s;
}
@keyframes mv-card-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
.mv-style-card:hover {
  transform: translateY(-2px);
}
.mv-style-card.on {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--adim);
}
.mv-seg {
  display: flex;
  gap: 4px;
  padding: 0 4px 4px;
}
.mv-seg button {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: var(--ctl-md);
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 12.5px;
  cursor: pointer;
}
.mv-seg button.on {
  background: var(--adim);
  border-color: var(--accent);
  color: var(--accent);
}

/* ── on-canvas chrome ── */
.mv-hint {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: min(640px, calc(100% - 700px));
  min-width: 260px;
  padding: 7px 14px;
  background: var(--glass-strong);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 999px;
  box-shadow: var(--shadow);
  color: var(--t2);
  font-size: 12.5px;
  pointer-events: none;
  z-index: 7;
}
.mv-hint-icon {
  flex: 0 0 auto;
  color: var(--t1);
}
.mv-hint-enter-active,
.mv-hint-leave-active {
  transition:
    opacity 0.18s,
    transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}
.mv-hint-enter-from {
  opacity: 0;
  transform: translate(-50%, -8px);
}
.mv-hint-leave-to {
  opacity: 0;
  transform: translate(-50%, 6px);
}
.mv-toasts {
  position: absolute;
  top: 58px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: none;
  z-index: 11;
}
.mv-toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 4px solid var(--c);
  box-shadow: var(--shadow);
  color: var(--t1);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.mv-toast-icon {
  flex: 0 0 auto;
  color: var(--c);
}
.mv-toast-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.mv-toast-leave-active {
  transition: all 0.3s ease;
}
.mv-toast-enter-from {
  opacity: 0;
  transform: translateY(-14px) scale(0.9);
}
.mv-toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.mv-zoom {
  position: absolute;
  left: 14px;
  bottom: 78px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--glass-strong);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
  z-index: 8;
}
.mv-zoom button {
  width: var(--ctl-md);
  height: var(--ctl-md);
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--t1);
  cursor: pointer;
}
.mv-zoom button:hover:not(:disabled) {
  background: var(--hover);
}
.mv-zoom button:disabled {
  color: var(--t3);
  cursor: default;
}
.mv-zoom-sep {
  width: 1px;
  height: 20px;
  margin: 0 3px;
  background: var(--border);
}
.mv-scale {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 0 8px 0 6px;
  font-size: 11px;
  color: var(--t2);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.mv-scale-bar {
  height: 6px;
  border: 1.5px solid var(--t2);
  border-top: none;
  transition: width 0.2s;
}
.mv-hover {
  position: absolute;
  max-width: 260px;
  padding: 8px 11px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow);
  pointer-events: none;
  z-index: 12;
}
.mv-hover-title {
  font-weight: 700;
  color: var(--t1);
  font-size: 13px;
}
.mv-hover-sub {
  font-size: 12px;
  color: var(--t2);
}
.mv-hover-note {
  font-size: 12.5px;
  color: var(--t2);
  margin-top: 4px;
  line-height: 1.4;
}
.mv-card-enter-active,
.mv-card-leave-active {
  transition:
    opacity 0.15s,
    transform 0.15s;
}
.mv-card-enter-from,
.mv-card-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
.mv-side-enter-active,
.mv-side-leave-active,
.mv-side-r-enter-active,
.mv-side-r-leave-active {
  transition:
    opacity 0.22s,
    transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
.mv-side-enter-from,
.mv-side-leave-to {
  opacity: 0;
  transform: translateX(-16px);
}
.mv-side-r-enter-from,
.mv-side-r-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
.mv-pop-enter-active,
.mv-pop-leave-active {
  transition:
    opacity 0.16s,
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
.mv-pop-enter-from,
.mv-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
</style>
