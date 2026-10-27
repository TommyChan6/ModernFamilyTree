import { describe, it, expect } from 'vitest'
import {
  worldToScreen,
  screenToWorld,
  perspectiveScale,
  tiltProjection,
  tiltParams,
  pickNodeOnScreen,
  translateToPin,
  depthOrder,
  clipSegment,
  TILT_MAX
} from '../src/renderer/src/components/graph/webgl/coords.js'
import {
  shapeAnchor,
  shapeLabelDrop,
  shapeLabelAbove,
  shapeLabelRise,
  shapeTopLift,
  NODE_SHAPES
} from '../src/renderer/src/components/graph/webgl/nodeShapes.js'
import { bodyBox, makeOccluder } from '../src/renderer/src/components/graph/webgl/occlusion.js'

const flat = { x: 120, y: -40, k: 1.5, sx: 1.2, sy: 0.9 }
const tilted = { ...flat, tl: (50 * Math.PI) / 180, vw: 1200, vh: 800 }

// Apply a row-major 4×4 to the flat pixel (u, v) and return screen pixels.
function project(m, u, v, W, H) {
  const X = m[0] * u + m[1] * v + m[3]
  const Y = m[4] * u + m[5] * v + m[7]
  const Wc = m[12] * u + m[13] * v + m[15]
  const nx = X / Wc,
    ny = Y / Wc
  return { x: ((nx + 1) / 2) * W, y: ((1 - ny) / 2) * H }
}

describe('perspective tilt mapping', () => {
  it('is the plain flat mapping without tilt (tl 0 or missing viewport)', () => {
    const a = worldToScreen(30, 70, flat)
    expect(a.x).toBeCloseTo(30 * 1.2 * 1.5 + 120)
    expect(a.y).toBeCloseTo(70 * 0.9 * 1.5 - 40)
    expect(a.s).toBe(1)
    expect(tiltParams({ ...flat, tl: 0.5 })).toBeNull() // no viewport → flat
    expect(worldToScreen(30, 70, { ...flat, tl: 0, vw: 10, vh: 10 })).toEqual(a)
  })

  it('round-trips world → screen → world under tilt', () => {
    for (const [wx, wy] of [
      [0, 0],
      [400, -250],
      [-300, 380],
      [123.4, 56.7]
    ]) {
      const s = worldToScreen(wx, wy, tilted)
      const w = screenToWorld(s.x, s.y, tilted)
      expect(w.x).toBeCloseTo(wx, 6)
      expect(w.y).toBeCloseTo(wy, 6)
    }
  })

  it('leaves the horizontal centre line in place and recedes the top', () => {
    const p = tiltParams(tilted)
    // A world point that lands on the centre line maps to itself.
    const wy = (p.cy - tilted.y) / (tilted.k * tilted.sy)
    const wx = (p.cx - tilted.x) / (tilted.k * tilted.sx)
    const s = worldToScreen(wx, wy, tilted)
    expect(s.x).toBeCloseTo(p.cx)
    expect(s.y).toBeCloseTo(p.cy)
    expect(s.s).toBeCloseTo(1)
    // Things nearer the top are farther away → smaller; the bottom is nearer.
    expect(perspectiveScale(wx, wy - 200, tilted)).toBeLessThan(1)
    expect(perspectiveScale(wx, wy + 200, tilted)).toBeGreaterThan(1)
    // …and vertical distances are foreshortened.
    const up = worldToScreen(wx, wy - 200, tilted)
    expect(p.cy - up.y).toBeLessThan(200 * tilted.k * tilted.sy)
  })

  it('clamps picks above the horizon to a finite far point', () => {
    const w = screenToWorld(600, -5000, tilted)
    expect(Number.isFinite(w.x) && Number.isFinite(w.y)).toBe(true)
  })

  it('clamps the tilt angle', () => {
    const p = tiltParams({ ...tilted, tl: 3 })
    expect(p.s).toBeCloseTo(Math.sin(TILT_MAX))
  })

  it('projection matrix agrees with worldToScreen (GPU == CPU)', () => {
    const W = tilted.vw,
      H = tilted.vh
    const m = tiltProjection(tilted, W, H)
    for (const [wx, wy] of [
      [0, 0],
      [250, -120],
      [-180, 300]
    ]) {
      const u = wx * tilted.sx * tilted.k + tilted.x
      const v = wy * tilted.sy * tilted.k + tilted.y
      const g = project(m, u, v, W, H)
      const c = worldToScreen(wx, wy, tilted)
      expect(g.x).toBeCloseTo(c.x, 4)
      expect(g.y).toBeCloseTo(c.y, 4)
    }
  })

  it('projection matrix is the pixel ortho when flat', () => {
    const m = tiltProjection(flat, 800, 600)
    const g = project(m, 200, 450, 800, 600)
    expect(g.x).toBeCloseTo(200)
    expect(g.y).toBeCloseTo(450)
  })
})

describe('turning the tilted board (yaw)', () => {
  const turned = { ...tilted, yw: (35 * Math.PI) / 180 }

  it('round-trips world → screen → world when turned', () => {
    for (const [wx, wy] of [
      [0, 0],
      [400, -250],
      [-300, 380]
    ]) {
      const s = worldToScreen(wx, wy, turned)
      const w = screenToWorld(s.x, s.y, turned)
      expect(w.x).toBeCloseTo(wx, 6)
      expect(w.y).toBeCloseTo(wy, 6)
    }
  })

  it('turns about the viewport centre (the centre point stays put)', () => {
    const p = tiltParams(turned)
    const c = screenToWorld(p.cx, p.cy, turned)
    const s = worldToScreen(c.x, c.y, turned)
    expect(s.x).toBeCloseTo(p.cx)
    expect(s.y).toBeCloseTo(p.cy)
  })

  it('a yaw alone (no tilt) is a pure rotation about the centre', () => {
    const t = { x: 0, y: 0, k: 1, yw: Math.PI / 2, vw: 200, vh: 200 }
    const s = worldToScreen(150, 100, t) // 50 right of centre
    expect(s.x).toBeCloseTo(100)
    expect(s.y).toBeCloseTo(150) // → 50 below centre (y down)
    expect(s.s).toBeCloseTo(1)
  })

  it('projection matrix agrees with worldToScreen when turned', () => {
    const W = turned.vw,
      H = turned.vh
    const m = tiltProjection(turned, W, H)
    for (const [wx, wy] of [
      [0, 0],
      [250, -120],
      [-180, 300]
    ]) {
      const u = wx * turned.sx * turned.k + turned.x
      const v = wy * turned.sy * turned.k + turned.y
      const g = project(m, u, v, W, H)
      const c = worldToScreen(wx, wy, turned)
      expect(g.x).toBeCloseTo(c.x, 4)
      expect(g.y).toBeCloseTo(c.y, 4)
    }
  })

  it('translateToPin keeps a grabbed ground point exactly under the cursor', () => {
    const w = { x: 120, y: -60 }
    for (const k of [turned.k, 0.4, 3]) {
      const pin = translateToPin(w.x, w.y, 700, 520, turned, k)
      const s = worldToScreen(w.x, w.y, { ...turned, x: pin.x, y: pin.y, k })
      expect(s.x).toBeCloseTo(700, 5)
      expect(s.y).toBeCloseTo(520, 5)
    }
  })
})

describe('depth order (back to front)', () => {
  const t = { x: 0, y: 0, k: 1 }
  const nodes = [
    { x: 0, y: 300 },
    { x: 0, y: 100 },
    { x: 0, y: 200 }
  ]
  it('sorts by the foot’s screen y — lower (nearer) draws later', () => {
    expect(depthOrder(nodes, t, null)).toEqual([1, 2, 0])
  })
  it('returns null while the previous order still holds', () => {
    expect(depthOrder(nodes, t, [1, 2, 0])).toBeNull()
    expect(depthOrder(nodes, t, [0, 1, 2])).toEqual([1, 2, 0])
  })
  it('follows the turn: a half-turn reverses front and back', () => {
    const tt = { x: 0, y: 0, k: 1, tl: 0.6, yw: Math.PI, vw: 400, vh: 400 }
    expect(depthOrder(nodes, tt, null)).toEqual([0, 2, 1])
  })
})

describe('screen-space node picking', () => {
  const nodes = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 200, y: 0 }
  ]
  const t = { x: 300, y: 300, k: 1 }
  const r = () => 20

  it('hits within the drawn radius and misses outside', () => {
    expect(pickNodeOnScreen(305, 300, nodes, t, r)?.id).toBe('a')
    expect(pickNodeOnScreen(500, 312, nodes, t, r)?.id).toBe('b')
    expect(pickNodeOnScreen(400, 300, nodes, t, r)).toBeNull()
  })

  it('lifted shapes are hit above their anchor, not below it', () => {
    const lift = shapeAnchor('gravestone').hitLift
    expect(pickNodeOnScreen(300, 300 - lift * 20, nodes, t, r, lift)?.id).toBe('a')
    expect(pickNodeOnScreen(300, 300 + 18, nodes, t, r, lift)).toBeNull()
  })

  it('follows the perspective shrink under tilt', () => {
    const tt = { ...t, tl: 0.9, vw: 600, vh: 600 }
    const s = worldToScreen(0, 0, tt)
    expect(pickNodeOnScreen(s.x, s.y, nodes, tt, r)?.id).toBe('a')
  })
})

describe('node shape anchors', () => {
  const STANDING = ['gravestone', 'plate', 'flatplate']
  it('only the standing shapes (gravestone, plate) stand on their point', () => {
    for (const s of STANDING) expect(NODE_SHAPES).toContain(s)
    for (const s of NODE_SHAPES) {
      const a = shapeAnchor(s)
      if (STANDING.includes(s)) expect(a.lift).toBeGreaterThan(0)
      else expect(a.lift).toBe(0)
    }
  })
  it('standing shapes share one base line (the shader bakes a single lift)', () => {
    for (const s of STANDING) expect(shapeAnchor(s).lift).toBe(shapeAnchor('gravestone').lift)
  })
  it('labels sit just under a standing base, pills above its crown', () => {
    for (const s of STANDING) {
      expect(shapeLabelDrop(s, 20)).toBeLessThan(shapeLabelDrop('circle', 20))
      expect(shapeTopLift(s, 20)).toBeGreaterThan(shapeTopLift('circle', 20))
    }
  })
  it('plates carry their name above the crown; everything else below', () => {
    for (const s of NODE_SHAPES) expect(shapeLabelAbove(s)).toBe(s === 'plate' || s === 'flatplate')
    for (const s of ['plate', 'flatplate']) {
      // the baseline clears the crown…
      expect(shapeLabelRise(s, 20)).toBeGreaterThan(shapeAnchor(s).top * 20)
      // …and pills / badges make room for the name sitting on top
      expect(shapeTopLift(s, 20, 10)).toBeGreaterThanOrEqual(shapeTopLift(s, 20, 0) + 10)
    }
    // names below: nothing extra to clear above the crown
    expect(shapeTopLift('gravestone', 20, 10)).toBe(shapeTopLift('gravestone', 20, 0))
  })
  it('shape ids are append-only (saved settings keep their shape)', () => {
    expect(NODE_SHAPES.indexOf('gravestone')).toBe(8)
    expect(NODE_SHAPES.indexOf('plate')).toBe(9)
    expect(NODE_SHAPES.indexOf('flatplate')).toBe(10)
  })
})

describe('label occlusion (standing nodes)', () => {
  it('a plate body rises above its foot too', () => {
    const b = bodyBox('plate', 100, 200, 10)
    expect(b.y1).toBe(200)
    expect(b.y0).toBeLessThan(200 - 18)
  })
  it('a gravestone body rises above its foot; discs centre on it', () => {
    const g = bodyBox('gravestone', 100, 200, 10)
    expect(g.y1).toBe(200)
    expect(g.y0).toBeCloseTo(200 - 18.5)
    const c = bodyBox('circle', 100, 200, 10)
    expect([c.y0, c.y1]).toEqual([190, 210])
  })
  it('only NEARER bodies cover a label', () => {
    const near = { ...bodyBox('gravestone', 100, 300, 20), depth: 300 }
    const occ = makeOccluder([near])
    const label = { x0: 80, y0: 270, x1: 120, y1: 280 } // inside the stone's box
    expect(occ.covered(label, 250)).toBe(true) // label of someone farther back
    expect(occ.covered(label, 300)).toBe(false) // its own stone
    expect(occ.covered(label, 400)).toBe(false) // someone nearer still
    expect(occ.covered({ x0: 300, y0: 270, x1: 340, y1: 280 }, 250)).toBe(false)
  })
})

describe('clipSegment (guides under the tilt)', () => {
  it('keeps a segment that is fully inside', () => {
    expect(clipSegment(10, 10, 90, 50, 0, 0, 100, 100)).toEqual({
      x0: 10,
      y0: 10,
      x1: 90,
      y1: 50,
      t0: 0
    })
  })
  it('trims a huge projected line to the viewport and reports where it starts', () => {
    const c = clipSegment(-1000, 50, 100000, 50, 0, 0, 800, 600)
    expect(c.x0).toBeCloseTo(0)
    expect(c.x1).toBeCloseTo(800)
    expect(c.y0).toBe(50)
    // the visible part starts 1000px along the original line
    expect(c.t0 * 101000).toBeCloseTo(1000)
  })
  it('returns null when nothing is visible or the input is not finite', () => {
    expect(clipSegment(-50, -10, 900, -5, 0, 0, 800, 600)).toBeNull()
    expect(clipSegment(0, 0, Infinity, 10, 0, 0, 800, 600)).toBeNull()
    expect(clipSegment(0, NaN, 10, 10, 0, 0, 800, 600)).toBeNull()
  })
  it('clips diagonals on both ends', () => {
    const c = clipSegment(-100, -100, 200, 200, 0, 0, 100, 100)
    expect(c).toMatchObject({ x0: 0, y0: 0, x1: 100, y1: 100 })
    expect(c.t0).toBeCloseTo(1 / 3)
  })
})
