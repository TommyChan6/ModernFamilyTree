<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="tree-tabs-area">
        <TransitionGroup name="tab" tag="div" class="tree-tabs">
          <div
            v-for="tree in store.trees"
            :key="tree.id"
            class="tree-tab"
            :class="{ active: tree.id === store.activeTreeId }"
            @click="handleSwitchTree(tree.id)"
            @dblclick="startRenaming(tree)"
          >
            <span v-if="renamingId !== tree.id" class="tab-name">{{ tree.name }}</span>
            <input
              v-else
              ref="renameInputRef"
              v-model="renameValue"
              class="tab-rename-input"
              @keydown.enter="confirmRename"
              @keydown.escape="cancelRename"
              @blur="confirmRename"
              @click.stop
            />
            <button
              v-if="store.trees.length > 1 && renamingId !== tree.id"
              class="tab-close"
              @click.stop="handleDeleteTree(tree.id)"
              title="Close tree"
            >×</button>
          </div>
        </TransitionGroup>
        <button class="tab-add" @click="handleAddTree" title="New family tree">
          <span class="tab-add-icon">+</span>
        </button>
      </div>
      <div class="topbar-spacer"></div>
      <button class="btn btn-ghost btn-sm" @click="handleExport">Export</button>
      <button
        class="icon-btn"
        @click="store.setTheme(store.theme === 'dark' ? 'light' : 'dark')"
        :title="store.theme === 'dark' ? 'Light mode' : 'Dark mode'"
      >
        {{ store.theme === 'dark' ? '☀' : '🌙' }}
      </button>
    </header>
    <div class="workspace" :style="workspaceStyle">
      <LeftSidebar :style="{ width: leftWidth + 'px' }" @save="handleSave" />
      <div class="resize-handle resize-handle-left" @mousedown="startResizeLeft"></div>
      <GraphCanvas ref="graphRef" :key="store.activeTreeId" />
      <div class="resize-handle resize-handle-right" @mousedown="startResizeRight"></div>
      <RightSidebar :style="{ width: rightWidth + 'px' }" />
    </div>
    <PersonModal />
    <PersonForm />
    <GraphSettings />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useMainStore } from './store/index.js'
import LeftSidebar from './components/LeftSidebar.vue'
import GraphCanvas from './components/GraphCanvas.vue'
import RightSidebar from './components/RightSidebar.vue'
import PersonModal from './components/PersonModal.vue'
import PersonForm from './components/PersonForm.vue'
import GraphSettings from './components/GraphSettings.vue'

const store = useMainStore()
const graphRef = ref(null)
const renameInputRef = ref(null)
const renamingId = ref(null)
const renameValue = ref('')

async function handleSave() {
  if (graphRef.value?.saveGraphLayout) {
    await graphRef.value.saveGraphLayout()
  }
}

// ── Tree tab actions ────────────────────────────────────────────────────────
async function handleSwitchTree(id) {
  if (id === store.activeTreeId || renamingId.value) return
  // Save current graph state before switching
  if (store.graphDirty && graphRef.value?.saveGraphLayout) {
    await graphRef.value.saveGraphLayout()
  }
  await store.switchTree(id)
}

async function handleAddTree() {
  const tree = await store.createTree()
  if (tree) {
    if (store.graphDirty && graphRef.value?.saveGraphLayout) {
      await graphRef.value.saveGraphLayout()
    }
    await store.switchTree(tree.id)
  }
}

async function handleDeleteTree(id) {
  const tree = store.trees.find(t => t.id === id)
  if (!tree) return
  const confirmed = confirm(`Delete "${tree.name}"? All persons, relationships, and images in this tree will be permanently deleted.`)
  if (confirmed) {
    await store.deleteTree(id)
  }
}

function startRenaming(tree) {
  renamingId.value = tree.id
  renameValue.value = tree.name
  nextTick(() => {
    const inputs = document.querySelectorAll('.tab-rename-input')
    if (inputs.length) inputs[inputs.length - 1].focus()
  })
}

async function confirmRename() {
  if (renamingId.value && renameValue.value.trim()) {
    await store.renameTree(renamingId.value, renameValue.value.trim())
  }
  renamingId.value = null
}

function cancelRename() {
  renamingId.value = null
}

// ── Sidebar resize ──────────────────────────────────────────────────────────
const leftWidth = ref(240)
const rightWidth = ref(300)
const MIN_WIDTH = 160
const MAX_WIDTH = 500

let resizing = null
let startX = 0
let startW = 0

function startResizeLeft(e) {
  resizing = 'left'; startX = e.clientX; startW = leftWidth.value
  document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onResizeMove); window.addEventListener('mouseup', onResizeEnd)
}

function startResizeRight(e) {
  resizing = 'right'; startX = e.clientX; startW = rightWidth.value
  document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onResizeMove); window.addEventListener('mouseup', onResizeEnd)
}

function onResizeMove(e) {
  if (!resizing) return
  const dx = e.clientX - startX
  if (resizing === 'left') leftWidth.value = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW + dx))
  else rightWidth.value = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW - dx))
}

function onResizeEnd() {
  resizing = null; document.body.style.cursor = ''; document.body.style.userSelect = ''
  window.removeEventListener('mousemove', onResizeMove); window.removeEventListener('mouseup', onResizeEnd)
}

const workspaceStyle = computed(() => ({
  gridTemplateColumns: `${leftWidth.value}px 4px 1fr 4px ${rightWidth.value}px`
}))

function handleExport() {
  const data = { persons: store.persons, relationships: store.relationships, exportedAt: new Date().toISOString() }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url
  a.download = `${store.activeTree?.name || 'family-tree'}-export.json`
  a.click(); URL.revokeObjectURL(url)
}

onMounted(async () => {
  // Load global settings (theme)
  const globalRes = await window.electronAPI.invoke('globalSettings:getAll')
  if (globalRes.success && globalRes.data.theme) {
    store.setTheme(globalRes.data.theme)
  }

  // Load trees first, then data
  await store.loadTrees()
  await store.loadAll()

  window.__isGraphDirty = () => store.graphDirty
  window.__saveGraphLayout = () => handleSave()
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
  padding: 0 12px 0 0;
  gap: 8px;
  z-index: 10;
  -webkit-app-region: drag;
}

.topbar > * {
  -webkit-app-region: no-drag;
}

.tree-tabs-area {
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 0 4px;
}

.tree-tabs-area::-webkit-scrollbar {
  display: none;
}

.tree-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.tree-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px 8px 0 0;
  background: transparent;
  color: var(--t3);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  min-width: 0;
  max-width: 220px;
  position: relative;
  border: 1px solid transparent;
  border-bottom: none;
  margin-top: 6px;
  flex-shrink: 0;
}

.tree-tab:hover {
  background: var(--hover);
  color: var(--t2);
}

.tree-tab.active {
  background: var(--bg);
  color: var(--t1);
  font-weight: 600;
  border-color: var(--border);
}

.tree-tab.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--bg);
}

.tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.tab-rename-input {
  background: transparent;
  border: 1px solid var(--accent);
  border-radius: 4px;
  color: var(--t1);
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font);
  padding: 1px 4px;
  width: 140px;
  outline: none;
}

.tab-close {
  display: none;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--t3);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.12s;
  padding: 0;
}

.tree-tab:hover .tab-close {
  display: flex;
}

.tab-close:hover {
  background: rgba(239, 83, 80, 0.15);
  color: #ef5350;
}

.tab-add {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px dashed var(--border);
  background: transparent;
  color: var(--t3);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: 4px;
  transition: all 0.2s ease;
}

.tab-add:hover {
  background: var(--hover);
  color: var(--accent);
  border-color: var(--accent);
  border-style: solid;
}

.tab-add-icon {
  font-weight: 300;
  line-height: 1;
}

/* Tab transition animations */
.tab-enter-active {
  transition: all 0.3s ease;
}
.tab-leave-active {
  transition: all 0.2s ease;
}
.tab-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
  max-width: 0;
  padding: 6px 0;
}
.tab-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
  max-width: 220px;
  padding: 6px 14px;
}
.tab-leave-from {
  opacity: 1;
  transform: scale(1);
}
.tab-leave-to {
  opacity: 0;
  transform: scale(0.9);
  max-width: 0;
  padding: 6px 0;
}

.topbar-spacer {
  flex: 0;
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
