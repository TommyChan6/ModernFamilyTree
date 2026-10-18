<template>
  <div class="st-row" :data-skey="skey || undefined">
    <span class="st-label">{{ label }}</span>
    <div class="seg st-seg" role="radiogroup" :aria-label="label">
      <button
        v-for="o in options"
        :key="String(o.id)"
        class="seg-btn"
        :class="{ active: modelValue === o.id }"
        role="radio"
        :aria-checked="modelValue === o.id"
        :title="o.title || undefined"
        @click="emit('update:modelValue', o.id)"
      >
        <UiIcon v-if="o.icon" :name="o.icon" :size="13" />{{ o.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
import UiIcon from '../ui/UiIcon.js'

// A studio choice row: label · the app's segmented control.
defineProps({
  label: { type: String, required: true },
  modelValue: { type: [String, Boolean, Number], required: true },
  /** [{ id, label, title?, icon? }] */
  options: { type: Array, required: true },
  skey: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])
</script>
