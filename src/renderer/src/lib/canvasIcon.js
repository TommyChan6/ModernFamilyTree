// Draw the app's icons (components/ui/icons.js) on a Canvas 2D context, so
// canvas views use the same SVG icon set as the DOM instead of emoji text
// (whose size/baseline varies per OS font and never centres reliably).
//
//   drawIcon(ctx, 'crown', cx, cy, 14, { color: '#f5c542' })
//   const img = iconCanvas('star', 32, '#fff')   // cached, e.g. for textures
import { iconNode } from '../components/ui/icons.js'

const pathCache = new Map()

function num(v, d = 0) {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : d
}

function points(str) {
  const p = String(str || '')
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  const out = []
  for (let i = 0; i + 1 < p.length; i += 2) out.push([p[i], p[i + 1]])
  return out
}

/** One Path2D (in 24×24 icon space) for an icon value, or null if unknown. */
export function iconPath(value) {
  if (pathCache.has(value)) return pathCache.get(value)
  const node = iconNode(value)
  let path = null
  if (node && typeof Path2D !== 'undefined') {
    path = new Path2D()
    for (const [tag, a] of node) {
      if (tag === 'path') path.addPath(new Path2D(a.d))
      else if (tag === 'circle') {
        const cx = num(a.cx),
          cy = num(a.cy),
          r = num(a.r)
        path.moveTo(cx + r, cy)
        path.arc(cx, cy, r, 0, Math.PI * 2)
      } else if (tag === 'ellipse') {
        const cx = num(a.cx),
          cy = num(a.cy),
          rx = num(a.rx),
          ry = num(a.ry)
        path.moveTo(cx + rx, cy)
        path.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      } else if (tag === 'rect') {
        const x = num(a.x),
          y = num(a.y),
          w = num(a.width),
          h = num(a.height),
          r = num(a.rx, num(a.ry))
        const sub = new Path2D()
        if (r > 0 && sub.roundRect) sub.roundRect(x, y, w, h, r)
        else sub.rect(x, y, w, h)
        path.addPath(sub)
      } else if (tag === 'line') {
        path.moveTo(num(a.x1), num(a.y1))
        path.lineTo(num(a.x2), num(a.y2))
      } else if (tag === 'polyline' || tag === 'polygon') {
        const pts = points(a.points)
        pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)))
        if (tag === 'polygon' && pts.length) path.closePath()
      }
    }
  }
  pathCache.set(value, path)
  return path
}

/**
 * Stroke an icon centred on (cx, cy) at `size` CSS px.
 * Returns false (drawing nothing) when the value isn't a known icon.
 */
export function drawIcon(ctx, value, cx, cy, size, { color, lineWidth = 2, alpha } = {}) {
  const path = iconPath(value)
  if (!path) return false
  const s = size / 24
  ctx.save()
  ctx.translate(cx - size / 2, cy - size / 2)
  ctx.scale(s, s)
  if (alpha != null) ctx.globalAlpha *= alpha
  ctx.strokeStyle = color || ctx.fillStyle
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke(path)
  ctx.restore()
  return true
}

const bitmapCache = new Map()

/** A cached square canvas of `px` device pixels with the icon drawn in `color`. */
export function iconCanvas(value, px, color = '#fff', lineWidth = 2) {
  const key = `${value}|${px}|${color}|${lineWidth}`
  let c = bitmapCache.get(key)
  if (c) return c
  c = document.createElement('canvas')
  c.width = c.height = px
  drawIcon(c.getContext('2d'), value, px / 2, px / 2, px * 0.92, { color, lineWidth })
  bitmapCache.set(key, c)
  return c
}
