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
  'gravestone'
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
const FLAT = { lift: 0, hitLift: 0, top: 1, bottom: 1 }
const ANCHORS = {
  gravestone: { lift: 0.6, hitLift: 0.95, top: 1.9, bottom: 0.3 }
}

export function shapeAnchor(shape) {
  return ANCHORS[shape] || FLAT
}

/** Distance (world px at k=1) from the node point down to its name label. */
export function shapeLabelDrop(shape, r) {
  const a = shapeAnchor(shape)
  return a.bottom * r + (a === FLAT ? 14 : 13)
}

/** Distance from the node point up to just above its crown. */
export function shapeTopLift(shape, r) {
  return shapeAnchor(shape).top * r + 13
}
