// 水墨 — the Timeline's Ink-theme drawing: a handscroll / ruled calligraphy
// sheet. Kept beside TimelineRenderer (which owns state, tweens and the frame
// loop) so the classic drawing path stays untouched; every function takes the
// renderer and reads its camera / layout / tween maps.
//
//   GL   lifelines → InkStrokeLayer brush strokes (pressed in at birth, drying
//        to 飞白 toward death, still wet at the present edge), births → ink
//        drops blooming under the seal, deaths → a mist puff where the brush
//        lifts, marriages → the swaying cinnabar red thread (红线), births →
//        dry brush flicks, avatars → only photo pins (others are seals, fg)
//   bg   ruled columns (乌丝栏) between lanes, ink year rules (decades heavier),
//        parallaxing misty mountains along the bottom, a vertical inscription
//   fg   round cinnabar seals, calligraphy names, 囍 marriage tags, a paper
//        gutter with brush numerals and 干支 year names, seal-stamp "now" chip
import { sampleQuadratic } from '../webgl/RibbonLayer.js'
import { sampleCubicRange } from './timelineLinks'
import { DROP, MIST } from '../webgl/InkDropLayer.js'
import { THREAD, BRUSH } from '../webgl/InkThreadLayer.js'
import {
  inkPigment,
  hexToRgb01,
  isMajorYear,
  ganzhi,
  parallaxOffset,
  CINNABAR_RGB
} from '../webgl/inkMath'
import { INK, INK_FONTS, sealCanvas } from '../../lib/inkArt'
import { roundRect, trunc } from '../webgl/overlayUtils.js'
import { GUTTER, LANE_W, X0 } from './timelineLayout.js'
import { mountainStrip, brushRule, ensoRing, personSeal, sealTilt, inkSeed } from './inkBackdrop.js'
import { drawChronicleBg, drawChronicleFg } from './chronicleDraw.js'
import { lifeName, lifeYears } from './timelineText.js'
import { drawKinPills } from './kinPills.js'
import {
  buildRiverScreen,
  riverEndX,
  writeRiverBands,
  writeInkRiverThreads
} from './TimelineRivers.js'
import { billboard, rawContext } from './tiltCanvas'
import { arcHeight, frameRectToFlat } from './timelineTilt'

const SEG = 16
const INK_GREY = [0.36, 0.34, 0.31]
const MIST_GREY = [0.55, 0.53, 0.49]
const ADOPT_OCHRE = inkPigment([0.71, 0.53, 0.3], { sat: 0.8, ink: 0.15 })

/** Brush / seal size as lanes crowd together: full size from 40px lanes,
 *  down to 30% — a dense sheet reads as fine columns, not a wash of ink. */
export function laneLod(r) {
  return Math.min(1, Math.max(0.3, (LANE_W * r.camera2.ls) / 40))
}

/** Fade (0..1) of a person's seal/label while their stroke is being written. */
export function writeFade(r, id) {
  const w = r._inkWrite.get(id)
  if (!w) return 1
  return Math.min(1, Math.max(0, (r._timeSec - w.start + 0.05) / 0.4))
}

function pigmentOf(r, css) {
  let p = r._pigments.get(css)
  if (!p) r._pigments.set(css, (p = inkPigment(hexToRgb01(css), { sat: 0.55, ink: 0.58 })))
  return p
}

// ── GL buffers ─────────────────────────────────────────────────────────────────
export function writeInkBuffers(r) {
  const L = r.layout
  const scratch = r._curve
  const now = r._timeSec
  const tYear = r.hooks.getTimeYear ? r.hooks.getTimeYear() : null
  const n = L.people.length
  let dead = 0
  for (const p of L.people) if (p.dead && !(tYear != null && tYear < p.endYear)) dead++
  r.inkStrokes.setCount(n)
  r.inkDrops.setCount(n + dead)
  r.avatars.setCount(n)
  r._linkGeometry('curve', tYear)
  // tilted board: raised family lines + back-to-front pins (TimelineRenderer)
  r._computeLift(r.hooks.getStyle ? r.hooks.getStyle() : {})
  r._syncDepth()
  // Household rivers: the lives are polylines, brushed as threads below.
  const rv = r._rv
  if (rv) buildRiverScreen(r, tYear)

  let dropI = 0
  const lod = laneLod(r)
  for (let i = 0; i < n; i++) {
    const p = L.people[i]
    const v = r._pVis[i]
    const a = r._pAnim.get(p.id)
    const ent = r._entrance(a)
    const op = a.op * ent.e
    const x = r.sx(r._lane(p.id, p.laneX))
    const endYear = tYear == null ? p.endYear : Math.min(p.endYear, Math.max(tYear, p.birthYear))
    const y0 = r.sy(p.birthYear) + r._avDy[i] // Sprout: the seal sits where the life settles
    const y1 = Math.max(r.sy(endYear), y0 + 8)
    const pig = pigmentOf(r, v.color)
    const col = v.selected ? CINNABAR_RGB : pig
    const lifted = p.dead && !(tYear != null && tYear < p.endYear)
    const w = r._inkWrite.get(p.id)
    const ws = w ? w.start : 0
    const wd = w ? w.dur : 0
    const seed = inkSeed(p.id)
    // The stroke's ending tells the story: a life still going (at the year
    // shown) trails off in a dry, fading tail — the brush still moving on —
    // while a life that has ended stops with a firm, wet full stop.
    const living = !lifted
    r.inkStrokes.set(
      i,
      x,
      y0,
      x,
      y1,
      Math.max(2, a.w * 1.6 * lod),
      col,
      rv ? 0 : op * 0.94,
      seed,
      living ? 0.72 : 0.45,
      living ? 0 : 1,
      living ? 0.3 : 0,
      ws,
      wd
    )
    // the drop where the brush first touched the paper, blooming under the seal
    r.inkDrops.set(
      dropI++,
      x + 1.5,
      y0 + 2.5,
      15 * a.s * 1.65 * lod,
      col,
      op * 0.55,
      DROP,
      seed,
      ws - 0.08,
      wd ? 1.1 : 0
    )
    if (lifted) {
      r.inkDrops.set(
        dropI++,
        rv ? riverEndX(r, i) : x,
        y1 + 6,
        18,
        MIST_GREY,
        op * 0.3,
        MIST,
        seed,
        ws + wd * 0.85,
        wd ? 1.4 : 0
      )
    }
    // photo pins stay as framed roundels; everyone else is a seal on the fg canvas.
    // An aura still shows in ink (its line effect pauses, like the graph's under
    // the brush look): a seal-bearer gets a rim-only pin (avatar -2: the node
    // shader draws just the ornament) sized to the seal, so it rings the seal.
    const layer = v.imageUrl ? r.atlas.request(p.id, v.imageUrl) : -1
    const photo = layer >= 1
    const sealAura = !photo && v.aura?.id > 0
    r._pinAt(i, x, y0)
    r.avatars.setStyle(i, {
      radius: sealAura ? 15 * a.s * Math.max(lod, 0.3) * 1.04 : 15 * a.s * Math.max(lod, 0.45),
      fill: sealAura ? r._inkBorder : pig,
      border: v.selected && !sealAura ? CINNABAR_RGB : r._inkBorder,
      borderPx: v.selected && !sealAura ? 3 : 2,
      borderA: 1,
      opacity: photo || sealAura ? op * writeFade(r, p.id) : 0,
      selected: false,
      glow: 0,
      avatar: photo ? layer : sealAura ? -2 : 0, // -2 = rim-only (ornament, no body)
      ...r._auraStyle(v, a)
    })
  }

  // Size the thread / dot buffers before writing (growing them reallocates).
  r.inkThreads.setCount(
    L.marriages.length + L.families.length * 2 + L.branches.length + n + (r._rvInkExtra || 0)
  )
  r.connDots.setCount(L.marriages.length * 2 + L.branches.length + n)

  // Marriages: a red thread of fate hung between the two lifelines.
  let dotI = 0
  for (let j = 0; j < L.marriages.length; j++) {
    const m = L.marriages[j]
    const v = r._mVis[j]
    const a = r._mAnim.get(m.id)
    const [la, lb] = r._ropeLanes(m)
    const x1 = r.sx(Math.min(la, lb)),
      x2 = r.sx(Math.max(la, lb))
    const y = r.sy(m.year)
    const sag = rv ? 3 : Math.min(34, 12 + (x2 - x1) * 0.05)
    sampleQuadratic(scratch, SEG, x1, y, (x1 + x2) / 2, y + sag * 2, x2, y)
    r._liftRope(scratch, x1, x2)
    r.inkThreads.writeCurve(j, scratch)
    const w = r._inkWriteM.get(m.id)
    const color = m.estimated ? INK_GREY : CINNABAR_RGB
    const opac = a.op * (m.divorced ? 0.55 : 1)
    r.inkThreads.writeStyle(
      j,
      color,
      opac,
      a.w * (m.estimated ? 0.55 : 0.75),
      THREAD,
      r._reduced ? 0 : Math.min(3.2, 1.2 + (x2 - x1) * 0.008),
      inkSeed(m.id),
      w ? w.start : 0,
      w ? w.dur : 0
    )
    r.connDots.set(dotI++, x1, y, 2.6, color, v.dotOpacity * 0.9)
    r.connDots.set(dotI++, x2, y, 2.6, color, v.dotOpacity * 0.9)
  }

  // Family stems (a dry brush line dropped from the red thread), co-parent
  // bars, then each child's branch — a quick flick into its seal — and the
  // Sprout mode's lifelines peeling out of the stem in the child's pigment.
  const mCount = L.marriages.length
  const F = L.families.length
  const fg = r._fg
  const sp = r._sp
  const dots = []
  for (let f = 0; f < F; f++) {
    const fam = L.families[f]
    const a = r._fAnim.get(fam.id)
    const o = f * 8
    const on = !!fg[o + 7]
    const sx = fg[o]
    if (on) {
      sampleQuadratic(scratch, SEG, sx, fg[o + 1], sx, fg[o + 1], sx, fg[o + 2])
      r._liftStem(scratch, f)
    } else sampleQuadratic(scratch, SEG, 0, 0, 0, 0, 0, 0)
    const col = fam.adopted ? ADOPT_OCHRE : INK_GREY
    r.inkThreads.writeCurve(mCount + f * 2, scratch)
    r.inkThreads.writeStyle(
      mCount + f * 2,
      col,
      on ? a.op * 0.9 : 0,
      a.w * 1.1,
      BRUSH,
      0,
      inkSeed(fam.id),
      0,
      0
    )
    const bar = on && !Number.isNaN(fg[o + 4])
    if (bar) {
      sampleQuadratic(scratch, SEG, fg[o + 5], fg[o + 4], sx, fg[o + 4], fg[o + 6], fg[o + 4])
      r._liftBar(scratch, f)
    }
    r.inkThreads.writeCurve(mCount + f * 2 + 1, scratch)
    r.inkThreads.writeStyle(
      mCount + f * 2 + 1,
      col,
      bar ? a.op * 0.7 : 0,
      a.w * 0.8,
      THREAD,
      0,
      inkSeed(fam.id) + 1,
      0,
      0
    )
  }
  const bBase = mCount + F * 2
  for (let j = 0; j < L.branches.length; j++) {
    const b = L.branches[j]
    const v = r._bVis[j]
    const a = r._bAnim.get(b.id)
    const o = j * 8
    const drawn = !Number.isNaN(r._bc[o])
    if (drawn) {
      sampleCubicRange(scratch, SEG, r._bc.subarray(o, o + 8))
      r._liftBranch(scratch, j)
    } else sampleQuadratic(scratch, SEG, 0, 0, 0, 0, 0, 0)
    r.inkThreads.writeCurve(bBase + j, scratch)
    const w = r._inkWriteB.get(b.id)
    r.inkThreads.writeStyle(
      bBase + j,
      b.adopted ? ADOPT_OCHRE : INK_GREY,
      drawn ? a.op * 0.9 : 0,
      a.w * 1.25,
      b.adopted ? THREAD : BRUSH,
      0,
      inkSeed(b.id),
      w ? w.start : 0,
      w ? w.dur : 0
    )
    if (drawn && b.parents.length === 1)
      dots.push(r._bc[o], r._bc[o + 1], 2.4, INK_GREY, v.dotOpacity * 0.8)
  }
  const sBase = bBase + L.branches.length
  for (let i = 0; i < n; i++) {
    const o = i * 8
    const p = L.people[i]
    const a = r._pAnim.get(p.id)
    const on = !Number.isNaN(sp[o])
    if (on) {
      sampleCubicRange(scratch, SEG, sp.subarray(o, o + 8))
      r._liftSprout(scratch, i)
    } else sampleQuadratic(scratch, SEG, 0, 0, 0, 0, 0, 0)
    const pig = pigmentOf(r, r._pVis[i].color)
    const w = r._inkWrite.get(p.id)
    r.inkThreads.writeCurve(sBase + i, scratch)
    r.inkThreads.writeStyle(
      sBase + i,
      r._pVis[i].selected ? CINNABAR_RGB : pig,
      on ? a.op * 0.9 : 0,
      Math.max(2, a.w * 1.3 * lod),
      BRUSH,
      0,
      inkSeed(p.id),
      w ? w.start - 0.3 : 0,
      w ? 0.3 : 0
    )
    if (on) {
      const f = r._spFam[i]
      const q = f >= 0 ? r.lift(sp[o], sp[o + 1], r.stemLift(f)) : { x: sp[o], y: sp[o + 1] }
      dots.push(q.x, q.y, 2.6, pig, a.op * 0.8)
    }
  }
  if (rv) {
    // each life brushed along its river polyline, written in like the stroke
    writeInkRiverThreads(r, sBase, sBase + n, scratch, (i) => {
      const p = L.people[i]
      const a = r._pAnim.get(p.id)
      const v = r._pVis[i]
      const w = r._inkWrite.get(p.id)
      return {
        rgb: v.selected ? CINNABAR_RGB : pigmentOf(r, v.color),
        op: a.op * r._entrance(a).e * 0.94,
        width: Math.max(2, a.w * 1.6 * lod),
        seed: inkSeed(p.id),
        ws: w ? w.start : 0,
        wd: w ? w.dur : 0
      }
    })
  }
  writeRiverBands(r, tYear, [0, 0, 0])
  for (let k = 0; k < dots.length; k += 5)
    r.connDots.set(dotI++, dots[k], dots[k + 1], dots[k + 2], dots[k + 3], dots[k + 4])
  r.connDots.setCount(dotI)

  r.inkStrokes.commit()
  r.inkDrops.commit()
  r.inkThreads.commit()
  r.connDots.commit()
  r.avatars.commitPositions()
  r.avatars.commitStyles()
  return now < r._inkWriteUntil
}

// ── bg canvas: ruled sheet, year rules, mountains, inscription ────────────────
export function drawInkBg(r) {
  const ctx = r.bg
  const W = r.width,
    H = r.height
  ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)
  const { ls, tx } = r.camera2
  const L = r.layout
  // The mountains, their mist and the inscription are scenery on the screen,
  // not the sheet: drawn flat even when the sheet is tilted.
  const deco = rawContext(ctx)
  // Rules and washes reach the tilted horizon (= the viewport when flat).
  const fb = r.flatBounds()

  // Misty mountains along the foot of the sheet, two depths of parallax.
  const far = mountainStrip({
    w: 1500,
    h: 170,
    seed: 7,
    color: INK.indigo,
    alpha: 0.2,
    detail: false,
    n: 6
  })
  const near = mountainStrip({
    w: 1700,
    h: 130,
    seed: 19,
    color: INK.ink,
    alpha: 0.3,
    detail: true,
    n: 5
  })
  const drawStrip = (img, factor, bottom, alpha) => {
    const ox = parallaxOffset(tx, factor, img.width)
    deco.globalAlpha = alpha
    for (let x = ox; x < W; x += img.width) deco.drawImage(img, x, H - bottom - img.height)
  }
  drawStrip(far, 0.06, 36, 0.9)
  drawStrip(near, 0.16, 6, 0.85)
  deco.globalAlpha = 1
  // a bank of mist dissolving the mountains' feet
  const mist = deco.createLinearGradient(0, H - 90, 0, H)
  mist.addColorStop(0, 'rgba(239,231,212,0)')
  mist.addColorStop(1, 'rgba(239,231,212,0.85)')
  deco.fillStyle = mist
  deco.fillRect(0, H - 90, W, 90)

  drawInscription(r, deco, W, H)
  if (!L.people.length) return

  // 乌丝栏 — vermilion column rules between the lanes, a double frame at the edges.
  const laneW = LANE_W * ls
  const left = r.sx(X0 - LANE_W / 2)
  const right = r.sx(X0 + (L.people.length - 0.5) * LANE_W)
  if (laneW >= 26) {
    ctx.strokeStyle = INK.cinnabar
    ctx.lineWidth = 0.8
    ctx.globalAlpha = 0.14
    ctx.beginPath()
    const i0 = Math.max(1, Math.floor((GUTTER - left) / laneW))
    const i1 = Math.min(L.people.length - 1, Math.ceil((fb.x1 - left) / laneW))
    for (let i = i0; i <= i1; i++) {
      const x = Math.round(left + i * laneW) + 0.5
      ctx.moveTo(x, fb.y0)
      ctx.lineTo(x, fb.y1)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 0.3
  ctx.strokeStyle = INK.cinnabar
  for (const [x, d] of [
    [left, -3],
    [right, 3]
  ]) {
    if (x < GUTTER - 10 || x > fb.x1 + 10) continue
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(x, fb.y0)
    ctx.lineTo(x, fb.y1)
    ctx.stroke()
    ctx.lineWidth = 0.7
    ctx.beginPath()
    ctx.moveTo(x + d, fb.y0)
    ctx.lineTo(x + d, fb.y1)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // Year rules: hairlines, brushed and darker on the decades.
  const { ticks, steps } = r._tickInfo()
  const rule = brushRule({ seed: 5 })
  ctx.strokeStyle = INK.ink
  ctx.lineWidth = 0.6
  for (let t = 0; t < ticks.length; t++) {
    const yr = ticks[t]
    const y = r.sy(yr)
    if (isMajorYear(yr, steps[t])) {
      ctx.globalAlpha = 0.2
      ctx.drawImage(rule, GUTTER - 4, y - 4, fb.x1 - GUTTER + 8, 8)
    } else {
      ctx.globalAlpha = 0.08
      ctx.beginPath()
      ctx.moveTo(GUTTER, Math.round(y) + 0.5)
      ctx.lineTo(fb.x1, Math.round(y) + 0.5)
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1

  // "Now": a cinnabar brush line across the sheet.
  const nowY = r.sy(r.hooks.getRefYear())
  if (nowY >= fb.y0 - 30 && nowY <= fb.y1 + 30) {
    ctx.globalAlpha = 0.5
    ctx.drawImage(
      brushRule({ seed: 12, color: INK.cinnabar, dry: 0.4 }),
      GUTTER - 6,
      nowY - 5,
      fb.x1 - GUTTER + 12,
      10
    )
    ctx.globalAlpha = 1
  }

  // Time travel: the future hides in mist; the frontier is a fresh red stroke.
  const tYear = r.hooks.getTimeYear ? r.hooks.getTimeYear() : null
  if (tYear != null) {
    const cy = r.sy(tYear)
    if (cy < fb.y1) {
      const top = Math.max(fb.y0, cy)
      const g = ctx.createLinearGradient(0, top, 0, top + 60)
      g.addColorStop(0, 'rgba(239,231,212,0.25)')
      g.addColorStop(1, 'rgba(239,231,212,0.7)')
      ctx.fillStyle = g
      ctx.fillRect(fb.x0, top, fb.x1 - fb.x0, fb.y1 - top)
    }
    if (cy >= fb.y0 - 30 && cy <= fb.y1 + 30) {
      ctx.globalAlpha = 0.85
      ctx.drawImage(
        brushRule({ seed: 31, color: INK.cinnabar, dry: 0.3 }),
        fb.x0,
        cy - 6,
        fb.x1 - fb.x0,
        12
      )
      ctx.globalAlpha = 1
    }
  }
  // Era washes on the sheet (chronicleDraw.js).
  if (L.people.length) drawChronicleBg(r, ctx)
}

// 题款 — a vertical inscription with a seal, low on the right like a painter's signature.
function drawInscription(r, ctx, W, H) {
  if (W < 520 || H < 420) return
  const text = '家族年譜'
  const fs = 22
  const x = W - 34
  let y = H - 150 - text.length * (fs + 4)
  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.fillStyle = INK.ink
  ctx.font = `${fs}px ${INK_FONTS.xing}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (const ch of text) {
    ctx.fillText(ch, x, y)
    y += fs + 4
  }
  ctx.globalAlpha = 0.85
  if (r._fontsOk)
    ctx.drawImage(sealCanvas('年譜', { size: 56, mode: 'yin', seed: 23 }), x - 12, y + 4, 24, 24)
  ctx.restore()
}

// ── fg canvas: seals, names, red-thread tags, gutter ─────────────────────────
export function drawInkFg(r) {
  const ctx = r.fg,
    c = r._colors(),
    L = r.layout
  const { ls, px } = r.camera2
  const W = r.width,
    H = r.height
  ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)
  r._badgeRects = []
  if (!L.people.length) return
  const kai = INK_FONTS.kai
  const serif = INK_FONTS.serif
  // culling bounds + billboards when the sheet is tilted (identity when flat)
  const fb = r.flatBounds()
  const T = r.view

  // 囍 tags hung on the red thread.
  if (px >= 2.5) {
    for (let j = 0; j < L.marriages.length; j++) {
      const m = L.marriages[j]
      const v = r._mVis[j]
      const a = r._mAnim.get(m.id)
      const wf = r._inkWriteM.get(m.id)
      const written = wf
        ? Math.min(1, Math.max(0, (r._timeSec - wf.start - wf.dur * 0.6) / 0.4))
        : 1
      const alpha = v.badgeOpacity * Math.min(1, a.op / Math.max(v.lineOpacity, 0.001)) * written
      if (alpha <= 0.02) continue
      const [la, lb] = r._ropeLanes(m)
      const x1 = r.sx(Math.min(la, lb)),
        x2 = r.sx(Math.max(la, lb))
      const cx = (x1 + x2) / 2
      const sag = r._rv ? -16 : Math.min(34, 12 + (x2 - x1) * 0.05)
      const midY = r.sy(m.year) + sag
      if (cx + m.bw < fb.x0 - 20 || cx - m.bw > fb.x1 + 20) continue
      if (midY < fb.y0 - 30 || midY > fb.y1 + 30) continue
      const s = m.id === r.hoverBadgeId ? r._badgeHoverS : 1
      const label = m.estimated ? '囍 ?' : `${m.divorced ? '離' : '囍'} ${m.realYear ?? m.year}`
      ctx.font = `${12.5 * s}px ${kai}`
      const tw = ctx.measureText(label).width
      const bw = Math.max(tw + 16 * s, 34 * s),
        bh = 20 * s
      const bx = cx - bw / 2,
        by = midY - bh / 2 + 2 * s
      // tilted: the tag hangs from its thread's raised midpoint, upright
      const g = billboard(
        ctx,
        cx,
        midY,
        () => {
          ctx.globalAlpha = alpha
          if (m.estimated) {
            ctx.fillStyle = c.surface
            ctx.strokeStyle = INK.cinnabar
            ctx.lineWidth = 1
            ctx.setLineDash([2.5, 2.5])
            roundRect(ctx, bx, by, bw, bh, 2.5 * s)
            ctx.fill()
            ctx.stroke()
            ctx.setLineDash([])
            ctx.fillStyle = INK.cinnabar
          } else {
            ctx.fillStyle = m.divorced ? 'rgba(140,36,28,0.6)' : INK.cinnabar
            roundRect(ctx, bx, by, bw, bh, 2.5 * s)
            ctx.fill()
            ctx.strokeStyle = 'rgba(251,244,230,0.5)'
            ctx.lineWidth = 0.8
            roundRect(ctx, bx + 2.2 * s, by + 2.2 * s, bw - 4.4 * s, bh - 4.4 * s, 1.5 * s)
            ctx.stroke()
            ctx.fillStyle = '#fbf4e6'
          }
          // the cord the tag hangs from
          ctx.strokeStyle = INK.cinnabar
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(cx, midY - 6 * s)
          ctx.lineTo(cx, by)
          ctx.stroke()
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(label, cx, by + bh / 2 + 1)
          ctx.globalAlpha = 1
        },
        r._lk ? arcHeight(x2 - x1, r._lk) : 0
      )
      if (r.tilted && !g) continue
      const rect = frameRectToFlat({ x: cx - m.bw / 2, y: midY - 11, w: m.bw, h: 24 }, g, T)
      r._badgeRects.push({ ...rect, id: m.id, m })
    }
  }

  // Seals at each birth + calligraphy names.
  const sealLod = Math.max(laneLod(r), 0.3)
  const showLabels = 150 * ls >= 14
  const nameLen = ls < 0.45 ? 6 : ls < 0.7 ? 10 : 17
  const fontsOk = r._fontsOk
  for (let i = 0; i < L.people.length; i++) {
    const p = L.people[i]
    const x = r.sx(r._lane(p.id, p.laneX))
    if (x < fb.x0 - 160 || x > fb.x1 + 40) continue
    const y0 = r.sy(p.birthYear) + r._avDy[i]
    if (y0 < fb.y0 - 40 || y0 > fb.y1 + 40) continue
    const v = r._pVis[i]
    const a = r._pAnim.get(p.id)
    const ent = r._entrance(a)
    const alpha = a.op * ent.e * writeFade(r, p.id)
    if (alpha <= 0.02) continue
    // seal + name stand upright on a tilted sheet
    billboard(ctx, x, y0, () => {
      ctx.globalAlpha = alpha
      const rad = 15 * a.s * sealLod
      if (!v.imageUrl) {
        if (fontsOk) {
          const seal = personSeal(p.name)
          ctx.save()
          ctx.translate(x, y0)
          ctx.rotate(sealTilt(p.id))
          ctx.drawImage(seal, -rad * 1.12, -rad * 1.12, rad * 2.24, rad * 2.24)
          ctx.restore()
        } else {
          ctx.fillStyle = INK.cinnabar
          ctx.beginPath()
          ctx.arc(x, y0, rad, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      if (v.selected && fontsOk) {
        const e = ensoRing({ seed: 4, color: INK.cinnabar })
        const R = rad * 1.9
        ctx.drawImage(e, x - R, y0 - R, R * 2, R * 2)
      }
      if (showLabels) {
        ctx.strokeStyle = c.bg
        ctx.lineWidth = 3
        ctx.lineJoin = 'round'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
        ctx.font = `15px ${kai}`
        ctx.fillStyle = v.selected ? INK.cinnabar : INK.ink
        const name = trunc(lifeName(p), nameLen)
        ctx.strokeText(name, x + 22, y0 + 1)
        ctx.fillText(name, x + 22, y0 + 1)
        if (ls >= 0.55) {
          ctx.font = `italic 11px ${serif}`
          ctx.fillStyle = c.t2
          const years = lifeYears(p)
          ctx.strokeText(years, x + 22, y0 + 14)
          ctx.fillText(years, x + 22, y0 + 14)
        }
      }
      ctx.globalAlpha = 1
    })
  }

  // Paper gutter with a doubled vermilion rule, brush numerals and 干支 names.
  ctx.globalAlpha = 0.94
  ctx.fillStyle = c.surface
  ctx.fillRect(0, fb.y0, GUTTER, fb.y1 - fb.y0)
  ctx.globalAlpha = 0.55
  ctx.strokeStyle = INK.cinnabar
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(GUTTER - 0.5, fb.y0)
  ctx.lineTo(GUTTER - 0.5, fb.y1)
  ctx.stroke()
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.moveTo(GUTTER - 4, fb.y0)
  ctx.lineTo(GUTTER - 4, fb.y1)
  ctx.stroke()
  ctx.globalAlpha = 1
  const { ticks, steps } = r._tickInfo()
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let t = 0; t < ticks.length; t++) {
    const yr = ticks[t]
    const step = steps[t]
    const bandH = r.sy(yr + step) - r.sy(yr)
    const y = r.sy(yr)
    const major = isMajorYear(yr, step)
    ctx.font = `${major ? 15 : 12}px ${kai}`
    ctx.fillStyle = major ? INK.ink : c.t2
    ctx.fillText(String(yr), GUTTER - 11, y)
    if (bandH >= 34 && step <= 10) {
      ctx.font = `10px ${kai}`
      ctx.fillStyle = 'rgba(179,53,42,0.75)'
      ctx.fillText(ganzhi(yr), GUTTER - 11, y + 13)
    }
  }

  const sealChip = (y, label, fill) => {
    ctx.save()
    ctx.translate(GUTTER / 2 - 1, y)
    ctx.rotate(-0.03)
    ctx.fillStyle = fill
    ctx.fillRect(-(GUTTER - 16) / 2, -11, GUTTER - 16, 22)
    ctx.strokeStyle = 'rgba(251,244,230,0.55)'
    ctx.lineWidth = 0.8
    ctx.strokeRect(-(GUTTER - 16) / 2 + 2.5, -8.5, GUTTER - 21, 17)
    ctx.fillStyle = '#fbf4e6'
    ctx.font = `14px ${kai}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, 0, 1)
    ctx.restore()
  }
  const refYear = r.hooks.getRefYear()
  const nowY = r.sy(refYear)
  if (nowY >= fb.y0 - 30 && nowY <= fb.y1 + 30) sealChip(nowY, String(refYear), INK.cinnabar)
  const tYear = r.hooks.getTimeYear ? r.hooks.getTimeYear() : null
  if (tYear != null) {
    const cy = r.sy(tYear)
    if (cy >= fb.y0 - 30 && cy <= fb.y1 + 30) sealChip(cy, String(Math.floor(tYear)), INK.ink)
  }

  if (r.mouseY != null) {
    const my = r.mouseY
    const year = Math.round(r.yearAt(my))
    ctx.globalAlpha = 0.4
    ctx.fillStyle = INK.ink
    for (let x = GUTTER + 4; x < fb.x1; x += 7) ctx.fillRect(x, my - 0.5, 1.6, 1.2)
    ctx.globalAlpha = 1
    billboard(ctx, GUTTER / 2, my, () => {
      ctx.fillStyle = c.surface
      ctx.strokeStyle = INK.ink
      ctx.lineWidth = 1
      roundRect(ctx, 6, my - 11, GUTTER - 14, 22, 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = INK.ink
      ctx.font = `14px ${kai}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(year), 6 + (GUTTER - 14) / 2, my + 1)
    })
  }
  // Eras, events and their cast (chronicleDraw.js).
  drawChronicleFg(r, ctx, c)
  // Kinship lens pills (shared with the classic renderer).
  const ov = r.hooks.getOverlay ? r.hooks.getOverlay() : null
  if (ov?.kin) {
    ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0)
    drawKinPills(r, ctx, c, kai, ov.kin, r.hooks.getStyle ? r.hooks.getStyle() : {})
  }
}
