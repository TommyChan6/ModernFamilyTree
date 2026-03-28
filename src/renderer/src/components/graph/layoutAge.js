// Pure layout computation for Age mode

export function computeAgeYPositions(nodesData, height) {
  const padding = 80
  const usableHeight = height - padding * 2
  const years = nodesData.filter(n => n.birth_year).map(n => n.birth_year)
  const minYear = years.length ? Math.min(...years) : 1950
  const maxYear = years.length ? Math.max(...years) : 2000
  const yearSpan = maxYear - minYear || 1

  const yMap = {}
  nodesData.forEach(n => {
    const year = n.birth_year || maxYear
    const yRatio = (year - minYear) / yearSpan
    yMap[n.id] = padding + yRatio * usableHeight
  })
  return { yMap, minYear, maxYear, padding, usableHeight }
}
