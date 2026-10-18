// Pure helpers behind the Timeline's edit tools (no Vue, no canvas): the tool
// catalog, lane insertion for new people, retiming a birth/death trait of any
// supported type, drag → event span, and the geometry of a traced kinship
// chain drawn across lifelines.

import { X0, LANE_W } from './timelineLayout.js'

/** The Timeline's edit tools (rendered in the canvas-toggle "Edit" rail);
 *  `icon` is an icon name (components/ui/icons.js). `labelKey` / `hintKey`
 *  are i18n keys translated where rendered; `label` / `hint` stay as the
 *  English fallback. */
export const TIMELINE_TOOLS = [
  {
    id: 'add',
    labelKey: 'timeline.tools.add.label',
    hintKey: 'timeline.tools.add.hint',
    icon: 'user-plus',
    label: 'Add',
    color: '#4caf72',
    key: '1',
    hint: 'Click anywhere — a new life begins at that year'
  },
  {
    id: 'child',
    labelKey: 'timeline.tools.child.label',
    hintKey: 'timeline.tools.child.hint',
    icon: 'baby',
    label: 'Child',
    color: '#f5a623',
    key: '2',
    hint: 'Click a lifeline at the year the child is born'
  },
  {
    id: 'link',
    labelKey: 'timeline.tools.link.label',
    hintKey: 'timeline.tools.link.hint',
    icon: 'link',
    label: 'Link',
    color: '#f06292',
    key: '3',
    hint: 'Click one life, then another — pick what binds them'
  },
  {
    id: 'event',
    labelKey: 'timeline.tools.event.label',
    hintKey: 'timeline.tools.event.hint',
    icon: 'calendar-plus',
    label: 'Event',
    color: '#a06cf5',
    key: '4',
    hint: 'Click for a moment · drag up/down for a span'
  },
  {
    id: 'retime',
    labelKey: 'timeline.tools.retime.label',
    hintKey: 'timeline.tools.retime.hint',
    icon: 'move-vertical',
    label: 'Retime',
    color: '#26c6da',
    key: '5',
    hint: 'Drag a birth, death, marriage or event — or a whole life'
  },
  {
    id: 'delete',
    labelKey: 'timeline.tools.delete.label',
    hintKey: 'timeline.tools.delete.hint',
    icon: 'trash-2',
    label: 'Delete',
    color: '#ef5350',
    key: '6',
    hint: 'Click a life, marriage or event to remove it'
  }
]
export function timelineTool(id) {
  return TIMELINE_TOOLS.find((t) => t.id === id) || null
}

/**
 * Insert `id` into a frozen lane order at the lane under world x (unscaled),
 * or right after `afterId` when given. Ids in `order` that aren't on the
 * timeline (undated people) keep their relative spots.
 */
export function insertLane(order, layoutPeople, id, { worldX = null, afterId = null } = {}) {
  const base = (order || []).filter((x) => x !== id)
  if (afterId != null) {
    const i = base.indexOf(afterId)
    if (i !== -1) {
      base.splice(i + 1, 0, id)
      return base
    }
  }
  if (worldX == null || !layoutPeople.length) return [...base, id]
  const k = Math.round((worldX - X0) / LANE_W)
  if (k >= layoutPeople.length) return [...base, id]
  const before = layoutPeople[Math.max(0, k)].id
  const i = base.indexOf(before)
  if (i === -1) return [...base, id]
  base.splice(i, 0, id)
  return base
}

const yearOf = (d) => (d && Number.isFinite(d.year) ? d.year : null)
const ydate = (y) => ({ year: y, month: null, day: null, precision: 'year', calendar: 'gregorian' })
const shiftDate = (d, by) => (d ? { ...d, year: d.year + by } : null)

/** The representative year of a birth/death-slot value (ranges → midpoint). */
export function slotYear(def, value) {
  if (!def || value == null) return null
  switch (def.type) {
    case 'date':
      return yearOf(value)
    case 'number':
      return Number.isFinite(value) ? value : null
    case 'number_range': {
      const { a, b } = value
      if (a != null && b != null) return Math.round((a + b) / 2)
      return a ?? b ?? null
    }
    case 'date_range': {
      const a = yearOf(value.from),
        b = yearOf(value.to)
      if (a != null && b != null) return Math.round((a + b) / 2)
      return a ?? b
    }
    default:
      return null
  }
}

/**
 * Move a birth/death-slot value so its representative year lands on `year`,
 * keeping its shape (month/day precision, range width). Returns the new value,
 * or undefined when the def's type can't be retimed (custom calendars).
 */
export function retimeSlotValue(def, value, year) {
  if (!def || !Number.isFinite(year)) return undefined
  const cur = slotYear(def, value)
  const by = cur == null ? null : year - cur
  switch (def.type) {
    case 'date':
      return by == null ? ydate(year) : shiftDate(value, by)
    case 'number':
      return year
    case 'number_range':
      if (by == null) return { a: year, b: null }
      return { a: value.a == null ? null : value.a + by, b: value.b == null ? null : value.b + by }
    case 'date_range':
      if (by == null) return { from: ydate(year), to: null }
      return { from: shiftDate(value.from, by), to: shiftDate(value.to, by) }
    default:
      return undefined
  }
}

/**
 * The trait writes that shift whole lives `delta` years (the graph's and
 * timeline's Time drag): birth AND death move together, so a life keeps its
 * length and never inverts. One entry per person, shaped for
 * store.setFieldValuesBatch (one atomic write = one undo step).
 * `valueOf(personId, fieldId)` reads a stored value; a person with no birth
 * value is dated `fallbackYear(id) + delta` (kept before their death).
 * `unsupported` = a slot def whose type can't be retimed (custom calendars) —
 * nothing is returned then, so a selection never moves half-way.
 * `birthOnly` (the graph's Retime mode): only the birth moves, clamped so it
 * never passes the death; people whose birth wouldn't change are left out.
 */
export function shiftLivesUpdates(
  defs,
  valueOf,
  ids,
  delta,
  fallbackYear = () => null,
  { birthOnly = false } = {}
) {
  const birthDef = defs.find((d) => d.slot === 'birth')
  const deathDef = defs.find((d) => d.slot === 'death')
  const none = { updates: [], unsupported: false }
  if (!delta || !birthDef) return none
  const updates = []
  for (const id of ids) {
    const b = valueOf(id, birthDef.id) ?? null
    const by = slotYear(birthDef, b)
    // A stored birth this module can't read (custom calendars) can't move.
    if (b != null && by == null) return { updates: [], unsupported: true }
    const dv = deathDef ? (valueOf(id, deathDef.id) ?? null) : null
    const dy = deathDef ? slotYear(deathDef, dv) : null
    const base = by ?? fallbackYear(id)
    if (base == null) continue
    const year =
      by != null && !birthOnly ? base + delta : clampRetime('birth', base + delta, { end: dy })
    if (by != null && year === by) continue // clamped against the death: no change
    const nb = retimeSlotValue(birthDef, b, year)
    if (nb === undefined) return { updates: [], unsupported: true }
    const values = [{ field_id: birthDef.id, value: nb }]
    if (!birthOnly && by != null && dy != null) {
      const nd = retimeSlotValue(deathDef, dv, dy + delta)
      if (nd === undefined) return { updates: [], unsupported: true }
      values.push({ field_id: deathDef.id, value: nd })
    }
    updates.push({ personId: id, values })
  }
  return { updates, unsupported: false }
}

/** Clamp a dragged year so a life never inverts (birth ≤ death). */
export function clampRetime(kind, year, { birth = null, end = null } = {}) {
  const y = Math.round(year)
  if (kind === 'birth' && end != null) return Math.min(y, end)
  if (kind === 'death' && birth != null) return Math.max(y, birth)
  return y
}

/** A vertical drag in Event mode → a moment or a span (years, ordered). */
export function spanFromDrag(yearA, yearB) {
  const a = Math.round(yearA),
    b = Math.round(yearB)
  if (a === b) return { start: a, end: null }
  return { start: Math.min(a, b), end: Math.max(a, b) }
}

/**
 * Where to draw each hop of a traced chain on the timeline: every relationship
 * becomes a link between two lifelines at a meaningful year — a parent bond at
 * the child's birth, a couple bond at its formed year, anything else midway
 * through the years both were alive.
 * path: { ids, rels }; people: Map id → { birthYear, endYear }.
 * Returns [{ a, b, year, kind }] (kind: 'vertical' | 'horizontal' | 'other').
 */
export function traceSegments(path, people, roleOf = () => 'none') {
  if (!path || !path.rels) return []
  const out = []
  for (let i = 0; i < path.rels.length; i++) {
    const r = path.rels[i]
    const a = path.ids[i],
      b = path.ids[i + 1]
    const pa = people.get(a),
      pb = people.get(b)
    if (!pa || !pb) continue
    const role = roleOf(r.type)
    let year
    if (role === 'vertical') {
      const child = r.person_b_id === a ? pa : pb
      year = child.birthYear
    } else if (role === 'horizontal' && yearOf(r.formed) != null) {
      year = yearOf(r.formed)
    } else {
      const lo = Math.max(pa.birthYear, pb.birthYear)
      const hi = Math.min(pa.endYear, pb.endYear)
      year = hi >= lo ? (lo + hi) / 2 : (pa.birthYear + pb.birthYear) / 2
    }
    out.push({
      a,
      b,
      year,
      kind: role === 'vertical' ? 'vertical' : role === 'horizontal' ? 'horizontal' : 'other'
    })
  }
  return out
}

/**
 * Move a group of lanes so the block lands at display slot `k` among the
 * OTHER dated lanes. `display` = dated ids in on-screen order; `order` = the
 * frozen lane order (it may hold undated ids, which keep their spots, and may
 * miss newcomers, which take their on-screen spot). The group keeps its own
 * on-screen order. Returns the new full order.
 */
export function moveLanes(order, display, group, k) {
  const g = new Set(group)
  const moving = display.filter((id) => g.has(id))
  const known = new Set(order)
  const full = [...order, ...display.filter((id) => !known.has(id))]
  if (!moving.length) return full
  const others = display.filter((id) => !g.has(id))
  const base = full.filter((id) => !g.has(id))
  const kk = Math.max(0, Math.min(others.length, Math.round(k)))
  let at = base.length
  if (kk < others.length) at = base.indexOf(others[kk])
  else if (others.length) at = base.indexOf(others[others.length - 1]) + 1
  base.splice(at, 0, ...moving)
  return base
}

/**
 * The display slot a dragged block lands in: the grabbed lane sits at world x
 * `worldX` and is `idx` lanes into a block; `others` = lanes not moving.
 */
export function laneSlotAt(worldX, others, idx = 0) {
  const k = Math.round((worldX - X0) / LANE_W) - idx
  return Math.max(0, Math.min(others, k))
}

/** The slot a block currently occupies (how many other lanes precede it). */
export function laneSlotOf(display, group) {
  const g = new Set(group)
  const first = display.findIndex((id) => g.has(id))
  return first < 0 ? -1 : display.slice(0, first).filter((id) => !g.has(id)).length
}

export function sameOrder(a, b) {
  if (!a || !b || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}
