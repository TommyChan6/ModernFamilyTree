import { describe, it, expect } from 'vitest'
import {
  inkAvatarBg,
  inkRelGlyph,
  inkRelColor,
  isRomanticType,
  REL_GLYPHS
} from '../src/renderer/src/components/ui/inkChrome'
import { inkSealSize } from '../src/renderer/src/components/export/exportCompose'

describe('ink chrome helpers', () => {
  it('washes avatars in indigo / rouge / ink by gender', () => {
    expect(inkAvatarBg('male')).toContain('#3d5a73')
    expect(inkAvatarBg('female')).toContain('#a2496a')
    expect(inkAvatarBg(null)).toContain('#5d5850')
    expect(inkAvatarBg('other')).toBe(inkAvatarBg(undefined))
    expect(inkAvatarBg('male')).toMatch(/^radial-gradient\(/)
  })

  it('stamps every built-in relationship type with one CJK character', () => {
    for (const [key, ch] of Object.entries(REL_GLYPHS)) {
      expect(inkRelGlyph(key)).toBe(ch)
      expect([...ch]).toHaveLength(1)
    }
    expect(inkRelGlyph('spouse')).toBe('婚')
  })

  it('derives a custom type glyph from the first CJK character of its label', () => {
    expect(inkRelGlyph('custom-1', 'Sworn 结拜 brothers')).toBe('结')
    expect(inkRelGlyph('custom-2', 'Pen pals')).toBe('')
    expect(inkRelGlyph('custom-3', null)).toBe('')
  })

  it('draws spouse, partner and likes as the red thread', () => {
    expect(isRomanticType('spouse')).toBe(true)
    expect(isRomanticType('partner')).toBe(true)
    expect(isRomanticType('likes')).toBe(true)
    expect(isRomanticType('parent_child')).toBe(false)
    expect(isRomanticType('rival')).toBe(false)
  })

  it('only swaps relationship colours for pigments in the ink theme', () => {
    expect(inkRelColor('spouse', '#f5a623', false)).toBe('#f5a623')
    expect(inkRelColor('spouse', '#f5a623', true)).toBe('#b3352a')
    expect(inkRelColor('parent_child', '#9b8cf5', true)).toBe('#2b2722')
    // custom types keep their hue, ground down with ink
    expect(inkRelColor('custom-1', '#00ff00', true)).toBe(
      'color-mix(in srgb, #00ff00 62%, #2b2722)'
    )
  })

  it('sizes the export seal from the stamp text, with a floor', () => {
    expect(inkSealSize(4)).toBe(28)
    expect(inkSealSize(20)).toBe(56)
    expect(inkSealSize(40)).toBeGreaterThan(inkSealSize(20))
  })
})
