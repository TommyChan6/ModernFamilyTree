// Pure math for the Time Travel slider — no store, DOM, or renderer dependency.
// Everything works in the fractional-year space of toOrdinal(), so month/day
// precision dates order correctly inside a year.

import type { Person, Relationship } from '../../../../shared/types'
import { toOrdinal } from '../../../../shared/calendarMath'

export interface TimeRange {
  minYear: number
  maxYear: number
}

export type TimeEventKind = 'birth' | 'marriage'

export interface TimeEvent {
  year: number // fractional year (toOrdinal space)
  kind: TimeEventKind
  label: string
  ids: string[]
}

/** The whole-year span the slider can travel: first birth/marriage to the last
 *  birth/death/marriage in the data. Null when nothing is dated. */
export function computeTimeRange(
  persons: Person[],
  relationships: Relationship[]
): TimeRange | null {
  let min = Infinity
  let max = -Infinity
  for (const p of persons) {
    const b = toOrdinal(p.birth)
    if (b != null) {
      if (b < min) min = b
      if (b > max) max = b
    }
    const d = toOrdinal(p.death)
    if (d != null && d > max) max = d
  }
  for (const r of relationships) {
    const f = toOrdinal(r.formed)
    if (f != null) {
      if (f < min) min = f
      if (f > max) max = f
    }
  }
  if (!Number.isFinite(min)) return null
  const minYear = Math.floor(min)
  const maxYear = Math.max(Math.ceil(max), minYear + 1)
  return { minYear, maxYear }
}

/** Every datable "something appears" moment, sorted by year: one birth per
 *  dated person, one marriage per spouse relationship with a formed date. */
export function computeTimeEvents(persons: Person[], relationships: Relationship[]): TimeEvent[] {
  const events: TimeEvent[] = []
  const nameOf = new Map(persons.map((p) => [p.id, p.name || 'Unnamed']))
  for (const p of persons) {
    const b = toOrdinal(p.birth)
    if (b != null) events.push({ year: b, kind: 'birth', label: p.name || 'Unnamed', ids: [p.id] })
  }
  for (const r of relationships) {
    if (r.type !== 'spouse') continue
    const f = toOrdinal(r.formed)
    if (f == null) continue
    events.push({
      year: f,
      kind: 'marriage',
      label: `${nameOf.get(r.person_a_id) ?? '?'} & ${nameOf.get(r.person_b_id) ?? '?'}`,
      ids: [r.person_a_id, r.person_b_id]
    })
  }
  events.sort((a, b) => a.year - b.year)
  return events
}

/** Histogram of events over the range, normalised to 0..1 per bucket — the
 *  slider's activity strip. */
export function bucketizeEvents(events: TimeEvent[], range: TimeRange, buckets: number): number[] {
  const counts = new Array<number>(buckets).fill(0)
  const span = Math.max(1e-9, range.maxYear - range.minYear)
  for (const e of events) {
    let i = Math.floor(((e.year - range.minYear) / span) * buckets)
    if (i < 0) i = 0
    if (i >= buckets) i = buckets - 1
    counts[i]++
  }
  const peak = Math.max(1, ...counts)
  return counts.map((c) => c / peak)
}

/** Events strictly inside (from, to] — the ones "crossed" by a forward step.
 *  Used for the play-through toast feed. */
export function eventsCrossed(events: TimeEvent[], from: number, to: number): TimeEvent[] {
  if (!(to > from)) return []
  return events.filter((e) => e.year > from + 1e-9 && e.year <= to + 1e-9)
}
