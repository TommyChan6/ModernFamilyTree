<template>
  <div class="afb">
    <!-- collapsed -->
    <button v-if="!open" class="afb-toggle" type="button" @click="open = true">
      <UiIcon name="plus" :size="14" />
      Add trait
    </button>

    <!-- expanded: type palette → name it → create -->
    <div v-else class="afb-panel">
      <div v-if="!picked" class="afb-grid">
        <button
          v-for="(m, i) in FIELD_TYPE_META"
          :key="m.type"
          type="button"
          class="afb-type"
          :style="{ '--d': i * 0.03 + 's' }"
          :title="m.hint"
          @click="picked = m"
        >
          <UiIcon class="afb-glyph" :name="m.icon" :size="16" />
          <span class="afb-name">{{ m.label }}</span>
        </button>
        <button
          class="afb-cancel"
          type="button"
          title="Close"
          aria-label="Close"
          @click="open = false"
        >
          <UiIcon name="x" :size="14" />
        </button>
      </div>

      <div v-else class="afb-naming">
        <button type="button" class="afb-picked" title="Change type" @click="picked = null">
          <UiIcon class="afb-glyph" :name="picked.icon" :size="14" />
          {{ picked.label }}
          <UiIcon class="afb-picked-x" name="x" :size="12" />
        </button>
        <input
          ref="nameEl"
          v-model="label"
          class="afb-input"
          type="text"
          :placeholder="`Name this ${picked.label.toLowerCase()} trait…`"
          @keydown.enter="create"
          @keydown.esc="picked = null"
        />
        <label class="afb-lock" title="Locked traits appear on every person's form">
          <input v-model="locked" type="checkbox" /> Lock
        </label>
        <button
          class="btn btn-primary btn-sm"
          type="button"
          :disabled="!label.trim()"
          @click="create"
        >
          Create
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { FIELD_TYPE_META } from './fieldUi.js'
import UiIcon from '../ui/UiIcon.js'

const emit = defineEmits(['create'])

const open = ref(false)
const picked = ref(null)
const label = ref('')
const locked = ref(false)
const nameEl = ref(null)

watch(picked, async (m) => {
  if (m) {
    await nextTick()
    nameEl.value?.focus()
  }
})

function create() {
  const l = label.value.trim()
  if (!l || !picked.value) return
  const config =
    picked.value.type === 'select'
      ? {
          options: [
            { id: 'opt-1', label: 'Option 1' },
            { id: 'opt-2', label: 'Option 2' }
          ]
        }
      : {}
  emit('create', { label: l, type: picked.value.type, locked: locked.value, config })
  label.value = ''
  picked.value = null
  locked.value = false
  open.value = false
}
</script>

<style scoped>
.afb-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px;
  border: 1.5px dashed var(--border);
  border-radius: 10px;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 13px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    color 0.2s,
    background 0.2s;
}
.afb-toggle:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--adim);
}

.afb-panel {
  border: 1.5px dashed var(--border);
  border-radius: 10px;
  padding: 9px;
}
.afb-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  position: relative;
}
.afb-type {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 9px 4px 7px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  cursor: pointer;
  animation: afb-in 0.24s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  animation-delay: var(--d);
  transition:
    transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1),
    border-color 0.15s,
    box-shadow 0.15s;
}
.afb-type:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: 0 4px 14px var(--adim);
}
.afb-type:active {
  transform: scale(0.95);
}
@keyframes afb-in {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.9);
  }
}
.afb-glyph {
  flex-shrink: 0;
  color: var(--accent);
}
.afb-name {
  font-size: 12px;
  color: var(--t2);
}
.afb-cancel {
  position: absolute;
  top: -24px;
  right: -4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--ctl-xs);
  height: var(--ctl-xs);
  padding: 0;
  border: none;
  border-radius: var(--r-xs);
  background: transparent;
  color: var(--t3);
  cursor: pointer;
}
.afb-cancel:hover {
  background: var(--hover);
  color: var(--t1);
}

.afb-naming {
  display: flex;
  align-items: center;
  gap: 8px;
  animation: afb-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.afb-picked {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: var(--ctl-sm);
  padding: 0 10px;
  font-family: var(--font);
  border-radius: 999px;
  background: var(--adim);
  border: 1px solid var(--accent);
  color: var(--t1);
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
}
.afb-picked-x {
  color: var(--t3);
}
.afb-input {
  flex: 1;
  min-width: 0;
  height: var(--ctl-sm);
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 13px;
  outline: none;
}
.afb-input:focus {
  border-color: var(--accent);
}
.afb-lock {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--t2);
  cursor: pointer;
  flex-shrink: 0;
}

/* ── 水墨 ink theme ─────────────────────────────────────────────────────── */
:root[data-theme='ink'] .afb-toggle,
:root[data-theme='ink'] .afb-type,
:root[data-theme='ink'] .afb-input,
:root[data-theme='ink'] .afb-picked {
  border-radius: 3px;
  font-family: var(--font-ink-label);
}
:root[data-theme='ink'] .afb-type:hover {
  background: rgba(179, 53, 42, 0.05);
}
:root[data-theme='ink'] .afb-name {
  font-size: 13px;
}
</style>
