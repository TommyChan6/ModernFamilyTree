// The "Cartoon" style pack — the MVP part library. A friendly big-headed
// vector look: every part is hand-authored SVG path data in a 320×480
// character space, painted through palette channels with a shared ink outline.
// Outlined limbs use the two-stroke trick: a fat ink stroke under a slightly
// thinner colored one reads as an outlined capsule without any path math.

import type { StyleLayer, StylePack, StylePart } from '../styleTypes'

// ── Path helpers (build path strings, keep the part data readable) ───────────
const E = (cx: number, cy: number, rx: number, ry: number): string =>
  `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0 Z`

const RR = (x: number, y: number, w: number, h: number, r: number): string =>
  `M ${x + r} ${y} h ${w - 2 * r} a ${r} ${r} 0 0 1 ${r} ${r} v ${h - 2 * r} ` +
  `a ${r} ${r} 0 0 1 ${-r} ${r} h ${-(w - 2 * r)} a ${r} ${r} 0 0 1 ${-r} ${-r} ` +
  `v ${-(h - 2 * r)} a ${r} ${r} 0 0 1 ${r} ${-r} Z`

const INK = '#332c40'

// Two-stroke outlined capsule: ink underlay + colored overlay along one path.
const capsule = (d: string, paint: string, width: number, shade = 0): StyleLayer[] => [
  { d, stroke: 'ink', lineWidth: width + 7 },
  { d, stroke: paint, lineWidth: width, shade }
]

// Eye pair helper — most eye variants repeat the same shapes at both centers.
const eachEye = (make: (cx: number) => StyleLayer[]): StyleLayer[] => [...make(132), ...make(188)]

// ── Parts ─────────────────────────────────────────────────────────────────────
const parts: StylePart[] = [
  // ── head (face + ears + neck) ──────────────────────────────────────────────
  {
    id: 'head-round',
    slot: 'head',
    layers: [
      { d: RR(146, 192, 28, 38, 11), fill: 'skin', shade: -0.1, stroke: 'ink', lineWidth: 3.5 },
      { d: E(86, 152, 14, 16), fill: 'skin', shade: -0.04, stroke: 'ink', lineWidth: 3.5 },
      { d: E(234, 152, 14, 16), fill: 'skin', shade: -0.04, stroke: 'ink', lineWidth: 3.5 },
      { d: E(160, 142, 72, 70), fill: 'skin', stroke: 'ink', lineWidth: 4 }
    ]
  },
  {
    id: 'head-slim',
    slot: 'head',
    layers: [
      { d: RR(146, 192, 28, 38, 11), fill: 'skin', shade: -0.1, stroke: 'ink', lineWidth: 3.5 },
      { d: E(96, 152, 13, 15), fill: 'skin', shade: -0.04, stroke: 'ink', lineWidth: 3.5 },
      { d: E(224, 152, 13, 15), fill: 'skin', shade: -0.04, stroke: 'ink', lineWidth: 3.5 },
      { d: E(160, 144, 62, 74), fill: 'skin', stroke: 'ink', lineWidth: 4 }
    ]
  },
  {
    id: 'head-soft',
    slot: 'head',
    layers: [
      { d: RR(146, 192, 28, 38, 11), fill: 'skin', shade: -0.1, stroke: 'ink', lineWidth: 3.5 },
      { d: E(90, 152, 14, 16), fill: 'skin', shade: -0.04, stroke: 'ink', lineWidth: 3.5 },
      { d: E(230, 152, 14, 16), fill: 'skin', shade: -0.04, stroke: 'ink', lineWidth: 3.5 },
      { d: RR(94, 74, 132, 138, 54), fill: 'skin', stroke: 'ink', lineWidth: 4 }
    ]
  },

  // ── hair ───────────────────────────────────────────────────────────────────
  {
    id: 'hair-short',
    slot: 'hair',
    layers: [
      {
        d:
          'M 88 138 Q 84 56 160 52 Q 236 56 232 138 Q 232 106 208 96 Q 214 78 188 88 ' +
          'Q 166 72 142 88 Q 118 78 122 98 Q 92 104 88 138 Z',
        fill: 'hair',
        stroke: 'ink',
        lineWidth: 4
      }
    ]
  },
  {
    id: 'hair-spiky',
    slot: 'hair',
    layers: [
      {
        d:
          'M 88 136 Q 86 96 102 74 L 114 96 L 126 60 L 140 88 L 154 50 L 168 84 ' +
          'L 186 54 L 194 88 L 214 66 L 218 96 Q 234 102 232 136 Q 208 110 160 106 ' +
          'Q 112 110 88 136 Z',
        fill: 'hair',
        stroke: 'ink',
        lineWidth: 4
      }
    ]
  },
  {
    id: 'hair-bob',
    slot: 'hair',
    back: [
      { d: RR(82, 84, 156, 126, 62), fill: 'hair', shade: -0.14, stroke: 'ink', lineWidth: 4 }
    ],
    layers: [
      {
        d:
          'M 86 140 Q 82 54 160 50 Q 238 54 234 140 L 222 140 Q 228 94 198 90 ' +
          'Q 168 82 146 92 Q 116 86 118 106 Q 98 108 98 140 Z',
        fill: 'hair',
        stroke: 'ink',
        lineWidth: 4
      }
    ]
  },
  {
    id: 'hair-long',
    slot: 'hair',
    back: [
      {
        d:
          'M 84 120 Q 82 52 160 48 Q 238 52 236 120 L 242 296 Q 244 330 214 332 ' +
          'Q 226 300 216 268 Q 220 320 160 324 Q 100 320 104 268 Q 94 300 106 332 ' +
          'Q 76 330 78 296 Z',
        fill: 'hair',
        shade: -0.14,
        stroke: 'ink',
        lineWidth: 4
      }
    ],
    layers: [
      {
        d:
          'M 86 140 Q 82 54 160 50 Q 238 54 234 140 L 222 140 Q 228 94 198 90 ' +
          'Q 168 82 146 92 Q 116 86 118 106 Q 98 108 98 140 Z',
        fill: 'hair',
        stroke: 'ink',
        lineWidth: 4
      }
    ]
  },
  {
    id: 'hair-buns',
    slot: 'hair',
    back: [
      { d: E(102, 72, 26, 26), fill: 'hair', shade: -0.1, stroke: 'ink', lineWidth: 4 },
      { d: E(218, 72, 26, 26), fill: 'hair', shade: -0.1, stroke: 'ink', lineWidth: 4 }
    ],
    layers: [
      {
        d: 'M 88 138 Q 84 56 160 52 Q 236 56 232 138 Q 218 100 160 98 Q 102 100 88 138 Z',
        fill: 'hair',
        stroke: 'ink',
        lineWidth: 4
      }
    ]
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
      }
    ]
  },

  // ── eyes ───────────────────────────────────────────────────────────────────
  {
    id: 'eyes-round',
    slot: 'eyes',
    layers: eachEye((cx) => [
      { d: E(cx, 152, 13, 15), fill: '#ffffff', stroke: 'ink', lineWidth: 3 },
      { d: E(cx, 154, 7.5, 8.5), fill: 'eyes' },
      { d: E(cx, 155, 3.5, 4), fill: 'ink' },
      { d: E(cx + 3, 148, 2.6, 2.6), fill: '#ffffff' }
    ])
  },
  {
    id: 'eyes-spark',
    slot: 'eyes',
    layers: eachEye((cx) => [
      { d: E(cx, 152, 14, 17), fill: '#ffffff', stroke: 'ink', lineWidth: 3 },
      { d: E(cx, 154, 9.5, 12), fill: 'eyes' },
      { d: E(cx, 156, 4.5, 6), fill: 'ink' },
      { d: E(cx + 4.5, 147, 3.2, 3.2), fill: '#ffffff' },
      { d: E(cx - 4, 160, 2, 2), fill: '#ffffff' }
    ])
  },
  {
    id: 'eyes-happy',
    slot: 'eyes',
    layers: eachEye((cx) => [
      { d: `M ${cx - 13} 156 Q ${cx} 140 ${cx + 13} 156`, stroke: 'ink', lineWidth: 5 }
    ])
  },
  {
    id: 'eyes-sleepy',
    slot: 'eyes',
    layers: eachEye((cx) => [
      { d: E(cx, 154, 12, 9), fill: '#ffffff', stroke: 'ink', lineWidth: 3 },
      { d: E(cx, 156, 6.5, 6), fill: 'eyes' },
      { d: E(cx, 157, 3, 3), fill: 'ink' },
      { d: `M ${cx - 12} 149 Q ${cx} 143 ${cx + 12} 149`, stroke: 'ink', lineWidth: 4 }
    ])
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
      { d: 'M 116 125 Q 134 130 148 136', stroke: 'hair', shade: -0.3, lineWidth: 6 },
      { d: 'M 204 125 Q 186 130 172 136', stroke: 'hair', shade: -0.3, lineWidth: 6 }
    ]
  },

  // ── mouth ──────────────────────────────────────────────────────────────────
  {
    id: 'mouth-smile',
    slot: 'mouth',
    layers: [{ d: 'M 136 180 Q 160 202 184 180', stroke: 'ink', lineWidth: 5 }]
  },
  {
    id: 'mouth-grin',
    slot: 'mouth',
    layers: [
      { d: 'M 134 178 Q 160 214 186 178 Z', fill: '#7d3f4c', stroke: 'ink', lineWidth: 4 },
      { d: E(160, 193, 13, 7), fill: '#c96b78' }
    ]
  },
  {
    id: 'mouth-neutral',
    slot: 'mouth',
    layers: [{ d: 'M 143 186 L 177 186', stroke: 'ink', lineWidth: 5 }]
  },
  {
    id: 'mouth-o',
    slot: 'mouth',
    layers: [{ d: E(160, 188, 9, 11), fill: '#7d3f4c', stroke: 'ink', lineWidth: 4 }]
  },

  // ── torso (top + arms + hands) ─────────────────────────────────────────────
  {
    id: 'torso-tee',
    slot: 'torso',
    layers: [
      ...capsule('M 106 246 Q 94 262 90 308', 'skin', 15),
      ...capsule('M 214 246 Q 226 262 230 308', 'skin', 15),
      {
        d: 'M 116 232 Q 118 222 130 222 L 190 222 Q 202 222 204 232 L 200 346 L 120 346 Z',
        fill: 'outfitA',
        stroke: 'ink',
        lineWidth: 4
      },
      {
        d: 'M 104 226 Q 90 236 94 264 L 124 258 L 122 224 Z',
        fill: 'outfitA',
        stroke: 'ink',
        lineWidth: 4
      },
      {
        d: 'M 216 226 Q 230 236 226 264 L 196 258 L 198 224 Z',
        fill: 'outfitA',
        stroke: 'ink',
        lineWidth: 4
      },
      { d: 'M 140 224 Q 160 238 180 224', stroke: 'outfitA', shade: -0.22, lineWidth: 5 },
      { d: E(88, 316, 10.5, 10.5), fill: 'skin', stroke: 'ink', lineWidth: 3.5 },
      { d: E(232, 316, 10.5, 10.5), fill: 'skin', stroke: 'ink', lineWidth: 3.5 }
    ]
  },
  {
    id: 'torso-hoodie',
    slot: 'torso',
    layers: [
      ...capsule('M 108 244 Q 92 262 88 310', 'outfitA', 20),
      ...capsule('M 212 244 Q 228 262 232 310', 'outfitA', 20),
      {
        d: 'M 112 234 Q 114 222 128 222 L 192 222 Q 206 222 208 234 L 204 348 L 116 348 Z',
        fill: 'outfitA',
        stroke: 'ink',
        lineWidth: 4
      },
      {
        d: 'M 136 296 L 184 296 L 176 334 L 144 334 Z',
        fill: 'outfitA',
        shade: -0.14,
        stroke: 'ink',
        lineWidth: 3
      },
      {
        d: 'M 122 230 Q 160 262 198 230 Q 160 246 122 230 Z',
        fill: 'outfitA',
        shade: -0.2,
        stroke: 'ink',
        lineWidth: 3
      },
      { d: 'M 150 246 L 148 266', stroke: 'ink', lineWidth: 3 },
      { d: 'M 170 246 L 172 266', stroke: 'ink', lineWidth: 3 },
      { d: E(86, 318, 10.5, 10.5), fill: 'skin', stroke: 'ink', lineWidth: 3.5 },
      { d: E(234, 318, 10.5, 10.5), fill: 'skin', stroke: 'ink', lineWidth: 3.5 }
    ]
  },
  {
    id: 'torso-dress',
    slot: 'torso',
    layers: [
      ...capsule('M 108 244 Q 96 262 92 306', 'skin', 14),
      ...capsule('M 212 244 Q 224 262 228 306', 'skin', 14),
      {
        d:
          'M 118 232 Q 120 222 132 222 L 188 222 Q 200 222 202 232 L 222 372 ' +
          'Q 160 386 98 372 Z',
        fill: 'outfitA',
        stroke: 'ink',
        lineWidth: 4
      },
      { d: 'M 112 288 Q 160 298 208 288', stroke: 'accent', lineWidth: 6 },
      {
        d: 'M 106 226 Q 94 234 98 258 L 124 252 L 122 224 Z',
        fill: 'outfitA',
        stroke: 'ink',
        lineWidth: 4
      },
      {
        d: 'M 214 226 Q 226 234 222 258 L 196 252 L 198 224 Z',
        fill: 'outfitA',
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
      ...capsule('M 108 244 Q 94 262 90 308', 'outfitA', 19, -0.06),
      ...capsule('M 212 244 Q 226 262 230 308', 'outfitA', 19, -0.06),
      {
        d: 'M 114 234 Q 116 222 130 222 L 190 222 Q 204 222 206 234 L 202 348 L 118 348 Z',
        fill: 'outfitA',
        stroke: 'ink',
        lineWidth: 4
      },
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
        shade: -0.16,
        stroke: 'ink',
        lineWidth: 3
      },
      { d: E(88, 316, 10.5, 10.5), fill: 'skin', stroke: 'ink', lineWidth: 3.5 },
      { d: E(232, 316, 10.5, 10.5), fill: 'skin', stroke: 'ink', lineWidth: 3.5 }
    ]
  },

  // ── legs ───────────────────────────────────────────────────────────────────
  {
    id: 'legs-pants',
    slot: 'legs',
    layers: [
      ...capsule('M 141 352 L 138 436', 'outfitB', 21),
      ...capsule('M 179 352 L 182 436', 'outfitB', 21),
      { d: RR(119, 336, 82, 28, 11), fill: 'outfitB', stroke: 'ink', lineWidth: 4 }
    ]
  },
  {
    id: 'legs-shorts',
    slot: 'legs',
    layers: [
      ...capsule('M 139 388 L 138 436', 'skin', 16),
      ...capsule('M 181 388 L 182 436', 'skin', 16),
      ...capsule('M 141 352 L 139 390', 'outfitB', 22),
      ...capsule('M 179 352 L 181 390', 'outfitB', 22),
      { d: RR(119, 336, 82, 28, 11), fill: 'outfitB', stroke: 'ink', lineWidth: 4 }
    ]
  },
  {
    id: 'legs-skirt',
    slot: 'legs',
    layers: [
      ...capsule('M 140 394 L 138 436', 'skin', 16),
      ...capsule('M 180 394 L 182 436', 'skin', 16),
      {
        d: 'M 124 338 L 196 338 L 214 396 Q 160 408 106 396 Z',
        fill: 'outfitB',
        stroke: 'ink',
        lineWidth: 4
      }
    ]
  },

  // ── feet ───────────────────────────────────────────────────────────────────
  {
    id: 'feet-sneakers',
    slot: 'feet',
    layers: [
      { d: RR(112, 436, 47, 24, 11), fill: 'accent', stroke: 'ink', lineWidth: 4 },
      { d: RR(161, 436, 47, 24, 11), fill: 'accent', stroke: 'ink', lineWidth: 4 },
      { d: 'M 114 452 L 157 452', stroke: '#ffffff', lineWidth: 4 },
      { d: 'M 163 452 L 206 452', stroke: '#ffffff', lineWidth: 4 }
    ]
  },
  {
    id: 'feet-boots',
    slot: 'feet',
    layers: [
      { d: RR(113, 422, 46, 38, 9), fill: 'accent', shade: -0.18, stroke: 'ink', lineWidth: 4 },
      { d: RR(161, 422, 46, 38, 9), fill: 'accent', shade: -0.18, stroke: 'ink', lineWidth: 4 },
      { d: 'M 115 432 L 157 432', stroke: 'accent', shade: 0.12, lineWidth: 5 },
      { d: 'M 163 432 L 205 432', stroke: 'accent', shade: 0.12, lineWidth: 5 }
    ]
  },

  // ── headwear (optional) ────────────────────────────────────────────────────
  {
    id: 'hat-cap',
    slot: 'headwear',
    layers: [
      {
        d: 'M 96 108 Q 100 50 160 48 Q 220 50 224 108 Q 160 92 96 108 Z',
        fill: 'accent',
        stroke: 'ink',
        lineWidth: 4
      },
      { d: E(160, 106, 76, 14), fill: 'accent', shade: -0.14, stroke: 'ink', lineWidth: 3.5 },
      { d: E(160, 50, 6, 6), fill: 'accent', shade: -0.2, stroke: 'ink', lineWidth: 3 }
    ]
  },
  {
    id: 'hat-beanie',
    slot: 'headwear',
    layers: [
      {
        d: 'M 92 120 Q 94 52 160 48 Q 226 52 228 120 Z',
        fill: 'accent',
        stroke: 'ink',
        lineWidth: 4
      },
      { d: RR(88, 108, 144, 20, 10), fill: 'accent', shade: -0.16, stroke: 'ink', lineWidth: 3.5 },
      { d: E(160, 44, 12, 12), fill: '#f2efe8', stroke: 'ink', lineWidth: 3.5 }
    ]
  },

  // ── accessory (optional) ───────────────────────────────────────────────────
  {
    id: 'acc-glasses',
    slot: 'accessory',
    layers: [
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
      { d: E(132, 152, 17, 15), fill: 'ink', stroke: 'ink', lineWidth: 4 },
      { d: E(188, 152, 17, 15), fill: 'ink', stroke: 'ink', lineWidth: 4 },
      { d: 'M 149 148 Q 160 142 171 148', stroke: 'ink', lineWidth: 5 },
      { d: E(126, 147, 4, 3), fill: '#8f87a3' },
      { d: E(182, 147, 4, 3), fill: '#8f87a3' }
    ]
  }
]

export const cartoonPack: StylePack = {
  id: 'cartoon',
  name: 'Cartoon',
  width: 320,
  height: 480,
  ink: INK,
  slots: [
    // z decides paint order (low = behind). backZ bands sit behind the body.
    {
      id: 'head',
      icon: '🙂',
      socket: { x: 160, y: 150 },
      z: 40,
      thumb: { cx: 160, cy: 140, span: 220 }
    },
    {
      id: 'hair',
      icon: '💇',
      socket: { x: 160, y: 108 },
      z: 60,
      backZ: 4,
      thumb: { cx: 160, cy: 120, span: 240 }
    },
    {
      id: 'eyes',
      icon: '👁',
      socket: { x: 160, y: 152 },
      z: 50,
      thumb: { cx: 160, cy: 152, span: 130 }
    },
    {
      id: 'brows',
      icon: '🤨',
      socket: { x: 160, y: 130 },
      z: 52,
      thumb: { cx: 160, cy: 138, span: 130 }
    },
    {
      id: 'mouth',
      icon: '👄',
      socket: { x: 160, y: 188 },
      z: 51,
      thumb: { cx: 160, cy: 186, span: 110 }
    },
    {
      id: 'torso',
      icon: '👕',
      socket: { x: 160, y: 238 },
      z: 30,
      thumb: { cx: 160, cy: 288, span: 250 }
    },
    {
      id: 'legs',
      icon: '👖',
      socket: { x: 160, y: 352 },
      z: 20,
      thumb: { cx: 160, cy: 390, span: 220 }
    },
    {
      id: 'feet',
      icon: '👟',
      socket: { x: 160, y: 446 },
      z: 22,
      thumb: { cx: 160, cy: 444, span: 170 }
    },
    {
      id: 'headwear',
      icon: '🎩',
      socket: { x: 160, y: 86 },
      z: 70,
      optional: true,
      thumb: { cx: 160, cy: 90, span: 210 }
    },
    {
      id: 'accessory',
      icon: '👓',
      socket: { x: 160, y: 152 },
      z: 55,
      optional: true,
      thumb: { cx: 160, cy: 150, span: 170 }
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
    }
  ],
  defaults: {
    head: 'head-round',
    hair: 'hair-short',
    eyes: 'eyes-round',
    brows: 'brows-straight',
    mouth: 'mouth-smile',
    torso: 'torso-tee',
    legs: 'legs-pants',
    feet: 'feet-sneakers',
    headwear: null,
    accessory: null
  },
  rig: {
    neck: { x: 160, y: 210 },
    hips: { x: 160, y: 344 },
    ground: { x: 160, y: 460 },
    headSlots: ['head', 'hair', 'eyes', 'brows', 'mouth', 'headwear', 'accessory'],
    buildSlots: ['torso', 'legs', 'feet'],
    legSlots: ['legs', 'feet']
  }
}

/** All packs, keyed by id — future styles (ink wash, renaissance…) join here. */
export const stylePacks: Record<string, StylePack> = { [cartoonPack.id]: cartoonPack }
