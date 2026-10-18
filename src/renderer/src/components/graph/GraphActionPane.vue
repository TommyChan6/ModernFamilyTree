<template>
  <Transition name="apane">
    <div v-if="mode" class="action-pane" :class="{ 'ap-clean': store.cleanView }" @click.stop>
      <Transition name="apmode" mode="out-in">
        <!-- ══ Relationship line selected ═══════════════════════════════════ -->
        <div v-if="mode === 'rel'" key="rel" class="ap-inner">
          <div class="ap-header">
            <span class="ap-glyph" :style="{ '--pc': relColor }">
              <UiIcon :name="iconOr(relDef?.glyph, 'link')" :size="16" />
            </span>
            <div class="ap-title-wrap">
              <div class="ap-title">{{ relTitle }}</div>
              <div class="ap-sub">
                <b :style="{ color: colorOf(rel.person_a_id) }">{{ nameOf(rel.person_a_id) }}</b>
                <UiIcon
                  class="ap-dir"
                  :name="relDef?.directed ? 'arrow-right' : 'minus'"
                  :size="12"
                />
                <b :style="{ color: colorOf(rel.person_b_id) }">{{ nameOf(rel.person_b_id) }}</b>
              </div>
              <div v-if="relDates" class="ap-dates">{{ relDates }}</div>
            </div>
            <button
              class="ap-close"
              :title="t('graphActions.dismissHint')"
              :aria-label="t('dialog.dismiss')"
              @click="close"
            >
              <UiIcon name="x" :size="14" />
            </button>
          </div>

          <div v-if="relStatuses.length > 1" class="ap-row ap-stagger" style="--i: 0">
            <span class="ap-sec-label">{{ t('graphActions.status') }}</span>
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
              :title="t('graphActions.swapHint')"
              @click="swapRel"
            >
              <UiIcon name="arrow-right-left" :size="14" />{{ t('graphActions.swap') }}
            </button>
            <button
              class="ap-btn"
              :class="{ on: soloType === rel.type }"
              :title="t('graphActions.isolateHint')"
              @click="$emit('solo', rel.type)"
            >
              <UiIcon name="filter" :size="14" />{{ t('graphActions.isolate') }}
            </button>
            <button
              class="ap-btn"
              :title="t('graphActions.allBondsHint')"
              @click="store.activeView = 'relationships'"
            >
              <UiIcon name="relationships" :size="14" />{{ t('graphActions.allBonds') }}
            </button>
          </div>

          <div class="ap-danger-row ap-stagger" style="--i: 2">
            <button class="ap-btn ap-btn-danger" @click="deleteRel">
              <UiIcon name="trash-2" :size="14" />{{ t('graphActions.deleteBond') }}
            </button>
          </div>
        </div>

        <!-- ══ Marquee selection (nodes + bonds, with a type filter) ═══════════ -->
        <div v-else-if="mode === 'marquee'" key="marquee" class="ap-inner">
          <div class="ap-header">
            <span class="ap-glyph ap-glyph-marquee"
              ><UiIcon name="square-dashed" :size="16"
            /></span>
            <div class="ap-title-wrap">
              <div class="ap-title">{{ marqueeTitle }}</div>
              <div class="ap-sub">{{ marqueeSub }}</div>
            </div>
            <button
              class="ap-close"
              :title="t('graphActions.clearSelHint')"
              :aria-label="t('graphActions.clearSel')"
              @click="close"
            >
              <UiIcon name="x" :size="14" />
            </button>
          </div>

          <div class="ap-row ap-stagger" style="--i: 0">
            <span class="ap-sec-label">{{ t('graphActions.pick') }}</span>
            <div class="ap-seg">
              <button
                v-for="f in FILTERS"
                :key="f.v"
                class="ap-seg-opt"
                :class="{ on: selFilter === f.v }"
                :title="t('graphActions.filters.' + f.v + '.title')"
                @click="setFilter(f.v)"
              >
                {{ t('graphActions.filters.' + f.v + '.label') }}
              </button>
            </div>
          </div>

          <!-- Bulk bond status: shown when every selected bond shares one type -->
          <div
            v-if="relCount && uniformStatuses.length > 1"
            class="ap-row ap-stagger"
            style="--i: 1"
          >
            <span class="ap-sec-label">{{ t('graphActions.status') }}</span>
            <div class="ap-seg">
              <button
                v-for="s in uniformStatuses"
                :key="s"
                class="ap-seg-opt"
                :class="{ on: uniformStatus === s }"
                :title="
                  t('graphActions.setAllStatus', {
                    count: relCount,
                    status: statusLabel(s, uniformRelDef?.key).toLowerCase()
                  })
                "
                @click="setStatusAll(s)"
              >
                {{ statusLabel(s, uniformRelDef?.key) }}
              </button>
            </div>
          </div>

          <!-- Node styling — applies to every selected person -->
          <div v-if="n && !mode3d && nodeStyle" class="ap-section ap-stagger" style="--i: 2">
            <div class="ap-row">
              <span class="ap-sec-label">{{ t('graphActions.size') }}</span>
              <div class="ap-seg">
                <button
                  v-for="s in SIZES"
                  :key="s.id"
                  class="ap-seg-opt"
                  :class="{ on: styleSize === s.v }"
                  :title="t('graphActions.sizes.' + s.id + '.title')"
                  @click="$emit('set-size', s.v)"
                >
                  {{ t('graphActions.sizes.' + s.id + '.label') }}
                </button>
              </div>
            </div>
            <div class="ap-row">
              <span class="ap-sec-label">{{ t('graphActions.color') }}</span>
              <div class="ap-swatches">
                <button
                  class="ap-swatch ap-swatch-auto"
                  :class="{ on: !styleColor }"
                  :title="t('graphActions.autoColor')"
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

          <div class="ap-danger-row ap-stagger" style="--i: 3">
            <button class="ap-btn ap-btn-danger" :disabled="!total" @click="deleteMarquee">
              <UiIcon name="trash-2" :size="14" />{{
                total ? t('graphActions.deleteN', { n: total }) : t('graphActions.delete')
              }}
            </button>
            <button class="ap-btn" :title="t('graphActions.clearKeepAll')" @click="close">
              {{ t('graphActions.clear') }}
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
            <button
              class="ap-close"
              :title="t('graphActions.clearSelHint')"
              :aria-label="t('graphActions.clearSel')"
              @click="close"
            >
              <UiIcon name="x" :size="14" />
            </button>
          </div>

          <!-- Single person: the verb row -->
          <div v-if="n === 1" class="ap-actions ap-stagger" style="--i: 0">
            <button class="ap-btn" :title="t('graphActions.detailsHint')" @click="openDetails">
              <UiIcon name="eye" :size="14" />{{ t('graphActions.details') }}
            </button>
            <button
              class="ap-btn"
              :title="t('graphActions.editHint', { noun: nounLabel(store.noun).toLowerCase() })"
              @click="openEdit"
            >
              <UiIcon name="pencil" :size="14" />{{ t('graphActions.edit') }}
            </button>
            <button
              v-if="!mode3d"
              class="ap-btn"
              :title="t('graphActions.focusHint')"
              @click="$emit('focus-person', ids[0])"
            >
              <UiIcon name="locate-fixed" :size="14" />{{ t('graphActions.focus') }}
            </button>
            <button
              v-if="!mode3d"
              class="ap-btn"
              :title="t('graphActions.traceHint')"
              @click="$emit('trace', ids[0])"
            >
              <UiIcon name="route" :size="14" />{{ t('graphActions.trace') }}
            </button>
            <button
              v-if="!mode3d"
              class="ap-btn"
              :title="t('graphActions.kinHint')"
              @click="$emit('kin-lens', ids[0])"
            >
              <UiIcon name="dna" :size="14" />{{ t('graphActions.kin') }}
            </button>
            <button
              v-if="!mode3d && spotlight"
              class="ap-btn"
              :title="t('graphActions.spotlightHint')"
              @click="$emit('spotlight', ids[0])"
            >
              <UiIcon name="star" :size="14" />{{ t('graphActions.spotlight') }}
            </button>
            <button
              v-if="canPin"
              class="ap-btn"
              :class="{ on: pinned }"
              :title="pinned ? t('graphActions.unpinHint') : t('graphActions.pinHint')"
              @click="$emit('toggle-pin')"
            >
              <UiIcon :name="pinned ? 'pin-off' : 'pin'" :size="14" />{{
                pinned ? t('graphActions.unpin') : t('graphActions.pin')
              }}
            </button>
          </div>

          <!-- Exactly two: forge a relationship between them -->
          <div v-if="n === 2" class="ap-section ap-stagger" style="--i: 0">
            <!-- What they already are to each other, before linking anything -->
            <button
              v-if="pairKin"
              class="ap-kin"
              :style="{ '--kc': pairKin.color }"
              :title="t('graphActions.pairKinHint')"
              @click="$emit('trace-pair', [pairA, pairB])"
            >
              <UiIcon class="ap-kin-ic" name="dna" :size="14" />
              <span class="ap-kin-text">
                <b :style="{ color: colorOf(pairB) }">{{ shortName(pairB) }}</b>
                <UiIcon class="ap-kin-arrow" name="arrow-right" :size="12" />
                <b :style="{ color: colorOf(pairA) }">{{ shortName(pairA) }}</b>
              </span>
              <span class="ap-kin-rel">{{ pairKin.text }}</span>
            </button>
            <div class="ap-sec-head">
              <span class="ap-sec-label">{{ t('graphActions.link') }}</span>
              <button
                class="ap-swap"
                :title="t('graphActions.swapDirHint')"
                @click="flipped = !flipped"
              >
                <b :style="{ color: colorOf(pairA) }">{{ shortName(pairA) }}</b>
                <UiIcon class="ap-swap-arrow" name="arrow-right" :size="12" />
                <b :style="{ color: colorOf(pairB) }">{{ shortName(pairB) }}</b>
                <UiIcon class="ap-swap-ic" name="arrow-right-left" :size="14" />
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
                <UiIcon class="ap-chip-glyph" :name="iconOr(d.glyph, 'link')" :size="12" />
                {{ relTypeLabel(d) }}
                <UiIcon
                  v-if="existingTypes.has(d.key)"
                  class="ap-chip-check"
                  name="check"
                  :size="12"
                />
              </button>
            </div>
            <Transition name="apflash">
              <div v-if="justLinked" class="ap-flash">
                <UiIcon name="check" :size="14" />{{
                  t('graphActions.linked', { label: justLinked })
                }}
              </div>
            </Transition>
            <button
              v-if="!mode3d"
              class="ap-btn ap-btn-full"
              :title="t('graphActions.traceConnectionHint')"
              @click="$emit('trace-pair', [pairA, pairB])"
            >
              <UiIcon name="route" :size="14" />{{ t('graphActions.traceConnection') }}
            </button>
          </div>

          <!-- Node styling (2D canvas only) — applies to the whole selection -->
          <div v-if="!mode3d && nodeStyle" class="ap-section ap-stagger" style="--i: 1">
            <div class="ap-row">
              <span class="ap-sec-label">{{ t('graphActions.size') }}</span>
              <div class="ap-seg">
                <button
                  v-for="s in SIZES"
                  :key="s.id"
                  class="ap-seg-opt"
                  :class="{ on: styleSize === s.v }"
                  :title="t('graphActions.sizes.' + s.id + '.title')"
                  @click="$emit('set-size', s.v)"
                >
                  {{ t('graphActions.sizes.' + s.id + '.label') }}
                </button>
              </div>
            </div>
            <div class="ap-row">
              <span class="ap-sec-label">{{ t('graphActions.color') }}</span>
              <div class="ap-swatches">
                <button
                  class="ap-swatch ap-swatch-auto"
                  :class="{ on: !styleColor }"
                  :title="t('graphActions.autoColor')"
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
              <UiIcon name="trash-2" :size="14" />{{
                n > 1 ? t('graphActions.deleteN', { n }) : t('graphActions.delete')
              }}
            </button>
            <button
              v-if="n > 1"
              class="ap-btn"
              :title="t('graphActions.clearKeepPeople')"
              @click="close"
            >
              {{ t('graphActions.clear') }}
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
import UiIcon, { hasIcon } from '../ui/UiIcon.js'
import { nodeColor } from './linkHelpers.js'
import { confirmDialog } from '../../lib/dialogs.js'
import { undoToast } from '../../lib/undoToast.js'
import { translate as tr, useI18n } from '../../i18n'
import { relTypeLabel, relRoleLabel, relStatusLabel, nounLabel } from '../../lib/dataLabels'
import { useKinship, kinClass, kinPalette } from '../kinship/useKinship'

defineProps({
  mode3d: { type: Boolean, default: false },
  canPin: { type: Boolean, default: false },
  pinned: { type: Boolean, default: false },
  styleSize: { type: Number, default: 1 },
  styleColor: { type: String, default: null },
  soloType: { type: String, default: null },
  // Hosts other than the graph (the Timeline) hide the graph-only verbs.
  spotlight: { type: Boolean, default: true },
  nodeStyle: { type: Boolean, default: true }
})
defineEmits([
  'focus-person',
  'trace',
  'trace-pair',
  'kin-lens',
  'spotlight',
  'toggle-pin',
  'set-size',
  'set-color',
  'solo'
])

const store = useMainStore()
const { t } = useI18n()

// Labels/titles: graphActions.sizes.<id>.*
const SIZES = [
  { id: 's', v: 0.7 },
  { id: 'm', v: 1 },
  { id: 'l', v: 1.4 },
  { id: 'xl', v: 1.9 }
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
// A marquee that caught any bonds gets its own pane with the Both/Nodes/Bonds
// filter (kept reachable even after narrowing to Nodes). A single clicked bond
// stays the dedicated 'rel' pane; a pure-node marquee or plain pick uses the
// richer 'people' pane (styling, pairing, pinning).
const marqueeHasBonds = computed(() => store.lastMarquee.relIds.length > 0)
const mode = computed(() => {
  if (rel.value) return 'rel'
  if (store.marqueeActive && marqueeHasBonds.value) return 'marquee'
  return n.value ? 'people' : null
})

// ── Marquee mode (mixed node + bond selection) ──────────────────────────────
// Labels/titles: graphActions.filters.<v>.*
const FILTERS = [{ v: 'both' }, { v: 'nodes' }, { v: 'bonds' }]
const relCount = computed(() => store.selectedRelationshipIds.length)
const total = computed(() => n.value + relCount.value)
const selFilter = computed(() => store.selectionFilter)
const nodeNoun = computed(() => nounLabel(store.noun).toLowerCase())
const marqueeTitle = computed(() => t('graphActions.selected', { n: total.value }))
const marqueeSub = computed(() => {
  const parts = []
  if (n.value)
    parts.push(
      t(n.value === 1 ? 'graphActions.nounCountOne' : 'graphActions.nounCountOther', {
        n: n.value,
        noun: nodeNoun.value
      })
    )
  if (relCount.value)
    parts.push(
      t(relCount.value === 1 ? 'graphActions.bondCountOne' : 'graphActions.bondCountOther', {
        n: relCount.value
      })
    )
  return parts.length ? parts.join(' · ') : t('graphActions.nothingInRange')
})
function setFilter(f) {
  store.applySelectionFilter(f)
}
// Bulk bond editing: when every selected bond shares one type, its status
// options apply to the whole set at once (mirrors the single-bond pane).
const selRelObjs = computed(() => {
  const byId = new Map(store.relationships.map((r) => [r.id, r]))
  return store.selectedRelationshipIds.map((id) => byId.get(id)).filter(Boolean)
})
const uniformRelDef = computed(() => {
  const rels = selRelObjs.value
  if (!rels.length) return null
  const type = rels[0].type
  return rels.every((r) => r.type === type) ? store.relTypeByKey.get(type) : null
})
const uniformStatuses = computed(() => uniformRelDef.value?.statuses || [])
const uniformStatus = computed(() => {
  const rels = selRelObjs.value
  if (!rels.length) return null
  const s = rels[0].status
  return rels.every((r) => r.status === s) ? s : null
})
async function setStatusAll(status) {
  for (const r of selRelObjs.value) {
    if (r.status !== status) await store.updateRelationship({ id: r.id, status })
  }
}
async function deleteMarquee() {
  const p = n.value,
    b = relCount.value
  if (!p && !b) return
  const title =
    p && b
      ? tr('confirm.deleteSelection', { people: p, bonds: b })
      : p
        ? p === 1
          ? tr('confirm.deletePerson', { name: nameOf(store.selectedPersonIds[0]) })
          : tr('confirm.deletePeople', { count: p })
        : tr('confirm.deleteBonds', { count: b })
  const ok = await confirmDialog({ title, message: tr('dialog.undoHint'), tone: 'danger' })
  if (!ok) return
  // One atomic write → one undo step for the whole selection.
  const res = await store.deletePersons([...store.selectedPersonIds], {
    relationshipIds: [...store.selectedRelationshipIds]
  })
  store.clearGraphSelection()
  if (res?.success) undoToast(tr('toasts.deletedSelection'), 'persons:deleteMany')
}

function personOf(id) {
  return store.persons.find((p) => p.id === id) || null
}
function nameOf(id) {
  return personOf(id)?.name || t('graphActions.unnamed')
}
function shortName(id) {
  return nameOf(id).split(/\s+/)[0]
}
function colorOf(id) {
  const p = personOf(id)
  return p ? nodeColor(p.gender, store.graphSettings, p.gender_t) : 'var(--accent)'
}

function close() {
  store.clearGraphSelection()
}

/** A stored icon (name or legacy glyph) when it resolves, else a fallback. */
function iconOr(value, fallback) {
  return value && hasIcon(value) ? value : fallback
}

// ── People mode ─────────────────────────────────────────────────────────────
const headIds = computed(() => ids.value.slice(0, 4))
const extraCount = computed(() => Math.max(0, n.value - 4))
const peopleTitle = computed(() => {
  if (n.value === 1) return nameOf(ids.value[0])
  if (n.value === 2)
    return t('graphActions.pairTitle', { a: shortName(ids.value[0]), b: shortName(ids.value[1]) })
  return t('graphActions.selected', { n: n.value })
})
const peopleSub = computed(() => {
  if (n.value === 1) {
    const p = personOf(ids.value[0])
    const b = p?.birth?.year,
      d = p?.death?.year
    if (b && d) return `${b} – ${d}`
    if (b) return t('graphActions.born', { year: b })
    if (d) return t('graphActions.died', { year: d })
    return nounLabel(store.noun)
  }
  if (n.value === 2) return t('graphActions.pairSub')
  return t('graphActions.multiSub')
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
  const name = nameOf(ids.value[0])
  const ok = await confirmDialog({
    title:
      count === 1 ? tr('confirm.deletePerson', { name }) : tr('confirm.deletePeople', { count }),
    message:
      (count === 1 ? tr('confirm.deletePersonBody') : tr('confirm.deletePeopleBody')) +
      ' ' +
      tr('dialog.undoHint'),
    tone: 'danger'
  })
  if (!ok) return
  const res = await store.deletePersons([...ids.value]) // one undo step
  store.selectPerson(null, { modal: false })
  if (res?.success) {
    undoToast(
      count === 1 ? tr('toasts.deletedPerson', { name }) : tr('toasts.deletedPeople', { count }),
      'persons:deleteMany'
    )
  }
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

// Their existing kinship, named in the kinship language (null when unrelated).
const kinship = useKinship()
const pairKin = computed(() => {
  if (n.value !== 2) return null
  const k = kinship.lensOf(pairA.value).get(pairB.value)
  if (!k || k.kind === 'distant') return null
  const cls = kinClass(k)
  return {
    text: kinship.nameOf(k, pairA.value, pairB.value),
    color: cls ? kinPalette()[cls] : 'var(--accent)'
  }
})

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
  if (existingTypes.value.has(def.key)) return t('graphActions.alreadyLinked')
  const a = shortName(pairA.value)
  const b = shortName(pairB.value)
  if (def.directed && def.role_a)
    return t('graphActions.becomes', { a, b, role: relRoleLabel(def, 'a').toLowerCase() })
  return t('graphActions.linkAs', { a, b, type: relTypeLabel(def).toLowerCase() })
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
    justLinked.value = relTypeLabel(def)
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
  if (r.type === 'spouse')
    return r.status === 'divorced' ? relStatusLabel('divorced') : t('graphActions.married')
  return relTypeLabel(relDef.value) || r.type
})
const relDates = computed(() => {
  const r = rel.value
  if (!r) return ''
  if (r.formed?.year) {
    const year = r.formed.year
    const from =
      r.type === 'spouse'
        ? t('graphActions.marriedYear', { year })
        : t('graphActions.sinceYear', { year })
    return r.ended?.year ? t('graphActions.range', { from, to: r.ended.year }) : from
  }
  if (r.ended?.year) return t('graphActions.endedYear', { year: r.ended.year })
  return ''
})
const relStatuses = computed(() => relDef.value?.statuses || [])
function statusLabel(s, type = rel.value?.type) {
  if (type === 'spouse' && s === 'active') return t('graphActions.married')
  return relStatusLabel(s)
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
  const ok = await confirmDialog({
    title: tr('confirm.deleteBond', { kind: relTitle.value.toLowerCase() }),
    message:
      tr('confirm.deleteBondBetween', { a: nameOf(r.person_a_id), b: nameOf(r.person_b_id) }) +
      ' ' +
      tr('dialog.undoHint'),
    tone: 'danger'
  })
  if (!ok) return
  const res = await store.deleteRelationship(r.id)
  if (res?.success) {
    store.relPopup = null
    undoToast(tr('toasts.deletedBond'), 'relationships:delete')
  }
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
  width: auto;
  min-width: 22px;
  height: 18px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--hover);
  color: var(--t2);
  font-size: 10.5px;
  line-height: 1;
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
  font-size: 12px;
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
  color: var(--t3);
}
.ap-dates {
  font-size: 11px;
  color: var(--t3);
  margin-top: 1px;
}
.ap-close {
  width: var(--ctl-xs);
  height: var(--ctl-xs);
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--t3);
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
  justify-content: center;
  gap: 5px;
  height: var(--ctl-sm);
  padding: 0 9px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: var(--hover);
  color: var(--t2);
  font-family: var(--font);
  font-size: 12px;
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
.ap-btn:disabled {
  opacity: 0.4;
  cursor: default;
  transform: none;
  box-shadow: none;
}
.ap-btn-danger {
  color: var(--danger);
  background: rgba(var(--danger-rgb), 0.1);
}
.ap-btn-danger:hover {
  color: var(--danger);
  background: rgba(var(--danger-rgb), 0.18);
  border-color: rgba(var(--danger-rgb), 0.4);
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
  font-size: var(--fs-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--t3);
  flex-shrink: 0;
  width: 44px;
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
  height: var(--ctl-xs);
  padding: 0 2px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--t3);
  font-family: var(--font);
  font-size: 11px;
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
  height: var(--ctl-xs);
  padding: 0 9px;
  border: 1px solid color-mix(in srgb, var(--rc) 28%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--rc) 8%, transparent);
  color: var(--t2);
  font-family: var(--font);
  font-size: 11.5px;
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
  color: var(--t3);
  cursor: default;
}
.ap-chip-glyph {
  color: var(--rc);
}
.ap-chip-check {
  color: var(--rc);
}

/* The direction pill (who → whom) with its swap affordance. */
.ap-swap {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: var(--ctl-xs);
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 11.5px;
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
  color: var(--t3);
}
.ap-swap-ic {
  color: var(--accent);
  transition: transform 0.3s cubic-bezier(0.34, 1.4, 0.64, 1);
}

/* "Linked!" confirmation flash. */
.ap-flash {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--accent);
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

/* ── Pair kinship line ─────────────────────────────────────────────────── */
.ap-kin {
  --kc: var(--accent);
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  margin-bottom: 8px;
  padding: 6px 9px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--kc) 35%, var(--border));
  background: color-mix(in srgb, var(--kc) 10%, transparent);
  color: var(--t2);
  font-family: var(--font);
  font-size: 12.5px;
  cursor: pointer;
  text-align: left;
  animation: ap-kin-in 0.45s var(--ease-spring) backwards;
  transition:
    transform 0.2s var(--ease-spring),
    box-shadow 0.2s ease;
}
.ap-kin:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--kc) 25%, transparent);
}
@keyframes ap-kin-in {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
}
.ap-kin-ic {
  color: var(--kc);
}
.ap-kin-text {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
}
.ap-kin-arrow {
  color: var(--t3);
}
.ap-kin-rel {
  margin-left: auto;
  font-weight: 800;
  color: var(--kc);
  white-space: nowrap;
}
</style>
