import { describe, it, expect } from 'vitest'
import {
  SHAPE_SAMPLES,
  MEMBER_PAD,
  membraneShape,
  shapeRadius,
  pointInShape,
  shapeExtent,
  shapeSlopes,
  vennTargets,
  arrangeVenn
} from '../src/renderer/src/components/factions/vennLayout'

describe('membraneShape', () => {
  it('is the plain disc when every member sits inside', () => {
    const s = membraneShape(0, 0, 120, [
      { x: 10, y: 5 },
      { x: -40, y: 30 }
    ])
    expect(s).toHaveLength(SHAPE_SAMPLES)
    for (const r of s) expect(r).toBe(120)
  })

  it('stretches to wrap an outside member with clearance', () => {
    const m = { x: 260, y: 0 }
    const s = membraneShape(0, 0, 120, [m])
    // the lobe reaches past the member by the pad
    expect(shapeRadius(s, 0)).toBeGreaterThanOrEqual(260 + MEMBER_PAD - 1)
    expect(pointInShape(s, 0, 0, m.x, m.y)).toBe(true)
    // and wraps the member's whole clearance circle
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const x = m.x + Math.cos(a) * (MEMBER_PAD - 2)
      const y = m.y + Math.sin(a) * (MEMBER_PAD - 2)
      expect(pointInShape(s, 0, 0, x, y)).toBe(true)
    }
    // the far side keeps the disc
    expect(shapeRadius(s, Math.PI)).toBeCloseTo(120, 5)
  })

  it('wraps members in any direction, including across the ±π seam', () => {
    for (const ang of [Math.PI, -Math.PI + 0.01, Math.PI / 2, -2.5]) {
      const m = { x: 50 + Math.cos(ang) * 300, y: -20 + Math.sin(ang) * 300 }
      const s = membraneShape(50, -20, 100, [m])
      expect(pointInShape(s, 50, -20, m.x, m.y)).toBe(true)
    }
  })

  it('never shrinks below the base disc and stays finite', () => {
    const s = membraneShape(0, 0, 90, [
      { x: 400, y: 10 },
      { x: 0, y: -0.0001 },
      { x: 95, y: 95 }
    ])
    for (const r of s) {
      expect(Number.isFinite(r)).toBe(true)
      expect(r).toBeGreaterThanOrEqual(90)
    }
  })

  it('a softer membrane pulls a broader lobe', () => {
    const members = [{ x: 280, y: 0 }]
    const taut = membraneShape(0, 0, 120, members, { softness: 0 })
    const soft = membraneShape(0, 0, 120, members, { softness: 1 })
    const area = (s) => s.reduce((a, r) => a + r * r, 0)
    expect(area(soft)).toBeGreaterThan(area(taut))
  })

  it('reuses the out buffer', () => {
    const out = new Float32Array(SHAPE_SAMPLES)
    expect(membraneShape(0, 0, 80, [], { out })).toBe(out)
  })
})

describe('shape helpers', () => {
  it('shapeRadius interpolates and wraps', () => {
    const s = new Float32Array(SHAPE_SAMPLES).fill(10)
    s[0] = 20
    expect(shapeRadius(s, 0)).toBe(20)
    expect(shapeRadius(s, Math.PI * 2)).toBe(20)
    const half = (Math.PI * 2) / SHAPE_SAMPLES / 2
    expect(shapeRadius(s, half)).toBeCloseTo(15, 5)
    expect(shapeRadius(s, -half)).toBeCloseTo(15, 5)
  })

  it('extent and slopes', () => {
    const s = membraneShape(0, 0, 100, [{ x: 0, y: 250 }])
    expect(shapeExtent(s)).toBeGreaterThan(250)
    const sl = shapeSlopes(s)
    // flat on the far side, rising into the lobe
    expect(Math.abs(sl[SHAPE_SAMPLES * 0.75])).toBeLessThan(1e-3)
    expect(sl.some((v) => v > 1)).toBe(true)
  })
})

describe('vennTargets', () => {
  const A = { id: 'A', x: 0, y: 0, r: 120, member_ids: ['a', 'ab'] }
  const B = { id: 'B', x: 180, y: 0, r: 120, member_ids: ['b', 'ab'] }

  it('puts shared people between their groups', () => {
    const t = vennTargets([A, B])
    expect(t.ab.x).toBeCloseTo(90, 5)
    expect(t.ab.factionIds).toEqual(['A', 'B'])
  })

  it('pushes exclusive members out of overlapping foreign discs', () => {
    const big = { id: 'B', x: 60, y: 0, r: 200, member_ids: ['b'] }
    const t = vennTargets([A, big])
    // A's centre lies inside B, so A-only people settle outside B's disc
    expect(Math.hypot(t.a.x - big.x, t.a.y - big.y)).toBeGreaterThanOrEqual(200 + MEMBER_PAD - 1e-6)
  })

  it('ignores hidden groups', () => {
    const t = vennTargets([A, { ...B, visible: false }])
    expect(t.ab.factionIds).toEqual(['A'])
    expect(t.b).toBeUndefined()
  })
})

describe('arrangeVenn', () => {
  const g = (id, x, y, r, member_ids) => ({ id, x, y, r, member_ids })

  it('overlaps groups that share people and separates those that do not', () => {
    const groups = [
      g('A', 0, 0, 120, ['1', '2', 'x']),
      g('B', 600, 0, 120, ['3', '4', 'x']),
      g('C', 0, 600, 110, ['5', '6'])
    ]
    const out = Object.fromEntries(arrangeVenn(groups, 0, 0).map((p) => [p.id, p]))
    const dist = (a, b) => Math.hypot(out[a].x - out[b].x, out[a].y - out[b].y)
    expect(dist('A', 'B')).toBeLessThan(240) // overlapping
    expect(dist('A', 'C')).toBeGreaterThan(230) // clear
    expect(dist('B', 'C')).toBeGreaterThan(230)
  })

  it('nests a subset inside a much larger group', () => {
    const groups = [
      g('Big', 0, 0, 260, ['1', '2', '3', '4', '5', '6']),
      g('Small', 500, 0, 90, ['1', '2'])
    ]
    const [a, b] = arrangeVenn(groups, 0, 0)
    expect(Math.hypot(a.x - b.x, a.y - b.y) + 90).toBeLessThanOrEqual(260 + 1)
  })

  it('is deterministic and handles 0, 1 and coincident groups', () => {
    expect(arrangeVenn([], 0, 0)).toEqual([])
    expect(arrangeVenn([g('A', 9, 9, 100, [])], 5, 6)).toEqual([{ id: 'A', x: 5, y: 6 }])
    const same = [g('A', 0, 0, 100, ['1']), g('B', 0, 0, 100, ['2'])]
    const r1 = arrangeVenn(same, 0, 0)
    const r2 = arrangeVenn(same, 0, 0)
    expect(r1).toEqual(r2)
    expect(Math.hypot(r1[0].x - r1[1].x, r1[0].y - r1[1].y)).toBeGreaterThan(200)
  })
})
