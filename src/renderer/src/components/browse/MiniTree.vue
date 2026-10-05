<template>
  <!-- Cover: a glowing silhouette of the real tree, fitted into the card art -->
  <svg
    v-if="variant === 'cover'"
    class="mt-cover"
    :viewBox="coverBox"
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
  >
    <path v-for="(l, i) in coverLinks" :key="'l' + i" :d="l.d" class="mt-clink" :class="l.kind" />
    <circle
      v-for="(n, i) in layout.nodes"
      :key="n.id"
      :cx="n.x"
      :cy="n.y * ROW"
      :r="highlightSet.has(n.name) ? 0.3 : 0.19"
      class="mt-cnode"
      :class="[n.gender, { hit: highlightSet.has(n.name) }]"
      :style="{ animationDelay: (i % 7) * 0.45 + 's' }"
    />
  </svg>

  <!-- Full: pan / zoom / pick -->
  <div
    v-else
    ref="boxRef"
    class="mt-full"
    :class="{ dragging }"
    @wheel.prevent="onWheel"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @dblclick="fit"
  >
    <svg class="mt-svg">
      <g :transform="`translate(${view.tx} ${view.ty}) scale(${view.k})`">
        <path
          v-for="(l, i) in fullLinks"
          :key="'l' + i"
          :d="l.d"
          class="mt-link"
          :class="[l.kind, 't-' + l.type, { lit: litIds.has(l.a) || litIds.has(l.b) }]"
        >
          <title v-if="l.label">{{ l.label }}</title>
        </path>
        <g
          v-for="n in layout.nodes"
          :key="n.id"
          class="mt-node"
          :class="[
            n.gender,
            {
              sel: n.id === selected,
              hit: highlightSet.has(n.name),
              dim: dimOthers && !litIds.has(n.id)
            }
          ]"
          :transform="`translate(${n.x * UX} ${n.y * UY})`"
          @pointerenter="hover = n.id"
          @pointerleave="hover = null"
          @click.stop="pick(n.id)"
        >
          <circle class="mt-halo" r="24" />
          <circle class="mt-dot" r="16" />
          <text class="mt-initial" dy="0.36em">{{ initial(n.name) }}</text>
          <text class="mt-name" y="31">{{ short(n.name) }}</text>
          <text v-if="n.role" class="mt-role" y="43">{{ short(n.role, 16) }}</text>
        </g>
      </g>
    </svg>
  </div>
</template>

<script setup>
import { computed, reactive, ref, onMounted, onUnmounted, nextTick, watch } from 'vue'

const props = defineProps({
  /** TreeLayout from browseModel.treeOf() */
  layout: { type: Object, required: true },
  variant: { type: String, default: 'cover' }, // 'cover' | 'full'
  selected: { type: String, default: null },
  /** Person names to make glow (search hits). */
  highlight: { type: Array, default: () => [] }
})
const emit = defineEmits(['pick'])

const ROW = 1.35 // cover row height in layout units
const UX = 96 // full-view px per layout unit
const UY = 118

const highlightSet = computed(() => new Set(props.highlight))
const nodeById = computed(() => new Map(props.layout.nodes.map((n) => [n.id, n])))

// ── Cover ────────────────────────────────────────────────────────────────────
const coverBox = computed(() => {
  const w = Math.max(props.layout.width, 3)
  const h = Math.max((props.layout.generations - 1) * ROW, 1.2)
  const padX = 0.9
  const padY = 0.8
  const ox = (props.layout.width - w) / 2
  return `${ox - padX} ${-padY} ${w + padX * 2} ${h + padY * 2}`
})

function linkPath(a, b, kind, sx, sy) {
  const x1 = a.x * sx
  const y1 = a.y * sy
  const x2 = b.x * sx
  const y2 = b.y * sy
  if (kind === 'parent') {
    const my = (y1 + y2) / 2
    return `M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}`
  }
  if (kind === 'spouse' && a.y === b.y) {
    const lift = Math.min(Math.abs(x2 - x1) * 0.12, sy * 0.25)
    return `M${x1} ${y1} Q${(x1 + x2) / 2} ${y1 - lift} ${x2} ${y2}`
  }
  // Other bonds arc above the pair so they read as overlays, not lineage.
  const lift = Math.max(sy * 0.35, Math.abs(x2 - x1) * 0.22)
  return `M${x1} ${y1} Q${(x1 + x2) / 2} ${Math.min(y1, y2) - lift} ${x2} ${y2}`
}

const coverLinks = computed(() =>
  props.layout.links
    .map((l) => {
      const a = nodeById.value.get(l.a)
      const b = nodeById.value.get(l.b)
      return a && b ? { kind: l.kind, d: linkPath(a, b, l.kind, 1, ROW) } : null
    })
    .filter(Boolean)
)

// ── Full ─────────────────────────────────────────────────────────────────────
const boxRef = ref(null)
const view = reactive({ k: 1, tx: 0, ty: 0 })
const hover = ref(null)
const dragging = ref(false)

const fullLinks = computed(() =>
  props.layout.links
    .map((l) => {
      const a = nodeById.value.get(l.a)
      const b = nodeById.value.get(l.b)
      return a && b ? { ...l, d: linkPath(a, b, l.kind, UX, UY) } : null
    })
    .filter(Boolean)
)

// The hovered (or selected) person and everyone they're bonded to.
const focusId = computed(() => hover.value || props.selected)
const litIds = computed(() => {
  const id = focusId.value
  const out = new Set()
  if (!id) return out
  out.add(id)
  for (const l of props.layout.links) {
    if (l.a === id) out.add(l.b)
    if (l.b === id) out.add(l.a)
  }
  return out
})
const dimOthers = computed(() => !!focusId.value)

function initial(name) {
  const clean = name.replace(/^[“"'(]/, '')
  return [...clean][0] || '?'
}
function short(s, max = 13) {
  const chars = [...s]
  return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : s
}

function fit() {
  const el = boxRef.value
  if (!el) return
  const cw = el.clientWidth
  const ch = el.clientHeight
  const w = props.layout.width * UX + UX * 1.4
  const h = (props.layout.generations - 1) * UY + UY * 1.3
  const k = Math.min(cw / w, ch / h, 1.35)
  view.k = k
  view.tx = (cw - props.layout.width * UX * k) / 2
  view.ty = (ch - (props.layout.generations - 1) * UY * k) / 2 - 6 * k
}

function zoomAt(px, py, factor) {
  const k = Math.min(3, Math.max(0.25, view.k * factor))
  const f = k / view.k
  view.tx = px - (px - view.tx) * f
  view.ty = py - (py - view.ty) * f
  view.k = k
}

function onWheel(e) {
  const r = boxRef.value.getBoundingClientRect()
  zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015))
}

let drag = null
function onDown(e) {
  if (e.button !== 0) return
  drag = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false }
}
function onMove(e) {
  if (!drag) return
  const dx = e.clientX - drag.x
  const dy = e.clientY - drag.y
  if (!drag.moved && Math.hypot(dx, dy) < 4) return
  if (!drag.moved) {
    drag.moved = true
    dragging.value = true
    boxRef.value?.setPointerCapture?.(e.pointerId)
  }
  view.tx = drag.tx + dx
  view.ty = drag.ty + dy
}
function onUp() {
  // A drag that moved must not also count as a click on the node under it.
  if (drag?.moved) suppressClick = Date.now()
  drag = null
  dragging.value = false
}
let suppressClick = 0
function pick(id) {
  if (Date.now() - suppressClick < 60) return
  emit('pick', props.selected === id ? null : id)
}

let ro = null
onMounted(async () => {
  if (props.variant !== 'full') return
  await nextTick()
  fit()
  ro = new ResizeObserver(() => fit())
  if (boxRef.value) ro.observe(boxRef.value)
})
onUnmounted(() => ro?.disconnect())
watch(
  () => props.layout,
  () => nextTick(fit)
)

defineExpose({ fit, zoomIn: () => zoomCenter(1.25), zoomOut: () => zoomCenter(0.8) })
function zoomCenter(f) {
  const el = boxRef.value
  if (el) zoomAt(el.clientWidth / 2, el.clientHeight / 2, f)
}
</script>

<style scoped>
/* Tree art sits on the (always dark) project-hue cover, like a photo would,
   so it uses light strokes in both themes. */
.mt-cover {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
}

.mt-clink {
  fill: none;
  stroke: rgba(255, 255, 255, 0.32);
  stroke-width: 0.045;
  stroke-linecap: round;
}
.mt-clink.spouse {
  stroke: rgba(255, 255, 255, 0.55);
  stroke-width: 0.06;
}
.mt-clink.other {
  stroke: rgba(255, 255, 255, 0.22);
  stroke-dasharray: 0.12 0.12;
}

.mt-cnode {
  fill: rgba(255, 255, 255, 0.92);
  filter: drop-shadow(0 0 0.14px rgba(255, 255, 255, 0.9));
  transform-box: fill-box;
  transform-origin: center;
  animation: mt-twinkle 3.2s ease-in-out infinite;
}
.mt-cnode.m {
  fill: #cfe3ff;
}
.mt-cnode.f {
  fill: #ffd6e7;
}
.mt-cnode.hit {
  fill: #fff6c2;
  filter: drop-shadow(0 0 0.35px #ffe27a);
}

@keyframes mt-twinkle {
  0%,
  100% {
    opacity: 0.95;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.82);
  }
}

.mt-full {
  position: absolute;
  inset: 0;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.mt-full.dragging {
  cursor: grabbing;
}
.mt-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.mt-link {
  fill: none;
  stroke: rgba(255, 255, 255, 0.28);
  stroke-width: 1.6;
  stroke-linecap: round;
  transition:
    stroke 0.2s ease,
    opacity 0.2s ease,
    stroke-width 0.2s ease;
}
.mt-link.spouse {
  stroke: rgba(255, 255, 255, 0.6);
  stroke-width: 2.2;
}
.mt-link.other {
  stroke-dasharray: 5 5;
  stroke-width: 1.8;
  opacity: 0.8;
}
.mt-link.t-rival {
  stroke: var(--danger);
}
.mt-link.t-friends {
  stroke: var(--green);
}
.mt-link.t-mentor,
.mt-link.t-subordinate {
  stroke: var(--accent-2);
}
.mt-link.t-likes {
  stroke: var(--pink);
}
.mt-link.t-sibling {
  stroke: var(--amber);
}
.mt-link.lit {
  stroke-width: 3.2;
  opacity: 1;
}
.mt-full:has(.mt-node.dim) .mt-link:not(.lit) {
  opacity: 0.18;
}

.mt-node {
  cursor: pointer;
  transition: opacity 0.2s ease;
}
.mt-node.dim {
  opacity: 0.35;
}
.mt-halo {
  fill: rgba(255, 255, 255, 0.08);
  transition:
    fill 0.2s ease,
    r 0.2s ease;
}
.mt-dot {
  fill: #eef3ff;
  stroke: rgba(255, 255, 255, 0.9);
  stroke-width: 2;
  transition: transform 0.25s var(--ease-spring);
}
.mt-node.m .mt-dot {
  fill: #cfe0ff;
}
.mt-node.f .mt-dot {
  fill: #ffd4e5;
}
.mt-node:hover .mt-dot,
.mt-node.sel .mt-dot {
  transform: scale(1.14);
}
.mt-node:hover .mt-halo {
  fill: rgba(255, 255, 255, 0.16);
}
.mt-node.sel .mt-halo {
  fill: rgba(255, 226, 122, 0.3);
}
.mt-node.hit .mt-halo {
  fill: rgba(255, 226, 122, 0.4);
  animation: mt-pulse 1.6s ease-in-out infinite;
}
@keyframes mt-pulse {
  50% {
    fill: rgba(255, 226, 122, 0.12);
  }
}
.mt-initial {
  fill: #1a1d2e;
  font-size: 14px;
  font-weight: 800;
  text-anchor: middle;
  pointer-events: none;
}
.mt-name {
  fill: #f4f6ff;
  font-size: 11.5px;
  font-weight: 700;
  text-anchor: middle;
  paint-order: stroke;
  stroke: rgba(8, 10, 20, 0.75);
  stroke-width: 3px;
  pointer-events: none;
}
.mt-role {
  fill: rgba(235, 240, 255, 0.72);
  font-size: 9.5px;
  text-anchor: middle;
  paint-order: stroke;
  stroke: rgba(8, 10, 20, 0.7);
  stroke-width: 2.5px;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .mt-cnode,
  .mt-node.hit .mt-halo {
    animation: none;
  }
}

/* ── 水墨 ink theme: covers are paper, so the tree is drawn in ink ──────── */
:root[data-theme='ink'] .mt-clink {
  stroke: rgba(28, 26, 23, 0.42);
}
:root[data-theme='ink'] .mt-clink.spouse {
  stroke: rgba(179, 53, 42, 0.65);
}
:root[data-theme='ink'] .mt-clink.other {
  stroke: rgba(28, 26, 23, 0.25);
}
:root[data-theme='ink'] .mt-cnode {
  fill: #2b2722;
  filter: none;
}
:root[data-theme='ink'] .mt-cnode.m {
  fill: #3d5a73;
}
:root[data-theme='ink'] .mt-cnode.f {
  fill: #a2496a;
}
:root[data-theme='ink'] .mt-cnode.hit {
  fill: #b3352a;
  filter: none;
}

:root[data-theme='ink'] .mt-link {
  stroke: rgba(28, 26, 23, 0.4);
}
:root[data-theme='ink'] .mt-link.spouse {
  stroke: rgba(179, 53, 42, 0.7);
}
:root[data-theme='ink'] .mt-halo {
  fill: rgba(28, 26, 23, 0.05);
}
:root[data-theme='ink'] .mt-node:hover .mt-halo {
  fill: rgba(28, 26, 23, 0.1);
}
:root[data-theme='ink'] .mt-node.sel .mt-halo,
:root[data-theme='ink'] .mt-node.hit .mt-halo {
  fill: rgba(179, 53, 42, 0.18);
}
:root[data-theme='ink'] .mt-dot {
  fill: #5d5850;
  stroke: #f5efe0;
}
:root[data-theme='ink'] .mt-node.m .mt-dot {
  fill: #3d5a73;
}
:root[data-theme='ink'] .mt-node.f .mt-dot {
  fill: #a2496a;
}
:root[data-theme='ink'] .mt-initial {
  fill: #fbf4e6;
  font-family: var(--font-brush);
  font-weight: 400;
}
:root[data-theme='ink'] .mt-name {
  fill: var(--t1);
  stroke: rgba(245, 239, 224, 0.9);
  font-family: var(--font-brush);
  font-size: 13px;
  font-weight: 400;
}
:root[data-theme='ink'] .mt-role {
  fill: var(--t2);
  stroke: rgba(245, 239, 224, 0.85);
}
</style>
