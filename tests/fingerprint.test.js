import { describe, it, expect } from 'vitest'
import {
  computeFingerprintFeatures,
  countsOnlyFeatures,
  emptyFeatures,
  fingerprintSeed,
  fingerprintsFromDb
} from '../src/shared/fingerprint'
import {
  buildMandala,
  mandalaLegend,
  mandalaParams,
  mandalaToSvg
} from '../src/renderer/src/lib/familyFingerprint'

const P = (id, birth = null, gender_t = null) => ({
  id,
  birth: birth === null ? null : { year: birth },
  death: null,
  gender_t
})
const pc = (a, b) => ({ person_a_id: a, person_b_id: b, type: 'parent_child' })
const sp = (a, b) => ({ person_a_id: a, person_b_id: b, type: 'spouse' })

// Grandparents g1+g2 → children c1, c2; c1 marries in-law s1 → grandchildren
// k1, k2, k3. Plus an unrelated pair (island) and a loner.
function sample() {
  return {
    projectId: 'proj-1',
    persons: [
      P('g1', 1900, 0),
      P('g2', 1902, 1),
      P('c1', 1930, 0),
      P('c2', 1933, 1),
      P('s1', 1931, 1),
      P('k1', 1960, 0),
      P('k2', 1962, 1),
      P('k3', 1965),
      P('i1'),
      P('i2'),
      P('lone')
    ],
    relationships: [
      sp('g1', 'g2'),
      pc('g1', 'c1'),
      pc('g2', 'c1'),
      pc('g1', 'c2'),
      pc('g2', 'c2'),
      sp('c1', 's1'),
      pc('c1', 'k1'),
      pc('s1', 'k1'),
      pc('c1', 'k2'),
      pc('s1', 'k2'),
      pc('c1', 'k3'),
      pc('s1', 'k3'),
      { person_a_id: 'i1', person_b_id: 'i2', type: 'friends' }
    ]
  }
}

describe('computeFingerprintFeatures', () => {
  it('reads generations, families, founders and islands', () => {
    const f = computeFingerprintFeatures(sample())
    expect(f.people).toBe(11)
    // Gen 0: g1 g2 + unconnected i1 i2 lone; the in-law s1 joins c1's row.
    expect(f.generations).toEqual([5, 3, 3])
    expect(f.families).toBe(2)
    expect(f.genFamilies).toEqual([1, 1, 0])
    expect(f.genChildren).toEqual([2, 3, 0])
    expect(f.branching[2]).toBe(1)
    expect(f.branching[3]).toBe(1)
    expect(f.branchMean).toBe(2.5)
    expect(f.couples).toBe(2)
    expect(f.founders).toBe(2) // g1 + g2 (s1 married in)
    expect(f.founderLines).toBe(1)
    expect(f.social).toBe(1)
    expect(f.components).toBe(3)
    expect(f.largest).toBe(8)
    expect(f.islands).toEqual([2])
    expect(f.loners).toBe(1)
    expect(f.span).toEqual({ from: 1900, to: 1965 })
    expect(f.dated).toBe(8)
    expect(f.gender.known).toBe(7)
    expect(f.seed).toBe(fingerprintSeed('proj-1'))
  })

  it('uses symmetryRole from the registry instead of type literals', () => {
    const input = {
      projectId: 'x',
      persons: [P('a'), P('b'), P('c')],
      relationships: [
        { person_a_id: 'a', person_b_id: 'b', type: 'sire' },
        { person_a_id: 'a', person_b_id: 'c', type: 'bond' }
      ],
      typeRoles: new Map([
        ['sire', 'vertical'],
        ['bond', 'horizontal']
      ])
    }
    const f = computeFingerprintFeatures(input)
    expect(f.generations).toEqual([2, 1])
    expect(f.couples).toBe(1)
    // A plain record works too.
    const g = computeFingerprintFeatures({
      ...input,
      typeRoles: { sire: 'vertical', bond: 'none' }
    })
    expect(g.couples).toBe(0)
    expect(g.social).toBe(1)
  })

  it('handles an empty project', () => {
    const f = computeFingerprintFeatures({ projectId: 'e', persons: [], relationships: [] })
    expect(f).toEqual(emptyFeatures('e'))
    expect(() => mandalaToSvg(buildMandala(f))).not.toThrow()
  })

  it('survives cycles, self-links, dangling ids and duplicates', () => {
    const f = computeFingerprintFeatures({
      projectId: 'odd',
      persons: [P('a'), P('b'), P('c'), P('a'), null],
      relationships: [
        pc('a', 'b'),
        pc('b', 'c'),
        pc('c', 'a'), // cycle
        pc('a', 'a'), // self
        pc('a', 'ghost'), // dangling
        pc('a', 'b'), // duplicate
        null,
        sp('b', 'c'),
        sp('c', 'b')
      ]
    })
    expect(f.people).toBe(3)
    expect(f.bonds).toBe(4)
    expect(f.couples).toBe(1)
    expect(f.generations.reduce((s, x) => s + x, 0)).toBe(3)
    expect(() => mandalaToSvg(buildMandala(f))).not.toThrow()
  })

  it('collects the most-used tag colours', () => {
    const f = computeFingerprintFeatures({
      ...sample(),
      tags: [
        { id: 't1', color: '#FF0000' },
        { id: 't2', color: '#00ff00' },
        { id: 't3', color: 'nope' }
      ],
      entityTags: [
        { entity_id: 'g1', tag_id: 't2' },
        { entity_id: 'g2', tag_id: 't2' },
        { entity_id: 'c1', tag_id: 't1' },
        { entity_id: 'ghost', tag_id: 't1' }
      ]
    })
    expect(f.tagCount).toBe(3)
    expect(f.tagColors).toEqual(['#00ff00', '#ff0000'])
  })

  it('is JSON-safe', () => {
    const f = computeFingerprintFeatures(sample())
    expect(JSON.parse(JSON.stringify(f))).toEqual(f)
  })

  it('stays O(n + e) on a large tree', () => {
    const persons = []
    const relationships = []
    for (let i = 0; i < 20000; i++) {
      persons.push(P('p' + i, 1800 + (i % 200), i % 2))
      if (i) relationships.push(pc('p' + Math.floor((i - 1) / 3), 'p' + i))
    }
    const t0 = Date.now()
    const f = computeFingerprintFeatures({ projectId: 'big', persons, relationships })
    expect(Date.now() - t0).toBeLessThan(1500)
    expect(f.people).toBe(20000)
    expect(f.founders).toBe(1)
    expect(f.largest).toBe(20000)
  })
})

describe('the mandala', () => {
  it('is deterministic — same tree, same SVG', () => {
    const a = mandalaToSvg(buildMandala(computeFingerprintFeatures(sample()), { theme: 'dark' }))
    const b = mandalaToSvg(buildMandala(computeFingerprintFeatures(sample()), { theme: 'dark' }))
    expect(a).toBe(b)
    expect(a.startsWith('<svg')).toBe(true)
    expect(a).not.toMatch(/NaN|undefined|Infinity/)
  })

  it('differs between projects with the same shape', () => {
    const a = mandalaToSvg(buildMandala(computeFingerprintFeatures(sample())))
    const b = mandalaToSvg(
      buildMandala(computeFingerprintFeatures({ ...sample(), projectId: 'proj-2' }))
    )
    expect(a).not.toBe(b)
  })

  it('changes gently when one leaf is added', () => {
    const before = mandalaParams(computeFingerprintFeatures(sample()))
    const s = sample()
    s.persons.push(P('k4', 1967, 1))
    s.relationships.push(pc('c1', 'k4'), pc('s1', 'k4'))
    const after = mandalaParams(computeFingerprintFeatures(s))
    const flat = (o, pre = '', out = {}) => {
      for (const [k, v] of Object.entries(o ?? {})) {
        if (v && typeof v === 'object') flat(v, pre + k + '.', out)
        else out[pre + k] = v
      }
      return out
    }
    const A = flat(before)
    const B = flat(after)
    const keys = new Set([...Object.keys(A), ...Object.keys(B)])
    const changed = [...keys].filter((k) => A[k] !== B[k])
    expect(changed.length).toBeGreaterThan(0)
    expect(changed.length).toBeLessThanOrEqual(4)
    expect(after.seed).toBe(before.seed)
    expect(after.symmetry).toBe(before.symmetry)
  })

  it('renders every theme', () => {
    const f = computeFingerprintFeatures(sample())
    for (const theme of ['dark', 'light', 'ink', 'medieval']) {
      const m = buildMandala(f, { theme, background: true, accent: '#3d8bfd' })
      expect(m.shapes.length).toBeGreaterThan(20)
      const svg = mandalaToSvg(m, 512)
      expect(svg).toContain('width="512"')
      expect(svg).not.toMatch(/NaN|undefined/)
    }
    // The ink seal is a fixed (non-rotating) layer.
    const ink = buildMandala(f, { theme: 'ink' })
    expect(ink.shapes.some((s) => s.layer === 'fixed')).toBe(true)
  })

  it('caps the drawing for huge trees', () => {
    const persons = []
    const relationships = []
    for (let i = 0; i < 5000; i++) {
      persons.push(P('p' + i, 1500 + i / 10))
      if (i) relationships.push(pc('p' + Math.floor((i - 1) / 2), 'p' + i))
    }
    const m = buildMandala(computeFingerprintFeatures({ projectId: 'h', persons, relationships }))
    expect(m.shapes.length).toBeLessThan(4000)
  })

  it('draws a counts-only fingerprint', () => {
    const f = countsOnlyFeatures('c', { persons: 40, relationships: 50 })
    expect(f.partial).toBe(true)
    expect(f.generations.reduce((s, x) => s + x, 0)).toBe(40)
    expect(() => mandalaToSvg(buildMandala(f, { theme: 'light' }))).not.toThrow()
  })

  it('builds a legend with this tree’s numbers', () => {
    const rows = mandalaLegend(computeFingerprintFeatures(sample()))
    const by = Object.fromEntries(rows.map((r) => [r.id, r]))
    expect(by.rings.n).toBe(3)
    expect(by.petals.n).toBe(2)
    expect(by.rosette.n).toBe(2)
    expect(by.satellites.n).toBe(1)
  })
})

describe('fingerprintsFromDb', () => {
  it('buckets rows per project', () => {
    const db = {
      projects: { a: { id: 'a' }, b: { id: 'b' } },
      persons: {
        x: { id: 'x', project_id: 'a' },
        y: { id: 'y', project_id: 'a' },
        z: { id: 'z', project_id: 'b' }
      },
      relationships: {
        r: { id: 'r', project_id: 'a', person_a_id: 'x', person_b_id: 'y', type: 'kin' }
      },
      rel_type_defs: { d: { project_id: 'a', key: 'kin', symmetryRole: 'vertical' } },
      tags: {},
      entity_tags: {}
    }
    const out = fingerprintsFromDb(db, ['a', 'b'])
    expect(Object.keys(out).sort()).toEqual(['a', 'b'])
    expect(out.a.generations).toEqual([1, 1])
    expect(out.b.people).toBe(1)
  })
})
