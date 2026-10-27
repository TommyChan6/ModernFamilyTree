import { describe, it, expect } from 'vitest'
import {
  descendantCounts,
  starMagnitude,
  starSizeMul,
  packStarState,
  unpackStarState,
  STAR_FULL_AT,
  STAR_LEVELS
} from '../src/renderer/src/components/graph/constellation'
import { buildKinIndex } from '../src/renderer/src/components/kinship/kinshipGraph'
import {
  NODE_SHAPES,
  nodeShapeId,
  shapeAnchor
} from '../src/renderer/src/components/graph/webgl/nodeShapes.js'
import { lineFxSpec } from '../src/renderer/src/components/graph/webgl/lineFx.js'
import { GRAPH_THEMES } from '../src/renderer/src/components/graph/graphThemes.js'
import {
  starChartLayout,
  ringTicks,
  edgeTicks,
  chartRng,
  plateHourStep
} from '../src/renderer/src/components/export/starChartPoster'

const kids = (pairs) => {
  const m = new Map()
  for (const [p, c] of pairs) {
    if (!m.has(p)) m.set(p, [])
    m.get(p).push({ id: c })
  }
  return m
}

describe('descendant counts', () => {
  it('counts every distinct descendant down the generations', () => {
    // a → b, c; b → d; c → d (d is shared: counted once); d → e
    const ch = kids([
      ['a', 'b'],
      ['a', 'c'],
      ['b', 'd'],
      ['c', 'd'],
      ['d', 'e']
    ])
    const n = descendantCounts(['a', 'b', 'c', 'd', 'e', 'x'], ch)
    expect(n.get('a')).toBe(4)
    expect(n.get('b')).toBe(2)
    expect(n.get('c')).toBe(2)
    expect(n.get('d')).toBe(1)
    expect(n.get('e')).toBe(0)
    expect(n.get('x')).toBe(0) // no children at all
  })

  it('survives a cycle in bad data and never counts the root itself', () => {
    const ch = kids([
      ['a', 'b'],
      ['b', 'a']
    ])
    const n = descendantCounts(['a', 'b'], ch)
    expect(n.get('a')).toBe(1)
    expect(n.get('b')).toBe(1)
  })

  it('ignores children outside the id set', () => {
    const n = descendantCounts(['a'], kids([['a', 'ghost']]))
    expect(n.get('a')).toBe(0)
  })

  it('reads the kinship index (vertical symmetryRole edges, adoptive too)', () => {
    const persons = ['g', 'p', 'k', 'ad', 'sp'].map((id) => ({ id, name: id }))
    const rels = [
      { person_a_id: 'g', person_b_id: 'p', type: 'parent_child' },
      { person_a_id: 'p', person_b_id: 'k', type: 'parent_child' },
      { person_a_id: 'p', person_b_id: 'ad', type: 'adopted' },
      { person_a_id: 'p', person_b_id: 'sp', type: 'spouse' }
    ]
    const idx = buildKinIndex(persons, rels)
    const n = descendantCounts(idx.ids, idx.children)
    expect(n.get('g')).toBe(3)
    expect(n.get('p')).toBe(2)
    expect(n.get('sp')).toBe(0) // a spouse is not a descendant
  })

  it('stays fast on a few thousand people', () => {
    const ids = []
    const pairs = []
    for (let i = 0; i < 4000; i++) {
      ids.push('n' + i)
      if (i > 0) pairs.push(['n' + Math.floor((i - 1) / 3), 'n' + i]) // ternary tree
    }
    const t0 = performance.now()
    const n = descendantCounts(ids, kids(pairs))
    expect(performance.now() - t0).toBeLessThan(500)
    expect(n.get('n0')).toBe(3999)
  })
})

describe('star magnitude', () => {
  it('is 0 for no descendants and saturates at STAR_FULL_AT', () => {
    expect(starMagnitude(0)).toBe(0)
    expect(starMagnitude(-3)).toBe(0)
    expect(starMagnitude(NaN)).toBe(0)
    expect(starMagnitude(STAR_FULL_AT)).toBeCloseTo(1)
    expect(starMagnitude(200)).toBe(1)
  })

  it('is log-scaled: one child already shows, a patriarch does not dwarf the rest', () => {
    const k1 = starMagnitude(1)
    const k10 = starMagnitude(10)
    expect(k1).toBeGreaterThan(0.1)
    expect(k10).toBeGreaterThan(0.5)
    expect(k10).toBeLessThan(starMagnitude(30))
    // monotone
    let prev = -1
    for (let c = 0; c < 300; c += 7) {
      const k = starMagnitude(c)
      expect(k).toBeGreaterThanOrEqual(prev)
      prev = k
    }
  })

  it('size grows with magnitude, within a sane band', () => {
    expect(starSizeMul(0)).toBeCloseTo(0.9)
    expect(starSizeMul(1)).toBeCloseTo(1.7)
    expect(starSizeMul(0.5)).toBeGreaterThan(starSizeMul(0.2))
    expect(starSizeMul(9)).toBeCloseTo(1.7) // clamped
  })
})

describe('star state packing (iState.x)', () => {
  it('leaves non-star nodes exactly as before (selected 0/1)', () => {
    expect(packStarState(false)).toBe(0)
    expect(packStarState(true)).toBe(1)
  })

  it('round-trips selected, magnitude and twinkle through the shader decode', () => {
    for (const sel of [false, true])
      for (const tw of [false, true])
        for (const k of [0, 0.001, 0.25, 0.5, 0.999, 1]) {
          const x = packStarState(sel, k, tw)
          expect(Number.isInteger(x)).toBe(true)
          expect(Math.fround(x)).toBe(x) // exact in float32
          const u = unpackStarState(Math.fround(x))
          expect(u.selected).toBe(sel)
          expect(u.twinkle).toBe(tw)
          expect(Math.abs(u.k - k)).toBeLessThanOrEqual(0.5 / STAR_LEVELS + 1e-9)
        }
  })

  it('clamps out-of-range magnitudes', () => {
    expect(unpackStarState(packStarState(false, 7)).k).toBe(1)
    expect(unpackStarState(packStarState(false, -2)).k).toBe(0)
  })
})

describe('constellation skin wiring', () => {
  it('star is an appended flat shape (ids of older shapes unchanged)', () => {
    expect(nodeShapeId('flatplate')).toBe(10)
    expect(nodeShapeId('star')).toBe(11)
    expect(NODE_SHAPES[NODE_SHAPES.length - 1]).toBe('star')
    expect(shapeAnchor('star').lift).toBe(0) // not a standing shape
  })

  it('has a thin star-chart line effect', () => {
    const f = lineFxSpec('starline')
    expect(f.id).toBe('starline')
    expect(f.n).toBe(10)
    expect(f.body).toBeLessThan(3)
  })

  it('the constellation preset coordinates the same keys as every look', () => {
    const keys = Object.keys(GRAPH_THEMES[0].settings).sort()
    const th = GRAPH_THEMES.find((t) => t.id === 'constellation')
    expect(th).toBeTruthy()
    expect(Object.keys(th.settings).sort()).toEqual(keys)
    expect(th.settings.nodeShape).toBe('star')
    expect(th.settings.lineFx).toBe('starline')
    expect(th.settings.ambientFx).toBe('nightsky')
  })
})

describe('star chart poster layout', () => {
  const base = { title: 'The Smiths', subtitle: 'A chart of 40 stars', legend: 'Brightness' }

  it('circle frame: a centred disc that fits inside the sheet with its ring', () => {
    for (const [w, h] of [
      [1920, 1080],
      [1080, 1920],
      [2048, 2048]
    ]) {
      const L = starChartLayout({ ...base, width: w, height: h, frame: 'circle' })
      expect(L.cx).toBe(w / 2)
      expect(L.cx - L.r - L.ring).toBeGreaterThanOrEqual(0)
      expect(L.cx + L.r + L.ring).toBeLessThanOrEqual(w)
      expect(L.cy - L.r - L.ring).toBeGreaterThan(L.subtitleBaseline) // below the header
      expect(L.cy + L.r + L.ring).toBeLessThan(L.legendBaseline) // above the legend
      expect(L.content.w).toBeCloseTo(L.r * 2)
      expect(L.content.h).toBeCloseTo(L.r * 2)
    }
  })

  it('rect frame: the plate sits inside the margins, ring included', () => {
    const L = starChartLayout({ ...base, width: 1920, height: 1080, frame: 'rect' })
    const c = L.content
    expect(c.x - L.ring).toBeGreaterThanOrEqual(L.pad - 1)
    expect(c.x + c.w + L.ring).toBeLessThanOrEqual(1920 - L.pad + 1)
    expect(c.y - L.ring).toBeGreaterThan(L.subtitleBaseline)
    expect(c.y + c.h).toBeLessThan(L.legendBaseline)
  })

  it('scales with the sheet (preview and download look the same)', () => {
    const a = starChartLayout({ ...base, width: 960, height: 540, frame: 'circle' })
    const b = starChartLayout({ ...base, width: 1920, height: 1080, frame: 'circle' })
    expect(b.r / a.r).toBeCloseTo(2, 1)
    expect(b.titleSize / a.titleSize).toBeCloseTo(2, 1)
  })

  it('ring ticks: one per degree, 24 labelled hours starting at the top', () => {
    const t = ringTicks()
    expect(t).toHaveLength(360)
    const hours = t.filter((x) => x.hour != null)
    expect(hours.map((x) => x.hour)).toEqual([...Array(24).keys()])
    expect(hours[0].angle).toBeCloseTo(-Math.PI / 2)
    expect(t.filter((x) => x.len === 1)).toHaveLength(72 - 24)
  })

  it('edge ticks span the edge with every 5th long', () => {
    const e = edgeTicks(1000, 10)
    expect(e[0].at).toBe(0)
    expect(e[e.length - 1].at).toBeCloseTo(1000)
    expect(e.filter((x) => x.long).length).toBe(Math.floor((e.length - 1) / 5) + 1)
  })

  it('plate hour labels thin out on narrow plates and always divide 24', () => {
    expect(plateHourStep(3000, 12)).toBe(1)
    expect(plateHourStep(1200, 14)).toBe(2)
    expect(plateHourStep(400, 14)).toBe(4)
    expect(plateHourStep(200, 14)).toBe(12)
    for (const w of [100, 500, 900, 1600, 4000]) expect(24 % plateHourStep(w, 12)).toBe(0)
  })

  it('the sheet star field is deterministic', () => {
    const a = chartRng(7)
    const b = chartRng(7)
    for (let i = 0; i < 5; i++) expect(a()).toBe(b())
    const r = chartRng(1)()
    expect(r).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThan(1)
  })
})
