import { worldToScreen, tiltParams, clipSegment } from './coords.js'
import { shapeLabelDrop, shapeTopLift, shapeAnchor } from './nodeShapes.js'
import { bodyBox, makeOccluder } from './occlusion.js'
import { drawIcon, iconPath } from '../../../lib/canvasIcon.js'
import { INK_FONTS, inkFontsReady } from '../../../lib/inkArt'
import { translate } from '../../../i18n'
import { defaultNameLabel } from '../../../lib/dataLabels'
import { RING_LABELS, OUTSIDERS_LABEL } from '../spotlightLayout'
import { popRing } from './popAnim.js'

// The pure layout modules (familyTreeLayout, guideLines, layout3D, spotlight)
// emit stable English guide labels ('Gen 3', 'New Gen', 'Now · 1990', ring
// names) so they stay i18n-free and testable; the canvas translates them as it
// draws. The owning views redraw on a locale change.
const RING_KEYS = ['main', 'inner', 'close', 'extended', 'distant', 'far', 'edge']

/** A guide label as display text in the active language. */
export function guideLabelText(label) {
  if (label == null) return label
  const s = String(label)
  let m = /^Gen (\d+)$/.exec(s)
  if (m) return translate('graph.canvas.gen', { n: m[1] })
  if (s === 'New Gen') return translate('graph.canvas.newGen')
  m = /^Now · (.+)$/.exec(s)
  if (m) return translate('graph.canvas.now', { year: m[1] })
  return s
}

/** A Spotlight ring's name in the active language. */
export function ringLabelText(label) {
  if (label === OUTSIDERS_LABEL) return translate('graph.rings.outside')
  const i = RING_LABELS.indexOf(label)
  return i >= 0 ? translate(`graph.rings.${RING_KEYS[i]}`) : label
}

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
    // Ink label sprites (see _inkSprite): key -> { canvas, w, h, ax, ay, B, textW }
    this._sprites = new Map()
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
        this._clearSprites() // drop sprites painted in the fallback face
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
      // Stroke only the on-screen part (the dashes stay anchored at s1).
      const seg = clipSegment(s1.x, s1.y, s2.x, s2.y, -8, -8, this.w + 8, this.h + 8)
      if (seg) {
        ctx.setLineDash(dash)
        ctx.lineDashOffset = seg.t0 * Math.hypot(s2.x - s1.x, s2.y - s1.y)
        ctx.beginPath()
        ctx.moveTo(seg.x0, seg.y0)
        ctx.lineTo(seg.x1, seg.y1)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.lineDashOffset = 0
      }
      if (label != null) {
        ctx.fillStyle = fill
        ctx.font = this.ink ? `13px ${INK_FONTS.kai}` : `${weight} 11px system-ui, sans-serif`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        // Clamp into the viewport so the year stays readable when the line's
        // world-space left end has scrolled off-screen (zoomed in). The left
        // clamp sits clear of the Time-travel slider panel (~86px wide).
        ctx.fillText(guideLabelText(label), Math.min(Math.max(s1.x - 14, 128), this.w - 12), s1.y)
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

    // ---- newcomers: a ripple ring as each one pops in (under the names) ----
    if (opts.pops?.length) this._drawPops(opts, c)

    if (opts.showLabels) this._drawLabels(opts, c)

    // ---- kinship lens: the reveal ripple + kin-name pills above nodes ----
    if (opts.kinLens) this._drawKin(opts.kinLens, opts)

    // ---- bezier edit handles (on top of everything) ----
    if (opts.curveHandles) this._drawCurveHandles(opts.curveHandles, c)
  }

  // opts.pops: [{ n, k }] — k = ring progress 0..1 (popAnim.popRing). The ring
  // circles the node's drawn centre (standing shapes rise above their point)
  // and shrinks with the node under the tilt. Accent colour; cinnabar in ink.
  _drawPops(opts, c) {
    const ctx = this.ctx,
      t = this.transform,
      gs = opts.gs
    const lift = shapeAnchor(gs.nodeShape).lift || 0
    const color = this.ink ? c.sel : opts.popColor || c.sel
    ctx.save()
    ctx.strokeStyle = color
    for (const { n, k } of opts.pops) {
      const ring = popRing(k)
      if (!ring) continue
      const s = worldToScreen(n.x, n.y, t)
      const ps = s.s ?? 1
      const R = (opts.radiusOf ? opts.radiusOf(n) : gs.nodeRadius) * t.k * ps
      const cy = s.y - lift * R
      if (s.x < -R * 3 || s.x > this.w + R * 3 || cy < -R * 3 || cy > this.h + R * 3) continue
      ctx.globalAlpha = ring.alpha
      ctx.lineWidth = ring.width * Math.max(0.5, ps)
      ctx.beginPath()
      ctx.arc(s.x, cy, R * ring.r, 0, Math.PI * 2)
      ctx.stroke()
      // a fainter inner echo trailing the main ring
      ctx.globalAlpha = ring.alpha * 0.45
      ctx.lineWidth = ring.width * 0.6 * Math.max(0.5, ps)
      ctx.beginPath()
      ctx.arc(s.x, cy, R * (1 + (ring.r - 1) * 0.55), 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  }

  // Standing nodes (gravestones / the tilt): an index of every visible body so a
  // name covered by someone NEARER can step back (null when nothing stands).
  _occluder(opts) {
    const t = this.transform,
      gs = opts.gs
    if (!tiltParams(t) && !shapeAnchor(gs.nodeShape).lift) return null
    const bodies = []
    for (const n of opts.nodes) {
      const s = worldToScreen(n.x, n.y, t)
      if (s.x < -80 || s.x > this.w + 80 || s.y < -80 || s.y > this.h + 200) continue
      const R = (opts.radiusOf ? opts.radiusOf(n) : gs.nodeRadius) * t.k * (s.s ?? 1)
      const b = bodyBox(gs.nodeShape, s.x, s.y, R)
      b.depth = s.y
      bodies.push(b)
    }
    return makeOccluder(bodies)
  }

  // 1 when the label is clear, a faint 0.16 when a nearer body covers it.
  // Expects ctx.font to be the label font already.
  _labelVisibility(occ, text, s, baseline, fontPx, ps) {
    const w = this.ctx.measureText(text).width * ps
    const px = fontPx * ps
    const box = { x0: s.x - w / 2, y0: baseline - px, x1: s.x + w / 2, y1: baseline + px * 0.25 }
    return occ.covered(box, s.y) ? 0.16 : 1
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
    const nameFont = `500 ${fontPx}px system-ui, sans-serif`
    const ageFont = `600 ${fontPx}px system-ui, sans-serif`
    const occ = this._occluder(opts)
    for (const n of opts.nodes) {
      const s = worldToScreen(n.x, n.y, t)
      if (s.x < -margin || s.x > this.w + margin || s.y < -margin || s.y > this.h + margin) continue
      let op =
        (opts.labelOpacityOf ? opts.labelOpacityOf(n) : 1) * (opts.revealOf ? opts.revealOf(n) : 1)
      if (op <= 0.01) continue
      // Sit below the node's drawn radius (per-node size + emphasis swell),
      // not the global default, so enlarged nodes don't swallow their label.
      const r = opts.radiusOf ? opts.radiusOf(n) : gs.nodeRadius
      // Under the perspective tilt a label shrinks with its node (ps = 1 flat).
      const ps = s.s ?? 1
      if (fontPx * ps < 6) continue
      const y = s.y + shapeLabelDrop(gs.nodeShape, r) * t.k * ps
      // The trait system composes the full node label (name-slot words + any
      // "show in graph" values); pre-trait nodes fall back to the first name.
      const first = n.graph_label ?? (n.name ? n.name.split(' ')[0] : '')
      if (occ) {
        ctx.font = nameFont
        op *= this._labelVisibility(occ, first, s, y, fontPx, ps)
      }
      if (ps !== 1) {
        ctx.save()
        ctx.translate(s.x, y)
        ctx.scale(ps, ps)
        ctx.translate(-s.x, -y)
      }
      ctx.globalAlpha = op
      ctx.font = nameFont
      ctx.fillStyle = opts.selectedId === n.id ? c.sel : c.name
      const age = opts.showAge && opts.ageOf ? opts.ageOf(n) : null
      if (age != null) {
        // Center the name + age pair as one unit under the node.
        const nameW = ctx.measureText(first).width
        ctx.font = ageFont
        const ageW = ctx.measureText(String(age)).width
        const gap = 4 * t.k
        const x0 = s.x - (nameW + gap + ageW) / 2
        ctx.textAlign = 'left'
        ctx.font = nameFont
        ctx.fillText(first, x0, y)
        ctx.font = ageFont
        ctx.fillStyle = c.age
        ctx.fillText(String(age), x0 + nameW + gap, y)
        ctx.textAlign = 'center'
      } else {
        ctx.fillText(first, s.x, y)
      }
      if (ps !== 1) ctx.restore()
    }
    ctx.globalAlpha = 1
  }

  // 水墨 labels: names brushed in 楷书 with a soft paper halo (so a stroke passing
  // behind never cuts the characters); the selected name in cinnabar; age as a
  // small ochre annotation.
  //
  // Each label is painted ONCE into a small sprite (see _inkSprite) and blitted
  // with drawImage. Stroking a thick round-joined halo around calligraphy glyph
  // outlines is far too slow to redo per label per frame — under the tilt every
  // label also sits at its own depth scale, so nothing would ever hit the
  // browser's glyph cache (the "slow ink tilt" problem).
  _drawInkLabels(opts, c, fontPx) {
    const ctx = this.ctx,
      t = this.transform,
      gs = opts.gs
    const margin = 60
    const dpr = this.dpr || 1
    const gapRatio = 4 / ((gs.labelSize || 12) * 1.3) // the 4·k gap, relative to fontPx
    const occ = this._occluder(opts)
    for (const n of opts.nodes) {
      const s = worldToScreen(n.x, n.y, t)
      if (s.x < -margin || s.x > this.w + margin || s.y < -margin || s.y > this.h + margin) continue
      let op =
        (opts.labelOpacityOf ? opts.labelOpacityOf(n) : 1) * (opts.revealOf ? opts.revealOf(n) : 1)
      if (op <= 0.01) continue
      const r = opts.radiusOf ? opts.radiusOf(n) : gs.nodeRadius
      const ps = s.s ?? 1
      if (fontPx * ps < 6) continue
      const y = s.y + ((shapeLabelDrop(gs.nodeShape, r) - 2) * t.k + fontPx * 0.7) * ps
      const first = n.graph_label ?? (n.name ? n.name.split(' ')[0] : '')
      const age = opts.showAge && opts.ageOf ? opts.ageOf(n) : null
      const devPx = fontPx * ps * dpr
      const sp = this._inkSprite(first, age, devPx, opts.selectedId === n.id, c, gapRatio)
      if (!sp) {
        // Very large text (deep zoom, a handful of labels): draw it directly.
        if (occ) op *= this._coveredFactor(occ, null, first, s, y, fontPx, ps)
        this._drawInkLabelDirect(first, age, s.x, y, fontPx, ps, op, opts.selectedId === n.id, c)
        continue
      }
      const k = devPx / sp.B / dpr // sprite device px -> CSS px at this label's size
      if (occ) op *= this._coveredFactor(occ, sp.nameW * k, first, s, y, fontPx, ps)
      ctx.globalAlpha = op
      ctx.drawImage(sp.canvas, s.x - sp.ax * k, y - sp.ay * k, sp.w * k, sp.h * k)
    }
    ctx.globalAlpha = 1
  }

  // 1 when the label is clear, 0.16 when a nearer body covers it. `w` is the
  // name's on-screen width (null = measure it with the label font).
  _coveredFactor(occ, w, text, s, baseline, fontPx, ps) {
    if (w == null) {
      this.ctx.font = `${fontPx.toFixed(1)}px ${INK_FONTS.kai}`
      w = this.ctx.measureText(text).width * ps
    }
    const px = fontPx * ps
    const box = { x0: s.x - w / 2, y0: baseline - px, x1: s.x + w / 2, y1: baseline + px * 0.25 }
    return occ.covered(box, s.y) ? 0.16 : 1
  }

  /** One ink label (name + optional age) rendered at a quantized device-px
   *  size, cached. Returns null for text too big to be worth caching. Sizes
   *  snap to 1/8-octave steps, so a label drawn within ±4.5% of a cached size
   *  reuses it — continuous zoom/tilt mostly hits the cache. */
  _inkSprite(text, age, devPx, selected, c, gapRatio) {
    const B = Math.pow(2, Math.round(Math.log2(Math.max(devPx, 1)) * 8) / 8)
    if (B > 140) return null
    const key = `${this.ink}|${this.inkFontOk ? 1 : 0}|${B.toFixed(2)}|${selected ? 1 : 0}|${gapRatio.toFixed(3)}|${text}|${age ?? ''}`
    const hit = this._sprites.get(key)
    if (hit) {
      // refresh recency (Map keeps insertion order — the oldest go first)
      this._sprites.delete(key)
      this._sprites.set(key, hit)
      return hit
    }
    const canvas = document.createElement('canvas')
    const g = canvas.getContext('2d')
    const font = `${B.toFixed(2)}px ${INK_FONTS.kai}`
    const ageFont = `${(B * 0.78).toFixed(2)}px ${INK_FONTS.kai}`
    g.font = font
    const m = g.measureText(text)
    const nameW = m.width
    let ageW = 0,
      ageM = null
    const ageStr = age != null ? String(age) : ''
    const gap = B * gapRatio
    if (ageStr) {
      g.font = ageFont
      ageM = g.measureText(ageStr)
      ageW = ageM.width + gap
    }
    const lw = Math.max(2 * (this.dpr || 1), B * 0.32)
    const asc = Math.max(m.actualBoundingBoxAscent || B * 0.9, ageM?.actualBoundingBoxAscent || 0)
    const desc = Math.max(
      m.actualBoundingBoxDescent || B * 0.2,
      ageM?.actualBoundingBoxDescent || 0
    )
    const pad = Math.ceil(lw / 2 + B * 0.18) + 1
    const w = Math.ceil(nameW + ageW + pad * 2)
    const h = Math.ceil(asc + desc + pad * 2)
    canvas.width = w
    canvas.height = h
    const ay = pad + asc
    g.lineJoin = 'round'
    g.lineWidth = lw
    g.strokeStyle = c.halo
    g.textAlign = 'left'
    g.textBaseline = 'alphabetic'
    g.font = font
    g.strokeText(text, pad, ay)
    g.fillStyle = selected ? c.sel : c.name
    g.fillText(text, pad, ay)
    if (ageStr) {
      const ax = pad + nameW + gap
      g.font = ageFont
      g.strokeText(ageStr, ax, ay)
      g.fillStyle = c.age
      g.fillText(ageStr, ax, ay)
    }
    // An ImageBitmap is immutable, so the GPU keeps it cached across frames; a
    // live canvas source gets re-uploaded on every drawImage.
    let img = canvas
    if (typeof OffscreenCanvas !== 'undefined') {
      try {
        const oc = new OffscreenCanvas(w, h)
        oc.getContext('2d').drawImage(canvas, 0, 0)
        img = oc.transferToImageBitmap()
      } catch {
        img = canvas
      }
    }
    const sp = { canvas: img, w, h, ax: pad + (nameW + ageW) / 2, ay, B, nameW }
    this._sprites.set(key, sp)
    if (this._sprites.size > 700) {
      let drop = 200
      for (const [k, v] of this._sprites) {
        v.canvas.close?.() // free the bitmap's GPU/CPU memory now, not at GC
        this._sprites.delete(k)
        if (--drop <= 0) break
      }
    }
    return sp
  }

  _clearSprites() {
    for (const v of this._sprites.values()) v.canvas.close?.()
    this._sprites.clear()
  }

  _drawInkLabelDirect(first, age, cx, y, fontPx, ps, op, selected, c) {
    const ctx = this.ctx
    const font = `${fontPx.toFixed(1)}px ${INK_FONTS.kai}`
    const ageFont = `${(fontPx * 0.78).toFixed(1)}px ${INK_FONTS.kai}`
    ctx.save()
    if (ps !== 1) {
      ctx.translate(cx, y)
      ctx.scale(ps, ps)
      ctx.translate(-cx, -y)
    }
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(2, fontPx * 0.32)
    ctx.strokeStyle = c.halo
    ctx.globalAlpha = op
    ctx.font = font
    const nameW = ctx.measureText(first).width
    let ageW = 0
    const gap = 4 * this.transform.k
    if (age != null) {
      ctx.font = ageFont
      ageW = ctx.measureText(String(age)).width + gap
      ctx.font = font
    }
    const x0 = cx - (nameW + ageW) / 2
    ctx.textAlign = 'left'
    ctx.strokeText(first, x0, y)
    ctx.fillStyle = selected ? c.sel : c.name
    ctx.fillText(first, x0, y)
    if (age != null) {
      ctx.font = ageFont
      const ax = x0 + nameW + gap
      ctx.strokeText(String(age), ax, y)
      ctx.fillStyle = c.age
      ctx.fillText(String(age), ax, y)
    }
    ctx.restore()
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
      // Era icon: an icon name (or legacy glyph) drawn as an SVG icon; an
      // unrecognised value is simply omitted (never drawn as emoji text).
      const icon = e.icon && iconPath(e.icon) ? e.icon : ''
      const label = defaultNameLabel(e.name)
      ctx.font = `800 11px ${font}`
      const iconW = icon ? 16 : 0
      const w = ctx.measureText(label).width + 22 + iconW
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
      if (icon) drawIcon(ctx, icon, hx + 13 + 6, hy + h / 2, 12, { color: col(1) })
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, hx + 13 + iconW, hy + h / 2 + 0.5)
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
      const evTitle = defaultNameLabel(ev.title)
      const title = evTitle.length > 26 ? evTitle.slice(0, 25) + '…' : evTitle
      ctx.font = `${big ? 800 : 700} 11px ${font}`
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
      ctx.fillStyle = ch.light ? '#1a1d2e' : '#e8eaf6'
      // Icon names (and legacy glyphs) draw as SVG icons; an unknown stored
      // value falls back to the event kind's icon (as the Timeline does).
      const iconOpts = { color: ctx.fillStyle, lineWidth: 2.2 }
      if (!drawIcon(ctx, ev.icon, x + h / 2, y, 11, iconOpts)) {
        drawIcon(ctx, ev.kindIcon || 'sparkle', x + h / 2, y, 11, iconOpts)
      }
      ctx.textAlign = 'left'
      ctx.font = `${big ? 800 : 700} 11px ${font}`
      ctx.fillText(title, x + h + 3, y + 0.5)
    }
    ctx.restore()
  }

  // A circle lying on the (tilted) ground, traced as a projected polyline —
  // the homography turns it into the right perspective ellipse.
  _groundRing(wx, wy, wr) {
    const ctx = this.ctx,
      t = this.transform
    const N = 72
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2
      const p = worldToScreen(wx + Math.cos(a) * wr, wy + Math.sin(a) * wr, t)
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    }
  }

  _drawSpotlight(sp) {
    const ctx = this.ctx,
      t = this.transform
    const now = performance.now() / 1000
    const s = worldToScreen(sp.x, sp.y, t)
    const k = t.k
    const tilted = !!tiltParams(t)
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
    ctx.font = '700 10.5px system-ui, sans-serif'
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
      if (tilted) this._groundRing(sp.x, sp.y, ring.r)
      else ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
      // Label pill at the top of the ring.
      const label = `${ringLabelText(ring.label)} · ${ring.count}`
      // In the ring's widest empty arc (from the layout), so it never sits
      // on anyone; lower-left (the usual quiet bearing) as a fallback.
      const la = ring.labelAngle ?? Math.PI * 0.75
      const lp = tilted
        ? worldToScreen(sp.x + Math.cos(la) * ring.r, sp.y + Math.sin(la) * ring.r, t)
        : { x: s.x + Math.cos(la) * r, y: s.y + Math.sin(la) * r }
      const lx = lp.x,
        ly = lp.y
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
    // A small crown above the lead (an SVG icon, so it centres exactly).
    ctx.shadowBlur = 0
    ctx.globalAlpha = 0.95
    drawIcon(
      ctx,
      'crown',
      s.x,
      s.y - nr * 1.55 - Math.sin(now * 2) * 2,
      Math.max(13, 16 * Math.min(1.4, k)),
      { color: col, lineWidth: 2.2 }
    )
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
    const liftOf = (cand) => shapeTopLift(gs.nodeShape, gs.nodeRadius) * t.k * (cand.s.s ?? 1) + 6
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
      const y = c.s.y - liftOf(c) - h + (1 - c.p) * 10
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
