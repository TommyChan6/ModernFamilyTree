<template>
  <div class="mn-backdrop" :class="{ hero: first }" @pointerdown.self="!first && emit('close')">
    <div class="mn" @keydown.stop>
      <button v-if="!first" class="mn-x" @click="emit('close')">✕</button>
      <div class="mn-kicker">🗺 {{ first ? t('map.new.kickerFirst') : t('map.new.kicker') }}</div>
      <h2 class="mn-title">{{ first ? t('map.new.titleFirst') : t('map.new.title') }}</h2>
      <p class="mn-sub">{{ t('map.new.sub') }}</p>

      <div class="mn-step">1 · {{ t('map.new.start') }}</div>
      <div class="mn-starts">
        <button
          v-for="(s, i) in STARTS"
          :key="s.id"
          class="mn-start"
          :class="{ on: start === s.id }"
          :style="{ '--i': i }"
          @click="start = s.id"
        >
          <span class="mn-start-icon">{{ s.icon }}</span>
          <span class="mn-start-name">{{ t('map.new.starts.' + s.id) }}</span>
          <span class="mn-start-blurb">{{ t('map.new.startsBlurb.' + s.id) }}</span>
        </button>
      </div>
      <div class="mn-row">
        <div class="mn-shapes">
          <button
            v-for="sh in SHAPES"
            :key="sh.id"
            class="mn-shape"
            :class="{ on: shape === sh.id }"
            @click="shape = sh.id"
          >
            <span
              class="mn-shape-box"
              :style="{ width: sh.w / 100 + 'px', height: sh.h / 100 + 'px' }"
            ></span>
            {{ t('map.new.shapes.' + sh.id) }}
          </button>
        </div>
        <button v-if="start === 'generate'" class="mn-reroll" @click="reroll">
          🎲 {{ t('map.new.reroll') }}
        </button>
      </div>

      <div class="mn-step">2 · {{ t('map.new.style') }}</div>
      <div class="mn-styles">
        <button
          v-for="(st, i) in MAP_STYLE_LIST"
          :key="st.id"
          class="mn-style"
          :class="{ on: styleId === st.id }"
          :style="{ '--i': i }"
          @click="styleId = st.id"
        >
          <MapStyleThumb
            :doc="previews[st.id]"
            :style-id="st.id"
            :width="176"
            :height="thumbH"
            :theme="theme"
          />
          <span class="mn-style-name">{{ st.icon }} {{ t('map.styles.' + st.id) }}</span>
          <span class="mn-style-blurb">{{ t('map.stylesBlurb.' + st.id) }}</span>
        </button>
      </div>

      <div class="mn-foot">
        <input
          v-model="name"
          class="mn-name"
          :placeholder="t('map.new.namePh')"
          maxlength="80"
          @keydown.enter="create"
        />
        <button class="btn btn-primary mn-go" @click="create">✨ {{ t('map.new.create') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from '../../i18n'
import MapStyleThumb from './MapStyleThumb.vue'
import { MAP_STYLE_LIST, styleOf } from './mapStyles'
import { generateWorld } from './mapGen'

// Create a map: pick a starting point (a generated world, open ocean, or
// open land), a sheet shape, and a style — every style card previews the
// exact world you'll get.
defineProps({
  first: { type: Boolean, default: false },
  theme: { type: String, default: 'dark' }
})
const emit = defineEmits(['create', 'close'])
const { t } = useI18n()

const STARTS = [
  { id: 'generate', icon: '🎲' },
  { id: 'ocean', icon: '🌊' },
  { id: 'land', icon: '🌾' }
]
const SHAPES = [
  { id: 'landscape', w: 2400, h: 1600 },
  { id: 'wide', w: 3000, h: 1500 },
  { id: 'square', w: 2000, h: 2000 },
  { id: 'portrait', w: 1600, h: 2200 }
]

const start = ref('generate')
const shape = ref('landscape')
const styleId = ref('fantasy')
const seed = ref(Math.floor(Math.random() * 1e9))
const name = ref('')

const dims = computed(() => SHAPES.find((s) => s.id === shape.value))
const thumbH = computed(() => Math.round((176 * dims.value.h) / dims.value.w))

let n = 0
const uuid = () =>
  globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : 'f' + ++n + Math.random().toString(36).slice(2)

/** The starting features for a style (the eastern styles get Chinese place names). */
function buildFeatures(style) {
  if (start.value !== 'generate') return []
  return generateWorld({
    width: dims.value.w,
    height: dims.value.h,
    seed: seed.value,
    flavor: styleOf(style).eastern ? 'eastern' : 'western',
    uuid
  })
}

const previews = computed(() => {
  const out = {}
  const western = buildFeatures('fantasy')
  const eastern = buildFeatures('ink')
  for (const st of MAP_STYLE_LIST) {
    out[st.id] = {
      id: 'preview-' + seed.value,
      name: '',
      style: st.id,
      base: start.value === 'land' ? 'land' : 'sea',
      width: dims.value.w,
      height: dims.value.h,
      features: st.eastern ? eastern : western,
      tokens: []
    }
  }
  return out
})

function reroll() {
  seed.value = Math.floor(Math.random() * 1e9)
}

function create() {
  const features = buildFeatures(styleId.value)
  emit('create', {
    name: name.value.trim() || t('map.new.defaultName'),
    style: styleId.value,
    base: start.value === 'land' ? 'land' : 'sea',
    width: dims.value.w,
    height: dims.value.h,
    features
  })
}
</script>

<style scoped>
.mn-backdrop {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: mn-fade 0.3s ease backwards;
  overflow-y: auto;
  padding: 20px;
}
.mn-backdrop.hero {
  background: radial-gradient(ellipse at 50% 30%, var(--adim), transparent 70%), var(--bg);
  backdrop-filter: none;
}
@keyframes mn-fade {
  from {
    opacity: 0;
  }
}
.mn {
  position: relative;
  width: min(1000px, 100%);
  padding: 26px 28px 22px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: var(--shadow);
  animation: mn-rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}
@keyframes mn-rise {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.98);
  }
}
.mn-x {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
}
.mn-x:hover {
  background: var(--hover);
  color: var(--t1);
}
.mn-kicker {
  font-size: 11px;
  letter-spacing: 1.6px;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--accent);
}
.mn-title {
  font-size: 24px;
  font-weight: 800;
  color: var(--t1);
  letter-spacing: -0.3px;
  margin-top: 2px;
}
.mn-sub {
  color: var(--t2);
  font-size: 13px;
  margin-top: 4px;
}
.mn-step {
  margin: 18px 0 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--t3);
}
.mn-starts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.mn-start,
.mn-style {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 12px;
  border: 1.5px solid var(--border);
  border-radius: 14px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  text-align: left;
  cursor: pointer;
  animation: mn-card 0.45s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: calc(var(--i) * 50ms + 120ms);
  transition:
    border-color 0.15s,
    transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.2s;
}
@keyframes mn-card {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}
.mn-start:hover,
.mn-style:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}
.mn-start.on,
.mn-style.on {
  border-color: var(--accent);
  box-shadow:
    0 0 0 3px var(--adim),
    0 8px 24px rgba(0, 0, 0, 0.25);
}
.mn-start-icon {
  font-size: 22px;
}
.mn-start-name,
.mn-style-name {
  font-weight: 700;
  font-size: 13.5px;
}
.mn-start-blurb,
.mn-style-blurb {
  font-size: 11.5px;
  color: var(--t2);
  line-height: 1.4;
}
.mn-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.mn-shapes {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.mn-shape {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 12px;
  cursor: pointer;
}
.mn-shape.on {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--adim);
}
.mn-shape-box {
  display: inline-block;
  border: 1.5px solid currentColor;
  border-radius: 2px;
}
.mn-reroll {
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t1);
  border-radius: 999px;
  padding: 5px 12px;
  font-family: var(--font);
  font-size: 12px;
  cursor: pointer;
  transition: transform 0.3s;
}
.mn-reroll:hover {
  transform: rotate(-4deg) scale(1.05);
}
.mn-styles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(176px, 1fr));
  gap: 10px;
}
.mn-style {
  padding: 8px;
}
.mn-style :deep(canvas) {
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}
.mn-style:hover :deep(canvas) {
  transform: scale(1.03);
}
.mn-foot {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}
.mn-name {
  flex: 1;
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t1);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 14px;
  font-family: var(--font);
  outline: none;
}
.mn-name:focus {
  border-color: var(--accent);
}
.mn-go {
  padding: 10px 22px;
  font-size: 14px;
  font-weight: 700;
}
</style>
