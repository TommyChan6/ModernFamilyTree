<template>
  <div class="mt" :class="{ playing }" @pointerdown.stop @wheel.stop @dblclick.stop>
    <button
      class="mt-play"
      :title="playing ? t('map.time.pause') : t('map.time.play')"
      :aria-label="playing ? t('map.time.pause') : t('map.time.play')"
      @click="emit('toggle-play')"
    >
      <UiIcon v-if="playing" name="pause" :size="18" />
      <UiIcon v-else class="mt-play-icon" name="play" :size="18" />
    </button>
    <button
      class="mt-btn"
      :title="t('map.time.prevEvent')"
      :aria-label="t('map.time.prevEvent')"
      @click="emit('jump', -1)"
    >
      <UiIcon name="skip-back" :size="14" />
    </button>
    <button
      class="mt-btn"
      :title="t('map.time.stepBack')"
      :aria-label="t('map.time.stepBack')"
      @click="emit('step', -1)"
    >
      <UiIcon name="chevron-left" :size="14" />
    </button>

    <label class="mt-year" :title="t('map.time.typeYear')">
      <span class="mt-year-cap">{{ t('map.time.year') }}</span>
      <input
        class="mt-year-input"
        type="number"
        :value="Math.round(year)"
        @change="onYearInput"
        @keydown.enter="$event.target.blur()"
      />
    </label>

    <button
      class="mt-btn"
      :title="t('map.time.stepFwd')"
      :aria-label="t('map.time.stepFwd')"
      @click="emit('step', 1)"
    >
      <UiIcon name="chevron-right" :size="14" />
    </button>
    <button
      class="mt-btn"
      :title="t('map.time.nextEvent')"
      :aria-label="t('map.time.nextEvent')"
      @click="emit('jump', 1)"
    >
      <UiIcon name="skip-forward" :size="14" />
    </button>

    <div class="mt-track-wrap">
      <span class="mt-end">{{ range.min }}</span>
      <div ref="trackEl" class="mt-track" @pointerdown="onTrackDown">
        <div class="mt-rail"></div>
        <!-- feature windows: faint spans on the lower lane -->
        <div
          v-for="(s, i) in spans"
          :key="'s' + i"
          class="mt-span"
          :style="{
            left: pct(s.from) + '%',
            width: Math.max(0.6, pct(s.to + 1) - pct(s.from)) + '%',
            background: s.color
          }"
        ></div>
        <div class="mt-fill" :style="{ width: pct(year) + '%' }"></div>
        <!-- journey stops + events: ticks above the rail -->
        <div
          v-for="(m, i) in markers"
          :key="'m' + i"
          class="mt-mark"
          :class="m.type"
          :style="{ left: pct(m.t) + '%', '--c': m.color }"
          :title="m.label"
        ></div>
        <div class="mt-head" :class="{ grabbed: dragging }" :style="{ left: pct(year) + '%' }">
          <div class="mt-head-core"></div>
        </div>
      </div>
      <span class="mt-end">{{ range.max }}</span>
    </div>

    <button class="mt-speed" :title="t('map.time.speed')" @click="emit('cycle-speed')">
      {{ speedLabel }}
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from '../../i18n'
import UiIcon from '../ui/UiIcon.js'

// The Map view's own time bar: scrub, play, step, and jump between moments.
// Journey stops (person color) and events (feature color) mark the track so
// it's obvious where something happens. Owns no state — MapView does.
const props = defineProps({
  year: { type: Number, required: true },
  range: { type: Object, required: true },
  playing: { type: Boolean, default: false },
  speedLabel: { type: String, default: '1×' },
  markers: { type: Array, default: () => [] },
  spans: { type: Array, default: () => [] }
})
const emit = defineEmits(['scrub', 'toggle-play', 'step', 'jump', 'cycle-speed', 'scrub-end'])
const { t } = useI18n()

const trackEl = ref(null)
const dragging = ref(false)

function pct(y) {
  const { min, max } = props.range
  return Math.max(0, Math.min(100, ((y - min) / Math.max(1, max - min)) * 100))
}

function yearAt(clientX) {
  const r = trackEl.value.getBoundingClientRect()
  const u = Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width)))
  return Math.round(props.range.min + u * (props.range.max - props.range.min))
}

function onTrackDown(e) {
  dragging.value = true
  emit('scrub', yearAt(e.clientX))
  const move = (ev) => emit('scrub', yearAt(ev.clientX))
  const up = () => {
    dragging.value = false
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    emit('scrub-end')
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

function onYearInput(e) {
  const v = parseInt(e.target.value)
  if (Number.isFinite(v)) {
    emit('scrub', v)
    emit('scrub-end')
  }
}
</script>

<style scoped>
.mt {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  width: min(820px, calc(100% - 180px));
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px 7px 7px;
  background: var(--glass-strong);
  backdrop-filter: blur(14px) saturate(1.3);
  -webkit-backdrop-filter: blur(14px) saturate(1.3);
  border: 1px solid var(--border);
  border-radius: 999px;
  box-shadow: var(--shadow);
  z-index: 8;
  animation: mt-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}
@keyframes mt-in {
  from {
    opacity: 0;
    transform: translate(-50%, 20px);
  }
}
.mt-play {
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  border: none;
  border-radius: 50%;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: var(--on-accent);
  cursor: pointer;
  box-shadow: 0 2px 12px var(--adim);
  transition:
    transform 0.15s,
    box-shadow 0.2s;
}
.mt-play-icon {
  /* the triangle's visual centre sits left of its box */
  margin-left: 2px;
}
.mt-play:hover {
  transform: scale(1.08);
}
.mt.playing .mt-play {
  animation: mt-pulse 1.6s ease-in-out infinite;
}
@keyframes mt-pulse {
  50% {
    box-shadow: 0 0 0 7px var(--adim);
  }
}
.mt-btn,
.mt-speed {
  flex: 0 0 auto;
  height: var(--ctl-sm);
  min-width: var(--ctl-sm);
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--t2);
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
}
.mt-btn:hover,
.mt-speed:hover {
  background: var(--hover);
  color: var(--t1);
}
.mt-speed {
  font-size: 12.5px;
  font-weight: 700;
  padding: 0 8px;
  border: 1px solid var(--border);
}
.mt-year {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
  padding: 0 4px;
}
.mt-year-cap {
  font-size: var(--fs-xs);
  letter-spacing: 1.2px;
  color: var(--t3);
  font-weight: 700;
}
.mt-year-input {
  width: 66px;
  border: none;
  background: transparent;
  color: var(--t1);
  font-size: 18px;
  font-weight: 800;
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-family: var(--font);
  outline: none;
  -moz-appearance: textfield;
}
.mt-year-input::-webkit-inner-spin-button,
.mt-year-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
}
.mt-track-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.mt-end {
  font-size: 11.5px;
  color: var(--t3);
  font-variant-numeric: tabular-nums;
}
.mt-track {
  position: relative;
  flex: 1;
  height: 30px;
  cursor: pointer;
  touch-action: none;
}
.mt-rail {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 4px;
  margin-top: -2px;
  border-radius: 2px;
  background: var(--elevated);
}
.mt-fill {
  position: absolute;
  left: 0;
  top: 50%;
  height: 4px;
  margin-top: -2px;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--adim), var(--accent));
}
.mt-span {
  position: absolute;
  top: calc(50% + 5px);
  height: 3px;
  border-radius: 2px;
  opacity: 0.55;
}
.mt-mark {
  position: absolute;
  top: calc(50% - 11px);
  width: 6px;
  height: 6px;
  margin-left: -3px;
  border-radius: 50%;
  background: var(--c);
  box-shadow: 0 0 0 1.5px var(--surface);
  transition: transform 0.15s;
}
.mt-mark.event {
  width: 8px;
  height: 8px;
  margin-left: -4px;
  top: calc(50% - 13px);
  border-radius: 2px;
  transform: rotate(45deg);
}
.mt-mark:hover {
  transform: scale(1.6);
}
.mt-mark.event:hover {
  transform: rotate(45deg) scale(1.6);
}
.mt-head {
  position: absolute;
  top: 50%;
  width: 0;
  height: 0;
  pointer-events: none;
}
.mt-head-core {
  position: absolute;
  left: -8px;
  top: -8px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--surface);
  border: 3px solid var(--accent);
  box-shadow: 0 0 12px var(--accent);
  transition: transform 0.15s;
}
.mt-head.grabbed .mt-head-core {
  transform: scale(1.3);
}
</style>
