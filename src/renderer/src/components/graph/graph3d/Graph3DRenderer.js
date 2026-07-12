import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Node3DLayer } from './Node3DLayer.js'
import { Link3DLayer } from './Link3DLayer.js'
import { Overlay3D } from './Overlay3D.js'
import { AvatarAtlas } from '../webgl/AvatarAtlas.js'
import { approach, TWEEN_EPS } from '../webgl/tween.js'
import { boundingSphere3D, fitDistance, starfieldPositions } from './layout3D.js'

const _col = new THREE.Color()
function rgb(hex) {
  _col.set(hex || '#888')
  return [_col.r, _col.g, _col.b]
}

const _ray = new THREE.Raycaster()
const _ndc = new THREE.Vector2()
const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()

function easeCubicOut(t) {
  const u = 1 - t
  return 1 - u * u * u
}

// Owns the Three.js perspective scene for the experimental Space (3D) graph
// type. Same contract as WebGLGraphRenderer: the view keeps all state/logic and
// feeds this renderer through `hooks`; the renderer only draws and answers
// picking queries. Frames are on-demand — the loop keeps itself alive only
// while something moves (orbit damping, auto-rotate, a camera tween, a style
// tween) and idles at 0% CPU otherwise.
export class Graph3DRenderer {
  constructor({ glCanvas, overlayCanvas, hooks }) {
    this.hooks = hooks
    this.disposed = false
    this._scheduled = false
    this._lastT = null
    this.nodeStylesDirty = true
    this.linkStylesDirty = true
    this._nodeTweening = false
    this.nodes = []
    this.links = []
    this.sceneSphere = { x: 0, y: 0, z: 0, r: 400 }
    this.fogNear = 1200
    this.fogFar = 5200

    this._nodeAnim = new Map() // id -> { op, rad, glow, top, trad, tglow }
    this._nodeVis = new Map() // id -> visual (cached rgb etc.)
    this._camTween = null
    this._discs = [] // [{ mesh, material, label, targetOp }]
    this._discGroup = new THREE.Group()

    this.renderer = new THREE.WebGLRenderer({ canvas: glCanvas, alpha: true, antialias: true })
    this.renderer.setClearColor(0x000000, 0)
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.renderer.setPixelRatio(this.dpr)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(50, 1, 2, 40000)
    this.camera.position.set(0, 300, 900)

    this.atlas = new AvatarAtlas(() => {
      this.markNodeStylesDirty()
      this.requestRedraw()
    })
    this.nodeLayer = new Node3DLayer({ atlasTexture: this.atlas.texture })
    this.linkLayer = new Link3DLayer()
    this.scene.add(this.linkLayer.object3d)
    this.scene.add(this.linkLayer.arrowObject3d)
    this.scene.add(this.nodeLayer.object3d)
    this.scene.add(this._discGroup)

    // Starfield backdrop: deterministic shell of faint points, theme-aware.
    const stars = starfieldPositions(420, 5200, 9000, 7)
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(stars.positions, 3))
    this.starMaterial = new THREE.PointsMaterial({
      size: 2,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.3,
      color: 0xdde4ff,
      depthWrite: false
    })
    this.stars = new THREE.Points(starGeo, this.starMaterial)
    this.stars.renderOrder = 0
    this.scene.add(this.stars)

    // Standard 3D-app camera controls: left-drag orbit, right-drag pan,
    // wheel dolly, inertial damping. The overlay canvas is the event surface.
    this.controls = new OrbitControls(this.camera, overlayCanvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.rotateSpeed = 0.85
    this.controls.minDistance = 60
    this.controls.maxDistance = 16000
    this.controls.autoRotateSpeed = 0.7
    this.controls.addEventListener('change', () => this.requestRedraw())
    this.controls.addEventListener('start', () => {
      this._camTween = null // any manual input cancels a camera tween
    })

    this.overlay = new Overlay3D(overlayCanvas)

    this._frame = this._frame.bind(this)
    this._onContextLost = (e) => e.preventDefault()
    this._onContextRestored = () => {
      this.markAllDirty()
      this.requestRedraw()
    }
    glCanvas.addEventListener('webglcontextlost', this._onContextLost, false)
    glCanvas.addEventListener('webglcontextrestored', this._onContextRestored, false)
    this._glCanvas = glCanvas
  }

  resize(w, h) {
    this.width = w
    this.height = h
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / Math.max(h, 1)
    this.camera.updateProjectionMatrix()
    this.overlay.resize(w, h, this.dpr)
    this.requestRedraw()
  }

  setData(nodes, links) {
    this.nodes = nodes
    this.links = links
    this.nodeLayer.setCount(nodes.length)
    this.linkLayer.setCount(links.length)
    this.markAllDirty()
    this.requestRedraw()
  }

  markNodeStylesDirty() {
    this.nodeStylesDirty = true
  }
  markLinkStylesDirty() {
    this.linkStylesDirty = true
  }
  markAllDirty() {
    this.nodeStylesDirty = true
    this.linkStylesDirty = true
  }

  setTheme({ isLight, bg }) {
    this._bg = bg || (isLight ? '#f0f2f8' : '#0f1117')
    this.nodeLayer.material.uniforms.uFogColor.value.set(this._bg)
    this.linkLayer.setFog(this._bg, this.fogNear, this.fogFar)
    this.starMaterial.color.set(isLight ? 0x5a6488 : 0xdde4ff)
    this.starMaterial.opacity = isLight ? 0.22 : 0.3
    this.overlay.setTheme(isLight)
    this.markAllDirty()
    this.requestRedraw()
  }

  setAutoRotate(on) {
    this.controls.autoRotate = on
    this.requestRedraw()
  }

  // ── Generation-layer discs ──────────────────────────────────────────────────
  // One soft disc + rim per generation row; opacity tweens in/out on toggle.
  setLayers(layers, center, radius, visible) {
    // Rebuild if the layer set changed size; otherwise retarget in place.
    if (this._discs.length !== layers.length) {
      for (const d of this._discs) {
        this._discGroup.remove(d.mesh)
        d.mesh.geometry.dispose()
        d.material.dispose()
      }
      this._discs = layers.map(() => {
        const material = new THREE.ShaderMaterial({
          glslVersion: THREE.GLSL3,
          transparent: true,
          depthTest: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          uniforms: {
            uColor: { value: new THREE.Color(0x6c8ef5) },
            uOpacity: { value: 0 }
          },
          vertexShader: /* glsl */ `
            out vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: /* glsl */ `
            precision highp float;
            uniform vec3 uColor;
            uniform float uOpacity;
            in vec2 vUv;
            out vec4 fragColor;
            void main() {
              float d = length(vUv - 0.5) * 2.0;
              if (d > 1.0) discard;
              float fill = (1.0 - smoothstep(0.2, 1.0, d)) * 0.05;
              float rim = (smoothstep(0.965, 0.985, d) - smoothstep(0.992, 1.0, d)) * 0.4;
              float a = (fill + rim) * uOpacity;
              if (a < 0.003) discard;
              fragColor = vec4(uColor, a);
            }
          `
        })
        const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 96), material)
        mesh.rotation.x = -Math.PI / 2
        mesh.renderOrder = 1
        mesh.frustumCulled = false
        this._discGroup.add(mesh)
        return { mesh, material, label: '', y: 0, targetOp: 0 }
      })
    }
    layers.forEach((L, i) => {
      const d = this._discs[i]
      d.mesh.position.set(center.x, L.y, center.z)
      d.mesh.scale.set(radius, radius, 1)
      d.label = L.label
      d.y = L.y
      d.targetOp = visible ? 1 : 0
    })
    this.overlay.layerLabels = layers.map((L, i) => ({
      x: center.x - radius - 24,
      y: L.y,
      z: center.z,
      label: L.label,
      opacity: this._discs[i].material.uniforms.uOpacity.value
    }))
    this._layerCenter = center
    this._layerRadius = radius
    this.requestRedraw()
  }

  hideLayers() {
    for (const d of this._discs) d.targetOp = 0
    this.requestRedraw()
  }

  // ── Picking (analytic, world space) ────────────────────────────────────────
  _rayFrom(px, py) {
    _ndc.set((px / this.width) * 2 - 1, -((py / this.height) * 2 - 1))
    _ray.setFromCamera(_ndc, this.camera)
    return _ray.ray
  }

  pickNode(px, py, radius) {
    const ray = this._rayFrom(px, py)
    const R = radius * 1.1
    let best = null
    let bestT = Infinity
    for (const n of this.nodes) {
      _v1.set(n.x, n.y, n.z || 0).sub(ray.origin)
      const t = _v1.dot(ray.direction)
      if (t < 0 || t > bestT) continue
      const d2 = _v1.lengthSq() - t * t
      if (d2 <= R * R) {
        best = n
        bestT = t
      }
    }
    return best
  }

  pickLink(px, py, threshold = 7) {
    const ray = this._rayFrom(px, py)
    let best = null
    let bestT = Infinity
    for (const d of this.links) {
      const A = d.source
      const B = d.target
      if (!A || typeof A !== 'object' || !B || typeof B !== 'object') continue
      // Closest approach between the pick ray and the segment AB.
      _v1.set(B.x - A.x, B.y - A.y, (B.z || 0) - (A.z || 0)) // u
      _v2.set(A.x - ray.origin.x, A.y - ray.origin.y, (A.z || 0) - ray.origin.z) // w0 = A - o
      const a = _v1.lengthSq()
      const b = _v1.dot(ray.direction)
      const d0 = _v1.dot(_v2) // u·w0
      const e = ray.direction.dot(_v2) // v·w0
      const denom = a - b * b
      let s = denom > 1e-8 ? (b * e - d0) / denom : 0
      s = Math.min(1, Math.max(0, s))
      const t = b * s + e
      if (t < 0 || t > bestT) continue
      // distance² between the two closest points
      const cx = A.x + _v1.x * s - (ray.origin.x + ray.direction.x * t)
      const cy = A.y + _v1.y * s - (ray.origin.y + ray.direction.y * t)
      const cz = (A.z || 0) + _v1.z * s - (ray.origin.z + ray.direction.z * t)
      if (cx * cx + cy * cy + cz * cz <= threshold * threshold) {
        best = d
        bestT = t
      }
    }
    return best
  }

  /** World point where the pick ray meets the plane through `origin` facing the
   *  camera (used to drag nodes in a screen-parallel plane), or a horizontal
   *  plane at origin.y when `horizontal` is true (layered arrangement). */
  dragPoint(px, py, origin, horizontal = false) {
    const ray = this._rayFrom(px, py)
    const normal = horizontal
      ? _v1.set(0, 1, 0)
      : this.camera.getWorldDirection(_v1).multiplyScalar(-1)
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      normal,
      _v2.set(origin.x, origin.y, origin.z || 0)
    )
    const out = new THREE.Vector3()
    return ray.intersectPlane(plane, out) ? out : null
  }

  // ── Camera moves (all tweened) ─────────────────────────────────────────────
  _startCamTween(toTarget, toPos, dur = 700) {
    this._camTween = {
      t0: performance.now(),
      dur,
      fromTarget: this.controls.target.clone(),
      toTarget: toTarget.clone(),
      fromPos: this.camera.position.clone(),
      toPos: toPos.clone()
    }
    this.requestRedraw()
  }

  flyToNode(node, nodeRadius = 22) {
    const target = new THREE.Vector3(node.x, node.y, node.z || 0)
    const dir = this.camera.position.clone().sub(this.controls.target).normalize()
    const dist = Math.max(nodeRadius * 11, 200)
    this._startCamTween(target, target.clone().addScaledVector(dir, dist), 750)
  }

  fitAll(immediate = false) {
    const s = boundingSphere3D(this.nodes)
    if (!s) return
    const center = new THREE.Vector3(s.x, s.y, s.z)
    const dir =
      this.camera.position.distanceToSquared(this.controls.target) > 1
        ? this.camera.position.clone().sub(this.controls.target).normalize()
        : new THREE.Vector3(0.35, 0.35, 1).normalize()
    const dist = Math.min(fitDistance(s.r + 80, this.camera.fov, this.camera.aspect), 15000)
    const pos = center.clone().addScaledVector(dir, dist)
    if (immediate) {
      this.controls.target.copy(center)
      this.camera.position.copy(pos)
      this.controls.update()
      this.requestRedraw()
    } else {
      this._startCamTween(center, pos, 650)
    }
  }

  resetView() {
    const s = boundingSphere3D(this.nodes) || { x: 0, y: 0, z: 0, r: 400 }
    const center = new THREE.Vector3(s.x, s.y, s.z)
    // Default ¾ view: slightly above and to the side.
    const dir = new THREE.Vector3(0.4, 0.45, 1).normalize()
    const dist = Math.min(fitDistance(s.r + 80, this.camera.fov, this.camera.aspect), 15000)
    this._startCamTween(center, center.clone().addScaledVector(dir, dist), 700)
  }

  dollyBy(factor) {
    const dir = this.camera.position.clone().sub(this.controls.target)
    const dist = Math.min(
      this.controls.maxDistance,
      Math.max(this.controls.minDistance, dir.length() * factor)
    )
    const pos = this.controls.target.clone().addScaledVector(dir.normalize(), dist)
    this._startCamTween(this.controls.target, pos, 320)
  }

  requestRedraw() {
    if (this.disposed || this._scheduled) return
    this._scheduled = true
    requestAnimationFrame(this._frame)
  }

  // ── Style sync / tween (nodes tween opacity/radius/glow; links snap) ───────
  _syncNodeStyles() {
    const visual = this.hooks.nodeVisual
    const seen = new Set()
    for (const n of this.nodes) {
      const v = visual(n)
      const layer = v.imageUrl ? this.atlas.request(n.id, v.imageUrl) : -1
      v.avatar = layer >= 1 ? layer : 0
      v.fillRGB = rgb(v.fill)
      v.borderRGB = rgb(v.border)
      this._nodeVis.set(n.id, v)
      seen.add(n.id)
      let a = this._nodeAnim.get(n.id)
      if (!a) {
        a = { op: 0, rad: v.radius, glow: 0 }
        this._nodeAnim.set(n.id, a)
      }
      a.top = v.opacity
      a.trad = v.radius
      a.tglow = v.glow
    }
    for (const id of this._nodeAnim.keys()) {
      if (!seen.has(id)) {
        this._nodeAnim.delete(id)
        this._nodeVis.delete(id)
      }
    }
  }

  _stepNodeTweens(dt) {
    let moving = false
    for (const a of this._nodeAnim.values()) {
      a.op = approach(a.op, a.top, dt)
      a.rad = approach(a.rad, a.trad, dt)
      a.glow = approach(a.glow, a.tglow, dt)
      if (
        Math.abs(a.op - a.top) > TWEEN_EPS ||
        Math.abs(a.rad - a.trad) > TWEEN_EPS ||
        Math.abs(a.glow - a.tglow) > TWEEN_EPS
      )
        moving = true
    }
    return moving
  }

  _syncLinkStyles() {
    const visual = this.hooks.linkVisual
    const gs = this.hooks.getSettings()
    this.linkLayer.setNodeRadius(gs.nodeRadius)
    for (let i = 0; i < this.links.length; i++) {
      const d = this.links[i]
      const v = visual(d)
      this.linkLayer.writeStyle(i, {
        color: rgb(v.colorHex),
        opacity: v.opacity,
        dashLen: v.dashLen,
        dashGap: v.dashGap,
        width: Math.max(v.width, 1.4),
        arrowColorRGB: v.arrowColor ? rgb(v.arrowColor) : null,
        arrowSize: v.arrowSize * 1.4
      })
    }
    this.linkLayer.commitStyles()
  }

  _frame(ts) {
    this._scheduled = false
    if (this.disposed) return
    let dt = this._lastT != null ? (ts - this._lastT) / 1000 : 1 / 60
    if (!(dt > 0)) dt = 0
    if (dt > 0.05) dt = 0.05
    this._lastT = ts

    let alive = false

    // Camera tween (fly-to / fit / dolly)
    if (this._camTween) {
      const tw = this._camTween
      const t = Math.min(1, (performance.now() - tw.t0) / tw.dur)
      const k = easeCubicOut(t)
      this.controls.target.lerpVectors(tw.fromTarget, tw.toTarget, k)
      this.camera.position.lerpVectors(tw.fromPos, tw.toPos, k)
      if (t >= 1) this._camTween = null
      else alive = true
    }

    // Orbit damping / auto-rotate — returns true while still moving.
    if (this.controls.update()) alive = true

    if (this.nodeStylesDirty) {
      this._syncNodeStyles()
      this.nodeStylesDirty = false
      this._nodeTweening = true
    }
    if (this.linkStylesDirty) {
      this._syncLinkStyles()
      this.linkStylesDirty = false
    }
    if (this._nodeTweening) {
      this._nodeTweening = this._stepNodeTweens(dt)
      if (this._nodeTweening) alive = true
    }

    // Layer-disc opacity tweens
    for (let i = 0; i < this._discs.length; i++) {
      const d = this._discs[i]
      const u = d.material.uniforms.uOpacity
      u.value = approach(u.value, d.targetOp, dt)
      if (Math.abs(u.value - d.targetOp) > TWEEN_EPS) alive = true
      const lbl = this.overlay.layerLabels[i]
      if (lbl) lbl.opacity = u.value
    }

    // Depth fog follows the camera: fade starts past the focus distance.
    const sphere = boundingSphere3D(this.nodes)
    if (sphere) this.sceneSphere = sphere
    const dist = this.camera.position.distanceTo(this.controls.target)
    this.fogNear = dist * 0.55
    this.fogFar = dist + this.sceneSphere.r * 2.6 + 500
    this.nodeLayer.setFog(this._bg || '#0f1117', this.fogNear, this.fogFar)
    this.linkLayer.setFog(this._bg || '#0f1117', this.fogNear, this.fogFar)

    // Nodes: write every instance back-to-front so translucency (dimmed nodes,
    // glow halos) composites correctly against depth.
    const nodes = this.nodes
    const camPos = this.camera.position
    const fwd = this.camera.getWorldDirection(_v1)
    if (nodes.length) {
      const order = nodes.map((n, i) => i)
      const depth = new Float32Array(nodes.length)
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        depth[i] =
          (n.x - camPos.x) * fwd.x + (n.y - camPos.y) * fwd.y + ((n.z || 0) - camPos.z) * fwd.z
      }
      order.sort((a, b) => depth[b] - depth[a]) // furthest first
      const fallback = { op: 1, rad: 22, glow: 0 }
      for (let slot = 0; slot < order.length; slot++) {
        const n = nodes[order[slot]]
        const v = this._nodeVis.get(n.id)
        if (!v) continue
        const a = this._nodeAnim.get(n.id) || fallback
        this.nodeLayer.write(slot, n.x, n.y, n.z || 0, {
          radius: a.rad,
          fill: v.fillRGB,
          border: v.borderRGB,
          borderPx: v.borderPx,
          borderA: v.borderA,
          opacity: a.op,
          selected: v.selected,
          glow: a.glow,
          avatar: v.avatar
        })
      }
      this.nodeLayer.commit()
    }

    // Links: endpoints every frame (they follow the simulation).
    const links = this.links
    for (let i = 0; i < links.length; i++) {
      const d = links[i]
      const A = d.source
      const B = d.target
      if (!A || typeof A !== 'object' || !B || typeof B !== 'object') continue
      this.linkLayer.writeEndpoints(i, A.x, A.y, A.z || 0, B.x, B.y, B.z || 0)
    }
    this.linkLayer.commitEndpoints()

    this.atlas.flush()
    this.renderer.render(this.scene, this.camera)
    this.overlay.draw({
      ...this.hooks.overlayOpts(),
      camera: this.camera,
      fogNear: this.fogNear,
      fogFar: this.fogFar
    })

    if (alive) this.requestRedraw()
  }

  dispose() {
    this.disposed = true
    this._glCanvas?.removeEventListener('webglcontextlost', this._onContextLost)
    this._glCanvas?.removeEventListener('webglcontextrestored', this._onContextRestored)
    this.controls.dispose()
    for (const d of this._discs) {
      d.mesh.geometry.dispose()
      d.material.dispose()
    }
    this.stars.geometry.dispose()
    this.starMaterial.dispose()
    this.atlas.dispose()
    this.nodeLayer.dispose()
    this.linkLayer.dispose()
    this.renderer.dispose()
  }
}
