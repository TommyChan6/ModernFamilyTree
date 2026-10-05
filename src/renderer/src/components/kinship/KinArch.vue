<template>
  <!-- The kinship arch: the route between two people drawn on generation
       levels — up to the common ancestor (the keystone, crowned), across a
       marriage, down to the target. The line draws itself, then the people
       pop in along it. -->
  <svg
    class="ka"
    :viewBox="`0 0 ${W} ${H}`"
    :style="{ '--len': pathLen }"
    role="img"
    :aria-label="ariaLabel"
  >
    <defs>
      <linearGradient :id="gid" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" :stop-color="fromColor" />
        <stop offset="1" :stop-color="toColor" />
      </linearGradient>
      <filter :id="gid + 'g'" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3.2" />
      </filter>
    </defs>

    <!-- generation rules -->
    <g class="ka-rules">
      <line
        v-for="lv in levels"
        :key="'r' + lv"
        :x1="8"
        :x2="W - 8"
        :y1="yOf(lv)"
        :y2="yOf(lv)"
        :class="{ 'ka-rule-zero': lv === 0 }"
      />
      <text v-for="lv in levels" :key="'t' + lv" class="ka-gen" :x="W - 6" :y="yOf(lv) - 3">
        {{ genLabel(lv) }}
      </text>
    </g>

    <!-- the co-ancestor partner beside the keystone (a full relation) -->
    <g v-if="partner && keystone" class="ka-partner">
      <line
        :x1="keystone.x"
        :y1="keystone.y"
        :x2="keystone.x + partnerDx"
        :y2="keystone.y"
        class="ka-marriage"
      />
      <circle :cx="keystone.x + partnerDx" :cy="keystone.y" r="6" :fill="partner.color" />
    </g>

    <!-- glow underlay + the drawn route -->
    <path :d="d" class="ka-glow" :stroke="`url(#${gid})`" :filter="`url(#${gid}g)`" />
    <path :d="d" class="ka-path" :stroke="`url(#${gid})`" />
    <!-- a spark riding the route, forever -->
    <circle v-if="pts.length > 1" r="3" class="ka-spark">
      <animateMotion
        :dur="Math.max(1.6, pts.length * 0.55) + 's'"
        repeatCount="indefinite"
        :path="d"
      />
    </circle>

    <!-- marriage hops are drawn as dashed rings on the joint -->
    <g
      v-for="(p, i) in pts"
      :key="p.id + ':' + i"
      class="ka-node"
      :class="{ 'ka-end': i === 0 || i === pts.length - 1, 'ka-key': p.keystone }"
      :style="{ '--d': 0.35 + i * 0.12 + 's' }"
      @click="$emit('pick', p.id)"
    >
      <circle v-if="p.keystone" :cx="p.x" :cy="p.y" r="14" class="ka-halo" />
      <circle :cx="p.x" :cy="p.y" :r="i === 0 || i === pts.length - 1 ? 8 : 6" :fill="p.color" />
      <text v-if="p.keystone" :x="p.x" :y="p.y - 13" class="ka-crown">♛</text>
      <text :x="p.x" :y="p.y + labelDy(p, i)" class="ka-label">{{ p.short }}</text>
    </g>
  </svg>
</template>

<script setup>
import { computed } from 'vue'

// points: [{ id, level, via, keystone, name, color }] — from kinRoute()
const props = defineProps({
  points: { type: Array, required: true },
  partner: { type: Object, default: null }, // { name, color } — the second common ancestor
  width: { type: Number, default: 300 }
})
defineEmits(['pick'])

const uid = Math.random().toString(36).slice(2, 8)
const gid = 'ka' + uid
const W = computed(() => props.width)
const levels = computed(() => {
  const ls = props.points.map((p) => p.level)
  const lo = Math.min(0, ...ls)
  const hi = Math.max(0, ...ls)
  const out = []
  for (let l = hi; l >= lo; l--) out.push(l)
  return out
})
const ROW = 34
const H = computed(() => Math.max(1, levels.value.length - 1) * ROW + 44)
const hiLevel = computed(() => levels.value[0] ?? 0)
const yOf = (lv) => 22 + (hiLevel.value - lv) * ROW

const pts = computed(() => {
  const n = props.points.length
  const pad = 26
  const span = W.value - pad * 2 - 20
  return props.points.map((p, i) => ({
    ...p,
    x: pad + (n > 1 ? (i / (n - 1)) * span : span / 2),
    y: yOf(p.level),
    short: (p.name || '').split(' ')[0].slice(0, 12)
  }))
})
const keystone = computed(() => pts.value.find((p) => p.keystone) || null)
const partnerDx = 18

// Smooth route: gentle quadratic joints, straight marriage runs.
const d = computed(() => {
  const P = pts.value
  if (!P.length) return ''
  let s = `M${P[0].x},${P[0].y}`
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1]
    const b = P[i]
    if (b.via === 'marriage' || b.via === 'sibling') s += ` L${b.x},${b.y}`
    else {
      const mx = (a.x + b.x) / 2
      s += ` Q${mx},${a.y} ${mx},${(a.y + b.y) / 2} T${b.x},${b.y}`
    }
  }
  return s
})
const pathLen = computed(() => {
  let L = 0
  const P = pts.value
  for (let i = 1; i < P.length; i++) L += Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y)
  return Math.ceil(L * 1.2) + 10
})
const fromColor = computed(() => props.points[0]?.color || 'var(--accent)')
const toColor = computed(() => props.points[props.points.length - 1]?.color || 'var(--accent)')

function labelDy(p, i) {
  // Labels sit below, except on the top row where they'd hit the crown.
  if (p.keystone) return 26
  const next = pts.value[i + 1]
  const prev = pts.value[i - 1]
  if ((next && next.y > p.y) || (prev && prev.y > p.y)) return -12
  return 22
}
function genLabel(lv) {
  if (lv === 0) return ''
  return (lv > 0 ? '+' : '−') + Math.abs(lv)
}
const ariaLabel = computed(() => props.points.map((p) => p.name).join(' → '))
</script>

<style scoped>
.ka {
  width: 100%;
  height: auto;
  overflow: visible;
  display: block;
}
.ka-rules line {
  stroke: var(--border);
  stroke-width: 1;
  stroke-dasharray: 2 5;
}
.ka-rules .ka-rule-zero {
  stroke: var(--border-strong);
  stroke-dasharray: none;
}
.ka-gen {
  font-size: 8px;
  font-weight: 700;
  fill: var(--t3);
  text-anchor: end;
  letter-spacing: 0.04em;
}
.ka-path,
.ka-glow {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: var(--len);
  stroke-dashoffset: var(--len);
  animation: ka-draw 0.9s cubic-bezier(0.65, 0, 0.35, 1) 0.1s forwards;
}
.ka-path {
  stroke-width: 2.6;
}
.ka-glow {
  stroke-width: 7;
  opacity: 0.45;
}
@keyframes ka-draw {
  to {
    stroke-dashoffset: 0;
  }
}
.ka-spark {
  fill: #fff;
  filter: drop-shadow(0 0 4px var(--accent));
  opacity: 0;
  animation: ka-fade 0.4s ease 1s forwards;
}
@keyframes ka-fade {
  to {
    opacity: 0.9;
  }
}
.ka-node {
  cursor: pointer;
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: ka-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) var(--d) forwards;
}
.ka-node circle:not(.ka-halo) {
  stroke: var(--surface);
  stroke-width: 2;
  transition: r 0.18s var(--ease-spring);
}
.ka-node:hover circle:not(.ka-halo) {
  r: 9;
}
@keyframes ka-pop {
  from {
    opacity: 0;
    transform: scale(0.3);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
.ka-halo {
  fill: none;
  stroke: var(--kin-blood);
  stroke-width: 1.5;
  opacity: 0.6;
  transform-box: fill-box;
  transform-origin: center;
  animation: ka-breathe 2.4s ease-in-out infinite;
}
@keyframes ka-breathe {
  50% {
    transform: scale(1.25);
    opacity: 0.15;
  }
}
.ka-crown {
  font-size: 11px;
  fill: var(--kin-blood);
  text-anchor: middle;
  animation: ka-float 3s ease-in-out infinite;
}
@keyframes ka-float {
  50% {
    transform: translateY(-2px);
  }
}
.ka-label {
  font-size: 9.5px;
  font-weight: 600;
  fill: var(--t2);
  text-anchor: middle;
  pointer-events: none;
}
.ka-end .ka-label {
  fill: var(--t1);
  font-weight: 750;
}
.ka-partner {
  opacity: 0;
  animation: ka-fade 0.5s ease 0.9s forwards;
}
.ka-marriage {
  stroke: var(--kin-spouse);
  stroke-width: 1.5;
  stroke-dasharray: 3 3;
}
</style>
