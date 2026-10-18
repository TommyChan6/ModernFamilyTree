import { describe, it, expect } from 'vitest'
import {
  popScale,
  popRing,
  popLabelReveal,
  popDelay,
  POP_MAX_STAGGER
} from '../src/renderer/src/components/graph/webgl/popAnim.js'

describe('appear pop curves', () => {
  it('scales from nothing, overshoots, and settles at full size', () => {
    expect(popScale(0)).toBeCloseTo(0)
    expect(popScale(1)).toBeCloseTo(1)
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => popScale(i / 100)))
    expect(peak).toBeGreaterThan(1.1)
    expect(peak).toBeLessThan(1.25)
    // clamped outside 0..1 (a staggered pop that hasn't started stays invisible)
    expect(popScale(-0.5)).toBeCloseTo(0)
    expect(popScale(3)).toBeCloseTo(1)
  })

  it('the ripple ring grows and fades, then is gone', () => {
    const a = popRing(0.1),
      b = popRing(0.8)
    expect(b.r).toBeGreaterThan(a.r)
    expect(b.alpha).toBeLessThan(a.alpha)
    expect(popRing(1)).toBeNull()
    expect(popRing(-0.1)).toBeNull()
  })

  it('the name fades in as the pop lands', () => {
    expect(popLabelReveal(0)).toBe(0)
    expect(popLabelReveal(0.3)).toBe(0)
    expect(popLabelReveal(1)).toBe(1)
  })

  it('a batch is staggered, but never for long', () => {
    expect(popDelay(0)).toBe(0)
    expect(popDelay(1)).toBeGreaterThan(0)
    expect(popDelay(100)).toBe(POP_MAX_STAGGER)
  })
})
