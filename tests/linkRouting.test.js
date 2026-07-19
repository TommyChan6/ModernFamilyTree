import { describe, it, expect } from 'vitest'
import {
  stampFamilyContext,
  routePoints
} from '../src/renderer/src/components/graph/linkRouting.js'

// Minimal wired-link factory: source/target are node objects (as after d3's
// forceLink resolves ids), with the fields the router reads.
function node(id, x, y) {
  return { id, x, y }
}
function link(id, type, source, target) {
  return { id, type, source, target }
}

const ROLES = new Map([
  ['parent_child', 'vertical'],
  ['adopted', 'vertical'],
  ['spouse', 'horizontal'],
  ['friends', 'none']
])

function family() {
  // Dad + Mum → two kids; dad & mum married; kids are friends with each other.
  const dad = node('dad', 100, 0)
  const mum = node('mum', 200, 10)
  const kid1 = node('kid1', 80, 200)
  const kid2 = node('kid2', 220, 240)
  const links = [
    link('m', 'spouse', dad, mum),
    link('d1', 'parent_child', dad, kid1),
    link('m1', 'parent_child', mum, kid1),
    link('d2', 'parent_child', dad, kid2),
    link('m2', 'parent_child', mum, kid2),
    link('f', 'friends', kid1, kid2)
  ]
  return { dad, mum, kid1, kid2, links }
}

describe('stampFamilyContext', () => {
  it('stamps symmetry roles onto every edge', () => {
    const { links } = family()
    stampFamilyContext(links, ROLES)
    expect(links.find((l) => l.id === 'm')._role).toBe('h')
    expect(links.find((l) => l.id === 'd1')._role).toBe('v')
    expect(links.find((l) => l.id === 'f')._role).toBe('n')
  })

  it('shares one family object across the whole sibling group', () => {
    const { links } = family()
    stampFamilyContext(links, ROLES)
    const fams = ['d1', 'm1', 'd2', 'm2'].map((id) => links.find((l) => l.id === id)._fam)
    expect(fams[0]).toBe(fams[1])
    expect(fams[0]).toBe(fams[2])
    expect(fams[0]).toBe(fams[3])
    expect(fams[0].parents.map((p) => p.id).sort()).toEqual(['dad', 'mum'])
    expect(fams[0].children.map((c) => c.id).sort()).toEqual(['kid1', 'kid2'])
  })

  it('falls back to builtin roles when the registry map is empty', () => {
    const { links } = family()
    stampFamilyContext(links, new Map())
    expect(links.find((l) => l.id === 'd1')._role).toBe('v')
    expect(links.find((l) => l.id === 'm')._role).toBe('h')
  })

  it('single parents form their own family (junction at the parent)', () => {
    const solo = node('solo', 0, 0)
    const kid = node('kid', 0, 100)
    const links = [link('s1', 'parent_child', solo, kid)]
    stampFamilyContext(links, ROLES)
    expect(links[0]._fam.parents.map((p) => p.id)).toEqual(['solo'])
    expect(links[0]._fam.children.map((c) => c.id)).toEqual(['kid'])
  })
})

describe('routePoints', () => {
  const SEG = 14

  function endpoints(res, d) {
    const first = res.points[0]
    const last = res.points[res.points.length - 1]
    expect(first.x).toBeCloseTo(d.source.x, 0)
    expect(first.y).toBeCloseTo(d.source.y, 0)
    expect(last.x).toBeCloseTo(d.target.x, 0)
    expect(last.y).toBeCloseTo(d.target.y, 0)
  }

  it('every route returns segments+1 points anchored on both endpoints', () => {
    const { links } = family()
    stampFamilyContext(links, ROLES)
    for (const route of ['organic', 'straight', 'arc', 'elbow', 'trident', 'circuit', 'wave']) {
      for (const d of links) {
        const res = routePoints(d, { linkRoute: route, lineCurvature: 0.04 }, SEG)
        expect(res.points).toHaveLength(SEG + 1)
        endpoints(res, d)
        expect(res.control).toBeTruthy()
      }
    }
  })

  it('straight is collinear', () => {
    const { links } = family()
    const d = links.find((l) => l.id === 'f')
    const res = routePoints(d, { linkRoute: 'straight', lineCurvature: 0.04 }, SEG)
    for (const p of res.points) {
      // Cross product of (p - S) × (T - S) ≈ 0 for collinear points.
      const cross =
        (p.x - d.source.x) * (d.target.y - d.source.y) -
        (p.y - d.source.y) * (d.target.x - d.source.x)
      expect(Math.abs(cross)).toBeLessThan(1e-6)
    }
  })

  it('trident: sibling edges share the same rail height', () => {
    const { links } = family()
    stampFamilyContext(links, ROLES)
    const gs = { linkRoute: 'trident', lineCurvature: 0.04 }
    const railYOf = (id) => {
      const d = links.find((l) => l.id === id)
      const res = routePoints(d, gs, SEG)
      // The rail is the horizontal run: find the sample farthest into the
      // path that shares y with its neighbour (flat segment).
      let best = null
      for (let i = 3; i < res.points.length - 3; i++) {
        if (Math.abs(res.points[i].y - res.points[i + 1].y) < 0.5) best = res.points[i].y
      }
      return best
    }
    const r1 = railYOf('d1')
    const r2 = railYOf('d2')
    expect(r1).not.toBeNull()
    expect(r2).not.toBeNull()
    expect(Math.abs(r1 - r2)).toBeLessThan(2)
  })

  it('trident: the rail sits between the couple and the children', () => {
    const { links, dad, mum, kid1 } = family()
    stampFamilyContext(links, ROLES)
    const d = links.find((l) => l.id === 'd1')
    const res = routePoints(d, { linkRoute: 'trident', lineCurvature: 0 }, SEG)
    const junctionY = (dad.y + mum.y) / 2
    for (const p of res.points) {
      expect(p.y).toBeGreaterThanOrEqual(junctionY - 26) // small fillet slack
      expect(p.y).toBeLessThanOrEqual(Math.max(kid1.y, junctionY) + 26)
    }
  })

  it('trident: the couple bar stays straight and affinity edges stay curved', () => {
    const { links } = family()
    stampFamilyContext(links, ROLES)
    const gs = { linkRoute: 'trident', lineCurvature: 0 }
    const bar = routePoints(
      links.find((l) => l.id === 'm'),
      gs,
      SEG
    )
    // Straight bar: midpoint sits on the segment between the endpoints.
    const mid = bar.points[7]
    expect(mid.y).toBeCloseTo(5, 0)
    const friend = routePoints(
      links.find((l) => l.id === 'f'),
      gs,
      SEG
    )
    // Curved overlay: at least one sample leaves the straight line.
    const d = links.find((l) => l.id === 'f')
    const off = friend.points.some((p) => {
      const cross =
        (p.x - d.source.x) * (d.target.y - d.source.y) -
        (p.y - d.source.y) * (d.target.x - d.source.x)
      return Math.abs(cross) > 100
    })
    expect(off).toBe(true)
  })

  it('elbow: vertical edges run through the mid-height shelf', () => {
    const { links } = family()
    stampFamilyContext(links, ROLES)
    const d = links.find((l) => l.id === 'd1') // dad(100,0) → kid1(80,200)
    const res = routePoints(d, { linkRoute: 'elbow', lineCurvature: 0 }, SEG)
    const midY = (d.source.y + d.target.y) / 2
    // Some interior sample rides the horizontal shelf at midY.
    expect(res.points.some((p) => Math.abs(p.y - midY) < 1)).toBe(true)
  })

  it('circuit: contains a 45° chamfer', () => {
    const { links } = family()
    stampFamilyContext(links, ROLES)
    const d = links.find((l) => l.id === 'f') // kid1(80,200) → kid2(220,240)
    const res = routePoints(d, { linkRoute: 'circuit', lineCurvature: 0 }, SEG)
    let found = false
    for (let i = 0; i < res.points.length - 1; i++) {
      const dx = res.points[i + 1].x - res.points[i].x
      const dy = res.points[i + 1].y - res.points[i].y
      if (Math.abs(dx) > 0.5 && Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.25) found = true
    }
    expect(found).toBe(true)
  })

  it('unstamped links (no family context) never crash geometric routes', () => {
    const a = node('a', 0, 0)
    const b = node('b', 50, 50)
    const d = link('x', 'parent_child', a, b)
    for (const route of ['trident', 'elbow', 'circuit', 'wave']) {
      const res = routePoints(d, { linkRoute: route, lineCurvature: 0.04 }, SEG)
      expect(res.points).toHaveLength(SEG + 1)
    }
  })
})
