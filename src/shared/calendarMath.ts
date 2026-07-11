// Pure date math over DateValue — no store, DOM, or platform dependency.
// Only the Gregorian calendar exists for now; every entry point takes a
// calendar id so layout/sorting code never special-cases one, and custom
// calendars later only extend this module.

import type { DateValue } from './types'

function assertCalendar(calendar: string): void {
  if (calendar !== 'gregorian') throw new Error(`Unsupported calendar: ${calendar}`)
}

/** Wrap a plain year (number or numeric string) as a year-precision Gregorian
 *  DateValue; null/blank/zero stays null. */
export function yearDate(year: number | string | null | undefined): DateValue | null {
  if (year == null || year === '') return null
  const y = Number(year)
  if (!Number.isFinite(y) || y === 0) return null
  return { year: y, month: null, day: null, precision: 'year', calendar: 'gregorian' }
}

/** Map a DateValue onto a single sortable axis measured in (fractional) years.
 *  A year-precision date maps exactly to its year; month/day precision adds a
 *  fraction so finer dates order correctly within the year. Unknown → null. */
export function toOrdinal(
  date: DateValue | null | undefined,
  calendar: string = date?.calendar ?? 'gregorian'
): number | null {
  assertCalendar(calendar)
  if (!date || date.year == null) return null
  const month = date.precision !== 'year' && date.month ? date.month : null
  const day = date.precision === 'day' && date.day ? date.day : null
  return date.year + (month ? (month - 1) / 12 : 0) + (day ? (day - 1) / 372 : 0)
}

/** Human-readable form honouring the date's precision: "1950", "1950-06",
 *  "1950-06-12". Unknown → "". */
export function format(
  date: DateValue | null | undefined,
  calendar: string = date?.calendar ?? 'gregorian'
): string {
  assertCalendar(calendar)
  if (!date || date.year == null) return ''
  const pad = (n: number): string => String(n).padStart(2, '0')
  if (date.precision === 'day' && date.month && date.day)
    return `${date.year}-${pad(date.month)}-${pad(date.day)}`
  if (date.precision !== 'year' && date.month) return `${date.year}-${pad(date.month)}`
  return String(date.year)
}

/** Elapsed time from `a` to `b` in (fractional) years; null when either side
 *  is unknown. */
export function duration(
  a: DateValue | null | undefined,
  b: DateValue | null | undefined,
  calendar: string = 'gregorian'
): number | null {
  const oa = toOrdinal(a, calendar)
  const ob = toOrdinal(b, calendar)
  if (oa == null || ob == null) return null
  return ob - oa
}
