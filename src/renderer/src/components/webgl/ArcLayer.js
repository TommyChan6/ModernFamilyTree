import * as THREE from 'three'

// Instanced ring segments — the faction-membership arcs around each person node.
// Angles are in radians in atan2 space (0 = +x, increasing clockwise on a y-down
// canvas); `spin` is an angular velocity (rad/s) applied via the uTime uniform so
// multi-faction rings orbit without any per-frame buffer writes.
export class ArcLayer {
  constructor({ renderOrder = 1 } = {}) {
    this.capacity = 0
    this.count = 0
    this.material = createArcMaterial()
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
    this.center = mk('iCenter', 2)
    this.radius = mk('iRadius', 1)
    this.a0 = mk('iA0', 1)
    this.a1 = mk('iA1', 1)
    this.width = mk('iWidth', 1)
    this.color = mk('iColor', 3)
    this.opacity = mk('iOpacity', 1)
    this.spin = mk('iSpin', 1)
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

  set(i, cx, cy, radius, a0, a1, width, rgb, opacity, spin = 0) {
    this.center[i * 2] = cx; this.center[i * 2 + 1] = cy
    this.radius[i] = radius
    this.a0[i] = a0; this.a1[i] = a1
    this.width[i] = width
    this.color[i * 3] = rgb[0]; this.color[i * 3 + 1] = rgb[1]; this.color[i * 3 + 2] = rgb[2]
    this.opacity[i] = opacity
    this.spin[i] = spin
  }

  commit() {
    if (!this._attr.iCenter) return
    for (const k of ['iCenter', 'iRadius', 'iA0', 'iA1', 'iWidth', 'iColor', 'iOpacity', 'iSpin'])
      this._attr[k].needsUpdate = true
  }

  setTime(t) { this.material.uniforms.uTime.value = t }

  dispose() {
    this.geometry?.dispose()
    this.material?.dispose()
  }
}

function createArcMaterial() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      in vec2 iCenter;
      in float iRadius;
      in float iA0;
      in float iA1;
      in float iWidth;
      in vec3 iColor;
      in float iOpacity;
      in float iSpin;

      out vec2 vCorner;
      out float vRadius;
      out float vA0;
      out float vSpan;
      out float vHalfW;
      out vec3 vColor;
      out float vOpacity;
      out float vSpin;

      void main() {
        float half_ = iRadius + iWidth * 0.5 + 1.5;
        vCorner = position.xy * half_;
        vRadius = iRadius;
        vA0 = iA0; vSpan = iA1 - iA0;
        vHalfW = iWidth * 0.5;
        vColor = iColor; vOpacity = iOpacity; vSpin = iSpin;
        vec2 world = iCenter + vCorner;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      in vec2 vCorner;
      in float vRadius;
      in float vA0;
      in float vSpan;
      in float vHalfW;
      in vec3 vColor;
      in float vOpacity;
      in float vSpin;
      out vec4 fragColor;

      const float TAU = 6.2831853;

      void main() {
        float d = length(vCorner);
        float aa = fwidth(d) * 1.2 + 0.001;
        float ring = 1.0 - smoothstep(vHalfW - aa, vHalfW + aa, abs(d - vRadius));
        float ang = atan(vCorner.y, vCorner.x) - uTime * vSpin;
        float rel = mod(ang - vA0, TAU);
        // soften the angular ends by roughly one pixel of arc
        float aaA = aa / max(vRadius, 0.001) + 0.015;
        float inArc = smoothstep(0.0, aaA, rel) * (1.0 - smoothstep(vSpan, vSpan + aaA, rel));
        float a = ring * inArc * vOpacity;
        if (a < 0.003) discard;
        fragColor = vec4(vColor, a);
      }
    `,
  })
}
