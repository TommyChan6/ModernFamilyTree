import { describe, it, expect } from 'vitest'
import {
  computeTimelineLayout,
  lifeEnd,
  LANE_W,
  X0
} from '../src/renderer/src/components/timeline/timelineLayout.js'
import { membershipArcSpans } from '../src/renderer/src/components/factions/factionLayout.js'
import {
  columnCount,
  gridHeight,
  rowWindow,
  ageOf,
  isDeceased,
  CARD_W,
  GAP,
  PAD,
  ROW_H
} from '../src/renderer/src/components/people/peopleLayout.js'
import { latestDataYear } from '../src/renderer/src/store/currentYear.js'
import { yearDate } from '../src/shared/calendarMath'
import {
  inkPigment,
  hexToRgb01,
  rgbToHex,
  writeEase,
  writeEaseInv,
  inkWriteSchedule,
  writeArrival,
  majorStep,
  isMajorYear,
  ganzhi,
  parallaxOffset,
  INK_RGB
} from '../src/renderer/src/components/webgl/inkMath'

const REF = 2026
const yd = yearDate

function person(id, name, birth, extra = {}) {
  return { id, name, birth: yd(birth), ...extra }
}

describe('computeTimelineLayout', () => {
  const persons = [
    person('a', 'Alice', 1950),
    person('b', 'Bob', 1948, { death: yd(2000) }),
    person('c', 'Carol', 1975),
    person('u', 'Undated', null)
  ]
  const relationships = [
    {
      id: 'm1',
      type: 'spouse',
      person_a_id: 'a',
      person_b_id: 'b',
      formed: yd(1970),
      status: 'active'
    },
    { id: 'p1', type: 'parent_child', person_a_id: 'a', person_b_id: 'c' }
  ]

  it('places only dated people, one lane apart', () => {
    const L = computeTimelineLayout(persons, relationships, REF)
    expect(L.people).toHaveLength(3)
    expect(L.undatedCount).toBe(1)
    const xs = L.people.map((p) => p.laneX).sort((x, y) => x - y)
    expect(xs[0]).toBe(X0)
    expect(xs[1] - xs[0]).toBe(LANE_W)
    expect(xs[2] - xs[1]).toBe(LANE_W)
  })

  it('caps a life at the death year and marks the person dead', () => {
    const L = computeTimelineLayout(persons, relationships, REF)
    const bob = L.people.find((p) => p.id === 'b')
    expect(bob.dead).toBe(true)
    expect(bob.endYear).toBe(2000)
    const alice = L.people.find((p) => p.id === 'a')
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
    const rels = [
      { id: 'm2', type: 'spouse', person_a_id: 'a', person_b_id: 'c', status: 'active' }
    ]
    const L = computeTimelineLayout(persons, rels, REF)
    const m = L.marriages[0]
    expect(m.estimated).toBe(true)
    expect(m.realYear).toBeNull()
    // inside the shared lifespan: after the younger birth, before either life ends
    expect(m.year).toBeGreaterThanOrEqual(1975)
    expect(m.year).toBeLessThanOrEqual(REF)
  })

  it('anchors child branches at the child birth year', () => {
    const L = computeTimelineLayout(persons, relationships, REF)
    expect(L.branches).toHaveLength(1)
    expect(L.branches[0].year).toBe(1975)
    expect(L.branches[0].adopted).toBe(false)
    expect(L.branches[0].childId).toBe('c')
    expect(L.families).toHaveLength(1)
  })

  it('skips connectors whose people are not on the timeline', () => {
    const rels = [{ id: 'p2', type: 'parent_child', person_a_id: 'u', person_b_id: 'c' }]
    const L = computeTimelineLayout(persons, rels, REF)
    expect(L.branches).toHaveLength(0)
    expect(L.families).toHaveLength(0)
  })

  it('respects a frozen lane order and appends people missing from it', () => {
    // 'b' is not in the frozen order → appended after the ordered lanes
    const L = computeTimelineLayout(persons, relationships, REF, ['c', 'a'])
    expect(L.people.map((p) => p.id)).toEqual(['c', 'a', 'b'])
    const xs = L.people.map((p) => p.laneX)
    expect(xs[1] - xs[0]).toBe(LANE_W)
    expect(xs[2] - xs[1]).toBe(LANE_W)
  })
})

describe('lifeEnd', () => {
  it('uses the death date when it is in the past, else the reference year', () => {
    expect(lifeEnd({ death: yd(1990) }, REF)).toBe(1990)
    expect(lifeEnd({ death: yd(2100) }, REF)).toBe(REF)
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
    expect(columnCount(CARD_W * 2 + GAP)).toBe(2) // exactly two + one gap
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
    expect(gridHeight(3, 3)).toBe(PAD * 2 + ROW_H - GAP) // 1 row
    expect(gridHeight(4, 3)).toBe(PAD * 2 + 2 * ROW_H - GAP) // 2 rows (partial)
    expect(gridHeight(6, 3)).toBe(PAD * 2 + 2 * ROW_H - GAP) // 2 full rows
  })
})

describe('People view — rowWindow', () => {
  it('renders from the top, row-aligned, at the scrolled-to-top position', () => {
    const w = rowWindow(0, 600, 100, 4)
    expect(w.startIndex).toBe(0)
    expect(w.startIndex % 4).toBe(0) // always starts a fresh grid row
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
  it('ageOf caps at the death date and rejects the undated/nonsensical', () => {
    expect(ageOf({ birth: yd(2000) }, REF)).toBe(26)
    expect(ageOf({ birth: yd(2000), death: yd(2020) }, REF)).toBe(20)
    expect(ageOf({ birth: yd(2100), death: yd(2200) }, REF)).toBe(null) // born in the future
    expect(ageOf({}, REF)).toBe(null)
  })

  it('isDeceased only counts a death date at or before the reference year', () => {
    expect(isDeceased({ death: yd(2020) }, REF)).toBe(true)
    expect(isDeceased({ death: yd(2100) }, REF)).toBe(false)
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
      { id: 'a', birth: yd(1950), death: yd(2001) },
      { id: 'b', birth: yd(1975) },
      { id: 'c', birth: yd(1948), death: yd(1990) }
    ]
    expect(latestDataYear(persons, [])).toBe(2001)
  })

  it('picks a later birth year over an earlier death year', () => {
    const persons = [
      { id: 'a', birth: yd(1950), death: yd(1990) },
      { id: 'b', birth: yd(1995) }
    ]
    expect(latestDataYear(persons, [])).toBe(1995)
  })

  it('considers relationship formed dates', () => {
    const persons = [{ id: 'a', birth: yd(1950) }]
    const rels = [{ id: 'm', formed: yd('1999') }]
    expect(latestDataYear(persons, rels)).toBe(1999)
  })

  it('ignores missing and unusable dates', () => {
    const persons = [
      { id: 'a', birth: null, death: undefined },
      { id: 'b', birth: yd(0) }, // yearDate(0) → null
      { id: 'c', birth: yd(1960) }
    ]
    const rels = [
      { id: 'm', formed: yd('') },
      { id: 'n', formed: yd('unknown') },
      {
        id: 'o',
        formed: { year: null, month: null, day: null, precision: 'year', calendar: 'gregorian' }
      }
    ]
    expect(latestDataYear(persons, rels)).toBe(1960)
  })
})

describe('ink theme math (webgl/inkMath)', () => {
  it('parses hex colours to raw sRGB and back', () => {
    expect(hexToRgb01('#ff0000')).toEqual([1, 0, 0])
    expect(hexToRgb01('#0f0')).toEqual([0, 1, 0])
    expect(hexToRgb01('nonsense')).toEqual([0.53, 0.53, 0.53])
    expect(rgbToHex([1, 0.5, 0])).toBe('#ff8000')
    expect(rgbToHex([2, -1, 0])).toBe('#ff0000')
  })

  it('grinds colours into ink: less chroma, darker, identity at sat 1 / ink 0', () => {
    const red = [0.9, 0.2, 0.2]
    expect(inkPigment(red, { sat: 1, ink: 0 })).toEqual(red)
    const p = inkPigment(red, { sat: 0.5, ink: 0.5 })
    const chroma = (c) => Math.max(...c) - Math.min(...c)
    expect(chroma(p)).toBeLessThan(chroma(red))
    expect(p[0]).toBeLessThan(red[0])
    const allInk = inkPigment(red, { sat: 0.5, ink: 1 })
    allInk.forEach((v, i) => expect(v).toBeCloseTo(INK_RGB[i], 6))
  })

  it('brush ease is monotone with an exact inverse', () => {
    expect(writeEase(0)).toBe(0)
    expect(writeEase(1)).toBe(1)
    expect(writeEase(-1)).toBe(0)
    expect(writeEase(0.5)).toBeGreaterThan(0.5) // fast start, settling stop
    for (const f of [0, 0.1, 0.37, 0.8, 1]) expect(writeEase(writeEaseInv(f))).toBeCloseTo(f, 9)
  })

  it('writes lanes left to right, bounded however many people', () => {
    const people = Array.from({ length: 400 }, (_, i) => ({
      id: 'p' + i,
      laneX: (399 - i) * 150, // reverse order on purpose
      birthYear: 1900,
      endYear: 1900 + (i % 90)
    }))
    const s = inkWriteSchedule(people)
    expect(s.size).toBe(400)
    // the leftmost lane (p399) starts first, the rightmost (p0) last
    expect(s.get('p399').start).toBe(0)
    expect(s.get('p0').start).toBeGreaterThan(s.get('p200').start)
    let maxEnd = 0
    for (const v of s.values()) {
      expect(v.dur).toBeGreaterThanOrEqual(0.55)
      expect(v.dur).toBeLessThanOrEqual(1.25)
      maxEnd = Math.max(maxEnd, v.start + v.dur)
    }
    expect(maxEnd).toBeLessThanOrEqual(1.5 + 1.25 + 1e-9)
    // longer lives are longer strokes
    expect(s.get('p89').dur).toBeGreaterThan(s.get('p0').dur)
    expect(inkWriteSchedule([]).size).toBe(0)
  })

  it('times when a stroke tip reaches a year', () => {
    const slot = { start: 2, dur: 1 }
    expect(writeArrival(slot, 1900, 2000, 1900)).toBe(2)
    expect(writeArrival(slot, 1900, 2000, 2000)).toBe(3)
    const mid = writeArrival(slot, 1900, 2000, 1950)
    expect(mid).toBeGreaterThan(2)
    expect(mid).toBeLessThan(2.5) // the eased tip is past halfway before half the time
    expect(writeArrival(slot, 1900, 1900, 1900)).toBe(3) // zero-length stroke
  })

  it('picks heavier decade / century rules for each tick step', () => {
    expect(majorStep(1)).toBe(10)
    expect(majorStep(2)).toBe(10)
    expect(majorStep(5)).toBe(50)
    expect(majorStep(10)).toBe(50)
    expect(majorStep(20)).toBe(100)
    expect(majorStep(25)).toBe(100)
    expect(majorStep(100)).toBe(500)
    for (const st of [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000, 2000, 5000])
      expect(majorStep(st) % st).toBe(0)
    expect(isMajorYear(1950, 1)).toBe(true)
    expect(isMajorYear(1955, 5)).toBe(false)
    expect(isMajorYear(-100, 20)).toBe(true)
  })

  it('names years in the sexagenary cycle', () => {
    expect(ganzhi(1984)).toBe('甲子')
    expect(ganzhi(2024)).toBe('甲辰')
    expect(ganzhi(1949)).toBe('己丑')
    expect(ganzhi(1911)).toBe('辛亥')
    expect(ganzhi(1984 + 60)).toBe('甲子')
    expect(ganzhi(4 - 60)).toBe('甲子') // proleptic, astronomical numbering
    expect(ganzhi(1984.7)).toBe('甲子')
  })

  it('keeps parallax tiles covering the screen from the left edge', () => {
    for (const tx of [-5000, -333, 0, 1, 777, 12345]) {
      const o = parallaxOffset(tx, 0.16, 1700)
      expect(o).toBeLessThanOrEqual(0)
      expect(o).toBeGreaterThan(-1700)
    }
    expect(parallaxOffset(100, 0.5, 0)).toBe(0)
    // panning right by one tile's worth of parallax lands on the same phase
    expect(parallaxOffset(10, 0.2, 100)).toBeCloseTo(parallaxOffset(10 + 500, 0.2, 100), 9)
  })
})
