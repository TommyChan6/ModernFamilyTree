// Pure math for the Groups view's Venn style — no D3, no store, no DOM.
//
// In the Venn style a group is not a fixed disc: it is a soft MEMBRANE that
// starts as the classic disc and stretches out to engulf every member who sits
// outside it. People who belong to several groups settle between their camps,
// so each of those groups reaches for them and the membranes overlap around
// them — the overlap IS the shared membership, no tether lines needed.
//
// A membrane is star-shaped around its group centre, so it is stored as a
// polar outline: SHAPE_SAMPLES radii at evenly spaced angles (0 = +x, y-down
// canvas, the same atan2 space as the rest of the view). The renderer samples
// it on the GPU; hit tests sample it here.

export const SHAPE_SAMPLES = 512
/** Clearance around a member inside its membrane (node + membership arcs + air). */
export const MEMBER_PAD = 31
const TAU = Math.PI * 2
const HULL_STEPS = 20 // interpolated circles per lobe hull

export interface Pt {
  x: number
  y: number
}

export interface MembraneOpts {
  /** Clearance kept around each member (world units). */
  pad?: number
  /** 0 = taut tendrils, 1 = a broad, fluid pull. */
  softness?: number
  /** Reuse this buffer (length SHAPE_SAMPLES) instead of allocating. */
  out?: Float32Array
}

const wrapAngle = (a: number): number => {
  a %= TAU
  if (a > Math.PI) a -= TAU
  else if (a < -Math.PI) a += TAU
  return a
}

/**
 * The polar outline of one group's membrane: the base disc of radius `base`
 * around (cx, cy), stretched to wrap every member in `members` with `pad`
 * clearance. Each outside member pulls a tapered lobe — the convex hull of a
 * broad root circle resting inside the disc and a `pad` circle around the
 * member — and the creases where lobes meet the disc are filleted, so the
 * outline reads as one elastic skin rather than a disc with stalks.
 */
export function membraneShape(
  cx: number,
  cy: number,
  base: number,
  members: Pt[],
  opts: MembraneOpts = {}
): Float32Array {
  const N = SHAPE_SAMPLES
  const pad = opts.pad ?? MEMBER_PAD
  const soft = Math.min(1, Math.max(0, opts.softness ?? 0.5))
  const out = opts.out && opts.out.length === N ? opts.out : new Float32Array(N)
  out.fill(base)
  const step = TAU / N
  let lobes = 0
  for (const m of members) {
    const dx = m.x - cx
    const dy = m.y - cy
    const d = Math.hypot(dx, dy)
    const reach = d + pad - base
    if (!(reach > 0.5)) continue // already comfortably inside the disc
    lobes++
    const phi = Math.atan2(dy, dx)
    // Root circle: rests inside the disc, wider the further the lobe reaches.
    const rho = Math.min(base * 0.8, pad + reach * (0.18 + 0.55 * soft))
    const m0 = Math.max(0, base - rho)
    // Angular window the lobe can touch. q/m along the lobe is a ratio of two
    // linear functions — monotonic — so its two end circles bound it.
    const w0 = m0 <= rho ? Math.PI : Math.asin(rho / m0)
    const w1 = d <= pad ? Math.PI : Math.asin(pad / d)
    const half = Math.max(w0, w1) + 0.02
    const span = Math.min(N / 2, Math.ceil(half / step) + 1)
    const j0 = Math.round(phi / step)
    for (let o = -span; o <= span; o++) {
      const j = (((j0 + o) % N) + N) % N
      const alpha = wrapAngle(j * step - phi)
      const ca = Math.cos(alpha)
      const sa = Math.abs(Math.sin(alpha))
      let hit = -1
      // The hull of linearly interpolated circles — sampled finely enough that
      // the scallops vanish under the fillet pass below.
      for (let s = 0; s <= HULL_STEPS; s++) {
        const t = s / HULL_STEPS
        const mc = m0 + (d - m0) * t
        const q = rho + (pad - rho) * t
        const disc = q * q - mc * mc * sa * sa
        if (disc < 0) continue
        const h = mc * ca + Math.sqrt(disc)
        if (h > hit) hit = h
      }
      if (hit > out[j]) out[j] = hit
    }
  }
  if (lobes) fillet(out, Math.round(N / 64 + soft * (N / 40)), 2)
  return out
}

/**
 * Round the concave creases of a polar outline without shrinking its lobes:
 * a circular box blur, kept only where it raises the radius (a morphological
 * closing), repeated `passes` times.
 */
function fillet(r: Float32Array, radius: number, passes: number): void {
  const N = r.length
  const tmp = new Float32Array(N)
  const w = 2 * radius + 1
  for (let p = 0; p < passes; p++) {
    let sum = 0
    for (let o = -radius; o <= radius; o++) sum += r[(o + N) % N]
    for (let j = 0; j < N; j++) {
      tmp[j] = Math.max(r[j], sum / w)
      sum += r[(j + radius + 1) % N] - r[(j - radius + N) % N]
    }
    r.set(tmp)
  }
}

/** The outline's radius at `angle` (radians, atan2 space), linearly interpolated. */
export function shapeRadius(shape: ArrayLike<number>, angle: number): number {
  const N = shape.length
  let u = (angle / TAU) * N
  u = ((u % N) + N) % N
  const i0 = Math.floor(u)
  const f = u - i0
  return shape[i0] * (1 - f) + shape[(i0 + 1) % N] * f
}

/** Is the world point (x, y) inside the outline centred at (cx, cy)? */
export function pointInShape(
  shape: ArrayLike<number>,
  cx: number,
  cy: number,
  x: number,
  y: number
): boolean {
  const dx = x - cx
  const dy = y - cy
  return Math.hypot(dx, dy) <= shapeRadius(shape, Math.atan2(dy, dx))
}

/** The outline's largest radius (sizes the zone's GPU quad). */
export function shapeExtent(shape: ArrayLike<number>): number {
  let m = 0
  for (let i = 0; i < shape.length; i++) if (shape[i] > m) m = shape[i]
  return m
}

/** dr/dθ at every sample (central differences) — lets the shader turn the
 *  radial gap into a true distance for crisp, even outlines on steep lobes. */
export function shapeSlopes(shape: ArrayLike<number>, out?: Float32Array): Float32Array {
  const N = shape.length
  const res = out && out.length === N ? out : new Float32Array(N)
  const k = N / (2 * TAU)
  for (let j = 0; j < N; j++) res[j] = (shape[(j + 1) % N] - shape[(j - 1 + N) % N]) * k
  return res
}

// ── Venn person targets ──────────────────────────────────────────────────────

export interface VennZone {
  id: string
  x: number
  y: number
  r: number
  member_ids?: string[]
  visible?: boolean
}

/**
 * Where each person should settle so the picture reads as a Venn diagram:
 * the average of their groups' centres (like the Rings style), then pushed
 * out of every OTHER group's disc that covers that spot — someone in A only
 * must not look like they are in B just because B overlaps A's middle.
 * Returns { [personId]: { x, y, factionIds } }.
 */
export function vennTargets(
  zones: VennZone[],
  pad = MEMBER_PAD
): Record<string, { x: number; y: number; factionIds: string[] }> {
  const vis = zones.filter((z) => z.visible !== false)
  const acc: Record<string, { x: number; y: number; n: number; factionIds: string[] }> = {}
  for (const z of vis) {
    for (const pid of z.member_ids || []) {
      const t = acc[pid] || (acc[pid] = { x: 0, y: 0, n: 0, factionIds: [] })
      t.x += z.x
      t.y += z.y
      t.n++
      t.factionIds.push(z.id)
    }
  }
  // Group the people by membership set: everyone with the same set shares a
  // target, so the push-out runs once per region instead of once per person.
  const regions = new Map<string, Pt>()
  const out: Record<string, { x: number; y: number; factionIds: string[] }> = {}
  for (const [pid, t] of Object.entries(acc)) {
    const key = t.factionIds.join('|')
    let p = regions.get(key)
    if (!p) {
      p = { x: t.x / t.n, y: t.y / t.n }
      const mine = new Set(t.factionIds)
      for (let pass = 0; pass < 3; pass++) {
        for (const z of vis) {
          if (mine.has(z.id)) continue
          const dx = p.x - z.x
          const dy = p.y - z.y
          const d = Math.hypot(dx, dy)
          const need = z.r + pad
          if (d >= need) continue
          // Exactly on a foreign centre: step out toward our own first group.
          const own = vis.find((v) => v.id === t.factionIds[0])
          const ux = d > 1e-6 ? dx / d : own ? Math.sign(own.x - z.x) || 1 : 1
          const uy = d > 1e-6 ? dy / d : own ? own.y - z.y : 0
          const ul = Math.hypot(ux, uy) || 1
          p.x = z.x + (ux / ul) * need
          p.y = z.y + (uy / ul) * need
        }
      }
      regions.set(key, p)
    }
    out[pid] = { x: p.x, y: p.y, factionIds: t.factionIds }
  }
  return out
}

// ── Venn arrange ─────────────────────────────────────────────────────────────

export interface ArrangeGroup {
  id: string
  x: number
  y: number
  r: number
  member_ids?: string[]
}

/**
 * The one-click arrange for the Venn style: groups that share people are
 * pulled into overlap (deeper the more they share; a group wholly inside a
 * larger one nests within it), groups that share nobody are pushed clear of
 * each other so no overlap ever suggests a membership that isn't there.
 * Starts from the current placement, so it tidies rather than reshuffles.
 * Deterministic. Returns [{ id, x, y }] centred on (cx, cy).
 */
export function arrangeVenn(
  groups: ArrangeGroup[],
  cx: number,
  cy: number,
  { pad = MEMBER_PAD, gap = 70, iterations = 320 } = {}
): { id: string; x: number; y: number }[] {
  const n = groups.length
  if (!n) return []
  if (n === 1) return [{ id: groups[0].id, x: cx, y: cy }]
  const sets = groups.map((g) => new Set(g.member_ids || []))
  const P = groups.map((g, i) => ({ x: g.x, y: g.y, i }))
  // Pull coincident starts apart deterministically (golden-angle spiral).
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (Math.hypot(P[i].x - P[j].x, P[i].y - P[j].y) < 1) {
        P[i].x += Math.cos(i * 2.4) * (20 + i * 6)
        P[i].y += Math.sin(i * 2.4) * (20 + i * 6)
      }
    }
  }
  // Desired distance per pair (null = only keep them apart).
  const want: (number | null)[][] = []
  for (let i = 0; i < n; i++) {
    want.push([])
    for (let j = 0; j < n; j++) {
      if (i === j) {
        want[i].push(null)
        continue
      }
      const a = groups[i]
      const b = groups[j]
      let shared = 0
      const [small, big] = sets[i].size <= sets[j].size ? [sets[i], sets[j]] : [sets[j], sets[i]]
      for (const p of small) if (big.has(p)) shared++
      if (!shared) {
        want[i].push(null)
        continue
      }
      const rSmall = Math.min(a.r, b.r)
      const rBig = Math.max(a.r, b.r)
      if (shared === small.size && rBig - rSmall > pad * 1.5) {
        // a subset: nest inside, nudged off-centre so the larger keeps a crescent
        want[i].push((rBig - rSmall) * 0.5)
        continue
      }
      // lens depth sized to seat the shared people comfortably
      const depth = Math.min(rSmall * 1.3, pad * 2.2 + Math.sqrt(shared) * pad * 1.15)
      want[i].push(Math.max(pad, a.r + b.r - depth))
    }
  }
  for (let it = 0; it < iterations; it++) {
    const cool = 1 - it / iterations
    const fx = new Float64Array(n)
    const fy = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = P[j].x - P[i].x
        let dy = P[j].y - P[i].y
        let d = Math.hypot(dx, dy)
        if (d < 1e-6) {
          dx = 1
          dy = 0
          d = 1e-6
        }
        const ux = dx / d
        const uy = dy / d
        const w = want[i][j]
        let f = 0
        if (w != null) f = (d - w) * 0.12
        else {
          const min = groups[i].r + groups[j].r + gap
          if (d < min) f = (d - min) * 0.35
        }
        fx[i] += ux * f
        fy[i] += uy * f
        fx[j] -= ux * f
        fy[j] -= uy * f
      }
    }
    for (let i = 0; i < n; i++) {
      // a faint pull to the middle keeps unrelated clusters from drifting off
      fx[i] += (cx - P[i].x) * 0.004
      fy[i] += (cy - P[i].y) * 0.004
      P[i].x += fx[i] * (0.35 + 0.65 * cool)
      P[i].y += fy[i] * (0.35 + 0.65 * cool)
    }
  }
  // Centre the arrangement's bounding box on (cx, cy).
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const p of P) {
    const r = groups[p.i].r
    minX = Math.min(minX, p.x - r)
    minY = Math.min(minY, p.y - r)
    maxX = Math.max(maxX, p.x + r)
    maxY = Math.max(maxY, p.y + r)
  }
  const ox = cx - (minX + maxX) / 2
  const oy = cy - (minY + maxY) / 2
  return P.map((p) => ({ id: groups[p.i].id, x: p.x + ox, y: p.y + oy }))
}
