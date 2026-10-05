import { describe, it, expect } from 'vitest'
import {
  DIMS,
  MAX_SCENE,
  buildScenes,
  layoutHandscroll,
  landscapeFeatures,
  featuresIn,
  visibleRange,
  clampCam,
  progressOf,
  yearAt,
  tileRange,
  rollerRadius,
  cjkYear,
  surnameOf,
  roundelGlyph,
  colophonText,
  colophonSize,
  lifeSpan
} from '../src/renderer/src/components/people/handscrollLayout'

const roles = new Map([
  ['spouse', 'horizontal'],
  ['parent_child', 'vertical'],
  ['friends', 'none']
])
const P = (id, year, extra = {}) => ({
  id,
  name: extra.name ?? id,
  birth: year == null ? null : { year },
  ...extra
})
const R = (a, b, type) => ({ person_a_id: a, person_b_id: b, type })

describe('handscroll helpers', () => {
  it('writes years digit by digit in CJK numerals', () => {
    expect(cjkYear(1950)).toBe('一九五〇')
    expect(cjkYear(2008)).toBe('二〇〇八')
    expect(cjkYear(-221)).toBe('前二二一')
  })

  it('finds family names and roundel glyphs', () => {
    expect(surnameOf('James Anderson')).toBe('Anderson')
    expect(surnameOf('王明华')).toBe('王')
    expect(surnameOf('')).toBe('')
    expect(roundelGlyph('王明华')).toBe('王')
    expect(roundelGlyph('Ada Lovelace')).toBe('AL')
    expect(roundelGlyph('Ada')).toBe('AD')
    expect(roundelGlyph('')).toBe('?')
  })

  it('trims colophon text on a word boundary', () => {
    expect(colophonText('  short  bio ')).toBe('short bio')
    const long = 'word '.repeat(60)
    const t = colophonText(long, 50)
    expect(t.length).toBeLessThanOrEqual(51)
    expect(t.endsWith('…')).toBe(true)
    expect(colophonText(undefined)).toBe('')
  })

  it('sizes colophons to their text', () => {
    const short = colophonSize('Kept the ledger.')
    const long = colophonSize('word '.repeat(24))
    expect(long.h).toBeGreaterThan(short.h)
    expect(long.w).toBeGreaterThan(short.w)
    expect(colophonSize('x'.repeat(5000)).w).toBeLessThanOrEqual(DIMS.colophonW)
  })

  it('formats life spans', () => {
    expect(lifeSpan(P('a', 1900, { death: { year: 1970 } }))).toBe('1900 – 1970')
    expect(lifeSpan(P('a', 1900))).toBe('b. 1900')
    expect(lifeSpan(P('a', null))).toBe('')
  })
})

describe('buildScenes', () => {
  it('clusters couples and brings unattached children along', () => {
    const persons = [P('mum', 1950), P('dad', 1948), P('kid', 1975), P('solo', 1960)]
    const rels = [
      R('mum', 'dad', 'spouse'),
      R('dad', 'kid', 'parent_child'),
      R('mum', 'kid', 'parent_child')
    ]
    const scenes = buildScenes(persons, rels, roles)
    expect(scenes).toHaveLength(2)
    const fam = scenes[0]
    expect(fam.year).toBe(1948)
    expect(fam.members.map((m) => [m.p.id, m.role])).toEqual([
      ['dad', 'head'],
      ['mum', 'head'],
      ['kid', 'child']
    ])
    expect(scenes[1].members[0].p.id).toBe('solo')
  })

  it('never chains lineages: a child with children of their own heads a scene', () => {
    const persons = [P('g', 1900), P('p', 1930), P('c', 1960)]
    const rels = [R('g', 'p', 'parent_child'), R('p', 'c', 'parent_child')]
    const scenes = buildScenes(persons, rels, roles)
    // p has a child → stays a head; c is unattached → joins p.
    expect(scenes.map((s) => s.members.map((m) => m.p.id))).toEqual([['g'], ['p', 'c']])
  })

  it('accepts a plain-object role lookup and ignores unknown/self/outside edges', () => {
    const persons = [P('a', 1900), P('b', 1901)]
    const rels = [R('a', 'b', 'friends'), R('a', 'a', 'spouse'), R('a', 'zz', 'spouse')]
    const scenes = buildScenes(persons, rels, { spouse: 'horizontal' })
    expect(scenes).toHaveLength(2)
  })

  it('orders scenes by year with undated last, and shares surnames', () => {
    const persons = [
      P('x', null),
      P('y', 1990),
      P('a', 1900, { name: 'Ann Lee' }),
      P('b', 1902, { name: 'Bo Lee' })
    ]
    const scenes = buildScenes(persons, [R('a', 'b', 'spouse')], roles)
    expect(scenes.map((s) => s.year)).toEqual([1900, 1990, null])
    expect(scenes[0].surname).toBe('Lee')
  })

  it('splits oversized households', () => {
    const persons = Array.from({ length: MAX_SCENE + 3 }, (_, i) => P('p' + i, 1900 + i))
    const rels = persons.slice(1).map((p) => R('p0', p.id, 'spouse'))
    const scenes = buildScenes(persons, rels, roles)
    expect(scenes).toHaveLength(2)
    expect(scenes[0].members).toHaveLength(MAX_SCENE)
  })
})

describe('layoutHandscroll', () => {
  const persons = [
    P('a', 1900, { bio: 'Kept the ledger.' }),
    P('b', 1903),
    P('c', 1931),
    P('d', null)
  ]
  const L = layoutHandscroll(persons, [R('a', 'b', 'spouse')], roles)

  it('reads right-to-left: the title sits at the right end, the end panel at the left', () => {
    const title = L.items.find((i) => i.kind === 'title')
    const end = L.items.find((i) => i.kind === 'end')
    expect(title.x1).toBe(L.totalW)
    expect(end.x0).toBe(0)
    expect(end.count).toBe(4)
  })

  it('places everyone exactly once, earliest scenes furthest right', () => {
    const people = L.items.filter((i) => i.kind === 'person')
    expect(people.map((i) => i.p.id).sort()).toEqual(['a', 'b', 'c', 'd'])
    const x = Object.fromEntries(people.map((i) => [i.p.id, i.x]))
    expect(x.a).toBeGreaterThan(x.b) // same scene, the elder first (to the right)
    expect(x.b).toBeGreaterThan(x.c)
    expect(x.c).toBeGreaterThan(x.d) // undated last
    for (const it of people) {
      expect(it.y).toBeGreaterThan(0)
      expect(it.y).toBeLessThan(0.5)
    }
  })

  it('keeps items sorted, non-negative and within the scroll', () => {
    for (let i = 1; i < L.items.length; i++)
      expect(L.items[i].x0).toBeGreaterThanOrEqual(L.items[i - 1].x0)
    for (const it of L.items) {
      expect(it.x0).toBeGreaterThanOrEqual(0)
      expect(it.x1).toBeLessThanOrEqual(L.totalW)
      expect(it.x1 - it.x0).toBeLessThanOrEqual(L.maxItemW)
    }
  })

  it('adds decade inscriptions, an undated mark, and colophons for bios', () => {
    const markers = L.items.filter((i) => i.kind === 'marker').reverse() // reading order
    expect(markers.map((m) => m.label)).toEqual(['一九〇〇', '一九三〇', '年代不詳'])
    const colos = L.items.filter((i) => i.kind === 'colophon')
    expect(colos).toHaveLength(1)
    expect(colos[0].p.id).toBe('a')
    expect(colos[0].text).toBe('Kept the ledger.')
    expect(L.marks).toHaveLength(3)
    expect(L.marks[0].x).toBeGreaterThan(L.marks[1].x)
  })

  it('anchors map world x to the year in view', () => {
    expect(L.anchors[0].year).toBe(1900)
    expect(yearAt(L.anchors, L.totalW)).toBe(1900)
    expect(yearAt(L.anchors, L.anchors[1].x - 1)).toBe(1931)
    expect(yearAt(L.anchors, 0)).toBe(null)
  })

  it('lets time flow as space: a long gap is wider than a short one', () => {
    const near = layoutHandscroll([P('a', 1900), P('b', 1905)], [], roles)
    const far = layoutHandscroll([P('a', 1900), P('b', 1945)], [], roles)
    expect(far.totalW).toBeGreaterThan(near.totalW)
  })

  it('handles an empty roster', () => {
    const E = layoutHandscroll([], [], roles)
    expect(E.items.filter((i) => i.kind === 'person')).toHaveLength(0)
    expect(E.totalW).toBeGreaterThan(0)
  })

  it('scales to thousands of people', () => {
    const many = Array.from({ length: 3000 }, (_, i) => P('p' + i, 1700 + (i % 300)))
    const t0 = performance.now()
    const big = layoutHandscroll(many, [], roles)
    expect(performance.now() - t0).toBeLessThan(1500)
    expect(big.items.filter((i) => i.kind === 'person')).toHaveLength(3000)
  })
})

describe('handscroll windowing + camera', () => {
  const items = [
    { x0: 0, x1: 100 },
    { x0: 50, x1: 300 },
    { x0: 200, x1: 260 },
    { x0: 400, x1: 450 }
  ]
  it('finds the items overlapping a range', () => {
    const r = visibleRange(items, 210, 410, 250)
    expect(items.slice(r.start, r.end)).toEqual([items[1], items[2], items[3]])
    const none = visibleRange(items, 500, 600, 250)
    expect(none.end - none.start).toBe(0)
  })

  it('clamps the camera and reports progress from the right end', () => {
    expect(clampCam(5000, 3000, 800)).toBe(3000)
    expect(clampCam(10, 3000, 800)).toBe(800)
    expect(clampCam(10, 500, 800)).toBe(500) // shorter than the view
    expect(progressOf(3000, 3000, 800)).toBe(0)
    expect(progressOf(800, 3000, 800)).toBe(1)
    expect(progressOf(500, 500, 800)).toBe(0)
  })

  it('covers a range with tiles and sizes rollers by what is still wound', () => {
    expect(tileRange(0, DIMS.tile * 2 + 1)).toEqual({ first: 0, last: 2 })
    expect(rollerRadius(0, 1000)).toBe(9)
    expect(rollerRadius(1000, 1000)).toBe(22)
    expect(rollerRadius(250, 1000)).toBeCloseTo(15.5)
  })
})

describe('landscapeFeatures', () => {
  const spans = [
    { x0: 2000, x1: 2400, size: 3 },
    { x0: 1200, x1: 1500, size: 1 }
  ]
  it('is deterministic and covers the whole scroll', () => {
    const a = landscapeFeatures(3000, spans, 9)
    const b = landscapeFeatures(3000, spans, 9)
    expect(a).toEqual(b)
    const far = a.filter((f) => f.kind === 'range' && f.layer === 0)
    expect(Math.min(...far.map((f) => f.x0))).toBeLessThan(0)
    expect(Math.max(...far.map((f) => f.x1))).toBeGreaterThan(3000)
  })

  it('gives every scene a terrace and is sorted by layer', () => {
    const f = landscapeFeatures(3000, spans, 9)
    const terraces = f.filter((x) => x.kind === 'range' && x.layer === 2)
    expect(terraces).toHaveLength(2)
    for (let i = 1; i < f.length; i++) expect(f[i].layer).toBeGreaterThanOrEqual(f[i - 1].layer)
  })

  it('filters features to a tile', () => {
    const f = landscapeFeatures(3000, spans, 9)
    const inTile = featuresIn(f, 1024, 1536)
    expect(inTile.length).toBeGreaterThan(0)
    for (const x of inTile) {
      expect(x.x1).toBeGreaterThanOrEqual(1024)
      expect(x.x0).toBeLessThanOrEqual(1536)
    }
  })
})
