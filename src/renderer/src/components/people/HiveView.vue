<template>
  <div ref="scrollEl" class="hive" @scroll.passive="onScroll">
    <!-- A light band that sweeps diagonally across the comb every few seconds.
         Sticky + zero-height so it rides the viewport, not the scroll. -->
    <div class="hive-sweep" aria-hidden="true"><i></i></div>

    <div v-if="!persons.length" class="hive-empty">
      <div class="hive-empty-icon">⬡</div>
      <div class="hive-empty-title">The hive is empty</div>
      <div class="hive-empty-text">No people match — clear the search or add someone.</div>
    </div>

    <div v-else class="hive-sizer" :style="{ height: totalH + 'px' }">
      <div
        v-for="c in cells"
        :key="c.key"
        class="hex"
        :class="{
          'hex-empty': !c.p,
          'hex-enter': c.p && entering,
          selected: c.p && store.selectedPersonId === c.p.id,
          dead: c.p && c.dead
        }"
        :style="c.style"
        @click="c.p && select(c.p.id)"
      >
        <template v-if="c.p">
          <div class="hex-in" :style="{ '--hc': c.color }">
            <div class="hex-body">
              <HexArt :person="c.p" />
              <div class="hex-scrim"></div>
              <div class="hex-label">
                <div class="hex-name">{{ c.p.name || 'Unnamed' }}</div>
                <div class="hex-year">
                  {{ c.p.birth?.year || '·' }}<span v-if="c.dead"> ☾</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, h } from 'vue'
import { useMainStore } from '../../store/index.js'
import { isDeceased } from './peopleLayout.js'
import { useThumbnail } from './useThumbnail.js'

// The Hive: every person is a hexagon in a honeycomb. Native vertical scroll
// with row windowing (only combs near the viewport exist in the DOM), a wave
// entrance rippling from the top-left, and decorative empty combs completing
// the final row so the comb always reads as one organism.

const props = defineProps({
  persons: { type: Array, required: true },
  refYear: { type: Number, required: true }
})

const store = useMainStore()
const scrollEl = ref(null)

// One comb's art: the person's thumbnail (cached, downscaled) or a monogram.
// A tiny functional-ish child component so each visible cell owns its own
// reactive thumbnail without a per-cell watcher zoo in the parent.
const HexArt = {
  props: { person: { type: Object, required: true } },
  setup(p) {
    const { src } = useThumbnail(() => p.person.primary_image || '', 192)
    const initials = computed(() => {
      const parts = (p.person.name || '?').trim().split(/\s+/).filter(Boolean)
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      return (parts[0] || '?').substring(0, 2).toUpperCase()
    })
    return () =>
      src.value
        ? h('img', { class: 'hex-img', src: src.value, alt: '', draggable: false })
        : h('div', { class: 'hex-mono' }, initials.value)
  }
}

// ── Honeycomb geometry (pointy-top hexes, odd rows shifted half a cell) ─────
const HEX_W = 126
const HEX_H = Math.round(HEX_W * 1.1547) // 146
const PITCH = Math.round(HEX_H * 0.75) // vertical row pitch
const PAD = 26
const OVERSCAN = 2

const viewW = ref(0)
const viewH = ref(0)
const scrollTop = ref(0)

const cols = computed(() => Math.max(1, Math.floor((viewW.value - PAD * 2 - HEX_W / 2) / HEX_W)))
const rows = computed(() => Math.ceil(props.persons.length / cols.value))
const totalH = computed(() =>
  props.persons.length ? PAD * 2 + (rows.value - 1) * PITCH + HEX_H : 0
)

let raf = 0
function onScroll() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    scrollTop.value = scrollEl.value?.scrollTop || 0
  })
}
function remeasure() {
  const el = scrollEl.value
  if (!el) return
  viewW.value = el.clientWidth
  viewH.value = el.clientHeight
  scrollTop.value = el.scrollTop
}
let ro = null
onMounted(() => {
  nextTick(remeasure)
  ro = new ResizeObserver(remeasure)
  if (scrollEl.value) ro.observe(scrollEl.value)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  if (raf) cancelAnimationFrame(raf)
  clearTimeout(enterTimer)
})

const genderColor = (p) =>
  p.gender === 'male'
    ? store.graphSettings.maleColor
    : p.gender === 'female'
      ? store.graphSettings.femaleColor
      : store.graphSettings.unknownColor

const cells = computed(() => {
  const n = props.persons.length
  const c = cols.value
  if (!n || !c) return []
  const firstRow = Math.max(0, Math.floor((scrollTop.value - PAD) / PITCH) - OVERSCAN)
  const lastRow = Math.min(
    rows.value, // one past the person rows → room for the decorative row
    Math.ceil((scrollTop.value + viewH.value - PAD) / PITCH) + OVERSCAN
  )
  const out = []
  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = 0; col < c; col++) {
      const i = row * c + col
      const p = i < n ? props.persons[i] : null
      // Decorative empty combs: finish the last person row and add one echo row.
      if (!p && row > rows.value) continue
      if (!p && i >= n + c + (c - (n % c || c))) continue
      const x = PAD + col * HEX_W + (row % 2 ? HEX_W / 2 : 0)
      const y = PAD + row * PITCH
      out.push({
        key: p ? p.id : 'e' + i,
        p,
        dead: p ? isDeceased(p, props.refYear) : false,
        color: p ? genderColor(p) : '',
        style: {
          transform: `translate(${x}px, ${y}px)`,
          '--hd': Math.min((row - firstRow) * 3 + col, 26)
        }
      })
    }
  }
  return out
})

// Entrance wave replays when the roster changes (mount, search, sort, filter);
// combs mounted later by scrolling just appear.
const entering = ref(true)
let enterTimer = setTimeout(() => (entering.value = false), 1600)
watch(
  () => props.persons,
  () => {
    entering.value = true
    clearTimeout(enterTimer)
    enterTimer = setTimeout(() => (entering.value = false), 1600)
    if (scrollEl.value) scrollEl.value.scrollTop = 0
  }
)

function select(id) {
  store.selectPerson(id)
}
</script>

<style scoped>
.hive {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
}

/* ── Sweeping light band ── */
.hive-sweep {
  position: sticky;
  top: 0;
  height: 0;
  z-index: 4;
  pointer-events: none;
}
.hive-sweep i {
  position: absolute;
  top: -10%;
  left: 0;
  width: 26%;
  height: 120vh;
  transform: skewX(-18deg) translateX(-140%);
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.05) 35%,
    rgba(255, 255, 255, 0.1) 50%,
    rgba(255, 255, 255, 0.05) 65%,
    transparent
  );
  animation: hive-sweep-run 9s ease-in-out infinite;
}
@keyframes hive-sweep-run {
  0%,
  55% {
    transform: skewX(-18deg) translateX(-140%);
  }
  85%,
  100% {
    transform: skewX(-18deg) translateX(520%);
  }
}

.hive-sizer {
  position: relative;
  width: 100%;
}

/* ── One comb ── */
.hex {
  position: absolute;
  top: 0;
  left: 0;
  width: 126px;
  height: 146px;
  cursor: pointer;
  /* transform carries the honeycomb position; hover effects live inside */
}
.hex-enter .hex-in,
.hex-enter.hex .hex-in {
  animation: hex-in 0.6s cubic-bezier(0.34, 1.35, 0.5, 1) calc(var(--hd, 0) * 0.045s) backwards;
}
@keyframes hex-in {
  from {
    opacity: 0;
    transform: scale(0.25) rotate(-14deg);
  }
}

.hex-in {
  --hc: var(--accent);
  position: absolute;
  inset: 0;
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--hc) 75%, #fff) 0%,
    color-mix(in srgb, var(--hc) 55%, transparent) 45%,
    color-mix(in srgb, var(--hc) 30%, transparent) 100%
  );
  transition: transform 0.28s cubic-bezier(0.34, 1.4, 0.5, 1);
}
/* drop-shadow follows the clipped silhouette — the honeycomb's hover glow */
.hex:hover {
  z-index: 6;
}
.hex:hover .hex-in {
  transform: scale(1.13);
  filter: drop-shadow(0 10px 22px rgba(0, 0, 0, 0.55))
    drop-shadow(0 0 14px color-mix(in srgb, var(--hc) 65%, transparent));
}
.hex.selected .hex-in {
  filter: drop-shadow(0 0 12px color-mix(in srgb, var(--hc) 85%, transparent));
  animation: hex-selected-pulse 2.2s ease-in-out infinite;
}
@keyframes hex-selected-pulse {
  0%,
  100% {
    filter: drop-shadow(0 0 8px color-mix(in srgb, var(--hc) 70%, transparent));
  }
  50% {
    filter: drop-shadow(0 0 18px color-mix(in srgb, var(--hc) 95%, transparent));
  }
}

.hex-body {
  position: absolute;
  inset: 2.5px;
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  background: var(--surface);
  overflow: hidden;
}
.hex :deep(.hex-img) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}
.hex:hover :deep(.hex-img) {
  transform: scale(1.1);
}
.hex.dead :deep(.hex-img) {
  filter: grayscale(0.5) sepia(0.1);
}
.hex :deep(.hex-mono) {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-bottom: 26px;
  font-size: 30px;
  font-weight: 800;
  color: color-mix(in srgb, var(--hc) 70%, var(--t1));
  background: radial-gradient(
    90% 80% at 50% 20%,
    color-mix(in srgb, var(--hc) 30%, transparent),
    transparent 75%
  );
  text-shadow: 0 0 18px color-mix(in srgb, var(--hc) 55%, transparent);
}

.hex-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 48%, rgba(8, 10, 18, 0.82) 88%);
}
.hex-label {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 17px;
  text-align: center;
}
.hex-name {
  font-size: 10.5px;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}
.hex-year {
  font-size: 9px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.62);
  font-variant-numeric: tabular-nums;
}

/* Decorative empty combs — faint outlines that complete the honeycomb */
.hex-empty {
  cursor: default;
  pointer-events: none;
}
.hex-empty::before {
  content: '';
  position: absolute;
  inset: 2.5px;
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  background: color-mix(in srgb, var(--t3) 9%, transparent);
}

/* ── Empty state ── */
.hive-empty {
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
.hive-empty-icon {
  font-size: 44px;
  opacity: 0.6;
}
.hive-empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--t1);
}
.hive-empty-text {
  font-size: 13px;
  max-width: 280px;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .hive-sweep i,
  .hex-enter .hex-in,
  .hex.selected .hex-in {
    animation: none;
  }
}
</style>
