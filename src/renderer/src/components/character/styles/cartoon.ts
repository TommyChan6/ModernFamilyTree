// The "Cartoon" style pack — the app's default look: a friendly, big-headed,
// bold-outlined vector character in a 320×480 character space. Everything is
// hand-authored SVG path data (built with ./pathKit) painted through the six
// palette channels, with one shared ink outline so parts from any slot sit
// together like one drawing.
//
// House rules of the style:
//  • Thick ink contours (4 on big shapes, 3 on small ones).
//  • Limbs use the two-stroke capsule trick — a fat ink stroke under a thinner
//    colored one reads as an outlined tube — plus a thin offset stroke as the
//    tube's cel shadow.
//  • Cel shading via masks: a shape paints as a `mask` (fill only), its flat
//    shadow/highlight shapes follow as `clip` layers, and the ink contour is
//    re-stroked on top so the shadow never eats the outline. Light comes from
//    the upper left, so shadows sit on the viewer's right.
//  • Eyes: the eye white is the mask; iris / pupil / catchlights clip to it
//    and `track` the cursor; lids and lashes sit on top, untracked.
//  • The neck lives in the head's `back` band (z just under the torso) so
//    every collar covers the neck base; the `back` slot's own `back` band sits
//    just above the torso for straps, clasps and belts worn across the chest.

import type { StyleLayer, StylePack, StylePart } from '../styleTypes'
import {
  E,
  RR,
  curve,
  flipX,
  mirrored,
  moveD,
  poly,
  smooth,
  sym,
  symPoly,
  type Pt
} from './pathKit'

const INK = '#332c40'
const WHITE = '#ffffff'
const MOUTH = '#7d3f4c'
const TONGUE = '#e0707e'
const METAL_HI = '#eef1f6'
const METAL = '#b6bfcc'
const METAL_LO = '#7c8699'
const GOLD = '#f2c440'
const GOLD_LO = '#c98f1f'

// ── Shape helpers ─────────────────────────────────────────────────────────────

/** Two-stroke outlined capsule: ink underlay + colored overlay along one path. */
const capsule = (d: string, paint: string, width: number, shade = 0): StyleLayer[] => [
  { d, stroke: 'ink', lineWidth: width + 7 },
  { d, stroke: paint, lineWidth: width, shade }
]

/** A capsule limb with a cel-shadow stroke down its right side. */
const limb = (d: string, paint: string, width: number, shade = 0): StyleLayer[] => [
  ...capsule(d, paint, width, shade),
  {
    d: moveD(d, width * 0.24, 0.5),
    stroke: paint,
    shade: shade - 0.16,
    lineWidth: width * 0.42
  }
]

/** Mask + clipped cel layers + ink contour on top. */
const cel = (
  d: string,
  paint: string,
  clips: StyleLayer[],
  opts: { shade?: number; lw?: number } = {}
): StyleLayer[] => [
  { d, fill: paint, shade: opts.shade, mask: true },
  ...clips.map((c) => ({ ...c, clip: true })),
  { d, stroke: 'ink', lineWidth: opts.lw ?? 4 }
]

/** Closed smooth ribbon around a centerline with per-point widths — tapered
 *  brows, mustaches, strands, tears. */
function ribbon(pts: Pt[], widths: number | number[]): string {
  const n = pts.length
  const w = (i: number) => (Array.isArray(widths) ? widths[i] : widths)
  const L: Pt[] = []
  const R: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(n - 1, i + 1)]
    let tx = b[0] - a[0]
    let ty = b[1] - a[1]
    const len = Math.hypot(tx, ty) || 1
    tx /= len
    ty /= len
    const h = Math.max(0.4, w(i) / 2)
    L.push([pts[i][0] - ty * h, pts[i][1] + tx * h])
    R.push([pts[i][0] + ty * h, pts[i][1] - tx * h])
  }
  return smooth([...L, ...R.reverse()])
}

/** Points on an ellipse, `count` of them starting at angle a0 (degrees,
 *  screen space: 0 = right, 90 = down), stepping `step` degrees. */
function arcPts(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  a0: number,
  step: number,
  count: number
): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < count; i++) {
    const t = ((a0 + step * i) * Math.PI) / 180
    out.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry])
  }
  return out
}

/** Closed scalloped outline through points listed clockwise: every edge is
 *  a small outward bulge (curls, fluff, clouds, feathers). */
function scallop(pts: Pt[], bulge = 0.62): string {
  const r2 = (n: number) => String(Math.round(n * 100) / 100)
  let d = `M ${r2(pts[0][0])} ${r2(pts[0][1])}`
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i % pts.length]
    const r = Math.hypot(b[0] - a[0], b[1] - a[1]) * bulge
    d += ` A ${r2(r)} ${r2(r)} 0 0 1 ${r2(b[0])} ${r2(b[1])}`
  }
  return d + ' Z'
}

/** Several shapes merged into one path (one layer, one draw). */
const join = (...ds: string[]): string => ds.join(' ')

/** Like mirrored(), but each left/right pair merges into ONE layer (no
 *  gradients) — halves the layer count of symmetric details. */
const twin = (right: StyleLayer[]): StyleLayer[] =>
  right.map((l) => ({ ...l, d: join(flipX(l.d), l.d) }))

// Eye pair helper — symmetric eyes repeat the same shapes at both centers (the
// catchlights stay on the same side, so the light reads consistently).
const EYE_L = 132
const EYE_R = 188
const EYE_Y = 152
const eachEye = (make: (cx: number) => StyleLayer[]): StyleLayer[] => [
  ...make(EYE_L),
  ...make(EYE_R)
]

/** Upper half of an ellipse as one cubic — a bold upper-lid line. */
const upperLid = (cx: number, cy: number, rx: number, ry: number): string =>
  `M ${cx - rx} ${cy} C ${cx - rx} ${cy - ry * 1.33} ${cx + rx} ${cy - ry * 1.33} ${cx + rx} ${cy}`

/** Radial iris gradient — lighter at the bottom, a dark rim. */
const irisGrad = (cx: number, cy: number, r: number): StyleLayer['grad'] => ({
  type: 'radial',
  cx,
  cy: cy + r * 0.25,
  r: r * 1.15,
  stops: [
    [0, 'eyes', 0.35],
    [0.55, 'eyes', 0],
    [1, 'eyes', -0.45]
  ]
})

/** A tracked round eye: white (mask) → iris → pupil → catchlights → lid
 *  shadow, then the contour and upper lid. */
function roundEye(
  cx: number,
  o: {
    wy?: number
    wrx: number
    wry: number
    iy: number
    irx: number
    iry: number
    prx: number
    pry: number
    hi: number
    hi2?: number
    track?: number
    lid?: number
  }
): StyleLayer[] {
  const wy = o.wy ?? EYE_Y
  const tr = o.track ?? 3
  const layers: StyleLayer[] = [
    { d: E(cx, wy, o.wrx, o.wry), fill: WHITE, mask: true },
    { d: E(cx, o.iy, o.irx, o.iry), grad: irisGrad(cx, o.iy, o.iry), clip: true, track: tr },
    { d: E(cx, o.iy + 0.6, o.prx, o.pry), fill: 'ink', clip: true, track: tr * 1.05 },
    {
      d: E(cx + o.irx * 0.4, o.iy - o.iry * 0.45, o.hi, o.hi),
      fill: WHITE,
      clip: true,
      track: tr * 0.8
    }
  ]
  if (o.hi2) {
    layers.push({
      d: E(cx - o.irx * 0.42, o.iy + o.iry * 0.5, o.hi2, o.hi2),
      fill: WHITE,
      alpha: 0.85,
      clip: true,
      track: tr * 0.8
    })
  }
  layers.push(
    {
      d: E(cx, wy - o.wry * 0.95, o.wrx * 1.25, o.wry * 0.55),
      fill: '#8a82a6',
      alpha: 0.28,
      clip: true
    },
    { d: E(cx, wy, o.wrx, o.wry), stroke: 'ink', lineWidth: 3 },
    { d: upperLid(cx, wy, o.wrx + 0.4, o.wry + 0.3), stroke: 'ink', lineWidth: o.lid ?? 4.5 }
  )
  return layers
}

// ── Shared body geometry ──────────────────────────────────────────────────────
const ARM_L = 'M 106 246 Q 94 262 90 308'
const ARM_R = 'M 214 246 Q 226 262 230 308'
const HAND_L: Pt = [88, 316]
const HAND_R: Pt = [232, 316]

/** Round cartoon hands with a cel shadow. */
const hands = (dy = 0): StyleLayer[] =>
  cel(
    join(...[HAND_L, HAND_R].map(([x, y]) => E(x, y + dy, 10.5, 10.5))),
    'skin',
    [
      {
        d: join(...[HAND_L, HAND_R].map(([x, y]) => E(x + 5, y + dy + 4.5, 9, 9))),
        fill: 'skin',
        shade: -0.14
      }
    ],
    { lw: 3.5 }
  )

/** Cel shadow down the torso's right side + under the hem. */
const TORSO_SHADE = 'M 182 212 Q 197 280 185 356 L 250 356 L 250 212 Z'

/** Skin behind a neckline (fills the gap around the neck). */
const CHEST = { d: RR(134, 218, 52, 38, 6), fill: 'skin', shade: -0.1 } as StyleLayer

const TEE_BODY =
  'M 116 232 Q 118 222 130 222 L 140 222 Q 160 244 180 222 L 190 222 Q 202 222 204 232 L 200 346 L 120 346 Z'
const TEE_SLEEVE_L = 'M 104 226 Q 90 236 94 264 L 124 258 L 122 224 Z'
const TEE_SLEEVE_R = flipX(TEE_SLEEVE_L)

// Closed-neck body (hoodies, sweaters, suits): no scoop.
const CLOSED_BODY = 'M 112 234 Q 114 222 128 222 L 192 222 Q 206 222 208 234 L 204 348 L 116 348 Z'

// ── Hair geometry ─────────────────────────────────────────────────────────────
const HAIR_SHORT =
  'M 88 138 Q 84 56 160 52 Q 236 56 232 138 Q 232 106 208 96 Q 214 78 188 88 ' +
  'Q 166 72 142 88 Q 118 78 122 98 Q 92 104 88 138 Z'
const HAIR_FRINGE =
  'M 86 140 Q 82 54 160 50 Q 238 54 234 140 L 222 140 Q 228 94 198 90 ' +
  'Q 168 82 146 92 Q 116 86 118 106 Q 98 108 98 140 Z'
const HAIR_SWEPT =
  'M 88 138 Q 84 56 160 52 Q 236 56 232 138 Q 226 104 196 94 Q 160 84 124 94 Q 94 104 88 138 Z'

/** A clipped shine arc across the crown + a darker band at the hairline. */
const hairShine = (d = 'M 104 100 Q 116 66 158 60'): StyleLayer[] => [
  { d, stroke: 'hair', shade: 0.34, lineWidth: 8, alpha: 0.75 },
  { d: moveD(d, 64, -2), stroke: 'hair', shade: 0.3, lineWidth: 5, alpha: 0.55 }
]

/** Hair mass: fill mask, shine + extra clips, contour, then strand strokes. */
const hairMass = (
  d: string,
  clips: StyleLayer[],
  strands: string[] = [],
  shade = 0
): StyleLayer[] => [
  ...cel(d, 'hair', clips, { shade }),
  ...strands.map((s) => ({ d: s, stroke: 'hair', shade: shade - 0.3, lineWidth: 2.6 }))
]

// Afro / curls: bumpy outlines sampled on a shared ellipse so the front
// fringe lines up exactly with the back volume.
const AFRO_N = 22
const AFRO_STEP = 360 / AFRO_N
const AFRO_A0 = 155.5
const afroRing = arcPts(160, 112, 104, 92, AFRO_A0, AFRO_STEP, AFRO_N)
const AFRO_BACK = scallop(afroRing, 0.6)
const AFRO_FRONT = scallop(
  [
    ...afroRing.slice(0, 15),
    [236, 150],
    [228, 120],
    [208, 100],
    [184, 92],
    [160, 96],
    [136, 92],
    [112, 100],
    [92, 120],
    [84, 150]
  ],
  0.6
)

const curlRing = arcPts(160, 118, 84, 76, 150, 20, 18)
const CURLY_BACK = scallop(curlRing, 0.62)
const CURLY_FRONT = scallop(
  [
    ...arcPts(160, 118, 84, 76, 170, 20, 11).map(([x, y]) => [x, y] as Pt),
    [232, 128],
    [220, 104],
    [200, 96],
    [180, 102],
    [160, 94],
    [140, 102],
    [120, 96],
    [100, 104],
    [88, 128]
  ],
  0.62
)

// ── Parts ─────────────────────────────────────────────────────────────────────
type HeadSpec = { id: string; face: string; ear: [number, number]; earR: [number, number] }

const headPart = ({ id, face, ear, earR }: HeadSpec): StylePart => ({
  id,
  slot: 'head',
  // The neck rides the head but paints under the torso so collars cover it.
  back: [
    { d: RR(146, 186, 28, 56, 10), fill: 'skin', shade: -0.08, mask: true },
    {
      d: 'M 136 180 L 184 180 L 184 212 Q 160 226 136 212 Z',
      fill: 'skin',
      shade: -0.26,
      clip: true
    },
    { d: 'M 146 194 L 146 230 M 174 194 L 174 230', stroke: 'ink', lineWidth: 3.5 }
  ],
  layers: [
    ...mirrored<StyleLayer>([
      {
        d: E(ear[0], ear[1], earR[0], earR[1]),
        fill: 'skin',
        shade: -0.05,
        stroke: 'ink',
        lineWidth: 3.5
      },
      {
        d: `M ${ear[0] - 3} ${ear[1] - 7} Q ${ear[0] + 6} ${ear[1]} ${ear[0] - 3} ${ear[1] + 7}`,
        stroke: 'skin',
        shade: -0.26,
        lineWidth: 3
      }
    ]),
    { d: face, fill: 'skin', mask: true },
    {
      d: 'M 208 60 Q 246 150 178 232 L 262 232 L 262 60 Z',
      fill: 'skin',
      shade: -0.08,
      clip: true
    },
    {
      d: E(130, 104, 34, 26),
      grad: {
        type: 'radial',
        cx: 130,
        cy: 104,
        r: 34,
        stops: [
          [0, WHITE, 0, 0.3],
          [1, WHITE, 0, 0]
        ]
      },
      clip: true
    },
    { d: face, stroke: 'ink', lineWidth: 4 }
  ]
})

const parts: StylePart[] = [
  // ── back (behind the body; `back` band = straps/clasps over the chest) ─────
  {
    id: 'back-cape',
    slot: 'back',
    back: [
      { d: 'M 128 226 Q 160 240 192 226', stroke: 'accent', shade: -0.25, lineWidth: 3.5 },
      ...mirrored<StyleLayer>([
        { d: E(190, 227, 7, 7), fill: GOLD, stroke: 'ink', lineWidth: 3 },
        { d: E(188, 225, 2.2, 2.2), fill: WHITE, alpha: 0.8 }
      ])
    ],
    layers: [
      {
        d: 'M 118 222 Q 160 230 202 222 Q 226 300 250 414 Q 228 426 206 418 Q 184 432 160 424 Q 136 432 114 418 Q 92 426 70 414 Q 94 300 118 222 Z',
        fill: 'accent',
        shade: -0.18,
        mask: true,
        sway: 1.6
      },
      {
        d: 'M 188 222 Q 214 320 208 424 L 260 424 L 260 222 Z',
        fill: 'accent',
        shade: -0.34,
        clip: true,
        sway: 1.6
      },
      {
        d: 'M 118 222 Q 160 230 202 222 Q 226 300 250 414 Q 228 426 206 418 Q 184 432 160 424 Q 136 432 114 418 Q 92 426 70 414 Q 94 300 118 222 Z',
        stroke: 'ink',
        lineWidth: 4,
        sway: 1.6
      },
      {
        d: 'M 100 330 Q 96 380 94 414 M 222 330 Q 226 380 228 414',
        stroke: 'accent',
        shade: -0.4,
        lineWidth: 2.5,
        sway: 1.6
      }
    ]
  },
  {
    id: 'back-wings',
    slot: 'back',
    layers: mirrored<StyleLayer>([
      {
        d: scallop(
          [
            [178, 246],
            [206, 196],
            [246, 160],
            [290, 150],
            [304, 176],
            [296, 208],
            [276, 236],
            [252, 256],
            [226, 270],
            [196, 272]
          ],
          0.58
        ),
        fill: 'accent',
        shade: 0.62,
        stroke: 'ink',
        lineWidth: 3.5,
        sway: 2.2
      },
      {
        d: 'M 200 250 Q 240 214 286 176 M 204 262 Q 240 246 272 226 M 212 268 Q 236 262 250 254',
        stroke: 'accent',
        shade: 0.3,
        lineWidth: 2.5,
        sway: 2.2
      }
    ])
  },
  {
    id: 'back-backpack',
    slot: 'back',
    back: [
      ...mirrored<StyleLayer>([
        ...capsule('M 190 223 Q 198 262 196 300', 'accent', 7, -0.22),
        { d: RR(190, 280, 12, 10, 2), fill: GOLD, stroke: 'ink', lineWidth: 2.5 }
      ])
    ],
    layers: [
      { d: RR(100, 214, 120, 124, 30), fill: 'accent', shade: -0.08, stroke: 'ink', lineWidth: 4 },
      { d: RR(140, 204, 40, 18, 9), stroke: 'ink', lineWidth: 9 },
      { d: RR(140, 204, 40, 18, 9), stroke: 'accent', shade: -0.25, lineWidth: 4 },
      { d: RR(206, 250, 20, 60, 8), fill: 'accent', shade: -0.25, stroke: 'ink', lineWidth: 3 }
    ]
  },
  {
    id: 'back-sword',
    slot: 'back',
    back: [
      { d: 'M 204 226 L 124 332', stroke: 'ink', lineWidth: 11 },
      { d: 'M 204 226 L 124 332', stroke: 'outfitB', shade: -0.35, lineWidth: 6 },
      { d: RR(154, 272, 16, 14, 3), fill: GOLD, stroke: 'ink', lineWidth: 2.5 }
    ],
    layers: [
      {
        d: 'M 234 176 L 244 184 L 104 376 L 92 384 L 96 370 Z',
        grad: {
          type: 'linear',
          x1: 232,
          y1: 176,
          x2: 244,
          y2: 186,
          stops: [
            [0, METAL_HI],
            [1, METAL_LO]
          ]
        },
        stroke: 'ink',
        lineWidth: 3.5
      },
      { d: 'M 222 166 L 256 190', stroke: 'ink', lineWidth: 12 },
      { d: 'M 222 166 L 256 190', stroke: GOLD, lineWidth: 6 },
      { d: 'M 248 162 L 262 142', stroke: 'ink', lineWidth: 12 },
      { d: 'M 248 162 L 262 142', stroke: 'outfitB', shade: -0.2, lineWidth: 6 },
      { d: E(265, 137, 6, 6), fill: GOLD, stroke: 'ink', lineWidth: 3 }
    ]
  },
  {
    id: 'back-tail',
    slot: 'back',
    layers: [
      ...capsule('M 184 334 Q 248 352 258 296 Q 266 250 238 238', 'hair', 16),
      {
        d: 'M 188 330 Q 244 344 252 296',
        stroke: 'hair',
        shade: 0.28,
        lineWidth: 4,
        alpha: 0.7
      },
      { d: 'M 240 236 Q 260 244 262 262', stroke: 'hair', shade: 0.4, lineWidth: 9 }
    ].map((l) => ({ ...l, sway: 3 }))
  },
  {
    id: 'back-jetpack',
    slot: 'back',
    back: mirrored<StyleLayer>([...capsule('M 190 223 Q 198 262 196 300', 'outfitB', 7, -0.1)]),
    layers: [
      ...mirrored<StyleLayer>([
        {
          d: 'M 190 342 Q 200 372 204 386 Q 198 372 196 398 Q 190 376 184 386 Q 186 364 190 342 Z',
          fill: '#ff9d3c',
          stroke: 'ink',
          lineWidth: 2.5,
          sway: 3
        },
        { d: 'M 190 350 Q 195 366 192 380 Q 188 366 190 350 Z', fill: '#ffe27a', sway: 3 },
        ...cel(RR(176, 214, 36, 128, 17), 'outfitB', [
          { d: RR(198, 210, 20, 140, 0), fill: 'outfitB', shade: -0.2 },
          { d: RR(176, 248, 36, 10, 0), fill: GOLD }
        ]),
        { d: 'M 180 338 L 200 338 L 204 350 L 176 350 Z', fill: METAL, stroke: 'ink', lineWidth: 3 }
      ])
    ]
  },

  // ── head (face + ears; the neck is in `back`) ──────────────────────────────
  headPart({ id: 'head-round', face: E(160, 142, 72, 70), ear: [234, 152], earR: [14, 16] }),
  headPart({ id: 'head-slim', face: E(160, 144, 62, 74), ear: [224, 152], earR: [13, 15] }),
  headPart({ id: 'head-soft', face: RR(94, 74, 132, 138, 54), ear: [230, 152], earR: [14, 16] }),
  headPart({
    id: 'head-square',
    face: sym([
      [160, 71],
      [204, 74],
      [228, 96],
      [233, 142],
      [228, 186],
      [206, 208],
      [178, 215],
      [160, 216]
    ]),
    ear: [234, 150],
    earR: [14, 16]
  }),
  headPart({
    id: 'head-heart',
    face: sym([
      [160, 80],
      [176, 72],
      [206, 74],
      [228, 100],
      [232, 138],
      [224, 172],
      [202, 200],
      [176, 216],
      [160, 222]
    ]),
    ear: [232, 146],
    earR: [13, 15]
  }),
  headPart({
    id: 'head-chubby',
    face: sym([
      [160, 74],
      [204, 80],
      [228, 108],
      [238, 150],
      [230, 190],
      [202, 213],
      [160, 219]
    ]),
    ear: [238, 142],
    earR: [13, 15]
  }),

  // ── hair ───────────────────────────────────────────────────────────────────
  {
    id: 'hair-short',
    slot: 'hair',
    layers: hairMass(HAIR_SHORT, hairShine(), [
      'M 150 58 Q 150 72 142 86',
      'M 180 60 Q 186 74 188 86',
      'M 208 76 Q 214 88 208 96'
    ])
  },
  {
    id: 'hair-spiky',
    slot: 'hair',
    layers: hairMass(
      'M 88 136 Q 86 96 102 74 L 114 96 L 126 60 L 140 88 L 154 50 L 168 84 ' +
        'L 186 54 L 194 88 L 214 66 L 218 96 Q 234 102 232 136 Q 208 110 160 106 ' +
        'Q 112 110 88 136 Z',
      [
        {
          d: 'M 104 104 L 118 80 L 124 94 L 136 70',
          stroke: 'hair',
          shade: 0.35,
          lineWidth: 5,
          alpha: 0.7
        },
        {
          d: 'M 90 136 Q 112 112 160 108 Q 208 112 232 136 L 232 146 L 88 146 Z',
          fill: 'hair',
          shade: -0.2
        }
      ],
      ['M 128 70 L 136 96', 'M 156 58 L 160 96', 'M 186 62 L 184 96', 'M 212 72 L 206 100']
    )
  },
  {
    id: 'hair-bob',
    slot: 'hair',
    back: cel(
      RR(82, 84, 156, 126, 62),
      'hair',
      [
        {
          d: 'M 196 60 L 250 60 L 250 220 L 200 220 Q 226 140 196 60 Z',
          fill: 'hair',
          shade: -0.14
        }
      ],
      {
        shade: -0.14
      }
    ),
    layers: hairMass(HAIR_FRINGE, hairShine(), [
      'M 146 92 Q 150 70 160 56',
      'M 198 90 Q 204 72 196 58',
      'M 118 104 Q 110 92 112 76'
    ])
  },
  {
    id: 'hair-long',
    slot: 'hair',
    back: [
      ...cel(
        'M 84 120 Q 82 52 160 48 Q 238 52 236 120 L 242 296 Q 244 330 214 332 ' +
          'Q 226 300 216 268 Q 220 320 160 324 Q 100 320 104 268 Q 94 300 106 332 ' +
          'Q 76 330 78 296 Z',
        'hair',
        [{ d: 'M 200 60 Q 244 170 222 340 L 260 340 L 260 60 Z', fill: 'hair', shade: -0.14 }],
        { shade: -0.14 }
      ).map((l) => ({ ...l, sway: 1.2 })),
      {
        d: 'M 90 170 Q 88 240 96 300 M 230 170 Q 234 240 226 300',
        stroke: 'hair',
        shade: -0.4,
        lineWidth: 2.6,
        sway: 1.2
      }
    ],
    layers: hairMass(HAIR_FRINGE, hairShine(), [
      'M 146 92 Q 150 70 160 56',
      'M 198 90 Q 204 72 196 58',
      'M 118 104 Q 110 92 112 76'
    ])
  },
  {
    id: 'hair-buns',
    slot: 'hair',
    back: [
      ...[102, 218].flatMap((x) =>
        cel(E(x, 72, 26, 26), 'hair', [{ d: E(x + 10, 80, 22, 22), fill: 'hair', shade: -0.14 }], {
          shade: -0.06
        })
      ),
      {
        d: join(
          curve([
            [92, 66],
            [102, 58],
            [112, 68],
            [104, 80]
          ]),
          curve([
            [208, 66],
            [218, 58],
            [228, 68],
            [220, 80]
          ])
        ),
        stroke: 'hair',
        shade: -0.36,
        lineWidth: 2.6
      }
    ],
    layers: [
      ...hairMass(
        'M 88 138 Q 84 56 160 52 Q 236 56 232 138 Q 218 100 160 98 Q 102 100 88 138 Z',
        hairShine(),
        ['M 160 54 L 160 96', 'M 124 64 Q 132 84 134 100', 'M 196 64 Q 188 84 186 100']
      )
    ]
  },
  {
    id: 'hair-ponytail',
    slot: 'hair',
    back: [
      {
        d: smooth([
          [194, 56],
          [238, 56],
          [268, 96],
          [276, 158],
          [268, 220],
          [248, 258],
          [236, 232],
          [242, 184],
          [236, 134],
          [218, 98]
        ]),
        fill: 'hair',
        shade: -0.08,
        stroke: 'ink',
        lineWidth: 4,
        sway: 2.6
      },
      {
        d: 'M 236 80 Q 256 130 250 210 M 222 96 Q 240 150 244 236',
        stroke: 'hair',
        shade: -0.35,
        lineWidth: 2.6,
        sway: 2.6
      }
    ],
    layers: [
      ...hairMass(HAIR_SWEPT, hairShine('M 104 104 Q 114 70 156 60'), [
        'M 124 94 Q 150 64 198 58',
        'M 160 86 Q 180 66 212 66',
        'M 100 110 Q 120 80 170 62'
      ]),
      { d: E(222, 66, 10, 12), fill: 'accent', stroke: 'ink', lineWidth: 3.5 },
      { d: 'M 216 60 Q 222 56 228 62', stroke: 'accent', shade: 0.35, lineWidth: 2.5 }
    ]
  },
  {
    id: 'hair-curly',
    slot: 'hair',
    back: [{ d: CURLY_BACK, fill: 'hair', shade: -0.14, stroke: 'ink', lineWidth: 4 }],
    layers: hairMass(
      CURLY_FRONT,
      [
        ...hairShine('M 106 96 Q 118 64 160 56'),
        { d: 'M 178 44 Q 232 60 244 120 L 262 120 L 262 40 Z', fill: 'hair', shade: -0.12 }
      ],
      [
        join(
          curve([
            [118, 76],
            [126, 70],
            [132, 78]
          ]),
          curve([
            [150, 64],
            [158, 58],
            [164, 66]
          ]),
          curve([
            [188, 70],
            [196, 64],
            [202, 72]
          ])
        )
      ]
    )
  },
  {
    id: 'hair-sidepart',
    slot: 'hair',
    layers: hairMass(
      smooth([
        [86, 142],
        [86, 98],
        [106, 64],
        [150, 50],
        [204, 58],
        [232, 92],
        [237, 144],
        [226, 122],
        [206, 108],
        [178, 104],
        [150, 96],
        [132, 84],
        [124, 72],
        [112, 92],
        [98, 114]
      ]),
      [
        ...hairShine('M 136 66 Q 170 58 210 72'),
        { d: 'M 92 104 Q 106 76 122 70 L 118 132 Z', fill: 'hair', shade: 0.12 }
      ],
      ['M 126 68 Q 170 72 226 112', 'M 140 60 Q 190 64 222 90', 'M 122 72 Q 104 84 94 108']
    )
  },
  {
    id: 'hair-none',
    slot: 'hair',
    layers: [
      {
        d: 'M 100 106 Q 118 84 148 80',
        stroke: 'skin',
        shade: 0.28,
        lineWidth: 7
      },
      { d: E(164, 84, 5, 3), fill: 'skin', shade: 0.35, alpha: 0.8 }
    ]
  },
  {
    id: 'hair-afro',
    slot: 'hair',
    back: cel(
      AFRO_BACK,
      'hair',
      [{ d: 'M 196 10 Q 290 110 210 220 L 280 220 L 280 10 Z', fill: 'hair', shade: -0.12 }],
      {
        shade: -0.12
      }
    ),
    layers: hairMass(
      AFRO_FRONT,
      [
        ...hairShine('M 90 90 Q 108 44 160 34'),
        { d: 'M 196 10 Q 290 110 210 220 L 280 220 L 280 10 Z', fill: 'hair', shade: -0.12 }
      ],
      [
        join(
          curve([
            [112, 60],
            [122, 52],
            [130, 62]
          ]),
          curve([
            [150, 44],
            [160, 38],
            [168, 48]
          ]),
          curve([
            [192, 56],
            [202, 50],
            [208, 60]
          ]),
          curve([
            [80, 112],
            [88, 102],
            [96, 110]
          ]),
          curve([
            [222, 106],
            [230, 96],
            [238, 106]
          ])
        )
      ]
    )
  },
  {
    id: 'hair-twintails',
    slot: 'hair',
    back: mirrored<StyleLayer>([
      {
        d: smooth([
          [222, 96],
          [256, 108],
          [276, 164],
          [272, 234],
          [254, 292],
          [240, 268],
          [248, 214],
          [242, 156],
          [224, 128]
        ]),
        fill: 'hair',
        shade: -0.06,
        stroke: 'ink',
        lineWidth: 4,
        sway: 2.2
      },
      { d: 'M 248 124 Q 266 180 256 262', stroke: 'hair', shade: -0.35, lineWidth: 2.6, sway: 2.2 }
    ]),
    layers: [
      ...hairMass(HAIR_FRINGE, hairShine(), [
        'M 146 92 Q 150 70 160 56',
        'M 198 90 Q 204 72 196 58'
      ]),
      ...mirrored<StyleLayer>([
        { d: E(232, 104, 9, 11), fill: 'accent', stroke: 'ink', lineWidth: 3.5 }
      ])
    ]
  },
  {
    id: 'hair-mohawk',
    slot: 'hair',
    layers: [
      ...mirrored<StyleLayer>([
        {
          d: E(198, 104, 18, 22),
          grad: {
            type: 'radial',
            cx: 198,
            cy: 104,
            r: 22,
            stops: [
              [0, 'hair', 0, 0.3],
              [1, 'hair', 0, 0]
            ]
          }
        }
      ]),
      ...hairMass(
        symPoly([
          [160, 14],
          [170, 34],
          [184, 26],
          [182, 52],
          [198, 50],
          [186, 76],
          [178, 96],
          [160, 100]
        ]),
        [{ d: 'M 164 10 L 200 10 L 200 110 L 168 110 Z', fill: 'hair', shade: -0.16 }],
        ['M 160 26 L 160 94', 'M 148 50 L 154 92', 'M 172 50 L 166 92']
      )
    ]
  },
  {
    id: 'hair-braid',
    slot: 'hair',
    layers: [
      ...hairMass(HAIR_SWEPT, hairShine('M 104 104 Q 114 70 156 60'), [
        'M 120 96 Q 160 70 214 92',
        'M 110 104 Q 150 72 206 76'
      ]),
      ...[
        [224, 136],
        [228, 160],
        [230, 184],
        [230, 208],
        [228, 232]
      ].flatMap(([x, y], i) => [
        {
          d: E(x, y, 14 - i * 0.8, 15),
          fill: 'hair',
          shade: i % 2 ? -0.06 : 0,
          stroke: 'ink',
          lineWidth: 3.5
        },
        {
          d: `M ${x - 8} ${y - 6} Q ${x} ${y + 4} ${x + 8} ${y - 4}`,
          stroke: 'hair',
          shade: -0.3,
          lineWidth: 2.4
        }
      ]),
      { d: RR(218, 246, 20, 9, 4), fill: 'accent', stroke: 'ink', lineWidth: 3 },
      {
        d: smooth([
          [220, 254],
          [236, 254],
          [240, 270],
          [228, 284],
          [216, 270]
        ]),
        fill: 'hair',
        stroke: 'ink',
        lineWidth: 3.5
      }
    ]
  },

  // ── eyes (socket y = 152 = the eye line) ───────────────────────────────────
  {
    id: 'eyes-round',
    slot: 'eyes',
    layers: eachEye((cx) =>
      roundEye(cx, {
        wrx: 13,
        wry: 15,
        iy: 154,
        irx: 7.5,
        iry: 8.5,
        prx: 3.5,
        pry: 4,
        hi: 2.6,
        hi2: 1.3
      })
    )
  },
  {
    id: 'eyes-spark',
    slot: 'eyes',
    layers: eachEye((cx) =>
      roundEye(cx, {
        wrx: 14,
        wry: 17,
        iy: 154,
        irx: 9.5,
        iry: 12,
        prx: 4.5,
        pry: 6,
        hi: 3.4,
        hi2: 2,
        lid: 5
      })
    )
  },
  {
    id: 'eyes-sharp',
    slot: 'eyes',
    layers: mirrored<StyleLayer>(
      (() => {
        const white = smooth([
          [174, 151],
          [182, 147],
          [194, 144],
          [203, 148],
          [203, 153],
          [196, 158],
          [186, 159],
          [178, 156]
        ])
        return [
          { d: white, fill: WHITE, mask: true },
          { d: E(189, 153, 6.5, 7), grad: irisGrad(189, 153, 7), clip: true, track: 2.6 },
          { d: E(189, 153.5, 3, 3.6), fill: 'ink', clip: true, track: 2.7 },
          { d: E(191.5, 150, 1.8, 1.8), fill: WHITE, clip: true, track: 2.2 },
          { d: white, stroke: 'ink', lineWidth: 3 },
          { d: 'M 171 153 Q 184 144 194 142 Q 202 142 206 148', stroke: 'ink', lineWidth: 5 }
        ]
      })()
    )
  },
  {
    id: 'eyes-sleepy',
    slot: 'eyes',
    layers: eachEye((cx) => [
      { d: E(cx, 154, 12, 9), fill: WHITE, mask: true },
      { d: E(cx, 156, 6.5, 6.5), grad: irisGrad(cx, 156, 6.5), clip: true, track: 2.6 },
      { d: E(cx, 156.5, 3, 3.2), fill: 'ink', clip: true, track: 2.7 },
      { d: E(cx + 2.6, 154.5, 1.6, 1.6), fill: WHITE, clip: true, track: 2.2 },
      { d: RR(cx - 14, 140, 28, 12.5, 0), fill: 'skin', shade: -0.06, clip: true },
      { d: E(cx, 154, 12, 9), stroke: 'ink', lineWidth: 3 },
      { d: `M ${cx - 12.5} 152.5 Q ${cx} 149 ${cx + 12.5} 152.5`, stroke: 'ink', lineWidth: 4 },
      {
        d: `M ${cx - 11} 145 Q ${cx} 141 ${cx + 11} 145`,
        stroke: 'skin',
        shade: -0.3,
        lineWidth: 2.2
      }
    ])
  },
  {
    id: 'eyes-happy',
    slot: 'eyes',
    layers: eachEye((cx) => [
      { d: `M ${cx - 13} 156 Q ${cx} 140 ${cx + 13} 156`, stroke: 'ink', lineWidth: 5 },
      {
        d: `M ${cx - 7} 163 Q ${cx} 166 ${cx + 7} 163`,
        stroke: 'skin',
        shade: -0.22,
        lineWidth: 2.4
      }
    ])
  },
  {
    id: 'eyes-closed',
    slot: 'eyes',
    layers: mirrored<StyleLayer>([
      { d: 'M 200 142 Q 186 148 178 152 Q 186 156 200 162', stroke: 'ink', lineWidth: 5 }
    ])
  },
  {
    id: 'eyes-wide',
    slot: 'eyes',
    layers: eachEye((cx) =>
      roundEye(cx, {
        wrx: 15,
        wry: 18,
        iy: 151,
        irx: 5.5,
        iry: 6,
        prx: 2.6,
        pry: 2.8,
        hi: 1.7,
        lid: 3.6
      })
    )
  },
  {
    id: 'eyes-dot',
    slot: 'eyes',
    layers: eachEye((cx) => [
      { d: E(cx, EYE_Y, 13, 15), mask: true },
      { d: E(cx, 153, 5.5, 7), fill: 'ink', clip: true, track: 3 },
      { d: E(cx + 2, 149.5, 1.9, 1.9), fill: WHITE, clip: true, track: 2.6 }
    ])
  },
  {
    id: 'eyes-lash',
    slot: 'eyes',
    layers: [
      ...eachEye((cx) =>
        roundEye(cx, {
          wrx: 13,
          wry: 14,
          iy: 154,
          irx: 8.5,
          iry: 9.5,
          prx: 4,
          pry: 4.6,
          hi: 2.8,
          hi2: 1.5,
          lid: 5
        })
      ),
      ...mirrored<StyleLayer>([
        { d: 'M 199 144 L 206 138 M 201.5 149 L 209 146', stroke: 'ink', lineWidth: 3.2 }
      ])
    ]
  },

  // ── brows ──────────────────────────────────────────────────────────────────
  {
    id: 'brows-straight',
    slot: 'brows',
    layers: [
      { d: RR(115, 127, 34, 7, 3.5), fill: 'hair', shade: -0.3 },
      { d: RR(171, 127, 34, 7, 3.5), fill: 'hair', shade: -0.3 }
    ]
  },
  {
    id: 'brows-arched',
    slot: 'brows',
    layers: [
      { d: 'M 116 132 Q 132 118 148 130', stroke: 'hair', shade: -0.3, lineWidth: 6 },
      { d: 'M 172 130 Q 188 118 204 132', stroke: 'hair', shade: -0.3, lineWidth: 6 }
    ]
  },
  {
    id: 'brows-soft',
    slot: 'brows',
    layers: [
      { d: 'M 116 128 Q 132 124 148 131', stroke: 'hair', shade: -0.3, lineWidth: 5.5 },
      { d: 'M 204 128 Q 188 124 172 131', stroke: 'hair', shade: -0.3, lineWidth: 5.5 }
    ]
  },
  {
    id: 'brows-thick',
    slot: 'brows',
    layers: mirrored<StyleLayer>([
      {
        d: ribbon(
          [
            [170, 131],
            [182, 125],
            [196, 124],
            [207, 129]
          ],
          [8, 11, 10, 5]
        ),
        fill: 'hair',
        shade: -0.34
      }
    ])
  },
  {
    id: 'brows-angry',
    slot: 'brows',
    layers: mirrored<StyleLayer>([
      {
        d: ribbon(
          [
            [170, 138],
            [186, 130],
            [206, 122]
          ],
          [8, 8, 4]
        ),
        fill: 'hair',
        shade: -0.34
      }
    ])
  },
  {
    id: 'brows-sad',
    slot: 'brows',
    layers: mirrored<StyleLayer>([
      {
        d: ribbon(
          [
            [172, 122],
            [186, 128],
            [204, 134]
          ],
          [7, 6.5, 3.5]
        ),
        fill: 'hair',
        shade: -0.3
      }
    ])
  },
  {
    id: 'brows-raised',
    slot: 'brows',
    layers: mirrored<StyleLayer>([
      {
        d: ribbon(
          [
            [172, 124],
            [184, 114],
            [198, 114],
            [208, 122]
          ],
          [5, 6.5, 6, 3]
        ),
        fill: 'hair',
        shade: -0.3
      }
    ])
  },
  {
    id: 'brows-unibrow',
    slot: 'brows',
    layers: [
      {
        d: ribbon(
          [
            [114, 131],
            [132, 124],
            [150, 128],
            [160, 131],
            [170, 128],
            [188, 124],
            [206, 131]
          ],
          [4, 9, 8, 6, 8, 9, 4]
        ),
        fill: 'hair',
        shade: -0.34
      }
    ]
  },

  // ── nose ───────────────────────────────────────────────────────────────────
  {
    id: 'nose-button',
    slot: 'nose',
    layers: [
      { d: E(160, 169, 9, 7.5), fill: 'skin', shade: -0.04, stroke: 'ink', lineWidth: 3 },
      { d: E(156.5, 166, 3, 2.2), fill: WHITE, alpha: 0.55 }
    ]
  },
  {
    id: 'nose-small',
    slot: 'nose',
    layers: [
      { d: E(162, 173, 7, 3.2), fill: 'skin', shade: -0.16, alpha: 0.6 },
      { d: 'M 157 159 Q 168 168 157 175', stroke: 'ink', lineWidth: 3.2, alpha: 0.9 }
    ]
  },
  {
    id: 'nose-long',
    slot: 'nose',
    layers: [
      {
        d: smooth([
          [156, 144],
          [164, 158],
          [174, 172],
          [168, 180],
          [156, 179],
          [150, 173]
        ]),
        fill: 'skin',
        shade: -0.03,
        stroke: 'ink',
        lineWidth: 3
      },
      { d: 'M 156 174 Q 160 177 164 175', stroke: 'ink', lineWidth: 2.4 },
      { d: 'M 160 154 Q 164 164 168 170', stroke: WHITE, lineWidth: 2.5, alpha: 0.45 }
    ]
  },
  {
    id: 'nose-wide',
    slot: 'nose',
    layers: [
      { d: E(160, 176, 12, 3), fill: 'skin', shade: -0.18, alpha: 0.5 },
      {
        d: 'M 149 166 Q 142 174 150 177 Q 160 181 170 177 Q 178 174 171 166',
        stroke: 'ink',
        lineWidth: 3.2
      },
      { d: E(158, 166, 4, 3), fill: WHITE, alpha: 0.4 }
    ]
  },
  {
    id: 'nose-pointy',
    slot: 'nose',
    layers: [
      {
        d: 'M 158 148 Q 161 166 181 177 Q 166 182 153 177 Q 150 172 156 170',
        fill: 'skin',
        shade: -0.03,
        stroke: 'ink',
        lineWidth: 3
      }
    ]
  },

  // ── mouth ──────────────────────────────────────────────────────────────────
  {
    id: 'mouth-smile',
    slot: 'mouth',
    layers: [
      { d: 'M 136 180 Q 160 202 184 180', stroke: 'ink', lineWidth: 5 },
      {
        d: 'M 133 176 Q 134 181 138 183 M 187 176 Q 186 181 182 183',
        stroke: 'ink',
        lineWidth: 2.6
      }
    ]
  },
  {
    id: 'mouth-grin',
    slot: 'mouth',
    layers: [
      { d: 'M 134 178 Q 160 214 186 178 Z', fill: MOUTH, mask: true },
      { d: RR(128, 170, 64, 14.5, 0), fill: WHITE, clip: true },
      { d: E(160, 201, 14, 8), fill: TONGUE, clip: true },
      { d: 'M 134 178 Q 160 214 186 178 Z', stroke: 'ink', lineWidth: 4 }
    ]
  },
  {
    id: 'mouth-neutral',
    slot: 'mouth',
    layers: [{ d: 'M 143 186 Q 160 188 177 186', stroke: 'ink', lineWidth: 5 }]
  },
  {
    id: 'mouth-o',
    slot: 'mouth',
    layers: [
      { d: E(160, 188, 9, 11), fill: MOUTH, mask: true },
      { d: E(160, 198, 7, 5), fill: TONGUE, clip: true },
      { d: E(160, 188, 9, 11), stroke: 'ink', lineWidth: 4 }
    ]
  },
  {
    id: 'mouth-frown',
    slot: 'mouth',
    layers: [{ d: 'M 140 194 Q 160 178 180 194', stroke: 'ink', lineWidth: 5 }]
  },
  {
    id: 'mouth-smirk',
    slot: 'mouth',
    layers: [
      { d: 'M 140 188 Q 162 194 180 180', stroke: 'ink', lineWidth: 5 },
      { d: 'M 177 175 Q 184 178 185 184', stroke: 'ink', lineWidth: 2.6 }
    ]
  },
  {
    id: 'mouth-cat',
    slot: 'mouth',
    layers: [{ d: 'M 142 182 Q 150 195 160 186 Q 170 195 178 182', stroke: 'ink', lineWidth: 4.5 }]
  },
  {
    id: 'mouth-open',
    slot: 'mouth',
    layers: [
      {
        d: 'M 130 176 Q 160 172 190 176 Q 188 222 160 223 Q 132 222 130 176 Z',
        fill: MOUTH,
        mask: true
      },
      { d: RR(124, 166, 72, 17, 0), fill: WHITE, clip: true },
      { d: E(160, 216, 20, 12), fill: TONGUE, clip: true },
      { d: 'M 150 210 Q 160 206 170 210', stroke: TONGUE, shade: -0.2, lineWidth: 2, clip: true },
      {
        d: 'M 130 176 Q 160 172 190 176 Q 188 222 160 223 Q 132 222 130 176 Z',
        stroke: 'ink',
        lineWidth: 4
      }
    ]
  },
  {
    id: 'mouth-blep',
    slot: 'mouth',
    layers: [
      {
        d: 'M 162 186 Q 166 202 174 201 Q 182 200 180 184 Z',
        fill: TONGUE,
        stroke: 'ink',
        lineWidth: 3
      },
      { d: 'M 171 188 L 172 196', stroke: TONGUE, shade: -0.25, lineWidth: 1.8 },
      { d: 'M 138 180 Q 160 196 184 180', stroke: 'ink', lineWidth: 5 }
    ]
  },
  {
    id: 'mouth-toothy',
    slot: 'mouth',
    layers: [
      {
        d: 'M 151 185 L 151 195 Q 155 197 159 195 L 159 186 Z M 161 186 L 161 195 Q 165 197 169 195 L 169 185 Z',
        fill: WHITE,
        stroke: 'ink',
        lineWidth: 2.6
      },
      { d: 'M 136 180 Q 160 194 184 180', stroke: 'ink', lineWidth: 5 }
    ]
  },
  {
    id: 'mouth-wavy',
    slot: 'mouth',
    layers: [
      {
        d: 'M 140 188 Q 145 182 150 188 Q 155 194 160 188 Q 165 182 170 188 Q 175 194 180 188',
        stroke: 'ink',
        lineWidth: 4.2
      }
    ]
  },

  // ── facial hair ────────────────────────────────────────────────────────────
  {
    id: 'beard-stubble',
    slot: 'facialHair',
    layers: [
      {
        d: sym([
          [160, 176],
          [176, 176],
          [190, 184],
          [204, 170],
          [212, 180],
          [202, 202],
          [182, 212],
          [160, 214]
        ]),
        fill: 'hair',
        alpha: 0.24
      },
      {
        d: join(
          ...(
            [
              [140, 200],
              [150, 205],
              [170, 205],
              [180, 200],
              [160, 207],
              [128, 190],
              [192, 190],
              [146, 178],
              [174, 178]
            ] as Pt[]
          ).map(([x, y]) => E(x, y, 1, 1))
        ),
        fill: 'hair',
        shade: -0.3,
        alpha: 0.5
      }
    ]
  },
  {
    id: 'beard-full',
    slot: 'facialHair',
    layers: [
      ...cel(
        sym([
          [160, 200],
          [178, 198],
          [196, 186],
          [210, 164],
          [220, 140],
          [232, 146],
          [236, 178],
          [226, 212],
          [200, 238],
          [160, 247]
        ]),
        'hair',
        [
          { d: 'M 212 150 Q 224 226 176 256 L 250 256 L 250 130 Z', fill: 'hair', shade: -0.14 },
          { d: 'M 120 214 Q 140 226 150 238', stroke: 'hair', shade: 0.3, lineWidth: 4, alpha: 0.6 }
        ]
      ),
      {
        d: ribbon(
          [
            [134, 186],
            [146, 178],
            [160, 180],
            [174, 178],
            [186, 186]
          ],
          [4, 9, 8, 9, 4]
        ),
        fill: 'hair',
        shade: 0.05,
        stroke: 'ink',
        lineWidth: 3
      },
      {
        d: 'M 160 214 L 160 244 M 144 212 Q 146 228 150 238 M 176 212 Q 174 228 170 238',
        stroke: 'hair',
        shade: -0.35,
        lineWidth: 2.4
      }
    ]
  },
  {
    id: 'beard-goatee',
    slot: 'facialHair',
    layers: [
      {
        d: sym([
          [160, 202],
          [170, 202],
          [176, 208],
          [172, 224],
          [160, 238]
        ]),
        fill: 'hair',
        stroke: 'ink',
        lineWidth: 3
      },
      {
        d: ribbon(
          [
            [138, 188],
            [148, 180],
            [160, 181],
            [172, 180],
            [182, 188]
          ],
          [2.5, 6, 5, 6, 2.5]
        ),
        fill: 'hair',
        stroke: 'ink',
        lineWidth: 2.6
      },
      { d: 'M 160 208 L 160 228', stroke: 'hair', shade: -0.35, lineWidth: 2 }
    ]
  },
  {
    id: 'mustache',
    slot: 'facialHair',
    layers: [
      {
        d: ribbon(
          [
            [130, 188],
            [142, 178],
            [156, 177],
            [160, 180],
            [164, 177],
            [178, 178],
            [190, 188]
          ],
          [3, 10, 10, 7, 10, 10, 3]
        ),
        fill: 'hair',
        stroke: 'ink',
        lineWidth: 3
      },
      {
        d: 'M 144 178 Q 150 176 154 178 M 166 178 Q 170 176 176 178',
        stroke: 'hair',
        shade: 0.3,
        lineWidth: 2,
        alpha: 0.7
      }
    ]
  },
  {
    id: 'mustache-curly',
    slot: 'facialHair',
    layers: [
      {
        d: ribbon(
          [
            [124, 172],
            [128, 184],
            [140, 184],
            [152, 178],
            [160, 180],
            [168, 178],
            [180, 184],
            [192, 184],
            [196, 172]
          ],
          [2, 4, 7, 9, 6, 9, 7, 4, 2]
        ),
        fill: 'hair',
        stroke: 'ink',
        lineWidth: 3
      }
    ]
  },
  {
    id: 'beard-wizard',
    slot: 'facialHair',
    layers: [
      ...cel(
        sym([
          [160, 198],
          [180, 196],
          [202, 182],
          [218, 156],
          [230, 150],
          [236, 184],
          [228, 236],
          [206, 290],
          [182, 330],
          [160, 350]
        ]),
        'hair',
        [{ d: 'M 208 170 Q 224 270 172 352 L 260 352 L 260 140 Z', fill: 'hair', shade: -0.12 }]
      ),
      {
        d: ribbon(
          [
            [128, 192],
            [144, 178],
            [160, 180],
            [176, 178],
            [192, 192]
          ],
          [4, 11, 9, 11, 4]
        ),
        fill: 'hair',
        shade: 0.06,
        stroke: 'ink',
        lineWidth: 3
      },
      {
        d: 'M 160 214 L 160 330 M 140 214 Q 138 270 150 316 M 180 214 Q 182 270 170 316 M 124 210 Q 118 250 130 280 M 196 210 Q 202 250 190 280',
        stroke: 'hair',
        shade: -0.3,
        lineWidth: 2.4
      }
    ]
  },

  // ── marks (skin details) ───────────────────────────────────────────────────
  {
    id: 'marks-blush',
    slot: 'marks',
    layers: mirrored<StyleLayer>([
      {
        d: E(206, 176, 16, 9),
        grad: {
          type: 'radial',
          cx: 206,
          cy: 176,
          r: 16,
          stops: [
            [0, '#ff6b81', 0, 0.55],
            [1, '#ff6b81', 0, 0]
          ]
        }
      },
      {
        d: 'M 198 177 L 202 171 M 205 178 L 209 172 M 212 177 L 216 171',
        stroke: '#ff5a74',
        lineWidth: 2,
        alpha: 0.6
      }
    ])
  },
  {
    id: 'marks-freckles',
    slot: 'marks',
    layers: [
      {
        d: join(
          ...(
            [
              [112, 172],
              [120, 168],
              [126, 175],
              [116, 179],
              [132, 170],
              [124, 182],
              [150, 162],
              [170, 162]
            ] as Pt[]
          ).flatMap(([x, y]) => [E(x, y, 1.8, 1.8), E(320 - x, y + (x % 3) - 1, 1.8, 1.8)])
        ),
        fill: 'skin',
        shade: -0.35
      }
    ]
  },
  {
    id: 'marks-scar',
    slot: 'marks',
    layers: [
      { d: 'M 120 128 L 142 180', stroke: 'skin', shade: -0.3, lineWidth: 4.5 },
      { d: 'M 121 129 L 141 178', stroke: 'skin', shade: 0.25, lineWidth: 1.5 },
      {
        d: 'M 120 140 L 132 136 M 125 152 L 137 148 M 130 164 L 142 160',
        stroke: 'skin',
        shade: -0.36,
        lineWidth: 2.4
      }
    ]
  },
  {
    id: 'marks-mole',
    slot: 'marks',
    layers: [{ d: E(186, 180, 2.8, 2.6), fill: 'skin', shade: -0.6 }]
  },
  {
    id: 'marks-paint',
    slot: 'marks',
    layers: mirrored<StyleLayer>([
      {
        d: join(
          ribbon(
            [
              [196, 170],
              [210, 168],
              [224, 162]
            ],
            [4, 6, 3]
          ),
          ribbon(
            [
              [198, 182],
              [212, 180],
              [224, 174]
            ],
            [4, 6, 3]
          )
        ),
        fill: 'accent',
        alpha: 0.92
      }
    ])
  },
  {
    id: 'marks-hearts',
    slot: 'marks',
    layers: mirrored<StyleLayer>([
      {
        d: 'M 208 182 C 196 174 198 164 204 166 C 206 166 208 168 208 170 C 208 168 210 166 212 166 C 218 164 220 174 208 182 Z',
        fill: 'accent',
        stroke: 'ink',
        lineWidth: 2
      }
    ])
  },
  {
    id: 'marks-bags',
    slot: 'marks',
    layers: mirrored<StyleLayer>([
      { d: 'M 176 170 Q 188 176 200 170', stroke: 'skin', shade: -0.28, lineWidth: 2.4 },
      { d: E(188, 170, 12, 4), fill: 'skin', shade: -0.14, alpha: 0.5 }
    ])
  },

  // ── torso (top + arms + hands) ─────────────────────────────────────────────
  {
    id: 'torso-tee',
    slot: 'torso',
    layers: [
      ...limb(join(ARM_L, ARM_R), 'skin', 15),
      CHEST,
      ...cel(TEE_BODY, 'outfitA', [{ d: TORSO_SHADE, fill: 'outfitA', shade: -0.14 }]),
      { d: TEE_SLEEVE_L, fill: 'outfitA', stroke: 'ink', lineWidth: 4 },
      { d: TEE_SLEEVE_R, fill: 'outfitA', shade: -0.1, stroke: 'ink', lineWidth: 4 },
      { d: 'M 141 225 Q 160 247 179 225', stroke: 'outfitA', shade: -0.22, lineWidth: 4 },
      ...hands()
    ]
  },
  {
    id: 'torso-hoodie',
    slot: 'torso',
    layers: [
      ...limb(
        join(ARM_L.replace('M 106 246', 'M 108 244'), ARM_R.replace('M 214 246', 'M 212 244')),
        'outfitA',
        20
      ),
      ...capsule(join('M 90.2 300 L 89.4 306', 'M 229.8 300 L 230.6 306'), 'outfitA', 22, -0.16),
      ...cel(CLOSED_BODY, 'outfitA', [
        { d: TORSO_SHADE, fill: 'outfitA', shade: -0.14 },
        { d: RR(100, 334, 120, 20, 0), fill: 'outfitA', shade: -0.18 }
      ]),
      { d: 'M 116 334 L 204 334', stroke: 'ink', lineWidth: 2.5 },
      {
        d: 'M 136 296 L 184 296 L 176 334 L 144 334 Z',
        fill: 'outfitA',
        shade: -0.12,
        stroke: 'ink',
        lineWidth: 3
      },
      {
        d: 'M 118 226 Q 160 270 202 226 Q 196 212 160 212 Q 124 212 118 226 Z',
        fill: 'outfitA',
        shade: -0.26,
        stroke: 'ink',
        lineWidth: 3.5
      },
      { d: 'M 126 228 Q 160 256 194 228', stroke: 'outfitA', shade: 0.12, lineWidth: 3 },
      { d: 'M 150 246 L 148 268 M 170 246 L 172 268', stroke: 'ink', lineWidth: 3 },
      {
        d: E(148, 270, 2.6, 3.4) + ' ' + E(172, 270, 2.6, 3.4),
        fill: 'accent',
        stroke: 'ink',
        lineWidth: 2
      },
      ...hands(2)
    ]
  },
  {
    id: 'torso-dress',
    slot: 'torso',
    layers: [
      ...limb(join('M 108 244 Q 96 262 92 306', 'M 212 244 Q 224 262 228 306'), 'skin', 14),
      CHEST,
      ...cel(
        'M 118 232 Q 120 222 132 222 L 142 222 Q 160 240 178 222 L 188 222 Q 200 222 202 232 L 222 372 Q 160 386 98 372 Z',
        'outfitA',
        [
          {
            d: TORSO_SHADE.replace('356', '392').replace('356', '392'),
            fill: 'outfitA',
            shade: -0.14
          },
          { d: 'M 112 288 Q 160 298 208 288 L 210 296 Q 160 306 110 296 Z', fill: 'accent' }
        ]
      ),
      {
        d: 'M 138 304 Q 132 340 124 376 M 160 306 L 160 382 M 182 304 Q 188 340 196 376',
        stroke: 'outfitA',
        shade: -0.22,
        lineWidth: 2.4
      },
      {
        d: 'M 106 226 Q 94 234 98 258 Q 110 262 124 252 L 122 224 Z',
        fill: 'outfitA',
        stroke: 'ink',
        lineWidth: 4
      },
      {
        d: 'M 214 226 Q 226 234 222 258 Q 210 262 196 252 L 198 224 Z',
        fill: 'outfitA',
        shade: -0.1,
        stroke: 'ink',
        lineWidth: 4
      },
      { d: E(90, 314, 10, 10), fill: 'skin', stroke: 'ink', lineWidth: 3.5 },
      { d: E(230, 314, 10, 10), fill: 'skin', stroke: 'ink', lineWidth: 3.5 }
    ]
  },
  {
    id: 'torso-suit',
    slot: 'torso',
    layers: [
      ...limb(
        join('M 108 244 Q 94 262 90 308', 'M 212 244 Q 226 262 230 308'),
        'outfitA',
        19,
        -0.06
      ),
      ...capsule(join('M 89.5 303 L 89 307', 'M 230.5 303 L 231 307'), '#f2efe8', 17),
      ...cel(CLOSED_BODY.replace('L 204 348 L 116 348', 'L 204 348 L 116 348'), 'outfitA', [
        { d: TORSO_SHADE, fill: 'outfitA', shade: -0.14 }
      ]),
      { d: 'M 140 222 L 160 262 L 180 222 Z', fill: '#f2efe8', stroke: 'ink', lineWidth: 3 },
      {
        d: 'M 153 224 L 167 224 L 163 246 L 160 268 L 157 246 Z',
        fill: 'accent',
        stroke: 'ink',
        lineWidth: 2.5
      },
      {
        d: 'M 140 222 L 160 262 L 148 272 L 132 234 Z',
        fill: 'outfitA',
        shade: -0.16,
        stroke: 'ink',
        lineWidth: 3
      },
      {
        d: 'M 180 222 L 160 262 L 172 272 L 188 234 Z',
        fill: 'outfitA',
        shade: -0.22,
        stroke: 'ink',
        lineWidth: 3
      },
      { d: 'M 160 272 L 160 348', stroke: 'ink', lineWidth: 2.5 },
      { d: E(166, 290, 2.8, 2.8) + ' ' + E(166, 314, 2.8, 2.8), fill: 'ink' },
      {
        d: 'M 178 252 L 194 250 L 194 256 L 178 258 Z',
        fill: 'accent',
        shade: 0.2,
        stroke: 'ink',
        lineWidth: 2
      },
      ...hands()
    ]
  },
  {
    id: 'torso-sweater',
    slot: 'torso',
    layers: [
      ...limb(
        join(ARM_L.replace('M 106 246', 'M 108 244'), ARM_R.replace('M 214 246', 'M 212 244')),
        'outfitA',
        20
      ),
      ...capsule(join('M 90.2 300 L 89.4 306', 'M 229.8 300 L 230.6 306'), 'outfitA', 21, -0.14),
      ...cel(CLOSED_BODY, 'outfitA', [
        {
          d: 'M 104 272 L 114 262 L 124 272 L 134 262 L 144 272 L 154 262 L 164 272 L 174 262 L 184 272 L 194 262 L 204 272 L 214 262',
          stroke: 'accent',
          lineWidth: 5
        },
        {
          d: 'M 104 286 L 114 276 L 124 286 L 134 276 L 144 286 L 154 276 L 164 286 L 174 276 L 184 286 L 194 276 L 204 286 L 214 276',
          stroke: 'outfitB',
          shade: 0.2,
          lineWidth: 3
        },
        { d: TORSO_SHADE, fill: 'outfitA', shade: -0.14, alpha: 0.85 },
        { d: RR(100, 332, 120, 20, 0), fill: 'outfitA', shade: -0.16 },
        {
          d: 'M 124 334 L 124 348 M 136 334 L 136 348 M 148 334 L 148 348 M 160 334 L 160 348 M 172 334 L 172 348 M 184 334 L 184 348 M 196 334 L 196 348',
          stroke: 'outfitA',
          shade: -0.32,
          lineWidth: 1.8
        }
      ]),
      { d: 'M 116 332 L 204 332', stroke: 'ink', lineWidth: 2.5 },
      { d: 'M 136 222 Q 160 242 184 222', stroke: 'ink', lineWidth: 12 },
      { d: 'M 136 222 Q 160 242 184 222', stroke: 'outfitA', shade: -0.14, lineWidth: 6 },
      ...hands(2)
    ]
  },
  {
    id: 'torso-robe',
    slot: 'torso',
    layers: [
      ...cel(
        'M 118 230 Q 120 222 132 222 L 188 222 Q 200 222 202 230 L 226 430 Q 160 444 94 430 Z',
        'outfitA',
        [
          { d: 'M 184 212 Q 200 300 200 450 L 260 450 L 260 212 Z', fill: 'outfitA', shade: -0.14 },
          { d: 'M 150 262 L 142 446 M 170 262 L 178 446', stroke: 'outfitB', lineWidth: 7 },
          { d: RR(100, 290, 120, 14, 0), fill: 'accent' }
        ]
      ),
      { d: 'M 140 222 L 160 264 L 180 222', fill: 'outfitB', stroke: 'ink', lineWidth: 3 },
      { d: 'M 146 222 L 160 250 L 174 222', fill: 'skin', shade: -0.1 },
      { d: 'M 182 302 Q 190 330 186 352 M 186 302 Q 198 322 200 344', stroke: 'ink', lineWidth: 8 },
      {
        d: 'M 182 302 Q 190 330 186 352 M 186 302 Q 198 322 200 344',
        stroke: 'accent',
        lineWidth: 4
      },
      { d: E(182, 298, 7, 6), fill: 'accent', shade: -0.12, stroke: 'ink', lineWidth: 3 },
      {
        d: 'M 134 360 Q 128 400 122 432 M 188 362 Q 196 400 202 432',
        stroke: 'outfitA',
        shade: -0.24,
        lineWidth: 2.4
      },
      ...[false, true].flatMap((right) => {
        const d = 'M 108 228 Q 94 236 86 272 L 72 316 Q 92 326 112 316 L 124 262 Z'
        return [
          {
            d: right ? flipX(d) : d,
            fill: 'outfitA',
            shade: right ? -0.12 : 0,
            stroke: 'ink',
            lineWidth: 4
          },
          {
            d: right ? flipX('M 72 312 Q 92 322 112 312') : 'M 72 312 Q 92 322 112 312',
            stroke: 'outfitB',
            lineWidth: 6
          }
        ] as StyleLayer[]
      }),
      ...hands(8)
    ]
  },
  {
    id: 'torso-armor',
    slot: 'torso',
    layers: [
      ...limb(join(ARM_L, ARM_R), METAL_LO, 17),
      ...capsule(join('M 91 292 L 89.5 304', 'M 229 292 L 230.5 304'), METAL, 20),
      ...cel(CLOSED_BODY, 'outfitA', [
        { d: TORSO_SHADE, fill: 'outfitA', shade: -0.16 },
        { d: 'M 140 324 L 160 348 L 180 324', stroke: 'accent', lineWidth: 4 }
      ]),
      ...cel(
        sym([
          [160, 222],
          [184, 224],
          [202, 236],
          [204, 272],
          [196, 302],
          [178, 316],
          [160, 320]
        ]),
        METAL,
        [
          {
            d: 'M 160 210 L 250 210 L 250 330 L 160 330 Z',
            fill: METAL_LO,
            alpha: 0.55
          },
          { d: 'M 128 244 Q 134 234 146 232', stroke: METAL_HI, lineWidth: 5 }
        ]
      ),
      { d: 'M 160 226 L 160 318', stroke: 'ink', lineWidth: 2.5 },
      { d: 'M 146 264 L 160 288 L 174 264', stroke: 'accent', lineWidth: 5 },
      { d: RR(116, 314, 88, 12, 4), fill: 'outfitB', shade: -0.3, stroke: 'ink', lineWidth: 3 },
      { d: RR(152, 312, 16, 16, 3), fill: GOLD, stroke: 'ink', lineWidth: 2.5 },
      ...twin([
        {
          d: 'M 188 232 Q 206 214 226 226 Q 238 238 234 260 Q 220 252 196 256 Z',
          fill: METAL,
          shade: -0.05,
          stroke: 'ink',
          lineWidth: 3.5
        },
        { d: 'M 198 250 Q 216 244 232 250', stroke: 'ink', lineWidth: 2.5 },
        { d: 'M 198 230 Q 210 222 222 228', stroke: METAL_HI, lineWidth: 3 }
      ]),
      ...hands()
    ]
  },
  {
    id: 'torso-overalls',
    slot: 'torso',
    layers: [
      ...limb(join(ARM_L, ARM_R), 'skin', 15),
      CHEST,
      ...cel(TEE_BODY, 'accent', [{ d: TORSO_SHADE, fill: 'accent', shade: 0.28 }], {
        shade: 0.45
      }),
      { d: TEE_SLEEVE_L, fill: 'accent', shade: 0.45, stroke: 'ink', lineWidth: 4 },
      { d: TEE_SLEEVE_R, fill: 'accent', shade: 0.32, stroke: 'ink', lineWidth: 4 },
      ...cel(
        'M 130 256 L 190 256 L 192 306 L 202 312 L 200 348 L 120 348 L 118 312 L 128 306 Z',
        'outfitA',
        [
          { d: TORSO_SHADE, fill: 'outfitA', shade: -0.16 },
          { d: RR(142, 268, 36, 22, 5), stroke: 'outfitA', shade: -0.3, lineWidth: 2.5 }
        ]
      ),
      { d: 'M 132 258 L 128 224 M 188 258 L 192 224', stroke: 'ink', lineWidth: 11 },
      {
        d: 'M 132 258 L 128 224 M 188 258 L 192 224',
        stroke: 'outfitA',
        shade: -0.08,
        lineWidth: 6
      },
      {
        d: E(134, 262, 4.5, 4.5) + ' ' + E(186, 262, 4.5, 4.5),
        fill: 'accent',
        stroke: 'ink',
        lineWidth: 2.5
      },
      ...hands()
    ]
  },
  {
    id: 'torso-tank',
    slot: 'torso',
    layers: [
      ...limb(join('M 108 240 Q 94 262 90 308', 'M 212 240 Q 226 262 230 308'), 'skin', 16),
      {
        d: 'M 100 252 Q 98 226 122 222 Q 140 220 146 214 L 174 214 Q 180 220 198 222 Q 222 226 220 252 L 204 262 L 116 262 Z',
        fill: 'skin',
        shade: -0.04,
        stroke: 'ink',
        lineWidth: 4
      },
      { d: 'M 146 216 Q 160 226 174 216 L 174 236 L 146 236 Z', fill: 'skin', shade: -0.1 },
      ...cel(
        'M 124 234 Q 124 222 132 222 L 140 222 Q 160 250 180 222 L 188 222 Q 196 222 196 234 Q 200 250 206 262 L 200 346 L 120 346 L 114 262 Q 120 250 124 234 Z',
        'outfitA',
        [
          { d: TORSO_SHADE, fill: 'outfitA', shade: -0.14 },
          { d: 'M 104 272 L 216 272 L 216 280 L 104 280 Z', fill: 'accent', alpha: 0.9 }
        ]
      ),
      ...hands()
    ]
  },
  {
    id: 'torso-jacket',
    slot: 'torso',
    layers: [
      ...limb(
        join(ARM_L.replace('M 106 246', 'M 108 244'), ARM_R.replace('M 214 246', 'M 212 244')),
        'outfitA',
        20
      ),
      ...capsule(join('M 90.2 301 L 89.4 306', 'M 229.8 301 L 230.6 306'), 'outfitA', 22, -0.25),
      CHEST,
      ...cel(TEE_BODY, 'outfitB', [{ d: RR(100, 280, 120, 10, 0), fill: 'outfitB', shade: 0.45 }], {
        shade: 0.72
      }),
      ...mirrored<StyleLayer>([
        {
          d: 'M 178 222 L 192 222 Q 206 222 208 234 L 204 348 L 172 348 Q 170 290 178 222 Z',
          fill: 'outfitA',
          shade: -0.1,
          stroke: 'ink',
          lineWidth: 4
        },
        {
          d: 'M 178 222 Q 190 226 196 246 L 184 252 Z',
          fill: 'outfitA',
          shade: -0.28,
          stroke: 'ink',
          lineWidth: 3
        },
        { d: 'M 182 300 L 198 300', stroke: 'ink', lineWidth: 3 }
      ]),
      { d: 'M 116 336 L 204 336', stroke: 'ink', lineWidth: 2.5 },
      { d: E(178, 290, 2.2, 3.5), fill: METAL, stroke: 'ink', lineWidth: 1.8 },
      ...hands(2)
    ]
  },
  {
    id: 'torso-stripes',
    slot: 'torso',
    layers: [
      ...limb(
        join(ARM_L.replace('M 106 246', 'M 108 244'), ARM_R.replace('M 214 246', 'M 212 244')),
        'outfitA',
        19
      ),
      {
        d: 'M 95.5 272 L 94 278 M 92.2 290 L 91.2 296 M 224.5 272 L 226 278 M 227.8 290 L 228.8 296',
        stroke: 'outfitB',
        lineWidth: 19
      },
      CHEST,
      ...cel(TEE_BODY, 'outfitA', [
        {
          d: join(
            RR(100, 244, 120, 9, 0),
            RR(100, 266, 120, 9, 0),
            RR(100, 288, 120, 9, 0),
            RR(100, 310, 120, 9, 0),
            RR(100, 332, 120, 9, 0)
          ),
          fill: 'outfitB'
        },
        { d: TORSO_SHADE, fill: 'ink', alpha: 0.14 }
      ]),
      { d: 'M 141 225 Q 160 247 179 225', stroke: 'outfitB', lineWidth: 4 },
      ...hands()
    ]
  },

  // ── legs ───────────────────────────────────────────────────────────────────
  {
    id: 'legs-pants',
    slot: 'legs',
    layers: [
      ...limb(join('M 141 352 L 138 436', 'M 179 352 L 182 436'), 'outfitB', 21),
      { d: RR(119, 336, 82, 28, 11), fill: 'outfitB', stroke: 'ink', lineWidth: 4 },
      { d: 'M 160 350 L 160 372', stroke: 'ink', lineWidth: 2.5 }
    ]
  },
  {
    id: 'legs-shorts',
    slot: 'legs',
    layers: [
      ...limb(join('M 139 388 L 138 436', 'M 181 388 L 182 436'), 'skin', 16),
      ...capsule(join('M 141 352 L 139 390', 'M 179 352 L 181 390'), 'outfitB', 22),
      { d: RR(119, 336, 82, 28, 11), fill: 'outfitB', stroke: 'ink', lineWidth: 4 },
      { d: 'M 160 350 L 160 372', stroke: 'ink', lineWidth: 2.5 }
    ]
  },
  {
    id: 'legs-skirt',
    slot: 'legs',
    layers: [
      ...limb(join('M 140 394 L 138 436', 'M 180 394 L 182 436'), 'skin', 16),
      ...cel('M 124 338 L 196 338 L 214 396 Q 160 408 106 396 Z', 'outfitB', [
        { d: 'M 176 330 Q 190 370 190 410 L 230 410 L 230 330 Z', fill: 'outfitB', shade: -0.14 },
        { d: 'M 104 392 Q 160 404 216 392 L 216 412 L 104 412 Z', fill: 'outfitB', shade: -0.2 }
      ]),
      {
        d: 'M 142 344 L 134 400 M 160 344 L 160 402 M 178 344 L 186 400',
        stroke: 'outfitB',
        shade: -0.28,
        lineWidth: 2.4
      }
    ]
  },
  {
    id: 'legs-longskirt',
    slot: 'legs',
    layers: [
      ...limb(join('M 140 420 L 138 436', 'M 180 420 L 182 436'), 'skin', 16),
      ...cel(
        'M 124 336 L 196 336 Q 208 380 224 424 Q 160 440 96 424 Q 112 380 124 336 Z',
        'outfitB',
        [
          { d: 'M 176 330 Q 196 380 196 440 L 240 440 L 240 330 Z', fill: 'outfitB', shade: -0.14 },
          { d: 'M 90 420 Q 160 436 230 420 L 230 450 L 90 450 Z', fill: 'accent', alpha: 0.9 }
        ]
      ),
      {
        d: 'M 142 346 Q 134 390 128 426 M 160 346 L 160 430 M 178 346 Q 186 390 192 426',
        stroke: 'outfitB',
        shade: -0.28,
        lineWidth: 2.4
      }
    ]
  },
  {
    id: 'legs-jeans',
    slot: 'legs',
    layers: [
      ...limb(join('M 141 352 L 138 436', 'M 179 352 L 182 436'), 'outfitB', 21),
      ...capsule(join('M 138.3 424 L 138.1 430', 'M 181.7 424 L 181.9 430'), 'outfitB', 24, 0.22),
      {
        d: 'M 146 368 L 144 418 M 174 368 L 176 418',
        stroke: 'outfitB',
        shade: 0.25,
        lineWidth: 1.6
      },
      { d: RR(119, 336, 82, 28, 11), fill: 'outfitB', stroke: 'ink', lineWidth: 4 },
      { d: 'M 160 350 L 160 372', stroke: 'ink', lineWidth: 2.5 },
      {
        d: 'M 124 346 Q 132 358 142 356 M 196 346 Q 188 358 178 356',
        stroke: 'accent',
        lineWidth: 2
      }
    ]
  },
  {
    id: 'legs-puffy',
    slot: 'legs',
    layers: [
      ...mirrored<StyleLayer>([
        ...cel(
          smooth([
            [162, 344],
            [196, 346],
            [204, 384],
            [196, 420],
            [186, 428],
            [168, 426],
            [160, 400],
            [158, 368]
          ]),
          'outfitB',
          [
            {
              d: 'M 184 340 Q 204 390 188 434 L 220 434 L 220 340 Z',
              fill: 'outfitB',
              shade: -0.16
            }
          ]
        ),
        { d: RR(168, 422, 26, 11, 5), fill: 'accent', stroke: 'ink', lineWidth: 3 }
      ]),
      { d: RR(119, 336, 82, 24, 11), fill: 'outfitB', stroke: 'ink', lineWidth: 4 }
    ]
  },

  // ── feet (soles on y = 460) ────────────────────────────────────────────────
  {
    id: 'feet-sneakers',
    slot: 'feet',
    layers: [
      ...[112, 161].flatMap((x, i) => [
        ...cel(RR(x, 436, 47, 24, 11), 'accent', [
          { d: RR(x - 4, 450, 56, 12, 0), fill: '#f4f1ea' },
          { d: RR(x + (i ? 36 : 30), 430, 20, 22, 0), fill: 'accent', shade: -0.16 }
        ]),
        { d: `M ${x + 2} 450 L ${x + 45} 450`, stroke: 'ink', lineWidth: 2.5 },
        {
          d: `M ${x + 16} 441 L ${x + 30} 441 M ${x + 17} 446 L ${x + 29} 446`,
          stroke: '#f4f1ea',
          lineWidth: 2.5
        }
      ])
    ]
  },
  {
    id: 'feet-boots',
    slot: 'feet',
    layers: [
      ...[113, 161].flatMap((x, i) => [
        ...cel(
          RR(x, 422, 46, 38, 9),
          'accent',
          [
            { d: RR(x - 4, 452, 56, 10, 0), fill: 'accent', shade: -0.55 },
            { d: RR(x + 34, 418, 16, 34, 0), fill: 'accent', shade: -0.34 }
          ],
          { shade: -0.18 }
        ),
        { d: `M ${x + 2} 432 L ${x + 44} 432`, stroke: 'accent', shade: 0.12, lineWidth: 5 },
        {
          d: `M ${x + 10} 428 Q ${x + 14} 426 ${x + 18} 428`,
          stroke: WHITE,
          lineWidth: 2,
          alpha: i ? 0.3 : 0.5
        }
      ])
    ]
  },
  {
    id: 'feet-sandals',
    slot: 'feet',
    layers: [
      ...[112, 161].flatMap((x) => [
        { d: RR(x, 452, 47, 8, 4), fill: 'accent', shade: -0.3, stroke: 'ink', lineWidth: 3.5 },
        { d: RR(x + 4, 434, 39, 20, 9), fill: 'skin', stroke: 'ink', lineWidth: 3.5 },
        {
          d: `M ${x + 8} 451 L ${x + 8} 447 M ${x + 14} 451 L ${x + 14} 447 M ${x + 20} 451 L ${x + 20} 448`,
          stroke: 'skin',
          shade: -0.3,
          lineWidth: 1.8
        },
        { d: `M ${x + 5} 444 Q ${x + 24} 438 ${x + 42} 444`, stroke: 'ink', lineWidth: 8 },
        { d: `M ${x + 5} 444 Q ${x + 24} 438 ${x + 42} 444`, stroke: 'accent', lineWidth: 4 }
      ])
    ]
  },
  {
    id: 'feet-maryjanes',
    slot: 'feet',
    layers: [
      ...capsule(join('M 138 428 L 138 442', 'M 182 428 L 182 442'), '#f4f1ea', 17),
      ...[112, 161].flatMap((x, i) => [
        ...cel(
          RR(x, 440, 47, 20, 10),
          'accent',
          [{ d: RR(x + 32, 436, 20, 26, 0), fill: 'accent', shade: -0.34 }],
          { shade: -0.3 }
        ),
        {
          d: `M ${x + 12} 446 Q ${x + 16} 443 ${x + 22} 444`,
          stroke: WHITE,
          lineWidth: 2.4,
          alpha: 0.6
        },
        {
          d: i ? `M ${x + 16} 441 L ${x + 30} 441` : `M ${x + 17} 441 L ${x + 31} 441`,
          stroke: 'ink',
          lineWidth: 8
        },
        {
          d: i ? `M ${x + 16} 441 L ${x + 30} 441` : `M ${x + 17} 441 L ${x + 31} 441`,
          stroke: 'accent',
          shade: -0.38,
          lineWidth: 3.5
        }
      ])
    ]
  },
  {
    id: 'feet-slippers',
    slot: 'feet',
    layers: [
      ...[112, 161].flatMap((x) => [
        {
          d: join(E(x + 16, 432, 5, 12), E(x + 31, 432, 5, 12)),
          fill: 'accent',
          shade: 0.5,
          stroke: 'ink',
          lineWidth: 3
        },
        { d: join(E(x + 16, 432, 2, 7), E(x + 31, 432, 2, 7)), fill: '#ff9aae' },
        {
          d: RR(x - 2, 436, 51, 24, 12),
          fill: 'accent',
          shade: 0.55,
          stroke: 'ink',
          lineWidth: 3.5
        },
        { d: join(E(x + 17, 446, 2, 2.4), E(x + 30, 446, 2, 2.4)), fill: 'ink' },
        { d: E(x + 23.5, 451, 3, 2.2), fill: '#ff9aae' }
      ])
    ]
  },

  // ── headwear (optional) ────────────────────────────────────────────────────
  {
    id: 'hat-cap',
    slot: 'headwear',
    layers: [
      ...cel('M 96 108 Q 100 50 160 48 Q 220 50 224 108 Q 160 92 96 108 Z', 'accent', [
        { d: 'M 184 40 Q 216 70 210 110 L 240 110 L 240 40 Z', fill: 'accent', shade: -0.16 },
        { d: 'M 116 86 Q 124 62 148 56', stroke: WHITE, lineWidth: 5, alpha: 0.35 }
      ]),
      {
        d: 'M 160 50 Q 158 76 160 98 M 128 60 Q 118 80 116 104',
        stroke: 'accent',
        shade: -0.3,
        lineWidth: 2.4
      },
      { d: E(160, 106, 76, 14), fill: 'accent', shade: -0.14, stroke: 'ink', lineWidth: 3.5 },
      { d: E(160, 50, 6, 6), fill: 'accent', shade: -0.2, stroke: 'ink', lineWidth: 3 }
    ]
  },
  {
    id: 'hat-beanie',
    slot: 'headwear',
    layers: [
      ...cel('M 92 120 Q 94 52 160 48 Q 226 52 228 120 Z', 'accent', [
        { d: 'M 186 40 Q 222 76 218 124 L 240 124 L 240 40 Z', fill: 'accent', shade: -0.14 }
      ]),
      ...cel(
        RR(88, 108, 144, 20, 10),
        'accent',
        [
          {
            d: 'M 104 108 L 104 128 M 120 108 L 120 128 M 136 108 L 136 128 M 152 108 L 152 128 M 168 108 L 168 128 M 184 108 L 184 128 M 200 108 L 200 128 M 216 108 L 216 128',
            stroke: 'accent',
            shade: -0.32,
            lineWidth: 2
          }
        ],
        { shade: -0.16, lw: 3.5 }
      ),
      {
        d: scallop(arcPts(160, 42, 13, 13, 0, 40, 9), 0.7),
        fill: '#f2efe8',
        stroke: 'ink',
        lineWidth: 3
      }
    ]
  },
  {
    id: 'hat-crown',
    slot: 'headwear',
    layers: [
      ...cel(
        'M 112 76 L 108 34 L 132 54 L 146 24 L 160 50 L 174 24 L 188 54 L 212 34 L 208 76 Q 160 66 112 76 Z',
        GOLD,
        [
          { d: 'M 184 20 L 230 20 L 230 90 L 180 90 Z', fill: GOLD_LO, alpha: 0.6 },
          { d: 'M 106 62 Q 160 52 214 62 L 214 80 L 106 80 Z', fill: GOLD_LO, alpha: 0.45 }
        ],
        { lw: 3.5 }
      ),
      {
        d: join(E(108, 32, 4, 4), E(146, 22, 4, 4), E(174, 22, 4, 4), E(212, 32, 4, 4)),
        fill: GOLD,
        stroke: 'ink',
        lineWidth: 2.5
      },
      { d: E(160, 64, 6, 7), fill: 'accent', shade: -0.1, stroke: 'ink', lineWidth: 2.5 },
      {
        d: E(132, 67, 4, 4.5) + ' ' + E(188, 67, 4, 4.5),
        fill: '#e04a6a',
        stroke: 'ink',
        lineWidth: 2
      },
      { d: E(158, 61, 1.8, 2), fill: WHITE, alpha: 0.8 }
    ]
  },
  {
    id: 'hat-witch',
    slot: 'headwear',
    layers: [
      { d: E(160, 98, 104, 20), fill: 'outfitB', shade: -0.3, stroke: 'ink', lineWidth: 4 },
      ...cel(
        'M 106 100 Q 124 56 150 30 Q 176 6 214 4 Q 186 22 184 44 Q 196 70 214 100 Q 160 110 106 100 Z',
        'outfitB',
        [{ d: 'M 176 0 Q 176 60 208 110 L 240 110 L 240 0 Z', fill: 'outfitB', shade: -0.2 }],
        { shade: -0.22 }
      ),
      {
        d: 'M 110 90 Q 160 100 210 90 L 212 100 Q 160 110 108 100 Z',
        fill: 'accent',
        stroke: 'ink',
        lineWidth: 3
      },
      { d: RR(146, 88, 22, 18, 3), stroke: 'ink', lineWidth: 7 },
      { d: RR(146, 88, 22, 18, 3), stroke: GOLD, lineWidth: 3.5 }
    ]
  },
  {
    id: 'hat-top',
    slot: 'headwear',
    layers: [
      { d: E(160, 98, 84, 14), fill: 'outfitB', shade: -0.5, stroke: 'ink', lineWidth: 4 },
      ...cel(
        'M 116 98 L 118 26 Q 160 18 202 26 L 204 98 Q 160 106 116 98 Z',
        'outfitB',
        [
          { d: 'M 180 10 Q 190 60 188 110 L 220 110 L 220 10 Z', fill: 'outfitB', shade: -0.62 },
          { d: 'M 132 34 L 132 80', stroke: WHITE, lineWidth: 5, alpha: 0.18 },
          { d: 'M 110 74 Q 160 82 210 74 L 210 92 Q 160 100 110 92 Z', fill: 'accent' }
        ],
        { shade: -0.5 }
      ),
      { d: 'M 118 26 Q 160 34 202 26', stroke: 'ink', lineWidth: 3 }
    ]
  },
  {
    id: 'hat-headband',
    slot: 'headwear',
    layers: [
      { d: 'M 86 118 Q 94 70 160 70 Q 226 70 234 118', stroke: 'ink', lineWidth: 17 },
      { d: 'M 86 118 Q 94 70 160 70 Q 226 70 234 118', stroke: 'accent', lineWidth: 10 },
      { d: 'M 102 94 Q 124 76 150 74', stroke: WHITE, lineWidth: 3, alpha: 0.4 },
      ...cel(
        'M 222 92 Q 234 70 250 78 Q 256 92 240 100 Q 256 106 252 120 Q 236 126 226 104 Z',
        'accent',
        [{ d: 'M 238 90 L 260 90 L 260 130 L 238 130 Z', fill: 'accent', shade: -0.18 }],
        { lw: 3.5 }
      ),
      { d: E(228, 98, 6, 6), fill: 'accent', shade: -0.12, stroke: 'ink', lineWidth: 3 }
    ]
  },
  {
    id: 'hat-pirate',
    slot: 'headwear',
    layers: [
      ...cel(
        'M 68 104 Q 110 106 160 62 Q 210 106 252 104 Q 246 40 160 32 Q 74 40 68 104 Z',
        'outfitB',
        [{ d: 'M 190 20 Q 220 70 214 110 L 260 110 L 260 20 Z', fill: 'outfitB', shade: -0.3 }],
        { shade: -0.5 }
      ),
      { d: 'M 72 100 Q 110 102 160 60 Q 210 102 248 100', stroke: GOLD, lineWidth: 4 },
      { d: E(160, 52, 9, 8), fill: '#f4f1ea', stroke: 'ink', lineWidth: 2.5 },
      { d: E(156.5, 51, 2, 2) + ' ' + E(163.5, 51, 2, 2), fill: 'ink' },
      { d: 'M 150 64 L 170 70 M 170 64 L 150 70', stroke: '#f4f1ea', lineWidth: 3 }
    ]
  },
  {
    id: 'hat-cowboy',
    slot: 'headwear',
    layers: [
      {
        d: 'M 58 92 Q 70 112 160 112 Q 250 112 262 92 Q 266 82 252 86 Q 230 100 160 100 Q 90 100 68 86 Q 54 82 58 92 Z',
        fill: 'accent',
        shade: -0.34,
        stroke: 'ink',
        lineWidth: 4
      },
      ...cel(
        'M 110 100 Q 106 60 118 40 Q 138 34 160 44 Q 182 34 202 40 Q 214 60 210 100 Q 160 108 110 100 Z',
        'accent',
        [
          { d: 'M 184 30 Q 206 70 198 110 L 230 110 L 230 30 Z', fill: 'accent', shade: -0.2 },
          {
            d: 'M 108 84 Q 160 94 212 84 L 212 98 Q 160 108 108 98 Z',
            fill: 'outfitB',
            shade: -0.2
          }
        ],
        { shade: -0.24 }
      ),
      { d: 'M 160 46 L 160 80', stroke: 'accent', shade: -0.45, lineWidth: 2.4 }
    ]
  },
  {
    id: 'hat-bow',
    slot: 'headwear',
    layers: [
      ...cel(
        'M 206 66 Q 186 40 170 48 Q 162 64 180 80 Q 164 94 172 108 Q 190 110 206 78 Q 222 106 240 104 Q 248 88 232 74 Q 250 58 242 42 Q 226 38 206 66 Z',
        'accent',
        [{ d: 'M 206 30 L 260 30 L 260 120 L 210 120 Z', fill: 'accent', shade: -0.16 }],
        { lw: 3.5 }
      ),
      {
        d: 'M 178 60 Q 184 66 192 70 M 234 56 Q 228 62 220 68',
        stroke: 'accent',
        shade: -0.35,
        lineWidth: 2.2
      },
      { d: E(206, 72, 8, 9), fill: 'accent', shade: -0.14, stroke: 'ink', lineWidth: 3 }
    ]
  },
  {
    id: 'hat-party',
    slot: 'headwear',
    layers: [
      ...cel(
        'M 126 84 L 168 8 L 202 80 Q 164 94 126 84 Z',
        'accent',
        [
          {
            d: 'M 120 60 L 210 40 L 210 52 L 120 72 Z M 140 30 L 200 18 L 200 28 L 140 40 Z',
            fill: 'outfitA'
          },
          { d: 'M 176 0 L 220 0 L 220 100 L 190 100 Z', fill: 'ink', alpha: 0.14 }
        ],
        { lw: 3.5 }
      ),
      {
        d: scallop(arcPts(168, 8, 9, 9, 0, 45, 8), 0.7),
        fill: 'outfitA',
        shade: 0.3,
        stroke: 'ink',
        lineWidth: 3
      },
      { d: 'M 128 84 Q 164 96 202 80', stroke: 'ink', lineWidth: 2 }
    ]
  },

  // ── accessory (optional) ───────────────────────────────────────────────────
  {
    id: 'acc-glasses',
    slot: 'accessory',
    layers: [
      { d: E(132, 152, 17, 16) + ' ' + E(188, 152, 17, 16), fill: '#bfe3ff', alpha: 0.18 },
      { d: 'M 122 146 L 130 140 M 178 146 L 186 140', stroke: WHITE, lineWidth: 3, alpha: 0.7 },
      { d: E(132, 152, 17, 16), stroke: 'ink', lineWidth: 4 },
      { d: E(188, 152, 17, 16), stroke: 'ink', lineWidth: 4 },
      { d: 'M 149 150 Q 160 144 171 150', stroke: 'ink', lineWidth: 4 },
      { d: 'M 115 150 L 94 142', stroke: 'ink', lineWidth: 4 },
      { d: 'M 205 150 L 226 142', stroke: 'ink', lineWidth: 4 }
    ]
  },
  {
    id: 'acc-shades',
    slot: 'accessory',
    layers: [
      { d: 'M 115 150 L 94 142 M 205 150 L 226 142', stroke: 'ink', lineWidth: 4 },
      ...eachEye((cx) => [
        {
          d: E(cx, 152, 17, 15),
          grad: {
            type: 'linear',
            x1: cx,
            y1: 137,
            x2: cx,
            y2: 167,
            stops: [
              [0, '#1c1826'],
              [1, '#4a4260']
            ]
          },
          stroke: 'ink',
          lineWidth: 4
        }
      ]),
      { d: 'M 149 148 Q 160 142 171 148', stroke: 'ink', lineWidth: 5 },
      { d: E(126, 147, 4, 3), fill: '#8f87a3' },
      { d: E(182, 147, 4, 3), fill: '#8f87a3' },
      { d: 'M 136 160 L 142 154 M 192 160 L 198 154', stroke: '#8f87a3', lineWidth: 2.5 }
    ]
  },
  {
    id: 'acc-earrings',
    slot: 'accessory',
    layers: mirrored<StyleLayer>([
      { d: E(231, 177, 6, 7), stroke: 'ink', lineWidth: 6 },
      { d: E(231, 177, 6, 7), stroke: GOLD, lineWidth: 3 },
      { d: E(231, 168, 2.8, 2.8), fill: 'accent', stroke: 'ink', lineWidth: 1.8 }
    ])
  },
  {
    id: 'acc-necklace',
    slot: 'accessory',
    layers: [
      { d: 'M 134 224 Q 160 260 186 224', stroke: 'ink', lineWidth: 5.5 },
      { d: 'M 134 224 Q 160 260 186 224', stroke: GOLD, lineWidth: 2.5 },
      {
        d: 'M 160 242 L 170 252 L 160 266 L 150 252 Z',
        fill: 'accent',
        stroke: 'ink',
        lineWidth: 2.5
      },
      { d: 'M 157 250 L 160 247 L 163 250', stroke: WHITE, lineWidth: 1.8, alpha: 0.8 }
    ]
  },
  {
    id: 'acc-monocle',
    slot: 'accessory',
    layers: [
      { d: 'M 202 164 Q 212 190 206 214 Q 200 228 212 238', stroke: GOLD_LO, lineWidth: 2 },
      { d: E(188, 152, 18, 18), fill: '#bfe3ff', alpha: 0.2 },
      { d: 'M 177 148 L 185 140', stroke: WHITE, lineWidth: 3, alpha: 0.7 },
      { d: E(188, 152, 18, 18), stroke: 'ink', lineWidth: 7 },
      { d: E(188, 152, 18, 18), stroke: GOLD, lineWidth: 3.5 }
    ]
  },
  {
    id: 'acc-bandaids',
    slot: 'accessory',
    layers: [
      ...[
        { cx: 204, cy: 180, a: -0.5 },
        { cx: 124, cy: 104, a: 0.6 }
      ].flatMap(({ cx, cy, a }) => {
        const pt = (u: number, v: number): Pt => [
          cx + u * Math.cos(a) - v * Math.sin(a),
          cy + u * Math.sin(a) + v * Math.cos(a)
        ]
        const band = smooth(
          [pt(-17, -5), pt(17, -5), pt(18, 0), pt(17, 5), pt(-17, 5), pt(-18, 0)],
          true,
          0.5
        )
        const pad = poly([pt(-6, -5), pt(6, -5), pt(6, 5), pt(-6, 5)])
        return [
          { d: band, fill: '#f3c79a', stroke: 'ink', lineWidth: 2.6 },
          { d: pad, fill: '#e3a978' },
          {
            d: join(
              E(...pt(-12, -1.5), 0.9, 0.9),
              E(...pt(-12, 1.5), 0.9, 0.9),
              E(...pt(12, -1.5), 0.9, 0.9),
              E(...pt(12, 1.5), 0.9, 0.9)
            ),
            fill: '#c98f66'
          }
        ] as StyleLayer[]
      })
    ]
  },
  {
    id: 'acc-eyepatch',
    slot: 'accessory',
    layers: [
      { d: 'M 90 118 L 232 176', stroke: 'ink', lineWidth: 4.5 },
      {
        d: smooth([
          [116, 140],
          [134, 136],
          [150, 144],
          [148, 162],
          [132, 170],
          [116, 162]
        ]),
        fill: '#231e2c',
        stroke: 'ink',
        lineWidth: 3.5
      },
      { d: 'M 122 146 Q 130 142 138 144', stroke: '#6e6682', lineWidth: 2.5 }
    ]
  },
  {
    id: 'acc-scarf',
    slot: 'accessory',
    layers: [
      ...cel(
        'M 176 222 L 196 226 L 204 296 L 184 300 Z',
        'accent',
        [
          {
            d: 'M 170 250 L 210 244 L 210 252 L 170 258 Z M 170 272 L 210 266 L 210 274 L 170 280 Z',
            fill: 'outfitB',
            shade: 0.2
          }
        ],
        { lw: 3.5 }
      ),
      ...cel(
        'M 122 222 Q 124 206 142 206 Q 160 212 178 206 Q 196 206 198 222 Q 198 238 180 240 Q 160 236 140 240 Q 122 238 122 222 Z',
        'accent',
        [
          { d: 'M 176 200 L 210 200 L 210 244 L 172 244 Z', fill: 'accent', shade: -0.16 },
          {
            d: 'M 134 206 L 138 242 M 150 208 L 152 240',
            stroke: 'outfitB',
            shade: 0.2,
            lineWidth: 5
          }
        ],
        { lw: 3.5 }
      )
    ]
  },
  {
    id: 'acc-headphones',
    slot: 'accessory',
    layers: [
      ...capsule('M 90 138 Q 84 40 160 38 Q 236 40 230 138', 'accent', 7, -0.2),
      ...mirrored<StyleLayer>([
        ...cel(
          RR(222, 124, 22, 44, 10),
          'accent',
          [{ d: RR(234, 120, 14, 52, 0), fill: 'accent', shade: -0.22 }],
          { lw: 3.5 }
        ),
        { d: RR(214, 130, 10, 32, 5), fill: 'outfitB', shade: -0.3, stroke: 'ink', lineWidth: 3 }
      ])
    ]
  }
]

export const cartoonPack: StylePack = {
  id: 'cartoon',
  name: 'Cartoon',
  icon: 'smile',
  width: 320,
  height: 480,
  ink: INK,
  slots: [
    // z decides paint order (low = behind). backZ bands: hair backs behind
    // the body; the head's back band (the neck) just under the torso; the
    // back slot's back band (straps, clasps) just over it.
    {
      id: 'back',
      icon: 'backpack',
      socket: { x: 160, y: 230 },
      z: 2,
      backZ: 32,
      optional: true,
      thumb: { cx: 160, cy: 280, span: 330 }
    },
    {
      id: 'head',
      icon: 'user-round',
      socket: { x: 160, y: 150 },
      z: 40,
      backZ: 28,
      thumb: { cx: 160, cy: 146, span: 220 }
    },
    {
      id: 'hair',
      icon: 'waves',
      socket: { x: 160, y: 108 },
      z: 60,
      backZ: 4,
      thumb: { cx: 160, cy: 140, span: 290 }
    },
    {
      id: 'eyes',
      icon: 'eye',
      socket: { x: 160, y: EYE_Y },
      z: 50,
      thumb: { cx: 160, cy: 150, span: 120 }
    },
    {
      id: 'brows',
      icon: 'spline',
      socket: { x: 160, y: 130 },
      z: 52,
      thumb: { cx: 160, cy: 136, span: 120 }
    },
    {
      id: 'nose',
      icon: 'scan-face',
      socket: { x: 160, y: 170 },
      z: 45,
      optional: true,
      thumb: { cx: 160, cy: 166, span: 80 }
    },
    {
      id: 'mouth',
      icon: 'smile',
      socket: { x: 160, y: 188 },
      z: 51,
      thumb: { cx: 160, cy: 192, span: 100 }
    },
    {
      id: 'facialHair',
      icon: 'scissors',
      socket: { x: 160, y: 196 },
      z: 53,
      optional: true,
      thumb: { cx: 160, cy: 214, span: 190 }
    },
    {
      id: 'marks',
      icon: 'sparkles',
      socket: { x: 160, y: 160 },
      z: 42,
      optional: true,
      thumb: { cx: 160, cy: 154, span: 150 }
    },
    {
      id: 'torso',
      icon: 'shirt',
      socket: { x: 160, y: 238 },
      z: 30,
      thumb: { cx: 160, cy: 300, span: 260 }
    },
    {
      id: 'legs',
      icon: 'person-standing',
      socket: { x: 160, y: 352 },
      z: 20,
      thumb: { cx: 160, cy: 392, span: 200 }
    },
    {
      id: 'feet',
      icon: 'footprints',
      socket: { x: 160, y: 446 },
      z: 22,
      thumb: { cx: 160, cy: 446, span: 140 }
    },
    {
      id: 'headwear',
      icon: 'crown',
      socket: { x: 160, y: 86 },
      z: 70,
      optional: true,
      thumb: { cx: 160, cy: 72, span: 250 }
    },
    {
      id: 'accessory',
      icon: 'glasses',
      socket: { x: 160, y: 152 },
      z: 65,
      optional: true,
      thumb: { cx: 160, cy: 172, span: 200 }
    }
  ],
  parts,
  paletteChannels: ['skin', 'hair', 'eyes', 'outfitA', 'outfitB', 'accent'],
  palettePresets: [
    {
      skin: '#f2c9a0',
      hair: '#4a3628',
      eyes: '#4a6fae',
      outfitA: '#6c8ef5',
      outfitB: '#3f4a6b',
      accent: '#e8b04b'
    },
    {
      skin: '#e8b48c',
      hair: '#1f1f29',
      eyes: '#3d3d4d',
      outfitA: '#c95fa0',
      outfitB: '#4a3a56',
      accent: '#f2efe8'
    },
    {
      skin: '#c98a5b',
      hair: '#2e1d14',
      eyes: '#5a3d28',
      outfitA: '#2bb3a3',
      outfitB: '#2c4444',
      accent: '#f5a623'
    },
    {
      skin: '#8d5a3b',
      hair: '#141018',
      eyes: '#3a2a1e',
      outfitA: '#f5a623',
      outfitB: '#5a4a2e',
      accent: '#6c8ef5'
    },
    {
      skin: '#f6d7b8',
      hair: '#c98f3d',
      eyes: '#5a8a52',
      outfitA: '#4caf72',
      outfitB: '#3a5a44',
      accent: '#e86a5f'
    },
    {
      skin: '#eab98d',
      hair: '#a33f2e',
      eyes: '#4a6fae',
      outfitA: '#5c6bc0',
      outfitB: '#2f3652',
      accent: '#4db6ac'
    },
    {
      skin: '#f2c9a0',
      hair: '#d8d3cf',
      eyes: '#6b7a8f',
      outfitA: '#8b6cc5',
      outfitB: '#443a5c',
      accent: '#d4af37'
    },
    {
      skin: '#5b3a29',
      hair: '#141018',
      eyes: '#3a2a1e',
      outfitA: '#e86a5f',
      outfitB: '#2f3a4f',
      accent: '#f2d15c'
    },
    {
      skin: '#fbe6d6',
      hair: '#e6c77a',
      eyes: '#5fa0c9',
      outfitA: '#f28fb0',
      outfitB: '#6b4f7a',
      accent: '#8fd3c1'
    },
    {
      skin: '#a86b45',
      hair: '#5a2e1a',
      eyes: '#6b4a2f',
      outfitA: '#3f9a6a',
      outfitB: '#6b5a3a',
      accent: '#e8b04b'
    },
    {
      skin: '#4a3024',
      hair: '#0f0c10',
      eyes: '#2a1e16',
      outfitA: '#f5f1e6',
      outfitB: '#8b6cc5',
      accent: '#2bb3a3'
    },
    {
      skin: '#d9a47a',
      hair: '#4a6fc9',
      eyes: '#9b59b6',
      outfitA: '#2a2833',
      outfitB: '#44435a',
      accent: '#e04a6a'
    }
  ],
  swatches: {
    skin: [
      '#fbe6d6',
      '#f6d7b8',
      '#f2c9a0',
      '#eab98d',
      '#e8b48c',
      '#d9a47a',
      '#c98a5b',
      '#a86b45',
      '#8d5a3b',
      '#6e4430',
      '#5b3a29',
      '#4a3024',
      '#b8d4c8',
      '#c9c2ec'
    ],
    hair: [
      '#0f0c10',
      '#2e1d14',
      '#4a3628',
      '#6b4a2f',
      '#a0703f',
      '#c98f3d',
      '#e6c77a',
      '#a33f2e',
      '#e0703c',
      '#d8d3cf',
      '#4a6fc9',
      '#e27aa8',
      '#5fb7c9',
      '#7b5fc9',
      '#3f9a6a'
    ],
    eyes: [
      '#3a2a1e',
      '#5a3d28',
      '#8a6a3a',
      '#5a8a52',
      '#4a6fae',
      '#5fa0c9',
      '#6b7a8f',
      '#8a3a3a',
      '#c9a13a',
      '#9b59b6',
      '#1ab5a0',
      '#e04a6a'
    ]
  },
  defaults: {
    back: null,
    head: 'head-round',
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
  portrait: { cx: 160, cy: 150, span: 272 },
  face: { cx: 160, cy: 150, span: 186 },
  fx: {
    blush: mirrored<StyleLayer>([
      {
        d: E(206, 177, 17, 10),
        grad: {
          type: 'radial',
          cx: 206,
          cy: 177,
          r: 17,
          stops: [
            [0, '#ff6b81', 0, 0.5],
            [1, '#ff6b81', 0, 0]
          ]
        }
      },
      {
        d: 'M 199 178 L 203 172 M 206 179 L 210 173 M 213 178 L 217 172',
        stroke: '#ff5a74',
        lineWidth: 1.8,
        alpha: 0.45
      }
    ]),
    tears: mirrored<StyleLayer>([
      {
        d: ribbon(
          [
            [197, 164],
            [199, 178],
            [200, 194],
            [199, 206]
          ],
          [5, 6, 6.5, 5]
        ),
        fill: '#7cc6f2',
        alpha: 0.85
      },
      { d: E(199, 211, 5, 6.5), fill: '#7cc6f2', stroke: '#4a9fd6', lineWidth: 1.5, alpha: 0.9 },
      { d: 'M 198 170 L 198.5 190', stroke: WHITE, lineWidth: 1.8, alpha: 0.7 }
    ]),
    aging: [
      {
        d: 'M 132 100 Q 160 94 188 100 M 138 110 Q 160 105 182 110',
        stroke: 'skin',
        shade: -0.34,
        lineWidth: 2.4,
        alpha: 0.6
      },
      ...mirrored<StyleLayer>([
        {
          d: 'M 205 146 L 213 142 M 206 152 L 215 152 M 205 158 L 213 162',
          stroke: 'skin',
          shade: -0.34,
          lineWidth: 2,
          alpha: 0.6
        },
        {
          d: 'M 176 168 Q 176 184 184 194',
          stroke: 'skin',
          shade: -0.3,
          lineWidth: 2.4,
          alpha: 0.6
        },
        { d: 'M 178 166 Q 188 171 198 166', stroke: 'skin', shade: -0.3, lineWidth: 2, alpha: 0.5 }
      ])
    ]
  },
  greyHair: '#dcdad6',
  rig: {
    neck: { x: 160, y: 210 },
    hips: { x: 160, y: 344 },
    ground: { x: 160, y: 460 },
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
  }
}

/** All packs, keyed by id — future styles (ink wash, renaissance…) join here. */
export const stylePacks: Record<string, StylePack> = { [cartoonPack.id]: cartoonPack }
