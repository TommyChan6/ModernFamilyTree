import * as THREE from 'three'
import { POP_DUR, POP_OVERSHOOT } from './popAnim.js'
import { NODE_SHAPES, nodeShapeId, shapeAnchor } from './nodeShapes.js'
import { STAR_DECODE_GLSL } from '../constellation'

// Half-extent of each node quad, in units of the node radius. The shape (radius r)
// sits at corner-distance 1/QUAD_SCALE; the surrounding margin holds the drop shadow,
// selection ring, glow and decor ornaments.
export const QUAD_SCALE = 1.6

// Shape ids live in nodeShapes.js (pure, shared with the overlay + tests).
export { NODE_SHAPES, nodeShapeId }

// Standing shapes (gravestone, plate) rest their base on the node point: the
// quad is raised by `lift` radii, so in corner units (-1..1 across the quad)
// the base is at +STONE_BASE. Both share one lift (nodeShapes.js ANCHORS).
const STONE_BASE = shapeAnchor('gravestone').lift / QUAD_SCALE
if (
  shapeAnchor('plate').lift !== shapeAnchor('gravestone').lift ||
  shapeAnchor('flatplate').lift !== shapeAnchor('gravestone').lift
)
  throw new Error('standing shapes must share one lift (the shader bakes one base line)')

// Decor ids (uDecor): procedural ornaments drawn around the shape rim.
// 'enso' is not a rim ornament: it switches the node to the 水墨 ink-wash roundel
// (the ink branch in the fragment shader; also automatic in the app's Ink theme).
export const NODE_DECORS = ['none', 'aura', 'runes', 'orbit', 'burst', 'pulse', 'enso']
export function nodeDecorId(name) {
  const i = NODE_DECORS.indexOf(name)
  return i < 0 ? 0 : i
}

// Per-person AURA ornaments (iAura.x) — the special effect a tag or trait gives
// its bearers (src/shared/auras.ts). Ids 1–5 reuse the decor ornaments in the
// aura's own colour; 7+ are aura-only (6 stays 'enso', which isn't an ornament).
export const AURA_SHADER_IDS = {
  none: 0,
  aura: 1,
  runes: 2,
  orbit: 3,
  burst: 4,
  pulse: 5,
  halo: 7,
  flame: 8,
  frost: 9,
  sparkle: 10,
  crown: 11,
  shadow: 12,
  storm: 13,
  bloom: 14
}
export function auraShaderId(name) {
  return AURA_SHADER_IDS[name] || 0
}
/** Seconds an aura takes to ignite (shockwave + fade-in) when it's assigned. */
export const AURA_IGNITE_DUR = 1.1

// One instanced ShaderMaterial draws every node in a single draw call. Per-instance
// attributes carry position/size/colour/state; the fragment shader draws the node as a
// signed-distance shape (circle/square/diamond/hexagon/shield/oval/octagon/heart —
// uShape), with the avatar (or gender fill + silhouette) masked to it, a border ring,
// offset soft drop shadow, selection haze, and an optional procedural decor ornament
// (uDecor: gilded aura / rotating runes / orbiting spark / spiked burst / echo pulse)
// tinted uDecorColor. uDecorTime freezes in performance mode so ornaments go still.
// WebGL2 sampler2DArray holds avatars.
export function createNodeMaterial({ atlasTexture, pixelRatio = 1 }) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide, // flat 2D quads: never cull by winding
    uniforms: {
      uAtlas: { value: atlasTexture },
      uHasAtlas: { value: atlasTexture ? 1 : 0 },
      uPixelRatio: { value: pixelRatio },
      uTime: { value: 0 }, // drives the selection halo's gentle breathing pulse
      uDecorTime: { value: 0 }, // decor animation clock (frozen in performance mode)
      uShape: { value: 0 },
      uDecor: { value: 0 },
      uDecorColor: { value: new THREE.Color(0xd4af37) },
      // Theme-dependent shadow (dark: tighter/darker, light: softer/lighter).
      uShadowColor: { value: new THREE.Color(0x000000) },
      uShadowStrength: { value: 0.35 },
      uShadowOffset: { value: new THREE.Vector2(0.09, 0.135) }, // corner units (dx2,dy3 @ r22)
      uGlowColor: { value: new THREE.Color(0xffffff) }, // focus haze; theme-set by NodeLayer
      uSilhouetteColor: { value: new THREE.Color(1, 1, 1) },
      // 水墨 ink-wash roundels (the ink branch in main()).
      uInk: { value: 0 }, // 1 = ink-wash node rendering
      uInkMoon: { value: 0 }, // 1 = pale ink on a dark ground
      uInkColor: { value: new THREE.Color(0x1f1b16) }, // ensō / brush ink
      uInkPaper: { value: new THREE.Color(0xece3cf) }, // portrait highlight tone
      uSealColor: { value: new THREE.Color(0xb3352a) }, // cinnabar selection seal
      uBloomDur: { value: 1.3 },
      uPopDur: { value: POP_DUR }, // appear-pop length (s) — popAnim.js
      // Screen-space billboarding: nodes are drawn as upright cards around their
      // projected point, so under the perspective tilt they stand up (and shrink
      // with distance) instead of lying flat on the ground plane.
      uViewScale: { value: new THREE.Vector2(2, -2) }, // (2/W, -2/H) px -> clip
      uZoom: { value: 1 }, // camera k (world -> px)
      uLift: { value: 0 }, // shape stands on its point (radii; gravestone)
      uFog: { value: 0 }, // tilt depth haze 0..1
      // Gravestone materials (theme-set by NodeLayer).
      uStoneColor: { value: new THREE.Color(0x8d939f) },
      uSoilColor: { value: new THREE.Color(0x3a2f26) },
      uGrassColor: { value: new THREE.Color(0x56803c) },
      uMossColor: { value: new THREE.Color(0x667f3a) },
      uFrameColor: { value: new THREE.Color(0xb48a52) },
      // Star nodes (constellation skin): 0 = glowing stars on a night sky,
      // 1 = a printed star atlas — ink dots and hairline spikes on light paper.
      uStarLight: { value: 0 }
    },
    vertexShader: /* glsl */ `
      // Three injects: in vec3 position; (the quad corner in [-1,1]) + matrices.
      uniform vec2 uViewScale;
      uniform float uZoom;
      uniform float uLift;
      uniform float uTime;
      uniform float uPopDur;
      in vec2 iPos;
      in float iRadius;
      in vec3 iFill;
      in vec3 iBorder;
      // Scalars ride packed in vec4s: every attribute is one slot, and ANGLE's
      // D3D11 backend (desktop Electron) also spends a slot on gl_InstanceID —
      // one too many and the program fails to link ("Too many attributes").
      in vec4 iLook;        // (border px in world px, border alpha, opacity, atlas layer or -1)
      in vec4 iState;       // (selected 0/1, glow 0..1, ink bloom birth, appear-pop start)
                            //  — times on the uTime clock; very negative = settled
      in vec4 iAura;        // (aura ornament id, strength, ignite start, packed 0xRRGGBB)

      out vec2 vCorner;     // -1..1 across the quad
      out vec3 vFill;
      out vec3 vBorder;
      out float vBorderNorm; // border half-width in corner units
      out float vBorderA;
      out float vOpacity;
      out float vSelected;
      out float vGlow;
      out float vAvatar;
      out float vSeed;      // stable per-instance phase for decor animation
      out float vBorn;
      out float vDepth;     // tilt depth (clip w): 1 = centre line, >1 receding
      out vec4 vAura;
      out vec3 vAuraColor;
      out vec2 vStar;       // star nodes: (magnitude 0..1, twinkles 0/1) — packed in iState.x

      void main() {
        float iPop = iState.w;
        vBorn = iState.z;
        vAura = iAura;
        vAuraColor = vec3(floor(iAura.w / 65536.0), mod(floor(iAura.w / 256.0), 256.0), mod(iAura.w, 256.0)) / 255.0;
        vCorner = position.xy;
        vFill = iFill;
        vBorder = iBorder;
        vBorderNorm = (iLook.x / max(iRadius, 0.001)) / ${QUAD_SCALE.toFixed(4)};
        vBorderA = iLook.y;
        vOpacity = iLook.z;
        // iState.x = selected + 2·(twinkle + 2·magnitude level) — constellation.ts
        ${STAR_DECODE_GLSL}
        vGlow = iState.y;
        vAvatar = iLook.w;
        vSeed = fract(float(gl_InstanceID) * 0.61803398875);
        // Project the node POINT, then grow the quad around it in screen space.
        // Adding the offset in clip space lets the GPU's divide by w apply the
        // perspective shrink for free; with no tilt (w = 1) this is exactly the old
        // world-space quad. uLift raises standing shapes so they rest ON the point.
        vec4 c = projectionMatrix * modelViewMatrix * vec4(iPos, 0.0, 1.0);
        vec2 offPx = (position.xy * ${QUAD_SCALE.toFixed(4)} - vec2(0.0, uLift)) * iRadius * uZoom;
        // A newcomer pops in: easeOutBack from nothing, ~15% past full size,
        // settling at 1 (popAnim.popScale). Scaling the whole offset grows the
        // shape around its anchor, so standing shapes rise from their foot.
        if (iPop > -100.0) {
          float pk = clamp((uTime - iPop) / uPopDur, 0.0, 1.0);
          float pq = pk - 1.0;
          offPx *= 1.0 + ${(POP_OVERSHOOT + 1).toFixed(2)} * pq * pq * pq + ${POP_OVERSHOOT.toFixed(2)} * pq * pq;
        }
        c.xy += offPx * uViewScale;
        gl_Position = c;
        vDepth = c.w;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      precision highp sampler2DArray;

      uniform sampler2DArray uAtlas;
      uniform int uHasAtlas;
      uniform vec3 uShadowColor;
      uniform float uShadowStrength;
      uniform vec2 uShadowOffset;
      uniform vec3 uGlowColor;
      uniform vec3 uSilhouetteColor;
      uniform float uTime;
      uniform float uDecorTime;
      uniform float uShape;
      uniform float uDecor;
      uniform vec3 uDecorColor;
      uniform float uInk;
      uniform float uInkMoon;
      uniform vec3 uInkColor;
      uniform vec3 uInkPaper;
      uniform vec3 uSealColor;
      uniform float uBloomDur;
      uniform float uFog;
      uniform vec3 uStoneColor;
      uniform vec3 uSoilColor;
      uniform vec3 uGrassColor;
      uniform vec3 uMossColor;
      uniform vec3 uFrameColor;
      uniform float uStarLight;

      in float vBorn;
      in float vDepth;
      in vec2 vCorner;
      in vec3 vFill;
      in vec3 vBorder;
      in float vBorderNorm;
      in float vBorderA;
      in float vOpacity;
      in float vSelected;
      in float vGlow;
      in float vAvatar;
      in float vSeed;
      in vec4 vAura;
      in vec3 vAuraColor;
      in vec2 vStar;

      out vec4 fragColor;

      const float R = 1.0 / ${QUAD_SCALE.toFixed(4)}; // shape edge in corner units
      const float IGNITE_DUR = ${AURA_IGNITE_DUR.toFixed(2)}; // aura ignition (s)
      const float PI = 3.14159265359;

      // Porter-Duff "over": src on top of dst.
      vec4 over(vec4 src, vec4 dst) {
        float a = src.a + dst.a * (1.0 - src.a);
        if (a <= 0.0001) return vec4(0.0);
        vec3 rgb = (src.rgb * src.a + dst.rgb * dst.a * (1.0 - src.a)) / a;
        return vec4(rgb, a);
      }

      float dot2(vec2 v) { return dot(v, v); }

      // ── Signed-distance shapes (0 at the rim, negative inside) ─────────────
      float sdBox(vec2 p, vec2 b, float r) {
        vec2 q = abs(p) - b + r;
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
      }
      float sdRhombus(vec2 p, vec2 b) {
        p = abs(p);
        float f = clamp((b.x * b.x - b.y * b.y - 2.0 * (p.x * b.x - p.y * b.y)) / dot(b, b), -1.0, 1.0);
        float d = length(p - 0.5 * b * vec2(1.0 - f, 1.0 + f));
        return d * sign(p.x * b.y + p.y * b.x - b.x * b.y);
      }
      float sdHexagon(vec2 p, float r) {
        const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
        p = abs(p);
        p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
        p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
        return length(p) * sign(p.y);
      }
      float sdOctogon(vec2 p, float r) {
        const vec3 k = vec3(-0.9238795325, 0.3826834323, 0.4142135623);
        p = abs(p);
        p -= 2.0 * min(dot(vec2(k.x, k.y), p), 0.0) * vec2(k.x, k.y);
        p -= 2.0 * min(dot(vec2(-k.x, k.y), p), 0.0) * vec2(-k.x, k.y);
        p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
        return length(p) * sign(p.y);
      }
      // Heraldic shield: two great-circle sides meeting in a bottom point,
      // squared off flat across the top. +y is down.
      float sdShield(vec2 p) {
        float rr = 1.62 * R;
        float dl = length(p - vec2(-0.62 * R, -0.50 * R)) - rr;
        float dr = length(p - vec2( 0.62 * R, -0.50 * R)) - rr;
        float lens = max(dl, dr);
        return max(lens, -(p.y + 0.80 * R)); // top cut
      }
      // iq's heart (y-up, point at origin) — remapped so the point is at +y.
      float sdHeartRaw(vec2 P) {
        P.x = abs(P.x);
        if (P.y + P.x > 1.0) return sqrt(dot2(P - vec2(0.25, 0.75))) - 0.35355339059;
        return sqrt(min(dot2(P - vec2(0.0, 1.0)), dot2(P - 0.5 * max(P.x + P.y, 0.0)))) * sign(P.x - P.y);
      }
      float sdHeart(vec2 p) {
        float s = 1.72 * R; // heart height (own units ~1.2) scaled to ~2R
        vec2 q = vec2(p.x / s, (R * 1.02 - p.y) / s);
        return sdHeartRaw(q) * s;
      }

      // Headstone standing on its base (+YB): a round-arched upright on a slightly
      // wider plinth. Proportions in shape radii (R).
      const float YB = ${STONE_BASE.toFixed(4)};
      const float ST_HW = 0.70 * R;            // upright half-width (= arch radius)
      const float ST_TOP = YB - 1.85 * R;      // crown
      const float ST_ARC = ST_TOP + ST_HW;     // arch centre
      const float ST_PLINTH = YB - 0.16 * R;   // top of the plinth
      float sdStone(vec2 p) {
        float arch = length(p - vec2(0.0, ST_ARC)) - ST_HW;
        float slab = sdBox(p - vec2(0.0, (ST_ARC + ST_PLINTH) * 0.5), vec2(ST_HW, (ST_PLINTH - ST_ARC) * 0.5), 0.0);
        float plinth = sdBox(p - vec2(0.0, YB - 0.08 * R), vec2(ST_HW * 1.18, 0.08 * R), 0.03 * R);
        return min(min(arch, slab), plinth);
      }

      // Plate: a flat rectangular slab standing upright on its bottom edge (+YB),
      // planted in the ground. The FRONT face is the shape; a thin offset copy
      // behind it (plateNode) shows the slab's thickness.
      const float PL_HW = 0.66 * R;            // half-width
      const float PL_TOP = YB - 1.9 * R;       // top edge
      const vec2 PL_DEPTH = vec2(0.13, -0.09) * R; // the edge seen beside/above the face
      float sdPlate(vec2 p) {
        return sdBox(p - vec2(0.0, (PL_TOP + YB) * 0.5), vec2(PL_HW, (YB - PL_TOP) * 0.5), 0.07 * R);
      }

      // Flat plate: the minimal standing slab — one flat colour, rounded corners.
      const float FP_HW = 0.64 * R;
      const float FP_TOP = YB - 1.85 * R;
      // Star: the clickable / haloed rim is the bright core's reach, not R —
      // the bloom and diffraction spikes spill out to the quad edge.
      const float STAR_RIM = 0.5 * R;
      bool standingShape() {
        int s = int(uShape + 0.5);
        return s >= 8 && s <= 10;
      }

      float sdFlatPlate(vec2 p) {
        return sdBox(p - vec2(0.0, (FP_TOP + YB) * 0.5), vec2(FP_HW, (YB - FP_TOP) * 0.5), 0.14 * R);
      }

      // shapeSD returns the signed distance; also outputs the avatar UV zoom
      // (shapes that poke past R need a slightly wider photo crop).
      float shapeSD(vec2 p, out float ext) {
        int s = int(uShape + 0.5);
        ext = 1.0;
        if (s == 1) { ext = 1.06; return sdBox(p, vec2(R * 0.94), R * 0.24); }
        if (s == 2) { ext = 1.16; return sdRhombus(p, vec2(R * 1.16, R * 1.16)); }
        if (s == 3) { ext = 1.09; return sdHexagon(p, R * 0.94); }
        if (s == 4) { ext = 1.06; return sdShield(p); }
        if (s == 5) { ext = 1.18; vec2 q = p / vec2(1.18, 0.86); return (length(q) - R) * 0.86; }
        if (s == 6) { ext = 1.04; return sdOctogon(p, R * 0.99); }
        if (s == 7) { ext = 1.06; return sdHeart(p); }
        if (s == 8) { ext = 1.0; return sdStone(p); }
        if (s == 9) { ext = 1.0; return sdPlate(p); }
        if (s == 10) { ext = 1.0; return sdFlatPlate(p); }
        if (s == 11) { ext = 1.0; return length(p) - STAR_RIM; }
        return length(p) - R;
      }

      // ── Decor ornaments (drawn outside the rim, tinted uDecorColor) ────────
      // Returns premultiplied-ish alpha for ornament m at this fragment (the
      // global decor, or an aura's ornaments 1–5 in the aura's own colour).
      float decorAlphaM(int m, vec2 p, float sd, float aa, float t, float dSeed) {
        if (m == 0) return 0.0;
        float ang = atan(p.y, p.x);
        float outside = smoothstep(0.0, aa * 2.0, sd); // never over the avatar
        if (m == 1) {
          // Gilded aura: a paired ring, shimmering slowly around the rim.
          float ring1 = 1.0 - smoothstep(0.016, 0.016 + aa, abs(sd - 0.10 * R));
          float ring2 = 1.0 - smoothstep(0.010, 0.010 + aa, abs(sd - 0.20 * R));
          float shimmer = 0.82 + 0.18 * sin(ang * 3.0 - t * 0.9 + dSeed * 6.2832);
          return (ring1 * 0.95 + ring2 * 0.55) * shimmer * outside;
        }
        if (m == 2) {
          // Runic ring: dashed sigils slowly revolving.
          float band = 1.0 - smoothstep(0.030, 0.030 + aa, abs(sd - 0.15 * R));
          float seg = fract(ang / (2.0 * PI) * 12.0 + t * 0.16 + dSeed);
          float dash = smoothstep(0.12, 0.24, seg) * (1.0 - smoothstep(0.58, 0.72, seg));
          return band * dash * 0.95 * outside;
        }
        if (m == 3) {
          // Orbiting spark + comet trail on a circular track around the shape.
          float circ = length(p) - 1.24 * R;
          float track = 1.0 - smoothstep(0.008, 0.008 + aa, abs(circ));
          float theta = t * 1.5 + dSeed * 6.2832;
          vec2 sparkPos = vec2(cos(theta), sin(theta)) * 1.24 * R;
          // angle-space distance drives the comet trail; a radial band confines it
          float dAng = mod(theta - ang, 2.0 * PI);
          float nearTrack = 1.0 - smoothstep(0.05, 0.09, abs(circ));
          float trail = exp(-dAng * 2.6) * nearTrack;
          float spark = exp(-dot2(p - sparkPos) * 260.0);
          return (track * 0.16 + trail * 0.8 + spark * 1.5) * outside;
        }
        if (m == 4) {
          // Burst crown: soft spikes radiating from the rim, slowly turning.
          float spikes = pow(max(0.0, cos(ang * 8.0 + t * 0.35 + dSeed * 6.2832)), 3.0);
          float f = sd - 0.05 * R - spikes * 0.17 * R;
          float body = (1.0 - smoothstep(-0.02, aa * 3.0, f)) * outside;
          return body * (0.45 + 0.45 * spikes);
        }
        if (m == 5) {
          // Echo pulse: expanding rings that fade as they travel.
          float a = 0.0;
          for (int k = 0; k < 2; k++) {
            float ph = fract(t * 0.42 + float(k) * 0.5 + dSeed * 0.31);
            float rad = ph * 0.40 * R + 0.04 * R;
            float w = 0.012 + ph * 0.02;
            float ring = 1.0 - smoothstep(w, w + aa, abs(sd - rad));
            a += ring * (1.0 - ph) * (1.0 - ph);
          }
          return a * 0.9 * outside;
        }
        return 0.0;
      }
      float decorAlpha(vec2 p, float sd, float aa) {
        return decorAlphaM(int(uDecor + 0.5), p, sd, aa, uDecorTime, vSeed);
      }

      // ── 水墨 ink-wash roundel ─────────────────────────────────────────────
      float iHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float iNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = iHash(i), b = iHash(i + vec2(1.0, 0.0));
        float c = iHash(i + vec2(0.0, 1.0)), d = iHash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }
      float iFbm(vec2 p) {
        return 0.5 * iNoise(p) + 0.3 * iNoise(p * 2.03 + 7.1) + 0.2 * iNoise(p * 4.07 + 3.7);
      }

      // ── Auras: the special effect a tag / trait gives its bearers ──────────
      // vAura = (ornament id, strength, ignite start, packed colour) → vAuraColor.
      // Each ornament paints a BACK layer (composited under the whole node:
      // nimbus, fire, smoke) and/or a FRONT layer (over it: crown, frost,
      // sparkles, lightning, petals). When an aura is assigned it ignites: a
      // shockwave in its colour rolls off the rim while the ornament fades in.
      float auraTopY() {
        int s = int(uShape + 0.5);
        if (s == 8) return ST_TOP;
        if (s == 9) return PL_TOP;
        if (s == 10) return FP_TOP;
        if (s == 2) return -1.16 * R;
        if (s == 4) return -0.80 * R;
        if (s == 5) return -0.86 * R;
        if (s == 11) return -STAR_RIM;
        return -R;
      }
      // Body centre (xy) + half-height (z): standing shapes rise above their foot.
      vec3 auraBody() {
        float top = auraTopY();
        if (standingShape()) return vec3(0.0, (top + YB) * 0.5, (YB - top) * 0.5);
        if (int(uShape + 0.5) == 11) return vec3(0.0, 0.0, STAR_RIM);
        return vec3(0.0, 0.0, R);
      }
      // A soft four-point twinkle at q (R units), size sz.
      float twinkle(vec2 q, float sz) {
        float st = sqrt(abs(q.x)) + sqrt(abs(q.y));
        float star = 1.0 - smoothstep(0.0, sqrt(sz) * 1.15, st);
        float core = exp(-dot(q, q) / (sz * sz * 0.09));
        return star * 0.8 + core;
      }

      void auraLayers(vec2 p, float sd, float aa, out vec4 back, out vec4 front) {
        back = vec4(0.0);
        front = vec4(0.0);
        int m = int(vAura.x + 0.5);
        if (m == 0) return;
        vec3 c = vAuraColor;
        float t = uDecorTime;
        float s = vSeed;
        float ig = vAura.z > -100.0 ? clamp((uTime - vAura.z) / IGNITE_DUR, 0.0, 1.0) : 1.0;
        float show = clamp(vAura.y, 0.0, 1.0) * smoothstep(0.12, 0.8, ig);
        vec3 bodyC = auraBody();
        vec2 cen = bodyC.xy;
        float rad = bodyC.z;
        vec2 d = p - cen;
        float r = length(d);
        float ang = atan(d.y, d.x);
        float outside = smoothstep(0.0, aa * 2.0, sd);
        float top = auraTopY();
        bool standing = standingShape();

        if (m <= 5) {
          front = vec4(c, min(decorAlphaM(m, p, sd, aa, t, s), 1.0));
        } else if (m == 7) {
          // HALO: a saint's nimbus. A gilded disc behind the head with fine
          // turning rays, a crisp double rim and a slow breath of light.
          vec2 hc = vec2(0.0, top + (standing ? 0.66 * R : R));
          float hr = standing ? 0.95 * R : 1.36 * R;
          float rr = length(p - hc);
          float disc = 1.0 - smoothstep(hr - aa * 2.0, hr + aa, rr);
          float rays = pow(0.5 + 0.5 * cos(atan(p.y - hc.y, p.x - hc.x) * 18.0 + t * 0.25), 3.0);
          float fall = smoothstep(hr * 0.35, hr, rr);
          float ring = 1.0 - smoothstep(0.014, 0.014 + aa, abs(rr - hr * 0.96));
          float ring2 = 1.0 - smoothstep(0.008, 0.008 + aa, abs(rr - hr * 0.8));
          float glow = exp(-max(rr - hr, 0.0) * 14.0) * (1.0 - disc);
          float breath = 0.88 + 0.12 * sin(t * 1.3 + s * 6.2832);
          float a = (disc * (0.16 + 0.22 * fall + 0.2 * rays * fall) + ring * 0.85 + ring2 * 0.35 + glow * 0.4) * breath;
          back = vec4(mix(c, vec3(1.0, 0.97, 0.86), 0.25 * rays * fall + 0.4 * ring), clamp(a, 0.0, 1.0));
        } else if (m == 8) {
          // FLAME: fire licking up off the rim. Tall tongues on top, a low
          // skirt below, white-hot at the root, embers thrown upward.
          float up = -d.y / max(r, 1e-4);
          float hgt = (0.10 + 0.46 * smoothstep(-0.3, 1.0, up)) * R;
          float n = iFbm(vec2(d.x * 7.0 + s * 13.0, d.y * 4.5 + t * 2.6));
          float n2 = iNoise(vec2(d.x * 15.0 - s * 7.0, d.y * 9.0 + t * 4.1));
          float reach = hgt * (0.45 + 0.75 * n) + 0.05 * R * n2;
          float fire = (1.0 - smoothstep(-aa * 1.5, aa * 1.5, sd - reach)) * smoothstep(-0.02, 0.01, sd);
          float heat = clamp(1.0 - sd / max(reach, 1e-3), 0.0, 1.0);
          vec3 col = mix(c * vec3(0.9, 0.42, 0.32), c, smoothstep(0.0, 0.45, heat));
          col = mix(col, vec3(1.0, 0.96, 0.8), smoothstep(0.62, 1.0, heat));
          float glow = exp(-max(sd, 0.0) / (0.2 * R)) * 0.32 * outside;
          back = vec4(mix(c, col, fire), max(fire * (0.5 + 0.5 * heat), glow));
          for (int i = 0; i < 3; i++) {
            float fi = float(i);
            float ph = fract(t * 0.45 + iHash(vec2(fi, s * 7.0)));
            float x = (iHash(vec2(fi * 3.7, s)) - 0.5) * rad * 1.3 + sin(t * 2.0 + fi * 2.1) * 0.06 * R;
            vec2 sp = vec2(x, top - 0.05 * R - ph * 0.42 * R);
            float spark = exp(-dot2(p - sp) * 2200.0) * (1.0 - ph) * smoothstep(0.0, 0.15, ph);
            front = over(vec4(mix(c, vec3(1.0, 0.92, 0.7), 0.6), spark), front);
          }
        } else if (m == 9) {
          // FROST: crystal shards grown off the rim (six long, six short),
          // faceted and rimed, glints twinkling at the tips, cold mist behind.
          float fa = ang + s * 0.7;
          float mainS = pow(abs(cos(fa * 3.0)), 24.0);
          float minorS = pow(abs(sin(fa * 3.0)), 24.0);
          float f = sd - (0.05 + 0.4 * mainS + 0.17 * minorS) * R;
          float shard = (1.0 - smoothstep(-aa, aa, f)) * outside;
          float facet = step(0.5, fract(fa * 6.0 / 6.2832 + 0.25));
          float edge = smoothstep(-0.035 * R, 0.0, f);
          vec3 ice = mix(c * mix(0.78, 1.12, facet), vec3(1.0), 0.25 + 0.55 * edge);
          float rime = (1.0 - smoothstep(0.016 * R, 0.03 * R, abs(sd - 0.035 * R)))
                     * step(0.4, iNoise(vec2(fa * 9.0, s * 5.0)));
          front = vec4(ice, max(shard * 0.92, rime * 0.7));
          for (int i = 0; i < 3; i++) {
            float fi = float(i);
            float ga = (fi * 2.0 + 1.0) * 1.0472 - s * 0.7;
            vec2 gp = cen + vec2(cos(ga), sin(ga)) * (rad + 0.4 * R);
            float tw = pow(max(0.0, sin(t * 1.7 + fi * 2.1 + s * 9.0)), 8.0);
            float g = twinkle((p - gp) / R, 0.13) * tw;
            front = over(vec4(mix(c, vec3(1.0), 0.8), clamp(g, 0.0, 1.0)), front);
          }
          back = vec4(c, exp(-max(sd, 0.0) / (0.3 * R)) * 0.24 * outside);
        } else if (m == 10) {
          // SPARKLE: stars drifting round the node, each on its own beat.
          float a = 0.0;
          float core = 0.0;
          for (int i = 0; i < 7; i++) {
            float fi = float(i);
            float h1 = iHash(vec2(fi, s * 17.0));
            float h2 = iHash(vec2(fi * 3.1, s * 5.0));
            float sa = fi * 0.8976 + s * 6.2832 + t * 0.12 * (h1 > 0.5 ? 1.0 : -1.0);
            vec2 q = (p - cen - vec2(cos(sa), sin(sa)) * rad * (1.14 + 0.3 * h2)) / R;
            float tw = pow(0.5 + 0.5 * sin(t * (1.6 + h1 * 1.4) + fi * 2.4 + s * 20.0), 3.0);
            float sz = 0.06 + 0.08 * h2;
            a += twinkle(q, sz) * (0.25 + 0.75 * tw);
            core += exp(-dot(q, q) / (sz * sz * 0.05)) * tw;
          }
          front = vec4(mix(c, vec3(1.0), clamp(core, 0.0, 1.0) * 0.8), clamp(a, 0.0, 1.0) * smoothstep(-0.02, 0.04, sd));
        } else if (m == 11) {
          // CROWN: a gilded crown set on the head, bobbing gently. Five points
          // tipped with pearls, three jewels on the band, a glint sliding over.
          float ch = 0.44 * R;
          float cw = (standing ? 0.55 : 0.62) * R;
          float bob = sin(t * 1.4 + s * 6.2832) * 0.025 * R;
          float baseY = max(top + 0.1 * R, -0.98 + ch) + bob;
          float u = p.x / cw;
          float v = (baseY - p.y) / ch;
          float tri = 1.0 - abs(fract((u + 1.0) * 2.0 + 0.5) - 0.5) * 2.0;
          float prof = 0.32 + 0.52 * pow(tri, 1.3) + 0.12 * (1.0 - abs(u));
          float sdC = max(max((v - prof) * ch, -v * ch), (abs(u) - 1.0 - 0.08 * v) * cw);
          vec3 metal = c * (0.72 + 0.55 * smoothstep(0.0, 1.0, v));
          float glint = exp(-pow((u * 0.7 + v * 0.5 - 0.3 - 0.35 * sin(t * 0.6 + s * 4.0)) * 6.0, 2.0));
          metal += vec3(1.0) * glint * 0.35;
          metal *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 0.04, abs(v - 0.32)));
          metal *= 1.0 - 0.35 * smoothstep(-0.03 * R, 0.0, sdC);
          vec4 cr = vec4(metal, 1.0 - smoothstep(-aa, aa, sdC));
          for (int i = 0; i < 5; i++) {
            float pu = -1.0 + 0.5 * float(i);
            vec2 bc = vec2(pu * cw, baseY - (0.91 + 0.12 * (1.0 - abs(pu))) * ch);
            float br = 0.065 * R;
            float ball = 1.0 - smoothstep(br - aa, br + aa, length(p - bc));
            vec3 pearl = mix(c * 1.1, vec3(1.0), clamp(0.55 - 0.4 * (p.y - bc.y) / br, 0.0, 1.0));
            cr = over(vec4(pearl, ball), cr);
          }
          for (int i = 0; i < 3; i++) {
            vec2 gc = vec2((float(i) - 1.0) * 0.5 * cw, baseY - 0.16 * ch);
            float gr = 0.075 * R;
            float gem = 1.0 - smoothstep(gr - aa, gr + aa, length(p - gc));
            vec3 jewel = i == 1 ? vec3(0.16, 0.32, 0.86) : vec3(0.8, 0.1, 0.2);
            jewel = mix(jewel, vec3(1.0), (1.0 - smoothstep(0.0, gr * 0.45, length(p - gc + vec2(0.3) * gr))) * 0.7);
            cr = over(vec4(jewel, gem), cr);
          }
          front = cr;
        } else if (m == 12) {
          // SHADOW: umbral smoke curling off the rim, darkest close in, its
          // wisps lit at the edges in the aura colour.
          float sw = ang + r * 3.0 - t * 0.35;
          float n = iFbm(vec2(cos(sw), sin(sw)) * 1.6 + vec2(r * 5.0 - t * 0.7, s * 9.0));
          float fall = 1.0 - smoothstep(0.0, 0.58 * R, sd);
          float dens = smoothstep(0.36, 0.7, n) * fall * smoothstep(-0.02, 0.02, sd);
          float hug = (1.0 - smoothstep(0.0, 0.1 * R, sd)) * outside;
          float lit = smoothstep(0.55, 0.68, n) * (1.0 - smoothstep(0.68, 0.82, n));
          vec3 col = mix(c * 0.32, c * 1.35 + 0.05, lit * 0.7);
          back = vec4(col, clamp(max(dens * 0.86, hug * 0.55), 0.0, 1.0));
        } else if (m == 13) {
          // STORM: lightning arcs crackling round the rim, re-striking a few
          // times a second, white cores in a coloured glow.
          float tick = floor(t * 7.0);
          float a = 0.0;
          float coreA = 0.0;
          for (int i = 0; i < 3; i++) {
            float fi = float(i);
            float on = step(0.35, iHash(vec2(tick + fi * 13.0, s * 31.0)));
            float a0 = iHash(vec2(fi, tick * 0.37 + s)) * 6.2832;
            float span = 0.9 + 0.8 * iHash(vec2(fi * 7.0, tick));
            float da = mod(ang - a0 + 12.5664, 6.2832);
            float inArc = 1.0 - step(span, da);
            float al = da / span;
            float jag = (iNoise(vec2(al * 9.0 + fi * 5.0, tick + fi)) - 0.5) * 0.22 * R
                      + (iNoise(vec2(al * 27.0, tick * 1.3 + fi)) - 0.5) * 0.08 * R;
            float dd = abs(sd - 0.12 * R - 0.1 * R * sin(al * PI) - jag);
            float taper = sin(al * PI);
            float core = 1.0 - smoothstep(0.007 * taper, 0.007 * taper + aa, dd);
            float glow = exp(-dd / (0.05 * R)) * 0.55;
            a += (core + glow * (1.0 - core)) * inArc * on * taper;
            coreA += core * inArc * on * taper;
          }
          float flick = 0.75 + 0.25 * iHash(vec2(tick, s));
          front = vec4(mix(c, vec3(1.0), clamp(coreA, 0.0, 1.0)), clamp(a * flick, 0.0, 1.0) * outside);
          back = vec4(c, exp(-max(sd, 0.0) / (0.22 * R)) * 0.18 * outside * flick);
        } else if (m == 14) {
          // BLOOM: blossom petals circling the node, fluttering as they turn.
          for (int i = 0; i < 6; i++) {
            float fi = float(i);
            float pa = fi * 1.0472 + s * 6.2832 + t * 0.22;
            vec2 pc = cen + vec2(cos(pa), sin(pa)) * rad * (1.2 + 0.12 * sin(t * 0.9 + fi * 1.7));
            float rot = pa + 1.5708 + sin(t * 1.3 + fi * 2.0) * 0.6 + iHash(vec2(fi, s * 11.0)) * 3.0;
            vec2 q = p - pc;
            q = vec2(cos(rot) * q.x + sin(rot) * q.y, -sin(rot) * q.x + cos(rot) * q.y) / R;
            float e = length(q / vec2(0.15, 0.085)) - 1.0;
            float notch = length((q - vec2(0.15, 0.0)) / vec2(0.05, 0.03)) - 1.0;
            float w = aa / (0.085 * R) * 1.5 + 0.04;
            float petal = 1.0 - smoothstep(-w, w, max(e, -notch));
            vec3 pcol = mix(min(c * 1.15 + 0.08, vec3(1.0)), c * 0.8, smoothstep(-0.15, 0.15, q.x));
            front = over(vec4(pcol, petal * 0.92), front);
          }
        }

        back.a *= show;
        front.a *= show;
        // Ignition: a shockwave in the aura's colour rolls off the rim.
        if (ig < 1.0) {
          float e = 1.0 - pow(1.0 - ig, 3.0);
          float w = 0.035 * R + 0.05 * R * e;
          float ring = 1.0 - smoothstep(w, w + aa, abs(sd - (0.02 * R + 0.62 * R * e)));
          float flash = (1.0 - smoothstep(0.0, 0.25 * R, abs(sd))) * (1.0 - ig) * 0.5;
          front = over(vec4(mix(c, vec3(1.0), 0.35), clamp((ring * 0.9 + flash) * pow(1.0 - ig, 1.4) * outside, 0.0, 1.0)), front);
        }
      }

      // The node painted as a wash of diluted ink that bled into rice paper (晕染):
      // a ragged, granulated body with pigment pooled along its dried edge, a
      // feathered bleed halo, one dry-brush ensō around it (open where the brush
      // lifted), portraits toned to ink. Selection turns the ensō cinnabar and
      // presses a seal (印章) at the lower right; hover is a faint ink haze. New
      // nodes bloom: the wash spreads from a wet centre while the ensō writes round.
      vec4 inkNode(float sd, float ext) {
        vec2 p = vCorner;
        float seed = vSeed * 61.0;
        float ang = atan(p.y, p.x);
        float aa = fwidth(sd) * 1.5 + 0.0012;

        float bl = 1.0;
        if (vBorn > -100.0) {
          float k = clamp((uTime - vBorn) / uBloomDur, 0.0, 1.0);
          bl = 1.0 - pow(1.0 - k, 3.0);
        }

        vec2 dir = p / max(length(p), 1e-4);
        float rag = (iFbm(dir * 2.4 + seed) - 0.5) * 0.08 * R;
        float sdw = sd + rag + (1.0 - bl) * 0.8 * R;
        float gran = iFbm(p * 9.0 + seed);
        float fib = iFbm(p * 24.0 + seed * 1.3);

        // ---- body: tinted wash, or the portrait toned to ink ----
        float inside = 1.0 - smoothstep(-aa, aa, sdw);
        vec3 body = vFill;
        if (uHasAtlas == 1 && vAvatar >= 0.0) {
          vec2 uv = p * (0.5 / (R * ext)) + 0.5;
          vec4 tex = texture(uAtlas, vec3(clamp(uv, 0.0, 1.0), vAvatar));
          if (vAvatar >= 0.5) {
            float L = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
            L = smoothstep(0.04, 0.96, L);
            vec3 toned = uInkMoon > 0.5 ? mix(uInkPaper, uInkColor, L) : mix(uInkColor, uInkPaper, L);
            body = mix(toned, tex.rgb, 0.16);
          } else {
            body = mix(vFill, uSilhouetteColor, tex.a * 0.8);
          }
        }
        body *= 0.84 + 0.28 * gran;
        // the wash dries lighter in its wet heart, denser toward the rim
        body *= mix(1.07, 0.95, smoothstep(0.1 * R, 0.95 * R, length(p - vec2(-0.18, -0.2) * R)));
        float rimPool = smoothstep(-0.10 * R, -0.005 * R, sdw) * inside;
        body = mix(body, body * 0.74, rimPool * 0.45);

        // ---- bleed halo: diluted ink feathering into the fibres ----
        float bleedW = 0.22 * R * (1.0 + 1.4 * (1.0 - bl));
        float bleed = 1.0 - smoothstep(0.0, bleedW, sdw);
        vec4 col = vec4(vFill * 0.9, bleed * (0.08 + 0.26 * fib) * (0.5 + 0.5 * bl));
        col = over(vec4(body, inside), col);

        // ---- ensō: one dry-brush ring, open where the brush lifted ----
        float a0 = vSeed * 6.2832;
        float along = fract((ang - a0) / 6.2832);
        float drawn = 0.84 * bl;
        float entry = smoothstep(0.0, 0.035, along);
        float taper = mix(1.3, 0.16, pow(smoothstep(0.04, 0.84, along), 0.8));
        float thick = R * 0.085 * entry * taper;
        float rr = sd - 0.14 * R - (iNoise(vec2(along * 7.0, seed)) - 0.5) * 0.06 * R;
        float ringCover = (1.0 - smoothstep(thick - aa, thick + aa, abs(rr)))
                        * (1.0 - smoothstep(drawn - 0.015, drawn, along));
        float bi = floor(rr / max(thick, 1e-4) * 3.0 + seed);
        float streak = iNoise(vec2(bi * 3.3, along * 46.0));
        float dry = 0.12 + 0.62 * smoothstep(0.40, 0.92, along);
        float white = smoothstep(dry - 0.10, dry + 0.08, streak * 0.7 + iHash(vec2(bi, seed)) * 0.3);
        float detail = smoothstep(1.2, 3.5, thick / max(fwidth(sd), 1e-5));
        float ensoA = ringCover * mix(1.0, mix(0.12, 1.0, white), detail) * 0.92;
        float sel = vSelected * clamp(vGlow, 0.0, 1.0);
        vec3 ensoCol = (vBorderA > 0.5 && vSelected < 0.5) ? vBorder : uInkColor;
        ensoCol = mix(ensoCol, uSealColor, sel);
        col = over(vec4(ensoCol, ensoA), col);

        // ---- hover / trace: a faint ink haze spreading behind ----
        float focus = vGlow * (1.0 - vSelected);
        if (focus > 0.001) {
          float tt = clamp(sdw / (0.6 * R), 0.0, 1.0);
          float haze = (1.0 - tt) * (1.0 - tt) * (1.0 - inside) * focus * 0.42 * (0.6 + 0.8 * fib);
          col = over(col, vec4(uInkMoon > 0.5 ? uInkColor : uInkColor * 1.4, haze));
        }

        // ---- seal 印章: pressed at the lower right on selection ----
        if (vSelected > 0.5) {
          float st = clamp(vGlow, 0.0, 1.0);
          float sc = mix(1.7, 1.0, st);
          vec2 q = (p - vec2(0.82 * R, 0.78 * R)) / sc;
          float cr = cos(-0.13), sr = sin(-0.13);
          q = vec2(cr * q.x - sr * q.y, sr * q.x + cr * q.y);
          float hw = 0.26 * R;
          float boxD = sdBox(q, vec2(hw), 0.035 * R) + (iNoise(q * 48.0 + seed) - 0.5) * 0.02 * R;
          float sealIn = 1.0 - smoothstep(-aa, aa, boxD);
          vec2 g = q / hw;
          float inner = 1.0 - smoothstep(-0.06 * R, -0.045 * R, boxD);
          float bar = 0.075;
          float v1 = (1.0 - smoothstep(bar, bar + 0.05, abs(g.x + 0.36))) * step(abs(g.y), 0.66);
          float v2 = (1.0 - smoothstep(bar, bar + 0.05, abs(g.x - 0.36))) * step(abs(g.y), 0.66);
          float h1 = (1.0 - smoothstep(bar, bar + 0.05, abs(g.y + 0.40))) * step(abs(g.x), 0.62);
          float h2 = (1.0 - smoothstep(bar, bar + 0.05, abs(g.y - 0.02))) * step(abs(g.x), 0.62);
          float h3 = (1.0 - smoothstep(bar, bar + 0.05, abs(g.y - 0.44))) * step(abs(g.x + 0.36), 0.3);
          float carve = max(max(v1, v2), max(h1, max(h2, h3))) * inner;
          carve *= step(0.22, iNoise(g * 5.0 + seed));
          float sealA = sealIn * (1.0 - carve * 0.9) * st * (0.82 + 0.18 * iNoise(q * 70.0));
          col = over(vec4(uSealColor, sealA * 0.94), col);
        }

        if (vAura.x < 0.5) {
          float dA = decorAlpha(p, sd, aa);
          if (dA > 0.002) col = over(vec4(uDecorColor, min(dA, 1.0)), col);
        } else {
          vec4 aBack;
          vec4 aFront;
          auraLayers(p, sd, aa, aBack, aFront);
          col = over(col, aBack);
          col = over(aFront, col);
        }
        return col;
      }

      // ── Gravestone ─────────────────────────────────────────────────────────
      // A weathered granite headstone planted in a little mound of earth: grain
      // and speckle, a lit bevel (light from the upper left), a bronze-framed
      // portrait cameo, two engraved inscription grooves, moss creeping up from
      // the foot, grass blades in front of the plinth and a long soft shadow cast
      // across the ground. Tinted by a whisper of the person's colour.
      vec4 stoneNode(float sd, float aa) {
        vec2 p = vCorner;
        float seed = vSeed * 53.0;

        // ground: cast shadow, then the earth mound around the base
        vec2 sp = (p - vec2(0.46 * R, YB + 0.04 * R)) / vec2(1.05 * R, 0.13 * R);
        float castSh = (1.0 - smoothstep(0.25, 1.0, length(sp))) * uShadowStrength * 1.5;
        vec4 col = vec4(uShadowColor, castSh);
        vec2 mp = (p - vec2(0.0, YB + 0.03 * R)) / vec2(1.02 * R, 0.17 * R);
        float mound = 1.0 - smoothstep(0.82, 1.0, length(mp));
        vec3 soil = uSoilColor * (0.78 + 0.44 * iFbm(p * 16.0 + seed));
        col = over(vec4(soil, mound * 0.96), col);

        // stone body (edges chipped a touch by noise)
        float sdw = sd + (iNoise(p * 34.0 + seed) - 0.5) * 0.014 * R;
        float inside = 1.0 - smoothstep(-aa, aa, sdw);
        vec3 base = mix(uStoneColor, vFill, 0.16);
        float gran = iFbm(p * 19.0 + seed);
        float speck = step(0.86, iHash(floor(p * 95.0) + seed));
        vec3 stone = base * (0.84 + 0.26 * gran) + speck * 0.06;
        stone *= mix(1.12, 0.84, smoothstep(ST_TOP, YB, p.y)); // brighter crown
        // bevel from the SDF gradient: lit upper-left rim, shaded lower-right
        vec2 e = vec2(0.004, 0.0);
        vec2 n = normalize(vec2(sdStone(p + e.xy) - sdStone(p - e.xy),
                                sdStone(p + e.yx) - sdStone(p - e.yx)) + 1e-6);
        float bevel = 1.0 - smoothstep(0.0, 0.11 * R, -sd);
        stone *= 1.0 + bevel * dot(n, normalize(vec2(-0.6, -0.8))) * 0.34;

        // moss creeping up from the foot (amount varies per stone)
        float mossAmt = 0.2 + 0.8 * fract(vSeed * 7.31);
        float moss = smoothstep(0.52, 0.78, iFbm(p * 7.5 + seed * 1.7))
                   * smoothstep(YB - 1.0 * R, YB - 0.05 * R, p.y) * mossAmt;
        stone = mix(stone, uMossColor * (0.8 + 0.4 * gran), moss * 0.75);

        // portrait cameo in a bronze oval frame
        vec2 cc = vec2(0.0, ST_TOP + 0.66 * R);
        vec2 cr = vec2(0.40 * R, 0.48 * R);
        float co = (length((p - cc) / cr) - 1.0) * min(cr.x, cr.y);
        float frameW = 0.05 * R;
        float inCameo = 1.0 - smoothstep(-frameW - aa, -frameW + aa, co);
        float frame = (1.0 - smoothstep(frameW - aa, frameW + aa, abs(co + frameW * 0.2))) * (1.0 - inCameo);
        vec3 cameo = vFill;
        if (uHasAtlas == 1 && vAvatar >= 0.0) {
          vec2 uv = (p - cc) / (2.0 * cr.y) + 0.5;
          vec4 tex = texture(uAtlas, vec3(clamp(uv, 0.0, 1.0), vAvatar));
          if (vAvatar >= 0.5) {
            float L = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
            cameo = mix(tex.rgb, vec3(L) * vec3(1.08, 0.98, 0.84), 0.28); // aged print
          } else {
            cameo = mix(vFill, uSilhouetteColor, tex.a);
          }
        }
        stone = mix(stone, cameo, inCameo);
        vec3 bronze = uFrameColor * (0.85 + 0.3 * smoothstep(-0.5, 0.5, dot(n, vec2(-0.6, -0.8))));
        stone = mix(stone, bronze * (0.9 + 0.2 * iNoise(p * 60.0)), frame * 0.95);

        // two engraved inscription grooves (dark cut + light lower lip)
        float y1 = cc.y + cr.y + 0.30 * R;
        float y2 = y1 + 0.24 * R;
        float g1 = (1.0 - smoothstep(0.018 * R, 0.03 * R, abs(p.y - y1))) * step(abs(p.x), 0.46 * R);
        float g2 = (1.0 - smoothstep(0.018 * R, 0.03 * R, abs(p.y - y2))) * step(abs(p.x), 0.30 * R);
        float l1 = (1.0 - smoothstep(0.012 * R, 0.022 * R, abs(p.y - y1 - 0.04 * R))) * step(abs(p.x), 0.46 * R);
        float l2 = (1.0 - smoothstep(0.012 * R, 0.022 * R, abs(p.y - y2 - 0.04 * R))) * step(abs(p.x), 0.30 * R);
        stone *= 1.0 - 0.42 * max(g1, g2);
        stone *= 1.0 + 0.16 * max(l1, l2);

        col = over(vec4(stone, inside), col);

        // grass blades in front of the plinth
        float gx = p.x / R;
        float cell = floor(gx * 11.0 + seed);
        float hgt = (0.09 + 0.13 * iHash(vec2(cell, seed))) * R;
        float root = YB + 0.05 * R;
        float tt = clamp((root - p.y) / hgt, 0.0, 1.0);
        float lean = (iHash(vec2(cell, seed + 3.0)) - 0.5) * 0.35 * tt;
        float bx = abs(fract(gx * 11.0 + seed + lean) - 0.5);
        float bladeW = 0.32 * (1.0 - tt);
        float blade = (1.0 - smoothstep(bladeW - 0.08, bladeW, bx))
                    * step(p.y, root) * step(root - hgt, p.y)
                    * (1.0 - smoothstep(0.85, 1.05, abs(gx)));
        vec3 grass = uGrassColor * (0.75 + 0.5 * iHash(vec2(cell, 7.0)) + 0.25 * tt);
        col = over(vec4(grass, blade * 0.95), col);
        return col;
      }

      // ── Plate ──────────────────────────────────────────────────────────────
      // A polished slab pushed upright into the ground: its edge shows the
      // thickness, the face carries a soft sheen, a framed portrait window and
      // an engraved name band; at the foot a cut in the earth, a contact shadow,
      // a long cast shadow and a few blades of grass. Tinted by the person.
      vec4 plateNode(float sd, float aa) {
        vec2 p = vCorner;
        float seed = vSeed * 41.0;

        // ground: long cast shadow + tight contact shadow
        vec2 sp = (p - vec2(0.62 * R, YB + 0.03 * R)) / vec2(1.25 * R, 0.085 * R);
        float castSh = (1.0 - smoothstep(0.2, 1.0, length(sp))) * uShadowStrength * 1.35;
        vec4 col = vec4(uShadowColor, castSh);
        vec2 cp = (p - vec2(0.06 * R, YB + 0.02 * R)) / vec2(0.92 * R, 0.1 * R);
        col = over(vec4(uShadowColor, (1.0 - smoothstep(0.35, 1.0, length(cp))) * uShadowStrength * 1.6), col);
        // the cut in the earth the plate stands in: a dark slit with a lip of turned soil
        vec2 lp = (p - vec2(0.0, YB + 0.035 * R)) / vec2(0.86 * R, 0.07 * R);
        float lip = 1.0 - smoothstep(0.7, 1.0, length(lp));
        vec3 soil = uSoilColor * (0.75 + 0.5 * iFbm(p * 22.0 + seed));
        col = over(vec4(soil, lip * 0.92), col);

        vec3 base = mix(vFill, uStoneColor, 0.38);

        // the slab's thickness: an offset copy of the face — its TOP edge catches
        // the light from above, its SIDE falls into shade
        float sdBack = sdPlate(p - PL_DEPTH);
        float back = 1.0 - smoothstep(-aa, aa, sdBack);
        float topFace = 1.0 - smoothstep(PL_TOP - 0.01 * R, PL_TOP + 0.03 * R, p.y);
        vec3 edge = base * mix(0.5, 0.98, topFace) * (0.92 + 0.12 * iNoise(p * 40.0 + seed));
        col = over(vec4(edge, back), col);

        // the face
        float inside = 1.0 - smoothstep(-aa, aa, sd);
        vec3 face = base * mix(1.12, 0.86, smoothstep(PL_TOP, YB, p.y)); // lit from above
        face *= 0.95 + 0.07 * iFbm(p * 26.0 + seed); // faint grain
        // bevel: a bright rim on the upper-left edges, a dark one lower-right
        vec2 e = vec2(0.004, 0.0);
        vec2 n = normalize(vec2(sdPlate(p + e.xy) - sdPlate(p - e.xy),
                                sdPlate(p + e.yx) - sdPlate(p - e.yx)) + 1e-6);
        float rim = 1.0 - smoothstep(0.0, 0.07 * R, -sd);
        face *= 1.0 + rim * dot(n, normalize(vec2(-0.6, -0.8))) * 0.45;
        // a diagonal sheen sliding across the polish
        float band = (p.x * 0.8 + p.y * 0.6) / R - (fract(vSeed * 3.7) - 0.5) * 1.2 + 0.4;
        face += vec3(1.0) * exp(-band * band * 9.0) * 0.12;

        // portrait window (rounded, framed)
        vec2 wc = vec2(0.0, PL_TOP + 0.62 * R);
        vec2 wh = vec2(0.5 * R, 0.46 * R);
        float sw = sdBox(p - wc, wh, 0.08 * R);
        float inWin = 1.0 - smoothstep(-aa, aa, sw);
        float frame = (1.0 - smoothstep(0.03 * R - aa, 0.03 * R + aa, abs(sw)));
        vec3 photo = vFill;
        if (uHasAtlas == 1 && vAvatar >= 0.0) {
          vec2 uv = (p - wc) / (2.0 * wh.y) + 0.5;
          vec4 tex = texture(uAtlas, vec3(clamp(uv, 0.0, 1.0), vAvatar));
          photo = vAvatar >= 0.5 ? tex.rgb : mix(vFill, uSilhouetteColor, tex.a);
        }
        // glass over the photo: a soft highlight on the upper half
        photo += vec3(1.0) * 0.06 * (1.0 - smoothstep(wc.y - wh.y, wc.y, p.y));
        face = mix(face, photo, inWin);
        face = mix(face, uFrameColor * (0.85 + 0.3 * smoothstep(-0.5, 0.5, -n.y)), frame * 0.95);

        // engraved name band below the window: a recessed strip with one cut line
        vec2 bc = vec2(0.0, wc.y + wh.y + 0.32 * R);
        float sb = sdBox(p - bc, vec2(0.48 * R, 0.13 * R), 0.04 * R);
        float inBand = 1.0 - smoothstep(-aa, aa, sb);
        face = mix(face, face * 0.84, inBand);
        float topShade = (1.0 - smoothstep(0.0, 0.03 * R, abs(p.y - (bc.y - 0.13 * R)))) * inBand;
        face *= 1.0 - 0.25 * topShade; // the band's upper lip throws a hairline shadow
        float cut = (1.0 - smoothstep(0.012 * R, 0.024 * R, abs(p.y - bc.y))) * step(abs(p.x), 0.32 * R);
        face *= 1.0 - 0.4 * cut;

        col = over(vec4(face, inside), col);

        // a few blades of grass at the foot, in front of the slab
        float gx = p.x / R;
        float cell = floor(gx * 9.0 + seed);
        float keep = step(0.45, iHash(vec2(cell, seed + 1.0))); // sparse tufts
        float hgt = (0.07 + 0.11 * iHash(vec2(cell, seed))) * R;
        float root = YB + 0.05 * R;
        float tt = clamp((root - p.y) / hgt, 0.0, 1.0);
        float lean = (iHash(vec2(cell, seed + 3.0)) - 0.5) * 0.3 * tt;
        float bx = abs(fract(gx * 9.0 + seed + lean) - 0.5);
        float blade = (1.0 - smoothstep(0.3 * (1.0 - tt) - 0.08, 0.3 * (1.0 - tt), bx))
                    * step(p.y, root) * step(root - hgt, p.y) * keep
                    * (1.0 - smoothstep(0.8, 1.0, abs(gx)));
        col = over(vec4(uGrassColor * (0.8 + 0.4 * tt), blade * 0.9), col);
        return col;
      }

      // ── Flat plate ─────────────────────────────────────────────────────────
      // Deliberately plain: a flat slab in the person's colour, the portrait in a
      // circle with a light ring, and a thin flat ground line it stands on. No
      // gradients, sheen, texture or soft shadows.
      vec4 flatPlateNode(float sd, float aa) {
        vec2 p = vCorner;
        float ground = 1.0 - smoothstep(-aa, aa,
          sdBox(p - vec2(0.0, YB + 0.035 * R), vec2(0.86 * R, 0.028 * R), 0.028 * R));
        vec4 col = vec4(uShadowColor, ground * uShadowStrength * 0.9);
        float inside = 1.0 - smoothstep(-aa, aa, sd);
        vec3 face = vFill;
        vec2 cc = vec2(0.0, FP_TOP + 0.66 * R);
        float d = length(p - cc);
        float ring = 1.0 - smoothstep(0.5 * R - aa, 0.5 * R + aa, d);
        float disc = 1.0 - smoothstep(0.43 * R - aa, 0.43 * R + aa, d);
        face = mix(face, mix(vFill, vec3(1.0), 0.82), ring);
        vec3 photo = vFill * 0.82;
        if (uHasAtlas == 1 && vAvatar >= 0.0) {
          vec2 uv = (p - cc) / (0.86 * R) + 0.5;
          vec4 tex = texture(uAtlas, vec3(clamp(uv, 0.0, 1.0), vAvatar));
          photo = vAvatar >= 0.5 ? tex.rgb : mix(vFill * 0.82, uSilhouetteColor, tex.a);
        }
        face = mix(face, photo, disc);
        return over(vec4(face, inside), col);
      }

      // ── Star (constellation skin) ──────────────────────────────────────────
      // A white-hot core in a soft bloom with four diffraction spikes, tinted
      // by the person's colour. vStar.x = magnitude (descendants, log scale):
      // brighter stars get a bigger core, wider bloom and longer spikes.
      // Departed people twinkle faintly (vStar.y) off the decor clock — still
      // when it's frozen (performance mode, reduced motion, still captures).
      // The portrait surfaces in the core only on hover / selection. On light
      // grounds (uStarLight) it becomes a printed star atlas instead: an ink
      // dot sized by magnitude, hairline spikes, and a ring round a departed
      // person (the atlas mark for a variable star).
      vec4 starNode(float sd, float aa) {
        vec2 p = vCorner;
        vec2 q = p / R; // R units — the quad edge is at 1.6
        float r = length(q);
        float k = clamp(vStar.x, 0.0, 1.0);
        float aaq = aa / R;
        float edge = 1.0 - smoothstep(1.3, 1.6, max(abs(q.x), abs(q.y)));
        vec4 col;
        if (uStarLight > 0.5) {
          vec3 ink = mix(vec3(0.08, 0.11, 0.21), vFill * 0.55, 0.3);
          float dr = 0.16 + 0.24 * k;
          float disc = 1.0 - smoothstep(dr - aaq, dr + aaq, r);
          float sw = max(0.012, aaq * 0.7);
          float L = 0.42 + 0.75 * k;
          float spk = (1.0 - smoothstep(sw, sw + aaq, abs(q.y))) * (1.0 - smoothstep(dr, L, abs(q.x)))
                    + (1.0 - smoothstep(sw, sw + aaq, abs(q.x))) * (1.0 - smoothstep(dr, L, abs(q.y)));
          spk *= smoothstep(0.22, 0.6, k) * 0.85;
          float halo = exp(-r * 6.0) * 0.14;
          float ring = vStar.y > 0.5
            ? (1.0 - smoothstep(0.02, 0.02 + aaq, abs(r - dr - 0.16))) * 0.75 : 0.0;
          col = vec4(ink, clamp(disc + spk + halo + ring, 0.0, 1.0) * edge);
        } else {
          float on = vStar.y * step(0.0001, uDecorTime);
          float ph = uDecorTime * (1.3 + 2.1 * fract(vSeed * 13.7)) + vSeed * 40.0;
          float scint = 0.5 + 0.5 * sin(ph) * cos(ph * 0.61 + 1.3);
          float tw = 1.0 - on * 0.5 * scint;
          vec3 c = vFill / max(max(vFill.r, vFill.g), max(vFill.b, 0.05));
          vec3 tint = mix(vec3(1.0), clamp(c, 0.0, 1.0), 0.55);
          float coreR = 0.13 + 0.12 * k;
          float core = exp(-(r * r) / (coreR * coreR) * 1.3);
          float disk = 1.0 - smoothstep(coreR * 1.15, coreR * 2.0, r);
          float halo = exp(-r * (3.6 - 1.5 * k)) * (0.42 + 0.4 * k);
          float wq = max(0.02 + 0.016 * k, aaq * 0.9);
          float L = 0.95 + 0.6 * k;
          float spk = exp(-abs(q.y) / wq) * pow(max(0.0, 1.0 - abs(q.x) / L), 1.4)
                    + exp(-abs(q.x) / wq) * pow(max(0.0, 1.0 - abs(q.y) / L), 1.4);
          // Faint secondary spikes on the diagonals for the brightest stars.
          vec2 d = vec2(q.x + q.y, q.x - q.y) * 0.70710678;
          float L2 = L * 0.5;
          float spk2 = exp(-abs(d.y) / wq) * pow(max(0.0, 1.0 - abs(d.x) / L2), 2.4)
                     + exp(-abs(d.x) / wq) * pow(max(0.0, 1.0 - abs(d.y) / L2), 2.4);
          spk = spk * (0.55 + 0.45 * k) + spk2 * smoothstep(0.4, 1.0, k) * 0.4;
          float glow = (halo + spk * 1.25) * tw * edge;
          float hot = clamp(core + disk * 0.55, 0.0, 1.0) * (0.82 + 0.18 * tw);
          float a = clamp(glow + hot, 0.0, 1.0);
          vec3 rgb = (tint * glow + mix(tint, vec3(1.0), 0.85) * hot) / max(glow + hot, 1e-3);
          col = vec4(min(rgb, vec3(1.0)), clamp(a * (0.72 + 0.28 * k) + 0.28 * (1.0 - k) * hot, 0.0, 1.0));
        }
        // The portrait surfaces in the core on hover / selection only.
        float face = max(vSelected, vGlow);
        if (uHasAtlas == 1 && vAvatar >= 0.5 && face > 0.01) {
          float pr = 0.46 * R;
          float dp = length(p) - pr;
          float inPh = 1.0 - smoothstep(-aa, aa, dp);
          vec2 uv = p * (0.5 / pr) + 0.5;
          vec4 tex = texture(uAtlas, vec3(clamp(uv, 0.0, 1.0), vAvatar));
          float rim = 1.0 - smoothstep(0.02 * R, 0.02 * R + aa, abs(dp));
          col = over(vec4(tex.rgb, inPh * face), col);
          col = over(vec4(mix(vFill, vec3(1.0), 0.6), rim * face * 0.9), col);
        }
        // Lens / highlight colours ring the star like a chart's circled mark.
        if (vBorderA > 0.5) {
          float bw = max(vBorderNorm * 0.6, aa);
          float rr = length(p) - 0.74 * R;
          float ring = 1.0 - smoothstep(bw, bw + aa, abs(rr));
          col = over(vec4(vBorder, ring * vBorderA), col);
        }
        return col;
      }

      void main() {
        float ext;
        float sd = shapeSD(vCorner, ext);
        float aa = fwidth(sd) * 1.5 + 0.0012;

        // Rim-only (iAvatar -2): just the aura, no body, for pins whose body is
        // painted elsewhere (the ink timeline's seals live on the 2D canvas above).
        if (vAvatar < -1.5) {
          vec4 rBack;
          vec4 rFront;
          auraLayers(vCorner, sd, aa, rBack, rFront);
          vec4 rc = over(rFront, rBack);
          rc.a *= vOpacity;
          if (rc.a < 0.002) discard;
          fragColor = rc;
          return;
        }

        // Gravestones keep their carved look in the ink theme too (re-tinted to
        // ink-and-paper tones by NodeLayer.setInkUniforms) — an ensō hooked round
        // a tall stone reads as a stray brush mark.
        if (uInk > 0.5 && !standingShape()) {
          vec4 ic = inkNode(sd, ext);
          ic.a *= vOpacity * (1.0 - uFog * 0.45 * smoothstep(1.0, 2.4, vDepth));
          if (ic.a < 0.002) discard;
          fragColor = ic;
          return;
        }

        vec4 col;
        float inside = 1.0 - smoothstep(-aa, aa, sd);
        if (int(uShape + 0.5) == 8) {
          col = stoneNode(sd, aa);
        } else if (int(uShape + 0.5) == 9) {
          col = plateNode(sd, aa);
        } else if (int(uShape + 0.5) == 10) {
          col = flatPlateNode(sd, aa);
        } else if (int(uShape + 0.5) == 11) {
          col = starNode(sd, aa);
        } else {
          // ---- drop shadow (offset soft shape, behind everything) ----
          float extS;
          float sds = shapeSD(vCorner - uShadowOffset, extS);
          float shadowMask = 1.0 - smoothstep(-0.20 * R, 0.16 * R, sds);
          col = vec4(uShadowColor, shadowMask * uShadowStrength);

          // ---- fill / avatar (inside the shape) ----
          vec3 bodyRGB = vFill;
          if (uHasAtlas == 1 && vAvatar >= 0.0) {
            vec2 uv = vCorner * (0.5 / (R * ext)) + 0.5; // shape bbox -> [0,1]
            vec4 tex = texture(uAtlas, vec3(clamp(uv, 0.0, 1.0), vAvatar));
            if (vAvatar >= 0.5) {
              bodyRGB = tex.rgb;                       // photo (layers >= 1)
            } else {
              bodyRGB = mix(vFill, uSilhouetteColor, tex.a); // silhouette glyph over fill (layer 0)
            }
          }
          col = over(vec4(bodyRGB, inside), col);
        }

        // ---- border ring (centred on the shape edge; stars ring themselves) ----
        if (int(uShape + 0.5) != 11) {
          float bw = max(vBorderNorm, aa);
          float ring = (1.0 - smoothstep(bw, bw + aa, abs(sd)));
          col = over(vec4(vBorder, ring * vBorderA), col);
        }

        // ---- decor ornament (outside the rim, never over the face); an aura's
        //      own ornament replaces it on that person, back + front layers ----
        if (vAura.x < 0.5) {
          float dA = decorAlpha(vCorner, sd, aa);
          if (dA > 0.002) col = over(vec4(uDecorColor, min(dA, 1.0)), col);
        } else {
          vec4 aBack;
          vec4 aFront;
          auraLayers(vCorner, sd, aa, aBack, aFront);
          col = over(col, aBack);
          col = over(aFront, col);
        }

        // ---- focus haze (selection + hover) ----
        // No rings, no accents: a soft frosted haze radiating from the rim.
        // uGlowColor is theme-set (white on dark, deep slate on light). Selection
        // breathes gently — a slow, subtle swell — hover is a fainter still haze.
        float focus = max(vSelected, vGlow);
        if (focus > 0.001) {
          float breathe = vSelected > 0.5 ? (0.88 + 0.12 * sin(uTime * 2.0)) : 1.0;
          float span = 0.66 * R;
          float tt = clamp((sd + 0.1 * R) / span, 0.0, 1.0);
          float haze = (1.0 - tt) * (1.0 - tt); // quadratic falloff — soft, no hard edge
          float strength = vSelected > 0.5 ? 0.55 * breathe : 0.3;
          float hazeA = haze * (1.0 - inside) * focus * strength;
          col = over(col, vec4(uGlowColor, hazeA)); // haze sits BEHIND the shadow/disc
          col = over(vec4(uGlowColor, hazeA * 0.35), col); // faint veil on top ties it together
        }

        // ---- tilt depth haze: far nodes recede ----
        col.a *= 1.0 - uFog * 0.45 * smoothstep(1.0, 2.4, vDepth);

        col.a *= vOpacity;
        if (col.a < 0.002) discard;
        fragColor = col;
      }
    `
  })
}
