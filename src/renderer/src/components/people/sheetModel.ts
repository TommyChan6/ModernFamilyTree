// Pure model for the Directory's Sheet medium (people/SheetView.vue): which
// columns exist, how a cell's text round-trips to a trait value, how columns
// sort, rectangular range math, Excel-compatible TSV for the clipboard, and
// the paste / selection-summary rules. No store, DOM or Vue dependency —
// covered by tests/sheetModel.test.js.

import type { DateValue, FieldDef } from '../../../../shared/types'
import { coerceValue } from '../../../../shared/fields'
import { format as formatDate, toOrdinal } from '../../../../shared/calendarMath'

// ── Geometry ──────────────────────────────────────────────────────────────────
export const ROW_H = 36
export const HEAD_H = 40
export const GUTTER_W = 64
export const MIN_COL_W = 60
export const MAX_COL_W = 900

// ── Columns ───────────────────────────────────────────────────────────────────
/** 'field' columns edit a trait; the rest are derived from other data. */
export type ColumnKind = 'field' | 'age' | 'ties' | 'groups'

export interface SheetColumn {
  /** Field-def id, or one of the DERIVED keys. Stable across sessions. */
  key: string
  kind: ColumnKind
  label: string
  icon: string
  def: FieldDef | null
  /** Typed in / pasted / cleared. (Groups edit through their picker only.) */
  editable: boolean
  align: 'left' | 'right' | 'center'
  width: number
  /** Stays pinned at the left while the sheet scrolls sideways (name traits). */
  frozen: boolean
}

export const DERIVED_KEYS = { age: '@age', ties: '@ties', groups: '@groups' } as const

const TYPE_WIDTH: Record<string, number> = {
  text: 180,
  boolean: 96,
  number: 110,
  number_range: 130,
  select: 140,
  slider: 150,
  date: 120,
  date_range: 170
}

const TYPE_ALIGN: Record<string, SheetColumn['align']> = {
  boolean: 'center',
  number: 'right',
  number_range: 'right',
  slider: 'left'
}

/** Icon name (components/ui/icons.js) per trait type, shown in the column
 *  header and the add-trait menu. */
export const TYPE_GLYPH: Record<string, string> = {
  text: 'type',
  boolean: 'toggle-left',
  number: 'hash',
  number_range: 'arrow-left-right',
  select: 'chevrons-up-down',
  slider: 'sliders-horizontal',
  date: 'calendar',
  date_range: 'calendar-range',
  custom_date: 'calendar-days',
  custom_date_range: 'calendar-range'
}

/** Types the sheet can type into (custom_date* have no editor yet). */
const EDITABLE_TYPES = new Set(Object.keys(TYPE_WIDTH))

export const clampWidth = (w: number): number =>
  Math.min(MAX_COL_W, Math.max(MIN_COL_W, Math.round(w)))

/** The sheet's columns, in display order: the name-slot traits first (frozen,
 *  in name-word order), every other trait in form order, then the derived
 *  Age / Ties (/ Groups) columns. Hidden keys are dropped; saved widths win
 *  over the per-type defaults. */
export function buildColumns(
  defs: FieldDef[],
  opts: { widths?: Record<string, number>; hidden?: string[]; groups?: boolean } = {}
): SheetColumn[] {
  const widths = opts.widths || {}
  const hidden = new Set(opts.hidden || [])
  const names = defs
    .filter((d) => d.slot === 'name')
    .sort((a, b) => a.slot_order - b.slot_order || a.order - b.order)
  const rest = defs.filter((d) => d.slot !== 'name').sort((a, b) => a.order - b.order)

  const fieldCol = (d: FieldDef, frozen: boolean): SheetColumn => ({
    key: d.id,
    kind: 'field',
    label: d.label,
    icon: d.icon || '',
    def: d,
    editable: EDITABLE_TYPES.has(d.type),
    align: TYPE_ALIGN[d.type] || 'left',
    width: clampWidth(
      widths[d.id] ??
        (frozen ? 200 : d.type === 'text' && d.config?.multiline ? 260 : TYPE_WIDTH[d.type] || 150)
    ),
    frozen
  })
  const derived = (kind: ColumnKind, key: string, label: string, icon: string, w: number) => ({
    key,
    kind,
    label,
    icon,
    def: null,
    editable: false,
    align: (kind === 'groups' ? 'left' : 'right') as SheetColumn['align'],
    width: clampWidth(widths[key] ?? w),
    frozen: false
  })

  const cols: SheetColumn[] = [
    ...names.map((d) => fieldCol(d, true)),
    ...rest.map((d) => fieldCol(d, false)),
    derived('age', DERIVED_KEYS.age, 'Age', '', 100),
    derived('ties', DERIVED_KEYS.ties, 'Ties', '', 100)
  ]
  if (opts.groups) cols.push(derived('groups', DERIVED_KEYS.groups, 'Groups', '', 200))
  return cols.filter((c) => !hidden.has(c.key))
}

/** Left offset of each column (after the row gutter), plus the frozen pane
 *  width and the total content width. */
export function columnOffsets(cols: SheetColumn[]): {
  lefts: number[]
  total: number
  frozenW: number
} {
  const lefts: number[] = []
  let x = GUTTER_W
  let frozenW = GUTTER_W
  for (const c of cols) {
    lefts.push(x)
    x += c.width
    if (c.frozen) frozenW = x
  }
  return { lefts, total: x, frozenW }
}

// ── Cell text ⇄ value ─────────────────────────────────────────────────────────

/** A failed parse carries an English `error` plus a stable `code` (and the
 *  offending text as `arg`, when relevant) so the view can show it in the UI
 *  language. */
export type ParseErrorCode =
  | 'notNumber'
  | 'numRangeShape'
  | 'numRangeNumbers'
  | 'yesNo'
  | 'notOption'
  | 'dateShape'
  | 'dateRangeShape'
  | 'dateRangeDates'
  | 'notEditable'

export type ParseResult =
  { ok: true; value: unknown } | { ok: false; error: string; code: ParseErrorCode; arg?: string }

const TRUE_WORDS = new Set(['true', 'yes', 'y', '1', 'x', '✓', '✔', 'on', 'checked'])
const FALSE_WORDS = new Set(['false', 'no', 'n', '0', 'off', 'unchecked'])

/** Parse "1950", "1950-06", "1950-06-12" (also "/" or "." separators, and
 *  negative years for BCE) into a DateValue. '' → null; garbage → undefined. */
export function parseDateText(text: string): DateValue | null | undefined {
  const t = text.trim()
  if (t === '') return null
  const m = /^(-?\d{1,6})(?:[-/.](\d{1,2})(?:[-/.](\d{1,2}))?)?$/.exec(t)
  if (!m) return undefined
  const year = Number(m[1])
  const month = m[2] != null ? Number(m[2]) : null
  const day = m[3] != null ? Number(m[3]) : null
  if (year === 0) return undefined
  if (month != null && (month < 1 || month > 12)) return undefined
  if (day != null) {
    const max = new Date(Date.UTC(2000, month as number, 0)).getUTCDate() // leap-safe cap
    if (day < 1 || day > max) return undefined
  }
  return {
    year,
    month,
    day,
    precision: day != null ? 'day' : month != null ? 'month' : 'year',
    calendar: 'gregorian'
  }
}

/** Parse a number the way people type them: optional unit suffix, thousands
 *  commas ("1,234.5"), or a lone decimal comma ("3,5"). '' → null; garbage →
 *  undefined. */
export function parseNumberText(text: string, unit = ''): number | null | undefined {
  let t = text.trim()
  if (unit && t.toLowerCase().endsWith(unit.toLowerCase())) t = t.slice(0, -unit.length).trim()
  t = t.replace(/[\s_]/g, '')
  if (t === '') return null
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '')
  else if (/^-?\d+,\d+$/.test(t)) t = t.replace(',', '.')
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

/** Split a range ("a–b", "a — b", "a..b", "a to b", "a - b"). A bare hyphen
 *  counts only when `bareHyphen` says so — for dates "1950-06" is a month,
 *  so there the right side must have 3+ digits ("1950-1960"). Returns
 *  [text] when there's no separator. */
export function splitRange(text: string, bareHyphen: RegExp | null): string[] {
  const t = text.trim()
  const parts = t.split(/\s*(?:–|—|\.\.|\bto\b)\s*|\s+-\s+/i)
  if (parts.length === 2) return parts.map((p) => p.trim())
  if (parts.length > 2) return parts
  const m = bareHyphen ? bareHyphen.exec(t) : null
  return m ? [m[1], m[2]] : [t]
}

const NUMBER_HYPHEN = /^(-?\d*\.?\d+)-(-?\d*\.?\d+)$/
const YEAR_HYPHEN = /^(-?\d{1,6})-(\d{3,6})$/

/** Parse typed / pasted text into the value a trait stores. The result is
 *  already coerced with the shared coerceValue, so optimistic display matches
 *  what the server will keep. */
export function parseCellText(def: FieldDef, text: string): ParseResult {
  const raw = text ?? ''
  const t = raw.trim()
  const bad = (code: ParseErrorCode, error: string, arg?: string): ParseResult =>
    arg == null ? { ok: false, error, code } : { ok: false, error, code, arg }
  const ok = (v: unknown): ParseResult => ({ ok: true, value: coerceValue(def, v) })
  switch (def.type) {
    case 'text':
      return ok(raw)
    case 'number':
    case 'slider': {
      const n = parseNumberText(t, def.unit)
      return n === undefined ? bad('notNumber', 'Not a number') : ok(n)
    }
    case 'number_range': {
      if (t === '') return ok(null)
      const parts = splitRange(t, NUMBER_HYPHEN)
      if (parts.length > 2) return bad('numRangeShape', 'Use “low–high”')
      const a = parseNumberText(parts[0], def.unit)
      const b = parts.length === 2 ? parseNumberText(parts[1], def.unit) : a
      if (a === undefined || b === undefined)
        return bad('numRangeNumbers', 'Use numbers, like “10–20”')
      return ok({ a, b })
    }
    case 'boolean': {
      const w = t.toLowerCase()
      if (w === '') return ok(null)
      if (TRUE_WORDS.has(w) || w === def.label.toLowerCase()) return ok(true)
      if (FALSE_WORDS.has(w)) return ok(false)
      return bad('yesNo', 'Use yes / no')
    }
    case 'select': {
      if (t === '') return ok(null)
      const w = t.toLowerCase()
      const opt = (def.config.options || []).find(
        (o) => o.label.trim().toLowerCase() === w || o.id === t
      )
      return opt ? ok(opt.id) : bad('notOption', `“${t}” isn't an option`, t)
    }
    case 'date': {
      const d = parseDateText(t)
      return d === undefined ? bad('dateShape', 'Use a year, or YYYY-MM-DD') : ok(d)
    }
    case 'date_range': {
      if (t === '') return ok(null)
      const parts = splitRange(t, YEAR_HYPHEN)
      if (parts.length > 2) return bad('dateRangeShape', 'Use “from–to”')
      const from = parseDateText(parts[0])
      const to = parts.length === 2 ? parseDateText(parts[1]) : null
      if (from === undefined || to === undefined)
        return bad('dateRangeDates', 'Use dates, like “1950–1960”')
      return ok({ from, to })
    }
    default:
      return bad('notEditable', 'This trait type can’t be edited here yet')
  }
}

/** The cell's value as editable, round-trippable text (what the editor starts
 *  with and what Copy puts on the clipboard). Units are left off so a paste
 *  reads back exactly. Empty → ''. */
export function toCellText(def: FieldDef, value: unknown): string {
  if (value == null) return ''
  switch (def.type) {
    case 'text':
      return String(value)
    case 'boolean':
      return value === true ? 'TRUE' : value === false ? 'FALSE' : ''
    case 'number':
    case 'slider':
      return String(value)
    case 'number_range': {
      const { a, b } = value as { a: number | null; b: number | null }
      return a != null && a === b ? String(a) : `${a ?? ''}–${b ?? ''}`
    }
    case 'select': {
      const opt = (def.config.options || []).find((o) => o.id === value)
      return opt ? opt.label : ''
    }
    case 'date':
      return formatDate(value as DateValue)
    case 'date_range': {
      const { from, to } = value as { from: DateValue | null; to: DateValue | null }
      return `${formatDate(from)}–${formatDate(to)}`
    }
    default:
      return ''
  }
}

// ── Sorting ───────────────────────────────────────────────────────────────────

export type SortKey = number | string | null

/** A trait value's sort key: numbers for anything ordinal (dates by their
 *  ordinal, selects by option order, ranges by their low end), lowercase
 *  strings for text. null = empty (always sorts last). */
export function sortKeyOf(def: FieldDef, value: unknown): SortKey {
  if (value == null) return null
  switch (def.type) {
    case 'text':
      return String(value).trim() || null
    case 'boolean':
      return value === true ? 1 : 0
    case 'number':
    case 'slider':
      return value as number
    case 'number_range': {
      const { a, b } = value as { a: number | null; b: number | null }
      return a ?? b ?? null
    }
    case 'select': {
      const i = (def.config.options || []).findIndex((o) => o.id === value)
      return i < 0 ? null : i
    }
    case 'date':
      return toOrdinal(value as DateValue)
    case 'date_range': {
      const { from, to } = value as { from: DateValue | null; to: DateValue | null }
      return toOrdinal(from) ?? toOrdinal(to)
    }
    default:
      return null
  }
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export function compareKeys(a: SortKey, b: SortKey): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return collator.compare(String(a), String(b))
}

/** Stable sort by key; empties stay at the bottom in both directions (the
 *  spreadsheet convention), ties keep their incoming order. */
export function sortByKey<T>(items: T[], keyOf: (item: T) => SortKey, dir: 1 | -1): T[] {
  const rows = items.map((item, i) => ({ item, i, k: keyOf(item) }))
  rows.sort((x, y) => {
    const xe = x.k == null
    const ye = y.k == null
    if (xe || ye) return xe === ye ? x.i - y.i : xe ? 1 : -1
    return compareKeys(x.k as SortKey, y.k as SortKey) * dir || x.i - y.i
  })
  return rows.map((r) => r.item)
}

// ── Ranges ────────────────────────────────────────────────────────────────────

export interface CellPos {
  r: number
  c: number
}
export interface CellRange {
  r0: number
  r1: number
  c0: number
  c1: number
}

export function rangeOf(a: CellPos, b: CellPos): CellRange {
  return {
    r0: Math.min(a.r, b.r),
    r1: Math.max(a.r, b.r),
    c0: Math.min(a.c, b.c),
    c1: Math.max(a.c, b.c)
  }
}

export const inRange = (g: CellRange, r: number, c: number): boolean =>
  r >= g.r0 && r <= g.r1 && c >= g.c0 && c <= g.c1

export const clampPos = (p: CellPos, rows: number, cols: number): CellPos => ({
  r: Math.min(Math.max(0, rows - 1), Math.max(0, p.r)),
  c: Math.min(Math.max(0, cols - 1), Math.max(0, p.c))
})

/** Tab / Shift+Tab: step along the row, wrapping to the next / previous row. */
export function tabStep(p: CellPos, back: boolean, rows: number, cols: number): CellPos {
  if (!rows || !cols) return p
  let { r, c } = p
  c += back ? -1 : 1
  if (c >= cols) {
    c = 0
    r = Math.min(rows - 1, r + 1)
  } else if (c < 0) {
    c = cols - 1
    r = Math.max(0, r - 1)
  }
  return { r, c }
}

// ── Clipboard (TSV, Excel / Sheets compatible) ────────────────────────────────

const needsQuote = /[\t\n\r"]/

export function toTSV(grid: string[][]): string {
  return grid
    .map((row) =>
      row.map((cell) => (needsQuote.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join('\t')
    )
    .join('\n')
}

/** Parse clipboard text copied from a spreadsheet: tabs split cells, newlines
 *  split rows, double-quoted cells may contain either. One trailing newline
 *  (spreadsheets always add it) is dropped. */
export function parseTSV(text: string): string[][] {
  const src = String(text ?? '').replace(/\r\n?/g, '\n')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let i = 0
  let quoted = false
  let atCellStart = true
  while (i < src.length) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        quoted = false
        i++
        continue
      }
      cell += ch
      i++
      continue
    }
    if (ch === '"' && atCellStart) {
      quoted = true
      atCellStart = false
      i++
      continue
    }
    if (ch === '\t') {
      row.push(cell)
      cell = ''
      atCellStart = true
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      atCellStart = true
    } else {
      cell += ch
      atCellStart = false
    }
    i++
  }
  if (cell !== '' || row.length || !atCellStart) {
    row.push(cell)
    rows.push(row)
  }
  return rows.length ? rows : [['']]
}

/** Where a clipboard block lands, spreadsheet-style: a single copied cell
 *  fills the whole selection; a block tiles the selection when it divides it
 *  evenly; otherwise it pastes at its natural size from the selection's top-
 *  left. Columns past the edge are clipped; rows past the last one are
 *  reported as `rows` > what exists, so the caller can add new people. */
export function planPaste(
  clip: string[][],
  sel: CellRange,
  colCount: number
): { r0: number; c0: number; rows: number; cols: number; at: (dr: number, dc: number) => string } {
  const h = clip.length
  const w = Math.max(1, ...clip.map((r) => r.length))
  const selH = sel.r1 - sel.r0 + 1
  const selW = sel.c1 - sel.c0 + 1
  const tiles = (selH > h || selW > w) && selH % h === 0 && selW % w === 0
  const rows = tiles ? selH : h
  const cols = Math.max(0, Math.min(tiles ? selW : w, colCount - sel.c0))
  return {
    r0: sel.r0,
    c0: sel.c0,
    rows,
    cols,
    at: (dr, dc) => clip[dr % h]?.[dc % w] ?? ''
  }
}

/** Does this clipboard row look like a header — at least half its (non-empty)
 *  cells naming, in order, the columns it would land on? Lets a block copied
 *  with its header row paste as data only. */
export function isHeaderRow(row: string[], labels: string[]): boolean {
  const norm = (s: string): string => s.trim().toLowerCase()
  const cells = row.map(norm)
  const filled = cells.filter(Boolean).length
  if (!filled) return false
  let hits = 0
  cells.forEach((c, i) => {
    if (c && labels[i] != null && c === norm(labels[i])) hits++
  })
  return hits >= Math.max(1, Math.ceil(filled / 2))
}

// ── Selection summary (the status bar) ────────────────────────────────────────

export interface SelectionSummary {
  cells: number
  filled: number
  numeric: number
  sum: number
  avg: number | null
  min: number | null
  max: number | null
}

/** Excel's status-bar numbers: count of non-empty cells, and sum / average /
 *  min / max over the numeric ones. */
export function summarize(values: unknown[]): SelectionSummary {
  let filled = 0
  let numeric = 0
  let sum = 0
  let min: number | null = null
  let max: number | null = null
  for (const v of values) {
    if (v == null || v === '') continue
    filled++
    if (typeof v === 'number' && Number.isFinite(v)) {
      numeric++
      sum += v
      min = min == null ? v : Math.min(min, v)
      max = max == null ? v : Math.max(max, v)
    }
  }
  return {
    cells: values.length,
    filled,
    numeric,
    sum,
    avg: numeric ? sum / numeric : null,
    min,
    max
  }
}

/** A trait value as a number for the summary (numbers and sliders only). */
export function numericOf(def: FieldDef | null, value: unknown): number | null {
  if (!def || value == null) return null
  return def.type === 'number' || def.type === 'slider' ? (value as number) : null
}
