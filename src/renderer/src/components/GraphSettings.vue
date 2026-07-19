<template>
  <Transition name="settings">
    <div v-if="store.settingsOpen" class="settings-panel">
      <div class="settings-header">
        <h3 class="settings-title">Style</h3>
        <button class="icon-btn" @click="store.toggleSettings()">✕</button>
      </div>

      <div class="settings-body">
        <!-- Render quality -->
        <div class="quality-row">
          <button
            class="quality-opt"
            :class="{ active: gs.renderQuality !== 'performance' }"
            title="Full resolution, ornaments, atmosphere and ambient motion"
            @click="set('renderQuality', 'quality')"
          >
            ✨ Quality
          </button>
          <button
            class="quality-opt"
            :class="{ active: gs.renderQuality === 'performance' }"
            title="Trimmed resolution, still ornaments, no atmosphere — for low-end machines"
            @click="set('renderQuality', 'performance')"
          >
            ⚡ Performance
          </button>
        </div>

        <!-- Themes -->
        <div class="settings-group">
          <button class="group-toggle" @click="toggle('themes')">
            <span class="group-icon" :class="{ rotated: expanded.themes }">›</span>
            <span>Theme</span>
            <span v-if="gs.themePreset === 'custom'" class="custom-chip">custom</span>
          </button>
          <Transition name="expand">
            <div v-if="expanded.themes" class="group-content">
              <div class="theme-grid">
                <button
                  v-for="t in themes"
                  :key="t.id"
                  class="theme-card"
                  :class="{ active: gs.themePreset === t.id }"
                  :title="t.tagline"
                  @click="applyTheme(t)"
                >
                  <span class="theme-icon">{{ t.icon }}</span>
                  <span class="theme-name">{{ t.name }}</span>
                  <span class="theme-swatch">
                    <i v-for="(c, i) in t.swatch" :key="i" :style="{ background: c }"></i>
                  </span>
                </button>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Node Appearance -->
        <div class="settings-group">
          <button class="group-toggle" @click="toggle('nodes')">
            <span class="group-icon" :class="{ rotated: expanded.nodes }">›</span>
            <span>Node Appearance</span>
          </button>
          <Transition name="expand">
            <div v-if="expanded.nodes" class="group-content">
              <div class="setting-item">
                <label>Shape</label>
                <div class="chip-grid">
                  <button
                    v-for="s in shapes"
                    :key="s.id"
                    class="shape-chip"
                    :class="{ active: gs.nodeShape === s.id }"
                    :title="s.label"
                    @click="set('nodeShape', s.id)"
                  >
                    <span class="shape-preview" :class="'shape-' + s.id"></span>
                  </button>
                </div>
              </div>
              <div class="setting-item">
                <label>Ornament</label>
                <div class="chip-grid">
                  <button
                    v-for="d in decors"
                    :key="d.id"
                    class="decor-chip"
                    :class="{ active: gs.nodeDecor === d.id }"
                    :title="d.label"
                    @click="set('nodeDecor', d.id)"
                  >
                    <span class="decor-preview" :class="'decor-' + d.id"></span>
                    <span class="chip-label">{{ d.label }}</span>
                  </button>
                </div>
              </div>
              <div v-if="gs.nodeDecor !== 'none'" class="setting-item">
                <label>Ornament Color</label>
                <div class="color-row">
                  <input
                    type="color"
                    :value="gs.decorColor"
                    @input="set('decorColor', $event.target.value)"
                  />
                  <span class="color-hex">{{ gs.decorColor }}</span>
                </div>
              </div>
              <div class="setting-item">
                <label>Node Size</label>
                <div class="slider-row">
                  <input
                    type="range"
                    min="14"
                    max="36"
                    step="1"
                    :value="gs.nodeRadius"
                    @input="set('nodeRadius', +$event.target.value)"
                  />
                  <span class="slider-val">{{ gs.nodeRadius }}px</span>
                </div>
              </div>
              <div class="setting-item">
                <label>Node Opacity</label>
                <div class="slider-row">
                  <input
                    type="range"
                    min="0.3"
                    max="1"
                    step="0.05"
                    :value="gs.nodeOpacity"
                    @input="set('nodeOpacity', +$event.target.value)"
                  />
                  <span class="slider-val">{{ Math.round(gs.nodeOpacity * 100) }}%</span>
                </div>
              </div>
              <div class="setting-item">
                <label>Label Size</label>
                <div class="slider-row">
                  <input
                    type="range"
                    min="7"
                    max="16"
                    step="1"
                    :value="gs.labelSize"
                    @input="set('labelSize', +$event.target.value)"
                  />
                  <span class="slider-val">{{ gs.labelSize }}px</span>
                </div>
              </div>
              <div class="setting-item setting-toggle-row">
                <label>Show Labels</label>
                <button
                  class="micro-toggle"
                  :class="{ on: gs.showLabels }"
                  @click="set('showLabels', !gs.showLabels)"
                >
                  <span class="toggle-knob"></span>
                </button>
              </div>
              <div class="setting-item setting-toggle-row">
                <label>Show Age</label>
                <button
                  class="micro-toggle"
                  :class="{ on: gs.showAge }"
                  @click="set('showAge', !gs.showAge)"
                >
                  <span class="toggle-knob"></span>
                </button>
              </div>
              <div class="setting-item setting-toggle-row">
                <label>Glow on Hover</label>
                <button
                  class="micro-toggle"
                  :class="{ on: gs.glowOnHover }"
                  @click="set('glowOnHover', !gs.glowOnHover)"
                >
                  <span class="toggle-knob"></span>
                </button>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Node Colors -->
        <div class="settings-group">
          <button class="group-toggle" @click="toggle('colors')">
            <span class="group-icon" :class="{ rotated: expanded.colors }">›</span>
            <span>Node Colors</span>
          </button>
          <Transition name="expand">
            <div v-if="expanded.colors" class="group-content">
              <div class="setting-item">
                <label>Male</label>
                <div class="color-row">
                  <input
                    type="color"
                    :value="gs.maleColor"
                    @input="set('maleColor', $event.target.value)"
                  />
                  <span class="color-hex">{{ gs.maleColor }}</span>
                </div>
              </div>
              <div class="setting-item">
                <label>Female</label>
                <div class="color-row">
                  <input
                    type="color"
                    :value="gs.femaleColor"
                    @input="set('femaleColor', $event.target.value)"
                  />
                  <span class="color-hex">{{ gs.femaleColor }}</span>
                </div>
              </div>
              <div class="setting-item">
                <label>Unknown</label>
                <div class="color-row">
                  <input
                    type="color"
                    :value="gs.unknownColor"
                    @input="set('unknownColor', $event.target.value)"
                  />
                  <span class="color-hex">{{ gs.unknownColor }}</span>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Relationship Lines -->
        <div class="settings-group">
          <button class="group-toggle" @click="toggle('lines')">
            <span class="group-icon" :class="{ rotated: expanded.lines }">›</span>
            <span>Relationship Lines</span>
          </button>
          <Transition name="expand">
            <div v-if="expanded.lines" class="group-content">
              <div class="setting-item">
                <label>Line Style</label>
                <div class="route-grid">
                  <button
                    v-for="r in routes"
                    :key="r.id"
                    class="route-chip"
                    :class="{ active: gs.linkRoute === r.id }"
                    :title="r.hint"
                    @click="set('linkRoute', r.id)"
                  >
                    <svg viewBox="0 0 44 20" class="route-svg">
                      <path
                        v-for="(p, i) in r.paths"
                        :key="i"
                        :d="p"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                    <span class="chip-label">{{ r.label }}</span>
                  </button>
                </div>
              </div>
              <div class="setting-item">
                <label>Line Opacity</label>
                <div class="slider-row">
                  <input
                    type="range"
                    min="0.2"
                    max="1"
                    step="0.05"
                    :value="gs.linkOpacity"
                    @input="set('linkOpacity', +$event.target.value)"
                  />
                  <span class="slider-val">{{ Math.round(gs.linkOpacity * 100) }}%</span>
                </div>
              </div>
              <div v-if="gs.linkRoute === 'organic'" class="setting-item">
                <label>Line Curvature</label>
                <div class="slider-row">
                  <input
                    type="range"
                    min="0"
                    max="0.15"
                    step="0.005"
                    :value="gs.lineCurvature"
                    @input="set('lineCurvature', +$event.target.value)"
                  />
                  <span class="slider-val">{{ Math.round(gs.lineCurvature * 100) }}%</span>
                </div>
              </div>

              <div class="line-type-section">
                <div class="line-type-label">
                  <span class="line-preview" :style="{ background: gs.parentChildColor }"></span>
                  Parent / Child
                </div>
                <div class="setting-item">
                  <label>Color</label>
                  <div class="color-row">
                    <input
                      type="color"
                      :value="gs.parentChildColor"
                      @input="set('parentChildColor', $event.target.value)"
                    />
                    <span class="color-hex">{{ gs.parentChildColor }}</span>
                  </div>
                </div>
                <div class="setting-item">
                  <label>Width</label>
                  <div class="slider-row">
                    <input
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.1"
                      :value="gs.parentChildWidth"
                      @input="set('parentChildWidth', +$event.target.value)"
                    />
                    <span class="slider-val">{{ gs.parentChildWidth.toFixed(1) }}</span>
                  </div>
                </div>
              </div>

              <div class="line-type-section">
                <div class="line-type-label">
                  <span
                    class="line-preview line-preview-dashed"
                    :style="{ borderColor: gs.spouseColor }"
                  ></span>
                  Spouse
                </div>
                <div class="setting-item">
                  <label>Color</label>
                  <div class="color-row">
                    <input
                      type="color"
                      :value="gs.spouseColor"
                      @input="set('spouseColor', $event.target.value)"
                    />
                    <span class="color-hex">{{ gs.spouseColor }}</span>
                  </div>
                </div>
                <div class="setting-item">
                  <label>Width</label>
                  <div class="slider-row">
                    <input
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.1"
                      :value="gs.spouseWidth"
                      @input="set('spouseWidth', +$event.target.value)"
                    />
                    <span class="slider-val">{{ gs.spouseWidth.toFixed(1) }}</span>
                  </div>
                </div>
              </div>

              <div class="line-type-section">
                <div class="line-type-label">
                  <span
                    class="line-preview line-preview-dashed"
                    :style="{ borderColor: gs.adoptedColor }"
                  ></span>
                  Adopted
                </div>
                <div class="setting-item">
                  <label>Color</label>
                  <div class="color-row">
                    <input
                      type="color"
                      :value="gs.adoptedColor"
                      @input="set('adoptedColor', $event.target.value)"
                    />
                    <span class="color-hex">{{ gs.adoptedColor }}</span>
                  </div>
                </div>
                <div class="setting-item">
                  <label>Width</label>
                  <div class="slider-row">
                    <input
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.1"
                      :value="gs.adoptedWidth"
                      @input="set('adoptedWidth', +$event.target.value)"
                    />
                    <span class="slider-val">{{ gs.adoptedWidth.toFixed(1) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Atmosphere -->
        <div class="settings-group">
          <button class="group-toggle" @click="toggle('atmosphere')">
            <span class="group-icon" :class="{ rotated: expanded.atmosphere }">›</span>
            <span>Atmosphere</span>
            <span v-if="gs.renderQuality === 'performance'" class="custom-chip">off in ⚡</span>
          </button>
          <Transition name="expand">
            <div v-if="expanded.atmosphere" class="group-content">
              <div class="setting-item">
                <label>Effect</label>
                <div class="chip-grid">
                  <button
                    v-for="a in ambients"
                    :key="a.id"
                    class="ambient-chip"
                    :class="{ active: gs.ambientFx === a.id }"
                    :title="a.label"
                    @click="set('ambientFx', a.id)"
                  >
                    <span class="ambient-icon">{{ a.icon }}</span>
                    <span class="chip-label">{{ a.label }}</span>
                  </button>
                </div>
              </div>
              <template v-if="gs.ambientFx !== 'none'">
                <div class="setting-item">
                  <label>Colors</label>
                  <div class="color-row">
                    <input
                      type="color"
                      :value="gs.ambientColorA"
                      @input="set('ambientColorA', $event.target.value)"
                    />
                    <input
                      type="color"
                      :value="gs.ambientColorB"
                      @input="set('ambientColorB', $event.target.value)"
                    />
                    <span class="color-hex">{{ gs.ambientColorA }} · {{ gs.ambientColorB }}</span>
                  </div>
                </div>
                <div class="setting-item">
                  <label>Density</label>
                  <div class="slider-row">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      :value="gs.ambientDensity"
                      @input="set('ambientDensity', +$event.target.value)"
                    />
                    <span class="slider-val">{{ Math.round(gs.ambientDensity * 100) }}%</span>
                  </div>
                </div>
              </template>
            </div>
          </Transition>
        </div>

        <!-- Physics (Advanced mode only) -->
        <div v-if="store.caps.style === 'full'" class="settings-group">
          <button class="group-toggle" @click="toggle('physics')">
            <span class="group-icon" :class="{ rotated: expanded.physics }">›</span>
            <span>Physics / Layout</span>
          </button>
          <Transition name="expand">
            <div v-if="expanded.physics" class="group-content">
              <div class="setting-item">
                <label>Link Distance</label>
                <div class="slider-row">
                  <input
                    type="range"
                    min="60"
                    max="300"
                    step="5"
                    :value="gs.linkDistance"
                    @input="set('linkDistance', +$event.target.value)"
                  />
                  <span class="slider-val">{{ gs.linkDistance }}</span>
                </div>
              </div>
              <div class="setting-item">
                <label>Repulsion</label>
                <div class="slider-row">
                  <input
                    type="range"
                    min="-800"
                    max="-50"
                    step="10"
                    :value="gs.chargeStrength"
                    @input="set('chargeStrength', +$event.target.value)"
                  />
                  <span class="slider-val">{{ Math.abs(gs.chargeStrength) }}</span>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <!-- Footer -->
      <div class="settings-footer">
        <button class="btn btn-ghost btn-sm" @click="store.resetGraphSettings()">Reset All</button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { reactive, computed } from 'vue'
import { useMainStore } from '../store/index.js'
import { GRAPH_THEMES, THEME_KEYS } from './graph/graphThemes.js'

const store = useMainStore()
const gs = computed(() => store.graphSettings)
const themes = GRAPH_THEMES

const shapes = [
  { id: 'circle', label: 'Circle' },
  { id: 'square', label: 'Square' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'shield', label: 'Shield' },
  { id: 'oval', label: 'Oval' },
  { id: 'octagon', label: 'Octagon' },
  { id: 'heart', label: 'Heart' }
]

const decors = [
  { id: 'none', label: 'None' },
  { id: 'aura', label: 'Aura' },
  { id: 'runes', label: 'Runes' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'burst', label: 'Burst' },
  { id: 'pulse', label: 'Pulse' }
]

// Little SVG glyphs previewing each route system (44 × 20 viewBox).
const routes = [
  {
    id: 'organic',
    label: 'Organic',
    hint: 'Soft curves with a natural per-line bend',
    paths: ['M3,16 Q22,3 41,12']
  },
  {
    id: 'straight',
    label: 'Straight',
    hint: 'Dead-straight lines',
    paths: ['M3,16 L41,5']
  },
  {
    id: 'arc',
    label: 'Arc',
    hint: 'Sweeping half-moon curves',
    paths: ['M3,17 Q22,-7 41,17']
  },
  {
    id: 'elbow',
    label: 'Elbow',
    hint: 'Right-angle runs, like a flowchart',
    paths: ['M4,18 V10 H40 V3']
  },
  {
    id: 'trident',
    label: 'Trident',
    hint: 'Classic genealogy: couple bar → stem → sibling rail → children',
    paths: ['M14,3 H30', 'M22,3 V9', 'M6,9 H38', 'M6,9 V16', 'M22,9 V16', 'M38,9 V16']
  },
  {
    id: 'circuit',
    label: 'Circuit',
    hint: 'Axis-then-45° traces, like a circuit board',
    paths: ['M4,17 H22 L32,7 H41']
  },
  {
    id: 'wave',
    label: 'Wave',
    hint: 'A sinuous ripple between people',
    paths: ['M3,11 Q8,3 13,11 T23,11 T33,11 T41,11']
  }
]

const ambients = [
  { id: 'none', label: 'None', icon: '◦' },
  { id: 'fireflies', label: 'Fireflies', icon: '✨' },
  { id: 'stars', label: 'Stars', icon: '🌌' },
  { id: 'petals', label: 'Petals', icon: '🌸' },
  { id: 'snow', label: 'Snow', icon: '❄️' },
  { id: 'embers', label: 'Embers', icon: '🔥' },
  { id: 'rain', label: 'Rain', icon: '🌧️' },
  { id: 'motes', label: 'Motes', icon: '🌫️' }
]

const expanded = reactive({
  themes: true,
  nodes: true,
  colors: false,
  lines: true,
  atmosphere: false,
  physics: false
})

function toggle(key) {
  expanded[key] = !expanded[key]
}

function set(key, value) {
  store.updateGraphSetting(key, value)
  // Hand-tuning a theme-coordinated knob makes the look "custom".
  if (THEME_KEYS.has(key) && store.graphSettings.themePreset !== 'custom')
    store.updateGraphSetting('themePreset', 'custom')
}

function applyTheme(t) {
  store.applyGraphSettings({ ...t.settings, themePreset: t.id })
}
</script>

<style scoped>
.settings-panel {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 300px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  z-index: 50;
  box-shadow: 6px 0 24px rgba(0, 0, 0, 0.3);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.settings-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--t1);
}

.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.settings-group {
  border-bottom: 1px solid var(--border);
}

.group-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: var(--t1);
  font-size: 12px;
  font-weight: 700;
  font-family: var(--font);
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: background 0.12s;
}

.group-toggle:hover {
  background: var(--hover);
}

.group-icon {
  font-size: 14px;
  font-weight: 700;
  color: var(--t3);
  transition: transform 0.2s ease;
  display: inline-block;
  width: 12px;
  text-align: center;
}

.group-icon.rotated {
  transform: rotate(90deg);
}

.custom-chip {
  margin-left: auto;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.4px;
  padding: 2px 7px;
  border-radius: 8px;
  background: var(--elevated);
  color: var(--t3);
  text-transform: lowercase;
}

.group-content {
  padding: 4px 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-item label {
  font-size: 11px;
  font-weight: 600;
  color: var(--t2);
}

.setting-toggle-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

/* Quality segmented toggle */
.quality-row {
  display: flex;
  gap: 6px;
  padding: 8px 16px 10px;
  border-bottom: 1px solid var(--border);
}

.quality-opt {
  flex: 1;
  padding: 7px 0;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t2);
  font-size: 11px;
  font-weight: 700;
  font-family: var(--font);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s,
    box-shadow 0.15s;
}

.quality-opt.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
}

/* Theme gallery */
.theme-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.theme-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 6px 8px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--elevated);
  cursor: pointer;
  font-family: var(--font);
  transition:
    transform 0.15s cubic-bezier(0.34, 1.4, 0.64, 1),
    border-color 0.15s,
    box-shadow 0.15s;
}

.theme-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22);
}

.theme-card.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.theme-icon {
  font-size: 18px;
  line-height: 1;
}

.theme-name {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--t1);
}

.theme-swatch {
  display: flex;
  gap: 3px;
}

.theme-swatch i {
  width: 10px;
  height: 4px;
  border-radius: 2px;
  display: inline-block;
}

/* Shape / decor / ambient chip grids */
.chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.shape-chip,
.decor-chip,
.ambient-chip,
.route-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t2);
  cursor: pointer;
  font-family: var(--font);
  transition:
    border-color 0.15s,
    box-shadow 0.15s,
    color 0.15s,
    transform 0.15s;
}

.shape-chip {
  width: 34px;
  height: 34px;
}

.decor-chip,
.ambient-chip {
  width: 48px;
  padding: 6px 0 5px;
}

.shape-chip:hover,
.decor-chip:hover,
.ambient-chip:hover,
.route-chip:hover {
  transform: translateY(-1px);
  border-color: var(--t3);
}

.shape-chip.active,
.decor-chip.active,
.ambient-chip.active,
.route-chip.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
  color: var(--t1);
}

.chip-label {
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.2px;
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
  box-shadow:
    inset 0 0 0 1.5px transparent,
    0 0 0 0 transparent;
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
.decor-pulse {
  outline: 1.5px solid currentColor;
  outline-offset: 1px;
  opacity: 0.9;
}

/* Route picker */
.route-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.route-chip {
  padding: 6px 4px 5px;
}

.route-svg {
  width: 44px;
  height: 20px;
  display: block;
}

.ambient-icon {
  font-size: 14px;
  line-height: 1;
}

/* Slider */
.slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.slider-row input[type='range'] {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--border);
  border-radius: 4px;
  outline: none;
  border: none;
  padding: 0;
  box-shadow: none;
}

.slider-row input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  border: 2px solid var(--surface);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  transition: transform 0.12s;
}

.slider-row input[type='range']::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.slider-row input[type='range']:focus {
  box-shadow: none;
}

.slider-val {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  min-width: 36px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* Color picker */
.color-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.color-row input[type='color'] {
  width: 28px;
  height: 28px;
  border: 2px solid var(--border);
  border-radius: 8px;
  padding: 2px;
  cursor: pointer;
  background: var(--elevated);
  flex-shrink: 0;
}

.color-row input[type='color']::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-row input[type='color']::-webkit-color-swatch {
  border: none;
  border-radius: 4px;
}

.color-hex {
  font-size: 11px;
  font-weight: 500;
  color: var(--t3);
  font-family: 'SF Mono', 'Fira Code', monospace;
}

/* Toggle switch */
.micro-toggle {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  border: none;
  background: var(--border);
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
  padding: 0;
}

.micro-toggle.on {
  background: var(--accent);
}

.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s cubic-bezier(0.34, 1.3, 0.64, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.micro-toggle.on .toggle-knob {
  transform: translateX(16px);
}

/* Line type subsections */
.line-type-section {
  background: var(--elevated);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.line-type-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  color: var(--t1);
}

.line-preview {
  width: 20px;
  height: 2px;
  border-radius: 1px;
  flex-shrink: 0;
}

.line-preview-dashed {
  background: none !important;
  border-top: 2px dashed;
  height: 0;
}

/* Footer */
.settings-footer {
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  display: flex;
  justify-content: center;
}

/* Transition: settings panel slide */
.settings-enter-active {
  transition:
    transform 0.3s cubic-bezier(0.34, 1.1, 0.64, 1),
    opacity 0.2s ease;
}
.settings-leave-active {
  transition:
    transform 0.22s ease,
    opacity 0.18s ease;
}
.settings-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}
.settings-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

/* Transition: expand group content */
.expand-enter-active {
  transition:
    max-height 0.3s ease,
    opacity 0.25s ease;
  max-height: 900px;
}
.expand-leave-active {
  transition:
    max-height 0.2s ease,
    opacity 0.15s ease;
  max-height: 900px;
}
.expand-enter-from {
  max-height: 0;
  opacity: 0;
}
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
