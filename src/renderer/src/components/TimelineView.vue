<template>
  <div class="timeline-view">
    <!-- Toolbar -->
    <div class="tl-toolbar">
      <div class="tl-heading">
        <span class="tl-title">Timeline</span>
        <span class="tl-count">{{ placedCount }}</span>
        <span
          v-if="undatedCount"
          class="tl-undated"
          :title="'People without a birth year cannot be placed on the timeline. Add a birth year in their profile to include them.'"
          >{{ undatedCount }} undated</span
        >
      </div>

      <span class="tl-hint"
        >Drag to pan · Scroll to zoom · Ctrl: time only · Shift: width only</span
      >
    </div>

    <!-- Stage: three stacked canvases (grid · WebGL world · gutter/labels) -->
    <div
      ref="stageEl"
      class="tl-stage"
      :class="{ dragging: panning, hoverable: !!hoverId || !!hoverBadge }"
      @pointerdown="onPointerDown"
      @wheel.prevent="onWheel"
      @pointermove="onStageMove"
      @pointerleave="onStageLeave"
      @click="onStageClick"
    >
      <canvas ref="bgEl" class="tl-canvas"></canvas>
      <canvas ref="glEl" class="tl-canvas"></canvas>
      <canvas ref="fgEl" class="tl-canvas"></canvas>

      <!-- Empty state -->
      <div v-if="!placedCount" class="tl-empty">
        <div class="tl-empty-icon">📅</div>
        <div class="tl-empty-title">
          {{ store.persons.length ? 'No datable people' : 'No people yet' }}
        </div>
        <div class="tl-empty-text">
          {{
            store.persons.length
              ? 'Add birth years to your family members to see their lives unfold on the timeline.'
              : 'Add family members from the tree view to see them here.'
          }}
        </div>
      </div>

      <!-- Floating search (matches the tree view) -->
      <div v-if="placedCount" class="tl-search" @pointerdown.stop @click.stop @wheel.stop>
        <span class="tl-search-icon">🔍</span>
        <input v-model="searchQuery" placeholder="Search family members…" />
        <button v-if="searchQuery" class="tl-search-clear" @click="searchQuery = ''">✕</button>
      </div>

      <!-- Zoom controls (matches the tree view's control bar) -->
      <div v-if="placedCount" class="tl-controls" @pointerdown.stop @click.stop>
        <button class="tl-ctrl-btn" title="Zoom in" @click="zoomBy(1.3333)">＋</button>
        <button class="tl-ctrl-btn" title="Zoom out" @click="zoomBy(0.75)">－</button>
        <div class="tl-ctrl-sep"></div>
        <button class="tl-ctrl-btn" title="Fit all" @click="fitAll(true)">⊡</button>
        <button
          class="tl-ctrl-btn tl-ctrl-refresh"
          :class="{ 'tl-ctrl-refreshing': refreshSpinning }"
          title="Refresh layout — re-run the family tree algorithm"
          @click="refreshLayout"
        >
          <span class="tl-refresh-icon">⟳</span>
        </button>
        <div class="tl-ctrl-sep"></div>
        <span class="tl-zoom-label">{{ zoomLabel }}</span>
      </div>

      <!-- Legend panel (matches the tree view) -->
      <div v-if="placedCount" class="tl-legend-panel" @pointerdown.stop @wheel.stop>
        <div class="tl-panel-title">Legend</div>
        <div class="tl-leg-section">
          <div class="tl-leg-label">People</div>
          <div class="tl-leg-row">
            <span class="tl-leg-dot" :style="{ background: colors.male }"></span>Male
          </div>
          <div class="tl-leg-row">
            <span class="tl-leg-dot" :style="{ background: colors.female }"></span>Female
          </div>
        </div>
        <div class="tl-leg-section">
          <div class="tl-leg-label">Lines</div>
          <div class="tl-leg-row">
            <span class="tl-leg-line" :style="{ background: colors.spouse }"></span>Marriage
          </div>
          <div class="tl-leg-row">
            <span class="tl-leg-line tl-leg-dashed" :style="{ borderColor: colors.spouse }"></span
            >Divorced
          </div>
          <div class="tl-leg-row">
            <span class="tl-leg-line" :style="{ background: colors.parentChild }"></span>Birth
          </div>
          <div class="tl-leg-row">
            <span
              class="tl-leg-line tl-leg-dashed"
              :style="{ borderColor: colors.parentChild }"
            ></span
            >Adopted
          </div>
        </div>
      </div>

      <!-- Marriage year edit popup -->
      <Transition name="medit">
        <div
          v-if="mEdit"
          class="tl-medit"
          :style="{ left: mEdit.px + 'px', top: mEdit.py + 'px' }"
          @pointerdown.stop
          @wheel.stop
          @click.stop
        >
          <div class="tl-medit-title">⚭ {{ mEdit.names }}</div>
          <div class="tl-medit-row">
            <input
              ref="meditInputRef"
              v-model.number="mEdit.year"
              type="number"
              class="tl-medit-input"
              placeholder="Year"
              min="1"
              max="2200"
              @keydown.enter="saveMarriageEdit"
              @keydown.escape="mEdit = null"
            />
            <select v-model="mEdit.status" class="tl-medit-select">
              <option value="active">Married</option>
              <option value="divorced">Divorced</option>
            </select>
          </div>
          <div class="tl-medit-actions">
            <button class="tl-medit-btn" @click="mEdit = null">Cancel</button>
            <button class="tl-medit-btn primary" @click="saveMarriageEdit">Save</button>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useMainStore } from '../store/index.js'
import { api } from '../api'
import {
  computeTimelineLayout,
  computeLaneOrder,
  GUTTER,
  Y_PAD
} from './timeline/timelineLayout.js'
import { TimelineRenderer } from './timeline/TimelineRenderer.js'

const store = useMainStore()

// This view stays mounted while hidden (App keeps its GL context alive to avoid a
// white flash on view switches); `active` tells us when it's actually on screen.
const props = defineProps({ active: { type: Boolean, default: true } })

// ── Zoom constants ──────────────────────────────────────────────────────────
const MIN_PX = 0.02 // min pixels per year (near-boundless zoom out)
const MAX_PX = 64 // max pixels per year (zoomed all the way in)
const BASE_PX = 8 // "100%" zoom reference
const MIN_LS = 0.05 // min horizontal lane scale
const MAX_LS = 3 // max horizontal lane scale
const KEEP = 100 // min pixels of world that must stay in view

// ── Viewport state ──────────────────────────────────────────────────────────
const stageEl = ref(null)
const bgEl = ref(null)
const glEl = ref(null)
const fgEl = ref(null)
const stageW = ref(0)
const stageH = ref(0)
const pxPerYear = ref(BASE_PX)
const laneScale = ref(1)
const tx = ref(GUTTER + 40)
const ty = ref(0)
const panning = ref(false)
const hoverId = ref(null)
const hoverBadge = ref(null)
const mEdit = ref(null)
const meditInputRef = ref(null)
const searchQuery = ref('')

let renderer = null

const searchOn = computed(() => searchQuery.value.trim().length > 0)
const searchSet = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const s = new Set()
  if (!q) return s
  store.persons.forEach((p) => {
    if (
      (p.name || '').toLowerCase().includes(q) ||
      (p.occupation || '').toLowerCase().includes(q) ||
      (p.location || '').toLowerCase().includes(q)
    )
      s.add(p.id)
  })
  return s
})

function isDimmed(id) {
  if (hoverId.value) return !relatedSet.value.has(id)
  if (searchOn.value) return !searchSet.value.has(id)
  return false
}
function connDimmed(ids) {
  if (hoverId.value) return !ids.includes(hoverId.value)
  if (searchOn.value) return !ids.some((id) => searchSet.value.has(id))
  return false
}

const fmtPct = (v) => (v >= 10 ? `${Math.round(v)}` : `${Math.max(0.1, Math.round(v * 10) / 10)}`)
const zoomLabel = computed(() => {
  const v = fmtPct((pxPerYear.value / BASE_PX) * 100)
  const h = fmtPct(laneScale.value * 100)
  return v === h ? `${v}%` : `↕${v}% ↔${h}%`
})

// ── Colors follow the graph settings so every view speaks the same language ─
const colors = computed(() => ({
  male: store.graphSettings.maleColor,
  female: store.graphSettings.femaleColor,
  unknown: store.graphSettings.unknownColor,
  spouse: store.graphSettings.spouseColor,
  parentChild: store.graphSettings.parentChildColor
}))

function genderColor(g) {
  if (g === 'male') return colors.value.male
  if (g === 'female') return colors.value.female
  return colors.value.unknown
}

// ── Layout (world units; recomputed on data changes only, never on zoom) ────
// Lane order is frozen once data arrives, so day-to-day edits never shuffle the
// lanes (new people simply append on the right). The refresh button re-runs the
// family-tree layout algorithm on demand and the lanes glide into place.
const refYear = computed(() => store.currentDate?.year ?? new Date().getFullYear())
const laneOrder = ref(null)
watch(
  () => store.activeProjectId,
  () => {
    laneOrder.value = null
  }
)
watch(
  () => store.persons,
  () => {
    if (store.persons.length && !laneOrder.value)
      laneOrder.value = computeLaneOrder(store.persons, store.relationships)
  },
  { immediate: true, deep: true }
)

const refreshSpinning = ref(false)
let refreshSpinTimer = 0
function refreshLayout() {
  laneOrder.value = computeLaneOrder(store.persons, store.relationships)
  refreshSpinning.value = true
  if (refreshSpinTimer) clearTimeout(refreshSpinTimer)
  refreshSpinTimer = setTimeout(() => {
    refreshSpinning.value = false
    refreshSpinTimer = 0
  }, 700)
}

const layout = computed(() =>
  computeTimelineLayout(store.persons, store.relationships, refYear.value, laneOrder.value)
)
const placedCount = computed(() => layout.value.people.length)
const undatedCount = computed(() => layout.value.undatedCount)

// ── Hover neighbourhood ─────────────────────────────────────────────────────
const relatedSet = computed(() => {
  const s = new Set()
  if (!hoverId.value) return s
  s.add(hoverId.value)
  store.relationships.forEach((r) => {
    if (r.person_a_id === hoverId.value) s.add(r.person_b_id)
    if (r.person_b_id === hoverId.value) s.add(r.person_a_id)
  })
  return s
})

// ── Per-item visual targets consumed (and tweened) by the renderer ──────────
function personVisual(p) {
  const hovered = hoverId.value === p.id
  const lit = searchOn.value && searchSet.value.has(p.id)
  const selected = store.selectedPersonId === p.id
  return {
    opacity: isDimmed(p.id) ? 0.22 : 1,
    lineWidth: hovered || lit || selected ? 9 : 6,
    avatarScale: hovered ? 1.15 : 1,
    glow: hovered ? 0.5 : 0,
    selected,
    color: genderColor(p.gender),
    imageUrl: p.image ? api.getImageUrl(p.image) || null : null
  }
}

function marriageVisual(m) {
  const group = connDimmed(m.ids) ? 0.12 : 1
  const lit = hoverId.value && m.ids.includes(hoverId.value)
  const base = m.estimated ? 0.35 : m.divorced ? 0.5 : 0.8
  const dash = m.estimated ? [2, 5] : m.divorced ? [6, 5] : [0, 0]
  return {
    lineOpacity: (lit ? 1 : base) * group,
    width: lit ? 2.5 : 2.4,
    dashLen: dash[0],
    dashGap: dash[1],
    dotOpacity: (m.estimated ? 0.4 : 1) * group,
    badgeOpacity: group,
    color: colors.value.spouse
  }
}

function birthVisual(b) {
  const group = connDimmed(b.ids) ? 0.08 : 1
  const lit = hoverId.value && b.ids.includes(hoverId.value)
  return {
    lineOpacity: (lit ? 0.95 : 0.55) * group,
    width: lit ? 2.2 : 1.8,
    dashLen: b.adopted ? 4 : 0,
    dashGap: b.adopted ? 4 : 0,
    dotOpacity: 0.8 * group,
    color: colors.value.parentChild
  }
}

// ── Pan / zoom mechanics ────────────────────────────────────────────────────
let startX = 0,
  startY = 0,
  startTx = 0,
  startTy = 0,
  moved = false,
  suppressClick = false

function syncCamera() {
  renderer?.setCamera({ px: pxPerYear.value, ls: laneScale.value, tx: tx.value, ty: ty.value })
}

function clampVals(px, ls, x, y) {
  // Free pan/zoom, tree-view style: zooming out just reveals more of the
  // year grid around a shrinking timeline. Only stop the world from being
  // pushed entirely off-screen.
  const wW = layout.value.worldWBase * ls
  const wH = layout.value.yearSpan * px + Y_PAD * 2
  const cx = Math.min(stageW.value - KEEP, Math.max(GUTTER + KEEP - wW, x))
  const cy = Math.min(stageH.value - KEEP, Math.max(KEEP - wH, y))
  return { x: cx, y: cy }
}

function clampPan() {
  const c = clampVals(pxPerYear.value, laneScale.value, tx.value, ty.value)
  tx.value = c.x
  ty.value = c.y
}

// Stage handlers bail when the stage ref is gone: during the view-switch leave
// transition the DOM (and its listeners) outlives the component.
function onPointerDown(e) {
  if (e.button !== 0 || !stageEl.value) return
  panning.value = true
  moved = false
  cancelTween()
  startX = e.clientX
  startY = e.clientY
  startTx = tx.value
  startTy = ty.value
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}
function onPointerMove(e) {
  const dx = e.clientX - startX,
    dy = e.clientY - startY
  if (!moved && Math.hypot(dx, dy) > 4) moved = true
  if (!moved) return
  tx.value = startTx + dx
  ty.value = startTy + dy
  clampPan()
  syncCamera()
}
function onPointerUp() {
  panning.value = false
  suppressClick = moved
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

// Scroll = zoom (map-app style; panning is drag-only):
//   plain scroll → uniform zoom, Ctrl → vertical (time) only, Shift → horizontal (lanes) only
function onWheel(e) {
  if (!stageEl.value) return
  cancelTween()
  const rect = stageEl.value.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  // Shift+wheel reports its delta on deltaX in Chromium
  const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX
  const factor = Math.exp(-delta * 0.0022)

  const vertical = !e.shiftKey
  const horizontal = !e.ctrlKey && !e.metaKey

  const oldPx = pxPerYear.value,
    oldLs = laneScale.value
  const newPx = vertical ? Math.min(MAX_PX, Math.max(MIN_PX, oldPx * factor)) : oldPx
  const newLs = horizontal ? Math.min(MAX_LS, Math.max(MIN_LS, oldLs * factor)) : oldLs
  // Keep the point under the cursor fixed on each zoomed axis
  if (vertical) ty.value = anchorTy(my, ty.value, newPx / oldPx)
  if (horizontal) tx.value = mx - (mx - tx.value) * (newLs / oldLs)
  pxPerYear.value = newPx
  laneScale.value = newLs
  clampPan()
  syncCamera()
}

// New ty that keeps screen point `my` over the same year after scaling by k.
// World y = (year − minYear) · px + Y_PAD, and Y_PAD doesn't scale — naive
// proportional scaling drifts by Y_PAD·(k−1) per step.
function anchorTy(my, oldTy, k) {
  return my - ((my - oldTy - Y_PAD) * k + Y_PAD)
}

// ── Hover / click hit-testing against the renderer ──────────────────────────
function stagePoint(e) {
  const rect = stageEl.value.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function onStageMove(e) {
  if (!stageEl.value || !renderer) return
  const p = stagePoint(e)
  renderer?.setMouseY(panning.value ? null : p.y)
  if (panning.value) return
  const badge = renderer?.badgeAt(p.x, p.y) || null
  hoverBadge.value = badge ? badge.id : null
  renderer?.setHoverBadge(hoverBadge.value)
  const person = badge ? null : renderer?.personAt(p.x, p.y)
  const id = person ? person.id : null
  if (id !== hoverId.value) {
    hoverId.value = id
    renderer?.markStylesDirty()
  }
}

function onStageLeave() {
  renderer?.setMouseY(null)
  if (hoverId.value) {
    hoverId.value = null
    renderer?.markStylesDirty()
  }
  hoverBadge.value = null
  renderer?.setHoverBadge(null)
}

function onStageClick(e) {
  if (suppressClick) {
    suppressClick = false
    return
  }
  if (!stageEl.value || !renderer) return
  const p = stagePoint(e)
  const badge = renderer?.badgeAt(p.x, p.y)
  if (badge) {
    openMarriageEdit(badge.m, e)
    return
  }
  const person = renderer?.personAt(p.x, p.y)
  if (person) {
    mEdit.value = null
    store.selectPerson(person.id)
    return
  }
  mEdit.value = null
}

// ── Smooth tween for zoom buttons / fit ─────────────────────────────────────
let tweenRaf = 0
function cancelTween() {
  if (tweenRaf) {
    cancelAnimationFrame(tweenRaf)
    tweenRaf = 0
  }
}

function tweenTo(targetPx, targetLs, targetTx, targetTy, ms = 320) {
  cancelTween()
  const c = clampVals(targetPx, targetLs, targetTx, targetTy)
  const s = { px: pxPerYear.value, ls: laneScale.value, tx: tx.value, ty: ty.value }
  const d = { px: targetPx, ls: targetLs, tx: c.x, ty: c.y }
  const t0 = performance.now()
  const ease = (t) => 1 - Math.pow(1 - t, 3)
  const step = (now) => {
    const t = Math.min(1, (now - t0) / ms)
    const k = ease(t)
    pxPerYear.value = s.px + (d.px - s.px) * k
    laneScale.value = s.ls + (d.ls - s.ls) * k
    tx.value = s.tx + (d.tx - s.tx) * k
    ty.value = s.ty + (d.ty - s.ty) * k
    syncCamera()
    tweenRaf = t < 1 ? requestAnimationFrame(step) : 0
  }
  tweenRaf = requestAnimationFrame(step)
}

function zoomBy(factor) {
  const cx = stageW.value / 2
  const cy = stageH.value / 2
  const oldPx = pxPerYear.value,
    oldLs = laneScale.value
  const newPx = Math.min(MAX_PX, Math.max(MIN_PX, oldPx * factor))
  const newLs = Math.min(MAX_LS, Math.max(MIN_LS, oldLs * factor))
  const newTy = anchorTy(cy, ty.value, newPx / oldPx)
  const newTx = cx - (cx - tx.value) * (newLs / oldLs)
  tweenTo(newPx, newLs, newTx, newTy)
}

function fitAll(animate = false) {
  if (!stageH.value) return
  const L = layout.value
  const px = Math.min(MAX_PX, Math.max(MIN_PX, (stageH.value - 160) / L.yearSpan))
  const ls = Math.min(1, Math.max(MIN_LS, (stageW.value - GUTTER - 100) / L.worldWBase))
  // The clamp no longer auto-centers, so center explicitly
  const txT = GUTTER + Math.max(20, (stageW.value - GUTTER - L.worldWBase * ls) / 2)
  const tyT = Math.max(40, (stageH.value - (L.yearSpan * px + Y_PAD * 2)) / 2)
  if (animate) {
    tweenTo(px, ls, txT, tyT)
  } else {
    pxPerYear.value = px
    laneScale.value = ls
    tx.value = txT
    ty.value = tyT
    clampPan()
    syncCamera()
  }
}

// ── Marriage year editing ───────────────────────────────────────────────────
function trunc(s, n) {
  s = s || 'Unnamed'
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function openMarriageEdit(m, e) {
  const p = stagePoint(e)
  mEdit.value = {
    relId: m.id,
    names: trunc(m.names, 34),
    year: m.realYear,
    status: m.status,
    px: Math.min(Math.max(8, p.x - 110), stageW.value - 230),
    py: Math.min(Math.max(8, p.y + 14), stageH.value - 140)
  }
  nextTick(() => meditInputRef.value?.focus())
}

async function saveMarriageEdit() {
  if (!mEdit.value) return
  const year = mEdit.value.year
  await store.updateRelationship({
    id: mEdit.value.relId,
    formed_date: year && year > 0 ? year : null,
    status: mEdit.value.status
  })
  mEdit.value = null
}

// ── Lifecycle ───────────────────────────────────────────────────────────────
let ro = null
let hasFitted = false
onMounted(() => {
  const measure = () => {
    stageW.value = stageEl.value?.clientWidth || 0
    stageH.value = stageEl.value?.clientHeight || 0
    renderer?.resize(stageW.value, stageH.value)
  }
  renderer = new TimelineRenderer({
    bgCanvas: bgEl.value,
    glCanvas: glEl.value,
    fgCanvas: fgEl.value,
    hooks: {
      personVisual,
      marriageVisual,
      birthVisual,
      getRefYear: () => refYear.value
    }
  })
  renderer.setTheme(store.theme === 'light')
  renderer.setData(layout.value)
  measure()
  nextTick(() => {
    measure()
    if (props.active && stageW.value) {
      fitAll(false)
      hasFitted = true
    }
  })
  // Ignore size reports while hidden (display:none reports 0×0, which would
  // corrupt the pan/zoom state); re-measure only when actually laid out.
  ro = new ResizeObserver(() => {
    if (!stageEl.value?.clientWidth) return
    measure()
    clampPan()
    syncCamera()
  })
  if (stageEl.value) ro.observe(stageEl.value)

  // Coming back into view: fit once (first reveal), otherwise keep the user's
  // pan/zoom and just re-sync to the current stage size.
  watch(
    () => props.active,
    (on) => {
      if (!on) return
      nextTick(() => {
        measure()
        if (!stageW.value) return
        if (!hasFitted) {
          fitAll(false)
          hasFitted = true
        } else {
          clampPan()
          syncCamera()
        }
      })
    }
  )
})

watch(layout, (L) => {
  if (!renderer) return
  if (hoverId.value && !L.people.some((p) => p.id === hoverId.value)) hoverId.value = null
  renderer.setData(L)
  nextTick(() => {
    clampPan()
    syncCamera()
  })
})
watch([hoverId, searchSet, () => store.selectedPersonId, colors], () => renderer?.markStylesDirty())
watch(
  () => store.theme,
  () => renderer?.setTheme(store.theme === 'light')
)

onBeforeUnmount(() => {
  if (ro) ro.disconnect()
  cancelTween()
  if (refreshSpinTimer) clearTimeout(refreshSpinTimer)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  renderer?.dispose()
  renderer = null
})
</script>

<style scoped>
.timeline-view {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background:
    radial-gradient(1200px 600px at 20% -10%, rgba(139, 108, 197, 0.08), transparent 60%), var(--bg);
  min-height: 0;
}

/* ── Toolbar (matches PeopleView) ────────────────────────── */
.tl-toolbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 22px;
  border-bottom: 1px solid var(--border);
  background: var(--glass-soft);
  backdrop-filter: blur(10px);
  flex-wrap: wrap;
  z-index: 2;
}
.tl-heading {
  display: flex;
  align-items: center;
  gap: 10px;
}
.tl-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: var(--t1);
}
.tl-count {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  background: var(--adim);
  padding: 2px 9px;
  border-radius: 20px;
}
.tl-undated {
  font-size: 11px;
  font-weight: 600;
  color: #f5a623;
  background: rgba(245, 166, 35, 0.12);
  padding: 2px 9px;
  border-radius: 20px;
  cursor: help;
}

.tl-hint {
  font-size: 11px;
  color: var(--t3);
  font-weight: 500;
}

/* ── Stage ───────────────────────────────────────────────── */
.tl-stage {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
}
.tl-stage.dragging {
  cursor: grabbing;
}
.tl-stage.hoverable:not(.dragging) {
  cursor: pointer;
}
.tl-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

/* ── Floating search (tree-view style) ───────────────────── */
.tl-search {
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
    border-color 0.15s,
    box-shadow 0.15s;
  cursor: default;
}
.tl-search:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(108, 142, 245, 0.15);
}
.tl-search-icon {
  font-size: 13px;
  flex-shrink: 0;
}
.tl-search input {
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
.tl-search input::placeholder {
  color: var(--t3);
}
.tl-search-clear {
  border: none;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  font-size: 11px;
  padding: 2px;
  border-radius: 4px;
  transition: color 0.12s;
}
.tl-search-clear:hover {
  color: var(--t1);
}

/* ── Zoom controls (tree-view control bar style) ─────────── */
.tl-controls {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 5px;
  border-radius: 12px;
  box-shadow: var(--shadow);
  cursor: default;
}
.tl-ctrl-btn {
  border: none;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 15px;
  width: 30px;
  height: 30px;
  border-radius: 7px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.12s,
    color 0.12s;
}
.tl-ctrl-btn:hover {
  background: var(--hover);
  color: var(--t1);
}
.tl-zoom-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--t3);
  min-width: 42px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  padding: 0 6px;
}
.tl-ctrl-sep {
  width: 1px;
  align-self: stretch;
  background: var(--border);
  margin: 3px 2px;
}
.tl-ctrl-refresh .tl-refresh-icon {
  display: inline-block;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.tl-ctrl-refresh:hover .tl-refresh-icon {
  transform: rotate(45deg);
}
.tl-ctrl-refreshing .tl-refresh-icon {
  animation: tl-refresh-spin 0.65s cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes tl-refresh-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* ── Legend panel (tree-view style) ──────────────────────── */
.tl-legend-panel {
  position: absolute;
  bottom: 18px;
  right: 16px;
  z-index: 5;
  background: var(--glass-soft);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 11px;
  color: var(--t2);
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 140px;
  cursor: default;
}
.tl-panel-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--t3);
}
.tl-leg-section {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.tl-leg-label {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--t3);
  opacity: 0.7;
}
.tl-leg-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}
.tl-leg-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.tl-leg-line {
  width: 22px;
  height: 2px;
  flex-shrink: 0;
  border-radius: 1px;
}
.tl-leg-dashed {
  height: 0;
  border-top: 2px dashed;
  background: none !important;
}

/* ── Marriage edit popup ─────────────────────────────────── */
.tl-medit {
  position: absolute;
  z-index: 6;
  width: 220px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  cursor: default;
}
.tl-medit-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--t1);
  margin-bottom: 9px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tl-medit-row {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}
.tl-medit-input {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.tl-medit-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(108, 142, 245, 0.15);
}
.tl-medit-select {
  flex: 1;
  min-width: 0;
  padding: 6px 6px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  outline: none;
  cursor: pointer;
}
.tl-medit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
.tl-medit-btn {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 11.5px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.13s;
}
.tl-medit-btn:hover {
  background: var(--hover);
  color: var(--t1);
}
.tl-medit-btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.tl-medit-btn.primary:hover {
  filter: brightness(1.1);
}

.medit-enter-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.medit-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}
.medit-enter-from,
.medit-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.96);
}

/* ── Empty state ─────────────────────────────────────────── */
.tl-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
  color: var(--t2);
  pointer-events: none;
}
.tl-empty-icon {
  font-size: 44px;
  opacity: 0.6;
}
.tl-empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--t1);
}
.tl-empty-text {
  font-size: 13px;
  max-width: 300px;
}
</style>
