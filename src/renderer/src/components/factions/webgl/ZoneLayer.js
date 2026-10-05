import * as THREE from 'three'
import { INK_NOISE } from '../../webgl/inkGlsl.js'

// Instanced faction zones: translucent disc + ring stroke + optional dashed
// "marching ants" drop-target halo, all in one draw call. Coordinates and widths
// are in world units (the camera transform scales them, like the old SVG group).
// setInk(true) switches the same instances to 水墨 ink-wash pools: a ragged,
// bleeding wash of low-saturation mineral pigment with a darker dried rim, and
// the drop halo becomes ripples of ink spreading through water (uInk uniform —
// the classic branch is untouched).
const DROP_OFFSET = 8 // halo sits this far outside the ring
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
    this.center = mk('iCenter', 2)
    this.r = mk('iR', 1)
    this.color = mk('iColor', 3)
    this.fillA = mk('iFillA', 1)
    this.ringA = mk('iRingA', 1)
    this.ringW = mk('iRingW', 1)
    this.dropA = mk('iDropA', 1)
    this.scale = mk('iScale', 1)
    this.opacity = mk('iOpacity', 1)
    this.seed = mk('iSeed', 1)
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

  set(i, x, y, r, rgb, { fillA, ringA, ringW, dropA, scale, opacity, seed = 0 }) {
    this.center[i * 2] = x
    this.center[i * 2 + 1] = y
    this.r[i] = r
    this.color[i * 3] = rgb[0]
    this.color[i * 3 + 1] = rgb[1]
    this.color[i * 3 + 2] = rgb[2]
    this.fillA[i] = fillA
    this.ringA[i] = ringA
    this.ringW[i] = ringW
    this.dropA[i] = dropA
    this.scale[i] = scale
    this.opacity[i] = opacity
    this.seed[i] = seed
  }

  setInk(on) {
    this.material.uniforms.uInk.value = on ? 1 : 0
  }

  /** 0 freezes the ink ripples (reduced motion). */
  setMotion(k) {
    this.material.uniforms.uMotion.value = k
  }

  commit() {
    if (!this._attr.iCenter) return
    for (const k of [
      'iCenter',
      'iR',
      'iColor',
      'iFillA',
      'iRingA',
      'iRingW',
      'iDropA',
      'iScale',
      'iOpacity',
      'iSeed'
    ])
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

function createZoneMaterial() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uInk: { value: 0 }, uMotion: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float uInk;
      in vec2 iCenter;
      in float iR;
      in vec3 iColor;
      in float iFillA;
      in float iRingA;
      in float iRingW;
      in float iDropA;
      in float iScale;
      in float iOpacity;
      in float iSeed;

      out vec2 vCorner;
      out float vR;
      out vec3 vColor;
      out float vFillA;
      out float vRingA;
      out float vRingW;
      out float vDropA;
      out float vOpacity;
      out float vSeed;

      void main() {
        float R = iR * iScale;
        float half_ = R + ${(DROP_OFFSET + 4).toFixed(1)};
        if (uInk > 0.5) half_ = R * 1.32 + 10.0; // bleed + ripples reach past the rim
        vSeed = iSeed;
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
      uniform float uInk;
      uniform float uMotion;
      in vec2 vCorner;
      in float vR;
      in vec3 vColor;
      in float vFillA;
      in float vRingA;
      in float vRingW;
      in float vDropA;
      in float vOpacity;
      in float vSeed;
      out vec4 fragColor;
      ${INK_NOISE}

      // 晕染 — an ink-wash pool tinted with a muted mineral pigment
      vec4 inkPool(float d) {
        vec2 dir = d > 0.0001 ? vCorner / d : vec2(1.0, 0.0);
        float s = vSeed;
        float n = inkFbm(dir * 1.5 + vec2(s * 3.1, s * 1.3));
        float n2 = inkNoise(dir * 6.0 + vec2(s * 2.0, 4.0));
        float rr = vR * (0.93 + 0.11 * n + 0.03 * n2);
        float dn = d / max(rr, 0.001);
        float aaN = fwidth(dn) * 1.5 + 0.002;
        float lum = dot(vColor, vec3(0.299, 0.587, 0.114));
        vec3 pig = mix(vec3(lum), vColor, 0.55);
        pig = mix(pig, vec3(0.11, 0.10, 0.09), 0.3);
        float body = 1.0 - smoothstep(0.985 - aaN, 1.0 + aaN, dn);
        // cloudy granulation; pigment drifts outward as the wash dries
        float gran = inkFbm(vCorner / (vR * 0.32) + vec2(s * 5.0, s));
        float lit = clamp(vFillA / 0.07, 0.6, 1.7);
        float cloud = inkFbm(vCorner / (vR * 0.75) + vec2(s * 1.7, 3.0 + s));
        float wash = (0.07 + 0.11 * smoothstep(0.3, 1.0, dn) + 0.09 * (gran - 0.5) + 0.1 * (cloud - 0.5));
        // back-runs (水渍): where wetter wash crept back in, a faint darker tide-line
        float back = inkFbm(vCorner / (vR * 0.42) + vec2(7.0 + s, s * 2.3));
        float bk = (back - 0.56) / 0.022;
        wash += exp(-bk * bk) * 0.07 * smoothstep(0.95, 0.5, dn);
        wash *= lit * body;
        // the dried tide-line at the edge, uneven in strength
        float rimK = (dn - 0.975) / 0.022;
        float rim = exp(-rimK * rimK) * (0.45 + 0.55 * inkNoise(dir * 11.0 + s)) * vRingA * 0.62;
        // feathery capillary bleed just outside
        float bleed = (1.0 - smoothstep(1.0, 1.07 + 0.07 * n2, dn)) * (1.0 - body);
        bleed *= 0.1 * inkNoise(vCorner / max(vR * 0.05, 0.5) + s * 7.0);
        float a = wash + rim + bleed;
        // drop target: ink rings spreading out through water
        if (vDropA > 0.003) {
          float t = uTime * 0.55 * uMotion;
          float ring = 0.0;
          for (int k = 0; k < 3; k++) {
            float ph = fract(t + float(k) / 3.0);
            float rk = (d / vR - (1.02 + ph * 0.24)) / (0.012 + ph * 0.02);
            ring += exp(-rk * rk) * (1.0 - ph) * (0.6 + 0.4 * n2);
          }
          a += ring * vDropA * 0.5;
          a += body * vDropA * 0.06;
        }
        vec3 col = mix(pig, pig * 0.55, clamp(rim * 2.0, 0.0, 1.0));
        return vec4(col, a);
      }

      void main() {
        float d = length(vCorner);
        if (uInk > 0.5) {
          vec4 ink = inkPool(d);
          float ia = ink.a * vOpacity;
          if (ia < 0.003) discard;
          fragColor = vec4(ink.rgb, min(ia, 1.0));
          return;
        }
        float aa = fwidth(d) * 1.5 + 0.0012;
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
    `
  })
}
