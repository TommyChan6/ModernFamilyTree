// Pure layout math for the Timeline view — no Three.js, no store, no DOM.
//
// World units: x is the unscaled lane coordinate (the renderer multiplies by the
// current lane scale), y is expressed in *years* (the renderer maps a year to
// screen via pxPerYear + translate). Everything zoom-dependent stays out of here
// so the layout only recomputes when the data changes.

import { computeGenLayout } from '../graph/layoutGeneration.js'

export const GUTTER = 64 // fixed year-axis gutter width (screen px)
export const LANE_W = 150 // horizontal distance between lifelines (unscaled px)
export const X0 = 110 // x of the first lane (unscaled px)
export const Y_PAD = 40 // screen-space padding above the first year

export function lifeEnd(p, refYear) {
  return p.death_year && p.death_year <= refYear ? p.death_year : refYear
}

export function computeTimelineLayout(persons, relationships, refYear) {
  const dated = persons.filter((p) => p.birth_year)

  // Lane order comes from the same family-tree layout the Tree View's Generation
  // mode uses: spouses sit side by side and children are placed with their
  // parents, so marriage/birth connectors stay short and readable.
  const { targets } = computeGenLayout(persons, relationships, 2000, 1000)
  dated.sort((a, b) => {
    const xa = targets[a.id]?.x ?? Infinity
    const xb = targets[b.id]?.x ?? Infinity
    if (xa !== xb) return xa - xb
    return a.birth_year - b.birth_year || (a.name || '').localeCompare(b.name || '')
  })

  const minYear = dated.length ? Math.min(...dated.map((p) => p.birth_year)) : refYear - 50
  let maxYear = minYear + 10
  dated.forEach((p) => {
    maxYear = Math.max(maxYear, lifeEnd(p, refYear))
  })
  relationships.forEach((r) => {
    const y = parseInt(r.formed_date)
    if (y) maxYear = Math.max(maxYear, y)
  })
  const yearSpan = Math.max(10, maxYear - minYear)

  const people = dated.map((p, i) => {
    const dead = !!p.death_year && p.death_year <= refYear
    const end = lifeEnd(p, refYear)
    const age = Math.max(0, end - p.birth_year)
    return {
      id: p.id,
      i,
      laneX: X0 + i * LANE_W,
      birthYear: p.birth_year,
      endYear: end,
      dead,
      gender: p.gender,
      name: p.name || 'Unnamed',
      image: p.primary_image || null,
      yearsLabel: dead
        ? `${p.birth_year}–${p.death_year} · ${age} yr`
        : `b. ${p.birth_year} · ${age} yr`
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

      let year = parseInt(r.formed_date) || null
      let estimated = false
      if (!year) {
        // No recorded date — sketch a plausible spot inside the shared lifespan
        const lo = Math.max(pa.birth_year, pb.birth_year)
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
