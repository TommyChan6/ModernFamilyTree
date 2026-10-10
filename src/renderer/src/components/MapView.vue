<template>
  <div class="mv">
    <ViewHeader
      icon="map"
      :title="t('rail.map')"
      :count="store.maps.length || null"
      :hint="meta ? meta.name : ''"
    >
      <div v-if="draft" class="mv-actions" @pointerdown.stop>
        <!-- map switcher -->
        <div class="mv-menu-wrap">
          <button class="mv-pill" :class="{ open: menu === 'maps' }" @click="toggleMenu('maps')">
            <UiIcon name="map" :size="16" />
            <span class="mv-pill-text">{{ meta.name }}</span>
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
                <span class="mv-menu-name">{{ m.name }}</span>
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

        <button
          class="mv-toggle"
          :class="{ on: showLabels }"
          :title="t('map.menu.labels')"
          :aria-label="t('map.menu.labels')"
          :aria-pressed="showLabels"
          @click="showLabels = !showLabels"
        >
          <UiIcon name="tag" :size="16" />
        </button>
        <button
          class="mv-toggle"
          :class="{ on: showTrails }"
          :title="t('map.menu.journeys')"
          :aria-label="t('map.menu.journeys')"
          :aria-pressed="showTrails"
          @click="showTrails = !showTrails"
        >
          <UiIcon name="footprints" :size="16" />
        </button>
        <button
          class="mv-toggle"
          :title="t('map.menu.export')"
          :aria-label="t('map.menu.export')"
          @click="exportPng"
        >
          <UiIcon name="download" :size="16" />
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

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useMainStore } from '../store/index.js'
import { useI18n } from '../i18n'
import { api } from '../api'
import ViewHeader from './ViewHeader.vue'
import UiIcon from './ui/UiIcon.js'
import MapToolbar from './map/MapToolbar.vue'
import MapInspector from './map/MapInspector.vue'
import MapTimeline from './map/MapTimeline.vue'
import MapPeopleDrawer from './map/MapPeopleDrawer.vue'
import MapNewDialog from './map/MapNewDialog.vue'
import MapStyleThumb from './map/MapStyleThumb.vue'
import { MapRenderer } from './map/MapRenderer'
import { MAP_STYLE_LIST, styleOf } from './map/mapStyles'
import { loadInkMapAssets } from './map/inkSprites'
import { MAP_KIND_GEOMETRY, TOOL_BY_ID, ALL_TOOLS, LIVE_KINDS, toolKind } from './map/mapKinds'
import { KINGDOM_COLORS } from './map/mapGen'
import {
  centerOn,
  clamp,
  fitCamera,
  hitFeature,
  hitVertex,
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
const { t } = useI18n()

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
const showLabels = ref(true)
const showTrails = ref(true)
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
// ambient map life (mist, boats, geese, the style bloom) holds still for
// people who asked the OS for less motion
const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
const reducedMotion = ref(!!motionQuery?.matches)
const onMotionPref = (e) => (reducedMotion.value = e.matches)
motionQuery?.addEventListener?.('change', onMotionPref)

const bump = () => version.value++
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
  toast(`${styleOf(id).icon} ${t('map.styles.' + id)}`)
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

const scaleBar = computed(() => {
  // one world unit = 1 km; each style names its own unit
  const unit = {
    parchment: ['leagues', 1 / 4.8],
    fantasy: ['leagues', 1 / 4.8],
    ink: ['里', 2],
    shanshui: ['里', 2],
    qinglu: ['里', 2],
    hightech: ['km', 1],
    atlas: ['km', 1]
  }[style.value.id] || ['km', 1]
  const perPx = unit[1] / camK.value
  const len = niceLength(110 * perPx)
  return { px: Math.round(len / perPx), label: `${len} ${unit[0]}` }
})

// ── frame loop ───────────────────────────────────────────────────────────────
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

  const tokens = tokenBase.value.map((tk) => {
    const life = lifeAlpha(tk.birth, tk.death, displayYear)
    return {
      id: tk.id,
      name: tk.name,
      color: tk.color,
      initial: tk.initial,
      img: tk.img,
      keys: tk.keys,
      life,
      dead: tk.death != null && displayYear > tk.death + 0.5
    }
  })
  const tagColors = new Map(store.tags.filter((tg) => tg.color).map((tg) => [tg.id, tg.color]))
  renderer.render({
    doc: d,
    version: version.value,
    style: style.value,
    cam,
    year: displayYear,
    time,
    theme: mapTheme(),
    tokens,
    tagColors,
    selectedFeatureId: selectedFeatureId.value,
    selectedTokenId: selectedTokenId.value,
    hoverFeatureId: hoverFeatureId.value,
    hoverTokenId: hoverTokenId.value,
    preview: stroke ? previewOf(stroke) : null,
    showTrails: showTrails.value,
    showLabels: showLabels.value,
    bursts,
    reducedMotion: reducedMotion.value
  })
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

// ── hit testing ──────────────────────────────────────────────────────────────
const geoOf = (k) => MAP_KIND_GEOMETRY[k]
function localXY(e) {
  const r = canvasEl.value.getBoundingClientRect()
  return [e.clientX - r.left, e.clientY - r.top]
}
function hitToken(sx, sy) {
  const hits = renderer?.tokenHits || []
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i]
    if (Math.hypot(sx - h.x, sy - h.y) <= h.r) return h.id
  }
  return null
}
function hitAt(wx, wy, opts) {
  return hitFeature(draft.value.features, wx, wy, 9 / cam.k, displayYear, geoOf, opts)
}

// ── pointer interaction ──────────────────────────────────────────────────────
function onPointerDown(e) {
  if (!draft.value) return
  canvasEl.value.setPointerCapture?.(e.pointerId)
  const [sx, sy] = localXY(e)
  pointers.set(e.pointerId, { x: sx, y: sy })
  menu.value = null
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
  if (e.button === 1 || e.button === 2 || spaceDown || tool.value === 'pan') {
    gesture = { type: 'pan', sx, sy, cam0: { ...cam }, moved: false }
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
    const sel = draft.value.features.find((f) => f.id === selectedFeatureId.value)
    if (sel && geoOf(sel.kind) !== 'point') {
      const vi = hitVertex(sel.pts, wx, wy, 7 / cam.k)
      if (vi >= 0) {
        pushUndo()
        gesture = { type: 'moveVertex', id: sel.id, vi, sx, sy, moved: false }
        return
      }
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

  const { kind, glyph } = toolKind(tool.value)
  if (!kind) return
  const geo = geoOf(kind)
  if (geo === 'point') {
    placePoint(kind, glyph, wx, wy)
    return
  }
  // click-to-place polyline in progress: add a vertex (or close the shape)
  if (stroke && stroke.mode === 'click' && stroke.kind === kind) {
    const [fx, fy] = [stroke.pts[0], stroke.pts[1]]
    const closeHit =
      geo === 'area' &&
      stroke.pts.length >= 6 &&
      Math.hypot((fx - wx) * cam.k, (fy - wy) * cam.k) < 12
    if (closeHit) finishStroke()
    else stroke.pts.push(wx, wy)
    gesture = { type: 'clickVertex' }
    return
  }
  stroke = {
    kind,
    glyph,
    pts: [wx, wy],
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
  const [sx, sy] = localXY(e)
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: sx, y: sy })
  const [wx, wy] = toWorld(cam, sx, sy)

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
    if (stroke?.mode === 'click') stroke.cursor = [wx, wy]
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
      g.moved = true
      const i = draft.value.features.findIndex((f) => f.id === g.id)
      if (i === -1) return
      const pts = draft.value.features[i].pts.slice()
      pts[g.vi * 2] = Math.round(wx * 10) / 10
      pts[g.vi * 2 + 1] = Math.round(wy * 10) / 10
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
    case 'draw': {
      const s = stroke
      if (!s) return
      if (s.mode === 'pending') {
        if (Math.hypot(sx - s.sx0, sy - s.sy0) < 5) return
        s.mode = 'free'
        strokeMode.value = 'free'
      }
      if (s.mode === 'free' && Math.hypot(sx - s.lsx, sy - s.lsy) >= 3) {
        s.pts.push(wx, wy)
        s.lsx = sx
        s.lsy = sy
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
      } else if (g.type !== 'moveFeature') undoStack.pop()
      break
    case 'draw':
      if (!stroke) break
      if (stroke.mode === 'pending') {
        stroke.mode = 'click'
        strokeMode.value = 'click'
        stroke.cursor = stroke.pts.slice(0, 2)
      } else if (stroke.mode === 'free') finishStroke()
      break
    case 'erase':
      if (!g.erased) undoStack.pop()
      else scheduleSave()
      break
  }
}

function onPointerLeave() {
  if (!gesture) {
    hoverFeatureId.value = null
    hoverTokenId.value = null
    hoverCard.value = null
  }
}

function updateHover(sx, sy, wx, wy) {
  const tid = hitToken(sx, sy)
  let fid = null
  if (!tid && (tool.value === 'select' || tool.value === 'erase'))
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
    const when = f.from != null || f.to != null ? ` · ${f.from ?? '…'}–${f.to ?? '…'}` : ''
    const kindLabel =
      f.kind === 'place' || f.kind === 'event'
        ? t('map.tools.' + f.kind + '_' + (f.icon || (f.kind === 'place' ? 'town' : 'star')))
        : t('map.kinds.' + f.kind)
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
  burst(c[0], c[1], '#ef5350')
  if (selectedFeatureId.value === fid) selectedFeatureId.value = null
  gesture.erased++
  bump()
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
  if (!s) return
  const geo = geoOf(s.kind)
  let pts = s.mode === 'free' ? simplify(s.pts, 1.4 / cam.k) : s.pts.slice()
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
}

function onWheel(e) {
  if (!draft.value) return
  const [sx, sy] = localXY(e)
  flight = null
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
  if (tool.value !== 'select') return
  const tid = hitToken(sx, sy)
  if (tid) {
    const tk = tokenBase.value.find((x) => x.id === tid)
    if (tk) store.selectPerson(tk.personId)
    return
  }
  const [wx, wy] = toWorld(cam, sx, sy)
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
  if (tool.value === 'erase') return 'crosshair'
  if (tool.value === 'select')
    return hoverTokenId.value || hoverFeatureId.value ? 'pointer' : 'default'
  return 'crosshair'
})

// ── hints ────────────────────────────────────────────────────────────────────
const hintIcon = computed(() => TOOL_BY_ID.get(tool.value)?.icon || 'mouse-pointer-2')
const hintText = computed(() => {
  const tl = tool.value
  if (strokeMode.value === 'click') return t('map.hint.clickMode')
  if (tl === 'select') {
    if (selToken.value) return t('map.hint.token', { name: selToken.value.name, y: yearInt.value })
    return t('map.hint.select')
  }
  if (tl === 'pan' || tl === 'erase') return t('map.hint.' + tl)
  const { kind } = toolKind(tl)
  const name = t('map.tools.' + tl.replace(':', '_'))
  const geo = geoOf(kind)
  return t('map.hint.' + geo, { name })
})

// remember hotkey-picked tools as their group's face; leaving a draw tool
// abandons any half-drawn stroke
watch(tool, (tl) => {
  toolbarRef.value?.remember(tl)
  if (stroke && toolKind(tl).kind !== stroke.kind) cancelStroke()
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
    if (key === 'd' && selectedFeatureId.value) {
      e.preventDefault()
      e.stopPropagation()
      duplicateSelected()
    }
    return
  }
  if (e.altKey) return
  if (e.key === ' ') {
    spaceDown = true
    e.preventDefault()
    return
  }
  if (e.key === 'Escape') {
    if (stroke) cancelStroke()
    else if (menu.value) menu.value = null
    else if (selectedFeatureId.value || selectedTokenId.value) clearSelection()
    else tool.value = 'select'
    return
  }
  if (e.key === 'Enter' && stroke?.mode === 'click') {
    finishStroke()
    return
  }
  if (e.key === 'Backspace' || e.key === 'Delete') {
    if (stroke?.mode === 'click') {
      if (stroke.pts.length > 2) stroke.pts.splice(-2, 2)
      else cancelStroke()
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
async function exportPng() {
  const d = draft.value
  if (!d) return
  await flushSave()
  // painted styles need their sprites + calligraphy fonts before the still
  if (style.value.painting || style.value.calligraphy) await loadInkMapAssets()
  const scale = Math.min(2, 4096 / Math.max(d.width, d.height))
  const c = document.createElement('canvas')
  const r = new MapRenderer(c)
  r.resize(Math.round(d.width * scale), Math.round(d.height * scale), 1)
  const tokens = tokenBase.value.map((tk) => ({
    ...tk,
    life: lifeAlpha(tk.birth, tk.death, displayYear),
    dead: tk.death != null && displayYear > tk.death + 0.5
  }))
  r.render({
    doc: d,
    version: -1,
    style: style.value,
    cam: { x: 0, y: 0, k: scale },
    year: displayYear,
    time: 0,
    theme: mapTheme(),
    tokens,
    tagColors: new Map(store.tags.filter((tg) => tg.color).map((tg) => [tg.id, tg.color])),
    selectedFeatureId: null,
    selectedTokenId: null,
    hoverFeatureId: null,
    hoverTokenId: null,
    preview: null,
    showTrails: showTrails.value,
    showLabels: showLabels.value,
    bursts: [],
    exporting: true
  })
  c.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(d.name || 'map').replace(/[\\/:*?"<>|]+/g, '_')} ${Math.round(year.value)}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    r.dispose()
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
  if (cx != null) cam = centerOn(cx, cy, cam.k, w, h)
  else fitView(false)
}

function start() {
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
  renderer = new MapRenderer(canvasEl.value)
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
.mv-zoom button:hover {
  background: var(--hover);
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
