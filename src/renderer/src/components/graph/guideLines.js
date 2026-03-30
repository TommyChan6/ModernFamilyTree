import * as d3 from 'd3'

function guideColors(ctx) {
  const light = ctx.theme === 'light'
  return {
    stroke: light ? 'rgba(0, 0, 0, 0.10)' : 'rgba(232, 234, 246, 0.12)',
    fill: light ? 'rgba(0, 0, 0, 0.25)' : 'rgba(232, 234, 246, 0.3)',
    strokeGen: light ? 'rgba(0, 0, 0, 0.08)' : 'rgba(232, 234, 246, 0.10)',
    fillGen: light ? 'rgba(0, 0, 0, 0.20)' : 'rgba(232, 234, 246, 0.25)',
    preview: light ? 'rgba(108, 142, 245, 0.45)' : 'rgba(108, 142, 245, 0.35)',
    previewText: light ? 'rgba(108, 142, 245, 0.55)' : 'rgba(108, 142, 245, 0.45)',
  }
}

// Guide line extent based on node positions
export function getGuideExtentX(ctx) {
  if (!ctx.nodesData.length) return { x1: 30, x2: 800 }
  const xs = ctx.nodesData.map(d => d.x)
  return { x1: Math.min(...xs) - 120, x2: Math.max(...xs) + 120 }
}

export function updateGuideWidths(ctx) {
  if (!ctx.guideLineElements.length) return
  const { x1, x2 } = getGuideExtentX(ctx)
  ctx.guideLineElements.forEach(({ lineEl, textEl }) => {
    if (lineEl) lineEl.attr('x1', x1).attr('x2', x2)
    if (textEl) textEl.attr('x', x1 - 14)
  })
}

export function removeGuides(ctx) {
  if (!ctx.rootGroup) return
  ctx.guideLineElements = []
  ctx.rootGroup.selectAll('.mode-guides')
    .transition().duration(300).attr('opacity', 0).remove()
}

export function drawYearGuides(ctx, minYear, maxYear, padding, usableHeight) {
  if (!ctx.rootGroup) return
  const gc = guideColors(ctx)
  removeGuides(ctx)
  ctx.guideLineElements = []
  const guidesGroup = ctx.rootGroup.select('.guides-layer').append('g').attr('class', 'mode-guides')
  const { x1, x2 } = getGuideExtentX(ctx)

  const range = maxYear - minYear
  let interval = 10
  if (range <= 30) interval = 5
  if (range <= 10) interval = 2
  if (range <= 4) interval = 1

  const startYear = Math.floor(minYear / interval) * interval
  const endYear = Math.ceil(maxYear / interval) * interval

  for (let year = startYear; year <= endYear; year += interval) {
    const yRatio = (year - minYear) / (maxYear - minYear || 1)
    const y = padding + yRatio * usableHeight

    guidesGroup.append('line')
      .attr('x1', x1).attr('x2', x2).attr('y1', y).attr('y2', y)
      .attr('stroke', gc.stroke).attr('stroke-width', 1)
      .attr('stroke-dasharray', '6,4')
      .attr('opacity', 0).transition().duration(600).delay(400).attr('opacity', 1)

    guidesGroup.append('text')
      .attr('x', x1 - 14).attr('y', y + 4)
      .attr('fill', gc.fill).attr('font-size', 10)
      .attr('font-family', 'system-ui, sans-serif').attr('font-weight', 600)
      .text(year)
      .attr('opacity', 0).transition().duration(600).delay(400).attr('opacity', 1)
  }

  ctx.guideLineElements = []
  guidesGroup.selectAll('line').each(function () { ctx.guideLineElements.push({ lineEl: d3.select(this) }) })
  guidesGroup.selectAll('text').each(function (_, i) {
    if (ctx.guideLineElements[i]) ctx.guideLineElements[i].textEl = d3.select(this)
  })
}

export function drawGenGuides(ctx, genInfo) {
  if (!ctx.rootGroup) return
  const gc = guideColors(ctx)
  removeGuides(ctx)
  ctx.guideLineElements = []
  const guidesGroup = ctx.rootGroup.select('.guides-layer').append('g').attr('class', 'mode-guides')
  const { x1, x2 } = getGuideExtentX(ctx)

  genInfo.genLabels.forEach(({ label, y }) => {
    guidesGroup.append('line')
      .attr('x1', x1).attr('x2', x2).attr('y1', y).attr('y2', y)
      .attr('stroke', gc.strokeGen).attr('stroke-width', 1)
      .attr('stroke-dasharray', '8,5')
      .attr('opacity', 0).transition().duration(600).delay(400).attr('opacity', 1)

    guidesGroup.append('text')
      .attr('x', x1 - 14).attr('y', y + 4)
      .attr('fill', gc.fillGen).attr('font-size', 10)
      .attr('font-family', 'system-ui, sans-serif').attr('font-weight', 600)
      .text(label)
      .attr('opacity', 0).transition().duration(600).delay(400).attr('opacity', 1)
  })

  guidesGroup.selectAll('line').each(function () { ctx.guideLineElements.push({ lineEl: d3.select(this) }) })
  guidesGroup.selectAll('text').each(function (_, i) {
    if (ctx.guideLineElements[i]) ctx.guideLineElements[i].textEl = d3.select(this)
  })
}

export function redrawGenGuidesAnimated(ctx, oldYValues, newYValues) {
  if (!ctx.rootGroup) return
  const gc = guideColors(ctx)
  ctx.guideLineElements = []
  ctx.rootGroup.selectAll('.mode-guides').remove()

  const guidesGroup = ctx.rootGroup.select('.guides-layer').append('g').attr('class', 'mode-guides')
  const { x1, x2 } = getGuideExtentX(ctx)

  oldYValues.forEach((oldY, i) => {
    const newY = newYValues[i]

    const lineEl = guidesGroup.append('line')
      .attr('x1', x1).attr('x2', x2).attr('y1', oldY).attr('y2', oldY)
      .attr('stroke', gc.strokeGen).attr('stroke-width', 1)
      .attr('stroke-dasharray', '8,5').attr('opacity', 1)
    lineEl.transition().duration(400).ease(d3.easeCubicInOut).attr('y1', newY).attr('y2', newY)

    const textEl = guidesGroup.append('text')
      .attr('x', x1 - 14).attr('y', oldY + 4)
      .attr('fill', gc.fillGen).attr('font-size', 10)
      .attr('font-family', 'system-ui, sans-serif').attr('font-weight', 600)
      .text(`Gen ${i + 1}`).attr('opacity', 1)
    textEl.transition().duration(400).ease(d3.easeCubicInOut).attr('y', newY + 4)

    ctx.guideLineElements.push({ lineEl, textEl })
  })
}

// ── Generation row helpers ──────────────────────────────────────────────────

export function nearestGenRowY(y, ctx) {
  if (!ctx.genRowYValues.length) return y
  let best = ctx.genRowYValues[0], bestDist = Math.abs(y - best)
  for (let i = 1; i < ctx.genRowYValues.length; i++) {
    const dist = Math.abs(y - ctx.genRowYValues[i])
    if (dist < bestDist) { best = ctx.genRowYValues[i]; bestDist = dist }
  }
  return best
}

export function getNewGenY(y, ctx) {
  if (!ctx.genRowYValues.length) return null
  const sorted = [...ctx.genRowYValues].sort((a, b) => a - b)
  const threshold = ctx.genRowSpacing * 0.45

  if (y < sorted[0] - threshold) return sorted[0] - ctx.genRowSpacing
  if (y > sorted[sorted.length - 1] + threshold) return sorted[sorted.length - 1] + ctx.genRowSpacing
  for (let i = 0; i < sorted.length - 1; i++) {
    const mid = (sorted[i] + sorted[i + 1]) / 2
    const halfGap = (sorted[i + 1] - sorted[i]) / 2
    if (y > sorted[i] + threshold && y < sorted[i + 1] - threshold && halfGap > 50) return mid
  }
  return null
}

export function updateGenPreview(y, ctx) {
  const newY = getNewGenY(y, ctx)
  if (!ctx.rootGroup) return
  const gc = guideColors(ctx)
  const { x1, x2 } = getGuideExtentX(ctx)

  if (newY !== null) {
    if (!ctx.genPreviewLine) {
      const guidesLayer = ctx.rootGroup.select('.guides-layer')
      ctx.genPreviewLine = guidesLayer.append('g').attr('class', 'gen-preview').attr('opacity', 0)
      ctx.genPreviewLine.append('line')
        .attr('x1', x1).attr('x2', x2)
        .attr('stroke', gc.preview).attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6,4')
      ctx.genPreviewLine.append('text')
        .attr('x', x1 - 14)
        .attr('fill', gc.previewText).attr('font-size', 10)
        .attr('font-family', 'system-ui, sans-serif').attr('font-weight', 600)
        .text('New Gen')
      ctx.genPreviewLine.transition().duration(200).attr('opacity', 1)
    }
    ctx.genPreviewLine.select('line').attr('y1', newY).attr('y2', newY).attr('x1', x1).attr('x2', x2)
    ctx.genPreviewLine.select('text').attr('y', newY + 4).attr('x', x1 - 14)
    ctx.genPreviewLine.interrupt().attr('opacity', 1)
  } else {
    if (ctx.genPreviewLine) ctx.genPreviewLine.transition().duration(150).attr('opacity', 0)
  }
}

export function removeGenPreview(ctx) {
  if (ctx.genPreviewLine) {
    ctx.genPreviewLine.transition().duration(150).attr('opacity', 0).remove()
    ctx.genPreviewLine = null
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
  ctx.genRowYValues = ctx.genRowYValues.filter(rowY =>
    ctx.nodesData.some(n => Math.abs(n.y - rowY) < tolerance)
  )
  redistributeGenRows(ctx, tickedFn)
  snapshotFn()
}

export function redistributeGenRows(ctx, tickedFn) {
  if (!ctx.genRowYValues.length || !ctx.containerRef) return
  const gc = guideColors(ctx)
  const { height } = ctx.containerRef.getBoundingClientRect()
  const count = ctx.genRowYValues.length

  const oldSorted = [...ctx.genRowYValues].sort((a, b) => a - b)
  const totalSpan = (count - 1) * ctx.genRowSpacing
  const startY = (height - totalSpan) / 2

  const newYValues = oldSorted.map((_, i) => startY + i * ctx.genRowSpacing)

  // Check if anything actually needs to move
  const needsAnimation = oldSorted.some((oy, i) => Math.abs(oy - newYValues[i]) > 1)
  if (!needsAnimation) {
    ctx.genRowYValues = [...newYValues]
    return
  }

  // Map each node to its target Y
  const nodeTargetY = {}
  ctx.nodesData.forEach(n => {
    let closestOld = oldSorted[0], closestDist = Math.abs(n.y - closestOld)
    oldSorted.forEach(oy => {
      const dist = Math.abs(n.y - oy)
      if (dist < closestDist) { closestOld = oy; closestDist = dist }
    })
    const idx = oldSorted.indexOf(closestOld)
    nodeTargetY[n.id] = newYValues[idx]
  })

  const nodeStartY = {}
  ctx.nodesData.forEach(n => { nodeStartY[n.id] = n.y })

  ctx.genRowYValues = [...newYValues]

  // Build guide elements at old positions, then animate everything together
  ctx.guideLineElements = []
  ctx.rootGroup.selectAll('.mode-guides').remove()
  const guidesGroup = ctx.rootGroup.select('.guides-layer').append('g').attr('class', 'mode-guides')
  const { x1, x2 } = getGuideExtentX(ctx)

  const guideEls = oldSorted.map((oldY, i) => {
    const lineEl = guidesGroup.append('line')
      .attr('x1', x1).attr('x2', x2).attr('y1', oldY).attr('y2', oldY)
      .attr('stroke', gc.strokeGen).attr('stroke-width', 1)
      .attr('stroke-dasharray', '8,5').attr('opacity', 1)
    const textEl = guidesGroup.append('text')
      .attr('x', x1 - 14).attr('y', oldY + 4)
      .attr('fill', gc.fillGen).attr('font-size', 10)
      .attr('font-family', 'system-ui, sans-serif').attr('font-weight', 600)
      .text(`Gen ${i + 1}`).attr('opacity', 1)
    return { lineEl, textEl, oldY, newY: newYValues[i] }
  })
  ctx.guideLineElements = guideEls.map(({ lineEl, textEl }) => ({ lineEl, textEl }))

  // Animate nodes and guides together
  const duration = 350
  const ease = d3.easeCubicOut
  const timer = d3.timer((elapsed) => {
    const t = Math.min(1, ease(elapsed / duration))

    // Move nodes
    ctx.nodesData.forEach(n => {
      const sy = nodeStartY[n.id]
      const ey = nodeTargetY[n.id]
      if (sy === undefined || ey === undefined) return
      n.y = sy + (ey - sy) * t
      n.fy = n.y
    })
    tickedFn()

    // Move guides
    guideEls.forEach(({ lineEl, textEl, oldY, newY }) => {
      const y = oldY + (newY - oldY) * t
      lineEl.attr('y1', y).attr('y2', y)
      textEl.attr('y', y + 4)
    })

    if (t >= 1) {
      timer.stop()
      // Ensure exact final positions
      ctx.nodesData.forEach(n => {
        if (nodeTargetY[n.id] !== undefined) { n.y = nodeTargetY[n.id]; n.fy = n.y }
      })
      tickedFn()
    }
  })
}
