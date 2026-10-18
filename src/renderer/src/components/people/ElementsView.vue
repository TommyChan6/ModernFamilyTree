<template>
  <div class="elx">
    <div v-if="!persons.length" class="elx-empty">
      <div class="elx-empty-icon"><UiIcon name="atom" :size="44" :stroke="1.5" /></div>
      <div class="elx-empty-title">{{ t('directory.elements.emptyTitle') }}</div>
      <div class="elx-empty-text">{{ t('directory.elements.emptyText') }}</div>
    </div>

    <template v-else>
      <!-- ── Header: the big element card + controls + legend ── -->
      <header class="elx-head">
        <div
          v-if="featured"
          :key="featured.p.id"
          class="elx-detail"
          :class="{ dead: featured.dead }"
          :style="{ '--el-cc': featured.color }"
        >
          <div class="elx-big">
            <span class="elx-big-num">{{ featured.no }}</span>
            <UiIcon
              v-if="featured.dead"
              class="elx-big-moon"
              name="moon"
              :size="14"
              :label="t('directory.elements.deceased')"
            />
            <div class="elx-big-sym" :data-len="symLen(featured.sym)">{{ featured.sym }}</div>
            <div class="elx-big-name">{{ featured.p.name || t('directory.elements.unnamed') }}</div>
            <div class="elx-big-mass">{{ featured.mass }}</div>
          </div>
          <div class="elx-portrait">
            <DetailArt :person="featured.p" />
          </div>
          <div class="elx-facts">
            <div class="elx-facts-title">
              {{ featured.p.name || t('directory.elements.unnamed') }}
              <span class="elx-facts-cat">{{ featured.catLabel }}</span>
            </div>
            <div v-if="featured.sub" class="elx-facts-sub">{{ featured.sub }}</div>
            <dl class="elx-stats">
              <div>
                <dt>{{ t('directory.elements.stats.born') }}</dt>
                <dd>{{ featured.born }}</dd>
              </div>
              <div>
                <dt>{{ t('directory.elements.stats.died') }}</dt>
                <dd>{{ featured.died }}</dd>
              </div>
              <div>
                <dt>{{ t('directory.elements.stats.age') }}</dt>
                <dd>{{ featured.age }}</dd>
              </div>
              <div>
                <dt>{{ t('directory.elements.stats.kin') }}</dt>
                <dd>{{ featured.kin }}</dd>
              </div>
              <div>
                <dt>{{ t('directory.elements.stats.children') }}</dt>
                <dd>{{ featured.children }}</dd>
              </div>
              <div>
                <dt>{{ t('directory.elements.stats.group') }}</dt>
                <dd>{{ featured.group }}</dd>
              </div>
            </dl>
            <div v-if="featured.tags.length" class="elx-tags">
              <span
                v-for="tg in featured.tags"
                :key="tg.id"
                class="elx-tag"
                :style="{ '--tc': tg.color || 'var(--accent)' }"
              >
                <UiIcon v-if="tg.icon" :name="tg.icon" :size="12" />
                {{ defaultNameLabel(tg.label) }}
              </span>
            </div>
          </div>
        </div>

        <div class="elx-side">
          <div class="elx-controls">
            <div class="elx-seg" role="group" :aria-label="t('directory.elements.groupByAria')">
              <span class="elx-seg-label">{{ t('directory.elements.groupsLabel') }}</span>
              <button
                v-for="g in GROUPINGS"
                :key="g.id"
                class="elx-seg-btn"
                :class="{ on: grouping === g.id }"
                @click="setGrouping(g.id)"
              >
                {{ t('directory.elements.groupings.' + g.id) }}
              </button>
            </div>
            <div class="elx-seg" role="group" :aria-label="t('directory.elements.colourByAria')">
              <span class="elx-seg-label">{{ t('directory.elements.colourLabel') }}</span>
              <button
                v-for="c in COLORINGS"
                :key="c.id"
                class="elx-seg-btn"
                :class="{ on: coloring === c.id }"
                @click="setColoring(c.id)"
              >
                {{ t('directory.elements.colorings.' + c.id) }}
              </button>
            </div>
          </div>
          <div class="elx-legend">
            <button
              v-for="c in categories"
              :key="c.key"
              class="elx-leg"
              :class="{ on: activeCat === c.key, off: activeCat && activeCat !== c.key }"
              :style="{ '--el-cc': c.color }"
              @pointerenter="onLegendEnter(c.key)"
              @pointerleave="onLegendLeave"
              @click="toggleLegendPin(c.key)"
            >
              <span class="elx-leg-sw"></span>
              <span class="elx-leg-label">{{ c.label }}</span>
              <span class="elx-leg-n">{{ c.count }}</span>
            </button>
          </div>
          <div class="elx-hint">
            {{
              t('directory.elements.hint', {
                elements: persons.length,
                groups: layout.columns.length,
                periods: layout.maxRows
              })
            }}
          </div>
        </div>
      </header>

      <!-- ── The table ── -->
      <div ref="scrollEl" class="elx-scroll" @scroll.passive="onScroll">
        <div
          class="elx-sizer"
          :class="{ snap: morph && morph.phase === 'from' }"
          :style="sizerStyle"
        >
          <!-- Group numbers: sticky to the top, scroll with the columns -->
          <div class="elx-colbar">
            <div class="elx-corner">#</div>
            <div
              v-for="hd in headers"
              :key="hd.key"
              class="elx-col"
              :class="{ unknown: hd.unknown }"
              :style="hd.style"
            >
              <span v-if="hd.color" class="elx-col-dot" :style="{ background: hd.color }"></span>
              <span class="elx-col-label">{{ hd.label }}</span>
              <span class="elx-col-n">{{ hd.count }}</span>
            </div>
          </div>
          <!-- Undiscovered slots: a dashed ghost grid behind the tiles -->
          <div v-if="viewW" class="elx-ghost" :style="ghostStyle" aria-hidden="true"></div>
          <!-- Period numbers: sticky to the left -->
          <div class="elx-rail" :style="{ height: railH + 'px' }">
            <div v-for="r in periods" :key="r.n" class="elx-period" :style="r.style">
              {{ r.n }}
            </div>
          </div>

          <div
            v-for="tl in tiles"
            :key="tl.p.id"
            class="el"
            :class="{
              enter: tl.enter,
              pop: tl.pop,
              dead: tl.dead,
              selected: store.selectedPersonId === tl.p.id,
              lit: activeCat && tl.cat === activeCat,
              dim: activeCat && tl.cat !== activeCat
            }"
            :style="tl.style"
            @pointerenter="onTileEnter(tl.p.id)"
            @pointerleave="onTileLeave"
            @click="select(tl.p.id)"
          >
            <div class="el-in">
              <span class="el-num">{{ tl.no }}</span>
              <UiIcon
                v-if="tl.dead"
                class="el-moon"
                name="moon"
                :size="12"
                :label="t('directory.elements.deceased')"
              />
              <div class="el-sym" :data-len="symLen(tl.sym)">{{ tl.sym }}</div>
              <div class="el-name">{{ tl.p.name || t('directory.elements.unnamed') }}</div>
              <div class="el-mass">{{ tl.mass }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, h } from 'vue'
import { useMainStore } from '../../store/index.js'
import { useI18n } from '../../i18n'
import { defaultNameLabel } from '../../lib/dataLabels'
import { isDeceased, ageOf } from './peopleLayout.js'
import { useThumbnail } from './useThumbnail.js'
import UiIcon from '../ui/UiIcon.js'
import {
  COL_PITCH,
  ROW_PITCH,
  TILE_W,
  TILE_H,
  PAD,
  assignSymbols,
  symbolCandidates,
  generationsOf,
  groupOf,
  layoutTable,
  visibleRange
} from './elementsLayout.js'

// Elements: the family as a periodic table. Columns are "groups" (birth
// decade, generation, or first tag), rows are "periods" in roster order, and
// each tile is tinted by a category (gender, life status, or tag). Tiles are
// absolutely positioned by transform so regrouping/recolouring FLIPs them
// smoothly to their new cells, and only tiles near the scroll viewport exist
// in the DOM (2-D windowing), so thousands of people stay smooth.

const props = defineProps({
  persons: { type: Array, required: true },
  statsOf: { type: Function, required: true },
  refYear: { type: Number, required: true }
})

const store = useMainStore()
const { t } = useI18n()
const scrollEl = ref(null)

const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ── Remembered controls ─────────────────────────────────────────────────────
// Labels are translated at render time by id (directory.elements.groupings.* /
// directory.elements.colorings.*).
const GROUPINGS = [{ id: 'decade' }, { id: 'generation' }, { id: 'tag' }]
const COLORINGS = [{ id: 'gender' }, { id: 'life' }, { id: 'group' }]
function loadPref(key, allowed, fallback) {
  try {
    const v = localStorage.getItem('elements.' + key)
    return allowed.some((a) => a.id === v) ? v : fallback
  } catch {
    return fallback
  }
}
function savePref(key, v) {
  try {
    localStorage.setItem('elements.' + key, v)
  } catch {
    /* storage unavailable — the choice just isn't remembered */
  }
}
const grouping = ref(loadPref('grouping', GROUPINGS, 'decade'))
const coloring = ref(loadPref('coloring', COLORINGS, 'gender'))

// ── Portrait for the detail card (own component → own reactive thumbnail) ──
const DetailArt = {
  props: { person: { type: Object, required: true } },
  setup(p) {
    const { src } = useThumbnail(() => p.person.primary_image || '', 256)
    const initials = computed(() => {
      const parts = (p.person.name || '?').trim().split(/\s+/).filter(Boolean)
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      return (parts[0] || '?').substring(0, 2).toUpperCase()
    })
    return () =>
      src.value
        ? h('img', { class: 'elx-portrait-img', src: src.value, alt: '', draggable: false })
        : h('div', { class: 'elx-portrait-mono' }, initials.value)
  }
}

// ── Derived data ────────────────────────────────────────────────────────────
// Symbols come from the whole project roster (store order) so filtering or
// re-sorting the Directory never renames an element.
const symbols = computed(() => assignSymbols(store.persons))
// Longer symbols (digit-suffixed duplicates) shrink to fit the tile.
const symLen = (sym) => Math.min(5, [...sym].length)
const symOf = (p) => symbols.value.get(p.id) || symbolCandidates(p.name)[0]
const gens = computed(() => generationsOf(store.persons, store.relationships, store.relTypeRoles))
const indexOf = computed(() => {
  const m = new Map()
  props.persons.forEach((p, i) => m.set(p.id, i))
  return m
})
const personById = computed(() => new Map(props.persons.map((p) => [p.id, p])))

// Only the active grouping's lookup is touched, so the generation walk runs
// only while columns are generations.
const keyOf = (p) =>
  groupOf(
    p,
    grouping.value,
    grouping.value === 'generation' ? { gens: gens.value } : { tagsOf: store.tagsOf }
  )

// ── Categories (legend + tile tint) ─────────────────────────────────────────
function genderColor(g) {
  return g === 'male'
    ? store.graphSettings.maleColor
    : g === 'female'
      ? store.graphSettings.femaleColor
      : store.graphSettings.unknownColor
}
function catOf(p) {
  if (coloring.value === 'gender')
    return p.gender === 'male' || p.gender === 'female' ? p.gender : 'other'
  if (coloring.value === 'life') {
    if (isDeceased(p, props.refYear)) return 'dead'
    return ageOf(p, props.refYear) != null ? 'living' : 'unknown'
  }
  const tg = store.tagsOf.get(p.id)?.[0]
  return tg ? 't' + tg.id : 'none'
}
const catMeta = computed(() => {
  const m = new Map()
  if (coloring.value === 'gender') {
    m.set('male', { label: t('data.gender.male'), color: genderColor('male') })
    m.set('female', { label: t('data.gender.female'), color: genderColor('female') })
    m.set('other', { label: t('directory.elements.cats.other'), color: genderColor('') })
  } else if (coloring.value === 'life') {
    m.set('living', { label: t('directory.elements.cats.living'), color: 'var(--green)' })
    m.set('dead', { label: t('directory.elements.cats.deceased'), color: 'var(--t3)' })
    m.set('unknown', { label: t('directory.elements.cats.undated'), color: 'var(--amber)' })
  } else {
    const seen = new Map()
    for (const p of props.persons) {
      const tg = store.tagsOf.get(p.id)?.[0]
      if (tg && !seen.has(tg.id)) seen.set(tg.id, tg)
    }
    const list = [...seen.values()].sort((a, b) => (a.label || '').localeCompare(b.label || ''))
    for (const tg of list)
      m.set('t' + tg.id, { label: tagName(tg), color: tg.color || 'var(--accent)' })
    m.set('none', { label: t('directory.elements.cats.untagged'), color: 'var(--t3)' })
  }
  return m
})
const catByPerson = computed(() => {
  const m = new Map()
  for (const p of props.persons) m.set(p.id, catOf(p))
  return m
})
const categories = computed(() => {
  const counts = new Map()
  for (const c of catByPerson.value.values()) counts.set(c, (counts.get(c) || 0) + 1)
  const out = []
  for (const [key, meta] of catMeta.value)
    if (counts.get(key)) out.push({ key, ...meta, count: counts.get(key) })
  return out
})
const colorOfCat = (cat) => catMeta.value.get(cat)?.color || 'var(--t3)'

// Legend hover lights one category (dims the rest); a click pins it.
const hoverCat = ref(null)
const pinCat = ref(null)
const activeCat = computed(() => hoverCat.value ?? pinCat.value)
function onLegendEnter(key) {
  hoverCat.value = key
}
function onLegendLeave() {
  hoverCat.value = null
}
function toggleLegendPin(key) {
  pinCat.value = pinCat.value === key ? null : key
}
watch(coloring, () => {
  pinCat.value = null
  hoverCat.value = null
})

// ── Geometry + viewport ─────────────────────────────────────────────────────
const RAIL_W = 28
const COLBAR_H = 34
const ORIGIN_Y = COLBAR_H + 12

const viewW = ref(0)
const viewH = ref(0)
const scrollTop = ref(0)
const scrollLeft = ref(0)

const layout = computed(() => layoutTable(props.persons, keyOf, { originX: 0, originY: ORIGIN_Y }))
// Horizontal origin: centred when the table is narrower than the viewport.
const originXFor = (contentW) =>
  RAIL_W + Math.max(PAD, Math.round((viewW.value - RAIL_W - contentW) / 2))
const originX = computed(() => originXFor(layout.value.contentW))

const sizerW = computed(() => originX.value + layout.value.contentW + PAD)
const sizerH = computed(() => ORIGIN_Y + layout.value.contentH + PAD + 10)
const sizerStyle = computed(() => ({
  width: Math.max(sizerW.value, viewW.value) + 'px',
  height: sizerH.value + 'px'
}))
const railH = computed(() => Math.max(0, sizerH.value - COLBAR_H))

let raf = 0
function onScroll() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    const el = scrollEl.value
    if (!el) return
    scrollTop.value = el.scrollTop
    scrollLeft.value = el.scrollLeft
  })
}
function remeasure() {
  const el = scrollEl.value
  if (!el) return
  viewW.value = el.clientWidth
  viewH.value = el.clientHeight
  scrollTop.value = el.scrollTop
  scrollLeft.value = el.scrollLeft
}
let ro = null
function observe() {
  ro?.disconnect()
  if (!scrollEl.value) return
  ro = new ResizeObserver(remeasure)
  ro.observe(scrollEl.value)
  remeasure()
}
onMounted(() => nextTick(observe))
// The table only exists while the roster is non-empty — re-observe when it
// (re)appears.
watch(scrollEl, () => nextTick(observe))

// ── Morph (FLIP): regroup / refilter slides tiles from old cells to new ────
// On a layout change, render one frame with every tile at its OLD position
// (so tiles newly scrolled into the window mount there too), then flip to the
// new positions; the CSS transform transition does the flight.
//
// The scroll is re-anchored at the same time: the old tile nearest the
// viewport centre keeps its on-screen spot (so the table doesn't fly off
// screen when it narrows), and the old positions are shifted by the same
// scroll delta so nothing jumps in the "from" frame.
const morph = ref(null) // { cells, columns, maxRows, ox, dx, dy, contentW, contentH, phase }
let morphRaf1 = 0
let morphRaf2 = 0
let morphTimer = 0
const sizerWFor = (L) => Math.max(originXFor(L.contentW) + L.contentW + PAD, viewW.value)
const sizerHFor = (L) => ORIGIN_Y + L.contentH + PAD + 10
watch(layout, (nl, ol) => {
  cancelAnimationFrame(morphRaf1)
  cancelAnimationFrame(morphRaf2)
  clearTimeout(morphTimer)
  const el = scrollEl.value
  if (!ol || !el || !ol.columns.length || !nl.columns.length || !viewW.value) {
    morph.value = null
    return
  }
  const sx = scrollLeft.value
  const sy = scrollTop.value
  const oldOx = originXFor(ol.contentW)
  const newOx = originXFor(nl.contentW)
  // Anchor: the surviving visible tile closest to the viewport centre.
  const seen = new Set()
  visibleIds(ol, oldOx, seen, sx, sy)
  const cx = sx + viewW.value / 2
  const cy = sy + viewH.value / 2
  let tx = 0
  let ty = 0
  let best = Infinity
  for (const id of seen) {
    const o = ol.cells.get(id)
    const n = nl.cells.get(id)
    if (!o || !n) continue
    const d = (oldOx + o.x + TILE_W / 2 - cx) ** 2 + (o.y + TILE_H / 2 - cy) ** 2
    if (d < best) {
      best = d
      tx = sx + newOx + n.x - (oldOx + o.x)
      ty = sy + n.y - o.y
    }
  }
  tx = Math.round(Math.max(0, Math.min(sizerWFor(nl) - viewW.value, tx)))
  ty = Math.round(Math.max(0, Math.min(sizerHFor(nl) - viewH.value, ty)))
  // The render below already uses the target scroll; the element follows once
  // the new sizer is in the DOM (still before paint).
  scrollLeft.value = tx
  scrollTop.value = ty
  nextTick(() => {
    el.scrollLeft = tx
    el.scrollTop = ty
  })
  if (reduceMotion) {
    morph.value = null
    return
  }
  morph.value = {
    cells: ol.cells,
    columns: ol.columns,
    maxRows: ol.maxRows,
    contentW: ol.contentW,
    contentH: ol.contentH,
    ox: oldOx,
    dx: tx - sx,
    dy: ty - sy,
    phase: 'from'
  }
  morphRaf1 = requestAnimationFrame(() => {
    morphRaf2 = requestAnimationFrame(() => {
      if (morph.value) morph.value = { ...morph.value, phase: 'to' }
      morphTimer = setTimeout(() => (morph.value = null), 1300)
    })
  })
})

// Colour change: a short window in which tiles recolour in a column wave.
const colorWave = ref(false)
let colorTimer = 0
function setColoring(id) {
  if (coloring.value === id) return
  coloring.value = id
  savePref('coloring', id)
  if (reduceMotion) return
  colorWave.value = true
  clearTimeout(colorTimer)
  colorTimer = setTimeout(() => (colorWave.value = false), 1200)
}
function setGrouping(id) {
  if (grouping.value === id) return
  grouping.value = id
  savePref('grouping', id)
}

// ── Entrance cascade (column by column) on first mount ──────────────────────
const entering = ref(!reduceMotion)
let enterTimer = setTimeout(() => (entering.value = false), 2000)

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// Visible person ids of a layout for a scroll window (default: the current).
function visibleIds(L, ox, into, sx = scrollLeft.value, sy = scrollTop.value) {
  const [c0, c1] = visibleRange(sx, viewW.value, ox, COL_PITCH, L.columns.length, 1)
  const [r0, r1] = visibleRange(sy, viewH.value, ORIGIN_Y, ROW_PITCH, L.maxRows, 1)
  for (let c = c0; c <= c1; c++) {
    const ids = L.columns[c].ids
    const last = Math.min(r1, ids.length - 1)
    for (let r = r0; r <= last; r++) into.add(ids[r])
  }
  return [c0, r0]
}

function massOf(p, dead) {
  const age = ageOf(p, props.refYear)
  if (age == null) return dead ? '[?]' : '—'
  // Decayed elements get the bracketed "most stable isotope" mass.
  const yr = t('directory.elements.massYears', { age })
  return dead ? `[${yr}]` : yr
}

const tiles = computed(() => {
  const L = layout.value
  if (!L.columns.length || !viewW.value) return []
  const ox = originX.value
  const M = morph.value
  const ids = new Set()
  const [c0, r0] = visibleIds(L, ox, ids)
  if (M) visibleIds(M, M.ox, ids, scrollLeft.value - M.dx, scrollTop.value - M.dy)
  const from = M && M.phase === 'from'
  const sl = scrollLeft.value
  const st = scrollTop.value
  const out = []
  for (const id of ids) {
    const p = personById.value.get(id)
    const cell = L.cells.get(id)
    if (!p || !cell) continue
    const prev = M ? M.cells.get(id) : null
    let x = ox + cell.x
    let y = cell.y
    if (from && prev) {
      // Start from the old cell — but tiles coming from far off-screen start
      // just past the viewport edge, so their flight is actually seen.
      x = clamp(M.ox + prev.x + M.dx, sl - TILE_W - 60, sl + viewW.value + 60)
      y = clamp(prev.y + M.dy, st - TILE_H - 60, st + viewH.value + 60)
    }
    const dead = isDeceased(p, props.refYear)
    const cat = catByPerson.value.get(id)
    const style = {
      transform: `translate(${x}px, ${y}px)`,
      '--el-cc': colorOfCat(cat)
    }
    if (entering.value)
      style['--ed'] =
        Math.min(
          Math.max(0, cell.col - c0) * 0.06 + Math.max(0, cell.row - r0) * 0.018,
          1.4
        ).toFixed(3) + 's'
    if (M)
      style['--md'] =
        Math.min(
          Math.max(0, cell.col - c0) * 0.03 + Math.max(0, cell.row - r0) * 0.012,
          0.4
        ).toFixed(3) + 's'
    if (colorWave.value)
      style['--cd'] =
        Math.min(
          Math.max(0, cell.col - c0) * 0.035 + Math.max(0, cell.row - r0) * 0.012,
          0.6
        ).toFixed(3) + 's'
    out.push({
      p,
      cat,
      dead,
      no: (indexOf.value.get(id) ?? 0) + 1,
      sym: symOf(p),
      mass: massOf(p, dead),
      enter: entering.value,
      pop: !!M && !prev,
      style
    })
  }
  return out
})

const unknownLabel = computed(() =>
  grouping.value === 'tag'
    ? t('directory.elements.cats.untagged')
    : grouping.value === 'decade'
      ? t('directory.elements.cats.undated')
      : '?'
)
// A column descriptor's display label. The pure layout emits English labels
// ('Gen 3', '1950s', tag names); translate from the numeric order / tag here.
function tagName(tg) {
  return defaultNameLabel(tg?.label) || t('directory.elements.tagFallback')
}
function colLabel(g) {
  if (!g || g.unknown) return unknownLabel.value
  if (typeof g.order === 'number' && g.key.startsWith('g'))
    return t('directory.elements.gen', { n: g.order })
  if (typeof g.order === 'number' && g.key.startsWith('d')) {
    const d = g.order
    return t('directory.elements.decade', { d: d < 0 ? '−' + -d : d })
  }
  return g.label ? defaultNameLabel(g.label) : t('directory.elements.tagFallback')
}
const ghostStyle = computed(() => {
  const M = morph.value
  if (M && M.phase === 'from')
    return {
      transform: `translate(${M.ox + M.dx}px, ${ORIGIN_Y + M.dy}px)`,
      width: M.contentW + 'px',
      height: M.contentH + 'px'
    }
  return {
    transform: `translate(${originX.value}px, ${ORIGIN_Y}px)`,
    width: layout.value.contentW + 'px',
    height: layout.value.contentH + 'px'
  }
})

// Column headers (group numbers) — culled horizontally, morph with the tiles.
const headers = computed(() => {
  const L = layout.value
  if (!viewW.value) return [] // not measured yet — avoid a slide from x=0
  const ox = originX.value
  const [c0, c1] = visibleRange(scrollLeft.value, viewW.value, ox, COL_PITCH, L.columns.length, 1)
  const out = []
  for (let c = c0; c <= c1; c++) {
    const col = L.columns[c]
    out.push({
      key: grouping.value + '|' + col.key,
      label: colLabel(col),
      unknown: col.unknown,
      color: col.color,
      count: col.ids.length,
      style: { transform: `translateX(${ox + col.x}px)`, '--hd': (c - c0) * 0.05 + 's' }
    })
  }
  return out
})
// Period numbers down the left rail — culled vertically.
const periods = computed(() => {
  const [r0, r1] = visibleRange(
    scrollTop.value,
    viewH.value,
    ORIGIN_Y,
    ROW_PITCH,
    layout.value.maxRows,
    1
  )
  const out = []
  for (let r = r0; r <= r1; r++)
    out.push({
      n: r + 1,
      style: { transform: `translateY(${ORIGIN_Y - COLBAR_H + r * ROW_PITCH + TILE_H / 2 - 8}px)` }
    })
  return out
})

// ── Hover → detail card ─────────────────────────────────────────────────────
const hoverId = ref(null)
let leaveTimer = 0
function onTileEnter(id) {
  clearTimeout(leaveTimer)
  hoverId.value = id
}
function onTileLeave() {
  clearTimeout(leaveTimer)
  // Brief grace period so gliding across the gaps doesn't flash the card.
  leaveTimer = setTimeout(() => (hoverId.value = null), 160)
}

function fmtDate(dv) {
  if (!dv || dv.year == null) return ''
  const M = t('directory.elements.monthsShort')
  const m = dv.month
  const mon = Array.isArray(M) ? M[m - 1] : m
  if (dv.precision === 'day' && m && dv.day)
    return t('directory.elements.dateDay', { d: dv.day, m: mon, y: dv.year })
  if (dv.precision === 'month' && m)
    return t('directory.elements.dateMonth', { m: mon, y: dv.year })
  return String(dv.year)
}

const featured = computed(() => {
  const byId = personById.value
  const p =
    (hoverId.value && byId.get(hoverId.value)) ||
    (store.selectedPersonId && byId.get(store.selectedPersonId)) ||
    props.persons[0]
  if (!p) return null
  const dead = isDeceased(p, props.refYear)
  const age = ageOf(p, props.refYear)
  const cat = catByPerson.value.get(p.id)
  const stats = props.statsOf(p.id) || {}
  const g = keyOf(p)
  const cell = layout.value.cells.get(p.id)
  return {
    p,
    dead,
    no: (indexOf.value.get(p.id) ?? 0) + 1,
    sym: symOf(p),
    mass: massOf(p, dead),
    color: colorOfCat(cat),
    catLabel: catMeta.value.get(cat)?.label || '',
    sub: [p.occupation, p.location].filter(Boolean).join(' · '),
    born: fmtDate(p.birth) || '—',
    died: dead
      ? fmtDate(p.death) || '—'
      : p.death?.year
        ? fmtDate(p.death)
        : t('directory.elements.cats.living'),
    age: age == null ? '—' : dead ? t('directory.elements.ageAtDeath', { age }) : String(age),
    kin: stats.kin ?? 0,
    children: stats.children ?? 0,
    group:
      colLabel(g) + (cell ? ' · ' + t('directory.elements.periodShort', { n: cell.row + 1 }) : ''),
    tags: (store.tagsOf.get(p.id) || []).slice(0, 5)
  }
})

function select(id) {
  store.selectPerson(id)
}

onBeforeUnmount(() => {
  ro?.disconnect()
  if (raf) cancelAnimationFrame(raf)
  cancelAnimationFrame(morphRaf1)
  cancelAnimationFrame(morphRaf2)
  clearTimeout(morphTimer)
  clearTimeout(colorTimer)
  clearTimeout(enterTimer)
  clearTimeout(leaveTimer)
})
</script>

<style scoped>
/* Registered so tile tints interpolate when the colouring changes. */
@property --el-cc {
  syntax: '<color>';
  inherits: true;
  initial-value: #808080;
}

.elx {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  container-type: inline-size;
}
/* Narrow panes: a compact hero card so the table keeps most of the height */
@container (max-width: 720px) {
  .elx-head {
    padding: 10px 12px 8px;
    gap: 10px;
  }
  .elx-portrait {
    display: none;
  }
  .elx-big {
    width: 88px;
    height: 100px;
  }
  .elx-big-sym {
    font-size: 36px;
    margin-bottom: 4px;
  }
  .elx-hint {
    display: none;
  }
}

/* ── Header ── */
.elx-head {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 14px 22px;
  align-items: stretch;
  padding: 14px 18px 12px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--surface) 55%, transparent),
    transparent
  );
}

.elx-detail {
  flex: 0 1 560px;
  min-width: 0;
  display: flex;
  gap: 14px;
  align-items: center;
  animation: elx-swap 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes elx-swap {
  from {
    opacity: 0.35;
    transform: translateY(3px);
  }
}

/* The big element card (ptable's hero tile) */
.elx-big {
  position: relative;
  flex: 0 0 auto;
  width: 118px;
  height: 132px;
  border-radius: 12px;
  border: 1.5px solid color-mix(in srgb, var(--el-cc) 70%, transparent);
  background:
    radial-gradient(
      120% 80% at 20% 0%,
      color-mix(in srgb, var(--el-cc) 40%, transparent),
      transparent 70%
    ),
    linear-gradient(160deg, color-mix(in srgb, var(--el-cc) 30%, var(--surface)), var(--surface));
  box-shadow:
    0 10px 30px -12px color-mix(in srgb, var(--el-cc) 60%, transparent),
    inset 0 1px 0 color-mix(in srgb, #fff 12%, transparent);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: 0 8px 10px;
  overflow: hidden;
}
.elx-big-num {
  position: absolute;
  top: 7px;
  left: 9px;
  font-size: 13px;
  font-weight: 700;
  color: var(--t2);
  font-variant-numeric: tabular-nums;
}
.elx-big-moon {
  position: absolute;
  top: 8px;
  right: 9px;
  color: var(--t2);
}
.elx-big-sym {
  font-size: 50px;
  line-height: 1;
  font-weight: 800;
  letter-spacing: -1.5px;
  color: color-mix(in srgb, var(--el-cc) 40%, var(--t1));
  text-shadow: 0 0 24px color-mix(in srgb, var(--el-cc) 45%, transparent);
  margin-bottom: 8px;
}
.elx-big-sym[data-len='3'] {
  font-size: 40px;
}
.elx-big-sym[data-len='4'] {
  font-size: 31px;
}
.elx-big-sym[data-len='5'] {
  font-size: 25px;
}
.elx-big-name {
  max-width: 100%;
  font-size: 12px;
  font-weight: 700;
  color: var(--t1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.elx-big-mass {
  font-size: 11px;
  font-weight: 600;
  color: var(--t2);
  font-variant-numeric: tabular-nums;
}
.elx-detail.dead .elx-big-sym {
  opacity: 0.7;
}

.elx-portrait {
  flex: 0 0 auto;
  width: 104px;
  height: 104px;
  border-radius: 14px;
  overflow: hidden;
  position: relative;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--el-cc) 16%, var(--elevated));
}
.elx-portrait :deep(.elx-portrait-img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.elx-detail.dead .elx-portrait :deep(.elx-portrait-img) {
  filter: grayscale(0.55) sepia(0.12);
}
.elx-portrait :deep(.elx-portrait-mono) {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 800;
  color: color-mix(in srgb, var(--el-cc) 60%, var(--t1));
  background: radial-gradient(
    90% 80% at 50% 20%,
    color-mix(in srgb, var(--el-cc) 30%, transparent),
    transparent 75%
  );
}

.elx-facts {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.elx-facts-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.3px;
  color: var(--t1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.elx-facts-cat {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--el-cc) 55%, var(--t1));
}
.elx-facts-sub {
  font-size: 12.5px;
  color: var(--t2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.elx-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px 12px;
  margin-top: 2px;
}
.elx-stats div {
  min-width: 0;
}
.elx-stats dt {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--t3);
}
.elx-stats dd {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--t1);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.elx-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
  max-height: 22px;
  overflow: hidden;
}
.elx-tag {
  align-items: center;
  display: inline-flex;
  gap: 3px;
  padding: 1px 8px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--tc) 45%, transparent);
  background: color-mix(in srgb, var(--tc) 14%, transparent);
  color: var(--t1);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

/* Controls + legend */
.elx-side {
  flex: 1 1 340px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
}
.elx-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
}
.elx-seg {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--elevated);
}
.elx-seg-label {
  padding: 0 7px 0 6px;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--t3);
}
.elx-seg-btn {
  border: none;
  border-radius: 7px;
  padding: 4px 10px;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.18s,
    color 0.18s,
    box-shadow 0.18s;
}
.elx-seg-btn:hover {
  color: var(--t1);
  background: var(--hover);
}
.elx-seg-btn.on {
  background: var(--adim);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent);
}

.elx-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  max-height: 58px;
  overflow-y: auto;
  scrollbar-width: thin;
}
.elx-leg {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px 3px 4px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--el-cc) 40%, var(--border));
  background: color-mix(in srgb, var(--el-cc) 10%, transparent);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    opacity 0.22s,
    transform 0.22s cubic-bezier(0.34, 1.4, 0.5, 1),
    background 0.22s,
    border-color 0.22s,
    --el-cc 0.5s;
}
.elx-leg:hover,
.elx-leg.on {
  background: color-mix(in srgb, var(--el-cc) 24%, transparent);
  border-color: var(--el-cc);
  transform: translateY(-1px);
}
.elx-leg.off {
  opacity: 0.5;
}
.elx-leg-sw {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  background: linear-gradient(150deg, color-mix(in srgb, var(--el-cc) 80%, #fff), var(--el-cc));
  box-shadow: 0 0 8px -1px color-mix(in srgb, var(--el-cc) 60%, transparent);
}
.elx-leg-label {
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.elx-leg-n {
  font-size: 11px;
  font-weight: 700;
  color: var(--t2);
  font-variant-numeric: tabular-nums;
}
.elx-hint {
  font-size: 11.5px;
  color: var(--t3);
}

/* ── Table scroller ── */
.elx-scroll {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow: auto;
}
.elx-sizer {
  position: relative;
}

.elx-colbar {
  position: sticky;
  top: 0;
  z-index: 4;
  height: 34px;
  width: 100%;
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
}
.elx-corner {
  position: sticky;
  left: 0;
  z-index: 2;
  width: 28px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  color: var(--t3);
  background: var(--bg);
  border-right: 1px solid var(--border);
}
.elx-col {
  position: absolute;
  top: 0;
  left: 0;
  width: 74px;
  height: 34px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  line-height: 1.15;
  transition: transform 0.7s cubic-bezier(0.6, 0, 0.2, 1);
  animation: elx-col-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) var(--hd, 0s) backwards;
}
@keyframes elx-col-in {
  from {
    opacity: 0;
    translate: 0 -8px;
  }
}
.elx-col-label {
  max-width: 100%;
  font-size: 12px;
  font-weight: 800;
  color: var(--t1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.elx-col.unknown .elx-col-label {
  color: var(--t3);
}
.elx-col-n {
  font-size: 10px;
  font-weight: 700;
  color: var(--t3);
  font-variant-numeric: tabular-nums;
}
.elx-col-dot {
  position: absolute;
  top: 5px;
  left: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.elx-ghost {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  background: color-mix(in srgb, var(--t3) 38%, transparent);
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='82' height='92'%3E%3Crect x='0.5' y='0.5' width='73' height='83' rx='8' fill='black' fill-opacity='0.12' stroke='black' stroke-dasharray='3 3'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='82' height='92'%3E%3Crect x='0.5' y='0.5' width='73' height='83' rx='8' fill='black' fill-opacity='0.12' stroke='black' stroke-dasharray='3 3'/%3E%3C/svg%3E");
  -webkit-mask-size: 82px 92px;
  mask-size: 82px 92px;
  animation: elx-ghost-in 0.8s ease 0.2s backwards;
  transition:
    transform 0.75s cubic-bezier(0.6, 0, 0.2, 1),
    width 0.75s cubic-bezier(0.6, 0, 0.2, 1),
    height 0.75s cubic-bezier(0.6, 0, 0.2, 1);
}
@keyframes elx-ghost-in {
  from {
    opacity: 0;
  }
}

.elx-rail {
  position: sticky;
  left: 0;
  z-index: 3;
  width: 28px;
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  backdrop-filter: blur(8px);
  border-right: 1px solid var(--border);
}
.elx-period {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--t3);
  font-variant-numeric: tabular-nums;
}

/* The morph's "from" frame re-bases tiles onto the re-anchored scroll —
   that jump must be instant; only the following flight animates. */
.elx-sizer.snap .el,
.elx-sizer.snap .elx-ghost,
.elx-sizer.snap .elx-col {
  transition: none;
}

/* ── One element tile ── */
.el {
  position: absolute;
  top: 0;
  left: 0;
  width: 74px;
  height: 84px;
  cursor: pointer;
  transition:
    transform 0.75s cubic-bezier(0.6, 0, 0.2, 1) var(--md, 0s),
    --el-cc 0.55s ease var(--cd, 0s);
}
.el:hover {
  z-index: 2;
}
.el-in {
  position: absolute;
  inset: 0;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--el-cc) 58%, transparent);
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--el-cc) 34%, var(--surface)),
    color-mix(in srgb, var(--el-cc) 12%, var(--surface))
  );
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: 0 4px 6px;
  overflow: hidden;
  transition:
    transform 0.26s cubic-bezier(0.34, 1.4, 0.5, 1),
    box-shadow 0.26s,
    opacity 0.28s,
    filter 0.28s;
}
.el:hover .el-in {
  transform: scale(1.22);
  box-shadow:
    0 0 0 1px var(--el-cc),
    0 14px 30px -8px rgba(0, 0, 0, 0.5),
    0 0 26px -2px color-mix(in srgb, var(--el-cc) 60%, transparent);
}
.el-num {
  position: absolute;
  top: 3px;
  left: 5px;
  font-size: 10px;
  font-weight: 700;
  color: var(--t2);
  font-variant-numeric: tabular-nums;
}
.el-moon {
  position: absolute;
  top: 3px;
  right: 4px;
  color: var(--t2);
}
.el-sym {
  font-size: 25px;
  line-height: 1;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: color-mix(in srgb, var(--el-cc) 38%, var(--t1));
  margin-bottom: 5px;
  white-space: nowrap;
}
.el-sym[data-len='3'] {
  font-size: 20px;
}
.el-sym[data-len='4'] {
  font-size: 16px;
}
.el-sym[data-len='5'] {
  font-size: 13px;
}
.el-name {
  max-width: 100%;
  font-size: 9.5px;
  font-weight: 700;
  color: var(--t1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.el-mass {
  font-size: 9px;
  font-weight: 600;
  color: var(--t2);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* Deceased: a "decayed" element — faded tint, hatched like a half-life */
.el.dead .el-in {
  border-style: dashed;
  background:
    repeating-linear-gradient(
      -45deg,
      color-mix(in srgb, var(--t3) 16%, transparent) 0 2px,
      transparent 2px 7px
    ),
    linear-gradient(
      160deg,
      color-mix(in srgb, var(--el-cc) 18%, var(--surface)),
      color-mix(in srgb, var(--el-cc) 6%, var(--surface))
    );
}
.el.dead .el-sym {
  opacity: 0.62;
}

.el.selected .el-in {
  box-shadow:
    0 0 0 2px var(--accent),
    0 0 18px -2px color-mix(in srgb, var(--accent) 70%, transparent);
  animation: el-sel 2.2s ease-in-out infinite;
}
@keyframes el-sel {
  50% {
    box-shadow:
      0 0 0 2px var(--accent),
      0 0 28px 0 color-mix(in srgb, var(--accent) 85%, transparent);
  }
}

/* Legend focus */
.el.dim .el-in {
  opacity: 0.14;
  filter: saturate(0);
}
.el.lit .el-in {
  box-shadow:
    0 0 0 1.5px var(--el-cc),
    0 0 20px -4px color-mix(in srgb, var(--el-cc) 80%, transparent);
}

/* Entrance: tiles cascade in column by column */
.el.enter .el-in {
  animation: el-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) var(--ed, 0s) backwards;
}
@keyframes el-in {
  from {
    opacity: 0;
    transform: translateY(-22px) scale(0.6);
  }
}
/* Tiles that joined the roster during a morph */
.el.pop .el-in {
  animation: el-pop 0.5s cubic-bezier(0.34, 1.4, 0.5, 1) 0.25s backwards;
}
@keyframes el-pop {
  from {
    opacity: 0;
    transform: scale(0.3);
  }
}

/* ── Empty state ── */
.elx-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--t2);
  pointer-events: none;
}
.elx-empty-icon {
  display: flex;
  color: var(--t3);
}
.elx-empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--t1);
}
.elx-empty-text {
  font-size: 13px;
  max-width: 280px;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .el,
  .el-in,
  .elx-col,
  .elx-leg,
  .elx-ghost {
    transition: none;
  }
  .el.enter .el-in,
  .el.pop .el-in,
  .el.selected .el-in,
  .elx-col,
  .elx-ghost,
  .elx-detail {
    animation: none;
  }
}
</style>
