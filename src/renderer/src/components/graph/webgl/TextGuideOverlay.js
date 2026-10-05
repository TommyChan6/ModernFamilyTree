import { worldToScreen } from './coords.js'
import { INK_FONTS, inkFontsReady } from '../../../lib/inkArt'

// A transparent 2D canvas layered over the WebGL canvas. It draws everything textual or
// low-count: node name/age labels (viewport-culled, LOD by zoom) and the guide lines,
// current-year line and gen-preview line. Redrawn each frame from the shared camera.
export class TextGuideOverlay {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.dpr = 1
    this.w = 0
    this.h = 0
    this.transform = { x: 0, y: 0, k: 1 }
    this.light = false
    // 水墨: null | 'paper' | 'moon' | 'light' — calligraphy labels + ink guides.
    this.ink = null
    this.inkFontOk = false
    this.onFontsReady = null
    // Descriptors set by GraphCanvas/guideLines (all in WORLD coords).
    this.guides = [] // [{ y, label, kind:'year'|'gen', opacity }]
    this.currentYear = null // { y, label, opacity }
    this.genPreview = null // { y, label, opacity }
  }

  setCamera(t) {
    this.transform = t
  }
  setTheme(isLight) {
    this.light = isLight
  }
  setInk(mode) {
    this.ink = mode || null
    if (this.ink && !this.inkFontOk)
      inkFontsReady().then(() => {
        this.inkFontOk = true
        this.onFontsReady?.()
      })
  }

  resize(w, h, dpr) {
    this.w = w
    this.h = h
    this.dpr = dpr
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.canvas.style.width = w + 'px'
    this.canvas.style.height = h + 'px'
  }

  _colors() {
    const l = this.light
    if (this.ink) return this._inkColors()
    return {
      name: l ? '#4a5068' : 'rgba(232,234,246,0.85)',
      age: l ? '#9099b8' : 'rgba(158,163,184,0.85)',
      sel: '#6c8ef5',
      yearStroke: l ? 'rgba(0,0,0,0.10)' : 'rgba(232,234,246,0.12)',
      yearFill: l ? 'rgba(0,0,0,0.42)' : 'rgba(232,234,246,0.5)',
      genStroke: l ? 'rgba(0,0,0,0.08)' : 'rgba(232,234,246,0.10)',
      genFill: l ? 'rgba(0,0,0,0.20)' : 'rgba(232,234,246,0.25)',
      cyStroke: l ? 'rgba(108,142,245,0.75)' : 'rgba(108,142,245,0.65)',
      cyFill: l ? 'rgba(108,142,245,0.9)' : 'rgba(108,142,245,0.85)',
      pvStroke: l ? 'rgba(108,142,245,0.45)' : 'rgba(108,142,245,0.35)',
      pvFill: l ? 'rgba(108,142,245,0.55)' : 'rgba(108,142,245,0.45)',
      handleArm: l ? 'rgba(108,142,245,0.7)' : 'rgba(108,142,245,0.75)',
      handleFill: '#6c8ef5',
      handleRing: l ? '#ffffff' : '#e8eaf6',
      handleGlow: 'rgba(108,142,245,0.8)'
    }
  }

  // Ink palette: names in ink (pale ink when moonlit) with a paper halo; guides
  // as faint washes; the present line and selection in cinnabar.
  _inkColors() {
    const moon = this.ink === 'moon'
    const ink = moon ? 'rgba(228,220,203,' : 'rgba(31,27,22,'
    const red = moon ? 'rgba(212,96,79,' : 'rgba(179,53,42,'
    return {
      name: ink + '0.92)',
      age: moon ? 'rgba(200,170,120,0.9)' : 'rgba(140,100,52,0.95)',
      sel: red + '1)',
      halo: moon ? 'rgba(15,17,23,0.75)' : 'rgba(240,232,214,0.9)',
      yearStroke: ink + '0.13)',
      yearFill: ink + '0.55)',
      genStroke: ink + '0.10)',
      genFill: ink + '0.32)',
      cyStroke: red + '0.7)',
      cyFill: red + '0.95)',
      pvStroke: red + '0.4)',
      pvFill: red + '0.6)',
      handleArm: red + '0.7)',
      handleFill: red + '1)',
      handleRing: moon ? '#e4dccb' : '#f5efe0',
      handleGlow: red + '0.6)'
    }
  }

  // opts: { gs, nodes, showLabels, showAge, selectedId, labelOpacityOf(n), ageOf(n),
  //         curveHandles? }
  draw(opts) {
    const ctx = this.ctx,
      t = this.transform,
      c = this._colors()
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.w, this.h)

    // ---- the chronicle on the Birth layout: era bands + event markers ----
    if (opts.chronicle) this._drawChronicle(opts.chronicle)

    // Guide lines span the horizontal extent of the nodes (± margin), like the old SVG.
    let x1 = 30,
      x2 = 800
    if (
      (this.guides.length || this.currentYear || this.genPreview) &&
      opts.nodes &&
      opts.nodes.length
    ) {
      let mn = Infinity,
        mx = -Infinity
      for (const n of opts.nodes) {
        if (n.x < mn) mn = n.x
        if (n.x > mx) mx = n.x
      }
      x1 = mn - 120
      x2 = mx + 120
    }

    // ---- guides (behind labels) ----
    const drawGuide = (y, label, stroke, fill, dash, lineW, weight) => {
      const s1 = worldToScreen(x1, y, t)
      const s2 = worldToScreen(x2, y, t)
      ctx.save()
      ctx.strokeStyle = stroke
      ctx.lineWidth = lineW
      ctx.setLineDash(dash)
      ctx.beginPath()
      ctx.moveTo(s1.x, s1.y)
      ctx.lineTo(s2.x, s2.y)
      ctx.stroke()
      ctx.setLineDash([])
      if (label != null) {
        ctx.fillStyle = fill
        ctx.font = this.ink ? `13px ${INK_FONTS.kai}` : `${weight} 10px system-ui, sans-serif`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        // Clamp into the viewport so the year stays readable when the line's
        // world-space left end has scrolled off-screen (zoomed in). The left
        // clamp sits clear of the Time-travel slider panel (~86px wide).
        ctx.fillText(label, Math.min(Math.max(s1.x - 14, 128), this.w - 12), s1.y)
      }
      ctx.restore()
    }
    for (const g of this.guides) {
      const isYear = g.kind === 'year'
      // Adaptive subdivisions (minor year lines) sit back behind the majors.
      ctx.globalAlpha = (g.opacity ?? 1) * (g.minor ? 0.55 : 1)
      drawGuide(
        g.y,
        g.label,
        isYear ? c.yearStroke : c.genStroke,
        isYear ? c.yearFill : c.genFill,
        isYear ? (g.minor ? [3, 5] : [6, 4]) : [8, 5],
        1,
        g.minor ? 500 : 600
      )
    }
    ctx.globalAlpha = 1
    if (this.currentYear) {
      ctx.globalAlpha = this.currentYear.opacity ?? 1
      drawGuide(this.currentYear.y, this.currentYear.label, c.cyStroke, c.cyFill, [], 1.5, 700)
      ctx.globalAlpha = 1
    }
    if (this.genPreview) {
      ctx.globalAlpha = this.genPreview.opacity ?? 1
      drawGuide(this.genPreview.y, this.genPreview.label, c.pvStroke, c.pvFill, [6, 4], 1.5, 600)
      ctx.globalAlpha = 1
    }

    // ---- node labels (screen space, culled + LOD) ----
    // ---- Spotlight layout: the stage light, ring guides, the lead's halo ----
    if (opts.spotlight) this._drawSpotlight(opts.spotlight)

    if (opts.showLabels) this._drawLabels(opts, c)

    // ---- kinship lens: the reveal ripple + kin-name pills above nodes ----
    if (opts.kinLens) this._drawKin(opts.kinLens, opts)

    // ---- bezier edit handles (on top of everything) ----
    if (opts.curveHandles) this._drawCurveHandles(opts.curveHandles, c)
  }

  _drawLabels(opts, c) {
    const ctx = this.ctx,
      t = this.transform
    const gs = opts.gs
    // Calligraphy (楷) runs a little small for its em box — give it more room.
    const ink = !!this.ink
    const fontPx = gs.labelSize * t.k * (ink ? 1.3 : 1)
    if (fontPx < 7) return // LOD: unreadable when zoomed far out -> skip entirely
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    if (ink) return this._drawInkLabels(opts, c, fontPx)
    const margin = 60
    for (const n of opts.nodes) {
      const s = worldToScreen(n.x, n.y, t)
      if (s.x < -margin || s.x > this.w + margin || s.y < -margin || s.y > this.h + margin) continue
      const op = opts.labelOpacityOf ? opts.labelOpacityOf(n) : 1
      if (op <= 0.01) continue
      const y = s.y + (gs.nodeRadius + 14) * t.k
      // The trait system composes the full node label (name-slot words + any
      // "show in graph" values); pre-trait nodes fall back to the first name.
      const first = n.graph_label ?? (n.name ? n.name.split(' ')[0] : '')
      ctx.globalAlpha = op
      ctx.font = `500 ${fontPx}px system-ui, sans-serif`
      ctx.fillStyle = opts.selectedId === n.id ? c.sel : c.name
      const age = opts.showAge && opts.ageOf ? opts.ageOf(n) : null
      if (age != null) {
        ctx.fillText(first, s.x, y)
        ctx.font = `600 ${fontPx}px system-ui, sans-serif`
        ctx.fillStyle = c.age
        const nameW = ctx.measureText(first).width
        ctx.textAlign = 'left'
        ctx.fillText(String(age), s.x + nameW / 2 + 4 * t.k, y)
        ctx.textAlign = 'center'
      } else {
        ctx.fillText(first, s.x, y)
      }
    }
    ctx.globalAlpha = 1
  }

  // 水墨 labels: names brushed in 楷书 with a soft paper halo (so a stroke passing
  // behind never cuts the characters); the selected name in cinnabar; age as a
  // small ochre annotation.
  _drawInkLabels(opts, c, fontPx) {
    const ctx = this.ctx,
      t = this.transform,
      gs = opts.gs
    const font = `${fontPx.toFixed(1)}px ${INK_FONTS.kai}`
    const ageFont = `${(fontPx * 0.78).toFixed(1)}px ${INK_FONTS.kai}`
    const margin = 60
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(2, fontPx * 0.32)
    ctx.strokeStyle = c.halo
    for (const n of opts.nodes) {
      const s = worldToScreen(n.x, n.y, t)
      if (s.x < -margin || s.x > this.w + margin || s.y < -margin || s.y > this.h + margin) continue
      const op =
        (opts.labelOpacityOf ? opts.labelOpacityOf(n) : 1) * (opts.revealOf ? opts.revealOf(n) : 1)
      if (op <= 0.01) continue
      const y = s.y + (gs.nodeRadius + 12) * t.k + fontPx * 0.7
      const first = n.graph_label ?? (n.name ? n.name.split(' ')[0] : '')
      ctx.globalAlpha = op
      ctx.font = font
      ctx.textAlign = 'center'
      ctx.strokeText(first, s.x, y)
      ctx.fillStyle = opts.selectedId === n.id ? c.sel : c.name
      ctx.fillText(first, s.x, y)
      const age = opts.showAge && opts.ageOf ? opts.ageOf(n) : null
      if (age != null) {
        const nameW = ctx.measureText(first).width
        ctx.font = ageFont
        ctx.textAlign = 'left'
        const ax = s.x + nameW / 2 + 4 * t.k
        ctx.strokeText(String(age), ax, y)
        ctx.fillStyle = c.age
        ctx.fillText(String(age), ax, y)
      }
    }
    ctx.textAlign = 'center'
    ctx.globalAlpha = 1
  }

  // sp: { x, y (main character, world), rings: [{ r, label, count, ring }],
  //       color, light, radius (node radius, world) }
  // A soft pool of stage light around the main character, slowly turning
  // dashed ring guides (each labelled at its crown), and a halo of light rays
  // wheeling around the lead. Animated off performance.now() — the main
  // character's node glow keeps the renderer's loop running meanwhile.
  // ch: { yOf(year) → world y, eras: [{ name, icon, color, a, b, lane }],
  //       events: [{ title, icon, color, a, importance }], light }
  // The Birth layout's year axis IS the chronicle's axis: eras wash across it
  // as soft bands (a colour rail at the left edge, a sticky name pill at the
  // band's top) and events sit on a rail as icon pills with a faint hairline.
  // Drawn first, so guides, labels and everything else sit above.
  _drawChronicle(ch) {
    const ctx = this.ctx,
      t = this.transform
    const W = this.w,
      H = this.h
    const RAIL = 96 // clear of the full-height Time slider at the left edge
    const STICKY = 172 // under the top-left minimap
    const sy = (year) => worldToScreen(0, ch.yOf(year), t).y
    const surface = ch.light ? 'rgba(255,255,255,0.94)' : 'rgba(18,21,31,0.88)'
    const font = 'system-ui, sans-serif'
    const placed = []
    ctx.save()
    for (const e of ch.eras) {
      const y0 = Number.isFinite(e.a) ? sy(e.a) : -20
      const y1 = Number.isFinite(e.b) ? sy(e.b) : H + 20
      if (y1 < 0 || y0 > H || y1 - y0 < 1) continue
      const rgb = hexRgb(e.color)
      const col = (a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`
      ctx.fillStyle = col(ch.light ? 0.06 : 0.07)
      ctx.fillRect(0, Math.max(0, y0), W, Math.min(H, y1) - Math.max(0, y0))
      ctx.fillStyle = col(0.85)
      ctx.fillRect(RAIL - 12 + e.lane * 5, Math.max(0, y0), 3, Math.min(H, y1) - Math.max(0, y0))
      ctx.strokeStyle = col(0.35)
      ctx.setLineDash([6, 6])
      ctx.lineWidth = 1
      for (const y of [y0, y1]) {
        if (y < 0 || y > H) continue
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(W, y)
        ctx.stroke()
      }
      ctx.setLineDash([])
      if (y1 - y0 < 26) continue
      const label = `${e.icon ? e.icon + ' ' : ''}${e.name}`
      ctx.font = `800 10.5px ${font}`
      const w = ctx.measureText(label).width + 22
      const h = 20
      const hy = Math.min(Math.max(y0 + 6, STICKY), y1 - h - 4)
      const hx = RAIL + e.lane * 12
      ctx.fillStyle = surface
      ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(hx, hy, w, h, 10)
      else ctx.rect(hx, hy, w, h)
      ctx.fill()
      ctx.strokeStyle = col(0.7)
      ctx.stroke()
      ctx.fillStyle = col(1)
      ctx.fillRect(hx + 5, hy + 5, 3, h - 10)
      ctx.fillStyle = ch.light ? '#1a1d2e' : '#e8eaf6'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, hx + 13, hy + h / 2 + 0.5)
      placed.push({ x: hx, y: hy, w, h })
    }
    const k = t.k * (t.sy ?? 1)
    for (const ev of ch.events) {
      if (!Number.isFinite(ev.a)) continue
      if (ev.importance === 1 && k < 0.8) continue
      const y = sy(ev.a)
      if (y < -20 || y > H + 20) continue
      const rgb = hexRgb(ev.color)
      const col = (a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`
      ctx.strokeStyle = col(0.3)
      ctx.setLineDash([3, 5])
      ctx.beginPath()
      ctx.moveTo(RAIL, y)
      ctx.lineTo(W, y)
      ctx.stroke()
      ctx.setLineDash([])
      const big = ev.importance === 3
      const title = ev.title.length > 26 ? ev.title.slice(0, 25) + '…' : ev.title
      ctx.font = `${big ? 800 : 700} 10.5px ${font}`
      const h = 19
      const w = ctx.measureText(title).width + h + 12
      let x = RAIL
      for (let pass = 0; pass < 6; pass++) {
        let moved = false
        for (const q of placed) {
          if (Math.abs(q.y - (y - h / 2)) < h + 2 && x < q.x + q.w + 4 && x + w > q.x - 4) {
            x = q.x + q.w + 6
            moved = true
          }
        }
        if (!moved) break
      }
      placed.push({ x, y: y - h / 2, w, h })
      ctx.fillStyle = surface
      ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(x, y - h / 2, w, h, h / 2)
      else ctx.rect(x, y - h / 2, w, h)
      ctx.shadowColor = col(0.5)
      ctx.shadowBlur = big ? 10 : 5
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.strokeStyle = col(0.8)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x + h / 2, y, h / 2 - 2.5, 0, Math.PI * 2)
      ctx.fillStyle = col(0.3)
      ctx.fill()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `10.5px ${font}`
      ctx.fillStyle = ch.light ? '#1a1d2e' : '#e8eaf6'
      ctx.fillText(ev.icon, x + h / 2, y + 0.5)
      ctx.textAlign = 'left'
      ctx.font = `${big ? 800 : 700} 10.5px ${font}`
      ctx.fillText(title, x + h + 3, y + 0.5)
    }
    ctx.restore()
  }

  _drawSpotlight(sp) {
    const ctx = this.ctx,
      t = this.transform
    const now = performance.now() / 1000
    const s = worldToScreen(sp.x, sp.y, t)
    const k = t.k
    const col = sp.color || '#f5c542'
    const rgb = hexRgb(col)
    const rgba = (a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`
    ctx.save()

    // Stage light: a warm pool fading out past the inner circle.
    const inner = (sp.rings[0]?.r || 180) * k
    const pool = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, inner * 1.15)
    pool.addColorStop(0, rgba(sp.light ? 0.16 : 0.2))
    pool.addColorStop(0.55, rgba(sp.light ? 0.06 : 0.07))
    pool.addColorStop(1, rgba(0))
    ctx.fillStyle = pool
    ctx.beginPath()
    ctx.arc(s.x, s.y, inner * 1.15, 0, Math.PI * 2)
    ctx.fill()

    // Ring guides — alternate rings turn opposite ways.
    ctx.font = '700 9.5px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    sp.rings.forEach((ring, i) => {
      const r = ring.r * k
      if (r < 4) return
      const outsider = ring.ring < 0
      ctx.save()
      ctx.globalAlpha = outsider ? 0.32 : Math.max(0.22, 0.55 - i * 0.07)
      ctx.strokeStyle = outsider
        ? sp.light
          ? 'rgba(0,0,0,0.35)'
          : 'rgba(232,234,246,0.35)'
        : rgba(sp.light ? 0.75 : 0.65)
      ctx.lineWidth = outsider ? 1 : 1.3
      ctx.setLineDash(outsider ? [2, 7] : [7, 6])
      ctx.lineDashOffset = (i % 2 ? 1 : -1) * now * (14 - i)
      ctx.beginPath()
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
      // Label pill at the top of the ring.
      const label = `${ring.label} · ${ring.count}`
      // In the ring's widest empty arc (from the layout), so it never sits
      // on anyone; lower-left (the usual quiet bearing) as a fallback.
      const la = ring.labelAngle ?? Math.PI * 0.75
      const lx = s.x + Math.cos(la) * r,
        ly = s.y + Math.sin(la) * r
      if (ly < -20 || ly > this.h + 20 || lx < -120 || lx > this.w + 120) return
      const w = ctx.measureText(label).width + 16
      ctx.save()
      ctx.globalAlpha = 0.92
      ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(lx - w / 2, ly - 9, w, 18, 9)
      else ctx.rect(lx - w / 2, ly - 9, w, 18)
      ctx.fillStyle = sp.light ? 'rgba(255,255,255,0.92)' : 'rgba(15,17,23,0.82)'
      ctx.fill()
      ctx.strokeStyle = outsider ? 'rgba(140,146,166,0.6)' : rgba(0.6)
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = outsider ? (sp.light ? '#6b7186' : '#a6abc0') : col
      ctx.fillText(label.toUpperCase(), lx, ly + 0.5)
      ctx.restore()
    })

    // The lead's halo: wheeling rays + a breathing double ring.
    const nr = (sp.radius || 22) * k * 1.5
    const rays = 12
    ctx.save()
    ctx.translate(s.x, s.y)
    ctx.rotate(now * 0.35)
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2
      const len = nr * (1.9 + 0.35 * Math.sin(now * 2.2 + i * 1.7))
      const g = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len)
      g.addColorStop(0, rgba(0))
      g.addColorStop(0.45, rgba(sp.light ? 0.32 : 0.38))
      g.addColorStop(1, rgba(0))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(Math.cos(a - 0.07) * nr * 0.9, Math.sin(a - 0.07) * nr * 0.9)
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len)
      ctx.lineTo(Math.cos(a + 0.07) * nr * 0.9, Math.sin(a + 0.07) * nr * 0.9)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
    const breathe = 0.5 + 0.5 * Math.sin(now * 2.4)
    for (let j = 0; j < 2; j++) {
      ctx.beginPath()
      ctx.arc(s.x, s.y, nr * (1.08 + j * 0.22 + breathe * 0.06), 0, Math.PI * 2)
      ctx.strokeStyle = rgba((j ? 0.35 : 0.8) * (0.6 + 0.4 * breathe))
      ctx.lineWidth = j ? 1 : 2
      ctx.shadowColor = col
      ctx.shadowBlur = 12
      ctx.stroke()
    }
    // A small crown above the lead.
    ctx.shadowBlur = 0
    ctx.font = `${Math.max(12, 15 * Math.min(1.4, k))}px system-ui, sans-serif`
    ctx.globalAlpha = 0.95
    ctx.fillText('👑', s.x, s.y - nr * 1.55 - Math.sin(now * 2) * 2)
    ctx.restore()
  }

  // kin: { labels: Map id → { text, color, rank }, reveal(id) → 0..1,
  //        hidden(n), wave: { x, y, r, alpha, color } | null, light }
  // Pills float above each node naming what it is to the viewpoint person.
  // Closest kin claim space first; a pill that would overlap one already
  // placed is skipped (a coarse screen-space declutter), and far zoom keeps
  // only the closest ranks. Each pill rises + fades in with its reveal.
  _drawKin(kin, opts) {
    const ctx = this.ctx,
      t = this.transform
    const gs = opts.gs

    if (kin.wave) {
      const w = kin.wave
      const s = worldToScreen(w.x, w.y, t)
      ctx.save()
      for (let i = 0; i < 2; i++) {
        const r = Math.max(0, w.r - i * 90)
        if (r <= 0) continue
        ctx.globalAlpha = Math.max(0, w.alpha * (i ? 0.35 : 0.6))
        ctx.strokeStyle = w.color
        ctx.lineWidth = i ? 1.5 : 2.5
        ctx.shadowColor = w.color
        ctx.shadowBlur = 14
        ctx.beginPath()
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()
    }

    const labels = kin.labels
    if (!labels || !labels.size) return
    const maxRank = t.k < 0.28 ? 2 : t.k < 0.45 ? 4 : Infinity
    const cands = []
    const margin = 40
    for (const n of opts.nodes) {
      const L = labels.get(n.id)
      if (!L || L.rank > maxRank) continue
      if (kin.hidden && kin.hidden(n)) continue
      const s = worldToScreen(n.x, n.y, t)
      if (s.x < -margin || s.x > this.w + margin || s.y < -margin || s.y > this.h + margin) continue
      const p = kin.reveal ? kin.reveal(n.id) : 1
      if (p <= 0.01) continue
      cands.push({ n, L, s, p })
    }
    cands.sort((a, b) => a.L.rank - b.L.rank)

    ctx.save()
    ctx.font = this.ink ? `13px ${INK_FONTS.kai}` : '700 10.5px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const placed = []
    const lift = (gs.nodeRadius + 13) * t.k + 6
    const bg =
      this.ink === 'paper'
        ? 'rgba(245,239,224,0.94)'
        : kin.light
          ? 'rgba(255,255,255,0.9)'
          : 'rgba(15,17,23,0.78)'
    let drawn = 0
    for (const c of cands) {
      if (drawn > 260) break
      const tw = ctx.measureText(c.L.text).width
      const w = tw + 14
      const h = 17
      const x = c.s.x - w / 2
      const y = c.s.y - lift - h + (1 - c.p) * 10
      let clash = false
      for (const r of placed) {
        if (x < r.x + r.w + 3 && x + w + 3 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y) {
          clash = true
          break
        }
      }
      if (clash) continue
      placed.push({ x, y, w, h })
      drawn++
      ctx.globalAlpha = c.p
      // pill
      ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, h / 2)
      else ctx.rect(x, y, w, h)
      ctx.fillStyle = bg
      ctx.shadowColor = c.L.color
      ctx.shadowBlur = 8
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.lineWidth = 1
      ctx.strokeStyle = c.L.color
      ctx.globalAlpha = c.p * 0.75
      ctx.stroke()
      // tail pointing at the node
      ctx.globalAlpha = c.p * 0.6
      ctx.beginPath()
      ctx.moveTo(c.s.x - 3, y + h)
      ctx.lineTo(c.s.x, y + h + 4)
      ctx.lineTo(c.s.x + 3, y + h)
      ctx.fillStyle = c.L.color
      ctx.fill()
      // text
      ctx.globalAlpha = c.p
      ctx.fillStyle = c.L.color
      ctx.fillText(c.L.text, c.s.x, y + h / 2 + 0.5)
    }
    ctx.restore()
  }

  // h: { s, c1, c2, t } in WORLD coords, plus `hot` ('a' | 'b' | null) — the
  // handle under the cursor or being dragged, drawn larger.
  _drawCurveHandles(h, c) {
    const ctx = this.ctx,
      t = this.transform
    const S = worldToScreen(h.s.x, h.s.y, t),
      A = worldToScreen(h.c1.x, h.c1.y, t),
      B = worldToScreen(h.c2.x, h.c2.y, t),
      T = worldToScreen(h.t.x, h.t.y, t)
    ctx.save()
    ctx.strokeStyle = c.handleArm
    ctx.lineWidth = 1.25
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(S.x, S.y)
    ctx.lineTo(A.x, A.y)
    ctx.moveTo(T.x, T.y)
    ctx.lineTo(B.x, B.y)
    ctx.stroke()
    ctx.setLineDash([])
    for (const [p, key] of [
      [A, 'a'],
      [B, 'b']
    ]) {
      const hot = h.hot === key
      ctx.beginPath()
      ctx.arc(p.x, p.y, hot ? 8 : 6, 0, Math.PI * 2)
      ctx.fillStyle = c.handleFill
      ctx.shadowColor = c.handleGlow
      ctx.shadowBlur = hot ? 14 : 8
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.lineWidth = 2
      ctx.strokeStyle = c.handleRing
      ctx.stroke()
    }
    ctx.restore()
  }
}

function hexRgb(hex) {
  const h = String(hex || '').replace('#', '')
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((x) => x + x)
          .join('')
      : h.slice(0, 6),
    16
  )
  if (!Number.isFinite(n)) return [245, 197, 66]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
