import * as THREE from 'three'
import { INK_NOISE } from '../../webgl/inkGlsl.js'
import { SHAPE_SAMPLES, shapeSlopes } from '../vennLayout'

// The Venn style's group zones: elastic MEMBRANES instead of fixed discs. Each
// zone's outline is a polar radius table (vennLayout.membraneShape) uploaded to
// a float texture, one row per zone; every zone is one instanced quad whose
// fragment shader turns the table into a true signed distance (radius gap ×
// r/√(r²+r'²)), so the skin stays crisp and even along steep lobes at any zoom.
//
// Because each fragment can also read every OTHER zone's row, the overlaps
// are drawn as a third thing rather than just two stacked tints: a LENS — the
// groups' colours mixed into a lit pane with a bright edge and a slow satin
// sheen (uTime; frozen under reduced motion). Each pair's lens is painted once,
// by the lower-indexed zone. Both outlines stay visible through the overlap,
// the way a Venn diagram reads.
//
// `morph` (per zone) blends the membrane back to its base disc; at 0 the layer
// draws exactly the classic ring (fill + stroke), so the Rings ↔ Venn switch
// can tween through it and hand over to ZoneLayer without a pop.
// setInk(true): wash pools with ragged, bleeding edges that follow the
// membrane, where overlapping washes glaze into each other like watercolour.
const DROP_OFFSET = 8
const ANTS_SPEED = 16.4
const MAX_LENS_ZONES = 64
const N = SHAPE_SAMPLES
const ZONE_TEXELS = 4

export class MembraneLayer {
  constructor({ renderOrder = 1 } = {}) {
    this.capacity = 0
    this.count = 0
    this.material = createMembraneMaterial()
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3)
    )
    g.setIndex([0, 1, 2, 2, 1, 3])
    g.instanceCount = 0
    this.geometry = g
    this.mesh = new THREE.Mesh(g, this.material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = renderOrder
    this._slopes = new Float32Array(N)
    this._allocate(8)
  }

  get object3d() {
    return this.mesh
  }

  _allocate(capacity) {
    this.shapeTex?.dispose()
    this.zoneTex?.dispose()
    this.shapeData = new Float32Array(N * capacity * 2)
    this.zoneData = new Float32Array(ZONE_TEXELS * capacity * 4)
    const mk = (data, w, format) => {
      const t = new THREE.DataTexture(data, w, capacity, format, THREE.FloatType)
      t.minFilter = THREE.NearestFilter
      t.magFilter = THREE.NearestFilter
      t.generateMipmaps = false
      t.needsUpdate = true
      return t
    }
    this.shapeTex = mk(this.shapeData, N, THREE.RGFormat)
    this.zoneTex = mk(this.zoneData, ZONE_TEXELS, THREE.RGBAFormat)
    this.material.uniforms.uShape.value = this.shapeTex
    this.material.uniforms.uZone.value = this.zoneTex
    this.capacity = capacity
  }

  setCount(n) {
    if (n > this.capacity) this._allocate(Math.ceil(n * 1.3) + 8)
    this.count = n
    this.geometry.instanceCount = n
    this.material.uniforms.uCount.value = Math.min(n, MAX_LENS_ZONES)
  }

  /**
   * Zone i: centre, base radius, polar outline (`shape`, null = the plain
   * disc), how far it has morphed from disc to membrane (0..1), and the same
   * style knobs as ZoneLayer.
   */
  set(i, x, y, base, shape, morph, rgb, o) {
    const sd = this.shapeData
    const row = i * N * 2
    let ext = base
    if (shape && morph > 0) {
      const sl = shapeSlopes(shape, this._slopes)
      for (let j = 0; j < N; j++) {
        const r = base + (shape[j] - base) * morph
        sd[row + j * 2] = r
        sd[row + j * 2 + 1] = sl[j] * morph
        if (r > ext) ext = r
      }
    } else {
      for (let j = 0; j < N; j++) {
        sd[row + j * 2] = base
        sd[row + j * 2 + 1] = 0
      }
    }
    const z = this.zoneData
    const k = i * ZONE_TEXELS * 4
    z[k] = x
    z[k + 1] = y
    z[k + 2] = ext
    z[k + 3] = o.scale
    z[k + 4] = rgb[0]
    z[k + 5] = rgb[1]
    z[k + 6] = rgb[2]
    z[k + 7] = o.opacity
    z[k + 8] = o.fillA
    z[k + 9] = o.ringA
    z[k + 10] = o.ringW
    z[k + 11] = o.dropA
    z[k + 12] = base
    z[k + 13] = o.seed || 0
    z[k + 14] = morph
    z[k + 15] = 0
  }

  commit() {
    this.shapeTex.needsUpdate = true
    this.zoneTex.needsUpdate = true
  }

  setInk(on) {
    this.material.uniforms.uInk.value = on ? 1 : 0
  }
  setLight(on) {
    this.material.uniforms.uLight.value = on ? 1 : 0
  }
  /** 0..1 — strength of the lens shading where groups overlap. */
  setLens(k) {
    this.material.uniforms.uLens.value = k
  }
  /** 0 freezes the sheen + ink ripples (reduced motion). */
  setMotion(k) {
    this.material.uniforms.uMotion.value = k
  }
  setTime(t) {
    this.material.uniforms.uTime.value = t
  }

  dispose() {
    this.geometry?.dispose()
    this.material?.dispose()
    this.shapeTex?.dispose()
    this.zoneTex?.dispose()
  }
}

function createMembraneMaterial() {
  const lib = /* glsl */ `
    uniform sampler2D uShape;
    uniform sampler2D uZone;
    const float SAMPLES = ${N.toFixed(1)};
    vec4 zoneTexel(int i, int k) { return texelFetch(uZone, ivec2(k, i), 0); }
  `
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uShape: { value: null },
      uZone: { value: null },
      uCount: { value: 0 },
      uTime: { value: 0 },
      uInk: { value: 0 },
      uLight: { value: 0 },
      uLens: { value: 1 },
      uMotion: { value: 1 }
    },
    vertexShader: /* glsl */ `
      precision highp float;
      precision highp int;
      ${lib}
      uniform float uInk;
      flat out int vIdx;
      out vec2 vWorld;
      void main() {
        int i = gl_InstanceID;
        vIdx = i;
        vec4 a = zoneTexel(i, 0);
        float op = zoneTexel(i, 1).a;
        float ext = a.z * a.w;
        float half_ = uInk > 0.5 ? ext * 1.14 + 14.0 : ext + ${(DROP_OFFSET + 6).toFixed(1)};
        if (op < 0.002) half_ = 0.0;
        vWorld = a.xy + position.xy * half_;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(vWorld, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      precision highp int;
      ${lib}
      uniform int uCount;
      uniform float uTime;
      uniform float uInk;
      uniform float uLight;
      uniform float uLens;
      uniform float uMotion;
      flat in int vIdx;
      in vec2 vWorld;
      out vec4 fragColor;
      ${INK_NOISE}

      // Signed distance (world units, negative inside) from P to zone i's
      // outline. rad = the outline radius on P's ray, ang = the ray angle.
      float sdOutline(int i, vec2 P, out float rad, out float ang) {
        vec4 a = zoneTexel(i, 0);
        vec2 v = P - a.xy;
        float d = length(v);
        ang = atan(v.y, v.x);
        if (d > a.z * a.w + 48.0) { rad = a.z * a.w; return d - rad; }
        float u = mod(ang / 6.28318530718 * SAMPLES + SAMPLES, SAMPLES);
        int i1 = int(floor(u));
        float f = u - float(i1);
        i1 = i1 % ${N};
        int i0 = (i1 + ${N - 1}) % ${N};
        int i2 = (i1 + 1) % ${N};
        int i3 = (i1 + 2) % ${N};
        vec2 s1 = texelFetch(uShape, ivec2(i1, i), 0).xy;
        vec2 s2 = texelFetch(uShape, ivec2(i2, i), 0).xy;
        float p0 = texelFetch(uShape, ivec2(i0, i), 0).x;
        float p3 = texelFetch(uShape, ivec2(i3, i), 0).x;
        // Catmull-Rom through the samples: the skin stays a smooth curve
        // even on far-reaching lobes at high zoom (no polygon corners)
        float p1 = s1.x, p2 = s2.x;
        float r = p1 + 0.5 * f * (p2 - p0 + f * (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3
                  + f * (3.0 * (p1 - p2) + p3 - p0)));
        r = max(r, min(p1, p2)) * a.w;
        float sl = mix(s1.y, s2.y, f) * a.w;
        rad = r;
        return (d - r) * r / sqrt(r * r + sl * sl);
      }

      // non-premultiplied "src over dst"
      vec4 over(vec4 dst, vec4 src) {
        float a = src.a + dst.a * (1.0 - src.a);
        if (a < 1e-5) return vec4(0.0);
        return vec4((src.rgb * src.a + dst.rgb * dst.a * (1.0 - src.a)) / a, a);
      }

      // 晕染 — the membrane as an ink-wash pool tinted with a muted pigment
      vec4 inkPool(int i, float sd, float rad, float ang, vec3 col, float R, float s,
                   float fillA, float ringA, float dropA, float aa) {
        vec2 dir = vec2(cos(ang), sin(ang));
        vec2 rel = vWorld - zoneTexel(i, 0).xy;
        float n = inkFbm(dir * 1.5 + vec2(s * 3.1, s * 1.3));
        float n2 = inkNoise(dir * 6.0 + vec2(s * 2.0, 4.0));
        // ragged edge: the wash creeps unevenly past / short of the outline
        float rs = sd - (0.08 * (n - 0.5) + 0.03 * (n2 - 0.5)) * R;
        float body = 1.0 - smoothstep(-aa, aa, rs);
        float dn = 1.0 + rs / R;
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        vec3 pig = mix(vec3(lum), col, 0.55);
        pig = mix(pig, vec3(0.11, 0.10, 0.09), 0.3);
        float gran = inkFbm(rel / (R * 0.32) + vec2(s * 5.0, s));
        float cloud = inkFbm(rel / (R * 0.75) + vec2(s * 1.7, 3.0 + s));
        float lit = clamp(fillA / 0.07, 0.6, 1.7);
        float wash = 0.07 + 0.11 * smoothstep(0.3, 1.0, dn) + 0.09 * (gran - 0.5) + 0.1 * (cloud - 0.5);
        float back = inkFbm(rel / (R * 0.42) + vec2(7.0 + s, s * 2.3));
        float bk = (back - 0.56) / 0.022;
        wash += exp(-bk * bk) * 0.07 * smoothstep(0.95, 0.5, dn);
        wash *= lit * body;
        float rimK = (rs + 0.012 * R) / (0.022 * R);
        float rim = exp(-rimK * rimK) * (0.45 + 0.55 * inkNoise(dir * 11.0 + s)) * ringA * 0.62;
        float bleed = (1.0 - smoothstep(0.0, (0.07 + 0.07 * n2) * R, rs)) * (1.0 - body);
        bleed *= 0.1 * inkNoise(rel / max(R * 0.05, 0.5) + s * 7.0);
        float a = wash + rim + bleed;
        if (dropA > 0.003) {
          float t = uTime * 0.55 * uMotion;
          float ring = 0.0;
          for (int k = 0; k < 3; k++) {
            float ph = fract(t + float(k) / 3.0);
            float rk = (rs / R - (0.02 + ph * 0.24)) / (0.012 + ph * 0.02);
            ring += exp(-rk * rk) * (1.0 - ph) * (0.6 + 0.4 * n2);
          }
          a += ring * dropA * 0.5;
          a += body * dropA * 0.06;
        }
        vec3 c = mix(pig, pig * 0.55, clamp(rim * 2.0, 0.0, 1.0));
        return vec4(c, a);
      }

      void main() {
        int i = vIdx;
        vec4 z1 = zoneTexel(i, 1);
        vec4 z2 = zoneTexel(i, 2);
        vec4 z3 = zoneTexel(i, 3);
        vec3 col = z1.rgb;
        float op = z1.a;
        float fillA = z2.x, ringA = z2.y, ringW = z2.z, dropA = z2.w;
        float R = max(z3.x, 1.0);
        float morph = z3.z;
        float rad, ang;
        float sd = sdOutline(i, vWorld, rad, ang);
        // world units per screen pixel — antialiasing that holds at any zoom
        float aa = max(fwidth(vWorld.x), fwidth(vWorld.y)) * 1.2 + 0.0012;

        if (uInk > 0.5) {
          vec4 ink = inkPool(i, sd, rad, ang, col, R, z3.y, fillA, ringA, dropA, aa);
          float ia = ink.a * op;
          if (ia < 0.003) discard;
          fragColor = vec4(ink.rgb, min(ia, 1.0));
          return;
        }

        float inside = 1.0 - smoothstep(-aa, aa, sd);
        // The membrane body: the classic flat fill, and — as the disc becomes
        // a membrane — a soft glow gathering just inside the skin, like light
        // caught in a soap film.
        float skin = exp(min(sd, 0.0) / 26.0);
        float body = fillA * (1.0 + morph * (1.1 * skin - 0.2));
        vec4 acc = vec4(col, body * inside);

        // Lenses: where this membrane overlaps another, paint the pair's mix.
        if (uLens > 0.001 && morph > 0.001 && inside > 0.0) {
          vec3 mixSum = vec3(0.0);
          float w = 0.0;
          float edge = 0.0;
          for (int j = 0; j < ${MAX_LENS_ZONES}; j++) {
            if (j >= uCount) break;
            if (j <= i) continue; // each pair's lens is painted once
            vec4 o1 = zoneTexel(j, 1);
            if (o1.a < 0.02) continue;
            float rj, aj;
            float sj = sdOutline(j, vWorld, rj, aj);
            float cj = (1.0 - smoothstep(-aa, aa, sj)) * inside * min(o1.a / max(op, 0.02), 1.0);
            if (cj <= 0.0) continue;
            mixSum += o1.rgb * cj;
            w += cj;
            // distance to the lens edge (the intersection's own outline)
            float lsd = max(sd, sj);
            edge = max(edge, exp(lsd / 6.0) * cj);
          }
          if (w > 0.0) {
            vec3 mixC = (col + mixSum / w) * 0.5;
            float sheen = 0.5 + 0.5 * sin((vWorld.x + vWorld.y) * 0.028 - uTime * 0.7 * uMotion);
            sheen = sheen * sheen * sheen * sheen;
            float k = morph * uLens * min(w, 1.0);
            vec3 lc;
            float la;
            if (uLight > 0.5) {
              // on paper: the overlap glazes darker, like two transparent inks
              lc = mixC * mix(0.72, 0.5, edge);
              la = (0.11 + 0.04 * sheen + 0.3 * edge) * k;
            } else {
              // in the dark: a lit pane of stained glass
              lc = mix(mixC, vec3(1.0), 0.18 + 0.4 * edge + 0.15 * sheen);
              la = (0.12 + 0.07 * sheen + 0.42 * edge) * k;
            }
            acc = over(acc, vec4(lc, la));
          }
        }

        // The outline — drawn through the overlaps too, so both shapes read.
        float ring = (1.0 - smoothstep(ringW * 0.5, ringW * 0.5 + aa, abs(sd))) * ringA;
        acc = over(acc, vec4(col, ring));

        // Drop target: marching ants hugging the skin.
        if (dropA > 0.003) {
          float band = 1.0 - smoothstep(1.0, 1.0 + aa, abs(sd - ${DROP_OFFSET.toFixed(1)}));
          float arcpos = ang * (rad + ${DROP_OFFSET.toFixed(1)}) - uTime * ${ANTS_SPEED.toFixed(1)};
          float dash = step(mod(arcpos, 18.0), 10.0);
          acc = over(acc, vec4(col, band * dash * dropA * 0.9));
        }

        float a = acc.a * op;
        if (a < 0.003) discard;
        fragColor = vec4(acc.rgb, a);
      }
    `
  })
}
