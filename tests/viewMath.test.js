import { describe, it, expect } from 'vitest'
import { computeTimelineLayout, lifeEnd, LANE_W, X0 } from '../src/renderer/src/components/timeline/timelineLayout.js'
import { membershipArcSpans } from '../src/renderer/src/components/factions/factionLayout.js'
import {
  columnCount, gridHeight, rowWindow, ageOf, isDeceased,
  CARD_W, GAP, PAD, ROW_H,
} from '../src/renderer/src/components/people/peopleLayout.js'
import { latestDataYear } from '../src/renderer/src/store/currentYear.js'

const REF = 2026

function person(id, name, birth, extra = {}) {
  return { id, name, birth_year: birth, ...extra }
}

describe('computeTimelineLayout', () => {
  const persons = [
    person('a', 'Alice', 1950),
    person('b', 'Bob', 1948, { death_year: 2000 }),
    person('c', 'Carol', 1975),
    person('u', 'Undated', null),
  ]
  const relationships = [
    { id: 'm1', type: 'spouse', person_a_id: 'a', person_b_id: 'b', formed_date: '1970', status: 'active' },
    { id: 'p1', type: 'parent_child', person_a_id: 'a', person_b_id: 'c' },
  ]

  it('places only dated people, one lane apart', () => {
    const L = computeTimelineLayout(persons, relationships, REF)
    expect(L.people).toHaveLength(3)
    expect(L.undatedCount).toBe(1)
    const xs = L.people.map(p => p.laneX).sort((x, y) => x - y)
    expect(xs[0]).toBe(X0)
    expect(xs[1] - xs[0]).toBe(LANE_W)
    expect(xs[2] - xs[1]).toBe(LANE_W)
  })

  it('caps a life at the death year and marks the person dead', () => {
    const L = computeTimelineLayout(persons, relationships, REF)
    const bob = L.people.find(p => p.id === 'b')
    expect(bob.dead).toBe(true)
    expect(bob.endYear).toBe(2000)
    const alice = L.people.find(p => p.id === 'a')
    expect(alice.dead).toBe(false)
    expect(alice.endYear).toBe(REF)
  })

  it('spans the year range across births, deaths and marriage dates', () => {
    const L = computeTimelineLayout(persons, relationships, REF)
    expect(L.minYear).toBe(1948)
    expect(L.maxYear).toBe(REF)
    expect(L.yearSpan).toBe(REF - 1948)
  })

  it('builds a dated marriage connector with a badge', () => {
    const L = computeTimelineLayout(persons, relationships, REF)
    expect(L.marriages).toHaveLength(1)
    const m = L.marriages[0]
    expect(m.year).toBe(1970)
    expect(m.estimated).toBe(false)
    expect(m.badge).toContain('1970')
    expect(m.laneX1).toBeLessThan(m.laneX2)
  })

  it('estimates a plausible year for undated marriages', () => {
    const rels = [{ id: 'm2', type: 'spouse', person_a_id: 'a', person_b_id: 'c', status: 'active' }]
    const L = computeTimelineLayout(persons, rels, REF)
    const m = L.marriages[0]
    expect(m.estimated).toBe(true)
    expect(m.realYear).toBeNull()
    // inside the shared lifespan: after the younger birth, before either life ends
    expect(m.year).toBeGreaterThanOrEqual(1975)
    expect(m.year).toBeLessThanOrEqual(REF)
  })

  it('anchors birth connectors at the child birth year', () => {
    const L = computeTimelineLayout(persons, relationships, REF)
    expect(L.births).toHaveLength(1)
    expect(L.births[0].year).toBe(1975)
    expect(L.births[0].adopted).toBe(false)
  })

  it('skips connectors whose people are not on the timeline', () => {
    const rels = [{ id: 'p2', type: 'parent_child', person_a_id: 'u', person_b_id: 'c' }]
    const L = computeTimelineLayout(persons, rels, REF)
    expect(L.births).toHaveLength(0)
  })
})

describe('lifeEnd', () => {
  it('uses the death year when it is in the past, else the reference year', () => {
    expect(lifeEnd({ death_year: 1990 }, REF)).toBe(1990)
    expect(lifeEnd({ death_year: 2100 }, REF)).toBe(REF)
    expect(lifeEnd({}, REF)).toBe(REF)
  })
})

describe('membershipArcSpans', () => {
  it('returns nothing for zero memberships', () => {
    expect(membershipArcSpans(0)).toEqual([])
  })

  it('renders a lone membership as a near-full circle', () => {
    const [s] = membershipArcSpans(1)
    expect(s.a1 - s.a0).toBeGreaterThan(Math.PI * 1.99)
    expect(s.a1 - s.a0).toBeLessThan(Math.PI * 2)
  })

  it('splits several memberships into equal arcs with gaps', () => {
    const spans = membershipArcSpans(3)
    expect(spans).toHaveLength(3)
    for (const s of spans) expect(s.a1).toBeGreaterThan(s.a0)
    // arcs plus gaps tile the full circle
    const covered = spans.reduce((sum, s) => sum + (s.a1 - s.a0), 0)
    expect(covered).toBeLessThan(Math.PI * 2)
    expect(covered).toBeGreaterThan(Math.PI) // gaps stay small
    // consecutive arcs are evenly rotated
    const step1 = spans[1].a0 - spans[0].a0
    const step2 = spans[2].a0 - spans[1].a0
    expect(step1).toBeCloseTo(step2, 6)
    expect(step1).toBeCloseTo((Math.PI * 2) / 3, 6)
  })
})

describe('People view — columnCount', () => {
  it('fits as many fixed-width cards + gaps as the width allows', () => {
    expect(columnCount(CARD_W)).toBe(1)
    expect(columnCount(CARD_W * 2 + GAP)).toBe(2)         // exactly two + one gap
    expect(columnCount(CARD_W * 3 + GAP * 2)).toBe(3)
    expect(columnCount(CARD_W * 3 + GAP * 2 - 1)).toBe(2) // one px short of a third
  })

  it('never drops below one column, even at zero/negative width', () => {
    expect(columnCount(0)).toBe(1)
    expect(columnCount(-500)).toBe(1)
  })
})

describe('People view — gridHeight', () => {
  it('is zero for an empty list', () => {
    expect(gridHeight(0, 3)).toBe(0)
  })

  it('accounts for rows, inter-row gaps and padding (no trailing gap)', () => {
    expect(gridHeight(3, 3)).toBe(PAD * 2 + ROW_H - GAP)     // 1 row
    expect(gridHeight(4, 3)).toBe(PAD * 2 + 2 * ROW_H - GAP) // 2 rows (partial)
    expect(gridHeight(6, 3)).toBe(PAD * 2 + 2 * ROW_H - GAP) // 2 full rows
  })
})

describe('People view — rowWindow', () => {
  it('renders from the top, row-aligned, at the scrolled-to-top position', () => {
    const w = rowWindow(0, 600, 100, 4)
    expect(w.startIndex).toBe(0)
    expect(w.startIndex % 4).toBe(0)  // always starts a fresh grid row
    expect(w.offsetY).toBe(PAD)
    expect(w.endIndex).toBeGreaterThan(0)
    expect(w.endIndex).toBeLessThan(100)
  })

  it('keeps the slice row-aligned once scrolled', () => {
    const w = rowWindow(5 * ROW_H + PAD, 600, 100, 4)
    expect(w.startIndex % 4).toBe(0)
    expect(w.offsetY).toBe(w.firstRow * ROW_H + PAD)
  })

  it('clamps a stale/over-scrolled position to an empty window at the end', () => {
    const w = rowWindow(1e6, 600, 100, 4)
    expect(w.endIndex).toBe(100)
    expect(w.startIndex).toBeGreaterThanOrEqual(w.endIndex) // nothing to render
  })

  it('handles an empty list without dividing by an empty grid', () => {
    const w = rowWindow(0, 600, 0, 4)
    expect(w).toMatchObject({ startIndex: 0, endIndex: 0, offsetY: PAD })
  })
})

describe('People view — person display helpers', () => {
  const REF = 2026
  it('ageOf caps at the death year and rejects the undated/nonsensical', () => {
    expect(ageOf({ birth_year: 2000 }, REF)).toBe(26)
    expect(ageOf({ birth_year: 2000, death_year: 2020 }, REF)).toBe(20)
    expect(ageOf({ birth_year: 2100, death_year: 2200 }, REF)).toBe(null) // born in the future
    expect(ageOf({}, REF)).toBe(null)
  })

  it('isDeceased only counts a death year at or before the reference year', () => {
    expect(isDeceased({ death_year: 2020 }, REF)).toBe(true)
    expect(isDeceased({ death_year: 2100 }, REF)).toBe(false)
    expect(isDeceased({}, REF)).toBe(false)
  })
})

describe('latestDataYear (temporary current year)', () => {
  it('is null for an empty project', () => {
    expect(latestDataYear([], [])).toBe(null)
    expect(latestDataYear()).toBe(null)
  })

  it('uses the latest birth or death year across people', () => {
    const persons = [
      { id: 'a', birth_year: 1950, death_year: 2001 },
      { id: 'b', birth_year: 1975 },
      { id: 'c', birth_year: 1948, death_year: 1990 },
    ]
    expect(latestDataYear(persons, [])).toBe(2001)
  })

  it('picks a later birth year over an earlier death year', () => {
    const persons = [
      { id: 'a', birth_year: 1950, death_year: 1990 },
      { id: 'b', birth_year: 1995 },
    ]
    expect(latestDataYear(persons, [])).toBe(1995)
  })

  it('considers relationship formed dates (numeric or string)', () => {
    const persons = [{ id: 'a', birth_year: 1950 }]
    const rels = [{ id: 'm', formed_date: '1999' }]
    expect(latestDataYear(persons, rels)).toBe(1999)
  })

  it('ignores missing, zero and non-numeric years', () => {
    const persons = [
      { id: 'a', birth_year: null, death_year: undefined },
      { id: 'b', birth_year: 0 },
      { id: 'c', birth_year: 1960 },
    ]
    const rels = [{ id: 'm', formed_date: '' }, { id: 'n', formed_date: 'unknown' }]
    expect(latestDataYear(persons, rels)).toBe(1960)
  })
})
