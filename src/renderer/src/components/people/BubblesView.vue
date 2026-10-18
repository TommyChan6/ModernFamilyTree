<template>
  <div
    ref="rootEl"
    class="bubbles"
    :class="{ panning, busy: busy, still: reduceMotion }"
    :style="rootVars"
    @pointerdown="onDown"
    @wheel.prevent="onWheel"
    @pointerover="onOver"
    @pointerout="onOut"
  >
    <div v-if="!persons.length" class="bb-empty">
      <div class="bb-empty-icon">
        <i></i>
        <i></i>
        <i></i>
      </div>
      <div class="bb-empty-title">{{ t('directory.bubbles.emptyTitle') }}</div>
      <div class="bb-empty-text">{{ t('directory.bubbles.emptyText') }}</div>
    </div>

    <template v-else>
      <div class="bb-glow" aria-hidden="true"></div>

      <!-- World: one transform (camera) over group circles + person bubbles -->
      <div ref="worldEl" class="bb-world">
        <TransitionGroup
          tag="div"
          class="bb-groups"
          name="bgrp"
          :duration="{ enter: 1100, leave: 500 }"
        >
          <div
            v-for="g in layout.groups"
            :key="groupMode + ':' + g.key"
            class="bgrp"
            :class="{ focus: focusKey === g.key }"
            :data-g="g.key"
            :style="{ '--gc': g.color, '--gi': g.index }"
          >
            <!-- Position lives on an inner element: TransitionGroup's FLIP
                 pass would otherwise clear the transform on its children. -->
            <div class="bgrp-pos" :style="{ transform: groupTransform(g) }">
              <div class="bgrp-in"></div>
            </div>
          </div>
        </TransitionGroup>

        <div ref="layerEl" class="bb-layer">
          <div
            v-for="b in visible"
            :key="b.id"
            class="bb"
            :class="[b.tier, { sel: store.selectedPersonId === b.id, dead: b.dead }]"
            :data-id="b.id"
            :style="b.vars"
          >
            <div v-if="b.tier === 'dot'" class="bb-dot"></div>
            <div v-else class="bb-nudge">
              <div class="bb-bob">
                <div class="bb-body">
                  <BubbleArt :person="b.p" :size="b.tier === 'lg' ? 192 : 96" />
                  <div v-if="b.tier !== 'sm'" class="bb-label">
                    <span class="bb-name">{{ b.p.name || t('directory.bubbles.unnamed') }}</span>
                    <span v-if="b.tier === 'lg'" class="bb-sub">{{ lifeText(b.p) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Group labels, arced over each group's rim (screen space, crisp) -->
      <svg ref="labelsEl" class="bb-labels" :class="{ relabel }" aria-hidden="true">
        <g v-for="(g, i) in layout.groups" :key="groupMode + ':' + g.key" :data-i="i">
          <path :id="uid + '-' + i" fill="none" />
          <text :style="{ '--gc': g.color }" :class="{ focus: focusKey === g.key }">
            <textPath :href="'#' + uid + '-' + i" startOffset="50%" text-anchor="middle">
              {{ labelOf(g) }}
              <tspan class="bb-lab-n">{{ g.count }}</tspan>
            </textPath>
          </text>
        </g>
      </svg>

      <!-- Controls -->
      <div class="bb-bar" @pointerdown.stop @wheel.stop>
        <div class="bb-seg">
          <span class="bb-seg-k">{{ t('directory.bubbles.size') }}</span>
          <button
            v-for="m in SIZE_MODES"
            :key="m.id"
            class="bb-seg-b"
            :class="{ on: sizeMode === m.id }"
            @click="setSize(m.id)"
          >
            {{ t(`directory.bubbles.sizeModes.${m.id}`) }}
          </button>
        </div>
        <div class="bb-seg">
          <span class="bb-seg-k">{{ t('directory.bubbles.group') }}</span>
          <button
            v-for="m in GROUP_MODES"
            :key="m.id"
            class="bb-seg-b"
            :class="{ on: groupMode === m.id }"
            @click="setGroup(m.id)"
          >
            {{ t(`directory.bubbles.groupModes.${m.id}`) }}
          </button>
        </div>
      </div>

      <Transition name="bb-fade">
        <button v-if="focusGroup" class="bb-crumb" @pointerdown.stop @click="fitAll()">
          <span class="bb-crumb-back"
            ><UiIcon name="chevron-left" :size="14" />{{ t('directory.bubbles.everyone') }}</span
          >
          <span class="bb-crumb-sep">/</span>
          <span class="bb-crumb-dot" :style="{ '--gc': focusGroup.color }"></span>
          {{ labelOf(focusGroup) }}
          <span class="bb-crumb-n">{{ focusGroup.count }}</span>
        </button>
      </Transition>

      <div class="bb-zoom" @pointerdown.stop @wheel.stop>
        <button
          class="bb-zoom-b"
          :title="t('directory.bubbles.zoomIn')"
          :aria-label="t('directory.bubbles.zoomIn')"
          @click="zoomBy(1 / 1.6)"
        >
          <UiIcon name="plus" :size="14" />
        </button>
        <button
          class="bb-zoom-b"
          :title="t('directory.bubbles.zoomOut')"
          :aria-label="t('directory.bubbles.zoomOut')"
          @click="zoomBy(1.6)"
        >
          <UiIcon name="minus" :size="14" />
        </button>
        <button
          class="bb-zoom-b bb-zoom-fit"
          :title="t('directory.bubbles.fitTitle')"
          :aria-label="t('directory.bubbles.fitAria')"
          @click="fitAll()"
        >
          <UiIcon name="maximize" :size="14" />
        </button>
      </div>

      <div class="bb-foot">
        <span class="bb-foot-n">{{ persons.length }}</span>
        {{ countWord('people', persons.length) }}
        <template v-if="layout.groups.length">
          · <span class="bb-foot-n">{{ layout.groups.length }}</span>
          {{ countWord('groups', layout.groups.length) }}
        </template>
        <span class="bb-foot-hint">{{ t('directory.bubbles.footHint') }}</span>
      </div>

      <!-- Hover card -->
      <Transition name="bb-tip">
        <div
          v-if="tip"
          :key="tip.id"
          class="bb-tip"
          :class="{ below: tip.below }"
          :style="{ left: tip.x + 'px', top: tip.y + 'px', '--c': tip.color }"
        >
          <div class="bb-tip-name">{{ tip.name }}</div>
          <div class="bb-tip-sub">
            {{ tip.years
            }}<template v-if="tip.dead">
              ·
              <UiIcon name="moon" :size="11" :label="t('directory.bubbles.deceased')" />
            </template>
          </div>
          <div v-if="tip.metric || tip.group" class="bb-tip-row">
            <span v-if="tip.metric" class="bb-tip-metric">{{ tip.metric }}</span>
            <span v-if="tip.group" class="bb-tip-group" :style="{ '--gc': tip.groupColor }">
              {{ tip.group }}
            </span>
          </div>
        </div>
      </Transition>
    </template>
  </div>
</template>

<script setup>
import {
  ref,
  shallowRef,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
  h,
  getCurrentInstance
} from 'vue'
import { interpolateZoom } from 'd3'
import { useMainStore } from '../../store/index.js'
import { isDeceased, ageOf } from './peopleLayout.js'
import { useThumbnail } from './useThumbnail.js'
import UiIcon from '../ui/UiIcon.js'
import { useI18n } from '../../i18n'
import { genderLabel, defaultNameLabel } from '../../lib/dataLabels'
import {
  SIZE_MODES,
  GROUP_MODES,
  radiiFor,
  groupPersons,
  packLayout,
  viewToTransform,
  fitBounds,
  circleOnScreen,
  tierOf,
  springEasing
} from './bubblesLayout.js'

// Bubbles: a zoomable packed-circle chart of everyone. Each person is a
// bubble sized by a metric and packed inside a circle for their group; the
// group circles are packed together. The camera is ONE transform on a world
// container (written straight to the DOM, no Vue reactivity per frame);
// bubbles outside the viewport are culled and bubbles tiny on screen render as
// bare dots (LOD). Layout changes fly every bubble to its new spot with a CSS
// spring (a sampled `linear()` easing the compositor runs on its own).

const props = defineProps({
  persons: { type: Array, required: true },
  statsOf: { type: Function, required: true },
  refYear: { type: Number, required: true }
})

const store = useMainStore()
const { t, locale } = useI18n()
const rootEl = ref(null)
const worldEl = ref(null)
const layerEl = ref(null)
const labelsEl = ref(null)
const uid = 'bbl' + (getCurrentInstance()?.uid ?? Math.floor(Math.random() * 1e6))

const reduceMotion =
  typeof window !== 'undefined' &&
  !!window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const hasLinear =
  typeof CSS !== 'undefined' && CSS.supports?.('transition-timing-function', 'linear(0, 1)')
const EASE_MOVE = hasLinear ? springEasing(0.62, 10) : 'cubic-bezier(0.34, 1.35, 0.5, 1)'
const EASE_POP = hasLinear ? springEasing(0.46, 12) : 'cubic-bezier(0.34, 1.7, 0.5, 1)'
const MOVE_MS = 900
const POP_MS = 820
const rootVars = { '--ease-move': EASE_MOVE, '--ease-pop': EASE_POP }

// Bubble art: cached thumbnail or monogram (own component so each visible
// bubble owns its reactive thumbnail).
const BubbleArt = {
  props: {
    person: { type: Object, required: true },
    size: { type: Number, default: 96 }
  },
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
        ? h('img', { class: 'bb-img', src: src.value, alt: '', draggable: false })
        : h('span', { class: 'bb-mono' }, initials.value)
  }
}

// ── Remembered controls ─────────────────────────────────────────────────────
const LS_SIZE = 'ft.bubbles.size'
const LS_GROUP = 'ft.bubbles.group'
function readLS(key, allowed, fallback) {
  try {
    const v = localStorage.getItem(key)
    return allowed.some((m) => m.id === v) ? v : fallback
  } catch {
    return fallback
  }
}
function writeLS(key, v) {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* storage unavailable — the choice just isn't remembered */
  }
}
const sizeMode = ref(readLS(LS_SIZE, SIZE_MODES, 'kin'))
const groupMode = ref(readLS(LS_GROUP, GROUP_MODES, 'gender'))
function setSize(id) {
  sizeMode.value = id
  writeLS(LS_SIZE, id)
}
function setGroup(id) {
  groupMode.value = id
  writeLS(LS_GROUP, id)
}

// ── Helpers ─────────────────────────────────────────────────────────────────
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
  if (b != null) return t('directory.bubbles.born', { year: b })
  if (d != null) return t('directory.bubbles.died', { year: d })
  return t('directory.bubbles.datesUnknown')
}

// English singular/plural picked here; other locales may share one form.
const plural = (key, n, params) => t(`${key}.${n === 1 ? 'one' : 'other'}`, params)
const countWord = (key, n) => plural(`directory.bubbles.foot.${key}`, n)

function metricText(p) {
  const m = sizeMode.value
  if (m === 'equal') return ''
  if (m === 'age') {
    const a = ageOf(p, props.refYear)
    return a == null
      ? t('directory.bubbles.metric.ageUnknown')
      : t('directory.bubbles.metric.age', { n: a })
  }
  const s = props.statsOf(p.id) || { kin: 0, children: 0 }
  if (m === 'children') {
    return plural('directory.bubbles.metric.children', s.children, { n: s.children })
  }
  return plural('directory.bubbles.metric.connections', s.kin, { n: s.kin })
}

// Group display names. bubblesLayout stays language-neutral (its English
// labels are asserted by tests), so the view translates by group key here.
function groupLabel(g, mode) {
  const k = g.key || ''
  const G = 'directory.bubbles.groups.'
  if (mode === 'gender') {
    if (k === 'female') return genderLabel('Female')
    if (k === 'male') return genderLabel('Male')
    if (k === 'other') return t(G + 'other')
  } else if (mode === 'life') {
    if (k === 'dead') return t(G + 'deceased')
    if (k === 'alive') return t(G + 'living')
  } else if (mode === 'decade') {
    if (k === 'none') return t(G + 'unknownBirth')
    if (k.startsWith('d')) return t(G + 'decade', { n: k.slice(1) })
  } else if (mode === 'tag') {
    if (k === 'none') return t(G + 'ungrouped')
    const tag = store.tags.find((x) => 't' + x.id === k)
    if (tag && !tag.label) return t('directory.bubbles.groupModes.tag')
    return defaultNameLabel(g.label)
  } else if (mode === 'family') {
    if (k === 'solo') return t(G + 'unconnected')
    const named = /^(.+) family$/.exec(g.label || '')
    if (named) return t(G + 'surnameFamily', { name: named[1] })
    const numbered = /^Family (\d+)$/.exec(g.label || '')
    if (numbered) return t(G + 'familyN', { n: numbered[1] })
  }
  return g.label
}

// Stable 0..1 phase per id so each bubble bobs out of step with its neighbours.
function phaseOf(id) {
  let x = 0
  for (let i = 0; i < id.length; i++) x = (x * 31 + id.charCodeAt(i)) | 0
  return ((x >>> 0) % 1000) / 1000
}

function groupTransform(g) {
  return `translate(${(g.x - 100).toFixed(2)}px, ${(g.y - 100).toFixed(2)}px) scale(${(g.r / 100).toFixed(4)})`
}

// ── Layout (recomputed on data/control changes only) ────────────────────────
const layout = shallowRef({
  nodes: new Map(),
  groups: [],
  root: { x: 0, y: 0, r: 1 },
  bounds: { x0: -1, y0: -1, x1: 1, y1: 1 },
  maxR: 30
})
const layoutMode = ref(groupMode.value) // the group mode `layout` was built with
const meta = new Map() // id → { color, dead, phase }
let version = 0
let trans = null // { version, start, total, from: Map, delays: Map }
let transTimer = 0
let labelTimer = 0
const relabel = ref(false)
let laidOut = false

function relayout(reason) {
  const prev = layout.value
  const list = props.persons
  const groups = groupPersons(list, groupMode.value, {
    tagsOf: store.tagsOf,
    relationships: store.relationships,
    refYear: props.refYear,
    colors: {
      male: store.graphSettings.maleColor,
      female: store.graphSettings.femaleColor,
      unknown: store.graphSettings.unknownColor
    }
  })
  const radii = radiiFor(list, sizeMode.value, props.statsOf, props.refYear)
  const next = packLayout(groups, radii)

  meta.clear()
  for (const p of list) {
    meta.set(p.id, {
      color: genderColor(p),
      dead: isDeceased(p, props.refYear),
      phase: phaseOf(p.id)
    })
  }

  version++
  clearTimeout(transTimer)
  clearTimeout(labelTimer)
  if (reduceMotion) {
    trans = null
  } else {
    const entrance = reason === 'enter'
    const nG = Math.max(1, next.groups.length)
    const gStep = entrance ? Math.min(150, 1100 / nG) : Math.min(40, 360 / nG)
    const iStep = entrance ? 7 : 2.5
    const iCap = entrance ? 420 : 220
    const many = next.nodes.size > 1500
    const from = new Map()
    const delays = new Map()
    let maxDelay = 0
    next.nodes.forEach((n, id) => {
      const o = entrance ? null : prev.nodes.get(id)
      if (o) from.set(id, { x: o.x, y: o.y, r: o.r, fresh: false })
      else {
        const g = next.groups[n.gi] || next.root
        from.set(id, { x: g.x, y: g.y, r: 0.002, fresh: true })
      }
      const d = many ? n.gi * gStep * 0.5 : n.gi * gStep + Math.min(n.ii * iStep, iCap)
      delays.set(id, d)
      if (d > maxDelay) maxDelay = d
    })
    trans = {
      version,
      start: performance.now(),
      total: maxDelay + Math.max(MOVE_MS, POP_MS) + 60,
      from,
      delays
    }
    relabel.value = true
    const mine = trans
    labelTimer = setTimeout(
      () => (relabel.value = false),
      Math.min(trans.total, 950 + maxDelay * 0.5)
    )
    transTimer = setTimeout(() => {
      if (trans !== mine) return
      trans = null
      lastSig = null // drop the old-position union from the culling
      requestFrame()
    }, trans.total)
  }
  layoutMode.value = groupMode.value
  layout.value = next
  lastSig = null
  hideTip()

  if (!next.nodes.size) {
    // Empty roster: leave the camera alone; the next roster re-enters fresh.
    atFit = true
    focusKey.value = null
  } else if (!laidOut || atFit || reason === 'enter') {
    const target = fitBounds(next.bounds, W || 800, H || 600, FIT_MARGIN)
    if (!laidOut || reason === 'enter' || reduceMotion) setView(target)
    else tweenTo(target)
    atFit = true
    focusKey.value = null
  } else if (focusKey.value && !next.groups.some((g) => g.key === focusKey.value)) {
    focusKey.value = null
  }
  laidOut = true
  requestFrame()
}

// Translated group labels (key → text). Reads the active locale through t(),
// so a language switch recomputes it; the layout's mode is captured per layout.
const groupLabels = computed(() => {
  const m = new Map()
  const mode = layoutMode.value
  for (const g of layout.value.groups) m.set(g.key, groupLabel(g, mode))
  return m
})
const labelOf = (g) => (g ? (groupLabels.value.get(g.key) ?? g.label) : '')

const focusKey = ref(null)
const focusGroup = computed(() =>
  focusKey.value ? layout.value.groups.find((g) => g.key === focusKey.value) || null : null
)

// ── Camera ──────────────────────────────────────────────────────────────────
const FIT_MARGIN = { t: 96, r: 44, b: 52, l: 44 }
let W = 0
let H = 0
let view = { cx: 0, cy: 0, w: 1 }
let camAnim = null // { kind: 'tween', interp, start, dur } | { kind: 'ease', target }
let atFit = true
let raf = 0

function setView(v) {
  view = { cx: v.cx, cy: v.cy, w: v.w }
  camAnim = null
}
function tweenTo(target) {
  if (reduceMotion) {
    setView(target)
    requestFrame()
    return
  }
  const interp = interpolateZoom([view.cx, view.cy, view.w], [target.cx, target.cy, target.w])
  camAnim = {
    kind: 'tween',
    interp,
    start: performance.now(),
    dur: Math.max(450, Math.min(1150, interp.duration * 0.75))
  }
  requestFrame()
}
function wLimits() {
  const fit = fitBounds(layout.value.bounds, W || 800, H || 600, FIT_MARGIN)
  // Deepest zoom: the biggest bubble spans ~3/4 of the short side.
  return { min: Math.max(60, (2 * layout.value.maxR) / 0.75), max: Math.max(fit.w * 2.5, 400) }
}
function clampW(w) {
  const { min, max } = wLimits()
  return Math.max(min, Math.min(max, w))
}
function fitAll() {
  focusKey.value = null
  atFit = true
  hideTip()
  tweenTo(fitBounds(layout.value.bounds, W, H, FIT_MARGIN))
}
function zoomToGroup(key) {
  const g = layout.value.groups.find((x) => x.key === key)
  if (!g) return
  if (focusKey.value === key) {
    fitAll()
    return
  }
  focusKey.value = key
  atFit = false
  hideTip()
  const b = { x0: g.x - g.r, y0: g.y - g.r, x1: g.x + g.r, y1: g.y + g.r }
  tweenTo(fitBounds(b, W, H, { t: 84, r: 40, b: 60, l: 40 }))
}
function zoomBy(f) {
  const base = camAnim?.kind === 'ease' ? camAnim.target : view
  const w = clampW(base.w * f)
  camAnim = { kind: 'ease', target: { cx: base.cx, cy: base.cy, w } }
  atFit = false
  hideTip()
  requestFrame()
}

function requestFrame() {
  if (!raf) raf = requestAnimationFrame(frame)
}
function frame(now) {
  raf = 0
  let moving = false
  if (camAnim?.kind === 'tween') {
    const t = Math.min(1, (now - camAnim.start) / camAnim.dur)
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    const [cx, cy, w] = camAnim.interp(e)
    view = { cx, cy, w }
    if (t >= 1) camAnim = null
    else moving = true
  } else if (camAnim?.kind === 'ease') {
    const tg = camAnim.target
    const a = 0.24
    view = {
      cx: view.cx + (tg.cx - view.cx) * a,
      cy: view.cy + (tg.cy - view.cy) * a,
      w: view.w * Math.pow(tg.w / view.w, a)
    }
    const done =
      Math.abs(tg.w / view.w - 1) < 0.002 &&
      Math.abs(tg.cx - view.cx) * (Math.min(W, H) / view.w) < 0.3 &&
      Math.abs(tg.cy - view.cy) * (Math.min(W, H) / view.w) < 0.3
    if (done) {
      view = { ...tg }
      camAnim = null
    } else moving = true
  }
  applyCamera()
  if (moving) requestFrame()
}

// While the camera moves, idle bobbing is switched off: Chrome rasterizes an
// element with a running transform animation at a fixed scale, so bubbles
// would stay blurry after a zoom. The bob restarts (from rest) once settled.
let lastWorldTf = ''
let lastWorldEl = null
let movingTimer = 0
function markMoving() {
  const root = rootEl.value
  if (!root) return
  if (!('moving' in root.dataset)) root.dataset.moving = ''
  clearTimeout(movingTimer)
  movingTimer = setTimeout(() => {
    if (rootEl.value) delete rootEl.value.dataset.moving
    lastSig = null // settle: re-cull with the true LOD tiers
    requestFrame()
  }, 220)
}

function applyCamera() {
  const world = worldEl.value
  if (!world || !W) return
  const t = viewToTransform(view, W, H)
  const str = `translate(${t.tx.toFixed(2)}px, ${t.ty.toFixed(2)}px) scale(${t.k.toFixed(5)})`
  if (str !== lastWorldTf || world !== lastWorldEl) {
    if (lastWorldTf && world === lastWorldEl) markMoving()
    lastWorldTf = str
    lastWorldEl = world
    world.style.transform = str
  }
  cull(t)
  updateScaleVars(t)
  updateLabels(t)
}

// ── Culling + LOD ───────────────────────────────────────────────────────────
const visible = shallowRef([])
const busy = computed(() => visible.value.length > 360)
let lastSig = null
const prevTiers = new Map() // id → tier of the last built visible list
const TIER_N = { dot: 1, sm: 2, md: 3, lg: 4 }

function cull(t) {
  const lay = layout.value
  const pad = 140
  const active = trans && trans.version === version
  let sig = version * 7919
  let i = 0
  let count = 0
  const keep = []
  const moving = !!rootEl.value && 'moving' in rootEl.value.dataset
  for (const n of lay.nodes.values()) {
    i++
    let on = circleOnScreen(n.x, n.y, n.r, t, W, H, pad)
    if (!on && active) {
      const f = trans.from.get(n.id)
      if (f && !f.fresh) on = circleOnScreen(f.x, f.y, f.r, t, W, H, pad)
    }
    if (!on) continue
    // Mid-gesture, bubbles keep the LOD they had (the world transform scales
    // them anyway) so zooming doesn't rebuild subtrees every frame; the real
    // tiers land once the camera settles.
    const tier = (moving && prevTiers.get(n.id)) || tierOf(2 * n.r * t.k)
    sig = (Math.imul(sig, 31) + i * 5 + TIER_N[tier]) | 0
    count++
    keep.push(n, tier)
  }
  sig = (sig + count * 131) | 0
  if (sig === lastSig) return
  lastSig = sig
  const out = new Array(keep.length / 2)
  prevTiers.clear()
  for (let j = 0; j < keep.length; j += 2) {
    const n = keep[j]
    prevTiers.set(n.id, keep[j + 1])
    const m = meta.get(n.id) || { color: 'var(--accent)', dead: false, phase: 0 }
    out[j / 2] = {
      id: n.id,
      p: n.p,
      tier: keep[j + 1],
      dead: m.dead,
      vars: { '--c': m.color, '--r': n.r, '--ph': m.phase }
    }
  }
  visible.value = out
}

// Labels / rings are counter-scaled so text stays ~12px on screen whatever the
// zoom: --ls = local px per screen px, written only on labeled bubbles.
let labeledEls = []
function updateScaleVars(t) {
  const lay = layout.value
  for (const el of labeledEls) {
    const n = lay.nodes.get(el.dataset.id)
    if (n) el.style.setProperty('--ls', (50 / (n.r * t.k)).toFixed(4))
  }
  const groupsEl = worldEl.value?.firstElementChild
  if (groupsEl) {
    for (const el of groupsEl.children) {
      const g = lay.groups.find((x) => x.key === el.dataset.g)
      if (g) el.style.setProperty('--gls', (100 / (g.r * t.k)).toFixed(4))
    }
  }
}

// Arc every group's label over its rim. Greedy de-clutter: biggest groups on
// screen claim their label box first; a label that would collide with one
// already placed (or doesn't fit its arc) is hidden until you zoom closer.
function updateLabels(t) {
  const svg = labelsEl.value
  if (!svg) return
  const groups = layout.value.groups
  const cands = []
  for (const gEl of svg.children) {
    const g = groups[Number(gEl.dataset.i)]
    if (!g) continue
    const sx = g.x * t.k + t.tx
    const sy = g.y * t.k + t.ty
    const R = g.r * t.k + 7
    gEl.firstElementChild.setAttribute(
      'd',
      `M ${(sx - R).toFixed(1)} ${sy.toFixed(1)} A ${R.toFixed(1)} ${R.toFixed(1)} 0 0 1 ${(sx + R).toFixed(1)} ${sy.toFixed(1)}`
    )
    const need = (textUnits(labelOf(g)) + String(g.count).length + 3) * 7.4
    const top = sy - R
    const ok =
      R > 30 && Math.PI * R * 0.8 > need && top < H + 20 && top > -40 && sx > -R && sx < W + R
    if (!ok) {
      gEl.classList.add('hid')
      continue
    }
    const half = Math.min(Math.PI / 2, need / R / 2) // half the arc angle the text spans
    cands.push({
      gEl,
      pri: (g.key === focusKey.value ? 1e9 : 0) + R,
      x0: sx - R * Math.sin(half) - 4,
      x1: sx + R * Math.sin(half) + 4,
      y0: top - 13,
      y1: sy - R * Math.cos(half) + 3
    })
  }
  cands.sort((a, b) => b.pri - a.pri)
  const placed = []
  for (const c of cands) {
    const hit = placed.some((p) => c.x0 < p.x1 && c.x1 > p.x0 && c.y0 < p.y1 && c.y1 > p.y0)
    c.gEl.classList.toggle('hid', hit)
    if (!hit) placed.push(c)
  }
}

// Rough label width in Latin-character units: CJK glyphs are ~1.7× wider.
function textUnits(s) {
  let n = 0
  for (const ch of s) n += ch.charCodeAt(0) >= 0x2e80 ? 1.7 : 1
  return n
}

// ── Imperative transforms (after Vue has patched the bubble layer) ──────────
const tf = (x, y, r) =>
  `translate(${(x - 50).toFixed(2)}px, ${(y - 50).toFixed(2)}px) scale(${(r / 50).toFixed(4)})`
const elById = new Map()

function applyTransforms() {
  const layer = layerEl.value
  if (!layer) return
  const lay = layout.value
  const now = performance.now()
  const active = trans && trans.version === version && now < trans.start + trans.total
  const flips = []
  elById.clear()
  labeledEls = []
  for (const el of layer.children) {
    const id = el.dataset.id
    elById.set(id, el)
    if (el.classList.contains('md') || el.classList.contains('lg')) labeledEls.push(el)
    if (el.__bbV === version) continue
    const n = lay.nodes.get(id)
    if (!n) continue
    const fresh = el.__bbV === undefined
    el.__bbV = version
    const to = tf(n.x, n.y, n.r)
    const f = active ? trans.from.get(id) : null
    if (!f) {
      el.style.transition = 'none'
      el.style.transform = to
      continue
    }
    const elapsed = now - trans.start
    const delay = Math.max(0, (trans.delays.get(id) || 0) - elapsed)
    const trn = f.fresh
      ? `transform ${POP_MS}ms var(--ease-pop) ${delay.toFixed(0)}ms`
      : `transform ${MOVE_MS}ms var(--ease-move) ${delay.toFixed(0)}ms`
    if (fresh) {
      el.style.transition = 'none'
      el.style.transform = tf(f.x, f.y, f.r)
      flips.push(el, to, trn)
    } else {
      el.style.transition = trn
      el.style.transform = to
    }
  }
  if (flips.length) {
    void layer.offsetWidth // commit the "from" transforms before transitioning
    for (let i = 0; i < flips.length; i += 3) {
      flips[i].style.transition = flips[i + 2]
      flips[i].style.transform = flips[i + 1]
    }
  }
  if (W) {
    const t = viewToTransform(view, W, H)
    updateScaleVars(t)
    updateLabels(t)
  }
}
watch([visible, layout], applyTransforms, { flush: 'post' })

// ── Pointer: pan / click / hover ────────────────────────────────────────────
const panning = ref(false)
let down = null

function onDown(e) {
  if (e.button !== 0) return
  down = {
    x: e.clientX,
    y: e.clientY,
    lx: e.clientX,
    ly: e.clientY,
    target: e.target,
    moved: false
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}
function onMove(e) {
  if (!down) return
  if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) {
    down.moved = true
    panning.value = true
    hideTip()
    clearNudge()
  }
  if (!down.moved) return
  const k = Math.min(W, H) / view.w
  view = {
    cx: view.cx - (e.clientX - down.lx) / k,
    cy: view.cy - (e.clientY - down.ly) / k,
    w: view.w
  }
  camAnim = null
  atFit = false
  down.lx = e.clientX
  down.ly = e.clientY
  requestFrame()
}
function onUp() {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
  const d = down
  down = null
  panning.value = false
  if (!d || d.moved) return
  const target = d.target instanceof Element ? d.target : null
  const bb = target?.closest('.bb')
  if (bb) {
    store.selectPerson(bb.dataset.id)
    return
  }
  const g = target?.closest('.bgrp')
  if (g) {
    zoomToGroup(g.dataset.g)
    return
  }
  if (!atFit) fitAll()
}

function onWheel(e) {
  const root = rootEl.value
  if (!root || !W) return
  const rect = root.getBoundingClientRect()
  const px = e.clientX - rect.left
  const py = e.clientY - rect.top
  const base = camAnim?.kind === 'ease' ? camAnim.target : view
  const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
  const w = clampW(base.w * Math.exp(Math.max(-60, Math.min(60, dy)) * 0.0045))
  const ff = w / base.w
  const t = viewToTransform(base, W, H)
  const wx = (px - t.tx) / t.k
  const wy = (py - t.ty) / t.k
  camAnim = {
    kind: 'ease',
    target: { cx: wx + (base.cx - wx) * ff, cy: wy + (base.cy - wy) * ff, w }
  }
  atFit = false
  if (ff > 1 && focusKey.value) focusKey.value = null
  hideTip()
  clearNudge()
  requestFrame()
}

// Hover: tooltip card + neighbours nudged aside (direct DOM, ≤ 16 bubbles).
const tip = ref(null)
let hoverId = null
let nudged = []

function hideTip() {
  if (tip.value) tip.value = null
  hoverId = null
}
function clearNudge() {
  for (const el of nudged) {
    const inner = el.firstElementChild
    if (inner) inner.style.transform = ''
  }
  nudged = []
}
function onOver(e) {
  if (down?.moved || camAnim) return
  const bb = e.target instanceof Element ? e.target.closest('.bb') : null
  if (!bb || bb.dataset.id === hoverId) return
  setHover(bb.dataset.id)
}
function onOut(e) {
  if (!hoverId) return
  const to = e.relatedTarget instanceof Element ? e.relatedTarget.closest('.bb') : null
  if (to && to.dataset.id === hoverId) return
  if (to) return // pointerover on the new bubble takes over
  hideTip()
  clearNudge()
}

function setHover(id) {
  const lay = layout.value
  const n = lay.nodes.get(id)
  if (!n) return
  hoverId = id
  const vt = viewToTransform(view, W, H)
  const sx = n.x * vt.k + vt.tx
  const sr = n.r * vt.k * 1.18
  const top = n.y * vt.k + vt.ty - sr
  const below = top < 110
  const g = lay.groups[n.gi]
  const m = meta.get(id)
  tip.value = {
    id,
    name: n.p.name || t('directory.bubbles.unnamed'),
    years: lifeText(n.p),
    dead: !!m?.dead,
    metric: metricText(n.p),
    group: g ? labelOf(g) : '',
    groupColor: g ? g.color : '',
    color: m?.color || 'var(--accent)',
    x: Math.max(110, Math.min(W - 110, sx)),
    y: below ? n.y * vt.k + vt.ty + sr + 10 : top - 10,
    below
  }

  // Nudge overlapping-ish neighbours in the same group away from the swell.
  clearNudge()
  if (reduceMotion) return
  let cand = []
  for (const o of lay.nodes.values()) {
    if (o === n || o.gi !== n.gi) continue
    const dist = Math.hypot(o.x - n.x, o.y - n.y)
    const gap = dist - n.r - o.r
    if (gap < n.r * 0.9) cand.push([o, dist, gap])
  }
  cand.sort((a, b) => a[2] - b[2])
  cand = cand.slice(0, 16)
  for (const [o, dist, gap] of cand) {
    const el = elById.get(o.id)
    const inner = el?.firstElementChild
    if (!inner || !inner.classList.contains('bb-nudge')) continue
    const fall = 1 - Math.max(0, gap) / (n.r * 0.9)
    const push = Math.min(n.r * 0.2, 12) * fall
    const ux = dist ? (o.x - n.x) / dist : 0
    const uy = dist ? (o.y - n.y) / dist : 0
    const local = 50 / o.r
    inner.style.transform = `translate(${(ux * push * local).toFixed(2)}px, ${(uy * push * local).toFixed(2)}px)`
    nudged.push(el)
  }
}

// ── Keyboard ────────────────────────────────────────────────────────────────
function onKeydown(e) {
  if (!rootEl.value || !rootEl.value.getClientRects().length) return // view hidden
  if (store.modalOpen || store.formOpen || store.curtain?.active) return
  if (store.appSettingsOpen || store.userPageOpen || store.projectsPageOpen || store.browsePageOpen)
    return
  const t = e.target
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
  if (t?.isContentEditable) return
  if (e.key === 'Escape' && !atFit) {
    e.preventDefault()
    fitAll()
  } else if (e.key === '+' || e.key === '=') {
    zoomBy(1 / 1.4)
  } else if (e.key === '-' || e.key === '_') {
    zoomBy(1.4)
  }
}

// ── Lifecycle ───────────────────────────────────────────────────────────────
let ro = null
function remeasure() {
  const el = rootEl.value
  if (!el) return
  const nw = el.clientWidth
  const nh = el.clientHeight
  if (!nw || !nh) return
  const first = !W
  W = nw
  H = nh
  if (first && !laidOut) relayout('enter')
  else if (atFit) setView(fitBounds(layout.value.bounds, W, H, FIT_MARGIN))
  lastSig = null
  requestFrame()
}

onMounted(() => {
  // Capture phase: see Esc while the profile modal is still open (its own
  // listener closes it first otherwise, and Esc would also zoom out here).
  window.addEventListener('keydown', onKeydown, true)
  ro = new ResizeObserver(remeasure)
  if (rootEl.value) ro.observe(rootEl.value)
  nextTick(remeasure)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown, true)
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
  ro?.disconnect()
  if (raf) cancelAnimationFrame(raf)
  clearTimeout(transTimer)
  clearTimeout(labelTimer)
  clearTimeout(movingTimer)
})

watch(
  () => [
    props.persons,
    props.refYear,
    store.relationships,
    store.tagsOf,
    store.graphSettings.maleColor,
    store.graphSettings.femaleColor,
    store.graphSettings.unknownColor
  ],
  () => {
    if (!W) return
    // Remounting into a non-empty roster (after the empty state) replays the entrance.
    relayout(layout.value.nodes.size ? 'data' : 'enter')
  }
)
watch([sizeMode, groupMode], () => {
  if (W) relayout('mode')
})
// Language switch: drop the (English-built) hover card and refit the arced
// group labels, whose widths change with the translation.
watch(locale, () => {
  hideTip()
  nextTick(() => {
    if (W) updateLabels(viewToTransform(view, W, H))
  })
})
// The world/labels elements come and go with the empty state.
watch(
  () => props.persons.length > 0,
  (has) => {
    if (has) nextTick(remeasure)
  }
)
</script>

<style scoped>
.bubbles {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  touch-action: none;
  contain: strict;
}
.bubbles.panning {
  cursor: grabbing;
}

.bb-glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(
      60% 55% at 50% 48%,
      color-mix(in srgb, var(--accent) 9%, transparent),
      transparent 70%
    ),
    radial-gradient(
      40% 40% at 18% 85%,
      color-mix(in srgb, var(--pink) 5%, transparent),
      transparent 70%
    );
}

/* ── World ── */
.bb-world {
  position: absolute;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  transform-origin: 0 0;
}
.bb-groups,
.bb-layer {
  position: absolute;
  left: 0;
  top: 0;
}

/* ── Group circles ── */
.bgrp {
  --gc: var(--accent);
  --gls: 1;
  position: absolute;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
}
.bgrp-pos {
  position: absolute;
  left: 0;
  top: 0;
  width: 200px;
  height: 200px;
  transform-origin: 50% 50%;
  transition: transform 900ms var(--ease-move);
  cursor: zoom-in;
}
.bgrp.focus .bgrp-pos {
  cursor: zoom-out;
}
.bgrp-in {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(
    circle at 50% 38%,
    color-mix(in srgb, var(--gc) 13%, transparent),
    color-mix(in srgb, var(--gc) 6%, transparent) 70%
  );
  box-shadow:
    inset 0 0 0 calc(1.4px * var(--gls)) color-mix(in srgb, var(--gc) 42%, transparent),
    inset 0 0 calc(30px * var(--gls)) color-mix(in srgb, var(--gc) 10%, transparent);
  transition:
    background 0.25s,
    box-shadow 0.25s;
}
.bgrp-pos:hover .bgrp-in {
  background: radial-gradient(
    circle at 50% 38%,
    color-mix(in srgb, var(--gc) 19%, transparent),
    color-mix(in srgb, var(--gc) 9%, transparent) 70%
  );
  box-shadow:
    inset 0 0 0 calc(2px * var(--gls)) color-mix(in srgb, var(--gc) 65%, transparent),
    inset 0 0 calc(30px * var(--gls)) color-mix(in srgb, var(--gc) 16%, transparent);
}
.bgrp.focus .bgrp-in {
  box-shadow:
    inset 0 0 0 calc(2px * var(--gls)) color-mix(in srgb, var(--gc) 75%, transparent),
    0 0 calc(40px * var(--gls)) color-mix(in srgb, var(--gc) 18%, transparent);
}
.bgrp-enter-active .bgrp-in {
  transition:
    opacity 0.55s ease calc(0.12s + var(--gi, 0) * 0.04s),
    transform 0.9s var(--ease-pop) calc(0.08s + var(--gi, 0) * 0.04s);
}
.bgrp-enter-from .bgrp-in {
  opacity: 0;
  transform: scale(0.72);
}
.bgrp-leave-active .bgrp-in {
  transition:
    opacity 0.4s ease,
    transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
.bgrp-leave-to .bgrp-in {
  opacity: 0;
  transform: scale(1.1);
}
.bgrp-leave-active {
  pointer-events: none;
}

/* ── Person bubbles ── */
.bb {
  --c: var(--accent);
  --ls: 0.5;
  position: absolute;
  left: 0;
  top: 0;
  width: 100px;
  height: 100px;
  transform-origin: 50% 50%;
  cursor: pointer;
  contain: layout style;
}
.bb:hover {
  z-index: 3;
}
.bb-dot {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(
    circle at 50% 34%,
    color-mix(in srgb, var(--c) 50%, var(--surface)),
    color-mix(in srgb, var(--c) 24%, var(--surface)) 78%
  );
  box-shadow: inset 0 0 0 11px var(--c);
  transition: transform 0.25s cubic-bezier(0.34, 1.5, 0.5, 1);
}
.bb.dead .bb-dot {
  opacity: 0.6;
}
.bb:hover .bb-dot {
  transform: scale(1.35);
}
.bb.sel .bb-dot {
  box-shadow:
    inset 0 0 0 11px var(--c),
    0 0 0 10px color-mix(in srgb, var(--accent) 80%, transparent),
    0 0 30px 12px color-mix(in srgb, var(--accent) 55%, transparent);
}

.bb-nudge {
  position: absolute;
  inset: 0;
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.bb-bob {
  position: absolute;
  inset: 0;
  animation: bb-bob 6s ease-in-out infinite;
  animation-delay: calc(var(--ph, 0) * 3s);
}
/* No bob while the camera moves (see markMoving), for big-on-screen bubbles
   (kept crisp) or when hundreds are visible (kept cheap). */
.bubbles.busy .bb-bob,
.bubbles.panning .bb-bob,
.bubbles[data-moving] .bb-bob,
.bb.lg .bb-bob {
  animation: none;
}
@keyframes bb-bob {
  0%,
  100% {
    transform: translate(0, 0);
  }
  25% {
    transform: translate(0, -2.4px);
  }
  75% {
    transform: translate(0, 2.4px);
  }
}

.bb-body {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  overflow: hidden;
  background: radial-gradient(
    circle at 50% 30%,
    color-mix(in srgb, var(--c) 28%, var(--surface)),
    var(--surface) 80%
  );
  box-shadow: 0 4px 14px -6px rgba(0, 0, 0, 0.5);
  transition:
    transform 0.32s cubic-bezier(0.34, 1.5, 0.5, 1),
    box-shadow 0.25s;
}
/* The gender ring sits above the photo (an inset shadow on the body itself
   would be painted underneath the <img>). */
.bb-body::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  box-shadow: inset 0 0 0 5px var(--c);
  z-index: 3;
  pointer-events: none;
}
.bb.md .bb-body::after,
.bb.lg .bb-body::after {
  box-shadow: inset 0 0 0 max(2.5px, calc(2.2px * var(--ls))) var(--c);
}
.bb:hover .bb-body {
  transform: scale(1.18);
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--c) 30%, transparent),
    0 0 26px 4px color-mix(in srgb, var(--c) 55%, transparent);
}
.bb.dead .bb-body {
  filter: saturate(0.55);
}
/* Glossy highlight — a soap-bubble sheen */
.bb-body::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(
    38% 26% at 34% 22%,
    rgba(255, 255, 255, 0.34),
    rgba(255, 255, 255, 0) 70%
  );
  z-index: 2;
  pointer-events: none;
}
/* Selected: a ring that breathes outward */
.bb.sel .bb-body {
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--accent) 45%, transparent),
    0 0 28px 6px color-mix(in srgb, var(--accent) 50%, transparent);
}
.bb.sel .bb-body::after {
  box-shadow: inset 0 0 0 max(5px, calc(2.6px * var(--ls))) var(--accent);
}
.bb.sel .bb-bob::after {
  content: '';
  position: absolute;
  inset: -4%;
  border-radius: 50%;
  border: 3px solid var(--accent);
  animation: bb-sel 2s ease-out infinite;
  pointer-events: none;
}
@keyframes bb-sel {
  from {
    transform: scale(1);
    opacity: 0.9;
  }
  to {
    transform: scale(1.35);
    opacity: 0;
  }
}

.bb :deep(.bb-img) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}
.bb :deep(.bb-mono) {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 31px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: color-mix(in srgb, var(--c) 68%, var(--t1));
}
.bb.md :deep(.bb-mono),
.bb.lg :deep(.bb-mono) {
  padding-bottom: 16px;
}

/* Name label: plain text under the monogram; over a photo it gets a dark
   scrim and white type so it reads on any image in either theme. */
.bb-label {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 48%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: 0 15% 15%;
  text-align: center;
  line-height: 1.15;
  z-index: 1;
  color: var(--t1);
}
.bb-body:has(.bb-img) .bb-label {
  padding-bottom: 13%;
  background: linear-gradient(180deg, transparent, rgba(8, 10, 18, 0.78) 70%);
  color: #fff;
}
.bb-name {
  max-width: 100%;
  font-size: min(15px, max(calc(12px * var(--ls)), 4.2px));
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bb-body:has(.bb-img) .bb-name {
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}
.bb-sub {
  max-width: 100%;
  font-size: min(10px, max(calc(10px * var(--ls)), 3.2px));
  font-weight: 600;
  opacity: 0.68;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* ── Group labels ── */
.bb-labels {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
  transition: opacity 0.35s;
}
.bb-labels.relabel {
  opacity: 0;
  transition: opacity 0.12s;
}
.bb-labels g {
  transition: opacity 0.25s;
}
.bb-labels g.hid {
  opacity: 0;
}
.bb-labels text {
  font-family: var(--font);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  fill: color-mix(in srgb, var(--gc) 70%, var(--t1));
  paint-order: stroke;
  stroke: var(--bg);
  stroke-width: 4px;
  stroke-linejoin: round;
}
.bb-labels text.focus {
  fill: var(--t1);
}
.bb-lab-n {
  fill: var(--t2);
  font-weight: 700;
}

/* ── Controls ── */
.bb-bar {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 150px;
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  pointer-events: none;
  animation: bb-ui-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.2s backwards;
}
.bb-seg {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 11px;
  border: 1px solid var(--border);
  background: var(--glass-strong);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow);
}
.bb-seg-k {
  padding: 0 7px 0 8px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--t3);
}
.bb-seg-b {
  border: none;
  border-radius: 8px;
  padding: 5px 10px;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}
.bb-seg-b:hover {
  color: var(--t1);
  background: var(--hover);
}
.bb-seg-b.on {
  background: var(--adim);
  color: var(--accent);
}

.bb-crumb {
  position: absolute;
  left: 50%;
  bottom: 44px;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 13px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--glass-strong);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
}
.bb-crumb:hover .bb-crumb-back {
  color: var(--accent);
}
.bb-crumb-back {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--t2);
  transition: color 0.15s;
}
.bb-crumb-sep {
  color: var(--t3);
}
.bb-crumb-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--gc);
  box-shadow: 0 0 8px var(--gc);
}
.bb-crumb-n {
  color: var(--t3);
  font-variant-numeric: tabular-nums;
}

.bb-zoom {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 20;
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 11px;
  border: 1px solid var(--border);
  background: var(--glass-strong);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow);
  animation: bb-ui-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.28s backwards;
}
.bb-zoom-b {
  width: var(--ctl-sm);
  height: var(--ctl-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--t2);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}
.bb-zoom-b:hover {
  background: var(--hover);
  color: var(--t1);
}
@keyframes bb-ui-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
}

.bb-foot {
  position: absolute;
  left: 14px;
  bottom: 12px;
  z-index: 20;
  display: flex;
  align-items: baseline;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: var(--t3);
  pointer-events: none;
}
.bb-foot-n {
  color: var(--t2);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.bb-foot-hint {
  margin-left: 10px;
  opacity: 0.8;
}

/* ── Hover card ── */
.bb-tip {
  --c: var(--accent);
  position: absolute;
  z-index: 30;
  min-width: 150px;
  max-width: 240px;
  padding: 9px 12px 10px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--c) 40%, var(--border));
  background: var(--glass-soft);
  backdrop-filter: blur(12px);
  box-shadow:
    var(--shadow),
    0 0 22px -6px color-mix(in srgb, var(--c) 45%, transparent);
  transform: translate(-50%, -100%);
  pointer-events: none;
}
.bb-tip.below {
  transform: translate(-50%, 0);
}
.bb-tip-name {
  font-size: 13px;
  font-weight: 800;
  color: var(--t1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bb-tip-sub {
  font-size: 12px;
  font-weight: 600;
  color: var(--t2);
  font-variant-numeric: tabular-nums;
}
.bb-tip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 6px;
}
.bb-tip-metric,
.bb-tip-group {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11.5px;
  font-weight: 700;
  white-space: nowrap;
}
.bb-tip-metric {
  background: color-mix(in srgb, var(--c) 18%, transparent);
  color: var(--t1);
}
.bb-tip-group {
  --gc: var(--accent);
  border: 1px solid color-mix(in srgb, var(--gc) 45%, transparent);
  color: var(--t2);
}
.bb-tip-enter-active {
  transition:
    opacity 0.16s ease,
    margin-top 0.22s cubic-bezier(0.34, 1.5, 0.5, 1);
}
.bb-tip-leave-active {
  transition: opacity 0.1s ease;
}
.bb-tip-enter-from {
  opacity: 0;
  margin-top: 6px;
}
.bb-tip-leave-to {
  opacity: 0;
}

.bb-fade-enter-active,
.bb-fade-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
.bb-fade-enter-from,
.bb-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}

/* ── Empty state ── */
.bb-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--t2);
  pointer-events: none;
}
.bb-empty-icon {
  position: relative;
  width: 64px;
  height: 56px;
  margin-bottom: 6px;
}
.bb-empty-icon i {
  position: absolute;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  animation: bb-bob 4s ease-in-out infinite;
}
.bb-empty-icon i:nth-child(1) {
  left: 6px;
  top: 12px;
  width: 34px;
  height: 34px;
}
.bb-empty-icon i:nth-child(2) {
  left: 36px;
  top: 4px;
  width: 22px;
  height: 22px;
  animation-delay: -1.3s;
}
.bb-empty-icon i:nth-child(3) {
  left: 38px;
  top: 30px;
  width: 16px;
  height: 16px;
  animation-delay: -2.6s;
}
.bb-empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--t1);
}
.bb-empty-text {
  font-size: 13px;
  max-width: 280px;
  text-align: center;
}

@media (max-width: 720px) {
  .bb-bar {
    right: 110px;
  }
  .bb-foot-hint {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bb-bob,
  .bb.sel .bb-bob::after,
  .bb-empty-icon i,
  .bb-bar,
  .bb-zoom {
    animation: none;
  }
  .bgrp-pos,
  .bb-nudge,
  .bb-body {
    transition: none;
  }
}
</style>
