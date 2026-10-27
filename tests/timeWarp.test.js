import { describe, it, expect } from 'vitest'
import {
  buildTimeWarp,
  warpYear,
  unwarpYear,
  warpSlope,
  warpSlopeRange,
  warpTicks,
  WARP_MIN_STRETCH,
  WARP_MAX_STRETCH
} from '../src/renderer/src/components/timeline/timeWarp'

// A family that clusters: five siblings a year apart around 1900, a lone
// ancestor in 1750 and a couple of births in 1980 — long empty stretches between.
const YEARS = [1750, 1898, 1899, 1900, 1901, 1902, 1903, 1980, 1982]
const LO = 1750
const HI = 2025
const W = buildTimeWarp(YEARS, LO, HI)

describe('time warp', () => {
  it('is the identity at strength 0 (and for no data)', () => {
    for (const y of [1700, 1750, 1801.5, 1900, 2025, 2100]) {
      expect(warpYear(W, y, 0)).toBe(y)
      expect(unwarpYear(W, y, 0)).toBe(y)
    }
    const empty = buildTimeWarp([], LO, HI)
    expect(empty.identity).toBe(true)
    expect(warpYear(empty, 1900, 1)).toBe(1900)
    expect(buildTimeWarp([1900], 1900, 1900).identity).toBe(true)
    expect(warpYear(null, 1900, 1)).toBe(1900)
  })

  it('preserves the total span (and is linear outside it)', () => {
    for (const k of [0.3, 1]) {
      expect(warpYear(W, LO, k)).toBeCloseTo(LO, 9)
      expect(warpYear(W, HI, k)).toBeCloseTo(HI, 9)
      expect(warpYear(W, LO - 40, k)).toBe(LO - 40)
      expect(warpYear(W, HI + 7, k)).toBe(HI + 7)
    }
    expect(W.ys[0]).toBe(LO)
    expect(W.ys[W.ys.length - 1]).toBe(HI)
  })

  it('is strictly monotone at every strength', () => {
    for (const k of [0.1, 0.5, 1]) {
      let prev = -Infinity
      for (let y = LO - 5; y <= HI + 5; y += 0.25) {
        const a = warpYear(W, y, k)
        expect(a).toBeGreaterThan(prev)
        prev = a
      }
    }
  })

  it('round-trips through its inverse', () => {
    for (const k of [0.2, 0.65, 1]) {
      for (let y = LO - 10; y <= HI + 10; y += 3.37) {
        expect(unwarpYear(W, warpYear(W, y, k), k)).toBeCloseTo(y, 7)
      }
    }
  })

  it('spreads clustered births further apart than linear', () => {
    const gap = warpYear(W, 1903) - warpYear(W, 1898)
    expect(gap).toBeGreaterThan(5 * 1.5)
    // siblings a year apart separate
    expect(warpYear(W, 1901) - warpYear(W, 1900)).toBeGreaterThan(1.5)
    // and the stretch grows with the strength
    expect(warpYear(W, 1903, 0.5) - warpYear(W, 1898, 0.5)).toBeLessThan(gap)
    expect(warpYear(W, 1903, 0.5) - warpYear(W, 1898, 0.5)).toBeGreaterThan(5)
  })

  it('compresses empty decades, but never below the minimum stretch', () => {
    const empty = warpYear(W, 1850) - warpYear(W, 1800)
    expect(empty).toBeLessThan(50)
    expect(empty).toBeGreaterThanOrEqual(50 * WARP_MIN_STRETCH - 1e-6)
    for (let y = LO; y < HI; y += 0.5) {
      const s = warpSlope(W, y)
      expect(s).toBeGreaterThanOrEqual(WARP_MIN_STRETCH - 1e-9)
      expect(s).toBeLessThanOrEqual(WARP_MAX_STRETCH + 1e-9)
    }
  })

  it('honours custom stretch limits and weights', () => {
    const tight = buildTimeWarp(YEARS, LO, HI, { minStretch: 0.6, maxStretch: 1.5 })
    const r = warpSlopeRange(tight, LO, HI)
    expect(r.min).toBeGreaterThanOrEqual(0.6 - 1e-9)
    expect(r.max).toBeLessThanOrEqual(1.5 + 1e-9)
    // zero weights are ignored entirely
    const w0 = buildTimeWarp([1900, 1950], LO, HI, { weights: [0, 0] })
    expect(w0.identity).toBe(true)
  })

  it('stays cheap on long spans (bins are capped)', () => {
    const many = Array.from({ length: 5000 }, (_, i) => -3000 + ((i * 7919) % 6000))
    const w = buildTimeWarp(many, -3000, 3000)
    expect(w.ys.length).toBeLessThanOrEqual(2049)
    expect(unwarpYear(w, warpYear(w, 123.4), 1)).toBeCloseTo(123.4, 6)
  })

  it('places ticks on real years, denser where time is stretched', () => {
    const { years, steps } = warpTicks(W, LO, HI, 3, 1, 46)
    expect(years.length).toBeGreaterThan(3)
    for (let i = 0; i < years.length; i++) expect(years[i] % steps[i]).toBe(0)
    const near1900 = years.filter((y) => y >= 1890 && y <= 1910).length
    const near1820 = years.filter((y) => y >= 1810 && y <= 1830).length
    expect(near1900).toBeGreaterThan(near1820)
    // the linear axis (k = 0) gives an even ladder
    const flat = warpTicks(W, 1800, 1900, 3, 0, 46)
    const d = new Set(flat.years.slice(1).map((y, i) => y - flat.years[i]))
    expect(d.size).toBe(1)
  })
})
