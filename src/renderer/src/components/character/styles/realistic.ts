// The "Realistic" style pack — semi-realistic digital-painting portraits
// (think RPG character art). Natural ~7-head proportions in a 320×640
// character space. No outlines: form comes from gradients and low-alpha
// shading shapes, lit softly from the upper left. Every recolorable surface
// paints through the palette channels (with shade offsets), so any skin /
// hair / outfit color keeps its lighting.

import type { StyleLayer, StylePack, StylePart } from '../styleTypes'
import { E, RR, curve, flipX, mirrored, moveD, poly, smooth, sym, symPts, type Pt } from './pathKit'

// ── Paint helpers ─────────────────────────────────────────────────────────────
type Grad = NonNullable<StyleLayer['grad']>
type Stop = [number, string, number?, number?]
type L = StyleLayer

const lin = (x1: number, y1: number, x2: number, y2: number, stops: Stop[]): Grad => ({
  type: 'linear',
  x1,
  y1,
  x2,
  y2,
  stops
})
const rad = (cx: number, cy: number, r: number, stops: Stop[]): Grad => ({
  type: 'radial',
  cx,
  cy,
  r,
  stops
})

/** A soft round blob fading to transparent (fake blur). */
const blob = (
  cx: number,
  cy: number,
  r: number,
  paint: string,
  shade: number,
  alpha: number,
  extra: Partial<L> = {}
): L => ({
  d: E(cx, cy, r),
  grad: rad(cx, cy, r, [
    [0, paint, shade, alpha],
    [0.45, paint, shade, alpha * 0.6],
    [1, paint, shade, 0]
  ]),
  ...extra
})

/** Horizontal cylinder shading across [x0, x1] — lit from the left. */
const cyl = (paint: string, x0: number, x1: number, lo = -0.24, hi = 0.06, base = 0): Grad =>
  lin(x0, 0, x1, 0, [
    [0, paint, base + lo * 0.8],
    [0.22, paint, base + hi * 0.4],
    [0.4, paint, base + hi],
    [0.72, paint, base - 0.02],
    [1, paint, base + lo]
  ])

/** Vertical fade of one paint between two alphas. */
const fadeY = (
  y0: number,
  y1: number,
  paint: string,
  shade: number,
  a0: number,
  a1: number
): Grad =>
  lin(0, y0, 0, y1, [
    [0, paint, shade, a0],
    [1, paint, shade, a1]
  ])

const P = (p: Pt): string => `${Math.round(p[0] * 100) / 100} ${Math.round(p[1] * 100) / 100}`
/** Join open paths into one closed outline (later paths continue with L). */
const join = (...ds: string[]): string =>
  ds.map((d, i) => (i ? d.replace(/^M/, 'L') : d)).join(' ') + ' Z'
const add = (a: Pt, dx: number, dy: number): Pt => [a[0] + dx, a[1] + dy]
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
const mx = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [320 - x, y])

/** Many strand curves interpolated between hand-drawn guide polylines (all
 *  guides share a point count), as ONE multi-subpath string — cheap to paint. */
function strands(guides: Pt[][], perGap: number, seed = 1, trim = 0.12): string {
  let s = seed
  const rnd = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
  const out: string[] = []
  for (let g = 0; g < guides.length - 1; g++) {
    for (let k = 0; k < perGap; k++) {
      const t = (k + 0.25 + rnd() * 0.5) / perGap
      let pts = guides[g].map((p, i) => lerp(p, guides[g + 1][i], t))
      const a = rnd() * trim
      const b = rnd() * trim
      const n = pts.length
      pts = pts.map((p, i) => {
        if (i === 0) return lerp(p, pts[1], a * 2)
        if (i === n - 1) return lerp(p, pts[n - 2], b * 2)
        return p
      })
      out.push(curve(pts))
    }
  }
  return out.join(' ')
}

// ── Anatomy constants (character space 320×640, x-center 160) ────────────────
// Skull top 64 · hairline ~79 · brows ~96 · eyes 103 · nose base 120 ·
// mouth 128 · chin 142 · neck/torso 158 · waist 300 · crotch 378 · ground 620.
const EYE_Y = 103
const MOUTH_Y = 128.3

// ── Head ──────────────────────────────────────────────────────────────────────
interface HeadSpec {
  half: Pt[]
  /** Ear attachment x (right side). */
  earX: number
  neckW?: number
}

const NECK_HALF = (w: number): Pt[] => [
  [160, 116],
  [160 + w, 118],
  [160 + w, 136],
  [160 + w + 1, 150],
  [160 + w + 5, 158],
  [160 + w + 13, 164],
  [160 + w + 15, 174],
  [160, 176]
]

function headPart(id: string, h: HeadSpec): StylePart {
  const face = sym(h.half)
  const neckW = h.neckW ?? 15
  const neck = sym(NECK_HALF(neckW))
  const ex = h.earX
  const earR = smooth([
    [ex - 1.5, 97.5],
    [ex + 2.2, 94.8],
    [ex + 5.2, 96.6],
    [ex + 5.8, 103],
    [ex + 4.6, 110.5],
    [ex + 3, 117],
    [ex + 0.5, 121],
    [ex - 1.5, 119]
  ])
  const ears = earR + ' ' + flipX(earR)
  const helixR = curve([
    [ex + 0.5, 99],
    [ex + 3.2, 97.6],
    [ex + 4.2, 101.5],
    [ex + 3.5, 108],
    [ex + 2.2, 114]
  ])
  const helix = helixR + ' ' + flipX(helixR)
  const concha = E(ex + 1.9, 107, 1.8, 3.2) + ' ' + E(320 - ex - 1.9, 107, 1.8, 3.2)
  return {
    id,
    slot: 'head',
    back: [
      // Neck (behind the torso's collar)
      {
        d: neck,
        grad: cyl('skin', 160 - neckW - 2, 160 + neckW + 2, -0.34, 0.02, -0.08),
        mask: true
      },
      // Cast shadow of the jaw onto the neck (two passes = a soft edge)
      { d: moveD(face, 0, 5), fill: 'skin', shade: -0.42, alpha: 0.38, clip: true },
      { d: moveD(face, 0, 10), fill: 'skin', shade: -0.4, alpha: 0.22, clip: true },
      // Sternocleidomastoid + pit of the throat
      {
        d:
          curve([
            [160 + neckW - 3, 128],
            [166, 148],
            [162.5, 160]
          ]) +
          ' ' +
          curve([
            [160 - neckW + 3, 128],
            [154, 148],
            [157.5, 160]
          ]),
        stroke: 'skin',
        shade: -0.28,
        lineWidth: 2.4,
        alpha: 0.14,
        clip: true
      },
      blob(160, 162, 6, 'skin', -0.35, 0.45, { clip: true }),
      { d: neck, fill: '#c8745e', alpha: 0.16, blend: 'multiply', clip: true }
    ],
    layers: [
      // Ears
      {
        d: ears,
        grad: rad(160, 107, 36, [
          [0.7, 'skin', -0.05],
          [1, 'skin', -0.24]
        ]),
        mask: true
      },
      { d: concha, fill: 'skin', shade: -0.38, alpha: 0.5, clip: true },
      { d: helix, stroke: 'skin', shade: -0.36, lineWidth: 0.8, alpha: 0.6, clip: true },
      // Face
      {
        d: face,
        grad: rad(157, 95, 50, [
          [0, 'skin', 0.07],
          [0.5, 'skin', 0],
          [0.78, 'skin', -0.07],
          [1, 'skin', -0.26]
        ]),
        mask: true
      },
      // Key light from the upper left: the far (right) side falls into shadow
      {
        d: face,
        grad: lin(168, 0, 192, 0, [
          [0, 'skin', -0.3, 0],
          [1, 'skin', -0.3, 0.42]
        ]),
        clip: true
      },
      // Underside of the jaw
      { d: face, grad: fadeY(126, 143, 'skin', -0.3, 0, 0.38), clip: true },
      // Forehead + cheekbone + chin highlights
      blob(155, 82, 16, 'skin', 0.16, 0.34, { clip: true }),
      blob(140, 109, 8.5, 'skin', 0.2, 0.36, { clip: true }),
      blob(181, 109, 6.5, 'skin', 0.14, 0.2, { clip: true }),
      blob(159, 137.5, 5.5, 'skin', 0.18, 0.32, { clip: true }),
      // Eye sockets
      blob(148, 101.5, 10, 'skin', -0.32, 0.38, { clip: true }),
      blob(172, 101.5, 10, 'skin', -0.36, 0.44, { clip: true }),
      // Hollows under the cheekbones (far side deeper) + temples
      blob(181.5, 121, 8, 'skin', -0.3, 0.26, { clip: true }),
      blob(189, 92, 9, 'skin', -0.3, 0.3, { clip: true }),
      // Nasolabial softness (shadow side)
      blob(169, 124, 4.5, 'skin', -0.25, 0.2, { clip: true }),
      // Warm flush on the cheeks + warm (not grey) shadow at the edges
      blob(143, 114, 10, '#e0786a', 0, 0.15, { blend: 'multiply', clip: true }),
      blob(177, 114, 10, '#e0786a', 0, 0.15, { blend: 'multiply', clip: true }),
      {
        d: face,
        grad: rad(158, 100, 46, [
          [0.55, '#c8745e', 0, 0],
          [1, '#c8745e', 0, 0.3]
        ]),
        blend: 'multiply',
        clip: true
      }
    ]
  }
}

// ── Eyes ──────────────────────────────────────────────────────────────────────
interface EyeSpec {
  inner: Pt
  outer: Pt
  up1: Pt
  up2: Pt
  lo1: Pt
  lo2: Pt
  cx?: number
  cy?: number
  iris?: number
  pupil?: number
  /** Upper lash-line thickness at the outer corner. */
  lash?: number
  /** Lid crease height above the lash line (0 = none, e.g. monolids). */
  crease?: number
  creaseAlpha?: number
  lowerAlpha?: number
  /** Extra lid shadow on the eyeball (0..1). */
  lidShadow?: number
  sparkle?: boolean
  lashes?: boolean
}

const EYE_CX = 172.5

function eyeRight(s: EyeSpec): L[] {
  const cx = s.cx ?? EYE_CX
  const cy = s.cy ?? EYE_Y
  const r = s.iris ?? 2.7
  const pr = s.pupil ?? r * 0.42
  const lash = s.lash ?? 0.75
  const cr = s.crease ?? 2.4
  const white = `M ${P(s.inner)} C ${P(s.up1)} ${P(s.up2)} ${P(s.outer)} C ${P(s.lo2)} ${P(s.lo1)} ${P(s.inner)} Z`
  const lower = `M ${P(add(s.inner, 0.3, 0.1))} C ${P(add(s.lo1, 0, 0.35))} ${P(add(s.lo2, 0, 0.35))} ${P(add(s.outer, -0.4, 0.2))}`
  const flick = add(s.outer, 0.7, -lash * 0.75)
  const lashShape =
    `M ${P(add(s.inner, -0.2, 0))} C ${P(s.up1)} ${P(s.up2)} ${P(add(s.outer, 0.2, 0.05))} ` +
    `L ${P(flick)} L ${P(add(s.outer, -0.9, -lash))} ` +
    `C ${P(add(s.up2, 0, -lash * 1.05))} ${P(add(s.up1, 0, -lash * 0.45))} ${P(add(s.inner, 0.4, -0.35))} Z`
  const topY = Math.min(s.up1[1], s.up2[1])
  const layers: L[] = [
    // Eye white — soft off-white, shadowed toward the corners
    {
      d: white,
      grad: rad(cx - 0.6, cy - 0.2, 7.2, [
        [0, '#e9e2da'],
        [0.5, '#d9cec4'],
        [0.85, '#b6a196'],
        [1, '#8f766b']
      ]),
      mask: true
    },
    // Pink caruncle in the inner corner
    blob(s.inner[0] + 0.8, s.inner[1] - 0.1, 1.5, '#c98078', 0, 0.45, { clip: true }),
    // Iris: bright collarette, dark limbal ring
    {
      d: E(cx, cy, r),
      grad: rad(cx, cy, r, [
        [0, 'eyes', 0.34],
        [0.42, 'eyes', 0.14],
        [0.76, 'eyes', -0.1],
        [0.9, 'eyes', -0.48],
        [1, 'eyes', -0.72]
      ]),
      clip: true,
      track: 2
    },
    { d: E(cx, cy, pr), fill: '#0c0908', clip: true, track: 2 },
    // Shadow cast by the upper lid + lashes onto the eyeball
    {
      d: white,
      grad: lin(0, topY - 0.3, 0, topY + 3.2 + (s.lidShadow ?? 0) * 2, [
        [0, '#2a1a16', 0, 0.72],
        [1, '#2a1a16', 0, 0]
      ]),
      clip: true
    },
    // Catchlight(s)
    { d: E(cx - 0.9, cy - 1.05, 0.62), fill: '#ffffff', alpha: 0.95, clip: true, track: 1.6 },
    ...(s.sparkle
      ? [{ d: E(cx + 1.1, cy + 1.05, 0.34), fill: '#ffffff', alpha: 0.7, clip: true, track: 1.6 }]
      : []),
    // Lower lid rim + soft under-eye light
    { d: lower, stroke: 'skin', shade: -0.3, lineWidth: 0.5, alpha: s.lowerAlpha ?? 0.5 },
    // Upper lash line — heavier toward the outer corner
    { d: lashShape, fill: '#241815', alpha: 0.92 }
  ]
  if (cr > 0) {
    layers.push({
      d: `M ${P(add(s.inner, 1.2, -cr * 0.6))} C ${P(add(s.up1, 0.3, -cr))} ${P(add(s.up2, 0, -cr * 1.05))} ${P(add(s.outer, -0.8, -cr * 0.75))}`,
      stroke: 'skin',
      shade: -0.4,
      lineWidth: 0.55,
      alpha: s.creaseAlpha ?? 0.55
    })
  }
  if (s.lashes) {
    // A few distinct outer lashes
    const o = s.outer
    layers.push({
      d:
        `M ${P(add(o, -2.2, -lash * 0.9))} q 0.9 -0.8 1.6 -1.9 ` +
        `M ${P(add(o, -0.9, -lash))} q 1 -0.6 1.8 -1.5 ` +
        `M ${P(add(o, 0.4, -lash * 0.8))} q 1 -0.3 1.9 -0.9`,
      stroke: '#241815',
      lineWidth: 0.4,
      alpha: 0.85
    })
  }
  return layers
}

const eyePair = (s: EyeSpec): L[] => mirrored(eyeRight(s))

/** Default almond eye (right side), tweakable. */
const ALMOND: EyeSpec = {
  inner: [166.2, 103.7],
  outer: [179, 102.8],
  up1: [167.6, 100.5],
  up2: [175.4, 99.3],
  lo1: [168.4, 105.6],
  lo2: [176.4, 105.5]
}

/** A closed-eye lash line (arched up = laughing, flat = resting). */
function closedEyeRight(arch: number, crease: number): L[] {
  const a: Pt = [166.2, 103.6]
  const b: Pt = [179, 103]
  const c1: Pt = [169, 103.6 - arch]
  const c2: Pt = [175.5, 103.2 - arch]
  const line = `M ${P(a)} C ${P(c1)} ${P(c2)} ${P(b)}`
  const shape = `${line} L ${P(add(b, 1, -0.4))} C ${P(add(c2, 0, -0.8))} ${P(add(c1, 0, -0.6))} ${P(add(a, 0.4, -0.3))} Z`
  return [
    // Closed lid (skin, softly lit) covering the socket
    blob(172.5, 101.5 - arch * 0.3, 5.5, 'skin', 0.14, 0.3),
    { d: shape, fill: '#241815', alpha: 0.9 },
    {
      d: `M ${P(add(b, -1.5, 0.3))} q 0.6 1.2 1.2 1.6 M ${P(add(b, -3.6, 0.1 - arch * 0.3))} q 0.4 1.2 0.9 1.7`,
      stroke: '#241815',
      lineWidth: 0.4,
      alpha: 0.7
    },
    {
      d: `M ${P(add(a, 1.3, -crease * 0.6))} C ${P(add(c1, 0, -crease))} ${P(add(c2, 0, -crease))} ${P(add(b, -1, -crease * 0.7))}`,
      stroke: 'skin',
      shade: -0.38,
      lineWidth: 0.55,
      alpha: 0.5
    },
    // Cheek pushed up under the eye
    {
      d: curve([
        [167, 106.5 - arch * 0.2],
        [172.5, 107.6 - arch * 0.4],
        [178.5, 106]
      ]),
      stroke: 'skin',
      shade: -0.3,
      lineWidth: 0.5,
      alpha: 0.4
    }
  ]
}

// ── Brows ─────────────────────────────────────────────────────────────────────
/** Right brow from a spine (inner → tail) and per-point thickness. */
function browRight(spine: Pt[], thick: number[], hairs = 5): L[] {
  const top = spine.map((p, i) => add(p, 0, -thick[i] * 0.5))
  const bot = spine.map((p, i) => add(p, 0, thick[i] * 0.5)).reverse()
  const d = smooth([...top, ...bot], true, 0.85)
  const x0 = spine[0][0]
  const x1 = spine[spine.length - 1][0]
  // Hair strokes: the head of the brow grows upward, the body sweeps to the tail
  const strokesD: string[] = []
  for (let i = 0; i < hairs; i++) {
    const t = (i + 0.5) / hairs
    const idx = t * (spine.length - 1)
    const j = Math.min(spine.length - 2, Math.floor(idx))
    const p = lerp(spine[j], spine[j + 1], idx - j)
    const th = thick[j] + (thick[j + 1] - thick[j]) * (idx - j)
    const up = t < 0.2
    const a = add(p, up ? -0.3 : -1.2, th * 0.45)
    const b = add(p, up ? 0.4 : 1.8, -th * 0.45)
    strokesD.push(`M ${P(a)} L ${P(b)}`)
  }
  return [
    {
      d,
      grad: lin(x0, 0, x1, 0, [
        [0, 'hair', -0.18, 0.4],
        [0.28, 'hair', -0.28, 0.85],
        [0.75, 'hair', -0.32, 0.92],
        [1, 'hair', -0.32, 0.7]
      ])
    },
    { d: strokesD.join(' '), stroke: 'hair', shade: -0.5, lineWidth: 0.35, alpha: 0.55 },
    {
      d: curve(top.map((p) => add(p, 0.2, 0.5))),
      stroke: 'hair',
      shade: 0.1,
      lineWidth: 0.3,
      alpha: 0.3
    }
  ]
}

const browPart = (id: string, spine: Pt[], thick: number[], hairs = 5): StylePart => ({
  id,
  slot: 'brows',
  layers: mirrored(browRight(spine, thick, hairs))
})

// ── Nose ──────────────────────────────────────────────────────────────────────
interface NoseSpec {
  top?: number
  tipY: number
  tipR: number
  /** Half-width across the nostril wings. */
  wing: number
  baseY: number
  /** Extra bridge shading width. */
  bridge?: number
  hook?: number
}

function nosePart(id: string, n: NoseSpec): StylePart {
  const top = n.top ?? 99
  const w = n.wing
  const bw = n.bridge ?? 2.6
  const hook = n.hook ?? 0
  // Far-side (right) plane of the nose: shadowed
  const sideR = smooth(
    [
      [161.5, top + 1],
      [162.5 + bw * 0.4, top + 7],
      [163.5 + bw * 0.5, n.tipY - 3],
      [160 + w * 0.8, n.baseY - 2.5],
      [160 + n.tipR * 0.9, n.tipY - 0.5],
      [161.8, top + 9]
    ],
    true,
    0.9
  )
  const sideL = flipX(sideR)
  const wingR = curve([
    [160 + n.tipR * 0.85, n.tipY - 2],
    [160 + w - 0.4, n.baseY - 3.4],
    [160 + w + 0.1, n.baseY - 1.3],
    [160 + w - 1.1, n.baseY + 0.1]
  ])
  const nostR = smooth([
    [161.3, n.baseY - 0.3],
    [163.2, n.baseY - 1.4],
    [160 + w - 1.8, n.baseY - 0.9],
    [160 + w - 2.6, n.baseY + 0.2],
    [162.5, n.baseY + 0.35]
  ])
  return {
    id,
    slot: 'nose',
    layers: [
      // Bridge side planes (shadow side deeper)
      {
        d: sideR,
        grad: lin(160, 0, 160 + w + 1, 0, [
          [0, 'skin', -0.34, 0],
          [0.4, 'skin', -0.34, 0.26],
          [1, 'skin', -0.34, 0]
        ])
      },
      {
        d: sideL,
        grad: lin(160, 0, 160 - w - 1, 0, [
          [0, 'skin', -0.3, 0],
          [0.4, 'skin', -0.3, 0.12],
          [1, 'skin', -0.3, 0]
        ])
      },
      // Soft ball of the tip + warm tint
      blob(160 + hook * 0.3, n.tipY, n.tipR + 1.2, '#dc7c70', 0, 0.16, { blend: 'multiply' }),
      // Shadow cast under the nose onto the upper lip
      blob(160.6, n.baseY + 2.4, 5.5, 'skin', -0.36, 0.34),
      // Wings + nostrils
      {
        d: wingR + ' ' + flipX(wingR),
        stroke: 'skin',
        shade: -0.36,
        lineWidth: 0.6,
        alpha: 0.32
      },
      blob(160 + w - 1.2, n.baseY - 2, 2.6, 'skin', -0.3, 0.3),
      { d: nostR + ' ' + flipX(nostR), fill: 'skin', shade: -0.6, alpha: 0.55 },
      // Under-tip shadow (the columella) and highlights
      {
        d: E(160, n.baseY - 0.6, n.tipR * 0.7, 1),
        fill: 'skin',
        shade: -0.32,
        alpha: 0.35
      },
      {
        d: smooth([
          [159.6, top + 2],
          [160.3, top + 2],
          [160.6 + hook * 0.2, n.tipY - 3],
          [159.2 + hook * 0.2, n.tipY - 3]
        ]),
        grad: fadeY(top + 1, n.tipY - 2, 'skin', 0.3, 0.05, 0.45)
      },
      blob(159.4 + hook * 0.3, n.tipY - 0.8, n.tipR * 0.6, 'skin', 0.4, 0.55)
    ]
  }
}

// ── Mouth ─────────────────────────────────────────────────────────────────────
interface MouthSpec {
  w?: number
  cy?: number
  /** Corner lift (smile +, frown −). */
  smile?: number
  /** −1..1: which corner lifts more (smirk). */
  asym?: number
  upH?: number
  loH?: number
  /** Parted lips: opening height (0 = closed). */
  open?: number
  teeth?: boolean
  tongue?: boolean
  lowerTeeth?: boolean
  /** Round "o" opening. */
  round?: boolean
}

function mouthPart(id: string, m: MouthSpec): StylePart {
  const w = m.w ?? 9.6
  const cy = m.cy ?? MOUTH_Y
  const sm = m.smile ?? 0
  const as = m.asym ?? 0
  const upH = m.upH ?? 2.9
  const loH = m.loH ?? 3.6
  const op = m.open ?? 0
  const Lc: Pt = [160 - w, cy - sm * (1 - as)]
  const Rc: Pt = [160 + w, cy - sm * (1 + as)]
  const midSag = sm * 0.18
  // Stomion (the line where the lips meet); when open, split into two edges
  const stoUp: Pt[] = [
    Lc,
    [160 - w * 0.55, cy - sm * 0.35 * (1 - as) + midSag - op * 0.35],
    [160, cy + 0.25 + midSag - op * 0.45],
    [160 + w * 0.55, cy - sm * 0.35 * (1 + as) + midSag - op * 0.35],
    Rc
  ]
  const stoLo: Pt[] = [
    Lc,
    [160 - w * 0.55, cy - sm * 0.35 * (1 - as) + midSag + op * 0.75],
    [160, cy + 0.25 + midSag + op],
    [160 + w * 0.55, cy - sm * 0.35 * (1 + as) + midSag + op * 0.75],
    Rc
  ]
  const upTop: Pt[] = [
    Lc,
    [160 - w * 0.62, cy - upH * 0.55 - sm * 0.55 * (1 - as) - op * 0.35],
    [157.6, cy - upH - op * 0.4],
    [160, cy - upH + 0.75 - op * 0.4],
    [162.4, cy - upH - op * 0.4],
    [160 + w * 0.62, cy - upH * 0.55 - sm * 0.55 * (1 + as) - op * 0.35],
    Rc
  ]
  const loBot: Pt[] = [
    Rc,
    [160 + w * 0.55, cy + loH * 0.8 - sm * 0.25 * (1 + as) + op * 0.9],
    [160, cy + loH + op],
    [160 - w * 0.55, cy + loH * 0.8 - sm * 0.25 * (1 - as) + op * 0.9],
    Lc
  ]
  if (m.round) {
    // "o": a small rounded opening ringed by pursed lips
    const oy = cy + 1
    const ow = 4.2
    const oh = 4.6
    const ring = sym([
      [160, oy - oh - 2.6],
      [163.5, oy - oh - 2.2],
      [167, oy - 2],
      [166.5, oy + 2.5],
      [163.5, oy + oh + 2.2],
      [160, oy + oh + 3]
    ])
    const hole = E(160, oy + 0.3, ow, oh)
    return {
      id,
      slot: 'mouth',
      layers: [
        {
          d: ring,
          grad: fadeY(oy - oh - 3, oy + oh + 3, 'skin', -0.26, 1, 1),
          alpha: 0.95
        },
        { d: ring, fill: '#c56e6a', alpha: 0.45, blend: 'multiply' },
        {
          d: hole,
          grad: rad(160, oy + 1.5, oh + 1, [
            [0, '#1a0c0c'],
            [0.7, '#2f1414'],
            [1, '#4a2020']
          ]),
          mask: true
        },
        { d: E(160, oy - oh + 0.6, 3, 1.5), fill: '#e9e2d8', alpha: 0.85, clip: true },
        { d: E(160, oy + oh + 0.8, 3.6, 2.4), fill: '#9c4a4e', alpha: 0.75, clip: true },
        blob(160.5, oy + oh + 2.4, 2.2, 'skin', 0.35, 0.45),
        blob(160, oy + oh + 5.6, 5, 'skin', -0.3, 0.3),
        {
          d: `M 158.2 ${cy - 7.3} Q 158.6 ${cy - 5.5} 157.8 ${cy - 4.5} M 161.8 ${cy - 7.3} Q 161.4 ${cy - 5.5} 162.2 ${cy - 4.5}`,
          stroke: 'skin',
          shade: -0.2,
          lineWidth: 0.6,
          alpha: 0.3
        }
      ]
    }
  }
  const upper = join(curve(upTop), curve([...stoUp].reverse()))
  const lowerLip = join(curve(stoLo), curve(loBot))
  const layers: L[] = [
    // Philtrum hint + shadow under the lower lip
    {
      d: `M 158.1 ${cy - 7.4} Q 158.5 ${cy - 5.4} 157.7 ${cy - upH - 0.3} M 161.9 ${cy - 7.4} Q 161.5 ${cy - 5.4} 162.3 ${cy - upH - 0.3}`,
      stroke: 'skin',
      shade: -0.2,
      lineWidth: 0.6,
      alpha: 0.28
    },
    blob(160, cy + loH + op + 2.6, 6, 'skin', -0.32, 0.34)
  ]
  if (op > 0) {
    const cavity = join(curve(stoUp), curve([...stoLo].reverse()))
    layers.push({
      d: cavity,
      grad: rad(160, cy + op * 0.5, w, [
        [0, '#2a1212'],
        [0.7, '#3a1818'],
        [1, '#5a2a28']
      ]),
      mask: true
    })
    if (m.tongue) {
      layers.push({
        d: E(160, cy + op * 0.95, w * 0.62, op * 0.55),
        grad: rad(159, cy + op * 0.8, w * 0.7, [
          [0, '#c86a6c'],
          [1, '#8a3a40']
        ]),
        clip: true
      })
    }
    if (m.teeth) {
      const tTop = cy - op * 0.45 - 1
      const teethD = smooth([
        [160 - w * 0.86, tTop + 1.6],
        [160, tTop - 0.4],
        [160 + w * 0.86, tTop + 1.6],
        [160 + w * 0.7, tTop + 2.6 + op * 0.35],
        [160, tTop + 3.2 + op * 0.4],
        [160 - w * 0.7, tTop + 2.6 + op * 0.35]
      ])
      layers.push({
        d: teethD,
        grad: lin(160 - w, 0, 160 + w, 0, [
          [0, '#8f8176'],
          [0.25, '#e2dace'],
          [0.45, '#f4efe6'],
          [0.75, '#ddd3c6'],
          [1, '#8a7c72']
        ]),
        clip: true
      })
      layers.push({
        d: `M 160 ${tTop} L 160 ${tTop + 3.5 + op * 0.3} M 156.2 ${tTop + 0.3} L 156 ${tTop + 3.2 + op * 0.3} M 163.8 ${tTop + 0.3} L 164 ${tTop + 3.2 + op * 0.3}`,
        stroke: '#9d8d80',
        lineWidth: 0.3,
        alpha: 0.55,
        clip: true
      })
    }
    if (m.lowerTeeth) {
      layers.push({
        d: E(160, cy + op * 1.35 + 0.5, w * 0.55, 1.4),
        fill: '#d9cfc2',
        alpha: 0.85,
        clip: true
      })
    }
  }
  layers.push(
    // Lips: skin-derived base, then a warm multiply tint (works on every tone)
    { d: upper, grad: fadeY(cy - upH, cy, 'skin', -0.3, 1, 1) },
    {
      d: lowerLip,
      grad: lin(0, cy + op * 0.5, 0, cy + loH + op, [
        [0, 'skin', -0.26],
        [1, 'skin', -0.14]
      ])
    },
    { d: upper + ' ' + lowerLip, fill: '#c9706a', alpha: 0.42, blend: 'multiply' },
    // Lower-lip sheen + vermilion border light
    blob(160.8, cy + op + loH * 0.45, loH * 0.95, 'skin', 0.32, 0.5),
    {
      d: curve(upTop.slice(1, -1).map((p) => add(p, 0, -0.35))),
      stroke: 'skin',
      shade: 0.22,
      lineWidth: 0.5,
      alpha: 0.35
    }
  )
  if (op <= 0) {
    layers.push({
      d: curve(stoUp),
      stroke: '#3a201e',
      lineWidth: 0.6,
      alpha: 0.62
    })
  } else {
    layers.push({
      d: curve(stoUp) + ' ' + curve(stoLo),
      stroke: '#3a201e',
      lineWidth: 0.35,
      alpha: 0.35
    })
  }
  // Mouth-corner shadows (a smile deepens them into cheek creases)
  layers.push(
    blob(Lc[0] + 0.4, Lc[1] + 0.1, 1.3, 'skin', -0.5, 0.5),
    blob(Rc[0] - 0.4, Rc[1] + 0.1, 1.3, 'skin', -0.5, 0.5)
  )
  if (sm > 0.6) {
    const crease = (c: Pt, dir: number, k: number) =>
      `M ${P(add(c, -dir * 0.4, -2.2 * k))} Q ${P(add(c, dir * 1.6, -0.2))} ${P(add(c, dir * 0.4, 2 * k))}`
    layers.push({
      d: crease(Lc, -1, (sm * (1 - as)) / 2) + ' ' + crease(Rc, 1, (sm * (1 + as)) / 2),
      stroke: 'skin',
      shade: -0.35,
      lineWidth: 0.55,
      alpha: 0.45
    })
  }
  return { id, slot: 'mouth', layers }
}

// ── Hair ──────────────────────────────────────────────────────────────────────
type Flow = Pt[][]
interface HairSpec {
  /** Front mass (over the face) as a full closed outline. */
  front: string
  /** Strand-flow guide sets for the front mass (each set: guides sharing a
   *  point count; strands interpolate between neighbours). */
  flow: Flow[]
  flowN?: number
  /** Sheen band shape (clipped into the mass). */
  sheen?: string
  sheenAt?: Pt
  /** Behind-the-body mass. */
  back?: string
  backFlow?: Flow[]
  backBot?: number
  /** Loose front locks (over the shoulders), swaying. */
  curtains?: string
  curtainFlow?: Flow[]
  curtainSheen?: string
  sway?: number
  /** Hairline points for the soft shadow the hair casts on the forehead. */
  shadowLine?: Pt[]
  topY?: number
  botY?: number
  /** Wispy flyaways (open curves, drawn unclipped). */
  wisps?: string
  extraFront?: L[]
  extraBack?: L[]
  /** Drawn last, above curtains (braids, ties). */
  topLayers?: L[]
  frontAlpha?: number
  backAlpha?: number
}

const hairGrad = (y0: number, y1: number, base = 0): Grad =>
  lin(0, y0, 0, y1, [
    [0, 'hair', base + 0.12],
    [0.3, 'hair', base + 0.03],
    [1, 'hair', base - 0.32]
  ])

const flowD = (sets: Flow[], n: number, seed: number): string =>
  sets.map((g, i) => strands(g, n, seed + i * 7)).join(' ')

/** Three strand passes: broad dark clump separations, fine dark strands,
 *  fine light strands (offset so they sit on the clump tops). */
function strandLayers(d: string, sway?: number, k = 1): L[] {
  const s = sway ? { sway } : {}
  return [
    { d, stroke: 'hair', shade: -0.34, lineWidth: 1.8 * k, alpha: 0.13, clip: true, ...s },
    {
      d: moveD(d, 0.5, 0.2),
      stroke: 'hair',
      shade: -0.42,
      lineWidth: 0.4 * k,
      alpha: 0.3,
      clip: true,
      ...s
    },
    {
      d: moveD(d, 1.5, 0.4),
      stroke: 'hair',
      shade: 0.3,
      lineWidth: 0.4 * k,
      alpha: 0.24,
      clip: true,
      ...s
    }
  ]
}

const sheenLayer = (d: string, at: Pt, r = 26, sway?: number): L => ({
  d,
  grad: rad(at[0], at[1], r, [
    [0, 'hair', 0.42, 0.5],
    [0.55, 'hair', 0.36, 0.22],
    [1, 'hair', 0.3, 0]
  ]),
  clip: true,
  ...(sway ? { sway } : {})
})

function hairPart(id: string, h: HairSpec): StylePart {
  const y0 = h.topY ?? 54
  const y1 = h.botY ?? 130
  const layers: L[] = []
  layers.push({
    d: h.front,
    grad: hairGrad(y0, y1),
    mask: true,
    ...(h.frontAlpha ? { alpha: h.frontAlpha } : {})
  })
  if (h.shadowLine) {
    // Denser, darker hair at the roots along the hairline
    layers.push({
      d: curve(h.shadowLine),
      stroke: 'hair',
      shade: -0.4,
      lineWidth: 3,
      alpha: 0.35,
      clip: true
    })
  }
  if (h.flow.length) layers.push(...strandLayers(flowD(h.flow, h.flowN ?? 6, 3)))
  if (h.sheen) layers.push(sheenLayer(h.sheen, h.sheenAt ?? [156, 64]))
  if (h.extraFront) layers.push(...h.extraFront)
  if (h.curtains) {
    const sw = h.sway ?? 1.6
    layers.push({ d: h.curtains, grad: hairGrad(40, 262, -0.06), mask: true, sway: sw })
    if (h.curtainFlow) layers.push(...strandLayers(flowD(h.curtainFlow, 6, 9), sw))
    if (h.curtainSheen) layers.push(sheenLayer(h.curtainSheen, [150, 120], 60, sw))
  }
  if (h.wisps) {
    layers.push({ d: h.wisps, stroke: 'hair', shade: 0.05, lineWidth: 0.4, alpha: 0.45 })
  }
  if (h.topLayers) layers.push(...h.topLayers)
  const back: L[] = []
  if (h.back) {
    const sw = h.sway ? { sway: h.sway * 0.7 } : {}
    back.push({
      d: h.back,
      grad: hairGrad(y0, h.backBot ?? 280, -0.18),
      mask: true,
      ...sw,
      ...(h.backAlpha ? { alpha: h.backAlpha } : {})
    })
    if (h.backFlow) {
      back.push({
        d: flowD(h.backFlow, 6, 5),
        stroke: 'hair',
        shade: -0.5,
        lineWidth: 0.9,
        alpha: 0.3,
        clip: true,
        ...sw
      })
      back.push({
        d: moveD(flowD(h.backFlow, 6, 5), 1.6, 0),
        stroke: 'hair',
        shade: 0.2,
        lineWidth: 0.5,
        alpha: 0.22,
        clip: true,
        ...sw
      })
    }
    if (h.extraBack) back.push(...h.extraBack)
  }
  return back.length ? { id, slot: 'hair', back, layers } : { id, slot: 'hair', layers }
}

/** Mirror a flow guide set across the center. */
const mxFlow = (f: Flow): Flow => f.map(mx)

/** Clumpy silhouette: between each pair of points insert a midpoint pushed
 *  outward from `c` by a varying amount (hair never has a clean edge). */
function tuft(pts: Pt[], c: Pt, amp: number, seed = 1): Pt[] {
  let s = seed
  const rnd = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
  const out: Pt[] = []
  for (let i = 0; i < pts.length; i++) {
    out.push(pts[i])
    if (i === pts.length - 1) break
    const m = lerp(pts[i], pts[i + 1], 0.5)
    const dx = m[0] - c[0]
    const dy = m[1] - c[1]
    const len = Math.hypot(dx, dy) || 1
    const k = amp * (0.35 + rnd())
    out.push([m[0] + (dx / len) * k, m[1] + (dy / len) * k])
  }
  return out
}

/** A hair mass from its outer silhouette (RIGHT half, crown → lowest outer
 *  point) and hairline (RIGHT half, lowest → forehead center), mirrored. */
function hairMass(outerR: Pt[], hairlineR: Pt[], amp = 1, seed = 3, tension = 0.95): string {
  const outer = [...mx(outerR).reverse(), ...outerR.slice(1)]
  const hairline = [...hairlineR, ...mx(hairlineR).reverse().slice(1)]
  return smooth([...tuft(outer, [160, 92], amp, seed), ...hairline], true, tension)
}

// ── Body kit (torso + arms + hands) ───────────────────────────────────────────
// Right arm (viewer's right) profile; the left is mirrored.
const ARM_Y = [164, 172, 186, 210, 245, 280, 292, 305, 330, 361]
const ARM_OUT = [212, 223.5, 229.5, 231.5, 231, 230.5, 231, 233, 232.5, 230]
const ARM_IN = [204, 204.5, 205.5, 206.5, 206.8, 208, 208.5, 209.8, 211.2, 213]

function armAt(y: number): [number, number] {
  for (let i = 0; i < ARM_Y.length - 1; i++) {
    if (y <= ARM_Y[i + 1]) {
      const t = Math.max(0, (y - ARM_Y[i]) / (ARM_Y[i + 1] - ARM_Y[i]))
      return [
        ARM_OUT[i] + (ARM_OUT[i + 1] - ARM_OUT[i]) * t,
        ARM_IN[i] + (ARM_IN[i + 1] - ARM_IN[i]) * t
      ]
    }
  }
  return [ARM_OUT[ARM_OUT.length - 1], ARM_IN[ARM_IN.length - 1]]
}

/** Right-arm band between y0 and y1 (grown by `g` each side — sleeves are
 *  looser than the arm). `cap` = start at the shoulder seam. */
function armBand(y0: number, y1: number, g = 0, cap = false, flare = 0): string {
  const ys = [y0, ...ARM_Y.filter((y) => y > y0 + 2 && y < y1 - 2), y1]
  const outer: Pt[] = ys.map((y, i) => {
    const e = i === ys.length - 1 ? flare : 0
    return [armAt(y)[0] + g + e, y]
  })
  const inner: Pt[] = ys
    .map((y, i): Pt => {
      const e = i === ys.length - 1 ? flare : 0
      return [armAt(y)[1] - g - e, y]
    })
    .reverse()
  const [o1, i1] = armAt(y1)
  const hem: Pt = [(o1 + i1) / 2, y1 + 1.2]
  if (cap) {
    const top: Pt[] = [
      [197, 158.6],
      [208.5, 162.8],
      [218.5 + g * 0.4, 167.5]
    ]
    const innerTrim = inner.filter((p) => p[1] > 200)
    return smooth(
      [...top, ...outer.slice(1), hem, ...innerTrim, [205.5 - g, 188], [201, 168]],
      true,
      0.9
    )
  }
  return smooth([...outer, hem, ...inner], true, 0.9)
}

const armGrad = (paint: string, shade = 0): Grad =>
  lin(202, 0, 235, 0, [
    [0, paint, shade - 0.12],
    [0.3, paint, shade + 0.06],
    [0.62, paint, shade + 0.01],
    [1, paint, shade - 0.28]
  ])

/** Right hand hanging relaxed at the side (thumb forward). */
const HAND_R = smooth([
  [213.8, 356],
  [211.2, 367],
  [209.8, 380],
  [210.4, 392],
  [213, 400.5],
  [216, 408.5],
  [218.8, 416.5],
  [222.3, 421.8],
  [226.6, 422.6],
  [230, 418.2],
  [232.2, 406],
  [232.8, 390],
  [231.6, 372],
  [230.2, 357]
])

function handsLayers(paint = 'skin', shade = 0): L[] {
  const skin = paint === 'skin'
  return mirrored([
    { d: HAND_R, grad: cyl(paint, 209, 234, -0.28, 0.08, shade - 0.02), mask: true },
    {
      d: HAND_R,
      grad: fadeY(386, 423, skin ? '#b8604e' : paint, skin ? 0 : shade - 0.3, 0, skin ? 0.3 : 0.4),
      clip: true
    },
    {
      d:
        curve([
          [215.6, 377],
          [214.2, 389],
          [215.4, 399]
        ]) +
        ' ' +
        curve([
          [220.5, 399],
          [221.3, 410],
          [222.8, 418]
        ]) +
        ' ' +
        curve([
          [225.6, 398],
          [226.4, 409],
          [227.2, 417]
        ]) +
        ' ' +
        `M 213.5 399 Q 215 401 217 400`,
      stroke: paint,
      shade: shade - 0.42,
      lineWidth: 0.6,
      alpha: 0.5,
      clip: true
    }
  ])
}

/** Bare right forearm/arm skin from y0 to the wrist (under sleeves). */
const armSkinR = (y0: number, cap = false): L[] => [
  { d: armBand(y0, 362, 0, cap), grad: armGrad('skin', -0.02) },
  {
    d: curve([
      [209.5, 286],
      [212, 289],
      [214.5, 289.5]
    ]),
    stroke: 'skin',
    shade: -0.35,
    lineWidth: 0.7,
    alpha: 0.35
  }
]

/** A sleeve over the right arm from the shoulder to `y1`. */
function sleeveR(y1: number, paint: string, g = 2.2, flare = 1.5, shade = 0, folds = ''): L[] {
  const d = armBand(164, y1, g, true, flare)
  return [
    { d, grad: armGrad(paint, shade), mask: true },
    { d, grad: fadeY(y1 - 10, y1 + 2, paint, -0.35, 0, 0.35), clip: true },
    {
      d:
        curve([
          [208, 170],
          [206.5, 186],
          [206.5, 204]
        ]) +
        ' ' +
        curve([
          [212, Math.min(y1 - 8, 250)],
          [220, Math.min(y1 - 10, 246)],
          [228, Math.min(y1 - 16, 238)]
        ]) +
        (folds ? ' ' + folds : ''),
      stroke: paint,
      shade: shade - 0.4,
      lineWidth: 0.8,
      alpha: 0.28,
      clip: true
    }
  ]
}

/** Torso trunk outline (right half for sym), from the neckline front center. */
const trunkHalf = (neckY: number, hemY: number, flare = 0): Pt[] => [
  [160, neckY],
  [169, neckY - 1.8],
  [176.5, 154],
  [192, 158],
  [208, 163],
  [219, 169],
  [224, 180],
  [221, 210],
  [213, 240],
  [207.5, 268],
  [206.5, 292],
  [209 + flare * 0.4, 312],
  [213 + flare, hemY - 2],
  [192 + flare * 0.5, hemY + 0.5],
  [160, hemY + 1]
]

/** Standard fabric shading clipped into a trunk mask. */
function trunkShade(paint: string, hemY: number, shade = 0): L[] {
  return [
    blob(210, 210, 20, paint, shade - 0.4, 0.45, { clip: true }),
    {
      d: RR(80, 148, 160, hemY - 146, 0),
      grad: lin(0, 150, 0, hemY + 2, [
        [0, paint, shade + 0.18, 0.35],
        [Math.min(0.3, 26 / (hemY - 148)), paint, shade + 0.18, 0],
        [1 - 24 / (hemY - 148), paint, shade - 0.35, 0],
        [1, paint, shade - 0.35, 0.35]
      ]),
      clip: true
    }
  ]
}

// ── Legs / feet kit ───────────────────────────────────────────────────────────
/** Pants/trousers outline (right half for sym) down to hemY. */
const pantsHalf = (hemY: number, hemIn: number, hemOut: number, looseKnee = 0): Pt[] => [
  [160, 296],
  [186, 295.5],
  [206, 297],
  [212, 318],
  [217.5, 345],
  [218.5, 372],
  [215.5 + looseKnee * 0.5, 412],
  [210 + looseKnee, 452],
  [206.5 + looseKnee, 490],
  [206 + looseKnee * 0.6, 524],
  [hemOut + 1, (524 + hemY) / 2],
  [hemOut, hemY],
  [(hemIn + hemOut) / 2, hemY + 1.5],
  [hemIn, hemY],
  [hemIn - 0.5, (524 + hemY) / 2],
  [168.5 - looseKnee * 0.5, 524],
  [167.5 - looseKnee * 0.6, 490],
  [165.5, 452],
  [163, 414],
  [161, 384],
  [160, 381]
]

const legsGrad = (paint: string, shade = 0): Grad =>
  lin(100, 0, 220, 0, [
    [0, paint, shade - 0.26],
    [0.1, paint, shade - 0.02],
    [0.26, paint, shade + 0.06],
    [0.44, paint, shade - 0.16],
    [0.5, paint, shade - 0.28],
    [0.56, paint, shade - 0.14],
    [0.72, paint, shade + 0.03],
    [0.88, paint, shade - 0.04],
    [1, paint, shade - 0.3]
  ])

/** Bare right leg (skin) from y0 to the ankle. */
const LEG_R = smooth([
  [163, 300],
  [206, 300],
  [214, 330],
  [214.5, 372],
  [210, 420],
  [203.5, 468],
  [202, 492],
  [204.5, 522],
  [202, 560],
  [197, 598],
  [186, 604],
  [175.5, 599],
  [172.5, 560],
  [170, 522],
  [170.5, 492],
  [168.5, 460],
  [163.5, 416],
  [161, 384]
])

function legsSkin(): L[] {
  return mirrored([
    { d: LEG_R, grad: cyl('skin', 160, 216, -0.28, 0.06, -0.03), mask: true },
    blob(186, 490, 9, 'skin', 0.16, 0.3, { clip: true }),
    {
      d: curve([
        [180, 497],
        [186, 500.5],
        [193, 497]
      ]),
      stroke: 'skin',
      shade: -0.35,
      lineWidth: 0.7,
      alpha: 0.35,
      clip: true
    }
  ])
}

// ── Parts ─────────────────────────────────────────────────────────────────────
const parts: StylePart[] = []

// Heads — face outlines (right half from the crown to the chin)
parts.push(
  headPart('head-oval', {
    half: [
      [160, 64],
      [175, 65.5],
      [185.5, 72],
      [189.5, 84],
      [190, 96],
      [188.5, 108],
      [185, 119],
      [179, 129],
      [171, 137.5],
      [164.5, 141.4],
      [160, 142]
    ],
    earX: 188
  }),
  headPart('head-round', {
    half: [
      [160, 64],
      [176, 65.5],
      [187, 72],
      [191, 84],
      [192, 97],
      [191.5, 109],
      [188.5, 120],
      [182.5, 130],
      [173.5, 138],
      [165.5, 141.6],
      [160, 142]
    ],
    earX: 189.5,
    neckW: 17.5
  }),
  headPart('head-slim', {
    half: [
      [160, 63],
      [174, 64.5],
      [183.5, 71],
      [187, 83],
      [187.5, 96],
      [186, 108],
      [183, 119],
      [177.5, 130],
      [170, 139],
      [164, 143.5],
      [160, 144]
    ],
    earX: 185.5,
    neckW: 15.5
  }),
  headPart('head-soft', {
    half: [
      [160, 64],
      [175, 65.5],
      [185.5, 72],
      [189, 84],
      [189.5, 96],
      [188, 107],
      [184, 118],
      [177, 128.5],
      [169, 136.5],
      [163.5, 140.5],
      [160, 141]
    ],
    earX: 187.5,
    neckW: 15
  }),
  headPart('head-square', {
    half: [
      [160, 63.5],
      [176, 65],
      [186.5, 71.5],
      [190, 83],
      [190.5, 96],
      [190, 108],
      [189.5, 118],
      [188.5, 126.5],
      [185, 132.5],
      [176, 138.5],
      [166.5, 142],
      [160, 142.5]
    ],
    earX: 188.5,
    neckW: 18.5
  }),
  headPart('head-heart', {
    half: [
      [160, 64],
      [176, 65.5],
      [187, 72],
      [191, 84],
      [191.5, 96],
      [190, 106],
      [185.5, 117],
      [178, 127.5],
      [169.5, 136],
      [163, 141],
      [160, 142]
    ],
    earX: 189,
    neckW: 15
  }),
  headPart('head-diamond', {
    half: [
      [160, 64],
      [173, 65.5],
      [182.5, 72],
      [187, 84],
      [190.5, 98],
      [191, 108],
      [187, 119],
      [180, 129],
      [171, 137.5],
      [164.5, 141.4],
      [160, 142]
    ],
    earX: 188.5
  })
)

// Eyes
parts.push(
  { id: 'eyes-round', slot: 'eyes', layers: eyePair(ALMOND) },
  {
    id: 'eyes-spark',
    slot: 'eyes',
    layers: eyePair({
      ...ALMOND,
      up1: [167.4, 100.1],
      up2: [175.4, 98.9],
      lo1: [168.4, 105.9],
      lo2: [176.6, 105.8],
      iris: 2.85,
      lash: 1.25,
      sparkle: true,
      lashes: true
    })
  },
  {
    id: 'eyes-sharp',
    slot: 'eyes',
    layers: eyePair({
      inner: [166.4, 103.2],
      outer: [179.2, 102.2],
      up1: [168.2, 101.6],
      up2: [175.6, 100.4],
      lo1: [168.6, 105],
      lo2: [176.4, 104.9],
      iris: 2.6,
      lash: 1.1,
      crease: 1.8,
      creaseAlpha: 0.65,
      lidShadow: 0.6
    })
  },
  {
    id: 'eyes-sleepy',
    slot: 'eyes',
    layers: eyePair({
      inner: [166.2, 103.9],
      outer: [179, 103.4],
      up1: [168, 102.2],
      up2: [175.8, 101.6],
      lo1: [168.4, 105.6],
      lo2: [176.4, 105.5],
      lash: 1.05,
      crease: 2.2,
      creaseAlpha: 0.65,
      lidShadow: 0.4
    })
  },
  {
    id: 'eyes-happy',
    slot: 'eyes',
    layers: mirrored([
      ...eyeRight({
        inner: [166.2, 103.6],
        outer: [179.2, 102.6],
        up1: [167.8, 100.8],
        up2: [175.4, 99.8],
        lo1: [168.2, 103.2],
        lo2: [176.2, 102.8],
        lash: 1.05,
        lowerAlpha: 0.6
      }),
      {
        d: curve([
          [167, 105.6],
          [172.5, 106.5],
          [178.5, 104.6]
        ]),
        stroke: 'skin',
        shade: -0.28,
        lineWidth: 0.5,
        alpha: 0.4
      },
      blob(173, 106.8, 4.2, 'skin', 0.2, 0.35),
      {
        d: 'M 181.2 101.8 q 1.6 0.2 2.8 -0.9 M 181.4 103.6 q 1.6 0.6 3 0.2',
        stroke: 'skin',
        shade: -0.3,
        lineWidth: 0.45,
        alpha: 0.4
      }
    ])
  },
  { id: 'eyes-closed', slot: 'eyes', layers: mirrored(closedEyeRight(1.6, 2.4)) },
  {
    id: 'eyes-wide',
    slot: 'eyes',
    layers: eyePair({
      inner: [166.2, 103.6],
      outer: [179, 102.8],
      up1: [167.3, 99.2],
      up2: [175.4, 98],
      lo1: [168.3, 106.4],
      lo2: [176.6, 106.3],
      iris: 2.45,
      pupil: 0.8,
      crease: 2,
      lidShadow: -0.3
    })
  },
  {
    id: 'eyes-monolid',
    slot: 'eyes',
    layers: eyePair({
      inner: [166.4, 103.9],
      outer: [179.2, 102.5],
      up1: [168.2, 101.5],
      up2: [175.6, 100.1],
      lo1: [168.4, 105.3],
      lo2: [176.4, 105.1],
      iris: 2.6,
      lash: 1,
      crease: 0,
      lidShadow: 0.3
    })
  },
  {
    id: 'eyes-hooded',
    slot: 'eyes',
    layers: eyePair({
      inner: [166.2, 103.5],
      outer: [178.8, 103.4],
      up1: [167.8, 100.9],
      up2: [175.4, 100],
      lo1: [168.4, 105.5],
      lo2: [176.3, 105.4],
      lash: 0.9,
      crease: 1.3,
      creaseAlpha: 0.7,
      lidShadow: 0.5
    })
  }
)

// Brows (right spine inner → tail)
parts.push(
  browPart(
    'brows-straight',
    [
      [165.5, 97.6],
      [170.5, 96.6],
      [176, 96.1],
      [180.5, 96.3],
      [184, 97.2]
    ],
    [2.1, 2, 1.8, 1.3, 0.3]
  ),
  browPart(
    'brows-arched',
    [
      [165.5, 97.8],
      [170, 96],
      [175.5, 94.6],
      [179.5, 95],
      [183.5, 97.6]
    ],
    [2, 1.9, 1.6, 1.1, 0.25]
  ),
  browPart(
    'brows-soft',
    [
      [165.8, 97.8],
      [170.5, 96.6],
      [175.5, 95.8],
      [179.8, 96.1],
      [183.2, 97.6]
    ],
    [1.5, 1.4, 1.2, 0.8, 0.2],
    4
  ),
  browPart(
    'brows-thick',
    [
      [165.2, 97.8],
      [170.5, 96.4],
      [176, 95.6],
      [180.5, 95.9],
      [184.5, 97.3]
    ],
    [2.9, 2.9, 2.6, 2, 0.6],
    7
  ),
  browPart(
    'brows-angry',
    [
      [165.8, 99.4],
      [170.5, 97.4],
      [175.5, 95.6],
      [180, 94.9],
      [184, 95.6]
    ],
    [2.3, 2.1, 1.8, 1.3, 0.3]
  ),
  browPart(
    'brows-sad',
    [
      [165.8, 95.2],
      [170.5, 95.4],
      [175.5, 96.1],
      [180, 97],
      [183.6, 98.4]
    ],
    [2, 1.9, 1.6, 1.1, 0.25]
  ),
  browPart(
    'brows-raised',
    [
      [165.5, 95.4],
      [170, 93.4],
      [175.5, 92.2],
      [179.5, 92.6],
      [183.5, 94.8]
    ],
    [2, 1.9, 1.6, 1.1, 0.25]
  )
)

// Noses
parts.push(
  nosePart('nose-small', { tipY: 116.3, tipR: 3.2, wing: 6.3, baseY: 119.8 }),
  nosePart('nose-button', { top: 101, tipY: 115.8, tipR: 3.6, wing: 6, baseY: 118.9, bridge: 2 }),
  nosePart('nose-long', {
    top: 98,
    tipY: 118.2,
    tipR: 3.1,
    wing: 6.6,
    baseY: 121,
    bridge: 3,
    hook: 0.6
  }),
  nosePart('nose-wide', { top: 100, tipY: 116.4, tipR: 4.1, wing: 8, baseY: 119.9, bridge: 3.2 }),
  nosePart('nose-roman', {
    top: 97.5,
    tipY: 117.8,
    tipR: 3,
    wing: 6.4,
    baseY: 120.8,
    bridge: 3.4,
    hook: 1.4
  })
)

// Mouths
parts.push(
  mouthPart('mouth-smile', { smile: 1.3 }),
  mouthPart('mouth-grin', { smile: 2.2, w: 11, open: 2.6, teeth: true, upH: 2.4, loH: 3.2 }),
  mouthPart('mouth-neutral', { smile: 0.1 }),
  mouthPart('mouth-o', { round: true }),
  mouthPart('mouth-frown', { smile: -1.3, loH: 3.9 }),
  mouthPart('mouth-smirk', { smile: 0.9, asym: 0.9 }),
  mouthPart('mouth-cat', { smile: 0.8, w: 7.8, upH: 3, loH: 3.4 }),
  mouthPart('mouth-open', {
    smile: 2,
    w: 11.2,
    open: 6.5,
    teeth: true,
    tongue: true,
    lowerTeeth: true,
    upH: 2.3,
    loH: 3.1
  }),
  mouthPart('mouth-full', { smile: 0.4, w: 10, upH: 3.6, loH: 4.6 })
)

// ── Hair styles ──
// Short crop: textured top swept up and back, tapered sides, sideburns.
const SHORT_FRONT = hairMass(
  [
    [160, 55.5],
    [169, 55.6],
    [176, 56.5],
    [183, 58.8],
    [188, 62],
    [191.5, 67],
    [193.4, 73],
    [194.2, 85],
    [193, 93],
    [189.8, 96.5],
    [188.4, 102],
    [187.8, 108.5]
  ],
  [
    [186.2, 108.2],
    [185.8, 99],
    [185.4, 90],
    [182, 83.5],
    [173, 79.6],
    [165, 78.6],
    [160, 79]
  ],
  1.3
)
const SIDE_FLOW_R: Flow = [
  [
    [186.6, 111],
    [186.4, 100],
    [186.6, 90],
    [185.5, 82]
  ],
  [
    [191.5, 95],
    [193.6, 87],
    [193, 76],
    [189.5, 67]
  ]
]
parts.push(
  hairPart('hair-short', {
    front: SHORT_FRONT,
    back: sym([
      [160, 56],
      [180, 57.5],
      [192.5, 65.5],
      [196.5, 80],
      [196.5, 96],
      [193, 110],
      [187, 117],
      [176, 121],
      [160, 122]
    ]),
    topY: 54,
    botY: 112,
    backBot: 122,
    flow: [
      [
        [
          [182, 84],
          [180, 76],
          [174, 67],
          [166, 61],
          [158, 58]
        ],
        [
          [172, 79.5],
          [168, 71],
          [161, 64],
          [152, 60],
          [143, 60]
        ],
        [
          [160, 79],
          [155, 72],
          [148, 67],
          [140, 65],
          [133, 68]
        ],
        [
          [146, 80],
          [141, 75],
          [135.5, 73],
          [130.5, 76],
          [127.5, 83]
        ]
      ],
      SIDE_FLOW_R,
      mxFlow(SIDE_FLOW_R)
    ],
    sheen: join(
      curve([
        [136, 71],
        [147, 62.5],
        [161, 59.5],
        [176, 61.5],
        [186, 69]
      ]),
      curve([
        [183, 72.5],
        [174, 66.5],
        [161, 64.8],
        [148, 67],
        [139, 74]
      ])
    ),
    sheenAt: [154, 64],
    extraFront: mirrored([
      { d: RR(181, 82, 18, 30, 0), grad: fadeY(84, 104, 'skin', -0.12, 0, 0.4), clip: true }
    ]),
    shadowLine: [
      [136, 90],
      [140.5, 83.5],
      [150, 79.6],
      [160, 79],
      [170, 79.6],
      [179.5, 83.5],
      [184, 90]
    ]
  })
)

// Shared outlines for pulled-back styles (buns, ponytail, braid, slick-back)
const HAIRLINE_R: Pt[] = [
  [187, 107],
  [186.3, 98],
  [185.6, 90],
  [182.2, 83.6],
  [173, 79.6],
  [165, 78.6],
  [160, 79]
]
const CAP_R: Pt[] = [
  [160, 58.2],
  [170, 58.6],
  [178, 59.8],
  [185, 63.4],
  [190, 69],
  [192.8, 78],
  [193.4, 88],
  [192.3, 96],
  [189.8, 101.5],
  [188.4, 107]
]
/** Strands combed straight back from the hairline toward a point. */
function combedFlow(to: Pt, spread = 1): Pt[][] {
  const roots: Pt[] = [
    [186.5, 104],
    [185.6, 92],
    [180, 81.5],
    [170, 79],
    [160, 79],
    [150, 79],
    [140, 81.5],
    [134.4, 92],
    [133.5, 104]
  ]
  return roots.map((r): Pt[] => {
    const end: Pt = [to[0] + (r[0] - 160) * 0.5 * spread, to[1] + Math.abs(r[0] - 160) * 0.12]
    const m1 = lerp(r, end, 0.35)
    const m2 = lerp(r, end, 0.7)
    const bulge = (r[0] - 160) * 0.08 * spread
    return [r, add(m1, bulge, -2), add(m2, bulge * 0.6, -1.5), end]
  })
}

// Long straight hair: center part, falling over the shoulders.
const LONG_CAP = hairMass(
  [
    [160, 54.5],
    [170, 54.8],
    [178, 56],
    [186, 59.5],
    [191, 64],
    [195.5, 72],
    [197.8, 82],
    [198.6, 96],
    [198.8, 108]
  ],
  [
    [187.2, 110],
    [187, 100],
    [185.6, 89.5],
    [181, 82],
    [172.5, 78.4],
    [165, 77.8],
    [160, 78.4]
  ],
  0.6
)
function curtainR(bottom: number, out = 0, wave = 0): string {
  const k = (bottom - 100) / 150
  const w = (i: number) => (i % 2 ? wave : -wave)
  return smooth([
    [187.5, 86],
    [197.6, 80],
    [200.8 + out * 0.2 + w(1), 100 + 22 * k],
    [203 + out * 0.4 + w(2), 100 + 45 * k],
    [206.5 + out * 0.7 + w(3), 100 + 70 * k],
    [211 + out + w(4), 100 + 98 * k],
    [213.5 + out + w(5), 100 + 122 * k],
    [211.5 + out, 100 + 142 * k],
    [206.5 + out * 0.8, bottom + 2],
    [202 + out * 0.6, bottom - 5 * k],
    [197 + out * 0.5 - w(5), 100 + 126 * k],
    [191.5 + out * 0.3 - w(4), 100 + 100 * k],
    [186.5 - w(3), 100 + 76 * k],
    [183.8 - w(2), 100 + 52 * k],
    [184.3 - w(1), 100 + 28 * k],
    [186.2, 104]
  ])
}
const curtainPair = (bottom: number, out = 0, wave = 0): string => {
  const r = curtainR(bottom, out, wave)
  return r + ' ' + flipX(r)
}
function curtainFlowR(bottom: number, out = 0, bend = 0): Flow {
  const k = (bottom - 100) / 150
  return [
    [
      [187.5, 103],
      [185 + bend, 100 + 50 * k],
      [190 + out * 0.3 - bend, 100 + 100 * k],
      [203 + out * 0.6, bottom - 4]
    ],
    [
      [193, 99],
      [194 + bend, 100 + 50 * k],
      [201 + out * 0.6 - bend, 100 + 100 * k],
      [208 + out * 0.8, bottom - 2]
    ],
    [
      [198.2, 98],
      [202.5 + bend, 100 + 50 * k],
      [211 + out - bend, 100 + 100 * k],
      [211.5 + out, bottom - 10]
    ]
  ]
}
const curtainSheenR = (bottom: number, out = 0): string => {
  const k = (bottom - 100) / 150
  return smooth([
    [194.5, 122],
    [197.5, 122],
    [200 + out * 0.4, 100 + 50 * k],
    [205 + out * 0.8, 100 + 96 * k],
    [201 + out * 0.8, 100 + 96 * k],
    [195.5 + out * 0.4, 100 + 50 * k]
  ])
}
const longBack = (bottom: number, wide = 0): string =>
  sym([
    [160, 54],
    [181, 56],
    [196, 66],
    [203 + wide * 0.3, 84],
    [205 + wide * 0.5, 104],
    [206 + wide * 0.7, 130],
    [209 + wide, 165],
    [213 + wide, Math.min(205, bottom - 30)],
    [212 + wide, bottom - 8],
    [200 + wide * 0.5, bottom],
    [186, bottom - 5],
    [172, bottom - 1],
    [160, bottom - 4]
  ])
const TOP_FLOW_PART: Flow = [
  [
    [160.5, 56],
    [166, 60],
    [176, 70],
    [184, 84],
    [186.5, 100]
  ],
  [
    [161, 55.5],
    [172, 57],
    [185, 64],
    [193, 78],
    [197, 96]
  ]
]
const CROWN_SHEEN = join(
  curve([
    [137, 68],
    [148, 61],
    [160, 58.8],
    [172, 61],
    [183, 68]
  ]),
  curve([
    [181, 71.5],
    [171, 65],
    [160, 63.4],
    [149, 65],
    [139, 71.5]
  ])
)
const PART_LINE: L[] = [
  {
    d: 'M 160 56 L 160.2 70',
    stroke: 'hair',
    shade: -0.5,
    lineWidth: 2.4,
    alpha: 0.25,
    clip: true
  },
  {
    d: 'M 160 55.6 L 160.2 64 L 160.4 69',
    stroke: 'skin',
    shade: -0.15,
    lineWidth: 0.5,
    alpha: 0.28,
    clip: true
  }
]
const SHADOW_CENTER: Pt[] = [
  [134, 96],
  [139, 83],
  [150, 78.6],
  [160, 78.4],
  [170, 78.6],
  [181, 83],
  [186, 96]
]

parts.push(
  hairPart('hair-long', {
    front: LONG_CAP,
    flow: [TOP_FLOW_PART, mxFlow(TOP_FLOW_PART)],
    flowN: 7,
    sheen: CROWN_SHEEN,
    back: longBack(282),
    backFlow: [
      [
        [
          [198, 110],
          [203, 170],
          [208, 230],
          [206, 276]
        ],
        [
          [186, 120],
          [188, 180],
          [190, 230],
          [188, 274]
        ]
      ]
    ],
    curtains: curtainPair(252),
    curtainFlow: [curtainFlowR(252), mxFlow(curtainFlowR(252))],
    curtainSheen: curtainSheenR(252) + ' ' + flipX(curtainSheenR(252)),
    sway: 1.4,
    topY: 54,
    botY: 170,
    shadowLine: SHADOW_CENTER,
    extraFront: PART_LINE,
    wisps: 'M 198.6 100 q 3 10 2 22 M 121.4 100 q -3.2 12 -1.4 24 M 208 170 q 4 14 2 30'
  })
)

// Wavy shoulder-length hair with a side part (viewer's right).
parts.push(
  hairPart('hair-wavy', {
    front: smooth([
      [130.5, 110],
      [122.2, 100],
      [121, 86],
      [124, 72],
      [131, 62],
      [142, 55.5],
      [156, 52.5],
      [170, 53],
      [182, 57],
      [191.5, 64.5],
      [197, 76],
      [199, 92],
      [199.2, 108],
      [187.2, 110],
      [187, 100],
      [185.8, 90],
      [181.5, 83],
      [175, 79.5],
      [170, 76],
      [164, 78],
      [154, 81.5],
      [145, 85],
      [138.5, 90],
      [135.5, 97],
      [133, 110]
    ]),
    flow: [
      [
        [
          [170, 55],
          [160, 64],
          [148, 74],
          [140, 86],
          [134.5, 100]
        ],
        [
          [168, 54],
          [150, 57],
          [134, 66],
          [125, 82],
          [123, 100]
        ]
      ],
      [
        [
          [171, 55],
          [175, 64],
          [183, 76],
          [186, 90],
          [186.5, 104]
        ],
        [
          [172, 54],
          [184, 59],
          [194, 70],
          [198, 86],
          [198.5, 104]
        ]
      ]
    ],
    flowN: 6,
    sheen: join(
      curve([
        [128, 76],
        [138, 63],
        [152, 57],
        [168, 57],
        [182, 62],
        [191, 71]
      ]),
      curve([
        [188, 73],
        [180, 66.5],
        [167, 62],
        [153, 62.5],
        [141, 68],
        [132, 79]
      ])
    ),
    sheenAt: [150, 62],
    back: longBack(200, 2),
    curtains: curtainPair(196, 4, 2.2),
    curtainFlow: [curtainFlowR(196, 4, 3), mxFlow(curtainFlowR(196, 4, 3))],
    curtainSheen: curtainSheenR(196, 4) + ' ' + flipX(curtainSheenR(196, 4)),
    sway: 1.8,
    topY: 52,
    botY: 160,
    backBot: 200,
    shadowLine: [
      [135, 100],
      [138.5, 90],
      [150, 83],
      [164, 78],
      [175, 79.5],
      [183, 85],
      [186, 98]
    ],
    wisps: 'M 199 100 q 4 8 1 18 M 121 102 q -4 8 -1 18 M 170 53 q -2 -3 -6 -3.5'
  })
)

// Bob: chin-length with a piecey fringe.
parts.push(
  hairPart('hair-bob', {
    front: hairMass(
      [
        [160, 54],
        [170, 54.3],
        [178, 55.6],
        [186, 59],
        [191.5, 64],
        [196, 72],
        [198.6, 82],
        [199.6, 94],
        [199.8, 108],
        [199, 121],
        [196.6, 132],
        [192.5, 139.5]
      ],
      [
        [188, 140.5],
        [185.6, 135],
        [185, 126],
        [186, 112],
        [186.8, 101],
        [185.8, 95.5],
        [183.8, 92.2],
        [181, 93.6],
        [177, 91.6],
        [174.2, 93],
        [169, 91.8],
        [166, 93.4],
        [162.5, 91.2],
        [160, 92.4]
      ],
      0.6,
      5
    ),
    flow: [
      [
        [
          [160, 56],
          [158.5, 66],
          [157.5, 80],
          [157, 92]
        ],
        [
          [170, 56],
          [172, 66],
          [174, 80],
          [176, 93]
        ],
        [
          [180, 58],
          [186, 68],
          [188.5, 80],
          [187.5, 93]
        ]
      ],
      [
        [
          [140, 58],
          [134, 68],
          [131.5, 80],
          [132.5, 93]
        ],
        [
          [150, 56],
          [148, 66],
          [146, 80],
          [144, 93]
        ],
        [
          [160, 56],
          [161.5, 66],
          [162.5, 80],
          [163, 92]
        ]
      ],
      [
        [
          [186, 62],
          [192.5, 78],
          [191, 110],
          [189, 138]
        ],
        [
          [190, 62],
          [198, 80],
          [199, 112],
          [195, 138]
        ]
      ],
      [
        [
          [134, 62],
          [127.5, 78],
          [129, 110],
          [131, 138]
        ],
        [
          [130, 62],
          [122, 80],
          [121, 112],
          [125, 138]
        ]
      ]
    ],
    flowN: 5,
    sheen: join(
      curve([
        [131, 76],
        [140, 65],
        [152, 59.5],
        [168, 59.5],
        [180, 65],
        [189, 76]
      ]),
      curve([
        [186, 79],
        [178, 70],
        [167, 65.2],
        [153, 65.2],
        [142, 70],
        [134, 79]
      ])
    ),
    back: sym([
      [160, 54],
      [180, 56],
      [194, 64],
      [200, 78],
      [202, 96],
      [202.5, 115],
      [201, 132],
      [197, 141],
      [186, 143],
      [172, 141],
      [160, 142]
    ]),
    backBot: 143,
    botY: 142,
    shadowLine: [
      [140, 93.5],
      [150, 92.8],
      [160, 92.8],
      [170, 92.8],
      [180, 93.5]
    ]
  })
)

// Spiky: short, textured, pushed up into points.
const SPIKES_R: Pt[] = [
  [165, 53],
  [172.5, 46.5],
  [174.5, 54.5],
  [182.5, 50],
  [184, 57.5],
  [191.5, 56.5],
  [190.5, 63],
  [195.5, 65.5],
  [194, 72],
  [195, 84],
  [193, 93],
  [189.8, 96.5],
  [188.4, 102],
  [187.8, 108.5]
]
parts.push(
  hairPart('hair-spiky', {
    front: smooth(
      [
        ...mx(SPIKES_R).reverse(),
        [158.5, 46.5],
        ...SPIKES_R,
        [186.2, 108.2],
        [185.8, 99],
        [185.4, 90],
        [182, 83.5],
        [176, 80.5],
        [168, 81],
        [162, 79.5],
        [156, 81.2],
        [148, 80],
        [140, 83],
        [134.6, 90],
        [134.2, 99],
        [133.4, 108.2]
      ],
      true,
      0.55
    ),
    flow: [
      [
        [
          [186, 102],
          [187, 90],
          [190, 78],
          [193, 66]
        ],
        [
          [178, 81],
          [180, 70],
          [182, 60],
          [182, 49]
        ],
        [
          [168, 80],
          [169, 70],
          [170, 58],
          [170.5, 46]
        ],
        [
          [158, 80],
          [159, 70],
          [160, 58],
          [160, 47]
        ],
        [
          [148, 80],
          [147, 70],
          [146, 60],
          [148, 50]
        ],
        [
          [138, 84],
          [136, 74],
          [134, 64],
          [131, 56]
        ],
        [
          [134, 102],
          [133, 90],
          [130, 78],
          [127, 66]
        ]
      ]
    ],
    flowN: 4,
    sheen: E(158, 62, 22, 8),
    sheenAt: [156, 60],
    back: sym([
      [160, 56],
      [180, 57.5],
      [192.5, 65.5],
      [196.5, 80],
      [196.5, 96],
      [193, 110],
      [187, 117],
      [176, 121],
      [160, 122]
    ]),
    backBot: 122,
    topY: 44,
    botY: 110,
    extraFront: mirrored([
      { d: RR(181, 84, 18, 28, 0), grad: fadeY(86, 104, 'skin', -0.12, 0, 0.35), clip: true }
    ]),
    shadowLine: [
      [135, 92],
      [140, 83.5],
      [150, 80.3],
      [160, 80],
      [170, 80.5],
      [180, 83],
      [185, 92]
    ]
  })
)

// Classic side part (viewer's left), combed over to the right.
parts.push(
  hairPart('hair-sidepart', {
    front: smooth([
      [132.2, 108.5],
      [131.6, 102],
      [130.2, 96.5],
      [126.8, 92],
      [125.8, 82],
      [127.8, 71],
      [133, 63.5],
      [140, 59],
      [144, 58.4],
      [150, 55],
      [161, 52],
      [174, 52.4],
      [185, 56.6],
      [192.2, 64.5],
      [195, 76],
      [194.4, 87],
      [193, 93],
      [189.8, 96.5],
      [188.4, 102],
      [187.8, 108.5],
      [186.2, 108.2],
      [185.8, 99],
      [185.2, 90],
      [182.4, 84.2],
      [176, 81],
      [168, 79.8],
      [160, 79.4],
      [152, 79.6],
      [144, 80.8],
      [138, 84],
      [134.6, 90],
      [134.2, 99],
      [133.8, 108.2]
    ]),
    flow: [
      [
        [
          [144, 59],
          [150, 60],
          [162, 64],
          [174, 72],
          [182, 83]
        ],
        [
          [145, 58],
          [156, 55],
          [172, 55.5],
          [186, 62],
          [193, 76]
        ]
      ],
      [
        [
          [143, 59],
          [148, 64],
          [152, 70],
          [156, 76],
          [160, 80]
        ],
        [
          [143, 59],
          [149, 62.5],
          [159, 68],
          [168, 74],
          [176, 81]
        ]
      ],
      [
        [
          [142, 59.5],
          [136, 65],
          [132, 74],
          [131, 86],
          [133.5, 104]
        ],
        [
          [141, 59],
          [132, 63.5],
          [127, 72],
          [126.5, 84],
          [128, 94]
        ]
      ],
      SIDE_FLOW_R
    ],
    flowN: 5,
    sheen: join(
      curve([
        [149, 58.5],
        [162, 56],
        [176, 57.5],
        [187, 64],
        [192, 73]
      ]),
      curve([
        [188.5, 75],
        [183, 67.5],
        [173, 62.5],
        [161, 61],
        [151, 62.5]
      ])
    ),
    sheenAt: [168, 60],
    back: sym([
      [160, 55],
      [180, 57],
      [192.5, 65.5],
      [196.5, 80],
      [196.5, 96],
      [193, 110],
      [187, 117],
      [176, 121],
      [160, 122]
    ]),
    backBot: 122,
    topY: 52,
    botY: 110,
    extraFront: [
      ...mirrored([
        { d: RR(181, 84, 18, 28, 0), grad: fadeY(88, 106, 'skin', -0.12, 0, 0.35), clip: true }
      ]),
      {
        d: 'M 141.5 60.5 Q 143 59 145.5 58',
        stroke: 'skin',
        shade: -0.1,
        lineWidth: 0.6,
        alpha: 0.45,
        clip: true
      }
    ],
    shadowLine: [
      [135, 92],
      [139.5, 84],
      [150, 80],
      [160, 79.4],
      [170, 80],
      [180, 83.5],
      [185, 92]
    ]
  })
)

// Two buns high on the back of the head, hair pulled up tight.
function bun(cx: number, cy: number, r: number): L[] {
  const a = (k: number) => Math.round(k * r * 100) / 100
  return [
    {
      d: E(cx, cy, r, r * 0.92),
      grad: rad(cx - r * 0.3, cy - r * 0.35, r * 1.3, [
        [0, 'hair', 0.18],
        [0.6, 'hair', -0.06],
        [1, 'hair', -0.36]
      ]),
      mask: true
    },
    {
      d:
        `M ${cx - a(0.8)} ${cy - a(0.2)} A ${a(0.8)} ${a(0.7)} 0 0 1 ${cx + a(0.7)} ${cy + a(0.3)} ` +
        `M ${cx - a(0.55)} ${cy + a(0.45)} A ${a(0.6)} ${a(0.5)} 0 0 1 ${cx + a(0.45)} ${cy - a(0.5)} ` +
        `M ${cx - a(0.3)} ${cy - a(0.6)} A ${a(0.35)} ${a(0.35)} 0 0 1 ${cx + a(0.2)} ${cy + a(0.25)} ` +
        `M ${cx + a(0.9)} ${cy - a(0.1)} A ${a(0.9)} ${a(0.8)} 0 0 1 ${cx - a(0.2)} ${cy + a(0.85)}`,
      stroke: 'hair',
      shade: -0.45,
      lineWidth: 0.6,
      alpha: 0.45,
      clip: true
    },
    {
      d:
        `M ${cx - a(0.75)} ${cy - a(0.35)} A ${a(0.75)} ${a(0.65)} 0 0 1 ${cx + a(0.55)} ${cy - a(0.55)} ` +
        `M ${cx - a(0.4)} ${cy + a(0.2)} A ${a(0.45)} ${a(0.4)} 0 0 1 ${cx + a(0.5)} ${cy + a(0.05)}`,
      stroke: 'hair',
      shade: 0.35,
      lineWidth: 0.45,
      alpha: 0.35,
      clip: true
    }
  ]
}
const PULLED_SHEEN = join(
  curve([
    [137, 72],
    [148, 63.5],
    [161, 61],
    [175, 63],
    [184, 70]
  ]),
  curve([
    [181.5, 73],
    [173, 67],
    [161, 65.5],
    [149, 67.5],
    [140, 75]
  ])
)
const PULLED_SHADOW: Pt[] = [
  [134.6, 94],
  [139, 84],
  [150, 79.6],
  [160, 79],
  [170, 79.6],
  [181, 84],
  [185.4, 94]
]
const PULLED_BACK = sym([
  [160, 58],
  [180, 59],
  [192, 67],
  [195.5, 82],
  [195, 98],
  [192, 112],
  [186, 120],
  [160, 122]
])
parts.push(
  hairPart('hair-buns', {
    front: hairMass(CAP_R, HAIRLINE_R, 0.3),
    flow: [combedFlow([178, 58], 0.6).slice(0, 5), combedFlow([142, 58], 0.6).slice(4)],
    flowN: 4,
    sheen: PULLED_SHEEN,
    back: PULLED_BACK,
    backBot: 122,
    extraBack: [...bun(179, 52.5, 11.5), ...bun(141, 52.5, 11.5)],
    topY: 56,
    botY: 106,
    shadowLine: PULLED_SHADOW,
    wisps:
      'M 186 88 C 188.5 96 185 104 187 114 M 134 88 C 131.5 96 135 104 133 114 M 176 58 q 3 -6 9 -8'
  })
)

// Low side ponytail gathered at the right and draped over the shoulder.
parts.push(
  hairPart('hair-ponytail', {
    front: hairMass(CAP_R, HAIRLINE_R, 0.3),
    flow: [
      [
        [
          [133.5, 104],
          [136, 86],
          [150, 72],
          [172, 70],
          [192, 104]
        ],
        [
          [140, 81.5],
          [150, 70],
          [165, 64],
          [182, 68],
          [194, 94]
        ],
        [
          [160, 79],
          [166, 64],
          [178, 61],
          [188, 68],
          [193, 84]
        ]
      ],
      [
        [
          [186.5, 104],
          [187.5, 96],
          [188.5, 90],
          [189.5, 86],
          [190, 82]
        ],
        [
          [192, 98],
          [193, 90],
          [193, 82],
          [191.5, 74],
          [188, 66]
        ]
      ]
    ],
    flowN: 4,
    sheen: PULLED_SHEEN,
    back: PULLED_BACK,
    backBot: 124,
    curtains: smooth([
      [190, 112],
      [197, 114],
      [203.5, 126],
      [208, 146],
      [211.5, 170],
      [213, 196],
      [211, 220],
      [206, 238],
      [201, 250],
      [199.5, 236],
      [196, 216],
      [192.5, 194],
      [190, 170],
      [188, 148],
      [187, 130],
      [187.2, 118]
    ]),
    curtainFlow: [
      [
        [
          [190, 120],
          [192, 160],
          [196, 200],
          [200, 240]
        ],
        [
          [196, 120],
          [201, 160],
          [204, 200],
          [203, 236]
        ],
        [
          [201, 128],
          [206, 160],
          [209, 200],
          [205, 234]
        ]
      ]
    ],
    curtainSheen: smooth([
      [194, 124],
      [197, 124],
      [202, 170],
      [203, 205],
      [200, 205],
      [198.5, 170]
    ]),
    sway: 2,
    topLayers: [
      {
        d: smooth([
          [188.2, 124],
          [196.5, 121.5],
          [200.8, 125.5],
          [192, 129]
        ]),
        fill: 'accent',
        sway: 2
      },
      {
        d: 'M 190 125 Q 195 123 199.5 125',
        stroke: 'accent',
        shade: 0.35,
        lineWidth: 0.6,
        alpha: 0.6,
        sway: 2
      }
    ],
    topY: 56,
    botY: 106,
    shadowLine: PULLED_SHADOW,
    wisps: 'M 134 90 C 131.5 98 135 106 133 116'
  })
)

// Coily / curly texture: many small open rings scattered through a region.
function coils(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  step: number,
  r: number,
  seed: number,
  keep: (x: number, y: number) => boolean
): string {
  let s = seed
  const rnd = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
  const f = (n: number) => Math.round(n * 100) / 100
  const out: string[] = []
  let row = 0
  for (let y = y0; y <= y1; y += step * 0.86, row++) {
    for (let x = x0 + (row % 2 ? step / 2 : 0); x <= x1; x += step) {
      const px = x + (rnd() - 0.5) * step * 0.6
      const py = y + (rnd() - 0.5) * step * 0.6
      if (!keep(px, py)) continue
      const rr = r * (0.7 + rnd() * 0.6)
      out.push(
        `M ${f(px - rr)} ${f(py)} a ${f(rr)} ${f(rr * 0.9)} 0 1 1 ${f(rr * 1.5)} ${f(rr * 0.85)}`
      )
    }
  }
  return out.join(' ')
}
/** Outside the visible face oval (so texture never lands on skin). */
const offFace = (x: number, y: number): boolean =>
  ((x - 160) / 26) ** 2 + ((y - 112) / 33) ** 2 > 1 || y < 80
const tuftSym = (half: Pt[], amp: number, seed = 2): string =>
  smooth(tuft(symPts(half), [160, 105], amp, seed), true, 0.95)
const coilLayers = (tex: string, k = 1): L[] => [
  { d: tex, stroke: 'hair', shade: -0.48, lineWidth: 0.7 * k, alpha: 0.5, clip: true },
  {
    d: moveD(tex, -0.6, -0.7),
    stroke: 'hair',
    shade: 0.34,
    lineWidth: 0.45 * k,
    alpha: 0.4,
    clip: true
  }
]

// Curly: shoulder-length ringlets with volume.
const CURLY_KEEP = (x: number, y: number) => offFace(x, y)
parts.push(
  hairPart('hair-curly', {
    front: hairMass(
      [
        [160, 50],
        [172, 50.5],
        [183, 54],
        [192, 60],
        [199, 69],
        [204, 81],
        [206.5, 95],
        [207.5, 110],
        [207, 124],
        [205, 137],
        [201, 148],
        [195, 154]
      ],
      [
        [190, 152],
        [187.5, 144],
        [186.4, 130],
        [186.8, 115],
        [187.5, 102],
        [186, 92],
        [181, 86.5],
        [174, 84.2],
        [167, 86.4],
        [160, 84.5]
      ],
      3.2,
      11
    ),
    flow: [],
    sheen: E(155, 64, 24, 9),
    sheenAt: [152, 62],
    back: tuftSym(
      [
        [160, 50],
        [184, 53],
        [200, 64],
        [208, 80],
        [211, 100],
        [213, 125],
        [213, 150],
        [209, 166],
        [198, 174],
        [180, 170],
        [160, 173]
      ],
      3,
      5
    ),
    backBot: 175,
    topY: 48,
    botY: 155,
    extraFront: coilLayers(coils(110, 210, 46, 156, 5.2, 2.2, 13, CURLY_KEEP)),
    extraBack: coilLayers(coils(106, 214, 110, 176, 5.6, 2.4, 17, () => true)),
    shadowLine: [
      [135, 96],
      [140, 88],
      [150, 85.5],
      [160, 85],
      [170, 85.5],
      [180, 88],
      [185, 96]
    ]
  })
)

// Afro: a full rounded crown of tight coils.
parts.push(
  hairPart('hair-afro', {
    front: hairMass(
      [
        [160, 37.5],
        [168, 37.8],
        [176, 39.5],
        [184, 42],
        [190, 45],
        [196, 49.5],
        [200, 54],
        [204, 60],
        [206, 66],
        [207.8, 73],
        [208, 80],
        [207.4, 88],
        [207, 95],
        [205.5, 102],
        [203.5, 108],
        [200.5, 113],
        [197, 117],
        [191, 120]
      ],
      [
        [188, 116],
        [187, 104],
        [186, 93],
        [182.5, 85],
        [174, 81],
        [166, 79.8],
        [160, 80]
      ],
      1.6,
      21
    ),
    flow: [],
    back: sym([
      [160, 40],
      [185, 42],
      [203, 56],
      [210, 78],
      [209, 100],
      [204, 116],
      [194, 126],
      [160, 128]
    ]),
    backBot: 128,
    topY: 38,
    botY: 122,
    extraFront: [
      blob(150, 56, 26, 'hair', 0.3, 0.35, { clip: true }),
      ...coilLayers(coils(112, 208, 36, 122, 3.3, 1.25, 23, offFace), 0.8),
      {
        d: E(160, 80, 50, 44),
        grad: rad(160, 84, 50, [
          [0.6, 'hair', -0.4, 0],
          [1, 'hair', -0.4, 0.45]
        ]),
        clip: true
      }
    ],
    shadowLine: [
      [135, 94],
      [139.5, 85],
      [150, 81],
      [160, 80],
      [170, 81],
      [180.5, 85],
      [185, 94]
    ]
  })
)

// Slicked back: close to the skull, glossy, combed straight back.
parts.push(
  hairPart('hair-slickback', {
    front: hairMass(
      [
        [160, 52],
        [171, 52.4],
        [180, 54],
        [187.5, 58.5],
        [192.5, 66],
        [195, 76],
        [195, 88],
        [193, 96],
        [190, 101.5],
        [188.4, 107]
      ],
      [
        [187, 107],
        [186.3, 98],
        [185.2, 89],
        [180.5, 82],
        [172, 78.6],
        [165, 78.6],
        [160, 77.2]
      ],
      0.2
    ),
    flow: [combedFlow([160, 49], 1.4)],
    flowN: 3,
    sheen: CROWN_SHEEN,
    sheenAt: [158, 62],
    back: sym([
      [160, 54],
      [180, 56],
      [193, 65],
      [197, 80],
      [197, 96],
      [194, 110],
      [187, 119],
      [176, 124],
      [160, 125]
    ]),
    backBot: 125,
    topY: 50,
    botY: 108,
    extraFront: [
      {
        d: strands(combedFlow([160, 50], 1.2), 2, 41),
        stroke: 'hair',
        shade: 0.55,
        lineWidth: 0.35,
        alpha: 0.45,
        clip: true
      },
      ...mirrored([
        { d: RR(181, 86, 18, 26, 0), grad: fadeY(90, 106, 'skin', -0.12, 0, 0.3), clip: true }
      ])
    ],
    shadowLine: PULLED_SHADOW
  })
)

// Undercut: buzzed sides, long top swept to the right.
const UNDERCUT_TOP = smooth([
  [134.5, 81],
  [133, 71],
  [137, 61],
  [146, 53.5],
  [158, 49],
  [172, 48.5],
  [185, 51.5],
  [193, 57.5],
  [196.5, 66],
  [196, 74],
  [193, 79.5],
  [188, 79.5],
  [182.5, 83],
  [174, 80],
  [166, 78.6],
  [158, 79],
  [150, 79.6],
  [142, 82],
  [137, 87]
])
parts.push(
  hairPart('hair-undercut', {
    front: hairMass(
      [
        [160, 58],
        [178, 59],
        [188, 64],
        [192.5, 74],
        [193.2, 86],
        [192, 95],
        [189.6, 100],
        [188.2, 106]
      ],
      HAIRLINE_R,
      0.2
    ),
    frontAlpha: 0.55,
    flow: [],
    back: sym([
      [160, 58],
      [180, 59],
      [192, 67],
      [195.5, 82],
      [195, 98],
      [192, 110],
      [186, 117],
      [160, 119]
    ]),
    backBot: 119,
    backAlpha: 0.6,
    topY: 56,
    botY: 106,
    extraFront: [
      { d: RR(120, 60, 80, 50, 0), grad: fadeY(70, 106, 'skin', -0.1, 0, 0.35), clip: true },
      {
        d: coils(128, 194, 76, 108, 2.4, 0.5, 29, (x) => x < 137 || x > 183),
        stroke: 'hair',
        shade: -0.4,
        lineWidth: 0.35,
        alpha: 0.35,
        clip: true
      },
      { d: UNDERCUT_TOP, grad: hairGrad(44, 84), mask: true },
      ...strandLayers(
        flowD(
          [
            [
              [
                [138, 82],
                [138, 70],
                [146, 58],
                [160, 50],
                [174, 48]
              ],
              [
                [158, 79],
                [160, 68],
                [170, 58],
                [184, 54],
                [196, 60]
              ],
              [
                [182, 83],
                [186, 74],
                [192, 68],
                [197, 66],
                [199, 72]
              ]
            ]
          ],
          7,
          31
        )
      ),
      sheenLayer(
        join(
          curve([
            [140, 62],
            [152, 52],
            [168, 48.5],
            [184, 52],
            [194, 60]
          ]),
          curve([
            [191, 63],
            [182, 57],
            [168, 54],
            [153, 57],
            [143, 66]
          ])
        ),
        [160, 54],
        28
      )
    ],
    shadowLine: PULLED_SHADOW
  })
)

// Single braid over the left shoulder, center part.
function braidLayers(): L[] {
  const line: Pt[] = [
    [133, 116],
    [128.5, 130],
    [125, 150],
    [122.5, 172],
    [121, 194],
    [120.5, 216],
    [121, 236]
  ]
  const lobes: string[] = []
  const hi: string[] = []
  const n = 15
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (line.length - 1)
    const j = Math.min(line.length - 2, Math.floor(t))
    const c = lerp(line[j], line[j + 1], t - j)
    const sd = i % 2 ? 1 : -1
    const k = 1.1 - i * 0.022
    const pts: Pt[] = [
      [c[0] + sd * 0.4 * k, c[1] - 9 * k],
      [c[0] + sd * 6.6 * k, c[1] - 3.5 * k],
      [c[0] + sd * 5 * k, c[1] + 4.5 * k],
      [c[0] - sd * 1.5 * k, c[1] + 8 * k],
      [c[0] - sd * 2.6 * k, c[1] + 1.5 * k]
    ]
    lobes.push(smooth(pts))
    hi.push(
      smooth([
        [c[0] + sd * 0.8 * k, c[1] - 6 * k],
        [c[0] + sd * 4.4 * k, c[1] - 2.4 * k],
        [c[0] + sd * 2.4 * k, c[1] + 0.6 * k],
        [c[0] - sd * 0.8 * k, c[1] - 1.2 * k]
      ])
    )
  }
  const sw = { sway: 1.5 }
  const tail = smooth([
    [118.5, 238],
    [123.5, 238],
    [125, 250],
    [122, 262],
    [119.5, 256],
    [116.5, 262],
    [115.5, 250]
  ])
  return [
    { d: tail, grad: hairGrad(236, 262, -0.05), ...sw },
    { d: lobes.join(' '), grad: hairGrad(110, 240, 0.02), mask: true, ...sw },
    { d: hi.join(' '), fill: 'hair', shade: 0.2, alpha: 0.3, clip: true, ...sw },
    { d: lobes.join(' '), stroke: 'hair', shade: -0.48, lineWidth: 0.5, alpha: 0.4, ...sw },
    { d: RR(116.5, 232.5, 8.5, 5, 2), fill: 'accent', ...sw },
    { d: RR(116.5, 232.5, 8.5, 2, 1), fill: 'accent', shade: 0.3, alpha: 0.6, ...sw }
  ]
}
parts.push(
  hairPart('hair-braid', {
    front: hairMass(
      [
        [160, 57.5],
        [170, 57.8],
        [178, 59.2],
        [185, 63],
        [190, 69],
        [192.8, 78],
        [193.4, 88],
        [192.3, 96],
        [189.8, 101.5],
        [188.4, 107]
      ],
      HAIRLINE_R,
      0.3
    ),
    flow: [
      [
        [
          [160.5, 58],
          [168, 62],
          [178, 72],
          [184, 84],
          [186.5, 102]
        ],
        [
          [161, 57.5],
          [174, 59],
          [186, 66],
          [192, 80],
          [192, 98]
        ]
      ],
      [
        [
          [159.5, 58],
          [152, 62],
          [142, 72],
          [136, 84],
          [133.5, 102]
        ],
        [
          [159, 57.5],
          [146, 59],
          [134, 66],
          [128, 80],
          [128, 98]
        ]
      ]
    ],
    flowN: 5,
    sheen: PULLED_SHEEN,
    back: PULLED_BACK,
    backBot: 122,
    topY: 56,
    botY: 106,
    shadowLine: PULLED_SHADOW,
    extraFront: PART_LINE.map((l) => ({ ...l, d: moveD(l.d, 0, 2) })),
    topLayers: braidLayers(),
    wisps: 'M 186 90 C 188.5 98 185 106 187 116'
  })
)

// Bald: scalp sheen plus a faint shadow of stubble where the hair grew.
const OVAL_SKULL = sym([
  [160, 64],
  [175, 65.5],
  [185.5, 72],
  [189.5, 84],
  [190, 96],
  [188.5, 108],
  [185, 119],
  [179, 129],
  [171, 137.5],
  [164.5, 141.4],
  [160, 142]
])
parts.push({
  id: 'hair-none',
  slot: 'hair',
  layers: [
    { d: OVAL_SKULL, fill: 'skin', alpha: 0, mask: true },
    { d: SHORT_FRONT, grad: fadeY(60, 100, 'hair', -0.1, 0.03, 0.12), clip: true },
    { d: RR(120, 60, 80, 30, 0), grad: fadeY(62, 84, 'skin', 0, 0.25, 0), clip: true },
    blob(152, 72, 13, 'skin', 0.32, 0.55, { clip: true }),
    blob(176, 76, 6, 'skin', 0.2, 0.25, { clip: true })
  ]
})

// ── Torso ──
parts.push({
  id: 'torso-tee',
  slot: 'torso',
  layers: [
    ...mirrored(armSkinR(220)),
    { d: sym(trunkHalf(167, 328)), grad: cyl('outfitA', 94, 226), mask: true },
    ...trunkShade('outfitA', 328),
    {
      d:
        curve([
          [150, 238],
          [158, 246],
          [168, 244]
        ]) +
        ' ' +
        curve([
          [196, 270],
          [184, 286],
          [176, 300]
        ]) +
        ' ' +
        curve([
          [124, 272],
          [134, 290],
          [140, 306]
        ]) +
        ' ' +
        curve([
          [150, 318],
          [162, 322],
          [174, 318]
        ]),
      stroke: 'outfitA',
      shade: -0.3,
      lineWidth: 1,
      alpha: 0.35,
      clip: true
    },
    // Ribbed crew collar
    {
      d: join(
        curve([
          [142.8, 154.5],
          [150, 164],
          [160, 167],
          [170, 164],
          [177.2, 154.5]
        ]),
        curve([
          [175, 158],
          [169, 166.5],
          [160, 170],
          [151, 166.5],
          [145, 158]
        ])
      ),
      fill: 'outfitA',
      shade: -0.12
    },
    ...mirrored(sleeveR(226, 'outfitA')),
    ...handsLayers()
  ]
})

// ── Torso kit extras ──
const foldsD = (...ls: Pt[][]): string => ls.map((l) => curve(l)).join(' ')
const foldLayer = (paint: string, d: string, alpha = 0.35, w = 1, shade = -0.32): L => ({
  d,
  stroke: paint,
  shade,
  lineWidth: w,
  alpha,
  clip: true
})
/** Brushed steel across [x0, x1]. */
const steel = (x0: number, x1: number): Grad =>
  lin(x0, 0, x1, 0, [
    [0, '#3d424a'],
    [0.2, '#858c96'],
    [0.38, '#dde2e7'],
    [0.5, '#a1a8b2'],
    [0.75, '#5e646d'],
    [1, '#33373e']
  ])
const steelDome = (cx: number, cy: number, r: number): Grad =>
  rad(cx - r * 0.35, cy - r * 0.4, r * 1.4, [
    [0, '#f1f3f5'],
    [0.25, '#b3bac3'],
    [0.6, '#6d737c'],
    [1, '#30343a']
  ])
/** Polished gold across [x0, x1]. */
const gold = (x0: number, x1: number): Grad =>
  lin(x0, 0, x1, 0, [
    [0, '#6b4a12'],
    [0.22, '#c9982f'],
    [0.4, '#f7e39a'],
    [0.55, '#d9ac45'],
    [0.8, '#8a6420'],
    [1, '#5a3e0e']
  ])
const goldY = (y0: number, y1: number): Grad =>
  lin(0, y0, 0, y1, [
    [0, '#f7e39a'],
    [0.35, '#d9ac45'],
    [0.7, '#8a6420'],
    [1, '#5a3e0e']
  ])
/** Small round button / rivet with a highlight. */
const stud = (cx: number, cy: number, r: number, paint: string, shade = 0): L[] => [
  {
    d: E(cx, cy, r),
    grad: rad(cx - r * 0.35, cy - r * 0.4, r * 1.3, [
      [0, paint, shade + 0.45],
      [0.5, paint, shade],
      [1, paint, shade - 0.35]
    ])
  }
]

/** Many buttons/rivets in two layers (body + highlight). */
const studs = (pts: Pt[], r: number, paint: string, shade = 0): L[] => [
  { d: pts.map(([x, y]) => E(x, y, r)).join(' '), fill: paint, shade: shade - 0.12 },
  {
    d: pts.map(([x, y]) => E(x - r * 0.3, y - r * 0.35, r * 0.4)).join(' '),
    fill: paint,
    shade: shade + 0.5,
    alpha: 0.8
  }
]

/** Bare shoulders + upper chest (for low necklines), with collarbones. */
const CHEST_SKIN = sym([
  [160, 150],
  [176.5, 149],
  [192, 156],
  [208, 161.5],
  [219, 167],
  [224.5, 178],
  [222, 200],
  [210, 214],
  [185, 222],
  [160, 224]
])
function chestSkin(): L[] {
  return [
    { d: CHEST_SKIN, grad: cyl('skin', 96, 224, -0.26, 0.05, -0.04), mask: true },
    { d: CHEST_SKIN, fill: '#c8745e', alpha: 0.12, blend: 'multiply', clip: true },
    {
      d: foldsD(
        [
          [163, 167.5],
          [175, 164],
          [190, 163],
          [205, 165.5]
        ],
        [
          [157, 167.5],
          [145, 164],
          [130, 163],
          [115, 165.5]
        ]
      ),
      stroke: 'skin',
      shade: -0.32,
      lineWidth: 1.1,
      alpha: 0.3,
      clip: true
    },
    {
      d: foldsD(
        [
          [164, 164.8],
          [176, 161.5],
          [191, 160.6]
        ],
        [
          [156, 164.8],
          [144, 161.5],
          [129, 160.6]
        ]
      ),
      stroke: 'skin',
      shade: 0.22,
      lineWidth: 1,
      alpha: 0.3,
      clip: true
    },
    blob(160, 168, 5, 'skin', -0.3, 0.35, { clip: true }),
    blob(214, 176, 12, 'skin', 0.14, 0.3, { clip: true }),
    blob(106, 176, 12, 'skin', 0.18, 0.36, { clip: true })
  ]
}
/** Full bare arms (both). */
const bareArms = (): L[] => mirrored(armSkinR(164, true))

// Long sleeve + cuff.
const ELBOW_FOLDS = foldsD(
  [
    [210, 282],
    [220, 287],
    [229, 284]
  ],
  [
    [211, 296],
    [219, 293],
    [228, 297]
  ]
)
const longSleeve = (paint: string, g = 2.2, shade = 0, cuff = true): L[] =>
  mirrored([
    ...sleeveR(350, paint, g, 0.6, shade, ELBOW_FOLDS),
    ...(cuff ? [{ d: armBand(342, 357, g * 0.7), fill: paint, shade: shade - 0.08 }] : [])
  ])

// Crew neck collar band
const crewCollar = (paint: string, shade = -0.12, y = 167): L => ({
  d: join(
    curve([
      [142.8, 154.5],
      [150, y - 3],
      [160, y],
      [170, y - 3],
      [177.2, 154.5]
    ]),
    curve([
      [175, 158],
      [169, y + 0.5],
      [160, y + 3.2],
      [151, y + 0.5],
      [145, 158]
    ])
  ),
  fill: paint,
  shade
})

// ── Torso parts ──
parts.push(
  {
    id: 'torso-hoodie',
    slot: 'torso',
    layers: [
      { d: sym(trunkHalf(165, 340, 3)), grad: cyl('outfitA', 94, 226), mask: true },
      ...trunkShade('outfitA', 340),
      { d: RR(90, 327, 140, 16, 0), fill: 'outfitA', shade: -0.1, alpha: 0.8, clip: true },
      foldLayer(
        'outfitA',
        foldsD(
          [
            [140, 329],
            [140.5, 340]
          ],
          [
            [150, 329],
            [150.2, 340]
          ],
          [
            [160, 329],
            [160, 341]
          ],
          [
            [170, 329],
            [169.8, 340]
          ],
          [
            [180, 329],
            [179.5, 340]
          ],
          [
            [196, 256],
            [186, 276],
            [182, 292]
          ],
          [
            [124, 256],
            [134, 276],
            [138, 292]
          ]
        ),
        0.3,
        0.8
      ),
      // Kangaroo pocket
      {
        d: poly([
          [134, 282],
          [186, 282],
          [194, 322],
          [126, 322]
        ]),
        fill: 'outfitA',
        shade: -0.04,
        clip: true
      },
      foldLayer(
        'outfitA',
        'M 134 282 L 186 282 M 134 282 L 126 322 M 186 282 L 194 322 M 128 312 Q 160 316 192 312',
        0.45,
        0.8,
        -0.4
      ),
      // Hood bunched around the neck
      {
        d: smooth([
          [143.5, 149],
          [134, 156],
          [128.5, 168],
          [138, 178],
          [160, 182],
          [182, 178],
          [191.5, 168],
          [186, 156],
          [176.5, 149],
          [175, 160],
          [168, 169],
          [160, 171.5],
          [152, 169],
          [145, 160]
        ]),
        grad: lin(0, 148, 0, 182, [
          [0, 'outfitA', -0.28],
          [0.5, 'outfitA', 0.02],
          [1, 'outfitA', -0.18]
        ])
      },
      {
        d: curve([
          [146, 160],
          [152, 169.5],
          [160, 172],
          [168, 169.5],
          [174, 160]
        ]),
        stroke: 'outfitA',
        shade: -0.5,
        lineWidth: 1.4,
        alpha: 0.5
      },
      // Drawstrings
      {
        d: 'M 153.5 171 Q 152 188 151.5 208 M 166.5 171 Q 168 186 168.8 204',
        stroke: 'accent',
        shade: 0.2,
        lineWidth: 1.3
      },
      {
        d: RR(150.3, 207, 2.4, 5, 1) + ' ' + RR(167.6, 203, 2.4, 5, 1),
        fill: 'accent',
        shade: -0.3
      },
      ...longSleeve('outfitA', 3.2),
      ...handsLayers()
    ]
  },
  {
    id: 'torso-sweater',
    slot: 'torso',
    layers: [
      { d: sym(trunkHalf(166, 334, 1.5)), grad: cyl('outfitA', 94, 226, -0.26, 0.05), mask: true },
      ...trunkShade('outfitA', 334),
      // Cable knit panels + ribbed hem
      {
        d: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
          .map((i) => {
            const y = 176 + i * 10.5
            return `M 153 ${y} C 149 ${y + 3} 149 ${y + 6} 153 ${y + 9} M 167 ${y} C 171 ${y + 3} 171 ${y + 6} 167 ${y + 9} M 136 ${y} L 136 ${y + 9} M 184 ${y} L 184 ${y + 9}`
          })
          .join(' '),
        stroke: 'outfitA',
        shade: -0.35,
        lineWidth: 1.1,
        alpha: 0.35,
        clip: true
      },
      {
        d: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
          .map((i) => {
            const y = 176 + i * 10.5
            return `M 154.5 ${y + 1} C 151 ${y + 3.5} 151 ${y + 5.5} 154.5 ${y + 8}`
          })
          .join(' '),
        stroke: 'outfitA',
        shade: 0.2,
        lineWidth: 0.7,
        alpha: 0.35,
        clip: true
      },
      { d: RR(90, 322, 140, 16, 0), fill: 'outfitA', shade: -0.08, clip: true },
      foldLayer(
        'outfitA',
        Array.from({ length: 24 }, (_, i) => `M ${100 + i * 5} 323 L ${100 + i * 5} 336`).join(' '),
        0.3,
        0.7
      ),
      crewCollar('outfitA', -0.1, 168),
      {
        d: Array.from({ length: 11 }, (_, i) => {
          const t = i / 10
          const x = 145 + t * 30
          const y = 158 + Math.sin(t * Math.PI) * 9.5
          return `M ${x.toFixed(1)} ${y.toFixed(1)} L ${x.toFixed(1)} ${(y + 3).toFixed(1)}`
        }).join(' '),
        stroke: 'outfitA',
        shade: -0.35,
        lineWidth: 0.6,
        alpha: 0.4
      },
      ...longSleeve('outfitA', 2.6),
      ...handsLayers()
    ]
  },
  {
    id: 'torso-dress',
    slot: 'torso',
    layers: [
      ...chestSkin(),
      ...bareArms(),
      {
        d: sym([
          [160, 191],
          [170, 188.5],
          [177, 178],
          [180.5, 163],
          [190.5, 160.5],
          [193.5, 172],
          [200, 190],
          [212.5, 208],
          [210, 240],
          [204.5, 268],
          [203, 292],
          [214, 318],
          [224, 360],
          [234, 415],
          [241, 466],
          [222, 472],
          [200, 475],
          [180, 473.5],
          [160, 476]
        ]),
        grad: cyl('outfitA', 80, 242, -0.24, 0.07),
        mask: true
      },
      { d: RR(100, 222, 120, 30, 0), grad: fadeY(222, 250, 'outfitA', -0.3, 0.28, 0), clip: true },
      blob(146, 206, 12, 'outfitA', 0.2, 0.3, { clip: true }),
      { d: RR(80, 440, 170, 40, 0), grad: fadeY(440, 476, 'outfitA', -0.35, 0, 0.35), clip: true },
      foldLayer(
        'outfitA',
        foldsD(
          [
            [168, 300],
            [172, 380],
            [180, 470]
          ],
          [
            [184, 300],
            [196, 390],
            [210, 472]
          ],
          [
            [198, 305],
            [216, 390],
            [232, 466]
          ],
          [
            [152, 300],
            [148, 380],
            [140, 470]
          ],
          [
            [136, 300],
            [124, 390],
            [110, 472]
          ],
          [
            [122, 305],
            [104, 390],
            [88, 466]
          ]
        ),
        0.32,
        1.4
      ),
      foldLayer(
        'outfitA',
        foldsD(
          [
            [176, 304],
            [184, 384],
            [194, 470]
          ],
          [
            [144, 304],
            [136, 384],
            [126, 470]
          ]
        ),
        0.22,
        1.8,
        0.2
      ),
      // Waist sash
      {
        d: join(
          curve([
            [115, 285],
            [160, 289],
            [205, 285]
          ]),
          curve([
            [205.5, 296],
            [160, 300],
            [114.5, 296]
          ])
        ),
        grad: fadeY(285, 300, 'accent', 0.1, 1, 1)
      },
      {
        d: 'M 116 292 Q 160 296 204 292',
        stroke: 'accent',
        shade: -0.3,
        lineWidth: 0.7,
        alpha: 0.5
      },
      ...handsLayers()
    ]
  },
  {
    id: 'torso-gown',
    slot: 'torso',
    layers: [
      ...chestSkin(),
      ...bareArms(),
      {
        d: sym([
          [160, 197],
          [166, 191],
          [174, 186.5],
          [184, 187],
          [196, 193],
          [210, 199],
          [212, 215],
          [206, 245],
          [201, 270],
          [199, 292],
          [213, 322],
          [224, 380],
          [236, 460],
          [248, 540],
          [258, 612],
          [236, 618],
          [200, 620],
          [160, 621]
        ]),
        grad: cyl('outfitA', 60, 260, -0.26, 0.08),
        mask: true
      },
      blob(180, 205, 10, 'outfitA', 0.25, 0.35, { clip: true }),
      blob(140, 205, 10, 'outfitA', 0.3, 0.4, { clip: true }),
      { d: RR(60, 580, 200, 45, 0), grad: fadeY(578, 621, 'outfitA', -0.35, 0, 0.4), clip: true },
      foldLayer(
        'outfitA',
        foldsD(
          [
            [166, 300],
            [170, 440],
            [176, 616]
          ],
          [
            [180, 300],
            [192, 450],
            [206, 618]
          ],
          [
            [194, 304],
            [214, 450],
            [236, 614]
          ],
          [
            [154, 300],
            [150, 440],
            [144, 616]
          ],
          [
            [140, 300],
            [128, 450],
            [114, 618]
          ],
          [
            [126, 304],
            [106, 450],
            [84, 614]
          ]
        ),
        0.3,
        1.6
      ),
      foldLayer(
        'outfitA',
        foldsD(
          [
            [173, 304],
            [181, 450],
            [191, 617]
          ],
          [
            [147, 304],
            [139, 450],
            [129, 617]
          ],
          [
            [202, 310],
            [226, 460],
            [246, 612]
          ],
          [
            [118, 310],
            [94, 460],
            [74, 612]
          ]
        ),
        0.22,
        2.2,
        0.2
      ),
      // Bodice seam + jeweled waist
      {
        d: 'M 121 293 Q 160 300 199 293',
        stroke: 'accent',
        lineWidth: 2.4
      },
      {
        d: 'M 121 293 Q 160 300 199 293',
        stroke: 'accent',
        shade: 0.45,
        lineWidth: 0.7,
        alpha: 0.7
      },
      ...stud(160, 297, 2.4, 'accent'),
      {
        d: 'M 160 197 Q 164 196 166 191 M 124 199 Q 142 188 154 191',
        stroke: 'outfitA',
        shade: -0.4,
        lineWidth: 0.7,
        alpha: 0.4
      },
      ...handsLayers()
    ]
  },
  {
    id: 'torso-suit',
    slot: 'torso',
    layers: [
      // Shirt + tie in the V
      {
        d: sym([
          [160, 156],
          [176, 152],
          [182, 170],
          [178, 250],
          [170, 290],
          [160, 292]
        ]),
        grad: lin(140, 0, 180, 0, [
          [0, '#d9d5cc'],
          [0.4, '#f1eee8'],
          [1, '#c9c4ba']
        ])
      },
      {
        d: smooth([
          [156.8, 168],
          [163.2, 168],
          [162.6, 174],
          [166, 238],
          [160, 250],
          [154, 238],
          [157.4, 174]
        ]),
        grad: cyl('accent', 153, 167, -0.3, 0.1)
      },
      {
        d: 'M 157.2 175 L 162.8 175 M 156 190 L 164.5 184 M 155.5 206 L 165 200 M 155 222 L 165.5 216',
        stroke: 'accent',
        shade: -0.35,
        lineWidth: 0.7,
        alpha: 0.4
      },
      { d: RR(155.6, 162.5, 8.8, 7, 2.5), fill: 'accent', shade: -0.08 },
      // Shirt collar points
      {
        d:
          poly([
            [146, 154],
            [157, 168.5],
            [150, 172]
          ]) +
          ' ' +
          poly([
            [174, 154],
            [163, 168.5],
            [170, 172]
          ]),
        fill: '#ebe8e1'
      },
      {
        d: 'M 146 154 L 157 168.5 L 150 172 M 174 154 L 163 168.5 L 170 172',
        stroke: '#a9a397',
        lineWidth: 0.5,
        alpha: 0.7
      },
      // Jacket (V opening)
      {
        d: sym([
          [160, 264],
          [165.5, 234],
          [171, 204],
          [176.5, 170],
          [180, 153.5],
          [192, 158],
          [208, 163],
          [219, 169],
          [224, 180],
          [221, 210],
          [213, 240],
          [207.5, 268],
          [206.5, 292],
          [209, 312],
          [213, 338],
          [190, 341],
          [160, 342]
        ]),
        grad: cyl('outfitA', 94, 226, -0.26, 0.05),
        mask: true
      },
      ...trunkShade('outfitA', 341),
      foldLayer(
        'outfitA',
        foldsD(
          [
            [196, 272],
            [186, 290],
            [178, 306]
          ],
          [
            [124, 272],
            [134, 290],
            [142, 306]
          ],
          [
            [184, 316],
            [206, 316]
          ],
          [
            [136, 316],
            [114, 316]
          ]
        ),
        0.4,
        0.9
      ),
      foldLayer('outfitA', 'M 160 264 L 160 342', 0.45, 0.8, -0.45),
      // Lapels
      ...mirrored([
        {
          d: smooth(
            [
              [178.5, 153.5],
              [184.5, 166],
              [187.5, 184],
              [182, 188],
              [183, 196],
              [172, 228],
              [161.5, 262],
              [165.5, 232],
              [171, 204],
              [176.5, 171]
            ],
            true,
            0.7
          ),
          grad: lin(165, 0, 188, 0, [
            [0, 'outfitA', 0.08],
            [1, 'outfitA', -0.2]
          ])
        },
        {
          d: curve([
            [183, 196],
            [172, 228],
            [161.5, 262]
          ]),
          stroke: 'outfitA',
          shade: -0.5,
          lineWidth: 0.9,
          alpha: 0.5
        }
      ]),
      ...studs(
        [
          [160, 272],
          [160, 298]
        ],
        1.9,
        'outfitA',
        -0.3
      ),
      {
        d: poly([
          [128, 212],
          [140, 208.5],
          [142, 212.5],
          [130, 215.5]
        ]),
        fill: 'accent',
        shade: 0.2
      },
      { d: 'M 125 216.5 L 144 212', stroke: 'outfitA', shade: -0.45, lineWidth: 0.8, alpha: 0.5 },
      ...mirrored([
        { d: armBand(346, 358, 1.6), fill: '#ebe8e1' },
        ...sleeveR(349, 'outfitA', 2.2, 0.4, -0.02)
      ]),
      ...handsLayers()
    ]
  },
  {
    id: 'torso-robe',
    slot: 'torso',
    layers: [
      // Under-tunic in the V
      {
        d: sym([
          [160, 158],
          [176, 152],
          [182, 180],
          [172, 230],
          [160, 236]
        ]),
        grad: cyl('outfitB', 140, 182, -0.3, 0.05)
      },
      {
        d: sym([
          [160, 222],
          [168, 196],
          [176.5, 166],
          [179.5, 153.5],
          [192, 158],
          [208, 163],
          [219, 169],
          [224, 180],
          [222, 212],
          [216, 250],
          [214, 290],
          [220, 340],
          [228, 400],
          [236, 470],
          [243, 540],
          [248, 608],
          [230, 614],
          [200, 616],
          [160, 617]
        ]),
        grad: cyl('outfitA', 70, 250, -0.28, 0.06),
        mask: true
      },
      ...trunkShade('outfitA', 400),
      { d: RR(60, 580, 200, 40, 0), grad: fadeY(578, 617, 'outfitA', -0.35, 0, 0.4), clip: true },
      foldLayer(
        'outfitA',
        foldsD(
          [
            [170, 306],
            [176, 450],
            [184, 614]
          ],
          [
            [188, 306],
            [202, 450],
            [218, 612]
          ],
          [
            [150, 306],
            [144, 450],
            [136, 614]
          ],
          [
            [132, 306],
            [118, 450],
            [102, 612]
          ]
        ),
        0.35,
        1.5
      ),
      foldLayer(
        'outfitA',
        foldsD(
          [
            [179, 308],
            [189, 450],
            [200, 614]
          ],
          [
            [141, 308],
            [131, 450],
            [120, 614]
          ]
        ),
        0.25,
        2,
        0.2
      ),
      // Trim down the crossover
      ...mirrored([
        {
          d: join(
            curve([
              [179.5, 153.5],
              [176.5, 166],
              [168, 196],
              [160.5, 222]
            ]),
            curve([
              [164.8, 224],
              [172.5, 198],
              [181, 168],
              [184.2, 155]
            ])
          ),
          grad: gold(162, 184)
        }
      ]),
      // Rope belt
      {
        d: join(
          curve([
            [110, 290],
            [160, 295],
            [212, 290]
          ]),
          curve([
            [212, 297],
            [160, 302],
            [110, 297]
          ])
        ),
        grad: fadeY(290, 302, 'outfitB', 0.15, 1, 1)
      },
      {
        d: Array.from({ length: 20 }, (_, i) => {
          const x = 113 + i * 5
          return `M ${x} ${291 + Math.sin(((x - 110) / 102) * Math.PI) * 5} l 2.4 5.5`
        }).join(' '),
        stroke: 'outfitB',
        shade: -0.4,
        lineWidth: 0.6,
        alpha: 0.6
      },
      {
        d: 'M 146 300 Q 144 330 146 360 M 152 300 Q 153 326 151 352',
        stroke: 'outfitB',
        shade: 0.1,
        lineWidth: 2.6
      },
      { d: E(146, 362, 2.6, 3.4) + ' ' + E(151, 354, 2.6, 3.4), fill: 'outfitB', shade: -0.15 },
      // Bell sleeves (hands emerge from inside)
      ...handsLayers(),
      ...mirrored([
        { d: armBand(164, 374, 3, true, 13), grad: armGrad('outfitA'), mask: true },
        { d: E(221.5, 372.5, 15, 3.5), fill: 'outfitA', shade: -0.55, clip: true },
        foldLayer(
          'outfitA',
          foldsD(
            [
              [210, 240],
              [210, 300],
              [206, 368]
            ],
            [
              [228, 250],
              [232, 310],
              [236, 368]
            ],
            [
              [219, 280],
              [220, 330],
              [222, 370]
            ]
          ),
          0.35,
          1.1
        ),
        {
          d: curve([
            [203, 372],
            [221.5, 376.5],
            [240, 372]
          ]),
          stroke: 'accent',
          lineWidth: 1.6
        }
      ])
    ]
  },
  {
    id: 'torso-armor',
    slot: 'torso',
    layers: [
      // Padded gambeson under the plate
      { d: sym(trunkHalf(166, 344, 2)), grad: cyl('outfitA', 94, 226) },
      ...longSleeve('outfitA', 2.6, -0.05, false),
      // Vambraces + leather gauntlets
      ...mirrored([
        { d: armBand(296, 356, 2.4), grad: steel(206, 236) },
        { d: armBand(296, 300, 2.8), grad: gold(206, 236) }
      ]),
      ...handsLayers('accent', -0.5),
      // Breastplate
      {
        d: sym([
          [160, 163],
          [172, 161.5],
          [184, 161.5],
          [199, 167],
          [212, 180],
          [214.5, 210],
          [209, 240],
          [201.5, 268],
          [197, 290],
          [180, 297],
          [160, 299]
        ]),
        grad: steel(104, 216),
        mask: true
      },
      { d: 'M 160 166 L 160 296', stroke: '#f4f6f8', lineWidth: 1.2, alpha: 0.55, clip: true },
      { d: 'M 161.3 166 L 161.3 296', stroke: '#2a2d33', lineWidth: 0.8, alpha: 0.45, clip: true },
      blob(146, 206, 18, '#ffffff', 0, 0.35, { clip: true }),
      blob(186, 262, 30, '#16181c', 0, 0.22, { clip: true }),
      {
        d: curve([
          [109, 180],
          [135, 168],
          [160, 166],
          [185, 168],
          [211, 180]
        ]),
        stroke: '#c9982f',
        lineWidth: 2.2
      },
      // Faulds (hip lames)
      ...[0, 1].map((i): L => ({
        d: join(
          curve([
            [123 - i * 3, 292 + i * 12],
            [160, 297 + i * 12],
            [197 + i * 3, 292 + i * 12]
          ]),
          curve([
            [199 + i * 3, 306 + i * 12],
            [160, 311 + i * 12],
            [121 - i * 3, 306 + i * 12]
          ])
        ),
        grad: lin(0, 292 + i * 12, 0, 311 + i * 12, [
          [0, '#e3e7eb'],
          [0.35, '#9aa1ab'],
          [1, '#3f444b']
        ])
      })),
      {
        d: 'M 121 306 Q 160 311 199 306 M 118 318 Q 160 323 202 318',
        stroke: '#c9982f',
        lineWidth: 1.1,
        alpha: 0.85
      },
      // Gorget
      {
        d: join(
          curve([
            [142, 151],
            [160, 158],
            [178, 151]
          ]),
          curve([
            [183, 164],
            [160, 172],
            [137, 164]
          ])
        ),
        grad: lin(0, 151, 0, 172, [
          [0, '#e5e9ed'],
          [0.5, '#8d949e'],
          [1, '#3b3f46']
        ])
      },
      // Pauldrons: three overlapping lames each
      ...mirrored([
        {
          d: smooth([
            [199, 164],
            [214, 160],
            [229, 168],
            [235, 182],
            [226, 188],
            [210, 184],
            [200, 176]
          ]),
          grad: steelDome(214, 172, 20)
        },
        {
          d: smooth([
            [207, 184],
            [223, 186],
            [236.5, 190],
            [236, 199],
            [222, 197],
            [208, 193]
          ]),
          grad: steelDome(222, 190, 16)
        },
        {
          d: smooth([
            [209, 196],
            [223, 199],
            [236, 202],
            [235.5, 210],
            [222, 208.5],
            [210, 204.5]
          ]),
          grad: steelDome(222, 202, 15)
        },
        {
          d: curve([
            [201, 166],
            [214, 161.5],
            [228, 168.5]
          ]),
          stroke: '#c9982f',
          lineWidth: 1.4
        }
      ])
    ]
  },
  {
    id: 'torso-coat',
    slot: 'torso',
    layers: [
      // Inner shirt
      { d: sym(trunkHalf(166, 332)), grad: cyl('outfitB', 94, 226), mask: true },
      ...trunkShade('outfitB', 332),
      crewCollar('outfitB', -0.12, 166),
      // Coat panels hanging open
      ...mirrored([
        {
          d: smooth(
            [
              [172, 160],
              [182, 154],
              [196, 158],
              [210, 163],
              [220, 169],
              [225, 182],
              [223, 212],
              [217, 245],
              [212.5, 275],
              [212, 300],
              [216, 340],
              [221, 390],
              [225, 440],
              [227.5, 498],
              [210, 501],
              [180, 501.5],
              [172.5, 500],
              [170, 450],
              [168.5, 400],
              [167.5, 350],
              [167, 300],
              [167, 270],
              [169.5, 230],
              [174, 196],
              [174.5, 170]
            ],
            true,
            0.8
          ),
          grad: cyl('outfitA', 160, 230, -0.3, 0.06),
          mask: true
        },
        blob(212, 208, 16, 'outfitA', -0.4, 0.4, { clip: true }),
        foldLayer(
          'outfitA',
          foldsD(
            [
              [186, 320],
              [190, 410],
              [192, 498]
            ],
            [
              [204, 322],
              [212, 410],
              [218, 496]
            ],
            [
              [212, 270],
              [200, 292],
              [190, 306]
            ]
          ),
          0.35,
          1.2
        ),
        {
          d: smooth(
            [
              [174.5, 158],
              [183, 153],
              [190, 162],
              [192, 186],
              [186, 190],
              [187, 198],
              [176, 228],
              [168.5, 262],
              [169.5, 230],
              [174, 196],
              [174.5, 170]
            ],
            true,
            0.7
          ),
          grad: lin(168, 0, 192, 0, [
            [0, 'outfitA', 0.1],
            [1, 'outfitA', -0.22]
          ])
        },
        {
          d: curve([
            [187, 198],
            [176, 228],
            [168.5, 262]
          ]),
          stroke: 'outfitA',
          shade: -0.5,
          lineWidth: 1,
          alpha: 0.5
        },
        ...studs(
          [
            [173.5, 290],
            [173.5, 318],
            [173.5, 346]
          ],
          1.9,
          'accent',
          -0.25
        )
      ]),
      ...longSleeve('outfitA', 3, -0.02),
      ...handsLayers()
    ]
  },
  {
    id: 'torso-tunic',
    slot: 'torso',
    layers: [
      {
        d: sym([
          [160, 200],
          [166, 184],
          [172, 166],
          [176.5, 154],
          [192, 158],
          [208, 163],
          [219, 169],
          [224, 180],
          [221, 210],
          [213, 240],
          [208.5, 268],
          [208, 292],
          [214, 330],
          [220, 370],
          [223, 404],
          [200, 408],
          [160, 409]
        ]),
        grad: cyl('outfitA', 94, 226, -0.28, 0.06),
        mask: true
      },
      ...trunkShade('outfitA', 408),
      foldLayer(
        'outfitA',
        foldsD(
          [
            [172, 306],
            [176, 356],
            [180, 406]
          ],
          [
            [192, 306],
            [202, 356],
            [210, 404]
          ],
          [
            [148, 306],
            [144, 356],
            [140, 406]
          ],
          [
            [128, 306],
            [118, 356],
            [110, 404]
          ],
          [
            [150, 240],
            [160, 250],
            [170, 240]
          ]
        ),
        0.35,
        1.2
      ),
      // Embroidered hem band
      { d: RR(80, 393, 160, 5.5, 0), fill: 'accent', clip: true },
      {
        d: Array.from({ length: 30 }, (_, i) => `M ${96 + i * 4.4} 394 l 2.2 3.4 l 2.2 -3.4`).join(
          ' '
        ),
        stroke: 'accent',
        shade: -0.4,
        lineWidth: 0.6,
        alpha: 0.7,
        clip: true
      },
      // Laced V-neck
      {
        d: sym([
          [160, 200],
          [166, 184],
          [172, 166],
          [176.5, 154],
          [170, 154],
          [160, 156]
        ]),
        grad: cyl('skin', 144, 176, -0.3, 0.04, -0.06)
      },
      {
        d:
          join(
            curve([
              [176.5, 154],
              [172, 166],
              [166, 184],
              [160, 200]
            ]),
            curve([
              [162.5, 203],
              [169, 186],
              [175, 168],
              [179.5, 155]
            ])
          ) +
          ' ' +
          join(
            curve([
              [143.5, 154],
              [148, 166],
              [154, 184],
              [160, 200]
            ]),
            curve([
              [157.5, 203],
              [151, 186],
              [145, 168],
              [140.5, 155]
            ])
          ),
        fill: 'accent',
        shade: -0.1
      },
      {
        d: 'M 151.5 172 L 168.5 180 M 168.5 172 L 151.5 180 M 154 184 L 166 191 M 166 184 L 154 191',
        stroke: 'outfitB',
        shade: 0.2,
        lineWidth: 0.9
      },
      // Belt with buckle
      {
        d: join(
          curve([
            [111, 289],
            [160, 293],
            [210, 289]
          ]),
          curve([
            [210.5, 299],
            [160, 303],
            [110.5, 299]
          ])
        ),
        grad: fadeY(289, 303, 'outfitB', -0.1, 1, 1)
      },
      {
        d: 'M 112 291.5 Q 160 295.5 209 291.5 M 112 300 Q 160 304 209 300',
        stroke: 'outfitB',
        shade: 0.25,
        lineWidth: 0.5,
        alpha: 0.5
      },
      { d: RR(154, 289.5, 12, 12, 2), stroke: 'accent', lineWidth: 2.2 },
      { d: 'M 166 295.5 L 176 295.8', stroke: 'outfitB', shade: -0.2, lineWidth: 5 },
      ...longSleeve('outfitA', 3, -0.02),
      ...handsLayers()
    ]
  },
  {
    id: 'torso-uniform',
    slot: 'torso',
    layers: [
      { d: sym(trunkHalf(158, 342)), grad: cyl('outfitA', 94, 226, -0.26, 0.05), mask: true },
      ...trunkShade('outfitA', 342),
      foldLayer('outfitA', 'M 160 162 L 160 342', 0.4, 0.8, -0.45),
      foldLayer(
        'outfitA',
        foldsD(
          [
            [196, 272],
            [186, 290],
            [178, 306]
          ],
          [
            [124, 272],
            [134, 290],
            [142, 306]
          ]
        ),
        0.35,
        0.9
      ),
      // Standing collar with trim
      {
        d: join(
          curve([
            [143, 147],
            [160, 151],
            [177, 147]
          ]),
          curve([
            [178, 157],
            [160, 162],
            [142, 157]
          ])
        ),
        grad: fadeY(147, 162, 'outfitA', -0.1, 1, 1)
      },
      { d: 'M 142.6 156 Q 160 161 177.4 156', stroke: 'accent', lineWidth: 1.4 },
      // Double row of buttons
      ...studs(
        [0, 1, 2, 3, 4].flatMap((i): Pt[] => [
          [148, 180 + i * 26],
          [172, 180 + i * 26]
        ]),
        2,
        'accent'
      ),
      // Belt
      {
        d: join(
          curve([
            [111, 290],
            [160, 294],
            [210, 290]
          ]),
          curve([
            [210.5, 300],
            [160, 304],
            [110.5, 300]
          ])
        ),
        grad: fadeY(290, 304, 'outfitB', 0.05, 1, 1)
      },
      { d: RR(154, 290.5, 12, 11.5, 1.5), grad: gold(154, 166) },
      // Aiguillette cord across the chest
      {
        d: 'M 206 170 C 196 200 176 214 150 206 M 206 172 C 198 214 180 226 156 222',
        stroke: 'accent',
        lineWidth: 1.5
      },
      {
        d: 'M 206 170 C 196 200 176 214 150 206 M 206 172 C 198 214 180 226 156 222',
        stroke: 'accent',
        shade: 0.45,
        lineWidth: 0.5,
        alpha: 0.7
      },
      ...longSleeve('outfitA', 2.4, 0, false),
      ...mirrored([
        { d: armBand(336, 356, 1.9), fill: 'outfitA', shade: -0.08 },
        {
          d: foldsD(
            [
              [armAt(338)[1] - 2, 338],
              [armAt(338)[0] + 2, 338]
            ],
            [
              [armAt(342)[1] - 2, 342],
              [armAt(342)[0] + 2, 342]
            ]
          ),
          stroke: 'accent',
          lineWidth: 1.1
        },
        // Epaulettes with bullion fringe
        {
          d: smooth([
            [197, 160],
            [214, 161],
            [226, 168],
            [227, 176],
            [213, 175],
            [199, 169]
          ]),
          grad: gold(198, 228)
        },
        {
          d: Array.from(
            { length: 9 },
            (_, i) => `M ${212 + i * 1.8} ${174.5 + i * 0.1} l 0.4 7`
          ).join(' '),
          stroke: '#d9ac45',
          lineWidth: 1.2
        },
        ...stud(201.5, 164.5, 1.5, '#d9ac45')
      ]),
      ...handsLayers()
    ]
  }
)

// ── Legs ──
parts.push({
  id: 'legs-pants',
  slot: 'legs',
  layers: [
    { d: sym(pantsHalf(600, 171, 202)), grad: legsGrad('outfitB'), mask: true },
    {
      d:
        curve([
          [166, 386],
          [174, 400],
          [178, 420]
        ]) +
        ' ' +
        curve([
          [154, 386],
          [146, 400],
          [142, 420]
        ]) +
        ' ' +
        curve([
          [176, 492],
          [186, 486],
          [198, 492]
        ]) +
        ' ' +
        curve([
          [122, 492],
          [134, 486],
          [144, 492]
        ]) +
        ' ' +
        curve([
          [178, 572],
          [188, 578],
          [198, 574]
        ]) +
        ' ' +
        curve([
          [122, 574],
          [132, 578],
          [142, 572]
        ]),
      stroke: 'outfitB',
      shade: -0.35,
      lineWidth: 1,
      alpha: 0.4,
      clip: true
    },
    blob(186, 470, 10, 'outfitB', 0.18, 0.25, { clip: true }),
    blob(134, 470, 10, 'outfitB', 0.18, 0.3, { clip: true }),
    {
      d: 'M 160 300 L 160 372',
      stroke: 'outfitB',
      shade: -0.35,
      lineWidth: 0.8,
      alpha: 0.5,
      clip: true
    }
  ]
})

// ── Feet ──
const SNEAKER_R = smooth([
  [174, 596],
  [186, 594],
  [198.5, 596],
  [202.5, 606],
  [204, 615],
  [201, 620],
  [186, 621],
  [171, 620],
  [168.5, 614],
  [170, 604]
])
parts.push({
  id: 'feet-sneakers',
  slot: 'feet',
  layers: mirrored([
    { d: SNEAKER_R, grad: cyl('accent', 168, 205, -0.3, 0.1), mask: true },
    { d: RR(160, 612.5, 50, 12, 2), fill: '#ece8e1', clip: true },
    { d: RR(160, 612.5, 50, 2, 1), fill: '#bdb6ab', alpha: 0.6, clip: true },
    {
      d: 'M 180 598.5 L 192 602.5 M 192 598.5 L 180 602.5 M 181 602.5 L 191 606.5 M 191 602.5 L 181 606.5',
      stroke: '#f2efe8',
      lineWidth: 0.9,
      alpha: 0.85,
      clip: true
    },
    blob(180, 609, 6, 'accent', 0.4, 0.3, { clip: true })
  ])
})

// ─────────────────────────────────────────────────────────────────────────────
// ── More legs ──
const waistband = (paint: string, shade = -0.1): L => ({
  d: join(
    curve([
      [113, 296.5],
      [160, 295],
      [207, 296.5]
    ]),
    curve([
      [208, 305],
      [160, 303.5],
      [112, 305]
    ])
  ),
  fill: paint,
  shade
})
parts.push(
  {
    id: 'legs-shorts',
    slot: 'legs',
    layers: [
      ...legsSkin(),
      {
        d: sym([
          [160, 296],
          [186, 295.5],
          [206, 297],
          [212, 318],
          [217.5, 345],
          [219.5, 372],
          [219, 408],
          [217.5, 438],
          [192, 442],
          [165.5, 439],
          [163.5, 414],
          [161, 384],
          [160, 381]
        ]),
        grad: legsGrad('outfitB'),
        mask: true
      },
      { d: RR(100, 428, 120, 16, 0), fill: 'outfitB', shade: -0.08, clip: true },
      foldLayer(
        'outfitB',
        foldsD(
          [
            [166, 386],
            [176, 400],
            [180, 420]
          ],
          [
            [154, 386],
            [144, 400],
            [140, 420]
          ],
          [
            [104, 429],
            [138, 431.5],
            [155, 429]
          ],
          [
            [165, 429],
            [182, 431.5],
            [216, 429]
          ]
        ),
        0.4,
        0.9
      ),
      {
        d: 'M 160 300 L 160 372',
        stroke: 'outfitB',
        shade: -0.35,
        lineWidth: 0.8,
        alpha: 0.5,
        clip: true
      },
      {
        d: 'M 206 310 Q 196 322 197 340 M 114 310 Q 124 322 123 340',
        stroke: 'outfitB',
        shade: -0.35,
        lineWidth: 0.8,
        alpha: 0.45,
        clip: true
      }
    ]
  },
  {
    id: 'legs-skirt',
    slot: 'legs',
    layers: [
      ...legsSkin(),
      {
        d: sym([
          [160, 296],
          [186, 295],
          [205, 297],
          [213, 320],
          [222, 360],
          [231, 410],
          [237, 462],
          [214, 467],
          [190, 468],
          [160, 470]
        ]),
        grad: cyl('outfitB', 82, 238, -0.26, 0.07),
        mask: true
      },
      { d: RR(80, 440, 160, 32, 0), grad: fadeY(440, 470, 'outfitB', -0.35, 0, 0.35), clip: true },
      foldLayer(
        'outfitB',
        foldsD(
          [
            [170, 310],
            [176, 390],
            [182, 468]
          ],
          [
            [188, 312],
            [202, 390],
            [214, 466]
          ],
          [
            [150, 310],
            [144, 390],
            [138, 468]
          ],
          [
            [132, 312],
            [118, 390],
            [106, 466]
          ]
        ),
        0.35,
        1.4
      ),
      foldLayer(
        'outfitB',
        foldsD(
          [
            [178, 312],
            [188, 390],
            [196, 468]
          ],
          [
            [142, 312],
            [132, 390],
            [124, 468]
          ]
        ),
        0.22,
        2,
        0.2
      ),
      waistband('outfitB')
    ]
  },
  {
    id: 'legs-longskirt',
    slot: 'legs',
    layers: [
      ...legsSkin(),
      {
        d: sym([
          [160, 296],
          [186, 295],
          [205, 297],
          [213, 325],
          [222, 380],
          [230, 450],
          [237, 520],
          [242, 598],
          [226, 603],
          [200, 604],
          [160, 606]
        ]),
        grad: cyl('outfitB', 76, 244, -0.26, 0.07),
        mask: true,
        sway: 0.6
      },
      {
        d: RR(70, 570, 180, 40, 0),
        grad: fadeY(570, 606, 'outfitB', -0.35, 0, 0.35),
        clip: true,
        sway: 0.6
      },
      foldLayer(
        'outfitB',
        foldsD(
          [
            [168, 312],
            [174, 460],
            [180, 604]
          ],
          [
            [184, 314],
            [200, 460],
            [216, 602]
          ],
          [
            [198, 320],
            [218, 460],
            [236, 598]
          ],
          [
            [152, 312],
            [146, 460],
            [140, 604]
          ],
          [
            [136, 314],
            [120, 460],
            [104, 602]
          ],
          [
            [122, 320],
            [102, 460],
            [84, 598]
          ]
        ),
        0.32,
        1.5
      ),
      foldLayer(
        'outfitB',
        foldsD(
          [
            [176, 314],
            [187, 460],
            [198, 604]
          ],
          [
            [144, 314],
            [133, 460],
            [122, 604]
          ]
        ),
        0.22,
        2.2,
        0.2
      ),
      waistband('outfitB')
    ]
  },
  {
    id: 'legs-jeans',
    slot: 'legs',
    layers: [
      { d: sym(pantsHalf(598, 170, 203, 1)), grad: legsGrad('outfitB', 0.04), mask: true },
      // Worn fades on the thighs and knees
      blob(186, 410, 14, 'outfitB', 0.3, 0.35, { clip: true }),
      blob(134, 410, 14, 'outfitB', 0.35, 0.4, { clip: true }),
      blob(186, 488, 9, 'outfitB', 0.28, 0.3, { clip: true }),
      blob(134, 488, 9, 'outfitB', 0.32, 0.35, { clip: true }),
      // Rolled cuffs
      { d: RR(100, 586, 120, 14, 0), fill: 'outfitB', shade: 0.12, clip: true },
      foldLayer(
        'outfitB',
        foldsD(
          [
            [166, 386],
            [174, 400],
            [178, 420]
          ],
          [
            [154, 386],
            [146, 400],
            [142, 420]
          ],
          [
            [176, 492],
            [186, 486],
            [198, 492]
          ],
          [
            [122, 492],
            [134, 486],
            [144, 492]
          ],
          [
            [170, 587],
            [203, 587]
          ],
          [
            [117, 587],
            [150, 587]
          ]
        ),
        0.45,
        0.9
      ),
      // Contrast stitching: fly, pockets, yoke, outseam
      {
        d:
          'M 163 300 L 163 356 Q 162 366 158 372 M 204 306 Q 192 316 190 334 M 116 306 Q 128 316 130 334 ' +
          'M 208 300 L 215 350 L 216 380 M 112 300 L 105 350 L 104 380 M 118 304 L 202 304',
        stroke: '#c9a063',
        lineWidth: 0.55,
        alpha: 0.75,
        clip: true
      },
      ...stud(191, 334, 1, '#b07a3a'),
      ...stud(129, 334, 1, '#b07a3a'),
      waistband('outfitB', 0.02),
      { d: RR(157.5, 297, 5, 5, 1.2), grad: gold(157.5, 162.5) }
    ]
  },
  {
    id: 'legs-leggings',
    slot: 'legs',
    layers: [
      ...mirrored([
        { d: LEG_R, grad: cyl('outfitB', 160, 216, -0.3, 0.1), mask: true },
        blob(187, 400, 12, 'outfitB', 0.25, 0.3, { clip: true }),
        blob(186, 490, 8, 'outfitB', 0.3, 0.32, { clip: true }),
        foldLayer('outfitB', 'M 180 497 Q 186 500.5 193 497 M 172 590 Q 186 594 197 590', 0.4, 0.7)
      ]),
      { d: RR(111, 296, 98, 12, 3), fill: 'outfitB', shade: -0.12 }
    ]
  }
)

// ── More feet ──
const FOOT_R = smooth([
  [177, 590],
  [195, 590],
  [198, 600],
  [202, 610],
  [203.5, 617],
  [200, 620.5],
  [186, 621],
  [172, 620.5],
  [169, 616],
  [171, 606],
  [175, 598]
])
const bareFeet = (): L[] =>
  mirrored([
    { d: FOOT_R, grad: cyl('skin', 168, 204, -0.3, 0.06, -0.04), mask: true },
    blob(186, 604, 7, 'skin', 0.2, 0.3, { clip: true }),
    {
      d: 'M 178 617 Q 179 620 181.5 620.5 M 184 617.5 Q 185 620.5 187.5 621 M 190 617.5 Q 191 620.5 193.5 620.5 M 195.5 616.5 Q 197 619.5 199 619.5',
      stroke: 'skin',
      shade: -0.4,
      lineWidth: 0.55,
      alpha: 0.5,
      clip: true
    }
  ])
const BOOT_R = smooth([
  [170.5, 527],
  [203.5, 527],
  [203, 560],
  [200, 590],
  [202.5, 606],
  [204.5, 615],
  [201, 620.5],
  [186, 621.5],
  [171, 620.5],
  [168, 614],
  [170, 600],
  [172, 580],
  [171, 550]
])
const OXFORD_R = smooth([
  [174, 598.5],
  [186, 597],
  [198, 598.5],
  [202, 607],
  [203.5, 615.5],
  [200.5, 620],
  [186, 621],
  [171.5, 620],
  [168.5, 615.5],
  [170, 606]
])
const PUMP_R = smooth([
  [171, 609],
  [186, 605.5],
  [201, 609],
  [203.5, 615.5],
  [194, 621],
  [186, 622.5],
  [178, 621],
  [168.5, 615.5]
])
parts.push(
  {
    id: 'feet-boots',
    slot: 'feet',
    layers: mirrored([
      { d: BOOT_R, grad: cyl('accent', 168, 206, -0.34, 0.12, -0.4), mask: true },
      { d: RR(160, 614.5, 50, 10, 2), fill: '#2a211c', clip: true },
      { d: RR(160, 527, 50, 9, 0), fill: 'accent', shade: -0.5, clip: true },
      {
        d: 'M 171 536 Q 187 538.5 203.5 536',
        stroke: 'accent',
        shade: -0.2,
        lineWidth: 0.7,
        alpha: 0.6,
        clip: true
      },
      blob(180, 560, 7, 'accent', 0.1, 0.35, { clip: true }),
      blob(180, 608, 6, 'accent', 0.15, 0.4, { clip: true }),
      foldLayer(
        'accent',
        'M 173 590 Q 187 587 200 590 M 174 596 Q 187 593.5 200.5 596',
        0.4,
        0.7,
        -0.7
      ),
      { d: RR(172, 574, 31, 4, 1), fill: 'accent', shade: -0.6, clip: true },
      { d: RR(193, 572.5, 5, 7, 1), grad: gold(193, 198), clip: true }
    ])
  },
  {
    id: 'feet-sandals',
    slot: 'feet',
    layers: [
      ...bareFeet(),
      ...mirrored([
        { d: RR(168, 618.5, 37, 3.5, 1.5), fill: 'accent', shade: -0.5 },
        {
          d: join(
            curve([
              [171.5, 607],
              [186, 604],
              [201, 607]
            ]),
            curve([
              [202, 611],
              [186, 608.5],
              [170.5, 611]
            ])
          ),
          fill: 'accent',
          shade: -0.35
        },
        {
          d: join(
            curve([
              [175, 595],
              [186, 593],
              [197, 595]
            ]),
            curve([
              [197.5, 598.5],
              [186, 596.5],
              [174.5, 598.5]
            ])
          ),
          fill: 'accent',
          shade: -0.35
        },
        { d: 'M 186 597 L 186 605', stroke: 'accent', shade: -0.45, lineWidth: 1.6 }
      ])
    ]
  },
  {
    id: 'feet-oxfords',
    slot: 'feet',
    layers: mirrored([
      { d: OXFORD_R, grad: cyl('accent', 168, 205, -0.3, 0.1, -0.62), mask: true },
      { d: RR(160, 617.5, 50, 6, 1), fill: '#1c1512', clip: true },
      { d: 'M 178 600 L 194 600 L 192 608 L 180 608 Z', fill: 'accent', shade: -0.72, clip: true },
      {
        d: 'M 180.5 602 L 191.5 602 M 181 605 L 191 605',
        stroke: 'accent',
        shade: -0.4,
        lineWidth: 0.5,
        alpha: 0.8,
        clip: true
      },
      {
        d: 'M 171.5 612 Q 186 609 201.5 612',
        stroke: '#0f0b09',
        lineWidth: 0.6,
        alpha: 0.5,
        clip: true
      },
      blob(181, 613, 4.5, '#ffffff', 0, 0.35, { clip: true })
    ])
  },
  {
    id: 'feet-heels',
    slot: 'feet',
    layers: [
      ...bareFeet(),
      ...mirrored([
        { d: PUMP_R, grad: cyl('accent', 168, 205, -0.3, 0.12, -0.1), mask: true },
        blob(181, 612, 4.5, '#ffffff', 0, 0.35, { clip: true }),
        {
          d: curve([
            [171, 609.2],
            [186, 605.8],
            [201, 609.2]
          ]),
          stroke: 'accent',
          shade: -0.35,
          lineWidth: 0.6,
          alpha: 0.6
        },
        { d: 'M 176.5 594 Q 186 591.5 195.5 594', stroke: 'accent', shade: -0.1, lineWidth: 1.3 }
      ])
    ]
  }
)

// ── Back (behind the body in `back`; straps/clasps in front in `layers`) ──
const strapAcross = (from: Pt, to: Pt, w: number, paint: string, shade = -0.2): L[] => {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const len = Math.hypot(dx, dy)
  const nx = (-dy / len) * (w / 2)
  const ny = (dx / len) * (w / 2)
  const d = poly([
    [from[0] + nx, from[1] + ny],
    [to[0] + nx, to[1] + ny],
    [to[0] - nx, to[1] - ny],
    [from[0] - nx, from[1] - ny]
  ])
  return [
    {
      d,
      grad: lin(from[0] + nx, from[1] + ny, from[0] - nx, from[1] - ny, [
        [0, paint, shade + 0.12],
        [1, paint, shade - 0.25]
      ])
    },
    {
      d: `M ${P(add(from, nx * 0.75, ny * 0.75))} L ${P(add(to, nx * 0.75, ny * 0.75))} M ${P(add(from, -nx * 0.75, -ny * 0.75))} L ${P(add(to, -nx * 0.75, -ny * 0.75))}`,
      stroke: paint,
      shade: shade + 0.3,
      lineWidth: 0.4,
      alpha: 0.6
    }
  ]
}
const CAPE_BACK = sym([
  [160, 150],
  [185, 152],
  [208, 160],
  [228, 172],
  [240, 200],
  [246, 260],
  [250, 340],
  [256, 420],
  [262, 500],
  [267, 588],
  [244, 597],
  [222, 592],
  [200, 598],
  [180, 593],
  [160, 598]
])
const WING_R = smooth([
  [196, 196],
  [214, 160],
  [240, 118],
  [268, 92],
  [292, 84],
  [300, 96],
  [298, 124],
  [292, 158],
  [290, 190],
  [284, 214],
  [282, 244],
  [272, 262],
  [266, 292],
  [254, 306],
  [246, 334],
  [234, 330],
  [228, 300],
  [214, 262],
  [204, 230]
])
parts.push(
  {
    id: 'back-cape',
    slot: 'back',
    back: [
      { d: CAPE_BACK, grad: cyl('outfitB', 50, 270, -0.4, 0.04, -0.06), mask: true, sway: 1.2 },
      {
        d: foldsD(
          [
            [238, 240],
            [244, 400],
            [252, 590]
          ],
          [
            [82, 240],
            [76, 400],
            [68, 590]
          ],
          [
            [230, 300],
            [238, 460],
            [236, 594]
          ],
          [
            [90, 300],
            [82, 460],
            [84, 594]
          ]
        ),
        stroke: 'outfitB',
        shade: -0.45,
        lineWidth: 2,
        alpha: 0.4,
        clip: true,
        sway: 1.2
      },
      { d: CAPE_BACK, grad: fadeY(540, 598, 'accent', -0.2, 0, 0.35), clip: true, sway: 1.2 }
    ],
    layers: [
      // Drape over the shoulders
      ...mirrored([
        {
          d: smooth([
            [176, 151],
            [194, 155],
            [214, 162],
            [227, 172],
            [230, 184],
            [216, 180],
            [198, 172],
            [180, 164]
          ]),
          grad: cyl('outfitB', 176, 232, -0.3, 0.1)
        },
        { d: E(182, 165, 4.2), grad: gold(178, 186) },
        { d: E(182, 165, 1.8), fill: 'accent', shade: 0.1 }
      ]),
      { d: 'M 142 166 Q 160 172 178 166', stroke: '#c9982f', lineWidth: 0.9 }
    ]
  },
  {
    id: 'back-wings',
    slot: 'back',
    back: mirrored([
      {
        d: WING_R,
        grad: rad(220, 150, 170, [
          [0, 'accent', 0.62],
          [0.6, 'accent', 0.45],
          [1, 'accent', 0.12]
        ]),
        mask: true,
        sway: 1.4
      },
      {
        d: Array.from({ length: 9 }, (_, i) => {
          const t = i / 8
          const x = 214 + t * 74
          const y = 175 - t * 70
          return `M ${x} ${y} Q ${x + 6} ${y + 40 + t * 20} ${x - 2} ${y + 90 + t * 60}`
        }).join(' '),
        stroke: 'accent',
        shade: 0.1,
        lineWidth: 0.8,
        alpha: 0.45,
        clip: true,
        sway: 1.4
      },
      {
        d: Array.from({ length: 8 }, (_, i) => {
          const t = i / 7
          const x = 206 + t * 80
          const y = 172 - t * 76
          return `M ${x} ${y} q 10 4 18 1`
        }).join(' '),
        stroke: 'accent',
        shade: -0.1,
        lineWidth: 0.9,
        alpha: 0.4,
        clip: true,
        sway: 1.4
      },
      {
        d: WING_R,
        grad: lin(200, 0, 300, 0, [
          [0, 'accent', -0.2, 0.45],
          [0.5, 'accent', -0.2, 0],
          [1, 'accent', -0.2, 0.2]
        ]),
        clip: true,
        sway: 1.4
      }
    ]),
    layers: []
  },
  {
    id: 'back-backpack',
    slot: 'back',
    back: [
      { d: RR(116, 142, 88, 150, 22), grad: cyl('accent', 116, 204, -0.35, 0.08, -0.15) },
      { d: 'M 146 142 Q 160 124 174 142', stroke: 'accent', shade: -0.4, lineWidth: 4 }
    ],
    layers: [
      ...mirrored([
        {
          d: smooth([
            [180, 154],
            [191, 156],
            [196, 180],
            [199, 210],
            [199.5, 236],
            [193.5, 236],
            [191.5, 210],
            [187.5, 180],
            [178.5, 160]
          ]),
          grad: cyl('outfitB', 180, 200, -0.3, 0.12, -0.2)
        },
        { d: RR(192, 222, 9, 7, 1.5), fill: '#23201d' },
        { d: 'M 188 162 L 195 214', stroke: 'outfitB', shade: 0.2, lineWidth: 0.4, alpha: 0.6 }
      ]),
      { d: RR(129, 208, 62, 5, 2), fill: 'outfitB', shade: -0.25 },
      { d: RR(156, 206, 8, 9, 1.5), fill: '#23201d' }
    ]
  },
  {
    id: 'back-sword',
    slot: 'back',
    back: [
      // Blade diagonal behind the back, hilt over the right shoulder
      {
        d: poly([
          [208, 132],
          [212, 136],
          [108, 372],
          [104, 377],
          [103, 370]
        ]),
        grad: steel(100, 214)
      },
      { d: 'M 210 134 L 104 374', stroke: '#f2f4f6', lineWidth: 0.6, alpha: 0.6 },
      {
        d: poly([
          [199.5, 128],
          [220, 139],
          [218, 143],
          [197.5, 132]
        ]),
        grad: gold(197, 221)
      },
      {
        d: poly([
          [209, 132],
          [213, 134],
          [222, 114],
          [218, 112]
        ]),
        fill: '#3a2a20'
      },
      {
        d: 'M 214.2 127.5 l 3.6 1.7 M 215.6 124 l 3.6 1.7 M 217 120.5 l 3.6 1.7 M 218.4 117 l 3.6 1.7',
        stroke: '#c9982f',
        lineWidth: 0.7
      },
      {
        d: E(221.5, 110.5, 3.4),
        grad: rad(220.5, 109.5, 4, [
          [0, '#f7e39a'],
          [1, '#8a6420']
        ])
      }
    ],
    layers: [
      ...strapAcross([203, 162], [120, 300], 7, 'outfitB', -0.15),
      { d: RR(152, 224, 9, 9, 2), grad: gold(152, 161) }
    ]
  },
  {
    id: 'back-quiver',
    slot: 'back',
    back: [
      {
        d: poly([
          [113, 152],
          [128, 146],
          [192, 318],
          [178, 325]
        ]),
        grad: lin(113, 0, 130, 0, [
          [0, 'outfitB', -0.4],
          [0.4, 'outfitB', 0.05],
          [1, 'outfitB', -0.3]
        ])
      },
      {
        d: poly([
          [111, 149],
          [129, 142],
          [131.5, 149],
          [113.5, 156]
        ]),
        fill: 'accent',
        shade: -0.2
      },
      // Arrow shafts + fletchings sticking up past the shoulder
      {
        d: 'M 116 150 L 104 116 M 121 148 L 112 110 M 126 146 L 121 114',
        stroke: '#8a6a45',
        lineWidth: 1.2
      },
      {
        d:
          smooth([
            [104, 116],
            [99, 104],
            [103, 99],
            [107, 108]
          ]) +
          ' ' +
          smooth([
            [112, 110],
            [108, 97],
            [113, 93],
            [116, 103]
          ]) +
          ' ' +
          smooth([
            [121, 114],
            [119, 101],
            [124, 97],
            [125.5, 107]
          ]),
        fill: 'accent',
        shade: 0.25
      },
      {
        d: 'M 103.5 115 L 101 101 M 111.5 109 L 110.5 95 M 121 113 L 121.5 99',
        stroke: 'accent',
        shade: -0.35,
        lineWidth: 0.5
      }
    ],
    layers: [
      ...strapAcross([118, 162], [203, 305], 6, 'outfitB', -0.1),
      { d: RR(157, 220, 8, 8, 2), grad: gold(157, 165) }
    ]
  }
)

// ── Headwear ──
const CAP_CROWN = sym([
  [160, 47],
  [176, 48],
  [189, 54.5],
  [196, 66],
  [197.6, 79],
  [180, 76.8],
  [160, 76]
])
parts.push(
  {
    id: 'hat-cap',
    slot: 'headwear',
    layers: [
      // Brim shadow on the brow
      {
        d: join(
          curve([
            [137, 84],
            [160, 88],
            [183, 84]
          ]),
          curve([
            [184, 91],
            [160, 95],
            [136, 91]
          ])
        ),
        fill: 'skin',
        shade: -0.5,
        alpha: 0.28
      },
      {
        d: CAP_CROWN,
        grad: rad(150, 56, 42, [
          [0, 'accent', 0.16],
          [0.6, 'accent', -0.04],
          [1, 'accent', -0.34]
        ]),
        mask: true
      },
      {
        d: 'M 160 47 Q 158 60 159 76 M 160 47 Q 146 54 140 76.5 M 160 47 Q 174 54 180 76.8 M 160 47 Q 136 52 125 78 M 160 47 Q 184 52 195 78',
        stroke: 'accent',
        shade: -0.35,
        lineWidth: 0.6,
        alpha: 0.5,
        clip: true
      },
      { d: E(160, 47.5, 2.8, 1.6), fill: 'accent', shade: -0.2 },
      {
        d: join(
          curve([
            [121.5, 78],
            [140, 84],
            [160, 86.5],
            [180, 84],
            [198.5, 78]
          ]),
          curve([
            [196, 74.5],
            [180, 74.5],
            [160, 74.5],
            [140, 74.5],
            [124, 74.5]
          ])
        ),
        grad: lin(0, 76, 0, 87, [
          [0, 'accent', 0.1],
          [1, 'accent', -0.4]
        ])
      },
      {
        d: 'M 124 79.5 Q 160 89 196 79.5',
        stroke: 'accent',
        shade: -0.55,
        lineWidth: 0.6,
        alpha: 0.6
      }
    ]
  },
  {
    id: 'hat-beanie',
    slot: 'headwear',
    layers: [
      {
        d: sym([
          [160, 45],
          [177, 46.5],
          [190, 53.5],
          [197, 66],
          [199, 80],
          [198.5, 88],
          [160, 87.5]
        ]),
        grad: rad(150, 54, 48, [
          [0, 'accent', 0.12],
          [0.6, 'accent', -0.05],
          [1, 'accent', -0.34]
        ]),
        mask: true
      },
      {
        d: [52, 58, 64, 70]
          .map(
            (y) =>
              `M ${160 - (y - 40) * 1.4} ${y + 1} Q 160 ${y - 2} ${160 + (y - 40) * 1.4} ${y + 1}`
          )
          .join(' '),
        stroke: 'accent',
        shade: -0.3,
        lineWidth: 0.8,
        alpha: 0.35,
        clip: true
      },
      {
        d: join(
          curve([
            [120, 74],
            [160, 70],
            [200, 74]
          ]),
          curve([
            [200, 88.5],
            [160, 86],
            [120, 88.5]
          ])
        ),
        grad: lin(0, 70, 0, 89, [
          [0, 'accent', 0.02],
          [1, 'accent', -0.3]
        ]),
        mask: true
      },
      {
        d: Array.from({ length: 27 }, (_, i) => {
          const x = 122 + i * 2.9
          const yt = 73 - Math.sin(((x - 120) / 80) * Math.PI) * 3.2
          return `M ${x.toFixed(1)} ${(yt + 1).toFixed(1)} L ${x.toFixed(1)} ${(yt + 13.5).toFixed(1)}`
        }).join(' '),
        stroke: 'accent',
        shade: -0.35,
        lineWidth: 0.7,
        alpha: 0.45,
        clip: true
      }
    ]
  },
  {
    id: 'hat-crown',
    slot: 'headwear',
    layers: [
      // Inner back of the band (seen over the front rim)
      {
        d: join(
          curve([
            [135, 58],
            [160, 50],
            [185, 58]
          ]),
          curve([
            [185, 62],
            [160, 55],
            [135, 62]
          ])
        ),
        fill: '#5a3e0e'
      },
      // Points
      {
        d: poly([
          [134.5, 62],
          [131, 40],
          [142, 52],
          [148, 34],
          [155, 50],
          [160, 28],
          [165, 50],
          [172, 34],
          [178, 52],
          [189, 40],
          [185.5, 62]
        ]),
        grad: gold(130, 190)
      },
      {
        d: 'M 131 40 L 134.5 62 M 148 34 L 150 58 M 160 28 L 160 58 M 172 34 L 170 58 M 189 40 L 185.5 62',
        stroke: '#fff1b8',
        lineWidth: 0.5,
        alpha: 0.7
      },
      {
        d:
          E(131, 39, 2.2) +
          ' ' +
          E(148, 33, 2.2) +
          ' ' +
          E(160, 27, 2.6) +
          ' ' +
          E(172, 33, 2.2) +
          ' ' +
          E(189, 39, 2.2),
        grad: goldY(24, 42)
      },
      // Front band
      {
        d: join(
          curve([
            [133.5, 60],
            [160, 66],
            [186.5, 60]
          ]),
          curve([
            [187, 71],
            [160, 77.5],
            [133, 71]
          ])
        ),
        grad: goldY(59, 78)
      },
      {
        d: 'M 134 62.5 Q 160 68.5 186 62.5 M 133.5 69.5 Q 160 76 186.5 69.5',
        stroke: '#fff1b8',
        lineWidth: 0.5,
        alpha: 0.6
      },
      // Gems
      {
        d: smooth(
          [
            [160, 66],
            [164.5, 70.5],
            [160, 75.5],
            [155.5, 70.5]
          ],
          true,
          0.4
        ),
        grad: rad(158.8, 69.5, 5, [
          [0, 'accent', 0.55],
          [0.5, 'accent', 0],
          [1, 'accent', -0.5]
        ])
      },
      {
        d: E(145, 68.5, 2.4, 2.8) + ' ' + E(175, 68.5, 2.4, 2.8),
        grad: rad(160, 68, 16, [
          [0, '#6a1020'],
          [0.6, '#b3263e'],
          [1, '#4a0a14']
        ])
      },
      {
        d: E(159, 68.6, 1) + ' ' + E(144.3, 67.6, 0.7) + ' ' + E(174.3, 67.6, 0.7),
        fill: '#ffffff',
        alpha: 0.85
      },
      {
        d:
          E(137.5, 66.5, 1.2) +
          ' ' +
          E(152.5, 69.8, 1.2) +
          ' ' +
          E(167.5, 69.8, 1.2) +
          ' ' +
          E(182.5, 66.5, 1.2),
        fill: '#f4efe4'
      }
    ]
  },
  {
    id: 'hat-witch',
    slot: 'headwear',
    layers: [
      {
        d: E(160, 73, 62, 10),
        grad: rad(152, 70, 64, [
          [0, 'outfitB', -0.2],
          [0.7, 'outfitB', -0.38],
          [1, 'outfitB', -0.55]
        ])
      },
      { d: E(160, 75, 60, 7.5), fill: 'outfitB', shade: -0.62, alpha: 0.7 },
      {
        d: smooth(
          [
            [128, 74],
            [136, 54],
            [146, 34],
            [155, 19],
            [166, 9],
            [182, 3],
            [194, 8],
            [180, 10],
            [172, 18],
            [170, 34],
            [176, 54],
            [192, 74],
            [160, 78]
          ],
          true,
          0.85
        ),
        grad: cyl('outfitB', 128, 194, -0.4, 0.05, -0.28),
        mask: true
      },
      {
        d: foldsD(
          [
            [150, 30],
            [158, 44],
            [156, 62]
          ],
          [
            [168, 14],
            [166, 28]
          ]
        ),
        stroke: 'outfitB',
        shade: -0.6,
        lineWidth: 1,
        alpha: 0.5,
        clip: true
      },
      { d: RR(120, 62, 80, 10, 0), fill: 'accent', shade: -0.25, clip: true },
      { d: RR(154, 61.5, 12, 11, 1.5), stroke: '#d9ac45', lineWidth: 1.6 }
    ]
  },
  {
    id: 'hat-top',
    slot: 'headwear',
    layers: [
      {
        d: join(
          curve([
            [121, 70],
            [130, 74],
            [160, 77],
            [190, 74],
            [199, 70]
          ]),
          curve([
            [198, 73.5],
            [189, 78.5],
            [160, 82],
            [131, 78.5],
            [122, 73.5]
          ])
        ),
        grad: lin(0, 66, 0, 82, [
          [0, 'outfitB', -0.3],
          [1, 'outfitB', -0.6]
        ])
      },
      {
        d: sym([
          [160, 12],
          [183, 13],
          [181, 40],
          [180, 74],
          [160, 77]
        ]),
        grad: lin(137, 0, 183, 0, [
          [0, 'outfitB', -0.62],
          [0.28, 'outfitB', -0.3],
          [0.4, 'outfitB', -0.12],
          [0.52, 'outfitB', -0.42],
          [1, 'outfitB', -0.68]
        ]),
        mask: true
      },
      { d: E(160, 12.5, 23, 3.2), fill: 'outfitB', shade: -0.5, clip: true },
      {
        d: join(
          curve([
            [138, 58],
            [160, 61.5],
            [182, 58]
          ]),
          curve([
            [182, 70],
            [160, 74],
            [138, 70]
          ])
        ),
        fill: 'accent',
        shade: -0.15,
        clip: true
      },
      {
        d: 'M 138 60.5 Q 160 64 182 60.5',
        stroke: 'accent',
        shade: 0.3,
        lineWidth: 0.6,
        alpha: 0.6,
        clip: true
      }
    ]
  },
  {
    id: 'hat-headband',
    slot: 'headwear',
    layers: [
      {
        d: join(
          curve([
            [128, 78],
            [144, 71.5],
            [160, 70],
            [176, 71.5],
            [192, 78]
          ]),
          curve([
            [192.5, 85],
            [176, 78.5],
            [160, 77],
            [144, 78.5],
            [127.5, 85]
          ])
        ),
        grad: lin(0, 70, 0, 85, [
          [0, 'accent', 0.18],
          [1, 'accent', -0.3]
        ])
      },
      { d: 'M 132 79 Q 160 71 188 79', stroke: 'accent', shade: -0.25, lineWidth: 0.6, alpha: 0.5 },
      // Knot + tails at the right
      { d: E(193.5, 83, 3.5, 3), fill: 'accent', shade: -0.1 },
      {
        d: smooth([
          [195, 84],
          [201, 92],
          [203, 104],
          [199, 104],
          [196.5, 93]
        ]),
        fill: 'accent',
        shade: -0.18,
        sway: 3
      },
      {
        d: smooth([
          [194, 85],
          [196, 96],
          [194.5, 110],
          [191.5, 108],
          [192.5, 96]
        ]),
        fill: 'accent',
        shade: -0.3,
        sway: 3
      }
    ]
  },
  {
    id: 'hat-fedora',
    slot: 'headwear',
    layers: [
      {
        d: join(
          curve([
            [114, 70],
            [124, 72],
            [160, 74],
            [196, 72],
            [206, 70]
          ]),
          curve([
            [204, 76],
            [190, 82],
            [160, 84.5],
            [130, 82],
            [116, 76]
          ])
        ),
        grad: lin(0, 70, 0, 85, [
          [0, 'outfitB', 0.12],
          [1, 'outfitB', -0.3]
        ])
      },
      {
        d: smooth([
          [135, 72],
          [135.5, 55],
          [141, 43],
          [151, 37.5],
          [160, 41],
          [169, 37.5],
          [179, 43],
          [184.5, 55],
          [185, 72],
          [160, 75]
        ]),
        grad: cyl('outfitB', 134, 186, -0.32, 0.14),
        mask: true
      },
      {
        d: 'M 160 41 Q 158 48 160 56 M 148 42 Q 150 48 149 56 M 172 42 Q 170 48 171 56',
        stroke: 'outfitB',
        shade: -0.4,
        lineWidth: 0.9,
        alpha: 0.45,
        clip: true
      },
      {
        d: join(
          curve([
            [134, 62],
            [160, 65.5],
            [186, 62]
          ]),
          curve([
            [186, 72.5],
            [160, 76],
            [134, 72.5]
          ])
        ),
        fill: 'accent',
        shade: -0.45,
        clip: true
      }
    ]
  },
  {
    id: 'hat-circlet',
    slot: 'headwear',
    layers: [
      {
        d: join(
          curve([
            [131, 78],
            [146, 79.5],
            [160, 82],
            [174, 79.5],
            [189, 78]
          ]),
          curve([
            [189, 80.5],
            [174, 82],
            [160, 84.6],
            [146, 82],
            [131, 80.5]
          ])
        ),
        grad: gold(131, 189)
      },
      {
        d: smooth(
          [
            [160, 81],
            [163, 85],
            [160, 91.5],
            [157, 85]
          ],
          true,
          0.6
        ),
        grad: goldY(80, 92)
      },
      {
        d: smooth(
          [
            [160, 82.6],
            [161.9, 85.4],
            [160, 89.6],
            [158.1, 85.4]
          ],
          true,
          0.6
        ),
        grad: rad(159.4, 84.8, 4, [
          [0, 'accent', 0.55],
          [1, 'accent', -0.45]
        ])
      },
      { d: E(159.5, 84.6, 0.6), fill: '#ffffff', alpha: 0.9 }
    ]
  }
)

// ── Accessories ──
const LENS_R = RR(164.2, 97.2, 17.2, 11.8, 4.2)
parts.push(
  {
    id: 'acc-glasses',
    slot: 'accessory',
    layers: [
      {
        d: moveD(LENS_R, 0.6, 1.8) + ' ' + moveD(flipX(LENS_R), 0.6, 1.8),
        stroke: 'skin',
        shade: -0.5,
        lineWidth: 1,
        alpha: 0.18
      },
      {
        d: LENS_R + ' ' + flipX(LENS_R),
        grad: lin(140, 96, 180, 110, [
          [0, '#ffffff', 0, 0.1],
          [0.5, '#ffffff', 0, 0.02],
          [1, '#ffffff', 0, 0.08]
        ])
      },
      {
        d: 'M 167 106 L 172 98.5 M 170 107.5 L 176.5 98.5 M 140.5 106 L 145.5 98.5',
        stroke: '#ffffff',
        lineWidth: 0.7,
        alpha: 0.2
      },
      { d: LENS_R + ' ' + flipX(LENS_R), stroke: '#2e2622', lineWidth: 1.1 },
      { d: 'M 164.2 101 Q 160 98.2 155.8 101', stroke: '#2e2622', lineWidth: 1 },
      { d: 'M 181.4 100 L 187.5 99.2 M 138.6 100 L 132.5 99.2', stroke: '#2e2622', lineWidth: 1.2 },
      {
        d: 'M 165 98.5 L 180.5 98.5 M 139.5 98.5 L 155 98.5',
        stroke: '#8a7a70',
        lineWidth: 0.35,
        alpha: 0.6
      }
    ]
  },
  {
    id: 'acc-shades',
    slot: 'accessory',
    layers: [
      ...mirrored([
        {
          d: smooth([
            [164, 98.5],
            [172, 97.4],
            [181.8, 98.3],
            [181.2, 104],
            [176.5, 109.5],
            [170, 110],
            [165.2, 105.5]
          ]),
          grad: lin(0, 97, 0, 110, [
            [0, '#15171b', 0, 0.96],
            [0.6, '#262a31', 0, 0.94],
            [1, '#4a515c', 0, 0.9]
          ]),
          mask: true
        },
        {
          d: poly([
            [168, 110],
            [177, 97],
            [180, 97],
            [171, 110]
          ]),
          fill: '#ffffff',
          alpha: 0.12,
          clip: true
        },
        {
          d: smooth([
            [164, 98.5],
            [172, 97.4],
            [181.8, 98.3],
            [181.2, 104],
            [176.5, 109.5],
            [170, 110],
            [165.2, 105.5]
          ]),
          stroke: '#b9a67a',
          lineWidth: 0.7
        }
      ]),
      { d: 'M 164 99 Q 160 97 156 99 M 164 97.8 L 156 97.8', stroke: '#b9a67a', lineWidth: 0.7 },
      { d: 'M 181.8 99 L 187.8 99.4 M 138.2 99 L 132.2 99.4', stroke: '#b9a67a', lineWidth: 0.9 }
    ]
  },
  {
    id: 'acc-earrings',
    slot: 'accessory',
    layers: mirrored([
      { d: E(190.2, 124.2, 3.4), stroke: '#8a6420', lineWidth: 1.1 },
      {
        d: `M 187.4 122.8 A 3.4 3.4 0 0 0 191.8 127.2`,
        stroke: '#f7e39a',
        lineWidth: 0.6,
        alpha: 0.9
      },
      { d: E(190.2, 120.6, 0.9), fill: '#d9ac45' }
    ])
  },
  {
    id: 'acc-necklace',
    slot: 'accessory',
    layers: [
      { d: 'M 146 151 Q 148 170 160 176 Q 172 170 174 151', stroke: '#8a6420', lineWidth: 0.9 },
      {
        d: 'M 146 151 Q 148 170 160 176 Q 172 170 174 151',
        stroke: '#f7e39a',
        lineWidth: 0.4,
        alpha: 0.8
      },
      {
        d: smooth(
          [
            [160, 176],
            [163.2, 181],
            [160, 187],
            [156.8, 181]
          ],
          true,
          0.6
        ),
        grad: goldY(176, 187)
      },
      {
        d: E(160, 181.4, 1.8, 2.4),
        grad: rad(159.4, 180.6, 3, [
          [0, 'accent', 0.5],
          [1, 'accent', -0.45]
        ])
      },
      { d: E(159.4, 180.6, 0.5), fill: '#ffffff', alpha: 0.9 }
    ]
  },
  {
    id: 'acc-monocle',
    slot: 'accessory',
    layers: [
      { d: E(172.5, 103.2, 7.6), fill: '#ffffff', alpha: 0.07 },
      { d: E(172.5, 103.2, 7.6), stroke: '#8a6420', lineWidth: 1.3 },
      { d: 'M 166.5 99 A 7.6 7.6 0 0 1 176 96.5', stroke: '#f7e39a', lineWidth: 0.6, alpha: 0.85 },
      {
        d: 'M 177 110 C 184 128 196 150 200 172 C 202 186 196 196 190 204',
        stroke: '#c9982f',
        lineWidth: 0.6,
        alpha: 0.9
      }
    ]
  },
  {
    id: 'acc-pearls',
    slot: 'accessory',
    layers: (() => {
      const pts: Pt[] = []
      for (let i = 0; i <= 22; i++) {
        const t = i / 22
        const x = 145 + t * 30
        const y = 152 + Math.sin(t * Math.PI) * 25
        pts.push([x, y])
      }
      const pearls = pts.map(([x, y]) => E(x, y, 1.45)).join(' ')
      const hi = pts.map(([x, y]) => E(x - 0.5, y - 0.55, 0.5)).join(' ')
      const sh = pts.map(([x, y]) => E(x + 0.4, y + 0.6, 1.1)).join(' ')
      return [
        { d: pearls, fill: '#e9e3d8' },
        { d: sh, fill: '#a99f92', alpha: 0.45 },
        { d: hi, fill: '#ffffff', alpha: 0.9 }
      ]
    })()
  },
  {
    id: 'acc-scarf',
    slot: 'accessory',
    layers: [
      {
        d: smooth([
          [142, 144],
          [160, 150],
          [178, 144],
          [188, 152],
          [186, 166],
          [168, 174],
          [152, 174],
          [134, 166],
          [132, 152]
        ]),
        grad: lin(0, 144, 0, 175, [
          [0, 'accent', 0.05],
          [0.5, 'accent', 0.12],
          [1, 'accent', -0.3]
        ]),
        mask: true
      },
      {
        d: 'M 136 158 Q 160 168 184 158 M 140 150 Q 160 158 180 150',
        stroke: 'accent',
        shade: -0.4,
        lineWidth: 1,
        alpha: 0.45,
        clip: true
      },
      {
        d: smooth([
          [166, 166],
          [178, 168],
          [180, 200],
          [182, 236],
          [168, 238],
          [168, 200]
        ]),
        grad: cyl('accent', 166, 182, -0.3, 0.1),
        sway: 1.5
      },
      {
        d: 'M 170 170 L 170.5 234 M 175 170 L 176.5 235',
        stroke: 'accent',
        shade: -0.3,
        lineWidth: 0.6,
        alpha: 0.4,
        sway: 1.5
      },
      {
        d: Array.from({ length: 7 }, (_, i) => `M ${168.6 + i * 2} 237.5 l 0.2 5`).join(' '),
        stroke: 'accent',
        shade: -0.1,
        lineWidth: 1,
        sway: 1.5
      }
    ]
  }
)

// ── Facial hair ──
/** Deterministic stipple dots inside a test region (stubble / freckles). */
function dots(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  n: number,
  r: number,
  seed: number,
  keep: (x: number, y: number) => boolean
): string {
  let s = seed
  const rnd = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
  const out: string[] = []
  for (let i = 0; i < n * 3 && out.length < n; i++) {
    const x = x0 + rnd() * (x1 - x0)
    const y = y0 + rnd() * (y1 - y0)
    if (keep(x, y)) out.push(E(x, y, r * (0.6 + rnd() * 0.8)))
  }
  return out.join(' ')
}
const MUSTACHE = sym([
  [160, 121.3],
  [165, 121],
  [169.5, 122.6],
  [172.8, 126],
  [174, 129.5],
  [171, 128.2],
  [167, 126],
  [163, 125.4],
  [160, 125.9]
])
/** Beard band: jaw outline outside, cheek line + under-lip edge inside. */
const BEARD = sym([
  [160, 133.2],
  [165, 132.4],
  [170.5, 130.8],
  [174, 127],
  [179, 119],
  [183.5, 110],
  [185.6, 100],
  [190.4, 99],
  [192, 110],
  [190.2, 124],
  [185, 138],
  [176, 150],
  [166.5, 157],
  [160, 158.5]
])
const STUBBLE_HALF: Pt[] = [
  [160, 133.4],
  [166, 132.4],
  [171, 130],
  [175, 125],
  [180, 117],
  [184, 108],
  [185.8, 100],
  [188.8, 100],
  [188.8, 108],
  [185.5, 119],
  [179.5, 129.5],
  [171, 137.8],
  [164.5, 141.6],
  [160, 142.2]
]
const STUBBLE_ZONE = sym(STUBBLE_HALF)
const STUBBLE_POLY = symPts(STUBBLE_HALF)
/** Even-odd point-in-polygon. */
function inPoly(pts: Pt[], x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
const inBeardZone = (x: number, y: number): boolean =>
  inPoly(STUBBLE_POLY, x, y) || (y > 121.5 && y < 125 && Math.abs(x - 160) < 10.5)
parts.push(
  {
    id: 'beard-stubble',
    slot: 'facialHair',
    layers: [
      { d: STUBBLE_ZONE + ' ' + MUSTACHE, grad: fadeY(99, 142, 'hair', -0.2, 0.12, 0.26) },
      {
        d: dots(130, 190, 99, 143, 260, 0.26, 7, inBeardZone),
        fill: 'hair',
        shade: -0.35,
        alpha: 0.55
      }
    ]
  },
  {
    id: 'beard-full',
    slot: 'facialHair',
    layers: [
      {
        d: BEARD,
        grad: lin(0, 99, 0, 159, [
          [0, 'hair', -0.05],
          [0.5, 'hair', -0.1],
          [1, 'hair', -0.35]
        ]),
        mask: true
      },
      {
        d: strands(
          [
            [
              [189, 102],
              [190, 118],
              [185, 136],
              [176, 150]
            ],
            [
              [181, 116],
              [176, 128],
              [170, 142],
              [166, 155]
            ],
            [
              [165, 134],
              [163, 142],
              [161, 150],
              [160, 157]
            ],
            [
              [155, 134],
              [157, 142],
              [159, 150],
              [160, 157]
            ],
            [
              [139, 116],
              [144, 128],
              [150, 142],
              [154, 155]
            ],
            [
              [131, 102],
              [130, 118],
              [135, 136],
              [144, 150]
            ]
          ],
          5,
          51
        ),
        stroke: 'hair',
        shade: -0.5,
        lineWidth: 0.55,
        alpha: 0.45,
        clip: true
      },
      {
        d: strands(
          [
            [
              [186, 104],
              [186, 120],
              [180, 136],
              [172, 150]
            ],
            [
              [134, 104],
              [134, 120],
              [140, 136],
              [148, 150]
            ]
          ],
          6,
          53
        ),
        stroke: 'hair',
        shade: 0.3,
        lineWidth: 0.4,
        alpha: 0.3,
        clip: true
      },
      blob(160, 150, 12, 'hair', -0.45, 0.35, { clip: true }),
      { d: MUSTACHE, grad: fadeY(121, 129, 'hair', -0.08, 1, 1) },
      {
        d: 'M 161 122 Q 165 124 168 127.5 M 163.5 121.8 Q 168 123.5 171.5 127.2 M 159 122 Q 155 124 152 127.5 M 156.5 121.8 Q 152 123.5 148.5 127.2',
        stroke: 'hair',
        shade: -0.5,
        lineWidth: 0.4,
        alpha: 0.55
      }
    ]
  },
  {
    id: 'beard-goatee',
    slot: 'facialHair',
    layers: [
      {
        d: sym([
          [160, 133.4],
          [166, 132.6],
          [170.2, 130.6],
          [171.5, 136],
          [168.5, 143],
          [164, 147.5],
          [160, 148.5]
        ]),
        grad: fadeY(131, 149, 'hair', -0.1, 1, 1),
        mask: true
      },
      {
        d: 'M 165 134 Q 164 140 162 147 M 161.5 134 L 160.8 148 M 155 134 Q 156 140 158 147 M 168.5 134 Q 167 140 165 145',
        stroke: 'hair',
        shade: -0.5,
        lineWidth: 0.45,
        alpha: 0.5,
        clip: true
      },
      { d: MUSTACHE, grad: fadeY(121, 129, 'hair', -0.08, 1, 1) },
      {
        d: 'M 172.2 127.5 Q 172.6 130 170.8 131 M 147.8 127.5 Q 147.4 130 149.2 131',
        stroke: 'hair',
        shade: -0.1,
        lineWidth: 1.6
      }
    ]
  },
  {
    id: 'mustache',
    slot: 'facialHair',
    layers: [
      { d: MUSTACHE, grad: fadeY(121, 129, 'hair', -0.05, 1, 1), mask: true },
      {
        d: 'M 161 122 Q 165 124 168 127.5 M 163.5 121.8 Q 168 123.5 171.5 127.2 M 159 122 Q 155 124 152 127.5 M 156.5 121.8 Q 152 123.5 148.5 127.2',
        stroke: 'hair',
        shade: -0.5,
        lineWidth: 0.4,
        alpha: 0.55,
        clip: true
      },
      {
        d: 'M 160.5 121.5 Q 165 122.2 169 124.5 M 159.5 121.5 Q 155 122.2 151 124.5',
        stroke: 'hair',
        shade: 0.35,
        lineWidth: 0.4,
        alpha: 0.4,
        clip: true
      }
    ]
  }
)

// ── Marks ──
const inCheeks = (x: number, y: number): boolean =>
  ((x - 145) / 11) ** 2 + ((y - 111) / 6) ** 2 < 1 ||
  ((x - 175) / 11) ** 2 + ((y - 111) / 6) ** 2 < 1 ||
  ((x - 160) / 5.5) ** 2 + ((y - 110) / 6) ** 2 < 1
parts.push(
  {
    id: 'marks-blush',
    slot: 'marks',
    layers: [blob(143, 113, 10, '#e07a70', 0, 0.3), blob(177, 113, 10, '#e07a70', 0, 0.3)]
  },
  {
    id: 'marks-freckles',
    slot: 'marks',
    layers: [
      { d: dots(132, 188, 103, 118, 60, 0.42, 5, inCheeks), fill: 'skin', shade: -0.3, alpha: 0.5 },
      { d: dots(132, 188, 103, 118, 40, 0.3, 9, inCheeks), fill: 'skin', shade: -0.42, alpha: 0.55 }
    ]
  },
  {
    id: 'marks-scar',
    slot: 'marks',
    layers: [
      {
        d: 'M 142.5 88 Q 144.5 99 142 110 Q 140.5 116 141.5 121',
        stroke: 'skin',
        shade: -0.3,
        lineWidth: 2,
        alpha: 0.35
      },
      {
        d: 'M 142.5 88 Q 144.5 99 142 110 Q 140.5 116 141.5 121',
        stroke: 'skin',
        shade: 0.22,
        lineWidth: 0.9,
        alpha: 0.85
      },
      {
        d: 'M 141 92 L 145.5 93 M 140.8 112 L 144.8 113.5 M 139.5 117.5 L 143.5 118',
        stroke: 'skin',
        shade: -0.25,
        lineWidth: 0.5,
        alpha: 0.5
      }
    ]
  },
  {
    id: 'marks-mole',
    slot: 'marks',
    layers: [
      {
        d: E(170.8, 122.4, 0.85),
        grad: rad(170.6, 122.2, 1, [
          [0, '#4a2c1e'],
          [1, '#2c1a12']
        ])
      },
      { d: E(170.5, 122.1, 0.25), fill: '#ffffff', alpha: 0.35 }
    ]
  },
  {
    id: 'marks-paint',
    slot: 'marks',
    layers: mirrored([
      {
        d:
          smooth([
            [167.5, 109.5],
            [178, 108.2],
            [186.5, 108.8],
            [186, 111.4],
            [177, 111.6],
            [168, 112.2]
          ]) +
          ' ' +
          smooth([
            [170, 115],
            [179, 114],
            [185.5, 114.6],
            [184.8, 116.8],
            [178, 117],
            [170.5, 117.4]
          ]),
        fill: 'accent',
        alpha: 0.82
      },
      {
        d: 'M 169 110.6 L 185 109.8 M 171 116 L 184 115.6',
        stroke: 'accent',
        shade: 0.3,
        lineWidth: 0.4,
        alpha: 0.5
      }
    ])
  }
)

// ── Procedural overlays ──
const TEAR_R: L[] = [
  {
    d: smooth([
      [175.6, 106],
      [177.2, 106],
      [178.4, 114],
      [179, 121.5],
      [177.8, 121.8],
      [176.8, 114]
    ]),
    fill: '#d8e6ee',
    alpha: 0.28
  },
  { d: 'M 176.8 107 Q 177.6 114 178.1 121', stroke: '#ffffff', lineWidth: 0.3, alpha: 0.45 },
  { d: E(178.4, 124, 1.2, 1.6), fill: '#dfeaf1', alpha: 0.75 },
  { d: E(178, 123.4, 0.4), fill: '#ffffff', alpha: 0.9 }
]
const AGE_LINE = { stroke: 'skin', shade: -0.36, lineWidth: 0.55 }
const fx = {
  blush: [blob(143, 113, 9.5, '#e0706a', 0, 0.42), blob(177, 113, 9.5, '#e0706a', 0, 0.42)],
  tears: mirrored(TEAR_R),
  aging: [
    {
      d: 'M 145 85.5 Q 152 84 159 84.6 Q 167 85.2 175 84.2 M 148 89.8 Q 156 88.4 163 89 Q 169 89.4 173 88.6 M 151 93.6 Q 160 92.6 169 93.4',
      ...AGE_LINE,
      alpha: 0.3
    },
    { d: 'M 157.6 94.8 L 158.1 99.2 M 162.4 94.8 L 161.9 99.2', ...AGE_LINE, alpha: 0.4 },
    { d: 'M 151 147.5 Q 160 149.5 169 147.5 M 152 152 Q 160 154 168 152', ...AGE_LINE, alpha: 0.3 },
    ...mirrored<L>([
      {
        d: 'M 180.6 101.2 q 1.4 -0.4 2.6 -1.4 M 181 103 q 1.4 0.1 2.8 -0.2 M 180.6 104.8 q 1.3 0.5 2.5 1.4',
        ...AGE_LINE,
        lineWidth: 0.4,
        alpha: 0.36
      },
      { d: 'M 166.4 106.9 Q 172.5 109 178.2 106.8', ...AGE_LINE, lineWidth: 0.5, alpha: 0.45 },
      { d: 'M 166 118 Q 170.8 123 171.6 130.6', ...AGE_LINE, lineWidth: 0.75, alpha: 0.5 },
      { d: 'M 170.6 131.6 Q 170.2 136 168.2 139.6', ...AGE_LINE, lineWidth: 0.5, alpha: 0.35 },
      blob(170, 125, 4.5, 'skin', -0.3, 0.25),
      blob(181.5, 123, 8, 'skin', -0.3, 0.2)
    ])
  ]
}

const OUTFIT_SWATCHES = [
  '#e8e1d4',
  '#c9bfae',
  '#8a8174',
  '#4a4640',
  '#2b2b30',
  '#34353b',
  '#4c5f73',
  '#2e4a6b',
  '#3b5670',
  '#556b52',
  '#3f5a4a',
  '#7c8a6e',
  '#7d3f43',
  '#8c3b3b',
  '#9a5a45',
  '#b8a27a',
  '#6b4a7a',
  '#a9875a',
  '#c9a45c',
  '#b5553a'
]

// ─────────────────────────────────────────────────────────────────────────────
export const realisticPack: StylePack = {
  id: 'realistic',
  name: 'Realistic',
  icon: '🎨',
  width: 320,
  height: 640,
  ink: '#2b201c',
  slots: [
    // Back items: `back` lists sit behind everything (backZ 2); their
    // `layers` (straps, clasps, shoulder drapes) sit over the torso.
    {
      id: 'back',
      icon: '🎒',
      socket: { x: 160, y: 172 },
      z: 35,
      backZ: 2,
      optional: true,
      thumb: { cx: 160, cy: 280, span: 340 }
    },
    {
      id: 'head',
      icon: '🙂',
      socket: { x: 160, y: 103 },
      z: 40,
      backZ: 26,
      thumb: { cx: 160, cy: 110, span: 96 }
    },
    {
      id: 'hair',
      icon: '💇',
      socket: { x: 160, y: 66 },
      z: 60,
      backZ: 4,
      thumb: { cx: 160, cy: 128, span: 190 }
    },
    {
      id: 'eyes',
      icon: '👁',
      socket: { x: 160, y: EYE_Y },
      z: 50,
      thumb: { cx: 160, cy: EYE_Y, span: 44 }
    },
    {
      id: 'brows',
      icon: '🤨',
      socket: { x: 160, y: 96 },
      z: 52,
      thumb: { cx: 160, cy: 99, span: 46 }
    },
    {
      id: 'nose',
      icon: '👃',
      socket: { x: 160, y: 112 },
      z: 45,
      optional: true,
      thumb: { cx: 160, cy: 111, span: 36 }
    },
    {
      id: 'mouth',
      icon: '👄',
      socket: { x: 160, y: MOUTH_Y },
      z: 51,
      thumb: { cx: 160, cy: 129, span: 34 }
    },
    {
      id: 'facialHair',
      icon: '🧔',
      socket: { x: 160, y: 128 },
      z: 53,
      optional: true,
      thumb: { cx: 160, cy: 126, span: 72 }
    },
    {
      id: 'marks',
      icon: '✨',
      socket: { x: 160, y: 108 },
      z: 42,
      optional: true,
      thumb: { cx: 160, cy: 108, span: 72 }
    },
    {
      id: 'torso',
      icon: '👕',
      socket: { x: 160, y: 220 },
      z: 30,
      thumb: { cx: 160, cy: 300, span: 330 }
    },
    {
      id: 'legs',
      icon: '👖',
      socket: { x: 160, y: 330 },
      z: 20,
      thumb: { cx: 160, cy: 455, span: 330 }
    },
    {
      id: 'feet',
      icon: '👟',
      socket: { x: 160, y: 610 },
      z: 22,
      thumb: { cx: 160, cy: 598, span: 96 }
    },
    {
      id: 'headwear',
      icon: '🎩',
      socket: { x: 160, y: 66 },
      z: 70,
      optional: true,
      thumb: { cx: 160, cy: 62, span: 150 }
    },
    {
      id: 'accessory',
      icon: '👓',
      socket: { x: 160, y: EYE_Y },
      z: 65,
      optional: true,
      thumb: { cx: 160, cy: 128, span: 120 }
    }
  ],
  parts,
  paletteChannels: ['skin', 'hair', 'eyes', 'outfitA', 'outfitB', 'accent'],
  palettePresets: [
    {
      skin: '#e3b08c',
      hair: '#3f2a1d',
      eyes: '#5e7c93',
      outfitA: '#4c5f73',
      outfitB: '#34353b',
      accent: '#a9875a'
    },
    {
      skin: '#f6dfd0',
      hair: '#d6b574',
      eyes: '#6d8fb0',
      outfitA: '#7d3f43',
      outfitB: '#2f3542',
      accent: '#c9a45c'
    },
    {
      skin: '#efcdb4',
      hair: '#8e3f22',
      eyes: '#6b8a5a',
      outfitA: '#3f5a4a',
      outfitB: '#5c4a3a',
      accent: '#c9a468'
    },
    {
      skin: '#d0a07a',
      hair: '#1e1714',
      eyes: '#4a3222',
      outfitA: '#9a5a45',
      outfitB: '#2f3a4a',
      accent: '#d8c39a'
    },
    {
      skin: '#b07650',
      hair: '#2a1d17',
      eyes: '#3d2a1e',
      outfitA: '#b8a27a',
      outfitB: '#4a4038',
      accent: '#7a2e2e'
    },
    {
      skin: '#8a5536',
      hair: '#161212',
      eyes: '#2e1e16',
      outfitA: '#2e4a6b',
      outfitB: '#d9d2c5',
      accent: '#c49a3a'
    },
    {
      skin: '#5e3a28',
      hair: '#0f0d0d',
      eyes: '#2a1a12',
      outfitA: '#6b4a7a',
      outfitB: '#2b2b30',
      accent: '#d4af5f'
    },
    {
      skin: '#3f271c',
      hair: '#1a1414',
      eyes: '#22150f',
      outfitA: '#e3ddd2',
      outfitB: '#5a4636',
      accent: '#b5553a'
    },
    {
      skin: '#ecc9a8',
      hair: '#1b1716',
      eyes: '#3a281e',
      outfitA: '#7c8a6e',
      outfitB: '#36322f',
      accent: '#a83a32'
    },
    {
      skin: '#e2b596',
      hair: '#bdb7b0',
      eyes: '#6f7f8c',
      outfitA: '#6e5a4a',
      outfitB: '#40464f',
      accent: '#9b7a4a'
    },
    {
      skin: '#f3d3bd',
      hair: '#b86b3a',
      eyes: '#7a8a5a',
      outfitA: '#3b5670',
      outfitB: '#e8e1d4',
      accent: '#8c3b3b'
    },
    {
      skin: '#c68c64',
      hair: '#4a2e1e',
      eyes: '#5a4028',
      outfitA: '#556b52',
      outfitB: '#3a3530',
      accent: '#b8863a'
    }
  ],
  swatches: {
    skin: [
      '#f7e2d3',
      '#f1d0b8',
      '#e9bd9b',
      '#e3b08c',
      '#d6a07a',
      '#c68c64',
      '#b07650',
      '#9a6443',
      '#8a5536',
      '#744430',
      '#5e3a28',
      '#4a2d20',
      '#3f271c'
    ],
    hair: [
      '#0f0d0d',
      '#1e1714',
      '#2e2019',
      '#3f2a1d',
      '#57402d',
      '#7a5a3d',
      '#9c7650',
      '#c49a62',
      '#d6b574',
      '#ecd9ad',
      '#8e3f22',
      '#b86b3a',
      '#6e3a2a',
      '#bdb7b0',
      '#e8e4de'
    ],
    eyes: [
      '#22150f',
      '#3a281e',
      '#4a3222',
      '#6b4a2a',
      '#8a6a3a',
      '#7a8a5a',
      '#5b7a52',
      '#4a6a7a',
      '#5e7c93',
      '#6d8fb0',
      '#7f8a94',
      '#3f5f8a'
    ],
    outfitA: OUTFIT_SWATCHES,
    outfitB: OUTFIT_SWATCHES,
    accent: OUTFIT_SWATCHES
  },
  defaults: {
    back: null,
    head: 'head-oval',
    hair: 'hair-short',
    eyes: 'eyes-round',
    brows: 'brows-straight',
    nose: 'nose-small',
    mouth: 'mouth-smile',
    facialHair: null,
    marks: null,
    torso: 'torso-tee',
    legs: 'legs-pants',
    feet: 'feet-sneakers',
    headwear: null,
    accessory: null
  },
  rig: {
    neck: { x: 160, y: 158 },
    hips: { x: 160, y: 305 },
    ground: { x: 160, y: 620 },
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
  portrait: { cx: 160, cy: 118, span: 150 },
  face: { cx: 160, cy: 106, span: 84 },
  fx,
  greyHair: '#c9c5c0'
}
