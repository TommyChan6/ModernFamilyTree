<template>
  <div class="st-row" :class="{ 'is-off': disabled }" :data-skey="skey || undefined">
    <label class="st-label st-label-grow" :for="id" :title="hint || undefined">{{ label }}</label>
    <input
      :id="id"
      type="checkbox"
      class="switch"
      :checked="modelValue"
      :disabled="disabled"
      @change="emit('update:modelValue', $event.target.checked)"
    />
  </div>
</template>

<script setup>
// A studio toggle row: label · the app's switch primitive.
defineProps({
  label: { type: String, required: true },
  modelValue: { type: Boolean, required: true },
  hint: { type: String, default: '' },
  skey: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])
const id = `st-sw-${Math.random().toString(36).slice(2, 8)}`
</script>
