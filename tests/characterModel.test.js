import { describe, it, expect } from 'vitest'
import {
  defaultParts,
  defaultPalette,
  randomizeDoc,
  resolveLayers,
  resolvePaint,
  shadeColor,
  slotState
} from '../src/renderer/src/components/character/characterModel'
import { cartoonPack } from '../src/renderer/src/components/character/styles/cartoon'

// The pure character assembly: CharacterDoc + StylePack → paint-ready layers.
// Also guards the cartoon pack's internal consistency (defaults, part slots,
// palette presets) so art edits can't silently break the view.

const pack = cartoonPack

function makeDoc(overrides = {}) {
  return {
    id: 'doc1',
    project_id: 'p',
    person_id: 'e',
    version: 1,
    label: 'Look 1',
    style_id: pack.id,
    is_portrait: false,
    age_from: null,
    age_to: null,
    parts: defaultParts(pack),
    palette: defaultPalette(pack),
    morph: { height: 0, build: 0, headSize: 0 },
    ...overrides
  }
}

// ─────────────────────────────────────────────────────────────────────────────
describe('cartoon pack integrity', () => {
  it('every part belongs to a declared slot', () => {
    const slotIds = new Set(pack.slots.map((s) => s.id))
    for (const part of pack.parts) expect(slotIds.has(part.slot), part.id).toBe(true)
  })

  it('defaults reference real parts; only optional slots may default to none', () => {
    for (const slot of pack.slots) {
      const def = pack.defaults[slot.id]
      if (def === null) {
        expect(slot.optional, `${slot.id} defaults to none but is not optional`).toBe(true)
      } else {
        const part = pack.parts.find((p) => p.id === def)
        expect(part, `default ${def} of ${slot.id} missing`).toBeDefined()
        expect(part.slot).toBe(slot.id)
      }
    }
  })

  it('every palette preset covers every channel', () => {
    for (const preset of pack.palettePresets) {
      for (const ch of pack.paletteChannels) {
        expect(preset[ch], ch).toMatch(/^#[0-9a-f]{6}$/i)
      }
    }
  })

  it('every slot offers at least one part and a thumb region', () => {
    for (const slot of pack.slots) {
      expect(
        pack.parts.some((p) => p.slot === slot.id),
        slot.id
      ).toBe(true)
      expect(slot.thumb.span).toBeGreaterThan(0)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('color resolution', () => {
  it('shadeColor darkens and lightens within bounds', () => {
    expect(shadeColor('#808080', 0)).toBe('#808080')
    expect(shadeColor('#808080', -1)).toBe('#000000')
    expect(shadeColor('#808080', 1)).toBe('#ffffff')
    const darker = shadeColor('#6c8ef5', -0.2)
    expect(parseInt(darker.slice(1, 3), 16)).toBeLessThan(0x6c)
  })

  it('resolvePaint maps roles, ink, and literals', () => {
    const palette = { skin: '#f2c9a0' }
    expect(resolvePaint('skin', palette, '#111111')).toBe('#f2c9a0')
    expect(resolvePaint('ink', palette, '#111111')).toBe('#111111')
    expect(resolvePaint('#00ff00', palette, '#111111')).toBe('#00ff00')
    expect(resolvePaint(undefined, palette, '#111111')).toBeNull()
    // Unknown roles fall back to a visible placeholder rather than crashing
    expect(resolvePaint('nope', palette, '#111111')).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('resolveLayers', () => {
  it('orders layers back to front and keeps hair-back behind the head', () => {
    const doc = makeDoc()
    doc.parts.hair = { partId: 'hair-long', scale: 1 }
    const layers = resolveLayers(doc, pack)
    for (let i = 1; i < layers.length; i++) {
      expect(layers[i].z).toBeGreaterThanOrEqual(layers[i - 1].z)
    }
    const backIdx = layers.findIndex((l) => l.slot === 'hair')
    const headIdx = layers.findIndex((l) => l.slot === 'head')
    expect(backIdx).toBeLessThan(headIdx) // long hair's back band paints first
  })

  it('skips empty slots and resolves paints to concrete colors', () => {
    const doc = makeDoc()
    doc.parts.headwear = { partId: null, scale: 1 }
    const layers = resolveLayers(doc, pack)
    expect(layers.some((l) => l.slot === 'headwear')).toBe(false)
    for (const l of layers) {
      if (l.fill) expect(l.fill).toMatch(/^#[0-9a-f]{6}$/i)
      if (l.stroke) expect(l.stroke).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('applies the per-slot scale about the slot socket', () => {
    const doc = makeDoc()
    doc.parts.hair = { partId: 'hair-short', scale: 1.3 }
    const hair = resolveLayers(doc, pack).find((l) => l.slot === 'hair')
    const socket = pack.slots.find((s) => s.id === 'hair').socket
    const op = hair.ops.find((o) => o.type === 'scale' && o.sx === 1.3)
    expect(op).toBeDefined()
    expect(op.cx).toBe(socket.x)
    expect(op.cy).toBe(socket.y)
  })

  it('height morph stretches legs about the ground and lifts the rest', () => {
    const doc = makeDoc({ morph: { height: 1, build: 0, headSize: 0 } })
    const layers = resolveLayers(doc, pack)
    const legs = layers.find((l) => l.slot === 'legs')
    const legOp = legs.ops.find((o) => o.type === 'scale')
    expect(legOp.sy).toBeGreaterThan(1)
    expect(legOp.cy).toBe(pack.rig.ground.y)
    const head = layers.find((l) => l.slot === 'head')
    const lift = head.ops.find((o) => o.type === 'translate')
    expect(lift.y).toBeLessThan(0) // moves up to stay attached
  })

  it('headSize morph scales the whole head group about the neck', () => {
    const doc = makeDoc({ morph: { height: 0, build: 0, headSize: 1 } })
    const layers = resolveLayers(doc, pack)
    for (const slotId of ['head', 'hair', 'eyes', 'mouth']) {
      const layer = layers.find((l) => l.slot === slotId)
      const op = layer.ops.find((o) => o.type === 'scale' && o.cy === pack.rig.neck.y)
      expect(op, slotId).toBeDefined()
      expect(op.sx).toBeGreaterThan(1)
    }
    // …but not the legs
    const legs = layers.find((l) => l.slot === 'legs')
    expect(legs.ops.some((o) => o.type === 'scale' && o.cy === pack.rig.neck.y)).toBe(false)
  })

  it('blink squashes only the eyes', () => {
    const layers = resolveLayers(makeDoc(), pack, { blink: 1 })
    const eyes = layers.find((l) => l.slot === 'eyes')
    const squash = eyes.ops.find((o) => o.type === 'scale' && o.sy < 1)
    expect(squash).toBeDefined()
    const mouth = layers.find((l) => l.slot === 'mouth')
    expect(mouth.ops.some((o) => o.type === 'scale' && o.sy < 1)).toBe(false)
  })

  it('untouched docs fall back to the pack defaults per slot', () => {
    const doc = makeDoc({ parts: {} })
    expect(slotState(doc, pack, 'hair').partId).toBe(pack.defaults.hair)
    expect(resolveLayers(doc, pack).length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('randomizeDoc', () => {
  // Deterministic rng: cycles through a fixed sequence
  const seqRng = (seq) => {
    let i = 0
    return () => seq[i++ % seq.length]
  }

  it('picks valid parts and in-range morphs, deterministically per rng', () => {
    const rng = () => 0.42
    const a = randomizeDoc(pack, seqRng([0.1, 0.5, 0.9, 0.3, 0.7]))
    const b = randomizeDoc(pack, seqRng([0.1, 0.5, 0.9, 0.3, 0.7]))
    expect(a).toEqual(b)

    const out = randomizeDoc(pack, rng)
    for (const slot of pack.slots) {
      const st = out.parts[slot.id]
      expect(st).toBeDefined()
      if (st.partId !== null) {
        const part = pack.parts.find((p) => p.id === st.partId)
        expect(part?.slot).toBe(slot.id)
      } else {
        expect(slot.optional).toBe(true) // only optional slots may come up empty
      }
    }
    for (const ch of pack.paletteChannels) expect(out.palette[ch]).toBeDefined()
    for (const v of Object.values(out.morph)) {
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})
