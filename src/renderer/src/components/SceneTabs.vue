<template>
  <div class="scene-tabs" @wheel.stop>
    <span class="st-label">{{ label }}</span>
    <div class="st-chips">
      <TransitionGroup name="stpill">
        <button
          v-for="s in scenes"
          :key="s.id"
          class="st-chip"
          :class="{ active: s.id === activeId }"
          :title="tooltip ? tooltip(s) : s.name"
          @click="onChipClick(s)"
          @dblclick="startRename(s)"
        >
          <input
            v-if="renamingId === s.id"
            ref="renameRef"
            v-model="renameValue"
            class="st-rename"
            @keydown.enter="confirmRename"
            @keydown.escape="renamingId = null"
            @blur="confirmRename"
            @click.stop
          />
          <span v-else class="st-name">{{ s.name }}</span>
          <span v-if="$slots.badge" class="st-badge"><slot name="badge" :scene="s"></slot></span>
          <span
            v-if="scenes.length > 1 && renamingId !== s.id"
            class="st-x"
            :title="deleteTitle"
            @click.stop="$emit('remove', s)"
            >×</span
          >
        </button>
      </TransitionGroup>
      <button class="st-add" :title="addTitle" @click="$emit('create')">＋</button>
      <button v-if="activeId" class="st-add" :title="duplicateTitle" @click="$emit('duplicate')">
        ⧉
      </button>
    </div>
    <span v-if="hint" class="st-hint">{{ hint }}</span>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'

// The shared Scene tab strip: lists ONE view's scenes, marks the active one,
// and offers switch / new / rename (dblclick) / duplicate / delete. Purely
// presentational — the owning view supplies the scenes and reacts to events,
// so each view keeps its own switch/transition behaviour.
defineProps({
  scenes: { type: Array, required: true },
  activeId: { type: String, default: null },
  label: { type: String, default: 'Scenes' },
  hint: { type: String, default: '' },
  tooltip: { type: Function, default: null },
  addTitle: { type: String, default: 'New scene' },
  duplicateTitle: { type: String, default: 'Duplicate current scene' },
  deleteTitle: { type: String, default: 'Delete scene' }
})

const emit = defineEmits(['switch', 'create', 'duplicate', 'rename', 'remove'])

const renamingId = ref(null)
const renameValue = ref('')
const renameRef = ref(null)

function onChipClick(s) {
  if (renamingId.value) return
  emit('switch', s.id)
}

function startRename(s) {
  renamingId.value = s.id
  renameValue.value = s.name
  nextTick(() => {
    const el = Array.isArray(renameRef.value) ? renameRef.value[0] : renameRef.value
    el?.focus()
    el?.select()
  })
}

function confirmRename() {
  const id = renamingId.value
  renamingId.value = null
  if (id && renameValue.value.trim()) emit('rename', id, renameValue.value.trim())
}

defineExpose({ startRename })
</script>

<style scoped>
.scene-tabs {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-top: 1px solid var(--border);
  background: var(--glass-soft);
  backdrop-filter: blur(10px);
  z-index: 2;
  min-height: 46px;
}
.st-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--t3);
  flex-shrink: 0;
}
.st-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.st-chips::-webkit-scrollbar {
  display: none;
}

.st-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 11px;
  border-radius: 18px;
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s,
    transform 0.15s;
}
.st-chip:hover {
  background: var(--hover);
  color: var(--t1);
  transform: translateY(-1px);
}
.st-chip.active {
  background: var(--adim);
  color: var(--accent);
  border-color: rgba(108, 142, 245, 0.35);
}
.st-name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.st-badge {
  font-size: 10px;
  font-weight: 700;
  background: var(--surface);
  color: var(--t3);
  padding: 0 6px;
  border-radius: 9px;
  font-variant-numeric: tabular-nums;
}
.st-badge:empty {
  display: none;
}
.st-chip.active .st-badge {
  color: var(--accent);
}
/* The delete affordance stays mounted and animates open on chip hover — it
   springs out from nothing rather than snapping in. `max-width` + a negative
   margin (to absorb the flex gap while collapsed) keep the chip from jumping. */
.st-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  line-height: 1;
  color: var(--t3);
  border-radius: 4px;
  max-width: 0;
  margin-left: -7px;
  opacity: 0;
  transform: scale(0.5);
  overflow: hidden;
  pointer-events: none;
  transition:
    max-width 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    margin-left 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.18s ease,
    transform 0.24s cubic-bezier(0.34, 1.56, 0.64, 1),
    color 0.12s ease;
}
.st-chip:hover .st-x {
  max-width: 18px;
  margin-left: 0;
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
}
.st-x:hover {
  color: #ef5350;
  transform: scale(1.18);
}
.st-rename {
  width: 110px;
  background: transparent;
  border: 1px solid var(--accent);
  border-radius: 6px;
  color: var(--t1);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  padding: 1px 6px;
  outline: none;
  box-shadow: none;
}
.st-add {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px dashed var(--border);
  background: transparent;
  color: var(--t3);
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}
.st-add:hover {
  background: var(--hover);
  color: var(--accent);
  border-color: var(--accent);
  border-style: solid;
}
.st-hint {
  font-size: 10.5px;
  color: var(--t3);
  flex-shrink: 0;
}
@media (max-width: 1100px) {
  .st-hint {
    display: none;
  }
}

/* Chip enter/leave */
.stpill-enter-active {
  transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}
.stpill-leave-active {
  transition: all 0.18s ease;
}
.stpill-enter-from {
  opacity: 0;
  transform: translateY(6px) scale(0.9);
}
.stpill-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
