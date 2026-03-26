<template>
  <Transition name="settings">
    <div v-if="store.settingsOpen" class="settings-panel">
      <div class="settings-header">
        <h3 class="settings-title">Graph Settings</h3>
        <button class="icon-btn" @click="store.toggleSettings()">✕</button>
      </div>

      <div class="settings-body">
        <!-- Node Appearance -->
        <div class="settings-group">
          <button class="group-toggle" @click="toggle('nodes')">
            <span class="group-icon" :class="{ rotated: expanded.nodes }">›</span>
            <span>Node Appearance</span>
          </button>
          <Transition name="expand">
            <div v-if="expanded.nodes" class="group-content">
              <div class="setting-item">
                <label>Node Size</label>
                <div class="slider-row">
                  <input type="range" min="14" max="36" step="1"
                    :value="gs.nodeRadius"
                    @input="set('nodeRadius', +$event.target.value)" />
                  <span class="slider-val">{{ gs.nodeRadius }}px</span>
                </div>
              </div>
              <div class="setting-item">
                <label>Node Opacity</label>
                <div class="slider-row">
                  <input type="range" min="0.3" max="1" step="0.05"
                    :value="gs.nodeOpacity"
                    @input="set('nodeOpacity', +$event.target.value)" />
                  <span class="slider-val">{{ Math.round(gs.nodeOpacity * 100) }}%</span>
                </div>
              </div>
              <div class="setting-item">
                <label>Label Size</label>
                <div class="slider-row">
                  <input type="range" min="7" max="16" step="1"
                    :value="gs.labelSize"
                    @input="set('labelSize', +$event.target.value)" />
                  <span class="slider-val">{{ gs.labelSize }}px</span>
                </div>
              </div>
              <div class="setting-item setting-toggle-row">
                <label>Show Labels</label>
                <button class="micro-toggle" :class="{ on: gs.showLabels }"
                  @click="set('showLabels', !gs.showLabels)">
                  <span class="toggle-knob"></span>
                </button>
              </div>
              <div class="setting-item setting-toggle-row">
                <label>Glow on Hover</label>
                <button class="micro-toggle" :class="{ on: gs.glowOnHover }"
                  @click="set('glowOnHover', !gs.glowOnHover)">
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
                  <input type="color" :value="gs.maleColor"
                    @input="set('maleColor', $event.target.value)" />
                  <span class="color-hex">{{ gs.maleColor }}</span>
                </div>
              </div>
              <div class="setting-item">
                <label>Female</label>
                <div class="color-row">
                  <input type="color" :value="gs.femaleColor"
                    @input="set('femaleColor', $event.target.value)" />
                  <span class="color-hex">{{ gs.femaleColor }}</span>
                </div>
              </div>
              <div class="setting-item">
                <label>Unknown</label>
                <div class="color-row">
                  <input type="color" :value="gs.unknownColor"
                    @input="set('unknownColor', $event.target.value)" />
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
                <label>Line Opacity</label>
                <div class="slider-row">
                  <input type="range" min="0.2" max="1" step="0.05"
                    :value="gs.linkOpacity"
                    @input="set('linkOpacity', +$event.target.value)" />
                  <span class="slider-val">{{ Math.round(gs.linkOpacity * 100) }}%</span>
                </div>
              </div>
              <div class="setting-item">
                <label>Line Curvature</label>
                <div class="slider-row">
                  <input type="range" min="0" max="0.15" step="0.005"
                    :value="gs.lineCurvature"
                    @input="set('lineCurvature', +$event.target.value)" />
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
                    <input type="color" :value="gs.parentChildColor"
                      @input="set('parentChildColor', $event.target.value)" />
                    <span class="color-hex">{{ gs.parentChildColor }}</span>
                  </div>
                </div>
                <div class="setting-item">
                  <label>Width</label>
                  <div class="slider-row">
                    <input type="range" min="0.5" max="5" step="0.1"
                      :value="gs.parentChildWidth"
                      @input="set('parentChildWidth', +$event.target.value)" />
                    <span class="slider-val">{{ gs.parentChildWidth.toFixed(1) }}</span>
                  </div>
                </div>
              </div>

              <div class="line-type-section">
                <div class="line-type-label">
                  <span class="line-preview line-preview-dashed" :style="{ borderColor: gs.spouseColor }"></span>
                  Spouse
                </div>
                <div class="setting-item">
                  <label>Color</label>
                  <div class="color-row">
                    <input type="color" :value="gs.spouseColor"
                      @input="set('spouseColor', $event.target.value)" />
                    <span class="color-hex">{{ gs.spouseColor }}</span>
                  </div>
                </div>
                <div class="setting-item">
                  <label>Width</label>
                  <div class="slider-row">
                    <input type="range" min="0.5" max="5" step="0.1"
                      :value="gs.spouseWidth"
                      @input="set('spouseWidth', +$event.target.value)" />
                    <span class="slider-val">{{ gs.spouseWidth.toFixed(1) }}</span>
                  </div>
                </div>
              </div>

              <div class="line-type-section">
                <div class="line-type-label">
                  <span class="line-preview line-preview-dashed" :style="{ borderColor: gs.adoptedColor }"></span>
                  Adopted
                </div>
                <div class="setting-item">
                  <label>Color</label>
                  <div class="color-row">
                    <input type="color" :value="gs.adoptedColor"
                      @input="set('adoptedColor', $event.target.value)" />
                    <span class="color-hex">{{ gs.adoptedColor }}</span>
                  </div>
                </div>
                <div class="setting-item">
                  <label>Width</label>
                  <div class="slider-row">
                    <input type="range" min="0.5" max="5" step="0.1"
                      :value="gs.adoptedWidth"
                      @input="set('adoptedWidth', +$event.target.value)" />
                    <span class="slider-val">{{ gs.adoptedWidth.toFixed(1) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Physics -->
        <div class="settings-group">
          <button class="group-toggle" @click="toggle('physics')">
            <span class="group-icon" :class="{ rotated: expanded.physics }">›</span>
            <span>Physics / Layout</span>
          </button>
          <Transition name="expand">
            <div v-if="expanded.physics" class="group-content">
              <div class="setting-item">
                <label>Link Distance</label>
                <div class="slider-row">
                  <input type="range" min="60" max="300" step="5"
                    :value="gs.linkDistance"
                    @input="set('linkDistance', +$event.target.value)" />
                  <span class="slider-val">{{ gs.linkDistance }}</span>
                </div>
              </div>
              <div class="setting-item">
                <label>Repulsion</label>
                <div class="slider-row">
                  <input type="range" min="-800" max="-50" step="10"
                    :value="gs.chargeStrength"
                    @input="set('chargeStrength', +$event.target.value)" />
                  <span class="slider-val">{{ Math.abs(gs.chargeStrength) }}</span>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <!-- Footer -->
      <div class="settings-footer">
        <button class="btn btn-ghost btn-sm" @click="store.resetGraphSettings()">
          Reset All
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { reactive, computed } from 'vue'
import { useMainStore } from '../store/index.js'

const store = useMainStore()
const gs = computed(() => store.graphSettings)

const expanded = reactive({
  nodes: true,
  colors: false,
  lines: true,
  physics: false,
})

function toggle(key) {
  expanded[key] = !expanded[key]
}

function set(key, value) {
  store.updateGraphSetting(key, value)
}
</script>

<style scoped>
.settings-panel {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 280px;
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

/* Slider */
.slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.slider-row input[type="range"] {
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

.slider-row input[type="range"]::-webkit-slider-thumb {
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

.slider-row input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.slider-row input[type="range"]:focus {
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

.color-row input[type="color"] {
  width: 28px;
  height: 28px;
  border: 2px solid var(--border);
  border-radius: 8px;
  padding: 2px;
  cursor: pointer;
  background: var(--elevated);
  flex-shrink: 0;
}

.color-row input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-row input[type="color"]::-webkit-color-swatch {
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
  transition: transform 0.3s cubic-bezier(0.34, 1.1, 0.64, 1), opacity 0.2s ease;
}
.settings-leave-active {
  transition: transform 0.22s ease, opacity 0.18s ease;
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
  transition: max-height 0.3s ease, opacity 0.25s ease;
  max-height: 500px;
}
.expand-leave-active {
  transition: max-height 0.2s ease, opacity 0.15s ease;
  max-height: 500px;
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
