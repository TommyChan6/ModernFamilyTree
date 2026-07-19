<template>
  <div
    ref="stageEl"
    class="stage"
    :class="['stage-' + mode, { 'stage-dragging': dragging }]"
    :style="stageVars"
    @pointerdown="onDown"
    @wheel.prevent="onWheel"
  >
    <!-- Ambience: spotlight floor + drifting dust motes -->
    <div class="stage-floor" aria-hidden="true"></div>
    <div class="stage-dust" aria-hidden="true"><i v-for="n in 7" :key="n"></i></div>

    <!-- Empty roster -->
    <div v-if="!persons.length" class="stage-empty">
      <div class="stage-empty-icon">🃏</div>
      <div class="stage-empty-title">Nothing to deal</div>
      <div class="stage-empty-text">No people match — clear the search or add someone.</div>
    </div>

    <!-- The 3D scene. Re-keyed per mode so switching re-deals the cards. -->
    <div v-else :key="mode" class="stage-scene">
      <div
        v-for="s in slots"
        :key="s.p.id"
        class="stage-slot"
        :class="{ 'is-focus': s.i === focusedIndex }"
        :style="s.style"
        @click="onSlotClick($event, s)"
      >
        <div class="stage-deal" :style="{ '--k': Math.min(Math.abs(s.i - focusedIndex), 9) }">
          <PersonCard
            :person="s.p"
            :selected="store.selectedPersonId === s.p.id"
            :kin="statsOf(s.p.id).kin"
            :children="statsOf(s.p.id).children"
            :ref-year="refYear"
            :tags="store.tagsOf.get(s.p.id) || []"
            :card-style="store.cardStyle"
          />
        </div>
      </div>
    </div>

    <!-- Sparkle burst when the front card is opened -->
    <div
      v-if="burst"
      :key="burst.key"
      class="stage-burst"
      :style="{ left: burst.x + 'px', top: burst.y + 'px' }"
    >
      <i
        v-for="n in 10"
        :key="n"
        :style="{ '--a': (n - 1) * 36 + 'deg', '--r': 60 + (n % 3) * 26 + 'px' }"
      ></i>
    </div>

    <!-- HUD: focused person caption + scrubber -->
    <div v-if="persons.length" class="stage-hud" @pointerdown.stop>
      <Transition name="stage-cap" mode="out-in">
        <div :key="focused?.id" class="stage-caption">
          <span class="stage-cap-name">{{ focused?.name || 'Unnamed' }}</span>
          <span class="stage-cap-sub">{{ capSub }}</span>
        </div>
      </Transition>
      <div class="stage-scrub">
        <button class="stage-arrow" title="Previous (←)" @click="step(-1)">‹</button>
        <input
          class="stage-range"
          type="range"
          :min="0"
          :max="Math.max(0, persons.length - 1)"
          :value="focusedIndex"
          @input="goTo(+$event.target.value)"
        />
        <button class="stage-arrow" title="Next (→)" @click="step(1)">›</button>
        <span class="stage-count">{{ focusedIndex + 1 }} / {{ persons.length }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useMainStore } from '../../store/index.js'
import PersonCard from './PersonCard.vue'
import { CARD_W, CARD_H } from './peopleLayout.js'

// The Directory's 3D stage: the non-grid viewing modes. One shared physics
// engine — a fractional focus position `pos` driven by drag / wheel / keys
// with momentum and spring snapping — and per-mode transform math that places
// each card in 3D. Only a small window of cards around the focus is mounted,
// so a 5,000-person roster renders ~20 cards.
//
//   wheel — cards on a 3D carousel ring; the front card faces you, the rest
//           recede around the circle. Drag to spin.
//   flow  — coverflow: a flat centre card between two tilted walls, with
//           floor reflections.
//   fan   — a hand of cards arcing around a distant pivot, like holding them.
//   deck  — a swipe deck: the top card flings off as you advance.

const props = defineProps({
  mode: { type: String, required: true }, // 'wheel' | 'flow' | 'fan' | 'deck'
  persons: { type: Array, required: true },
  statsOf: { type: Function, required: true },
  refYear: { type: Number, required: true }
})

const store = useMainStore()
const stageEl = ref(null)

const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const stageVars = computed(() => ({
  '--card-w': CARD_W + 'px',
  '--card-h': CARD_H + 'px'
}))

// ── Shared physics: fractional focus position with spring + momentum ────────
const pos = ref(0)
const target = ref(null)
const dragging = ref(false)

const count = computed(() => props.persons.length)
const clampIdx = (v) => Math.max(0, Math.min(Math.max(0, count.value - 1), v))
const focusedIndex = computed(() => clampIdx(Math.round(pos.value)))
const focused = computed(() => props.persons[focusedIndex.value] || null)

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
  pos.value += diff * (reduceMotion ? 1 : 0.16)
  startLoop()
}

function goTo(i) {
  target.value = clampIdx(Math.round(i))
  startLoop()
}
function step(delta) {
  goTo((target.value ?? Math.round(pos.value)) + delta)
}

// Pixels of drag per card step — tuned per mode's visual density.
const PX_PER_CARD = { wheel: 72, flow: 112, fan: 48, deck: 150 }

let lastX = 0
let vel = 0
let moved = false
function onDown(e) {
  if (e.button !== 0) return
  if (e.target.closest('.stage-hud')) return
  dragging.value = true
  moved = false
  lastX = e.clientX
  vel = 0
  target.value = null
  // No pointer capture here — capturing would retarget pointerup to the stage
  // and the browser would never deliver a `click` to the card slots. The
  // window-level move/up listeners cover drags that leave the stage.
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}
function onMove(e) {
  if (!dragging.value) return
  const dx = e.clientX - lastX
  lastX = e.clientX
  if (!moved && Math.abs(dx) > 4) moved = true
  const per = PX_PER_CARD[props.mode] || 100
  // Soft rubber-band a little past both ends.
  pos.value = Math.max(-0.35, Math.min(count.value - 0.65, pos.value - dx / per))
  vel = vel * 0.8 + (-dx / per) * 0.2
}
function onUp() {
  if (!dragging.value) return
  dragging.value = false
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  // Fling with the release velocity, then snap to the nearest card.
  target.value = clampIdx(Math.round(pos.value + vel * 9))
  startLoop()
  // `moved` stays set for the click that follows a drag (see onSlotClick).
}

// Wheel / trackpad: accumulate deltas into whole-card steps.
let wheelAcc = 0
function onWheel(e) {
  wheelAcc += e.deltaY + e.deltaX
  if (Math.abs(wheelAcc) < 42) return
  step(Math.sign(wheelAcc))
  wheelAcc = 0
}

// Keyboard: arrows / Home / End / Enter — only while nothing overlays us.
function onKeydown(e) {
  if (store.modalOpen || store.formOpen || store.curtain.active) return
  if (store.appSettingsOpen || store.userPageOpen) return
  const t = e.target
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    step(-1)
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    step(1)
  } else if (e.key === 'Home') {
    e.preventDefault()
    goTo(0)
  } else if (e.key === 'End') {
    e.preventDefault()
    goTo(count.value - 1)
  } else if (e.key === 'Enter' && focused.value) {
    e.preventDefault()
    store.selectPerson(focused.value.id)
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  if (raf) cancelAnimationFrame(raf)
})

// Keep the focus valid when the roster shrinks (search/filter changes).
watch(count, (n) => {
  if (pos.value > n - 1) pos.value = Math.max(0, n - 1)
  if (target.value != null && target.value > n - 1) target.value = Math.max(0, n - 1)
})

// ── Per-mode card placement ─────────────────────────────────────────────────
const WINDOW = { wheel: 8, flow: 6, fan: 10, deck: 6 }

function styleFor(i) {
  const d = i - pos.value
  const ad = Math.abs(d)
  let transform = ''
  let filter = ''
  let opacity = 1
  let zIndex = 1000 - Math.round(ad * 20)

  if (props.mode === 'wheel') {
    // Ring: step the angle so ~a dozen cards wrap the visible half-circle;
    // radius chosen so neighbours half-overlap like a semi-stacked circle.
    const stepDeg = Math.min(42, Math.max(15, 360 / Math.max(count.value, 9)))
    const R = Math.min(980, Math.max(300, (CARD_W * 0.66) / Math.tan((stepDeg * Math.PI) / 360)))
    const angle = d * stepDeg
    transform = `translateZ(${-R}px) rotateY(${-angle}deg) translateZ(${R}px)`
    filter = `brightness(${Math.max(0.45, 1 - ad * 0.13)})`
  } else if (props.mode === 'flow') {
    const a = Math.max(-1, Math.min(1, d))
    const x = d * 118 + a * 64
    const z = (1 - Math.abs(a)) * 150
    const rot = -a * 52
    const s = 1 + (1 - Math.abs(a)) * 0.07
    transform = `translateX(${x}px) translateZ(${z}px) rotateY(${rot}deg) scale(${s})`
    filter = `brightness(${Math.max(0.5, 1 - ad * 0.09)})`
  } else if (props.mode === 'fan') {
    const angle = Math.max(-80, Math.min(80, d * 7.5))
    const pop = Math.max(0, 1 - ad)
    transform = `rotate(${angle}deg) translateY(${-pop * 44}px) scale(${1 + pop * 0.05})`
    filter = `brightness(${Math.max(0.55, 1 - ad * 0.05)})`
  } else {
    // deck
    if (d >= 0) {
      const alt = ((i % 2) * 2 - 1) * Math.min(d, 3) * 1.5
      transform = `translateY(${d * 9}px) translateZ(${-d * 30}px) rotate(${alt}deg)`
      filter = `brightness(${Math.max(0.5, 1 - d * 0.09)})`
      if (d > 4.2) opacity = Math.max(0, 1 - (d - 4.2))
      zIndex = 1000 - Math.round(d * 10)
    } else {
      // Swiped past: fling off to the left, spinning and fading.
      transform = `translateX(${d * 470}px) rotate(${d * 24}deg)`
      opacity = Math.max(0, 1 + d * 1.05)
      zIndex = 1100
    }
  }

  return { transform, filter, opacity, zIndex }
}

const slots = computed(() => {
  const n = count.value
  if (!n) return []
  const c = focusedIndex.value
  const W = WINDOW[props.mode] || 7
  const lo = Math.max(0, c - (props.mode === 'deck' ? 2 : W))
  const hi = Math.min(n - 1, c + W)
  const out = []
  for (let i = lo; i <= hi; i++) {
    out.push({ p: props.persons[i], i, style: styleFor(i) })
  }
  return out
})

// ── Interaction: click focuses a card; clicking the front card opens it ─────
const burst = ref(null)
let burstTimer = 0
function onSlotClick(e, s) {
  if (moved) {
    moved = false
    return
  }
  if (s.i !== focusedIndex.value) {
    goTo(s.i)
    return
  }
  // Sparkle burst at the click point, then open the profile.
  const box = stageEl.value?.getBoundingClientRect()
  if (box && !reduceMotion) {
    burst.value = { x: e.clientX - box.left, y: e.clientY - box.top, key: e.timeStamp }
    clearTimeout(burstTimer)
    burstTimer = setTimeout(() => (burst.value = null), 700)
  }
  store.selectPerson(s.p.id)
}
onBeforeUnmount(() => clearTimeout(burstTimer))

const capSub = computed(() => {
  const p = focused.value
  if (!p) return ''
  const b = p.birth?.year
  const dd = p.death?.year
  const life = b && dd ? `${b} – ${dd}` : b ? `b. ${b}` : dd ? `d. ${dd}` : ''
  return [life, p.occupation].filter(Boolean).join(' · ')
})
</script>

<style scoped>
.stage {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  touch-action: pan-y;
}
.stage-dragging {
  cursor: grabbing;
}
/* While spinning, skip card hover/hit-testing — restyling cards mid-drag is
   needless style recalc, and the grab cursor should win. */
.stage-dragging :deep(.pcard) {
  pointer-events: none;
}

/* ── Ambience ── */
.stage-floor {
  position: absolute;
  left: 50%;
  bottom: 6%;
  width: 760px;
  height: 190px;
  transform: translateX(-50%);
  background: radial-gradient(
    50% 50% at 50% 50%,
    rgba(108, 142, 245, 0.14),
    rgba(108, 142, 245, 0.04) 55%,
    transparent 75%
  );
  pointer-events: none;
}
.stage-dust {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.stage-dust i {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0.16;
  animation: stage-dust-float var(--dur, 16s) ease-in-out infinite alternate;
}
.stage-dust i:nth-child(1) {
  left: 12%;
  top: 30%;
  --dur: 17s;
}
.stage-dust i:nth-child(2) {
  left: 26%;
  top: 68%;
  width: 3px;
  height: 3px;
  --dur: 21s;
}
.stage-dust i:nth-child(3) {
  left: 44%;
  top: 16%;
  --dur: 15s;
}
.stage-dust i:nth-child(4) {
  left: 62%;
  top: 74%;
  --dur: 23s;
}
.stage-dust i:nth-child(5) {
  left: 78%;
  top: 26%;
  width: 3px;
  height: 3px;
  --dur: 19s;
}
.stage-dust i:nth-child(6) {
  left: 88%;
  top: 58%;
  --dur: 16s;
}
.stage-dust i:nth-child(7) {
  left: 8%;
  top: 82%;
  width: 5px;
  height: 5px;
  --dur: 25s;
}
@keyframes stage-dust-float {
  from {
    transform: translate(0, 0);
  }
  to {
    transform: translate(26px, -34px);
  }
}

/* ── Scene ── */
.stage-scene {
  position: absolute;
  inset: 0;
  perspective: 1300px;
  perspective-origin: 50% 42%;
  /* NOT preserve-3d: Chromium's hit-testing misses rotated children inside a
     preserve-3d context (clicks fall through to the container). Each slot gets
     its own 3D rendering from the perspective above, and inter-card occlusion
     is already driven by the per-slot zIndex, so flattening changes nothing
     visually while keeping every card clickable. */
}
/* The hand sits lower, like cards held at the table's edge. */
.stage-fan .stage-scene {
  transform: translateY(7%);
}

.stage-slot {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--card-w, 210px);
  height: var(--card-h, 297px);
  margin: calc(var(--card-h, 297px) / -2 - 14px) 0 0 calc(var(--card-w, 210px) / -2);
  will-change: transform;
}
.stage-fan .stage-slot {
  transform-origin: 50% 1450px;
}
/* Ring cards face outward — hide the mirrored backs of far-side cards so they
   can't bleed through the front of the carousel. */
.stage-wheel .stage-slot {
  backface-visibility: hidden;
}
/* Coverflow reflections on the glossy floor. */
.stage-flow .stage-slot {
  -webkit-box-reflect: below 12px linear-gradient(transparent 72%, rgba(0, 0, 0, 0.28));
}
/* The focused card gets a grounding shadow so it reads "in front". */
.stage-slot.is-focus::after {
  content: '';
  position: absolute;
  left: 8%;
  right: 8%;
  bottom: -26px;
  height: 26px;
  border-radius: 50%;
  background: radial-gradient(50% 50% at 50% 50%, rgba(0, 0, 0, 0.4), transparent 70%);
  pointer-events: none;
}

/* Deal-in entrance (on the inner wrapper so it composes with the slot's 3D
   transform), staggered outward from the focused card. */
.stage-deal {
  width: 100%;
  height: 100%;
  animation: stage-deal-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) calc(var(--k, 0) * 0.05s) backwards;
}
@keyframes stage-deal-in {
  from {
    opacity: 0;
    transform: translateY(70px) scale(0.72) rotate(3deg);
  }
}

/* ── Sparkle burst on open ── */
.stage-burst {
  position: absolute;
  z-index: 2000;
  pointer-events: none;
}
.stage-burst i {
  position: absolute;
  width: 6px;
  height: 6px;
  margin: -3px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 10px var(--accent);
  animation: stage-burst-fly 0.65s cubic-bezier(0.2, 0.7, 0.4, 1) forwards;
}
@keyframes stage-burst-fly {
  from {
    opacity: 1;
    transform: rotate(var(--a, 0deg)) translateX(6px) scale(1);
  }
  to {
    opacity: 0;
    transform: rotate(var(--a, 0deg)) translateX(var(--r, 70px)) scale(0.2);
  }
}

/* ── HUD ── */
.stage-hud {
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  z-index: 1500;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  padding: 10px 16px 11px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--glass-strong);
  backdrop-filter: blur(14px) saturate(1.2);
  box-shadow: var(--shadow);
  cursor: default;
  animation: stage-hud-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.25s backwards;
}
@keyframes stage-hud-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(16px);
  }
}
.stage-caption {
  display: flex;
  align-items: baseline;
  gap: 9px;
  max-width: 420px;
}
.stage-cap-name {
  font-size: 15px;
  font-weight: 800;
  color: var(--t1);
  letter-spacing: -0.2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stage-cap-sub {
  font-size: 11px;
  font-weight: 600;
  color: var(--t3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stage-cap-enter-active {
  transition:
    opacity 0.18s ease,
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
.stage-cap-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}
.stage-cap-enter-from {
  opacity: 0;
  transform: translateY(7px);
}
.stage-cap-leave-to {
  opacity: 0;
  transform: translateY(-7px);
}

.stage-scrub {
  display: flex;
  align-items: center;
  gap: 9px;
}
.stage-arrow {
  width: 26px;
  height: 26px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--elevated);
  color: var(--t2);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s,
    transform 0.2s;
}
.stage-arrow:hover {
  color: var(--t1);
  border-color: var(--accent);
  transform: scale(1.08);
}
.stage-range {
  -webkit-appearance: none;
  appearance: none;
  width: 190px;
  height: 4px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: var(--elevated);
  cursor: pointer;
  box-shadow: none;
}
.stage-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 10px rgba(108, 142, 245, 0.6);
  transition: transform 0.15s;
}
.stage-range::-webkit-slider-thumb:hover {
  transform: scale(1.25);
}
.stage-count {
  font-size: 11px;
  font-weight: 700;
  color: var(--t3);
  font-variant-numeric: tabular-nums;
  min-width: 52px;
  text-align: right;
}

/* ── Empty ── */
.stage-empty {
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
.stage-empty-icon {
  font-size: 44px;
  opacity: 0.6;
}
.stage-empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--t1);
}
.stage-empty-text {
  font-size: 13px;
  max-width: 280px;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .stage-dust i,
  .stage-deal,
  .stage-hud,
  .stage-burst i {
    animation: none;
  }
}
</style>
