// Pure time-axis warp for the Timeline: "stretch time where births cluster".
//
// A fisheye on time. From the years that matter (births, optionally deaths /
// events, each with a weight) it builds a monotone, invertible piecewise-linear
// mapping year → axis year over the layout's [lo, hi] span:
//
//   - a histogram on a uniform year grid, smoothed by a Gaussian kernel (a
//     bandwidth of a few years), gives the local density of moments;
//   - each bin's stretch factor follows that density (dense → wide, empty →
//     narrow), clamped to [minStretch, maxStretch] so an empty century never
//     collapses to nothing and one crowded year never explodes;
//   - the factors are normalised so they average exactly 1 — the warped axis
//     spans exactly as many "axis years" as the real one (fit, minimap and the
//     camera clamp keep working unchanged).
//
// `k` (0..1, the toggle tweened by strength) blends the warp with the identity:
// axis = year + k·(W(year) − year). A convex blend of two increasing functions
// with slopes on either side of 1 stays strictly increasing, so the blended
// map is invertible for every k, and its local stretch stays inside
// [min(1, minStretch), max(1, maxStretch)].
//
// The knots are uniform in year, so warpYear is O(1); unwarpYear binary-searches
// the blended axis knots, O(log n). Outside [lo, hi] the axis continues with
// slope 1 (W(lo) = lo, W(hi) = hi, so that is continuous). No DOM, no store.

export interface TimeWarp {
  /** Domain start / end (the layout's minYear / maxYear). */
  lo: number
  hi: number
  /** Bin width in years (knot spacing). */
  step: number
  /** Knot axis positions at full strength; ys[0] = lo, ys[n] = hi. */
  ys: Float64Array
  /** No data / degenerate span: the identity map. */
  identity: boolean
}

export interface TimeWarpOptions {
  /** Per-year weights (same length as years); default 1 each. */
  weights?: number[]
  /** Gaussian kernel σ in years (default: a few years, wider for long spans). */
  bandwidth?: number
  /** Narrowest local stretch (empty stretches of time). */
  minStretch?: number
  /** Widest local stretch (the busiest years). */
  maxStretch?: number
  /** Density → stretch exponent (< 1 softens the contrast). */
  gamma?: number
  /** Most bins to use (long spans get coarser bins). */
  maxBins?: number
}

export const WARP_MIN_STRETCH = 0.25
export const WARP_MAX_STRETCH = 4

const IDENTITY = (lo: number, hi: number): TimeWarp => ({
  lo,
  hi,
  step: 1,
  ys: new Float64Array([lo, hi]),
  identity: true
})

/** Build the warp for these years over [lo, hi]. */
export function buildTimeWarp(
  years: number[],
  lo: number,
  hi: number,
  opts: TimeWarpOptions = {}
): TimeWarp {
  const span = hi - lo
  if (!(span > 0) || !Number.isFinite(span)) return IDENTITY(lo, hi)
  const minF = Math.min(1, Math.max(0.01, opts.minStretch ?? WARP_MIN_STRETCH))
  const maxF = Math.max(1, opts.maxStretch ?? WARP_MAX_STRETCH)
  const gamma = opts.gamma ?? 0.8
  const maxBins = Math.max(8, Math.floor(opts.maxBins ?? 2048))
  const bins = Math.max(1, Math.min(maxBins, Math.ceil(span)))
  const step = span / bins

  // Histogram (fractional years land in their bin; out-of-range ones ignored).
  const hist = new Float64Array(bins)
  let total = 0
  for (let i = 0; i < years.length; i++) {
    const y = years[i]
    if (!Number.isFinite(y) || y < lo || y > hi) continue
    const w = opts.weights ? opts.weights[i] : 1
    if (!(w > 0)) continue
    const b = Math.min(bins - 1, Math.floor((y - lo) / step))
    hist[b] += w
    total += w
  }
  if (!(total > 0)) return IDENTITY(lo, hi)

  // Gaussian smoothing (truncated at ±3σ, renormalised at the ends so the
  // edges are not starved).
  const sigma = Math.max(step * 0.75, opts.bandwidth ?? Math.min(8, Math.max(2.5, span / 120)))
  const sb = sigma / step // σ in bins
  const R = Math.max(1, Math.ceil(sb * 3))
  const kern = new Float64Array(R * 2 + 1)
  for (let j = -R; j <= R; j++) kern[j + R] = Math.exp(-(j * j) / (2 * sb * sb))
  const dens = new Float64Array(bins)
  for (let i = 0; i < bins; i++) {
    let s = 0,
      wsum = 0
    for (let j = -R; j <= R; j++) {
      const q = i + j
      if (q < 0 || q >= bins) continue
      s += hist[q] * kern[j + R]
      wsum += kern[j + R]
    }
    dens[i] = wsum > 0 ? s / wsum : 0
  }

  // Raw stretch: density^γ over a small floor (so sparse-but-not-empty time
  // isn't treated as empty), then a scale c with mean(clamp(c·raw)) = 1.
  let meanP = 0
  const raw = new Float64Array(bins)
  for (let i = 0; i < bins; i++) {
    raw[i] = Math.pow(dens[i], gamma)
    meanP += raw[i]
  }
  meanP /= bins
  if (!(meanP > 0)) return IDENTITY(lo, hi)
  for (let i = 0; i < bins; i++) raw[i] += 0.1 * meanP
  const meanAt = (c: number) => {
    let s = 0
    for (let i = 0; i < bins; i++) s += Math.min(maxF, Math.max(minF, c * raw[i]))
    return s / bins
  }
  // mean(c) is continuous and non-decreasing from minF (c → 0) to maxF (c → ∞),
  // and minF ≤ 1 ≤ maxF, so bisection finds mean = 1.
  let a = 0,
    b = 1 / meanP
  while (meanAt(b) < 1 && b < 1e12) b *= 2
  for (let it = 0; it < 60; it++) {
    const m = (a + b) / 2
    if (meanAt(m) < 1) a = m
    else b = m
  }
  const c = (a + b) / 2
  const f = new Float64Array(bins)
  let sum = 0
  for (let i = 0; i < bins; i++) {
    f[i] = Math.min(maxF, Math.max(minF, c * raw[i]))
    sum += f[i]
  }
  // Exact span preservation: spread the bisection's last rounding error
  // proportionally (a factor ~1 ± 1e-12, so the clamps still hold).
  const fix = bins / sum
  const ys = new Float64Array(bins + 1)
  ys[0] = lo
  for (let i = 0; i < bins; i++) ys[i + 1] = ys[i] + f[i] * fix * step
  ys[bins] = hi
  return { lo, hi, step, ys, identity: false }
}

/** Axis position of a (fractional) year at blend k (0 = linear). */
export function warpYear(w: TimeWarp | null, year: number, k = 1): number {
  if (!w || w.identity || !(k > 0) || !(year > w.lo) || !(year < w.hi)) return year
  const n = w.ys.length - 1
  const u = (year - w.lo) / w.step
  const i = Math.min(n - 1, Math.floor(u))
  const t = u - i
  const full = w.ys[i] + (w.ys[i + 1] - w.ys[i]) * t
  return year + k * (full - year)
}

/** The year at an axis position — the exact inverse of warpYear(·, k). */
export function unwarpYear(w: TimeWarp | null, axis: number, k = 1): number {
  if (!w || w.identity || !(k > 0) || !(axis > w.lo) || !(axis < w.hi)) return axis
  const n = w.ys.length - 1
  const at = (i: number) => {
    const x = w.lo + i * w.step
    return x + k * (w.ys[i] - x)
  }
  // largest i with at(i) <= axis
  let lo = 0,
    hi = n
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (at(mid) <= axis) lo = mid
    else hi = mid
  }
  const a0 = at(lo),
    a1 = at(lo + 1)
  const t = a1 > a0 ? (axis - a0) / (a1 - a0) : 0
  return w.lo + (lo + t) * w.step
}

/** Local stretch d(axis)/d(year) at a year (1 = linear there). */
export function warpSlope(w: TimeWarp | null, year: number, k = 1): number {
  if (!w || w.identity || !(k > 0) || !(year >= w.lo) || !(year < w.hi)) return 1
  const n = w.ys.length - 1
  const i = Math.min(n - 1, Math.max(0, Math.floor((year - w.lo) / w.step)))
  const full = (w.ys[i + 1] - w.ys[i]) / w.step
  return 1 + k * (full - 1)
}

/** The narrowest and widest local stretch over [y0, y1] at blend k. */
export function warpSlopeRange(
  w: TimeWarp | null,
  y0: number,
  y1: number,
  k = 1
): { min: number; max: number } {
  if (!w || w.identity || !(k > 0)) return { min: 1, max: 1 }
  const n = w.ys.length - 1
  const a = Math.max(0, Math.floor((Math.min(y0, y1) - w.lo) / w.step))
  const b = Math.min(n - 1, Math.floor((Math.max(y0, y1) - w.lo) / w.step))
  let min = Infinity,
    max = -Infinity
  // outside the domain the axis is linear
  if (Math.min(y0, y1) < w.lo || Math.max(y0, y1) > w.hi) min = max = 1
  for (let i = a; i <= b; i++) {
    const s = 1 + k * ((w.ys[i + 1] - w.ys[i]) / w.step - 1)
    if (s < min) min = s
    if (s > max) max = s
  }
  if (!Number.isFinite(min)) return { min: 1, max: 1 }
  return { min, max }
}

/** Tick steps (years) a warped axis picks from — the linear axis's ladder. */
export const WARP_TICK_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000, 2000, 5000]

/**
 * Year ticks for a warped axis between years [y0, y1]: each tick sits on a
 * multiple of the step its own stretch of time can afford (the smallest step
 * whose span on the axis is ≥ minPx at `pxPerAxisYear`), so stretched decades
 * get yearly rules while squeezed centuries keep sparse ones; a tick crowding
 * the previous one (where the step changes) is dropped. Returns parallel
 * arrays of tick years and the step each was chosen at (labels stay real).
 */
export function warpTicks(
  w: TimeWarp | null,
  y0: number,
  y1: number,
  pxPerAxisYear: number,
  k = 1,
  minPx = 46,
  maxTicks = 600
): { years: number[]; steps: number[] } {
  const L = WARP_TICK_STEPS
  const px = Math.max(1e-9, pxPerAxisYear)
  const ax = (y: number) => warpYear(w, y, k)
  const stepAt = (y: number) => {
    const a = ax(y)
    return L.find((s) => (ax(y + s) - a) * px >= minPx) ?? L[L.length - 1]
  }
  // Candidates on a grid every step is a multiple of (1, 5 or 50 years).
  const range = warpSlopeRange(w, y0, y1, k)
  const fine = L.find((s) => s * px * range.max >= minPx) ?? L[L.length - 1]
  const grid = fine < 5 ? 1 : fine < 50 ? 5 : 50
  const years: number[] = []
  const steps: number[] = []
  const first = Math.floor(y0 / grid) * grid
  let lastAx = -Infinity
  let guard = 0
  for (let y = first; y <= y1 + grid && years.length < maxTicks && guard++ < 50000; y += grid) {
    const s = stepAt(y)
    if (Math.abs(y % s) > 1e-9) continue
    const a = ax(y)
    if ((a - lastAx) * px < minPx * 0.6) continue
    years.push(y)
    steps.push(s)
    lastAx = a
  }
  return { years, steps }
}
