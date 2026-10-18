import { describe, it, expect } from 'vitest'
import {
  TIMELINE_TOOLS,
  timelineTool,
  insertLane,
  slotYear,
  retimeSlotValue,
  shiftLivesUpdates,
  clampRetime,
  spanFromDrag,
  traceSegments,
  moveLanes,
  laneSlotAt,
  laneSlotOf,
  sameOrder
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
    expect(timelineTool('retime').icon).toBe('move-vertical')
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

describe('moving lanes', () => {
  const display = ['a', 'b', 'c', 'd']
  const order = ['a', 'u', 'b', 'c', 'd'] // 'u' = undated

  it('moves one lane to any slot among the others', () => {
    expect(moveLanes(order, display, ['d'], 0)).toEqual(['d', 'a', 'u', 'b', 'c'])
    expect(moveLanes(order, display, ['a'], 3)).toEqual(['u', 'b', 'c', 'd', 'a'])
    expect(moveLanes(order, display, ['a'], 1)).toEqual(['u', 'b', 'a', 'c', 'd'])
    expect(moveLanes(order, display, ['b'], 1)).toEqual(order)
  })
  it('moves a selected block together, keeping its order', () => {
    expect(moveLanes(order, display, ['d', 'a'], 1)).toEqual(['u', 'b', 'a', 'd', 'c'])
  })
  it('adopts newcomers missing from the frozen order', () => {
    expect(moveLanes(['a', 'b'], ['a', 'b', 'n'], ['n'], 0)).toEqual(['n', 'a', 'b'])
  })
  it('finds slots from world x and from the current block', () => {
    expect(laneSlotAt(X0 + LANE_W * 2.4, 3)).toBe(2)
    expect(laneSlotAt(X0 + LANE_W * 9, 3)).toBe(3)
    expect(laneSlotAt(X0 - 500, 3)).toBe(0)
    expect(laneSlotAt(X0 + LANE_W * 2, 3, 1)).toBe(1)
    expect(laneSlotOf(display, ['c'])).toBe(2)
    expect(laneSlotOf(display, ['d', 'b'])).toBe(1)
    expect(sameOrder(['a'], ['a'])).toBe(true)
    expect(sameOrder(['a', 'b'], ['b', 'a'])).toBe(false)
  })
})

describe('shiftLivesUpdates (Time drag)', () => {
  const defs = [
    { id: 'fb', slot: 'birth', type: 'date' },
    { id: 'fd', slot: 'death', type: 'date' }
  ]
  const store = {
    a: { fb: Y(1900, { month: 3, day: 4, precision: 'day' }), fd: Y(1960) },
    b: { fb: Y(1950) },
    c: { fd: Y(1930) },
    d: {}
  }
  const valueOf = (id, fid) => store[id]?.[fid]

  it('moves birth and death together, keeping month/day precision', () => {
    const { updates, unsupported } = shiftLivesUpdates(defs, valueOf, ['a', 'b'], 5)
    expect(unsupported).toBe(false)
    expect(updates).toEqual([
      {
        personId: 'a',
        values: [
          { field_id: 'fb', value: Y(1905, { month: 3, day: 4, precision: 'day' }) },
          { field_id: 'fd', value: Y(1965) }
        ]
      },
      { personId: 'b', values: [{ field_id: 'fb', value: Y(1955) }] }
    ])
  })

  it('dates an undated birth from the fallback year, kept before a known death', () => {
    const { updates } = shiftLivesUpdates(defs, valueOf, ['c', 'd'], 10, () => 1925)
    expect(updates).toEqual([
      { personId: 'c', values: [{ field_id: 'fb', value: Y(1930) }] },
      { personId: 'd', values: [{ field_id: 'fb', value: Y(1935) }] }
    ])
    // No fallback → people without a birth are skipped
    expect(shiftLivesUpdates(defs, valueOf, ['d'], 3).updates).toEqual([])
  })

  it('does nothing for a zero shift or a project without a birth slot', () => {
    expect(shiftLivesUpdates(defs, valueOf, ['a'], 0).updates).toEqual([])
    expect(shiftLivesUpdates([], valueOf, ['a'], 4).updates).toEqual([])
  })

  it('refuses the whole batch when a slot type cannot be retimed', () => {
    const custom = [{ id: 'fb', slot: 'birth', type: 'custom_date' }]
    expect(shiftLivesUpdates(custom, valueOf, ['a', 'b'], 2)).toEqual({
      updates: [],
      unsupported: true
    })
  })

  it('shifts number-typed slots too', () => {
    const nums = [
      { id: 'nb', slot: 'birth', type: 'number' },
      { id: 'nd', slot: 'death', type: 'number_range' }
    ]
    const vals = { p: { nb: 1800, nd: { a: 1860, b: 1864 } } }
    const { updates } = shiftLivesUpdates(nums, (id, f) => vals[id]?.[f], ['p'], -20)
    expect(updates[0].values).toEqual([
      { field_id: 'nb', value: 1780 },
      { field_id: 'nd', value: { a: 1840, b: 1844 } }
    ])
  })
})

describe('shiftLivesUpdates birthOnly (graph Retime mode)', () => {
  const defs = [
    { id: 'fb', slot: 'birth', type: 'date' },
    { id: 'fd', slot: 'death', type: 'date' }
  ]
  const vals = {
    a: { fb: Y(1900, { month: 5, precision: 'month' }), fd: Y(1960) },
    b: { fb: Y(1950) },
    c: { fb: Y(1958), fd: Y(1960) }
  }
  const valueOf = (id, fid) => vals[id]?.[fid]
  const opt = { birthOnly: true }

  it('moves only the birth, keeping its precision; death stays put', () => {
    const { updates } = shiftLivesUpdates(defs, valueOf, ['a', 'b'], 10, () => null, opt)
    expect(updates).toEqual([
      {
        personId: 'a',
        values: [{ field_id: 'fb', value: Y(1910, { month: 5, precision: 'month' }) }]
      },
      { personId: 'b', values: [{ field_id: 'fb', value: Y(1960) }] }
    ])
  })

  it('clamps a birth at the death year, and skips people already there', () => {
    const { updates } = shiftLivesUpdates(defs, valueOf, ['a', 'c'], 80, () => null, opt)
    expect(updates[0].values[0].value.year).toBe(1960)
    expect(updates[1].values[0].value.year).toBe(1960)
    vals.c.fb = Y(1960)
    expect(shiftLivesUpdates(defs, valueOf, ['c'], 5, () => null, opt).updates).toEqual([])
    // moving earlier is never clamped
    expect(shiftLivesUpdates(defs, valueOf, ['c'], -5, () => null, opt).updates[0].values).toEqual([
      { field_id: 'fb', value: Y(1955) }
    ])
  })
})
