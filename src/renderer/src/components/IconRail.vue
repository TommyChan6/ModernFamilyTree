<template>
  <nav class="icon-rail">
    <button
      v-for="v in views"
      :key="v.id"
      class="rail-btn"
      :class="{ active: store.activeView === v.id }"
      :title="v.label"
      @click="store.activeView = v.id"
    >
      <span class="rail-icon">{{ v.icon }}</span>
    </button>

    <div class="rail-sep"></div>

    <button class="rail-btn" title="Add person" @click="store.openForm()">
      <span class="rail-icon">＋</span>
    </button>

    <div class="rail-spacer"></div>

    <button
      class="rail-btn"
      :class="{ active: store.settingsOpen }"
      title="Style"
      @click="store.toggleSettings()"
    >
      <span class="rail-icon">⚙</span>
    </button>
  </nav>
</template>

<script setup>
import { useMainStore } from '../store/index.js'

// The slim left icon rail: the five views + add + settings. Everything that
// used to live in the old left sidebar (stats, export/import, save, the
// Present date) now lives in the Project ▾ menu.
const store = useMainStore()

const views = [
  { id: 'graph', icon: '🕸', label: 'Graph' },
  { id: 'directory', icon: '👥', label: 'Directory' },
  { id: 'relationships', icon: '🔗', label: 'Relationships' },
  { id: 'timeline', icon: '📅', label: 'Timeline' },
  { id: 'groups', icon: '⬡', label: 'Groups' }
]
</script>

<style scoped>
.icon-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  user-select: none;
}

.rail-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--t2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.12s,
    color 0.12s;
}

.rail-btn:hover {
  background: var(--hover);
  color: var(--t1);
}

.rail-btn.active {
  background: var(--adim);
  color: var(--accent);
}

.rail-icon {
  font-size: 17px;
  line-height: 1;
}

.rail-sep {
  width: 24px;
  height: 1px;
  background: var(--border);
  margin: 6px 0;
}

.rail-spacer {
  flex: 1;
}
</style>
