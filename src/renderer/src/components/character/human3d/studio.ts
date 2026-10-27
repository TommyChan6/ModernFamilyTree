// Studio dressing for the 3D character stage: lighting presets, the
// cyclorama (backdrop + seamless floor), a softbox environment for
// reflections, drifting dust motes, the podium and the final colour grade.
// Data + small factories; HumanStage owns the instances and applies presets
// (tweened) on change.
//
// The look is modelled on game character creators: a dark beauty studio with
// a warm halo behind the figure (the default), an airy pastel atelier, and a
// dramatic low-key "cinematic" set with a hard warm key and gold rims. Every
// preset also lays out matching softboxes in the environment map, so the
// catchlights in the eyes and the sheen on skin and hair line up with the
// direct lights.

import * as THREE from 'three'

type Lamp = { color: string; intensity: number; az: number; el: number }

export interface LightPreset {
  id: string
  icon: string
  label: string
  /** Backdrop gradient (sRGB hex): top, horizon, floor. */
  bg: [string, string, string]
  /** Halo behind the figure: colour + strength (0..1). */
  halo: [string, number]
  /** Floor: base colour + the light pool under the figure. */
  floor: [string, string]
  exposure: number
  envIntensity: number
  key: Lamp
  fill: Lamp
  rimA: Lamp
  rimB: Lamp
  ambient: [string, string, number]
  /** Podium edge glow colour + the podium body colour. */
  glow: string
  podium: string
  /** Bloom strength (HDR highlights only). */
  bloom: number
  /** Dust motes: colour + opacity (0 = none). */
  motes: [string, number]
  /** Display-space grade: contrast, saturation, vignette, lift (shadows) + gain (highlights) tints. */
  grade: { contrast: number; sat: number; vignette: number; lift: string; gain: string }
  flicker?: boolean
}

export const LIGHT_PRESETS: LightPreset[] = [
  {
    // Default: a dark beauty studio — big soft key, warm halo, cool rims
    id: 'studio',
    icon: 'lightbulb',
    label: 'Studio',
    bg: ['#0c0d11', '#1f1f25', '#141418'],
    halo: ['#5d5866', 0.45],
    floor: ['#141418', '#34323a'],
    exposure: 1.0,
    envIntensity: 0.55,
    key: { color: '#fff3e6', intensity: 3.4, az: -35, el: 28 },
    fill: { color: '#dfe6ff', intensity: 0.9, az: 45, el: 8 },
    rimA: { color: '#fff6ec', intensity: 2.6, az: 135, el: 30 },
    rimB: { color: '#cfdcff', intensity: 2.2, az: -140, el: 24 },
    ambient: ['#8e93a6', '#2a2522', 0.3],
    glow: '#c9b48a',
    podium: '#141418',
    bloom: 0.22,
    motes: ['#ffe9cf', 0.16],
    grade: { contrast: 0.18, sat: 1.12, vignette: 0.32, lift: '#0a0a12', gain: '#fff8f0' }
  },
  {
    // Pastel atelier: bright, airy, almost shadowless — the "life sim" look
    id: 'atelier',
    icon: 'sparkles',
    label: 'Atelier',
    bg: ['#d9dde6', '#eceae8', '#d9d5d1'],
    halo: ['#ffffff', 0.5],
    floor: ['#d9d5d1', '#f4f1ed'],
    exposure: 0.88,
    envIntensity: 0.8,
    key: { color: '#fff6ec', intensity: 2.5, az: -30, el: 32 },
    fill: { color: '#eef2ff', intensity: 1.2, az: 40, el: 12 },
    rimA: { color: '#ffffff', intensity: 1.4, az: 140, el: 30 },
    rimB: { color: '#f0f4ff', intensity: 1.2, az: -140, el: 26 },
    ambient: ['#e8ecf5', '#b8b0a8', 0.6],
    glow: '#ffffff',
    podium: '#e9e5e0',
    bloom: 0.12,
    motes: ['#ffffff', 0],
    grade: { contrast: 0.12, sat: 1.12, vignette: 0.12, lift: '#141820', gain: '#fffaf5' }
  },
  {
    // Cinematic: hard warm key, gold rims, deep shadow — a fantasy creator
    id: 'cinematic',
    icon: 'clapperboard',
    label: 'Cinematic',
    bg: ['#060608', '#16120f', '#0a0908'],
    halo: ['#6e4f2e', 0.5],
    floor: ['#0a0908', '#3a2c20'],
    exposure: 1.0,
    envIntensity: 0.35,
    key: { color: '#ffe2bf', intensity: 4.4, az: -48, el: 34 },
    fill: { color: '#8ea0d8', intensity: 0.35, az: 55, el: 4 },
    rimA: { color: '#ffc983', intensity: 3.6, az: 128, el: 26 },
    rimB: { color: '#9fb6ff', intensity: 2.4, az: -138, el: 20 },
    ambient: ['#5d5a66', '#1a1410', 0.18],
    glow: '#d9a55c',
    podium: '#0e0d0d',
    bloom: 0.32,
    motes: ['#ffd29a', 0.32],
    grade: { contrast: 0.24, sat: 1.12, vignette: 0.48, lift: '#0c0a10', gain: '#fff2e0' }
  },
  {
    id: 'daylight',
    icon: 'sun',
    label: 'Daylight',
    bg: ['#9fbcdc', '#e3e9ef', '#c0beb7'],
    halo: ['#ffffff', 0.4],
    floor: ['#c0beb7', '#e6e2da'],
    exposure: 1.0,
    envIntensity: 0.9,
    key: { color: '#fff1dc', intensity: 3.6, az: -55, el: 48 },
    fill: { color: '#cfe0ff', intensity: 1.2, az: 60, el: 20 },
    rimA: { color: '#ffffff', intensity: 1.2, az: 150, el: 35 },
    rimB: { color: '#ffffff', intensity: 0.6, az: -150, el: 30 },
    ambient: ['#c9dcf2', '#8a7f70', 0.7],
    glow: '#ffffff',
    podium: '#d8d4cc',
    bloom: 0.1,
    motes: ['#ffffff', 0],
    grade: { contrast: 0.1, sat: 1.05, vignette: 0.12, lift: '#101826', gain: '#fffaf0' }
  },
  {
    id: 'golden',
    icon: 'sunset',
    label: 'Golden hour',
    bg: ['#2e2238', '#c9844f', '#1e1513'],
    halo: ['#ffb070', 0.75],
    floor: ['#1e1513', '#5a3a26'],
    exposure: 1.0,
    envIntensity: 0.45,
    key: { color: '#ffb36b', intensity: 4.2, az: -75, el: 12 },
    fill: { color: '#7d8ccf', intensity: 0.7, az: 60, el: 15 },
    rimA: { color: '#ffcf8a', intensity: 3.2, az: 125, el: 15 },
    rimB: { color: '#ff8f6b', intensity: 1.2, az: -160, el: 10 },
    ambient: ['#c08870', '#3a2a2a', 0.4],
    glow: '#ffb36b',
    podium: '#1a1412',
    bloom: 0.3,
    motes: ['#ffd29a', 0.4],
    grade: { contrast: 0.16, sat: 1.05, vignette: 0.35, lift: '#120a14', gain: '#fff0dc' }
  },
  {
    id: 'moonlight',
    icon: 'moon',
    label: 'Moonlight',
    bg: ['#05070f', '#16203a', '#06070e'],
    halo: ['#4a64a8', 0.6],
    floor: ['#06070e', '#1c2848'],
    exposure: 1.1,
    envIntensity: 0.3,
    key: { color: '#9fb8ff', intensity: 2.4, az: 40, el: 40 },
    fill: { color: '#2a3a6a', intensity: 0.5, az: -60, el: 5 },
    rimA: { color: '#c6d6ff', intensity: 3.4, az: 160, el: 30 },
    rimB: { color: '#5b77d8', intensity: 1.4, az: -140, el: 20 },
    ambient: ['#2b3b66', '#0b0d14', 0.35],
    glow: '#7f9cff',
    podium: '#0b0d14',
    bloom: 0.3,
    motes: ['#c6d6ff', 0.35],
    grade: { contrast: 0.14, sat: 0.95, vignette: 0.4, lift: '#060a18', gain: '#eef3ff' }
  },
  {
    id: 'neon',
    icon: 'zap',
    label: 'Neon',
    bg: ['#0c0414', '#2a0d3a', '#08050d'],
    halo: ['#a020a0', 0.6],
    floor: ['#08050d', '#3a1048'],
    exposure: 1.05,
    envIntensity: 0.25,
    key: { color: '#ffe6f6', intensity: 1.6, az: -20, el: 25 },
    fill: { color: '#2ee6ff', intensity: 2.2, az: 80, el: 5 },
    rimA: { color: '#ff2fd0', intensity: 4.5, az: 130, el: 15 },
    rimB: { color: '#21d4ff', intensity: 4.0, az: -130, el: 15 },
    ambient: ['#5a2a7a', '#100818', 0.35],
    glow: '#ff2fd0',
    podium: '#0c0812',
    bloom: 0.45,
    motes: ['#ff9ff0', 0.3],
    grade: { contrast: 0.14, sat: 1.1, vignette: 0.4, lift: '#10061a', gain: '#fff0ff' }
  },
  {
    id: 'noir',
    icon: 'film',
    label: 'Noir',
    bg: ['#050505', '#191919', '#060606'],
    halo: ['#5a5a5a', 0.5],
    floor: ['#060606', '#2a2a2a'],
    exposure: 1.0,
    envIntensity: 0.12,
    key: { color: '#ffffff', intensity: 5.0, az: -60, el: 40 },
    fill: { color: '#ffffff', intensity: 0.12, az: 60, el: 0 },
    rimA: { color: '#ffffff', intensity: 2.2, az: 150, el: 30 },
    rimB: { color: '#ffffff', intensity: 0.0, az: -150, el: 30 },
    ambient: ['#404040', '#050505', 0.15],
    glow: '#ffffff',
    podium: '#0a0a0a',
    bloom: 0.25,
    motes: ['#ffffff', 0.25],
    grade: { contrast: 0.3, sat: 0.12, vignette: 0.5, lift: '#000000', gain: '#ffffff' }
  },
  {
    id: 'candle',
    icon: 'flame',
    label: 'Candlelight',
    bg: ['#0a0604', '#2a170c', '#090504'],
    halo: ['#a8622a', 0.6],
    floor: ['#090504', '#3a2214'],
    exposure: 1.15,
    envIntensity: 0.15,
    key: { color: '#ff9a45', intensity: 4.2, az: -30, el: -5 },
    fill: { color: '#5a3a2a', intensity: 0.4, az: 70, el: 10 },
    rimA: { color: '#ffb070', intensity: 1.6, az: 150, el: 20 },
    rimB: { color: '#402a20', intensity: 0.4, az: -150, el: 20 },
    ambient: ['#5a3420', '#0a0605', 0.25],
    glow: '#ff9a45',
    podium: '#0e0907',
    bloom: 0.4,
    motes: ['#ffb070', 0.5],
    grade: { contrast: 0.18, sat: 1.0, vignette: 0.5, lift: '#0e0604', gain: '#fff0dc' },
    flicker: true
  }
]

export const LIGHT_BY_ID = new Map(LIGHT_PRESETS.map((p) => [p.id, p]))

/** Unit direction from azimuth (deg, 0 = in front of the character) + elevation. */
export function lightDir(az: number, el: number, out = new THREE.Vector3()) {
  const a = THREE.MathUtils.degToRad(az)
  const e = THREE.MathUtils.degToRad(el)
  return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e))
}

// ── Environment ─────────────────────────────────────────────────────────────

/**
 * A softbox studio for PMREM: a dim gradient room plus emissive panels where
 * the preset's lights are (a big key box, strip boxes for the rims, a wide
 * fill and a top light), so reflections agree with the direct lighting.
 */
export function buildEnvScene(p: LightPreset) {
  const scene = new THREE.Scene()
  const room = new THREE.Mesh(
    new THREE.SphereGeometry(20, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        uTop: { value: new THREE.Color(p.bg[0]).multiplyScalar(0.8) },
        uMid: { value: new THREE.Color(p.bg[1]).multiplyScalar(0.8) },
        uLow: { value: new THREE.Color(p.floor[1]).multiplyScalar(0.7) }
      },
      vertexShader: /* glsl */ `
varying vec3 vDir;
void main() { vDir = normalize( position ); gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
      fragmentShader: /* glsl */ `
uniform vec3 uTop, uMid, uLow;
varying vec3 vDir;
void main() {
  float y = vDir.y;
  vec3 c = y > 0.0 ? mix( uMid, uTop, smoothstep( 0.0, 0.8, y ) ) : mix( uMid, uLow, smoothstep( 0.0, 0.3, -y ) );
  gl_FragColor = vec4( c, 1.0 );
}`
    })
  )
  scene.add(room)
  const panel = (lamp: Lamp, w: number, h: number, gain: number, dist = 7) => {
    if (lamp.intensity <= 0) return
    const c = new THREE.Color(lamp.color).multiplyScalar(lamp.intensity * gain)
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })
    )
    const d = lightDir(lamp.az, lamp.el)
    m.position
      .copy(d)
      .multiplyScalar(dist)
      .add(new THREE.Vector3(0, 1.2, 0))
    m.lookAt(0, 1.2, 0)
    scene.add(m)
  }
  panel(p.key, 3.2, 4.2, 1.6)
  panel(p.fill, 5, 3, 0.9)
  panel(p.rimA, 0.9, 5, 2.2)
  panel(p.rimB, 0.9, 5, 2.2)
  // overhead box (a soft top light every studio has)
  panel({ color: p.key.color, intensity: p.key.intensity * 0.35, az: 0, el: 80 }, 4, 4, 1)
  return scene
}

// ── Cyclorama ───────────────────────────────────────────────────────────────

/** A big inverted sphere with a vertical gradient, a halo and grain. */
export function createBackdrop() {
  const uniforms = {
    uTop: { value: new THREE.Color('#1b1f27') },
    uMid: { value: new THREE.Color('#2b303b') },
    uLow: { value: new THREE.Color('#15171c') },
    uHalo: { value: new THREE.Color('#6f6a78') },
    uHaloAmt: { value: 0.5 }
  }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize( position );
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,
    fragmentShader: /* glsl */ `
uniform vec3 uTop, uMid, uLow, uHalo;
uniform float uHaloAmt;
varying vec3 vDir;
void main() {
  float y = vDir.y;
  // a cyc wall that curves into the floor: no hard horizon line
  vec3 c = mix( uLow, uMid, smoothstep( -0.06, 0.22, y ) );
  c = mix( c, uTop, smoothstep( 0.22, 0.9, y ) );
  // a soft halo behind the figure + a tighter warm core (a lit cyc wall)
  float az = atan( vDir.x, -vDir.z );
  float r = length( vec2( az * 0.9, ( y - 0.12 ) * 1.3 ) );
  c += uHalo * ( exp( -r * r * 7.0 ) * 0.7 + exp( -r * r * 30.0 ) * 0.3 ) * uHaloAmt;
  // fine grain against banding
  float n = fract( sin( dot( gl_FragCoord.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
  c += ( n - 0.5 ) / 255.0;
  gl_FragColor = vec4( c, 1.0 );
  #include <colorspace_fragment>
}`
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(30, 48, 24), mat)
  mesh.renderOrder = -2
  mesh.frustumCulled = false
  return { mesh, uniforms }
}

/**
 * The seamless floor: a disc that carries a soft pool of light under the
 * figure and fades into the backdrop's floor colour at the edges (no
 * horizon line), plus receives the figure's shadow.
 */
export function createFloor() {
  const uniforms = {
    uBase: { value: new THREE.Color('#17171b') },
    uPool: { value: new THREE.Color('#3a3840') },
    uEdge: { value: new THREE.Color('#0d0d10') }
  }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
varying vec2 vXZ;
void main() {
  vXZ = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,
    fragmentShader: /* glsl */ `
uniform vec3 uBase, uPool, uEdge;
varying vec2 vXZ;
void main() {
  float d = length( vXZ );
  vec3 c = mix( uPool, uBase, smoothstep( 0.0, 2.6, d ) );
  c = mix( c, uEdge, smoothstep( 3.0, 9.0, d ) );
  float a = 1.0 - smoothstep( 7.0, 12.0, d );
  float n = fract( sin( dot( gl_FragCoord.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
  c += ( n - 0.5 ) / 255.0;
  gl_FragColor = vec4( c, a );
  #include <colorspace_fragment>
}`
  })
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(12, 96), mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.renderOrder = -1
  return { mesh, uniforms }
}

/** Slow drifting dust motes / bokeh in the light (additive points). */
export function createMotes(count = 70) {
  const pos = new Float32Array(count * 3)
  const seed = new Float32Array(count)
  let s = 7
  const R = () => (s = (s * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < count; i++) {
    const a = R() * Math.PI * 2
    const r = 0.7 + R() * 3.2
    pos[i * 3] = Math.cos(a) * r
    pos[i * 3 + 1] = R() * 2.6
    pos[i * 3 + 2] = Math.sin(a) * r - 0.8
    seed[i] = R()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#ffe9cf') },
    uOpacity: { value: 0.2 },
    uPx: { value: 800 }
  }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
attribute float aSeed;
uniform float uTime, uPx;
varying float vA;
varying float vBlur;
void main() {
  vec3 p = position;
  float t = uTime * ( 0.02 + aSeed * 0.03 );
  p.y = mod( p.y + t * 2.0, 2.6 );
  p.x += sin( uTime * 0.21 + aSeed * 40.0 ) * 0.12;
  p.z += cos( uTime * 0.17 + aSeed * 23.0 ) * 0.12;
  vec4 mv = modelViewMatrix * vec4( p, 1.0 );
  // out-of-focus motes (near or far from the figure) grow into soft discs
  float focus = abs( -mv.z - 3.0 );
  vBlur = clamp( focus / 3.0, 0.0, 1.0 );
  gl_PointSize = ( 1.2 + aSeed * 1.6 + vBlur * 8.0 ) * uPx / max( 1.0, -mv.z ) * 0.012;
  vA = ( 0.35 + 0.65 * sin( uTime * ( 0.5 + aSeed ) + aSeed * 30.0 ) * 0.5 + 0.5 ) * ( 1.0 - vBlur * 0.75 )
     * smoothstep( 0.0, 0.3, p.y ) * ( 1.0 - smoothstep( 2.2, 2.6, p.y ) );
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vA;
varying float vBlur;
void main() {
  float d = length( gl_PointCoord - 0.5 ) * 2.0;
  float disc = 1.0 - smoothstep( mix( 0.2, 0.75, vBlur ), 1.0, d );
  gl_FragColor = vec4( uColor * disc * vA * uOpacity, 1.0 );
}`
  })
  const points = new THREE.Points(g, mat)
  points.frustumCulled = false
  return { points, uniforms }
}

/** A low polished dais with a fine inlaid rim, plus a shadow catcher. */
export function createPodium() {
  const group = new THREE.Group()
  const top = 0.045
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x141418,
    roughness: 0.28,
    metalness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.12
  })
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.56, top, 128, 1), bodyMat)
  base.position.y = top / 2
  base.receiveShadow = true
  group.add(base)
  // a bevelled lip so the top edge catches a line of light
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.006, 12, 160), bodyMat)
  lip.rotation.x = Math.PI / 2
  lip.position.y = top
  group.add(lip)
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xc9b48a,
    transparent: true,
    opacity: 0.55
  })
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.455, 0.46, 160), ringMat)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = top + 0.0012
  group.add(ring)
  const catcher = new THREE.Mesh(
    new THREE.CircleGeometry(6, 64),
    new THREE.ShadowMaterial({ opacity: 0.35 })
  )
  catcher.rotation.x = -Math.PI / 2
  catcher.position.y = 0.001
  catcher.receiveShadow = true
  group.add(catcher)
  // Shadow on the podium top itself
  const topShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.515, 64),
    new THREE.ShadowMaterial({ opacity: 0.55 })
  )
  topShadow.rotation.x = -Math.PI / 2
  topShadow.position.y = top + 0.0008
  topShadow.receiveShadow = true
  group.add(topShadow)
  return { group, top, ringMat, bodyMat }
}

// ── Grade ───────────────────────────────────────────────────────────────────

/**
 * Final display-space grade (after tone mapping): a gentle S-curve,
 * saturation, split-tone lift/gain, a soft vignette, a touch of lens
 * fringing at the corners and fine animated grain.
 */
export const GradeShader = {
  name: 'H3GradeShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uAspect: { value: 1 },
    uContrast: { value: 0.15 },
    uSat: { value: 1.0 },
    uVignette: { value: 0.3 },
    uLift: { value: new THREE.Color(0, 0, 0) },
    uGain: { value: new THREE.Color(1, 1, 1) },
    uGrain: { value: 0.012 },
    uFringe: { value: 0.0025 },
    uTime: { value: 0 }
  },
  vertexShader: /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uAspect, uContrast, uSat, uVignette, uGrain, uFringe, uTime;
uniform vec3 uLift, uGain;
varying vec2 vUv;
void main() {
  vec2 d = vUv - 0.5;
  float r2 = dot( d * vec2( uAspect, 1.0 ), d * vec2( uAspect, 1.0 ) );
  vec2 off = d * uFringe * r2 * 4.0;
  vec4 src = texture2D( tDiffuse, vUv );
  vec3 c = vec3( texture2D( tDiffuse, vUv - off ).r, src.g, texture2D( tDiffuse, vUv + off ).b );
  c = clamp( c, 0.0, 1.0 );
  c = mix( c, c * c * ( 3.0 - 2.0 * c ), uContrast );
  float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
  c = max( mix( vec3( l ), c, uSat ), 0.0 );
  c = c * uGain + uLift * ( 1.0 - c );
  c *= 1.0 - uVignette * smoothstep( 0.08, 0.7, r2 );
  float n = fract( sin( dot( gl_FragCoord.xy + fract( uTime ) * 97.0, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
  c += ( n - 0.5 ) * uGrain;
  gl_FragColor = vec4( c, src.a );
}`
}
