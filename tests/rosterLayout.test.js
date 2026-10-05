import { describe, it, expect } from 'vitest'
import {
  gridMetrics,
  tileXY,
  visibleRows,
  stepCursor,
  revealScroll,
  rosterMaxima,
  statFraction,
  lifeLine,
  epithet,
  initialsOf,
  PITCH_X,
  PITCH_Y,
  PAD_X,
  PAD_Y,
  TILE_W,
  TILE_H,
  MAX_COLS
} from '../src/renderer/src/components/people/rosterLayout.js'

describe('roster gridMetrics', () => {
  it('never collapses below one column (unmeasured container)', () => {
    const m = gridMetrics(0, 10)
    expect(m.cols).toBe(1)
    expect(m.rows).toBe(10)
  })

  it('fits as many slanted tiles as the width allows and centres them', () => {
    const w = PAD_X * 2 + TILE_W + PITCH_X * 5 // exactly 6 columns
    const m = gridMetrics(w, 100)
    expect(m.cols).toBe(6)
    expect(m.rows).toBe(17)
    expect(m.gridW).toBe(5 * PITCH_X + TILE_W)
    expect(m.offsetX).toBe(PAD_X)
    expect(m.totalH).toBe(PAD_Y * 2 + 16 * PITCH_Y + TILE_H)
  })

  it('caps columns at MAX_COLS and at the roster size', () => {
    expect(gridMetrics(10000, 500).cols).toBe(MAX_COLS)
    const small = gridMetrics(2000, 3)
    expect(small.cols).toBe(3)
    expect(small.offsetX).toBeGreaterThan(PAD_X) // centred
  })

  it('is empty for an empty roster', () => {
    expect(gridMetrics(800, 0)).toMatchObject({ rows: 0, totalH: 0 })
  })
})

describe('roster tileXY / visibleRows', () => {
  it('places tiles on the slanted pitch', () => {
    const m = { cols: 4, offsetX: 30 }
    expect(tileXY(0, m)).toEqual({ x: 30, y: PAD_Y, row: 0, col: 0 })
    expect(tileXY(6, m)).toEqual({ x: 30 + 2 * PITCH_X, y: PAD_Y + PITCH_Y, row: 1, col: 2 })
  })

  it('windows rows around the viewport and clamps', () => {
    const w = visibleRows(PAD_Y + PITCH_Y * 10, PITCH_Y * 3, 100, 2)
    expect(w.first).toBe(8)
    expect(w.last).toBe(15)
    expect(visibleRows(0, 500, 3)).toEqual({ first: 0, last: 3 })
    const stale = visibleRows(1e6, 500, 3)
    expect(stale.first).toBe(stale.last)
    expect(visibleRows(0, 500, 0)).toEqual({ first: 0, last: 0 })
  })
})

describe('roster stepCursor', () => {
  // 10 people in 4 columns: rows [0..3] [4..7] [8,9]
  it('walks left/right in reading order with clamping', () => {
    expect(stepCursor(3, 'ArrowRight', 4, 10)).toBe(4)
    expect(stepCursor(9, 'ArrowRight', 4, 10)).toBe(9)
    expect(stepCursor(4, 'ArrowLeft', 4, 10)).toBe(3)
    expect(stepCursor(0, 'ArrowLeft', 4, 10)).toBe(0)
  })

  it('keeps the column vertically and drops onto a short last row', () => {
    expect(stepCursor(1, 'ArrowDown', 4, 10)).toBe(5)
    expect(stepCursor(7, 'ArrowDown', 4, 10)).toBe(9)
    expect(stepCursor(9, 'ArrowDown', 4, 10)).toBe(9)
    expect(stepCursor(5, 'ArrowUp', 4, 10)).toBe(1)
    expect(stepCursor(1, 'ArrowUp', 4, 10)).toBe(1)
  })

  it('pages, jumps and ignores unknown keys', () => {
    expect(stepCursor(1, 'PageDown', 4, 100, 3)).toBe(13)
    expect(stepCursor(98, 'PageDown', 4, 100, 3)).toBe(99)
    expect(stepCursor(13, 'PageUp', 4, 100, 3)).toBe(1)
    expect(stepCursor(6, 'PageUp', 4, 100, 3)).toBe(2)
    expect(stepCursor(50, 'Home', 4, 100)).toBe(0)
    expect(stepCursor(5, 'End', 4, 100)).toBe(99)
    expect(stepCursor(5, 'a', 4, 100)).toBe(5)
    expect(stepCursor(5, 'ArrowDown', 4, 0)).toBe(0)
  })
})

describe('roster revealScroll', () => {
  it('scrolls only when the row is out of view', () => {
    const viewH = 300
    expect(revealScroll(0, 5, 0, viewH)).toBeNull()
    const farRow = 20
    const top = PAD_Y + farRow * PITCH_Y
    expect(revealScroll(farRow * 5, 5, 0, viewH)).toBe(top + TILE_H + PAD_Y - viewH)
    expect(revealScroll(0, 5, 900, viewH)).toBe(0)
  })
})

describe('roster stats + text helpers', () => {
  it('computes maxima with a floor of 1', () => {
    const persons = [{ id: 'a' }, { id: 'b' }]
    const stats = { a: { kin: 3, children: 0 }, b: { kin: 7, children: 2 } }
    const ages = { a: 40, b: null }
    const m = rosterMaxima(
      persons,
      (id) => stats[id],
      (p) => ages[p.id]
    )
    expect(m).toEqual({ age: 40, kin: 7, children: 2 })
    expect(
      rosterMaxima(
        [],
        () => null,
        () => null
      )
    ).toEqual({ age: 1, kin: 1, children: 1 })
  })

  it('clamps stat fractions', () => {
    expect(statFraction(5, 10)).toBe(0.5)
    expect(statFraction(20, 10)).toBe(1)
    expect(statFraction(null, 10)).toBe(0)
    expect(statFraction(3, 0)).toBe(0)
  })

  it('formats life lines, epithets and initials', () => {
    expect(lifeLine({ birth: { year: 1901 }, death: { year: 1975 } })).toBe('1901 – 1975')
    expect(lifeLine({ birth: { year: 1901 }, death: null })).toBe('b. 1901')
    expect(lifeLine({ birth: null, death: { year: 0 } })).toBe('d. 0')
    expect(lifeLine({})).toBe('')
    expect(epithet({ occupation: ' Smith ', location: 'York' })).toBe('Smith · York')
    expect(epithet({ occupation: '', location: 'York' })).toBe('York')
    expect(initialsOf('Ada King Lovelace')).toBe('AL')
    expect(initialsOf('')).toBe('?')
    expect(initialsOf('zed')).toBe('ZE')
  })
})
