<template>
  <div
    class="search-field"
    :class="[`sf-${size}`, { 'has-value': !!modelValue }, rootAttrs.class]"
    :style="rootAttrs.style"
  >
    <UiIcon class="sf-icon" name="search" :size="iconSize" :stroke="2.1" />
    <input
      ref="inputEl"
      v-bind="inputAttrs"
      class="sf-input"
      type="text"
      role="searchbox"
      :value="modelValue"
      :placeholder="shownPlaceholder"
      :aria-label="ariaLabel || shownPlaceholder"
      spellcheck="false"
      autocomplete="off"
      @input="onInput"
      @keydown.esc="onEsc"
    />
    <button
      v-if="clearable && modelValue"
      type="button"
      class="sf-clear"
      :title="t('ui.clearSearch')"
      :aria-label="t('ui.clearSearch')"
      @mousedown.prevent
      @click="clear"
    >
      <UiIcon name="x" :size="iconSize - 2" :stroke="2.2" />
    </button>
  </div>
</template>

<script setup>
import { computed, ref, useAttrs } from 'vue'
import UiIcon from './UiIcon.js'
import { useI18n } from '../../i18n'

// The app's one search input: magnifier icon inside the field, an optional
// clear button, Esc-to-clear. Extra attributes (@keydown, @focus, autofocus,
// data-*) land on the <input>; `class`/`style` style the wrapper as usual.
defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
  /** 'sm' (28px) · 'md' (34px) · 'lg' (42px) */
  size: { type: String, default: 'md' },
  clearable: { type: Boolean, default: true }
})
const emit = defineEmits(['update:modelValue', 'clear'])

const { t } = useI18n()
// Default placeholder resolves at render time so it follows the UI language.
const shownPlaceholder = computed(() => props.placeholder || t('ui.search'))

const attrs = useAttrs()
// Vue puts class/style into $attrs too once inheritAttrs is off — route them
// to the wrapper and everything else (listeners, autofocus, data-*) to <input>.
const rootAttrs = computed(() => ({ class: attrs.class, style: attrs.style }))
const inputAttrs = computed(() => {
  const { class: _c, style: _s, ...rest } = attrs
  return rest
})

const inputEl = ref(null)
const iconSize = computed(() => ({ sm: 15, md: 17, lg: 19 })[props.size] || 17)

function onInput(e) {
  emit('update:modelValue', e.target.value)
}
function clear() {
  emit('update:modelValue', '')
  emit('clear')
  inputEl.value?.focus()
}
function onEsc(e) {
  if (!props.modelValue) return
  e.stopPropagation()
  clear()
}

defineExpose({
  focus: () => inputEl.value?.focus(),
  select: () => inputEl.value?.select(),
  el: inputEl
})
</script>

<style scoped>
.search-field {
  --sf-h: 34px;
  --sf-pad: 11px;
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
}
.sf-sm {
  --sf-h: 28px;
  --sf-pad: 9px;
}
.sf-lg {
  --sf-h: 42px;
  --sf-pad: 14px;
}
.sf-icon {
  position: absolute;
  left: var(--sf-pad);
  top: 50%;
  transform: translateY(-50%);
  color: var(--t3);
  pointer-events: none;
  transition: color var(--dur) ease;
}
.search-field:focus-within .sf-icon {
  color: var(--accent);
}
.sf-input {
  width: 100%;
  height: var(--sf-h);
  padding: 0 calc(var(--sf-pad) + 4px) 0 calc(var(--sf-pad) + 25px);
  font-size: 13.5px;
  line-height: var(--sf-h);
  border-radius: var(--r-md);
}
.sf-sm .sf-input {
  padding-left: calc(var(--sf-pad) + 22px);
  font-size: 13px;
  border-radius: var(--r-sm);
}
.sf-lg .sf-input {
  padding-left: calc(var(--sf-pad) + 28px);
  font-size: 15px;
  border-radius: var(--r-lg);
}
.has-value .sf-input {
  padding-right: calc(var(--sf-h) - 2px);
}
.sf-input::-webkit-search-cancel-button {
  display: none;
}
.sf-clear {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: calc(var(--sf-h) - 10px);
  height: calc(var(--sf-h) - 10px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: var(--r-xs);
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  transition:
    background var(--dur) ease,
    color var(--dur) ease;
}
.sf-clear:hover {
  background: var(--hover);
  color: var(--t1);
}
.sf-clear:active {
  scale: 0.92;
}
</style>
