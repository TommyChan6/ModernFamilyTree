// Pure layout math for the Bubbles medium — no Vue, DOM, or store.
//
// Everyone becomes a circle whose AREA tracks a chosen metric (radius ∝
// sqrt(value + 1)); people are bucketed into groups, each group is packed into
// its own enclosing circle, and the group circles are packed together with
// d3.pack. Leaf radii are set directly (pack.radius), so world units are
// stable across layouts: a bubble is the same size whether it sits among 10
// people or 10 000 — the camera, not the layout, decides how big it looks.

import { hierarchy, pack } from 'd3'
import { isDeceased, ageOf } from './peopleLayout.js'

export const SIZE_MODES = [
  { id: 'kin', label: 'Connections' },
  { id: 'children', label: 'Children' },
  { id: 'age', label: 'Age' },
  { id: 'equal', label: 'Equal' }
]

export const GROUP_MODES = [
  { id: 'gender', label: 'Gender' },
  { id: 'decade', label: 'Decade' },
  { id: 'tag', label: 'Group' },
  { id: 'life', label: 'Life' },
  { id: 'family', label: 'Family' },
  { id: 'none', label: 'None' }
]

export const R_MAX = 60 // world radius of the biggest bubble
export const R_MIN = 11 // floor so value-0 people stay visible / clickable
export const R_EQUAL = 30
export const LEAF_PAD = 3 // gap between bubbles inside a group (world units)
export const GROUP_PAD = 14 // rim between a group's bubbles and its circle
export const ROOT_PAD = 34 // gap between group circles

// ── Size metric ──────────────────────────────────────────────────────────────
export function sizeValue(p, mode, statsOf, refYear) {
  if (mode === 'equal') return 0
  if (mode === 'age') return ageOf(p, refYear) ?? 0
  const s = statsOf(p.id) || { kin: 0, children: 0 }
  return mode === 'children' ? s.children || 0 : s.kin || 0
}

// Radius for every person under `mode` (Map id → r). The largest value maps
// to R_MAX; area stays proportional to value + 1 above the R_MIN floor.
export function radiiFor(persons, mode, statsOf, refYear) {
  const out = new Map()
  if (mode === 'equal') {
    persons.forEach((p) => out.set(p.id, R_EQUAL))
    return out
  }
  const vals = persons.map((p) => Math.max(0, sizeValue(p, mode, statsOf, refYear)))
  const max = vals.reduce((m, v) => (v > m ? v : m), 0)
  persons.forEach((p, i) => {
    const r = R_MAX * Math.sqrt((vals[i] + 1) / (max + 1))
    out.set(p.id, Math.max(R_MIN, r))
  })
  return out
}

// ── Grouping ─────────────────────────────────────────────────────────────────
// Connected components over the relationships whose BOTH ends are in `persons`
// (union–find with path halving). Returns Map id → root id.
export function familyComponents(persons, relationships) {
  const parent = new Map()
  persons.forEach((p) => parent.set(p.id, p.id))
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)))
      x = parent.get(x)
    }
    return x
  }
  for (const r of relationships || []) {
    if (!parent.has(r.person_a_id) || !parent.has(r.person_b_id)) continue
    const a = find(r.person_a_id)
    const b = find(r.person_b_id)
    if (a !== b) parent.set(a, b)
  }
  const out = new Map()
  persons.forEach((p) => out.set(p.id, find(p.id)))
  return out
}

const surnameOf = (name) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  return parts.length >= 2 ? parts[parts.length - 1] : ''
}

// Categorical data hue (golden angle) — colors for families / decades that
// have no intrinsic color. Mid lightness reads on both themes.
const hueColor = (h) => `hsl(${Math.round(h) % 360} 62% 58%)`

// Bucket `persons` into ordered groups: [{ key, label, color, members }].
// ctx: { tagsOf: Map, relationships, refYear, colors: { male, female, unknown } }
// mode 'none' → a single group with key '' (the view draws no circle for it).
export function groupPersons(persons, mode, ctx = {}) {
  const { tagsOf, relationships, refYear = new Date().getFullYear(), colors = {} } = ctx
  if (mode === 'none') {
    return [{ key: '', label: 'Everyone', color: 'var(--accent)', members: [...persons] }]
  }
  const buckets = new Map()
  const add = (key, meta, p) => {
    let b = buckets.get(key)
    if (!b) buckets.set(key, (b = { key, ...meta, members: [] }))
    b.members.push(p)
  }

  if (mode === 'gender') {
    for (const p of persons) {
      const g = (p.gender || '').trim().toLowerCase()
      if (g === 'female') add('female', { label: 'Female', color: colors.female, order: 0 }, p)
      else if (g === 'male') add('male', { label: 'Male', color: colors.male, order: 1 }, p)
      else add('other', { label: 'Other / unknown', color: colors.unknown, order: 2 }, p)
    }
  } else if (mode === 'life') {
    for (const p of persons) {
      if (isDeceased(p, refYear))
        add('dead', { label: 'Deceased', color: 'var(--t2)', order: 1 }, p)
      else add('alive', { label: 'Living', color: 'var(--green)', order: 0 }, p)
    }
  } else if (mode === 'decade') {
    for (const p of persons) {
      const y = p.birth?.year
      if (typeof y !== 'number' || !isFinite(y)) {
        add('none', { label: 'Unknown birth', color: 'var(--t3)', order: Infinity }, p)
      } else {
        const d = Math.floor(y / 10) * 10
        add('d' + d, { label: d + 's', order: d }, p)
      }
    }
    // Sweep a cool→warm ramp across the decades actually present.
    const decs = [...buckets.values()].filter((b) => b.order !== Infinity)
    const lo = Math.min(...decs.map((b) => b.order))
    const hi = Math.max(...decs.map((b) => b.order))
    decs.forEach((b) => {
      const t = hi > lo ? (b.order - lo) / (hi - lo) : 0.5
      b.color = hueColor(215 - t * 190)
    })
  } else if (mode === 'tag') {
    for (const p of persons) {
      const tag = tagsOf?.get(p.id)?.[0]
      if (tag)
        add(
          't' + tag.id,
          { label: tag.label || 'Group', color: tag.color || '', icon: tag.icon || '', order: 0 },
          p
        )
      else add('none', { label: 'Ungrouped', color: 'var(--t3)', order: 1 }, p)
    }
  } else if (mode === 'family') {
    const comp = familyComponents(persons, relationships)
    const sizes = new Map()
    comp.forEach((root) => sizes.set(root, (sizes.get(root) || 0) + 1))
    for (const p of persons) {
      const root = comp.get(p.id)
      if (sizes.get(root) < 2)
        add('solo', { label: 'Unconnected', color: 'var(--t3)', order: 1 }, p)
      else add('f' + root, { label: '', order: 0 }, p)
    }
    let fi = 0
    for (const b of buckets.values()) {
      if (b.key === 'solo') continue
      // Name a family by its most common surname.
      const counts = new Map()
      b.members.forEach((m) => {
        const s = surnameOf(m.name)
        if (s) counts.set(s, (counts.get(s) || 0) + 1)
      })
      let best = ''
      let bestN = 0
      counts.forEach((n, s) => {
        if (n > bestN || (n === bestN && s < best)) {
          best = s
          bestN = n
        }
      })
      b.label = best ? `${best} family` : `Family ${fi + 1}`
      b.color = hueColor(28 + fi * 137.508)
      fi++
    }
  }

  const list = [...buckets.values()]
  list.sort((a, b) => {
    if (a.order !== b.order) return a.order < b.order ? -1 : 1
    if (mode === 'tag' || mode === 'family') {
      if (b.members.length !== a.members.length) return b.members.length - a.members.length
      return a.label.localeCompare(b.label)
    }
    return 0
  })
  return list.map(({ order: _o, ...g }) => g)
}

// ── Packing ──────────────────────────────────────────────────────────────────
// groups: output of groupPersons; radii: Map id → r.
// Returns {
//   nodes:  Map id → { id, p, x, y, r, gi, ii }  (p = the person)   (gi = group index, ii = index in group)
//   groups: [{ key, label, color, icon, count, x, y, r, index }]  (empty for mode 'none')
//   root:   { x, y, r }, bounds: { x0, y0, x1, y1 }, maxR (largest bubble)
// }
// World origin is the root circle's centre. Leaves are ordered by radius
// (desc) then id, so the Directory's sort never reshuffles the chart.
export function packLayout(groups, radii, opts = {}) {
  const { leafPad = LEAF_PAD, groupPad = GROUP_PAD, rootPad = ROOT_PAD } = opts
  const flat = groups.length === 1 && groups[0].key === ''
  const byR = (a, b) => b.r - a.r || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const leavesOf = (g) =>
    g.members.map((p) => ({ id: p.id, r: radii.get(p.id) || R_MIN, person: p })).sort(byR)

  const data = flat
    ? { children: leavesOf(groups[0]) }
    : {
        children: groups
          .filter((g) => g.members.length)
          .map((g) => ({ group: g, children: leavesOf(g) }))
      }
  if (!flat) {
    // Big groups first: the pack front-chain puts early circles near the centre.
    const area = (c) => c.children.reduce((s, l) => s + l.r * l.r, 0)
    data.children.forEach((c) => (c._area = area(c)))
    data.children.sort((a, b) => b._area - a._area)
  }

  // Radius mode: d3 grows each child by padding(parent)/2 while packing, so
  // siblings end up `padding` apart and the parent's rim is padding/2. Groups
  // want a wider rim than the bubble gap, so group circles are inflated and
  // re-packed afterwards (their bubbles translate along with them).
  const root = hierarchy(data)
  pack()
    .size([0, 0])
    .radius((d) => d.data.r)
    .padding(leafPad)(root)

  const nodes = new Map()
  const outGroups = []
  if (flat) {
    for (const leaf of root.children || []) {
      nodes.set(leaf.data.id, {
        id: leaf.data.id,
        p: leaf.data.person,
        x: leaf.x,
        y: leaf.y,
        r: leaf.r,
        gi: 0,
        ii: nodes.size
      })
    }
    const bounds = boundsOf([...nodes.values()])
    return {
      nodes,
      groups: outGroups,
      root: { x: root.x, y: root.y, r: root.r },
      bounds,
      maxR: maxROf(nodes)
    }
  }

  const gNodes = root.children || []
  const rim = Math.max(0, groupPad - leafPad / 2)
  const circles = gNodes.map((g) => ({ g, x: g.x, y: g.y, r: g.r + rim }))
  const repacked = packCircles(circles, rootPad)
  gNodes.forEach((g, gi) => {
    const c = repacked[gi]
    const dx = c.x - g.x
    const dy = c.y - g.y
    ;(g.children || []).forEach((leaf, ii) => {
      nodes.set(leaf.data.id, {
        id: leaf.data.id,
        p: leaf.data.person,
        x: leaf.x + dx,
        y: leaf.y + dy,
        r: leaf.r,
        gi,
        ii
      })
    })
    const gd = g.data.group
    outGroups.push({
      key: gd.key,
      label: gd.label,
      color: gd.color || 'var(--accent)',
      icon: gd.icon || '',
      count: gd.members.length,
      x: c.x,
      y: c.y,
      r: c.r,
      index: gi
    })
  })
  const enc = encloseOf(repacked, rootPad)
  // Recentre the whole chart on the origin.
  const ox = enc.x
  const oy = enc.y
  nodes.forEach((n) => {
    n.x -= ox
    n.y -= oy
  })
  outGroups.forEach((g) => {
    g.x -= ox
    g.y -= oy
  })
  return {
    nodes,
    groups: outGroups,
    root: { x: 0, y: 0, r: enc.r },
    bounds: boundsOf(outGroups),
    maxR: maxROf(nodes)
  }
}

function maxROf(nodes) {
  let m = 0
  for (const n of nodes.values()) if (n.r > m) m = n.r
  return m || R_EQUAL
}

// Axis-aligned extent of a set of circles ({ x0, y0, x1, y1 }).
export function boundsOf(circles) {
  if (!circles.length) return { x0: -1, y0: -1, x1: 1, y1: 1 }
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const c of circles) {
    if (c.x - c.r < x0) x0 = c.x - c.r
    if (c.y - c.r < y0) y0 = c.y - c.r
    if (c.x + c.r > x1) x1 = c.x + c.r
    if (c.y + c.r > y1) y1 = c.y + c.r
  }
  return { x0, y0, x1, y1 }
}

// Pack already-sized circles (in order) with a gap, using d3's sibling packer
// via a throwaway hierarchy (keeps the dependency surface to d3.pack).
function packCircles(circles, gap) {
  const root = hierarchy({ children: circles.map((c, i) => ({ i, r: c.r })) })
  pack()
    .size([0, 0])
    .radius((d) => d.data.r)
    .padding(gap)(root)
  const out = new Array(circles.length)
  for (const ch of root.children || []) out[ch.data.i] = { x: ch.x, y: ch.y, r: ch.data.r }
  return out
}

// Smallest-ish enclosing circle of placed circles (+ pad): centroid of the
// bounding extremes, radius to the farthest rim. Not minimal, but tight
// enough for camera fitting and always contains every circle.
function encloseOf(circles, pad) {
  if (!circles.length) return { x: 0, y: 0, r: 1 }
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const c of circles) {
    x0 = Math.min(x0, c.x - c.r)
    y0 = Math.min(y0, c.y - c.r)
    x1 = Math.max(x1, c.x + c.r)
    y1 = Math.max(y1, c.y + c.r)
  }
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  let r = 0
  for (const c of circles) r = Math.max(r, Math.hypot(c.x - cx, c.y - cy) + c.r)
  return { x: cx, y: cy, r: r + pad * 0.5 }
}

// ── Camera ───────────────────────────────────────────────────────────────────
// A view is { cx, cy, w }: the world point at the viewport centre and the
// world width that spans the viewport's SHORTER side — resize-stable and the
// exact parameterisation d3.interpolateZoom expects.
export function viewToTransform(view, W, H) {
  const k = Math.min(W, H) / Math.max(1e-6, view.w)
  return { k, tx: W / 2 - view.cx * k, ty: H / 2 - view.cy * k }
}

// View that fits a circle with `margin` screen px of breathing room per side.
export function fitView(circle, W, H, margin = 48) {
  const m = Math.min(W, H)
  const avail = Math.max(40, m - margin * 2)
  return { cx: circle.x, cy: circle.y, w: (2 * circle.r * m) / avail }
}

// View that fits a bounding box (wide layouts use the whole viewport width).
// `margin` is screen px: a number, or { t, r, b, l } for uneven chrome (the
// floating toolbar eats the top edge).
export function fitBounds(b, W, H, margin = 48) {
  const m = typeof margin === 'number' ? { t: margin, r: margin, b: margin, l: margin } : margin
  const bw = Math.max(1, b.x1 - b.x0)
  const bh = Math.max(1, b.y1 - b.y0)
  const aw = Math.max(40, W - m.l - m.r)
  const ah = Math.max(40, H - m.t - m.b)
  const k = Math.min(aw / bw, ah / bh)
  // Centre the box in the available region, which may sit off the viewport centre.
  const offX = (m.l + (W - m.r)) / 2 - W / 2
  const offY = (m.t + (H - m.b)) / 2 - H / 2
  return {
    cx: (b.x0 + b.x1) / 2 - offX / k,
    cy: (b.y0 + b.y1) / 2 - offY / k,
    w: Math.min(W, H) / k
  }
}

// Is a world circle within the viewport (expanded by `pad` screen px)?
export function circleOnScreen(x, y, r, t, W, H, pad = 0) {
  const sx = x * t.k + t.tx
  const sy = y * t.k + t.ty
  const sr = r * t.k
  return sx + sr >= -pad && sx - sr <= W + pad && sy + sr >= -pad && sy - sr <= H + pad
}

// Level of detail from on-screen diameter (px).
export function tierOf(screenD) {
  if (screenD < 14) return 'dot'
  if (screenD < 58) return 'sm'
  if (screenD < 140) return 'md'
  return 'lg'
}

// ── Easing ───────────────────────────────────────────────────────────────────
// A damped spring sampled into a CSS `linear()` easing string: a real wobble
// (overshoot + settle) that the compositor runs with no per-frame JS.
export function springEasing(damping = 0.62, omega = 10, samples = 40) {
  const z = damping
  const wd = omega * Math.sqrt(1 - z * z)
  const pts = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const v =
      1 - Math.exp(-z * omega * t) * (Math.cos(wd * t) + ((z * omega) / wd) * Math.sin(wd * t))
    pts.push(i === samples ? '1' : (Math.round(v * 1000) / 1000).toString())
  }
  return `linear(${pts.join(', ')})`
}
