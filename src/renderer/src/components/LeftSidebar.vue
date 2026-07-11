<template>
  <aside class="left-sidebar">
    <!-- Navigation -->
    <nav class="sidebar-nav">
      <div class="nav-section-label">Navigation</div>
      <button
        class="nav-item"
        :class="{ active: store.activeView === 'tree' }"
        @click="store.activeView = 'tree'"
      >
        <span class="nav-icon">🌳</span>
        <span>Tree View</span>
      </button>
      <button
        class="nav-item"
        :class="{ active: store.activeView === 'people' }"
        @click="store.activeView = 'people'"
      >
        <span class="nav-icon">👥</span>
        <span>All People</span>
        <span class="badge" style="margin-left: auto">{{ store.personCount }}</span>
      </button>
      <button
        class="nav-item"
        :class="{ active: store.activeView === 'relationships' }"
        @click="store.activeView = 'relationships'"
      >
        <span class="nav-icon">🔗</span>
        <span>Relationships</span>
        <span class="badge" style="margin-left: auto">{{ store.relationships.length }}</span>
      </button>
      <button
        class="nav-item"
        :class="{ active: store.activeView === 'timeline' }"
        @click="store.activeView = 'timeline'"
      >
        <span class="nav-icon">📅</span>
        <span>Timeline</span>
      </button>
      <button
        class="nav-item"
        :class="{ active: store.activeView === 'factions' }"
        @click="store.activeView = 'factions'"
      >
        <span class="nav-icon">⬡</span>
        <span>Factions</span>
        <span v-if="store.activeGroups.length" class="badge" style="margin-left: auto">{{
          store.activeGroups.length
        }}</span>
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
      <button
        class="nav-item save-btn"
        :class="{ 'save-dirty': store.hasUnsavedChanges }"
        title="Commit a checkpoint you can revert to (⌘S / Ctrl+S) — edits autosave regardless"
        @click="$emit('save')"
      >
        <span class="nav-icon">💾</span>
        <span>Save</span>
        <span v-if="store.hasUnsavedChanges" class="save-badge">unsaved</span>
      </button>
      <button
        class="nav-item"
        :disabled="!store.hasUnsavedChanges"
        title="Restore the arrangement saved by the last checkpoint"
        @click="$emit('revert')"
      >
        <span class="nav-icon">↩</span>
        <span>Revert to saved</span>
      </button>
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

    <div class="sidebar-divider"></div>

    <div class="sidebar-section">
      <div class="nav-section-label">Current Date</div>
      <div class="date-row">
        <input
          type="number"
          class="sidebar-date-input"
          :value="store.currentDate?.year || ''"
          placeholder="Enter year…"
          min="1"
          max="2200"
          @change="setCurrentDate($event.target.value)"
        />
        <button
          v-if="store.userCurrentYear"
          class="date-clear-btn"
          title="Reset to latest year in data"
          @click="setCurrentDate('')"
        >
          ✕
        </button>
      </div>
      <div v-if="!store.userCurrentYear && store.currentDate" class="date-hint">
        Auto · latest year in data
      </div>
      <div v-else-if="!store.currentDate" class="date-hint">No dates yet</div>
    </div>

    <div class="sidebar-divider"></div>

    <div class="sidebar-section">
      <div class="nav-section-label">View</div>
      <button
        class="nav-item"
        :class="{ active: store.cleanTree }"
        @click="store.cleanTree = !store.cleanTree"
      >
        <span class="nav-icon">{{ store.cleanTree ? '👁' : '✨' }}</span>
        <span>Clean Tree</span>
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
import { computed } from 'vue'
import { useMainStore } from '../store/index.js'

defineEmits(['save', 'revert'])

const store = useMainStore()

function setCurrentDate(val) {
  store.setCurrentYear(val)
}

const generationCount = computed(() => {
  // Simple heuristic: number of distinct birth decade groups
  const years = store.persons.filter((p) => p.birth?.year).map((p) => Math.floor(p.birth.year / 20))
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
  a.download = 'project-export.json'
  a.click()
  URL.revokeObjectURL(url)
}

function handleImport() {
  alert('Import feature: drop a JSON file exported from this app to restore your project data.')
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
  transition:
    background 0.12s,
    color 0.12s;
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

.save-btn {
  position: relative;
}

.save-dirty {
  color: var(--accent) !important;
}

.save-badge {
  margin-left: auto;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #f5a623;
  background: rgba(245, 166, 35, 0.12);
  padding: 2px 6px;
  border-radius: 6px;
  animation: pulse-badge 2s ease-in-out infinite;
}

@keyframes pulse-badge {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.date-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 16px 8px;
}

.sidebar-date-input {
  flex: 1;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 500;
  outline: none;
  width: 100%;
  min-width: 0;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.sidebar-date-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(108, 142, 245, 0.15);
}

.sidebar-date-input::placeholder {
  color: var(--t3);
}

.date-clear-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--t3);
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition:
    background 0.12s,
    color 0.12s;
}

.date-clear-btn:hover {
  background: rgba(239, 83, 80, 0.12);
  color: #ef5350;
}

.date-hint {
  padding: 0 16px 4px;
  font-size: 10px;
  color: var(--t3);
}
</style>
