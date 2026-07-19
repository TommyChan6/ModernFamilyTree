<template>
  <div ref="layerEl" class="wheel-layer" @pointerdown="onDown" @contextmenu.prevent>
    <div class="wheel" :style="{ left: x + 'px', top: y + 'px' }">
      <svg class="wheel-svg" viewBox="-132 -132 264 264" aria-hidden="true">
        <!-- soft glass base under the sectors -->
        <circle class="wheel-base" r="120" />
        <g
          v-for="(s, i) in slots"
          :key="i"
          class="wheel-sector"
          :class="{
            hi: i === highlight,
            'is-empty': s.empty,
            'is-disabled': s.disabled,
            'is-active': activeId && s.id === activeId
          }"
          :style="sectorStyle(i, s)"
        >
          <path class="wheel-fill" :d="sectorPath(i, 42, 116)" />
          <g class="wheel-ic-g" :transform="iconTransform(i)">
            <text class="wheel-ic" text-anchor="middle" dominant-baseline="central">
              {{ s.empty ? '+' : s.icon }}
            </text>
            <circle v-if="s.kind === 'paint'" class="wheel-paint-dot" cx="11" cy="11" r="5" />
            <text
              v-if="s.disabled"
              class="wheel-lock"
              x="12"
              y="-10"
              text-anchor="middle"
              dominant-baseline="central"
            >
              🔒
            </text>
          </g>
        </g>
      </svg>
      <!-- center hub: names whatever the pointer is aiming at -->
      <div class="wheel-hub" :class="{ aimed: hi }">
        <Transition name="hub" mode="out-in">
          <div v-if="hi" :key="hi.id + highlight" class="wheel-hub-inner" :style="hubStyle">
            <span class="wheel-hub-ic">{{ hi.empty ? '＋' : hi.icon }}</span>
            <span class="wheel-hub-label">{{ hi.label }}</span>
          </div>
          <div v-else key="idle" class="wheel-hub-inner wheel-hub-idle">
            <span class="wheel-hub-ic">✥</span>
            <span class="wheel-hub-label">Edit</span>
          </div>
        </Transition>
      </div>
      <div class="wheel-tip">release to select · <b>C</b> customize · <b>Esc</b> cancel</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { sectorPath, sectorCentroid, sectorUnit, sectorFromPoint } from './wheelModes.js'

const props = defineProps({
  slots: { type: Array, required: true }, // 8 resolved slots (resolveWheelSlots)
  x: { type: Number, required: true }, // wheel center, container px
  y: { type: Number, required: true },
  activeId: { type: String, default: null } // currently active mode (rendered lit)
})
const emit = defineEmits(['update:highlight', 'pick', 'cancel'])

const layerEl = ref(null)
const highlight = ref(null)
let origin = null // wheel center in CLIENT coords, for pointer math

function computeOrigin() {
  const r = layerEl.value?.getBoundingClientRect()
  origin = r ? { x: r.left + props.x, y: r.top + props.y } : null
}

function onMove(e) {
  if (!origin) computeOrigin()
  if (!origin) return
  const idx = sectorFromPoint(e.clientX - origin.x, e.clientY - origin.y)
  if (idx !== highlight.value) {
    highlight.value = idx
    emit('update:highlight', idx)
  }
}

// A click while the wheel is up commits the aimed sector (mouse-first users);
// clicking the dead zone cancels. Either way the canvas never sees the click.
function onDown(e) {
  e.preventDefault()
  e.stopPropagation()
  onMove(e)
  if (highlight.value != null) emit('pick', highlight.value)
  else emit('cancel')
}

onMounted(() => {
  computeOrigin()
  window.addEventListener('pointermove', onMove)
})
onUnmounted(() => window.removeEventListener('pointermove', onMove))

const hi = computed(() => (highlight.value != null ? props.slots[highlight.value] : null))
const hubStyle = computed(() => ({ '--sc': hi.value?.color || 'var(--accent)' }))

function sectorStyle(i, s) {
  const u = sectorUnit(i)
  return {
    '--i': i,
    '--sc': s.color || 'var(--accent)',
    '--ux': u.x.toFixed(3),
    '--uy': u.y.toFixed(3)
  }
}
function iconTransform(i) {
  const c = sectorCentroid(i, 79)
  return `translate(${c.x.toFixed(1)},${c.y.toFixed(1)})`
}
</script>

<style scoped>
/* The layer owns every pointer event while the wheel is up. */
.wheel-layer {
  position: absolute;
  inset: 0;
  z-index: 20;
  cursor: default;
}

.wheel {
  position: absolute;
  width: 0;
  height: 0;
}

.wheel-svg {
  position: absolute;
  left: -132px;
  top: -132px;
  width: 264px;
  height: 264px;
  overflow: visible;
}

.wheel-base {
  fill: var(--glass-strong);
  stroke: var(--border);
  stroke-width: 1;
  filter: drop-shadow(0 10px 34px rgba(0, 0, 0, 0.35));
  animation: wheel-base-in 0.34s cubic-bezier(0.22, 1.3, 0.36, 1) backwards;
}
@keyframes wheel-base-in {
  from {
    transform: scale(0.55);
    opacity: 0;
  }
}

/* Sectors bloom in clockwise, each springing out from the hub. */
.wheel-sector {
  transition: transform 0.22s cubic-bezier(0.34, 1.55, 0.5, 1);
  animation: wheel-sector-in 0.4s cubic-bezier(0.22, 1.35, 0.36, 1) backwards;
  animation-delay: calc(var(--i) * 0.026s);
}
@keyframes wheel-sector-in {
  from {
    transform: scale(0.4) rotate(-14deg);
    opacity: 0;
  }
}
.wheel-fill {
  fill: color-mix(in srgb, var(--sc) 7%, color-mix(in srgb, var(--surface) 72%, transparent));
  stroke: var(--border);
  stroke-width: 1;
  transition:
    fill 0.18s ease,
    stroke 0.18s ease;
}
.wheel-ic {
  font-size: 21px;
  fill: var(--t1);
  opacity: 0.92;
  transition: fill 0.18s ease;
  user-select: none;
}
.wheel-ic-g {
  transition: transform 0.2s cubic-bezier(0.34, 1.55, 0.5, 1);
}
.wheel-paint-dot {
  fill: var(--sc);
  stroke: var(--surface);
  stroke-width: 1.5;
}
.wheel-lock {
  font-size: 9px;
  opacity: 0.9;
}

/* Aimed sector: nudged outward along its direction, lit in its mode color. */
.wheel-sector.hi {
  transform: translate(calc(var(--ux) * 7px), calc(var(--uy) * 7px)) scale(1.03);
}
.wheel-sector.hi .wheel-fill {
  fill: color-mix(in srgb, var(--sc) 26%, var(--surface));
  stroke: color-mix(in srgb, var(--sc) 65%, transparent);
  filter: drop-shadow(0 0 14px color-mix(in srgb, var(--sc) 45%, transparent));
}
.wheel-sector.hi .wheel-ic {
  fill: var(--t1);
}
/* The mode that's already running keeps a quiet glow so you can find it. */
.wheel-sector.is-active .wheel-fill {
  stroke: color-mix(in srgb, var(--sc) 55%, transparent);
  fill: color-mix(in srgb, var(--sc) 13%, var(--surface));
}
.wheel-sector.is-empty .wheel-fill {
  fill: transparent;
  stroke-dasharray: 4 5;
}
.wheel-sector.is-empty .wheel-ic {
  fill: var(--t3);
  font-size: 24px;
}
.wheel-sector.is-disabled .wheel-ic {
  opacity: 0.35;
}
.wheel-sector.is-disabled .wheel-fill {
  fill: transparent;
}

/* ── Hub ─────────────────────────────────────────────────────────────────── */
.wheel-hub {
  position: absolute;
  left: -37px;
  top: -37px;
  width: 74px;
  height: 74px;
  border-radius: 50%;
  background: var(--glass-soft);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: wheel-base-in 0.3s cubic-bezier(0.22, 1.3, 0.36, 1) backwards;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}
.wheel-hub.aimed {
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  box-shadow: 0 0 18px color-mix(in srgb, var(--accent) 22%, transparent);
}
.wheel-hub-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  max-width: 66px;
}
.wheel-hub-ic {
  font-size: 19px;
  line-height: 1.2;
  color: var(--sc, var(--accent));
}
.wheel-hub-label {
  font-size: 9.5px;
  font-weight: 700;
  color: var(--t1);
  max-width: 64px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wheel-hub-idle .wheel-hub-ic {
  color: var(--t3);
}
.wheel-hub-idle .wheel-hub-label {
  color: var(--t3);
  font-weight: 600;
}
.hub-enter-active {
  transition:
    opacity 0.14s ease,
    transform 0.18s cubic-bezier(0.34, 1.5, 0.5, 1);
}
.hub-leave-active {
  transition: opacity 0.08s ease;
}
.hub-enter-from {
  opacity: 0;
  transform: scale(0.7);
}
.hub-leave-to {
  opacity: 0;
}

/* ── Footer tip ──────────────────────────────────────────────────────────── */
.wheel-tip {
  position: absolute;
  top: 138px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 10px;
  color: var(--t3);
  background: var(--glass-strong);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px 10px;
  animation: wheel-tip-in 0.5s ease 0.18s backwards;
}
.wheel-tip b {
  color: var(--t2);
}
@keyframes wheel-tip-in {
  from {
    opacity: 0;
    transform: translate(-50%, 6px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .wheel-base,
  .wheel-sector,
  .wheel-hub,
  .wheel-tip {
    animation: none;
  }
}
</style>
