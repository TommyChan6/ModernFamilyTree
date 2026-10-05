// Path-authoring kit shared by the style packs: primitives (ellipse, rounded
// rect), smooth Catmull-Rom outlines through hand-placed points, symmetric
// shapes from one half, and a tiny SVG path transformer (mirror / move /
// scale) so an artist draws the right eye once and mirrors it. Pure string
// math — no DOM — so packs stay importable from tests and Node tools.

export type Pt = [number, number]

const f = (n: number): string => String(Math.round(n * 100) / 100)

/** Ellipse centered at (cx, cy). */
export const E = (cx: number, cy: number, rx: number, ry: number = rx): string =>
  `M ${f(cx - rx)} ${f(cy)} a ${f(rx)} ${f(ry)} 0 1 0 ${f(rx * 2)} 0 a ${f(rx)} ${f(ry)} 0 1 0 ${f(-rx * 2)} 0 Z`

/** Rounded rectangle. */
export const RR = (x: number, y: number, w: number, h: number, r: number): string => {
  r = Math.min(r, w / 2, h / 2)
  return (
    `M ${f(x + r)} ${f(y)} h ${f(w - 2 * r)} a ${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(r)} v ${f(h - 2 * r)} ` +
    `a ${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(r)} h ${f(-(w - 2 * r))} a ${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(-r)} ` +
    `v ${f(-(h - 2 * r))} a ${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(-r)} Z`
  )
}

/** Straight polygon (closed) or polyline (open). */
export function poly(pts: Pt[], closed = true): string {
  const s = pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${f(x)} ${f(y)}`).join(' ')
  return closed ? s + ' Z' : s
}

/** Smooth Catmull-Rom spline through the points as cubic Béziers.
 *  `tension` 0 = straight lines, 1 = the classic curve (default). */
export function smooth(pts: Pt[], closed = true, tension = 1): string {
  const n = pts.length
  if (n < 3) return poly(pts, closed)
  const at = (i: number): Pt => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))])
  const k = tension / 6
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`
  const segs = closed ? n : n - 1
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const c1x = p1[0] + (p2[0] - p0[0]) * k
    const c1y = p1[1] + (p2[1] - p0[1]) * k
    const c2x = p2[0] - (p3[0] - p1[0]) * k
    const c2y = p2[1] - (p3[1] - p1[1]) * k
    d += ` C ${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`
  }
  return closed ? d + ' Z' : d
}

/** Open smooth curve through the points (a stroke path). */
export const curve = (pts: Pt[], tension = 1): string => smooth(pts, false, tension)

/** Mirror a list of points across the vertical axis x = cx. */
export const mirrorPts = (pts: Pt[], cx = 160): Pt[] => pts.map(([x, y]) => [2 * cx - x, y])

/** A left/right-symmetric closed smooth shape from its RIGHT half: points
 *  run from the top center, down the right side, to the bottom center.
 *  Points lying on the axis are not duplicated. */
export function sym(half: Pt[], cx = 160, tension = 1): string {
  return smooth(symPts(half, cx), true, tension)
}

/** Same as sym() but with straight edges (armor plates, crowns…). */
export function symPoly(half: Pt[], cx = 160): string {
  return poly(symPts(half, cx), true)
}

export function symPts(half: Pt[], cx = 160): Pt[] {
  const onAxis = (p: Pt) => Math.abs(p[0] - cx) < 1e-6
  const left = mirrorPts(half, cx).reverse()
  const trimmed = left.filter((p, i) => !(onAxis(p) && (i === 0 || i === left.length - 1)))
  return [...half, ...trimmed]
}

// ── SVG path transformer ──────────────────────────────────────────────────────
type Seg = { c: string; v: number[] }

const ARG_COUNT: Record<string, number> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0
}

function tokenize(d: string): Seg[] {
  const out: Seg[] = []
  const re = /([MLHVCSQTAZmlhvcsqtaz])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/g
  let cmd = ''
  let nums: number[] = []
  const flush = () => {
    if (!cmd) return
    const up = cmd.toUpperCase()
    const n = ARG_COUNT[up]
    if (n === 0) out.push({ c: cmd, v: [] })
    else {
      for (let i = 0; i + n <= nums.length; i += n) {
        // Extra coordinate pairs after M are implicit L
        const c = i > 0 && up === 'M' ? (cmd === 'M' ? 'L' : 'l') : cmd
        out.push({ c, v: nums.slice(i, i + n) })
      }
    }
    nums = []
  }
  let m: RegExpExecArray | null
  while ((m = re.exec(d))) {
    if (m[1]) {
      flush()
      cmd = m[1]
    } else nums.push(parseFloat(m[2]))
  }
  flush()
  return out
}

/** Normalize to absolute M/L/C/Q/A/Z commands. */
function absolute(d: string): Seg[] {
  const out: Seg[] = []
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  let lastC: [number, number] | null = null // last cubic control (for S)
  let lastQ: [number, number] | null = null // last quad control (for T)
  for (const { c, v } of tokenize(d)) {
    const rel = c === c.toLowerCase()
    const U = c.toUpperCase()
    const ax = (i: number) => (rel ? x + v[i] : v[i])
    const ay = (i: number) => (rel ? y + v[i] : v[i])
    let nextC: [number, number] | null = null
    let nextQ: [number, number] | null = null
    switch (U) {
      case 'M':
        x = ax(0)
        y = ay(1)
        sx = x
        sy = y
        out.push({ c: 'M', v: [x, y] })
        break
      case 'L':
        x = ax(0)
        y = ay(1)
        out.push({ c: 'L', v: [x, y] })
        break
      case 'H':
        x = rel ? x + v[0] : v[0]
        out.push({ c: 'L', v: [x, y] })
        break
      case 'V':
        y = rel ? y + v[0] : v[0]
        out.push({ c: 'L', v: [x, y] })
        break
      case 'C': {
        const s = [ax(0), ay(1), ax(2), ay(3), ax(4), ay(5)]
        out.push({ c: 'C', v: s })
        nextC = [s[2], s[3]]
        x = s[4]
        y = s[5]
        break
      }
      case 'S': {
        const c1: number[] = lastC ? [2 * x - lastC[0], 2 * y - lastC[1]] : [x, y]
        const s: number[] = [c1[0], c1[1], ax(0), ay(1), ax(2), ay(3)]
        out.push({ c: 'C', v: s })
        nextC = [s[2], s[3]]
        x = s[4]
        y = s[5]
        break
      }
      case 'Q': {
        const s = [ax(0), ay(1), ax(2), ay(3)]
        out.push({ c: 'Q', v: s })
        nextQ = [s[0], s[1]]
        x = s[2]
        y = s[3]
        break
      }
      case 'T': {
        const c1: number[] = lastQ ? [2 * x - lastQ[0], 2 * y - lastQ[1]] : [x, y]
        const s: number[] = [c1[0], c1[1], ax(0), ay(1)]
        out.push({ c: 'Q', v: s })
        nextQ = [s[0], s[1]]
        x = s[2]
        y = s[3]
        break
      }
      case 'A': {
        const ex = ax(5)
        const ey = ay(6)
        out.push({ c: 'A', v: [v[0], v[1], v[2], v[3], v[4], ex, ey] })
        x = ex
        y = ey
        break
      }
      case 'Z':
        out.push({ c: 'Z', v: [] })
        x = sx
        y = sy
        break
    }
    lastC = nextC
    lastQ = nextQ
  }
  return out
}

/** Apply x' = x·sx + tx, y' = y·sy + ty to every point of a path. */
export function transformD(d: string, sx: number, sy: number, tx: number, ty: number): string {
  const X = (v: number) => f(v * sx + tx)
  const Y = (v: number) => f(v * sy + ty)
  return absolute(d)
    .map(({ c, v }) => {
      switch (c) {
        case 'M':
        case 'L':
          return `${c} ${X(v[0])} ${Y(v[1])}`
        case 'C':
          return `C ${X(v[0])} ${Y(v[1])} ${X(v[2])} ${Y(v[3])} ${X(v[4])} ${Y(v[5])}`
        case 'Q':
          return `Q ${X(v[0])} ${Y(v[1])} ${X(v[2])} ${Y(v[3])}`
        case 'A': {
          const flipSweep = sx * sy < 0
          const rot = flipSweep ? -v[2] : v[2]
          const sweep = flipSweep ? 1 - v[4] : v[4]
          return `A ${f(Math.abs(v[0] * sx))} ${f(Math.abs(v[1] * sy))} ${f(rot)} ${v[3]} ${sweep} ${X(v[5])} ${Y(v[6])}`
        }
        default:
          return 'Z'
      }
    })
    .join(' ')
}

/** Mirror a path across x = cx. */
export const flipX = (d: string, cx = 160): string => transformD(d, -1, 1, 2 * cx, 0)

/** Move a path. */
export const moveD = (d: string, dx: number, dy: number): string => transformD(d, 1, 1, dx, dy)

/** Scale a path about (cx, cy). */
export const scaleD = (d: string, s: number, cx: number, cy: number, sy = s): string =>
  transformD(d, s, sy, cx - cx * s, cy - cy * sy)

/** Build a symmetric pair of layer lists: `make` authors the RIGHT-side
 *  (viewer's right) copy; the left is its mirror across x = cx. Gradients
 *  are mirrored too. */
export function mirrored<T extends { d: string; grad?: unknown }>(right: T[], cx = 160): T[] {
  const left = right.map((l) => {
    const copy: T = { ...l, d: flipX(l.d, cx) }
    if (l.grad) copy.grad = mirrorGrad(l.grad as Record<string, unknown>, cx) as T['grad']
    return copy
  })
  return [...left, ...right]
}

function mirrorGrad(g: Record<string, unknown>, cx: number): Record<string, unknown> {
  const m = (v: unknown) => (typeof v === 'number' ? 2 * cx - v : v)
  if (g.type === 'linear') return { ...g, x1: m(g.x1), x2: m(g.x2) }
  return { ...g, cx: m(g.cx), fx: g.fx === undefined ? undefined : m(g.fx) }
}
