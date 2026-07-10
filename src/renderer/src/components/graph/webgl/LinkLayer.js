import * as THREE from 'three'
import { createLinkMaterial, createArrowMaterial } from './LinkMaterial.js'
import { linkCurvePoints } from '../linkHelpers.js'

const SEG = 14 // bezier tessellation segments
const VPL = (SEG + 1) * 2 // vertices per link (ribbon: 2 per sample point)
const IPL = SEG * 6 // indices per link

// Arrowhead template triangle pointing +x (tip at origin, body trailing behind).
const ARROW_TEMPLATE = [0, 0, 0, -1, -0.55, 0, -1, 0.55, 0]

export class LinkLayer {
  constructor() {
    this.capacity = 0
    this.count = 0
    this.material = createLinkMaterial()
    this.arrowMaterial = createArrowMaterial()
    this.mesh = new THREE.Mesh()
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 1
    this.arrowMesh = new THREE.Mesh()
    this.arrowMesh.frustumCulled = false
    this.arrowMesh.renderOrder = 1
    this._a = {}
    this._arr = {}
    this._allocate(16) // ensure geometry/attributes always exist (empty tree, first frame)
  }

  get object3d() {
    return this.mesh
  }
  get arrowObject3d() {
    return this.arrowMesh
  }

  _allocate(capacity) {
    this.mesh.geometry?.dispose()
    const g = new THREE.BufferGeometry()
    const mk = (name, size, Arr = Float32Array) => {
      const arr = new Arr(capacity * VPL * size)
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
    const index = new Uint32Array(capacity * IPL)
    for (let j = 0; j < capacity; j++) {
      const base = j * VPL,
        ib = j * IPL
      for (let s = 0; s < SEG; s++) {
        const a = base + s * 2,
          b = a + 1,
          c = a + 2,
          d = a + 3
        const o = ib + s * 6
        index[o] = a
        index[o + 1] = b
        index[o + 2] = c
        index[o + 3] = c
        index[o + 4] = b
        index[o + 5] = d
      }
    }
    g.setIndex(new THREE.BufferAttribute(index, 1))
    this.mesh.geometry = g
    this.mesh.material = this.material
    this.geometry = g

    // Arrowheads: instanced triangle.
    this.arrowMesh.geometry?.dispose()
    const ag = new THREE.InstancedBufferGeometry()
    ag.setAttribute('position', new THREE.Float32BufferAttribute(ARROW_TEMPLATE, 3))
    ag.setIndex([0, 1, 2])
    const amk = (name, size) => {
      const arr = new Float32Array(capacity * size)
      const a = new THREE.InstancedBufferAttribute(arr, size)
      a.setUsage(THREE.DynamicDrawUsage)
      ag.setAttribute(name, a)
      this._arr[name] = a
      return arr
    }
    this.aPos = amk('iPos', 2)
    this.aAngle = amk('iAngle', 1)
    this.aScale = amk('iScale', 1)
    this.aColor = amk('iColor', 3)
    this.arrowGeometry = ag
    this.arrowMesh.geometry = ag
    this.arrowMesh.material = this.arrowMaterial
    this.geometry.setDrawRange(0, this.count * IPL)
    ag.instanceCount = this.count
    this.capacity = capacity
  }

  setLinks(links) {
    if (links.length > this.capacity) this._allocate(Math.ceil(links.length * 1.3) + 8)
    this.count = links.length
    this.geometry.setDrawRange(0, links.length * IPL)
    this.arrowGeometry.instanceCount = links.length
  }

  // Per-frame: recompute ribbon vertex positions + arc length from current node positions.
  // `visual(d)` returns { width, arrowColorRGB:[r,g,b]|null, arrowSize } (already tweened).
  updateGeometry(links, gs, visual) {
    if (!this._a.position || !links.length) return // nothing allocated / no links yet
    for (let j = 0; j < links.length; j++) {
      const d = links[j]
      const vis = visual(d)
      const { points, control } = linkCurvePoints(d, gs.lineCurvature, SEG)
      const halfW = vis.width / 2
      const base = j * VPL
      let acc = 0
      for (let i = 0; i <= SEG; i++) {
        const p = points[i]
        const prev = points[Math.max(0, i - 1)],
          next = points[Math.min(SEG, i + 1)]
        let tx = next.x - prev.x,
          ty = next.y - prev.y
        const tl = Math.hypot(tx, ty) || 1
        tx /= tl
        ty /= tl
        const nx = -ty,
          ny = tx
        if (i > 0) acc += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y)
        const li = (base + i * 2) * 3,
          ri = (base + i * 2 + 1) * 3
        this.position[li] = p.x + nx * halfW
        this.position[li + 1] = p.y + ny * halfW
        this.position[li + 2] = 0
        this.position[ri] = p.x - nx * halfW
        this.position[ri + 1] = p.y - ny * halfW
        this.position[ri + 2] = 0
        this.arc[base + i * 2] = acc
        this.arc[base + i * 2 + 1] = acc
      }

      // Arrowhead at the target end, pulled back by the node radius, along the end tangent.
      if (vis.arrowColorRGB) {
        const T = points[SEG]
        let dx = T.x - control.x,
          dy = T.y - control.y
        const dl = Math.hypot(dx, dy) || 1
        dx /= dl
        dy /= dl
        const r = gs.nodeRadius
        this.aPos[j * 2] = T.x - dx * (r + 1)
        this.aPos[j * 2 + 1] = T.y - dy * (r + 1)
        this.aAngle[j] = Math.atan2(dy, dx)
        this.aScale[j] = vis.arrowSize
        const col = vis.arrowColorRGB
        this.aColor[j * 3] = col[0]
        this.aColor[j * 3 + 1] = col[1]
        this.aColor[j * 3 + 2] = col[2]
      } else {
        this.aScale[j] = 0
      }
    }
    this._a.position.needsUpdate = true
    this._a.aArc.needsUpdate = true
    for (const k of ['iPos', 'iAngle', 'iScale', 'iColor']) this._arr[k].needsUpdate = true
  }

  // On style change: per-link colour / opacity / dash pattern (same value on all its verts).
  // `visual(d)` returns { color:[r,g,b], opacity, dashLen, dashGap } (already tweened).
  updateStyles(links, visual) {
    if (!this._a.aColor || !links.length) return
    for (let j = 0; j < links.length; j++) {
      const d = links[j]
      const vis = visual(d)
      const col = vis.color
      const op = vis.opacity
      const dl = vis.dashLen || 0,
        gl = vis.dashGap || 0
      const base = j * VPL
      for (let v = 0; v < VPL; v++) {
        const vi = base + v
        this.color[vi * 3] = col[0]
        this.color[vi * 3 + 1] = col[1]
        this.color[vi * 3 + 2] = col[2]
        this.opacity[vi] = op
        this.dash[vi * 2] = dl
        this.dash[vi * 2 + 1] = gl
      }
    }
    this._a.aColor.needsUpdate = true
    this._a.aOpacity.needsUpdate = true
    this._a.aDash.needsUpdate = true
  }

  dispose() {
    this.geometry?.dispose()
    this.arrowGeometry?.dispose()
    this.material?.dispose()
    this.arrowMaterial?.dispose()
  }
}
