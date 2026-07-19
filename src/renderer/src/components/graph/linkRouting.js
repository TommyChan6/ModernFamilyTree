// Link ROUTE systems — pure geometry, no D3/Three/store dependency.
//
// A "route" is how a link travels between its endpoints, independent of its
// color/dash/width styling. Every route returns the same shape as
// linkCurvePoints() — `{ points: [{x,y} × segments+1], control: {x,y} }` —
// so the WebGL ribbon tessellation, arrowhead orientation (tangent from the
// second-to-last point) and analytic picking all consume any route unchanged.
//
// Routes:
//   organic  — the classic quadratic Bézier with per-edge deterministic bend
//   straight — dead-straight lines
//   arc      — sweeping half-moon curves (parallel edges fan apart)
//   elbow    — orthogonal right-angle runs with rounded corners (flowchart)
//   trident  — genealogy bus routing: the couple bar joins the parents, a stem
//              drops to a sibling rail, children hang from the rail (the
//              upside-down trident). Needs the family context stamped by
//              stampFamilyContext().
//   circuit  — axis-then-45° chamfered traces (PCB / sci-fi schematic)
//   wave     — a sinuous ripple that anchors flat at both endpoints
//
// Family-aware routes only reshape STRUCTURAL edges (symmetryRole 'vertical'
// gets the bus, 'horizontal' becomes the couple bar); affinity overlays keep
// a soft organic curve so social context stays visually distinct.

import { linkCurvePoints } from './linkHelpers.js'

/** Deterministic per-edge hash (same recipe as linkHelpers) — stable bends. */
function edgeHash(d) {
  let hash = 0
  const idStr = d.id || ''
  for (let i = 0; i < idStr.length; i++) hash = ((hash << 5) - hash + idStr.charCodeAt(i)) | 0
  return hash
}

const xy = (n) => ({ x: n.x || 0, y: n.y || 0 })

// ── Family context ───────────────────────────────────────────────────────────
// Walks the wired links (source/target already resolved to node objects by the
// simulation) and stamps every structural edge with:
//   d._role — 'v' (parent→child) | 'h' (couple) | 'n' (everything else)
//   d._fam  — shared per-family object { parents:[node…], children:[node…] }
//             (same reference across the whole sibling group, so the bus rail
//             computes identically for every edge that shares it)
// Re-run whenever the data changes; reads positions live at draw time.
export function stampFamilyContext(links, typeRoles) {
  const roleOf = (t) => {
    const r = typeRoles?.get?.(t)
    if (r) return r
    if (t === 'parent_child' || t === 'adopted') return 'vertical'
    if (t === 'spouse' || t === 'partner') return 'horizontal'
    return 'none'
  }

  // Parents per child (person_a is the parent side of a vertical edge).
  const parentsOf = new Map() // childId -> Map(parentId -> parentNode)
  for (const d of links) {
    if (typeof d.source !== 'object' || typeof d.target !== 'object') continue
    d._role = roleOf(d.type) === 'vertical' ? 'v' : roleOf(d.type) === 'horizontal' ? 'h' : 'n'
    if (d._role !== 'v') {
      d._fam = null
      continue
    }
    let m = parentsOf.get(d.target.id)
    if (!m) {
      m = new Map()
      parentsOf.set(d.target.id, m)
    }
    m.set(d.source.id, d.source)
  }

  // Group children by their (sorted) parent set → one shared family object,
  // then stamp the fam ref on every vertical edge of that sibling group.
  const families = new Map() // coupleKey -> { parents, children }
  for (const d of links) {
    if (d._role !== 'v') continue
    const pm = parentsOf.get(d.target.id)
    const key = [...pm.keys()].sort().join('~')
    let fam = families.get(key)
    if (!fam) {
      fam = { parents: [...pm.values()], children: [] }
      families.set(key, fam)
    }
    if (!fam.children.includes(d.target)) fam.children.push(d.target)
    d._fam = fam
  }
}

// ── Polyline machinery ───────────────────────────────────────────────────────

/** Round every interior corner of a polyline with a quadratic fillet, then
 *  resample to exactly `segments+1` points spaced uniformly by arc length. */
function polyRoute(rawPts, segments, cornerR = 12) {
  // Drop zero-length segments so fillet math never divides by ~0.
  const pts = []
  for (const p of rawPts) {
    const last = pts[pts.length - 1]
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.75) pts.push(p)
  }
  if (pts.length < 2) {
    const p = pts[0] || { x: 0, y: 0 }
    const flat = new Array(segments + 1).fill(0).map(() => ({ x: p.x, y: p.y }))
    return { points: flat, control: flat[segments] }
  }

  // Fillet pass: replace each interior vertex with a small quadratic arc.
  const dense = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1],
      v = pts[i],
      b = pts[i + 1]
    const la = Math.hypot(v.x - a.x, v.y - a.y)
    const lb = Math.hypot(b.x - v.x, b.y - v.y)
    const r = Math.min(cornerR, la * 0.45, lb * 0.45)
    if (r < 0.5) {
      dense.push(v)
      continue
    }
    const inX = v.x - ((v.x - a.x) / la) * r,
      inY = v.y - ((v.y - a.y) / la) * r
    const outX = v.x + ((b.x - v.x) / lb) * r,
      outY = v.y + ((b.y - v.y) / lb) * r
    // 4 samples along the quadratic fillet (control = the sharp corner).
    for (let s = 0; s <= 3; s++) {
      const t = s / 3,
        u = 1 - t
      dense.push({
        x: u * u * inX + 2 * u * t * v.x + t * t * outX,
        y: u * u * inY + 2 * u * t * v.y + t * t * outY
      })
    }
  }
  dense.push(pts[pts.length - 1])

  // Uniform arc-length resample to segments+1 points.
  const cum = [0]
  for (let i = 1; i < dense.length; i++)
    cum.push(cum[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y))
  const total = cum[cum.length - 1] || 1
  const points = []
  let k = 0
  for (let i = 0; i <= segments; i++) {
    const target = (i / segments) * total
    while (k < dense.length - 2 && cum[k + 1] < target) k++
    const span = cum[k + 1] - cum[k] || 1
    const t = Math.min(1, Math.max(0, (target - cum[k]) / span))
    points.push({
      x: dense[k].x + (dense[k + 1].x - dense[k].x) * t,
      y: dense[k].y + (dense[k + 1].y - dense[k].y) * t
    })
  }
  return { points, control: points[segments - 1] }
}

// ── Individual routes ────────────────────────────────────────────────────────

function tridentRoute(d, segments) {
  if (d._role === 'h') {
    // The couple bar: a clean straight tie between partners.
    return linkCurvePoints(d, 0, segments)
  }
  if (d._role !== 'v' || !d._fam || typeof d.source !== 'object') {
    // Affinity overlays stay softly organic so they read as a different layer.
    return linkCurvePoints(d, 0.07, segments)
  }
  const P = xy(d.source),
    C = xy(d.target)
  const fam = d._fam
  // Junction: the midpoint of the couple, or the lone parent.
  const J =
    fam.parents.length >= 2
      ? {
          x: fam.parents.reduce((s, p) => s + p.x, 0) / fam.parents.length,
          y: fam.parents.reduce((s, p) => s + p.y, 0) / fam.parents.length
        }
      : { x: P.x, y: P.y }
  // Sibling rail: drop a fraction of the way toward the nearest child, so the
  // whole sibling group shares one rail whatever the layout.
  let nearest = Infinity,
    sum = 0
  for (const c of fam.children) {
    const dy = c.y - J.y
    sum += dy
    if (Math.abs(dy) < Math.abs(nearest)) nearest = dy
  }
  const sign = sum >= 0 ? 1 : -1
  const drop = Math.max(20, Math.min(Math.abs(nearest) * 0.55, 150))
  const railY = J.y + sign * drop
  const pts = [P]
  if (fam.parents.length >= 2) pts.push(J)
  pts.push({ x: J.x, y: railY }, { x: C.x, y: railY }, C)
  return polyRoute(pts, segments, 13)
}

function elbowRoute(d, segments) {
  if (typeof d.source !== 'object') return linkCurvePoints(d, 0, segments)
  if (d._role === 'n') return linkCurvePoints(d, 0.07, segments)
  const S = xy(d.source),
    T = xy(d.target)
  if (d._role === 'h') {
    // Couples: horizontal-first Z so side-by-side pairs get a straight bar.
    const midX = (S.x + T.x) / 2
    return polyRoute([S, { x: midX, y: S.y }, { x: midX, y: T.y }, T], segments, 11)
  }
  const midY = (S.y + T.y) / 2
  return polyRoute([S, { x: S.x, y: midY }, { x: T.x, y: midY }, T], segments, 11)
}

function circuitRoute(d, segments) {
  if (typeof d.source !== 'object') return linkCurvePoints(d, 0, segments)
  const S = xy(d.source),
    T = xy(d.target)
  const dx = T.x - S.x,
    dy = T.y - S.y
  // Run along the dominant axis, then a 45° chamfer into the target.
  let mid
  if (Math.abs(dy) >= Math.abs(dx)) {
    mid = { x: S.x, y: T.y - Math.sign(dy || 1) * Math.abs(dx) }
  } else {
    mid = { x: T.x - Math.sign(dx || 1) * Math.abs(dy), y: S.y }
  }
  return polyRoute([S, mid, T], segments, 6)
}

function waveRoute(d, segments) {
  if (typeof d.source !== 'object') return linkCurvePoints(d, 0, segments)
  const S = xy(d.source),
    T = xy(d.target)
  const dx = T.x - S.x,
    dy = T.y - S.y
  const dist = Math.hypot(dx, dy) || 1
  const nx = -dy / dist,
    ny = dx / dist
  const cycles = Math.max(1, Math.min(3, Math.round(dist / 130)))
  const amp = Math.min(9, dist * 0.055)
  const phase = edgeHash(d) & 1 ? 0 : Math.PI
  const points = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    // The envelope sin(πt) pins both ends flat on the endpoints.
    const off = Math.sin(t * Math.PI * 2 * cycles + phase) * amp * Math.sin(Math.PI * t)
    points.push({ x: S.x + dx * t + nx * off, y: S.y + dy * t + ny * off })
  }
  return { points, control: points[segments - 1] }
}

// ── Entry point ──────────────────────────────────────────────────────────────

/** Route a link according to gs.linkRoute. Drop-in replacement for
 *  linkCurvePoints(d, gs.lineCurvature, segments). */
export function routePoints(d, gs, segments = 14) {
  switch (gs.linkRoute) {
    case 'straight':
      return linkCurvePoints(d, 0, segments)
    case 'arc':
      return linkCurvePoints(d, 0.24, segments)
    case 'elbow':
      return elbowRoute(d, segments)
    case 'trident':
      return tridentRoute(d, segments)
    case 'circuit':
      return circuitRoute(d, segments)
    case 'wave':
      return waveRoute(d, segments)
    default:
      return linkCurvePoints(d, gs.lineCurvature, segments)
  }
}
