import * as THREE from 'three'
import { NodeLayer } from './NodeLayer.js'
import { LinkLayer } from './LinkLayer.js'
import { AmbientLayer } from './AmbientLayer.js'
import { AvatarAtlas } from './AvatarAtlas.js'
import { TextGuideOverlay } from './TextGuideOverlay.js'
import { Picker } from './Picking.js'
import { approach, TWEEN_EPS } from './tween.js'
import { nodeShapeId, nodeDecorId } from './NodeMaterial.js'
import { shapeAnchor } from './nodeShapes.js'
import { tiltProjection, screenToWorld, depthOrder } from './coords.js'
import { GroundGrid } from './GroundGrid.js'
import { inkLook, inkSealColor, staggerBirth } from '../inkStyle.js'
import { InkBackdrop } from '../InkBackdrop.js'
import { POP_DUR, RING_DUR, popDelay, popLabelReveal } from './popAnim.js'

const NOT_BORN = -1e4 // birth time meaning 'already written / settled'
const WRITE_DUR = 1.1 // brush write-on (s) — LinkMaterial uWriteDur
const BLOOM_DUR = 1.3 // wash bloom (s) — NodeMaterial uBloomDur
// Tilt angle at which the depth haze / ground grid reach full strength.
const TILT_FULL = (50 * Math.PI) / 180

function seedOf(id) {
  let h = 0x811c9dc5
  const s = String(id || '')
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return ((h >>> 0) % 10007) / 10007
}
function reducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

const _col = new THREE.Color()
function rgb(hex) {
  _col.set(hex || '#888')
  return [_col.r, _col.g, _col.b]
}

// Owns the Three.js scene and the render loop. GraphCanvas keeps all state/logic and feeds
// this renderer through `hooks`; the renderer only draws. Frames are on-demand: one is drawn
// when requestRedraw() is called (sim tick, drag, animation, restyle), and the loop keeps
// itself alive frame-to-frame only while a style tween is still in flight — so it idles at
// 0% CPU when nothing is moving.
//
// Style changes (selection, hover glow, Highlights-panel filters, lineage emphasis) are
// tweened, not snapped: per-node opacity/radius/glow and per-link opacity/width/colour/arrow
// ease toward their targets with frame-rate-independent smoothing, reproducing the old d3
// transitions. Positions come straight from the (already animated) node objects each frame.
export class WebGLGraphRenderer {
  constructor({ glCanvas, overlayCanvas, hooks, backdropEl = null }) {
    this.hooks = hooks
    this.disposed = false
    this._scheduled = false
    this._lastT = null
    this.nodeStylesDirty = true
    this.linkStylesDirty = true
    this._nodeTweening = false
    this._linkTweening = false
    this._linkStyleWrite = false
    this.transform = { x: 0, y: 0, k: 1 }

    // Tween state, keyed by id so it survives node/link reordering across data changes.
    this._nodeAnim = new Map() // id -> { op, rad, glow, top, trad, tglow }
    this._nodeCache = [] // index -> node visual (snapped fields + cached rgb)
    this._nodeIds = []
    this._linkAnim = new Map() // id -> { op, w, ar, cr, cg, cb, t* }
    this._linkCacheById = new Map()

    this.renderer = new THREE.WebGLRenderer({ canvas: glCanvas, alpha: true, antialias: true })
    this.renderer.setClearColor(0x000000, 0)
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5)
    this.renderer.setPixelRatio(this.dpr)

    this.scene = new THREE.Scene()
    // `camera` is the flat pixel ortho (screen-space atmosphere); the world is
    // drawn through `viewCamera`, whose projection folds in the optional
    // perspective tilt (coords.tiltProjection — identical to the ortho when flat).
    this.camera = new THREE.OrthographicCamera(0, 1, 0, 1, 0.1, 1000)
    this.camera.position.z = 100
    this.viewCamera = new THREE.Camera()
    this._proj = new THREE.Matrix4()
    this.world = new THREE.Group()
    this.world.matrixAutoUpdate = false
    this.scene.add(this.world)
    this.bgScene = new THREE.Scene()

    // Avatar load completion must rewrite the node's iAvatar attribute → mark styles dirty.
    this.atlas = new AvatarAtlas(() => {
      this.markNodeStylesDirty()
      this.requestRedraw()
    })
    this.nodeLayer = new NodeLayer({ atlasTexture: this.atlas.texture, pixelRatio: this.dpr })
    this.linkLayer = new LinkLayer()
    // Selection halo: a soft wide underlay drawn beneath emphasised links (white on
    // dark, deep slate on light) — the link counterpart of the node focus haze.
    this.haloLayer = new LinkLayer()
    this.haloLayer.object3d.renderOrder = 0
    this._haloRGB = [1, 1, 1]
    this._haloKey = ''
    this._haloVisual = (d) => {
      const a = this._linkAnim.get(d.id)
      return {
        color: this._haloRGB,
        opacity: a ? Math.min(1, a.op * 1.6) * 0.32 * a.h : 0,
        dashLen: 0,
        dashGap: 0,
        // brush mode: a broad wet wash that spreads well past the stroke
        width: this._look.links ? (a ? a.w : 2) * 1.9 + 12 : (a ? a.w : 2) + 7,
        arrowColorRGB: null,
        arrowSize: 0,
        flow: 0,
        fadeTo: 1
      }
    }
    // The floor under the perspective tilt (hidden while flat).
    this.grid = new GroundGrid()
    this.world.add(this.grid.object3d)
    this.world.add(this.haloLayer.object3d)
    this.world.add(this.linkLayer.object3d)
    this.world.add(this.linkLayer.arrowObject3d)
    this.world.add(this.nodeLayer.object3d)

    // Atmosphere: screen-space particle weather behind everything (quality mode).
    this.ambient = new AmbientLayer()
    // Drawn in its own flat pass so weather never tilts with the ground.
    this.bgScene.add(this.ambient.object3d)
    this._hasAmbient = false
    this._quality = 'quality'

    this.overlay = new TextGuideOverlay(overlayCanvas)
    this.overlay.onFontsReady = () => this.requestRedraw()

    // 水墨 ink look: brush strokes / wash roundels / paper + mountain backdrop.
    // Resolved from (graph settings, app theme) every frame; applied on change.
    this._appTheme = 'dark'
    this._look = inkLook(null, 'dark')
    this._lookKey = null
    this._rebirth = false // next style sync re-paints every stroke/wash (write-on)
    this._clock = 0
    this._inkAnimUntil = 0 // keep the loop alive while strokes write / washes bloom
    // Appear-pop: ids queued by popNodes() (→ batch index), consumed by the next
    // style sync; the loop stays alive until the last ring has faded.
    this._pendingPops = new Map()
    this._popUntil = 0
    this._popColor = null
    this.backdrop = backdropEl ? new InkBackdrop(backdropEl) : null
    this.picker = new Picker()

    this._frame = this._frame.bind(this)
    this._labelReveal = (n) => {
      const a = this._nodeAnim.get(n.id)
      if (!a || a.born < -100) return 1
      return Math.max(0, Math.min(1, (this._clock - a.born - 0.45) / 0.7))
    }
    this._curLinkVisual = this._curLinkVisual.bind(this)
    this._onContextLost = (e) => e.preventDefault()
    this._onContextRestored = () => {
      this.setData(this.hooks.getNodes(), this.hooks.getLinks())
      this.markAllDirty()
      this.requestRedraw()
    }
    glCanvas.addEventListener('webglcontextlost', this._onContextLost, false)
    glCanvas.addEventListener('webglcontextrestored', this._onContextRestored, false)
    this._glCanvas = glCanvas

    // Ambient flow / selection pulse pause with the tab; restart when it returns.
    this._onVisibility = () => {
      if (
        document.visibilityState === 'visible' &&
        (this._hasFlow || this._hasNodeGlow || this._hasAmbient || this._decorAnim)
      )
        this.requestRedraw()
    }
    document.addEventListener('visibilitychange', this._onVisibility)
  }

  resize(w, h) {
    this.width = w
    this.height = h
    this.renderer.setSize(w, h, false)
    this.camera.left = 0
    this.camera.right = w
    this.camera.top = 0
    this.camera.bottom = h
    this.camera.updateProjectionMatrix()
    this.overlay.resize(w, h, this.dpr)
    this.ambient.resize(w, h)
    this.requestRedraw()
  }

  // Performance mode trims the backing-store resolution (the biggest lever on
  // low-end GPUs); quality mode renders at full device pixels. Applied lazily
  // from the settings each frame so the toggle is instant.
  _applyQuality(quality) {
    if (quality === this._quality) return
    this._quality = quality
    const raw = window.devicePixelRatio || 1
    this.dpr = quality === 'performance' ? Math.min(raw, 1.25) : Math.min(raw, 2.5)
    this.renderer.setPixelRatio(this.dpr)
    this.nodeLayer.material.uniforms.uPixelRatio.value = this.dpr
    if (this.width) {
      this.renderer.setSize(this.width, this.height, false)
      this.overlay.resize(this.width, this.height, this.dpr)
    }
  }

  setData(nodes, links) {
    this.nodes = nodes
    this.links = links
    this._order = null
    this.nodeLayer.setCount(nodes.length)
    this.nodeLayer.setOrder(null)
    this.linkLayer.setLinks(links)
    // Force the halo underlay to re-sync against the new data. Must be a value
    // no real key can equal: '' is the key for "no halo links", so resetting to ''
    // left a deleted selection's halo drawn (stale instance count) forever.
    this._haloKey = null
    this.markAllDirty()
    this.picker.invalidate()
    this.requestRedraw()
  }

  markNodeStylesDirty() {
    this.nodeStylesDirty = true
  }

  /** People who just appeared: they spring in (GPU scale) with a ripple ring
   *  in `color` and their name fading in after. A batch is staggered. */
  popNodes(ids, color) {
    if (!ids?.length || reducedMotion()) return
    ids.forEach((id, i) => this._pendingPops.set(id, i))
    this._popColor = color || null
    this.nodeStylesDirty = true
    this.requestRedraw()
  }

  // Overlay hand-off while a pop runs: the live rings and the name reveal.
  _activePops() {
    const out = []
    const nodes = this.nodes || []
    for (const n of nodes) {
      const a = this._nodeAnim.get(n.id)
      if (!a || !(a.pop > -100)) continue
      const k = (this._clock - a.pop) / RING_DUR
      if (k >= 0 && k < 1) out.push({ n, k })
    }
    return out
  }
  _popReveal(n) {
    const a = this._nodeAnim.get(n.id)
    if (!a || !(a.pop > -100)) return 1
    return popLabelReveal((this._clock - a.pop) / POP_DUR)
  }
  markLinkStylesDirty() {
    this.linkStylesDirty = true
  }
  markAllDirty() {
    this.nodeStylesDirty = true
    this.linkStylesDirty = true
  }

  setCamera(t) {
    this.transform = t
    this.overlay.setCamera(t)
    this.backdrop?.setCamera(t)
    this.requestRedraw()
  }

  // `theme` is the app theme string ('dark' | 'light' | 'ink'); optional for
  // callers that only know light/dark.
  setTheme(isLight, theme) {
    this._appTheme = theme || (isLight ? 'light' : 'dark')
    this._lookKey = null // re-resolve the ink look (uniforms, halo, overlay) next frame
    this.nodeLayer.setThemeUniforms(isLight)
    this._haloRGB = isLight ? [0.16, 0.2, 0.3] : [1, 1, 1]
    this.overlay.setTheme(isLight)
    this.ambient.setDark(!isLight)
    this.grid.setTheme(isLight, null)
    this.markAllDirty()
    this.requestRedraw()
  }

  _syncDepthOrder(nodes, gs) {
    const t = this.transform
    const standing = !!(t.tl || t.yw) || shapeAnchor(gs.nodeShape).lift > 0
    if (!standing) {
      if (this._order) {
        this._order = null
        this.nodeLayer.setOrder(null)
        this._stepNodes(0) // rewrite styles into index order
      }
      return
    }
    const vt = t.tl || t.yw ? { ...t, vw: this.width, vh: this.height } : t
    const order = depthOrder(nodes, vt, this._order)
    if (!order) return // still back-to-front
    this._order = order
    this.nodeLayer.setOrder(order)
    this._stepNodes(0) // styles follow their nodes into the new slots
  }

  // Push the camera (incl. perspective tilt) to the view projection, the node
  // billboards, the depth haze and the ground grid. Returns the tilt fraction.
  _applyView(t, width, height, gs) {
    const W = Math.max(1, width),
      H = Math.max(1, height)
    const vt = t.tl || t.yw ? { ...t, vw: W, vh: H } : t
    this._proj.set(...tiltProjection(vt, W, H))
    this.viewCamera.projectionMatrix.copy(this._proj)
    this.viewCamera.projectionMatrixInverse.copy(this._proj).invert()
    const amount = Math.min(1, Math.abs(t.tl || 0) / TILT_FULL)
    this.nodeLayer.setView(W, H, t.k, shapeAnchor(gs.nodeShape).lift, amount)
    this.linkLayer.material.uniforms.uFog.value = amount
    this.haloLayer.material.uniforms.uFog.value = amount
    if (amount > 0.002) {
      const c = screenToWorld(W / 2, H / 2, vt)
      const sx = t.sx ?? 1,
        sy = t.sy ?? 1
      this.grid.update(amount, t.k, c.x * sx, c.y * sy, (Math.max(W, H) * 3.2) / t.k)
    } else this.grid.update(0)
    return amount
  }

  // Resolve the 水墨 look for these settings + theme and push it to every layer when
  // it changes. Turning brush strokes / washes on re-paints the graph (write-on).
  _applyLook(gs) {
    const look = inkLook(gs, this._appTheme)
    const key = `${look.links}|${look.nodes}|${look.backdrop}|${look.mode}|${this._appTheme}`
    if (key === this._lookKey) return look
    const prev = this._look
    this._lookKey = key
    this._look = look
    this.nodeLayer.setInkUniforms(look.nodes, look.mode, inkSealColor(look.mode))
    this.linkLayer.brush = look.links
    this.linkLayer.material.uniforms.uBrush.value = look.links ? 1 : 0
    this.haloLayer.material.uniforms.uBrush.value = look.links ? 2 : 0
    // In ink the selection halo is a pale cinnabar wash under the chosen bonds.
    if (look.links || look.nodes) {
      this._haloRGB =
        look.mode === 'moon'
          ? [0.83, 0.4, 0.33]
          : look.mode === 'paper'
            ? [0.7, 0.21, 0.17]
            : this._haloRGB
    } else {
      this._haloRGB = this._appTheme === 'dark' ? [1, 1, 1] : [0.16, 0.2, 0.3]
    }
    this.overlay.setInk(look.links || look.nodes ? look.mode : null)
    this.grid.setTheme(this._appTheme !== 'dark', look.links || look.nodes ? look.mode : null)
    this.backdrop?.setLook(look, this._appTheme)
    if ((look.links && !prev.links) || (look.nodes && !prev.nodes)) this._rebirth = true
    this.markAllDirty()
    return look
  }

  /** Re-paint every stroke and wash from scratch (brush write-on + wash bloom). */
  repaintInk() {
    this._rebirth = true
    this.markAllDirty()
    this.requestRedraw()
  }

  invalidatePicker() {
    this.picker.invalidate()
  }
  pickNode(wx, wy, radius) {
    return this.picker.pickNode(wx, wy, this.nodes || [], radius)
  }
  pickLink(wx, wy, gs, tol) {
    return this.picker.pickLink(wx, wy, this.links || [], gs, tol)
  }

  requestRedraw() {
    if (this.disposed || this._scheduled) return
    this._scheduled = true
    requestAnimationFrame(this._frame)
  }

  // ── Node styling / tween ────────────────────────────────────────────────────
  _syncNodeStyles() {
    const nodes = this.nodes || [],
      visual = this.hooks.nodeVisual
    this._nodeCache.length = nodes.length
    this._nodeIds.length = nodes.length
    const seen = new Set()
    this._hasNodeGlow = false // any selected/glowing node keeps the pulse loop alive
    // Ink washes bloom in: new nodes (or all of them on a re-paint), staggered.
    const bloom = this._look.nodes && !reducedMotion()
    const rebirth = this._rebirth
    let fresh = 0
    if (bloom) for (const n of nodes) if (rebirth || !this._nodeAnim.has(n.id)) fresh++
    let fi = 0
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i],
        v = visual(n)
      const layer = v.imageUrl ? this.atlas.request(n.id, v.imageUrl) : -1
      v.avatar = layer >= 1 ? layer : 0 // 0 = silhouette fallback
      v.fillRGB = rgb(v.fill)
      v.borderRGB = rgb(v.border)
      this._nodeCache[i] = v
      this._nodeIds[i] = n.id
      seen.add(n.id)
      let a = this._nodeAnim.get(n.id)
      const isNew = !a
      if (!a) {
        a = { op: 0, rad: v.radius, glow: 0, born: NOT_BORN }
        this._nodeAnim.set(n.id, a)
      } // new -> fade in
      if (bloom && (isNew || rebirth)) {
        a.born = staggerBirth(this._clock, fi++, fresh, { step: 0.05, maxSpread: 0.9 })
        this._inkAnimUntil = Math.max(this._inkAnimUntil, a.born + BLOOM_DUR)
      } else if (!this._look.nodes) a.born = NOT_BORN
      v.born = a.born
      const pi = this._pendingPops.get(n.id)
      if (pi != null) {
        a.pop = this._clock + popDelay(pi)
        this._popUntil = Math.max(this._popUntil, a.pop + Math.max(POP_DUR, RING_DUR))
      }
      a.top = v.opacity
      a.trad = v.radius
      a.tglow = v.glow
      if (v.glow > 0.001) this._hasNodeGlow = true
    }
    for (const id of this._nodeAnim.keys()) if (!seen.has(id)) this._nodeAnim.delete(id)
    this._pendingPops.clear()
  }

  _stepNodes(dt) {
    const nodes = this.nodes || []
    if (this._nodeCache.length !== nodes.length) return false
    let moving = false
    for (let i = 0; i < nodes.length; i++) {
      const v = this._nodeCache[i],
        a = this._nodeAnim.get(this._nodeIds[i])
      if (!a) continue
      a.op = approach(a.op, a.top, dt)
      a.rad = approach(a.rad, a.trad, dt)
      a.glow = approach(a.glow, a.tglow, dt)
      if (
        Math.abs(a.op - a.top) > TWEEN_EPS ||
        Math.abs(a.rad - a.trad) > TWEEN_EPS ||
        Math.abs(a.glow - a.tglow) > TWEEN_EPS
      )
        moving = true
      this.nodeLayer.setStyle(i, {
        radius: a.rad,
        fill: v.fillRGB,
        border: v.borderRGB,
        borderPx: v.borderPx,
        borderA: v.borderA,
        opacity: a.op,
        selected: v.selected,
        glow: a.glow,
        avatar: v.avatar,
        born: v.born,
        pop: a.pop
      })
    }
    this.nodeLayer.commitStyles()
    return moving
  }

  // ── Link styling / tween ────────────────────────────────────────────────────
  _syncLinkStyles() {
    const links = this.links || [],
      visual = this.hooks.linkVisual
    this._linkCacheById.clear()
    const seen = new Set()
    this._hasFlow = false // any flowing dash keeps the ambient loop alive
    // Brush strokes write themselves on: new links (or all on a re-paint), after
    // the washes have started to bloom, as a staggered wave.
    const write = this._look.links && !reducedMotion()
    const rebirth = this._rebirth
    let fresh = 0
    if (write) for (const d of links) if (rebirth || !this._linkAnim.has(d.id)) fresh++
    const delay = this._look.nodes && fresh > 1 ? 0.35 : 0
    let fi = 0
    for (const d of links) {
      const v = visual(d)
      v.colorRGB = rgb(v.colorHex)
      v.arrowRGB = v.arrowColor ? rgb(v.arrowColor) : null
      // Flowing dashes and animated line effects keep the clock running.
      if (v.flow || (v.fx && !this._look.links)) this._hasFlow = true
      this._linkCacheById.set(d.id, v)
      seen.add(d.id)
      let a = this._linkAnim.get(d.id)
      const isNew = !a
      // New links fade in from 0 opacity (matching the old node-group fade); size/colour snap.
      if (!a)
        a = {
          op: 0,
          w: v.width,
          ar: v.arrowSize,
          cr: v.colorRGB[0],
          cg: v.colorRGB[1],
          cb: v.colorRGB[2],
          h: 0,
          born: NOT_BORN,
          seed: seedOf(d.id)
        }
      if (write && (isNew || rebirth)) {
        a.born = staggerBirth(this._clock, fi++, fresh, { delay, step: 0.04, maxSpread: 1.2 })
        if (isNew) a.op = v.opacity // the write-on is the entrance — no fade too
        this._inkAnimUntil = Math.max(this._inkAnimUntil, a.born + WRITE_DUR)
      } else if (!this._look.links) a.born = NOT_BORN
      a.top = v.opacity
      a.tw = v.width
      a.tar = v.arrowSize
      a.tcr = v.colorRGB[0]
      a.tcg = v.colorRGB[1]
      a.tcb = v.colorRGB[2]
      a.th = v.halo || 0
      this._linkAnim.set(d.id, a)
    }
    for (const id of this._linkAnim.keys()) if (!seen.has(id)) this._linkAnim.delete(id)
  }

  _stepLinks(dt) {
    let moving = false
    for (const a of this._linkAnim.values()) {
      a.op = approach(a.op, a.top, dt)
      a.w = approach(a.w, a.tw, dt)
      a.ar = approach(a.ar, a.tar, dt)
      a.cr = approach(a.cr, a.tcr, dt)
      a.cg = approach(a.cg, a.tcg, dt)
      a.cb = approach(a.cb, a.tcb, dt)
      a.h = approach(a.h, a.th ?? 0, dt)
      if (
        Math.abs(a.op - a.top) > TWEEN_EPS ||
        Math.abs(a.w - a.tw) > TWEEN_EPS ||
        Math.abs(a.ar - a.tar) > TWEEN_EPS ||
        Math.abs(a.cr - a.tcr) > TWEEN_EPS ||
        Math.abs(a.cg - a.tcg) > TWEEN_EPS ||
        Math.abs(a.cb - a.tcb) > TWEEN_EPS ||
        Math.abs(a.h - (a.th ?? 0)) > TWEEN_EPS
      )
        moving = true
    }
    return moving
  }

  // Tweened per-link visual consumed by LinkLayer (geometry width/arrows + styles colour/opacity).
  _curLinkVisual(d) {
    const a = this._linkAnim.get(d.id),
      v = this._linkCacheById.get(d.id)
    if (!a || !v)
      return {
        color: [0.5, 0.5, 0.5],
        opacity: 0,
        dashLen: 0,
        dashGap: 0,
        width: 1,
        arrowColorRGB: null,
        arrowSize: 0
      }
    return {
      color: [a.cr, a.cg, a.cb],
      opacity: a.op,
      dashLen: v.dashLen,
      dashGap: v.dashGap,
      width: a.w,
      arrowColorRGB: v.arrowRGB,
      arrowSize: a.ar,
      flow: v.flow || 0,
      fadeTo: v.fadeTo,
      born: a.born,
      seed: a.seed,
      fx: v.fx || 0,
      fxPad: v.fxPad || 1
    }
  }

  _frame(ts) {
    this._scheduled = false
    if (this.disposed) return
    let dt = this._lastT != null ? (ts - this._lastT) / 1000 : 1 / 60
    if (!(dt > 0)) dt = 0
    if (dt > 0.05) dt = 0.05 // clamp so a stale frame after idle can't cause a jump
    this._lastT = ts

    const nodes = this.nodes || [],
      links = this.links || []
    const gs = this.hooks.getSettings()
    // The shader clock advances by the (clamped) frame delta rather than wall time:
    // a main-thread stall (theme switch, art generation) pauses a write-on or a
    // bloom instead of letting it finish unseen. Flow / pulse only need continuity.
    this._clock += dt
    const look = this._applyLook(gs)

    // ── Aesthetics: quality mode, node shape/decor uniforms, atmosphere ──────
    const quality = gs.renderQuality === 'performance' ? 'performance' : 'quality'
    this._applyQuality(quality)
    const nu = this.nodeLayer.material.uniforms
    nu.uShape.value = nodeShapeId(gs.nodeShape)
    nu.uDecor.value = nodeDecorId(gs.nodeDecor)
    nu.uDecorColor.value.set(gs.decorColor || '#d4af37')
    // Decor ornaments animate only in quality mode; frozen (t=0) keeps them
    // as static jewellery in performance mode.
    this._decorAnim =
      quality === 'quality' && nodeDecorId(gs.nodeDecor) > 0 && gs.nodeDecor !== 'enso'
    // Brush strokes stop short of each roundel so they breathe (留白).
    const gapR = (gs.nodeRadius || 22) * (look.nodes ? 1.16 : 1.04)
    this.linkLayer.material.uniforms.uNodeR.value = gapR
    this.haloLayer.material.uniforms.uNodeR.value = gapR
    this._hasAmbient = this.ambient.sync(gs, quality)

    if (this.nodeStylesDirty) {
      this._syncNodeStyles()
      this.nodeStylesDirty = false
      this._nodeTweening = true
    }
    if (this.linkStylesDirty) {
      this._syncLinkStyles()
      this.linkStylesDirty = false
      this._linkTweening = true
      this._linkStyleWrite = true
    }
    this._rebirth = false

    if (this._nodeTweening) this._nodeTweening = this._stepNodes(dt)

    // Per-axis view stretch (default 1): baked into positions here so node discs
    // and link strokes keep uniform screen size while the layout spreads/squashes.
    const sx = this.transform.sx ?? 1,
      sy = this.transform.sy ?? 1

    // Standing nodes (gravestones, or anything under the tilt) paint back to
    // front: the one whose foot is lower on screen is nearer and goes on top.
    this._syncDepthOrder(nodes, gs)

    // Per-frame positions (only on frames actually requested).
    for (let i = 0; i < nodes.length; i++)
      this.nodeLayer.setPosition(i, nodes[i].x * sx, nodes[i].y * sy)
    this.nodeLayer.commitPositions()

    if (this._linkTweening) this._linkTweening = this._stepLinks(dt)
    this.linkLayer.updateGeometry(links, gs, this._curLinkVisual, sx, sy)
    if (this._linkTweening || this._linkStyleWrite) {
      this.linkLayer.updateStyles(links, this._curLinkVisual)
      this._linkStyleWrite = false
    }

    // Selection halo underlay: keep it tracking the (few) emphasised links.
    const haloLinks = []
    for (const d of links) {
      const a = this._linkAnim.get(d.id)
      if (a && (a.h > 0.004 || (a.th ?? 0) > 0)) haloLinks.push(d)
    }
    const haloKey = haloLinks.length ? haloLinks.map((d) => d.id).join('|') : ''
    if (haloKey !== this._haloKey) {
      this._haloKey = haloKey
      this.haloLayer.setLinks(haloLinks)
    }
    if (haloLinks.length) {
      this.haloLayer.updateGeometry(haloLinks, gs, this._haloVisual, sx, sy)
      this.haloLayer.updateStyles(haloLinks, this._haloVisual)
    }

    this.atlas.flush()

    const t = this.transform
    this.world.matrix.compose(
      new THREE.Vector3(t.x, t.y, 0),
      new THREE.Quaternion(),
      new THREE.Vector3(t.k, t.k, 1)
    )
    this.world.matrixWorldNeedsUpdate = true

    // Ambient dash flow + the selection halo's breathing pulse: advance the shared
    // clock; keep the loop alive while any link flows or any node glows (and the tab
    // is visible) — otherwise idle at 0% as before.
    const clock = this._clock
    this.linkLayer.material.uniforms.uTime.value = clock
    // Line effects: speed (frozen under reduced motion), glow, palette, backdrop.
    const lu = this.linkLayer.material.uniforms
    lu.uFxSpeed.value = reducedMotion() ? 0 : (gs.lineFxSpeed ?? 1)
    lu.uFxGlow.value = gs.lineFxGlow ?? 1
    lu.uFxKeep.value = gs.lineFxKeep ? 1 : 0
    lu.uFxLight.value = this._appTheme === 'light' ? 1 : 0
    this.nodeLayer.material.uniforms.uTime.value = clock
    nu.uDecorTime.value = this._decorAnim ? clock : 0
    this.ambient.setClock(clock, t.x, t.y)
    this._applyView(t, this.width, this.height, gs)

    // Flat atmosphere pass, then the (possibly tilted) world on top.
    this.renderer.autoClear = true
    this.renderer.render(this.bgScene, this.camera)
    this.renderer.autoClear = false
    this.renderer.render(this.scene, this.viewCamera)
    this.renderer.autoClear = true
    const oo = this.hooks.overlayOpts()
    // Names are brushed in once their wash has bloomed.
    if (look.nodes && clock < this._inkAnimUntil) oo.revealOf = this._labelReveal
    if (clock < this._popUntil) {
      // Newcomers: ripple rings, and names that fade in as each pop lands.
      oo.pops = this._activePops()
      oo.popColor = this._popColor
      const ink = oo.revealOf
      oo.revealOf = ink ? (n) => ink(n) * this._popReveal(n) : (n) => this._popReveal(n)
    }
    this.overlay.draw(oo)

    // Keep the loop alive frame-to-frame while a tween is settling, dashes flow,
    // a node's focus halo is pulsing, decor ornaments are turning, or weather
    // is drifting through the atmosphere layer.
    if (
      this._nodeTweening ||
      this._linkTweening ||
      this._clock < this._inkAnimUntil ||
      this._clock < this._popUntil ||
      ((this._hasFlow || this._hasNodeGlow || this._hasAmbient || this._decorAnim) &&
        document.visibilityState === 'visible')
    ) {
      this.requestRedraw()
    }
  }

  // ── Image export ────────────────────────────────────────────────────────────
  // Render one fully-settled frame at an arbitrary size/camera and return it as
  // a fresh canvas (GL content + text overlay composited, transparent
  // background). Entirely synchronous: the live canvas is resized, drawn, read
  // back and restored before the browser ever paints, so nothing flashes.
  // `light` temporarily flips the document theme for the capture (null = keep).
  exportFrame({ width, height, transform, light = null, overlayOpts }) {
    const doc = document.documentElement
    const prevTheme = doc.dataset.theme
    const wantLight = light == null ? this.overlay.light : light
    const flip = wantLight !== this.overlay.light
    const oldW = this.width || 1
    const oldH = this.height || 1
    const oldT = this.transform
    const uPR = this.nodeLayer.material.uniforms.uPixelRatio
    try {
      if (flip) {
        doc.dataset.theme = wantLight ? 'light' : 'dark'
        this.nodeLayer.setThemeUniforms(wantLight)
        this._haloRGB = wantLight ? [0.16, 0.2, 0.3] : [1, 1, 1]
        this.overlay.setTheme(wantLight)
      }
      this.renderer.setPixelRatio(1)
      uPR.value = 1
      this.renderer.setSize(width, height, false)
      this.camera.right = width
      this.camera.bottom = height
      this.camera.updateProjectionMatrix()
      this.transform = transform
      this.overlay.setCamera(transform)

      // Snap every style tween to its target so the capture is settled.
      this._syncNodeStyles()
      for (const a of this._nodeAnim.values()) {
        a.op = a.top
        a.rad = a.trad
        a.glow = a.tglow
      }
      this._stepNodes(0)
      // A still capture shows every wash fully bloomed (the live attrs re-sync after).
      this.nodeLayer.born.fill(NOT_BORN)
      this.nodeLayer.pop.fill(NOT_BORN) // …and everyone at full size
      const nodes = this.nodes || []
      for (let i = 0; i < nodes.length; i++) this.nodeLayer.setPosition(i, nodes[i].x, nodes[i].y)
      this.nodeLayer.commitPositions()
      this._syncLinkStyles()
      for (const a of this._linkAnim.values()) {
        a.op = a.top
        a.w = a.tw
        a.ar = a.tar
        a.cr = a.tcr
        a.cg = a.tcg
        a.cb = a.tcb
        a.h = a.th ?? 0
        a.born = NOT_BORN // strokes fully written in the capture
      }
      const links = this.links || []
      const gs = this.hooks.getSettings()
      this.linkLayer.updateGeometry(links, gs, this._curLinkVisual)
      this.linkLayer.updateStyles(links, this._curLinkVisual)
      const haloLinks = links.filter((d) => (this._linkAnim.get(d.id)?.h ?? 0) > 0.004)
      this._haloKey = haloLinks.map((d) => d.id).join('|')
      this.haloLayer.setLinks(haloLinks)
      if (haloLinks.length) {
        this.haloLayer.updateGeometry(haloLinks, gs, this._haloVisual)
        this.haloLayer.updateStyles(haloLinks, this._haloVisual)
      }
      this.atlas.flush()

      this.world.matrix.compose(
        new THREE.Vector3(transform.x, transform.y, 0),
        new THREE.Quaternion(),
        new THREE.Vector3(transform.k, transform.k, 1)
      )
      this.world.matrixWorldNeedsUpdate = true
      this.nodeLayer.material.uniforms.uTime.value = 0 // neutral pulse phase for a still capture
      this.nodeLayer.material.uniforms.uDecorTime.value = 0
      this.ambient.object3d.visible = false // weather is ambience, not content
      // Same camera as the live view (tilt included), sized for the capture.
      this._applyView(transform, width, height, gs)
      this.renderer.render(this.scene, this.viewCamera)
      this.overlay.resize(width, height, 1)
      this.overlay.draw(overlayOpts)

      const out = document.createElement('canvas')
      out.width = width
      out.height = height
      const g = out.getContext('2d')
      g.drawImage(this._glCanvas, 0, 0, width, height)
      g.drawImage(this.overlay.canvas, 0, 0, width, height)
      return out
    } finally {
      if (flip) {
        if (prevTheme == null) delete doc.dataset.theme
        else doc.dataset.theme = prevTheme
        this.nodeLayer.setThemeUniforms(!wantLight)
        this._haloRGB = !wantLight ? [0.16, 0.2, 0.3] : [1, 1, 1]
        this.overlay.setTheme(!wantLight)
      }
      this.renderer.setPixelRatio(this.dpr)
      uPR.value = this.dpr
      this.transform = oldT
      this.overlay.setCamera(oldT)
      this.resize(oldW, oldH) // restores renderer/camera/overlay sizes + schedules a live redraw
      this.markAllDirty()
    }
  }

  dispose() {
    this.disposed = true
    document.removeEventListener('visibilitychange', this._onVisibility)
    this._glCanvas?.removeEventListener('webglcontextlost', this._onContextLost)
    this._glCanvas?.removeEventListener('webglcontextrestored', this._onContextRestored)
    this.atlas.dispose()
    this.nodeLayer.dispose()
    this.linkLayer.dispose()
    this.haloLayer.dispose()
    this.ambient.dispose()
    this.grid.dispose()
    this.backdrop?.dispose()
    this.renderer.dispose()
  }
}
