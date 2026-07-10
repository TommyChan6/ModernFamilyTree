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
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
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
    this.markAllDirty()
    this.requestRedraw()
  }

  setCamera(t) {
    this.transform = t
    this._uiDirty = true
    this.requestRedraw()
  }

  setTheme(isLight) {
    this._css.invalidate()
    this.nodes.setThemeUniforms(isLight)
    this.markAllDirty()
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
      this.zones.set(i, z.x, z.y, z.r, rgb(z.color), {
        fillA: a.fillA,
        ringA: a.ringA,
        ringW: a.ringW,
        dropA: a.dropA,
        scale: a.s,
        opacity: a.op
      })
    }
    this.zones.commit()

    // People + membership arcs. Arc count varies, so tally first.
    this.nodes.setCount(nodesArr.length)
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
        fill: rgb(meta.color),
        border: v.grabbed ? accentRGB : surfaceRGB,
        borderPx: 2.5,
        borderA: 1,
        opacity: op,
        selected: false,
        glow: v.grabbed ? 0.5 : 0,
        avatar: layer >= 1 ? layer : 0
      })
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
          rgb(arc.color),
          op * 0.95,
          meta.multi ? SPIN : 0
        )
      }
      if (meta.multi) tetherCount += meta.arcs.length
    }
    this.nodes.commitPositions()
    this.nodes.commitStyles()
    this.arcs.commit()

    // Threads: faint always-on tethers for multi-faction people + bright
    // membership links for the active (hovered / dragged) person.
    const zoneById = new Map(zonesArr.map((z) => [z.id, z]))
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

  // ── Overlay: pills, labels, badges, ghost (screen space) ───────────────────
  _drawOverlay() {
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
      const w = z.headerW * k * ps,
        h = 26 * k * ps
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
      if (12 * k >= 5.5) {
        ctx.font = `700 ${12 * k * ps}px ${font}`
        ctx.fillStyle = c.t1
        ctx.textAlign = 'left'
        ctx.fillText(`${z.icon} ${z.label}`, x + 12 * k, cs.y + 0.5)
        ctx.font = `700 ${11 * k * ps}px ${font}`
        ctx.fillStyle = z.color
        ctx.textAlign = 'right'
        ctx.fillText(String(z.count), x + w - 12 * k, cs.y + 0.5)
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
    this.renderer.render(this.scene, this.camera)

    if (this._tweening || entranceActive || this._ambient) this.requestRedraw()
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
    this.renderer.dispose()
    // The view unmounts on every view switch — release the GL context eagerly so
    // rapid switching can't exhaust the browser's context pool before GC runs.
    this.renderer.forceContextLoss()
  }
}
