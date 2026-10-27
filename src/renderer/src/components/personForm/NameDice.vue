<template>
  <!-- Name dice: rolls an in-world name (lib/nameGen.ts) from a tag's own
       members or a culture corpus and fills the name slot. -->
  <div ref="rootEl" class="nd" :class="{ open }">
    <button
      class="nd-dice"
      :class="{ rolling }"
      type="button"
      :title="t('nameGen.dice')"
      :aria-label="t('nameGen.dice')"
      :aria-expanded="open"
      @click="onDice"
    >
      <UiIcon name="dices" :size="15" />
    </button>
    <Transition name="nd-pop">
      <div
        v-if="open"
        class="nd-pop"
        role="dialog"
        :aria-label="t('nameGen.title')"
        @keydown.esc.stop.prevent="close"
      >
        <div class="nd-head">
          <UiIcon class="nd-head-icon" name="dices" :size="14" />
          <span class="nd-title">{{ t('nameGen.title') }}</span>
          <button
            class="nd-x"
            type="button"
            :title="t('nameGen.close')"
            :aria-label="t('nameGen.close')"
            @click="close"
          >
            <UiIcon name="x" :size="14" />
          </button>
        </div>

        <label class="nd-src">
          <span class="nd-src-label">{{ t('nameGen.source') }}</span>
          <select :value="activeSource" @change="onSourceChange">
            <optgroup v-if="ownTagOptions.length" :label="t('nameGen.ownTags')">
              <option v-for="o in ownTagOptions" :key="o.id" :value="o.id">
                {{ t('nameGen.tagOption', { label: o.label, n: o.count }) }}
              </option>
            </optgroup>
            <optgroup v-if="otherTagOptions.length" :label="t('nameGen.otherTags')">
              <option v-for="o in otherTagOptions" :key="o.id" :value="o.id">
                {{ t('nameGen.tagOption', { label: o.label, n: o.count }) }}
              </option>
            </optgroup>
            <optgroup :label="t('nameGen.cultures')">
              <option v-for="c in NAME_CORPORA" :key="c.id" :value="`corpus:${c.id}`">
                {{ t(c.labelKey) }}
              </option>
            </optgroup>
          </select>
        </label>
        <div v-if="blendNote" class="nd-note">{{ blendNote }}</div>

        <div v-if="suggestions.length" class="nd-chips">
          <button
            v-for="(s, i) in suggestions"
            :key="s.full"
            class="chip nd-chip"
            :class="{ active: i === appliedIdx }"
            type="button"
            :style="{ '--i': i }"
            :title="t('nameGen.useName', { name: s.full })"
            @click="applySuggestion(s, i)"
          >
            {{ s.full }}
          </button>
        </div>
        <div v-else class="nd-empty">{{ t('nameGen.empty') }}</div>

        <div class="nd-foot">
          <span class="nd-sur">{{ surnameNote }}</span>
          <button class="btn btn-soft btn-xs nd-reroll" type="button" @click="reroll">
            <UiIcon name="refresh-cw" :size="12" />{{ t('nameGen.reroll') }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useMainStore } from '../../store/index.js'
import UiIcon from '../ui/UiIcon.js'
import { useI18n } from '../../i18n'
import {
  closestCorpus,
  detectSurnameFirst,
  genderFromT,
  splitFullName,
  suggestNames
} from '../../lib/nameGen'
import { NAME_CORPORA, DEFAULT_CORPUS_ID, corpusById } from '../../lib/nameCorpora'

const props = defineProps({
  /** The name-slot defs, in slot order. */
  nameDefs: { type: Array, required: true },
  /** The form's live gender gradient position (null = unknown). */
  genderT: { type: Number, default: null },
  /** { selfId, parentIds, tagIds } from the form's current state. */
  context: { type: Object, default: () => ({ selfId: null, parentIds: [], tagIds: [] }) }
})
const emit = defineEmits(['apply'])
const { t } = useI18n()
const store = useMainStore()

const rootEl = ref(null)
const open = ref(false)
const rolling = ref(false)
const suggestions = ref([])
const appliedIdx = ref(-1)
let rollNo = 0

// ── remembered source, per project (a per-viewer convenience) ──────────────
const STORE_KEY = 'familytree.nameGen.source'
function loadSaved() {
  try {
    const all = JSON.parse(localStorage.getItem(STORE_KEY) || '{}')
    return (all && typeof all === 'object' && all[store.activeProjectId]) || null
  } catch {
    return null
  }
}
function saveSource(src) {
  try {
    const all = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}
    all[store.activeProjectId] = src
    localStorage.setItem(STORE_KEY, JSON.stringify(all))
  } catch {
    /* storage blocked — the choice just isn't remembered */
  }
}
const chosen = ref(null)

// ── sources ─────────────────────────────────────────────────────────────────
const personById = computed(() => new Map(store.persons.map((p) => [p.id, p])))
const selfId = computed(() => props.context?.selfId || null)
const parentIds = computed(() => props.context?.parentIds || [])

/** Members of a tag (minus this person) that have a name. */
function namedMembers(tagId) {
  return (store.membersOf.get(tagId) || [])
    .filter((id) => id !== selfId.value)
    .map((id) => personById.value.get(id))
    .filter((p) => p && p.name && p.name.trim())
}

const tagOptions = computed(() => {
  const own = new Set(props.context?.tagIds || [])
  for (const pid of parentIds.value) {
    for (const tag of store.tagsOf.get(pid) || []) own.add(tag.id)
  }
  const out = []
  for (const tag of store.tags) {
    const count = namedMembers(tag.id).length
    if (!count) continue
    out.push({ id: `tag:${tag.id}`, tagId: tag.id, label: tag.label, count, own: own.has(tag.id) })
  }
  return out.sort((a, b) => a.label.localeCompare(b.label))
})
const ownTagOptions = computed(() => tagOptions.value.filter((o) => o.own))
const otherTagOptions = computed(() => tagOptions.value.filter((o) => !o.own))

function isValidSource(src) {
  if (!src) return false
  if (src.startsWith('corpus:')) return !!corpusById(src.slice(7))
  return tagOptions.value.some((o) => o.id === src)
}

const activeSource = computed(() => {
  if (isValidSource(chosen.value)) return chosen.value
  const saved = loadSaved()
  if (isValidSource(saved)) return saved
  if (ownTagOptions.value.length) return ownTagOptions.value[0].id
  return `corpus:${DEFAULT_CORPUS_ID}`
})

/** The source as generator input: { corpus, tag, sampleCount }. */
function resolveSource(src) {
  if (src.startsWith('tag:')) {
    const members = namedMembers(src.slice(4))
    const fulls = members.map((p) => p.name.trim())
    const corpus = closestCorpus(fulls, NAME_CORPORA) || corpusById(DEFAULT_CORPUS_ID)
    const surnameFirst =
      detectSurnameFirst(fulls) ?? projectSurnameFirst.value ?? !!corpus.surnameFirst
    const given = []
    const surnames = []
    for (const p of members) {
      const parts = splitFullName(p.name, surnameFirst)
      if (parts.given) given.push({ name: parts.given, gender: genderFromT(p.gender_t) })
      if (parts.surname) surnames.push(parts.surname)
    }
    return { corpus, tag: { given, surnames, surnameFirst }, sampleCount: given.length }
  }
  return {
    corpus: corpusById(src.slice(7)) || corpusById(DEFAULT_CORPUS_ID),
    tag: null,
    sampleCount: 0
  }
}

const resolved = computed(() => resolveSource(activeSource.value))

const blendNote = computed(() => {
  const r = resolved.value
  if (!r.tag) return ''
  return t('nameGen.blendNote', { n: r.sampleCount, culture: t(r.corpus.labelKey) })
})

const surnameNote = computed(() => {
  const from = suggestions.value[0]?.surnameFrom
  return from && from !== 'none' ? t(`nameGen.surnameFrom.${from}`) : ''
})

// ── rolling ─────────────────────────────────────────────────────────────────
// The order this project's people are written in ("Sarah Anderson" vs
// "Wang Fang") — parents are split by it, not by the chosen culture's order.
const projectSurnameFirst = computed(() =>
  detectSurnameFirst(store.persons.map((p) => p.name || ''))
)

function parentsFor(surnameFirst) {
  return parentIds.value
    .map((id) => personById.value.get(id))
    .filter((p) => p && p.name)
    .map((p) => ({ ...splitFullName(p.name, surnameFirst), gender: genderFromT(p.gender_t) }))
}

function roll() {
  const { corpus, tag } = resolved.value
  const surnameFirst = tag?.surnameFirst ?? !!corpus.surnameFirst
  const familyOrder = projectSurnameFirst.value ?? surnameFirst
  const inUse = store.persons
    .filter((p) => p.id !== selfId.value && p.name)
    .map((p) => splitFullName(p.name, familyOrder).given)
  suggestions.value = suggestNames({
    corpus,
    tag,
    gender: genderFromT(props.genderT),
    parents: parentsFor(familyOrder),
    familySurnameFirst: familyOrder,
    count: 6,
    seed: `${Date.now()}:${rollNo++}`,
    exclude: inUse
  })
  appliedIdx.value = -1
  rolling.value = false
  requestAnimationFrame(() => (rolling.value = true))
}

/** Write a suggestion into the name slot: one def takes the full name; with
 *  several, the first and last take the two parts in the culture's order. */
function applySuggestion(s, idx) {
  const defs = props.nameDefs
  if (!s || !defs.length) return
  const updates = []
  if (defs.length === 1) {
    updates.push({ fieldId: defs[0].id, value: s.full })
  } else {
    const first = s.surnameFirst ? s.surname : s.given
    const last = s.surnameFirst ? s.given : s.surname
    if (first) updates.push({ fieldId: defs[0].id, value: first })
    if (last) updates.push({ fieldId: defs[defs.length - 1].id, value: last })
  }
  appliedIdx.value = idx
  emit('apply', updates)
}

function onDice() {
  roll()
  applySuggestion(suggestions.value[0], 0)
  open.value = true
}

function reroll() {
  roll()
}

function onSourceChange(e) {
  chosen.value = e.target.value
  saveSource(e.target.value)
  roll()
}

function close() {
  open.value = false
}

function onDocPointer(e) {
  if (open.value && rootEl.value && !rootEl.value.contains(e.target)) close()
}
onMounted(() => document.addEventListener('pointerdown', onDocPointer))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointer))
</script>

<style scoped>
.nd {
  position: relative;
  flex-shrink: 0;
}
.nd-dice {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--ctl-xs);
  height: var(--ctl-xs);
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--elevated);
  color: var(--t2);
  cursor: pointer;
  transition:
    color var(--dur) ease,
    border-color var(--dur) ease,
    background var(--dur) ease;
}
.nd-dice:hover,
.nd.open .nd-dice {
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.45);
  background: var(--adim);
}
.nd-dice.rolling :deep(.ui-icon) {
  animation: nd-roll 0.45s var(--ease-out);
}
@keyframes nd-roll {
  0% {
    transform: rotate(0deg) scale(1);
  }
  45% {
    transform: rotate(200deg) scale(1.15);
  }
  100% {
    transform: rotate(360deg) scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .nd-dice.rolling :deep(.ui-icon),
  .nd-chip {
    animation: none !important;
  }
}

.nd-pop {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 40;
  width: 300px;
  max-width: min(300px, calc(100vw - 32px));
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.nd-pop-enter-active {
  transition:
    opacity 0.16s,
    transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.nd-pop-leave-active {
  transition: opacity 0.1s;
}
.nd-pop-enter-from {
  opacity: 0;
  transform: translateY(-6px) scale(0.96);
}
.nd-pop-leave-to {
  opacity: 0;
}

.nd-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.nd-head-icon {
  color: var(--accent);
}
.nd-title {
  flex: 1;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--t1);
}
.nd-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
}
.nd-x:hover {
  color: var(--t1);
  background: var(--hover);
}

.nd-src {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.nd-src-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--t3);
}
.nd-src select {
  width: 100%;
  height: var(--ctl-md);
  padding-top: 0;
  padding-bottom: 0;
  font-size: 12.5px;
  line-height: calc(var(--ctl-md) - 2px);
}
.nd-note {
  font-size: 11.5px;
  color: var(--t2);
  line-height: 1.4;
}

.nd-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.nd-chip {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--t1);
  animation: nd-chip-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  animation-delay: calc(var(--i, 0) * 30ms);
}
@keyframes nd-chip-in {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.94);
  }
}
.nd-empty {
  font-size: 12px;
  color: var(--t3);
  font-style: italic;
}

.nd-foot {
  display: flex;
  align-items: center;
  gap: 8px;
}
.nd-sur {
  flex: 1;
  min-width: 0;
  font-size: 11.5px;
  color: var(--t3);
}
.nd-reroll {
  gap: 5px;
}

/* ── 水墨 ink theme: a paper slip with a mounted edge ────────────────────── */
:root[data-theme='ink'] .nd-dice,
:root[data-theme='ink'] .nd-x {
  border-radius: 2px;
}
:root[data-theme='ink'] .nd-pop {
  border-radius: 2px;
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  border-color: var(--ink-mount-line);
  box-shadow:
    0 0 0 2px var(--ink-silk),
    var(--shadow);
}
:root[data-theme='ink'] .nd-title {
  font-family: var(--font-ink-label);
  font-weight: 600;
  font-size: 13px;
}
:root[data-theme='ink'] .nd-src-label {
  font-family: var(--font-ink-label);
  font-variant: small-caps;
  text-transform: lowercase;
  letter-spacing: 0.12em;
  font-size: 12px;
}

/* ── Medieval theme: a vellum slip ───────────────────────────────────────── */
:root[data-theme='medieval'] .nd-pop {
  border-radius: 4px;
}
:root[data-theme='medieval'] .nd-title {
  font-family: var(--font-caps, var(--font));
  letter-spacing: 0.06em;
}
</style>
