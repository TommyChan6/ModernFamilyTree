<template>
  <!-- The Timeline's Style pane: lifeline looks (lit tubes, glass, glow, every
       graph line effect), the canvas furniture (connectors, grid, names, age
       ticks, era wash, event markers) and the atmosphere — plus one-click looks. -->
  <div class="canvas-pane tsp" @pointerdown.stop @wheel.stop @click.stop>
    <div class="tsp-head">
      <span class="tsp-title"><UiIcon name="palette" :size="14" />Style</span>
      <button class="tsp-reset" title="Back to the defaults" @click="store.resetTimelineSettings()">
        Reset
      </button>
    </div>

    <!-- One-click looks: a lifeline look + atmosphere + canvas, together. -->
    <div class="tsp-looks">
      <button
        v-for="(l, i) in LOOKS"
        :key="l.id"
        class="tsp-look"
        :class="{ on: lookActive(l) }"
        :style="{ '--i': i, '--lc': l.color }"
        :title="l.hint"
        @click="applyLook(l)"
      >
        <UiIcon class="tsp-look-ic" :name="l.icon" :size="16" />
        <span class="tsp-look-name">{{ l.label }}</span>
      </button>
    </div>

    <div class="seg tsp-tabs">
      <button
        v-for="t in TABS"
        :key="t.id"
        class="seg-btn"
        :class="{ active: tab === t.id }"
        @click="tab = t.id"
      >
        {{ t.label }}
      </button>
    </div>

    <Transition name="tsp-tab" mode="out-in">
      <!-- ── Lifelines ── -->
      <div v-if="tab === 'lines'" key="lines" class="tsp-body">
        <div v-if="store.isInk" class="tsp-note">
          <UiIcon name="brush" :size="14" />
          <span>In the Ink theme lifelines are brushed — looks apply in every other theme.</span>
        </div>
        <div class="tsp-grid">
          <button
            v-for="(f, i) in looks"
            :key="f.id"
            class="tsp-tile"
            :class="{ on: st.lifelineStyle === f.id }"
            :style="{ '--i': i }"
            :title="f.hint"
            @click="set('lifelineStyle', f.id)"
          >
            <FxPreview :id="f.id" />
            <span class="tsp-tile-name">
              <UiIcon class="tsp-tile-ic" :name="f.icon" :size="13" />{{ f.label }}
            </span>
          </button>
        </div>
        <div class="tsp-row">
          <label>Thickness</label>
          <input
            type="range"
            min="2"
            max="16"
            step="0.5"
            :value="st.lifelineWidth"
            @input="set('lifelineWidth', +$event.target.value)"
          />
          <span class="tsp-val">{{ st.lifelineWidth }}px</span>
        </div>
        <div class="tsp-row">
          <label>Portraits</label>
          <input
            type="range"
            min="0.6"
            max="1.8"
            step="0.05"
            :value="st.avatarSize"
            @input="set('avatarSize', +$event.target.value)"
          />
          <span class="tsp-val">{{ Math.round(st.avatarSize * 100) }}%</span>
        </div>
        <div class="tsp-row" :class="{ off: !shadowable }">
          <label>Drop shadows</label>
          <input
            type="checkbox"
            class="switch"
            :checked="st.shadows"
            :disabled="!shadowable"
            :title="shadowable ? '' : 'Shadows fall under the solid, lit looks'"
            @change="set('shadows', $event.target.checked)"
          />
        </div>
        <template v-if="animated">
          <div class="tsp-row">
            <label>Flow speed</label>
            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              :value="st.fxSpeed"
              @input="set('fxSpeed', +$event.target.value)"
            />
            <span class="tsp-val">{{ st.fxSpeed.toFixed(1) }}×</span>
          </div>
          <div class="tsp-row">
            <label>Glow</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              :value="st.fxGlow"
              @input="set('fxGlow', +$event.target.value)"
            />
            <span class="tsp-val">{{ Math.round(st.fxGlow * 100) }}%</span>
          </div>
          <div class="tsp-row">
            <label>Palette</label>
            <div class="seg tsp-seg">
              <button class="seg-btn" :class="{ active: !st.fxKeep }" @click="set('fxKeep', false)">
                Effect
              </button>
              <button class="seg-btn" :class="{ active: st.fxKeep }" @click="set('fxKeep', true)">
                Person
              </button>
            </div>
          </div>
        </template>
      </div>

      <!-- ── Canvas ── -->
      <div v-else-if="tab === 'canvas'" key="canvas" class="tsp-body">
        <div v-for="o in SEGS" :key="o.key" class="tsp-row">
          <label>{{ o.label }}</label>
          <div class="seg tsp-seg">
            <button
              v-for="c in o.opts"
              :key="c.id"
              class="seg-btn"
              :class="{ active: st[o.key] === c.id }"
              :title="c.hint || ''"
              @click="set(o.key, c.id)"
            >
              {{ c.label }}
            </button>
          </div>
        </div>
        <div class="tsp-row">
          <label>Age ticks</label>
          <input
            type="checkbox"
            class="switch"
            :checked="st.ageTicks"
            title="A notch every decade of each life"
            @change="set('ageTicks', $event.target.checked)"
          />
        </div>
        <div class="tsp-row">
          <label>Era wash</label>
          <input
            type="range"
            min="0"
            max="2.5"
            step="0.05"
            :value="st.eraIntensity"
            @input="set('eraIntensity', +$event.target.value)"
          />
          <span class="tsp-val">{{ Math.round(st.eraIntensity * 100) }}%</span>
        </div>
      </div>

      <!-- ── Atmosphere ── -->
      <div v-else key="air" class="tsp-body">
        <div v-if="store.isInk" class="tsp-note">
          <UiIcon name="cloud-fog" :size="14" />
          <span>The Ink theme brings its own mist — atmospheres apply in every other theme.</span>
        </div>
        <div class="tsp-chips">
          <button
            v-for="(a, i) in AMBIENTS"
            :key="a.id"
            class="tsp-chip"
            :class="{ on: st.ambientFx === a.id }"
            :style="{ '--i': i }"
            @click="set('ambientFx', a.id)"
          >
            <UiIcon :name="a.icon" :size="14" />{{ a.label }}
          </button>
        </div>
        <template v-if="st.ambientFx !== 'none'">
          <div class="tsp-row">
            <label>Density</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              :value="st.ambientDensity"
              @input="set('ambientDensity', +$event.target.value)"
            />
            <span class="tsp-val">{{ Math.round(st.ambientDensity * 100) }}%</span>
          </div>
          <div class="tsp-row">
            <label>Colours</label>
            <div class="tsp-colors">
              <input
                type="color"
                :value="st.ambientColorA"
                @input="set('ambientColorA', $event.target.value)"
              />
              <input
                type="color"
                :value="st.ambientColorB"
                @input="set('ambientColorB', $event.target.value)"
              />
            </div>
          </div>
        </template>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useMainStore } from '../../store/index.js'
import { LINE_FX } from '../graph/webgl/lineFx.js'
import FxPreview from '../graph/FxPreview.vue'
import UiIcon from '../ui/UiIcon.js'
import { LIFELINE_STYLES, SHADOWED } from './LifelineLayer.js'

const store = useMainStore()
const st = computed(() => store.timelineSettings)
function set(key, value) {
  store.updateTimelineSetting(key, value)
}

const TABS = [
  { id: 'lines', label: 'Lifelines' },
  { id: 'canvas', label: 'Canvas' },
  { id: 'air', label: 'Atmosphere' }
]
const tab = ref('lines')

const BASE_ICONS = { classic: 'minus', tube: 'test-tube', glass: 'gem', glow: 'lightbulb' }
const looks = [
  ...LIFELINE_STYLES.map((s) => ({ ...s, icon: BASE_ICONS[s.id] })),
  ...LINE_FX.filter((f) => f.id !== 'none')
]
const shadowable = computed(() => SHADOWED.has(st.value.lifelineStyle))
const animated = computed(() => !['classic', 'tube', 'glow'].includes(st.value.lifelineStyle))

const SEGS = [
  {
    key: 'connectors',
    label: 'Bonds',
    opts: [
      { id: 'curve', label: 'Curved' },
      { id: 'straight', label: 'Straight' },
      { id: 'hidden', label: 'Hidden' }
    ]
  },
  {
    key: 'grid',
    label: 'Year grid',
    opts: [
      { id: 'bands', label: 'Bands' },
      { id: 'lines', label: 'Lines' },
      { id: 'none', label: 'None' }
    ]
  },
  {
    key: 'labels',
    label: 'Names',
    opts: [
      { id: 'full', label: 'Full', hint: 'Name + years' },
      { id: 'compact', label: 'Compact', hint: 'Short names only' },
      { id: 'hidden', label: 'Hidden' }
    ]
  },
  {
    key: 'eventMarkers',
    label: 'Events',
    opts: [
      { id: 'pills', label: 'Pills' },
      { id: 'dots', label: 'Icons' },
      { id: 'hidden', label: 'Hidden' }
    ]
  }
]

const AMBIENTS = [
  { id: 'none', label: 'None', icon: 'ban' },
  { id: 'fireflies', label: 'Fireflies', icon: 'sparkles' },
  { id: 'stars', label: 'Stars', icon: 'star' },
  { id: 'petals', label: 'Petals', icon: 'flower' },
  { id: 'snow', label: 'Snow', icon: 'snowflake' },
  { id: 'embers', label: 'Embers', icon: 'flame' },
  { id: 'rain', label: 'Rain', icon: 'cloud-rain' },
  { id: 'motes', label: 'Motes', icon: 'sparkle' },
  { id: 'mist', label: 'Mist', icon: 'cloud-fog' },
  { id: 'plum', label: 'Plum', icon: 'flower-2' }
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
  for (const [k, v] of Object.entries(l.set)) set(k, v)
}
</script>

<style scoped>
.tsp {
  width: 292px;
  max-height: calc(100vh - 230px);
  overflow-y: auto;
  padding: 12px 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tsp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.tsp-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: var(--t1);
}
.tsp-reset {
  display: inline-flex;
  align-items: center;
  height: var(--ctl-xs);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--t3);
  border-radius: var(--r-pill);
  font-family: var(--font);
  font-size: 11.5px;
  font-weight: 650;
  padding: 0 10px;
  cursor: pointer;
}
.tsp-reset:hover {
  color: var(--t1);
  border-color: var(--border-strong);
}

/* One-click looks: a row of glowing medallions. */
.tsp-looks {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.tsp-look {
  --lc: var(--accent);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 7px 2px 5px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border);
  background:
    radial-gradient(
      120% 90% at 50% 0%,
      color-mix(in srgb, var(--lc) 22%, transparent),
      transparent 70%
    ),
    var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  cursor: pointer;
  animation: cp-row-in 0.4s var(--ease-out) backwards;
  animation-delay: calc(var(--i) * 0.035s);
  transition:
    transform 0.22s var(--ease-spring),
    border-color var(--dur) ease,
    box-shadow var(--dur) ease;
}
.tsp-look:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--lc) 60%, var(--border));
}
.tsp-look.on {
  color: var(--t1);
  border-color: var(--lc);
  box-shadow:
    0 0 0 1px var(--lc),
    0 6px 18px color-mix(in srgb, var(--lc) 35%, transparent);
}
.tsp-look-ic {
  color: var(--lc);
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--lc) 70%, transparent));
}
.tsp-look.on .tsp-look-ic {
  animation: tsp-bob 1.8s ease-in-out infinite;
}
@keyframes tsp-bob {
  50% {
    transform: translateY(-2px) scale(1.08);
  }
}
.tsp-look-name {
  font-size: var(--fs-xs);
  font-weight: 700;
  white-space: nowrap;
}

.tsp-tabs {
  display: flex;
}
.tsp-tabs .seg-btn {
  flex: 1;
}
.tsp-body {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.tsp-tab-enter-active,
.tsp-tab-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.2s var(--ease-out);
}
.tsp-tab-enter-from {
  opacity: 0;
  transform: translateX(10px);
}
.tsp-tab-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

.tsp-note .ui-icon {
  flex-shrink: 0;
  margin-top: 1px;
}
.tsp-note {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: 11.5px;
  color: var(--t2);
  line-height: 1.4;
  padding: 7px 9px;
  border-radius: var(--r-sm);
  border: 1px dashed var(--border-strong);
}

.tsp-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 5px;
}
.tsp-tile {
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
  animation: cp-row-in 0.4s var(--ease-out) backwards;
  animation-delay: calc(var(--i) * 0.025s);
  transition:
    border-color var(--dur) ease,
    transform 0.2s var(--ease-spring),
    box-shadow var(--dur) ease;
}
.tsp-tile:hover {
  transform: translateY(-1px);
  border-color: var(--border-strong);
}
.tsp-tile.on {
  border-color: var(--accent);
  color: var(--t1);
  box-shadow:
    0 0 0 1px var(--accent),
    0 4px 16px rgba(var(--accent-rgb), 0.25);
}
.tsp-tile-name {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
}
.tsp-tile-ic {
  flex-shrink: 0;
}

.tsp-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
}
.tsp-row.off {
  opacity: 0.5;
}
.tsp-row > label {
  flex: 0 0 78px;
  font-size: 12px;
  font-weight: 600;
  color: var(--t2);
}
.tsp-row input[type='range'] {
  flex: 1;
  min-width: 0;
  accent-color: var(--accent);
}
.tsp-val {
  flex: 0 0 38px;
  text-align: right;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--t3);
  font-variant-numeric: tabular-nums;
}
.tsp-seg {
  flex: 1;
  display: flex;
}
.tsp-seg .seg-btn {
  flex: 1;
  padding-left: 4px;
  padding-right: 4px;
  font-size: 11.5px;
}

.tsp-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.tsp-chip {
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
  animation: cp-row-in 0.4s var(--ease-out) backwards;
  animation-delay: calc(var(--i) * 0.03s);
  transition:
    border-color var(--dur) ease,
    background var(--dur) ease,
    color var(--dur) ease;
}
.tsp-chip.on {
  border-color: var(--accent);
  background: var(--adim);
  color: var(--t1);
}
.tsp-colors {
  display: flex;
  gap: 6px;
}
.tsp-colors input {
  width: 34px;
  height: 22px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: none;
  padding: 0;
  cursor: pointer;
}
</style>
