import * as THREE from 'three'
import { createLinkMaterial } from '../graph/webgl/LinkMaterial.js'

// Generic tessellated-curve ribbons (the LinkLayer geometry without the graph-specific
// curve math): the caller supplies the sample points per curve, this layer turns them
// into a constant-width triangle strip with per-vertex colour / opacity / dash pattern.
// Dash lengths are in the same units as the points (LinkMaterial measures arc length).
export class RibbonLayer {
  constructor({ segments = 16, renderOrder = 1 } = {}) {
    this.seg = segments
    this.vpl = (segments + 1) * 2 // vertices per curve
    this.ipl = segments * 6      // indices per curve
    this.capacity = 0
    this.count = 0
    this.material = createLinkMaterial()
    this.mesh = new THREE.Mesh()
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = renderOrder
    this._a = {}
    this._allocate(16)
  }

  get object3d() { return this.mesh }

  _allocate(capacity) {
    this.mesh.geometry?.dispose()
    const g = new THREE.BufferGeometry()
    const mk = (name, size) => {
      const arr = new Float32Array(capacity * this.vpl * size)
      const a = new THREE.BufferAttribute(arr, size)
      a.setUsage(THREE.DynamicDrawUsage)
      g.setAttribute(name, a)
      this._a[name] = a
      return arr
    }
    this.position = mk('position', 3)
    this.color = mk('aColor', 3)
    this.arc = mk('aArc', 1)
    this.dash = mk('aDash', 2)
    this.opacity = mk('aOpacity', 1)
    const index = new Uint32Array(capacity * this.ipl)
    for (let j = 0; j < capacity; j++) {
      const base = j * this.vpl, ib = j * this.ipl
      for (let s = 0; s < this.seg; s++) {
        const a = base + s * 2, b = a + 1, c = a + 2, d = a + 3
        const o = ib + s * 6
        index[o] = a; index[o + 1] = b; index[o + 2] = c
        index[o + 3] = c; index[o + 4] = b; index[o + 5] = d
      }
    }
    g.setIndex(new THREE.BufferAttribute(index, 1))
    g.setDrawRange(0, this.count * this.ipl)
    this.geometry = g
    this.mesh.geometry = g
    this.mesh.material = this.material
    this.capacity = capacity
  }

  setCount(n) {
    if (n > this.capacity) this._allocate(Math.ceil(n * 1.3) + 8)
    this.count = n
    this.geometry.setDrawRange(0, n * this.ipl)
  }

  // pts must have segments+1 entries of { x, y }.
  writeCurve(j, pts, width) {
    const SEG = this.seg, halfW = width / 2, base = j * this.vpl
    let acc = 0
    for (let i = 0; i <= SEG; i++) {
      const p = pts[i]
      const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(SEG, i + 1)]
      let tx = next.x - prev.x, ty = next.y - prev.y
      const tl = Math.hypot(tx, ty) || 1
      tx /= tl; ty /= tl
      const nx = -ty, ny = tx
      if (i > 0) acc += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y)
      const li = (base + i * 2) * 3, ri = (base + i * 2 + 1) * 3
      this.position[li] = p.x + nx * halfW; this.position[li + 1] = p.y + ny * halfW; this.position[li + 2] = 0
      this.position[ri] = p.x - nx * halfW; this.position[ri + 1] = p.y - ny * halfW; this.position[ri + 2] = 0
      this.arc[base + i * 2] = acc; this.arc[base + i * 2 + 1] = acc
    }
  }

  writeStyle(j, rgb, opacity, dashLen = 0, dashGap = 0) {
    const base = j * this.vpl
    for (let v = 0; v < this.vpl; v++) {
      const vi = base + v
      this.color[vi * 3] = rgb[0]; this.color[vi * 3 + 1] = rgb[1]; this.color[vi * 3 + 2] = rgb[2]
      this.opacity[vi] = opacity
      this.dash[vi * 2] = dashLen; this.dash[vi * 2 + 1] = dashGap
    }
  }

  commit() {
    if (!this._a.position) return
    for (const k of ['position', 'aColor', 'aArc', 'aDash', 'aOpacity'])
      this._a[k].needsUpdate = true
  }

  dispose() {
    this.geometry?.dispose()
    this.material?.dispose()
  }
}

// Shared bezier tessellation scratch helpers (allocation-free when reused).
export function sampleQuadratic(out, seg, x0, y0, cx, cy, x1, y1) {
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, u = 1 - t
    out[i].x = u * u * x0 + 2 * u * t * cx + t * t * x1
    out[i].y = u * u * y0 + 2 * u * t * cy + t * t * y1
  }
  return out
}

export function sampleCubic(out, seg, x0, y0, c1x, c1y, c2x, c2y, x1, y1) {
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, u = 1 - t
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t
    out[i].x = a * x0 + b * c1x + c * c2x + d * x1
    out[i].y = a * y0 + b * c1y + c * c2y + d * y1
  }
  return out
}

export function makeScratch(seg) {
  return Array.from({ length: seg + 1 }, () => ({ x: 0, y: 0 }))
}
