import * as THREE from 'three'

// Half-extent of each node quad, in units of the node radius. The circle (radius r)
// sits at corner-distance 1/QUAD_SCALE; the surrounding margin holds the drop shadow,
// selection ring and glow.
export const QUAD_SCALE = 1.6

// One instanced ShaderMaterial draws every node in a single draw call. Per-instance
// attributes carry position/size/colour/state; the fragment shader reproduces the SVG
// look: circular avatar (or gender-coloured fill + silhouette), border ring, offset soft
// drop shadow, selection ring and hover/select glow. WebGL2 sampler2DArray holds avatars.
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
      // Theme-dependent shadow (dark: tighter/darker, light: softer/lighter).
      uShadowColor: { value: new THREE.Color(0x000000) },
      uShadowStrength: { value: 0.35 },
      uShadowOffset: { value: new THREE.Vector2(0.09, 0.135) }, // corner units (dx2,dy3 @ r22)
      uGlowColor: { value: new THREE.Color(0x6c8ef5) },
      uSilhouetteColor: { value: new THREE.Color(1, 1, 1) },
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

      in vec2 vCorner;
      in vec3 vFill;
      in vec3 vBorder;
      in float vBorderNorm;
      in float vBorderA;
      in float vOpacity;
      in float vSelected;
      in float vGlow;
      in float vAvatar;

      out vec4 fragColor;

      const float R = 1.0 / ${QUAD_SCALE.toFixed(4)}; // circle edge in corner units

      // Porter-Duff "over": src on top of dst.
      vec4 over(vec4 src, vec4 dst) {
        float a = src.a + dst.a * (1.0 - src.a);
        if (a <= 0.0001) return vec4(0.0);
        vec3 rgb = (src.rgb * src.a + dst.rgb * dst.a * (1.0 - src.a)) / a;
        return vec4(rgb, a);
      }

      void main() {
        float d = length(vCorner);
        float aa = fwidth(d) * 1.2 + 0.0008;

        // ---- drop shadow (offset soft disc, behind everything) ----
        float ds = length(vCorner - uShadowOffset);
        float shadowMask = 1.0 - smoothstep(R * 0.72, R * 1.18, ds);
        vec4 col = vec4(uShadowColor, shadowMask * uShadowStrength);

        // ---- fill / avatar (inside the circle) ----
        float inside = 1.0 - smoothstep(R - aa, R + aa, d);
        vec3 bodyRGB = vFill;
        if (uHasAtlas == 1 && vAvatar >= 0.0) {
          vec2 uv = vCorner * (0.5 / R) + 0.5; // circle bbox -> [0,1]
          vec4 tex = texture(uAtlas, vec3(uv, vAvatar));
          if (vAvatar >= 0.5) {
            bodyRGB = tex.rgb;                       // photo (layers >= 1)
          } else {
            bodyRGB = mix(vFill, uSilhouetteColor, tex.a); // silhouette glyph over fill (layer 0)
          }
        }
        col = over(vec4(bodyRGB, inside), col);

        // ---- border ring (centred on the circle edge) ----
        float bw = max(vBorderNorm, aa);
        float ring = (1.0 - smoothstep(bw, bw + aa, abs(d - R)));
        col = over(vec4(vBorder, ring * vBorderA), col);

        // ---- selection ring (just outside the border, accent colour) ----
        if (vSelected > 0.5) {
          float selW = 3.0 / ${QUAD_SCALE.toFixed(4)} * 0.045 + aa; // ~3px accent ring
          float srEdge = R + bw + selW;
          float sel = (1.0 - smoothstep(selW, selW + aa, abs(d - (R + bw + selW))));
          col = over(vec4(uGlowColor, sel * 0.95), col);
        }

        // ---- glow (additive soft halo outside the circle) ----
        if (vGlow > 0.001) {
          float halo = smoothstep(R * 1.5, R, d) * (1.0 - inside);
          col.rgb += uGlowColor * halo * vGlow * 0.6;
          col.a = max(col.a, halo * vGlow * 0.5);
        }

        col.a *= vOpacity;
        if (col.a < 0.002) discard;
        fragColor = col;
      }
    `,
  })
}
