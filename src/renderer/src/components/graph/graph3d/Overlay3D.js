import * as THREE from 'three'

// Transparent 2D canvas over the 3D scene: node name/age labels projected from
// world space (distance-faded, LOD-culled) and generation-layer captions when
// the layered arrangement is on. Redrawn every rendered frame from the camera.

const _v = new THREE.Vector3()

export class Overlay3D {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.dpr = 1
    this.w = 0
    this.h = 0
    this.light = false
    this.layerLabels = [] // [{ x, y, z, label, opacity }] in world space
  }

  setTheme(isLight) {
    this.light = isLight
  }

  resize(w, h, dpr) {
    this.w = w
    this.h = h
    this.dpr = dpr
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.canvas.style.width = w + 'px'
    this.canvas.style.height = h + 'px'
  }

  _colors() {
    const l = this.light
    return {
      name: l ? '#4a5068' : 'rgba(232,234,246,0.85)',
      age: l ? '#9099b8' : 'rgba(158,163,184,0.85)',
      sel: '#6c8ef5',
      layer: l ? 'rgba(74,80,104,0.75)' : 'rgba(158,163,184,0.8)'
    }
  }

  // Project a world point → { x, y, dist } in CSS pixels, or null when the
  // point is behind the camera.
  _project(camera, x, y, z) {
    _v.set(x, y, z).applyMatrix4(camera.matrixWorldInverse)
    if (_v.z > -0.1) return null // behind (or on) the camera plane
    const dist = -_v.z
    _v.applyMatrix4(camera.projectionMatrix)
    return { x: (_v.x * 0.5 + 0.5) * this.w, y: (-_v.y * 0.5 + 0.5) * this.h, dist }
  }

  // opts: { camera, nodes, gs, showLabels, showAge, selectedId,
  //         labelOpacityOf(n), ageOf(n), fogNear, fogFar }
  draw(opts) {
    const ctx = this.ctx,
      c = this._colors()
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.w, this.h)
    const cam = opts.camera
    if (!cam) return
    // Pixels per world unit at distance d (perspective foreshortening).
    const fovTan = Math.tan((cam.fov * Math.PI) / 360)
    const pxPerUnit = (d) => this.h / (2 * fovTan * Math.max(d, 1))
    const fogAt = (d) =>
      Math.min(1, Math.max(0, (d - opts.fogNear) / Math.max(opts.fogFar - opts.fogNear, 1)))

    // ---- generation-layer captions ----
    for (const L of this.layerLabels) {
      if ((L.opacity ?? 1) <= 0.02) continue
      const p = this._project(cam, L.x, L.y, L.z)
      if (!p) continue
      const f = pxPerUnit(p.dist)
      const px = Math.min(15, Math.max(8, 16 * f))
      ctx.globalAlpha = (L.opacity ?? 1) * (1 - fogAt(p.dist) * 0.8)
      ctx.font = `700 ${px}px system-ui, sans-serif`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = c.layer
      ctx.fillText(L.label, p.x - 10, p.y)
    }
    ctx.globalAlpha = 1

    // ---- node labels ----
    if (!opts.showLabels) return
    const gs = opts.gs
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    const margin = 60
    for (const n of opts.nodes) {
      const p = this._project(cam, n.x, n.y, n.z || 0)
      if (!p) continue
      if (p.x < -margin || p.x > this.w + margin || p.y < -margin || p.y > this.h + margin) continue
      const f = pxPerUnit(p.dist)
      const fontPx = gs.labelSize * f * 1.6
      if (fontPx < 7) continue // LOD: unreadable at this distance
      const op = (opts.labelOpacityOf ? opts.labelOpacityOf(n) : 1) * (1 - fogAt(p.dist) * 0.85)
      if (op <= 0.02) continue
      const y = p.y + (gs.nodeRadius + 14) * f
      const first = n.name ? n.name.split(' ')[0] : ''
      ctx.globalAlpha = op
      ctx.font = `500 ${Math.min(fontPx, 18)}px system-ui, sans-serif`
      ctx.fillStyle = opts.selectedId === n.id ? c.sel : c.name
      const age = opts.showAge && opts.ageOf ? opts.ageOf(n) : null
      if (age != null) {
        ctx.fillText(first, p.x, y)
        ctx.font = `600 ${Math.min(fontPx, 18)}px system-ui, sans-serif`
        ctx.fillStyle = c.age
        const nameW = ctx.measureText(first).width
        ctx.textAlign = 'left'
        ctx.fillText(String(age), p.x + nameW / 2 + 4, y)
        ctx.textAlign = 'center'
      } else {
        ctx.fillText(first, p.x, y)
      }
    }
    ctx.globalAlpha = 1
  }
}
