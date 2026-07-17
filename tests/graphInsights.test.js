import { describe, it, expect } from 'vitest'
import {
  shortestPath,
  egoDistances,
  derivedSiblings,
  romanceInsights,
  mutualLikesKeys
} from '../src/renderer/src/components/graph/graphInsights'

const rel = (a, b, type = 'parent_child', id = `${type}:${a}:${b}`) => ({
  id,
  type,
  person_a_id: a,
  person_b_id: b
})

// gp → p1 ⚭ p2 → kid ; family friend f likes kid
const family = () => [
  rel('gp', 'p1'),
  rel('p1', 'kid'),
  rel('p2', 'kid'),
  rel('p1', 'p2', 'spouse'),
  rel('f', 'kid', 'likes')
]

describe('shortestPath', () => {
  it('finds the shortest chain across mixed edge types', () => {
    const p = shortestPath('gp', 'f', family())
    expect(p.ids).toEqual(['gp', 'p1', 'kid', 'f'])
    expect(p.rels).toHaveLength(3)
    expect(p.rels[2].type).toBe('likes')
  })

  it('prefers fewer hops over edge direction', () => {
    // gp→p2 direct spouse-of-child chain vs through p1: both length 2 — any is fine,
    // but the direct 1-hop edge must win when present.
    const rels = [...family(), rel('gp', 'f', 'friends')]
    const p = shortestPath('gp', 'f', rels)
    expect(p.ids).toEqual(['gp', 'f'])
  })

  it('returns null when no chain exists and a trivial path for self', () => {
    expect(shortestPath('gp', 'loner', family())).toBeNull()
    expect(shortestPath('gp', 'gp', family())).toEqual({ ids: ['gp'], rels: [] })
  })
})

describe('egoDistances', () => {
  it('rings people by hop count from the ego', () => {
    const d = egoDistances('kid', family())
    expect(d.get('kid')).toBe(0)
    expect(d.get('p1')).toBe(1)
    expect(d.get('p2')).toBe(1)
    expect(d.get('f')).toBe(1)
    expect(d.get('gp')).toBe(2)
  })

  it('respects maxDepth and omits unreachable people', () => {
    const d = egoDistances('kid', family(), 1)
    expect(d.has('gp')).toBe(false)
    expect(d.has('loner')).toBe(false)
  })
})

describe('derivedSiblings', () => {
  it('links children who share a vertical-edge parent', () => {
    const rels = [rel('p', 'a'), rel('p', 'b'), rel('q', 'b'), rel('q', 'c')]
    const s = derivedSiblings(rels)
    expect([...s.get('a')]).toEqual(['b'])
    expect([...s.get('b')].sort()).toEqual(['a', 'c']) // half-siblings via q
    expect(s.get('c').has('a')).toBe(false)
  })

  it('counts adopted edges and custom vertical types, ignores horizontal/none', () => {
    const roleOf = (t) => (t === 'wardof' ? 'vertical' : t === 'spouse' ? 'horizontal' : 'none')
    const rels = [rel('p', 'a', 'wardof'), rel('p', 'b', 'wardof'), rel('a', 'b', 'friends')]
    const s = derivedSiblings(rels, roleOf)
    expect(s.get('a').has('b')).toBe(true)
    // default roles: adopted + parent_child both vertical
    const s2 = derivedSiblings([rel('p', 'a', 'adopted'), rel('p', 'b')])
    expect(s2.get('a').has('b')).toBe(true)
  })
})

describe('romanceInsights', () => {
  it('separates mutual from unrequited likes', () => {
    const rels = [rel('a', 'b', 'likes'), rel('b', 'a', 'likes'), rel('c', 'a', 'likes')]
    const r = romanceInsights(rels)
    expect(r.mutual).toEqual([{ a: 'a', b: 'b' }])
    expect(r.unrequited).toEqual([{ from: 'c', to: 'a' }])
  })

  it('finds directed love triangles exactly once', () => {
    const rels = [rel('a', 'b', 'likes'), rel('b', 'c', 'likes'), rel('c', 'a', 'likes')]
    const r = romanceInsights(rels)
    expect(r.triangles).toHaveLength(1)
    expect(r.triangles[0]).toEqual(['a', 'b', 'c'])
  })

  it('spots rival admirers sharing an un-mutual crush', () => {
    const rels = [rel('a', 'x', 'likes'), rel('b', 'x', 'likes'), rel('x', 'a', 'likes')]
    const r = romanceInsights(rels)
    // x likes a back → a is not a rival; only b pines. No rivalry with one admirer.
    expect(r.rivals).toEqual([])
    const r2 = romanceInsights([rel('a', 'x', 'likes'), rel('b', 'x', 'likes')])
    expect(r2.rivals).toEqual([{ crush: 'x', admirers: ['a', 'b'] }])
  })

  it('mutualLikesKeys yields sorted pair keys', () => {
    const keys = mutualLikesKeys([rel('b', 'a', 'likes'), rel('a', 'b', 'likes')])
    expect([...keys]).toEqual(['a~b'])
  })
})
