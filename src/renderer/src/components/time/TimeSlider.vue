<template>
  <div
    v-if="visible"
    class="time-slider"
    :class="{
      'ts-clean': store.cleanView,
      'ts-timeline': store.activeView === 'timeline',
      'ts-on': active,
      'ts-playing': playing
    }"
    @pointerdown.stop
    @wheel.stop
    @click.stop
    @dblclick.stop
  >
    <!-- Year readout -->
    <div class="ts-readout" :title="active ? 'Time travel active' : 'Showing the present'">
      <div class="ts-readout-cap">{{ active ? 'YEAR' : 'NOW' }}</div>
      <div class="ts-readout-year">{{ readoutYear }}</div>
      <div v-if="active && startYear != null" class="ts-readout-span">
        from {{ Math.floor(startYear) }}
      </div>
    </div>

    <!-- Vertical track: past at the top, present at the bottom. Two nubs frame a
         window of time — drag either; playback advances the end (lower) nub. -->
    <div class="ts-track-zone">
      <div class="ts-endcap">{{ range.minYear }}</div>
      <div
        ref="trackEl"
        class="ts-track"
        title="Drag either handle to frame a span of time"
        @pointerdown="onTrackDown"
      >
        <div class="ts-rail"></div>
        <div class="ts-density">
          <div
            v-for="(d, i) in density"
            :key="i"
            class="ts-density-cell"
            :style="{ opacity: 0.12 + d * 0.88 }"
          ></div>
        </div>
        <div
          class="ts-fill"
          :style="{ top: startPct + '%', height: Math.max(0, pct - startPct) + '%' }"
        ></div>
        <div
          v-show="active"
          class="ts-thumb ts-thumb-start"
          :class="{ 'ts-thumb-grabbed': dragNub === 'start' }"
          :style="{ top: startPct + '%' }"
        >
          <div class="ts-thumb-core"></div>
        </div>
        <div
          class="ts-thumb ts-thumb-end"
          :class="{ 'ts-thumb-grabbed': dragNub === 'end' }"
          :style="{ top: pct + '%' }"
        >
          <div class="ts-thumb-core"></div>
        </div>
      </div>
      <div class="ts-endcap">{{ range.maxYear }}</div>
    </div>

    <!-- Transport -->
    <div class="ts-controls">
      <button
        class="ts-btn ts-btn-play"
        :title="playing ? 'Pause' : reversed ? 'Play backwards' : 'Play through time'"
        @click="tt.togglePlay()"
      >
        {{ playing ? '❚❚' : reversed ? '◀' : '▶' }}
      </button>
      <button
        class="ts-btn"
        :disabled="!active"
        title="Stop — back to the present"
        @click="tt.stop()"
      >
        ■
      </button>
      <template v-if="store.caps.timeControls">
        <div class="ts-ctrl-sep"></div>
        <div class="ts-btn-row">
          <button class="ts-btn ts-btn-sm" title="Previous event" @click="tt.skipEvent(-1)">
            «
          </button>
          <button class="ts-btn ts-btn-sm" title="Next event" @click="tt.skipEvent(1)">»</button>
        </div>
        <div class="ts-btn-row">
          <button class="ts-btn ts-btn-sm" title="Back one year" @click="tt.stepYears(-1)">
            −1
          </button>
          <button class="ts-btn ts-btn-sm" title="Forward one year" @click="tt.stepYears(1)">
            +1
          </button>
        </div>
        <button
          class="ts-btn ts-btn-speed"
          :title="'Playback speed — ' + speedLabel"
          @click="tt.cycleSpeed()"
        >
          {{ speedLabel }}
        </button>
        <div class="ts-btn-row">
          <button
            class="ts-btn ts-btn-sm"
            :class="{ 'ts-btn-active': reversed }"
            title="Reverse playback direction"
            @click="tt.toggleReversed()"
          >
            ⇅
          </button>
          <button
            class="ts-btn ts-btn-sm"
            :class="{ 'ts-btn-active': looping }"
            title="Loop playback"
            @click="tt.toggleLooping()"
          >
            ∞
          </button>
        </div>
      </template>
    </div>

    <!-- Event feed: what just happened while time flows -->
    <div class="ts-feed">
      <TransitionGroup name="ts-toast">
        <div v-for="t in toasts" :key="t.key" class="ts-toast" :class="'ts-toast-' + t.kind">
          <span class="ts-toast-icon">{{ t.kind === 'birth' ? '👶' : '💍' }}</span>
          <span class="ts-toast-label">{{ t.label }}</span>
          <span class="ts-toast-year">{{ t.year }}</span>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useMainStore } from '../../store/index.js'
import { useTimeTravel, TIME_SPEEDS } from './useTimeTravel'
import { bucketizeEvents, eventsCrossed } from './timeMath'

const store = useMainStore()
const tt = useTimeTravel()
// Destructured refs auto-unwrap in the template; methods stay on `tt`.
const { year, startYear, playing, reversed, looping, speedIdx } = tt
const active = tt.active
const rangeRef = tt.range

// Shown on the graph and timeline views only; a 3D Space scene owns the whole
// stage (no time gating there), and no dated people means nothing to travel.
const spaceOn = computed(() => {
  if (store.activeView !== 'graph' || !store.caps.space3d) return false
  const s = store.scenes.find((x) => x.id === store.activeSceneIds.graph)
  return s?.type === 'space'
})
const visible = computed(
  () =>
    // Time Travel is a Standard/Advanced affordance — Simple mode keeps the
    // stage uncluttered.
    store.programMode !== 'simple' &&
    (store.activeView === 'graph' || store.activeView === 'timeline') &&
    !spaceOn.value &&
    !!rangeRef.value
)

// If the slider gets hidden mid-scrub (e.g. dropping into Simple mode, or a
// view switch), snap back to the present so the hidden state can't strand the
// data in the past.
watch(visible, (isVisible) => {
  if (!isVisible && active.value) tt.stop()
})

const range = computed(() => rangeRef.value || { minYear: 0, maxYear: 1 })
const pct = computed(() => tt.progress.value * 100) // end/playhead nub
const startPct = computed(() => tt.startProgress.value * 100) // start nub
const readoutYear = computed(() => (active.value ? Math.floor(year.value) : range.value.maxYear))
const speedLabel = computed(() => TIME_SPEEDS[speedIdx.value].label)

const DENSITY_BUCKETS = 48
const density = computed(() =>
  rangeRef.value ? bucketizeEvents(tt.events.value, rangeRef.value, DENSITY_BUCKETS) : []
)

// ── Scrub the track ─────────────────────────────────────────────────────────
const trackEl = ref(null)
// Which nub the current drag is moving: 'start' (lower bound) or 'end' (playhead).
const dragNub = ref(null)

function fractionAt(clientY) {
  const rect = trackEl.value.getBoundingClientRect()
  return Math.min(1, Math.max(0, (clientY - rect.top) / Math.max(1, rect.height)))
}
function yearAt(clientY) {
  const r = range.value
  return r.minYear + fractionAt(clientY) * (r.maxYear - r.minYear)
}

function applyDrag(clientY) {
  const y = yearAt(clientY)
  if (dragNub.value === 'start') tt.setStartYear(y)
  else tt.setYear(y)
}

function onTrackDown(e) {
  if (e.button !== 0) return
  tt.pause()
  // While engaged, grab whichever nub sits nearest the click; from the resting
  // (present) state a plain click just drops the playhead as before.
  if (active.value) {
    const f = fractionAt(e.clientY)
    dragNub.value =
      Math.abs(f - tt.startProgress.value) < Math.abs(f - tt.progress.value) ? 'start' : 'end'
  } else {
    dragNub.value = 'end'
  }
  applyDrag(e.clientY)
  window.addEventListener('pointermove', onTrackMove)
  window.addEventListener('pointerup', onTrackUp)
}
function onTrackMove(e) {
  applyDrag(e.clientY)
}
function onTrackUp() {
  dragNub.value = null
  window.removeEventListener('pointermove', onTrackMove)
  window.removeEventListener('pointerup', onTrackUp)
}

// ── Event toasts while time flows forward ───────────────────────────────────
const toasts = ref([]) // { key, kind, label, year }
let toastSeq = 0
const toastTimers = new Set()

watch(year, (ny, oy) => {
  if (ny == null || oy == null || ny <= oy) return
  if (ny - oy > 30) return // a long jump isn't a story — no toast spam
  const crossed = eventsCrossed(tt.events.value, oy, ny)
  if (!crossed.length) return
  for (const e of crossed.slice(-3)) {
    const t = {
      key: ++toastSeq,
      kind: e.kind,
      label: e.label.length > 26 ? e.label.slice(0, 25) + '…' : e.label,
      year: Math.floor(e.year)
    }
    toasts.value.push(t)
    const timer = setTimeout(() => {
      toastTimers.delete(timer)
      const i = toasts.value.indexOf(t)
      if (i >= 0) toasts.value.splice(i, 1)
    }, 2600)
    toastTimers.add(timer)
  }
  if (toasts.value.length > 3) toasts.value.splice(0, toasts.value.length - 3)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onTrackMove)
  window.removeEventListener('pointerup', onTrackUp)
  for (const t of toastTimers) clearTimeout(t)
  toastTimers.clear()
})
</script>

<style scoped>
.time-slider {
  position: absolute;
  left: 14px;
  top: 186px;
  bottom: 118px;
  width: 58px;
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px 6px;
  background: var(--glass-soft);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
  cursor: default;
  transition:
    transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.28s ease,
    border-color 0.25s ease;
}
.time-slider.ts-on {
  border-color: rgba(108, 142, 245, 0.45);
}
/* Timeline view: sit past the year gutter and below its minimap */
.time-slider.ts-timeline {
  left: 76px;
  top: 226px;
}
/* Clean view slides the panel off with the rest of the chrome */
.time-slider.ts-clean {
  transform: translateX(-130%);
  opacity: 0;
  pointer-events: none;
}

/* ── Readout ─────────────────────────────────────────────── */
.ts-readout {
  text-align: center;
  line-height: 1.1;
  user-select: none;
}
.ts-readout-cap {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 1.4px;
  color: var(--t3);
}
.ts-readout-year {
  font-size: 13.5px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--t2);
  transition: color 0.2s ease;
}
.ts-on .ts-readout-year {
  color: var(--accent);
}
.ts-readout-span {
  font-size: 8.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--t3);
  margin-top: 1px;
}
.ts-playing .ts-readout-year {
  animation: ts-tick 1.1s ease-in-out infinite;
}
@keyframes ts-tick {
  50% {
    text-shadow: 0 0 12px rgba(108, 142, 245, 0.75);
  }
}

/* ── Track ───────────────────────────────────────────────── */
.ts-track-zone {
  flex: 1 1 0;
  min-height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  align-self: stretch;
}
.ts-endcap {
  font-size: 8.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--t3);
  user-select: none;
}
.ts-track {
  position: relative;
  flex: 1 1 0;
  min-height: 40px;
  width: 26px;
  cursor: ns-resize;
  touch-action: none;
}
.ts-rail {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 4px;
  transform: translateX(-50%);
  border-radius: 2px;
  background: var(--elevated);
  border: 1px solid var(--border);
}
/* Event-density heat strip beside the rail */
.ts-density {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(50% + 5px);
  width: 5px;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}
.ts-density-cell {
  flex: 1 1 0;
  background: var(--accent);
  border-radius: 2px;
  margin: 0.5px 0;
}
/* Revealed-history fill */
.ts-fill {
  position: absolute;
  top: 0;
  left: 50%;
  width: 4px;
  transform: translateX(-50%);
  border-radius: 2px;
  background: linear-gradient(180deg, rgba(108, 142, 245, 0.25), var(--accent));
  pointer-events: none;
}
.ts-thumb {
  position: absolute;
  left: 50%;
  width: 18px;
  height: 18px;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 2;
}
.ts-thumb-core {
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--t1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
  transition:
    box-shadow 0.2s ease,
    transform 0.18s cubic-bezier(0.34, 1.4, 0.5, 1);
}
/* The start nub is a hollow ring — reads as the opening edge of the span,
   clearly distinct from the solid playhead that sweeps during playback. */
.ts-thumb-start {
  z-index: 1;
}
.ts-thumb-start .ts-thumb-core {
  background: var(--surface);
  border-color: var(--accent);
}
.ts-on .ts-thumb-core {
  box-shadow:
    0 0 0 3px rgba(108, 142, 245, 0.22),
    0 2px 10px rgba(0, 0, 0, 0.5);
}
/* Grabbed nub swells for tactile feedback */
.ts-thumb-grabbed .ts-thumb-core {
  transform: scale(1.3);
  box-shadow:
    0 0 0 5px rgba(108, 142, 245, 0.2),
    0 3px 12px rgba(0, 0, 0, 0.55);
}
.ts-playing .ts-thumb-end .ts-thumb-core {
  animation: ts-pulse 1.1s ease-in-out infinite;
}
@keyframes ts-pulse {
  50% {
    box-shadow:
      0 0 0 7px rgba(108, 142, 245, 0.16),
      0 0 14px rgba(108, 142, 245, 0.6);
  }
}

/* ── Controls ────────────────────────────────────────────── */
.ts-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}
.ts-btn {
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 11px;
  font-weight: 700;
  width: 34px;
  height: 26px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.13s,
    color 0.13s,
    border-color 0.13s,
    transform 0.13s;
}
.ts-btn:hover:not(:disabled) {
  background: var(--hover);
  color: var(--t1);
}
.ts-btn:active:not(:disabled) {
  transform: scale(0.94);
}
.ts-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.ts-btn-play {
  width: 38px;
  height: 30px;
  font-size: 12px;
  background: var(--adim);
  border-color: rgba(108, 142, 245, 0.4);
  color: var(--accent);
}
.ts-btn-play:hover {
  background: var(--accent);
  color: #fff;
}
.ts-btn-row {
  display: flex;
  gap: 4px;
}
.ts-btn-sm {
  width: 21px;
  height: 21px;
  font-size: 11px;
  border-radius: 6px;
}
.ts-btn-speed {
  width: 46px;
  height: 21px;
  font-size: 10px;
  border-radius: 6px;
  letter-spacing: 0.4px;
}
.ts-btn-active {
  background: var(--adim);
  border-color: rgba(108, 142, 245, 0.5);
  color: var(--accent);
}
.ts-ctrl-sep {
  width: 26px;
  height: 1px;
  background: var(--border);
  margin: 2px 0;
}

/* ── Event feed ──────────────────────────────────────────── */
.ts-feed {
  position: absolute;
  left: calc(100% + 10px);
  bottom: 4px;
  width: 195px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  pointer-events: none;
}
.ts-toast {
  display: flex;
  align-items: center;
  gap: 7px;
  max-width: 100%;
  padding: 5px 11px 5px 8px;
  border-radius: 10px;
  background: var(--glass-strong);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  font-size: 11px;
  font-weight: 600;
  color: var(--t1);
  white-space: nowrap;
}
.ts-toast-birth {
  border-left: 2.5px solid var(--green, #57c99b);
}
.ts-toast-marriage {
  border-left: 2.5px solid var(--amber, #f5a623);
}
.ts-toast-icon {
  font-size: 12px;
}
.ts-toast-label {
  overflow: hidden;
  text-overflow: ellipsis;
}
.ts-toast-year {
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--t3);
}
.ts-toast-enter-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s cubic-bezier(0.34, 1.45, 0.5, 1);
}
.ts-toast-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.ts-toast-enter-from {
  opacity: 0;
  transform: translateX(-14px) scale(0.92);
}
.ts-toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
