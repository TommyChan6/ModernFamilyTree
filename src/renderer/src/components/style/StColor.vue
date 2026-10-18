<template>
  <div class="st-row" :data-skey="skey || undefined">
    <span v-if="$slots.lead" class="st-lead"><slot name="lead" /></span>
    <label class="st-label st-label-grow" :for="id">{{ label }}</label>
    <span class="st-hex">{{ modelValue }}</span>
    <label class="st-well" :style="{ '--sw': modelValue }">
      <input
        :id="id"
        type="color"
        :value="modelValue"
        :aria-label="label"
        @input="emit('update:modelValue', $event.target.value)"
      />
    </label>
  </div>
</template>

<script setup>
// A studio colour row: optional lead preview · label · hex · round colour well.
defineProps({
  label: { type: String, required: true },
  modelValue: { type: String, required: true },
  skey: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])
const id = `st-co-${Math.random().toString(36).slice(2, 8)}`
</script>
