<template>
  <aside class="left-sidebar">
    <!-- Navigation -->
    <nav class="sidebar-nav">
      <div class="nav-section-label">Navigation</div>
      <button
        class="nav-item"
        :class="{ active: activeView === 'tree' }"
        @click="activeView = 'tree'"
      >
        <span class="nav-icon">🌳</span>
        <span>Tree View</span>
      </button>
      <button
        class="nav-item"
        :class="{ active: activeView === 'people' }"
        @click="activeView = 'people'"
      >
        <span class="nav-icon">👥</span>
        <span>All People</span>
        <span class="badge" style="margin-left: auto;">{{ store.personCount }}</span>
      </button>
      <button
        class="nav-item"
        :class="{ active: activeView === 'relationships' }"
        @click="activeView = 'relationships'"
      >
        <span class="nav-icon">🔗</span>
        <span>Relationships</span>
      </button>
      <button
        class="nav-item"
        :class="{ active: activeView === 'timeline' }"
        @click="activeView = 'timeline'"
      >
        <span class="nav-icon">📅</span>
        <span>Timeline</span>
      </button>
    </nav>

    <div class="sidebar-divider"></div>

    <!-- Appearance -->
    <div class="sidebar-section">
      <div class="nav-section-label">Appearance</div>
      <div class="theme-pills">
        <button
          class="theme-pill"
          :class="{ active: store.theme === 'dark' }"
          @click="store.setTheme('dark')"
        >
          🌙 Dark
        </button>
        <button
          class="theme-pill"
          :class="{ active: store.theme === 'light' }"
          @click="store.setTheme('light')"
        >
          ☀ Light
        </button>
      </div>
    </div>

    <div class="sidebar-divider"></div>

    <!-- Statistics -->
    <div class="sidebar-section">
      <div class="nav-section-label">Statistics</div>
      <div class="stat-row">
        <span class="stat-label">Family Members</span>
        <span class="stat-value">{{ store.personCount }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Relationships</span>
        <span class="stat-value">{{ store.relationships.length }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Couples</span>
        <span class="stat-value">{{ store.coupleCount }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Generations</span>
        <span class="stat-value">{{ generationCount }}</span>
      </div>
    </div>

    <div class="sidebar-divider"></div>

    <!-- Data -->
    <div class="sidebar-section">
      <div class="nav-section-label">Data</div>
      <button class="nav-item" @click="handleExport">
        <span class="nav-icon">⬆</span>
        <span>Export JSON</span>
      </button>
      <button class="nav-item" @click="handleImport">
        <span class="nav-icon">⬇</span>
        <span>Import JSON</span>
      </button>
    </div>

    <div class="sidebar-divider"></div>

    <div class="sidebar-section">
      <button
        class="nav-item"
        :class="{ active: store.settingsOpen }"
        @click="store.toggleSettings()"
      >
        <span class="nav-icon">⚙</span>
        <span>Graph Settings</span>
      </button>
    </div>

    <div class="sidebar-spacer"></div>

    <!-- Footer -->
    <div class="sidebar-footer">
      <div class="footer-text">FamilyTree v1.0.0</div>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useMainStore } from '../store/index.js'

const store = useMainStore()
const activeView = ref('tree')

const generationCount = computed(() => {
  // Simple heuristic: number of distinct birth decade groups
  const years = store.persons
    .filter(p => p.birth_year)
    .map(p => Math.floor(p.birth_year / 20))
  return new Set(years).size || 0
})

function handleExport() {
  const data = {
    persons: store.persons,
    relationships: store.relationships,
    exportedAt: new Date().toISOString()
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'family-tree-export.json'
  a.click()
  URL.revokeObjectURL(url)
}

function handleImport() {
  alert('Import feature: drop a JSON file exported from this app to restore your family tree data.')
}
</script>

<style scoped>
.left-sidebar {
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 0;
  user-select: none;
}

.nav-section-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--t3);
  padding: 4px 16px 6px;
}

.sidebar-nav {
  padding: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: var(--t2);
  font-size: 13px;
  font-family: var(--font);
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  text-align: left;
  border-radius: 0;
}

.nav-item:hover {
  background: var(--hover);
  color: var(--t1);
}

.nav-item.active {
  background: var(--adim);
  color: var(--accent);
}

.nav-icon {
  font-size: 15px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.sidebar-divider {
  height: 1px;
  background: var(--border);
  margin: 10px 0;
}

.sidebar-section {
  padding: 4px 0;
}

.theme-pills {
  display: flex;
  gap: 6px;
  padding: 4px 16px 8px;
}

.theme-pill {
  flex: 1;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t2);
  font-size: 12px;
  font-family: var(--font);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.13s;
  text-align: center;
}

.theme-pill:hover {
  background: var(--hover);
  color: var(--t1);
}

.theme-pill.active {
  background: var(--adim);
  color: var(--accent);
  border-color: rgba(108, 142, 245, 0.3);
}

.stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 16px;
}

.stat-label {
  color: var(--t2);
  font-size: 12px;
}

.stat-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent);
}

.sidebar-spacer {
  flex: 1;
}

.sidebar-footer {
  padding: 10px 16px;
  border-top: 1px solid var(--border);
}

.footer-text {
  font-size: 11px;
  color: var(--t3);
  text-align: center;
}
</style>
