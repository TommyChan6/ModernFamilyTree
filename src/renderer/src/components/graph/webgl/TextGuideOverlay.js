import { worldToScreen } from './coords.js'

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
    return {
      name: l ? '#4a5068' : 'rgba(232,234,246,0.85)',
      age: l ? '#9099b8' : 'rgba(158,163,184,0.85)',
      sel: '#6c8ef5',
      yearStroke: l ? 'rgba(0,0,0,0.10)' : 'rgba(232,234,246,0.12)',
      yearFill: l ? 'rgba(0,0,0,0.25)' : 'rgba(232,234,246,0.3)',
      genStroke: l ? 'rgba(0,0,0,0.08)' : 'rgba(232,234,246,0.10)',
      genFill: l ? 'rgba(0,0,0,0.20)' : 'rgba(232,234,246,0.25)',
      cyStroke: l ? 'rgba(108,142,245,0.75)' : 'rgba(108,142,245,0.65)',
      cyFill: l ? 'rgba(108,142,245,0.9)' : 'rgba(108,142,245,0.85)',
      pvStroke: l ? 'rgba(108,142,245,0.45)' : 'rgba(108,142,245,0.35)',
      pvFill: l ? 'rgba(108,142,245,0.55)' : 'rgba(108,142,245,0.45)'
    }
  }

  // opts: { gs, nodes, showLabels, showAge, selectedId, labelOpacityOf(n), ageOf(n) }
  draw(opts) {
    const ctx = this.ctx,
      t = this.transform,
      c = this._colors()
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.w, this.h)

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
        ctx.font = `${weight} 10px system-ui, sans-serif`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, s1.x - 14, s1.y)
      }
      ctx.restore()
    }
    for (const g of this.guides) {
      const isYear = g.kind === 'year'
      ctx.globalAlpha = g.opacity ?? 1
      drawGuide(
        g.y,
        g.label,
        isYear ? c.yearStroke : c.genStroke,
        isYear ? c.yearFill : c.genFill,
        isYear ? [6, 4] : [8, 5],
        1,
        600
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
    if (!opts.showLabels) return
    const gs = opts.gs
    const fontPx = gs.labelSize * t.k
    if (fontPx < 7) return // LOD: unreadable when zoomed far out -> skip entirely
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
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
}
