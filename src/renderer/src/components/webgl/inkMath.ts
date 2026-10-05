// 水墨 — pure math shared by the Ink-theme looks of the WebGL views (timeline,
// groups). No Three.js, no DOM, no store: colour mixing, the brush write-on
// timing (mirrored by the GLSL in InkStrokeLayer / InkThreadLayer), the
// sexagenary-cycle year names and the heavier "decade" rules of the year grid.

export type RGB = [number, number, number]

/** 墨 ink black and 宣纸 paper as linear 0..1 RGB (sRGB values, like THREE.Color.set). */
export const INK_RGB: RGB = [0x1c / 255, 0x1a / 255, 0x17 / 255]
export const PAPER_RGB: RGB = [0xef / 255, 0xe7 / 255, 0xd4 / 255]
export const CINNABAR_RGB: RGB = [0xb3 / 255, 0x35 / 255, 0x2a / 255]

/**
 * Turn a UI colour into a mineral pigment ground into ink: desaturate it toward
 * its own luminance (`sat` keeps that share of the chroma), then mix it toward
 * ink black by `ink`. Gender / tag colours stay recognisable, but read as
 * 花青 / 赭石 washes instead of screen-bright fills.
 */
export function inkPigment(rgb: RGB, { sat = 0.45, ink = 0.35 } = {}): RGB {
  const l = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114
  const out: RGB = [0, 0, 0]
  for (let i = 0; i < 3; i++) {
    const d = l + (rgb[i] - l) * sat
    out[i] = d + (INK_RGB[i] - d) * ink
  }
  return out
}

/** sRGB 0..1 triple of a CSS hex colour (#rgb / #rrggbb); grey when unparseable.
 *  (THREE.Color.set would convert to linear — the ink shaders want raw sRGB.) */
export function hexToRgb01(hex: string): RGB {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim())
  if (!m) return [0.53, 0.53, 0.53]
  let s = m[1]
  if (s.length === 3) s = s.replace(/./g, (c) => c + c)
  const n = parseInt(s, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** CSS hex of an RGB triple (0..1). */
export function rgbToHex(rgb: RGB): string {
  return (
    '#' +
    rgb
      .map((v) =>
        Math.round(Math.min(1, Math.max(0, v)) * 255)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  )
}

// ── Brush write-on timing ────────────────────────────────────────────────────

/** Ease of a brush tip travelling its stroke: quick start, settling stop. */
export function writeEase(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return 1 - (1 - c) * (1 - c)
}

/** Inverse of writeEase: the linear time fraction at which the tip reaches `f`. */
export function writeEaseInv(f: number): number {
  const c = Math.min(1, Math.max(0, f))
  return 1 - Math.sqrt(1 - c)
}

export interface WriteSlot {
  /** seconds after the write begins */
  start: number
  /** seconds the tip takes to travel the stroke */
  dur: number
}

export interface WritePerson {
  id: string
  laneX: number
  birthYear: number
  endYear: number
}

/**
 * When each lifeline is written: lanes are brushed left→right like a scroll
 * being inscribed, each stroke's duration grows with its length (a long life
 * is a long stroke), and the whole sheet finishes within `spread + maxDur`
 * seconds however many people there are.
 */
export function inkWriteSchedule(
  people: WritePerson[],
  { spread = 1.5, perLane = 0.09, minDur = 0.55, maxDur = 1.25, perYear = 0.011 } = {}
): Map<string, WriteSlot> {
  const out = new Map<string, WriteSlot>()
  if (!people.length) return out
  const order = people.slice().sort((a, b) => a.laneX - b.laneX)
  const step = order.length > 1 ? Math.min(perLane, spread / (order.length - 1)) : 0
  order.forEach((p, i) => {
    const years = Math.max(0, p.endYear - p.birthYear)
    const dur = Math.min(maxDur, Math.max(minDur, minDur + years * perYear))
    out.set(p.id, { start: i * step, dur })
  })
  return out
}

/** Seconds (relative to the schedule) at which a stroke's tip reaches `year`. */
export function writeArrival(slot: WriteSlot, birthYear: number, endYear: number, year: number) {
  const span = endYear - birthYear
  const f = span > 0 ? (year - birthYear) / span : 1
  return slot.start + slot.dur * writeEaseInv(f)
}

// ── Year grid ────────────────────────────────────────────────────────────────

const MAJOR_STEPS = [10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000]

/** The heavier rule spacing for a tick step: decades for yearly ticks, then
 *  half-centuries, centuries… always a multiple of the step, ≥ 4 steps apart. */
export function majorStep(step: number): number {
  for (const m of MAJOR_STEPS) if (m >= step * 4 && m % step === 0) return m
  return step * 10
}

export function isMajorYear(year: number, step: number): boolean {
  const m = majorStep(step)
  return ((year % m) + m) % m === 0
}

const STEMS = '甲乙丙丁戊己庚辛壬癸'
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'

/** The 干支 sexagenary name of a (proleptic Gregorian, astronomical) year:
 *  1984 → 甲子, 2024 → 甲辰. Year 0 = 1 BCE, so −1 = 2 BCE. */
export function ganzhi(year: number): string {
  const y = Math.floor(year)
  const i = (((y - 4) % 60) + 60) % 60
  return STEMS[i % 10] + BRANCHES[i % 12]
}

/** Horizontal offset (px) of a tiling backdrop strip of width `tileW` for a
 *  camera translation `tx`, scrolled at `factor` of the pan speed. Always in
 *  (-tileW, 0] so drawing from there covers the screen with whole tiles. */
export function parallaxOffset(tx: number, factor: number, tileW: number): number {
  if (!(tileW > 0)) return 0
  const o = (tx * factor) % tileW
  return o > 0 ? o - tileW : o === 0 ? 0 : o
}
