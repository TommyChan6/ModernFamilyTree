import { describe, it, expect } from 'vitest'
import {
  computeGenLayout,
  computeTreeOrder,
  NODE_GAP,
  SPOUSE_GAP,
  COMPONENT_GAP
} from '../src/renderer/src/components/graph/familyTreeLayout'
import { yearDate } from '../src/shared/calendarMath'

const W = 1200
const H = 800

const person = (id, gender, birth) => ({ id, gender, birth: yearDate(birth) })
const spouse = (a, b) => ({ id: `s:${a}:${b}`, type: 'spouse', person_a_id: a, person_b_id: b })
const child = (parent, kid, type = 'parent_child') => ({
  id: `c:${parent}:${kid}`,
  type,
  person_a_id: parent,
  person_b_id: kid
})

// dad + mom married, two kids
const nuclear = () => ({
  persons: [
    person('dad', 'male', 1950),
    person('mom', 'female', 1952),
    person('kid1', 'female', 1975),
    person('kid2', 'male', 1978)
  ],
  rels: [
    spouse('dad', 'mom'),
    child('dad', 'kid1'),
    child('mom', 'kid1'),
    child('dad', 'kid2'),
    child('mom', 'kid2')
  ]
})

describe('computeGenLayout — rows', () => {
  it('places parents above their children, spouses on the same row', () => {
    const { persons, rels } = nuclear()
    const { targets } = computeGenLayout(persons, rels, W, H)
    expect(targets.dad.y).toBe(targets.mom.y)
    expect(targets.kid1.y).toBeGreaterThan(targets.dad.y)
    expect(targets.kid1.y).toBe(targets.kid2.y)
  })

  it('pulls a married-in spouse without recorded parents onto the partner row', () => {
    const persons = [
      person('g', 'male', 1930),
      person('kid', 'female', 1955),
      person('inlaw', 'male', 1953)
    ]
    const rels = [child('g', 'kid'), spouse('kid', 'inlaw')]
    const { targets } = computeGenLayout(persons, rels, W, H)
    expect(targets.inlaw.y).toBe(targets.kid.y)
    expect(targets.kid.y).toBeGreaterThan(targets.g.y)
  })

  it('labels exactly the used generation rows', () => {
    const { persons, rels } = nuclear()
    const { genLabels, yMap, targets } = computeGenLayout(persons, rels, W, H)
    expect(genLabels).toHaveLength(2)
    expect(genLabels[0].y).toBeLessThan(genLabels[1].y)
    for (const p of persons) expect(yMap[p.id]).toBe(targets[p.id].y)
  })
})

describe('computeGenLayout — couples', () => {
  it('keeps married couples one spouse-gap apart, father on the left', () => {
    const { persons, rels } = nuclear()
    const { targets } = computeGenLayout(persons, rels, W, H)
    expect(Math.abs(targets.mom.x - targets.dad.x)).toBeCloseTo(SPOUSE_GAP, 5)
    expect(targets.dad.x).toBeLessThan(targets.mom.x)
  })

  it('centers children under their parents', () => {
    const { persons, rels } = nuclear()
    const { targets } = computeGenLayout(persons, rels, W, H)
    const mid = (targets.dad.x + targets.mom.x) / 2
    const kidsMid = (targets.kid1.x + targets.kid2.x) / 2
    expect(Math.abs(kidsMid - mid)).toBeLessThan(SPOUSE_GAP)
  })
})

describe('computeGenLayout — spacing', () => {
  it('keeps siblings at least a node-gap apart', () => {
    const persons = [
      person('dad', 'male', 1950),
      person('a', 'male', 1970),
      person('b', 'female', 1972),
      person('c', 'male', 1974)
    ]
    const rels = [child('dad', 'a'), child('dad', 'b'), child('dad', 'c')]
    const { targets } = computeGenLayout(persons, rels, W, H)
    const xs = ['a', 'b', 'c'].map((id) => targets[id].x).sort((p, q) => p - q)
    expect(xs[1] - xs[0]).toBeGreaterThanOrEqual(NODE_GAP - 1e-6)
    expect(xs[2] - xs[1]).toBeGreaterThanOrEqual(NODE_GAP - 1e-6)
  })

  it('lays out disconnected families side by side without overlap', () => {
    const persons = [
      person('a1', 'male', 1950),
      person('a2', 'female', 1975),
      person('b1', 'male', 1950),
      person('b2', 'female', 1975),
      person('b3', 'male', 1978)
    ]
    const rels = [child('a1', 'a2'), child('b1', 'b2'), child('b1', 'b3')]
    const { targets } = computeGenLayout(persons, rels, W, H)
    const aXs = ['a1', 'a2'].map((id) => targets[id].x)
    const bXs = ['b1', 'b2', 'b3'].map((id) => targets[id].x)
    const gap = Math.min(...aXs) - Math.max(...bXs) // b is bigger → placed first (left)
    expect(gap).toBeGreaterThanOrEqual(COMPONENT_GAP - 1e-6)
  })
})

describe('computeGenLayout — crossing avoidance', () => {
  it('keeps each branch of a three-generation family under its own parent', () => {
    // grandparents → two married children, each with a kid of their own
    const persons = [
      person('g1', 'male', 1920),
      person('g2', 'female', 1922),
      person('f1', 'male', 1945),
      person('f2', 'female', 1948),
      person('m1', 'female', 1946),
      person('m2', 'male', 1947),
      person('c1', 'male', 1970),
      person('c2', 'female', 1972)
    ]
    const rels = [
      spouse('g1', 'g2'),
      child('g1', 'f1'),
      child('g2', 'f1'),
      child('g1', 'f2'),
      child('g2', 'f2'),
      spouse('f1', 'm1'),
      spouse('f2', 'm2'),
      child('f1', 'c1'),
      child('m1', 'c1'),
      child('f2', 'c2'),
      child('m2', 'c2')
    ]
    const { targets } = computeGenLayout(persons, rels, W, H)
    // whichever side each couple ends on, the grandchildren must not cross over
    const mid1 = (targets.f1.x + targets.m1.x) / 2
    const mid2 = (targets.f2.x + targets.m2.x) / 2
    expect(Math.sign(targets.c1.x - targets.c2.x)).toBe(Math.sign(mid1 - mid2))
    expect(Math.abs(targets.c1.x - mid1)).toBeLessThan(Math.abs(targets.c1.x - mid2))
    expect(Math.abs(targets.c2.x - mid2)).toBeLessThan(Math.abs(targets.c2.x - mid1))
  })
})

describe('computeGenLayout — robustness', () => {
  it('is deterministic', () => {
    const { persons, rels } = nuclear()
    const a = computeGenLayout(persons, rels, W, H)
    const b = computeGenLayout(persons, rels, W, H)
    expect(a).toEqual(b)
  })

  it('handles empty data', () => {
    const r = computeGenLayout([], [], W, H)
    expect(r.targets).toEqual({})
    expect(r.genLabels).toEqual([])
  })

  it('survives a parent-child cycle without hanging', () => {
    const persons = [person('a', 'male', 1950), person('b', 'female', 1970)]
    const rels = [child('a', 'b'), child('b', 'a')]
    const { targets } = computeGenLayout(persons, rels, W, H)
    expect(Number.isFinite(targets.a.x)).toBe(true)
    expect(Number.isFinite(targets.b.y)).toBe(true)
  })

  it('ignores relationships that reference unknown people', () => {
    const persons = [person('a', 'male', 1950)]
    const rels = [child('a', 'ghost'), spouse('ghost', 'a')]
    const { targets, genLabels } = computeGenLayout(persons, rels, W, H)
    expect(Object.keys(targets)).toEqual(['a'])
    expect(genLabels).toHaveLength(1)
  })
})

describe('computeTreeOrder', () => {
  it('returns every person exactly once, in left-to-right layout order', () => {
    const { persons, rels } = nuclear()
    const order = computeTreeOrder(persons, rels)
    expect([...order].sort()).toEqual(persons.map((p) => p.id).sort())
    const { targets } = computeGenLayout(persons, rels, 2000, 1000)
    for (let i = 1; i < order.length; i++) {
      expect(targets[order[i]].x).toBeGreaterThanOrEqual(targets[order[i - 1]].x)
    }
  })
})
