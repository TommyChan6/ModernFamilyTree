<template>
  <div class="app-shell">
    <header class="topbar">
      <button
        class="home-btn"
        :title="t('app.homepage')"
        :aria-label="t('app.homepage')"
        @click="homeOpen = true"
      >
        <UiIcon class="home-btn-mark" name="tree-deciduous" :size="18" />
      </button>
      <div class="project-btn-area">
        <button class="projects-btn" :title="t('topbar.projectsHint')" @click="openProjectsPage">
          <span class="projects-btn-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor">
              <circle cx="3.2" cy="12.2" r="1.6" />
              <circle cx="8" cy="3.6" r="1.6" />
              <circle cx="12.8" cy="10.4" r="1.6" />
              <path
                d="M3.2 12.2 8 3.6l4.8 6.8"
                fill="none"
                stroke="currentColor"
                stroke-width="1.1"
                opacity="0.55"
              />
            </svg>
          </span>
          <span class="projects-btn-label">{{ t('topbar.projects') }}</span>
          <span class="projects-btn-count">{{ store.projects.length }}</span>
          <span class="projects-btn-divider"></span>
          <span class="projects-btn-live-dot"></span>
          <span class="projects-btn-current">{{
            defaultNameLabel(store.activeProject?.name)
          }}</span>
          <UiIcon class="projects-btn-chevron" name="chevron-right" :size="14" />
        </button>
        <button class="browse-btn" :title="t('browse.buttonHint')" @click="openBrowsePage">
          <span class="browse-btn-compass" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <circle
                cx="12"
                cy="12"
                r="9.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
              />
              <g class="browse-btn-needle">
                <path d="M12 5.2 14.2 12h-4.4z" fill="currentColor" />
                <path d="M12 18.8 9.8 12h4.4z" fill="currentColor" opacity="0.4" />
              </g>
            </svg>
          </span>
          <span class="browse-btn-label">{{ t('browse.button') }}</span>
        </button>
      </div>
      <ProjectMenu
        @save="handleSave"
        @revert="handleRevert"
        @export="handleExport"
        @import="handleImport"
      />
      <div class="history-ctrl">
        <button
          class="history-btn"
          :class="{ 'kick-undo': undoKick }"
          :disabled="historyBusy || !store.historyStatus.canUndo"
          :title="t('topbar.undo') + ' (Ctrl+Z)'"
          @click="doUndo"
          @animationend="undoKick = false"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
          </svg>
        </button>
        <button
          class="history-btn"
          :class="{ 'kick-redo': redoKick }"
          :disabled="historyBusy || !store.historyStatus.canRedo"
          :title="t('topbar.redo') + ' (Ctrl+X)'"
          @click="doRedo"
          @animationend="redoKick = false"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m15 14 5-5-5-5" />
            <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
          </svg>
        </button>
        <Transition name="history-toast">
          <div v-if="historyToast" :key="historyToast.key" class="history-toast">
            <UiIcon
              class="history-toast-glyph"
              :name="historyToast.verb === 'undid' ? 'undo-2' : 'redo-2'"
              :size="14"
            />
            {{ historyToast.text }}
          </div>
        </Transition>
      </div>
      <div class="topbar-spacer"></div>
      <button
        class="btn btn-outline topbar-search"
        :title="t('topbar.search') + ` (${MOD}+K)`"
        @click="openPalette"
      >
        <UiIcon name="search" :size="16" />
        <span class="topbar-search-label">{{ t('topbar.search') }}</span>
        <kbd>{{ MOD === '⌘' ? '⌘K' : 'Ctrl K' }}</kbd>
      </button>
      <button class="btn btn-ghost" :title="t('topbar.exportImage')" @click="exportOpen = true">
        <UiIcon name="image" :size="16" />
        {{ t('topbar.export') }}
      </button>
      <label class="mode-picker-wrap" :title="t('topbar.modeHint')">
        <span class="mode-picker-label">{{ t('topbar.mode') }}</span>
        <select
          class="mode-picker"
          :value="store.programMode"
          @change="store.setProgramMode($event.target.value)"
        >
          <option value="simple">{{ t('mode.simple') }}</option>
          <option value="standard">{{ t('mode.standard') }}</option>
          <option value="advanced" :disabled="store.isGuest">
            {{ t('mode.advanced') }}
          </option>
        </select>
      </label>
      <Transition name="labs">
        <button
          v-if="store.caps.labs"
          class="labs-btn"
          :class="{ 'labs-on': store.labsEnabled }"
          :title="store.labsEnabled ? t('topbar.labsOn') : t('topbar.labsOff')"
          @click="store.setLabsEnabled(!store.labsEnabled)"
        >
          <UiIcon class="labs-flask" name="labs" :size="16" />
          <span class="labs-label">{{ t('topbar.labs') }}</span>
        </button>
      </Transition>
      <!-- 墨: the ink-painting theme, toggled by stamping a seal -->
      <button
        class="icon-btn ink-toggle"
        :class="{ on: store.isInk }"
        :title="store.isInk ? t('topbar.inkOff') : t('topbar.inkOn')"
        :aria-label="store.isInk ? t('topbar.inkOff') : t('topbar.inkOn')"
        :aria-pressed="store.isInk"
        @click="toggleInk"
      >
        <span class="ink-toggle-seal" aria-hidden="true">墨</span>
      </button>
      <!-- the illuminated medieval theme, toggled by raising a shield -->
      <button
        class="icon-btn med-toggle"
        :class="{ on: store.isMedieval }"
        :title="store.isMedieval ? t('topbar.medievalOff') : t('topbar.medievalOn')"
        :aria-label="store.isMedieval ? t('topbar.medievalOff') : t('topbar.medievalOn')"
        :aria-pressed="store.isMedieval"
        @click="toggleMedieval"
      >
        <span class="med-toggle-shield" aria-hidden="true">
          <UiIcon name="castle" :size="11" :stroke="2.2" />
        </span>
      </button>
      <button
        class="icon-btn theme-toggle"
        :class="store.isLightTheme ? 'light' : 'dark'"
        :title="store.isLightTheme ? t('topbar.darkMode') : t('topbar.lightMode')"
        :aria-label="store.isLightTheme ? t('topbar.darkMode') : t('topbar.lightMode')"
        @click="toggleTheme"
      >
        <!-- One glyph that morphs: the moon's bite slides away and the rays
             spin in as the sun rises (and back). -->
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
          <mask id="tt-moon-mask">
            <rect x="0" y="0" width="24" height="24" fill="#fff" />
            <circle class="tt-bite" cx="17" cy="7" r="6" fill="#000" />
          </mask>
          <circle class="tt-core" cx="12" cy="12" r="5" mask="url(#tt-moon-mask)" />
          <g class="tt-rays">
            <path
              d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"
            />
          </g>
        </svg>
      </button>
      <button
        class="icon-btn settings-btn"
        :title="t('topbar.settingsHint')"
        :aria-label="t('topbar.settings')"
        @click="store.toggleAppSettings()"
      >
        <UiIcon name="settings" :size="16" />
      </button>
      <!-- Upgrade nudge for free accounts (guests register first) -->
      <button
        v-if="store.authUser && !store.isPaid && !store.isGuest"
        class="upgrade-pill"
        :title="t('billing.upgradeHint')"
        @click="store.openPricing({ reason: 'menu' })"
      >
        <UiIcon class="upgrade-pill-spark" name="sparkles" :size="14" />
        <span class="upgrade-pill-label">{{ t('billing.upgradeShort') }}</span>
      </button>
      <AccountMenu v-if="store.authUser" />
    </header>
    <div class="workspace" :style="workspaceStyle">
      <IconRail />
      <div ref="canvasStackRef" class="canvas-stack">
        <!-- Graph stays mounted (tucked away) so its layout & simulation state persist -->
        <Transition name="people-view">
          <div v-show="store.activeView === 'graph'" class="canvas-layer">
            <GraphCanvas ref="graphRef" :key="store.activeProjectId" />
          </div>
        </Transition>
        <Transition name="people-view">
          <PeopleView v-if="store.activeView === 'directory'" :key="store.activeProjectId" />
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
            ref="timelineRef"
            :key="store.activeProjectId"
            :active="store.activeView === 'timeline'"
          />
        </Transition>
        <Transition name="people-view">
          <FactionsView
            v-show="store.activeView === 'groups'"
            ref="factionsRef"
            :key="store.activeProjectId"
            :active="store.activeView === 'groups'"
          />
        </Transition>
        <!-- Map view — Canvas-2D, cheap to recreate, so plain v-if; the map's
             camera + year are saved on the MapDoc so nothing is lost. -->
        <Transition name="people-view">
          <MapView v-if="store.activeView === 'map'" :key="store.activeProjectId" />
        </Transition>
        <!-- Experimental Character view (Advanced + Labs). Canvas-2D — cheap to
             recreate, so plain v-if; edits live in the DB, not the component. -->
        <Transition name="people-view">
          <CharacterView
            v-if="store.activeView === 'character' && store.caps.character"
            :key="store.activeProjectId"
          />
        </Transition>
        <!-- Time Travel slider (graph + timeline views; decides its own visibility) -->
        <TimeSlider />
        <!-- Style Studio: the whole-app layer + the current view's own style -->
        <StyleStudio />
      </div>
      <div
        v-if="!dockCollapsed"
        class="resize-handle resize-handle-right"
        @mousedown="startResizeRight"
      ></div>
      <RightDock
        :collapsed="dockCollapsed"
        :style="{ width: dockCollapsed ? '28px' : rightWidth + 'px' }"
        @toggle-collapse="dockCollapsed = !dockCollapsed"
      />
    </div>
    <PersonModal />
    <PersonForm />
    <CommandPalette ref="paletteRef" />
    <ExportModal :open="exportOpen" :capture="captureViewImage" @close="exportOpen = false" />
    <SettingsModal />
    <UserPage />
    <ProjectsPage />
    <BrowsePage />
    <PricingModal />
    <FingerprintDialog />
    <!-- Project file import (Project ▾ → Import project file) -->
    <input
      ref="importInput"
      type="file"
      accept=".json,application/json"
      class="visually-hidden"
      tabindex="-1"
      aria-hidden="true"
      @change="onImportFile"
    />
    <!-- In-app confirm dialogs + toasts (lib/dialogs.js) -->
    <ChronicleEditor />
    <DialogHost />
    <!-- Landing page: what signed-out visitors meet first (marketing + mock
         community gallery); its CTAs hand off to whichever sign-in gate the
         build uses (native or Supabase). Signed-in users can revisit it via
         the topbar home button (its nav then shows the account chip and
         "Open editor" instead of sign-in CTAs). -->
    <Transition name="auth-gate">
      <HomePage
        v-if="store.authReady && (store.authUser ? homeOpen : !authOpen)"
        @signin="openAuth('login')"
        @register="openAuth('register')"
        @close="homeOpen = false"
      />
    </Transition>
    <!-- Native sign-in gate (desktop / local build) -->
    <Transition name="auth-gate">
      <AuthGate
        v-if="!store.usingSupabase && store.authReady && !store.authUser && authOpen"
        :initial-mode="authMode"
        @back="authOpen = false"
      />
    </Transition>
    <!-- Supabase sign-in gate (hosted build): same flow as the native gate —
         the homepage's CTAs open it; Back returns to the homepage. -->
    <Transition name="auth-gate">
      <SupabaseAuthGate
        v-if="store.usingSupabase && store.authReady && !store.session && authOpen"
        :initial-mode="authMode"
        @back="authOpen = false"
      />
    </Transition>
    <!-- Cinematic loading curtain: sign in/out, project switch, open profile -->
    <Transition name="curtain">
      <TransitionCurtain
        v-if="store.curtain.active"
        :kind="store.curtain.kind"
        :label="store.curtain.label"
        :sub="store.curtain.sub"
      />
    </Transition>
  </div>
</template>

<script setup>
import { defaultNameLabel } from './lib/dataLabels'
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useMainStore } from './store/index.js'
import { useI18n } from './i18n'
import { api, onPlanLimit } from './api'
import IconRail from './components/IconRail.vue'
import ProjectMenu from './components/ProjectMenu.vue'
import CommandPalette from './components/CommandPalette.vue'
import GraphCanvas from './components/GraphCanvas.vue'
import PeopleView from './components/PeopleView.vue'
import RelationshipsView from './components/RelationshipsView.vue'
import TimelineView from './components/TimelineView.vue'
import FactionsView from './components/FactionsView.vue'
import MapView from './components/MapView.vue'
// Lazy-loaded through the paid-features gate (chunk downloads on first open,
// only when the plan/caps switchboard allows it) — see src/renderer/src/paid/.
import { CharacterView } from './paid'
import RightDock from './components/RightDock.vue'
import PersonModal from './components/PersonModal.vue'
import PersonForm from './components/PersonForm.vue'
import StyleStudio from './components/style/StyleStudio.vue'
import AuthGate from './components/AuthGate.vue'
import SupabaseAuthGate from './components/SupabaseAuthGate.vue'
import HomePage from './components/home/HomePage.vue'
import AccountMenu from './components/AccountMenu.vue'
import ExportModal from './components/ExportModal.vue'
import SettingsModal from './components/SettingsModal.vue'
import UserPage from './components/UserPage.vue'
import ProjectsPage from './components/ProjectsPage.vue'
import BrowsePage from './components/BrowsePage.vue'
import PricingModal from './components/billing/PricingModal.vue'
import FingerprintDialog from './components/fingerprint/FingerprintDialog.vue'
import TransitionCurtain from './components/TransitionCurtain.vue'
import TimeSlider from './components/time/TimeSlider.vue'
import DialogHost from './components/ui/DialogHost.vue'
import ChronicleEditor from './components/chronicle/ChronicleEditor.vue'
import UiIcon from './components/ui/UiIcon.js'
import { confirmDialog, toast } from './lib/dialogs.js'
import { recentPointer } from './lib/themeReveal.js'

const store = useMainStore()
const { t } = useI18n()
const graphRef = ref(null)
const timelineRef = ref(null)
const factionsRef = ref(null)
const exportOpen = ref(false)
const paletteRef = ref(null)
const dockCollapsed = ref(false)
const canvasStackRef = ref(null)
const importInput = ref(null)

// Key-hint glyph for the platform: ⌘ on Apple devices, Ctrl elsewhere.
const MOD = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl'

function toggleTheme(e) {
  // ink and medieval are paper (light) themes — the sun/moon takes them to dark
  store.setTheme(store.isLightTheme ? 'dark' : 'light', {
    origin: { x: e.clientX, y: e.clientY }
  })
}

function toggleInk(e) {
  store.toggleInk({ origin: { x: e.clientX, y: e.clientY } })
}

function toggleMedieval(e) {
  store.toggleMedieval({ origin: { x: e.clientX, y: e.clientY } })
}

// View switches reveal the incoming view as a circle growing from wherever
// the switch was clicked (the rail button), or from the rail's edge for
// keyboard switches. The origin is set before the DOM patch, so the enter
// transition picks it up (see .people-view-enter-from).
watch(
  () => store.activeView,
  () => {
    const el = canvasStackRef.value
    if (!el) return
    const r = el.getBoundingClientRect()
    const p = recentPointer(600)
    const x = p ? p.x - r.left : 0
    const y = p ? p.y - r.top : r.height / 2
    el.style.setProperty('--reveal-x', `${Math.round(x)}px`)
    el.style.setProperty('--reveal-y', `${Math.round(y)}px`)
  }
)

// Signed-out flow: the HomePage landing shows first; its CTAs open the
// AuthGate in the right mode. Signing out lands back on the homepage.
// Signed-in users can reopen the homepage from the topbar home button.
const authOpen = ref(false)
const authMode = ref('login')
const homeOpen = ref(false)

function openAuth(mode) {
  authMode.value = mode
  authOpen.value = true
}

watch(
  () => store.authUser,
  (user) => {
    if (!user) authOpen.value = false
    homeOpen.value = false
  }
)

function openPalette() {
  paletteRef.value?.show?.()
}

// Image export: hand the modal a capture function so it can render any of the
// WebGL views (they all stay mounted) offscreen at the requested size.
function captureViewImage(view, opts) {
  const target =
    view === 'graph' ? graphRef.value : view === 'timeline' ? timelineRef.value : factionsRef.value
  return target?.exportImage?.(opts) ?? null
}

// ── Save model: everything autosaves; Save commits a checkpoint you can
// revert to (see docs/client-structure.md §6.2) ─────────────────────────────
async function handleSave() {
  await graphRef.value?.flushLayout?.() // fold in any not-yet-autosaved drag
  const res = await store.saveCheckpoint()
  if (res?.success) toast(t('toasts.saved'), { tone: 'success', icon: 'save', duration: 1800 })
  return res
}

async function handleRevert(skipConfirm = false) {
  if (!store.hasUnsavedChanges) return
  if (!skipConfirm) {
    const ok = await confirmDialog({
      title: t('confirm.revert'),
      message: t('confirm.revertBody'),
      confirmLabel: t('confirm.revertConfirm'),
      tone: 'danger',
      icon: 'undo-2'
    })
    if (!ok) return
  }
  const res = await store.revertToCheckpoint()
  if (res.success) {
    await graphRef.value?.reloadScenes?.()
    if (!skipConfirm) toast(t('toasts.reverted'), { tone: 'success', icon: 'undo-2' })
  }
}

// ── Undo / redo (topbar buttons + Ctrl+Z / Ctrl+X) ──────────────────────────
const historyBusy = ref(false)
const undoKick = ref(false)
const redoKick = ref(false)
const historyToast = ref(null)
let historyToastTimer = 0
let historyToastKey = 0

const HISTORY_KINDS = new Set([
  'persons',
  'relationships',
  'fields',
  'relTypes',
  'tags',
  'entity_tags',
  'scene_tags',
  'images',
  'characters'
])

function showHistoryToast(verb, channel) {
  const [domain, sub] = String(channel || '').split(':')
  // Arrangement steps ('layout:move' / curve / style / layout) name themselves.
  const what =
    domain === 'layout'
      ? t(`history.kind.layout_${sub || 'move'}`)
      : t(`history.kind.${HISTORY_KINDS.has(domain) ? domain : 'generic'}`)
  clearTimeout(historyToastTimer)
  historyToast.value = { key: ++historyToastKey, verb, text: t(`history.${verb}`, { what }) }
  historyToastTimer = setTimeout(() => (historyToast.value = null), 1700)
}

async function doUndo() {
  if (historyBusy.value || !store.historyStatus.canUndo) return
  historyBusy.value = true
  undoKick.value = true
  try {
    const channel = await store.undo()
    if (channel) showHistoryToast('undid', channel)
  } finally {
    historyBusy.value = false
  }
}

async function doRedo() {
  if (historyBusy.value || !store.historyStatus.canRedo) return
  historyBusy.value = true
  redoKick.value = true
  try {
    const channel = await store.redo()
    if (channel) showHistoryToast('redid', channel)
  } finally {
    historyBusy.value = false
  }
}

// Undo/redo hotkeys never fire from editable fields (text inputs keep their
// native Ctrl+Z / Ctrl+X), nor over the auth/home/curtain overlays or while
// the person form holds an unsaved working copy.
function isEditableTarget(e) {
  const el = e.target
  // The Directory Sheet's key sink is a hidden textarea (clipboard + IME
  // events need a real text field) but it acts as a grid, not a text box —
  // undo/redo stay live while it has focus.
  if (el?.dataset?.gridKeys != null) return false
  return (
    !!el &&
    (el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      el.isContentEditable)
  )
}

function historyHotkeysBlocked() {
  return (
    !store.authUser ||
    store.curtain.active ||
    store.userPageOpen ||
    store.projectsPageOpen ||
    store.browsePageOpen ||
    homeOpen.value ||
    authOpen.value ||
    store.formOpen ||
    store.pricingOpen ||
    !!store.fingerprintProjectId ||
    !!store.chronicleEditor
  )
}

// Rail order — Alt+1… picks the Nth *visible* view, matching IconRail.
const VIEW_ORDER = ['graph', 'directory', 'relationships', 'timeline', 'groups', 'map', 'character']

function onKeydown(e) {
  if (e.defaultPrevented) return
  const plain = !e.ctrlKey && !e.metaKey && !e.altKey
  // Alt+1…9 switches view, Alt+N adds a person (e.code: layout-independent).
  if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    if (isEditableTarget(e) || historyHotkeysBlocked() || store.appSettingsOpen) return
    const digit = /^Digit([1-9])$/.exec(e.code)
    if (digit) {
      const views = VIEW_ORDER.filter((v) => store.caps.views.includes(v))
      const view = views[Number(digit[1]) - 1]
      if (view) {
        e.preventDefault()
        store.activeView = view
      }
    } else if (e.code === 'KeyN') {
      e.preventDefault()
      store.openForm()
    }
    return
  }
  if (plain && e.key === '?' && !isEditableTarget(e) && !historyHotkeysBlocked()) {
    e.preventDefault()
    store.openAppSettings('help')
    return
  }
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return
  const key = e.key.toLowerCase()
  if (key === 's' && !e.shiftKey) {
    e.preventDefault()
    handleSave()
    return
  }
  // Undo: Ctrl+Z. Redo: Ctrl+X (the app's own), plus the platform-standard
  // Ctrl+Y and Ctrl+Shift+Z.
  const isUndo = key === 'z' && !e.shiftKey
  const isRedo = (!e.shiftKey && (key === 'x' || key === 'y')) || (e.shiftKey && key === 'z')
  if ((isUndo || isRedo) && !isEditableTarget(e) && !historyHotkeysBlocked()) {
    e.preventDefault()
    if (isUndo) doUndo()
    else doRedo()
  }
}

// ── Projects page (the tabs' replacement) ───────────────────────────────────
// Flush any not-yet-autosaved graph layout first, so opening a different
// project from the page never loses the current arrangement.
async function openProjectsPage() {
  await graphRef.value?.flushLayout?.()
  store.toggleProjectsPage(true)
}

// ── Browse page (community trees) — same flush, since grafting a tree and
// opening it switches project straight from the page.
async function openBrowsePage() {
  await graphRef.value?.flushLayout?.()
  store.toggleBrowsePage(true)
}

// ── Right-dock resize ───────────────────────────────────────────────────────
const rightWidth = ref(260)
const MIN_WIDTH = 200
const MAX_WIDTH = 500

let resizing = null
let startX = 0
let startW = 0

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
  rightWidth.value = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW - dx))
}

function onResizeEnd() {
  resizing = null
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
}

const workspaceStyle = computed(() => ({
  gridTemplateColumns: dockCollapsed.value ? '56px 1fr 28px' : `56px 1fr 4px ${rightWidth.value}px`
}))

// ── Project files (Project ▾ → Export / Import project file) ───────────────
function handleImport() {
  const input = importInput.value
  if (!input) return
  input.value = '' // re-picking the same file must still fire `change`
  input.click()
}

async function onImportFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const res = await store.importProjectFile(await file.text())
  if (!res.success) {
    toast(t('toasts.importFailed', { error: res.error }), { tone: 'error' })
    return
  }
  const project = res.data
  toast(t('toasts.imported', { name: project.name }), {
    tone: 'success',
    duration: 8000,
    action: {
      label: t('projectsPage.open'),
      run: async () => {
        await graphRef.value?.flushLayout?.()
        await store.switchProject(project.id)
      }
    }
  })
}

async function handleExport() {
  await graphRef.value?.flushLayout?.() // the file should hold the latest arrangement
  const res = await store.exportProjectFile()
  if (res.success) {
    toast(`${t('toasts.exported', { file: res.data.file })} ${t('toasts.importPhotos')}`, {
      tone: 'success',
      duration: 5000
    })
  } else {
    toast(res.error || t('app.exportFailed'), { tone: 'error' })
  }
}

// In the browser there is no main-process close dialog, so prompt about a
// working copy that differs from the checkpoint via beforeunload (the browser
// shows its own native leave dialog). Skipped in Electron, where the main
// process runs the Save / Discard / Cancel dialog on close.
function onBeforeUnload(e) {
  if (store.hasUnsavedChanges) e.preventDefault()
}

// Any refused action over a plan quota — wherever it started — offers the
// upgrade once (throttled, so a batch of refusals doesn't stack toasts).
let lastPlanLimitToast = 0
onPlanLimit((_channel, error) => {
  if (Date.now() - lastPlanLimitToast < 8000 || store.pricingOpen) return
  lastPlanLimitToast = Date.now()
  toast(t('billing.limitToast'), {
    tone: 'warning',
    icon: 'sparkles',
    duration: 8000,
    action: {
      label: t('billing.seePlans'),
      run: () => store.openPricing({ reason: 'quota', detail: error })
    }
  })
})

onMounted(async () => {
  // Load global settings (theme, program mode)
  const globalRes = await api.invoke('globalSettings:getAll')
  if (globalRes.success && globalRes.data.theme) {
    store.setTheme(globalRes.data.theme, { animate: false })
  }
  if (globalRes.success && globalRes.data.accent) {
    store.setAccent(globalRes.data.accent, { persist: false })
  }
  if (globalRes.success && globalRes.data.programMode) {
    store.setProgramMode(globalRes.data.programMode)
  }
  if (globalRes.success && globalRes.data.language) {
    store.setLanguage(globalRes.data.language)
  }
  if (globalRes.success) {
    store.labsEnabled = globalRes.data.labsEnabled === 'on'
    store.spaceHintSeen = globalRes.data.space3dHintSeen === 'yes'
  }

  // Data loads only behind a session; without one the sign-in gate takes over
  // and login/register do the loading themselves after they succeed.
  if (store.usingSupabase) {
    // Hosted build: resolve the Supabase session and keep it in sync. The
    // auth-state listener loads the signed-in user's data (see the store).
    await store.initSupabaseAuth()
  } else {
    const restored = await store.restoreSession()
    if (restored) {
      await store.loadProjects()
      await store.loadAll()
    }
  }

  // Exit-dialog hooks for the Electron main process (src/main/index.js)
  window.__hasUnsavedChanges = () => store.hasUnsavedChanges
  window.__saveCheckpoint = () => handleSave()
  window.__discardChanges = () => handleRevert(true)
  window.addEventListener('keydown', onKeydown)
  if (!window.electronAPI) window.addEventListener('beforeunload', onBeforeUnload)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
  window.removeEventListener('keydown', onKeydown)
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

/* App mark, doubling as the way back to the homepage */
.home-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--ctl-md);
  height: var(--ctl-md);
  margin-left: 10px;
  padding: 0;
  color: var(--accent);
  border: 1px solid rgba(var(--accent-rgb), 0.3);
  border-radius: 11px;
  background: linear-gradient(135deg, var(--adim), rgba(var(--accent-rgb), 0.24));
  cursor: pointer;
  flex-shrink: 0;
  transition:
    border-color 0.2s ease,
    box-shadow 0.25s ease,
    transform 0.2s ease;
}

.home-btn:hover {
  border-color: rgba(var(--accent-rgb), 0.55);
  box-shadow: 0 0 12px rgba(var(--accent-rgb), 0.3);
  transform: translateY(-1px);
}

/* ── The Projects button (replaces the old per-project tab strip) ─────────── */
.project-btn-area {
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 1;
  padding: 0 4px;
}

.projects-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  min-width: 0;
  height: var(--ctl-md);
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  overflow: hidden;
  transition:
    border-color 0.22s ease,
    box-shadow 0.28s ease,
    transform 0.2s ease,
    color 0.2s ease;
}

.projects-btn:hover {
  color: var(--t1);
  border-color: rgba(var(--accent-rgb), 0.5);
  box-shadow: 0 0 14px rgba(var(--accent-rgb), 0.25);
  transform: translateY(-1px);
}

/* Upgrade pill: a small sparkle that keeps glinting */
.upgrade-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: var(--ctl-md);
  padding: 0 14px;
  border: none;
  border-radius: var(--r-pill);
  color: var(--on-accent);
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: var(--glow);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
  transition: transform 0.2s var(--ease-spring);
}

.upgrade-pill:hover {
  transform: translateY(-1px) scale(1.03);
}

.upgrade-pill-spark {
  flex-shrink: 0;
  animation: upgrade-glint 3.2s ease-in-out infinite;
}

@keyframes upgrade-glint {
  0%,
  70%,
  100% {
    transform: rotate(0) scale(1);
  }
  80% {
    transform: rotate(90deg) scale(1.35);
  }
}

@media (max-width: 1100px) {
  .upgrade-pill-label {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .upgrade-pill-spark {
    animation: none;
  }
}

/* Browse: a compass whose needle swings to a new heading on hover */
.browse-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  margin-left: 8px;
  height: var(--ctl-md);
  padding: 0 12px 0 10px;
  border: 1px solid rgba(var(--accent-rgb), 0.35);
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(var(--accent-rgb), 0.16), rgba(var(--accent-rgb), 0.04));
  color: var(--t1);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition:
    border-color 0.22s ease,
    box-shadow 0.28s ease,
    transform 0.2s ease;
}

.browse-btn:hover {
  border-color: rgba(var(--accent-rgb), 0.7);
  box-shadow: 0 0 14px rgba(var(--accent-rgb), 0.3);
  transform: translateY(-1px);
}

.browse-btn-compass {
  display: grid;
  place-items: center;
  color: var(--accent);
}

.browse-btn-needle {
  transform-origin: 12px 12px;
  transition: transform 0.7s var(--ease-spring);
}

.browse-btn:hover .browse-btn-needle {
  transform: rotate(215deg);
}

@media (max-width: 900px) {
  .browse-btn-label {
    display: none;
  }
}

/* A shine sweeps across on hover — the button wants to be pressed */
.projects-btn::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 45%;
  left: -60%;
  background: linear-gradient(100deg, transparent, rgba(var(--accent-rgb), 0.18), transparent);
  transform: skewX(-20deg);
  transition: left 0.5s ease;
  pointer-events: none;
}

.projects-btn:hover::after {
  left: 120%;
}

.projects-btn-icon {
  display: grid;
  place-items: center;
  color: var(--accent);
  flex-shrink: 0;
}

.projects-btn:hover .projects-btn-icon svg {
  animation: projects-icon-spin 0.6s cubic-bezier(0.34, 1.3, 0.64, 1);
}

@keyframes projects-icon-spin {
  0% {
    transform: rotate(0deg) scale(1);
  }
  50% {
    transform: rotate(-14deg) scale(1.2);
  }
  100% {
    transform: rotate(0deg) scale(1);
  }
}

.projects-btn-label {
  flex-shrink: 0;
}

.projects-btn-count {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 800;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--adim);
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.projects-btn-divider {
  flex-shrink: 0;
  width: 1px;
  height: 14px;
  background: var(--border);
}

.projects-btn-live-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green, #2bb385);
  animation: projects-live-pulse 2.2s ease-in-out infinite;
}

@keyframes projects-live-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(43, 179, 133, 0.6);
  }
  55% {
    box-shadow: 0 0 0 5px rgba(43, 179, 133, 0);
  }
}

.projects-btn-current {
  color: var(--t1);
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.projects-btn-chevron {
  flex-shrink: 0;
  color: var(--t3);
  transition: transform 0.2s ease;
}

.projects-btn:hover .projects-btn-chevron {
  transform: translateX(3px);
  color: var(--accent);
}

.topbar-spacer {
  flex: 0;
}

.topbar-search {
  color: var(--t2);
  gap: 7px;
  padding-right: 7px;
}
.topbar-search:hover {
  color: var(--t1);
}
.topbar-search kbd {
  font-size: 11px;
  padding: 0 5px;
}
@media (max-width: 1100px) {
  .topbar-search-label {
    display: none;
  }
}

.ink-toggle {
  position: relative;
}
.ink-toggle-seal {
  display: grid;
  place-items: center;
  width: 19px;
  height: 19px;
  font-family: var(--font-brush);
  font-size: 14px;
  line-height: 1;
  color: var(--t2);
  border: 1.5px solid currentColor;
  border-radius: 3px 4px 3px 5px;
  transition:
    color var(--dur) ease,
    background var(--dur) ease,
    border-color var(--dur) ease,
    transform 0.45s var(--ease-spring);
}
.ink-toggle:hover .ink-toggle-seal {
  color: var(--t1);
  transform: rotate(-6deg) scale(1.06);
}
/* on: a pressed cinnabar seal — characters cut white from the red paste */
.ink-toggle.on .ink-toggle-seal {
  color: #fbf4e6;
  background: #b3352a;
  border-color: #b3352a;
  box-shadow: 0 1px 4px rgba(140, 36, 28, 0.35);
  animation: ink-toggle-stamp 0.5s var(--ease-spring);
}
/* the shield: an outlined escutcheon; on, it is enamelled lapis with a gilt
   edge and a gold castle, struck like a blazon */
.med-toggle {
  position: relative;
}
.med-toggle-shield {
  display: grid;
  place-items: center;
  width: 17px;
  height: 20px;
  color: var(--t2);
  border: 1.5px solid currentColor;
  border-radius: 2px 2px 50% 50% / 2px 2px 62% 62%;
  transition:
    color var(--dur) ease,
    background var(--dur) ease,
    border-color var(--dur) ease,
    transform 0.45s var(--ease-spring);
}
.med-toggle:hover .med-toggle-shield {
  color: var(--t1);
  transform: rotate(6deg) scale(1.06);
}
.med-toggle.on .med-toggle-shield {
  color: #f1d88c;
  background: linear-gradient(180deg, #2f5aa6, #24478a 60%, #172f5e);
  border-color: #c9a043;
  box-shadow: 0 1px 4px rgba(20, 36, 80, 0.4);
  animation: ink-toggle-stamp 0.5s var(--ease-spring);
}
@keyframes ink-toggle-stamp {
  0% {
    transform: scale(1.45) rotate(-10deg);
  }
  55% {
    transform: scale(0.92) rotate(2deg);
  }
  100% {
    transform: none;
  }
}
/* Theme toggle: sun / moon morph */
.theme-toggle svg {
  overflow: visible;
}
.theme-toggle .tt-core {
  fill: currentColor;
  transform-origin: center;
  transition: transform 0.5s var(--ease-spring);
}
.theme-toggle .tt-bite {
  transition: transform 0.5s var(--ease-out);
}
.theme-toggle .tt-rays {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  transform-origin: 12px 12px;
  transition:
    transform 0.5s var(--ease-spring),
    opacity 0.3s ease;
}
/* dark theme → the button shows a sun (click for light) */
.theme-toggle.dark .tt-bite {
  transform: translate(8px, -8px);
}
.theme-toggle.dark .tt-core {
  transform: scale(0.85);
}
/* light theme → a crescent moon, rays tucked away */
.theme-toggle.light .tt-rays {
  opacity: 0;
  transform: rotate(-90deg) scale(0.4);
}
.theme-toggle.light .tt-core {
  transform: scale(1.35);
}
.theme-toggle:hover {
  color: var(--amber);
}
.theme-toggle.light:hover {
  color: var(--accent);
}

.settings-btn svg {
  transition: transform 0.6s var(--ease-spring);
}
.settings-btn:hover svg {
  transform: rotate(75deg);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

/* ── Undo / redo (beside the Project menu) ────────────────────────────────── */
.history-ctrl {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
}

.history-btn {
  position: relative;
  width: var(--ctl-md);
  height: var(--ctl-md);
  border: none;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--t2);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    opacity 0.3s ease,
    transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.history-btn:hover:not(:disabled) {
  background: var(--hover);
  color: var(--t1);
  transform: translateY(-1px);
}

.history-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.9);
}

.history-btn:disabled {
  opacity: 0.28;
  cursor: default;
}

.history-btn svg {
  display: block;
}

/* Click feedback: the arrow sweeps a full turn (its own direction) with a
   springy overshoot, over an accent ripple that blooms out of the button. */
.history-btn.kick-undo svg {
  animation: history-spin-ccw 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

.history-btn.kick-redo svg {
  animation: history-spin-cw 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes history-spin-ccw {
  0% {
    transform: rotate(0deg) scale(1);
  }
  45% {
    transform: rotate(-290deg) scale(1.25);
  }
  100% {
    transform: rotate(-360deg) scale(1);
  }
}

@keyframes history-spin-cw {
  0% {
    transform: rotate(0deg) scale(1);
  }
  45% {
    transform: rotate(290deg) scale(1.25);
  }
  100% {
    transform: rotate(360deg) scale(1);
  }
}

.history-btn::after {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--accent) 40%, transparent) 0%,
    transparent 70%
  );
  opacity: 0;
  pointer-events: none;
}

.history-btn.kick-undo::after,
.history-btn.kick-redo::after {
  animation: history-ripple 0.5s ease-out;
}

@keyframes history-ripple {
  0% {
    opacity: 0.9;
    transform: scale(0.3);
  }
  100% {
    opacity: 0;
    transform: scale(1.7);
  }
}

/* The "Undid …" pill that drops out from under the buttons */
.history-toast {
  position: absolute;
  top: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  color: var(--t1);
  font-size: 12.5px;
  font-weight: 600;
  padding: 5px 11px;
  border-radius: 999px;
  white-space: nowrap;
  z-index: 70;
  pointer-events: none;
}

.history-toast-glyph {
  flex-shrink: 0;
  color: var(--accent);
}

.history-toast-enter-active {
  transition:
    opacity 0.2s ease,
    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.history-toast-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.history-toast-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px) scale(0.85);
}

.history-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(5px) scale(0.95);
}

.mode-picker-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.mode-picker-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--t3);
}

.mode-picker {
  height: var(--ctl-md);
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 500;
  outline: none;
  cursor: pointer;
}

/* Labs (experimental features) toggle — Advanced mode only */
.labs-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: var(--ctl-md);
  padding: 0 12px 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.3s ease;
}
.labs-btn:hover {
  color: var(--t1);
  background: var(--hover);
}
.labs-btn.labs-on {
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.45);
  background: var(--adim);
  box-shadow: 0 0 10px rgba(var(--accent-rgb), 0.25);
}
.labs-btn.labs-on .labs-flask {
  animation: labs-bubble 0.5s cubic-bezier(0.34, 1.4, 0.64, 1);
}
.labs-flask {
  flex-shrink: 0;
}
@keyframes labs-bubble {
  0% {
    transform: scale(1);
  }
  40% {
    transform: scale(1.35) rotate(-12deg);
  }
  100% {
    transform: scale(1);
  }
}
.labs-enter-active,
.labs-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.25s cubic-bezier(0.34, 1.3, 0.64, 1);
}
.labs-enter-from,
.labs-leave-to {
  opacity: 0;
  transform: scale(0.85);
}

.workspace {
  flex: 1 1 0;
  display: grid;
  grid-template-columns: 56px 1fr 4px 260px;
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

/* View switch: the incoming view is revealed as a circle growing from the
   click point (--reveal-x/y, set in the activeView watcher) while it settles
   from a slight zoom; the outgoing one fades underneath. */
.people-view-enter-active {
  transition:
    clip-path 0.62s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.3s ease,
    transform 0.62s cubic-bezier(0.22, 1, 0.36, 1);
}
.people-view-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  position: absolute;
  inset: 0;
}
.people-view-enter-from {
  opacity: 0.35;
  transform: scale(1.02);
  clip-path: circle(0% at var(--reveal-x, 0px) var(--reveal-y, 50%));
}
.people-view-enter-to {
  clip-path: circle(150% at var(--reveal-x, 0px) var(--reveal-y, 50%));
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

/* Sign-in gate dissolve: the workspace is revealed as the gate fades away */
.auth-gate-leave-active {
  transition:
    opacity 0.45s ease,
    transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
.auth-gate-leave-to {
  opacity: 0;
  transform: scale(1.04);
}
.auth-gate-enter-active {
  transition: opacity 0.25s ease;
}
.auth-gate-enter-from {
  opacity: 0;
}

/* Loading curtain: irises in, then lifts away to reveal what loaded behind it */
.curtain-enter-active {
  transition:
    opacity 0.35s ease,
    transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}
.curtain-leave-active {
  transition:
    opacity 0.5s ease,
    transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.curtain-enter-from {
  opacity: 0;
  transform: scale(1.06);
}
.curtain-leave-to {
  opacity: 0;
  transform: scale(1.08);
}
</style>
