import { describe, it, expect } from 'vitest'
import {
  screenToWorld,
  worldToScreen,
  fitExtent,
  nodesExtent
} from '../src/renderer/src/components/graph/webgl/coords.js'
import { linkCurvePoints, linkPath } from '../src/renderer/src/components/graph/linkHelpers.js'
import {
  inkLook,
  inkLinkColor,
  inkNodeFill,
  hexToRgb,
  rgbToHex,
  luminance,
  staggerBirth,
  backdropOffset,
  GRAPH_INK
} from '../src/renderer/src/components/graph/inkStyle.js'
import { routePoints, brushRoute } from '../src/renderer/src/components/graph/linkRouting.js'

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
    const cx = 50,
      cy = 50
    expect(cx * k + x).toBeCloseTo(400, 6)
    expect(cy * k + y).toBeCloseTo(300, 6)
    expect(k).toBeLessThanOrEqual(2)
  })

  it('nodesExtent returns the bounding box, or null when empty', () => {
    expect(nodesExtent([])).toBeNull()
    expect(
      nodesExtent([
        { x: 1, y: 2 },
        { x: 5, y: -3 }
      ])
    ).toEqual({ minX: 1, minY: -3, maxX: 5, maxY: 2 })
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

// ── 水墨 ink look (graph/inkStyle.js) + the brush route ──────────────────────

describe('inkLook', () => {
  it('the Ink theme turns every part on, painted on paper', () => {
    expect(inkLook({ linkRoute: 'organic', nodeDecor: 'none', ambientFx: 'none' }, 'ink')).toEqual({
      links: true,
      nodes: true,
      backdrop: true,
      mode: 'paper'
    })
  })
  it('presets reach the look from any theme; dark becomes moonlit ink', () => {
    const gs = { linkRoute: 'brush', nodeDecor: 'enso', ambientFx: 'mist' }
    expect(inkLook(gs, 'dark')).toEqual({ links: true, nodes: true, backdrop: true, mode: 'moon' })
    expect(inkLook(gs, 'light').mode).toBe('light')
    expect(inkLook({ linkRoute: 'brush' }, 'dark')).toMatchObject({ links: true, nodes: false })
  })
  it('the classic look stays off', () => {
    expect(
      inkLook({ linkRoute: 'organic', nodeDecor: 'aura', ambientFx: 'stars' }, 'dark')
    ).toEqual({
      links: false,
      nodes: false,
      backdrop: false,
      mode: 'off'
    })
    expect(inkLook(null, 'light').mode).toBe('off')
  })
})

describe('ink colours', () => {
  it('hex round-trips', () => {
    expect(rgbToHex(hexToRgb('#3a7bd5'))).toBe('#3a7bd5')
    expect(rgbToHex(hexToRgb('#abc'))).toBe('#aabbcc')
  })
  it('on paper: couples are the cinnabar red thread, lineage is near-black ink', () => {
    expect(inkLinkColor('#d4af37', 'horizontal', 'paper')).toBe(GRAPH_INK.cinnabar)
    expect(luminance(hexToRgb(inkLinkColor('#8b6cc5', 'vertical', 'paper')))).toBeLessThan(0.2)
    // lineage-focus emphasis maps to mineral pigments instead of washing out
    expect(inkLinkColor('#4a90d9', 'vertical', 'paper')).toBe(GRAPH_INK.azurite)
  })
  it('moonlit: dark inks lift to pale ink on a dark ground; light/off untouched', () => {
    expect(luminance(hexToRgb(inkLinkColor('#1f1b16', 'vertical', 'moon')))).toBeGreaterThan(0.6)
    expect(inkLinkColor('#8b6cc5', 'vertical', 'light')).toBe('#8b6cc5')
    expect(inkLinkColor('#8b6cc5', 'vertical', 'off')).toBe('#8b6cc5')
  })
  it('wash fills land in a pale-to-mid band so the reserved figure reads', () => {
    for (const hex of ['#3a7bd5', '#c95fa0', '#1f1b16', '#5d6f80']) {
      const L = luminance(hexToRgb(inkNodeFill(hex, 'paper')))
      expect(L).toBeGreaterThan(0.5)
      expect(L).toBeLessThan(0.85)
    }
    expect(inkNodeFill('#3a7bd5', 'moon')).toBe('#3a7bd5')
  })
})

describe('ink timing + parallax', () => {
  it('staggers births as a capped wave', () => {
    expect(staggerBirth(10, 0, 5)).toBe(10)
    expect(staggerBirth(10, 2, 5, { delay: 0.3, step: 0.1 })).toBeCloseTo(10.5)
    // 1000 strokes never take longer than maxSpread to start
    expect(staggerBirth(0, 999, 1000, { maxSpread: 1.2 })).toBeCloseTo(1.2)
  })
  it('backdrop layers move by depth', () => {
    expect(backdropOffset({ x: 100, y: -50, k: 2 }, 0.5)).toEqual({ x: 50, y: -25 })
    expect(backdropOffset(null, 0.5)).toEqual({ x: 0, y: 0 })
  })
})

describe('brush route', () => {
  const S = { id: 'a', x: 0, y: 0 },
    T = { id: 'b', x: 200, y: 0 }
  const link = { id: 'rel-1', source: S, target: T }
  it('runs endpoint to endpoint and is deterministic', () => {
    const { points } = brushRoute(link, 12, 0.06)
    expect(points).toHaveLength(13)
    expect(points[0]).toEqual({ x: 0, y: 0 })
    expect(points[12].x).toBeCloseTo(200)
    expect(points[12].y).toBeCloseTo(0)
    expect(brushRoute(link, 12, 0.06)).toEqual(brushRoute(link, 12, 0.06))
  })
  it('sweeps out to one side then flicks back (an S, not an arc)', () => {
    const { points } = brushRoute(link, 20, 0.08)
    const early = points[5].y,
      late = points[17].y
    expect(Math.abs(early)).toBeGreaterThan(1)
    expect(Math.sign(early)).not.toBe(Math.sign(late))
  })
  it('is reachable through routePoints', () => {
    expect(routePoints(link, { linkRoute: 'brush', lineCurvature: 0.06 }, 12)).toEqual(
      brushRoute(link, 12, 0.06)
    )
  })
})
