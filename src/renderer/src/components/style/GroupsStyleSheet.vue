<template>
  <div class="st-sheet">
    <!-- The Groups view's own style: how a group is drawn — fixed Rings with
         tethers, or Venn membranes that stretch to wrap shared people. The
         Venn preview is drawn by the same membrane math as the stage, so the
         softness slider reshapes it live. -->
    <section class="st-section" data-skey="zoneStyle">
      <h4 class="st-sec-title">{{ t('styleStudio.groups.shape') }}</h4>
      <p class="st-note">{{ t('styleStudio.groups.shapeSub') }}</p>
      <div class="gst-tiles" role="radiogroup" :aria-label="t('groups.style.label')">
        <button
          v-for="(s, i) in STYLES"
          :key="s.id"
          class="gst-tile"
          :class="['gst-' + s.id, { on: st.zoneStyle === s.id }]"
          :style="{ '--i': i, '--ga': colA, '--gb': colB }"
          role="radio"
          :aria-checked="st.zoneStyle === s.id"
          :title="t(`groups.style.${s.id}Hint`)"
          @click="set('zoneStyle', s.id)"
        >
          <svg
            class="gst-art"
            viewBox="-180 -100 360 200"
            role="img"
            :aria-label="t('styleStudio.groups.preview', { style: t(`groups.style.${s.id}`) })"
          >
            <template v-if="s.id === 'rings'">
              <circle class="gst-zone a" cx="-92" cy="0" r="62" />
              <circle class="gst-zone b" cx="92" cy="0" r="62" />
              <line class="gst-tether a" x1="0" y1="-14" x2="-92" y2="0" />
              <line class="gst-tether b" x1="0" y1="-14" x2="92" y2="0" />
              <line class="gst-tether a" x1="4" y1="34" x2="-92" y2="0" />
              <line class="gst-tether b" x1="4" y1="34" x2="92" y2="0" />
            </template>
            <template v-else>
              <defs>
                <clipPath :id="clipId">
                  <path :d="venn.a" />
                </clipPath>
              </defs>
              <g class="gst-breathe">
                <path class="gst-zone a" :d="venn.a" />
                <path class="gst-zone b" :d="venn.b" />
                <path class="gst-lens" :d="venn.b" :clip-path="`url(#${clipId})`" />
              </g>
            </template>
            <circle
              v-for="(m, j) in s.id === 'rings' ? RING_NODES : VENN_NODES"
              :key="j"
              class="gst-node"
              :class="m.k"
              :cx="m.x"
              :cy="m.y"
              r="9"
            />
          </svg>
          <span class="gst-name">
            <UiIcon :name="s.icon" :size="13" />{{ t(`groups.style.${s.id}`) }}
          </span>
        </button>
      </div>
      <Transition name="st-fade" mode="out-in">
        <p :key="st.zoneStyle" class="st-note gst-blurb">
          {{ t(`styleStudio.groups.${st.zoneStyle === 'venn' ? 'vennBlurb' : 'ringsBlurb'}`) }}
        </p>
      </Transition>
    </section>

    <Transition name="st-fade" mode="out-in">
      <section v-if="st.zoneStyle === 'venn'" key="venn" class="st-section">
        <StSlider
          skey="membraneSoftness"
          :label="t('styleStudio.groups.softness')"
          :model-value="st.membraneSoftness"
          :min="0"
          :max="1"
          :step="0.05"
          :format="softLabel"
          @update:model-value="set('membraneSoftness', $event)"
        />
        <StSwitch
          skey="lensGlow"
          :label="t('styleStudio.groups.lens')"
          :hint="t('styleStudio.groups.lensHint')"
          :model-value="st.lensGlow"
          @update:model-value="set('lensGlow', $event)"
        />
        <p class="st-callout">
          <span><UiIcon name="sparkles" :size="14" />{{ t('styleStudio.groups.arrangeTip') }}</span>
        </p>
      </section>
      <p v-else key="rings" class="st-callout">
        <span><UiIcon name="blend" :size="14" />{{ t('styleStudio.groups.ringsTip') }}</span>
      </p>
    </Transition>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMainStore } from '../../store/index.js'
import { useI18n } from '../../i18n'
import UiIcon from '../ui/UiIcon.js'
import StSlider from './StSlider.vue'
import StSwitch from './StSwitch.vue'
import { SHAPE_SAMPLES, membraneShape } from '../factions/vennLayout'

defineProps({ chapter: { type: String, default: 'shapes' } })

const store = useMainStore()
const { t } = useI18n()
const st = computed(() => store.groupsSettings)
function set(key, value) {
  store.updateGroupsSetting(key, value)
}

const STYLES = [
  { id: 'rings', icon: 'share-2' },
  { id: 'venn', icon: 'blend' }
]

// The previews wear this project's own group colours when it has some.
const colA = computed(() => store.activeGroups?.[0]?.color || 'var(--accent)')
const colB = computed(() => store.activeGroups?.[1]?.color || 'var(--t2)')

const clipId = `gst-clip-${Math.random().toString(36).slice(2, 8)}`

// A tiny scene: two groups, two shared people between them, a few loyalists.
const RING_NODES = [
  { x: -104, y: -18, k: 'a' },
  { x: -80, y: 22, k: 'a' },
  { x: 104, y: -18, k: 'b' },
  { x: 80, y: 22, k: 'b' },
  { x: 0, y: -14, k: 'ab' },
  { x: 4, y: 34, k: 'ab' }
]
const VENN_NODES = [
  { x: -112, y: -14, k: 'a' },
  { x: -96, y: 26, k: 'a' },
  { x: 112, y: -14, k: 'b' },
  { x: 96, y: 26, k: 'b' },
  { x: 0, y: -14, k: 'ab' },
  { x: 4, y: 30, k: 'ab' }
]
const A = { x: -84, y: 0, r: 64 }
const B = { x: 84, y: 0, r: 64 }

function outlinePath(c, members, softness) {
  const s = membraneShape(c.x, c.y, c.r, members, { pad: 19, softness })
  let d = ''
  for (let j = 0; j < SHAPE_SAMPLES; j += 2) {
    const a = (j / SHAPE_SAMPLES) * Math.PI * 2
    const x = c.x + Math.cos(a) * s[j]
    const y = c.y + Math.sin(a) * s[j]
    d += (j ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)
  }
  return d + 'Z'
}
const venn = computed(() => {
  const soft = st.value.membraneSoftness
  const pick = (k) => VENN_NODES.filter((n) => n.k === k || n.k === 'ab')
  return { a: outlinePath(A, pick('a'), soft), b: outlinePath(B, pick('b'), soft) }
})

const softLabel = (v) =>
  v <= 0.2
    ? t('styleStudio.groups.softTaut')
    : v >= 0.8
      ? t('styleStudio.groups.softFluid')
      : Math.round(v * 100) + '%'
</script>

<style scoped>
.gst-tiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.gst-tile {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding: 6px 6px 8px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  cursor: pointer;
  animation: st-pop-in 0.42s var(--ease-out) backwards;
  animation-delay: calc(var(--i) * 0.05s);
  transition:
    transform 0.25s var(--ease-spring),
    border-color var(--dur) ease,
    box-shadow var(--dur) ease;
}
.gst-tile:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
}
.gst-tile.on {
  color: var(--t1);
  border-color: var(--accent);
  box-shadow:
    0 0 0 1px var(--accent),
    0 8px 20px rgba(var(--accent-rgb), 0.22);
}
.gst-art {
  display: block;
  width: 100%;
  aspect-ratio: 9 / 5;
  border-radius: var(--r-sm);
  background: var(--surface);
  overflow: hidden;
}
.gst-name {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
}
.gst-blurb {
  min-height: 2.9em;
}

/* ── the preview art ── */
.gst-zone {
  stroke-width: 2.5;
}
.gst-zone.a {
  fill: color-mix(in srgb, var(--ga) 12%, transparent);
  stroke: color-mix(in srgb, var(--ga) 70%, transparent);
}
.gst-zone.b {
  fill: color-mix(in srgb, var(--gb) 12%, transparent);
  stroke: color-mix(in srgb, var(--gb) 70%, transparent);
}
.gst-lens {
  fill: color-mix(in srgb, color-mix(in srgb, var(--ga) 50%, var(--gb)) 34%, transparent);
  stroke: none;
}
.gst-tether {
  stroke-width: 2;
  stroke-dasharray: 5 6;
  opacity: 0.7;
}
.gst-tether.a {
  stroke: var(--ga);
}
.gst-tether.b {
  stroke: var(--gb);
}
.gst-node {
  fill: var(--t2);
  stroke: var(--surface);
  stroke-width: 3;
}
.gst-node.ab {
  fill: var(--t1);
}

/* hover: the tethers flow, the membranes breathe */
@media (prefers-reduced-motion: no-preference) {
  .gst-tile:hover .gst-tether {
    animation: gst-flow 0.9s linear infinite;
  }
  .gst-tile:hover .gst-breathe {
    animation: gst-breathe 1.6s var(--ease-std) infinite alternate;
  }
}
.gst-breathe {
  transform-box: fill-box;
  transform-origin: center;
}
@keyframes gst-flow {
  to {
    stroke-dashoffset: -11;
  }
}
@keyframes gst-breathe {
  to {
    transform: scale(1.035);
  }
}
</style>
