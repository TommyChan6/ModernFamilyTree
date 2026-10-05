import { describe, it, expect } from 'vitest'
import {
  autoLayout,
  rotationOf,
  rand01,
  yarnPath,
  yarnBox,
  sagOf,
  worldRect,
  rectsOverlap,
  rectContains,
  polaroidInRect,
  boundsOf,
  fitCamera,
  zoomAt,
  markerPath,
  sanitizePositions,
  POL_W,
  POL_H
} from '../src/renderer/src/components/people/boardLayout.js'

const roles = new Map([
  ['parent_child', 'vertical'],
  ['spouse', 'horizontal'],
  ['friends', 'none']
])
const people = (ids) => ids.map((id) => ({ id }))
const rel = (a, b, type) => ({ person_a_id: a, person_b_id: b, type })

describe('seeded randomness', () => {
  it('is stable per id and within range', () => {
    expect(rand01('abc')).toBe(rand01('abc'))
    expect(rand01('abc')).not.toBe(rand01('abd'))
    for (const id of ['a', 'b', 'Test 1', 'Test 2', 'x-y-z']) {
      const r = rotationOf(id)
      expect(r).toBe(rotationOf(id))
      expect(Math.abs(r)).toBeGreaterThanOrEqual(0.8)
      expect(Math.abs(r)).toBeLessThanOrEqual(6)
    }
  })
})

describe('autoLayout', () => {
  const ps = people(['gp', 'gm', 'dad', 'mum', 'kid1', 'kid2', 'loner1', 'loner2'])
  const rels = [
    rel('gp', 'gm', 'spouse'),
    rel('gp', 'dad', 'parent_child'),
    rel('gm', 'dad', 'parent_child'),
    rel('dad', 'mum', 'spouse'),
    rel('dad', 'kid1', 'parent_child'),
    rel('mum', 'kid1', 'parent_child'),
    rel('dad', 'kid2', 'parent_child'),
    rel('kid1', 'loner1', 'friends') // 'none' role doesn't cluster
  ]

  it('places everyone, deterministically', () => {
    const a = autoLayout(ps, rels, roles)
    const b = autoLayout(ps, rels, roles)
    expect(a.size).toBe(ps.length)
    for (const p of ps) expect(a.get(p.id)).toEqual(b.get(p.id))
  })

  it('puts parents above children and couples on one row', () => {
    const pos = autoLayout(ps, rels, roles, { jitter: false })
    expect(pos.get('gp').y).toBeLessThan(pos.get('dad').y)
    expect(pos.get('dad').y).toBeLessThan(pos.get('kid1').y)
    expect(pos.get('dad').y).toBe(pos.get('mum').y) // married-in partner shares the row
    expect(pos.get('gp').y).toBe(pos.get('gm').y)
    expect(pos.get('kid1').y).toBe(pos.get('kid2').y)
  })

  it('accepts a plain-object role map', () => {
    const pos = autoLayout(ps, rels, Object.fromEntries(roles), { jitter: false })
    expect(pos.get('gp').y).toBeLessThan(pos.get('kid1').y)
  })

  it('never overlaps polaroids (jitter included)', () => {
    const many = people(Array.from({ length: 120 }, (_, i) => 'p' + i))
    const r = []
    for (let i = 1; i < 60; i++) r.push(rel('p' + Math.floor((i - 1) / 2), 'p' + i, 'parent_child'))
    const pos = [...autoLayout(many, r, roles).values()]
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const ox = Math.abs(pos[i].x - pos[j].x) < POL_W
        const oy = Math.abs(pos[i].y - pos[j].y) < POL_H
        expect(ox && oy).toBe(false)
      }
    }
  })

  it('survives cycles and ignores dangling edges', () => {
    const pos = autoLayout(
      people(['a', 'b']),
      [rel('a', 'b', 'parent_child'), rel('b', 'a', 'parent_child'), rel('a', 'zz', 'spouse')],
      roles
    )
    expect(pos.size).toBe(2)
    for (const p of pos.values()) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
  })

  it('handles an empty roster', () => {
    expect(autoLayout([], [], roles).size).toBe(0)
  })
})

describe('yarn', () => {
  it('sags proportionally to length, capped, and tightens under tension', () => {
    expect(sagOf(100)).toBeCloseTo(14)
    expect(sagOf(200)).toBeCloseTo(28)
    expect(sagOf(100000)).toBe(150)
    expect(sagOf(200, 1)).toBeLessThan(sagOf(200, 0))
  })

  it('hangs its midpoint `sag` below the chord', () => {
    const d = yarnPath(0, 0, 200, 0)
    const [, , cy] = d.match(/Q(\S+) (\S+)/).map(Number)
    // quadratic midpoint y = (0 + 2·cy + 0) / 4
    expect(cy / 2).toBeCloseTo(sagOf(200), 1)
    expect(d.startsWith('M0 0Q')).toBe(true)
  })

  it('bounding box covers the droop', () => {
    const b = yarnBox(0, 0, 200, 50)
    expect(b).toEqual({ x0: 0, y0: 0, x1: 200, y1: 50 + sagOf(Math.hypot(200, 50)) })
  })
})

describe('camera + culling', () => {
  it('maps the viewport back into world space', () => {
    const r = worldRect({ x: 100, y: 50, k: 2 }, 800, 600)
    expect(r).toEqual({ x0: -50, y0: -25, x1: 350, y1: 275 })
    const m = worldRect({ x: 0, y: 0, k: 1 }, 100, 100, 20)
    expect(m).toEqual({ x0: -20, y0: -20, x1: 120, y1: 120 })
  })

  it('tests overlap / containment', () => {
    const a = { x0: 0, y0: 0, x1: 10, y1: 10 }
    expect(rectsOverlap(a, { x0: 5, y0: 5, x1: 20, y1: 20 })).toBe(true)
    expect(rectsOverlap(a, { x0: 11, y0: 0, x1: 20, y1: 10 })).toBe(false)
    expect(rectContains(a, { x0: 1, y0: 1, x1: 9, y1: 9 })).toBe(true)
    expect(rectContains(a, { x0: 1, y0: 1, x1: 11, y1: 9 })).toBe(false)
    expect(polaroidInRect(-POL_W / 2 - 10, 0, a, 0)).toBe(false)
    expect(polaroidInRect(-POL_W / 2 + 10, 0, a, 0)).toBe(true)
  })

  it('fits bounds into the viewport', () => {
    const b = boundsOf([
      { x: 0, y: 0 },
      { x: 1000, y: 500 }
    ])
    expect(b).toEqual({ x0: -POL_W / 2, y0: -POL_H / 2, x1: 1000 + POL_W / 2, y1: 500 + POL_H / 2 })
    const cam = fitCamera(b, 800, 600, 40)
    const r = worldRect(cam, 800, 600)
    expect(rectContains(r, b)).toBe(true)
    expect(boundsOf([])).toBe(null)
  })

  it('zooms around the cursor', () => {
    const cam = { x: 30, y: -20, k: 1 }
    const z = zoomAt(cam, 400, 300, 2)
    expect(z.k).toBe(2)
    // same world point stays under the cursor
    expect((400 - cam.x) / cam.k).toBeCloseTo((400 - z.x) / z.k)
    expect((300 - cam.y) / cam.k).toBeCloseTo((300 - z.y) / z.k)
    expect(zoomAt(cam, 0, 0, 999).k).toBeLessThan(10)
  })
})

describe('markerPath + sanitizePositions', () => {
  it('draws a deterministic overshooting loop', () => {
    const d = markerPath(100, 100, 80, 90, 'id1')
    expect(d).toBe(markerPath(100, 100, 80, 90, 'id1'))
    expect(d.startsWith('M')).toBe(true)
    expect(d.split('L').length).toBe(45)
  })

  it('drops malformed saved positions', () => {
    expect(
      sanitizePositions({
        a: { x: 1, y: 2 },
        b: { x: 'no', y: 2 },
        c: null,
        d: { x: 1, y: 2, z: 5 }
      })
    ).toEqual({ a: { x: 1, y: 2, z: 0 }, d: { x: 1, y: 2, z: 5 } })
    expect(sanitizePositions('junk')).toEqual({})
  })
})
