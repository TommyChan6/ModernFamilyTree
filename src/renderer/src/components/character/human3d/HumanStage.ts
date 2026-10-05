// The 3D character stage: renderer + post (GTAO, tone mapping), studio
// lights/backdrop/podium, an orbit camera that glides to whatever is being
// edited, and the human (body + skin + eyes + hair + clothing) kept in sync
// with a Human3DState. Idle life — breathing, blinks, saccades, a gaze that
// follows the camera — runs off one clock; the loop sleeps when nothing moves
// and the tab is hidden.
//
// The Vue editor (Character3DEditor.vue) talks to this class only through
// `apply(state)`, `focus(region)`, `pick(x, y)` and `snapshot()`.

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Human3DState } from '../../../../../shared/character3d'
import { loadHumanAsset, type HumanAsset } from './humanAsset'
import { HumanBody, DM } from './HumanBody'
import { createSkinMaterial, type SkinMaterial } from './skinMaterial'
import { EyePair } from './humanEyes'
import { shapeTargetWeights } from './catalog'
import { expressionWeights, poseOps, poseQuaternions, POSE_BY_ID } from './poses'
import {
  LIGHT_BY_ID,
  LIGHT_PRESETS,
  createBackdrop,
  createPodium,
  lightDir,
  type LightPreset
} from './studio'
import { HairSystem } from './hairSystem'
import { Wardrobe } from './wardrobe'
import { REGIONS, type Region } from './regions'

export type Quality = 'high' | 'balanced' | 'fast'

/** Render layer for strand meshes (excluded from the AO pre-pass). */
export const HAIR_LAYER = 1

const tmpV = new THREE.Vector3()
const tmpV2 = new THREE.Vector3()
const tmpQ = new THREE.Quaternion()

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** Shallow JSON key for change detection. */
const keyOf = (v: unknown) => JSON.stringify(v)

export class HumanStage {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(26, 1, 0.02, 80)
  private aoCamera = new THREE.PerspectiveCamera(26, 1, 0.02, 80)
  readonly controls: OrbitControls
  private composer: EffectComposer
  private gtao: GTAOPass
  private host: HTMLElement
  private ro: ResizeObserver
  private raf = 0
  private clock = new THREE.Clock()
  private disposed = false
  private quality: Quality = 'high'

  asset: HumanAsset | null = null
  body: HumanBody | null = null
  skin: SkinMaterial
  eyes = new EyePair()
  hair: HairSystem | null = null
  wardrobe: Wardrobe | null = null
  private teethMat = new THREE.MeshPhysicalMaterial({
    color: 0xece4d6,
    roughness: 0.22,
    clearcoat: 0.6,
    clearcoatRoughness: 0.1
  })
  private tongueMat = new THREE.MeshPhysicalMaterial({
    color: 0xb4545a,
    roughness: 0.42,
    clearcoat: 0.4
  })

  // Lights
  private key = new THREE.DirectionalLight(0xffffff, 3)
  private fill = new THREE.DirectionalLight(0xffffff, 1)
  private rimA = new THREE.DirectionalLight(0xffffff, 2)
  private rimB = new THREE.DirectionalLight(0xffffff, 1.5)
  private hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 0.4)
  private backdrop = createBackdrop()
  private podium = createPodium()
  private preset: LightPreset = LIGHT_PRESETS[0]
  private envTex: THREE.Texture | null = null

  // State tracking
  state: Human3DState | null = null
  private keys: Record<string, string> = {}
  private shapeDirty = false
  private shapeFast = false
  private fullShapeTimer = 0
  private exprFrom = new Map<string, number>()
  private exprTo = new Map<string, number>()
  private exprCur = new Map<string, number>()
  private exprT = 1
  private poseFrom = new Map<string, THREE.Quaternion>()
  private poseTo = new Map<string, THREE.Quaternion>()
  private poseT = 1
  private restDirs = new Map<string, THREE.Vector3>()

  // Life
  private blinkAt = 1.5
  private blinkT = -1
  private saccade = new THREE.Vector2()
  private saccadeAt = 0.8
  private gaze = new THREE.Vector3(0, 1.6, 3)
  private pointer = new THREE.Vector2(0, 0)
  private pointerActive = false
  lookAtCamera = true
  turntable = false
  hovered: Region | null = null

  // Camera tween
  private camFrom = { pos: new THREE.Vector3(), target: new THREE.Vector3() }
  private camTo = { pos: new THREE.Vector3(), target: new THREE.Vector3() }
  private camT = 1

  onReady: (() => void) | null = null
  onError: ((e: unknown) => void) | null = null

  constructor(host: HTMLElement, opts: { quality?: Quality } = {}) {
    this.host = host
    this.quality = opts.quality || 'high'
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance'
    })
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, this.quality === 'fast' ? 1 : 2)
    )
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.NeutralToneMapping
    this.renderer.toneMappingExposure = 1
    this.renderer.shadowMap.enabled = true
    // PCF with a wide kernel: soft penumbrae, so strand shadows read as hair
    // shade rather than crisp lines (PCFSoft ignores the radius)
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    host.appendChild(this.renderer.domElement)

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    this.scene.environment = this.envTex

    this.scene.add(this.backdrop.mesh, this.podium.group, this.hemi)
    for (const l of [this.key, this.fill, this.rimA, this.rimB]) {
      this.scene.add(l, l.target)
      l.target.position.set(0, 1, 0)
    }
    this.key.castShadow = true
    const sm = this.quality === 'fast' ? 1024 : 2048
    this.key.shadow.mapSize.set(sm, sm)
    const sc = this.key.shadow.camera
    sc.left = -1.1
    sc.right = 1.1
    sc.top = 1.2
    sc.bottom = -1.2
    sc.near = 0.5
    sc.far = 8
    this.key.shadow.bias = -0.0004
    this.key.shadow.normalBias = 0.02
    this.key.shadow.radius = 5
    this.key.shadow.blurSamples = 16
    this.rimA.castShadow = false

    this.skin = createSkinMaterial()

    // Post: MSAA scene target → GTAO → tone map/output
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2())
    const rt = new THREE.WebGLRenderTarget(size.x || 1, size.y || 1, {
      type: THREE.HalfFloatType,
      samples: this.quality === 'fast' ? 0 : 4
    })
    this.composer = new EffectComposer(this.renderer, rt)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    // AO sees everything but the strand layer (ribbons have no normals to give it)
    this.aoCamera.layers.set(0)
    this.camera.layers.enable(HAIR_LAYER)
    this.gtao = new GTAOPass(this.scene, this.aoCamera, size.x || 1, size.y || 1)
    this.gtao.updateGtaoMaterial({
      radius: 0.12,
      distanceExponent: 1.4,
      thickness: 0.6,
      scale: 1.0,
      samples: 16
    })
    this.gtao.updatePdMaterial({
      lumaPhi: 10,
      depthPhi: 2,
      normalPhi: 3,
      radius: 4,
      rings: 2,
      samples: 16
    })
    this.gtao.blendIntensity = 0.85
    this.gtao.enabled = this.quality !== 'fast'
    this.composer.addPass(this.gtao)
    this.composer.addPass(new OutputPass())

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 0.22
    this.controls.maxDistance = 7
    this.controls.maxPolarAngle = Math.PI * 0.62
    this.controls.zoomSpeed = 0.8
    this.controls.rotateSpeed = 0.7
    this.controls.screenSpacePanning = true
    this.controls.addEventListener('start', () => (this.camT = 1))
    this.camera.position.set(0, 1.0, 5.4)
    this.controls.target.set(0, 0.95, 0)

    this.applyPreset(this.preset, true)
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(host)
    this.resize()
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove)
    this.renderer.domElement.addEventListener('pointerleave', this.onPointerLeave)
    document.addEventListener('visibilitychange', this.onVisibility)

    loadHumanAsset()
      .then((asset) => {
        if (this.disposed) return
        this.asset = asset
        this.buildHuman(asset)
        this.onReady?.()
      })
      .catch((e) => this.onError?.(e))
    this.loop()
  }

  // ── Setup ──────────────────────────────────────────────────────────────────
  private buildHuman(asset: HumanAsset) {
    const body = new HumanBody(asset, {
      body: this.skin.material,
      'upper-teeth': this.teethMat,
      'lower-teeth': this.teethMat,
      tongue: this.tongueMat,
      default: this.skin.material
    })
    for (const key of ['upper-teeth', 'lower-teeth', 'tongue']) {
      const m = body.meshes.get(key)
      if (m) m.castShadow = false
    }
    this.body = body
    this.scene.add(body.root)
    body.root.position.y = this.podium.top
    const head = body.boneByName.get('head')
    if (head) head.add(this.eyes.left, this.eyes.right)
    this.hair = new HairSystem(body)
    this.wardrobe = new Wardrobe(body)
    if (this.state) this.apply(this.state, true)
  }

  private resize() {
    const w = Math.max(1, this.host.clientWidth)
    const h = Math.max(1, this.host.clientHeight)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    const pr = this.renderer.getPixelRatio()
    this.composer.setSize(w, h)
    this.composer.setPixelRatio(pr)
    this.gtao.setSize(w * pr, h * pr)
    this.wake()
  }

  setQuality(q: Quality) {
    this.quality = q
    this.gtao.enabled = q !== 'fast'
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'fast' ? 1 : 2))
    this.hair?.setDensityScale(q === 'high' ? 1 : q === 'balanced' ? 0.65 : 0.4)
    this.resize()
  }

  // ── State → scene ─────────────────────────────────────────────────────────
  /** Sync everything that changed since the last call (cheap when nothing did). */
  apply(state: Human3DState, force = false) {
    this.state = state
    const body = this.body
    if (!body) return
    const changed = (k: string, v: unknown) => {
      const s = keyOf(v)
      if (!force && this.keys[k] === s) return false
      this.keys[k] = s
      return true
    }
    if (changed('shape', [state.body, state.shape])) {
      this.shapeDirty = true
      this.shapeFast = !force
      clearTimeout(this.fullShapeTimer)
      this.fullShapeTimer = window.setTimeout(() => {
        this.shapeDirty = true
        this.shapeFast = false
        this.wake()
      }, 220)
    }
    if (changed('expression', state.expression)) {
      this.exprFrom = new Map(this.exprCur)
      this.exprTo = expressionWeights(state.expression)
      this.exprT = force ? 1 : 0
      if (force) this.exprCur = new Map(this.exprTo)
      this.shapeDirty = true
    }
    // First sync: build the shape now so hair/clothing grow on a real surface
    if (force && this.shapeDirty) {
      this.shapeDirty = false
      this.shapeFast = false
      this.rebuildShape()
    }
    if (
      changed('skin', [
        state.skin,
        state.makeup,
        state.brows.color,
        state.beard,
        state.hair.color,
        state.body.age
      ])
    ) {
      this.updateSkin(state)
    }
    if (changed('eyes', state.eyes)) {
      const e = state.eyes
      const seed = 1 + Math.round((e.pattern * 997 + e.scleraRed * 131) * 7)
      const left = {
        iris: e.iris,
        irisOuter: e.irisOuter,
        pattern: e.pattern,
        scleraRed: e.scleraRed,
        seed
      }
      const right = { ...left, iris: e.irisRight || e.iris, seed: seed + 17 }
      this.eyes.setLook(left, right, e.pupil)
    }
    if (changed('pose', state.pose) && this.restDirs.size) this.startPose(state.pose, force)
    if (changed('light', state.light))
      this.applyPreset(LIGHT_BY_ID.get(state.light) || LIGHT_PRESETS[0], force)
    if (
      this.hair &&
      changed('hair', [
        state.hair,
        state.brows,
        state.beard,
        state.eyes.lashLength,
        state.eyes.lashDensity,
        state.makeup.mascara,
        state.body.age
      ])
    ) {
      this.hair.setState(state)
    }
    if (this.wardrobe && changed('outfit', [state.outfit, state.body.gender]))
      this.wardrobe.setState(state)
    this.wake()
  }

  private updateSkin(state: Human3DState) {
    const ageF = Math.max(0, Math.min(1, (state.body.age - 35) / 50))
    this.skin.setParams({
      ...state.skin,
      ...state.makeup,
      age: ageF,
      stubbleColor: state.beard.color,
      scalpColor: state.hair.color,
      browColor: state.brows.color,
      browPaint: state.brows.style === 'none' ? 0 : 0.12 + state.brows.density * 0.25
    })
    // Painted stubble zones from the beard style
    const st = state.beard
    const zones = BEARD_STUBBLE[st.style] || {}
    const base = st.stubble
    const z: Record<string, number> = {}
    for (const k of ['beard', 'mustache', 'goatee', 'sideburn', 'neck']) {
      z[k] = Math.min(
        1,
        (zones[k] || 0) * (0.35 + st.density * 0.5) + base * (k === 'neck' ? 0.6 : 1)
      )
    }
    const hairStyle = state.hair.style
    const scalp =
      hairStyle === 'buzz'
        ? 0.95
        : hairStyle === 'bald'
          ? 0
          : SHORT_SCALP.has(hairStyle)
            ? 0.85
            : 0.9
    this.body?.setShadowHair(z, scalp)
  }

  private rebuildShape() {
    const body = this.body
    const state = this.state
    if (!body || !state) return
    const w = shapeTargetWeights(state, this.exprCur)
    body.setShape(w, { fast: this.shapeFast })
    if (!this.shapeFast) {
      this.computeRestDirs()
      this.placeEyes()
      this.hair?.refit()
      this.wardrobe?.refit()
      if (this.state) this.startPose(this.state.pose, true)
    } else {
      this.placeEyes()
      this.hair?.follow()
      this.wardrobe?.follow()
    }
  }

  private computeRestDirs() {
    const body = this.body
    if (!body) return
    this.restDirs.clear()
    for (const b of body.asset.bones) {
      const h = body.jointPos(b.head, new THREE.Vector3())
      const t = body.jointPos(b.tail, new THREE.Vector3())
      const d = t.sub(h)
      if (d.lengthSq() > 1e-10) this.restDirs.set(b.name, d.normalize())
    }
  }

  private placeEyes() {
    const body = this.body
    if (!body) return
    const headPos = body.boneHead('head', tmpV2)
    for (const side of ['l', 'r'] as const) {
      const mesh = side === 'l' ? this.eyes.left : this.eyes.right
      const e = body.eyes[side]
      mesh.position.copy(e.center).sub(headPos)
      // the helper sphere hugs the lids; the visible eyeball sits a hair inside
      mesh.scale.setScalar(e.radius * 0.985)
    }
  }

  private startPose(id: string, instant: boolean) {
    const def = POSE_BY_ID.get(id) || POSE_BY_ID.get('relaxed')
    if (!def || !this.body) return
    const target = poseQuaternions(poseOps(def), (name) => this.restDirs.get(name) || null)
    this.poseFrom = new Map()
    for (const b of this.body.bones)
      this.poseFrom.set(b.name, this.poseCurrent.get(b.name)?.clone() || new THREE.Quaternion())
    this.poseTo = target
    this.poseT = instant ? 1 : 0
    if (instant) this.poseCurrent = new Map([...target].map(([k, q]) => [k, q.clone()]))
  }

  private poseCurrent = new Map<string, THREE.Quaternion>()

  // ── Lighting ──────────────────────────────────────────────────────────────
  private presetFrom: LightPreset | null = null
  private presetT = 1

  private applyPreset(p: LightPreset, instant = false) {
    this.presetFrom = instant ? null : this.preset
    this.preset = p
    this.presetT = instant ? 1 : 0
    if (instant) this.setPresetMix(p, null, 1)
  }

  private setPresetMix(to: LightPreset, from: LightPreset | null, t: number) {
    const mixC = (a: string, b: string, out: THREE.Color) => out.set(a).lerp(new THREE.Color(b), t)
    const mixN = (a: number, b: number) => a + (b - a) * t
    const f = from || to
    const setL = (
      light: THREE.DirectionalLight,
      a: LightPreset['key'],
      b: LightPreset['key'],
      dist = 6
    ) => {
      mixC(a.color, b.color, light.color)
      light.intensity = mixN(a.intensity, b.intensity)
      const d1 = lightDir(a.az, a.el, tmpV)
      const d2 = lightDir(b.az, b.el, tmpV2)
      d1.lerp(d2, t).normalize()
      light.position
        .copy(d1)
        .multiplyScalar(dist)
        .add(new THREE.Vector3(0, 1.1, 0))
    }
    setL(this.key, f.key, to.key)
    setL(this.fill, f.fill, to.fill)
    setL(this.rimA, f.rimA, to.rimA)
    setL(this.rimB, f.rimB, to.rimB)
    mixC(f.ambient[0], to.ambient[0], this.hemi.color)
    mixC(f.ambient[1], to.ambient[1], this.hemi.groundColor)
    this.hemi.intensity = mixN(f.ambient[2], to.ambient[2])
    mixC(f.bg[0], to.bg[0], this.backdrop.uniforms.uTop.value)
    mixC(f.bg[1], to.bg[1], this.backdrop.uniforms.uMid.value)
    mixC(f.bg[2], to.bg[2], this.backdrop.uniforms.uLow.value)
    this.scene.environmentIntensity = mixN(f.envIntensity, to.envIntensity)
    this.renderer.toneMappingExposure = mixN(f.exposure, to.exposure)
    mixC(f.glow, to.glow, this.podium.ringMat.color)
    this.hair?.setLights(this.key, this.rimA, this.hemi)
  }

  // ── Camera ────────────────────────────────────────────────────────────────
  /** Glide the camera to a named region (see regions.ts) or 'full'. */
  focus(regionId: string, instant = false) {
    const body = this.body
    let target: THREE.Vector3
    let dist: number
    let az = 0
    let el = 4
    if (!body || regionId === 'full') {
      const h = body ? body.heightMeters() : 1.7
      target = new THREE.Vector3(0, this.podium.top + h * 0.53, 0)
      dist = Math.max(3.2, h * 2.6)
      el = 3
    } else {
      const r = REGIONS.find((x) => x.id === regionId) || REGIONS[0]
      target = this.regionWorld(r, new THREE.Vector3())
      dist = r.dist
      az = r.az || 0
      el = r.el ?? 4
    }
    const a = THREE.MathUtils.degToRad(az)
    const e = THREE.MathUtils.degToRad(el)
    const pos = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e))
      .multiplyScalar(dist)
      .add(target)
    if (instant) {
      this.camera.position.copy(pos)
      this.controls.target.copy(target)
      this.camT = 1
    } else {
      this.camFrom.pos.copy(this.camera.position)
      this.camFrom.target.copy(this.controls.target)
      this.camTo.pos.copy(pos)
      this.camTo.target.copy(target)
      this.camT = 0
    }
    this.wake()
  }

  /** World position of a region's anchor (follows pose + shape). */
  regionWorld(r: Region, out: THREE.Vector3) {
    const body = this.body
    if (!body) return out.set(0, 1.5, 0)
    body.anchorWorld(r.anchor, out)
    if (r.offset) out.add(tmpV.set(r.offset[0], r.offset[1], r.offset[2]))
    return out
  }

  /** The region under a canvas point (analytic sphere test), or null. */
  pick(clientX: number, clientY: number): Region | null {
    const body = this.body
    if (!body) return null
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    const ray = new THREE.Raycaster()
    ray.setFromCamera(ndc, this.camera)
    let best: Region | null = null
    let bestT = Infinity
    const c = new THREE.Vector3()
    for (const r of REGIONS) {
      if (!r.pickRadius) continue
      this.regionWorld(r, c)
      const sphere = new THREE.Sphere(c, r.pickRadius)
      const hit = ray.ray.intersectSphere(sphere, tmpV)
      if (!hit) continue
      // prefer the smallest region along the ray (eyes over head)
      const t = hit.distanceTo(ray.ray.origin) + r.pickRadius * 2
      if (t < bestT) {
        bestT = t
        best = r
      }
    }
    return best
  }

  /** Glow a region on the skin (null = none). */
  setHighlight(r: Region | null) {
    this.hovered = r
    const u = this.skin.uniforms
    if (r?.ref) {
      u.uHighlightCenter.value.set(r.ref[0], r.ref[1], r.ref[2])
      u.uHighlightRadius.value = r.refRadius || 0.3
    }
    this.highlightTarget = r?.ref ? 1 : 0
    this.wake()
  }
  private highlightTarget = 0

  // ── Loop ──────────────────────────────────────────────────────────────────
  private idleFrames = 0
  private wake() {
    this.idleFrames = 0
  }

  private onVisibility = () => {
    if (!document.hidden) this.clock.getDelta()
  }

  private onPointerMove = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    )
    this.pointerActive = true
  }

  private onPointerLeave = () => {
    this.pointerActive = false
  }

  private loop = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    if (document.hidden) return
    const dt = Math.min(0.05, this.clock.getDelta())
    this.tick(dt)
    this.controls.update()
    this.hair?.update(this.camera, this.renderer.domElement.height)
    this.syncAoCamera()
    this.composer.render(dt)
  }

  private tick(dt: number) {
    const t = this.clock.elapsedTime
    // camera glide
    if (this.camT < 1) {
      this.camT = Math.min(1, this.camT + dt / 0.75)
      const k = easeInOut(this.camT)
      this.camera.position.lerpVectors(this.camFrom.pos, this.camTo.pos, k)
      this.controls.target.lerpVectors(this.camFrom.target, this.camTo.target, k)
    }
    this.controls.autoRotate = this.turntable
    this.controls.autoRotateSpeed = 1.2
    // light preset crossfade (+ candle flicker)
    if (this.presetT < 1) {
      this.presetT = Math.min(1, this.presetT + dt / 0.6)
      this.setPresetMix(this.preset, this.presetFrom, easeInOut(this.presetT))
    }
    if (this.preset.flicker) {
      const f =
        1 + Math.sin(t * 13.1) * 0.04 + Math.sin(t * 7.3 + 1) * 0.05 + Math.sin(t * 23.7) * 0.02
      this.key.intensity = this.preset.key.intensity * f
    }
    // highlight fade
    const u = this.skin.uniforms.uHighlight
    u.value += (this.highlightTarget - u.value) * Math.min(1, dt * 10)
    if (Math.abs(u.value) < 0.002) u.value = 0

    if (!this.body) return
    // expression tween → reshape
    if (this.exprT < 1) {
      this.exprT = Math.min(1, this.exprT + dt / 0.28)
      const k = easeInOut(this.exprT)
      const cur = new Map<string, number>()
      for (const name of new Set([...this.exprFrom.keys(), ...this.exprTo.keys()])) {
        const v = (this.exprFrom.get(name) || 0) * (1 - k) + (this.exprTo.get(name) || 0) * k
        if (v > 1e-4) cur.set(name, v)
      }
      this.exprCur = cur
      this.shapeDirty = true
      this.shapeFast = this.exprT < 1
    }
    if (this.shapeDirty) {
      this.shapeDirty = false
      this.rebuildShape()
    }
    this.animateRig(t, dt)
  }

  private animateRig(t: number, dt: number) {
    const body = this.body as HumanBody
    // pose blend
    if (this.poseT < 1) this.poseT = Math.min(1, this.poseT + dt / 0.6)
    const k = easeInOut(this.poseT)
    for (const bone of body.bones) {
      const from = this.poseFrom.get(bone.name)
      const to = this.poseTo.get(bone.name)
      if (!from && !to) {
        bone.quaternion.identity()
        continue
      }
      bone.quaternion.copy(from || tmpQ.identity())
      if (k > 0) bone.quaternion.slerp(to || tmpQ.identity(), k)
      if (this.poseT >= 1) this.poseCurrent.set(bone.name, bone.quaternion.clone())
    }
    if (this.poseT < 1) {
      for (const bone of body.bones) this.poseCurrent.set(bone.name, bone.quaternion.clone())
    }
    // breathing: chest + shoulders, ~14 breaths/min
    const br = Math.sin(t * 1.45)
    this.addRot('spine03', 'x', -0.6 * br)
    this.addRot('spine04', 'x', -0.5 * br)
    this.addRot('clavicle.L', 'z', 0.5 * br)
    this.addRot('clavicle.R', 'z', -0.5 * br)
    // weight drift
    this.addRot('root', 'z', Math.sin(t * 0.37) * 0.35)
    this.addRot('spine02', 'z', -Math.sin(t * 0.37) * 0.3)
    // gaze: follow the camera (or cursor), with saccades
    if (t > this.saccadeAt) {
      this.saccade.set((Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.04)
      this.saccadeAt = t + 0.6 + Math.random() * 2.2
    }
    const head = body.boneByName.get('head')
    if (head) {
      const goal = tmpV.copy(this.camera.position)
      if (this.pointerActive) {
        const p = new THREE.Vector3(this.pointer.x, this.pointer.y, 0.5).unproject(this.camera)
        goal.lerp(p, 0.35)
      }
      this.gaze.lerp(goal, Math.min(1, dt * 3))
      if (this.lookAtCamera) {
        head.updateWorldMatrix(true, false)
        const hp = head.getWorldPosition(tmpV2)
        const dir = this.gaze.clone().sub(hp).normalize()
        const yaw = THREE.MathUtils.clamp(Math.atan2(dir.x, dir.z), -0.6, 0.6)
        const pitch = THREE.MathUtils.clamp(-Math.asin(dir.y), -0.35, 0.35)
        this.addRot('neck02', 'y', THREE.MathUtils.radToDeg(yaw) * 0.25)
        this.addRot('head', 'y', THREE.MathUtils.radToDeg(yaw) * 0.35)
        this.addRot('head', 'x', THREE.MathUtils.radToDeg(pitch) * 0.35)
      }
      this.addRot('head', 'z', Math.sin(t * 0.53) * 0.8)
      this.addRot('head', 'x', Math.sin(t * 0.71 + 1) * 0.6)
      // eyes aim at the gaze point
      head.updateWorldMatrix(true, true)
      const aim = this.gaze.clone()
      aim.x += this.saccade.x
      aim.y += this.saccade.y
      for (const eye of [this.eyes.left, this.eyes.right]) {
        eye.rotation.set(0, 0, 0)
        eye.updateWorldMatrix(true, false)
        const ep = eye.getWorldPosition(new THREE.Vector3())
        const local = head.worldToLocal(aim.clone()).sub(head.worldToLocal(ep.clone()))
        const yaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -0.45, 0.45)
        const pitch = THREE.MathUtils.clamp(
          -Math.atan2(local.y, Math.hypot(local.x, local.z)),
          -0.3,
          0.3
        )
        eye.rotation.set(this.lookAtCamera ? pitch : 0, this.lookAtCamera ? yaw : 0, 0, 'YXZ')
      }
    }
    // blinks (GPU morph) — lashes follow via the hair system
    if (t > this.blinkAt && this.blinkT < 0) this.blinkT = 0
    let blink = 0
    if (this.blinkT >= 0) {
      this.blinkT += dt
      const d = 0.16
      blink =
        this.blinkT < d / 2
          ? this.blinkT / (d / 2)
          : Math.max(0, 1 - (this.blinkT - d / 2) / (d * 0.9))
      if (this.blinkT > d * 1.5) {
        this.blinkT = -1
        this.blinkAt = t + 1.8 + Math.random() * 4.5 + (Math.random() < 0.15 ? -1.5 : 0)
      }
    }
    // an expression that already closes an eye shouldn't double-close it
    const closedL = this.exprCur.get('expr/eye-left-closure') || 0
    const closedR = this.exprCur.get('expr/eye-right-closure') || 0
    const bl = blink * (1 - closedL)
    const brr = blink * (1 - closedR)
    body.setBlink(bl, brr)
    this.hair?.setBlink(bl, brr)
  }

  private syncAoCamera() {
    const a = this.aoCamera
    const c = this.camera
    a.position.copy(c.position)
    a.quaternion.copy(c.quaternion)
    a.fov = c.fov
    a.aspect = c.aspect
    a.near = c.near
    a.far = c.far
    a.updateProjectionMatrix()
    a.updateMatrixWorld()
  }

  private addRot(bone: string, axis: 'x' | 'y' | 'z', deg: number) {
    const b = this.body?.boneByName.get(bone)
    if (!b) return
    tmpV.set(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0)
    tmpQ.setFromAxisAngle(tmpV, THREE.MathUtils.degToRad(deg))
    b.quaternion.multiply(tmpQ)
  }

  // ── Output ────────────────────────────────────────────────────────────────
  /**
   * Render a still (PNG/WebP data URL). `framing` 'portrait' crops head and
   * shoulders, 'full' the whole figure; `transparent` drops the backdrop.
   */
  snapshot(
    opts: {
      size?: number
      framing?: 'portrait' | 'full' | 'current'
      transparent?: boolean
      type?: string
    } = {}
  ) {
    const size = opts.size || 512
    const framing = opts.framing || 'portrait'
    const savedPos = this.camera.position.clone()
    const savedTarget = this.controls.target.clone()
    const savedAspect = this.camera.aspect
    if (framing !== 'current') {
      if (framing === 'portrait') {
        const r = REGIONS.find((x) => x.id === 'portrait') as Region
        const target = this.regionWorld(r, new THREE.Vector3())
        this.camera.position.copy(target).add(new THREE.Vector3(0.08, 0.05, r.dist))
        this.camera.lookAt(target)
      } else {
        const h = this.body?.heightMeters() || 1.7
        const target = new THREE.Vector3(0, this.podium.top + h * 0.52, 0)
        this.camera.position.copy(target).add(new THREE.Vector3(0, 0.1, h * 2.5))
        this.camera.lookAt(target)
      }
    }
    this.camera.aspect = 1
    this.camera.updateProjectionMatrix()
    // Float target: the composer's buffers inherit its type, and float pixels
    // are readable everywhere WebGL2 runs (half-float readback isn't)
    const rt = new THREE.WebGLRenderTarget(size, size, { type: THREE.FloatType, samples: 4 })
    const comp = new EffectComposer(this.renderer, rt)
    comp.renderToScreen = false
    const bgVisible = this.backdrop.mesh.visible
    const podVisible = this.podium.group.visible
    if (opts.transparent) {
      this.backdrop.mesh.visible = false
      this.podium.group.visible = false
    }
    const rp = new RenderPass(this.scene, this.camera)
    if (opts.transparent) {
      rp.clearColor = new THREE.Color(0, 0, 0)
      rp.clearAlpha = 0
    }
    comp.addPass(rp)
    const out = new OutputPass()
    comp.addPass(out)
    comp.setPixelRatio(1)
    comp.setSize(size, size)
    comp.render()
    const floats = new Float32Array(size * size * 4)
    // The OutputPass wrote into comp.readBuffer (renderToScreen false) — already
    // tone mapped + sRGB encoded, so 0..1
    this.renderer.readRenderTargetPixels(comp.readBuffer, 0, 0, size, size, floats)
    const pixels = new Uint8ClampedArray(floats.length)
    for (let i = 0; i < floats.length; i++) pixels[i] = floats[i] * 255 + 0.5
    const cv = document.createElement('canvas')
    cv.width = cv.height = size
    const g = cv.getContext('2d') as CanvasRenderingContext2D
    const img = g.createImageData(size, size)
    for (let y = 0; y < size; y++) {
      img.data.set(pixels.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4)
    }
    if (!opts.transparent) for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255
    g.putImageData(img, 0, 0)
    comp.dispose()
    rt.dispose()
    this.backdrop.mesh.visible = bgVisible
    this.podium.group.visible = podVisible
    this.camera.aspect = savedAspect
    this.camera.updateProjectionMatrix()
    this.camera.position.copy(savedPos)
    this.controls.target.copy(savedTarget)
    this.camera.lookAt(savedTarget)
    return cv.toDataURL(opts.type || 'image/png', 0.92)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    clearTimeout(this.fullShapeTimer)
    this.ro.disconnect()
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove)
    this.renderer.domElement.removeEventListener('pointerleave', this.onPointerLeave)
    this.controls.dispose()
    this.hair?.dispose()
    this.wardrobe?.dispose()
    this.body?.dispose()
    this.eyes.dispose()
    this.skin.material.dispose()
    this.teethMat.dispose()
    this.tongueMat.dispose()
    this.envTex?.dispose()
    this.composer.dispose()
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && m.geometry) m.geometry.dispose()
    })
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
  }
}

/** Which beard zones a style paints as shaved shadow (strands come on top). */
const BEARD_STUBBLE: Record<string, Partial<Record<string, number>>> = {
  none: {},
  stubble: { beard: 0.75, mustache: 0.8, goatee: 0.8, sideburn: 0.6, neck: 0.35 },
  'short-beard': { beard: 1, mustache: 1, goatee: 1, sideburn: 1, neck: 0.6 },
  'full-beard': { beard: 1, mustache: 1, goatee: 1, sideburn: 1, neck: 0.8 },
  goatee: { mustache: 0.9, goatee: 1 },
  mustache: { mustache: 1 },
  chevron: { mustache: 1, beard: 0.3 },
  handlebar: { mustache: 1 },
  'chin-strap': { beard: 0.8, sideburn: 1, goatee: 1 },
  'van-dyke': { mustache: 1, goatee: 1 },
  mutton: { sideburn: 1, beard: 0.6 }
}

const SHORT_SCALP = new Set(['crew', 'undercut', 'fade', 'mohawk', 'slick-back', 'pompadour'])

export { DM }
