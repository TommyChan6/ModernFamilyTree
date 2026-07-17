import * as d3 from 'd3'

export function useGraphAnimation(ctx) {
  function cancelAnimation() {
    if (ctx.animTimer) {
      ctx.animTimer.stop()
      ctx.animTimer = null
    }
  }

  function animateToPositions(targets, onDone) {
    cancelAnimation()
    const duration = 500
    const ease = d3.easeCubicOut
    const startPos = {}
    ctx.nodesData.forEach((n) => {
      startPos[n.id] = { x: n.x, y: n.y }
    })

    ctx.animTimer = d3.timer((elapsed) => {
      const t = Math.min(1, ease(elapsed / duration))
      ctx.nodesData.forEach((n) => {
        const s = startPos[n.id],
          e = targets[n.id]
        if (!s || !e) return
        n.x = s.x + (e.x - s.x) * t
        n.y = s.y + (e.y - s.y) * t
        n.fx = n.x
        n.fy = n.y
      })
      ctx.ticked()
      if (t >= 1) {
        ctx.animTimer.stop()
        ctx.animTimer = null
        if (onDone) onDone()
      }
    })
  }

  // Morph every node from its current spot to `targets` while the camera pans
  // AND zooms to fit the whole target arrangement in the viewport, so no node
  // is left off screen when the new layout lands. `opts` gives each layout type
  // its own signature motion:
  //   ease      — the easing curve (a spring-y easeBackOut "snaps" into rows,
  //               easeCubicOut "settles")
  //   duration  — per-node travel time (ms)
  //   stagger   — total spread (ms) between the first and last node to start,
  //               so the layout resolves as a wave instead of all at once
  //   staggerBy — (node) => scalar ranking a node's place in that wave (e.g.
  //               target Y for a top-down cascade, distance for a radial bloom)
  function animateToPositionsWithReset(targets, onDone, opts = {}) {
    cancelAnimation()
    const duration = opts.duration ?? 500
    const ease = opts.ease ?? d3.easeCubicOut
    const stagger = opts.stagger ?? 0
    const startPos = {}
    ctx.nodesData.forEach((n) => {
      startPos[n.id] = { x: n.x, y: n.y }
    })

    // Per-node start delay: rank nodes by staggerBy, normalise to [0, stagger].
    const delay = {}
    if (stagger > 0 && typeof opts.staggerBy === 'function') {
      const ranked = ctx.nodesData
        .filter((n) => targets[n.id])
        .map((n) => ({ id: n.id, k: opts.staggerBy(n, targets[n.id]) }))
      const ks = ranked.map((r) => r.k)
      const lo = Math.min(...ks),
        hi = Math.max(...ks)
      const span = hi - lo || 1
      ranked.forEach((r) => {
        delay[r.id] = ((r.k - lo) / span) * stagger
      })
    }
    const total = duration + stagger

    const container = ctx.containerRef
    const w = container ? container.getBoundingClientRect().width : 800
    const h = container ? container.getBoundingClientRect().height : 600

    // End camera = fit ALL of the target arrangement inside the viewport, so
    // every node is on screen when the new layout lands (scale + translate).
    // Fit the undistorted layout — drop any directional stretch, like fitAll.
    ctx.transform.sx = 1
    ctx.transform.sy = 1
    const pad = 60
    const tVals = Object.values(targets)
    const endXs = tVals.map((t) => t.x),
      endYs = tVals.map((t) => t.y)
    const x0 = (endXs.length ? Math.min(...endXs) : 0) - pad,
      x1 = (endXs.length ? Math.max(...endXs) : w) + pad,
      y0 = (endYs.length ? Math.min(...endYs) : 0) - pad,
      y1 = (endYs.length ? Math.max(...endYs) : h) + pad
    const endK = Math.max(
      0.05,
      Math.min((0.92 * w) / Math.max(x1 - x0, 1), (0.92 * h) / Math.max(y1 - y0, 1), 2)
    )
    const endTx = w / 2 - (endK * (x0 + x1)) / 2,
      endTy = h / 2 - (endK * (y0 + y1)) / 2

    // Start from the live camera so there is no jump into the transition.
    const cur = ctx.zoomSelection ? d3.zoomTransform(ctx.zoomSelection.node()) : d3.zoomIdentity
    const startK = cur.k || 1,
      startTx = cur.x,
      startTy = cur.y

    ctx.animTimer = d3.timer((elapsed) => {
      ctx.nodesData.forEach((n) => {
        const s = startPos[n.id],
          e = targets[n.id]
        if (!s || !e) return
        const local = Math.min(1, Math.max(0, (elapsed - (delay[n.id] || 0)) / duration))
        const t = ease(local)
        n.x = s.x + (e.x - s.x) * t
        n.y = s.y + (e.y - s.y) * t
        n.fx = n.x
        n.fy = n.y
      })
      ctx.ticked()
      // Camera glides (pan + zoom) over the whole span with a smooth in-out so
      // it never races ahead of a staggered swarm, landing on the fit view.
      const ct = d3.easeCubicInOut(Math.min(1, elapsed / total))
      const k = startK + (endK - startK) * ct
      const tx = startTx + (endTx - startTx) * ct
      const ty = startTy + (endTy - startTy) * ct
      ctx.zoomSelection.call(ctx.zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(k))
      if (elapsed >= total) {
        // Land exactly on target (guards against easeBackOut overshoot residue).
        ctx.nodesData.forEach((n) => {
          const e = targets[n.id]
          if (!e) return
          n.x = e.x
          n.y = e.y
          n.fx = n.x
          n.fy = n.y
        })
        ctx.ticked()
        ctx.animTimer.stop()
        ctx.animTimer = null
        if (onDone) onDone()
      }
    })
  }

  return { cancelAnimation, animateToPositions, animateToPositionsWithReset }
}
