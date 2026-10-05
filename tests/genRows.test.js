import { describe, it, expect } from 'vitest'
import {
  reconcileGenRows,
  cleanupEmptyGenRows,
  resolveGenTarget
} from '../src/renderer/src/components/graph/guideLines.js'

const nodes = (list) => list.map(([id, x, y]) => ({ id, x, y }))
const snapOf = (list) => Object.fromEntries(list.map(([id, x, y]) => [id, { x, y }]))

describe('reconcileGenRows', () => {
  it('leaves a healthy save exactly as it was', () => {
    const saved = [
      ['a', 10, 100],
      ['b', 50, 100],
      ['c', 30, 240]
    ]
    const res = reconcileGenRows(nodes(saved), snapOf(saved), [100, 240])
    expect(res.healed).toBe(false)
    expect(res.rows).toEqual([100, 240])
    expect(res.targets).toEqual(snapOf(saved))
  })

  it('repairs people saved at the old heights of re-spaced rows (by rank)', () => {
    // Rows glided from [100, 240, 380] to [30, 170, 310, 450]'s first three…
    // but the save caught everyone still on the old heights.
    const saved = [
      ['a', 0, 100],
      ['b', 0, 240],
      ['c', 0, 380],
      ['d', 0, 520]
    ]
    const res = reconcileGenRows(nodes(saved), snapOf(saved), [30, 170, 310, 450])
    expect(res.healed).toBe(true)
    expect(res.targets.a.y).toBe(30)
    expect(res.targets.b.y).toBe(170)
    expect(res.targets.c.y).toBe(310)
    expect(res.targets.d.y).toBe(450)
    expect(res.targets.a.x).toBe(0) // x untouched
  })

  it('snaps people missing from the save onto their nearest row', () => {
    const saved = [
      ['a', 0, 100],
      ['b', 0, 240]
    ]
    const live = nodes([...saved, ['new', 80, 225]])
    const res = reconcileGenRows(live, snapOf(saved), [100, 240])
    expect(res.healed).toBe(true)
    expect(res.targets.new).toEqual({ x: 80, y: 240 })
    expect(res.targets.a.y).toBe(100)
  })

  it('derives rows from the saved heights when none were stored', () => {
    const saved = [
      ['a', 0, 100],
      ['b', 0, 104],
      ['c', 0, 250]
    ]
    const res = reconcileGenRows(nodes(saved), snapOf(saved), undefined)
    expect(res.rows).toHaveLength(2)
    expect(res.rows[0]).toBeCloseTo(102)
    expect(res.targets.a.y).toBeCloseTo(102)
    expect(res.targets.b.y).toBeCloseTo(102)
    expect(res.targets.c.y).toBe(250)
  })
})

describe('generation-row glide vs. autosave', () => {
  // Minimal ctx: no renderer overlay → redistribution is skipped entirely, so
  // give it a fake overlay + container to exercise the animated path.
  function makeCtx(ys) {
    return {
      nodesData: ys.map((y, i) => ({ id: 'n' + i, x: i * 50, y, fy: y })),
      genRowYValues: [...new Set(ys)].sort((a, b) => a - b),
      genRowSpacing: 140,
      containerRef: { getBoundingClientRect: () => ({ height: 600 }) },
      renderer: { overlay: { guides: [] } },
      requestRedraw() {}
    }
  }

  it('the snapshot taken as rows start gliding sees the settled row heights', () => {
    const ctx = makeCtx([100, 240, 380])
    // Drop the bottom node below the last row → a new generation opens.
    const n = ctx.nodesData[2]
    n.y = resolveGenTarget(520, ctx)
    n.fy = n.y
    let saved = null
    cleanupEmptyGenRows(
      ctx,
      () => {
        // What snapshotActiveScene records: rowTargets win over live y.
        saved = Object.fromEntries(ctx.nodesData.map((d) => [d.id, ctx.rowTargets?.[d.id] ?? d.y]))
      },
      () => {}
    )
    // Rows were re-centred; every saved height sits on one of the new rows.
    for (const y of Object.values(saved)) {
      expect(ctx.genRowYValues.some((r) => Math.abs(r - y) < 1e-6)).toBe(true)
    }
    ctx.rowMotion?.timer.stop()
  })
})
