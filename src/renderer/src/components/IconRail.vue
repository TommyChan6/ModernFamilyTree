<template>
  <nav class="icon-rail">
    <button
      v-for="v in visibleViews"
      :key="v.id"
      class="rail-btn"
      :class="{ active: store.activeView === v.id }"
      :title="t('rail.' + v.id)"
      @click="store.activeView = v.id"
    >
      <span class="rail-icon">{{ v.icon }}</span>
    </button>

    <div class="rail-sep"></div>

    <button class="rail-btn" :title="t('rail.addPerson')" @click="store.openForm()">
      <span class="rail-icon">＋</span>
    </button>

    <div class="rail-spacer"></div>

    <button
      v-if="store.caps.style !== 'none'"
      class="rail-btn"
      :class="{ active: store.settingsOpen }"
      :title="t('rail.style')"
      @click="store.toggleSettings()"
    >
      <span class="rail-icon">⚙</span>
    </button>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useMainStore } from '../store/index.js'
import { useI18n } from '../i18n'

// The slim left icon rail: the five views + add + settings. Everything that
// used to live in the old left sidebar (stats, export/import, save, the
// Present date) now lives in the Project ▾ menu.
const store = useMainStore()
const { t } = useI18n()

const views = [
  { id: 'graph', icon: '🕸' },
  { id: 'directory', icon: '👥' },
  { id: 'relationships', icon: '🔗' },
  { id: 'timeline', icon: '📅' },
  { id: 'groups', icon: '⬡' }
]
// Program-mode gating: Simple shows Graph + Directory only
const visibleViews = computed(() => views.filter((v) => store.caps.views.includes(v.id)))
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
