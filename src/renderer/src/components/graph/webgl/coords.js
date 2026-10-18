// Pure coordinate helpers shared by the camera, overlay, picking and drag.
//
// The graph uses a screen-space, y-DOWN world (identical to the old SVG group and to
// what d3-force computes). A d3.zoom transform { x, y, k } maps world → screen exactly
// like the old `rootGroup.attr('transform', ...)` did. Optional per-axis stretch
// factors { sx, sy } (default 1) let the view squash/spread the layout along one axis
// without distorting node discs or link strokes — the renderer bakes the same stretch
// into node/link positions while keeping the zoom `k` uniform, so this stays the single
// source of truth for the mapping:
//
//     screenX = worldX * sx * k + x
//     screenY = worldY * sy * k + y

//
// ── Perspective tilt (the "3D view" of the 2D layouts) ───────────────────────
// An optional tilt { tl (radians), vw, vh } on the transform lays that flat
// screen picture down like a board seen from above: the screen plane rotates
// about the horizontal axis through the viewport centre (top edge receding)
// and is perspective-projected from a camera at focal distance f. That is a
// plane homography — straight lines stay straight, so links/guides need no
// special casing — applied AFTER the flat mapping:
//
//     dv = flatY - cy,  w = 1 - dv·sin(tl)/f
//     screenX = cx + (flatX - cx) / w
//     screenY = cy + dv·cos(tl) / w
//
// `w` is the depth: 1 at the centre line, > 1 receding, < 1 nearer. 1/w is the
// perspective scale of anything standing at that point (node billboards,
// labels). tl = 0 (or no tilt fields) is exactly the flat mapping.
//
// An optional yaw `yw` (radians) turns the board about the viewport centre
// BEFORE it is laid down — walking round the table to see it from another
// side. Rotating about the centre keeps everything centred by the flat camera
// centred, so fit / centre-on-person code needs no yaw awareness.

/** Perspective strength: the camera sits this many viewport-sizes away. */
export const TILT_FOCAL = 1.25
/** Tilt is clamped well short of edge-on so the horizon stays off-screen-ish. */
export const TILT_MAX = (64 * Math.PI) / 180

/** Resolved tilt/yaw parameters for a transform, or null when the view is flat. */
export function tiltParams(t) {
  const tl = (t && t.tl) || 0
  const yw = (t && t.yw) || 0
  if ((!tl && !yw) || !(t.vw > 0) || !(t.vh > 0)) return null
  const a = Math.min(Math.abs(tl), TILT_MAX)
  return {
    cx: t.vw / 2,
    cy: t.vh / 2,
    f: TILT_FOCAL * Math.max(t.vw, t.vh),
    s: Math.sin(a),
    c: Math.cos(a),
    ys: Math.sin(yw),
    yc: Math.cos(yw)
  }
}

function flatToScreen(u, v, p) {
  // yaw about the centre…
  const du = u - p.cx,
    dv0 = v - p.cy
  const ru = p.yc * du - p.ys * dv0
  const dv = p.ys * du + p.yc * dv0
  // …then lay the board down (perspective)
  const w = Math.max(1e-3, 1 - (dv * p.s) / p.f)
  return { x: p.cx + ru / w, y: p.cy + (dv * p.c) / w, s: 1 / w }
}

function screenToFlat(px, py, p) {
  const dpy = py - p.cy
  // Above the horizon (dpy → -f·c/s) there is no ground; clamp to "very far".
  const den = Math.max(1e-3, p.c + (dpy * p.s) / p.f)
  const dv = dpy / den
  const w = 1 - (dv * p.s) / p.f
  const ru = (px - p.cx) * w
  // undo the yaw
  return { x: p.cx + p.yc * ru + p.ys * dv, y: p.cy - p.ys * ru + p.yc * dv }
}

/**
 * Clip a screen segment to a rectangle (Liang–Barsky). Returns the visible
 * part { x0, y0, x1, y1, t0 } — t0 = where it starts as a fraction of the
 * original, so a dash pattern can stay anchored — or null when none is visible.
 * Under the tilt a guide's far end can project ~1000× off-screen; stroking that
 * dashed rasterises thousands of invisible dashes a frame.
 */
export function clipSegment(x0, y0, x1, y1, minX, minY, maxX, maxY) {
  if (!Number.isFinite(x0 + y0 + x1 + y1)) return null
  const dx = x1 - x0,
    dy = y1 - y0
  const p = [-dx, dx, -dy, dy]
  const q = [x0 - minX, maxX - x0, y0 - minY, maxY - y0]
  let a = 0,
    b = 1
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null
      continue
    }
    const r = q[i] / p[i]
    if (p[i] < 0) {
      if (r > b) return null
      if (r > a) a = r
    } else {
      if (r < a) return null
      if (r < b) b = r
    }
  }
  return { x0: x0 + a * dx, y0: y0 + a * dy, x1: x0 + b * dx, y1: y0 + b * dy, t0: a }
}

export function worldToScreen(wx, wy, t) {
  const sx = t.sx ?? 1,
    sy = t.sy ?? 1
  const u = wx * sx * t.k + t.x,
    v = wy * sy * t.k + t.y
  const p = tiltParams(t)
  return p ? flatToScreen(u, v, p) : { x: u, y: v, s: 1 }
}

export function screenToWorld(px, py, t) {
  const sx = t.sx ?? 1,
    sy = t.sy ?? 1
  const f = screenToFlatPoint(px, py, t)
  return { x: (f.x - t.x) / (t.k * sx), y: (f.y - t.y) / (t.k * sy) }
}

/** The FLAT camera pixel (before yaw/tilt) under a screen point. Independent
 *  of the camera's translate/zoom — what custom pan/zoom solve against. */
export function screenToFlatPoint(px, py, t) {
  const p = tiltParams(t)
  return p ? screenToFlat(px, py, p) : { x: px, y: py }
}

/** Camera translate that puts world (wx, wy) under screen (px, py) at zoom k
 *  (tilt/yaw/stretch honoured) — exact pan and zoom-about-cursor. */
export function translateToPin(wx, wy, px, py, t, k = t.k) {
  const f = screenToFlatPoint(px, py, t)
  return { x: f.x - wx * (t.sx ?? 1) * k, y: f.y - wy * (t.sy ?? 1) * k }
}

/** Perspective scale (1/depth) of something standing at world (wx, wy). */
export function perspectiveScale(wx, wy, t) {
  return worldToScreen(wx, wy, t).s
}

// The 4×4 projection (row-major, for THREE.Matrix4.set) taking FLAT screen
// pixels (what the world group's translate+scale produces) to clip space with
// the yaw + tilt homography folded in. With neither it is the plain pixel
// ortho (0..W → -1..1, y down). clipZ is pinned to 0 (no depth testing
// anywhere) and clipW carries the depth, so the GPU's divide does the perspective.
export function tiltProjection(t, W, H) {
  const p = tiltParams({ ...t, vw: t.vw || W, vh: t.vh || H }) || {
    cx: W / 2,
    cy: H / 2,
    f: 1,
    s: 0,
    c: 1,
    ys: 0,
    yc: 1
  }
  const q = p.s / p.f
  // Homography rows acting on (u', v', 1) — the yawed flat point:
  const hx = [1, -p.cx * q, p.cx * p.cy * q]
  const hy = [0, p.c - p.cy * q, p.cy * (1 - p.c) + p.cy * p.cy * q]
  const hw = [0, -q, 1 + p.cy * q]
  // Yaw about the centre as a 3×3 acting on (u, v, 1):
  const R = [
    [p.yc, -p.ys, p.cx - p.yc * p.cx + p.ys * p.cy],
    [p.ys, p.yc, p.cy - p.ys * p.cx - p.yc * p.cy],
    [0, 0, 1]
  ]
  const mul = (row) => [0, 1, 2].map((j) => row[0] * R[0][j] + row[1] * R[1][j] + row[2] * R[2][j])
  const X = mul(hx),
    Y = mul(hy),
    Wr = mul(hw)
  const ax = 2 / W,
    ay = 2 / H
  return [
    ax * X[0] - Wr[0], ax * X[1] - Wr[1], 0, ax * X[2] - Wr[2],
    Wr[0] - ay * Y[0], Wr[1] - ay * Y[1], 0, Wr[2] - ay * Y[2],
    0, 0, 0, 0,
    Wr[0], Wr[1], 0, Wr[2]
  ] // prettier-ignore
}

// Back-to-front draw order for standing things: anything whose foot (its
// point) is lower on screen is nearer the viewer and must paint over what
// stands behind it. Returns node indices sorted by their projected y, or null
// when `prev` is still in order (cheap check — re-sorts only when needed).
export function depthOrder(nodes, t, prev) {
  const n = nodes.length
  const key = new Float64Array(n)
  for (let i = 0; i < n; i++) key[i] = worldToScreen(nodes[i].x, nodes[i].y, t).y
  if (prev && prev.length === n) {
    let sorted = true
    for (let j = 1; j < n && sorted; j++) if (key[prev[j - 1]] > key[prev[j]]) sorted = false
    if (sorted) return null
  }
  const order = Array.from({ length: n }, (_, i) => i)
  order.sort((a, b) => key[a] - key[b] || a - b)
  return order
}

// Screen-space node hit test that honours the tilt (billboards shrink with
// depth) and lifted shapes (a gravestone stands ABOVE its anchor point).
// `lift` is the hit-centre offset upward in node radii; returns the nearest
// node whose drawn body contains the point, else null.
export function pickNodeOnScreen(px, py, nodes, t, radiusOf, lift = 0, slack = 1.08) {
  let best = null,
    bestD = Infinity
  for (const n of nodes) {
    const s = worldToScreen(n.x, n.y, t)
    const r = radiusOf(n) * t.k * s.s
    const dx = px - s.x,
      dy = py - (s.y - lift * r)
    const d = Math.hypot(dx, dy)
    if (d <= r * slack && d < bestD) {
      bestD = d
      best = n
    }
  }
  return best
}

// Fit-to-extent: given the world-space bounding box of the nodes and the viewport size,
// return the { x, y, k } that centres the box with a margin. `maxScale` caps zoom-in so a
// tiny/one-node tree is not blown up absurdly (matches the old fitAll cap of 2).
export function fitExtent(minX, minY, maxX, maxY, width, height, pad = 60, maxScale = 2) {
  const x0 = minX - pad,
    x1 = maxX + pad,
    y0 = minY - pad,
    y1 = maxY + pad
  const w = Math.max(1, x1 - x0),
    h = Math.max(1, y1 - y0)
  const k = Math.min((0.9 * width) / w, (0.9 * height) / h, maxScale)
  const x = width / 2 - (k * (x0 + x1)) / 2
  const y = height / 2 - (k * (y0 + y1)) / 2
  return { x, y, k }
}

// Bounding box of node positions (reads n.x / n.y). Returns null when empty.
export function nodesExtent(nodes) {
  if (!nodes || !nodes.length) return null
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const n of nodes) {
    if (n.x < minX) minX = n.x
    if (n.y < minY) minY = n.y
    if (n.x > maxX) maxX = n.x
    if (n.y > maxY) maxY = n.y
  }
  return { minX, minY, maxX, maxY }
}
