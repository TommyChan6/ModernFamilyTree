import { describe, it, expect } from 'vitest'
import {
  GENE_SLOTS,
  decodeDNA,
  encodeDNA,
  inheritDoc
} from '../src/renderer/src/components/character/characterGenes'
import {
  defaultParts,
  defaultPalette,
  partsFor
} from '../src/renderer/src/components/character/characterModel'
import { cartoonPack } from '../src/renderer/src/components/character/styles/cartoon'

// Character genetics (a child's face from its parents' looks) and the DNA
// share codes that move a look between projects without a server.

const pack = cartoonPack

function look(overrides = {}) {
  return {
    style_id: pack.id,
    parts: defaultParts(pack),
    palette: defaultPalette(pack),
    morph: { height: 0, build: 0, headSize: 0, age: 0 },
    ...overrides
  }
}

const seqRng =
  (seed = 11) =>
  () =>
    (seed = (seed * 16807) % 2147483647) / 2147483647

describe('inheritDoc', () => {
  const mom = look({
    parts: {
      ...defaultParts(pack),
      hair: { partId: 'hair-long', scale: 1 },
      eyes: { partId: 'eyes-spark', scale: 1 }
    },
    palette: { ...defaultPalette(pack), skin: '#f6d7b8', hair: '#c98f3d', eyes: '#5a8a52' },
    morph: { height: 0.6, build: -0.4, headSize: 0.2, age: 0.4 }
  })
  const dad = look({
    parts: {
      ...defaultParts(pack),
      hair: { partId: 'hair-spiky', scale: 1 },
      eyes: { partId: 'eyes-sleepy', scale: 1 }
    },
    palette: { ...defaultPalette(pack), skin: '#8d5a3b', hair: '#141018', eyes: '#3a2a1e' },
    morph: { height: -0.2, build: 0.6, headSize: 0, age: 0.5 }
  })
  const child = look({
    parts: { ...defaultParts(pack), torso: { partId: 'torso-hoodie', scale: 1 } },
    palette: { ...defaultPalette(pack), outfitA: '#123456' },
    morph: { height: 0, build: 0, headSize: 0, age: -0.8 }
  })

  it('with full resemblance, facial genes come from a parent', () => {
    for (let i = 0; i < 20; i++) {
      const out = inheritDoc(pack, [mom, dad], child, { resemblance: 1, rng: seqRng(i + 1) })
      expect(['hair-long', 'hair-spiky']).toContain(out.parts.hair.partId)
      expect(['eyes-spark', 'eyes-sleepy']).toContain(out.parts.eyes.partId)
    }
  })

  it('keeps the wardrobe, outfit colors and age of the child', () => {
    const out = inheritDoc(pack, [mom, dad], child, { rng: seqRng(5) })
    expect(out.parts.torso).toEqual({ partId: 'torso-hoodie', scale: 1 })
    expect(out.palette.outfitA).toBe('#123456')
    expect(out.morph.age).toBe(-0.8)
    expect(GENE_SLOTS).not.toContain('torso')
  })

  it('blends skin between the parents and keeps every part valid', () => {
    const lum = (hex) => parseInt(hex.slice(1, 3), 16)
    for (let i = 0; i < 20; i++) {
      const out = inheritDoc(pack, [mom, dad], child, { resemblance: 0.3, rng: seqRng(i + 7) })
      const l = lum(out.palette.skin)
      expect(l).toBeLessThanOrEqual(lum(mom.palette.skin))
      expect(l).toBeGreaterThanOrEqual(lum(dad.palette.skin))
      for (const s of pack.slots) {
        const id = out.parts[s.id]?.partId
        if (id == null) continue
        expect(
          partsFor(pack, s.id).some((p) => p.id === id),
          `${s.id}: ${id}`
        ).toBe(true)
      }
      for (const k of ['height', 'build', 'headSize']) {
        expect(out.morph[k]).toBeGreaterThanOrEqual(-1)
        expect(out.morph[k]).toBeLessThanOrEqual(1)
      }
    }
  })

  it('works with a single parent', () => {
    const out = inheritDoc(pack, [mom], child, { resemblance: 1, rng: seqRng(2) })
    expect(out.parts.hair.partId).toBe('hair-long')
  })
})

describe('DNA codes', () => {
  it('round-trips a look', () => {
    const doc = {
      ...look(),
      expression: 'smug',
      backdrop: 'night',
      parts: { ...defaultParts(pack), hair: { partId: 'hair-buns', scale: 1.24, flip: true } },
      morph: { height: 0.5, build: -0.25, headSize: 0.1, age: 0.9 }
    }
    const code = encodeDNA(doc)
    expect(code.startsWith('FTC1.')).toBe(true)
    expect(code).not.toMatch(/[+/=]/)
    const back = decodeDNA(code)
    expect(back.style_id).toBe(pack.id)
    expect(back.parts.hair).toEqual({ partId: 'hair-buns', scale: 1.24, flip: true })
    expect(back.palette).toEqual(doc.palette)
    expect(back.morph).toEqual(doc.morph)
    expect(back.expression).toBe('smug')
    expect(back.backdrop).toBe('night')
  })

  it('rejects garbage and sanitizes hostile values', () => {
    expect(() => decodeDNA('hello')).toThrow()
    expect(() => decodeDNA('FTC1.!!!!')).toThrow()
    const evil =
      'FTC1.' +
      btoa(
        JSON.stringify({
          s: 'anime',
          p: [['hair', 'x', 99, 0], 5],
          c: { skin: 'url(evil)', hair: '#ABCDEF' },
          m: { height: 50 }
        })
      ).replace(/=+$/, '')
    const out = decodeDNA(evil)
    expect(out.parts.hair.scale).toBe(1)
    expect(out.palette).toEqual({ hair: '#abcdef' })
    expect(out.morph.height).toBe(1)
  })
})
