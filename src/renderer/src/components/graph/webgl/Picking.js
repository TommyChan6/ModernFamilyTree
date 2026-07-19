import { quadtree } from 'd3'
import { routePoints } from '../linkRouting.js'

// CPU picking. A d3.quadtree over node positions handles node hit-tests (rebuilt only when
// positions settle); links use analytic point-to-polyline distance on click. This avoids a
// GPU readPixels stall on every hover.
export class Picker {
  constructor() {
    this.tree = null
    this.dirty = true
  }

  invalidate() {
    this.dirty = true
  }

  _rebuild(nodes) {
    this.tree = quadtree()
      .x((d) => d.x)
      .y((d) => d.y)
      .addAll(nodes)
    this.dirty = false
  }

  // Nearest node within `radius` world units of (wx,wy), else null.
  pickNode(wx, wy, nodes, radius) {
    if (!nodes.length) return null
    if (this.dirty || !this.tree) this._rebuild(nodes)
    const found = this.tree.find(wx, wy, radius)
    return found || null
  }

  // Nearest link whose curve passes within `tol` world units of (wx,wy), else null.
  pickLink(wx, wy, links, gs, tol = 7) {
    let best = null,
      bestD = tol
    for (const d of links) {
      const { points } = routePoints(d, gs, 10)
      for (let i = 0; i < points.length - 1; i++) {
        const dist = segDist(wx, wy, points[i], points[i + 1])
        if (dist < bestD) {
          bestD = dist
          best = d
        }
      }
    }
    return best
  }
}

function segDist(px, py, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y
  const len2 = dx * dx + dy * dy || 1
  let t = ((px - a.x) * dx + (py - a.y) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const cx = a.x + t * dx,
    cy = a.y + t * dy
  return Math.hypot(px - cx, py - cy)
}
