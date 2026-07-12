import { describe, it, expect } from 'vitest'
import {
  rectToBounds,
  unionBounds,
  padBounds,
  fitProjection,
  worldToMap,
  mapToWorld,
  lerpProjection,
  projectionsClose,
  viewRectXYK
} from '../src/renderer/src/components/webgl/minimapMath'

describe('bounds helpers', () => {
  it('rectToBounds converts x/y/w/h', () => {
    expect(rectToBounds({ x: 10, y: -5, w: 30, h: 20 })).toEqual({
      minX: 10,
      minY: -5,
      maxX: 40,
      maxY: 15
    })
  })

  it('unionBounds tolerates nulls and merges extents', () => {
    const a = { minX: 0, minY: 0, maxX: 10, maxY: 10 }
    const b = { minX: -5, minY: 2, maxX: 8, maxY: 20 }
    expect(unionBounds(a, null)).toBe(a)
    expect(unionBounds(null, b)).toBe(b)
    expect(unionBounds(null, null)).toBeNull()
    expect(unionBounds(a, b)).toEqual({ minX: -5, minY: 0, maxX: 10, maxY: 20 })
  })

  it('padBounds pads by a fraction of the larger side', () => {
    const b = padBounds({ minX: 0, minY: 0, maxX: 100, maxY: 50 }, 0.1)
    expect(b).toEqual({ minX: -10, minY: -10, maxX: 110, maxY: 60 })
  })

  it('padBounds never collapses a degenerate box', () => {
    const b = padBounds({ minX: 5, minY: 5, maxX: 5, maxY: 5 }, 0.1)
    expect(b.maxX - b.minX).toBeGreaterThan(0)
  })
})

describe('fitProjection', () => {
  const bounds = { minX: 0, minY: 0, maxX: 200, maxY: 100 }

  it('centres the bounds and preserves aspect by default', () => {
    const p = fitProjection(bounds, 100, 100, 10)
    expect(p.sx).toBe(p.sy)
    // the wide box limits the scale: 80 usable px / 200 world = 0.4
    expect(p.sx).toBeCloseTo(0.4)
    const c = worldToMap(100, 50, p) // world centre → map centre
    expect(c.x).toBeCloseTo(50)
    expect(c.y).toBeCloseTo(50)
    // corners stay inside the margin on the limiting axis
    expect(worldToMap(0, 0, p).x).toBeCloseTo(10)
    expect(worldToMap(200, 100, p).x).toBeCloseTo(90)
  })

  it('stretches each axis independently when preserveAspect is off', () => {
    const p = fitProjection(bounds, 100, 100, 10, false)
    expect(p.sx).toBeCloseTo(0.4)
    expect(p.sy).toBeCloseTo(0.8)
    expect(worldToMap(0, 0, p)).toEqual({ x: 10, y: 10 })
    expect(worldToMap(200, 100, p)).toEqual({ x: 90, y: 90 })
  })

  it('mapToWorld inverts worldToMap', () => {
    const p = fitProjection(bounds, 172, 118, 8)
    const m = worldToMap(37, 81, p)
    const w = mapToWorld(m.x, m.y, p)
    expect(w.x).toBeCloseTo(37)
    expect(w.y).toBeCloseTo(81)
  })

  it('survives zero-size bounds', () => {
    const p = fitProjection({ minX: 5, minY: 5, maxX: 5, maxY: 5 }, 100, 100, 10)
    expect(Number.isFinite(p.sx)).toBe(true)
    expect(Number.isFinite(p.ox)).toBe(true)
  })
})

describe('projection smoothing', () => {
  const a = { sx: 1, sy: 1, ox: 0, oy: 0 }
  const b = { sx: 2, sy: 2, ox: 100, oy: 50 }

  it('lerpProjection interpolates all four fields', () => {
    expect(lerpProjection(a, b, 0.5)).toEqual({ sx: 1.5, sy: 1.5, ox: 50, oy: 25 })
    expect(lerpProjection(a, b, 1)).toEqual(b)
  })

  it('projectionsClose detects convergence', () => {
    expect(projectionsClose(a, b)).toBe(false)
    expect(projectionsClose(b, b)).toBe(true)
    expect(projectionsClose({ sx: 2.0001, sy: 2, ox: 100.1, oy: 50 }, b)).toBe(true)
  })
})

describe('viewRectXYK', () => {
  it('is the identity view at k=1, no translation', () => {
    const r = viewRectXYK({ x: 0, y: 0, k: 1 }, 800, 600)
    expect(r.x).toBeCloseTo(0)
    expect(r.y).toBeCloseTo(0)
    expect(r.w).toBe(800)
    expect(r.h).toBe(600)
  })

  it('inverts the screen = world*k + t transform', () => {
    // camera centred on world (100, 200) at 2× in an 800×600 viewport
    const t = { x: 800 / 2 - 100 * 2, y: 600 / 2 - 200 * 2, k: 2 }
    const r = viewRectXYK(t, 800, 600)
    expect(r.x + r.w / 2).toBeCloseTo(100)
    expect(r.y + r.h / 2).toBeCloseTo(200)
    expect(r.w).toBeCloseTo(400)
    expect(r.h).toBeCloseTo(300)
  })
})
