// Pure coordinate helpers shared by the camera, overlay, picking and drag.
//
// The graph uses a screen-space, y-DOWN world (identical to the old SVG group and to
// what d3-force computes). A d3.zoom transform { x, y, k } maps world → screen exactly
// like the old `rootGroup.attr('transform', ...)` did:
//
//     screenX = worldX * k + x
//     screenY = worldY * k + y

export function worldToScreen(wx, wy, t) {
  return { x: wx * t.k + t.x, y: wy * t.k + t.y }
}

export function screenToWorld(px, py, t) {
  return { x: (px - t.x) / t.k, y: (py - t.y) / t.k }
}

// Fit-to-extent: given the world-space bounding box of the nodes and the viewport size,
// return the { x, y, k } that centres the box with a margin. `maxScale` caps zoom-in so a
// tiny/one-node tree is not blown up absurdly (matches the old fitAll cap of 2).
export function fitExtent(minX, minY, maxX, maxY, width, height, pad = 60, maxScale = 2) {
  const x0 = minX - pad,
    x1 = maxX + pad,
    y0 = minY - pad,
    y1 = maxY + pad
  const w = Math.max(1, x1 - x0),
    h = Math.max(1, y1 - y0)
  const k = Math.min((0.9 * width) / w, (0.9 * height) / h, maxScale)
  const x = width / 2 - (k * (x0 + x1)) / 2
  const y = height / 2 - (k * (y0 + y1)) / 2
  return { x, y, k }
}

// Bounding box of node positions (reads n.x / n.y). Returns null when empty.
export function nodesExtent(nodes) {
  if (!nodes || !nodes.length) return null
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const n of nodes) {
    if (n.x < minX) minX = n.x
    if (n.y < minY) minY = n.y
    if (n.x > maxX) maxX = n.x
    if (n.y > maxY) maxY = n.y
  }
  return { minX, minY, maxX, maxY }
}
