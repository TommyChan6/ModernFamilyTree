import * as THREE from 'three'

// Instanced rounded-cap line segments ("capsules"), one draw call for all of them.
// Used for timeline lifelines / death caps and faction tether / membership threads.
// Dash pattern is measured along the segment in the same units as the coordinates;
// `flow` animates the dash offset (units per second, driven by the uTime uniform).
export class CapsuleLayer {
  constructor({ renderOrder = 1 } = {}) {
    this.capacity = 0
    this.count = 0
    this.material = createCapsuleMaterial()
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
    this.p0 = mk('iP0', 2)
    this.p1 = mk('iP1', 2)
    this.width = mk('iWidth', 1)
    this.color = mk('iColor', 3)
    this.opacity = mk('iOpacity', 1)
    this.dash = mk('iDash', 2)
    this.flow = mk('iFlow', 1)
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

  set(i, x0, y0, x1, y1, width, rgb, opacity, dashLen = 0, dashGap = 0, flow = 0) {
    this.p0[i * 2] = x0; this.p0[i * 2 + 1] = y0
    this.p1[i * 2] = x1; this.p1[i * 2 + 1] = y1
    this.width[i] = width
    this.color[i * 3] = rgb[0]; this.color[i * 3 + 1] = rgb[1]; this.color[i * 3 + 2] = rgb[2]
    this.opacity[i] = opacity
    this.dash[i * 2] = dashLen; this.dash[i * 2 + 1] = dashGap
    this.flow[i] = flow
  }

  commit() {
    if (!this._attr.iP0) return
    for (const k of ['iP0', 'iP1', 'iWidth', 'iColor', 'iOpacity', 'iDash', 'iFlow'])
      this._attr[k].needsUpdate = true
  }

  setTime(t) { this.material.uniforms.uTime.value = t }

  dispose() {
    this.geometry?.dispose()
    this.material?.dispose()
  }
}

function createCapsuleMaterial() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      in vec2 iP0;
      in vec2 iP1;
      in float iWidth;
      in vec3 iColor;
      in float iOpacity;
      in vec2 iDash;
      in float iFlow;

      out float vAlong;   // signed distance along the segment axis (0..len inside)
      out float vPerp;    // signed distance across the segment axis
      out float vLen;
      out float vHalfW;
      out vec3 vColor;
      out float vOpacity;
      out vec2 vDash;
      out float vFlow;

      void main() {
        vec2 axis = iP1 - iP0;
        float len = length(axis);
        vec2 dir = len > 0.0001 ? axis / len : vec2(1.0, 0.0);
        vec2 nrm = vec2(-dir.y, dir.x);
        float halfW = iWidth * 0.5;
        float m = halfW + 1.5; // AA margin around the capsule
        float along = mix(-m, len + m, (position.y + 1.0) * 0.5);
        float perp = position.x * m;
        vAlong = along; vPerp = perp; vLen = len; vHalfW = halfW;
        vColor = iColor; vOpacity = iOpacity; vDash = iDash; vFlow = iFlow;
        vec2 world = iP0 + dir * along + nrm * perp;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      in float vAlong;
      in float vPerp;
      in float vLen;
      in float vHalfW;
      in vec3 vColor;
      in float vOpacity;
      in vec2 vDash;
      in float vFlow;
      out vec4 fragColor;

      void main() {
        float d = length(vec2(vAlong - clamp(vAlong, 0.0, vLen), vPerp));
        float aa = fwidth(d) * 1.2 + 0.001;
        float alpha = 1.0 - smoothstep(vHalfW - aa, vHalfW + aa, d);
        if (vDash.x > 0.0) {
          float period = vDash.x + vDash.y;
          float arc = mod(vAlong - uTime * vFlow, period);
          if (arc < 0.0) arc += period;
          if (arc > vDash.x) discard;
        }
        float a = alpha * vOpacity;
        if (a < 0.003) discard;
        fragColor = vec4(vColor, a);
      }
    `,
  })
}
