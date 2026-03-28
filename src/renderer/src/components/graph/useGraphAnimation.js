import * as d3 from 'd3'

export function useGraphAnimation(ctx) {
  function cancelAnimation() {
    if (ctx.animTimer) { ctx.animTimer.stop(); ctx.animTimer = null }
  }

  function animateToPositions(targets, onDone) {
    cancelAnimation()
    const duration = 500
    const ease = d3.easeCubicOut
    const startPos = {}
    ctx.nodesData.forEach(n => { startPos[n.id] = { x: n.x, y: n.y } })

    ctx.animTimer = d3.timer((elapsed) => {
      const t = Math.min(1, ease(elapsed / duration))
      ctx.nodesData.forEach(n => {
        const s = startPos[n.id], e = targets[n.id]
        if (!s || !e) return
        n.x = s.x + (e.x - s.x) * t
        n.y = s.y + (e.y - s.y) * t
        n.fx = n.x; n.fy = n.y
      })
      ctx.ticked()
      if (t >= 1) { ctx.animTimer.stop(); ctx.animTimer = null; if (onDone) onDone() }
    })
  }

  function animateToPositionsWithReset(targets, onDone) {
    cancelAnimation()
    const duration = 500
    const ease = d3.easeCubicOut
    const startPos = {}
    ctx.nodesData.forEach(n => { startPos[n.id] = { x: n.x, y: n.y } })

    const container = ctx.containerRef
    const w = container ? container.getBoundingClientRect().width : 800
    const h = container ? container.getBoundingClientRect().height : 600

    const startXs = ctx.nodesData.map(n => n.x), startYs = ctx.nodesData.map(n => n.y)
    const startCx = startXs.length ? (Math.min(...startXs) + Math.max(...startXs)) / 2 : w / 2
    const startCy = startYs.length ? (Math.min(...startYs) + Math.max(...startYs)) / 2 : h / 2
    const startTx = w / 2 - startCx, startTy = h / 2 - startCy

    const tVals = Object.values(targets)
    const endXs = tVals.map(t => t.x), endYs = tVals.map(t => t.y)
    const endCx = endXs.length ? (Math.min(...endXs) + Math.max(...endXs)) / 2 : w / 2
    const endCy = endYs.length ? (Math.min(...endYs) + Math.max(...endYs)) / 2 : h / 2
    const endTx = w / 2 - endCx, endTy = h / 2 - endCy

    ctx.svgSelection.call(ctx.zoomBehavior.transform, d3.zoomIdentity.translate(startTx, startTy))

    ctx.animTimer = d3.timer((elapsed) => {
      const t = Math.min(1, ease(elapsed / duration))
      ctx.nodesData.forEach(n => {
        const s = startPos[n.id], e = targets[n.id]
        if (!s || !e) return
        n.x = s.x + (e.x - s.x) * t
        n.y = s.y + (e.y - s.y) * t
        n.fx = n.x; n.fy = n.y
      })
      ctx.ticked()
      const tx = startTx + (endTx - startTx) * t
      const ty = startTy + (endTy - startTy) * t
      ctx.svgSelection.call(ctx.zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty))
      if (t >= 1) { ctx.animTimer.stop(); ctx.animTimer = null; if (onDone) onDone() }
    })
  }

  return { cancelAnimation, animateToPositions, animateToPositionsWithReset }
}
