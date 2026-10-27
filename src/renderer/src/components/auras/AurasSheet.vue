<template>
  <div ref="rootEl" class="auras-sheet">
    <p class="st-note">{{ t('auras.intro') }}</p>

    <!-- ── Empty state ── -->
    <div v-if="!cards.length && !adding" class="as-empty">
      <div class="as-empty-art" aria-hidden="true">
        <span
          v-for="(o, i) in EMPTY_ART"
          :key="o.icon"
          class="as-empty-orb"
          :style="orbStyle(o, i)"
        >
          <UiIcon :name="o.icon" :size="i === 1 ? 22 : 17" />
        </span>
      </div>
      <h4>{{ t('auras.empty.title') }}</h4>
      <p>{{ t('auras.empty.body') }}</p>
      <button type="button" class="btn btn-primary btn-sm" @click="openAdd">
        <UiIcon name="sparkles" :size="14" />{{ t('auras.empty.cta') }}
      </button>
    </div>

    <!-- ── Active effects ── -->
    <section v-if="cards.length" class="st-section">
      <div class="as-head">
        <h4 class="st-sec-title">{{ t('auras.active') }}</h4>
        <span class="as-head-n">{{ savedCount }}</span>
        <button
          v-if="!adding"
          type="button"
          class="btn btn-soft btn-xs as-add-btn"
          @click="openAdd"
        >
          <UiIcon name="plus" :size="13" />{{ t('auras.add') }}
        </button>
      </div>
      <TransitionGroup name="as-card" tag="div" class="as-cards">
        <article
          v-for="c in cards"
          :key="c.key"
          class="as-card"
          :class="{ open: expanded === c.key, draft: c.draft }"
          :data-key="c.key"
          :style="{ '--aura-c': c.aura.color }"
        >
          <div class="asc-row">
            <button
              type="button"
              class="asc-head"
              :aria-expanded="expanded === c.key"
              :title="expanded === c.key ? t('auras.collapse') : t('auras.edit')"
              @click="toggle(c.key)"
            >
              <span class="asc-orn"><UiIcon :name="ornIcon(c.aura)" :size="16" /></span>
              <span class="asc-main">
                <span class="asc-src">
                  <template v-if="c.kind === 'tag'">
                    <i class="asc-tagdot" :style="{ background: c.tag.color }"></i>
                    <span class="asc-name">{{ defaultNameLabel(c.tag.label) }}</span>
                  </template>
                  <template v-else>
                    <UiIcon class="asc-trait-ic" :name="traitIcon(c.def)" :size="13" />
                    <span class="asc-name">{{ fieldLabel(c.def) }}</span>
                  </template>
                </span>
                <span class="asc-sub">
                  <span class="asc-cond">{{ subline(c) }}</span>
                  <span v-if="c.draft" class="asc-draft">{{ t('auras.draft') }}</span>
                  <span v-else class="asc-count" :class="{ zero: !countOf(c) }">
                    <UiIcon name="users" :size="11" />{{ bearers(countOf(c)) }}
                  </span>
                </span>
              </span>
              <UiIcon class="asc-chev" name="chevron-down" :size="15" />
            </button>
            <button
              type="button"
              class="asc-remove"
              :title="c.draft ? t('auras.discard') : t('auras.remove')"
              :aria-label="c.draft ? t('auras.discard') : t('auras.remove')"
              @click="remove(c)"
            >
              <UiIcon :name="c.draft ? 'x' : 'trash-2'" :size="14" />
            </button>
          </div>
          <Transition name="asc-open">
            <div v-if="expanded === c.key" class="asc-body">
              <div v-if="c.draft" class="asc-keep">
                <span>{{ t('auras.draftHint') }}</span>
                <button type="button" class="btn btn-primary btn-xs" @click="keepDraft(c)">
                  <UiIcon name="check" :size="13" />{{ t('auras.keep') }}
                </button>
              </div>
              <AuraEditor
                :aura="c.aura"
                :def="c.kind === 'trait' ? c.def : null"
                @update="onUpdate(c, $event)"
              />
            </div>
          </Transition>
        </article>
      </TransitionGroup>
    </section>

    <!-- ── Add an effect: pick a tag or a trait ── -->
    <Transition name="as-add">
      <section v-if="adding" class="as-add">
        <div class="as-add-head">
          <h4 class="st-sec-title">{{ t('auras.addTitle') }}</h4>
          <button
            type="button"
            class="icon-btn sm"
            :title="t('auras.cancel')"
            :aria-label="t('auras.cancel')"
            @click="closeAdd"
          >
            <UiIcon name="x" :size="15" />
          </button>
        </div>
        <div v-if="store.caps.tags" class="seg as-kinds" role="radiogroup">
          <button
            v-for="k in ['tag', 'trait']"
            :key="k"
            type="button"
            class="seg-btn"
            :class="{ active: addKind === k }"
            role="radio"
            :aria-checked="addKind === k"
            @click="addKind = k"
          >
            <UiIcon :name="k === 'tag' ? 'tag' : 'list'" :size="13" />{{ t('auras.kinds.' + k) }}
          </button>
        </div>
        <SearchField
          v-model="addQuery"
          size="sm"
          :placeholder="addKind === 'tag' ? t('auras.searchTags') : t('auras.searchTraits')"
        />
        <div class="as-pick">
          <template v-if="addKind === 'tag'">
            <button
              v-for="tg in tagChoices"
              :key="tg.id"
              type="button"
              class="as-pick-row"
              @click="pickTag(tg)"
            >
              <i class="asc-tagdot" :style="{ background: tg.color }"></i>
              <span class="as-pick-name">{{ defaultNameLabel(tg.label) }}</span>
              <span v-if="hasTagAura(tg)" class="as-pick-has">
                <UiIcon name="sparkles" :size="11" />{{ t('auras.hasEffect') }}
              </span>
              <span v-else class="as-pick-n">{{ bearers(membersOf(tg.id)) }}</span>
            </button>
          </template>
          <template v-else>
            <button
              v-for="d in traitChoices"
              :key="d.id"
              type="button"
              class="as-pick-row"
              @click="pickTrait(d)"
            >
              <UiIcon class="asc-trait-ic" :name="traitIcon(d)" :size="13" />
              <span class="as-pick-name">{{ fieldLabel(d) }}</span>
              <span v-if="ruleCount(d)" class="as-pick-has">
                <UiIcon name="sparkles" :size="11" />{{ t('auras.ruleCount', { n: ruleCount(d) }) }}
              </span>
              <span v-else class="as-pick-n">{{ typeMeta(d.type).label }}</span>
            </button>
          </template>
          <p v-if="pickEmptyText" class="as-pick-none">{{ pickEmptyText }}</p>
        </div>
      </section>
    </Transition>
  </div>
</template>

<script>
// The focus request last honoured (store.auraFocus.at), kept across remounts
// so switching chapters away and back doesn't replay it.
let handledFocusAt = 0
</script>

<script setup>
// Style Studio → Whole app → Special effects. Every tag effect and trait
// rule as a card (bearer count from store.auraResolution); expand one to edit
// it with a live preview. "Add effect" picks a tag or a trait and starts it
// on a fitting preset. store.auraFocus (set by store.openAuras from a trait
// menu / tag chip) expands that source — or opens an unsaved draft for it.
import { computed, nextTick, ref, watch } from 'vue'
import { useMainStore } from '../../store/index.js'
import { useI18n } from '../../i18n'
import UiIcon from '../ui/UiIcon.js'
import SearchField from '../ui/SearchField.vue'
import AuraEditor from './AuraEditor.vue'
import { sanitizeAura, sanitizeTraitAuras, sourceKey } from '../../../../shared/auras'
import { defaultNameLabel, fieldLabel, nounLabel, optionLabel } from '../../lib/dataLabels'
import { typeMeta } from '../personForm/fieldUi.js'
import { toast } from '../../lib/dialogs.js'
import { undoToast } from '../../lib/undoToast.js'
import {
  conditionSummary,
  defaultWhen,
  lookOf,
  ornamentMeta,
  suggestPreset
} from './auraCatalog.js'

const store = useMainStore()
const { t } = useI18n()

const EMPTY_ART = [
  { icon: 'crown', color: '#f5c542' },
  { icon: 'flame', color: '#ff7a1a' },
  { icon: 'snowflake', color: '#8fd8ff' }
]

const rootEl = ref(null)
const expanded = ref('')
/** An unsaved effect: { kind, id, aura } — saved by its first edit. */
const draft = ref(null)
const adding = ref(false)
const addKind = ref('tag')
const addQuery = ref('')

const noun = computed(() => nounLabel(store.noun).toLowerCase())
const counts = computed(() => store.auraResolution.counts)
const sortedDefs = computed(() =>
  [...store.fieldDefs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
)

/** A trait's rules exactly as resolution sees them (same ids → same counts). */
function rulesOf(def) {
  return sanitizeTraitAuras(def?.auras, def)
}

const saved = computed(() => {
  const out = []
  for (const tag of store.tags) {
    const a = sanitizeAura(tag.aura)
    if (a) out.push({ key: sourceKey({ kind: 'tag', id: tag.id }), kind: 'tag', tag, aura: a })
  }
  for (const def of sortedDefs.value)
    for (const rule of rulesOf(def))
      out.push({
        key: sourceKey({ kind: 'trait', id: def.id, ruleId: rule.id }),
        kind: 'trait',
        def,
        rule,
        aura: rule
      })
  return out
})
const savedCount = computed(() => saved.value.length)

/** The key a draft will have once saved — the card keeps it across the
 *  save, so its editor (and live preview) carry straight on. */
function draftKey(d) {
  return d.kind === 'tag'
    ? sourceKey({ kind: 'tag', id: d.id })
    : sourceKey({ kind: 'trait', id: d.id, ruleId: d.aura.id })
}

const cards = computed(() => {
  const d = draft.value
  if (!d) return saved.value
  const key = draftKey(d)
  if (saved.value.some((c) => c.key === key)) return saved.value
  const src =
    d.kind === 'tag'
      ? store.tags.find((tg) => tg.id === d.id)
      : store.fieldDefs.find((f) => f.id === d.id)
  if (!src) return saved.value
  const card = { key, kind: d.kind, draft: true, aura: d.aura }
  if (d.kind === 'tag') card.tag = src
  else card.def = src
  return [card, ...saved.value]
})

// ── display helpers ──
function ornIcon(aura) {
  if (aura.ornament !== 'none') return ornamentMeta(aura.ornament).icon
  return aura.line !== 'none' ? 'spline' : 'palette'
}
function traitIcon(def) {
  return def?.icon || typeMeta(def?.type).icon
}
function countOf(c) {
  return counts.value.get(c.key) || 0
}
function bearers(n) {
  if (!n) return t('auras.bearersNone')
  return t(n === 1 ? 'auras.bearersOne' : 'auras.bearersOther', { n, noun: noun.value })
}
function subline(c) {
  if (c.kind === 'tag') return t('auras.tagMembers')
  const s = conditionSummary(c.aura, c.def, optionLabel)
  const text = t(s.key, s.params)
  return s.scaled ? `${text} · ${t('auras.when.sumScaled')}` : text
}
function membersOf(tagId) {
  return store.membersOf?.get(tagId)?.length || 0
}
function hasTagAura(tg) {
  return !!sanitizeAura(tg.aura)
}
function ruleCount(def) {
  return rulesOf(def).length
}
function orbStyle(o, i) {
  return { '--oc': o.color, '--i': i }
}

// ── writes (serialized: each runs against the latest store state) ──
let chain = Promise.resolve()
function enqueue(fn) {
  // A throw counts as a failed write (true), like an unsuccessful response.
  chain = chain.then(fn).catch(() => true)
  return chain
}
function failed(res) {
  if (res && res.success) return false
  toast(t('auras.saveFailed'), { tone: 'error' })
  return true
}

function writeTag(tagId, aura) {
  return enqueue(async () => failed(await store.setTagAura(tagId, aura)))
}
/** Insert or replace one rule (by id) in a trait's list. */
function upsertRule(rules, rule) {
  return rules.some((r) => r.id === rule.id)
    ? rules.map((r) => (r.id === rule.id ? rule : r))
    : [...rules, rule]
}
/** Replace one trait's rule list via `edit(rules) → rules`. */
function writeTrait(defId, edit) {
  return enqueue(async () => {
    const def = store.fieldDefs.find((d) => d.id === defId)
    if (!def) return true
    return failed(await store.setTraitAuras(defId, edit(rulesOf(def))))
  })
}

async function onUpdate(c, next) {
  if (c.draft) {
    // The draft's first edit saves it, and the card becomes a real one.
    const d = draft.value
    if (!d) return
    draft.value = { ...d, aura: next }
    const bad =
      d.kind === 'tag'
        ? await writeTag(d.id, lookOf(next))
        : await writeTrait(d.id, (rules) => upsertRule(rules, next))
    if (!bad) draft.value = null
    return
  }
  if (c.kind === 'tag') await writeTag(c.tag.id, lookOf(next))
  else await writeTrait(c.def.id, (rules) => upsertRule(rules, { ...next, id: c.rule.id }))
}

/** Save a draft exactly as suggested. */
function keepDraft(c) {
  return onUpdate(c, JSON.parse(JSON.stringify(c.aura)))
}

async function remove(c) {
  if (c.draft) {
    draft.value = null
    if (expanded.value === c.key) expanded.value = ''
    return
  }
  if (expanded.value === c.key) expanded.value = ''
  if (c.kind === 'tag') {
    const bad = await writeTag(c.tag.id, null)
    if (!bad) undoToast(t('auras.removed', { name: defaultNameLabel(c.tag.label) }), 'tags:update')
  } else {
    const bad = await writeTrait(c.def.id, (rules) => rules.filter((r) => r.id !== c.rule.id))
    if (!bad) undoToast(t('auras.removed', { name: fieldLabel(c.def) }), 'fields:updateDef')
  }
}

function toggle(key) {
  expanded.value = expanded.value === key ? '' : key
  if (expanded.value) reveal(key)
}

/** Scroll a card into view once it exists (the studio body may still be
 *  mid-transition when a focus request lands). */
function reveal(key) {
  let tries = 0
  const seek = () => {
    const el = rootEl.value?.querySelector(`[data-key="${key}"]`)
    if (el) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      el.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
    } else if (tries++ < 60) requestAnimationFrame(seek)
  }
  nextTick(() => requestAnimationFrame(seek))
}

// ── add flow ──
function openAdd() {
  adding.value = true
  addQuery.value = ''
  if (!store.caps.tags) addKind.value = 'trait'
  else if (!store.tags.length && store.fieldDefs.length) addKind.value = 'trait'
  nextTick(() => rootEl.value?.querySelector('.as-add input')?.focus())
}
function closeAdd() {
  adding.value = false
  addQuery.value = ''
}
const q = computed(() => addQuery.value.trim().toLowerCase())
const tagChoices = computed(() =>
  store.tags
    .filter((tg) => tg.source !== 'derived')
    .filter((tg) => !q.value || defaultNameLabel(tg.label).toLowerCase().includes(q.value))
    .sort((a, b) => Number(hasTagAura(a)) - Number(hasTagAura(b)))
)
const traitChoices = computed(() =>
  sortedDefs.value.filter((d) => !q.value || fieldLabel(d).toLowerCase().includes(q.value))
)
const pickEmptyText = computed(() => {
  const list = addKind.value === 'tag' ? tagChoices.value : traitChoices.value
  if (list.length) return ''
  if (q.value) return t('auras.noMatch', { q: addQuery.value.trim() })
  return addKind.value === 'tag' ? t('auras.noTags', { noun: noun.value }) : t('auras.noTraits')
})

function newTraitRule(def) {
  const p = suggestPreset(fieldLabel(def), savedCount.value)
  return {
    id: crypto.randomUUID(),
    ...p.aura,
    when: defaultWhen(def),
    scale: false
  }
}

async function pickTag(tg) {
  closeAdd()
  const key = sourceKey({ kind: 'tag', id: tg.id })
  if (!hasTagAura(tg)) {
    const p = suggestPreset(defaultNameLabel(tg.label), savedCount.value)
    if (await writeTag(tg.id, { ...p.aura })) return
  }
  expanded.value = key
  reveal(key)
}
async function pickTrait(def) {
  closeAdd()
  const rule = newTraitRule(def)
  if (await writeTrait(def.id, (rules) => [...rules, rule])) return
  const key = sourceKey({ kind: 'trait', id: def.id, ruleId: rule.id })
  expanded.value = key
  reveal(key)
}

// ── focus requests (store.openAuras) ──
function applyFocus(f) {
  if (!f || !f.at || f.at <= handledFocusAt) return
  handledFocusAt = f.at
  if (!f.kind || !f.id) return
  closeAdd()
  if (f.kind === 'tag') {
    const tag = store.tags.find((tg) => tg.id === f.id)
    if (!tag) return
    if (hasTagAura(tag)) {
      draft.value = null
      expanded.value = sourceKey({ kind: 'tag', id: tag.id })
    } else {
      const p = suggestPreset(defaultNameLabel(tag.label), savedCount.value)
      draft.value = { kind: 'tag', id: tag.id, aura: { ...p.aura } }
      expanded.value = draftKey(draft.value)
    }
  } else {
    const def = store.fieldDefs.find((d) => d.id === f.id)
    if (!def) return
    const rules = rulesOf(def)
    if (rules.length) {
      draft.value = null
      expanded.value = sourceKey({ kind: 'trait', id: def.id, ruleId: rules[0].id })
    } else {
      draft.value = { kind: 'trait', id: def.id, aura: newTraitRule(def) }
      expanded.value = draftKey(draft.value)
    }
  }
  reveal(expanded.value)
}
watch(() => store.auraFocus, applyFocus, { immediate: true })

// A project switch (or the source being deleted) drops a stale draft.
watch(
  () => [store.tags, store.fieldDefs],
  () => {
    const d = draft.value
    if (!d) return
    const alive =
      d.kind === 'tag'
        ? store.tags.some((tg) => tg.id === d.id)
        : store.fieldDefs.some((f) => f.id === d.id)
    if (!alive) draft.value = null
  }
)
</script>

<style scoped>
.auras-sheet {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── empty state: three ornaments drifting over a pool of light ── */
.as-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 18px 14px 16px;
  border-radius: var(--r-md);
  border: 1px dashed var(--border-strong);
  background: radial-gradient(70% 60% at 50% 22%, rgba(var(--accent-rgb), 0.1), transparent 70%);
  text-align: center;
}
.as-empty h4 {
  margin: 4px 0 0;
  font-size: var(--fs-md, 14px);
  font-weight: 800;
  color: var(--t1);
}
.as-empty p {
  margin: 0 0 6px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--t2);
}
.as-empty-art {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  height: 58px;
}
.as-empty-orb {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  color: var(--oc);
  background: color-mix(in srgb, var(--oc) 14%, var(--elevated));
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--oc) 40%, transparent),
    0 0 18px color-mix(in srgb, var(--oc) 30%, transparent);
  animation: as-float 3.6s var(--ease-std, ease-in-out) infinite alternate;
  animation-delay: calc(var(--i) * -1.2s);
}
.as-empty-orb:nth-child(2) {
  width: 50px;
  height: 50px;
  margin-bottom: 8px;
}
@keyframes as-float {
  from {
    transform: translateY(2px);
  }
  to {
    transform: translateY(-4px);
  }
}

/* ── list ── */
.as-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.as-head-n {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--elevated);
  color: var(--t2);
  font-size: 11px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.as-add-btn {
  margin-left: auto;
}
.as-cards {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.as-card {
  position: relative;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--elevated);
  transition:
    border-color var(--dur) ease,
    box-shadow var(--dur) ease,
    background var(--dur) ease;
}
.as-card::before {
  /* a sliver of the aura's colour down the card's spine */
  content: '';
  position: absolute;
  left: -1px;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--aura-c);
  box-shadow: 0 0 10px color-mix(in srgb, var(--aura-c) 55%, transparent);
}
.as-card:hover {
  border-color: var(--border-strong);
}
.as-card.open {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--aura-c) 7%, var(--surface)),
    var(--surface) 140px
  );
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.16);
}
.as-card.draft {
  border-style: dashed;
}
.asc-row {
  display: flex;
  align-items: center;
  gap: 2px;
  padding-right: 6px;
}
.asc-head {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px 8px 11px;
  border: none;
  background: none;
  color: var(--t1);
  font-family: var(--font);
  text-align: left;
  cursor: pointer;
  border-radius: var(--r-md);
}
.asc-orn {
  display: grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: var(--aura-c);
  background: color-mix(in srgb, var(--aura-c) 15%, transparent);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--aura-c) 38%, transparent),
    0 0 14px color-mix(in srgb, var(--aura-c) 28%, transparent);
}
.asc-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.asc-src {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12.5px;
  font-weight: 700;
}
.asc-name {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.asc-tagdot {
  flex: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--t1) 8%, transparent);
}
.asc-trait-ic {
  flex: none;
  color: var(--t3);
}
.asc-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 11px;
  color: var(--t3);
}
.asc-cond {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.asc-count {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex: none;
  margin-left: auto;
  color: var(--t2);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.asc-count.zero {
  color: var(--t3);
  font-weight: 600;
}
.asc-draft {
  flex: none;
  margin-left: auto;
  padding: 0 6px;
  border-radius: 999px;
  border: 1px dashed var(--border-strong);
  color: var(--t2);
  font-weight: 700;
}
.asc-chev {
  flex: none;
  color: var(--t3);
  transition: transform 0.3s var(--ease-spring);
}
.as-card.open .asc-chev {
  transform: rotate(180deg);
}
.asc-remove {
  display: grid;
  place-items: center;
  flex: none;
  width: var(--ctl-xs);
  height: var(--ctl-xs);
  padding: 0;
  border: none;
  border-radius: var(--r-sm);
  background: none;
  color: var(--t3);
  cursor: pointer;
  transition:
    color var(--dur) ease,
    background var(--dur) ease;
}
.asc-remove:hover {
  color: var(--danger);
  background: rgba(var(--danger-rgb), 0.1);
}
.asc-body {
  padding: 2px 11px 12px;
}
.asc-keep {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding: 6px 6px 6px 10px;
  border-radius: var(--r-sm);
  background: rgba(var(--accent-rgb), 0.08);
  font-size: 11.5px;
  line-height: 1.35;
  color: var(--t2);
}
.asc-keep span {
  flex: 1;
  min-width: 0;
}

.asc-open-enter-active {
  transition:
    opacity 0.28s var(--ease-out),
    transform 0.34s var(--ease-out);
}
.asc-open-leave-active {
  transition: opacity 0.14s ease;
}
.asc-open-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}
.asc-open-leave-to {
  opacity: 0;
}

.as-card-enter-active {
  transition:
    opacity 0.3s var(--ease-out),
    transform 0.4s var(--ease-spring);
}
.as-card-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.as-card-enter-from {
  opacity: 0;
  transform: scale(0.96) translateY(-4px);
}
.as-card-leave-to {
  opacity: 0;
  transform: translateX(14px);
}
.as-card-move {
  transition: transform 0.3s var(--ease-out);
}

/* ── add panel ── */
.as-add {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: var(--r-md);
  border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--border));
  background: var(--surface);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.14);
}
.as-add-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.as-kinds {
  display: flex;
  padding: 2px;
}
.as-kinds .seg-btn {
  flex: 1;
  gap: 5px;
  min-height: calc(var(--ctl-sm) - 6px);
  font-size: 11.5px;
}
.as-pick {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 232px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.as-pick-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: var(--ctl-sm);
  padding: 4px 8px;
  border: none;
  border-radius: var(--r-sm);
  background: none;
  color: var(--t1);
  font-family: var(--font);
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
}
.as-pick-row:hover,
.as-pick-row:focus-visible {
  background: rgba(var(--accent-rgb), 0.1);
}
.as-pick-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
}
.as-pick-n {
  flex: none;
  font-size: 11px;
  color: var(--t3);
}
.as-pick-has {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
}
.as-pick-none {
  margin: 6px 4px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--t3);
}
.as-add-enter-active {
  transition:
    opacity 0.24s var(--ease-out),
    transform 0.3s var(--ease-spring);
}
.as-add-leave-active {
  transition: opacity 0.14s ease;
}
.as-add-enter-from {
  opacity: 0;
  transform: translateY(6px) scale(0.98);
}
.as-add-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .as-empty-orb {
    animation: none;
  }
}
</style>
