<template>
  <div class="sw-row">
    <button
      v-for="c in colors"
      :key="c"
      class="sw-dot"
      :class="{ active: c.toLowerCase() === (modelValue || '').toLowerCase() }"
      :style="{ '--c': c }"
      :title="c"
      @click="$emit('pick', c)"
    ></button>
    <label class="sw-custom" :title="t('character.customColor')" :style="{ '--c': modelValue }">
      <input
        type="color"
        :value="modelValue || '#8f87a3'"
        @input="$emit('live', $event.target.value)"
        @change="$emit('done')"
      />
      <span>＋</span>
    </label>
  </div>
</template>

<script setup>
import { useI18n } from '../../i18n'

// One palette channel's quick-pick row: curated swatches + a custom picker.
// `pick` is a discrete edit; `live`/`done` bracket a color-picker drag so the
// whole drag is one undo step.

defineProps({
  modelValue: { type: String, default: '' },
  colors: { type: Array, required: true }
})
defineEmits(['pick', 'live', 'done'])
const { t } = useI18n()
</script>

<style scoped>
.sw-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sw-dot,
.sw-custom {
  position: relative;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  background: var(--c);
  cursor: pointer;
  padding: 0;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.18);
  transition:
    transform 0.16s cubic-bezier(0.2, 0.9, 0.3, 1.5),
    border-color 0.15s;
}

.sw-dot:hover,
.sw-custom:hover {
  transform: scale(1.18);
}

.sw-dot.active {
  border-color: var(--t1);
  transform: scale(1.12);
}

.sw-custom {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: conic-gradient(from 0deg, #f66, #fd6, #6f8, #6df, #86f, #f6c, #f66);
  overflow: hidden;
}

.sw-custom span {
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  pointer-events: none;
}

.sw-custom input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
</style>
