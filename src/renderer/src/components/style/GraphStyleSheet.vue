<template>
  <div class="st-sheet">
    <!-- The graph's own style, one chapter at a time. -->
    <!-- ── Looks: coordinated presets ── -->
    <template v-if="chapter === 'looks'">
      <p v-if="store.isInk" class="st-note">{{ t('graphStyle.inkNote') }}</p>
      <div class="gst-looks" data-skey="themePreset">
        <button
          v-for="(th, i) in GRAPH_THEMES"
          :key="th.id"
          class="gst-look"
          :class="{ on: gs.themePreset === th.id }"
          :style="{ '--i': i, '--c1': th.swatch[0], '--c2': th.swatch[1], '--c3': th.swatch[2] }"
          :title="t('graphStyle.themes.' + th.id + '.tagline')"
          @click="applyLook(th)"
        >
          <span class="gst-look-orb" aria-hidden="true">
            <UiIcon :name="th.icon" :size="18" />
          </span>
          <span class="gst-look-name">{{ t('graphStyle.themes.' + th.id + '.name') }}</span>
          <span class="gst-look-swatch" aria-hidden="true">
            <i v-for="(c, j) in th.swatch" :key="j" :style="{ background: c }"></i>
          </span>
        </button>
      </div>
      <p class="st-hint">
        <UiIcon name="palette" :size="13" />{{ t('styleStudio.looks.paletteNote') }}
        <button class="st-link" @click="emit('goto', 'app', 'palette')">
          {{ t('styleStudio.looks.openPalette') }}
        </button>
      </p>
    </template>

    <!-- ── Nodes ── -->
    <template v-else-if="chapter === 'nodes'">
      <section class="st-section" data-skey="nodeShape">
        <h4 class="st-sec-title">{{ t('graphStyle.labels.shape') }}</h4>
        <div class="gst-chips">
          <button
            v-for="(s, i) in SHAPES"
            :key="s"
            class="gst-shape"
            :class="{ on: gs.nodeShape === s }"
            :style="{ '--i': i }"
            :title="t('graphStyle.shapes.' + s)"
            :aria-label="t('graphStyle.shapes.' + s)"
            @click="set('nodeShape', s)"
          >
            <span class="shape-preview" :class="'shape-' + s"></span>
          </button>
        </div>
      </section>
      <section class="st-section" data-skey="nodeDecor">
        <h4 class="st-sec-title">{{ t('graphStyle.labels.ornament') }}</h4>
        <div class="gst-chips">
          <button
            v-for="(d, i) in DECORS"
            :key="d"
            class="gst-decor"
            :class="{ on: gs.nodeDecor === d }"
            :style="{ '--i': i }"
            @click="set('nodeDecor', d)"
          >
            <span class="decor-preview" :class="'decor-' + d"></span>
            <span class="gst-chip-label">{{ t('graphStyle.decors.' + d) }}</span>
          </button>
        </div>
        <StColor
          v-if="gs.nodeDecor !== 'none'"
          :label="t('graphStyle.labels.ornamentColor')"
          :model-value="gs.decorColor"
          @update:model-value="set('decorColor', $event)"
        />
      </section>
      <section class="st-section">
        <StSlider
          skey="nodeRadius"
          :label="t('graphStyle.labels.nodeSize')"
          :model-value="gs.nodeRadius"
          :min="14"
          :max="36"
          :step="1"
          :format="(v) => v + 'px'"
          @update:model-value="set('nodeRadius', $event)"
        />
        <StSlider
          skey="nodeOpacity"
          :label="t('graphStyle.labels.nodeOpacity')"
          :model-value="gs.nodeOpacity"
          :min="0.3"
          :max="1"
          :step="0.05"
          :format="pct"
          @update:model-value="set('nodeOpacity', $event)"
        />
        <StSlider
          skey="labelSize"
          :label="t('graphStyle.labels.labelSize')"
          :model-value="gs.labelSize"
          :min="7"
          :max="16"
          :step="1"
          :format="(v) => v + 'px'"
          @update:model-value="set('labelSize', $event)"
        />
        <StSwitch
          skey="showLabels"
          :label="t('graphStyle.labels.showLabels')"
          :model-value="gs.showLabels"
          @update:model-value="set('showLabels', $event)"
        />
        <StSwitch
          skey="showAge"
          :label="t('graphStyle.labels.showAge')"
          :model-value="gs.showAge"
          @update:model-value="set('showAge', $event)"
        />
        <StSwitch
          skey="glowOnHover"
          :label="t('graphStyle.labels.glowOnHover')"
          :model-value="gs.glowOnHover"
          @update:model-value="set('glowOnHover', $event)"
        />
      </section>
    </template>

    <!-- ── Lines ── -->
    <template v-else-if="chapter === 'lines'">
      <section class="st-section" data-skey="linkRoute">
        <h4 class="st-sec-title">{{ t('graphStyle.labels.lineStyle') }}</h4>
        <div class="gst-routes">
          <button
            v-for="(r, i) in ROUTES"
            :key="r.id"
            class="gst-route"
            :class="{ on: gs.linkRoute === r.id }"
            :style="{ '--i': i }"
            :title="t('graphStyle.routes.' + r.id + '.hint')"
            @click="set('linkRoute', r.id)"
          >
            <svg viewBox="0 0 44 20" class="gst-route-svg" aria-hidden="true">
              <path
                v-for="(p, j) in r.paths"
                :key="j"
                :d="p"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path v-for="(p, j) in r.fills || []" :key="'f' + j" :d="p" fill="currentColor" />
            </svg>
            <span class="gst-chip-label">{{ t('graphStyle.routes.' + r.id + '.label') }}</span>
          </button>
        </div>
      </section>
      <section class="st-section">
        <StSlider
          skey="linkOpacity"
          :label="t('graphStyle.labels.lineOpacity')"
          :model-value="gs.linkOpacity"
          :min="0.2"
          :max="1"
          :step="0.05"
          :format="pct"
          @update:model-value="set('linkOpacity', $event)"
        />
        <StSlider
          v-if="gs.linkRoute === 'organic'"
          skey="lineCurvature"
          :label="t('graphStyle.labels.lineCurvature')"
          :model-value="gs.lineCurvature"
          :min="0"
          :max="0.15"
          :step="0.005"
          :format="pct"
          @update:model-value="set('lineCurvature', $event)"
        />
      </section>
      <section class="st-section" data-skey="widths">
        <h4 class="st-sec-title">{{ t('graphStyle.labels.width') }}</h4>
        <StSlider
          v-for="w in WIDTHS"
          :key="w.key"
          :label="t(w.labelKey)"
          :model-value="gs[w.key]"
          :min="0.5"
          :max="5"
          :step="0.1"
          :format="(v) => v.toFixed(1)"
          @update:model-value="set(w.key, $event)"
        />
      </section>
      <p class="st-hint">
        <UiIcon name="palette" :size="13" />{{ t('styleStudio.lines.colorsNote') }}
        <button class="st-link" @click="emit('goto', 'app', 'palette')">
          {{ t('styleStudio.looks.openPalette') }}
        </button>
      </p>
    </template>

    <!-- ── Line effects ── -->
    <template v-else-if="chapter === 'effects'">
      <div v-if="brushOwns" class="st-callout">
        <span><UiIcon name="brush" :size="14" />{{ t('graphStyle.brushOwns') }}</span>
        <button class="btn btn-soft btn-xs" @click="set('linkRoute', 'organic')">
          {{ t('graphStyle.useOrganic') }}
        </button>
      </div>
      <div class="gst-fx" data-skey="lineFx">
        <button
          v-for="(f, i) in LINE_FX"
          :key="f.id"
          class="gst-fx-tile"
          :class="{ on: gs.lineFx === f.id }"
          :style="{ '--i': i }"
          :title="t(f.hintKey)"
          @click="set('lineFx', f.id)"
        >
          <FxPreview :id="f.id" />
          <span class="gst-fx-name"><UiIcon :name="f.icon" :size="13" />{{ t(f.labelKey) }}</span>
        </button>
      </div>
      <template v-if="gs.lineFx !== 'none'">
        <p class="st-note">{{ t(fxCurrent.hintKey) }}</p>
        <section class="st-section">
          <StSeg
            skey="lineFxScope"
            :label="t('graphStyle.labels.appliesTo')"
            :model-value="gs.lineFxScope"
            :options="fxScopes"
            @update:model-value="set('lineFxScope', $event)"
          />
          <StSeg
            skey="lineFxKeep"
            :label="t('graphStyle.labels.palette')"
            :model-value="gs.lineFxKeep"
            :options="fxPalettes"
            @update:model-value="set('lineFxKeep', $event)"
          />
          <StSlider
            skey="lineFxSpeed"
            :label="t('graphStyle.labels.speed')"
            :model-value="gs.lineFxSpeed"
            :min="0"
            :max="3"
            :step="0.1"
            :format="(v) => v.toFixed(1) + '×'"
            @update:model-value="set('lineFxSpeed', $event)"
          />
          <StSlider
            skey="lineFxGlow"
            :label="t('graphStyle.labels.glow')"
            :model-value="gs.lineFxGlow"
            :min="0"
            :max="2"
            :step="0.05"
            :format="pct"
            @update:model-value="set('lineFxGlow', $event)"
          />
        </section>
      </template>
    </template>

    <!-- ── Atmosphere + render quality ── -->
    <template v-else-if="chapter === 'air'">
      <StSeg
        skey="renderQuality"
        :label="t('styleStudio.air.quality')"
        :model-value="gs.renderQuality === 'performance' ? 'performance' : 'quality'"
        :options="qualities"
        @update:model-value="set('renderQuality', $event)"
      />
      <p v-if="gs.renderQuality === 'performance'" class="st-callout">
        <span><UiIcon name="zap" :size="14" />{{ t('graphStyle.atmosphereOffHint') }}</span>
      </p>
      <section class="st-section" data-skey="ambientFx">
        <h4 class="st-sec-title">{{ t('graphStyle.labels.effect') }}</h4>
        <div class="gst-chips">
          <button
            v-for="(a, i) in AMBIENTS"
            :key="a.id"
            class="gst-ambient"
            :class="{ on: gs.ambientFx === a.id }"
            :style="{ '--i': i }"
            @click="set('ambientFx', a.id)"
          >
            <UiIcon :name="a.icon" :size="15" />{{ t('graphStyle.ambients.' + a.id) }}
          </button>
        </div>
      </section>
      <section v-if="gs.ambientFx !== 'none'" class="st-section">
        <StSlider
          :label="t('graphStyle.labels.density')"
          :model-value="gs.ambientDensity"
          :min="0"
          :max="1"
          :step="0.05"
          :format="pct"
          @update:model-value="set('ambientDensity', $event)"
        />
        <StColor
          :label="t('graphStyle.labels.colors') + ' · A'"
          :model-value="gs.ambientColorA"
          @update:model-value="set('ambientColorA', $event)"
        />
        <StColor
          :label="t('graphStyle.labels.colors') + ' · B'"
          :model-value="gs.ambientColorB"
          @update:model-value="set('ambientColorB', $event)"
        />
      </section>
    </template>

    <!-- ── Camera: the perspective tilt ── -->
    <template v-else-if="chapter === 'camera'">
      <div class="gst-board" :class="{ on: gs.viewTilt }" aria-hidden="true">
        <div class="gst-board-plane" :style="boardStyle">
          <i v-for="n in 5" :key="n" class="gst-board-pin" :class="'p' + n"></i>
        </div>
      </div>
      <section class="st-section">
        <StSwitch
          skey="viewTilt"
          :label="t('graphStyle.labels.tilt')"
          :model-value="gs.viewTilt"
          @update:model-value="store.updateGraphSetting('viewTilt', $event)"
        />
        <StSlider
          skey="tiltAngle"
          :label="t('graphStyle.labels.tiltAngle')"
          :model-value="gs.tiltAngle"
          :min="8"
          :max="64"
          :step="1"
          :format="(v) => v + '°'"
          @update:model-value="setTilt('tiltAngle', $event)"
        />
        <StSlider
          skey="tiltYaw"
          :label="t('graphStyle.labels.tiltYaw')"
          :model-value="gs.tiltYaw"
          :min="-180"
          :max="180"
          :step="5"
          :format="(v) => v + '°'"
          @update:model-value="setTilt('tiltYaw', $event)"
        />
      </section>
      <p class="st-note">{{ t('graphStyle.tiltHint') }}</p>
    </template>

    <!-- ── Physics (Advanced) ── -->
    <template v-else-if="chapter === 'physics'">
      <section class="st-section">
        <StSlider
          skey="linkDistance"
          :label="t('graphStyle.labels.linkDistance')"
          :model-value="gs.linkDistance"
          :min="60"
          :max="300"
          :step="5"
          @update:model-value="set('linkDistance', $event)"
        />
        <StSlider
          skey="chargeStrength"
          :label="t('graphStyle.labels.repulsion')"
          :model-value="gs.chargeStrength"
          :min="-800"
          :max="-50"
          :step="10"
          :format="(v) => Math.abs(v)"
          @update:model-value="set('chargeStrength', $event)"
        />
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMainStore } from '../../store/index.js'
import { useI18n } from '../../i18n'
import { GRAPH_THEMES, THEME_KEYS } from '../graph/graphThemes.js'
import { LINE_FX, lineFxSpec } from '../graph/webgl/lineFx.js'
import { inkLook } from '../graph/inkStyle.js'
import FxPreview from '../graph/FxPreview.vue'
import UiIcon from '../ui/UiIcon.js'
import StSlider from './StSlider.vue'
import StSwitch from './StSwitch.vue'
import StColor from './StColor.vue'
import StSeg from './StSeg.vue'

defineProps({ chapter: { type: String, required: true } })
// goto(layer, chapter) — jump elsewhere in the studio; touch-app — this edit
// also repainted the app layer (a graph look sets the shared palette).
const emit = defineEmits(['goto', 'touch-app'])

const store = useMainStore()
const { t } = useI18n()
const gs = computed(() => store.graphSettings)
const pct = (v) => Math.round(v * 100) + '%'

const SHAPES = [
  'circle',
  'square',
  'diamond',
  'hexagon',
  'shield',
  'oval',
  'octagon',
  'heart',
  'gravestone'
]
const DECORS = ['none', 'aura', 'runes', 'orbit', 'burst', 'pulse', 'enso']
// Little SVG glyphs previewing each route system (44 × 20 viewBox).
const ROUTES = [
  { id: 'organic', paths: ['M3,16 Q22,3 41,12'] },
  { id: 'straight', paths: ['M3,16 L41,5'] },
  { id: 'arc', paths: ['M3,17 Q22,-7 41,17'] },
  { id: 'elbow', paths: ['M4,18 V10 H40 V3'] },
  {
    id: 'trident',
    paths: [
      'M14,3 H30',
      'M22,3 V16',
      'M22,4 Q22,9 17,9 H11 Q6,9 6,14 V16',
      'M22,4 Q22,9 27,9 H33 Q38,9 38,14 V16'
    ]
  },
  { id: 'circuit', paths: ['M4,17 H22 L32,7 H41'] },
  { id: 'wave', paths: ['M3,11 Q8,3 13,11 T23,11 T33,11 T41,11'] },
  { id: 'bezier', paths: ['M3,17 C18,17 26,3 41,3'] },
  {
    id: 'brush',
    paths: [],
    // a filled, tapered calligraphic stroke (pressed head, trailing tail)
    fills: [
      'M3,15.5 C4,12 9,7.5 14,7.6 C22,7.8 28,13 41,5.2 C29,15.6 21,11.4 14,11 C9,10.8 5.5,13.5 3.6,17.4 Z'
    ]
  }
]
const WIDTHS = [
  { key: 'parentChildWidth', labelKey: 'data.relTypes.parent_child' },
  { key: 'spouseWidth', labelKey: 'data.relTypes.spouse' },
  { key: 'adoptedWidth', labelKey: 'data.relTypes.adopted' }
]
const AMBIENTS = [
  { id: 'none', icon: 'ban' },
  { id: 'fireflies', icon: 'sparkles' },
  { id: 'stars', icon: 'star' },
  { id: 'petals', icon: 'flower-2' },
  { id: 'snow', icon: 'snowflake' },
  { id: 'embers', icon: 'flame' },
  { id: 'rain', icon: 'cloud-rain' },
  { id: 'motes', icon: 'sparkle' },
  { id: 'mist', icon: 'mountain' },
  { id: 'plum', icon: 'flower' }
]

const fxCurrent = computed(() => lineFxSpec(gs.value.lineFx))
const fxScopes = computed(() =>
  ['lineage', 'family', 'all'].map((id) => ({
    id,
    label: t('graphStyle.fxScopes.' + id + '.label'),
    title: t('graphStyle.fxScopes.' + id + '.hint')
  }))
)
const fxPalettes = computed(() => [
  { id: false, label: t('graphStyle.labels.effectColors') },
  { id: true, label: t('graphStyle.labels.relColors') }
])
const qualities = computed(() => [
  {
    id: 'quality',
    icon: 'sparkles',
    label: t('graphStyle.quality'),
    title: t('graphStyle.qualityHint')
  },
  {
    id: 'performance',
    icon: 'zap',
    label: t('graphStyle.performance'),
    title: t('graphStyle.performanceHint')
  }
])
// The 水墨 brush look owns the links (Ink theme or the Brush line style).
const brushOwns = computed(() => inkLook(gs.value, store.theme).links)

// The camera chapter's little board leans and turns with the real settings.
const boardStyle = computed(() => {
  const g = gs.value
  return g.viewTilt
    ? { transform: `rotateX(${g.tiltAngle}deg) rotateZ(${-g.tiltYaw}deg)` }
    : { transform: 'none' }
})

function set(key, value) {
  store.updateGraphSetting(key, value)
  // Hand-tuning a theme-coordinated knob makes the look "custom".
  if (THEME_KEYS.has(key) && store.graphSettings.themePreset !== 'custom')
    store.updateGraphSetting('themePreset', 'custom')
}
function applyLook(th) {
  store.applyGraphSettings({ ...th.settings, themePreset: th.id })
  emit('touch-app') // a look repaints the shared palette as well
}
// Dragging the angle (or the turn) also turns the tilt on — the sliders are a
// way in, too.
function setTilt(key, v) {
  if (store.graphSettings.viewTilt) store.updateGraphSetting(key, v)
  else store.applyGraphSettings({ [key]: v, viewTilt: true })
}
</script>

<style scoped>
/* ── Looks: orbs lit by each look's own pigments ── */
.gst-looks {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.gst-look {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 10px 4px 8px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background:
    radial-gradient(90% 70% at 50% 0%, color-mix(in srgb, var(--c1) 18%, transparent), transparent),
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
.gst-look:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--c1) 55%, var(--border));
}
.gst-look.on {
  color: var(--t1);
  border-color: var(--accent);
  box-shadow:
    0 0 0 1px var(--accent),
    0 8px 22px rgba(var(--accent-rgb), 0.25);
}
.gst-look-orb {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  color: #fff;
  background: conic-gradient(from 210deg, var(--c1), var(--c2), var(--c3), var(--c1));
  box-shadow:
    inset 0 0 0 2px rgba(255, 255, 255, 0.18),
    0 4px 12px color-mix(in srgb, var(--c1) 45%, transparent);
  transition: transform 0.6s var(--ease-spring);
}
.gst-look:hover .gst-look-orb,
.gst-look.on .gst-look-orb {
  transform: rotate(-24deg) scale(1.06);
}
.gst-look-orb :deep(svg) {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
}
.gst-look-name {
  font-size: 12px;
  font-weight: 700;
}
.gst-look-swatch {
  display: flex;
  gap: 3px;
}
.gst-look-swatch i {
  width: 10px;
  height: 4px;
  border-radius: 2px;
}

/* ── Chip grids (shape / decor / ambient) ── */
.gst-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.gst-shape,
.gst-decor,
.gst-route,
.gst-ambient {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  cursor: pointer;
  animation: st-pop-in 0.38s var(--ease-out) backwards;
  animation-delay: calc(var(--i) * 0.025s);
  transition:
    transform 0.22s var(--ease-spring),
    border-color var(--dur) ease,
    box-shadow var(--dur) ease,
    color var(--dur) ease;
}
.gst-shape {
  width: 36px;
  height: 36px;
}
.gst-decor {
  width: 52px;
  padding: 7px 0 5px;
}
.gst-ambient {
  flex-direction: row;
  height: var(--ctl-sm);
  padding: 0 10px;
  gap: 5px;
  border-radius: var(--r-pill);
  font-size: 12px;
  font-weight: 600;
}
.gst-shape:hover,
.gst-decor:hover,
.gst-route:hover,
.gst-ambient:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
  color: var(--t1);
}
.gst-shape.on,
.gst-decor.on,
.gst-route.on,
.gst-ambient.on {
  color: var(--t1);
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}
.gst-ambient.on {
  background: var(--adim);
}
.gst-chip-label {
  font-size: var(--fs-xs);
  font-weight: 700;
}

.gst-routes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.gst-route {
  padding: 7px 4px 5px;
}
.gst-route-svg {
  width: 44px;
  height: 20px;
  display: block;
}
.gst-route.on .gst-route-svg {
  color: var(--accent);
}

/* ── Line effects ── */
.gst-fx {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.gst-fx-tile {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 6px 6px 5px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  text-align: left;
  cursor: pointer;
  animation: st-pop-in 0.4s var(--ease-out) backwards;
  animation-delay: calc(var(--i) * 0.03s);
  transition:
    transform 0.22s var(--ease-spring),
    border-color var(--dur) ease,
    box-shadow var(--dur) ease;
}
.gst-fx-tile:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
}
.gst-fx-tile.on {
  color: var(--t1);
  border-color: var(--accent);
  box-shadow:
    0 0 0 1px var(--accent),
    0 6px 18px rgba(var(--accent-rgb), 0.25);
}
.gst-fx-name {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 650;
}

/* ── Camera: a little board that leans with the tilt ── */
.gst-board {
  display: grid;
  place-items: center;
  height: 112px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background:
    radial-gradient(80% 90% at 50% 100%, rgba(var(--accent-rgb), 0.1), transparent), var(--elevated);
  perspective: 340px;
  overflow: hidden;
}
.gst-board-plane {
  position: relative;
  width: 132px;
  height: 84px;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
  background:
    linear-gradient(var(--border) 1px, transparent 1px) 0 0 / 16px 16px,
    linear-gradient(90deg, var(--border) 1px, transparent 1px) 0 0 / 16px 16px,
    var(--surface);
  transition: transform 0.6s var(--ease-spring);
}
.gst-board-pin {
  position: absolute;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 2px 6px rgba(var(--accent-rgb), 0.5);
}
.gst-board-pin.p1 {
  left: 50%;
  top: 22%;
}
.gst-board-pin.p2 {
  left: 24%;
  top: 56%;
  background: var(--t3);
}
.gst-board-pin.p3 {
  left: 76%;
  top: 56%;
  background: var(--t3);
}
.gst-board-pin.p4 {
  left: 38%;
  top: 84%;
  background: var(--t2);
}
.gst-board-pin.p5 {
  left: 62%;
  top: 84%;
  background: var(--t2);
}

/* Shape previews — pure CSS silhouettes matching the shader SDFs */
.shape-preview {
  width: 18px;
  height: 18px;
  background: currentColor;
  display: inline-block;
}
.shape-circle {
  border-radius: 50%;
}
.shape-square {
  border-radius: 4px;
}
.shape-diamond {
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
}
.shape-hexagon {
  clip-path: polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0% 50%);
}
.shape-shield {
  clip-path: polygon(4% 8%, 96% 8%, 96% 52%, 50% 100%, 4% 52%);
}
.shape-oval {
  border-radius: 50%;
  transform: scaleY(0.72);
}
.shape-octagon {
  clip-path: polygon(30% 4%, 70% 4%, 96% 30%, 96% 70%, 70% 96%, 30% 96%, 4% 70%, 4% 30%);
}
/* Headstone: round-arched upright on a plinth (matches the shader's sdStone). */
.shape-gravestone {
  clip-path: path(
    'M3 18 L3 15.5 L4.5 15.5 L4.5 8 A4.5 4.5 0 0 1 13.5 8 L13.5 15.5 L15 15.5 L15 18 Z'
  );
}
.shape-heart {
  clip-path: polygon(
    50% 100%,
    10% 58%,
    2% 34%,
    12% 12%,
    30% 5%,
    50% 18%,
    70% 5%,
    88% 12%,
    98% 34%,
    90% 58%
  );
}

/* Decor previews — a nucleus dot with the ornament hinted around it */
.decor-preview {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  position: relative;
  display: inline-block;
  background: currentColor;
  background-clip: content-box;
  padding: 5px;
}
.decor-aura {
  outline: 1.5px solid currentColor;
  outline-offset: -2px;
}
.decor-runes {
  outline: 1.5px dashed currentColor;
  outline-offset: -1px;
}
.decor-orbit::after {
  content: '';
  position: absolute;
  top: 0;
  right: 1px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
}
.decor-burst {
  clip-path: polygon(
    50% 0%,
    61% 35%,
    98% 35%,
    68% 57%,
    79% 91%,
    50% 70%,
    21% 91%,
    32% 57%,
    2% 35%,
    39% 35%
  );
  padding: 2px;
}
.decor-enso {
  background: radial-gradient(circle, currentColor 0 34%, transparent 62%);
  padding: 0;
  box-shadow: inset 0 0 0 1.6px currentColor;
  -webkit-mask: conic-gradient(from 20deg, #000 0 300deg, transparent 330deg);
  mask: conic-gradient(from 20deg, #000 0 300deg, transparent 330deg);
}
.decor-pulse {
  outline: 1.5px solid currentColor;
  outline-offset: 1px;
}
</style>
