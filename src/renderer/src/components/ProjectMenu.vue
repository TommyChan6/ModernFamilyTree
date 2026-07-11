<template>
  <div class="pmenu-wrap">
    <button class="btn btn-ghost btn-sm pmenu-btn" :class="{ open }" @click.stop="open = !open">
      Project ▾
      <span v-if="store.hasUnsavedChanges" class="pmenu-dot" title="Unsaved changes"></span>
    </button>

    <Transition name="pmenu">
      <div v-if="open" class="pmenu" @click.stop>
        <!-- Save model -->
        <button
          class="pmenu-item"
          title="Commit a checkpoint you can revert to (Ctrl+S)"
          @click="emitAnd('save')"
        >
          <span class="pmenu-icon">💾</span> Save
          <span v-if="store.hasUnsavedChanges" class="pmenu-badge">unsaved</span>
        </button>
        <button
          class="pmenu-item"
          :disabled="!store.hasUnsavedChanges"
          title="Restore the arrangement saved by the last checkpoint"
          @click="emitAnd('revert')"
        >
          <span class="pmenu-icon">↩</span> Revert to saved
        </button>

        <div class="pmenu-sep"></div>

        <button class="pmenu-item" @click="emitAnd('export')">
          <span class="pmenu-icon">⬆</span> Export JSON
        </button>
        <button class="pmenu-item" @click="emitAnd('import')">
          <span class="pmenu-icon">⬇</span> Import JSON
        </button>

        <div class="pmenu-sep"></div>

        <!-- Present (reference "now" date) -->
        <div class="pmenu-section">
          <div class="pmenu-label">Current Date</div>
          <div class="pmenu-date-row">
            <input
              type="number"
              class="pmenu-date-input"
              :value="store.currentDate?.year || ''"
              placeholder="Enter year…"
              min="1"
              max="2200"
              @change="store.setCurrentYear($event.target.value)"
            />
            <button
              v-if="store.userCurrentYear"
              class="pmenu-date-clear"
              title="Reset to latest year in data"
              @click="store.setCurrentYear('')"
            >
              ✕
            </button>
          </div>
          <div v-if="!store.userCurrentYear && store.currentDate" class="pmenu-hint">
            Auto · latest year in data
          </div>
        </div>

        <div class="pmenu-sep"></div>

        <!-- Statistics -->
        <div class="pmenu-section">
          <div class="pmenu-label">Statistics</div>
          <div class="pmenu-stat">
            <span>Members</span><b>{{ store.personCount }}</b>
          </div>
          <div class="pmenu-stat">
            <span>Relationships</span><b>{{ store.relationships.length }}</b>
          </div>
          <div class="pmenu-stat">
            <span>Couples</span><b>{{ store.coupleCount }}</b>
          </div>
          <div class="pmenu-stat">
            <span>Generations</span><b>{{ generationCount }}</b>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMainStore } from '../store/index.js'

// The Project ▾ dropdown in the top bar: Save/Revert, Export/Import, the
// Current Date (Present) input and the project statistics — everything the
// old left sidebar held besides navigation.
const store = useMainStore()
const emit = defineEmits(['save', 'revert', 'export', 'import'])

const open = ref(false)

function emitAnd(evt) {
  open.value = false
  emit(evt)
}

const generationCount = computed(() => {
  // Simple heuristic: number of distinct birth decade groups
  const years = store.persons.filter((p) => p.birth?.year).map((p) => Math.floor(p.birth.year / 20))
  return new Set(years).size || 0
})

function onDocClick() {
  open.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<style scoped>
.pmenu-wrap {
  position: relative;
}

.pmenu-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.pmenu-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #f5a623;
  animation: pmenu-pulse 2s ease-in-out infinite;
}

@keyframes pmenu-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.pmenu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 240px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
  padding: 6px;
  z-index: 60;
}

.pmenu-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--t2);
  font-size: 13px;
  font-family: var(--font);
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition:
    background 0.12s,
    color 0.12s;
}

.pmenu-item:hover:not(:disabled) {
  background: var(--hover);
  color: var(--t1);
}

.pmenu-item:disabled {
  opacity: 0.45;
  cursor: default;
}

.pmenu-icon {
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}

.pmenu-badge {
  margin-left: auto;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #f5a623;
  background: rgba(245, 166, 35, 0.12);
  padding: 2px 6px;
  border-radius: 6px;
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
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--t3);
  padding-bottom: 6px;
}

.pmenu-stat {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 12px;
  color: var(--t2);
}

.pmenu-stat b {
  color: var(--accent);
  font-size: 13px;
}

.pmenu-date-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pmenu-date-input {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 500;
  outline: none;
}

.pmenu-date-input:focus {
  border-color: var(--accent);
}

.pmenu-date-clear {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--t3);
  font-size: 11px;
  cursor: pointer;
  flex-shrink: 0;
}

.pmenu-date-clear:hover {
  background: rgba(239, 83, 80, 0.12);
  color: #ef5350;
}

.pmenu-hint {
  padding-top: 4px;
  font-size: 10px;
  color: var(--t3);
}

.pmenu-enter-active,
.pmenu-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.pmenu-enter-from,
.pmenu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
