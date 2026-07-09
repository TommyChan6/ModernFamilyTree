<template>
  <div class="people-view">
    <!-- Toolbar -->
    <div class="pv-toolbar">
      <div class="pv-heading">
        <span class="pv-title">All People</span>
        <span class="pv-count">{{ displayed.length }}</span>
      </div>

      <div class="pv-controls">
        <div class="pv-search">
          <span class="pv-search-icon">🔍</span>
          <input
            v-model="query"
            class="pv-search-input"
            placeholder="Search people…"
          />
          <button v-if="query" class="pv-search-clear" @click="query = ''" title="Clear">✕</button>
        </div>

        <div class="pv-sort">
          <div class="pv-sort-track">
            <div class="pv-sort-thumb" :style="{ transform: `translateX(${sortIndex * 100}%)` }"></div>
          </div>
          <button
            v-for="opt in sortOptions"
            :key="opt.id"
            class="pv-sort-opt"
            :class="{ active: sortBy === opt.id }"
            @click="sortBy = opt.id"
          >{{ opt.label }}</button>
        </div>
      </div>
    </div>

    <!-- Scrollable grid. Native vertical scroll (smooth, real scrollbar) plus
         grab-and-drag navigation; only the rows near the viewport exist in the
         DOM, and the whole visible block is positioned by a single translateY —
         no per-card transforms. -->
    <div
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
          {{ store.persons.length
            ? 'Try a different search term.'
            : 'Add family members from the tree view to see them here.' }}
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
            :entering="animWindow"
            :stagger="c.stagger"
            @select="onCardClick"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useMainStore } from '../store/index.js'
import PersonCard from './people/PersonCard.vue'
import { useVirtualGrid } from './people/useVirtualGrid.js'
import { useDragScroll } from './people/useDragScroll.js'
import { ageOf, CARD_W, CARD_H, GAP, PAD } from './people/peopleLayout.js'

const store = useMainStore()

const refYear = computed(() => store.currentDate?.year ?? new Date().getFullYear())

const query = ref('')
const sortBy = ref('name')
const sortOptions = [
  { id: 'name', label: 'A–Z' },
  { id: 'birth', label: 'Year' },
  { id: 'age', label: 'Age' },
]
const sortIndex = computed(() => Math.max(0, sortOptions.findIndex(o => o.id === sortBy.value)))

// Relations/children counts, computed once per data change and looked up by id.
const statsMap = computed(() => {
  const m = {}
  store.persons.forEach(p => { m[p.id] = { kin: 0, children: 0 } })
  store.relationships.forEach(r => {
    if (m[r.person_a_id]) {
      m[r.person_a_id].kin++
      if (r.type === 'parent_child' || r.type === 'adopted') m[r.person_a_id].children++
    }
    if (m[r.person_b_id]) m[r.person_b_id].kin++
  })
  return m
})
function stats(id) { return statsMap.value[id] || { kin: 0, children: 0 } }

const displayed = computed(() => {
  const q = query.value.trim().toLowerCase()
  let list = store.persons
  if (q) {
    list = list.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.occupation || '').toLowerCase().includes(q) ||
      (p.location || '').toLowerCase().includes(q)
    )
  }
  const arr = [...list]
  const ry = refYear.value
  if (sortBy.value === 'name') {
    arr.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
  } else if (sortBy.value === 'birth') {
    arr.sort((a, b) => (a.birth_year || Infinity) - (b.birth_year || Infinity) || (a.name || '').localeCompare(b.name || ''))
  } else if (sortBy.value === 'age') {
    arr.sort((a, b) => (ageOf(b, ry) ?? -1) - (ageOf(a, ry) ?? -1) || (a.name || '').localeCompare(b.name || ''))
  }
  return arr
})

// ── Virtualization ──────────────────────────────────────────────────────────
const scrollEl = ref(null)
const { cols, totalHeight, win, onScroll, remeasure } =
  useVirtualGrid(scrollEl, () => displayed.value.length)
const { dragging, onPointerDown, wasDragged } = useDragScroll(scrollEl)

const gridStyle = computed(() => ({
  transform: `translateY(${win.value.offsetY}px)`,
  gridTemplateColumns: `repeat(${cols.value}, var(--card-w))`,
  '--card-w': CARD_W + 'px',
  '--card-h': CARD_H + 'px',
  '--gap': GAP + 'px',
  '--pad': PAD + 'px',
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
let animTimer = setTimeout(() => { animWindow.value = false }, 1300)
function replayEntrance() {
  animWindow.value = true
  clearTimeout(animTimer)
  animTimer = setTimeout(() => { animWindow.value = false }, 1300)
}
watch([query, sortBy], () => {
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

// Keep the window in sync when the data set (not just the view) changes size —
// e.g. a person added/removed elsewhere clamps the native scroll position.
watch(() => displayed.value.length, () => { nextTick(remeasure) })

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
    radial-gradient(1200px 600px at 80% -10%, rgba(108, 142, 245, 0.08), transparent 60%),
    var(--bg);
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
.pv-heading { display: flex; align-items: center; gap: 10px; }
.pv-title { font-size: 18px; font-weight: 700; letter-spacing: -0.2px; color: var(--t1); }
.pv-count {
  font-size: 12px; font-weight: 700; color: var(--accent);
  background: var(--adim); padding: 2px 9px; border-radius: 20px;
}
.pv-controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

.pv-search {
  display: flex; align-items: center; gap: 7px;
  background: var(--elevated); border: 1px solid var(--border);
  border-radius: 10px; padding: 0 10px; height: 36px; min-width: 220px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.pv-search:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(108, 142, 245, 0.15); }
.pv-search-icon { font-size: 13px; opacity: 0.7; }
.pv-search-input {
  border: none; background: transparent; padding: 0; height: 100%;
  font-size: 13px; color: var(--t1); width: 100%; box-shadow: none;
}
.pv-search-input:focus { box-shadow: none; }
.pv-search-clear {
  border: none; background: transparent; color: var(--t3); cursor: pointer;
  font-size: 11px; padding: 2px; border-radius: 4px; transition: color 0.12s;
}
.pv-search-clear:hover { color: var(--t1); }

.pv-sort {
  position: relative; display: flex; background: var(--elevated);
  border: 1px solid var(--border); border-radius: 10px; padding: 3px; height: 36px;
}
.pv-sort-track { position: absolute; inset: 3px; pointer-events: none; }
.pv-sort-thumb {
  position: absolute; top: 0; left: 0; width: 33.333%; height: 100%;
  background: var(--accent); border-radius: 7px;
  box-shadow: 0 2px 8px rgba(108, 142, 245, 0.35);
  transition: transform 0.28s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.pv-sort-opt {
  position: relative; z-index: 1; border: none; background: transparent;
  color: var(--t2); font-family: var(--font); font-size: 12px; font-weight: 600;
  cursor: pointer; padding: 0 16px; border-radius: 7px; transition: color 0.2s;
}
.pv-sort-opt.active { color: #fff; }

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
.pv-scroll.dragging :deep(.pcard) { pointer-events: none; }

/* Full-height spacer that gives the scroll container its scrollbar; the grid is
   positioned inside it. */
.pv-sizer { position: relative; width: 100%; }

.pv-grid {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: grid;
  gap: var(--gap, 22px);
  grid-auto-rows: var(--card-h, 330px);
  justify-content: center;
  padding: 0 var(--pad, 24px);
  will-change: transform;
}

/* ── Empty state ─────────────────────────────────────────── */
.pv-empty {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; gap: 8px; color: var(--t2); pointer-events: none;
}
.pv-empty-icon { font-size: 44px; opacity: 0.6; }
.pv-empty-title { font-size: 16px; font-weight: 700; color: var(--t1); }
.pv-empty-text { font-size: 13px; max-width: 280px; }
</style>
