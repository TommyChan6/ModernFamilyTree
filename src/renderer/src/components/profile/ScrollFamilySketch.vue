<template>
  <div class="fs" :style="{ width: sketch.w + 'px', height: sketch.h + 'px' }">
    <canvas ref="cv" class="fs-lines" aria-hidden="true"></canvas>
    <div
      class="fs-me"
      :class="{ 'fs-on': drawn }"
      :style="{ left: sketch.center.x + 'px', top: sketch.center.y + 'px' }"
    >
      <span class="fs-me-mark">{{ meChar }}</span>
    </div>
    <button
      v-for="(n, i) in sketch.nodes"
      :key="n.otherId + n.side"
      class="fs-node"
      :class="['fs-' + n.side, { 'fs-ended': n.ended, 'fs-on': drawn }]"
      :style="{ left: n.x + 'px', top: n.y + 'px', '--i': i }"
      :title="n.role + ' — ' + n.name"
      @click="emit('navigate', n.otherId)"
    >
      <span class="fs-dot"></span>
      <span class="fs-name">{{ n.name }}</span>
      <span class="fs-role">{{ n.role }}</span>
    </button>
    <span v-for="m in moreTags" :key="m.side" class="fs-more" :style="m.style">+{{ m.n }}</span>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { brushStroke, smoothPath, rng, INK } from '../../lib/inkArt'

// The handscroll's family leaf: a small brush-drawn diagram (parents above,
// siblings left, spouses right, children below). Lines are real brush strokes
// drawn into one canvas, written in one after another when the leaf first
// comes into view; names are buttons that travel to that person.

const props = defineProps({
  sketch: { type: Object, required: true },
  seed: { type: Number, default: 1 },
  /** Start writing the strokes (the leaf scrolled into view). */
  active: { type: Boolean, default: false },
  meChar: { type: String, default: '' },
  reduceMotion: { type: Boolean, default: false }
})
const emit = defineEmits(['navigate'])

const cv = ref(null)
const drawn = ref(false)
let raf = 0

const moreTags = computed(() => {
  const s = props.sketch
  const out = []
  const at = (side) => s.nodes.filter((n) => n.side === side)
  for (const side of ['parent', 'sibling', 'spouse', 'child']) {
    const n = s.more[side]
    if (!n) continue
    const row = at(side)
    const last = row[row.length - 1]
    if (!last) continue
    const dx = side === 'sibling' ? -70 : 70
    out.push({ side, n, style: { left: last.x + dx + 'px', top: last.y + 'px' } })
  }
  return out
})

// A hand never rules a straight line: each segment gets a midpoint nudged
// off-axis, and the corners of a bar soften as the brush turns.
const organicCache = new WeakMap()
function organic(pts, seed) {
  let hit = organicCache.get(pts)
  if (hit) return hit
  const r = rng(seed)
  const ctrl = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const nx = -(b.y - a.y) / len
    const ny = (b.x - a.x) / len
    const j = (r() - 0.5) * Math.min(5, len * 0.05)
    ctrl.push({ x: (a.x + b.x) / 2 + nx * j, y: (a.y + b.y) / 2 + ny * j })
    ctrl.push(b)
  }
  hit = smoothPath(ctrl, 6)
  organicCache.set(pts, hit)
  return hit
}

function paint(progress) {
  const c = cv.value
  if (!c) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const { w, h, lines } = props.sketch
  if (c.width !== Math.round(w * dpr)) {
    c.width = Math.round(w * dpr)
    c.height = Math.round(h * dpr)
  }
  const ctx = c.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  const n = lines.length
  lines.forEach((pts, i) => {
    // strokes overlap a little in time, like a hand moving on
    const t = Math.max(0, Math.min(1, progress * (n * 0.6 + 0.4) - i * 0.6))
    if (t <= 0) return
    brushStroke(ctx, organic(pts, props.seed + i * 13), {
      width: 4.4,
      color: INK.ink,
      alpha: 0.82,
      seed: props.seed + i * 13,
      dry: 0.28,
      taperIn: 0.1,
      taperOut: 0.25,
      wobble: 0.45,
      progress: t
    })
  })
}

function run() {
  cancelAnimationFrame(raf)
  if (props.reduceMotion) {
    paint(1)
    drawn.value = true
    return
  }
  drawn.value = true
  const D = 380 + props.sketch.lines.length * 110
  const t0 = performance.now()
  const step = (now) => {
    const k = Math.min(1, (now - t0) / D)
    paint(1 - Math.pow(1 - k, 2))
    if (k < 1) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

watch(
  () => [props.active, props.sketch],
  ([on]) => {
    if (on) run()
    else paint(0)
  }
)
onMounted(() => {
  if (props.active) run()
  else paint(0)
})
onUnmounted(() => cancelAnimationFrame(raf))
</script>

<style scoped>
.fs {
  position: relative;
  flex-shrink: 0;
}
.fs-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.fs-me {
  position: absolute;
  width: 46px;
  height: 46px;
  margin: -23px 0 0 -23px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px 9px 7px 10px / 9px 6px 10px 7px;
  background: var(--ps-cinnabar);
  box-shadow: inset 0 0 0 2px rgba(255, 240, 220, 0.18);
  mix-blend-mode: multiply;
  opacity: 0;
  transform: scale(1.5) rotate(-8deg);
}
.fs-me.fs-on {
  animation: fs-stamp 0.55s cubic-bezier(0.3, 1.5, 0.5, 1) 0.1s forwards;
}
.fs-me-mark {
  font-family: var(--font-brush);
  font-size: 26px;
  line-height: 1;
  color: var(--ps-paper);
}
@keyframes fs-stamp {
  60% {
    opacity: 1;
    transform: scale(0.94) rotate(-1deg);
  }
  to {
    opacity: 0.95;
    transform: scale(1) rotate(-3deg);
  }
}

.fs-node {
  position: absolute;
  width: 0;
  height: 0;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  overflow: visible;
}
.fs-dot {
  position: absolute;
  left: -7px;
  top: -7px;
  width: 14px;
  height: 14px;
  border-radius: 50% 46% 52% 48%;
  background: var(--ps-ink);
  opacity: 0;
  transform: scale(0.3);
  transition: transform 0.3s cubic-bezier(0.3, 1.6, 0.5, 1);
}
.fs-name,
.fs-role {
  position: absolute;
  left: 0;
  white-space: nowrap;
  transform: translateX(-50%);
  opacity: 0;
  text-shadow:
    0 0 6px var(--ps-paper),
    0 0 3px var(--ps-paper);
}
.fs-name {
  top: 13px;
  font-family: var(--font-brush);
  font-size: 17px;
  line-height: 1.1;
  color: var(--ps-ink);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fs-role {
  top: 33px;
  font-family: var(--font-ink-serif);
  font-size: 12.5px;
  font-style: italic;
  color: var(--ps-ink-soft);
}
/* parents read above their mark */
.fs-parent .fs-name {
  top: -48px;
}
.fs-parent .fs-role {
  top: -28px;
}
.fs-on .fs-dot {
  animation: fs-blot 0.6s cubic-bezier(0.25, 0.9, 0.3, 1) calc(0.25s + var(--i) * 0.09s) forwards;
}
.fs-on .fs-name,
.fs-on .fs-role {
  animation: fs-soak 0.9s cubic-bezier(0.25, 0.9, 0.3, 1) calc(0.4s + var(--i) * 0.09s) forwards;
}
@keyframes fs-blot {
  to {
    opacity: 0.85;
    transform: scale(1);
  }
}
@keyframes fs-soak {
  from {
    opacity: 0;
    filter: blur(3px);
  }
  to {
    opacity: 1;
    filter: blur(0);
  }
}
.fs-node:hover .fs-dot,
.fs-node:focus-visible .fs-dot {
  transform: scale(1.35);
  background: var(--ps-cinnabar);
}
.fs-node:hover .fs-name {
  color: var(--ps-cinnabar);
}
.fs-ended .fs-dot {
  background: transparent;
  box-shadow: inset 0 0 0 2px var(--ps-ink);
}
.fs-ended .fs-name {
  color: var(--ps-ink-soft);
}

.fs-more {
  position: absolute;
  transform: translate(-50%, -50%);
  font-family: var(--font-brush);
  font-size: 16px;
  color: var(--ps-ink-soft);
}

@media (prefers-reduced-motion: reduce) {
  .fs-me.fs-on,
  .fs-on .fs-dot,
  .fs-on .fs-name,
  .fs-on .fs-role {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .fs-me.fs-on {
    transform: rotate(-3deg);
  }
}
</style>
