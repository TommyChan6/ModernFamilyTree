import { describe, it, expect } from 'vitest'
import {
  buildCensus,
  censusAt,
  censusLifeEnd,
  populationSeries,
  decadeSeries,
  groupSum,
  CENSUS_MAX_AGE
} from '../src/renderer/src/components/time/censusMath'
import { yearDate } from '../src/shared/calendarMath'

const P = (id, birth, death = null, gender_t = null) => ({
  id,
  birth: yearDate(birth),
  death: yearDate(death),
  gender_t
})
const R = (a, b, type, formed = null, ended = null) => ({
  person_a_id: a,
  person_b_id: b,
  type,
  formed: yearDate(formed),
  ended: yearDate(ended)
})
const ROLES = new Map([
  ['parent_child', 'vertical'],
  ['adopted', 'vertical'],
  ['spouse', 'horizontal'],
  ['partner', 'horizontal'],
  ['handfast', 'horizontal'], // a custom couple type — reached only via its role
  ['friends', 'none']
])
const at = (persons, rels, y, opts = { refYear: 2025 }) =>
  censusAt(buildCensus(persons, rels, ROLES, opts), y)

describe('census — who is alive', () => {
  it('counts people born that year and people who died that year', () => {
    const ps = [P('a', 1900, 1950), P('b', 1950, 1990)]
    expect(at(ps, [], 1899).alive).toBe(0)
    expect(at(ps, [], 1900).alive).toBe(1) // born that year
    expect(at(ps, [], 1950).alive).toBe(2) // a died, b born — both lived part of 1950
    expect(at(ps, [], 1951).alive).toBe(1)
    expect(at(ps, [], 1990).alive).toBe(1)
    expect(at(ps, [], 1991).alive).toBe(0)
  })

  it('reads fractional scrub years as their whole year', () => {
    const ps = [P('a', 1900, 1950)]
    expect(at(ps, [], 1950.9).alive).toBe(1)
    expect(at(ps, [], 1899.99).alive).toBe(0)
  })

  it('ignores people with no birth year', () => {
    const ps = [P('a', 1900, 1950), { id: 'x', birth: null, death: yearDate(1940) }]
    const idx = buildCensus(ps, [], ROLES, { refYear: 2025 })
    expect(idx.dated).toBe(1)
    expect(censusAt(idx, 1930).alive).toBe(1)
  })

  it('unknown death: alive up to the max age, never past the present', () => {
    expect(censusLifeEnd(1800, null, 2025)).toBe(1800 + CENSUS_MAX_AGE)
    expect(censusLifeEnd(1990, null, 2025)).toBe(2025)
    // born after the present (fiction set in the future): only the max age caps
    expect(censusLifeEnd(3000, null, 2025)).toBe(3100)
    // a death before the birth collapses to the birth year
    expect(censusLifeEnd(1900, 1890, 2025)).toBe(1900)
    const ps = [P('old', 1800), P('kid', 2000)]
    expect(at(ps, [], 1900).alive).toBe(1)
    expect(at(ps, [], 1901).alive).toBe(0)
    expect(at(ps, [], 2025).alive).toBe(1)
    expect(at(ps, [], 2026).alive).toBe(0)
    expect(at(ps, [], 1850, { refYear: 2025, maxAge: 30 }).alive).toBe(0)
  })

  it('is empty without dated people', () => {
    const idx = buildCensus([{ id: 'x', birth: null }], [], ROLES)
    expect(idx.minYear).toBe(null)
    const s = censusAt(idx, 1950)
    expect(s.alive).toBe(0)
    expect(s.meanAge).toBe(null)
    expect(populationSeries(idx, 1900, 2000, 10)).toEqual(new Array(10).fill(0))
  })
})

describe('census — couples', () => {
  const ps = [P('a', 1900, 1980), P('b', 1905, 1960), P('c', 1910, 2000), P('d', 1920, 1990)]

  it('counts horizontal-role bonds while both partners live', () => {
    const rels = [R('a', 'b', 'spouse', 1925)]
    expect(at(ps, rels, 1924).couples).toBe(0)
    expect(at(ps, rels, 1925).couples).toBe(1) // started that year
    expect(at(ps, rels, 1960).couples).toBe(1) // b died that year — still lived it
    expect(at(ps, rels, 1961).couples).toBe(0)
  })

  it('ends a bond in its ended year', () => {
    const rels = [R('a', 'b', 'spouse', 1925, 1940)]
    expect(at(ps, rels, 1939).couples).toBe(1)
    expect(at(ps, rels, 1940).couples).toBe(0)
  })

  it('uses symmetryRole, not type keys', () => {
    const rels = [
      R('c', 'd', 'handfast', 1945),
      R('a', 'c', 'friends', 1930),
      R('a', 'd', 'parent_child')
    ]
    expect(at(ps, rels, 1950).couples).toBe(1)
    const noRole = buildCensus(ps, rels, new Map([['handfast', 'none']]), { refYear: 2025 })
    expect(censusAt(noRole, 1950).couples).toBe(0)
  })

  it('estimates undated bonds 25 years into the shared life', () => {
    const rels = [R('a', 'b', 'spouse')] // shared life 1905–1960 → starts 1930
    expect(at(ps, rels, 1929).couples).toBe(0)
    expect(at(ps, rels, 1930).couples).toBe(1)
  })

  it('clamps a bond formed before a partner was born', () => {
    const rels = [R('a', 'd', 'partner', 1910)]
    expect(at(ps, rels, 1919).couples).toBe(0)
    expect(at(ps, rels, 1920).couples).toBe(1)
  })
})

describe('census — ages, decades, generations', () => {
  it('computes mean and median ages of the living', () => {
    const ps = [P('a', 1900, 1999), P('b', 1910, 1999), P('c', 1940, 1999)]
    const s = at(ps, [], 1950) // ages 50, 40, 10
    expect(s.meanAge).toBeCloseTo(100 / 3, 6)
    expect(s.medianAge).toBe(40)
    const s2 = at([...ps, P('d', 1945, 1999)], [], 1950) // 50, 40, 10, 5
    expect(s2.medianAge).toBe(25)
    expect(at(ps, [], 1890).meanAge).toBe(null)
  })

  it('counts births and recorded deaths decade-to-date', () => {
    const ps = [P('a', 1950, 1953), P('b', 1952), P('c', 1958, 1959), P('d', 1949)]
    const s = at(ps, [], 1955)
    expect(s.decade).toBe(1950)
    expect(s.birthsDecade).toBe(2) // a, b — c is still in the future
    expect(s.deathsDecade).toBe(1) // a
    const end = at(ps, [], 1959)
    expect(end.birthsDecade).toBe(3)
    expect(end.deathsDecade).toBe(2)
    expect(at(ps, [], 1960).birthsDecade).toBe(0)
  })

  it('handles negative (BCE) decades', () => {
    const ps = [P('a', -25, -3)]
    const s = at(ps, [], -3)
    expect(s.decade).toBe(-10)
    expect(s.deathsDecade).toBe(1)
  })

  it('counts generations alive, married-in partners join their spouse row', () => {
    const ps = [P('g', 1900, 1960), P('p', 1925, 2000), P('in', 1927, 2000), P('k', 1950, 2020)]
    const rels = [
      R('g', 'p', 'parent_child'),
      R('p', 'in', 'spouse', 1948),
      R('p', 'k', 'parent_child')
    ]
    expect(at(ps, rels, 1930).generations).toBe(2) // g + p (in sits in p's row)
    expect(at(ps, rels, 1955).generations).toBe(3)
    expect(at(ps, rels, 1970).generations).toBe(2)
  })

  it('names the oldest living person and their age', () => {
    const ps = [P('a', 1900, 1950), P('b', 1910, 1990), P('c', 1920, 2000)]
    expect(at(ps, [], 1940)).toMatchObject({ oldestId: 'a', oldestAge: 40 })
    expect(at(ps, [], 1951)).toMatchObject({ oldestId: 'b', oldestAge: 41 })
    expect(at(ps, [], 2001).oldestId).toBe(null)
  })

  it('splits genders by gender_t', () => {
    const ps = [
      P('a', 1900, 2000, 0),
      P('b', 1900, 2000, 1),
      P('c', 1900, 2000, 0.5),
      P('d', 1900, 2000)
    ]
    expect(at(ps, [], 1950).gender).toEqual({ male: 1, female: 1, other: 1, unknown: 1 })
  })
})

describe('census — series', () => {
  const ps = [P('a', 1900, 1950), P('b', 1920, 1955), P('c', 1931, 1999)]
  const idx = buildCensus(ps, [], ROLES, { refYear: 2025 })

  it('samples population across a span', () => {
    const s = populationSeries(idx, 1900, 2000, 11)
    expect(s).toHaveLength(11)
    expect(s[0]).toBe(1) // 1900
    expect(s[4]).toBe(3) // 1940
    expect(s[10]).toBe(0) // 2000
  })

  it('bins births and deaths per decade', () => {
    const d = decadeSeries(idx, 1900, 1999)
    expect(d.decades).toHaveLength(10)
    expect(d.decades[0]).toBe(1900)
    expect(d.deaths[5]).toBe(2) // 1950s
    expect(d.deaths[9]).toBe(1) // 1990s
    expect(d.births.reduce((a, b) => a + b, 0)).toBe(3)
  })

  it('groupSum folds runs of decades and keeps totals', () => {
    const v = Array.from({ length: 100 }, (_, i) => i % 3)
    const b = groupSum(v, 15)
    expect(b).toHaveLength(7)
    expect(b.reduce((a, x) => a + x, 0)).toBe(v.reduce((a, x) => a + x, 0))
    expect(groupSum([1, 2, 3], 2)).toEqual([3, 3])
    expect(groupSum([1, 2], 1)).toEqual([1, 2])
  })
})

describe('census — scale', () => {
  it('builds 5,000 people fast and answers 1,000 queries fast', () => {
    let seed = 7
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const ps = []
    const rels = []
    for (let i = 0; i < 5000; i++) {
      const b = 1500 + Math.floor(rnd() * 500)
      const dead = rnd() < 0.8
      ps.push(P('p' + i, b, dead ? b + Math.floor(rnd() * 90) : null, rnd()))
      if (i > 10) {
        rels.push(R('p' + Math.floor(rnd() * i), 'p' + i, 'parent_child'))
        if (rnd() < 0.3) rels.push(R('p' + i, 'p' + Math.floor(rnd() * i), 'spouse', b + 25))
      }
    }
    const t0 = performance.now()
    const idx = buildCensus(ps, rels, ROLES, { refYear: 2025 })
    const t1 = performance.now()
    let sum = 0
    for (let q = 0; q < 1000; q++) sum += censusAt(idx, 1500 + (q * 525) / 1000).alive
    const t2 = performance.now()
    expect(sum).toBeGreaterThan(0)
    expect(t1 - t0).toBeLessThan(500)
    expect(t2 - t1).toBeLessThan(50)
  })
})
