import { describe, it, expect, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'
import {
  AURA_LINES,
  AURA_ORNAMENTS,
  auraLineBetween,
  matchStrength,
  resolveAuras,
  sanitizeAura,
  sanitizeTraitAuras,
  sanitizeWhen,
  whenOpsFor
} from '../src/shared/auras'
import { channelHandlers, EMPTY_DB, seedSampleData } from '../src/shared/dbCore'
import { LINE_FX } from '../src/renderer/src/components/graph/webgl/lineFx.js'
import { AURA_SHADER_IDS } from '../src/renderer/src/components/graph/webgl/NodeMaterial.js'
import { packRGB } from '../src/renderer/src/components/graph/webgl/NodeLayer.js'

const env = {
  uuid: () => randomUUID(),
  nowStr: () => '2026-01-01 00:00:00',
  storeImageFile: (p) => p,
  removeImageFile: () => {}
}

const sel = (over = {}) => ({
  id: 'el',
  type: 'select',
  order: 0,
  config: {
    options: [
      { id: 'fire', label: 'Fire' },
      { id: 'water', label: 'Water' }
    ]
  },
  ...over
})
const num = (over = {}) => ({
  id: 'mag',
  type: 'slider',
  order: 1,
  config: { min: 0, max: 100 },
  ...over
})
const val = (person_id, field_id, value) => ({ id: randomUUID(), person_id, field_id, value })
const flame = { ornament: 'flame', color: '#ff7a1a', line: 'ember', tint: false }

describe('auras — catalogs', () => {
  it('the line ids match the renderer line-effect catalog', () => {
    expect([...AURA_LINES].sort()).toEqual(LINE_FX.map((f) => f.id).sort())
  })
  it('every ornament has a shader id (none = 0, the rest unique)', () => {
    expect(AURA_SHADER_IDS.none).toBe(0)
    const ids = AURA_ORNAMENTS.filter((o) => o !== 'none').map((o) => AURA_SHADER_IDS[o])
    expect(ids.every((n) => n > 0)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('packs the aura colour into one float-exact integer (no extra attribute)', () => {
    // The node shader is at the 16 vertex-attribute limit, so the colour rides
    // in iAura.w; the shader unpacks it with floor/mod — mirror that here.
    const unpack = (w) => [Math.floor(w / 65536), Math.floor(w / 256) % 256, w % 256]
    expect(unpack(packRGB([1, 0.5, 0]))).toEqual([255, 128, 0])
    expect(packRGB([1, 1, 1])).toBeLessThan(2 ** 24) // exact in float32
    expect(Math.fround(packRGB([0.2, 0.4, 0.6]))).toBe(packRGB([0.2, 0.4, 0.6]))
    expect(packRGB(null)).toBe(0xffffff)
  })
})

describe('auras — sanitizing', () => {
  it('cleans an aura and drops one that would draw nothing', () => {
    expect(sanitizeAura({ ornament: 'crown', color: '#ABCDEF', line: 'gilded', tint: 1 })).toEqual({
      ornament: 'crown',
      color: '#abcdef',
      line: 'gilded',
      tint: true
    })
    expect(sanitizeAura({ ornament: 'none', line: 'none', tint: false })).toBeNull()
    expect(sanitizeAura({ ornament: 'nope', line: 'lava', tint: false })).toBeNull()
    expect(sanitizeAura(null)).toBeNull()
    expect(sanitizeAura({ ornament: 'halo', color: 'red' }).color).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('offers the right condition ops per trait type', () => {
    expect(whenOpsFor({ type: 'boolean' })).toEqual(['any'])
    expect(whenOpsFor({ type: 'select' })).toEqual(['any', 'is'])
    expect(whenOpsFor({ type: 'slider' })).toEqual(['any', 'range'])
    expect(whenOpsFor({ type: 'date' })).toEqual(['any', 'range'])
  })

  it('validates conditions against the def', () => {
    // dangling option ids drop; an empty "is one of" falls back to any
    expect(sanitizeWhen({ op: 'is', values: ['fire', 'ghost'] }, sel()).values).toEqual(['fire'])
    expect(sanitizeWhen({ op: 'is', values: ['ghost'] }, sel()).op).toBe('any')
    // a range op on a select is not allowed
    expect(sanitizeWhen({ op: 'range', min: 1 }, sel()).op).toBe('any')
    // reversed bounds are swapped; a boundless range is just "any"
    expect(sanitizeWhen({ op: 'range', min: 80, max: 20 }, num())).toMatchObject({
      min: 20,
      max: 80
    })
    expect(sanitizeWhen({ op: 'range' }, num()).op).toBe('any')
  })

  it('cleans a rule list: ids kept unique, scale only on numbers, nothing-rules dropped', () => {
    const rules = sanitizeTraitAuras(
      [
        { id: 'a', ...flame, when: { op: 'is', values: ['fire'] }, scale: true },
        { id: 'a', ...flame, when: { op: 'any' } },
        { ornament: 'none', line: 'none', tint: false, when: { op: 'any' } },
        'junk'
      ],
      sel(),
      (i) => 'gen-' + i
    )
    expect(rules).toHaveLength(2)
    expect(rules[0]).toMatchObject({ id: 'a', scale: false })
    expect(rules[1].id).toBe('gen-1')
    expect(sanitizeTraitAuras('nope', sel())).toEqual([])
  })
})

describe('auras — matching', () => {
  it('select / boolean / text', () => {
    const r = { when: { op: 'is', values: ['fire'], min: null, max: null }, scale: false }
    expect(matchStrength(r, sel(), 'fire')).toBe(1)
    expect(matchStrength(r, sel(), 'water')).toBe(0)
    const any = { when: { op: 'any', values: [], min: null, max: null }, scale: false }
    expect(matchStrength(any, { type: 'boolean', config: {} }, true)).toBe(1)
    expect(matchStrength(any, { type: 'boolean', config: {} }, false)).toBe(0)
    expect(matchStrength(any, { type: 'text', config: {} }, '   ')).toBe(0)
    const smith = { when: { op: 'is', values: ['Smith'], min: null, max: null }, scale: false }
    expect(matchStrength(smith, { type: 'text', config: {} }, 'Blacksmith')).toBe(1)
  })

  it('numeric ranges, scaled strength, unknowns', () => {
    const r = { when: { op: 'range', values: [], min: 50, max: null }, scale: true }
    expect(matchStrength(r, num(), 40)).toBe(0)
    expect(matchStrength(r, num(), 50)).toBeCloseTo(0.3)
    expect(matchStrength(r, num(), 100)).toBeCloseTo(1)
    expect(matchStrength(r, num(), null)).toBe(0) // unknown is not a match
    // no bounds anywhere → full strength
    const free = { when: { op: 'any', values: [], min: null, max: null }, scale: true }
    expect(matchStrength(free, { type: 'number', config: {} }, 7)).toBe(1)
  })

  it('dates compare by year', () => {
    const d = { type: 'date', config: {} }
    const r = { when: { op: 'range', values: [], min: 1800, max: 1899 }, scale: false }
    expect(matchStrength(r, d, { year: 1850, month: null, day: null })).toBe(1)
    expect(matchStrength(r, d, { year: 1900, month: null, day: null })).toBe(0)
  })
})

describe('auras — resolution', () => {
  const tags = [
    {
      id: 't1',
      label: 'Royals',
      aura: { ornament: 'crown', color: '#e8b931', line: 'gilded', tint: false }
    },
    { id: 't2', label: 'Plain' }
  ]
  const entityTags = [
    { id: 'e1', entity_id: 'p1', tag_id: 't1' },
    { id: 'e2', entity_id: 'p2', tag_id: 't1' },
    { id: 'e3', entity_id: 'p3', tag_id: 't2' }
  ]

  it('members of a tag wear its aura; counts per source', () => {
    const { byPerson, counts } = resolveAuras({ tags, entityTags, defs: [], values: [] })
    expect(byPerson.get('p1')).toMatchObject({ ornament: 'crown', line: 'gilded', intensity: 1 })
    expect(byPerson.has('p3')).toBe(false)
    expect(counts.get('tag:t1')).toBe(2)
  })

  it('specific trait rules beat tags; slots combine across sources', () => {
    const defs = [
      sel({
        auras: [
          {
            id: 'r1',
            ornament: 'flame',
            color: '#ff7a1a',
            line: 'none',
            tint: false,
            when: { op: 'is', values: ['fire'] }
          }
        ]
      })
    ]
    const values = [val('p1', 'el', 'fire')]
    const { byPerson } = resolveAuras({ tags, entityTags, defs, values })
    const p1 = byPerson.get('p1')
    expect(p1.ornament).toBe('flame') // the rule wins the ornament…
    expect(p1.line).toBe('gilded') // …the tag still gives its line
    expect(p1.sources.map((s) => s.kind)).toEqual(['trait', 'tag'])
  })

  it('broad "any value" rules rank below tags', () => {
    const defs = [
      sel({
        auras: [
          {
            id: 'r',
            ornament: 'frost',
            color: '#9fdcff',
            line: 'none',
            tint: false,
            when: { op: 'any' }
          }
        ]
      })
    ]
    const { byPerson } = resolveAuras({
      tags,
      entityTags,
      defs,
      values: [val('p1', 'el', 'water')]
    })
    expect(byPerson.get('p1').ornament).toBe('crown')
  })

  it('respects personIds and ignores garbage auras', () => {
    const bad = [{ id: 't9', aura: { ornament: 'lava' } }]
    const rows = [{ id: 'x', entity_id: 'p1', tag_id: 't9' }]
    expect(resolveAuras({ tags: bad, entityTags: rows, defs: [], values: [] }).byPerson.size).toBe(
      0
    )
    const { byPerson } = resolveAuras({ tags, entityTags, defs: [], values: [], personIds: ['p2'] })
    expect([...byPerson.keys()]).toEqual(['p2'])
  })

  it('a bond wears a line only when both ends share it', () => {
    expect(auraLineBetween({ line: 'ember' }, { line: 'ember' })).toBe('ember')
    expect(auraLineBetween({ line: 'ember' }, { line: 'river' })).toBeNull()
    expect(auraLineBetween({ line: 'ember' }, null)).toBeNull()
    expect(auraLineBetween({ line: 'none' }, { line: 'none' })).toBeNull()
  })
})

describe('auras — channels', () => {
  let db
  beforeEach(() => {
    db = EMPTY_DB()
    const pid = randomUUID()
    db.projects[pid] = { id: pid, name: 'T', created_at: env.nowStr(), updated_at: env.nowStr() }
    db.activeProjectId = pid
    seedSampleData(db, pid, env)
  })

  it('tags carry a sanitized aura; null removes it; one undo step', async () => {
    const tag = await channelHandlers['tags:create'](db, { label: 'Mages' }, env)
    expect(tag.aura).toBeUndefined()
    const up = await channelHandlers['tags:update'](
      db,
      { id: tag.id, aura: { ornament: 'sparkle', color: '#B07CFF', line: 'neon', tint: true } },
      env
    )
    expect(up.aura).toEqual({ ornament: 'sparkle', color: '#b07cff', line: 'neon', tint: true })
    await channelHandlers['history:undo'](db, {}, env)
    expect(db.tags[tag.id].aura).toBeUndefined()
    await channelHandlers['history:redo'](db, {}, env)
    expect(db.tags[tag.id].aura.ornament).toBe('sparkle')
    const off = await channelHandlers['tags:update'](db, { id: tag.id, aura: null }, env)
    expect(off.aura).toBeUndefined()
  })

  it('trait rules are sanitized and re-checked when options change', async () => {
    const { def } = await channelHandlers['fields:createDef'](
      db,
      { type: 'select', label: 'Element', config: sel().config },
      env
    )
    const up = await channelHandlers['fields:updateDef'](
      db,
      {
        id: def.id,
        auras: [
          { ...flame, when: { op: 'is', values: ['fire'] } },
          {
            ornament: 'frost',
            color: '#9fdcff',
            line: 'none',
            tint: false,
            when: { op: 'is', values: ['water'] }
          }
        ]
      },
      env
    )
    expect(up.auras).toHaveLength(2)
    expect(up.auras[0].id).toBeTruthy()
    // remove the Water option: its rule degrades to "has any value"
    const cut = await channelHandlers['fields:updateDef'](
      db,
      { id: def.id, config: { options: [{ id: 'fire', label: 'Fire' }] } },
      env
    )
    expect(cut.auras[1].when.op).toBe('any')
    const none = await channelHandlers['fields:updateDef'](db, { id: def.id, auras: [] }, env)
    expect(none.auras).toBeUndefined()
  })

  it('project copies keep auras', async () => {
    const tag = await channelHandlers['tags:create'](
      db,
      { label: 'Royals', aura: { ...flame } },
      env
    )
    expect(tag.aura.ornament).toBe('flame')
    const file = await channelHandlers['projects:export'](db, { id: db.activeProjectId }, env)
    const json = JSON.stringify(file)
    expect(json).toContain('"ornament":"flame"')
  })
})
