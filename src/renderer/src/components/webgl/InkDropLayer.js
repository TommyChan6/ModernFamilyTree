import * as THREE from 'three'
import { INK_NOISE } from './inkGlsl.js'

// 水墨 — instanced ink blots, one draw call. Three kinds:
//   0 DROP    a drop landing on rice paper: it blooms out (晕染) with a ragged,
//             bleeding halo, then settles with a darker dried rim
//   1 MIST    a soft grey puff — where a dry stroke lifts off the paper
//   2 RIPPLE  ink dropped into water: rings spread and fade (one-shot)
// `bloom` = (startSec, durSec) on the uTime clock animates the bloom / ripple
// without buffer writes; dur 0 = settled. Radii are in the layer's units.
export const DROP = 0
export const MIST = 1
export const RIPPLE = 2

export class InkDropLayer {
  constructor({ renderOrder = 1 } = {}) {
    this.capacity = 0
    this.count = 0
    this.material = createInkDropMaterial()
    this.mesh = new THREE.Mesh()
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = renderOrder
    this._attr = {}
    this._allocate(16)
  }

  get object3d() {
    return this.mesh
  }

  _allocate(capacity) {
    if (this.geometry) this.geometry.dispose()
    const g = new THREE.InstancedBufferGeometry()
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
    this.color = mk('iColor', 3)
    this.opacity = mk('iOpacity', 1)
    this.kind = mk('iKind', 2) // kind, seed
    this.bloom = mk('iBloom', 2)
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

  set(i, x, y, radius, rgb, opacity, kind, seed, bStart = 0, bDur = 0) {
    this.pos[i * 2] = x
    this.pos[i * 2 + 1] = y
    this.radius[i] = radius
    this.color[i * 3] = rgb[0]
    this.color[i * 3 + 1] = rgb[1]
    this.color[i * 3 + 2] = rgb[2]
    this.opacity[i] = opacity
    this.kind[i * 2] = kind
    this.kind[i * 2 + 1] = seed
    this.bloom[i * 2] = bStart
    this.bloom[i * 2 + 1] = bDur
  }

  commit() {
    if (!this._attr.iPos) return
    for (const k of ['iPos', 'iRadius', 'iColor', 'iOpacity', 'iKind', 'iBloom'])
      this._attr[k].needsUpdate = true
  }

  setTime(t) {
    this.material.uniforms.uTime.value = t
  }

  dispose() {
    this.geometry?.dispose()
    this.material?.dispose()
  }
}

function createInkDropMaterial() {
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
      in vec2 iKind;
      in vec2 iBloom;

      out vec2 vCorner;
      out float vRadius;
      out vec3 vColor;
      out float vOpacity;
      out vec2 vKind;
      out vec2 vBloom;

      void main() {
        float half_ = iRadius * (iKind.x > 1.5 ? 1.25 : 1.7) + 2.0;
        vCorner = position.xy * half_;
        vRadius = iRadius;
        vColor = iColor; vOpacity = iOpacity; vKind = iKind; vBloom = iBloom;
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
      in vec2 vKind;
      in vec2 vBloom;
      out vec4 fragColor;
      ${INK_NOISE}

      void main() {
        float kind = vKind.x;
        float seed = vKind.y;
        if (vBloom.y > 0.0 && uTime < vBloom.x) discard;
        float b = vBloom.y > 0.0 ? clamp((uTime - vBloom.x) / vBloom.y, 0.0, 1.0) : 1.0;
        float eb = 1.0 - pow(1.0 - b, 3.0);
        float R = max(vRadius, 0.001);
        float L = length(vCorner);
        float d = L / R;
        vec2 dir = L > 0.0001 ? vCorner / L : vec2(1.0, 0.0);
        // angular raggedness sampled on the unit circle — seamless all round
        float n = inkFbm(dir * 1.7 + vec2(seed * 3.1, seed * 1.7));
        float aa = fwidth(d) * 1.2 + 0.002;
        float a = 0.0;
        vec3 col = vColor;

        if (kind < 0.5) {
          float rr = (0.3 + 0.7 * eb) * (0.84 + 0.3 * n);
          float core = 1.0 - smoothstep(rr - aa, rr + aa, d);
          float rimBand = smoothstep(rr * 0.5, rr, d) * core;
          float gran = 0.78 + 0.22 * inkNoise(vCorner * (6.0 / R) + seed * 11.0);
          float haloR = rr * (1.18 + 0.32 * eb) * (0.92 + 0.16 * inkNoise(dir * 4.0 + seed));
          float halo = (1.0 - smoothstep(rr, haloR, d)) * (1.0 - core);
          halo *= 0.3 * (0.55 + 0.45 * inkNoise(vCorner * (3.0 / R) + seed * 5.0));
          a = core * (0.5 + 0.4 * rimBand) * gran + halo;
          a *= mix(1.3, 1.0, eb); // wet and dark as it lands, lighter once it settles
          col = vColor * (1.0 - 0.35 * rimBand);
        } else if (kind < 1.5) {
          float m = exp(-d * d * 2.4);
          m *= 0.55 + 0.45 * inkFbm(vCorner * (1.6 / R) + vec2(seed, uTime * 0.03));
          a = m * 0.55 * eb;
        } else {
          if (b >= 1.0) discard;
          float ring = 0.0;
          for (int k = 0; k < 3; k++) {
            float fk = float(k);
            float rk = eb - fk * 0.2;
            if (rk <= 0.0) continue;
            float rw = 0.03 + 0.03 * fk;
            float dd = (d - rk * (0.93 + 0.14 * n)) / rw;
            ring += exp(-dd * dd) * (1.0 - fk * 0.3);
          }
          float wash = (1.0 - smoothstep(0.0, max(eb, 0.01), d)) * 0.12 * (0.6 + 0.4 * n);
          a = (ring * 0.6 + wash) * (1.0 - b) * (1.0 - b * 0.4);
        }
        a *= vOpacity;
        if (a < 0.003) discard;
        fragColor = vec4(col, min(a, 1.0));
      }
    `
  })
}
