import { describe, it, expect } from 'vitest'
import { buildFamilies } from '../src/renderer/src/components/timeline/timelineLinks'
import {
  layoutHouseholdRivers,
  pathXAt,
  pathSegments,
  bandAt
} from '../src/renderer/src/components/timeline/householdRivers'
import { computeTimelineLayout } from '../src/renderer/src/components/timeline/timelineLayout.js'
import { yearDate } from '../src/shared/calendarMath'

const life = (id, birthYear, endYear) => ({ id, birthYear, endYear })
const rel = (id, type, a, b) => ({ id, type, person_a_id: a, person_b_id: b })
const kids = (parents, children) =>
  children.flatMap((c) => parents.map((p) => rel(`${p}>${c}`, 'parent_child', p, c)))

function run(people, rels, marriages, opts = {}) {
  const { families, branches } = buildFamilies(people, rels, marriages)
  const rank = new Map(people.map((p, i) => [p.id, i]))
  return layoutHouseholdRivers(people, families, branches, marriages, rank, opts)
}
const xAt = (L, id, y) => pathXAt(L.paths.get(id), y)
const homeAt = (L, id, y) =>
  L.stints.get(id).find((s) => s.from <= y && y < s.to)?.h ?? L.stints.get(id).at(-1).h

describe('household rivers: containment', () => {
  const people = [
    life('dad', 1900, 1970),
    life('mum', 1902, 1980),
    life('a', 1925, 2000),
    life('b', 1928, 2010),
    life('c', 1931, 1990)
  ]
  const marriages = [{ id: 'm', ids: ['dad', 'mum'], year: 1922 }]
  const L = run(people, kids(['dad', 'mum'], ['a', 'b', 'c']), marriages)

  it('puts the couple and their children in one channel', () => {
    const h = L.householdById.get('hm:m')
    expect(h.kind).toBe('couple')
    expect(h.children).toEqual(['a', 'b', 'c'])
    for (const id of ['a', 'b', 'c']) expect(L.stints.get(id)[0].h).toBe('hm:m')
  })

  it('bears each child between its parents', () => {
    for (const [id, y] of [
      ['a', 1925],
      ['b', 1928],
      ['c', 1931]
    ]) {
      const lo = Math.min(xAt(L, 'dad', y), xAt(L, 'mum', y))
      const hi = Math.max(xAt(L, 'dad', y), xAt(L, 'mum', y))
      const x = xAt(L, id, y)
      expect(x).toBeGreaterThan(lo)
      expect(x).toBeLessThan(hi)
    }
  })

  it('widens the channel as it fills and keeps everyone inside its banks', () => {
    const h = L.householdById.get('hm:m')
    const w = (y) => {
      const b = bandAt(h, y)
      return b.right - b.left
    }
    expect(w(1933)).toBeGreaterThan(w(1923))
    for (const y of [1923, 1926.5, 1935, 1945]) {
      const b = bandAt(h, y)
      for (const id of ['dad', 'mum', 'a', 'b', 'c']) {
        if (homeAt(L, id, y) !== h.id) continue
        const x = xAt(L, id, y)
        expect(x).toBeGreaterThanOrEqual(b.left)
        expect(x).toBeLessThanOrEqual(b.right)
      }
    }
  })

  it('emits monotonic polylines from birth to the end of each life', () => {
    for (const p of people) {
      const path = L.paths.get(p.id)
      expect(path[0]).toBe(p.birthYear)
      expect(path.at(-2)).toBe(p.endYear)
      for (let i = 2; i < path.length; i += 2) expect(path[i]).toBeGreaterThanOrEqual(path[i - 2])
      const segs = pathSegments(path)
      expect(segs.length).toBe(path.length / 2 - 1)
      expect(segs[0].y0).toBe(p.birthYear)
    }
  })

  it('sends unmarried adults to a channel of their own at the leaving age', () => {
    const st = L.stints.get('a')
    expect(st).toHaveLength(2)
    expect(st[0].to).toBe(1950)
    expect(st[1].h).toBe('hs:a:0')
    const L2 = run(people, kids(['dad', 'mum'], ['a', 'b', 'c']), marriages, { leaveHomeAge: 18 })
    expect(L2.stints.get('a')[0].to).toBe(1943)
    // the move is a smooth crossing into a different x
    expect(Math.abs(xAt(L, 'a', 1952) - xAt(L, 'a', 1940))).toBeGreaterThan(10)
  })
})

describe('household rivers: marriages', () => {
  const people = [
    life('dad', 1900, 1970),
    life('mum', 1902, 1940),
    life('son', 1925, 2000),
    life('bride', 1927, 2005), // marries in from outside the tree
    life('grand', 1952, 2020),
    life('stepmum', 1910, 1990),
    life('half', 1945, 2015)
  ]
  const rels = [
    ...kids(['dad', 'mum'], ['son']),
    ...kids(['son', 'bride'], ['grand']),
    ...kids(['dad', 'stepmum'], ['half'])
  ]
  const marriages = [
    { id: 'm1', ids: ['dad', 'mum'], year: 1922 },
    { id: 'm2', ids: ['son', 'bride'], year: 1950 },
    { id: 'm3', ids: ['dad', 'stepmum'], year: 1943 }
  ]
  const L = run(people, rels, marriages)

  it('crosses a child into the new household in the year they marry', () => {
    // (at home he followed his widowed father into the step-household)
    expect(homeAt(L, 'son', 1949)).toBe('hm:m3')
    expect(homeAt(L, 'son', 1950)).toBe('hm:m2')
    expect(homeAt(L, 'bride', 1950)).toBe('hm:m2')
    const h = L.householdById.get('hm:m2')
    const b = bandAt(h, 1950)
    for (const id of ['son', 'bride']) {
      expect(xAt(L, id, 1950)).toBeGreaterThanOrEqual(b.left)
      expect(xAt(L, id, 1950)).toBeLessThanOrEqual(b.right)
    }
    const c = L.confluences.get('m2')
    expect(c.year).toBe(1950)
    expect(Math.abs(c.xa - c.xb)).toBeLessThan(80)
  })

  it('starts a founder in a channel of their own', () => {
    expect(L.stints.get('bride')[0].h).toBe('hs:bride:0')
  })

  it('moves a widower on remarriage; the second marriage’s children are born there', () => {
    expect(homeAt(L, 'dad', 1942)).toBe('hm:m1')
    expect(homeAt(L, 'dad', 1944)).toBe('hm:m3')
    expect(L.stints.get('half')[0].h).toBe('hm:m3')
    const lo = Math.min(xAt(L, 'dad', 1945), xAt(L, 'stepmum', 1945))
    const hi = Math.max(xAt(L, 'dad', 1945), xAt(L, 'stepmum', 1945))
    expect(xAt(L, 'half', 1945)).toBeGreaterThan(lo)
    expect(xAt(L, 'half', 1945)).toBeLessThan(hi)
  })

  it('keeps channels alive at the same time apart', () => {
    for (let y = 1900; y <= 2020; y += 3) {
      const bands = L.households
        .map((h) => ({ h, b: bandAt(h, y) }))
        .filter((e) => e.b)
        .sort((p, q) => p.b.left - q.b.left)
      for (let i = 1; i < bands.length; i++) {
        const flows = (g, h) => g.end <= h.start + 1e-6 || h.end <= g.start + 1e-6
        if (flows(bands[i - 1].h, bands[i].h)) continue
        expect(bands[i].b.left).toBeGreaterThanOrEqual(bands[i - 1].b.right - 1e-6)
      }
    }
  })

  it('takes the children along when their last parent at home moves on', () => {
    const ps = [
      life('p', 1900, 1980),
      life('q', 1900, 1930),
      life('kid', 1925, 2000),
      life('r', 1905, 1990)
    ]
    const ms = [
      { id: 'a', ids: ['p', 'q'], year: 1922 },
      { id: 'b', ids: ['p', 'r'], year: 1935 }
    ]
    const L2 = run(ps, kids(['p', 'q'], ['kid']), ms)
    expect(homeAt(L2, 'kid', 1934)).toBe('hm:a')
    expect(homeAt(L2, 'kid', 1936)).toBe('hm:b')
  })

  it('splits a divorce with a recorded year: one spouse leaves, the children stay', () => {
    const ps = [life('p', 1900, 1980), life('q', 1902, 1985), life('kid', 1925, 2000)]
    const ms = [{ id: 'a', ids: ['p', 'q'], year: 1922, endedYear: 1935 }]
    const L2 = run(ps, kids(['p', 'q'], ['kid']), ms)
    const left = ['p', 'q'].filter((id) => homeAt(L2, id, 1936) !== 'hm:a')
    expect(left).toHaveLength(1)
    expect(homeAt(L2, left[0], 1936)).toMatch(/^hs:/)
    expect(homeAt(L2, 'kid', 1936)).toBe('hm:a')
  })
})

describe('household rivers: other families', () => {
  it('bears an adopted child into the adoptive household', () => {
    const ps = [life('p', 1900, 1980), life('q', 1902, 1985), life('kid', 1930, 2000)]
    const rels = [rel('r1', 'adopted', 'p', 'kid'), rel('r2', 'adopted', 'q', 'kid')]
    const L = run(ps, rels, [{ id: 'm', ids: ['p', 'q'], year: 1925 }])
    expect(L.stints.get('kid')[0].h).toBe('hm:m')
  })

  it('gives unmarried co-parents a channel of their own from just before the child', () => {
    const ps = [life('p', 1900, 1980), life('q', 1902, 1985), life('kid', 1930, 2000)]
    const L = run(ps, kids(['p', 'q'], ['kid']), [])
    const h = L.households.find((x) => x.kind === 'coparents')
    expect(h).toBeTruthy()
    expect(h.start).toBe(1929)
    expect(L.stints.get('kid')[0].h).toBe(h.id)
  })

  it('bears a single parent’s child into that parent’s current household', () => {
    const ps = [life('p', 1900, 1980), life('kid', 1930, 2000)]
    const L = run(ps, [rel('r', 'parent_child', 'p', 'kid')], [])
    expect(L.stints.get('kid')[0].h).toBe(L.stints.get('p')[0].h)
    expect(L.stints.get('kid')[1].h).toBe('hs:kid:0')
  })

  it('opens an estimated wedding the year before the first child', () => {
    const ps = [life('p', 1900, 1980), life('q', 1902, 1985), life('kid', 1924, 2000)]
    const L = run(ps, kids(['p', 'q'], ['kid']), [
      { id: 'm', ids: ['p', 'q'], year: 1927, estimated: true }
    ])
    expect(L.householdById.get('hm:m').start).toBe(1923)
    expect(L.confluences.get('m').year).toBe(1923)
  })

  it('survives odd data without throwing', () => {
    const ps = [
      life('a', 1950, 1940), // ends before it starts
      life('b', 1900, 1990),
      life('c', 1890, 1995), // "child" born before its parent
      life('d', 1900, 1900)
    ]
    const rels = [
      rel('x', 'parent_child', 'b', 'c'),
      rel('y', 'parent_child', 'c', 'b'),
      rel('z', 'parent_child', 'a', 'a')
    ]
    const ms = [
      { id: 'm', ids: ['a', 'a'], year: 1960 },
      { id: 'n', ids: ['b', 'c'], year: 1850 },
      { id: 'o', ids: ['b', 'd'], year: Number.NaN }
    ]
    const L = run(ps, rels, ms)
    for (const p of ps) {
      const path = L.paths.get(p.id)
      expect(path.length).toBeGreaterThanOrEqual(4)
      expect(path.every(Number.isFinite)).toBe(true)
    }
  })

  it('lays out thousands of people quickly', () => {
    const ps = []
    const rels = []
    const ms = []
    let n = 0
    const add = (birth) => {
      const id = 'p' + n++
      ps.push(life(id, birth, birth + 50 + (n % 40)))
      return id
    }
    let gen = [[add(1700), add(1702)]]
    while (ps.length < 3000) {
      const next = []
      for (const [a, b] of gen) {
        ms.push({ id: `m${a}`, ids: [a, b], year: ps.find((p) => p.id === b).birthYear + 22 })
        const base = ps.find((p) => p.id === b).birthYear + 24
        for (let k = 0; k < 3 && ps.length < 3000; k++) {
          const c = add(base + k * 3)
          rels.push(rel(`${a}${c}`, 'parent_child', a, c), rel(`${b}${c}`, 'parent_child', b, c))
          if (k < 2) next.push([c, add(base + k * 3 + 1)])
        }
      }
      gen = next
    }
    const t0 = performance.now()
    const L = run(ps, rels, ms)
    expect(performance.now() - t0).toBeLessThan(3000)
    expect(L.paths.size).toBe(ps.length)
  })
})

describe('computeTimelineLayout in rivers mode', () => {
  const person = (id, name, birth, death = null) => ({
    id,
    name,
    birth: yearDate(birth),
    death: death ? yearDate(death) : null,
    gender: 'unknown'
  })
  const persons = [
    person('dad', 'Dad', 1900, 1970),
    person('mum', 'Mum', 1902, 1980),
    person('kid', 'Kid', 1925, 2000)
  ]
  const rels = [
    ...kids(['dad', 'mum'], ['kid']),
    { ...rel('m', 'spouse', 'dad', 'mum'), formed: yearDate(1922) }
  ]

  it('returns paths, households and no stems or branches', () => {
    const L = computeTimelineLayout(persons, rels, 2024, null, null, [], {
      mode: 'rivers',
      leaveHomeAge: 30
    })
    expect(L.mode).toBe('rivers')
    expect(L.families).toEqual([])
    expect(L.branches).toEqual([])
    expect(L.rivers.households.length).toBeGreaterThan(0)
    for (const p of L.people) {
      expect(p.path.length).toBeGreaterThanOrEqual(4)
      expect(p.laneX).toBe(p.path[1])
    }
    const kid = L.rivers.stints.get('kid')
    expect(kid[0].to).toBe(1955)
    const m = L.marriages[0]
    expect(m.laneX2 - m.laneX1).toBeLessThan(150)
  })
})
