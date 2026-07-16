<template>
  <div class="afb">
    <!-- collapsed -->
    <button v-if="!open" class="afb-toggle" type="button" @click="open = true">
      <span class="afb-plus">＋</span> Add trait
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
          <span class="afb-glyph">{{ m.glyph }}</span>
          <span class="afb-name">{{ m.label }}</span>
        </button>
        <button class="afb-cancel" type="button" title="Close" @click="open = false">✕</button>
      </div>

      <div v-else class="afb-naming">
        <span class="afb-picked" @click="picked = null">
          <span class="afb-glyph">{{ picked.glyph }}</span
          >{{ picked.label }}
          <i class="afb-picked-x">✕</i>
        </span>
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
          <input v-model="locked" type="checkbox" /> lock
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
  width: 100%;
  padding: 10px;
  border: 1.5px dashed var(--border);
  border-radius: 10px;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 12.5px;
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
.afb-plus {
  font-size: 13px;
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
  font-size: 15px;
  color: var(--accent);
  line-height: 1;
}
.afb-name {
  font-size: 10px;
  color: var(--t2);
}
.afb-cancel {
  position: absolute;
  top: -18px;
  right: -3px;
  border: none;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  font-size: 11px;
}
.afb-cancel:hover {
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
  padding: 4px 9px;
  border-radius: 999px;
  background: var(--adim);
  border: 1px solid var(--accent);
  color: var(--t1);
  font-size: 11px;
  cursor: pointer;
  flex-shrink: 0;
}
.afb-picked-x {
  font-style: normal;
  font-size: 9px;
  color: var(--t3);
}
.afb-input {
  flex: 1;
  min-width: 0;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12.5px;
  outline: none;
}
.afb-input:focus {
  border-color: var(--accent);
}
.afb-lock {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--t2);
  cursor: pointer;
  flex-shrink: 0;
}
</style>
