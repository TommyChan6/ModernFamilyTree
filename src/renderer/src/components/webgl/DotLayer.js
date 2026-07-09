import * as THREE from 'three'

// Instanced filled circles. `pulse` (0/1) reproduces the timeline's living-end-of-life
// dot animation (scale 1→1.35, opacity 0.95→0.45 over a 2.2s cycle) in the shader, so
// a thousand pulsing dots cost one uniform write per frame.
const PULSE_MAX = 1.35

export class DotLayer {
  constructor({ renderOrder = 1 } = {}) {
    this.capacity = 0
    this.count = 0
    this.material = createDotMaterial()
    this.mesh = new THREE.Mesh()
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = renderOrder
    this._attr = {}
    this._allocate(16)
  }

  get object3d() { return this.mesh }

  _allocate(capacity) {
    if (this.geometry) this.geometry.dispose()
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(
      [-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3))
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
    this.color = mk('iColor', 3)
    this.opacity = mk('iOpacity', 1)
    this.pulse = mk('iPulse', 1)
    g.instanceCount = this.count
    this.geometry = g
    this.mesh.geometry = g
    this.mesh.material = this.material
    this.capacity = capacity
  }

  setCount(n) {
    if (n > this.capacity) this._allocate(Math.ceil(n * 1.3) + 16)
    this.count = n
    this.geometry.instanceCount = n
  }

  set(i, x, y, radius, rgb, opacity, pulse = 0) {
    this.pos[i * 2] = x; this.pos[i * 2 + 1] = y
    this.radius[i] = radius
    this.color[i * 3] = rgb[0]; this.color[i * 3 + 1] = rgb[1]; this.color[i * 3 + 2] = rgb[2]
    this.opacity[i] = opacity
    this.pulse[i] = pulse
  }

  commit() {
    if (!this._attr.iPos) return
    for (const k of ['iPos', 'iRadius', 'iColor', 'iOpacity', 'iPulse'])
      this._attr[k].needsUpdate = true
  }

  setTime(t) { this.material.uniforms.uTime.value = t }

  dispose() {
    this.geometry?.dispose()
    this.material?.dispose()
  }
}

function createDotMaterial() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      in vec2 iPos;
      in float iRadius;
      in vec3 iColor;
      in float iOpacity;
      in float iPulse;

      out vec2 vCorner;   // px offset from the centre
      out float vRadius;
      out vec3 vColor;
      out float vOpacity;
      out float vPulse;

      void main() {
        float half_ = iRadius * ${PULSE_MAX.toFixed(2)} + 1.5;
        vCorner = position.xy * half_;
        vRadius = iRadius;
        vColor = iColor; vOpacity = iOpacity; vPulse = iPulse;
        vec2 world = iPos + vCorner;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      in vec2 vCorner;
      in float vRadius;
      in vec3 vColor;
      in float vOpacity;
      in float vPulse;
      out vec4 fragColor;

      void main() {
        float s = (0.5 + 0.5 * sin(uTime * 2.856)) * vPulse; // 2π / 2.2s cycle
        float r = vRadius * (1.0 + 0.35 * s);
        float d = length(vCorner);
        float aa = fwidth(d) * 1.2 + 0.001;
        float alpha = (1.0 - smoothstep(r - aa, r + aa, d)) * mix(1.0, mix(0.95, 0.45, s), vPulse);
        float a = alpha * vOpacity;
        if (a < 0.003) discard;
        fragColor = vec4(vColor, a);
      }
    `,
  })
}
