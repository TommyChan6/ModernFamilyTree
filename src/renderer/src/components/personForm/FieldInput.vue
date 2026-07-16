<template>
  <!-- One control per FieldType. modelValue is always the CANONICAL value
       shape (see coerceValue in src/shared/fields.ts); empty = null. -->

  <!-- text -->
  <textarea
    v-if="def.type === 'text' && def.config.multiline"
    class="fi fi-area"
    :value="modelValue ?? ''"
    :placeholder="placeholder"
    rows="3"
    @input="emitVal($event.target.value)"
  ></textarea>
  <input
    v-else-if="def.type === 'text'"
    class="fi"
    type="text"
    :value="modelValue ?? ''"
    :placeholder="placeholder"
    @input="emitVal($event.target.value)"
  />

  <!-- boolean -->
  <button
    v-else-if="def.type === 'boolean'"
    class="fi-toggle"
    :class="{ on: modelValue === true, unset: modelValue == null }"
    type="button"
    :title="modelValue == null ? 'Not set — click to set' : ''"
    @click="cycleBool"
  >
    <span class="fi-toggle-track"><span class="fi-toggle-thumb"></span></span>
    <span class="fi-toggle-label">{{ boolLabel }}</span>
    <span
      v-if="modelValue != null"
      class="fi-clear"
      title="Clear"
      @click.stop="emit('update:modelValue', null)"
      >✕</span
    >
  </button>

  <!-- number -->
  <div v-else-if="def.type === 'number'" class="fi-num-wrap">
    <input
      class="fi fi-num"
      type="number"
      :value="modelValue ?? ''"
      :min="def.config.min"
      :max="def.config.max"
      :step="def.config.step"
      :placeholder="placeholder || '—'"
      @input="emitVal($event.target.value)"
    />
    <span v-if="def.unit" class="fi-unit">{{ def.unit }}</span>
  </div>

  <!-- number_range -->
  <div v-else-if="def.type === 'number_range'" class="fi-range">
    <input
      class="fi fi-num"
      type="number"
      :value="rangeA"
      placeholder="from"
      @input="emitRange('a', $event.target.value)"
    />
    <span class="fi-range-dash">–</span>
    <input
      class="fi fi-num"
      type="number"
      :value="rangeB"
      placeholder="to"
      @input="emitRange('b', $event.target.value)"
    />
    <span v-if="def.unit" class="fi-unit">{{ def.unit }}</span>
  </div>

  <!-- select: chips when few options, dropdown when many -->
  <div v-else-if="def.type === 'select' && options.length <= 5" class="fi-chips">
    <button
      v-for="opt in options"
      :key="opt.id"
      type="button"
      class="fi-chip"
      :class="{ active: modelValue === opt.id }"
      :style="opt.color ? { '--chip-c': opt.color } : {}"
      @click="emit('update:modelValue', modelValue === opt.id ? null : opt.id)"
    >
      <span v-if="opt.color" class="fi-chip-dot"></span>{{ opt.label }}
    </button>
  </div>
  <select
    v-else-if="def.type === 'select'"
    class="fi"
    :value="modelValue ?? ''"
    @change="emit('update:modelValue', $event.target.value || null)"
  >
    <option value="">—</option>
    <option v-for="opt in options" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
  </select>

  <!-- slider -->
  <div v-else-if="def.type === 'slider'" class="fi-slider" :class="{ unset: modelValue == null }">
    <span v-if="def.config.leftLabel" class="fi-slider-end">{{ def.config.leftLabel }}</span>
    <div class="fi-slider-track-wrap">
      <input
        class="fi-slider-input"
        :style="trackStyle"
        type="range"
        :min="def.config.min ?? 0"
        :max="def.config.max ?? 100"
        :step="def.config.step ?? 1"
        :value="modelValue ?? middle"
        @input="emitVal($event.target.value)"
      />
      <span class="fi-slider-bubble" :style="{ left: bubbleLeft }">
        {{ modelValue == null ? '—' : modelValue + (def.unit ? ' ' + def.unit : '') }}
      </span>
    </div>
    <span v-if="def.config.rightLabel" class="fi-slider-end">{{ def.config.rightLabel }}</span>
    <button
      v-if="modelValue != null"
      class="fi-clear"
      type="button"
      title="Clear"
      @click="emit('update:modelValue', null)"
    >
      ✕
    </button>
  </div>

  <!-- date (year-precision editing for now, like the rest of the app) -->
  <div v-else-if="def.type === 'date'" class="fi-num-wrap">
    <input
      class="fi fi-num"
      type="number"
      :value="modelValue?.year ?? ''"
      placeholder="year"
      @input="emit('update:modelValue', yearDate($event.target.value))"
    />
  </div>

  <!-- date_range -->
  <div v-else-if="def.type === 'date_range'" class="fi-range">
    <input
      class="fi fi-num"
      type="number"
      :value="modelValue?.from?.year ?? ''"
      placeholder="from"
      @input="emitDateRange('from', $event.target.value)"
    />
    <span class="fi-range-dash">–</span>
    <input
      class="fi fi-num"
      type="number"
      :value="modelValue?.to?.year ?? ''"
      placeholder="to"
      @input="emitDateRange('to', $event.target.value)"
    />
  </div>

  <!-- reserved types -->
  <div v-else class="fi-reserved">Coming with custom calendars</div>
</template>

<script setup>
import { computed } from 'vue'
import { yearDate } from '../../../../shared/calendarMath'

const props = defineProps({
  def: { type: Object, required: true },
  modelValue: { type: null, default: null },
  placeholder: { type: String, default: '' },
  /** CSS gradient for the slider track (the gender bay passes one). */
  trackGradient: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const options = computed(() => props.def.config.options || [])
const middle = computed(() => {
  const min = props.def.config.min ?? 0
  const max = props.def.config.max ?? 100
  return (min + max) / 2
})

const boolLabel = computed(() => {
  if (props.modelValue == null) return 'Not set'
  const { leftLabel, rightLabel } = props.def.config
  return props.modelValue === true ? rightLabel || 'Yes' : leftLabel || 'No'
})

const rangeA = computed(() => props.modelValue?.a ?? '')
const rangeB = computed(() => props.modelValue?.b ?? '')

const bubbleLeft = computed(() => {
  const min = props.def.config.min ?? 0
  const max = props.def.config.max ?? 100
  const v = props.modelValue ?? middle.value
  const t = max > min ? (v - min) / (max - min) : 0.5
  return `${t * 100}%`
})

const trackStyle = computed(() =>
  props.trackGradient ? { '--fi-track': props.trackGradient } : {}
)

function emitVal(raw) {
  if (props.def.type === 'text') {
    emit('update:modelValue', String(raw).trim() === '' ? null : String(raw))
  } else {
    emit('update:modelValue', raw === '' || raw == null ? null : Number(raw))
  }
}

function cycleBool() {
  // null → yes → no → null (a tap always does something visible)
  const v = props.modelValue
  emit('update:modelValue', v == null ? true : v === true ? false : null)
}

function emitRange(side, raw) {
  const cur = props.modelValue || { a: null, b: null }
  const num = raw === '' ? null : Number(raw)
  const next = { ...cur, [side]: Number.isFinite(num) ? num : null }
  emit('update:modelValue', next.a == null && next.b == null ? null : next)
}

function emitDateRange(side, raw) {
  const cur = props.modelValue || { from: null, to: null }
  const next = { ...cur, [side]: yearDate(raw) }
  emit('update:modelValue', next.from == null && next.to == null ? null : next)
}
</script>

<style scoped>
.fi {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12.5px;
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.2s;
}
.fi:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--adim);
}
.fi-area {
  resize: vertical;
  min-height: 56px;
}

/* toggle */
.fi-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  padding: 4px 0;
  cursor: pointer;
  color: var(--t1);
  font-family: var(--font);
  font-size: 12.5px;
}
.fi-toggle-track {
  width: 34px;
  height: 19px;
  border-radius: 999px;
  background: var(--elevated);
  border: 1px solid var(--border);
  position: relative;
  transition: background 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  flex-shrink: 0;
}
.fi-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--t3);
  transition:
    transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1),
    background 0.2s;
}
.fi-toggle.on .fi-toggle-track {
  background: var(--adim);
  border-color: var(--accent);
}
.fi-toggle.on .fi-toggle-thumb {
  transform: translateX(15px);
  background: var(--accent);
}
.fi-toggle.unset .fi-toggle-thumb {
  transform: translateX(7.5px);
  opacity: 0.45;
}
.fi-toggle-label {
  color: var(--t2);
}
.fi-toggle.on .fi-toggle-label {
  color: var(--t1);
}

.fi-clear {
  border: none;
  background: transparent;
  color: var(--t3);
  font-size: 10px;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  line-height: 1;
}
.fi-clear:hover {
  color: #ef5350;
}

/* number + ranges */
.fi-num-wrap,
.fi-range {
  display: flex;
  align-items: center;
  gap: 6px;
}
.fi-num {
  min-width: 0;
}
.fi-unit {
  font-size: 11px;
  color: var(--t3);
  flex-shrink: 0;
}
.fi-range-dash {
  color: var(--t3);
  flex-shrink: 0;
}

/* select chips */
.fi-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.fi-chip {
  --chip-c: var(--accent);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 12px;
  cursor: pointer;
  transition:
    transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1),
    background 0.16s,
    border-color 0.16s,
    color 0.16s;
}
.fi-chip:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--chip-c) 45%, transparent);
}
.fi-chip:active {
  transform: scale(0.94);
}
.fi-chip.active {
  background: color-mix(in srgb, var(--chip-c) 16%, transparent);
  border-color: var(--chip-c);
  color: var(--t1);
}
.fi-chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--chip-c);
}

/* slider */
.fi-slider {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.fi-slider-end {
  font-size: 10.5px;
  color: var(--t3);
  flex-shrink: 0;
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fi-slider-track-wrap {
  position: relative;
  flex: 1;
  padding-top: 14px;
}
.fi-slider-input {
  --fi-track: linear-gradient(90deg, var(--adim), var(--accent));
  width: 100%;
  appearance: none;
  height: 6px;
  border-radius: 999px;
  background: var(--fi-track);
  outline: none;
  cursor: pointer;
}
.fi-slider-input::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--t1);
  border: 2px solid var(--surface);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.4);
  transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fi-slider-input::-webkit-slider-thumb:hover {
  transform: scale(1.25);
}
.fi-slider.unset .fi-slider-input::-webkit-slider-thumb {
  opacity: 0.5;
}
.fi-slider-bubble {
  position: absolute;
  top: -4px;
  transform: translateX(-50%);
  font-size: 10px;
  font-weight: 600;
  color: var(--t2);
  background: var(--elevated);
  border: 1px solid var(--border);
  padding: 1px 6px;
  border-radius: 6px;
  pointer-events: none;
  white-space: nowrap;
  transition: left 0.08s linear;
}

.fi-reserved {
  font-size: 11.5px;
  color: var(--t3);
  font-style: italic;
  padding: 6px 0;
}
</style>
