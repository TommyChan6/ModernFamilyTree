// 水墨 — the Groups stage's Ink-theme overlay (screen-space Canvas 2D): names in
// calligraphy, multi-membership counts as tiny cinnabar seals, each group's
// header as a paper plaque hung from a nail on two cords with the group's seal,
// and the drag ghost as an ink roundel inside an ensō. Kept apart from
// FactionsRenderer so the classic overlay stays untouched; every function takes
// the renderer and reads its transform / tween maps.
import { worldToScreen } from '../../graph/webgl/coords.js'
import { inkPigment, hexToRgb01, rgbToHex, CINNABAR_RGB } from '../../webgl/inkMath'
import { INK, INK_FONTS, sealCanvas, sealChars, hashStr } from '../../../lib/inkArt'
import { ensoRing } from '../../timeline/inkBackdrop.js'

const NODE_R = 17
export const CINNABAR = CINNABAR_RGB

/** A UI colour as the ink-ground pigment the stage paints it with (cached). */
export function inkNodePigment(r, css) {
  let p = r._pigments.get(css)
  if (!p) r._pigments.set(css, (p = inkPigment(hexToRgb01(css), { sat: 0.55, ink: 0.5 })))
  return p
}

function plaqueSeal(r, label) {
  if (!r._fontsOk) return null
  return sealCanvas(label || '印', { size: 64, mode: 'yin', seed: hashStr(label || '') })
}

export function drawInkOverlay(r) {
  const ctx = r.overlay,
    c = r._css.get(),
    t = r.transform,
    k = t.k
  ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0)
  ctx.clearRect(0, 0, r.width, r.height)
  r._pillRects = []
  const kai = INK_FONTS.kai
  const nodesArr = r.hooks.getNodes()
  const metas = r.hooks.getMeta()

  // Names in calligraphy (culled + LOD), with multi-membership seals.
  const nameFontPx = 13 * k
  if (nameFontPx >= 6) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.lineJoin = 'round'
    for (const n of nodesArr) {
      const meta = metas.get(n.id)
      if (!meta) continue
      const s = worldToScreen(n.x, n.y, t)
      if (s.x < -80 || s.x > r.width + 80 || s.y < -80 || s.y > r.height + 80) continue
      const v = r._pVis.get(n.id)
      const a = r._pAnim.get(n.id)
      const alpha = a ? a.op * r._entrance(a).e : 1
      if (alpha <= 0.02) continue
      ctx.globalAlpha = alpha
      if (!meta.imageUrl) {
        // 白文 — the initials left as bare paper inside the ink blot
        const chars = sealChars(meta.label)
        ctx.font = `${(chars.length > 1 ? 12.5 : 16) * k}px ${kai}`
        ctx.fillStyle = 'rgba(246, 240, 226, 0.92)'
        ctx.textBaseline = 'middle'
        ctx.fillText(chars.slice(0, 2), s.x, s.y + 1.5 * k)
        ctx.textBaseline = 'alphabetic'
      }
      ctx.font = `${nameFontPx}px ${kai}`
      ctx.strokeStyle = c.bg
      ctx.lineWidth = 3 * k
      ctx.fillStyle = v?.lit ? INK.ink : c.t2
      const y = s.y + (NODE_R + 17) * k
      ctx.strokeText(meta.label, s.x, y)
      ctx.fillText(meta.label, s.x, y)

      if (meta.multi && 7.5 * k >= 3.5) {
        const bx = s.x + (NODE_R - 1) * k
        const by = s.y - (NODE_R - 1) * k
        const h = 7.5 * k
        ctx.save()
        ctx.translate(bx, by)
        ctx.rotate(0.06)
        ctx.fillStyle = INK.cinnabar
        ctx.fillRect(-h, -h, h * 2, h * 2)
        ctx.fillStyle = '#fbf4e6'
        ctx.font = `${10 * k}px ${kai}`
        ctx.textBaseline = 'middle'
        ctx.fillText(String(meta.count), 0, 0.8 * k)
        ctx.restore()
        ctx.textBaseline = 'alphabetic'
      }
      ctx.globalAlpha = 1
    }
  }

  // Group plaques (匾) hung above their pools.
  ctx.textBaseline = 'middle'
  for (const z of r.hooks.getZones()) {
    const a = r._zAnim.get(z.id)
    if (!a || a.op <= 0.02) continue
    const ps = a.ps
    const h = 26 * k * ps
    // calligraphy (esp. CJK) runs wider than the classic pill's estimate
    ctx.font = `${14 * k * ps}px ${kai}`
    const textW = ctx.measureText(z.label).width + ctx.measureText(String(z.count)).width
    const w = Math.max(z.headerW * k * ps, textW + h + 26 * k * ps)
    const cs = worldToScreen(z.x, z.y - z.r - 30 + 13, t)
    const x = cs.x - w / 2,
      y = cs.y - h / 2
    if (x + w < -20 || x > r.width + 20 || y + h < -40 || y > r.height + 20) continue
    ctx.globalAlpha = a.op
    const tint = rgbToHex(inkNodePigment(r, z.color))
    // cords from the nail to the plaque's shoulders
    const nailY = y - 13 * k * ps
    ctx.strokeStyle = INK.ink
    ctx.lineWidth = Math.max(0.6, 0.9 * k)
    ctx.beginPath()
    ctx.moveTo(x + w * 0.22, y + 1)
    ctx.lineTo(cs.x, nailY)
    ctx.lineTo(x + w * 0.78, y + 1)
    ctx.stroke()
    ctx.fillStyle = INK.ink
    ctx.beginPath()
    ctx.arc(cs.x, nailY, Math.max(1, 1.8 * k), 0, Math.PI * 2)
    ctx.fill()
    // the board: paper, a faint wash of the group's pigment, a double ink frame
    ctx.save()
    ctx.shadowColor = 'rgba(60, 40, 15, 0.22)'
    ctx.shadowBlur = 6 * k
    ctx.shadowOffsetY = 2 * k
    ctx.fillStyle = c.surface
    ctx.fillRect(x, y, w, h)
    ctx.restore()
    ctx.globalAlpha = a.op * 0.14
    ctx.fillStyle = tint
    ctx.fillRect(x, y, w, h)
    ctx.globalAlpha = a.op
    ctx.strokeStyle = INK.ink
    ctx.lineWidth = Math.max(0.8, 1.6 * k)
    ctx.strokeRect(x, y, w, h)
    ctx.lineWidth = Math.max(0.4, 0.6 * k)
    ctx.strokeRect(x + 2.5 * k, y + 2.5 * k, w - 5 * k, h - 5 * k)
    if (12 * k >= 5.5) {
      const sh = h - 9 * k
      const seal = plaqueSeal(r, z.label)
      if (seal) ctx.drawImage(seal, x + 5 * k, y + 4.5 * k, sh, sh)
      ctx.font = `${14 * k * ps}px ${kai}`
      ctx.fillStyle = INK.ink
      ctx.textAlign = 'left'
      ctx.fillText(z.label, x + 9 * k + sh, cs.y + 1)
      ctx.font = `${13 * k * ps}px ${kai}`
      ctx.fillStyle = INK.cinnabar
      ctx.textAlign = 'right'
      ctx.fillText(String(z.count), x + w - 9 * k, cs.y + 1)
    }
    ctx.globalAlpha = 1
    r._pillRects.push({ x, y, w, h, id: z.id })
  }

  // Drag ghost: an ink roundel inside a freshly brushed ensō.
  const ghost = r.hooks.getGhost()
  if (ghost && ghost.over) {
    const s = worldToScreen(ghost.x, ghost.y, t)
    const rad = NODE_R * k
    ctx.globalAlpha = 0.8
    ctx.beginPath()
    ctx.arc(s.x, s.y, rad, 0, Math.PI * 2)
    ctx.fillStyle = rgbToHex(inkNodePigment(r, ghost.color))
    ctx.fill()
    if (r._fontsOk) {
      const e = ensoRing({ seed: 9, color: INK.cinnabar })
      const R = rad * 1.75
      ctx.drawImage(e, s.x - R, s.y - R, R * 2, R * 2)
    }
    ctx.font = `${13 * k}px ${kai}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = c.t2
    ctx.fillText(ghost.label, s.x, s.y + (NODE_R + 17) * k)
    ctx.globalAlpha = 1
  }
}
