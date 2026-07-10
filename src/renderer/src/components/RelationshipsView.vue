<template>
  <div class="rv">
    <!-- Toolbar -->
    <div class="rv-toolbar">
      <div class="rv-heading">
        <span class="rv-title">Relationships</span>
        <span class="rv-count">{{ rows.length }}</span>
      </div>

      <div class="rv-controls">
        <div class="rv-search">
          <span class="rv-search-icon">🔍</span>
          <input v-model="query" class="rv-search-input" placeholder="Search by name…" />
          <button v-if="query" class="rv-search-clear" title="Clear" @click="query = ''">✕</button>
        </div>

        <div class="rv-chips">
          <button
            v-for="chip in chips"
            :key="chip.id"
            class="rv-chip"
            :class="{ active: typeFilter === chip.id }"
            :style="{ '--chip-c': chip.color }"
            @click="typeFilter = chip.id"
          >
            <span class="rv-chip-dot"></span>
            <span>{{ chip.label }}</span>
            <span class="rv-chip-count">{{ chip.count }}</span>
          </button>
          <Transition name="rv-chip-pop">
            <button
              v-if="issueCount > 0"
              class="rv-chip rv-chip-issues"
              :class="{ active: typeFilter === 'issues' }"
              title="Relationships that need attention"
              @click="typeFilter = 'issues'"
            >
              <span>⚠</span>
              <span>Issues</span>
              <span class="rv-chip-count">{{ issueCount }}</span>
            </button>
          </Transition>
        </div>

        <button
          class="btn btn-primary btn-sm"
          @click="editing?.id === 'new' ? cancelEdit() : startAdd()"
        >
          {{ editing?.id === 'new' ? '✕ Cancel' : '＋ Add Relationship' }}
        </button>
      </div>
    </div>

    <!-- New relationship editor -->
    <Transition name="rv-expand">
      <div v-if="editing && editing.id === 'new'" class="rv-editor rv-editor-new">
        <div class="rv-editor-label">New relationship</div>
        <div class="rv-editor-grid">
          <div class="rv-field">
            <label>Person A</label>
            <select v-model="editing.person_a_id" @keydown.enter="saveEdit">
              <option value="" disabled>Select person…</option>
              <option v-for="p in personOptions" :key="p.id" :value="p.id">
                {{ p.name }}{{ p.birth_year ? ` (b. ${p.birth_year})` : '' }}
              </option>
            </select>
          </div>
          <button class="rv-swap-btn" title="Swap A and B" @click="swapEditing">⇄</button>
          <div class="rv-field">
            <label>Relationship</label>
            <select v-model="editing.type">
              <option value="parent_child">Is parent of</option>
              <option value="spouse">Is spouse of</option>
              <option value="adopted">Adopted (is adoptive parent of)</option>
            </select>
          </div>
          <div class="rv-field">
            <label>Person B</label>
            <select v-model="editing.person_b_id" @keydown.enter="saveEdit">
              <option value="" disabled>Select person…</option>
              <option v-for="p in personOptions" :key="p.id" :value="p.id">
                {{ p.name }}{{ p.birth_year ? ` (b. ${p.birth_year})` : '' }}
              </option>
            </select>
          </div>
          <div class="rv-field rv-field-sm">
            <label>{{ editing.type === 'spouse' ? 'Married (year)' : 'Since (year)' }}</label>
            <input
              v-model="editing.formed_date"
              type="number"
              placeholder="Year"
              min="1"
              max="2200"
              @keydown.enter="saveEdit"
            />
          </div>
          <div v-if="editing.type === 'spouse'" class="rv-field rv-field-sm">
            <label>Status</label>
            <select v-model="editing.status">
              <option value="active">Married</option>
              <option value="divorced">Divorced</option>
            </select>
          </div>
        </div>
        <div class="rv-editor-footer">
          <div class="rv-editor-preview" :style="{ '--rel-c': meta(editing.type).color }">
            {{ previewSentence }}
          </div>
          <Transition name="rv-fade">
            <span v-if="editError" class="rv-editor-error">{{ editError }}</span>
          </Transition>
          <button class="btn btn-ghost btn-sm" @click="cancelEdit">Cancel</button>
          <button class="btn btn-primary btn-sm" @click="saveEdit">Create</button>
        </div>
      </div>
    </Transition>

    <!-- Table (virtualized rows: only the visible window exists in the DOM) -->
    <div ref="scrollEl" class="rv-scroll" @scroll.passive="onScroll">
      <div v-if="rows.length" class="rv-table">
        <!-- Header -->
        <div class="rv-head">
          <button class="rv-th" @click="setSort('from')">
            From
            <span class="rv-sort-arrow" :class="arrowClass('from')">▲</span>
          </button>
          <button class="rv-th rv-th-center" @click="setSort('type')">
            Relation
            <span class="rv-sort-arrow" :class="arrowClass('type')">▲</span>
          </button>
          <button class="rv-th" @click="setSort('to')">
            To
            <span class="rv-sort-arrow" :class="arrowClass('to')">▲</span>
          </button>
          <button class="rv-th" @click="setSort('since')">
            Since
            <span class="rv-sort-arrow" :class="arrowClass('since')">▲</span>
          </button>
          <div class="rv-th rv-th-plain"></div>
        </div>

        <!-- Rows -->
        <div :key="listVersion" class="rv-body" :style="{ height: bodyH + 'px' }">
          <div
            v-for="row in visibleRows"
            :key="row.rel.id"
            class="rv-rowwrap"
            :class="{
              issue: row.issues.length,
              expanded: editing?.id === row.rel.id,
              'rv-animate': animWindow
            }"
            :style="{
              transform: `translateY(${row._y}px)`,
              '--i': row._stagger,
              '--rel-c': meta(row.rel.type).color
            }"
          >
            <div
              class="rv-row"
              @click="editing?.id === row.rel.id ? cancelEdit() : startEdit(row.rel)"
            >
              <!-- From person -->
              <button
                class="rv-person"
                :disabled="!row.a"
                :title="row.a ? 'View ' + row.a.name : ''"
                @click.stop="row.a && store.selectPerson(row.a.id)"
              >
                <div class="rv-avatar" :style="{ background: avatarGradient(row.a?.gender) }">
                  <img
                    v-if="row.a?.primary_image && imageUrl(row.a.primary_image)"
                    class="rv-avatar-img"
                    :src="imageUrl(row.a.primary_image)"
                    alt=""
                  />
                  <svg v-else class="rv-avatar-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path :d="PERSON_ICON_PATH" transform="translate(-5.28 -2.16) scale(1.44)" />
                  </svg>
                </div>
                <div class="rv-pinfo">
                  <div class="rv-pname" :class="{ unknown: !row.a }">
                    {{ row.a?.name || 'Unknown' }}
                  </div>
                  <div class="rv-psub">
                    {{ roleLabel(row.rel.type, 'a')
                    }}<template v-if="row.a?.birth_year"> · b. {{ row.a.birth_year }}</template>
                  </div>
                </div>
              </button>

              <!-- Connector -->
              <div class="rv-connector">
                <button
                  class="rv-conn-pill"
                  :class="{ toggleable: row.rel.type === 'spouse' }"
                  :title="row.rel.type === 'spouse' ? 'Click to toggle married / divorced' : ''"
                  @click.stop="row.rel.type === 'spouse' ? toggleStatus(row) : startEdit(row.rel)"
                >
                  {{ connLabel(row.rel) }}
                </button>
                <div
                  class="rv-track-wrap"
                  :class="[row.rel.type, { divorced: row.rel.status === 'divorced' }]"
                >
                  <span class="rv-dot rv-dot-left"></span>
                  <template v-if="row.rel.type === 'spouse'">
                    <template v-if="row.rel.status === 'divorced'">
                      <span class="rv-track rv-track-top rv-seg-left"></span>
                      <span class="rv-track rv-track-top rv-seg-right"></span>
                      <span class="rv-track rv-track-bottom rv-seg-left"></span>
                      <span class="rv-track rv-track-bottom rv-seg-right"></span>
                      <span class="rv-cut rv-cut-1"></span>
                      <span class="rv-cut rv-cut-2"></span>
                    </template>
                    <template v-else>
                      <span class="rv-track rv-track-top"></span>
                      <span class="rv-track rv-track-bottom"></span>
                    </template>
                    <span class="rv-dot rv-dot-right"></span>
                  </template>
                  <template v-else>
                    <span class="rv-track" :class="{ dashed: row.rel.type === 'adopted' }"></span>
                    <span class="rv-arrow"></span>
                  </template>
                </div>
              </div>

              <!-- To person -->
              <button
                class="rv-person"
                :disabled="!row.b"
                :title="row.b ? 'View ' + row.b.name : ''"
                @click.stop="row.b && store.selectPerson(row.b.id)"
              >
                <div class="rv-avatar" :style="{ background: avatarGradient(row.b?.gender) }">
                  <img
                    v-if="row.b?.primary_image && imageUrl(row.b.primary_image)"
                    class="rv-avatar-img"
                    :src="imageUrl(row.b.primary_image)"
                    alt=""
                  />
                  <svg v-else class="rv-avatar-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path :d="PERSON_ICON_PATH" transform="translate(-5.28 -2.16) scale(1.44)" />
                  </svg>
                </div>
                <div class="rv-pinfo">
                  <div class="rv-pname" :class="{ unknown: !row.b }">
                    {{ row.b?.name || 'Unknown' }}
                  </div>
                  <div class="rv-psub">
                    {{ roleLabel(row.rel.type, 'b')
                    }}<template v-if="row.b?.birth_year"> · b. {{ row.b.birth_year }}</template>
                  </div>
                </div>
              </button>

              <!-- Since (inline editable) -->
              <div class="rv-since" @click.stop>
                <input
                  type="number"
                  class="rv-since-input"
                  :value="row.rel.formed_date || ''"
                  placeholder="—"
                  min="1"
                  max="2200"
                  title="Year the relationship formed"
                  @change="setSince(row, $event.target.value)"
                />
              </div>

              <!-- Actions -->
              <div class="rv-actions" @click.stop>
                <span v-if="row.issues.length" class="rv-warn" :title="row.issues.join('\n')"
                  >⚠</span
                >
                <button
                  v-if="row.rel.type !== 'spouse'"
                  class="rv-action-btn"
                  title="Swap direction"
                  @click="swapRel(row)"
                >
                  ⇄
                </button>
                <button class="rv-action-btn" title="Edit" @click="startEdit(row.rel)">✎</button>
                <button class="rv-action-btn rv-action-del" title="Delete" @click="removeRel(row)">
                  ✕
                </button>
              </div>
            </div>

            <!-- Inline row editor -->
            <Transition name="rv-fade">
              <div v-if="editing?.id === row.rel.id" class="rv-editor" @click.stop>
                <div class="rv-editor-grid">
                  <div class="rv-field">
                    <label>Person A</label>
                    <select v-model="editing.person_a_id" @keydown.enter="saveEdit">
                      <option value="" disabled>Select person…</option>
                      <option v-for="p in personOptions" :key="p.id" :value="p.id">
                        {{ p.name }}{{ p.birth_year ? ` (b. ${p.birth_year})` : '' }}
                      </option>
                    </select>
                  </div>
                  <button class="rv-swap-btn" title="Swap A and B" @click="swapEditing">⇄</button>
                  <div class="rv-field">
                    <label>Relationship</label>
                    <select v-model="editing.type">
                      <option value="parent_child">Is parent of</option>
                      <option value="spouse">Is spouse of</option>
                      <option value="adopted">Adopted (is adoptive parent of)</option>
                    </select>
                  </div>
                  <div class="rv-field">
                    <label>Person B</label>
                    <select v-model="editing.person_b_id" @keydown.enter="saveEdit">
                      <option value="" disabled>Select person…</option>
                      <option v-for="p in personOptions" :key="p.id" :value="p.id">
                        {{ p.name }}{{ p.birth_year ? ` (b. ${p.birth_year})` : '' }}
                      </option>
                    </select>
                  </div>
                  <div class="rv-field rv-field-sm">
                    <label>{{
                      editing.type === 'spouse' ? 'Married (year)' : 'Since (year)'
                    }}</label>
                    <input
                      v-model="editing.formed_date"
                      type="number"
                      placeholder="Year"
                      min="1"
                      max="2200"
                      @keydown.enter="saveEdit"
                    />
                  </div>
                  <div v-if="editing.type === 'spouse'" class="rv-field rv-field-sm">
                    <label>Status</label>
                    <select v-model="editing.status">
                      <option value="active">Married</option>
                      <option value="divorced">Divorced</option>
                    </select>
                  </div>
                </div>
                <div class="rv-editor-footer">
                  <div class="rv-editor-preview" :style="{ '--rel-c': meta(editing.type).color }">
                    {{ previewSentence }}
                  </div>
                  <Transition name="rv-fade">
                    <span v-if="editError" class="rv-editor-error">{{ editError }}</span>
                  </Transition>
                  <button class="btn btn-ghost btn-sm" @click="cancelEdit">Cancel</button>
                  <button class="btn btn-primary btn-sm" @click="saveEdit">Save</button>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="rv-empty">
        <div class="rv-empty-icon">
          {{ store.relationships.length ? (typeFilter === 'issues' ? '✅' : '🔍') : '🔗' }}
        </div>
        <div class="rv-empty-title">
          {{
            store.relationships.length
              ? typeFilter === 'issues'
                ? 'No issues found'
                : 'No matches'
              : 'No relationships yet'
          }}
        </div>
        <div class="rv-empty-text">
          {{
            store.relationships.length
              ? typeFilter === 'issues'
                ? 'Every relationship looks consistent. Nice work!'
                : 'Try a different search term or filter.'
              : 'Connect two family members to get started.'
          }}
        </div>
        <button
          v-if="!store.relationships.length && store.persons.length >= 2"
          class="btn btn-primary btn-sm"
          @click="startAdd"
        >
          ＋ Add Relationship
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useMainStore } from '../store/index.js'
import { api } from '../api'

const store = useMainStore()

const PERSON_ICON_PATH =
  'M12 12.5c2.49 0 4.5-2.01 4.5-4.5S14.49 3.5 12 3.5 7.5 5.51 7.5 8s2.01 4.5 4.5 4.5zm0 2.25c-3 0-9 1.51-9 4.5V22h18v-2.75c0-2.99-6-4.5-9-4.5z'

// Virtualization geometry: every row is a fixed 57px (56 + 1px border); the
// expanded inline editor adds a fixed block below its row.
const ROW_H = 57
const EDITOR_EXPAND = 152
const HEAD_OFFSET = 55 // scroll padding + sticky header above the row body
const OVERSCAN_ROWS = 5

const query = ref('')
const typeFilter = ref('all') // 'all' | 'parent_child' | 'spouse' | 'adopted' | 'issues'
const sortKey = ref('type')
const sortDir = ref(1)
const editing = ref(null) // { id: 'new' | relId, person_a_id, person_b_id, type, formed_date, status }
const editError = ref('')

function imageUrl(filename) {
  return api.getImageUrl(filename) || ''
}
function avatarGradient(gender) {
  if (gender === 'male') return 'linear-gradient(135deg, #3a7bd5, #2351a0)'
  if (gender === 'female') return 'linear-gradient(135deg, #c95fa0, #923075)'
  return 'linear-gradient(135deg, #5c6bc0, #3c4a9e)'
}

const personById = computed(() => {
  const m = {}
  store.persons.forEach((p) => {
    m[p.id] = p
  })
  return m
})
const personOptions = computed(() =>
  [...store.persons].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
  )
)

function meta(type) {
  const gs = store.graphSettings
  if (type === 'spouse') return { label: 'Spouse', color: gs.spouseColor }
  if (type === 'adopted') return { label: 'Adopted', color: gs.adoptedColor }
  return { label: 'Parent of', color: gs.parentChildColor }
}
function connLabel(rel) {
  if (rel.type === 'spouse') return rel.status === 'divorced' ? 'Divorced' : 'Married'
  if (rel.type === 'adopted') return 'Adopted'
  return 'Parent of'
}
function roleLabel(type, side) {
  if (type === 'spouse') return 'Partner'
  if (type === 'adopted') return side === 'a' ? 'Adoptive parent' : 'Adopted child'
  return side === 'a' ? 'Parent' : 'Child'
}

// ── Consistency checks ──────────────────────────────────────────────────────
const issuesByRel = computed(() => {
  const out = {}
  const add = (id, msg) => {
    ;(out[id] ||= []).push(msg)
  }
  const rels = store.relationships
  const pairKey = (r) => [r.person_a_id, r.person_b_id].sort().join('~')

  const byPairType = {}
  const byPair = {}
  const parentCount = {} // childId -> number of biological parents
  rels.forEach((r) => {
    ;(byPairType[pairKey(r) + '~' + r.type] ||= []).push(r.id)
    ;(byPair[pairKey(r)] ||= []).push(r)
    if (r.type === 'parent_child')
      parentCount[r.person_b_id] = (parentCount[r.person_b_id] || 0) + 1
  })

  rels.forEach((r) => {
    const a = personById.value[r.person_a_id]
    const b = personById.value[r.person_b_id]
    if (r.person_a_id === r.person_b_id) add(r.id, 'Links a person to themselves')
    if (!a || !b) add(r.id, 'References a person that no longer exists')
    if (byPairType[pairKey(r) + '~' + r.type].length > 1)
      add(r.id, 'Duplicate — this pair already has this relationship')
    const pairRels = byPair[pairKey(r)]
    if (pairRels.some((o) => o.type === 'spouse') && pairRels.some((o) => o.type !== 'spouse')) {
      add(r.id, 'Conflict — this pair is linked as both spouses and parent/child')
    }
    if (
      (r.type === 'parent_child' || r.type === 'adopted') &&
      a?.birth_year &&
      b?.birth_year &&
      a.birth_year >= b.birth_year
    ) {
      add(r.id, `Parent (b. ${a.birth_year}) born after or same year as child (b. ${b.birth_year})`)
    }
    if (r.type === 'parent_child' && parentCount[r.person_b_id] > 2) {
      add(r.id, `${b?.name || 'This child'} has more than two biological parents`)
    }
  })
  return out
})
const issueCount = computed(() => Object.keys(issuesByRel.value).length)

// If the user is on the Issues filter and the last issue gets fixed, fall back to All
watch(issueCount, (n) => {
  if (n === 0 && typeFilter.value === 'issues') typeFilter.value = 'all'
})

// ── Filter chips ────────────────────────────────────────────────────────────
const chips = computed(() => {
  const rels = store.relationships
  const count = (t) => rels.filter((r) => r.type === t).length
  return [
    { id: 'all', label: 'All', count: rels.length, color: 'var(--accent)' },
    {
      id: 'parent_child',
      label: 'Parent',
      count: count('parent_child'),
      color: store.graphSettings.parentChildColor
    },
    {
      id: 'spouse',
      label: 'Spouse',
      count: count('spouse'),
      color: store.graphSettings.spouseColor
    },
    {
      id: 'adopted',
      label: 'Adopted',
      count: count('adopted'),
      color: store.graphSettings.adoptedColor
    }
  ]
})

// ── Rows (filter + sort) ────────────────────────────────────────────────────
const rows = computed(() => {
  const q = query.value.trim().toLowerCase()
  let list = store.relationships.map((r) => ({
    rel: r,
    a: personById.value[r.person_a_id] || null,
    b: personById.value[r.person_b_id] || null,
    issues: issuesByRel.value[r.id] || []
  }))
  if (typeFilter.value === 'issues') list = list.filter((x) => x.issues.length)
  else if (typeFilter.value !== 'all') list = list.filter((x) => x.rel.type === typeFilter.value)
  if (q) {
    list = list.filter(
      (x) =>
        (x.a?.name || '').toLowerCase().includes(q) || (x.b?.name || '').toLowerCase().includes(q)
    )
  }
  const dir = sortDir.value
  const nm = (p) => (p?.name || '').toLowerCase()
  const yr = (r) => parseInt(r.formed_date) || 9e9
  list.sort((x, y) => {
    let c = 0
    if (sortKey.value === 'from') c = nm(x.a).localeCompare(nm(y.a))
    else if (sortKey.value === 'to') c = nm(x.b).localeCompare(nm(y.b))
    else if (sortKey.value === 'since') c = yr(x.rel) - yr(y.rel)
    else c = x.rel.type.localeCompare(y.rel.type)
    if (c === 0) c = nm(x.a).localeCompare(nm(y.a))
    return c * dir
  })
  return list
})

function setSort(key) {
  if (sortKey.value === key) sortDir.value = -sortDir.value
  else {
    sortKey.value = key
    sortDir.value = 1
  }
}
function arrowClass(key) {
  if (sortKey.value !== key) return 'hidden'
  return sortDir.value === 1 ? 'asc' : 'desc'
}

// ── Virtual window ──────────────────────────────────────────────────────────
const scrollEl = ref(null)
const scrollTop = ref(0)
const viewH = ref(600)

let scrollRaf = 0
function onScroll() {
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    scrollTop.value = scrollEl.value?.scrollTop || 0
  })
}

const editIdx = computed(() => {
  if (!editing.value || editing.value.id === 'new') return -1
  return rows.value.findIndex((r) => r.rel.id === editing.value.id)
})

const bodyH = computed(() => rows.value.length * ROW_H + (editIdx.value >= 0 ? EDITOR_EXPAND : 0))

// Primitive computeds so the window only shifts when the scroll actually
// crosses a row boundary — not on every scrolled pixel.
const startIdx = computed(() => {
  let rel = scrollTop.value - HEAD_OFFSET
  if (editIdx.value >= 0 && rel > editIdx.value * ROW_H + EDITOR_EXPAND) rel -= EDITOR_EXPAND
  return Math.max(0, Math.floor(rel / ROW_H) - OVERSCAN_ROWS)
})
const endIdx = computed(() =>
  Math.min(rows.value.length, startIdx.value + Math.ceil(viewH.value / ROW_H) + OVERSCAN_ROWS * 2)
)

const visibleRows = computed(() => {
  const out = []
  const list = rows.value
  const eIdx = editIdx.value
  for (let i = startIdx.value; i < endIdx.value; i++) {
    out.push({
      ...list[i],
      _y: i * ROW_H + (eIdx >= 0 && i > eIdx ? EDITOR_EXPAND : 0),
      _stagger: Math.min(i - startIdx.value, 20)
    })
  }
  return out
})

// Stagger entrance replays when the filter/sort/search changes; rows scrolled
// into view afterwards appear instantly.
const listVersion = ref(0)
const animWindow = ref(true)
let animTimer = setTimeout(() => {
  animWindow.value = false
}, 1100)
watch([query, typeFilter, sortKey, sortDir], () => {
  listVersion.value++
  animWindow.value = true
  clearTimeout(animTimer)
  animTimer = setTimeout(() => {
    animWindow.value = false
  }, 1100)
})

let ro = null
onMounted(() => {
  const measure = () => {
    viewH.value = scrollEl.value?.clientHeight || 600
  }
  measure()
  ro = new ResizeObserver(measure)
  if (scrollEl.value) ro.observe(scrollEl.value)
})
onBeforeUnmount(() => {
  if (ro) ro.disconnect()
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
  if (animTimer) clearTimeout(animTimer)
})

// ── Editing ─────────────────────────────────────────────────────────────────
function startAdd() {
  editError.value = ''
  editing.value = {
    id: 'new',
    person_a_id: '',
    person_b_id: '',
    type: 'parent_child',
    formed_date: '',
    status: 'active'
  }
}
function startEdit(rel) {
  editError.value = ''
  editing.value = {
    id: rel.id,
    person_a_id: rel.person_a_id,
    person_b_id: rel.person_b_id,
    type: rel.type,
    formed_date: rel.formed_date || '',
    status: rel.status || 'active'
  }
}
function cancelEdit() {
  editing.value = null
  editError.value = ''
}
function swapEditing() {
  const e = editing.value
  if (!e) return
  ;[e.person_a_id, e.person_b_id] = [e.person_b_id, e.person_a_id]
}

const previewSentence = computed(() => {
  const e = editing.value
  if (!e) return ''
  const a = personById.value[e.person_a_id]?.name || 'Person A'
  const b = personById.value[e.person_b_id]?.name || 'Person B'
  if (e.type === 'spouse') {
    return e.status === 'divorced'
      ? `${a} and ${b} were married, now divorced`
      : `${a} and ${b} are married`
  }
  if (e.type === 'adopted') return `${a} adopted ${b}`
  return `${a} is a parent of ${b}`
})

async function saveEdit() {
  const e = editing.value
  if (!e) return
  if (!e.person_a_id || !e.person_b_id) {
    editError.value = 'Choose both people.'
    return
  }
  if (e.person_a_id === e.person_b_id) {
    editError.value = 'A person cannot be linked to themselves.'
    return
  }
  const dup = store.relationships.some(
    (r) =>
      r.id !== e.id &&
      r.type === e.type &&
      ((r.person_a_id === e.person_a_id && r.person_b_id === e.person_b_id) ||
        (r.person_a_id === e.person_b_id && r.person_b_id === e.person_a_id))
  )
  if (dup) {
    editError.value = 'This relationship already exists.'
    return
  }

  const payload = {
    person_a_id: e.person_a_id,
    person_b_id: e.person_b_id,
    type: e.type,
    formed_date: e.formed_date ? String(e.formed_date) : null,
    status: e.type === 'spouse' ? e.status : 'active'
  }
  const res =
    e.id === 'new'
      ? await store.createRelationship(payload)
      : await store.updateRelationship({ id: e.id, ...payload })
  if (!res.success) {
    editError.value = res.error || 'Could not save.'
    return
  }
  cancelEdit()
}

// ── Quick row actions ───────────────────────────────────────────────────────
async function removeRel(row) {
  const aName = row.a?.name || 'Unknown'
  const bName = row.b?.name || 'Unknown'
  const kind =
    row.rel.type === 'spouse'
      ? 'marriage'
      : row.rel.type === 'adopted'
        ? 'adoption'
        : 'parent–child'
  if (!confirm(`Delete the ${kind} relationship between ${aName} and ${bName}?`)) return
  if (editing.value?.id === row.rel.id) cancelEdit()
  await store.deleteRelationship(row.rel.id)
}
async function swapRel(row) {
  await store.updateRelationship({
    id: row.rel.id,
    person_a_id: row.rel.person_b_id,
    person_b_id: row.rel.person_a_id
  })
}
async function setSince(row, val) {
  const y = parseInt(val)
  await store.updateRelationship({ id: row.rel.id, formed_date: y && y > 0 ? String(y) : null })
}
async function toggleStatus(row) {
  if (row.rel.type !== 'spouse') return
  await store.updateRelationship({
    id: row.rel.id,
    status: row.rel.status === 'divorced' ? 'active' : 'divorced'
  })
}
</script>

<style scoped>
.rv {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background:
    radial-gradient(1200px 600px at 20% -10%, rgba(240, 98, 146, 0.06), transparent 60%), var(--bg);
  min-height: 0;
}

/* ── Toolbar ─────────────────────────────────────────────── */
.rv-toolbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 22px;
  border-bottom: 1px solid var(--border);
  background: var(--glass-soft);
  backdrop-filter: blur(10px);
  flex-wrap: wrap;
  z-index: 2;
}
.rv-heading {
  display: flex;
  align-items: center;
  gap: 10px;
}
.rv-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: var(--t1);
}
.rv-count {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  background: var(--adim);
  padding: 2px 9px;
  border-radius: 20px;
}
.rv-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.rv-search {
  display: flex;
  align-items: center;
  gap: 7px;
  background: var(--elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0 10px;
  height: 34px;
  min-width: 190px;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.rv-search:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(108, 142, 245, 0.15);
}
.rv-search-icon {
  font-size: 13px;
  opacity: 0.7;
}
.rv-search-input {
  border: none;
  background: transparent;
  padding: 0;
  height: 100%;
  font-size: 13px;
  color: var(--t1);
  width: 100%;
  box-shadow: none;
}
.rv-search-input:focus {
  box-shadow: none;
}
.rv-search-clear {
  border: none;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  font-size: 11px;
  padding: 2px;
  border-radius: 4px;
  transition: color 0.12s;
}
.rv-search-clear:hover {
  color: var(--t1);
}

/* Filter chips */
.rv-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.rv-chip {
  --chip-c: var(--accent);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 11px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.18s,
    color 0.18s,
    border-color 0.18s,
    transform 0.18s;
}
.rv-chip:hover {
  color: var(--t1);
  transform: translateY(-1px);
}
.rv-chip.active {
  background: color-mix(in srgb, var(--chip-c) 15%, transparent);
  border-color: color-mix(in srgb, var(--chip-c) 45%, transparent);
  color: var(--t1);
}
.rv-chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--chip-c);
  flex-shrink: 0;
  transition: transform 0.2s;
}
.rv-chip.active .rv-chip-dot {
  transform: scale(1.25);
}
.rv-chip-count {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--t3);
}
.rv-chip.active .rv-chip-count {
  color: var(--chip-c);
}

.rv-chip-issues {
  --chip-c: #f5a623;
  color: #f5a623;
  border-color: rgba(245, 166, 35, 0.35);
}
.rv-chip-issues:hover {
  color: #f5a623;
}
.rv-chip-issues.active {
  color: #f5a623;
}
.rv-chip-issues .rv-chip-count {
  color: #f5a623;
}
.rv-chip-pop-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.rv-chip-pop-leave-active {
  transition: all 0.2s ease;
}
.rv-chip-pop-enter-from,
.rv-chip-pop-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/* ── Editor ──────────────────────────────────────────────── */
.rv-editor {
  background: var(--elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
}
.rv-editor-new {
  margin: 14px 22px 0;
  flex: 0 0 auto;
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.2);
}
.rv-editor-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--accent);
  margin-bottom: 10px;
}
.rv-editor-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr 1fr 110px auto;
  gap: 10px;
  align-items: end;
}
.rv-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.rv-field label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--t3);
}
.rv-field select,
.rv-field input {
  height: 34px;
  padding: 0 10px;
  font-size: 12.5px;
  background: var(--surface);
}
.rv-field select {
  padding-right: 28px;
}
.rv-field-sm {
  max-width: 130px;
}
.rv-swap-btn {
  height: 34px;
  width: 34px;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--t2);
  font-size: 15px;
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s,
    transform 0.25s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.rv-swap-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
  transform: rotate(180deg);
}
.rv-editor-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}
.rv-editor-preview {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-style: italic;
  color: var(--t2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: 10px;
  border-left: 3px solid var(--rel-c, var(--accent));
}
.rv-editor-error {
  font-size: 12px;
  font-weight: 600;
  color: #ef5350;
  background: rgba(239, 83, 80, 0.12);
  padding: 4px 10px;
  border-radius: 8px;
  white-space: nowrap;
}
.rv-fade-enter-active,
.rv-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.rv-fade-enter-from,
.rv-fade-leave-to {
  opacity: 0;
  transform: translateY(3px);
}

/* New-relationship editor expand/collapse */
.rv-expand-enter-active {
  transition:
    max-height 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.28s ease,
    margin 0.28s ease;
  overflow: hidden;
}
.rv-expand-leave-active {
  transition:
    max-height 0.22s ease,
    opacity 0.18s ease,
    margin 0.18s ease;
  overflow: hidden;
}
.rv-expand-enter-from,
.rv-expand-leave-to {
  max-height: 0;
  opacity: 0;
  margin-top: 0;
  margin-bottom: 0;
}
.rv-expand-enter-to,
.rv-expand-leave-from {
  max-height: 260px;
  opacity: 1;
}

/* ── Table ───────────────────────────────────────────────── */
.rv-scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow: auto;
  padding: 16px 22px 26px;
}
.rv-table {
  --grid: minmax(175px, 1.3fr) minmax(165px, 1fr) minmax(175px, 1.3fr) 76px 120px;
  min-width: 740px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  /* clip (not hidden) — hidden would turn the card into the sticky header's
     scroll container and the header would never pin to the view edge */
  overflow: clip;
  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.14);
}

.rv-head {
  display: grid;
  grid-template-columns: var(--grid);
  align-items: center;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  position: sticky;
  top: 0;
  z-index: 3;
}
.rv-th {
  display: flex;
  align-items: center;
  gap: 5px;
  border: none;
  background: transparent;
  font-family: var(--font);
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: var(--t3);
  text-align: left;
  padding: 11px 14px;
  cursor: pointer;
  transition: color 0.15s;
}
.rv-th:hover {
  color: var(--t1);
}
.rv-th-center {
  justify-content: center;
}
.rv-th-plain {
  cursor: default;
}
.rv-sort-arrow {
  font-size: 8px;
  transition:
    transform 0.25s cubic-bezier(0.34, 1.4, 0.5, 1),
    opacity 0.2s;
}
.rv-sort-arrow.hidden {
  opacity: 0;
}
.rv-th:hover .rv-sort-arrow.hidden {
  opacity: 0.35;
}
.rv-sort-arrow.asc {
  opacity: 1;
  color: var(--accent);
}
.rv-sort-arrow.desc {
  opacity: 1;
  color: var(--accent);
  transform: rotate(180deg);
}

/* ── Rows (virtualized: absolutely positioned within a fixed-height body) ── */
.rv-body {
  position: relative;
}

.rv-rowwrap {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  border-bottom: 1px solid var(--border);
  transition:
    background 0.15s,
    box-shadow 0.2s;
  background: var(--surface);
}
.rv-rowwrap.rv-animate {
  animation: rv-row-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: calc(min(var(--i, 0), 20) * 0.022s);
}
@keyframes rv-row-in {
  from {
    opacity: 0;
  }
}
.rv-rowwrap.issue {
  box-shadow: inset 3px 0 0 #f5a623;
}
.rv-rowwrap.expanded {
  background: color-mix(in srgb, var(--elevated) 55%, transparent);
  z-index: 2;
}
.rv-rowwrap.expanded .rv-editor {
  margin: 0 14px 12px;
  height: 128px;
}

.rv-row {
  display: grid;
  grid-template-columns: var(--grid);
  align-items: center;
  height: 56px;
  cursor: pointer;
  transition: background 0.14s;
}
.rv-row:hover {
  background: var(--hover);
}

/* Person cell */
.rv-person {
  display: flex;
  align-items: center;
  gap: 10px;
  border: none;
  background: transparent;
  font-family: var(--font);
  text-align: left;
  padding: 8px 14px;
  min-width: 0;
  cursor: pointer;
  border-radius: 8px;
}
.rv-person:disabled {
  cursor: default;
}
.rv-person:not(:disabled):hover .rv-pname {
  color: var(--accent);
}
.rv-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
  transition: transform 0.22s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.rv-person:not(:disabled):hover .rv-avatar {
  transform: scale(1.1);
}
.rv-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.rv-avatar-icon {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
  fill: rgba(255, 255, 255, 0.92);
}
.rv-pinfo {
  min-width: 0;
}
.rv-pname {
  font-size: 13px;
  font-weight: 600;
  color: var(--t1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.13s;
}
.rv-pname.unknown {
  color: var(--t3);
  font-style: italic;
}
.rv-psub {
  font-size: 10.5px;
  color: var(--t3);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Connector cell */
.rv-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  min-width: 0;
}
.rv-conn-pill {
  border: none;
  font-family: var(--font);
  font-size: 8.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--rel-c);
  background: color-mix(in srgb, var(--rel-c) 13%, transparent);
  padding: 2px 9px;
  border-radius: 20px;
  cursor: default;
  line-height: 1.5;
  transition:
    background 0.15s,
    transform 0.15s;
}
.rv-conn-pill.toggleable {
  cursor: pointer;
}
.rv-conn-pill.toggleable:hover {
  background: color-mix(in srgb, var(--rel-c) 26%, transparent);
  transform: scale(1.06);
}
.rv-track-wrap {
  position: relative;
  width: 100%;
  max-width: 190px;
  height: 12px;
}

.rv-dot {
  position: absolute;
  top: 2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--rel-c);
  box-shadow: 0 0 6px color-mix(in srgb, var(--rel-c) 55%, transparent);
}
.rv-dot-left {
  left: 0;
}
.rv-dot-right {
  right: 0;
}

.rv-track {
  position: absolute;
  left: 7px;
  right: 12px;
  top: 5px;
  height: 2px;
  background: var(--rel-c);
  border-radius: 2px;
  transition: box-shadow 0.2s;
}
.rv-track.dashed {
  background: repeating-linear-gradient(90deg, var(--rel-c) 0 6px, transparent 6px 11px);
}
.rv-row:hover .rv-track {
  box-shadow: 0 0 8px color-mix(in srgb, var(--rel-c) 60%, transparent);
}
.rv-row:hover .rv-track.dashed {
  animation: rv-dash-flow 0.8s linear infinite;
  box-shadow: none;
}
@keyframes rv-dash-flow {
  to {
    background-position: 11px 0;
  }
}

.rv-arrow {
  position: absolute;
  right: 2px;
  top: 1px;
  width: 0;
  height: 0;
  border-left: 8px solid var(--rel-c);
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
  transition: transform 0.22s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.rv-row:hover .rv-arrow {
  transform: translateX(2px);
}

/* Spouse: double line (genealogy marriage notation) */
.rv-track-wrap.spouse .rv-dot {
  top: 2px;
}
.rv-track-top {
  top: 2px !important;
  left: 7px;
  right: 7px;
}
.rv-track-bottom {
  top: 8px !important;
  left: 7px;
  right: 7px;
}
/* Divorced: double line broken by two red slashes */
.rv-seg-left {
  right: calc(50% + 13px) !important;
}
.rv-seg-right {
  left: calc(50% + 13px) !important;
}
.rv-cut {
  position: absolute;
  top: -2px;
  left: 50%;
  width: 2px;
  height: 16px;
  border-radius: 2px;
  background: #ef5350;
}
.rv-cut-1 {
  transform: translateX(-9px) rotate(26deg);
}
.rv-cut-2 {
  transform: translateX(-1px) rotate(26deg);
}
.rv-track-wrap.divorced .rv-track,
.rv-track-wrap.divorced .rv-dot {
  opacity: 0.55;
}

/* Since cell */
.rv-since {
  padding: 0 8px;
}
.rv-since-input {
  width: 60px;
  height: 28px;
  padding: 0 7px;
  font-size: 12px;
  font-weight: 600;
  color: var(--t2);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 7px;
  text-align: center;
  transition:
    border-color 0.15s,
    background 0.15s,
    color 0.15s;
  appearance: textfield;
  -moz-appearance: textfield;
}
.rv-since-input::-webkit-outer-spin-button,
.rv-since-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.rv-row:hover .rv-since-input {
  border-color: var(--border);
  background: var(--elevated);
}
.rv-since-input:focus {
  border-color: var(--accent);
  background: var(--elevated);
  color: var(--t1);
  box-shadow: none;
}

/* Actions cell */
.rv-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  padding: 0 12px;
}
.rv-warn {
  font-size: 13px;
  color: #f5a623;
  margin-right: auto;
  cursor: help;
  animation: rv-warn-pulse 2.4s ease-in-out infinite;
}
@keyframes rv-warn-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}
.rv-action-btn {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--t3);
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: translateY(2px);
  transition:
    opacity 0.16s,
    transform 0.16s,
    background 0.13s,
    color 0.13s;
}
.rv-row:hover .rv-action-btn {
  opacity: 1;
  transform: translateY(0);
}
.rv-action-btn:nth-of-type(2) {
  transition-delay: 0.02s;
}
.rv-action-btn:nth-of-type(3) {
  transition-delay: 0.04s;
}
.rv-action-btn:hover {
  background: var(--hover);
  color: var(--t1);
}
.rv-action-del:hover {
  background: rgba(239, 83, 80, 0.14);
  color: #ef5350;
}

/* ── Empty state ─────────────────────────────────────────── */
.rv-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
  color: var(--t2);
}
.rv-empty-icon {
  font-size: 44px;
  opacity: 0.6;
}
.rv-empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--t1);
}
.rv-empty-text {
  font-size: 13px;
  max-width: 300px;
}
.rv-empty .btn {
  margin-top: 8px;
}
</style>
