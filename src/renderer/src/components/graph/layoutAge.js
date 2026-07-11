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
