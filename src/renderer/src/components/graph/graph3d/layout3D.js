// Pure math for the experimental Space (3D) graph type — no Three.js, no D3,
// no store, so it is unit-testable like the other layout modules.
//
// Coordinate system: the 3D world keeps the 2D graph's x axis, uses +y as UP
// (generation layers stack top-down like the Generations type) and adds z as
// depth. The 2D world is y-DOWN, so carrying an arrangement across is x → x,
// -y → y, seeded z.

import { computeGenLayout } from '../familyTreeLayout'

/** Deterministic hash of a string id → float in [-1, 1). Stable across runs so
 *  re-entering the Space type never reshuffles the seeded depth. */
export function hashUnit(id) {
  let h = 2166136261
  const s = String(id)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // top 30 bits → [0,1) → [-1,1)
  return ((h >>> 2) / 0x40000000) * 2 - 1
}

/** Centre of extent of the 2D (y-down) arrangement — the pivot the 3D view
 *  rotates the plane around. Saved scene positions win over live node x/y. */
export function computePivot2D(nodes, saved) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const n of nodes) {
    const s = saved?.[n.id]
    const x = s?.x ?? n.x ?? 0
    const y = s?.y ?? n.y ?? 0
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  if (minX === Infinity) return { x: 0, y: 0 }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
}

/**
 * Initial 3D positions for every node from the scene's 2D-convention snapshot
 * (x right, y DOWN, optional z depth): x/y carry over centred on the pivot and
 * flipped into y-up; z comes from the snapshot or is seeded deterministically
 * from the id. Returns { [id]: {x, y, z} } in 3D (y-up) convention.
 */
export function seedPositions3D(nodes, saved, { spread = 260, pivot = { x: 0, y: 0 } } = {}) {
  const out = {}
  for (const n of nodes) {
    const s = saved?.[n.id]
    const x2 = s?.x ?? n.x ?? 0
    const y2 = s?.y ?? n.y ?? 0
    out[n.id] = {
      x: x2 - pivot.x,
      y: -(y2 - pivot.y),
      z: s && Number.isFinite(s.z) ? s.z : hashUnit(n.id) * spread
    }
  }
  return out
}

/** Inverse of the seed conversion: a 3D (y-up) position back into the scene's
 *  2D-convention snapshot shape {x, y (down), z}. */
export function to2DPosition(p, pivot) {
  return { x: p.x + pivot.x, y: -p.y + pivot.y, z: p.z }
}

/**
 * Generation level per person, reusing the family-tree layout's row
 * assignment (parents above children, spouses on one row). Returns
 * { levelOf: {id: row}, rowCount } with rows 0..rowCount-1, 0 = oldest.
 */
export function generationLevels(nodes, relationships) {
  const { yMap } = computeGenLayout(nodes, relationships, 2000, 1000)
  const ys = [...new Set(Object.values(yMap))].sort((a, b) => a - b)
  const rowIndex = new Map(ys.map((y, i) => [y, i]))
  const levelOf = {}
  for (const n of nodes) levelOf[n.id] = rowIndex.get(yMap[n.id]) ?? 0
  return { levelOf, rowCount: Math.max(ys.length, 1) }
}

/**
 * Vertical (y-up) targets for the layered arrangement: generation rows become
 * horizontal layers, oldest on top, centred on y=0.
 * Returns { yOf: {id: y}, layers: [{ row, y, label }] }.
 */
export function layeredTargets(nodes, relationships, spacing = 170) {
  const { levelOf, rowCount } = generationLevels(nodes, relationships)
  const yFor = (row) => ((rowCount - 1) / 2 - row) * spacing
  const yOf = {}
  for (const n of nodes) yOf[n.id] = yFor(levelOf[n.id] ?? 0)
  const layers = []
  for (let row = 0; row < rowCount; row++) {
    layers.push({ row, y: yFor(row), label: `Gen ${row + 1}` })
  }
  return { yOf, layers }
}

/** Bounding sphere of 3D node positions (reads n.x/n.y/n.z). Null when empty. */
export function boundingSphere3D(nodes) {
  if (!nodes || !nodes.length) return null
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity
  for (const n of nodes) {
    const z = n.z || 0
    if (n.x < minX) minX = n.x
    if (n.x > maxX) maxX = n.x
    if (n.y < minY) minY = n.y
    if (n.y > maxY) maxY = n.y
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }
  const cx = (minX + maxX) / 2,
    cy = (minY + maxY) / 2,
    cz = (minZ + maxZ) / 2
  let r2 = 0
  for (const n of nodes) {
    const dx = n.x - cx,
      dy = n.y - cy,
      dz = (n.z || 0) - cz
    const d2 = dx * dx + dy * dy + dz * dz
    if (d2 > r2) r2 = d2
  }
  return { x: cx, y: cy, z: cz, r: Math.sqrt(r2) }
}

/**
 * Camera distance that frames a sphere of radius r with a perspective camera
 * (vertical fov in degrees), honouring the narrower screen axis and a margin.
 */
export function fitDistance(r, fovDeg, aspect, margin = 1.25) {
  const fovV = (fovDeg * Math.PI) / 180
  const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect)
  const fov = Math.min(fovV, fovH)
  const safeR = Math.max(r, 1)
  return (safeR * margin) / Math.sin(fov / 2)
}

/** Deterministic starfield: `count` points on a spherical shell between
 *  rMin..rMax, with a per-star size/phase. Pure so it can be tested and so the
 *  backdrop never changes between visits. */
export function starfieldPositions(count, rMin, rMax, seed = 1) {
  let s = seed >>> 0 || 1
  const rand = () => {
    // mulberry32
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    // uniform direction via normalized gaussian-ish sum, radius in shell
    const u = rand() * 2 - 1
    const phi = rand() * Math.PI * 2
    const sq = Math.sqrt(Math.max(0, 1 - u * u))
    const r = rMin + (rMax - rMin) * Math.cbrt(rand())
    positions[i * 3] = sq * Math.cos(phi) * r
    positions[i * 3 + 1] = u * r
    positions[i * 3 + 2] = sq * Math.sin(phi) * r
    sizes[i] = 0.6 + rand() * 1.8
  }
  return { positions, sizes }
}
