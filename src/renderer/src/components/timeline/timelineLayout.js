// Pure layout math for the Timeline view — no Three.js, no store, no DOM.
//
// World units: x is the unscaled lane coordinate (the renderer multiplies by the
// current lane scale), y is expressed in *years* (the renderer maps a year to
// screen via pxPerYear + translate). Everything zoom-dependent stays out of here
// so the layout only recomputes when the data changes.

import { computeTreeOrder } from '../graph/familyTreeLayout'
import { toOrdinal } from '../../../../shared/calendarMath'

export const GUTTER = 64 // fixed year-axis gutter width (screen px)
export const LANE_W = 150 // horizontal distance between lifelines (unscaled px)
export const X0 = 110 // x of the first lane (unscaled px)
export const Y_PAD = 40 // screen-space padding above the first year

export function lifeEnd(p, refYear) {
  const death = toOrdinal(p.death)
  return death != null && death <= refYear ? death : refYear
}

// Lane order comes from the same family-tree layout algorithm the Tree View
// uses: couples sit in neighbouring lanes and children land near their parents,
// so marriage/birth connectors stay short and cross as little as possible.
export function computeLaneOrder(persons, relationships) {
  return computeTreeOrder(persons, relationships)
}

export function computeTimelineLayout(persons, relationships, refYear, laneOrder = null) {
  const birthOf = (p) => toOrdinal(p.birth)
  const dated = persons.filter((p) => birthOf(p) != null)

  // Use the caller's (frozen) lane order when given; people missing from it —
  // e.g. added since the last "refresh layout" — append on the right in a
  // stable birth-date order.
  const order = laneOrder || computeLaneOrder(persons, relationships)
  const orderIdx = new Map(order.map((id, i) => [id, i]))
  dated.sort((a, b) => {
    const ia = orderIdx.has(a.id) ? orderIdx.get(a.id) : Infinity
    const ib = orderIdx.has(b.id) ? orderIdx.get(b.id) : Infinity
    if (ia !== ib) return ia - ib
    return birthOf(a) - birthOf(b) || (a.name || '').localeCompare(b.name || '')
  })

  const minYear = dated.length ? Math.min(...dated.map(birthOf)) : refYear - 50
  let maxYear = minYear + 10
  dated.forEach((p) => {
    maxYear = Math.max(maxYear, lifeEnd(p, refYear))
  })
  relationships.forEach((r) => {
    const y = toOrdinal(r.formed)
    if (y) maxYear = Math.max(maxYear, y)
  })
  const yearSpan = Math.max(10, maxYear - minYear)

  const people = dated.map((p, i) => {
    const birth = birthOf(p)
    const death = toOrdinal(p.death)
    const dead = death != null && death <= refYear
    const end = lifeEnd(p, refYear)
    const age = Math.max(0, Math.floor(end - birth))
    return {
      id: p.id,
      i,
      laneX: X0 + i * LANE_W,
      birthYear: birth,
      endYear: end,
      dead,
      gender: p.gender,
      name: p.name || 'Unnamed',
      image: p.primary_image || null,
      yearsLabel: dead
        ? `${p.birth.year}–${p.death.year} · ${age} yr`
        : `b. ${p.birth.year} · ${age} yr`
    }
  })
  const laneById = new Map(people.map((p) => [p.id, p]))
  const personById = new Map(persons.map((p) => [p.id, p]))

  const marriages = []
  const births = []
  for (const r of relationships) {
    if (r.type === 'spouse') {
      const a = laneById.get(r.person_a_id)
      const b = laneById.get(r.person_b_id)
      if (!a || !b) continue
      const pa = personById.get(r.person_a_id)
      const pb = personById.get(r.person_b_id)

      let year = toOrdinal(r.formed) || null
      let estimated = false
      if (!year) {
        // No recorded date — sketch a plausible spot inside the shared lifespan
        const lo = Math.max(toOrdinal(pa.birth), toOrdinal(pb.birth))
        const hi = Math.min(lifeEnd(pa, refYear), lifeEnd(pb, refYear))
        year = hi > lo ? Math.min(lo + 25, hi) : lo
        estimated = true
      }
      const divorced = r.status === 'divorced'
      const badge = estimated ? '⚭ add year' : `${divorced ? '⚮' : '⚭'} ${year}`
      marriages.push({
        id: r.id,
        ids: [r.person_a_id, r.person_b_id],
        names: `${pa.name} & ${pb.name}`,
        laneX1: Math.min(a.laneX, b.laneX),
        laneX2: Math.max(a.laneX, b.laneX),
        year,
        realYear: estimated ? null : year,
        status: r.status || 'active',
        divorced,
        estimated,
        badge,
        bw: badge.length * 6.6 + 20
      })
    } else if (r.type === 'parent_child' || r.type === 'adopted') {
      const parent = laneById.get(r.person_a_id)
      const child = laneById.get(r.person_b_id)
      if (!parent || !child) continue
      births.push({
        id: r.id,
        ids: [r.person_a_id, r.person_b_id],
        laneXp: parent.laneX,
        laneXc: child.laneX,
        year: child.birthYear,
        adopted: r.type === 'adopted'
      })
    }
  }

  return {
    people,
    marriages,
    births,
    minYear,
    maxYear,
    yearSpan,
    worldWBase: X0 + Math.max(0, people.length - 1) * LANE_W + 220,
    undatedCount: persons.length - people.length
  }
}
