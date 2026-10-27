// Procedural eyes: a unit eyeball whose front pole bulges into a corneal
// dome, textured with a painted iris + sclera (canvas, regenerated when the
// eye colour changes). The iris is drawn with parallax so it sits flat at the
// base of the dome — light catches the wet cornea while the iris stays
// "inside" the eye, the single biggest realism cue in a face. The pupil is a
// shader term so it can dilate without repainting.

import * as THREE from 'three'

/** Iris angular radius on the eyeball (≈ 11.8 mm iris on a 24 mm eye). */
const IRIS_ANGLE = 0.52
const IRIS_UV = Math.sin(IRIS_ANGLE) * 0.5 // planar-uv radius of the limbus

export interface EyeLook {
  iris: string
  irisOuter: string
  pattern: number
  scleraRed: number
  seed: number
}

function rand(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

function mixHex(a: THREE.Color, b: THREE.Color, t: number) {
  return a.clone().lerp(b, t)
}

const css = (c: THREE.Color, a = 1) =>
  `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`

/** Paint the planar eye texture (sclera + iris; the pupil is the shader's). */
export function paintEyeCanvas(look: EyeLook, size = 1024): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const g = cv.getContext('2d') as CanvasRenderingContext2D
  const R = rand(look.seed)
  const c = size / 2
  const irisR = IRIS_UV * size
  // The canvas works in sRGB; THREE.Color.getStyle-like conversion by hand
  const inner = new THREE.Color(look.iris)
  const outer = new THREE.Color(look.irisOuter)
  const toS = (col: THREE.Color) => col.clone() // colours are given as sRGB hex

  // ── Sclera ──
  const scl = g.createRadialGradient(c, c, irisR, c, c, c)
  // a real sclera is never paper-white: warm ivory, pinker toward the rim
  scl.addColorStop(0, '#ebe5de')
  scl.addColorStop(0.5, '#e2d7cf')
  scl.addColorStop(1, `rgb(${214}, ${176 - look.scleraRed * 40}, ${168 - look.scleraRed * 50})`)
  g.fillStyle = scl
  g.fillRect(0, 0, size, size)
  // Veins: wandering threads from the rim inward
  const veins = 18 + Math.round(look.scleraRed * 40)
  for (let i = 0; i < veins; i++) {
    let a = R() * Math.PI * 2
    let r = c * (0.95 + R() * 0.05)
    g.beginPath()
    g.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r)
    const steps = 10 + R() * 14
    for (let s = 0; s < steps && r > irisR * 1.25; s++) {
      a += (R() - 0.5) * 0.12
      r -= c * 0.02 * (0.6 + R())
      g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r)
    }
    g.strokeStyle = `rgba(170, 40, 40, ${0.08 + look.scleraRed * 0.25})`
    g.lineWidth = 0.6 + R() * 1.4
    g.stroke()
  }
  // Soft shadow ring outside the limbus
  const lim = g.createRadialGradient(c, c, irisR * 0.98, c, c, irisR * 1.25)
  lim.addColorStop(0, 'rgba(60,45,40,0.35)')
  lim.addColorStop(1, 'rgba(60,45,40,0)')
  g.fillStyle = lim
  g.beginPath()
  g.arc(c, c, irisR * 1.25, 0, Math.PI * 2)
  g.fill()

  // ── Iris base ──
  const light = mixHex(toS(inner), new THREE.Color('#e8c87a'), 0.35)
  const base = g.createRadialGradient(c, c, 0, c, c, irisR)
  base.addColorStop(0, css(light))
  base.addColorStop(0.32, css(light))
  base.addColorStop(0.42, css(toS(inner)))
  base.addColorStop(0.8, css(mixHex(toS(inner), toS(outer), 0.5)))
  base.addColorStop(1, css(toS(outer)))
  g.fillStyle = base
  g.beginPath()
  g.arc(c, c, irisR, 0, Math.PI * 2)
  g.fill()

  // ── Stroma fibres: thousands of wavy radial threads ──
  g.save()
  g.beginPath()
  g.arc(c, c, irisR, 0, Math.PI * 2)
  g.clip()
  const fibres = Math.round(900 + look.pattern * 1400)
  for (let i = 0; i < fibres; i++) {
    const a = R() * Math.PI * 2
    const r0 = irisR * (0.12 + R() * 0.25)
    const r1 = irisR * (0.6 + R() * 0.42)
    const wob = (R() - 0.5) * 0.08
    const bright = R()
    const col =
      bright > 0.55
        ? mixHex(toS(inner), new THREE.Color('#fff4d8'), 0.25 + R() * 0.35)
        : mixHex(toS(inner), new THREE.Color('#000000'), 0.25 + R() * 0.4)
    g.strokeStyle = css(col, (0.08 + R() * 0.22) * (0.5 + look.pattern))
    g.lineWidth = 0.5 + R() * 1.6
    g.beginPath()
    for (let s = 0; s <= 8; s++) {
      const t = s / 8
      const rr = r0 + (r1 - r0) * t
      const aa = a + Math.sin(t * Math.PI * 2 + i) * wob
      const x = c + Math.cos(aa) * rr
      const y = c + Math.sin(aa) * rr
      if (s === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
  }
  // Collarette: a bright, jagged ring a third of the way out
  g.strokeStyle = css(mixHex(light, new THREE.Color('#ffffff'), 0.2), 0.35 * (0.4 + look.pattern))
  g.lineWidth = irisR * 0.035
  g.beginPath()
  for (let s = 0; s <= 120; s++) {
    const a = (s / 120) * Math.PI * 2
    const rr = irisR * (0.36 + Math.sin(a * 13 + look.seed) * 0.025 + (R() - 0.5) * 0.02)
    const x = c + Math.cos(a) * rr
    const y = c + Math.sin(a) * rr
    if (s === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.stroke()
  // Crypts: small dark lacunae
  const crypts = Math.round(18 + look.pattern * 40)
  for (let i = 0; i < crypts; i++) {
    const a = R() * Math.PI * 2
    const rr = irisR * (0.4 + R() * 0.45)
    g.fillStyle = css(mixHex(toS(outer), new THREE.Color('#000000'), 0.5), 0.12 + R() * 0.25)
    g.beginPath()
    g.ellipse(
      c + Math.cos(a) * rr,
      c + Math.sin(a) * rr,
      irisR * (0.015 + R() * 0.04),
      irisR * (0.01 + R() * 0.02),
      a,
      0,
      Math.PI * 2
    )
    g.fill()
  }
  // Limbal ring
  const ring = g.createRadialGradient(c, c, irisR * 0.82, c, c, irisR)
  ring.addColorStop(0, 'rgba(0,0,0,0)')
  ring.addColorStop(0.7, css(mixHex(toS(outer), new THREE.Color('#000000'), 0.55), 0.55))
  ring.addColorStop(1, css(mixHex(toS(outer), new THREE.Color('#000000'), 0.7), 0.85))
  g.fillStyle = ring
  g.fillRect(c - irisR, c - irisR, irisR * 2, irisR * 2)
  // Pupil edge darkening (the pupil itself is the shader's)
  const pe = g.createRadialGradient(c, c, 0, c, c, irisR * 0.5)
  pe.addColorStop(0, 'rgba(10,8,6,0.9)')
  pe.addColorStop(0.35, 'rgba(10,8,6,0.4)')
  pe.addColorStop(1, 'rgba(10,8,6,0)')
  g.fillStyle = pe
  g.fillRect(c - irisR, c - irisR, irisR * 2, irisR * 2)
  g.restore()
  return cv
}

/** Unit eyeball geometry: planar front uv, corneal dome bulge. */
export function eyeballGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 72, 54)
  // SphereGeometry's pole is +y; rotate so the front pole faces +z
  geo.rotateX(Math.PI / 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const uv = geo.attributes.uv as THREE.BufferAttribute
  const cosIris = Math.cos(IRIS_ANGLE)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    let z = pos.getZ(i)
    // planar projection (front hemisphere); the back hemisphere maps to the rim
    const rxy = Math.hypot(x, y) || 1e-6
    const k = z >= 0 ? 0.5 : (0.5 * 1) / rxy
    uv.setXY(i, 0.5 + x * k, 0.5 + y * k)
    if (z > cosIris) {
      // corneal dome: smooth bump that peaks at the pole
      const t = (z - cosIris) / (1 - cosIris)
      const bulge = 0.085 * Math.sin((t * Math.PI) / 2) ** 1.5
      z += bulge
      pos.setZ(i, z)
    }
  }
  geo.computeVertexNormals()
  return geo
}

export function createEyeMaterial(texture: THREE.Texture) {
  const uniforms = {
    uPupil: { value: 0.4 },
    uIrisUV: { value: IRIS_UV },
    uCosIris: { value: Math.cos(IRIS_ANGLE) }
  }
  const mat = new THREE.MeshPhysicalMaterial({
    map: texture,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    specularIntensity: 0.6,
    ior: 1.376
  })
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vEyeLocal;
varying vec3 vEyeCam;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vEyeLocal = position;
vEyeCam = ( inverse( modelMatrix ) * vec4( cameraPosition, 1.0 ) ).xyz;`
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vEyeLocal;
varying vec3 vEyeCam;
uniform float uPupil, uIrisUV, uCosIris;
vec3 eyeIrisGlow = vec3( 0.0 );`
      )
      .replace(
        '#include <map_fragment>',
        `{
  vec2 uvE = vMapUv;
  vec3 V = normalize( vEyeLocal - vEyeCam );
  // parallax: look through the cornea down to the flat iris plane
  float dome = max( vEyeLocal.z - uCosIris, 0.0 );
  uvE -= V.xy / max( -V.z, 0.3 ) * dome * 0.5 * 0.9;
  vec4 texel = texture2D( map, uvE );
  float r = length( uvE - 0.5 ) / uIrisUV;
  float pupil = 0.18 + uPupil * 0.32;
  float pm = 1.0 - smoothstep( pupil - 0.02, pupil + 0.015, r );
  texel.rgb = mix( texel.rgb, vec3( 0.006 ), pm );
  // eye occlusion: the socket and lids shade the ball — the upper lid casts
  // a soft shadow across the top, and the sclera darkens toward the corners
  // (what keeps eyes from looking pasted on)
  float front = smoothstep( 0.35, 0.9, vEyeLocal.z );
  float lid = 1.0 - smoothstep( -0.05, 0.55, vEyeLocal.y ) * 0.55;
  float occ = mix( 0.42, 1.0, front ) * lid;
  // the iris sits behind the lens and stays rich even in the lid shadow
  float iris = 1.0 - smoothstep( 0.92, 1.05, r );
  texel.rgb *= mix( occ, mix( occ, 1.0, 0.5 ), iris );
  diffuseColor *= texel;
  eyeIrisGlow = texel.rgb * iris * ( 1.0 - pm );
}`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
// light caught and scattered inside the iris (the "alive" glow of game eyes)
totalEmissiveRadiance += eyeIrisGlow * 0.06;`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
// the iris (under the cornea) reads glossier than the sclera's tear film
roughnessFactor = mix( roughnessFactor, 0.12, smoothstep( uCosIris - 0.05, uCosIris + 0.02, vEyeLocal.z ) );`
      )
  }
  mat.customProgramCacheKey = () => 'human3d-eye-v2'
  return { material: mat, uniforms }
}

export class EyePair {
  readonly geometry = eyeballGeometry()
  readonly left: THREE.Mesh
  readonly right: THREE.Mesh
  private readonly mats: ReturnType<typeof createEyeMaterial>[]
  private readonly textures: THREE.CanvasTexture[]
  private lastKey = ['', '']

  constructor() {
    this.textures = [0, 1].map(() => {
      const t = new THREE.CanvasTexture(document.createElement('canvas'))
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      return t
    })
    this.mats = this.textures.map((t) => createEyeMaterial(t))
    this.left = new THREE.Mesh(this.geometry, this.mats[0].material)
    this.right = new THREE.Mesh(this.geometry, this.mats[1].material)
    for (const m of [this.left, this.right]) {
      m.castShadow = false
      m.receiveShadow = true
      m.name = 'eye'
    }
  }

  /** Repaint (only when a look actually changes). */
  setLook(left: EyeLook, right: EyeLook, pupil: number) {
    ;[left, right].forEach((look, i) => {
      const key = JSON.stringify(look)
      if (key !== this.lastKey[i]) {
        this.lastKey[i] = key
        this.textures[i].image = paintEyeCanvas(look)
        this.textures[i].needsUpdate = true
      }
      this.mats[i].uniforms.uPupil.value = pupil
    })
  }

  setPupil(p: number) {
    for (const m of this.mats) m.uniforms.uPupil.value = p
  }

  dispose() {
    this.geometry.dispose()
    for (const t of this.textures) t.dispose()
    for (const m of this.mats) m.material.dispose()
  }
}
