<template>
  <Transition name="cp">
    <div v-if="open" class="cp-backdrop" @click.self="close">
      <div class="cp-panel">
        <div class="cp-search-row">
          <span class="cp-icon">🔍</span>
          <input
            ref="inputRef"
            v-model="query"
            class="cp-input"
            placeholder="Jump to a person…"
            @keydown.down.prevent="move(1)"
            @keydown.up.prevent="move(-1)"
            @keydown.enter.prevent="pick(results[cursor])"
            @keydown.escape="close"
          />
          <span class="cp-kbd">esc</span>
        </div>
        <div ref="listEl" class="cp-results">
          <button
            v-for="(p, i) in results"
            :key="p.id"
            class="cp-item"
            :class="{ active: i === cursor }"
            @mouseenter="cursor = i"
            @click="pick(p)"
          >
            <span class="cp-dot" :style="{ background: genderColor(p.gender) }"></span>
            <span class="cp-name">{{ p.name || 'Unnamed' }}</span>
            <span class="cp-meta">
              <template v-if="p.birth?.year">b. {{ p.birth.year }}</template>
              <template v-if="p.birth?.year && p.occupation"> · </template>
              {{ p.occupation }}
            </span>
          </button>
          <div v-if="!results.length" class="cp-empty">No matches</div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useMainStore } from '../store/index.js'

// ⌘K / Ctrl+K command palette: fuzzy-ish jump to any entity. Picking one
// selects it (opening the profile) wherever you are.
const store = useMainStore()

const open = ref(false)
const query = ref('')
const cursor = ref(0)
const inputRef = ref(null)
const listEl = ref(null)

const results = computed(() => {
  const q = query.value.toLowerCase().trim()
  const list = q
    ? store.persons.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.occupation || '').toLowerCase().includes(q) ||
          (p.location || '').toLowerCase().includes(q)
      )
    : store.persons
  return list.slice(0, 50)
})

watch(results, () => {
  cursor.value = 0
})

function move(delta) {
  if (!results.value.length) return
  cursor.value = (cursor.value + delta + results.value.length) % results.value.length
  nextTick(() => {
    listEl.value?.querySelector('.cp-item.active')?.scrollIntoView({ block: 'nearest' })
  })
}

function pick(person) {
  if (!person) return
  close()
  store.selectPerson(person.id)
}

function show() {
  open.value = true
  query.value = ''
  cursor.value = 0
  nextTick(() => inputRef.value?.focus())
}

function close() {
  open.value = false
}

function genderColor(g) {
  const gs = store.graphSettings
  if (g === 'male') return gs.maleColor
  if (g === 'female') return gs.femaleColor
  return gs.unknownColor
}

function onKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    open.value ? close() : show()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

defineExpose({ show })
</script>

<style scoped>
.cp-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 200;
  display: flex;
  justify-content: center;
  padding-top: 12vh;
}

.cp-panel {
  width: min(520px, calc(100vw - 32px));
  max-height: 60vh;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  align-self: flex-start;
}

.cp-search-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}

.cp-icon {
  font-size: 14px;
}

.cp-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  box-shadow: none;
  font: inherit;
  font-size: 14px;
  color: var(--t1);
  padding: 0;
}

.cp-kbd {
  font-size: 10px;
  font-weight: 700;
  color: var(--t3);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 2px 6px;
}

.cp-results {
  overflow-y: auto;
  padding: 6px;
}

.cp-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--t2);
  font-size: 13px;
  font-family: var(--font);
  cursor: pointer;
  text-align: left;
}

.cp-item.active {
  background: var(--adim);
  color: var(--t1);
}

.cp-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cp-name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-meta {
  margin-left: auto;
  font-size: 11px;
  color: var(--t3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 45%;
}

.cp-empty {
  padding: 18px;
  text-align: center;
  font-size: 12px;
  color: var(--t3);
}

.cp-enter-active,
.cp-leave-active {
  transition: opacity 0.15s ease;
}

.cp-enter-from,
.cp-leave-to {
  opacity: 0;
}
</style>
