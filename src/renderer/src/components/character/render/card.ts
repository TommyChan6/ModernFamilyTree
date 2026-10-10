// Photo-mode trading card: the look framed like a game's character reveal —
// backdrop art window, gradient frame in the look's own colors, name plate,
// lifespan, style badge and a rarity row. Pure canvas painting; the
// PhotoStudio overlay adds the 3D tilt + holographic sheen in CSS on top.

import type { CharacterDoc } from '../../../../../shared/types'
import type { StylePack } from '../styleTypes'
import { resolveLayers, shadeColor } from '../characterModel'
import { drawLayers, fitRegion } from './SpriteCompositor2D'
import { paintBackdrop } from './backdrops'

export const CARD_W = 600
export const CARD_H = 840

export interface CardInfo {
  name: string
  subtitle: string
  lifespan: string
  styleLabel: string
  /** 1..5 */
  stars: number
  framing: 'portrait' | 'full'
  backdrop: string
  accent: string
  base: string
}

/** A five-pointed star path centred on (cx, cy) with outer radius r. */
function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.45 : r
    const x = cx + Math.cos(a) * rr
    const y = cy + Math.sin(a) * rr
    if (i) ctx.lineTo(x, y)
    else ctx.moveTo(x, y)
  }
  ctx.closePath()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  max: number,
  size: number,
  weight = 800
) {
  let s = size
  do {
    ctx.font = `${weight} ${s}px "Segoe UI", system-ui, sans-serif`
    s -= 2
  } while (ctx.measureText(text).width > max && s > 14)
}

/** Paint the card into `canvas` at `scale` × (600 × 840). */
export function paintCard(
  canvas: HTMLCanvasElement,
  doc: CharacterDoc,
  pack: StylePack,
  info: CardInfo,
  scale = 1
): void {
  canvas.width = CARD_W * scale
  canvas.height = CARD_H * scale
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  const c1 = doc.palette.outfitA || info.accent
  const c2 = doc.palette.accent || info.accent

  // Frame
  ctx.save()
  roundRect(ctx, 0, 0, CARD_W, CARD_H, 38)
  ctx.clip()
  const frame = ctx.createLinearGradient(0, 0, CARD_W, CARD_H)
  frame.addColorStop(0, shadeColor(c1, 0.15))
  frame.addColorStop(0.5, shadeColor(c1, -0.35))
  frame.addColorStop(1, shadeColor(c2, 0.05))
  ctx.fillStyle = frame
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  // Art window
  const ax = 28
  const ay = 28
  const aw = CARD_W - 56
  const ah = 572
  ctx.save()
  roundRect(ctx, ax, ay, aw, ah, 24)
  ctx.clip()
  ctx.translate(ax, ay)
  // paintBackdrop resets the transform, so paint into an offscreen tile
  const tile = document.createElement('canvas')
  tile.width = Math.round(aw * scale)
  tile.height = Math.round(ah * scale)
  const tctx = tile.getContext('2d') as CanvasRenderingContext2D
  paintBackdrop(tctx, info.backdrop, tile.width, tile.height, 2.5, {
    accent: info.accent,
    base: info.base,
    motion: true
  })
  const region =
    info.framing === 'full'
      ? { cx: pack.width / 2, cy: pack.height / 2, span: Math.max(pack.width, pack.height) * 1.02 }
      : { ...pack.portrait, cy: pack.portrait.cy + pack.portrait.span * 0.04 }
  // Fit into the (taller) window: span covers the width, anchor low
  const view = fitRegion(region, tile.width, tile.width, 0)
  view.ty += (tile.height - tile.width) * (info.framing === 'full' ? 0.5 : 1)
  // Ground shadow for full-body shots
  if (info.framing === 'full') {
    const g = pack.rig.ground
    tctx.save()
    tctx.setTransform(view.k, 0, 0, view.k, view.tx, view.ty)
    tctx.fillStyle = 'rgba(0,0,0,0.25)'
    tctx.beginPath()
    tctx.ellipse(g.x, g.y + 4, pack.width * 0.26, pack.width * 0.04, 0, 0, Math.PI * 2)
    tctx.fill()
    tctx.restore()
  }
  drawLayers(tctx, resolveLayers(doc, pack), view)
  ctx.setTransform(scale, 0, 0, scale, ax * scale, ay * scale)
  ctx.drawImage(tile, 0, 0, aw, ah)
  // Vignette
  const vg = ctx.createLinearGradient(0, ah * 0.6, 0, ah)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.35)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, aw, ah)
  ctx.restore()

  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  // Inner gilt line around the art
  roundRect(ctx, ax, ay, aw, ah, 24)
  ctx.strokeStyle = 'rgba(255,240,200,0.75)'
  ctx.lineWidth = 3
  ctx.stroke()

  // Style badge (top-left over the art)
  ctx.font = '700 20px "Segoe UI", system-ui, sans-serif'
  const bw = ctx.measureText(info.styleLabel).width + 28
  roundRect(ctx, ax + 16, ay + 16, bw, 36, 18)
  ctx.fillStyle = 'rgba(10,10,20,0.55)'
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.fillText(info.styleLabel, ax + 30, ay + 35)

  // Name plate
  const py = ay + ah + 20
  roundRect(ctx, ax, py, aw, CARD_H - py - 28, 22)
  ctx.fillStyle = 'rgba(8,8,18,0.55)'
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'alphabetic'
  fitText(ctx, info.name || '—', aw - 48, 44)
  ctx.fillText(info.name || '—', ax + 24, py + 58)
  ctx.font = '600 20px "Segoe UI", system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  const sub = [info.lifespan, info.subtitle].filter(Boolean).join('  ·  ')
  if (sub) ctx.fillText(sub, ax + 24, py + 94, aw - 48)
  // Rarity stars (drawn as paths — no font glyphs, so they look the same everywhere)
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < info.stars ? '#ffd76a' : 'rgba(255,255,255,0.2)'
    starPath(ctx, ax + 37 + i * 32, py + 140, 13)
    ctx.fill()
  }
  ctx.restore()

  // Outer rim
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  roundRect(ctx, 1.5, 1.5, CARD_W - 3, CARD_H - 3, 37)
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 3
  ctx.stroke()
}
