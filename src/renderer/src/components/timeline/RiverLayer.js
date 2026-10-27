import * as THREE from 'three'

// Household rivers: each household's channel drawn as a soft translucent band
// between its two banks (triangle strips over flat stage px, rebuilt with the
// geometry frames like the other timeline layers). The water flows gently down
// the channel off the uTime uniform — no per-frame buffer writes; the renderer
// holds uTime at 0 under reduced motion. Three attributes only (position, aBand
// packed as side / along / alpha / end distance, aColor) — see the ANGLE note in
// CLAUDE.md: never add loose per-vertex scalars here, pack them.
export class RiverLayer {
  constructor({ renderOrder = 0.3 } = {}) {
    this.capacity = 0 // vertices
    this.icap = 0 // indices
    this.nv = 0
    this.ni = 0
    this.material = createMaterial()
    this.mesh = new THREE.Mesh()
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = renderOrder
    this._a = {}
    this._allocate(256, 768)
  }

  get object3d() {
    return this.mesh
  }

  _allocate(vcap, icap) {
    const old = this.geometry
    const g = new THREE.BufferGeometry()
    const mk = (name, size) => {
      const arr = new Float32Array(vcap * size)
      if (old?.attributes[name]) arr.set(old.attributes[name].array.subarray(0, this.nv * size))
      const a = new THREE.BufferAttribute(arr, size)
      a.setUsage(THREE.DynamicDrawUsage)
      g.setAttribute(name, a)
      this._a[name] = a
      return arr
    }
    this.position = mk('position', 3)
    this.bandData = mk('aBand', 4)
    this.color = mk('aColor', 3)
    const index = new Uint32Array(icap)
    if (old?.index) index.set(old.index.array.subarray(0, this.ni))
    const ia = new THREE.BufferAttribute(index, 1)
    ia.setUsage(THREE.DynamicDrawUsage)
    g.setIndex(ia)
    this.index = index
    g.setDrawRange(0, this.ni)
    old?.dispose()
    this.geometry = g
    this.mesh.geometry = g
    this.mesh.material = this.material
    this.capacity = vcap
    this.icap = icap
  }

  /** Start a new set of bands (call once per geometry frame). */
  begin() {
    this.nv = 0
    this.ni = 0
  }

  /**
   * One band: `pts` holds flat [lx, ly, rx, ry] per sample (left bank point,
   * right bank point), `n` samples top → bottom.
   */
  band(pts, n, rgb, alpha) {
    if (n < 2 || alpha <= 0.002) return
    const nv = this.nv + n * 2,
      ni = this.ni + (n - 1) * 6
    if (nv > this.capacity || ni > this.icap)
      this._allocate(Math.ceil(nv * 1.4) + 64, Math.ceil(ni * 1.4) + 192)
    // Arc length down the centre line (flow + soft ends).
    let total = 0
    const along = this._along || (this._along = [])
    along.length = n
    along[0] = 0
    for (let k = 1; k < n; k++) {
      const cx0 = (pts[(k - 1) * 4] + pts[(k - 1) * 4 + 2]) / 2,
        cy0 = (pts[(k - 1) * 4 + 1] + pts[(k - 1) * 4 + 3]) / 2
      const cx1 = (pts[k * 4] + pts[k * 4 + 2]) / 2,
        cy1 = (pts[k * 4 + 1] + pts[k * 4 + 3]) / 2
      total += Math.hypot(cx1 - cx0, cy1 - cy0)
      along[k] = total
    }
    const P = this.position,
      B = this.bandData,
      C = this.color
    const v0 = this.nv
    for (let k = 0; k < n; k++) {
      const end = Math.min(along[k], total - along[k])
      for (let s = 0; s < 2; s++) {
        const v = v0 + k * 2 + s
        P[v * 3] = pts[k * 4 + s * 2]
        P[v * 3 + 1] = pts[k * 4 + s * 2 + 1]
        P[v * 3 + 2] = 0
        B[v * 4] = s ? 1 : -1
        B[v * 4 + 1] = along[k]
        B[v * 4 + 2] = alpha
        B[v * 4 + 3] = end
        C[v * 3] = rgb[0]
        C[v * 3 + 1] = rgb[1]
        C[v * 3 + 2] = rgb[2]
      }
    }
    const I = this.index
    let o = this.ni
    for (let k = 0; k < n - 1; k++) {
      const a = v0 + k * 2
      I[o++] = a
      I[o++] = a + 1
      I[o++] = a + 2
      I[o++] = a + 2
      I[o++] = a + 1
      I[o++] = a + 3
    }
    this.nv = nv
    this.ni = ni
  }

  commit() {
    for (const k of ['position', 'aBand', 'aColor']) this._a[k].needsUpdate = true
    this.geometry.index.needsUpdate = true
    this.geometry.setDrawRange(0, this.ni)
  }

  setTime(t) {
    this.material.uniforms.uTime.value = t
  }
  /** Light themes (light / ink / medieval): a darker, denser tint. */
  setLight(on) {
    this.material.uniforms.uLight.value = on ? 1 : 0
  }

  dispose() {
    this.geometry?.dispose()
    this.material?.dispose()
  }
}

function createMaterial() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uLight: { value: 0 } },
    vertexShader: /* glsl */ `
      in vec4 aBand;
      in vec3 aColor;
      out vec4 vBand;
      out vec3 vColor;
      void main() {
        vBand = aBand;
        vColor = aColor;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform float uLight;
      in vec4 vBand;
      in vec3 vColor;
      out vec4 fragColor;
      void main() {
        float s = abs(vBand.x);
        float along = vBand.y;
        // Body: a calm wash that thins toward the banks, then a fine bank line.
        float body = 1.0 - smoothstep(0.55, 1.0, s) * 0.55;
        float bank = smoothstep(0.86, 0.97, s) * (1.0 - smoothstep(0.985, 1.0, s));
        // Flow: slow ripples drifting down the channel (frozen when uTime = 0).
        float seed = dot(vColor, vec3(7.1, 3.7, 5.3));
        float w = sin(along * 0.05 - uTime * 1.4 + vBand.x * 1.7 + seed)
                * sin(along * 0.021 - uTime * 0.6 + seed * 1.3);
        float ripple = smoothstep(0.35, 1.0, w) * (1.0 - s);
        float ends = smoothstep(0.0, 22.0, vBand.w);
        float a = vBand.z * ends * (body * (0.85 + 0.5 * ripple) + bank * (uLight > 0.5 ? 1.6 : 2.2));
        if (a < 0.002) discard;
        vec3 col = mix(vColor, vec3(1.0), ripple * (uLight > 0.5 ? 0.12 : 0.22));
        fragColor = vec4(col, a);
      }
    `
  })
}
