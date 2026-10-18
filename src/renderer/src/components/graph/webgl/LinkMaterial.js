import * as THREE from 'three'
import { FX_GLSL } from './lineFx.js'

// Ribbon material for all link curves. Dashes are computed from world-unit arc length so
// they scale with zoom exactly like SVG stroke-dasharray did inside the zoomed group.
// aFlow (world units/sec, signed) drifts the dash pattern along the curve against uTime —
// the ambient "dash flow" that makes tension/longing edges feel alive. 0 = static.
//
// 水墨 brush mode (uBrush = 1): the same ribbon becomes a calligraphic stroke. The
// geometry is laid out a little wider than the visible stroke (BRUSH_HEADROOM) so the
// fragment shader can shape it: a pressed entry (起笔) at the source, pressure that
// swells and thins along the body, a long taper (收笔) into the target, a ragged
// soft edge, ink pooling along the rims, and dry-brush 飞白 — per-bristle streaks
// that open up as the brush runs out of ink toward the tail. The stroke stops a
// little short of each node (uNodeR) so it breathes instead of vanishing under the
// roundel. aMeta.x is the stroke's birth time on the uTime clock: it writes itself
// on over uWriteDur seconds (no per-frame buffer writes — the uniform clock does
// it). uBrush = 2 is the soft wash used by the selection halo underlay.
export const BRUSH_HEADROOM = 1.6

const BRUSH_GLSL = /* glsl */ `
  float bHash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
  float bHash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float bNoise(float x) {
    float i = floor(x), f = fract(x);
    float u = f * f * (3.0 - 2.0 * f);
    return mix(bHash(i), bHash(i + 1.0), u);
  }
  float bNoise2(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = bHash2(i), b = bHash2(i + vec2(1.0, 0.0));
    float c = bHash2(i + vec2(0.0, 1.0)), d = bHash2(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
`

export function createLinkMaterial() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uBrush: { value: 0 }, // 0 = plain ribbon, 1 = brush stroke, 2 = soft wash (halo)
      uNodeR: { value: 22 }, // world gap kept clear at each end in brush mode
      uWriteDur: { value: 1.1 }, // write-on duration (s)
      uDry: { value: 1 }, // 飞白 strength (0 on dark "moonlit" ink is still fine)
      // Line effects (lineFx.js) — plain-ribbon mode only.
      uFxSpeed: { value: 1 },
      uFxGlow: { value: 1 },
      uFxKeep: { value: 0 },
      uFxLight: { value: 0 },
      // Perspective-tilt depth haze (0 = flat view): far ground fades back.
      uFog: { value: 0 }
    },
    vertexShader: /* glsl */ `
      uniform float uFog;
      in vec3 aColor;
      in float aArc;
      in vec2 aDash;     // (dashLen, gapLen) in world units; dashLen<=0 => solid
      in float aOpacity;
      in float aFlow;    // dash drift speed (world units/sec, signed); 0 = static
      in float aSide;    // -1 / +1 across the ribbon (static)
      in float aLen;     // total arc length of this link (world units)
      in vec2 aMeta;     // (birth time on the uTime clock, per-link seed)
      in vec3 aFx;       // line effect: (effect id, core fraction, padded half-width)
      out vec3 vFx;
      out vec3 vColor;
      out float vArc;
      out vec2 vDash;
      out float vOpacity;
      out float vFlow;
      out float vSide;
      out float vLen;
      out vec2 vMeta;
      void main() {
        vColor = aColor; vArc = aArc; vDash = aDash; vOpacity = aOpacity; vFlow = aFlow;
        vSide = aSide; vLen = aLen; vMeta = aMeta; vFx = aFx;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        // clip w is the tilt depth (1 = centre line): recede into a soft haze.
        vOpacity *= 1.0 - uFog * 0.5 * smoothstep(1.0, 2.4, gl_Position.w);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform float uBrush;
      uniform float uNodeR;
      uniform float uWriteDur;
      uniform float uDry;
      in vec3 vColor;
      in float vArc;
      in vec2 vDash;
      in float vOpacity;
      in float vFlow;
      in float vSide;
      in float vLen;
      in vec2 vMeta;
      in vec3 vFx;
      out vec4 fragColor;
      ${BRUSH_GLSL}
      ${FX_GLSL}

      void main() {
        int mode = int(uBrush + 0.5);
        if (mode == 0) {
          int fx = int(vFx.x + 0.5);
          if (fx > 0) {
            vec4 e = lineFx(fx, vColor, vSide, vFx.y, vFx.z, vArc, vLen, vMeta.y * 97.0);
            // Effects carry their own falloff: lift the line opacity a touch so the
            // default 60% still reads as a lit effect (lens fades scale it down).
            float al = e.a * min(1.0, vOpacity * 1.45);
            if (al < 0.004) discard;
            fragColor = vec4(e.rgb, clamp(al, 0.0, 1.0));
            return;
          }
          if (vDash.x > 0.0) {
            float period = vDash.x + vDash.y;
            float arc = vArc - vFlow * uTime;
            if (mod(mod(arc, period) + period, period) > vDash.x) discard;
          }
          fragColor = vec4(vColor, vOpacity);
          return;
        }

        float seed = vMeta.y * 97.0;
        float s = abs(vSide) * ${BRUSH_HEADROOM.toFixed(3)}; // 0 at the spine, 1 = nominal rim
        float aaS = fwidth(vSide) * ${BRUSH_HEADROOM.toFixed(3)} * 1.25 + 0.001;

        // Visible stroke parameter u: 0 at the source rim, 1 at the target rim.
        float gap = min(uNodeR, vLen * 0.32);
        float span = max(vLen - 2.0 * gap, 1.0);
        float u = (vArc - gap) / span;
        if (u < -0.02 || u > 1.02) discard;

        if (mode == 2) {
          // Soft wash underlay (selection halo): a wet bloom with granulation.
          float ends = smoothstep(-0.02, 0.10, u) * (1.0 - smoothstep(0.90, 1.02, u));
          float g = 0.75 + 0.5 * bNoise2(vec2(vArc * 0.08, vSide * 2.0) + seed);
          float a = (1.0 - smoothstep(0.15, 1.0, s)) * ends * g;
          fragColor = vec4(vColor, vOpacity * a);
          if (fragColor.a < 0.003) discard;
          return;
        }

        // Write-on: the stroke draws itself from source to target.
        float prog = 1.0;
        if (vMeta.x > -100.0) {
          float k = clamp((uTime - vMeta.x) / uWriteDur, 0.0, 1.0);
          prog = 1.0 - pow(1.0 - k, 2.4);
        }
        if (u > prog + 0.002) discard;

        // ---- width profile (fraction of the nominal half-width) ----
        float uc = clamp(u, 0.0, 1.0);
        float entry = sqrt(clamp(uc / 0.045, 0.0, 1.0));           // rounded press-in
        float press = 1.0 + 0.32 * exp(-pow((uc - 0.07) / 0.06, 2.0)); // the 起笔 knot
        float body = 0.70 + 0.38 * bNoise(vArc * 0.012 + seed)
                   + 0.10 * sin(uc * 3.14159);                     // breathing pressure
        float tail = mix(1.0, 0.12, pow(smoothstep(0.55, 1.0, uc), 1.3)); // 收笔
        // While writing, the live tip lifts like a brush leaving the paper.
        float tip = prog < 1.0 ? smoothstep(prog + 0.004, prog - 0.05, u) * 0.75 + 0.25 : 1.0;
        float w = entry * press * body * tail * tip;

        // Dashed bonds become a run of brush dabs (点): each dash swells and tapers.
        float dabA = 1.0;
        if (vDash.x > 0.0) {
          float period = vDash.x + vDash.y;
          float arc = vArc - vFlow * uTime;
          float lp = mod(mod(arc, period) + period, period);
          if (lp > vDash.x) discard;
          float lu = lp / vDash.x;
          float dab = pow(max(sin(lu * 3.14159), 0.0), 0.55);
          w = max(w, 0.35) * (0.35 + 0.75 * dab) * (0.85 + 0.3 * bHash(floor((arc) / period) + seed));
          dabA = 0.75 + 0.25 * dab;
        }

        // Ragged, fibrous edge.
        float edgeN = (bNoise(vArc * 0.35 + vSide * 3.1 + seed) - 0.5) * 0.16;
        float cover = 1.0 - smoothstep(w - aaS, w + aaS, s + edgeN);
        if (cover < 0.004) discard;

        // ---- dry brush 飞白 ----
        // Bristles run along the stroke; each has its own ink load and dries out
        // in streaks. Dryness grows toward the tail and at the outer bristles.
        float rel = clamp(s / max(w, 0.05), 0.0, 1.0);
        float pxAcross = 2.0 / max(fwidth(vSide), 1e-4) * w; // stroke width on screen
        float detail = smoothstep(2.5, 7.0, pxAcross) * uDry;
        float bristle = vSide / max(w, 0.05) * 7.0 + seed;
        float bi = floor(bristle);
        float load = bHash(bi * 1.7 + seed);
        float streak = bNoise2(vec2(bi * 3.1, vArc * 0.045 + bi * 7.3));
        float streak2 = bNoise(vArc * 0.16 + bi * 13.7);
        float dry = 0.16 + 0.66 * smoothstep(0.30, 1.0, uc) + 0.30 * rel * rel
                  + 0.12 * (1.0 - entry);
        float ink = load * 0.35 + streak * 0.45 + streak2 * 0.20;
        float white = smoothstep(dry - 0.10, dry + 0.06, ink); // 1 = inked, 0 = paper shows
        float dryA = mix(1.0, mix(0.10, 1.0, white), detail);

        // Ink density: slow wet/dry rhythm along the stroke, pooling at the rims.
        float dens = 0.82 + 0.22 * bNoise(vArc * 0.006 + seed * 0.37);
        float pool = 1.0 + 0.22 * smoothstep(0.62, 0.98, rel) * (1.0 - smoothstep(0.55, 1.0, uc));
        vec3 col = vColor * (1.0 - 0.10 * smoothstep(0.7, 1.0, rel));

        float a = vOpacity * cover * dryA * dens * pool * dabA;
        // Brush strokes read stronger than hairlines: lift faint opacities a touch.
        a = clamp(a * 1.25, 0.0, 1.0);
        if (a < 0.004) discard;
        fragColor = vec4(col, a);
      }
    `
  })
}

// Instanced arrowhead material (one triangle per parent/adopted link, oriented along the
// curve's end tangent). Colour + scale are per-instance so lineage emphasis can animate them.
export function createArrowMaterial() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      in vec2 iPos;
      in float iAngle;
      in float iScale;
      in vec3 iColor;
      out vec3 vColor;
      out float vAlpha;
      void main() {
        vColor = iColor;
        vAlpha = iScale > 0.001 ? 0.9 : 0.0;
        float c = cos(iAngle), s = sin(iAngle);
        vec2 p = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
        vec2 world = iPos + p * iScale;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      in vec3 vColor;
      in float vAlpha;
      out vec4 fragColor;
      void main() {
        if (vAlpha < 0.01) discard;
        fragColor = vec4(vColor, vAlpha);
      }
    `
  })
}
