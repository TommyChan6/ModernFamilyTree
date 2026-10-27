<template>
  <input
    class="fs-range"
    :class="['fs-' + kind, { 'fs-ghost': ghost }]"
    type="range"
    :min="kind === 'sentiment' ? -1 : 0"
    max="1"
    step="0.05"
    :value="modelValue"
    :aria-label="ariaLabel"
    :style="trackStyle"
    @input="onInput"
    @change="onChange"
  />
</template>

<script setup>
// A range input on the Dynamics ramp: `sentiment` runs cold → neutral → warm
// over the palette's gradient (−1..1); `intensity` fades up in the accent (0..1).
// `input` fires live while dragging; `change` once it settles (persist then).
// `ghost` dims the thumb — the value is inherited, not the bond's own.
import { computed } from 'vue'
import { useMainStore } from '../../store/index.js'
import { sentimentGradient } from '../../../../shared/sentiment'

const props = defineProps({
  modelValue: { type: Number, required: true },
  kind: { type: String, default: 'sentiment' }, // 'sentiment' | 'intensity'
  ariaLabel: { type: String, default: '' },
  ghost: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'change'])
const store = useMainStore()

const trackStyle = computed(() =>
  props.kind === 'sentiment'
    ? { '--fs-track': `linear-gradient(90deg, ${sentimentGradient(store.dynamicsPalette)})` }
    : null
)
function onInput(e) {
  emit('update:modelValue', Number(e.target.value))
}
function onChange(e) {
  emit('change', Number(e.target.value))
}
</script>

<style scoped>
.fs-range {
  -webkit-appearance: none;
  appearance: none;
  flex: 1;
  min-width: 70px;
  height: 22px;
  margin: 0;
  padding: 0;
  border: none;
  box-shadow: none;
  background: transparent;
  cursor: pointer;
}
.fs-range:focus-visible {
  outline: 2px solid rgba(var(--accent-rgb), 0.6);
  outline-offset: 2px;
  border-radius: 6px;
}
/* Track: the ramp itself (sentiment) or a wedge that widens (intensity). */
.fs-range::-webkit-slider-runnable-track {
  height: 8px;
  border-radius: 4px;
  background: var(--fs-track, var(--border));
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
}
.fs-range::-moz-range-track {
  height: 8px;
  border-radius: 4px;
  background: var(--fs-track, var(--border));
}
.fs-intensity::-webkit-slider-runnable-track {
  background: linear-gradient(90deg, rgba(var(--accent-rgb), 0.12), rgba(var(--accent-rgb), 0.85));
}
.fs-intensity::-moz-range-track {
  background: linear-gradient(90deg, rgba(var(--accent-rgb), 0.12), rgba(var(--accent-rgb), 0.85));
}
.fs-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  margin-top: -3px;
  border-radius: 50%;
  background: var(--surface);
  border: 2px solid var(--t1);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  transition: transform var(--dur-fast) var(--ease-std);
}
.fs-range::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--surface);
  border: 2px solid var(--t1);
}
.fs-range:hover::-webkit-slider-thumb {
  transform: scale(1.15);
}
.fs-ghost::-webkit-slider-thumb {
  border-style: dashed;
  border-color: var(--t3);
}
.fs-ghost::-moz-range-thumb {
  border-style: dashed;
  border-color: var(--t3);
}
</style>
