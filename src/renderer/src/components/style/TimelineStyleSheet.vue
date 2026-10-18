<template>
  <div class="st-sheet">
    <!-- The Timeline's own style: one-click looks, lifelines, the canvas
         furniture (connectors, grid, names, age ticks, era wash, event markers)
         and the atmosphere — one chapter at a time. -->
    <!-- ── Looks: a lifeline look + atmosphere + canvas, together ── -->
    <template v-if="chapter === 'looks'">
      <div class="tst-looks" data-skey="looks">
        <button
          v-for="(l, i) in LOOKS"
          :key="l.id"
          class="tst-look"
          :class="{ on: lookActive(l) }"
          :style="{ '--i': i, '--lc': l.color }"
          :title="t(`timeline.style.looks.${l.id}.hint`)"
          @click="applyLook(l)"
        >
          <UiIcon class="tst-look-ic" :name="l.icon" :size="18" />
          <span class="tst-look-name">{{ t(`timeline.style.looks.${l.id}.label`) }}</span>
        </button>
      </div>
    </template>

    <!-- ── Lifelines ── -->
    <template v-else-if="chapter === 'lines'">
      <p v-if="store.isInk" class="st-callout">
        <span><UiIcon name="brush" :size="14" />{{ t('timeline.style.inkLines') }}</span>
      </p>
      <div class="tst-grid" data-skey="lifelineStyle">
        <button
          v-for="(f, i) in looks"
          :key="f.id"
          class="tst-tile"
          :class="{ on: st.lifelineStyle === f.id }"
          :style="{ '--i': i }"
          :title="lookText(f, 'hint')"
          @click="set('lifelineStyle', f.id)"
        >
          <FxPreview :id="f.id" />
          <span class="tst-tile-name">
            <UiIcon :name="f.icon" :size="13" />{{ lookText(f, 'label') }}
          </span>
        </button>
      </div>
      <section class="st-section">
        <StSlider
          skey="lifelineWidth"
          :label="t('timeline.style.thickness')"
          :model-value="st.lifelineWidth"
          :min="2"
          :max="16"
          :step="0.5"
          :format="(v) => v + 'px'"
          @update:model-value="set('lifelineWidth', $event)"
        />
        <StSlider
          skey="avatarSize"
          :label="t('timeline.style.portraits')"
          :model-value="st.avatarSize"
          :min="0.6"
          :max="1.8"
          :step="0.05"
          :format="pct"
          @update:model-value="set('avatarSize', $event)"
        />
        <StSwitch
          skey="shadows"
          :label="t('timeline.style.shadows')"
          :model-value="st.shadows"
          :disabled="!shadowable"
          :hint="shadowable ? '' : t('timeline.style.shadowsHint')"
          @update:model-value="set('shadows', $event)"
        />
        <template v-if="animated">
          <StSlider
            :label="t('timeline.style.flowSpeed')"
            :model-value="st.fxSpeed"
            :min="0"
            :max="3"
            :step="0.1"
            :format="(v) => v.toFixed(1) + '×'"
            @update:model-value="set('fxSpeed', $event)"
          />
          <StSlider
            :label="t('timeline.style.glow')"
            :model-value="st.fxGlow"
            :min="0"
            :max="2"
            :step="0.05"
            :format="pct"
            @update:model-value="set('fxGlow', $event)"
          />
          <StSeg
            :label="t('timeline.style.palette')"
            :model-value="st.fxKeep"
            :options="palettes"
            @update:model-value="set('fxKeep', $event)"
          />
        </template>
      </section>
    </template>

    <!-- ── Canvas ── -->
    <template v-else-if="chapter === 'canvas'">
      <section class="st-section">
        <StSeg
          v-for="o in segs"
          :key="o.key"
          :skey="o.key"
          :label="t(`timeline.style.segs.${o.key}`)"
          :model-value="st[o.key]"
          :options="o.opts"
          @update:model-value="set(o.key, $event)"
        />
        <StSwitch
          skey="ageTicks"
          :label="t('timeline.style.ageTicks')"
          :hint="t('timeline.style.ageTicksHint')"
          :model-value="st.ageTicks"
          @update:model-value="set('ageTicks', $event)"
        />
        <StSlider
          skey="eraIntensity"
          :label="t('timeline.style.eraWash')"
          :model-value="st.eraIntensity"
          :min="0"
          :max="2.5"
          :step="0.05"
          :format="pct"
          @update:model-value="set('eraIntensity', $event)"
        />
      </section>
    </template>

    <!-- ── Atmosphere ── -->
    <template v-else-if="chapter === 'air'">
      <p v-if="store.isInk" class="st-callout">
        <span><UiIcon name="cloud-fog" :size="14" />{{ t('timeline.style.inkAir') }}</span>
      </p>
      <div class="tst-chips" data-skey="ambientFx">
        <button
          v-for="(a, i) in AMBIENTS"
          :key="a.id"
          class="tst-chip"
          :class="{ on: st.ambientFx === a.id }"
          :style="{ '--i': i }"
          @click="set('ambientFx', a.id)"
        >
          <UiIcon :name="a.icon" :size="14" />{{ t(`timeline.style.ambients.${a.id}`) }}
        </button>
      </div>
      <section v-if="st.ambientFx !== 'none'" class="st-section">
        <StSlider
          :label="t('timeline.style.density')"
          :model-value="st.ambientDensity"
          :min="0"
          :max="1"
          :step="0.05"
          :format="pct"
          @update:model-value="set('ambientDensity', $event)"
        />
        <StColor
          :label="t('timeline.style.colours') + ' · A'"
          :model-value="st.ambientColorA"
          @update:model-value="set('ambientColorA', $event)"
        />
        <StColor
          :label="t('timeline.style.colours') + ' · B'"
          :model-value="st.ambientColorB"
          @update:model-value="set('ambientColorB', $event)"
        />
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMainStore } from '../../store/index.js'
import { LINE_FX } from '../graph/webgl/lineFx.js'
import FxPreview from '../graph/FxPreview.vue'
import UiIcon from '../ui/UiIcon.js'
import { useI18n } from '../../i18n'
import { LIFELINE_STYLES, SHADOWED } from '../timeline/LifelineLayer.js'
import StSlider from './StSlider.vue'
import StSwitch from './StSwitch.vue'
import StColor from './StColor.vue'
import StSeg from './StSeg.vue'

defineProps({ chapter: { type: String, required: true } })

const store = useMainStore()
const { t } = useI18n()
const st = computed(() => store.timelineSettings)
const pct = (v) => Math.round(v * 100) + '%'
function set(key, value) {
  store.updateTimelineSetting(key, value)
}

const BASE_ICONS = { classic: 'minus', tube: 'test-tube', glass: 'gem', glow: 'lightbulb' }
const looks = [
  ...LIFELINE_STYLES.map((s) => ({ ...s, icon: BASE_ICONS[s.id] })),
  ...LINE_FX.filter((f) => f.id !== 'none')
]
/** A look tile's label / hint in the UI language: base looks carry their own
 *  keys, graph line effects translate by id (English catalog as fallback). */
function lookText(f, field) {
  const key = f[field + 'Key'] || `timeline.style.fx.${f.id}.${field}`
  const v = t(key)
  return v === key ? f[field] : v
}
const shadowable = computed(() => SHADOWED.has(st.value.lifelineStyle))
const animated = computed(() => !['classic', 'tube', 'glow'].includes(st.value.lifelineStyle))
const palettes = computed(() => [
  { id: false, label: t('timeline.style.paletteEffect') },
  { id: true, label: t('timeline.style.palettePerson') }
])

const SEG_DEFS = [
  { key: 'connectors', opts: ['curve', 'straight', 'hidden'] },
  { key: 'grid', opts: ['bands', 'lines', 'none'] },
  { key: 'labels', opts: ['full', 'compact', 'hidden'], hints: ['full', 'compact'] },
  { key: 'eventMarkers', opts: ['pills', 'dots', 'hidden'] }
]
const segs = computed(() =>
  SEG_DEFS.map((s) => ({
    key: s.key,
    opts: s.opts.map((id) => ({
      id,
      label: t(`timeline.style.opts.${id}`),
      title: s.hints?.includes(id) ? t(`timeline.style.opts.${id}Hint`) : ''
    }))
  }))
)

const AMBIENTS = [
  { id: 'none', icon: 'ban' },
  { id: 'fireflies', icon: 'sparkles' },
  { id: 'stars', icon: 'star' },
  { id: 'petals', icon: 'flower' },
  { id: 'snow', icon: 'snowflake' },
  { id: 'embers', icon: 'flame' },
  { id: 'rain', icon: 'cloud-rain' },
  { id: 'motes', icon: 'sparkle' },
  { id: 'mist', icon: 'cloud-fog' },
  { id: 'plum', icon: 'flower-2' }
]

// One-click looks. (Colours are the looks' own pigments, like the shader palettes.)
const LOOKS = [
  {
    id: 'clean',
    icon: 'file',
    label: 'Clean',
    color: '#8a93a6',
    hint: 'Flat lines, no atmosphere',
    set: { lifelineStyle: 'classic', ambientFx: 'none', connectors: 'curve', grid: 'bands' }
  },
  {
    id: 'bloodline',
    icon: 'droplet',
    label: 'Bloodline',
    color: '#d0303f',
    hint: 'Blood pulsing down every life, embers drifting',
    set: {
      lifelineStyle: 'blood',
      ambientFx: 'embers',
      ambientColorA: '#ff7a4a',
      ambientColorB: '#ffd27a',
      connectors: 'curve',
      shadows: true
    }
  },
  {
    id: 'tides',
    icon: 'waves',
    label: 'Tides',
    color: '#1d7fc0',
    hint: 'Rivers of time under a drifting mist',
    set: { lifelineStyle: 'river', ambientFx: 'mist', connectors: 'curve' }
  },
  {
    id: 'cosmos',
    icon: 'orbit',
    label: 'Cosmos',
    color: '#7a6cf5',
    hint: 'Starlit lives in a twinkling night',
    set: {
      lifelineStyle: 'stars',
      ambientFx: 'stars',
      ambientColorA: '#ffffff',
      ambientColorB: '#9ec5ff',
      grid: 'lines'
    }
  },
  {
    id: 'neon',
    icon: 'building-2',
    label: 'Neon city',
    color: '#26c6da',
    hint: 'Data streams, rain and hard lines',
    set: {
      lifelineStyle: 'neon',
      ambientFx: 'rain',
      ambientColorA: '#7ad7ff',
      ambientColorB: '#c77dff',
      connectors: 'straight',
      grid: 'lines'
    }
  },
  {
    id: 'gilded',
    icon: 'crown',
    label: 'Gilded',
    color: '#d4a640',
    hint: 'Gold-leaf dynasties, motes of light',
    set: {
      lifelineStyle: 'gilded',
      ambientFx: 'motes',
      ambientColorA: '#ffd27a',
      ambientColorB: '#fff1c4',
      shadows: true
    }
  },
  {
    id: 'glasshouse',
    icon: 'gem',
    label: 'Glasshouse',
    color: '#8fb2ff',
    hint: 'Glass rods catching the light, soft snow',
    set: { lifelineStyle: 'glass', ambientFx: 'snow', shadows: true }
  },
  {
    id: 'sakura',
    icon: 'flower',
    label: 'Sakura',
    color: '#f06292',
    hint: 'Lit tubes under falling petals',
    set: {
      lifelineStyle: 'tube',
      ambientFx: 'petals',
      ambientColorA: '#ffb7d0',
      ambientColorB: '#ffe0ec',
      shadows: true
    }
  }
]
function lookActive(l) {
  return Object.entries(l.set).every(([k, v]) => st.value[k] === v)
}
function applyLook(l) {
  store.applyTimelineSettings(l.set)
}
</script>

<style scoped>
/* One-click looks: glowing medallions in each look's own pigment. */
.tst-looks {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 7px;
}
.tst-look {
  --lc: var(--accent);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 11px 2px 8px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background:
    radial-gradient(
      120% 90% at 50% 0%,
      color-mix(in srgb, var(--lc) 24%, transparent),
      transparent 70%
    ),
    var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  cursor: pointer;
  animation: st-pop-in 0.42s var(--ease-out) backwards;
  animation-delay: calc(var(--i) * 0.035s);
  transition:
    transform 0.25s var(--ease-spring),
    border-color var(--dur) ease,
    box-shadow var(--dur) ease;
}
.tst-look:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--lc) 60%, var(--border));
}
.tst-look.on {
  color: var(--t1);
  border-color: var(--lc);
  box-shadow:
    0 0 0 1px var(--lc),
    0 8px 20px color-mix(in srgb, var(--lc) 35%, transparent);
}
.tst-look-ic {
  color: var(--lc);
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--lc) 70%, transparent));
}
.tst-look.on .tst-look-ic {
  animation: st-breathe 1.8s ease-in-out infinite;
}
.tst-look-name {
  font-size: var(--fs-xs);
  font-weight: 700;
  white-space: nowrap;
}

.tst-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.tst-tile {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 6px 6px 5px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  cursor: pointer;
  text-align: left;
  animation: st-pop-in 0.4s var(--ease-out) backwards;
  animation-delay: calc(var(--i) * 0.025s);
  transition:
    border-color var(--dur) ease,
    transform 0.22s var(--ease-spring),
    box-shadow var(--dur) ease;
}
.tst-tile:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
}
.tst-tile.on {
  border-color: var(--accent);
  color: var(--t1);
  box-shadow:
    0 0 0 1px var(--accent),
    0 4px 16px rgba(var(--accent-rgb), 0.25);
}
.tst-tile-name {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
}

.tst-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tst-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: var(--ctl-sm);
  padding: 0 10px;
  border-radius: var(--r-pill);
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  animation: st-pop-in 0.38s var(--ease-out) backwards;
  animation-delay: calc(var(--i) * 0.025s);
  transition:
    transform 0.22s var(--ease-spring),
    border-color var(--dur) ease,
    background var(--dur) ease,
    color var(--dur) ease;
}
.tst-chip:hover {
  transform: translateY(-2px);
  color: var(--t1);
}
.tst-chip.on {
  border-color: var(--accent);
  background: var(--adim);
  color: var(--t1);
}
</style>
