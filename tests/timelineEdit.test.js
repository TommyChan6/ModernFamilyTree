import { describe, it, expect } from 'vitest'
import {
  TIMELINE_TOOLS,
  timelineTool,
  insertLane,
  slotYear,
  retimeSlotValue,
  clampRetime,
  spanFromDrag,
  traceSegments
} from '../src/renderer/src/components/timeline/timelineEdit.js'
import { X0, LANE_W } from '../src/renderer/src/components/timeline/timelineLayout.js'

const Y = (year, extra = {}) => ({
  year,
  month: null,
  day: null,
  precision: 'year',
  calendar: 'gregorian',
  ...extra
})

describe('timeline tools catalog', () => {
  it('has unique ids and hotkeys', () => {
    const ids = new Set(TIMELINE_TOOLS.map((t) => t.id))
    const keys = new Set(TIMELINE_TOOLS.map((t) => t.key))
    expect(ids.size).toBe(TIMELINE_TOOLS.length)
    expect(keys.size).toBe(TIMELINE_TOOLS.length)
    expect(timelineTool('retime').icon).toBe('⇕')
    expect(timelineTool('nope')).toBeNull()
  })
})

describe('insertLane', () => {
  const people = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  const order = ['a', 'u', 'b', 'c'] // 'u' = undated, keeps its spot

  it('inserts before the lane under the click', () => {
    expect(insertLane(order, people, 'n', { worldX: X0 + LANE_W * 1 })).toEqual([
      'a',
      'u',
      'n',
      'b',
      'c'
    ])
    expect(insertLane(order, people, 'n', { worldX: X0 - 400 })).toEqual(['n', 'a', 'u', 'b', 'c'])
  })
  it('appends past the last lane', () => {
    expect(insertLane(order, people, 'n', { worldX: X0 + LANE_W * 9 })).toEqual([
      'a',
      'u',
      'b',
      'c',
      'n'
    ])
  })
  it('places a child right after its parent', () => {
    expect(insertLane(order, people, 'n', { afterId: 'a' })).toEqual(['a', 'n', 'u', 'b', 'c'])
  })
  it('never duplicates an id already present', () => {
    expect(insertLane(['a', 'n', 'b'], people, 'n', { afterId: 'b' })).toEqual(['a', 'b', 'n'])
  })
})

describe('retimeSlotValue', () => {
  const def = (type) => ({ type })

  it('keeps month/day precision when moving a date', () => {
    const v = Y(1950, { month: 6, day: 2, precision: 'day' })
    expect(retimeSlotValue(def('date'), v, 1955)).toEqual({ ...v, year: 1955 })
    expect(retimeSlotValue(def('date'), null, 1955)).toEqual(Y(1955))
  })
  it('handles plain numbers', () => {
    expect(retimeSlotValue(def('number'), 1950, 1961)).toBe(1961)
  })
  it('shifts ranges as a whole, keeping their width', () => {
    expect(retimeSlotValue(def('number_range'), { a: 1940, b: 1950 }, 1960)).toEqual({
      a: 1955,
      b: 1965
    })
    expect(retimeSlotValue(def('date_range'), { from: Y(1940), to: Y(1944) }, 1952)).toEqual({
      from: Y(1950),
      to: Y(1954)
    })
    expect(slotYear(def('date_range'), { from: Y(1940), to: null })).toBe(1940)
  })
  it('refuses custom calendars', () => {
    expect(retimeSlotValue(def('custom_date'), null, 1950)).toBeUndefined()
  })
})

describe('clampRetime / spanFromDrag', () => {
  it('never lets a life invert', () => {
    expect(clampRetime('birth', 2001.4, { end: 1990 })).toBe(1990)
    expect(clampRetime('death', 1900, { birth: 1950 })).toBe(1950)
    expect(clampRetime('birth', 1960.6, { end: 1990 })).toBe(1961)
  })
  it('turns a drag into a moment or an ordered span', () => {
    expect(spanFromDrag(1950.2, 1949.8)).toEqual({ start: 1950, end: null })
    expect(spanFromDrag(1980, 1960)).toEqual({ start: 1960, end: 1980 })
  })
})

describe('traceSegments', () => {
  const people = new Map([
    ['dad', { birthYear: 1940, endYear: 2010 }],
    ['mom', { birthYear: 1945, endYear: 2020 }],
    ['kid', { birthYear: 1970, endYear: 2024 }],
    ['pal', { birthYear: 1968, endYear: 2024 }]
  ])
  const roles = { parent_child: 'vertical', spouse: 'horizontal', friends: 'none' }
  const roleOf = (t) => roles[t] || 'none'

  it('anchors each hop at the year that made it', () => {
    const path = {
      ids: ['mom', 'dad', 'kid', 'pal'],
      rels: [
        { type: 'spouse', person_a_id: 'dad', person_b_id: 'mom', formed: Y(1966) },
        { type: 'parent_child', person_a_id: 'dad', person_b_id: 'kid' },
        { type: 'friends', person_a_id: 'kid', person_b_id: 'pal' }
      ]
    }
    const segs = traceSegments(path, people, roleOf)
    expect(segs.map((s) => [s.a, s.b, s.year, s.kind])).toEqual([
      ['mom', 'dad', 1966, 'horizontal'],
      ['dad', 'kid', 1970, 'vertical'],
      ['kid', 'pal', (1970 + 2024) / 2, 'other']
    ])
  })
  it('falls back to shared years for an undated couple and skips unplaced people', () => {
    const segs = traceSegments(
      {
        ids: ['dad', 'mom', 'ghost'],
        rels: [
          { type: 'spouse', person_a_id: 'dad', person_b_id: 'mom', formed: null },
          { type: 'friends', person_a_id: 'mom', person_b_id: 'ghost' }
        ]
      },
      people,
      roleOf
    )
    expect(segs).toHaveLength(1)
    expect(segs[0].year).toBe((1945 + 2010) / 2)
  })
})
