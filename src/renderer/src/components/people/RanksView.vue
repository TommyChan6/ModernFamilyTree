<template>
  <div
    ref="scrollEl"
    class="ranks"
    :class="{
      'rk-prep': phase === 'prep',
      'rk-narrow': viewW < 620,
      'rk-short': viewH > 0 && viewH < 640
    }"
    @scroll.passive="onScroll"
  >
    <!-- Metric picker: segmented pills with a gliding highlight -->
    <header class="rk-head">
      <div class="rk-pills" role="tablist" :aria-label="t('directory.ranks.metricAria')">
        <i class="rk-glide" :style="glideStyle" aria-hidden="true"></i>
        <button
          v-for="m in METRICS"
          :key="m.id"
          :ref="(el) => setPillEl(m.id, el)"
          class="rk-pill"
          :class="{ on: m.id === metricId }"
          role="tab"
          :aria-selected="m.id === metricId"
          :title="metricBlurb(m)"
          @click="setMetric(m.id)"
        >
          <UiIcon class="rk-pill-ic" :name="m.icon" :size="14" />
          <span class="rk-pill-lb">{{ metricLabel(m) }}</span>
        </button>
      </div>
      <div v-if="persons.length" class="rk-summary">
        <span class="rk-blurb">{{ metricBlurb(metric) }}</span>
        <span class="rk-chips">
          <span class="rk-chip"
            ><b>{{ ranking.rankedCount }}</b> {{ t('directory.ranks.ranked') }}</span
          >
          <span v-if="ranking.unrankedCount" class="rk-chip rk-chip-dim"
            ><b>{{ ranking.unrankedCount }}</b> {{ t('directory.ranks.unranked') }}</span
          >
          <span v-if="ranking.rankedCount" class="rk-chip"
            >{{ t('directory.ranks.avg') }} <b>{{ fmt(ranking.avg, 1) }}</b>
            {{ unitLabel(metric, ranking.avg) }}</span
          >
        </span>
      </div>
    </header>

    <div v-if="!persons.length" class="rk-empty">
      <div class="rk-empty-icon"><UiIcon name="trophy" :size="44" :stroke="1.5" /></div>
      <div class="rk-empty-title">{{ t('directory.ranks.emptyTitle') }}</div>
      <div class="rk-empty-text">{{ t('directory.ranks.emptyText') }}</div>
    </div>

    <template v-else>
      <!-- ── Podium: ranks 1–3 ── -->
      <section
        class="rk-podium"
        :aria-label="t('directory.ranks.topThree')"
        :style="{ '--sw': stepW + 'px' }"
      >
        <div class="rk-rays" aria-hidden="true"></div>
        <div class="rk-stage">
          <div
            v-for="s in podium"
            :key="s.slot"
            class="rk-step"
            :class="['rk-step-' + s.slot, 'tier-' + s.tier, { vacant: !s.e }]"
          >
            <div class="rk-figslot">
              <Transition name="rk-swap">
                <div
                  v-if="s.e"
                  :key="s.e.id"
                  class="rk-fig"
                  :class="{ selected: store.selectedPersonId === s.e.id, dead: s.dead }"
                  :title="s.p.name || t('directory.ranks.unnamed')"
                  @click="select(s.e.id)"
                >
                  <div v-if="s.e.rank === 1" class="rk-crown" aria-hidden="true">
                    <svg viewBox="0 0 44 32" width="44" height="32">
                      <path
                        d="M4 27 L2 8 L13 17 L22 3 L31 17 L42 8 L40 27 Z"
                        class="rk-crown-body"
                      />
                      <rect x="4" y="26" width="36" height="5" rx="2" class="rk-crown-band" />
                      <circle cx="22" cy="3.5" r="2.6" class="rk-crown-gem" />
                      <circle cx="2.5" cy="8" r="2.1" class="rk-crown-gem" />
                      <circle cx="41.5" cy="8" r="2.1" class="rk-crown-gem" />
                    </svg>
                    <UiIcon
                      v-for="k in 5"
                      :key="k"
                      class="rk-spark"
                      :class="'sp' + k"
                      name="sparkle"
                      :size="12"
                    />
                  </div>
                  <div class="rk-portrait" :style="{ '--gc': s.color }">
                    <RankArt :person="s.p" :size="256" />
                  </div>
                  <div class="rk-fig-name">
                    {{ s.p.name || t('directory.ranks.unnamed')
                    }}<UiIcon
                      v-if="s.dead"
                      class="rk-moon"
                      name="moon"
                      :size="12"
                      :label="t('directory.ranks.deceased')"
                    />
                  </div>
                  <div class="rk-fig-val">
                    <b>{{ fmt(s.val) }}</b> {{ unitLabel(metric, s.e.value) }}
                  </div>
                </div>
              </Transition>
            </div>
            <div class="rk-pillar">
              <span class="rk-pillar-num">{{ s.e ? s.e.rank : '' }}</span>
              <i class="rk-pillar-shine" aria-hidden="true"></i>
            </div>
          </div>
          <!-- confetti burst — replays whenever the champion changes -->
          <div v-if="champKey" :key="champKey" class="rk-burst" aria-hidden="true">
            <i v-for="c in CONFETTI" :key="c.k" :class="'c' + c.c" :style="c.style"></i>
          </div>
        </div>
        <div class="rk-floor" aria-hidden="true"></div>
        <div v-if="!ranking.rankedCount" class="rk-podium-note">
          {{ t('directory.ranks.podiumNote', { metric: metricLower(metric) }) }}
        </div>
      </section>

      <!-- ── Leaderboard ── -->
      <div class="rk-cols" aria-hidden="true">
        <span class="rk-col-rank">#</span>
        <span class="rk-col-name">{{ t('directory.ranks.colName') }}</span>
        <span class="rk-col-bar">
          <UiIcon :name="metric.icon" :size="12" :stroke="2.4" />
          {{ metricLabel(metric) }}
        </span>
      </div>
      <div ref="boardEl" class="rk-board" :style="{ height: boardH + 'px' }">
        <div
          v-if="ranking.unrankedCount"
          class="rk-divider"
          :style="{ transform: `translateY(${dividerY}px)` }"
        >
          <span>{{
            t('directory.ranks.unrankedDivider', {
              n: ranking.unrankedCount,
              metric: metricLower(metric)
            })
          }}</span>
        </div>

        <div
          v-for="r in rows"
          :key="r.id"
          class="rk-row"
          :class="r.cls"
          :style="r.style"
          @click="select(r.id)"
        >
          <div class="rk-card">
            <span
              class="rk-rank"
              :class="{ long: r.rankLabel.length > 3, xlong: r.rankLabel.length > 4 }"
              :title="r.tied ? t('directory.ranks.tied') : ''"
            >
              <span :key="r.rankLabel" class="rk-rank-n">{{ r.rankLabel }}</span>
            </span>
            <span class="rk-ava">
              <RankArt :person="r.p" :size="96" />
            </span>
            <span class="rk-id">
              <span class="rk-name"
                >{{ r.p.name || t('directory.ranks.unnamed')
                }}<UiIcon
                  v-if="r.dead"
                  class="rk-moon"
                  name="moon"
                  :size="12"
                  :label="t('directory.ranks.deceased')"
              /></span>
              <span class="rk-sub">{{ r.sub }}</span>
            </span>
            <span class="rk-track">
              <span class="rk-lane">
                <template v-if="r.e">
                  <span class="rk-fill" :style="{ width: r.pct + '%' }"></span>
                  <span class="rk-val" :style="{ left: r.pct + '%' }">
                    <b>{{ fmt(r.val) }}</b> {{ unitLabel(metric, r.e.value) }}
                  </span>
                </template>
                <span v-else class="rk-none">—</span>
              </span>
            </span>
            <span v-if="showTags" class="rk-tags">
              <span
                v-for="tg in r.tags"
                :key="tg.id || tg.label"
                class="rk-tag"
                :style="{ '--tc': tg.color || 'var(--accent)' }"
              >
                <UiIcon v-if="tg.icon" :name="tg.icon" :size="11" />
                {{ tagLabel(tg) }}
              </span>
            </span>
            <span class="rk-delta-slot">
              <span v-if="deltaOn && r.delta" :key="raceId" class="rk-delta" :class="r.delta.kind">
                <UiIcon
                  v-if="r.delta.kind !== 'new'"
                  :name="r.delta.kind === 'up' ? 'arrow-up' : 'arrow-down'"
                  :size="11"
                  :stroke="3"
                />{{ r.delta.text }}
              </span>
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, nextTick, h } from 'vue'
import { useMainStore } from '../../store/index.js'
import { useI18n } from '../../i18n'
import { defaultNameLabel } from '../../lib/dataLabels'
import { isDeceased } from './peopleLayout.js'
import UiIcon from '../ui/UiIcon.js'
import { useThumbnail } from './useThumbnail.js'
import { METRICS, METRIC_BY_ID, buildLineage, metricValues, rankEntries } from './ranksMetrics.js'

// Ranks: a podium for the top three and a leaderboard bar race below it.
// Switching the metric re-ranks everyone: rows glide to their new slots
// (absolute translateY, so a transform transition is all the FLIP we need),
// bars stretch, numbers roll and the podium swaps occupants. The board is
// virtualized — fixed row height, only rows near the viewport are mounted —
// and during a race the rows leaving/entering the viewport are mounted too,
// clamped just outside it so they visibly slide in or out.

const props = defineProps({
  persons: { type: Array, required: true },
  statsOf: { type: Function, required: true },
  refYear: { type: Number, required: true }
})

const store = useMainStore()
const { t } = useI18n()
const scrollEl = ref(null)
const boardEl = ref(null)

const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Portrait: cached thumbnail or monogram (own component so each visible row
// owns its reactive thumbnail).
const RankArt = {
  props: { person: { type: Object, required: true }, size: { type: Number, default: 96 } },
  setup(p) {
    const { src } = useThumbnail(
      () => p.person.primary_image || '',
      () => p.size
    )
    const initials = computed(() => {
      const parts = (p.person.name || '?').trim().split(/\s+/).filter(Boolean)
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      return (parts[0] || '?').substring(0, 2).toUpperCase()
    })
    return () =>
      src.value
        ? h('img', { class: 'rk-img', src: src.value, alt: '', draggable: false })
        : h('span', { class: 'rk-mono' }, initials.value)
  }
}

// ── Metric (remembered per browser) ────────────────────────────────────────
const LS_KEY = 'ft.directory.ranksMetric'
function loadMetric() {
  try {
    const v = localStorage.getItem(LS_KEY)
    if (v && METRIC_BY_ID.has(v)) return v
  } catch {
    /* storage unavailable */
  }
  return 'age'
}
const metricId = ref(loadMetric())
const metric = computed(() => METRIC_BY_ID.get(metricId.value) || METRICS[0])

let deltaArmed = false
function setMetric(id) {
  if (id === metricId.value || !METRIC_BY_ID.has(id)) return
  deltaArmed = true
  metricId.value = id
  try {
    localStorage.setItem(LS_KEY, id)
  } catch {
    /* storage unavailable */
  }
}

// Gliding highlight under the active pill
const pillEls = {}
const glide = ref({ x: 0, w: 0 })
function setPillEl(id, el) {
  if (el) pillEls[id] = el
  else delete pillEls[id]
}
function measureGlide() {
  const el = pillEls[metricId.value]
  if (el) glide.value = { x: el.offsetLeft, w: el.offsetWidth }
}
const glideStyle = computed(() => ({
  width: glide.value.w + 'px',
  transform: `translateX(${glide.value.x}px)`,
  opacity: glide.value.w ? 1 : 0
}))

// ── Ranking ────────────────────────────────────────────────────────────────
const lineage = computed(() => buildLineage(store.relationships, store.relTypeRoles))

const ranking = computed(() => {
  const m = metric.value
  const values = metricValues(m.id, props.persons, {
    statsOf: props.statsOf,
    refYear: props.refYear,
    relationships: store.relationships,
    lineage: lineage.value
  })
  const ids = props.persons.map((p) => p.id)
  const { ranked, unranked, max } = rankEntries(ids, values, { zeroIsNone: m.zeroIsNone })
  const order = ranked.map((e) => e.id).concat(unranked)
  let sum = 0
  for (const e of ranked) sum += e.value
  return {
    metricId: m.id,
    order,
    index: new Map(order.map((id, i) => [id, i])),
    entries: new Map(ranked.map((e) => [e.id, e])),
    top: ranked.slice(0, 3),
    rankedCount: ranked.length,
    unrankedCount: unranked.length,
    max,
    avg: ranked.length ? sum / ranked.length : 0
  }
})

// Tag chips only on wide screens, and only when someone on the roster has a
// tag — an always-empty column would just squeeze every bar.
const showTags = computed(
  () => viewW.value >= 980 && props.persons.some((p) => store.tagsOf.get(p.id)?.length)
)

// Podium step width: three steps + gaps always fit the body width.
const stepW = computed(() => Math.round(Math.max(88, Math.min(178, (viewW.value - 56) / 3))))

const personById = computed(() => new Map(props.persons.map((p) => [p.id, p])))

// ── Board geometry ─────────────────────────────────────────────────────────
const ROW_H = 58
const DIVIDER_H = 46
const BOARD_PAD = 28
const OVERSCAN = ROW_H * 4
const DUR = 680 // ms per row glide / bar stretch / number roll
const MAX_STAGGER = 280

function slotY(i, R) {
  return i * ROW_H + (R.unrankedCount && i >= R.rankedCount ? DIVIDER_H : 0)
}
function idxAt(y, R) {
  const split = R.rankedCount * ROW_H
  if (y < split) return Math.floor(y / ROW_H)
  return R.rankedCount + Math.floor((y - split - (R.unrankedCount ? DIVIDER_H : 0)) / ROW_H)
}
const boardH = computed(() => {
  const R = ranking.value
  return R.order.length * ROW_H + (R.unrankedCount ? DIVIDER_H : 0) + BOARD_PAD
})
const dividerY = computed(() => ranking.value.rankedCount * ROW_H)

const viewW = ref(0)
const viewH = ref(0)
const scrollTop = ref(0)
const boardTop = ref(0)

let scrollRaf = 0
function onScroll() {
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    scrollTop.value = scrollEl.value?.scrollTop || 0
  })
}
function remeasure() {
  const el = scrollEl.value
  if (!el) return
  viewW.value = el.clientWidth
  viewH.value = el.clientHeight
  scrollTop.value = el.scrollTop
  if (boardEl.value) boardTop.value = boardEl.value.offsetTop
  measureGlide()
  // width-dependent classes (narrow pills) land on the next render
  nextTick(() => {
    measureGlide()
    if (boardEl.value) boardTop.value = boardEl.value.offsetTop
  })
}

function windowIds(R, lo, hi) {
  const n = R.order.length
  const i0 = Math.max(0, idxAt(lo, R))
  const i1 = Math.min(n - 1, idxAt(hi, R))
  return i1 >= i0 ? R.order.slice(i0, i1 + 1) : []
}

// ── Race state ─────────────────────────────────────────────────────────────
const phase = ref('idle') // 'idle' | 'prep' (old slots, no transition) | 'run'
const prev = shallowRef(null) // the ranking we're racing away from
const rollElapsed = ref(1e9) // ms since the number roll began
let rollFrom = new Map() // id → value the number rolls from
let rollStart = 0
let rollRaf = 0
let raf1 = 0
let raf2 = 0
let endTimer = 0
let deltaTimer = 0
let enterTimer = 0
const deltaOn = ref(false)
const raceId = ref(0)
let deltaFrom = new Map() // id → previous rank (null = was unranked)

function rollTick(now) {
  rollElapsed.value = now - rollStart
  rollRaf = rollElapsed.value < DUR + MAX_STAGGER + 200 ? requestAnimationFrame(rollTick) : 0
}
function startRoll() {
  if (reduceMotion) {
    rollElapsed.value = 1e9
    return
  }
  cancelAnimationFrame(rollRaf)
  rollStart = performance.now()
  rollElapsed.value = 0
  rollRaf = requestAnimationFrame(rollTick)
}
const ease = (t) => 1 - Math.pow(1 - t, 3)
function rolled(id, to, delay) {
  const from = rollFrom.get(id) ?? 0
  const t = Math.max(0, Math.min(1, (rollElapsed.value - delay) / DUR))
  return from + (to - from) * ease(t)
}

watch(ranking, (cur, old) => {
  if (!old) return
  const armed = deltaArmed
  deltaArmed = false
  clearTimeout(endTimer)
  cancelAnimationFrame(raf1)
  cancelAnimationFrame(raf2)
  rollFrom = new Map()
  for (const [id, e] of old.entries) rollFrom.set(id, e.value)
  if (armed) {
    deltaFrom = new Map()
    for (const id of old.order) deltaFrom.set(id, old.entries.get(id)?.rank ?? null)
    raceId.value++
    deltaOn.value = true
    clearTimeout(deltaTimer)
    deltaTimer = setTimeout(() => (deltaOn.value = false), 3000)
  }
  if (reduceMotion) {
    prev.value = null
    phase.value = 'idle'
    rollElapsed.value = 1e9
    return
  }
  prev.value = old
  phase.value = 'prep'
  raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(() => {
      phase.value = 'run'
      startRoll()
      endTimer = setTimeout(
        () => {
          phase.value = 'idle'
          prev.value = null
        },
        DUR + MAX_STAGGER + 120
      )
    })
  })
})

// Entrance on mount: rows slide in, bars grow and numbers count up from 0.
const entering = ref(!reduceMotion)

// ── Rows (virtualized) ─────────────────────────────────────────────────────
const genderColor = (p) =>
  p.gender === 'male'
    ? store.graphSettings.maleColor
    : p.gender === 'female'
      ? store.graphSettings.femaleColor
      : store.graphSettings.unknownColor

function lifeText(p) {
  const b = p.birth?.year
  const d = p.death?.year
  if (b != null && d != null) return `${b} – ${d}`
  if (b != null) return t('directory.ranks.bornShort', { year: b })
  if (d != null) return t('directory.ranks.diedShort', { year: d })
  return ''
}

const rows = computed(() => {
  const R = ranking.value
  if (!R.order.length || !viewH.value) return []
  const top = scrollTop.value - boardTop.value
  const lo = top - OVERSCAN
  const hi = top + viewH.value + OVERSCAN
  const ph = phase.value
  const P = ph !== 'idle' ? prev.value : null
  const ids = new Set(windowIds(R, lo, hi))
  if (P) for (const id of windowIds(P, lo, hi)) if (R.index.has(id)) ids.add(id)

  // During a race, far-away slots are pinned just outside the viewport so
  // rows read as sliding in/out rather than teleporting through.
  const cTop = top - ROW_H * 1.5
  const cBot = top + viewH.value + ROW_H * 0.5
  const clamp = (y) => Math.max(cTop, Math.min(cBot, y))

  const out = []
  // Stable (id-sorted) DOM order: Vue never has to move a node, so running
  // transform transitions are never interrupted by a re-insert.
  for (const id of [...ids].sort()) {
    const p = personById.value.get(id)
    if (!p) continue
    const i = R.index.get(id)
    const e = R.entries.get(id) || null
    const newY = slotY(i, R)
    const k = Math.max(0, (newY - top) / ROW_H)
    const inPrev = P && P.index.has(id)
    let y = newY
    let pct = e && R.max > 0 ? (e.value / R.max) * 100 : 0
    let dl = 0
    let climbing = false
    if (P) {
      const oldY = inPrev ? slotY(P.index.get(id), P) : newY
      climbing = inPrev && oldY > newY
      if (ph === 'prep') {
        y = clamp(oldY)
        const pe = P.entries.get(id)
        pct = pe && P.max > 0 ? (pe.value / P.max) * 100 : 0
      } else {
        y = clamp(newY)
        dl = Math.min(MAX_STAGGER, k * 22)
      }
    } else if (entering.value) {
      dl = Math.min(600, k * 38)
    }

    let delta = null
    if (deltaOn.value && e && deltaFrom.has(id)) {
      const from = deltaFrom.get(id)
      if (from == null) delta = { kind: 'new', text: t('directory.ranks.deltaNew') }
      else if (from !== e.rank) {
        const d = from - e.rank
        delta = d > 0 ? { kind: 'up', text: String(d) } : { kind: 'down', text: String(-d) }
      }
    }

    const tier = e && e.rank <= 3 ? e.rank : 0
    const occ = p.occupation || ''
    const life = lifeText(p)
    out.push({
      id,
      p,
      e,
      tied: !!e?.tied,
      rankLabel: e ? (e.tied ? '=' : '') + e.rank : '—',
      dead: isDeceased(p, props.refYear),
      sub: occ && life ? `${occ} · ${life}` : occ || life || '—',
      pct,
      val: e ? rolled(id, e.value, dl) : 0,
      tags: (store.tagsOf.get(id) || []).slice(0, 2),
      delta,
      cls: {
        selected: store.selectedPersonId === id,
        unr: !e,
        ['tier-' + tier]: tier > 0,
        climbing,
        fresh: P && !inPrev,
        'rk-in': !P && entering.value
      },
      style: {
        transform: `translate3d(0, ${y}px, 0)`,
        '--dl': dl + 'ms',
        '--rc': genderColor(p),
        zIndex: climbing ? 3 : store.selectedPersonId === id ? 2 : 1
      }
    })
  }
  return out
})

// ── Podium ─────────────────────────────────────────────────────────────────
const PODIUM_SLOTS = [
  { slot: 'second', pos: 1 },
  { slot: 'first', pos: 0 },
  { slot: 'third', pos: 2 }
]
const podium = computed(() =>
  PODIUM_SLOTS.map(({ slot, pos }) => {
    const e = ranking.value.top[pos] || null
    const p = e ? personById.value.get(e.id) : null
    return {
      slot,
      e: p ? e : null,
      p,
      tier: e ? Math.min(3, e.rank) : pos + 1,
      dead: p ? isDeceased(p, props.refYear) : false,
      color: p ? genderColor(p) : '',
      val: e ? rolled(e.id, e.value, 160) : 0
    }
  })
)
const champKey = computed(() => {
  const e = ranking.value.top[0]
  return e && !reduceMotion ? metricId.value + ':' + e.id : ''
})

// Confetti burst particles — deterministic pseudo-random spread.
const CONFETTI = Array.from({ length: 26 }, (_, k) => {
  const a = (k / 26) * Math.PI * 2 + (k % 3) * 0.37
  const r = 70 + ((k * 37) % 60)
  return {
    k,
    c: k % 4,
    style: {
      '--dx': Math.round(Math.cos(a) * r * 1.5) + 'px',
      '--dy': Math.round(Math.sin(a) * r * 0.8 - 60) + 'px',
      '--rot': ((k * 97) % 540) - 270 + 'deg',
      '--d': (k % 5) * 40 + 'ms',
      '--w': 5 + (k % 3) * 2 + 'px'
    }
  }
})

// ── Formatting & interaction ───────────────────────────────────────────────
// Metric display text is translated at render time by metric id (the pure
// METRICS catalog keeps its English labels for tests/fallback).
const metricLabel = (m) => t(`directory.ranks.metrics.${m.id}.label`)
const metricBlurb = (m) => t(`directory.ranks.metrics.${m.id}.blurb`)
const metricLower = (m) => metricLabel(m).toLocaleLowerCase()
const unitLabel = (m, value) =>
  m ? t(`directory.ranks.metrics.${m.id}.unit.${Math.round(value) === 1 ? 'one' : 'other'}`) : ''
const tagLabel = (tg) => defaultNameLabel(tg.label)
function fmt(v, digits = 0) {
  if (v == null || !Number.isFinite(v)) return '—'
  const f = 10 ** digits
  const n = Math.round(v * f) / f
  return n.toLocaleString(undefined, { maximumFractionDigits: digits })
}
function select(id) {
  store.selectPerson(id)
}

function onKeydown(e) {
  if (store.modalOpen || store.formOpen || store.curtain?.active) return
  if (store.appSettingsOpen || store.userPageOpen || store.projectsPageOpen || store.browsePageOpen)
    return
  const t = e.target
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
  if (t && t.isContentEditable) return
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  const i = METRICS.findIndex((m) => m.id === metricId.value)
  const n = METRICS.length
  e.preventDefault()
  setMetric(METRICS[(i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n].id)
}

let ro = null
onMounted(() => {
  nextTick(remeasure)
  ro = new ResizeObserver(remeasure)
  if (scrollEl.value) ro.observe(scrollEl.value)
  window.addEventListener('keydown', onKeydown)
  startRoll()
  enterTimer = setTimeout(() => (entering.value = false), 1500)
})
watch(metricId, () => nextTick(measureGlide))
// The board's offset moves if the header wraps or the roster (re)appears.
watch(
  () => props.persons.length > 0,
  () => nextTick(remeasure)
)
onBeforeUnmount(() => {
  ro?.disconnect()
  window.removeEventListener('keydown', onKeydown)
  cancelAnimationFrame(scrollRaf)
  cancelAnimationFrame(rollRaf)
  cancelAnimationFrame(raf1)
  cancelAnimationFrame(raf2)
  clearTimeout(endTimer)
  clearTimeout(deltaTimer)
  clearTimeout(enterTimer)
})
</script>

<style scoped>
.ranks {
  --gold: var(--amber);
  --silver: color-mix(in srgb, var(--t2) 86%, var(--accent));
  --bronze: color-mix(in srgb, color-mix(in srgb, var(--amber) 64%, var(--pink)) 80%, var(--t3));
  --ease-spring: cubic-bezier(0.3, 1.18, 0.45, 1);
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
}
[data-theme='light'] .ranks {
  --silver: color-mix(in srgb, var(--t3) 90%, var(--accent));
  --bronze: color-mix(in srgb, color-mix(in srgb, var(--amber) 60%, var(--pink)) 82%, var(--t2));
}
.ranks .tier-1 {
  --mc: var(--gold);
}
.ranks .tier-2 {
  --mc: var(--silver);
}
.ranks .tier-3 {
  --mc: var(--bronze);
}

/* ── Header ── */
.rk-head {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 10px 18px;
  background: var(--glass-strong);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border);
}
.rk-pills {
  position: relative;
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  overflow-x: auto;
  scrollbar-width: none;
  max-width: 100%;
}
.rk-pills::-webkit-scrollbar {
  display: none;
}
.rk-glide {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 0;
  border-radius: 9px;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--accent) 26%, transparent),
    color-mix(in srgb, var(--gold) 18%, transparent)
  );
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent),
    0 4px 14px -6px color-mix(in srgb, var(--accent) 60%, transparent);
  transition:
    transform 0.42s var(--ease-spring),
    width 0.42s var(--ease-spring);
  pointer-events: none;
}
.rk-pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.15s;
}
.rk-pill:hover {
  color: var(--t1);
}
.rk-pill.on {
  color: var(--t1);
}
.rk-pill-ic {
  transition: transform 0.3s var(--ease-spring);
}
.rk-pill.on .rk-pill-ic {
  transform: scale(1.18);
}
.rk-narrow .rk-pill-lb {
  display: none;
}
.rk-narrow .rk-pill.on .rk-pill-lb {
  display: inline;
}
.rk-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 12px;
  min-width: 0;
  color: var(--t3);
  font-size: 12.5px;
}
.rk-blurb {
  color: var(--t2);
  font-weight: 500;
}
.rk-chips {
  display: flex;
  gap: 6px;
}
.rk-chip {
  padding: 2px 9px;
  border-radius: 10px;
  background: var(--elevated);
  color: var(--t2);
  font-weight: 600;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.rk-chip b {
  color: var(--t1);
}
.rk-chip-dim {
  opacity: 0.75;
}

/* ── Podium ── */
.rk-podium {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  /* top room for the crown + sparkles; height follows the stage */
  padding: 64px 16px 26px;
  overflow: hidden;
}
.rk-short .rk-podium {
  padding-top: 58px;
}
.rk-rays {
  position: absolute;
  left: 50%;
  top: 44%;
  width: 900px;
  height: 900px;
  margin: -450px 0 0 -450px;
  background: repeating-conic-gradient(
    from 0deg,
    color-mix(in srgb, var(--gold) 9%, transparent) 0deg 7deg,
    transparent 7deg 20deg
  );
  -webkit-mask-image: radial-gradient(circle, #000 0%, transparent 52%);
  mask-image: radial-gradient(circle, #000 0%, transparent 52%);
  animation: rk-rays-spin 60s linear infinite;
  pointer-events: none;
}
@keyframes rk-rays-spin {
  to {
    transform: rotate(360deg);
  }
}
.rk-floor {
  position: absolute;
  left: 50%;
  bottom: 14px;
  width: min(640px, 90%);
  height: 26px;
  transform: translateX(-50%);
  border-radius: 50%;
  background: radial-gradient(
    closest-side,
    color-mix(in srgb, var(--t1) 16%, transparent),
    transparent
  );
  pointer-events: none;
}
.rk-podium-note {
  position: absolute;
  left: 0;
  right: 0;
  top: 38%;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--t2);
  pointer-events: none;
}
.rk-stage {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  gap: 12px;
}
.rk-step {
  --mc: var(--t3);
  --ph: 90px;
  position: relative;
  width: var(--sw, 160px);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.rk-step.tier-1 {
  --ph: 150px;
}
.rk-step.tier-2 {
  --ph: 110px;
}
.rk-step.tier-3 {
  --ph: 80px;
}
.rk-short .rk-step.tier-1 {
  --ph: 104px;
}
.rk-short .rk-step.tier-2 {
  --ph: 76px;
}
.rk-short .rk-step.tier-3 {
  --ph: 54px;
}
.rk-figslot {
  position: relative;
  width: 100%;
  height: 168px;
  /* clip only the bottom edge: figures sink into / rise out of the pillar */
  clip-path: inset(-240px -80px 0 -80px);
}
.rk-fig {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  cursor: pointer;
  text-align: center;
}
.rk-portrait {
  --gc: var(--accent);
  position: relative;
  width: 82px;
  height: 82px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(
    circle at 50% 30%,
    color-mix(in srgb, var(--gc) 38%, var(--elevated)),
    var(--elevated)
  );
  box-shadow:
    0 0 0 3px var(--mc),
    0 0 0 7px color-mix(in srgb, var(--mc) 22%, transparent),
    0 12px 28px -8px color-mix(in srgb, var(--mc) 55%, transparent);
  transition:
    transform 0.3s var(--ease-spring),
    box-shadow 0.3s;
}
.rk-step-first .rk-portrait {
  width: 104px;
  height: 104px;
}
.rk-short .rk-figslot {
  height: 150px;
}
.rk-short .rk-portrait {
  width: 70px;
  height: 70px;
}
.rk-short .rk-step-first .rk-portrait {
  width: 88px;
  height: 88px;
}
.rk-fig:hover .rk-portrait {
  transform: translateY(-4px) scale(1.05);
}
.rk-fig.selected .rk-portrait {
  box-shadow:
    0 0 0 3px var(--mc),
    0 0 0 6px var(--accent),
    0 0 26px 4px color-mix(in srgb, var(--accent) 55%, transparent);
}
.rk-fig.dead :deep(.rk-img) {
  filter: grayscale(0.45) sepia(0.1);
}
.rk-portrait :deep(.rk-mono) {
  font-size: 28px;
}
.rk-step-first .rk-portrait :deep(.rk-mono) {
  font-size: 34px;
}
.rk-fig-name {
  max-width: 100%;
  margin-top: 8px;
  padding: 0 4px;
  font-size: 13px;
  font-weight: 800;
  color: var(--t1);
  letter-spacing: -0.2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rk-step-first .rk-fig-name {
  font-size: 14px;
}
.rk-fig-val {
  font-size: 12px;
  font-weight: 600;
  color: var(--t2);
  font-variant-numeric: tabular-nums;
}
.rk-fig-val b {
  font-size: 15px;
  font-weight: 800;
  color: color-mix(in srgb, var(--mc) 70%, var(--t1));
}
.rk-step-first .rk-fig-val b {
  font-size: 18px;
}

/* The pillar */
.rk-pillar {
  position: relative;
  width: 100%;
  height: var(--ph);
  border-radius: 14px 14px 5px 5px;
  overflow: hidden;
  display: flex;
  justify-content: center;
  padding-top: 10px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--mc) 92%, white) 0%,
    var(--mc) 16%,
    color-mix(in srgb, var(--mc) 62%, var(--bg)) 100%
  );
  box-shadow:
    inset 0 2px 0 color-mix(in srgb, white 45%, transparent),
    inset 0 -18px 30px -12px color-mix(in srgb, black 35%, transparent),
    0 16px 36px -14px color-mix(in srgb, var(--mc) 70%, transparent);
  transform-origin: 50% 100%;
  transition:
    height 0.6s var(--ease-spring),
    background 0.4s;
  animation: rk-rise 0.9s cubic-bezier(0.25, 1.4, 0.5, 1) backwards;
}
.rk-step-third .rk-pillar {
  animation-delay: 0.05s;
}
.rk-step-second .rk-pillar {
  animation-delay: 0.18s;
}
.rk-step-first .rk-pillar {
  animation-delay: 0.32s;
}
@keyframes rk-rise {
  from {
    transform: scaleY(0);
  }
}
.rk-step.vacant .rk-pillar {
  --mc: color-mix(in srgb, var(--t3) 45%, transparent);
  box-shadow: none;
  outline: 1.5px dashed color-mix(in srgb, var(--t3) 60%, transparent);
  outline-offset: -1.5px;
}
.rk-pillar-num {
  font-size: 44px;
  line-height: 1;
  font-weight: 900;
  color: color-mix(in srgb, var(--mc) 40%, black);
  opacity: 0.55;
  text-shadow: 0 1px 0 color-mix(in srgb, white 45%, transparent);
  font-variant-numeric: tabular-nums;
}
.rk-step-first .rk-pillar-num {
  font-size: 58px;
}
.rk-pillar-shine {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -40%;
  width: 30%;
  transform: skewX(-20deg);
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, white 32%, transparent),
    transparent
  );
  animation: rk-shine 5.5s ease-in-out infinite;
}
.rk-step-second .rk-pillar-shine {
  animation-delay: 1.4s;
}
.rk-step-third .rk-pillar-shine {
  animation-delay: 2.6s;
}
@keyframes rk-shine {
  0%,
  62% {
    transform: skewX(-20deg) translateX(0);
  }
  88%,
  100% {
    transform: skewX(-20deg) translateX(560%);
  }
}

/* Crown + sparkles on #1 */
.rk-crown {
  position: absolute;
  left: 50%;
  top: -30px;
  width: 44px;
  height: 32px;
  margin-left: -22px;
  z-index: 2;
  filter: drop-shadow(0 3px 6px color-mix(in srgb, var(--gold) 60%, transparent));
  animation: rk-crown-bob 2.6s ease-in-out infinite;
}
.rk-step-first .rk-crown {
  top: -36px;
}
.rk-crown-body {
  fill: var(--gold);
  stroke: color-mix(in srgb, var(--gold) 60%, black);
  stroke-width: 1.2;
  stroke-linejoin: round;
}
.rk-crown-band {
  fill: color-mix(in srgb, var(--gold) 72%, black);
}
.rk-crown-gem {
  fill: var(--pink);
  stroke: color-mix(in srgb, white 70%, transparent);
  stroke-width: 0.8;
}
@keyframes rk-crown-bob {
  0%,
  100% {
    transform: translateY(0) rotate(-6deg);
  }
  50% {
    transform: translateY(-5px) rotate(4deg);
  }
}
.rk-spark {
  position: absolute;
  color: var(--gold);
  filter: drop-shadow(0 0 4px color-mix(in srgb, var(--gold) 80%, transparent));
  animation: rk-twinkle 1.9s ease-in-out infinite;
  pointer-events: none;
}
.rk-spark.sp1 {
  left: -26px;
  top: 6px;
}
.rk-spark.sp2 {
  left: 58px;
  top: -2px;
  font-size: 14px;
  animation-delay: 0.5s;
}
.rk-spark.sp3 {
  left: -14px;
  top: -18px;
  font-size: 9px;
  animation-delay: 0.9s;
}
.rk-spark.sp4 {
  left: 48px;
  top: 32px;
  font-size: 10px;
  animation-delay: 1.3s;
}
.rk-spark.sp5 {
  left: 20px;
  top: -26px;
  font-size: 11px;
  animation-delay: 0.25s;
}
@keyframes rk-twinkle {
  0%,
  100% {
    opacity: 0;
    transform: scale(0.3) rotate(0deg);
  }
  45% {
    opacity: 1;
    transform: scale(1) rotate(45deg);
  }
}

/* Confetti burst from above the champion */
.rk-burst {
  position: absolute;
  left: 50%;
  top: 28px;
  width: 0;
  height: 0;
  z-index: 3;
  pointer-events: none;
}
.rk-burst i {
  position: absolute;
  width: var(--w);
  height: calc(var(--w) * 1.7);
  border-radius: 2px;
  opacity: 0;
  animation: rk-confetti 1.9s cubic-bezier(0.15, 0.7, 0.3, 1) var(--d) forwards;
}
.rk-burst i.c0 {
  background: var(--gold);
}
.rk-burst i.c1 {
  background: var(--accent);
}
.rk-burst i.c2 {
  background: var(--pink);
}
.rk-burst i.c3 {
  background: var(--green);
}
@keyframes rk-confetti {
  0% {
    opacity: 1;
    transform: translate(0, 0) rotate(0deg) scale(0.3);
  }
  30% {
    opacity: 1;
    transform: translate(var(--dx), var(--dy)) rotate(calc(var(--rot) * 0.4)) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(calc(var(--dx) * 1.25), calc(var(--dy) + 240px)) rotate(var(--rot))
      scale(0.8);
  }
}

/* Podium swap: the old occupant sinks into the pillar, the new one rises */
.rk-swap-enter-active {
  transition:
    transform 0.62s cubic-bezier(0.3, 1.45, 0.5, 1) 0.2s,
    opacity 0.3s ease 0.2s;
}
.rk-swap-leave-active {
  transition:
    transform 0.34s cubic-bezier(0.5, 0, 0.9, 0.4),
    opacity 0.34s ease;
}
.rk-swap-enter-from {
  opacity: 0;
  transform: translateY(120px) scale(0.7);
}
.rk-swap-leave-to {
  opacity: 0;
  transform: translateY(150px) scale(0.85);
}

/* ── Leaderboard ── */
.rk-cols,
.rk-board {
  width: calc(100% - 32px);
  max-width: 1080px;
  margin: 0 auto;
}
.rk-cols {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 14px 8px 10px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.9px;
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--t3);
}
.rk-col-rank {
  width: 38px;
  text-align: center;
}
.rk-col-name {
  width: 262px;
  padding-left: 48px;
  flex-shrink: 0;
}
.rk-col-bar {
  flex: 1;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  overflow: hidden;
}
.rk-narrow .rk-col-name {
  width: 180px;
}
.rk-board {
  position: relative;
}
.rk-divider {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 46px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.9px;
  text-transform: uppercase;
  color: var(--t3);
  transition: transform 0.68s var(--ease-spring);
}
.rk-divider::before,
.rk-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--border) 20%,
    var(--border) 80%,
    transparent
  );
}
.rk-prep .rk-divider {
  transition: none;
}

.rk-row {
  --rc: var(--accent);
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 58px;
  padding: 4px 0;
  cursor: pointer;
  will-change: transform;
  transition: transform 0.68s var(--ease-spring) var(--dl, 0ms);
}
.rk-prep .rk-row,
.rk-prep .rk-fill,
.rk-prep .rk-val {
  transition: none !important;
}
.rk-card {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px 0 10px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--glass-soft);
  transition:
    transform 0.22s var(--ease-spring),
    background 0.15s,
    border-color 0.15s,
    box-shadow 0.2s;
}
.rk-row:hover .rk-card {
  background: var(--hover);
  transform: translateX(4px);
}
.rk-row.climbing .rk-card {
  box-shadow: 0 10px 26px -12px color-mix(in srgb, var(--rc) 60%, transparent);
}
.rk-row[class*='tier-'] .rk-card {
  border-color: color-mix(in srgb, var(--mc) 40%, transparent);
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--mc) 14%, var(--glass-soft)),
    var(--glass-soft) 45%
  );
}
.rk-row.selected .rk-card {
  border-color: var(--accent);
  box-shadow:
    0 0 0 1px var(--accent),
    0 0 22px -6px color-mix(in srgb, var(--accent) 70%, transparent);
}
.rk-row.unr .rk-card {
  opacity: 0.72;
}
.rk-row.rk-in .rk-card {
  animation: rk-row-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) var(--dl) backwards;
}
.rk-row.fresh .rk-card {
  animation: rk-row-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) var(--dl) backwards;
}
@keyframes rk-row-in {
  from {
    opacity: 0;
    transform: translateX(-26px);
  }
}

.rk-rank {
  width: 38px;
  height: 34px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 900;
  color: var(--t2);
  font-variant-numeric: tabular-nums;
}
.rk-row[class*='tier-'] .rk-rank {
  color: color-mix(in srgb, var(--mc) 35%, black);
  background: radial-gradient(
    circle at 35% 25%,
    color-mix(in srgb, var(--mc) 70%, white),
    var(--mc) 60%
  );
  box-shadow: 0 3px 10px -3px color-mix(in srgb, var(--mc) 70%, transparent);
}
.rk-rank.long {
  font-size: 13px;
}
.rk-rank.xlong {
  font-size: 11.5px;
  letter-spacing: -0.3px;
}
.rk-row.unr .rk-rank {
  color: var(--t3);
}
.rk-rank-n {
  display: inline-block;
  animation: rk-pop 0.45s var(--ease-spring) var(--dl, 0ms) backwards;
}
@keyframes rk-pop {
  from {
    opacity: 0;
    transform: scale(0.4) rotateX(80deg);
  }
}

.rk-ava {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid color-mix(in srgb, var(--rc) 60%, transparent);
  background: color-mix(in srgb, var(--rc) 20%, var(--elevated));
}
.ranks :deep(.rk-img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.rk-row.dead :deep(.rk-img) {
  filter: grayscale(0.45) sepia(0.1);
}
.ranks :deep(.rk-mono) {
  font-size: 12.5px;
  font-weight: 800;
  color: var(--t1);
}

.rk-id {
  width: 200px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.3;
}
.rk-narrow .rk-id {
  width: 120px;
}
.rk-name {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--t1);
  letter-spacing: -0.2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rk-moon {
  margin-left: 4px;
  color: var(--t3);
}
.rk-sub {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--t3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* The bar lane leaves room on the right for the value label */
.rk-track {
  position: relative;
  flex: 1;
  min-width: 60px;
  height: 24px;
}
.rk-lane {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  right: 92px;
}
.rk-narrow .rk-lane {
  right: 64px;
}
.rk-lane::before {
  content: '';
  position: absolute;
  inset: 9px 0;
  border-radius: 4px;
  background: color-mix(in srgb, var(--t3) 14%, transparent);
}
.rk-fill {
  position: absolute;
  left: 0;
  top: 2px;
  bottom: 2px;
  min-width: 6px;
  border-radius: 6px;
  overflow: hidden;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--rc) 30%, transparent),
    color-mix(in srgb, var(--rc) 88%, transparent)
  );
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 25%, transparent),
    0 0 16px -6px var(--rc);
  transition: width 0.68s cubic-bezier(0.22, 1, 0.36, 1) var(--dl, 0ms);
}
.rk-row[class*='tier-'] .rk-fill {
  background: linear-gradient(90deg, color-mix(in srgb, var(--mc) 30%, transparent), var(--mc));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 35%, transparent),
    0 0 18px -5px var(--mc);
}
.rk-row[class*='tier-'] .rk-fill::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -30%;
  width: 24%;
  transform: skewX(-20deg);
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, white 40%, transparent),
    transparent
  );
  animation: rk-bar-shine 3.6s ease-in-out infinite;
}
@keyframes rk-bar-shine {
  0%,
  55% {
    transform: skewX(-20deg) translateX(0);
  }
  90%,
  100% {
    transform: skewX(-20deg) translateX(620%);
  }
}
.rk-row.rk-in .rk-fill {
  animation: rk-grow 0.9s cubic-bezier(0.22, 1, 0.36, 1) var(--dl) backwards;
}
@keyframes rk-grow {
  from {
    width: 0;
  }
}
.rk-val {
  position: absolute;
  top: 50%;
  transform: translate(9px, -50%);
  white-space: nowrap;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--t3);
  font-variant-numeric: tabular-nums;
  transition: left 0.68s cubic-bezier(0.22, 1, 0.36, 1) var(--dl, 0ms);
}
.rk-val b {
  font-size: 13.5px;
  font-weight: 800;
  color: var(--t1);
}
.rk-row.rk-in .rk-val {
  animation: rk-slide 0.9s cubic-bezier(0.22, 1, 0.36, 1) var(--dl) backwards;
}
@keyframes rk-slide {
  from {
    left: 0;
  }
}
.rk-none {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  color: var(--t3);
  font-weight: 700;
}

.rk-tags {
  width: 190px;
  flex-shrink: 0;
  display: flex;
  gap: 5px;
  justify-content: flex-end;
  overflow: hidden;
}
.rk-tag {
  flex-shrink: 1;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
  padding: 2px 9px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--tc) 45%, transparent);
  background: color-mix(in srgb, var(--tc) 14%, transparent);
  color: var(--t1);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rk-delta-slot {
  width: 40px;
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
}
.rk-narrow .rk-delta-slot {
  width: 30px;
}
.rk-delta {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  animation: rk-delta 2.9s ease forwards;
}
.rk-delta.up {
  color: var(--green);
  background: color-mix(in srgb, var(--green) 16%, transparent);
}
.rk-delta.down {
  color: var(--pink);
  background: color-mix(in srgb, var(--pink) 16%, transparent);
}
.rk-delta.new {
  color: var(--accent);
  background: var(--adim);
}
@keyframes rk-delta {
  0% {
    opacity: 0;
    transform: scale(0.4);
  }
  12% {
    opacity: 1;
    transform: scale(1.15);
  }
  20%,
  78% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.8);
  }
}

/* ── Empty state ── */
.rk-empty {
  position: absolute;
  inset: 60px 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--t2);
  pointer-events: none;
}
.rk-empty-icon {
  display: flex;
  color: var(--t3);
}
.rk-empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--t1);
}
.rk-empty-text {
  font-size: 13px;
  max-width: 280px;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .rk-rays,
  .rk-pillar,
  .rk-pillar-shine,
  .rk-crown,
  .rk-spark,
  .rk-burst i,
  .rk-row .rk-card,
  .rk-rank-n,
  .rk-fill,
  .rk-fill::after,
  .rk-val,
  .rk-delta {
    animation: none !important;
  }
  .rk-row,
  .rk-fill,
  .rk-val,
  .rk-divider,
  .rk-glide,
  .rk-pillar,
  .rk-swap-enter-active,
  .rk-swap-leave-active {
    transition: none !important;
  }
  .rk-spark {
    opacity: 0.8;
  }
}
</style>
