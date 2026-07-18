<template>
  <Transition name="apane">
    <div v-if="mode" class="action-pane" :class="{ 'ap-clean': store.cleanView }" @click.stop>
      <Transition name="apmode" mode="out-in">
        <!-- ══ Relationship line selected ═══════════════════════════════════ -->
        <div v-if="mode === 'rel'" key="rel" class="ap-inner">
          <div class="ap-header">
            <span class="ap-glyph" :style="{ '--pc': relColor }">{{ relDef?.glyph || '·' }}</span>
            <div class="ap-title-wrap">
              <div class="ap-title">{{ relTitle }}</div>
              <div class="ap-sub">
                <b :style="{ color: colorOf(rel.person_a_id) }">{{ nameOf(rel.person_a_id) }}</b>
                <span class="ap-dir">{{ relDef?.directed ? '→' : '—' }}</span>
                <b :style="{ color: colorOf(rel.person_b_id) }">{{ nameOf(rel.person_b_id) }}</b>
              </div>
              <div v-if="relDates" class="ap-dates">{{ relDates }}</div>
            </div>
            <button class="ap-close" title="Dismiss (Esc)" @click="close">✕</button>
          </div>

          <div v-if="relStatuses.length > 1" class="ap-row ap-stagger" style="--i: 0">
            <span class="ap-sec-label">Status</span>
            <div class="ap-seg">
              <button
                v-for="s in relStatuses"
                :key="s"
                class="ap-seg-opt"
                :class="{ on: rel.status === s }"
                @click="setRelStatus(s)"
              >
                {{ statusLabel(s) }}
              </button>
            </div>
          </div>

          <div class="ap-actions ap-stagger" style="--i: 1">
            <button
              v-if="relDef?.directed"
              class="ap-btn"
              title="Reverse who is who in this bond"
              @click="swapRel"
            >
              <span class="ap-ic">⇄</span>Swap
            </button>
            <button
              class="ap-btn"
              :class="{ on: soloType === rel.type }"
              title="Isolate this relationship type on the canvas"
              @click="$emit('solo', rel.type)"
            >
              <span class="ap-ic">✦</span>Isolate
            </button>
            <button
              class="ap-btn"
              title="Open the Relationships view"
              @click="store.activeView = 'relationships'"
            >
              <span class="ap-ic">↗</span>All bonds
            </button>
          </div>

          <div class="ap-danger-row ap-stagger" style="--i: 2">
            <button class="ap-btn ap-btn-danger" @click="deleteRel">
              <span class="ap-ic">🗑</span>Delete bond
            </button>
          </div>
        </div>

        <!-- ══ One or more people selected ══════════════════════════════════ -->
        <div v-else key="people" class="ap-inner">
          <div class="ap-header">
            <div class="ap-avatars">
              <span
                v-for="(pid, i) in headIds"
                :key="pid"
                class="ap-dot"
                :style="{ '--pc': colorOf(pid), '--d': i }"
              ></span>
              <span v-if="extraCount" class="ap-dot ap-dot-more">+{{ extraCount }}</span>
            </div>
            <div class="ap-title-wrap">
              <div class="ap-title">{{ peopleTitle }}</div>
              <div class="ap-sub">{{ peopleSub }}</div>
            </div>
            <button class="ap-close" title="Clear selection (Esc)" @click="close">✕</button>
          </div>

          <!-- Single person: the verb row -->
          <div v-if="n === 1" class="ap-actions ap-stagger" style="--i: 0">
            <button class="ap-btn" title="Open the profile card" @click="openDetails">
              <span class="ap-ic">👁</span>Details
            </button>
            <button
              class="ap-btn"
              :title="`Edit this ${store.noun.toLowerCase()}`"
              @click="openEdit"
            >
              <span class="ap-ic">✏️</span>Edit
            </button>
            <button
              v-if="!mode3d"
              class="ap-btn"
              title="Glide the camera to this node"
              @click="$emit('focus-person', ids[0])"
            >
              <span class="ap-ic">🎯</span>Focus
            </button>
            <button
              v-if="!mode3d"
              class="ap-btn"
              title="Trace a connection — then click another person"
              @click="$emit('trace', ids[0])"
            >
              <span class="ap-ic">🧭</span>Trace
            </button>
            <button
              v-if="canPin"
              class="ap-btn"
              :class="{ on: pinned }"
              :title="pinned ? 'Release the node back to the simulation' : 'Pin the node in place'"
              @click="$emit('toggle-pin')"
            >
              <span class="ap-ic">📌</span>{{ pinned ? 'Unpin' : 'Pin' }}
            </button>
          </div>

          <!-- Exactly two: forge a relationship between them -->
          <div v-if="n === 2" class="ap-section ap-stagger" style="--i: 0">
            <div class="ap-sec-head">
              <span class="ap-sec-label">Link</span>
              <button
                class="ap-swap"
                title="Swap direction (matters for parent → child, admirer → crush…)"
                @click="flipped = !flipped"
              >
                <b :style="{ color: colorOf(pairA) }">{{ shortName(pairA) }}</b>
                <span class="ap-swap-arrow">→</span>
                <b :style="{ color: colorOf(pairB) }">{{ shortName(pairB) }}</b>
                <span class="ap-swap-ic">⇄</span>
              </button>
            </div>
            <div class="ap-chips">
              <button
                v-for="d in linkTypes"
                :key="d.key"
                class="ap-chip"
                :class="{ done: existingTypes.has(d.key) }"
                :style="{ '--rc': chipColor(d) }"
                :disabled="existingTypes.has(d.key)"
                :title="chipTitle(d)"
                @click="link(d)"
              >
                <span class="ap-chip-glyph">{{ d.glyph }}</span
                >{{ d.label }}
                <span v-if="existingTypes.has(d.key)" class="ap-chip-check">✓</span>
              </button>
            </div>
            <Transition name="apflash">
              <div v-if="justLinked" class="ap-flash">✨ Linked — {{ justLinked }}</div>
            </Transition>
            <button
              v-if="!mode3d"
              class="ap-btn ap-btn-full"
              title="Light up the shortest chain between them"
              @click="$emit('trace-pair', [pairA, pairB])"
            >
              <span class="ap-ic">🧭</span>Trace connection
            </button>
          </div>

          <!-- Node styling (2D canvas only) — applies to the whole selection -->
          <div v-if="!mode3d" class="ap-section ap-stagger" style="--i: 1">
            <div class="ap-row">
              <span class="ap-sec-label">Size</span>
              <div class="ap-seg">
                <button
                  v-for="s in SIZES"
                  :key="s.label"
                  class="ap-seg-opt"
                  :class="{ on: styleSize === s.v }"
                  :title="s.title"
                  @click="$emit('set-size', s.v)"
                >
                  {{ s.label }}
                </button>
              </div>
            </div>
            <div class="ap-row">
              <span class="ap-sec-label">Color</span>
              <div class="ap-swatches">
                <button
                  class="ap-swatch ap-swatch-auto"
                  :class="{ on: !styleColor }"
                  title="Auto — the gender gradient"
                  @click="$emit('set-color', null)"
                ></button>
                <button
                  v-for="c in COLORS"
                  :key="c"
                  class="ap-swatch"
                  :class="{ on: styleColor === c }"
                  :style="{ background: c }"
                  @click="$emit('set-color', c)"
                ></button>
              </div>
            </div>
          </div>

          <div class="ap-danger-row ap-stagger" :style="{ '--i': 2 }">
            <button class="ap-btn ap-btn-danger" @click="deleteSelected">
              <span class="ap-ic">🗑</span>Delete{{ n > 1 ? ` ${n}` : '' }}
            </button>
            <button
              v-if="n > 1"
              class="ap-btn"
              title="Keep everyone, drop the selection"
              @click="close"
            >
              Clear
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useMainStore } from '../../store/index.js'
import { nodeColor } from './linkHelpers.js'

defineProps({
  mode3d: { type: Boolean, default: false },
  canPin: { type: Boolean, default: false },
  pinned: { type: Boolean, default: false },
  styleSize: { type: Number, default: 1 },
  styleColor: { type: String, default: null },
  soloType: { type: String, default: null }
})
defineEmits(['focus-person', 'trace', 'trace-pair', 'toggle-pin', 'set-size', 'set-color', 'solo'])

const store = useMainStore()

const SIZES = [
  { label: 'S', v: 0.7, title: 'Small' },
  { label: 'M', v: 1, title: 'Default' },
  { label: 'L', v: 1.4, title: 'Large' },
  { label: 'XL', v: 1.9, title: 'Huge' }
]
// Same presets the Groups view offers, so accents feel like one family.
const COLORS = [
  '#6c8ef5',
  '#f06292',
  '#f5a623',
  '#4caf72',
  '#a06cf5',
  '#26c6da',
  '#ef5350',
  '#8a93a6'
]

// ── Selection state ─────────────────────────────────────────────────────────
const rel = computed(() => store.relPopup?.rel || null)
const ids = computed(() => store.selectedPersonIds)
const n = computed(() => ids.value.length)
const mode = computed(() => (rel.value ? 'rel' : n.value ? 'people' : null))

function personOf(id) {
  return store.persons.find((p) => p.id === id) || null
}
function nameOf(id) {
  return personOf(id)?.name || 'Unnamed'
}
function shortName(id) {
  return nameOf(id).split(/\s+/)[0]
}
function colorOf(id) {
  const p = personOf(id)
  return p ? nodeColor(p.gender, store.graphSettings, p.gender_t) : 'var(--accent)'
}

function close() {
  store.relPopup = null
  store.selectPerson(null, { modal: false })
}

// ── People mode ─────────────────────────────────────────────────────────────
const headIds = computed(() => ids.value.slice(0, 4))
const extraCount = computed(() => Math.max(0, n.value - 4))
const peopleTitle = computed(() => {
  if (n.value === 1) return nameOf(ids.value[0])
  if (n.value === 2) return `${shortName(ids.value[0])} & ${shortName(ids.value[1])}`
  return `${n.value} selected`
})
const peopleSub = computed(() => {
  if (n.value === 1) {
    const p = personOf(ids.value[0])
    const b = p?.birth?.year,
      d = p?.death?.year
    if (b && d) return `${b} – ${d}`
    if (b) return `b. ${b}`
    if (d) return `d. ${d}`
    return store.noun
  }
  if (n.value === 2) return 'Forge a bond, or style them together'
  return 'Styling applies to everyone selected'
})

function openDetails() {
  store.relPopup = null
  store.selectPerson(ids.value[0]) // modal: true — the profile card
}
function openEdit() {
  const p = personOf(ids.value[0])
  if (p) store.openForm(p)
}

async function deleteSelected() {
  const count = n.value
  const label =
    count === 1
      ? `Delete ${nameOf(ids.value[0])} and their relationships?`
      : `Delete these ${count} people and all their relationships?`
  if (!confirm(label)) return
  for (const id of [...ids.value]) await store.deletePerson(id)
  store.selectPerson(null, { modal: false })
}

// ── Pair linking (exactly two selected) ─────────────────────────────────────
// Selection order decides direction (first → second); ⇄ flips it. Direction
// only matters for directed types (parent → child, admirer → crush…).
const flipped = ref(false)
watch(ids, () => {
  flipped.value = false
  justLinked.value = ''
})
const pairA = computed(() => (flipped.value ? ids.value[1] : ids.value[0]))
const pairB = computed(() => (flipped.value ? ids.value[0] : ids.value[1]))

// Simple mode keeps the picker to the family band, same as PersonForm's chips.
const linkTypes = computed(() =>
  store.caps.relTypePicker ? store.relTypes : store.relTypes.filter((d) => d.band === 'family')
)
const existingTypes = computed(() => {
  const [a, b] = [pairA.value, pairB.value]
  const set = new Set()
  for (const r of store.relationships) {
    if (
      (r.person_a_id === a && r.person_b_id === b) ||
      (r.person_a_id === b && r.person_b_id === a)
    )
      set.add(r.type)
  }
  return set
})
function chipColor(def) {
  const gs = store.graphSettings
  if (def.key === 'spouse') return gs.spouseColor
  if (def.key === 'adopted') return gs.adoptedColor
  if (def.key === 'parent_child') return gs.parentChildColor
  return def.color || gs.parentChildColor
}
function chipTitle(def) {
  if (existingTypes.value.has(def.key)) return 'Already linked'
  if (def.directed && def.role_a)
    return `${shortName(pairA.value)} becomes ${def.role_a.toLowerCase()} of ${shortName(pairB.value)}`
  return `Link ${shortName(pairA.value)} and ${shortName(pairB.value)} as ${def.label.toLowerCase()}`
}

const justLinked = ref('')
let linkedTimer = null
async function link(def) {
  if (existingTypes.value.has(def.key)) return
  const res = await store.createRelationship({
    person_a_id: pairA.value,
    person_b_id: pairB.value,
    type: def.key
  })
  if (res?.success) {
    justLinked.value = def.label
    if (linkedTimer) clearTimeout(linkedTimer)
    linkedTimer = setTimeout(() => (justLinked.value = ''), 1800)
  }
}

// ── Relationship mode ───────────────────────────────────────────────────────
const relDef = computed(() => (rel.value ? store.relTypeByKey.get(rel.value.type) : null))
const relColor = computed(() => (relDef.value ? chipColor(relDef.value) : 'var(--accent)'))
const relTitle = computed(() => {
  const r = rel.value
  if (!r) return ''
  if (r.label) return r.label // per-edge custom label wins
  if (r.type === 'spouse') return r.status === 'divorced' ? 'Divorced' : 'Married'
  return relDef.value?.label || r.type
})
const relDates = computed(() => {
  const r = rel.value
  if (!r) return ''
  if (r.formed?.year) {
    const from = r.type === 'spouse' ? `Married ${r.formed.year}` : `Since ${r.formed.year}`
    return r.ended?.year ? `${from} — ${r.ended.year}` : from
  }
  if (r.ended?.year) return `Ended ${r.ended.year}`
  return ''
})
const relStatuses = computed(() => relDef.value?.statuses || [])
function statusLabel(s) {
  if (rel.value?.type === 'spouse' && s === 'active') return 'Married'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

async function setRelStatus(status) {
  const r = rel.value
  if (!r || r.status === status) return
  const res = await store.updateRelationship({ id: r.id, status })
  if (res?.success) store.relPopup = { rel: res.data }
}
async function swapRel() {
  const r = rel.value
  if (!r) return
  const res = await store.updateRelationship({
    id: r.id,
    person_a_id: r.person_b_id,
    person_b_id: r.person_a_id
  })
  if (res?.success) store.relPopup = { rel: res.data }
}
async function deleteRel() {
  const r = rel.value
  if (!r) return
  if (!confirm(`Delete this ${relTitle.value.toLowerCase()} bond?`)) return
  const res = await store.deleteRelationship(r.id)
  if (res?.success) store.relPopup = null
}
</script>

<style scoped>
/* ── The pane: a glass card docked lower-left, clear of the time slider ───── */
.action-pane {
  position: absolute;
  left: 84px;
  bottom: 18px;
  z-index: 7;
  width: 272px;
  background: var(--glass-strong);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
  overflow: hidden;
  transition:
    transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s ease;
}
/* A hairline accent shimmer along the top edge — the pane's signature. */
.action-pane::before {
  content: '';
  position: absolute;
  top: 0;
  left: 10%;
  right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  opacity: 0.55;
  animation: ap-shimmer 3.2s ease-in-out infinite;
}
@keyframes ap-shimmer {
  0%,
  100% {
    opacity: 0.25;
  }
  50% {
    opacity: 0.7;
  }
}
.ap-clean {
  transform: translateY(calc(100% + 30px));
  opacity: 0;
  pointer-events: none;
}

.ap-inner {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
}

/* Pane in/out: rises from the slider rail with a soft blur-focus. */
.apane-enter-active {
  transition:
    opacity 0.3s ease,
    transform 0.42s cubic-bezier(0.22, 1.15, 0.36, 1),
    filter 0.3s ease;
}
.apane-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.24s cubic-bezier(0.4, 0, 1, 1),
    filter 0.2s ease;
}
.apane-enter-from,
.apane-leave-to {
  opacity: 0;
  transform: translateY(26px) scale(0.94);
  filter: blur(7px);
}

/* Content morph when the selection kind changes (person ⇄ pair ⇄ bond). */
.apmode-enter-active {
  transition:
    opacity 0.18s ease,
    transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.apmode-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}
.apmode-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.apmode-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* Rows cascade in. */
.ap-stagger {
  animation: ap-row-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: calc(0.08s + var(--i, 0) * 0.05s);
}
@keyframes ap-row-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}

/* ── Header ────────────────────────────────────────────────────────────────── */
.ap-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.ap-avatars {
  display: flex;
  align-items: center;
  padding-top: 2px;
}
.ap-dot {
  --pc: var(--accent);
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--pc);
  border: 2px solid var(--surface);
  margin-left: -6px;
  animation: ap-dot-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
  animation-delay: calc(0.1s + var(--d, 0) * 0.06s);
  box-shadow: 0 0 10px color-mix(in srgb, var(--pc) 45%, transparent);
}
.ap-dot:first-child {
  margin-left: 0;
}
@keyframes ap-dot-pop {
  from {
    transform: scale(0);
  }
}
.ap-dot-more {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hover);
  color: var(--t2);
  font-size: 8px;
  font-weight: 700;
  box-shadow: none;
}
.ap-glyph {
  --pc: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  flex-shrink: 0;
  font-size: 15px;
  color: var(--pc);
  background: color-mix(in srgb, var(--pc) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--pc) 30%, transparent);
  animation: ap-dot-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
}
.ap-title-wrap {
  flex: 1;
  min-width: 0;
}
.ap-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--t1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ap-sub {
  font-size: 11px;
  color: var(--t3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ap-sub b {
  font-weight: 600;
}
.ap-dir {
  margin: 0 4px;
  opacity: 0.7;
}
.ap-dates {
  font-size: 10px;
  color: var(--t3);
  margin-top: 1px;
}
.ap-close {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--t3);
  font-size: 11px;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.12s,
    color 0.12s;
}
.ap-close:hover {
  background: var(--hover);
  color: var(--t1);
}

/* ── Buttons ───────────────────────────────────────────────────────────────── */
.ap-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.ap-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 9px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: var(--hover);
  color: var(--t2);
  font-family: var(--font);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease,
    transform 0.18s cubic-bezier(0.34, 1.5, 0.5, 1),
    box-shadow 0.18s ease;
}
.ap-btn:hover {
  color: var(--t1);
  border-color: var(--border);
  transform: translateY(-1.5px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
}
.ap-btn:active {
  transform: translateY(0) scale(0.97);
}
.ap-btn.on {
  background: var(--adim);
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
}
.ap-btn-full {
  width: 100%;
  justify-content: center;
  margin-top: 2px;
}
.ap-ic {
  font-size: 12px;
  line-height: 1;
}
.ap-btn-danger {
  color: #ef5350;
  background: rgba(239, 83, 80, 0.1);
}
.ap-btn-danger:hover {
  color: #ff6f6c;
  background: rgba(239, 83, 80, 0.18);
  border-color: rgba(239, 83, 80, 0.4);
}
.ap-danger-row {
  display: flex;
  gap: 5px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

/* ── Sections & rows ───────────────────────────────────────────────────────── */
.ap-section {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.ap-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ap-sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.ap-sec-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--t3);
  flex-shrink: 0;
  width: 34px;
}

/* Segmented control (size / bond status). */
.ap-seg {
  display: flex;
  flex: 1;
  gap: 2px;
  background: var(--hover);
  border-radius: 8px;
  padding: 2px;
}
.ap-seg-opt {
  flex: 1;
  padding: 4px 2px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--t3);
  font-family: var(--font);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  transition:
    background 0.16s ease,
    color 0.16s ease,
    transform 0.16s cubic-bezier(0.34, 1.5, 0.5, 1);
}
.ap-seg-opt:hover {
  color: var(--t1);
  transform: translateY(-1px);
}
.ap-seg-opt.on {
  background: var(--adim);
  color: var(--accent);
}

/* Color swatches. */
.ap-swatches {
  display: flex;
  flex: 1;
  gap: 4px;
  flex-wrap: wrap;
}
.ap-swatch {
  width: 17px;
  height: 17px;
  border-radius: 50%;
  border: 2px solid transparent;
  padding: 0;
  cursor: pointer;
  transition:
    transform 0.16s cubic-bezier(0.34, 1.6, 0.64, 1),
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}
.ap-swatch:hover {
  transform: scale(1.22);
}
.ap-swatch.on {
  border-color: var(--t1);
  transform: scale(1.12);
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.3);
}
.ap-swatch-auto {
  background: conic-gradient(var(--accent), #c95fa0, #3a7bd5, var(--accent));
  position: relative;
}
.ap-swatch-auto::after {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  background: var(--surface);
}

/* Relationship-type chips for the pair. */
.ap-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-height: 118px;
  overflow-y: auto;
}
.ap-chip {
  --rc: var(--accent);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid color-mix(in srgb, var(--rc) 28%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--rc) 8%, transparent);
  color: var(--t2);
  font-family: var(--font);
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    transform 0.18s cubic-bezier(0.34, 1.5, 0.5, 1),
    box-shadow 0.18s ease;
}
.ap-chip:hover:not(:disabled) {
  background: color-mix(in srgb, var(--rc) 18%, transparent);
  color: var(--t1);
  transform: translateY(-1.5px);
  box-shadow: 0 3px 10px color-mix(in srgb, var(--rc) 25%, transparent);
}
.ap-chip:disabled {
  opacity: 0.45;
  cursor: default;
}
.ap-chip-glyph {
  color: var(--rc);
  font-size: 11px;
}
.ap-chip-check {
  color: var(--rc);
  font-weight: 700;
}

/* The direction pill (who → whom) with its swap affordance. */
.ap-swap {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 10.5px;
  cursor: pointer;
  min-width: 0;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}
.ap-swap b {
  font-weight: 600;
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ap-swap:hover {
  background: var(--hover);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
}
.ap-swap:hover .ap-swap-ic {
  transform: rotate(180deg);
}
.ap-swap-arrow {
  opacity: 0.6;
}
.ap-swap-ic {
  color: var(--accent);
  font-size: 12px;
  transition: transform 0.3s cubic-bezier(0.34, 1.4, 0.64, 1);
}

/* "Linked!" confirmation flash. */
.ap-flash {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  text-align: center;
  padding: 3px 0;
}
.apflash-enter-active {
  transition:
    opacity 0.2s ease,
    transform 0.28s cubic-bezier(0.34, 1.5, 0.64, 1);
}
.apflash-leave-active {
  transition: opacity 0.25s ease;
}
.apflash-enter-from {
  opacity: 0;
  transform: scale(0.8);
}
.apflash-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .ap-stagger,
  .ap-dot,
  .ap-glyph,
  .action-pane::before {
    animation: none;
  }
}
</style>
