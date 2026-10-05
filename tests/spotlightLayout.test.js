import { describe, it, expect } from 'vitest'
import { buildKinIndex, kinshipLens } from '../src/renderer/src/components/kinship/kinshipGraph'
import {
  computeSpotlightLayout,
  bloodRing,
  ringFor,
  relaxAngles,
  defaultMainCharacter
} from '../src/renderer/src/components/graph/spotlightLayout'

const P = (id, gender, year) => ({ id, gender, birth: year ? { year } : null })
const persons = [
  P('GF', 'male', 1930),
  P('GM', 'female', 1932),
  P('Dad', 'male', 1960),
  P('Uncle', 'male', 1955),
  P('Mom', 'female', 1962),
  P('MomDad', 'male', 1934),
  P('Me', 'male', 1990),
  P('Sis', 'female', 1985),
  P('Bro', 'male', 1995),
  P('Wife', 'female', 1991),
  P('WifeDad', 'male', 1960),
  P('Son', 'male', 2018),
  P('Cousin', 'male', 1992),
  P('Pal', 'male', 1990),
  P('Loner', 'female', 1980)
]
let n = 0
const R = (a, b, type = 'parent_child') => ({ id: 'r' + ++n, person_a_id: a, person_b_id: b, type })
const rels = [
  R('GF', 'Dad'),
  R('GM', 'Dad'),
  R('GF', 'Uncle'),
  R('GM', 'Uncle'),
  R('MomDad', 'Mom'),
  R('Dad', 'Mom', 'spouse'),
  R('Dad', 'Me'),
  R('Mom', 'Me'),
  R('Dad', 'Sis'),
  R('Mom', 'Sis'),
  R('Dad', 'Bro'),
  R('Mom', 'Bro'),
  R('Me', 'Wife', 'spouse'),
  R('WifeDad', 'Wife'),
  R('Me', 'Son'),
  R('Wife', 'Son'),
  R('Uncle', 'Cousin'),
  R('Me', 'Pal', 'friends')
]
const index = buildKinIndex(persons, rels)
const lens = kinshipLens(index, 'Me')
const ids = persons.map((p) => p.id)
const res = computeSpotlightLayout(ids, 'Me', index, lens, { cx: 0, cy: 0 })
const T = res.targets
const angle = (id) => Math.atan2(T[id].y, T[id].x)
const dist = (id) => Math.hypot(T[id].x, T[id].y)

describe('rings', () => {
  it('maps the cousin chart onto rings', () => {
    expect(bloodRing(1, 0)).toBe(1)
    expect(bloodRing(1, 1)).toBe(1)
    expect(bloodRing(2, 0)).toBe(2)
    expect(bloodRing(2, 1)).toBe(2)
    expect(bloodRing(2, 2)).toBe(3)
    expect(bloodRing(3, 3)).toBe(4)
    expect(ringFor(lens.get('Wife'))).toBe(1)
    expect(ringFor(lens.get('WifeDad'))).toBe(2)
    expect(ringFor(lens.get('Pal'))).toBe(2)
  })
  it('puts the main character at the centre and kin by closeness', () => {
    expect(T.Me).toEqual({ x: 0, y: 0 })
    expect(res.ringOf.Dad).toBe(1)
    expect(res.ringOf.GF).toBe(2)
    expect(res.ringOf.Cousin).toBe(3)
    expect(res.ringOf.Loner).toBe(-1)
    expect(dist('Dad')).toBeLessThan(dist('GF'))
    expect(dist('GF')).toBeLessThan(dist('Cousin'))
    expect(dist('Cousin')).toBeLessThan(dist('Loner'))
    expect(res.rings.at(-1).label).toBe('Not connected')
  })
  it('keeps meaningful bearings: ancestors up, descendants down, father left', () => {
    expect(T.Dad.y).toBeLessThan(0)
    expect(T.GF.y).toBeLessThan(0)
    expect(T.Son.y).toBeGreaterThan(0)
    expect(T.Dad.x).toBeLessThan(T.Mom.x)
    expect(T.Sis.x).toBeLessThan(0) // older sister to the left
    expect(T.Bro.x).toBeGreaterThan(0) // younger brother to the right
    expect(Number.isFinite(angle('Wife'))).toBe(true)
  })
  it('never stacks people on a ring', () => {
    for (const a of ids)
      for (const b of ids) {
        if (a >= b) continue
        expect(Math.hypot(T[a].x - T[b].x, T[a].y - T[b].y)).toBeGreaterThan(40)
      }
  })
})

describe('relaxAngles', () => {
  it('spreads clashing bearings to the minimum separation', () => {
    const out = relaxAngles([1, 1, 1], 0.5)
    const s = [...out].sort((a, b) => a - b)
    expect(s[1] - s[0]).toBeCloseTo(0.5, 3)
    expect(s[2] - s[1]).toBeCloseTo(0.5, 3)
  })
  it('falls back to even spacing when the ring is full', () => {
    const out = relaxAngles([0, 0, 0, 0], 3)
    const s = [...out].sort((a, b) => a - b)
    expect(s[1] - s[0]).toBeCloseTo(Math.PI / 2, 2)
  })
})

describe('defaultMainCharacter', () => {
  it('picks the most connected person', () => {
    expect(defaultMainCharacter(index, ids)).toBe('Dad') // 6 links: both parents, wife, three children
  })
})

describe('widestGapAngle', () => {
  it('labels a ring in its emptiest arc', async () => {
    const { widestGapAngle } = await import('../src/renderer/src/components/graph/spotlightLayout')
    // people at 0°, 90°, 180° → the empty half (180°→360°) is centred on 270°
    const a = widestGapAngle([0, Math.PI / 2, Math.PI])
    expect(((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).toBeCloseTo((3 * Math.PI) / 2, 5)
    for (const ring of res.rings) expect(Number.isFinite(ring.labelAngle)).toBe(true)
  })
})
