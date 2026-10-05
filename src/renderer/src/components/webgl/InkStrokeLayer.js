import * as THREE from 'three'
import { INK_NOISE } from './inkGlsl.js'

// 水墨 — instanced straight brush strokes, one draw call for all of them (the
// Ink-theme sibling of CapsuleLayer). Each instance is a loaded brush pulled
// from p0 to p1: it presses in with a slight bulb, its edges are ragged, its
// bristles streak along the stroke and break up as it runs dry (飞白, `dry`
// 0..1 toward the end), and a dry stroke lifts off into a fading point while a
// `wet` one ends blunt with a little pooled ink. `write` = (startSec, durSec)
// animates the tip travelling the stroke on the uTime clock — no per-frame
// buffer writes; dur 0 = fully written.
// Used for timeline lifelines and the groups view's tether threads.
export class InkStrokeLayer {
  constructor({ renderOrder = 1 } = {}) {
    this.capacity = 0
    this.count = 0
    this.material = createInkStrokeMaterial()
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
    this.shape = mk('iShape', 4) // seed, dry, wet, taperOut (fraction of length)
    this.write = mk('iWrite', 2)
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

  /**
   * seed: any float (per-stroke texture); dry 0..1; wet 0/1; taperOut 0..1 of
   * the length spent lifting off; wStart/wDur: write-on timing in uTime seconds.
   */
  set(i, x0, y0, x1, y1, width, rgb, opacity, seed, dry, wet, taperOut, wStart = 0, wDur = 0) {
    this.p0[i * 2] = x0
    this.p0[i * 2 + 1] = y0
    this.p1[i * 2] = x1
    this.p1[i * 2 + 1] = y1
    this.width[i] = width
    this.color[i * 3] = rgb[0]
    this.color[i * 3 + 1] = rgb[1]
    this.color[i * 3 + 2] = rgb[2]
    this.opacity[i] = opacity
    this.shape[i * 4] = seed
    this.shape[i * 4 + 1] = dry
    this.shape[i * 4 + 2] = wet
    this.shape[i * 4 + 3] = taperOut
    this.write[i * 2] = wStart
    this.write[i * 2 + 1] = wDur
  }

  commit() {
    if (!this._attr.iP0) return
    for (const k of ['iP0', 'iP1', 'iWidth', 'iColor', 'iOpacity', 'iShape', 'iWrite'])
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

function createInkStrokeMaterial() {
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
      in vec4 iShape;
      in vec2 iWrite;

      out float vAlong;
      out float vPerp;
      out float vLen;
      out float vHalfW;
      out vec3 vColor;
      out float vOpacity;
      out vec4 vShape;
      out vec2 vWrite;

      void main() {
        vec2 axis = iP1 - iP0;
        float len = length(axis);
        vec2 dir = len > 0.0001 ? axis / len : vec2(0.0, 1.0);
        vec2 nrm = vec2(-dir.y, dir.x);
        float halfW = iWidth * 0.5;
        float m = halfW * 1.45 + 2.0; // bulb + ragged edge + AA
        float along = mix(-m, len + m, (position.y + 1.0) * 0.5);
        float perp = position.x * m;
        vAlong = along; vPerp = perp; vLen = len; vHalfW = halfW;
        vColor = iColor; vOpacity = iOpacity; vShape = iShape; vWrite = iWrite;
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
      in vec4 vShape;
      in vec2 vWrite;
      out vec4 fragColor;
      ${INK_NOISE}

      // half-width of the brush at distance x along the stroke
      float brushW(float x, float len, float hw, float seed, float wet, float taperOut) {
        float inPx = max(2.0, min(len * 0.3, hw * 2.2));
        float press = clamp(x / inPx, 0.0, 1.0);
        float bulb = exp(-pow((x - inPx) / (inPx * 0.9), 2.0));
        float head = 0.5 + 0.5 * sqrt(press) + 0.2 * bulb;
        float outPx = max(hw * 2.0, len * taperOut);
        float q = clamp((len - x) / outPx, 0.0, 1.0);
        float dryTail = 0.06 + 0.94 * pow(q, 0.7);
        float wetTail = 1.0 + 0.14 * exp(-pow((len - x) / (hw * 1.6), 2.0));
        float tail = mix(dryTail, wetTail, wet);
        // the hand's pressure breathes along the stroke: slow swells + a finer tremor
        float wob = 1.0 + 0.3 * (inkNoise(vec2(x * 0.011 + seed * 7.1, seed)) - 0.5)
                        + 0.1 * (inkNoise(vec2(x * 0.05 + seed * 2.3, seed + 4.0)) - 0.5);
        return hw * head * tail * wob;
      }

      void main() {
        float seed = vShape.x;
        float dry = vShape.y;
        float wet = vShape.z;
        float taperOut = vShape.w;
        float len = max(vLen, 0.001);
        float hw = vHalfW;
        if (vWrite.y > 0.0 && uTime < vWrite.x) discard; // the brush hasn't landed yet
        float prog = inkWrite(vWrite, uTime);
        float tip = prog * len;
        float x = vAlong;
        float side = sign(vPerp);
        float ap = abs(vPerp);

        float body;
        float w;
        float aa = 0.9;
        if (x < 0.0) {
          // the brush lands: a rounded blob at the very start
          w = hw * 0.55;
          float d = length(vec2(x, vPerp));
          body = 1.0 - smoothstep(w - aa, w + aa, d);
        } else if (x > tip) {
          // the travelling tip (or the far end): round off at the tip's width
          float wt = brushW(tip, len, hw, seed, prog < 1.0 ? 1.0 : wet, taperOut);
          w = wt;
          float d = length(vec2(x - tip, vPerp));
          float cap = prog < 1.0 || wet > 0.5 ? wt : wt * 0.4;
          body = 1.0 - smoothstep(cap - aa, cap + aa, d);
        } else {
          w = brushW(x, len, hw, seed, prog < 1.0 ? 1.0 : wet, taperOut);
          float rag = 1.0 + 0.16 * (inkNoise(vec2(x * 0.09 + seed * 3.0, side * 5.0 + seed)) - 0.5)
                          + 0.1 * (inkNoise(vec2(x * 0.35 + seed, side * 9.0)) - 0.5);
          float we = w * rag;
          body = 1.0 - smoothstep(we - aa, we + aa, ap);
        }
        if (body < 0.003) discard;

        float u = clamp(x / len, 0.0, 1.0);
        float pn = ap / max(w, 0.5); // 0 centre .. 1 edge
        // 飞白 — bristle streaks running along the stroke, opening up as it dries
        float dryAmt = dry * mix(smoothstep(0.35, 1.05, u), 0.2 * smoothstep(0.5, 1.0, u), wet);
        dryAmt += dry * 0.12 * pn;
        float vv = (vPerp / max(hw, 0.5));
        float streak = inkNoise(vec2(x * 0.007 + seed * 13.0, vv * 4.2 + seed * 3.0)) * 0.7
                     + inkNoise(vec2(x * 0.07 + seed, vv * 10.0)) * 0.3;
        float keep = dryAmt > 0.002 ? smoothstep(dryAmt - 0.09, dryAmt + 0.09, streak) : 1.0;
        // even a loaded brush leaves faint bristle striations
        float striae = 0.8 + 0.2 * smoothstep(0.25, 0.75, streak);

        // ink tone: uneven load + a darker settled edge where the wet ink pooled
        float tone = (0.6 + 0.4 * inkFbm(vec2(x * 0.01 + seed * 5.0, vv * 0.7 + seed))) * striae;
        float rim = smoothstep(0.6, 1.0, pn) * 0.22 * (1.0 - dryAmt);
        // a dry stroke's last stretch thins into mist
        float lift = mix(1.0 - 0.55 * smoothstep(0.78, 1.0, u), 1.0, wet);
        // the wet tip while writing glistens a touch darker
        float tipInk = prog < 1.0 ? 0.25 * exp(-abs(x - tip) / (hw * 2.5 + 1.0)) : 0.0;

        float a = body * keep * min(1.0, tone + rim + tipInk) * lift * vOpacity;
        if (a < 0.003) discard;
        vec3 col = vColor * (1.0 - rim * 0.6 - tipInk * 0.5);
        fragColor = vec4(col, a);
      }
    `
  })
}
