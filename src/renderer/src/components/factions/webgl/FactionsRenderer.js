import * as THREE from 'three'
import { NodeLayer } from '../../graph/webgl/NodeLayer.js'
import { AvatarAtlas } from '../../graph/webgl/AvatarAtlas.js'
import { Picker } from '../../graph/webgl/Picking.js'
import { worldToScreen } from '../../graph/webgl/coords.js'
import { approach, TWEEN_EPS } from '../../graph/webgl/tween.js'
import { CapsuleLayer } from '../../webgl/CapsuleLayer.js'
import { ArcLayer } from '../../webgl/ArcLayer.js'
import { createCssColorCache, roundRect } from '../../webgl/overlayUtils.js'
import { ZoneLayer } from './ZoneLayer.js'
import { InkStrokeLayer } from '../../webgl/InkStrokeLayer.js'
import { InkDropLayer, RIPPLE, DROP } from '../../webgl/InkDropLayer.js'
import { InkMistLayer } from '../../webgl/InkMistLayer.js'
import { hexToRgb01, PAPER_RGB } from '../../webgl/inkMath'
import { INK, inkFontsReady, paperCanvas, hashStr } from '../../../lib/inkArt'
import { drawInkOverlay, inkNodePigment, CINNABAR } from './FactionsInk.js'
import { drawIcon, iconPath } from '../../../lib/canvasIcon.js'

const NODE_R = 17
const ARC_R = 22.5
const SPIN = (Math.PI * 2) / 14 // multi-faction arc orbit: one turn per 14s
const TETHER_FLOW = 10 // dash drift, world units/s (the old fx-flow)
const PERSON_ICON_PATH =
  'M12 12.5c2.49 0 4.5-2.01 4.5-4.5S14.49 3.5 12 3.5 7.5 5.51 7.5 8s2.01 4.5 4.5 4.5zm0 2.25c-3 0-9 1.51-9 4.5V22h18v-2.75c0-2.99-6-4.5-9-4.5z'

const _col = new THREE.Color()
function rgb(hex) {
  _col.set(hex || '#888')
  return [_col.r, _col.g, _col.b]
}

// easeOutBack — the springy overshoot of the old fx-pop CSS entrance.
function easeOutBack(t) {
  const c1 = 1.70158,
    c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

// Draws the Factions stage with Three.js: instanced zone discs (ZoneLayer), dashed
// tether/membership threads (CapsuleLayer, dash flow on the GPU), membership arcs
// (ArcLayer, orbiting on the GPU) and person nodes with avatars (the tree view's
// NodeLayer + AvatarAtlas). A 2D overlay canvas on top draws the low-count text —
// zone header pills, person names, multi-membership badges and the drag ghost.
//
// The d3 simulation lives in FactionsView and owns node positions; the view pokes
// markGeomDirty()+requestRedraw() on every tick. Style changes tween here. Ambient
// motion (arc orbits, tether flow, marching-ants drop halo) only advances a uTime
// uniform — no buffer writes — and the loop idles completely when nothing moves
// and no multi-faction people exist.
export class FactionsRenderer {
  constructor({ glCanvas, overlayCanvas, hooks }) {
    this.hooks = hooks
    this.disposed = false
    this._scheduled = false
    this._lastT = null
    this._timeSec = 0
    this.transform = { x: 0, y: 0, k: 1 }
    this._geomDirty = true
    this._stylesDirty = true
    this._uiDirty = true
    this._tweening = false
    this._ambient = false
    this._entranceUntil = 0
    this._seen = new Set()
    this._pAnim = new Map() // person id -> { op, s, top, ts, start }
    this._zAnim = new Map() // zone id -> { op, s, fillA, ringA, ringW, dropA, ps, t* }
    this._pVis = new Map()
    this._pillRects = [] // screen rects of the zone header pills, for hit tests
    this._css = createCssColorCache()
    this._icon = new Path2D(PERSON_ICON_PATH)

    this.overlay = overlayCanvas.getContext('2d')
    this._overlayCanvas = overlayCanvas
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

    this.atlas = new AvatarAtlas(() => {
      this._stylesDirty = true
      this.requestRedraw()
    })
    this.zones = new ZoneLayer({ renderOrder: 1 })
    this.threads = new CapsuleLayer({ renderOrder: 2 })
    this.arcs = new ArcLayer({ renderOrder: 3 })
    this.nodes = new NodeLayer({ atlasTexture: this.atlas.texture, pixelRatio: this.dpr })
    this.nodes.mesh.renderOrder = 4
    this.world.add(
      this.zones.object3d,
      this.threads.object3d,
      this.arcs.object3d,
      this.nodes.object3d
    )

    // 水墨 Ink theme (setInk): wash pools, brush threads/arcs, ink roundels,
    // drifting mist and drop ripples; the overlay text lives in FactionsInk.js.
    this.ink = false
    this._reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    this._fontsOk = false
    this._lastRenderTs = 0
    this._ripples = [] // { x, y, rgb, start }
    this._pigments = new Map()
    this.inkThreads = new InkStrokeLayer({ renderOrder: 2 })
    this.inkRipples = new InkDropLayer({ renderOrder: 1.2 })
    this.inkNodes = new InkDropLayer({ renderOrder: 3.5 }) // ink-blot roundels
    this.inkNodes.object3d.visible = false
    this.inkThreads.object3d.visible = false
    this.inkRipples.object3d.visible = false
    this.world.add(this.inkThreads.object3d, this.inkRipples.object3d, this.inkNodes.object3d)
    this.mist = new InkMistLayer({ renderOrder: 1.5 })
    this.mist.setLook({ color: hexToRgb01(INK.paperLight), strength: 0.26 })
    this.mist.setMotion(this._reduced ? 0 : 1)
    this.zones.setMotion(this._reduced ? 0 : 1)
    this.scene.add(this.mist.object3d)

    this.picker = new Picker()
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

  resize(w, h) {
    this.width = w
    this.height = h
    this.renderer.setSize(w, h, false)
    this.camera.left = 0
    this.camera.right = w
    this.camera.top = 0
    this.camera.bottom = h
    this.camera.updateProjectionMatrix()
    this._overlayCanvas.width = Math.round(w * this.dpr)
    this._overlayCanvas.height = Math.round(h * this.dpr)
    this._overlayCanvas.style.width = w + 'px'
    this._overlayCanvas.style.height = h + 'px'
    this.mist.setSize(w, h, this.dpr)
    this.markAllDirty()
    this.requestRedraw()
  }

  setCamera(t) {
    this.transform = t
    this.mist.setView(t.x * 0.4, t.y * 0.4, 1)
    this._uiDirty = true
    this.requestRedraw()
  }

  setTheme(isLight) {
    this._css.invalidate()
    this.nodes.setThemeUniforms(isLight)
    this._light = isLight
    if (this.ink) this._applyInkUniforms()
    this.markAllDirty()
    this.requestRedraw()
  }

  // ── 水墨 Ink theme ───────────────────────────────────────────────────────────
  /** The view is mounted but not on screen: let the ink ambience idle. */
  setHidden(h) {
    h = !!h
    if (h === this._hidden) return
    this._hidden = h
    this.markGeomDirty()
    this.requestRedraw()
  }

  setInk(on) {
    on = !!on
    if (on === this.ink) return
    this.ink = on
    this.zones.setInk(on)
    this.arcs.setInk(on)
    this.threads.object3d.visible = !on
    this.inkThreads.object3d.visible = on
    this.inkRipples.object3d.visible = on
    this.inkNodes.object3d.visible = on
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
      this._ripples = []
      this.nodes.setThemeUniforms(!!this._light)
    }
    this.markAllDirty()
    this.requestRedraw()
  }

  _applyInkUniforms() {
    const u = this.nodes.material.uniforms
    u.uShadowStrength.value = 0.05
    u.uSilhouetteColor.value.setRGB(PAPER_RGB[0], PAPER_RGB[1], PAPER_RGB[2])
  }

  /** Ink dropped into water at a world point — after a drag-drop joins a group. */
  inkRipple(x, y, color) {
    if (!this.ink || this._reduced) return
    this._ripples.push({ x, y, rgb: inkNodePigment(this, color || INK.ink), start: this._timeSec })
    if (this._ripples.length > 12) this._ripples.shift()
    this.markGeomDirty()
    this.requestRedraw()
  }

  markGeomDirty() {
    this._geomDirty = true
    this.picker.invalidate()
  }
  markStylesDirty() {
    this._stylesDirty = true
    this.requestRedraw()
  }
  markAllDirty() {
    this._geomDirty = true
    this._stylesDirty = true
    this._uiDirty = true
  }

  // Register newly appearing people for the pop-in entrance (call after the
  // view rebuilds its simulation nodes).
  noteDataChange() {
    const nodesArr = this.hooks.getNodes()
    const now = this._timeSec
    let newIdx = 0
    const alive = new Set()
    for (const n of nodesArr) {
      alive.add(n.id)
      if (this._seen.has(n.id)) continue
      this._seen.add(n.id)
      const start = now + Math.min(newIdx++, 30) * 0.025
      this._pAnim.set(n.id, { op: 0, s: 0.3, start })
      this._entranceUntil = Math.max(this._entranceUntil, start + 0.45)
    }
    for (const id of this._pAnim.keys()) if (!alive.has(id)) this._pAnim.delete(id)
    this.picker.invalidate()
    this.markAllDirty()
    this.requestRedraw()
  }

  requestRedraw() {
    if (this.disposed || this._scheduled) return
    this._scheduled = true
    requestAnimationFrame(this._frame)
  }

  pickPerson(wx, wy, radius = ARC_R + 4) {
    return this.picker.pickNode(wx, wy, this.hooks.getNodes(), radius)
  }

  pillAt(mx, my) {
    for (const r of this._pillRects) {
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return r
    }
    return null
  }

  // ── Style targets / tween ───────────────────────────────────────────────────
  _syncStyles() {
    const nodesArr = this.hooks.getNodes()
    this._pVis.clear()
    for (const n of nodesArr) {
      const v = this.hooks.personVisual(n.id)
      this._pVis.set(n.id, v)
      let a = this._pAnim.get(n.id)
      if (!a) {
        a = { op: 0, s: v.scale }
        this._pAnim.set(n.id, a)
      }
      a.top = v.opacity
      a.ts = v.scale
    }
    const zonesArr = this.hooks.getZones()
    const seen = new Set()
    for (const z of zonesArr) {
      seen.add(z.id)
      const v = this.hooks.zoneVisual(z.id)
      let a = this._zAnim.get(z.id)
      if (!a) {
        a = { op: 0, s: 0.85, fillA: v.fillA, ringA: v.ringA, ringW: v.ringW, dropA: 0, ps: 1 }
        this._zAnim.set(z.id, a)
      }
      a.top = v.opacity
      a.ts = 1
      a.tFillA = v.fillA
      a.tRingA = v.ringA
      a.tRingW = v.ringW
      a.tDropA = v.dropA
      a.tps = v.pillHover ? 1.05 : 1
    }
    for (const id of this._zAnim.keys()) if (!seen.has(id)) this._zAnim.delete(id)
  }

  _step(dt) {
    let moving = false
    const chase = (a, k, tk) => {
      a[k] = approach(a[k], a[tk], dt)
      if (Math.abs(a[k] - a[tk]) > TWEEN_EPS) moving = true
    }
    for (const a of this._pAnim.values()) {
      chase(a, 'op', 'top')
      chase(a, 's', 'ts')
    }
    for (const a of this._zAnim.values()) {
      chase(a, 'op', 'top')
      chase(a, 's', 'ts')
      chase(a, 'fillA', 'tFillA')
      chase(a, 'ringA', 'tRingA')
      chase(a, 'ringW', 'tRingW')
      chase(a, 'dropA', 'tDropA')
      chase(a, 'ps', 'tps')
    }
    return moving
  }

  // Entrance pop for a person (springy scale + quick fade-in). Mutates a.start
  // to null when finished. Returns { e: opacityMul, s: scaleMul }.
  _entrance(a) {
    if (!a.start) return { e: 1, s: 1 }
    const t = (this._timeSec - a.start) / 0.45
    if (t >= 1) {
      a.start = null
      return { e: 1, s: 1 }
    }
    if (t <= 0) return { e: 0, s: 0.3 }
    return { e: Math.min(1, t * 2.5), s: easeOutBack(t) }
  }

  // ── Buffers (world units; rebuilt on sim ticks / tween frames) ─────────────
  _writeBuffers() {
    const nodesArr = this.hooks.getNodes()
    const metas = this.hooks.getMeta()
    const zonesArr = this.hooks.getZones()
    const links = this.hooks.getActiveLinks()
    const c = this._css.get()
    const surfaceRGB = rgb(c.surface)
    const accentRGB = rgb(c.accent)
    const entranceActive = this._timeSec < this._entranceUntil

    // Zones.
    this.zones.setCount(zonesArr.length)
    for (let i = 0; i < zonesArr.length; i++) {
      const z = zonesArr[i]
      const a = this._zAnim.get(z.id)
      if (!a) continue
      this.zones.set(i, z.x, z.y, z.r, this.ink ? hexToRgb01(z.color) : rgb(z.color), {
        fillA: a.fillA,
        ringA: a.ringA,
        ringW: a.ringW,
        dropA: a.dropA,
        scale: a.s,
        opacity: a.op,
        seed: this.ink ? (hashStr(String(z.id)) % 1000) / 37 : 0
      })
    }
    this.zones.commit()

    // People + membership arcs. Arc count varies, so tally first.
    this.nodes.setCount(nodesArr.length)
    if (this.ink) this.inkNodes.setCount(nodesArr.length)
    let arcTotal = 0
    for (const n of nodesArr) arcTotal += metas.get(n.id)?.arcs.length || 0
    this.arcs.setCount(arcTotal)
    let arcI = 0
    let tetherCount = 0
    for (let i = 0; i < nodesArr.length; i++) {
      const n = nodesArr[i]
      const meta = metas.get(n.id)
      const v = this._pVis.get(n.id)
      const a = this._pAnim.get(n.id)
      if (!meta || !v || !a) continue
      const ent = this._entrance(a)
      const op = a.op * ent.e
      const scale = a.s * ent.s
      const layer = meta.imageUrl ? this.atlas.request(n.id, meta.imageUrl) : -1
      this.nodes.setPosition(i, n.x, n.y)
      this.nodes.setStyle(i, {
        radius: NODE_R * scale,
        fill: this.ink ? inkNodePigment(this, meta.color) : rgb(meta.color),
        border: this.ink ? (v.grabbed ? CINNABAR : PAPER_RGB) : v.grabbed ? accentRGB : surfaceRGB,
        borderPx: 2.5,
        borderA: 1,
        // ink: photo pins keep their roundel; everyone else is an ink blot
        opacity: this.ink && layer < 1 ? 0 : op,
        selected: false,
        glow: v.grabbed && !this.ink ? 0.5 : 0,
        avatar: layer >= 1 ? layer : 0
      })
      if (this.ink) {
        const seed = (hashStr(n.id) % 1000) / 41
        const pig = v.grabbed ? CINNABAR : inkNodePigment(this, meta.color)
        const bloom = a.start != null
        this.inkNodes.set(
          i,
          n.x,
          n.y,
          NODE_R * scale * 0.92,
          pig,
          layer >= 1 ? 0 : op * 1.25,
          DROP,
          seed,
          bloom ? a.start : 0,
          bloom ? 0.45 : 0
        )
      }
      const arcR = (meta.multi ? ARC_R + 1.5 : ARC_R) * scale
      const arcW = meta.multi ? 3.8 : 3
      for (let j = 0; j < meta.arcs.length; j++) {
        const arc = meta.arcs[j]
        this.arcs.set(
          arcI++,
          n.x,
          n.y,
          arcR,
          arc.a0,
          arc.a1,
          arcW,
          this.ink ? hexToRgb01(arc.color) : rgb(arc.color),
          op * 0.95,
          meta.multi ? SPIN : 0
        )
      }
      if (meta.multi) tetherCount += meta.arcs.length
    }
    this.nodes.commitPositions()
    this.nodes.commitStyles()
    if (this.ink) this.inkNodes.commit()
    this.arcs.commit()

    // Threads: faint always-on tethers for multi-faction people + bright
    // membership links for the active (hovered / dragged) person.
    const zoneById = new Map(zonesArr.map((z) => [z.id, z]))
    if (this.ink) {
      this._writeInkThreads(nodesArr, metas, zoneById, links, tetherCount)
      let dropActive = false
      for (const a of this._zAnim.values()) if (a.dropA > 0.01) dropActive = true
      this._ambient = !this._hidden && (!this._reduced || tetherCount > 0 || dropActive)
      this._writeRipples()
      return entranceActive
    }
    this.threads.setCount(tetherCount + links.length)
    let ti = 0
    for (const n of nodesArr) {
      const meta = metas.get(n.id)
      if (!meta?.multi) continue
      const v = this._pVis.get(n.id)
      const a = this._pAnim.get(n.id)
      const groupOp = (v?.tetherOp ?? 1) * (a ? a.op * this._entrance(a).e : 1)
      for (const fid of meta.factionIds) {
        const z = zoneById.get(fid)
        if (!z) {
          this.threads.set(ti++, n.x, n.y, n.x, n.y, 0, [0, 0, 0], 0)
          continue
        }
        this.threads.set(
          ti++,
          n.x,
          n.y,
          z.x,
          z.y,
          1.3,
          rgb(z.color),
          0.3 * groupOp,
          2,
          7,
          TETHER_FLOW
        )
      }
    }
    for (const l of links) {
      this.threads.set(ti++, l.x1, l.y1, l.x2, l.y2, 1.6, rgb(l.color), 0.75, 3, 6, 0)
    }
    this.threads.commit()

    // Ambient GPU motion keeps the loop alive: orbiting arcs + flowing tethers
    // + the marching-ants drop halo.
    let dropActive = false
    for (const a of this._zAnim.values()) if (a.dropA > 0.01) dropActive = true
    this._ambient = tetherCount > 0 || dropActive
    return entranceActive
  }

  // Ink tethers: thin dry brush threads from multi-group people to each camp,
  // plus firmer strokes for the hovered / dragged person's memberships.
  _writeInkThreads(nodesArr, metas, zoneById, links, tetherCount) {
    const T = this.inkThreads
    T.setCount(tetherCount + links.length)
    let ti = 0
    for (const n of nodesArr) {
      const meta = metas.get(n.id)
      if (!meta?.multi) continue
      const v = this._pVis.get(n.id)
      const a = this._pAnim.get(n.id)
      const groupOp = (v?.tetherOp ?? 1) * (a ? a.op * this._entrance(a).e : 1)
      for (const fid of meta.factionIds) {
        const z = zoneById.get(fid)
        if (!z) {
          T.set(ti++, n.x, n.y, n.x, n.y, 0, [0, 0, 0], 0, 0, 0, 0, 0)
          continue
        }
        const seed = ((hashStr(n.id + fid) % 1000) / 1000) * 50
        T.set(
          ti++,
          n.x,
          n.y,
          z.x,
          z.y,
          2.2,
          inkNodePigment(this, z.color),
          0.42 * groupOp,
          seed,
          0.85,
          0,
          0.6
        )
      }
    }
    for (const l of links) {
      const seed = ((hashStr(String(l.x2) + l.color) % 1000) / 1000) * 50
      T.set(
        ti++,
        l.x1,
        l.y1,
        l.x2,
        l.y2,
        3.2,
        inkNodePigment(this, l.color),
        0.85,
        seed,
        0.6,
        0,
        0.5
      )
    }
    T.commit()
  }

  // One-shot drop ripples (animated on the GPU; spent ones are dropped on the
  // next buffer write — the mist keeps the ink loop running meanwhile).
  _writeRipples() {
    const now = this._timeSec
    const DUR = 1.8
    this._ripples = this._ripples.filter((r) => now - r.start < DUR)
    this.inkRipples.setCount(this._ripples.length)
    this._ripples.forEach((r, i) => {
      this.inkRipples.set(i, r.x, r.y, 120, r.rgb, 0.9, RIPPLE, i * 3.7, r.start, DUR)
    })
    this.inkRipples.commit()
  }

  // ── Overlay: pills, labels, badges, ghost (screen space) ───────────────────
  _drawOverlay() {
    if (this.ink) {
      drawInkOverlay(this)
      return
    }
    const ctx = this.overlay,
      c = this._css.get(),
      t = this.transform,
      k = t.k
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)
    this._pillRects = []
    const font = 'system-ui, sans-serif'
    const nodesArr = this.hooks.getNodes()
    const metas = this.hooks.getMeta()

    // Person name labels (culled + LOD).
    const nameFontPx = 10.5 * k
    if (nameFontPx >= 5) {
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.lineJoin = 'round'
      for (const n of nodesArr) {
        const meta = metas.get(n.id)
        if (!meta) continue
        const s = worldToScreen(n.x, n.y, t)
        if (s.x < -80 || s.x > this.width + 80 || s.y < -80 || s.y > this.height + 80) continue
        const v = this._pVis.get(n.id)
        const a = this._pAnim.get(n.id)
        const alpha = a ? a.op * this._entrance(a).e : 1
        if (alpha <= 0.02) continue
        ctx.globalAlpha = alpha
        ctx.font = `600 ${nameFontPx}px ${font}`
        ctx.strokeStyle = c.bg
        ctx.lineWidth = 3 * k
        ctx.fillStyle = v?.lit ? c.t1 : c.t2
        const y = s.y + (NODE_R + 16) * k
        ctx.strokeText(meta.label, s.x, y)
        ctx.fillText(meta.label, s.x, y)

        // Multi-membership count badge at the node's top-right shoulder.
        if (meta.multi && 7.5 * k >= 3.5) {
          const bx = s.x + (NODE_R - 2) * k
          const by = s.y - (NODE_R - 2) * k
          ctx.beginPath()
          ctx.arc(bx, by, 7.5 * k, 0, Math.PI * 2)
          ctx.fillStyle = c.surface
          ctx.fill()
          ctx.strokeStyle = c.accent
          ctx.lineWidth = 1.5 * k
          ctx.stroke()
          ctx.fillStyle = c.accent
          ctx.font = `800 ${9 * k}px ${font}`
          ctx.textBaseline = 'middle'
          ctx.fillText(String(meta.count), bx, by + 0.5)
          ctx.textBaseline = 'alphabetic'
        }
        ctx.globalAlpha = 1
      }
    }

    // Zone header pills (drawn above labels; they anchor the rings).
    ctx.textBaseline = 'middle'
    for (const z of this.hooks.getZones()) {
      const a = this._zAnim.get(z.id)
      if (!a || a.op <= 0.02) continue
      const ps = a.ps
      const h = 26 * k * ps
      // Pill content: [icon] label … count, measured so the pill hugs it and
      // stays centred over the ring (falls back to the estimate when tiny).
      const showText = 12 * k >= 5.5
      const pad = 12 * k * ps
      const isz = 13 * k * ps
      const iconW = iconPath(z.icon) ? isz + 6 * k * ps : 0
      let w = z.headerW * k * ps
      if (showText) {
        ctx.font = `700 ${12 * k * ps}px ${font}`
        const lw = ctx.measureText(z.label).width
        ctx.font = `700 ${11 * k * ps}px ${font}`
        const cw = ctx.measureText(String(z.count)).width
        w = pad + iconW + lw + 10 * k * ps + cw + pad
      }
      const cs = worldToScreen(z.x, z.y - z.r - 30 + 13, t) // pill centre
      const x = cs.x - w / 2,
        y = cs.y - h / 2
      if (x + w < -20 || x > this.width + 20 || y + h < -20 || y > this.height + 20) continue
      ctx.globalAlpha = a.op
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.28)'
      ctx.shadowBlur = 8 * k
      ctx.shadowOffsetY = 2 * k
      ctx.fillStyle = c.surface
      roundRect(ctx, x, y, w, h, 13 * k * ps)
      ctx.fill()
      ctx.restore()
      ctx.strokeStyle = z.color
      ctx.lineWidth = 1.4 * k
      roundRect(ctx, x, y, w, h, 13 * k * ps)
      ctx.stroke()
      if (showText) {
        if (iconW) drawIcon(ctx, z.icon, x + pad + isz / 2, cs.y, isz, { color: z.color })
        ctx.font = `700 ${12 * k * ps}px ${font}`
        ctx.fillStyle = c.t1
        ctx.textAlign = 'left'
        ctx.fillText(z.label, x + pad + iconW, cs.y + 0.5)
        ctx.font = `700 ${11 * k * ps}px ${font}`
        ctx.fillStyle = z.color
        ctx.textAlign = 'right'
        ctx.fillText(String(z.count), x + w - pad, cs.y + 0.5)
      }
      ctx.globalAlpha = 1
      this._pillRects.push({ x, y, w, h, id: z.id })
    }

    // Drag ghost (someone being pulled in from the tray / member list).
    const ghost = this.hooks.getGhost()
    if (ghost && ghost.over) {
      const s = worldToScreen(ghost.x, ghost.y, t)
      const r = NODE_R * k
      ctx.globalAlpha = 0.85
      ctx.beginPath()
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
      ctx.fillStyle = ghost.color
      ctx.fill()
      ctx.setLineDash([5 * k, 4 * k])
      ctx.strokeStyle = c.accent
      ctx.lineWidth = 2 * k
      ctx.stroke()
      ctx.setLineDash([])
      ctx.save()
      ctx.translate(s.x - 10 * k, s.y - 10.5 * k)
      ctx.scale(0.86 * k, 0.86 * k)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
      ctx.fill(this._icon)
      ctx.restore()
      ctx.font = `600 ${10.5 * k}px ${font}`
      ctx.textAlign = 'center'
      ctx.fillStyle = c.t2
      ctx.fillText(ghost.label, s.x, s.y + (NODE_R + 16) * k)
      ctx.globalAlpha = 1
    }
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

    // Ink ambient-only frames (mist drift, ripples on the GPU) run at ~30fps.
    if (this.ink && !this._geomDirty && !this._uiDirty && ts - this._lastRenderTs < 30) {
      this.requestRedraw()
      return
    }
    this._lastRenderTs = ts

    let entranceActive = false
    if (this._geomDirty) {
      entranceActive = this._writeBuffers()
      this._geomDirty = entranceActive
      this.atlas.flush()
      this._drawOverlay()
      this._uiDirty = false
    } else if (this._uiDirty) {
      this._drawOverlay()
      this._uiDirty = false
    }

    const t = this.transform
    this.world.matrix.compose(
      new THREE.Vector3(t.x, t.y, 0),
      new THREE.Quaternion(),
      new THREE.Vector3(t.k, t.k, 1)
    )
    this.world.matrixWorldNeedsUpdate = true

    const time = this._timeSec
    this.threads.setTime(time)
    this.arcs.setTime(time)
    this.zones.setTime(time)
    if (this.ink) {
      this.inkThreads.setTime(time)
      this.inkRipples.setTime(time)
      this.inkNodes.setTime(time)
      this.mist.setTime(time)
    }
    this.renderer.render(this.scene, this.camera)

    if (this._tweening || entranceActive || this._ambient) this.requestRedraw()
  }

  // ── Image export ────────────────────────────────────────────────────────────
  // Render one fully-settled frame at an arbitrary size/camera and return it as
  // a fresh canvas (GL zones/threads/nodes + the 2D overlay composited,
  // transparent background). Synchronous resize→draw→readback→restore, so the
  // live canvases never show the export frame. `light` temporarily flips the
  // document theme for the capture (null = keep the current one).
  exportFrame({ width, height, transform, light = null }) {
    const doc = document.documentElement
    const prevTheme = doc.dataset.theme
    const isLight = prevTheme === 'light' || prevTheme === 'ink'
    const wantLight = light == null ? isLight : light
    const flip = wantLight !== isLight
    const oldW = this.width || 1
    const oldH = this.height || 1
    const oldT = this.transform
    const oldDpr = this.dpr
    const uPR = this.nodes.material.uniforms.uPixelRatio
    const wasInk = this.ink
    try {
      if (flip && wasInk) this.setInk(false)
      if (this.ink) this.mist.setVisible(false)
      if (flip) {
        doc.dataset.theme = wantLight ? 'light' : 'dark'
        this._css.invalidate()
        this.nodes.setThemeUniforms(wantLight)
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
      this._overlayCanvas.width = width
      this._overlayCanvas.height = height
      this.transform = transform

      // Snap every tween/entrance to its target so the capture is settled.
      this._syncStyles()
      for (const a of this._pAnim.values()) {
        a.op = a.top
        a.s = a.ts
        a.start = null
      }
      for (const a of this._zAnim.values()) {
        a.op = a.top
        a.s = a.ts
        a.fillA = a.tFillA
        a.ringA = a.tRingA
        a.ringW = a.tRingW
        a.dropA = a.tDropA
        a.ps = a.tps
      }
      this._entranceUntil = 0
      this._writeBuffers()
      this.atlas.flush()
      this._drawOverlay()

      this.world.matrix.compose(
        new THREE.Vector3(transform.x, transform.y, 0),
        new THREE.Quaternion(),
        new THREE.Vector3(transform.k, transform.k, 1)
      )
      this.world.matrixWorldNeedsUpdate = true
      this.renderer.render(this.scene, this.camera)

      const out = document.createElement('canvas')
      out.width = width
      out.height = height
      const g = out.getContext('2d')
      if (this.ink) {
        // the sheet itself — the live stage gets its paper from CSS
        const paper = paperCanvas(512, 512, { tone: INK.paper, fiber: 0.7, seed: 11 })
        g.fillStyle = g.createPattern(paper, 'repeat')
        g.fillRect(0, 0, width, height)
      }
      g.drawImage(this._glCanvas, 0, 0, width, height)
      g.drawImage(this._overlayCanvas, 0, 0, width, height)
      return out
    } finally {
      if (flip) {
        if (prevTheme == null) delete doc.dataset.theme
        else doc.dataset.theme = prevTheme
        this._css.invalidate()
        this.nodes.setThemeUniforms(!wantLight)
      }
      if (wasInk) {
        if (!this.ink) this.setInk(true)
        else this.mist.setVisible(true)
      }
      this.dpr = oldDpr
      this.renderer.setPixelRatio(oldDpr)
      uPR.value = oldDpr
      this.transform = oldT
      this.resize(oldW, oldH) // restores GL + overlay canvases + schedules a live redraw
    }
  }

  dispose() {
    this.disposed = true
    this._glCanvas?.removeEventListener('webglcontextlost', this._onContextLost)
    this._glCanvas?.removeEventListener('webglcontextrestored', this._onContextRestored)
    this.atlas.dispose()
    this.zones.dispose()
    this.threads.dispose()
    this.arcs.dispose()
    this.nodes.dispose()
    this.inkThreads.dispose()
    this.inkRipples.dispose()
    this.inkNodes.dispose()
    this.mist.dispose()
    this.renderer.dispose()
    // The view unmounts on every view switch — release the GL context eagerly so
    // rapid switching can't exhaust the browser's context pool before GC runs.
    this.renderer.forceContextLoss()
  }
}
