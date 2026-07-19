<template>
  <div class="people-view">
    <!-- Toolbar -->
    <div class="pv-toolbar">
      <div class="pv-heading">
        <span class="pv-title">Directory</span>
        <span class="pv-count">{{ displayed.length }}</span>
      </div>

      <div class="pv-controls">
        <ViewModeSwitch />
        <!-- Card styles only apply to the card-based modes -->
        <Transition name="pv-stylepick">
          <CardStylePicker v-if="isCardMode" />
        </Transition>

        <div class="pv-search">
          <span class="pv-search-icon">🔍</span>
          <input v-model="query" class="pv-search-input" placeholder="Search people…" />
          <button v-if="query" class="pv-search-clear" title="Clear" @click="query = ''">✕</button>
        </div>

        <div class="pv-sort">
          <div class="pv-sort-track">
            <div
              class="pv-sort-thumb"
              :style="{ transform: `translateX(${sortIndex * 100}%)` }"
            ></div>
          </div>
          <button
            v-for="opt in sortOptions"
            :key="opt.id"
            class="pv-sort-opt"
            :class="{ active: sortBy === opt.id }"
            @click="sortBy = opt.id"
          >
            {{ opt.label }}
          </button>
        </div>

        <button
          class="pv-filter-btn"
          :class="{ active: filtersOpen || activeFilterCount > 0 }"
          @click="filtersOpen = !filtersOpen"
        >
          <span class="pv-filter-icon" :class="{ open: filtersOpen }">⚙</span>
          Filters
          <Transition name="pv-badge">
            <span v-if="activeFilterCount" class="pv-filter-badge">{{ activeFilterCount }}</span>
          </Transition>
        </button>
      </div>
    </div>

    <!-- Facet panel: slides open, grouped chip rows over the live roster -->
    <div class="pv-filters" :class="{ open: filtersOpen }">
      <div class="pv-filters-inner">
        <div class="pv-facet">
          <span class="pv-facet-label">Life</span>
          <div class="pv-chips">
            <button
              class="pv-chip"
              :class="{ on: lifeFilter === 'all' }"
              @click="lifeFilter = 'all'"
            >
              All
            </button>
            <button
              class="pv-chip life-living"
              :class="{ on: lifeFilter === 'living' }"
              @click="lifeFilter = lifeFilter === 'living' ? 'all' : 'living'"
            >
              <span class="pv-chip-dot"></span>Living
              <span class="pv-chip-n">{{ lifeCounts.living }}</span>
            </button>
            <button
              class="pv-chip life-deceased"
              :class="{ on: lifeFilter === 'deceased' }"
              @click="lifeFilter = lifeFilter === 'deceased' ? 'all' : 'deceased'"
            >
              <span class="pv-chip-dot"></span>Remembered
              <span class="pv-chip-n">{{ lifeCounts.deceased }}</span>
            </button>
          </div>
        </div>

        <div v-if="genderOptions.length > 1" class="pv-facet">
          <span class="pv-facet-label">Gender</span>
          <div class="pv-chips">
            <button
              v-for="g in genderOptions"
              :key="g.key"
              class="pv-chip"
              :class="{ on: genderSel.has(g.key) }"
              :style="{ '--chip-c': g.color }"
              @click="toggleSet(genderSel, g.key)"
            >
              <span class="pv-chip-glyph" :style="{ color: g.color }">{{ g.glyph }}</span>
              {{ g.label }}
              <span class="pv-chip-n">{{ g.count }}</span>
            </button>
          </div>
        </div>

        <div class="pv-facet">
          <span class="pv-facet-label">Ties</span>
          <div class="pv-chips">
            <button
              class="pv-chip"
              :class="{ on: connFilter === 'all' }"
              @click="connFilter = 'all'"
            >
              Everyone
            </button>
            <button
              class="pv-chip"
              :class="{ on: connFilter === 'connected' }"
              @click="connFilter = connFilter === 'connected' ? 'all' : 'connected'"
            >
              🔗 Connected
            </button>
            <button
              class="pv-chip"
              :class="{ on: connFilter === 'isolated' }"
              @click="connFilter = connFilter === 'isolated' ? 'all' : 'isolated'"
            >
              🌱 Unlinked
            </button>
          </div>
        </div>

        <div v-if="store.caps.tags && tagOptions.length" class="pv-facet">
          <span class="pv-facet-label">Groups</span>
          <div class="pv-chips">
            <button
              v-for="t in tagOptions"
              :key="t.id"
              class="pv-chip"
              :class="{ on: tagSel.has(t.id) }"
              :style="{ '--chip-c': t.color }"
              @click="toggleSet(tagSel, t.id)"
            >
              <span class="pv-chip-dot" :style="{ background: t.color }"></span>
              <span v-if="t.icon" class="pv-chip-emoji">{{ t.icon }}</span
              >{{ t.label }}
              <span class="pv-chip-n">{{ t.count }}</span>
            </button>
          </div>
        </div>

        <Transition name="pv-clear">
          <button v-if="activeFilterCount" class="pv-clear" @click="clearFilters">
            ✕ Clear {{ activeFilterCount }} filter{{ activeFilterCount > 1 ? 's' : '' }}
          </button>
        </Transition>
      </div>
    </div>

    <!-- Scrollable grid. Native vertical scroll (smooth, real scrollbar) plus
         grab-and-drag navigation; only the rows near the viewport exist in the
         DOM, and the whole visible block is positioned by a single translateY —
         no per-card transforms. Kept mounted (v-show) while a stage mode is
         active so its ResizeObserver + scroll state survive mode switches. -->
    <div
      v-show="store.viewMode === 'grid'"
      ref="scrollEl"
      class="pv-scroll"
      :class="{ dragging }"
      @scroll.passive="onScroll"
      @pointerdown="onPointerDown"
    >
      <div v-if="displayed.length === 0" class="pv-empty">
        <div class="pv-empty-icon">{{ store.persons.length ? '🔍' : '👥' }}</div>
        <div class="pv-empty-title">
          {{ store.persons.length ? 'No matches' : 'No people yet' }}
        </div>
        <div class="pv-empty-text">
          {{
            store.persons.length
              ? 'Try a different search term.'
              : 'Add family members from the graph view to see them here.'
          }}
        </div>
      </div>

      <div v-else class="pv-sizer" :style="{ height: totalHeight + 'px' }">
        <div :key="listVersion" class="pv-grid" :style="gridStyle">
          <PersonCard
            v-for="c in visibleCards"
            :key="c.p.id"
            :person="c.p"
            :selected="store.selectedPersonId === c.p.id"
            :kin="stats(c.p.id).kin"
            :children="stats(c.p.id).children"
            :ref-year="refYear"
            :tags="store.tagsOf.get(c.p.id) || []"
            :card-style="store.cardStyle"
            :entering="animWindow"
            :stagger="c.stagger"
            @select="onCardClick"
          />
        </div>
      </div>
    </div>

    <!-- 3D card stages (carousel / flow / hand / deck) — windowed rendering,
         shared drag/momentum physics; see people/CardStage.vue. -->
    <CardStage
      v-if="isStageMode"
      :mode="store.viewMode"
      :persons="displayed"
      :stats-of="stats"
      :ref-year="refYear"
    />

    <!-- Non-card mediums -->
    <HiveView v-if="store.viewMode === 'hive'" :persons="displayed" :ref-year="refYear" />
    <ReelView
      v-if="store.viewMode === 'reel'"
      :persons="displayed"
      :stats-of="stats"
      :ref-year="refYear"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useMainStore } from '../store/index.js'
import PersonCard from './people/PersonCard.vue'
import CardStylePicker from './people/CardStylePicker.vue'
import ViewModeSwitch from './people/ViewModeSwitch.vue'
import CardStage from './people/CardStage.vue'
import HiveView from './people/HiveView.vue'
import ReelView from './people/ReelView.vue'
import { useVirtualGrid } from './people/useVirtualGrid.js'
import { useDragScroll } from './people/useDragScroll.js'
import { ageOf, CARD_W, CARD_H, GAP, PAD } from './people/peopleLayout.js'

const store = useMainStore()

const refYear = computed(() => store.currentDate?.year ?? new Date().getFullYear())

// Which family of renderer the current view mode belongs to: the card modes
// (grid + 3D stages) show PersonCards and the style picker; the non-card
// mediums (hive / reel) draw people their own way.
const isStageMode = computed(() => ['wheel', 'flow', 'fan', 'deck'].includes(store.viewMode))
const isCardMode = computed(() => store.viewMode === 'grid' || isStageMode.value)

const query = ref('')
const sortBy = ref('name')
const sortOptions = [
  { id: 'name', label: 'A–Z' },
  { id: 'birth', label: 'Year' },
  { id: 'age', label: 'Age' }
]

// ── Filters ───────────────────────────────────────────────────────────────
// A tucked-away panel of live facets over the roster: life status, gender,
// how connected a person is, and (outside Simple mode) group membership.
// Every facet reads counts off the current data so empty options never show.
const filtersOpen = ref(false)
const lifeFilter = ref('all') // 'all' | 'living' | 'deceased'
const connFilter = ref('all') // 'all' | 'connected' | 'isolated'
const genderSel = ref(new Set())
const tagSel = ref(new Set())

const isDeceased = (p) => !!(p.death && (p.death.year != null || p.death.precision))

const genderKey = (p) => (p.gender || '').trim().toLowerCase()
function genderMeta(k) {
  if (k === 'male') return { label: 'Male', color: store.graphSettings.maleColor, glyph: '♂' }
  if (k === 'female') return { label: 'Female', color: store.graphSettings.femaleColor, glyph: '♀' }
  if (k === '') return { label: 'Unknown', color: store.graphSettings.unknownColor, glyph: '?' }
  return {
    label: k[0].toUpperCase() + k.slice(1),
    color: store.graphSettings.unknownColor,
    glyph: '⚧'
  }
}
// Distinct genders present, ordered male → female → others → unknown, each with a count.
const genderOptions = computed(() => {
  const counts = new Map()
  for (const p of store.persons) {
    const k = genderKey(p)
    counts.set(k, (counts.get(k) || 0) + 1)
  }
  const order = (k) => (k === 'male' ? 0 : k === 'female' ? 1 : k === '' ? 3 : 2)
  return [...counts.entries()]
    .map(([k, count]) => ({ key: k, count, ...genderMeta(k) }))
    .sort((a, b) => order(a.key) - order(b.key) || a.label.localeCompare(b.label))
})

// Group (tag) facets — only those with at least one person, busiest first.
const tagOptions = computed(() => {
  const personIds = new Set(store.persons.map((p) => p.id))
  return store.tags
    .map((t) => {
      const members = store.membersOf.get(t.id) || []
      const count = members.reduce((n, id) => n + (personIds.has(id) ? 1 : 0), 0)
      return { id: t.id, label: t.label, color: t.color || 'var(--accent)', icon: t.icon, count }
    })
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
})

const lifeCounts = computed(() => {
  let living = 0
  let deceased = 0
  for (const p of store.persons) isDeceased(p) ? deceased++ : living++
  return { living, deceased }
})

function toggleSet(setRef, value) {
  const next = new Set(setRef.value)
  next.has(value) ? next.delete(value) : next.add(value)
  setRef.value = next
}

const activeFilterCount = computed(
  () =>
    (lifeFilter.value !== 'all' ? 1 : 0) +
    (connFilter.value !== 'all' ? 1 : 0) +
    genderSel.value.size +
    tagSel.value.size
)

function clearFilters() {
  lifeFilter.value = 'all'
  connFilter.value = 'all'
  genderSel.value = new Set()
  tagSel.value = new Set()
}
const sortIndex = computed(() =>
  Math.max(
    0,
    sortOptions.findIndex((o) => o.id === sortBy.value)
  )
)

// Relations/children counts, computed once per data change and looked up by id.
const statsMap = computed(() => {
  const m = {}
  store.persons.forEach((p) => {
    m[p.id] = { kin: 0, children: 0 }
  })
  store.relationships.forEach((r) => {
    if (m[r.person_a_id]) {
      m[r.person_a_id].kin++
      // Children = vertical edges where this person is the parent side.
      if (store.relTypeRoles.get(r.type) === 'vertical') m[r.person_a_id].children++
    }
    if (m[r.person_b_id]) m[r.person_b_id].kin++
  })
  return m
})
function stats(id) {
  return statsMap.value[id] || { kin: 0, children: 0 }
}

const displayed = computed(() => {
  const q = query.value.trim().toLowerCase()
  let list = store.persons
  if (q) {
    list = list.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.occupation || '').toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q)
    )
  }
  if (lifeFilter.value !== 'all') {
    const wantDead = lifeFilter.value === 'deceased'
    list = list.filter((p) => isDeceased(p) === wantDead)
  }
  if (genderSel.value.size) {
    list = list.filter((p) => genderSel.value.has(genderKey(p)))
  }
  if (connFilter.value !== 'all') {
    const wantConnected = connFilter.value === 'connected'
    list = list.filter((p) => stats(p.id).kin > 0 === wantConnected)
  }
  if (tagSel.value.size) {
    list = list.filter((p) => {
      const tags = store.tagsOf.get(p.id)
      return tags ? tags.some((t) => tagSel.value.has(t.id)) : false
    })
  }
  const arr = [...list]
  const ry = refYear.value
  if (sortBy.value === 'name') {
    arr.sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    )
  } else if (sortBy.value === 'birth') {
    arr.sort(
      (a, b) =>
        (a.birth?.year || Infinity) - (b.birth?.year || Infinity) ||
        (a.name || '').localeCompare(b.name || '')
    )
  } else if (sortBy.value === 'age') {
    arr.sort(
      (a, b) =>
        (ageOf(b, ry) ?? -1) - (ageOf(a, ry) ?? -1) || (a.name || '').localeCompare(b.name || '')
    )
  }
  return arr
})

// ── Virtualization ──────────────────────────────────────────────────────────
const scrollEl = ref(null)
const { cols, totalHeight, win, onScroll, remeasure } = useVirtualGrid(
  scrollEl,
  () => displayed.value.length
)
const { dragging, onPointerDown, wasDragged } = useDragScroll(scrollEl)

const gridStyle = computed(() => ({
  transform: `translateY(${win.value.offsetY}px)`,
  gridTemplateColumns: `repeat(${cols.value}, var(--card-w))`,
  '--card-w': CARD_W + 'px',
  '--card-h': CARD_H + 'px',
  '--gap': GAP + 'px',
  '--pad': PAD + 'px'
}))

const visibleCards = computed(() => {
  const list = displayed.value
  const { startIndex, endIndex } = win.value
  const out = []
  for (let i = startIndex; i < endIndex; i++) {
    out.push({ p: list[i], stagger: Math.min(i - startIndex, 24) })
  }
  return out
})

function onCardClick(id) {
  // Swallow the click that ends a drag-to-scroll gesture.
  if (wasDragged()) return
  store.selectPerson(id)
}

// ── Entrance animation ────────────────────────────────────────────────────────
// Re-key the grid on search/sort so the stagger entrance replays; cards scrolled
// into view afterwards just appear. The window guards against cards that mount
// mid-scroll animating in late.
const listVersion = ref(0)
const animWindow = ref(true)
let animTimer = setTimeout(() => {
  animWindow.value = false
}, 1300)
function replayEntrance() {
  animWindow.value = true
  clearTimeout(animTimer)
  animTimer = setTimeout(() => {
    animWindow.value = false
  }, 1300)
}
watch([query, sortBy, lifeFilter, connFilter, genderSel, tagSel], () => {
  listVersion.value++
  replayEntrance()
  // A new result set reads from the top; jump there before the stagger plays.
  // remeasure() resyncs the cached scroll position synchronously so the grid's
  // offset can't lag a frame behind at the old scroll depth.
  if (scrollEl.value) {
    scrollEl.value.scrollTop = 0
    remeasure()
  }
})

// Switching card style re-deals the visible cards with the new style's
// entrance animation — same re-key trick, but the scroll position stays put.
watch(
  () => store.cardStyle,
  () => {
    listVersion.value++
    replayEntrance()
  }
)

// Keep the window in sync when the data set (not just the view) changes size —
// e.g. a person added/removed elsewhere clamps the native scroll position.
watch(
  () => displayed.value.length,
  () => {
    nextTick(remeasure)
  }
)

onMounted(() => {
  // A second measure after layout settles (the view mounts inside a transition).
  nextTick(remeasure)
})
onBeforeUnmount(() => {
  if (animTimer) clearTimeout(animTimer)
})
</script>

<style scoped>
.people-view {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background:
    radial-gradient(1200px 600px at 80% -10%, rgba(108, 142, 245, 0.08), transparent 60%), var(--bg);
  min-height: 0;
}

/* ── Toolbar ─────────────────────────────────────────────── */
.pv-toolbar {
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
.pv-heading {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pv-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: var(--t1);
}
.pv-count {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  background: var(--adim);
  padding: 2px 9px;
  border-radius: 20px;
}
.pv-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.pv-search {
  display: flex;
  align-items: center;
  gap: 7px;
  background: var(--elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0 10px;
  height: 36px;
  min-width: 220px;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.pv-search:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(108, 142, 245, 0.15);
}
.pv-search-icon {
  font-size: 13px;
  opacity: 0.7;
}
.pv-search-input {
  border: none;
  background: transparent;
  padding: 0;
  height: 100%;
  font-size: 13px;
  color: var(--t1);
  width: 100%;
  box-shadow: none;
}
.pv-search-input:focus {
  box-shadow: none;
}
.pv-search-clear {
  border: none;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  font-size: 11px;
  padding: 2px;
  border-radius: 4px;
  transition: color 0.12s;
}
.pv-search-clear:hover {
  color: var(--t1);
}

.pv-sort {
  position: relative;
  display: flex;
  background: var(--elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 3px;
  height: 36px;
}
.pv-sort-track {
  position: absolute;
  inset: 3px;
  pointer-events: none;
}
.pv-sort-thumb {
  position: absolute;
  top: 0;
  left: 0;
  width: 33.333%;
  height: 100%;
  background: var(--accent);
  border-radius: 7px;
  box-shadow: 0 2px 8px rgba(108, 142, 245, 0.35);
  transition: transform 0.28s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.pv-sort-opt {
  position: relative;
  z-index: 1;
  border: none;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 0 16px;
  border-radius: 7px;
  transition: color 0.2s;
}
.pv-sort-opt.active {
  color: #fff;
}

/* ── Filter toggle button ────────────────────────────────── */
.pv-filter-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.18s,
    background 0.18s,
    border-color 0.18s;
}
.pv-filter-btn:hover {
  color: var(--t1);
  background: var(--hover);
}
.pv-filter-btn.active {
  color: var(--t1);
  border-color: rgba(108, 142, 245, 0.45);
}
.pv-filter-icon {
  font-size: 13px;
  transition: transform 0.4s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.pv-filter-icon.open {
  transform: rotate(90deg);
}
.pv-filter-badge {
  min-width: 17px;
  height: 17px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: var(--accent);
  color: #fff;
  font-size: 10.5px;
  font-weight: 800;
}
.pv-badge-enter-active,
.pv-badge-leave-active {
  transition:
    transform 0.24s cubic-bezier(0.34, 1.5, 0.5, 1),
    opacity 0.2s ease;
}
.pv-badge-enter-from,
.pv-badge-leave-to {
  transform: scale(0);
  opacity: 0;
}

/* Card-style picker slips away when a non-card medium is active */
.pv-stylepick-enter-active {
  transition:
    opacity 0.25s ease,
    transform 0.3s cubic-bezier(0.34, 1.3, 0.5, 1);
}
.pv-stylepick-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.18s ease;
}
.pv-stylepick-enter-from,
.pv-stylepick-leave-to {
  opacity: 0;
  transform: scale(0.85);
}

/* ── Facet panel (grid-rows slide-open) ──────────────────── */
.pv-filters {
  flex: 0 0 auto;
  display: grid;
  grid-template-rows: 0fr;
  background: var(--glass-soft);
  border-bottom: 1px solid transparent;
  transition:
    grid-template-rows 0.34s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.34s ease;
  z-index: 2;
}
.pv-filters.open {
  grid-template-rows: 1fr;
  border-bottom-color: var(--border);
}
.pv-filters-inner {
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 20px;
  padding: 0 22px;
  transition: padding 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}
.pv-filters.open .pv-filters-inner {
  padding: 14px 22px;
}

.pv-facet {
  display: flex;
  align-items: center;
  gap: 9px;
}
.pv-facet-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.7px;
  text-transform: uppercase;
  color: var(--t3);
}
.pv-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pv-chip {
  --chip-c: var(--accent);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.16s,
    color 0.16s,
    border-color 0.16s,
    transform 0.16s;
}
.pv-chip:hover {
  transform: translateY(-1px);
  color: var(--t1);
}
.pv-chip.on {
  background: color-mix(in srgb, var(--chip-c) 16%, transparent);
  border-color: color-mix(in srgb, var(--chip-c) 50%, transparent);
  color: var(--t1);
}
.pv-chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--chip-c);
  flex-shrink: 0;
  transition: transform 0.2s;
}
.pv-chip.on .pv-chip-dot {
  transform: scale(1.25);
}
.pv-chip-glyph {
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
}
.pv-chip-emoji {
  font-size: 12px;
}
.pv-chip-n {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--t3);
  font-variant-numeric: tabular-nums;
}
.pv-chip.on .pv-chip-n {
  color: color-mix(in srgb, var(--chip-c) 80%, var(--t1));
}
.life-living {
  --chip-c: var(--green);
}
.life-deceased {
  --chip-c: var(--t3);
}

.pv-clear {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 20px;
  background: transparent;
  color: var(--t3);
  font-family: var(--font);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s;
}
.pv-clear:hover {
  color: #ef5350;
  background: rgba(239, 83, 80, 0.1);
}
.pv-clear-enter-active,
.pv-clear-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.pv-clear-enter-from,
.pv-clear-leave-to {
  opacity: 0;
  transform: translateX(-6px);
}

/* ── Scrollable grid ─────────────────────────────────────── */
.pv-scroll {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  /* Reserve the scrollbar gutter so the column count never reflows when the
     scrollbar appears or disappears. */
  scrollbar-gutter: stable;
  cursor: grab;
}
.pv-scroll.dragging {
  cursor: grabbing;
  user-select: none;
}
/* While panning, skip card hover/hit-testing entirely — restyling dozens of
   cards mid-drag causes needless style recalculation, and the grab cursor wins. */
.pv-scroll.dragging :deep(.pcard) {
  pointer-events: none;
}

/* Full-height spacer that gives the scroll container its scrollbar; the grid is
   positioned inside it. */
.pv-sizer {
  position: relative;
  width: 100%;
}

.pv-grid {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: grid;
  gap: var(--gap, 22px);
  grid-auto-rows: var(--card-h, 297px);
  justify-content: center;
  padding: 0 var(--pad, 24px);
  will-change: transform;
}

/* ── Empty state ─────────────────────────────────────────── */
.pv-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
  color: var(--t2);
  pointer-events: none;
}
.pv-empty-icon {
  font-size: 44px;
  opacity: 0.6;
}
.pv-empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--t1);
}
.pv-empty-text {
  font-size: 13px;
  max-width: 280px;
}
</style>
