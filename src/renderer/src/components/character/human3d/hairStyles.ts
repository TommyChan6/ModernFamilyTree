// The hairstyle library: each style turns a root sample into one strand path
// (decimetres, rig space). Falling styles are shaped by CUT LINES (a bob is
// "everything cut at the chin"), short styles by length + comb direction,
// gathered styles (ponytails, buns, braids, twin tails) by a two-phase path:
// combed along the scalp to a gather point, then a tail. Brows, lashes and
// beards live here too. Pure math (hairGroom helpers); no THREE.

import {
  add,
  collide,
  cross,
  curlStrand,
  dot,
  grow,
  norm,
  resample,
  tangential,
  type Collision,
  type RootSample,
  type V3
} from './hairGroom'

export interface StyleInfo {
  id: string
  label: string
  /** Strand budget at density 1 / quality high. */
  count: number
  /** Ribbon width (dm) at the root. */
  width: number
  points: number
}

export const HAIR_STYLES: StyleInfo[] = [
  { id: 'bald', label: 'Bald', count: 0, width: 0, points: 2 },
  { id: 'buzz', label: 'Buzz cut', count: 26000, width: 0.0028, points: 3 },
  { id: 'crew', label: 'Crew cut', count: 26000, width: 0.0034, points: 6 },
  { id: 'side-part', label: 'Side part', count: 24000, width: 0.0034, points: 12 },
  { id: 'slick-back', label: 'Slicked back', count: 22000, width: 0.0032, points: 12 },
  { id: 'pompadour', label: 'Pompadour', count: 24000, width: 0.0034, points: 14 },
  { id: 'undercut', label: 'Undercut', count: 18000, width: 0.0034, points: 14 },
  { id: 'messy', label: 'Messy', count: 24000, width: 0.0036, points: 10 },
  { id: 'curly-short', label: 'Short curls', count: 22000, width: 0.004, points: 16 },
  { id: 'mohawk', label: 'Mohawk', count: 9000, width: 0.0038, points: 10 },
  { id: 'pixie', label: 'Pixie', count: 22000, width: 0.0032, points: 12 },
  { id: 'bob', label: 'Bob', count: 22000, width: 0.0032, points: 18 },
  { id: 'shoulder', label: 'Shoulder length', count: 22000, width: 0.003, points: 22 },
  { id: 'long', label: 'Long straight', count: 22000, width: 0.003, points: 28 },
  { id: 'long-wavy', label: 'Long waves', count: 22000, width: 0.003, points: 30 },
  { id: 'curly-long', label: 'Long curls', count: 20000, width: 0.0034, points: 32 },
  { id: 'hime', label: 'Hime cut', count: 24000, width: 0.003, points: 28 },
  { id: 'afro', label: 'Afro', count: 18000, width: 0.0042, points: 18 },
  { id: 'ponytail', label: 'High ponytail', count: 20000, width: 0.003, points: 26 },
  { id: 'low-ponytail', label: 'Low ponytail', count: 20000, width: 0.003, points: 26 },
  { id: 'twin-tails', label: 'Twin tails', count: 20000, width: 0.003, points: 28 },
  { id: 'bun', label: 'Top bun', count: 20000, width: 0.003, points: 22 },
  { id: 'man-bun', label: 'Man bun', count: 18000, width: 0.0032, points: 22 },
  { id: 'braid', label: 'Braid', count: 20000, width: 0.003, points: 32 }
]
export const HAIR_STYLE_BY_ID = new Map(HAIR_STYLES.map((s) => [s.id, s]))

export const FRINGES = [
  { id: 'none', label: 'None' },
  { id: 'blunt', label: 'Blunt bangs' },
  { id: 'side', label: 'Side-swept' },
  { id: 'curtain', label: 'Curtain' },
  { id: 'wispy', label: 'Wispy' }
]

export const BROW_STYLES = [
  { id: 'natural', label: 'Natural' },
  { id: 'straight', label: 'Straight' },
  { id: 'arched', label: 'Arched' },
  { id: 'thick', label: 'Thick' },
  { id: 'thin', label: 'Thin' },
  { id: 'bushy', label: 'Bushy' },
  { id: 'none', label: 'None' }
]

export const BEARD_STYLES = [
  { id: 'none', label: 'Clean shaven' },
  { id: 'stubble', label: 'Stubble' },
  { id: 'short-beard', label: 'Short beard' },
  { id: 'full-beard', label: 'Full beard' },
  { id: 'goatee', label: 'Goatee' },
  { id: 'van-dyke', label: 'Van Dyke' },
  { id: 'mustache', label: 'Mustache' },
  { id: 'chevron', label: 'Chevron' },
  { id: 'handlebar', label: 'Handlebar' },
  { id: 'chin-strap', label: 'Chin strap' },
  { id: 'mutton', label: 'Mutton chops' }
]

/** Beard style → zone weights (scripts/human3d/masks.py zones) + length (dm). */
export const BEARD_ZONES: Record<
  string,
  { zones: Record<string, number>; length: number; count: number }
> = {
  stubble: {
    zones: { beard: 1, mustache: 1, goatee: 1, sideburn: 1, neck: 0.6 },
    length: 0.014,
    count: 9000
  },
  'short-beard': {
    zones: { beard: 1, mustache: 1, goatee: 1, sideburn: 1, neck: 0.7 },
    length: 0.09,
    count: 9000
  },
  'full-beard': {
    zones: { beard: 1, mustache: 1, goatee: 1, sideburn: 1, neck: 0.9 },
    length: 0.42,
    count: 9000
  },
  goatee: { zones: { goatee: 1, mustache: 1 }, length: 0.18, count: 3200 },
  'van-dyke': { zones: { goatee: 1, mustache: 1 }, length: 0.28, count: 3200 },
  mustache: { zones: { mustache: 1 }, length: 0.08, count: 1600 },
  chevron: { zones: { mustache: 1 }, length: 0.11, count: 1800 },
  handlebar: { zones: { mustache: 1 }, length: 0.13, count: 1800 },
  'chin-strap': { zones: { beard: 0.5, sideburn: 1, goatee: 1 }, length: 0.05, count: 4000 },
  mutton: { zones: { sideburn: 1, beard: 0.7 }, length: 0.12, count: 4500 }
}

/** Head landmarks the styles shape against (rig space, dm). */
export interface HeadFrame {
  c: V3
  rx: number
  ry: number
  rz: number
  eyeY: number
  browY: number
  chinY: number
  mouthY: number
  shoulderY: number
  chestY: number
  /** Ear centre x (abs). */
  earX: number
}

export interface HairParams {
  length: number
  volume: number
  curl: number
  frizz: number
  part: number
  fringe: string
}

const DOWN: V3 = [0, -1, 0]

/** A comb direction kept in the scalp's tangent plane; where the wanted flow
 *  points into/out of the surface (e.g. "sideways" on the side of the head)
 *  it falls back to combing down. */
function tangentFlow(flow: V3, n: V3): V3 {
  const t = tangential(flow, n)
  const l = Math.hypot(t[0], t[1], t[2])
  if (l > 0.35) return norm(t)
  return norm(add(t, tangential(DOWN, n), 1 - l / 0.35))
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Curl settings from the 0..1 curl slider. */
export function curlParams(curl: number, frizz: number) {
  return {
    wave: curl < 0.45 ? (curl / 0.45) * 0.085 : 0.085 * Math.max(0, 1 - (curl - 0.45) / 0.35),
    curl: curl > 0.35 ? ((curl - 0.35) / 0.65) * 0.1 : 0,
    period: 1.1 - curl * 0.85,
    frizz: frizz * 0.05
  }
}

/**
 * Grow one scalp strand for `style`. Returns raw points or null (root not
 * used by the style). `R` is the strand's PRNG; `clump` is shared per clump.
 */
export function scalpStrand(
  style: string,
  root: RootSample,
  f: HeadFrame,
  hp: HairParams,
  hull: Collision,
  R: () => number,
  clump: number
): number[] | null {
  const p = root.p
  const n = root.n
  const d: V3 = [p[0] - f.c[0], p[1] - f.c[1], p[2] - f.c[2]]
  const az = Math.atan2(d[0], d[2])
  const front = Math.cos(az)
  const side = Math.sin(az)
  const elev = d[1] / f.ry
  const partX = hp.part * f.rx * 0.38
  const away = d[0] - partX >= 0 ? 1 : -1
  const lenK = 0.55 + hp.length * 0.9
  const margin = 0.012 + hp.volume * 0.1 * (0.25 + R() * 0.75)
  const lift = 0.12 + hp.volume * 0.35
  const jitter = (s: number) => (R() - 0.5) * s

  // Fringe roots: front of the crown, near the hairline
  const fringeW =
    hp.fringe !== 'none'
      ? smooth(0.5, 0.8, front) * smooth(0.15, 0.35, elev) * smooth(0.9, 0.6, elev)
      : 0
  const isFringe = fringeW > 0.5 && FALLING.has(style)
  if (isFringe) return fringeStrand(hp.fringe, root, f, hp, hull, R, margin)

  switch (style) {
    case 'buzz':
      return grow(
        {
          root: p,
          normal: n,
          length: 0.03 + R() * 0.012,
          segments: 2,
          dir: add(n, tangential([0, -0.2, -0.6], n), 0.8),
          stiffness: 0.9,
          gravity: 0,
          margin: 0.004
        },
        null
      )
    case 'crew': {
      const top = smooth(0.25, 0.55, elev)
      const L = (0.12 + top * 0.16) * lenK + jitter(0.03)
      const flow: V3 = front > 0.3 ? [0, 0.4, 0.8] : [0, -0.2, -1]
      return grow(
        {
          root: p,
          normal: n,
          length: L,
          segments: 5,
          dir: add(n, tangential(flow, n), 0.9),
          stiffness: 0.8,
          gravity: 0.08,
          margin: 0.006
        },
        hull
      )
    }
    case 'side-part':
    case 'pixie': {
      const top = smooth(0.1, 0.5, elev)
      const pixie = style === 'pixie'
      const L = ((pixie ? 0.32 : 0.28) + top * (pixie ? 0.4 : 0.5)) * lenK + jitter(0.06)
      const partW = smooth(-0.35, 0.35, front)
      const flow: V3 = [away * 0.9 * partW, -0.35 - (1 - partW) * 0.5, -0.25 + front * 0.3]
      return grow(
        {
          root: p,
          normal: n,
          length: L,
          segments: 10,
          dir: add(tangentFlow(flow, n), n, lift * 0.5),
          stiffness: 0.72,
          gravity: 0.28,
          margin: margin * 0.6
        },
        hull
      )
    }
    case 'slick-back': {
      const L = (0.45 + smooth(0.0, 0.5, elev) * 0.45) * lenK + jitter(0.05)
      return grow(
        {
          root: p,
          normal: n,
          length: L,
          segments: 10,
          dir: tangential([d[0] * 0.15, 0.2, -1], n),
          stiffness: 0.86,
          gravity: 0.25,
          margin: 0.008 + hp.volume * 0.02
        },
        hull
      )
    }
    case 'pompadour': {
      const crest = smooth(0.2, 0.55, front) * smooth(0.3, 0.6, elev)
      const L = (0.2 + crest * 0.95) * lenK + jitter(0.05)
      const steer = (_q: V3, s: number): V3 => (s < 0.45 ? [0, 1, 0.15] : [0, -0.15, -1])
      return grow(
        {
          root: p,
          normal: n,
          length: L,
          segments: 12,
          dir: add(n, [0, 0.6, 0.2], 1),
          stiffness: 0.55,
          gravity: 0.05 + (1 - crest) * 0.2,
          steer: crest > 0.2 ? steer : (_q, _s) => tangential([0, 0, -1], n),
          margin: 0.01 + crest * 0.06
        },
        hull
      )
    }
    case 'undercut': {
      if (elev < 0.42 + Math.abs(side) * 0.1 || (front < -0.3 && elev < 0.65)) return null
      const L = 0.95 * lenK + jitter(0.08)
      return grow(
        {
          root: p,
          normal: n,
          length: L,
          segments: 12,
          dir: add(tangential([away * 0.9, 0.3, -0.2], n), n, 0.4),
          stiffness: 0.7,
          gravity: 0.32,
          margin: margin
        },
        hull
      )
    }
    case 'messy': {
      const L = (0.35 + R() * 0.25) * lenK
      const flow: V3 = norm([(clump - 0.5) * 2 + jitter(0.6), 0.6, front > 0 ? 0.7 : -0.5])
      return grow(
        {
          root: p,
          normal: n,
          length: L,
          segments: 9,
          dir: add(n, tangential(flow, n), 1.1),
          stiffness: 0.62,
          gravity: 0.18,
          margin
        },
        hull
      )
    }
    case 'curly-short':
      return grow(
        {
          root: p,
          normal: n,
          length: (0.38 + R() * 0.12) * lenK,
          segments: 14,
          dir: add(n, tangential([away * 0.4, 0.4, 0.2], n), 0.6),
          stiffness: 0.7,
          gravity: 0.12,
          margin: margin * 0.8
        },
        hull
      )
    case 'mohawk': {
      const w = smooth(0.2, 0.1, Math.abs(d[0]))
      if (w <= 0 || elev < -0.1 || R() > w) return null
      const L = (0.45 + smooth(-0.2, 0.6, front) * 0.6) * lenK + jitter(0.05)
      return grow(
        {
          root: p,
          normal: n,
          length: L,
          segments: 9,
          dir: add(n, [0, 0.5, 0.15], 1),
          stiffness: 0.95,
          gravity: 0,
          margin: 0.004
        },
        hull
      )
    }
    case 'afro': {
      const radial = norm(d)
      const R0 = (1.45 + hp.length * 0.5) * (0.9 + hp.volume * 0.25)
      const L = Math.max(0.15, R0 - Math.hypot(d[0], d[1] * 0.92, d[2])) + jitter(0.08)
      return grow(
        {
          root: p,
          normal: n,
          length: L,
          segments: 16,
          dir: add(radial, [0, 0.25, 0], 1),
          stiffness: 0.92,
          gravity: 0,
          margin: 0.01
        },
        hull
      )
    }
    case 'bob':
    case 'shoulder':
    case 'long':
    case 'long-wavy':
    case 'curly-long':
    case 'hime':
      return fallingStrand(style, root, f, hp, hull, R, margin, lift, away, front, side, elev)
    case 'ponytail':
    case 'low-ponytail':
    case 'twin-tails':
    case 'braid':
      return gatheredStrand(style, root, f, hp, hull, R, clump)
    case 'bun':
    case 'man-bun':
      return bunStrand(style, root, f, hp, hull, R)
    default:
      return null
  }
}

const FALLING = new Set(['bob', 'shoulder', 'long', 'long-wavy', 'curly-long', 'hime', 'pixie'])

function fallingStrand(
  style: string,
  root: RootSample,
  f: HeadFrame,
  hp: HairParams,
  hull: Collision,
  R: () => number,
  margin: number,
  lift: number,
  away: number,
  front: number,
  side: number,
  elev: number
): number[] {
  const p = root.p
  const n = root.n
  // Cut line by style; the length slider moves it
  let cutY: number
  const lk = hp.length - 0.5
  switch (style) {
    case 'bob':
      cutY = f.chinY - 0.15 - lk * 0.6 - front * 0.12
      break
    case 'shoulder':
    case 'curly-long':
      cutY = f.shoulderY - 0.1 - lk * 1.2
      break
    default:
      cutY = f.chestY - 0.6 - lk * 3.0
  }
  // Hime: side locks cut at the chin, the rest long
  if (style === 'hime' && Math.abs(side) > 0.55 && front > -0.1 && elev < 0.55)
    cutY = f.chinY - 0.05
  // U-shaped hemline (longest at the centre back), layered + ragged ends
  const x = p[0] - f.c[0]
  if (style !== 'bob' && !(style === 'hime' && cutY === f.chinY - 0.05)) {
    cutY += Math.abs(x) * 0.35 + Math.max(0, front) * 0.35
    cutY += (R() - 0.5) * 0.45 * (style === 'hime' ? 0.15 : 1)
  }
  cutY += (R() - 0.5) * 0.08
  // Comb: away from the part, framing the face; the back falls straight
  const faceFrame = smooth(0.2, 0.8, front)
  // the parting only exists on the top/front; the back falls straight down
  const partW = smooth(-0.35, 0.35, front)
  const flow: V3 = [
    away * (0.55 + faceFrame * 0.6) * partW,
    -0.2 - (1 - partW) * 0.6,
    -0.35 - faceFrame * 0.25
  ]
  const dir = add(tangentFlow(flow, n), n, lift * 0.6)
  return grow(
    {
      root: p,
      normal: n,
      length: 9,
      segments: 30,
      dir,
      stiffness: 0.7,
      gravity: 0.42,
      margin,
      cutY,
      steer: (q, s) => {
        // never curtain the face: in front of it, comb out to the side
        const dx = q[0] - f.c[0]
        if (q[2] > f.c[2] + f.rz * 0.35 && Math.abs(dx) < f.rx * 0.95 && q[1] > f.chinY - 0.1) {
          return [Math.sign(dx || away) * 1.2, -0.2, -0.5]
        }
        // below the jaw, locks settle in front of or behind the shoulders
        // (by where they grew) instead of fanning straight out
        if (s < 0.15 || q[1] > f.chinY) return null
        const inward = -Math.sign(q[0] - f.c[0]) * 0.35
        return [inward, -1, front > 0.15 ? 0.45 : -0.45]
      }
    },
    hull
  )
}

function fringeStrand(
  fringe: string,
  root: RootSample,
  f: HeadFrame,
  hp: HairParams,
  hull: Collision,
  R: () => number,
  margin: number
): number[] {
  const p = root.p
  const n = root.n
  const x = p[0] - f.c[0]
  const sgn = hp.part >= 0 ? 1 : -1
  let flow: V3
  let cutY: number
  switch (fringe) {
    case 'side':
      flow = [-sgn * 0.9, -0.3, 0.7]
      cutY = f.eyeY + 0.12 + x * sgn * 0.35 + (R() - 0.5) * 0.05
      break
    case 'curtain':
      flow = [Math.sign(x || 1) * 0.8, -0.35, 0.65]
      cutY = f.eyeY - 0.35 + Math.abs(x) * 0.25 + (R() - 0.5) * 0.06
      break
    case 'wispy':
      flow = [x * 0.6, -0.4, 1]
      cutY = f.eyeY + 0.1 + R() * 0.12
      break
    default: // blunt
      flow = [x * 0.25, -0.35, 1]
      cutY = f.eyeY + 0.13 + (R() - 0.5) * 0.015
  }
  return grow(
    {
      root: p,
      normal: n,
      length: 3,
      segments: 16,
      dir: add(tangential(flow, n), n, 0.25),
      stiffness: 0.6,
      gravity: 0.5,
      margin: margin * 0.7 + 0.015,
      cutY
    },
    hull
  )
}

/** Two-phase path: comb along the scalp to a gather point, then the tail. */
function gatheredStrand(
  style: string,
  root: RootSample,
  f: HeadFrame,
  hp: HairParams,
  hull: Collision,
  R: () => number,
  clump: number
): number[] {
  const p = root.p
  const n = root.n
  const sideSign = p[0] - f.c[0] >= 0 ? 1 : -1
  let G: V3
  let tail: V3
  let tailLen = (2.2 + hp.length * 3.2) * (0.85 + R() * 0.3)
  switch (style) {
    case 'ponytail':
      G = add(f.c, [0, f.ry * 0.55, -f.rz * 0.92])
      tail = [0, 0.35, -1]
      break
    case 'low-ponytail':
      G = add(f.c, [0, -f.ry * 0.5, -f.rz * 0.9])
      tail = [0, -0.6, -0.6]
      break
    case 'twin-tails':
      G = add(f.c, [sideSign * f.rx * 0.95, f.ry * 0.3, -f.rz * 0.3])
      tail = [sideSign * 0.7, 0.1, -0.3]
      tailLen *= 0.9
      break
    default: // braid
      G = add(f.c, [0, -f.ry * 0.62, -f.rz * 0.88])
      tail = [0, -0.7, -0.4]
      tailLen *= 1.1
  }
  // Phase 1: hug the scalp to G
  const pts: number[] = []
  const q: V3 = add(p, n, 0.003)
  pts.push(...q)
  const step = 0.08
  for (let i = 0; i < 60; i++) {
    const to: V3 = [G[0] - q[0], G[1] - q[1], G[2] - q[2]]
    const dist = Math.hypot(...to)
    if (dist < 0.1) break
    const dir = norm(to)
    q[0] += dir[0] * Math.min(step, dist)
    q[1] += dir[1] * Math.min(step, dist)
    q[2] += dir[2] * Math.min(step, dist)
    collide(hull, q, 0, 0.006)
    pts.push(...q)
  }
  // Phase 2: from a tight bundle around G, the tail
  const a = R() * Math.PI * 2
  const rr = Math.sqrt(R()) * 0.07
  const out = norm([G[0] - f.c[0], G[1] - f.c[1], G[2] - f.c[2]])
  const bu = norm(cross(out, [0, 1, 0]))
  const bv = norm(cross(out, bu))
  const start: V3 = add(add(add(G, bu, Math.cos(a) * rr), bv, Math.sin(a) * rr), out, 0.05)
  if (style === 'braid') {
    // three interleaved bundles down the back
    const k = Math.floor(clump * 3)
    const segs = 40
    let c: V3 = [...start]
    let dir = norm(tail)
    const w = 0.12
    const period = 0.55
    for (let i = 1; i <= segs; i++) {
      const s = i / segs
      dir = norm(add([dir[0] * 0.8, dir[1] * 0.8, dir[2] * 0.8], [0, -1, 0], 0.2 + s * 0.3))
      c = add(c, dir, tailLen / segs)
      collide(hull, c, 0, 0.12)
      const ph = (s * tailLen) / period + k / 3
      const taper = s > 0.85 ? 1 - ((s - 0.85) / 0.15) * 0.6 : 1
      const ox = Math.sin(ph * Math.PI * 2) * w * taper
      const oz = Math.sin(ph * Math.PI * 4) * w * 0.4 * taper
      const jit = (R() - 0.5) * 0.03
      pts.push(c[0] + ox + jit, c[1] + jit, c[2] + oz + jit)
    }
    return pts
  }
  const tailPts = grow(
    {
      root: start,
      normal: out,
      length: tailLen,
      segments: 22,
      dir: add(tail, [Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0]),
      stiffness: 0.82,
      gravity: 0.35,
      margin: 0.06 + rr,
      steer: (_q, s) => [Math.cos(a) * s * 0.4, 0, Math.sin(a) * s * 0.4]
    },
    hull
  )
  pts.push(...tailPts.slice(3))
  return pts
}

function bunStrand(
  style: string,
  root: RootSample,
  f: HeadFrame,
  hp: HairParams,
  hull: Collision,
  R: () => number
): number[] {
  const p = root.p
  const n = root.n
  const G: V3 =
    style === 'bun'
      ? add(f.c, [0, f.ry * 0.98, -f.rz * 0.28])
      : add(f.c, [0, f.ry * 0.25, -f.rz * 1.0])
  const pts: number[] = []
  const q: V3 = add(p, n, 0.003)
  pts.push(...q)
  for (let i = 0; i < 60; i++) {
    const to: V3 = [G[0] - q[0], G[1] - q[1], G[2] - q[2]]
    const dist = Math.hypot(...to)
    if (dist < 0.08) break
    const dir = norm(to)
    q[0] += dir[0] * Math.min(0.08, dist)
    q[1] += dir[1] * Math.min(0.08, dist)
    q[2] += dir[2] * Math.min(0.08, dist)
    collide(hull, q, 0, 0.006)
    pts.push(...q)
  }
  // Wrap: an arc on the bun sphere
  const out = norm([G[0] - f.c[0], G[1] - f.c[1], G[2] - f.c[2]])
  const rb = (style === 'bun' ? 0.36 : 0.27) * (0.8 + hp.volume * 0.5)
  const B = add(G, out, rb * 0.75)
  let a: V3 = norm([R() - 0.5, R() - 0.5, R() - 0.5])
  a = norm(add(a, out, -dot(a, out)))
  const start = norm([q[0] - B[0], q[1] - B[1], q[2] - B[2]])
  const axis = norm(cross(start, a))
  const sweep = Math.PI * (1.2 + R() * 1.2)
  const r0 = rb * (0.85 + R() * 0.2)
  for (let i = 1; i <= 18; i++) {
    const th = (i / 18) * sweep
    // rotate `start` about `axis` by th (Rodrigues)
    const c = Math.cos(th)
    const s = Math.sin(th)
    const k = axis
    const v = start
    const kv = cross(k, v)
    const kd = dot(k, v)
    const r: V3 = [
      v[0] * c + kv[0] * s + k[0] * kd * (1 - c),
      v[1] * c + kv[1] * s + k[1] * kd * (1 - c),
      v[2] * c + kv[2] * s + k[2] * kd * (1 - c)
    ]
    const rad = r0 * (1 - (i / 18) * 0.25)
    pts.push(B[0] + r[0] * rad, B[1] + r[1] * rad, B[2] + r[2] * rad)
  }
  return pts
}

// ── Brows ────────────────────────────────────────────────────────────────────
const BROW_SHAPE: Record<
  string,
  { thick: number; arch: number; len: number; taper: number; mess: number }
> = {
  natural: { thick: 1, arch: 0.4, len: 1, taper: 0.55, mess: 0.3 },
  straight: { thick: 1, arch: -0.2, len: 1, taper: 0.7, mess: 0.2 },
  arched: { thick: 0.85, arch: 1, len: 1, taper: 0.45, mess: 0.15 },
  thick: { thick: 1.45, arch: 0.3, len: 1.1, taper: 0.75, mess: 0.35 },
  thin: { thick: 0.55, arch: 0.6, len: 0.85, taper: 0.4, mess: 0.1 },
  bushy: { thick: 1.6, arch: 0.25, len: 1.6, taper: 0.8, mess: 0.8 }
}

/** Accept a brow root? (u along 0..1, v across in dm). */
export function browAccept(
  style: string,
  thickness: number,
  arch: number,
  u: number,
  v: number,
  R: () => number
) {
  const s = BROW_SHAPE[style]
  if (!s) return false
  if (u > 0.98) return false
  const archShift = (s.arch + arch) * 0.03 * Math.sin(Math.min(1, u * 1.15) * Math.PI) - 0.012
  const half =
    0.045 *
    s.thick *
    (0.55 + thickness * 0.9) *
    (1 - u * (1 - s.taper)) *
    (u < 0.08 ? 0.7 + u * 4 : 1)
  const dv = Math.abs(v - archShift)
  if (dv > half) return false
  // feathered edges
  return R() < 1 - Math.pow(dv / half, 3) * 0.7
}

export function browStrand(style: string, root: RootSample, R: () => number): number[] {
  const s = BROW_SHAPE[style] || BROW_SHAPE.natural
  const n = root.n
  const sideX = root.p[0] >= 0 ? 1 : -1
  const u = root.u
  // inner hairs point up, the body sweeps outward, the tail slightly down
  const up = Math.max(0, 1 - u * 4)
  const flow: V3 = [sideX * (0.3 + u * 0.8), up * 0.9 + 0.15 - u * 0.25, 0]
  const dir = add(tangential(norm(flow), n), n, 0.12 + s.mess * 0.1)
  const L = (0.035 + R() * 0.03) * s.len * (u < 0.15 ? 0.7 : 1)
  return grow(
    {
      root: root.p,
      normal: n,
      length: L,
      segments: 4,
      dir,
      stiffness: 0.85,
      gravity: 0,
      margin: 0,
      steer: (_q, t) => tangential([0, -0.15 * t, 0], n)
    },
    null
  )
}

// ── Lashes ───────────────────────────────────────────────────────────────────
export function lashStrand(
  root: RootSample,
  eyeC: V3,
  upper: boolean,
  length: number,
  R: () => number
): number[] {
  const p = root.p
  // root.n = the helper strip's lash direction; lean it out of the eye a little
  const radial = norm(add(root.n, norm([p[0] - eyeC[0], p[1] - eyeC[1], p[2] - eyeC[2]]), 0.5))
  const u = root.u // 0 inner … 1 outer
  const prof = upper
    ? 0.55 + Math.sin(Math.min(1, u * 1.1) * Math.PI) * 0.45 + u * 0.2
    : 0.5 + Math.sin(u * Math.PI) * 0.5
  // lower lashes are short + fine (long ones read as stubble under the eye)
  const L = (upper ? 0.085 : 0.024) * prof * (0.6 + length * 0.9) * (0.85 + R() * 0.3)
  const sideX = p[0] >= 0 ? 1 : -1
  const curlDir: V3 = upper ? [sideX * u * 0.3, 1, 0.15] : [sideX * u * 0.2, -1, 0.2]
  const pts: number[] = [...p]
  let q: V3 = [...p]
  let dir = radial
  const segs = 5
  for (let i = 1; i <= segs; i++) {
    dir = norm(add(dir, curlDir, 0.32 * i))
    q = add(q, dir, L / segs)
    pts.push(...q)
  }
  return pts
}

// ── Beards ───────────────────────────────────────────────────────────────────
export function beardStrand(
  style: string,
  root: RootSample,
  f: HeadFrame,
  length: number,
  hull: Collision,
  R: () => number
): number[] {
  const spec = BEARD_ZONES[style]
  const p = root.p
  const n = root.n
  const x = p[0] - f.c[0]
  const sx = x >= 0 ? 1 : -1
  const zone = root.tag // 0 beard, 1 mustache, 2 goatee, 3 sideburn, 4 neck
  let L = spec.length * (0.5 + length)
  let flow: V3 = [sx * 0.15, -1, 0.25]
  let gravity = 0.25
  if (zone === 1) {
    // mustache: down and outward from the philtrum
    flow = [sx * (0.5 + Math.abs(x) * 1.5), -0.8, 0.35]
    L *= style === 'mustache' || style === 'chevron' || style === 'handlebar' ? 1 : 0.7
    gravity = 0.15
  } else if (zone === 2) {
    flow = [sx * 0.08, -1, 0.35]
    if (style === 'van-dyke' || style === 'goatee' || style === 'full-beard') L *= 1.25
  } else if (zone === 4) {
    flow = [0, -0.6, 0.8]
    L *= 0.8
  } else if (zone === 3) {
    flow = [0, -1, 0.1]
    L *= style === 'mutton' ? 1.2 : 0.7
  } else {
    // cheeks/jaw: chin longest
    const chinness = smooth(0.5, 0.05, Math.abs(x))
    L *= 0.55 + chinness * 0.6
  }
  L *= 0.8 + R() * 0.4
  const steer =
    style === 'handlebar' && zone === 1
      ? (_q: V3, s: number): V3 | null => (s > 0.5 ? [sx * 0.6, 0.9, 0.1] : null)
      : undefined
  return grow(
    {
      root: p,
      normal: n,
      length: L,
      segments: L > 0.15 ? 9 : L > 0.04 ? 5 : 2,
      dir: add(tangential(norm(flow), n), n, 0.35),
      stiffness: 0.7,
      gravity,
      margin: 0.004 + Math.min(0.03, L * 0.12),
      steer
    },
    L > 0.05 ? hull : null
  )
}

export { resample, curlStrand, DOWN }
