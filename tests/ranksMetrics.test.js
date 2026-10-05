import { describe, it, expect } from 'vitest'
import {
  METRICS,
  unitFor,
  buildLineage,
  descendantCounts,
  ancestorDepths,
  siblingCounts,
  metricValues,
  rankEntries
} from '../src/renderer/src/components/people/ranksMetrics.js'

const roles = new Map([
  ['parent_child', 'vertical'],
  ['adopted', 'vertical'],
  ['spouse', 'horizontal'],
  ['sibling', 'none'],
  ['friends', 'none']
])
const rel = (a, b, type = 'parent_child') => ({
  id: a + b + type,
  person_a_id: a,
  person_b_id: b,
  type
})

// g ─┬─ p1 ─┬─ c1
//    │      └─ c2 ── gc
//    └─ p2 ─── c3
const tree = [
  rel('g', 'p1'),
  rel('g', 'p2'),
  rel('p1', 'c1'),
  rel('p1', 'c2'),
  rel('p2', 'c3', 'adopted'),
  rel('c2', 'gc'),
  rel('p1', 'p2', 'friends'),
  rel('c1', 'x', 'spouse')
]
const ids = ['g', 'p1', 'p2', 'c1', 'c2', 'c3', 'gc', 'x']

describe('ranksMetrics — lineage', () => {
  it('builds parent/child adjacency from vertical edges only', () => {
    const { childrenOf, parentsOf } = buildLineage(tree, roles)
    expect([...childrenOf.get('g')].sort()).toEqual(['p1', 'p2'])
    expect([...parentsOf.get('c3')]).toEqual(['p2'])
    expect(childrenOf.has('c1')).toBe(false) // spouse edge ignored
    expect(parentsOf.has('p2')).toBe(true)
    expect([...parentsOf.get('p2')]).toEqual(['g']) // friends edge ignored
  })

  it('counts distinct descendants through every generation', () => {
    const { childrenOf } = buildLineage(tree, roles)
    const d = descendantCounts(ids, childrenOf)
    expect(d.get('g')).toBe(6)
    expect(d.get('p1')).toBe(3)
    expect(d.get('p2')).toBe(1)
    expect(d.get('gc')).toBe(0)
    expect(d.get('x')).toBe(0)
  })

  it('does not double count a descendant reachable by two paths', () => {
    // a → b, a → c, b → d, c → d (d reachable twice)
    const r = [rel('a', 'b'), rel('a', 'c'), rel('b', 'd'), rel('c', 'd')]
    const { childrenOf } = buildLineage(r, roles)
    expect(descendantCounts(['a'], childrenOf).get('a')).toBe(3)
  })

  it('measures the longest ancestor chain', () => {
    const { parentsOf } = buildLineage(tree, roles)
    const d = ancestorDepths(ids, parentsOf)
    expect(d.get('g')).toBe(0)
    expect(d.get('p1')).toBe(1)
    expect(d.get('c3')).toBe(2)
    expect(d.get('gc')).toBe(3)
    expect(d.get('x')).toBe(0)
  })

  it('terminates on cyclic parent data and never counts a person as their own descendant', () => {
    const cyc = [rel('a', 'b'), rel('b', 'c'), rel('c', 'a'), rel('c', 'd'), rel('e', 'e')]
    const { childrenOf, parentsOf } = buildLineage(cyc, roles)
    const all = ['a', 'b', 'c', 'd', 'e']
    const desc = descendantCounts(all, childrenOf)
    expect(desc.get('a')).toBe(3) // b, c, d — not a itself
    expect(desc.get('e')).toBe(0) // self-loop dropped
    const depth = ancestorDepths(all, parentsOf)
    for (const id of all) expect(Number.isFinite(depth.get(id))).toBe(true)
    expect(depth.get('d')).toBeGreaterThanOrEqual(1)
  })

  it('handles a very deep line without recursion limits', () => {
    const r = []
    for (let i = 0; i < 20000; i++) r.push(rel('n' + i, 'n' + (i + 1)))
    const { parentsOf } = buildLineage(r, roles)
    expect(ancestorDepths(['n20000'], parentsOf).get('n20000')).toBe(20000)
  })

  it('counts siblings from shared parents plus explicit sibling rows', () => {
    const r = [...tree, rel('c3', 'gc', 'sibling'), rel('c1', 'c2', 'sibling')]
    const s = siblingCounts(ids, r, roles)
    expect(s.get('c1')).toBe(1) // c2 (explicit row is a duplicate)
    expect(s.get('p1')).toBe(1) // p2
    expect(s.get('c3')).toBe(1) // explicit gc
    expect(s.get('gc')).toBe(1)
    expect(s.get('g')).toBe(0)
  })
})

describe('ranksMetrics — metricValues', () => {
  const persons = [
    { id: 'a', birth: { year: 1900 }, death: { year: 1980 } },
    { id: 'b', birth: { year: 1950 }, death: null },
    { id: 'c', birth: null, death: null }
  ]
  const stats = { a: { kin: 4, children: 2 }, b: { kin: 1, children: 0 } }
  const ctx = {
    statsOf: (id) => stats[id] || { kin: 0, children: 0 },
    refYear: 2000,
    relationships: [rel('a', 'b')],
    roleOf: roles
  }

  it('age caps at death and is null without a birth', () => {
    const v = metricValues('age', persons, ctx)
    expect(v.get('a')).toBe(80)
    expect(v.get('b')).toBe(50)
    expect(v.get('c')).toBeNull()
  })

  it('reads connections and children from statsOf', () => {
    expect(metricValues('connections', persons, ctx).get('a')).toBe(4)
    expect(metricValues('children', persons, ctx).get('b')).toBe(0)
    expect(metricValues('children', persons, ctx).get('c')).toBe(0)
  })

  it('computes graph metrics for every metric id', () => {
    for (const m of METRICS) {
      const v = metricValues(m.id, persons, ctx)
      expect(v.size).toBe(3)
    }
    expect(metricValues('descendants', persons, ctx).get('a')).toBe(1)
    expect(metricValues('depth', persons, ctx).get('b')).toBe(1)
  })

  it('pluralizes units', () => {
    const age = METRICS.find((m) => m.id === 'age')
    expect(unitFor(age, 1)).toBe('yr')
    expect(unitFor(age, 2)).toBe('yrs')
  })
})

describe('ranksMetrics — rankEntries', () => {
  it('uses standard competition ranking for ties (1, 2, 2, 4)', () => {
    const v = new Map([
      ['a', 10],
      ['b', 7],
      ['c', 7],
      ['d', 3]
    ])
    const { ranked, unranked, max } = rankEntries(['d', 'c', 'b', 'a'], v)
    expect(ranked.map((e) => [e.id, e.rank])).toEqual([
      ['a', 1],
      ['c', 2], // tie keeps the incoming order: c before b
      ['b', 2],
      ['d', 4]
    ])
    expect(ranked.map((e) => e.tied)).toEqual([false, true, true, false])
    expect(unranked).toEqual([])
    expect(max).toBe(10)
  })

  it('sends missing values to the unranked tail in incoming order', () => {
    const v = new Map([
      ['a', null],
      ['b', 5],
      ['c', undefined],
      ['d', NaN],
      ['e', 0]
    ])
    const r = rankEntries(['a', 'b', 'c', 'd', 'e'], v)
    expect(r.ranked.map((e) => e.id)).toEqual(['b', 'e'])
    expect(r.unranked).toEqual(['a', 'c', 'd'])
  })

  it('treats zero as no score when zeroIsNone is set', () => {
    const v = new Map([
      ['a', 0],
      ['b', 2],
      ['c', 0]
    ])
    const r = rankEntries(['a', 'b', 'c'], v, { zeroIsNone: true })
    expect(r.ranked.map((e) => e.id)).toEqual(['b'])
    expect(r.unranked).toEqual(['a', 'c'])
  })

  it('handles an all-tied field and an empty roster', () => {
    const v = new Map([
      ['a', 1],
      ['b', 1],
      ['c', 1]
    ])
    expect(rankEntries(['a', 'b', 'c'], v).ranked.map((e) => e.rank)).toEqual([1, 1, 1])
    expect(rankEntries([], new Map())).toEqual({ ranked: [], unranked: [], max: 0 })
  })
})
