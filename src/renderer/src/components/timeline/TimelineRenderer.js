import * as THREE from 'three'
import { NodeLayer } from '../graph/webgl/NodeLayer.js'
import { AvatarAtlas } from '../graph/webgl/AvatarAtlas.js'
import { approach, TWEEN_EPS } from '../graph/webgl/tween.js'
import { CapsuleLayer } from '../webgl/CapsuleLayer.js'
import { DotLayer } from '../webgl/DotLayer.js'
import { RibbonLayer, sampleQuadratic, sampleCubic, makeScratch } from '../webgl/RibbonLayer.js'
import { createCssColorCache, roundRect, trunc } from '../webgl/overlayUtils.js'
import { GUTTER, Y_PAD, LANE_W } from './timelineLayout.js'

const SEG = 16
const TICK_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000, 2000, 5000]

const _col = new THREE.Color()
function rgb(hex) { _col.set(hex || '#888'); return [_col.r, _col.g, _col.b] }

const easeOutCubic = t => 1 - Math.pow(1 - t, 3)

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
    this._pAnim = new Map()   // person id -> { op, w, s, top, tw, ts, start }
    this._mAnim = new Map()   // marriage id -> { op, w, top, tw }
    this._bAnim = new Map()   // birth id -> { op, w, top, tw }
    this._pVis = []           // cached visuals, index-aligned with layout.people
    this._mVis = []
    this._bVis = []
    this._badgeRects = []     // screen rects of the badges drawn last frame
    this._curve = makeScratch(SEG)

    this.bg = bgCanvas.getContext('2d')
    this.fg = fgCanvas.getContext('2d')
    this._bgCanvas = bgCanvas
    this._fgCanvas = fgCanvas
    this.light = false
    this._css = createCssColorCache()

    this.renderer = new THREE.WebGLRenderer({ canvas: glCanvas, alpha: true, antialias: true })
    this.renderer.setClearColor(0x000000, 0)
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.renderer.setPixelRatio(this.dpr)
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(0, 1, 0, 1, 0.1, 1000)
    this.camera.position.z = 100

    this.atlas = new AvatarAtlas(() => { this._stylesDirty = true; this.requestRedraw() })
    this.ribbons = new RibbonLayer({ segments: SEG, renderOrder: 1 })
    this.connDots = new DotLayer({ renderOrder: 2 })
    this.lines = new CapsuleLayer({ renderOrder: 3 })
    this.aliveDots = new DotLayer({ renderOrder: 4 })
    this.avatars = new NodeLayer({ atlasTexture: this.atlas.texture, pixelRatio: this.dpr })
    this.avatars.mesh.renderOrder = 5
    this.scene.add(this.ribbons.object3d, this.connDots.object3d, this.lines.object3d,
      this.aliveDots.object3d, this.avatars.object3d)

    this._frame = this._frame.bind(this)
    this._glCanvas = glCanvas
    this._onContextLost = (e) => e.preventDefault()
    this._onContextRestored = () => { this.markAllDirty(); this.requestRedraw() }
    glCanvas.addEventListener('webglcontextlost', this._onContextLost, false)
    glCanvas.addEventListener('webglcontextrestored', this._onContextRestored, false)
  }

  // ── Coordinate helpers ──────────────────────────────────────────────────────
  sx(laneX) { return laneX * this.camera2.ls + this.camera2.tx }
  sy(year) { return (year - this.layout.minYear) * this.camera2.px + Y_PAD + this.camera2.ty }

  resize(w, h) {
    this.width = w; this.height = h
    this.renderer.setSize(w, h, false)
    this.camera.left = 0; this.camera.right = w; this.camera.top = 0; this.camera.bottom = h
    this.camera.updateProjectionMatrix()
    for (const c of [this._bgCanvas, this._fgCanvas]) {
      c.width = Math.round(w * this.dpr)
      c.height = Math.round(h * this.dpr)
      c.style.width = w + 'px'
      c.style.height = h + 'px'
    }
    this.markAllDirty()
    this.requestRedraw()
  }

  setCamera(cam) { this.camera2 = cam; this._geomDirty = true; this.requestRedraw() }

  setTheme(isLight) {
    this.light = isLight
    this._css.invalidate()
    this.avatars.setThemeUniforms(isLight)
    this.markAllDirty()
    this.requestRedraw()
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
    const n = layout.people.length
    const dead = layout.people.reduce((s, p) => s + (p.dead ? 1 : 0), 0)
    this.lines.setCount(n + dead)
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
    const alive = new Set(layout.people.map(p => p.id))
    for (const id of this._pAnim.keys()) if (!alive.has(id)) this._pAnim.delete(id)
    this.markAllDirty()
    this.requestRedraw()
  }

  markStylesDirty() { this._stylesDirty = true; this.requestRedraw() }
  markAllDirty() { this._geomDirty = true; this._stylesDirty = true }

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
      if (!a) { a = { op: 0, w: v.lineWidth, s: v.avatarScale }; this._pAnim.set(p.id, a) }
      a.top = v.opacity; a.tw = v.lineWidth; a.ts = v.avatarScale
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
      if (!a) { a = { op: 0, w: v.width }; this._mAnim.set(m.id, a) }
      a.top = v.lineOpacity; a.tw = v.width
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
      if (!a) { a = { op: 0, w: v.width }; this._bAnim.set(b.id, a) }
      a.top = v.lineOpacity; a.tw = v.width
    }
    for (const id of this._bAnim.keys()) if (!seenB.has(id)) this._bAnim.delete(id)
  }

  _step(dt) {
    let moving = false
    const step2 = (a) => {
      a.op = approach(a.op, a.top, dt); a.w = approach(a.w, a.tw, dt)
      if (Math.abs(a.op - a.top) > TWEEN_EPS || Math.abs(a.w - a.tw) > TWEEN_EPS) moving = true
    }
    for (const a of this._pAnim.values()) {
      step2(a)
      a.s = approach(a.s, a.ts, dt)
      if (Math.abs(a.s - a.ts) > TWEEN_EPS) moving = true
    }
    for (const a of this._mAnim.values()) step2(a)
    for (const a of this._bAnim.values()) step2(a)
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
    if (t >= 1) { a.start = null; return { e: 1, yOff: 0 } }
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

    // People: lifelines + dead caps + alive dots + avatar pins.
    let capI = L.people.length
    let aliveI = 0
    for (let i = 0; i < L.people.length; i++) {
      const p = L.people[i]
      const v = this._pVis[i]
      const a = this._pAnim.get(p.id)
      const ent = this._entrance(a)
      const op = a.op * ent.e
      const x = this.sx(p.laneX)
      const y0 = this.sy(p.birthYear) + ent.yOff
      const y1 = Math.max(this.sy(p.endYear), this.sy(p.birthYear) + 8) + ent.yOff
      this.lines.set(i, x, y0, x, y1, a.w, v.fillRGB, op * 0.85)
      if (p.dead) {
        this.lines.set(capI++, x - 7, y1, x + 7, y1, 3, v.fillRGB, op * 0.9)
      } else {
        this.aliveDots.set(aliveI++, x, y1, 4.5, v.fillRGB, op, 1)
      }
      const layer = v.imageUrl ? this.atlas.request(p.id, v.imageUrl) : -1
      this.avatars.setPosition(i, x, y0)
      this.avatars.setStyle(i, {
        radius: 15 * a.s,
        fill: v.fillRGB,
        border: v.selected ? accentRGB : surfaceRGB,
        borderPx: v.selected ? 3 : 2.5,
        borderA: 1,
        opacity: op,
        selected: false,
        glow: v.glow || 0,
        avatar: layer >= 1 ? layer : 0,
      })
    }

    // Marriages: hanging-rope quadratic + a dot on each lifeline.
    let dotI = 0
    for (let j = 0; j < L.marriages.length; j++) {
      const m = L.marriages[j]
      const v = this._mVis[j]
      const a = this._mAnim.get(m.id)
      const x1 = this.sx(m.laneX1), x2 = this.sx(m.laneX2)
      const y = this.sy(m.year)
      const sag = Math.min(34, 12 + (x2 - x1) * 0.05)
      sampleQuadratic(scratch, SEG, x1, y, (x1 + x2) / 2, y + sag * 2, x2, y)
      this.ribbons.writeCurve(j, scratch, a.w)
      this.ribbons.writeStyle(j, v.colorRGB, a.op, v.dashLen, v.dashGap)
      this.connDots.set(dotI++, x1, y, 3.5, v.colorRGB, v.dotOpacity)
      this.connDots.set(dotI++, x2, y, 3.5, v.colorRGB, v.dotOpacity)
    }

    // Births: rainbow arc from the parent's lifeline into the child's avatar.
    const mCount = L.marriages.length
    for (let j = 0; j < L.births.length; j++) {
      const b = L.births[j]
      const v = this._bVis[j]
      const a = this._bAnim.get(b.id)
      const px = this.sx(b.laneXp), cx = this.sx(b.laneXc)
      const y = this.sy(b.year)
      const dx = cx - px
      const arc = Math.min(30, 12 + Math.abs(dx) * 0.045)
      sampleCubic(scratch, SEG, px, y, px + dx * 0.32, y - arc, cx - dx * 0.32, y - arc, cx, y)
      this.ribbons.writeCurve(mCount + j, scratch, a.w)
      this.ribbons.writeStyle(mCount + j, v.colorRGB, a.op, v.dashLen, v.dashGap)
      this.connDots.set(dotI++, px, y, 3.2, v.colorRGB, v.dotOpacity)
    }

    this.lines.commit()
    this.aliveDots.commit()
    this.connDots.commit()
    this.ribbons.commit()
    this.avatars.commitPositions()
    this.avatars.commitStyles()
    return entranceActive
  }

  // CSS-variable colours (cached per theme).
  _colors() { return this._css.get() }

  // ── Year grid (bg canvas, screen space) ─────────────────────────────────────
  _tickInfo() {
    const { px, ty } = this.camera2
    const minYear = this.layout.minYear
    const step = TICK_STEPS.find(s => s * px >= 46) || TICK_STEPS[TICK_STEPS.length - 1]
    const first = Math.floor(((0 - ty - Y_PAD) / px + minYear) / step) * step
    const last = Math.ceil(((this.height - ty - Y_PAD) / px + minYear) / step) * step
    return { step, first, last }
  }

  _drawBg() {
    const ctx = this.bg, c = this._colors()
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)
    if (!this.layout.people.length) return
    const { step, first, last } = this._tickInfo()
    const bandH = step * this.camera2.px

    for (let yr = first; yr <= last; yr += step) {
      const y = this.sy(yr)
      if ((yr / step) % 2 === 0) {
        ctx.globalAlpha = 0.025
        ctx.fillStyle = c.t1
        ctx.fillRect(0, y, this.width, bandH)
        ctx.globalAlpha = 1
      }
      ctx.globalAlpha = 0.65
      ctx.strokeStyle = c.border
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.width, y); ctx.stroke()
      ctx.globalAlpha = 1
    }

    const refYear = this.hooks.getRefYear()
    const nowY = this.sy(refYear)
    if (nowY >= -30 && nowY <= this.height + 30) {
      ctx.globalAlpha = 0.55
      ctx.strokeStyle = c.accent
      ctx.lineWidth = 1.4
      ctx.setLineDash([7, 5])
      ctx.beginPath(); ctx.moveTo(0, nowY); ctx.lineTo(this.width, nowY); ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }
  }

  // ── Labels / badges / gutter (fg canvas) ────────────────────────────────────
  _drawFg() {
    const ctx = this.fg, c = this._colors(), L = this.layout
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
        const x1 = this.sx(m.laneX1), x2 = this.sx(m.laneX2)
        const cx = (x1 + x2) / 2
        const sag = Math.min(34, 12 + (x2 - x1) * 0.05)
        const midY = this.sy(m.year) + sag
        if (cx + m.bw < -20 || cx - m.bw > this.width + 20 || midY < -30 || midY > this.height + 30) continue
        const s = m.id === this.hoverBadgeId ? this._badgeHoverS : 1
        const bw = m.bw * s, bh = 22 * s
        ctx.globalAlpha = alpha
        ctx.fillStyle = c.surface
        ctx.strokeStyle = v.color
        ctx.lineWidth = 1.2
        if (m.estimated) ctx.setLineDash([3, 3])
        roundRect(ctx, cx - bw / 2, midY - bh / 2, bw, bh, 11 * s)
        ctx.fill(); ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = m.estimated ? c.t3 : c.t1
        ctx.font = `700 ${10.5 * s}px ${font}`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(m.badge, cx, midY + 0.5)
        ctx.globalAlpha = 1
        this._badgeRects.push({ x: cx - bw / 2, y: midY - bh / 2, w: bw, h: bh, id: m.id, m })
      }
    }

    // Person labels — culled to the viewport, truncated harder as lanes tighten,
    // skipped entirely once lanes are too close to read.
    if (150 * ls >= 14) {
      const nameLen = ls < 0.45 ? 6 : ls < 0.7 ? 10 : 17
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
      ctx.lineJoin = 'round'
      for (let i = 0; i < L.people.length; i++) {
        const p = L.people[i]
        const x = this.sx(p.laneX)
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
        ctx.strokeText(name, x + 21, y0 - 1)
        ctx.fillText(name, x + 21, y0 - 1)
        if (ls >= 0.55) {
          ctx.font = `600 10px ${font}`
          ctx.fillStyle = c.t3
          ctx.strokeText(p.yearsLabel, x + 21, y0 + 12)
          ctx.fillText(p.yearsLabel, x + 21, y0 + 12)
        }
        ctx.globalAlpha = 1
      }
    }

    // Year gutter on top of everything.
    ctx.globalAlpha = 0.88
    ctx.fillStyle = c.surface
    ctx.fillRect(0, 0, GUTTER, this.height)
    ctx.globalAlpha = 1
    const { step, first, last } = this._tickInfo()
    ctx.font = `600 10.5px ${font}`
    ctx.fillStyle = c.t3
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
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
      ctx.fill(); ctx.stroke()
      ctx.globalAlpha = 1
      ctx.fillStyle = c.accent
      ctx.font = `700 10.5px ${font}`
      ctx.textAlign = 'center'
      ctx.fillText(String(refYear), GUTTER / 2 + 1, nowY + 1)
    }

    if (this.mouseY != null) {
      const year = Math.round((this.mouseY - this.camera2.ty - Y_PAD) / this.camera2.px + this.layout.minYear)
      ctx.globalAlpha = 0.35
      ctx.strokeStyle = c.t3
      ctx.lineWidth = 1
      ctx.setLineDash([2, 5])
      ctx.beginPath(); ctx.moveTo(GUTTER, this.mouseY); ctx.lineTo(this.width, this.mouseY); ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
      ctx.fillStyle = c.elevated
      ctx.strokeStyle = c.border
      roundRect(ctx, 6, this.mouseY - 10, GUTTER - 14, 20, 7)
      ctx.fill(); ctx.stroke()
      ctx.fillStyle = c.t1
      ctx.font = `700 10.5px ${font}`
      ctx.textAlign = 'center'
      ctx.fillText(String(year), GUTTER / 2 + 1, this.mouseY + 1)
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

    if (this._stylesDirty) { this._syncStyles(); this._stylesDirty = false; this._tweening = true; this._geomDirty = true }
    if (this._tweening) {
      this._tweening = this._step(dt)
      this._geomDirty = true
    }

    let entranceActive = false
    const full = this._geomDirty
    if (full) {
      entranceActive = this._writeBuffers()
      this._geomDirty = entranceActive || this._tweening
      this.atlas.flush()
      this._drawBg()
      this._drawFg()
      this._uiDirty = false
    } else if (this._uiDirty) {
      this._drawFg()
      this._uiDirty = false
    }

    const t = this._timeSec
    this.aliveDots.setTime(t)
    this.connDots.setTime(t)
    this.lines.setTime(t)
    this.renderer.render(this.scene, this.camera)

    // Keep animating for tweens/entrance; idle at pulse-only frames (uTime + render,
    // no buffer writes) while any living dot needs its heartbeat.
    if (this._tweening || entranceActive || this.aliveDots.count > 0) this.requestRedraw()
  }

  dispose() {
    this.disposed = true
    this._glCanvas?.removeEventListener('webglcontextlost', this._onContextLost)
    this._glCanvas?.removeEventListener('webglcontextrestored', this._onContextRestored)
    this.atlas.dispose()
    this.ribbons.dispose(); this.connDots.dispose(); this.lines.dispose()
    this.aliveDots.dispose(); this.avatars.dispose()
    this.renderer.dispose()
    // The view unmounts on every view switch — release the GL context eagerly so
    // rapid switching can't exhaust the browser's context pool before GC runs.
    this.renderer.forceContextLoss()
  }
}

