// Pure metric + ranking math for the Directory's Ranks medium — no Vue, DOM,
// or store. The view feeds in the roster, the relationship rows and a
// type → symmetryRole lookup; everything here is plain data in, plain data out.

import { ageOf } from './peopleLayout.js'
import { derivedSiblings } from '../graph/graphInsights.js'

// The leaderboard's metrics. `unit` is [singular, plural]; `zeroIsNone` makes a
// zero count read as "no score" (the person drops to the Unranked group rather
// than tying for last with everyone else who has none).
export const METRICS = [
  {
    id: 'age',
    label: 'Age',
    icon: '⏳',
    unit: ['yr', 'yrs'],
    blurb: 'Age at the reference year — full lifespan for the departed',
    zeroIsNone: false
  },
  {
    id: 'connections',
    label: 'Connections',
    icon: '🔗',
    unit: ['link', 'links'],
    blurb: 'Every relationship a person takes part in',
    zeroIsNone: true
  },
  {
    id: 'children',
    label: 'Children',
    icon: '🌱',
    unit: ['child', 'children'],
    blurb: 'Direct children on record',
    zeroIsNone: true
  },
  {
    id: 'descendants',
    label: 'Descendants',
    icon: '🌳',
    unit: ['descendant', 'descendants'],
    blurb: 'Children, grandchildren and every generation below',
    zeroIsNone: true
  },
  {
    id: 'depth',
    label: 'Lineage',
    icon: '🧬',
    unit: ['gen', 'gens'],
    blurb: 'Generations of recorded ancestors above them',
    zeroIsNone: true
  },
  {
    id: 'siblings',
    label: 'Siblings',
    icon: '👥',
    unit: ['sibling', 'siblings'],
    blurb: 'People who share at least one parent',
    zeroIsNone: true
  }
]

export const METRIC_BY_ID = new Map(METRICS.map((m) => [m.id, m]))

export function unitFor(metric, value) {
  if (!metric) return ''
  return Math.round(value) === 1 ? metric.unit[0] : metric.unit[1]
}

const toRoleFn = (roleOf) =>
  typeof roleOf === 'function'
    ? roleOf
    : roleOf && typeof roleOf.get === 'function'
      ? (t) => roleOf.get(t)
      : () => 'none'

// Parent/child adjacency from the vertical edges (person_a is the parent of
// person_b). Self-loops are dropped; duplicate edges collapse into the Sets.
export function buildLineage(relationships, roleOf) {
  const role = toRoleFn(roleOf)
  const childrenOf = new Map()
  const parentsOf = new Map()
  const add = (m, k, v) => {
    let s = m.get(k)
    if (!s) m.set(k, (s = new Set()))
    s.add(v)
  }
  for (const r of relationships || []) {
    if (!r || role(r.type) !== 'vertical') continue
    const a = r.person_a_id
    const b = r.person_b_id
    if (!a || !b || a === b) continue
    add(childrenOf, a, b)
    add(parentsOf, b, a)
  }
  return { childrenOf, parentsOf, roleOf: role }
}

// Distinct descendants of each requested id (children, grandchildren, …).
// Iterative DFS with a visited set, so cycles in bad data terminate and a
// person never counts themself.
export function descendantCounts(ids, childrenOf) {
  const out = new Map()
  for (const id of ids) {
    const kids = childrenOf.get(id)
    if (!kids || !kids.size) {
      out.set(id, 0)
      continue
    }
    const seen = new Set([id])
    const stack = [...kids]
    let n = 0
    while (stack.length) {
      const c = stack.pop()
      if (seen.has(c)) continue
      seen.add(c)
      n++
      const more = childrenOf.get(c)
      if (more) for (const g of more) if (!seen.has(g)) stack.push(g)
    }
    out.set(id, n)
  }
  return out
}

// Longest chain of recorded ancestors above each person (0 = no parents on
// record). Memoized, iterative (no recursion limit on deep lines), and
// cycle-safe: a parent that is still on the DFS stack is ignored.
export function ancestorDepths(ids, parentsOf) {
  const memo = new Map()
  const onStack = new Set()
  for (const start of ids) {
    if (memo.has(start)) continue
    const stack = [{ id: start, it: (parentsOf.get(start) || new Set()).values() }]
    onStack.add(start)
    while (stack.length) {
      const top = stack[stack.length - 1]
      const next = top.it.next()
      if (!next.done) {
        const p = next.value
        if (memo.has(p) || onStack.has(p)) continue
        onStack.add(p)
        stack.push({ id: p, it: (parentsOf.get(p) || new Set()).values() })
        continue
      }
      let best = 0
      for (const p of parentsOf.get(top.id) || []) {
        if (memo.has(p)) best = Math.max(best, memo.get(p) + 1)
      }
      memo.set(top.id, best)
      onStack.delete(top.id)
      stack.pop()
    }
  }
  const out = new Map()
  for (const id of ids) out.set(id, memo.get(id) || 0)
  return out
}

// Siblings = people sharing at least one parent (derived, like the rest of
// the app), plus any explicit sibling-typed rows for half/step exceptions.
export function siblingCounts(ids, relationships, roleOf, siblingKey = 'sibling') {
  const role = toRoleFn(roleOf)
  const sibs = derivedSiblings(relationships || [], role)
  const extra = new Map()
  for (const r of relationships || []) {
    if (!r || r.type !== siblingKey || r.person_a_id === r.person_b_id) continue
    for (const [x, y] of [
      [r.person_a_id, r.person_b_id],
      [r.person_b_id, r.person_a_id]
    ]) {
      let s = extra.get(x)
      if (!s) extra.set(x, (s = new Set()))
      s.add(y)
    }
  }
  const out = new Map()
  for (const id of ids) {
    const a = sibs.get(id)
    const b = extra.get(id)
    if (!b) out.set(id, a ? a.size : 0)
    else if (!a) out.set(id, b.size)
    else out.set(id, new Set([...a, ...b]).size)
  }
  return out
}

// Map id → number | null for one metric over the given people.
// ctx: { statsOf(id) → {kin, children}, refYear, relationships, lineage }
// (`lineage` from buildLineage; built on the fly from relationships +
// ctx.roleOf when absent).
export function metricValues(metricId, persons, ctx = {}) {
  const out = new Map()
  const list = persons || []
  const ids = list.map((p) => p.id)
  const stat = (id, k) => {
    const s = ctx.statsOf ? ctx.statsOf(id) : null
    return s && typeof s[k] === 'number' ? s[k] : 0
  }
  const lineage = () => ctx.lineage || buildLineage(ctx.relationships, ctx.roleOf)
  switch (metricId) {
    case 'age':
      for (const p of list) out.set(p.id, ageOf(p, ctx.refYear ?? new Date().getFullYear()))
      break
    case 'connections':
      for (const id of ids) out.set(id, stat(id, 'kin'))
      break
    case 'children':
      for (const id of ids) out.set(id, stat(id, 'children'))
      break
    case 'descendants':
      return descendantCounts(ids, lineage().childrenOf)
    case 'depth':
      return ancestorDepths(ids, lineage().parentsOf)
    case 'siblings':
      return siblingCounts(ids, ctx.relationships, lineage().roleOf)
    default:
      for (const id of ids) out.set(id, null)
  }
  return out
}

const hasValue = (v, zeroIsNone) =>
  typeof v === 'number' && Number.isFinite(v) && !(zeroIsNone && v === 0)

// Rank the people (in their incoming order) by value, highest first.
// Standard competition ranking — ties share a rank and the next rank skips
// (1, 2, 2, 4). The sort is stable, so ties keep the incoming (toolbar) order.
// People without a value keep their incoming order in `unranked`.
export function rankEntries(ids, values, opts = {}) {
  const { zeroIsNone = false } = opts
  const scored = []
  const unranked = []
  for (const id of ids) {
    const v = values.get(id)
    if (hasValue(v, zeroIsNone)) scored.push({ id, value: v, rank: 0, tied: false })
    else unranked.push(id)
  }
  scored.sort((a, b) => b.value - a.value)
  for (let i = 0; i < scored.length; i++) {
    const e = scored[i]
    e.rank = i > 0 && scored[i - 1].value === e.value ? scored[i - 1].rank : i + 1
    e.tied =
      (i > 0 && scored[i - 1].value === e.value) ||
      (i < scored.length - 1 && scored[i + 1].value === e.value)
  }
  return { ranked: scored, unranked, max: scored.length ? scored[0].value : 0 }
}
