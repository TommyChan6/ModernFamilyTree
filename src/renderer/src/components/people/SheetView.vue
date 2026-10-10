<template>
  <div ref="rootEl" class="sheet" :class="{ entering, 'scrolled-x': scrollLeft > 0 }">
    <!-- Keyboard sink: a visually hidden textarea that holds focus while the
         grid is "selected" (not editing). It has to be a real text field so
         clipboard and IME events arrive; data-grid-keys tells App.vue it's a
         grid, not a text box, so undo/redo hotkeys stay live. -->
    <textarea
      ref="sinkEl"
      class="sh-sink"
      data-grid-keys
      aria-label="Spreadsheet"
      autocomplete="off"
      spellcheck="false"
      @keydown="onSinkKey"
      @input="onSinkInput"
      @copy="onCopy"
      @paste="onPaste"
      @compositionstart="composing = true"
      @compositionend="onCompositionEnd"
    ></textarea>

    <!-- ── Formula bar + actions ─────────────────────────────────────── -->
    <div class="sh-bar">
      <div class="sh-ref" :title="refTitle">
        <span class="sh-ref-main">{{ refMain }}</span>
        <span v-if="refSub" class="sh-ref-sub">{{ refSub }}</span>
      </div>
      <label class="sh-fx" :class="{ live: editing, ro: !fxEditable }">
        <span class="sh-fx-icon">ƒx</span>
        <input
          ref="fxEl"
          class="sh-fx-input"
          :value="fxValue"
          :readonly="!fxEditable"
          :placeholder="fxPlaceholder"
          spellcheck="false"
          @focus="onFxFocus"
          @input="onFxInput"
          @keydown="onFxKey"
        />
      </label>
      <div class="sh-actions">
        <button class="sh-btn primary" title="Add a row (Enter on an empty sheet)" @click="addRow">
          <UiIcon name="plus" :size="14" :stroke="2.4" />{{ store.noun }}
        </button>
        <button
          data-menu-toggle
          class="sh-btn"
          :class="{ open: menu?.kind === 'addcol' }"
          title="Add a trait column"
          @click="toggleMenu('addcol', $event)"
        >
          <UiIcon name="plus" :size="14" :stroke="2.4" />Trait
        </button>
        <button
          class="sh-btn"
          data-menu-toggle
          :class="{ open: menu?.kind === 'cols' }"
          title="Show or hide columns"
          @click="toggleMenu('cols', $event)"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect x="1.5" y="2.5" width="3.6" height="11" rx="1" />
            <rect x="6.2" y="2.5" width="3.6" height="11" rx="1" opacity="0.55" />
            <rect x="10.9" y="2.5" width="3.6" height="11" rx="1" />
          </svg>
          Columns
          <Transition name="sh-badge">
            <span v-if="hiddenCount" class="sh-badge">{{ hiddenCount }} hidden</span>
          </Transition>
        </button>
        <button
          class="sh-btn icon"
          :disabled="!canFill"
          title="Fill down (Ctrl+D)"
          aria-label="Fill down"
          @click="fillDown"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect x="3" y="1.5" width="10" height="4" rx="1" />
            <path d="M8 6.5v6M5 10l3 3 3-3" fill="none" class="sh-stroke" stroke-width="1.6" />
          </svg>
        </button>
        <Transition name="sh-pop-x">
          <button
            v-if="fullRowIds.length"
            class="sh-btn danger"
            :class="{ armed: armed === 'bar-delete' }"
            @click="onBarDelete"
          >
            {{
              armed === 'bar-delete'
                ? 'Click again to delete'
                : `Delete ${fullRowIds.length} ${nounFor(fullRowIds.length)}`
            }}
          </button>
        </Transition>
      </div>
    </div>

    <!-- ── Grid ──────────────────────────────────────────────────────── -->
    <div
      ref="scrollEl"
      class="sh-scroll"
      @scroll.passive="onScroll"
      @pointerdown="onGridPointerDown"
      @dblclick="onGridDblClick"
      @contextmenu="onContextMenu"
    >
      <div class="sh-canvas" :style="{ width: totalW + 'px', height: canvasH + 'px' }">
        <!-- Header -->
        <div class="sh-head" :style="{ width: totalW + 'px', height: HEAD_H + 'px' }">
          <button
            class="sh-corner"
            :class="{ all: allSelected }"
            title="Select all (Ctrl+A)"
            @pointerdown.prevent
            @click="selectAll"
          >
            <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M9 1v8H1z" /></svg>
          </button>
          <div
            v-for="(col, ci) in columns"
            :key="col.key"
            class="sh-hcell"
            :class="{
              frozen: col.frozen,
              'frozen-last': ci === frozenCount - 1,
              'in-sel': colInSel(ci),
              sorted: sortSpec?.key === col.key,
              resizing: resizingKey === col.key,
              fresh: freshCols.has(col.key),
              ro: !col.editable && col.kind !== 'groups'
            }"
            :style="headStyles[ci]"
          >
            <template v-if="renaming === col.key">
              <input
                ref="renameEl"
                v-model="renameDraft"
                class="sh-rename"
                spellcheck="false"
                @keydown.stop="onRenameKey"
              />
            </template>
            <template v-else>
              <button
                class="sh-hlabel"
                :title="headTitle(col)"
                @pointerdown.prevent
                @click="onHeaderClick(col)"
              >
                <span class="sh-htype"><UiIcon :name="glyphOf(col)" :size="12" /></span>
                <UiIcon v-if="col.icon" class="sh-hicon" :name="col.icon" :size="14" />
                <span class="sh-htext">{{ col.label }}</span>
                <span
                  class="sh-sort"
                  :class="{ on: sortSpec?.key === col.key, desc: sortSpec?.dir === -1 }"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 10 10"><path d="M5 2l3.5 5h-7z" /></svg>
                </span>
              </button>
              <button
                class="sh-hmenu"
                data-menu-toggle
                title="Column options"
                aria-label="Column options"
                @pointerdown.prevent
                @click.stop="openHeadMenu(col, $event)"
              >
                <UiIcon name="ellipsis" :size="14" />
              </button>
            </template>
            <span
              class="sh-resize"
              title="Drag to resize · double-click to fit"
              @pointerdown.stop.prevent="startResize(col, $event)"
              @dblclick.stop="autoFit(col)"
            ></span>
          </div>
          <button
            class="sh-hadd"
            data-menu-toggle
            title="Add a trait column"
            aria-label="Add a trait column"
            @pointerdown.prevent
            @click="toggleMenu('addcol', $event)"
          >
            <UiIcon name="plus" :size="16" />
          </button>
        </div>

        <!-- Body -->
        <div class="sh-body" :class="{ gliding }" :style="{ height: rows.length * ROW_H + 'px' }">
          <!-- Overlays for the scrolling columns. Clipped so they never draw
               over the frozen pane (rows are separate stacking contexts, so
               z-order alone can't tuck them underneath it). -->
          <div class="sh-ovl" :style="{ clipPath: `inset(0 0 0 ${scrollLeft + frozenW}px)` }">
            <div
              v-if="selRects.scroll"
              class="sh-selrect"
              :class="{ 'open-l': selRects.scroll.open }"
              :style="rectStyle(selRects.scroll)"
            ></div>
            <div
              v-if="copyRects.scroll"
              class="sh-marquee"
              :style="rectStyle(copyRects.scroll)"
            ></div>
            <div v-if="ring && !ring.frozen" class="sh-ring" :style="rectStyle(ring)"></div>
          </div>

          <div
            v-for="row in visibleRows"
            :key="row.p.id"
            class="sh-row"
            :class="{
              odd: row.i % 2 === 1,
              'in-sel': rowInSel(row.i),
              editing: editing?.id === row.p.id,
              fresh: freshRows.has(row.p.id),
              pinned: pinned.has(row.p.id)
            }"
            :style="{ transform: `translateY(${row.i * ROW_H}px)`, '--i': row.i - winStart }"
          >
            <div class="sh-gutter" :data-r="row.i" data-g="1">
              <span class="sh-rownum">{{ row.i + 1 }}</span>
              <SheetAvatar :person="row.p" />
              <button
                class="sh-open"
                title="Open profile"
                aria-label="Open profile"
                @pointerdown.stop
                @click.stop="openProfile(row.p.id)"
              >
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M4.5 2.5h5v5M9.5 2.5L3 9" fill="none" class="sh-stroke" />
                </svg>
              </button>
            </div>
            <div
              v-for="(cv, ci) in row.cells"
              :key="columns[ci].key"
              class="sh-cell"
              :class="[
                cellClasses[ci],
                {
                  pend: cv.pend,
                  'fl-ok': flashOf(row.p.id, ci) === 'ok',
                  'fl-err': flashOf(row.p.id, ci) === 'err',
                  'is-editing': isEditingCell(row.p.id, ci)
                }
              ]"
              :style="cellStyles[ci]"
              :data-r="row.i"
              :data-c="ci"
            >
              <template v-if="isEditingCell(row.p.id, ci) && editing.where === 'cell'">
                <textarea
                  v-if="columns[ci].def?.config?.multiline"
                  :ref="setEditorEl"
                  v-model="editing.draft"
                  class="sh-editor multi"
                  :class="{ bad: !!editing.error, shake: shakeTick }"
                  spellcheck="false"
                  @keydown="onEditorKey"
                ></textarea>
                <input
                  v-else
                  :ref="setEditorEl"
                  v-model="editing.draft"
                  class="sh-editor"
                  :class="['a-' + columns[ci].align, { bad: !!editing.error, shake: shakeTick }]"
                  spellcheck="false"
                  @keydown="onEditorKey"
                />
                <Transition name="sh-err">
                  <div v-if="editing.error" class="sh-err">{{ editing.error }}</div>
                </Transition>
              </template>
              <span v-else-if="isEditingCell(row.p.id, ci)" class="sh-txt">{{
                editing.draft
              }}</span>
              <span v-else-if="cv.t === 'text'" class="sh-txt">{{ cv.text }}</span>
              <span v-else-if="cv.t === 'ph'" class="sh-ph">{{ cv.text }}</span>
              <template v-else-if="cv.t === 'num'">
                <span class="sh-num" :class="{ dim: cv.dim }">{{ cv.text }}</span>
                <span v-if="cv.unit" class="sh-unit">{{ cv.unit }}</span>
              </template>
              <span
                v-else-if="cv.t === 'bool'"
                class="sh-check"
                :class="{ on: cv.on }"
                role="checkbox"
                :aria-checked="cv.on"
              >
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M2.6 6.4l2.3 2.3 4.6-5" />
                </svg>
              </span>
              <span
                v-else-if="cv.t === 'pill'"
                class="sh-pill"
                :style="{ '--pc': cv.color || 'var(--accent)' }"
                >{{ cv.text }}</span
              >
              <template v-else-if="cv.t === 'bar'">
                <span class="sh-meter">
                  <span class="sh-meter-fill" :style="{ transform: `scaleX(${cv.frac})` }"></span>
                </span>
                <span class="sh-num">{{ cv.text }}</span>
              </template>
              <span v-else-if="cv.t === 'chips'" class="sh-chips">
                <span
                  v-for="chip in cv.chips"
                  :key="chip.id"
                  class="sh-chip"
                  :style="{ '--cc': chip.color }"
                >
                  <UiIcon v-if="chip.icon" :name="chip.icon" :size="12" />
                  {{ chip.label }}
                </span>
                <span v-if="cv.more" class="sh-chip more">+{{ cv.more }}</span>
              </span>
            </div>
          </div>

          <!-- Overlays for the frozen pane: a zero-size sticky anchor rides the
               viewport's left edge, so rects placed inside it line up with the
               sticky cells whatever the horizontal scroll. -->
          <div class="sh-ovl-frozen">
            <div class="sh-ovl-anchor">
              <div
                v-if="selRects.frozen"
                class="sh-selrect"
                :class="{ 'open-r': selRects.frozen.open }"
                :style="rectStyle(selRects.frozen)"
              ></div>
              <div
                v-if="copyRects.frozen"
                class="sh-marquee"
                :style="rectStyle(copyRects.frozen)"
              ></div>
              <div v-if="ring && ring.frozen" class="sh-ring" :style="rectStyle(ring)"></div>
            </div>
          </div>
        </div>

        <!-- Add-row strip -->
        <button
          v-if="rows.length"
          class="sh-addrow"
          :style="{
            top: HEAD_H + rows.length * ROW_H + 'px',
            transform: `translateX(${scrollLeft}px)`
          }"
          @pointerdown.prevent
          @click="addRow"
        >
          <UiIcon name="plus" :size="14" :stroke="2.4" />
          Add {{ store.noun.toLowerCase() }}
          <span class="sh-addrow-hint">or paste rows below the last one</span>
        </button>
      </div>

      <!-- Empty states -->
      <Transition name="sh-fade">
        <div v-if="!rows.length" class="sh-empty">
          <div class="sh-empty-icon">
            <UiIcon :name="store.persons.length ? 'search' : 'sheet'" :size="42" :stroke="1.5" />
          </div>
          <div class="sh-empty-title">
            {{ store.persons.length ? 'No matches' : 'An empty sheet' }}
          </div>
          <div class="sh-empty-text">
            {{
              store.persons.length
                ? 'Nobody fits the current search or filters.'
                : 'Add the first row — or paste a list of names from any spreadsheet.'
            }}
          </div>
          <button class="sh-btn primary sh-empty-btn" @click="addRow">
            <UiIcon name="plus" :size="14" :stroke="2.4" />Add {{ store.noun.toLowerCase() }}
          </button>
        </div>
      </Transition>
    </div>

    <!-- ── Status bar ────────────────────────────────────────────────── -->
    <div class="sh-status">
      <span class="sh-st-count">
        {{ rows.length }} {{ nounFor(rows.length) }} · {{ columns.length }} columns
      </span>
      <Transition name="sh-pop-x">
        <button
          v-if="orderStale && !gliding"
          class="sh-resort"
          title="Values changed since the rows were ordered"
          @click="reorder"
        >
          <UiIcon class="sh-resort-icon" name="refresh-cw" :size="12" :stroke="2.4" />
          Re-sort
        </button>
      </Transition>
      <Transition name="sh-fade" mode="out-in">
        <span v-if="notice" :key="notice.key" class="sh-notice" :class="notice.tone">{{
          notice.text
        }}</span>
        <span v-else class="sh-hint">
          Enter edit · Tab next · Ctrl+C / Ctrl+V · Del clear · Ctrl+D fill down · right-click for
          more
        </span>
      </Transition>
      <span class="sh-st-right">
        <Transition name="sh-fade" mode="out-in">
          <span v-if="summaryText" :key="summaryText" class="sh-summary">{{ summaryText }}</span>
        </Transition>
        <span class="sh-save" :class="saveState">
          <span class="sh-save-dot"></span>
          {{
            saveState === 'saving'
              ? 'Saving…'
              : saveState === 'error'
                ? 'Not saved'
                : 'All changes saved'
          }}
        </span>
      </span>
    </div>

    <!-- ── Floating: option picker ───────────────────────────────────── -->
    <SheetPicker
      v-if="picker"
      ref="pickerRef"
      :key="picker.id + picker.key"
      :options="pickerOptions"
      :selected="pickerSelected"
      :multi="picker.multi"
      :anchor="picker.rect"
      :initial-query="picker.query"
      @pick="onPickerPick"
      @create="onPickerCreate"
      @clear="onPickerClear"
      @close="onPickerClose"
    />

    <!-- ── Floating: menus (context, column, add trait, columns) ──────── -->
    <Teleport to="body">
      <Transition name="sh-menu">
        <div
          v-if="menu"
          ref="menuEl"
          :key="menu.kind + (menu.col?.key || '')"
          class="sh-menu"
          :class="'k-' + menu.kind"
          :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
          @pointerdown.stop
        >
          <!-- Add a trait column -->
          <template v-if="menu.kind === 'addcol'">
            <div class="sh-menu-title">New trait column</div>
            <input
              ref="addColInput"
              v-model="newCol.label"
              class="sh-menu-input"
              placeholder="Trait name, e.g. Nickname"
              spellcheck="false"
              @keydown.stop="onAddColKey"
            />
            <div class="sh-types">
              <button
                v-for="(t, i) in TYPE_CHOICES"
                :key="t.id"
                class="sh-type"
                :class="{ on: newCol.type === t.id }"
                :style="{ '--i': i }"
                @click="newCol.type = t.id"
              >
                <UiIcon class="sh-type-glyph" :name="TYPE_GLYPH[t.id]" :size="14" />
                {{ t.label }}
              </button>
            </div>
            <button
              class="sh-btn primary sh-menu-go"
              :disabled="!newCol.label.trim()"
              @click="addColumn"
            >
              Add column
            </button>
          </template>

          <!-- Column visibility -->
          <template v-else-if="menu.kind === 'cols'">
            <div class="sh-menu-title">Columns</div>
            <div class="sh-colslist">
              <button
                v-for="(col, i) in allColumns"
                :key="col.key"
                class="sh-colrow"
                :class="{ off: hiddenSet.has(col.key) }"
                :style="{ '--i': Math.min(i, 14) }"
                @click="toggleHidden(col.key)"
              >
                <span class="sh-toggle"><span class="sh-toggle-knob"></span></span>
                <UiIcon v-if="col.icon" class="sh-hicon" :name="col.icon" :size="14" />
                <span class="sh-colrow-label">{{ col.label }}</span>
                <UiIcon class="sh-colrow-type" :name="glyphOf(col)" :size="12" />
              </button>
            </div>
            <button v-if="hiddenCount" class="sh-menu-link" @click="showAllColumns">
              Show all columns
            </button>
          </template>

          <!-- Item lists (context menu, column menu) -->
          <template v-else>
            <template v-for="(it, i) in menuItems" :key="it.id || 'sep' + i">
              <div v-if="it.sep" class="sh-menu-sep"></div>
              <button
                v-else
                class="sh-menu-item"
                :class="{ danger: it.danger, armed: armed === it.id }"
                :disabled="it.disabled"
                :style="{ '--i': i }"
                @click="runItem(it)"
              >
                <UiIcon class="sh-menu-icon" :name="it.icon" :size="14" />
                <span class="sh-menu-label">{{
                  armed === it.id ? it.armedLabel || 'Click again to confirm' : it.label
                }}</span>
                <span v-if="it.hint" class="sh-menu-hint">{{ it.hint }}</span>
              </button>
            </template>
          </template>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import {
  ref,
  shallowRef,
  reactive,
  computed,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
  h
} from 'vue'
import { useMainStore } from '../../store/index.js'
import { useThumbnail } from './useThumbnail.js'
import { ageOf } from './peopleLayout.js'
import SheetPicker from './SheetPicker.vue'
import UiIcon from '../ui/UiIcon.js'
import {
  ROW_H,
  HEAD_H,
  GUTTER_W,
  TYPE_GLYPH,
  buildColumns,
  columnOffsets,
  clampWidth,
  parseCellText,
  toCellText,
  sortKeyOf,
  sortByKey,
  rangeOf,
  inRange,
  clampPos,
  tabStep,
  toTSV,
  parseTSV,
  planPaste,
  isHeaderRow,
  summarize,
  numericOf
} from './sheetModel'

// The Directory's spreadsheet medium: every trait is a column, every person a
// row. Built for fast bulk entry — type to edit, Tab / Enter to move on,
// paste blocks straight from Excel or Sheets (overflowing rows become new
// people), fill down, clear ranges, sort by any column.
//
// Data safety: every write goes through ONE serial queue, so responses can
// never land out of order and each store update already reflects every
// earlier write. Cells show their pending value optimistically (keyed by a
// token, so a slow early write can't clobber a newer edit's overlay) and
// snap back with a red flash if the save fails. Multi-cell operations use the
// batch channels, so a paste is one atomic write and one undo step.

const props = defineProps({
  persons: { type: Array, required: true }, // filtered + ordered by the toolbar
  statsOf: { type: Function, required: true },
  refYear: { type: Number, required: true }
})

const store = useMainStore()

const TYPE_CHOICES = [
  { id: 'text', label: 'Text' },
  { id: 'number', label: 'Number' },
  { id: 'date', label: 'Date' },
  { id: 'select', label: 'Choice' },
  { id: 'boolean', label: 'Yes / no' },
  { id: 'slider', label: 'Slider' },
  { id: 'number_range', label: 'Num range' },
  { id: 'date_range', label: 'Date range' }
]

const nounFor = (n) => {
  const noun = store.noun || 'Person'
  if (n === 1) return noun.toLowerCase()
  return noun.toLowerCase() === 'person' ? 'people' : noun.toLowerCase() + 's'
}

// ── Avatar (own component: each visible row owns its thumbnail) ──────────────
const SheetAvatar = {
  props: { person: { type: Object, required: true } },
  setup(p) {
    const { src } = useThumbnail(
      () => p.person.primary_image || '',
      () => 48
    )
    const initials = computed(() => {
      const parts = (p.person.name || '?').trim().split(/\s+/).filter(Boolean)
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      return (parts[0] || '?').substring(0, 2).toUpperCase()
    })
    return () =>
      src.value
        ? h('img', { class: 'sh-ava', src: src.value, alt: '', draggable: false })
        : h('span', { class: 'sh-ava mono' }, initials.value)
  }
}

// ── Elements ─────────────────────────────────────────────────────────────────
const rootEl = ref(null)
const sinkEl = ref(null)
const scrollEl = ref(null)
const fxEl = ref(null)
const menuEl = ref(null)
const pickerRef = ref(null)
const addColInput = ref(null)
const renameEl = ref(null)
let editorEl = null
const setEditorEl = (el) => {
  editorEl = el
}
let disposed = false

// ── Columns ──────────────────────────────────────────────────────────────────
const liveWidths = ref({}) // widths mid-drag (committed to prefs on release)
const resizingKey = ref(null)
const hiddenSet = computed(() => new Set(store.sheetPrefs.hidden))
const hiddenCount = computed(
  () => allColumns.value.filter((c) => hiddenSet.value.has(c.key)).length
)
const allColumns = computed(() =>
  buildColumns(store.fieldDefs, {
    widths: { ...store.sheetPrefs.widths, ...liveWidths.value },
    groups: !!store.caps.tags
  })
)
const columns = computed(() => allColumns.value.filter((c) => !hiddenSet.value.has(c.key)))
const allColByKey = computed(() => new Map(allColumns.value.map((c) => [c.key, c])))
const colIndex = computed(() => new Map(columns.value.map((c, i) => [c.key, i])))
const offsets = computed(() => columnOffsets(columns.value))
const frozenCount = computed(() => columns.value.filter((c) => c.frozen).length)
const frozenW = computed(() => offsets.value.frozenW)
const ADD_COL_W = 44
const totalW = computed(() => offsets.value.total + ADD_COL_W)

// Per-column static bindings, computed once per layout change (not per cell).
const cellStyles = computed(() =>
  columns.value.map((c, i) => ({
    width: c.width + 'px',
    ...(c.frozen ? { left: offsets.value.lefts[i] + 'px' } : null)
  }))
)
const headStyles = cellStyles
const cellClasses = computed(() =>
  columns.value.map((c, i) => [
    'a-' + c.align,
    {
      frozen: c.frozen,
      'frozen-last': i === frozenCount.value - 1,
      ro: !c.editable && c.kind !== 'groups',
      fresh: freshCols.value.has(c.key)
    }
  ])
)

// Header type icon: the trait type's icon; derived columns get their own.
const DERIVED_ICON = { age: 'hourglass', ties: 'link', groups: 'tags' }
const glyphOf = (col) =>
  col.kind === 'field' ? TYPE_GLYPH[col.def.type] || 'type' : DERIVED_ICON[col.kind] || 'lock'
function headTitle(col) {
  if (col.kind === 'age') return `Age in ${props.refYear} (calculated) — click to sort`
  if (col.kind === 'ties') return 'Number of relationships (calculated) — click to sort'
  if (col.kind === 'groups') return 'Group memberships — click to sort'
  const slot = col.def.slot ? ` · ${col.def.slot} slot` : ''
  return `${col.label} (${col.def.type.replace('_', ' ')}${slot}) — click to sort`
}

// ── Values ───────────────────────────────────────────────────────────────────
// Optimistic overlay: cellKey → { value, token } for writes not yet settled.
const pending = reactive(new Map())
const cellKey = (id, key) => id + '|' + key
const personById = computed(() => new Map(store.persons.map((p) => [p.id, p])))

function valueOf(id, col) {
  const k = cellKey(id, col.key)
  if (pending.has(k)) return pending.get(k).value
  return store.fieldValuesOf.get(id)?.get(col.key)?.value ?? null
}

/** Plain-text form of any cell (copy, auto-fit, the formula bar). */
function cellText(p, col) {
  if (col.kind === 'field') return toCellText(col.def, valueOf(p.id, col))
  if (col.kind === 'age') return String(ageOf(p, props.refYear) ?? '')
  if (col.kind === 'ties') return String(props.statsOf(p.id).kin)
  return (store.tagsOf.get(p.id) || []).map((t) => t.label).join(', ')
}

const EMPTY = { t: 'empty' }
/** What a cell draws — one small object per visible cell. */
function cellView(p, col) {
  if (col.kind === 'age') {
    const a = ageOf(p, props.refYear)
    return a == null ? EMPTY : { t: 'num', text: String(a) }
  }
  if (col.kind === 'ties') {
    const k = props.statsOf(p.id).kin
    return { t: 'num', text: String(k), dim: !k }
  }
  if (col.kind === 'groups') {
    const tags = store.tagsOf.get(p.id) || []
    if (!tags.length) return EMPTY
    return {
      t: 'chips',
      chips: tags.slice(0, 3).map((t) => ({
        id: t.id,
        label: t.label,
        icon: t.icon || '',
        color: t.color || 'var(--accent)'
      })),
      more: Math.max(0, tags.length - 3)
    }
  }
  const def = col.def
  const v = valueOf(p.id, col)
  const pend = pending.has(cellKey(p.id, col.key))
  if (def.type === 'boolean') return { t: 'bool', on: v === true, pend }
  if (v == null) {
    return col.frozen && col.editable && def.slot === 'name' && !(p.name || '').trim()
      ? { t: 'ph', text: 'Unnamed', pend }
      : { t: 'empty', pend }
  }
  switch (def.type) {
    case 'select': {
      const o = (def.config.options || []).find((x) => x.id === v)
      return o ? { t: 'pill', text: o.label, color: o.color, pend } : { t: 'empty', pend }
    }
    case 'slider': {
      const min = def.config.min ?? 0
      const max = def.config.max ?? 100
      const frac = max > min ? Math.min(1, Math.max(0, (v - min) / (max - min))) : 0
      return { t: 'bar', text: `${v}${def.unit ? ' ' + def.unit : ''}`, frac, pend }
    }
    case 'number':
    case 'number_range':
      return { t: 'num', text: toCellText(def, v), unit: def.unit, pend }
    default:
      return { t: 'text', text: toCellText(def, v), pend }
  }
}

// ── Row order ────────────────────────────────────────────────────────────────
// The sheet keeps a FROZEN row order: editing a value never makes rows jump
// out from under the cursor. The order is rebuilt when the sort changes, when
// a different set of people is shown (search / filters), or on demand via
// "Re-sort" (offered whenever the frozen order has drifted from the wanted one).
// People added from the sheet stay pinned at the bottom until the next sort.
const sortSpec = computed(() => {
  const s = store.sheetPrefs.sort
  return s && allColByKey.value.has(s.key) ? s : null
})
const pinned = ref(new Set())

function sortKeyFor(p, col) {
  if (col.kind === 'field') return sortKeyOf(col.def, valueOf(p.id, col))
  if (col.kind === 'age') return ageOf(p, props.refYear)
  if (col.kind === 'ties') return props.statsOf(p.id).kin
  const labels = (store.tagsOf.get(p.id) || []).map((t) => t.label).sort()
  return labels.length ? labels.join(', ') : null
}

const wantedIds = computed(() => {
  let list = props.persons
  const s = sortSpec.value
  if (s) {
    const col = allColByKey.value.get(s.key)
    list = sortByKey(list, (p) => sortKeyFor(p, col), s.dir)
  }
  const pins = pinned.value
  const ids = []
  for (const p of list) if (!pins.has(p.id)) ids.push(p.id)
  for (const id of pins) if (personById.value.has(id)) ids.push(id)
  return ids
})

const orderIds = shallowRef([])
const gliding = ref(false)
let glideTimer = 0
const reducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
function glide() {
  if (reducedMotion) return
  gliding.value = true
  clearTimeout(glideTimer)
  glideTimer = setTimeout(() => (gliding.value = false), 460)
}

watch(
  wantedIds,
  (next) => {
    const cur = orderIds.value
    if (!cur.length) {
      orderIds.value = next
      return
    }
    const nextSet = new Set(next)
    const curSet = new Set(cur)
    const added = next.filter((id) => !curSet.has(id))
    const kept = cur.filter((id) => nextSet.has(id))
    if (added.every((id) => pinned.value.has(id))) {
      // Only removals and/or rows added from here: keep the frozen order.
      if (kept.length !== cur.length || added.length) {
        orderIds.value = kept.concat(added)
        glide()
      }
      return
    }
    // A different set of people (search, filters, added elsewhere).
    orderIds.value = next
    glide()
  },
  { immediate: true }
)

const orderStale = computed(() => {
  const a = orderIds.value
  const b = wantedIds.value
  if (a.length !== b.length) return false // mid-update; the watcher reconciles
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return true
  return false
})

function reorder() {
  pinned.value = new Set()
  orderIds.value = wantedIds.value
  glide()
}

function setSort(key, dir) {
  if (editing.value && !commitEdit()) return
  store.setSheetPrefs({ sort: dir ? { key, dir } : null })
  reorder()
}
function onHeaderClick(col) {
  const s = sortSpec.value
  if (s?.key !== col.key) setSort(col.key, 1)
  else if (s.dir === 1) setSort(col.key, -1)
  else setSort(col.key, 0)
  focusSink()
}

const rows = computed(() => {
  const m = personById.value
  const out = []
  for (const id of orderIds.value) {
    const p = m.get(id)
    if (p) out.push(p)
  }
  return out
})
const rowIndex = computed(() => new Map(rows.value.map((p, i) => [p.id, i])))

// ── Virtual window ───────────────────────────────────────────────────────────
const scrollTop = ref(0)
const scrollLeft = ref(0)
const viewH = ref(600)
const viewW = ref(800)
const OVERSCAN = 8
const winStart = computed(() =>
  Math.max(0, Math.floor(Math.max(0, scrollTop.value) / ROW_H) - OVERSCAN)
)
const winEnd = computed(() =>
  Math.min(rows.value.length, Math.ceil((scrollTop.value + viewH.value) / ROW_H) + OVERSCAN)
)
const ADD_ROW_H = 44
const canvasH = computed(() => HEAD_H + rows.value.length * ROW_H + ADD_ROW_H)

const visibleRows = computed(() => {
  const list = rows.value
  const cols = columns.value
  const out = []
  for (let i = winStart.value; i < winEnd.value; i++) {
    const p = list[i]
    if (!p) break
    out.push({ p, i, cells: cols.map((col) => cellView(p, col)) })
  }
  return out
})

let keepFloatingUntil = 0 // scrolls we caused ourselves don't close popovers
function onScroll() {
  const el = scrollEl.value
  scrollTop.value = el.scrollTop
  scrollLeft.value = el.scrollLeft
  if (performance.now() < keepFloatingUntil) return
  if (menu.value?.kind === 'items' || picker.value) closeFloating()
}

let ro = null
function measure() {
  const el = scrollEl.value
  if (!el) return
  viewH.value = el.clientHeight
  viewW.value = el.clientWidth
  scrollTop.value = el.scrollTop
  scrollLeft.value = el.scrollLeft
}

// ── Selection ────────────────────────────────────────────────────────────────
// Anchor (= the active cell) and focus (the far corner of the range), each
// remembered by person id + column key so they follow the data through
// re-sorts; r/c are the fallback when that person or column goes away.
const anchor = ref(null)
const focus = ref(null)

function posOf(a) {
  if (!a || !rows.value.length || !columns.value.length) return null
  const r = rowIndex.value.get(a.id) ?? Math.min(a.r, rows.value.length - 1)
  const c = colIndex.value.get(a.key) ?? Math.min(a.c, columns.value.length - 1)
  return { r, c }
}
const aPos = computed(() => posOf(anchor.value))
const fPos = computed(() => posOf(focus.value) || aPos.value)
const sel = computed(() => (aPos.value ? rangeOf(aPos.value, fPos.value) : null))
const selCells = computed(() =>
  sel.value ? (sel.value.r1 - sel.value.r0 + 1) * (sel.value.c1 - sel.value.c0 + 1) : 0
)
const allSelected = computed(
  () =>
    !!sel.value &&
    sel.value.r0 === 0 &&
    sel.value.c0 === 0 &&
    sel.value.r1 === rows.value.length - 1 &&
    sel.value.c1 === columns.value.length - 1
)

const mk = (r, c) => ({ r, c, id: rows.value[r]?.id, key: columns.value[c]?.key })

function setActive(pos, { extend = false, scroll = true } = {}) {
  const n = rows.value.length
  const m = columns.value.length
  if (!n || !m) return
  const p = clampPos(pos, n, m)
  if (extend && anchor.value) focus.value = mk(p.r, p.c)
  else {
    anchor.value = mk(p.r, p.c)
    focus.value = anchor.value
  }
  if (scroll) scrollIntoView(p)
}
function selectAll() {
  if (editing.value && !commitEdit()) return
  const n = rows.value.length
  const m = columns.value.length
  if (!n || !m) return
  anchor.value = mk(0, 0)
  focus.value = mk(n - 1, m - 1)
  focusSink()
}
function selectRows(r0, r1) {
  const m = columns.value.length
  if (!m) return
  anchor.value = mk(r0, 0)
  focus.value = mk(r1, m - 1)
}

const rowInSel = (r) => !!sel.value && r >= sel.value.r0 && r <= sel.value.r1
const colInSel = (c) => !!sel.value && c >= sel.value.c0 && c <= sel.value.c1

/** Ids of rows selected in full (via the gutter / Shift+Space / select all). */
const fullRowIds = computed(() => {
  const g = sel.value
  if (!g || g.c0 !== 0 || g.c1 !== columns.value.length - 1) return []
  return rows.value.slice(g.r0, g.r1 + 1).map((p) => p.id)
})
/** Ids of every row the selection touches (the context menu's row actions). */
const touchedRowIds = computed(() => {
  const g = sel.value
  return g ? rows.value.slice(g.r0, g.r1 + 1).map((p) => p.id) : []
})

function scrollIntoView(p) {
  const el = scrollEl.value
  if (!el) return
  const top = p.r * ROW_H
  const visH = el.clientHeight - HEAD_H
  if (top < el.scrollTop) el.scrollTop = top
  else if (top + ROW_H > el.scrollTop + visH) el.scrollTop = top + ROW_H - visH
  const col = columns.value[p.c]
  if (!col || col.frozen) return
  const left = offsets.value.lefts[p.c]
  const visL = el.scrollLeft + frozenW.value
  const visR = el.scrollLeft + el.clientWidth
  if (left < visL) el.scrollLeft = left - frozenW.value
  else if (left + col.width > visR) el.scrollLeft = left + col.width - el.clientWidth
}

// Overlay rects (content coordinates; frozen ones relative to the sticky anchor).
function rectsFor(g) {
  if (!g) return { frozen: null, scroll: null }
  const { lefts } = offsets.value
  const cols = columns.value
  const fc = frozenCount.value
  const y = g.r0 * ROW_H
  const hgt = (g.r1 - g.r0 + 1) * ROW_H
  const span = (a, b) => lefts[b] + cols[b].width - lefts[a]
  let frozen = null
  let scroll = null
  if (g.c0 < fc) {
    const c1 = Math.min(g.c1, fc - 1)
    frozen = { x: lefts[g.c0], y, w: span(g.c0, c1), h: hgt, open: g.c1 >= fc }
  }
  if (g.c1 >= fc) {
    const c0 = Math.max(g.c0, fc)
    scroll = { x: lefts[c0], y, w: span(c0, g.c1), h: hgt, open: g.c0 < fc }
  }
  return { frozen, scroll }
}
const selRects = computed(() => (selCells.value > 1 ? rectsFor(sel.value) : rectsFor(null)))
const ring = computed(() => {
  const a = aPos.value
  if (!a || editing.value?.where === 'cell') return null
  const col = columns.value[a.c]
  if (!col) return null
  return { x: offsets.value.lefts[a.c], y: a.r * ROW_H, w: col.width, h: ROW_H, frozen: col.frozen }
})
const rectStyle = (r) => ({
  transform: `translate(${r.x}px, ${r.y}px)`,
  width: r.w + 'px',
  height: r.h + 'px'
})

// Copy marquee (marching ants) — cleared by Escape, an edit, or a paste.
const copied = ref(null) // { ids: [r0Id, r1Id], keys: [c0Key, c1Key] }
const copyRects = computed(() => {
  const cp = copied.value
  if (!cp) return rectsFor(null)
  const a = posOf({ id: cp.ids[0], key: cp.keys[0], r: 0, c: 0 })
  const b = posOf({ id: cp.ids[1], key: cp.keys[1], r: 0, c: 0 })
  return a && b ? rectsFor(rangeOf(a, b)) : rectsFor(null)
})

// ── Selection summary ────────────────────────────────────────────────────────
const summaryText = computed(() => {
  const g = sel.value
  if (!g || selCells.value < 2) return ''
  if (selCells.value > 50000) return `${selCells.value.toLocaleString()} cells`
  const vals = []
  for (let r = g.r0; r <= g.r1; r++) {
    const p = rows.value[r]
    for (let c = g.c0; c <= g.c1; c++) {
      const col = columns.value[c]
      if (col.kind === 'age') vals.push(ageOf(p, props.refYear))
      else if (col.kind === 'ties') vals.push(props.statsOf(p.id).kin)
      else if (col.kind === 'groups') vals.push((store.tagsOf.get(p.id) || []).length ? 'x' : null)
      else {
        const v = valueOf(p.id, col)
        vals.push(numericOf(col.def, v) ?? (v == null || v === false ? null : 'x'))
      }
    }
  }
  const s = summarize(vals)
  const fmt = (n) => (Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2))
  const parts = [`Count ${s.filled}`]
  if (s.numeric) {
    parts.push(`Sum ${fmt(s.sum)}`, `Avg ${fmt(s.avg)}`)
    if (s.numeric > 1) parts.push(`Min ${fmt(s.min)}`, `Max ${fmt(s.max)}`)
  }
  return parts.join(' · ')
})

// ── Status: save state + transient notices ───────────────────────────────────
const saving = ref(0)
const lastError = ref('')
const saveState = computed(() => (saving.value ? 'saving' : lastError.value ? 'error' : 'ok'))
const notice = ref(null)
let noticeKey = 0
let noticeTimer = 0
function notify(text, tone = 'info', ms = 3200) {
  clearTimeout(noticeTimer)
  notice.value = { key: ++noticeKey, text, tone }
  noticeTimer = setTimeout(() => (notice.value = null), ms)
}
function fail(message) {
  lastError.value = message || 'Something went wrong'
  notify(`Couldn't save — ${lastError.value}`, 'err', 5200)
}

// Cell flashes (saved = soft accent pulse, failed = red shake).
const flashes = reactive(new Map()) // cellKey → { kind, token }
let flashToken = 0
const FLASH_CAP = 400
function flash(cells, kind) {
  const token = ++flashToken
  const keys = cells.slice(0, FLASH_CAP).map((c) => cellKey(c.id, c.col.key))
  for (const k of keys) flashes.set(k, { kind, token })
  setTimeout(() => {
    for (const k of keys) if (flashes.get(k)?.token === token) flashes.delete(k)
  }, 900)
}
function flashOf(id, ci) {
  return flashes.get(cellKey(id, columns.value[ci].key))?.kind
}

// Fresh rows / columns get an entrance flourish.
const freshRows = ref(new Set())
const freshCols = ref(new Set())
function markFresh(setRef, ids) {
  setRef.value = new Set([...setRef.value, ...ids])
  setTimeout(() => {
    const next = new Set(setRef.value)
    ids.forEach((id) => next.delete(id))
    setRef.value = next
  }, 1400)
}

// ── Write queue ──────────────────────────────────────────────────────────────
// Strictly one mutation at a time, in issue order. A job queued before a
// project switch is dropped rather than run against the wrong project.
let tail = Promise.resolve()
function enqueue(job, onDrop) {
  const projectId = store.activeProjectId
  saving.value++
  const run = async () => {
    try {
      if (store.activeProjectId !== projectId) {
        onDrop?.()
        return undefined
      }
      return await job()
    } catch (err) {
      fail(err?.message || String(err))
      return undefined
    } finally {
      saving.value--
    }
  }
  const p = tail.then(run)
  tail = p
  return p
}

let writeToken = 0
const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b)

/** Save trait cells: [{ id, col, value }] (value already coerced). Unchanged
 *  cells are skipped; the rest land as ONE batch write. */
function writeCells(cells) {
  const changed = cells.filter(
    (c) =>
      c.col.kind === 'field' &&
      c.col.editable &&
      personById.value.has(c.id) &&
      !same(valueOf(c.id, c.col), c.value)
  )
  if (!changed.length) return Promise.resolve(0)
  const token = ++writeToken
  const byPerson = new Map()
  for (const c of changed) {
    pending.set(cellKey(c.id, c.col.key), { value: c.value, token })
    let u = byPerson.get(c.id)
    if (!u) byPerson.set(c.id, (u = { personId: c.id, values: [], removals: [] }))
    // Clearing an optional (unlocked) trait detaches it; locked traits keep
    // their row (and its display-in-graph flag) with an empty value.
    if (c.value == null && !c.col.def.locked) u.removals.push(c.col.key)
    else u.values.push({ field_id: c.col.key, value: c.value })
  }
  const updates = [...byPerson.values()]
  const settle = (res) => {
    for (const c of changed) {
      const k = cellKey(c.id, c.col.key)
      if (pending.get(k)?.token === token) pending.delete(k)
    }
    if (disposed) return
    if (res.success) {
      lastError.value = ''
      flash(changed, 'ok')
    } else {
      flash(changed, 'err')
      fail(res.error)
    }
  }
  return enqueue(
    async () => {
      let res = { success: false, error: 'Not saved' }
      try {
        res = await store.setFieldValuesBatch(updates)
      } finally {
        settle(res)
      }
      return res.success ? changed.length : 0
    },
    () => settle({ success: false, error: 'The project changed before this edit saved' })
  )
}

/** Create people from [{ values }] rows; they're pinned at the bottom. */
function createRows(payload) {
  return enqueue(async () => {
    // Pin inside onCreated: it runs before the people land in the store, so
    // the row-order watcher already knows they belong at the bottom (pinning
    // after the await would lose that race and trigger a full re-sort).
    const res = await store.createPersons(payload, {
      onCreated: (created) => {
        pinned.value = new Set([...pinned.value, ...created])
      }
    })
    if (!res.success) {
      fail(res.error)
      return []
    }
    lastError.value = ''
    const ids = res.data.persons.map((p) => p.id)
    if (!disposed) markFresh(freshRows, ids)
    return ids
  })
}

// ── Editing ──────────────────────────────────────────────────────────────────
// editing: { id, key, draft, original, mode, where, error }. mode 'enter'
// (started by typing) lets arrow keys commit + move, like Excel; 'edit' (F2,
// Enter, double-click) keeps arrows inside the text. where: 'cell' | 'fx'.
const editing = ref(null)
const shakeTick = ref(false)
const composing = ref(false)

const activeCell = computed(() => {
  const a = aPos.value
  if (!a) return null
  const p = rows.value[a.r]
  const col = columns.value[a.c]
  return p && col ? { p, col } : null
})
const isTextEditable = (col) =>
  col.kind === 'field' && col.editable && !['select', 'boolean'].includes(col.def.type)

function isEditingCell(id, ci) {
  const e = editing.value
  return !!e && e.id === id && e.key === columns.value[ci]?.key
}

function startEdit({ draft = null, mode = 'edit', where = 'cell' } = {}) {
  const ac = activeCell.value
  if (!ac || store.modalOpen || store.formOpen) return
  const { p, col } = ac
  closeMenu()
  if (col.kind === 'groups') return openPicker(p, col, draft ?? '')
  if (!col.editable) {
    notify(`${col.label} is calculated — it can't be typed into`)
    return
  }
  if (col.def.type === 'select') return openPicker(p, col, draft ?? '')
  if (col.def.type === 'boolean' && draft == null) return toggleBooleans()
  const original = cellText(p, col)
  copied.value = null
  focus.value = anchor.value // an edit collapses the range to its active cell
  editing.value = {
    id: p.id,
    key: col.key,
    draft: draft ?? original,
    original,
    mode,
    where,
    error: ''
  }
  nextTick(focusEditor)
}

function focusEditor() {
  const e = editing.value
  if (!e || disposed) return
  const el = e.where === 'fx' ? fxEl.value : editorEl
  if (!el) return
  if (document.activeElement !== el) el.focus({ preventScroll: true })
  const len = el.value.length
  el.setSelectionRange?.(len, len)
}

/** Commit the open edit. Returns false (and keeps the editor open with a
 *  message) when the text doesn't parse for this trait type. */
function commitEdit(move = null) {
  const e = editing.value
  if (!e) return true
  const col = allColByKey.value.get(e.key)
  if (!col || !personById.value.has(e.id)) {
    // The person or trait vanished underneath (undo, deleted elsewhere).
    editing.value = null
    focusSink()
    return true
  }
  if (e.draft !== e.original) {
    const parsed = parseCellText(col.def, e.draft)
    if (!parsed.ok) {
      e.error = parsed.error
      shakeTick.value = false
      requestAnimationFrame(() => (shakeTick.value = true))
      nextTick(focusEditor)
      return false
    }
    writeCells([{ id: e.id, col, value: parsed.value }])
  }
  editing.value = null
  focusSink()
  if (move) moveAfterEdit(move)
  return true
}
function cancelEdit() {
  editing.value = null
  focusSink()
}
function moveAfterEdit(dir) {
  const a = aPos.value
  if (!a) return
  const n = rows.value.length
  const m = columns.value.length
  if (dir === 'next' || dir === 'prev') setActive(tabStep(a, dir === 'prev', n, m))
  else
    setActive({
      r: a.r + (dir === 'down' ? 1 : dir === 'up' ? -1 : 0),
      c: a.c + (dir === 'right' ? 1 : dir === 'left' ? -1 : 0)
    })
}

const ARROW_DIR = { ArrowDown: 'down', ArrowUp: 'up', ArrowLeft: 'left', ArrowRight: 'right' }
function onEditorKey(e) {
  e.stopPropagation()
  const ed = editing.value
  if (!ed || e.isComposing || e.keyCode === 229) return
  const multiline = e.target.tagName === 'TEXTAREA'
  if (e.key === 'Enter') {
    if (multiline && (e.shiftKey || e.altKey)) return // newline
    e.preventDefault()
    commitEdit(e.shiftKey ? 'up' : 'down')
  } else if (e.key === 'Tab') {
    e.preventDefault()
    commitEdit(e.shiftKey ? 'prev' : 'next')
  } else if (e.key === 'Escape') {
    e.preventDefault()
    cancelEdit()
  } else if (ed.mode === 'enter' && ARROW_DIR[e.key] && !e.shiftKey) {
    e.preventDefault()
    commitEdit(ARROW_DIR[e.key])
  } else if (ed.error) {
    ed.error = ''
  }
}

// ── Formula bar ──────────────────────────────────────────────────────────────
const fxEditable = computed(() => !!activeCell.value && isTextEditable(activeCell.value.col))
const fxValue = computed(() => {
  if (editing.value) return editing.value.draft
  const ac = activeCell.value
  return ac ? cellText(ac.p, ac.col) : ''
})
const fxPlaceholder = computed(() => {
  const ac = activeCell.value
  if (!ac) return 'Select a cell'
  if (ac.col.kind === 'groups') return 'Double-click the cell to pick groups'
  if (!ac.col.editable) return 'Calculated'
  if (ac.col.kind === 'field' && ac.col.def.type === 'select') return 'Double-click to pick'
  return 'Empty — type to fill'
})
const refMain = computed(() => {
  if (selCells.value > 1) {
    const g = sel.value
    return `${g.r1 - g.r0 + 1} × ${g.c1 - g.c0 + 1}`
  }
  return activeCell.value?.col.label || '—'
})
const refSub = computed(() => {
  if (selCells.value > 1) return 'cells'
  const ac = activeCell.value
  return ac ? `${ac.p.name?.trim() || 'Unnamed'} · row ${aPos.value.r + 1}` : ''
})
const refTitle = computed(() => [refMain.value, refSub.value].filter(Boolean).join(' — '))

function onFxFocus() {
  if (!fxEditable.value) return
  if (editing.value) editing.value.where = 'fx'
  else startEdit({ mode: 'edit', where: 'fx' })
}
function onFxInput(e) {
  if (editing.value) {
    editing.value.draft = e.target.value
    editing.value.error = ''
  }
}
function onFxKey(e) {
  e.stopPropagation()
  if (!editing.value) {
    if (e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault()
      focusSink()
    }
    return
  }
  if (e.isComposing || e.keyCode === 229) return
  if (e.key === 'Enter') {
    e.preventDefault()
    commitEdit(e.shiftKey ? 'up' : 'down')
  } else if (e.key === 'Tab') {
    e.preventDefault()
    commitEdit(e.shiftKey ? 'prev' : 'next')
  } else if (e.key === 'Escape') {
    e.preventDefault()
    cancelEdit()
  }
}

// ── Keyboard (the sink) ──────────────────────────────────────────────────────
function focusSink() {
  if (disposed) return
  sinkEl.value?.focus({ preventScroll: true })
}
const blocked = () => store.modalOpen || store.formOpen

function onSinkKey(e) {
  if (composing.value || e.isComposing || e.keyCode === 229) return
  if (blocked()) return
  // Keys that raced ahead of the editor taking focus.
  if (editing.value) {
    if (['Enter', 'Tab', 'Escape'].includes(e.key)) onEditorKey(e)
    return
  }
  const mod = e.ctrlKey || e.metaKey
  if (mod && !e.altKey) {
    const k = e.key.toLowerCase()
    if (k === 'a' && !e.shiftKey) {
      e.preventDefault()
      selectAll()
    } else if (k === 'd' && !e.shiftKey) {
      e.preventDefault()
      fillDown()
    }
    // c / v fire native copy / paste on the sink; z / x / s / k belong to the app.
    if (e.key !== ' ' && !ARROW_DIR[e.key] && e.key !== 'Home' && e.key !== 'End') return
  }
  const n = rows.value.length
  const m = columns.value.length
  if (!n || !m) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addRow()
    }
    return
  }
  if (!aPos.value) {
    anchor.value = mk(0, 0)
    focus.value = anchor.value
  }
  const a = aPos.value
  const f = fPos.value || a
  const from = e.shiftKey ? f : a
  const page = Math.max(1, Math.floor((viewH.value - HEAD_H) / ROW_H) - 1)
  let to = null
  switch (e.key) {
    case 'ArrowDown':
      to = { r: mod ? n - 1 : from.r + 1, c: from.c }
      break
    case 'ArrowUp':
      to = { r: mod ? 0 : from.r - 1, c: from.c }
      break
    case 'ArrowRight':
      to = { r: from.r, c: mod ? m - 1 : from.c + 1 }
      break
    case 'ArrowLeft':
      to = { r: from.r, c: mod ? 0 : from.c - 1 }
      break
    case 'PageDown':
      to = { r: from.r + page, c: from.c }
      break
    case 'PageUp':
      to = { r: from.r - page, c: from.c }
      break
    case 'Home':
      to = { r: mod ? 0 : from.r, c: 0 }
      break
    case 'End':
      to = { r: mod ? n - 1 : from.r, c: m - 1 }
      break
    case 'Tab':
      e.preventDefault()
      setActive(tabStep(a, e.shiftKey, n, m))
      return
    case 'Enter':
      e.preventDefault()
      if (e.shiftKey) setActive({ r: a.r - 1, c: a.c })
      else startEdit({ mode: 'edit' })
      return
    case 'F2':
      e.preventDefault()
      startEdit({ mode: 'edit' })
      return
    case 'Delete':
    case 'Backspace':
      e.preventDefault()
      clearSelection()
      return
    case 'Escape':
      if (copied.value || selCells.value > 1 || menu.value) {
        e.preventDefault()
        copied.value = null
        closeMenu()
        focus.value = anchor.value
      }
      return
    case ' ':
      if (e.shiftKey && !mod) {
        e.preventDefault() // Shift+Space: whole rows
        selectRows(sel.value.r0, sel.value.r1)
        return
      }
      if (mod) {
        e.preventDefault() // Ctrl+Space: whole columns
        anchor.value = mk(0, sel.value.c0)
        focus.value = mk(n - 1, sel.value.c1)
        return
      }
      if (activeCell.value?.col.def?.type === 'boolean') {
        e.preventDefault()
        toggleBooleans()
      }
      return // otherwise the space types into the sink and starts an edit
    default:
      return
  }
  e.preventDefault()
  setActive(to, { extend: e.shiftKey })
}

function onSinkInput() {
  if (composing.value) return
  const el = sinkEl.value
  const text = el.value
  el.value = ''
  if (!text || blocked()) return
  if (editing.value) {
    // Typed before the editor took focus — keep every keystroke.
    editing.value.draft += text
    return
  }
  if (picker.value) return
  if (!aPos.value) setActive({ r: 0, c: 0 })
  startEdit({ draft: text.replace(/\r?\n/g, ''), mode: 'enter' })
}
function onCompositionEnd() {
  composing.value = false
  onSinkInput()
}

// ── Pointer ──────────────────────────────────────────────────────────────────
function hitCell(el) {
  const cell = el?.closest?.('[data-r]')
  if (!cell || !scrollEl.value?.contains(cell)) return null
  return {
    r: Number(cell.dataset.r),
    c: cell.dataset.c != null ? Number(cell.dataset.c) : 0,
    gutter: cell.dataset.g === '1'
  }
}

let drag = null
let dragRaf = 0
function onGridPointerDown(e) {
  if (e.button !== 0 && e.button !== 2) return
  const t = e.target
  if (t.closest('.sh-editor, .sh-err, .sh-open')) return
  const hit = hitCell(t)
  if (!hit) return
  if (editing.value && !commitEdit()) return // a bad draft stays open
  closeFloating()
  e.preventDefault() // no text selection; focus stays on the sink
  focusSink()
  if (e.button === 2) {
    if (!sel.value || !inRange(sel.value, hit.r, hit.c) || hit.gutter) {
      if (hit.gutter) selectRows(hit.r, hit.r)
      else setActive(hit, { scroll: false })
    }
    return
  }
  if (hit.gutter) {
    if (e.shiftKey && sel.value) selectRows(aPos.value.r, hit.r)
    else selectRows(hit.r, hit.r)
    beginDrag(e, 'rows')
    return
  }
  if (t.closest('.sh-check') && !e.shiftKey) {
    setActive(hit, { scroll: false })
    toggleBooleans()
    return
  }
  setActive(hit, { extend: e.shiftKey, scroll: false })
  beginDrag(e, 'cells')
}

function beginDrag(e, mode) {
  const el = scrollEl.value
  drag = { mode, id: e.pointerId, x: e.clientX, y: e.clientY }
  try {
    el.setPointerCapture(e.pointerId)
  } catch {
    /* pointer already gone */
  }
  el.addEventListener('pointermove', onDragMove)
  el.addEventListener('pointerup', endDrag)
  el.addEventListener('pointercancel', endDrag)
  dragRaf = requestAnimationFrame(dragTick)
}
function onDragMove(e) {
  if (!drag || e.pointerId !== drag.id) return
  drag.x = e.clientX
  drag.y = e.clientY
}
function dragTick() {
  if (!drag) return
  const el = scrollEl.value
  const b = el.getBoundingClientRect()
  // Edge auto-scroll, faster the further past the edge.
  const EDGE = 28
  let dy = 0
  let dx = 0
  if (drag.y < b.top + HEAD_H + EDGE) dy = -Math.ceil((b.top + HEAD_H + EDGE - drag.y) / 3)
  else if (drag.y > b.bottom - EDGE) dy = Math.ceil((drag.y - (b.bottom - EDGE)) / 3)
  if (drag.mode === 'cells') {
    if (drag.x < b.left + frozenW.value + EDGE && el.scrollLeft > 0)
      dx = -Math.ceil((b.left + frozenW.value + EDGE - drag.x) / 3)
    else if (drag.x > b.right - EDGE) dx = Math.ceil((drag.x - (b.right - EDGE)) / 3)
  }
  if (dy) el.scrollTop += dy
  if (dx) el.scrollLeft += dx
  // Hit-test the clamped pointer so dragging past an edge still extends.
  const x = Math.min(b.right - 4, Math.max(b.left + GUTTER_W + 2, drag.x))
  const y = Math.min(b.bottom - 4, Math.max(b.top + HEAD_H + 2, drag.y))
  const hit = hitCell(document.elementFromPoint(x, y))
  if (hit && (drag.mode === 'rows' || !hit.gutter)) {
    const c = drag.mode === 'rows' ? columns.value.length - 1 : hit.c
    const f = fPos.value
    if (!f || f.r !== hit.r || f.c !== c) focus.value = mk(hit.r, c)
  }
  dragRaf = requestAnimationFrame(dragTick)
}
function endDrag() {
  const el = scrollEl.value
  el?.removeEventListener('pointermove', onDragMove)
  el?.removeEventListener('pointerup', endDrag)
  el?.removeEventListener('pointercancel', endDrag)
  cancelAnimationFrame(dragRaf)
  drag = null
}

function onGridDblClick(e) {
  // Hit-test by coordinates: drag-select captures the pointer on the scroller,
  // which retargets click / dblclick to it rather than the cell.
  const el = document.elementFromPoint(e.clientX, e.clientY) || e.target
  const hit = hitCell(el)
  if (!hit || el.closest('.sh-editor, .sh-check, .sh-open')) return
  if (hit.gutter) {
    openProfile(rows.value[hit.r]?.id)
    return
  }
  setActive(hit, { scroll: false })
  startEdit({ mode: 'edit' })
}

function onContextMenu(e) {
  const hit = hitCell(e.target)
  if (!hit || e.target.closest('.sh-editor')) return
  e.preventDefault()
  openMenu('items', { x: e.clientX, y: e.clientY, items: 'cell' })
}

function openProfile(id) {
  if (!id) return
  if (editing.value && !commitEdit()) return
  store.selectPerson(id)
}

// ── Bulk operations ──────────────────────────────────────────────────────────
function eachSelected(fn) {
  const g = sel.value
  if (!g) return
  for (let r = g.r0; r <= g.r1; r++) {
    const p = rows.value[r]
    for (let c = g.c0; c <= g.c1; c++) fn(p, columns.value[c], r, c)
  }
}

function clearSelection() {
  const cells = []
  let calculated = 0
  eachSelected((p, col) => {
    if (col.kind === 'field' && col.editable) {
      if (valueOf(p.id, col) != null) cells.push({ id: p.id, col, value: null })
    } else calculated++
  })
  copied.value = null
  if (cells.length) {
    writeCells(cells)
    if (cells.length > 1) notify(`Cleared ${cells.length} cells`)
  } else if (calculated) {
    notify('Calculated and group cells can’t be cleared here')
  }
}

function toggleBooleans() {
  const cells = []
  eachSelected((p, col) => {
    if (col.kind === 'field' && col.editable && col.def.type === 'boolean') cells.push({ p, col })
  })
  if (!cells.length) return
  // Checkbox-range semantics: all on → all off; otherwise everything on.
  const allOn = cells.every(({ p, col }) => valueOf(p.id, col) === true)
  writeCells(cells.map(({ p, col }) => ({ id: p.id, col, value: !allOn })))
}

const canFill = computed(() => {
  const g = sel.value
  return !!g && (g.r1 > g.r0 || g.r0 > 0)
})
/** Ctrl+D: copy the top row of the selection down through it (a single row
 *  copies from the row above, like Excel). */
function fillDown() {
  const g = sel.value
  if (!g || !canFill.value) return
  if (editing.value && !commitEdit()) return
  const src = g.r1 > g.r0 ? g.r0 : g.r0 - 1
  const from = rows.value[src]
  const cells = []
  for (let c = g.c0; c <= g.c1; c++) {
    const col = columns.value[c]
    if (col.kind !== 'field' || !col.editable) continue
    const v = valueOf(from.id, col)
    for (let r = src + 1; r <= g.r1; r++) cells.push({ id: rows.value[r].id, col, value: v })
  }
  if (!cells.length) return
  writeCells(cells).then((n) => {
    if (n) notify(`Filled ${n} cell${n === 1 ? '' : 's'} down`)
  })
}

// ── Clipboard ────────────────────────────────────────────────────────────────
function selectionTSV() {
  const g = sel.value
  if (!g) return ''
  const grid = []
  for (let r = g.r0; r <= g.r1; r++) {
    const p = rows.value[r]
    const line = []
    for (let c = g.c0; c <= g.c1; c++) line.push(cellText(p, columns.value[c]))
    grid.push(line)
  }
  return toTSV(grid)
}
function markCopied() {
  const g = sel.value
  copied.value = {
    ids: [rows.value[g.r0].id, rows.value[g.r1].id],
    keys: [columns.value[g.c0].key, columns.value[g.c1].key]
  }
  notify(`Copied ${selCells.value} cell${selCells.value === 1 ? '' : 's'}`)
}
function onCopy(e) {
  if (editing.value || !sel.value) return
  e.preventDefault()
  e.clipboardData.setData('text/plain', selectionTSV())
  markCopied()
}
async function copyViaMenu() {
  if (!sel.value) return
  try {
    await navigator.clipboard.writeText(selectionTSV())
    markCopied()
  } catch {
    notify('Press Ctrl+C to copy')
  }
}
function onPaste(e) {
  if (editing.value) return
  const text = e.clipboardData?.getData('text/plain') ?? ''
  e.preventDefault()
  if (text) pasteText(text)
}
async function pasteViaMenu() {
  try {
    const text = await navigator.clipboard.readText()
    if (text) pasteText(text)
  } catch {
    notify('Press Ctrl+V to paste')
  }
}

/** Paste a TSV block at the selection. Rows past the last one become new
 *  people (one createMany write); unparseable cells are skipped and counted. */
function pasteText(text) {
  if (blocked()) return
  const cols = columns.value
  const n = rows.value.length
  if (!cols.length) return
  let clip = parseTSV(text)
  const g = sel.value || { r0: n, r1: n, c0: 0, c1: 0 }
  // A block copied with its header row: drop the labels, keep the data.
  if (
    clip.length > 1 &&
    isHeaderRow(
      clip[0],
      cols.slice(g.c0).map((c) => c.label)
    )
  ) {
    clip = clip.slice(1)
  }
  const plan = planPaste(clip, g, cols.length)
  const cells = []
  const fresh = []
  let bad = 0
  let skipped = 0
  for (let dr = 0; dr < plan.rows; dr++) {
    const p = rows.value[plan.r0 + dr]
    const values = []
    for (let dc = 0; dc < plan.cols; dc++) {
      const col = cols[plan.c0 + dc]
      const raw = plan.at(dr, dc)
      if (col.kind !== 'field' || !col.editable) {
        if (raw.trim()) skipped++
        continue
      }
      const parsed = parseCellText(col.def, raw)
      if (!parsed.ok) {
        bad++
        continue
      }
      if (p) cells.push({ id: p.id, col, value: parsed.value })
      else if (parsed.value != null) values.push({ field_id: col.key, value: parsed.value })
    }
    if (!p && values.length) fresh.push({ values })
  }
  copied.value = null
  const wrote = writeCells(cells)
  const made = fresh.length ? createRows(fresh) : Promise.resolve([])
  if (n) {
    anchor.value = mk(Math.min(plan.r0, n - 1), plan.c0)
    focus.value = mk(Math.min(plan.r0 + plan.rows, n) - 1, plan.c0 + Math.max(1, plan.cols) - 1)
  }
  Promise.all([wrote, made]).then(([count, ids]) => {
    if (disposed) return
    const parts = []
    if (count) parts.push(`Pasted ${count} cell${count === 1 ? '' : 's'}`)
    if (ids?.length) parts.push(`added ${ids.length} ${nounFor(ids.length)}`)
    if (bad) parts.push(`${bad} didn't fit their trait type`)
    if (skipped) parts.push(`${skipped} landed on calculated columns`)
    if (parts.length) notify(parts.join(' · '), bad ? 'warn' : 'info', 4200)
    else if (!count) notify('Nothing to change')
  })
}

// ── Rows ─────────────────────────────────────────────────────────────────────
async function addRow() {
  if (editing.value && !commitEdit()) return
  closeFloating()
  const firstCol = Math.max(
    0,
    columns.value.findIndex((c) => isTextEditable(c))
  )
  const ids = await createRows([{ values: [] }])
  if (disposed || !ids?.length || editing.value) return
  await nextTick()
  const r = rowIndex.value.get(ids[0])
  if (r == null) return
  setActive({ r, c: firstCol })
  focusSink()
  startEdit({ draft: '', mode: 'enter' })
}

function deleteRows(ids) {
  if (!ids.length) return
  if (editing.value) cancelEdit()
  const n = ids.length
  enqueue(async () => {
    const res = await store.deletePersons(ids)
    if (!res.success) return fail(res.error)
    if (!disposed) notify(`Deleted ${n} ${nounFor(n)} — Ctrl+Z to undo`)
  })
  focus.value = anchor.value
}

const armed = ref(null)
let armTimer = 0
function arm(id) {
  armed.value = id
  clearTimeout(armTimer)
  armTimer = setTimeout(() => (armed.value = null), 3000)
}
function onBarDelete() {
  if (armed.value !== 'bar-delete') return arm('bar-delete')
  armed.value = null
  deleteRows(fullRowIds.value)
}

// ── Picker (select traits + groups) ──────────────────────────────────────────
const picker = ref(null) // { id, key, multi, rect, query }
function openPicker(p, col, query) {
  const r = aPos.value
  const cellEl = scrollEl.value?.querySelector(`.sh-cell[data-r="${r.r}"][data-c="${r.c}"]`)
  if (!cellEl) return
  keepFloatingUntil = performance.now() + 200
  scrollIntoView(r)
  const b = cellEl.getBoundingClientRect()
  focus.value = anchor.value
  picker.value = {
    id: p.id,
    key: col.key,
    multi: col.kind === 'groups',
    rect: { left: b.left, top: b.top, bottom: b.bottom, width: b.width },
    query: query || ''
  }
}
const pickerCol = computed(() => (picker.value ? allColByKey.value.get(picker.value.key) : null))
const pickerOptions = computed(() => {
  const col = pickerCol.value
  if (!col) return []
  if (col.kind === 'groups') {
    return store.tags
      .filter((t) => t.source !== 'derived')
      .map((t) => ({ id: t.id, label: t.label, color: t.color, icon: t.icon }))
  }
  return col.def.config.options || []
})
const pickerSelected = computed(() => {
  const pk = picker.value
  const col = pickerCol.value
  if (!pk || !col) return []
  if (col.kind === 'groups') return (store.tagsOf.get(pk.id) || []).map((t) => t.id)
  const v = valueOf(pk.id, col)
  return v == null ? [] : [v]
})

function onPickerPick(optionId) {
  const pk = picker.value
  const col = pickerCol.value
  if (!pk || !col) return
  if (col.kind === 'groups') {
    // Decide add vs remove when the job RUNS, so quick double-toggles resolve
    // against the latest memberships, not the state at click time.
    enqueue(async () => {
      const on = (store.tagsOf.get(pk.id) || []).some((t) => t.id === optionId)
      const res = on
        ? await store.removeEntityTag(pk.id, optionId)
        : await store.addEntityTag(pk.id, optionId)
      if (res && !res.success) fail(res.error)
    })
    return // multi: stays open
  }
  picker.value = null
  writeCells([{ id: pk.id, col, value: optionId }])
  focusSink()
  moveAfterEdit('down')
}
function onPickerClear() {
  const pk = picker.value
  const col = pickerCol.value
  picker.value = null
  if (pk && col?.kind === 'field') writeCells([{ id: pk.id, col, value: null }])
  focusSink()
}
function onPickerCreate(label) {
  const pk = picker.value
  const col = pickerCol.value
  if (!pk || !col) return
  if (col.kind === 'groups') {
    enqueue(async () => {
      const res = await store.createTag({ label })
      if (!res.success) return fail(res.error)
      const add = await store.addEntityTag(pk.id, res.data.id)
      if (add && !add.success) fail(add.error)
    })
    return
  }
  // A brand-new choice: extend the trait's options, then pick it. Both steps
  // ride the queue so the value can't be written before its option exists.
  picker.value = null
  const def = col.def
  const option = { id: crypto.randomUUID(), label }
  const options = [...(def.config.options || []), option]
  enqueue(async () => {
    const res = await store.updateFieldDef({
      id: def.id,
      config: JSON.parse(JSON.stringify({ ...def.config, options }))
    })
    if (!res.success) fail(res.error)
    return res.success
  }).then((ok) => {
    if (!ok) return
    const fresh = allColByKey.value.get(col.key)
    if (fresh) writeCells([{ id: pk.id, col: fresh, value: option.id }])
  })
  focusSink()
  moveAfterEdit('down')
}
function onPickerClose(dir) {
  picker.value = null
  focusSink()
  if (dir) moveAfterEdit(dir)
}

// ── Menus ────────────────────────────────────────────────────────────────────
const menu = ref(null) // { kind: 'items'|'addcol'|'cols', x, y, items?, col? }
const newCol = reactive({ label: '', type: 'text' })

function openMenu(kind, opts) {
  armed.value = null
  const MENU_W = kind === 'addcol' ? 300 : 240
  const x = Math.max(8, Math.min(opts.x, window.innerWidth - MENU_W - 8))
  const y = Math.max(8, Math.min(opts.y, window.innerHeight - 340))
  menu.value = { kind, ...opts, x, y }
  if (kind === 'addcol') {
    newCol.label = ''
    newCol.type = 'text'
    nextTick(() => addColInput.value?.focus())
  }
}
function toggleMenu(kind, e) {
  if (menu.value?.kind === kind) return closeMenu()
  if (editing.value && !commitEdit()) return
  const b = e.currentTarget.getBoundingClientRect()
  openMenu(kind, { x: b.left, y: b.bottom + 6 })
}
function closeMenu() {
  if (!menu.value) return
  menu.value = null
  armed.value = null
  focusSink()
}
function closeFloating() {
  closeMenu()
  if (picker.value) picker.value = null
}
function openHeadMenu(col, e) {
  if (editing.value && !commitEdit()) return
  const b = e.currentTarget.getBoundingClientRect()
  openMenu('items', { x: b.left - 180, y: b.bottom + 6, items: 'col', col })
}

const menuItems = computed(() => {
  const m = menu.value
  if (!m || m.kind !== 'items') return []
  if (m.items === 'col') {
    const col = m.col
    const s = sortSpec.value
    const out = [
      { id: 'sa', icon: 'arrow-up', label: 'Sort ascending', run: () => setSort(col.key, 1) },
      { id: 'sd', icon: 'arrow-down', label: 'Sort descending', run: () => setSort(col.key, -1) }
    ]
    if (s?.key === col.key)
      out.push({ id: 'sx', icon: 'x', label: 'Clear sort', run: () => setSort(col.key, 0) })
    out.push(
      { sep: true },
      {
        id: 'fit',
        icon: 'move-horizontal',
        label: 'Fit width to content',
        run: () => autoFit(col)
      },
      {
        id: 'sel',
        icon: 'columns-3',
        label: 'Select column',
        hint: 'Ctrl+Space',
        run: () => selectColumn(col)
      }
    )
    if (col.kind === 'field') {
      out.push({ id: 'ren', icon: 'pencil', label: 'Rename trait', run: () => startRename(col) })
    }
    out.push({
      id: 'hide',
      icon: 'eye-off',
      label: 'Hide column',
      run: () => toggleHidden(col.key)
    })
    if (col.kind === 'field' && !col.def.slot) {
      out.push(
        { sep: true },
        {
          id: 'deldef',
          icon: 'trash-2',
          label: 'Delete trait for everyone',
          armedLabel: 'Click again — removes every value',
          danger: true,
          arm: true,
          run: () => deleteTrait(col)
        }
      )
    }
    return out
  }
  // Cell context menu
  const ac = activeCell.value
  const n = touchedRowIds.value.length
  return [
    { id: 'cp', icon: 'copy', label: 'Copy', hint: 'Ctrl+C', run: copyViaMenu },
    { id: 'ps', icon: 'clipboard-paste', label: 'Paste', hint: 'Ctrl+V', run: pasteViaMenu },
    { id: 'cl', icon: 'eraser', label: 'Clear contents', hint: 'Del', run: clearSelection },
    {
      id: 'fd',
      icon: 'chevrons-down',
      label: 'Fill down',
      hint: 'Ctrl+D',
      disabled: !canFill.value,
      run: fillDown
    },
    { sep: true },
    {
      id: 'op',
      icon: 'arrow-up-right',
      label: 'Open profile',
      disabled: !ac,
      run: () => openProfile(ac?.p.id)
    },
    {
      id: 'ed',
      icon: 'square-pen',
      label: 'Edit in full form',
      disabled: !ac,
      run: () => ac && store.openForm(ac.p)
    },
    { id: 'add', icon: 'plus', label: `Add ${store.noun.toLowerCase()}`, run: addRow },
    { sep: true },
    {
      id: 'del',
      icon: 'trash-2',
      label: `Delete ${n} ${nounFor(n)}`,
      armedLabel: `Click again to delete ${n}`,
      danger: true,
      arm: true,
      disabled: !n,
      run: () => deleteRows(touchedRowIds.value)
    }
  ]
})

function runItem(it) {
  if (it.disabled) return
  if (it.arm && armed.value !== it.id) return arm(it.id)
  armed.value = null
  menu.value = null
  it.run()
  if (!editing.value && !renaming.value) focusSink()
}

function selectColumn(col) {
  const c = colIndex.value.get(col.key)
  const n = rows.value.length
  if (c == null || !n) return
  anchor.value = mk(0, c)
  focus.value = mk(n - 1, c)
}

// ── Column operations ────────────────────────────────────────────────────────
function onAddColKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault()
    addColumn()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    closeMenu()
  }
}
function addColumn() {
  const label = newCol.label.trim()
  if (!label) return
  const type = newCol.type
  menu.value = null
  enqueue(async () => {
    const res = await store.createFieldDef({ label, type, locked: true })
    if (!res.success) return fail(res.error)
    const key = res.data.def.id
    if (disposed) return
    markFresh(freshCols, [key])
    await nextTick()
    const c = colIndex.value.get(key)
    if (c != null && rows.value.length) setActive({ r: aPos.value?.r ?? 0, c })
    notify(`Added “${label}” — every ${store.noun.toLowerCase()} has it now`)
    focusSink()
  })
}

function toggleHidden(key) {
  const hidden = new Set(store.sheetPrefs.hidden)
  hidden.has(key) ? hidden.delete(key) : hidden.add(key)
  store.setSheetPrefs({ hidden: [...hidden] })
}
function showAllColumns() {
  store.setSheetPrefs({ hidden: [] })
}

function deleteTrait(col) {
  if (editing.value?.key === col.key) cancelEdit()
  enqueue(async () => {
    const res = await store.deleteFieldDef(col.def.id)
    if (!res.success) return fail(res.error)
    if (!disposed) notify(`Deleted “${col.label}” — Ctrl+Z to undo`)
  })
}

const renaming = ref(null)
const renameDraft = ref('')
function startRename(col) {
  renaming.value = col.key
  renameDraft.value = col.label
  nextTick(() => {
    const el = Array.isArray(renameEl.value) ? renameEl.value[0] : renameEl.value
    el?.focus()
    el?.select()
  })
}
function finishRename(save) {
  const key = renaming.value
  const label = renameDraft.value.trim()
  renaming.value = null
  const col = allColByKey.value.get(key)
  if (save && col?.kind === 'field' && label && label !== col.label) {
    enqueue(async () => {
      const res = await store.updateFieldDef({ id: col.def.id, label })
      if (!res.success) fail(res.error)
    })
  }
  focusSink()
}
function onRenameKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault()
    finishRename(true)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    finishRename(false)
  }
}

// Resize: live widths while dragging, one prefs write on release.
function startResize(col, e) {
  if (editing.value && !commitEdit()) return
  const key = col.key
  const startX = e.clientX
  const startW = col.width
  resizingKey.value = key
  document.body.style.cursor = 'col-resize'
  const move = (ev) => {
    liveWidths.value = { ...liveWidths.value, [key]: clampWidth(startW + ev.clientX - startX) }
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    document.body.style.cursor = ''
    const w = liveWidths.value[key]
    // Prefs first, then drop the live override — no frame at the old width.
    if (w && w !== startW) store.setSheetPrefs({ widths: { ...store.sheetPrefs.widths, [key]: w } })
    liveWidths.value = {}
    resizingKey.value = null
    focusSink()
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}

let measureCtx = null
function autoFit(col) {
  measureCtx = measureCtx || document.createElement('canvas').getContext('2d')
  const family = getComputedStyle(scrollEl.value).fontFamily
  measureCtx.font = `700 12px ${family}`
  let w = measureCtx.measureText(col.label).width + 76
  measureCtx.font = `13px ${family}`
  const list = rows.value
  const extra =
    col.kind === 'groups'
      ? 40
      : col.def?.type === 'select'
        ? 40
        : col.def?.type === 'slider'
          ? 70
          : 26
  for (let i = 0, n = Math.min(list.length, 4000); i < n; i++) {
    const text = cellText(list[i], col)
    if (text) w = Math.max(w, measureCtx.measureText(text).width + extra)
  }
  store.setSheetPrefs({ widths: { ...store.sheetPrefs.widths, [col.key]: clampWidth(w) } })
}

// ── Outside clicks ───────────────────────────────────────────────────────────
// Floating things close on any press outside them; an open edit commits when
// the press lands outside the sheet (a bad draft is discarded with a note —
// the rest of the app shouldn't be held hostage by one cell). Never on blur.
function onWindowPointerDown(e) {
  const t = e.target
  if (menu.value && !menuEl.value?.contains(t)) {
    // Toggle buttons open / swap / close menus themselves.
    if (!t.closest?.('[data-menu-toggle]')) closeMenu()
  }
  if (picker.value && !pickerRef.value?.contains(t)) picker.value = null
  if (renaming.value && !t.closest?.('.sh-rename')) finishRename(true)
  // Presses in the grid / formula bar manage the edit themselves.
  if (editing.value && !t.closest?.('.sh-scroll, .sh-fx')) {
    if (!commitEdit()) {
      editing.value = null
      notify('That entry didn’t fit its trait type — change discarded', 'warn')
    }
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
const entering = ref(true)
let enterTimer = 0

onMounted(() => {
  measure()
  ro = new ResizeObserver(measure)
  ro.observe(scrollEl.value)
  window.addEventListener('pointerdown', onWindowPointerDown, true)
  enterTimer = setTimeout(() => (entering.value = false), 900)
  if (rows.value.length && columns.value.length && !anchor.value) {
    anchor.value = mk(0, 0)
    focus.value = anchor.value
  }
  focusSink()
})

onBeforeUnmount(() => {
  // Keep a valid in-flight edit (the queue outlives the view); drop a bad one.
  if (editing.value) commitEdit()
  disposed = true
  endDrag()
  ro?.disconnect()
  window.removeEventListener('pointerdown', onWindowPointerDown, true)
  clearTimeout(glideTimer)
  clearTimeout(noticeTimer)
  clearTimeout(armTimer)
  clearTimeout(enterTimer)
  if (resizingKey.value) document.body.style.cursor = ''
})

// Anything that pops a modal over the sheet ends the edit first.
watch(
  () => store.modalOpen || store.formOpen,
  (open) => {
    if (open && editing.value && !commitEdit()) editing.value = null
    if (open) closeFloating()
    else nextTick(focusSink)
  }
)
</script>

<style scoped>
/* Layer order inside the grid (all within the canvas' stacking context):
   rows (scrolling cells; frozen cells are sticky z1 inside each row) →
   scroll overlays z3 (clipped off the frozen pane) → frozen overlays z4 →
   the editing row z5 → sticky header z6. */
.sheet {
  --grid-line: var(--border);
  --row-bg: var(--bg);
  --row-alt: color-mix(in srgb, var(--surface) 55%, var(--bg));
  --row-hover: color-mix(in srgb, var(--hover) 55%, var(--bg));
  --row-sel: color-mix(in srgb, var(--accent) 7%, var(--bg));
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  overflow: hidden;
}

.sh-sink {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  padding: 0;
  border: 0;
  opacity: 0;
  resize: none;
  overflow: hidden;
  pointer-events: none;
  z-index: -1;
}

/* ── Formula bar ─────────────────────────────────────────── */
.sh-bar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 22px;
  border-bottom: 1px solid var(--border);
  background: var(--glass-soft);
  backdrop-filter: blur(10px);
  z-index: 3;
  animation: sh-drop 0.4s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}
@keyframes sh-drop {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
}
.sh-ref {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 170px;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--elevated);
  overflow: hidden;
}
.sh-ref-main {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--t1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sh-ref-sub {
  font-size: 11.5px;
  color: var(--t3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sh-fx {
  flex: 1 1 auto;
  min-width: 120px;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--elevated);
  cursor: text;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.sh-fx.live,
.sh-fx:focus-within:not(.ro) {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--adim);
}
.sh-fx.ro {
  cursor: default;
}
.sh-fx-icon {
  font-size: 12.5px;
  font-style: italic;
  font-weight: 700;
  color: var(--accent);
}
.sh-fx-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--t1);
  font-family: var(--font);
  font-size: 13px;
  box-shadow: none;
}
.sh-fx-input:focus {
  outline: none;
  box-shadow: none;
}
.sh-fx.ro .sh-fx-input {
  color: var(--t2);
}
.sh-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition:
    color 0.16s,
    background 0.16s,
    border-color 0.16s,
    transform 0.16s,
    box-shadow 0.16s;
}
.sh-btn:hover:not(:disabled) {
  color: var(--t1);
  background: var(--hover);
  transform: translateY(-1px);
}
.sh-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.97);
}
.sh-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.sh-btn.open {
  color: var(--t1);
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
}
.sh-btn svg:not(.ui-icon) {
  width: 14px;
  height: 14px;
  fill: currentColor;
}
.sh-stroke {
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.sh-btn.icon {
  width: 34px;
  padding: 0;
  justify-content: center;
}
.sh-btn.primary {
  background: var(--accent);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 2px 10px color-mix(in srgb, var(--accent) 40%, transparent);
}
.sh-btn.primary:hover:not(:disabled) {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 6px 18px color-mix(in srgb, var(--accent) 45%, transparent);
}

.sh-btn.danger {
  color: var(--pink);
  border-color: color-mix(in srgb, var(--pink) 35%, transparent);
}
.sh-btn.danger.armed {
  color: #fff;
  background: var(--pink);
  animation: sh-pulse 0.9s ease-in-out infinite;
}
@keyframes sh-pulse {
  50% {
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--pink) 25%, transparent);
  }
}
.sh-badge {
  padding: 1px 7px;
  border-radius: 10px;
  background: var(--adim);
  color: var(--accent);
  font-size: 11.5px;
  font-weight: 700;
}

/* ── Grid scaffolding ────────────────────────────────────── */
.sh-scroll {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  outline: none;
  user-select: none;
}
.sh-canvas {
  position: relative;
  min-width: 100%;
}

/* Header */
.sh-head {
  position: sticky;
  top: 0;
  z-index: 6;
  display: flex;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 1px 0 var(--border);
}
.sh-corner {
  position: sticky;
  left: 0;
  z-index: 3;
  flex: 0 0 64px;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 6px;
  border: none;
  border-right: 1px solid var(--grid-line);
  background: var(--surface);
  color: var(--t3);
  cursor: pointer;
  transition: color 0.15s;
}
.sh-corner svg {
  width: 9px;
  height: 9px;
  fill: currentColor;
}
.sh-corner:hover,
.sh-corner.all {
  color: var(--accent);
}
.sh-hcell {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  height: 100%;
  border-right: 1px solid var(--grid-line);
  background: var(--surface);
  transition: background 0.18s;
}
.sheet.entering .sh-hcell {
  animation: sh-head-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}
@keyframes sh-head-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
}
.sh-hcell.frozen {
  position: sticky;
  z-index: 2;
}
.sh-hcell.frozen-last,
.sh-cell.frozen-last {
  border-right-color: color-mix(in srgb, var(--accent) 22%, var(--grid-line));
}
.sheet.scrolled-x .sh-hcell.frozen-last,
.sheet.scrolled-x .sh-cell.frozen-last {
  box-shadow: 8px 0 12px -10px color-mix(in srgb, var(--t1) 45%, transparent);
}
.sh-hcell.in-sel {
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
}
.sh-hcell.in-sel::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--accent);
  animation: sh-underline 0.2s ease-out;
}
@keyframes sh-underline {
  from {
    transform: scaleX(0.3);
    opacity: 0;
  }
}
.sh-hcell.fresh {
  animation: sh-col-in 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.sh-hlabel {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 100%;
  padding: 0 4px 0 10px;
  border: none;
  background: transparent;
  color: var(--t1);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}
.sh-hcell.ro .sh-hlabel {
  color: var(--t2);
}
.sh-htype {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 18px;
  border-radius: 5px;
  background: var(--elevated);
  color: var(--t3);
}
.sh-hicon {
  flex: 0 0 auto;
  color: var(--t2);
}
.sh-htext {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sh-sort {
  flex: 0 0 auto;
  display: inline-flex;
  width: 12px;
  height: 12px;
  color: var(--accent);
  opacity: 0;
  transform: scale(0.5);
  transition:
    opacity 0.2s,
    transform 0.3s cubic-bezier(0.34, 1.5, 0.5, 1);
}
.sh-sort svg {
  width: 100%;
  height: 100%;
  fill: currentColor;
}
.sh-hlabel:hover .sh-sort:not(.on) {
  opacity: 0.35;
  transform: scale(0.85);
}
.sh-sort.on {
  opacity: 1;
  transform: none;
}
.sh-sort.on.desc {
  transform: rotate(180deg);
}
.sh-hmenu {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--ctl-xs);
  height: var(--ctl-xs);
  margin-right: 6px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 0.15s,
    background 0.15s,
    color 0.15s;
}
.sh-hcell:hover .sh-hmenu {
  opacity: 1;
}
.sh-hmenu:hover {
  background: var(--hover);
  color: var(--t1);
}
.sh-resize {
  position: absolute;
  top: 0;
  right: -4px;
  width: 8px;
  height: 100%;
  z-index: 2;
  cursor: col-resize;
}
.sh-resize::after {
  content: '';
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 3px;
  width: 2px;
  border-radius: 1px;
  background: var(--accent);
  opacity: 0;
  transition: opacity 0.15s;
}
.sh-resize:hover::after,
.sh-hcell.resizing .sh-resize::after {
  opacity: 1;
}
.sh-rename {
  width: calc(100% - 12px);
  height: 26px;
  margin: 0 6px;
  padding: 0 8px;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 700;
  box-shadow: 0 0 0 3px var(--adim);
}
.sh-rename:focus {
  outline: none;
}
.sh-hadd {
  flex: 0 0 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s;
}
.sh-hadd:hover {
  color: var(--accent);
  background: var(--adim);
}

/* Body + rows */
.sh-body {
  position: relative;
}
.sh-row {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  height: 36px;
  background: var(--row-bg);
  will-change: transform;
}
.sh-row.odd {
  --row-bg: var(--row-alt);
}
.sh-row:hover {
  --row-bg: var(--row-hover);
}
.sh-row.in-sel {
  --row-bg: var(--row-sel);
}
.sh-row.editing {
  z-index: 5;
}
.sh-body.gliding .sh-row {
  transition: transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
}
.sheet.entering .sh-row {
  animation: sh-row-in 0.46s cubic-bezier(0.22, 1, 0.36, 1) calc(min(var(--i), 30) * 16ms) backwards;
}
@keyframes sh-row-in {
  from {
    opacity: 0;
    translate: 0 8px;
  }
}
.sh-row.fresh::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--accent) 22%, transparent),
    transparent
  );
  animation: sh-sweep 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
@keyframes sh-sweep {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}
.sh-row.pinned .sh-rownum {
  color: var(--accent);
}

.sh-gutter {
  position: sticky;
  left: 0;
  z-index: 2;
  flex: 0 0 64px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px 0 8px;
  border-right: 1px solid var(--grid-line);
  border-bottom: 1px solid var(--grid-line);
  background: var(--row-bg);
  cursor: pointer;
  transition: background 0.15s;
}
.sh-row.in-sel .sh-gutter {
  background: color-mix(in srgb, var(--accent) 14%, var(--bg));
}
.sh-rownum {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--t3);
  font-variant-numeric: tabular-nums;
  transition: color 0.15s;
}
.sh-row.in-sel .sh-rownum {
  color: var(--accent);
}
.sh-ava {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
  transition: transform 0.2s cubic-bezier(0.34, 1.5, 0.5, 1);
}
.sh-ava.mono {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--adim);
  color: var(--accent);
  font-size: 9.5px;
  font-weight: 800;
}
.sh-open {
  position: absolute;
  right: 5px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  opacity: 0;
  transform: scale(0.6);
  transition:
    opacity 0.15s,
    transform 0.22s cubic-bezier(0.34, 1.5, 0.5, 1);
}
.sh-open svg {
  width: 11px;
  height: 11px;
  stroke-width: 1.6;
}
.sh-gutter:hover .sh-open {
  opacity: 1;
  transform: none;
}
.sh-gutter:hover .sh-ava {
  transform: scale(0.6);
  opacity: 0;
}

/* Cells */
.sh-cell {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 100%;
  padding: 0 10px;
  border-right: 1px solid var(--grid-line);
  border-bottom: 1px solid var(--grid-line);
  overflow: hidden;
  font-size: 13px;
  color: var(--t1);
  cursor: cell;
}
.sh-cell.frozen {
  position: sticky;
  z-index: 1;
  background: var(--row-bg);
  font-weight: 600;
}
.sh-cell.a-right {
  justify-content: flex-end;
}
.sh-cell.a-center {
  justify-content: center;
}
.sh-cell.ro {
  color: var(--t2);
}
.sh-cell.is-editing {
  overflow: visible;
}
.sh-row .sh-cell.fresh,
.sh-cell.fresh {
  animation: sh-col-in 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes sh-col-in {
  from {
    opacity: 0;
    clip-path: inset(0 100% 0 0);
  }
}
.sh-txt {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sh-ph {
  color: var(--t3);
  font-style: italic;
  font-weight: 500;
}
.sh-num {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.sh-num.dim {
  color: var(--t3);
}
.sh-unit {
  font-size: 12px;
  color: var(--t3);
}

.sh-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 17px;
  height: 17px;
  border: 1.5px solid var(--t3);
  border-radius: 5px;
  cursor: pointer;
  transition:
    background 0.18s,
    border-color 0.18s,
    transform 0.25s cubic-bezier(0.34, 1.6, 0.5, 1);
}
.sh-check:hover {
  border-color: var(--accent);
}
.sh-check svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: #fff;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 12;
  stroke-dashoffset: 12;
  transition: stroke-dashoffset 0.25s ease 0.05s;
}
.sh-check.on {
  background: var(--accent);
  border-color: var(--accent);
  transform: scale(1.06);
}
.sh-check.on svg {
  stroke-dashoffset: 0;
}

.sh-pill {
  --pc: var(--accent);
  max-width: 100%;
  padding: 2px 9px;
  border-radius: 20px;
  background: color-mix(in srgb, var(--pc) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--pc) 40%, transparent);
  color: var(--t1);
  font-size: 12.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sh-meter {
  flex: 1 1 auto;
  min-width: 24px;
  height: 6px;
  border-radius: 3px;
  background: var(--elevated);
  overflow: hidden;
}
.sh-meter-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--accent) 55%, transparent),
    var(--accent)
  );
  transform-origin: left;
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.sh-chips {
  display: flex;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
}
.sh-chip {
  --cc: var(--accent);
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  border-radius: 20px;
  background: color-mix(in srgb, var(--cc) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--cc) 38%, transparent);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.sh-chip.more {
  color: var(--t3);
  background: var(--elevated);
  border-color: var(--border);
}

/* Save feedback on the cell itself */
.sh-cell.pend::before {
  content: '';
  position: absolute;
  top: 5px;
  right: 5px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--amber);
  animation: sh-blink 0.8s ease-in-out infinite;
}
@keyframes sh-blink {
  50% {
    opacity: 0.25;
  }
}
.sh-cell.fl-ok {
  animation: sh-flash-ok 0.9s ease-out;
}
@keyframes sh-flash-ok {
  from {
    background-color: color-mix(in srgb, var(--accent) 26%, var(--row-bg));
  }
}
.sh-cell.fl-err {
  animation:
    sh-flash-err 0.9s ease-out,
    sh-shake 0.36s ease;
}
@keyframes sh-flash-err {
  from {
    background-color: color-mix(in srgb, var(--pink) 35%, var(--row-bg));
  }
}
@keyframes sh-shake {
  25% {
    translate: -3px 0;
  }
  75% {
    translate: 3px 0;
  }
}

/* In-cell editor */
.sh-editor {
  position: absolute;
  inset: -1px;
  z-index: 2;
  width: calc(100% + 2px);
  height: calc(100% + 2px);
  padding: 0 10px;
  border: 2px solid var(--accent);
  border-radius: 3px;
  background: var(--surface);
  color: var(--t1);
  font-family: var(--font);
  font-size: 13px;
  box-shadow:
    0 0 0 4px var(--adim),
    var(--shadow);
  animation: sh-editor-in 0.14s ease-out;
}
.sh-editor:focus {
  outline: none;
}
.sh-editor.a-right {
  text-align: right;
}
.sh-editor.multi {
  height: 108px;
  padding: 8px 10px;
  resize: none;
  line-height: 1.45;
}
.sh-editor.bad {
  border-color: var(--pink);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--pink) 20%, transparent);
}
.sh-editor.shake {
  animation: sh-shake 0.36s ease;
}
@keyframes sh-editor-in {
  from {
    opacity: 0;
    transform: scale(0.97);
  }
}
.sh-err {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 3;
  padding: 5px 9px;
  border-radius: 7px;
  background: var(--pink);
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: var(--shadow);
}
.sh-err::before {
  content: '';
  position: absolute;
  top: -4px;
  left: 14px;
  width: 8px;
  height: 8px;
  background: var(--pink);
  transform: rotate(45deg);
}
.sh-err-enter-active,
.sh-err-leave-active {
  transition:
    opacity 0.18s,
    transform 0.22s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.sh-err-enter-from,
.sh-err-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Overlays: selection, active-cell ring, copy marquee. They glide. */
.sh-ovl,
.sh-ovl-frozen {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.sh-ovl {
  z-index: 3;
}
.sh-ovl-frozen {
  z-index: 4;
}
.sh-ovl-anchor {
  position: sticky;
  left: 0;
  width: 0;
  height: 0;
}
.sh-selrect,
.sh-ring,
.sh-marquee {
  position: absolute;
  top: 0;
  left: 0;
  transition:
    transform 0.11s cubic-bezier(0.22, 1, 0.36, 1),
    width 0.11s cubic-bezier(0.22, 1, 0.36, 1),
    height 0.11s cubic-bezier(0.22, 1, 0.36, 1);
}
.sh-body.gliding .sh-selrect,
.sh-body.gliding .sh-ring,
.sh-body.gliding .sh-marquee {
  transition-duration: 0.42s;
}
.sh-selrect {
  background: color-mix(in srgb, var(--accent) 11%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 70%, transparent);
  animation: sh-fade-in 0.15s ease-out;
}
.sh-selrect.open-l {
  border-left-color: transparent;
}
.sh-selrect.open-r {
  border-right-color: transparent;
}
.sh-ring {
  border: 2px solid var(--accent);
  border-radius: 2px;
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--accent) 25%, transparent),
    0 0 14px color-mix(in srgb, var(--accent) 30%, transparent);
}
.sh-ring::after {
  /* Excel's fill handle */
  content: '';
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 6px;
  height: 6px;
  border: 1px solid var(--surface);
  background: var(--accent);
}
.sh-marquee {
  background-image:
    linear-gradient(90deg, var(--accent) 50%, transparent 50%),
    linear-gradient(90deg, var(--accent) 50%, transparent 50%),
    linear-gradient(0deg, var(--accent) 50%, transparent 50%),
    linear-gradient(0deg, var(--accent) 50%, transparent 50%);
  background-repeat: repeat-x, repeat-x, repeat-y, repeat-y;
  background-size:
    8px 2px,
    8px 2px,
    2px 8px,
    2px 8px;
  background-position:
    0 0,
    0 100%,
    0 0,
    100% 0;
  animation: sh-ants 0.5s linear infinite;
}
@keyframes sh-ants {
  to {
    background-position:
      8px 0,
      -8px 100%,
      0 -8px,
      100% 8px;
  }
}
@keyframes sh-fade-in {
  from {
    opacity: 0;
  }
}

/* Add-row strip */
.sh-addrow {
  position: absolute;
  left: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  margin: 4px 0 0 8px;
  padding: 0 14px;
  border: 1px dashed var(--border);
  border-radius: 9px;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s,
    background 0.15s,
    top 0.42s cubic-bezier(0.22, 1, 0.36, 1);
}
.sh-addrow:hover {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 50%, transparent);
  background: var(--adim);
}

.sh-addrow-hint {
  font-weight: 500;
  color: var(--t3);
}

/* Empty state */
.sh-empty {
  position: absolute;
  inset: 40px 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  color: var(--t2);
  pointer-events: none;
}
.sh-empty-icon {
  display: flex;
  color: var(--t3);
  animation: sh-bob 3s ease-in-out infinite;
}
@keyframes sh-bob {
  50% {
    transform: translateY(-5px);
  }
}
.sh-empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--t1);
}
.sh-empty-text {
  max-width: 300px;
  font-size: 13px;
}
.sh-empty-btn {
  margin-top: 6px;
  pointer-events: auto;
}

/* ── Status bar ──────────────────────────────────────────── */
.sh-status {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 30px;
  padding: 0 22px;
  border-top: 1px solid var(--border);
  background: var(--glass-soft);
  font-size: 12.5px;
  color: var(--t2);
  white-space: nowrap;
  overflow: hidden;
}
.sh-st-count {
  font-weight: 700;
  color: var(--t1);
  font-variant-numeric: tabular-nums;
}
.sh-resort {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 20px;
  padding: 0 9px;
  border: 1px solid color-mix(in srgb, var(--amber) 45%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--amber) 12%, transparent);
  color: var(--amber);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.sh-resort-icon {
  transition: transform 0.4s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.sh-resort:hover .sh-resort-icon {
  transform: rotate(-180deg);
}
.sh-hint {
  color: var(--t3);
  overflow: hidden;
  text-overflow: ellipsis;
}
.sh-notice {
  font-weight: 600;
  color: var(--t1);
  overflow: hidden;
  text-overflow: ellipsis;
}
.sh-notice.warn {
  color: var(--amber);
}
.sh-notice.err {
  color: var(--pink);
}
.sh-st-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 14px;
}
.sh-summary {
  font-variant-numeric: tabular-nums;
  color: var(--t1);
}
.sh-save {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--t3);
  transition: color 0.2s;
}
.sh-save-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green);
  transition: background 0.2s;
}
.sh-save.saving {
  color: var(--t2);
}
.sh-save.saving .sh-save-dot {
  background: var(--amber);
  animation: sh-blink 0.8s ease-in-out infinite;
}
.sh-save.error {
  color: var(--pink);
}
.sh-save.error .sh-save-dot {
  background: var(--pink);
}

/* ── Menus (teleported to body — scoped styles still apply) ── */
.sh-menu {
  position: fixed;
  z-index: 400;
  min-width: 220px;
  max-height: calc(100vh - 24px);
  overflow-y: auto;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--glass-soft);
  backdrop-filter: blur(18px) saturate(1.3);
  box-shadow: var(--shadow);
  transform-origin: top left;
}
.sh-menu.k-addcol {
  width: 300px;
  padding: 12px;
}
.sh-menu.k-cols {
  width: 250px;
  padding: 10px;
}
.sh-menu-enter-active {
  transition:
    opacity 0.18s ease,
    transform 0.26s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.sh-menu-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}
.sh-menu-enter-from,
.sh-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.95);
}
.sh-menu-title {
  padding: 2px 4px 10px;
  font-size: 13px;
  font-weight: 800;
  color: var(--t1);
}
.sh-menu-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  height: 30px;
  padding: 0 9px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--t1);
  font-family: var(--font);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  animation: sh-item-in 0.22s cubic-bezier(0.22, 1, 0.36, 1) calc(var(--i, 0) * 0.015s) backwards;
  transition:
    background 0.12s,
    color 0.12s;
}
@keyframes sh-item-in {
  from {
    opacity: 0;
    transform: translateX(-5px);
  }
}
.sh-menu-item:hover:not(:disabled) {
  background: var(--hover);
}
.sh-menu-item:disabled {
  opacity: 0.4;
  cursor: default;
}
.sh-menu-item.danger {
  color: var(--pink);
}
.sh-menu-item.armed {
  background: var(--pink);
  color: #fff;
}
.sh-menu-icon {
  flex: 0 0 auto;
  color: var(--t2);
}
.sh-menu-label {
  flex: 1 1 auto;
}
.sh-menu-hint {
  font-size: 11.5px;
  color: var(--t3);
}
.sh-menu-item.armed .sh-menu-hint {
  color: #fff;
}
.sh-menu-sep {
  height: 1px;
  margin: 5px 4px;
  background: var(--border);
}
.sh-menu-input {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 13px;
}
.sh-menu-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--adim);
}
.sh-types {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  margin: 10px 0 12px;
}
.sh-type {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  animation: sh-item-in 0.24s cubic-bezier(0.22, 1, 0.36, 1) calc(var(--i, 0) * 0.02s) backwards;
  transition:
    color 0.15s,
    border-color 0.15s,
    background 0.15s,
    transform 0.2s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.sh-type:hover {
  color: var(--t1);
  transform: translateY(-1px);
}
.sh-type.on {
  color: var(--t1);
  border-color: var(--accent);
  background: var(--adim);
}
.sh-type-glyph {
  color: var(--accent);
}
.sh-menu-go {
  width: 100%;
  justify-content: center;
}
.sh-colslist {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 320px;
  overflow-y: auto;
}
.sh-colrow {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 30px;
  padding: 0 6px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--t1);
  font-family: var(--font);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  animation: sh-item-in 0.22s cubic-bezier(0.22, 1, 0.36, 1) calc(var(--i, 0) * 0.015s) backwards;
  transition:
    background 0.12s,
    color 0.15s;
}
.sh-colrow:hover {
  background: var(--hover);
}
.sh-colrow.off {
  color: var(--t3);
}
.sh-colrow-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sh-colrow-type {
  flex: 0 0 auto;
  color: var(--t3);
}
.sh-toggle {
  position: relative;
  flex: 0 0 26px;
  height: 15px;
  border-radius: 8px;
  background: var(--accent);
  transition: background 0.2s;
}
.sh-colrow.off .sh-toggle {
  background: var(--elevated);
  box-shadow: inset 0 0 0 1px var(--border);
}
.sh-toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #fff;
  transform: translateX(11px);
  transition: transform 0.25s cubic-bezier(0.34, 1.5, 0.5, 1);
}
.sh-colrow.off .sh-toggle-knob {
  transform: none;
  background: var(--t3);
}
.sh-menu-link {
  width: 100%;
  margin-top: 8px;
  padding: 6px;
  border: none;
  border-radius: 7px;
  background: var(--adim);
  color: var(--accent);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
}

/* ── Small transitions ───────────────────────────────────── */
.sh-fade-enter-active,
.sh-fade-leave-active {
  transition: opacity 0.2s ease;
}
.sh-fade-enter-from,
.sh-fade-leave-to {
  opacity: 0;
}
.sh-pop-x-enter-active {
  transition:
    opacity 0.2s ease,
    transform 0.3s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.sh-pop-x-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}
.sh-pop-x-enter-from,
.sh-pop-x-leave-to {
  opacity: 0;
  transform: scale(0.85);
}
.sh-badge-enter-active,
.sh-badge-leave-active {
  transition:
    opacity 0.2s,
    transform 0.24s cubic-bezier(0.34, 1.5, 0.5, 1);
}
.sh-badge-enter-from,
.sh-badge-leave-to {
  opacity: 0;
  transform: scale(0.5);
}

@media (prefers-reduced-motion: reduce) {
  .sh-bar,
  .sh-row,
  .sh-hcell,
  .sh-cell,
  .sh-editor,
  .sh-menu-item,
  .sh-colrow,
  .sh-type,
  .sh-empty-icon,
  .sh-marquee {
    animation: none !important;
  }
  .sh-selrect,
  .sh-ring,
  .sh-marquee,
  .sh-body.gliding .sh-row {
    transition: none !important;
  }
}
</style>
