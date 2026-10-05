// The chronicle on the Timeline — eras and story events drawn on the 2D
// canvases, shared by the classic renderer and the 水墨 ink renderer.
//
//   bg: era bands — soft colour washes across every lane for each era's span.
//   fg: the era rail in the year gutter (one stripe per overlap lane), sticky
//       chapter headers riding the top of each band, event pills on the event
//       rail (just right of the gutter) with a hairline across the lanes, span
//       brackets for events that last, and rings on each participant's
//       lifeline at the event's year.
//
// Everything is screen-space and culled; nothing here allocates per frame
// beyond the hit rects. The model comes from the view through
// `r.hooks.getChronicle()`:
//   { eras: [{ id, name, icon, color, a, b, lane }], laneCount,
//     events: [{ id, title, icon, color, a, b, importance, personIds }],
//     hover: { kind, id } | null }
// (a / b are fractional-year ordinals; ±Infinity = an open era end.)

import { GUTTER } from './timelineLayout.js'

// The event rail sits just clear of the Time-travel slider panel that rides
// the gutter's right edge, so pills and chapter headers are never under it.
const RAIL_X = GUTTER + 96
const STICKY_TOP = 200 // just under the minimap (14px inset + 180px tall)

function hexRgb(hex) {
  const h = String(hex || '').replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h.slice(0, 6), 16)
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [108, 142, 245]
}
const rgba = (hex, a) => {
  const [r, g, b] = hexRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}
function pill(ctx, x, y, w, h, r) {
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r)
  else ctx.rect(x, y, w, h)
}
const yearText = (v) => (Number.isFinite(v) ? String(Math.floor(v)) : '')

/** Era bands behind everything (bg canvas). */
export function drawChronicleBg(r, ctx) {
  const ch = r.hooks.getChronicle?.()
  if (!ch || !ch.eras.length || !r.layout.people.length) return
  const k = ch.eraIntensity ?? 1 // Style pane: how strongly eras wash the stage
  if (k <= 0.01) return
  const W = r.width,
    H = r.height
  for (const e of ch.eras) {
    const y0 = Number.isFinite(e.a) ? r.sy(e.a) : -20
    const y1 = Number.isFinite(e.b) ? r.sy(e.b) : H + 20
    if (y1 < 0 || y0 > H || y1 - y0 < 0.5) continue
    const hot = ch.hover?.kind === 'era' && ch.hover.id === e.id
    const top = Math.max(-2, y0)
    const bot = Math.min(H + 2, y1)
    // A wash that's a touch stronger at the band's leading edge.
    const g = ctx.createLinearGradient(0, top, 0, bot)
    const base = (r.light ? 0.075 : 0.085) * (hot ? 1.8 : 1) * k
    g.addColorStop(0, rgba(e.color, base * 1.45))
    g.addColorStop(Math.min(1, 40 / Math.max(1, bot - top)), rgba(e.color, base))
    g.addColorStop(1, rgba(e.color, base * 0.75))
    ctx.fillStyle = g
    ctx.fillRect(GUTTER, top, W - GUTTER, bot - top)
    ctx.save()
    ctx.strokeStyle = rgba(e.color, hot ? 0.75 : 0.4 * Math.min(1, k))
    ctx.lineWidth = 1
    ctx.setLineDash([6, 6])
    for (const y of [y0, y1]) {
      if (y < 0 || y > H) continue
      ctx.beginPath()
      ctx.moveTo(GUTTER, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
    ctx.restore()
  }
}

/** Era rail + chapter headers + events (fg canvas). Records hit rects on
 *  `r._chronRects` for chronicleAt(). */
export function drawChronicleFg(r, ctx, c) {
  r._chronRects = []
  const ch = r.hooks.getChronicle?.()
  if (!ch || !r.layout.people.length) return
  const W = r.width,
    H = r.height
  const px = r.camera2.px
  const font = 'system-ui, sans-serif'
  const surface = r.light ? 'rgba(255,255,255,0.94)' : 'rgba(18,21,31,0.9)'

  // ── Eras: rail stripes in the gutter + sticky chapter headers ──
  const headers = []
  for (const e of ch.eras) {
    const y0 = Number.isFinite(e.a) ? r.sy(e.a) : -20
    const y1 = Number.isFinite(e.b) ? r.sy(e.b) : H + 20
    if (y1 < 0 || y0 > H) continue
    const hot = ch.hover?.kind === 'era' && ch.hover.id === e.id
    const x = 1 + e.lane * 5
    ctx.fillStyle = rgba(e.color, hot ? 1 : 0.8)
    pill(ctx, x, Math.max(-4, y0 + 1), 3, Math.min(H + 8, y1) - Math.max(-4, y0 + 1) - 1, 1.5)
    ctx.fill()

    // Header: sticky at the top of the visible band, pushed off by its end.
    if (y1 - y0 < 26) continue
    const label = `${e.icon ? e.icon + ' ' : ''}${e.name}`
    const span = `${yearText(e.a) || '…'} – ${yearText(e.b) || 'now'}`
    ctx.font = `800 11px ${font}`
    const tw = ctx.measureText(label).width
    ctx.font = `600 9.5px ${font}`
    const sw = ctx.measureText(span).width
    const w = tw + sw + 30
    const h = 22
    // Sticky: rides the top of the visible band (stopping below the stage's
    // top-left minimap), pushed off by the band's end; overlap lanes step right.
    const hy = Math.min(Math.max(y0 + 8, STICKY_TOP), y1 - h - 6)
    const hx = RAIL_X + e.lane * 14
    ctx.globalAlpha = 0.97
    ctx.fillStyle = surface
    pill(ctx, hx, hy, w, h, 11)
    ctx.fill()
    ctx.strokeStyle = rgba(e.color, hot ? 1 : 0.7)
    ctx.lineWidth = hot ? 1.6 : 1
    ctx.stroke()
    ctx.fillStyle = e.color
    pill(ctx, hx + 5, hy + 5, 4, h - 10, 2)
    ctx.fill()
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.font = `800 11px ${font}`
    ctx.fillStyle = c.t1
    ctx.fillText(label, hx + 15, hy + h / 2 + 0.5)
    ctx.font = `600 9.5px ${font}`
    ctx.fillStyle = c.t3
    ctx.fillText(span, hx + 21 + tw, hy + h / 2 + 0.5)
    ctx.globalAlpha = 1
    r._chronRects.push({ kind: 'era', id: e.id, x: hx, y: hy, w, h })
    headers.push({ x: hx, y: hy, w, h })
  }

  // ── Events ──
  const laneOf = new Map(r.layout.people.map((p) => [p.id, p]))
  const placed = [...headers] // rail rects (headers first), for stacking
  const markers = ch.markers || 'pills' // pills | dots | hidden
  const visible = ch.events
    .filter(() => markers !== 'hidden')
    .filter((ev) => Number.isFinite(ev.a))
    .filter((ev) => (ev.importance >= 3 ? true : ev.importance === 2 ? px >= 0.5 : px >= 2.2))
    .sort((x, y) => y.importance - x.importance || x.a - y.a)
  for (const ev of visible) {
    const y = r.sy(ev.a)
    const yb = Number.isFinite(ev.b) ? r.sy(ev.b) : y
    if (yb < -30 || y > H + 30) continue
    const hot = ch.hover?.kind === 'event' && ch.hover.id === ev.id
    const s = ev.importance === 3 ? 1.15 : ev.importance === 1 ? 0.85 : 1

    // Hairline across every lane.
    ctx.save()
    ctx.strokeStyle = rgba(ev.color, hot ? 0.75 : 0.28)
    ctx.lineWidth = hot ? 1.6 : 1
    ctx.setLineDash(hot ? [] : [3, 5])
    ctx.beginPath()
    ctx.moveTo(GUTTER, y)
    ctx.lineTo(W, y)
    ctx.stroke()
    ctx.restore()

    // A lasting event: a bracket down the rail to its end.
    if (yb - y > 3) {
      ctx.save()
      ctx.strokeStyle = rgba(ev.color, hot ? 0.95 : 0.6)
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(RAIL_X - 4, y)
      ctx.lineTo(RAIL_X - 4, yb)
      ctx.stroke()
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(RAIL_X - 4, yb)
      ctx.lineTo(RAIL_X + 6, yb)
      ctx.stroke()
      ctx.restore()
    }

    // Participants: rings on their lifelines at this moment.
    for (const pid of ev.personIds) {
      const p = laneOf.get(pid)
      if (!p) continue
      const x = r.sx(r._lane(pid, p.laneX))
      if (x < GUTTER || x > W + 10) continue
      ctx.beginPath()
      ctx.arc(x, y, (hot ? 9 : 6.5) * s, 0, Math.PI * 2)
      ctx.fillStyle = rgba(ev.color, hot ? 0.35 : 0.2)
      ctx.fill()
      ctx.lineWidth = hot ? 2.2 : 1.6
      ctx.strokeStyle = rgba(ev.color, hot ? 1 : 0.85)
      ctx.shadowColor = ev.color
      ctx.shadowBlur = hot ? 12 : 5
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    // The pill: icon disc + title (+ year). Stacks right when crowded.
    ctx.font = `${ev.importance === 3 ? 800 : 700} ${11 * s}px ${font}`
    const showTitle = hot || (markers !== 'dots' && (px >= 1.2 || ev.importance === 3))
    const title = showTitle ? truncate(ev.title, 28) : ''
    const tw = title ? ctx.measureText(title).width : 0
    ctx.font = `600 ${9 * s}px ${font}`
    const yt = yearText(ev.a)
    const yw = title ? ctx.measureText(yt).width + 8 : 0
    const h = 20 * s
    const w = (title ? tw + yw + 34 : 22) * 1
    let x = RAIL_X
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
    const py = y - h / 2
    placed.push({ x, y: py, w, h })
    ctx.globalAlpha = 1
    ctx.fillStyle = surface
    pill(ctx, x, py, w, h, h / 2)
    ctx.shadowColor = rgba(ev.color, hot ? 0.8 : 0.35)
    ctx.shadowBlur = hot ? 14 : 6
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = rgba(ev.color, hot ? 1 : 0.75)
    ctx.lineWidth = hot ? 1.6 : 1
    ctx.stroke()
    // icon disc
    ctx.beginPath()
    ctx.arc(x + h / 2, y, h / 2 - 2.5, 0, Math.PI * 2)
    ctx.fillStyle = rgba(ev.color, 0.28)
    ctx.fill()
    ctx.font = `${11 * s}px ${font}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = c.t1
    ctx.fillText(ev.icon, x + h / 2, y + 0.5)
    if (title) {
      ctx.textAlign = 'left'
      ctx.font = `${ev.importance === 3 ? 800 : 700} ${11 * s}px ${font}`
      ctx.fillStyle = c.t1
      ctx.fillText(title, x + h + 4, y + 0.5)
      ctx.font = `600 ${9 * s}px ${font}`
      ctx.fillStyle = c.t3
      ctx.fillText(yt, x + h + 8 + tw, y + 0.5)
    }
    r._chronRects.push({ kind: 'event', id: ev.id, x, y: py, w, h })
  }
}

function truncate(s, n) {
  s = s || ''
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

/** What chronicle item (event pill / era header) sits under a screen point. */
export function chronicleAt(r, mx, my) {
  const rects = r._chronRects || []
  for (let i = rects.length - 1; i >= 0; i--) {
    const q = rects[i]
    if (mx >= q.x && mx <= q.x + q.w && my >= q.y && my <= q.y + q.h) return q
  }
  return null
}
