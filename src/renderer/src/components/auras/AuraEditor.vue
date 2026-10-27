<template>
  <div class="aura-ed" :style="{ '--aura-c': draft.color }">
    <AuraStage :aura="draft" />

    <!-- ── Who wears it (trait rules only) ── -->
    <section v-if="def" class="st-section ae-when">
      <h4 class="st-sec-title">{{ t('auras.when.title') }}</h4>
      <p v-if="def.type === 'boolean'" class="ae-fixed">
        <UiIcon name="square-check" :size="14" />{{ t('auras.when.checkedNote') }}
      </p>
      <template v-else>
        <div v-if="ops.length > 1" class="seg ae-ops" role="radiogroup">
          <button
            v-for="op in ops"
            :key="op"
            type="button"
            class="seg-btn"
            :class="{ active: draft.when.op === op }"
            role="radio"
            :aria-checked="draft.when.op === op"
            @click="setOp(op)"
          >
            {{ opLabel(op) }}
          </button>
        </div>

        <!-- select: one or more options -->
        <template v-if="draft.when.op === 'is' && def.type === 'select'">
          <div v-if="options.length" class="ae-chips">
            <button
              v-for="o in options"
              :key="o.id"
              type="button"
              class="ae-chip"
              :class="{ on: draft.when.values.includes(o.id) }"
              :aria-pressed="draft.when.values.includes(o.id)"
              @click="toggleOption(o.id)"
            >
              <i class="ae-chip-dot" :style="{ background: o.color || 'var(--t3)' }"></i>
              {{ optionLabel(o) }}
            </button>
          </div>
          <p v-else class="st-hint">{{ t('auras.when.noOptions') }}</p>
        </template>

        <!-- text: contains any of these words -->
        <template v-else-if="draft.when.op === 'is'">
          <div class="ae-word-row">
            <input
              v-model="wordDraft"
              class="ae-input"
              type="text"
              :placeholder="t('auras.when.containsPh')"
              :aria-label="t('auras.when.contains')"
              @keydown.enter.prevent="addWord"
            />
            <button
              type="button"
              class="btn btn-soft btn-sm"
              :disabled="!wordDraft.trim()"
              @click="addWord"
            >
              <UiIcon name="plus" :size="14" />{{ t('auras.when.addWord') }}
            </button>
          </div>
          <div v-if="draft.when.values.length" class="ae-chips">
            <span v-for="w in draft.when.values" :key="w" class="ae-chip on ae-word">
              {{ w }}
              <button
                type="button"
                class="ae-word-x"
                :title="t('auras.when.removeWord', { v: w })"
                :aria-label="t('auras.when.removeWord', { v: w })"
                @click="removeWord(w)"
              >
                <UiIcon name="x" :size="11" :stroke="2.4" />
              </button>
            </span>
          </div>
        </template>

        <!-- numbers / dates: a range -->
        <div v-else-if="draft.when.op === 'range'" class="ae-range">
          <label class="ae-bound">
            <span>{{ isDate ? t('auras.when.minYear') : t('auras.when.min') }}</span>
            <input
              class="ae-input"
              type="number"
              :value="draft.when.min ?? ''"
              :placeholder="boundPh('min')"
              @input="onBound('min', $event)"
              @keydown.enter="flush"
            />
          </label>
          <span class="ae-range-dash" aria-hidden="true">–</span>
          <label class="ae-bound">
            <span>{{ isDate ? t('auras.when.maxYear') : t('auras.when.max') }}</span>
            <input
              class="ae-input"
              type="number"
              :value="draft.when.max ?? ''"
              :placeholder="boundPh('max')"
              @input="onBound('max', $event)"
              @keydown.enter="flush"
            />
          </label>
        </div>

        <p v-if="incompleteHint" class="ae-warn">
          <UiIcon name="info" :size="13" />{{ incompleteHint }}
        </p>
        <StSwitch
          v-if="scalable"
          :label="t('auras.when.scale')"
          :hint="t('auras.when.scaleHint')"
          :model-value="!!draft.scale"
          @update:model-value="commit({ scale: $event })"
        />
      </template>
    </section>

    <!-- ── One-click looks ── -->
    <section class="st-section">
      <h4 class="st-sec-title">{{ t('auras.presets.title') }}</h4>
      <div class="ae-presets">
        <button
          v-for="(p, i) in AURA_PRESETS"
          :key="p.id"
          type="button"
          class="ae-preset"
          :class="{ on: currentPreset === p.id }"
          :style="{ '--pc': p.aura.color, '--i': i }"
          :aria-pressed="currentPreset === p.id"
          @click="applyPreset(p)"
        >
          <span class="ae-preset-ic"><UiIcon :name="p.icon" :size="15" /></span>
          {{ t(p.labelKey) }}
        </button>
      </div>
    </section>

    <!-- ── Ornament ── -->
    <section class="st-section">
      <h4 class="st-sec-title">{{ t('auras.ornament') }}</h4>
      <div class="ae-orns">
        <button
          v-for="(o, i) in ORNAMENTS"
          :key="o.id"
          type="button"
          class="ae-orn"
          :class="{ on: draft.ornament === o.id }"
          :style="{ '--i': i }"
          :title="t(o.hintKey)"
          :aria-pressed="draft.ornament === o.id"
          :disabled="
            o.id === 'none' && draft.ornament !== 'none' && wouldEmpty({ ornament: 'none' })
          "
          @click="pickOrnament(o.id)"
        >
          <span class="ae-orn-ic"><UiIcon :name="o.icon" :size="18" /></span>
          <span class="ae-orn-name">{{ t(o.labelKey) }}</span>
        </button>
      </div>
    </section>

    <section class="st-section">
      <StColor :label="t('auras.color')" :model-value="draft.color" @update:model-value="onColor">
        <template #lead><i class="ae-swatch" aria-hidden="true"></i></template>
      </StColor>
      <StSwitch
        :label="t('auras.tint')"
        :hint="t('auras.tintHint')"
        :model-value="draft.tint"
        :disabled="draft.tint && wouldEmpty({ tint: false })"
        @update:model-value="commit({ tint: $event })"
      />
    </section>

    <!-- ── Line effect ── -->
    <section class="st-section">
      <h4 class="st-sec-title">{{ t('auras.line') }}</h4>
      <div class="ae-lines">
        <button
          v-for="f in LINE_FX"
          :key="f.id"
          type="button"
          class="ae-line"
          :class="{ on: draft.line === f.id }"
          :title="t(f.hintKey)"
          :aria-pressed="draft.line === f.id"
          :disabled="f.id === 'none' && draft.line !== 'none' && wouldEmpty({ line: 'none' })"
          @click="commit({ line: f.id })"
        >
          <UiIcon :name="f.icon" :size="14" />
          <span class="ae-line-name">{{
            f.id === 'none' ? t('auras.noLine') : t(f.labelKey)
          }}</span>
        </button>
      </div>
      <p class="st-hint"><UiIcon name="spline" :size="13" />{{ t('auras.lineHint') }}</p>
    </section>
  </div>
</template>

<script setup>
// Edits one Aura (a tag's) or one TraitAura (a trait rule, when `def` is
// given). The live preview follows the local draft instantly; writes are
// emitted as 'update' with a plain-JSON copy — at once for clicks, and
// ~350 ms after the last change for drags and typing, so one gesture is one
// write (= one undo step). Incomplete conditions and looks that would draw
// nothing are held locally instead of being saved.
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from '../../i18n'
import UiIcon from '../ui/UiIcon.js'
import StColor from '../style/StColor.vue'
import StSwitch from '../style/StSwitch.vue'
import AuraStage from './AuraStage.vue'
import { LINE_FX } from '../graph/webgl/lineFx.js'
import { canScale, whenOpsFor } from '../../../../shared/auras'
import { optionLabel } from '../../lib/dataLabels'
import {
  AURA_PRESETS,
  ORNAMENTS,
  colorAfterOrnament,
  isEmptyLook,
  presetOf,
  whenComplete
} from './auraCatalog.js'

const props = defineProps({
  /** Aura { ornament, color, line, tint } or TraitAura (+ id, when, scale). */
  aura: { type: Object, required: true },
  /** The trait (FieldDef) for a trait rule; null for a tag's effect. */
  def: { type: Object, default: null }
})
const emit = defineEmits(['update'])
const { t } = useI18n()

const DEBOUNCE_MS = 350
const clone = (o) => JSON.parse(JSON.stringify(o))

function fromProp(a) {
  const d = clone(a)
  if (props.def) {
    d.when = d.when || { op: 'any', values: [], min: null, max: null }
    d.when.values = Array.isArray(d.when.values) ? d.when.values : []
    d.scale = !!d.scale
  }
  return d
}

const draft = reactive(fromProp(props.aura))
const wordDraft = ref('')
let timer = 0

// External changes (undo/redo, the sanitized write coming back) re-sync the
// draft — but never while an edit of ours is still waiting to be written.
watch(
  () => props.aura,
  (a) => {
    if (timer) return
    const next = fromProp(a)
    for (const k of Object.keys(draft)) if (!(k in next)) delete draft[k]
    Object.assign(draft, next)
  },
  { deep: true }
)

const ops = computed(() => (props.def ? whenOpsFor(props.def) : []))
const options = computed(() => props.def?.config?.options || [])
const isDate = computed(() => props.def?.type === 'date' || props.def?.type === 'date_range')
const scalable = computed(() => !!props.def && canScale(props.def))
const currentPreset = computed(() => presetOf(draft)?.id || '')

const incompleteHint = computed(() => {
  if (!props.def || whenComplete(draft.when)) return ''
  if (draft.when.op === 'range') return t('auras.when.needBound')
  if (props.def.type === 'select') return options.value.length ? t('auras.when.pickOptions') : ''
  return t('auras.when.needWord')
})

function opLabel(op) {
  if (op === 'any') return t('auras.when.any')
  if (op === 'range') return t('auras.when.range')
  return props.def?.type === 'select' ? t('auras.when.is') : t('auras.when.contains')
}

function wouldEmpty(patch) {
  return isEmptyLook({ ...draft, ...patch })
}

/** Apply a patch to the draft; write now, or once the gesture settles. */
function commit(patch, { soon = false } = {}) {
  Object.assign(draft, patch)
  clearTimeout(timer)
  timer = 0
  if (soon) timer = setTimeout(flush, DEBOUNCE_MS)
  else flush()
}

function flush() {
  clearTimeout(timer)
  timer = 0
  if (isEmptyLook(draft)) return
  if (props.def && !whenComplete(draft.when)) return
  const out = clone(draft)
  if (JSON.stringify(out) === JSON.stringify(fromProp(props.aura))) return
  emit('update', out)
}

function applyPreset(p) {
  commit({ ...p.aura })
}
function pickOrnament(id) {
  if (id === draft.ornament) return
  commit({ ornament: id, color: colorAfterOrnament(draft.ornament, id, draft.color) })
}
function onColor(hex) {
  commit({ color: hex }, { soon: true })
}

// ── condition ──
function setWhen(patch, opts) {
  commit({ when: { ...draft.when, ...patch } }, opts)
}
function setOp(op) {
  if (op === draft.when.op) return
  const keepValues = op === 'is' ? draft.when.values : []
  let values = keepValues
  // A select switching to "is one of" starts on its first option.
  if (op === 'is' && !values.length && props.def?.type === 'select' && options.value[0])
    values = [options.value[0].id]
  setWhen({
    op,
    values,
    min: op === 'range' ? draft.when.min : null,
    max: op === 'range' ? draft.when.max : null
  })
}
function toggleOption(id) {
  const has = draft.when.values.includes(id)
  setWhen({ values: has ? draft.when.values.filter((v) => v !== id) : [...draft.when.values, id] })
}
function addWord(e) {
  if (e?.isComposing) return // an IME's Enter confirms the composition
  const w = wordDraft.value.trim()
  if (!w) return
  wordDraft.value = ''
  const low = w.toLowerCase()
  if (draft.when.values.some((v) => v.toLowerCase() === low)) return
  setWhen({ values: [...draft.when.values, w] })
}
function removeWord(w) {
  setWhen({ values: draft.when.values.filter((v) => v !== w) })
}
function onBound(side, e) {
  const raw = e.target.value
  const n = raw === '' ? null : Number(raw)
  setWhen({ [side]: Number.isFinite(n) ? n : null }, { soon: true })
}
function boundPh(side) {
  if (isDate.value) return ''
  const v = props.def?.config?.[side]
  return v == null ? '' : String(v)
}

// Leaving mid-gesture still saves it.
onBeforeUnmount(() => {
  if (timer) flush()
})
</script>

<style scoped>
.aura-ed {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── condition ── */
.ae-fixed {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-size: 12px;
  color: var(--t2);
}
.ae-ops {
  display: flex;
  padding: 2px;
}
.ae-ops .seg-btn {
  flex: 1;
  min-width: 0;
  min-height: calc(var(--ctl-sm) - 6px);
  padding: 2px 6px;
  font-size: 11.5px;
}
.ae-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.ae-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: var(--ctl-xs);
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color var(--dur) ease,
    background var(--dur) ease,
    color var(--dur) ease;
}
.ae-chip:hover {
  border-color: var(--border-strong);
  color: var(--t1);
}
.ae-chip.on {
  color: var(--t1);
  border-color: var(--accent);
  background: rgba(var(--accent-rgb), 0.12);
}
.ae-chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}
.ae-word {
  cursor: default;
  padding-right: 4px;
}
.ae-word-x {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
}
.ae-word-x:hover {
  color: var(--danger);
}
.ae-word-row {
  display: flex;
  gap: 6px;
}
.ae-input {
  flex: 1;
  min-width: 0;
  height: var(--ctl-sm);
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12px;
  outline: none;
}
.ae-input:focus {
  border-color: var(--accent);
}
.ae-range {
  display: flex;
  align-items: flex-end;
  gap: 6px;
}
.ae-bound {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  color: var(--t3);
}
.ae-bound .ae-input {
  width: 100%;
  font-variant-numeric: tabular-nums;
}
.ae-range-dash {
  height: var(--ctl-sm);
  display: grid;
  place-items: center;
  color: var(--t3);
}
.ae-warn {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 11.5px;
  color: var(--t2);
}

/* ── presets: a wrap of pills, each lit in its own colour ── */
.ae-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.ae-preset {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: var(--ctl-sm);
  padding: 0 10px 0 4px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
  animation: st-pop-in 0.38s var(--ease-out) backwards;
  animation-delay: calc(var(--i) * 0.03s);
  transition:
    transform 0.22s var(--ease-spring),
    border-color var(--dur) ease,
    box-shadow var(--dur) ease,
    color var(--dur) ease;
}
.ae-preset-ic {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: var(--pc);
  background: color-mix(in srgb, var(--pc) 16%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--pc) 35%, transparent);
}
.ae-preset:hover {
  transform: translateY(-1px);
  color: var(--t1);
  border-color: var(--border-strong);
}
.ae-preset.on {
  color: var(--t1);
  border-color: var(--accent);
  box-shadow:
    0 0 0 1px var(--accent),
    0 4px 14px rgba(var(--accent-rgb), 0.22);
}

/* ── ornament tiles ── */
.ae-orns {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
}
.ae-orn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 8px 4px 6px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  cursor: pointer;
  animation: st-pop-in 0.38s var(--ease-out) backwards;
  animation-delay: calc(var(--i) * 0.02s);
  transition:
    transform 0.22s var(--ease-spring),
    border-color var(--dur) ease,
    box-shadow var(--dur) ease,
    color var(--dur) ease;
}
.ae-orn:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: var(--border-strong);
  color: var(--t1);
}
.ae-orn:disabled {
  cursor: not-allowed;
  color: var(--t3);
}
.ae-orn-ic {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  transition:
    color var(--dur) ease,
    background var(--dur) ease,
    box-shadow var(--dur) ease;
}
.ae-orn-name {
  max-width: 100%;
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ae-orn.on {
  color: var(--t1);
  border-color: var(--accent);
  box-shadow:
    0 0 0 1px var(--accent),
    0 5px 16px rgba(var(--accent-rgb), 0.22);
}
.ae-orn.on .ae-orn-ic {
  color: var(--aura-c);
  background: color-mix(in srgb, var(--aura-c) 16%, transparent);
  box-shadow: 0 0 14px color-mix(in srgb, var(--aura-c) 40%, transparent);
}

.ae-swatch {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--aura-c);
  box-shadow: 0 0 8px color-mix(in srgb, var(--aura-c) 60%, transparent);
}

/* ── line effects ── */
.ae-lines {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
}
.ae-line {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  height: var(--ctl-sm);
  padding: 0 9px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color var(--dur) ease,
    box-shadow var(--dur) ease,
    color var(--dur) ease;
}
.ae-line:hover:not(:disabled) {
  border-color: var(--border-strong);
  color: var(--t1);
}
.ae-line:disabled {
  cursor: not-allowed;
  color: var(--t3);
}
.ae-line.on {
  color: var(--t1);
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}
.ae-line-name {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (prefers-reduced-motion: reduce) {
  .ae-preset,
  .ae-orn {
    animation: none;
  }
}
</style>
