<template>
  <div class="st-row" :class="{ 'is-off': disabled }" :data-skey="skey || undefined">
    <label class="st-label" :for="id">{{ label }}</label>
    <input
      :id="id"
      class="st-range"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      :disabled="disabled"
      :style="{ '--p': pct + '%' }"
      @input="emit('update:modelValue', +$event.target.value)"
    />
    <span class="st-val">{{ shown }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// A studio slider row: label · filled track · tabular value readout.
const props = defineProps({
  label: { type: String, required: true },
  modelValue: { type: Number, required: true },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 1 },
  step: { type: Number, default: 0.01 },
  /** value → readout text (defaults to the raw number) */
  format: { type: Function, default: null },
  skey: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

const id = `st-sl-${Math.random().toString(36).slice(2, 8)}`
const pct = computed(() => {
  const span = props.max - props.min || 1
  return Math.max(0, Math.min(100, ((props.modelValue - props.min) / span) * 100))
})
const shown = computed(() => (props.format ? props.format(props.modelValue) : props.modelValue))
</script>
