import { describe, it, expect } from 'vitest'
import {
  symbolCandidates,
  assignSymbols,
  generationsOf,
  groupOf,
  layoutTable,
  visibleRange,
  COL_PITCH,
  ROW_PITCH,
  PAD
} from '../src/renderer/src/components/people/elementsLayout.js'

const people = (names) => names.map((name, i) => ({ id: 'p' + i, name }))

describe('symbolCandidates', () => {
  it('prefers first+second letter, then the last-name initial', () => {
    const c = symbolCandidates('John Smith')
    expect(c[0]).toBe('Jo')
    expect(c[1]).toBe('Js')
    expect(c.every((s) => s[0] === 'J')).toBe(true)
    // own-letter triples come before arbitrary a–z pairs
    expect(c.indexOf('Jhn')).toBeGreaterThan(-1)
    expect(c.indexOf('Jhn')).toBeLessThan(c.indexOf('Jq'))
  })
  it('strips diacritics and handles caseless scripts and blanks', () => {
    expect(symbolCandidates('Émile')[0]).toBe('Em')
    expect(symbolCandidates('王小明')[0]).toBe('王')
    expect(symbolCandidates('')[0]).toBe('Xx')
    expect(symbolCandidates('Q')).toContain('Q')
  })
})

describe('assignSymbols', () => {
  it('gives every person a unique symbol', () => {
    const list = people([
      'John Smith',
      'Joan Smith',
      'Joseph Stone',
      'Jo',
      'Jo',
      'Jo',
      'Anna',
      'Anne',
      'Ann',
      '',
      ''
    ])
    const syms = assignSymbols(list)
    const values = [...syms.values()]
    expect(new Set(values).size).toBe(list.length)
    expect(syms.get('p0')).toBe('Jo')
    expect(syms.get('p1')).toBe('Js')
  })
  it('stays unique across hundreds of identical names (digits kick in)', () => {
    const list = people(Array.from({ length: 300 }, () => 'Test Person'))
    const values = [...assignSymbols(list).values()]
    expect(new Set(values).size).toBe(300)
    expect(values).toContain('Te2')
  })
  it('is deterministic for the same roster order', () => {
    const list = people(['Mary Lee', 'Mark Lee', 'Max', 'Mia'])
    expect([...assignSymbols(list)]).toEqual([...assignSymbols(list)])
  })
})

describe('generationsOf', () => {
  const roles = new Map([
    ['parent_child', 'vertical'],
    ['spouse', 'horizontal'],
    ['friends', 'none']
  ])
  const rel = (a, b, type) => ({ person_a_id: a, person_b_id: b, type })

  it('counts depth from roots and aligns married-in spouses', () => {
    const list = people(['A', 'B', 'C', 'D', 'E', 'F'])
    const rels = [
      rel('p0', 'p1', 'parent_child'), // A → B
      rel('p1', 'p2', 'parent_child'), // B → C
      rel('p3', 'p1', 'spouse'), // D married B (no parents)
      rel('p3', 'p2', 'parent_child'), // D → C
      rel('p4', 'p0', 'friends') // E is decorative
    ]
    const g = generationsOf(list, rels, roles)
    expect(g.get('p0')).toBe(1)
    expect(g.get('p1')).toBe(2)
    expect(g.get('p3')).toBe(2)
    expect(g.get('p2')).toBe(3)
    expect(g.get('p4')).toBe(1)
    expect(g.get('p5')).toBe(1)
  })
  it('takes the deepest parent and survives cycles', () => {
    const list = people(['A', 'B', 'C', 'X', 'Y'])
    const rels = [
      rel('p0', 'p1', 'parent_child'),
      rel('p1', 'p2', 'parent_child'),
      rel('p0', 'p2', 'parent_child'),
      rel('p3', 'p4', 'parent_child'),
      rel('p4', 'p3', 'parent_child')
    ]
    const g = generationsOf(list, rels, roles)
    expect(g.get('p2')).toBe(3)
    expect(g.get('p3')).toBeGreaterThanOrEqual(1)
    expect(g.get('p4')).toBeGreaterThanOrEqual(1)
  })
})

describe('layoutTable', () => {
  const list = [
    { id: 'a', birth: { year: 1952 } },
    { id: 'b', birth: { year: 1931 } },
    { id: 'c', birth: null },
    { id: 'd', birth: { year: 1958 } },
    { id: 'e', birth: { year: 1935 } }
  ]
  const keyOf = (p) => groupOf(p, 'decade')

  it('sorts decade columns ascending with unknowns trailing', () => {
    const t = layoutTable(list, keyOf)
    expect(t.columns.map((c) => c.label)).toEqual(['1930s', '1950s', '?'])
    expect(t.columns[0].ids).toEqual(['b', 'e'])
    expect(t.columns[2].ids).toEqual(['c'])
  })
  it('stacks rows in roster order at pitch-spaced cells', () => {
    const t = layoutTable(list, keyOf)
    expect(t.cells.get('b')).toEqual({ col: 0, row: 0, x: PAD, y: PAD })
    expect(t.cells.get('e')).toEqual({ col: 0, row: 1, x: PAD, y: PAD + ROW_PITCH })
    expect(t.cells.get('d')).toEqual({ col: 1, row: 1, x: PAD + COL_PITCH, y: PAD + ROW_PITCH })
    expect(t.maxRows).toBe(2)
  })
  it('groups by first tag and by generation', () => {
    const tagsOf = new Map([
      ['a', [{ id: 't1', label: 'Zeta', color: '#f00' }]],
      ['b', [{ id: 't2', label: 'Alpha', color: '#0f0' }]]
    ])
    const t = layoutTable(list, (p) => groupOf(p, 'tag', { tagsOf }))
    expect(t.columns.map((c) => c.label)).toEqual(['Alpha', 'Zeta', '?'])
    const gens = new Map([
      ['a', 2],
      ['b', 1]
    ])
    const g = layoutTable(list, (p) => groupOf(p, 'generation', { gens }))
    expect(g.columns.map((c) => c.label)).toEqual(['Gen 1', 'Gen 2', '?'])
  })
})

describe('visibleRange', () => {
  it('clamps to the track and adds overscan', () => {
    expect(visibleRange(0, 200, PAD, ROW_PITCH, 100, 1)).toEqual([0, 3])
    expect(visibleRange(ROW_PITCH * 50, 200, PAD, ROW_PITCH, 100, 1)[0]).toBe(48)
    const [f, l] = visibleRange(1e6, 200, PAD, ROW_PITCH, 10, 1) // scrolled past the end
    expect(f > l).toBe(true) // → an empty window, never out of bounds
    expect(visibleRange(0, 200, PAD, ROW_PITCH, 0)).toEqual([0, -1])
  })
})
