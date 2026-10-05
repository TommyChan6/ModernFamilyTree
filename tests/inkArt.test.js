import { describe, it, expect } from 'vitest'
import {
  rng,
  hashStr,
  noise1,
  rgba,
  smoothPath,
  ridgeLine,
  sealChars
} from '../src/renderer/src/lib/inkArt'

// The canvas painters need a DOM; these cover the pure math they're built on —
// determinism matters because every stroke is redrawn from its seed.

describe('inkArt determinism', () => {
  it('rng is seeded, repeatable and in [0,1)', () => {
    const a = rng(42)
    const b = rng(42)
    const xs = Array.from({ length: 200 }, () => a())
    expect(xs).toEqual(Array.from({ length: 200 }, () => b()))
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true)
    expect(rng(43)()).not.toBe(rng(42)())
  })

  it('hashStr is stable and spreads nearby strings', () => {
    expect(hashStr('person-1')).toBe(hashStr('person-1'))
    expect(hashStr('person-1')).not.toBe(hashStr('person-2'))
    expect(hashStr('')).toBeGreaterThanOrEqual(0)
  })

  it('noise1 is smooth and bounded', () => {
    const n = noise1(7)
    for (let x = 0; x < 50; x += 0.37) {
      const v = n(x)
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
      expect(Math.abs(n(x + 0.01) - v)).toBeLessThan(0.1)
    }
    expect(n(-3.5)).toBeGreaterThanOrEqual(-1) // negative inputs wrap safely
  })
})

describe('inkArt geometry', () => {
  it('smoothPath passes through its control points', () => {
    const ctrl = [
      { x: 0, y: 0 },
      { x: 10, y: 5 },
      { x: 20, y: 0 }
    ]
    const pts = smoothPath(ctrl, 8)
    expect(pts[0]).toEqual(ctrl[0])
    expect(pts[8].x).toBeCloseTo(10)
    expect(pts[8].y).toBeCloseTo(5)
    expect(pts[pts.length - 1]).toEqual(ctrl[2])
    expect(smoothPath(ctrl.slice(0, 2))).toHaveLength(2)
  })

  it('ridgeLine stays within its box and peaks near the requested height', () => {
    const pts = ridgeLine(100, 400, 300, 120, 5, 3)
    expect(pts[0].x).toBeCloseTo(100)
    expect(pts[pts.length - 1].x).toBeCloseTo(500)
    const top = Math.min(...pts.map((p) => p.y))
    expect(top).toBeGreaterThan(300 - 120 * 1.1)
    expect(top).toBeLessThan(300 - 120 * 0.7)
    expect(pts.every((p) => p.y <= 300 + 1e-9)).toBe(true)
    // the range falls away to the base at both ends
    expect(pts[0].y).toBeCloseTo(300)
    expect(pts[pts.length - 1].y).toBeCloseTo(300)
  })
})

describe('inkArt seals and colour', () => {
  it('sealChars prefers CJK characters, else initials', () => {
    expect(sealChars('王小明')).toBe('王小明')
    expect(sealChars('Li 李白 Bai')).toBe('李白')
    expect(sealChars('诸葛孔明亮')).toBe('诸葛孔明')
    expect(sealChars('Eleanor Whitmore')).toBe('EW')
    expect(sealChars('cher')).toBe('C')
    expect(sealChars('')).toBe('印')
  })

  it('rgba expands hex', () => {
    expect(rgba('#b3352a', 0.5)).toBe('rgba(179,53,42,0.5)')
    expect(rgba('#fff', 1)).toBe('rgba(255,255,255,1)')
  })
})
