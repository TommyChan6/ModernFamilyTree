// The "Anime" style pack — modern gacha-portrait cel shading. A slim ~5-head
// figure in a 320×560 character space: flat base colors with hard-edged cel
// shadows (every base shape is a `mask`, its shadows are `clip` layers of the
// same channel shaded darker), one key light from the top-left, thin colored
// line art, big glossy tracked eyes and pointed-lock hair with an angel ring.
//
// Most shading is generated: `rimShade(d)` is "the shape minus itself nudged
// toward the light", which clipped to the shape leaves a crisp crescent on
// the lower-right — the form shadow — for any outline, so parts only hand-
// place the extra cast shadows (under bangs, under the chin, under collars).

import type { StyleLayer, StylePack, StylePart } from '../styleTypes'
import { curve, flipX, moveD, poly, smooth, sym, transformD, type Pt } from './pathKit'

const INK = '#3a2432'
const CX = 160

// ── Geometry kit ──────────────────────────────────────────────────────────────
const f = (n: number): string => String(Math.round(n * 100) / 100)

/** Bézier ellipse (no arc commands, so the winding helpers can read it). */
function EL(cx: number, cy: number, rx: number, ry: number = rx): string {
  const k = 0.5523
  const a = rx * k
  const b = ry * k
  return (
    `M ${f(cx + rx)} ${f(cy)} C ${f(cx + rx)} ${f(cy + b)} ${f(cx + a)} ${f(cy + ry)} ${f(cx)} ${f(cy + ry)} ` +
    `C ${f(cx - a)} ${f(cy + ry)} ${f(cx - rx)} ${f(cy + b)} ${f(cx - rx)} ${f(cy)} ` +
    `C ${f(cx - rx)} ${f(cy - b)} ${f(cx - a)} ${f(cy - ry)} ${f(cx)} ${f(cy - ry)} ` +
    `C ${f(cx + a)} ${f(cy - ry)} ${f(cx + rx)} ${f(cy - b)} ${f(cx + rx)} ${f(cy)} Z`
  )
}

/** Signed area of a path's point cloud (M/L/C/Q only) — its winding sign. */
function windOf(d: string): number {
  const nums = (d.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || []).map(Number)
  let a = 0
  const n = Math.floor(nums.length / 2)
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    a += nums[i * 2] * nums[j * 2 + 1] - nums[j * 2] * nums[i * 2 + 1]
  }
  return a
}

const BIG_A = 'M -600 -600 L 920 -600 L 920 1200 L -600 1200 Z'
const BIG_B = 'M -600 -600 L -600 1200 L 920 1200 L 920 -600 Z'

/** Everything outside `d` (a huge rect with `d` punched out, nonzero rule). */
function outside(d: string): string {
  return (Math.sign(windOf(d)) === Math.sign(windOf(BIG_A)) ? BIG_B : BIG_A) + ' ' + d
}

/** Clipped to `d`: the crescent of `d` NOT covered by `d` moved toward the
 *  light by (dx, dy) — the lower-right form shadow for positive offsets, a
 *  top-left rim light for negative ones. */
const rimShade = (d: string, dx = 4, dy = 3): string => outside(moveD(d, -dx, -dy))

const dir = (a: Pt, b: Pt): Pt => {
  const x = b[0] - a[0]
  const y = b[1] - a[1]
  const l = Math.hypot(x, y) || 1
  return [x / l, y / l]
}

function sides(pts: Pt[], w: number[] | number): { L: Pt[]; R: Pt[] } {
  const n = pts.length
  const W = (i: number) => (Array.isArray(w) ? (w[i] ?? w[w.length - 1]) : w)
  const L: Pt[] = []
  const R: Pt[] = []
  for (let i = 0; i < n; i++) {
    const t = dir(pts[Math.max(0, i - 1)], pts[Math.min(n - 1, i + 1)])
    const h = W(i) / 2
    L.push([pts[i][0] - t[1] * h, pts[i][1] + t[0] * h])
    R.push([pts[i][0] + t[1] * h, pts[i][1] - t[0] * h])
  }
  return { L, R }
}

/** A tapered ribbon along a centerline with SHARP ends (width 0 = a point):
 *  hair locks, lashes, brows, scarf tails. */
function blade(pts: Pt[], w: number[] | number): string {
  const { L, R } = sides(pts, w)
  return curve(L) + ' ' + curve(R.reverse()).replace(/^M/, 'L') + ' Z'
}

/** A limb with ROUND caps (arms, legs, sleeves). */
function limb(pts: Pt[], w: number[] | number): string {
  const n = pts.length
  const W = (i: number) => (Array.isArray(w) ? (w[i] ?? w[w.length - 1]) : w)
  const { L, R } = sides(pts, w)
  const te = dir(pts[n - 2], pts[n - 1])
  const ts = dir(pts[1], pts[0])
  const capE: Pt = [
    pts[n - 1][0] + te[0] * W(n - 1) * 0.42,
    pts[n - 1][1] + te[1] * W(n - 1) * 0.42
  ]
  const capS: Pt = [pts[0][0] + ts[0] * W(0) * 0.42, pts[0][1] + ts[1] * W(0) * 0.42]
  return smooth([...L, capE, ...R.reverse(), capS])
}

/** Edge point for `hairD`: x, y and the Q control's offset from the chord
 *  midpoint (bx, by) for the segment arriving here. */
type EP = [number, number, number?, number?]

/** A hair mass: a smooth outer silhouette (left → over the top → right),
 *  then a lock edge back (right → left) of quadratic swoops, so tips can be
 *  sharp corners. */
function hairD(outer: Pt[], edge: EP[]): string {
  let d = curve(outer)
  let [px, py] = outer[outer.length - 1]
  for (const [x, y, bx = 0, by = 0] of edge) {
    d += ` Q ${f((px + x) / 2 + bx)} ${f((py + y) / 2 + by)} ${f(x)} ${f(y)}`
    px = x
    py = y
  }
  return d + ' Z'
}

/** Mirror EPs (a right-side edge → the left, reversed order handled by caller). */
const mx = (x: number): number => 2 * CX - x

// ── Cel painter ───────────────────────────────────────────────────────────────
interface Cel {
  /** Base shade of the channel. */
  shade?: number
  /** Shadow depth relative to the base (default −0.2). */
  sh?: number
  /** Form-shadow offset toward the light; null = no auto crescent. */
  rim?: [number, number] | null
  /** Extra hand-placed shadow shapes (clipped). */
  shadows?: string[]
  /** Deeper core shadows (clipped, 2× depth). */
  deep?: string[]
  /** Highlight shapes (clipped). */
  lights?: string[]
  /** Extra clipped layers (patterns) drawn over the shading. */
  overlay?: StyleLayer[]
  /** Top-left rim light width (0 = none). */
  glint?: number
  /** Outline width (0 = none) and shade. */
  line?: number
  lineShade?: number
  /** Inner detail strokes drawn after the outline (fold lines, seams). */
  details?: string[]
  detailW?: number
  sway?: number
  alpha?: number
}

function cel(d: string, paint: string, o: Cel = {}): StyleLayer[] {
  const base = o.shade ?? 0
  const sh = o.sh ?? -0.2
  const sw: Partial<StyleLayer> = o.sway ? { sway: o.sway } : {}
  const out: StyleLayer[] = [{ d, fill: paint, shade: base, mask: true, ...sw }]
  if (o.alpha !== undefined) out[0].alpha = o.alpha
  const rim = o.rim === undefined ? [4, 3] : o.rim
  if (rim)
    out.push({ d: rimShade(d, rim[0], rim[1]), fill: paint, shade: base + sh, clip: true, ...sw })
  if (o.shadows?.length)
    out.push({ d: o.shadows.join(' '), fill: paint, shade: base + sh, clip: true, ...sw })
  if (o.deep?.length)
    out.push({ d: o.deep.join(' '), fill: paint, shade: base + sh * 2, clip: true, ...sw })
  if (o.lights?.length)
    out.push({
      d: o.lights.join(' '),
      fill: paint,
      shade: base + 0.3,
      clip: true,
      alpha: 0.9,
      ...sw
    })
  if (o.glint)
    out.push({
      d: rimShade(d, -o.glint, -o.glint),
      fill: paint,
      shade: base + 0.32,
      clip: true,
      alpha: 0.75,
      ...sw
    })
  if (o.overlay) out.push(...o.overlay.map((l) => ({ ...l, clip: true, ...sw })))
  if (o.line !== 0)
    out.push({ d, stroke: paint, shade: o.lineShade ?? -0.58, lineWidth: o.line ?? 1.7, ...sw })
  if (o.details?.length)
    out.push({
      d: o.details.join(' '),
      stroke: paint,
      shade: (o.lineShade ?? -0.58) + 0.1,
      lineWidth: o.detailW ?? 1,
      ...sw
    })
  return out
}

/** A single stroke layer. */
const ln = (d: string, paint: string, w: number, shade = 0, alpha?: number): StyleLayer => {
  const l: StyleLayer = { d, stroke: paint, lineWidth: w, shade }
  if (alpha !== undefined) l.alpha = alpha
  return l
}

/** A single fill layer. */
const fl = (d: string, paint: string, shade = 0, alpha?: number): StyleLayer => {
  const l: StyleLayer = { d, fill: paint, shade }
  if (alpha !== undefined) l.alpha = alpha
  return l
}

/** Mirror a right-side list of parts across the axis (keeps paint). */
/** Reverse the drawing direction of a path (absolute M/L/C/Q/Z, as
 *  transformD emits) — a mirrored copy reversed keeps the original winding,
 *  so left + right can share one layer and still punch clean `outside()`
 *  holes under the nonzero rule. */
function reverseD(d: string): string {
  const tok = transformD(d, 1, 1, 0, 0).split(' ')
  type Seg = { c: string; v: number[]; from: [number, number] }
  const subs: { start: [number, number]; segs: Seg[]; closed: boolean }[] = []
  let cur: [number, number] = [0, 0]
  let i = 0
  while (i < tok.length) {
    const c = tok[i++]
    const n = c === 'C' ? 6 : c === 'Q' ? 4 : c === 'M' || c === 'L' ? 2 : 0
    const v = tok.slice(i, i + n).map(Number)
    i += n
    if (c === 'M') {
      cur = [v[0], v[1]]
      subs.push({ start: cur, segs: [], closed: false })
    } else if (c === 'Z') {
      const sp = subs[subs.length - 1]
      sp.closed = true
      cur = sp.start
    } else if (n) {
      subs[subs.length - 1].segs.push({ c, v, from: cur })
      cur = [v[n - 2], v[n - 1]]
    }
  }
  return subs
    .map((sp) => {
      const last = sp.segs.length ? sp.segs[sp.segs.length - 1] : null
      const end = last ? [last.v[last.v.length - 2], last.v[last.v.length - 1]] : sp.start
      let out = `M ${f(end[0])} ${f(end[1])}`
      for (let k = sp.segs.length - 1; k >= 0; k--) {
        const g = sp.segs[k]
        const [fx, fy] = g.from
        if (g.c === 'L') out += ` L ${f(fx)} ${f(fy)}`
        else if (g.c === 'Q') out += ` Q ${f(g.v[0])} ${f(g.v[1])} ${f(fx)} ${f(fy)}`
        else out += ` C ${f(g.v[2])} ${f(g.v[3])} ${f(g.v[0])} ${f(g.v[1])} ${f(fx)} ${f(fy)}`
      }
      return sp.closed ? out + ' Z' : out
    })
    .join(' ')
}

const mirrorD = (d: string): string => reverseD(flipX(d, CX))

/** Mirror a right-side layer list to the left and MERGE each pair into one
 *  layer (union path) — half the layers. Radial gradients are positional, so
 *  those stay as two layers. */
function pair(right: StyleLayer[]): StyleLayer[] {
  const out: StyleLayer[] = []
  for (const l of right) {
    if (l.grad && l.grad.type === 'radial') {
      const g = l.grad
      out.push({
        ...l,
        d: mirrorD(l.d),
        grad: { ...g, cx: 2 * CX - g.cx, fx: g.fx === undefined ? undefined : 2 * CX - g.fx }
      })
      out.push(l)
    } else if (
      l.grad &&
      l.grad.type === 'linear' &&
      (l.grad.x1 !== CX || l.grad.x2 !== CX) &&
      l.grad.x1 !== l.grad.x2
    ) {
      out.push({
        ...l,
        d: mirrorD(l.d),
        grad: { ...l.grad, x1: 2 * CX - l.grad.x1, x2: 2 * CX - l.grad.x2 }
      })
      out.push(l)
    } else {
      // an outside() hole path: keep ONE big rect, punch both shapes
      const rect = l.d.startsWith(BIG_A) ? BIG_A : l.d.startsWith(BIG_B) ? BIG_B : null
      if (rect) {
        const shape = l.d.slice(rect.length + 1)
        out.push({ ...l, d: rect + ' ' + mirrorD(shape) + ' ' + shape })
      } else out.push({ ...l, d: mirrorD(l.d) + ' ' + l.d })
    }
  }
  return out
}

// ═════════════════════════════════════════════════════════════════════════════
// HEAD — face + ears + neck. Eye line y 140, chin ≈ 177, crown ≈ 85.
// ═════════════════════════════════════════════════════════════════════════════
const EYE_Y = 140
const SKIN_LINE = -0.6

const NECK = 'M 150 158 L 170 158 L 170.5 188 Q 172 197 184 203 L 136 203 Q 148 197 149.5 188 Z'
const NECK_SHADOW = 'M 136 150 L 184 150 L 184 168 Q 172 180 160 185 Q 148 180 136 168 Z'

function earR(long = false): StyleLayer[] {
  const d = long
    ? smooth([
        [198, 131],
        [206, 127],
        [218, 116],
        [213, 131],
        [206, 145],
        [200.5, 152],
        [197.5, 150]
      ])
    : smooth([
        [198.5, 131],
        [204, 128.5],
        [207, 134],
        [205.8, 144],
        [201, 151.5],
        [197.8, 150]
      ])
  const inner = long
    ? curve([
        [211, 124],
        [205, 135],
        [201.5, 146]
      ])
    : curve([
        [203.5, 134],
        [204.2, 140],
        [201.5, 146]
      ])
  return [
    ...cel(d, 'skin', { rim: [2, 1.5], line: 1.5, lineShade: SKIN_LINE }),
    ln(inner, 'skin', 1, -0.38)
  ]
}

function head(id: string, half: Pt[], o: { ears?: 'long'; jaw?: string } = {}): StylePart {
  const face = sym(half)
  return {
    id,
    slot: 'head',
    // the neck sits in the head's back band (under the torso's collar)
    back: cel(NECK, 'skin', {
      shade: -0.04,
      rim: [3, 0],
      shadows: [NECK_SHADOW],
      line: 1.3,
      lineShade: SKIN_LINE
    }),
    layers: [
      ...pair(earR(o.ears === 'long')),
      ...cel(face, 'skin', {
        rim: [4.2, 2.2],
        sh: -0.16,
        line: 1.35,
        lineShade: SKIN_LINE,
        lights: []
      }),
      // warm cheek flush, a hair of it on every face
      {
        d: EL(140, 153, 13, 8),
        grad: {
          type: 'radial',
          cx: 140,
          cy: 153,
          r: 13,
          stops: [
            [0, '#ff7f8e', 0, 0.2],
            [1, '#ff7f8e', 0, 0]
          ]
        }
      },
      {
        d: EL(180, 153, 13, 8),
        grad: {
          type: 'radial',
          cx: 180,
          cy: 153,
          r: 13,
          stops: [
            [0, '#ff7f8e', 0, 0.2],
            [1, '#ff7f8e', 0, 0]
          ]
        }
      },
      ...(o.jaw ? [ln(o.jaw, 'skin', 1, -0.35, 0.6)] : [])
    ]
  }
}

const HEADS: StylePart[] = [
  head('head-round', [
    [160, 85],
    [182, 89],
    [196, 101],
    [201, 118],
    [200.5, 136],
    [197, 150],
    [190, 162],
    [179, 171.5],
    [167, 176.5],
    [160, 177.5]
  ]),
  head('head-slim', [
    [160, 85],
    [180.5, 89],
    [194, 101],
    [198.5, 118],
    [197.5, 136],
    [194, 150],
    [187, 162],
    [176, 172.5],
    [166, 179],
    [160, 180.5]
  ]),
  head('head-soft', [
    [160, 85],
    [183, 89],
    [197.5, 101],
    [202, 118],
    [202, 137],
    [199, 152],
    [191, 164],
    [178, 172.5],
    [166, 176],
    [160, 176.5]
  ]),
  head(
    'head-square',
    [
      [160, 85],
      [182, 89],
      [196.5, 101],
      [201, 118],
      [201, 136],
      [199.5, 150],
      [195.5, 162],
      [185, 172],
      [171, 177.5],
      [160, 178.5]
    ],
    {
      jaw: curve([
        [192, 163],
        [186, 170]
      ])
    }
  ),
  head('head-heart', [
    [160, 85],
    [183, 88.5],
    [198, 100],
    [202.5, 117],
    [201, 135],
    [196, 149],
    [187, 161],
    [175, 172],
    [165, 178.5],
    [160, 180]
  ]),
  head(
    'head-elf',
    [
      [160, 85],
      [181.5, 89],
      [195.5, 101],
      [200, 118],
      [199.5, 136],
      [195.5, 150],
      [188.5, 162],
      [177.5, 172],
      [166.5, 177.5],
      [160, 178.5]
    ],
    { ears: 'long' }
  )
]

// ═════════════════════════════════════════════════════════════════════════════
// EYES — right eye authored in local coords (u → outer corner, v ↓) about
// (178, 140), mirrored to the left. White = mask; iris/pupil/shine clip +
// track inside it; lashes on top.
// ═════════════════════════════════════════════════════════════════════════════
interface EyeSpec {
  /** Upper lid line, inner corner → outer corner (local coords). */
  top: Pt[]
  /** Lower lid, outer → inner (between the corners). */
  bot: Pt[]
  /** Tilt in degrees (+ = outer corner up). */
  tilt?: number
  iris?: { rx: number; ry: number; dy?: number }
  pupil?: { rx: number; ry: number } | null
  /** Lash thickness at its thickest and the flick tip (local). */
  lash?: number
  flick?: Pt
  /** Extra little lash strokes at the outer corner. */
  strands?: number
  lower?: boolean
  crease?: boolean
  shine?: 'normal' | 'star' | 'small'
  /** Draw a heavy lid band (sleepy). */
  heavy?: boolean
}

const ECX = 178

function eyeR(s: EyeSpec): StyleLayer[] {
  const a = (-(s.tilt ?? 0) * Math.PI) / 180
  const T = (p: Pt): Pt => [
    ECX + p[0] * Math.cos(a) - p[1] * Math.sin(a),
    EYE_Y + p[0] * Math.sin(a) + p[1] * Math.cos(a)
  ]
  const top = s.top.map(T)
  const bot = s.bot.map(T)
  const white = smooth([...top, ...bot])
  const ir = s.iris ?? { rx: 7.6, ry: 9.6, dy: 1 }
  const [icx, icy] = T([0.6, ir.dy ?? 1])
  const tk = 3
  const L: StyleLayer[] = [{ d: white, fill: '#fdfbff', mask: true }]
  // iris: dark under the lid → bright at the bottom
  L.push({
    d: EL(icx, icy, ir.rx, ir.ry),
    grad: {
      type: 'linear',
      x1: 0,
      y1: icy - ir.ry,
      x2: 0,
      y2: icy + ir.ry,
      stops: [
        [0, 'eyes', -0.62],
        [0.42, 'eyes', -0.12],
        [0.78, 'eyes', 0.18],
        [1, 'eyes', 0.42]
      ]
    },
    clip: true,
    track: tk
  })
  L.push({
    d: EL(icx, icy, ir.rx, ir.ry),
    stroke: 'eyes',
    shade: -0.66,
    lineWidth: 1,
    clip: true,
    track: tk
  })
  if (s.pupil !== null) {
    const p = s.pupil ?? { rx: 3.4, ry: 5 }
    L.push({ d: EL(icx, icy - 0.5, p.rx, p.ry), fill: 'eyes', shade: -0.74, clip: true, track: tk })
  }
  // lower glow crescent
  L.push({
    d: EL(icx, icy + ir.ry * 0.52, ir.rx * 0.72, ir.ry * 0.36),
    grad: {
      type: 'radial',
      cx: icx,
      cy: icy + ir.ry * 0.6,
      r: ir.rx * 0.8,
      stops: [
        [0, 'eyes', 0.6, 0.85],
        [1, 'eyes', 0.4, 0]
      ]
    },
    clip: true,
    track: tk
  })
  // lid shadow band across white + iris
  const lid = top.map(([x, y]): Pt => [x, y + 3.6])
  L.push({
    d:
      curve(lid) +
      ` L ${f(lid[lid.length - 1][0] + 4)} ${f(EYE_Y - 30)} L ${f(lid[0][0] - 4)} ${f(EYE_Y - 30)} Z`,
    fill: 'eyes',
    shade: -0.55,
    alpha: 0.42,
    clip: true
  })
  // catchlights
  const shine = s.shine ?? 'normal'
  const [hx, hy] = [icx + ir.rx * 0.38, icy - ir.ry * 0.5]
  if (shine === 'star') {
    const r = 3.6
    L.push({
      d: poly([
        [hx, hy - r * 1.3],
        [hx + r * 0.3, hy - r * 0.3],
        [hx + r * 1.1, hy],
        [hx + r * 0.3, hy + r * 0.3],
        [hx, hy + r * 1.3],
        [hx - r * 0.3, hy + r * 0.3],
        [hx - r * 1.1, hy],
        [hx - r * 0.3, hy - r * 0.3]
      ]),
      fill: '#ffffff',
      clip: true,
      track: 2.4
    })
    L.push({
      d: EL(icx - ir.rx * 0.45, icy + ir.ry * 0.45, 1.6),
      fill: '#ffffff',
      clip: true,
      track: 2.4
    })
    L.push({
      d: EL(icx + ir.rx * 0.5, icy + ir.ry * 0.3, 0.9),
      fill: '#ffffff',
      clip: true,
      track: 2.4
    })
  } else {
    const big = shine === 'small' ? 1.6 : 2.7
    L.push({ d: EL(hx, hy, big, big * 1.2), fill: '#ffffff', clip: true, track: 2.4 })
    L.push({
      d: EL(icx - ir.rx * 0.42, icy + ir.ry * 0.48, big * 0.48),
      fill: '#ffffff',
      alpha: 0.92,
      clip: true,
      track: 2.4
    })
  }
  // upper lash: thin at the inner corner, heavy toward the outer, then a flick
  const n = top.length
  const lw = s.lash ?? 2.8
  const up = s.top.map(([u, v], i): Pt => {
    const t = i / (n - 1)
    return [u, v - lw * (0.3 + 0.9 * Math.min(1, t * 1.25))]
  })
  const fk = s.flick ?? [15.5, -4]
  const last = s.top[n - 1]
  const lash =
    curve([...up, fk].map(T)) +
    ' ' +
    curve([[last[0] + 1.2, last[1] + 0.8] as Pt, ...s.top.slice().reverse()].map(T)).replace(
      /^M/,
      'L'
    ) +
    ' Z'
  L.push({ d: lash, fill: 'ink' })
  for (let i = 0; i < (s.strands ?? 1); i++) {
    const b = s.top[n - 2 - i] ?? last
    const base = T([b[0], b[1] - lw * 0.9])
    const tip = T([b[0] + 3.5 + i, b[1] - lw - 3.2 + i])
    L.push({ d: blade([base, T([b[0] + 2, b[1] - lw - 1.6]), tip], [1.4, 1, 0]), fill: 'ink' })
  }
  if (s.lower !== false && bot.length >= 3) {
    L.push(ln(curve(bot.slice(0, Math.max(2, bot.length - 1))), 'ink', 0.9, 0.1, 0.85))
    // soft lower-lid warmth
  }
  if (s.crease !== false) {
    const cr = s.top
      .slice(2, n - 1)
      .map(([u, v]): Pt => [u + 1, v - lw - 1.6])
      .map(T)
    L.push(ln(curve(cr), 'skin', 0.8, -0.5, 0.55))
  }
  if (s.heavy) {
    const band = s.top.map(([u, v]): Pt => [u, v - 1.2]).map(T)
    L.push(ln(curve(band), 'skin', 1.1, -0.45, 0.8))
  }
  return L
}

const eyePart = (id: string, s: EyeSpec): StylePart => ({ id, slot: 'eyes', layers: pair(eyeR(s)) })

// arcs / closed shapes (no whites)
function arcEyes(id: string, pts: Pt[], w: number, flick: boolean): StylePart {
  const T = (p: Pt): Pt => [ECX + p[0], EYE_Y + p[1]]
  const main = blade(pts.map(T), [w * 0.5, w, w, w * 0.6, 0])
  const L: StyleLayer[] = [{ d: main, fill: 'ink' }]
  if (flick) {
    const e = pts[pts.length - 1]
    L.push({
      d: blade(
        [T([e[0] - 3, e[1] - 0.4]), T([e[0] + 1, e[1] - 2.2]), T([e[0] + 3.5, e[1] - 5])],
        [1.6, 1.1, 0]
      ),
      fill: 'ink'
    })
  }
  return { id, slot: 'eyes', layers: pair(L) }
}

const EYES: StylePart[] = [
  eyePart('eyes-round', {
    top: [
      [-10.5, 1.5],
      [-8, -5],
      [-1.5, -8.8],
      [6.5, -8.6],
      [11.5, -5],
      [12.8, -1]
    ],
    bot: [
      [11, 4.5],
      [5, 9.2],
      [-3, 9.4],
      [-8.3, 6]
    ],
    tilt: 2
  }),
  eyePart('eyes-spark', {
    top: [
      [-10.8, 1.5],
      [-8.4, -5.6],
      [-1.5, -9.6],
      [6.8, -9.4],
      [12, -5.6],
      [13.2, -1]
    ],
    bot: [
      [11.2, 5],
      [5, 10],
      [-3, 10],
      [-8.6, 6.4]
    ],
    iris: { rx: 8.4, ry: 10.6, dy: 1 },
    pupil: { rx: 3, ry: 4.6 },
    tilt: 2,
    shine: 'star',
    strands: 2
  }),
  eyePart('eyes-sharp', {
    top: [
      [-10.5, 0.5],
      [-6.5, -3],
      [0.5, -5.6],
      [7.5, -6.6],
      [12.8, -4.2],
      [13.8, -1.5]
    ],
    bot: [
      [11, 2.6],
      [5, 5.6],
      [-3, 5.6],
      [-8, 3]
    ],
    iris: { rx: 6.6, ry: 8.6, dy: 0.5 },
    pupil: { rx: 1.8, ry: 5 },
    tilt: 6,
    lash: 3,
    flick: [17, -4.5],
    shine: 'small',
    crease: false
  }),
  eyePart('eyes-sleepy', {
    top: [
      [-10.5, 1.5],
      [-7, -1.4],
      [0, -3.2],
      [7, -3.3],
      [12, -1.8],
      [12.8, 0.4]
    ],
    bot: [
      [11, 4.8],
      [5, 9],
      [-3, 9.2],
      [-8.3, 6]
    ],
    iris: { rx: 7.4, ry: 9.4, dy: 2 },
    lash: 2.6,
    flick: [15.5, -1.5],
    heavy: true,
    tilt: 0
  }),
  arcEyes(
    'eyes-happy',
    [
      [-10, 3],
      [-5, -2.8],
      [1.5, -4.4],
      [8, -2.2],
      [12.5, 2.6]
    ],
    2.8,
    true
  ),
  arcEyes(
    'eyes-closed',
    [
      [-10, -0.5],
      [-4.5, 3.2],
      [2, 4.2],
      [8.5, 2],
      [13, -1.8]
    ],
    2.6,
    true
  ),
  eyePart('eyes-wide', {
    top: [
      [-11, 1.5],
      [-8.6, -6.8],
      [-1.5, -10.8],
      [7, -10.4],
      [12.4, -6],
      [13.4, -1]
    ],
    bot: [
      [11.6, 5.6],
      [5, 10.8],
      [-3, 11],
      [-9, 7]
    ],
    iris: { rx: 5.4, ry: 6.8, dy: 0.5 },
    pupil: { rx: 1.8, ry: 2.4 },
    lash: 2.2,
    shine: 'small',
    tilt: 1
  }),
  eyePart('eyes-tsurime', {
    top: [
      [-10.5, 2],
      [-7.5, -3.6],
      [-0.5, -7.4],
      [7.5, -8.4],
      [12.8, -6.4],
      [14.6, -3.4]
    ],
    bot: [
      [12, 1.6],
      [6, 7],
      [-3, 8],
      [-8.3, 5.2]
    ],
    iris: { rx: 7.2, ry: 9.2, dy: 0.5 },
    pupil: { rx: 2.6, ry: 4.8 },
    tilt: 8,
    lash: 3,
    flick: [18.5, -7.5],
    strands: 1
  }),
  eyePart('eyes-tareme', {
    top: [
      [-10.5, 0],
      [-7.5, -6.5],
      [-0.5, -9.2],
      [7, -8],
      [11.8, -3.6],
      [12.6, 1.4]
    ],
    bot: [
      [10.6, 6],
      [5, 9.6],
      [-3, 9.2],
      [-8.3, 5]
    ],
    iris: { rx: 7.8, ry: 9.8, dy: 1.2 },
    tilt: -6,
    lash: 2.6,
    flick: [15, 3.5],
    strands: 1
  })
]

// ═════════════════════════════════════════════════════════════════════════════
// BROWS — thin tapered strokes in the hair color; drawn ABOVE the bangs
// (the anime convention: brows read through the fringe).
// ═════════════════════════════════════════════════════════════════════════════
const BROW_Y = 124

function browPart(id: string, pts: Pt[], w: number[]): StylePart {
  const d = blade(
    pts.map(([u, v]): Pt => [ECX + u, BROW_Y + v]),
    w
  )
  return { id, slot: 'brows', layers: pair([{ d, fill: 'hair', shade: -0.42 }]) }
}

const BROWS: StylePart[] = [
  browPart(
    'brows-straight',
    [
      [-10.5, 1],
      [-3, -0.4],
      [5, -0.8],
      [12.5, 0.4]
    ],
    [2.1, 2.2, 1.6, 0]
  ),
  browPart(
    'brows-arched',
    [
      [-10.5, 1.4],
      [-3, -2.4],
      [5, -3.2],
      [12.5, -0.6]
    ],
    [2, 2.2, 1.6, 0]
  ),
  browPart(
    'brows-soft',
    [
      [-10, -1],
      [-3, -1.8],
      [5, -1.2],
      [11.5, 0.8]
    ],
    [1.6, 1.8, 1.3, 0]
  ),
  browPart(
    'brows-thick',
    [
      [-10.5, 1],
      [-3, -0.8],
      [5, -1.2],
      [12.5, 0.6]
    ],
    [3.4, 3.6, 2.6, 0]
  ),
  browPart(
    'brows-angry',
    [
      [-10.5, 5],
      [-4, 1.2],
      [4, -2.2],
      [12.5, -3]
    ],
    [2.6, 2.6, 1.8, 0]
  ),
  browPart(
    'brows-sad',
    [
      [-10.5, -4.5],
      [-4, -2],
      [4, 0],
      [12, 2.6]
    ],
    [2.2, 2.2, 1.6, 0]
  ),
  browPart(
    'brows-raised',
    [
      [-10.5, -4],
      [-3, -7.2],
      [5, -7.6],
      [12.5, -5]
    ],
    [2, 2.1, 1.5, 0]
  ),
  {
    id: 'brows-dot',
    slot: 'brows',
    layers: pair([fl(EL(ECX - 5, BROW_Y - 1, 3.2, 2.2), 'hair', -0.35)])
  }
]

// ═════════════════════════════════════════════════════════════════════════════
// NOSE — a tick of shadow on the right (away from the light).
// ═════════════════════════════════════════════════════════════════════════════
const NOSES: StylePart[] = [
  {
    id: 'nose-small',
    slot: 'nose',
    layers: [
      ln(
        curve([
          [161.6, 150.2],
          [162, 153],
          [160.2, 154.2]
        ]),
        'skin',
        1.2,
        -0.48
      )
    ]
  },
  {
    id: 'nose-button',
    slot: 'nose',
    layers: [
      fl(
        smooth([
          [161, 149],
          [163.4, 153],
          [161.6, 155],
          [158.6, 154.8]
        ]),
        'skin',
        -0.2
      ),
      ln(
        curve([
          [158.4, 154.8],
          [160.6, 155.3],
          [162.6, 154.4]
        ]),
        'skin',
        1,
        -0.5
      ),
      fl(EL(158.6, 151.4, 1, 1.3), '#ffffff', 0, 0.6)
    ]
  },
  {
    id: 'nose-long',
    slot: 'nose',
    layers: [
      ln(
        curve([
          [158.5, 138],
          [160.6, 146],
          [162.8, 152.6],
          [160.4, 154.6]
        ]),
        'skin',
        1,
        -0.4,
        0.8
      ),
      ln(
        curve([
          [157.6, 154.8],
          [159.4, 155.4]
        ]),
        'skin',
        1,
        -0.48
      )
    ]
  }
]

// ═════════════════════════════════════════════════════════════════════════════
// MOUTH — small and expressive. Center (160, 164).
// ═════════════════════════════════════════════════════════════════════════════
const MOUTH_IN = '#8a3040'
const TONGUE = '#ee7f8e'

const MOUTHS: StylePart[] = [
  {
    id: 'mouth-smile',
    slot: 'mouth',
    layers: [
      ln(
        curve([
          [153.5, 162],
          [160, 165.4],
          [166.5, 161.6]
        ]),
        'ink',
        1.4
      ),
      ln(
        curve([
          [158.6, 168.6],
          [161.2, 168.6]
        ]),
        'skin',
        0.9,
        -0.22,
        0.5
      )
    ]
  },
  {
    id: 'mouth-grin',
    slot: 'mouth',
    layers: [
      {
        d: 'M 152 161 Q 160 163.5 168 160.6 Q 166 171 160 171.4 Q 154 171 152 161 Z',
        fill: MOUTH_IN,
        mask: true
      },
      { d: EL(160, 172, 6.4, 4.2), fill: TONGUE, clip: true },
      { d: 'M 150 150 L 170 150 L 170 162.6 Q 160 165.4 150 162.6 Z', fill: '#ffffff', clip: true },
      ln('M 152 161 Q 160 163.5 168 160.6 Q 166 171 160 171.4 Q 154 171 152 161 Z', 'ink', 1.2)
    ]
  },
  {
    id: 'mouth-neutral',
    slot: 'mouth',
    layers: [
      ln(
        curve([
          [155.5, 164],
          [160, 164.6],
          [164.5, 163.8]
        ]),
        'ink',
        1.3
      )
    ]
  },
  {
    id: 'mouth-o',
    slot: 'mouth',
    layers: [
      { d: EL(160, 165, 3.6, 4.4), fill: MOUTH_IN, mask: true },
      { d: EL(160, 169, 3, 2.2), fill: TONGUE, clip: true },
      ln(EL(160, 165, 3.6, 4.4), 'ink', 1.2)
    ]
  },
  {
    id: 'mouth-frown',
    slot: 'mouth',
    layers: [
      ln(
        curve([
          [154.5, 166],
          [160, 163],
          [165.5, 166.2]
        ]),
        'ink',
        1.4
      )
    ]
  },
  {
    id: 'mouth-smirk',
    slot: 'mouth',
    layers: [
      ln(
        curve([
          [154.5, 164.6],
          [160.5, 165],
          [165.5, 162.4],
          [167, 160.6]
        ]),
        'ink',
        1.4
      ),
      ln(
        curve([
          [166, 159.6],
          [167.6, 161.6]
        ]),
        'ink',
        1,
        0,
        0.7
      )
    ]
  },
  {
    id: 'mouth-cat',
    slot: 'mouth',
    layers: [
      ln(
        'M 153 162.4 Q 154.6 166.4 157.4 165.6 Q 159.4 165 160 162.8 Q 160.6 165 162.6 165.6 Q 165.4 166.4 167 162.4',
        'ink',
        1.3
      )
    ]
  },
  {
    id: 'mouth-open',
    slot: 'mouth',
    layers: [
      {
        d: 'M 150.5 160 Q 160 162.4 169.5 159.6 Q 168 176 160 176.6 Q 152 176 150.5 160 Z',
        fill: MOUTH_IN,
        mask: true
      },
      { d: EL(160, 176, 8.4, 6), fill: TONGUE, clip: true },
      { d: 'M 150 150 L 170 150 L 170 161.8 Q 160 164.6 150 161.8 Z', fill: '#ffffff', clip: true },
      ln(
        'M 150.5 160 Q 160 162.4 169.5 159.6 Q 168 176 160 176.6 Q 152 176 150.5 160 Z',
        'ink',
        1.3
      )
    ]
  },
  {
    id: 'mouth-fang',
    slot: 'mouth',
    layers: [
      ln(
        curve([
          [153.5, 162],
          [160, 165.4],
          [166.5, 161.6]
        ]),
        'ink',
        1.4
      ),
      {
        d: 'M 161.4 164.6 L 163.8 163.9 L 162.8 167.6 Z',
        fill: '#ffffff',
        stroke: 'ink',
        lineWidth: 0.8
      }
    ]
  },
  {
    id: 'mouth-pout',
    slot: 'mouth',
    layers: [
      ln(
        curve([
          [156, 165],
          [158, 163.6],
          [160, 164.4],
          [162, 163.6],
          [164, 165]
        ]),
        'ink',
        1.2
      ),
      fl(EL(160, 167.6, 3, 1.4), 'skin', -0.14, 0.7)
    ]
  }
]

// ═════════════════════════════════════════════════════════════════════════════
// HAIR — pointed locks. Front mass (bangs + side locks) in `layers`, the back
// mass in `back`. Each front mass casts a soft cel shadow onto the forehead
// (clipped to an invisible face mask), carries a form shadow on the lower-
// right of every lock and an angel-ring gloss band.
// ═════════════════════════════════════════════════════════════════════════════
const FACE_MASK = sym([
  [160, 86],
  [180.5, 89],
  [194, 101],
  [198.5, 118],
  [197.5, 136],
  [194, 150],
  [187, 162],
  [176, 172.5],
  [166, 179],
  [160, 180.5]
])

/** Serrated gloss band following the skull (the "angel ring"). */
function ringD(cy = 99, rx = 37, ry = 22, th = 4.6, a0 = 204, a1 = 318, teeth = 7): string {
  const P = (a: number, k: number): Pt => [
    CX + Math.cos((a * Math.PI) / 180) * rx * k,
    cy + 18 + Math.sin((a * Math.PI) / 180) * ry * k
  ]
  const upper: Pt[] = []
  const lower: Pt[] = []
  for (let i = 0; i <= teeth * 2; i++) {
    const a = a0 + ((a1 - a0) * i) / (teeth * 2)
    upper.push(P(a, 1))
    const t = Math.sin((i / (teeth * 2)) * Math.PI)
    const depth = (i % 2 ? 1.9 : 0.55) * th * (0.4 + 0.6 * t)
    lower.push(P(a, 1 - depth / ry))
  }
  return poly([...upper, ...lower.reverse()])
}

interface HairFront {
  outer: Pt[]
  edge: EP[]
  /** A prebuilt path instead of outer + edge. */
  raw?: string
  /** Extra shadow shapes (clipped). */
  shadows?: string[]
  /** Strand lines. */
  strands?: string[]
  ring?: string | null
  sway?: number
  /** Drop the forehead cast shadow (swept-back styles). */
  noCast?: boolean
}

function front(h: HairFront): StyleLayer[] {
  const d = h.raw ?? hairD(h.outer, h.edge)
  const L: StyleLayer[] = []
  if (!h.noCast) {
    L.push({ d: FACE_MASK, fill: 'skin', alpha: 0, mask: true })
    L.push({ d: moveD(d, 1.5, 3.6), fill: 'skin', shade: -0.2, alpha: 0.85, clip: true })
  }
  L.push(
    ...cel(d, 'hair', {
      rim: [3.2, 3.4],
      sh: -0.2,
      shadows: h.shadows,
      lights: h.ring === null ? [] : [h.ring ?? ringD()],
      line: 1.2,
      lineShade: -0.55,
      details: h.strands,
      detailW: 0.75,
      sway: h.sway
    })
  )
  return L
}

interface HairBack {
  outer: Pt[]
  edge: EP[]
  sway?: number
  shadows?: string[]
}

function backMass(h: HairBack): StyleLayer[] {
  const d = hairD(h.outer, h.edge)
  return cel(d, 'hair', {
    shade: -0.08,
    rim: [4, 3],
    sh: -0.14,
    deep: h.shadows ?? [EL(160, 214, 44, 66)],
    line: 1.3,
    lineShade: -0.55,
    sway: h.sway ?? 1.2
  })
}

// Standard crown silhouette (left temple → over the top → right temple).
const CROWN: Pt[] = [
  [115, 112],
  [126, 94],
  [142, 82.5],
  [160, 78.5],
  [178, 82.5],
  [194, 94],
  [205, 112]
]

// A fringe of pointed locks across the forehead (right → left), parted at
// x≈168: locks right of the part sweep right, the rest sweep left.
const BANGS: EP[] = [
  [195, 118, 1, 0],
  [194, 138, 2.5, 0],
  [189, 117, 2, 0],
  [183.5, 133, 2.5, 0.5],
  [178, 116, 1.5, 0],
  [172.5, 139, 2.5, 0],
  [169, 108, 1.5, 0],
  [160, 139.5, -3, 0],
  [153, 117, -2.5, 0],
  [145.5, 132, -2.5, 0.5],
  [139.5, 116, -1.5, 0],
  [134, 128, -1.5, 0],
  [131.5, 118, -1, 0],
  [127, 137, -2.5, 0],
  [125.5, 118, -1, 0]
]

/** Strand lines inside the default fringe. */
const BANG_STRANDS = [
  curve([
    [170, 110],
    [172.5, 122],
    [172.4, 132]
  ]),
  curve([
    [164, 112],
    [162, 124],
    [160.6, 133]
  ]),
  curve([
    [148, 118],
    [146, 126]
  ]),
  curve([
    [189.5, 120],
    [192, 131]
  ])
]

// Side locks framing the face down to `tipY`.
function sideLocks(tipY: number, spread = 0): { outer: Pt[]; inR: EP[]; inL: EP[] } {
  const t = tipY
  const low = t >= 190
  const outer: Pt[] = [
    [124 - spread, t],
    ...(low ? [[117 - spread, t - 22] as Pt] : []),
    [113, 150],
    [112.5, 130],
    ...CROWN,
    [207.5, 130],
    [207, 150],
    ...(low ? [[203 + spread, t - 22] as Pt] : []),
    [196 + spread, t]
  ]
  const inR: EP[] = [
    ...(low ? [[198.5, t - 24, 1.5, 0] as EP] : []),
    [197.5, 150, low ? 0 : 1, 0],
    [196.5, 138, 0, 0]
  ]
  const inL: EP[] = [
    [123.5, 138, 0, 0],
    [122.5, 150, 0, 0],
    ...(low ? [[121.5, t - 24, 0, 0] as EP] : []),
    [124 - spread, t, low ? -1.5 : -1, 0]
  ]
  return { outer, inR, inL }
}

const LONG_BACK: HairBack = {
  outer: [
    [113, 300],
    [109, 250],
    [107, 200],
    [108, 150],
    [112, 118],
    [126, 94],
    [142, 82],
    [160, 78],
    [178, 82],
    [194, 94],
    [208, 118],
    [212, 150],
    [213, 200],
    [211, 250],
    [207, 300]
  ],
  edge: [
    [205, 330, 2, 0],
    [196, 314, -1, 0],
    [188, 338, 1.5, 0],
    [178, 318, -1, 0],
    [168, 344, 1.5, 0],
    [158, 320, -1, 0],
    [148, 341, -1.5, 0],
    [137, 318, 1, 0],
    [126, 336, -1.5, 0],
    [116, 315, 1, 0],
    [113, 300, 0, 0]
  ]
}

function longFront(tipY = 206): HairFront {
  const s = sideLocks(tipY)
  return {
    outer: s.outer,
    edge: [...s.inR, ...BANGS, ...s.inL],
    strands: [
      ...BANG_STRANDS,
      curve([
        [202, 150],
        [202, 172],
        [199, 190]
      ]),
      curve([
        [118, 150],
        [118, 172],
        [121, 190]
      ])
    ]
  }
}

/** A path made only of quadratic swoops (corners wherever segments meet). */
function qpath(start: Pt, segs: EP[]): string {
  let d = `M ${f(start[0])} ${f(start[1])}`
  let [px, py] = start
  for (const [x, y, bx = 0, by = 0] of segs) {
    d += ` Q ${f((px + x) / 2 + bx)} ${f((py + y) / 2 + by)} ${f(x)} ${f(y)}`
    px = x
    py = y
  }
  return d + ' Z'
}

/** Scalloped lobes along an elliptical arc (curly silhouettes). */
const arcPt = (cx: number, cy: number, rx: number, ry: number, a: number): Pt => [
  cx + Math.cos((a * Math.PI) / 180) * rx,
  cy + Math.sin((a * Math.PI) / 180) * ry
]

function lobes(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  a0: number,
  a1: number,
  n: number,
  bulge: number
): EP[] {
  const out: EP[] = []
  for (let i = 1; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180
    const am = ((a0 + ((a1 - a0) * (i - 0.5)) / n) * Math.PI) / 180
    const x = cx + Math.cos(a) * rx
    const y = cy + Math.sin(a) * ry
    out.push([x, y, Math.cos(am) * bulge, Math.sin(am) * bulge])
  }
  return out
}

/** Same winding for every subpath-shape (so unions never cancel). */
const norm = (d: string): string => (windOf(d) < 0 ? reverseD(d) : d)

/** A ribbon bow (hair ties, headwear, collars): tails, loops, knot. */
function bow(x: number, y: number, s = 1, paint = 'accent'): StyleLayer[] {
  const P = (u: number, v: number): Pt => [x + u * s, y + v * s]
  const loopR = norm(smooth([P(1.5, -1), P(9, -7), P(14, -5), P(14.5, 3), P(9, 6), P(1.5, 1.5)]))
  const tailR = norm(blade([P(1.5, 2), P(5, 10), P(8.5, 17)], [4 * s, 5 * s, 0]))
  const mir = (d: string) => norm(transformD(d, -1, 1, 2 * x, 0))
  return [
    ...cel(mir(tailR) + ' ' + tailR, paint, { shade: -0.06, rim: [1.5, 1.5], line: 1.1 }),
    ...cel(mir(loopR) + ' ' + loopR, paint, {
      rim: [2, 2],
      line: 1.2,
      details: [curve([P(3, -1), P(9, -3), P(12, -1)]), curve([P(-3, -1), P(-9, -3), P(-12, -1)])]
    }),
    ...cel(EL(x, y, 3 * s, 3.4 * s), paint, { shade: -0.08, rim: [1, 1], glint: 0.8, line: 1.1 })
  ]
}

/** Back mass cut at the nape (short styles): pointed tips around y≈`y`. */
function napeBack(y: number, w = 100, tips = 6): HairBack {
  const hw = w / 2
  const edge: EP[] = []
  for (let i = 0; i <= tips * 2; i++) {
    const t = i / (tips * 2)
    edge.push([
      CX + hw - 2 * hw * t,
      y + (i % 2 ? -8 : 0) + Math.sin(t * Math.PI) * 6,
      i % 2 ? 0 : 1,
      0
    ])
  }
  return {
    outer: [
      [CX - hw, y],
      [CX - hw - 6, y - 26],
      [108.5, 132],
      [112, 110],
      [126, 91],
      [142, 81],
      [160, 77.5],
      [178, 81],
      [194, 91],
      [208, 110],
      [211.5, 132],
      [CX + hw + 6, y - 26],
      [CX + hw, y]
    ],
    edge,
    sway: 0.6,
    shadows: [EL(160, y - 10, hw - 8, 26)]
  }
}

function hairPart(
  id: string,
  fr: HairFront,
  bk?: HairBack | null,
  extra: StyleLayer[] = [],
  extraBack: StyleLayer[] = []
): StylePart {
  const part: StylePart = { id, slot: 'hair', layers: [...front(fr), ...extra] }
  const back = [...extraBack, ...(bk ? backMass(bk) : [])]
  if (back.length) part.back = back
  return part
}

// Side-lock inner edges for short hair (sideburn tips at `t`).
function shortSides(t: number): { outer: Pt[]; inR: EP[]; inL: EP[] } {
  return {
    outer: [
      [124.5, t],
      [116.5, t - 12],
      [112.5, 130],
      ...CROWN,
      [207.5, 130],
      [203.5, t - 12],
      [195.5, t]
    ],
    inR: [
      [198.6, t - 13, 1, 0],
      [197, 132, 0, 0]
    ],
    inL: [
      [123, 132, 0, 0],
      [121.4, t - 13, 0, 0],
      [124.5, t, -1, 0]
    ]
  }
}

const SPIKY_BANGS: EP[] = [
  [195, 116, 1, 0],
  [192.5, 139, 2.5, 0],
  [186, 113, 0.5, 0],
  [178.5, 134, 2.5, 0],
  [172, 109, 0.5, 0],
  [164, 140, 1.5, 0],
  [158, 109, 0, 0],
  [148, 134, -2.5, 0],
  [142, 111, -0.5, 0],
  [131.5, 138, -2.5, 0],
  [126.5, 116, -1, 0]
]

const HIME_BANGS: EP[] = [
  [191, 124, 0, 0],
  [186, 129, 0, 0.8],
  [182.5, 126, 0, 0],
  [177, 130, 0, 0.8],
  [173, 126.5, 0, 0],
  [166, 130.5, 0, 0.8],
  [162, 127, 0, 0],
  [155, 130.5, 0, 0.8],
  [151, 126.5, 0, 0],
  [144, 130, 0, 0.8],
  [140, 126, 0, 0],
  [134, 129, 0, 0.8],
  [129, 124, 0, 0]
]

const LONGBANG_EDGE: EP[] = [
  [195, 118, 1, 0],
  [194.5, 146, 2.5, 0],
  [189, 120, 1, 0],
  [185, 141, 2.4, 0],
  [180, 118, 1, 0],
  [172, 150, 3, 0],
  [168, 112, 1, 0],
  [161, 156, 0, 0],
  [155, 114, -1, 0],
  [146, 146, -3, 0],
  [141, 118, -1, 0],
  [135, 140, -2, 0],
  [131, 118, -1, 0],
  [126.5, 146, -2.5, 0],
  [125.5, 120, -1, 0]
]

const SIDEPART_EDGE: EP[] = [
  [196.5, 122, 0, 0],
  [195, 143, 3, 0],
  [189.5, 126, 0, 0],
  [184, 137, 2, 0.5],
  [177, 122, 0, 0],
  [170, 131, 2, 0.5],
  [162, 116, 0, 1.5],
  [150, 110, 0, 1.5],
  [139, 101, 0, 0],
  [132.5, 118, -1.5, 0],
  [128, 111, 0, 0]
]

const MESSY_BANGS: EP[] = [
  [195, 116, 1, 0],
  [195.5, 137, 2.6, 0],
  [190, 116, 1, 0],
  [187, 128, 1.5, 0],
  [183, 113, 0.5, 0],
  [178, 136, 2.5, 0],
  [172, 112, 0.5, 0],
  [168, 124, 1, 0],
  [165, 110, 0, 0],
  [158, 139, -1, 0],
  [153, 112, -1, 0],
  [146, 129, -2, 0],
  [141, 112, -1, 0],
  [137, 122, -1, 0],
  [134, 113, 0, 0],
  [127.5, 138, -2.6, 0],
  [126, 117, -1, 0]
]

const AHOGE: StyleLayer[] = cel(
  qpath(
    [156, 82],
    [
      [157, 66, -6, 0],
      [172, 58, -3, -4],
      [163, 67, 2, 0],
      [162, 82, 3, 0]
    ]
  ),
  'hair',
  { rim: [1.5, 1.5], line: 1.2, lineShade: -0.55, sway: 4 }
)

const CURLY_BACK: HairBack = {
  outer: [
    [110, 248],
    [100, 222],
    [96, 186],
    [99, 150],
    [104, 118],
    [120, 92],
    [140, 78],
    [160, 74],
    [180, 78],
    [200, 92],
    [216, 118],
    [221, 150],
    [224, 186],
    [220, 222],
    [210, 248]
  ],
  edge: [
    ...lobes(160, 238, 50, 14, 0, 180, 6, 7).map(([x, y, bx, by]): EP => [
      x,
      y + 6,
      bx,
      (by ?? 0) + 2
    ])
  ],
  sway: 1
}

const HAIRS: StylePart[] = [
  hairPart('hair-long', longFront(), LONG_BACK),

  // short — tidy crop, sideburns over the ears
  (() => {
    const s = shortSides(158)
    return hairPart(
      'hair-short',
      { outer: s.outer, edge: [...s.inR, ...BANGS, ...s.inL], strands: BANG_STRANDS },
      napeBack(180, 64, 4)
    )
  })(),

  // spiky — shōnen-hero spikes all round
  hairPart(
    'hair-spiky',
    {
      outer: [],
      edge: [],
      raw: qpath(
        [124.5, 158],
        [
          [114.5, 148, 0, 0],
          [101, 140, 0, 1.5],
          [111.5, 128, 0, 0],
          [96, 113, 1, 2.5],
          [114, 107, 0, 0],
          [104, 86, 3, 1.5],
          [125, 90, 0, 0],
          [124, 64, 4, 2],
          [142, 81, 0, 0],
          [154, 55, 3, 2],
          [163.5, 78, 0, 0],
          [182, 57, -1, 3],
          [183, 80, 0, 0],
          [207, 70, -3, 3],
          [199.5, 94, 0, 0],
          [222, 95, -3, 1],
          [206.5, 110, 0, 0],
          [222, 127, -2, -1],
          [207.5, 130, 0, 0],
          [216, 147, -2, -1],
          [203.5, 147, 0, 0],
          [195.5, 158, 0, 0],
          [198.6, 145, 1, 0],
          [197, 132, 0, 0],
          ...SPIKY_BANGS,
          [123, 132, 0, 0],
          [121.4, 145, 0, 0]
        ]
      ),
      ring: ringD(97, 38, 22, 4.2, 206, 312, 6),
      strands: [
        curve([
          [150, 90],
          [140, 100],
          [133, 116]
        ]),
        curve([
          [170, 88],
          [180, 98],
          [186, 112]
        ])
      ]
    },
    {
      outer: [
        [130, 184],
        [118, 166],
        [108, 140],
        [110, 112],
        [126, 90],
        [160, 76],
        [194, 90],
        [210, 112],
        [212, 140],
        [202, 166],
        [190, 184]
      ],
      edge: [
        [184, 194, 1, 0],
        [178, 180, 0, 0],
        [170, 196, 0, 0],
        [164, 182, 0, 0],
        [155, 196, 0, 0],
        [148, 182, 0, 0],
        [138, 193, -1, 0],
        [130, 184, 0, 0]
      ],
      sway: 0.5
    }
  ),

  // bob — chin length, ends curling in
  hairPart(
    'hair-bob',
    {
      outer: [
        [131, 188],
        [119, 181],
        [112.5, 160],
        [111.5, 135],
        ...CROWN,
        [208.5, 135],
        [207.5, 160],
        [201, 181],
        [189, 188]
      ],
      edge: [
        [194.5, 176, 3, 3],
        [197.5, 150, 0, 0],
        [196.5, 136, 0, 0],
        ...BANGS,
        [123.5, 136, 0, 0],
        [122.5, 150, 0, 0],
        [125.5, 176, 0, 0],
        [131, 188, -3, 3]
      ],
      strands: [
        ...BANG_STRANDS,
        curve([
          [203, 140],
          [204, 162],
          [199, 180]
        ]),
        curve([
          [117, 140],
          [116, 162],
          [121, 180]
        ])
      ]
    },
    {
      outer: [
        [116, 194],
        [107, 172],
        [105, 140],
        [109, 112],
        [126, 90],
        [142, 80],
        [160, 77],
        [178, 80],
        [194, 90],
        [211, 112],
        [215, 140],
        [213, 172],
        [204, 194]
      ],
      edge: [
        [190, 199, 0, 1],
        [178, 192, 0, 0],
        [168, 199, 0, 1],
        [160, 193, 0, 0],
        [152, 199, 0, 1],
        [142, 192, 0, 0],
        [130, 199, 0, 1],
        [116, 194, 0, 0]
      ],
      sway: 0.8,
      shadows: [EL(160, 190, 40, 22)]
    }
  ),

  // buns — odango with ribbons, short side locks
  (() => {
    const s = sideLocks(184)
    const bun = (x: number): StyleLayer[] =>
      cel(EL(x, 84, 17, 16), 'hair', {
        shade: -0.02,
        rim: [3.5, 3],
        lights: [
          blade(
            [
              [x - 11, 80],
              [x - 5, 72.5],
              [x + 4, 71]
            ],
            [0, 3.4, 0]
          )
        ],
        line: 1.3,
        lineShade: -0.55,
        details: [
          curve([
            [x - 10, 90],
            [x - 2, 94],
            [x + 8, 89],
            [x + 11, 80]
          ]),
          curve([
            [x - 6, 78],
            [x + 2, 76],
            [x + 7, 82]
          ])
        ]
      })
    return hairPart(
      'hair-buns',
      { outer: s.outer, edge: [...s.inR, ...BANGS, ...s.inL], strands: BANG_STRANDS },
      napeBack(184, 70, 4),
      pair(bow(189, 94, 0.62)),
      pair(bun(194))
    )
  })(),

  // ponytail — high tail peeking over the crown, swinging behind
  (() => {
    const s = sideLocks(176)
    return hairPart(
      'hair-ponytail',
      { outer: s.outer, edge: [...s.inR, ...BANGS, ...s.inL], strands: BANG_STRANDS },
      {
        outer: [
          [124, 262],
          [118, 214],
          [118, 160],
          [126, 118],
          [142, 92],
          [160, 84],
          [180, 92],
          [196, 118],
          [206, 164],
          [210, 220],
          [206, 272],
          [198, 306]
        ],
        edge: [
          [190, 340, 2, 0],
          [184, 310, 0, 0],
          [176, 330, 1, 0],
          [170, 302, 0, 0],
          [158, 318, -1, 0],
          [152, 290, 0, 0],
          [138, 300, -1, 0],
          [124, 262, 0, 0]
        ],
        sway: 2.6,
        shadows: [EL(160, 200, 32, 50)]
      },
      [],
      [
        ...cel(
          qpath(
            [150, 84],
            [
              [166, 53, -10, -6],
              [199, 57, 2, -12],
              [176, 62, 4, -2],
              [169, 84, 2, 0]
            ]
          ),
          'hair',
          { shade: -0.04, rim: [2, 2.5], line: 1.3, lineShade: -0.55, sway: 2 }
        ),
        ...cel(EL(161, 75.5, 9.5, 4.4), 'accent', { rim: [1.6, 1.4], glint: 0.8, line: 1.2 })
      ]
    )
  })(),

  // curly — big soft curls
  hairPart(
    'hair-curly',
    {
      outer: [],
      edge: [],
      raw: qpath(arcPt(160, 126, 51, 60, 128), [
        ...lobes(160, 126, 51, 60, 128, 412, 13, 6),
        [199, 160, 0, 0],
        [197, 136, 0, 0],
        [197.5, 118, 0, 0],
        ...lobes(160, 109, 37.5, 19, 2, 178, 7, 5),
        [123, 136, 0, 0],
        [121, 160, 0, 0]
      ]),
      ring: ringD(92, 42, 26, 4.2, 210, 316, 6),
      strands: [
        curve([
          [112, 152],
          [118, 148],
          [116, 140]
        ]),
        curve([
          [208, 152],
          [202, 147],
          [205, 139]
        ]),
        curve([
          [136, 96],
          [142, 100],
          [148, 96]
        ]),
        curve([
          [174, 96],
          [180, 100],
          [186, 96]
        ]),
        curve([
          [114, 176],
          [120, 172],
          [118, 164]
        ]),
        curve([
          [206, 176],
          [200, 171],
          [203, 163]
        ])
      ]
    },
    CURLY_BACK
  ),

  // side part — one big swept lock across the brow
  hairPart(
    'hair-sidepart',
    {
      outer: [
        [124, 162],
        [116.5, 150],
        [112.5, 130],
        [114, 110],
        [124, 92],
        [138, 81],
        [158, 76.5],
        [178, 80],
        [195, 92],
        [205.5, 110],
        [208, 130],
        [205, 150],
        [198, 166]
      ],
      edge: [
        [199, 150, 1, 0],
        [197.5, 134, 0, 0],
        ...SIDEPART_EDGE,
        [123, 130, 0, 0],
        [121.5, 148, 0, 0],
        [124, 162, -1, 0]
      ],
      ring: ringD(96, 36, 21, 4.4, 206, 316, 6),
      strands: [
        curve([
          [142, 96],
          [164, 104],
          [184, 120],
          [192, 134]
        ]),
        curve([
          [150, 102],
          [168, 112],
          [178, 124]
        ])
      ]
    },
    napeBack(188, 84, 5)
  ),

  // none — bald: a sheen and a whisper of buzz-cut shadow
  {
    id: 'hair-none',
    slot: 'hair',
    layers: [
      { d: FACE_MASK, fill: 'skin', alpha: 0, mask: true },
      {
        d: 'M 100 60 L 220 60 L 220 110 Q 160 100 100 110 Z',
        fill: 'hair',
        alpha: 0.16,
        clip: true
      },
      {
        d: EL(146, 98, 13, 5.5),
        grad: {
          type: 'radial',
          cx: 146,
          cy: 98,
          r: 13,
          stops: [
            [0, '#ffffff', 0, 0.5],
            [1, '#ffffff', 0, 0]
          ]
        },
        clip: true
      }
    ]
  },

  // twintails — tied high at the sides, ribbons, long swinging tails
  (() => {
    const s = sideLocks(180)
    const tailR: HairBack = {
      outer: [
        [198, 102],
        [214, 102],
        [228, 124],
        [235, 170],
        [235, 232],
        [229, 294],
        [219, 344]
      ],
      edge: [
        [209, 378, 1.5, 0],
        [207, 344, 0, 0],
        [199, 364, 0, 0],
        [202, 318, -1, 0],
        [207, 262, -2, 0],
        [210, 200, -2, 0],
        [210, 146, -1, 0],
        [203, 112, 0, 0],
        [198, 102, 0, 0]
      ],
      sway: 2.6,
      shadows: [
        blade(
          [
            [212, 120],
            [216, 200],
            [212, 300]
          ],
          [0, 9, 0]
        )
      ]
    }
    const tailL: HairBack = {
      outer: tailR.outer.map(([x, y]): Pt => [mx(x), y]),
      edge: tailR.edge.map(([x, y, bx = 0, by = 0]): EP => [mx(x), y, -bx, by]),
      sway: 2.6,
      shadows: [flipX(tailR.shadows![0])]
    }
    return {
      id: 'hair-twintails',
      slot: 'hair',
      back: [...backMass(tailL), ...backMass(tailR), ...backMass(napeBack(186, 70, 4))],
      layers: [
        ...front({ outer: s.outer, edge: [...s.inR, ...BANGS, ...s.inL], strands: BANG_STRANDS }),
        ...pair(bow(204, 106, 0.72))
      ]
    }
  })(),

  // hime — blunt fringe, cheek-length side locks, long straight back
  hairPart(
    'hair-hime',
    {
      outer: [
        [123, 174],
        [116, 160],
        [112, 138],
        [112.5, 124],
        ...CROWN,
        [207.5, 124],
        [208, 138],
        [204, 160],
        [197, 174]
      ],
      edge: [
        [188.5, 174, 0, 0],
        [190.5, 150, 0, 0],
        [191.5, 128, 0, 0],
        ...HIME_BANGS,
        [128.5, 128, 0, 0],
        [129.5, 150, 0, 0],
        [131.5, 174, 0, 0],
        [123, 174, 0, 0]
      ],
      ring: ringD(98, 37, 22, 4.4, 206, 316, 7),
      strands: [
        curve([
          [150, 104],
          [148, 118],
          [147, 128]
        ]),
        curve([
          [172, 104],
          [173, 118],
          [174, 127]
        ]),
        curve([
          [198, 140],
          [198, 172]
        ]),
        curve([
          [122, 140],
          [122, 172]
        ])
      ]
    },
    {
      outer: [
        [110, 380],
        [106, 320],
        [105, 250],
        [105, 180],
        [107, 140],
        [111, 112],
        [126, 92],
        [142, 81],
        [160, 77.5],
        [178, 81],
        [194, 92],
        [209, 112],
        [213, 140],
        [215, 180],
        [215, 250],
        [214, 320],
        [210, 380]
      ],
      edge: [
        [185, 382, 0, 0],
        [160, 383, 0, 0],
        [135, 382, 0, 0],
        [110, 380, 0, 0]
      ],
      sway: 1,
      shadows: [
        EL(160, 230, 44, 80),
        poly([
          [180, 330],
          [184, 382],
          [176, 382]
        ]),
        poly([
          [140, 330],
          [144, 382],
          [136, 382]
        ])
      ]
    }
  ),

  // messy — tousled, flicked-out ends and an ahoge
  hairPart(
    'hair-messy',
    {
      outer: [],
      edge: [],
      raw: qpath(
        [121, 190],
        [
          [117, 170, 0, 0],
          [106, 162, 0, 2],
          [113, 150, 0, 0],
          [109, 128, -2, 0],
          [104, 118, 0, 0],
          [114, 108, 0, 0],
          [118, 94, -2, -2],
          [132, 83, -2, -2],
          [148, 77, -2, -2],
          [165, 76, 0, -2],
          [182, 80, 2, -2],
          [197, 90, 2, -2],
          [206, 104, 0, 0],
          [216, 116, 0, 0],
          [210, 126, 0, 0],
          [213, 150, 0, 0],
          [219, 165, 0, 0],
          [205, 166, 0, 0],
          [199, 190, 0, 0],
          [198.5, 162, 1, 0],
          [197, 136, 0, 0],
          ...MESSY_BANGS,
          [123, 136, 0, 0],
          [121.5, 162, 0, 0]
        ]
      ),
      ring: ringD(96, 38, 22, 4.4, 206, 316, 7),
      strands: [
        curve([
          [119, 150],
          [117, 170]
        ]),
        curve([
          [201, 150],
          [203, 172]
        ]),
        curve([
          [152, 86],
          [146, 100],
          [144, 112]
        ])
      ]
    },
    napeBack(196, 92, 6),
    AHOGE
  ),

  // long bangs — a curtain over the eyes
  (() => {
    const s = sideLocks(212)
    return hairPart(
      'hair-longbangs',
      {
        outer: s.outer,
        edge: [...s.inR, ...LONGBANG_EDGE, ...s.inL],
        strands: [
          curve([
            [166, 112],
            [165, 132],
            [162, 150]
          ]),
          curve([
            [176, 114],
            [177, 132],
            [174, 146]
          ]),
          curve([
            [150, 116],
            [148, 132],
            [147, 142]
          ])
        ]
      },
      {
        ...LONG_BACK,
        outer: LONG_BACK.outer.map(([x, y]): Pt => [x, y > 150 ? 150 + (y - 150) * 0.62 : y]),
        edge: LONG_BACK.edge.map(([x, y, bx, by]): EP => [x, 150 + (y - 150) * 0.62, bx, by])
      }
    )
  })()
]

// ═════════════════════════════════════════════════════════════════════════════
// TORSO — tops + arms + hands. Shoulders ≈ 116–204 at y 210, waist y 268.
// ═════════════════════════════════════════════════════════════════════════════
const ARM: Pt[] = [
  [200, 219],
  [206.5, 243],
  [210.6, 270],
  [212.8, 298],
  [214.5, 325]
]
const ARM_W = [16.5, 13.8, 11.4, 10, 8.4]

const HAND_R = smooth([
  [210, 324],
  [218.6, 324.5],
  [221, 332.5],
  [220.8, 341.5],
  [218.4, 348.6],
  [214.4, 351.6],
  [211, 349],
  [209.6, 341.5],
  [208.2, 336],
  [209, 329.5]
])

function handR(): StyleLayer[] {
  return cel(HAND_R, 'skin', {
    rim: [2.2, 2],
    line: 1.4,
    lineShade: SKIN_LINE,
    details: [
      curve([
        [211.4, 333],
        [210.6, 339.5],
        [212.6, 344]
      ]),
      curve([
        [216.6, 343],
        [216.8, 349]
      ])
    ],
    detailW: 0.85
  })
}

/** A sleeve over the arm centerline between fractions t0..t1 (0 shoulder, 1 wrist). */
function armSeg(t0: number, t1: number, grow: number): { d: string; pts: Pt[]; w: number[] } {
  const at = (t: number): [Pt, number] => {
    const x = t * (ARM.length - 1)
    const i = Math.min(ARM.length - 2, Math.floor(x))
    const k = x - i
    const p: Pt = [
      ARM[i][0] + (ARM[i + 1][0] - ARM[i][0]) * k,
      ARM[i][1] + (ARM[i + 1][1] - ARM[i][1]) * k
    ]
    return [p, ARM_W[i] + (ARM_W[i + 1] - ARM_W[i]) * k + grow]
  }
  const pts: Pt[] = []
  const w: number[] = []
  const N = 5
  for (let i = 0; i <= N; i++) {
    const [p, ww] = at(t0 + ((t1 - t0) * i) / N)
    pts.push(p)
    w.push(ww)
  }
  return { d: limb(pts, w), pts, w }
}

interface ArmOpts {
  /** Sleeve paint + where it ends (0 shoulder … 1 wrist). */
  sleeve?: string
  sleeveShade?: number
  to?: number
  grow?: number
  /** Cuff band paint at the sleeve end. */
  cuff?: string
  cuffShade?: number
  /** Stripe on the cuff. */
  stripe?: string
  gloves?: string
  gloveShade?: number
  /** Oversized sleeve swallowing the back of the hand (sweater paws). */
  paws?: boolean
  /** Custom sleeve outline replacing the tube (bell / puff / furisode). */
  shape?: string
  /** Buttons on the cuff. */
  buttons?: boolean
}

const GOLD = '#e0b24e'

/** A cuff band across the arm between two centerline points. */
function band(p0: Pt, p1: Pt, w0: number, w1: number, bulge = 1.6): string {
  const t = dir(p0, p1)
  const nx = -t[1]
  const ny = t[0]
  const a: Pt = [p0[0] + nx * w0 * 0.5, p0[1] + ny * w0 * 0.5]
  const b: Pt = [p1[0] + nx * w1 * 0.5, p1[1] + ny * w1 * 0.5]
  const c: Pt = [p1[0] - nx * w1 * 0.5, p1[1] - ny * w1 * 0.5]
  const d: Pt = [p0[0] - nx * w0 * 0.5, p0[1] - ny * w0 * 0.5]
  const q = (u: Pt, v: Pt, k: number) =>
    `Q ${f((u[0] + v[0]) / 2 + t[0] * k)} ${f((u[1] + v[1]) / 2 + t[1] * k)} ${f(v[0])} ${f(v[1])}`
  return `M ${f(a[0])} ${f(a[1])} L ${f(b[0])} ${f(b[1])} ${q(b, c, bulge)} L ${f(d[0])} ${f(d[1])} ${q(d, a, bulge)} Z`
}

/** The right arm split into what goes BEHIND the body (bare arm, sleeve,
 *  cuff — the shoulder cap tucks under the body's shoulder line) and what
 *  goes in FRONT (the hand, so skirts never swallow it). */
function armR(o: ArmOpts = {}): { back: StyleLayer[]; front: StyleLayer[] } {
  const B: StyleLayer[] = []
  const to = o.to ?? 1
  const hand = (): StyleLayer[] =>
    o.gloves
      ? cel(HAND_R, o.gloves, {
          shade: o.gloveShade ?? 0,
          rim: [2.2, 2],
          line: 1.4,
          details: [
            curve([
              [211.4, 333],
              [210.6, 339.5],
              [212.6, 344]
            ])
          ]
        })
      : handR()
  if (to < 0.85 || (!o.sleeve && !o.shape)) {
    B.push(
      ...cel(limb(ARM, ARM_W), 'skin', {
        rim: [3, 1],
        line: 1.4,
        lineShade: SKIN_LINE,
        details: [
          curve([
            [209.5, 268],
            [212, 271]
          ])
        ]
      })
    )
  }
  if (o.paws) B.push(...hand())
  if (o.shape) {
    B.push(
      ...cel(o.shape, o.sleeve ?? 'outfitA', {
        shade: o.sleeveShade ?? 0,
        rim: [4, 1.5],
        line: 1.5
      })
    )
  } else if (o.sleeve) {
    const s = armSeg(0, to, o.grow ?? 3)
    B.push(
      ...cel(s.d, o.sleeve, {
        shade: o.sleeveShade ?? 0,
        rim: [3.6, 1],
        line: 1.5,
        details:
          to > 0.6
            ? [
                curve([
                  [205, 259],
                  [209, 263],
                  [213, 261]
                ])
              ]
            : []
      })
    )
    if (o.cuff) {
      const c = armSeg(Math.max(0, to - (o.paws ? 0.2 : 0.1)), to, (o.grow ?? 3) + 1.2)
      const p0 = c.pts[0]
      const p1 = o.paws ? ([215.6, 338] as Pt) : c.pts[c.pts.length - 1]
      const w1 = o.paws ? c.w[0] + 3 : c.w[c.w.length - 1]
      B.push(
        ...cel(band(p0, p1, c.w[0], w1, o.paws ? 4 : 1.6), o.cuff, {
          shade: o.cuffShade ?? 0,
          rim: [3, 0.6],
          line: 1.4,
          details: o.paws
            ? [
                curve([
                  [209.5, 322],
                  [208.8, 336]
                ]),
                curve([
                  [214.5, 322],
                  [214.8, 340]
                ]),
                curve([
                  [219.5, 321],
                  [221, 336]
                ])
              ]
            : []
        })
      )
      const m: Pt = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]
      if (o.stripe) {
        B.push(
          ln(
            curve([
              [m[0] - w1 / 2 + 0.8, m[1] - 0.6],
              [m[0], m[1] + 0.6],
              [m[0] + w1 / 2 - 0.8, m[1] - 0.2]
            ]),
            o.stripe,
            1.1
          )
        )
      }
      if (o.buttons)
        B.push(fl(EL(m[0] + 1, m[1] - 1.2, 1.2) + ' ' + EL(m[0] + 1.4, m[1] + 2.4, 1.2), GOLD))
    }
  }
  return { back: B, front: o.paws ? [] : hand() }
}

/** Arms behind + `body` + hands in front. */
function dressed(o: ArmOpts, body: StyleLayer[], after: StyleLayer[] = []): StyleLayer[] {
  const a = armR(o)
  return [...pair(a.back), ...body, ...pair(a.front), ...after]
}

// Body silhouettes (sym halves: neck → shoulder → armpit → waist → hem). The
// shoulder point reaches x≈207 so the sleeve caps tuck under it.
const SHOULDER: Pt[] = [
  [160, 196],
  [172, 196.5],
  [188, 202],
  [201, 207.5],
  [207, 215],
  [206.5, 225],
  [199.5, 237]
]
const TOP_FIT: Pt[] = [...SHOULDER, [193, 254], [189.5, 271], [192, 292], [176, 295], [160, 295.5]]
const TOP_LOOSE: Pt[] = [...SHOULDER, [197, 258], [195, 278], [197, 298], [178, 301], [160, 301.5]]
const JACKET: Pt[] = [...SHOULDER, [196, 256], [193, 274], [195.5, 302], [178, 305], [160, 306]]
const bodyD = (half: Pt[]): string => sym(half)

/** Cel-shaded body piece: form shadow + a soft armpit shadow. */
function bodyCel(d: string, paint: string, o: Cel = {}): StyleLayer[] {
  return cel(d, paint, {
    rim: [5.5, 2.5],
    sh: -0.17,
    line: 1.6,
    ...o,
    shadows: [
      'M 197 234 Q 193 248 192 266 L 214 266 L 214 230 Z',
      flipX('M 196 234 Q 194 240 193 248 L 214 246 L 214 230 Z'),
      ...(o.shadows ?? [])
    ]
  })
}

const SAILOR_BODY = sym([
  ...SHOULDER,
  [194, 253],
  [191, 270],
  [194.5, 287],
  [178, 289.8],
  [160, 290.4]
])
const SAILOR_LAPEL = smooth(
  [
    [170, 196],
    [186, 201.5],
    [202, 208.5],
    [198, 216],
    [184, 228],
    [170, 240.5],
    [160, 250],
    [161.4, 232],
    [165.6, 212]
  ],
  true,
  0.55
)

const LAPEL_R = smooth(
  [
    [168, 197.5],
    [185, 201],
    [190.5, 207],
    [184.5, 210],
    [176, 228],
    [163.5, 255],
    [161.5, 238],
    [164, 214]
  ],
  true,
  0.45
)
const SHIRT_V = poly([
  [146, 195.5],
  [174, 195.5],
  [160, 257]
])
const COLLAR_PT_R = smooth(
  [
    [160, 205],
    [168, 196.5],
    [176, 199],
    [172, 210],
    [163, 214]
  ],
  true,
  0.4
)

function tieLayers(): StyleLayer[] {
  const knot = smooth(
    [
      [155.5, 203],
      [164.5, 203],
      [162.6, 211],
      [157.4, 211]
    ],
    true,
    0.5
  )
  const bladeD = poly([
    [157.4, 210.5],
    [162.6, 210.5],
    [166.4, 246],
    [160, 254],
    [153.6, 246]
  ])
  return [
    ...cel(bladeD, 'accent', {
      rim: [3, 2],
      line: 1.3,
      details: [
        curve([
          [155, 226],
          [165, 222]
        ]),
        curve([
          [154.5, 238],
          [166, 234]
        ])
      ]
    }),
    ...cel(knot, 'accent', { shade: -0.05, rim: [2, 1.5], glint: 0.8, line: 1.3 })
  ]
}

const star = (cx: number, cy: number, r: number, r2 = r * 0.45): string => {
  const pts: Pt[] = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r2 : r
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr])
  }
  return poly(pts)
}

/** Five round petals (sakura) — one path of five ellipses. */
const flower = (cx: number, cy: number, r: number): string => {
  const out: string[] = []
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    out.push(EL(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.48))
  }
  return out.join(' ')
}

// Metal (armor, buckles): literal steel, not recolored.
const STEEL = '#c9d0dc'
const metal = (d: string, o: Cel = {}): StyleLayer[] =>
  cel(d, STEEL, { rim: [3.5, 2.5], sh: -0.28, glint: 1.6, line: 1.4, lineShade: -0.62, ...o })

/** A hood lying behind the neck (torso `back` band, under the neck). */
const HOOD_BACK = cel(
  sym([
    [160, 174],
    [174, 175],
    [189, 182],
    [199, 194],
    [199, 210],
    [160, 212]
  ]),
  'outfitA',
  { shade: -0.22, rim: [3, 2], line: 1.4 }
)

const TORSOS: StylePart[] = [
  // ── sailor fuku (school uniform, scarf in the accent) ──
  {
    id: 'torso-sailor',
    slot: 'torso',
    layers: dressed({ sleeve: 'outfitB', to: 0.97, cuff: 'outfitA', stripe: 'outfitB' }, [
      ...bodyCel(SAILOR_BODY, 'outfitB', {
        sh: -0.14,
        shadows: [moveD(SAILOR_LAPEL, 0, 5), flipX(moveD(SAILOR_LAPEL, 0, 5))],
        details: [
          curve([
            [150, 272],
            [147, 288]
          ]),
          curve([
            [172, 268],
            [174, 288]
          ])
        ]
      }),
      ...pair([
        ...cel(SAILOR_LAPEL, 'outfitA', { rim: [3, 3], line: 1.5, lineShade: -0.5 }),
        ln(
          curve([
            [198.5, 211.5],
            [183.5, 224.5],
            [169.5, 236.5],
            [162.4, 243.6]
          ]),
          'outfitB',
          1.2
        )
      ]),
      ...cel(
        blade(
          [
            [158.4, 250],
            [154.6, 262],
            [149.6, 277]
          ],
          [7, 8.4, 0]
        ),
        'accent',
        { rim: [2.6, 2], line: 1.3 }
      ),
      ...cel(
        blade(
          [
            [161.6, 250],
            [165.8, 263],
            [170.4, 279]
          ],
          [7, 8.6, 0]
        ),
        'accent',
        { rim: [2.6, 2], line: 1.3 }
      ),
      ...cel(EL(160, 249.5, 5, 4.2), 'accent', { rim: [2, 1.6], glint: 1, line: 1.3 })
    ])
  },

  // ── tee: crew neck, short sleeves, a little star print ──
  {
    id: 'torso-tee',
    slot: 'torso',
    layers: dressed({ sleeve: 'outfitA', to: 0.36, grow: 5 }, [
      ...bodyCel(bodyD(TOP_FIT), 'outfitA', {
        details: [
          curve([
            [146, 276],
            [150, 290]
          ]),
          curve([
            [176, 280],
            [173, 292]
          ]),
          curve([
            [205, 223],
            [200.5, 234]
          ]),
          curve([
            [115, 223],
            [119.5, 234]
          ])
        ]
      }),
      ...cel(
        blade(
          [
            [146, 196.5],
            [153, 202.5],
            [160, 204.5],
            [167, 202.5],
            [174, 196.5]
          ],
          [2.6, 3.4, 3.6, 3.4, 2.6]
        ),
        'outfitA',
        { shade: -0.12, rim: null, line: 1.2 }
      ),
      ...cel(star(160, 240, 9), 'accent', { rim: [2, 2], line: 1.2 })
    ])
  },

  // ── hoodie: hood behind the neck, drawstrings, kangaroo pocket ──
  {
    id: 'torso-hoodie',
    slot: 'torso',
    back: HOOD_BACK,
    layers: dressed({ sleeve: 'outfitA', to: 0.92, grow: 5.5, cuff: 'outfitA', cuffShade: -0.1 }, [
      ...bodyCel(bodyD(TOP_LOOSE), 'outfitA', {
        details: [
          curve([
            [131, 291],
            [189, 291]
          ])
        ]
      }),
      ...cel(
        smooth(
          [
            [137, 262],
            [183, 262],
            [189, 289],
            [131, 289]
          ],
          true,
          0.3
        ),
        'outfitA',
        {
          shade: -0.04,
          rim: [3, 2],
          line: 1.3,
          details: [
            curve([
              [141, 264],
              [136, 287]
            ]),
            curve([
              [179, 264],
              [184, 287]
            ])
          ]
        }
      ),
      ...pair([
        ...cel(
          smooth(
            [
              [161, 214],
              [168, 206],
              [172, 197],
              [178, 194],
              [183, 199],
              [176, 210],
              [166, 219]
            ],
            true,
            0.8
          ),
          'outfitA',
          { shade: -0.06, rim: [2.5, 2.5], line: 1.3 }
        ),
        ln(
          curve([
            [166, 213],
            [167.6, 230],
            [166.8, 244]
          ]),
          'outfitB',
          1.3
        ),
        fl(RRd(165, 243, 3.6, 6, 1.2), 'outfitB', -0.2)
      ])
    ])
  },

  // ── dress: fitted bodice, flared skirt, Peter Pan collar + bow ──
  {
    id: 'torso-dress',
    slot: 'torso',
    layers: dressed({ shape: armSeg(0, 0.32, 9).d, sleeve: 'outfitA', to: 0.32 }, [
      ...bodyCel(
        bodyD([
          ...SHOULDER,
          [191, 256],
          [186.5, 272],
          [196, 300],
          [212, 340],
          [224, 386],
          [208, 392],
          [192, 388],
          [176, 393],
          [160, 390]
        ]),
        'outfitA',
        {
          shadows: [
            poly([
              [170, 282],
              [184, 394],
              [196, 394],
              [178, 280]
            ]),
            poly([
              [146, 282],
              [136, 394],
              [124, 394],
              [140, 280]
            ])
          ],
          details: [
            curve([
              [160, 285],
              [158, 330],
              [160, 388]
            ]),
            curve([
              [178, 290],
              [190, 340],
              [196, 386]
            ]),
            curve([
              [142, 290],
              [130, 340],
              [124, 386]
            ]),
            curve([
              [205, 222],
              [200.5, 234]
            ]),
            curve([
              [115, 222],
              [119.5, 234]
            ])
          ]
        }
      ),
      ...cel(RRd(132.5, 268, 55, 9, 3), 'accent', { rim: [3, 2], line: 1.3 }),
      ...pair(cel(COLLAR_PT_R, 'outfitB', { rim: [2.5, 2.5], line: 1.3 })),
      ...bow(160, 210, 0.5)
    ])
  },

  // ── suit: jacket, lapels, shirt + tie ──
  {
    id: 'torso-suit',
    slot: 'torso',
    layers: dressed({ sleeve: 'outfitA', to: 0.93, grow: 4, cuff: 'outfitB' }, [
      ...bodyCel(bodyD(JACKET), 'outfitA', {
        details: [
          curve([
            [161.5, 256],
            [162.5, 305]
          ]),
          curve([
            [176, 286],
            [189, 285]
          ]),
          curve([
            [131, 285],
            [144, 286]
          ])
        ]
      }),
      ...cel(SHIRT_V, 'outfitB', { rim: [3, 2], line: 1.2 }),
      ...pair(cel(COLLAR_PT_R, 'outfitB', { rim: [2, 2], line: 1.2 })),
      ...tieLayers(),
      ...pair(cel(LAPEL_R, 'outfitA', { shade: -0.05, rim: [3, 3], glint: 1, line: 1.4 })),
      fl(EL(163.8, 266, 1.9), 'outfitA', -0.45),
      fl(EL(163.8, 284, 1.9), 'outfitA', -0.45)
    ])
  },

  // ── sweater: oversized turtleneck, cable knit, sweater paws ──
  {
    id: 'torso-sweater',
    slot: 'torso',
    layers: dressed(
      { sleeve: 'outfitA', to: 0.9, grow: 5, cuff: 'outfitA', cuffShade: -0.06, paws: true },
      [
        ...bodyCel(
          bodyD([
            [160, 194],
            [172, 195],
            [189, 201],
            [202, 207.5],
            [208.5, 215],
            [208, 226],
            [201.5, 239],
            [198, 262],
            [196.5, 284],
            [198.5, 304],
            [178, 307],
            [160, 307.5]
          ]),
          'outfitA',
          {
            details: [
              curve([
                [150, 212],
                [147, 226],
                [150, 240],
                [147, 254],
                [150, 268],
                [147, 282]
              ]),
              curve([
                [170, 212],
                [173, 226],
                [170, 240],
                [173, 254],
                [170, 268],
                [173, 282]
              ])
            ]
          }
        ),
        ...cel(RRd(124, 294, 72, 13, 4), 'outfitA', {
          shade: -0.06,
          rim: [3, 1.5],
          line: 1.3,
          details: [134, 144, 154, 164, 174, 184].map((x) =>
            curve([
              [x, 297],
              [x, 305]
            ])
          )
        }),
        ...cel(
          sym([
            [160, 178],
            [172, 178.5],
            [176.5, 184],
            [178, 196],
            [175, 205],
            [160, 207]
          ]),
          'outfitA',
          {
            shade: -0.03,
            rim: [3, 2],
            line: 1.3,
            details: [
              curve([
                [143.5, 187],
                [160, 190],
                [176.5, 187]
              ]),
              curve([
                [142.5, 196],
                [160, 199],
                [177.5, 196]
              ])
            ]
          }
        )
      ]
    )
  },

  // ── robe: long mage robe, gold trim, bell sleeves, sash ──
  {
    id: 'torso-robe',
    slot: 'torso',
    back: HOOD_BACK,
    layers: dressed(
      {
        sleeve: 'outfitA',
        to: 0.95,
        shape: limb(
          [
            [200, 219],
            [207, 243],
            [212.5, 272],
            [218, 302],
            [223, 330]
          ],
          [18, 18, 22, 30, 36]
        )
      },
      [
        ...bodyCel(
          bodyD([
            ...SHOULDER,
            [195, 262],
            [193, 280],
            [200, 330],
            [209, 400],
            [217, 470],
            [221, 503],
            [196, 507],
            [178, 505],
            [160, 508]
          ]),
          'outfitA',
          {
            shadows: [
              poly([
                [172, 290],
                [186, 510],
                [198, 510],
                [180, 288]
              ]),
              poly([
                [146, 290],
                [132, 510],
                [120, 510],
                [140, 288]
              ])
            ],
            details: [
              curve([
                [180, 300],
                [192, 400],
                [198, 500]
              ]),
              curve([
                [140, 300],
                [128, 400],
                [122, 500]
              ])
            ]
          }
        ),
        ...cel(
          poly([
            [148, 196],
            [172, 196],
            [160, 238]
          ]),
          'outfitB',
          { rim: [3, 2], line: 1.2 }
        ),
        ...pair(
          cel(
            blade(
              [
                [172, 195.5],
                [166, 216],
                [161.5, 238]
              ],
              [5, 5, 5]
            ),
            'accent',
            { rim: [1.6, 1.4], glint: 0.8, line: 1.1 }
          )
        ),
        ...cel(RRd(157.5, 238, 5, 268, 2), 'accent', { rim: [1.6, 0], line: 1.1 }),
        ...cel(
          smooth(
            [
              [132, 268],
              [188, 268],
              [191, 280],
              [129, 280]
            ],
            true,
            0.3
          ),
          'accent',
          { shade: -0.12, rim: [3, 2], line: 1.3 }
        ),
        ...cel(
          poly([
            [160, 266],
            [166, 274],
            [160, 282],
            [154, 274]
          ]),
          'accent',
          { shade: 0.2, rim: [2, 2], glint: 1, line: 1.1 }
        )
      ],
      pair([
        ln(
          curve([
            [207.4, 330],
            [221, 338],
            [238.6, 332]
          ]),
          'accent',
          2.4
        )
      ])
    )
  },

  // ── armor: light fantasy plate over a tunic ──
  {
    id: 'torso-armor',
    slot: 'torso',
    layers: dressed(
      { sleeve: 'outfitA', to: 0.62, grow: 3, gloves: 'outfitB', gloveShade: -0.3 },
      [
        ...bodyCel(bodyD(TOP_LOOSE), 'outfitA', {}),
        ...metal(
          sym([
            [160, 203],
            [176, 201],
            [191, 206],
            [194, 224],
            [190, 250],
            [182, 266],
            [170, 274],
            [160, 276]
          ]),
          {
            details: [
              curve([
                [160, 206],
                [160, 274]
              ]),
              curve([
                [133, 236],
                [148, 246],
                [160, 248],
                [172, 246],
                [187, 236]
              ])
            ]
          }
        ),
        ...cel(
          blade(
            [
              [133, 211],
              [160, 221],
              [187, 211]
            ],
            [3, 3, 3]
          ),
          'accent',
          { rim: [1.4, 1.2], line: 1 }
        ),
        ...cel(EL(160, 234, 4.5, 5.5), 'accent', {
          shade: 0.1,
          rim: [2, 2],
          glint: 1.2,
          line: 1.1
        }),
        ...pair(
          metal(
            smooth(
              [
                [162, 280],
                [192, 280],
                [197, 304],
                [165, 308]
              ],
              true,
              0.3
            ),
            {
              details: [
                curve([
                  [164, 294],
                  [194, 292]
                ])
              ]
            }
          )
        )
      ],
      [
        // vambraces + pauldrons over the arms
        ...pair([
          ...metal(
            limb(
              [
                [210.4, 282],
                [212.6, 300],
                [214, 318]
              ],
              [14, 13, 12]
            ),
            {
              details: [
                curve([
                  [205, 290],
                  [216, 290]
                ])
              ]
            }
          ),
          ...metal(
            smooth([
              [187, 205],
              [201, 202],
              [214, 210],
              [218, 224],
              [212, 233],
              [199, 229],
              [189, 218]
            ]),
            {
              details: [
                curve([
                  [193, 213],
                  [205, 215],
                  [213.5, 225]
                ])
              ]
            }
          ),
          ln(
            curve([
              [191, 207],
              [202, 205],
              [212, 212]
            ]),
            'accent',
            1.6
          )
        ])
      ]
    )
  },

  // ── blazer: school blazer, shirt collar, ribbon bow, crest ──
  {
    id: 'torso-blazer',
    slot: 'torso',
    layers: dressed(
      { sleeve: 'outfitA', to: 0.97, grow: 4, buttons: true, cuff: 'outfitA', cuffShade: -0.06 },
      [
        ...bodyCel(bodyD(JACKET), 'outfitA', {
          details: [
            curve([
              [161.5, 256],
              [162.5, 305]
            ]),
            curve([
              [174, 284],
              [190, 283]
            ])
          ]
        }),
        ...cel(SHIRT_V, 'outfitB', { rim: [3, 2], line: 1.2 }),
        ...pair(cel(COLLAR_PT_R, 'outfitB', { rim: [2, 2], line: 1.2 })),
        ...bow(160, 212, 0.55),
        ...pair(cel(LAPEL_R, 'outfitA', { shade: -0.05, rim: [3, 3], glint: 1, line: 1.4 })),
        ...cel(
          smooth(
            [
              [136, 236],
              [146, 236],
              [146, 245],
              [141, 249],
              [136, 245]
            ],
            true,
            0.4
          ),
          'accent',
          { rim: [1.6, 1.6], glint: 0.8, line: 1 }
        ),
        fl(EL(165, 264, 2.1), GOLD),
        fl(EL(165, 282, 2.1), GOLD)
      ]
    )
  },

  // ── kimono: full-length, sakura print, obi, hanging furisode sleeves ──
  {
    id: 'torso-kimono',
    slot: 'torso',
    layers: [
      ...pair(
        cel(
          smooth(
            [
              [199, 212],
              [214, 216],
              [225, 248],
              [232, 312],
              [233, 368],
              [220, 382],
              [206, 376],
              [203, 330],
              [201, 280]
            ],
            true,
            0.8
          ),
          'outfitA',
          {
            shade: -0.06,
            rim: [5, 3],
            line: 1.5,
            details: [
              curve([
                [211, 244],
                [217, 300],
                [217, 362]
              ])
            ]
          }
        )
      ),
      ...dressed({ sleeve: 'outfitA', to: 0.9, grow: 10 }, [
        ...bodyCel(
          bodyD([
            ...SHOULDER,
            [193, 258],
            [190, 280],
            [189, 330],
            [188, 390],
            [189, 450],
            [191, 504],
            [176, 508],
            [160, 509]
          ]),
          'outfitA',
          {
            details: [
              curve([
                [158, 300],
                [152, 400],
                [148, 507]
              ])
            ]
          }
        ),
        ...((pts: number[][]) => [
          fl(pts.map(([x, y]) => flower(x, y, 6)).join(' '), 'accent', 0.35),
          fl(pts.map(([x, y]) => EL(x, y, 1.3)).join(' '), 'accent', -0.1)
        ])([
          [178, 226],
          [141, 244],
          [180, 330],
          [140, 360],
          [172, 420],
          [134, 452],
          [178, 488]
        ]),
        ...cel(
          blade(
            [
              [147, 196],
              [154, 222],
              [163, 250]
            ],
            [6, 6, 6]
          ),
          'outfitB',
          { rim: [1.6, 1], line: 1.2 }
        ),
        ...cel(
          blade(
            [
              [173, 196],
              [166, 222],
              [155, 258]
            ],
            [6, 6, 6]
          ),
          'outfitB',
          { rim: [1.6, 1], line: 1.2 }
        ),
        ...cel(
          smooth(
            [
              [130, 262],
              [190, 262],
              [191, 298],
              [129, 298]
            ],
            true,
            0.25
          ),
          'accent',
          {
            shade: -0.05,
            rim: [4, 2],
            line: 1.4,
            details: [
              curve([
                [131, 270],
                [189, 270]
              ]),
              curve([
                [131, 290],
                [189, 290]
              ])
            ]
          }
        ),
        ln(
          curve([
            [130, 280],
            [160, 281],
            [190, 280]
          ]),
          'outfitB',
          2
        ),
        ...cel(EL(160, 281, 4.5, 3.2), 'outfitB', { rim: [1.5, 1.5], line: 1 })
      ])
    ]
  },

  // ── idol: stage dress with frills, big chest bow, gloves ──
  {
    id: 'torso-idol',
    slot: 'torso',
    layers: dressed(
      { shape: armSeg(0, 0.34, 10).d, sleeve: 'outfitB', to: 0.34, gloves: 'outfitB' },
      [
        ...cel(
          hairD(
            [
              [120, 312],
              [128, 290],
              [192, 290],
              [200, 312]
            ],
            Array.from({ length: 9 }, (_, i): EP => [196 - i * 9, i % 2 ? 336 : 344, 0, 3]).concat([
              [120, 312, 0, 0]
            ])
          ),
          'outfitB',
          { rim: [4, 2], line: 1.3 }
        ),
        ...cel(
          hairD(
            [
              [126, 296],
              [132, 280],
              [188, 280],
              [194, 296]
            ],
            Array.from({ length: 8 }, (_, i): EP => [190 - i * 9, i % 2 ? 318 : 326, 0, 3]).concat([
              [126, 296, 0, 0]
            ])
          ),
          'outfitA',
          { rim: [4, 2], line: 1.3 }
        ),
        ...bodyCel(
          bodyD([...SHOULDER, [193, 254], [189.5, 271], [190, 286], [176, 288], [160, 288.5]]),
          'outfitA',
          {}
        ),
        ...cel(
          hairD(
            [
              [142, 200],
              [160, 194],
              [178, 200]
            ],
            Array.from({ length: 5 }, (_, i): EP => [174 - i * 7, i % 2 ? 206 : 211, 0, 2]).concat([
              [142, 200, 0, 0]
            ])
          ),
          'outfitB',
          { rim: [2, 2], line: 1.2 }
        ),
        ...bow(160, 236, 1.05),
        ...cel(star(160, 236.5, 3.6), GOLD, { rim: [1, 1], line: 0.8 }),
        ...cel(RRd(134, 276, 52, 6, 2), 'accent', { rim: [2, 1.5], line: 1.1 })
      ],
      pair([
        ...cel(band([212.6, 300], [214.5, 318], 13, 12, 1.2), 'outfitB', {
          rim: [2.5, 1],
          line: 1.3
        }),
        ln(
          curve([
            [207.6, 304],
            [213.6, 305.6],
            [219.6, 304]
          ]),
          'accent',
          1.4
        )
      ])
    )
  },

  // ── gakuran: high-collar school jacket, gold buttons ──
  {
    id: 'torso-gakuran',
    slot: 'torso',
    layers: dressed(
      { sleeve: 'outfitA', to: 0.97, grow: 4, buttons: true, cuff: 'outfitA', cuffShade: -0.08 },
      [
        ...bodyCel(bodyD(JACKET), 'outfitA', {
          details: [
            curve([
              [160, 206],
              [160, 305]
            ]),
            curve([
              [174, 236],
              [186, 236]
            ])
          ]
        }),
        ...cel(RRd(147, 190, 26, 14, 3), 'outfitA', { shade: -0.04, rim: [3, 2], line: 1.3 }),
        ln(
          curve([
            [148, 191],
            [160, 192.5],
            [172, 191]
          ]),
          '#f4f2ee',
          1.2
        ),
        fl([214, 232, 250, 268, 286].map((y) => EL(160, y, 2.2)).join(' '), GOLD)
      ]
    )
  }
]

// ═════════════════════════════════════════════════════════════════════════════
// LEGS — bottoms + visible legs. Hips y ≈ 296, knees ≈ 420, ankles ≈ 518.
// ═════════════════════════════════════════════════════════════════════════════
const LEG: Pt[] = [
  [175, 298],
  [175, 340],
  [174.5, 380],
  [173.5, 420],
  [173.4, 452],
  [172.2, 488],
  [171, 520]
]
const LEG_W = [33, 30.5, 25, 18.6, 20.6, 13.4, 10.4]

function legR(extraShadows: string[] = []): StyleLayer[] {
  return cel(limb(LEG, LEG_W), 'skin', {
    rim: [3.6, 0],
    shadows: extraShadows,
    line: 1.5,
    lineShade: SKIN_LINE,
    details: [
      curve([
        [171, 424],
        [174, 426.5],
        [177.5, 424.5]
      ])
    ]
  })
}

const legs = (shadows: string[] = []): StyleLayer[] => pair(legR(shadows))

function RRd(x: number, y: number, w: number, h: number, r: number): string {
  return smooth(
    [
      [x + r, y],
      [x + w - r, y],
      [x + w, y + r],
      [x + w, y + h - r],
      [x + w - r, y + h],
      [x + r, y + h],
      [x, y + h - r],
      [x, y + r]
    ],
    true,
    0.4
  )
}

/** Pleated skirt from the waist (y≈277) to `hem`. */
function pleatedSkirt(
  hem: number,
  flare: number,
  paint = 'outfitA',
  overlay?: StyleLayer[]
): StyleLayer[] {
  const pleats = 7
  const top = 277
  const wT = 31
  const wH = 31 + flare
  const hemPts: Pt[] = []
  for (let i = 0; i <= pleats * 2; i++) {
    const t = i / (pleats * 2)
    const x = CX + wH - 2 * wH * t
    const y = hem + (i % 2 ? -3 : 1) + Math.sin(t * Math.PI) * 3
    hemPts.push([x, y])
  }
  const d =
    `M ${f(CX - wT)} ${top} L ${f(CX + wT)} ${top} ` +
    curve([
      [CX + wT, top],
      [CX + wT + flare * 0.3, top + (hem - top) * 0.35],
      [CX + wH, hem]
    ]).replace(/^M/, 'L') +
    ' ' +
    hemPts.map(([x, y]) => `L ${f(x)} ${f(y)}`).join(' ') +
    ' ' +
    curve([
      [CX - wH, hem],
      [CX - wT - flare * 0.3, top + (hem - top) * 0.35],
      [CX - wT, top]
    ]).replace(/^M/, 'L') +
    ' Z'
  const panels: string[] = []
  const folds: string[] = []
  for (let i = 1; i < pleats * 2; i += 2) {
    const t = i / (pleats * 2)
    const xt = CX + wT - 2 * wT * t
    const xh = hemPts[i][0]
    const xh2 = hemPts[i + 1][0]
    if ((i + 1) % 4 === 0)
      panels.push(
        poly([
          [xt, top],
          [xh, hemPts[i][1]],
          [xh2, hemPts[i + 1][1]],
          [xt - 4, top]
        ])
      )
    folds.push(
      curve([
        [xt, top + 2],
        [(xt + xh) / 2, (top + hem) / 2],
        [xh, hemPts[i][1] - 1]
      ])
    )
  }
  return [
    ...cel(d, paint, {
      rim: [5, 2],
      shadows: panels,
      overlay,
      line: 1.6,
      details: folds,
      detailW: 1
    }),
    ...cel(RRd(CX - 32, 274, 64, 8, 2), paint, { shade: -0.08, rim: [3, 1.5], line: 1.4 })
  ]
}

/** A trouser leg over the leg centerline from the hip to `bottom`. */
function trouserR(bottom: number, grow: number, flare = 0): string {
  const pts = LEG.filter((p) => p[1] < bottom - 8)
  const w = LEG_W.slice(0, pts.length).map(
    (x, i) => x + grow + (flare * i) / Math.max(1, pts.length - 1)
  )
  const last = LEG[pts.length] ?? LEG[LEG.length - 1]
  const k = (bottom - pts[pts.length - 1][1]) / (last[1] - pts[pts.length - 1][1])
  const end: Pt = [pts[pts.length - 1][0] + (last[0] - pts[pts.length - 1][0]) * k, bottom]
  const ew = w[w.length - 1] + flare * 0.3
  const { L, R } = sides([...pts, end], [...w, ew])
  // flat hem: straight across the bottom
  return curve(L) + ' ' + curve(R.reverse()).replace(/^M/, 'L') + ' Z'
}

/** Pelvis/seat block joining the two trouser legs. */
const SEAT = smooth(
  [
    [129, 280],
    [191, 280],
    [194, 300],
    [190, 318],
    [174, 326],
    [160, 320],
    [146, 326],
    [130, 318],
    [126, 300]
  ],
  true,
  0.7
)

function pants(
  bottom: number,
  paint: string,
  o: { flare?: number; grow?: number; cuff?: boolean } = {}
): StyleLayer[] {
  const leg = trouserR(bottom, o.grow ?? 3, o.flare ?? 0)
  const R = [
    ...cel(leg, paint, {
      rim: [4, 0],
      line: 1.5,
      details: [
        curve([
          [175, 330],
          [174.5, 400],
          [173.5, bottom - 4]
        ])
      ]
    })
  ]
  if (o.cuff) {
    const y = bottom - 8
    const p = LEG.find((q) => q[1] >= y) ?? LEG[LEG.length - 1]
    R.push(
      ...cel(band([p[0] + 0.5, y], [p[0] + 0.4, bottom + 1], 26, 27, 1), paint, {
        shade: -0.06,
        rim: [3, 0],
        line: 1.3
      })
    )
  }
  return [
    ...pair(R),
    ...cel(SEAT, paint, {
      rim: [4, 2],
      line: 1.5,
      details: [
        curve([
          [160, 290],
          [160, 318]
        ])
      ]
    }),
    // belt
    ...cel(RRd(127, 278, 66, 7.5, 2), paint, { shade: -0.35, rim: [2, 1], line: 1.2 }),
    ...cel(RRd(155, 277.4, 10, 8.6, 1.8), '#d8d2c2', {
      rim: [1.4, 1.4],
      sh: -0.3,
      line: 1,
      lineShade: -0.6
    })
  ]
}

/** A-line / long skirt from the waist to `hem` (hem half-width `w`). */
function skirt(hem: number, w: number, paint: string, folds = 5): StyleLayer[] {
  const top = 276
  const hemPts: Pt[] = []
  for (let i = 0; i <= folds * 2; i++) {
    const t = i / (folds * 2)
    hemPts.push([CX + w - 2 * w * t, hem + (i % 2 ? -2 : 1.5) + Math.sin(t * Math.PI) * 3])
  }
  const d =
    curve([
      [CX - 31, top],
      [CX, top - 1],
      [CX + 31, top]
    ]) +
    ' ' +
    curve([
      [CX + 31, top],
      [CX + 31 + (w - 31) * 0.45, top + (hem - top) * 0.4],
      [CX + w, hem]
    ]).replace(/^M/, 'L') +
    ' ' +
    curve(hemPts).replace(/^M/, 'L') +
    ' ' +
    curve([
      [CX - w, hem],
      [CX - 31 - (w - 31) * 0.45, top + (hem - top) * 0.4],
      [CX - 31, top]
    ]).replace(/^M/, 'L') +
    ' Z'
  const folds2: string[] = []
  const shadows: string[] = []
  for (let i = 1; i < folds * 2; i += 2) {
    const t = i / (folds * 2)
    const xt = CX + 26 - 52 * t
    const [xh, yh] = hemPts[i]
    folds2.push(
      curve([
        [xt, top + (hem - top) * 0.35],
        [(xt + xh) / 2, (top + hem) * 0.5 + (hem - top) * 0.15],
        [xh, yh - 1]
      ])
    )
    if ((i + 1) % 4 === 0)
      shadows.push(
        poly([
          [xt + 1, top + (hem - top) * 0.3],
          [xh + 3, yh + 2],
          [xh - 6, yh + 2]
        ])
      )
  }
  return [
    ...cel(d, paint, { rim: [5, 2], shadows, line: 1.6, details: folds2 }),
    ...cel(RRd(CX - 32, 273, 64, 8, 2), paint, { shade: -0.1, rim: [3, 1.5], line: 1.3 })
  ]
}

/** Plaid overlay stripes for a skirt shape (clipped by the caller's mask). */
function plaid(x0: number, x1: number, y0: number, y1: number): StyleLayer[] {
  const wide: string[] = []
  const thin: string[] = []
  for (let x = x0; x <= x1; x += 13) {
    wide.push(`M ${x} ${y0} L ${x - 4} ${y1}`)
    thin.push(`M ${x + 6} ${y0} L ${x + 2} ${y1}`)
  }
  for (let y = y0 + 8; y <= y1; y += 13) {
    wide.push(`M ${x0 - 20} ${y} L ${x1 + 20} ${y}`)
    thin.push(`M ${x0 - 20} ${y + 6} L ${x1 + 20} ${y + 6}`)
  }
  return [
    { d: wide.join(' '), stroke: 'outfitA', lineWidth: 3.2, alpha: 0.5, clip: true },
    { d: thin.join(' '), stroke: 'accent', lineWidth: 0.9, alpha: 0.9, clip: true }
  ]
}

const HEM_SHADOW = (y: number): string =>
  `M 110 ${y - 12} L 210 ${y - 12} L 210 ${y + 10} Q 160 ${y + 16} 110 ${y + 10} Z`

const LEGS: StylePart[] = [
  {
    id: 'legs-pleated',
    slot: 'legs',
    layers: [...legs([HEM_SHADOW(352)]), ...pleatedSkirt(352, 21)]
  },
  {
    id: 'legs-plaid',
    slot: 'legs',
    layers: (() => {
      return [
        ...legs([HEM_SHADOW(348)]),
        ...pleatedSkirt(348, 20, 'outfitB', plaid(104, 216, 276, 356))
      ]
    })()
  },
  { id: 'legs-pants', slot: 'legs', layers: pants(526, 'outfitB') },
  {
    id: 'legs-shorts',
    slot: 'legs',
    layers: [
      ...legs([HEM_SHADOW(348)]),
      ...pants(350, 'outfitB', { grow: 5, flare: 4, cuff: true })
    ]
  },
  {
    id: 'legs-skirt',
    slot: 'legs',
    layers: [...legs([HEM_SHADOW(356)]), ...skirt(356, 46, 'outfitB', 4)]
  },
  {
    id: 'legs-longskirt',
    slot: 'legs',
    layers: [...legs([]), ...skirt(512, 62, 'outfitB', 6)]
  },
  {
    id: 'legs-hakama',
    slot: 'legs',
    layers: [
      ...legs([]),
      ...pair(
        cel(trouserR(527, 12, 20), 'outfitB', {
          rim: [5, 0],
          shadows: [
            poly([
              [170, 320],
              [176, 528],
              [186, 528]
            ])
          ],
          line: 1.5,
          details: [
            curve([
              [166, 330],
              [164, 526]
            ]),
            curve([
              [180, 330],
              [184, 526]
            ])
          ]
        })
      ),
      ...cel(SEAT, 'outfitB', { rim: [4, 2], line: 1.5 }),
      ...cel(RRd(127, 276, 66, 10, 2), 'outfitB', { shade: -0.12, rim: [2, 1], line: 1.2 }),
      ln(
        curve([
          [128, 281],
          [160, 283],
          [192, 281]
        ]),
        'accent',
        2
      ),
      ...cel(
        blade(
          [
            [160, 282],
            [156, 296],
            [153, 312]
          ],
          [4, 4, 0]
        ),
        'accent',
        { rim: [1, 1], line: 0.9 }
      ),
      ...cel(
        blade(
          [
            [160, 282],
            [165, 296],
            [168, 310]
          ],
          [4, 4, 0]
        ),
        'accent',
        { rim: [1, 1], line: 0.9 }
      )
    ]
  }
]

// ═════════════════════════════════════════════════════════════════════════════
// FEET — shoes standing on y 540.
// ═════════════════════════════════════════════════════════════════════════════
const GROUND = 540
const SHOE_R = smooth([
  [165, 517],
  [177.6, 517],
  [180.6, 526],
  [182.6, 534.5],
  [180.4, 539.6],
  [171.4, 540.6],
  [162.4, 539.8],
  [160.6, 534.5],
  [162.2, 526]
])
const SOLE_CUT = `M 150 536.5 L 195 536.5 L 195 546 L 150 546 Z`

/** A sock / stocking from `top` down the leg (right side). */
function sockR(top: number, paint: string, shade = 0): StyleLayer[] {
  const idx = LEG.findIndex((p) => p[1] > top)
  const k = (top - LEG[idx - 1][1]) / (LEG[idx][1] - LEG[idx - 1][1])
  const x0 = LEG[idx - 1][0] + (LEG[idx][0] - LEG[idx - 1][0]) * k
  const w0 = LEG_W[idx - 1] + (LEG_W[idx] - LEG_W[idx - 1]) * k
  const pts: Pt[] = [[x0, top], ...LEG.slice(idx)]
  const w = [w0, ...LEG_W.slice(idx)].map((x) => x + 1.2)
  return [
    ...cel(limb(pts, w), paint, { shade, rim: [3, 0], line: 1.3 }),
    ln(
      curve([
        [x0 - w[0] / 2 + 0.6, top + 3.5],
        [x0, top + 4.6],
        [x0 + w[0] / 2 - 0.6, top + 3.5]
      ]),
      paint,
      0.9,
      shade - 0.35
    )
  ]
}

function loaferR(paint = 'outfitA', shade = -0.38): StyleLayer[] {
  return [
    ...cel(SHOE_R, paint, {
      shade,
      rim: [3, 2],
      glint: 1.2,
      shadows: [SOLE_CUT],
      line: 1.4,
      lineShade: -0.7
    }),
    ln(
      curve([
        [163.8, 525],
        [171.4, 527.4],
        [179.4, 525]
      ]),
      paint,
      1.1,
      -0.7
    )
  ]
}

const FEET: StylePart[] = [
  { id: 'feet-loafers', slot: 'feet', layers: pair([...sockR(509, 'outfitB'), ...loaferR()]) },
  { id: 'feet-kneesocks', slot: 'feet', layers: pair([...sockR(438, 'outfitB'), ...loaferR()]) },
  {
    id: 'feet-thighhigh',
    slot: 'feet',
    layers: pair([
      ...sockR(372, 'outfitA', -0.62),
      ...cel(SHOE_R, 'accent', {
        shade: -0.2,
        rim: [3, 2],
        glint: 1.2,
        shadows: [SOLE_CUT],
        line: 1.4,
        lineShade: -0.65
      }),
      ln(
        curve([
          [163.6, 523],
          [171.4, 521],
          [179.6, 523]
        ]),
        'accent',
        1.8,
        -0.45
      )
    ])
  },
  {
    id: 'feet-sneakers',
    slot: 'feet',
    layers: pair([
      ...cel(
        smooth([
          [164, 514],
          [178.5, 514],
          [182.5, 524],
          [185, 533],
          [183, 539.4],
          [171.5, 541],
          [160, 539.4],
          [158, 533],
          [160.5, 524]
        ]),
        'accent',
        { rim: [3, 2], glint: 1.2, line: 1.4 }
      ),
      ...cel(
        smooth(
          [
            [157.6, 533],
            [185.4, 533],
            [184, 540],
            [171.5, 541.4],
            [159, 540]
          ],
          true,
          0.5
        ),
        '#f6f4f0',
        { rim: [2, 1], sh: -0.18, line: 1.2, lineShade: -0.55 }
      ),
      ln(
        curve([
          [165.5, 520],
          [171.5, 522],
          [177.5, 520]
        ]),
        '#f6f4f0',
        1.4
      ),
      ln(
        curve([
          [165, 525],
          [171.5, 527],
          [178, 525]
        ]),
        '#f6f4f0',
        1.4
      )
    ])
  },
  {
    id: 'feet-boots',
    slot: 'feet',
    layers: pair([
      ...cel(
        smooth(
          [
            [161.2, 462],
            [182.8, 462],
            [181.8, 492],
            [180.6, 516],
            [183, 530],
            [183, 539.6],
            [171.5, 541],
            [160, 539.6],
            [160, 530],
            [162, 516],
            [161.6, 492]
          ],
          true,
          0.6
        ),
        'outfitB',
        {
          shade: -0.45,
          rim: [3.5, 1],
          glint: 1.2,
          shadows: [SOLE_CUT],
          line: 1.4,
          lineShade: -0.7,
          details: [
            curve([
              [162, 470],
              [172, 472],
              [182, 470]
            ])
          ]
        }
      ),
      ...cel(RRd(160.4, 461, 23, 7, 2), 'outfitB', {
        shade: -0.3,
        rim: [2, 1],
        line: 1.2,
        lineShade: -0.7
      }),
      fl(RRd(177, 494, 4, 5, 1), GOLD)
    ])
  },
  {
    id: 'feet-sandals',
    slot: 'feet',
    layers: pair([
      ...cel(
        smooth([
          [166, 518],
          [177, 518],
          [180.5, 528],
          [181.6, 536],
          [177, 539.4],
          [171.5, 539.8],
          [166, 539.4],
          [161.4, 536],
          [162.5, 528]
        ]),
        'skin',
        {
          rim: [2.5, 1.5],
          line: 1.3,
          lineShade: SKIN_LINE,
          details: [
            curve([
              [167, 536.5],
              [167.2, 539.4]
            ]),
            curve([
              [171.5, 536.8],
              [171.5, 539.8]
            ]),
            curve([
              [176, 536.5],
              [175.8, 539.4]
            ])
          ]
        }
      ),
      ...cel(RRd(159, 538.6, 25, 3.6, 1.6), 'accent', {
        shade: -0.3,
        rim: null,
        line: 1,
        lineShade: -0.6
      }),
      ...cel(
        blade(
          [
            [162.4, 528],
            [171.5, 531],
            [180.6, 528]
          ],
          [3.2, 3.2, 3.2]
        ),
        'accent',
        { rim: [1, 1], line: 1 }
      ),
      ...cel(
        blade(
          [
            [163.6, 520],
            [171.5, 517.6],
            [179.4, 520]
          ],
          [2.6, 2.6, 2.6]
        ),
        'accent',
        { rim: [1, 1], line: 1 }
      )
    ])
  },
  {
    id: 'feet-geta',
    slot: 'feet',
    layers: pair([
      ...sockR(504, '#f7f5f0'),
      ...cel(
        smooth([
          [165, 516],
          [178, 516],
          [180.5, 525],
          [181.6, 533.5],
          [171.5, 535],
          [161.4, 533.5],
          [162.5, 525]
        ]),
        '#f7f5f0',
        { rim: [2.5, 1.5], sh: -0.16, line: 1.2, lineShade: -0.55 }
      ),
      ...cel(RRd(159.5, 533.4, 24, 3.4, 1), '#b98a5a', {
        rim: [2, 1],
        sh: -0.25,
        line: 1,
        lineShade: -0.6
      }),
      fl(RRd(162, 536.8, 5, 3.4, 0.6), '#8a6240'),
      fl(RRd(176, 536.8, 5, 3.4, 0.6), '#8a6240'),
      ln(
        curve([
          [163, 524],
          [171.5, 519.4],
          [180, 524]
        ]),
        'accent',
        2
      )
    ])
  },
  {
    id: 'feet-heels',
    slot: 'feet',
    layers: pair([
      ...cel(
        smooth([
          [166, 519],
          [177, 519],
          [180, 527],
          [180.6, 535],
          [177, 539.6],
          [171.5, 540],
          [166, 539.6],
          [162.4, 535],
          [163, 527]
        ]),
        'skin',
        { rim: [2.5, 1.5], line: 1.3, lineShade: SKIN_LINE }
      ),
      ...cel(
        smooth([
          [162.5, 529],
          [171.5, 527.4],
          [180.5, 529],
          [181.2, 536],
          [177, 540.6],
          [171.5, 541],
          [166, 540.6],
          [161.8, 536]
        ]),
        'accent',
        { rim: [2.5, 1.5], glint: 1.2, line: 1.3, lineShade: -0.6 }
      ),
      ln(
        curve([
          [163.4, 519.4],
          [171.5, 517],
          [179.6, 519.4]
        ]),
        'accent',
        1.6
      )
    ])
  }
]

// ═════════════════════════════════════════════════════════════════════════════
// BACK — behind-the-body items. The slot sits just above the torso (z 31) so
// straps / clasps can cross the chest; the items themselves live in `back`
// (backZ 2, behind everything). Socket at the shoulders for sway.
// ═════════════════════════════════════════════════════════════════════════════
const FEATHER = '#f7f6ff'

/** Rotate a local point set about the origin and place it at (x, y). */
const place = (pts: Pt[], x: number, y: number, deg = 0): Pt[] => {
  const a = (deg * Math.PI) / 180
  return pts.map(([u, v]): Pt => [
    x + u * Math.cos(a) - v * Math.sin(a),
    y + u * Math.sin(a) + v * Math.cos(a)
  ])
}

function angelWingR(): StyleLayer[] {
  // primaries fan down from the outer edge; secondaries overlap them
  const rowAlong: Pt[] = [
    [298, 128],
    [286, 162],
    [266, 192],
    [242, 216],
    [216, 234],
    [194, 242]
  ]
  const feathers = (len: number[], ang: number[], w: number, shift = 0): string =>
    rowAlong
      .map((r, i) => {
        const a = ((ang[i] + shift) * Math.PI) / 180
        const L = len[i]
        const tip: Pt = [r[0] + Math.cos(a) * L, r[1] + Math.sin(a) * L]
        const mid: Pt = [r[0] + Math.cos(a) * L * 0.55 + 2, r[1] + Math.sin(a) * L * 0.55]
        return blade([r, mid, tip], [w, w * 1.08, 0])
      })
      .join(' ')
  const prim = feathers([150, 146, 134, 118, 96, 72], [82, 86, 90, 94, 98, 102], 24)
  const sec = feathers([100, 96, 88, 78, 64, 50], [80, 86, 92, 96, 100, 104], 22, -4)
  const coverts = qpath(
    [178, 228],
    [
      [196, 196, -4, -4],
      [228, 158, -4, -6],
      [262, 130, -6, -6],
      [296, 114, -6, -4],
      [310, 122, 2, -4],
      [302, 146, 4, 0],
      [292, 162, 5, 1],
      [282, 178, 5, 2],
      [268, 192, 4, 3],
      [254, 204, 4, 4],
      [238, 216, 3, 4],
      [222, 226, 2, 5],
      [204, 236, 1, 4],
      [186, 242, 0, 3]
    ]
  )
  return [
    ...cel(prim, FEATHER, { rim: [5, 3], sh: -0.16, line: 1.2, lineShade: -0.45, sway: 1.6 }),
    ...cel(sec, FEATHER, { rim: [4, 3], sh: -0.13, line: 1.2, lineShade: -0.45, sway: 1.6 }),
    ...cel(coverts, FEATHER, {
      rim: [4, 3],
      sh: -0.12,
      glint: 1.4,
      line: 1.3,
      lineShade: -0.45,
      sway: 1.6,
      details: [
        curve([
          [212, 206],
          [240, 186],
          [270, 158],
          [296, 132]
        ])
      ]
    })
  ]
}

function batWingR(): StyleLayer[] {
  const d = qpath(
    [180, 228],
    [
      [206, 190, -4, -6],
      [252, 144, -6, -8],
      [308, 160, 0, -8],
      [294, 194, -8, -2],
      [300, 234, 2, 0],
      [278, 242, -6, -6],
      [272, 282, 2, 0],
      [250, 270, -4, -6],
      [228, 292, 2, 0],
      [212, 262, -2, -6],
      [188, 252, 0, 0]
    ]
  )
  const bones = [
    curve([
      [184, 232],
      [220, 186],
      [252, 144]
    ]),
    curve([
      [252, 144],
      [280, 150],
      [308, 160]
    ]),
    curve([
      [252, 144],
      [278, 190],
      [300, 234]
    ]),
    curve([
      [252, 144],
      [264, 214],
      [272, 282]
    ]),
    curve([
      [252, 144],
      [240, 220],
      [228, 292]
    ])
  ]
  return [
    ...cel(d, 'outfitA', {
      shade: -0.38,
      rim: [5, 4],
      sh: -0.18,
      line: 1.4,
      lineShade: -0.62,
      sway: 1.8
    }),
    ...bones.map((b) => ({ ...ln(b, 'outfitA', 2, -0.6), sway: 1.8 })),
    { ...fl(EL(252, 144, 3), 'outfitA', -0.6), sway: 1.8 }
  ]
}

function foxTailR(): StyleLayer[] {
  const d = smooth([
    [166, 300],
    [196, 290],
    [226, 293],
    [252, 283],
    [274, 288],
    [283, 306],
    [276, 327],
    [256, 343],
    [228, 350],
    [202, 344],
    [182, 331],
    [168, 318]
  ])
  return cel(d, 'hair', {
    shade: -0.02,
    rim: [5, 4],
    line: 1.4,
    lineShade: -0.55,
    sway: 3,
    overlay: [
      { d: EL(276, 308, 17, 23), fill: '#fbf8f2' },
      { d: EL(280, 314, 12, 17), fill: '#fbf8f2', shade: -0.12 }
    ],
    details: [
      curve([
        [196, 318],
        [224, 322],
        [252, 314]
      ]),
      curve([
        [214, 336],
        [240, 336],
        [258, 326]
      ])
    ]
  })
}

const BACKS: StylePart[] = [
  {
    id: 'back-cape',
    slot: 'back',
    back: [
      ...cel(
        sym([
          [160, 200],
          [188, 201],
          [210, 214],
          [228, 262],
          [242, 360],
          [254, 462],
          [226, 476],
          [196, 466],
          [178, 474],
          [160, 468]
        ]),
        'accent',
        { shade: -0.1, rim: [5, 3], line: 1.4, sway: 1.4 }
      ),
      ...cel(
        sym([
          [160, 200],
          [187, 201],
          [208, 214],
          [224, 262],
          [236, 360],
          [246, 458],
          [222, 468],
          [194, 458],
          [176, 466],
          [160, 460]
        ]),
        'outfitA',
        {
          rim: [7, 3],
          sh: -0.2,
          shadows: [
            poly([
              [214, 250],
              [230, 460],
              [214, 462]
            ]),
            flipX(
              poly([
                [214, 250],
                [230, 460],
                [214, 462]
              ])
            )
          ],
          line: 1.5,
          sway: 1.4,
          details: [
            curve([
              [200, 260],
              [212, 360],
              [220, 456]
            ]),
            curve([
              [120, 260],
              [108, 360],
              [100, 456]
            ])
          ]
        }
      )
    ],
    layers: [
      ln(
        curve([
          [141, 206],
          [160, 214],
          [179, 206]
        ]),
        GOLD,
        1.3
      ),
      ...pair(
        cel(EL(180, 205, 4.2), GOLD, {
          rim: [1.5, 1.5],
          sh: -0.25,
          glint: 1,
          line: 1,
          lineShade: -0.5
        })
      ),
      ...pair([fl(EL(180, 205, 1.8), 'accent')])
    ]
  },
  { id: 'back-wings', slot: 'back', back: pair(angelWingR()), layers: [] },
  { id: 'back-batwings', slot: 'back', back: pair(batWingR()), layers: [] },
  {
    id: 'back-backpack',
    slot: 'back',
    back: [
      ...cel(RRd(118, 188, 84, 104, 16), 'accent', { shade: -0.12, rim: [5, 3], line: 1.5 }),
      ...cel(RRd(122, 184, 76, 30, 12), 'accent', {
        shade: -0.02,
        rim: [4, 2],
        glint: 1,
        line: 1.4
      })
    ],
    layers: pair([
      ...cel(
        blade(
          [
            [176, 199],
            [184, 206],
            [187, 234],
            [186, 268]
          ],
          [6.5, 7, 7, 7]
        ),
        'accent',
        { shade: -0.3, rim: [2, 0], line: 1.2 }
      ),
      ...cel(RRd(182.4, 238, 8, 6, 1.5), '#d8d2c2', {
        rim: [1.2, 1.2],
        sh: -0.3,
        line: 1,
        lineShade: -0.6
      })
    ])
  },
  {
    id: 'back-sword',
    slot: 'back',
    back: [
      ln(
        curve([
          [206, 184],
          [214, 204],
          [210, 226]
        ]),
        'accent',
        2
      ),
      ...cel(
        limb(
          [
            [104, 332],
            [162, 250],
            [218, 170]
          ],
          [9, 9.4, 9.4]
        ),
        'outfitA',
        { shade: -0.35, rim: [3, 2], glint: 1.2, line: 1.3, lineShade: -0.65 }
      ),
      ...cel(
        limb(
          [
            [104, 332],
            [110, 323.5]
          ],
          [10, 10]
        ),
        GOLD,
        { rim: [1.5, 1.5], sh: -0.3, line: 1, lineShade: -0.55 }
      ),
      ...cel(EL(219, 168, 9, 7), '#3a3440', {
        rim: [2, 2],
        glint: 1.4,
        sh: -0.2,
        line: 1.1,
        lineShade: -0.5
      }),
      ...cel(
        limb(
          [
            [221, 165],
            [231, 151],
            [241, 137]
          ],
          [7.4, 7.2, 7.4]
        ),
        '#2c2630',
        {
          rim: [2, 1],
          line: 1.1,
          lineShade: -0.4,
          overlay: [0, 1, 2, 3, 4].map((i): StyleLayer => ({
            d: `M ${f(222 + i * 4)} ${f(160 - i * 5.6)} l 5 -1 M ${f(223.5 + i * 4)} ${f(166 - i * 5.6)} l -2 -7`,
            stroke: '#f2efe8',
            lineWidth: 1
          }))
        }
      ),
      ...cel(EL(242, 136, 3.8, 3.2), GOLD, { rim: [1, 1], sh: -0.3, line: 1, lineShade: -0.55 })
    ],
    layers: []
  },
  { id: 'back-foxtail', slot: 'back', back: foxTailR(), layers: [] }
]

// ═════════════════════════════════════════════════════════════════════════════
// HEADWEAR — sits on the hair crown (top ≈ 78, width ≈ 114–206 at y 100).
// ═════════════════════════════════════════════════════════════════════════════
const HEADWEAR: StylePart[] = [
  {
    id: 'hat-cap',
    slot: 'headwear',
    layers: [
      ...cel(
        sym([
          [160, 63],
          [181, 66],
          [197, 76],
          [206, 90],
          [209, 105],
          [160, 105]
        ]),
        'accent',
        {
          rim: [5, 2],
          glint: 1.4,
          line: 1.5,
          details: [
            curve([
              [160, 65],
              [160, 104]
            ]),
            curve([
              [158, 65],
              [140, 76],
              [132, 104]
            ]),
            curve([
              [162, 65],
              [180, 76],
              [188, 104]
            ])
          ]
        }
      ),
      ...cel(star(172, 88, 6), 'outfitB', { rim: [1.4, 1.4], line: 1 }),
      ...cel(
        'M 108 103 Q 160 93 212 103 Q 216 110 207 115.5 Q 160 128 113 115.5 Q 104 110 108 103 Z',
        'accent',
        {
          shade: -0.14,
          rim: [3, 3],
          line: 1.4
        }
      ),
      ...cel(EL(160, 63.5, 4.6, 2.6), 'accent', { shade: -0.2, rim: [1, 1], line: 1 })
    ]
  },
  {
    id: 'hat-beanie',
    slot: 'headwear',
    layers: [
      ...cel(
        sym([
          [160, 60],
          [183, 63],
          [201, 75],
          [209, 91],
          [211, 106],
          [160, 106]
        ]),
        'accent',
        {
          rim: [5, 2],
          glint: 1.4,
          line: 1.5,
          details: [
            curve([
              [140, 72],
              [132, 100]
            ]),
            curve([
              [180, 72],
              [188, 100]
            ]),
            curve([
              [160, 64],
              [160, 100]
            ])
          ]
        }
      ),
      ...cel(RRd(106, 99, 108, 17, 7), 'accent', {
        shade: -0.12,
        rim: [3, 2],
        line: 1.4,
        details: [116, 126, 136, 146, 156, 166, 176, 186, 196, 206].map((x) =>
          curve([
            [x, 102],
            [x, 113]
          ])
        )
      }),
      ...cel(qpath(arcPt(160, 53, 10, 10, 0), lobes(160, 53, 10, 10, 0, 360, 9, 2.4)), 'outfitB', {
        rim: [2.5, 2.5],
        line: 1.2
      })
    ]
  },
  {
    id: 'hat-crown',
    slot: 'headwear',
    layers: [
      ...cel(
        poly([
          [137, 92],
          [134, 66],
          [146.5, 78],
          [153, 57],
          [160, 73],
          [167, 57],
          [173.5, 78],
          [186, 66],
          [183, 92]
        ]),
        '#f2c14e',
        { rim: [3, 2.5], sh: -0.25, glint: 1.4, line: 1.3, lineShade: -0.55 }
      ),
      ...cel(RRd(135.5, 84, 49, 9, 3), '#f2c14e', {
        shade: -0.08,
        rim: [2, 2],
        sh: -0.25,
        line: 1.2,
        lineShade: -0.55
      }),
      ...[
        [146, 88.5, 2.4],
        [160, 88.5, 3],
        [174, 88.5, 2.4]
      ].flatMap(([x, y, r]) =>
        cel(EL(x, y, r, r * 1.1), 'accent', { rim: [1, 1], glint: 0.8, line: 0.9 })
      ),
      ...[
        [134, 65],
        [153, 56],
        [167, 56],
        [186, 65]
      ].map(([x, y]) => fl(EL(x, y, 2.4), '#fff1b8'))
    ]
  },
  {
    id: 'hat-witch',
    slot: 'headwear',
    layers: [
      ...cel(EL(160, 99, 86, 15), 'outfitA', { shade: -0.12, rim: [5, 3], line: 1.5 }),
      ...cel(
        qpath(
          [117, 100],
          [
            [134, 56, -6, 0],
            [158, 26, -6, -2],
            [184, 10, -4, -4],
            [214, 14, 0, -6],
            [192, 24, 2, 0],
            [182, 48, 4, 0],
            [186, 76, 0, 0],
            [203, 100, 2, 0],
            [160, 104, 0, 4]
          ]
        ),
        'outfitA',
        {
          rim: [6, 3],
          glint: 1.6,
          line: 1.5,
          overlay: [{ d: RRd(100, 80, 120, 13, 0), fill: 'accent' }]
        }
      ),
      ...cel(RRd(152, 80, 16, 13, 2), GOLD, {
        rim: [1.4, 1.4],
        sh: -0.3,
        line: 1,
        lineShade: -0.55
      }),
      fl(RRd(156, 83.5, 8, 6, 1), 'accent')
    ]
  },
  {
    id: 'hat-top',
    slot: 'headwear',
    layers: [
      ...cel(EL(160, 92, 60, 9.5), 'outfitA', {
        shade: -0.32,
        rim: [4, 2],
        line: 1.4,
        lineShade: -0.55
      }),
      ...cel(
        smooth(
          [
            [127, 92],
            [123, 26],
            [197, 26],
            [193, 92]
          ],
          true,
          0.2
        ),
        'outfitA',
        {
          shade: -0.34,
          rim: [6, 0],
          glint: 1.6,
          line: 1.4,
          lineShade: -0.55,
          overlay: [{ d: RRd(110, 74, 100, 13, 0), fill: 'accent' }]
        }
      ),
      ...cel(EL(160, 26, 37, 6), 'outfitA', {
        shade: -0.24,
        rim: [2, 2],
        line: 1.3,
        lineShade: -0.55
      }),
      ...cel(flower(180, 80, 6), 'outfitB', { rim: [1.2, 1.2], line: 0.9 })
    ]
  },
  {
    id: 'hat-headband',
    slot: 'headwear',
    layers: [
      ...cel(
        blade(
          [
            [116, 124],
            [122, 104],
            [136, 90],
            [160, 84.5],
            [184, 90],
            [198, 104],
            [204, 124]
          ],
          [4, 5.5, 5.5, 5.5, 5.5, 5.5, 4]
        ),
        'accent',
        { rim: [2, 2], glint: 1, line: 1.2 }
      ),
      ...bow(188, 94, 0.6)
    ]
  },
  {
    id: 'hat-catears',
    slot: 'headwear',
    layers: pair([
      ...cel(
        smooth(
          [
            [174, 90],
            [192, 52],
            [208, 96]
          ],
          true,
          0.35
        ),
        'hair',
        { rim: [3, 2], line: 1.3, lineShade: -0.55, sway: 1.5 }
      ),
      {
        d: smooth(
          [
            [180, 88],
            [191.5, 62],
            [201, 92]
          ],
          true,
          0.35
        ),
        fill: '#f7b3c6',
        sway: 1.5
      },
      {
        ...ln(
          curve([
            [184, 88],
            [188, 76],
            [187, 70]
          ]),
          'hair',
          1,
          0.2
        ),
        sway: 1.5
      }
    ])
  },
  { id: 'hat-ribbon', slot: 'headwear', layers: bow(186, 84, 1.35) },
  {
    id: 'hat-halo',
    slot: 'headwear',
    layers: [
      ln(EL(160, 67, 30, 7.5), '#fff3b0', 8, 0, 0.45),
      ln(EL(160, 67, 30, 7.5), '#ffd66b', 3.4),
      ln(
        curve([
          [136, 63],
          [148, 60],
          [160, 59.4]
        ]),
        '#ffffff',
        1.2,
        0,
        0.8
      )
    ]
  },
  {
    id: 'hat-flower',
    slot: 'headwear',
    layers: [
      ...cel(
        blade(
          [
            [196, 110],
            [206, 100],
            [214, 102]
          ],
          [0, 6, 0]
        ),
        '#72b36a',
        { rim: [1, 1], line: 1, lineShade: -0.5 }
      ),
      ...cel(
        blade(
          [
            [186, 108],
            [178, 118],
            [170, 118]
          ],
          [0, 5, 0]
        ),
        '#72b36a',
        { rim: [1, 1], line: 1, lineShade: -0.5 }
      ),
      ...[
        [196, 100, 9.5],
        [182, 110, 7],
        [206, 114, 6.2]
      ].flatMap(([x, y, r]) => [
        ...cel(flower(x, y, r), 'accent', {
          shade: 0.35,
          rim: [1.6, 1.6],
          line: 1,
          lineShade: -0.35
        }),
        fl(EL(x, y, r * 0.22), GOLD)
      ])
    ]
  },
  {
    id: 'hat-beret',
    slot: 'headwear',
    layers: [
      ...cel(
        smooth([
          [110, 100],
          [114, 80],
          [134, 64],
          [168, 58],
          [202, 64],
          [224, 80],
          [220, 96],
          [186, 101],
          [146, 103]
        ]),
        'outfitA',
        { rim: [5, 4], glint: 1.5, line: 1.5 }
      ),
      ...cel(RRd(118, 96, 88, 8, 4), 'outfitA', { shade: -0.14, rim: [2, 1], line: 1.2 }),
      ...cel(
        blade(
          [
            [164, 60],
            [166, 54],
            [170, 51]
          ],
          [3, 2.4, 1.6]
        ),
        'outfitA',
        { shade: -0.1, rim: null, line: 1 }
      )
    ]
  },
  {
    id: 'hat-foxmask',
    slot: 'headwear',
    layers: (() => {
      const P = (pts: Pt[]) => place(pts, 124, 100, -18)
      const face = smooth(
        P([
          [0, -16],
          [10, -13],
          [17, -26],
          [20, -8],
          [16, 6],
          [5, 18],
          [0, 22],
          [-5, 18],
          [-16, 6],
          [-20, -8],
          [-17, -26],
          [-10, -13]
        ]),
        true,
        0.6
      )
      return [
        ...cel(face, '#fbf8f2', { rim: [3, 3], sh: -0.14, line: 1.3, lineShade: -0.55 }),
        fl(
          smooth(
            P([
              [11, -14],
              [16, -22],
              [16, -9]
            ]),
            true,
            0.5
          ),
          'accent'
        ),
        fl(
          smooth(
            P([
              [-11, -14],
              [-16, -22],
              [-16, -9]
            ]),
            true,
            0.5
          ),
          'accent'
        ),
        fl(
          blade(
            P([
              [3, -2],
              [9, -4],
              [14, -1]
            ]),
            [0, 2.6, 0]
          ),
          'accent'
        ),
        fl(
          blade(
            P([
              [-3, -2],
              [-9, -4],
              [-14, -1]
            ]),
            [0, 2.6, 0]
          ),
          'accent'
        ),
        fl(EL(...P([[0, 19]])[0], 2, 1.6), INK),
        fl(
          blade(
            P([
              [0, -12],
              [0, -6],
              [0, -1]
            ]),
            [0, 2.4, 0]
          ),
          'accent'
        ),
        ln(curve([P([[18, -10]])[0], [150, 90], [170, 84]]), 'accent', 1.2)
      ]
    })()
  }
]

// ═════════════════════════════════════════════════════════════════════════════
// ACCESSORY — glasses over the eyes, earrings, neckwear, clips.
// ═════════════════════════════════════════════════════════════════════════════
const LENS_R = RRd(164.5, 130, 28, 21, 7)

const ACCESSORIES: StylePart[] = [
  {
    id: 'acc-glasses',
    slot: 'accessory',
    layers: [
      ...pair([
        { d: LENS_R, fill: '#cfe6ff', alpha: 0.14, mask: true },
        {
          d: 'M 174 128 L 182 128 L 170 154 L 162 154 Z M 184.5 128 L 188 128 L 176 154 L 172.5 154 Z',
          fill: '#ffffff',
          alpha: 0.5,
          clip: true
        },
        ln(LENS_R, INK, 1.3, 0.1),
        ln('M 192.5 135 L 200 133.5', INK, 1.3, 0.1)
      ]),
      ln('M 164.5 137 Q 160 134.5 155.5 137', INK, 1.3, 0.1)
    ]
  },
  {
    id: 'acc-shades',
    slot: 'accessory',
    layers: [
      ...pair([
        {
          d: RRd(163.5, 131, 30, 18, 6),
          grad: {
            type: 'linear',
            x1: 0,
            y1: 131,
            x2: 0,
            y2: 149,
            stops: [
              [0, INK, 0, 0.96],
              [1, 'accent', -0.45, 0.9]
            ]
          },
          mask: true
        },
        {
          d: 'M 172 128 L 180 128 L 170 152 L 162 152 Z',
          fill: '#ffffff',
          alpha: 0.28,
          clip: true
        },
        ln(RRd(163.5, 131, 30, 18, 6), INK, 1.5),
        ln('M 163.5 132 L 193.5 131.4', INK, 2.4),
        ln('M 193.5 134 L 200 133', INK, 1.4)
      ]),
      ln('M 163.5 136 Q 160 133.5 156.5 136', INK, 1.5)
    ]
  },
  {
    id: 'acc-earrings',
    slot: 'accessory',
    layers: pair([
      ln(EL(201.8, 154.5, 1.6), GOLD, 1),
      ...cel(
        smooth([
          [201.8, 156.5],
          [204.4, 161],
          [201.8, 165.5],
          [199.2, 161]
        ]),
        'accent',
        { rim: [1, 1], glint: 0.8, line: 0.9 }
      )
    ])
  },
  {
    id: 'acc-necklace',
    slot: 'accessory',
    layers: [
      ln(
        curve([
          [148, 190],
          [152, 204],
          [160, 212],
          [168, 204],
          [172, 190]
        ]),
        GOLD,
        1
      ),
      ...cel(
        smooth([
          [160, 211],
          [164, 216],
          [160, 223],
          [156, 216]
        ]),
        'accent',
        { rim: [1.2, 1.2], glint: 1, line: 1 }
      )
    ]
  },
  {
    id: 'acc-choker',
    slot: 'accessory',
    layers: [
      ...cel(RRd(149.6, 181.5, 20.8, 5, 2), INK, { shade: 0.1, rim: [1.4, 1], line: 0 }),
      ...cel(EL(160, 190.2, 3.4), GOLD, {
        rim: [1.2, 1.2],
        sh: -0.3,
        glint: 1,
        line: 0.9,
        lineShade: -0.55
      }),
      ln('M 160 190.4 L 160 193.6', INK, 0.9)
    ]
  },
  {
    id: 'acc-monocle',
    slot: 'accessory',
    layers: [
      { d: EL(178, 140, 13.5, 13), fill: '#cfe6ff', alpha: 0.14, mask: true },
      { d: 'M 176 124 L 184 124 L 172 158 L 164 158 Z', fill: '#ffffff', alpha: 0.45, clip: true },
      ln(EL(178, 140, 13.5, 13), GOLD, 1.8),
      ln(
        curve([
          [189, 148],
          [194, 168],
          [198, 190],
          [202, 214]
        ]),
        GOLD,
        0.9
      )
    ]
  },
  {
    id: 'acc-headphones',
    slot: 'accessory',
    layers: [
      ...cel(
        blade(
          [
            [110, 136],
            [109, 110],
            [122, 86],
            [160, 71],
            [198, 86],
            [211, 110],
            [210, 136]
          ],
          [5, 6, 6, 6.5, 6, 6, 5]
        ),
        'outfitB',
        { shade: -0.5, rim: [2, 2], glint: 1, line: 1.2, lineShade: -0.55 }
      ),
      ...pair([
        ...cel(RRd(203, 120, 13, 32, 6), 'accent', { rim: [3, 2], glint: 1.2, line: 1.3 }),
        ...cel(RRd(211, 126, 6, 20, 3), 'outfitB', {
          shade: -0.5,
          rim: [1, 1],
          line: 1,
          lineShade: -0.55
        })
      ])
    ]
  },
  {
    id: 'acc-hairclip',
    slot: 'accessory',
    layers: [
      ...cel(
        blade(
          [
            [180, 104],
            [196, 117]
          ],
          [2.8, 2.8]
        ),
        'accent',
        { rim: [1, 1], glint: 0.6, line: 1 }
      ),
      ...cel(
        blade(
          [
            [181, 118],
            [197, 106]
          ],
          [2.8, 2.8]
        ),
        'accent',
        { rim: [1, 1], glint: 0.6, line: 1 }
      ),
      ...cel(star(134, 110, 6.5), GOLD, { rim: [1.4, 1.4], sh: -0.25, line: 1, lineShade: -0.55 })
    ]
  },
  {
    id: 'acc-eyepatch',
    slot: 'accessory',
    layers: [
      ln('M 129 134 L 114 118', '#2a2230', 2),
      ln('M 155 133 Q 180 118 207 112', '#2a2230', 2),
      ...cel(
        smooth([
          [128, 133],
          [142, 128.5],
          [155.5, 133],
          [154.5, 146],
          [142, 152.5],
          [129.5, 146]
        ]),
        '#2a2230',
        {
          rim: [2, 2],
          sh: -0.1,
          glint: 1.2,
          line: 1.1,
          lineShade: -0.4,
          overlay: [{ d: star(142, 140.5, 4.2), fill: 'accent' }]
        }
      )
    ]
  },
  {
    id: 'acc-facemask',
    slot: 'accessory',
    layers: [
      ln('M 127 148 Q 118 146 121 138', '#e8e8ee', 1.2),
      ln('M 193 148 Q 202 146 199 138', '#e8e8ee', 1.2),
      ...cel(
        smooth([
          [126, 146],
          [160, 142],
          [194, 146],
          [192.5, 164],
          [178, 178],
          [160, 181.5],
          [142, 178],
          [127.5, 164]
        ]),
        '#f6f6fa',
        {
          rim: [4, 3],
          sh: -0.12,
          line: 1.2,
          lineShade: -0.45,
          details: [
            curve([
              [132, 156],
              [160, 153],
              [188, 156]
            ]),
            curve([
              [134, 166],
              [160, 164],
              [186, 166]
            ])
          ]
        }
      )
    ]
  }
]

// ═════════════════════════════════════════════════════════════════════════════
// FACIAL HAIR (hair channel) and MARKS.
// ═════════════════════════════════════════════════════════════════════════════
const FACIAL: StylePart[] = [
  {
    id: 'beard-stubble',
    slot: 'facialHair',
    layers: [
      { d: FACE_MASK, fill: 'skin', alpha: 0, mask: true },
      {
        d: 'M 110 138 L 124 142 Q 132 160 148 167 Q 160 171 172 167 Q 188 160 196 142 L 210 138 L 210 200 L 110 200 Z',
        fill: 'hair',
        shade: -0.2,
        alpha: 0.32,
        clip: true
      },
      { d: EL(160, 159, 9, 2.6), fill: 'hair', shade: -0.2, alpha: 0.28, clip: true }
    ]
  },
  {
    id: 'beard-full',
    slot: 'facialHair',
    layers: (() => {
      const beard = qpath(
        [121, 132],
        [
          [120, 156, -2, 0],
          [128, 176, -3, 0],
          [142, 190, -3, 2],
          [149, 196, 0, 0],
          [154, 193, 0, 0],
          [160, 203, 0, 0],
          [166, 193, 0, 0],
          [171, 196, 0, 0],
          [178, 190, 3, 2],
          [192, 176, 3, 0],
          [200, 156, 2, 0],
          [199, 132, 0, 0],
          [194, 144, 0, 0],
          [186, 162, 2, 4],
          [174, 168, 0, 0],
          [160, 172, 0, 0],
          [146, 168, 0, 0],
          [134, 162, -2, 4],
          [126, 144, 0, 0]
        ]
      )
      return [
        ...cel(beard, 'hair', { shade: -0.05, rim: [3, 3], line: 1.3, lineShade: -0.55 }),
        ...pair(
          cel(
            blade(
              [
                [160.4, 159],
                [167, 158.4],
                [174, 161.4],
                [177.5, 165]
              ],
              [2.8, 3.6, 2.2, 0]
            ),
            'hair',
            { shade: -0.05, rim: [1, 1], line: 1, lineShade: -0.55 }
          )
        )
      ]
    })()
  },
  {
    id: 'beard-goatee',
    slot: 'facialHair',
    layers: [
      ...cel(
        qpath(
          [153.5, 170.5],
          [
            [160, 172, 0, 1],
            [166.5, 170.5, 0, 0],
            [164, 180, 1, 0],
            [160, 188, 0, 0],
            [156, 180, 0, 0]
          ]
        ),
        'hair',
        { shade: -0.05, rim: [1.5, 1.5], line: 1.1, lineShade: -0.55 }
      ),
      ...pair([
        fl(
          blade(
            [
              [160.4, 159],
              [166, 158.8],
              [170.5, 161.5]
            ],
            [2, 2.4, 0]
          ),
          'hair',
          -0.1
        )
      ])
    ]
  },
  {
    id: 'mustache',
    slot: 'facialHair',
    layers: pair(
      cel(
        blade(
          [
            [160.3, 158.4],
            [166.5, 157.6],
            [172.5, 160],
            [176, 157.4]
          ],
          [2.6, 3.4, 2, 0]
        ),
        'hair',
        { shade: -0.05, rim: [1, 1], line: 1, lineShade: -0.55 }
      )
    )
  }
]

const hatch = (x: number, y: number): StyleLayer[] =>
  [-4, 0, 4].map((dx) =>
    ln(
      `M ${f(x + dx + 1.6)} ${f(y - 2.6)} L ${f(x + dx - 1.6)} ${f(y + 2.6)}`,
      '#e0506e',
      0.9,
      0,
      0.75
    )
  )

const blushOval = (x: number, a = 0.45): StyleLayer => ({
  d: EL(x, 153.5, 10.5, 5.6),
  grad: {
    type: 'radial',
    cx: x,
    cy: 153.5,
    r: 10.5,
    stops: [
      [0, '#ff6f8a', 0, a],
      [1, '#ff6f8a', 0, 0]
    ]
  }
})

const MARKS: StylePart[] = [
  {
    id: 'marks-blush',
    slot: 'marks',
    layers: [blushOval(140, 0.5), blushOval(180, 0.5), ...hatch(140, 153.5), ...hatch(180, 153.5)]
  },
  {
    id: 'marks-freckles',
    slot: 'marks',
    layers: [
      [147, 150],
      [151, 153],
      [144, 154],
      [140, 150],
      [136, 153.5],
      [173, 150],
      [169, 153],
      [176, 154],
      [180, 150],
      [184, 153.5],
      [157, 149],
      [163, 149]
    ].map(([x, y]) => fl(EL(x, y, 0.8), 'skin', -0.42, 0.75))
  },
  {
    id: 'marks-scar',
    slot: 'marks',
    layers: [
      fl(
        blade(
          [
            [145, 148],
            [160, 145.4],
            [175, 147]
          ],
          [0, 2, 0]
        ),
        'skin',
        -0.28
      ),
      ln(
        curve([
          [150, 146.8],
          [160, 145],
          [170, 146]
        ]),
        'skin',
        0.6,
        0.3,
        0.8
      )
    ]
  },
  { id: 'marks-mole', slot: 'marks', layers: [fl(EL(134, 153, 1.1), INK, 0, 0.85)] },
  {
    id: 'marks-paint',
    slot: 'marks',
    layers: pair([
      fl(
        blade(
          [
            [188, 146],
            [193, 149.5],
            [195.5, 155]
          ],
          [0, 2.2, 0]
        ),
        'accent'
      ),
      ...[154, 158.5, 163].map((y, i) =>
        fl(
          blade(
            [
              [180, y],
              [186, y + (i - 1) * 0.8],
              [193, y + (i - 1) * 2]
            ],
            [1.8, 1.4, 0]
          ),
          'accent'
        )
      )
    ])
  },
  {
    id: 'marks-bandage',
    slot: 'marks',
    layers: (() => {
      const r = smooth(
        place(
          [
            [-9, -3.6],
            [9, -3.6],
            [9, 3.6],
            [-9, 3.6]
          ],
          182,
          156,
          -22
        ),
        true,
        0.25
      )
      const pad = smooth(
        place(
          [
            [-3.4, -3.2],
            [3.4, -3.2],
            [3.4, 3.2],
            [-3.4, 3.2]
          ],
          182,
          156,
          -22
        ),
        true,
        0.25
      )
      return [
        ...cel(r, '#f3dcb8', { rim: [1.6, 1.4], sh: -0.14, line: 0.9, lineShade: -0.45 }),
        fl(pad, '#e7c79c'),
        ...place(
          [
            [-6.5, -1.4],
            [-6.5, 1.4],
            [6.5, -1.4],
            [6.5, 1.4]
          ],
          182,
          156,
          -22
        ).map((p) => fl(EL(p[0], p[1], 0.45), '#c9a47a'))
      ]
    })()
  },
  {
    id: 'marks-star',
    slot: 'marks',
    layers: [
      ...cel(star(136, 153, 3.6), 'accent', { shade: 0.1, rim: [0.8, 0.8], line: 0.8 }),
      fl(star(130.5, 147.5, 1.8, 0.6), 'accent', 0.4)
    ]
  }
]

// ═════════════════════════════════════════════════════════════════════════════
// FX — blush, tears, aging lines (all ride the head).
// ═════════════════════════════════════════════════════════════════════════════
const FX = {
  blush: [blushOval(140, 0.42), blushOval(180, 0.42), ...hatch(140, 153.5), ...hatch(180, 153.5)],
  tears: pair([
    {
      d: blade(
        [
          [181, 149.5],
          [182.6, 158],
          [183.2, 168],
          [182, 178]
        ],
        [2.4, 3.4, 2.8, 0]
      ),
      fill: '#9fd8ff',
      alpha: 0.85
    },
    ln(
      curve([
        [181.8, 154],
        [182.6, 163]
      ]),
      '#ffffff',
      0.9,
      0,
      0.8
    ),
    fl(EL(190.5, 146.4, 1.7, 2.2), '#bfe6ff', 0, 0.9)
  ]),
  aging: [
    ln('M 146 104 Q 160 101.5 174 104', 'skin', 0.9, -0.45, 0.6),
    ln('M 149 109 Q 160 107 171 109', 'skin', 0.9, -0.45, 0.5),
    ...pair([
      ln('M 192.5 136 L 197 134', 'skin', 0.8, -0.45, 0.7),
      ln('M 193 140 L 198 140.4', 'skin', 0.8, -0.45, 0.7),
      ln('M 192.5 144 L 196.6 146.4', 'skin', 0.8, -0.45, 0.7),
      ln('M 170 151.5 Q 178 154.5 186 151.5', 'skin', 0.8, -0.4, 0.6),
      ln('M 168.5 154 Q 172.5 159 170.5 165.5', 'skin', 0.9, -0.42, 0.65),
      ln('M 168 169.5 Q 170 173 169 176', 'skin', 0.8, -0.42, 0.5)
    ])
  ]
}

// ═════════════════════════════════════════════════════════════════════════════
// The pack
// ═════════════════════════════════════════════════════════════════════════════
const parts: StylePart[] = [
  ...BACKS,
  ...HEADS,
  ...HAIRS,
  ...EYES,
  ...BROWS,
  ...NOSES,
  ...MOUTHS,
  ...FACIAL,
  ...MARKS,
  ...TORSOS,
  ...LEGS,
  ...FEET,
  ...HEADWEAR,
  ...ACCESSORIES
]

export const animePack: StylePack = {
  id: 'anime',
  name: 'Anime',
  icon: 'flower-2',
  width: 320,
  height: 560,
  ink: INK,
  slots: [
    {
      id: 'back',
      icon: 'backpack',
      socket: { x: 160, y: 210 },
      z: 31,
      backZ: 2,
      optional: true,
      thumb: { cx: 160, cy: 250, span: 300 }
    },
    {
      id: 'head',
      icon: 'user-round',
      socket: { x: 160, y: 140 },
      z: 40,
      backZ: 26,
      thumb: { cx: 160, cy: 140, span: 130 }
    },
    {
      id: 'hair',
      icon: 'waves',
      socket: { x: 160, y: 96 },
      z: 60,
      backZ: 4,
      thumb: { cx: 160, cy: 170, span: 250 }
    },
    {
      id: 'eyes',
      icon: 'eye',
      socket: { x: 160, y: EYE_Y },
      z: 50,
      thumb: { cx: 160, cy: 140, span: 70 }
    },
    {
      id: 'brows',
      icon: 'spline',
      socket: { x: 160, y: BROW_Y },
      z: 61,
      thumb: { cx: 160, cy: 132, span: 70 }
    },
    {
      id: 'nose',
      icon: 'scan-face',
      socket: { x: 160, y: 152 },
      z: 45,
      optional: true,
      thumb: { cx: 160, cy: 150, span: 50 }
    },
    {
      id: 'mouth',
      icon: 'smile',
      socket: { x: 160, y: 165 },
      z: 51,
      thumb: { cx: 160, cy: 164, span: 44 }
    },
    {
      id: 'facialHair',
      icon: 'scissors',
      socket: { x: 160, y: 166 },
      z: 53,
      optional: true,
      thumb: { cx: 160, cy: 160, span: 90 }
    },
    {
      id: 'marks',
      icon: 'sparkles',
      socket: { x: 160, y: 146 },
      z: 42,
      optional: true,
      thumb: { cx: 160, cy: 145, span: 90 }
    },
    {
      id: 'torso',
      icon: 'shirt',
      socket: { x: 160, y: 240 },
      z: 30,
      backZ: 25,
      thumb: { cx: 160, cy: 270, span: 190 }
    },
    {
      id: 'legs',
      icon: 'person-standing',
      socket: { x: 160, y: 310 },
      z: 20,
      thumb: { cx: 160, cy: 415, span: 270 }
    },
    {
      id: 'feet',
      icon: 'footprints',
      socket: { x: 160, y: 530 },
      z: 22,
      thumb: { cx: 160, cy: 520, span: 80 }
    },
    {
      id: 'headwear',
      icon: 'crown',
      socket: { x: 160, y: 88 },
      z: 70,
      optional: true,
      thumb: { cx: 160, cy: 90, span: 170 }
    },
    {
      id: 'accessory',
      icon: 'glasses',
      socket: { x: 160, y: 140 },
      z: 65,
      optional: true,
      thumb: { cx: 160, cy: 160, span: 130 }
    }
  ],
  parts,
  paletteChannels: ['skin', 'hair', 'eyes', 'outfitA', 'outfitB', 'accent'],
  palettePresets: [
    {
      skin: '#fde6d8',
      hair: '#f0a6c0',
      eyes: '#7a5ad6',
      outfitA: '#2e3a6e',
      outfitB: '#f5f2ec',
      accent: '#e2455f'
    },
    {
      skin: '#f7dccb',
      hair: '#23233a',
      eyes: '#c23b4e',
      outfitA: '#1d1d28',
      outfitB: '#3b3450',
      accent: '#c9a24a'
    },
    {
      skin: '#f9dfcf',
      hair: '#9fd4f2',
      eyes: '#3a8fd8',
      outfitA: '#f3f6fb',
      outfitB: '#3d5a8a',
      accent: '#ffc94a'
    },
    {
      skin: '#eac09c',
      hair: '#f2c24a',
      eyes: '#3fae8c',
      outfitA: '#b6453a',
      outfitB: '#3a2f2a',
      accent: '#f2e1b8'
    },
    {
      skin: '#fff0e8',
      hair: '#dcdde8',
      eyes: '#d24f78',
      outfitA: '#4b3a78',
      outfitB: '#e9e6f2',
      accent: '#9ad1e8'
    },
    {
      skin: '#c98c64',
      hair: '#c8352e',
      eyes: '#e8a13a',
      outfitA: '#2d2a35',
      outfitB: '#7a2e2a',
      accent: '#f0b64a'
    },
    {
      skin: '#a86f4c',
      hair: '#2e5a44',
      eyes: '#7fc46a',
      outfitA: '#e8e0c8',
      outfitB: '#5a6b3a',
      accent: '#d4613c'
    },
    {
      skin: '#6b4330',
      hair: '#f3efe9',
      eyes: '#57c2d8',
      outfitA: '#1c3b5c',
      outfitB: '#d8d2c6',
      accent: '#e8c257'
    },
    {
      skin: '#4a2e22',
      hair: '#141018',
      eyes: '#d9a441',
      outfitA: '#7a2f8f',
      outfitB: '#221a2c',
      accent: '#f1d38a'
    },
    {
      skin: '#f3d2bb',
      hair: '#7fe0c8',
      eyes: '#2f9a8a',
      outfitA: '#fbfaf5',
      outfitB: '#2f6c73',
      accent: '#ff8fa3'
    },
    {
      skin: '#d9a37e',
      hair: '#6b3f2a',
      eyes: '#6a4a2e',
      outfitA: '#3a4f7a',
      outfitB: '#c7b89a',
      accent: '#e06a3a'
    }
  ],
  swatches: {
    skin: [
      '#fff0e8',
      '#fde6d8',
      '#f9dfcf',
      '#f3d2bb',
      '#eac09c',
      '#d9a37e',
      '#c98c64',
      '#a86f4c',
      '#8a5a3c',
      '#6b4330',
      '#4a2e22',
      '#c9e0f2'
    ],
    hair: [
      '#141018',
      '#23233a',
      '#4a3628',
      '#6b3f2a',
      '#a0703f',
      '#f2c24a',
      '#fff1c1',
      '#f3efe9',
      '#dcdde8',
      '#c8352e',
      '#f0a6c0',
      '#e25a8c',
      '#9fd4f2',
      '#3f6fd8',
      '#7fe0c8',
      '#2e5a44',
      '#9b7fe0',
      '#5a3a8a'
    ],
    eyes: [
      '#3a2a1e',
      '#6a4a2e',
      '#c23b4e',
      '#e8a13a',
      '#d9a441',
      '#3fae8c',
      '#7fc46a',
      '#3a8fd8',
      '#57c2d8',
      '#7a5ad6',
      '#d24f78',
      '#8f8fa3'
    ],
    outfitA: [
      '#2e3a6e',
      '#1d1d28',
      '#f3f6fb',
      '#b6453a',
      '#4b3a78',
      '#1c3b5c',
      '#7a2f8f',
      '#2f6c73',
      '#3a4f7a',
      '#e8e0c8',
      '#5a6b3a',
      '#c95f8a'
    ],
    outfitB: [
      '#f5f2ec',
      '#3b3450',
      '#3d5a8a',
      '#3a2f2a',
      '#e9e6f2',
      '#7a2e2a',
      '#d8d2c6',
      '#221a2c',
      '#c7b89a',
      '#2c4444',
      '#8a8fa3',
      '#f2c9d8'
    ],
    accent: [
      '#e2455f',
      '#c9a24a',
      '#ffc94a',
      '#f2e1b8',
      '#9ad1e8',
      '#f0b64a',
      '#d4613c',
      '#e8c257',
      '#f1d38a',
      '#ff8fa3',
      '#6c8ef5',
      '#4caf72'
    ]
  },
  defaults: {
    back: null,
    head: 'head-round',
    hair: 'hair-long',
    eyes: 'eyes-round',
    brows: 'brows-soft',
    nose: 'nose-small',
    mouth: 'mouth-smile',
    facialHair: null,
    marks: null,
    torso: 'torso-sailor',
    legs: 'legs-pleated',
    feet: 'feet-loafers',
    headwear: null,
    accessory: null
  },
  rig: {
    neck: { x: 160, y: 196 },
    hips: { x: 160, y: 294 },
    ground: { x: 160, y: GROUND },
    headSlots: [
      'head',
      'hair',
      'eyes',
      'brows',
      'nose',
      'mouth',
      'facialHair',
      'marks',
      'headwear',
      'accessory'
    ],
    buildSlots: ['torso', 'legs', 'feet', 'back'],
    legSlots: ['legs', 'feet']
  },
  portrait: { cx: 160, cy: 150, span: 172 },
  face: { cx: 160, cy: 138, span: 104 },
  fx: FX,
  greyHair: '#dcd8e0'
}
