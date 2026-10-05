// Pure morph math for the 3D human: which MakeHuman targets fire at what
// weight for a given set of sliders, and summing them onto the base mesh.
// The macro rules mirror MakeHuman 1.1's (apps/humanmodifier.py) so shapes
// match what that tool produces, minus the infant targets we don't ship (the
// age slider bottoms out at 11 years). No THREE / DOM here.
//
// Tests: tests/human3dMath.test.js

import type { HumanTarget } from './humanAsset'

/** The macro sliders, all 0..1 except ages in years. */
export interface MacroState {
  /** 0 = female … 1 = male. */
  gender: number
  /** Years, 11..90. */
  age: number
  muscle: number
  weight: number
  height: number
  proportions: number
  /** Ancestry blend — normalized to sum 1 before use. */
  african: number
  asian: number
  caucasian: number
  breastSize: number
  breastFirmness: number
}

export const MIN_AGE = 11
export const MAX_AGE = 90

/** Years → MakeHuman's 0..1 age (11y = 0.1875, 25y = 0.5, 90y = 1). */
export function ageToMH(years: number): number {
  const y = Math.min(MAX_AGE, Math.max(MIN_AGE, years))
  return y < 25 ? 0.1875 + ((y - 11) / 14) * 0.3125 : 0.5 + ((y - 25) / 65) * 0.5
}

/** A 0..1 slider split over three anchors: [low, mid, high] weights. */
export function triWeights(v: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, v))
  if (x < 0.5) {
    const lo = 1 - x * 2
    return [lo, 1 - lo, 0]
  }
  const hi = x * 2 - 1
  return [0, 1 - hi, hi]
}

function ageWeights(years: number): Record<string, number> {
  const a = ageToMH(years)
  if (a < 0.5) {
    const young = Math.max(0, (a - 0.1875) * 3.2)
    return { child: 1 - young, young, old: 0 }
  }
  const old = Math.max(0, a * 2 - 1)
  return { child: 0, young: 1 - old, old }
}

const EPS = 1e-4

/** Target name → weight for the macro sliders (zero weights omitted). */
export function macroTargetWeights(m: MacroState): Map<string, number> {
  const out = new Map<string, number>()
  const add = (name: string, w: number) => {
    if (w > EPS) out.set(name, (out.get(name) || 0) + w)
  }
  const g = Math.min(1, Math.max(0, m.gender))
  const genders: Record<string, number> = { female: 1 - g, male: g }
  const ages = ageWeights(m.age)
  const [minM, avgM, maxM] = triWeights(m.muscle)
  const [minW, avgW, maxW] = triWeights(m.weight)
  const muscles: Record<string, number> = {
    minmuscle: minM,
    averagemuscle: avgM,
    maxmuscle: maxM
  }
  const weights: Record<string, number> = { minweight: minW, averageweight: avgW, maxweight: maxW }
  const [minH, , maxH] = triWeights(m.height)
  const [uncommon, , ideal] = triWeights(m.proportions)
  const [minCup, avgCup, maxCup] = triWeights(m.breastSize)
  const [minF, avgF, maxF] = triWeights(m.breastFirmness)
  const cups: Record<string, number> = { mincup: minCup, averagecup: avgCup, maxcup: maxCup }
  const firms: Record<string, number> = {
    minfirmness: minF,
    averagefirmness: avgF,
    maxfirmness: maxF
  }

  const raceSum = Math.max(EPS, m.african + m.asian + m.caucasian)
  const races: Record<string, number> = {
    african: Math.max(0, m.african) / raceSum,
    asian: Math.max(0, m.asian) / raceSum,
    caucasian: Math.max(0, m.caucasian) / raceSum
  }

  for (const [gk, gw] of Object.entries(genders)) {
    if (gw <= EPS) continue
    for (const [ak, aw] of Object.entries(ages)) {
      if (aw <= EPS) continue
      const ga = gw * aw
      for (const [rk, rw] of Object.entries(races)) add(`macro/${rk}-${gk}-${ak}`, ga * rw)
      for (const [mk, mw] of Object.entries(muscles)) {
        for (const [wk, ww] of Object.entries(weights)) {
          // average/average is the neutral body: MakeHuman ships it empty
          if (mk === 'averagemuscle' && wk === 'averageweight') continue
          add(`macro/universal-${gk}-${ak}-${mk}-${wk}`, ga * mw * ww)
        }
      }
      // Height/proportions ship at average muscle+weight only (build.py)
      const base = `${gk}-${ak}-averagemuscle-averageweight`
      add(`height/${base}-minheight`, ga * minH)
      add(`height/${base}-maxheight`, ga * maxH)
      add(`proportions/${base}-uncommonproportions`, ga * uncommon)
      add(`proportions/${base}-idealproportions`, ga * ideal)
      // bust shaping exists for the female body only (as in MakeHuman)
      if (gk !== 'female') continue
      for (const [ck, cw] of Object.entries(cups)) {
        for (const [fk, fw] of Object.entries(firms)) {
          if (ck === 'averagecup' && fk === 'averagefirmness') continue
          add(`breast/${base}-${ck}-${fk}`, ga * cw * fw)
        }
      }
    }
  }
  return out
}

/** A bipolar modifier: −1..1 drives `min` (negative) or `max` (positive). */
export interface ModifierDef {
  id: string
  min?: string
  max: string
}

/** Add one modifier's target weights to `out`. */
export function addModifier(out: Map<string, number>, def: ModifierDef, value: number) {
  const v = Math.max(-1, Math.min(1, value || 0))
  if (Math.abs(v) < EPS) return
  const name = v < 0 ? def.min : def.max
  if (!name) return
  out.set(name, (out.get(name) || 0) + Math.abs(v))
}

/**
 * positions = base + Σ weight · delta (decimetres). Unknown target names are
 * skipped, so a doc authored against a richer asset still loads.
 */
export function applyTargets(
  base: Float32Array,
  targets: Map<string, HumanTarget>,
  weights: Map<string, number>,
  out: Float32Array
): Float32Array {
  out.set(base)
  for (const [name, w] of weights) {
    const t = targets.get(name)
    if (!t || !w) continue
    const s = t.scale * w
    const { idx, d } = t
    for (let i = 0; i < idx.length; i++) {
      const o = idx[i] * 3
      out[o] += d[i * 3] * s
      out[o + 1] += d[i * 3 + 1] * s
      out[o + 2] += d[i * 3 + 2] * s
    }
  }
  return out
}

/** A target's dense delta (decimetres) — for GPU morph attributes. */
export function targetDelta(t: HumanTarget, vertexCount: number): Float32Array {
  const out = new Float32Array(vertexCount * 3)
  for (let i = 0; i < t.idx.length; i++) {
    const o = t.idx[i] * 3
    out[o] = t.d[i * 3] * t.scale
    out[o + 1] = t.d[i * 3 + 1] * t.scale
    out[o + 2] = t.d[i * 3 + 2] * t.scale
  }
  return out
}
