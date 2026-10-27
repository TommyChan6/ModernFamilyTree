// The family fingerprint mandala (WILD_IDEAS D4): FingerprintFeatures
// (src/shared/fingerprint.ts) → a deterministic mandala description → drawn
// to Canvas 2D AND serialized to an SVG string from the SAME shape list, so
// the PNG and SVG downloads match what the card shows.
//
// The structure stays legible:
//   rings          one per generation (radius ∝ depth), beads = its people
//   petals         families rooted in that generation (each repeated at every
//                  star point); length = children per family, sharper = more
//                  uneven family sizes
//   frame star     rotational symmetry = founding lines (at least three)
//   rosette        overlapping circles = couples; small diamonds = remarriages
//   core           two-colour split = gender balance
//   threads        string-art across the middle = social bonds
//   halo           one bead per decade spanned, large beads at centuries
//   satellites     islands (unconnected groups); sparks = people with no bonds
//   tints          the most-used tag colours tint the petals
//
// Every random choice is seeded by (project seed, slot index) — never by a
// count — so adding one person only nudges the ring it lands in.
//
// Pure: no DOM except the canvas context handed to drawMandala, no store,
// no i18n (the legend returns ids + numbers; the dialog translates).

import type { FingerprintFeatures } from '../../../shared/fingerprint'
import { INK } from './inkArt'
import { MED } from './medievalArt'

export type FingerprintTheme = 'dark' | 'light' | 'ink' | 'medieval'

export interface MandalaOptions {
  theme?: FingerprintTheme
  /** UI accent ('#rrggbb') — the rosette and centuries in dark/light. */
  accent?: string | null
  /** Base hue (0–359) — the project card's hue; default derived from the seed. */
  hue?: number | null
  /** [male end, female end] colours for the core split (Style Studio palette). */
  genderColors?: [string, string] | null
  /** Paint the theme's ground (exports); off = transparent (cards). */
  background?: boolean
}

/** One path command: ['M', x, y] | ['L', x, y] | ['Q', cx, cy, x, y] |
 *  ['C', c1x, c1y, c2x, c2y, x, y] | ['Z']. */
export type PathCmd = [string, ...number[]]

export interface Shape {
  /** 'spin' rotates with the mandala; 'fixed' (ground, seal, gilt border) never does. */
  layer: 'spin' | 'fixed'
  d?: PathCmd[]
  circle?: [number, number, number]
  /** Radial glow disc: colour at `alpha` fading to transparent. */
  radial?: { cx: number; cy: number; r: number; color: string; alpha: number }
  fill?: string | null
  stroke?: string | null
  width?: number
  alpha?: number
  dash?: number[]
}

export interface RingParams {
  people: number
  families: number
  /** Mean children per family rooted here. */
  kids: number
}

/** Everything the drawing depends on — flat and comparable (tests diff it). */
export interface MandalaParams {
  seed: number
  hue: number
  symmetry: number
  pointed: number
  rings: RingParams[]
  couples: number
  remarried: number
  social: number
  halo: { decades: number; firstDecade: number } | null
  islands: number[]
  loners: number
  gender: number | null
  tagColors: string[]
  partial: boolean
}

export interface Mandala {
  params: MandalaParams
  theme: FingerprintTheme
  background: string
  shapes: Shape[]
}

/** Drawing extent: the mandala lives in [-VIEW, VIEW]². */
export const VIEW = 120

const TAU = Math.PI * 2
const ROT0 = -Math.PI / 2
const MAX_RINGS = 16
const CORE = 7
const RING_IN = 28
const RING_OUT = 80
const HALO = 89
const SAT_R = 105

// ── seeded helpers ───────────────────────────────────────────────────────────

/** A stable [0,1) value for (seed, slot) — independent of every count. */
function hash01(seed: number, slot: number): number {
  let h = (seed ^ Math.imul(slot + 0x9e3779b9, 0x85ebca6b)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x))
const pol = (r: number, a: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)]

function hslHex(h: number, s: number, l: number): string {
  const hh = (((h % 360) + 360) % 360) / 360
  const ss = clamp(s, 0, 100) / 100
  const ll = clamp(l, 0, 100) / 100
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss
  const p = 2 * ll - q
  const ch = (t: number): string => {
    let x = t
    if (x < 0) x += 1
    if (x > 1) x -= 1
    const v =
      x < 1 / 6
        ? p + (q - p) * 6 * x
        : x < 1 / 2
          ? q
          : x < 2 / 3
            ? p + (q - p) * (2 / 3 - x) * 6
            : p
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${ch(hh + 1 / 3)}${ch(hh)}${ch(hh - 1 / 3)}`
}

function cleanHex(c: unknown, fallback: string): string {
  return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : fallback
}

// ── features → params ────────────────────────────────────────────────────────

export function mandalaParams(f: FingerprintFeatures, opts: MandalaOptions = {}): MandalaParams {
  const seed = (f?.seed ?? 0) >>> 0
  const gens = Array.isArray(f?.generations) ? f.generations : []
  const fams = Array.isArray(f?.genFamilies) ? f.genFamilies : []
  const kids = Array.isArray(f?.genChildren) ? f.genChildren : []
  const partial = !!f?.partial
  const rings: RingParams[] = []
  for (let g = 0; g < gens.length; g++) {
    let fam = Math.max(0, fams[g] || 0)
    let kid = Math.max(0, kids[g] || 0)
    if (partial && g + 1 < gens.length) {
      // Counts only: guess ~2.5 children per family from the next ring.
      fam = Math.max(1, Math.round((gens[g + 1] || 0) / 2.5))
      kid = gens[g + 1] || 0
    }
    const ring = { people: Math.max(0, gens[g] || 0), families: fam, kids: fam ? kid / fam : 0 }
    if (rings.length < MAX_RINGS) rings.push(ring)
    else {
      // Fold the deepest generations into the outermost ring.
      const last = rings[MAX_RINGS - 1]
      const famSum = last.families + ring.families
      last.kids = famSum ? (last.kids * last.families + ring.kids * ring.families) / famSum : 0
      last.families = famSum
      last.people += ring.people
    }
  }
  for (const r of rings) r.kids = Math.round(r.kids * 100) / 100
  const span = f?.span
  const halo =
    span && Number.isFinite(span.from) && Number.isFinite(span.to)
      ? {
          firstDecade: Math.floor(Math.min(span.from, span.to) / 10),
          decades: clamp(
            Math.floor(Math.max(span.from, span.to) / 10) -
              Math.floor(Math.min(span.from, span.to) / 10) +
              1,
            1,
            180
          )
        }
      : null
  const hue =
    typeof opts.hue === 'number' && Number.isFinite(opts.hue)
      ? ((Math.round(opts.hue) % 360) + 360) % 360
      : seed % 360
  return {
    seed,
    hue,
    symmetry: clamp(f?.founderLines || 0, 3, 16),
    pointed: Math.round(clamp(f?.branchSpread || 0, 0, 1) * 100) / 100,
    rings,
    couples: Math.max(0, f?.couples || 0),
    remarried: Math.max(0, f?.remarried || 0),
    social: Math.max(0, f?.social || 0),
    halo,
    islands: (Array.isArray(f?.islands) ? f.islands : []).slice(0, 8),
    loners: Math.max(0, f?.loners || 0),
    gender: f?.gender?.known ? clamp(f.gender.mean, 0, 1) : null,
    tagColors: (Array.isArray(f?.tagColors) ? f.tagColors : []).slice(0, 5),
    partial
  }
}

// ── palettes ─────────────────────────────────────────────────────────────────

interface Palette {
  bg: string
  glow: string | null
  line: string
  faint: string
  bead: string
  frame: string
  frameAlpha: number
  rosette: string
  diamond: string
  core: [string, string]
  coreNeutral: string
  coreDot: string
  halo: string
  century: string
  sat: string
  thread: string
  ringFill: (g: number) => string
  petalAlpha: (g: number) => number
  petalStroke: string
  seal: { fill: string; carve: string } | null
  gilt: string | null
}

function paletteFor(p: MandalaParams, opts: MandalaOptions): Palette {
  const theme = opts.theme || 'dark'
  const h = p.hue
  const tags = p.tagColors
  const accentDefault = theme === 'light' ? hslHex(h + 150, 60, 42) : hslHex(h + 150, 70, 66)
  const accent = cleanHex(opts.accent, accentDefault)
  const gc = opts.genderColors
  const gender: [string, string] = [cleanHex(gc?.[0], '#3a7bd5'), cleanHex(gc?.[1], '#c95fa0')]
  // Hue steps alternate around the base so neighbouring rings harmonise.
  const step = (g: number): number => (g % 2 ? 1 : -1) * Math.ceil(g / 2) * 24
  if (theme === 'ink') {
    return {
      bg: INK.paper,
      glow: null,
      line: INK.ink,
      faint: INK.wash,
      bead: INK.ink2,
      frame: INK.ink,
      frameAlpha: 0.05,
      rosette: INK.ink,
      diamond: INK.cinnabar,
      core: [INK.ink, INK.cinnabar],
      coreNeutral: INK.ink2,
      coreDot: INK.paperLight,
      halo: INK.ink2,
      century: INK.cinnabar,
      sat: INK.ink2,
      thread: INK.wash,
      ringFill: () => INK.ink,
      petalAlpha: (g) => 0.1 + 0.06 * ((g * 7) % 3),
      petalStroke: INK.ink,
      seal: { fill: INK.cinnabar, carve: INK.paperLight },
      gilt: null
    }
  }
  if (theme === 'medieval') {
    const enamels = [MED.lapis, MED.gold, MED.verdigris, MED.vermilion]
    return {
      bg: MED.vellum,
      glow: MED.goldLight,
      line: MED.goldDeep,
      faint: MED.ink2,
      bead: MED.ink,
      frame: MED.gold,
      frameAlpha: 0.16,
      rosette: MED.vermilion,
      diamond: MED.lapis,
      core: [MED.lapis, MED.vermilion],
      coreNeutral: MED.ink2,
      coreDot: MED.goldLight,
      halo: MED.goldDeep,
      century: MED.vermilion,
      sat: MED.lapisDeep,
      thread: MED.goldDeep,
      ringFill: (g) =>
        tags.length && g % 3 === 2 ? tags[Math.floor(g / 3) % tags.length] : enamels[g % 2],
      petalAlpha: (g) => (g % 2 ? 0.75 : 0.62),
      petalStroke: MED.goldDeep,
      seal: null,
      gilt: MED.gold
    }
  }
  const light = theme === 'light'
  return {
    bg: light ? '#f8f6f1' : '#0d1020',
    glow: light ? hslHex(h, 70, 88) : hslHex(h, 70, 45),
    line: light ? hslHex(h, 32, 28) : hslHex(h, 38, 82),
    faint: light ? hslHex(h, 18, 48) : hslHex(h, 26, 66),
    bead: light ? hslHex(h, 36, 22) : hslHex(h, 45, 93),
    frame: light ? hslHex(h, 55, 46) : hslHex(h, 60, 62),
    frameAlpha: light ? 0.09 : 0.1,
    rosette: accent,
    diamond: accent,
    core: gender,
    coreNeutral: light ? hslHex(h, 15, 62) : hslHex(h, 15, 46),
    coreDot: light ? '#ffffff' : hslHex(h, 40, 95),
    halo: light ? hslHex(h, 30, 36) : hslHex(h, 45, 76),
    century: accent,
    sat: light ? hslHex(h + 180, 45, 40) : hslHex(h + 180, 55, 72),
    thread: light ? hslHex(h, 25, 40) : hslHex(h, 40, 75),
    ringFill: (g) =>
      tags.length
        ? tags[g % tags.length]
        : light
          ? hslHex(h + step(g), 58, 50)
          : hslHex(h + step(g), 66, 60),
    petalAlpha: () => (light ? 0.4 : 0.48),
    petalStroke: light ? hslHex(h, 40, 30) : hslHex(h, 50, 84),
    seal: null,
    gilt: null
  }
}

// ── params → shapes ──────────────────────────────────────────────────────────

function circlePath(cx: number, cy: number, r: number): Shape['circle'] {
  return [cx, cy, r]
}

/** One petal at angle `a`, base radius r0, length L, half-width w (radians). */
function petalPath(a: number, r0: number, L: number, w: number, pt: number): PathCmd[] {
  const side = (s: number) => ({
    base: pol(r0, a + s * w * 0.55),
    c1: pol(r0 + L * 0.42, a + s * w * (1.25 - 0.8 * pt)),
    c2: pol(r0 + L * (0.92 - 0.3 * pt), a + s * w * (0.55 - 0.48 * pt))
  })
  const l = side(-1)
  const r = side(1)
  const tip = pol(r0 + L, a)
  return [
    ['M', ...l.base],
    ['C', ...l.c1, ...l.c2, ...tip],
    ['C', ...r.c2, ...r.c1, ...r.base],
    ['Q', ...pol(r0 - 1.2, a), ...l.base],
    ['Z']
  ]
}

export function buildMandala(f: FingerprintFeatures, opts: MandalaOptions = {}): Mandala {
  const theme: FingerprintTheme = opts.theme || 'dark'
  const p = mandalaParams(f, opts)
  const pal = paletteFor(p, { ...opts, theme })
  const S: Shape[] = []
  const seed = p.seed
  const spin = (s: Omit<Shape, 'layer'>): void => {
    S.push({ layer: 'spin', ...s })
  }
  const fixed = (s: Omit<Shape, 'layer'>): void => {
    S.push({ layer: 'fixed', ...s })
  }

  // Ground.
  if (opts.background) {
    fixed({
      d: [['M', -VIEW, -VIEW], ['L', VIEW, -VIEW], ['L', VIEW, VIEW], ['L', -VIEW, VIEW], ['Z']],
      fill: pal.bg
    })
  }
  if (pal.glow) {
    fixed({
      radial: { cx: 0, cy: 0, r: 112, color: pal.glow, alpha: theme === 'dark' ? 0.32 : 0.5 }
    })
  }
  if (pal.gilt) {
    fixed({ circle: circlePath(0, 0, 115), stroke: pal.gilt, width: 1.4, alpha: 0.85 })
    fixed({ circle: circlePath(0, 0, 112.4), stroke: pal.gilt, width: 0.5, alpha: 0.7 })
  }

  // Frame stars — one point per founding line.
  const sym = p.symmetry
  for (const [tipR, valR, off, a] of [
    [86, 58, 0, 1],
    [72, 44, Math.PI / sym, 0.7]
  ] as const) {
    const d: PathCmd[] = []
    for (let k = 0; k < sym; k++) {
      const tipA = ROT0 + off + (k * TAU) / sym
      const v0 = pol(valR, tipA - Math.PI / sym)
      const tip = pol(tipR, tipA)
      const v1 = pol(valR, tipA + Math.PI / sym)
      if (!k) d.push(['M', ...v0])
      d.push(['Q', ...pol((tipR + valR) * 0.55, tipA - Math.PI / sym / 2.4), ...tip])
      d.push(['Q', ...pol((tipR + valR) * 0.55, tipA + Math.PI / sym / 2.4), ...v1])
    }
    d.push(['Z'])
    spin({ d, fill: pal.frame, alpha: pal.frameAlpha * a })
    spin({ d, stroke: pal.frame, width: 0.6, alpha: Math.min(0.6, pal.frameAlpha * a * 4) })
  }

  // Social threads (behind the rosette).
  const threads = Math.min(p.social, 64)
  for (let i = 0; i < threads; i++) {
    const a1 = hash01(seed, 1000 + i) * TAU
    const a2 = a1 + Math.PI * (0.45 + hash01(seed, 1500 + i) * 0.9)
    const bend = (hash01(seed, 1700 + i) - 0.5) * 14
    spin({
      d: [
        ['M', ...pol(RING_IN - 2, a1)],
        ['Q', ...pol(bend, (a1 + a2) / 2), ...pol(RING_IN - 2, a2)]
      ],
      stroke: pal.thread,
      width: 0.35,
      alpha: 0.32
    })
  }

  // Generation rings: guide, petals (families → next ring), beads (people).
  const G = p.rings.length
  const band = (RING_OUT - RING_IN) / Math.max(G, 1)
  if (!G) {
    for (const r of [RING_IN + 6, RING_IN + 20, RING_IN + 36]) {
      spin({
        circle: circlePath(0, 0, r),
        stroke: pal.faint,
        width: 0.4,
        alpha: 0.35,
        dash: [1.4, 2.6]
      })
    }
  }
  for (let g = 0; g < G; g++) {
    const ring = p.rings[g]
    const rc = RING_IN + band * (g + 0.5)
    const phase = hash01(seed, 100 + g) * TAU
    spin({ circle: circlePath(0, 0, rc), stroke: pal.line, width: 0.35, alpha: 0.3 })
    // Each family's petal repeats once per star point, so the ring keeps
    // the mandala's symmetry (capped so a huge generation stays drawable).
    const fam = Math.min(ring.families, Math.floor(96 / sym))
    const P = fam * sym
    if (P) {
      const L = band * (0.55 + 0.6 * clamp(ring.kids / 4, 0, 1))
      const w = Math.min((Math.PI / P) * 0.92, 0.55)
      const fill = pal.ringFill(g)
      const alpha = pal.petalAlpha(g)
      for (let k = 0; k < P; k++) {
        const a = phase + (k * TAU) / P
        spin({
          d: petalPath(a, rc, L, w, p.pointed),
          fill,
          stroke: pal.petalStroke,
          width: 0.4,
          alpha
        })
        if (P <= 48) {
          spin({
            d: [
              ['M', ...pol(rc + 0.6, a)],
              ['L', ...pol(rc + L * 0.78, a)]
            ],
            stroke: pal.petalStroke,
            width: 0.3,
            alpha: alpha * 0.6
          })
        }
      }
    }
    const n = ring.people
    if (n) {
      const cap = Math.max(3, Math.floor((TAU * rc) / 2.4))
      const shown = Math.min(n, cap)
      const br = clamp(((Math.PI * rc) / shown) * 0.4, 0.45, 1.8)
      const bphase = phase + Math.PI / Math.max(P, 1)
      if (n > cap) {
        spin({
          circle: circlePath(0, 0, rc),
          stroke: pal.bead,
          width: br * 1.6,
          alpha: clamp(0.12 + (n / cap) * 0.06, 0.12, 0.5)
        })
      }
      for (let k = 0; k < shown; k++) {
        spin({
          circle: circlePath(...pol(rc, bphase + (k * TAU) / shown), br),
          fill: pal.bead,
          alpha: 0.9
        })
      }
    }
  }
  // Outer rim of the ring field.
  if (G)
    spin({ circle: circlePath(0, 0, RING_OUT + 1.5), stroke: pal.line, width: 0.5, alpha: 0.4 })

  // Rosette — couples as seed-of-life circles; remarriages as diamonds.
  const c1 = Math.min(p.couples, 12)
  if (!c1) {
    spin({
      circle: circlePath(0, 0, 8),
      stroke: pal.rosette,
      width: 0.5,
      alpha: 0.5,
      dash: [1, 1.8]
    })
  }
  for (let i = 0; i < c1; i++) {
    const [x, y] = pol(8, ROT0 + (i * TAU) / c1)
    spin({
      circle: circlePath(x, y, 8),
      fill: pal.rosette,
      stroke: pal.rosette,
      width: 0.6,
      alpha: 0.75 / (1 + c1 * 0.08)
    })
  }
  const c2 = Math.min(Math.max(p.couples - 12, 0), 36)
  for (let i = 0; i < c2; i++) {
    const [x, y] = pol(19.5, ROT0 + ((i + 0.5) * TAU) / c2)
    spin({ circle: circlePath(x, y, 1.6), stroke: pal.rosette, width: 0.45, alpha: 0.7 })
  }
  const m = Math.min(p.remarried, 24)
  for (let i = 0; i < m; i++) {
    const a = ROT0 + (i * TAU) / m + Math.PI / Math.max(m, 1)
    spin({
      d: [
        ['M', ...pol(21.5, a)],
        ['L', ...pol(23.5, a + 0.07)],
        ['L', ...pol(25.5, a)],
        ['L', ...pol(23.5, a - 0.07)],
        ['Z']
      ],
      fill: pal.diamond,
      alpha: 0.9
    })
  }

  // Core — the gender balance as a two-colour split.
  if (p.gender === null) {
    spin({ circle: circlePath(0, 0, CORE), fill: pal.coreNeutral, alpha: 0.9 })
  } else {
    spin({ circle: circlePath(0, 0, CORE), fill: pal.core[0], alpha: 0.95 })
    const sweep = p.gender * TAU
    if (sweep >= TAU - 1e-3) {
      spin({ circle: circlePath(0, 0, CORE), fill: pal.core[1], alpha: 0.95 })
    } else if (sweep > 1e-3) {
      // Arc approximated by cubic segments (≤ 90° each) so canvas == svg.
      const d: PathCmd[] = [
        ['M', 0, 0],
        ['L', ...pol(CORE, ROT0)]
      ]
      const segs = Math.ceil(sweep / (Math.PI / 2))
      const da = sweep / segs
      const kk = (4 / 3) * Math.tan(da / 4) * CORE
      for (let s = 0; s < segs; s++) {
        const a0 = ROT0 + s * da
        const a1 = a0 + da
        const [x0, y0] = pol(CORE, a0)
        const [x1, y1] = pol(CORE, a1)
        d.push([
          'C',
          x0 - kk * Math.sin(a0),
          y0 + kk * Math.cos(a0),
          x1 + kk * Math.sin(a1),
          y1 - kk * Math.cos(a1),
          x1,
          y1
        ])
      }
      d.push(['Z'])
      spin({ d, fill: pal.core[1], alpha: 0.95 })
    }
  }
  spin({ circle: circlePath(0, 0, 2), fill: pal.coreDot, alpha: 0.9 })
  spin({ circle: circlePath(0, 0, CORE + 1.2), stroke: pal.line, width: 0.5, alpha: 0.6 })

  // Halo — one bead per decade the family spans, big beads on centuries.
  if (p.halo) {
    const D = p.halo.decades
    spin({ circle: circlePath(0, 0, HALO), stroke: pal.halo, width: 0.3, alpha: 0.35 })
    const small = clamp(((Math.PI * HALO) / D) * 0.3, 0.4, 1.4)
    for (let i = 0; i < D; i++) {
      const a = ROT0 + (i * TAU) / D
      const century = ((p.halo.firstDecade + i) * 10) % 100 === 0
      if (century) {
        spin({
          d: [
            ['M', ...pol(HALO + 1.6, a)],
            ['L', ...pol(HALO + 4.2, a)]
          ],
          stroke: pal.century,
          width: 0.6,
          alpha: 0.9
        })
      }
      spin({
        circle: circlePath(...pol(HALO, a), century ? small + 0.9 : small),
        fill: century ? pal.century : pal.halo,
        alpha: century ? 0.95 : 0.75
      })
    }
  } else {
    spin({
      circle: circlePath(0, 0, HALO),
      stroke: pal.halo,
      width: 0.45,
      alpha: 0.4,
      dash: [1.2, 2.4]
    })
  }

  // Satellites — islands outside the halo; sparks for people with no bonds.
  p.islands.forEach((size, i) => {
    const a = hash01(seed, 2000 + i) * TAU
    const sr = clamp(2 + Math.sqrt(size) * 1.25, 2.6, 8)
    const [x, y] = pol(SAT_R, a)
    spin({
      d: [
        ['M', ...pol(HALO + 2.5, a)],
        ['L', ...pol(SAT_R - sr - 0.8, a)]
      ],
      stroke: pal.sat,
      width: 0.35,
      alpha: 0.4,
      dash: [0.8, 1.2]
    })
    spin({ circle: circlePath(x, y, sr), fill: pal.sat, stroke: pal.sat, width: 0.5, alpha: 0.28 })
    const k = Math.min(size, 8)
    for (let j = 0; j < k; j++) {
      const [bx, by] = pol(sr * 0.62, a + (j * TAU) / k)
      spin({
        circle: circlePath(x + bx, y + by, Math.max(0.45, sr * 0.14)),
        fill: pal.sat,
        alpha: 0.9
      })
    }
  })
  const sparks = Math.min(p.loners, 24)
  for (let i = 0; i < sparks; i++) {
    const a = hash01(seed, 3000 + i) * TAU
    const r = 95 + hash01(seed, 3100 + i) * 4
    const [x, y] = pol(r, a)
    const s = 1.4
    spin({
      d: [
        ['M', x, y - s],
        ['Q', x, y, x + s, y],
        ['Q', x, y, x, y + s],
        ['Q', x, y, x - s, y],
        ['Q', x, y, x, y - s],
        ['Z']
      ],
      fill: pal.sat,
      alpha: 0.85
    })
  }

  // Ink: a cinnabar seal carved from the seed (never rotates).
  if (pal.seal) {
    const x0 = 88
    const y0 = 88
    const sz = 20
    fixed({
      d: [['M', x0, y0], ['L', x0 + sz, y0], ['L', x0 + sz, y0 + sz], ['L', x0, y0 + sz], ['Z']],
      fill: pal.seal.fill,
      alpha: 0.92
    })
    const cell = (sz - 4) / 4
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        // Mirror the left half onto the right — seals read as symmetric glyphs.
        const cc = c < 2 ? c : 3 - c
        if (hash01(seed, 4000 + r * 2 + cc) < 0.45) continue
        const x = x0 + 2 + c * cell + 0.5
        const y = y0 + 2 + r * cell + 0.5
        fixed({
          d: [
            ['M', x, y],
            ['L', x + cell - 1, y],
            ['L', x + cell - 1, y + cell - 1],
            ['L', x, y + cell - 1],
            ['Z']
          ],
          fill: pal.seal.carve,
          alpha: 0.95
        })
      }
    }
  }

  return { params: p, theme, background: pal.bg, shapes: S }
}

// ── renderers ────────────────────────────────────────────────────────────────

function fmt(x: number): string {
  const v = Math.round(x * 100) / 100
  return String(Object.is(v, -0) ? 0 : v)
}

function pathString(d: PathCmd[]): string {
  return d.map(([c, ...n]) => c + n.map(fmt).join(' ')).join('')
}

function hexRgb(hex: string): [number, number, number] {
  const h = cleanHex(hex, '#000000')
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

/** Serialize the mandala to a standalone SVG document. Deterministic. */
export function mandalaToSvg(m: Mandala, sizePx = 1024): string {
  const out: string[] = []
  const defs: string[] = []
  let gid = 0
  for (const s of m.shapes) {
    const alpha = s.alpha ?? 1
    if (s.radial) {
      const id = `fpg${gid++}`
      const { cx, cy, r, color } = s.radial
      defs.push(
        `<radialGradient id="${id}" cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" gradientUnits="userSpaceOnUse">` +
          `<stop offset="0" stop-color="${color}" stop-opacity="${fmt(s.radial.alpha * alpha)}"/>` +
          `<stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`
      )
      out.push(`<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" fill="url(#${id})"/>`)
      continue
    }
    const paint =
      `fill="${s.fill || 'none'}"` +
      (s.fill && alpha !== 1 ? ` fill-opacity="${fmt(alpha)}"` : '') +
      (s.stroke
        ? ` stroke="${s.stroke}" stroke-width="${fmt(s.width ?? 1)}"` +
          (alpha !== 1 ? ` stroke-opacity="${fmt(alpha)}"` : '') +
          ' stroke-linecap="round" stroke-linejoin="round"' +
          (s.dash ? ` stroke-dasharray="${s.dash.map(fmt).join(' ')}"` : '')
        : '')
    if (s.circle) {
      const [cx, cy, r] = s.circle
      out.push(`<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" ${paint}/>`)
    } else if (s.d) {
      out.push(`<path d="${pathString(s.d)}" ${paint}/>`)
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}" ` +
    `width="${sizePx}" height="${sizePx}">` +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') +
    out.join('') +
    '</svg>'
  )
}

export interface DrawOptions {
  /** Which layer(s) to paint (the component spins 'spin' on its own canvas). */
  layer?: 'spin' | 'fixed' | 'all'
  /** Extra rotation of the spin layer, radians. */
  rotation?: number
}

/** Paint the mandala into a square `sizePx` region at the context origin. */
export function drawMandala(
  ctx: CanvasRenderingContext2D,
  m: Mandala,
  sizePx: number,
  opts: DrawOptions = {}
): void {
  const layer = opts.layer || 'all'
  ctx.save()
  ctx.translate(sizePx / 2, sizePx / 2)
  ctx.scale(sizePx / (VIEW * 2), sizePx / (VIEW * 2))
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const s of m.shapes) {
    if (layer !== 'all' && s.layer !== layer) continue
    const alpha = s.alpha ?? 1
    ctx.save()
    if (s.layer === 'spin' && opts.rotation) ctx.rotate(opts.rotation)
    if (s.radial) {
      const { cx, cy, r, color } = s.radial
      const [R, G, B] = hexRgb(color)
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      grad.addColorStop(0, `rgba(${R},${G},${B},${s.radial.alpha * alpha})`)
      grad.addColorStop(1, `rgba(${R},${G},${B},0)`)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, TAU)
      ctx.fill()
      ctx.restore()
      continue
    }
    ctx.beginPath()
    if (s.circle) {
      const [cx, cy, r] = s.circle
      ctx.moveTo(cx + r, cy)
      ctx.arc(cx, cy, r, 0, TAU)
    } else if (s.d) {
      for (const [c, ...n] of s.d) {
        if (c === 'M') ctx.moveTo(n[0], n[1])
        else if (c === 'L') ctx.lineTo(n[0], n[1])
        else if (c === 'Q') ctx.quadraticCurveTo(n[0], n[1], n[2], n[3])
        else if (c === 'C') ctx.bezierCurveTo(n[0], n[1], n[2], n[3], n[4], n[5])
        else if (c === 'Z') ctx.closePath()
      }
    }
    ctx.globalAlpha = alpha
    if (s.fill) {
      ctx.fillStyle = s.fill
      ctx.fill()
    }
    if (s.stroke) {
      ctx.strokeStyle = s.stroke
      ctx.lineWidth = s.width ?? 1
      ctx.setLineDash(s.dash || [])
      ctx.stroke()
    }
    ctx.restore()
  }
  ctx.restore()
}

// ── legend ───────────────────────────────────────────────────────────────────

export interface LegendRow {
  /** i18n id under `fingerprint.legend.*`. */
  id:
    | 'rings'
    | 'petals'
    | 'shape'
    | 'symmetry'
    | 'rosette'
    | 'core'
    | 'threads'
    | 'halo'
    | 'satellites'
    | 'tints'
  /** Primary number for the row's {n} placeholder. */
  n: number
  /** Optional secondary value ({m}). */
  m?: number | string
}

/** What encodes what, with this tree's numbers. */
export function mandalaLegend(f: FingerprintFeatures): LegendRow[] {
  const gens = Array.isArray(f?.generations) ? f.generations : []
  const rows: LegendRow[] = [
    { id: 'rings', n: gens.length, m: f?.people || 0 },
    { id: 'petals', n: f?.families || 0 },
    { id: 'shape', n: Math.round((f?.branchMean || 0) * 10) / 10 },
    { id: 'symmetry', n: clamp(f?.founderLines || 0, 3, 16), m: f?.founderLines || 0 },
    { id: 'rosette', n: f?.couples || 0, m: f?.remarried || 0 },
    {
      id: 'core',
      n: f?.gender?.known ? Math.round((1 - f.gender.mean) * 100) : 0,
      m: f?.gender?.known ? Math.round(f.gender.mean * 100) : 0
    },
    { id: 'threads', n: f?.social || 0 },
    {
      id: 'halo',
      n: f?.span ? Math.floor(f.span.to / 10) - Math.floor(f.span.from / 10) + 1 : 0,
      m: f?.span ? `${f.span.from}–${f.span.to}` : ''
    },
    { id: 'satellites', n: (f?.islands || []).length, m: f?.loners || 0 },
    { id: 'tints', n: (f?.tagColors || []).length, m: f?.tagCount || 0 }
  ]
  return rows
}
