<template>
  <div class="cv-view">
    <ViewHeader
      icon="🎭"
      title="Character"
      :count="store.persons.length ? personDocs.length : null"
      :hint="`🧪 ${t('character.experimental')}`"
    />
    <div class="cv-root" :class="{ 'cv-solo': !draft }">
      <!-- Wardrobe rail: slot categories; selecting one drives grid + glow -->
      <aside v-if="draft" class="cv-wardrobe">
        <button
          v-for="slot in pack.slots"
          :key="slot.id"
          class="cv-slot-btn"
          :class="{ active: selectedSlot === slot.id }"
          :title="t('character.slots.' + slot.id)"
          @click="selectedSlot = slot.id"
        >
          <span class="cv-slot-icon">{{ slot.icon }}</span>
        </button>
      </aside>

      <!-- Stage column -->
      <div class="cv-center">
        <header class="cv-topstrip">
          <label class="cv-field">
            <span class="cv-field-label">{{ t('character.person') }}</span>
            <select v-model="personId" class="cv-select">
              <option v-for="p in store.persons" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </label>
          <label class="cv-field">
            <span class="cv-field-label">{{ t('character.style') }}</span>
            <select class="cv-select" :value="pack.id" disabled>
              <option :value="pack.id">{{ pack.name }}</option>
            </select>
          </label>
          <input
            v-if="draft"
            class="cv-label-input"
            :value="draft.label"
            :placeholder="t('character.labelPh')"
            @input="liveEdit((d) => (d.label = $event.target.value))"
            @blur="endEdit"
          />
        </header>

        <!-- The stage (or the empty states) -->
        <div class="cv-stage-area">
          <template v-if="!store.persons.length">
            <div class="cv-empty">
              <div class="cv-empty-mark">🎭</div>
              <p>{{ t('character.noPersons') }}</p>
            </div>
          </template>
          <template v-else-if="!draft">
            <div class="cv-empty">
              <div class="cv-empty-mark">🎭</div>
              <p class="cv-empty-title">{{ t('character.emptyTitle', { name: personName }) }}</p>
              <p class="cv-empty-hint">{{ t('character.emptyHint') }}</p>
              <button class="btn btn-primary" @click="addLook">
                ✨ {{ t('character.create') }}
              </button>
            </div>
          </template>
          <CharacterStage
            v-else
            ref="stageRef"
            :doc="draft"
            :pack="pack"
            :selected-slot="selectedSlot"
            @select-slot="selectedSlot = $event"
          />
        </div>

        <!-- Portraits filmstrip: this person's looks -->
        <div v-if="personId && store.persons.length" class="cv-filmstrip">
          <button
            v-for="doc in personDocs"
            :key="doc.id"
            class="cv-look"
            :class="{ active: doc.id === activeDocId }"
            @click="activeDocId = doc.id"
          >
            <img class="cv-look-thumb" :src="thumbOf(doc)" alt="" />
            <span class="cv-look-name">{{ doc.label }}</span>
            <span v-if="doc.is_portrait" class="cv-look-star" :title="t('character.portraitBadge')"
              >★</span
            >
            <span v-if="ageLabel(doc)" class="cv-look-age">{{ ageLabel(doc) }}</span>
          </button>
          <button class="cv-look cv-look-add" :title="t('character.addLook')" @click="addLook">
            ＋
          </button>
        </div>

        <!-- Bottom tool pill -->
        <div v-if="draft" class="cv-pill">
          <button class="cv-pill-btn" :title="t('character.randomize')" @click="randomize">
            🎲
          </button>
          <button class="cv-pill-btn" :title="t('character.mirror')" @click="mirror">⇄</button>
          <div class="cv-pill-sep"></div>
          <button
            class="cv-pill-btn"
            :disabled="!undoStack.length"
            :title="t('character.undo')"
            @click="undo"
          >
            ↩
          </button>
          <button
            class="cv-pill-btn"
            :disabled="!redoStack.length"
            :title="t('character.redo')"
            @click="redo"
          >
            ↪
          </button>
          <div class="cv-pill-sep"></div>
          <button class="cv-pill-btn" :title="t('character.zoomIn')" @click="stageRef?.zoomBy(1.2)">
            ⊕
          </button>
          <button
            class="cv-pill-btn"
            :title="t('character.zoomOut')"
            @click="stageRef?.zoomBy(1 / 1.2)"
          >
            ⊖
          </button>
          <div class="cv-pill-sep"></div>
          <button
            class="cv-pill-btn cv-pill-primary"
            :disabled="portraitBusy"
            @click="setAsPortrait"
          >
            {{ portraitDone ? '✓ ' : '🖼 ' }}{{ t('character.setPortrait') }}
          </button>
        </div>
      </div>

      <!-- Inspector: parts, colors, sliders for the selected slot -->
      <aside v-if="draft" class="cv-inspector">
        <section class="cv-section">
          <h4 class="cv-section-title">
            {{ slotDef?.icon }} {{ t('character.slots.' + selectedSlot) }}
          </h4>
          <PartGrid :doc="draft" :pack="pack" :slot-id="selectedSlot" @pick="pickPart" />
          <label class="cv-slider-row">
            <span>{{ t('character.size') }}</span>
            <input
              type="range"
              min="0.7"
              max="1.4"
              step="0.02"
              :value="currentSlotState.scale"
              @input="liveEdit((d) => setSlotScale(d, Number($event.target.value)))"
              @change="endEdit"
            />
          </label>
        </section>

        <section class="cv-section">
          <h4 class="cv-section-title">🎨 {{ t('character.colors') }}</h4>
          <div class="cv-palette">
            <label v-for="ch in pack.paletteChannels" :key="ch" class="cv-swatch">
              <input
                type="color"
                :value="draft.palette[ch] || '#8f87a3'"
                @input="liveEdit((d) => (d.palette[ch] = $event.target.value))"
                @change="endEdit"
              />
              <span>{{ t('character.palette.' + ch) }}</span>
            </label>
          </div>
        </section>

        <section class="cv-section">
          <h4 class="cv-section-title">🧍 {{ t('character.body') }}</h4>
          <label v-for="m in ['height', 'build', 'headSize']" :key="m" class="cv-slider-row">
            <span>{{ t('character.' + m) }}</span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.05"
              :value="draft.morph[m]"
              @input="liveEdit((d) => (d.morph[m] = Number($event.target.value)))"
              @change="endEdit"
            />
          </label>
        </section>

        <section class="cv-section">
          <h4 class="cv-section-title">⏳ {{ t('character.ages') }}</h4>
          <p class="cv-hint">{{ t('character.ageHint') }}</p>
          <div class="cv-ages">
            <input
              type="number"
              min="0"
              class="cv-age-input"
              :placeholder="t('character.ageFrom')"
              :value="draft.age_from ?? ''"
              @input="liveEdit((d) => (d.age_from = toAge($event.target.value)))"
              @change="endEdit"
            />
            <span class="cv-age-dash">–</span>
            <input
              type="number"
              min="0"
              class="cv-age-input"
              :placeholder="t('character.ageTo')"
              :value="draft.age_to ?? ''"
              @input="liveEdit((d) => (d.age_to = toAge($event.target.value)))"
              @change="endEdit"
            />
          </div>
        </section>

        <button class="btn btn-danger btn-sm cv-delete" @click="deleteLook">
          {{ t('character.deleteLook') }}
        </button>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useMainStore } from '../../store/index.js'
import { useI18n } from '../../i18n'
import { api } from '../../api'
import CharacterStage from './CharacterStage.vue'
import PartGrid from './PartGrid.vue'
import ViewHeader from '../ViewHeader.vue'
import { stylePacks } from './styles/cartoon'
import { defaultParts, defaultPalette, randomizeDoc, slotOf, slotState } from './characterModel'
import { rasterize, portraitRegion } from './render/SpriteCompositor2D'

// The experimental Character view (Advanced + 🧪 Labs): build stylized
// portraits from swappable parts. A person owns any number of looks (docs);
// edits autosave (debounced) through characters:save; "Set as portrait"
// explicitly rasterizes the figure into the regular images pipeline so every
// view's avatar picks it up. See docs/CHARACTER_VIEW_PROPOSAL.md.

const store = useMainStore()
const { t } = useI18n()

const pack = stylePacks.cartoon
const stageRef = ref(null)
const selectedSlot = ref('hair')

// Draft + edit-gesture state — declared before the immediate watchers below,
// which flush/clear it as they pick the initial person and look.
const draft = ref(null) // local working copy of the active doc (autosaved)
const undoStack = ref([])
const redoStack = ref([])
let pendingSnapshot = null
let saveTimer = 0

// ── Person / look selection ───────────────────────────────────────────────────
const personId = ref(store.selectedPersonId || store.persons[0]?.id || null)
const personName = computed(() => store.persons.find((p) => p.id === personId.value)?.name || '')
const personDocs = computed(() => store.characters.filter((c) => c.person_id === personId.value))
const activeDocId = ref(null)

watch(
  personId,
  () => {
    flushSave()
    const docs = personDocs.value
    activeDocId.value = (docs.find((d) => d.is_portrait) || docs[0])?.id ?? null
    undoStack.value = []
    redoStack.value = []
  },
  { immediate: true }
)

// Keep a valid person selected as data loads / changes
watch(
  () => store.persons,
  (list) => {
    if (!list.some((p) => p.id === personId.value)) personId.value = list[0]?.id ?? null
  },
  { deep: false }
)

// Docs can land after mount (async load) or disappear (delete elsewhere) —
// keep the active look pointing at something real.
watch(personDocs, (docs) => {
  if (!activeDocId.value && docs.length) {
    activeDocId.value = (docs.find((d) => d.is_portrait) || docs[0]).id
  } else if (activeDocId.value && !docs.some((d) => d.id === activeDocId.value)) {
    activeDocId.value = docs[0]?.id ?? null
  }
})

// ── The working draft follows the active look ────────────────────────────────
watch(
  activeDocId,
  (id, old) => {
    if (id !== old) flushSave()
    const doc = store.characters.find((c) => c.id === id)
    draft.value = doc ? JSON.parse(JSON.stringify(doc)) : null
  },
  { immediate: true }
)

const slotDef = computed(() => slotOf(pack, selectedSlot.value))
const currentSlotState = computed(() =>
  draft.value ? slotState(draft.value, pack, selectedSlot.value) : { partId: null, scale: 1 }
)

// ── Edits: live mutation + debounced autosave + undo/redo ────────────────────
// liveEdit() mutates the draft (capturing ONE undo snapshot for the whole
// gesture — a slider drag is a single undo step); endEdit() seals the gesture.
function snapshot() {
  const d = draft.value
  return JSON.stringify({
    parts: d.parts,
    palette: d.palette,
    morph: d.morph,
    label: d.label,
    age_from: d.age_from,
    age_to: d.age_to
  })
}

function liveEdit(mutate) {
  if (!draft.value) return
  if (!pendingSnapshot) pendingSnapshot = snapshot()
  mutate(draft.value)
  scheduleSave()
}

function endEdit() {
  if (!pendingSnapshot) return
  if (pendingSnapshot !== snapshot()) {
    undoStack.value.push(pendingSnapshot)
    redoStack.value = []
  }
  pendingSnapshot = null
}

/** A discrete edit = one whole gesture. */
function commit(mutate) {
  liveEdit(mutate)
  endEdit()
}

function applySnapshot(json) {
  Object.assign(draft.value, JSON.parse(json))
  scheduleSave()
}

function undo() {
  if (!undoStack.value.length) return
  redoStack.value.push(snapshot())
  applySnapshot(undoStack.value.pop())
}

function redo() {
  if (!redoStack.value.length) return
  undoStack.value.push(snapshot())
  applySnapshot(redoStack.value.pop())
}

function scheduleSave() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(flushSave, 600)
}

function flushSave() {
  clearTimeout(saveTimer)
  saveTimer = 0
  const d = draft.value
  if (!d?.id) return
  // Plain-JSON clone: keep Vue proxies out of the IPC structured clone
  store.saveCharacter(
    JSON.parse(
      JSON.stringify({
        id: d.id,
        label: d.label,
        age_from: d.age_from,
        age_to: d.age_to,
        parts: d.parts,
        palette: d.palette,
        morph: d.morph
      })
    )
  )
}

onBeforeUnmount(flushSave)

// ── Look management ───────────────────────────────────────────────────────────
async function addLook() {
  if (!personId.value) return
  const res = await store.saveCharacter({
    person_id: personId.value,
    style_id: pack.id,
    label: t('character.lookName', { n: personDocs.value.length + 1 }),
    parts: defaultParts(pack),
    palette: defaultPalette(pack),
    morph: { height: 0, build: 0, headSize: 0 }
  })
  if (res.success) activeDocId.value = res.data.id
}

async function deleteLook() {
  if (!draft.value) return
  if (!confirm(t('character.confirmDelete', { name: draft.value.label }))) return
  const id = draft.value.id
  clearTimeout(saveTimer)
  saveTimer = 0
  draft.value = null
  await store.deleteCharacter(id)
  activeDocId.value = personDocs.value[0]?.id ?? null
}

// ── Tools ─────────────────────────────────────────────────────────────────────
function pickPart(partId) {
  commit((d) => {
    const prev = slotState(d, pack, selectedSlot.value)
    d.parts[selectedSlot.value] = { ...prev, partId }
  })
}

function setSlotScale(d, scale) {
  const prev = slotState(d, pack, selectedSlot.value)
  d.parts[selectedSlot.value] = { ...prev, scale }
}

function randomize() {
  commit((d) => Object.assign(d, randomizeDoc(pack)))
}

function mirror() {
  commit((d) => {
    for (const slot of pack.slots) {
      const prev = slotState(d, pack, slot.id)
      d.parts[slot.id] = { ...prev, flip: !prev.flip }
    }
  })
}

function toAge(v) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function ageLabel(doc) {
  if (doc.age_from == null && doc.age_to == null) return ''
  return `${doc.age_from ?? 0}–${doc.age_to ?? '∞'}`
}

// ── Set as portrait: rasterize → the regular images pipeline ─────────────────
const portraitBusy = ref(false)
const portraitDone = ref(false)

async function setAsPortrait() {
  const d = draft.value
  if (!d || portraitBusy.value) return
  portraitBusy.value = true
  try {
    flushSave()
    const dataUrl = rasterize(d, pack, { size: 512, region: portraitRegion(pack) })
    // Replace any previous generated portrait (never a user-picked photo)
    const existing = await api.invoke('images:getByPerson', { personId: d.person_id })
    if (existing.success) {
      for (const img of existing.data.filter((i) => i.source === 'character')) {
        await api.invoke('images:delete', { imageId: img.id })
      }
    }
    const added = await api.invoke('images:add', {
      personId: d.person_id,
      srcPath: dataUrl,
      isPrimary: true,
      source: 'character'
    })
    if (!added.success) {
      if (added.error) alert(added.error)
      return
    }
    await store.setCharacterPortrait(d.person_id, d.id)
    const idx = store.persons.findIndex((p) => p.id === d.person_id)
    if (idx !== -1) {
      store.persons[idx] = { ...store.persons[idx], primary_image: added.data.file_path }
    }
    store.refreshUsage()
    portraitDone.value = true
    setTimeout(() => (portraitDone.value = false), 1800)
  } finally {
    portraitBusy.value = false
  }
}

// ── Filmstrip thumbnails (tiny portrait renders, cached per updated_at) ──────
const thumbCache = new Map()
function thumbOf(doc) {
  const live = doc.id === draft.value?.id ? draft.value : doc
  const stamp = doc.id === draft.value?.id ? snapshotKey() : doc.updated_at
  const hit = thumbCache.get(doc.id)
  if (hit && hit.stamp === stamp) return hit.url
  const url = rasterize(live, pack, { size: 96, region: portraitRegion(pack) })
  thumbCache.set(doc.id, { stamp, url })
  return url
}

// Cheap change key so the active look's chip tracks the draft as you edit
function snapshotKey() {
  return draft.value ? snapshot() : ''
}
</script>

<style scoped>
.cv-view {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  z-index: 2;
}
.cv-root {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  display: grid;
  grid-template-columns: 56px 1fr 268px;
  background: var(--bg);
}

/* Before the first look exists both asides are hidden — collapse to one track
   so the lone center column isn't auto-placed into the 56px rail slot. */
.cv-root.cv-solo {
  grid-template-columns: 1fr;
}

/* ── Wardrobe rail ── */
.cv-wardrobe {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 0;
  border-right: 1px solid var(--border);
  background: var(--glass-soft);
  overflow-y: auto;
}

.cv-slot-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.12s,
    box-shadow 0.2s;
}

.cv-slot-btn:hover {
  background: var(--hover);
}

.cv-slot-btn.active {
  background: var(--adim);
  box-shadow: 0 0 8px rgba(108, 142, 245, 0.25);
}

.cv-slot-icon {
  font-size: 17px;
  line-height: 1;
}

/* ── Center column ── */
.cv-center {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  position: relative;
}

.cv-topstrip {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--glass-strong);
}

.cv-field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.cv-field-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--t3);
}

.cv-select {
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12px;
  max-width: 180px;
}

.cv-label-input {
  flex: 0 1 180px;
  min-width: 90px;
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12px;
  outline: none;
}

.cv-label-input:focus {
  border-color: var(--accent);
}

.cv-labs-tag {
  margin-left: auto;
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  background: var(--adim);
  border: 1px solid rgba(108, 142, 245, 0.3);
  border-radius: 999px;
  padding: 3px 10px;
  white-space: nowrap;
}

.cv-stage-area {
  flex: 1 1 0;
  min-height: 0;
  position: relative;
}

/* Empty states */
.cv-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--t2);
  text-align: center;
  padding: 24px;
}

.cv-empty-mark {
  font-size: 44px;
  filter: drop-shadow(0 6px 18px rgba(108, 142, 245, 0.35));
}

.cv-empty-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--t1);
}

.cv-empty-hint {
  font-size: 13px;
  color: var(--t3);
  max-width: 360px;
}

/* ── Filmstrip ── */
.cv-filmstrip {
  display: flex;
  align-items: stretch;
  gap: 8px;
  padding: 8px 14px;
  border-top: 1px solid var(--border);
  background: var(--glass-soft);
  overflow-x: auto;
}

.cv-look {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--elevated);
  color: var(--t2);
  font-size: 11px;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    border-color 0.15s,
    box-shadow 0.2s;
}

.cv-look:hover {
  border-color: var(--accent);
}

.cv-look.active {
  border-color: var(--accent);
  background: var(--adim);
  color: var(--t1);
  box-shadow: 0 0 8px rgba(108, 142, 245, 0.22);
}

.cv-look-thumb {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: var(--bg);
  object-fit: cover;
}

.cv-look-name {
  max-width: 76px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cv-look-star {
  position: absolute;
  top: 2px;
  right: 5px;
  color: var(--amber);
  font-size: 12px;
}

.cv-look-age {
  font-size: 9px;
  color: var(--t3);
}

.cv-look-add {
  justify-content: center;
  font-size: 20px;
  color: var(--t3);
  border-style: dashed;
  min-width: 56px;
}

.cv-look-add:hover {
  color: var(--accent);
}

/* ── Bottom pill ── */
.cv-pill {
  position: absolute;
  left: 50%;
  bottom: 84px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--glass-strong);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow);
}

.cv-pill-btn {
  border: none;
  background: transparent;
  color: var(--t2);
  font-size: 14px;
  font-family: var(--font);
  padding: 6px 9px;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 0.12s,
    color 0.12s;
}

.cv-pill-btn:hover:not(:disabled) {
  background: var(--hover);
  color: var(--t1);
}

.cv-pill-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.cv-pill-primary {
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
}

.cv-pill-sep {
  width: 1px;
  height: 18px;
  background: var(--border);
  margin: 0 4px;
}

/* ── Inspector ── */
.cv-inspector {
  border-left: 1px solid var(--border);
  background: var(--glass-soft);
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cv-section-title {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 700;
  color: var(--t1);
}

.cv-slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--t2);
}

.cv-slider-row span {
  flex: 0 0 64px;
}

.cv-slider-row input[type='range'] {
  flex: 1;
  accent-color: var(--accent);
}

.cv-palette {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.cv-swatch {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--t2);
  cursor: pointer;
}

.cv-swatch input[type='color'] {
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}

.cv-hint {
  margin: 0 0 8px;
  font-size: 11px;
  color: var(--t3);
  line-height: 1.5;
}

.cv-ages {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cv-age-input {
  width: 72px;
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12px;
  outline: none;
}

.cv-age-input:focus {
  border-color: var(--accent);
}

.cv-age-dash {
  color: var(--t3);
}

.cv-delete {
  margin-top: auto;
  align-self: flex-start;
}
</style>
