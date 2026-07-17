<template>
  <Transition name="sheet">
    <div v-if="store.formOpen" class="pf-backdrop" @click.self="cancel">
      <div class="pf-sheet" role="dialog" aria-modal="true">
        <!-- ── Left rail: live preview ─────────────────────────────────── -->
        <aside class="pf-rail">
          <div class="pf-rail-aurora"></div>
          <div class="pf-rail-inner">
            <NodePreview
              :label="labelLive"
              :color="colorLive"
              :ring-color="ringLive"
              :image="portraitUrl"
            />
            <div v-if="lifeLive" class="pf-rail-life">{{ lifeLive }}</div>
            <div v-if="railTags.length" class="pf-rail-tags">
              <span
                v-for="tag in railTags"
                :key="tag.id"
                class="pf-rail-tag"
                :style="{ '--tc': tag.color }"
              >
                {{ tag.icon ? tag.icon + ' ' : '' }}{{ tag.label }}
              </span>
            </div>
            <div class="pf-rail-note">live preview</div>
          </div>
        </aside>

        <!-- ── Right pane ──────────────────────────────────────────────── -->
        <div class="pf-pane">
          <header class="pf-header">
            <h2 class="pf-title">{{ formTitle }}</h2>
            <nav class="pf-nav">
              <button
                v-for="s in sections"
                :key="s.id"
                class="pf-nav-chip"
                type="button"
                @click="scrollToSection(s.id)"
              >
                {{ s.label }}
              </button>
            </nav>
            <button class="pf-close" type="button" title="Close" @click="cancel">✕</button>
          </header>

          <div ref="bodyEl" class="pf-body">
            <!-- ═ Identity: the slot dock ═ -->
            <section :ref="(el) => (sectionEls.identity = el)" class="pf-section">
              <div class="pf-section-label">Identity slots</div>
              <SlotDock
                ref="dockRef"
                :defs="store.fieldDefs"
                :draft="draft"
                :drag-state="drag"
                @update="updateDraft"
              />
            </section>

            <!-- ═ Traits ═ -->
            <section :ref="(el) => (sectionEls.traits = el)" class="pf-section">
              <div class="pf-section-label">
                Traits
                <span class="pf-section-hint">hold ⠿ to reorder · drop on a slot to assign</span>
              </div>
              <TransitionGroup name="fl" tag="div" class="pf-field-list">
                <FieldRow
                  v-for="def in listDefs"
                  :key="def.id"
                  :data-def-id="def.id"
                  class="pf-field-row"
                  :class="{ ghosted: drag.active && drag.defId === def.id }"
                  :def="def"
                  :draft="draftOf(def.id)"
                  :advanced="advanced"
                  :attached="attachedNow.has(def.id)"
                  @update="updateDraft(def.id, $event)"
                  @drag-start="startDrag(def, $event)"
                  @remove-from-person="removeFromPerson(def.id)"
                />
              </TransitionGroup>
              <AddFieldBar @create="createTrait" />
            </section>

            <!-- ═ Relationships ═ -->
            <section :ref="(el) => (sectionEls.relations = el)" class="pf-section">
              <div class="pf-section-label">Relationships</div>

              <div v-if="store.editingPerson && existingRels.length > 0" class="pf-rels">
                <div v-for="rel in existingRels" :key="rel.id" class="pf-rel-card">
                  <div class="pf-rel-top">
                    <span class="pf-rel-type">{{ rel.roleLabel }}</span>
                    <span class="pf-rel-name">{{ rel.otherName }}</span>
                    <span v-if="rel.status && rel.status !== 'active'" class="pf-rel-divorced">
                      {{ statusLabel(rel.relType, rel.status) }}
                    </span>
                    <button class="pf-rel-x" type="button" @click="removeExistingRel(rel.id)">
                      ✕
                    </button>
                  </div>
                  <div class="pf-rel-fields">
                    <label v-if="statusesOf(rel.relType).length > 1" class="pf-rel-field">
                      <span>Status</span>
                      <select
                        :value="rel.status"
                        @change="updateExistingRelStatus(rel.id, $event.target.value)"
                      >
                        <option v-for="s in statusesOf(rel.relType)" :key="s" :value="s">
                          {{ statusLabel(rel.relType, s) }}
                        </option>
                      </select>
                    </label>
                    <label class="pf-rel-field">
                      <span>{{ rel.relType === 'spouse' ? 'Married' : 'Since' }}</span>
                      <input
                        type="number"
                        :value="rel.formedDate"
                        placeholder="Year"
                        @change="updateExistingRelDate(rel.id, $event.target.value)"
                      />
                    </label>
                    <label v-if="statusesOf(rel.relType).length > 1" class="pf-rel-field">
                      <span>Ended</span>
                      <input
                        type="number"
                        :value="rel.endedDate"
                        placeholder="—"
                        @change="updateExistingRelEnded(rel.id, $event.target.value)"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <!-- Derived siblings: computed from shared parents, no rows stored -->
              <div v-if="store.editingPerson && derivedSibNames.length" class="pf-sibs">
                <span class="pf-sibs-label">Siblings</span>
                <span
                  v-for="(s, i) in derivedSibNames"
                  :key="s.id"
                  class="pf-sib-chip"
                  :style="{ '--i': i }"
                  title="Derived from a shared parent — no separate relationship needed"
                >
                  ⇄ {{ s.name }}
                </span>
                <span class="pf-sibs-hint">via shared parents</span>
              </div>

              <TransitionGroup v-if="pendingLinks.length" name="fl" tag="div" class="pf-rels">
                <div
                  v-for="(link, idx) in pendingLinks"
                  :key="link.key"
                  class="pf-rel-card pf-rel-new"
                >
                  <div class="pf-rel-top">
                    <span class="pf-rel-type">{{ link.roleLabel }}</span>
                    <span class="pf-rel-name">{{ personName(link.personId) }}</span>
                    <span class="pf-rel-pending">new</span>
                    <button class="pf-rel-x" type="button" @click="pendingLinks.splice(idx, 1)">
                      ✕
                    </button>
                  </div>
                  <div class="pf-rel-fields">
                    <label v-if="statusesOf(link.defKey).length > 1" class="pf-rel-field">
                      <span>Status</span>
                      <select v-model="link.status">
                        <option v-for="s in statusesOf(link.defKey)" :key="s" :value="s">
                          {{ statusLabel(link.defKey, s) }}
                        </option>
                      </select>
                    </label>
                    <label class="pf-rel-field">
                      <span>{{ link.defKey === 'spouse' ? 'Married' : 'Since' }}</span>
                      <input v-model.number="link.formedDate" type="number" placeholder="Year" />
                    </label>
                  </div>
                </div>
              </TransitionGroup>

              <!-- intent buttons, grouped by band (Family / Social / Power / Custom) -->
              <div v-for="band in intentBands" :key="band.id" class="pf-intent-band">
                <div v-if="intentBands.length > 1" class="pf-band-label">{{ band.label }}</div>
                <div class="pf-intents">
                  <button
                    v-for="intent in band.intents"
                    :key="intent.id"
                    type="button"
                    class="pf-intent"
                    :class="{ active: pickerFor === intent.id }"
                    @click="pickerFor = pickerFor === intent.id ? null : intent.id"
                  >
                    <span class="pf-intent-glyph">{{ intent.glyph }}</span> {{ intent.label }}
                  </button>
                </div>
              </div>
              <Transition name="fl">
                <PersonPicker
                  v-if="pickerFor"
                  class="pf-picker"
                  :exclude="excludedPersonIds"
                  :placeholder="pickerPlaceholder"
                  @pick="addLink"
                  @cancel="pickerFor = null"
                />
              </Transition>
            </section>

            <!-- ═ Images ═ -->
            <section :ref="(el) => (sectionEls.images = el)" class="pf-section">
              <div class="pf-section-label">Images</div>
              <div v-if="!store.editingPerson" class="pf-hint">
                Images can be added after creating — save first.
              </div>
              <template v-else>
                <div class="pf-img-slots">
                  <div
                    v-for="slot in IMAGE_SLOTS"
                    :key="slot.role"
                    class="pf-img-slot"
                    :class="[`pf-img-${slot.role}`, { filled: !!imageForRole(slot.role) }]"
                    :title="slot.hint"
                    @click="!imageForRole(slot.role) && addPhotoWithRole(slot.role)"
                  >
                    <template v-if="imageForRole(slot.role)">
                      <img :src="photoUrl(imageForRole(slot.role).file_path)" alt="" />
                      <button
                        class="pf-img-x"
                        type="button"
                        title="Remove image"
                        @click.stop="deletePhoto(imageForRole(slot.role))"
                      >
                        ✕
                      </button>
                    </template>
                    <template v-else>
                      <span class="pf-img-glyph">{{ slot.glyph }}</span>
                      <span class="pf-img-label">{{ slot.label }}</span>
                    </template>
                  </div>
                </div>
                <div class="pf-extras">
                  <div v-for="photo in extraPhotos" :key="photo.id" class="pf-extra">
                    <img :src="photoUrl(photo.file_path)" alt="" />
                    <div class="pf-extra-overlay">
                      <button
                        v-for="slot in IMAGE_SLOTS"
                        :key="slot.role"
                        class="pf-extra-btn"
                        type="button"
                        :title="`Use as ${slot.label.toLowerCase()}`"
                        @click="setRole(photo, slot.role)"
                      >
                        {{ slot.glyph }}
                      </button>
                      <button
                        class="pf-extra-btn pf-extra-del"
                        type="button"
                        title="Delete"
                        @click="deletePhoto(photo)"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <button class="pf-extra-add" type="button" @click="addPhotoWithRole('')">
                    ＋<span>extra</span>
                  </button>
                </div>
              </template>
            </section>

            <!-- ═ Tags ═ -->
            <section
              v-if="store.caps.tags"
              :ref="(el) => (sectionEls.tags = el)"
              class="pf-section"
            >
              <div class="pf-section-label">Tags</div>
              <div v-if="!store.editingPerson" class="pf-hint">
                Tags can be added after creating — save first.
              </div>
              <TagChipsEditor v-else :entity-id="store.editingPerson.id" />
            </section>
          </div>

          <footer class="pf-footer">
            <span v-if="formError" class="pf-error">{{ formError }}</span>
            <button class="btn btn-ghost" type="button" @click="cancel">Cancel</button>
            <button class="btn btn-primary" type="button" :disabled="submitting" @click="save">
              {{ submitting ? 'Saving…' : store.editingPerson ? 'Save changes' : 'Create' }}
            </button>
          </footer>
        </div>

        <!-- drag ghost -->
        <div
          v-if="drag.active"
          class="pf-ghost"
          :class="{
            valid: drag.overSlot && drag.overValid,
            invalid: drag.overSlot && !drag.overValid
          }"
          :style="{ left: drag.x + 'px', top: drag.y + 'px' }"
        >
          ⠿ {{ drag.label }}
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import { useMainStore } from '../store/index.js'
import { api } from '../api'
import { yearDate, format as formatDate } from '../../../shared/calendarMath'
import {
  coerceValue,
  composeGraphLabel,
  composeName,
  genderInfo,
  highlightFrom,
  lerpColorHex,
  slotAccepts
} from '../../../shared/fields'
import NodePreview from './personForm/NodePreview.vue'
import SlotDock from './personForm/SlotDock.vue'
import FieldRow from './personForm/FieldRow.vue'
import AddFieldBar from './personForm/AddFieldBar.vue'
import PersonPicker from './personForm/PersonPicker.vue'
import TagChipsEditor from './TagChipsEditor.vue'
import { derivedSiblings } from './graph/graphInsights.js'

const store = useMainStore()

// Intent chips are generated from the relationship-type registry. A directed
// def yields one chip per side — the chip names the person you PICK ("Parent"
// = pick their parent, "Crush" = pick their crush); a symmetric def yields
// one. Simple mode only offers the family band.
const BAND_LABELS = { family: 'Family', social: 'Social', power: 'Power', custom: 'Custom' }
const intentBands = computed(() => {
  const defs = store.caps.relTypePicker
    ? store.relTypes
    : store.relTypes.filter((d) => d.band === 'family')
  const bands = []
  const bandOf = new Map()
  for (const def of defs) {
    const intents = []
    if (def.directed) {
      const mk = (dir, pickedRole) => ({
        id: `${def.key}:${dir}`,
        defKey: def.key,
        dir, // which side the PICKED person takes: role_a or role_b
        glyph: def.glyph,
        label: pickedRole || def.label,
        hint: `Who is this person's ${(pickedRole || def.label).toLowerCase()}?`
      })
      intents.push(mk('a', def.role_a), mk('b', def.role_b))
    } else {
      intents.push({
        id: `${def.key}:sym`,
        defKey: def.key,
        dir: 'sym',
        glyph: def.glyph,
        label: def.label,
        hint: `${def.label}: pick the other person`
      })
    }
    const band = BAND_LABELS[def.band] ? def.band : 'custom'
    if (!bandOf.has(band)) {
      const entry = { id: band, label: BAND_LABELS[band], intents: [] }
      bandOf.set(band, entry)
      bands.push(entry)
    }
    bandOf.get(band).intents.push(...intents)
  }
  return bands
})
const allIntents = computed(() => intentBands.value.flatMap((b) => b.intents))

/** Selectable statuses of a type (single-status types render no dropdown). */
function statusesOf(defKey) {
  return store.relTypeByKey.get(defKey)?.statuses || ['active']
}
function statusLabel(defKey, s) {
  if (defKey === 'spouse' && s === 'active') return 'Married'
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

const IMAGE_SLOTS = [
  { role: 'portrait', glyph: '☺', label: 'Portrait', hint: 'Head & shoulders — the avatar' },
  { role: 'fullbody', glyph: '🧍', label: 'Full body', hint: 'Standing figure' },
  { role: 'background', glyph: '🏞', label: 'Background', hint: 'A scene or backdrop' }
]

const sections = [
  { id: 'identity', label: 'Identity' },
  { id: 'traits', label: 'Traits' },
  { id: 'relations', label: 'Relations' },
  { id: 'images', label: 'Images' },
  { id: 'tags', label: 'Tags' }
]

// ── form state ────────────────────────────────────────────────────────────────
const draft = reactive({}) // fieldId → { value, display_in_graph, timeframe }
const attachedNow = ref(new Set()) // unlocked defs visible on this form
const removalsPending = ref(new Set())
const sessionDefIds = ref(new Set()) // defs created during this open (cleanup on cancel)
let origRows = new Map()

const pendingLinks = ref([])
const pickerFor = ref(null)
const photos = ref([])
const existingRels = ref([])
const submitting = ref(false)
const formError = ref('')

const bodyEl = ref(null)
const dockRef = ref(null)
const sectionEls = reactive({})

const advanced = computed(() => store.programMode === 'advanced')
const formTitle = computed(() =>
  store.editingPerson ? `Edit: ${store.editingPerson.name || 'Unnamed'}` : `Add ${store.noun}`
)

const clone = (v) => (v == null ? null : JSON.parse(JSON.stringify(v)))

function draftOf(id) {
  if (!draft[id]) draft[id] = { value: null, display_in_graph: false, timeframe: null }
  return draft[id]
}

function updateDraft(fieldId, patch) {
  Object.assign(draftOf(fieldId), patch)
}

// The plain trait list: everything unslotted; unlocked ones only when attached.
const listDefs = computed(() => {
  const ordered = localOrder.value
    .map((id) => store.fieldDefs.find((d) => d.id === id))
    .filter(Boolean)
  return ordered.filter(
    (d) =>
      !d.slot &&
      !removalsPending.value.has(d.id) &&
      (d.locked || attachedNow.value.has(d.id) || sessionDefIds.value.has(d.id))
  )
})

// ── populate on open ──────────────────────────────────────────────────────────
async function populate(person) {
  formError.value = ''
  pendingLinks.value = []
  pickerFor.value = null
  removalsPending.value = new Set()
  sessionDefIds.value = new Set()
  Object.keys(draft).forEach((k) => delete draft[k])
  origRows = new Map()
  const attached = new Set()

  if (person) {
    const rows = store.fieldValuesOf.get(person.id)
    for (const def of store.fieldDefs) {
      const row = rows?.get(def.id)
      draft[def.id] = {
        value: clone(row?.value ?? null),
        display_in_graph: !!row?.display_in_graph,
        timeframe: clone(row?.timeframe ?? null)
      }
      if (row) {
        origRows.set(def.id, row)
        if (!def.locked) attached.add(def.id)
      }
    }
    existingRels.value = buildExistingRels(person.id)
    const res = await api.invoke('images:getByPerson', { personId: person.id })
    photos.value = res.success ? res.data : []
  } else {
    for (const def of store.fieldDefs) {
      draft[def.id] = { value: null, display_in_graph: false, timeframe: null }
    }
    existingRels.value = []
    photos.value = []
  }
  attachedNow.value = attached
  syncLocalOrder()
}

watch(
  () => store.formOpen,
  (open) => {
    if (open) populate(store.editingPerson)
  }
)
watch(
  () => store.editingPerson,
  (person) => {
    if (store.formOpen) populate(person)
  }
)
// Keep draft entries in sync when defs appear (created / unslotted elsewhere).
watch(
  () => store.fieldDefs.length,
  () => {
    for (const def of store.fieldDefs) draftOf(def.id)
    syncLocalOrder()
  }
)

// ── live preview ──────────────────────────────────────────────────────────────
const valueOfLive = (fieldId) => draft[fieldId]?.value ?? null
const nameLive = computed(() => composeName(store.fieldDefs, valueOfLive))
const labelLive = computed(() =>
  composeGraphLabel(
    nameLive.value,
    store.fieldDefs,
    valueOfLive,
    (id) => !!draft[id]?.display_in_graph
  )
)
const colorLive = computed(() => {
  const def = store.fieldDefs.find((d) => d.slot === 'gender')
  const t = def ? genderInfo(def, coerceValue(def, valueOfLive(def.id))).t : null
  const gs = store.graphSettings
  return t == null ? gs.unknownColor : lerpColorHex(gs.maleColor, gs.femaleColor, t)
})
const ringLive = computed(() => {
  const def = store.fieldDefs.find((d) => d.slot === 'highlight')
  if (!def) return null
  const hl = highlightFrom(def, coerceValue(def, valueOfLive(def.id)))
  return hl ? hl.color : null
})
const lifeLive = computed(() => {
  const of = (slot) => {
    const def = store.fieldDefs.find((d) => d.slot === slot)
    if (!def) return ''
    const v = coerceValue(def, valueOfLive(def.id))
    if (v == null) return ''
    if (def.type === 'date') return formatDate(v)
    if (def.type === 'number') return String(v)
    if (def.type === 'number_range') return `${v.a ?? '?'}–${v.b ?? '?'}`
    if (def.type === 'date_range') return `${formatDate(v.from) || '?'}–${formatDate(v.to) || '?'}`
    return ''
  }
  const b = of('birth')
  const d = of('death')
  return b || d ? `${b || '·'} — ${d || 'present'}` : ''
})
const portraitUrl = computed(() => {
  const img = imageForRole('portrait')
  return img ? api.getImageUrl(img.file_path) : null
})
const railTags = computed(() =>
  store.editingPerson ? store.tagsOf.get(store.editingPerson.id) || [] : []
)

// ── drag: reorder within the list, drop on a slot bay ─────────────────────────
const localOrder = ref([])
function syncLocalOrder() {
  localOrder.value = store.fieldDefs
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((d) => d.id)
}

const drag = reactive({
  active: false,
  defId: null,
  defType: null,
  label: '',
  x: 0,
  y: 0,
  overSlot: null,
  overValid: false,
  moved: false
})

function startDrag(def, e) {
  drag.active = true
  drag.defId = def.id
  drag.defType = def.type
  drag.label = def.label
  drag.x = e.clientX + 12
  drag.y = e.clientY - 8
  drag.overSlot = null
  drag.moved = false
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd, { once: true })
}

function onDragMove(e) {
  drag.x = e.clientX + 12
  drag.y = e.clientY - 8
  const slot = dockRef.value?.bayAt(e.clientX, e.clientY) ?? null
  drag.overSlot = slot
  drag.overValid = slot ? slotAccepts(slot, drag.defType) : false
  if (slot) return
  // hovering the list: shift the dragged row to the pointer position
  const rows = bodyEl.value?.querySelectorAll('.pf-field-row')
  if (!rows?.length) return
  let targetId = null
  for (const el of rows) {
    const r = el.getBoundingClientRect()
    if (e.clientY < r.top + r.height / 2) {
      targetId = el.dataset.defId
      break
    }
  }
  const ids = localOrder.value.filter((id) => id !== drag.defId)
  const visible = listDefs.value.map((d) => d.id).filter((id) => id !== drag.defId)
  let insertAfter // id to insert after within localOrder
  if (targetId && targetId !== drag.defId) {
    const vi = visible.indexOf(targetId)
    insertAfter = vi > 0 ? visible[vi - 1] : null
  } else if (!targetId) {
    insertAfter = visible[visible.length - 1] ?? null
  } else {
    return
  }
  const at = insertAfter == null ? 0 : ids.indexOf(insertAfter) + 1
  ids.splice(at, 0, drag.defId)
  if (ids.join() !== localOrder.value.join()) {
    localOrder.value = ids
    drag.moved = true
  }
}

async function onDragEnd() {
  window.removeEventListener('pointermove', onDragMove)
  const { defId, overSlot, overValid, moved } = drag
  drag.active = false
  if (overSlot) {
    if (overValid) {
      const res = await store.setFieldSlot(defId, overSlot)
      if (!res.success) flashError(res.error)
    } else {
      flashError(
        overSlot === 'name'
          ? 'Only text traits can appear in the graph name'
          : `That trait type can't go in the ${overSlot} slot`
      )
    }
    syncLocalOrder()
  } else if (moved) {
    await store.reorderFieldDefs(localOrder.value)
  }
}

let errTimer = null
function flashError(msg) {
  formError.value = msg
  clearTimeout(errTimer)
  errTimer = setTimeout(() => (formError.value = ''), 3200)
}

onBeforeUnmount(() => window.removeEventListener('pointermove', onDragMove))

// ── traits: create / remove ───────────────────────────────────────────────────
async function createTrait({ label, type, locked, config }) {
  const res = await store.createFieldDef({
    label,
    type,
    locked,
    config,
    personId: store.editingPerson?.id
  })
  if (res.success) {
    const id = res.data.def.id
    sessionDefIds.value = new Set([...sessionDefIds.value, id])
    attachedNow.value = new Set([...attachedNow.value, id])
    draftOf(id)
    syncLocalOrder()
  }
}

function removeFromPerson(fieldId) {
  removalsPending.value = new Set([...removalsPending.value, fieldId])
}

// ── relationships ─────────────────────────────────────────────────────────────
const pickerPlaceholder = computed(() => {
  const intent = allIntents.value.find((i) => i.id === pickerFor.value)
  return intent ? intent.hint : 'Type a name…'
})

const excludedPersonIds = computed(() => {
  const ids = new Set()
  if (store.editingPerson) ids.add(store.editingPerson.id)
  existingRels.value.forEach((r) => ids.add(r.otherId))
  pendingLinks.value.forEach((l) => ids.add(l.personId))
  return [...ids]
})

let linkKey = 0
function addLink(person) {
  const intent = allIntents.value.find((i) => i.id === pickerFor.value)
  if (!intent) return
  pendingLinks.value.push({
    key: `l${linkKey++}`,
    personId: person.id,
    defKey: intent.defKey,
    dir: intent.dir,
    roleLabel: intent.label,
    status: statusesOf(intent.defKey)[0] || 'active',
    formedDate: ''
  })
  pickerFor.value = null
}

function personName(pid) {
  return store.persons.find((x) => x.id === pid)?.name || 'Unnamed'
}

function buildExistingRels(personId) {
  const rels = []
  store.relationships.forEach((r) => {
    if (r.person_a_id !== personId && r.person_b_id !== personId) return
    const otherId = r.person_a_id === personId ? r.person_b_id : r.person_a_id
    const other = store.persons.find((p) => p.id === otherId)
    if (!other) return
    // This person's role in the pair ("Parent of", "Crush of", "Friend of").
    const def = store.relTypeByKey.get(r.type)
    let roleLabel
    if (r.label)
      roleLabel = r.label // per-edge custom label wins
    else if (!def) roleLabel = r.type
    else if (def.directed) {
      const mine = r.person_a_id === personId ? def.role_a : def.role_b
      roleLabel = mine ? `${mine} of` : def.label
    } else roleLabel = `${def.label} of`
    rels.push({
      id: r.id,
      otherId,
      otherName: other.name || 'Unnamed',
      roleLabel,
      relType: r.type,
      status: r.status || 'active',
      formedDate: r.formed?.year || null,
      endedDate: r.ended?.year || null
    })
  })
  return rels
}

// Derived siblinghood (shared parents) for the person being edited — shown as
// read-only chips; explicit sibling rows stay for half/step exceptions.
const derivedSibNames = computed(() => {
  const pid = store.editingPerson?.id
  if (!pid) return []
  const sibs = derivedSiblings(
    store.relationships,
    store.relTypeRoles.size ? (t) => store.relTypeRoles.get(t) || 'none' : undefined
  )
  return [...(sibs.get(pid) || [])]
    .map((id) => ({ id, name: store.persons.find((p) => p.id === id)?.name || 'Unnamed' }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

async function removeExistingRel(relId) {
  await store.deleteRelationship(relId)
  existingRels.value = existingRels.value.filter((r) => r.id !== relId)
}

async function updateExistingRelStatus(relId, status) {
  await store.updateRelationship({ id: relId, status })
  const rel = existingRels.value.find((r) => r.id === relId)
  if (rel) rel.status = status
}

async function updateExistingRelDate(relId, val) {
  const formedDate = val ? +val : null
  await store.updateRelationship({ id: relId, formed: yearDate(formedDate) })
  const rel = existingRels.value.find((r) => r.id === relId)
  if (rel) rel.formedDate = formedDate
}

async function updateExistingRelEnded(relId, val) {
  const endedDate = val ? +val : null
  await store.updateRelationship({ id: relId, ended: yearDate(endedDate) })
  const rel = existingRels.value.find((r) => r.id === relId)
  if (rel) rel.endedDate = endedDate
}

async function createPendingLinks(selfId) {
  for (const link of pendingLinks.value) {
    // dir 'a' = the picked person takes role_a (parent/mentor/admirer…);
    // 'b'/'sym' = this person does.
    const person_a_id = link.dir === 'a' ? link.personId : selfId
    const person_b_id = link.dir === 'a' ? selfId : link.personId
    await store.createRelationship({
      person_a_id,
      person_b_id,
      type: link.defKey,
      status: link.status || 'active',
      formed: yearDate(link.formedDate)
    })
  }
}

// ── images ────────────────────────────────────────────────────────────────────
function photoUrl(filePath) {
  return api.getImageUrl(filePath) || ''
}

function imageForRole(role) {
  const byRole = photos.value.find((p) => p.role === role)
  if (byRole) return byRole
  if (role === 'portrait') return photos.value.find((p) => p.is_primary) || null
  return null
}

const extraPhotos = computed(() => {
  const taken = new Set(
    IMAGE_SLOTS.map((s) => imageForRole(s.role))
      .filter(Boolean)
      .map((p) => p.id)
  )
  return photos.value.filter((p) => !taken.has(p.id))
})

async function addPhotoWithRole(role) {
  if (!store.editingPerson) return
  const dlg = await api.invoke('images:openDialog')
  if (!dlg.success || !dlg.data) return
  const isPrimary = role === 'portrait' || photos.value.length === 0
  const res = await api.invoke('images:add', {
    personId: store.editingPerson.id,
    srcPath: dlg.data,
    isPrimary,
    role
  })
  if (res.success) {
    if (isPrimary) photos.value.forEach((p) => (p.is_primary = false))
    photos.value.push(res.data)
    if (isPrimary) patchStorePrimary(res.data.file_path)
  }
}

async function setRole(photo, role) {
  const res = await api.invoke('images:setRole', {
    imageId: photo.id,
    personId: store.editingPerson.id,
    role
  })
  if (!res.success) return
  photos.value.forEach((p) => {
    if (p.role === role) p.role = ''
    if (p.id === photo.id) p.role = role
  })
  if (role === 'portrait') {
    await api.invoke('images:setPrimary', { imageId: photo.id, personId: store.editingPerson.id })
    photos.value.forEach((p) => (p.is_primary = p.id === photo.id))
    patchStorePrimary(photo.file_path)
  }
}

async function deletePhoto(photo) {
  await api.invoke('images:delete', { imageId: photo.id })
  photos.value = photos.value.filter((p) => p.id !== photo.id)
  if (photo.is_primary) {
    const next = imageForRole('portrait') || photos.value[0]
    if (next) {
      await api.invoke('images:setPrimary', { imageId: next.id, personId: store.editingPerson.id })
      photos.value.forEach((p) => (p.is_primary = p.id === next.id))
      patchStorePrimary(next.file_path)
    } else {
      patchStorePrimary(null)
    }
  }
}

function patchStorePrimary(filePath) {
  const idx = store.persons.findIndex((p) => p.id === store.editingPerson?.id)
  if (idx !== -1) store.persons[idx] = { ...store.persons[idx], primary_image: filePath }
}

// ── save / cancel ─────────────────────────────────────────────────────────────
function collectChanges() {
  const values = []
  const removals = [...removalsPending.value]
  for (const def of store.fieldDefs) {
    const d = draft[def.id]
    if (!d || removalsPending.value.has(def.id)) continue
    const orig = origRows.get(def.id)
    const now = [d.value ?? null, !!d.display_in_graph, d.timeframe ?? null]
    const was = [orig?.value ?? null, !!orig?.display_in_graph, orig?.timeframe ?? null]
    const empty = now[0] == null && !now[1] && now[2] == null
    if (JSON.stringify(now) === JSON.stringify(was)) {
      // unchanged — but a brand-new person keeps its session traits attached
      if (!store.editingPerson && empty && sessionDefIds.value.has(def.id)) {
        values.push({ field_id: def.id, value: null })
      }
      continue
    }
    if (empty && orig && def.locked) removals.push(def.id)
    else
      values.push({
        field_id: def.id,
        // clone() strips Vue reactivity — raw Proxies can't cross the IPC boundary
        value: clone(d.value),
        display_in_graph: !!d.display_in_graph,
        timeframe: clone(d.timeframe)
      })
  }
  return { values, removals }
}

async function save() {
  submitting.value = true
  formError.value = ''
  try {
    const { values, removals } = collectChanges()
    if (store.editingPerson) {
      const res = await store.setFieldValues(store.editingPerson.id, values, removals)
      if (!res.success) return flashError(res.error || 'Could not save')
      await createPendingLinks(store.editingPerson.id)
    } else {
      const res = await store.createPerson({ values })
      if (!res.success) return flashError(res.error || 'Could not create')
      await createPendingLinks(res.data.id)
      store.refreshFields()
    }
    store.closeForm()
  } finally {
    submitting.value = false
  }
}

async function cancel() {
  // A cancelled Add leaves no orphans: unlocked, unslotted defs created this
  // session with no stored values are removed again.
  if (!store.editingPerson) {
    for (const id of sessionDefIds.value) {
      const def = store.fieldDefs.find((d) => d.id === id)
      const hasValues = store.fieldValues.some((v) => v.field_id === id)
      if (def && !def.locked && !def.slot && !hasValues) await store.deleteFieldDef(id)
    }
  }
  store.closeForm()
}

function scrollToSection(id) {
  sectionEls[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<style scoped>
.pf-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(3px);
  display: grid;
  place-items: center;
  z-index: 200;
  padding: 24px;
}

.pf-sheet {
  width: min(880px, 96vw);
  height: min(88vh, 780px);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: var(--shadow);
  display: flex;
  overflow: hidden;
  position: relative;
}

/* entrance */
.sheet-enter-active {
  transition: opacity 0.25s ease;
}
.sheet-leave-active {
  transition: opacity 0.18s ease;
}
.sheet-enter-active .pf-sheet {
  animation: sheet-in 0.34s cubic-bezier(0.26, 1.3, 0.5, 1);
}
.sheet-leave-active .pf-sheet {
  animation: sheet-out 0.18s ease forwards;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
@keyframes sheet-in {
  from {
    transform: translateY(22px) scale(0.965);
    opacity: 0;
  }
}
@keyframes sheet-out {
  to {
    transform: translateY(12px) scale(0.98);
    opacity: 0;
  }
}

/* ── left rail ── */
.pf-rail {
  width: 232px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  position: relative;
  overflow: hidden;
  display: flex;
}
.pf-rail-aurora {
  position: absolute;
  inset: -40%;
  background:
    radial-gradient(38% 30% at 30% 25%, var(--adim), transparent 70%),
    radial-gradient(
      30% 26% at 72% 62%,
      color-mix(in srgb, var(--pink) 12%, transparent),
      transparent 70%
    ),
    radial-gradient(
      34% 30% at 42% 86%,
      color-mix(in srgb, var(--green) 9%, transparent),
      transparent 70%
    );
  animation: aurora 16s ease-in-out infinite alternate;
  pointer-events: none;
}
@keyframes aurora {
  from {
    transform: rotate(0deg) scale(1);
  }
  to {
    transform: rotate(8deg) scale(1.15);
  }
}
@media (prefers-reduced-motion: reduce) {
  .pf-rail-aurora {
    animation: none;
  }
}
.pf-rail-inner {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 24px 16px;
}
.pf-rail-life {
  font-size: 11px;
  color: var(--t2);
  letter-spacing: 0.4px;
}
.pf-rail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  justify-content: center;
}
.pf-rail-tag {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--tc);
  background: color-mix(in srgb, var(--tc) 13%, transparent);
  color: var(--t1);
}
.pf-rail-note {
  position: absolute;
  bottom: 12px;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--t3);
}

/* ── right pane ── */
.pf-pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.pf-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.pf-title {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--t1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 240px;
}
.pf-nav {
  display: flex;
  gap: 4px;
  margin-left: auto;
}
.pf-nav-chip {
  border: none;
  background: transparent;
  color: var(--t3);
  font-family: var(--font);
  font-size: 11px;
  font-weight: 600;
  padding: 4px 9px;
  border-radius: 999px;
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s;
}
.pf-nav-chip:hover {
  color: var(--t1);
  background: var(--hover);
}
.pf-close {
  border: none;
  background: transparent;
  color: var(--t3);
  font-size: 14px;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 8px;
}
.pf-close:hover {
  color: var(--t1);
  background: var(--hover);
}

.pf-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px 28px;
  display: flex;
  flex-direction: column;
  gap: 26px;
  scroll-behavior: smooth;
}
.pf-section {
  display: flex;
  flex-direction: column;
  gap: 11px;
  scroll-margin-top: 8px;
}
.pf-section-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.9px;
  color: var(--t3);
  padding-bottom: 3px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.pf-section-hint {
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0.2px;
  font-size: 9.5px;
  margin-left: auto;
}
.pf-hint {
  font-size: 12px;
  color: var(--t3);
  font-style: italic;
}

/* trait list + FLIP */
.pf-field-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.fl-move,
.fl-enter-active,
.fl-leave-active {
  transition:
    transform 0.3s cubic-bezier(0.34, 1.4, 0.64, 1),
    opacity 0.2s;
}
.fl-enter-from {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
.fl-leave-to {
  opacity: 0;
  transform: scale(0.97);
}
.fl-leave-active {
  position: absolute;
  width: 100%;
}
.pf-field-row.ghosted {
  opacity: 0.35;
  filter: saturate(0.5);
}

/* drag ghost */
.pf-ghost {
  position: fixed;
  z-index: 400;
  pointer-events: none;
  padding: 7px 13px;
  border-radius: 10px;
  background: var(--elevated);
  border: 1px solid var(--accent);
  color: var(--t1);
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  transform: rotate(1.5deg);
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.pf-ghost.valid {
  border-color: var(--green);
  box-shadow: 0 12px 32px color-mix(in srgb, var(--green) 30%, transparent);
}
.pf-ghost.invalid {
  border-color: #ef5350;
  animation: ghost-shake 0.3s;
}
@keyframes ghost-shake {
  25% {
    transform: rotate(1.5deg) translateX(-3px);
  }
  75% {
    transform: rotate(1.5deg) translateX(3px);
  }
}

/* relationships */
.pf-rels {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
}
.pf-rel-card {
  background: var(--elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 9px 12px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.pf-rel-new {
  border-color: color-mix(in srgb, var(--green) 30%, transparent);
  background: color-mix(in srgb, var(--green) 6%, var(--elevated));
}
.pf-rel-top {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}
.pf-rel-type {
  font-weight: 700;
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--accent);
}
.pf-rel-name {
  color: var(--t1);
  font-size: 12.5px;
  font-weight: 600;
}
.pf-rel-divorced {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  color: #ef5350;
  background: rgba(239, 83, 80, 0.12);
  padding: 2px 7px;
  border-radius: 8px;
}
.pf-rel-pending {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--green);
  background: color-mix(in srgb, var(--green) 14%, transparent);
  padding: 2px 7px;
  border-radius: 8px;
}
.pf-rel-x {
  margin-left: auto;
  border: none;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  font-size: 11px;
}
.pf-rel-x:hover {
  color: #ef5350;
}
.pf-rel-fields {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.pf-rel-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 90px;
  max-width: 160px;
}
.pf-rel-field span {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--t3);
}
.pf-rel-field input,
.pf-rel-field select {
  font-size: 11px;
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--t1);
  outline: none;
}

/* Derived siblings: read-only chips that ripple in */
.pf-sibs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.pf-sibs-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--t3);
}
.pf-sib-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border: 1px solid color-mix(in srgb, #58b5bc 40%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, #58b5bc 12%, transparent);
  color: var(--t1);
  font-size: 11.5px;
  font-weight: 600;
  animation: pf-sib-in 0.4s cubic-bezier(0.3, 1.5, 0.4, 1) backwards;
  animation-delay: calc(var(--i, 0) * 0.06s);
}
@keyframes pf-sib-in {
  from {
    opacity: 0;
    transform: scale(0.5);
  }
}
.pf-sibs-hint {
  font-size: 10px;
  color: var(--t3);
  font-style: italic;
}

.pf-intent-band {
  margin-bottom: 10px;
}
.pf-band-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--t3);
  margin-bottom: 5px;
}
.pf-intents {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
}
.pf-intent {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border: 1.5px dashed var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1),
    border-color 0.15s,
    color 0.15s,
    background 0.15s;
}
.pf-intent:hover {
  transform: translateY(-1.5px);
  border-color: var(--accent);
  color: var(--accent);
}
.pf-intent.active {
  border-style: solid;
  border-color: var(--accent);
  background: var(--adim);
  color: var(--accent);
}
.pf-intent-glyph {
  font-size: 13px;
}
.pf-picker {
  margin-top: 2px;
}

/* image slots */
.pf-img-slots {
  display: grid;
  grid-template-columns: 108px 108px 1fr;
  gap: 10px;
  align-items: stretch;
}
.pf-img-slot {
  position: relative;
  border: 1.5px dashed var(--border);
  border-radius: 12px;
  min-height: 118px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  overflow: hidden;
  background: color-mix(in srgb, var(--elevated) 40%, transparent);
  transition:
    border-color 0.2s,
    transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.pf-img-slot:not(.filled):hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}
.pf-img-slot:not(.filled)::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 40%,
    rgba(255, 255, 255, 0.05) 50%,
    transparent 60%
  );
  background-size: 220% 100%;
  animation: shimmer 2.8s linear infinite;
}
@keyframes shimmer {
  from {
    background-position: 130% 0;
  }
  to {
    background-position: -90% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pf-img-slot::after {
    animation: none;
  }
}
.pf-img-portrait {
  border-radius: 50% / 42%;
}
.pf-img-slot.filled {
  border-style: solid;
  cursor: default;
}
.pf-img-slot img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation: img-settle 0.35s cubic-bezier(0.26, 1.2, 0.5, 1);
}
@keyframes img-settle {
  from {
    transform: scale(1.12);
    opacity: 0;
  }
}
.pf-img-glyph {
  font-size: 21px;
  opacity: 0.75;
}
.pf-img-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--t3);
}
.pf-img-x {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  border: none;
  border-radius: 6px;
  width: 20px;
  height: 20px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 10px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}
.pf-img-slot:hover .pf-img-x {
  opacity: 1;
}

.pf-extras {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.pf-extra {
  position: relative;
  width: 62px;
  height: 62px;
  border-radius: 9px;
  overflow: hidden;
  border: 1px solid var(--border);
}
.pf-extra img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pf-extra-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  background: rgba(0, 0, 0, 0.55);
  opacity: 0;
  transition: opacity 0.15s;
}
.pf-extra:hover .pf-extra-overlay {
  opacity: 1;
}
.pf-extra-btn {
  border: none;
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  border-radius: 5px;
  width: 18px;
  height: 18px;
  font-size: 9px;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.pf-extra-btn:hover {
  background: rgba(255, 255, 255, 0.4);
}
.pf-extra-del:hover {
  background: rgba(239, 83, 80, 0.65);
}
.pf-extra-add {
  width: 62px;
  height: 62px;
  border: 1.5px dashed var(--border);
  border-radius: 9px;
  background: transparent;
  color: var(--t3);
  font-family: var(--font);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition:
    border-color 0.15s,
    color 0.15s;
}
.pf-extra-add span {
  font-size: 8.5px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.pf-extra-add:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* footer */
.pf-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
.pf-error {
  margin-right: auto;
  font-size: 11.5px;
  color: #ef5350;
  animation: fr-slide 0.2s ease-out;
}
@keyframes fr-slide {
  from {
    transform: translateY(3px);
    opacity: 0;
  }
}
</style>
