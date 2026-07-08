<template>
  <div class="timeline-view">
    <!-- Toolbar -->
    <div class="tl-toolbar">
      <div class="tl-heading">
        <span class="tl-title">Timeline</span>
        <span class="tl-count">{{ placed.length }}</span>
        <span
          v-if="undatedCount"
          class="tl-undated"
          :title="'People without a birth year cannot be placed on the timeline. Add a birth year in their profile to include them.'"
        >{{ undatedCount }} undated</span>
      </div>

      <div class="tl-legend">
        <span class="tl-legend-item">
          <span class="tl-swatch" :style="{ background: colors.spouse }"></span>Marriage
        </span>
        <span class="tl-legend-item">
          <span class="tl-swatch tl-swatch-dashed" :style="{ color: colors.spouse }"></span>Divorced
        </span>
        <span class="tl-legend-item">
          <span class="tl-swatch" :style="{ background: colors.parentChild }"></span>Birth
        </span>
        <span class="tl-hint">Drag to pan · Scroll to zoom · Ctrl: time only · Shift: width only</span>
      </div>
    </div>

    <!-- Stage -->
    <div
      ref="stageEl"
      class="tl-stage"
      :class="{ dragging: panning }"
      @pointerdown="onPointerDown"
      @wheel.prevent="onWheel"
      @pointermove="onStageMove"
      @pointerleave="mouseY = null"
      @click="onStageClick"
    >
      <svg v-if="placed.length" class="tl-svg" :width="stageW" :height="stageH">
        <defs>
          <clipPath v-for="p in placed" :id="`tlclip-${p.id}`" :key="`c-${p.id}`">
            <circle :cx="p.x" :cy="p.y0" r="13" />
          </clipPath>
        </defs>

        <!-- Year grid (screen space) -->
        <g class="tl-grid">
          <rect
            v-for="band in bands"
            :key="`b-${band.year}`"
            class="tl-band"
            x="0"
            :y="band.y"
            :width="stageW"
            :height="band.h"
          />
          <line
            v-for="t in ticks"
            :key="`g-${t.year}`"
            class="tl-gridline"
            x1="0"
            :x2="stageW"
            :y1="t.y"
            :y2="t.y"
          />
          <line
            v-if="nowLine"
            class="tl-nowline"
            x1="0"
            :x2="stageW"
            :y1="nowLine.y"
            :y2="nowLine.y"
          />
        </g>

        <!-- World (pans with tx/ty) -->
        <g class="tl-world" :transform="`translate(${tx}, ${ty})`">
          <!-- Birth connectors -->
          <g
            v-for="b in births"
            :key="b.key"
            class="tl-birth"
            :class="{ dim: hoverId && !b.ids.includes(hoverId), lit: hoverId && b.ids.includes(hoverId) }"
          >
            <path
              class="tl-birth-line"
              :class="{ adopted: b.adopted }"
              :d="b.d"
              :stroke="colors.parentChild"
            />
            <circle class="tl-birth-dot" :cx="b.px" :cy="b.y" r="3.2" :fill="colors.parentChild" />
          </g>

          <!-- Marriage connectors -->
          <g
            v-for="m in marriages"
            :key="m.id"
            class="tl-marriage"
            :class="{
              dim: hoverId && !m.ids.includes(hoverId),
              lit: hoverId && m.ids.includes(hoverId),
              divorced: m.divorced,
              estimated: m.estimated
            }"
          >
            <path
              class="tl-marriage-line"
              :d="m.d"
              :stroke="colors.spouse"
            />
            <circle class="tl-mdot" :cx="m.x1" :cy="m.y" r="3.5" :fill="colors.spouse" />
            <circle class="tl-mdot" :cx="m.x2" :cy="m.y" r="3.5" :fill="colors.spouse" />
            <g class="tl-mbadge" @click.stop="openMarriageEdit(m, $event)">
              <rect
                :x="m.cx - m.bw / 2" :y="m.midY - 11"
                :width="m.bw" height="22" rx="11"
                :stroke="colors.spouse"
              />
              <text :x="m.cx" :y="m.midY + 4" text-anchor="middle">{{ m.badge }}</text>
            </g>
          </g>

          <!-- People lifelines -->
          <g
            v-for="(p, i) in placed"
            :key="p.id"
            class="tl-person"
            :class="{
              dim: hoverId && !relatedSet.has(p.id),
              hovered: hoverId === p.id,
              selected: store.selectedPersonId === p.id
            }"
            :style="{ '--i': i }"
            @mouseenter="hoverId = p.id"
            @mouseleave="hoverId = null"
            @click.stop="onPersonClick(p.id)"
          >
            <line class="tl-hit" :x1="p.x" :y1="p.y0 - 18" :x2="p.x" :y2="p.y1 + 12" />
            <line
              class="tl-life"
              :x1="p.x" :y1="p.y0" :x2="p.x" :y2="p.y1"
              :stroke="p.color"
            />
            <!-- End of life: cap for deceased, pulsing dot for living -->
            <line
              v-if="p.dead"
              class="tl-cap"
              :x1="p.x - 7" :x2="p.x + 7" :y1="p.y1" :y2="p.y1"
              :stroke="p.color"
            />
            <circle v-else class="tl-alive-dot" :cx="p.x" :cy="p.y1" r="4.5" :fill="p.color" />

            <!-- Avatar pin at birth -->
            <circle class="tl-avatar-ring" :cx="p.x" :cy="p.y0" r="15" :fill="p.color" />
            <image
              v-if="p.img"
              class="tl-avatar-img"
              :href="p.img"
              :x="p.x - 13" :y="p.y0 - 13"
              width="26" height="26"
              :clip-path="`url(#tlclip-${p.id})`"
              preserveAspectRatio="xMidYMid slice"
            />
            <path
              v-else
              class="tl-avatar-icon"
              :d="PERSON_ICON_PATH"
              :transform="`translate(${p.x - 9}, ${p.y0 - 9.5}) scale(0.78)`"
            />

            <text class="tl-name" :x="p.x + 21" :y="p.y0 - 1">{{ p.label }}</text>
            <text v-if="laneScale >= 0.55" class="tl-years" :x="p.x + 21" :y="p.y0 + 12">{{ p.yearsLabel }}</text>
          </g>
        </g>

        <!-- Year gutter (screen space, drawn on top) -->
        <g class="tl-gutter">
          <rect class="tl-gutter-bg" x="0" y="0" :width="GUTTER" :height="stageH" />
          <text
            v-for="t in ticks"
            :key="`l-${t.year}`"
            class="tl-tick-label"
            :x="GUTTER - 12"
            :y="t.y + 4"
            text-anchor="end"
          >{{ t.year }}</text>

          <g v-if="nowLine" class="tl-now-chip">
            <rect :x="6" :y="nowLine.y - 10" :width="GUTTER - 14" height="20" rx="7" />
            <text :x="GUTTER / 2 + 1" :y="nowLine.y + 4" text-anchor="middle">{{ refYear }}</text>
          </g>

          <g v-if="mouseGuide" class="tl-mouse-chip">
            <line class="tl-mouse-line" :x1="GUTTER" :x2="stageW" :y1="mouseGuide.y" :y2="mouseGuide.y" />
            <rect :x="6" :y="mouseGuide.y - 10" :width="GUTTER - 14" height="20" rx="7" />
            <text :x="GUTTER / 2 + 1" :y="mouseGuide.y + 4" text-anchor="middle">{{ mouseGuide.year }}</text>
          </g>
        </g>
      </svg>

      <!-- Empty state -->
      <div v-if="!placed.length" class="tl-empty">
        <div class="tl-empty-icon">📅</div>
        <div class="tl-empty-title">
          {{ store.persons.length ? 'No datable people' : 'No people yet' }}
        </div>
        <div class="tl-empty-text">
          {{ store.persons.length
            ? 'Add birth years to your family members to see their lives unfold on the timeline.'
            : 'Add family members from the tree view to see them here.' }}
        </div>
      </div>

      <!-- Floating zoom controls -->
      <div v-if="placed.length" class="tl-controls" @pointerdown.stop @click.stop>
        <button class="tl-ctrl-btn" title="Zoom out" @click="zoomBy(0.75)">−</button>
        <span class="tl-zoom-label">{{ zoomLabel }}</span>
        <button class="tl-ctrl-btn" title="Zoom in" @click="zoomBy(1.3333)">＋</button>
        <div class="tl-ctrl-sep"></div>
        <button class="tl-ctrl-btn tl-fit-btn" title="Fit everything" @click="fitAll(true)">⤢ Fit</button>
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
import { api } from '../api.js'

const store = useMainStore()

const PERSON_ICON_PATH = 'M12 12.5c2.49 0 4.5-2.01 4.5-4.5S14.49 3.5 12 3.5 7.5 5.51 7.5 8s2.01 4.5 4.5 4.5zm0 2.25c-3 0-9 1.51-9 4.5V22h18v-2.75c0-2.99-6-4.5-9-4.5z'

// ── Layout constants ────────────────────────────────────────────────────────
const GUTTER = 64        // fixed year-axis gutter width (screen px)
const LANE_W = 150       // horizontal distance between lifelines (world px)
const X0 = 110           // x of the first lane (world px)
const Y_PAD = 40         // world-space padding above the first year
const MIN_PX = 0.8       // min pixels per year (zoomed all the way out)
const MAX_PX = 64        // max pixels per year (zoomed all the way in)
const BASE_PX = 8        // "100%" zoom reference
const MIN_LS = 0.3       // min horizontal lane scale
const MAX_LS = 3         // max horizontal lane scale
const CLAMP_PAD = 80

// ── Viewport state ──────────────────────────────────────────────────────────
const stageEl = ref(null)
const stageW = ref(0)
const stageH = ref(0)
const pxPerYear = ref(BASE_PX)
const laneScale = ref(1)
const tx = ref(GUTTER + 40)
const ty = ref(0)
const panning = ref(false)
const hoverId = ref(null)
const mouseY = ref(null)
const mEdit = ref(null)
const meditInputRef = ref(null)

const zoomLabel = computed(() => {
  const v = Math.round((pxPerYear.value / BASE_PX) * 100)
  const h = Math.round(laneScale.value * 100)
  return v === h ? `${v}%` : `↕${v}% ↔${h}%`
})

// ── Colors follow the graph settings so every view speaks the same language ─
const colors = computed(() => ({
  male: store.graphSettings.maleColor,
  female: store.graphSettings.femaleColor,
  unknown: store.graphSettings.unknownColor,
  spouse: store.graphSettings.spouseColor,
  parentChild: store.graphSettings.parentChildColor,
}))

function genderColor(g) {
  if (g === 'male') return colors.value.male
  if (g === 'female') return colors.value.female
  return colors.value.unknown
}

// ── Time scale ──────────────────────────────────────────────────────────────
const refYear = computed(() => store.currentDate?.year ?? new Date().getFullYear())

const datedPersons = computed(() =>
  store.persons
    .filter(p => p.birth_year)
    .sort((a, b) => a.birth_year - b.birth_year || (a.name || '').localeCompare(b.name || ''))
)
const undatedCount = computed(() => store.persons.length - datedPersons.value.length)

function lifeEnd(p) {
  return (p.death_year && p.death_year <= refYear.value) ? p.death_year : refYear.value
}

const minYear = computed(() =>
  datedPersons.value.length ? datedPersons.value[0].birth_year : refYear.value - 50
)
const maxYear = computed(() => {
  let max = minYear.value + 10
  datedPersons.value.forEach(p => { max = Math.max(max, lifeEnd(p)) })
  store.relationships.forEach(r => {
    const y = parseInt(r.formed_date)
    if (y) max = Math.max(max, y)
  })
  return max
})
const yearSpan = computed(() => Math.max(10, maxYear.value - minYear.value))

function yearToY(year) {
  return (year - minYear.value) * pxPerYear.value + Y_PAD
}

const worldWBase = computed(() => X0 + Math.max(0, datedPersons.value.length - 1) * LANE_W + 220)
const worldW = computed(() => worldWBase.value * laneScale.value)
const worldH = computed(() => yearSpan.value * pxPerYear.value + Y_PAD * 2)

// ── People layout ───────────────────────────────────────────────────────────
function trunc(s, n = 17) {
  s = s || 'Unnamed'
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

const placed = computed(() => {
  const ls = laneScale.value
  // Tighter lanes → shorter names so labels don't pile onto the next lifeline
  const nameLen = ls < 0.45 ? 6 : ls < 0.7 ? 10 : 17
  return datedPersons.value.map((p, i) => {
    const dead = !!p.death_year && p.death_year <= refYear.value
    const end = lifeEnd(p)
    const y0 = yearToY(p.birth_year)
    const y1 = Math.max(yearToY(end), y0 + 8)
    const age = Math.max(0, end - p.birth_year)
    return {
      id: p.id,
      x: (X0 + i * LANE_W) * ls,
      y0, y1, dead,
      color: genderColor(p.gender),
      img: p.primary_image ? (api.getImageUrl(p.primary_image) || null) : null,
      label: trunc(p.name, nameLen),
      yearsLabel: dead
        ? `${p.birth_year}–${p.death_year} · ${age} yr`
        : `b. ${p.birth_year} · ${age} yr`,
    }
  })
})

const placedMap = computed(() => {
  const m = new Map()
  placed.value.forEach(p => m.set(p.id, p))
  return m
})
const personById = computed(() => {
  const m = new Map()
  store.persons.forEach(p => m.set(p.id, p))
  return m
})

// ── Marriage connectors ─────────────────────────────────────────────────────
const marriages = computed(() => {
  const out = []
  store.relationships.forEach(r => {
    if (r.type !== 'spouse') return
    const a = placedMap.value.get(r.person_a_id)
    const b = placedMap.value.get(r.person_b_id)
    if (!a || !b) return
    const pa = personById.value.get(r.person_a_id)
    const pb = personById.value.get(r.person_b_id)

    let year = parseInt(r.formed_date) || null
    let estimated = false
    if (!year) {
      // No recorded date — sketch a plausible spot inside the shared lifespan
      const lo = Math.max(pa.birth_year, pb.birth_year)
      const hi = Math.min(lifeEnd(pa), lifeEnd(pb))
      year = hi > lo ? Math.min(lo + 25, hi) : lo
      estimated = true
    }

    const divorced = r.status === 'divorced'
    const badge = estimated ? '⚭ add year' : `${divorced ? '⚮' : '⚭'} ${year}`
    const x1 = Math.min(a.x, b.x)
    const x2 = Math.max(a.x, b.x)
    const y = yearToY(year)
    // Hanging-rope curve: both ends anchor at the marriage year on each
    // lifeline, sagging in the middle where the year badge hangs like a pendant
    const sag = Math.min(34, 12 + (x2 - x1) * 0.05)
    out.push({
      id: r.id,
      ids: [r.person_a_id, r.person_b_id],
      names: `${pa.name} & ${pb.name}`,
      x1, x2,
      cx: (x1 + x2) / 2,
      y,
      midY: y + sag,
      d: `M ${x1} ${y} Q ${(x1 + x2) / 2} ${y + sag * 2} ${x2} ${y}`,
      year: estimated ? null : year,
      status: r.status || 'active',
      divorced, estimated, badge,
      bw: badge.length * 6.6 + 20,
    })
  })
  return out
})

// ── Birth connectors (one segment per parent → child) ───────────────────────
const births = computed(() => {
  const out = []
  store.relationships.forEach(r => {
    if (r.type !== 'parent_child' && r.type !== 'adopted') return
    const parent = placedMap.value.get(r.person_a_id)
    const child = placedMap.value.get(r.person_b_id)
    if (!parent || !child) return
    const y = child.y0
    // Rainbow arc from the parent's lifeline sweeping into the child's avatar —
    // curving up and over so it reads as a branch rather than a gridline
    const dx = child.x - parent.x
    const arc = Math.min(30, 12 + Math.abs(dx) * 0.045)
    const d = `M ${parent.x} ${y} C ${parent.x + dx * 0.32} ${y - arc}, ${child.x - dx * 0.32} ${y - arc}, ${child.x} ${y}`
    out.push({
      key: r.id,
      ids: [r.person_a_id, r.person_b_id],
      px: parent.x,
      y, d,
      adopted: r.type === 'adopted',
    })
  })
  return out
})

// ── Hover neighbourhood ─────────────────────────────────────────────────────
const relatedSet = computed(() => {
  const s = new Set()
  if (!hoverId.value) return s
  s.add(hoverId.value)
  store.relationships.forEach(r => {
    if (r.person_a_id === hoverId.value) s.add(r.person_b_id)
    if (r.person_b_id === hoverId.value) s.add(r.person_a_id)
  })
  return s
})

// ── Year axis (ticks, bands, now-line — computed in screen space) ───────────
const TICK_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500]

const tickStep = computed(() =>
  TICK_STEPS.find(s => s * pxPerYear.value >= 46) || 500
)

function yearScreenY(year) {
  return (year - minYear.value) * pxPerYear.value + Y_PAD + ty.value
}

const ticks = computed(() => {
  const step = tickStep.value
  const px = pxPerYear.value
  const first = Math.floor(((0 - ty.value - Y_PAD) / px + minYear.value) / step) * step
  const last = Math.ceil(((stageH.value - ty.value - Y_PAD) / px + minYear.value) / step) * step
  const out = []
  for (let y = first; y <= last; y += step) {
    out.push({ year: y, y: yearScreenY(y) })
  }
  return out
})

const bands = computed(() => {
  const step = tickStep.value
  const h = step * pxPerYear.value
  return ticks.value.filter(t => (t.year / step) % 2 === 0).map(t => ({ year: t.year, y: t.y, h }))
})

const nowLine = computed(() => {
  const y = yearScreenY(refYear.value)
  if (y < -30 || y > stageH.value + 30) return null
  return { y }
})

const mouseGuide = computed(() => {
  if (mouseY.value === null || panning.value) return null
  const year = Math.round((mouseY.value - ty.value - Y_PAD) / pxPerYear.value + minYear.value)
  return { y: mouseY.value, year }
})

// ── Pan / zoom mechanics ────────────────────────────────────────────────────
let startX = 0, startY = 0, startTx = 0, startTy = 0, moved = false, suppressClick = false

// rAF-coalesced writes so pointermove/wheel never outpace the display
let rafId = 0
let pendingTx = 0, pendingTy = 0, pendingPx = 0, pendingLs = 0, hasPending = false

function schedule(nx, ny, npx, nls) {
  pendingTx = nx; pendingTy = ny; pendingPx = npx; pendingLs = nls; hasPending = true
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    if (!hasPending) return
    hasPending = false
    pxPerYear.value = pendingPx
    laneScale.value = pendingLs
    tx.value = pendingTx
    ty.value = pendingTy
    clampPan()
  })
}
function curTx() { return hasPending ? pendingTx : tx.value }
function curTy() { return hasPending ? pendingTy : ty.value }
function curPx() { return hasPending ? pendingPx : pxPerYear.value }
function curLs() { return hasPending ? pendingLs : laneScale.value }

function clampVals(px, ls, x, y) {
  const wW = worldWBase.value * ls
  const wH = yearSpan.value * px + Y_PAD * 2
  const availW = stageW.value - GUTTER
  let cx, cy
  if (wW <= availW) cx = GUTTER + (availW - wW) / 2
  else cx = Math.min(GUTTER + CLAMP_PAD, Math.max(stageW.value - wW - CLAMP_PAD, x))
  if (wH <= stageH.value) cy = (stageH.value - wH) / 2
  else cy = Math.min(CLAMP_PAD, Math.max(stageH.value - wH - CLAMP_PAD, y))
  return { x: cx, y: cy }
}

function clampPan() {
  const c = clampVals(pxPerYear.value, laneScale.value, tx.value, ty.value)
  tx.value = c.x
  ty.value = c.y
}

function onPointerDown(e) {
  if (e.button !== 0) return
  panning.value = true
  moved = false
  cancelTween()
  startX = e.clientX; startY = e.clientY
  startTx = curTx(); startTy = curTy()
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}
function onPointerMove(e) {
  const dx = e.clientX - startX, dy = e.clientY - startY
  if (!moved && Math.hypot(dx, dy) > 4) moved = true
  if (!moved) return
  schedule(startTx + dx, startTy + dy, curPx(), curLs())
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
  cancelTween()
  const rect = stageEl.value.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  // Shift+wheel reports its delta on deltaX in Chromium
  const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX
  const factor = Math.exp(-delta * 0.0022)

  const vertical = !e.shiftKey
  const horizontal = !e.ctrlKey && !e.metaKey

  const oldPx = curPx(), oldLs = curLs()
  const newPx = vertical ? Math.min(MAX_PX, Math.max(MIN_PX, oldPx * factor)) : oldPx
  const newLs = horizontal ? Math.min(MAX_LS, Math.max(MIN_LS, oldLs * factor)) : oldLs
  // Keep the point under the cursor fixed on each zoomed axis
  const newTy = vertical ? anchorTy(my, curTy(), newPx / oldPx) : curTy()
  const newTx = horizontal ? mx - ((mx - curTx()) * (newLs / oldLs)) : curTx()
  schedule(newTx, newTy, newPx, newLs)
}

// New ty that keeps screen point `my` over the same year after scaling by k.
// World y = (year − minYear) · px + Y_PAD, and Y_PAD doesn't scale — naive
// proportional scaling drifts by Y_PAD·(k−1) per step.
function anchorTy(my, oldTy, k) {
  return my - ((my - oldTy - Y_PAD) * k + Y_PAD)
}

function onStageMove(e) {
  const rect = stageEl.value?.getBoundingClientRect()
  if (rect) mouseY.value = e.clientY - rect.top
}

function onStageClick() {
  if (suppressClick) { suppressClick = false; return }
  mEdit.value = null
}

function onPersonClick(id) {
  if (suppressClick) { suppressClick = false; return }
  mEdit.value = null
  store.selectPerson(id)
}

// ── Smooth tween for zoom buttons / fit ─────────────────────────────────────
let tweenRaf = 0
function cancelTween() { if (tweenRaf) { cancelAnimationFrame(tweenRaf); tweenRaf = 0 } }

function tweenTo(targetPx, targetLs, targetTx, targetTy, ms = 320) {
  cancelTween()
  const c = clampVals(targetPx, targetLs, targetTx, targetTy)
  const s = { px: pxPerYear.value, ls: laneScale.value, tx: tx.value, ty: ty.value }
  const d = { px: targetPx, ls: targetLs, tx: c.x, ty: c.y }
  const t0 = performance.now()
  const ease = t => 1 - Math.pow(1 - t, 3)
  const step = (now) => {
    const t = Math.min(1, (now - t0) / ms)
    const k = ease(t)
    pxPerYear.value = s.px + (d.px - s.px) * k
    laneScale.value = s.ls + (d.ls - s.ls) * k
    tx.value = s.tx + (d.tx - s.tx) * k
    ty.value = s.ty + (d.ty - s.ty) * k
    tweenRaf = t < 1 ? requestAnimationFrame(step) : 0
  }
  tweenRaf = requestAnimationFrame(step)
}

function zoomBy(factor) {
  const cx = stageW.value / 2
  const cy = stageH.value / 2
  const oldPx = pxPerYear.value, oldLs = laneScale.value
  const newPx = Math.min(MAX_PX, Math.max(MIN_PX, oldPx * factor))
  const newLs = Math.min(MAX_LS, Math.max(MIN_LS, oldLs * factor))
  const newTy = anchorTy(cy, ty.value, newPx / oldPx)
  const newTx = cx - ((cx - tx.value) * (newLs / oldLs))
  tweenTo(newPx, newLs, newTx, newTy)
}

function fitAll(animate = false) {
  if (!stageH.value) return
  const px = Math.min(MAX_PX, Math.max(MIN_PX, (stageH.value - 160) / yearSpan.value))
  const ls = Math.min(1, Math.max(MIN_LS, (stageW.value - GUTTER - 100) / worldWBase.value))
  if (animate) {
    tweenTo(px, ls, GUTTER + 40, 60)
  } else {
    pxPerYear.value = px
    laneScale.value = ls
    tx.value = GUTTER + 40
    ty.value = 60
    clampPan()
  }
}

// ── Marriage year editing ───────────────────────────────────────────────────
function openMarriageEdit(m, e) {
  const rect = stageEl.value.getBoundingClientRect()
  mEdit.value = {
    relId: m.id,
    names: trunc(m.names, 34),
    year: m.year,
    status: m.status,
    px: Math.min(Math.max(8, e.clientX - rect.left - 110), stageW.value - 230),
    py: Math.min(Math.max(8, e.clientY - rect.top + 14), stageH.value - 140),
  }
  nextTick(() => meditInputRef.value?.focus())
}

async function saveMarriageEdit() {
  if (!mEdit.value) return
  const year = mEdit.value.year
  await store.updateRelationship({
    id: mEdit.value.relId,
    formed_date: (year && year > 0) ? year : null,
    status: mEdit.value.status,
  })
  mEdit.value = null
}

// ── Lifecycle ───────────────────────────────────────────────────────────────
let ro = null
onMounted(() => {
  const measure = () => {
    stageW.value = stageEl.value?.clientWidth || 0
    stageH.value = stageEl.value?.clientHeight || 0
  }
  measure()
  nextTick(() => { measure(); fitAll(false) })
  ro = new ResizeObserver(() => { measure(); clampPan() })
  if (stageEl.value) ro.observe(stageEl.value)
})

watch(() => placed.value.length, () => nextTick(clampPan))

onBeforeUnmount(() => {
  if (ro) ro.disconnect()
  if (rafId) cancelAnimationFrame(rafId)
  cancelTween()
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
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
    radial-gradient(1200px 600px at 20% -10%, rgba(139, 108, 197, 0.08), transparent 60%),
    var(--bg);
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
.tl-heading { display: flex; align-items: center; gap: 10px; }
.tl-title { font-size: 18px; font-weight: 700; letter-spacing: -0.2px; color: var(--t1); }
.tl-count {
  font-size: 12px; font-weight: 700; color: var(--accent);
  background: var(--adim); padding: 2px 9px; border-radius: 20px;
}
.tl-undated {
  font-size: 11px; font-weight: 600; color: #f5a623;
  background: rgba(245, 166, 35, 0.12); padding: 2px 9px; border-radius: 20px;
  cursor: help;
}

.tl-legend { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.tl-legend-item {
  display: flex; align-items: center; gap: 6px;
  font-size: 11.5px; font-weight: 600; color: var(--t2);
}
.tl-swatch { width: 18px; height: 3px; border-radius: 2px; }
.tl-swatch-dashed {
  background: none;
  border-top: 3px dashed currentColor;
  height: 0;
}
.tl-hint { font-size: 11px; color: var(--t3); font-weight: 500; }

/* ── Stage ───────────────────────────────────────────────── */
.tl-stage {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
}
.tl-stage.dragging { cursor: grabbing; }
.tl-svg { display: block; user-select: none; font-family: var(--font); }

/* While panning, skip hover hit-testing entirely */
.tl-stage.dragging .tl-person,
.tl-stage.dragging .tl-mbadge { pointer-events: none; }

/* ── Grid & axis ─────────────────────────────────────────── */
.tl-band { fill: var(--t1); opacity: 0.025; }
.tl-gridline { stroke: var(--border); stroke-width: 1; opacity: 0.65; }
.tl-nowline {
  stroke: var(--accent); stroke-width: 1.4;
  stroke-dasharray: 7 5; opacity: 0.55;
}

.tl-gutter-bg { fill: var(--surface); opacity: 0.88; }
.tl-tick-label {
  font-size: 10.5px; font-weight: 600; fill: var(--t3);
  font-variant-numeric: tabular-nums;
}
.tl-now-chip rect { fill: var(--adim); stroke: var(--accent); stroke-width: 1; opacity: 0.95; }
.tl-now-chip text { font-size: 10.5px; font-weight: 700; fill: var(--accent); font-variant-numeric: tabular-nums; }

.tl-mouse-line { stroke: var(--t3); stroke-width: 1; stroke-dasharray: 2 5; opacity: 0.35; }
.tl-mouse-chip rect { fill: var(--elevated); stroke: var(--border); stroke-width: 1; }
.tl-mouse-chip text { font-size: 10.5px; font-weight: 700; fill: var(--t1); font-variant-numeric: tabular-nums; }
.tl-mouse-chip, .tl-mouse-line { pointer-events: none; }

/* ── Person lifelines ────────────────────────────────────── */
/* fill-mode backwards (not forwards/both): a finished fill-forwards animation
   would pin opacity at 1 and override the .dim hover state */
.tl-person {
  cursor: pointer;
  transition: opacity 0.25s ease;
  animation: tl-rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: calc(min(var(--i, 0), 30) * 0.03s);
}
.tl-person.dim { opacity: 0.22; }

.tl-hit { stroke: transparent; stroke-width: 26; pointer-events: stroke; }

.tl-life {
  stroke-width: 6;
  stroke-linecap: round;
  opacity: 0.85;
  transition: stroke-width 0.2s ease, opacity 0.2s ease;
}
.tl-person.hovered .tl-life,
.tl-person.selected .tl-life { stroke-width: 9; opacity: 1; }

.tl-cap { stroke-width: 3; stroke-linecap: round; opacity: 0.9; }

.tl-alive-dot {
  animation: tl-pulse 2.2s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}

.tl-avatar-ring {
  stroke: var(--surface);
  stroke-width: 2.5;
  filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.3));
  transition: transform 0.25s cubic-bezier(0.34, 1.4, 0.5, 1);
  transform-box: fill-box;
  transform-origin: center;
}
.tl-avatar-img { pointer-events: none; }
.tl-avatar-icon { fill: rgba(255, 255, 255, 0.92); pointer-events: none; }
.tl-person.hovered .tl-avatar-ring { transform: scale(1.15); }
.tl-person.selected .tl-avatar-ring { stroke: var(--accent); stroke-width: 3; }

.tl-name {
  font-size: 12.5px; font-weight: 700; fill: var(--t1);
  paint-order: stroke; stroke: var(--bg); stroke-width: 3px; stroke-linejoin: round;
}
.tl-years {
  font-size: 10px; font-weight: 600; fill: var(--t3);
  font-variant-numeric: tabular-nums;
  paint-order: stroke; stroke: var(--bg); stroke-width: 3px; stroke-linejoin: round;
}

/* ── Marriage connectors ─────────────────────────────────── */
.tl-marriage {
  transition: opacity 0.25s ease;
  animation: tl-fade 0.6s ease 0.35s backwards;
}
.tl-marriage.dim { opacity: 0.12; }
.tl-marriage.lit .tl-marriage-line { opacity: 1; stroke-width: 2.5; }

.tl-marriage-line {
  fill: none;
  stroke-width: 2.4; opacity: 0.8;
  stroke-linecap: round;
  transition: opacity 0.2s ease, stroke-width 0.2s ease;
}
.tl-marriage.divorced .tl-marriage-line { stroke-dasharray: 6 5; opacity: 0.5; }
.tl-marriage.estimated .tl-marriage-line { stroke-dasharray: 2 5; opacity: 0.35; }
.tl-marriage.estimated .tl-mdot { opacity: 0.4; }

.tl-mbadge { cursor: pointer; }
.tl-mbadge rect {
  fill: var(--surface); stroke-width: 1.2;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.25));
  transition: transform 0.2s cubic-bezier(0.34, 1.4, 0.5, 1);
  transform-box: fill-box; transform-origin: center;
}
.tl-mbadge text { font-size: 10.5px; font-weight: 700; fill: var(--t1); font-variant-numeric: tabular-nums; }
.tl-mbadge:hover rect { transform: scale(1.08); }
.tl-marriage.estimated .tl-mbadge rect { stroke-dasharray: 3 3; }
.tl-marriage.estimated .tl-mbadge text { fill: var(--t3); }

/* ── Birth connectors ────────────────────────────────────── */
.tl-birth {
  transition: opacity 0.25s ease;
  animation: tl-fade 0.6s ease 0.3s backwards;
}
.tl-birth.dim { opacity: 0.08; }
.tl-birth.lit .tl-birth-line { opacity: 0.95; stroke-width: 2.2; }

.tl-birth-line {
  fill: none;
  stroke-width: 1.8; opacity: 0.55;
  stroke-linecap: round;
  transition: opacity 0.2s ease, stroke-width 0.2s ease;
}
.tl-birth-line.adopted { stroke-dasharray: 4 4; }
.tl-birth-dot { opacity: 0.8; }

/* ── Floating controls ───────────────────────────────────── */
.tl-controls {
  position: absolute; bottom: 16px; right: 16px; z-index: 4;
  display: flex; align-items: center; gap: 4px;
  border: 1px solid var(--border);
  background: var(--glass-soft); backdrop-filter: blur(8px);
  padding: 5px; border-radius: 12px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
}
.tl-ctrl-btn {
  border: none; background: transparent; color: var(--t2);
  font-family: var(--font); font-size: 14px; font-weight: 700;
  width: 28px; height: 28px; border-radius: 8px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.13s, color 0.13s;
}
.tl-ctrl-btn:hover { background: var(--hover); color: var(--t1); }
.tl-fit-btn { width: auto; padding: 0 10px; font-size: 12px; }
.tl-zoom-label {
  font-size: 11px; font-weight: 700; color: var(--t3);
  min-width: 42px; text-align: center; font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.tl-ctrl-sep { width: 1px; height: 18px; background: var(--border); margin: 0 2px; }

/* ── Marriage edit popup ─────────────────────────────────── */
.tl-medit {
  position: absolute; z-index: 6; width: 220px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  cursor: default;
}
.tl-medit-title {
  font-size: 12px; font-weight: 700; color: var(--t1);
  margin-bottom: 9px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tl-medit-row { display: flex; gap: 6px; margin-bottom: 10px; }
.tl-medit-input {
  flex: 1; min-width: 0;
  padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px;
  background: var(--elevated); color: var(--t1);
  font-family: var(--font); font-size: 12px; font-weight: 600; outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.tl-medit-input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(108, 142, 245, 0.15); }
.tl-medit-select {
  flex: 1; min-width: 0;
  padding: 6px 6px; border: 1px solid var(--border); border-radius: 8px;
  background: var(--elevated); color: var(--t1);
  font-family: var(--font); font-size: 12px; font-weight: 600; outline: none;
  cursor: pointer;
}
.tl-medit-actions { display: flex; justify-content: flex-end; gap: 6px; }
.tl-medit-btn {
  border: 1px solid var(--border); background: transparent; color: var(--t2);
  font-family: var(--font); font-size: 11.5px; font-weight: 600;
  padding: 5px 12px; border-radius: 8px; cursor: pointer;
  transition: all 0.13s;
}
.tl-medit-btn:hover { background: var(--hover); color: var(--t1); }
.tl-medit-btn.primary {
  background: var(--accent); border-color: var(--accent); color: #fff;
}
.tl-medit-btn.primary:hover { filter: brightness(1.1); }

.medit-enter-active { transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.4, 0.5, 1); }
.medit-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.medit-enter-from, .medit-leave-to { opacity: 0; transform: translateY(6px) scale(0.96); }

/* ── Empty state ─────────────────────────────────────────── */
.tl-empty {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; gap: 8px; color: var(--t2); pointer-events: none;
}
.tl-empty-icon { font-size: 44px; opacity: 0.6; }
.tl-empty-title { font-size: 16px; font-weight: 700; color: var(--t1); }
.tl-empty-text { font-size: 13px; max-width: 300px; }

/* ── Keyframes ───────────────────────────────────────────── */
@keyframes tl-rise {
  from { opacity: 0; transform: translateY(16px); }
}
@keyframes tl-fade {
  from { opacity: 0; }
}
@keyframes tl-pulse {
  0%, 100% { opacity: 0.95; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(1.35); }
}
</style>
