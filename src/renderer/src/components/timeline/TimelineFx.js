// The Timeline's interaction-effects layer: a canvas-2D overlay above the
// labels that draws everything transient — edit-mode ghosts (year cursor,
// rubber-band links, span brackets, retime handles, delete glows), the traced
// kinship chain flowing between lifelines, and one-shot bursts (a birth
// shockwave with sparks and a falling light-shaft, a dissolving life, a spark
// racing along a new bond, ripples). It only runs a frame loop while something
// is on it, and every burst is analytic in time (no per-particle state), so a
// paused tab or a dropped frame never desyncs anything.
//
// People-anchored effects resolve their position every frame through
// `resolve.person(id)` → { x, y0, y1 } | null and `resolve.yearY(year)`, so
// they ride along with pans and zooms.

import { drawIcon } from '../../lib/canvasIcon.js'

const TAU = Math.PI * 2
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'
const easeOut = (k) => 1 - Math.pow(1 - k, 3)
const clamp01 = (k) => (k < 0 ? 0 : k > 1 ? 1 : k)

// Deterministic per-burst pseudo-random stream (so particles never jitter).
function rng(seed) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

export class TimelineFx {
  constructor(canvas, resolve) {
    this.canvas = canvas
    this.g = canvas.getContext('2d')
    this.resolve = resolve
    this.w = 0
    this.h = 0
    this.dpr = 1
    this.light = false
    this.pal = { surface: 'rgba(18,20,30,0.92)', text: '#f3f4f8' }
    this.reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    this.bursts = []
    this.ghost = null // [primitive…] | null
    this.trace = null // { segs, color } | null
    this._raf = 0
    this._seed = 1
    this._tick = this._tick.bind(this)
  }

  resize(w, h, dpr = window.devicePixelRatio || 1) {
    this.w = w
    this.h = h
    this.dpr = dpr
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.canvas.style.width = w + 'px'
    this.canvas.style.height = h + 'px'
    this.kick()
  }
  /** Theme: light flag + chip palette resolved from the CSS tokens. */
  setTheme(light, pal) {
    this.light = !!light
    if (pal) this.pal = pal
    this.kick()
  }

  /** Interactive ghosts for the live edit mode (array of primitives | null). */
  setGhost(list) {
    this.ghost = list && list.length ? list : null
    this.kick()
  }
  /** A traced chain: segs from traceSegments(), drawn flowing between lives. */
  setTrace(segs, color) {
    this.trace = segs && segs.length ? { segs, color, t0: performance.now() / 1000 } : null
    this.kick()
  }

  // ── One-shot bursts ─────────────────────────────────────────────────────────
  _add(b) {
    if (this.reduced && b.kind !== 'ripple') return
    b.t0 = null // stamped on the first frame that can place it
    b.born = performance.now() / 1000
    b.seed = this._seed++ * 7919
    this.bursts.push(b)
    this.kick()
  }
  /** A life begins: shockwave + sparks + a light-shaft down the new lifeline. */
  birth(id, color) {
    this._add({ kind: 'birth', id, color, dur: 1.25 })
  }
  /** A life is erased: the line crumbles into rising embers. */
  dissolve(x, y0, y1, color) {
    this._add({ kind: 'dissolve', x, y0, y1: Math.max(y1, y0 + 10), color, dur: 1.35 })
  }
  /** A bond forms: a comet races from one life to the other. */
  spark(a, b, color) {
    this._add({ kind: 'spark', a, b, color, dur: 0.95 })
  }
  ripple(x, y, color) {
    this._add({ kind: 'ripple', x, y, color, dur: 0.75 })
  }

  kick() {
    if (!this._raf && this.w) this._raf = requestAnimationFrame(this._tick)
  }

  dispose() {
    if (this._raf) cancelAnimationFrame(this._raf)
    this._raf = 0
    this.bursts = []
    this.ghost = null
    this.trace = null
  }

  _tick(ts) {
    this._raf = 0
    const t = ts / 1000
    this._draw(t)
    if (this.bursts.length || this.ghost || this.trace) this.kick()
  }

  _point(p) {
    if (!p) return null
    if (p.id != null) {
      const s = this.resolve.person(p.id)
      if (!s) return null
      return { x: s.x, y: p.year != null ? this.resolve.yearY(p.year) : s.y0 }
    }
    return p
  }

  _draw(t) {
    const g = this.g
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    g.clearRect(0, 0, this.w, this.h)
    if (this.trace) this._drawTrace(g, t)
    if (this.ghost) for (const p of this.ghost) this._drawGhost(g, p, t)
    this.bursts = this.bursts.filter((b) => this._drawBurst(g, b, t))
    g.globalAlpha = 1
    g.globalCompositeOperation = 'source-over'
  }

  // ── Trace: glowing arcs flowing hop by hop between lifelines ────────────────
  _drawTrace(g, t) {
    const { segs, color } = this.trace
    const age = t - this.trace.t0
    g.save()
    g.lineCap = 'round'
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i]
      const A = this.resolve.person(s.a),
        B = this.resolve.person(s.b)
      if (!A || !B) continue
      // Hops light up one after another along the chain.
      const k = this.reduced ? 1 : easeOut(clamp01((age - i * 0.16) / 0.5))
      if (k <= 0) continue
      const y = this.resolve.yearY(s.year)
      const x1 = A.x,
        x2 = B.x
      const bulge = Math.min(46, 14 + Math.abs(x2 - x1) * 0.12) * (s.kind === 'vertical' ? 1 : -1)
      const mx = (x1 + x2) / 2,
        my = y + bulge
      const ex = x1 + (x2 - x1) * k,
        ey = y // grows toward B
      const cx = x1 + (mx - x1) * k,
        cy = y + (my - y) * k
      // Under-glow
      g.globalAlpha = 0.22 * k
      g.strokeStyle = color
      g.lineWidth = 10
      g.beginPath()
      g.moveTo(x1, y)
      g.quadraticCurveTo(cx, cy, ex, ey)
      g.stroke()
      // Marching core
      g.globalAlpha = 0.95 * k
      g.lineWidth = 2.6
      g.setLineDash([9, 7])
      g.lineDashOffset = this.reduced ? 0 : -t * 42
      g.beginPath()
      g.moveTo(x1, y)
      g.quadraticCurveTo(cx, cy, ex, ey)
      g.stroke()
      g.setLineDash([])
      // Comet riding the bond
      if (k >= 1 && !this.reduced) {
        const u = (t * 0.6 + i * 0.37) % 1
        const qx = (1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * mx + u * u * x2
        const qy = (1 - u) * (1 - u) * y + 2 * (1 - u) * u * my + u * u * y
        glowDot(g, qx, qy, 3.2, color, 0.95, this.light)
      }
      // Anchor beads on both lifelines
      glowDot(g, x1, y, 4.2, color, k, this.light)
      if (k >= 1) glowDot(g, x2, y, 4.2, color, 1, this.light)
    }
    g.restore()
  }

  // ── Ghost primitives ────────────────────────────────────────────────────────
  _drawGhost(g, p, t) {
    const pulse = this.reduced ? 1 : 0.75 + 0.25 * Math.sin(t * 5)
    g.save()
    switch (p.kind) {
      case 'yearline': {
        // A horizontal time cursor across the stage with its year chip.
        g.strokeStyle = p.color
        g.globalAlpha = 0.55
        g.lineWidth = 1.2
        g.setLineDash([5, 6])
        g.lineDashOffset = this.reduced ? 0 : -t * 20
        g.beginPath()
        g.moveTo(p.x0 ?? 0, p.y)
        g.lineTo(this.w, p.y)
        g.stroke()
        g.setLineDash([])
        g.globalAlpha = 1
        chip(g, (p.x0 ?? 0) + 6, p.y, String(p.label), p.color, this.pal, 'left', false, p.icon)
        break
      }
      case 'line': {
        const mx = (p.x1 + p.x2) / 2,
          my = Math.min(p.y1, p.y2) - Math.min(60, 16 + Math.abs(p.x2 - p.x1) * 0.15)
        g.strokeStyle = p.color
        g.lineCap = 'round'
        g.globalAlpha = 0.25
        g.lineWidth = 9
        g.beginPath()
        g.moveTo(p.x1, p.y1)
        g.quadraticCurveTo(mx, my, p.x2, p.y2)
        g.stroke()
        g.globalAlpha = 0.95
        g.lineWidth = 2.5
        g.setLineDash([8, 7])
        g.lineDashOffset = this.reduced ? 0 : -t * 36
        g.beginPath()
        g.moveTo(p.x1, p.y1)
        g.quadraticCurveTo(mx, my, p.x2, p.y2)
        g.stroke()
        g.setLineDash([])
        glowDot(g, p.x1, p.y1, 5, p.color, pulse, this.light)
        glowDot(g, p.x2, p.y2, 3.5, p.color, 0.8, this.light)
        break
      }
      case 'span': {
        // A span in the making: a translucent band + a bracket + end years.
        const y0 = Math.min(p.y0, p.y1),
          y1 = Math.max(p.y0, p.y1)
        const grad = g.createLinearGradient(0, y0, 0, y1)
        grad.addColorStop(0, withA(p.color, 0.2))
        grad.addColorStop(0.5, withA(p.color, 0.08))
        grad.addColorStop(1, withA(p.color, 0.2))
        g.fillStyle = grad
        g.fillRect(p.x0 ?? 0, y0, this.w - (p.x0 ?? 0), y1 - y0)
        g.strokeStyle = p.color
        g.lineWidth = 2.5
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(p.x + 10, y0)
        g.lineTo(p.x, y0)
        g.lineTo(p.x, y1)
        g.lineTo(p.x + 10, y1)
        g.stroke()
        chip(g, p.x - 8, y0, p.a, p.color, this.pal, 'right', false, p.aIcon)
        chip(g, p.x - 8, y1, p.b, p.color, this.pal, 'right')
        break
      }
      case 'life': {
        // Retime preview: the life's new extent as a dashed glowing capsule.
        g.strokeStyle = p.color
        g.lineCap = 'round'
        g.globalAlpha = 0.18
        g.lineWidth = 16
        g.beginPath()
        g.moveTo(p.x, p.y0)
        g.lineTo(p.x, p.y1)
        g.stroke()
        g.globalAlpha = 0.9
        g.lineWidth = 2
        g.setLineDash([6, 5])
        g.lineDashOffset = this.reduced ? 0 : -t * 30
        g.beginPath()
        g.moveTo(p.x - 7, p.y0)
        g.lineTo(p.x - 7, p.y1)
        g.moveTo(p.x + 7, p.y0)
        g.lineTo(p.x + 7, p.y1)
        g.stroke()
        g.setLineDash([])
        break
      }
      case 'handle': {
        // A grabbable end: ring + arrows hinting the drag axis.
        const r = (p.r || 9) * (p.active ? 1.25 : 1)
        glowDot(g, p.x, p.y, r * 0.45, p.color, 1, this.light)
        g.strokeStyle = p.color
        g.globalAlpha = p.active ? 1 : 0.65 + 0.35 * pulse
        g.lineWidth = 2
        g.beginPath()
        g.arc(p.x, p.y, r, 0, TAU)
        g.stroke()
        g.fillStyle = p.color
        tri(g, p.x, p.y - r - 7, -1)
        tri(g, p.x, p.y + r + 7, 1)
        break
      }
      case 'column': {
        // A lane being carried: a soft light column + its landing chip.
        const grad = g.createLinearGradient(p.x - 26, 0, p.x + 26, 0)
        grad.addColorStop(0, withA(p.color, 0))
        grad.addColorStop(0.5, withA(p.color, 0.16 + 0.06 * pulse))
        grad.addColorStop(1, withA(p.color, 0))
        g.fillStyle = grad
        g.fillRect(p.x - 26, 0, 52, this.h)
        g.strokeStyle = p.color
        g.globalAlpha = 0.55
        g.lineWidth = 1.2
        g.setLineDash([4, 6])
        g.lineDashOffset = this.reduced ? 0 : -t * 24
        g.beginPath()
        g.moveTo(p.x - 22, 0)
        g.lineTo(p.x - 22, this.h)
        g.moveTo(p.x + 22, 0)
        g.lineTo(p.x + 22, this.h)
        g.stroke()
        g.setLineDash([])
        g.globalAlpha = 1
        if (p.label) chip(g, p.x, p.y, p.label, p.color, this.pal, 'center', true)
        break
      }
      case 'slot': {
        // Where the carried lane will land: a bright notch between lanes.
        g.strokeStyle = p.color
        g.lineCap = 'round'
        g.globalAlpha = 0.9
        g.lineWidth = 2.5
        g.beginPath()
        g.moveTo(p.x, p.y0)
        g.lineTo(p.x, p.y1)
        g.stroke()
        g.fillStyle = p.color
        tri(g, p.x, p.y0 - 6, 1)
        tri(g, p.x, p.y1 + 6, -1)
        break
      }
      case 'bubble':
        chip(g, p.x, p.y, p.text, p.color, this.pal, 'center', true, p.icon)
        break
      case 'glowLife': {
        // Delete-mode target: a hot outline breathing around the lifeline.
        g.strokeStyle = p.color
        g.lineCap = 'round'
        g.globalAlpha = 0.16 + 0.14 * pulse
        g.lineWidth = 22
        g.beginPath()
        g.moveTo(p.x, p.y0)
        g.lineTo(p.x, p.y1)
        g.stroke()
        g.globalAlpha = 0.9
        g.lineWidth = 1.6
        roundRect(g, p.x - 12, p.y0 - 18, 24, p.y1 - p.y0 + 30, 12)
        g.stroke()
        break
      }
      case 'glowRect': {
        g.strokeStyle = p.color
        g.fillStyle = withA(p.color, 0.12 + 0.08 * pulse)
        g.lineWidth = 2
        roundRect(g, p.x - 3, p.y - 3, p.w + 6, p.h + 6, 10)
        g.fill()
        g.stroke()
        break
      }
      case 'ring': {
        g.strokeStyle = p.color
        g.globalAlpha = pulse
        g.lineWidth = 2.5
        g.beginPath()
        g.arc(p.x, p.y, p.r || 20, 0, TAU)
        g.stroke()
        break
      }
    }
    g.restore()
  }

  // ── Bursts ──────────────────────────────────────────────────────────────────
  _drawBurst(g, b, t) {
    let ox = b.x,
      oy = b.y
    if (b.kind === 'birth') {
      const s = this.resolve.person(b.id)
      if (!s) return t - b.born < 1.5 // wait for the new life to be laid out
      ox = s.x
      oy = s.y0
    }
    if (b.t0 == null) b.t0 = t
    const k = (t - b.t0) / b.dur
    if (k >= 1) return false
    const add = !this.light
    g.save()
    if (add) g.globalCompositeOperation = 'lighter'
    const R = rng(b.seed)
    switch (b.kind) {
      case 'birth': {
        // Core flash
        const fk = clamp01(k / 0.35)
        const fr = 30 * (1 - fk) + 6
        const rg = g.createRadialGradient(ox, oy, 0, ox, oy, fr)
        rg.addColorStop(0, withA('#ffffff', 0.9 * (1 - fk)))
        rg.addColorStop(0.4, withA(b.color, 0.6 * (1 - fk)))
        rg.addColorStop(1, withA(b.color, 0))
        g.fillStyle = rg
        g.beginPath()
        g.arc(ox, oy, fr, 0, TAU)
        g.fill()
        // Two shockwaves
        for (let w = 0; w < 2; w++) {
          const wk = clamp01((k - w * 0.12) / 0.7)
          if (wk <= 0 || wk >= 1) continue
          g.strokeStyle = b.color
          g.globalAlpha = (1 - wk) * (w ? 0.5 : 0.9)
          g.lineWidth = 3.5 * (1 - wk) + 0.5
          g.beginPath()
          g.arc(ox, oy, 8 + easeOut(wk) * (w ? 95 : 70), 0, TAU)
          g.stroke()
        }
        // Light-shaft pouring down the new lifeline
        const sk = easeOut(clamp01(k / 0.8))
        const len = 220 * sk
        const lg = g.createLinearGradient(0, oy, 0, oy + len)
        lg.addColorStop(0, withA(b.color, 0.55 * (1 - k)))
        lg.addColorStop(1, withA(b.color, 0))
        g.globalAlpha = 1
        g.fillStyle = lg
        g.fillRect(ox - 9, oy, 18, len)
        // Sparks
        for (let i = 0; i < 30; i++) {
          const a = R() * TAU,
            v = 45 + R() * 95,
            sz = 1.2 + R() * 2.4
          const e = easeOut(k)
          const x = ox + Math.cos(a) * v * e
          const y = oy + Math.sin(a) * v * e + 40 * k * k
          g.globalAlpha = Math.pow(1 - k, 1.4)
          g.fillStyle = R() > 0.7 ? '#ffffff' : b.color
          g.beginPath()
          g.arc(x, y, sz * (1 - k * 0.6), 0, TAU)
          g.fill()
        }
        break
      }
      case 'dissolve': {
        // A fading ghost of the line, then embers rising and drifting away.
        g.globalAlpha = Math.max(0, 0.7 - k * 1.6)
        g.strokeStyle = b.color
        g.lineWidth = 6
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(b.x, b.y0)
        g.lineTo(b.x, b.y1)
        g.stroke()
        const n = Math.min(110, 30 + Math.round((b.y1 - b.y0) / 4))
        for (let i = 0; i < n; i++) {
          const u = R(),
            jitter = (R() - 0.5) * 6
          const delay = u * 0.35 // the top burns away first
          const pk = clamp01((k - delay) / (1 - delay))
          if (pk <= 0 || pk >= 1) continue
          const rise = (30 + R() * 70) * easeOut(pk)
          const sway = Math.sin(pk * 6 + R() * TAU) * (6 + R() * 10) * pk
          const x = b.x + jitter + sway
          const y = b.y0 + u * (b.y1 - b.y0) - rise
          g.globalAlpha = (1 - pk) * 0.9
          g.fillStyle = R() > 0.75 ? '#ffb27a' : b.color
          g.beginPath()
          g.arc(x, y, (1 + R() * 2.2) * (1 - pk * 0.7), 0, TAU)
          g.fill()
        }
        break
      }
      case 'spark': {
        const A = this._point(b.a),
          B = this._point(b.b)
        if (!A || !B) break
        const mx = (A.x + B.x) / 2,
          my = Math.min(A.y, B.y) - Math.min(60, 16 + Math.abs(B.x - A.x) * 0.15)
        const qk = easeOut(clamp01(k / 0.6))
        const at = (u) => ({
          x: (1 - u) * (1 - u) * A.x + 2 * (1 - u) * u * mx + u * u * B.x,
          y: (1 - u) * (1 - u) * A.y + 2 * (1 - u) * u * my + u * u * B.y
        })
        // Trail
        g.strokeStyle = b.color
        g.lineCap = 'round'
        for (let j = 0; j < 14; j++) {
          const u0 = Math.max(0, qk - (j + 1) * 0.035),
            u1 = Math.max(0, qk - j * 0.035)
          const p0 = at(u0),
            p1 = at(u1)
          g.globalAlpha = (1 - j / 14) * (1 - clamp01((k - 0.6) / 0.4))
          g.lineWidth = 4 * (1 - j / 14) + 0.5
          g.beginPath()
          g.moveTo(p0.x, p0.y)
          g.lineTo(p1.x, p1.y)
          g.stroke()
        }
        const head = at(qk)
        glowDot(g, head.x, head.y, 4.5, b.color, 1 - clamp01((k - 0.6) / 0.4), this.light)
        if (k > 0.6) {
          const rk = (k - 0.6) / 0.4
          g.globalAlpha = 1 - rk
          g.lineWidth = 2.5
          g.beginPath()
          g.arc(B.x, B.y, 6 + 40 * easeOut(rk), 0, TAU)
          g.stroke()
        }
        break
      }
      case 'ripple': {
        for (let w = 0; w < 2; w++) {
          const wk = clamp01((k - w * 0.18) / 0.8)
          if (wk <= 0 || wk >= 1) continue
          g.strokeStyle = b.color
          g.globalAlpha = 1 - wk
          g.lineWidth = 2.5 * (1 - wk) + 0.5
          g.beginPath()
          g.arc(b.x, b.y, 5 + easeOut(wk) * 46, 0, TAU)
          g.stroke()
        }
        break
      }
    }
    g.restore()
    return true
  }
}

// ── Drawing helpers ───────────────────────────────────────────────────────────
function withA(color, a) {
  if (color.startsWith('#')) {
    let h = color.slice(1)
    if (h.length === 3) h = [...h].map((c) => c + c).join('')
    const n = parseInt(h.slice(0, 6), 16)
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
  }
  const m = /rgba?\(([^)]+)\)/.exec(color)
  if (m) {
    const [r, gg, b] = m[1].split(',').map((s) => parseFloat(s))
    return `rgba(${r},${gg},${b},${a})`
  }
  return color
}

function glowDot(g, x, y, r, color, alpha, light) {
  if (alpha <= 0) return
  g.save()
  if (!light) g.globalCompositeOperation = 'lighter'
  const rg = g.createRadialGradient(x, y, 0, x, y, r * 3.2)
  rg.addColorStop(0, withA(color, 0.75 * alpha))
  rg.addColorStop(1, withA(color, 0))
  g.fillStyle = rg
  g.globalAlpha = 1
  g.beginPath()
  g.arc(x, y, r * 3.2, 0, TAU)
  g.fill()
  g.globalCompositeOperation = 'source-over'
  g.globalAlpha = alpha
  g.fillStyle = light ? color : '#ffffff'
  g.beginPath()
  g.arc(x, y, r * 0.55, 0, TAU)
  g.fill()
  g.restore()
}

function tri(g, x, y, dir) {
  g.beginPath()
  g.moveTo(x - 4, y - 2.5 * dir)
  g.lineTo(x + 4, y - 2.5 * dir)
  g.lineTo(x, y + 2.5 * dir)
  g.closePath()
  g.fill()
}

function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** A glassy label chip; anchor 'left' | 'right' | 'center' (center floats above).
 *  An optional leading `icon` (icon name) is drawn in the chip's colour; icon +
 *  text are measured and centred as one unit. */
function chip(g, x, y, text, color, pal, anchor = 'left', big = false, icon = null) {
  g.save()
  g.font = `${big ? 800 : 700} ${big ? 12 : 10.5}px ${FONT}`
  const isz = big ? 13 : 11.5
  const iw = icon ? isz + 5 : 0
  const tw = g.measureText(text).width + iw
  const w = tw + (big ? 20 : 14),
    h = big ? 24 : 19
  const bx = anchor === 'left' ? x : anchor === 'right' ? x - w : x - w / 2
  const by = anchor === 'center' ? y - h - 14 : y - h / 2
  g.globalAlpha = 1
  g.shadowColor = 'rgba(0,0,0,0.28)'
  g.shadowBlur = 10
  g.shadowOffsetY = 3
  g.fillStyle = pal.surface
  roundRect(g, bx, by, w, h, h / 2)
  g.fill()
  g.shadowColor = 'transparent'
  g.strokeStyle = color
  g.lineWidth = 1.4
  g.stroke()
  if (anchor === 'center') {
    g.fillStyle = color
    g.beginPath()
    g.moveTo(x - 5, by + h)
    g.lineTo(x + 5, by + h)
    g.lineTo(x, by + h + 6)
    g.closePath()
    g.fill()
  }
  const left = bx + (w - tw) / 2
  if (icon) drawIcon(g, icon, left + isz / 2, by + h / 2, isz, { color, lineWidth: 2.3 })
  g.fillStyle = pal.text
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillText(text, left + iw, by + h / 2 + 0.5)
  g.restore()
}
