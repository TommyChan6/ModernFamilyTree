// Vector glyphs for the Map renderer: terrain marks scattered inside areas,
// place and event icons, and compass roses — each drawn in one of four
// symbol sets (drawn / ink / tech / flat) so a style can restyle them all.
// Every function draws around (x, y) at size s in the CURRENT transform.

import type { SymbolSet } from './mapStyles'

type Ctx = CanvasRenderingContext2D

// ── terrain marks ─────────────────────────────────────────────────────────────
export function drawTerrainMark(
  ctx: Ctx,
  kind: string,
  set: SymbolSet,
  x: number,
  y: number,
  s: number,
  r: number,
  mark: string,
  mark2: string,
  lw: number
) {
  ctx.lineWidth = lw
  ctx.strokeStyle = mark
  ctx.fillStyle = mark2
  switch (kind) {
    case 'forest':
      return tree(ctx, set, x, y, s, r, mark, mark2, lw)
    case 'mountains':
      return peak(ctx, set, x, y, s * 1.35, r, mark, mark2, lw)
    case 'hills':
      return hill(ctx, set, x, y, s, r, mark, mark2)
    case 'desert':
      return dune(ctx, set, x, y, s, r)
    case 'grass':
      return tuft(ctx, x, y, s * 0.6, r)
    case 'swamp':
      return reeds(ctx, x, y, s * 0.7, r)
    case 'snow':
      return flake(ctx, x, y, s * 0.35)
  }
}

function tree(
  ctx: Ctx,
  set: SymbolSet,
  x: number,
  y: number,
  s: number,
  r: number,
  mark: string,
  mark2: string,
  lw: number
) {
  if (set === 'ink') {
    // dry-brush dabs of ink
    ctx.fillStyle = mark
    for (let i = 0; i < 4; i++) {
      const a = r * 40 + i * 1.7
      ctx.globalAlpha *= 0.85
      ctx.beginPath()
      ctx.ellipse(
        x + Math.cos(a) * s * 0.18,
        y - s * 0.3 + Math.sin(a) * s * 0.14,
        s * 0.2,
        s * 0.14,
        a,
        0,
        Math.PI * 2
      )
      ctx.fill()
    }
    ctx.beginPath()
    ctx.moveTo(x, y - s * 0.2)
    ctx.lineTo(x, y + s * 0.1)
    ctx.stroke()
    return
  }
  if (set === 'tech') {
    ctx.beginPath()
    ctx.moveTo(x, y - s * 0.45)
    ctx.lineTo(x + s * 0.28, y + s * 0.05)
    ctx.lineTo(x - s * 0.28, y + s * 0.05)
    ctx.closePath()
    ctx.stroke()
    return
  }
  if (set === 'flat') {
    ctx.fillStyle = mark
    ctx.globalAlpha *= 0.55
    ctx.beginPath()
    ctx.arc(x, y - s * 0.2, s * 0.24, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  // drawn: alternate deciduous lollipops and conifers
  ctx.beginPath()
  ctx.moveTo(x, y + s * 0.12)
  ctx.lineTo(x, y - s * 0.12)
  ctx.lineWidth = lw * 1.2
  ctx.stroke()
  ctx.lineWidth = lw
  if (r < 0.45) {
    ctx.beginPath()
    ctx.moveTo(x, y - s * 0.62)
    ctx.lineTo(x + s * 0.26, y - s * 0.02)
    ctx.lineTo(x - s * 0.26, y - s * 0.02)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.arc(x, y - s * 0.32, s * 0.27, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    // shade the right side of the canopy
    ctx.beginPath()
    ctx.arc(x, y - s * 0.32, s * 0.27, -Math.PI * 0.35, Math.PI * 0.55)
    ctx.strokeStyle = mark
    ctx.lineWidth = lw * 1.6
    ctx.stroke()
    ctx.lineWidth = lw
  }
}

function peak(
  ctx: Ctx,
  set: SymbolSet,
  x: number,
  y: number,
  s: number,
  r: number,
  mark: string,
  mark2: string,
  lw: number
) {
  const h = s * (0.75 + r * 0.45)
  const w = s * (0.55 + r * 0.2)
  if (set === 'ink') {
    // 山水 wash: an ink peak fading into mist at its foot
    const g = ctx.createLinearGradient(x, y - h, x, y + s * 0.1)
    g.addColorStop(0, mark)
    g.addColorStop(0.55, mark2)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.globalAlpha *= 0.55
    ctx.beginPath()
    ctx.moveTo(x - w * 1.1, y + s * 0.1)
    ctx.quadraticCurveTo(x - w * 0.35, y - h * 0.55, x - w * 0.05, y - h)
    ctx.quadraticCurveTo(x + w * 0.2, y - h * 0.7, x + w * 0.3, y - h * 0.62)
    ctx.quadraticCurveTo(x + w * 0.7, y - h * 0.3, x + w * 1.1, y + s * 0.1)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha /= 0.55
    ctx.beginPath()
    ctx.moveTo(x - w * 0.9, y - h * 0.05)
    ctx.quadraticCurveTo(x - w * 0.35, y - h * 0.55, x - w * 0.05, y - h)
    ctx.quadraticCurveTo(x + w * 0.15, y - h * 0.72, x + w * 0.3, y - h * 0.62)
    ctx.lineWidth = lw * 1.4
    ctx.strokeStyle = mark
    ctx.stroke()
    return
  }
  if (set === 'tech') {
    ctx.beginPath()
    ctx.moveTo(x - w, y)
    ctx.lineTo(x, y - h)
    ctx.lineTo(x + w, y)
    ctx.moveTo(x - w * 0.5, y)
    ctx.lineTo(x, y - h * 0.5)
    ctx.lineTo(x + w * 0.5, y)
    ctx.stroke()
    return
  }
  ctx.beginPath()
  ctx.moveTo(x - w, y)
  ctx.lineTo(x - w * 0.1, y - h)
  ctx.lineTo(x + w * 0.15, y - h * 0.82)
  ctx.lineTo(x + w, y)
  ctx.closePath()
  if (set === 'flat') {
    ctx.fillStyle = mark
    ctx.globalAlpha *= 0.55
    ctx.fill()
    ctx.globalAlpha /= 0.55
    ctx.fillStyle = mark2
    ctx.beginPath()
    ctx.moveTo(x - w * 0.34, y - h * 0.62)
    ctx.lineTo(x - w * 0.1, y - h)
    ctx.lineTo(x + w * 0.15, y - h * 0.82)
    ctx.lineTo(x + w * 0.3, y - h * 0.6)
    ctx.closePath()
    ctx.fill()
    return
  }
  // drawn: pale face, hatched shadow side, ink outline, snowcap on tall peaks
  ctx.fillStyle = mark2
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const hx = x + w * 0.02 + i * w * 0.18
    ctx.moveTo(hx, y - h * 0.9 + i * h * 0.05)
    ctx.lineTo(hx - w * 0.35, y)
  }
  ctx.lineWidth = lw * 0.8
  ctx.stroke()
  ctx.restore()
  ctx.lineWidth = lw
  ctx.beginPath()
  ctx.moveTo(x - w, y)
  ctx.lineTo(x - w * 0.1, y - h)
  ctx.lineTo(x + w * 0.15, y - h * 0.82)
  ctx.lineTo(x + w, y)
  ctx.stroke()
  if (r > 0.6) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.beginPath()
    ctx.moveTo(x - w * 0.34, y - h * 0.66)
    ctx.lineTo(x - w * 0.1, y - h)
    ctx.lineTo(x + w * 0.15, y - h * 0.82)
    ctx.lineTo(x + w * 0.02, y - h * 0.7)
    ctx.lineTo(x - w * 0.12, y - h * 0.76)
    ctx.closePath()
    ctx.fill()
  }
}

function hill(
  ctx: Ctx,
  set: SymbolSet,
  x: number,
  y: number,
  s: number,
  r: number,
  mark: string,
  mark2: string
) {
  const w = s * (0.45 + r * 0.2)
  ctx.beginPath()
  ctx.moveTo(x - w, y)
  ctx.quadraticCurveTo(x, y - s * 0.7, x + w, y)
  if (set === 'drawn' || set === 'flat') {
    ctx.fillStyle = mark2
    ctx.fill()
  }
  ctx.stroke()
  if (set === 'drawn') {
    ctx.beginPath()
    ctx.moveTo(x + w * 0.2, y - s * 0.25)
    ctx.quadraticCurveTo(x + w * 0.55, y - s * 0.1, x + w * 0.65, y)
    ctx.strokeStyle = mark
    ctx.stroke()
  }
}

function dune(ctx: Ctx, set: SymbolSet, x: number, y: number, s: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x - s * 0.4, y)
  ctx.quadraticCurveTo(x - s * 0.05, y - s * 0.28, x + s * 0.4, y - s * 0.02)
  ctx.stroke()
  if (set !== 'tech') {
    ctx.fillStyle = ctx.strokeStyle
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(x - s * 0.3 + i * s * 0.26 + r * 4, y + s * 0.16, s * 0.03, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function tuft(ctx: Ctx, x: number, y: number, s: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x - s * 0.3, y - s * 0.35 - r * s * 0.1)
  ctx.lineTo(x - s * 0.1, y)
  ctx.moveTo(x, y - s * 0.5)
  ctx.lineTo(x, y)
  ctx.moveTo(x + s * 0.3, y - s * 0.35)
  ctx.lineTo(x + s * 0.1, y)
  ctx.stroke()
}

function reeds(ctx: Ctx, x: number, y: number, s: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x - s * 0.5, y)
  ctx.lineTo(x + s * 0.5, y)
  ctx.moveTo(x - s * 0.15, y)
  ctx.lineTo(x - s * 0.25, y - s * 0.55)
  ctx.moveTo(x + s * 0.05, y)
  ctx.lineTo(x + s * 0.05, y - s * (0.6 + r * 0.2))
  ctx.moveTo(x + s * 0.22, y)
  ctx.lineTo(x + s * 0.35, y - s * 0.45)
  ctx.stroke()
}

function flake(ctx: Ctx, x: number, y: number, s: number) {
  ctx.beginPath()
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI
    ctx.moveTo(x - Math.cos(a) * s, y - Math.sin(a) * s)
    ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s)
  }
  ctx.stroke()
}

// ── place glyphs ──────────────────────────────────────────────────────────────
export interface GlyphPaint {
  fill: string
  stroke: string
  lw: number
}

/** Draw a place icon centred on (x, y), s ≈ the icon's half-height in px. */
export function drawPlaceGlyph(
  ctx: Ctx,
  glyph: string,
  x: number,
  y: number,
  s: number,
  p: GlyphPaint
) {
  ctx.fillStyle = p.fill
  ctx.strokeStyle = p.stroke
  ctx.lineWidth = p.lw
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const fs = () => {
    ctx.fill()
    ctx.stroke()
  }
  switch (glyph) {
    case 'capital': {
      ctx.beginPath()
      ctx.arc(x, y, s, 0, Math.PI * 2)
      fs()
      star(ctx, x, y, s * 0.72, s * 0.3, 5)
      ctx.fillStyle = p.stroke
      ctx.fill()
      return
    }
    case 'city': {
      ctx.beginPath()
      ctx.rect(x - s * 0.95, y - s * 0.35, s * 0.6, s * 0.95)
      ctx.rect(x - s * 0.3, y - s * 0.95, s * 0.6, s * 1.55)
      ctx.rect(x + s * 0.35, y - s * 0.55, s * 0.6, s * 1.15)
      fs()
      return
    }
    case 'town': {
      ctx.beginPath()
      ctx.moveTo(x - s * 0.7, y + s * 0.6)
      ctx.lineTo(x - s * 0.7, y - s * 0.1)
      ctx.lineTo(x, y - s * 0.8)
      ctx.lineTo(x + s * 0.7, y - s * 0.1)
      ctx.lineTo(x + s * 0.7, y + s * 0.6)
      ctx.closePath()
      fs()
      return
    }
    case 'village': {
      ctx.beginPath()
      ctx.arc(x, y, s * 0.5, 0, Math.PI * 2)
      ctx.fillStyle = p.stroke
      ctx.fill()
      return
    }
    case 'castle': {
      const w = s * 0.8
      ctx.beginPath()
      ctx.moveTo(x - w, y + s * 0.8)
      ctx.lineTo(x - w, y - s * 0.8)
      for (let i = 0; i < 3; i++) {
        const bx = x - w + (i * 2 * w) / 2.5
        ctx.lineTo(bx + (w * 2) / 5, y - s * 0.8)
        ctx.lineTo(bx + (w * 2) / 5, y - s * 0.5)
        ctx.lineTo(bx + (w * 4) / 5, y - s * 0.5)
        ctx.lineTo(bx + (w * 4) / 5, y - s * 0.8)
      }
      ctx.lineTo(x + w, y - s * 0.8)
      ctx.lineTo(x + w, y + s * 0.8)
      ctx.closePath()
      fs()
      ctx.beginPath()
      ctx.moveTo(x - s * 0.25, y + s * 0.8)
      ctx.lineTo(x - s * 0.25, y + s * 0.2)
      ctx.arc(x, y + s * 0.2, s * 0.25, Math.PI, 0)
      ctx.lineTo(x + s * 0.25, y + s * 0.8)
      ctx.fillStyle = p.stroke
      ctx.fill()
      return
    }
    case 'port': {
      ctx.beginPath()
      ctx.arc(x, y, s, 0, Math.PI * 2)
      fs()
      ctx.beginPath()
      ctx.moveTo(x, y - s * 0.6)
      ctx.lineTo(x, y + s * 0.6)
      ctx.moveTo(x - s * 0.35, y - s * 0.3)
      ctx.lineTo(x + s * 0.35, y - s * 0.3)
      ctx.moveTo(x - s * 0.55, y + s * 0.15)
      ctx.quadraticCurveTo(x - s * 0.45, y + s * 0.62, x, y + s * 0.62)
      ctx.quadraticCurveTo(x + s * 0.45, y + s * 0.62, x + s * 0.55, y + s * 0.15)
      ctx.stroke()
      return
    }
    case 'temple': {
      ctx.beginPath()
      ctx.moveTo(x - s * 1.05, y - s * 0.3)
      ctx.quadraticCurveTo(x, y - s * 0.75, x, y - s * 1.05)
      ctx.quadraticCurveTo(x, y - s * 0.75, x + s * 1.05, y - s * 0.3)
      ctx.closePath()
      fs()
      ctx.beginPath()
      ctx.rect(x - s * 0.6, y - s * 0.3, s * 1.2, s * 1)
      fs()
      ctx.beginPath()
      ctx.moveTo(x - s * 0.25, y + s * 0.7)
      ctx.lineTo(x - s * 0.25, y)
      ctx.moveTo(x + s * 0.25, y + s * 0.7)
      ctx.lineTo(x + s * 0.25, y)
      ctx.stroke()
      return
    }
    case 'tower': {
      ctx.beginPath()
      ctx.moveTo(x - s * 0.35, y + s)
      ctx.lineTo(x - s * 0.28, y - s * 0.45)
      ctx.lineTo(x, y - s * 1.1)
      ctx.lineTo(x + s * 0.28, y - s * 0.45)
      ctx.lineTo(x + s * 0.35, y + s)
      ctx.closePath()
      fs()
      return
    }
    case 'ruin': {
      ctx.beginPath()
      ctx.rect(x - s * 0.9, y - s * 0.3, s * 0.4, s * 1.1)
      ctx.rect(x - s * 0.2, y - s * 0.9, s * 0.4, s * 1.7)
      ctx.rect(x + s * 0.5, y + s * 0.2, s * 0.4, s * 0.6)
      fs()
      ctx.beginPath()
      ctx.moveTo(x - s * 1.1, y + s * 0.8)
      ctx.lineTo(x + s * 1.1, y + s * 0.8)
      ctx.stroke()
      return
    }
    case 'cave': {
      ctx.beginPath()
      ctx.moveTo(x - s, y + s * 0.6)
      ctx.quadraticCurveTo(x - s * 0.8, y - s, x, y - s * 0.8)
      ctx.quadraticCurveTo(x + s * 0.8, y - s, x + s, y + s * 0.6)
      ctx.closePath()
      fs()
      ctx.beginPath()
      ctx.moveTo(x - s * 0.45, y + s * 0.6)
      ctx.quadraticCurveTo(x, y - s * 0.5, x + s * 0.45, y + s * 0.6)
      ctx.fillStyle = p.stroke
      ctx.fill()
      return
    }
    case 'camp': {
      ctx.beginPath()
      ctx.moveTo(x - s, y + s * 0.7)
      ctx.lineTo(x, y - s * 0.9)
      ctx.lineTo(x + s, y + s * 0.7)
      ctx.closePath()
      fs()
      ctx.beginPath()
      ctx.moveTo(x, y - s * 0.9)
      ctx.lineTo(x - s * 0.2, y + s * 0.7)
      ctx.lineTo(x + s * 0.3, y + s * 0.7)
      ctx.closePath()
      ctx.fillStyle = p.stroke
      ctx.fill()
      return
    }
    case 'mine': {
      ctx.beginPath()
      ctx.arc(x, y, s, 0, Math.PI * 2)
      fs()
      ctx.beginPath()
      ctx.moveTo(x - s * 0.5, y + s * 0.5)
      ctx.lineTo(x + s * 0.5, y - s * 0.5)
      ctx.moveTo(x + s * 0.5, y + s * 0.5)
      ctx.lineTo(x - s * 0.5, y - s * 0.5)
      ctx.moveTo(x + s * 0.15, y - s * 0.65)
      ctx.quadraticCurveTo(x + s * 0.55, y - s * 0.55, x + s * 0.65, y - s * 0.15)
      ctx.stroke()
      return
    }
    case 'station': {
      ctx.beginPath()
      ctx.roundRect(x - s * 0.9, y - s * 0.75, s * 1.8, s * 1.5, s * 0.4)
      fs()
      ctx.beginPath()
      ctx.moveTo(x - s * 0.5, y + s * 0.2)
      ctx.lineTo(x + s * 0.5, y + s * 0.2)
      ctx.moveTo(x - s * 0.5, y - s * 0.2)
      ctx.lineTo(x + s * 0.5, y - s * 0.2)
      ctx.stroke()
      return
    }
    case 'landmark':
    default: {
      ctx.beginPath()
      ctx.moveTo(x - s * 0.45, y + s)
      ctx.lineTo(x - s * 0.25, y - s * 0.7)
      ctx.lineTo(x, y - s * 1.05)
      ctx.lineTo(x + s * 0.25, y - s * 0.7)
      ctx.lineTo(x + s * 0.45, y + s)
      ctx.closePath()
      fs()
    }
  }
}

function star(ctx: Ctx, x: number, y: number, ro: number, ri: number, n: number) {
  ctx.beginPath()
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro
    const a = -Math.PI / 2 + (i * Math.PI) / n
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
  }
  ctx.closePath()
}

// ── event glyphs ──────────────────────────────────────────────────────────────
export function drawEventGlyph(
  ctx: Ctx,
  glyph: string,
  x: number,
  y: number,
  s: number,
  color: string,
  ink: string
) {
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.fillStyle = color
  ctx.strokeStyle = ink
  ctx.lineWidth = Math.max(1, s * 0.14)
  switch (glyph) {
    case 'battle': {
      // crossed swords
      ctx.strokeStyle = color
      ctx.lineWidth = s * 0.22
      ctx.beginPath()
      ctx.moveTo(x - s * 0.8, y + s * 0.8)
      ctx.lineTo(x + s * 0.8, y - s * 0.8)
      ctx.moveTo(x + s * 0.8, y + s * 0.8)
      ctx.lineTo(x - s * 0.8, y - s * 0.8)
      ctx.stroke()
      ctx.lineWidth = s * 0.18
      ctx.beginPath()
      ctx.moveTo(x - s * 0.75, y + s * 0.35)
      ctx.lineTo(x - s * 0.35, y + s * 0.75)
      ctx.moveTo(x + s * 0.75, y + s * 0.35)
      ctx.lineTo(x + s * 0.35, y + s * 0.75)
      ctx.stroke()
      return
    }
    case 'fire': {
      ctx.beginPath()
      ctx.moveTo(x, y - s)
      ctx.bezierCurveTo(x + s * 0.9, y - s * 0.2, x + s * 0.7, y + s * 0.9, x, y + s * 0.9)
      ctx.bezierCurveTo(x - s * 0.7, y + s * 0.9, x - s * 0.9, y, x - s * 0.3, y - s * 0.4)
      ctx.quadraticCurveTo(x - s * 0.1, y - s * 0.1, x, y - s)
      ctx.fill()
      ctx.stroke()
      return
    }
    case 'crown': {
      ctx.beginPath()
      ctx.moveTo(x - s * 0.9, y + s * 0.6)
      ctx.lineTo(x - s * 0.9, y - s * 0.5)
      ctx.lineTo(x - s * 0.45, y)
      ctx.lineTo(x, y - s * 0.8)
      ctx.lineTo(x + s * 0.45, y)
      ctx.lineTo(x + s * 0.9, y - s * 0.5)
      ctx.lineTo(x + s * 0.9, y + s * 0.6)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      return
    }
    case 'heart': {
      ctx.beginPath()
      ctx.moveTo(x, y + s * 0.85)
      ctx.bezierCurveTo(x - s * 1.2, y, x - s * 0.6, y - s * 1, x, y - s * 0.35)
      ctx.bezierCurveTo(x + s * 0.6, y - s * 1, x + s * 1.2, y, x, y + s * 0.85)
      ctx.fill()
      ctx.stroke()
      return
    }
    case 'skull': {
      ctx.beginPath()
      ctx.arc(x, y - s * 0.15, s * 0.75, Math.PI * 0.8, Math.PI * 2.2)
      ctx.lineTo(x + s * 0.4, y + s * 0.85)
      ctx.lineTo(x - s * 0.4, y + s * 0.85)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = ink
      ctx.beginPath()
      ctx.arc(x - s * 0.3, y - s * 0.1, s * 0.18, 0, Math.PI * 2)
      ctx.arc(x + s * 0.3, y - s * 0.1, s * 0.18, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    case 'flag': {
      ctx.beginPath()
      ctx.moveTo(x - s * 0.5, y + s)
      ctx.lineTo(x - s * 0.5, y - s)
      ctx.strokeStyle = ink
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x - s * 0.5, y - s)
      ctx.quadraticCurveTo(x, y - s * 1.2, x + s * 0.8, y - s * 0.75)
      ctx.lineTo(x + s * 0.8, y - s * 0.05)
      ctx.quadraticCurveTo(x, y - s * 0.4, x - s * 0.5, y - s * 0.2)
      ctx.closePath()
      ctx.fill()
      return
    }
    case 'star':
    default: {
      star(ctx, x, y, s, s * 0.3, 4)
      ctx.fill()
      ctx.stroke()
    }
  }
}

// ── compass rose ──────────────────────────────────────────────────────────────
export function drawCompass(
  ctx: Ctx,
  set: SymbolSet,
  x: number,
  y: number,
  r: number,
  ink: string,
  accent: string,
  font: string,
  t: number
) {
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.strokeStyle = ink
  ctx.fillStyle = ink
  ctx.lineWidth = Math.max(1, r * 0.03)
  if (set === 'tech') {
    ctx.shadowColor = accent
    ctx.shadowBlur = r * 0.2
    ctx.strokeStyle = accent
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(t * 0.2)
    ctx.setLineDash([r * 0.08, r * 0.12])
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2
      const l = i % 9 === 0 ? 0.22 : 0.1
      ctx.beginPath()
      ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
      ctx.lineTo(x + Math.cos(a) * r * (1 - l), y + Math.sin(a) * r * (1 - l))
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(x, y - r * 0.62)
    ctx.lineTo(x + r * 0.14, y)
    ctx.lineTo(x, y + r * 0.1)
    ctx.lineTo(x - r * 0.14, y)
    ctx.closePath()
    ctx.fillStyle = accent
    ctx.fill()
    ctx.font = `${Math.round(r * 0.28)}px ${font}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('N', x, y - r * 1.25)
    ctx.restore()
    return
  }
  if (set === 'ink') {
    ctx.globalAlpha *= 0.85
    ctx.beginPath()
    ctx.arc(x, y, r * 0.95, 0, Math.PI * 2)
    ctx.lineWidth = r * 0.05
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y, r * 0.8, 0, Math.PI * 2)
    ctx.lineWidth = r * 0.015
    ctx.stroke()
    ctx.font = `${Math.round(r * 0.34)}px ${font}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const dirs = ['北', '东', '南', '西']
    dirs.forEach((d, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 2
      ctx.fillStyle = i === 0 ? accent : ink
      ctx.fillText(d, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55)
    })
    ctx.beginPath()
    ctx.moveTo(x, y - r * 0.28)
    ctx.lineTo(x, y + r * 0.28)
    ctx.moveTo(x - r * 0.28, y)
    ctx.lineTo(x + r * 0.28, y)
    ctx.lineWidth = r * 0.03
    ctx.strokeStyle = ink
    ctx.stroke()
    ctx.restore()
    return
  }
  // drawn / flat: an 8-point rose
  const points = set === 'flat' ? 4 : 8
  for (let i = 0; i < points; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / points
    const major = i % 2 === 0 || points === 4
    const len = major ? r : r * 0.6
    const w = major ? r * 0.16 : r * 0.1
    const tx = x + Math.cos(a) * len
    const ty = y + Math.sin(a) * len
    const lx = x + Math.cos(a - Math.PI / 2) * w
    const ly = y + Math.sin(a - Math.PI / 2) * w
    const rx = x + Math.cos(a + Math.PI / 2) * w
    const ry = y + Math.sin(a + Math.PI / 2) * w
    ctx.beginPath()
    ctx.moveTo(lx, ly)
    ctx.lineTo(tx, ty)
    ctx.lineTo(x, y)
    ctx.closePath()
    ctx.fillStyle = i === 0 ? accent : ink
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(rx, ry)
    ctx.lineTo(tx, ty)
    ctx.lineTo(x, y)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fill()
    ctx.strokeStyle = ink
    ctx.stroke()
  }
  if (set === 'drawn') {
    ctx.beginPath()
    ctx.arc(x, y, r * 0.72, 0, Math.PI * 2)
    ctx.lineWidth = r * 0.02
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y, r * 0.66, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.font = `italic ${Math.round(r * 0.3)}px ${font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = ink
  ctx.fillText('N', x, y - r * 1.22)
  ctx.restore()
}
