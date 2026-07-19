import * as THREE from 'three'
import { NodeLayer } from './NodeLayer.js'
import { LinkLayer } from './LinkLayer.js'
import { AmbientLayer } from './AmbientLayer.js'
import { AvatarAtlas } from './AvatarAtlas.js'
import { TextGuideOverlay } from './TextGuideOverlay.js'
import { Picker } from './Picking.js'
import { approach, TWEEN_EPS } from './tween.js'
import { nodeShapeId, nodeDecorId } from './NodeMaterial.js'

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
  constructor({ glCanvas, overlayCanvas, hooks }) {
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
    this.camera = new THREE.OrthographicCamera(0, 1, 0, 1, 0.1, 1000)
    this.camera.position.z = 100
    this.world = new THREE.Group()
    this.world.matrixAutoUpdate = false
    this.scene.add(this.world)

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
        width: (a ? a.w : 2) + 7,
        arrowColorRGB: null,
        arrowSize: 0,
        flow: 0,
        fadeTo: 1
      }
    }
    this.world.add(this.haloLayer.object3d)
    this.world.add(this.linkLayer.object3d)
    this.world.add(this.linkLayer.arrowObject3d)
    this.world.add(this.nodeLayer.object3d)

    // Atmosphere: screen-space particle weather behind everything (quality mode).
    this.ambient = new AmbientLayer()
    this.scene.add(this.ambient.object3d)
    this._hasAmbient = false
    this._quality = 'quality'

    this.overlay = new TextGuideOverlay(overlayCanvas)
    this.picker = new Picker()

    this._frame = this._frame.bind(this)
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
    this.nodeLayer.setCount(nodes.length)
    this.linkLayer.setLinks(links)
    this._haloKey = '' // force the halo underlay to re-sync against the new data
    this.markAllDirty()
    this.picker.invalidate()
    this.requestRedraw()
  }

  markNodeStylesDirty() {
    this.nodeStylesDirty = true
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
    this.requestRedraw()
  }

  setTheme(isLight) {
    this.nodeLayer.setThemeUniforms(isLight)
    this._haloRGB = isLight ? [0.16, 0.2, 0.3] : [1, 1, 1]
    this.overlay.setTheme(isLight)
    this.markAllDirty()
    this.requestRedraw()
  }

  invalidatePicker() {
    this.picker.invalidate()
  }
  pickNode(wx, wy, radius) {
    return this.picker.pickNode(wx, wy, this.nodes || [], radius)
  }
  pickLink(wx, wy, gs) {
    return this.picker.pickLink(wx, wy, this.links || [], gs)
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
      if (!a) {
        a = { op: 0, rad: v.radius, glow: 0 }
        this._nodeAnim.set(n.id, a)
      } // new -> fade in
      a.top = v.opacity
      a.trad = v.radius
      a.tglow = v.glow
      if (v.glow > 0.001) this._hasNodeGlow = true
    }
    for (const id of this._nodeAnim.keys()) if (!seen.has(id)) this._nodeAnim.delete(id)
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
        avatar: v.avatar
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
    for (const d of links) {
      const v = visual(d)
      v.colorRGB = rgb(v.colorHex)
      v.arrowRGB = v.arrowColor ? rgb(v.arrowColor) : null
      if (v.flow) this._hasFlow = true
      this._linkCacheById.set(d.id, v)
      seen.add(d.id)
      let a = this._linkAnim.get(d.id)
      // New links fade in from 0 opacity (matching the old node-group fade); size/colour snap.
      if (!a)
        a = {
          op: 0,
          w: v.width,
          ar: v.arrowSize,
          cr: v.colorRGB[0],
          cg: v.colorRGB[1],
          cb: v.colorRGB[2],
          h: 0
        }
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
      fadeTo: v.fadeTo
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

    // ── Aesthetics: quality mode, node shape/decor uniforms, atmosphere ──────
    const quality = gs.renderQuality === 'performance' ? 'performance' : 'quality'
    this._applyQuality(quality)
    const nu = this.nodeLayer.material.uniforms
    nu.uShape.value = nodeShapeId(gs.nodeShape)
    nu.uDecor.value = nodeDecorId(gs.nodeDecor)
    nu.uDecorColor.value.set(gs.decorColor || '#d4af37')
    // Decor ornaments animate only in quality mode; frozen (t=0) keeps them
    // as static jewellery in performance mode.
    this._decorAnim = quality === 'quality' && nodeDecorId(gs.nodeDecor) > 0
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

    if (this._nodeTweening) this._nodeTweening = this._stepNodes(dt)

    // Per-axis view stretch (default 1): baked into positions here so node discs
    // and link strokes keep uniform screen size while the layout spreads/squashes.
    const sx = this.transform.sx ?? 1,
      sy = this.transform.sy ?? 1

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
    const clock = ts / 1000
    this.linkLayer.material.uniforms.uTime.value = clock
    this.nodeLayer.material.uniforms.uTime.value = clock
    nu.uDecorTime.value = this._decorAnim ? clock : 0
    this.ambient.setClock(clock, t.x, t.y)

    this.renderer.render(this.scene, this.camera)
    this.overlay.draw(this.hooks.overlayOpts())

    // Keep the loop alive frame-to-frame while a tween is settling, dashes flow,
    // a node's focus halo is pulsing, decor ornaments are turning, or weather
    // is drifting through the atmosphere layer.
    if (
      this._nodeTweening ||
      this._linkTweening ||
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
      this.renderer.render(this.scene, this.camera)
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
    this.renderer.dispose()
  }
}
