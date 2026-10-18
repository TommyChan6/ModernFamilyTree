<template>
  <!-- Ancestor fan: the person at the hub, parents on the first ring, then
       grandparents, great-grandparents… paternal side left, maternal right.
       Empty slots are the unknowns; gold-rimmed slots are ancestors who appear
       more than once (pedigree collapse). Rings unfold outward on mount. -->
  <svg
    class="fan"
    :viewBox="`${-R - 4} ${-R - 6} ${2 * R + 8} ${R + 22}`"
    role="img"
    :aria-label="t('kinship.fan.aria')"
  >
    <g v-for="(ring, g) in wedges" :key="g" class="fan-ring" :style="{ '--g': g }">
      <path
        v-for="w in ring"
        :key="w.key"
        :d="w.d"
        class="fan-w"
        :class="{ known: !!w.id, dup: w.dup, hot: hot === w.id && w.id }"
        :style="{ '--c': w.color, '--k': w.i }"
        @pointerenter="hot = w.id"
        @pointerleave="hot = null"
        @click="w.id && $emit('pick', w.id)"
      >
        <title>{{ w.title }}</title>
      </path>
    </g>
    <circle class="fan-hub" cx="0" cy="0" :r="HUB" :style="{ '--c': hubColor }" />
    <text class="fan-hub-t" x="0" y="4">{{ initials }}</text>
    <text v-if="hotName" class="fan-hot" x="0" :y="16">{{ hotName }}</text>
  </svg>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from '../../i18n'

const props = defineProps({
  /** ancestorFan() rings: rings[g][i] = { id, dup } */
  rings: { type: Array, required: true },
  nameOf: { type: Function, required: true },
  colorOf: { type: Function, required: true },
  hubName: { type: String, default: '' }
})
defineEmits(['pick'])
const { t } = useI18n()

const HUB = 16
const BAND = 17
const GAP = 1.6
const gens = computed(() => props.rings.length - 1)
const R = computed(() => HUB + 4 + gens.value * BAND)
const hot = ref(null)
const hotName = computed(() => (hot.value ? props.nameOf(hot.value) : ''))
const hubColor = computed(() => props.colorOf(props.rings[0]?.[0]?.id))
const initials = computed(() => {
  const parts = (props.hubName || '?').trim().split(/\s+/)
  return (
    (parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  ).toUpperCase()
})

function arc(r0, r1, a0, a1) {
  // Angles run over the upper half: π (left) → 2π (right).
  const p = (r, a) => `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M${p(r0, a0)} L${p(r1, a0)} A${r1},${r1} 0 ${large} 1 ${p(r1, a1)} L${p(r0, a1)} A${r0},${r0} 0 ${large} 0 ${p(r0, a0)} Z`
}

const wedges = computed(() => {
  const out = []
  for (let g = 1; g < props.rings.length; g++) {
    const ring = props.rings[g]
    const n = ring.length
    const r0 = HUB + 4 + (g - 1) * BAND
    const r1 = r0 + BAND - GAP
    const step = Math.PI / n
    const pad = Math.min(0.012, step * 0.08)
    out.push(
      ring.map((s, i) => {
        const a0 = Math.PI + i * step + pad
        const a1 = Math.PI + (i + 1) * step - pad
        return {
          key: g + ':' + i,
          i,
          id: s.id,
          dup: s.dup,
          d: arc(r0, r1, a0, a1),
          color: s.id ? props.colorOf(s.id) : 'transparent',
          title: s.id
            ? s.dup
              ? t('kinship.fan.dup', { name: props.nameOf(s.id) })
              : props.nameOf(s.id)
            : t('kinship.fan.unknown')
        }
      })
    )
  }
  return out
})
</script>

<style scoped>
.fan {
  width: 100%;
  height: auto;
  overflow: visible;
  display: block;
}
.fan-w {
  fill: transparent;
  stroke: var(--border-strong);
  stroke-width: 0.8;
  stroke-dasharray: 2 2;
  transform-origin: 0 0;
  transform-box: view-box;
  opacity: 0;
  animation: fan-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: calc(var(--g) * 0.12s + var(--k) * 0.012s);
  transition:
    filter 0.2s ease,
    transform 0.25s var(--ease-spring);
}
.fan-w.known {
  fill: color-mix(in srgb, var(--c) 72%, transparent);
  stroke: var(--surface);
  stroke-dasharray: none;
  cursor: pointer;
}
.fan-w.dup {
  stroke: var(--kin-blood);
  stroke-width: 1.8;
  filter: drop-shadow(0 0 3px var(--kin-blood));
}
.fan-w.hot {
  filter: brightness(1.25) drop-shadow(0 0 5px var(--c));
  transform: scale(1.035);
}
@keyframes fan-in {
  from {
    opacity: 0;
    transform: scale(0.55) rotate(-8deg);
  }
  to {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}
.fan-hub {
  fill: var(--c);
  stroke: var(--surface);
  stroke-width: 2;
  filter: drop-shadow(0 0 6px var(--c));
}
.fan-hub-t {
  font-size: 10px;
  font-weight: 800;
  fill: #fff;
  text-anchor: middle;
  pointer-events: none;
}
.fan-hot {
  font-size: 10px;
  font-weight: 700;
  fill: var(--t1);
  text-anchor: middle;
  pointer-events: none;
}

/* ── 水墨 ink theme: the fan is a painted folding fan (扇面) — washes of the
   kin colours on paper, ribs in ink ───────────────────────────────────── */
:root[data-theme='ink'] .fan-w {
  stroke: rgba(48, 36, 20, 0.35);
}
:root[data-theme='ink'] .fan-w.known {
  fill: color-mix(in srgb, var(--c) 45%, #efe7d4);
  stroke: rgba(48, 36, 20, 0.45);
  stroke-width: 0.6;
}
:root[data-theme='ink'] .fan-w.dup {
  stroke: var(--accent);
  filter: none;
}
:root[data-theme='ink'] .fan-w.hot {
  filter: brightness(1.08);
}
:root[data-theme='ink'] .fan-hub-t {
  font-family: var(--font-brush);
  font-weight: 400;
}
</style>
