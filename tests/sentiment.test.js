import { describe, it, expect } from 'vitest'
import {
  BUILTIN_SENTIMENT,
  DEFAULT_INTENSITY,
  DYNAMICS_PALETTES,
  clampSentiment,
  coerceEdgeSentiment,
  coerceEdgeIntensity,
  typeSentiment,
  effectiveSentiment,
  effectiveIntensity,
  nodeTemperatures,
  personTemperature,
  dynamicsPalette,
  sentimentColor,
  sentimentGradient,
  mixOklab,
  dynamicsWidth,
  sentimentLevel
} from '../src/shared/sentiment'
import { BUILTIN_REL_TYPES } from '../src/shared/relTypes'

describe('sentiment — clamping & coercion', () => {
  it('clamps type sentiment to −1..1, garbage → 0', () => {
    expect(clampSentiment(2)).toBe(1)
    expect(clampSentiment(-5)).toBe(-1)
    expect(clampSentiment('0.25')).toBe(0.25)
    expect(clampSentiment('nope')).toBe(0)
    expect(clampSentiment(NaN)).toBe(0)
    expect(clampSentiment(undefined)).toBe(0)
  })

  it('edge overrides: null/empty/garbage inherit (null), numbers clamp', () => {
    expect(coerceEdgeSentiment(null)).toBe(null)
    expect(coerceEdgeSentiment(undefined)).toBe(null)
    expect(coerceEdgeSentiment('')).toBe(null)
    expect(coerceEdgeSentiment('x')).toBe(null)
    expect(coerceEdgeSentiment(-3)).toBe(-1)
    expect(coerceEdgeSentiment(0)).toBe(0)
    expect(coerceEdgeIntensity(null)).toBe(null)
    expect(coerceEdgeIntensity(1.7)).toBe(1)
    expect(coerceEdgeIntensity(-0.2)).toBe(0)
    expect(coerceEdgeIntensity('0.3')).toBe(0.3)
  })
})

describe('sentiment — effective values', () => {
  it('every built-in type has a default sentiment in range', () => {
    for (const spec of BUILTIN_REL_TYPES) {
      expect(spec.sentiment).toBe(BUILTIN_SENTIMENT[spec.key])
      expect(Math.abs(spec.sentiment)).toBeLessThanOrEqual(1)
    }
    expect(BUILTIN_SENTIMENT.spouse).toBeGreaterThan(0)
    expect(BUILTIN_SENTIMENT.rival).toBeLessThan(0)
  })

  it('a type without sentiment falls back to its builtin default (0 for custom)', () => {
    expect(typeSentiment({ key: 'rival' })).toBe(BUILTIN_SENTIMENT.rival)
    expect(typeSentiment({ key: 'abc-123' })).toBe(0)
    expect(typeSentiment({ key: 'rival', sentiment: 0.3 })).toBe(0.3)
    expect(typeSentiment(null)).toBe(0)
  })

  it('the edge override wins over the type; intensity defaults', () => {
    const def = { key: 'spouse', sentiment: 0.9 }
    expect(effectiveSentiment({}, def)).toBe(0.9)
    expect(effectiveSentiment({ sentiment: null }, def)).toBe(0.9)
    expect(effectiveSentiment({ sentiment: -0.6 }, def)).toBe(-0.6)
    expect(effectiveSentiment({ sentiment: 0 }, def)).toBe(0) // 0 is a value, not "inherit"
    expect(effectiveIntensity({})).toBe(DEFAULT_INTENSITY)
    expect(effectiveIntensity({ intensity: 0 })).toBe(0)
    expect(effectiveIntensity({ intensity: 4 })).toBe(1)
  })
})

describe('sentiment — temperature', () => {
  const defs = new Map([
    ['spouse', { key: 'spouse', sentiment: 0.8 }],
    ['rival', { key: 'rival', sentiment: -0.8 }]
  ])
  const defOf = (k) => defs.get(k)
  const rels = [
    { person_a_id: 'a', person_b_id: 'b', type: 'spouse', intensity: 1 },
    { person_a_id: 'a', person_b_id: 'c', type: 'rival', intensity: 0.25 },
    { person_a_id: 'c', person_b_id: 'd', type: 'rival', intensity: 0 }
  ]

  it('is the intensity-weighted mean sentiment of a person’s bonds', () => {
    const T = nodeTemperatures(rels, defOf)
    // a: (0.8·1 + −0.8·0.25) / 1.25 = 0.48
    expect(T.get('a').t).toBeCloseTo(0.48, 6)
    expect(T.get('a').n).toBe(2)
    expect(T.get('a').heat).toBeCloseTo(0.625, 6)
    expect(T.get('b').t).toBeCloseTo(0.8, 6)
    // d: only a zero-intensity bond → neutral
    expect(T.get('d').t).toBe(0)
    expect(T.has('e')).toBe(false)
  })

  it('personTemperature matches the map and is null without bonds', () => {
    expect(personTemperature('a', rels, defOf).t).toBeCloseTo(0.48, 6)
    expect(personTemperature('zz', rels, defOf)).toBe(null)
  })
})

describe('sentiment — colour ramp', () => {
  const pal = { cold: '#0000ff', neutral: '#808080', warm: '#ff0000' }

  it('hits the endpoints and the neutral midpoint exactly', () => {
    expect(sentimentColor(-1, pal)).toBe('#0000ff')
    expect(sentimentColor(0, pal)).toBe('#808080')
    expect(sentimentColor(1, pal)).toBe('#ff0000')
    expect(sentimentColor(9, pal)).toBe('#ff0000') // clamped
  })

  it('mixes in OKLab (round-trips, midpoint differs from sRGB average)', () => {
    expect(mixOklab('#3a7bd5', '#3a7bd5', 0.5)).toBe('#3a7bd5')
    const mid = mixOklab('#ff0000', '#0000ff', 0.5)
    expect(mid).toMatch(/^#[0-9a-f]{6}$/)
    expect(mid).not.toBe('#800080')
  })

  it('warm half warms, cold half cools', () => {
    const warmish = sentimentColor(0.5, pal)
    const coldish = sentimentColor(-0.5, pal)
    const r = (h) => parseInt(h.slice(1, 3), 16)
    const b = (h) => parseInt(h.slice(5, 7), 16)
    expect(r(warmish)).toBeGreaterThan(b(warmish))
    expect(b(coldish)).toBeGreaterThan(r(coldish))
  })

  it('palettes: theme defaults, user overrides, garbage ignored', () => {
    for (const th of ['dark', 'light', 'ink', 'medieval'])
      expect(dynamicsPalette(th)).toEqual(DYNAMICS_PALETTES[th])
    expect(dynamicsPalette('nope')).toEqual(DYNAMICS_PALETTES.dark)
    const p = dynamicsPalette('light', { warm: '#ABC', cold: 'blue' })
    expect(p.warm).toBe('#aabbcc')
    expect(p.cold).toBe(DYNAMICS_PALETTES.light.cold)
  })

  it('gradient stops run cold → warm', () => {
    const g = sentimentGradient(pal, 3)
    expect(g).toBe('#0000ff 0%, #808080 50%, #ff0000 100%')
  })

  it('buckets sentiment into words', () => {
    expect(sentimentLevel(-1)).toBe('hostile')
    expect(sentimentLevel(-0.3)).toBe('cool')
    expect(sentimentLevel(0)).toBe('neutral')
    expect(sentimentLevel(0.4)).toBe('warm')
    expect(sentimentLevel(0.9)).toBe('loving')
  })

  it('width grows with intensity', () => {
    expect(dynamicsWidth(0)).toBeLessThan(dynamicsWidth(0.5))
    expect(dynamicsWidth(0.5)).toBeLessThan(dynamicsWidth(1))
    expect(dynamicsWidth(NaN)).toBe(dynamicsWidth(DEFAULT_INTENSITY))
  })
})
