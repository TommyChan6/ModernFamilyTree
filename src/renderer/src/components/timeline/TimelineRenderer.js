import * as THREE from 'three'
import { NodeLayer } from '../graph/webgl/NodeLayer.js'
import { AURA_IGNITE_DUR } from '../graph/webgl/NodeMaterial.js'
import { AvatarAtlas } from '../graph/webgl/AvatarAtlas.js'
import { approach, TWEEN_EPS } from '../graph/webgl/tween.js'
import { LifelineLayer, lifelineStyleInfo, SHADOWED } from './LifelineLayer.js'
import { AmbientLayer } from '../graph/webgl/AmbientLayer.js'
import { DotLayer } from '../webgl/DotLayer.js'
import { RibbonLayer, sampleQuadratic, makeScratch } from '../webgl/RibbonLayer.js'
import { createCssColorCache, roundRect, trunc } from '../webgl/overlayUtils.js'
import { drawKinPills } from './kinPills.js'
import { GUTTER, Y_PAD, LANE_W, X0 } from './timelineLayout.js'
import {
  branchDrop,
  branchCubic,
  sproutDrop,
  sproutCubic,
  sampleCubicRange,
  bridgePieces,
  distToPolyline
} from './timelineLinks'
import { InkStrokeLayer } from '../webgl/InkStrokeLayer.js'
import { InkDropLayer } from '../webgl/InkDropLayer.js'
import { InkThreadLayer } from '../webgl/InkThreadLayer.js'
import { InkMistLayer } from '../webgl/InkMistLayer.js'
import { inkWriteSchedule, writeArrival, hexToRgb01, PAPER_RGB } from '../webgl/inkMath'
import { inkFontsReady, paperCanvas, INK } from '../../lib/inkArt'
import { writeInkBuffers, drawInkBg, drawInkFg } from './TimelineInk.js'
import { drawChronicleBg, drawChronicleFg, chronicleAt } from './chronicleDraw.js'
import { drawIcon } from '../../lib/canvasIcon.js'
import { lifeName, lifeYears, badgeText } from './timelineText.js'
import { tiltProjection, depthOrder } from '../graph/webgl/coords.js'
import { buildTimeWarp, warpYear, unwarpYear, warpSlope, warpTicks } from './timeWarp'
import {
  tiltView,
  isTilted,
  tiltAmount,
  projectFlat,
  unprojectFlat,
  projectLifted,
  liftPoint,
  visibleFlatBounds,
  arcHeight,
  ropeLift,
  branchLift,
  sproutLift,
  liftSamples,
  distToSegment,
  pinHit,
  frameRectToFlat
} from './timelineTilt'
import { TiltCanvas, billboard } from './tiltCanvas'
import { RiverLayer } from './RiverLayer.js'
import {
  riverSetData,
  buildRiverScreen,
  writeRiverLife,
  riverEndX,
  riverRopeLanes,
  riverScreenX,
  writeRiverBands,
  riverPersonAt,
  riverHouseholdAt
} from './TimelineRivers.js'

const SEG = 16
const PTS = (SEG + 1) * 2 // floats per sampled branch (hover hit-tests)
const TICK_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000, 2000, 5000]

const _col = new THREE.Color()
function rgb(hex) {
  _col.set(hex || '#888')
  return [_col.r, _col.g, _col.b]
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

// Draws the Timeline with Three.js: instanced lifelines/caps (CapsuleLayer), pulsing
// end-of-life and connector dots (DotLayer), marriage ropes, family stems and
// child branches (RibbonLayer — a branch is cut open where it passes under a
// living lifeline, the "bridge"), Sprout-mode lifelines peeling out of their
// parents' stem, and avatar pins (the tree view's NodeLayer + AvatarAtlas). Two 2D
// canvases sandwich the GL canvas: `bg` holds the year grid, `fg` holds the gutter,
// labels and marriage badges (viewport-culled, LOD by zoom).
//
// Everything is positioned in screen space each frame from the camera
// { px: pxPerYear, ls: laneScale, tx, ty } — frames are on-demand except while a
// style tween, the entrance animation or the living-dot pulse is running (pulse-only
// frames skip all buffer writes and 2D redraws; they just advance uTime and render).
export class TimelineRenderer {
  constructor({ bgCanvas, glCanvas, fgCanvas, hooks }) {
    this.hooks = hooks
    this.disposed = false
    this._scheduled = false
    this._lastT = null
    this._timeSec = 0
    this.camera2 = { px: 8, ls: 1, tx: GUTTER + 40, ty: 0 }
    this.layout = {
      people: [],
      marriages: [],
      families: [],
      branches: [],
      minYear: 0,
      yearSpan: 10
    }
    this.mouseY = null
    this.hoverBadgeId = null
    this._badgeHoverS = 1

    this._geomDirty = true
    this._stylesDirty = true
    this._styleWrite = true
    this._tweening = false
    this._entranceUntil = 0
    this._seen = new Set()
    this._pAnim = new Map() // person id -> { op, w, s, top, tw, ts, start, auraKey, auraBorn }
    this._auraOn = false // any visible pin wears an aura ornament (keeps the loop alive)
    this._igniteUntil = 0 // uTime seconds the last aura ignition finishes
    this._settleAuras = false // exportFrame: draw every aura settled (no shockwave)
    this._mAnim = new Map() // marriage id -> { op, w, top, tw }
    this._bAnim = new Map() // branch id -> { op, w, top, tw }
    this._fAnim = new Map() // family id -> { op, w, top, tw } (its stem)
    this._laneX = new Map() // person id -> { x, tx } — lanes glide on re-layout
    this._pVis = [] // cached visuals, index-aligned with layout.people
    this._mVis = []
    this._bVis = []
    this._fVis = []
    // Link geometry, rebuilt with every geometry frame (_linkGeometry):
    this._pIdx = new Map() // person id -> index in layout.people
    this._byLane = new Map() // lane -> person indices (Sprout lanes hold several)
    this._avDy = new Float32Array(0) // px a pin sits below its birth (sprouts)
    this._sp = new Float32Array(0) // per person: sprout cubic (NaN = none)
    this._fg = new Float32Array(0) // per family: stemX, top, bottom, ropeY, barY, xa, xb, on
    this._bc = new Float32Array(0) // per branch: cubic (NaN = not drawn as a branch)
    this._bPts = new Float32Array(0) // per branch: sampled curve (hover)
    this._bHit = new Uint8Array(0) // per branch: hoverable this frame
    this._lineX = new Float32Array(0) // per person: screen x / span / half width
    this._lineY0 = new Float32Array(0)
    this._lineY1 = new Float32Array(0)
    this._lineHalf = new Float32Array(0)
    this._lineOrder = new Int32Array(0) // person indices sorted by screen x
    this._badgeRects = [] // screen rects of the badges drawn last frame
    this._curve = makeScratch(SEG)

    this.bg = bgCanvas.getContext('2d')
    this.fg = fgCanvas.getContext('2d')
    // ── Coordinate pipeline: year → axis (time warp) → flat stage px → screen
    // (perspective tilt). See sy() / yearAt() / project() / toFlat() below.
    this._warp = null // timeWarp.ts mapping for the current layout
    this._warpK = 0 // its blend (0 = linear axis), driven by the view
    this._view = tiltView(0, 0, 1, 1) // coords.js transform: identity camera + tilt
    this._tilted = false
    this._lk = 0 // arc lift factor this frame (tilt amount × the arc-lift setting)
    this._bgRaw = this.bg
    this._fgRaw = this.fg
    this._bgTilt = new TiltCanvas(this.bg, this._view)
    this._fgTilt = new TiltCanvas(this.fg, this._view)
    this._depth = [] // per person: the pin's flat point (back-to-front order)
    this._order = null
    this._fH = new Float32Array(0) // per family: how high its stem is raised
    this._fgL = new Float32Array(0) // per family: the raised stem's ends (flat)
    this._bLift = new Float32Array(0) // per branch: start height, arch height
    this._spFam = new Int32Array(0) // per person: family its sprout leaves (-1)
    this._bgCanvas = bgCanvas
    this._fgCanvas = fgCanvas
    this.light = false
    this._css = createCssColorCache()

    this.renderer = new THREE.WebGLRenderer({ canvas: glCanvas, alpha: true, antialias: true })
    this.renderer.setClearColor(0x000000, 0)
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5)
    this.renderer.setPixelRatio(this.dpr)
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(0, 1, 0, 1, 0.1, 1000)
    this.camera.position.z = 100
    // Tilted, the world draws through viewCamera (coords.tiltProjection — the
    // graph's board homography over flat stage px); the atmosphere stays a
    // flat screen layer in its own pass (flatScene).
    this.viewCamera = new THREE.Camera()
    this._proj = new THREE.Matrix4()
    this.flatScene = new THREE.Scene()

    this.atlas = new AvatarAtlas(() => {
      this._stylesDirty = true
      this.requestRedraw()
    })
    // Marriage ropes + family stems/bars, then the child branches (pieces
    // between bridges) — all under the lifelines, so a cut branch reads as
    // passing beneath a life — and the Sprout-mode peels just under them.
    this.ribbons = new RibbonLayer({ segments: SEG, renderOrder: 1 })
    this.branches = new RibbonLayer({ segments: SEG, renderOrder: 1.1 })
    this.sprouts = new RibbonLayer({ segments: SEG, renderOrder: 2.9 })
    this.connDots = new DotLayer({ renderOrder: 2 })
    // Lifelines + death caps in the chosen look, with a soft drop-shadow pass
    // under the lit looks and an atmosphere particle field behind everything.
    this.lines = new LifelineLayer({ renderOrder: 3 })
    this.lineShadows = new LifelineLayer({ renderOrder: 0.4, shadow: true })
    this.ambient = new AmbientLayer()
    this.ambient.object3d.renderOrder = -1
    this._ambientOn = false
    this._lookAnim = false
    this.aliveDots = new DotLayer({ renderOrder: 4 })
    this.avatars = new NodeLayer({ atlasTexture: this.atlas.texture, pixelRatio: this.dpr })
    this.avatars.mesh.renderOrder = 5
    // Household rivers mode: the channels' bands, under everything but the air.
    this.riverBands = new RiverLayer({ renderOrder: 0.3 })
    this.scene.add(
      this.ambient.object3d,
      this.lineShadows.object3d,
      this.ribbons.object3d,
      this.branches.object3d,
      this.sprouts.object3d,
      this.connDots.object3d,
      this.lines.object3d,
      this.aliveDots.object3d,
      this.avatars.object3d
    )
    this.scene.add(this.riverBands.object3d)

    // 水墨 Ink theme (setInk): brush-stroke lifelines, blooming drops, the red
    // thread and drifting mist replace the classic layers; see TimelineInk.js.
    this.ink = false
    this._reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    this._fontsOk = false
    this._pigments = new Map() // css colour -> ink pigment rgb
    this._inkBorder = PAPER_RGB
    this._inkWrite = new Map() // person id -> { start, dur } (uTime seconds)
    this._inkWriteM = new Map() // marriage id -> { start, dur }
    this._inkWriteB = new Map() // birth id -> { start, dur }
    this._inkWriteUntil = 0
    this._lastRenderTs = 0
    this.inkDrops = new InkDropLayer({ renderOrder: 0.6 })
    this.inkThreads = new InkThreadLayer({ segments: SEG, renderOrder: 0.8 })
    this.inkStrokes = new InkStrokeLayer({ renderOrder: 3.2 })
    this.mist = new InkMistLayer({ renderOrder: 4.5 })
    this.mist.setLook({ color: hexToRgb01(INK.paperLight), strength: 0.2, bottom: 0.06 })
    this.mist.setMotion(this._reduced ? 0 : 1)
    this.inkThreads.setMotion(this._reduced ? 0 : 1)
    for (const l of [this.inkDrops, this.inkThreads, this.inkStrokes]) l.object3d.visible = false
    this.scene.add(
      this.inkDrops.object3d,
      this.inkThreads.object3d,
      this.inkStrokes.object3d,
      this.mist.object3d
    )

    this._frame = this._frame.bind(this)
    this._glCanvas = glCanvas
    this._onContextLost = (e) => e.preventDefault()
    this._onContextRestored = () => {
      this.markAllDirty()
      this.requestRedraw()
    }
    glCanvas.addEventListener('webglcontextlost', this._onContextLost, false)
    glCanvas.addEventListener('webglcontextrestored', this._onContextRestored, false)
  }

  // ── Coordinate helpers ──────────────────────────────────────────────────────
  sx(laneX) {
    return laneX * this.camera2.ls + this.camera2.tx
  }
  /** FLAT stage y of a (fractional) year — through the time warp. Everything
   *  that places a year on the stage goes through here (or axisOf). */
  sy(year) {
    const a = this._warpK > 0 ? warpYear(this._warp, year, this._warpK) : year
    return (a - this.layout.minYear) * this.camera2.px + Y_PAD + this.camera2.ty
  }

  // ── The coordinate pipeline (time warp + perspective tilt) ──────────────────
  //   year ──axisOf──▶ axis year ──(px, ty)──▶ flat stage px ──project──▶ screen
  // Layout stays in real years; the camera stays linear in axis years; the
  // tilt is the graph's board homography (coords.js) over flat px. Pointer
  // input arrives as screen px and goes back through toFlat(); hit tests,
  // edit tools and ghosts all work in flat px.

  /** Axis position ("axis year") of a real year (the warp; identity when off). */
  axisOf(year) {
    return this._warpK > 0 ? warpYear(this._warp, year, this._warpK) : year
  }
  /** The real year at an axis position (inverse of axisOf). */
  yearOfAxis(a) {
    return this._warpK > 0 ? unwarpYear(this._warp, a, this._warpK) : a
  }
  /** The real (fractional) year at a FLAT stage y. */
  yearAt(y) {
    return this.yearOfAxis((y - this.camera2.ty - Y_PAD) / this.camera2.px + this.layout.minYear)
  }
  /** Local time stretch at a year (1 = linear) — for density hints. */
  stretchAt(year) {
    return this._warpK > 0 ? warpSlope(this._warp, year, this._warpK) : 1
  }
  /** Is the stage laid down as a tilted board right now? */
  get tilted() {
    return this._tilted
  }
  /** The coords.js transform of the stage (identity camera + tilt/yaw). */
  get view() {
    return this._view
  }
  /** flat stage px (lifted h px off the board) → screen { x, y, s }. */
  project(x, y, h = 0) {
    if (!this._tilted) return { x, y, s: 1 }
    return h ? projectLifted(x, y, h, this._view) : projectFlat(x, y, this._view)
  }
  /** screen px → the flat stage point under it (identity when flat). */
  toFlat(x, y) {
    return this._tilted ? unprojectFlat(x, y, this._view) : { x, y }
  }
  /** A point lifted h px off the board, as the flat point the GPU's board
   *  projection draws it at (identity when flat / h = 0). */
  lift(x, y, h) {
    return this._tilted && h ? liftPoint(x, y, h, this._view) : { x, y }
  }
  /** Flat bounds of what the stage shows (the viewport when flat). Draw full-
   *  width rules / bands across these so they reach the tilted horizon. */
  flatBounds() {
    if (!this._tilted) return { x0: 0, y0: 0, x1: this.width || 0, y1: this.height || 0 }
    if (!this._fb) this._fb = visibleFlatBounds(this._view, this.width || 1, this.height || 1, 24)
    return this._fb
  }

  /** Time warp blend (0 = linear … 1 = full strength); the view tweens it. */
  setWarp(k) {
    k = Math.max(0, Math.min(1, +k || 0))
    if (k === this._warpK) return
    this._warpK = k
    this._geomDirty = true
    this.requestRedraw()
  }

  /** Perspective tilt (radians) + yaw (radians); 0, 0 = the flat stage. */
  setTilt(tl, yw) {
    tl = +tl || 0
    yw = +yw || 0
    if (tl === this._view.tl && yw === this._view.yw) return
    this._applyView(tl, yw)
    this.markAllDirty()
    this.requestRedraw()
  }

  _applyView(tl, yw) {
    this._view = tiltView(tl, yw, this.width || 1, this.height || 1)
    this._fb = null
    const was = this._tilted
    this._tilted = isTilted(this._view)
    this._bgTilt.setView(this._view)
    this._fgTilt.setView(this._view)
    this.bg = this._tilted ? this._bgTilt.ctx : this._bgRaw
    this.fg = this._tilted ? this._fgTilt.ctx : this._fgRaw
    if (was !== this._tilted) {
      // The atmosphere stays a flat screen layer under the tilted board.
      const amb = this.ambient.object3d
      ;(this._tilted ? this.scene : this.flatScene).remove(amb)
      ;(this._tilted ? this.flatScene : this.scene).add(amb)
      if (!this._tilted) {
        this._order = null
        this.avatars.setOrder(null)
      }
    }
  }

  /** Write a pin's position (and remember it for the back-to-front order). */
  _pinAt(i, x, y) {
    const d = this._depth[i]
    if (d) {
      d.x = x
      d.y = y
    }
    this.avatars.setPosition(i, x, y)
  }

  // Tilted: paint the standing pins back-to-front (from last frame's spots;
  // a change re-sorts and asks for one more frame).
  _syncDepth() {
    if (!this._tilted) return
    const order = depthOrder(this._depth, this._view, this._order)
    if (!order) return
    this._order = order
    this.avatars.setOrder(order)
    this._geomDirty = true
  }

  // ── Raised family lines (tilted board) ──────────────────────────────────────
  // Sampled curves are lifted in place off the board (flat px out): ropes and
  // co-parent bars arch between the two lives, a couple's stem hangs at its
  // rope's height, branches fall from there onto the child, sprouts peel down
  // onto their lane. Heights grow with reach (timelineTilt.arcHeight), so
  // turning the board separates overlapping arcs by parallax. No-ops when flat.
  _liftRope(pts, x1, x2) {
    if (!this._lk) return
    const H = arcHeight(x2 - x1, this._lk)
    liftSamples(pts, SEG, this._view, (t) => H * ropeLift(t))
  }
  _liftStem(pts, f) {
    const H = this._fH[f]
    if (!this._lk || !H) return
    liftSamples(pts, SEG, this._view, () => H)
    // the raised stem is a straight line again — remember its ends (hover)
    const q = this._fgL
    q[f * 4] = pts[0].x
    q[f * 4 + 1] = pts[0].y
    q[f * 4 + 2] = pts[SEG].x
    q[f * 4 + 3] = pts[SEG].y
  }
  _liftBar(pts, f) {
    const H = this._fH[f]
    if (!this._lk || !H) return
    liftSamples(pts, SEG, this._view, (t) => H * ropeLift(t))
  }
  _liftBranch(pts, j, t0 = 0, t1 = 1) {
    if (!this._lk) return
    const h0 = this._bLift[j * 2],
      hb = this._bLift[j * 2 + 1]
    if (!h0 && !hb) return
    liftSamples(pts, SEG, this._view, (u) => branchLift(t0 + (t1 - t0) * u, h0, hb))
  }
  _liftSprout(pts, i) {
    const f = this._spFam[i]
    const H = f >= 0 ? this._fH[f] : 0
    if (!this._lk || !H) return
    liftSamples(pts, SEG, this._view, (t) => sproutLift(t, H))
  }
  /** A family stem's raised height (0 = on the board). */
  stemLift(f) {
    return this._lk ? this._fH[f] || 0 : 0
  }

  // Per-frame lift parameters from the link geometry (after _linkGeometry).
  _computeLift(st) {
    const L = this.layout
    this._lk = this._tilted ? tiltAmount(this._view) * (st.arcLift ?? 1) : 0
    const F = L.families.length,
      B = L.branches.length
    if (this._fH.length !== F) {
      this._fH = new Float32Array(F)
      this._fgL = new Float32Array(F * 4)
    }
    if (this._bLift.length !== B * 2) this._bLift = new Float32Array(B * 2)
    if (!this._lk) return
    const fg = this._fg,
      bc = this._bc
    for (let f = 0; f < F; f++) {
      const o = f * 8
      this._fH[f] =
        L.families[f].parents.length > 1 ? arcHeight(fg[o + 6] - fg[o + 5], this._lk) : 0
    }
    for (let j = 0; j < B; j++) {
      const o = j * 8
      const b = L.branches[j]
      const h0 = b.parents.length > 1 ? this._fH[b.famIdx] || 0 : 0
      this._bLift[j * 2] = h0
      this._bLift[j * 2 + 1] = Number.isNaN(bc[o])
        ? 0
        : arcHeight(bc[o + 6] - bc[o], this._lk) * 0.5
    }
  }

  resize(w, h) {
    this.width = w
    this.height = h
    this._applyView(this._view.tl, this._view.yw)
    this.renderer.setSize(w, h, false)
    this.camera.left = 0
    this.camera.right = w
    this.camera.top = 0
    this.camera.bottom = h
    this.camera.updateProjectionMatrix()
    this.mist.setSize(w, h, this.dpr)
    this.ambient.resize(w, h)
    for (const c of [this._bgCanvas, this._fgCanvas]) {
      c.width = Math.round(w * this.dpr)
      c.height = Math.round(h * this.dpr)
      c.style.width = w + 'px'
      c.style.height = h + 'px'
    }
    this.markAllDirty()
    this.requestRedraw()
  }

  // The avatar pins are NodeMaterial billboards, sized in screen px through
  // uViewScale (px → clip). The camera is 1 world unit = 1 px, so zoom is 1;
  // without this the material's placeholder scale blows every pin up to cover
  // the whole stage (the "white / pink timeline" bug).
  _syncPinView() {
    // (tilted: far pins haze a little, like the graph's standing nodes)
    const fog = this._tilted ? tiltAmount(this._view) : 0
    this.avatars.setView(this.width || 1, this.height || 1, 1, 0, fog)
  }

  // Draw the GL world: flat through the pixel ortho; tilted through the board
  // projection, after the atmosphere's own flat pass.
  _render() {
    if (!this._tilted) {
      this.renderer.render(this.scene, this.camera)
      return
    }
    const W = Math.max(1, this.width || 1),
      H = Math.max(1, this.height || 1)
    this._proj.set(...tiltProjection(this._view, W, H))
    this.viewCamera.projectionMatrix.copy(this._proj)
    this.viewCamera.projectionMatrixInverse.copy(this._proj).invert()
    this.renderer.render(this.flatScene, this.camera)
    const auto = this.renderer.autoClear
    this.renderer.autoClear = false
    this.renderer.render(this.scene, this.viewCamera)
    this.renderer.autoClear = auto
  }

  setCamera(cam) {
    this.camera2 = cam
    this._fb = null
    this.mist.setView(cam.tx * 0.35, cam.ty * 0.12)
    this._geomDirty = true
    this.requestRedraw()
  }

  setTheme(isLight) {
    this.light = isLight
    this._css.invalidate()
    this.avatars.setThemeUniforms(isLight)
    if (this.ink) this._applyInkUniforms()
    this.markAllDirty()
    this.requestRedraw()
  }

  // ── 水墨 Ink theme ───────────────────────────────────────────────────────────
  /** The view is mounted but not on screen: let the ambience (heartbeat
   *  dots; ink mist, thread sway) idle instead of rendering an invisible canvas. */
  setHidden(h) {
    h = !!h
    if (h === this._hidden) return
    this._hidden = h
    if (!h) this.requestRedraw()
  }

  setInk(on) {
    on = !!on
    if (on === this.ink) return
    this._applyInk(on)
    if (on) this.inkWrite()
  }

  _applyInk(on) {
    this.ink = on
    for (const l of [
      this.lines,
      this.lineShadows,
      this.aliveDots,
      this.ribbons,
      this.branches,
      this.sprouts
    ])
      l.object3d.visible = !on
    for (const l of [this.inkDrops, this.inkThreads, this.inkStrokes]) l.object3d.visible = on
    this.mist.setVisible(on)
    this._css.invalidate()
    if (on) {
      this._applyInkUniforms()
      if (!this._fontsOk) {
        inkFontsReady().then(() => {
          if (this.disposed) return
          this._fontsOk = true
          this.markAllDirty()
          this.requestRedraw()
        })
      }
    } else {
      this.avatars.setThemeUniforms(this.light)
    }
    this.markAllDirty()
    this.requestRedraw()
  }

  // Photo pins in ink: barely any drop shadow, paper-white silhouette glyph.
  _applyInkUniforms() {
    const u = this.avatars.material.uniforms
    u.uShadowStrength.value = 0.04
    u.uSilhouetteColor.value.setRGB(PAPER_RGB[0], PAPER_RGB[1], PAPER_RGB[2])
  }

  /** Brush every lifeline in again, lane by lane, left → right (view enter,
   *  switching into ink). No-op outside ink / under reduced motion. */
  inkWrite() {
    this._inkWrite.clear()
    this._inkWriteM.clear()
    this._inkWriteB.clear()
    this._inkWriteUntil = 0
    if (!this.ink || this._reduced) return
    this._scheduleWrite(this.layout.people, this._timeSec + 0.25)
    this.markAllDirty()
    this.requestRedraw()
  }

  // Write slots for `people` (absolute uTime seconds from t0), plus the
  // threads/flicks that follow once the brushes have passed their year.
  _scheduleWrite(people, t0) {
    if (!people.length) return
    const sched = inkWriteSchedule(people)
    const byId = new Map(this.layout.people.map((p) => [p.id, p]))
    for (const [id, s] of sched) {
      const slot = { start: t0 + s.start, dur: s.dur }
      this._inkWrite.set(id, slot)
      this._inkWriteUntil = Math.max(this._inkWriteUntil, slot.start + slot.dur + 1.4)
    }
    const fresh = new Set(sched.keys())
    const arrive = (id, year) => {
      const s = this._inkWrite.get(id)
      const p = byId.get(id)
      return s && p && fresh.has(id) ? writeArrival(s, p.birthYear, p.endYear, year) : null
    }
    for (const m of this.layout.marriages) {
      const a = arrive(m.ids[0], m.year)
      const b = arrive(m.ids[1], m.year)
      if (a == null && b == null) continue
      const start = Math.max(a ?? 0, b ?? 0) + 0.05
      this._inkWriteM.set(m.id, { start, dur: 0.7 })
      this._inkWriteUntil = Math.max(this._inkWriteUntil, start + 1.2)
    }
    for (const b of this.layout.branches) {
      const child = fresh.has(b.childId) ? this._inkWrite.get(b.childId) : null
      const par = arrive(b.parents[0], b.year)
      if (!child && par == null) continue
      const start = Math.max(par ?? 0, child ? child.start - 0.35 : 0)
      this._inkWriteB.set(b.id, { start, dur: 0.4 })
      if (child && child.start < start + 0.3) child.start = start + 0.3
    }
  }

  setMouseY(y) {
    if (y === this.mouseY) return
    this.mouseY = y
    this._uiDirty = true
    this.requestRedraw()
  }

  setHoverBadge(id) {
    if (id === this.hoverBadgeId) return
    this.hoverBadgeId = id
    this._badgeHoverS = 1
    this._tweening = true
    this._uiDirty = true
    this.requestRedraw()
  }

  setData(layout) {
    this.layout = layout
    this._pById = new Map(layout.people.map((p) => [p.id, p]))
    const n = layout.people.length
    const F = layout.families.length
    const B = layout.branches.length
    const dead = layout.people.reduce((s, p) => s + (p.dead ? 1 : 0), 0)
    this.lines.setCount(n + dead)
    this.lineShadows.setCount(n)
    this.aliveDots.setCount(n - dead)
    // ropes, then two slots per family (stem + co-parent bar)
    this.ribbons.setCount(layout.marriages.length + F * 2)
    this.avatars.setCount(n)
    this._pIdx = new Map(layout.people.map((p, i) => [p.id, i]))
    this._byLane = new Map()
    layout.people.forEach((p, i) => {
      const l = p.lane ?? i
      const list = this._byLane.get(l)
      if (list) list.push(i)
      else this._byLane.set(l, [i])
    })
    if (this._avDy.length !== n) {
      this._avDy = new Float32Array(n)
      this._sp = new Float32Array(n * 8)
      this._lineX = new Float32Array(n)
      this._lineY0 = new Float32Array(n)
      this._lineY1 = new Float32Array(n)
      this._lineHalf = new Float32Array(n)
      this._lineOrder = new Int32Array(n)
    }
    if (this._fg.length !== F * 8) this._fg = new Float32Array(F * 8)
    if (this._bc.length !== B * 8) {
      this._bc = new Float32Array(B * 8)
      this._bPts = new Float32Array(B * PTS)
      this._bHit = new Uint8Array(B)
    }
    this._setPipelineData(layout)
    riverSetData(this, layout) // rivers: polyline caches + extra segment slots

    // Staggered entrance for people never shown before (rise + fade, capped delay).
    const now = this._timeSec
    let newIdx = 0
    for (const p of layout.people) {
      if (this._seen.has(p.id)) continue
      this._seen.add(p.id)
      const start = now + Math.min(newIdx++, 30) * 0.03
      this._pAnim.set(p.id, { op: 0, w: 6, s: 1, start })
      this._entranceUntil = Math.max(this._entranceUntil, start + 0.55)
    }
    const alive = new Set(layout.people.map((p) => p.id))
    for (const id of this._pAnim.keys()) if (!alive.has(id)) this._pAnim.delete(id)
    // Ink: people new to the sheet get brushed in too (the first load included).
    if (this.ink && !this._reduced && newIdx > 0) {
      const fresh = layout.people.filter(
        (p) => !this._inkWrite.has(p.id) && this._pAnim.get(p.id)?.start != null
      )
      this._scheduleWrite(fresh, now + 0.2)
    }

    // Lane glide: people already on screen tween to their (possibly re-ordered)
    // lane; new people start on theirs directly (the entrance covers them).
    for (const p of layout.people) {
      const a = this._laneX.get(p.id)
      if (!a) this._laneX.set(p.id, { x: p.laneX, tx: p.laneX })
      else if (a.tx !== p.laneX) {
        a.tx = p.laneX
        this._tweening = true
      }
    }
    for (const id of this._laneX.keys()) if (!alive.has(id)) this._laneX.delete(id)
    this.markAllDirty()
    this.requestRedraw()
  }

  // Per-layout state of the coordinate pipeline: the time warp (built from
  // when people are born — and, lighter, when they die — over the layout's
  // span), the pins' depth slots and which family each Sprout leaves.
  _setPipelineData(layout) {
    const years = [],
      weights = []
    for (const p of layout.people) {
      years.push(p.birthYear)
      weights.push(1)
      if (p.dead) {
        years.push(p.endYear)
        weights.push(0.35)
      }
    }
    this._warp = buildTimeWarp(years, layout.minYear, layout.maxYear, { weights })
    const n = layout.people.length
    if (this._depth.length !== n) {
      this._depth = Array.from({ length: n }, () => ({ x: 0, y: 0 }))
      this._order = null
      this.avatars.setOrder(null)
    }
    if (this._spFam.length !== n) this._spFam = new Int32Array(n)
    this._spFam.fill(-1)
    for (const b of layout.branches) {
      if (!b.sprout) continue
      const i = this._pIdx.get(b.childId)
      if (i != null) this._spFam[i] = b.famIdx
    }
  }

  /** Pin lanes to exact world x's while the user drags them (Map id → x).
   *  null releases them: they glide from where they were dropped into their
   *  (new) lanes. */
  setLaneOverride(map) {
    const prev = this._laneOverride
    if (prev && !map) {
      for (const [id, x] of prev) {
        const a = this._laneX.get(id)
        if (a) a.x = x
      }
      this._tweening = true
    }
    this._laneOverride = map && map.size ? map : null
    this._geomDirty = true
    this.requestRedraw()
  }

  /** World x of a marriage rope's two ends (rivers: where both lives are in
   *  the wedding year — the confluence). */
  _ropeLanes(m) {
    if (this._rv) return riverRopeLanes(this, m)
    return [this._lane(m.ids[0], m.laneX1), this._lane(m.ids[1], m.laneX2)]
  }

  // Current (possibly mid-glide, or dragged) lane x for a person id.
  _lane(id, fallback) {
    const o = this._laneOverride?.get(id)
    if (o != null) return o
    const a = this._laneX.get(id)
    return a ? a.x : fallback
  }

  /** Screen y of a person's pin: the birth year, or — in Sprout mode — where
   *  the lifeline settles into its lane after peeling out of the stem. */
  avatarY(p) {
    const i = this._pIdx.get(p.id)
    return this.sy(p.birthYear) + (i != null ? this._avDy[i] || 0 : 0)
  }

  /** Live screen position of a person's lifeline ({ x, y0, y1 } | null). */
  personScreen(id) {
    const p = this._pById?.get(id)
    if (!p || !this.layout) return null
    const x = this.sx(this._lane(p.id, p.laneX))
    const y0 = this.avatarY(p)
    // (rivers: x is the birth point; x1 where the life ends up)
    const x1 = p.path ? riverScreenX(this, p, p.endYear) : x
    return { x, x1, y0, y1: Math.max(this.sy(p.endYear), y0 + 8), p }
  }

  /** Redraw the label canvas only (kin pills, reveal frames). */
  markUiDirty() {
    this._uiDirty = true
    this.requestRedraw()
  }

  markStylesDirty() {
    this._stylesDirty = true
    this.requestRedraw()
  }
  markAllDirty() {
    this._geomDirty = true
    this._stylesDirty = true
  }

  requestRedraw() {
    if (this.disposed || this._scheduled) return
    this._scheduled = true
    requestAnimationFrame(this._frame)
  }

  // ── Hit tests (FLAT stage px — the view maps the pointer through toFlat) ────
  personAt(mx, my) {
    if (this._rv) return riverPersonAt(this, mx, my) // rivers: polyline segments
    const { ls } = this.camera2
    const people = this.layout.people
    if (!people.length) return null
    const laneW = LANE_W * ls
    const approx = Math.round((mx - this.sx(X0)) / Math.max(laneW, 0.0001))
    // Tilted: tolerances widen with depth (a far flat px is a small screen px)
    // and pins — upright billboards — are hit on screen.
    const T = this._tilted ? this._view : null
    const S = T ? projectFlat(mx, my, T) : null
    const k = S ? 1 / Math.max(0.08, S.s) : 1
    const reach = S ? Math.min(6, Math.ceil((14 * k) / Math.max(laneW, 1)) + 1) : 1
    for (let dl = -reach; dl <= reach; dl++) {
      const list = this._byLane.get(approx + dl)
      if (!list) continue
      for (const i of list) {
        const p = people[i]
        const x = this.sx(p.laneX)
        const y0 = this.sy(p.birthYear) + (this._avDy[i] || 0)
        const y1 = Math.max(this.sy(p.endYear), y0 + 8)
        if (Math.abs(mx - x) <= 14 * k && my >= y0 - 18 * k && my <= y1 + 12 * k) return p
        if (S ? pinHit(S.x, S.y, x, y0, 17, T) : Math.hypot(mx - x, my - y0) <= 17) return p
      }
    }
    return null
  }

  /**
   * The family line under a screen point: a couple's stem
   * ({ kind: 'family', family }) or a child's branch ({ kind: 'branch',
   * branch }); null = none. Only lines drawn visibly last frame count.
   */
  linkAt(mx, my, tol = 5) {
    // Rivers: no stems or branches — a household channel ({ kind: 'household' }).
    if (this._rv) return riverHouseholdAt(this, mx, my)
    const L = this.layout
    const fg = this._fg
    // Raised (tilted) lines are hit where they were drawn: _fgL / _bPts hold
    // their lifted flat points; the tolerance widens with depth.
    const raised = this._lk > 0
    if (this._tilted) tol /= Math.max(0.08, projectFlat(mx, my, this._view).s)
    for (let f = 0; f < L.families.length; f++) {
      const o = f * 8
      if (!fg[o + 7]) continue
      if ((this._fAnim.get(L.families[f].id)?.op ?? 0) < 0.05) continue
      if (raised && this._fH[f]) {
        const q = this._fgL
        if (distToSegment(mx, my, q[f * 4], q[f * 4 + 1], q[f * 4 + 2], q[f * 4 + 3]) <= tol)
          return { kind: 'family', family: L.families[f] }
        continue
      }
      if (Math.abs(mx - fg[o]) <= tol && my >= fg[o + 1] - tol && my <= fg[o + 2] + tol)
        return { kind: 'family', family: L.families[f] }
    }
    let best = null,
      bestD = tol
    for (let j = 0; j < L.branches.length; j++) {
      if (!this._bHit[j]) continue
      const c = j * 8
      const bc = this._bc
      const x0 = Math.min(bc[c], bc[c + 6]),
        x1 = Math.max(bc[c], bc[c + 6])
      const y0 = Math.min(bc[c + 1], bc[c + 7]),
        y1 = Math.max(bc[c + 1], bc[c + 7])
      if (!raised && (mx < x0 - tol || mx > x1 + tol || my < y0 - tol || my > y1 + tol)) continue
      const d = distToPolyline(this._bPts, j * PTS, SEG + 1, mx, my)
      if (d <= bestD) {
        bestD = d
        best = L.branches[j]
      }
    }
    return best ? { kind: 'branch', branch: best } : null
  }

  badgeAt(mx, my) {
    for (const r of this._badgeRects) {
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return r
    }
    return null
  }

  // ── Style sync / tween ──────────────────────────────────────────────────────
  _syncStyles() {
    const L = this.layout
    this._pVis.length = L.people.length
    const ignite = []
    let auraOn = false
    for (let i = 0; i < L.people.length; i++) {
      const p = L.people[i]
      const v = this.hooks.personVisual(p)
      v.fillRGB = rgb(v.color)
      v.pinRGB = v.pinColor ? rgb(v.pinColor) : v.fillRGB
      // Aura: the pin's ornament colour, and the lifeline look its line effect
      // swaps in for the global one (null = the global look).
      v.auraRGB = v.aura ? rgb(v.aura.color) : null
      v.lineLook = v.auraLine ? lifelineStyleInfo(v.auraLine) : null
      if (v.aura?.id && v.opacity > 0) auraOn = true
      this._pVis[i] = v
      let a = this._pAnim.get(p.id)
      if (!a) {
        a = { op: 0, w: v.lineWidth, s: v.avatarScale }
        this._pAnim.set(p.id, a)
      }
      a.top = v.opacity
      a.tw = v.lineWidth
      a.ts = v.avatarScale
      // Ignition: an ornament that changes after this person's first sync
      // (never on first load or for people just arriving) flares in.
      const key = v.aura?.id ? `${v.aura.ornament ?? v.aura.id}|${v.aura.color}` : 'none'
      if (a.auraKey !== undefined && a.auraKey !== key && key !== 'none' && !this._reduced)
        ignite.push(p)
      else if (key === 'none') a.auraBorn = -1e4
      a.auraKey = key
    }
    this._auraOn = auraOn
    // Cascade the ignitions down the timeline: earliest birth first.
    if (ignite.length) {
      ignite.sort((x, y) => x.birthYear - y.birthYear)
      for (let j = 0; j < ignite.length; j++) {
        const born = this._timeSec + Math.min(j * 0.045, 1.4)
        this._pAnim.get(ignite[j].id).auraBorn = born
        this._igniteUntil = Math.max(this._igniteUntil, born + AURA_IGNITE_DUR)
      }
    }
    this._mVis.length = L.marriages.length
    const seenM = new Set()
    for (let i = 0; i < L.marriages.length; i++) {
      const m = L.marriages[i]
      const v = this.hooks.marriageVisual(m)
      v.colorRGB = rgb(v.color)
      this._mVis[i] = v
      seenM.add(m.id)
      let a = this._mAnim.get(m.id)
      if (!a) {
        a = { op: 0, w: v.width }
        this._mAnim.set(m.id, a)
      }
      a.top = v.lineOpacity
      a.tw = v.width
    }
    for (const id of this._mAnim.keys()) if (!seenM.has(id)) this._mAnim.delete(id)
    const sync = (list, vis, anim, hook) => {
      vis.length = list.length
      const seen = new Set()
      for (let i = 0; i < list.length; i++) {
        const it = list[i]
        const v = hook(it)
        v.colorRGB = rgb(v.color)
        vis[i] = v
        seen.add(it.id)
        let a = anim.get(it.id)
        if (!a) {
          a = { op: 0, w: v.width }
          anim.set(it.id, a)
        }
        a.top = v.lineOpacity
        a.tw = v.width
      }
      for (const id of anim.keys()) if (!seen.has(id)) anim.delete(id)
    }
    sync(L.branches, this._bVis, this._bAnim, this.hooks.birthVisual)
    sync(L.families, this._fVis, this._fAnim, this.hooks.familyVisual)
  }

  _step(dt) {
    let moving = false
    const step2 = (a) => {
      a.op = approach(a.op, a.top, dt)
      a.w = approach(a.w, a.tw, dt)
      if (Math.abs(a.op - a.top) > TWEEN_EPS || Math.abs(a.w - a.tw) > TWEEN_EPS) moving = true
    }
    for (const a of this._pAnim.values()) {
      step2(a)
      a.s = approach(a.s, a.ts, dt)
      if (Math.abs(a.s - a.ts) > TWEEN_EPS) moving = true
    }
    for (const a of this._mAnim.values()) step2(a)
    for (const a of this._bAnim.values()) step2(a)
    for (const a of this._fAnim.values()) step2(a)
    for (const a of this._laneX.values()) {
      a.x = approach(a.x, a.tx, dt, 0.18)
      // Lanes travel ~150px; snap well before the sub-pixel tail so the
      // full-geometry frames stop as soon as the glide is invisible.
      if (Math.abs(a.x - a.tx) < 0.05) a.x = a.tx
      else moving = true
    }
    if (this.hoverBadgeId != null) {
      this._badgeHoverS = approach(this._badgeHoverS, 1.08, dt)
      if (Math.abs(this._badgeHoverS - 1.08) > TWEEN_EPS) moving = true
    }
    return moving
  }

  // Entrance progress for a person: { e (0..1 eased), yOff }.
  _entrance(a) {
    if (!a.start) return { e: 1, yOff: 0 }
    const t = (this._timeSec - a.start) / 0.55
    if (t >= 1) {
      a.start = null
      return { e: 1, yOff: 0 }
    }
    const e = easeOutCubic(Math.max(0, t))
    return { e, yOff: (1 - e) * 16 }
  }

  // A pin's aura fields for NodeLayer.setStyle (shared with the ink writer).
  // auraBorn rides the avatars' uTime clock; -1e4 = settled (no ignition).
  _auraStyle(v, a) {
    const au = v.aura
    if (!au || !au.id) return { auraId: 0 }
    return {
      auraId: au.id,
      auraK: au.k ?? 1,
      auraBorn: this._settleAuras || a?.auraBorn == null ? -1e4 : a.auraBorn,
      auraRGB: v.auraRGB
    }
  }

  // ── Family links (screen space; every geometry frame, classic + ink) ───────
  // Fills the per-frame link buffers from the live lanes:
  //   _fg    family f: [stemX, top, bottom, ropeY, barY, xa, xb, on] — a
  //          couple's stem hangs from the low point of their marriage rope (or
  //          a co-parent bar when unmarried) down to its lowest branch
  //   _avDy / _sp   Sprout mode: how far below its birth person i's pin sits,
  //          and the S-curve its lifeline peels out of the stem along
  //   _bc    branch j's cubic: leaves the stem above the birth (higher the
  //          further it reaches, so siblings nest instead of stacking) and
  //          lands level on the child's lane; NaN when the child sprouts
  _linkGeometry(conn, tYear) {
    const L = this.layout
    const fg = this._fg,
      bc = this._bc,
      sp = this._sp,
      avDy = this._avDy
    const straight = conn === 'straight'
    const shown = (year) => tYear == null || year <= tYear
    const laneSx = (id) => {
      const p = this._pById.get(id)
      return this.sx(this._lane(id, p ? p.laneX : 0))
    }
    for (let f = 0; f < L.families.length; f++) {
      const fam = L.families[f]
      const o = f * 8
      const xa = laneSx(fam.parents[0])
      const xb = fam.parents.length > 1 ? laneSx(fam.parents[1]) : xa
      let ropeY = NaN,
        barY = NaN
      if (fam.parents.length > 1) {
        const m = fam.marriageIdx >= 0 ? L.marriages[fam.marriageIdx] : null
        // the rope's low point (see the marriage quadratic below)
        if (m)
          ropeY = this.sy(m.year) + (straight ? 0 : Math.min(34, 12 + Math.abs(xb - xa) * 0.05))
        else barY = this.sy(fam.firstYear) - 18
      }
      fg[o] = (xa + xb) / 2
      fg[o + 1] = Infinity
      fg[o + 2] = -Infinity
      fg[o + 3] = ropeY
      fg[o + 4] = barY
      fg[o + 5] = xa
      fg[o + 6] = xb
      fg[o + 7] = 0
    }
    const extend = (f, y) => {
      const o = f * 8
      if (y < fg[o + 1]) fg[o + 1] = y
      if (y > fg[o + 2]) fg[o + 2] = y
    }
    avDy.fill(0)
    for (let i = 0; i < L.people.length; i++) sp[i * 8] = NaN
    // Sprouts first: a single parent's branch has to leave below that
    // parent's own (possibly sprouted) pin.
    for (const b of L.branches) {
      if (!b.sprout) continue
      const i = this._pIdx.get(b.childId)
      if (i == null) continue
      const p = L.people[i]
      const sx = fg[b.famIdx * 8]
      const x = this.sx(this._lane(p.id, p.laneX))
      const y0 = this.sy(p.birthYear)
      // (a newborn still peels out properly: its pin may sit past the now line)
      const dy = Math.min(sproutDrop(x - sx), Math.max(18, this.sy(p.endYear) - y0 - 4))
      avDy[i] = dy
      const c = sproutCubic(sx, y0, x, dy)
      for (let k = 0; k < 8; k++) sp[i * 8 + k] = c[k]
      if (shown(p.birthYear)) extend(b.famIdx, y0)
    }
    for (let j = 0; j < L.branches.length; j++) {
      const b = L.branches[j]
      const o = j * 8
      if (b.sprout) {
        bc[o] = NaN
        continue
      }
      const f = b.famIdx * 8
      const sx = fg[f]
      const cx = laneSx(b.childId)
      const y = this.sy(b.year)
      let lim = -Infinity
      let yDep
      if (b.parents.length > 1) {
        const anchor = Number.isNaN(fg[f + 3]) ? fg[f + 4] : fg[f + 3]
        // born by the wedding: the branch springs straight from the rope
        if (y <= anchor + 9) yDep = anchor
        else lim = anchor + 3
      } else {
        const pi = this._pIdx.get(b.parents[0])
        if (pi != null) lim = this.sy(L.people[pi].birthYear) + avDy[pi] + 18
      }
      if (yDep === undefined) yDep = Math.min(y - 6, Math.max(y - branchDrop(cx - sx), lim))
      const c = branchCubic(sx, yDep, cx, y, straight)
      for (let k = 0; k < 8; k++) bc[o + k] = c[k]
      if (shown(b.year)) extend(b.famIdx, yDep)
    }
    // A couple's stem reaches from its rope / bar down to its lowest branch.
    for (let f = 0; f < L.families.length; f++) {
      const o = f * 8
      if (L.families[f].parents.length < 2 || fg[o + 2] === -Infinity) continue
      const anchor = Number.isNaN(fg[o + 3]) ? fg[o + 4] : fg[o + 3]
      if (anchor < fg[o + 1]) fg[o + 1] = anchor
      if (anchor > fg[o + 2]) fg[o + 2] = anchor
      fg[o + 7] = 1
    }
  }

  // ── Geometry (screen-space, rebuilt when camera/styles/data move) ──────────
  _writeBuffers() {
    const L = this.layout
    const entranceActive = this._timeSec < this._entranceUntil
    const scratch = this._curve
    const c = this._colors()
    const accentRGB = rgb(c.accent)
    const surfaceRGB = rgb(c.surface)
    // Time travel: lifelines only grow up to the scrubbed year (null = off), so
    // playing the slider makes lives visibly extend downward frame by frame.
    const tYear = this.hooks.getTimeYear ? this.hooks.getTimeYear() : null

    // People: lifelines + dead caps + alive dots + avatar pins.
    let capI = L.people.length
    let aliveI = 0
    const st = this.hooks.getStyle ? this.hooks.getStyle() : {}
    const look = lifelineStyleInfo(st.lifelineStyle || 'classic')
    const wScale = (st.lifelineWidth ?? 6) / 6
    const aScale = st.avatarSize ?? 1
    const shadows = st.shadows !== false && SHADOWED.has(st.lifelineStyle)
    this.lineShadows.setCount(shadows ? L.people.length + (this._rvExtra || 0) : 0)
    // Animated looks (glass sheen, line effects) keep the loop alive — the
    // global look or any person's aura line.
    let lookAnim = look.n === 2 || look.n >= 10
    const conn = st.connectors || 'curve'
    this._linkGeometry(conn, tYear)
    this._computeLift(st)
    this._syncDepth()
    // Rivers: lifelines are polylines (screen points cached for hit tests).
    const rv = this._rv
    if (rv) buildRiverScreen(this, tYear)
    let segI = rv ? rv.segBase : 0
    const raised = this._lk > 0
    const sp = this._sp
    const lineX = this._lineX,
      lineY0 = this._lineY0,
      lineY1 = this._lineY1,
      lineHalf = this._lineHalf
    const sprouts = [] // person index, width, opacity
    const dots = [] // x, y, radius, rgb, opacity (written once counted)
    for (let i = 0; i < L.people.length; i++) {
      const p = L.people[i]
      const v = this._pVis[i]
      const a = this._pAnim.get(p.id)
      const ent = this._entrance(a)
      const op = a.op * ent.e
      const x = this.sx(this._lane(p.id, p.laneX))
      const endYear = tYear == null ? p.endYear : Math.min(p.endYear, Math.max(tYear, p.birthYear))
      const y0 = this.sy(p.birthYear) + this._avDy[i] + ent.yOff
      const y1 = Math.max(this.sy(endYear) + ent.yOff, y0 + 8)
      // An aura's line effect replaces the global look on this one lifeline.
      const lk = v.lineLook || look
      if (v.lineLook && a.top > 0) lookAnim = true
      const lw = a.w * wScale * (lk.n >= 10 ? 1.5 : lk.n === 1 ? 1.25 : 1)
      const seed = (i * 0.618034) % 1
      const halo = v.halo ?? (v.selected ? 1 : 0)
      if (rv) {
        segI = writeRiverLife(this, i, segI, lw, v.fillRGB, op, lk, seed, halo, shadows)
      } else {
        this.lines.set(i, x, y0, x, y1, lw, v.fillRGB, op * 0.85, lk.n, lk.pad, seed, halo)
        if (shadows) this.lineShadows.set(i, x, y0, x, y1, lw, v.fillRGB, op * 0.85)
      }
      const xe = rv ? riverEndX(this, i) : x
      if (p.dead) {
        // The death cap only lands once time has actually reached the death year.
        const capOp = tYear != null && tYear < p.endYear ? 0 : op * 0.9
        this.lines.set(capI++, xe - 7, y1, xe + 7, y1, 3, v.fillRGB, capOp)
      } else {
        this.aliveDots.set(aliveI++, xe, y1, 4.5, v.fillRGB, op, 1)
      }
      // Where a branch may pass under this life (bridges): its span + gap.
      lineX[i] = x
      lineY0[i] = y0 - 15 * aScale
      lineY1[i] = y1
      lineHalf[i] = op > 0.05 ? lw / 2 + 5 : 0
      if (!Number.isNaN(sp[i * 8]) && op > 0.005) {
        sprouts.push(i, lw, op * 0.85)
        const f = raised ? this._spFam[i] : -1
        const q = f >= 0 ? this.lift(sp[i * 8], sp[i * 8 + 1], this._fH[f]) : null
        dots.push(q ? q.x : sp[i * 8], q ? q.y : sp[i * 8 + 1], 3, v.fillRGB, op)
      }
      const layer = v.imageUrl ? this.atlas.request(p.id, v.imageUrl) : -1
      this._pinAt(i, x, y0)
      this.avatars.setStyle(i, {
        radius: 15 * a.s * aScale,
        fill: v.pinRGB,
        border: v.ring ? rgb(v.ring) : v.selected ? accentRGB : surfaceRGB,
        borderPx: v.ring || v.selected ? 3 : 2.5,
        borderA: 1,
        opacity: op,
        selected: false,
        glow: v.glow || 0,
        avatar: layer >= 1 ? layer : 0,
        ...this._auraStyle(v, a)
      })
    }
    // (rivers: the channels' water flows — never under reduced motion)
    this._lookAnim = lookAnim || (!!rv && !this._reduced)
    writeRiverBands(this, tYear, accentRGB)

    // Sprout mode: each child's lifeline peels out of its parents' stem.
    this.sprouts.setCount(sprouts.length / 3)
    for (let k = 0; k < sprouts.length; k += 3) {
      const i = sprouts[k]
      sampleCubicRange(scratch, SEG, sp.subarray(i * 8, i * 8 + 8))
      this._liftSprout(scratch, i)
      this.sprouts.writeCurve(k / 3, scratch, sprouts[k + 1])
      this.sprouts.writeStyle(k / 3, this._pVis[i].fillRGB, sprouts[k + 2])
    }

    // Marriages: hanging-rope quadratic + a dot on each lifeline.
    for (let j = 0; j < L.marriages.length; j++) {
      const m = L.marriages[j]
      const v = this._mVis[j]
      const a = this._mAnim.get(m.id)
      const [la, lb] = this._ropeLanes(m)
      const x1 = this.sx(Math.min(la, lb)),
        x2 = this.sx(Math.max(la, lb))
      const y = this.sy(m.year)
      // (rivers: a straight tie where the two lives meet)
      const sag = conn === 'straight' || rv ? 0 : Math.min(34, 12 + (x2 - x1) * 0.05)
      sampleQuadratic(scratch, SEG, x1, y, (x1 + x2) / 2, y + sag * 2, x2, y)
      this._liftRope(scratch, x1, x2)
      this.ribbons.writeCurve(j, scratch, a.w)
      this.ribbons.writeStyle(j, v.colorRGB, conn === 'hidden' ? 0 : a.op, v.dashLen, v.dashGap)
      dots.push(x1, y, 3.5, v.colorRGB, v.dotOpacity, x2, y, 3.5, v.colorRGB, v.dotOpacity)
    }

    // Family stems: one drop line per couple, from the rope's low point (or a
    // dashed co-parent bar) down to its last child's branch.
    const mCount = L.marriages.length
    const fg = this._fg
    for (let f = 0; f < L.families.length; f++) {
      const v = this._fVis[f]
      const a = this._fAnim.get(L.families[f].id)
      const o = f * 8
      const on = fg[o + 7] && conn !== 'hidden'
      const sx = fg[o]
      if (on) {
        sampleQuadratic(scratch, SEG, sx, fg[o + 1], sx, fg[o + 1], sx, fg[o + 2])
        this._liftStem(scratch, f)
      } else sampleQuadratic(scratch, SEG, 0, 0, 0, 0, 0, 0)
      this.ribbons.writeCurve(mCount + f * 2, scratch, a.w)
      this.ribbons.writeStyle(mCount + f * 2, v.colorRGB, on ? a.op : 0, v.dashLen, v.dashGap)
      const bar = on && !Number.isNaN(fg[o + 4])
      const by = fg[o + 4]
      if (bar) {
        sampleQuadratic(scratch, SEG, fg[o + 5], by, sx, by, fg[o + 6], by)
        this._liftBar(scratch, f)
      }
      this.ribbons.writeCurve(mCount + f * 2 + 1, scratch, a.w)
      this.ribbons.writeStyle(mCount + f * 2 + 1, v.colorRGB, bar ? a.op : 0, 3, 4)
    }

    // Branches: one per child, cut open into pieces wherever it passes under
    // a lifeline alive at that year (a bridge), so a line visibly carries on
    // past the lives it isn't theirs and only ends at its own child's pin.
    const n = L.people.length
    const order = this._lineOrder
    for (let i = 0; i < n; i++) order[i] = i
    order.sort((x, y) => lineX[x] - lineX[y])
    const firstAtOrAfter = (x) => {
      let lo = 0,
        hi = n
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (lineX[order[mid]] < x) lo = mid + 1
        else hi = mid
      }
      return lo
    }
    // (Raised off a tilted board the branches arch OVER the lives instead.)
    const bridges = conn !== 'hidden' && LANE_W * this.camera2.ls >= 16 && !raised
    const bc = this._bc,
      bPts = this._bPts,
      bHit = this._bHit
    const fb = this.flatBounds()
    const pieces = [] // branch index, t0, t1
    const crossings = []
    for (let j = 0; j < L.branches.length; j++) {
      const b = L.branches[j]
      const o = j * 8
      bHit[j] = 0
      if (Number.isNaN(bc[o])) continue
      const v = this._bVis[j]
      const a = this._bAnim.get(b.id)
      const op = conn === 'hidden' ? 0 : a.op
      if (op < 0.01) continue
      const cub = bc.subarray(o, o + 8)
      const xa = Math.min(cub[0], cub[6]),
        xb = Math.max(cub[0], cub[6])
      if (xb < fb.x0 - 20 || xa > fb.x1 + 20 || cub[7] < fb.y0 - 20 || cub[1] > fb.y1 + 20) continue
      sampleCubicRange(scratch, SEG, cub)
      this._liftBranch(scratch, j)
      for (let k = 0; k <= SEG; k++) {
        bPts[j * PTS + k * 2] = scratch[k].x
        bPts[j * PTS + k * 2 + 1] = scratch[k].y
      }
      bHit[j] = op > 0.05 ? 1 : 0
      if (b.parents.length === 1) dots.push(cub[0], cub[1], 3, v.colorRGB, v.dotOpacity)
      if (!bridges) {
        pieces.push(j, 0, 1)
        continue
      }
      crossings.length = 0
      const child = this._pIdx.get(b.childId)
      const y = cub[7]
      for (let k = firstAtOrAfter(xa + 1); k < n; k++) {
        const q = order[k]
        if (lineX[q] >= xb - 1) break
        if (q === child || lineHalf[q] <= 0) continue
        if (lineY0[q] <= y && y <= lineY1[q]) crossings.push({ x: lineX[q], half: lineHalf[q] })
      }
      for (const [t0, t1] of bridgePieces(cub, crossings)) pieces.push(j, t0, t1)
    }
    this.branches.setCount(pieces.length / 3)
    for (let k = 0; k < pieces.length; k += 3) {
      const j = pieces[k]
      const v = this._bVis[j]
      const a = this._bAnim.get(L.branches[j].id)
      sampleCubicRange(scratch, SEG, bc.subarray(j * 8, j * 8 + 8), pieces[k + 1], pieces[k + 2])
      this._liftBranch(scratch, j, pieces[k + 1], pieces[k + 2])
      this.branches.writeCurve(k / 3, scratch, a.w)
      this.branches.writeStyle(k / 3, v.colorRGB, a.op, v.dashLen, v.dashGap)
    }

    this.connDots.setCount(dots.length / 5)
    for (let k = 0; k < dots.length; k += 5)
      this.connDots.set(k / 5, dots[k], dots[k + 1], dots[k + 2], dots[k + 3], dots[k + 4])

    this.lines.commit()
    this.lineShadows.commit()
    this.aliveDots.commit()
    this.connDots.commit()
    this.ribbons.commit()
    this.branches.commit()
    this.sprouts.commit()
    this.avatars.commitPositions()
    this.avatars.commitStyles()
    return entranceActive
  }

  // CSS-variable colours (cached per theme).
  _colors() {
    return this._css.get()
  }

  // ── Year grid (bg canvas, screen space) ─────────────────────────────────────
  // The year rules on screen. Linear axis: one even step. Warped (timeWarp.ts)
  // each tick takes the step its own stretch of time affords, so stretched
  // decades rule every year while squeezed centuries stay sparse; `ticks`
  // (+ `steps`, the step each was chosen at) always lists them. Labels stay
  // real years.
  _tickInfo() {
    const { px, ty } = this.camera2
    const minYear = this.layout.minYear
    const fb = this.flatBounds()
    const step = TICK_STEPS.find((s) => s * px >= 46) || TICK_STEPS[TICK_STEPS.length - 1]
    const first = Math.floor(((fb.y0 - ty - Y_PAD) / px + minYear) / step) * step
    const last = Math.ceil(((fb.y1 - ty - Y_PAD) / px + minYear) / step) * step
    if (this._warpK > 0 && this._warp && !this._warp.identity) {
      const y0 = this.yearAt(fb.y0),
        y1 = this.yearAt(fb.y1)
      const w = warpTicks(this._warp, Math.floor(y0), Math.ceil(y1), px, this._warpK)
      return { step, first, last, ticks: w.years, steps: w.steps, warped: true }
    }
    const ticks = [],
      steps = []
    for (let yr = first; yr <= last; yr += step) {
      ticks.push(yr)
      steps.push(step)
    }
    return { step, first, last, ticks, steps, warped: false }
  }

  _drawBg() {
    const ctx = this.bg,
      c = this._colors()
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)
    if (!this.layout.people.length) return
    const { step, ticks, steps, warped } = this._tickInfo()
    const bandH = step * this.camera2.px
    const grid = this.hooks.getStyle?.().grid || 'bands'
    // Full-width rules reach the tilted horizon (= the viewport when flat).
    const fb = this.flatBounds()
    const X0b = fb.x0,
      Wb = fb.x1 - fb.x0

    for (let t = 0; t < ticks.length && grid !== 'none'; t++) {
      const yr = ticks[t]
      const y = this.sy(yr)
      const ts = steps[t]
      if (grid === 'bands' && (yr / ts) % 2 === 0) {
        ctx.globalAlpha = 0.025
        ctx.fillStyle = c.t1
        // warped: a band runs to the next rule, wherever that landed
        const h = warped ? this.sy(yr + ts) - y : bandH
        ctx.fillRect(X0b, y, Wb, h)
        ctx.globalAlpha = 1
      }
      ctx.globalAlpha = 0.65
      ctx.strokeStyle = c.border
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(X0b, y)
      ctx.lineTo(fb.x1, y)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // Era bands wash over the year grid (chronicleDraw.js).
    drawChronicleBg(this, ctx)

    const refYear = this.hooks.getRefYear()
    const nowY = this.sy(refYear)
    if (nowY >= fb.y0 - 30 && nowY <= fb.y1 + 30) {
      ctx.globalAlpha = 0.55
      ctx.strokeStyle = c.accent
      ctx.lineWidth = 1.4
      ctx.setLineDash([7, 5])
      ctx.beginPath()
      ctx.moveTo(X0b, nowY)
      ctx.lineTo(fb.x1, nowY)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }

    // Time-travel curtain: everything past the scrubbed year is "the future" —
    // dim the grid there and mark the frontier with a glowing edge. (The world
    // content beyond it is already faded/clamped by the style hooks, so dimming
    // the bg canvas is enough even though it sits behind the GL canvas.)
    const tYear = this.hooks.getTimeYear ? this.hooks.getTimeYear() : null
    if (tYear != null) {
      const cy = this.sy(tYear)
      if (cy < fb.y1) {
        ctx.fillStyle = this.light ? 'rgba(245, 246, 250, 0.6)' : 'rgba(8, 10, 16, 0.55)'
        ctx.fillRect(X0b, Math.max(fb.y0, cy), Wb, fb.y1 - Math.max(fb.y0, cy))
      }
      if (cy >= fb.y0 - 30 && cy <= fb.y1 + 30) {
        ctx.save()
        ctx.globalAlpha = 0.9
        ctx.strokeStyle = c.accent
        ctx.lineWidth = 1.8
        ctx.shadowColor = c.accent
        ctx.shadowBlur = 12
        ctx.beginPath()
        ctx.moveTo(X0b, cy)
        ctx.lineTo(fb.x1, cy)
        ctx.stroke()
        ctx.restore()
      }
    }
  }

  // ── Labels / badges / gutter (fg canvas) ────────────────────────────────────
  _drawFg() {
    const ctx = this.fg,
      c = this._colors(),
      L = this.layout
    const { ls, px } = this.camera2
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)
    this._badgeRects = []
    if (!L.people.length) return
    const font = 'system-ui, sans-serif'
    // Culling bounds (flat): the viewport, or the tilted board's visible part.
    const fb = this.flatBounds()
    // Tilted, billboards (badges, labels, chips) stand upright at their point.
    const T = this._view

    // Marriage badges (skip when zoomed so far out they'd pile into soup).
    if (px >= 2.5) {
      for (let j = 0; j < L.marriages.length; j++) {
        const m = L.marriages[j]
        const v = this._mVis[j]
        const a = this._mAnim.get(m.id)
        const alpha = v.badgeOpacity * Math.min(1, a.op / Math.max(v.lineOpacity, 0.001))
        if (alpha <= 0.02) continue
        const [la, lb] = this._ropeLanes(m)
        const x1 = this.sx(Math.min(la, lb)),
          x2 = this.sx(Math.max(la, lb))
        const cx = (x1 + x2) / 2
        // rivers: the badge rides just above the confluence, clear of the
        // children born inside the channel
        const sag = this._rv ? -16 : Math.min(34, 12 + (x2 - x1) * 0.05)
        const midY = this.sy(m.year) + sag
        if (cx + m.bw < fb.x0 - 20 || cx - m.bw > fb.x1 + 20 || midY < fb.y0 - 30) continue
        if (midY > fb.y1 + 30) continue
        const s = m.id === this.hoverBadgeId ? this._badgeHoverS : 1
        const bw = m.bw * s,
          bh = 22 * s
        // the badge rides its rope's raised midpoint (tilted)
        const g = billboard(
          ctx,
          cx,
          midY,
          () => this._drawBadge(ctx, c, font, m, v, alpha, cx, midY, bw, bh, s),
          this._lk ? arcHeight(x2 - x1, this._lk) : 0
        )
        const rect = frameRectToFlat({ x: cx - bw / 2, y: midY - bh / 2, w: bw, h: bh }, g, T)
        if (g || !this._tilted) this._badgeRects.push({ ...rect, id: m.id, m })
      }
    }

    const st = this.hooks.getStyle ? this.hooks.getStyle() : {}
    // Age ticks: decade notches along each life (10, 20, 30…).
    if (st.ageTicks && px * 10 >= 14) drawAgeTicks(this, ctx, c, font)

    // Person labels — culled to the viewport, truncated harder as lanes tighten,
    // skipped entirely once lanes are too close to read.
    if (150 * ls >= 14 && st.labels !== 'hidden') {
      const compact = st.labels === 'compact'
      const nameLen = compact ? 10 : ls < 0.45 ? 6 : ls < 0.7 ? 10 : 17
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.lineJoin = 'round'
      for (let i = 0; i < L.people.length; i++) {
        const p = L.people[i]
        const x = this.sx(this._lane(p.id, p.laneX))
        if (x < fb.x0 - 160 || x > fb.x1 + 40) continue
        const v = this._pVis[i]
        const a = this._pAnim.get(p.id)
        const ent = this._entrance(a)
        const y0 = this.sy(p.birthYear) + this._avDy[i] + ent.yOff
        if (y0 < fb.y0 - 40 || y0 > fb.y1 + 40) continue
        const alpha = a.op * ent.e
        if (alpha <= 0.02) continue
        billboard(ctx, x, y0, () => {
          ctx.globalAlpha = alpha
          ctx.strokeStyle = c.bg
          ctx.lineWidth = 3
          ctx.font = `700 12.5px ${font}`
          ctx.fillStyle = v.selected ? c.accent : c.t1
          const name = trunc(lifeName(p), nameLen)
          // Beside the avatar: offset by its drawn radius (Style → Portraits).
          const lx = x + 15 * (st.avatarSize ?? 1) * (a.s ?? 1) + 6
          ctx.strokeText(name, lx, y0 - 1)
          ctx.fillText(name, lx, y0 - 1)
          if (ls >= 0.55 && !compact) {
            ctx.font = `600 11px ${font}`
            ctx.fillStyle = c.t3
            const years = lifeYears(p)
            ctx.strokeText(years, lx, y0 + 12)
            ctx.fillText(years, lx, y0 + 12)
          }
          ctx.globalAlpha = 1
        })
      }
    }

    // Kinship lens pills ("aunt", 表姐, farmor…) floating over each avatar.
    const ov = this.hooks.getOverlay ? this.hooks.getOverlay() : null
    if (ov?.kin) drawKinPills(this, ctx, c, font, ov.kin, st)

    // Year gutter on top of everything (tilted: a ruler strip on the board).
    ctx.globalAlpha = 0.88
    ctx.fillStyle = c.surface
    ctx.fillRect(0, fb.y0, GUTTER, fb.y1 - fb.y0)
    ctx.globalAlpha = 1
    const { ticks } = this._tickInfo()
    ctx.font = `600 10.5px ${font}`
    ctx.fillStyle = c.t3
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (const yr of ticks) {
      ctx.fillText(String(yr), GUTTER - 12, this.sy(yr))
    }
    // Warped: a hairline down the gutter's edge shows where time is stretched
    // (accent) or squeezed (dim) — stronger the further from linear.
    if (this._warpK > 0) this._drawStretchHint(ctx, c, fb)

    const chip = (y, draw) => billboard(ctx, 6 + (GUTTER - 14) / 2, y, draw)
    const refYear = this.hooks.getRefYear()
    const nowY = this.sy(refYear)
    if (nowY >= fb.y0 - 30 && nowY <= fb.y1 + 30) {
      chip(nowY, () => {
        ctx.globalAlpha = 0.95
        ctx.fillStyle = c.adim
        ctx.strokeStyle = c.accent
        ctx.lineWidth = 1
        roundRect(ctx, 6, nowY - 10, GUTTER - 14, 20, 7)
        ctx.fill()
        ctx.stroke()
        ctx.globalAlpha = 1
        ctx.fillStyle = c.accent
        ctx.font = `700 10.5px ${font}`
        ctx.textAlign = 'center'
        ctx.fillText(String(refYear), 6 + (GUTTER - 14) / 2, nowY + 1)
      })
    }

    // Time-travel year chip: a filled accent pill riding the curtain edge.
    const tYear = this.hooks.getTimeYear ? this.hooks.getTimeYear() : null
    if (tYear != null) {
      const cy = this.sy(tYear)
      if (cy >= fb.y0 - 30 && cy <= fb.y1 + 30) {
        chip(cy, () => {
          ctx.fillStyle = c.accent
          roundRect(ctx, 6, cy - 10, GUTTER - 14, 20, 7)
          ctx.fill()
          ctx.fillStyle = '#fff'
          ctx.font = `800 10.5px ${font}`
          ctx.textAlign = 'center'
          ctx.fillText(String(Math.floor(tYear)), 6 + (GUTTER - 14) / 2, cy + 1)
        })
      }
    }

    if (this.mouseY != null) {
      const my = this.mouseY
      const year = Math.round(this.yearAt(my))
      ctx.globalAlpha = 0.35
      ctx.strokeStyle = c.t3
      ctx.lineWidth = 1
      ctx.setLineDash([2, 5])
      ctx.beginPath()
      ctx.moveTo(GUTTER, my)
      ctx.lineTo(fb.x1, my)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
      chip(my, () => {
        ctx.fillStyle = c.elevated
        ctx.strokeStyle = c.border
        roundRect(ctx, 6, my - 10, GUTTER - 14, 20, 7)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = c.t1
        ctx.font = `700 10.5px ${font}`
        ctx.textAlign = 'center'
        ctx.fillText(String(year), 6 + (GUTTER - 14) / 2, my + 1)
      })
    }

    // The chronicle: era rail + headers, event pills and participant rings.
    drawChronicleFg(this, ctx, c)
  }

  // A marriage badge pill: icon + year centred as one unit.
  _drawBadge(ctx, c, font, m, v, alpha, cx, midY, bw, bh, s) {
    ctx.globalAlpha = alpha
    ctx.fillStyle = c.surface
    ctx.strokeStyle = v.color
    ctx.lineWidth = 1.2
    if (m.estimated) ctx.setLineDash([3, 3])
    roundRect(ctx, cx - bw / 2, midY - bh / 2, bw, bh, 11 * s)
    ctx.fill()
    ctx.stroke()
    ctx.setLineDash([])
    const ink = m.estimated ? c.t3 : c.t1
    ctx.font = `700 ${10.5 * s}px ${font}`
    const isz = 11 * s,
      gap = 4 * s
    const badge = badgeText(m)
    const tw = ctx.measureText(badge).width
    const left = cx - (isz + gap + tw) / 2
    drawIcon(ctx, m.badgeIcon, left + isz / 2, midY, isz, { color: v.color, lineWidth: 2.3 })
    ctx.fillStyle = ink
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(badge, left + isz + gap, midY + 0.5)
    ctx.globalAlpha = 1
  }

  // Warped axis: a thin strip down the gutter's edge — accent where time is
  // stretched, dim where it is squeezed, fading to nothing where it is linear.
  _drawStretchHint(ctx, c, fb) {
    const x = GUTTER - 3
    const y0 = Math.max(fb.y0, this.sy(this.layout.minYear))
    const y1 = Math.min(fb.y1, this.sy(this.layout.maxYear))
    if (!(y1 > y0)) return
    const step = this._tilted ? 10 : 4
    ctx.save()
    for (let y = y0; y < y1; y += step) {
      const s = this.stretchAt(this.yearAt(y + step / 2))
      const d = s >= 1 ? Math.min(1, (s - 1) / 2) : Math.min(1, (1 - s) / 0.7)
      if (d < 0.04) continue
      ctx.globalAlpha = 0.15 + 0.6 * d
      ctx.fillStyle = s >= 1 ? c.accent : c.t3
      ctx.fillRect(x, y, s >= 1 ? 3 : 1.5, Math.min(step, y1 - y))
    }
    ctx.restore()
  }

  /** The era header / event pill under a screen point (null = none). */
  chronicleAt(mx, my) {
    return chronicleAt(this, mx, my)
  }

  /** Eras or events changed (or the hover did): redraw both 2D layers. */
  refreshChronicle() {
    this._geomDirty = true
    this.requestRedraw()
  }

  // ── Frame loop ──────────────────────────────────────────────────────────────
  _frame(ts) {
    this._scheduled = false
    if (this.disposed) return
    let dt = this._lastT != null ? (ts - this._lastT) / 1000 : 1 / 60
    if (!(dt > 0)) dt = 0
    if (dt > 0.05) dt = 0.05
    this._lastT = ts
    this._timeSec = ts / 1000

    if (this._stylesDirty) {
      this._syncStyles()
      this._stylesDirty = false
      this._tweening = true
      this._geomDirty = true
    }
    if (this._tweening) {
      this._tweening = this._step(dt)
      this._geomDirty = true
    }

    // Ink ambient-only frames (mist drift, thread sway) run at ~30fps.
    if (this.ink && !this._geomDirty && !this._uiDirty && ts - this._lastRenderTs < 30) {
      this.requestRedraw()
      return
    }
    this._lastRenderTs = ts

    let entranceActive = false
    const full = this._geomDirty
    if (full) {
      if (this.ink) {
        const classic = this._timeSec < this._entranceUntil
        entranceActive = writeInkBuffers(this) || classic
      } else entranceActive = this._writeBuffers()
      this._geomDirty = entranceActive || this._tweening
      this.atlas.flush()
      if (this.ink) {
        drawInkBg(this)
        drawInkFg(this)
      } else {
        this._drawBg()
        this._drawFg()
      }
      this._uiDirty = false
    } else if (this._uiDirty) {
      if (this.ink) drawInkFg(this)
      else this._drawFg()
      this._uiDirty = false
    }

    const t = this._timeSec
    const st = this.hooks.getStyle ? this.hooks.getStyle() : {}
    this.ambient.setDark(!this.light)
    this._ambientOn = this.ambient.sync(st, 'quality') && !this.ink
    if (this.ink) this.ambient.object3d.visible = false
    this.ambient.setClock(t, this.camera2.tx, this.camera2.ty)
    this.lines.setFx({
      speed: this._reduced ? 0 : (st.fxSpeed ?? 1),
      glow: st.fxGlow ?? 1,
      light: this.light
    })
    this.lines.material.uniforms.uFxKeep.value = st.fxKeep ? 1 : 0
    this.lineShadows.setFx({ light: this.light })
    this.aliveDots.setTime(t)
    this.connDots.setTime(t)
    this.lines.setTime(t)
    this.riverBands.setTime(this._reduced ? 0 : t)
    this.riverBands.setLight(this.light)
    // Pins: ignitions read uTime; ornaments spin off uDecorTime (still under
    // reduced motion).
    const pu = this.avatars.material.uniforms
    pu.uTime.value = t
    pu.uDecorTime.value = this._reduced ? 0 : t
    if (this.ink) {
      this.inkStrokes.setTime(t)
      this.inkDrops.setTime(t)
      this.inkThreads.setTime(t)
      this.mist.setTime(t)
    }
    this._syncPinView()
    this._render()

    // Keep animating for tweens/entrance; idle at pulse-only frames (uTime + render,
    // no buffer writes) while any living dot needs its heartbeat (ink: while the
    // mist drifts and the red threads sway — never under reduced motion).
    // A hidden (mounted, off-screen) timeline never keeps an ambient loop.
    // Aura ornaments animate like the line looks; ignitions play to the end.
    const ambient =
      !this._hidden &&
      (this.ink
        ? !this._reduced
        : this.aliveDots.count > 0 ||
          this._ambientOn ||
          ((this._lookAnim || this._auraOn) && !this._reduced))
    const igniting = !this._hidden && t < this._igniteUntil
    if (this._tweening || entranceActive || ambient || igniting) this.requestRedraw()
  }

  // ── Image export ────────────────────────────────────────────────────────────
  // Render one fully-settled frame at an arbitrary size/camera and return the
  // three layers (year grid, GL world, labels/gutter) composited into a fresh
  // canvas. Synchronous resize→draw→readback→restore, so the live canvases
  // never show the export frame. `light` temporarily flips the document theme.
  exportFrame({ width, height, camera2, light = null }) {
    const doc = document.documentElement
    const prevTheme = doc.dataset.theme
    const wantLight = light == null ? this.light : light
    const flip = wantLight !== this.light
    const oldW = this.width || 1
    const oldH = this.height || 1
    const oldCam = this.camera2
    const oldDpr = this.dpr
    const oldMouseY = this.mouseY
    const oldHover = this.hoverBadgeId
    const uPR = this.avatars.material.uniforms.uPixelRatio
    const wasInk = this.ink
    const oldWrite = [this._inkWrite, this._inkWriteM, this._inkWriteB]
    // The capture is the flat sheet (fit-all), whatever the live view's tilt.
    const oldTilt = [this._view.tl, this._view.yw]
    try {
      if (this._tilted) this._applyView(0, 0)
      if (flip && wasInk) this._applyInk(false)
      if (wasInk && !flip) {
        // a settled sheet: every stroke fully written, no mist veil
        this._inkWrite = new Map()
        this._inkWriteM = new Map()
        this._inkWriteB = new Map()
        this.mist.setVisible(false)
      }
      if (flip) {
        doc.dataset.theme = wantLight ? 'light' : 'dark'
        this.light = wantLight
        this._css.invalidate()
        this.avatars.setThemeUniforms(wantLight)
      }
      this.dpr = 1
      this.renderer.setPixelRatio(1)
      uPR.value = 1
      this.renderer.setSize(width, height, false)
      this.width = width
      this.height = height
      this.camera.right = width
      this.camera.bottom = height
      this.camera.updateProjectionMatrix()
      for (const c of [this._bgCanvas, this._fgCanvas]) {
        c.width = width
        c.height = height
      }
      this.camera2 = camera2
      this.mouseY = null
      this.hoverBadgeId = null

      // Snap every tween/entrance/lane glide to its target so the capture is settled.
      this._syncStyles()
      for (const a of this._pAnim.values()) {
        a.op = a.top
        a.w = a.tw
        a.s = a.ts
        a.start = null
      }
      for (const a of this._mAnim.values()) {
        a.op = a.top
        a.w = a.tw
      }
      for (const a of [...this._bAnim.values(), ...this._fAnim.values()]) {
        a.op = a.top
        a.w = a.tw
      }
      for (const a of this._laneX.values()) a.x = a.tx
      this._entranceUntil = 0
      // Auras show settled — no half-played ignition shockwave in the capture.
      this._settleAuras = true
      if (this.ink) writeInkBuffers(this)
      else this._writeBuffers()
      this.atlas.flush()
      if (this.ink) {
        drawInkBg(this)
        drawInkFg(this)
      } else {
        this._drawBg()
        this._drawFg()
      }
      this._syncPinView()
      this._render()

      const out = document.createElement('canvas')
      out.width = width
      out.height = height
      const g = out.getContext('2d')
      if (this.ink) {
        // the sheet itself — the live view gets its paper from CSS
        const paper = paperCanvas(512, 512, { tone: INK.paper, fiber: 0.7, seed: 11 })
        g.fillStyle = g.createPattern(paper, 'repeat')
        g.fillRect(0, 0, width, height)
      }
      g.drawImage(this._bgCanvas, 0, 0, width, height)
      g.drawImage(this._glCanvas, 0, 0, width, height)
      g.drawImage(this._fgCanvas, 0, 0, width, height)
      return out
    } finally {
      this._settleAuras = false
      if (flip) {
        if (prevTheme == null) delete doc.dataset.theme
        else doc.dataset.theme = prevTheme
        this.light = !wantLight
        this._css.invalidate()
        this.avatars.setThemeUniforms(!wantLight)
      }
      if (wasInk) {
        this._inkWrite = oldWrite[0]
        this._inkWriteM = oldWrite[1]
        this._inkWriteB = oldWrite[2]
        if (!this.ink) this._applyInk(true)
        else this.mist.setVisible(true)
      }
      this.dpr = oldDpr
      this.renderer.setPixelRatio(oldDpr)
      uPR.value = oldDpr
      this.camera2 = oldCam
      this.mouseY = oldMouseY
      this.hoverBadgeId = oldHover
      this.width = oldW
      this.height = oldH
      this._applyView(oldTilt[0], oldTilt[1])
      this.resize(oldW, oldH) // restores all three canvases + schedules a live redraw
    }
  }

  dispose() {
    this.disposed = true
    this._glCanvas?.removeEventListener('webglcontextlost', this._onContextLost)
    this._glCanvas?.removeEventListener('webglcontextrestored', this._onContextRestored)
    this.atlas.dispose()
    this.ribbons.dispose()
    this.branches.dispose()
    this.sprouts.dispose()
    this.connDots.dispose()
    this.lines.dispose()
    this.lineShadows.dispose()
    this.riverBands.dispose()
    this.ambient.dispose()
    this.aliveDots.dispose()
    this.avatars.dispose()
    this.inkStrokes.dispose()
    this.inkDrops.dispose()
    this.inkThreads.dispose()
    this.mist.dispose()
    this.renderer.dispose()
    // The view unmounts on every view switch — release the GL context eagerly so
    // rapid switching can't exhaust the browser's context pool before GC runs.
    this.renderer.forceContextLoss()
  }
}

// Decade notches along each lifeline — a tick across the line every ten
// years of age, labelled once the lanes are wide enough to read them.
function drawAgeTicks(r, ctx, c, font) {
  const L = r.layout
  const px = r.camera2.px
  const step = px * 10 >= 40 ? 10 : 20
  const fb = r.flatBounds()
  ctx.save()
  ctx.font = `700 8.5px ${font}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < L.people.length; i++) {
    const p = L.people[i]
    const a = r._pAnim.get(p.id)
    if (!a || a.op < 0.05) continue
    const x0 = r.sx(r._lane(p.id, p.laneX))
    if (!p.path && (x0 < fb.x0 - 20 || x0 > fb.x1 + 20)) continue
    for (let age = step; p.birthYear + age < p.endYear; age += step) {
      const y = r.sy(p.birthYear + age)
      if (y < fb.y0 - 10 || y > fb.y1 + 10) continue
      const x = p.path ? riverScreenX(r, p, p.birthYear + age) : x0 // rivers: along the path
      ctx.globalAlpha = a.op * 0.75
      ctx.strokeStyle = c.t3
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(x - 7, y)
      ctx.lineTo(x + 7, y)
      ctx.stroke()
      if (r.camera2.ls >= 0.55) {
        ctx.fillStyle = c.t3
        ctx.fillText(String(age), x + 10, y)
      }
    }
  }
  ctx.restore()
}
