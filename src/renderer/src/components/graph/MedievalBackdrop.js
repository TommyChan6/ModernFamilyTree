// Medieval backdrop for the graph: the family drawn on a portolan chart.
// Behind the transparent WebGL canvas lie vellum, a network of rhumb lines
// radiating from wind roses (the eight winds in ink, the half-winds in green,
// the quarter-winds in red, as on the old sea charts) and a far country of
// castles and woods along the foot, all in parallax with the camera.
//
// Same contract and the same tricks as graph/InkBackdrop.js: pure DOM layers,
// every per-frame change a compositor-only `transform`. Each layer is
// oversized by one texture tile and slid by (offset mod tile), so it pans like
// an endless sheet without ever repainting. The rhumb tile (2048²) and the
// skyline strip are painted once, off the critical path, and cached.
//
// Shown only in the medieval app theme (setTheme).

import { MED, roseDataUrl, skylineDataUrl } from '../../lib/medievalArt'
import { backdropOffset } from './inkStyle.js'

const VELLUM_TILE = 512
const CHART_TILE = 2048
const SKY_W = 2048
const SKY_H = 300

function wrap(o, w) {
  if (!(w > 0)) return 0
  const m = ((o % w) + w) % w
  return m >= w / 2 ? m - w : m
}

function loadImage(src) {
  return new Promise((res) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => res(null)
    img.src = src
  })
}

/** Rhumb-line colours by wind: the 8 principal winds, the 8 half-winds and
 *  the 16 quarter-winds (pure; exported for tests). */
export function windColor(i) {
  if (i % 4 === 0) return MED.ink
  if (i % 2 === 0) return MED.verdigris
  return MED.vermilion
}

let chartPromise = null
function chartUrl() {
  if (chartPromise) return chartPromise
  chartPromise = (async () => {
    const W = CHART_TILE
    const c = document.createElement('canvas')
    c.width = c.height = W
    const ctx = c.getContext('2d')
    const C = W / 2
    const R = W * 0.36
    // Rays fade out along their length; each is drawn at the 9 lattice
    // offsets so the tile repeats seamlessly.
    const ray = (x, y, a, len, color, alpha, width) => {
      const ex = x + Math.cos(a) * len
      const ey = y + Math.sin(a) * len
      for (const ox of [-W, 0, W])
        for (const oy of [-W, 0, W]) {
          const g = ctx.createLinearGradient(x + ox, y + oy, ex + ox, ey + oy)
          g.addColorStop(0, color)
          g.addColorStop(1, 'transparent')
          ctx.globalAlpha = alpha
          ctx.strokeStyle = g
          ctx.lineWidth = width
          ctx.beginPath()
          ctx.moveTo(x + ox, y + oy)
          ctx.lineTo(ex + ox, ey + oy)
          ctx.stroke()
        }
    }
    const hubs = [{ x: C, y: C, len: W * 0.62, main: true }]
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      hubs.push({ x: C + Math.cos(a) * R, y: C + Math.sin(a) * R, len: W * 0.3, main: false })
    }
    for (const h of hubs)
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2 - Math.PI / 2
        ray(h.x, h.y, a, h.len, windColor(i), h.main ? 0.5 : 0.32, h.main ? 1.4 : 1)
      }
    ctx.globalAlpha = 1
    const big = await loadImage(roseDataUrl('color', 512))
    const small = await loadImage(roseDataUrl('color', 256))
    if (big) ctx.drawImage(big, C - 170, C - 170, 340, 340)
    if (small)
      hubs.slice(1).forEach((h, i) => {
        if (i % 4 !== 0) return
        ctx.globalAlpha = 0.85
        ctx.drawImage(small, h.x - 60, h.y - 60, 120, 120)
      })
    ctx.globalAlpha = 1
    return await new Promise((res) =>
      c.toBlob((b) => res(b ? URL.createObjectURL(b) : c.toDataURL('image/png')), 'image/png')
    )
  })()
  return chartPromise
}

function el(parent, css) {
  const d = document.createElement('div')
  d.style.cssText = 'position:absolute;pointer-events:none;will-change:transform;' + css
  parent.appendChild(d)
  return d
}

export class MedievalBackdrop {
  constructor(host) {
    this.host = host
    host.style.opacity = '0'
    host.style.transition = 'opacity 900ms ease'
    this.vellum = el(
      host,
      `inset:-${VELLUM_TILE}px;background-image:var(--med-vellum,none);background-size:${VELLUM_TILE}px ${VELLUM_TILE}px;background-repeat:repeat;`
    )
    this.chart = el(
      host,
      `inset:-${CHART_TILE}px;background-repeat:repeat;background-size:${CHART_TILE}px ${CHART_TILE}px;opacity:0;transition:opacity 1400ms ease;`
    )
    this.country = el(
      host,
      'left:-25%;right:-25%;bottom:4%;height:min(26%,260px);background-repeat:repeat-x;background-size:auto 100%;background-position:0 100%;opacity:0;transition:opacity 1600ms ease;-webkit-mask-image:linear-gradient(to top,transparent 0,#000 30%);mask-image:linear-gradient(to top,transparent 0,#000 30%);'
    )
    // candlelight: the edges of the chart fall into warm shadow
    el(
      host,
      'inset:0;will-change:auto;background:radial-gradient(ellipse 110% 90% at 50% 45%,transparent 55%,rgba(90,52,16,0.2));'
    )
    this.visible = false
    this.t = { x: 0, y: 0, k: 1 }
    this._skyTileW = 0
    this._token = 0
    this._last = { vellum: '', chart: '', country: '' }
    this._ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this._measure()) : null
    this._ro?.observe(host)
  }

  _measure() {
    const h = this.country.clientHeight
    const tw = h ? (SKY_W * h) / SKY_H : 0
    if (Math.abs(tw - this._skyTileW) >= 0.5) {
      this._skyTileW = tw
      const ext = `calc(-25% - ${Math.ceil(tw)}px)`
      this.country.style.left = ext
      this.country.style.right = ext
    }
    this._last = { vellum: '', chart: '', country: '' }
    this.setCamera(this.t)
  }

  /** `theme` is the app theme string; the chart shows only in 'medieval'. */
  setTheme(theme) {
    const on = theme === 'medieval'
    if (on === this.visible) return
    this.visible = on
    this.host.style.opacity = on ? '1' : '0'
    if (!on) return
    const token = ++this._token
    chartUrl().then((url) => {
      if (token !== this._token) return
      this.chart.style.backgroundImage = `url("${url}")`
      this.chart.style.opacity = '0.38'
    })
    this.country.style.backgroundImage = `url("${skylineDataUrl(SKY_W, SKY_H, 37)}")`
    this.country.style.opacity = '0.2'
    this._last = { vellum: '', chart: '', country: '' }
    this.setCamera(this.t)
  }

  setCamera(t) {
    this.t = t
    if (!this.visible) return
    const v = backdropOffset(t, 0.5)
    const c = backdropOffset(t, 0.3)
    const s = backdropOffset(t, 0.06)
    const vellum = `translate3d(${wrap(v.x, VELLUM_TILE).toFixed(1)}px,${wrap(v.y, VELLUM_TILE).toFixed(1)}px,0)`
    const chart = `translate3d(${wrap(c.x, CHART_TILE).toFixed(1)}px,${wrap(c.y, CHART_TILE).toFixed(1)}px,0)`
    const sy = Math.max(-40, Math.min(40, s.y * 0.5))
    const country = `translate3d(${wrap(s.x, this._skyTileW).toFixed(1)}px,${sy.toFixed(1)}px,0) scale(${Math.pow(t.k || 1, 0.06).toFixed(4)})`
    if (vellum !== this._last.vellum) this.vellum.style.transform = this._last.vellum = vellum
    if (chart !== this._last.chart) this.chart.style.transform = this._last.chart = chart
    if (country !== this._last.country) this.country.style.transform = this._last.country = country
  }

  dispose() {
    this._ro?.disconnect()
    this._token++
    this.host.replaceChildren()
  }
}
