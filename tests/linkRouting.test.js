import { describe, it, expect } from 'vitest'
import {
  stampFamilyContext,
  routePoints,
  bezierControls,
  toCurveFrame,
  fromCurveFrame,
  cubicAt,
  nearestCurveT,
  bendCurveAt
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
    for (const route of [
      'organic',
      'straight',
      'arc',
      'elbow',
      'trident',
      'circuit',
      'wave',
      'bezier'
    ]) {
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

  it('trident: corners are rounded, never sharp kinks', () => {
    const { links } = family()
    stampFamilyContext(links, ROLES)
    const gs = { linkRoute: 'trident', lineCurvature: 0 }
    for (const id of ['d1', 'm1', 'd2', 'm2']) {
      const res = routePoints(
        links.find((l) => l.id === id),
        gs,
        18
      )
      let maxTurn = 0
      for (let i = 1; i < res.points.length - 1; i++) {
        const a = res.points[i - 1],
          b = res.points[i],
          c = res.points[i + 1]
        const ux = b.x - a.x,
          uy = b.y - a.y,
          vx = c.x - b.x,
          vy = c.y - b.y
        const cos = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy))
        maxTurn = Math.max(maxTurn, Math.acos(Math.max(-1, Math.min(1, cos))))
      }
      // Each 90° bend is spread over several samples (< 35° per step).
      expect(maxTurn).toBeLessThan((35 * Math.PI) / 180)
    }
  })

  it('trident: a short sibling rail becomes one smooth S-sweep', () => {
    const dad = node('dad', 0, 0)
    const mum = node('mum', 100, 0)
    const kid = node('kid', 58, 200) // 8px off the junction → tiny rail
    const links = [
      link('m', 'spouse', dad, mum),
      link('d', 'parent_child', dad, kid),
      link('u', 'parent_child', mum, kid)
    ]
    stampFamilyContext(links, ROLES)
    const res = routePoints(links[1], { linkRoute: 'trident', lineCurvature: 0 }, 18)
    // The lateral jog is spread vertically well beyond the 8px rail itself.
    const jog = res.points.filter((p) => p.x > 50.5 && p.x < 57.5)
    const span = Math.max(...jog.map((p) => p.y)) - Math.min(...jog.map((p) => p.y))
    expect(span).toBeGreaterThan(20)
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
    for (const route of ['trident', 'elbow', 'circuit', 'wave', 'bezier']) {
      const res = routePoints(d, { linkRoute: route, lineCurvature: 0.04 }, SEG)
      expect(res.points).toHaveLength(SEG + 1)
    }
  })
})

describe('bezier route', () => {
  const gs = { linkRoute: 'bezier', lineCurvature: 0 }

  it('chord-frame coords round-trip', () => {
    const S = { x: 10, y: 20 },
      T = { x: 130, y: -40 }
    for (const p of [
      { x: 0, y: 0 },
      { x: 55, y: 80 },
      { x: -30, y: 12 }
    ]) {
      const back = fromCurveFrame(S, T, toCurveFrame(S, T, p))
      expect(back.x).toBeCloseTo(p.x, 6)
      expect(back.y).toBeCloseTo(p.y, 6)
    }
  })

  it('parent → child defaults to the vertical tree swoop', () => {
    const { links } = family()
    stampFamilyContext(links, ROLES)
    const d = links.find((l) => l.id === 'd1') // dad(100,0) → kid1(80,200)
    const { c1, c2 } = bezierControls(d)
    expect(c1.x).toBeCloseTo(100) // leaves straight down…
    expect(c2.x).toBeCloseTo(80) // …arrives straight down
    expect(c1.y).toBeGreaterThan(0)
    expect(c2.y).toBeLessThan(200)
  })

  it('a hand-shaped curve rides along when its people move', () => {
    const a = node('a', 0, 0)
    const b = node('b', 100, 0)
    const d = { ...link('x', 'friends', a, b), _curve: { a: [0.25, 0.5], b: [0.75, 0.5] } }
    const before = bezierControls(d)
    expect(before.c1).toEqual({ x: 25, y: 50 })
    // Move the whole pair and double the distance: the curve scales along.
    a.x = 100
    b.x = 300
    const after = bezierControls(d)
    expect(after.c1.x).toBeCloseTo(150)
    expect(after.c1.y).toBeCloseTo(100)
    const res = routePoints(d, gs, 18)
    expect(res.points[0]).toEqual({ x: 100, y: 0 })
    expect(res.points[18].x).toBeCloseTo(300)
  })

  it('bending at t moves exactly that point of the curve by the drag', () => {
    const a = node('a', 0, 0)
    const b = node('b', 200, 50)
    const d = link('x', 'friends', a, b)
    const from = bezierControls(d)
    const t = 0.4
    const p0 = cubicAt(a, from.c1, from.c2, b, t)
    const next = bendCurveAt(d, t, { x: 12, y: -30 }, from)
    d._curve = next
    const { c1, c2 } = bezierControls(d)
    const p1 = cubicAt(a, c1, c2, b, t)
    expect(p1.x).toBeCloseTo(p0.x + 12, 6)
    expect(p1.y).toBeCloseTo(p0.y - 30, 6)
  })

  it('nearestCurveT finds the grabbed spot', () => {
    const a = node('a', 0, 0)
    const b = node('b', 300, 0)
    const d = link('x', 'friends', a, b)
    const { c1, c2 } = bezierControls(d)
    const p = cubicAt(a, c1, c2, b, 0.7)
    expect(nearestCurveT(d, p)).toBeCloseTo(0.7, 2)
  })
})
