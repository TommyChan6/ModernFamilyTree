import { describe, it, expect } from 'vitest'
import {
  hashUnit,
  computePivot2D,
  seedPositions3D,
  to2DPosition,
  generationLevels,
  layeredTargets,
  boundingSphere3D,
  fitDistance,
  starfieldPositions
} from '../src/renderer/src/components/graph/graph3d/layout3D.js'

const yr = (year) => ({ year, month: null, day: null, precision: 'year', calendar: 'gregorian' })

// A small three-generation family: grandpa+grandma → dad; dad+mom → kid
const persons = [
  { id: 'grandpa', gender: 'male', birth: yr(1930) },
  { id: 'grandma', gender: 'female', birth: yr(1932) },
  { id: 'dad', gender: 'male', birth: yr(1960) },
  { id: 'mom', gender: 'female', birth: yr(1962) },
  { id: 'kid', gender: 'female', birth: yr(1990) }
]
const relationships = [
  { type: 'spouse', person_a_id: 'grandpa', person_b_id: 'grandma' },
  { type: 'parent_child', person_a_id: 'grandpa', person_b_id: 'dad' },
  { type: 'parent_child', person_a_id: 'grandma', person_b_id: 'dad' },
  { type: 'spouse', person_a_id: 'dad', person_b_id: 'mom' },
  { type: 'parent_child', person_a_id: 'dad', person_b_id: 'kid' },
  { type: 'parent_child', person_a_id: 'mom', person_b_id: 'kid' }
]

describe('hashUnit', () => {
  it('is deterministic and within [-1, 1)', () => {
    expect(hashUnit('abc')).toBe(hashUnit('abc'))
    for (const id of ['a', 'b', 'longer-id-123', '']) {
      const v = hashUnit(id)
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThan(1)
    }
  })

  it('spreads different ids apart', () => {
    expect(hashUnit('person-1')).not.toBe(hashUnit('person-2'))
  })
})

describe('computePivot2D', () => {
  it('returns the centre of the 2D extent, preferring saved positions', () => {
    const nodes = [{ id: 'a', x: 999, y: 999 }, { id: 'b' }]
    const saved = { a: { x: 0, y: 0 }, b: { x: 100, y: 50 } }
    expect(computePivot2D(nodes, saved)).toEqual({ x: 50, y: 25 })
  })

  it('falls back to live node positions and to the origin when empty', () => {
    expect(computePivot2D([{ id: 'a', x: 10, y: 20 }], {})).toEqual({ x: 10, y: 20 })
    expect(computePivot2D([], {})).toEqual({ x: 0, y: 0 })
  })
})

describe('seedPositions3D / to2DPosition', () => {
  it('carries a 2D arrangement over with the y axis flipped around the pivot', () => {
    const nodes = [{ id: 'a' }]
    const saved = { a: { x: 130, y: 80 } }
    const pivot = { x: 100, y: 100 }
    const p = seedPositions3D(nodes, saved, { pivot })
    expect(p.a.x).toBe(30)
    expect(p.a.y).toBe(20) // y-down 80 is ABOVE the pivot → positive y-up
    expect(typeof p.a.z).toBe('number')
  })

  it('keeps a saved z and seeds a deterministic one otherwise', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }]
    const saved = { a: { x: 0, y: 0, z: 42 } }
    const p1 = seedPositions3D(nodes, saved, { pivot: { x: 0, y: 0 } })
    const p2 = seedPositions3D(nodes, saved, { pivot: { x: 0, y: 0 } })
    expect(p1.a.z).toBe(42)
    expect(p1.b.z).toBe(p2.b.z)
    expect(Math.abs(p1.b.z)).toBeLessThanOrEqual(260)
  })

  it('round-trips through to2DPosition', () => {
    const nodes = [{ id: 'a' }]
    const saved = { a: { x: 130, y: 80, z: -12 } }
    const pivot = { x: 100, y: 100 }
    const p = seedPositions3D(nodes, saved, { pivot })
    expect(to2DPosition(p.a, pivot)).toEqual({ x: 130, y: 80, z: -12 })
  })
})

describe('generationLevels', () => {
  it('puts parents above children and spouses on the same level', () => {
    const { levelOf, rowCount } = generationLevels(persons, relationships)
    expect(rowCount).toBe(3)
    expect(levelOf.grandpa).toBe(0)
    expect(levelOf.grandma).toBe(0)
    expect(levelOf.dad).toBe(1)
    expect(levelOf.mom).toBe(1)
    expect(levelOf.kid).toBe(2)
  })
})

describe('layeredTargets', () => {
  it('stacks generations oldest-on-top, centred on y=0', () => {
    const { yOf, layers } = layeredTargets(persons, relationships, 100)
    expect(layers).toHaveLength(3)
    expect(yOf.grandpa).toBe(100) // oldest on top (+y is up)
    expect(yOf.dad).toBe(0)
    expect(yOf.kid).toBe(-100)
    expect(layers.map((l) => l.label)).toEqual(['Gen 1', 'Gen 2', 'Gen 3'])
    expect(layers[0].y).toBe(100)
  })
})

describe('boundingSphere3D', () => {
  it('contains every node and is null when empty', () => {
    expect(boundingSphere3D([])).toBeNull()
    const nodes = [
      { x: 0, y: 0, z: 0 },
      { x: 100, y: 0, z: 0 },
      { x: 50, y: 80, z: -60 }
    ]
    const s = boundingSphere3D(nodes)
    for (const n of nodes) {
      const d = Math.hypot(n.x - s.x, n.y - s.y, (n.z || 0) - s.z)
      expect(d).toBeLessThanOrEqual(s.r + 1e-9)
    }
  })

  it('treats a missing z as 0', () => {
    const s = boundingSphere3D([{ x: 0, y: 0 }])
    expect(s.z).toBe(0)
    expect(s.r).toBe(0)
  })
})

describe('fitDistance', () => {
  it('frames the sphere: half-angle covers the radius at that distance', () => {
    const fov = 50
    const d = fitDistance(100, fov, 1.5, 1)
    // sin(fov/2) * d should equal the radius on the narrower (vertical) axis
    expect(Math.sin(((fov / 2) * Math.PI) / 180) * d).toBeCloseTo(100, 6)
  })

  it('uses the narrower horizontal axis for tall viewports', () => {
    const wide = fitDistance(100, 50, 2)
    const tall = fitDistance(100, 50, 0.5)
    expect(tall).toBeGreaterThan(wide)
  })
})

describe('starfieldPositions', () => {
  it('is deterministic and stays within the shell', () => {
    const a = starfieldPositions(50, 100, 200, 7)
    const b = starfieldPositions(50, 100, 200, 7)
    expect(a.positions).toEqual(b.positions)
    expect(a.positions).toHaveLength(150)
    for (let i = 0; i < 50; i++) {
      const r = Math.hypot(a.positions[i * 3], a.positions[i * 3 + 1], a.positions[i * 3 + 2])
      expect(r).toBeGreaterThanOrEqual(100 - 1e-9)
      expect(r).toBeLessThanOrEqual(200 + 1e-9)
    }
  })
})
