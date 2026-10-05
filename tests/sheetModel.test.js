import { describe, it, expect } from 'vitest'
import {
  DERIVED_KEYS,
  GUTTER_W,
  buildColumns,
  columnOffsets,
  clampWidth,
  parseDateText,
  parseNumberText,
  splitRange,
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
} from '../src/renderer/src/components/people/sheetModel'

// Pure model behind the Directory's Sheet medium (people/SheetView.vue).

const def = (over = {}) => ({
  id: over.id || 'f-' + (over.type || 'text'),
  project_id: 'p1',
  label: 'Trait',
  type: 'text',
  config: {},
  locked: true,
  order: 0,
  has_timeframe: false,
  slot: null,
  slot_order: 0,
  icon: '',
  unit: '',
  sys: '',
  created_at: '',
  updated_at: '',
  ...over
})
const Y = (year, month = null, day = null) => ({
  year,
  month,
  day,
  precision: day != null ? 'day' : month != null ? 'month' : 'year',
  calendar: 'gregorian'
})

describe('buildColumns', () => {
  const defs = [
    def({ id: 'occ', label: 'Occupation', order: 4 }),
    def({ id: 'last', label: 'Last', slot: 'name', slot_order: 1, order: 1 }),
    def({ id: 'first', label: 'First', slot: 'name', slot_order: 0, order: 0 }),
    def({ id: 'born', label: 'Birth', type: 'date', slot: 'birth', order: 2 }),
    def({ id: 'cal', label: 'Custom', type: 'custom_date', order: 5 })
  ]

  it('puts name traits first (frozen, in word order), then the rest, then derived', () => {
    const cols = buildColumns(defs, { groups: true })
    expect(cols.map((c) => c.key)).toEqual([
      'first',
      'last',
      'born',
      'occ',
      'cal',
      DERIVED_KEYS.age,
      DERIVED_KEYS.ties,
      DERIVED_KEYS.groups
    ])
    expect(cols.filter((c) => c.frozen).map((c) => c.key)).toEqual(['first', 'last'])
  })

  it('marks reserved types and derived columns read-only', () => {
    const cols = buildColumns(defs)
    const by = Object.fromEntries(cols.map((c) => [c.key, c]))
    expect(by.cal.editable).toBe(false)
    expect(by.occ.editable).toBe(true)
    expect(by[DERIVED_KEYS.age].editable).toBe(false)
    expect(by[DERIVED_KEYS.groups]).toBeUndefined() // groups off without the tags cap
  })

  it('applies saved widths (clamped) and hides columns', () => {
    const cols = buildColumns(defs, { widths: { occ: 5000, born: 10 }, hidden: ['last'] })
    const by = Object.fromEntries(cols.map((c) => [c.key, c]))
    expect(by.last).toBeUndefined()
    expect(by.occ.width).toBe(clampWidth(5000))
    expect(by.born.width).toBe(clampWidth(10))
  })

  it('columnOffsets lays columns out after the gutter and measures the frozen pane', () => {
    const cols = buildColumns(defs, { widths: { first: 100, last: 120, born: 90 } })
    const { lefts, frozenW, total } = columnOffsets(cols)
    expect(lefts[0]).toBe(GUTTER_W)
    expect(lefts[1]).toBe(GUTTER_W + 100)
    expect(frozenW).toBe(GUTTER_W + 220)
    expect(total).toBe(GUTTER_W + cols.reduce((s, c) => s + c.width, 0))
  })
})

describe('text parsing helpers', () => {
  it('parseDateText: year / month / day precision, BCE, and garbage', () => {
    expect(parseDateText('1950')).toEqual(Y(1950))
    expect(parseDateText('1950-06')).toEqual(Y(1950, 6))
    expect(parseDateText('1950/6/12')).toEqual(Y(1950, 6, 12))
    expect(parseDateText('-44')).toEqual(Y(-44))
    expect(parseDateText('2000-02-29')).toEqual(Y(2000, 2, 29))
    expect(parseDateText('')).toBeNull()
    expect(parseDateText('1950-13')).toBeUndefined()
    expect(parseDateText('1950-04-31')).toBeUndefined()
    expect(parseDateText('0')).toBeUndefined()
    expect(parseDateText('soon')).toBeUndefined()
  })

  it('parseNumberText: units, thousands commas, decimal commas', () => {
    expect(parseNumberText('42')).toBe(42)
    expect(parseNumberText('1,234.5')).toBe(1234.5)
    expect(parseNumberText('3,5')).toBe(3.5)
    expect(parseNumberText('180 cm', 'cm')).toBe(180)
    expect(parseNumberText('-2.5e3')).toBe(-2500)
    expect(parseNumberText('  ')).toBeNull()
    expect(parseNumberText('12abc')).toBeUndefined()
  })

  it('splitRange: explicit separators always, bare hyphens only when allowed', () => {
    expect(splitRange('10–20', null)).toEqual(['10', '20'])
    expect(splitRange('1950 to 1960', null)).toEqual(['1950', '1960'])
    expect(splitRange('a .. b', null)).toEqual(['a', 'b'])
    expect(splitRange('-5 - -3', null)).toEqual(['-5', '-3'])
    expect(splitRange('10-20', null)).toEqual(['10-20'])
    expect(splitRange('10-20', /^(\d+)-(\d+)$/)).toEqual(['10', '20'])
  })
})

describe('parseCellText ⇄ toCellText', () => {
  const cases = [
    [def({ type: 'text' }), 'Hello there', 'Hello there'],
    [def({ type: 'number' }), '1,200', 1200],
    [def({ type: 'number_range' }), '10–20', { a: 10, b: 20 }],
    [def({ type: 'number_range' }), '10-20', { a: 10, b: 20 }],
    [def({ type: 'number_range' }), '7', { a: 7, b: 7 }],
    [def({ type: 'boolean' }), 'yes', true],
    [def({ type: 'boolean' }), 'FALSE', false],
    [def({ type: 'date' }), '1912-06-23', Y(1912, 6, 23)],
    [def({ type: 'date_range' }), '1939–1945', { from: Y(1939), to: Y(1945) }],
    [def({ type: 'date_range' }), '1939-1945', { from: Y(1939), to: Y(1945) }],
    [def({ type: 'date_range' }), '–1945', { from: null, to: Y(1945) }]
  ]
  it.each(cases)('%# parses to the stored shape', (d, text, value) => {
    expect(parseCellText(d, text)).toEqual({ ok: true, value })
  })
  it.each(cases)('%# round-trips through toCellText', (d, _text, value) => {
    const again = parseCellText(d, toCellText(d, value))
    expect(again).toEqual({ ok: true, value })
  })

  it('select matches option labels case-insensitively (or ids) and rejects others', () => {
    const d = def({
      type: 'select',
      config: {
        options: [
          { id: 'm', label: 'Male' },
          { id: 'f', label: 'Female' }
        ]
      }
    })
    expect(parseCellText(d, ' female ')).toEqual({ ok: true, value: 'f' })
    expect(parseCellText(d, 'm')).toEqual({ ok: true, value: 'm' })
    expect(parseCellText(d, 'Other')).toMatchObject({ ok: false })
    expect(toCellText(d, 'f')).toBe('Female')
  })

  it('slider clamps into its range (shared coerceValue)', () => {
    const d = def({ type: 'slider', config: { min: 0, max: 10, step: 1 } })
    expect(parseCellText(d, '99')).toEqual({ ok: true, value: 10 })
  })

  it('empty text clears every type; bad text is an error, not a silent null', () => {
    for (const type of ['text', 'number', 'date', 'date_range', 'number_range', 'boolean']) {
      expect(parseCellText(def({ type }), '   ')).toEqual({ ok: true, value: null })
    }
    expect(parseCellText(def({ type: 'number' }), 'many')).toMatchObject({ ok: false })
    expect(parseCellText(def({ type: 'date' }), 'someday')).toMatchObject({ ok: false })
    expect(parseCellText(def({ type: 'boolean' }), 'perhaps')).toMatchObject({ ok: false })
    expect(parseCellText(def({ type: 'custom_date' }), '1')).toMatchObject({ ok: false })
  })

  it('a boolean also accepts its own label as "true"', () => {
    expect(parseCellText(def({ type: 'boolean', label: 'Knight' }), 'knight')).toEqual({
      ok: true,
      value: true
    })
  })
})

describe('sorting', () => {
  it('sortKeyOf orders dates by ordinal, selects by option order, text naturally', () => {
    const sel = def({ type: 'select', config: { options: [{ id: 'b' }, { id: 'a' }] } })
    expect(sortKeyOf(sel, 'a')).toBe(1)
    expect(sortKeyOf(def({ type: 'date' }), Y(1950, 7))).toBeGreaterThan(1950.4)
    expect(sortKeyOf(def({ type: 'number_range' }), { a: null, b: 4 })).toBe(4)
    expect(sortKeyOf(def({ type: 'text' }), '   ')).toBeNull()
  })

  it('sortByKey is stable, natural, and keeps empties last in both directions', () => {
    const items = [
      { n: 'item 10' },
      { n: null },
      { n: 'item 2' },
      { n: 'Item 2', tag: 'second' },
      { n: 'apple' }
    ]
    const asc = sortByKey(items, (x) => x.n, 1)
    expect(asc.map((x) => x.n)).toEqual(['apple', 'item 2', 'Item 2', 'item 10', null])
    expect(asc[2].tag).toBe('second') // tie keeps incoming order
    const desc = sortByKey(items, (x) => x.n, -1)
    expect(desc.map((x) => x.n)).toEqual(['item 10', 'item 2', 'Item 2', 'apple', null])
  })
})

describe('ranges & navigation', () => {
  it('rangeOf normalizes corners; inRange / clampPos behave', () => {
    const g = rangeOf({ r: 5, c: 1 }, { r: 2, c: 3 })
    expect(g).toEqual({ r0: 2, r1: 5, c0: 1, c1: 3 })
    expect(inRange(g, 3, 2)).toBe(true)
    expect(inRange(g, 6, 2)).toBe(false)
    expect(clampPos({ r: -3, c: 99 }, 10, 4)).toEqual({ r: 0, c: 3 })
  })

  it('tabStep wraps across rows and stops at the ends', () => {
    expect(tabStep({ r: 0, c: 3 }, false, 5, 4)).toEqual({ r: 1, c: 0 })
    expect(tabStep({ r: 1, c: 0 }, true, 5, 4)).toEqual({ r: 0, c: 3 })
    expect(tabStep({ r: 4, c: 3 }, false, 5, 4)).toEqual({ r: 4, c: 0 })
  })
})

describe('clipboard TSV', () => {
  it('quotes cells with tabs / newlines / quotes and parses them back', () => {
    const grid = [
      ['plain', 'has\ttab', 'say "hi"'],
      ['multi\nline', '', 'end']
    ]
    expect(parseTSV(toTSV(grid))).toEqual(grid)
  })

  it('handles CRLF, the trailing newline spreadsheets add, and a bare value', () => {
    expect(parseTSV('a\tb\r\nc\td\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd']
    ])
    expect(parseTSV('solo')).toEqual([['solo']])
    expect(parseTSV('')).toEqual([['']])
    expect(parseTSV('a\t\n')).toEqual([['a', '']])
  })
})

describe('planPaste', () => {
  const sel = (r0, c0, r1 = r0, c1 = c0) => ({ r0, r1, c0, c1 })

  it('pastes a block at its natural size from the selection corner', () => {
    const plan = planPaste(
      [
        ['a', 'b'],
        ['c', 'd']
      ],
      sel(3, 1),
      10
    )
    expect(plan).toMatchObject({ r0: 3, c0: 1, rows: 2, cols: 2 })
    expect(plan.at(1, 0)).toBe('c')
  })

  it('a single cell fills the whole selection', () => {
    const plan = planPaste([['x']], sel(0, 0, 4, 2), 10)
    expect(plan).toMatchObject({ rows: 5, cols: 3 })
    expect(plan.at(4, 2)).toBe('x')
  })

  it('tiles a block that divides the selection evenly', () => {
    const plan = planPaste([['a'], ['b']], sel(0, 0, 3, 0), 10)
    expect(plan.rows).toBe(4)
    expect([0, 1, 2, 3].map((r) => plan.at(r, 0))).toEqual(['a', 'b', 'a', 'b'])
  })

  it('clips columns past the edge but reports every row (overflow → new people)', () => {
    const plan = planPaste([['1', '2', '3']], sel(0, 8), 10)
    expect(plan.cols).toBe(2)
    const tall = planPaste([['a'], ['b'], ['c']], sel(9, 0), 10)
    expect(tall.rows).toBe(3)
  })

  it('isHeaderRow spots a copied header row by its labels', () => {
    expect(isHeaderRow(['Full name', 'Birth'], ['Full name', 'Birth', 'Death'])).toBe(true)
    expect(isHeaderRow(['full NAME', 'x'], ['Full name', 'Birth'])).toBe(true)
    expect(isHeaderRow(['Ada Lovelace', '1815'], ['Full name', 'Birth'])).toBe(false)
    expect(isHeaderRow(['', ''], ['Full name', 'Birth'])).toBe(false)
  })
})

describe('selection summary', () => {
  it('counts filled cells and sums the numeric ones', () => {
    expect(summarize([1, 2, null, 'x', 3.5, ''])).toEqual({
      cells: 6,
      filled: 4,
      numeric: 3,
      sum: 6.5,
      avg: 6.5 / 3,
      min: 1,
      max: 3.5
    })
    expect(summarize([null, 'x']).avg).toBeNull()
  })

  it('numericOf only reads numbers and sliders', () => {
    expect(numericOf(def({ type: 'number' }), 5)).toBe(5)
    expect(numericOf(def({ type: 'slider' }), 7)).toBe(7)
    expect(numericOf(def({ type: 'date' }), Y(1900))).toBeNull()
    expect(numericOf(null, 5)).toBeNull()
  })
})
