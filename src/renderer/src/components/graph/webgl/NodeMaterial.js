import * as THREE from 'three'

// Half-extent of each node quad, in units of the node radius. The shape (radius r)
// sits at corner-distance 1/QUAD_SCALE; the surrounding margin holds the drop shadow,
// selection ring, glow and decor ornaments.
export const QUAD_SCALE = 1.6

// Shape ids consumed by the fragment shader's SDF switch (uShape).
export const NODE_SHAPES = [
  'circle',
  'square',
  'diamond',
  'hexagon',
  'shield',
  'oval',
  'octagon',
  'heart'
]
export function nodeShapeId(name) {
  const i = NODE_SHAPES.indexOf(name)
  return i < 0 ? 0 : i
}

// Decor ids (uDecor): procedural ornaments drawn around the shape rim.
export const NODE_DECORS = ['none', 'aura', 'runes', 'orbit', 'burst', 'pulse']
export function nodeDecorId(name) {
  const i = NODE_DECORS.indexOf(name)
  return i < 0 ? 0 : i
}

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
      uSilhouetteColor: { value: new THREE.Color(1, 1, 1) }
    },
    vertexShader: /* glsl */ `
      // Three injects: in vec3 position; (the quad corner in [-1,1]) + matrices.
      in vec2 iPos;
      in float iRadius;
      in vec3 iFill;
      in vec3 iBorder;
      in float iBorderPx;   // border stroke width in world px
      in float iOpacity;
      in float iBorderA;    // border alpha (faint 0.18 default, ~1 selected)
      in float iSelected;   // 0/1
      in float iGlow;       // 0..1 hover/select glow amount
      in float iAvatar;     // atlas layer index, or -1

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

      void main() {
        vCorner = position.xy;
        vFill = iFill;
        vBorder = iBorder;
        vBorderNorm = (iBorderPx / max(iRadius, 0.001)) / ${QUAD_SCALE.toFixed(4)};
        vBorderA = iBorderA;
        vOpacity = iOpacity;
        vSelected = iSelected;
        vGlow = iGlow;
        vAvatar = iAvatar;
        vSeed = fract(float(gl_InstanceID) * 0.61803398875);
        vec2 world = iPos + position.xy * (iRadius * ${QUAD_SCALE.toFixed(4)});
        gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 0.0, 1.0);
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

      out vec4 fragColor;

      const float R = 1.0 / ${QUAD_SCALE.toFixed(4)}; // shape edge in corner units
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
        return length(p) - R;
      }

      // ── Decor ornaments (drawn outside the rim, tinted uDecorColor) ────────
      // Returns premultiplied-ish alpha for the ornament at this fragment.
      float decorAlpha(vec2 p, float sd, float aa) {
        int m = int(uDecor + 0.5);
        if (m == 0) return 0.0;
        float ang = atan(p.y, p.x);
        float t = uDecorTime;
        float outside = smoothstep(0.0, aa * 2.0, sd); // never over the avatar
        if (m == 1) {
          // Gilded aura: a paired ring, shimmering slowly around the rim.
          float ring1 = 1.0 - smoothstep(0.016, 0.016 + aa, abs(sd - 0.10 * R));
          float ring2 = 1.0 - smoothstep(0.010, 0.010 + aa, abs(sd - 0.20 * R));
          float shimmer = 0.82 + 0.18 * sin(ang * 3.0 - t * 0.9 + vSeed * 6.2832);
          return (ring1 * 0.95 + ring2 * 0.55) * shimmer * outside;
        }
        if (m == 2) {
          // Runic ring: dashed sigils slowly revolving.
          float band = 1.0 - smoothstep(0.030, 0.030 + aa, abs(sd - 0.15 * R));
          float seg = fract(ang / (2.0 * PI) * 12.0 + t * 0.16 + vSeed);
          float dash = smoothstep(0.12, 0.24, seg) * (1.0 - smoothstep(0.58, 0.72, seg));
          return band * dash * 0.95 * outside;
        }
        if (m == 3) {
          // Orbiting spark + comet trail on a circular track around the shape.
          float circ = length(p) - 1.24 * R;
          float track = 1.0 - smoothstep(0.008, 0.008 + aa, abs(circ));
          float theta = t * 1.5 + vSeed * 6.2832;
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
          float spikes = pow(max(0.0, cos(ang * 8.0 + t * 0.35 + vSeed * 6.2832)), 3.0);
          float f = sd - 0.05 * R - spikes * 0.17 * R;
          float body = (1.0 - smoothstep(-0.02, aa * 3.0, f)) * outside;
          return body * (0.45 + 0.45 * spikes);
        }
        if (m == 5) {
          // Echo pulse: expanding rings that fade as they travel.
          float a = 0.0;
          for (int k = 0; k < 2; k++) {
            float ph = fract(t * 0.42 + float(k) * 0.5 + vSeed * 0.31);
            float rad = ph * 0.40 * R + 0.04 * R;
            float w = 0.012 + ph * 0.02;
            float ring = 1.0 - smoothstep(w, w + aa, abs(sd - rad));
            a += ring * (1.0 - ph) * (1.0 - ph);
          }
          return a * 0.9 * outside;
        }
        return 0.0;
      }

      void main() {
        float ext;
        float sd = shapeSD(vCorner, ext);
        float aa = fwidth(sd) * 1.5 + 0.0012;

        // ---- drop shadow (offset soft shape, behind everything) ----
        float extS;
        float sds = shapeSD(vCorner - uShadowOffset, extS);
        float shadowMask = 1.0 - smoothstep(-0.20 * R, 0.16 * R, sds);
        vec4 col = vec4(uShadowColor, shadowMask * uShadowStrength);

        // ---- fill / avatar (inside the shape) ----
        float inside = 1.0 - smoothstep(-aa, aa, sd);
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

        // ---- border ring (centred on the shape edge) ----
        float bw = max(vBorderNorm, aa);
        float ring = (1.0 - smoothstep(bw, bw + aa, abs(sd)));
        col = over(vec4(vBorder, ring * vBorderA), col);

        // ---- decor ornament (outside the rim, never over the face) ----
        float dA = decorAlpha(vCorner, sd, aa);
        if (dA > 0.002) col = over(vec4(uDecorColor, min(dA, 1.0)), col);

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

        col.a *= vOpacity;
        if (col.a < 0.002) discard;
        fragColor = col;
      }
    `
  })
}
