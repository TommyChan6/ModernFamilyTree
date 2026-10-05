import * as THREE from 'three'
import { INK_NOISE } from './inkGlsl.js'

// 水墨 — a full-screen veil of drifting mist (留白: the empty paper breathing
// between the brushwork). Wisps of paper-coloured fog, stretched sideways,
// drift very slowly on the uTime clock and parallax with the camera pan; an
// optional bank of denser mist rises from the bottom edge (over the timeline's
// mountains). One quad, drawn in clip space, independent of the scene camera.
export class InkMistLayer {
  constructor({ renderOrder = 0 } = {}) {
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3)
    )
    g.setIndex([0, 1, 2, 2, 1, 3])
    this.geometry = g
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uMotion: { value: 1 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uDpr: { value: 1 },
        uOffset: { value: new THREE.Vector2(0, 0) },
        uScale: { value: 1 },
        uColor: { value: new THREE.Vector3(0.965, 0.941, 0.886) }, // raw sRGB
        uStrength: { value: 0.22 },
        uBottom: { value: 0 }
      },
      vertexShader: /* glsl */ `
        void main() {
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uTime;
        uniform float uMotion;
        uniform vec2 uRes;
        uniform float uDpr;
        uniform vec2 uOffset;
        uniform float uScale;
        uniform vec3 uColor;
        uniform float uStrength;
        uniform float uBottom;
        out vec4 fragColor;
        ${INK_NOISE}

        void main() {
          vec2 frag = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;
          vec2 p = (frag - uOffset) / (460.0 * uScale);
          p.x *= 0.5;
          float t = uTime * uMotion;
          float n = inkFbm(p + vec2(t * 0.016, t * 0.003));
          float n2 = inkFbm(p * 2.1 - vec2(t * 0.01, 0.0) + vec2(7.3, 2.1));
          float wisp = smoothstep(0.44, 0.8, n * 0.62 + n2 * 0.38);
          float y = frag.y / max(uRes.y, 1.0);
          float bank = uBottom * smoothstep(0.62, 1.0, y) * (0.45 + 0.55 * n2);
          float a = uStrength * wisp + bank;
          if (a < 0.003) discard;
          fragColor = vec4(uColor, min(a, 0.92));
        }
      `
    })
    this.mesh = new THREE.Mesh(g, this.material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = renderOrder
    this.mesh.visible = false
  }

  get object3d() {
    return this.mesh
  }

  setVisible(on) {
    this.mesh.visible = !!on
  }

  setSize(w, h, dpr) {
    this.material.uniforms.uRes.value.set(w, h)
    this.material.uniforms.uDpr.value = dpr
  }

  /** Screen-px pan offset (already multiplied by the caller's parallax) + zoom. */
  setView(ox, oy, scale = 1) {
    this.material.uniforms.uOffset.value.set(ox, oy)
    this.material.uniforms.uScale.value = scale
  }

  setLook({ color, strength, bottom } = {}) {
    const u = this.material.uniforms
    if (color) u.uColor.value.set(color[0], color[1], color[2]) // sRGB 0..1 triple
    if (strength != null) u.uStrength.value = strength
    if (bottom != null) u.uBottom.value = bottom
  }

  setMotion(k) {
    this.material.uniforms.uMotion.value = k
  }

  setTime(t) {
    this.material.uniforms.uTime.value = t
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
  }
}
