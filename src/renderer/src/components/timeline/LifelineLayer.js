import * as THREE from 'three'
import { FX_GLSL, FX_NOISE_GLSL, lineFxSpec } from '../graph/webgl/lineFx.js'

// Timeline lifelines: instanced rounded segments with a choice of LOOKS —
//   classic   flat, as before
//   tube      a lit 3D cylinder (diffuse + specular from an upper-left key light)
//   glass     a translucent glass rod with bright rims and a sheen that travels
//             down the life like time flowing
//   glow      a white-hot core in a coloured glow
//   <effect>  any graph line effect (Bloodstream, River, Helix…) via lineFx.js,
//             flowing from birth downward
// plus a per-instance selection halo. A second instance of this layer with
// `shadow: true` draws the same instances as a soft offset drop shadow under
// them (lit looks only). Every look animates off the uTime uniform — no
// per-frame buffer writes.

// `labelKey` / `hintKey` are i18n keys (translated where rendered);
// `label` / `hint` stay as the English fallback.
export const LIFELINE_STYLES = [
  { id: 'classic', label: 'Classic', hint: 'Flat, clean lines' },
  { id: 'tube', label: 'Tube', hint: 'Lit 3D cylinders with shadows' },
  { id: 'glass', label: 'Glass', hint: 'Glass rods — a sheen flows down each life' },
  { id: 'glow', label: 'Glow', hint: 'White-hot cores in a coloured glow' }
].map((s) => ({
  ...s,
  labelKey: `timeline.style.lifelines.${s.id}.label`,
  hintKey: `timeline.style.lifelines.${s.id}.hint`
}))
const BASE = { classic: 0, tube: 1, glass: 2, glow: 3 }

/** Shader style id + geometry headroom for a lifeline look. */
export function lifelineStyleInfo(id) {
  if (id in BASE) return { n: BASE[id], pad: id === 'glow' ? 3.6 : id === 'glass' ? 1.4 : 1.25 }
  const fx = lineFxSpec(id)
  if (fx.n) return { n: 10 + fx.n, pad: Math.max(1.25, fx.pad) }
  return { n: 0, pad: 1.25 }
}
/** Looks that cast a drop shadow (lit, solid bodies). */
export const SHADOWED = new Set(['tube', 'glass', 'gilded', 'helix', 'blood'])

export class LifelineLayer {
  constructor({ renderOrder = 3, shadow = false } = {}) {
    this.capacity = 0
    this.count = 0
    this.shadow = shadow
    this.material = createMaterial(shadow)
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
    this.p0 = mk('iP0', 2)
    this.p1 = mk('iP1', 2)
    this.width = mk('iWidth', 1)
    this.color = mk('iColor', 3)
    this.opacity = mk('iOpacity', 1)
    // (style id, headroom pad, seed, selection glow)
    this.look = mk('iLook', 4)
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

  set(i, x0, y0, x1, y1, width, rgb, opacity, style = 0, pad = 1.25, seed = 0, glow = 0) {
    this.p0[i * 2] = x0
    this.p0[i * 2 + 1] = y0
    this.p1[i * 2] = x1
    this.p1[i * 2 + 1] = y1
    this.width[i] = width
    this.color[i * 3] = rgb[0]
    this.color[i * 3 + 1] = rgb[1]
    this.color[i * 3 + 2] = rgb[2]
    this.opacity[i] = opacity
    this.look[i * 4] = style
    this.look[i * 4 + 1] = pad
    this.look[i * 4 + 2] = seed
    this.look[i * 4 + 3] = glow
  }

  commit() {
    if (!this._attr.iP0) return
    for (const k of ['iP0', 'iP1', 'iWidth', 'iColor', 'iOpacity', 'iLook'])
      this._attr[k].needsUpdate = true
  }

  setTime(t) {
    this.material.uniforms.uTime.value = t
  }
  setFx({ speed = 1, glow = 1, light = false } = {}) {
    const u = this.material.uniforms
    u.uFxSpeed.value = speed
    u.uFxGlow.value = glow
    u.uFxLight.value = light ? 1 : 0
  }

  dispose() {
    this.geometry?.dispose()
    this.material?.dispose()
  }
}

function createMaterial(shadow) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uFxSpeed: { value: 1 },
      uFxGlow: { value: 1 },
      uFxKeep: { value: 1 },
      uFxLight: { value: 0 },
      uShadow: { value: shadow ? 1 : 0 }
    },
    vertexShader: /* glsl */ `
      uniform float uShadow;
      in vec2 iP0;
      in vec2 iP1;
      in float iWidth;
      in vec3 iColor;
      in float iOpacity;
      in vec4 iLook;

      out float vAlong;
      out float vPerp;
      out float vLen;
      out float vHalfW;
      out float vM;
      out vec3 vColor;
      out float vOpacity;
      out vec4 vLook;

      void main() {
        vec2 axis = iP1 - iP0;
        float len = length(axis);
        vec2 dir = len > 0.0001 ? axis / len : vec2(0.0, 1.0);
        vec2 nrm = vec2(-dir.y, dir.x);
        float halfW = iWidth * 0.5;
        // Headroom for glows / effects / the selection halo; shadows spread wider.
        float pad = max(iLook.y, iLook.w > 0.01 ? 3.2 : 1.0);
        if (uShadow > 0.5) pad = 2.2;
        float m = halfW * pad + 1.5;
        float along = mix(-m, len + m, (position.y + 1.0) * 0.5);
        float perp = position.x * m;
        vAlong = along; vPerp = perp; vLen = len; vHalfW = halfW; vM = m;
        vColor = iColor; vOpacity = iOpacity; vLook = iLook;
        vec2 world = iP0 + dir * along + nrm * perp;
        // The shadow falls down-right of its lifeline (key light upper-left).
        if (uShadow > 0.5) world += vec2(halfW * 0.9 + 2.0, halfW * 0.6 + 3.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform float uShadow;
      in float vAlong;
      in float vPerp;
      in float vLen;
      in float vHalfW;
      in float vM;
      in vec3 vColor;
      in float vOpacity;
      in vec4 vLook;
      out vec4 fragColor;
      ${FX_NOISE_GLSL}
      ${FX_GLSL}

      void main() {
        float d = length(vec2(vAlong - clamp(vAlong, 0.0, vLen), vPerp));
        float aa = fwidth(d) * 1.5 + 0.0012;
        float body = 1.0 - smoothstep(vHalfW - aa, vHalfW + aa, d);

        if (uShadow > 0.5) {
          float a = (1.0 - smoothstep(vHalfW * 0.15, vHalfW * 2.0, d)) * vOpacity * (uFxLight > 0.5 ? 0.16 : 0.38);
          if (a < 0.003) discard;
          fragColor = vec4(0.0, 0.0, 0.02, a);
          return;
        }

        int style = int(vLook.x + 0.5);
        float glowSel = vLook.w;
        vec3 col = vColor;
        float alpha = body;

        if (style >= 10) {
          // A graph line effect running down the life (birth → end).
          float side = clamp(vPerp / vM, -1.0, 1.0);
          float core = vHalfW / vM;
          float endFade = 1.0 - smoothstep(0.0, vHalfW * 1.5, max(-vAlong, vAlong - vLen));
          vec4 e = lineFx(style - 10, vColor, side, core, vM, vAlong, vLen, vLook.z * 97.0);
          col = e.rgb;
          alpha = e.a * endFade;
        } else if (style == 1) {
          // Lit tube: a cylinder normal across the width, key light upper-left.
          float nx = clamp(vPerp / max(vHalfW, 0.001), -1.0, 1.0);
          vec3 N = normalize(vec3(nx, 0.0, sqrt(max(0.0, 1.0 - nx * nx))));
          vec3 L = normalize(vec3(-0.55, -0.3, 0.78));
          float diff = max(dot(N, L), 0.0);
          float spec = pow(max(dot(reflect(-L, N), vec3(0.0, 0.0, 1.0)), 0.0), 22.0);
          col = vColor * (0.32 + 0.78 * diff) + vec3(1.0) * spec * 0.55;
          col *= 1.0 - 0.25 * smoothstep(0.75, 1.0, abs(nx)); // rim darkening
        } else if (style == 2) {
          // Glass rod: faint core, bright rims, a sheen gliding down the life.
          float nx = clamp(vPerp / max(vHalfW, 0.001), -1.0, 1.0);
          float rim = smoothstep(0.45, 0.95, abs(nx));
          float sheen = exp(-pow((fract((vAlong - uTime * 70.0) / 260.0) - 0.5) * 7.0, 2.0));
          col = mix(vColor * 0.85, vec3(1.0), rim * 0.45 + sheen * 0.55 * (1.0 - abs(nx)));
          col += vec3(1.0) * pow(max(0.0, 1.0 - abs(nx + 0.45) * 3.0), 3.0) * 0.4;
          alpha = body * (0.32 + 0.55 * rim + 0.4 * sheen);
        } else if (style == 3) {
          // Glow: a white-hot core inside a coloured glow.
          float hot = 1.0 - smoothstep(vHalfW * 0.15, vHalfW * 0.55, d);
          float glow = exp(-max(d - vHalfW * 0.4, 0.0) / max(vHalfW * 1.1, 1.0)) * 0.8;
          vec3 c = vColor / max(max(vColor.r, vColor.g), max(vColor.b, 0.05));
          col = mix(mix(vColor, c, 0.7), vec3(1.0), hot * 0.85);
          alpha = clamp(max(body * 0.9, glow) + hot, 0.0, 1.0);
        }

        // Selection halo: a soft glow ring hugging the lifeline.
        if (glowSel > 0.01) {
          float halo = exp(-max(d - vHalfW, 0.0) / max(vHalfW * 1.2, 2.0)) * (1.0 - body) * glowSel;
          col = mix(col, vColor * 1.25 + 0.1, halo / max(alpha + halo, 1e-3));
          alpha = max(alpha, halo * 0.65);
        }

        float a = alpha * vOpacity;
        if (a < 0.003) discard;
        fragColor = vec4(col, a);
      }
    `
  })
}
