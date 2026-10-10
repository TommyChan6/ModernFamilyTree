// Studio dressing for the 3D character stage: lighting presets, the
// cyclorama backdrop and the podium. Data + small factories; HumanStage owns
// the instances and applies presets (tweened) on change.

import * as THREE from 'three'

export interface LightPreset {
  id: string
  icon: string
  label: string
  /** Backdrop gradient (sRGB hex): top, horizon, floor. */
  bg: [string, string, string]
  exposure: number
  envIntensity: number
  key: { color: string; intensity: number; az: number; el: number }
  fill: { color: string; intensity: number; az: number; el: number }
  rimA: { color: string; intensity: number; az: number; el: number }
  rimB: { color: string; intensity: number; az: number; el: number }
  ambient: [string, string, number]
  /** Podium edge glow colour. */
  glow: string
  flicker?: boolean
}

export const LIGHT_PRESETS: LightPreset[] = [
  {
    id: 'studio',
    icon: 'lightbulb',
    label: 'Studio',
    bg: ['#1b1f27', '#2b303b', '#15171c'],
    exposure: 0.95,
    envIntensity: 0.4,
    key: { color: '#fff1e2', intensity: 3.8, az: -40, el: 30 },
    fill: { color: '#c8d6ff', intensity: 0.45, az: 55, el: 6 },
    rimA: { color: '#ffffff', intensity: 3.0, az: 140, el: 28 },
    rimB: { color: '#d8e4ff', intensity: 2.0, az: -150, el: 22 },
    ambient: ['#9aa6bd', '#2a2420', 0.22],
    glow: '#6c8ef5'
  },
  {
    id: 'daylight',
    icon: 'sun',
    label: 'Daylight',
    bg: ['#a9c3df', '#dfe7ee', '#b9bcb8'],
    exposure: 1.05,
    envIntensity: 0.9,
    key: { color: '#fff4e0', intensity: 3.6, az: -55, el: 48 },
    fill: { color: '#cfe0ff', intensity: 1.3, az: 60, el: 20 },
    rimA: { color: '#ffffff', intensity: 1.2, az: 150, el: 35 },
    rimB: { color: '#ffffff', intensity: 0.6, az: -150, el: 30 },
    ambient: ['#c9dcf2', '#8a7f70', 0.7],
    glow: '#ffffff'
  },
  {
    id: 'golden',
    icon: 'sunset',
    label: 'Golden hour',
    bg: ['#3a2a3f', '#d98c52', '#2a1d1a'],
    exposure: 1.0,
    envIntensity: 0.45,
    key: { color: '#ffb36b', intensity: 4.2, az: -75, el: 12 },
    fill: { color: '#7d8ccf', intensity: 0.7, az: 60, el: 15 },
    rimA: { color: '#ffcf8a', intensity: 3.2, az: 125, el: 15 },
    rimB: { color: '#ff8f6b', intensity: 1.2, az: -160, el: 10 },
    ambient: ['#c08870', '#3a2a2a', 0.4],
    glow: '#ffb36b'
  },
  {
    id: 'moonlight',
    icon: 'moon',
    label: 'Moonlight',
    bg: ['#05070f', '#16203a', '#05060a'],
    exposure: 1.1,
    envIntensity: 0.3,
    key: { color: '#9fb8ff', intensity: 2.4, az: 40, el: 40 },
    fill: { color: '#2a3a6a', intensity: 0.5, az: -60, el: 5 },
    rimA: { color: '#c6d6ff', intensity: 3.4, az: 160, el: 30 },
    rimB: { color: '#5b77d8', intensity: 1.4, az: -140, el: 20 },
    ambient: ['#2b3b66', '#0b0d14', 0.35],
    glow: '#7f9cff'
  },
  {
    id: 'neon',
    icon: 'zap',
    label: 'Neon',
    bg: ['#0c0414', '#2a0d3a', '#07040b'],
    exposure: 1.05,
    envIntensity: 0.25,
    key: { color: '#ffe6f6', intensity: 1.6, az: -20, el: 25 },
    fill: { color: '#2ee6ff', intensity: 2.2, az: 80, el: 5 },
    rimA: { color: '#ff2fd0', intensity: 4.5, az: 130, el: 15 },
    rimB: { color: '#21d4ff', intensity: 4.0, az: -130, el: 15 },
    ambient: ['#5a2a7a', '#100818', 0.35],
    glow: '#ff2fd0'
  },
  {
    id: 'noir',
    icon: 'film',
    label: 'Noir',
    bg: ['#050505', '#151515', '#030303'],
    exposure: 1.0,
    envIntensity: 0.12,
    key: { color: '#ffffff', intensity: 5.0, az: -60, el: 40 },
    fill: { color: '#ffffff', intensity: 0.12, az: 60, el: 0 },
    rimA: { color: '#ffffff', intensity: 2.2, az: 150, el: 30 },
    rimB: { color: '#ffffff', intensity: 0.0, az: -150, el: 30 },
    ambient: ['#404040', '#050505', 0.15],
    glow: '#ffffff'
  },
  {
    id: 'candle',
    icon: 'flame',
    label: 'Candlelight',
    bg: ['#0a0604', '#2a170c', '#070403'],
    exposure: 1.15,
    envIntensity: 0.15,
    key: { color: '#ff9a45', intensity: 4.2, az: -30, el: -5 },
    fill: { color: '#5a3a2a', intensity: 0.4, az: 70, el: 10 },
    rimA: { color: '#ffb070', intensity: 1.6, az: 150, el: 20 },
    rimB: { color: '#402a20', intensity: 0.4, az: -150, el: 20 },
    ambient: ['#5a3420', '#0a0605', 0.25],
    glow: '#ff9a45',
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

/** A big inverted sphere with a vertical three-stop gradient + vignette. */
export function createBackdrop() {
  const uniforms = {
    uTop: { value: new THREE.Color('#1b1f27') },
    uMid: { value: new THREE.Color('#2b303b') },
    uLow: { value: new THREE.Color('#15171c') }
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
uniform vec3 uTop, uMid, uLow;
varying vec3 vDir;
void main() {
  float y = vDir.y;
  vec3 c = y > 0.0 ? mix( uMid, uTop, smoothstep( 0.0, 0.7, y ) ) : mix( uMid, uLow, smoothstep( 0.0, 0.25, -y ) );
  // soft spotlight bloom behind the character
  float spot = exp( -pow( length( vec2( atan( vDir.x, -vDir.z ), y - 0.12 ) ), 2.0 ) * 3.0 );
  c += uMid * spot * 0.35;
  // fine grain against banding
  float n = fract( sin( dot( gl_FragCoord.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
  c += ( n - 0.5 ) / 255.0;
  gl_FragColor = vec4( c, 1.0 );
  #include <colorspace_fragment>
}`
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(30, 48, 24), mat)
  mesh.renderOrder = -1
  mesh.frustumCulled = false
  return { mesh, uniforms }
}

/** A low glossy podium with a glowing rim, plus a wide shadow catcher. */
export function createPodium() {
  const group = new THREE.Group()
  const top = 0.045
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.55, top, 96, 1),
    new THREE.MeshPhysicalMaterial({
      color: 0x15171c,
      roughness: 0.35,
      metalness: 0.2,
      clearcoat: 0.8,
      clearcoatRoughness: 0.2
    })
  )
  base.position.y = top / 2
  base.receiveShadow = true
  group.add(base)
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x6c8ef5, transparent: true, opacity: 0.85 })
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.545, 0.0035, 8, 160), ringMat)
  ring.rotation.x = Math.PI / 2
  ring.position.y = top * 0.55
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
    new THREE.ShadowMaterial({ opacity: 0.5 })
  )
  topShadow.rotation.x = -Math.PI / 2
  topShadow.position.y = top + 0.0008
  topShadow.receiveShadow = true
  group.add(topShadow)
  return { group, top, ringMat }
}
