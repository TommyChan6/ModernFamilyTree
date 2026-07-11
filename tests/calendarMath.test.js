import { describe, it, expect } from 'vitest'
import { yearDate, toOrdinal, format, duration } from '../src/shared/calendarMath'

const dv = (year, month = null, day = null, precision = 'year') => ({
  year,
  month,
  day,
  precision,
  calendar: 'gregorian'
})

describe('yearDate', () => {
  it('wraps a year (number or numeric string) as a year-precision DateValue', () => {
    expect(yearDate(1950)).toEqual(dv(1950))
    expect(yearDate('1975')).toEqual(dv(1975))
  })

  it('maps null/blank/zero/non-numeric to null', () => {
    expect(yearDate(null)).toBeNull()
    expect(yearDate(undefined)).toBeNull()
    expect(yearDate('')).toBeNull()
    expect(yearDate(0)).toBeNull()
    expect(yearDate('unknown')).toBeNull()
  })
})

describe('toOrdinal', () => {
  it('maps a year-precision date exactly to its year', () => {
    expect(toOrdinal(dv(1950))).toBe(1950)
  })

  it('orders finer precisions within the year', () => {
    const jan = toOrdinal(dv(1950, 1, null, 'month'))
    const dec = toOrdinal(dv(1950, 12, null, 'month'))
    const dayMid = toOrdinal(dv(1950, 6, 15, 'day'))
    expect(jan).toBe(1950)
    expect(dec).toBeGreaterThan(jan)
    expect(dec).toBeLessThan(1951)
    expect(dayMid).toBeGreaterThan(toOrdinal(dv(1950, 6, 1, 'day')))
    expect(dayMid).toBeLessThan(toOrdinal(dv(1950, 7, null, 'month')))
  })

  it('ignores month/day beyond the stated precision', () => {
    expect(toOrdinal(dv(1950, 6, 15, 'year'))).toBe(1950)
  })

  it('is null for unknown dates', () => {
    expect(toOrdinal(null)).toBeNull()
    expect(toOrdinal(undefined)).toBeNull()
    expect(toOrdinal(dv(null))).toBeNull()
  })

  it('rejects calendars it does not know', () => {
    expect(() => toOrdinal(dv(1950), 'lunar')).toThrow(/Unsupported calendar/)
  })
})

describe('format', () => {
  it('honours the precision', () => {
    expect(format(dv(1950))).toBe('1950')
    expect(format(dv(1950, 6, null, 'month'))).toBe('1950-06')
    expect(format(dv(1950, 6, 2, 'day'))).toBe('1950-06-02')
  })

  it('is empty for unknown dates', () => {
    expect(format(null)).toBe('')
    expect(format(dv(null))).toBe('')
  })
})

describe('duration', () => {
  it('measures elapsed years between two dates', () => {
    expect(duration(dv(1950), dv(2000))).toBe(50)
    expect(duration(dv(2000), dv(1950))).toBe(-50)
  })

  it('is null when either side is unknown', () => {
    expect(duration(null, dv(2000))).toBeNull()
    expect(duration(dv(1950), null)).toBeNull()
  })
})
