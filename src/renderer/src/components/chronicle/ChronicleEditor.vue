<template>
  <!-- The chronicle editor: one dialog for eras and story events, opened from
       anywhere through store.openEraEditor / openEventEditor. A live preview
       at the top shows the band / marker exactly as the Timeline will. -->
  <Teleport to="body">
    <Transition name="ce">
      <div v-if="ed" class="ce-overlay" @pointerdown.self="close" @keydown.esc="close">
        <div
          class="ce"
          role="dialog"
          aria-modal="true"
          @keydown.ctrl.enter="save"
          @keydown.meta.enter="save"
        >
          <!-- ── Preview ── -->
          <div v-if="isEra" class="ce-prev-era" :style="{ '--c': draft.color || '#6c8ef5' }">
            <span class="ce-prev-band"></span>
            <span class="ce-prev-era-label">
              <UiIcon class="ce-prev-icon" :name="eraIcon" :size="16" />
              <b>{{ draft.name || 'Untitled era' }}</b>
              <span class="ce-prev-span">{{ spanText(draft.start, draft.end) }}</span>
            </span>
          </div>
          <div v-else class="ce-prev-ev" :style="{ '--c': evColor }">
            <span class="ce-prev-line"></span>
            <span class="ce-prev-pill" :class="'imp-' + (draft.importance || 2)">
              <span class="ce-prev-disc"><UiIcon :name="evIcon" :size="14" /></span>
              <b>{{ draft.title || 'Untitled event' }}</b>
              <span class="ce-prev-span">{{ spanText(draft.date, draft.end, true) }}</span>
            </span>
            <span
              v-for="(p, i) in castPreview"
              :key="p.id"
              class="ce-prev-ring"
              :style="{ '--i': i }"
            ></span>
          </div>

          <div class="ce-head">
            <span class="ce-kicker"
              >{{ isNew ? 'New' : 'Edit' }} {{ isEra ? 'era' : 'event' }}</span
            >
            <button class="ce-x" title="Close (Esc)" aria-label="Close" @click="close">
              <UiIcon name="x" :size="16" />
            </button>
          </div>

          <!-- ── Era form ── -->
          <template v-if="isEra">
            <input
              ref="firstEl"
              v-model="draft.name"
              class="ce-title"
              placeholder="Name this era — “The Regency”, “Age of Dragons”…"
              maxlength="80"
            />
            <div class="ce-row">
              <label class="ce-label">From</label>
              <DateInput v-if="!openStart" v-model="draft.start" placeholder="Year" />
              <span v-else class="ce-open">the beginning of time</span>
              <label class="ce-check"><input v-model="openStart" type="checkbox" /> open</label>
            </div>
            <div class="ce-row">
              <label class="ce-label">Until</label>
              <DateInput v-if="!openEnd" v-model="draft.end" placeholder="Year" />
              <span v-else class="ce-open">ongoing</span>
              <label class="ce-check"><input v-model="openEnd" type="checkbox" /> ongoing</label>
            </div>
            <div class="ce-row">
              <label class="ce-label">Colour</label>
              <div class="ce-swatches">
                <button
                  v-for="(c, i) in ERA_COLORS"
                  :key="c"
                  class="ce-swatch"
                  :class="{ on: draft.color === c }"
                  :style="{ background: c, '--i': i }"
                  @click="draft.color = c"
                ></button>
                <input v-model="draft.color" type="color" class="ce-color" title="Any colour" />
              </div>
            </div>
            <div class="ce-row">
              <label class="ce-label">Icon</label>
              <IconPicker
                v-model="draft.icon"
                class="ce-icons"
                :options="ERA_ICONS"
                allow-none
                aria-label="Era icon"
              />
            </div>
          </template>

          <!-- ── Event form ── -->
          <template v-else>
            <input
              ref="firstEl"
              v-model="draft.title"
              class="ce-title"
              placeholder="What happened? — “The Long Winter”, “Grandma arrives in New York”…"
              maxlength="120"
            />
            <div class="ce-kinds">
              <button
                v-for="(k, i) in EVENT_KINDS"
                :key="k.id"
                class="ce-kind"
                :class="{ on: draft.kind === k.id }"
                :style="{ '--kc': k.color, '--i': i }"
                :title="k.label"
                @click="pickKind(k)"
              >
                <UiIcon class="ce-kind-ic" :name="k.icon" :size="14" />
                <span class="ce-kind-l">{{ k.label }}</span>
              </button>
            </div>
            <div class="ce-row">
              <label class="ce-label">When</label>
              <DateInput v-model="draft.date" placeholder="Year" />
              <label class="ce-check"
                ><input v-model="lasts" type="checkbox" /> lasts a while</label
              >
            </div>
            <Transition name="ce-slide">
              <div v-if="lasts" class="ce-row">
                <label class="ce-label">Until</label>
                <DateInput v-model="draft.end" placeholder="Year" />
              </div>
            </Transition>
            <div class="ce-row">
              <label class="ce-label">Weight</label>
              <div class="ce-seg">
                <button
                  v-for="o in IMPORTANCE"
                  :key="o.v"
                  :class="{ on: (draft.importance || 2) === o.v }"
                  :title="o.hint"
                  @click="draft.importance = o.v"
                >
                  <span v-if="o.stars" class="ce-stars">
                    <UiIcon v-for="n in o.stars" :key="n" name="star" :size="12" />
                  </span>
                  {{ o.label }}
                </button>
              </div>
            </div>
            <div class="ce-row ce-row-top">
              <label class="ce-label">Who</label>
              <div class="ce-cast">
                <TransitionGroup name="ce-chip">
                  <span
                    v-for="p in castPreview"
                    :key="p.id"
                    class="ce-person"
                    :style="{ '--pc': p.color }"
                  >
                    <span class="ce-person-dot"></span>{{ p.name }}
                    <button
                      class="ce-person-x"
                      title="Remove"
                      :aria-label="'Remove ' + p.name"
                      @click="removePerson(p.id)"
                    >
                      <UiIcon name="x" :size="12" />
                    </button>
                  </span>
                </TransitionGroup>
                <button v-if="!picking" class="ce-add" @click="picking = true">
                  <UiIcon name="plus" :size="14" />Add {{ store.noun.toLowerCase() }}
                </button>
                <div v-else class="ce-picker">
                  <PersonPicker
                    :exclude="draft.person_ids || []"
                    :allow-create="false"
                    placeholder="Who took part?"
                    @pick="addPerson"
                    @cancel="picking = false"
                  />
                </div>
              </div>
            </div>
            <div class="ce-row">
              <label class="ce-label">Where</label>
              <input
                v-model="draft.place"
                class="ce-input"
                placeholder="Optional place"
                maxlength="120"
              />
            </div>
          </template>

          <textarea
            v-model="draft.description"
            class="ce-desc"
            rows="3"
            :placeholder="isEra ? 'What defined this era?' : 'The story of what happened…'"
          ></textarea>

          <div class="ce-foot">
            <button v-if="!isNew" class="btn btn-sm btn-danger" @click="remove">Delete</button>
            <span class="ce-spacer"></span>
            <span class="ce-hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd></span>
            <button class="btn btn-sm btn-ghost" @click="close">Cancel</button>
            <button class="btn btn-sm btn-primary" :class="{ 'is-loading': saving }" @click="save">
              {{ isNew ? 'Add to the chronicle' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useMainStore } from '../../store/index.js'
import { EVENT_KINDS, ERA_COLORS, eventKind } from '../../../../shared/chronicle'
import { format } from '../../../../shared/calendarMath'
import DateInput from './DateInput.vue'
import UiIcon from '../ui/UiIcon.js'
import IconPicker from '../ui/IconPicker.vue'
import { hasIcon } from '../ui/icons.js'
import PersonPicker from '../personForm/PersonPicker.vue'
import { confirmDialog, toast } from '../../lib/dialogs.js'
import { undoToast } from '../../lib/undoToast.js'
import { useKinship } from '../kinship/useKinship'

const store = useMainStore()
const kin = useKinship()
const ed = computed(() => store.chronicleEditor)
const isEra = computed(() => ed.value?.kind === 'era')
const isNew = computed(() => !ed.value?.data?.id)

// Curated era icons (icon names); the picker's search reaches the full set.
const ERA_ICONS = [
  'crown',
  'swords',
  'shield',
  'bird',
  'castle',
  'landmark',
  'wheat',
  'factory',
  'train-front',
  'mountain',
  'flame',
  'moon',
  'sun',
  'rocket',
  'scroll',
  'wand-sparkles'
]
const IMPORTANCE = [
  { v: 1, label: 'Minor', stars: 0, hint: 'Shown when zoomed in' },
  { v: 2, label: 'Notable', stars: 1, hint: 'Shown at most zoom levels' },
  { v: 3, label: 'Major', stars: 3, hint: 'Always shown, bold' }
]

const draft = reactive({})
const openStart = ref(false)
const openEnd = ref(false)
const lasts = ref(false)
const picking = ref(false)
const saving = ref(false)
const firstEl = ref(null)

// A fresh copy of whatever the editor was opened on.
watch(
  ed,
  (v) => {
    for (const k of Object.keys(draft)) delete draft[k]
    if (!v) return
    const d = v.data || {}
    if (v.kind === 'era') {
      Object.assign(draft, {
        name: '',
        start: null,
        end: null,
        color: ERA_COLORS[store.eras.length % ERA_COLORS.length],
        icon: '',
        description: '',
        ...d
      })
      openStart.value = !!d.id && !d.start
      openEnd.value = !!d.id && !d.end
    } else {
      Object.assign(draft, {
        title: '',
        kind: 'milestone',
        icon: '',
        color: '',
        date: null,
        end: null,
        importance: 2,
        person_ids: [],
        place: '',
        description: '',
        ...d
      })
      lasts.value = !!d.end
    }
    picking.value = false
    nextTick(() => firstEl.value?.focus())
  },
  { immediate: true }
)

const evColor = computed(() => draft.color || eventKind(draft.kind).color)
const evIcon = computed(() => (hasIcon(draft.icon) ? draft.icon : eventKind(draft.kind).icon))
const eraIcon = computed(() => (hasIcon(draft.icon) ? draft.icon : 'diamond'))
const castPreview = computed(() =>
  (draft.person_ids || []).map((id) => ({
    id,
    name: kin.personName(id),
    color: kin.personColor(id)
  }))
)

function spanText(a, b, isEvent = false) {
  const fa = format(a)
  const fb = format(b)
  if (isEvent) return fa ? (fb ? `${fa} – ${fb}` : fa) : 'undated'
  return `${fa || '…'} – ${fb || 'now'}`
}

function pickKind(k) {
  draft.kind = k.id
  draft.icon = ''
  draft.color = ''
}
function addPerson(p) {
  if (!p?.id) return
  draft.person_ids = [...new Set([...(draft.person_ids || []), p.id])]
  picking.value = false
}
function removePerson(id) {
  draft.person_ids = draft.person_ids.filter((x) => x !== id)
}

function close() {
  store.closeChronicleEditor()
}

// Esc belongs to the dialog while it's up (capture phase, so the views'
// own Esc handlers — clear selection, exit modes — don't also fire).
function onKey(e) {
  if (!ed.value || e.key !== 'Escape') return
  e.stopImmediatePropagation()
  e.preventDefault()
  if (picking.value) picking.value = false
  else close()
}
window.addEventListener('keydown', onKey, true)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey, true))

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    if (isEra.value) {
      const res = await store.saveEra({
        ...draft,
        start: openStart.value ? null : draft.start,
        end: openEnd.value ? null : draft.end
      })
      if (!res.success) return toast(res.error || 'Could not save the era', { tone: 'danger' })
      toast(`${res.data.name} ${isNew.value ? 'added' : 'saved'}`, { tone: 'success' })
    } else {
      const res = await store.saveEvent({ ...draft, end: lasts.value ? draft.end : null })
      if (!res.success) return toast(res.error || 'Could not save the event', { tone: 'danger' })
      toast(`${res.data.title} ${isNew.value ? 'added' : 'saved'}`, { tone: 'success' })
    }
    close()
  } finally {
    saving.value = false
  }
}

async function remove() {
  const era = isEra.value
  const name = era ? draft.name : draft.title
  const ok = await confirmDialog({
    title: `Delete ${era ? 'era' : 'event'} “${name || 'Untitled'}”?`,
    message: era
      ? 'The band leaves every view. People are not affected.'
      : 'It leaves the timeline and every profile.',
    tone: 'danger'
  })
  if (!ok) return
  const res = era ? await store.deleteEra(draft.id) : await store.deleteEvent(draft.id)
  if (res.success) {
    close()
    undoToast(`Deleted “${name || 'Untitled'}”`, era ? 'eras:delete' : 'events:delete')
  }
}
</script>

<style scoped>
.ce-overlay {
  position: fixed;
  inset: 0;
  z-index: 95;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(8, 10, 18, 0.5);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}
.ce {
  position: relative;
  width: min(560px, 100%);
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  border-radius: var(--r-xl);
  background: var(--glass-soft);
  backdrop-filter: blur(18px) saturate(1.3);
  -webkit-backdrop-filter: blur(18px) saturate(1.3);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-lg);
  padding: 0 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ── Previews ── */
.ce-prev-era,
.ce-prev-ev {
  position: relative;
  margin: 0 -18px;
  height: 74px;
  overflow: hidden;
  display: flex;
  align-items: center;
  padding: 0 18px;
}
.ce-prev-band {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--c) 30%, transparent),
      color-mix(in srgb, var(--c) 10%, transparent)
    ),
    repeating-linear-gradient(
      90deg,
      transparent 0 40px,
      color-mix(in srgb, var(--c) 8%, transparent) 40px 41px
    );
  border-bottom: 1px dashed color-mix(in srgb, var(--c) 60%, transparent);
  animation: ce-band 6s linear infinite;
  background-size:
    100% 100%,
    82px 100%;
}
@keyframes ce-band {
  to {
    background-position:
      0 0,
      82px 0;
  }
}
.ce-prev-era-label {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  padding: 5px 12px;
  border-radius: var(--r-pill);
  background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--c) 70%, transparent);
  box-shadow: 0 6px 22px color-mix(in srgb, var(--c) 28%, transparent);
  animation: ce-pop 0.5s var(--ease-spring) 0.1s backwards;
}
.ce-prev-icon {
  color: var(--c);
}
.ce-prev-span {
  font-size: 12px;
  font-weight: 600;
  color: var(--t3);
}
.ce-prev-ev {
  background: linear-gradient(180deg, color-mix(in srgb, var(--c) 12%, transparent), transparent);
}
.ce-prev-line {
  position: absolute;
  left: 18px;
  right: 0;
  top: 50%;
  border-top: 1.5px dashed color-mix(in srgb, var(--c) 60%, transparent);
}
.ce-prev-pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 3px 12px 3px 3px;
  border-radius: var(--r-pill);
  background: var(--surface);
  border: 1px solid var(--c);
  box-shadow: 0 0 18px color-mix(in srgb, var(--c) 45%, transparent);
  font-size: 13px;
  animation:
    ce-pop 0.5s var(--ease-spring) 0.1s backwards,
    ce-glow 2.4s ease-in-out infinite;
}
.ce-prev-pill.imp-3 {
  font-size: 14px;
}
.ce-prev-pill.imp-1 {
  font-size: 12px;
  opacity: 0.85;
}
.ce-prev-disc {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--t1);
  background: color-mix(in srgb, var(--c) 30%, transparent);
}
.ce-prev-ring {
  position: relative;
  width: 14px;
  height: 14px;
  margin-left: 18px;
  border-radius: 50%;
  border: 2px solid var(--c);
  background: color-mix(in srgb, var(--c) 25%, transparent);
  box-shadow: 0 0 10px var(--c);
  animation: ce-pop 0.45s var(--ease-spring) backwards;
  animation-delay: calc(0.2s + var(--i) * 0.06s);
}
@keyframes ce-pop {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
}
@keyframes ce-glow {
  50% {
    box-shadow: 0 0 30px color-mix(in srgb, var(--c) 70%, transparent);
  }
}

.ce-head {
  display: flex;
  align-items: center;
  margin-top: 4px;
}
.ce-kicker {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--t3);
}
.ce-x {
  margin-left: auto;
  width: var(--ctl-sm);
  height: var(--ctl-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--t3);
  cursor: pointer;
}
.ce-x:hover {
  background: var(--hover);
  color: var(--t1);
}
.ce-title {
  border: none;
  border-bottom: 2px solid var(--border);
  background: transparent;
  color: var(--t1);
  font-family: var(--font);
  font-size: 19px;
  font-weight: 750;
  padding: 4px 0 8px;
  outline: none;
  transition: border-color var(--dur) ease;
}
.ce-title:focus {
  border-color: var(--accent);
}
.ce-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.ce-row-top {
  align-items: flex-start;
}
.ce-label {
  width: 52px;
  flex-shrink: 0;
  font-size: 11.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--t3);
  padding-top: 2px;
}
.ce-open {
  font-size: 13px;
  font-style: italic;
  color: var(--t2);
  min-width: 150px;
}
.ce-check {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  color: var(--t2);
  cursor: pointer;
}
.ce-icons {
  flex: 1;
  min-width: 0;
}
.ce-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: center;
}
.ce-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  animation: ce-pop 0.4s var(--ease-spring) backwards;
  animation-delay: calc(var(--i) * 0.02s);
  transition: transform 0.2s var(--ease-spring);
}
.ce-swatch:hover {
  transform: scale(1.15);
}
.ce-swatch.on {
  border-color: var(--t1);
  box-shadow: 0 0 0 2px var(--surface) inset;
}
.ce-color {
  width: 26px;
  height: 24px;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
}
.ce-kinds {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 5px;
}
.ce-kind {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
  text-align: left;
  animation: ce-pop 0.38s var(--ease-spring) backwards;
  animation-delay: calc(var(--i) * 0.018s);
  transition:
    border-color var(--dur) ease,
    background var(--dur) ease,
    transform 0.2s var(--ease-spring);
}
.ce-kind:hover {
  transform: translateY(-1px);
}
.ce-kind.on {
  border-color: var(--kc);
  background: color-mix(in srgb, var(--kc) 18%, var(--elevated));
  color: var(--t1);
}
.ce-kind-ic {
  flex-shrink: 0;
  color: var(--kc);
}
.ce-kind-l {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ce-seg {
  display: flex;
  gap: 3px;
  padding: 2px;
  border-radius: var(--r-sm);
  background: var(--elevated);
}
.ce-seg button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: var(--ctl-xs);
  border: none;
  background: transparent;
  color: var(--t3);
  border-radius: 6px;
  padding: 0 10px;
  font-family: var(--font);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.ce-stars {
  display: inline-flex;
  gap: 1px;
  color: var(--accent);
}
.ce-seg button.on {
  background: var(--surface);
  color: var(--t1);
  box-shadow: var(--shadow-sm);
}
.ce-cast {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: center;
  flex: 1;
  min-width: 0;
}
.ce-person {
  --pc: var(--accent);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 4px 3px 8px;
  border-radius: var(--r-pill);
  background: color-mix(in srgb, var(--pc) 16%, var(--elevated));
  border: 1px solid color-mix(in srgb, var(--pc) 40%, transparent);
  font-size: 12.5px;
  font-weight: 650;
  color: var(--t1);
}
.ce-person-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--pc);
}
.ce-person-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
}
.ce-person-x:hover {
  background: var(--hover);
  color: var(--t1);
}
.ce-add {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: var(--ctl-sm);
  border: 1px dashed var(--border-strong);
  background: transparent;
  color: var(--accent);
  border-radius: var(--r-pill);
  padding: 0 12px 0 9px;
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
}
.ce-picker {
  width: 100%;
  max-width: 320px;
}
.ce-input,
.ce-desc {
  flex: 1;
  border-radius: var(--r-sm);
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 13px;
  padding: 6px 9px;
  outline: none;
}
.ce-input {
  height: 30px;
}
.ce-desc {
  resize: vertical;
  min-height: 60px;
}
.ce-input:focus,
.ce-desc:focus {
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}
.ce-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}
.ce-spacer {
  flex: 1;
}
.ce-hint {
  font-size: 11.5px;
  color: var(--t3);
}

/* Transitions */
.ce-enter-active,
.ce-leave-active {
  transition: opacity 0.25s ease;
}
.ce-enter-active .ce,
.ce-leave-active .ce {
  transition:
    transform 0.4s var(--ease-spring),
    opacity 0.25s ease;
}
.ce-enter-from,
.ce-leave-to {
  opacity: 0;
}
.ce-enter-from .ce,
.ce-leave-to .ce {
  transform: translateY(16px) scale(0.96);
  opacity: 0;
}
.ce-slide-enter-active,
.ce-slide-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.3s var(--ease-out);
}
.ce-slide-enter-from,
.ce-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
.ce-chip-enter-active {
  transition:
    transform 0.35s var(--ease-spring),
    opacity 0.2s ease;
}
.ce-chip-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.18s ease;
}
.ce-chip-enter-from,
.ce-chip-leave-to {
  opacity: 0;
  transform: scale(0.6);
}
</style>
