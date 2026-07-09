import { describe, it, expect } from 'vitest'
import { screenToWorld, worldToScreen, fitExtent, nodesExtent } from '../src/renderer/src/components/graph/webgl/coords.js'
import { linkCurvePoints, linkPath } from '../src/renderer/src/components/graph/linkHelpers.js'

describe('webgl coords', () => {
  it('screenToWorld and worldToScreen round-trip', () => {
    const t = { x: 120, y: -40, k: 1.7 }
    const w = screenToWorld(300, 200, t)
    const s = worldToScreen(w.x, w.y, t)
    expect(s.x).toBeCloseTo(300, 6)
    expect(s.y).toBeCloseTo(200, 6)
  })

  it('worldToScreen applies translate then scale like the old SVG group', () => {
    const t = { x: 10, y: 20, k: 2 }
    expect(worldToScreen(5, 5, t)).toEqual({ x: 20, y: 30 })
  })

  it('fitExtent centres the bounding box within the viewport', () => {
    const { x, y, k } = fitExtent(0, 0, 100, 100, 800, 600)
    // centre of the (padded) box maps to the centre of the viewport
    const cx = 50, cy = 50
    expect(cx * k + x).toBeCloseTo(400, 6)
    expect(cy * k + y).toBeCloseTo(300, 6)
    expect(k).toBeLessThanOrEqual(2)
  })

  it('nodesExtent returns the bounding box, or null when empty', () => {
    expect(nodesExtent([])).toBeNull()
    expect(nodesExtent([{ x: 1, y: 2 }, { x: 5, y: -3 }])).toEqual({ minX: 1, minY: -3, maxX: 5, maxY: 2 })
  })
})

describe('linkCurvePoints', () => {
  const link = { id: 'e1', source: { x: 0, y: 0 }, target: { x: 100, y: 0 } }

  it('starts at the source and ends at the target', () => {
    const { points } = linkCurvePoints(link, 0.04, 14)
    expect(points).toHaveLength(15)
    expect(points[0]).toEqual({ x: 0, y: 0 })
    expect(points[14].x).toBeCloseTo(100, 6)
    expect(points[14].y).toBeCloseTo(0, 6)
  })

  it('bows off the straight line (same deterministic bend as linkPath)', () => {
    const { points, control } = linkCurvePoints(link, 0.2, 14)
    const mid = points[7]
    // With curvature, the midpoint is displaced perpendicular to the chord (non-zero y).
    expect(Math.abs(mid.y)).toBeGreaterThan(0)
    // The control point drives linkPath's quadratic — the SVG path references the same one.
    expect(linkPath(link, 0.2)).toContain(`Q${control.x},${control.y}`)
  })

  it('is deterministic per edge id', () => {
    const a = linkCurvePoints(link, 0.1, 8).points
    const b = linkCurvePoints(link, 0.1, 8).points
    expect(a).toEqual(b)
  })
})
