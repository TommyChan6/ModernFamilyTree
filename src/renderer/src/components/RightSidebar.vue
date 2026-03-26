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
      <input
        v-model="searchQuery"
        class="search-input"
        placeholder="Filter members…"
      />
    </div>

    <!-- Person List -->
    <div class="person-list">
      <div
        v-for="person in filteredPersons"
        :key="person.id"
        class="person-card"
        :class="{ selected: store.selectedPersonId === person.id }"
        @click="store.selectPerson(person.id)"
      >
        <div
          class="avatar"
          :style="{ background: avatarGradient(person.gender) }"
        >
          {{ initials(person.name) }}
        </div>
        <div class="person-info">
          <div class="person-name">{{ person.name }}</div>
          <div class="person-meta">
            <span v-if="person.birth_year">b. {{ person.birth_year }}</span>
            <span v-if="person.birth_year && person.occupation"> · </span>
            <span v-if="person.occupation" class="person-occ">{{ person.occupation }}</span>
          </div>
          <div v-if="person.location" class="person-location">📍 {{ person.location }}</div>
        </div>
        <div
          class="gender-dot"
          :style="{ background: genderColor(person.gender) }"
        ></div>
      </div>

      <div v-if="filteredPersons.length === 0" class="empty-state">
        <div class="empty-icon">👤</div>
        <div class="empty-text">No members found</div>
      </div>
    </div>

    <!-- Add Person Footer -->
    <div class="sidebar-footer">
      <button class="btn btn-primary" style="width:100%;" @click="store.openForm()">
        ＋ Add Person
      </button>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useMainStore } from '../store/index.js'

const store = useMainStore()
const searchQuery = ref('')

const filteredPersons = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return store.persons
  return store.persons.filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.occupation || '').toLowerCase().includes(q) ||
    (p.location || '').toLowerCase().includes(q)
  )
})

function initials(name) {
  const parts = (name || '').trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

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

.person-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.13s;
  margin-bottom: 3px;
  position: relative;
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
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
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
