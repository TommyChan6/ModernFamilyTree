<template>
  <aside class="right-sidebar">
    <!-- Header -->
    <div class="sidebar-header">
      <h2 class="sidebar-title">Family Members</h2>
      <span class="badge">{{ store.personCount }}</span>
    </div>

    <!-- Search -->
    <div class="search-wrap">
      <span class="search-icon">🔍</span>
      <input v-model="searchQuery" class="search-input" placeholder="Filter members…" />
    </div>

    <!-- Person List (virtualized: only rows near the viewport are in the DOM) -->
    <div ref="listEl" class="person-list" @scroll.passive="onScroll">
      <div class="person-list-body" :style="{ height: totalH + 'px' }">
        <div
          v-for="row in visiblePersons"
          :key="row.p.id"
          class="person-card"
          :class="{ selected: store.selectedPersonId === row.p.id }"
          :style="{ transform: `translateY(${row.y}px)`, height: row.h + 'px' }"
          draggable="true"
          @click="store.selectPerson(row.p.id)"
          @dragstart="onDragStart(row.p, $event)"
          @dragend="store.draggingPersonId = null"
        >
          <div class="avatar" :style="{ background: avatarGradient(row.p.gender) }">
            <img
              v-if="row.p.primary_image && imageUrl(row.p.primary_image)"
              class="avatar-img"
              :src="imageUrl(row.p.primary_image)"
              alt=""
            />
            <svg v-else class="avatar-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path :d="PERSON_ICON_PATH" transform="translate(-5.28 -2.16) scale(1.44)" />
            </svg>
          </div>
          <div class="person-info">
            <div class="person-name">{{ row.p.name }}</div>
            <div class="person-meta">
              <span v-if="row.p.birth?.year">b. {{ row.p.birth.year }}</span>
              <span v-if="row.p.birth?.year && row.p.occupation"> · </span>
              <span v-if="row.p.occupation" class="person-occ">{{ row.p.occupation }}</span>
            </div>
            <div v-if="row.p.location" class="person-location">📍 {{ row.p.location }}</div>
          </div>
          <div class="gender-dot" :style="{ background: genderColor(row.p.gender) }"></div>
        </div>
      </div>

      <div v-if="filteredPersons.length === 0" class="empty-state">
        <div class="empty-icon">👤</div>
        <div class="empty-text">No members found</div>
      </div>
    </div>

    <!-- Add Person Footer -->
    <div class="sidebar-footer">
      <button class="btn btn-primary" style="width: 100%" @click="store.openForm()">
        ＋ Add Person
      </button>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useMainStore } from '../store/index.js'
import { api } from '../api'

const store = useMainStore()
const searchQuery = ref('')

// Default human silhouette (Material "person" icon, 24×24 viewBox) — matches the graph nodes
const PERSON_ICON_PATH =
  'M12 12.5c2.49 0 4.5-2.01 4.5-4.5S14.49 3.5 12 3.5 7.5 5.51 7.5 8s2.01 4.5 4.5 4.5zm0 2.25c-3 0-9 1.51-9 4.5V22h18v-2.75c0-2.99-6-4.5-9-4.5z'

function imageUrl(filename) {
  return api.getImageUrl(filename) || ''
}

// Dragging a member onto the Factions stage assigns them to the ring they
// are dropped on. The store carries the dragged id (dataTransfer is not
// readable during dragover); a transparent drag image lets the stage draw
// its own ghost.
const BLANK_DRAG_IMG = new Image()
BLANK_DRAG_IMG.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='

function onDragStart(person, e) {
  store.draggingPersonId = person.id
  e.dataTransfer.setData('text/plain', person.id)
  e.dataTransfer.effectAllowed = 'copy'
  e.dataTransfer.setDragImage(BLANK_DRAG_IMG, 0, 0)
}

const filteredPersons = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return store.persons
  return store.persons.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.occupation || '').toLowerCase().includes(q) ||
      (p.location || '').toLowerCase().includes(q)
  )
})

// ── Virtual window (rows with a location line are taller) ───────────────────
const ROW_PLAIN = 57
const ROW_LOC = 71
const OVERSCAN = 200

const listEl = ref(null)
const scrollTop = ref(0)
const viewH = ref(600)

let scrollRaf = 0
function onScroll() {
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    scrollTop.value = listEl.value?.scrollTop || 0
  })
}

// Prefix offsets so variable row heights stay O(log n) to search.
const offsets = computed(() => {
  const list = filteredPersons.value
  const offs = new Float64Array(list.length + 1)
  for (let i = 0; i < list.length; i++) {
    offs[i + 1] = offs[i] + (list[i].location ? ROW_LOC : ROW_PLAIN)
  }
  return offs
})
const totalH = computed(() => offsets.value[filteredPersons.value.length] || 0)

const visiblePersons = computed(() => {
  const list = filteredPersons.value
  const offs = offsets.value
  const n = list.length
  const top = Math.max(0, scrollTop.value - OVERSCAN)
  const bottom = scrollTop.value + viewH.value + OVERSCAN
  let lo = 0,
    hi = n
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (offs[mid + 1] <= top) lo = mid + 1
    else hi = mid
  }
  const out = []
  for (let i = lo; i < n && offs[i] < bottom; i++) {
    out.push({ p: list[i], y: offs[i], h: (list[i].location ? ROW_LOC : ROW_PLAIN) - 3 })
  }
  return out
})

let ro = null
onMounted(() => {
  const measure = () => {
    viewH.value = listEl.value?.clientHeight || 600
  }
  measure()
  ro = new ResizeObserver(measure)
  if (listEl.value) ro.observe(listEl.value)
})
onBeforeUnmount(() => {
  if (ro) ro.disconnect()
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
})

function genderColor(gender) {
  if (gender === 'male') return '#3a7bd5'
  if (gender === 'female') return '#c95fa0'
  return '#5c6bc0'
}

function avatarGradient(gender) {
  if (gender === 'male') return 'linear-gradient(135deg, #3a7bd5, #2351a0)'
  if (gender === 'female') return 'linear-gradient(135deg, #c95fa0, #923075)'
  return 'linear-gradient(135deg, #5c6bc0, #3c4a9e)'
}
</script>

<style scoped>
.right-sidebar {
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
}

.sidebar-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--t1);
}

.search-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.search-icon {
  font-size: 12px;
  color: var(--t3);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-size: 12px;
  color: var(--t1);
  font-family: var(--font);
  padding: 0;
  box-shadow: none;
  width: auto;
}

.search-input::placeholder {
  color: var(--t3);
}

.person-list {
  flex: 1 1 0;
  overflow-y: auto;
  padding: 8px;
}

.person-list-body {
  position: relative;
}

.person-card {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.13s;
}

.person-card:hover {
  background: var(--hover);
}

.person-card.selected {
  background: var(--adim);
  outline: 1px solid rgba(108, 142, 245, 0.3);
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
  position: relative;
}

.avatar-icon {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
  fill: rgba(255, 255, 255, 0.92);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.person-info {
  flex: 1;
  min-width: 0;
}

.person-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--t1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.person-meta {
  font-size: 11px;
  color: var(--t2);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.person-occ {
  color: var(--t3);
}

.person-location {
  font-size: 10px;
  color: var(--t3);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gender-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  opacity: 0.75;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  gap: 8px;
}

.empty-icon {
  font-size: 28px;
  opacity: 0.4;
}

.empty-text {
  font-size: 12px;
  color: var(--t3);
}

.sidebar-footer {
  padding: 10px 12px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
</style>
