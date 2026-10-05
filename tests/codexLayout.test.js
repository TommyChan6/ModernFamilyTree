import { describe, it, expect } from 'vitest'
import {
  INDEX_ROW_H,
  INDEX_PAD,
  entryNo,
  indexWindow,
  indexHeight,
  scrollToReveal,
  letterJumps,
  initialsOf,
  prettyDate,
  lifespanScale,
  kinshipOf,
  sealPath,
  hashOf,
  turnKeyframes
} from '../src/renderer/src/components/people/codexLayout.js'

describe('codex index geometry', () => {
  it('pads entry numbers to three digits, or the width of the largest', () => {
    expect(entryNo(0)).toBe('No. 001')
    expect(entryNo(41, 400)).toBe('No. 042')
    expect(entryNo(6, 12000)).toBe('No. 00007')
  })

  it('windows only the rows near the viewport', () => {
    const w = indexWindow(0, 460, 5000)
    expect(w.start).toBe(0)
    expect(w.end).toBeLessThan(30)
    const far = indexWindow(INDEX_PAD + 1000 * INDEX_ROW_H, 460, 5000)
    expect(far.start).toBeGreaterThan(980)
    expect(far.end - far.start).toBeLessThan(30)
  })

  it('clamps a stale scroll position to a valid window', () => {
    expect(indexWindow(1e6, 500, 10)).toEqual({ start: 10, end: 10 })
    expect(indexWindow(0, 500, 0)).toEqual({ start: 0, end: 0 })
  })

  it('sizes the list and reveals rows only when needed', () => {
    expect(indexHeight(0)).toBe(0)
    expect(indexHeight(3)).toBe(INDEX_PAD * 2 + 3 * INDEX_ROW_H)
    expect(scrollToReveal(0, 600, 2)).toBeNull() // already visible
    const down = scrollToReveal(0, 600, 100)
    expect(down).toBeGreaterThan(0)
    expect(INDEX_PAD + 100 * INDEX_ROW_H + INDEX_ROW_H).toBeLessThanOrEqual(down + 600)
    const up = scrollToReveal(9000, 600, 3)
    expect(up).toBeLessThan(INDEX_PAD + 3 * INDEX_ROW_H)
  })

  it('lists the first index of each initial', () => {
    const jumps = letterJumps([{ name: 'Ada' }, { name: 'alan' }, { name: 'Bo' }, { name: '9x' }])
    expect(jumps).toEqual([
      { ch: 'A', index: 0 },
      { ch: 'B', index: 2 },
      { ch: '#', index: 3 }
    ])
    expect(initialsOf('Ada King Lovelace')).toBe('AL')
    expect(initialsOf('')).toBe('?')
  })
})

describe('codex display helpers', () => {
  it('prints dates by precision', () => {
    expect(prettyDate(null)).toBe('')
    expect(prettyDate({ year: 1950, precision: 'year' })).toBe('1950')
    expect(prettyDate({ year: 1950, month: 6, precision: 'month' })).toBe('Jun 1950')
    expect(prettyDate({ year: 1950, month: 6, day: 12, precision: 'day' })).toBe('12 Jun 1950')
    expect(prettyDate({ year: -300, precision: 'year' })).toBe('300 BCE')
  })

  it('rounds the lifespan scale to tidy ticks', () => {
    const s = lifespanScale(87)
    expect(s.max).toBe(90)
    expect(s.ticks[0]).toBe(0)
    expect(s.ticks[s.ticks.length - 1]).toBe(s.max)
    expect(s.ticks.length).toBeLessThanOrEqual(11)
    expect(lifespanScale(0).max).toBeGreaterThanOrEqual(10)
    expect(lifespanScale(950).ticks.length).toBeLessThanOrEqual(11)
  })

  it('draws a closed scalloped seal and hashes stably', () => {
    const d = sealPath(50, 50, 40, 12)
    expect(d.startsWith('M')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    expect(hashOf('abc')).toBe(hashOf('abc'))
    expect(hashOf('abc')).not.toBe(hashOf('abd'))
    expect(hashOf('abc')).toBeGreaterThanOrEqual(0)
  })
})

describe('kinshipOf', () => {
  const roles = { parent_child: 'vertical', adopted: 'vertical', spouse: 'horizontal' }
  const defs = {
    mentor: { label: 'Mentor / Student', directed: true, role_a: 'Mentor', role_b: 'Student' },
    rival: { label: 'Rival', directed: false, role_a: '', role_b: '', color: '#f00' }
  }
  const roleOf = (t) => roles[t] || 'none'
  const defOf = (t) => defs[t]
  const rel = (a, b, type, extra = {}) => ({ person_a_id: a, person_b_id: b, type, ...extra })
  const rels = [
    rel('mom', 'me', 'parent_child'),
    rel('dad', 'me', 'parent_child'),
    rel('mom', 'sis', 'parent_child'),
    rel('dad', 'sis', 'parent_child'),
    rel('dad', 'half', 'adopted'),
    rel('me', 'kid', 'parent_child'),
    rel('me', 'wife', 'spouse'),
    rel('me', 'pupil', 'mentor'),
    rel('sage', 'me', 'mentor'),
    rel('foe', 'me', 'rival'),
    rel('foe', 'me', 'rival'), // duplicate row
    rel('x', 'y', 'spouse') // unrelated
  ]

  it('groups parents, children, partners and derived siblings', () => {
    const k = kinshipOf('me', rels, roleOf, defOf)
    expect(k.parents.sort()).toEqual(['dad', 'mom'])
    expect(k.children).toEqual(['kid'])
    expect(k.partners).toEqual(['wife'])
    expect(k.siblings.sort()).toEqual(['half', 'sis'])
  })

  it('labels other bonds by the other end role, de-duplicated', () => {
    const k = kinshipOf('me', rels, roleOf, defOf)
    const by = Object.fromEntries(k.others.map((o) => [o.id, o.label]))
    expect(by.pupil).toBe('Student')
    expect(by.sage).toBe('Mentor')
    expect(by.foe).toBe('Rival')
    expect(k.others.filter((o) => o.id === 'foe')).toHaveLength(1)
  })

  it('is empty for unknown people and bad input', () => {
    expect(kinshipOf('nobody', rels, roleOf, defOf).parents).toEqual([])
    expect(kinshipOf('me', null, roleOf).others).toEqual([])
  })
})

describe('turnKeyframes', () => {
  it('turns forward from flat to edge-on, and back from edge-on to flat', () => {
    const f = turnKeyframes('fwd', 10)
    expect(f.leaf[0].transform).toBe('rotateY(0.00deg)')
    expect(f.leaf[f.leaf.length - 1].transform).toBe('rotateY(-90.00deg)')
    const b = turnKeyframes('back', 10)
    expect(b.leaf[0].transform).toBe('rotateY(-90.00deg)')
    expect(b.leaf[b.leaf.length - 1].transform).toBe('rotateY(0.00deg)')
  })

  it('keeps offsets monotone and the shadow on the free edge', () => {
    const f = turnKeyframes('fwd', 12)
    for (let i = 1; i < f.leaf.length; i++) {
      expect(f.leaf[i].offset).toBeGreaterThan(f.leaf[i - 1].offset)
      const a = parseFloat(f.leaf[i].transform.slice(8))
      const prev = parseFloat(f.leaf[i - 1].transform.slice(8))
      expect(a).toBeLessThanOrEqual(prev) // always turning further away
    }
    expect(f.shadow[0].transform).toBe('translateX(100.00%)')
    expect(f.shadow[0].opacity).toBe(0)
    expect(f.shadow[f.shadow.length - 1].transform).toBe('translateX(0.00%)')
    expect(f.shade[f.shade.length - 1].opacity).toBeCloseTo(0.55)
  })
})
