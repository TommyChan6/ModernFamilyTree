<template>
  <div class="h3s" :class="{ changed: isChanged, compact }">
    <div class="h3s-head">
      <span class="h3s-label" :title="label">{{ label }}</span>
      <span class="h3s-value">{{ display }}</span>
      <button
        v-if="isChanged"
        class="h3s-reset"
        :title="resetTitle"
        :aria-label="resetTitle"
        @click="reset"
      >
        ↺
      </button>
    </div>
    <div class="h3s-track-wrap">
      <input
        class="h3s-input"
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :value="modelValue"
        :aria-label="label"
        :style="fillStyle"
        @input="onInput"
        @change="onChange"
        @dblclick="reset"
      />
      <span v-if="bipolar" class="h3s-notch" :style="{ left: notchLeft }"></span>
    </div>
    <div v-if="ends && !compact" class="h3s-ends">
      <span>{{ ends[0] }}</span>
      <span>{{ ends[1] }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// One editor slider: bipolar sliders fill from the centre notch, unipolar
// from the left. `live` fires during a drag, `done` once it's released (the
// parent turns a whole drag into one undo step); double-click or ↺ resets.

const props = defineProps({
  label: { type: String, required: true },
  modelValue: { type: Number, default: 0 },
  min: { type: Number, default: -1 },
  max: { type: Number, default: 1 },
  step: { type: Number, default: 0.01 },
  /** Neutral value (reset target + fill origin). */
  neutral: { type: Number, default: 0 },
  ends: { type: Array, default: null },
  /** Value formatter (default: signed percent for bipolar, percent otherwise). */
  format: { type: Function, default: null },
  compact: { type: Boolean, default: false },
  resetTitle: { type: String, default: 'Reset' }
})
const emit = defineEmits(['live', 'done'])

const bipolar = computed(() => props.min < props.neutral && props.max > props.neutral)
const isChanged = computed(() => Math.abs(props.modelValue - props.neutral) > props.step / 2)

const display = computed(() => {
  if (props.format) return props.format(props.modelValue)
  const span = props.max - props.min
  if (bipolar.value) {
    const v = Math.round(((props.modelValue - props.neutral) / (span / 2)) * 100)
    return (v > 0 ? '+' : '') + v
  }
  return Math.round(((props.modelValue - props.min) / span) * 100)
})

const notchLeft = computed(() => {
  const span = props.max - props.min || 1
  // the thumb travels inside 7px insets
  const n = (props.neutral - props.min) / span
  return `calc(7px + (100% - 14px) * ${n})`
})

const fillStyle = computed(() => {
  const span = props.max - props.min || 1
  const p = ((props.modelValue - props.min) / span) * 100
  const n = ((props.neutral - props.min) / span) * 100
  const a = bipolar.value ? Math.min(p, n) : 0
  const b = bipolar.value ? Math.max(p, n) : p
  return {
    '--fa': a + '%',
    '--fb': b + '%'
  }
})

function onInput(e) {
  emit('live', Number(e.target.value))
}
function onChange() {
  emit('done')
}
function reset() {
  emit('live', props.neutral)
  emit('done')
}
</script>

<style scoped>
.h3s {
  padding: 7px 10px 6px;
  border-radius: 10px;
  transition: background 0.15s;
}

.h3s:hover {
  background: var(--hover);
}

.h3s.compact {
  padding: 4px 8px;
}

.h3s-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 18px;
}

.h3s-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 500;
  color: var(--t2);
}

.h3s.changed .h3s-label {
  color: var(--t1);
}

.h3s-value {
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  color: var(--t3);
  min-width: 30px;
  text-align: right;
}

.h3s.changed .h3s-value {
  color: var(--accent);
  font-weight: 600;
}

.h3s-reset {
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--t3);
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
}

.h3s-reset:hover {
  color: var(--accent);
  background: rgba(var(--accent-rgb), 0.12);
}

.h3s-track-wrap {
  position: relative;
  height: 18px;
  display: flex;
  align-items: center;
}

.h3s-input {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 18px;
  margin: 0;
  background: transparent;
  cursor: pointer;
  position: relative;
  z-index: 1;
}

.h3s-input::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 4px;
  background:
    linear-gradient(
        90deg,
        transparent var(--fa),
        var(--accent) var(--fa),
        var(--accent) var(--fb),
        transparent var(--fb)
      )
      no-repeat,
    var(--border);
}

.h3s-input::-moz-range-track {
  height: 4px;
  border-radius: 4px;
  background:
    linear-gradient(
        90deg,
        transparent var(--fa),
        var(--accent) var(--fa),
        var(--accent) var(--fb),
        transparent var(--fb)
      )
      no-repeat,
    var(--border);
}

.h3s-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  margin-top: -5px;
  border-radius: 50%;
  background: var(--surface, #fff);
  border: 2px solid var(--accent);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  transition: transform 0.12s var(--ease-out, ease-out);
}

.h3s-input::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--surface, #fff);
  border: 2px solid var(--accent);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}

.h3s-input:hover::-webkit-slider-thumb,
.h3s-input:focus-visible::-webkit-slider-thumb {
  transform: scale(1.2);
}

.h3s-input:focus-visible {
  outline: none;
}

.h3s-notch {
  position: absolute;
  top: 4px;
  width: 2px;
  height: 10px;
  margin-left: -1px;
  border-radius: 1px;
  background: var(--t3);
  opacity: 0.5;
  pointer-events: none;
}

.h3s-ends {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--t3);
  margin-top: -1px;
}
</style>
