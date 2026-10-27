// Pure layout math for the Timeline view — no Three.js, no store, no DOM.
//
// World units: x is the unscaled lane coordinate (the renderer multiplies by the
// current lane scale), y is expressed in *years* (the renderer maps a year to
// screen via pxPerYear + translate). Everything zoom-dependent stays out of here
// so the layout only recomputes when the data changes.

import { computeTreeOrder } from '../graph/familyTreeLayout'
import { toOrdinal } from '../../../../shared/calendarMath'
import { buildFamilies, optimizeLaneOrder, packSproutLanes } from './timelineLinks'
import { layoutHouseholdRivers } from './householdRivers'

export const GUTTER = 64 // fixed year-axis gutter width (screen px)
export const LANE_W = 150 // horizontal distance between lifelines (unscaled px)
export const X0 = 110 // x of the first lane (unscaled px)
export const Y_PAD = 40 // screen-space padding above the first year

export function lifeEnd(p, refYear) {
  const death = toOrdinal(p.death)
  return death != null && death <= refYear ? death : refYear
}

/** The timeline modes: every life in its own lane, lives sprouting out of
 *  their parents' stem into reusable lanes, or household rivers — channels per
 *  household that children are born inside (per timeline scene). */
export const TIMELINE_MODES = ['lanes', 'sprout', 'rivers']

// Lane order starts from the same family-tree layout algorithm the Tree View
// uses (couples side by side, children near their parents), then a local
// search trims the crossings that matter: a connector passing over a lane
// whose person is alive in that year. Empty lanes (not yet born / long gone)
// cost nothing.
export function computeLaneOrder(persons, relationships, typeRoles, refYear = null) {
  const tree = computeTreeOrder(persons, relationships, typeRoles)
  const ref = refYear ?? new Date().getFullYear()
  const people = []
  for (const p of persons) {
    const birthYear = toOrdinal(p.birth)
    if (birthYear != null) people.push({ id: p.id, birthYear, endYear: lifeEnd(p, ref) })
  }
  if (people.length < 3) return tree
  const marriages = marriageLinks(persons, relationships, ref, people)
  const { branches } = buildFamilies(people, relationships, marriages, typeRoles)
  return optimizeLaneOrder(tree, people, branches, marriages)
}

// Marriage years as the optimiser sees them (dated, else mid shared life).
function marriageLinks(persons, relationships, refYear, people) {
  const byId = new Map(persons.map((p) => [p.id, p]))
  const placed = new Set(people.map((p) => p.id))
  const out = []
  for (const r of relationships) {
    if (r.type !== 'spouse' || !placed.has(r.person_a_id) || !placed.has(r.person_b_id)) continue
    out.push({
      id: r.id,
      ids: [r.person_a_id, r.person_b_id],
      year: marriageYear(r, byId.get(r.person_a_id), byId.get(r.person_b_id), refYear).year
    })
  }
  return out
}

// A marriage's year: recorded, else a plausible spot inside the shared lifespan.
function marriageYear(r, pa, pb, refYear) {
  const year = toOrdinal(r.formed) || null
  if (year) return { year, estimated: false }
  const lo = Math.max(toOrdinal(pa.birth), toOrdinal(pb.birth))
  const hi = Math.min(lifeEnd(pa, refYear), lifeEnd(pb, refYear))
  return { year: hi > lo ? Math.min(lo + 25, hi) : lo, estimated: true }
}

export function computeTimelineLayout(
  persons,
  relationships,
  refYear,
  laneOrder = null,
  typeRoles = null,
  extraYears = [], // story-event years: the axis stretches to show them too
  { mode = 'lanes', leaveHomeAge = 25 } = {}
) {
  const birthOf = (p) => toOrdinal(p.birth)
  const dated = persons.filter((p) => birthOf(p) != null)

  // Use the caller's (frozen) lane order when given; people missing from it —
  // e.g. added since the last "refresh layout" — append on the right in a
  // stable birth-date order.
  const order = laneOrder || computeLaneOrder(persons, relationships, typeRoles)
  const orderIdx = new Map(order.map((id, i) => [id, i]))
  dated.sort((a, b) => {
    const ia = orderIdx.has(a.id) ? orderIdx.get(a.id) : Infinity
    const ib = orderIdx.has(b.id) ? orderIdx.get(b.id) : Infinity
    if (ia !== ib) return ia - ib
    return birthOf(a) - birthOf(b) || (a.name || '').localeCompare(b.name || '')
  })

  const extra = extraYears.filter((y) => Number.isFinite(y))
  const minYear = Math.min(
    dated.length ? Math.min(...dated.map(birthOf)) : refYear - 50,
    ...(extra.length ? [Math.floor(Math.min(...extra))] : [])
  )
  let maxYear = Math.max(minYear + 10, ...extra)
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
      lane: i,
      laneX: X0 + i * LANE_W,
      birthYear: birth,
      endYear: end,
      dead,
      gender: p.gender,
      name: p.name || 'Unnamed',
      // Raw parts of the label below, so the drawing code can format it in
      // the UI language (this module stays i18n-free).
      unnamed: !p.name,
      bYear: p.birth.year,
      dYear: dead ? p.death.year : null,
      age,
      image: p.primary_image || null,
      yearsLabel: dead
        ? `${p.birth.year}–${p.death.year} · ${age} yr`
        : `b. ${p.birth.year} · ${age} yr`
    }
  })
  const laneById = new Map(people.map((p) => [p.id, p]))
  const personById = new Map(persons.map((p) => [p.id, p]))

  const marriages = []
  for (const r of relationships) {
    if (r.type === 'spouse') {
      const a = laneById.get(r.person_a_id)
      const b = laneById.get(r.person_b_id)
      if (!a || !b) continue
      const pa = personById.get(r.person_a_id)
      const pb = personById.get(r.person_b_id)

      const { year, estimated } = marriageYear(r, pa, pb, refYear)
      const divorced = r.status === 'divorced'
      // Badge text; the renderer draws `badgeIcon` (an icon name) before it.
      const badge = estimated ? 'add year' : String(year)
      const badgeIcon = divorced ? 'heart-crack' : 'heart-handshake'
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
        badgeIcon,
        bw: badge.length * 6.6 + 33,
        endedYear: toOrdinal(r.ended) ?? null
      })
    }
  }

  // One branch per child per parent set, hanging off the family's stem.
  const { families, branches } = buildFamilies(people, relationships, marriages, typeRoles)

  // Sprout: lanes become slots in time — reused once their occupant is gone,
  // each newborn taking the free slot nearest its parents' stem.
  let laneCount = people.length
  if (mode === 'sprout' && people.length) {
    for (const b of branches) b.sprout = b.primary
    const rank = new Map(people.map((p) => [p.id, p.i]))
    const lanes = packSproutLanes(people, rank, branches, marriages)
    laneCount = 0
    for (const p of people) {
      p.lane = lanes.get(p.id) ?? 0
      p.laneX = X0 + p.lane * LANE_W
      laneCount = Math.max(laneCount, p.lane + 1)
    }
    for (const m of marriages) {
      const xa = laneById.get(m.ids[0]).laneX,
        xb = laneById.get(m.ids[1]).laneX
      m.laneX1 = Math.min(xa, xb)
      m.laneX2 = Math.max(xa, xb)
    }
  }

  // Rivers: channels are households; children are born inside their parents'
  // channel, so there are no stems or branches to draw (containment shows it).
  let rivers = null
  let worldW = X0 + Math.max(0, laneCount - 1) * LANE_W + 220
  if (mode === 'rivers' && people.length) {
    const rank = new Map(people.map((p) => [p.id, p.i]))
    const rv = layoutHouseholdRivers(people, families, branches, marriages, rank, {
      leaveHomeAge,
      x0: X0
    })
    for (const p of people) {
      p.path = rv.paths.get(p.id) || null
      if (p.path) p.laneX = rv.birthX.get(p.id)
    }
    for (const m of marriages) {
      const c = rv.confluences.get(m.id)
      if (!c) continue
      if (m.estimated) m.year = c.year
      m.laneX1 = Math.min(c.xa, c.xb)
      m.laneX2 = Math.max(c.xa, c.xb)
    }
    rivers = { households: rv.households, stints: rv.stints, families, branches }
    worldW = rv.maxX + 220
  }
  const isRivers = !!rivers

  return {
    people,
    marriages,
    families: isRivers ? [] : families,
    branches: isRivers ? [] : branches,
    rivers,
    mode: isRivers ? 'rivers' : mode === 'sprout' ? 'sprout' : 'lanes',
    laneCount,
    minYear,
    maxYear,
    yearSpan,
    worldWBase: worldW,
    undatedCount: persons.length - people.length
  }
}
