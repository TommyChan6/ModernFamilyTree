// Node shapes — pure data shared by the shader (NodeMaterial), the overlay
// (label / pill placement), picking and tests. No THREE / Vue imports.

// Shape ids consumed by the fragment shader's SDF switch (uShape). Append only:
// the index is the id.
export const NODE_SHAPES = [
  'circle',
  'square',
  'diamond',
  'hexagon',
  'shield',
  'oval',
  'octagon',
  'heart',
  'gravestone',
  'plate',
  'flatplate',
  'star'
]
export function nodeShapeId(name) {
  const i = NODE_SHAPES.indexOf(name)
  return i < 0 ? 0 : i
}

// How a shape sits on its node point, in node radii (screen y down):
//   lift    — the quad is raised this much so the shape STANDS on the point
//             (a gravestone's base is the point: in the Birth layout it rests
//             on its own birth-year line)
//   hitLift — centre of the clickable body above the point
//   top     — crown height above the point (pills / badges float above it)
//   bottom  — how far the drawing reaches below the point (labels go under)
//   labelAbove — the name sits ABOVE the crown instead of under the foot (the
//             plates: their foot is in the ground, so a name below would read
//             as written on the earth)
const FLAT = { lift: 0, hitLift: 0, top: 1, bottom: 1 }
// Standing shapes must share one `lift` (the shader bakes a single base line).
const ANCHORS = {
  gravestone: { lift: 0.6, hitLift: 0.95, top: 1.9, bottom: 0.3 },
  plate: { lift: 0.6, hitLift: 0.95, top: 2.0, bottom: 0.25, labelAbove: true },
  flatplate: { lift: 0.6, hitLift: 0.92, top: 1.9, bottom: 0.15, labelAbove: true },
  // A star is a small hot core in a wide glow: the name hugs the core, not the
  // node radius (its bloom and spikes spill past r on purpose).
  star: { lift: 0, hitLift: 0, top: 0.7, bottom: 0.5 }
}

export function shapeAnchor(shape) {
  return ANCHORS[shape] || FLAT
}

/** Distance (world px at k=1) from the node point down to its name label. */
export function shapeLabelDrop(shape, r) {
  const a = shapeAnchor(shape)
  return a.bottom * r + (a === FLAT ? 14 : 13)
}

/** True when this shape's name is drawn above its crown. */
export function shapeLabelAbove(shape) {
  return !!shapeAnchor(shape).labelAbove
}

/** Distance (world px at k=1) from the node point UP to the baseline of a name
 *  drawn above the crown (labelAbove shapes). */
export function shapeLabelRise(shape, r) {
  return shapeAnchor(shape).top * r + 8
}

/** Distance from the node point up to just above its crown — and above its
 *  name too when that sits on top (`labelSize` = the label's world size). */
export function shapeTopLift(shape, r, labelSize = 0) {
  const a = shapeAnchor(shape)
  return a.top * r + 13 + (a.labelAbove ? labelSize + 4 : 0)
}
