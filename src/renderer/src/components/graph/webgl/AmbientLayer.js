import * as THREE from 'three'

// Atmospheric particle field drawn BEHIND the graph (fireflies / starfield /
// falling petals / snow / rising embers / rain / drifting motes). One instanced
// draw call in screen space; every particle's motion is computed in the vertex
// shader from a static per-instance seed + uTime, so animating costs ZERO
// per-frame CPU and no buffer writes — the render loop just keeps ticking while
// an effect is active (quality mode only; see WebGLGraphRenderer).
//
// Camera pans parallax the field (deeper particles move less) and positions
// wrap around the viewport, so the weather feels attached to the world without
// ever needing world-space bookkeeping.

export const AMBIENT_MODES = [
  'none',
  'fireflies',
  'stars',
  'petals',
  'snow',
  'embers',
  'rain',
  'motes'
]
export function ambientModeId(name) {
  const i = AMBIENT_MODES.indexOf(name)
  return i < 0 ? 0 : i
}

const MAX = 260

export class AmbientLayer {
  constructor() {
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3)
    )
    g.setIndex([0, 1, 2, 2, 1, 3])
    // Four uniform randoms per particle — its whole identity (position, phase,
    // size, depth). Written once; never touched again.
    const seeds = new Float32Array(MAX * 4)
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random()
    g.setAttribute('iSeed', new THREE.InstancedBufferAttribute(seeds, 4))
    g.instanceCount = 0
    this.geometry = g

    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uMode: { value: 0 },
        uTime: { value: 0 },
        uSize: { value: new THREE.Vector2(1, 1) },
        uCam: { value: new THREE.Vector2(0, 0) },
        uColorA: { value: new THREE.Color('#ffd27a') },
        uColorB: { value: new THREE.Color('#7ac9ff') },
        uIntensity: { value: 1 }
      },
      vertexShader: /* glsl */ `
        in vec4 iSeed;
        uniform float uMode;
        uniform float uTime;
        uniform vec2 uSize;
        uniform vec2 uCam;
        uniform float uIntensity;
        out vec2 vLocal;
        out float vShape;
        out float vAlpha;
        out float vMix;

        vec2 rot2(vec2 p, float a) {
          float c = cos(a), s = sin(a);
          return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
        }

        void main() {
          int m = int(uMode + 0.5);
          vec4 s = iSeed;
          vec2 span = uSize + 60.0;
          vec2 pos = s.xy * span;
          float t = uTime;
          float size = 3.0, rot = 0.0, alpha = 0.5, shape = 0.0;
          vec2 stretch = vec2(1.0);
          if (m == 1) { // fireflies — lazy wander, breathing glow
            pos += vec2(sin(t * (0.10 + 0.12 * s.z) + s.w * 40.0),
                        cos(t * (0.08 + 0.10 * s.w) + s.z * 40.0)) * (30.0 + 60.0 * s.x);
            size = 2.0 + 2.6 * s.z;
            alpha = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(t * (0.6 + s.w * 1.2) + s.x * 6.283), 2.0);
            shape = 1.0;
          } else if (m == 2) { // starfield — fixed points, twinkling
            size = 1.2 + 2.2 * s.z * s.z;
            alpha = 0.30 + 0.65 * (0.5 + 0.5 * sin(t * (0.3 + s.w) + s.x * 6.283));
            shape = s.z > 0.86 ? 2.0 : 0.0;   // the brightest few get a cross flare
            if (shape > 1.5) size *= 2.8;
          } else if (m == 3) { // petals — tumble down, swaying
            pos.y += t * (14.0 + 18.0 * s.z);
            pos.x += sin(t * (0.5 + 0.5 * s.w) + s.x * 6.283) * 24.0;
            rot = t * (0.6 + 0.8 * s.w) + s.x * 6.283;
            size = 4.5 + 4.0 * s.z;
            alpha = 0.5 + 0.3 * s.w;
            shape = 3.0;
          } else if (m == 4) { // snow — soft fall
            pos.y += t * (20.0 + 26.0 * s.z);
            pos.x += sin(t * (0.4 + 0.5 * s.w) + s.x * 6.283) * 16.0;
            size = 1.6 + 2.8 * s.z;
            alpha = 0.35 + 0.4 * s.w;
          } else if (m == 5) { // embers — rise and gutter
            pos.y -= t * (16.0 + 26.0 * s.z);
            pos.x += sin(t * (0.7 + 0.8 * s.w) + s.x * 6.283) * 12.0;
            size = 1.8 + 2.4 * s.z;
            alpha = (0.3 + 0.6 * s.w) * (0.55 + 0.45 * sin(t * (1.3 + s.z) + s.y * 6.283));
            shape = 1.0;
          } else if (m == 6) { // rain — fast slanted streaks
            pos.y += t * (320.0 + 240.0 * s.z);
            pos.x += t * 36.0;
            size = 1.0 + 0.4 * s.z;
            stretch = vec2(1.1, 12.0 + 8.0 * s.z);
            rot = -0.11;
            alpha = 0.14 + 0.18 * s.w;
            shape = 4.0;
          } else { // motes — near-still dust / ink in water
            pos += vec2(sin(t * 0.05 + s.x * 6.283), cos(t * 0.045 + s.y * 6.283)) * 40.0
                 + vec2(t * 3.0, 0.0);
            size = 2.5 + 4.5 * s.z;
            alpha = 0.10 + 0.15 * s.w;
            shape = 5.0;
          }
          // Parallax with the camera pan — deeper (higher s.w) drifts more.
          pos += uCam * (0.10 + 0.25 * s.w);
          pos = mod(pos, span) - 30.0;

          vLocal = position.xy;
          vShape = shape;
          vMix = s.z;
          vAlpha = alpha * uIntensity;
          vec2 corner = rot2(position.xy * size * stretch, rot);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos + corner, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        in vec2 vLocal;
        in float vShape;
        in float vAlpha;
        in float vMix;
        out vec4 fragColor;

        void main() {
          float r = length(vLocal);
          vec3 col = mix(uColorA, uColorB, vMix);
          float a;
          int sh = int(vShape + 0.5);
          if (sh == 1) {          // glow point (firefly / ember) — white-hot core
            a = exp(-r * r * 3.0);
            col = mix(col, vec3(1.0), exp(-r * r * 9.0) * 0.6);
          } else if (sh == 2) {   // star with a 4-point flare
            a = pow(max(0.0, 1.0 - r), 1.6)
              + 0.8 * pow(max(0.0, 1.0 - abs(vLocal.x)), 10.0) * (1.0 - abs(vLocal.y))
              + 0.8 * pow(max(0.0, 1.0 - abs(vLocal.y)), 10.0) * (1.0 - abs(vLocal.x));
          } else if (sh == 3) {   // petal — soft squashed leaf with a shaded edge
            float e = length(vLocal * vec2(1.55, 0.9) + vec2(0.0, 0.18 * vLocal.x * vLocal.x));
            a = smoothstep(1.0, 0.72, e);
            col *= 0.9 + 0.2 * vLocal.y;
          } else if (sh == 4) {   // rain streak — capsule fading at both ends
            a = smoothstep(1.0, 0.15, abs(vLocal.x)) * (1.0 - abs(vLocal.y)) * (0.6 + 0.4 * vLocal.y);
          } else if (sh == 5) {   // mote — big blurred blot
            a = exp(-r * r * 2.2);
          } else {                // plain soft disc
            a = smoothstep(1.0, 0.5, r);
          }
          a *= vAlpha;
          if (a < 0.004) discard;
          fragColor = vec4(col, a);
        }
      `
    })

    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -1
  }

  get object3d() {
    return this.mesh
  }

  /** True when a mode is active (the renderer keeps its loop alive for it). */
  get active() {
    return this.geometry.instanceCount > 0
  }

  resize(w, h) {
    this.material.uniforms.uSize.value.set(w, h)
  }

  /** Sync from settings. Returns whether the field is animating. */
  sync(gs, quality) {
    const mode = quality === 'performance' ? 0 : ambientModeId(gs.ambientFx)
    const u = this.material.uniforms
    u.uMode.value = mode
    u.uColorA.value.set(gs.ambientColorA || '#ffd27a')
    u.uColorB.value.set(gs.ambientColorB || '#7ac9ff')
    u.uIntensity.value = 0.55 + 0.45 * (gs.ambientDensity ?? 0.5)
    const density = gs.ambientDensity ?? 0.5
    this.geometry.instanceCount = mode === 0 ? 0 : Math.round(60 + density * (MAX - 60))
    this.mesh.visible = mode !== 0
    return mode !== 0
  }

  setClock(t, camX, camY) {
    this.material.uniforms.uTime.value = t
    this.material.uniforms.uCam.value.set(camX, camY)
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
  }
}
