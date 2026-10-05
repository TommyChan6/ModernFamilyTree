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
//   bezier   — cubic curves the user can reshape by dragging (per-link
//              control points stamped as d._curve; see bezierControls)
//   brush    — 水墨 calligraphic sweep: an asymmetric cubic that leans out and
//              flicks back, like a brush stroke (and switches the renderer to
//              brush-stroke shading — see inkStyle.js / LinkMaterial)
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

const quadAt = (p0, c, p1, t) => {
  const u = 1 - t
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y
  }
}

/** Round every interior corner of a polyline with a quadratic fillet and
 *  sample it to exactly `segments+1` points.
 *
 *  Each fillet may eat up to half of each adjoining leg, independently per
 *  side, so a short jog between two long legs becomes one smooth S-sweep
 *  instead of a tiny step. Samples are spent where the curvature is: every
 *  straight run needs only its two endpoints, and the rest of the budget goes
 *  to the fillets in proportion to how sharply they turn — so corners stay
 *  round at any zoom instead of collapsing into bevels. */
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

  // Piece list: straight lines and quadratic fillets, end to end.
  const pieces = []
  let cursor = pts[0]
  const pushLine = (to) => {
    const len = Math.hypot(to.x - cursor.x, to.y - cursor.y)
    if (len > 0.01) pieces.push({ kind: 'line', a: cursor, b: to, len, turn: 0 })
    cursor = to
  }
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1],
      v = pts[i],
      b = pts[i + 1]
    const la = Math.hypot(v.x - a.x, v.y - a.y)
    const lb = Math.hypot(b.x - v.x, b.y - v.y)
    const rIn = Math.min(cornerR, la * 0.5)
    const rOut = Math.min(cornerR, lb * 0.5)
    if (Math.min(rIn, rOut) < 0.5) {
      pushLine(v)
      continue
    }
    const inP = { x: v.x - ((v.x - a.x) / la) * rIn, y: v.y - ((v.y - a.y) / la) * rIn }
    const outP = { x: v.x + ((b.x - v.x) / lb) * rOut, y: v.y + ((b.y - v.y) / lb) * rOut }
    pushLine(inP)
    const dot = ((v.x - a.x) * (b.x - v.x) + (v.y - a.y) * (b.y - v.y)) / (la * lb)
    const turn = Math.acos(Math.max(-1, Math.min(1, dot)))
    pieces.push({ kind: 'curve', a: inP, c: v, b: outP, len: rIn + rOut, turn })
    cursor = outP
  }
  pushLine(pts[pts.length - 1])

  // Sample budget: one segment per piece, the remainder to curves by
  // turn × √size (largest-remainder rounding keeps the total exact).
  const alloc = pieces.map(() => 1)
  let spare = segments - pieces.length
  if (spare < 0) {
    // More pieces than segments (never happens for the built-in routes):
    // fall back to plain vertex output padded/truncated to the budget.
    const flat = [pts[0], ...pieces.map((p) => p.b)]
    const points = []
    for (let i = 0; i <= segments; i++) {
      const f = (i / segments) * (flat.length - 1)
      const k = Math.min(flat.length - 2, Math.floor(f))
      const t = f - k
      points.push({
        x: flat[k].x + (flat[k + 1].x - flat[k].x) * t,
        y: flat[k].y + (flat[k + 1].y - flat[k].y) * t
      })
    }
    return { points, control: points[segments - 1] }
  }
  const weights = pieces.map((p) => (p.kind === 'curve' ? p.turn * Math.sqrt(p.len) : 0))
  let wSum = weights.reduce((s, w) => s + w, 0)
  if (wSum <= 0) {
    // All straight (no fillets): spread the spare samples by length.
    for (let i = 0; i < pieces.length; i++) weights[i] = pieces[i].len
    wSum = weights.reduce((s, w) => s + w, 0) || 1
  }
  const shares = weights.map((w) => (w / wSum) * spare)
  for (let i = 0; i < pieces.length; i++) {
    const whole = Math.floor(shares[i])
    alloc[i] += whole
    spare -= whole
  }
  const byRemainder = pieces
    .map((_, i) => i)
    .sort((i, j) => shares[j] - Math.floor(shares[j]) - (shares[i] - Math.floor(shares[i])))
  for (let n = 0; n < spare; n++) alloc[byRemainder[n % byRemainder.length]]++

  const points = [pts[0]]
  pieces.forEach((p, i) => {
    const k = alloc[i]
    for (let s = 1; s <= k; s++) {
      const t = s / k
      points.push(
        p.kind === 'line'
          ? { x: p.a.x + (p.b.x - p.a.x) * t, y: p.a.y + (p.b.y - p.a.y) * t }
          : quadAt(p.a, p.c, p.b, t)
      )
    }
  })
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
  // Generous fillets: the couple bar sweeps into the stem, the stem flows
  // onto the rail and each child peels off it in a soft curve.
  return polyRoute(pts, segments, 34)
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

// ── Brush (水墨 calligraphic sweep) ─────────────────────────────────────────
// A cubic whose first control point leans out to one side and whose second
// tucks slightly back: the gentle S-flick of a brush rather than a symmetric
// arc. Deterministic per edge, so parallel bonds fan apart like other routes.
export function brushRoute(d, segments, curvature = 0.06) {
  if (typeof d.source !== 'object') return linkCurvePoints(d, curvature, segments)
  const S = xy(d.source),
    T = xy(d.target)
  const dx = T.x - S.x,
    dy = T.y - S.y
  const dist = Math.hypot(dx, dy) || 1
  const nx = -dy / dist,
    ny = dx / dist
  const h = edgeHash(d)
  const sign = h & 1 ? 1 : -1
  const bend = Math.max(0.05, curvature) * (1 + (Math.abs(h % 100) / 100) * 0.6) * dist * sign
  const c1 = { x: S.x + dx * 0.3 + nx * bend * 1.3, y: S.y + dy * 0.3 + ny * bend * 1.3 }
  const c2 = { x: S.x + dx * 0.74 - nx * bend * 0.35, y: S.y + dy * 0.74 - ny * bend * 0.35 }
  const points = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments,
      u = 1 - t
    const a = u * u * u,
      b = 3 * u * u * t,
      c = 3 * u * t * t,
      e = t * t * t
    points.push({
      x: a * S.x + b * c1.x + c * c2.x + e * T.x,
      y: a * S.y + b * c1.y + c * c2.y + e * T.y
    })
  }
  return { points, control: c2 }
}

// ── Bezier (user-shapeable cubic curves) ─────────────────────────────────────
// Every link is a cubic Bézier S → C1 → C2 → T. A hand-shaped link carries
// `d._curve = { a: [u, v], b: [u, v] }` — its two control points in the
// link's own chord frame (u along S→T, v along its left normal, both in units
// of the chord length), so a custom curve rotates and scales with its
// endpoints when people move. Unshaped links get a sensible default: family
// (vertical) edges the classic tree S-curve, everything else a gentle arc.

/** Absolute point for chord-frame coords [u, v] of the S→T chord. */
export function fromCurveFrame(S, T, uv) {
  const dx = T.x - S.x,
    dy = T.y - S.y
  return { x: S.x + dx * uv[0] - dy * uv[1], y: S.y + dy * uv[0] + dx * uv[1] }
}

/** Chord-frame coords [u, v] of absolute point `p` (inverse of fromCurveFrame). */
export function toCurveFrame(S, T, p) {
  const dx = T.x - S.x,
    dy = T.y - S.y
  const len2 = dx * dx + dy * dy || 1
  const px = p.x - S.x,
    py = p.y - S.y
  return [(px * dx + py * dy) / len2, (py * dx - px * dy) / len2]
}

/** The two absolute control points of a link under the bezier route. */
export function bezierControls(d) {
  const S = xy(d.source),
    T = xy(d.target)
  const c = d._curve
  if (c?.a && c?.b) return { c1: fromCurveFrame(S, T, c.a), c2: fromCurveFrame(S, T, c.b) }
  const dx = T.x - S.x,
    dy = T.y - S.y
  if (d._role === 'v' && Math.abs(dy) > Math.abs(dx) * 0.25) {
    // Parent → child: leave and arrive vertically — the classic tree swoop.
    const h = dy * 0.5
    return { c1: { x: S.x, y: S.y + h }, c2: { x: T.x, y: T.y - h } }
  }
  // Couples stay nearly flat; other bonds bow gently, alternating sides.
  const bend = d._role === 'h' ? 0.04 : edgeHash(d) & 1 ? 0.16 : -0.16
  return {
    c1: fromCurveFrame(S, T, [1 / 3, bend]),
    c2: fromCurveFrame(S, T, [2 / 3, bend])
  }
}

/** Point on the cubic S, C1, C2, T at parameter t. */
export function cubicAt(S, c1, c2, T, t) {
  const u = 1 - t
  const a = u * u * u,
    b = 3 * u * u * t,
    c = 3 * u * t * t,
    e = t * t * t
  return {
    x: a * S.x + b * c1.x + c * c2.x + e * T.x,
    y: a * S.y + b * c1.y + c * c2.y + e * T.y
  }
}

/** Parameter t of the point on the link's curve nearest to `p` (coarse scan +
 *  local refine — plenty for a drag grab). */
export function nearestCurveT(d, p) {
  const S = xy(d.source),
    T = xy(d.target)
  const { c1, c2 } = bezierControls(d)
  let best = 0.5,
    bestD = Infinity
  const scan = (from, to, steps) => {
    for (let i = 0; i <= steps; i++) {
      const t = from + ((to - from) * i) / steps
      const q = cubicAt(S, c1, c2, T, t)
      const dd = (q.x - p.x) ** 2 + (q.y - p.y) ** 2
      if (dd < bestD) {
        bestD = dd
        best = t
      }
    }
  }
  scan(0, 1, 32)
  scan(Math.max(0, best - 1 / 32), Math.min(1, best + 1 / 32), 16)
  return best
}

/** Reshape so the curve point at parameter `t` moves by `delta` (world units):
 *  the minimal-norm split of the move across both control points, so the
 *  grabbed spot tracks the cursor exactly. Returns new chord-frame coords. */
export function bendCurveAt(d, t, delta, from = bezierControls(d)) {
  const S = xy(d.source),
    T = xy(d.target)
  const tt = Math.min(0.85, Math.max(0.15, t))
  const b1 = 3 * (1 - tt) * (1 - tt) * tt,
    b2 = 3 * (1 - tt) * tt * tt
  const norm = b1 * b1 + b2 * b2
  const k1 = b1 / norm,
    k2 = b2 / norm
  const c1 = { x: from.c1.x + delta.x * k1, y: from.c1.y + delta.y * k1 }
  const c2 = { x: from.c2.x + delta.x * k2, y: from.c2.y + delta.y * k2 }
  return { a: toCurveFrame(S, T, c1), b: toCurveFrame(S, T, c2) }
}

function bezierRoute(d, segments) {
  if (typeof d.source !== 'object') return linkCurvePoints(d, 0, segments)
  const S = xy(d.source),
    T = xy(d.target)
  const { c1, c2 } = bezierControls(d)
  const points = []
  for (let i = 0; i <= segments; i++) points.push(cubicAt(S, c1, c2, T, i / segments))
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
    case 'bezier':
      return bezierRoute(d, segments)
    case 'brush':
      return brushRoute(d, segments, gs.lineCurvature)
    default:
      return linkCurvePoints(d, gs.lineCurvature, segments)
  }
}
