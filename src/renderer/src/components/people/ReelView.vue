<template>
  <div
    ref="reelEl"
    class="reel"
    :class="{ 'reel-dragging': dragging }"
    @pointerdown="onDown"
    @wheel.prevent="onWheel"
  >
    <!-- Empty roster -->
    <div v-if="!persons.length" class="reel-empty">
      <div class="reel-empty-icon">🎞</div>
      <div class="reel-empty-title">The reel is blank</div>
      <div class="reel-empty-text">No people match — clear the search or add someone.</div>
    </div>

    <template v-else>
      <!-- The lens: a glass bar marking the drum's focal line -->
      <div class="reel-lens" aria-hidden="true"></div>

      <div class="reel-scene">
        <div
          v-for="s in strips"
          :key="s.p.id"
          class="strip"
          :class="{
            'is-focus': s.i === focusedIndex,
            dead: s.dead,
            selected: store.selectedPersonId === s.p.id
          }"
          :style="s.style"
          @click="onStripClick(s)"
        >
          <div class="strip-holes"></div>
          <div class="strip-avatar" :style="{ '--sc': s.color }">
            <StripArt :person="s.p" />
          </div>
          <div class="strip-id">
            <span class="strip-name">{{ s.p.name || 'Unnamed' }}</span>
            <span class="strip-sub">
              {{ s.p.occupation || (s.p.gender ? s.p.gender : '—') }}
              <template v-if="s.p.location"> · {{ s.p.location }}</template>
            </span>
          </div>
          <div class="strip-spacer"></div>
          <span
            v-if="firstTag(s.p.id)"
            class="strip-tag"
            :style="{ '--tc': firstTag(s.p.id).color || 'var(--accent)' }"
          >
            {{ firstTag(s.p.id).label }}
          </span>
          <span class="strip-years">{{ lifeText(s.p) }}</span>
          <span class="strip-kin">🔗 {{ statsOf(s.p.id).kin }}</span>
          <div class="strip-holes strip-holes-r"></div>
          <div class="strip-shine"></div>
        </div>
      </div>

      <!-- Depth fades above and below the drum -->
      <div class="reel-fade reel-fade-top" aria-hidden="true"></div>
      <div class="reel-fade reel-fade-bottom" aria-hidden="true"></div>

      <!-- A–Z jump rail -->
      <div class="reel-az" @pointerdown.stop>
        <button
          v-for="l in letters"
          :key="l.ch"
          class="reel-az-l"
          :class="{ on: l.ch === focusedLetter }"
          @click="goTo(l.index)"
        >
          {{ l.ch }}
        </button>
      </div>

      <div class="reel-count" @pointerdown.stop>
        <button class="reel-count-arrow" title="Previous (↑)" @click="stepBy(-1)">‹</button>
        {{ focusedIndex + 1 }} / {{ persons.length }}
        <button class="reel-count-arrow" title="Next (↓)" @click="stepBy(1)">›</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, h } from 'vue'
import { useMainStore } from '../../store/index.js'
import { isDeceased } from './peopleLayout.js'
import { useThumbnail } from './useThumbnail.js'

// The Reel: people as film-strip rows on a spinning picker drum. Strips curve
// away above and below the focal line (rotateX around a horizontal axis);
// drag or scroll to spin with momentum, and the drum snaps a strip onto the
// lens. Only ~11 strips are mounted regardless of roster size, and an A–Z
// rail jumps the drum by initial.

const props = defineProps({
  persons: { type: Array, required: true },
  statsOf: { type: Function, required: true },
  refYear: { type: Number, required: true }
})

const store = useMainStore()
const reelEl = ref(null)

const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Strip avatar: cached thumbnail or monogram (own component so each visible
// strip owns its reactive thumbnail).
const StripArt = {
  props: { person: { type: Object, required: true } },
  setup(p) {
    const { src } = useThumbnail(() => p.person.primary_image || '', 144)
    const initials = computed(() => {
      const parts = (p.person.name || '?').trim().split(/\s+/).filter(Boolean)
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      return (parts[0] || '?').substring(0, 2).toUpperCase()
    })
    return () =>
      src.value
        ? h('img', { class: 'strip-img', src: src.value, alt: '', draggable: false })
        : h('span', { class: 'strip-ini' }, initials.value)
  }
}

// ── Drum physics: fractional position + spring + momentum (vertical) ────────
const pos = ref(0)
const target = ref(null)
const dragging = ref(false)

const count = computed(() => props.persons.length)
const clampIdx = (v) => Math.max(0, Math.min(Math.max(0, count.value - 1), v))
const focusedIndex = computed(() => clampIdx(Math.round(pos.value)))

let raf = 0
function startLoop() {
  if (!raf) raf = requestAnimationFrame(tick)
}
function tick() {
  raf = 0
  if (target.value == null || dragging.value) return
  const diff = target.value - pos.value
  if (Math.abs(diff) < 0.002) {
    pos.value = target.value
    target.value = null
    return
  }
  pos.value += diff * (reduceMotion ? 1 : 0.17)
  startLoop()
}
function goTo(i) {
  target.value = clampIdx(Math.round(i))
  startLoop()
}
function stepBy(delta) {
  goTo((target.value ?? Math.round(pos.value)) + delta)
}

const PX_PER_STEP = 58
let lastY = 0
let vel = 0
let moved = false
function onDown(e) {
  if (e.button !== 0) return
  dragging.value = true
  moved = false
  lastY = e.clientY
  vel = 0
  target.value = null
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}
function onMove(e) {
  if (!dragging.value) return
  const dy = e.clientY - lastY
  lastY = e.clientY
  if (!moved && Math.abs(dy) > 4) moved = true
  pos.value = Math.max(-0.35, Math.min(count.value - 0.65, pos.value - dy / PX_PER_STEP))
  vel = vel * 0.8 + (-dy / PX_PER_STEP) * 0.2
}
function onUp() {
  if (!dragging.value) return
  dragging.value = false
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  target.value = clampIdx(Math.round(pos.value + vel * 9))
  startLoop()
}

let wheelAcc = 0
function onWheel(e) {
  wheelAcc += e.deltaY
  if (Math.abs(wheelAcc) < 40) return
  stepBy(Math.sign(wheelAcc))
  wheelAcc = 0
}

function onKeydown(e) {
  if (store.modalOpen || store.formOpen || store.curtain.active) return
  if (store.appSettingsOpen || store.userPageOpen) return
  const t = e.target
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    stepBy(-1)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    stepBy(1)
  } else if (e.key === 'Home') {
    e.preventDefault()
    goTo(0)
  } else if (e.key === 'End') {
    e.preventDefault()
    goTo(count.value - 1)
  } else if (e.key === 'Enter' && props.persons[focusedIndex.value]) {
    e.preventDefault()
    store.selectPerson(props.persons[focusedIndex.value].id)
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  if (raf) cancelAnimationFrame(raf)
})

watch(count, (n) => {
  if (pos.value > n - 1) pos.value = Math.max(0, n - 1)
  if (target.value != null && target.value > n - 1) target.value = Math.max(0, n - 1)
})

// ── Drum placement ──────────────────────────────────────────────────────────
const STEP_DEG = 16.5
const RADIUS = 252
const WINDOW = 5

const strips = computed(() => {
  const n = count.value
  if (!n) return []
  const c = focusedIndex.value
  const lo = Math.max(0, c - WINDOW)
  const hi = Math.min(n - 1, c + WINDOW)
  const out = []
  for (let i = lo; i <= hi; i++) {
    const d = i - pos.value
    const ad = Math.abs(d)
    const p = props.persons[i]
    out.push({
      p,
      i,
      dead: isDeceased(p, props.refYear),
      color:
        p.gender === 'male'
          ? store.graphSettings.maleColor
          : p.gender === 'female'
            ? store.graphSettings.femaleColor
            : store.graphSettings.unknownColor,
      style: {
        transform: `translateX(-50%) rotateX(${-d * STEP_DEG}deg) translateZ(${RADIUS}px) scale(${
          1 + Math.max(0, 1 - ad) * 0.045
        })`,
        zIndex: 100 - Math.round(ad * 10),
        opacity: ad > 4 ? Math.max(0, 1 - (ad - 4)) : 1,
        filter: `brightness(${Math.max(0.45, 1 - ad * 0.16)})`,
        '--k': Math.min(ad, 5).toFixed(0)
      }
    })
  }
  return out
})

function onStripClick(s) {
  if (moved) {
    moved = false
    return
  }
  if (s.i !== focusedIndex.value) goTo(s.i)
  else store.selectPerson(s.p.id)
}

// ── A–Z rail (meaningful when sorted by name; harmless otherwise) ──────────
const letters = computed(() => {
  const seen = new Map()
  props.persons.forEach((p, i) => {
    const ch = (p.name || '#').trim().charAt(0).toUpperCase()
    const key = /[A-ZÀ-Þ]/.test(ch) ? ch : '#'
    if (!seen.has(key)) seen.set(key, i)
  })
  return [...seen.entries()].map(([ch, index]) => ({ ch, index }))
})
const focusedLetter = computed(() => {
  const p = props.persons[focusedIndex.value]
  const ch = (p?.name || '#').trim().charAt(0).toUpperCase()
  return /[A-ZÀ-Þ]/.test(ch) ? ch : '#'
})

function firstTag(id) {
  const tags = store.tagsOf.get(id)
  return tags && tags.length ? tags[0] : null
}
function lifeText(p) {
  const b = p.birth?.year
  const d = p.death?.year
  if (b && d) return `${b} – ${d}`
  if (b) return `b. ${b}`
  if (d) return `d. ${d}`
  return '—'
}
</script>

<style scoped>
.reel {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  touch-action: pan-x;
}
.reel-dragging {
  cursor: grabbing;
}
/* No pointer-events:none on .strip while dragging — that would retarget the
   pointerup and the strip's own click would never fire (the `moved` flag
   already swallows the click that ends a drag). */

/* The focal "lens": a glass band across the drum's centre line */
.reel-lens {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(820px, 94%);
  height: 86px;
  transform: translate(-50%, -50%);
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  background: color-mix(in srgb, var(--accent) 5%, transparent);
  box-shadow:
    0 0 34px -8px color-mix(in srgb, var(--accent) 35%, transparent),
    inset 0 0 26px -14px color-mix(in srgb, var(--accent) 45%, transparent);
  pointer-events: none;
  animation: reel-lens-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.15s backwards;
}
@keyframes reel-lens-in {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scaleX(0.6);
  }
}

.reel-scene {
  position: absolute;
  inset: 0;
  perspective: 1150px;
  perspective-origin: 50% 50%;
}

/* ── One strip ── */
.strip {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(780px, 88%);
  height: 64px;
  margin-top: -32px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--glass-soft);
  backdrop-filter: blur(6px);
  cursor: pointer;
  will-change: transform;
  animation: strip-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) calc(var(--k, 0) * 0.06s) backwards;
}
@keyframes strip-in {
  from {
    opacity: 0;
    transform: translateX(-50%) rotateX(80deg) translateZ(252px);
  }
}
.strip.is-focus {
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  box-shadow:
    0 10px 34px -12px rgba(0, 0, 0, 0.6),
    0 0 24px -6px color-mix(in srgb, var(--accent) 40%, transparent);
}
.strip.selected {
  border-color: var(--accent);
}
.strip.dead {
  filter: saturate(0.65);
}

/* Film sprocket holes on both ends */
.strip-holes {
  align-self: stretch;
  width: 12px;
  flex-shrink: 0;
  background-image: radial-gradient(circle 2.6px, var(--t3) 96%, transparent 100%);
  background-size: 12px 14px;
  background-position: center;
  background-repeat: repeat-y;
  opacity: 0.5;
}

.strip-avatar {
  --sc: var(--accent);
  position: relative;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  border: 2px solid color-mix(in srgb, var(--sc) 55%, transparent);
  background: color-mix(in srgb, var(--sc) 20%, var(--elevated));
  display: flex;
  align-items: center;
  justify-content: center;
}
.strip :deep(.strip-img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.strip :deep(.strip-ini) {
  font-size: 14px;
  font-weight: 800;
  color: var(--t1);
}

.strip-id {
  display: flex;
  flex-direction: column;
  min-width: 0;
  text-align: left;
  line-height: 1.3;
}
.strip-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--t1);
  letter-spacing: -0.2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.strip-sub {
  font-size: 11px;
  font-weight: 500;
  color: var(--t3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: capitalize;
}
.strip-spacer {
  flex: 1;
}
.strip-tag {
  flex-shrink: 0;
  padding: 3px 10px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--tc) 45%, transparent);
  background: color-mix(in srgb, var(--tc) 14%, transparent);
  color: var(--t1);
  font-size: 10px;
  font-weight: 700;
  max-width: 130px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.strip-years {
  flex-shrink: 0;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--t2);
  font-variant-numeric: tabular-nums;
}
.strip-kin {
  flex-shrink: 0;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--t3);
}

/* Shine that sweeps across the focused strip */
.strip-shine {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
}
.strip-shine::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -30%;
  width: 26%;
  transform: skewX(-22deg);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.14), transparent);
}
.strip.is-focus .strip-shine {
  opacity: 1;
}
.strip.is-focus .strip-shine::after {
  animation: strip-shine-run 3.2s ease-in-out infinite;
}
@keyframes strip-shine-run {
  0%,
  55% {
    transform: skewX(-22deg) translateX(0);
  }
  90%,
  100% {
    transform: skewX(-22deg) translateX(560%);
  }
}

/* Depth fades */
.reel-fade {
  position: absolute;
  left: 0;
  right: 0;
  height: 18%;
  pointer-events: none;
  z-index: 200;
}
.reel-fade-top {
  top: 0;
  background: linear-gradient(180deg, var(--bg), transparent);
}
.reel-fade-bottom {
  bottom: 0;
  background: linear-gradient(0deg, var(--bg), transparent);
}

/* ── A–Z rail ── */
.reel-az {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 300;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 7px 4px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--glass-strong);
  backdrop-filter: blur(10px);
  max-height: 86%;
  overflow-y: auto;
  scrollbar-width: none;
  animation: reel-az-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.3s backwards;
}
.reel-az::-webkit-scrollbar {
  display: none;
}
@keyframes reel-az-in {
  from {
    opacity: 0;
    transform: translateY(-50%) translateX(16px);
  }
}
.reel-az-l {
  width: 20px;
  height: 17px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--t3);
  font-family: var(--font);
  font-size: 9.5px;
  font-weight: 800;
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s,
    transform 0.2s;
}
.reel-az-l:hover {
  color: var(--t1);
  transform: scale(1.3);
}
.reel-az-l.on {
  background: var(--adim);
  color: var(--accent);
}

/* ── Count pill ── */
.reel-count {
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  z-index: 300;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 12px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--glass-strong);
  backdrop-filter: blur(10px);
  color: var(--t2);
  font-size: 11.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  cursor: default;
  animation: reel-az-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.35s backwards;
}
.reel-count-arrow {
  width: 22px;
  height: 22px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--elevated);
  color: var(--t2);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s,
    transform 0.2s;
}
.reel-count-arrow:hover {
  color: var(--t1);
  border-color: var(--accent);
  transform: scale(1.1);
}

/* ── Empty state ── */
.reel-empty {
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
.reel-empty-icon {
  font-size: 44px;
  opacity: 0.6;
}
.reel-empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--t1);
}
.reel-empty-text {
  font-size: 13px;
  max-width: 280px;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .strip,
  .reel-lens,
  .reel-az,
  .reel-count,
  .strip.is-focus .strip-shine::after {
    animation: none;
  }
}
</style>
