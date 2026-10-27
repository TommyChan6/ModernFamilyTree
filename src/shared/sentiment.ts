// Relationship dynamics — the sentiment layer (WILD_IDEAS A3).
//
// Every relationship type carries a `sentiment` (−1 cold … +1 warm) and every
// edge may override it, plus an `intensity` (0 faint … 1 strong). The graph's
// Dynamics lens recolours links on a diverging cold→neutral→warm ramp and
// sizes them by intensity; a person's "temperature" is the intensity-weighted
// mean sentiment of their bonds. Pure: no Vue / Three / store imports, so the
// shared core, the renderer and the tests all use the same math.

/** Default sentiment of the built-in relationship types (by key). */
export const BUILTIN_SENTIMENT: Readonly<Record<string, number>> = {
  parent_child: 0.5,
  adopted: 0.5,
  spouse: 0.9,
  sibling: 0.4,
  partner: 0.8,
  friends: 0.6,
  likes: 0.7,
  rival: -0.8,
  mentor: 0.4,
  subordinate: -0.1
}

/** An edge with no explicit intensity reads as this (moderate) strength. */
export const DEFAULT_INTENSITY = 0.5

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

/** Coerce anything to a finite type sentiment in −1..+1 (garbage → 0). */
export function clampSentiment(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? clamp(n, -1, 1) : 0
}

/** Per-edge sentiment override: null/''/garbage = inherit the type's (null);
 *  otherwise clamped to −1..+1. */
export function coerceEdgeSentiment(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? clamp(n, -1, 1) : null
}

/** Per-edge intensity override: null/''/garbage = the default (null);
 *  otherwise clamped to 0..1. */
export function coerceEdgeIntensity(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? clamp(n, 0, 1) : null
}

interface SentimentDefLike {
  key?: string
  sentiment?: number | null
}
interface SentimentRelLike {
  sentiment?: number | null
  intensity?: number | null
}

/** A type's sentiment; defs saved before the layer existed fall back to the
 *  built-in default for their key (0 for custom types). */
export function typeSentiment(def: SentimentDefLike | null | undefined): number {
  if (!def) return 0
  if (typeof def.sentiment === 'number' && Number.isFinite(def.sentiment))
    return clamp(def.sentiment, -1, 1)
  return (def.key && BUILTIN_SENTIMENT[def.key]) || 0
}

/** The edge's own sentiment when set, else its type's. */
export function effectiveSentiment(
  rel: SentimentRelLike | null | undefined,
  def: SentimentDefLike | null | undefined
): number {
  const own = coerceEdgeSentiment(rel?.sentiment)
  return own ?? typeSentiment(def)
}

/** The edge's own intensity when set, else DEFAULT_INTENSITY. */
export function effectiveIntensity(rel: SentimentRelLike | null | undefined): number {
  return coerceEdgeIntensity(rel?.intensity) ?? DEFAULT_INTENSITY
}

export interface Temperature {
  /** Intensity-weighted mean sentiment −1..+1 (0 when every bond is faint). */
  t: number
  /** Mean intensity of the person's bonds (how strongly they feel). */
  heat: number
  /** Number of bonds counted. */
  n: number
}

interface TempRel extends SentimentRelLike {
  person_a_id: string
  person_b_id: string
  type: string
}

/** Every person's temperature from their bonds. People with no bonds are
 *  absent from the map. `defOf` resolves a relationship's type def. */
export function nodeTemperatures(
  rels: readonly TempRel[],
  defOf: (type: string) => SentimentDefLike | null | undefined
): Map<string, Temperature> {
  const acc = new Map<string, { sw: number; w: number; n: number }>()
  const add = (id: string, s: number, i: number) => {
    let a = acc.get(id)
    if (!a) acc.set(id, (a = { sw: 0, w: 0, n: 0 }))
    a.sw += s * i
    a.w += i
    a.n += 1
  }
  for (const r of rels) {
    const s = effectiveSentiment(r, defOf(r.type))
    const i = effectiveIntensity(r)
    add(r.person_a_id, s, i)
    if (r.person_b_id !== r.person_a_id) add(r.person_b_id, s, i)
  }
  const out = new Map<string, Temperature>()
  for (const [id, a] of acc) {
    out.set(id, { t: a.w > 0 ? clamp(a.sw / a.w, -1, 1) : 0, heat: a.w / a.n, n: a.n })
  }
  return out
}

/** One person's temperature (null when they have no bonds). */
export function personTemperature(
  personId: string,
  rels: readonly TempRel[],
  defOf: (type: string) => SentimentDefLike | null | undefined
): Temperature | null {
  const mine = rels.filter((r) => r.person_a_id === personId || r.person_b_id === personId)
  return nodeTemperatures(mine, defOf).get(personId) ?? null
}

// ── The colour ramp ──────────────────────────────────────────────────────────
// Diverging: cold ← neutral → warm, interpolated in OKLab so the midpoint
// doesn't sag into mud and both halves step evenly in lightness.

export interface DynamicsPalette {
  cold: string
  neutral: string
  warm: string
}

/** Theme defaults: vivid on dark/light, ink-wash tones on 水墨, lapis +
 *  vermilion on the medieval codex. */
export const DYNAMICS_PALETTES: Readonly<Record<string, DynamicsPalette>> = {
  dark: { cold: '#4aa8ff', neutral: '#8a92a6', warm: '#ff8a3d' },
  light: { cold: '#2a72c9', neutral: '#a0a6b2', warm: '#d9561c' },
  ink: { cold: '#4d6a7c', neutral: '#8f877a', warm: '#ad4430' },
  medieval: { cold: '#2c5a8c', neutral: '#94826a', warm: '#b4502a' }
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** True for #rgb / #rrggbb. */
export function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && HEX_RE.test(v.trim())
}

/** The palette for a theme, with the user's warm/cold picks ('' = default). */
export function dynamicsPalette(
  theme: string,
  overrides?: { warm?: string | null; cold?: string | null }
): DynamicsPalette {
  const base = DYNAMICS_PALETTES[theme] || DYNAMICS_PALETTES.dark
  const cold = overrides?.cold
  const warm = overrides?.warm
  return {
    cold: isHexColor(cold) ? normHex(cold) : base.cold,
    neutral: base.neutral,
    warm: isHexColor(warm) ? normHex(warm) : base.warm
  }
}

function normHex(h: string): string {
  let s = h.trim().replace('#', '').toLowerCase()
  if (s.length === 3)
    s = s
      .split('')
      .map((c) => c + c)
      .join('')
  return '#' + s
}

type Vec3 = [number, number, number]

function hexToRgb(h: string): Vec3 {
  const s = normHex(isHexColor(h) ? h : '#808080').slice(1)
  return [
    parseInt(s.slice(0, 2), 16) / 255,
    parseInt(s.slice(2, 4), 16) / 255,
    parseInt(s.slice(4, 6), 16) / 255
  ]
}
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const toGam = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)

function rgbToOklab([r, g, b]: Vec3): Vec3 {
  const lr = toLin(r),
    lg = toLin(g),
    lb = toLin(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ]
}
function oklabToRgb([L, a, b]: Vec3): Vec3 {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3)
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3)
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3)
  return [
    toGam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toGam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toGam(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  ]
}
function rgbToHex([r, g, b]: Vec3): string {
  const h = (c: number) =>
    Math.round(clamp(c, 0, 1) * 255)
      .toString(16)
      .padStart(2, '0')
  return '#' + h(r) + h(g) + h(b)
}

/** Mix two hex colours in OKLab (t = 0 → a, 1 → b). */
export function mixOklab(a: string, b: string, t: number): string {
  const A = rgbToOklab(hexToRgb(a))
  const B = rgbToOklab(hexToRgb(b))
  const k = clamp(t, 0, 1)
  return rgbToHex(
    oklabToRgb([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k])
  )
}

/** The ramp colour for a sentiment: −1 = cold, 0 = neutral, +1 = warm. */
export function sentimentColor(s: number, palette: DynamicsPalette): string {
  const v = clampSentiment(s)
  if (v === 0) return normHex(palette.neutral)
  return mixOklab(palette.neutral, v > 0 ? palette.warm : palette.cold, Math.abs(v))
}

/** A CSS linear-gradient stop list for the ramp (cold → warm, `n` stops). */
export function sentimentGradient(palette: DynamicsPalette, n = 7): string {
  const stops: string[] = []
  for (let i = 0; i < n; i++) {
    const s = -1 + (2 * i) / (n - 1)
    stops.push(`${sentimentColor(s, palette)} ${Math.round((i / (n - 1)) * 100)}%`)
  }
  return stops.join(', ')
}

/** Link width (px) the Dynamics lens draws an edge of this intensity at:
 *  a thread when faint, a cable when strong (default intensity ≈ 2.3px). */
export function dynamicsWidth(intensity: number): number {
  return 0.6 + 3.4 * clamp(Number.isFinite(intensity) ? intensity : DEFAULT_INTENSITY, 0, 1)
}

export type SentimentLevel = 'hostile' | 'cool' | 'neutral' | 'warm' | 'loving'

/** A word-sized bucket for a sentiment (UI labels: `sentiment.levels.*`). */
export function sentimentLevel(s: number): SentimentLevel {
  const v = clampSentiment(s)
  if (v <= -0.6) return 'hostile'
  if (v < -0.15) return 'cool'
  if (v <= 0.15) return 'neutral'
  if (v < 0.6) return 'warm'
  return 'loving'
}
