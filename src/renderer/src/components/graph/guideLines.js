import * as d3 from 'd3'

// Guide overlays for Age and Generation modes. Previously drawn as SVG; now they push
// descriptors (in WORLD coords) into the WebGL renderer's 2D overlay, which draws them
// each frame. Positional animations (current-year slide, generation-row redistribute)
// still tween via d3.timer, mutating the descriptors + node positions and requesting a
// redraw. The pure row-math helpers (nearestGenRowY, getNewGenY, resolveGenTarget) are
// unchanged and have no rendering dependency.

function overlay(ctx) {
  return ctx.renderer && ctx.renderer.overlay
}
function redraw(ctx) {
  if (ctx.requestRedraw) ctx.requestRedraw()
}

// Tracked guide-fade / row-redistribute timers so switching mode/state cancels stale ones
// (otherwise two timers race on the same descriptors). Returns nothing; fn returns true when done.
function runGuideTimer(ctx, fn) {
  if (!ctx.guideTimers) ctx.guideTimers = []
  const t = d3.timer((el) => {
    if (fn(el)) {
      t.stop()
      const i = ctx.guideTimers.indexOf(t)
      if (i >= 0) ctx.guideTimers.splice(i, 1)
    }
  })
  ctx.guideTimers.push(t)
}
export function cancelGuideTimers(ctx) {
  if (ctx.guideTimers) {
    ctx.guideTimers.forEach((t) => t.stop())
    ctx.guideTimers = []
  }
  if (ctx.currentYearTimer) {
    ctx.currentYearTimer.stop()
    ctx.currentYearTimer = null
  }
}

// Guide horizontal extent (world x) based on node positions. Kept for callers/tests.
export function getGuideExtentX(ctx) {
  if (!ctx.nodesData.length) return { x1: 30, x2: 800 }
  const xs = ctx.nodesData.map((d) => d.x)
  return { x1: Math.min(...xs) - 120, x2: Math.max(...xs) + 120 }
}

// The overlay recomputes width from node positions each frame, so this is now a no-op
// kept only so existing call sites don't break.
export function updateGuideWidths() {}

// ── Current-year line (Age mode) ─────────────────────────────────────────────
export function drawCurrentYearLine(ctx, ageInfo, year, animate = true) {
  const ov = overlay(ctx)
  if (!ov) return
  if (year == null || !ageInfo) {
    removeCurrentYearLine(ctx)
    return
  }

  const { minYear, maxYear, padding, usableHeight } = ageInfo
  const y = padding + ((year - minYear) / (maxYear - minYear || 1)) * usableHeight
  const label = `Now · ${year}`

  if (ctx.currentYearTimer) {
    ctx.currentYearTimer.stop()
    ctx.currentYearTimer = null
  }

  if (!ov.currentYear) {
    const line = { y, label, opacity: 0 }
    ov.currentYear = line
    ctx.currentYearTimer = d3.timer((el) => {
      if (ov.currentYear !== line) {
        ctx.currentYearTimer?.stop()
        ctx.currentYearTimer = null
        return true
      } // superseded/removed
      line.opacity = Math.min(1, el / 400)
      redraw(ctx)
      if (line.opacity >= 1) {
        ctx.currentYearTimer = null
        return true
      }
      return false
    })
    return
  }

  const line = ov.currentYear
  line.label = label
  if (animate) {
    const startY = line.y
    ctx.currentYearTimer = d3.timer((el) => {
      if (ov.currentYear !== line) {
        ctx.currentYearTimer?.stop()
        ctx.currentYearTimer = null
        return true
      }
      const t = Math.min(1, d3.easeCubicInOut(el / 450))
      line.y = startY + (y - startY) * t
      redraw(ctx)
      if (t >= 1) {
        ctx.currentYearTimer = null
        return true
      }
      return false
    })
  } else {
    line.y = y
    redraw(ctx)
  }
}

export function removeCurrentYearLine(ctx) {
  if (ctx.currentYearTimer) {
    ctx.currentYearTimer.stop()
    ctx.currentYearTimer = null
  }
  const ov = overlay(ctx)
  if (ov) {
    ov.currentYear = null
    redraw(ctx)
  }
}

// ── Mode guide lines ─────────────────────────────────────────────────────────
export function removeGuides(ctx) {
  cancelGuideTimers(ctx)
  const ov = overlay(ctx)
  if (ov) {
    ov.guides = []
    redraw(ctx)
  }
}

export function drawYearGuides(ctx, minYear, maxYear, padding, usableHeight) {
  const ov = overlay(ctx)
  if (!ov) return

  const range = maxYear - minYear
  let interval = 10
  if (range <= 30) interval = 5
  if (range <= 10) interval = 2
  if (range <= 4) interval = 1

  const startYear = Math.floor(minYear / interval) * interval
  const endYear = Math.ceil(maxYear / interval) * interval

  const guides = []
  for (let year = startYear; year <= endYear; year += interval) {
    const yRatio = (year - minYear) / (maxYear - minYear || 1)
    guides.push({
      y: padding + yRatio * usableHeight,
      label: String(year),
      kind: 'year',
      opacity: 0
    })
  }
  ov.guides = guides
  fadeInGuides(ctx, guides)
}

export function drawGenGuides(ctx, genInfo) {
  const ov = overlay(ctx)
  if (!ov) return
  const guides = genInfo.genLabels.map(({ label, y }) => ({ y, label, kind: 'gen', opacity: 0 }))
  ov.guides = guides
  fadeInGuides(ctx, guides)
}

function fadeInGuides(ctx, guides) {
  // Stop any in-flight guide fade first so two fades can't race on descriptors.
  if (ctx.guideTimers) {
    ctx.guideTimers.forEach((t) => t.stop())
    ctx.guideTimers = []
  }
  runGuideTimer(ctx, (el) => {
    const t = Math.min(1, el / 600)
    for (const g of guides) g.opacity = t
    redraw(ctx)
    return t >= 1
  })
}

// ── Generation row helpers (pure) ────────────────────────────────────────────
export function nearestGenRowY(y, ctx) {
  if (!ctx.genRowYValues.length) return y
  let best = ctx.genRowYValues[0],
    bestDist = Math.abs(y - best)
  for (let i = 1; i < ctx.genRowYValues.length; i++) {
    const dist = Math.abs(y - ctx.genRowYValues[i])
    if (dist < bestDist) {
      best = ctx.genRowYValues[i]
      bestDist = dist
    }
  }
  return best
}

export function getNewGenY(y, ctx) {
  if (!ctx.genRowYValues.length) return null
  const sorted = [...ctx.genRowYValues].sort((a, b) => a - b)
  const threshold = ctx.genRowSpacing * 0.45

  if (y < sorted[0] - threshold) return sorted[0] - ctx.genRowSpacing
  if (y > sorted[sorted.length - 1] + threshold)
    return sorted[sorted.length - 1] + ctx.genRowSpacing
  for (let i = 0; i < sorted.length - 1; i++) {
    const mid = (sorted[i] + sorted[i + 1]) / 2
    const halfGap = (sorted[i + 1] - sorted[i]) / 2
    if (y > sorted[i] + threshold && y < sorted[i + 1] - threshold && halfGap > 50) return mid
  }
  return null
}

// ── Generation "New Gen" drag preview ────────────────────────────────────────
export function updateGenPreview(y, ctx) {
  const ov = overlay(ctx)
  if (!ov) return
  const newY = getNewGenY(y, ctx)
  if (newY !== null) {
    ov.genPreview = { y: newY, label: 'New Gen', opacity: 1 }
  } else {
    ov.genPreview = null
  }
  redraw(ctx)
}

export function removeGenPreview(ctx) {
  const ov = overlay(ctx)
  if (ov) {
    ov.genPreview = null
    redraw(ctx)
  }
}

export function resolveGenTarget(y, ctx) {
  const newY = getNewGenY(y, ctx)
  if (newY !== null) {
    ctx.genRowYValues.push(newY)
    ctx.genRowYValues.sort((a, b) => a - b)
    return newY
  }
  return nearestGenRowY(y, ctx)
}

export function cleanupEmptyGenRows(ctx, snapshotFn, tickedFn) {
  const tolerance = 15
  ctx.genRowYValues = ctx.genRowYValues.filter((rowY) =>
    ctx.nodesData.some((n) => Math.abs(n.y - rowY) < tolerance)
  )
  redistributeGenRows(ctx, tickedFn)
  snapshotFn()
}

export function redistributeGenRows(ctx, tickedFn) {
  const ov = overlay(ctx)
  if (!ctx.genRowYValues.length || !ctx.containerRef || !ov) return
  const { height } = ctx.containerRef.getBoundingClientRect()
  const count = ctx.genRowYValues.length

  const oldSorted = [...ctx.genRowYValues].sort((a, b) => a - b)
  const totalSpan = (count - 1) * ctx.genRowSpacing
  const startY = (height - totalSpan) / 2
  const newYValues = oldSorted.map((_, i) => startY + i * ctx.genRowSpacing)

  const needsAnimation = oldSorted.some((oy, i) => Math.abs(oy - newYValues[i]) > 1)
  if (!needsAnimation) {
    ctx.genRowYValues = [...newYValues]
    ov.guides = newYValues.map((y, i) => ({ y, label: `Gen ${i + 1}`, kind: 'gen', opacity: 1 }))
    redraw(ctx)
    return
  }

  // Map each node to its target Y (closest old row -> matching new row).
  const nodeTargetY = {}
  ctx.nodesData.forEach((n) => {
    let closestOld = oldSorted[0],
      closestDist = Math.abs(n.y - closestOld)
    oldSorted.forEach((oy) => {
      const d = Math.abs(n.y - oy)
      if (d < closestDist) {
        closestOld = oy
        closestDist = d
      }
    })
    nodeTargetY[n.id] = newYValues[oldSorted.indexOf(closestOld)]
  })
  const nodeStartY = {}
  ctx.nodesData.forEach((n) => {
    nodeStartY[n.id] = n.y
  })

  ctx.genRowYValues = [...newYValues]

  const duration = 350
  const ease = d3.easeCubicOut
  runGuideTimer(ctx, (elapsed) => {
    const t = Math.min(1, ease(elapsed / duration))
    ctx.nodesData.forEach((n) => {
      const sy = nodeStartY[n.id],
        ey = nodeTargetY[n.id]
      if (sy === undefined || ey === undefined) return
      n.y = sy + (ey - sy) * t
      n.fy = n.y
    })
    ov.guides = oldSorted.map((oldY, i) => ({
      y: oldY + (newYValues[i] - oldY) * t,
      label: `Gen ${i + 1}`,
      kind: 'gen',
      opacity: 1
    }))
    tickedFn()
    if (t >= 1) {
      ctx.nodesData.forEach((n) => {
        if (nodeTargetY[n.id] !== undefined) {
          n.y = nodeTargetY[n.id]
          n.fy = n.y
        }
      })
      ov.guides = newYValues.map((y, i) => ({ y, label: `Gen ${i + 1}`, kind: 'gen', opacity: 1 }))
      tickedFn()
      return true
    }
    return false
  })
}
