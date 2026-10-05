// 水墨 backdrop for the graph: rice-paper grain and two ranges of distant misty
// mountains (山水) behind the WebGL canvas, in parallax with the camera.
//
// Pure DOM layers (no per-frame work): the renderer forwards camera changes and
// we rewrite a couple of style properties — the paper drifts at half the pan
// speed, the far range barely moves, the near range a little more, and zooming
// breathes their scale very slightly so depth reads without ever distracting.
// The mountain art is painted once per mode with lib/inkArt's mountainRange
// (expensive bristle strokes → done off the critical path, cached per mode, and
// tiled seamlessly along x).
//
// Modes (inkStyle.inkLook().mode): 'paper' — ink on rice paper (the Ink theme);
// 'moon' — pale ink on night paper with a moon (dark theme + Mist atmosphere);
// 'light' — the paper palette over the light theme's ground.

import { mountainRange, rng } from '../../lib/inkArt'
import { backdropOffset } from './inkStyle.js'

const TILE_W = 2048
const art = new Map() // mode → Promise<{ far: url, near: url }>

// farA/nearA are the effective ink strengths. The art is painted `boost`× denser
// and the layer shown at 1/boost opacity: faint canvas gradients dither visibly
// (a fine grid, worst on dark grounds) — painting dense and fading in CSS hides it.
const PALETTES = {
  paper: { far: '#5e6873', near: '#2e2b26', mist: '#ece3cf', farA: 0.32, nearA: 0.36, boost: 2.2 },
  light: { far: '#6a7684', near: '#3a3833', mist: '#f3f4f8', farA: 0.22, nearA: 0.32, boost: 2.6 },
  moon: { far: '#7d8796', near: '#a9a496', mist: '#13151b', farA: 0.16, nearA: 0.12, boost: 4 }
}

function paintRange(w, h, seed, color, alpha, mistColor, detail, layers) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  const r = rng(seed)
  for (const L of layers) {
    let x = 0
    while (x < w) {
      const ww = w * (L.wMin + r() * L.wVar)
      const hh = h * L.h * (0.6 + r() * 0.5)
      const peaks = 2 + Math.floor(r() * L.peaks)
      const s = seed + Math.round(x)
      // Open stretches of mist between the ranges — empty space is part of it (留白).
      if (r() < (L.skip || 0)) {
        x += ww * (0.6 + r() * 0.5)
        continue
      }
      // Draw at x, and wrapped by one tile so the strip repeats seamlessly.
      for (const off of [0, -w, w]) {
        if (x + off + ww < 0 || x + off > w) continue
        mountainRange(ctx, x + off, h - L.base * h, ww, hh, {
          color,
          alpha: alpha * L.a,
          seed: s,
          peaks,
          mist: L.mist,
          detail: detail && L.detail,
          mistColor
        })
      }
      x += ww * (0.5 + r() * 0.35)
    }
  }
  return new Promise((res) => {
    if (c.toBlob) c.toBlob((b) => res(b ? URL.createObjectURL(b) : c.toDataURL()), 'image/png')
    else res(c.toDataURL())
  })
}

function artFor(mode) {
  if (art.has(mode)) return art.get(mode)
  const p = PALETTES[mode] || PALETTES.paper
  const job = new Promise((res) => {
    // Paint after the brush strokes have written themselves in (the painting is
    // a few hundred ms of bristle simulation), then let the ranges rise from the mist.
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 60))
    const later = (fn) => setTimeout(() => idle(fn, { timeout: 2000 }), 1700)
    later(async () => {
      const far = await paintRange(TILE_W, 420, 31, p.far, p.farA * p.boost, null, false, [
        {
          wMin: 0.16,
          wVar: 0.2,
          h: 0.8,
          peaks: 4,
          a: 0.55,
          mist: 0.65,
          base: 0,
          detail: false,
          skip: 0.3
        },
        {
          wMin: 0.12,
          wVar: 0.16,
          h: 0.5,
          peaks: 3,
          a: 0.9,
          mist: 0.6,
          base: 0,
          detail: false,
          skip: 0.35
        }
      ])
      const near = await paintRange(TILE_W, 300, 57, p.near, p.nearA * p.boost, null, true, [
        {
          wMin: 0.16,
          wVar: 0.2,
          h: 0.75,
          peaks: 3,
          a: 0.85,
          mist: 0.6,
          base: 0,
          detail: true,
          skip: 0.55
        }
      ])
      res({ far, near })
    })
  })
  art.set(mode, job)
  return job
}

function el(parent, css) {
  const d = document.createElement('div')
  d.style.cssText =
    'position:absolute;pointer-events:none;will-change:transform,background-position;' + css
  parent.appendChild(d)
  return d
}

export class InkBackdrop {
  constructor(host) {
    this.host = host
    host.style.opacity = '0'
    host.style.transition = 'opacity 900ms ease'
    this.paper = el(
      host,
      'inset:0;background-image:var(--ink-paper,none);background-size:512px 512px;background-repeat:repeat;opacity:0.9;'
    )
    this.moon = el(
      host,
      'left:64%;top:6%;width:110px;height:110px;border-radius:50%;display:none;' +
        'background:radial-gradient(circle,rgba(238,232,214,0.92) 0 30%,rgba(238,232,214,0.18) 33%,rgba(238,232,214,0) 70%);'
    )
    this.far = el(
      host,
      'left:-25%;right:-25%;bottom:12%;height:min(30%,300px);background-repeat:repeat-x;-webkit-mask-image:linear-gradient(to top,transparent 0,#000 28%);mask-image:linear-gradient(to top,transparent 0,#000 28%);background-size:auto 100%;background-position:0 100%;transform-origin:50% 100%;opacity:0;transition:opacity 1200ms ease;'
    )
    this.near = el(
      host,
      'left:-25%;right:-25%;bottom:5%;height:min(22%,230px);background-repeat:repeat-x;-webkit-mask-image:linear-gradient(to top,transparent 0,#000 30%);mask-image:linear-gradient(to top,transparent 0,#000 30%);background-size:auto 100%;background-position:0 100%;transform-origin:50% 100%;opacity:0;transition:opacity 1400ms ease;'
    )
    // The ranges dissolve into a band of mist at the foot (留白 under the toolbar).
    this.mist = el(host, 'left:0;right:0;bottom:0;height:22%;')
    this.visible = false
    this.mode = null
    this.t = { x: 0, y: 0, k: 1 }
    this._token = 0
  }

  setLook(look, theme) {
    const on = !!look.backdrop
    const mode = look.mode === 'off' ? (theme === 'dark' ? 'moon' : 'light') : look.mode
    this.visible = on
    this.host.style.opacity = on ? '1' : '0'
    if (!on || mode === this.mode) return
    this.mode = mode
    const p = PALETTES[mode] || PALETTES.paper
    this.paper.style.display = mode === 'paper' ? '' : 'none'
    this.moon.style.display = mode === 'moon' ? '' : 'none'
    this.mist.style.background = `linear-gradient(to top, ${p.mist} 0%, ${p.mist}00 100%)`
    this.far.style.opacity = '0'
    this.near.style.opacity = '0'
    const token = ++this._token
    artFor(mode).then(({ far, near }) => {
      if (token !== this._token) return
      this.far.style.backgroundImage = `url("${far}")`
      this.near.style.backgroundImage = `url("${near}")`
      const op = (1 / (p.boost || 1)).toFixed(3)
      this.far.style.opacity = op
      this.near.style.opacity = op
      this.setCamera(this.t)
    })
  }

  setCamera(t) {
    this.t = t
    if (!this.visible) return
    const k = t.k || 1
    const pp = backdropOffset(t, 0.5)
    this.paper.style.backgroundPosition = `${pp.x.toFixed(1)}px ${pp.y.toFixed(1)}px`
    const f = backdropOffset(t, 0.04)
    const n = backdropOffset(t, 0.1)
    // background-position scrolls the endless strip; translate/scale add depth.
    this.far.style.backgroundPositionX = `${f.x.toFixed(1)}px`
    this.near.style.backgroundPositionX = `${n.x.toFixed(1)}px`
    const fy = Math.max(-40, Math.min(40, f.y * 0.5))
    const ny = Math.max(-60, Math.min(60, n.y * 0.5))
    this.far.style.transform = `translate3d(0,${fy.toFixed(1)}px,0) scale(${Math.pow(k, 0.05).toFixed(4)})`
    this.near.style.transform = `translate3d(0,${ny.toFixed(1)}px,0) scale(${Math.pow(k, 0.1).toFixed(4)})`
  }

  dispose() {
    this._token++
    this.host.replaceChildren()
  }
}
