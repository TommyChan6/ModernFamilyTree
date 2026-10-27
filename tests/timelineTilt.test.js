import { describe, it, expect } from 'vitest'
import {
  tiltView,
  isTilted,
  tiltAmount,
  projectFlat,
  unprojectFlat,
  projectLifted,
  liftPoint,
  boardDepth,
  nearLimit,
  clipSegmentNear,
  clipPolygonNear,
  visibleFlatBounds,
  arcHeight,
  ropeLift,
  branchLift,
  sproutLift,
  liftSamples,
  distToSegment,
  pinHit,
  billboardFrame,
  frameRectToFlat,
  TILT_FULL,
  ARC_LIFT_MAX
} from '../src/renderer/src/components/timeline/timelineTilt'
import { worldToScreen, tiltProjection } from '../src/renderer/src/components/graph/webgl/coords.js'

const W = 1200,
  H = 800
const DEG = Math.PI / 180
const FLAT = tiltView(0, 0, W, H)
const T = tiltView(45 * DEG, 0, W, H)
const TY = tiltView(40 * DEG, 35 * DEG, W, H)

// Run a flat point through the GPU matrix the renderer uses (row-major 4×4).
function gpu(m, x, y) {
  const cx = m[0] * x + m[1] * y + m[3]
  const cy = m[4] * x + m[5] * y + m[7]
  const cw = m[12] * x + m[13] * y + m[15]
  return { x: ((cx / cw + 1) / 2) * W, y: ((1 - cy / cw) / 2) * H }
}

describe('timeline tilt: the board', () => {
  it('is the identity when flat', () => {
    expect(isTilted(FLAT)).toBe(false)
    expect(tiltAmount(FLAT)).toBe(0)
    for (const [x, y] of [
      [0, 0],
      [333.3, 512.7],
      [-80, 2000]
    ]) {
      expect(projectFlat(x, y, FLAT)).toEqual({ x, y, s: 1 })
      expect(unprojectFlat(x, y, FLAT)).toEqual({ x, y })
      expect(liftPoint(x, y, 120, FLAT)).toEqual({ x, y })
    }
    expect(nearLimit(FLAT)).toBe(Infinity)
    expect(visibleFlatBounds(FLAT, W, H)).toEqual({ x0: 0, y0: 0, x1: W, y1: H })
  })

  it('reuses the graph homography (coords.js) exactly', () => {
    for (const [x, y] of [
      [100, 100],
      [600, 400],
      [900, 700]
    ]) {
      const a = projectFlat(x, y, TY)
      const b = worldToScreen(x, y, TY)
      expect(a.x).toBeCloseTo(b.x, 9)
      expect(a.y).toBeCloseTo(b.y, 9)
      // …and the GPU path agrees with the CPU path
      const g = gpu(tiltProjection(TY, W, H), x, y)
      expect(g.x).toBeCloseTo(a.x, 4)
      expect(g.y).toBeCloseTo(a.y, 4)
    }
  })

  it('round-trips screen ↔ flat', () => {
    for (const view of [T, TY]) {
      for (const [x, y] of [
        [50, 60],
        [600, 400],
        [1100, 790]
      ]) {
        const s = projectFlat(x, y, view)
        const f = unprojectFlat(s.x, s.y, view)
        expect(f.x).toBeCloseTo(x, 6)
        expect(f.y).toBeCloseTo(y, 6)
      }
    }
  })

  it('reaches full lift at TILT_FULL', () => {
    expect(tiltAmount(tiltView(TILT_FULL, 0, W, H))).toBeCloseTo(1, 9)
    expect(tiltAmount(tiltView(TILT_FULL / 2, 0, W, H))).toBeCloseTo(0.5, 9)
    expect(tiltAmount(tiltView(80 * DEG, 0, W, H))).toBe(1)
  })

  it('shows more of the board than the viewport when tilted', () => {
    const b = visibleFlatBounds(T, W, H)
    expect(b.y0).toBeLessThan(0) // the far side recedes
    expect(b.x0).toBeLessThan(0)
    expect(b.x1).toBeGreaterThan(W)
  })
})

describe('timeline tilt: lifted arcs', () => {
  it('rises up the screen and lands back on the board at h = 0', () => {
    const base = projectFlat(600, 400, T)
    const up = projectLifted(600, 400, 80, T)
    expect(up.y).toBeLessThan(base.y)
    expect(projectLifted(600, 400, 0, T)).toEqual(base)
    // nearer the viewer → a touch larger
    expect(up.s).toBeGreaterThan(base.s)
  })

  it('liftPoint is the board point under the lifted one', () => {
    for (const view of [T, TY]) {
      const L = projectLifted(420, 300, 60, view)
      const q = liftPoint(420, 300, 60, view)
      const back = projectFlat(q.x, q.y, view)
      expect(back.x).toBeCloseTo(L.x, 6)
      expect(back.y).toBeCloseTo(L.y, 6)
    }
  })

  it('separates overlapping arcs by parallax when the board turns', () => {
    // two arcs over the same midpoint, one reaching twice as far: flat they
    // coincide; tilted + turned their raised midpoints part on screen
    const hNear = arcHeight(150),
      hFar = arcHeight(300)
    expect(hFar).toBeGreaterThan(hNear)
    const a = projectLifted(600, 400, hNear, TY)
    const b = projectLifted(600, 400, hFar, TY)
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(40)
    // flat, a lift is no lift at all
    expect(liftPoint(600, 400, hFar, FLAT)).toEqual({ x: 600, y: 400 })
  })

  it('arc heights grow with reach, capped, and scale with k', () => {
    expect(arcHeight(0)).toBeGreaterThan(0)
    expect(arcHeight(-300)).toBe(arcHeight(300))
    expect(arcHeight(1e6)).toBe(ARC_LIFT_MAX)
    expect(arcHeight(200, 0)).toBe(0)
    expect(arcHeight(200, 0.5)).toBeCloseTo(arcHeight(200) / 2, 9)
  })

  it('profiles: ropes arch, branches fall from the stem, sprouts land', () => {
    expect(ropeLift(0)).toBe(0)
    expect(ropeLift(1)).toBe(0)
    expect(ropeLift(0.5)).toBe(1)
    expect(branchLift(0, 50, 30)).toBe(50) // leaves the raised stem…
    expect(branchLift(1, 50, 30)).toBe(0) // …and lands on the child's pin
    expect(branchLift(0.5, 0, 30)).toBe(30)
    expect(sproutLift(0, 40)).toBe(40)
    expect(sproutLift(1, 40)).toBe(0)
  })

  it('liftSamples raises sampled points in place', () => {
    const pts = Array.from({ length: 5 }, (_, k) => ({ x: 400 + k * 50, y: 300 }))
    const before = pts.map((p) => ({ ...p }))
    liftSamples(pts, 4, T, (t) => 60 * ropeLift(t))
    expect(pts[0]).toEqual(before[0])
    expect(pts[4]).toEqual(before[4])
    // the middle one now sits further up the board (smaller flat y)
    expect(pts[2].y).toBeLessThan(before[2].y)
  })
})

describe('timeline tilt: clipping + hit tests', () => {
  it('clips against the near plane', () => {
    const lim = nearLimit(T)
    expect(lim).toBeGreaterThan(0)
    expect(Number.isFinite(lim)).toBe(true)
    // straddling the limit: the far part is kept
    const far = H / 2 - 1000,
      near = H / 2 + lim + 1000
    const c = clipSegmentNear(300, far, 300, near, T)
    expect(c).not.toBeNull()
    expect(c.t0).toBe(0)
    expect(c.t1).toBeLessThan(1)
    expect(boardDepth(c.x1, c.y1, T)).toBeCloseTo(lim, 6)
    // entirely behind: nothing
    expect(clipSegmentNear(0, near, 50, near + 10, T)).toBeNull()
    // flat: untouched
    expect(clipSegmentNear(0, 0, 10, 10, FLAT)).toEqual({
      x0: 0,
      y0: 0,
      x1: 10,
      y1: 10,
      t0: 0,
      t1: 1
    })
    const poly = clipPolygonNear([0, far, 100, far, 100, near, 0, near], T)
    expect(poly.length).toBe(8)
    for (let i = 0; i < poly.length; i += 2)
      expect(boardDepth(poly[i], poly[i + 1], T)).toBeLessThanOrEqual(lim + 1e-6)
  })

  it('distToSegment', () => {
    expect(distToSegment(5, 5, 0, 0, 10, 0)).toBe(5)
    expect(distToSegment(-3, 4, 0, 0, 10, 0)).toBe(5)
    expect(distToSegment(1, 1, 1, 1, 1, 1)).toBe(0)
  })

  it('pins are hit on screen, shrinking with depth', () => {
    const far = projectFlat(600, 100, T),
      near = projectFlat(600, 700, T)
    expect(far.s).toBeLessThan(near.s)
    expect(pinHit(far.x, far.y, 600, 100, 17, T)).toBe(true)
    expect(pinHit(far.x + 17 * far.s + 1, far.y, 600, 100, 17, T)).toBe(false)
    expect(pinHit(near.x + 17 * near.s - 1, near.y, 600, 700, 17, T)).toBe(true)
  })

  it('billboard rects map back to the board under their screen centre', () => {
    const g = billboardFrame(500, 300, 40, TY)
    expect(g).not.toBeNull()
    const r = frameRectToFlat({ x: 480, y: 290, w: 40, h: 20 }, g, TY)
    const c = projectFlat(r.x + r.w / 2, r.y + r.h / 2, TY)
    expect(c.x).toBeCloseTo(g.X + (500 - 500) * g.s, 4)
    expect(c.y).toBeCloseTo(g.Y + (300 - 300) * g.s, 4)
    // flat frames are the identity
    expect(frameRectToFlat({ x: 1, y: 2, w: 3, h: 4 }, null, FLAT)).toEqual({
      x: 1,
      y: 2,
      w: 3,
      h: 4
    })
    // behind the camera: no frame
    expect(billboardFrame(600, H / 2 + nearLimit(T) + 50, 0, T)).toBeNull()
  })
})
