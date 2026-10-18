<template>
  <div class="icon-picker">
    <div class="ip-grid" role="listbox" :aria-label="ariaLabel || t('ui.icon')">
      <button
        v-if="allowNone"
        type="button"
        class="ip-cell ip-none"
        :class="{ on: !current }"
        role="option"
        :aria-selected="!current"
        :title="t('ui.noIcon')"
        @click="pick('')"
      >
        <UiIcon name="ban" :size="15" />
      </button>
      <button
        v-for="n in shown"
        :key="n"
        type="button"
        class="ip-cell"
        :class="{ on: current === n }"
        role="option"
        :aria-selected="current === n"
        :title="pretty(n)"
        @click="pick(n)"
      >
        <UiIcon :name="n" :size="17" />
      </button>
    </div>
    <SearchField
      v-if="searchable"
      v-model="query"
      class="ip-search"
      size="sm"
      :placeholder="t('ui.searchIcons')"
    />
    <div v-if="query && !shown.length" class="ip-empty">{{ t('ui.noIconMatch', { query }) }}</div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import UiIcon from './UiIcon.js'
import SearchField from './SearchField.vue'
import { ICON_NAMES, resolveIcon } from './icons.js'
import { useI18n } from '../../i18n'

// Pick one icon NAME (components/ui/icons.js). Shows a curated grid; typing in
// the search widens it to the whole bundled set. A legacy stored glyph (an
// emoji saved before the icon system) shows as its resolved icon selected.
const props = defineProps({
  modelValue: { type: String, default: '' },
  /** The curated names shown before searching. */
  options: { type: Array, default: () => DEFAULT_OPTIONS },
  allowNone: { type: Boolean, default: false },
  searchable: { type: Boolean, default: true },
  ariaLabel: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()
const query = ref('')
const current = computed(() => resolveIcon(props.modelValue) || '')

const shown = computed(() => {
  const q = query.value.trim().toLowerCase().replace(/\s+/g, '-')
  if (!q) return props.options
  return ICON_NAMES.filter((n) => n.includes(q)).slice(0, 60)
})

function pick(n) {
  emit('update:modelValue', n)
}
function pretty(n) {
  const s = n.replace(/-/g, ' ')
  return s[0].toUpperCase() + s.slice(1)
}
</script>

<script>
const DEFAULT_OPTIONS = [
  'star',
  'crown',
  'swords',
  'shield',
  'castle',
  'landmark',
  'scroll',
  'book-open',
  'heart',
  'gem',
  'handshake',
  'baby',
  'skull',
  'flame',
  'sparkles',
  'sun',
  'moon',
  'leaf',
  'tree-deciduous',
  'mountain',
  'waves',
  'compass',
  'sailboat',
  'train-front',
  'factory',
  'lightbulb',
  'rocket',
  'flask-conical',
  'music',
  'party-popper',
  'trophy',
  'flag'
]
</script>

<style scoped>
.icon-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ip-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--ctl-md), 1fr));
  gap: 4px;
}
.ip-cell {
  height: var(--ctl-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--elevated);
  color: var(--t2);
  cursor: pointer;
  transition:
    background var(--dur) ease,
    color var(--dur) ease,
    border-color var(--dur) ease;
}
.ip-cell:hover {
  background: var(--hover);
  color: var(--t1);
}
.ip-cell.on {
  background: var(--adim);
  border-color: rgba(var(--accent-rgb), 0.55);
  color: var(--accent);
}
.ip-none {
  color: var(--t3);
}
.ip-empty {
  font-size: var(--fs-sm);
  color: var(--t3);
}
</style>
