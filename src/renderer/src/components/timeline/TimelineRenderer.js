import * as THREE from 'three'
import { NodeLayer } from '../graph/webgl/NodeLayer.js'
import { AvatarAtlas } from '../graph/webgl/AvatarAtlas.js'
import { approach, TWEEN_EPS } from '../graph/webgl/tween.js'
import { LifelineLayer, lifelineStyleInfo, SHADOWED } from './LifelineLayer.js'
import { AmbientLayer } from '../graph/webgl/AmbientLayer.js'
import { DotLayer } from '../webgl/DotLayer.js'
import { RibbonLayer, sampleQuadratic, sampleCubic, makeScratch } from '../webgl/RibbonLayer.js'
import { createCssColorCache, roundRect, trunc } from '../webgl/overlayUtils.js'
import { drawKinPills } from './kinPills.js'
import { GUTTER, Y_PAD, LANE_W } from './timelineLayout.js'
import { InkStrokeLayer } from '../webgl/InkStrokeLayer.js'
import { InkDropLayer } from '../webgl/InkDropLayer.js'
import { InkThreadLayer } from '../webgl/InkThreadLayer.js'
import { InkMistLayer } from '../webgl/InkMistLayer.js'
import { inkWriteSchedule, writeArrival, hexToRgb01, PAPER_RGB } from '../webgl/inkMath'
import { inkFontsReady, paperCanvas, INK } from '../../lib/inkArt'
import { writeInkBuffers, drawInkBg, drawInkFg } from './TimelineInk.js'
import { drawChronicleBg, drawChronicleFg, chronicleAt } from './chronicleDraw.js'
import { drawIcon } from '../../lib/canvasIcon.js'

const SEG = 16
const TICK_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000, 2000, 5000]

const _col = new THREE.Color()
function rgb(hex) {
  _col.set(hex || '#888')
  return [_col.r, _col.g, _col.b]
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

// Draws the Timeline with Three.js: instanced lifelines/caps (CapsuleLayer), pulsing
// end-of-life and connector dots (DotLayer), marriage/birth bezier ribbons
// (RibbonLayer) and avatar pins (the tree view's NodeLayer + AvatarAtlas). Two 2D
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
    this.layout = { people: [], marriages: [], births: [], minYear: 0, yearSpan: 10 }
    this.mouseY = null
    this.hoverBadgeId = null
    this._badgeHoverS = 1

    this._geomDirty = true
    this._stylesDirty = true
    this._styleWrite = true
    this._tweening = false
    this._entranceUntil = 0
    this._seen = new Set()
    this._pAnim = new Map() // person id -> { op, w, s, top, tw, ts, start }
    this._mAnim = new Map() // marriage id -> { op, w, top, tw }
    this._bAnim = new Map() // birth id -> { op, w, top, tw }
    this._laneX = new Map() // person id -> { x, tx } — lanes glide on re-layout
    this._pVis = [] // cached visuals, index-aligned with layout.people
    this._mVis = []
    this._bVis = []
    this._badgeRects = [] // screen rects of the badges drawn last frame
    this._curve = makeScratch(SEG)

    this.bg = bgCanvas.getContext('2d')
    this.fg = fgCanvas.getContext('2d')
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

    this.atlas = new AvatarAtlas(() => {
      this._stylesDirty = true
      this.requestRedraw()
    })
    this.ribbons = new RibbonLayer({ segments: SEG, renderOrder: 1 })
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
    this.scene.add(
      this.ambient.object3d,
      this.lineShadows.object3d,
      this.ribbons.object3d,
      this.connDots.object3d,
      this.lines.object3d,
      this.aliveDots.object3d,
      this.avatars.object3d
    )

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
  sy(year) {
    return (year - this.layout.minYear) * this.camera2.px + Y_PAD + this.camera2.ty
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

  setCamera(cam) {
    this.camera2 = cam
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
    for (const l of [this.lines, this.lineShadows, this.aliveDots, this.ribbons])
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
    for (const b of this.layout.births) {
      const child = fresh.has(b.ids[1]) ? this._inkWrite.get(b.ids[1]) : null
      const par = arrive(b.ids[0], b.year)
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
    const dead = layout.people.reduce((s, p) => s + (p.dead ? 1 : 0), 0)
    this.lines.setCount(n + dead)
    this.lineShadows.setCount(n)
    this.aliveDots.setCount(n - dead)
    this.connDots.setCount(layout.marriages.length * 2 + layout.births.length)
    this.ribbons.setCount(layout.marriages.length + layout.births.length)
    this.avatars.setCount(n)

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

  // Current (possibly mid-glide) lane x for a person id.
  _lane(id, fallback) {
    const a = this._laneX.get(id)
    return a ? a.x : fallback
  }

  /** Live screen position of a person's lifeline ({ x, y0, y1 } | null). */
  personScreen(id) {
    const p = this._pById?.get(id)
    if (!p || !this.layout) return null
    const x = this.sx(this._lane(p.id, p.laneX))
    const y0 = this.sy(p.birthYear)
    return { x, y0, y1: Math.max(this.sy(p.endYear), y0 + 8), p }
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

  // ── Hit tests (screen space) ────────────────────────────────────────────────
  personAt(mx, my) {
    const { ls } = this.camera2
    const people = this.layout.people
    if (!people.length) return null
    const laneW = LANE_W * ls
    const approxI = Math.round((mx - this.sx(people[0].laneX)) / Math.max(laneW, 0.0001))
    for (let di = -1; di <= 1; di++) {
      const i = approxI + di
      if (i < 0 || i >= people.length) continue
      const p = people[i]
      const x = this.sx(p.laneX)
      const y0 = this.sy(p.birthYear)
      const y1 = Math.max(this.sy(p.endYear), y0 + 8)
      if (Math.abs(mx - x) <= 14 && my >= y0 - 18 && my <= y1 + 12) return p
      if (Math.hypot(mx - x, my - y0) <= 17) return p // avatar pin
    }
    return null
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
    for (let i = 0; i < L.people.length; i++) {
      const p = L.people[i]
      const v = this.hooks.personVisual(p)
      v.fillRGB = rgb(v.color)
      this._pVis[i] = v
      let a = this._pAnim.get(p.id)
      if (!a) {
        a = { op: 0, w: v.lineWidth, s: v.avatarScale }
        this._pAnim.set(p.id, a)
      }
      a.top = v.opacity
      a.tw = v.lineWidth
      a.ts = v.avatarScale
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
    this._bVis.length = L.births.length
    const seenB = new Set()
    for (let i = 0; i < L.births.length; i++) {
      const b = L.births[i]
      const v = this.hooks.birthVisual(b)
      v.colorRGB = rgb(v.color)
      this._bVis[i] = v
      seenB.add(b.id)
      let a = this._bAnim.get(b.id)
      if (!a) {
        a = { op: 0, w: v.width }
        this._bAnim.set(b.id, a)
      }
      a.top = v.lineOpacity
      a.tw = v.width
    }
    for (const id of this._bAnim.keys()) if (!seenB.has(id)) this._bAnim.delete(id)
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
    this.lineShadows.setCount(shadows ? L.people.length : 0)
    this._lookAnim = look.n === 2 || look.n >= 10
    const conn = st.connectors || 'curve'
    for (let i = 0; i < L.people.length; i++) {
      const p = L.people[i]
      const v = this._pVis[i]
      const a = this._pAnim.get(p.id)
      const ent = this._entrance(a)
      const op = a.op * ent.e
      const x = this.sx(this._lane(p.id, p.laneX))
      const endYear = tYear == null ? p.endYear : Math.min(p.endYear, Math.max(tYear, p.birthYear))
      const y0 = this.sy(p.birthYear) + ent.yOff
      const y1 = Math.max(this.sy(endYear), this.sy(p.birthYear) + 8) + ent.yOff
      const lw = a.w * wScale * (look.n >= 10 ? 1.5 : look.n === 1 ? 1.25 : 1)
      const seed = (i * 0.618034) % 1
      this.lines.set(
        i,
        x,
        y0,
        x,
        y1,
        lw,
        v.fillRGB,
        op * 0.85,
        look.n,
        look.pad,
        seed,
        v.halo ?? (v.selected ? 1 : 0)
      )
      if (shadows) this.lineShadows.set(i, x, y0, x, y1, lw, v.fillRGB, op * 0.85)
      if (p.dead) {
        // The death cap only lands once time has actually reached the death year.
        const capOp = tYear != null && tYear < p.endYear ? 0 : op * 0.9
        this.lines.set(capI++, x - 7, y1, x + 7, y1, 3, v.fillRGB, capOp)
      } else {
        this.aliveDots.set(aliveI++, x, y1, 4.5, v.fillRGB, op, 1)
      }
      const layer = v.imageUrl ? this.atlas.request(p.id, v.imageUrl) : -1
      this.avatars.setPosition(i, x, y0)
      this.avatars.setStyle(i, {
        radius: 15 * a.s * aScale,
        fill: v.fillRGB,
        border: v.ring ? rgb(v.ring) : v.selected ? accentRGB : surfaceRGB,
        borderPx: v.ring || v.selected ? 3 : 2.5,
        borderA: 1,
        opacity: op,
        selected: false,
        glow: v.glow || 0,
        avatar: layer >= 1 ? layer : 0
      })
    }

    // Marriages: hanging-rope quadratic + a dot on each lifeline.
    let dotI = 0
    for (let j = 0; j < L.marriages.length; j++) {
      const m = L.marriages[j]
      const v = this._mVis[j]
      const a = this._mAnim.get(m.id)
      const la = this._lane(m.ids[0], m.laneX1)
      const lb = this._lane(m.ids[1], m.laneX2)
      const x1 = this.sx(Math.min(la, lb)),
        x2 = this.sx(Math.max(la, lb))
      const y = this.sy(m.year)
      const sag = conn === 'straight' ? 0 : Math.min(34, 12 + (x2 - x1) * 0.05)
      sampleQuadratic(scratch, SEG, x1, y, (x1 + x2) / 2, y + sag * 2, x2, y)
      this.ribbons.writeCurve(j, scratch, a.w)
      this.ribbons.writeStyle(j, v.colorRGB, conn === 'hidden' ? 0 : a.op, v.dashLen, v.dashGap)
      this.connDots.set(dotI++, x1, y, 3.5, v.colorRGB, v.dotOpacity)
      this.connDots.set(dotI++, x2, y, 3.5, v.colorRGB, v.dotOpacity)
    }

    // Births: rainbow arc from the parent's lifeline into the child's avatar.
    const mCount = L.marriages.length
    for (let j = 0; j < L.births.length; j++) {
      const b = L.births[j]
      const v = this._bVis[j]
      const a = this._bAnim.get(b.id)
      const px = this.sx(this._lane(b.ids[0], b.laneXp)),
        cx = this.sx(this._lane(b.ids[1], b.laneXc))
      const y = this.sy(b.year)
      const dx = cx - px
      const arc = conn === 'straight' ? 0 : Math.min(30, 12 + Math.abs(dx) * 0.045)
      sampleCubic(scratch, SEG, px, y, px + dx * 0.32, y - arc, cx - dx * 0.32, y - arc, cx, y)
      this.ribbons.writeCurve(mCount + j, scratch, a.w)
      this.ribbons.writeStyle(
        mCount + j,
        v.colorRGB,
        conn === 'hidden' ? 0 : a.op,
        v.dashLen,
        v.dashGap
      )
      this.connDots.set(dotI++, px, y, 3.2, v.colorRGB, v.dotOpacity)
    }

    this.lines.commit()
    this.lineShadows.commit()
    this.aliveDots.commit()
    this.connDots.commit()
    this.ribbons.commit()
    this.avatars.commitPositions()
    this.avatars.commitStyles()
    return entranceActive
  }

  // CSS-variable colours (cached per theme).
  _colors() {
    return this._css.get()
  }

  // ── Year grid (bg canvas, screen space) ─────────────────────────────────────
  _tickInfo() {
    const { px, ty } = this.camera2
    const minYear = this.layout.minYear
    const step = TICK_STEPS.find((s) => s * px >= 46) || TICK_STEPS[TICK_STEPS.length - 1]
    const first = Math.floor(((0 - ty - Y_PAD) / px + minYear) / step) * step
    const last = Math.ceil(((this.height - ty - Y_PAD) / px + minYear) / step) * step
    return { step, first, last }
  }

  _drawBg() {
    const ctx = this.bg,
      c = this._colors()
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)
    if (!this.layout.people.length) return
    const { step, first, last } = this._tickInfo()
    const bandH = step * this.camera2.px
    const grid = this.hooks.getStyle?.().grid || 'bands'

    for (let yr = first; yr <= last && grid !== 'none'; yr += step) {
      const y = this.sy(yr)
      if (grid === 'bands' && (yr / step) % 2 === 0) {
        ctx.globalAlpha = 0.025
        ctx.fillStyle = c.t1
        ctx.fillRect(0, y, this.width, bandH)
        ctx.globalAlpha = 1
      }
      ctx.globalAlpha = 0.65
      ctx.strokeStyle = c.border
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(this.width, y)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // Era bands wash over the year grid (chronicleDraw.js).
    drawChronicleBg(this, ctx)

    const refYear = this.hooks.getRefYear()
    const nowY = this.sy(refYear)
    if (nowY >= -30 && nowY <= this.height + 30) {
      ctx.globalAlpha = 0.55
      ctx.strokeStyle = c.accent
      ctx.lineWidth = 1.4
      ctx.setLineDash([7, 5])
      ctx.beginPath()
      ctx.moveTo(0, nowY)
      ctx.lineTo(this.width, nowY)
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
      if (cy < this.height) {
        ctx.fillStyle = this.light ? 'rgba(245, 246, 250, 0.6)' : 'rgba(8, 10, 16, 0.55)'
        ctx.fillRect(0, Math.max(0, cy), this.width, this.height - Math.max(0, cy))
      }
      if (cy >= -30 && cy <= this.height + 30) {
        ctx.save()
        ctx.globalAlpha = 0.9
        ctx.strokeStyle = c.accent
        ctx.lineWidth = 1.8
        ctx.shadowColor = c.accent
        ctx.shadowBlur = 12
        ctx.beginPath()
        ctx.moveTo(0, cy)
        ctx.lineTo(this.width, cy)
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

    // Marriage badges (skip when zoomed so far out they'd pile into soup).
    if (px >= 2.5) {
      for (let j = 0; j < L.marriages.length; j++) {
        const m = L.marriages[j]
        const v = this._mVis[j]
        const a = this._mAnim.get(m.id)
        const alpha = v.badgeOpacity * Math.min(1, a.op / Math.max(v.lineOpacity, 0.001))
        if (alpha <= 0.02) continue
        const la = this._lane(m.ids[0], m.laneX1)
        const lb = this._lane(m.ids[1], m.laneX2)
        const x1 = this.sx(Math.min(la, lb)),
          x2 = this.sx(Math.max(la, lb))
        const cx = (x1 + x2) / 2
        const sag = Math.min(34, 12 + (x2 - x1) * 0.05)
        const midY = this.sy(m.year) + sag
        if (cx + m.bw < -20 || cx - m.bw > this.width + 20 || midY < -30 || midY > this.height + 30)
          continue
        const s = m.id === this.hoverBadgeId ? this._badgeHoverS : 1
        const bw = m.bw * s,
          bh = 22 * s
        ctx.globalAlpha = alpha
        ctx.fillStyle = c.surface
        ctx.strokeStyle = v.color
        ctx.lineWidth = 1.2
        if (m.estimated) ctx.setLineDash([3, 3])
        roundRect(ctx, cx - bw / 2, midY - bh / 2, bw, bh, 11 * s)
        ctx.fill()
        ctx.stroke()
        ctx.setLineDash([])
        // Icon + text centred in the pill as one unit.
        const ink = m.estimated ? c.t3 : c.t1
        ctx.font = `700 ${10.5 * s}px ${font}`
        const isz = 11 * s,
          gap = 4 * s
        const tw = ctx.measureText(m.badge).width
        const left = cx - (isz + gap + tw) / 2
        drawIcon(ctx, m.badgeIcon, left + isz / 2, midY, isz, { color: v.color, lineWidth: 2.3 })
        ctx.fillStyle = ink
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(m.badge, left + isz + gap, midY + 0.5)
        ctx.globalAlpha = 1
        this._badgeRects.push({ x: cx - bw / 2, y: midY - bh / 2, w: bw, h: bh, id: m.id, m })
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
        if (x < -160 || x > this.width + 40) continue
        const v = this._pVis[i]
        const a = this._pAnim.get(p.id)
        const ent = this._entrance(a)
        const y0 = this.sy(p.birthYear) + ent.yOff
        if (y0 < -40 || y0 > this.height + 40) continue
        const alpha = a.op * ent.e
        if (alpha <= 0.02) continue
        ctx.globalAlpha = alpha
        ctx.strokeStyle = c.bg
        ctx.lineWidth = 3
        ctx.font = `700 12.5px ${font}`
        ctx.fillStyle = v.selected ? c.accent : c.t1
        const name = trunc(p.name, nameLen)
        // Beside the avatar: offset by its drawn radius (Style → Portraits).
        const lx = x + 15 * (st.avatarSize ?? 1) * (a.s ?? 1) + 6
        ctx.strokeText(name, lx, y0 - 1)
        ctx.fillText(name, lx, y0 - 1)
        if (ls >= 0.55 && !compact) {
          ctx.font = `600 11px ${font}`
          ctx.fillStyle = c.t3
          ctx.strokeText(p.yearsLabel, lx, y0 + 12)
          ctx.fillText(p.yearsLabel, lx, y0 + 12)
        }
        ctx.globalAlpha = 1
      }
    }

    // Kinship lens pills ("aunt", 表姐, farmor…) floating over each avatar.
    const ov = this.hooks.getOverlay ? this.hooks.getOverlay() : null
    if (ov?.kin) drawKinPills(this, ctx, c, font, ov.kin, st)

    // Year gutter on top of everything.
    ctx.globalAlpha = 0.88
    ctx.fillStyle = c.surface
    ctx.fillRect(0, 0, GUTTER, this.height)
    ctx.globalAlpha = 1
    const { step, first, last } = this._tickInfo()
    ctx.font = `600 10.5px ${font}`
    ctx.fillStyle = c.t3
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let yr = first; yr <= last; yr += step) {
      ctx.fillText(String(yr), GUTTER - 12, this.sy(yr))
    }

    const refYear = this.hooks.getRefYear()
    const nowY = this.sy(refYear)
    if (nowY >= -30 && nowY <= this.height + 30) {
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
    }

    // Time-travel year chip: a filled accent pill riding the curtain edge.
    const tYear = this.hooks.getTimeYear ? this.hooks.getTimeYear() : null
    if (tYear != null) {
      const cy = this.sy(tYear)
      if (cy >= -30 && cy <= this.height + 30) {
        ctx.fillStyle = c.accent
        roundRect(ctx, 6, cy - 10, GUTTER - 14, 20, 7)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = `800 10.5px ${font}`
        ctx.textAlign = 'center'
        ctx.fillText(String(Math.floor(tYear)), 6 + (GUTTER - 14) / 2, cy + 1)
      }
    }

    if (this.mouseY != null) {
      const year = Math.round(
        (this.mouseY - this.camera2.ty - Y_PAD) / this.camera2.px + this.layout.minYear
      )
      ctx.globalAlpha = 0.35
      ctx.strokeStyle = c.t3
      ctx.lineWidth = 1
      ctx.setLineDash([2, 5])
      ctx.beginPath()
      ctx.moveTo(GUTTER, this.mouseY)
      ctx.lineTo(this.width, this.mouseY)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
      ctx.fillStyle = c.elevated
      ctx.strokeStyle = c.border
      roundRect(ctx, 6, this.mouseY - 10, GUTTER - 14, 20, 7)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = c.t1
      ctx.font = `700 10.5px ${font}`
      ctx.textAlign = 'center'
      ctx.fillText(String(year), 6 + (GUTTER - 14) / 2, this.mouseY + 1)
    }

    // The chronicle: era rail + headers, event pills and participant rings.
    drawChronicleFg(this, ctx, c)
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
    if (this.ink) {
      this.inkStrokes.setTime(t)
      this.inkDrops.setTime(t)
      this.inkThreads.setTime(t)
      this.mist.setTime(t)
    }
    this.renderer.render(this.scene, this.camera)

    // Keep animating for tweens/entrance; idle at pulse-only frames (uTime + render,
    // no buffer writes) while any living dot needs its heartbeat (ink: while the
    // mist drifts and the red threads sway — never under reduced motion).
    // A hidden (mounted, off-screen) timeline never keeps an ambient loop.
    const ambient =
      !this._hidden &&
      (this.ink
        ? !this._reduced
        : this.aliveDots.count > 0 || this._ambientOn || (this._lookAnim && !this._reduced))
    if (this._tweening || entranceActive || ambient) this.requestRedraw()
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
    try {
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
      for (const a of this._bAnim.values()) {
        a.op = a.top
        a.w = a.tw
      }
      for (const a of this._laneX.values()) a.x = a.tx
      this._entranceUntil = 0
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
      this.renderer.render(this.scene, this.camera)

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
      this.resize(oldW, oldH) // restores all three canvases + schedules a live redraw
    }
  }

  dispose() {
    this.disposed = true
    this._glCanvas?.removeEventListener('webglcontextlost', this._onContextLost)
    this._glCanvas?.removeEventListener('webglcontextrestored', this._onContextRestored)
    this.atlas.dispose()
    this.ribbons.dispose()
    this.connDots.dispose()
    this.lines.dispose()
    this.lineShadows.dispose()
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
  ctx.save()
  ctx.font = `700 8.5px ${font}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < L.people.length; i++) {
    const p = L.people[i]
    const a = r._pAnim.get(p.id)
    if (!a || a.op < 0.05) continue
    const x = r.sx(r._lane(p.id, p.laneX))
    if (x < -20 || x > r.width + 20) continue
    for (let age = step; p.birthYear + age < p.endYear; age += step) {
      const y = r.sy(p.birthYear + age)
      if (y < -10 || y > r.height + 10) continue
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
