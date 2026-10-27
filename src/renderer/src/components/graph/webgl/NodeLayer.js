import * as THREE from 'three'
import { createNodeMaterial, QUAD_SCALE } from './NodeMaterial.js'
import { packStarState } from '../constellation'

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
    // Draw order: node index → instance slot. Instances draw in slot order, so
    // the renderer can paint standing nodes back-to-front (null = identity).
    this.slotOf = null
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
    // Scalars are packed four to an attribute — the shader is near the vertex-
    // attribute limit (ANGLE/D3D11 also spends one on gl_InstanceID).
    this.look = mk('iLook', 4) // border px, border alpha, opacity, atlas layer
    // selected (+ the star skin's magnitude/twinkle packed on top — constellation.ts),
    // glow, ink bloom birth, appear-pop start
    this.state = mk('iState', 4)
    // Aura (special effect from a tag / trait): ornament id, strength, ignite
    // start, colour packed as one 24-bit integer (exact in float32).
    this.aura = mk('iAura', 4)
    for (let i = 0; i < capacity; i++) {
      this.state[i * 4 + 2] = -1e4 // born: settled
      this.state[i * 4 + 3] = -1e4 // pop: settled
      this.aura[i * 4 + 2] = -1e4
    }

    g.instanceCount = this.count
    this.geometry = g
    this.mesh.geometry = g
    this.mesh.material = this.material
    this.capacity = capacity
  }

  setCount(n) {
    if (n > this.capacity) this._allocate(Math.ceil(n * 1.3) + 16)
    if (n !== this.count) this.slotOf = null
    this.count = n
    if (this.geometry) this.geometry.instanceCount = n
  }

  /** `order` lists node indices back-to-front; null restores index order. */
  setOrder(order) {
    if (!order) {
      this.slotOf = null
      return
    }
    const slotOf = new Int32Array(order.length)
    for (let j = 0; j < order.length; j++) slotOf[order[j]] = j
    this.slotOf = slotOf
  }

  setPosition(i, x, y) {
    if (this.slotOf) i = this.slotOf[i]
    this.pos[i * 2] = x
    this.pos[i * 2 + 1] = y
  }

  // s: { radius, fill:[r,g,b], border:[r,g,b], borderPx, opacity, selected, glow, avatar,
  //      auraId?, auraK?, auraBorn?, auraRGB?:[r,g,b], starK?, starTwinkle? }
  //      — auraId 0/absent = no aura; starK null/absent = not a star
  setStyle(i, s) {
    if (this.slotOf) i = this.slotOf[i]
    this.radius[i] = s.radius
    this.fill[i * 3] = s.fill[0]
    this.fill[i * 3 + 1] = s.fill[1]
    this.fill[i * 3 + 2] = s.fill[2]
    this.border[i * 3] = s.border[0]
    this.border[i * 3 + 1] = s.border[1]
    this.border[i * 3 + 2] = s.border[2]
    this.look[i * 4] = s.borderPx
    this.look[i * 4 + 1] = s.borderA == null ? 1 : s.borderA
    this.look[i * 4 + 2] = s.opacity
    this.look[i * 4 + 3] = s.avatar
    this.state[i * 4] = packStarState(!!s.selected, s.starK ?? null, !!s.starTwinkle)
    this.state[i * 4 + 1] = s.glow || 0
    this.state[i * 4 + 2] = s.born == null ? -1e4 : s.born
    this.state[i * 4 + 3] = s.pop == null ? -1e4 : s.pop
    this.aura[i * 4] = s.auraId || 0
    this.aura[i * 4 + 1] = s.auraK == null ? 1 : s.auraK
    this.aura[i * 4 + 2] = s.auraBorn == null ? -1e4 : s.auraBorn
    this.aura[i * 4 + 3] = packRGB(s.auraRGB)
  }

  commitPositions() {
    if (!this._attr.iPos) return // nothing allocated yet (empty tree)
    this._attr.iPos.needsUpdate = true
    this._attr.iRadius.needsUpdate = true
  }

  commitStyles() {
    if (!this._attr.iRadius) return
    for (const k of ['iRadius', 'iFill', 'iBorder', 'iLook', 'iState', 'iAura'])
      this._attr[k].needsUpdate = true
  }

  // Camera-dependent uniforms for the screen-space billboards: viewport size,
  // zoom, how far standing shapes rise off their point, and the tilt haze.
  setView(width, height, k, lift, fog) {
    const u = this.material.uniforms
    u.uViewScale.value.set(2 / Math.max(1, width), -2 / Math.max(1, height))
    u.uZoom.value = k
    u.uLift.value = lift
    u.uFog.value = fog
  }

  setThemeUniforms(isLight) {
    const u = this.material.uniforms
    // Gravestone materials: cool granite on dark ground; warmer, paler on light.
    if (isLight) {
      u.uStoneColor.value.set('#a9adb6')
      u.uSoilColor.value.set('#7a634b')
      u.uGrassColor.value.set('#5f9446')
      u.uMossColor.value.set('#70893f')
      u.uFrameColor.value.set('#9c7a4c')
    } else {
      u.uStoneColor.value.set('#8d939f')
      u.uSoilColor.value.set('#3a2f26')
      u.uGrassColor.value.set('#56803c')
      u.uMossColor.value.set('#667f3a')
      u.uFrameColor.value.set('#a8875a')
    }
    if (isLight) {
      u.uShadowStrength.value = 0.15
      u.uShadowOffset.value.set(0.045, 0.09)
      u.uSilhouetteColor.value.setRGB(1, 1, 1)
      u.uGlowColor.value.setRGB(0.16, 0.2, 0.3) // deep slate haze (white is invisible on light)
      u.uStarLight.value = 1 // star nodes print as an ink star atlas on light grounds
    } else {
      u.uShadowStrength.value = 0.35
      u.uShadowOffset.value.set(0.09, 0.135)
      u.uSilhouetteColor.value.setRGB(1, 1, 1)
      u.uGlowColor.value.setRGB(1, 1, 1) // white haze
      u.uStarLight.value = 0
    }
  }

  // 水墨 wash roundels. `on` switches the shader's ink branch; `mode` is
  // inkLook().mode ('paper' = rice paper, 'moon' = pale ink on dark, 'light').
  setInkUniforms(on, mode, sealHex) {
    const u = this.material.uniforms
    u.uInk.value = on ? 1 : 0
    const moon = mode === 'moon'
    u.uInkMoon.value = moon ? 1 : 0
    if (moon) {
      u.uInkColor.value.set('#e4dccb')
      u.uInkPaper.value.set('#1a1c22')
    } else {
      u.uInkColor.value.set('#1f1b16')
      u.uInkPaper.value.set('#efe6d2')
    }
    u.uSealColor.value.set(sealHex || '#b3352a')
    // Gravestones in ink: weathered stone in ink-and-paper tones (the theme's
    // own palette comes back through setThemeUniforms when ink turns off).
    if (on) {
      u.uStoneColor.value.set(moon ? '#6e6a62' : '#b8b0a0')
      u.uSoilColor.value.set(moon ? '#2e2a24' : '#6d5e4b')
      u.uGrassColor.value.set(moon ? '#55624a' : '#66744f')
      u.uMossColor.value.set(moon ? '#5f6a4a' : '#78805a')
      u.uFrameColor.value.set(moon ? '#8f7a58' : '#8a6d45')
    }
    if (on && mode === 'paper') u.uSilhouetteColor.value.set('#f4eddd')
    else if (on && moon) u.uSilhouetteColor.value.set('#e9e2d2')
    else u.uSilhouetteColor.value.setRGB(1, 1, 1)
  }

  dispose() {
    this.geometry?.dispose()
    this.material?.dispose()
  }
}

/** [r,g,b] (0..1) → one integer 0..0xffffff; the vertex shader unpacks it. */
export function packRGB(c) {
  if (!c) return 0xffffff
  const b8 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)))
  return b8(c[0]) * 65536 + b8(c[1]) * 256 + b8(c[2])
}

export { QUAD_SCALE }
