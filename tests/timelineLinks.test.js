import { describe, it, expect } from 'vitest'
import {
  buildFamilies,
  isParentLink,
  laneCost,
  optimizeLaneOrder,
  packSproutLanes,
  branchCubic,
  branchDrop,
  sproutCubic,
  cubicPoint,
  cubicTAtX,
  bridgePieces,
  distToPolyline
} from '../src/renderer/src/components/timeline/timelineLinks'
import {
  computeTimelineLayout,
  computeLaneOrder
} from '../src/renderer/src/components/timeline/timelineLayout.js'
import { yearDate } from '../src/shared/calendarMath'

const life = (id, birthYear, endYear) => ({ id, birthYear, endYear })
const rel = (id, type, a, b) => ({ id, type, person_a_id: a, person_b_id: b })

describe('buildFamilies', () => {
  const people = [
    life('dad', 1900, 1970),
    life('mum', 1902, 1980),
    life('kid1', 1925, 2000),
    life('kid2', 1928, 2010),
    life('adoptee', 1930, 2005),
    life('stepdad', 1898, 1960)
  ]
  const marriages = [{ id: 'm', ids: ['dad', 'mum'], year: 1922 }]

  it('gives a couple one family and each child one branch', () => {
    const rels = [
      rel('r1', 'parent_child', 'dad', 'kid1'),
      rel('r2', 'parent_child', 'mum', 'kid1'),
      rel('r3', 'parent_child', 'dad', 'kid2'),
      rel('r4', 'parent_child', 'mum', 'kid2')
    ]
    const { families, branches } = buildFamilies(people, rels, marriages)
    expect(families).toHaveLength(1)
    expect(families[0].parents).toEqual(['dad', 'mum'])
    expect(families[0].children).toEqual(['kid1', 'kid2'])
    expect(families[0].marriageIdx).toBe(0)
    expect(families[0].firstYear).toBe(1925)
    expect(families[0].lastYear).toBe(1928)
    expect(branches).toHaveLength(2)
    expect(branches[0].ids).toEqual(['dad', 'mum', 'kid1'])
    expect(branches[0].relIds).toEqual(['r1', 'r2'])
    expect(branches.every((b) => b.primary)).toBe(true)
  })

  it('keeps an adoption as its own (dashed) family; the bio one stays primary', () => {
    const rels = [
      rel('r1', 'parent_child', 'dad', 'adoptee'),
      rel('r2', 'parent_child', 'mum', 'adoptee'),
      rel('r3', 'adopted', 'stepdad', 'adoptee')
    ]
    const { families, branches } = buildFamilies(people, rels, marriages)
    expect(families).toHaveLength(2)
    const adopt = branches.find((b) => b.adopted)
    const bio = branches.find((b) => !b.adopted)
    expect(adopt.parents).toEqual(['stepdad'])
    expect(adopt.primary).toBe(false)
    expect(bio.primary).toBe(true)
  })

  it('pairs a child’s many parents by marriage, the rest parent alone', () => {
    const rels = [
      rel('r1', 'parent_child', 'dad', 'kid1'),
      rel('r2', 'parent_child', 'mum', 'kid1'),
      rel('r3', 'parent_child', 'stepdad', 'kid1')
    ]
    const { families } = buildFamilies(people, rels, marriages)
    const sets = families.map((f) => f.parents.join('+')).sort()
    expect(sets).toEqual(['dad+mum', 'stepdad'])
  })

  it('ignores links to people not on the timeline', () => {
    const { branches } = buildFamilies(people, [rel('x', 'parent_child', 'ghost', 'kid1')], [])
    expect(branches).toHaveLength(0)
  })

  it('reads parent links from the registry roles when given', () => {
    const roles = new Map([
      ['parent_child', 'vertical'],
      ['godparent', 'vertical'],
      ['spouse', 'horizontal']
    ])
    expect(isParentLink('godparent', roles)).toBe(true)
    expect(isParentLink('spouse', roles)).toBe(false)
    expect(isParentLink('godparent')).toBe(false)
    expect(isParentLink('adopted')).toBe(true)
  })
})

describe('live-crossing lane order', () => {
  const people = [life('A', 1900, 1980), life('X', 1900, 2000), life('C', 1930, 2000)]
  const rels = [rel('r', 'parent_child', 'A', 'C')]

  it('only counts crossings over lives alive in that year', () => {
    const { branches } = buildFamilies(people, rels, [])
    const alive = laneCost(['A', 'X', 'C'], people, branches, [])
    const gone = [life('A', 1900, 1980), life('X', 1800, 1850), life('C', 1930, 2000)]
    const empty = laneCost(['A', 'X', 'C'], gone, branches, [])
    expect(alive).toBeCloseTo(1 + 0.12)
    expect(empty).toBeCloseTo(0.12) // only the length term: the lane was empty
  })

  it('moves a living bystander out from between a parent and child', () => {
    const { branches } = buildFamilies(people, rels, [])
    const order = optimizeLaneOrder(['A', 'X', 'C'], people, branches, [])
    expect(Math.abs(order.indexOf('A') - order.indexOf('C'))).toBe(1)
    expect(laneCost(order, people, branches, [])).toBeLessThan(
      laneCost(['A', 'X', 'C'], people, branches, [])
    )
  })

  it('keeps a child out from between its parents (their stem would run down its lane)', () => {
    const fam = [life('dad', 1975, 2026), life('kid', 2008, 2026), life('mum', 1977, 2026)]
    const marriages = [{ id: 'm', ids: ['dad', 'mum'], year: 2005 }]
    const r = [rel('a', 'parent_child', 'dad', 'kid'), rel('b', 'parent_child', 'mum', 'kid')]
    const { branches } = buildFamilies(fam, r, marriages)
    const order = optimizeLaneOrder(['dad', 'kid', 'mum'], fam, branches, marriages)
    expect(Math.abs(order.indexOf('dad') - order.indexOf('mum'))).toBe(1)
  })

  it('never makes an order worse and keeps off-timeline ids at the end', () => {
    const many = Array.from({ length: 12 }, (_, i) => life('p' + i, 1900 + i * 7, 1960 + i * 7))
    const marriages = [{ id: 'm', ids: ['p0', 'p5'], year: 1930 }]
    const r = [rel('a', 'parent_child', 'p0', 'p9'), rel('b', 'parent_child', 'p5', 'p9')]
    const { branches } = buildFamilies(many, r, marriages)
    const start = ['undated', ...many.map((p) => p.id).reverse()]
    const out = optimizeLaneOrder(start, many, branches, marriages)
    expect(out[out.length - 1]).toBe('undated')
    expect(new Set(out).size).toBe(start.length)
    expect(laneCost(out, many, branches, marriages)).toBeLessThanOrEqual(
      laneCost(start, many, branches, marriages)
    )
  })

  it('computeLaneOrder returns every person exactly once', () => {
    const persons = [
      { id: 'a', name: 'A', birth: yearDate(1900), death: yearDate(1970) },
      { id: 'b', name: 'B', birth: yearDate(1902), death: yearDate(1975) },
      { id: 'c', name: 'C', birth: yearDate(1930) },
      { id: 'u', name: 'U', birth: null }
    ]
    const r = [
      { ...rel('m', 'spouse', 'a', 'b'), formed: yearDate(1925) },
      rel('p', 'parent_child', 'a', 'c')
    ]
    const order = computeLaneOrder(persons, r, null, 2026)
    expect([...order].sort()).toEqual(['a', 'b', 'c', 'u'])
  })
})

describe('Sprout lane packing', () => {
  it('reuses a lane once its occupant is gone', () => {
    const people = [life('old', 1800, 1850), life('new', 1900, 1960)]
    const lanes = packSproutLanes(
      people,
      new Map([
        ['old', 0],
        ['new', 1]
      ]),
      [],
      []
    )
    expect(lanes.get('old')).toBe(lanes.get('new'))
  })

  it('never shares a lane between lives that overlap', () => {
    const people = Array.from({ length: 20 }, (_, i) => life('p' + i, 1900 + i * 4, 1950 + i * 4))
    const rank = new Map(people.map((p, i) => [p.id, i]))
    const lanes = packSproutLanes(people, rank, [], [], { margin: 2 })
    for (const a of people)
      for (const b of people) {
        if (a === b || lanes.get(a.id) !== lanes.get(b.id)) continue
        const apart = a.endYear + 2 <= b.birthYear || b.endYear + 2 <= a.birthYear
        expect(apart).toBe(true)
      }
    expect(Math.min(...lanes.values())).toBe(0)
  })

  it('seats children beside their parents and a spouse beside their partner', () => {
    const people = [
      life('dad', 1900, 1970),
      life('mum', 1901, 1975),
      life('kid', 1925, 2000),
      life('inlaw', 1924, 1995)
    ]
    const rels = [rel('a', 'parent_child', 'dad', 'kid'), rel('b', 'parent_child', 'mum', 'kid')]
    const marriages = [
      { id: 'm1', ids: ['dad', 'mum'], year: 1922 },
      { id: 'm2', ids: ['kid', 'inlaw'], year: 1950 }
    ]
    const { branches } = buildFamilies(people, rels, marriages)
    const rank = new Map(people.map((p, i) => [p.id, i]))
    const lanes = packSproutLanes(people, rank, branches, marriages)
    expect(Math.abs(lanes.get('dad') - lanes.get('mum'))).toBe(1)
    const stem = (lanes.get('dad') + lanes.get('mum')) / 2
    expect(Math.abs(lanes.get('kid') - stem)).toBeLessThanOrEqual(1.5)
    expect(Math.abs(lanes.get('kid') - lanes.get('inlaw'))).toBeLessThanOrEqual(2)
  })

  it('compacts a long line of descent in Sprout mode', () => {
    const persons = []
    const rels = []
    for (let g = 0; g < 10; g++) {
      persons.push({
        id: 'g' + g,
        name: 'G' + g,
        birth: yearDate(1500 + g * 30),
        death: yearDate(1500 + g * 30 + 50)
      })
      if (g) rels.push(rel('r' + g, 'parent_child', 'g' + (g - 1), 'g' + g))
    }
    const lanes = computeTimelineLayout(persons, rels, 2026, null, null, [], { mode: 'lanes' })
    const sprout = computeTimelineLayout(persons, rels, 2026, null, null, [], { mode: 'sprout' })
    expect(lanes.laneCount).toBe(10)
    expect(sprout.mode).toBe('sprout')
    expect(sprout.laneCount).toBeLessThan(4)
    expect(sprout.branches.every((b) => b.sprout)).toBe(true)
    expect(sprout.worldWBase).toBeLessThan(lanes.worldWBase)
  })
})

describe('family-line curves', () => {
  it('a branch leaves the stem and lands on the child at its birth y', () => {
    const c = branchCubic(100, 40, 400, 100)
    expect(cubicPoint(c, 0)).toEqual({ x: 100, y: 40 })
    expect(cubicPoint(c, 1)).toEqual({ x: 400, y: 100 })
    expect(branchDrop(600)).toBeGreaterThan(branchDrop(100))
    expect(branchDrop(1e6)).toBe(90)
  })

  it('a sprout runs from the stem down into the lane', () => {
    const c = sproutCubic(100, 50, 250, 40)
    expect(cubicPoint(c, 0)).toEqual({ x: 100, y: 50 })
    expect(cubicPoint(c, 1)).toEqual({ x: 250, y: 90 })
  })

  it('finds t for an x on a monotonic curve (either direction)', () => {
    for (const c of [branchCubic(0, 0, 300, 50), branchCubic(300, 0, 0, 50)]) {
      const t = cubicTAtX(c, 120)
      expect(cubicPoint(c, t).x).toBeCloseTo(120, 1)
    }
  })

  it('cuts a branch open around each lifeline it passes under', () => {
    const c = branchCubic(0, 0, 400, 60)
    expect(bridgePieces(c, [])).toEqual([[0, 1]])
    const pieces = bridgePieces(c, [{ x: 200, half: 6 }])
    expect(pieces).toHaveLength(2)
    const gapStart = cubicPoint(c, pieces[0][1]).x
    const gapEnd = cubicPoint(c, pieces[1][0]).x
    expect(gapStart).toBeCloseTo(194, 0)
    expect(gapEnd).toBeCloseTo(206, 0)
    // lifelines at the branch's own ends are never cut
    expect(
      bridgePieces(c, [
        { x: 3, half: 6 },
        { x: 398, half: 6 }
      ])
    ).toEqual([[0, 1]])
    // overlapping gaps merge
    expect(
      bridgePieces(c, [
        { x: 200, half: 6 },
        { x: 204, half: 6 }
      ])
    ).toHaveLength(2)
  })

  it('caps the number of pieces', () => {
    const c = branchCubic(0, 0, 2000, 60)
    const many = Array.from({ length: 60 }, (_, i) => ({ x: 30 + i * 30, half: 5 }))
    expect(bridgePieces(c, many, 8).length).toBeLessThanOrEqual(8)
  })

  it('measures the distance to a sampled polyline', () => {
    const pts = new Float32Array([0, 0, 10, 0, 10, 10])
    expect(distToPolyline(pts, 0, 3, 5, 3)).toBeCloseTo(3)
    expect(distToPolyline(pts, 0, 3, 14, 5)).toBeCloseTo(4)
  })
})
