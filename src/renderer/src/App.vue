<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="logo">🌳 Family<span>Tree</span></div>
      <button class="btn btn-ghost btn-sm" @click="store.openForm()">＋ Add Person</button>
      <div class="topbar-spacer"></div>
      <button class="btn btn-ghost btn-sm" @click="handleExport">⬆ Export</button>
      <button
        class="icon-btn"
        @click="store.setTheme(store.theme === 'dark' ? 'light' : 'dark')"
        :title="store.theme === 'dark' ? 'Light mode' : 'Dark mode'"
      >
        {{ store.theme === 'dark' ? '☀' : '🌙' }}
      </button>
    </header>
    <div class="workspace" :style="workspaceStyle">
      <LeftSidebar :style="{ width: leftWidth + 'px' }" />
      <div
        class="resize-handle resize-handle-left"
        @mousedown="startResizeLeft"
      ></div>
      <GraphCanvas />
      <div
        class="resize-handle resize-handle-right"
        @mousedown="startResizeRight"
      ></div>
      <RightSidebar :style="{ width: rightWidth + 'px' }" />
    </div>
    <PersonModal />
    <PersonForm />
    <GraphSettings />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMainStore } from './store/index.js'
import LeftSidebar from './components/LeftSidebar.vue'
import GraphCanvas from './components/GraphCanvas.vue'
import RightSidebar from './components/RightSidebar.vue'
import PersonModal from './components/PersonModal.vue'
import PersonForm from './components/PersonForm.vue'
import GraphSettings from './components/GraphSettings.vue'

const store = useMainStore()

// Sidebar widths
const leftWidth = ref(240)
const rightWidth = ref(300)
const MIN_WIDTH = 160
const MAX_WIDTH = 500

let resizing = null // 'left' | 'right' | null
let startX = 0
let startW = 0

function startResizeLeft(e) {
  resizing = 'left'
  startX = e.clientX
  startW = leftWidth.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', onResizeEnd)
}

function startResizeRight(e) {
  resizing = 'right'
  startX = e.clientX
  startW = rightWidth.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', onResizeEnd)
}

function onResizeMove(e) {
  if (!resizing) return
  const dx = e.clientX - startX
  if (resizing === 'left') {
    leftWidth.value = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW + dx))
  } else {
    rightWidth.value = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW - dx))
  }
}

function onResizeEnd() {
  resizing = null
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
}

const workspaceStyle = computed(() => ({
  gridTemplateColumns: `${leftWidth.value}px 4px 1fr 4px ${rightWidth.value}px`
}))

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

onMounted(async () => {
  const settingsRes = await window.electronAPI.invoke('settings:getAll')
  if (settingsRes.success && settingsRes.data.theme) {
    store.setTheme(settingsRes.data.theme)
  }
  await store.loadAll()
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
})
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.topbar {
  flex: 0 0 48px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 10px;
  z-index: 10;
}

.logo {
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.4px;
  color: var(--accent);
}

.logo span {
  color: var(--t1);
}

.topbar-spacer {
  flex: 1;
}

.workspace {
  flex: 1 1 0;
  display: grid;
  grid-template-columns: 240px 4px 1fr 4px 300px;
  min-height: 0;
}

.resize-handle {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  position: relative;
  z-index: 5;
  transition: background 0.15s;
}

.resize-handle::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -2px;
  right: -2px;
}

.resize-handle:hover,
.resize-handle:active {
  background: var(--accent);
  opacity: 0.4;
}
</style>
