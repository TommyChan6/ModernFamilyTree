<template>
  <Teleport to="body">
    <div
      ref="rootEl"
      class="shp"
      :class="{ above: placement.above }"
      :style="{ left: placement.x + 'px', top: placement.y + 'px', width: placement.w + 'px' }"
      role="listbox"
      :aria-multiselectable="multi"
      @pointerdown.stop
    >
      <div class="shp-search">
        <SearchField
          ref="inputEl"
          v-model="query"
          size="sm"
          :clearable="false"
          :placeholder="multi ? t('sheet.picker.findGroup') : t('sheet.picker.findOption')"
          @keydown="onKey"
        />
      </div>
      <div ref="listEl" class="shp-list">
        <button
          v-for="(o, i) in shown"
          :key="o.id"
          class="shp-opt"
          :class="{ hot: i === hot, on: isOn(o.id) }"
          :style="{ '--i': Math.min(i, 12), '--oc': o.color || 'var(--accent)' }"
          role="option"
          :aria-selected="isOn(o.id)"
          @pointerenter="hot = i"
          @click="pick(o.id)"
        >
          <span class="shp-dot"></span>
          <UiIcon v-if="o.icon" class="shp-icon" :name="o.icon" :size="14" />
          <span class="shp-label">{{ o.label }}</span>
          <UiIcon class="shp-check" name="check" :size="14" :stroke="2.6" />
        </button>
        <button
          v-if="canCreate"
          class="shp-opt shp-create"
          :class="{ hot: hot === shown.length }"
          @pointerenter="hot = shown.length"
          @click="create"
        >
          <UiIcon class="shp-plus" name="plus" :size="14" :stroke="2.4" />
          <span class="shp-label">
            {{ multi ? t('sheet.picker.newGroup') : t('sheet.picker.addOption') }} “<b>{{
              query.trim()
            }}</b
            >”
          </span>
        </button>
        <div v-if="!shown.length && !canCreate" class="shp-empty">
          {{ t('sheet.picker.empty') }}
        </div>
      </div>
      <div class="shp-foot">
        <button v-if="!multi && selected.length" class="shp-clear" @click="$emit('clear')">
          {{ t('sheet.picker.clear') }}
        </button>
        <span class="shp-hint">
          <UiIcon name="arrow-up-down" :size="12" />
          {{ multi ? t('sheet.picker.hintMulti') : t('sheet.picker.hintSingle') }}
        </span>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import UiIcon from '../ui/UiIcon.js'
import SearchField from '../ui/SearchField.vue'
import { useI18n } from '../../i18n'

// Floating option picker for the Sheet's select-trait and Groups cells. It is
// anchored to the cell's screen rect (flipping above when there's no room
// below), owns its own filter input and keyboard, and never mutates anything
// itself — it emits pick / create / clear / close and the sheet decides.

const props = defineProps({
  options: { type: Array, required: true }, // [{ id, label, color?, icon? }]
  selected: { type: Array, default: () => [] }, // ids currently on
  multi: { type: Boolean, default: false },
  anchor: { type: Object, required: true }, // DOMRect-like { left, top, bottom, width }
  initialQuery: { type: String, default: '' }
})
const emit = defineEmits(['pick', 'create', 'clear', 'close'])
const { t } = useI18n()

const rootEl = ref(null)
const inputEl = ref(null)
const listEl = ref(null)
const query = ref(props.initialQuery)
const hot = ref(0)

const selectedSet = computed(() => new Set(props.selected))
const isOn = (id) => selectedSet.value.has(id)

const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? props.options.filter((o) => o.label.toLowerCase().includes(q)) : props.options
})
const canCreate = computed(() => {
  const q = query.value.trim().toLowerCase()
  return !!q && !props.options.some((o) => o.label.trim().toLowerCase() === q)
})

// Start on the current value so ↵ right away is a no-op, not a surprise.
watch(
  shown,
  (list) => {
    const i = list.findIndex((o) => isOn(o.id))
    hot.value = query.value.trim() ? 0 : Math.max(0, i)
  },
  { immediate: true }
)

const PICKER_H = 300
const placement = computed(() => {
  const a = props.anchor
  const w = Math.max(220, Math.min(320, a.width + 40))
  const vw = window.innerWidth
  const vh = window.innerHeight
  const above = a.bottom + PICKER_H + 8 > vh && a.top > PICKER_H + 8
  return {
    above,
    w,
    x: Math.max(8, Math.min(a.left, vw - w - 8)),
    y: above ? a.top - 4 : a.bottom + 4
  }
})

function pick(id) {
  emit('pick', id)
}
function create() {
  const label = query.value.trim()
  if (!label) return
  emit('create', label)
  query.value = ''
}

function scrollHotIntoView() {
  nextTick(() => {
    const el = listEl.value?.children[hot.value]
    el?.scrollIntoView?.({ block: 'nearest' })
  })
}

function onKey(e) {
  const max = shown.value.length + (canCreate.value ? 1 : 0) - 1
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    hot.value = Math.min(max, hot.value + 1)
    scrollHotIntoView()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    hot.value = Math.max(0, hot.value - 1)
    scrollHotIntoView()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (hot.value < shown.value.length) pick(shown.value[hot.value].id)
    else if (canCreate.value) create()
  } else if (e.key === 'Escape' || e.key === 'Tab') {
    e.preventDefault()
    // close(direction): Tab hands focus back to the sheet one cell over.
    emit('close', e.key === 'Tab' ? (e.shiftKey ? 'prev' : 'next') : null)
  }
}

onMounted(() => {
  const input = inputEl.value?.el
  input?.focus({ preventScroll: true })
  // Caret after any typed-to-open text.
  const len = query.value.length
  input?.setSelectionRange?.(len, len)
})

defineExpose({ contains: (el) => !!rootEl.value?.contains(el) })
</script>

<style scoped>
.shp {
  position: fixed;
  z-index: 400;
  display: flex;
  flex-direction: column;
  max-height: 300px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--glass-soft);
  backdrop-filter: blur(18px) saturate(1.3);
  box-shadow: var(--shadow);
  overflow: hidden;
  transform-origin: top left;
  animation: shp-in 0.2s cubic-bezier(0.34, 1.3, 0.5, 1);
}
.shp.above {
  transform: translateY(-100%);
  transform-origin: bottom left;
  animation-name: shp-in-above;
}
@keyframes shp-in {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.96);
  }
}
@keyframes shp-in-above {
  from {
    opacity: 0;
    transform: translateY(calc(-100% + 4px)) scale(0.96);
  }
}
.shp-search {
  padding: 8px;
  border-bottom: 1px solid var(--border);
}
.shp-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 4px;
}
.shp-opt {
  --oc: var(--accent);
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 30px;
  padding: 0 8px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--t1);
  font-family: var(--font);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  animation: shp-opt-in 0.26s cubic-bezier(0.22, 1, 0.36, 1) calc(var(--i, 0) * 0.018s) backwards;
  transition: background 0.12s;
}
@keyframes shp-opt-in {
  from {
    opacity: 0;
    transform: translateX(-6px);
  }
}
.shp-opt.hot {
  background: var(--hover);
}
.shp-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--oc);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--oc) 18%, transparent);
}
.shp-icon {
  flex-shrink: 0;
  color: var(--oc);
}
.shp-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shp-check {
  flex-shrink: 0;
  color: var(--accent);
  opacity: 0;
  transform: scale(0.4);
  transition:
    opacity 0.15s,
    transform 0.22s cubic-bezier(0.34, 1.6, 0.5, 1);
}
.shp-opt.on .shp-check {
  opacity: 1;
  transform: none;
}
.shp-create {
  color: var(--t2);
}
.shp-create b {
  color: var(--t1);
}
.shp-plus {
  flex-shrink: 0;
  color: var(--accent);
}
.shp-empty {
  padding: 14px 8px;
  text-align: center;
  font-size: 12.5px;
  color: var(--t3);
}
.shp-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-top: 1px solid var(--border);
}
.shp-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  font-size: 11.5px;
  color: var(--t3);
}
.shp-clear {
  border: none;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
  transition:
    color 0.15s,
    background 0.15s;
}
.shp-clear:hover {
  color: var(--t1);
  background: var(--hover);
}
@media (prefers-reduced-motion: reduce) {
  .shp,
  .shp-opt {
    animation: none;
  }
}
</style>
