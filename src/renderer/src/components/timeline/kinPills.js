import { roundRect } from '../webgl/overlayUtils.js'

// Kinship lens: a pill over each relative's avatar naming what they are to the
// viewpoint person, revealed nearest-kin first, plus the reveal's expanding
// ripple around the viewpoint.
export function drawKinPills(r, ctx, c, font, kin, st) {
  const L = r.layout
  const aScale = st.avatarSize ?? 1
  if (kin.wave) {
    const s = r.personScreen(kin.wave.id)
    if (s) {
      ctx.save()
      ctx.globalAlpha = Math.max(0, kin.wave.alpha)
      ctx.strokeStyle = kin.wave.color
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(s.x, s.y0, kin.wave.r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  }
  if (!kin.labels) return
  ctx.save()
  ctx.font = `750 10.5px ${font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < L.people.length; i++) {
    const p = L.people[i]
    const lab = kin.labels.get(p.id)
    if (!lab) continue
    const a = r._pAnim.get(p.id)
    if (!a || a.op < 0.05) continue
    const x = r.sx(r._lane(p.id, p.laneX))
    const y0 = r.sy(p.birthYear)
    if (x < -80 || x > r.width + 80 || y0 < -40 || y0 > r.height + 60) continue
    const t = kin.reveal ? kin.reveal(p.id) : 1
    if (t <= 0) continue
    const w = ctx.measureText(lab.text).width + 16
    const h = 19
    const cy = y0 - 15 * aScale * a.s - 17 + (1 - t) * 10
    ctx.globalAlpha = a.op * t
    ctx.fillStyle = c.surface
    ctx.strokeStyle = lab.color
    ctx.lineWidth = 1.5
    roundRect(ctx, x - w / 2, cy - h / 2, w, h, h / 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = lab.color
    ctx.fillText(lab.text, x, cy + 0.5)
  }
  ctx.restore()
}
