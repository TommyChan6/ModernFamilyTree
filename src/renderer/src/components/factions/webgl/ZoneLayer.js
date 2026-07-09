import * as THREE from 'three'

// Instanced faction zones: translucent disc + ring stroke + optional dashed
// "marching ants" drop-target halo, all in one draw call. Coordinates and widths
// are in world units (the camera transform scales them, like the old SVG group).
const DROP_OFFSET = 8   // halo sits this far outside the ring
const ANTS_SPEED = 16.4 // world units/s ≈ the old 18-unit dash cycle per 1.1s

export class ZoneLayer {
  constructor({ renderOrder = 1 } = {}) {
    this.capacity = 0
    this.count = 0
    this.material = createZoneMaterial()
    this.mesh = new THREE.Mesh()
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = renderOrder
    this._attr = {}
    this._allocate(8)
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
    this.r = mk('iR', 1)
    this.color = mk('iColor', 3)
    this.fillA = mk('iFillA', 1)
    this.ringA = mk('iRingA', 1)
    this.ringW = mk('iRingW', 1)
    this.dropA = mk('iDropA', 1)
    this.scale = mk('iScale', 1)
    this.opacity = mk('iOpacity', 1)
    g.instanceCount = this.count
    this.geometry = g
    this.mesh.geometry = g
    this.mesh.material = this.material
    this.capacity = capacity
  }

  setCount(n) {
    if (n > this.capacity) this._allocate(Math.ceil(n * 1.3) + 8)
    this.count = n
    this.geometry.instanceCount = n
  }

  set(i, x, y, r, rgb, { fillA, ringA, ringW, dropA, scale, opacity }) {
    this.center[i * 2] = x; this.center[i * 2 + 1] = y
    this.r[i] = r
    this.color[i * 3] = rgb[0]; this.color[i * 3 + 1] = rgb[1]; this.color[i * 3 + 2] = rgb[2]
    this.fillA[i] = fillA
    this.ringA[i] = ringA
    this.ringW[i] = ringW
    this.dropA[i] = dropA
    this.scale[i] = scale
    this.opacity[i] = opacity
  }

  commit() {
    if (!this._attr.iCenter) return
    for (const k of ['iCenter', 'iR', 'iColor', 'iFillA', 'iRingA', 'iRingW', 'iDropA', 'iScale', 'iOpacity'])
      this._attr[k].needsUpdate = true
  }

  setTime(t) { this.material.uniforms.uTime.value = t }

  dispose() {
    this.geometry?.dispose()
    this.material?.dispose()
  }
}

function createZoneMaterial() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      in vec2 iCenter;
      in float iR;
      in vec3 iColor;
      in float iFillA;
      in float iRingA;
      in float iRingW;
      in float iDropA;
      in float iScale;
      in float iOpacity;

      out vec2 vCorner;
      out float vR;
      out vec3 vColor;
      out float vFillA;
      out float vRingA;
      out float vRingW;
      out float vDropA;
      out float vOpacity;

      void main() {
        float R = iR * iScale;
        float half_ = R + ${(DROP_OFFSET + 4).toFixed(1)};
        vCorner = position.xy * half_;
        vR = R;
        vColor = iColor; vFillA = iFillA; vRingA = iRingA; vRingW = iRingW;
        vDropA = iDropA; vOpacity = iOpacity;
        vec2 world = iCenter + vCorner;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      in vec2 vCorner;
      in float vR;
      in vec3 vColor;
      in float vFillA;
      in float vRingA;
      in float vRingW;
      in float vDropA;
      in float vOpacity;
      out vec4 fragColor;

      void main() {
        float d = length(vCorner);
        float aa = fwidth(d) * 1.2 + 0.001;
        float fill = (1.0 - smoothstep(vR - aa, vR + aa, d)) * vFillA;
        float ring = (1.0 - smoothstep(vRingW * 0.5, vRingW * 0.5 + aa, abs(d - vR))) * vRingA;
        float alpha = max(fill, ring);
        if (vDropA > 0.003) {
          float R2 = vR + ${DROP_OFFSET.toFixed(1)};
          float band = 1.0 - smoothstep(1.0, 1.0 + aa, abs(d - R2));
          float arcpos = atan(vCorner.y, vCorner.x) * R2 - uTime * ${ANTS_SPEED.toFixed(1)};
          float dash = step(mod(arcpos, 18.0), 10.0);
          alpha = max(alpha, band * dash * vDropA * 0.9);
        }
        float a = alpha * vOpacity;
        if (a < 0.003) discard;
        fragColor = vec4(vColor, a);
      }
    `,
  })
}
