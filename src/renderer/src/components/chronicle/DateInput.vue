<template>
  <!-- A chronicle date: a year, optionally refined to a month and a day.
       Emits a year/month/day-precision DateValue, or null when the year is blank. -->
  <div class="di" :class="{ empty: !year && year !== 0 }">
    <input
      class="di-year"
      type="number"
      :value="year"
      :placeholder="placeholder"
      step="1"
      @input="setYear($event.target.value)"
    />
    <select
      class="di-month"
      :value="month || ''"
      :disabled="!hasYear"
      @change="setMonth($event.target.value)"
    >
      <option value="">month</option>
      <option v-for="(m, i) in MONTHS" :key="m" :value="i + 1">{{ m }}</option>
    </select>
    <input
      v-if="month"
      class="di-day"
      type="number"
      min="1"
      max="31"
      :value="day || ''"
      placeholder="day"
      @input="setDay($event.target.value)"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Object, default: null },
  placeholder: { type: String, default: 'Year' }
})
const emit = defineEmits(['update:modelValue'])

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const year = computed(() => props.modelValue?.year ?? '')
const month = computed(() => props.modelValue?.month ?? null)
const day = computed(() => props.modelValue?.day ?? null)
const hasYear = computed(() => year.value !== '' && year.value != null)

function build(y, m, d) {
  if (y === '' || y == null || !Number.isFinite(Number(y))) return null
  const mm = m ? Number(m) : null
  const dd = mm && d ? Math.max(1, Math.min(31, Number(d))) : null
  return {
    year: Math.round(Number(y)),
    month: mm,
    day: dd,
    precision: dd ? 'day' : mm ? 'month' : 'year',
    calendar: 'gregorian'
  }
}
function setYear(v) {
  emit('update:modelValue', build(v, month.value, day.value))
}
function setMonth(v) {
  emit('update:modelValue', build(year.value, v || null, v ? day.value : null))
}
function setDay(v) {
  emit('update:modelValue', build(year.value, month.value, v || null))
}
</script>

<style scoped>
.di {
  display: flex;
  gap: 5px;
  align-items: center;
}
.di input,
.di select {
  height: 30px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 13px;
  padding: 0 8px;
  outline: none;
  transition:
    border-color var(--dur) ease,
    box-shadow var(--dur) ease;
}
.di input:focus,
.di select:focus {
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}
.di-year {
  width: 84px;
  font-weight: 700;
}
.di-month {
  width: 82px;
}
.di-month:disabled {
  opacity: 0.45;
}
.di-day {
  width: 58px;
}
</style>
