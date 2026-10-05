import * as THREE from 'three'
import { INK_NOISE } from './inkGlsl.js'

// 水墨 — tessellated curves drawn as a thread or a thin brush line (the Ink
// sibling of RibbonLayer). The caller supplies segments+1 sample points per
// curve; the vertex shader offsets them along the curve normal, so
//   THREAD (mode 0)  a twisted silk thread of even width — the cinnabar red
//                    thread of fate (红线) between spouses — that can sway
//                    gently (`sway` px amplitude, uTime-driven, ends pinned)
//   BRUSH  (mode 1)  a quick dry-brush flick that tapers at both ends
// `write` = (startSec, durSec) lets the curve draw itself in; dur 0 = drawn.
export const THREAD = 0
export const BRUSH = 1

export class InkThreadLayer {
  constructor({ segments = 16, renderOrder = 1 } = {}) {
    this.seg = segments
    this.vpl = (segments + 1) * 2
    this.ipl = segments * 6
    this.capacity = 0
    this.count = 0
    this.material = createInkThreadMaterial()
    this.mesh = new THREE.Mesh()
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = renderOrder
    this._a = {}
    this._allocate(16)
  }

  get object3d() {
    return this.mesh
  }

  _allocate(capacity) {
    this.mesh.geometry?.dispose()
    const g = new THREE.BufferGeometry()
    const mk = (name, size) => {
      const arr = new Float32Array(capacity * this.vpl * size)
      const a = new THREE.BufferAttribute(arr, size)
      a.setUsage(THREE.DynamicDrawUsage)
      g.setAttribute(name, a)
      this._a[name] = a
      return arr
    }
    this.position = mk('position', 3) // centre x, y, side ±1
    this.normal = mk('aNormal', 2)
    this.tArc = mk('aT', 2) // t 0..1, arc length
    this.style = mk('aStyle', 4) // halfW, sway, seed, mode
    this.color = mk('aColor', 3)
    this.opacity = mk('aOpacity', 1)
    this.write = mk('aWrite', 2)
    const index = new Uint32Array(capacity * this.ipl)
    for (let j = 0; j < capacity; j++) {
      const base = j * this.vpl,
        ib = j * this.ipl
      for (let s = 0; s < this.seg; s++) {
        const a = base + s * 2,
          b = a + 1,
          c = a + 2,
          d = a + 3
        const o = ib + s * 6
        index[o] = a
        index[o + 1] = b
        index[o + 2] = c
        index[o + 3] = c
        index[o + 4] = b
        index[o + 5] = d
      }
    }
    g.setIndex(new THREE.BufferAttribute(index, 1))
    g.setDrawRange(0, this.count * this.ipl)
    this.geometry = g
    this.mesh.geometry = g
    this.mesh.material = this.material
    this.capacity = capacity
  }

  setCount(n) {
    if (n > this.capacity) this._allocate(Math.ceil(n * 1.3) + 8)
    this.count = n
    this.geometry.setDrawRange(0, n * this.ipl)
  }

  // pts: segments+1 entries of { x, y }.
  writeCurve(j, pts) {
    const SEG = this.seg,
      base = j * this.vpl
    let acc = 0
    for (let i = 0; i <= SEG; i++) {
      const p = pts[i]
      const prev = pts[Math.max(0, i - 1)],
        next = pts[Math.min(SEG, i + 1)]
      let tx = next.x - prev.x,
        ty = next.y - prev.y
      const tl = Math.hypot(tx, ty) || 1
      tx /= tl
      ty /= tl
      if (i > 0) acc += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y)
      for (let s = 0; s < 2; s++) {
        const v = base + i * 2 + s
        this.position[v * 3] = p.x
        this.position[v * 3 + 1] = p.y
        this.position[v * 3 + 2] = s === 0 ? 1 : -1
        this.normal[v * 2] = -ty
        this.normal[v * 2 + 1] = tx
        this.tArc[v * 2] = i / SEG
        this.tArc[v * 2 + 1] = acc
      }
    }
  }

  writeStyle(j, rgb, opacity, width, mode, sway, seed, wStart = 0, wDur = 0) {
    const base = j * this.vpl
    for (let v = base; v < base + this.vpl; v++) {
      this.color[v * 3] = rgb[0]
      this.color[v * 3 + 1] = rgb[1]
      this.color[v * 3 + 2] = rgb[2]
      this.opacity[v] = opacity
      this.style[v * 4] = width / 2
      this.style[v * 4 + 1] = sway
      this.style[v * 4 + 2] = seed
      this.style[v * 4 + 3] = mode
      this.write[v * 2] = wStart
      this.write[v * 2 + 1] = wDur
    }
  }

  commit() {
    if (!this._a.position) return
    for (const k of ['position', 'aNormal', 'aT', 'aStyle', 'aColor', 'aOpacity', 'aWrite'])
      this._a[k].needsUpdate = true
  }

  setTime(t) {
    this.material.uniforms.uTime.value = t
  }

  /** 0 freezes the sway (reduced motion), 1 = normal. */
  setMotion(k) {
    this.material.uniforms.uMotion.value = k
  }

  dispose() {
    this.geometry?.dispose()
    this.material?.dispose()
  }
}

function createInkThreadMaterial() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uMotion: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uMotion;
      in vec2 aNormal;
      in vec2 aT;
      in vec4 aStyle;
      in vec3 aColor;
      in float aOpacity;
      in vec2 aWrite;

      out float vSide;
      out float vHw;
      out vec2 vT;
      out vec3 vColor;
      out float vOpacity;
      out vec4 vStyle;
      out vec2 vWrite;

      void main() {
        float t = aT.x;
        float halfW = aStyle.x;
        float seed = aStyle.z;
        float mode = aStyle.w;
        float sway = sin(uTime * 0.85 + seed * 6.2832 + t * 1.6) * aStyle.y * sin(3.14159 * t) * uMotion;
        float prof = 1.0;
        if (mode > 0.5) {
          prof = pow(max(sin(3.14159 * clamp(t * 0.94 + 0.03, 0.0, 1.0)), 0.0), 0.55);
          prof *= 1.0 + 0.35 * exp(-pow((t - 0.12) / 0.1, 2.0));
        }
        float hw = max(halfW * prof, 0.35);
        float side = position.z;
        float off = side * (hw + 1.0); // +1px for AA
        vSide = off; vHw = hw;
        vT = aT; vColor = aColor; vOpacity = aOpacity; vStyle = aStyle; vWrite = aWrite;
        vec2 world = position.xy + aNormal * (off + sway);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      in float vSide;
      in float vHw;
      in vec2 vT;
      in vec3 vColor;
      in float vOpacity;
      in vec4 vStyle;
      in vec2 vWrite;
      out vec4 fragColor;
      ${INK_NOISE}

      void main() {
        if (vWrite.y > 0.0 && uTime < vWrite.x) discard;
        float prog = inkWrite(vWrite, uTime);
        if (vT.x > prog) discard;
        float seed = vStyle.z;
        float mode = vStyle.w;
        float hw = max(vHw, 0.7);
        float thin = min(1.0, vHw / 0.7); // sub-pixel threads fade instead of aliasing
        float d = abs(vSide);
        float body = (1.0 - smoothstep(hw - 0.7, hw + 0.7, d)) * thin;
        float arc = vT.y;
        float vv = vSide / max(hw, 0.5);
        float a;
        if (mode < 0.5) {
          // silk: a faint twist of fibres and slightly uneven dye
          float twist = 0.84 + 0.16 * sin(arc * 0.9 + vv * 2.6 + seed * 9.0);
          float dye = 0.85 + 0.15 * inkNoise(vec2(arc * 0.05 + seed * 4.0, 0.5));
          a = body * twist * dye;
        } else {
          // dry brush flick: streaks open up toward the end
          float dryAmt = 0.15 + 0.5 * smoothstep(0.3, 1.0, vT.x);
          float streak = inkNoise(vec2(arc * 0.03 + seed * 13.0, vv * 3.2 + seed));
          float keep = smoothstep(dryAmt - 0.12, dryAmt + 0.12, streak);
          a = body * (0.55 + 0.45 * keep);
        }
        a *= vOpacity;
        if (a < 0.003) discard;
        fragColor = vec4(vColor, a);
      }
    `
  })
}
