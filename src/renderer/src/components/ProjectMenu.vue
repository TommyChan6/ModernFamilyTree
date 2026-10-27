<template>
  <div class="pmenu-wrap">
    <button
      class="btn btn-ghost pmenu-btn"
      :class="{ 'is-active': open }"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click.stop="open = !open"
    >
      {{ t('projectMenu.button') }}
      <UiIcon class="pmenu-caret" :class="{ open }" name="chevron-down" :size="14" />
      <span
        v-if="store.hasUnsavedChanges"
        class="pmenu-dot"
        :title="t('projectMenu.unsavedDot')"
      ></span>
    </button>

    <Transition name="pmenu">
      <div v-if="open" class="pmenu ink-unroll" role="menu" @click.stop>
        <!-- Save model -->
        <button
          class="pmenu-item"
          role="menuitem"
          :title="t('projectMenu.saveHint')"
          @click="emitAnd('save')"
        >
          <UiIcon class="pmenu-icon" name="save" :size="16" />
          {{ t('projectMenu.save') }}
          <span v-if="store.hasUnsavedChanges" class="pmenu-badge">{{
            t('projectMenu.unsaved')
          }}</span>
          <kbd v-else class="pmenu-kbd">Ctrl S</kbd>
        </button>
        <button
          class="pmenu-item"
          role="menuitem"
          :disabled="!store.hasUnsavedChanges"
          :title="t('projectMenu.revertHint')"
          @click="emitAnd('revert')"
        >
          <UiIcon class="pmenu-icon" name="undo-2" :size="16" />
          {{ t('projectMenu.revert') }}
        </button>

        <div class="pmenu-sep"></div>

        <button
          class="pmenu-item"
          role="menuitem"
          :title="t('projectMenu.exportHint')"
          @click="emitAnd('export')"
        >
          <UiIcon class="pmenu-icon" name="file-down" :size="16" />
          {{ t('projectMenu.exportJson') }}
        </button>
        <button
          class="pmenu-item"
          role="menuitem"
          :title="t('projectMenu.importHint')"
          @click="emitAnd('import')"
        >
          <UiIcon class="pmenu-icon" name="file-up" :size="16" />
          {{ t('projectMenu.importJson') }}
        </button>
        <button
          class="pmenu-item"
          role="menuitem"
          :title="t('fingerprint.open')"
          @click="openFingerprint"
        >
          <UiIcon class="pmenu-icon" name="fingerprint" :size="16" />
          {{ t('fingerprint.menu') }}
        </button>

        <div class="pmenu-sep"></div>

        <!-- Present (reference "now" date) -->
        <div class="pmenu-section">
          <div class="eyebrow pmenu-label">{{ t('projectMenu.present') }}</div>
          <div class="pmenu-date-row">
            <input
              type="number"
              class="pmenu-date-input"
              :value="store.currentDate?.year || ''"
              :placeholder="t('projectMenu.presentPh')"
              min="1"
              max="2200"
              @change="store.setCurrentYear($event.target.value)"
            />
            <button
              v-if="store.userCurrentYear"
              class="pmenu-date-clear"
              :title="t('projectMenu.presentReset')"
              :aria-label="t('projectMenu.presentReset')"
              @click="store.setCurrentYear('')"
            >
              <UiIcon name="x" :size="14" />
            </button>
          </div>
          <div v-if="!store.userCurrentYear && store.currentDate" class="pmenu-hint">
            {{ t('projectMenu.presentAuto') }}
          </div>
        </div>

        <div class="pmenu-sep"></div>

        <!-- Statistics -->
        <div class="pmenu-section">
          <div class="eyebrow pmenu-label">{{ t('projectMenu.stats') }}</div>
          <div class="pmenu-stats">
            <div
              v-for="(s, i) in stats"
              :key="s.key"
              class="pmenu-stat"
              :style="{ '--i': i }"
              :title="s.hint || ''"
            >
              <b class="text-gradient">{{ s.value }}</b>
              <span>{{ t('projectMenu.' + s.key) }}</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMainStore } from '../store/index.js'
import { useI18n } from '../i18n'
import { generationCount } from './graph/graphInsights.js'
import UiIcon from './ui/UiIcon.js'

// The Project ▾ dropdown in the top bar: Save/Revert, project file
// Export/Import, the Current Date (Present) input and the project statistics.
const store = useMainStore()
const { t } = useI18n()
const emit = defineEmits(['save', 'revert', 'export', 'import'])

const open = ref(false)

function emitAnd(evt) {
  open.value = false
  emit(evt)
}

function openFingerprint() {
  open.value = false
  store.openFingerprint(store.activeProjectId)
}

// Couples = every 'horizontal' (couple-role) bond, not just the builtin
// 'spouse' type; generations = the longest vertical chain. Only evaluated
// while the menu is open (the template reads them inside v-if).
const stats = computed(() => {
  const roleOf = (type) => store.relTypeRoles.get(type) ?? 'none'
  return [
    { key: 'members', value: store.personCount },
    { key: 'relationships', value: store.relationships.length },
    {
      key: 'couples',
      value: store.relationships.filter((r) => roleOf(r.type) === 'horizontal').length
    },
    {
      key: 'generations',
      value: generationCount(
        store.persons.map((p) => p.id),
        store.relationships,
        roleOf
      ),
      hint: t('projectMenu.generationsHint')
    }
  ]
})

function onDocClick() {
  open.value = false
}
function onKey(e) {
  if (open.value && e.key === 'Escape') open.value = false
}
onMounted(() => {
  document.addEventListener('click', onDocClick)
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.pmenu-wrap {
  position: relative;
}

.pmenu-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.pmenu-caret {
  color: var(--t3);
  transition: transform var(--dur-slow) var(--ease-spring);
}
.pmenu-caret.open {
  transform: rotate(180deg);
}

.pmenu-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--warning);
  animation: pmenu-pulse 2s ease-in-out infinite;
}

@keyframes pmenu-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(245, 166, 35, 0.55);
  }
  60% {
    box-shadow: 0 0 0 5px rgba(245, 166, 35, 0);
  }
}

.pmenu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 256px;
  background: var(--glass-soft);
  backdrop-filter: blur(18px) saturate(1.3);
  -webkit-backdrop-filter: blur(18px) saturate(1.3);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-lg);
  padding: 6px;
  z-index: 60;
  transform-origin: top left;
}

.pmenu-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--t2);
  font-size: 13px;
  font-family: var(--font);
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition:
    background var(--dur-fast),
    color var(--dur-fast),
    padding var(--dur) var(--ease-out);
}

.pmenu-item:hover:not(:disabled) {
  background: var(--hover);
  color: var(--t1);
  padding-left: 13px;
}

.pmenu-item:disabled {
  opacity: 0.45;
}

.pmenu-icon {
  flex-shrink: 0;
  color: var(--t3);
}
.pmenu-item:hover:not(:disabled) .pmenu-icon {
  color: var(--accent);
}

.pmenu-badge {
  margin-left: auto;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--warning);
  background: rgba(245, 166, 35, 0.12);
  padding: 2px 6px;
  border-radius: 6px;
}

.pmenu-kbd {
  margin-left: auto;
  font-size: 11px;
  padding: 0 5px;
}

.pmenu-sep {
  height: 1px;
  background: var(--border);
  margin: 6px 4px;
}

.pmenu-section {
  padding: 4px 10px 6px;
}

.pmenu-label {
  padding-bottom: 6px;
}

.pmenu-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.pmenu-stat {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 8px 10px;
  border-radius: var(--r-md);
  background: var(--elevated);
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--t2);
  animation: pmenu-stat-in 0.4s var(--ease-out) backwards;
  animation-delay: calc(0.05s + var(--i, 0) * 0.05s);
}

.pmenu-stat b {
  font-size: 18px;
  font-weight: 800;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

@keyframes pmenu-stat-in {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.96);
  }
}

.pmenu-date-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pmenu-date-input {
  flex: 1;
  min-width: 0;
  height: var(--ctl-sm);
  padding: 0 10px;
  font-size: 13px;
  font-weight: 500;
}

.pmenu-date-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--ctl-sm);
  height: var(--ctl-sm);
  padding: 0;
  border-radius: var(--r-sm);
  border: none;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  flex-shrink: 0;
}

.pmenu-date-clear:hover {
  background: rgba(var(--danger-rgb), 0.12);
  color: var(--danger);
}

.pmenu-hint {
  padding-top: 4px;
  font-size: 12px;
  color: var(--t3);
}

.pmenu-enter-active {
  transition:
    opacity 0.18s ease,
    transform 0.28s var(--ease-spring);
}
.pmenu-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.pmenu-enter-from,
.pmenu-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.96);
}

/* ── 水墨 ink theme: the menu is a paper slip that unrolls down from the
   button (.ink-unroll); rows bloom, the stats are brushed numerals ─────── */
:root[data-theme='ink'] .pmenu {
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border-color: var(--ink-mount-line);
  border-radius: 2px;
  box-shadow:
    0 0 0 3px var(--ink-silk),
    0 0 0 4px rgba(58, 42, 22, 0.22),
    var(--shadow-lg);
}
:root[data-theme='ink'] .pmenu-enter-from,
:root[data-theme='ink'] .pmenu-leave-to {
  transform: none;
}
:root[data-theme='ink'] .pmenu-item {
  border-radius: 2px;
  font-family: var(--font-ink-label);
  font-size: 14px;
  background: radial-gradient(closest-side, rgba(40, 30, 18, 0.1), transparent) 30% 50% / 0% 0%
    no-repeat;
  transition:
    background-size 0.45s var(--ease-out),
    color var(--dur-fast),
    padding var(--dur) var(--ease-out);
}
:root[data-theme='ink'] .pmenu-item:hover:not(:disabled) {
  background-color: transparent;
  background-size: 170% 300%;
}
:root[data-theme='ink'] .pmenu-badge {
  border-radius: 2px;
  color: var(--accent);
  background: transparent;
  box-shadow: inset 0 0 0 1px rgba(179, 53, 42, 0.5);
}
:root[data-theme='ink'] .pmenu-dot {
  background: var(--accent);
  border-radius: 46% 54% 40% 60% / 55% 42% 58% 45%;
  animation: none;
}
:root[data-theme='ink'] .pmenu-sep {
  height: 5px;
  background: rgba(28, 26, 23, 0.3);
  -webkit-mask: var(--ink-divider) center / 100% 100% no-repeat;
  mask: var(--ink-divider) center / 100% 100% no-repeat;
}
:root[data-theme='ink'] .pmenu-stat {
  border-radius: 2px;
  background: rgba(255, 251, 240, 0.55);
  border-color: rgba(48, 36, 20, 0.16);
}
:root[data-theme='ink'] .pmenu-stat b {
  font-family: var(--font-brush);
  font-size: 22px;
  font-weight: 400;
}
</style>
