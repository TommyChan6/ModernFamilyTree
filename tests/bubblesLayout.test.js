import { describe, it, expect } from 'vitest'
import {
  radiiFor,
  groupPersons,
  familyComponents,
  packLayout,
  viewToTransform,
  fitView,
  circleOnScreen,
  tierOf,
  springEasing,
  R_MAX,
  R_MIN,
  R_EQUAL
} from '../src/renderer/src/components/people/bubblesLayout.js'

const mk = (i, extra = {}) => ({
  id: 'p' + i,
  name: extra.name || 'Person ' + i,
  gender: i % 3 === 0 ? 'male' : i % 3 === 1 ? 'female' : '',
  birth: { year: 1900 + ((i * 7) % 90) },
  death: i % 4 === 0 ? { year: 1990 } : null,
  ...extra
})
const people = Array.from({ length: 60 }, (_, i) => mk(i))
const statsOf = (id) => {
  const n = Number(id.slice(1))
  return { kin: n % 9, children: n % 4 }
}
const colors = { male: '#00f', female: '#f0f', unknown: '#888' }

function assertPacked(layout, groups) {
  const EPS = 1e-6
  // No two bubbles overlap anywhere.
  const nodes = [...layout.nodes.values()]
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]
      const b = nodes[j]
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r - EPS)
    }
  }
  // Every bubble lies inside its group circle; group circles don't overlap and
  // sit inside the root.
  for (const n of nodes) {
    const g = layout.groups[n.gi]
    if (g) expect(Math.hypot(n.x - g.x, n.y - g.y) + n.r).toBeLessThanOrEqual(g.r + EPS)
    expect(Math.hypot(n.x - layout.root.x, n.y - layout.root.y) + n.r).toBeLessThanOrEqual(
      layout.root.r + EPS
    )
  }
  for (let i = 0; i < layout.groups.length; i++) {
    const a = layout.groups[i]
    expect(Math.hypot(a.x - layout.root.x, a.y - layout.root.y) + a.r).toBeLessThanOrEqual(
      layout.root.r + EPS
    )
    for (let j = i + 1; j < layout.groups.length; j++) {
      const b = layout.groups[j]
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r - EPS)
    }
  }
  const total = groups.reduce((s, g) => s + g.members.length, 0)
  expect(layout.nodes.size).toBe(total)
}

describe('bubblesLayout radii', () => {
  it('maps the max value to R_MAX, floors at R_MIN, area ∝ value + 1', () => {
    const r = radiiFor(people, 'kin', statsOf, 2000)
    const rs = [...r.values()]
    expect(Math.max(...rs)).toBeCloseTo(R_MAX)
    expect(Math.min(...rs)).toBeGreaterThanOrEqual(R_MIN)
    // kin 8 vs kin 3: (9 / 4) area ratio
    expect((r.get('p8') / r.get('p3')) ** 2).toBeCloseTo(9 / 4)
  })
  it('equal mode gives everyone the same radius', () => {
    const r = radiiFor(people, 'equal', statsOf, 2000)
    expect(new Set(r.values())).toEqual(new Set([R_EQUAL]))
  })
})

describe('bubblesLayout grouping', () => {
  it('groups by gender in a fixed order', () => {
    const g = groupPersons(people, 'gender', { colors })
    expect(g.map((x) => x.key)).toEqual(['female', 'male', 'other'])
    expect(g[1].color).toBe('#00f')
    expect(g.reduce((s, x) => s + x.members.length, 0)).toBe(people.length)
  })
  it('groups by decade ascending with unknown last', () => {
    const list = [...people, mk(99, { birth: null })]
    const g = groupPersons(list, 'decade', {})
    const keys = g.map((x) => x.key)
    expect(keys[keys.length - 1]).toBe('none')
    const decs = g.slice(0, -1).map((x) => Number(x.key.slice(1)))
    expect([...decs].sort((a, b) => a - b)).toEqual(decs)
    expect(g[0].label).toMatch(/^\d+s$/)
  })
  it('groups by life status against the reference year', () => {
    const g = groupPersons(people, 'life', { refYear: 2000 })
    const dead = g.find((x) => x.key === 'dead').members
    expect(dead.every((p) => p.death)).toBe(true)
    const g2 = groupPersons(people, 'life', { refYear: 1950 })
    expect(g2.find((x) => x.key === 'dead')).toBeUndefined()
  })
  it('groups by first tag, untagged last', () => {
    const tagsOf = new Map([
      ['p1', [{ id: 'a', label: 'Alpha', color: '#f00' }]],
      [
        'p2',
        [
          { id: 'a', label: 'Alpha', color: '#f00' },
          { id: 'b', label: 'Beta' }
        ]
      ],
      ['p3', [{ id: 'b', label: 'Beta' }]]
    ])
    const g = groupPersons(people.slice(0, 5), 'tag', { tagsOf })
    expect(g.map((x) => x.key)).toEqual(['ta', 'tb', 'none'])
    expect(g[0].members.map((p) => p.id)).toEqual(['p1', 'p2'])
  })
  it('finds family components, lumps singletons, names by surname', () => {
    const ps = [
      mk(1, { name: 'Ann Stark' }),
      mk(2, { name: 'Bob Stark' }),
      mk(3, { name: 'Cy Lannister' }),
      mk(4, { name: 'Dee Lannister' }),
      mk(5, { name: 'Eve Lannister' }),
      mk(6, { name: 'Loner' })
    ]
    const rels = [
      { person_a_id: 'p1', person_b_id: 'p2' },
      { person_a_id: 'p3', person_b_id: 'p4' },
      { person_a_id: 'p4', person_b_id: 'p5' },
      { person_a_id: 'p5', person_b_id: 'ghost' } // outside the roster: ignored
    ]
    const comp = familyComponents(ps, rels)
    expect(comp.get('p3')).toBe(comp.get('p5'))
    expect(comp.get('p1')).not.toBe(comp.get('p3'))
    const g = groupPersons(ps, 'family', { relationships: rels })
    expect(g.map((x) => x.label)).toEqual(['Lannister family', 'Stark family', 'Unconnected'])
    expect(g[2].members.map((p) => p.id)).toEqual(['p6'])
  })
})

describe('bubblesLayout packing', () => {
  for (const [groupMode, sizeMode] of [
    ['gender', 'kin'],
    ['decade', 'age'],
    ['life', 'children'],
    ['none', 'equal']
  ]) {
    it(`packs without overlaps (${groupMode} / ${sizeMode})`, () => {
      const groups = groupPersons(people, groupMode, { colors, refYear: 2000 })
      const radii = radiiFor(people, sizeMode, statsOf, 2000)
      const layout = packLayout(groups, radii)
      assertPacked(layout, groups)
      if (groupMode === 'none') expect(layout.groups).toEqual([])
      else expect(layout.groups.length).toBe(groups.length)
    })
  }
  it('is independent of the input order', () => {
    const groups = groupPersons(people, 'gender', { colors })
    const radii = radiiFor(people, 'kin', statsOf, 2000)
    const a = packLayout(groups, radii)
    const rev = groupPersons([...people].reverse(), 'gender', { colors })
    const b = packLayout(rev, radii)
    for (const [id, n] of a.nodes) {
      expect(b.nodes.get(id).x).toBeCloseTo(n.x)
      expect(b.nodes.get(id).y).toBeCloseTo(n.y)
    }
  })
  it('handles one person and an empty roster', () => {
    const one = packLayout(groupPersons([people[0]], 'gender', { colors }), new Map())
    expect(one.nodes.size).toBe(1)
    const none = packLayout(groupPersons([], 'gender', { colors }), new Map())
    expect(none.nodes.size).toBe(0)
  })
})

describe('bubblesLayout camera', () => {
  it('fits a circle inside the viewport with margin', () => {
    const v = fitView({ x: 10, y: -20, r: 100 }, 800, 600, 50)
    const t = viewToTransform(v, 800, 600)
    expect(10 * t.k + t.tx).toBeCloseTo(400)
    expect(-20 * t.k + t.ty).toBeCloseTo(300)
    expect(200 * t.k).toBeCloseTo(500) // 600 − 2·50
  })
  it('culls circles off screen', () => {
    const t = { k: 1, tx: 0, ty: 0 }
    expect(circleOnScreen(50, 50, 10, t, 100, 100)).toBe(true)
    expect(circleOnScreen(-30, 50, 10, t, 100, 100)).toBe(false)
    expect(circleOnScreen(-30, 50, 10, t, 100, 100, 25)).toBe(true)
  })
  it('picks LOD tiers by on-screen diameter', () => {
    expect(tierOf(8)).toBe('dot')
    expect(tierOf(30)).toBe('sm')
    expect(tierOf(80)).toBe('md')
    expect(tierOf(300)).toBe('lg')
  })
  it('builds a spring easing that starts at 0, overshoots and ends at 1', () => {
    const s = springEasing()
    const vals = s.slice(7, -1).split(', ').map(Number)
    expect(vals[0]).toBe(0)
    expect(vals[vals.length - 1]).toBe(1)
    expect(Math.max(...vals)).toBeGreaterThan(1)
  })
})
