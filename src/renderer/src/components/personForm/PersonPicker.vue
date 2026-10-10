<template>
  <!-- Searchable person combobox: type to filter, ↑/↓ + Enter to pick, and an
       inline "create as new person" row so trees grow outward in one step. -->
  <div class="pp" @keydown.esc.stop="emit('cancel')">
    <div class="pp-input-wrap">
      <SearchField
        ref="inputEl"
        v-model="query"
        size="sm"
        :placeholder="placeholder"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="chooseActive"
      />
    </div>
    <div class="pp-list">
      <button
        v-for="(p, i) in results"
        :key="p.id"
        type="button"
        class="pp-row"
        :class="{ active: i === activeIdx }"
        @pointerenter="activeIdx = i"
        @click="pick(p)"
      >
        <span class="pp-avatar" :style="{ '--pa-hue': hueOf(p) }">
          <img v-if="p.primary_image" :src="imgUrl(p.primary_image)" alt="" />
          <template v-else>{{ initialOf(p) }}</template>
        </span>
        <span class="pp-name">{{ p.name || 'Unnamed' }}</span>
        <span v-if="p.birth?.year" class="pp-meta">b. {{ p.birth.year }}</span>
      </button>

      <div v-if="results.length === 0 && !canCreate" class="pp-empty">No one matches</div>

      <button
        v-if="canCreate"
        type="button"
        class="pp-row pp-create"
        :class="{ active: activeIdx === results.length }"
        :disabled="creating"
        @pointerenter="activeIdx = results.length"
        @click="createAndPick"
      >
        <span class="pp-avatar pp-avatar-new"><UiIcon name="plus" :size="14" /></span>
        <span class="pp-name">
          {{
            creating ? 'Creating…' : `Create “${query.trim()}” as a new ${store.noun.toLowerCase()}`
          }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useMainStore } from '../../store/index.js'
import { api } from '../../api'
import SearchField from '../ui/SearchField.vue'
import UiIcon from '../ui/UiIcon.js'

const props = defineProps({
  /** person ids to hide (self, already linked…) */
  exclude: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Type a name…' },
  /** allow the inline create-new row */
  allowCreate: { type: Boolean, default: true }
})
const emit = defineEmits(['pick', 'cancel'])

const store = useMainStore()
const query = ref('')
const activeIdx = ref(0)
const creating = ref(false)
const inputEl = ref(null)

onMounted(() => inputEl.value?.focus())

const excluded = computed(() => new Set(props.exclude))
const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  const pool = store.persons.filter((p) => !excluded.value.has(p.id))
  const hits = q ? pool.filter((p) => (p.name || '').toLowerCase().includes(q)) : pool
  // Prefix matches first, then alphabetical — stable & predictable.
  return hits
    .slice()
    .sort((a, b) => {
      const ap = (a.name || '').toLowerCase().startsWith(q) ? 0 : 1
      const bp = (b.name || '').toLowerCase().startsWith(q) ? 0 : 1
      return ap - bp || (a.name || '').localeCompare(b.name || '')
    })
    .slice(0, 8)
})

const canCreate = computed(
  () =>
    props.allowCreate &&
    query.value.trim().length > 0 &&
    !results.value.some((p) => (p.name || '').toLowerCase() === query.value.trim().toLowerCase())
)

function move(delta) {
  const count = results.value.length + (canCreate.value ? 1 : 0)
  if (!count) return
  activeIdx.value = (activeIdx.value + delta + count) % count
}

function chooseActive() {
  if (activeIdx.value < results.value.length) pick(results.value[activeIdx.value])
  else if (canCreate.value) createAndPick()
}

function pick(p) {
  emit('pick', p)
}

async function createAndPick() {
  const name = query.value.trim()
  if (!name || creating.value) return
  creating.value = true
  try {
    const res = await store.createPerson({ name })
    if (res.success) emit('pick', res.data)
  } finally {
    creating.value = false
  }
}

const imgUrl = (p) => api.getImageUrl(p) || ''
const initialOf = (p) => ((p.name || '?').trim()[0] || '?').toUpperCase()
function hueOf(p) {
  let h = 0
  for (const c of p.id) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}
</script>

<style scoped>
.pp {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  overflow: hidden;
  box-shadow: var(--shadow);
  animation: pp-in 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes pp-in {
  from {
    transform: translateY(-4px) scale(0.98);
    opacity: 0;
  }
}
.pp-input-wrap {
  padding: 6px;
  border-bottom: 1px solid var(--border);
}
.pp-list {
  max-height: 236px;
  overflow-y: auto;
  padding: 4px;
}
.pp-row {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--t1);
  font-family: var(--font);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}
.pp-row.active {
  background: var(--hover);
}
.pp-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: hsl(var(--pa-hue, 220), 45%, 45%);
}
.pp-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pp-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pp-meta {
  font-size: 12px;
  color: var(--t3);
  flex-shrink: 0;
}
.pp-empty {
  padding: 12px;
  font-size: 12.5px;
  color: var(--t3);
  text-align: center;
  font-style: italic;
}
.pp-create {
  border-top: 1px dashed var(--border);
  border-radius: 0 0 8px 8px;
  margin-top: 2px;
  color: var(--accent);
}
.pp-avatar-new {
  background: var(--adim);
  color: var(--accent);
}

/* ── 水墨 ink theme ─────────────────────────────────────────────────────── */
:root[data-theme='ink'] .pp {
  border-radius: 2px;
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  border-color: var(--ink-mount-line);
  box-shadow:
    0 0 0 2px var(--ink-silk),
    0 0 0 3px rgba(58, 42, 22, 0.2),
    var(--shadow);
}
:root[data-theme='ink'] .pp-row {
  border-radius: 2px;
}
:root[data-theme='ink'] .pp-row.active {
  background: rgba(179, 53, 42, 0.07);
  box-shadow: inset 3px 0 0 var(--accent);
}
:root[data-theme='ink'] .pp-name {
  font-family: var(--font-brush);
  font-size: 15.5px;
  font-weight: 400;
}
</style>
