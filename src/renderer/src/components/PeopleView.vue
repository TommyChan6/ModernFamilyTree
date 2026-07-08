<template>
  <div class="people-view">
    <!-- Toolbar -->
    <div class="pv-toolbar">
      <div class="pv-heading">
        <span class="pv-title">All People</span>
        <span class="pv-count">{{ displayed.length }}</span>
      </div>

      <div class="pv-controls">
        <div class="pv-search">
          <span class="pv-search-icon">🔍</span>
          <input
            v-model="query"
            class="pv-search-input"
            placeholder="Search people…"
          />
          <button v-if="query" class="pv-search-clear" @click="query = ''" title="Clear">✕</button>
        </div>

        <div class="pv-sort">
          <div class="pv-sort-track">
            <div class="pv-sort-thumb" :style="{ transform: `translateX(${sortIndex * 100}%)` }"></div>
          </div>
          <button
            v-for="opt in sortOptions"
            :key="opt.id"
            class="pv-sort-opt"
            :class="{ active: sortBy === opt.id }"
            @click="sortBy = opt.id"
          >{{ opt.label }}</button>
        </div>
      </div>
    </div>

    <!-- Pannable stage -->
    <div
      ref="stageEl"
      class="pv-stage"
      :class="{ dragging: panning }"
      @pointerdown="onPointerDown"
      @wheel.prevent="onWheel"
    >
      <div v-if="displayed.length === 0" class="pv-empty">
        <div class="pv-empty-icon">{{ store.persons.length ? '🔍' : '👥' }}</div>
        <div class="pv-empty-title">
          {{ store.persons.length ? 'No matches' : 'No people yet' }}
        </div>
        <div class="pv-empty-text">
          {{ store.persons.length
            ? 'Try a different search term.'
            : 'Add family members from the tree view to see them here.' }}
        </div>
      </div>

      <TransitionGroup
        v-else
        ref="canvasEl"
        name="pcard"
        tag="div"
        class="pv-canvas"
        :class="{ smooth }"
        :style="{ transform: `translate3d(${tx}px, ${ty}px, 0)`, '--cols': cols }"
        appear
      >
        <button
          v-for="(person, idx) in displayed"
          :key="person.id"
          v-memo="[person, store.selectedPersonId === person.id, stats(person.id).kin, stats(person.id).children, ageOf(person)]"
          class="pcard"
          :class="[`g-${person.gender || 'other'}`, { selected: store.selectedPersonId === person.id }]"
          :style="{ '--i': idx }"
          @click="onCardClick(person.id)"
        >
          <div class="pcard-sheen"></div>

          <!-- Banner -->
          <div class="pcard-banner">
            <span class="pcard-type">{{ genderLabel(person.gender) }}</span>
            <span v-if="ageOf(person) !== null" class="pcard-hp">
              {{ ageOf(person) }}<small>{{ isDeceased(person) ? 'yr†' : 'yr' }}</small>
            </span>
          </div>

          <div class="pcard-avatar-wrap">
            <div class="pcard-avatar">
              <img
                v-if="person.primary_image && imageUrl(person.primary_image)"
                class="pcard-avatar-img"
                :src="imageUrl(person.primary_image)"
                alt=""
                draggable="false"
              />
              <svg v-else class="pcard-avatar-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path :d="PERSON_ICON_PATH" transform="translate(-5.28 -2.16) scale(1.44)" />
              </svg>
            </div>
          </div>

          <!-- Body -->
          <div class="pcard-body">
            <div class="pcard-name" :title="person.name">{{ person.name }}</div>
            <div class="pcard-life">
              <template v-if="person.birth_year || person.death_year">
                {{ person.birth_year || '?' }}<span v-if="person.death_year"> – {{ person.death_year }}</span>
              </template>
              <span v-else class="pcard-dim">Dates unknown</span>
            </div>

            <div class="pcard-tags">
              <span v-if="person.occupation" class="pcard-tag">💼 {{ person.occupation }}</span>
              <span v-if="person.location" class="pcard-tag">📍 {{ person.location }}</span>
            </div>
          </div>

          <!-- Stats -->
          <div class="pcard-stats">
            <div class="pcard-stat">
              <span class="pcard-stat-val">{{ stats(person.id).kin }}</span>
              <span class="pcard-stat-key">Relations</span>
            </div>
            <div class="pcard-stat">
              <span class="pcard-stat-val">{{ stats(person.id).children }}</span>
              <span class="pcard-stat-key">Children</span>
            </div>
            <div class="pcard-stat">
              <span class="pcard-stat-val" style="text-transform: capitalize;">{{ person.gender || '—' }}</span>
              <span class="pcard-stat-key">Gender</span>
            </div>
          </div>
        </button>
      </TransitionGroup>

      <!-- Floating hint + recenter -->
      <button
        v-if="displayed.length"
        class="pv-recenter"
        @click.stop="centerCanvas(true)"
        title="Recenter"
      >⊕ Recenter</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useMainStore } from '../store/index.js'
import { api } from '../api.js'

const store = useMainStore()

const PERSON_ICON_PATH = 'M12 12.5c2.49 0 4.5-2.01 4.5-4.5S14.49 3.5 12 3.5 7.5 5.51 7.5 8s2.01 4.5 4.5 4.5zm0 2.25c-3 0-9 1.51-9 4.5V22h18v-2.75c0-2.99-6-4.5-9-4.5z'

const query = ref('')
const sortBy = ref('name')
const sortOptions = [
  { id: 'name', label: 'A–Z' },
  { id: 'birth', label: 'Year' },
  { id: 'age', label: 'Age' },
]
const sortIndex = computed(() => Math.max(0, sortOptions.findIndex(o => o.id === sortBy.value)))

function imageUrl(filename) {
  return api.getImageUrl(filename) || ''
}
function genderLabel(g) {
  if (g === 'male') return '♂ Male'
  if (g === 'female') return '♀ Female'
  return '● Person'
}
function isDeceased(p) {
  const refY = store.currentDate?.year ?? new Date().getFullYear()
  return !!p.death_year && p.death_year <= refY
}
function ageOf(p) {
  if (!p.birth_year) return null
  const refYear = store.currentDate?.year ?? new Date().getFullYear()
  const endYear = p.death_year ? Math.min(p.death_year, refYear) : refYear
  const age = endYear - p.birth_year
  return age >= 0 ? age : null
}

const statsMap = computed(() => {
  const m = {}
  store.persons.forEach(p => { m[p.id] = { kin: 0, children: 0 } })
  store.relationships.forEach(r => {
    if (m[r.person_a_id]) {
      m[r.person_a_id].kin++
      if (r.type === 'parent_child' || r.type === 'adopted') m[r.person_a_id].children++
    }
    if (m[r.person_b_id]) m[r.person_b_id].kin++
  })
  return m
})
function stats(id) { return statsMap.value[id] || { kin: 0, children: 0 } }

const displayed = computed(() => {
  const q = query.value.trim().toLowerCase()
  let list = store.persons
  if (q) {
    list = list.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.occupation || '').toLowerCase().includes(q) ||
      (p.location || '').toLowerCase().includes(q)
    )
  }
  const arr = [...list]
  if (sortBy.value === 'name') {
    arr.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
  } else if (sortBy.value === 'birth') {
    arr.sort((a, b) => (a.birth_year || Infinity) - (b.birth_year || Infinity) || (a.name || '').localeCompare(b.name || ''))
  } else if (sortBy.value === 'age') {
    arr.sort((a, b) => (ageOf(b) ?? -1) - (ageOf(a) ?? -1) || (a.name || '').localeCompare(b.name || ''))
  }
  return arr
})

// Column count — makes the block roughly square so it overflows in 2D and feels like a canvas
const cols = computed(() => {
  const n = displayed.value.length
  if (n <= 1) return 1
  return Math.min(6, Math.max(3, Math.round(Math.sqrt(n))))
})

// ── Pan / drag navigation ───────────────────────────────────────────────────
const stageEl = ref(null)
const canvasEl = ref(null)
const tx = ref(0)
const ty = ref(0)
const panning = ref(false)
const smooth = ref(false)

let startX = 0, startY = 0, startTx = 0, startTy = 0, moved = false, suppressClick = false
let smoothTimer = null
const PAD = 60

function animatePan() {
  smooth.value = true
  if (smoothTimer) clearTimeout(smoothTimer)
  smoothTimer = setTimeout(() => { smooth.value = false }, 440)
}

// rAF-throttled pan writes: pointermove/wheel can fire far faster than the
// display refreshes — coalesce them so we update at most once per frame.
let rafId = 0
let pendingX = 0, pendingY = 0, hasPending = false

function setPan(x, y) {
  pendingX = x; pendingY = y; hasPending = true
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    if (!hasPending) return
    hasPending = false
    tx.value = pendingX
    ty.value = pendingY
    clampPan()
  })
}
// Current pan target, accounting for a not-yet-flushed frame
function panX() { return hasPending ? pendingX : tx.value }
function panY() { return hasPending ? pendingY : ty.value }

function canvasSize() {
  const el = canvasEl.value?.$el || canvasEl.value
  return { w: el?.offsetWidth || 0, h: el?.offsetHeight || 0 }
}
function stageSize() {
  const el = stageEl.value
  return { w: el?.clientWidth || 0, h: el?.clientHeight || 0 }
}

function clampPan() {
  const { w: cw, h: ch } = canvasSize()
  const { w: sw, h: sh } = stageSize()
  if (cw <= sw) tx.value = (sw - cw) / 2
  else tx.value = Math.min(PAD, Math.max(sw - cw - PAD, tx.value))
  if (ch <= sh) ty.value = (sh - ch) / 2
  else ty.value = Math.min(PAD, Math.max(sh - ch - PAD, ty.value))
}

function centerCanvas(animate = false) {
  const { w: cw, h: ch } = canvasSize()
  const { w: sw, h: sh } = stageSize()
  hasPending = false // drop any queued drag/wheel frame
  if (animate) animatePan()
  tx.value = (sw - cw) / 2
  ty.value = ch <= sh ? (sh - ch) / 2 : PAD
}

function onPointerDown(e) {
  if (e.button !== 0) return
  panning.value = true
  smooth.value = false
  moved = false
  startX = e.clientX; startY = e.clientY
  startTx = panX(); startTy = panY()
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}
function onPointerMove(e) {
  const dx = e.clientX - startX, dy = e.clientY - startY
  if (!moved && Math.hypot(dx, dy) > 4) moved = true
  if (!moved) return
  setPan(startTx + dx, startTy + dy)
}
function onPointerUp() {
  panning.value = false
  suppressClick = moved
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}
function onWheel(e) {
  setPan(
    panX() - (e.shiftKey ? e.deltaY : e.deltaX),
    panY() - (e.shiftKey ? 0 : e.deltaY)
  )
}
function onCardClick(id) {
  if (suppressClick) { suppressClick = false; return }
  store.selectPerson(id)
}

// Keep the pan within bounds when the set of cards or column count changes
// (don't recenter — that would yank the view on every search keystroke / sort)
watch([() => displayed.value.length, cols], () => {
  nextTick(clampPan)
})

let ro = null
onMounted(() => {
  nextTick(() => { centerCanvas(); clampPan() })
  ro = new ResizeObserver(() => clampPan())
  if (stageEl.value) ro.observe(stageEl.value)
})
onBeforeUnmount(() => {
  if (ro) ro.disconnect()
  if (smoothTimer) clearTimeout(smoothTimer)
  if (rafId) cancelAnimationFrame(rafId)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})
</script>

<style scoped>
.people-view {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background:
    radial-gradient(1200px 600px at 80% -10%, rgba(108, 142, 245, 0.08), transparent 60%),
    var(--bg);
  min-height: 0;
}

/* ── Toolbar ─────────────────────────────────────────────── */
.pv-toolbar {
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
.pv-heading { display: flex; align-items: center; gap: 10px; }
.pv-title { font-size: 18px; font-weight: 700; letter-spacing: -0.2px; color: var(--t1); }
.pv-count {
  font-size: 12px; font-weight: 700; color: var(--accent);
  background: var(--adim); padding: 2px 9px; border-radius: 20px;
}
.pv-controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

.pv-search {
  display: flex; align-items: center; gap: 7px;
  background: var(--elevated); border: 1px solid var(--border);
  border-radius: 10px; padding: 0 10px; height: 36px; min-width: 220px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.pv-search:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(108, 142, 245, 0.15); }
.pv-search-icon { font-size: 13px; opacity: 0.7; }
.pv-search-input {
  border: none; background: transparent; padding: 0; height: 100%;
  font-size: 13px; color: var(--t1); width: 100%; box-shadow: none;
}
.pv-search-input:focus { box-shadow: none; }
.pv-search-clear {
  border: none; background: transparent; color: var(--t3); cursor: pointer;
  font-size: 11px; padding: 2px; border-radius: 4px; transition: color 0.12s;
}
.pv-search-clear:hover { color: var(--t1); }

.pv-sort {
  position: relative; display: flex; background: var(--elevated);
  border: 1px solid var(--border); border-radius: 10px; padding: 3px; height: 36px;
}
.pv-sort-track { position: absolute; inset: 3px; pointer-events: none; }
.pv-sort-thumb {
  position: absolute; top: 0; left: 0; width: 33.333%; height: 100%;
  background: var(--accent); border-radius: 7px;
  box-shadow: 0 2px 8px rgba(108, 142, 245, 0.35);
  transition: transform 0.28s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.pv-sort-opt {
  position: relative; z-index: 1; border: none; background: transparent;
  color: var(--t2); font-family: var(--font); font-size: 12px; font-weight: 600;
  cursor: pointer; padding: 0 16px; border-radius: 7px; transition: color 0.2s;
}
.pv-sort-opt.active { color: #fff; }

/* ── Pannable stage ──────────────────────────────────────── */
.pv-stage {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  cursor: grab;
  background-image:
    radial-gradient(circle, var(--border) 1px, transparent 1px);
  background-size: 26px 26px;
  touch-action: none;
}
.pv-stage.dragging { cursor: grabbing; }

.pv-canvas {
  position: absolute;
  top: 0;
  left: 0;
  display: grid;
  grid-template-columns: repeat(var(--cols, 4), 196px);
  gap: 22px;
  padding: 8px;
  will-change: transform;
}
.pv-canvas.smooth {
  transition: transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
}

/* While panning, skip hover hit-testing on cards entirely — hovering hundreds
   of cards mid-drag causes constant style recalculation */
.pv-stage.dragging .pcard { pointer-events: none; }

/* ── Card ────────────────────────────────────────────────── */
.pcard {
  --accent-c: #5c6bc0;
  position: relative;
  width: 196px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 0 0 12px;
  cursor: pointer;
  overflow: hidden;
  font-family: var(--font);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
  transition:
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.28s ease,
    border-color 0.2s ease;
  /* Skip layout/paint work for cards panned out of view */
  content-visibility: auto;
  contain-intrinsic-size: 196px 330px;
}
.pcard.g-male { --accent-c: #3a7bd5; }
.pcard.g-female { --accent-c: #c95fa0; }
.pcard.g-other { --accent-c: #5c6bc0; }

.pv-stage:not(.dragging) .pcard:hover {
  transform: translateY(-8px);
  box-shadow: 0 16px 34px rgba(0, 0, 0, 0.32), 0 0 0 1px var(--accent-c);
  border-color: transparent;
}
.pcard.selected {
  border-color: var(--accent-c);
  box-shadow: 0 0 0 2px var(--accent-c), 0 12px 28px rgba(0, 0, 0, 0.3);
}

.pcard-sheen {
  position: absolute; inset: 0; z-index: 3; pointer-events: none;
  background: linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, 0.14) 48%, rgba(255, 255, 255, 0.05) 55%, transparent 70%);
  background-size: 250% 250%; background-position: 150% 150%;
  opacity: 0; transition: opacity 0.3s ease;
}
.pv-stage:not(.dragging) .pcard:hover .pcard-sheen {
  opacity: 1; animation: sheen-sweep 0.9s cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes sheen-sweep {
  from { background-position: 150% 150%; }
  to { background-position: -50% -50%; }
}

.pcard-banner {
  position: relative; height: 62px;
  width: 100%; align-self: stretch;
  background: linear-gradient(135deg, var(--accent-c), color-mix(in srgb, var(--accent-c) 55%, #1a1d2e));
  display: flex; align-items: flex-start; justify-content: space-between; padding: 8px 10px;
}
/* Soft glow behind the avatar so the overlap reads as a deliberate nest */
.pcard-banner::after {
  content: '';
  position: absolute;
  left: 50%; bottom: -14px;
  width: 96px; height: 60px;
  transform: translateX(-50%);
  background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.16), transparent 68%);
  pointer-events: none;
}
.pcard-type {
  font-size: 9.5px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase;
  color: #fff; background: rgba(0, 0, 0, 0.22); padding: 3px 8px; border-radius: 20px; backdrop-filter: blur(2px);
}
.pcard-hp { font-size: 14px; font-weight: 800; color: #fff; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); line-height: 1; }
.pcard-hp small { font-size: 8.5px; font-weight: 700; opacity: 0.85; margin-left: 1px; }

/* z-index lifts the avatar above the banner permanently — previously the banner
   (positioned) painted over it until hover created a stacking context */
.pcard-avatar-wrap {
  display: flex; justify-content: center;
  margin-top: -34px;
  position: relative; z-index: 1;
}
.pcard-avatar {
  width: 72px; height: 72px; border-radius: 50%; overflow: hidden;
  background: linear-gradient(135deg, var(--accent-c), color-mix(in srgb, var(--accent-c) 60%, #000));
  border: 3px solid var(--surface); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.3s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.pv-stage:not(.dragging) .pcard:hover .pcard-avatar { transform: scale(1.06); }
.pcard-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.pcard-avatar-icon { width: 46px; height: 46px; fill: rgba(255, 255, 255, 0.92); }

.pcard-body { padding: 10px 14px 0; text-align: center; width: 100%; }
.pcard-name {
  font-size: 14.5px; font-weight: 700; color: var(--t1);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.2px;
}
.pcard-life { font-size: 11.5px; font-weight: 600; color: var(--t2); margin-top: 2px; }
.pcard-dim { color: var(--t3); font-weight: 500; }

.pcard-tags { display: flex; flex-direction: column; align-items: center; gap: 4px; margin-top: 9px; min-height: 4px; }
.pcard-tag {
  font-size: 10.5px; font-weight: 500; color: var(--t2); background: var(--elevated);
  border-radius: 6px; padding: 3px 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
}

.pcard-stats {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;
  width: calc(100% - 24px);
  margin: 12px 0 0; padding-top: 10px; border-top: 1px solid var(--border);
}
.pcard-stat { display: flex; flex-direction: column; align-items: center; gap: 1px; }
.pcard-stat-val { font-size: 13px; font-weight: 800; color: var(--accent-c); line-height: 1.1; }
.pcard-stat-key { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--t3); }

/* ── Recenter button ─────────────────────────────────────── */
.pv-recenter {
  position: absolute; bottom: 16px; right: 16px; z-index: 4;
  border: 1px solid var(--border); background: var(--glass-soft); backdrop-filter: blur(8px);
  color: var(--t2); font-family: var(--font); font-size: 12px; font-weight: 600;
  padding: 8px 12px; border-radius: 10px; cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25); transition: color 0.15s, background 0.15s, transform 0.15s;
}
.pv-recenter:hover { color: var(--t1); background: var(--hover); transform: translateY(-1px); }

/* ── Empty state ─────────────────────────────────────────── */
.pv-empty {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; gap: 8px; color: var(--t2); pointer-events: none;
}
.pv-empty-icon { font-size: 44px; opacity: 0.6; }
.pv-empty-title { font-size: 16px; font-weight: 700; color: var(--t1); }
.pv-empty-text { font-size: 13px; max-width: 280px; }

/* ── Card transitions (stagger + FLIP) ───────────────────── */
.pcard-enter-active {
  transition: opacity 0.45s ease, transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
  transition-delay: calc(min(var(--i, 0), 24) * 0.028s);
}
.pcard-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
  position: absolute; width: 196px; z-index: 0;
}
.pcard-enter-from { opacity: 0; transform: translateY(20px) scale(0.94); }
.pcard-leave-to { opacity: 0; transform: scale(0.92); }
.pcard-move { transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1); }
</style>
