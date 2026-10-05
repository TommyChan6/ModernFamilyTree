import { describe, it, expect } from 'vitest'
import {
  parseHex,
  normalizeHex,
  accentVars,
  luminance,
  ACCENT_PRESETS,
  DEFAULT_ACCENT
} from '../src/renderer/src/lib/accent.js'

describe('accent color math', () => {
  it('parses 3- and 6-digit hex with or without #', () => {
    expect(parseHex('#6c8ef5')).toEqual([108, 142, 245])
    expect(parseHex('FFF')).toEqual([255, 255, 255])
    expect(parseHex(' #000 ')).toEqual([0, 0, 0])
  })

  it('rejects junk', () => {
    expect(parseHex('')).toBeNull()
    expect(parseHex('#12345')).toBeNull()
    expect(parseHex('rgb(1,2,3)')).toBeNull()
    expect(parseHex(null)).toBeNull()
    expect(normalizeHex('nope')).toBeNull()
    expect(normalizeHex('#ABC')).toBe('#aabbcc')
  })

  it('derives the default token family exactly as global.css declares it', () => {
    const v = accentVars(DEFAULT_ACCENT)
    expect(v['--accent']).toBe('#6c8ef5')
    expect(v['--accent-rgb']).toBe('108, 142, 245')
    expect(v['--adim']).toBe('rgba(108, 142, 245, 0.14)')
    expect(v['--on-accent']).toBe('#ffffff')
  })

  it('hover is darker than the accent; partner is a different hue', () => {
    for (const { hex } of ACCENT_PRESETS) {
      const v = accentVars(hex)
      expect(luminance(parseHex(v['--accent-hover']))).toBeLessThan(luminance(parseHex(hex)))
      expect(v['--accent-2']).not.toBe(v['--accent'])
      expect(v['--accent-2']).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('flips the on-accent label color for very light accents', () => {
    expect(accentVars('#fff7a0')['--on-accent']).toBe('#11131c')
  })

  it('falls back to the default accent for invalid input', () => {
    expect(accentVars('garbage')['--accent']).toBe(DEFAULT_ACCENT)
  })

  it('handles greys (zero saturation) without NaN', () => {
    const v = accentVars('#808080')
    expect(Object.values(v).join(' ')).not.toMatch(/NaN/)
  })
})
