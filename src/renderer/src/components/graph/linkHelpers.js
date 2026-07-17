// Pure functions for link/node styling — no D3 or store dependency

import { lerpColorHex } from '../../../../shared/fields'

/** Node fill. `t` is the trait system's gender_t (0..1 gradient position):
 *  when present it lerps maleColor→femaleColor, so a slider/selection in the
 *  gender slot colors the node anywhere along the gradient. The string labels
 *  remain as the fallback for pre-trait data. */
export function nodeColor(gender, gs, t) {
  if (t != null && Number.isFinite(t)) return lerpColorHex(gs.maleColor, gs.femaleColor, t)
  if (gender === 'male') return gs.maleColor
  if (gender === 'female') return gs.femaleColor
  return gs.unknownColor
}

export function linkPath(d, lineCurvature) {
  const sx = d.source.x,
    sy = d.source.y,
    tx = d.target.x,
    ty = d.target.y
  const dx = tx - sx,
    dy = ty - sy
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  let hash = 0
  const idStr = d.id || ''
  for (let i = 0; i < idStr.length; i++) hash = ((hash << 5) - hash + idStr.charCodeAt(i)) | 0
  const sign = hash & 1 ? 1 : -1
  const bendFactor = lineCurvature + (Math.abs(hash % 100) / 100) * (lineCurvature * 0.6)
  const offset = dist * bendFactor * sign
  const px = -dy / dist,
    py = dx / dist
  const mx = (sx + tx) / 2 + px * offset
  const my = (sy + ty) / 2 + py * offset
  return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`
}

// Same quadratic Bézier as linkPath(), but sampled into `segments+1` points for WebGL
// tessellation. Returns { points:[{x,y},...], control:{x,y} } so the caller can also
// derive the end tangent (for arrowhead orientation). Deterministic per-edge bend.
export function linkCurvePoints(d, lineCurvature, segments = 14) {
  const sx = d.source.x,
    sy = d.source.y,
    tx = d.target.x,
    ty = d.target.y
  const dx = tx - sx,
    dy = ty - sy
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  let hash = 0
  const idStr = d.id || ''
  for (let i = 0; i < idStr.length; i++) hash = ((hash << 5) - hash + idStr.charCodeAt(i)) | 0
  const sign = hash & 1 ? 1 : -1
  const bendFactor = lineCurvature + (Math.abs(hash % 100) / 100) * (lineCurvature * 0.6)
  const offset = dist * bendFactor * sign
  const px = -dy / dist,
    py = dx / dist
  const mx = (sx + tx) / 2 + px * offset
  const my = (sy + ty) / 2 + py * offset
  const points = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments,
      u = 1 - t
    // Quadratic Bézier B(t) = u²·S + 2ut·C + t²·T
    const x = u * u * sx + 2 * u * t * mx + t * t * tx
    const y = u * u * sy + 2 * u * t * my + t * t * ty
    points.push({ x, y })
  }
  return { points, control: { x: mx, y: my } }
}

export function isPaternal(d, persons) {
  if (d.type !== 'parent_child' && d.type !== 'adopted') return false
  const parent = persons.find((p) => p.id === d.person_a_id)
  return parent && parent.gender === 'male'
}

export function isMaternal(d, persons) {
  if (d.type !== 'parent_child' && d.type !== 'adopted') return false
  const parent = persons.find((p) => p.id === d.person_a_id)
  return parent && parent.gender === 'female'
}

/** Statuses that mean "this relationship is over" — the edge renders faded
 *  and short-dashed whatever its type. */
export const ENDED_STATUSES = new Set(['divorced', 'ended', 'estranged', 'resolved'])

// Every helper takes the edge's RelationshipTypeDef as an optional trailing
// param (callers look it up via store.relTypeByKey). Without one — old call
// sites, tests — the legacy trio behaves exactly as before.

export function getLinkStroke(d, emph, gs, persons, def) {
  if (emph === 'paternal' && isPaternal(d, persons))
    return d.type === 'adopted' ? '#7bb8f0' : '#4a90d9'
  if (emph === 'maternal' && isMaternal(d, persons))
    return d.type === 'adopted' ? '#eda0c4' : '#d94a8a'
  if (d.type === 'spouse') return gs.spouseColor
  if (d.type === 'adopted') return gs.adoptedColor
  // Registry types carry their own swatch ('' = legacy trio → Style panel).
  if (def?.color) return def.color
  return gs.parentChildColor
}

export function getLinkWidth(d, emph, gs, persons) {
  const base =
    d.type === 'spouse'
      ? gs.spouseWidth
      : d.type === 'adopted'
        ? gs.adoptedWidth
        : gs.parentChildWidth
  if (emph === 'paternal' && isPaternal(d, persons)) return base * 2.2
  if (emph === 'maternal' && isMaternal(d, persons)) return base * 2.2
  return base
}

export function getLinkEmphOpacity(d, emph, gs, persons) {
  const base = ENDED_STATUSES.has(d.status) ? gs.linkOpacity * 0.5 : gs.linkOpacity
  if (emph === 'neutral') return base
  if (emph === 'paternal' && isPaternal(d, persons)) return Math.min(1, base * 1.3)
  if (emph === 'maternal' && isMaternal(d, persons)) return Math.min(1, base * 1.3)
  return base
}

export function getLinkMarker(d, emph, persons, def) {
  if (d.type === 'parent_child' || d.type === 'adopted') {
    if (emph === 'paternal' && isPaternal(d, persons))
      return d.type === 'adopted' ? 'url(#arr-pat-ad)' : 'url(#arr-pat)'
    if (emph === 'maternal' && isMaternal(d, persons))
      return d.type === 'adopted' ? 'url(#arr-mat-ad)' : 'url(#arr-mat)'
    return d.type === 'adopted' ? 'url(#arr-a)' : 'url(#arr)'
  }
  // Any other directed registry type (likes, mentor, subordinate, custom…)
  // gets the plain arrowhead; callers color it from the def.
  if (def?.directed) return 'url(#arr)'
  return null
}

export function getDashArray(d, def) {
  if (ENDED_STATUSES.has(d.status)) return '3,3'
  if (d.type === 'spouse') return '6,4'
  if (d.type === 'adopted') return '4,3'
  // Affinity-side registry types read as overlays: soft dash under weight 0.5,
  // sparse dots for repulsion edges (rivals).
  if (def && def.weight < 0) return '2,5'
  if (def && def.weight < 0.5) return '5,4'
  return null
}
