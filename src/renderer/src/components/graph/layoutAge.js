// Pure layout computation for Age mode

import { toOrdinal } from '../../../../shared/calendarMath'

export function computeAgeYPositions(nodesData, height) {
  const padding = 80
  const usableHeight = height - padding * 2
  const years = nodesData.map((n) => toOrdinal(n.birth)).filter((y) => y != null)
  const minYear = years.length ? Math.min(...years) : 1950
  const maxYear = years.length ? Math.max(...years) : 2000
  const yearSpan = maxYear - minYear || 1

  const yMap = {}
  nodesData.forEach((n) => {
    const year = toOrdinal(n.birth) ?? maxYear
    const yRatio = (year - minYear) / yearSpan
    yMap[n.id] = padding + yRatio * usableHeight
  })
  return { yMap, minYear, maxYear, padding, usableHeight }
}

/** The whole year at world y on a Birth axis (inverse of the yMap mapping);
 *  `info` = { minYear, maxYear, padding, usableHeight } (ctx.yearGuideCtx). */
export function yearAtAgeY(info, y) {
  if (!info || !(info.usableHeight > 0)) return null
  const span = info.maxYear - info.minYear || 1
  return Math.round(info.minYear + ((y - info.padding) / info.usableHeight) * span)
}
