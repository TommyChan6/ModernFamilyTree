<template>
  <div class="rtp-backdrop ink-veil" @click.self="$emit('close')">
    <div class="rtp ink-mount ink-unroll">
      <div class="rtp-head">
        <div class="rtp-title">{{ t('relTypesPanel.title') }}</div>
        <button
          class="icon-btn sm rtp-x"
          :title="t('relTypesPanel.close')"
          :aria-label="t('relTypesPanel.close')"
          @click="$emit('close')"
        >
          <UiIcon name="x" :size="16" />
        </button>
      </div>
      <div class="rtp-hint">
        {{ t('relTypesPanel.hint') }}
        <template v-if="store.caps.tuneAffinity">
          {{ t('relTypesPanel.hintAffinityPre') }} <b>{{ t('relTypesPanel.hintAffinityBold') }}</b>
          {{ t('relTypesPanel.hintAffinityPost') }}
        </template>
      </div>

      <div class="rtp-list">
        <div v-for="def in store.relTypes" :key="def.id" class="rtp-row">
          <div class="rtp-row-main">
            <span class="rtp-glyph" :style="{ color: swatchOf(def), '--rel-c': glyphColor(def) }">
              <template v-if="inkGlyphOf(def)">{{ inkGlyphOf(def) }}</template>
              <UiIcon v-else :name="def.glyph || 'diamond'" :size="16" />
            </span>
            <input
              class="rtp-label"
              :value="relTypeLabel(def)"
              @change="patch(def, { label: $event.target.value })"
            />
            <span v-if="def.directed" class="rtp-badge" :title="roleBadge(def)">
              {{ roleBadge(def) }}
            </span>
            <span v-else class="rtp-badge rtp-badge-sym">{{ t('relTypesPanel.symmetric') }}</span>
            <input
              class="rtp-color"
              type="color"
              :value="swatchOf(def)"
              :title="def.color ? t('relTypesPanel.typeColor') : t('relTypesPanel.styleColor')"
              @change="patch(def, { color: $event.target.value })"
            />
            <button
              v-if="!def.builtin"
              class="icon-btn sm rtp-del"
              :title="t('relTypesPanel.deleteType')"
              :aria-label="t('relTypesPanel.deleteTypeAria')"
              @click="removeDef(def)"
            >
              <UiIcon name="trash-2" :size="14" />
            </button>
            <span v-else class="rtp-builtin" :title="t('relTypesPanel.builtinHint')">
              <UiIcon name="lock" :size="14" :label="t('relTypesPanel.builtin')" />
            </span>
          </div>
          <div class="rtp-row-gen">
            <span class="rtp-w-label" :title="t('relTypesPanel.generationsHint')">
              {{ t('relTypesPanel.generations') }}
            </span>
            <div class="rtp-seg">
              <button
                v-for="opt in GEN_ROLES"
                :key="opt.role"
                class="rtp-seg-btn"
                :class="{ 'is-on': def.symmetryRole === opt.role }"
                :title="t('relTypesPanel.roles.' + opt.role + '.hint')"
                @click="patch(def, { symmetryRole: opt.role })"
              >
                <UiIcon :name="opt.icon" :size="14" />
                {{ t('relTypesPanel.roles.' + opt.role + '.label') }}
              </button>
            </div>
          </div>
          <div v-if="store.caps.tuneAffinity" class="rtp-row-weight">
            <span class="rtp-w-label">{{ t('relTypesPanel.repel') }}</span>
            <input
              class="rtp-slider"
              type="range"
              min="-1"
              max="1"
              step="0.05"
              :value="def.weight"
              @input="patchWeight(def, $event.target.value)"
            />
            <span class="rtp-w-label">{{ t('relTypesPanel.structural') }}</span>
            <span class="rtp-w-val">{{ def.weight.toFixed(2) }}</span>
          </div>
          <!-- Feeling: the type's default sentiment on the Dynamics ramp -->
          <div class="rtp-row-weight rtp-row-feel" :title="t('sentiment.typeFeelingHint')">
            <span class="rtp-w-label rtp-feel-label">{{ t('sentiment.feeling') }}</span>
            <span class="rtp-w-label">{{ t('sentiment.cold') }}</span>
            <FeelingSlider
              :model-value="typeSentiment(def)"
              :aria-label="t('sentiment.feelingAria')"
              @update:model-value="patchSentiment(def, $event)"
            />
            <span class="rtp-w-label">{{ t('sentiment.warm') }}</span>
            <span class="rtp-w-val">{{ fmtSigned(typeSentiment(def)) }}</span>
          </div>
        </div>
      </div>

      <!-- New custom type -->
      <div v-if="store.caps.customRelTypes" class="rtp-new">
        <div class="rtp-new-title">{{ t('relTypesPanel.newTitle') }}</div>
        <div class="rtp-new-grid">
          <input
            v-model="draft.label"
            class="rtp-input"
            :placeholder="t('relTypesPanel.labelPh')"
          />
          <button
            type="button"
            class="rtp-icon-btn"
            :class="{ open: iconPickerOpen }"
            :title="iconPickerOpen ? t('relTypesPanel.hideIcons') : t('relTypesPanel.chooseIcon')"
            :aria-label="t('relTypesPanel.chooseIcon')"
            :aria-expanded="iconPickerOpen"
            @click="toggleIconPicker"
          >
            <UiIcon :name="draft.glyph || 'diamond'" :size="16" :style="{ color: draft.color }" />
            <UiIcon name="chevron-down" :size="14" class="rtp-icon-caret" />
          </button>
          <input
            v-model="draft.color"
            type="color"
            class="rtp-color"
            :title="t('relTypesPanel.typeColor')"
          />
          <label class="rtp-check">
            <input v-model="draft.directed" type="checkbox" />
            {{ t('relTypesPanel.directed') }}
          </label>
          <template v-if="draft.directed">
            <input
              v-model="draft.role_a"
              class="rtp-input"
              :placeholder="t('relTypesPanel.roleAPh')"
            />
            <input
              v-model="draft.role_b"
              class="rtp-input"
              :placeholder="t('relTypesPanel.roleBPh')"
            />
          </template>
          <button class="btn btn-primary btn-sm" :disabled="!draft.label.trim()" @click="create">
            <UiIcon name="plus" :size="14" />
            {{ t('relTypesPanel.addType') }}
          </button>
        </div>
        <IconPicker
          v-if="iconPickerOpen"
          v-model="draft.glyph"
          class="rtp-icon-picker"
          :options="REL_ICON_OPTIONS"
          :aria-label="t('relTypesPanel.typeIcon')"
        />
        <div class="rtp-row-gen rtp-new-gen">
          <span class="rtp-w-label" :title="t('relTypesPanel.generationsHint')">
            {{ t('relTypesPanel.generations') }}
          </span>
          <div class="rtp-seg">
            <button
              v-for="opt in GEN_ROLES"
              :key="opt.role"
              class="rtp-seg-btn"
              :class="{ 'is-on': draft.symmetryRole === opt.role }"
              :title="t('relTypesPanel.roles.' + opt.role + '.hint')"
              @click="draft.symmetryRole = opt.role"
            >
              <UiIcon :name="opt.icon" :size="14" />
              {{ t('relTypesPanel.roles.' + opt.role + '.label') }}
            </button>
          </div>
        </div>
        <div v-if="store.caps.tuneAffinity" class="rtp-row-weight rtp-new-weight">
          <span class="rtp-w-label">{{ t('relTypesPanel.repel') }}</span>
          <input
            v-model.number="draft.weight"
            class="rtp-slider"
            type="range"
            min="-1"
            max="1"
            step="0.05"
          />
          <span class="rtp-w-label">{{ t('relTypesPanel.structural') }}</span>
          <span class="rtp-w-val">{{ draft.weight.toFixed(2) }}</span>
        </div>
        <div class="rtp-row-weight rtp-new-weight" :title="t('sentiment.typeFeelingHint')">
          <span class="rtp-w-label rtp-feel-label">{{ t('sentiment.feeling') }}</span>
          <span class="rtp-w-label">{{ t('sentiment.cold') }}</span>
          <FeelingSlider v-model="draft.sentiment" :aria-label="t('sentiment.feelingAria')" />
          <span class="rtp-w-label">{{ t('sentiment.warm') }}</span>
          <span class="rtp-w-val">{{ fmtSigned(draft.sentiment) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useMainStore } from '../store/index.js'
import { inkRelColor, inkRelGlyph } from './ui/inkChrome'
import { confirmDialog } from '../lib/dialogs.js'
import { translate as tr, useI18n } from '../i18n'
import { relTypeLabel, relRoleLabel } from '../lib/dataLabels'
import UiIcon from './ui/UiIcon.js'
import IconPicker from './ui/IconPicker.vue'
import FeelingSlider from './sentiment/FeelingSlider.vue'
import { clampSentiment, typeSentiment } from '../../../shared/sentiment'

defineEmits(['close'])
const store = useMainStore()
const { t } = useI18n()

/** 'Parent → Child' — the built-in roles translated until renamed. */
function roleBadge(def) {
  return `${relRoleLabel(def, 'a')} → ${relRoleLabel(def, 'b')}`
}

// Ink theme: each type is stamped with its brushed character (the same one the
// Relationships view shows) — calligraphy, drawn as text; otherwise its own
// icon (def.glyph is an icon name, or a legacy glyph UiIcon still resolves).
function inkGlyphOf(def) {
  return store.isInk ? inkRelGlyph(def.key, def.label) : ''
}

// Curated icons offered for a custom type (search widens to the full set).
const REL_ICON_OPTIONS = [
  'diamond',
  'heart',
  'heart-handshake',
  'heart-crack',
  'heart-pulse',
  'handshake',
  'users',
  'user',
  'baby',
  'hand-heart',
  'swords',
  'sword',
  'shield',
  'crown',
  'graduation-cap',
  'briefcase',
  'star',
  'sparkles',
  'flame',
  'skull',
  'ghost',
  'eye',
  'link',
  'key',
  'lock',
  'anchor',
  'gem',
  'arrow-right',
  'arrow-down',
  'corner-down-right'
]
const iconPickerOpen = ref(false)
function toggleIconPicker() {
  iconPickerOpen.value = !iconPickerOpen.value
}
function glyphColor(def) {
  return inkRelColor(def.key, swatchOf(def), store.isInk)
}

// The generational role a type plays in the generations layout. Maps 1:1 to
// RelationshipTypeDef.symmetryRole — the field the pure tree math reads.
// Labels/hints: relTypesPanel.roles.<role>.*
const GEN_ROLES = [
  { role: 'vertical', icon: 'arrow-down' },
  { role: 'horizontal', icon: 'arrow-left-right' },
  { role: 'none', icon: 'minus' }
]

// The legacy trio has color '' (the Style panel drives it) — show the Style
// panel's current color in the swatch; picking a color moves the type onto
// its own swatch.
function swatchOf(def) {
  if (def.color) return def.color
  const gs = store.graphSettings
  if (def.key === 'spouse') return gs.spouseColor
  if (def.key === 'adopted') return gs.adoptedColor
  return gs.parentChildColor
}

function patch(def, fields) {
  store.updateRelType({ id: def.id, ...fields })
}

let weightTimer = null
function patchWeight(def, val) {
  // Sliders fire per pixel — update the local copy live, persist debounced.
  const w = Math.max(-1, Math.min(1, Number(val) || 0))
  def.weight = w
  clearTimeout(weightTimer)
  weightTimer = setTimeout(() => store.updateRelType({ id: def.id, weight: w }), 300)
}

// Feeling (the Dynamics lens's default for this type): live locally, persisted
// debounced like the weight slider.
const sentimentTimers = new Map()
function patchSentiment(def, val) {
  const s = clampSentiment(val)
  def.sentiment = s
  clearTimeout(sentimentTimers.get(def.id))
  sentimentTimers.set(
    def.id,
    setTimeout(() => store.updateRelType({ id: def.id, sentiment: s }), 300)
  )
}
function fmtSigned(v) {
  return (v > 0 ? '+' : '') + v.toFixed(2)
}

async function removeDef(def) {
  const inUse = store.relationships.filter((r) => r.type === def.key).length
  const ok = await confirmDialog({
    title: tr('confirm.deleteRelType', { name: relTypeLabel(def) }),
    message:
      (inUse ? tr('confirm.deleteRelTypeBody', { count: inUse }) + ' ' : '') +
      tr('dialog.undoHint'),
    tone: 'danger'
  })
  if (!ok) return
  await store.deleteRelType(def.id)
}

const draft = reactive({
  label: '',
  glyph: 'diamond',
  color: '#8a93a6',
  directed: false,
  role_a: '',
  role_b: '',
  weight: 0,
  sentiment: 0,
  symmetryRole: 'none'
})

async function create() {
  if (!draft.label.trim()) return
  const res = await store.createRelType({
    label: draft.label,
    glyph: draft.glyph || 'diamond',
    color: draft.color,
    directed: draft.directed,
    role_a: draft.directed ? draft.role_a : '',
    role_b: draft.directed ? draft.role_b : '',
    weight: draft.weight,
    sentiment: draft.sentiment,
    symmetryRole: draft.symmetryRole
  })
  if (res.success) {
    draft.label = ''
    draft.role_a = ''
    draft.role_b = ''
    draft.weight = 0
    draft.sentiment = 0
    draft.directed = false
    draft.symmetryRole = 'none'
  }
}
</script>

<style scoped>
.rtp-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 120;
}
.rtp {
  width: min(640px, calc(100vw - 40px));
  max-height: calc(100vh - 80px);
  overflow: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 18px 20px;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.4);
}
.rtp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.rtp-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--t1);
}
.rtp-x {
  color: var(--t3);
}
.rtp-hint {
  font-size: 12.5px;
  color: var(--t2);
  margin-bottom: 14px;
  line-height: 1.5;
}
.rtp-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rtp-row {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 10px;
  background: var(--elevated);
}
.rtp-row-main {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rtp-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 15px;
  flex-shrink: 0;
}
.rtp-label {
  flex: 1;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--t1);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 7px;
}
.rtp-label:hover {
  border-color: var(--border);
}
.rtp-label:focus {
  border-color: var(--accent);
  background: var(--surface);
}
.rtp-badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--t3);
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 2px 8px;
  border-radius: 12px;
  white-space: nowrap;
}
.rtp-badge-sym {
  font-weight: 600;
}
.rtp-color {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
}
.rtp-del {
  color: var(--t3);
}
.rtp-del:hover:not(:disabled) {
  color: var(--danger);
  background: rgba(var(--danger-rgb), 0.12);
}
.rtp-builtin {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--ctl-sm);
  height: var(--ctl-sm);
  flex-shrink: 0;
  color: var(--t3);
}
.rtp-row-weight {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding-left: 30px;
}
.rtp-feel-label {
  min-width: 64px;
}
.rtp-row-gen {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding-left: 30px;
}
.rtp-seg {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--surface);
}
.rtp-seg-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: var(--ctl-sm);
  border: none;
  border-left: 1px solid var(--border);
  background: transparent;
  color: var(--t2);
  font-size: 12px;
  font-weight: 600;
  padding: 0 10px;
  cursor: pointer;
  white-space: nowrap;
}
.rtp-seg-btn:first-child {
  border-left: none;
}
.rtp-seg-btn:hover {
  background: var(--hover);
  color: var(--t1);
}
.rtp-seg-btn.is-on {
  background: var(--accent);
  color: var(--on-accent);
}
.rtp-w-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--t3);
  flex-shrink: 0;
}
.rtp-slider {
  flex: 1;
  min-width: 0;
  height: 22px;
  accent-color: var(--accent);
  background: transparent;
  border: none;
  padding: 0;
  box-shadow: none;
}
.rtp-w-val {
  font-size: 12px;
  font-weight: 700;
  color: var(--t2);
  width: 40px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.rtp-new {
  margin-top: 14px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}
.rtp-new-title {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--t3);
  margin-bottom: 8px;
}
.rtp-new-grid {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.rtp-input {
  height: var(--ctl-sm);
  padding: 0 9px;
  font-size: 13px;
  border-radius: 8px;
  flex: 1;
  min-width: 130px;
}
.rtp-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: var(--ctl-sm);
  padding: 0 8px;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--t2);
  cursor: pointer;
}
.rtp-icon-btn:hover,
.rtp-icon-btn.open {
  border-color: var(--border-strong);
  color: var(--t1);
}
.rtp-icon-caret {
  color: var(--t3);
  transition: transform var(--dur-fast) var(--ease-std);
}
.rtp-icon-btn.open .rtp-icon-caret {
  transform: rotate(180deg);
}
.rtp-icon-picker {
  margin-top: 10px;
}
.rtp-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--t2);
  white-space: nowrap;
  cursor: pointer;
}
.rtp-new-weight {
  padding-left: 0;
  margin-top: 10px;
}
.rtp-new-gen {
  padding-left: 0;
  margin-top: 10px;
}

/* ── 水墨 ink theme: a mounted sheet (.ink-mount/.ink-unroll); each type's
   glyph is its brushed character pressed as a small seal ──────────────── */
:root[data-theme='ink'] .rtp {
  border-radius: 2px;
}
:root[data-theme='ink'] .rtp-title {
  font-family: var(--font-brush);
  font-size: 24px;
  font-weight: 400;
}
:root[data-theme='ink'] .rtp-hint {
  font-style: italic;
}
:root[data-theme='ink'] .rtp-row {
  border-radius: 2px;
  border-color: rgba(48, 36, 20, 0.14);
  background: rgba(255, 251, 240, 0.45);
}
:root[data-theme='ink'] .rtp-glyph {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  font-family: var(--font-brush);
  font-size: 17px;
  color: #fbf4e6 !important;
  background: var(--rel-c);
  border-radius: 2px 4px 2px 5px;
  box-shadow: inset 0 0 0 1px rgba(251, 244, 230, 0.35);
  transform: rotate(-4deg);
}
:root[data-theme='ink'] .rtp-label,
:root[data-theme='ink'] .rtp-input,
:root[data-theme='ink'] .rtp-badge,
:root[data-theme='ink'] .rtp-seg,
:root[data-theme='ink'] .rtp-seg-btn,
:root[data-theme='ink'] .rtp-x,
:root[data-theme='ink'] .rtp-del,
:root[data-theme='ink'] .rtp-icon-btn {
  border-radius: 2px;
}
:root[data-theme='ink'] .rtp-label {
  font-family: var(--font-brush);
  font-size: 16px;
}
:root[data-theme='ink'] .rtp-badge {
  font-family: var(--font-ink-label);
  font-variant: small-caps;
  text-transform: lowercase;
}
:root[data-theme='ink'] .rtp-new {
  border-radius: 2px;
  background: rgba(214, 199, 166, 0.2);
}
:root[data-theme='ink'] .rtp-new-title {
  font-family: var(--font-brush);
  font-size: 18px;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0.02em;
}
</style>
