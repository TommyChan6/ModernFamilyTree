import { describe, it, expect } from 'vitest'
import {
  chineseYear,
  chineseNumber,
  ganzhi,
  hasCjk,
  inscription,
  monogramChar,
  chunk,
  columnsFor,
  packColumns,
  packText,
  familySketch,
  SKETCH_CAPS
} from '../src/renderer/src/components/profile/scrollModel.ts'

describe('Chinese numerals', () => {
  it('writes years digit by digit', () => {
    expect(chineseYear(1902)).toBe('一九〇二')
    expect(chineseYear(2008)).toBe('二〇〇八')
    expect(chineseYear(-221)).toBe('前二二一')
  })
  it('writes cardinals', () => {
    expect(chineseNumber(0)).toBe('〇')
    expect(chineseNumber(7)).toBe('七')
    expect(chineseNumber(10)).toBe('十')
    expect(chineseNumber(15)).toBe('十五')
    expect(chineseNumber(20)).toBe('二十')
    expect(chineseNumber(76)).toBe('七十六')
    expect(chineseNumber(100)).toBe('一百')
    expect(chineseNumber(105)).toBe('一百零五')
    expect(chineseNumber(2008)).toBe('二千零八')
  })
  it('names years in the sexagenary cycle', () => {
    expect(ganzhi(1984)).toBe('甲子')
    expect(ganzhi(1902)).toBe('壬寅')
    expect(ganzhi(2008)).toBe('戊子')
    expect(ganzhi(2044)).toBe('甲子')
    expect(ganzhi(-1)).toBe(ganzhi(59))
  })
})

describe('identity text', () => {
  it('detects CJK names and picks a monogram', () => {
    expect(hasCjk('李清照')).toBe(true)
    expect(hasCjk('Olivia Anderson')).toBe(false)
    expect(monogramChar('李清照')).toBe('李')
    expect(monogramChar('olivia')).toBe('O')
    expect(monogramChar('')).toBe('?')
  })
  it('builds the vertical inscription', () => {
    expect(inscription({ birthYear: 1902, deathYear: 1978, age: 76 })).toEqual([
      '壬寅年生',
      '戊午年卒　享年七十六'
    ])
    expect(inscription({ birthYear: 2008, age: 18 })).toEqual(['戊子年生', '今年十八岁'])
    expect(inscription({})).toEqual(['生卒无考'])
  })
})

describe('leaf packing', () => {
  it('chunks and counts columns', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 3)).toEqual([])
    expect(chunk([1, 2], 0)).toEqual([[1, 2]])
    expect(columnsFor(1000, 500)).toBe(3)
    expect(columnsFor(0, 500)).toBe(1)
  })
  it('packs items greedily into columns', () => {
    expect(packColumns([100, 100, 100, 100], 250)).toEqual([
      [0, 1],
      [2, 3]
    ])
    // an item taller than a column still gets one
    expect(packColumns([400, 50], 250)).toEqual([[0], [1]])
    expect(packColumns([100, 100, 100], Infinity)).toEqual([[0, 1, 2]])
    expect(packColumns([], 100)).toEqual([])
  })
  it('splits text by paragraph and sentence, never mid-sentence', () => {
    const s = 'One two three four five six seven. '
    const text = s.repeat(20) + '\n\n' + 'Second paragraph here.'
    const cols = packText(text, 200, 300)
    expect(cols.length).toBeGreaterThan(1)
    const joined = cols.flat().join(' ')
    expect(joined.replace(/\s+/g, ' ')).toContain('Second paragraph here.')
    for (const col of cols) for (const p of col) expect(p.trim().endsWith('.')).toBe(true)
    expect(packText(text, Infinity, 300)).toEqual([[s.repeat(20).trim(), 'Second paragraph here.']])
    expect(packText('', 200, 300)).toEqual([])
  })
})

describe('family sketch', () => {
  const chip = (otherId, side, extra = {}) => ({
    otherId,
    name: otherId,
    role: side,
    side,
    ...extra
  })

  it('returns null without family', () => {
    expect(familySketch([])).toBeNull()
    expect(familySketch([chip('x', null)])).toBeNull()
  })
  it('places parents above, children below, spouses right, siblings left', () => {
    const sk = familySketch([
      chip('dad', 'parent'),
      chip('mum', 'parent'),
      chip('sis', 'sibling'),
      chip('wife', 'spouse'),
      chip('kid', 'child')
    ])
    const at = (id) => sk.nodes.find((n) => n.otherId === id)
    expect(at('dad').y).toBeLessThan(sk.center.y)
    expect(at('kid').y).toBeGreaterThan(sk.center.y)
    expect(at('wife').x).toBeGreaterThan(sk.center.x)
    expect(at('sis').x).toBeLessThan(sk.center.x)
    expect(at('wife').y).toBe(sk.center.y)
    // everything inside the box
    for (const n of sk.nodes) {
      expect(n.x).toBeGreaterThan(0)
      expect(n.y).toBeGreaterThan(0)
      expect(n.x).toBeLessThan(sk.w)
      expect(n.y).toBeLessThan(sk.h)
    }
    for (const l of sk.lines) expect(l.length).toBeGreaterThanOrEqual(2)
  })
  it('dedupes per side and caps with a +N count', () => {
    const kids = Array.from({ length: 9 }, (_, i) => chip('k' + i, 'child'))
    const sk = familySketch([...kids, chip('k0', 'child')])
    expect(sk.nodes.filter((n) => n.side === 'child')).toHaveLength(SKETCH_CAPS.child)
    expect(sk.more.child).toBe(9 - SKETCH_CAPS.child)
  })
  it('draws an ended marriage with a single stroke', () => {
    const live = familySketch([chip('w', 'spouse')])
    const ended = familySketch([chip('w', 'spouse', { ended: true })])
    expect(ended.lines.length).toBe(live.lines.length - 1)
  })
})
