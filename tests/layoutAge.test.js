import { describe, it, expect } from 'vitest'
import { computeAgeYPositions, yearAtAgeY } from '../src/renderer/src/components/graph/layoutAge.js'

const D = (year) => ({ year, month: null, day: null, precision: 'year', calendar: 'gregorian' })

describe('Birth layout year axis', () => {
  const nodes = [
    { id: 'a', birth: D(1900) },
    { id: 'b', birth: D(1950) },
    { id: 'c', birth: D(2000) },
    { id: 'u', birth: null }
  ]
  const info = computeAgeYPositions(nodes, 660)

  it('places births along the axis, undated people at the latest year', () => {
    expect(info.yMap.a).toBe(80)
    expect(info.yMap.c).toBe(580)
    expect(info.yMap.b).toBe(330)
    expect(info.yMap.u).toBe(info.yMap.c)
  })

  it('yearAtAgeY inverts the mapping (rounded to whole years)', () => {
    for (const id of ['a', 'b', 'c']) {
      expect(yearAtAgeY(info, info.yMap[id])).toBe(nodes.find((n) => n.id === id).birth.year)
    }
    expect(yearAtAgeY(info, 80 + 500 * 0.31)).toBe(1931)
    // beyond the ends extrapolates (clicking above the first birth)
    expect(yearAtAgeY(info, 30)).toBe(1890)
    expect(yearAtAgeY(null, 100)).toBeNull()
  })
})
