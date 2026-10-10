<template>
  <div
    ref="rootEl"
    class="hs"
    :class="{ unrolling, grabbing: dragging, empty: !persons.length }"
    :style="rootVars"
    tabindex="-1"
    @wheel.prevent="onWheel"
    @pointerdown="onPointerDown"
  >
    <div v-if="!persons.length" class="hs-empty">
      <img class="hs-empty-enso" :src="emptyEnso" alt="" />
      <div class="hs-empty-title">The scroll is blank</div>
      <div class="hs-empty-text">No people match — clear the search or add someone.</div>
    </div>

    <template v-else>
      <!-- The scroll: silk borders + the painting viewport. -->
      <div class="hs-scroll">
        <div class="hs-silk top"></div>
        <div ref="paperEl" class="hs-paper">
          <!-- landscape tiles (managed imperatively — see tiles below) -->
          <div ref="landEl" class="hs-track hs-land"></div>
          <!-- mist drifts on its own, between the hills and the figures -->
          <div class="hs-mist" aria-hidden="true">
            <i class="m1"></i>
            <i class="m2"></i>
            <i class="m3"></i>
          </div>
          <div ref="figEl" class="hs-track hs-figs">
            <template v-for="it in visibleItems" :key="itemKey(it)">
              <HandscrollFigure
                v-if="it.kind === 'person'"
                :person="it.p"
                :role="it.role"
                :selected="store.selectedPersonId === it.p.id"
                :deceased="isDead(it.p)"
                :style="{
                  left: it.x + 'px',
                  top: Math.round(it.y * bandH) + 'px',
                  '--s': (it.scale * figScale).toFixed(3)
                }"
                @open="openPerson"
              />

              <div
                v-else-if="it.kind === 'colophon'"
                class="hs-colo"
                :style="{
                  left: it.x0 + 'px',
                  width: it.x1 - it.x0 + 'px',
                  top: Math.round(it.y * bandH) + 'px',
                  height: Math.round(it.h * bandH) + 'px'
                }"
                @click="openPerson(it.p.id)"
              >
                <div class="hs-colo-text">
                  <b class="hs-colo-name">{{ it.p.name || 'Unnamed' }}</b>
                  <span class="hs-colo-body">{{ it.text }}</span>
                </div>
                <img
                  v-if="fontsReady"
                  class="hs-colo-seal"
                  :src="sealOf(it.p, 'c')"
                  alt=""
                  draggable="false"
                />
              </div>

              <div
                v-else-if="it.kind === 'marker'"
                class="hs-mark"
                :style="{ left: it.x + 'px', top: Math.round(bandH * 0.035) + 'px' }"
              >
                <span class="hs-mark-cjk">{{ it.label }}</span>
                <span v-if="it.year != null" class="hs-mark-lat">{{ it.year }}s</span>
              </div>

              <div
                v-else-if="it.kind === 'label'"
                class="hs-label"
                :style="{ left: it.x + 'px', top: Math.round(bandH * 0.11) + 'px' }"
              >
                {{ it.text }}<em>家</em>
              </div>

              <div
                v-else-if="it.kind === 'title'"
                class="hs-title"
                :style="{ left: it.x0 + 'px', width: it.x1 - it.x0 + 'px' }"
              >
                <span class="hs-title-main">家族長卷</span>
                <span class="hs-title-sub">{{ projectName }}</span>
                <img v-if="titleSeal" class="hs-title-seal" :src="titleSeal" alt="" />
                <img v-if="leisureSeal" class="hs-title-lseal" :src="leisureSeal" alt="" />
              </div>

              <div
                v-else-if="it.kind === 'seam'"
                class="hs-seam"
                :style="{ left: it.x0 + 'px', width: it.x1 - it.x0 + 'px' }"
              >
                <!-- 骑缝章 — a seal straddling the join -->
                <img v-if="seamSeal" class="hs-seam-seal" :src="seamSeal" alt="" />
              </div>

              <div
                v-else-if="it.kind === 'end'"
                class="hs-end"
                :style="{ left: it.x0 + 'px', width: it.x1 - it.x0 + 'px' }"
              >
                <div class="hs-end-text">
                  <span class="hs-end-main"
                    >右圖凡<span class="tcy">{{ it.count }}</span
                    >人</span
                  >
                  <span class="hs-end-sub"
                    >{{ it.count }} {{ it.count === 1 ? 'person' : 'people' }} · {{ layout.scenes }}
                    {{ layout.scenes === 1 ? 'scene' : 'scenes' }}</span
                  >
                </div>
                <img v-if="endSeal" class="hs-end-seal s1" :src="endSeal" alt="" />
                <img v-if="titleSeal" class="hs-end-seal s2" :src="titleSeal" alt="" />
              </div>
            </template>
          </div>
        </div>
        <div class="hs-silk bottom"></div>
      </div>

      <!-- Rollers: each holds what's still wound on that side. -->
      <div ref="rollLeftEl" class="hs-roller left" aria-hidden="true"></div>
      <div ref="rollRightEl" class="hs-roller right" aria-hidden="true"></div>

      <!-- HUD: the whole scroll in miniature (right → left), the era in view -->
      <div class="hs-hud">
        <div class="hs-hud-name">
          <span class="hs-hud-brush">長卷</span>
          <span class="hs-hud-sub">{{ persons.length }} people · {{ layout.scenes }} scenes</span>
        </div>
        <div ref="stripEl" class="hs-strip" @pointerdown.stop="onStripDown">
          <i class="hs-strip-line"></i>
          <i
            v-for="m in stripMarks"
            :key="m.x"
            class="hs-strip-tick"
            :style="{ left: m.f * 100 + '%' }"
            :title="m.label"
          ></i>
          <i ref="stripWinEl" class="hs-strip-win"></i>
        </div>
        <div class="hs-hud-era">
          <span class="hs-era-cjk">{{ era.cjk }}</span>
          <span class="hs-era-lat">{{ era.lat }}</span>
        </div>
        <span class="hs-hud-hint">drag · wheel · arrow keys</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useMainStore } from '../../store/index.js'
import { isDeceased } from './peopleLayout.js'
import HandscrollFigure from './HandscrollFigure.vue'
import { paintTile } from './handscrollPainter'
import {
  DIMS,
  layoutHandscroll,
  landscapeFeatures,
  visibleRange,
  clampCam,
  yearAt,
  tileRange,
  rollerRadius,
  cjkYear,
  decadeOf
} from './handscrollLayout'
import { ensoUrl, oldPaperUrl, personSealUrl, useFixedSeal, useInkFontsReady } from './inkPeopleArt'
import { sealDataUrl } from '../../lib/inkArt'

// 长卷 The Handscroll: the family as one long painted scroll in the manner of
// 清明上河图 / 千里江山图. It reads RIGHT-TO-LEFT — the frontispiece is at the
// right, households follow in chronological order across a continuous
// seeded landscape, decades are inscribed in the gaps, colophons carry bios.
//
// Perf: the landscape is painted into cached 512px tile canvases (one per
// frame at most, nearest-first, LRU-evicted) that live in a translated track;
// figures/colophons are windowed to the visible span. Panning writes one
// transform per frame and the rAF loop only runs while the scroll moves or
// tiles are still being painted — idle is idle.

const props = defineProps({
  persons: { type: Array, required: true },
  statsOf: { type: Function, required: true },
  refYear: { type: Number, required: true }
})

const store = useMainStore()

const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ── Geometry ────────────────────────────────────────────────────────────────
const TOP_PAD = 26 // space above the scroll
const HUD_H = 62 // the HUD strip below it
const SILK = 15 // silk border, top and bottom
const SIDE = 34 // room left at each side for the rollers

const rootEl = ref(null)
const paperEl = ref(null)
const landEl = ref(null)
const figEl = ref(null)
const rollLeftEl = ref(null)
const rollRightEl = ref(null)
const stripEl = ref(null)
const stripWinEl = ref(null)

const viewW = ref(0)
const viewH = ref(0)
const bandH = computed(() => Math.max(260, viewH.value - TOP_PAD - HUD_H - SILK * 2))
const figScale = computed(() => Math.max(0.72, Math.min(1.12, bandH.value / 600)))

const layout = shallowRef(layoutHandscroll([], [], new Map()))
const features = shallowRef([])
function relayout() {
  layout.value = layoutHandscroll(props.persons, store.relationships, store.relTypeRoles)
  features.value = landscapeFeatures(layout.value.totalW, layout.value.sceneSpans, 7)
}
relayout()
watch(
  () => [props.persons, store.relationships, store.relTypeRoles],
  () => {
    relayout()
    resetTiles()
    cam = layout.value.totalW
    target = null
    vel = 0
    kick()
  }
)

const bandW = computed(() => Math.max(0, Math.min(viewW.value - SIDE * 2, layout.value.totalW)))
const bandLeft = computed(() => Math.round((viewW.value - bandW.value) / 2))
const rootVars = computed(() => ({
  '--hs-top': TOP_PAD + 'px',
  '--hs-silk': SILK + 'px',
  '--hs-band-h': bandH.value + 'px',
  '--hs-left': bandLeft.value + 'px',
  '--hs-w': bandW.value + 'px',
  '--hs-old-paper': `url(${oldPaperUrl()})`
}))

// ── Camera ──────────────────────────────────────────────────────────────────
// `cam` = the world x at the band's right edge. Reading starts at totalW.
let cam = layout.value.totalW
let target = null
let vel = 0 // px per frame; positive = the painting moves right (reading on)
let raf = 0
const dragging = ref(false)

function clamp(c) {
  return clampCam(c, layout.value.totalW, bandW.value)
}

const winStart = ref(0)
const winEnd = ref(0)
const visibleItems = computed(() => layout.value.items.slice(winStart.value, winEnd.value))
const itemKey = (it) =>
  it.kind === 'person' || it.kind === 'colophon' ? it.kind + it.p.id : it.kind + it.x0

const eraYear = ref(null)
const era = computed(() => {
  const y = eraYear.value
  if (y == null) return { cjk: '年代不詳', lat: 'undated' }
  const d = decadeOf(y)
  return { cjk: cjkYear(d), lat: d + 's' }
})

function apply() {
  const L = layout.value
  const bw = bandW.value
  cam = clamp(cam)
  const tx = `translate3d(${Math.round((bw - cam) * 100) / 100}px,0,0)`
  if (landEl.value) landEl.value.style.transform = tx
  if (figEl.value) figEl.value.style.transform = tx

  // windowed items
  const over = 260
  const r = visibleRange(L.items, cam - bw - over, cam + over, L.maxItemW)
  if (r.start !== winStart.value) winStart.value = r.start
  if (r.end !== winEnd.value) winEnd.value = r.end

  // rollers: thickness ∝ what's still wound on each side
  const rl = rollerRadius(cam - bw, L.totalW)
  const rr = rollerRadius(L.totalW - cam, L.totalW)
  if (rollLeftEl.value) rollLeftEl.value.style.setProperty('--r', rl.toFixed(1) + 'px')
  if (rollRightEl.value) rollRightEl.value.style.setProperty('--r', rr.toFixed(1) + 'px')

  // HUD
  if (stripWinEl.value && L.totalW > 0) {
    const a = (cam - bw) / L.totalW
    const b = cam / L.totalW
    stripWinEl.value.style.left = a * 100 + '%'
    stripWinEl.value.style.width = Math.max(1.5, (b - a) * 100) + '%'
  }
  const y = yearAt(L.anchors, cam - bw * 0.5)
  if (y !== eraYear.value) eraYear.value = y

  updateTiles()
}

function tick() {
  raf = 0
  let moving = false
  if (!dragging.value) {
    if (Math.abs(vel) > 0.08) {
      const before = cam
      cam = clamp(cam - vel)
      vel *= 0.935
      if (cam === before) vel = 0
      else moving = true
    } else if (target != null) {
      const d = target - cam
      if (Math.abs(d) < 0.4) {
        cam = target
        target = null
      } else {
        cam += d * (reduceMotion ? 1 : 0.16)
        moving = true
      }
      vel = 0
    }
  }
  apply()
  const pending = paintSome(moving ? 6 : 14)
  if (moving || pending) raf = requestAnimationFrame(tick)
}
function kick() {
  if (!raf) raf = requestAnimationFrame(tick)
}
function goTo(c) {
  target = clamp(c)
  vel = 0
  kick()
}

// ── Input ───────────────────────────────────────────────────────────────────
function onWheel(e) {
  const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? bandW.value : 1
  // Wheel down / trackpad swipe left both read on (the painting moves right).
  const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : -e.deltaY) * unit
  goTo((target ?? cam) + d * 1.1)
}

let lastX = 0
let lastT = 0
let moved = 0
function onPointerDown(e) {
  if (e.button !== 0 || !props.persons.length) return
  // no text selection sweeping across the toolbar while panning
  if (e.pointerType === 'mouse') e.preventDefault()
  dragging.value = true
  lastX = e.clientX
  lastT = performance.now()
  moved = 0
  vel = 0
  target = null
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}
function onPointerMove(e) {
  const dx = e.clientX - lastX
  const now = performance.now()
  const dt = Math.max(1, now - lastT)
  lastX = e.clientX
  lastT = now
  moved += Math.abs(dx)
  cam = clamp(cam - dx)
  vel = vel * 0.6 + dx * (16.7 / dt) * 0.4
  kick()
}
function onPointerUp() {
  dragging.value = false
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  if (performance.now() - lastT > 90 || reduceMotion) vel = 0
  kick()
}

function onStripDown(e) {
  const el = stripEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
  goTo(f * layout.value.totalW + bandW.value / 2)
}

function openPerson(id) {
  if (moved > 6) return // the click that ends a drag
  store.selectPerson(id)
}

function onKeydown(e) {
  if (store.activeView !== 'directory') return
  if (store.modalOpen || store.formOpen || store.curtain?.active) return
  if (store.appSettingsOpen || store.userPageOpen || store.projectsPageOpen || store.browsePageOpen)
    return
  if (e.ctrlKey || e.metaKey || e.altKey) return
  const t = e.target
  if (
    t &&
    (t.tagName === 'INPUT' ||
      t.tagName === 'TEXTAREA' ||
      t.tagName === 'SELECT' ||
      t.isContentEditable)
  )
    return
  const step = bandW.value * 0.6
  const base = target ?? cam
  const moves = {
    ArrowLeft: base - step,
    ArrowRight: base + step,
    PageDown: base - bandW.value * 0.95,
    PageUp: base + bandW.value * 0.95,
    Home: layout.value.totalW,
    End: 0
  }
  if (e.key in moves) {
    e.preventDefault()
    goTo(moves[e.key])
  }
}

// ── Landscape tiles ─────────────────────────────────────────────────────────
// Canvases are cached by tile index; only tiles in (or near) view are in the
// DOM. Painting is incremental: nearest-to-centre first, within a per-frame
// time budget, each new tile blooming in like a wash settling into paper.
const tileCache = new Map() // index → canvas (insertion order = LRU)
const mounted = new Set()
let pending = []
let tileH = 0
let tileDpr = 1

function resetTiles() {
  for (const c of tileCache.values()) c.remove()
  tileCache.clear()
  mounted.clear()
  pending = []
}

function updateTiles() {
  const host = landEl.value
  if (!host) return
  const h = bandH.value
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  if (h !== tileH || dpr !== tileDpr) {
    resetTiles()
    tileH = h
    tileDpr = dpr
  }
  const T = DIMS.tile
  const bw = bandW.value
  const over = Math.max(T, bw * 0.5)
  const total = layout.value.totalW
  const { first, last } = tileRange(
    Math.max(0, cam - bw - over),
    Math.min(total - 1, cam + over),
    T
  )
  for (const i of [...mounted]) {
    if (i < first || i > last) {
      tileCache.get(i)?.remove()
      mounted.delete(i)
    }
  }
  const centre = cam - bw / 2
  const want = []
  for (let i = first; i <= last; i++) {
    const c = tileCache.get(i)
    if (c) {
      if (!mounted.has(i)) {
        host.appendChild(c)
        mounted.add(i)
      }
      tileCache.delete(i) // refresh LRU position
      tileCache.set(i, c)
    } else want.push(i)
  }
  want.sort((a, b) => Math.abs(a * T + T / 2 - centre) - Math.abs(b * T + T / 2 - centre))
  pending = want
  // LRU: keep a generous margin of off-screen tiles for scrolling back
  const cap = (last - first + 1) * 2 + 8
  if (tileCache.size > cap) {
    for (const [i, c] of tileCache) {
      if (tileCache.size <= cap) break
      if (mounted.has(i)) continue
      c.remove()
      tileCache.delete(i)
    }
  }
}

function paintSome(budgetMs) {
  const host = landEl.value
  if (!host || !pending.length) return false
  const t0 = performance.now()
  const T = DIMS.tile
  do {
    const i = pending.shift()
    if (tileCache.has(i)) continue
    const c = document.createElement('canvas')
    c.className = reduceMotion ? 'hs-tile' : 'hs-tile fresh'
    c.style.left = i * T + 'px'
    c.style.width = T + 'px'
    c.style.height = tileH + 'px'
    paintTile(c, i, tileH, tileDpr, features.value)
    if (!reduceMotion)
      c.addEventListener('animationend', () => c.classList.remove('fresh'), { once: true })
    tileCache.set(i, c)
    host.appendChild(c)
    mounted.add(i)
  } while (pending.length && performance.now() - t0 < budgetMs)
  return pending.length > 0
}

// ── Seals + misc ────────────────────────────────────────────────────────────
const fontsReady = useInkFontsReady()
const titleSeal = useFixedSeal('家譜', { mode: 'yin', seed: 41 })
const leisureSeal = useFixedSeal('長樂', { mode: 'yang', seed: 77, round: true })
const endSeal = useFixedSeal('子孫永寶', { mode: 'yin', seed: 12 })
const seamSeal = computed(() =>
  fontsReady.value ? sealDataUrl('珍藏', { size: 96, mode: 'yang', seed: 5 }) : ''
)
function sealOf(p) {
  return personSealUrl(p.name || '', p.id || '', 64)
}
const emptyEnso = ensoUrl(2)
const projectName = computed(() => store.activeProject?.name || '')
const isDead = (p) => isDeceased(p, props.refYear)

const stripMarks = computed(() => {
  const L = layout.value
  if (!L.totalW) return []
  // thin the ticks so they never crowd the strip
  const out = []
  let lastF = -1
  for (const m of [...L.marks].reverse()) {
    const f = m.x / L.totalW
    if (lastF < 0 || f - lastF > 0.012) {
      out.push({ x: m.x, f, label: m.label })
      lastF = f
    }
  }
  return out
})

// ── Entrance: the rollers part and the painting unrolls right → left ──────
const unrolling = ref(!reduceMotion)
let unrollTimer = 0

// ── Lifecycle ───────────────────────────────────────────────────────────────
let ro = null
function measure() {
  const el = rootEl.value
  if (!el) return
  viewW.value = el.clientWidth
  viewH.value = el.clientHeight
  cam = clamp(cam)
  kick()
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  measure()
  ro = new ResizeObserver(measure)
  if (rootEl.value) ro.observe(rootEl.value)
  nextTick(() => {
    cam = layout.value.totalW
    apply()
    kick()
  })
  if (unrolling.value) unrollTimer = setTimeout(() => (unrolling.value = false), 2100)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  onPointerUp()
  ro?.disconnect()
  if (raf) cancelAnimationFrame(raf)
  clearTimeout(unrollTimer)
  resetTiles()
})
// Mounting the band (empty → people) needs a fresh frame.
watch(landEl, () => nextTick(kick))
watch(bandW, () => kick())
</script>

<style scoped>
.hs {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  user-select: none;
  cursor: grab;
  outline: none;
  /* the table the scroll is laid out on */
  background: radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(0, 0, 0, 0.14)), var(--bg);
  --silk-a: #9aa69f;
  --silk-b: #7f8c85;
  --scroll-paper: #efe6d0;
}
.hs.grabbing {
  cursor: grabbing;
}

/* ── The scroll ── */
.hs-scroll {
  position: absolute;
  top: var(--hs-top);
  left: var(--hs-left);
  width: var(--hs-w);
  height: calc(var(--hs-band-h) + var(--hs-silk) * 2);
  display: flex;
  flex-direction: column;
  box-shadow:
    0 18px 30px -18px rgba(0, 0, 0, 0.55),
    0 3px 8px rgba(0, 0, 0, 0.16);
}
.hs.unrolling .hs-scroll {
  animation: hs-unroll 1.7s cubic-bezier(0.55, 0.05, 0.25, 1) 0.25s backwards;
}
@keyframes hs-unroll {
  from {
    clip-path: inset(0 0 0 100%);
  }
  to {
    clip-path: inset(0 0 0 0);
  }
}
/* 绫 silk borders: horizontally uniform, so they read as continuous */
.hs-silk {
  flex: 0 0 var(--hs-silk);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.12), transparent 40%, rgba(0, 0, 0, 0.1)),
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.07) 0 1px, transparent 1px 3px),
    var(--silk-a);
}
.hs-silk.top {
  border-bottom: 2px solid #6d5a3e;
}
.hs-silk.bottom {
  border-top: 2px solid #6d5a3e;
}
.hs-paper {
  position: relative;
  flex: 1 1 auto;
  overflow: hidden;
  background: var(--scroll-paper);
  contain: strict;
}
.hs-track {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 0;
  will-change: transform;
}
.hs-land :deep(.hs-tile) {
  position: absolute;
  top: 0;
  display: block;
}
.hs-land :deep(.hs-tile.fresh) {
  animation: hs-tile-bloom 0.9s ease-out;
}
@keyframes hs-tile-bloom {
  from {
    opacity: 0;
  }
}

/* 云雾 — slow drifting mist, fixed to the viewport (so it parallaxes) */
.hs-mist {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.hs-mist i {
  position: absolute;
  height: 26%;
  width: 70%;
  border-radius: 50%;
  background: radial-gradient(
    closest-side,
    rgba(244, 238, 222, 0.82),
    rgba(244, 238, 222, 0.38) 55%,
    rgba(244, 238, 222, 0)
  );
  animation: hs-mist 70s ease-in-out infinite alternate;
}
.hs-mist .m1 {
  left: -10%;
  top: 56%;
}
.hs-mist .m2 {
  left: 45%;
  top: 64%;
  width: 60%;
  animation-duration: 90s;
  animation-direction: alternate-reverse;
}
.hs-mist .m3 {
  left: 20%;
  top: 30%;
  height: 16%;
  opacity: 0.55;
  animation-duration: 110s;
}
@keyframes hs-mist {
  from {
    transform: translateX(-8%);
  }
  to {
    transform: translateX(14%);
  }
}

/* ── Inscriptions / panels in the figure track ── */
.hs-figs > * {
  pointer-events: auto;
}
.hs-mark {
  position: absolute;
  width: 40px;
  margin-left: -20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: #3a332a;
  pointer-events: none;
  animation: hs-ink-in 1s ease-out backwards;
}
.hs-mark-cjk {
  writing-mode: vertical-rl;
  font-family: var(--font-brush);
  font-size: 17px;
  letter-spacing: 3px;
  text-shadow: 0 0 6px rgba(239, 230, 208, 0.95);
}
.hs-mark-lat {
  font-family: var(--font-ink-serif);
  font-size: 11.5px;
  letter-spacing: 0.4px;
  color: #6b5f50;
}
.hs-mark-lat::before {
  content: '';
  display: block;
  width: 5px;
  height: 5px;
  margin: 0 auto 5px;
  border-radius: 50%;
  background: rgba(var(--ink-cinnabar-rgb), 0.85);
}
.hs-label {
  position: absolute;
  margin-left: -10px;
  writing-mode: vertical-rl;
  font-family: var(--font-ink-serif);
  font-style: italic;
  font-size: 12.5px;
  letter-spacing: 0.6px;
  color: #6b5f50;
  white-space: nowrap;
  pointer-events: none;
  text-shadow: 0 0 5px rgba(239, 230, 208, 0.95);
}
.hs-label em {
  font-style: normal;
  font-family: var(--font-brush);
  font-size: 15px;
  color: #3a332a;
  margin-top: 4px;
}
@keyframes hs-ink-in {
  from {
    opacity: 0;
    filter: blur(2px);
  }
}

/* 题跋 colophon: a separate sheet of older paper mounted onto the scroll */
.hs-colo {
  position: absolute;
  padding: 16px 14px 14px;
  background:
    var(--hs-old-paper) 0 0 / 256px 256px,
    #ece0c4;
  box-shadow:
    inset 0 0 0 1px rgba(90, 65, 30, 0.22),
    inset 0 0 24px rgba(120, 88, 40, 0.18),
    0 1px 2px rgba(60, 40, 15, 0.15);
  cursor: pointer;
  overflow: hidden;
  animation: hs-ink-in 1s ease-out backwards;
  transition: box-shadow 0.4s ease;
}
.hs-colo:hover {
  box-shadow:
    inset 0 0 0 1px rgba(var(--ink-cinnabar-rgb), 0.45),
    inset 0 0 24px rgba(120, 88, 40, 0.22),
    0 4px 14px rgba(60, 40, 15, 0.2);
}
.hs-colo-text {
  height: 100%;
  writing-mode: vertical-rl;
  font-family: var(--font-brush);
  font-size: 14px;
  line-height: 1.55;
  color: #2a241c;
  overflow: hidden;
  /* faint ruled columns, like 乌丝栏 */
  background: repeating-linear-gradient(
    90deg,
    transparent 0 calc(1.55em - 1px),
    rgba(150, 40, 30, 0.12) calc(1.55em - 1px) 1.55em
  );
  background-position: right top;
}
.hs-colo-name {
  display: block;
  font-weight: normal;
  font-size: 18px;
  margin-left: 8px;
  color: #1c1a17;
}
.hs-colo-body {
  display: block;
}
.hs-colo-seal {
  position: absolute;
  left: 12px;
  bottom: 12px;
  width: 26px;
  height: 26px;
  mix-blend-mode: multiply;
  opacity: 0.9;
  transform: rotate(2deg);
}

/* 引首 frontispiece on gold-flecked paper (洒金) */
.hs-title {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  flex-direction: row-reverse;
  align-items: flex-start;
  justify-content: center;
  gap: 18px;
  padding-top: 8%;
  background:
    radial-gradient(1.4px 1.4px at 12% 18%, rgba(190, 150, 60, 0.75), transparent),
    radial-gradient(1px 1px at 33% 72%, rgba(190, 150, 60, 0.7), transparent),
    radial-gradient(2px 1.5px at 58% 34%, rgba(190, 150, 60, 0.6), transparent),
    radial-gradient(1.2px 1.2px at 77% 82%, rgba(190, 150, 60, 0.7), transparent),
    radial-gradient(1.6px 1.2px at 88% 12%, rgba(190, 150, 60, 0.65), transparent),
    radial-gradient(1px 1px at 46% 52%, rgba(190, 150, 60, 0.6), transparent),
    radial-gradient(1.3px 1px at 22% 44%, rgba(190, 150, 60, 0.6), transparent),
    radial-gradient(1px 1.4px at 68% 62%, rgba(190, 150, 60, 0.6), transparent);
  background-size: 120px 140px;
  background-color: #e6d6b2;
  pointer-events: none;
}
.hs-title-main {
  writing-mode: vertical-rl;
  font-family: var(--font-xing);
  font-size: clamp(48px, calc(var(--hs-band-h) * 0.11), 76px);
  letter-spacing: 8px;
  color: #1c1a17;
  line-height: 1;
}
.hs-title-sub {
  writing-mode: vertical-rl;
  font-family: var(--font-brush);
  font-size: 16px;
  letter-spacing: 2px;
  color: #4b4236;
  margin-top: 30px;
  max-height: 60%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.hs-title-seal {
  position: absolute;
  left: 36px;
  bottom: 12%;
  width: 46px;
  height: 46px;
  mix-blend-mode: multiply;
  opacity: 0.92;
}
.hs-title-lseal {
  position: absolute;
  right: 26px;
  top: 6%;
  width: 30px;
  height: 30px;
  mix-blend-mode: multiply;
  opacity: 0.85;
}
/* 隔水 silk seam between the sheets */
.hs-seam {
  position: absolute;
  top: 0;
  bottom: 0;
  background:
    linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.18),
      transparent 25%,
      transparent 75%,
      rgba(0, 0, 0, 0.18)
    ),
    repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.08) 0 1px, transparent 1px 5px),
    var(--silk-b);
  pointer-events: none;
}
.hs-seam-seal {
  position: absolute;
  left: 50%;
  top: 58%;
  width: 40px;
  height: 40px;
  margin-left: -20px;
  mix-blend-mode: multiply;
  opacity: 0.8;
}
/* 拖尾 end panel */
.hs-end {
  position: absolute;
  top: 0;
  bottom: 0;
  background:
    var(--hs-old-paper) 0 0 / 256px 256px,
    #ece0c4;
  box-shadow: inset 0 0 30px rgba(120, 88, 40, 0.2);
  pointer-events: none;
}
.hs-end-text {
  position: absolute;
  right: 60px;
  top: 12%;
  writing-mode: vertical-rl;
  display: flex;
  gap: 14px;
  color: #2a241c;
}
.hs-end-main {
  font-family: var(--font-brush);
  font-size: 26px;
  letter-spacing: 6px;
}
.tcy {
  text-combine-upright: all;
}
.hs-end-sub {
  font-family: var(--font-ink-serif);
  font-size: 12.5px;
  color: #6b5f50;
  letter-spacing: 0.5px;
}
.hs-end-seal {
  position: absolute;
  mix-blend-mode: multiply;
  opacity: 0.88;
}
.hs-end-seal.s1 {
  right: 66px;
  bottom: 18%;
  width: 52px;
  height: 52px;
}
.hs-end-seal.s2 {
  left: 70px;
  top: 30%;
  width: 40px;
  height: 40px;
  transform: rotate(4deg);
}

/* ── Rollers ── */
.hs-roller {
  --r: 12px;
  position: absolute;
  top: calc(var(--hs-top) - 9px);
  height: calc(var(--hs-band-h) + var(--hs-silk) * 2 + 18px);
  width: calc(var(--r) * 2);
  margin-left: calc(var(--r) * -1);
  border-radius: calc(var(--r) * 0.5);
  pointer-events: none;
  /* the wound scroll: paper roll between silk rims, lit from the left */
  background:
    linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.35),
      rgba(255, 255, 255, 0.22) 32%,
      rgba(255, 255, 255, 0.05) 55%,
      rgba(0, 0, 0, 0.38)
    ),
    linear-gradient(
      180deg,
      #2f2218 0 9px,
      var(--silk-a) 9px calc(9px + var(--hs-silk)),
      var(--scroll-paper) calc(9px + var(--hs-silk)) calc(100% - 9px - var(--hs-silk)),
      var(--silk-a) calc(100% - 9px - var(--hs-silk)) calc(100% - 9px),
      #2f2218 calc(100% - 9px)
    );
  box-shadow: 0 10px 18px -8px rgba(0, 0, 0, 0.55);
}
.hs-roller.left {
  left: var(--hs-left);
}
.hs-roller.right {
  left: calc(var(--hs-left) + var(--hs-w));
}
/* 轴头 jade knobs on the stave ends */
.hs-roller::before,
.hs-roller::after {
  content: '';
  position: absolute;
  left: 50%;
  width: 14px;
  height: 11px;
  margin-left: -7px;
  border-radius: 3px;
  background: linear-gradient(90deg, #6f7d6c, #d8e0cf 45%, #9aa995 70%, #5f6d5c);
  box-shadow: 0 2px 3px rgba(0, 0, 0, 0.35);
}
.hs-roller::before {
  top: -9px;
}
.hs-roller::after {
  bottom: -9px;
}
.hs.unrolling .hs-roller.left {
  animation: hs-roller-slide 1.7s cubic-bezier(0.55, 0.05, 0.25, 1) 0.25s backwards;
}
@keyframes hs-roller-slide {
  from {
    transform: translateX(var(--hs-w));
  }
  to {
    transform: none;
  }
}

/* ── HUD ── */
.hs-hud {
  position: absolute;
  left: 24px;
  right: 24px;
  bottom: 12px;
  height: 36px;
  display: flex;
  align-items: center;
  gap: 22px;
  color: var(--t2);
  font-family: var(--font);
}
.hs.unrolling .hs-hud {
  animation: hs-ink-in 0.8s ease-out 1.4s backwards;
}
.hs-hud-name {
  display: flex;
  align-items: baseline;
  gap: 10px;
  white-space: nowrap;
}
.hs-hud-brush {
  font-family: var(--font-brush);
  font-size: 20px;
  color: var(--t1);
}
.hs-hud-sub {
  font-size: 12.5px;
  color: var(--t3);
}
.hs-strip {
  position: relative;
  flex: 1 1 auto;
  height: 22px;
  cursor: pointer;
  min-width: 120px;
}
.hs-strip-line {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 2px;
  margin-top: -1px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--t3) 55%, transparent);
}
.hs-strip-tick {
  position: absolute;
  top: 50%;
  width: 1px;
  height: 8px;
  margin-top: -4px;
  background: var(--t3);
}
.hs-strip-win {
  position: absolute;
  top: 3px;
  bottom: 3px;
  min-width: 6px;
  border-radius: 3px;
  background: rgba(var(--accent-rgb), 0.22);
  border: 1.5px solid var(--accent);
  box-shadow: 0 0 10px rgba(var(--accent-rgb), 0.3);
}
.hs-hud-era {
  display: flex;
  align-items: baseline;
  gap: 8px;
  white-space: nowrap;
  min-width: 132px;
  justify-content: flex-end;
}
.hs-era-cjk {
  font-family: var(--font-brush);
  font-size: 19px;
  letter-spacing: 2px;
  color: var(--t1);
}
.hs-era-lat {
  font-size: 12.5px;
  color: var(--t3);
}
.hs-hud-hint {
  font-size: 11.5px;
  color: var(--t3);
  white-space: nowrap;
}

/* ── Empty ── */
.hs-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--t2);
  cursor: default;
}
.hs-empty-enso {
  width: 110px;
  height: 110px;
  opacity: 0.55;
}
:root[data-theme='dark'] .hs-empty-enso {
  filter: invert(1);
}
.hs-empty-title {
  font-family: var(--font-brush);
  font-size: 22px;
  color: var(--t1);
}
.hs-empty-text {
  font-size: 13px;
}

@media (max-width: 760px) {
  .hs-hud-hint,
  .hs-hud-sub {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .hs-mist i,
  .hs.unrolling .hs-scroll,
  .hs.unrolling .hs-roller.left,
  .hs.unrolling .hs-hud,
  .hs-mark,
  .hs-colo {
    animation: none;
  }
}
</style>
