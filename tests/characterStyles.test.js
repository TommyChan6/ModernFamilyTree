import { describe, it, expect } from 'vitest'
import {
  EXPRESSIONS,
  ageEffects,
  defaultParts,
  defaultPalette,
  effectivePalette,
  effectivePartId,
  harmonize,
  hexToHsl,
  hslToHex,
  mixColor,
  randomizeDoc,
  remapDoc,
  resolveLayers,
  slotState
} from '../src/renderer/src/components/character/characterModel'
import { cartoonPack } from '../src/renderer/src/components/character/styles/cartoon'
import { STYLE_LIST, packOf } from '../src/renderer/src/components/character/styles'
import {
  CORE_PART_IDS,
  OPTIONAL_SLOTS,
  PALETTE_CHANNELS,
  SLOT_IDS
} from '../src/renderer/src/components/character/styleTypes'
import { flipX, sym, transformD } from '../src/renderer/src/components/character/styles/pathKit'
import { docToSvg } from '../src/renderer/src/components/character/render/svgExport'

// The multi-style character engine: every registered style pack honors the
// cross-style contract (styleTypes.ts), plus expressions, the age morph,
// animation inputs (eye tracking, sway, pop), style remapping, randomize
// locks, color math, the path kit and the SVG backend.

const pack = cartoonPack

function makeDoc(overrides = {}, p = pack) {
  return {
    id: 'doc1',
    project_id: 'p',
    person_id: 'e',
    version: 1,
    label: 'Look 1',
    style_id: p.id,
    is_portrait: false,
    age_from: null,
    age_to: null,
    parts: defaultParts(p),
    palette: defaultPalette(p),
    morph: { height: 0, build: 0, headSize: 0, age: 0 },
    ...overrides
  }
}

const PATH_CHARS = /^[MLHVCSQTAZmlhvcsqtaz0-9eE.,\s+-]+$/

// ─────────────────────────────────────────────────────────────────────────────
describe.each(STYLE_LIST.map((p) => [p.id, p]))('style pack "%s" contract', (_id, sp) => {
  it('declares exactly the shared slots, optional where allowed', () => {
    expect(sp.slots.map((s) => s.id).sort()).toEqual([...SLOT_IDS].sort())
    for (const s of sp.slots) {
      expect(!!s.optional, s.id).toBe(OPTIONAL_SLOTS.includes(s.id))
      expect(s.thumb.span, s.id).toBeGreaterThan(0)
    }
  })

  it('provides every core part id in the right slot, with unique ids', () => {
    const ids = new Set()
    for (const part of sp.parts) {
      expect(ids.has(part.id), `duplicate ${part.id}`).toBe(false)
      ids.add(part.id)
      expect(SLOT_IDS.includes(part.slot), part.id).toBe(true)
    }
    for (const [slot, list] of Object.entries(CORE_PART_IDS)) {
      for (const id of list) {
        const part = sp.parts.find((p) => p.id === id)
        expect(part, `${sp.id} lacks ${id}`).toBeDefined()
        expect(part.slot).toBe(slot)
      }
    }
  })

  it('defaults are real parts; only optional slots default to none', () => {
    for (const s of sp.slots) {
      const def = sp.defaults[s.id]
      if (def === null || def === undefined) expect(s.optional, s.id).toBe(true)
      else expect(sp.parts.find((p) => p.id === def)?.slot, `${s.id} → ${def}`).toBe(s.id)
    }
  })

  it('paints through the shared channels with 8+ complete presets', () => {
    expect([...sp.paletteChannels].sort()).toEqual([...PALETTE_CHANNELS].sort())
    expect(sp.palettePresets.length).toBeGreaterThanOrEqual(8)
    for (const preset of sp.palettePresets) {
      for (const ch of PALETTE_CHANNELS) expect(preset[ch], ch).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('every clip layer follows a mask in the same list; paths are well-formed', () => {
    for (const part of sp.parts) {
      for (const list of [part.back || [], part.layers]) {
        let masked = false
        for (const l of list) {
          expect(!!l.d && PATH_CHARS.test(l.d), `${part.id} bad path`).toBe(true)
          if (l.clip) expect(masked, `${part.id}: clip before any mask`).toBe(true)
          if (l.mask) masked = true
        }
      }
    }
  })

  it('has a rig, avatar crops and the procedural fx', () => {
    for (const s of ['head', 'hair', 'eyes', 'mouth']) expect(sp.rig.headSlots).toContain(s)
    expect(sp.rig.legSlots).toContain('legs')
    expect(sp.portrait.span).toBeGreaterThan(0)
    expect(sp.face.span).toBeGreaterThan(0)
    expect(sp.fx?.blush?.length).toBeGreaterThan(0)
    expect(sp.fx?.tears?.length).toBeGreaterThan(0)
    expect(sp.fx?.aging?.length).toBeGreaterThan(0)
  })

  it('resolves to finite geometry in every expression, age and random look', () => {
    const docs = [
      ...EXPRESSIONS.map((e) => makeDoc({ expression: e.id }, sp)),
      ...[-1, 1].map((age) => makeDoc({ morph: { height: 1, build: -1, headSize: 1, age } }, sp))
    ]
    let seed = 3
    const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < 6; i++) docs.push(makeDoc(randomizeDoc(sp, rng), sp))
    const anim = { blink: 0.5, breath: 1, look: { x: 1, y: -1 }, time: 3.3, pop: { hair: 1.1 } }
    for (const doc of docs) {
      const layers = resolveLayers(doc, sp, anim)
      expect(layers.length).toBeGreaterThan(10)
      for (const l of layers) {
        for (const op of l.ops) {
          for (const v of Object.values(op)) {
            if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true)
          }
        }
      }
    }
  })

  it('keeps a typical look within the per-frame layer budget', () => {
    expect(resolveLayers(makeDoc({}, sp), sp).length).toBeLessThan(220)
  })
})

describe('style registry', () => {
  it('falls back to the first style for unknown ids', () => {
    expect(packOf('nope')).toBe(STYLE_LIST[0])
    expect(packOf('cartoon').id).toBe('cartoon')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('expressions', () => {
  it('swap in the expression parts the pack has, else keep the look', () => {
    const doc = makeDoc({ expression: 'surprised' })
    expect(effectivePartId(doc, pack, 'mouth')).toBe('mouth-o')
    const fake = { ...pack, parts: pack.parts.filter((p) => p.id !== 'mouth-o') }
    expect(effectivePartId(doc, fake, 'mouth')).toBe(slotState(doc, fake, 'mouth').partId)
    // The anim override (emote preview) wins over the stored expression
    expect(effectivePartId(doc, pack, 'mouth', 'neutral')).toBe(
      slotState(doc, pack, 'mouth').partId
    )
  })

  it('blush/tears overlays appear only for their expressions', () => {
    const withFx = {
      ...pack,
      fx: {
        blush: [{ d: 'M 0 0 L 1 1 Z', fill: '#ff0000' }],
        tears: [{ d: 'M 0 0 L 2 2 Z', fill: '#0000ff' }]
      }
    }
    const has = (expr, color) =>
      resolveLayers(makeDoc({ expression: expr }), withFx).some((l) => l.fill === color)
    expect(has('shy', '#ff0000')).toBe(true)
    expect(has('sad', '#0000ff')).toBe(true)
    expect(has('neutral', '#ff0000') || has('neutral', '#0000ff')).toBe(false)
  })
})

describe('age morph', () => {
  it('children are small and big-headed; elders grey', () => {
    const kid = ageEffects(-1)
    expect(kid.bodyScale).toBeLessThan(1)
    expect(kid.headBoost).toBeGreaterThan(0)
    expect(kid.hideFacialHair).toBe(true)
    const old = ageEffects(1)
    expect(old.grey).toBeGreaterThan(0.5)
    expect(old.wrinkles).toBe(1)
    expect(ageEffects(0)).toMatchObject({ bodyScale: 1, headBoost: 0, grey: 0, wrinkles: 0 })
  })

  it('greys the hair channel and scales the whole body about the ground', () => {
    const doc = makeDoc({ morph: { height: 0, build: 0, headSize: 0, age: 1 } })
    const pal = effectivePalette(doc, pack)
    expect(pal.hair).not.toBe(doc.palette.hair)
    expect(pal.skin).toBe(doc.palette.skin)
    const kid = resolveLayers(
      makeDoc({ morph: { height: 0, build: 0, headSize: 0, age: -1 } }),
      pack
    )
    const legs = kid.find((l) => l.slot === 'legs')
    expect(legs.ops[0]).toMatchObject({ type: 'scale', cy: pack.rig.ground.y })
    expect(legs.ops[0].sx).toBeLessThan(1)
  })
})

describe('animation inputs', () => {
  const lp = {
    ...pack,
    parts: pack.parts.map((p) => {
      if (p.id === 'eyes-round') {
        return {
          ...p,
          layers: [
            { d: 'M 0 0 L 9 9 Z', fill: '#ffffff', mask: true },
            { d: 'M 1 1 L 3 3 Z', fill: 'eyes', clip: true, track: 3 }
          ]
        }
      }
      if (p.id === 'hair-long')
        return { ...p, back: [{ d: 'M 0 0 L 5 5 Z', fill: 'hair', sway: 2 }] }
      return p
    })
  }
  const withEyes = (extra = {}) => {
    const d = makeDoc(extra)
    d.parts.eyes = { partId: 'eyes-round', scale: 1 }
    return d
  }

  it('tracked layers get a look offset and clip to their mask', () => {
    const iris = resolveLayers(withEyes(), lp, { look: { x: 1, y: 0 } }).find(
      (l) => l.slot === 'eyes' && l.clip
    )
    expect(iris.offset.x).toBe(3)
    expect(iris.clip.d).toBe('M 0 0 L 9 9 Z')
    const still = resolveLayers(withEyes(), lp).find((l) => l.slot === 'eyes' && l.clip)
    expect(still.offset).toBeNull()
  })

  it('sway rotates only when time is given; pop squashes about the socket', () => {
    const doc = makeDoc()
    doc.parts.hair = { partId: 'hair-long', scale: 1 }
    const hairBack = (anim) =>
      resolveLayers(doc, lp, anim).find(
        (l) => l.slot === 'hair' && l.z === lp.slots.find((s) => s.id === 'hair').backZ
      )
    expect(hairBack({}).ops.some((o) => o.type === 'rotate')).toBe(false)
    expect(hairBack({ time: 1 }).ops.some((o) => o.type === 'rotate')).toBe(true)
    const popped = resolveLayers(doc, lp, { pop: { mouth: 1.1 } }).find((l) => l.slot === 'mouth')
    expect(popped.ops.some((o) => o.type === 'scale' && o.sx === 1.1 && o.sy < 1)).toBe(true)
  })
})

describe('style switching, locks & color math', () => {
  it('remapDoc keeps shared part ids and defaults the rest', () => {
    const doc = makeDoc()
    doc.parts.hair = { partId: 'hair-long', scale: 1.2 }
    doc.parts.eyes = { partId: 'eyes-only-in-some-other-pack', scale: 1 }
    const out = remapDoc(doc, pack)
    expect(out.parts.hair).toEqual({ partId: 'hair-long', scale: 1.2 })
    expect(out.parts.eyes.partId).toBe(pack.defaults.eyes)
    expect(out.palette.skin).toBe(doc.palette.skin)
  })

  it('randomizeDoc keeps locked slots, palette and morph', () => {
    const base = makeDoc({ morph: { height: 0.3, build: 0.1, headSize: -0.2, age: 0.5 } })
    base.parts.hair = { partId: 'hair-buns', scale: 1.1 }
    const out = randomizeDoc(pack, Math.random, { locks: ['hair', 'palette', 'morph'], base })
    expect(out.parts.hair).toEqual({ partId: 'hair-buns', scale: 1.1 })
    expect(out.palette).toEqual(base.palette)
    expect(out.morph).toEqual(base.morph)
  })

  it('mixColor / hsl round-trip / harmonize stay valid', () => {
    expect(mixColor('#000000', '#ffffff', 0.5)).toBe('#808080')
    for (const hex of ['#6c8ef5', '#e86a5f', '#2bb3a3']) {
      const [h, s, l] = hexToHsl(hex)
      const back = hslToHex(h, s, l)
      for (let i = 1; i < 7; i += 2) {
        const diff = Math.abs(
          parseInt(back.slice(i, i + 2), 16) - parseInt(hex.slice(i, i + 2), 16)
        )
        expect(diff).toBeLessThanOrEqual(1)
      }
    }
    const pal = defaultPalette(pack)
    for (const mode of ['complementary', 'analogous', 'triad', 'mono']) {
      const out = harmonize(pal, mode, () => 0.5)
      expect(out.skin).toBe(pal.skin)
      for (const ch of ['outfitA', 'outfitB', 'accent']) expect(out[ch]).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe('pathKit', () => {
  it('flipX mirrors absolute and relative commands (arcs flip sweep)', () => {
    expect(flipX('M 150 10 L 170 20', 160)).toBe('M 170 10 L 150 20')
    expect(flipX('M 150 10 l 10 5', 160)).toBe('M 170 10 L 160 15')
    expect(flipX('M 150 10 A 5 5 0 0 1 155 15', 160)).toBe('M 170 10 A 5 5 0 0 0 165 15')
  })

  it('transformD expands H/V/T to absolute commands', () => {
    const out = transformD('M 0 0 H 10 V 10 Q 5 15 0 10 T -10 10', 1, 1, 0, 0)
    expect(out).toBe('M 0 0 L 10 0 L 10 10 Q 5 15 0 10 Q -5 5 -10 10')
  })

  it('sym builds a left/right symmetric closed shape', () => {
    const d = sym([
      [160, 0],
      [200, 50],
      [160, 100]
    ])
    expect(d.startsWith('M 160 0')).toBe(true)
    expect(d).toContain('120 50')
    expect(d.endsWith('Z')).toBe(true)
  })
})

describe('svg export', () => {
  it('emits a standalone document with clip paths and gradients when used', () => {
    const p = {
      ...pack,
      parts: pack.parts.map((x) =>
        x.id === 'head-round'
          ? {
              ...x,
              layers: [
                {
                  d: 'M 100 100 L 200 100 L 150 200 Z',
                  mask: true,
                  grad: {
                    type: 'linear',
                    x1: 0,
                    y1: 0,
                    x2: 0,
                    y2: 1,
                    stops: [
                      [0, 'skin'],
                      [1, 'skin', -0.2, 0.5]
                    ]
                  }
                },
                {
                  d: 'M 100 100 L 150 150 Z',
                  fill: 'skin',
                  shade: -0.2,
                  clip: true,
                  blend: 'multiply',
                  alpha: 0.5
                }
              ]
            }
          : x
      )
    }
    const doc = makeDoc()
    doc.parts.head = { partId: 'head-round', scale: 1 }
    const svg = docToSvg(doc, p, { size: 256 })
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('<clipPath')
    expect(svg).toContain('<linearGradient')
    expect(svg).toContain('mix-blend-mode:multiply')
    expect(svg).toContain('opacity="0.5"')
  })
})
