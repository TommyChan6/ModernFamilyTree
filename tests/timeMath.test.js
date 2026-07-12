import { describe, it, expect } from 'vitest'
import {
  computeTimeRange,
  computeTimeEvents,
  bucketizeEvents,
  eventsCrossed
} from '../src/renderer/src/components/time/timeMath'
import { yearDate } from '../src/shared/calendarMath'

const yd = yearDate

function person(id, name, birth, death = null) {
  return { id, name, birth: yd(birth), death: yd(death) }
}
function spouse(id, a, b, formed = null, status = 'active') {
  return { id, type: 'spouse', person_a_id: a, person_b_id: b, formed: yd(formed), status }
}
function parentChild(id, parent, child) {
  return { id, type: 'parent_child', person_a_id: parent, person_b_id: child, formed: null }
}

const PERSONS = [
  person('a', 'Anna', 1930, 1999),
  person('b', 'Bo', 1932),
  person('c', 'Cara', 1957),
  person('u', 'Undated', null)
]
const RELS = [
  spouse('m1', 'a', 'b', 1954),
  parentChild('pc1', 'a', 'c'),
  spouse('m2', 'a', 'c') // no formed date → no marriage event
]

describe('computeTimeRange', () => {
  it('spans first birth/marriage to last birth/death/marriage', () => {
    expect(computeTimeRange(PERSONS, RELS)).toEqual({ minYear: 1930, maxYear: 1999 })
  })

  it('includes marriage dates outside the birth/death span', () => {
    const r = computeTimeRange([person('a', 'A', 1950)], [spouse('m', 'a', 'x', 2010)])
    expect(r).toEqual({ minYear: 1950, maxYear: 2010 })
  })

  it('is null when nothing is dated', () => {
    expect(computeTimeRange([person('u', 'U', null)], [spouse('m', 'u', 'u2')])).toBeNull()
    expect(computeTimeRange([], [])).toBeNull()
  })

  it('guarantees at least a one-year span', () => {
    expect(computeTimeRange([person('a', 'A', 1950)], [])).toEqual({
      minYear: 1950,
      maxYear: 1951
    })
  })

  it('rounds fractional ordinals outward to whole years', () => {
    const p = {
      id: 'a',
      name: 'A',
      birth: { year: 1950, month: 7, day: null, precision: 'month', calendar: 'gregorian' },
      death: { year: 1990, month: 3, day: null, precision: 'month', calendar: 'gregorian' }
    }
    expect(computeTimeRange([p], [])).toEqual({ minYear: 1950, maxYear: 1991 })
  })
})

describe('computeTimeEvents', () => {
  it('emits dated births and dated marriages, sorted by year', () => {
    const evs = computeTimeEvents(PERSONS, RELS)
    expect(evs.map((e) => [e.kind, e.year])).toEqual([
      ['birth', 1930],
      ['birth', 1932],
      ['marriage', 1954],
      ['birth', 1957]
    ])
    const wedding = evs.find((e) => e.kind === 'marriage')
    expect(wedding.label).toBe('Anna & Bo')
    expect(wedding.ids).toEqual(['a', 'b'])
  })

  it('skips undated people and undated marriages', () => {
    const evs = computeTimeEvents(PERSONS, RELS)
    expect(evs.some((e) => e.ids.includes('u'))).toBe(false)
    expect(evs.filter((e) => e.kind === 'marriage')).toHaveLength(1)
  })
})

describe('bucketizeEvents', () => {
  it('normalises counts to the busiest bucket and clamps to the range', () => {
    const range = { minYear: 1900, maxYear: 2000 }
    const evs = computeTimeEvents(
      [person('a', 'A', 1900), person('b', 'B', 1901), person('c', 'C', 2000)],
      []
    )
    const buckets = bucketizeEvents(evs, range, 10)
    expect(buckets).toHaveLength(10)
    expect(buckets[0]).toBe(1) // two events in the first decade → the peak
    expect(buckets[9]).toBe(0.5) // year 2000 lands in the last bucket, not out of bounds
    expect(buckets.slice(1, 9).every((v) => v === 0)).toBe(true)
  })
})

describe('eventsCrossed', () => {
  const evs = computeTimeEvents(PERSONS, RELS)

  it('returns events strictly inside (from, to]', () => {
    expect(eventsCrossed(evs, 1930, 1954).map((e) => e.year)).toEqual([1932, 1954])
  })

  it('is empty when moving backwards or standing still', () => {
    expect(eventsCrossed(evs, 1954, 1930)).toEqual([])
    expect(eventsCrossed(evs, 1954, 1954)).toEqual([])
  })
})
