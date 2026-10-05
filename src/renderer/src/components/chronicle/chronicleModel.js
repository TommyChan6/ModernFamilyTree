// Pure view-model for drawing the chronicle (Timeline canvases, the Birth
// graph overlay): ordinal spans, era lanes, resolved icons/colours. No store,
// no DOM. Tests: tests/chronicle.test.js.

import { eraLanes, eventKind } from '../../../../shared/chronicle'
import { toOrdinal } from '../../../../shared/calendarMath'

export function chronicleViewModel(eras = [], events = []) {
  const { lane, count } = eraLanes(eras)
  return {
    eras: eras.map((e) => ({
      id: e.id,
      name: e.name,
      icon: e.icon,
      color: e.color,
      description: e.description,
      a: toOrdinal(e.start) ?? -Infinity,
      b: toOrdinal(e.end) ?? Infinity,
      lane: lane.get(e.id) ?? 0
    })),
    laneCount: count,
    events: events.map((ev) => {
      const k = eventKind(ev.kind)
      const a = toOrdinal(ev.date)
      const b = toOrdinal(ev.end)
      return {
        id: ev.id,
        title: ev.title,
        icon: ev.icon || k.icon,
        color: ev.color || k.color,
        a: a ?? NaN,
        b: b ?? NaN,
        importance: ev.importance || 2,
        personIds: ev.person_ids || []
      }
    })
  }
}

/** The project's year range as people + dated events + finite era ends see it. */
export function chronicleRange(persons = [], _eras = [], events = [], refYear = 2026) {
  const ys = []
  for (const p of persons) {
    const b = toOrdinal(p.birth)
    const d = toOrdinal(p.death)
    if (b != null) ys.push(b)
    if (d != null) ys.push(d)
  }
  for (const ev of events) {
    const a = toOrdinal(ev.date)
    if (a != null) ys.push(a)
  }
  if (!ys.length) return { min: refYear - 100, max: refYear }
  const min = Math.floor(Math.min(...ys))
  const max = Math.ceil(Math.max(...ys, Math.min(refYear, Math.max(...ys) + 30)))
  return { min, max: Math.max(max, min + 10) }
}
