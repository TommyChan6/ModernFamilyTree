<template>
  <div class="fr" :class="{ locked: def.locked, menuOpen }">
    <!-- grab handle -->
    <button
      class="fr-handle"
      type="button"
      title="Drag to reorder — drop on a slot to assign"
      @pointerdown.prevent="emit('drag-start', $event)"
    >
      <span></span><span></span>
    </button>

    <div class="fr-main">
      <div class="fr-head">
        <span v-if="def.icon" class="fr-icon">{{ def.icon }}</span>
        <span class="fr-label">{{ def.label }}</span>
        <span class="fr-type">{{ meta.glyph }}</span>
        <span v-if="def.locked" class="fr-lock" title="Template trait — on every form">🔒</span>
        <span v-if="draft.display_in_graph" class="fr-eye" title="Shown in the graph label">◉</span>
      </div>

      <FieldInput
        :def="def"
        :model-value="draft.value"
        @update:model-value="emit('update', { value: $event })"
      />

      <!-- timeframe (Advanced) -->
      <div v-if="def.has_timeframe && advanced" class="fr-timeframe">
        <span class="fr-tf-glyph" title="When this trait applied">⧗</span>
        <input
          class="fr-tf-input"
          type="number"
          placeholder="from"
          :value="draft.timeframe?.from?.year ?? ''"
          @input="setTimeframe('from', $event.target.value)"
        />
        <span class="fr-tf-dash">–</span>
        <input
          class="fr-tf-input"
          type="number"
          placeholder="to"
          :value="draft.timeframe?.to?.year ?? ''"
          @input="setTimeframe('to', $event.target.value)"
        />
      </div>

      <!-- inline trait config editor -->
      <Transition name="fr-cfg">
        <div v-if="editing" class="fr-config">
          <div class="fr-cfg-grid">
            <label class="fr-cfg-field">
              <span>Label</span>
              <input v-model="cfg.label" type="text" />
            </label>
            <label class="fr-cfg-field fr-cfg-sm">
              <span>Icon</span>
              <input v-model="cfg.icon" type="text" maxlength="4" placeholder="✦" />
            </label>
            <label v-if="hasUnit" class="fr-cfg-field fr-cfg-sm">
              <span>Unit</span>
              <input v-model="cfg.unit" type="text" maxlength="8" placeholder="cm" />
            </label>
            <label v-if="def.type === 'text'" class="fr-cfg-field fr-cfg-check">
              <input v-model="cfg.multiline" type="checkbox" />
              <span>Multiline</span>
            </label>
            <template v-if="hasMinMax">
              <label class="fr-cfg-field fr-cfg-sm">
                <span>Min</span><input v-model.number="cfg.min" type="number" />
              </label>
              <label class="fr-cfg-field fr-cfg-sm">
                <span>Max</span><input v-model.number="cfg.max" type="number" />
              </label>
              <label class="fr-cfg-field fr-cfg-sm">
                <span>Step</span><input v-model.number="cfg.step" type="number" />
              </label>
            </template>
            <template v-if="def.type === 'slider' || def.type === 'boolean'">
              <label class="fr-cfg-field">
                <span>Left label</span><input v-model="cfg.leftLabel" type="text" />
              </label>
              <label class="fr-cfg-field">
                <span>Right label</span><input v-model="cfg.rightLabel" type="text" />
              </label>
            </template>
          </div>

          <!-- select options editor -->
          <div v-if="def.type === 'select'" class="fr-options">
            <div v-for="(opt, i) in cfg.options" :key="i" class="fr-opt-row">
              <input v-model="opt.color" type="color" class="fr-opt-color" title="Option color" />
              <input v-model="opt.label" type="text" class="fr-opt-label" placeholder="Option…" />
              <button
                class="fr-opt-x"
                type="button"
                title="Remove option"
                @click="cfg.options.splice(i, 1)"
              >
                ✕
              </button>
            </div>
            <button class="fr-opt-add" type="button" @click="addOption">＋ option</button>
          </div>

          <div class="fr-cfg-actions">
            <button class="btn btn-ghost btn-sm" type="button" @click="editing = false">
              Cancel
            </button>
            <button class="btn btn-primary btn-sm" type="button" @click="saveConfig">Apply</button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- options menu -->
    <div class="fr-menu-anchor">
      <button
        class="fr-menu-btn"
        type="button"
        title="Trait options"
        @pointerdown.stop
        @click.stop="menuOpen = !menuOpen"
      >
        ⋯
      </button>
      <Transition name="fr-pop">
        <div v-if="menuOpen" class="fr-menu" @pointerdown.stop @click.stop>
          <button class="fr-mi" @click="openEditor">
            <i>✎</i>Edit trait<span class="fr-mi-hint">label · icon · options</span>
          </button>
          <button class="fr-mi" @click="toggleLock">
            <i>{{ def.locked ? '🔓' : '🔒' }}</i
            >{{ def.locked ? 'Unlock' : 'Lock' }}
            <span class="fr-mi-hint">{{ def.locked ? 'this person only' : 'on every form' }}</span>
          </button>
          <div class="fr-mi" role="button" tabindex="0" @click="toggleDisplay">
            <i>{{ draft.display_in_graph ? '◉' : '○' }}</i
            >Show in graph
            <button
              v-if="def.locked"
              class="fr-mi-apply"
              type="button"
              title="Apply to this trait on every person"
              @click.stop="applyAll"
            >
              apply to all
            </button>
          </div>
          <button v-if="advanced" class="fr-mi" @click="toggleTimeframe">
            <i>⧗</i>{{ def.has_timeframe ? 'Remove timeframe' : 'Set timeframe' }}
          </button>
          <div class="fr-mi-sep"></div>
          <div class="fr-mi-slots">
            <span class="fr-mi-slots-label">Move to slot</span>
            <div class="fr-mi-slot-chips">
              <button
                v-for="s in slotTargets"
                :key="s.slot"
                class="fr-mi-slot"
                :disabled="!s.ok"
                :title="s.ok ? s.label : `${meta.label} traits can't go here`"
                @click="moveToSlot(s.slot)"
              >
                {{ s.glyph }}
              </button>
            </div>
          </div>
          <div class="fr-mi-sep"></div>
          <button class="fr-mi" @click="duplicate"><i>⧉</i>Duplicate</button>
          <button v-if="!def.locked && attached" class="fr-mi" @click="removeFromPerson">
            <i>⏏</i>Remove from this person
          </button>
          <button class="fr-mi fr-mi-danger" @click="deleteDef"><i>🗑</i>Delete trait</button>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onBeforeUnmount } from 'vue'
import { useMainStore } from '../../store/index.js'
import { yearDate } from '../../../../shared/calendarMath'
import { slotAccepts } from '../../../../shared/fields'
import { typeMeta, SLOT_META } from './fieldUi.js'
import FieldInput from './FieldInput.vue'

const props = defineProps({
  def: { type: Object, required: true },
  draft: { type: Object, required: true }, // { value, display_in_graph, timeframe }
  advanced: { type: Boolean, default: false },
  attached: { type: Boolean, default: false }
})
const emit = defineEmits(['update', 'drag-start', 'remove-from-person'])

const store = useMainStore()
const menuOpen = ref(false)
const editing = ref(false)
const meta = computed(() => typeMeta(props.def.type))
const hasUnit = computed(() => ['number', 'slider', 'number_range'].includes(props.def.type))
const hasMinMax = computed(() => ['number', 'slider', 'number_range'].includes(props.def.type))

const slotTargets = computed(() =>
  SLOT_META.map((s) => ({ ...s, ok: slotAccepts(s.slot, props.def.type) }))
)

// close the menu on any outside click
function onDocClick() {
  menuOpen.value = false
}
onMounted(() => document.addEventListener('pointerdown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocClick))

function setTimeframe(side, raw) {
  const cur = props.draft.timeframe || { from: null, to: null }
  const next = { ...cur, [side]: yearDate(raw) }
  emit('update', { timeframe: next.from == null && next.to == null ? null : next })
}

// ── menu actions ──────────────────────────────────────────────────────────────
const cfg = reactive({})
function openEditor() {
  Object.assign(cfg, {
    label: props.def.label,
    icon: props.def.icon,
    unit: props.def.unit,
    multiline: !!props.def.config.multiline,
    min: props.def.config.min,
    max: props.def.config.max,
    step: props.def.config.step,
    leftLabel: props.def.config.leftLabel || '',
    rightLabel: props.def.config.rightLabel || '',
    options: (props.def.config.options || []).map((o) => ({ color: '#6c8ef5', ...o }))
  })
  editing.value = true
  menuOpen.value = false
}

function addOption() {
  cfg.options.push({ id: `opt-${Date.now()}`, label: '', color: '#6c8ef5' })
}

async function saveConfig() {
  // JSON round-trip strips Vue reactivity — Proxies can't cross the IPC boundary.
  const config = JSON.parse(
    JSON.stringify({
      multiline: cfg.multiline,
      min: cfg.min,
      max: cfg.max,
      step: cfg.step,
      leftLabel: cfg.leftLabel,
      rightLabel: cfg.rightLabel,
      options: cfg.options?.filter((o) => o.label.trim())
    })
  )
  await store.updateFieldDef({
    id: props.def.id,
    label: cfg.label.trim() || props.def.label,
    icon: cfg.icon,
    unit: cfg.unit,
    config
  })
  editing.value = false
}

async function toggleLock() {
  menuOpen.value = false
  await store.updateFieldDef({ id: props.def.id, locked: !props.def.locked })
}

function toggleDisplay() {
  emit('update', { display_in_graph: !props.draft.display_in_graph })
}

async function applyAll() {
  const on = !props.draft.display_in_graph
  emit('update', { display_in_graph: on })
  menuOpen.value = false
  await store.applyFieldDisplayAll(props.def.id, on)
}

async function toggleTimeframe() {
  menuOpen.value = false
  await store.updateFieldDef({ id: props.def.id, has_timeframe: !props.def.has_timeframe })
}

async function moveToSlot(slot) {
  menuOpen.value = false
  await store.setFieldSlot(props.def.id, slot)
}

async function duplicate() {
  menuOpen.value = false
  await store.createFieldDef({
    label: `${props.def.label} copy`,
    type: props.def.type,
    config: JSON.parse(JSON.stringify(props.def.config)),
    icon: props.def.icon,
    unit: props.def.unit,
    locked: false
  })
}

function removeFromPerson() {
  menuOpen.value = false
  emit('remove-from-person')
}

async function deleteDef() {
  menuOpen.value = false
  const n = store.fieldValues.filter((v) => v.field_id === props.def.id).length
  const msg = n
    ? `Delete “${props.def.label}” and its values on ${n} ${n === 1 ? 'person' : 'people'}?`
    : `Delete “${props.def.label}”?`
  if (!confirm(msg)) return
  await store.deleteFieldDef(props.def.id)
}
</script>

<style scoped>
.fr {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 9px 8px 9px 4px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  position: relative;
  transition:
    background 0.15s,
    border-color 0.15s,
    box-shadow 0.2s;
}
.fr:hover,
.fr.menuOpen {
  background: var(--elevated);
  border-color: var(--border);
}

.fr-handle {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 5px;
  margin-top: 2px;
  border: none;
  background: transparent;
  cursor: grab;
  border-radius: 6px;
  opacity: 0;
  transition: opacity 0.15s;
  touch-action: none;
}
.fr:hover .fr-handle {
  opacity: 1;
}
.fr-handle:active {
  cursor: grabbing;
}
.fr-handle span {
  display: block;
  width: 12px;
  height: 2px;
  border-radius: 1px;
  background: var(--t3);
}
.fr-handle:hover span {
  background: var(--t2);
}

.fr-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fr-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.fr-icon {
  font-size: 12px;
}
.fr-label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--t2);
}
.fr-type {
  font-size: 9.5px;
  color: var(--t3);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 0 4px;
  line-height: 1.5;
}
.fr-lock {
  font-size: 9px;
  opacity: 0.7;
}
.fr-eye {
  font-size: 10px;
  color: var(--accent);
}

/* timeframe */
.fr-timeframe {
  display: flex;
  align-items: center;
  gap: 6px;
  animation: fr-slide 0.2s ease-out;
}
@keyframes fr-slide {
  from {
    transform: translateY(-4px);
    opacity: 0;
  }
}
.fr-tf-glyph {
  color: var(--t3);
  font-size: 12px;
}
.fr-tf-input {
  width: 72px;
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--elevated);
  color: var(--t1);
  outline: none;
}
.fr-tf-input:focus {
  border-color: var(--accent);
}
.fr-tf-dash {
  color: var(--t3);
}

/* config editor */
.fr-config {
  border: 1px dashed var(--border);
  border-radius: 10px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: color-mix(in srgb, var(--elevated) 55%, transparent);
}
.fr-cfg-enter-active,
.fr-cfg-leave-active {
  transition:
    opacity 0.18s,
    transform 0.18s;
}
.fr-cfg-enter-from,
.fr-cfg-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
.fr-cfg-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.fr-cfg-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 110px;
}
.fr-cfg-sm {
  flex: 0 0 64px;
  min-width: 64px;
}
.fr-cfg-field span {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--t3);
}
.fr-cfg-field input[type='text'],
.fr-cfg-field input[type='number'] {
  padding: 5px 8px;
  font-size: 11.5px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--t1);
  outline: none;
  width: 100%;
}
.fr-cfg-field input:focus {
  border-color: var(--accent);
}
.fr-cfg-check {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  min-width: auto;
  flex: 0 0 auto;
  padding-top: 14px;
}
.fr-cfg-check span {
  text-transform: none;
  letter-spacing: 0;
  font-size: 11px;
  font-weight: 500;
  color: var(--t2);
}

.fr-options {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.fr-opt-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.fr-opt-color {
  width: 22px;
  height: 22px;
  padding: 1px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  cursor: pointer;
  flex-shrink: 0;
}
.fr-opt-label {
  flex: 1;
  padding: 5px 8px;
  font-size: 11.5px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--t1);
  outline: none;
}
.fr-opt-label:focus {
  border-color: var(--accent);
}
.fr-opt-x {
  border: none;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  font-size: 10px;
}
.fr-opt-x:hover {
  color: #ef5350;
}
.fr-opt-add {
  align-self: flex-start;
  border: 1px dashed var(--border);
  background: transparent;
  color: var(--t2);
  border-radius: 6px;
  padding: 3px 9px;
  font-size: 11px;
  cursor: pointer;
}
.fr-opt-add:hover {
  color: var(--accent);
  border-color: var(--accent);
}
.fr-cfg-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

/* menu */
.fr-menu-anchor {
  position: relative;
  flex-shrink: 0;
}
.fr-menu-btn {
  border: none;
  background: transparent;
  color: var(--t3);
  font-size: 15px;
  line-height: 1;
  padding: 6px 8px;
  border-radius: 7px;
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 0.15s,
    background 0.12s;
}
.fr:hover .fr-menu-btn,
.fr.menuOpen .fr-menu-btn {
  opacity: 1;
}
.fr-menu-btn:hover {
  background: var(--hover);
  color: var(--t1);
}
.fr-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 30;
  min-width: 218px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 5px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
}
.fr-pop-enter-active {
  transition:
    opacity 0.16s,
    transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fr-pop-leave-active {
  transition: opacity 0.1s;
}
.fr-pop-enter-from {
  opacity: 0;
  transform: translateY(-6px) scale(0.96);
}
.fr-pop-leave-to {
  opacity: 0;
}
.fr-mi {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--t1);
  font-family: var(--font);
  font-size: 12px;
  padding: 7px 9px;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}
.fr-mi:hover {
  background: var(--hover);
}
.fr-mi i {
  font-style: normal;
  width: 16px;
  text-align: center;
  font-size: 11px;
  opacity: 0.85;
}
.fr-mi-hint {
  margin-left: auto;
  font-size: 9.5px;
  color: var(--t3);
}
.fr-mi-apply {
  margin-left: auto;
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--accent);
  font-size: 9.5px;
  font-weight: 600;
  border-radius: 999px;
  padding: 2px 8px;
  cursor: pointer;
}
.fr-mi-apply:hover {
  border-color: var(--accent);
}
.fr-mi-danger {
  color: #ef5350;
}
.fr-mi-danger:hover {
  background: rgba(239, 83, 80, 0.1);
}
.fr-mi-sep {
  height: 1px;
  background: var(--border);
  margin: 4px 6px;
}
.fr-mi-slots {
  padding: 4px 9px 6px;
}
.fr-mi-slots-label {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--t3);
}
.fr-mi-slot-chips {
  display: flex;
  gap: 5px;
  margin-top: 5px;
}
.fr-mi-slot {
  width: 30px;
  height: 26px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--elevated);
  color: var(--t1);
  cursor: pointer;
  font-size: 12px;
  transition:
    transform 0.14s cubic-bezier(0.34, 1.56, 0.64, 1),
    border-color 0.14s;
}
.fr-mi-slot:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: var(--accent);
}
.fr-mi-slot:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}
</style>
