// The "Simplistic" style pack — modern flat minimal illustration (think
// Kurzgesagt / Headspace / Humaaans): no outlines, flat fills, and at most one
// hard-edged flat shadow per part (a `mask` base with the shadow `clip`ped in),
// always on the viewer's right so the whole figure reads as lit from the
// upper left. Faces are minimal — dot eyes, stroke mouths, bar brows.
// Character space is 320×460; the ground line is y = 446.

import type { StyleLayer, StylePack, StylePart, StyleSlot } from '../styleTypes'
import { E, RR, mirrored, moveD, poly, sym, symPoly, type Pt } from './pathKit'

const INK = '#2b2d42'
const MOUTH = '#5b2333' // open-mouth interior (never recolors)
const TONGUE = '#f28b8b'
const WHITE = '#ffffff'
const GOLD = '#f2c14e'
const GOLD_SH = '#d9a23a'
const STEEL = '#c4ccd6'
const STEEL_SH = '#a3aebb'

// ── Shared geometry ───────────────────────────────────────────────────────────
const EYE_Y = 158
const EYE_R = 182 // right eye center x (left = mirror → 138)

/** A tall ellipse whose left edge is the light/shadow terminator on the
 *  viewer's right — clip it inside a mask for the pack's one flat shadow. */
const SHADE = E(254, 200, 58, 260)
/** Straight-edged variant for clothing (a vertical strip on the right). */
const SHADE_STRIP = poly([
  [186, 150],
  [330, 150],
  [330, 470],
  [190, 470]
])

const shadow = (paint: string, amt = -0.13, d = SHADE): StyleLayer => ({
  d,
  fill: paint,
  shade: amt,
  clip: true
})

// Right arm (viewer's right) as a quadratic; the left arm mirrors it.
const ARM: [Pt, Pt, Pt] = [
  [193, 240],
  [209, 262],
  [215, 310]
]
const HAND: Pt = [215.5, 318]

/** The sub-curve of the right arm between t0 and t1 (blossoming). */
function armSeg(t0: number, t1: number): string {
  const [p0, p1, p2] = ARM
  const at = (t: number): Pt => [
    (1 - t) ** 2 * p0[0] + 2 * t * (1 - t) * p1[0] + t * t * p2[0],
    (1 - t) ** 2 * p0[1] + 2 * t * (1 - t) * p1[1] + t * t * p2[1]
  ]
  const a = at(t0)
  const b = at(t1)
  const c: Pt = [
    p0[0] * (1 - t0) * (1 - t1) + p1[0] * ((1 - t0) * t1 + t0 * (1 - t1)) + p2[0] * t0 * t1,
    p0[1] * (1 - t0) * (1 - t1) + p1[1] * ((1 - t0) * t1 + t0 * (1 - t1)) + p2[1] * t0 * t1
  ]
  return `M ${a[0].toFixed(2)} ${a[1].toFixed(2)} Q ${c[0].toFixed(2)} ${c[1].toFixed(2)} ${b[0].toFixed(2)} ${b[1].toFixed(2)}`
}

/** Both arms: bare skin, optional sleeve from the shoulder to `to` (0..1). */
function arms(
  o: { sleeve?: string; to?: number; w?: number; sleeveShade?: number } = {}
): StyleLayer[] {
  const out: StyleLayer[] = [{ d: armSeg(0, 1), stroke: 'skin', lineWidth: 18 }]
  if (o.sleeve) {
    out.push({
      d: armSeg(0, o.to ?? 1),
      stroke: o.sleeve,
      shade: o.sleeveShade,
      lineWidth: o.w ?? 22
    })
  }
  return mirrored(out)
}

const hands = (paint = 'skin'): StyleLayer[] =>
  mirrored([{ d: E(HAND[0], HAND[1], 10.5, 11), fill: paint }])

/** Torso block: rounded shoulders, near-vertical sides (a soft trapezoid). */
function bodyD(hwTop = 39, top = 226, bottom = 338, hwBot = 41, r = 17): string {
  const L = 160 - hwTop
  const R = 160 + hwTop
  const Lb = 160 - hwBot
  const Rb = 160 + hwBot
  return (
    `M ${L + r} ${top} L ${R - r} ${top} Q ${R} ${top} ${R} ${top + r} L ${Rb} ${bottom - 7} ` +
    `Q ${Rb} ${bottom} ${Rb - 7} ${bottom} L ${Lb + 7} ${bottom} Q ${Lb} ${bottom} ${Lb} ${bottom - 7} ` +
    `L ${L} ${top + r} Q ${L} ${top} ${L + r} ${top} Z`
  )
}
const BODY = bodyD()
const NECKLINE = 'M 146 226 Q 160 239 174 226 Z'

/** A counter-direction ellipse — punches a hole when appended to a clockwise
 *  shape (nonzero fill), e.g. the mouth opening in a full beard. */
const Ecw = (cx: number, cy: number, rx: number, ry: number): string =>
  `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 1 ${rx * 2} 0 a ${rx} ${ry} 0 1 1 ${-rx * 2} 0 Z`

// ── Head ──────────────────────────────────────────────────────────────────────
function head(id: string, face: string, earX = 58): StylePart {
  return {
    id,
    slot: 'head',
    layers: [
      // Neck: ends in the torso's neckline curve (it draws above the torso)
      { d: 'M 147 190 L 173 190 L 173 216 Q 160 229 147 216 Z', fill: 'skin', shade: -0.14 },
      { d: E(160 - earX, 161, 9, 11), fill: 'skin', shade: -0.04 },
      { d: E(160 + earX, 161, 9, 11), fill: 'skin', shade: -0.12 },
      { d: face, fill: 'skin', shade: -0.11, mask: true },
      { d: moveD(face, -6, -7), fill: 'skin', clip: true }
    ]
  }
}

// ── Hair helpers ──────────────────────────────────────────────────────────────
/** One flat hair mass: mask + right-side shadow + a small top-left sheen. */
function hairMass(d: string, sheen = 'M 122 106 Q 134 94 150 90'): StyleLayer[] {
  const out: StyleLayer[] = [
    { d, fill: 'hair', mask: true },
    { d: E(246, 150, 44, 110), fill: 'hair', shade: -0.14, clip: true }
  ]
  if (sheen) out.push({ d: sheen, stroke: 'hair', shade: 0.2, lineWidth: 5, clip: true })
  return out
}
const hairBack = (d: string, sway?: number): StyleLayer => ({ d, fill: 'hair', shade: -0.2, sway })

// Smooth dome with an open forehead (buns, ponytail).
const DOME =
  'M 99 170 L 98 148 A 62 64 0 0 1 222 148 L 221 170 L 213 170 C 212 136 194 116 160 116 ' +
  'C 126 116 108 136 107 170 Z'

/** Afro: a cloud of big curls around the skull (clockwise, one union). */
function afroD(front: boolean): string {
  const subs: string[] = front
    ? [
        'M 90 150 C 88 92 118 58 160 58 C 202 58 232 92 230 150 L 214 150 C 212 132 194 122 160 122 ' +
          'C 126 122 108 132 106 150 Z'
      ]
    : [Ecw(160, 124, 70, 66)]
  const n = front ? 9 : 11
  for (let i = 0; i < n; i++) {
    const a = front
      ? Math.PI * (1.02 - (i / (n - 1)) * 1.04)
      : Math.PI * (1.25 - (i / (n - 1)) * 1.5)
    const r = front ? 24 : 26
    subs.push(
      Ecw(
        160 + (front ? 62 : 70) * Math.cos(a),
        (front ? 112 : 126) - (front ? 52 : 62) * Math.sin(a),
        r,
        r
      )
    )
  }
  return subs.join(' ')
}

function curlyD(): string {
  const subs: string[] = [
    'M 103 156 C 103 98 126 84 160 84 C 194 84 217 98 217 156 L 209 156 C 207 130 190 120 160 120 C 130 120 113 130 111 156 Z'
  ]
  for (let i = 0; i <= 11; i++) {
    const a = Math.PI * (1.1 - (i / 11) * 1.2)
    subs.push(Ecw(160 + 60 * Math.cos(a), 144 - 58 * Math.sin(a), 16, 16))
  }
  for (const x of [121, 140, 160, 180, 199]) subs.push(Ecw(x, 119, 11.5, 11.5))
  return subs.join(' ')
}

// ── Eyes ──────────────────────────────────────────────────────────────────────
/** Dot eye: an (invisible, skin-toned) socket mask, then the tracked dot. */
const dotEye = (cx: number, rx = 5.6, ry = 6.6, track = 3): StyleLayer[] => [
  { d: E(cx, EYE_Y, rx + 3.6, ry + 3.4), fill: 'skin', mask: true },
  { d: E(cx, EYE_Y, rx, ry), fill: 'eyes', clip: true, track },
  {
    d: E(cx + rx * 0.36, EYE_Y - ry * 0.4, Math.max(1.3, rx * 0.34)),
    fill: WHITE,
    clip: true,
    track: track * 0.85
  }
]
const eyePair = (right: StyleLayer[]): StyleLayer[] => mirrored(right)

// ── Parts ─────────────────────────────────────────────────────────────────────
// Head-group parts are authored with the face centered at y 150, then lowered
// by HEAD_DY at the end (a shorter, cuter neck) — see `lowerHead`.
const HEAD_DY = 10
const HEAD_SLOTS = [
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
]
const lower = (ls: StyleLayer[]): StyleLayer[] =>
  ls.map((l) => ({ ...l, d: moveD(l.d, 0, HEAD_DY) }))
function lowerHead(ps: StylePart[]): StylePart[] {
  return ps.map((p) =>
    HEAD_SLOTS.includes(p.slot)
      ? { ...p, layers: lower(p.layers), ...(p.back ? { back: lower(p.back) } : {}) }
      : p
  )
}

const rawParts: StylePart[] = [
  // ── back (behind the body; `layers` sit just above the torso) ───────────────
  {
    id: 'back-cape',
    slot: 'back',
    back: [
      {
        d: 'M 126 230 L 194 230 Q 204 230 206 240 L 232 414 Q 234 424 222 425 Q 160 434 98 425 Q 86 424 88 414 L 114 240 Q 116 230 126 230 Z',
        fill: 'accent',
        shade: -0.16,
        sway: 1.6
      },
      {
        d: 'M 200 250 L 232 414 Q 234 424 222 425 L 206 427 Z',
        fill: 'accent',
        shade: -0.28,
        sway: 1.6
      }
    ],
    layers: [
      { d: 'M 128 230 Q 144 236 146 229', stroke: 'accent', lineWidth: 7 },
      { d: 'M 192 230 Q 176 236 174 229', stroke: 'accent', shade: -0.1, lineWidth: 7 },
      { d: E(160, 236, 6), fill: GOLD },
      { d: E(158.5, 234.5, 2), fill: WHITE, alpha: 0.6 }
    ]
  },
  {
    id: 'back-wings',
    slot: 'back',
    back: mirrored([
      {
        d: smoothWing(),
        fill: 'accent',
        shade: 0.72,
        mask: true,
        sway: 2.2
      },
      {
        d: 'M 180 262 C 212 262 244 250 268 226 L 290 300 L 180 300 Z',
        fill: 'accent',
        shade: 0.5,
        clip: true,
        sway: 2.2
      }
    ]),
    layers: []
  },
  {
    id: 'back-backpack',
    slot: 'back',
    back: [
      { d: RR(98, 230, 124, 108, 30), fill: 'outfitB', shade: -0.08, mask: true },
      shadow('outfitB', -0.2),
      { d: RR(98, 230, 124, 34, 16), fill: 'outfitB', shade: 0.12, clip: true },
      { d: 'M 150 236 Q 160 222 170 236', stroke: 'outfitB', shade: -0.25, lineWidth: 5 }
    ],
    layers: mirrored([
      { d: 'M 187 230 Q 192 262 190 302', stroke: 'outfitB', shade: -0.12, lineWidth: 7 },
      { d: RR(185.5, 284, 9, 7, 2), fill: 'accent' }
    ])
  },
  {
    id: 'back-sword',
    slot: 'back',
    back: [
      {
        d: poly([
          [222, 204],
          [230, 212],
          [106, 350],
          [96, 354],
          [98, 344]
        ]),
        fill: '#e3e8ef',
        mask: true
      },
      {
        d: poly([
          [230, 212],
          [106, 350],
          [96, 354],
          [226, 208]
        ]),
        fill: '#b9c4d0',
        clip: true
      },
      { d: 'M 212 198 L 238 222', stroke: 'accent', lineWidth: 7 },
      { d: 'M 228 208 L 244 190', stroke: 'outfitB', shade: -0.2, lineWidth: 8 },
      { d: E(247, 186, 6), fill: GOLD }
    ],
    layers: []
  },
  {
    id: 'back-balloon',
    slot: 'back',
    back: [
      {
        d: 'M 256 148 Q 238 196 250 244 Q 258 286 215 318',
        stroke: '#6b6b80',
        lineWidth: 1.6,
        sway: 1.4
      },
      {
        d: poly([
          [256, 146],
          [251, 155],
          [261, 155]
        ]),
        fill: 'accent',
        shade: -0.2,
        sway: 1.4
      },
      { d: E(256, 108, 31, 38), fill: 'accent', mask: true, sway: 1.4 },
      { d: E(270, 118, 30, 44), fill: 'accent', shade: -0.14, clip: true, sway: 1.4 },
      { d: E(244, 94, 6, 9), fill: WHITE, alpha: 0.45, clip: true, sway: 1.4 }
    ],
    layers: []
  },
  {
    id: 'back-tail',
    slot: 'back',
    back: [
      {
        d: 'M 176 330 Q 236 346 248 300 Q 256 266 236 252',
        stroke: 'hair',
        shade: -0.08,
        lineWidth: 13,
        sway: 3
      },
      { d: E(236, 254, 9), fill: 'hair', shade: 0.25, sway: 3 }
    ],
    layers: []
  },

  // ── head ────────────────────────────────────────────────────────────────────
  head('head-round', E(160, 150, 58, 57)),
  head('head-slim', E(160, 149, 51, 62), 51),
  head('head-soft', RR(102, 92, 116, 117, 48)),
  head('head-square', RR(103, 93, 114, 116, 26), 57),
  head(
    'head-heart',
    sym([
      [160, 97],
      [190, 90],
      [214, 110],
      [218, 150],
      [206, 186],
      [184, 204],
      [160, 212]
    ]),
    59
  ),
  head(
    'head-egg',
    sym([
      [160, 90],
      [192, 96],
      [212, 124],
      [220, 162],
      [208, 196],
      [186, 210],
      [160, 213]
    ]),
    60
  ),

  // ── hair ────────────────────────────────────────────────────────────────────
  {
    id: 'hair-short',
    slot: 'hair',
    layers: hairMass(
      'M 99 170 L 98 148 A 62 64 0 0 1 222 148 L 221 170 L 213 170 C 213 142 208 126 198 114 ' +
        'C 176 126 146 132 116 131 C 110 140 108 154 107 170 Z'
    )
  },
  {
    id: 'hair-spiky',
    slot: 'hair',
    layers: hairMass(
      poly([
        [99, 170],
        [98, 136],
        [88, 120],
        [104, 110],
        [98, 86],
        [124, 94],
        [128, 66],
        [148, 86],
        [162, 58],
        [176, 84],
        [196, 64],
        [198, 92],
        [224, 84],
        [216, 110],
        [234, 118],
        [222, 136],
        [221, 170],
        [213, 170],
        [212, 138],
        [198, 124],
        [186, 134],
        [174, 122],
        [160, 134],
        [146, 122],
        [134, 134],
        [122, 124],
        [108, 138],
        [107, 170]
      ]),
      ''
    )
  },
  {
    id: 'hair-bob',
    slot: 'hair',
    back: [
      hairBack(
        'M 90 204 L 90 146 A 70 64 0 0 1 230 146 L 230 204 Q 230 214 220 214 L 100 214 Q 90 214 90 204 Z'
      )
    ],
    layers: hairMass(
      'M 94 198 L 94 146 A 66 62 0 0 1 226 146 L 226 198 Q 226 206 218 206 L 214 206 L 212 150 ' +
        'Q 210 130 200 126 L 120 126 Q 110 130 108 150 L 106 206 L 102 206 Q 94 206 94 198 Z'
    )
  },
  {
    id: 'hair-long',
    slot: 'hair',
    back: [
      hairBack(
        'M 92 150 C 92 100 122 82 160 82 C 198 82 228 100 228 150 L 234 300 Q 234 316 218 316 ' +
          'L 102 316 Q 86 316 86 300 Z',
        0.8
      )
    ],
    layers: [
      ...mirrored([
        {
          d:
            'M 160 86 C 198 86 224 104 225 148 L 226 244 Q 226 254 216 254 Q 212 254 212 246 ' +
            'L 210 162 C 208 126 190 104 160 100 Z',
          fill: 'hair',
          mask: true
        },
        { d: E(250, 170, 40, 120), fill: 'hair', shade: -0.14, clip: true }
      ]),
      { d: 'M 124 106 Q 136 94 152 90', stroke: 'hair', shade: 0.2, lineWidth: 5 }
    ]
  },
  {
    id: 'hair-buns',
    slot: 'hair',
    layers: [
      { d: E(114, 92, 23), fill: 'hair', shade: -0.06 },
      { d: E(206, 92, 23), fill: 'hair', shade: -0.18 },
      ...hairMass(DOME)
    ]
  },
  {
    id: 'hair-ponytail',
    slot: 'hair',
    back: [
      hairBack(
        'M 198 96 C 246 84 268 138 256 196 C 250 226 238 244 226 254 C 236 214 230 168 206 134 Z',
        2.6
      ),
      { d: E(221, 108, 8.5), fill: 'accent', sway: 2.6 }
    ],
    layers: hairMass(
      'M 99 170 L 98 148 A 62 64 0 0 1 222 148 L 221 170 L 213 170 C 212 138 200 118 176 112 ' +
        'C 158 124 132 128 114 126 C 108 138 107 152 107 170 Z'
    )
  },
  {
    id: 'hair-curly',
    slot: 'hair',
    back: [hairBack(E(160, 140, 70, 66))],
    layers: hairMass(curlyD(), '')
  },
  {
    id: 'hair-sidepart',
    slot: 'hair',
    layers: hairMass(
      'M 99 170 L 98 146 A 62 64 0 0 1 222 146 L 221 170 L 213 170 C 213 146 208 130 200 124 ' +
        'C 182 116 156 110 134 101 C 120 110 109 128 107 170 Z',
      'M 140 96 Q 170 94 196 110'
    )
  },
  {
    id: 'hair-none',
    slot: 'hair',
    layers: [
      { d: 'M 124 110 Q 134 98 150 94', stroke: 'skin', shade: 0.35, lineWidth: 6, alpha: 0.7 }
    ]
  },
  {
    id: 'hair-mohawk',
    slot: 'hair',
    layers: [
      {
        d: 'M 103 140 A 58 57 0 0 1 217 140 Q 190 126 160 126 Q 130 126 103 140 Z',
        fill: 'hair',
        alpha: 0.22
      },
      {
        d: sym([
          [160, 52],
          [174, 60],
          [180, 86],
          [178, 114],
          [160, 122]
        ]),
        fill: 'hair',
        mask: true
      },
      shadow('hair', -0.16, E(206, 90, 32, 50))
    ]
  },
  {
    id: 'hair-flattop',
    slot: 'hair',
    layers: hairMass(
      'M 99 170 L 98 104 Q 98 76 122 74 L 198 74 Q 222 76 222 104 L 221 170 L 213 170 L 212 132 ' +
        'Q 212 122 202 122 L 118 122 Q 108 122 108 132 L 107 170 Z',
      'M 116 88 L 150 86'
    )
  },
  {
    id: 'hair-afro',
    slot: 'hair',
    back: [hairBack(afroD(false))],
    layers: hairMass(afroD(true), 'M 112 84 Q 128 66 150 62')
  },
  {
    id: 'hair-bowl',
    slot: 'hair',
    layers: hairMass(
      'M 96 160 L 96 140 A 64 62 0 0 1 224 140 L 224 160 Q 224 164 220 164 L 212 164 L 212 136 ' +
        'Q 212 132 208 132 L 112 132 Q 108 132 108 136 L 108 164 L 100 164 Q 96 164 96 160 Z'
    )
  },

  // ── eyes ────────────────────────────────────────────────────────────────────
  { id: 'eyes-round', slot: 'eyes', layers: eyePair(dotEye(EYE_R)) },
  {
    id: 'eyes-spark',
    slot: 'eyes',
    layers: eyePair([
      { d: E(EYE_R, EYE_Y, 9.5, 10.5), fill: WHITE, mask: true },
      { d: E(EYE_R, EYE_Y + 1, 6.6, 7.2), fill: 'eyes', clip: true, track: 2.6 },
      { d: E(EYE_R, EYE_Y + 1, 3.3, 3.7), fill: 'eyes', shade: -0.6, clip: true, track: 2.6 },
      { d: E(EYE_R + 2.4, EYE_Y - 2.6, 2.2), fill: WHITE, clip: true, track: 2.2 },
      { d: E(EYE_R - 2.6, EYE_Y + 3.6, 1.1), fill: WHITE, clip: true, track: 2.2 },
      {
        d: `M ${EYE_R - 10} ${EYE_Y - 2} Q ${EYE_R} ${EYE_Y - 14} ${EYE_R + 10.5} ${EYE_Y - 3}`,
        stroke: 'eyes',
        shade: -0.55,
        lineWidth: 2.6
      }
    ])
  },
  {
    id: 'eyes-sharp',
    slot: 'eyes',
    layers: eyePair([
      {
        d: poly([
          [EYE_R - 10, EYE_Y - 1.5],
          [EYE_R + 10, EYE_Y - 7.5],
          [EYE_R + 10, EYE_Y + 10],
          [EYE_R - 10, EYE_Y + 10]
        ]),
        fill: 'skin',
        mask: true
      },
      { d: E(EYE_R, EYE_Y + 0.5, 6, 6.4), fill: 'eyes', clip: true, track: 2.6 },
      { d: E(EYE_R + 2, EYE_Y + 0.5, 1.7), fill: WHITE, clip: true, track: 2.2 },
      {
        d: `M ${EYE_R - 8} ${EYE_Y - 2} L ${EYE_R + 8} ${EYE_Y - 6.8}`,
        stroke: 'eyes',
        lineWidth: 2.8
      }
    ])
  },
  {
    id: 'eyes-sleepy',
    slot: 'eyes',
    layers: eyePair([
      { d: RR(EYE_R - 10, EYE_Y - 0.5, 20, 11, 3), fill: 'skin', mask: true },
      { d: E(EYE_R, EYE_Y + 1, 6, 6.4), fill: 'eyes', clip: true, track: 2.4 },
      { d: E(EYE_R + 2.2, EYE_Y + 2, 1.5), fill: WHITE, clip: true, track: 2 },
      {
        d: `M ${EYE_R - 8} ${EYE_Y} Q ${EYE_R} ${EYE_Y - 1.6} ${EYE_R + 8} ${EYE_Y}`,
        stroke: 'eyes',
        lineWidth: 2.8
      }
    ])
  },
  {
    id: 'eyes-happy',
    slot: 'eyes',
    layers: eyePair([
      {
        d: `M ${EYE_R - 7} ${EYE_Y + 3} Q ${EYE_R} ${EYE_Y - 8} ${EYE_R + 7} ${EYE_Y + 3}`,
        stroke: 'eyes',
        lineWidth: 3.6
      }
    ])
  },
  {
    id: 'eyes-closed',
    slot: 'eyes',
    layers: eyePair([
      {
        d: `M ${EYE_R + 6} ${EYE_Y - 5.5} L ${EYE_R - 5} ${EYE_Y} L ${EYE_R + 6} ${EYE_Y + 5.5}`,
        stroke: 'eyes',
        lineWidth: 3.4
      }
    ])
  },
  {
    id: 'eyes-wide',
    slot: 'eyes',
    layers: eyePair([
      { d: E(EYE_R, EYE_Y, 9.5, 10.5), fill: WHITE, mask: true },
      { d: E(EYE_R, EYE_Y, 3.8, 4.2), fill: 'eyes', clip: true, track: 3.6 },
      { d: E(EYE_R + 1.4, EYE_Y - 1.6, 1.2), fill: WHITE, clip: true, track: 3.2 }
    ])
  },
  {
    id: 'eyes-wink',
    slot: 'eyes',
    layers: [
      ...dotEye(320 - EYE_R),
      {
        d: `M ${EYE_R - 7} ${EYE_Y + 2} Q ${EYE_R} ${EYE_Y - 7} ${EYE_R + 7} ${EYE_Y + 2}`,
        stroke: 'eyes',
        lineWidth: 3.6
      }
    ]
  },
  {
    id: 'eyes-lashes',
    slot: 'eyes',
    layers: eyePair([
      ...dotEye(EYE_R, 5.4, 6.4),
      {
        d: `M ${EYE_R + 4.5} ${EYE_Y - 5} L ${EYE_R + 8.5} ${EYE_Y - 8.5}`,
        stroke: 'eyes',
        lineWidth: 2.4
      },
      {
        d: `M ${EYE_R + 6.2} ${EYE_Y - 1.8} L ${EYE_R + 10.6} ${EYE_Y - 3.6}`,
        stroke: 'eyes',
        lineWidth: 2.4
      }
    ])
  },
  { id: 'eyes-tiny', slot: 'eyes', layers: eyePair(dotEye(EYE_R, 3.6, 4, 2.4)) },

  // ── brows ───────────────────────────────────────────────────────────────────
  ...(
    [
      ['brows-straight', 'M 174 140 L 190 140', 5],
      ['brows-arched', 'M 173 141 Q 182 133 191 140', 5],
      ['brows-soft', 'M 174 140 Q 182 137.5 190 139', 3.6],
      ['brows-thick', 'M 174 139.5 L 190 139', 8],
      ['brows-angry', 'M 173 142 L 191 135', 5],
      ['brows-sad', 'M 173 135 L 191 141', 5],
      ['brows-raised', 'M 173 133 Q 182 126 191 132', 5]
    ] as [string, string, number][]
  ).map(([id, d, w]): StylePart => ({
    id,
    slot: 'brows',
    layers: mirrored([{ d, stroke: 'hair', shade: -0.32, lineWidth: w }])
  })),
  {
    id: 'brows-dots',
    slot: 'brows',
    layers: mirrored([{ d: E(183, 139, 4.2, 3.2), fill: 'hair', shade: -0.32 }])
  },

  // ── nose ────────────────────────────────────────────────────────────────────
  {
    id: 'nose-button',
    slot: 'nose',
    layers: [{ d: E(160, 171, 5.5, 4.4), fill: 'skin', shade: -0.14 }]
  },
  {
    id: 'nose-small',
    slot: 'nose',
    layers: [{ d: 'M 155.5 171 Q 160 175.5 164.5 171', stroke: 'skin', shade: -0.26, lineWidth: 3 }]
  },
  {
    id: 'nose-long',
    slot: 'nose',
    layers: [
      { d: 'M 161 152 L 167 170 Q 166 176 157 175', stroke: 'skin', shade: -0.22, lineWidth: 3 }
    ]
  },
  {
    id: 'nose-round',
    slot: 'nose',
    layers: [
      { d: E(160, 170, 8.5, 7), fill: 'skin', shade: -0.12 },
      { d: E(157, 167.5, 2.4, 1.8), fill: WHITE, alpha: 0.45 }
    ]
  },
  {
    id: 'nose-triangle',
    slot: 'nose',
    layers: [
      {
        d: 'M 160 161 Q 161.5 161 162.6 163 L 167 172 Q 168 175 165 175 L 155 175 Q 152 175 153 172 L 157.4 163 Q 158.5 161 160 161 Z',
        fill: 'skin',
        shade: -0.13
      }
    ]
  },
  {
    id: 'nose-dot',
    slot: 'nose',
    layers: [{ d: E(160, 171, 2.6, 2.1), fill: 'skin', shade: -0.35 }]
  },

  // ── mouth ───────────────────────────────────────────────────────────────────
  {
    id: 'mouth-smile',
    slot: 'mouth',
    layers: [{ d: 'M 150 183 Q 160 192.5 170 183', stroke: 'ink', lineWidth: 3.2 }]
  },
  {
    id: 'mouth-grin',
    slot: 'mouth',
    layers: [
      { d: 'M 148 181 L 172 181 Q 172 197 160 197 Q 148 197 148 181 Z', fill: MOUTH, mask: true },
      { d: RR(146, 177, 28, 7.5, 2), fill: WHITE, clip: true },
      { d: E(160, 198, 8.5, 6), fill: TONGUE, clip: true }
    ]
  },
  {
    id: 'mouth-neutral',
    slot: 'mouth',
    layers: [{ d: 'M 153 186 L 167 186', stroke: 'ink', lineWidth: 3.2 }]
  },
  {
    id: 'mouth-o',
    slot: 'mouth',
    layers: [
      { d: E(160, 187, 5.2, 6.4), fill: MOUTH, mask: true },
      { d: E(160, 192.5, 4.2, 3.2), fill: TONGUE, clip: true }
    ]
  },
  {
    id: 'mouth-frown',
    slot: 'mouth',
    layers: [{ d: 'M 151 190 Q 160 181.5 169 190', stroke: 'ink', lineWidth: 3.2 }]
  },
  {
    id: 'mouth-smirk',
    slot: 'mouth',
    layers: [
      { d: 'M 150 187 Q 161 190 170 181.5', stroke: 'ink', lineWidth: 3.2 },
      { d: 'M 172.5 179.5 Q 175 182 173.6 185', stroke: 'ink', lineWidth: 2, alpha: 0.7 }
    ]
  },
  {
    id: 'mouth-cat',
    slot: 'mouth',
    layers: [
      {
        d: 'M 149 183 Q 154.5 190 160 184.5 Q 165.5 190 171 183',
        stroke: 'ink',
        lineWidth: 3
      }
    ]
  },
  {
    id: 'mouth-open',
    slot: 'mouth',
    layers: [
      { d: 'M 145 179 L 175 179 Q 176 203 160 203 Q 144 203 145 179 Z', fill: MOUTH, mask: true },
      { d: RR(143, 175, 34, 8, 2), fill: WHITE, clip: true },
      { d: E(160, 204, 12, 9), fill: TONGUE, clip: true }
    ]
  },
  {
    id: 'mouth-tongue',
    slot: 'mouth',
    layers: [
      { d: RR(160, 183, 10, 12, 5), fill: TONGUE },
      { d: 'M 165 185 L 165 191', stroke: TONGUE, shade: -0.18, lineWidth: 1.6 },
      { d: 'M 150 182 Q 160 190.5 172 182', stroke: 'ink', lineWidth: 3.2 }
    ]
  },
  {
    id: 'mouth-teeth',
    slot: 'mouth',
    layers: [
      { d: 'M 146 181 L 174 181 Q 173 194 160 194 Q 147 194 146 181 Z', fill: MOUTH, mask: true },
      { d: RR(144, 178, 32, 10, 3), fill: WHITE, clip: true },
      { d: 'M 146 181 L 174 181', stroke: MOUTH, lineWidth: 1.2, clip: true }
    ]
  },

  // ── facial hair ─────────────────────────────────────────────────────────────
  {
    id: 'beard-stubble',
    slot: 'facialHair',
    layers: [
      { d: E(160, 150, 57.5, 56.5), fill: 'skin', alpha: 0, mask: true },
      {
        clip: true,
        d:
          'M 103 162 Q 106 208 160 209 Q 214 208 217 162 Q 210 174 196 178 Q 180 172 160 174 ' +
          'Q 140 172 124 178 Q 110 174 103 162 Z ' +
          Ecw(160, 187, 14, 8),
        fill: 'hair',
        alpha: 0.24
      }
    ]
  },
  {
    id: 'beard-full',
    slot: 'facialHair',
    layers: [
      {
        d:
          'M 101 146 L 109 146 Q 112 172 132 176 Q 146 170 160 172 Q 174 170 188 176 Q 208 172 211 146 ' +
          'L 219 146 Q 224 224 160 230 Q 96 224 101 146 Z ' +
          E(160, 187, 13, 7.5),
        fill: 'hair',
        mask: true
      },
      shadow('hair', -0.14, E(252, 190, 50, 90))
    ]
  },
  {
    id: 'beard-goatee',
    slot: 'facialHair',
    layers: [
      { d: 'M 150 196 Q 160 193 170 196 Q 172 210 160 215 Q 148 210 150 196 Z', fill: 'hair' },
      { d: 'M 148 180 Q 160 174 172 180', stroke: 'hair', lineWidth: 4 }
    ]
  },
  {
    id: 'mustache',
    slot: 'facialHair',
    layers: [
      {
        d: sym([
          [160, 176],
          [170, 173],
          [180, 175],
          [186, 180],
          [178, 183],
          [168, 182],
          [160, 181]
        ]),
        fill: 'hair'
      }
    ]
  },
  {
    id: 'beard-wizard',
    slot: 'facialHair',
    layers: [
      {
        d:
          'M 102 150 L 110 150 Q 114 172 134 176 Q 148 171 160 173 Q 172 171 186 176 Q 206 172 210 150 ' +
          'L 218 150 Q 222 214 196 250 Q 176 280 160 296 Q 144 280 124 250 Q 98 214 102 150 Z ' +
          E(160, 187, 12.5, 7),
        fill: 'hair',
        shade: 0.08,
        mask: true
      },
      shadow('hair', -0.1, E(250, 220, 58, 110))
    ]
  },
  {
    id: 'beard-chin',
    slot: 'facialHair',
    layers: [
      {
        d: 'M 108 176 Q 116 206 160 212 Q 204 206 212 176 Q 214 196 200 208 Q 184 222 160 223 Q 136 222 120 208 Q 106 196 108 176 Z',
        fill: 'hair'
      }
    ]
  },

  // ── marks ───────────────────────────────────────────────────────────────────
  {
    id: 'marks-blush',
    slot: 'marks',
    layers: mirrored([{ d: E(190, 174, 9, 5.2), fill: '#f47e7e', alpha: 0.42 }])
  },
  {
    id: 'marks-freckles',
    slot: 'marks',
    layers: mirrored([
      {
        d: [E(184, 173, 1.6), E(191, 171, 1.5), E(196, 176, 1.6), E(188, 178, 1.4)].join(' '),
        fill: 'skin',
        shade: -0.3
      }
    ])
  },
  {
    id: 'marks-scar',
    slot: 'marks',
    layers: [
      { d: 'M 188 146 L 198 172', stroke: 'skin', shade: -0.22, lineWidth: 2.6 },
      { d: 'M 188 154 L 195 152 M 191 162 L 198 160', stroke: 'skin', shade: -0.22, lineWidth: 2 }
    ]
  },
  { id: 'marks-mole', slot: 'marks', layers: [{ d: E(177, 180, 2.1), fill: 'skin', shade: -0.5 }] },
  {
    id: 'marks-paint',
    slot: 'marks',
    layers: mirrored([
      { d: 'M 180 172 L 200 170', stroke: 'accent', lineWidth: 3.6 },
      { d: 'M 182 179 L 198 177', stroke: 'accent', lineWidth: 3.6 }
    ])
  },
  {
    id: 'marks-bandaid',
    slot: 'marks',
    layers: [
      { d: RR(186, 168, 22, 10, 5), fill: '#f3cf9f' },
      { d: RR(193, 170, 8, 6, 1.5), fill: '#e7b77c' }
    ]
  },
  {
    id: 'marks-stars',
    slot: 'marks',
    layers: [
      {
        d: star(196, 170, 5.5),
        fill: 'accent'
      },
      { d: star(124, 174, 3.6), fill: 'accent', alpha: 0.85 }
    ]
  },

  // ── torso (top + arms + hands) ──────────────────────────────────────────────
  {
    id: 'torso-tee',
    slot: 'torso',
    layers: [
      ...arms({ sleeve: 'outfitA', to: 0.38, w: 23 }),
      { d: BODY, fill: 'outfitA', mask: true },
      shadow('outfitA', -0.12, SHADE_STRIP),
      { d: RR(133, 252, 15, 14, 3.5), fill: 'outfitA', shade: -0.12 },
      { d: NECKLINE, fill: 'skin', shade: -0.14 },
      ...hands()
    ]
  },
  {
    id: 'torso-hoodie',
    slot: 'torso',
    layers: [
      ...arms({ sleeve: 'outfitA', w: 21 }),
      ...mirrored([{ d: armSeg(0.86, 1), stroke: 'outfitA', shade: -0.14, lineWidth: 21 }]),
      { d: bodyD(40, 226, 340, 42), fill: 'outfitA', mask: true },
      shadow('outfitA', -0.12, SHADE_STRIP),
      { d: RR(118, 326, 84, 14, 7), fill: 'outfitA', shade: -0.14, clip: true },
      {
        d: 'M 140 292 L 180 292 Q 184 292 186 296 L 194 318 L 126 318 L 134 296 Q 136 292 140 292 Z',
        fill: 'outfitA',
        shade: -0.1
      },
      {
        d: 'M 128 230 Q 160 256 192 230 Q 188 216 160 216 Q 132 216 128 230 Z',
        fill: 'outfitA',
        shade: -0.18
      },
      {
        d: 'M 146 226 Q 160 240 174 226 Q 170 222 160 222 Q 150 222 146 226 Z',
        fill: 'skin',
        shade: -0.14
      },
      { d: 'M 151 238 L 150 262 M 169 238 L 170 262', stroke: 'accent', lineWidth: 3 },
      ...hands()
    ]
  },
  {
    id: 'torso-dress',
    slot: 'torso',
    layers: [
      ...arms({ sleeve: 'outfitA', to: 0.2, w: 25 }),
      {
        d:
          'M 142 226 L 178 226 Q 194 226 195 240 L 197 290 L 222 368 Q 225 378 214 378 L 106 378 ' +
          'Q 95 378 98 368 L 123 290 L 125 240 Q 126 226 142 226 Z',
        fill: 'outfitA',
        mask: true
      },
      shadow('outfitA', -0.12, SHADE_STRIP),
      {
        d: poly([
          [90, 284],
          [230, 284],
          [230, 294],
          [90, 294]
        ]),
        fill: 'accent',
        clip: true
      },
      { d: NECKLINE, fill: 'skin', shade: -0.14 },
      ...mirrored([{ d: 'M 160 228 Q 176 226 176 232 Q 174 240 162 236 Z', fill: WHITE }]),
      ...hands()
    ]
  },
  {
    id: 'torso-suit',
    slot: 'torso',
    layers: [
      ...arms({ sleeve: 'outfitA', w: 21 }),
      ...mirrored([{ d: armSeg(0.88, 1), stroke: 'outfitA', shade: -0.16, lineWidth: 21 }]),
      { d: BODY, fill: 'outfitA', mask: true },
      shadow('outfitA', -0.12, SHADE_STRIP),
      {
        d: poly([
          [144, 226],
          [176, 226],
          [160, 266]
        ]),
        fill: '#f7f5ef'
      },
      {
        d: poly([
          [157, 231],
          [163, 231],
          [166, 258],
          [160, 268],
          [154, 258]
        ]),
        fill: 'accent'
      },
      { d: RR(155.5, 227, 9, 7, 2.5), fill: 'accent', shade: -0.15 },
      ...mirrored([
        {
          d: poly([
            [176, 226],
            [160, 266],
            [170, 276],
            [190, 236]
          ]),
          fill: 'outfitA',
          shade: -0.14
        }
      ]),
      { d: E(160, 290, 2.6) + ' ' + E(160, 308, 2.6), fill: 'outfitA', shade: -0.35 },
      ...hands()
    ]
  },
  {
    id: 'torso-sweater',
    slot: 'torso',
    layers: [
      ...arms({ sleeve: 'outfitA', w: 22 }),
      ...mirrored([{ d: armSeg(0.86, 1), stroke: 'outfitA', shade: -0.14, lineWidth: 22 }]),
      { d: bodyD(40, 226, 340, 42), fill: 'outfitA', mask: true },
      shadow('outfitA', -0.12, SHADE_STRIP),
      {
        d: poly([
          [100, 326],
          [220, 326],
          [220, 344],
          [100, 344]
        ]),
        fill: 'outfitA',
        shade: -0.14,
        clip: true
      },
      {
        d: 'M 116 266 L 127 257 L 138 266 L 149 257 L 160 266 L 171 257 L 182 266 L 193 257 L 204 266',
        stroke: 'accent',
        lineWidth: 4,
        clip: true
      },
      {
        d: poly([
          [100, 276],
          [220, 276],
          [220, 280],
          [100, 280]
        ]),
        fill: 'outfitB',
        clip: true
      },
      {
        d: poly([
          [100, 243],
          [220, 243],
          [220, 247],
          [100, 247]
        ]),
        fill: 'outfitB',
        clip: true
      },
      { d: NECKLINE, fill: 'skin', shade: -0.14 },
      { d: 'M 143 226 Q 160 247 177 226', stroke: 'outfitA', shade: -0.16, lineWidth: 5 },
      ...hands()
    ]
  },
  {
    id: 'torso-robe',
    slot: 'torso',
    layers: [
      ...arms({ sleeve: 'outfitA', w: 25 }),
      ...mirrored([{ d: armSeg(0.84, 0.97), stroke: 'accent', lineWidth: 25 }]),
      {
        d:
          'M 140 226 L 180 226 Q 196 226 197 242 L 214 418 Q 215 428 205 428 L 115 428 Q 105 428 106 418 ' +
          'L 123 242 Q 124 226 140 226 Z',
        fill: 'outfitA',
        mask: true
      },
      shadow('outfitA', -0.12, SHADE_STRIP),
      {
        d: poly([
          [90, 296],
          [230, 296],
          [230, 307],
          [90, 307]
        ]),
        fill: 'accent',
        clip: true
      },
      { d: 'M 146 228 L 180 296', stroke: 'outfitA', shade: -0.2, lineWidth: 3 },
      {
        d: poly([
          [146, 226],
          [174, 226],
          [160, 252]
        ]),
        fill: 'skin',
        shade: -0.14
      },
      { d: RR(172, 305, 8, 34, 3), fill: 'accent', shade: -0.12 },
      ...hands()
    ]
  },
  {
    id: 'torso-armor',
    slot: 'torso',
    layers: [
      ...arms({ sleeve: 'outfitB', w: 21 }),
      ...mirrored([{ d: armSeg(0.72, 1), stroke: STEEL, lineWidth: 22 }]),
      { d: BODY, fill: 'outfitA', mask: true },
      shadow('outfitA', -0.12, SHADE_STRIP),
      {
        d: symPoly([
          [160, 228],
          [184, 230],
          [192, 258],
          [184, 284],
          [160, 294]
        ]),
        fill: STEEL,
        mask: true
      },
      {
        d: poly([
          [160, 220],
          [240, 220],
          [240, 300],
          [160, 300]
        ]),
        fill: STEEL_SH,
        clip: true
      },
      { d: RR(118, 312, 84, 11, 3), fill: 'outfitB', shade: -0.3 },
      { d: RR(154, 310, 12, 15, 3), fill: GOLD },
      ...mirrored([
        { d: E(198, 242, 20, 15), fill: STEEL, mask: true },
        { d: E(206, 248, 16, 12), fill: STEEL_SH, clip: true }
      ]),
      ...hands()
    ]
  },
  {
    id: 'torso-overalls',
    slot: 'torso',
    layers: [
      ...arms({ sleeve: 'outfitA', to: 0.38, w: 23 }),
      { d: BODY, fill: 'outfitA', mask: true },
      shadow('outfitA', -0.12, SHADE_STRIP),
      { d: NECKLINE, fill: 'skin', shade: -0.14 },
      {
        d: 'M 136 262 L 184 262 L 186 296 L 202 300 L 201 338 L 119 338 L 118 300 L 134 296 Z',
        fill: 'outfitB',
        mask: true
      },
      shadow('outfitB', -0.12, SHADE_STRIP),
      ...mirrored([
        { d: 'M 182 266 L 190 226', stroke: 'outfitB', lineWidth: 6.5 },
        { d: E(181, 268, 3), fill: 'accent' }
      ]),
      { d: RR(150, 274, 20, 14, 4), fill: 'outfitB', shade: -0.14 },
      ...hands()
    ]
  },
  {
    id: 'torso-stripes',
    slot: 'torso',
    layers: [
      ...arms({ sleeve: 'outfitA', to: 0.72, w: 22, sleeveShade: 0.84 }),
      ...mirrored([
        { d: armSeg(0.3, 0.36), stroke: 'outfitA', lineWidth: 22 },
        { d: armSeg(0.52, 0.58), stroke: 'outfitA', lineWidth: 22 }
      ]),
      { d: BODY, fill: 'outfitA', shade: 0.84, mask: true },
      {
        d: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => RR(100, 240 + i * 13, 120, 5.5, 0)).join(' '),
        fill: 'outfitA',
        clip: true
      },
      { d: SHADE_STRIP, fill: INK, alpha: 0.1, clip: true },
      { d: NECKLINE, fill: 'skin', shade: -0.14 },
      ...hands()
    ]
  },
  {
    id: 'torso-cape',
    slot: 'torso',
    layers: [
      ...arms({ sleeve: 'outfitA', w: 21 }),
      { d: BODY, fill: 'outfitA', mask: true },
      shadow('outfitA', -0.12, SHADE_STRIP),
      {
        d: 'M 160 220 C 198 220 224 246 226 286 Q 226 294 218 294 L 102 294 Q 94 294 94 286 C 96 246 122 220 160 220 Z',
        fill: 'outfitB',
        mask: true
      },
      shadow('outfitB', -0.14),
      {
        d: poly([
          [90, 284],
          [230, 284],
          [230, 296],
          [90, 296]
        ]),
        fill: 'accent',
        clip: true
      },
      {
        d: 'M 146 222 Q 160 236 174 222 Q 168 218 160 218 Q 152 218 146 222 Z',
        fill: 'skin',
        shade: -0.14
      },
      { d: E(160, 236, 5.5), fill: 'accent' },
      ...hands()
    ]
  },
  {
    id: 'torso-tank',
    slot: 'torso',
    layers: [
      ...arms(),
      { d: BODY, fill: 'skin', shade: -0.04 },
      {
        d: 'M 134 227 L 145 227 Q 160 252 175 227 L 186 227 Q 188 242 200 250 L 201 331 Q 201 338 194 338 L 126 338 Q 119 338 119 331 L 120 250 Q 132 242 134 227 Z',
        fill: 'outfitA',
        mask: true
      },
      shadow('outfitA', -0.12, SHADE_STRIP),
      ...hands()
    ]
  },

  // ── legs ────────────────────────────────────────────────────────────────────
  {
    id: 'legs-pants',
    slot: 'legs',
    layers: [
      { d: 'M 145 344 L 144 428', stroke: 'outfitB', lineWidth: 26 },
      { d: 'M 175 344 L 176 428', stroke: 'outfitB', shade: -0.12, lineWidth: 26 },
      { d: RR(119, 318, 82, 36, 14), fill: 'outfitB' }
    ]
  },
  {
    id: 'legs-shorts',
    slot: 'legs',
    layers: [
      { d: 'M 145 360 L 144 434', stroke: 'skin', lineWidth: 19 },
      { d: 'M 175 360 L 176 434', stroke: 'skin', shade: -0.08, lineWidth: 19 },
      { d: 'M 145 344 L 144.6 366', stroke: 'outfitB', lineWidth: 28 },
      { d: 'M 175 344 L 175.4 366', stroke: 'outfitB', shade: -0.12, lineWidth: 28 },
      { d: RR(119, 318, 82, 36, 14), fill: 'outfitB' }
    ]
  },
  {
    id: 'legs-skirt',
    slot: 'legs',
    layers: [
      { d: 'M 145 380 L 144 434', stroke: 'skin', lineWidth: 18 },
      { d: 'M 175 380 L 176 434', stroke: 'skin', shade: -0.08, lineWidth: 18 },
      {
        d: 'M 124 320 L 196 320 L 213 390 Q 214 397 206 397 L 114 397 Q 106 397 107 390 Z',
        fill: 'outfitB',
        mask: true
      },
      shadow('outfitB', -0.12, SHADE_STRIP),
      {
        d: poly([
          [90, 386],
          [230, 386],
          [230, 400],
          [90, 400]
        ]),
        fill: 'outfitB',
        shade: 0.16,
        clip: true
      }
    ]
  },
  {
    id: 'legs-longskirt',
    slot: 'legs',
    layers: [
      { d: 'M 145 400 L 144 434', stroke: 'skin', lineWidth: 17 },
      { d: 'M 175 400 L 176 434', stroke: 'skin', shade: -0.08, lineWidth: 17 },
      {
        d: 'M 124 320 L 196 320 L 215 422 Q 216 430 208 430 L 112 430 Q 104 430 105 422 Z',
        fill: 'outfitB',
        mask: true
      },
      shadow('outfitB', -0.12, SHADE_STRIP)
    ]
  },
  {
    id: 'legs-cuffed',
    slot: 'legs',
    layers: [
      { d: 'M 144.4 410 L 144 434', stroke: 'skin', lineWidth: 15 },
      { d: 'M 175.6 410 L 176 434', stroke: 'skin', shade: -0.08, lineWidth: 15 },
      { d: 'M 145 344 L 144.4 404', stroke: 'outfitB', lineWidth: 26 },
      { d: 'M 175 344 L 175.6 404', stroke: 'outfitB', shade: -0.12, lineWidth: 26 },
      { d: RR(130.4, 402, 27.2, 12, 4), fill: 'outfitB', shade: 0.2 },
      { d: RR(162.4, 402, 27.2, 12, 4), fill: 'outfitB', shade: 0.08 },
      { d: RR(119, 318, 82, 36, 14), fill: 'outfitB' }
    ]
  },
  {
    id: 'legs-tights',
    slot: 'legs',
    layers: [
      { d: 'M 145 356 L 144 434', stroke: 'accent', lineWidth: 19 },
      { d: 'M 175 356 L 176 434', stroke: 'accent', shade: -0.12, lineWidth: 19 },
      {
        d: 'M 124 320 L 196 320 L 208 370 Q 209 376 202 376 L 118 376 Q 111 376 112 370 Z',
        fill: 'outfitB',
        mask: true
      },
      shadow('outfitB', -0.12, SHADE_STRIP)
    ]
  },
  {
    id: 'legs-bell',
    slot: 'legs',
    layers: [
      {
        d: 'M 132 340 L 158 340 L 159 424 Q 159 432 151 432 L 128 432 Q 121 432 122 425 Z',
        fill: 'outfitB'
      },
      {
        d: 'M 162 340 L 188 340 L 198 425 Q 199 432 192 432 L 169 432 Q 161 432 161 424 Z',
        fill: 'outfitB',
        shade: -0.12
      },
      { d: RR(119, 318, 82, 36, 14), fill: 'outfitB' },
      { d: RR(119, 330, 82, 7, 2), fill: 'outfitB', shade: -0.22 }
    ]
  },

  // ── feet ────────────────────────────────────────────────────────────────────
  {
    id: 'feet-sneakers',
    slot: 'feet',
    layers: mirrored([
      {
        d: 'M 161 446 L 197 446 Q 205 446 205 439 Q 205 429 192 427 L 172 425 Q 161 424 161 434 Z',
        fill: 'accent'
      },
      { d: RR(161, 440, 44, 6, 3), fill: WHITE },
      { d: 'M 170 431 L 180 430', stroke: WHITE, lineWidth: 2.4, alpha: 0.85 }
    ])
  },
  {
    id: 'feet-boots',
    slot: 'feet',
    layers: mirrored([
      {
        d: 'M 161 446 L 198 446 Q 206 446 206 438 Q 206 430 194 428 L 189 402 Q 188 398 184 398 L 165 398 Q 161 398 161 402 Z',
        fill: 'accent',
        shade: -0.3
      },
      { d: RR(161, 441, 45, 5, 2.5), fill: 'accent', shade: -0.55 },
      { d: RR(160, 397, 31, 8, 3), fill: 'accent', shade: -0.14 }
    ])
  },
  {
    id: 'feet-sandals',
    slot: 'feet',
    layers: mirrored([
      { d: 'M 175.8 420 L 176 436', stroke: 'skin', lineWidth: 14 },
      {
        d: 'M 162 446 L 196 446 Q 202 446 202 440 Q 202 432 190 431 L 170 430 Q 162 430 162 438 Z',
        fill: 'skin',
        shade: -0.04
      },
      { d: RR(160, 441, 45, 5.5, 2.75), fill: 'accent', shade: -0.2 },
      { d: 'M 166 435 L 196 436', stroke: 'accent', lineWidth: 4.5 }
    ])
  },
  {
    id: 'feet-maryjanes',
    slot: 'feet',
    layers: mirrored([
      {
        d: 'M 161 446 L 196 446 Q 204 446 204 439 Q 204 430 192 428 L 172 427 Q 161 426 161 435 Z',
        fill: 'outfitB',
        shade: -0.35
      },
      { d: 'M 164 430 L 186 429', stroke: 'accent', lineWidth: 3.5 },
      { d: E(186, 429.5, 2.6), fill: GOLD }
    ])
  },
  {
    id: 'feet-rainboots',
    slot: 'feet',
    layers: mirrored([
      {
        d: 'M 161 446 L 198 446 Q 206 446 206 438 Q 206 430 193 428 L 191 396 Q 191 390 185 390 L 166 390 Q 160 390 160 396 Z',
        fill: 'accent'
      },
      { d: RR(166, 396, 4, 24, 2), fill: WHITE, alpha: 0.35 },
      { d: RR(161, 441, 45, 5, 2.5), fill: 'accent', shade: -0.35 }
    ])
  },

  // ── headwear ────────────────────────────────────────────────────────────────
  {
    id: 'hat-cap',
    slot: 'headwear',
    layers: [
      { d: 'M 95 124 C 95 80 124 66 160 66 C 196 66 225 80 225 124 Z', fill: 'accent', mask: true },
      shadow('accent', -0.13),
      { d: 'M 160 68 L 160 122', stroke: 'accent', shade: -0.14, lineWidth: 2.2, clip: true },
      {
        d: 'M 90 122 Q 160 108 230 122 Q 236 132 224 134 Q 160 122 96 134 Q 84 132 90 122 Z',
        fill: 'accent',
        shade: -0.2
      },
      { d: E(160, 66, 5.5, 4), fill: 'accent', shade: -0.22 }
    ]
  },
  {
    id: 'hat-beanie',
    slot: 'headwear',
    layers: [
      { d: 'M 95 118 C 95 70 124 58 160 58 C 196 58 225 70 225 118 Z', fill: 'accent', mask: true },
      shadow('accent', -0.13),
      { d: RR(90, 106, 140, 22, 10), fill: 'accent', shade: -0.12, mask: true },
      shadow('accent', -0.24),
      { d: E(160, 55, 14), fill: 'accent', shade: 0.55 }
    ]
  },
  {
    id: 'hat-crown',
    slot: 'headwear',
    layers: [
      {
        d: symPoly([
          [160, 58],
          [171, 82],
          [186, 62],
          [192, 88],
          [208, 72],
          [204, 106],
          [160, 106]
        ]),
        fill: GOLD,
        mask: true
      },
      { d: SHADE, fill: GOLD_SH, clip: true },
      { d: E(160, 96, 4.5), fill: 'accent' },
      { d: E(136, 97, 3.2) + ' ' + E(184, 97, 3.2), fill: 'accent', shade: 0.2 },
      { d: [E(160, 57, 3.4), E(112, 71, 3), E(208, 71, 3)].join(' '), fill: GOLD }
    ]
  },
  {
    id: 'hat-witch',
    slot: 'headwear',
    layers: [
      { d: E(160, 112, 94, 15), fill: 'outfitB', shade: -0.35 },
      {
        d: 'M 110 112 C 124 80 142 50 162 26 Q 178 8 204 20 Q 186 24 180 40 C 188 64 200 90 210 112 Q 160 122 110 112 Z',
        fill: 'outfitB',
        shade: -0.25,
        mask: true
      },
      { d: SHADE, fill: 'outfitB', shade: -0.4, clip: true },
      {
        d: poly([
          [90, 94],
          [230, 94],
          [230, 106],
          [90, 106]
        ]),
        fill: 'accent',
        clip: true
      },
      { d: RR(152, 93, 16, 14, 3), fill: GOLD }
    ]
  },
  {
    id: 'hat-top',
    slot: 'headwear',
    layers: [
      { d: RR(122, 34, 76, 78, 8), fill: 'outfitB', shade: -0.3, mask: true },
      { d: SHADE, fill: 'outfitB', shade: -0.45, clip: true },
      {
        d: poly([
          [110, 88],
          [210, 88],
          [210, 100],
          [110, 100]
        ]),
        fill: 'accent',
        clip: true
      },
      { d: RR(98, 104, 124, 12, 6), fill: 'outfitB', shade: -0.4 }
    ]
  },
  {
    id: 'hat-headband',
    slot: 'headwear',
    layers: [
      { d: 'M 98 134 C 104 96 216 96 222 134', stroke: 'accent', lineWidth: 11 },
      { d: 'M 214 110 Q 236 116 238 138', stroke: 'accent', shade: -0.14, lineWidth: 6 },
      { d: 'M 214 110 Q 232 104 244 118', stroke: 'accent', shade: -0.14, lineWidth: 6 },
      { d: E(214, 111, 6), fill: 'accent', shade: -0.08 }
    ]
  },
  {
    id: 'hat-party',
    slot: 'headwear',
    layers: [
      { d: 'M 136 96 L 174 18 L 202 92 Q 170 104 136 96 Z', fill: 'accent', mask: true },
      { d: SHADE, fill: 'accent', shade: -0.14, clip: true },
      {
        d: [E(158, 80, 4.5), E(176, 56, 4), E(184, 86, 4), E(168, 36, 3.2)].join(' '),
        fill: 'outfitA',
        clip: true
      },
      { d: 'M 136 96 Q 170 104 202 92', stroke: 'outfitA', lineWidth: 4 },
      { d: E(174, 17, 9), fill: 'outfitA', shade: 0.2 }
    ]
  },
  {
    id: 'hat-beret',
    slot: 'headwear',
    layers: [
      {
        d: 'M 92 108 C 86 80 116 68 156 68 C 202 68 234 80 230 102 C 228 112 200 116 160 114 C 120 114 94 116 92 108 Z',
        fill: 'accent',
        mask: true
      },
      {
        d: 'M 80 100 Q 160 118 240 94 L 240 130 L 80 130 Z',
        fill: 'accent',
        shade: -0.16,
        clip: true
      },
      { d: 'M 150 69 Q 150 60 157 57', stroke: 'accent', shade: -0.16, lineWidth: 4 }
    ]
  },
  {
    id: 'hat-bow',
    slot: 'headwear',
    layers: [
      { d: 'M 206 100 L 180 84 Q 170 100 180 116 Z', fill: 'accent' },
      { d: 'M 206 100 L 232 84 Q 242 100 232 116 Z', fill: 'accent', shade: -0.14 },
      { d: E(206, 100, 7, 8), fill: 'accent', shade: 0.12 }
    ]
  },

  // ── accessory ───────────────────────────────────────────────────────────────
  {
    id: 'acc-glasses',
    slot: 'accessory',
    layers: [
      ...mirrored([
        { d: E(EYE_R, EYE_Y, 13), fill: WHITE, alpha: 0.18 },
        { d: E(EYE_R, EYE_Y, 13), stroke: 'ink', lineWidth: 3 },
        { d: `M ${EYE_R + 13} ${EYE_Y - 2} L 216 ${EYE_Y - 6}`, stroke: 'ink', lineWidth: 3 }
      ]),
      { d: `M 151 ${EYE_Y - 2} Q 160 ${EYE_Y - 7} 169 ${EYE_Y - 2}`, stroke: 'ink', lineWidth: 3 }
    ]
  },
  {
    id: 'acc-shades',
    slot: 'accessory',
    layers: [
      ...mirrored([
        { d: RR(167, 148, 29, 19, 8), fill: 'ink', mask: true },
        {
          d: poly([
            [170, 170],
            [182, 144],
            [188, 144],
            [176, 170]
          ]),
          fill: WHITE,
          alpha: 0.22,
          clip: true
        },
        { d: `M 195 153 L 216 150`, stroke: 'ink', lineWidth: 3 }
      ]),
      { d: 'M 152 153 Q 160 149 168 153', stroke: 'ink', lineWidth: 3.4 }
    ]
  },
  {
    id: 'acc-earrings',
    slot: 'accessory',
    layers: mirrored([
      { d: E(218, 177, 5), stroke: GOLD, lineWidth: 2.4 },
      { d: E(218, 182.5, 2.6), fill: 'accent' }
    ])
  },
  {
    id: 'acc-necklace',
    slot: 'accessory',
    layers: [
      { d: 'M 142 228 Q 160 252 178 228', stroke: GOLD, lineWidth: 2 },
      { d: E(160, 242, 4.5), fill: 'accent' },
      { d: E(158.6, 240.6, 1.4), fill: WHITE, alpha: 0.6 }
    ]
  },
  {
    id: 'acc-monocle',
    slot: 'accessory',
    layers: [
      { d: E(EYE_R, EYE_Y, 12.5), fill: WHITE, alpha: 0.2 },
      { d: E(EYE_R, EYE_Y, 12.5), stroke: GOLD, lineWidth: 2.8 },
      { d: `M ${EYE_R + 9} ${EYE_Y + 9} Q 204 196 196 228`, stroke: GOLD, lineWidth: 1.4 }
    ]
  },
  {
    id: 'acc-bowtie',
    slot: 'accessory',
    layers: [
      { d: 'M 160 230 L 143 220 Q 139 230 143 240 Z', fill: 'accent' },
      { d: 'M 160 230 L 177 220 Q 181 230 177 240 Z', fill: 'accent', shade: -0.14 },
      { d: RR(155, 224.5, 10, 11, 3.5), fill: 'accent', shade: -0.24 }
    ]
  },
  {
    id: 'acc-headphones',
    slot: 'accessory',
    layers: [
      { d: 'M 98 152 C 94 56 226 56 222 152', stroke: 'outfitB', shade: -0.2, lineWidth: 7 },
      ...mirrored([
        { d: RR(210, 138, 20, 34, 9), fill: 'accent', mask: true },
        { d: RR(221, 130, 20, 50, 0), fill: 'accent', shade: -0.16, clip: true }
      ])
    ]
  },
  {
    id: 'acc-scarf',
    slot: 'accessory',
    layers: [
      {
        d: 'M 178 226 L 188 272 Q 190 280 182 281 L 176 282 Q 168 282 168 274 L 164 232 Z',
        fill: 'accent',
        shade: -0.14
      },
      { d: RR(128, 212, 64, 22, 11), fill: 'accent', mask: true },
      shadow('accent', -0.14, SHADE_STRIP)
    ]
  }
]

const parts = lowerHead(rawParts)

const lowerSlots = (ss: StyleSlot[]): StyleSlot[] =>
  ss.map((sl) =>
    HEAD_SLOTS.includes(sl.id)
      ? {
          ...sl,
          socket: { x: sl.socket.x, y: sl.socket.y + HEAD_DY },
          thumb: { ...sl.thumb, cy: sl.thumb.cy + HEAD_DY }
        }
      : sl
  )

/** A soft leaf-shaped wing on the viewer's right (mirrored for the left). */
function smoothWing(): string {
  return 'M 182 262 C 196 226 232 196 272 188 C 290 186 294 204 286 222 C 274 252 244 276 206 290 C 190 296 176 284 182 262 Z'
}

/** Five-point star. */
function star(cx: number, cy: number, r: number): string {
  const pts: Pt[] = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.45 : r
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)])
  }
  return poly(pts)
}

export const simplePack: StylePack = {
  id: 'simple',
  name: 'Simplistic',
  icon: '◐',
  width: 320,
  height: 460,
  ink: INK,
  slots: lowerSlots([
    {
      id: 'back',
      icon: '🎒',
      socket: { x: 160, y: 236 },
      z: 31,
      backZ: 2,
      optional: true,
      thumb: { cx: 175, cy: 250, span: 300 }
    },
    {
      id: 'head',
      icon: '🙂',
      socket: { x: 160, y: 150 },
      z: 40,
      thumb: { cx: 160, cy: 160, span: 170 }
    },
    {
      id: 'hair',
      icon: '💇',
      socket: { x: 160, y: 100 },
      z: 60,
      backZ: 4,
      thumb: { cx: 160, cy: 150, span: 210 }
    },
    {
      id: 'eyes',
      icon: '👁',
      socket: { x: 160, y: EYE_Y },
      z: 50,
      thumb: { cx: 160, cy: 156, span: 90 }
    },
    {
      id: 'brows',
      icon: '🤨',
      socket: { x: 160, y: 138 },
      z: 52,
      thumb: { cx: 160, cy: 145, span: 90 }
    },
    {
      id: 'nose',
      icon: '👃',
      socket: { x: 160, y: 170 },
      z: 45,
      optional: true,
      thumb: { cx: 160, cy: 170, span: 70 }
    },
    {
      id: 'mouth',
      icon: '👄',
      socket: { x: 160, y: 186 },
      z: 51,
      thumb: { cx: 160, cy: 186, span: 70 }
    },
    {
      id: 'facialHair',
      icon: '🧔',
      socket: { x: 160, y: 192 },
      z: 53,
      optional: true,
      thumb: { cx: 160, cy: 196, span: 150 }
    },
    {
      id: 'marks',
      icon: '✨',
      socket: { x: 160, y: 168 },
      z: 42,
      optional: true,
      thumb: { cx: 160, cy: 164, span: 130 }
    },
    {
      id: 'torso',
      icon: '👕',
      socket: { x: 160, y: 270 },
      z: 30,
      thumb: { cx: 160, cy: 290, span: 210 }
    },
    {
      id: 'legs',
      icon: '👖',
      socket: { x: 160, y: 360 },
      z: 20,
      thumb: { cx: 160, cy: 384, span: 150 }
    },
    {
      id: 'feet',
      icon: '👟',
      socket: { x: 160, y: 440 },
      z: 22,
      thumb: { cx: 160, cy: 428, span: 110 }
    },
    {
      id: 'headwear',
      icon: '🎩',
      socket: { x: 160, y: 96 },
      z: 70,
      optional: true,
      thumb: { cx: 160, cy: 90, span: 200 }
    },
    {
      id: 'accessory',
      icon: '👓',
      socket: { x: 160, y: EYE_Y },
      z: 65,
      optional: true,
      thumb: { cx: 160, cy: 180, span: 170 }
    }
  ]),
  parts,
  paletteChannels: ['skin', 'hair', 'eyes', 'outfitA', 'outfitB', 'accent'],
  palettePresets: [
    {
      skin: '#f1c7a5',
      hair: '#3b2a28',
      eyes: '#2b2d42',
      outfitA: '#f26b5b',
      outfitB: '#274060',
      accent: '#f4c95d'
    },
    {
      skin: '#8d5b3e',
      hair: '#1f1a24',
      eyes: '#231a1a',
      outfitA: '#2a9d8f',
      outfitB: '#264653',
      accent: '#f4a261'
    },
    {
      skin: '#fde3d0',
      hair: '#d9a441',
      eyes: '#34506e',
      outfitA: '#8ab17d',
      outfitB: '#3d405b',
      accent: '#e07a5f'
    },
    {
      skin: '#5a3726',
      hair: '#121014',
      eyes: '#1b1414',
      outfitA: '#f4c95d',
      outfitB: '#3d348b',
      accent: '#ef6f6c'
    },
    {
      skin: '#dca27c',
      hair: '#b44a2c',
      eyes: '#3f5a33',
      outfitA: '#3d5a80',
      outfitB: '#293241',
      accent: '#ee6c4d'
    },
    {
      skin: '#c68560',
      hair: '#2d2020',
      eyes: '#2e2019',
      outfitA: '#e5989b',
      outfitB: '#6d597a',
      accent: '#84a59d'
    },
    {
      skin: '#efc9a8',
      hair: '#d8d4cf',
      eyes: '#4a5a6a',
      outfitA: '#6d9dc5',
      outfitB: '#2f3e46',
      accent: '#f7b267'
    },
    {
      skin: '#a86b4a',
      hair: '#4a2f24',
      eyes: '#2a1d17',
      outfitA: '#e76f51',
      outfitB: '#2a4d4a',
      accent: '#e9c46a'
    },
    {
      skin: '#b8e0d2',
      hair: '#5e4b8b',
      eyes: '#26213b',
      outfitA: '#ff8fab',
      outfitB: '#3a3659',
      accent: '#ffd166'
    },
    {
      skin: '#cdb4f0',
      hair: '#ff7b9c',
      eyes: '#2e2449',
      outfitA: '#2ec4b6',
      outfitB: '#22223b',
      accent: '#ffd166'
    }
  ],
  swatches: {
    skin: [
      '#fde3d0',
      '#f6d2b5',
      '#f1c7a5',
      '#efc9a8',
      '#dca27c',
      '#c68560',
      '#a86b4a',
      '#8d5b3e',
      '#6e4430',
      '#5a3726',
      '#b8e0d2',
      '#cdb4f0'
    ],
    hair: [
      '#121014',
      '#2d2020',
      '#3b2a28',
      '#6b4a2f',
      '#a0703f',
      '#d9a441',
      '#f1d38a',
      '#b44a2c',
      '#d8d4cf',
      '#ff7b9c',
      '#5e4b8b',
      '#2ec4b6',
      '#3d5a80'
    ],
    eyes: [
      '#2b2d42',
      '#1b1414',
      '#3a2a1e',
      '#34506e',
      '#3f5a33',
      '#4a5a6a',
      '#5e3a6e',
      '#2a9d8f',
      '#8a3a3a'
    ],
    outfitA: [
      '#f26b5b',
      '#e76f51',
      '#f4a261',
      '#f4c95d',
      '#8ab17d',
      '#2a9d8f',
      '#6d9dc5',
      '#3d5a80',
      '#e5989b',
      '#b8a1e3',
      '#f5f1e8',
      '#2b2d42'
    ],
    outfitB: [
      '#274060',
      '#264653',
      '#3d405b',
      '#293241',
      '#3d348b',
      '#6d597a',
      '#2a4d4a',
      '#5c4b3f',
      '#8d99ae',
      '#22223b'
    ],
    accent: [
      '#f4c95d',
      '#ffd166',
      '#f4a261',
      '#ef6f6c',
      '#e07a5f',
      '#ff8fab',
      '#84a59d',
      '#2ec4b6',
      '#6d9dc5',
      '#b8a1e3',
      '#f5f1e8'
    ]
  },
  defaults: {
    back: null,
    head: 'head-round',
    hair: 'hair-short',
    eyes: 'eyes-round',
    brows: 'brows-straight',
    nose: 'nose-button',
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
    neck: { x: 160, y: 226 + HEAD_DY },
    hips: { x: 160, y: 334 },
    ground: { x: 160, y: 446 },
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
  portrait: { cx: 160, cy: 168 + HEAD_DY, span: 200 },
  face: { cx: 160, cy: 152 + HEAD_DY, span: 150 },
  fx: {
    blush: lower(mirrored([{ d: E(190, 174, 9, 5.2), fill: '#ff7f7f', alpha: 0.42 }])),
    tears: lower(
      mirrored([
        { d: 'M 190 166 Q 188 178 190 188', stroke: '#8fd4ff', lineWidth: 3.4, alpha: 0.75 },
        { d: 'M 190 186 Q 195 194 190 198 Q 185 194 190 186 Z', fill: '#7ecbff', alpha: 0.9 }
      ])
    ),
    aging: lower([
      {
        d: 'M 142 118 Q 160 114 178 118 M 147 125 Q 160 121.5 173 125',
        stroke: 'skin',
        shade: -0.28,
        lineWidth: 2,
        alpha: 0.55
      },
      ...mirrored([
        {
          d: 'M 196 153 L 202 150 M 197 159 L 203 160.5',
          stroke: 'skin',
          shade: -0.3,
          lineWidth: 1.8,
          alpha: 0.7
        },
        {
          d: 'M 175 168 Q 182 171 189 168',
          stroke: 'skin',
          shade: -0.25,
          lineWidth: 1.6,
          alpha: 0.6
        },
        {
          d: 'M 173 177 Q 178 184 175 191',
          stroke: 'skin',
          shade: -0.25,
          lineWidth: 1.8,
          alpha: 0.45
        }
      ])
    ])
  },
  greyHair: '#d9d7d2'
}
