// Screen-space occlusion for the overlay — pure, no canvas/THREE.
//
// Names live on the 2D overlay ABOVE every WebGL node, so with standing nodes
// (gravestones, the perspective tilt) a far person's name would print across
// the body of someone standing in front of them. The overlay asks this index
// whether a label's box is covered by a NEARER body (deeper = lower foot on
// screen) and dims it, so the front character visually stays on top.

/** Screen box of a node's drawn body. `R` is the on-screen radius; standing
 *  shapes rise above their foot (sx, sy), flat ones are centred on it. */
export function bodyBox(shape, sx, sy, R) {
  if (shape === 'gravestone') {
    // upright 0.70r wide each side (plinth 0.83r), 1.85r tall above the foot
    return { x0: sx - 0.83 * R, y0: sy - 1.85 * R, x1: sx + 0.83 * R, y1: sy }
  }
  if (shape === 'plate') {
    // 0.66r each side plus the slab's edge, 1.9r tall above the foot
    return { x0: sx - 0.66 * R, y0: sy - 1.98 * R, x1: sx + 0.76 * R, y1: sy }
  }
  if (shape === 'flatplate') {
    return { x0: sx - 0.64 * R, y0: sy - 1.85 * R, x1: sx + 0.64 * R, y1: sy }
  }
  return { x0: sx - R, y0: sy - R, x1: sx + R, y1: sy + R }
}

/** Bucket bodies in a uniform grid; `covered(box, depth)` is true when any
 *  body with a greater depth (nearer) overlaps `box`. */
export function makeOccluder(bodies, cell = 96) {
  const grid = new Map()
  const key = (cx, cy) => cx * 73856093 + cy * 19349663
  bodies.forEach((b, i) => {
    for (let cx = Math.floor(b.x0 / cell); cx <= Math.floor(b.x1 / cell); cx++)
      for (let cy = Math.floor(b.y0 / cell); cy <= Math.floor(b.y1 / cell); cy++) {
        const k = key(cx, cy)
        let list = grid.get(k)
        if (!list) grid.set(k, (list = []))
        list.push(i)
      }
  })
  return {
    covered(box, depth) {
      for (let cx = Math.floor(box.x0 / cell); cx <= Math.floor(box.x1 / cell); cx++)
        for (let cy = Math.floor(box.y0 / cell); cy <= Math.floor(box.y1 / cell); cy++) {
          const list = grid.get(key(cx, cy))
          if (!list) continue
          for (const i of list) {
            const b = bodies[i]
            if (b.depth <= depth + 0.5) continue
            if (b.x0 < box.x1 && b.x1 > box.x0 && b.y0 < box.y1 && b.y1 > box.y0) return true
          }
        }
      return false
    }
  }
}
