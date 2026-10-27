// Grab handles for direct sculpting — Black Desert / inZOI style: small
// points pinned to facial and body landmarks (nose tip, side of the nose,
// chin, jaw corner, mouth corner, cheekbone…). Grab one and pull: the drag
// is measured in the character's own frame (outward / up / forward), so the
// front view sculpts width + height and the profile view sculpts depth, and
// each axis drives one slider.
//
// The pull is EXACT: for every (handle, axis) the slider's own morph targets
// say how far that landmark moves at full strength, so a 3 mm drag sets the
// value that moves the feature 3 mm — the point follows the cursor.
//
// Pure: landmark search runs on the asset's base mesh + masks; no THREE.
// Tests: tests/human3dMath.test.js

import type { HumanAsset } from './humanAsset'
import { SLIDER_BY_ID } from './catalog'

type V3 = [number, number, number]

/** Where to look for a landmark (left side for mirrored handles; dm, base mesh). */
export interface Probe {
  /** A point, or a point along a bone (t = 0 head … 1 tail) plus an offset. */
  at: V3 | { bone: string; to?: string; t?: number; off?: V3 }
  /** 'extreme': the vertex furthest along `dir` within `radius` of `at`;
   *  'nearest': the vertex closest to `at` (with `mask`, on that region);
   *  'target': the vertex the morph `target` moves most (projected on
   *  `dir` when given) — the feature itself. `{s}` in the name = l / r. */
  mode?: 'extreme' | 'nearest' | 'target'
  target?: string
  dir?: V3
  radius: number
  /** Only vertices in these masks (any ≥ maskMin). */
  mask?: string[]
  maskMin?: number
  /** |x| bounds (centre handles: max ≈ 0.03 keeps them on the midline). */
  xMin?: number
  xMax?: number
  /** Only vertices whose strongest skin weight is this bone (e.g. the jaw). */
  onBone?: string
}

export type HandleAxis = 'x' | 'y' | 'z'

export interface SculptHandle {
  id: string
  label: string
  zone: 'face' | 'body'
  /** Editor sub-group a click opens (face/body group ids). */
  group: string
  /** true = a left/right pair (one symmetric slider, both points move). */
  mirror?: boolean
  probe: Probe
  /** Slider per axis: x = outward (mirrored) / character-left (centre), y = up, z = forward. */
  axes: Partial<Record<HandleAxis, string>>
}

const C = 0.03 // midline tolerance (dm)
const O: V3 = [0, 0, 0] // unused probe point for 'target' probes

export const SCULPT_HANDLES: SculptHandle[] = [
  // ── Face ──
  {
    id: 'crown',
    label: 'Top of head',
    zone: 'face',
    group: 'head',
    probe: { at: [0, 8.0, 0.2], dir: [0, 1, 0], radius: 0.7, xMax: C },
    axes: { y: 'head-scale-vert-decr-incr', z: 'head-scale-depth-decr-incr' }
  },
  {
    id: 'headSide',
    label: 'Side of head',
    zone: 'face',
    group: 'head',
    mirror: true,
    probe: { at: [0.75, 7.75, 0.2], dir: [1, 0, 0], radius: 0.3 },
    axes: { x: 'head-scale-horiz-decr-incr' }
  },
  {
    id: 'forehead',
    label: 'Forehead',
    zone: 'face',
    group: 'forehead',
    probe: { at: O, mode: 'target', target: 'forehead-trans-forward', radius: 0, xMax: C },
    axes: { y: 'forehead-scale-vert-decr-incr', z: 'forehead-trans-backward-forward' }
  },
  {
    id: 'temple',
    label: 'Temple',
    zone: 'face',
    group: 'forehead',
    mirror: true,
    probe: { at: [0.66, 7.5, 0.8], dir: [1, 0, 0.35], radius: 0.18 },
    axes: { x: 'forehead-temple-decr-incr' }
  },
  {
    id: 'brow',
    label: 'Brow',
    zone: 'face',
    group: 'forehead',
    mirror: true,
    probe: {
      at: O,
      mode: 'target',
      target: 'eyebrows-trans-up',
      radius: 0,
      mask: ['brow'],
      maskMin: 0.3
    },
    axes: { y: 'eyebrows-trans-down-up', z: 'eyebrows-trans-backward-forward' }
  },
  {
    id: 'browTail',
    label: 'Brow tail',
    zone: 'face',
    group: 'forehead',
    mirror: true,
    probe: { at: O, mode: 'target', target: 'eyebrows-angle-up', radius: 0, xMin: 0.4 },
    axes: { y: 'eyebrows-angle-down-up' }
  },
  {
    id: 'eyeInner',
    label: 'Inner eye corner',
    zone: 'face',
    group: 'eyes',
    mirror: true,
    // (MakeHuman's corner2 targets are the INNER corner, corner1 the outer)
    probe: { at: O, mode: 'target', target: '{s}-eye-corner2-up', radius: 0 },
    axes: { y: 'eye-corner2-down-up', z: 'eye-push1-in-out' }
  },
  {
    id: 'eyeOuter',
    label: 'Outer eye corner',
    zone: 'face',
    group: 'eyes',
    mirror: true,
    probe: { at: O, mode: 'target', target: '{s}-eye-corner1-up', radius: 0 },
    axes: { x: 'eye-trans-in-out', y: 'eye-corner1-down-up', z: 'eye-push2-in-out' }
  },
  {
    id: 'lid',
    label: 'Upper lid',
    zone: 'face',
    group: 'eyes',
    mirror: true,
    probe: {
      at: O,
      mode: 'target',
      target: '{s}-eye-height2-incr',
      radius: 0,
      mask: ['eyeUpper'],
      maskMin: 0.3
    },
    axes: { y: 'eye-height2-decr-incr', z: 'eye-eyefold-concave-convex' }
  },
  {
    id: 'noseBridge',
    label: 'Nose bridge',
    zone: 'face',
    group: 'nose',
    probe: { at: O, mode: 'target', target: 'nose-hump-incr', radius: 0, xMax: C },
    axes: { y: 'nose-scale-vert-decr-incr', z: 'nose-hump-decr-incr' }
  },
  {
    id: 'noseTip',
    label: 'Nose tip',
    zone: 'face',
    group: 'nose',
    probe: { at: [0, 6.95, 1.4], dir: [0, -0.1, 1], radius: 0.3, xMax: C },
    axes: { y: 'nose-point-down-up', z: 'nose-scale-depth-decr-incr' }
  },
  {
    id: 'noseWing',
    label: 'Side of nose',
    zone: 'face',
    group: 'nose',
    mirror: true,
    probe: { at: O, mode: 'target', target: 'nose-nostrils-width-incr', dir: [1, 0, 0], radius: 0 },
    axes: {
      x: 'nose-nostrils-width-decr-incr',
      y: 'nose-base-down-up',
      z: 'nose-flaring-decr-incr'
    }
  },
  {
    id: 'cheekbone',
    label: 'Cheekbone',
    zone: 'face',
    group: 'cheeks',
    mirror: true,
    probe: { at: O, mode: 'target', target: '{s}-cheek-bones-incr', radius: 0 },
    axes: { x: 'cheek-bones-decr-incr', y: 'cheek-trans-down-up' }
  },
  {
    id: 'cheek',
    label: 'Cheek',
    zone: 'face',
    group: 'cheeks',
    mirror: true,
    probe: { at: [0.45, 6.72, 1.1], dir: [0.45, 0, 0.9], radius: 0.16 },
    axes: { x: 'cheek-volume-decr-incr', z: 'cheek-inner-decr-incr' }
  },
  {
    id: 'upperLip',
    label: 'Upper lip',
    zone: 'face',
    group: 'mouth',
    probe: {
      at: [0, 6.68, 1.75],
      mode: 'nearest',
      radius: 0.4,
      mask: ['lips'],
      maskMin: 0.5,
      xMax: C
    },
    axes: { y: 'mouth-upperlip-height-decr-incr', z: 'mouth-upperlip-volume-decr-incr' }
  },
  {
    id: 'lowerLip',
    label: 'Lower lip',
    zone: 'face',
    group: 'mouth',
    probe: {
      at: [0, 6.48, 1.75],
      mode: 'nearest',
      radius: 0.4,
      mask: ['lips'],
      maskMin: 0.5,
      xMax: C
    },
    axes: { y: 'mouth-lowerlip-height-decr-incr', z: 'mouth-lowerlip-volume-decr-incr' }
  },
  {
    id: 'mouthCorner',
    label: 'Mouth corner',
    zone: 'face',
    group: 'mouth',
    mirror: true,
    probe: { at: [0.15, 6.6, 1.4], dir: [1, 0, 0], radius: 0.4, mask: ['lips'], maskMin: 0.4 },
    axes: { x: 'mouth-scale-horiz-decr-incr', y: 'mouth-angles-down-up' }
  },
  {
    id: 'chin',
    label: 'Chin',
    zone: 'face',
    group: 'jaw',
    probe: { at: [0, 6.2, 1.2], dir: [0, -0.35, 1], radius: 0.3, xMax: C },
    axes: { y: 'chin-height-decr-incr', z: 'chin-prominent-decr-incr' }
  },
  {
    id: 'chinSide',
    label: 'Side of chin',
    zone: 'face',
    group: 'jaw',
    mirror: true,
    probe: { at: O, mode: 'target', target: 'chin-width-incr', dir: [1, 0, 0], radius: 0 },
    axes: { x: 'chin-width-decr-incr' }
  },
  {
    id: 'jawCorner',
    label: 'Jaw corner',
    zone: 'face',
    group: 'jaw',
    mirror: true,
    // the jaw ANGLE, where the lower border turns up toward the ear (traced
    // from the base mesh's lateral profile)
    probe: { at: [0.58, 6.47, 0.82], mode: 'nearest', radius: 0.35 },
    axes: { x: 'chin-bones-decr-incr', y: 'chin-jaw-drop-decr-incr' }
  },
  {
    id: 'ear',
    label: 'Ear',
    zone: 'face',
    group: 'ears',
    mirror: true,
    probe: {
      at: [0.82, 7.24, 0.33],
      dir: [1, 0, 0],
      radius: 0.35,
      mask: ['thin'],
      maskMin: 0.3,
      xMin: 0.6
    },
    axes: {
      x: 'ear-wing-decr-incr',
      y: 'ear-trans-down-up',
      z: 'ear-trans-backward-forward'
    }
  },
  {
    id: 'neck',
    label: 'Neck',
    zone: 'face',
    group: 'neck',
    mirror: true,
    probe: { at: [0.42, 6.15, 0.3], dir: [1, 0, 0], radius: 0.25 },
    axes: { x: 'neck-scale-horiz-decr-incr' }
  },
  // ── Body ──
  {
    id: 'shoulder',
    label: 'Shoulder',
    zone: 'body',
    group: 'torso',
    mirror: true,
    probe: { at: { bone: 'upperarm01.L', off: [0, 0.35, 0] }, dir: [0.45, 1, 0], radius: 0.45 },
    axes: { x: 'measure-shoulder-dist-decr-incr' }
  },
  {
    id: 'bust',
    label: 'Chest',
    zone: 'body',
    group: 'torso',
    mirror: true,
    probe: { at: [0.75, 3.75, 1.0], dir: [0, 0, 1], radius: 0.5, xMin: 0.4 },
    axes: { y: 'breast-trans-down-up', z: 'measure-bust-circ-decr-incr' }
  },
  {
    id: 'waist',
    label: 'Waist',
    zone: 'body',
    group: 'torso',
    mirror: true,
    probe: { at: O, mode: 'target', target: 'measure-waist-circ-incr', dir: [1, 0, 0], radius: 0 },
    axes: { x: 'measure-waist-circ-decr-incr' }
  },
  {
    id: 'belly',
    label: 'Belly',
    zone: 'body',
    group: 'torso',
    probe: {
      at: O,
      mode: 'target',
      target: 'stomach-pregnant-incr',
      dir: [0, 0, 1],
      radius: 0,
      xMax: C
    },
    axes: { z: 'stomach-pregnant-decr-incr' }
  },
  {
    id: 'hip',
    label: 'Hip',
    zone: 'body',
    group: 'hips',
    mirror: true,
    probe: { at: [1.5, 0.3, 0.1], dir: [1, 0, 0], radius: 0.5, xMax: 2.2 },
    axes: { x: 'hip-scale-horiz-decr-incr', y: 'hip-waist-down-up' }
  },
  {
    id: 'glutes',
    label: 'Glutes',
    zone: 'body',
    group: 'hips',
    mirror: true,
    probe: { at: [0.65, -0.15, -0.8], dir: [0, 0, -1], radius: 0.55, xMin: 0.3, xMax: 1.2 },
    axes: { z: 'buttocks-volume-decr-incr' }
  },
  {
    id: 'upperArm',
    label: 'Upper arm',
    zone: 'body',
    group: 'arms',
    mirror: true,
    probe: {
      at: O,
      mode: 'target',
      target: 'measure-upperarm-circ-incr',
      dir: [0.7, 0.6, 0],
      radius: 0
    },
    axes: { x: 'measure-upperarm-circ-decr-incr' }
  },
  {
    id: 'thigh',
    label: 'Thigh',
    zone: 'body',
    group: 'legs',
    mirror: true,
    // mid-thigh, below where the hanging hands cover the upper thigh
    probe: { at: { bone: 'upperleg02.L', t: 0.55 }, dir: [1, 0, 0.15], radius: 1.1 },
    axes: { x: 'measure-thigh-circ-decr-incr' }
  },
  {
    id: 'calf',
    label: 'Calf',
    zone: 'body',
    group: 'legs',
    mirror: true,
    probe: { at: O, mode: 'target', target: 'measure-calf-circ-incr', dir: [0, 0, -1], radius: 0 },
    axes: { z: 'measure-calf-circ-decr-incr' }
  }
]

export const HANDLE_BY_ID = new Map(SCULPT_HANDLES.map((h) => [h.id, h]))

/** One resolved grab point (a mirrored handle resolves to two). */
export interface HandlePoint {
  key: string
  handle: SculptHandle
  /** +1 = character's left (x > 0) or centre, −1 = right. */
  side: 1 | -1
  /** Base-mesh vertex the point rides. */
  vertex: number
  /** Bone that carries it (the vertex's strongest skin weight). */
  bone: string
}

function probePoint(a: HumanAsset, at: Probe['at'], side: 1 | -1): V3 {
  let p: V3
  if (Array.isArray(at)) p = [...at] as V3
  else {
    const b = a.bones.find((x) => x.name === at.bone)
    if (!b) return [0, 0, 0]
    const to = at.to ? a.bones.find((x) => x.name === at.to) : null
    const h = b.head * 3
    const tl = (to ? to.head : b.tail) * 3
    const t = at.t ?? 0
    const B = a.base
    p = [
      B[h] + (B[tl] - B[h]) * t,
      B[h + 1] + (B[tl + 1] - B[h + 1]) * t,
      B[h + 2] + (B[tl + 2] - B[h + 2]) * t
    ]
    if (at.off) for (let k = 0; k < 3; k++) p[k] += at.off[k]
  }
  p[0] *= side
  return p
}

/** The body-group vertex for a probe on one side (−1 when nothing matches). */
export function findLandmark(a: HumanAsset, probe: Probe, side: 1 | -1): number {
  if (probe.mode === 'target') return findByTarget(a, probe, side)
  const B = a.base
  const at = probePoint(a, probe.at, side)
  const dir: V3 = probe.dir ? [probe.dir[0] * side, probe.dir[1], probe.dir[2]] : [0, 0, 1]
  const r2 = probe.radius * probe.radius
  const masks = (probe.mask || []).map((m) => a.masks[m]).filter(Boolean)
  const mMin = (probe.maskMin ?? 0.5) * 255
  const body = bodyVertices(a)
  let best = -1
  let bestScore = -Infinity
  for (const v of body) {
    const x = B[v * 3]
    if (side > 0 ? x < -1e-4 : x > 1e-4) continue
    const ax = Math.abs(x)
    if (probe.xMin !== undefined && ax < probe.xMin) continue
    if (probe.xMax !== undefined && ax > probe.xMax) continue
    if (masks.length && !masks.some((m) => m[v] >= mMin)) continue
    if (probe.onBone && topBone(a, v) !== probe.onBone) continue
    const dx = x - at[0]
    const dy = B[v * 3 + 1] - at[1]
    const dz = B[v * 3 + 2] - at[2]
    const d2 = dx * dx + dy * dy + dz * dz
    if (d2 > r2) continue
    const score = probe.mode === 'nearest' ? -d2 : dx * dir[0] + dy * dir[1] + dz * dir[2]
    if (score > bestScore) {
      bestScore = score
      best = v
    }
  }
  return best
}

function findByTarget(a: HumanAsset, probe: Probe, side: 1 | -1): number {
  const name = (probe.target || '').replace('{s}', side > 0 ? 'l' : 'r')
  const t = a.targets.get(name)
  if (!t) return -1
  const B = a.base
  const dir: V3 | null = probe.dir ? [probe.dir[0] * side, probe.dir[1], probe.dir[2]] : null
  const masks = (probe.mask || []).map((m) => a.masks[m]).filter(Boolean)
  const mMin = (probe.maskMin ?? 0.5) * 255
  let best = -1
  let bestScore = 0
  for (let i = 0; i < t.idx.length; i++) {
    const v = t.idx[i]
    if (v >= a.meshVertexCount) continue // joints
    const x = B[v * 3]
    if (side > 0 ? x < -1e-4 : x > 1e-4) continue
    const ax = Math.abs(x)
    if (probe.xMin !== undefined && ax < probe.xMin) continue
    if (probe.xMax !== undefined && ax > probe.xMax) continue
    if (masks.length && !masks.some((m) => m[v] >= mMin)) continue
    const dx = t.d[i * 3]
    const dy = t.d[i * 3 + 1]
    const dz = t.d[i * 3 + 2]
    const score = dir ? dx * dir[0] + dy * dir[1] + dz * dir[2] : Math.hypot(dx, dy, dz)
    if (score > bestScore) {
      bestScore = score
      best = v
    }
  }
  // the vertex must be on the visible skin (not a helper / eye / teeth vertex)
  return best >= 0 && bodyVertexSet(a).has(best) ? best : best >= 0 ? nearestBody(a, best) : -1
}

const bodySetCache = new WeakMap<HumanAsset, Set<number>>()
function bodyVertexSet(a: HumanAsset) {
  let s = bodySetCache.get(a)
  if (!s) {
    s = new Set(bodyVertices(a))
    bodySetCache.set(a, s)
  }
  return s
}
function nearestBody(a: HumanAsset, v: number) {
  const B = a.base
  let best = -1
  let bd = Infinity
  for (const u of bodyVertices(a)) {
    const d =
      (B[u * 3] - B[v * 3]) ** 2 +
      (B[u * 3 + 1] - B[v * 3 + 1]) ** 2 +
      (B[u * 3 + 2] - B[v * 3 + 2]) ** 2
    if (d < bd) {
      bd = d
      best = u
    }
  }
  return best
}

const bodyCache = new WeakMap<HumanAsset, Uint32Array>()
function bodyVertices(a: HumanAsset): Uint32Array {
  let v = bodyCache.get(a)
  if (!v) {
    v = Uint32Array.from(new Set(a.groups.body.quads))
    bodyCache.set(a, v)
  }
  return v
}

/** Resolve every handle to its grab point(s) on this asset. */
export function resolveHandles(a: HumanAsset, handles = SCULPT_HANDLES): HandlePoint[] {
  const out: HandlePoint[] = []
  for (const h of handles) {
    for (const side of h.mirror ? ([1, -1] as const) : ([1] as const)) {
      const vertex = findLandmark(a, h.probe, side)
      if (vertex < 0) continue
      out.push({
        key: h.mirror ? `${h.id}.${side > 0 ? 'l' : 'r'}` : h.id,
        handle: h,
        side,
        vertex,
        bone: topBone(a, vertex)
      })
    }
  }
  return out
}

function topBone(a: HumanAsset, v: number) {
  let bi = 0
  let bw = -1
  for (let k = 0; k < 4; k++) {
    const w = a.skinWeight[v * 4 + k]
    if (w > bw) {
      bw = w
      bi = a.skinIndex[v * 4 + k]
    }
  }
  return a.bones[bi]?.name || 'head'
}

/** Rest-pose surface normal at a body vertex (area-weighted from its quads). */
export function vertexNormal(a: HumanAsset, v: number): V3 {
  const q = a.groups.body.quads
  const B = a.base
  const n: V3 = [0, 0, 0]
  for (let i = 0; i < q.length; i += 4) {
    if (q[i] !== v && q[i + 1] !== v && q[i + 2] !== v && q[i + 3] !== v) continue
    // quad normal = cross of the diagonals
    const d1 = [0, 1, 2].map((k) => B[q[i + 2] * 3 + k] - B[q[i] * 3 + k])
    const d2 = [0, 1, 2].map((k) => B[q[i + 3] * 3 + k] - B[q[i + 1] * 3 + k])
    n[0] += d1[1] * d2[2] - d1[2] * d2[1]
    n[1] += d1[2] * d2[0] - d1[0] * d2[2]
    n[2] += d1[0] * d2[1] - d1[1] * d2[0]
  }
  const l = Math.hypot(n[0], n[1], n[2]) || 1
  return [n[0] / l, n[1] / l, n[2] / l]
}

/** A target's delta at one vertex (dm), or [0,0,0]. */
export function targetDeltaAt(a: HumanAsset, name: string, v: number): V3 {
  const t = a.targets.get(name)
  if (!t) return [0, 0, 0]
  // idx is ascending (build.py writes sorted sparse rows): binary search
  let lo = 0
  let hi = t.idx.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const x = t.idx[mid]
    if (x === v)
      return [t.d[mid * 3] * t.scale, t.d[mid * 3 + 1] * t.scale, t.d[mid * 3 + 2] * t.scale]
    if (x < v) lo = mid + 1
    else hi = mid - 1
  }
  // not sorted after all? fall back to a scan
  for (let i = 0; i < t.idx.length; i++)
    if (t.idx[i] === v)
      return [t.d[i * 3] * t.scale, t.d[i * 3 + 1] * t.scale, t.d[i * 3 + 2] * t.scale]
  return [0, 0, 0]
}

/** Unit axis in the character frame for a handle side (x = outward on mirrored handles). */
export function axisVector(axis: HandleAxis, side: 1 | -1): V3 {
  return axis === 'x' ? [side, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1]
}

/**
 * How far (dm, along the axis) the landmark moves per unit of the slider's
 * max end and min end. Paired (left/right) sliders sum both sides' targets —
 * only the landmark's own side moves it.
 */
export function axisResponse(
  a: HumanAsset,
  p: HandlePoint,
  axis: HandleAxis
): { slider: string; dMax: number; dMin: number } | null {
  const id = p.handle.axes[axis]
  const s = id && SLIDER_BY_ID.get(id)
  if (!s) return null
  const u = axisVector(axis, p.side)
  const along = (names: string[]) => {
    let d = 0
    for (const n of names) {
      const t = targetDeltaAt(a, n, p.vertex)
      d += t[0] * u[0] + t[1] * u[1] + t[2] * u[2]
    }
    return d
  }
  // a target that moves the point only a millimetre or two would make the
  // handle twitchy: give every real response at least FEEL of travel
  const soft = (d: number) =>
    Math.abs(d) < MIN_TRAVEL ? d : Math.sign(d) * Math.max(Math.abs(d), FEEL_TRAVEL)
  return { slider: s.id, dMax: soft(along(s.max)), dMin: soft(along(s.min)) }
}

/** Minimum travel (dm per unit slider) a real response is given. */
const FEEL_TRAVEL = 0.2

/** Fallback travel (dm per unit slider) when a target barely moves the point. */
const FALLBACK_TRAVEL = 0.3
const MIN_TRAVEL = 0.02

/** Displacement (dm along the axis) a slider value produces at the landmark. */
export function displacementAt(value: number, dMax: number, dMin: number) {
  return value >= 0 ? value * dMax : -value * dMin
}

/**
 * The slider value that puts the landmark `pull` dm (along the axis) beyond
 * where `start` has it — so the grabbed feature follows the cursor. Clamped
 * to −1..1, two decimals.
 */
export function solveSlider(start: number, pull: number, dMax: number, dMin: number): number {
  const okMax = Math.abs(dMax) >= MIN_TRAVEL
  const okMin = Math.abs(dMin) >= MIN_TRAVEL
  let v: number
  if (!okMax && !okMin) {
    // the targets hardly touch this vertex: a plain linear response
    v = start + pull / FALLBACK_TRAVEL
  } else {
    const want = displacementAt(start, okMax ? dMax : 0, okMin ? dMin : 0) + pull
    const viaMax = okMax ? want / dMax : NaN // valid when ≥ 0
    const viaMin = okMin ? -want / dMin : NaN // valid when ≤ 0
    if (viaMax >= 0) v = viaMax
    else if (viaMin <= 0) v = viaMin
    // both ends push the same way and the pull asks for the other: rest at 0
    else v = 0
  }
  return Math.max(-1, Math.min(1, Math.round(v * 100) / 100))
}
