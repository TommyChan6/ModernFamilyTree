import * as THREE from 'three'

// Instanced, camera-facing avatar discs for the Space (3D) graph type — the same
// visual identity as the 2D NodeMaterial (circular photo / silhouette, border
// ring, selection ring, hover glow) billboarded in a perspective scene, with a
// depth-fog mix so distance reads at a glance.
//
// The renderer writes every instance each frame in back-to-front order (the
// caller passes a sorted slot), so translucency (search-dimmed nodes, glow
// halos) composites correctly with depth writes on.

export const QUAD_SCALE = 1.6

export function createNode3DMaterial({ atlasTexture }) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthTest: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    uniforms: {
      uAtlas: { value: atlasTexture },
      uHasAtlas: { value: atlasTexture ? 1 : 0 },
      uFogColor: { value: new THREE.Color(0x0f1117) },
      uFogRange: { value: new THREE.Vector2(1200, 5200) }, // view-space near/far
      uGlowColor: { value: new THREE.Color(0x6c8ef5) },
      uSilhouetteColor: { value: new THREE.Color(1, 1, 1) }
    },
    vertexShader: /* glsl */ `
      in vec3 iPos;
      in float iRadius;
      in vec3 iFill;
      in vec3 iBorder;
      in float iBorderPx;
      in float iBorderA;
      in float iOpacity;
      in float iSelected;
      in float iGlow;
      in float iAvatar;

      out vec2 vCorner;
      out vec3 vFill;
      out vec3 vBorder;
      out float vBorderNorm;
      out float vBorderA;
      out float vOpacity;
      out float vSelected;
      out float vGlow;
      out float vAvatar;
      out float vFog;

      uniform vec2 uFogRange;

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
        // Billboard: offset the unit-quad corner in view space so the disc
        // always faces the camera at a constant world size.
        vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
        mv.xy += position.xy * (iRadius * ${QUAD_SCALE.toFixed(4)});
        vFog = clamp((-mv.z - uFogRange.x) / max(uFogRange.y - uFogRange.x, 1.0), 0.0, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      precision highp sampler2DArray;

      uniform sampler2DArray uAtlas;
      uniform int uHasAtlas;
      uniform vec3 uFogColor;
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
      in float vFog;

      out vec4 fragColor;

      const float R = 1.0 / ${QUAD_SCALE.toFixed(4)};

      vec4 over(vec4 src, vec4 dst) {
        float a = src.a + dst.a * (1.0 - src.a);
        if (a <= 0.0001) return vec4(0.0);
        vec3 rgb = (src.rgb * src.a + dst.rgb * dst.a * (1.0 - src.a)) / a;
        return vec4(rgb, a);
      }

      void main() {
        float d = length(vCorner);
        float aa = fwidth(d) * 1.2 + 0.0008;

        // ---- fill / avatar ----
        float inside = 1.0 - smoothstep(R - aa, R + aa, d);
        vec3 bodyRGB = vFill;
        if (uHasAtlas == 1 && vAvatar >= 0.0) {
          vec2 uv = vCorner * (0.5 / R) + 0.5;
          vec4 tex = texture(uAtlas, vec3(uv, vAvatar));
          if (vAvatar >= 0.5) {
            bodyRGB = tex.rgb;
          } else {
            bodyRGB = mix(vFill, uSilhouetteColor, tex.a);
          }
        }
        vec4 col = vec4(bodyRGB, inside);

        // ---- border ring ----
        float bw = max(vBorderNorm, aa);
        float ring = (1.0 - smoothstep(bw, bw + aa, abs(d - R)));
        col = over(vec4(vBorder, ring * vBorderA), col);

        // ---- selection ring ----
        if (vSelected > 0.5) {
          float selW = 3.0 / ${QUAD_SCALE.toFixed(4)} * 0.045 + aa;
          float sel = (1.0 - smoothstep(selW, selW + aa, abs(d - (R + bw + selW))));
          col = over(vec4(uGlowColor, sel * 0.95), col);
        }

        // ---- hover/select glow halo ----
        if (vGlow > 0.001) {
          float halo = smoothstep(R * 1.5, R, d) * (1.0 - inside);
          col.rgb += uGlowColor * halo * vGlow * 0.6;
          col.a = max(col.a, halo * vGlow * 0.5);
        }

        // ---- depth fog: recede into the scene colour ----
        col.rgb = mix(col.rgb, uFogColor, vFog * 0.8);
        col.a *= vOpacity * (1.0 - vFog * 0.55);
        if (col.a < 0.004) discard;
        fragColor = col;
      }
    `
  })
}

export class Node3DLayer {
  constructor({ atlasTexture }) {
    this.capacity = 0
    this.count = 0
    this.material = createNode3DMaterial({ atlasTexture })
    this.geometry = null
    this.mesh = new THREE.Mesh()
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 3
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
    this.pos = mk('iPos', 3)
    this.radius = mk('iRadius', 1)
    this.fill = mk('iFill', 3)
    this.border = mk('iBorder', 3)
    this.borderPx = mk('iBorderPx', 1)
    this.borderA = mk('iBorderA', 1)
    this.opacity = mk('iOpacity', 1)
    this.selected = mk('iSelected', 1)
    this.glow = mk('iGlow', 1)
    this.avatar = mk('iAvatar', 1)

    g.instanceCount = this.count
    this.geometry = g
    this.mesh.geometry = g
    this.mesh.material = this.material
    this.capacity = capacity
  }

  setCount(n) {
    if (n > this.capacity) this._allocate(Math.ceil(n * 1.3) + 16)
    this.count = n
    if (this.geometry) this.geometry.instanceCount = n
  }

  // Write ONE instance slot (position + style together — the renderer feeds
  // slots in back-to-front order every frame, so nothing persists per slot).
  write(slot, x, y, z, s) {
    this.pos[slot * 3] = x
    this.pos[slot * 3 + 1] = y
    this.pos[slot * 3 + 2] = z
    this.radius[slot] = s.radius
    this.fill[slot * 3] = s.fill[0]
    this.fill[slot * 3 + 1] = s.fill[1]
    this.fill[slot * 3 + 2] = s.fill[2]
    this.border[slot * 3] = s.border[0]
    this.border[slot * 3 + 1] = s.border[1]
    this.border[slot * 3 + 2] = s.border[2]
    this.borderPx[slot] = s.borderPx
    this.borderA[slot] = s.borderA == null ? 1 : s.borderA
    this.opacity[slot] = s.opacity
    this.selected[slot] = s.selected ? 1 : 0
    this.glow[slot] = s.glow || 0
    this.avatar[slot] = s.avatar
  }

  commit() {
    if (!this._attr.iPos) return
    for (const k of Object.keys(this._attr)) this._attr[k].needsUpdate = true
  }

  setFog(colorHex, near, far) {
    this.material.uniforms.uFogColor.value.set(colorHex)
    this.material.uniforms.uFogRange.value.set(near, far)
  }

  dispose() {
    this.geometry?.dispose()
    this.material?.dispose()
  }
}
