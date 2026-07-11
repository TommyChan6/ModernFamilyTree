<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="project-tabs-area">
        <TransitionGroup name="tab" tag="div" class="project-tabs">
          <div
            v-for="project in store.projects"
            :key="project.id"
            class="project-tab"
            :class="{ active: project.id === store.activeProjectId }"
            @click="handleSwitchProject(project.id)"
            @dblclick="startRenaming(project)"
          >
            <span v-if="renamingId !== project.id" class="tab-name">{{ project.name }}</span>
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
              v-if="store.projects.length > 1 && renamingId !== project.id"
              class="tab-close"
              title="Close project"
              @click.stop="handleDeleteProject(project.id)"
            >
              ×
            </button>
          </div>
        </TransitionGroup>
        <button class="tab-add" title="New project" @click="handleAddProject">
          <span class="tab-add-icon">+</span>
        </button>
      </div>
      <div class="topbar-spacer"></div>
      <button class="btn btn-ghost btn-sm" @click="handleExport">Export</button>
      <button
        class="icon-btn"
        :title="store.theme === 'dark' ? 'Light mode' : 'Dark mode'"
        @click="store.setTheme(store.theme === 'dark' ? 'light' : 'dark')"
      >
        {{ store.theme === 'dark' ? '☀' : '🌙' }}
      </button>
    </header>
    <div class="workspace" :style="workspaceStyle">
      <LeftSidebar :style="{ width: leftWidth + 'px' }" @save="handleSave" />
      <div class="resize-handle resize-handle-left" @mousedown="startResizeLeft"></div>
      <div class="canvas-stack">
        <!-- Graph stays mounted (tucked away) so its layout & simulation state persist -->
        <div v-show="store.activeView === 'tree'" class="canvas-layer">
          <GraphCanvas ref="graphRef" :key="store.activeProjectId" />
        </div>
        <Transition name="people-view">
          <PeopleView v-if="store.activeView === 'people'" :key="store.activeProjectId" />
        </Transition>
        <Transition name="people-view">
          <RelationshipsView
            v-if="store.activeView === 'relationships'"
            :key="store.activeProjectId"
          />
        </Transition>
        <!-- WebGL views stay mounted (toggled with v-show) so their GL context is
             never torn down mid-switch — tearing it down flashes the window white.
             The Transition still animates the show/hide. -->
        <Transition name="people-view">
          <TimelineView
            v-show="store.activeView === 'timeline'"
            :key="store.activeProjectId"
            :active="store.activeView === 'timeline'"
          />
        </Transition>
        <Transition name="people-view">
          <FactionsView
            v-show="store.activeView === 'factions'"
            :key="store.activeProjectId"
            :active="store.activeView === 'factions'"
          />
        </Transition>
      </div>
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
import { api } from './api'
import LeftSidebar from './components/LeftSidebar.vue'
import GraphCanvas from './components/GraphCanvas.vue'
import PeopleView from './components/PeopleView.vue'
import RelationshipsView from './components/RelationshipsView.vue'
import TimelineView from './components/TimelineView.vue'
import FactionsView from './components/FactionsView.vue'
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

// ── Project tab actions ─────────────────────────────────────────────────────
async function handleSwitchProject(id) {
  if (id === store.activeProjectId || renamingId.value) return
  // Save current graph state before switching
  if (store.graphDirty && graphRef.value?.saveGraphLayout) {
    await graphRef.value.saveGraphLayout()
  }
  await store.switchProject(id)
}

async function handleAddProject() {
  const project = await store.createProject()
  if (project) {
    if (store.graphDirty && graphRef.value?.saveGraphLayout) {
      await graphRef.value.saveGraphLayout()
    }
    await store.switchProject(project.id)
  }
}

async function handleDeleteProject(id) {
  const project = store.projects.find((p) => p.id === id)
  if (!project) return
  const confirmed = confirm(
    `Delete "${project.name}"? All persons, relationships, and images in this project will be permanently deleted.`
  )
  if (confirmed) {
    await store.deleteProject(id)
  }
}

function startRenaming(project) {
  renamingId.value = project.id
  renameValue.value = project.name
  nextTick(() => {
    const inputs = document.querySelectorAll('.tab-rename-input')
    if (inputs.length) inputs[inputs.length - 1].focus()
  })
}

async function confirmRename() {
  if (renamingId.value && renameValue.value.trim()) {
    await store.renameProject(renamingId.value, renameValue.value.trim())
  }
  renamingId.value = null
}

function cancelRename() {
  renamingId.value = null
}

// ── Sidebar resize ──────────────────────────────────────────────────────────
const leftWidth = ref(240)
const rightWidth = ref(250)
const MIN_WIDTH = 160
const MAX_WIDTH = 500

let resizing = null
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
  if (resizing === 'left') leftWidth.value = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW + dx))
  else rightWidth.value = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW - dx))
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
  a.download = `${store.activeProject?.name || 'project'}-export.json`
  a.click()
  URL.revokeObjectURL(url)
}

// In the browser there is no main-process close dialog, so warn about unsaved
// layout changes via beforeunload instead. Skipped in Electron, where the
// main process runs its own Save/Discard/Cancel dialog on close.
function onBeforeUnload(e) {
  if (store.graphDirty) e.preventDefault()
}

onMounted(async () => {
  // Load global settings (theme)
  const globalRes = await api.invoke('globalSettings:getAll')
  if (globalRes.success && globalRes.data.theme) {
    store.setTheme(globalRes.data.theme)
  }

  // Load projects first, then data
  await store.loadProjects()
  await store.loadAll()

  window.__isGraphDirty = () => store.graphDirty
  window.__saveGraphLayout = () => handleSave()
  if (!window.electronAPI) window.addEventListener('beforeunload', onBeforeUnload)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
  window.removeEventListener('beforeunload', onBeforeUnload)
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

.project-tabs-area {
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

.project-tabs-area::-webkit-scrollbar {
  display: none;
}

.project-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.project-tab {
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

.project-tab:hover {
  background: var(--hover);
  color: var(--t2);
}

.project-tab.active {
  background: var(--bg);
  color: var(--t1);
  font-weight: 600;
  border-color: var(--border);
}

.project-tab.active::after {
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

.project-tab:hover .tab-close {
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
  grid-template-columns: 240px 4px 1fr 4px 250px;
  min-height: 0;
}

/* Center cell that holds both the graph and the People view */
.canvas-stack {
  position: relative;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

/* Graph layer fills the cell; grid display lets .graph-area stretch to full height */
.canvas-layer {
  position: absolute;
  inset: 0;
  display: grid;
}

/* People view cross-fade / rise */
.people-view-enter-active {
  transition:
    opacity 0.32s ease,
    transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}
.people-view-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  position: absolute;
  inset: 0;
}
.people-view-enter-from {
  opacity: 0;
  transform: translateY(14px) scale(0.99);
}
.people-view-leave-to {
  opacity: 0;
  transform: scale(0.99);
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
