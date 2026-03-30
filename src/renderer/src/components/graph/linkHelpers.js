// Pure functions for link/node styling — no D3 or store dependency

export function nodeColor(gender, gs) {
  if (gender === 'male') return gs.maleColor
  if (gender === 'female') return gs.femaleColor
  return gs.unknownColor
}

export function linkPath(d, lineCurvature) {
  const sx = d.source.x, sy = d.source.y, tx = d.target.x, ty = d.target.y
  const dx = tx - sx, dy = ty - sy
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  let hash = 0
  const idStr = d.id || ''
  for (let i = 0; i < idStr.length; i++) hash = ((hash << 5) - hash + idStr.charCodeAt(i)) | 0
  const sign = (hash & 1) ? 1 : -1
  const bendFactor = lineCurvature + (Math.abs(hash % 100) / 100) * (lineCurvature * 0.6)
  const offset = dist * bendFactor * sign
  const px = -dy / dist, py = dx / dist
  const mx = (sx + tx) / 2 + px * offset
  const my = (sy + ty) / 2 + py * offset
  return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`
}

export function isPaternal(d, persons) {
  if (d.type !== 'parent_child' && d.type !== 'adopted') return false
  const parent = persons.find(p => p.id === d.person_a_id)
  return parent && parent.gender === 'male'
}

export function isMaternal(d, persons) {
  if (d.type !== 'parent_child' && d.type !== 'adopted') return false
  const parent = persons.find(p => p.id === d.person_a_id)
  return parent && parent.gender === 'female'
}

export function getLinkStroke(d, emph, gs, persons) {
  if (emph === 'paternal' && isPaternal(d, persons)) return d.type === 'adopted' ? '#7bb8f0' : '#4a90d9'
  if (emph === 'maternal' && isMaternal(d, persons)) return d.type === 'adopted' ? '#eda0c4' : '#d94a8a'
  if (d.type === 'spouse') return gs.spouseColor
  if (d.type === 'adopted') return gs.adoptedColor
  return gs.parentChildColor
}

export function getLinkWidth(d, emph, gs, persons) {
  const base = d.type === 'spouse' ? gs.spouseWidth : d.type === 'adopted' ? gs.adoptedWidth : gs.parentChildWidth
  if (emph === 'paternal' && isPaternal(d, persons)) return base * 2.2
  if (emph === 'maternal' && isMaternal(d, persons)) return base * 2.2
  return base
}

export function getLinkEmphOpacity(d, emph, gs, persons) {
  const base = d.status === 'divorced' ? gs.linkOpacity * 0.5 : gs.linkOpacity
  if (emph === 'neutral') return base
  if (emph === 'paternal' && isPaternal(d, persons)) return Math.min(1, base * 1.3)
  if (emph === 'maternal' && isMaternal(d, persons)) return Math.min(1, base * 1.3)
  return base
}

export function getLinkMarker(d, emph, persons) {
  if (d.type === 'parent_child' || d.type === 'adopted') {
    if (emph === 'paternal' && isPaternal(d, persons)) return d.type === 'adopted' ? 'url(#arr-pat-ad)' : 'url(#arr-pat)'
    if (emph === 'maternal' && isMaternal(d, persons)) return d.type === 'adopted' ? 'url(#arr-mat-ad)' : 'url(#arr-mat)'
    return d.type === 'adopted' ? 'url(#arr-a)' : 'url(#arr)'
  }
  return null
}

export function getDashArray(d) {
  if (d.status === 'divorced') return '3,3'
  if (d.type === 'spouse') return '6,4'
  if (d.type === 'adopted') return '4,3'
  return null
}
