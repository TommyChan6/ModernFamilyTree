<template>
  <section class="cs-card" :aria-label="t('census.title')">
    <header class="cs-head">
      <UiIcon class="cs-head-ic" name="users-round" :size="13" />
      <span class="cs-eyebrow">{{ t('census.title') }}</span>
      <span class="cs-head-year">{{ snap.year }}</span>
      <button
        class="cs-close"
        :title="t('census.close')"
        :aria-label="t('census.close')"
        @click="emit('close')"
      >
        <UiIcon name="x" :size="13" />
      </button>
    </header>

    <div v-if="!index.dated" class="cs-empty">
      <UiIcon class="cs-empty-ic" name="calendar-x" :size="20" />
      <p class="cs-empty-title">{{ t('census.emptyTitle') }}</p>
      <p class="cs-empty-body">{{ t('census.emptyBody') }}</p>
    </div>

    <template v-else>
      <!-- Headline numbers: they roll toward each new reading while scrubbing -->
      <div class="cs-big" aria-live="polite">
        <div class="cs-tile">
          <div class="cs-num">
            {{ fmtInt(shown.alive) }}
            <span
              v-if="trend"
              class="cs-trend"
              :class="'cs-trend-' + trend"
              :title="trendTitle"
              :aria-label="trendTitle"
            >
              <UiIcon :name="trend === 'up' ? 'trending-up' : 'trending-down'" :size="13" />
            </span>
          </div>
          <div class="cs-lab">{{ t('census.alive') }}</div>
        </div>
        <div class="cs-tile">
          <div class="cs-num">{{ fmtInt(shown.couples) }}</div>
          <div class="cs-lab">{{ t('census.couples') }}</div>
        </div>
        <div class="cs-tile">
          <div class="cs-num">{{ snap.meanAge == null ? '–' : fmtAge(shown.mean) }}</div>
          <div class="cs-lab">
            {{ t('census.meanAge') }}
          </div>
        </div>
      </div>
      <div v-if="snap.alive === 0" class="cs-nobody">
        {{ t('census.nobody', { year: snap.year }) }}
      </div>

      <!-- Gender split of the living -->
      <div
        v-if="snap.alive > 0"
        class="cs-gender"
        role="img"
        :aria-label="genderTitle"
        :title="genderTitle"
      >
        <span
          v-for="g in genderSegs"
          :key="g.key"
          class="cs-gender-seg"
          :class="'cs-g-' + g.key"
          :style="{ flexGrow: g.n, background: g.color }"
        ></span>
      </div>

      <dl class="cs-facts">
        <div class="cs-fact">
          <dt>{{ t('census.bornIn', { decade: decadeLabel }) }}</dt>
          <dd>{{ fmtInt(snap.birthsDecade) }}</dd>
        </div>
        <div class="cs-fact">
          <dt>{{ t('census.diedIn', { decade: decadeLabel }) }}</dt>
          <dd>{{ fmtInt(snap.deathsDecade) }}</dd>
        </div>
        <div class="cs-fact">
          <dt>{{ t('census.generations') }}</dt>
          <dd>{{ fmtInt(snap.generations) }}</dd>
        </div>
        <div class="cs-fact">
          <dt>{{ t('census.medianAge') }}</dt>
          <dd>{{ snap.medianAge == null ? '–' : fmtAge(snap.medianAge) }}</dd>
        </div>
        <div v-if="oldest" class="cs-fact cs-fact-wide">
          <dt>{{ t('census.oldest') }}</dt>
          <dd>
            <button
              class="cs-person"
              :title="t('census.selectPerson', { name: oldest.name })"
              @click="selectOldest"
            >
              <span class="cs-person-name">{{ oldest.name }}</span>
              <span class="cs-person-age">{{ t('census.ageShort', { age: oldest.age }) }}</span>
            </button>
          </dd>
        </div>
      </dl>

      <!-- Population across the slider's span, with the current-year cursor -->
      <div class="cs-spark">
        <div class="cs-spark-cap">
          <span>{{ t('census.population') }}</span>
          <span v-if="popHover" class="cs-spark-val">
            {{ t('census.hoverValue', { year: popHover.year, value: fmtInt(popHover.value) }) }}
          </span>
        </div>
        <svg
          class="cs-svg"
          viewBox="0 0 200 34"
          preserveAspectRatio="none"
          role="img"
          :aria-label="t('census.populationAria')"
          @pointermove="onPopHover"
          @pointerleave="clearPopHover"
          @click="jumpFromSpark"
        >
          <path class="cs-area" :d="popPaths.area" />
          <path class="cs-line" :d="popPaths.line" vector-effect="non-scaling-stroke" />
          <line
            class="cs-cursor"
            :x1="cursorX"
            :x2="cursorX"
            y1="0"
            y2="34"
            vector-effect="non-scaling-stroke"
          />
          <line
            v-if="popHover"
            class="cs-hoverline"
            :x1="popHover.x"
            :x2="popHover.x"
            y1="0"
            y2="34"
            vector-effect="non-scaling-stroke"
          />
        </svg>
      </div>

      <!-- Mortality: recorded deaths per decade, the current decade lit -->
      <div class="cs-spark">
        <div class="cs-spark-cap">
          <span>{{ t('census.mortality') }}</span>
          <span v-if="!anyDeaths" class="cs-spark-none">{{ t('census.noDeaths') }}</span>
          <span v-else-if="barHover" class="cs-spark-val">
            {{
              t('census.hoverDeaths', {
                decade: barHover.label,
                value: fmtInt(barHover.value)
              })
            }}
          </span>
        </div>
        <svg
          class="cs-svg cs-svg-bars"
          viewBox="0 0 200 26"
          preserveAspectRatio="none"
          role="img"
          :aria-label="t('census.mortalityAria')"
          @pointermove="onBarHover"
          @pointerleave="clearBarHover"
          @click="jumpFromSpark"
        >
          <rect
            v-for="b in bars"
            :key="b.i"
            class="cs-bar"
            :class="{
              'cs-bar-now': b.i === barNow,
              'cs-bar-hover': barHover && b.i === barHover.i
            }"
            :x="b.x"
            :y="b.y"
            :width="b.w"
            :height="b.h"
          />
        </svg>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, reactive, watch, onBeforeUnmount, ref } from 'vue'
import { useMainStore } from '../../store/index.js'
import { useTimeTravel } from './useTimeTravel'
import { buildCensus, censusAt, populationSeries, decadeSeries, groupSum } from './censusMath'
import UiIcon from '../ui/UiIcon.js'
import { useI18n } from '../../i18n'

const emit = defineEmits(['close'])
const store = useMainStore()
const { t, locale } = useI18n()
const tt = useTimeTravel()

const refYear = computed(() => store.currentDate?.year ?? new Date().getFullYear())
// Built once per data change — every scrub frame below is an O(1) lookup.
const index = computed(() =>
  buildCensus(store.persons, store.relationships, store.relTypeRoles, { refYear: refYear.value })
)
const range = computed(() => tt.range.value || { minYear: 0, maxYear: 1 })
// The census year follows the slider's readout: the scrubbed year, or "now".
const censusYear = computed(() =>
  tt.active.value ? Math.floor(tt.year.value) : range.value.maxYear
)
const snap = computed(() => censusAt(index.value, censusYear.value))

// ── Number formatting (the UI locale) ────────────────────────────────────────
const intFmt = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0 }))
const ageFmt = computed(
  () => new Intl.NumberFormat(locale.value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
)
function fmtInt(n) {
  return intFmt.value.format(Math.round(n))
}
function fmtAge(n) {
  return ageFmt.value.format(n)
}
const decadeLabel = computed(() => t('census.decade', { decade: snap.value.decade }))

// ── Rolling numbers: ease toward each new reading; instant under reduced motion ──
const shown = reactive({ alive: 0, couples: 0, mean: 0 })
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
let raf = 0
let lastTs = 0
function targets() {
  const s = snap.value
  return { alive: s.alive, couples: s.couples, mean: s.meanAge ?? 0 }
}
function step(ts) {
  raf = 0
  const dt = Math.min(0.1, Math.max(0, (ts - lastTs) / 1000))
  lastTs = ts
  const k = 1 - Math.exp(-dt / 0.09) // ~90 ms time constant
  const tg = targets()
  let moving = false
  for (const key of ['alive', 'couples', 'mean']) {
    const d = tg[key] - shown[key]
    const eps = key === 'mean' ? 0.04 : 0.4
    if (Math.abs(d) <= eps) shown[key] = tg[key]
    else {
      shown[key] += d * k
      moving = true
    }
  }
  if (moving) raf = requestAnimationFrame(step)
}
function kick() {
  if (reduceMotion?.matches) {
    Object.assign(shown, targets())
    return
  }
  if (!raf) {
    lastTs = performance.now()
    raf = requestAnimationFrame(step)
  }
}
Object.assign(shown, targets())
watch(snap, kick)
onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
})

// Population trend against ten years earlier.
const trendDelta = computed(
  () => snap.value.alive - censusAt(index.value, snap.value.year - 10).alive
)
const trend = computed(() => (trendDelta.value === 0 ? null : trendDelta.value > 0 ? 'up' : 'down'))
const trendTitle = computed(() =>
  t('census.trend', { delta: (trendDelta.value > 0 ? '+' : '') + fmtInt(trendDelta.value) })
)

// ── Gender split (the shared Style Studio palette) ───────────────────────────
const genderSegs = computed(() => {
  const g = snap.value.gender
  const gs = store.graphSettings
  return [
    { key: 'male', n: g.male, color: gs.maleColor },
    { key: 'female', n: g.female, color: gs.femaleColor },
    { key: 'other', n: g.other, color: 'var(--t3)' },
    { key: 'unknown', n: g.unknown, color: 'var(--border-strong)' }
  ].filter((s) => s.n > 0)
})
const genderTitle = computed(() => {
  const g = snap.value.gender
  return t('census.genderSplit', {
    male: fmtInt(g.male),
    female: fmtInt(g.female),
    other: fmtInt(g.other + g.unknown)
  })
})

// ── Oldest living person (click = select them) ──────────────────────────────
const personById = computed(() => new Map(store.persons.map((p) => [p.id, p])))
const oldest = computed(() => {
  const id = snap.value.oldestId
  if (!id) return null
  const p = personById.value.get(id)
  return {
    id,
    name: p?.name || t('timeline.canvas.unnamed'),
    age: fmtInt(snap.value.oldestAge ?? 0)
  }
})
function selectOldest() {
  if (oldest.value) store.selectPerson(oldest.value.id, { modal: false })
}

// ── Sparklines ───────────────────────────────────────────────────────────────
const SAMPLES = 120
const popSeries = computed(() =>
  populationSeries(index.value, range.value.minYear, range.value.maxYear, SAMPLES)
)
const popPaths = computed(() => {
  const s = popSeries.value
  const peak = Math.max(1, ...s)
  let line = ''
  s.forEach((v, i) => {
    const x = (i / (s.length - 1)) * 200
    const y = 33 - (v / peak) * 30
    line += (i ? 'L' : 'M') + x.toFixed(2) + ',' + y.toFixed(2)
  })
  return { line, area: line ? line + 'L200,34L0,34Z' : '' }
})
const spanYears = computed(() => Math.max(1e-6, range.value.maxYear - range.value.minYear))
const cursorX = computed(
  () => Math.min(1, Math.max(0, (censusYear.value - range.value.minYear) / spanYears.value)) * 200
)
function yearAtEvent(e) {
  const r = e.currentTarget.getBoundingClientRect()
  const f = Math.min(1, Math.max(0, (e.clientX - r.left) / Math.max(1, r.width)))
  return { f, year: Math.floor(range.value.minYear + f * spanYears.value) }
}
const popHover = ref(null)
function onPopHover(e) {
  const { f, year } = yearAtEvent(e)
  popHover.value = { x: f * 200, year, value: censusAt(index.value, year).alive }
}
function clearPopHover() {
  popHover.value = null
}
// Click a sparkline = travel to that year.
function jumpFromSpark(e) {
  const { year } = yearAtEvent(e)
  tt.pause()
  tt.setYear(year)
}

const MAX_BARS = 60
const decades = computed(() => decadeSeries(index.value, range.value.minYear, range.value.maxYear))
const barGroup = computed(() => {
  const len = decades.value.decades.length
  return Math.max(1, Math.ceil(len / MAX_BARS)) // decades per bar
})
const bars = computed(() => {
  const vals = groupSum(decades.value.deaths, barGroup.value)
  const peak = Math.max(1, ...vals)
  const w = 200 / Math.max(1, vals.length)
  const gap = Math.min(w * 0.3, 2)
  return vals.map((v, i) => {
    const h = v > 0 ? Math.max(1.5, (v / peak) * 24) : 0.6
    return { i, v, x: i * w + gap / 2, w: Math.max(0.4, w - gap), y: 26 - h, h }
  })
})
const anyDeaths = computed(() => decades.value.deaths.some((v) => v > 0))
const barNow = computed(() => {
  const d0 = decades.value.decades[0]
  if (d0 == null) return -1
  return Math.floor((snap.value.decade - d0) / 10 / barGroup.value)
})
const barHover = ref(null)
function onBarHover(e) {
  const { f } = yearAtEvent(e)
  const i = Math.min(bars.value.length - 1, Math.floor(f * bars.value.length))
  const b = bars.value[i]
  if (!b) return
  const first = decades.value.decades[i * barGroup.value]
  const label =
    barGroup.value > 1
      ? t('census.decadeSpan', { from: first, to: first + barGroup.value * 10 - 1 })
      : t('census.decade', { decade: first })
  barHover.value = { i, value: b.v, label }
}
function clearBarHover() {
  barHover.value = null
}
</script>

<style scoped>
.cs-card {
  position: absolute;
  left: calc(100% + 10px);
  top: 0;
  width: 248px;
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  background: var(--glass-strong);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
  color: var(--t1);
  cursor: default;
  user-select: none;
  transform-origin: left top;
  animation: cs-in 0.24s var(--ease-out, ease-out);
}
@keyframes cs-in {
  from {
    opacity: 0;
    transform: translateX(-8px) scale(0.97);
  }
}
@media (prefers-reduced-motion: reduce) {
  .cs-card {
    animation: none;
  }
}

/* ── Header ─────────────────────────────────────────── */
.cs-head {
  display: flex;
  align-items: center;
  gap: 6px;
  height: var(--ctl-xs, 24px);
}
.cs-head-ic {
  color: var(--accent);
  flex-shrink: 0;
}
.cs-eyebrow {
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--t2);
}
.cs-head-year {
  font-size: 12px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--accent);
}
.cs-close {
  margin-left: auto;
  width: var(--ctl-xs, 24px);
  height: var(--ctl-xs, 24px);
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--r-sm, 6px);
  background: transparent;
  color: var(--t3);
  cursor: pointer;
}
.cs-close:hover {
  background: var(--hover);
  color: var(--t1);
}

/* ── Headline numbers ───────────────────────────────── */
.cs-big {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.cs-tile {
  min-width: 0;
  padding: 6px 6px 5px;
  border-radius: 8px;
  background: var(--elevated);
  border: 1px solid var(--border);
  text-align: center;
}
.cs-num {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 20px;
  line-height: 1.1;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--t1);
  white-space: nowrap;
}
.cs-lab {
  margin-top: 2px;
  font-size: 11px;
  font-weight: 600;
  color: var(--t2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cs-trend {
  display: inline-flex;
  flex-shrink: 0;
}
.cs-trend-up {
  color: var(--green, var(--accent));
}
.cs-trend-down {
  color: var(--danger);
}
.cs-nobody {
  font-size: 11px;
  color: var(--t2);
  text-align: center;
}

/* ── Gender split ───────────────────────────────────── */
.cs-gender {
  display: flex;
  height: 6px;
  gap: 2px;
  border-radius: 3px;
  overflow: hidden;
}
.cs-gender-seg {
  flex-basis: 0;
  min-width: 2px;
  transition: flex-grow 0.25s ease;
}
@media (prefers-reduced-motion: reduce) {
  .cs-gender-seg {
    transition: none;
  }
}

/* ── Small facts ────────────────────────────────────── */
.cs-facts {
  margin: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 10px;
}
.cs-fact {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  min-width: 0;
}
.cs-fact-wide {
  grid-column: 1 / -1;
}
.cs-fact dt {
  font-size: 11px;
  color: var(--t2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.cs-fact dd {
  margin: 0;
  font-size: 12px;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  color: var(--t1);
  min-width: 0;
}
.cs-person {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  max-width: 170px;
  padding: 0 6px;
  height: 20px;
  border: 1px solid rgba(var(--accent-rgb), 0.35);
  border-radius: var(--r-pill, 999px);
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--t1);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  cursor: pointer;
}
.cs-person:hover {
  background: rgba(var(--accent-rgb), 0.2);
}
.cs-person-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cs-person-age {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--t2);
  font-weight: 600;
}

/* ── Sparklines ─────────────────────────────────────── */
.cs-spark {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.cs-spark-cap {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  font-size: 11px;
  font-weight: 650;
  color: var(--t2);
}
.cs-spark-val {
  font-variant-numeric: tabular-nums;
  color: var(--t1);
}
.cs-spark-cap > span {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cs-spark-none {
  font-weight: 500;
  color: var(--t3);
}
.cs-svg {
  display: block;
  width: 100%;
  height: 34px;
  cursor: crosshair;
  overflow: visible;
}
.cs-svg-bars {
  height: 26px;
}
.cs-area {
  fill: rgba(var(--accent-rgb), 0.16);
}
.cs-line {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.6;
  stroke-linejoin: round;
}
.cs-cursor {
  stroke: var(--t1);
  stroke-width: 1.5;
}
.cs-hoverline {
  stroke: var(--t3);
  stroke-width: 1;
  stroke-dasharray: 2 2;
}
.cs-bar {
  fill: var(--t3);
}
.cs-bar-hover {
  fill: var(--t2);
}
.cs-bar-now {
  fill: var(--danger);
}

/* ── Empty state ────────────────────────────────────── */
.cs-empty {
  text-align: center;
  padding: 6px 4px 2px;
}
.cs-empty-ic {
  color: var(--t3);
}
.cs-empty-title {
  margin: 4px 0 2px;
  font-size: 12px;
  font-weight: 750;
  color: var(--t1);
}
.cs-empty-body {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--t2);
}

/* ── Narrow stages: a tighter card ──────────────────── */
@media (max-width: 760px) {
  .cs-card {
    width: 184px;
    padding: 8px 8px 10px;
    gap: 7px;
  }
  .cs-big {
    gap: 4px;
  }
  .cs-tile {
    padding: 5px 2px 4px;
  }
  .cs-num {
    font-size: 15px;
  }
  .cs-facts {
    grid-template-columns: 1fr;
  }
  .cs-person {
    max-width: 104px;
  }
}

/* ── 水墨 ink: a paper slip in a silk mount; numbers brushed ───────── */
:root[data-theme='ink'] .cs-card {
  border-radius: 2px;
  border-color: var(--ink-mount-line);
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow:
    0 0 0 3px var(--ink-silk),
    0 0 0 4px rgba(58, 42, 22, 0.22),
    var(--shadow);
}
:root[data-theme='ink'] .cs-eyebrow,
:root[data-theme='ink'] .cs-lab,
:root[data-theme='ink'] .cs-fact dt,
:root[data-theme='ink'] .cs-spark-cap {
  font-family: var(--font-ink-label);
}
:root[data-theme='ink'] .cs-eyebrow {
  text-transform: none;
  font-variant: small-caps;
  letter-spacing: 0.16em;
}
:root[data-theme='ink'] .cs-num,
:root[data-theme='ink'] .cs-head-year {
  font-family: var(--font-brush);
  font-weight: 400;
}
:root[data-theme='ink'] .cs-num {
  font-size: 22px;
}
:root[data-theme='ink'] .cs-tile {
  border-radius: 2px 4px 3px 5px / 4px 2px 5px 3px;
  background: rgba(28, 26, 23, 0.04);
  border-color: var(--ink-mount-line);
}
:root[data-theme='ink'] .cs-line {
  stroke: var(--ink-black);
}
:root[data-theme='ink'] .cs-area {
  fill: rgba(28, 26, 23, 0.12);
}
:root[data-theme='ink'] .cs-cursor {
  stroke: var(--accent);
}
:root[data-theme='ink'] .cs-bar {
  fill: rgba(28, 26, 23, 0.45);
}
:root[data-theme='ink'] .cs-person {
  border-radius: 2px;
}

/* ── Medieval: a ruled leaf in a gilt frame; caps and rubrics ───────── */
:root[data-theme='medieval'] .cs-card {
  border-radius: 3px;
  background: var(--med-sheet), var(--surface);
  background-size: 512px 512px;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border: 1px solid var(--med-gold-deep);
  box-shadow:
    0 0 0 2px var(--med-gold),
    0 0 0 3px var(--med-gold-deep),
    var(--shadow);
}
:root[data-theme='medieval'] .cs-eyebrow {
  font-family: var(--font-caps);
  color: var(--med-vermilion);
  letter-spacing: 0.14em;
}
:root[data-theme='medieval'] .cs-num,
:root[data-theme='medieval'] .cs-head-year {
  font-family: var(--font-caps);
}
:root[data-theme='medieval'] .cs-tile {
  border-radius: 2px;
  border-color: rgba(138, 100, 28, 0.45);
  background: rgba(201, 160, 67, 0.08);
}
:root[data-theme='medieval'] .cs-line {
  stroke: var(--med-lapis);
}
:root[data-theme='medieval'] .cs-bar-now {
  fill: var(--med-vermilion);
}
:root[data-theme='medieval'] .cs-person {
  border-radius: 2px;
}
</style>
