<template>
  <div class="fr" :class="{ locked: def.locked, menuOpen }">
    <!-- grab handle -->
    <button
      class="fr-handle"
      type="button"
      :title="t('personForm.row.dragHint')"
      @pointerdown.prevent="emit('drag-start', $event)"
    >
      <span></span><span></span>
    </button>

    <div class="fr-main">
      <div class="fr-head">
        <UiIcon v-if="def.icon" class="fr-icon" :name="def.icon" :size="14" />
        <span class="fr-label">{{ fieldLabel(def) }}</span>
        <span class="fr-type" :title="meta.label"><UiIcon :name="meta.icon" :size="12" /></span>
        <span v-if="def.locked" class="fr-lock" :title="t('personForm.row.templateHint')">
          <UiIcon name="lock" :size="12" />
        </span>
        <span
          v-if="draft.display_in_graph"
          class="fr-eye"
          :title="t('personForm.row.shownInGraph')"
        >
          <UiIcon name="eye" :size="13" />
        </span>
      </div>

      <FieldInput
        :def="def"
        :model-value="draft.value"
        @update:model-value="emit('update', { value: $event })"
      />

      <!-- timeframe (Advanced) -->
      <div v-if="def.has_timeframe && advanced" class="fr-timeframe">
        <span class="fr-tf-glyph" :title="t('personForm.row.timeframeHint')">
          <UiIcon name="hourglass" :size="14" />
        </span>
        <input
          class="fr-tf-input"
          type="number"
          :placeholder="t('personForm.input.from')"
          :value="draft.timeframe?.from?.year ?? ''"
          @input="setTimeframe('from', $event.target.value)"
        />
        <span class="fr-tf-dash">–</span>
        <input
          class="fr-tf-input"
          type="number"
          :placeholder="t('personForm.input.to')"
          :value="draft.timeframe?.to?.year ?? ''"
          @input="setTimeframe('to', $event.target.value)"
        />
      </div>

      <!-- inline trait config editor -->
      <Transition name="fr-cfg">
        <div v-if="editing" class="fr-config">
          <div class="fr-cfg-grid">
            <label class="fr-cfg-field">
              <span>{{ t('personForm.row.label') }}</span>
              <input v-model="cfg.label" type="text" />
            </label>
            <label v-if="hasUnit" class="fr-cfg-field fr-cfg-sm">
              <span>{{ t('personForm.row.unit') }}</span>
              <input v-model="cfg.unit" type="text" maxlength="8" placeholder="cm" />
            </label>
            <label v-if="def.type === 'text'" class="fr-cfg-field fr-cfg-check">
              <input v-model="cfg.multiline" type="checkbox" />
              <span>{{ t('personForm.row.multiline') }}</span>
            </label>
            <template v-if="hasMinMax">
              <label class="fr-cfg-field fr-cfg-sm">
                <span>{{ t('personForm.row.min') }}</span
                ><input v-model.number="cfg.min" type="number" />
              </label>
              <label class="fr-cfg-field fr-cfg-sm">
                <span>{{ t('personForm.row.max') }}</span
                ><input v-model.number="cfg.max" type="number" />
              </label>
              <label class="fr-cfg-field fr-cfg-sm">
                <span>{{ t('personForm.row.step') }}</span
                ><input v-model.number="cfg.step" type="number" />
              </label>
            </template>
            <template v-if="def.type === 'slider' || def.type === 'boolean'">
              <label class="fr-cfg-field">
                <span>{{ t('personForm.row.leftLabel') }}</span
                ><input v-model="cfg.leftLabel" type="text" />
              </label>
              <label class="fr-cfg-field">
                <span>{{ t('personForm.row.rightLabel') }}</span
                ><input v-model="cfg.rightLabel" type="text" />
              </label>
            </template>
            <div class="fr-cfg-field fr-cfg-icon">
              <span>{{ t('personForm.row.icon') }}</span>
              <IconPicker
                v-model="cfg.icon"
                :options="TRAIT_ICONS"
                allow-none
                :aria-label="t('personForm.row.traitIcon')"
              />
            </div>
          </div>

          <!-- select options editor -->
          <div v-if="def.type === 'select'" class="fr-options">
            <div v-for="(opt, i) in cfg.options" :key="i" class="fr-opt-row">
              <input
                v-model="opt.color"
                type="color"
                class="fr-opt-color"
                :title="t('personForm.row.optionColor')"
              />
              <input
                v-model="opt.label"
                type="text"
                class="fr-opt-label"
                :placeholder="t('personForm.row.optionPh')"
              />
              <button
                class="fr-opt-x"
                type="button"
                :title="t('personForm.row.removeOption')"
                :aria-label="t('personForm.row.removeOption')"
                @click="cfg.options.splice(i, 1)"
              >
                <UiIcon name="x" :size="14" />
              </button>
            </div>
            <button class="fr-opt-add" type="button" @click="addOption">
              <UiIcon name="plus" :size="14" />
              {{ t('personForm.row.addOption') }}
            </button>
          </div>

          <div class="fr-cfg-actions">
            <button class="btn btn-ghost btn-sm" type="button" @click="editing = false">
              {{ t('dialog.cancel') }}
            </button>
            <button class="btn btn-primary btn-sm" type="button" @click="saveConfig">
              {{ t('personForm.row.apply') }}
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- options menu -->
    <div class="fr-menu-anchor">
      <button
        class="fr-menu-btn"
        type="button"
        :title="t('personForm.row.options')"
        :aria-label="t('personForm.row.options')"
        @pointerdown.stop
        @click.stop="menuOpen = !menuOpen"
      >
        <UiIcon name="ellipsis" :size="16" />
      </button>
      <Transition name="fr-pop">
        <div v-if="menuOpen" class="fr-menu" @pointerdown.stop @click.stop>
          <button class="fr-mi" @click="openEditor">
            <UiIcon class="fr-mi-ic" name="pencil" :size="14" />{{ t('personForm.row.editTrait')
            }}<span class="fr-mi-hint">{{ t('personForm.row.editTraitHint') }}</span>
          </button>
          <button class="fr-mi" @click="toggleLock">
            <UiIcon class="fr-mi-ic" :name="def.locked ? 'lock-open' : 'lock'" :size="14" />{{
              def.locked ? t('personForm.row.unlock') : t('personForm.lock')
            }}
            <span class="fr-mi-hint">{{
              def.locked
                ? t('personForm.row.thisPersonOnly', { noun: nounLabel(store.noun).toLowerCase() })
                : t('personForm.row.onEveryForm')
            }}</span>
          </button>
          <div class="fr-mi" role="button" tabindex="0" @click="toggleDisplay">
            <UiIcon
              class="fr-mi-ic"
              :name="draft.display_in_graph ? 'eye' : 'eye-off'"
              :size="14"
            />{{ t('personForm.row.showInGraph') }}
            <button
              v-if="def.locked"
              class="fr-mi-apply"
              type="button"
              :title="t('personForm.row.applyAllHint')"
              @click.stop="applyAll"
            >
              {{ t('personForm.row.applyAll') }}
            </button>
          </div>
          <button v-if="advanced" class="fr-mi" @click="toggleTimeframe">
            <UiIcon class="fr-mi-ic" name="hourglass" :size="14" />{{
              def.has_timeframe
                ? t('personForm.row.removeTimeframe')
                : t('personForm.row.setTimeframe')
            }}
          </button>
          <div class="fr-mi-sep"></div>
          <div class="fr-mi-slots">
            <span class="fr-mi-slots-label">{{ t('personForm.row.moveToSlot') }}</span>
            <div class="fr-mi-slot-chips">
              <button
                v-for="s in slotTargets"
                :key="s.slot"
                class="fr-mi-slot"
                :disabled="!s.ok"
                :title="s.ok ? s.label : t('personForm.row.slotRejects', { type: meta.label })"
                :aria-label="s.label"
                @click="moveToSlot(s.slot)"
              >
                <UiIcon :name="s.icon" :size="14" />
              </button>
            </div>
          </div>
          <div class="fr-mi-sep"></div>
          <button class="fr-mi" @click="duplicate">
            <UiIcon class="fr-mi-ic" name="copy" :size="14" />{{ t('personForm.row.duplicate') }}
          </button>
          <button v-if="!def.locked && attached" class="fr-mi" @click="removeFromPerson">
            <UiIcon class="fr-mi-ic" name="circle-minus" :size="14" />{{
              t('personForm.row.removeFromThis', { noun: nounLabel(store.noun).toLowerCase() })
            }}
          </button>
          <button class="fr-mi fr-mi-danger" @click="deleteDef">
            <UiIcon class="fr-mi-ic" name="trash-2" :size="14" />{{
              t('personForm.row.deleteTrait')
            }}
          </button>
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
import UiIcon from '../ui/UiIcon.js'
import IconPicker from '../ui/IconPicker.vue'
import { confirmDialog } from '../../lib/dialogs.js'
import { translate as tr, useI18n } from '../../i18n'
import { fieldLabel, nounLabel } from '../../lib/dataLabels'

const props = defineProps({
  def: { type: Object, required: true },
  draft: { type: Object, required: true }, // { value, display_in_graph, timeframe }
  advanced: { type: Boolean, default: false },
  attached: { type: Boolean, default: false }
})
const emit = defineEmits(['update', 'drag-start', 'remove-from-person'])
const { t } = useI18n()

// Curated trait icons for the config editor (search widens to every icon).
const TRAIT_ICONS = [
  'star',
  'heart',
  'briefcase',
  'map-pin',
  'house',
  'graduation-cap',
  'book-open',
  'church',
  'crown',
  'shield',
  'swords',
  'gem',
  'coins',
  'trophy',
  'music',
  'palette',
  'ruler',
  'eye',
  'brain',
  'dna',
  'heart-pulse',
  'flag',
  'globe',
  'sparkles',
  'flame',
  'leaf',
  'sun',
  'moon',
  'calendar',
  'clock',
  'user'
]

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
    label: t('personForm.row.copyName', { name: fieldLabel(props.def) }),
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
  const ok = await confirmDialog({
    title: tr('confirm.deleteTrait', { name: fieldLabel(props.def) }),
    message: (n ? tr('confirm.deleteTraitBody', { count: n }) + ' ' : '') + tr('dialog.undoHint'),
    tone: 'danger'
  })
  if (!ok) return
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
  flex-shrink: 0;
  color: var(--t2);
}
.fr-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--t2);
}
.fr-type {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  min-width: 20px;
  color: var(--t3);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 0 3px;
}
.fr-lock,
.fr-eye {
  display: inline-flex;
  align-items: center;
  color: var(--t3);
}
.fr-eye {
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
  display: inline-flex;
  align-items: center;
  color: var(--t3);
}
.fr-tf-input {
  width: 72px;
  padding: 4px 8px;
  font-size: 12px;
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
.fr-cfg-icon {
  flex: 1 0 100%;
}
.fr-cfg-field > span {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--t3);
}
.fr-cfg-field input[type='text'],
.fr-cfg-field input[type='number'] {
  padding: 5px 8px;
  font-size: 12.5px;
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
.fr-cfg-check > span {
  text-transform: none;
  letter-spacing: 0;
  font-size: 12px;
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
  width: 26px;
  height: 26px;
  padding: 1px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  cursor: pointer;
  flex-shrink: 0;
}
.fr-opt-label {
  flex: 1;
  height: 26px;
  padding: 0 8px;
  font-size: 12.5px;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
}
.fr-opt-x:hover {
  background: rgba(var(--danger-rgb), 0.1);
  color: var(--danger);
}
.fr-opt-add {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  border: 1px dashed var(--border);
  background: transparent;
  color: var(--t2);
  border-radius: 6px;
  padding: 0 10px;
  font-family: var(--font);
  font-size: 12px;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--ctl-sm);
  height: var(--ctl-sm);
  border: none;
  background: transparent;
  color: var(--t3);
  padding: 0;
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
  min-width: 240px;
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
  font-size: 12.5px;
  padding: 7px 9px;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}
.fr-mi:hover {
  background: var(--hover);
}
.fr-mi-ic {
  flex-shrink: 0;
  color: var(--t2);
}
.fr-mi-danger .fr-mi-ic {
  color: inherit;
}
.fr-mi-hint {
  margin-left: auto;
  padding-left: 8px;
  font-size: 12px;
  color: var(--t3);
}
.fr-mi-apply {
  margin-left: auto;
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--accent);
  font-family: var(--font);
  font-size: 11.5px;
  font-weight: 600;
  border-radius: 999px;
  padding: 2px 9px;
  cursor: pointer;
}
.fr-mi-apply:hover {
  border-color: var(--accent);
}
.fr-mi-danger {
  color: var(--danger);
}
.fr-mi-danger:hover {
  background: rgba(var(--danger-rgb), 0.1);
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
  font-size: 11px;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  width: 30px;
  height: var(--ctl-sm);
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--elevated);
  color: var(--t1);
  cursor: pointer;
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

/* ── 水墨 ink theme: rows bloom on hover; the drag handle is three strokes ── */
:root[data-theme='ink'] .fr {
  border-radius: 2px;
}
:root[data-theme='ink'] .fr:hover,
:root[data-theme='ink'] .fr.menuOpen {
  background: rgba(214, 199, 166, 0.22);
  border-color: rgba(48, 36, 20, 0.12);
}
:root[data-theme='ink'] .fr-handle span {
  border-radius: 1px 3px 1px 2px;
  height: 2.5px;
}
:root[data-theme='ink'] .fr-label {
  font-size: 13px;
  color: var(--t1);
}
:root[data-theme='ink'] .fr-type,
:root[data-theme='ink'] .fr-menu,
:root[data-theme='ink'] .fr-menu-btn,
:root[data-theme='ink'] .fr-mi,
:root[data-theme='ink'] .fr-mi-slot {
  border-radius: 2px;
}
:root[data-theme='ink'] .fr-menu {
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  border-color: var(--ink-mount-line);
  box-shadow:
    0 0 0 2px var(--ink-silk),
    0 0 0 3px rgba(58, 42, 22, 0.2),
    var(--shadow);
}
</style>
