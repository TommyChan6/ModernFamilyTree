import * as THREE from 'three'

// The ground plane under the perspective tilt: a faint world-space grid that
// fades in with the tilt so the board reads as a floor receding to the horizon.
// One quad in the world group (so it shares the tilt projection), sized each
// frame to cover the view; lines are drawn analytically in the fragment shader
// with fwidth anti-aliasing (they thin out instead of shimmering near the
// horizon) and a radial falloff so the floor has no hard edge. Invisible — and
// skipped entirely — while the view is flat.
export class GroundGrid {
  constructor() {
    const g = new THREE.BufferGeometry()
    this._pos = new Float32Array(12)
    g.setAttribute('position', new THREE.BufferAttribute(this._pos, 3))
    g.setIndex([0, 1, 2, 2, 1, 3])
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uAmount: { value: 0 }, // 0 flat … 1 fully tilted
        uColor: { value: new THREE.Color(1, 1, 1) },
        uAlpha: { value: 0.07 },
        uStep: { value: 120 }, // world units between minor lines
        uCenter: { value: new THREE.Vector2(0, 0) }, // world point at the view centre
        uFadeR: { value: 2000 } // world radius of the floor's falloff
      },
      vertexShader: /* glsl */ `
        out vec2 vWorld;
        out float vDepth;
        void main() {
          vWorld = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          vDepth = gl_Position.w;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uAmount;
        uniform vec3 uColor;
        uniform float uAlpha;
        uniform float uStep;
        uniform vec2 uCenter;
        uniform float uFadeR;
        in vec2 vWorld;
        in float vDepth;
        out vec4 fragColor;
        float lines(vec2 w, float step, float width) {
          vec2 g = w / step;
          vec2 fw = fwidth(g);
          vec2 d = abs(fract(g - 0.5) - 0.5) / max(fw, vec2(1e-5));
          float l = 1.0 - min(min(d.x, d.y) / width, 1.0);
          // Where cells shrink below ~3px the lines would alias: fade them out.
          return l * (1.0 - smoothstep(0.18, 0.4, max(fw.x, fw.y)));
        }
        void main() {
          float minor = lines(vWorld, uStep, 1.0);
          float major = lines(vWorld, uStep * 4.0, 1.4);
          float r = length(vWorld - uCenter) / uFadeR;
          float fall = 1.0 - smoothstep(0.35, 1.0, r);
          float haze = 1.0 - 0.6 * smoothstep(1.0, 2.6, vDepth);
          float a = (minor * 0.55 + major) * uAlpha * uAmount * fall * haze;
          if (a < 0.003) discard;
          fragColor = vec4(uColor, a);
        }
      `
    })
    this.mesh = new THREE.Mesh(g, this.material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -1
    this.mesh.visible = false
  }

  get object3d() {
    return this.mesh
  }

  setTheme(isLight, inkMode) {
    const u = this.material.uniforms
    if (inkMode === 'paper') {
      u.uColor.value.set('#3a2f24')
      u.uAlpha.value = 0.08
    } else if (isLight) {
      u.uColor.value.set('#2a3550')
      u.uAlpha.value = 0.08
    } else {
      u.uColor.value.set('#ffffff')
      u.uAlpha.value = 0.065
    }
  }

  // amount: 0..1 tilt fraction; t: camera transform; (cxW, cyW): world point at
  // the view centre; span: world half-size the quad must cover.
  update(amount, k, cxW, cyW, span) {
    const on = amount > 0.002
    this.mesh.visible = on
    if (!on) return
    const u = this.material.uniforms
    u.uAmount.value = amount
    // Keep cells ~70-280 screen px whatever the zoom (powers of two).
    u.uStep.value = 120 * Math.pow(2, Math.round(Math.log2(1 / Math.max(0.05, k))))
    u.uCenter.value.set(cxW, cyW)
    u.uFadeR.value = span
    const p = this._pos
    const x0 = cxW - span,
      x1 = cxW + span,
      y0 = cyW - span,
      y1 = cyW + span
    p.set([x0, y0, 0, x1, y0, 0, x0, y1, 0, x1, y1, 0])
    this.mesh.geometry.attributes.position.needsUpdate = true
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
