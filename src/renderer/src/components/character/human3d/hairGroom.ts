// Procedural grooming: grows hair strands from root samples on the scalp /
// brow / beard regions along per-style flow rules, against a collision
// "hull" (a spherical radius map around the head that also covers the neck,
// shoulders and face — hair can't sink into anything it would rest on), then
// curls, frizzes and clumps them and resamples each to a fixed point count.
// Pure math on Float32Arrays (decimetres, rig space); no THREE.
//
// Tests: tests/human3dMath.test.js

export type V3 = [number, number, number]

export interface RootSample {
  p: V3
  n: V3
  /** Region-specific coordinates (brows: u along, v across). */
  u: number
  v: number
  /** Which beard zone / lid the root came from (style-specific tag). */
  tag: number
}

/** Spherical radius map: outer hull radius around `c` by direction. */
export interface Hull {
  c: V3
  nAz: number
  nEl: number
  r: Float32Array
}

export function buildHull(
  c: V3,
  points: Float32Array,
  maxDist: number,
  nAz = 96,
  nEl = 64,
  include?: (i: number) => boolean
): Hull {
  const r = new Float32Array(nAz * nEl)
  for (let i = 0; i < points.length; i += 3) {
    if (include && !include(i / 3)) continue
    const dx = points[i] - c[0]
    const dy = points[i + 1] - c[1]
    const dz = points[i + 2] - c[2]
    const d = Math.hypot(dx, dy, dz)
    if (d > maxDist || d < 1e-6) continue
    const [a, e] = binOf(dx / d, dy / d, dz / d, nAz, nEl)
    const k = e * nAz + a
    if (d > r[k]) r[k] = d
  }
  // fill small holes (dilate) then blur once so the hull is smooth; large
  // empty regions (below the jaw) stay open — colliders handle the body
  for (let pass = 0; pass < 2; pass++) {
    const next = r.slice()
    for (let e = 0; e < nEl; e++) {
      for (let a = 0; a < nAz; a++) {
        const k = e * nAz + a
        if (r[k] > 0) continue
        let best = 0
        for (const [da, de] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1]
        ]) {
          const ee = e + de
          if (ee < 0 || ee >= nEl) continue
          best = Math.max(best, r[ee * nAz + ((a + da + nAz) % nAz)])
        }
        next[k] = best
      }
    }
    r.set(next)
  }
  const blurred = r.slice()
  for (let e = 0; e < nEl; e++) {
    for (let a = 0; a < nAz; a++) {
      let s = 0
      let w = 0
      for (let de = -1; de <= 1; de++) {
        const ee = e + de
        if (ee < 0 || ee >= nEl) continue
        for (let da = -1; da <= 1; da++) {
          const v = r[ee * nAz + ((a + da + nAz) % nAz)]
          if (v > 0) {
            s += Math.max(v, r[e * nAz + a])
            w++
          }
        }
      }
      if (w) blurred[e * nAz + a] = s / w
    }
  }
  return { c, nAz, nEl, r: blurred }
}

function binOf(x: number, y: number, z: number, nAz: number, nEl: number): [number, number] {
  const az = Math.atan2(x, z) // −π..π, 0 = front
  const el = Math.asin(Math.max(-1, Math.min(1, y))) // −π/2..π/2
  const a = Math.min(nAz - 1, Math.floor(((az + Math.PI) / (2 * Math.PI)) * nAz))
  const e = Math.min(nEl - 1, Math.floor(((el + Math.PI / 2) / Math.PI) * nEl))
  return [a, e]
}

/** Bilinear hull radius in a direction (unit vector components). */
export function hullRadius(h: Hull, x: number, y: number, z: number): number {
  const az = Math.atan2(x, z)
  const el = Math.asin(Math.max(-1, Math.min(1, y)))
  const fa = ((az + Math.PI) / (2 * Math.PI)) * h.nAz - 0.5
  const fe = ((el + Math.PI / 2) / Math.PI) * h.nEl - 0.5
  const a0 = Math.floor(fa)
  const e0 = Math.max(0, Math.min(h.nEl - 2, Math.floor(fe)))
  const ta = fa - a0
  const te = Math.max(0, Math.min(1, fe - e0))
  const at = (a: number, e: number) => h.r[e * h.nAz + (((a % h.nAz) + h.nAz) % h.nAz)]
  // Interpolate over the non-empty bins only: blending a real radius with an
  // empty bin (no surface in that direction) would shrink the hull at its
  // edges and let hair sink into the jaw.
  const r00 = at(a0, e0)
  const r10 = at(a0 + 1, e0)
  const r01 = at(a0, e0 + 1)
  const r11 = at(a0 + 1, e0 + 1)
  const w00 = r00 > 0 ? (1 - ta) * (1 - te) : 0
  const w10 = r10 > 0 ? ta * (1 - te) : 0
  const w01 = r01 > 0 ? (1 - ta) * te : 0
  const w11 = r11 > 0 ? ta * te : 0
  const ws = w00 + w10 + w01 + w11
  if (ws < 1e-6) return 0
  return (r00 * w00 + r10 * w10 + r01 * w01 + r11 * w11) / ws
}

/** Body proxies: ellipsoids (axis-aligned) and capsules. */
export type Collider =
  { kind: 'ellipsoid'; c: V3; r: V3 } | { kind: 'capsule'; a: V3; b: V3; r: number }

/** Everything hair can't pass through: the head hull + body proxies. */
export interface Collision {
  hull: Hull
  /** Optional second radial hull (the torso). */
  torso?: Hull | null
  parts: Collider[]
}

function pushCollider(k: Collider, p: number[] | Float32Array, o: number, margin: number): boolean {
  if (k.kind === 'ellipsoid') {
    const ex = (p[o] - k.c[0]) / (k.r[0] + margin)
    const ey = (p[o + 1] - k.c[1]) / (k.r[1] + margin)
    const ez = (p[o + 2] - k.c[2]) / (k.r[2] + margin)
    const d = Math.hypot(ex, ey, ez)
    if (d >= 1 || d < 1e-6) return false
    p[o] = k.c[0] + (ex / d) * (k.r[0] + margin)
    p[o + 1] = k.c[1] + (ey / d) * (k.r[1] + margin)
    p[o + 2] = k.c[2] + (ez / d) * (k.r[2] + margin)
    return true
  }
  const ab = [k.b[0] - k.a[0], k.b[1] - k.a[1], k.b[2] - k.a[2]]
  const ap = [p[o] - k.a[0], p[o + 1] - k.a[1], p[o + 2] - k.a[2]]
  const t = Math.max(
    0,
    Math.min(
      1,
      (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1)
    )
  )
  const q = [k.a[0] + ab[0] * t, k.a[1] + ab[1] * t, k.a[2] + ab[2] * t]
  const dx = p[o] - q[0]
  const dy = p[o + 1] - q[1]
  const dz = p[o + 2] - q[2]
  const d = Math.hypot(dx, dy, dz)
  const R = k.r + margin
  if (d >= R || d < 1e-6) return false
  p[o] = q[0] + (dx / d) * R
  p[o + 1] = q[1] + (dy / d) * R
  p[o + 2] = q[2] + (dz / d) * R
  return true
}

/** Push a point out of the head hull and every body proxy (+margin). */
export function collide(
  col: Collision | Hull,
  p: number[] | Float32Array,
  o: number,
  margin: number
): boolean {
  if ('hull' in col) {
    let moved = collideHull(col.hull, p, o, margin)
    if (col.torso) moved = collideHull(col.torso, p, o, margin) || moved
    for (const k of col.parts) moved = pushCollider(k, p, o, margin) || moved
    return moved
  }
  return collideHull(col, p, o, margin)
}

function collideHull(h: Hull, p: number[] | Float32Array, o: number, margin: number): boolean {
  const dx = p[o] - h.c[0]
  const dy = p[o + 1] - h.c[1]
  const dz = p[o + 2] - h.c[2]
  const d = Math.hypot(dx, dy, dz)
  if (d < 1e-6) return false
  const r = hullRadius(h, dx / d, dy / d, dz / d)
  if (r <= 0 || d >= r + margin) return false
  const k = (r + margin) / d
  p[o] = h.c[0] + dx * k
  p[o + 1] = h.c[1] + dy * k
  p[o + 2] = h.c[2] + dz * k
  return true
}

/** A small deterministic PRNG (xorshift32). */
export function rng(seed: number) {
  let s = seed >>> 0 || 0x9e3779b9
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
]
/** Remove the normal component (stay on the surface). */
const tangential = (v: V3, n: V3, keep = 0): V3 => add(v, n, -dot(v, n) * (1 - keep))

// ── Strand growth ────────────────────────────────────────────────────────────
export interface GrowSpec {
  root: V3
  normal: V3
  length: number
  segments: number
  /** Initial direction. */
  dir: V3
  /** 0..1: how much the previous direction persists each step. */
  stiffness: number
  gravity: number
  /** Optional steering (target direction at arc fraction s and position p). */
  steer?: (p: V3, s: number) => V3 | null
  /** Collision margin above the hull (layering / volume). */
  margin: number
  /** Cut: stop growing below this y (rig space), or null. */
  cutY?: number | null
}

/** Grow one strand; returns flat points (segments + 1 entries, or fewer if cut). */
export function grow(spec: GrowSpec, hull: Collision | Hull | null): number[] {
  const seg = spec.length / spec.segments
  const p: V3 = add(spec.root, spec.normal, 0.003)
  const pts: number[] = [...p]
  let dir = norm(spec.dir)
  for (let i = 1; i <= spec.segments; i++) {
    const s = i / spec.segments
    // steering blends by stiffness; gravity bends per unit length (so long
    // strands fall and slide over the head, short ones keep their set)
    const st = spec.steer?.(p, s)
    if (st) {
      const k = spec.stiffness
      dir = norm(add([dir[0] * k, dir[1] * k, dir[2] * k], norm(st), 1 - k))
    }
    dir = norm(add(dir, [0, -1, 0], spec.gravity * seg * 7))
    const next: V3 = add(p, dir, seg)
    const bx = next[0]
    const by = next[1]
    const bz = next[2]
    // keep the first stretch a little off the hull so roots don't sink
    if (hull) collide(hull, next, 0, spec.margin * Math.min(1, 0.4 + s * 3))
    // A collision SLIDES the strand along the surface: drop the part of the
    // heading that pointed into it, but never keep the push as momentum (or
    // hair flares out wherever the head ends)
    const px = next[0] - bx
    const py = next[1] - by
    const pz = next[2] - bz
    const pl = Math.hypot(px, py, pz)
    if (pl > 1e-9) {
      const n: V3 = [px / pl, py / pl, pz / pl]
      const d = dot(dir, n)
      if (d < 0) dir = norm(add(dir, n, -d))
    }
    p[0] = next[0]
    p[1] = next[1]
    p[2] = next[2]
    if (spec.cutY != null && p[1] < spec.cutY) {
      // land the tip exactly on the cut line
      const prevY = pts[pts.length - 2]
      const f = (prevY - spec.cutY) / Math.max(1e-6, prevY - p[1])
      const n = pts.length
      pts.push(
        pts[n - 3] + (p[0] - pts[n - 3]) * f,
        spec.cutY,
        pts[n - 1] + (p[2] - pts[n - 1]) * f
      )
      break
    }
    pts.push(p[0], p[1], p[2])
  }
  return pts
}

/** Resample a polyline to `n` points evenly spaced by arc length. */
export function resample(
  pts: ArrayLike<number>,
  n: number,
  out: Float32Array = new Float32Array(n * 3),
  o = 0
): Float32Array {
  const m = pts.length / 3
  if (m < 2) {
    for (let i = 0; i < n; i++) {
      out[o + i * 3] = pts[0]
      out[o + i * 3 + 1] = pts[1]
      out[o + i * 3 + 2] = pts[2]
    }
    return out
  }
  const acc = [0]
  for (let i = 1; i < m; i++) {
    acc.push(
      acc[i - 1] +
        Math.hypot(
          pts[i * 3] - pts[i * 3 - 3],
          pts[i * 3 + 1] - pts[i * 3 - 2],
          pts[i * 3 + 2] - pts[i * 3 - 1]
        )
    )
  }
  const total = acc[m - 1] || 1e-6
  let j = 0
  for (let i = 0; i < n; i++) {
    const s = (i / (n - 1)) * total
    while (j < m - 2 && acc[j + 1] < s) j++
    const f = Math.min(1, Math.max(0, (s - acc[j]) / Math.max(1e-9, acc[j + 1] - acc[j])))
    for (let c = 0; c < 3; c++)
      out[o + i * 3 + c] = pts[j * 3 + c] + (pts[j * 3 + 3 + c] - pts[j * 3 + c]) * f
  }
  return out
}

/**
 * Curl / wave / frizz a resampled strand in place. `phase` and `axisSeed`
 * should be shared within a clump so neighbouring strands curl together.
 */
export function curlStrand(
  out: Float32Array,
  o: number,
  n: number,
  opts: {
    curl: number
    wave: number
    frizz: number
    period: number
    phase: number
    jitter: () => number
    from?: number
  }
) {
  if (opts.curl <= 0 && opts.wave <= 0 && opts.frizz <= 0) return
  const from = opts.from ?? 0.12
  // arc length per point
  let len = 0
  for (let i = 1; i < n; i++) {
    const a = o + i * 3
    len += Math.hypot(out[a] - out[a - 3], out[a + 1] - out[a - 2], out[a + 2] - out[a - 1])
  }
  const base = Float32Array.from(out.subarray(o, o + n * 3))
  let side: V3 = [1, 0, 0]
  for (let i = 1; i < n; i++) {
    const a = o + i * 3
    const t = i / (n - 1)
    const tan = norm([
      base[i * 3] - base[i * 3 - 3],
      base[i * 3 + 1] - base[i * 3 - 2],
      base[i * 3 + 2] - base[i * 3 - 1]
    ])
    // parallel-transported frame (keeps the helix from twisting)
    let b = cross(tan, side)
    if (Math.hypot(...b) < 1e-4) b = cross(tan, [0, 1, 0])
    b = norm(b)
    side = norm(cross(b, tan))
    const ramp = Math.min(1, Math.max(0, (t - from) / 0.2))
    const s = (t * len) / opts.period + opts.phase
    const ang = s * Math.PI * 2
    const cr = opts.curl * ramp
    const wv = opts.wave * ramp
    const fz = opts.frizz * ramp * t
    for (let c = 0; c < 3; c++) {
      out[a + c] =
        base[i * 3 + c] +
        (Math.cos(ang) * side[c] + Math.sin(ang) * b[c]) * cr +
        Math.sin(ang * 0.5) * side[c] * wv +
        (opts.jitter() - 0.5) * fz
    }
  }
}

export { norm, add, dot, cross, tangential }
