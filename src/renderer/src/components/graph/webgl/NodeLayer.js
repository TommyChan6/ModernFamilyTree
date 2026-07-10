import * as THREE from 'three'
import { createNodeMaterial, QUAD_SCALE } from './NodeMaterial.js'

// Holds the instanced node mesh and its per-instance typed-array attributes. Positions are
// rewritten every frame (cheap); styles only when selection/theme/settings/highlights change.
export class NodeLayer {
  constructor({ atlasTexture, pixelRatio }) {
    this.capacity = 0
    this.count = 0
    this.material = createNodeMaterial({ atlasTexture, pixelRatio })
    this.geometry = null
    this.mesh = new THREE.Mesh() // replaced in _allocate
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 2
    this._attr = {}
    this._allocate(16) // ensure attributes always exist (empty tree, first frame)
  }

  get object3d() {
    return this.mesh
  }

  _allocate(capacity) {
    if (this.geometry) this.geometry.dispose()
    const g = new THREE.InstancedBufferGeometry()
    // Unit quad, corners in [-1,1]; reused for every instance.
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3)
    )
    g.setIndex([0, 1, 2, 2, 1, 3])

    const mk = (name, size) => {
      const arr = new Float32Array(capacity * size)
      const a = new THREE.InstancedBufferAttribute(arr, size)
      a.setUsage(THREE.DynamicDrawUsage)
      g.setAttribute(name, a)
      this._attr[name] = a
      return arr
    }
    this.pos = mk('iPos', 2)
    this.radius = mk('iRadius', 1)
    this.fill = mk('iFill', 3)
    this.border = mk('iBorder', 3)
    this.borderPx = mk('iBorderPx', 1)
    this.borderA = mk('iBorderA', 1)
    this.opacity = mk('iOpacity', 1)
    this.selected = mk('iSelected', 1)
    this.glow = mk('iGlow', 1)
    this.avatar = mk('iAvatar', 1)

    g.instanceCount = this.count
    this.geometry = g
    this.mesh.geometry = g
    this.mesh.material = this.material
    this.capacity = capacity
  }

  setCount(n) {
    if (n > this.capacity) this._allocate(Math.ceil(n * 1.3) + 16)
    this.count = n
    if (this.geometry) this.geometry.instanceCount = n
  }

  setPosition(i, x, y) {
    this.pos[i * 2] = x
    this.pos[i * 2 + 1] = y
  }

  // s: { radius, fill:[r,g,b], border:[r,g,b], borderPx, opacity, selected, glow, avatar }
  setStyle(i, s) {
    this.radius[i] = s.radius
    this.fill[i * 3] = s.fill[0]
    this.fill[i * 3 + 1] = s.fill[1]
    this.fill[i * 3 + 2] = s.fill[2]
    this.border[i * 3] = s.border[0]
    this.border[i * 3 + 1] = s.border[1]
    this.border[i * 3 + 2] = s.border[2]
    this.borderPx[i] = s.borderPx
    this.borderA[i] = s.borderA == null ? 1 : s.borderA
    this.opacity[i] = s.opacity
    this.selected[i] = s.selected ? 1 : 0
    this.glow[i] = s.glow || 0
    this.avatar[i] = s.avatar
  }

  commitPositions() {
    if (!this._attr.iPos) return // nothing allocated yet (empty tree)
    this._attr.iPos.needsUpdate = true
    this._attr.iRadius.needsUpdate = true
  }

  commitStyles() {
    if (!this._attr.iRadius) return
    for (const k of [
      'iRadius',
      'iFill',
      'iBorder',
      'iBorderPx',
      'iBorderA',
      'iOpacity',
      'iSelected',
      'iGlow',
      'iAvatar'
    ])
      this._attr[k].needsUpdate = true
  }

  setThemeUniforms(isLight) {
    const u = this.material.uniforms
    if (isLight) {
      u.uShadowStrength.value = 0.15
      u.uShadowOffset.value.set(0.045, 0.09)
      u.uSilhouetteColor.value.setRGB(1, 1, 1)
    } else {
      u.uShadowStrength.value = 0.35
      u.uShadowOffset.value.set(0.09, 0.135)
      u.uSilhouetteColor.value.setRGB(1, 1, 1)
    }
  }

  dispose() {
    this.geometry?.dispose()
    this.material?.dispose()
  }
}

export { QUAD_SCALE }
