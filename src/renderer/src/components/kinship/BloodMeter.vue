<template>
  <!-- The Bloodline meter: a couple's kinship coefficient φ (= their child's
       inbreeding coefficient) on a sweeping gauge, from "no shared blood" to
       the Habsburg end. The needle swings in on mount. -->
  <div class="bm" :class="'bm-' + band">
    <svg class="bm-gauge" viewBox="0 0 120 70" aria-hidden="true">
      <defs>
        <linearGradient :id="gid" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="var(--kin-social)" />
          <stop offset="0.45" stop-color="var(--kin-blood)" />
          <stop offset="1" stop-color="var(--danger)" />
        </linearGradient>
      </defs>
      <path class="bm-track" d="M12,62 A48,48 0 0 1 108,62" />
      <path
        class="bm-fill"
        d="M12,62 A48,48 0 0 1 108,62"
        :stroke="`url(#${gid})`"
        :style="{ strokeDashoffset: shown ? 151 * (1 - frac) : 151 }"
      />
      <g v-for="t in ticks" :key="t.label" class="bm-tick">
        <line :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2" />
      </g>
      <g class="bm-needle" :style="{ transform: `rotate(${shown ? angle : -90}deg)` }">
        <line x1="60" y1="62" x2="60" y2="22" />
        <circle cx="60" cy="62" r="4.5" />
      </g>
    </svg>
    <div class="bm-read">
      <div class="bm-val">{{ pct }}</div>
      <div class="bm-band">{{ bandLabel }}</div>
      <div class="bm-note">{{ note }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { bloodBand } from './kinshipGraph'

const props = defineProps({
  /** kinship coefficient of the pair (their child's F) */
  phi: { type: Number, required: true }
})

const gid = 'bm' + Math.random().toString(36).slice(2, 8)
const shown = ref(false)
onMounted(() => requestAnimationFrame(() => (shown.value = true)))

// sqrt scale so 0.4%–6% (the interesting range) gets room; 30% pins the end.
const frac = computed(() => Math.min(1, Math.sqrt(Math.max(0, props.phi) / 0.3)))
const angle = computed(() => -90 + frac.value * 180)
const band = computed(() => bloodBand(props.phi))
const pct = computed(() => {
  const v = props.phi * 100
  if (!v) return '0%'
  return (v < 1 ? v.toFixed(2) : v < 10 ? v.toFixed(1) : v.toFixed(0)) + '%'
})
const LABELS = {
  none: 'No shared blood',
  echo: 'Distant echoes',
  distant: 'Distant cousins',
  cousins: 'Cousin marriage',
  close: 'Close kin',
  royal: 'Royal-house territory',
  habsburg: 'Habsburg jaw 👑'
}
const NOTES = {
  none: 'Their child would carry no inbreeding.',
  echo: 'Around third cousins — common in any old village.',
  distant: 'About second cousins (1.56%).',
  cousins: 'First cousins sit at 6.25%.',
  close: 'Uncle–niece or double-cousin territory (12.5%).',
  royal: 'Only generations of in-marriage get this high.',
  habsburg: 'Charles II of Spain: 25.4%.'
}
const bandLabel = computed(() => LABELS[band.value])
const note = computed(() => NOTES[band.value])

// Reference ticks at second cousins, first cousins, uncle–niece, siblings.
const ticks = computed(() =>
  [1 / 64, 1 / 16, 1 / 8, 1 / 4].map((p) => {
    const a = ((-90 + Math.min(1, Math.sqrt(p / 0.3)) * 180) * Math.PI) / 180
    const r1 = 41
    const r2 = 55
    return {
      label: String(p),
      x1: 60 + Math.sin(a) * r1,
      y1: 62 - Math.cos(a) * r1,
      x2: 60 + Math.sin(a) * r2,
      y2: 62 - Math.cos(a) * r2
    }
  })
)
</script>

<style scoped>
.bm {
  display: flex;
  align-items: center;
  gap: 10px;
}
.bm-gauge {
  width: 104px;
  flex-shrink: 0;
  overflow: visible;
}
.bm-track,
.bm-fill {
  fill: none;
  stroke-width: 7;
  stroke-linecap: round;
}
.bm-track {
  stroke: var(--elevated);
}
.bm-fill {
  stroke-dasharray: 151;
  transition: stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1) 0.15s;
}
.bm-tick line {
  stroke: var(--t3);
  stroke-width: 1;
  opacity: 0.55;
}
.bm-needle {
  transform-origin: 60px 62px;
  transition: transform 1.3s cubic-bezier(0.34, 1.45, 0.5, 1) 0.15s;
}
.bm-needle line {
  stroke: var(--t1);
  stroke-width: 2.2;
  stroke-linecap: round;
}
.bm-needle circle {
  fill: var(--t1);
}
.bm-read {
  min-width: 0;
}
.bm-val {
  font-size: 18px;
  font-weight: 800;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  color: var(--t1);
}
.bm-band {
  font-size: 11px;
  font-weight: 700;
  color: var(--kin-blood);
}
.bm-none .bm-band {
  color: var(--kin-social);
}
.bm-royal .bm-band,
.bm-habsburg .bm-band {
  color: var(--danger);
}
.bm-note {
  font-size: 10px;
  color: var(--t3);
  line-height: 1.35;
}
</style>
