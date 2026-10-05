// Pure math for the Evidence Board (Directory → Board) — no Vue, DOM, or store.
//
// World units are CSS px at zoom 1. A polaroid's position is its CENTRE; the
// pushpin (and therefore every yarn endpoint) sits near its top edge.

export const POL_W = 148 // polaroid paper width
export const POL_H = 178 // polaroid paper height
export const PIN_DY = -POL_H / 2 + 8 // pushpin offset from the polaroid centre (y)
export const CELL_W = 196 // auto-layout column pitch
export const CELL_H = 246 // auto-layout generation pitch
export const CLUSTER_GAP = 150 // breathing room between family clusters
export const MIN_K = 0.08
export const MAX_K = 2.6

// ── Seeded randomness (stable per id) ───────────────────────────────────────
// FNV-1a over the string, then a murmur-style finalizer so neighbouring ids
// ("Test 1", "Test 2") don't produce correlated values.
export function hashId(id, salt = 0) {
  let h = (2166136261 ^ salt) >>> 0
  const s = String(id)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 16
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  h = Math.imul(h, 3266489909)
  h ^= h >>> 16
  return h >>> 0
}

// Stable pseudo-random number in [0, 1) for (id, salt).
export function rand01(id, salt = 0) {
  return hashId(id, salt) / 4294967296
}

// Stable tilt for a polaroid, in degrees within ±maxDeg (never dead-straight).
export function rotationOf(id, maxDeg = 6) {
  const r = rand01(id, 7) * 2 - 1
  const sign = r < 0 ? -1 : 1
  return sign * (0.8 + Math.abs(r) * (maxDeg - 0.8))
}

// ── Auto layout: families clustered, generations as loose rows ─────────────
// persons: [{id}], relationships: [{person_a_id, person_b_id, type}],
// roles: Map | object type → 'vertical' | 'horizontal' | 'none'.
// For 'vertical' edges person_a is the parent of person_b. Returns Map id → {x, y}.
export function autoLayout(persons, relationships, roles, opts = {}) {
  const {
    cellW = CELL_W,
    cellH = CELL_H,
    clusterGap = CLUSTER_GAP,
    jitter = true,
    maxPasses = 60
  } = opts
  const out = new Map()
  const n = persons.length
  if (!n) return out
  const roleOf = (t) => (roles instanceof Map ? roles.get(t) : roles?.[t]) || 'none'

  const index = new Map()
  persons.forEach((p, i) => index.set(p.id, i))

  // Union–find over structural (vertical + horizontal) edges → family clusters.
  const parent = new Int32Array(n).map((_, i) => i)
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  const union = (a, b) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb)
  }

  const vEdges = [] // [parentIdx, childIdx]
  const partners = Array.from({ length: n }, () => [])
  const parentsOf = Array.from({ length: n }, () => [])
  for (const r of relationships || []) {
    const a = index.get(r.person_a_id)
    const b = index.get(r.person_b_id)
    if (a == null || b == null || a === b) continue
    const role = roleOf(r.type)
    if (role === 'vertical') {
      vEdges.push([a, b])
      parentsOf[b].push(a)
      union(a, b)
    } else if (role === 'horizontal') {
      partners[a].push(b)
      partners[b].push(a)
      union(a, b)
    }
  }

  // Generations: longest-path relaxation, partners share a row. Bounded passes
  // so cyclic data (a is b's parent and b is a's) can't spin forever.
  const gen = new Int32Array(n)
  const cap = Math.max(1, Math.min(n, 400))
  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false
    for (const [a, b] of vEdges) {
      if (gen[b] < gen[a] + 1 && gen[a] + 1 <= cap) {
        gen[b] = gen[a] + 1
        changed = true
      }
    }
    for (let i = 0; i < n; i++) {
      for (const j of partners[i]) {
        if (gen[i] < gen[j]) {
          gen[i] = gen[j]
          changed = true
        }
      }
    }
    if (!changed) break
  }

  // Group members by cluster, in input order (deterministic).
  const clusters = new Map()
  for (let i = 0; i < n; i++) {
    const r = find(i)
    if (!clusters.has(r)) clusters.set(r, [])
    clusters.get(r).push(i)
  }

  const families = []
  const loners = []
  for (const members of clusters.values()) {
    if (members.length === 1) loners.push(members[0])
    else families.push(members)
  }

  // Lay each family out in its own local frame.
  const blocks = families.map((members) => {
    const minGen = Math.min(...members.map((i) => gen[i]))
    const rows = new Map()
    for (const i of members) {
      const g = gen[i] - minGen
      if (!rows.has(g)) rows.set(g, [])
      rows.get(g).push(i)
    }
    const gens = [...rows.keys()].sort((a, b) => a - b)
    const col = new Map() // idx → fractional column (for barycentres)
    const ordered = []
    for (const g of gens) {
      const row = rows.get(g)
      const key = new Map()
      for (const i of row) {
        const ps = parentsOf[i].filter((p) => col.has(p))
        if (ps.length) key.set(i, ps.reduce((s, p) => s + col.get(p), 0) / ps.length)
      }
      for (const i of row) {
        if (key.has(i)) continue
        const pk = partners[i].filter((j) => key.has(j)).map((j) => key.get(j))
        key.set(i, pk.length ? Math.min(...pk) + 0.01 : 1e6 + i)
      }
      const sorted = [...row].sort((a, b) => key.get(a) - key.get(b) || a - b)
      // Keep couples side by side.
      const inRow = new Set(row)
      const placed = new Set()
      const seq = []
      for (const i of sorted) {
        if (placed.has(i)) continue
        placed.add(i)
        seq.push(i)
        for (const j of partners[i]) {
          if (inRow.has(j) && !placed.has(j)) {
            placed.add(j)
            seq.push(j)
          }
        }
      }
      // Centre rows on their parents' span where possible.
      const shift = (seq.length - 1) / 2
      const real = seq.filter((i) => key.get(i) < 1e6)
      const mean = real.length ? real.reduce((s, i) => s + key.get(i), 0) / real.length : shift
      seq.forEach((i, k) => col.set(i, k - shift + mean))
      ordered.push({ g, seq })
    }
    // Resolve overlaps from centring: enforce ≥1 column spacing per row.
    for (const { seq } of ordered) {
      for (let k = 1; k < seq.length; k++) {
        const prev = col.get(seq[k - 1])
        if (col.get(seq[k]) < prev + 1) col.set(seq[k], prev + 1)
      }
    }
    let minC = Infinity
    let maxC = -Infinity
    for (const c of col.values()) {
      minC = Math.min(minC, c)
      maxC = Math.max(maxC, c)
    }
    const items = []
    for (const { g, seq } of ordered) {
      for (const i of seq) items.push({ i, x: (col.get(i) - minC) * cellW, y: g * cellH })
    }
    return { items, w: (maxC - minC) * cellW + cellW, h: gens.length * cellH, size: members.length }
  })
  blocks.sort((a, b) => b.size - a.size || a.items[0].i - b.items[0].i)

  // Shelf-pack family blocks into a roughly 16:10 board.
  const area =
    blocks.reduce((s, b) => s + (b.w + clusterGap) * (b.h + clusterGap), 0) +
    loners.length * cellW * cellH
  const maxBlockW = blocks.reduce((m, b) => Math.max(m, b.w), 0)
  const shelfW = Math.max(maxBlockW, Math.sqrt(area * 1.6), cellW * 3)
  let cx = 0
  let cy = 0
  let shelfH = 0
  const place = (i, x, y, loose) => {
    const id = persons[i].id
    let jx = 0
    let jy = 0
    if (jitter) {
      const amp = loose ? 0.115 : 0.1
      jx = (rand01(id, 11) * 2 - 1) * cellW * amp
      jy = (rand01(id, 13) * 2 - 1) * cellH * (loose ? 0.12 : 0.07)
    }
    out.set(id, { x: x + cellW / 2 + jx, y: y + cellH / 2 + jy })
  }
  for (const b of blocks) {
    if (cx > 0 && cx + b.w > shelfW) {
      cx = 0
      cy += shelfH + clusterGap
      shelfH = 0
    }
    for (const it of b.items) place(it.i, cx + it.x, cy + it.y, false)
    cx += b.w + clusterGap
    shelfH = Math.max(shelfH, b.h)
  }
  // Loose grid for everyone without structural ties.
  if (loners.length) {
    if (blocks.length) cy += shelfH + clusterGap
    const cols = Math.max(1, Math.floor(shelfW / cellW))
    loners.forEach((i, k) => place(i, (k % cols) * cellW, cy + Math.floor(k / cols) * cellH, true))
  }
  return out
}

// ── Yarn ───────────────────────────────────────────────────────────────────
// Sag (px) for a string between two pins: proportional to length (a longer
// string droops more), damped when the string is pulled taut.
export function sagOf(len, tension = 0, sagK = 0.14, maxSag = 150) {
  return Math.min(maxSag, len * sagK) * (1 - Math.max(0, Math.min(1, tension)) * 0.75)
}

// Quadratic "catenary-ish" curve between two pins. The control point is pushed
// down by 2·sag so the curve's midpoint hangs exactly `sag` below the chord.
export function yarnPath(ax, ay, bx, by, tension = 0, slack = 1) {
  const len = Math.hypot(bx - ax, by - ay)
  const s = sagOf(len, tension) * slack
  const cx = (ax + bx) / 2
  const cy = (ay + by) / 2 + 2 * s
  const f = (v) => Math.round(v * 10) / 10
  return `M${f(ax)} ${f(ay)}Q${f(cx)} ${f(cy)} ${f(bx)} ${f(by)}`
}

// Conservative bounding box of a sagging string (for culling).
export function yarnBox(ax, ay, bx, by, slack = 1) {
  const s = sagOf(Math.hypot(bx - ax, by - ay)) * slack
  return {
    x0: Math.min(ax, bx),
    y0: Math.min(ay, by),
    x1: Math.max(ax, bx),
    y1: Math.max(ay, by) + s
  }
}

// ── Camera + culling ───────────────────────────────────────────────────────
// cam = {x, y, k}: screen = world·k + (x, y).
export function worldRect(cam, w, h, margin = 0) {
  return {
    x0: (-cam.x - margin) / cam.k,
    y0: (-cam.y - margin) / cam.k,
    x1: (w - cam.x + margin) / cam.k,
    y1: (h - cam.y + margin) / cam.k
  }
}

export const rectsOverlap = (a, b) => a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0

export const rectContains = (outer, inner) =>
  inner.x0 >= outer.x0 && inner.x1 <= outer.x1 && inner.y0 >= outer.y0 && inner.y1 <= outer.y1

// Does a polaroid centred at (x, y) touch the rect?
export const polaroidInRect = (x, y, r, pad = 30) =>
  x + POL_W / 2 + pad >= r.x0 &&
  x - POL_W / 2 - pad <= r.x1 &&
  y + POL_H / 2 + pad >= r.y0 &&
  y - POL_H / 2 - pad <= r.y1

// Bounds of a set of polaroid centres (their paper included). null when empty.
export function boundsOf(points) {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of points) {
    if (!p) continue
    x0 = Math.min(x0, p.x - POL_W / 2)
    y0 = Math.min(y0, p.y - POL_H / 2)
    x1 = Math.max(x1, p.x + POL_W / 2)
    y1 = Math.max(y1, p.y + POL_H / 2)
  }
  return x0 === Infinity ? null : { x0, y0, x1, y1 }
}

// Camera that fits `b` into a w×h viewport with `pad` px margins.
export function fitCamera(b, w, h, pad = 60, minK = MIN_K, maxK = 1.15) {
  if (!b || !(w > 0) || !(h > 0)) return { x: 0, y: 0, k: 1 }
  const bw = Math.max(1, b.x1 - b.x0)
  const bh = Math.max(1, b.y1 - b.y0)
  const k = Math.max(minK, Math.min(maxK, Math.min((w - pad * 2) / bw, (h - pad * 2) / bh)))
  return { x: w / 2 - ((b.x0 + b.x1) / 2) * k, y: h / 2 - ((b.y0 + b.y1) / 2) * k, k }
}

// Zoom to k2 keeping the world point under screen (sx, sy) fixed.
export function zoomAt(cam, sx, sy, k2, minK = MIN_K, maxK = MAX_K) {
  const k = Math.max(minK, Math.min(maxK, k2))
  const wx = (sx - cam.x) / cam.k
  const wy = (sy - cam.y) / cam.k
  return { x: sx - wx * k, y: sy - wy * k, k }
}

// ── Hand-drawn marker circle ───────────────────────────────────────────────
// A wobbly ellipse that overshoots its start (≈1.1 turns) like a quick red
// marker loop. Deterministic per seed; returned as an SVG path.
export function markerPath(cx, cy, rx, ry, seed = 'x', steps = 44) {
  const turns = 1.12
  const start = -Math.PI * 0.62 + rand01(seed, 3) * 0.4
  const pts = []
  for (let s = 0; s <= steps; s++) {
    const t = s / steps
    const a = start + t * turns * Math.PI * 2
    const wob = 1 + Math.sin(a * 3 + rand01(seed, 5) * 6) * 0.025 + (t - 0.5) * 0.06
    pts.push([cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob])
  }
  const f = (v) => Math.round(v * 10) / 10
  return 'M' + pts.map(([x, y]) => f(x) + ' ' + f(y)).join('L')
}

// ── Saved-position hygiene ─────────────────────────────────────────────────
// Parse a persisted {id: {x, y, z?}} record, dropping anything malformed.
export function sanitizePositions(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [id, v] of Object.entries(raw)) {
    if (!v || !Number.isFinite(v.x) || !Number.isFinite(v.y)) continue
    out[id] = { x: v.x, y: v.y, z: Number.isFinite(v.z) ? v.z : 0 }
  }
  return out
}
