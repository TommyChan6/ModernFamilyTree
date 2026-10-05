// Spotlight layout — the main character at centre stage, everyone else on
// concentric rings by how close they are to them (pure math; no D3/Three/store
// dependency — tests: tests/spotlightLayout.test.js).
//
// Closeness comes from the kinship lens (components/kinship/kinshipGraph.ts):
//   ring 1  Inner circle     spouse · parents · children · siblings
//   ring 2  Close family     grandparents/-children · aunts, uncles, nieces,
//                            nephews · parents/siblings/children-in-law ·
//                            step-family · direct friends, mentors, rivals…
//   ring 3  Extended family  first cousins · great-grandparents · great-uncles…
//   ring 4+ Distant kin      removed / second cousins, far in-laws, then
//                            anyone reachable, by link distance
//   outer   Not connected    no path to the main character at all
//
// Around each ring people keep a meaningful bearing, so the family still reads
// as a family: ancestors above, descendants below, the paternal side to the
// left, the maternal side and the spouse's family to the right, older siblings
// left of younger. A small angular relaxation keeps a minimum spacing (a ring
// grows when it's crowded) while staying as close to those bearings as it can.

import type { Kin, KinIndex } from '../kinship/kinshipGraph'
import { isOlder } from '../kinship/kinshipGraph'

export interface SpotlightRing {
  ring: number
  r: number
  label: string
  count: number
  /** where its label pill sits: the middle of the ring's widest empty arc */
  labelAngle: number
}
export interface SpotlightResult {
  targets: Record<string, { x: number; y: number }>
  rings: SpotlightRing[]
  /** person id → ring number (0 = the main character) */
  ringOf: Record<string, number>
}
export interface SpotlightOpts {
  cx?: number
  cy?: number
  /** radius of ring 1 */
  base?: number
  /** minimum gap between consecutive rings */
  ringGap?: number
  /** minimum arc distance between neighbours on a ring (world units) */
  spacing?: number
}

export const RING_LABELS = [
  'Main character',
  'Inner circle',
  'Close family',
  'Extended family',
  'Distant kin',
  'Far reaches',
  'Edge of the story'
]
export const OUTSIDERS_LABEL = 'Not connected'

/** Blood (up, down) → ring. */
export function bloodRing(up: number, down: number): number {
  const hi = Math.max(up, down)
  const lo = Math.min(up, down)
  if (hi <= 1) return 1
  if (lo <= 1 && hi === 2) return 2
  if ((up === 2 && down === 2) || (lo <= 1 && hi === 3)) return 3
  return Math.min(6, Math.max(4, up + down - 2))
}

/** Which ring a relative stands on (null = unconnected). */
export function ringFor(k: Kin | null | undefined): number | null {
  if (!k) return null
  switch (k.kind) {
    case 'self':
      return 0
    case 'spouse':
      return 1
    case 'blood':
      return bloodRing(k.up, k.down)
    case 'step':
    case 'inlaw':
    case 'affine':
      return Math.min(6, bloodRing(k.up, k.down) + 1)
    case 'coparent':
      return 3
    case 'social':
      return 2
    case 'distant':
      return Math.min(6, (k.hops || 2) + 2)
  }
}

function hash01(id: string) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

/** The bearing (radians, screen space: 0 = right, −π/2 = up) a relative
 *  prefers around the main character. */
export function preferredAngle(index: KinIndex, mainId: string, id: string, k: Kin): number {
  const sexAt = (pid: string | undefined) => (pid ? index.sex.get(pid) || 'x' : 'x')
  const sideOfSex = (s: string) => (s === 'm' ? -1 : s === 'f' ? 1 : 0)
  let gen = 0
  let side = 0
  switch (k.kind) {
    case 'blood': {
      gen = k.up - k.down
      if (k.up === 1 && k.down === 1) {
        // Siblings: older to the left, younger to the right.
        const o = isOlder(index, id, mainId)
        side = o == null ? hash01(id) * 2 - 1 : o ? -1 : 1
      } else if (k.up >= 1) side = sideOfSex(sexAt(k.upPath[1]))
      else {
        // Descendants fan out below by birth order of the main character's child.
        const kids = (index.children.get(mainId) || []).map((c) => c.id)
        const via = k.downPath[1]
        const idx = Math.max(0, kids.indexOf(via))
        side = kids.length > 1 ? (idx / (kids.length - 1)) * 1.6 - 0.8 : 0
      }
      break
    }
    case 'spouse':
      side = 1
      break
    case 'inlaw':
    case 'coparent':
      gen = k.kind === 'inlaw' ? k.up - k.down : 0
      side = 1.6
      break
    case 'affine':
      gen = k.up - k.down
      side = k.up >= 1 ? sideOfSex(sexAt(k.upPath[1])) : 0.4
      break
    case 'step':
      gen = k.up - k.down
      side = -0.6
      break
    default:
      // Social / distant: spread around the sides at eye level.
      return Math.PI * 2 * hash01(id) - Math.PI
  }
  if (side === 0 && gen === 0) side = hash01(id) > 0.5 ? 1 : -1
  if (side === 0) side = (hash01(id) - 0.5) * 0.6
  return Math.atan2(-gen, side)
}

const TAU = Math.PI * 2
const wrap = (a: number) => ((a % TAU) + TAU) % TAU

/** Spread angles around a ring: keep each near its bearing, but never closer
 *  than `minSep` (relaxed with circular pushes). Returns angles in input order. */
export function relaxAngles(prefs: number[], minSep: number): number[] {
  const n = prefs.length
  if (!n) return []
  if (n === 1) return [prefs[0]]
  const sep = Math.min(minSep, TAU / n)
  const order = prefs.map((a, i) => ({ a: wrap(a), i })).sort((x, y) => x.a - y.a)
  const ang = order.map((o) => o.a)
  for (let it = 0; it < 60; it++) {
    let moved = false
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n
      let gap = ang[k] - ang[j]
      if (k === 0) gap += TAU
      if (gap < sep - 1e-6) {
        const push = (sep - gap) / 2
        ang[j] -= push
        ang[k] += push
        moved = true
      }
    }
    if (!moved) break
  }
  const out = new Array(n)
  order.forEach((o, j) => (out[o.i] = ang[j]))
  return out
}

/**
 * Lay everyone out around `mainId`. `lens` is kinshipLens(index, mainId).
 */
export function computeSpotlightLayout(
  ids: string[],
  mainId: string,
  index: KinIndex,
  lens: Map<string, Kin>,
  opts: SpotlightOpts = {}
): SpotlightResult {
  const cx = opts.cx ?? 0
  const cy = opts.cy ?? 0
  const base = opts.base ?? 170
  const ringGap = opts.ringGap ?? 130
  const spacing = opts.spacing ?? 92

  const byRing = new Map<number, { id: string; pref: number }[]>()
  const ringOf: Record<string, number> = {}
  let maxRing = 0
  const outsiders: string[] = []
  for (const id of ids) {
    if (id === mainId) continue
    const k = lens.get(id)
    const r = ringFor(k)
    if (r == null || !k) {
      outsiders.push(id)
      continue
    }
    const ring = Math.max(1, r)
    maxRing = Math.max(maxRing, ring)
    if (!byRing.has(ring)) byRing.set(ring, [])
    byRing.get(ring)!.push({ id, pref: preferredAngle(index, mainId, id, k) })
  }

  const targets: Record<string, { x: number; y: number }> = {}
  const rings: SpotlightRing[] = []
  if (ids.includes(mainId)) {
    targets[mainId] = { x: cx, y: cy }
    ringOf[mainId] = 0
  }
  let prevR = 0
  const used = [...byRing.keys()].sort((a, b) => a - b)
  for (const ring of used) {
    const people = byRing.get(ring)!
    // Radius: at least its natural step, at least one gap past the previous
    // ring, and big enough that everyone fits at the minimum spacing.
    const r = Math.max(
      base + (ring - 1) * ringGap * 0.85,
      prevR + ringGap,
      (people.length * spacing) / TAU
    )
    prevR = r
    const ang = relaxAngles(
      people.map((p) => p.pref),
      spacing / r
    )
    people.forEach((p, i) => {
      targets[p.id] = { x: cx + Math.cos(ang[i]) * r, y: cy + Math.sin(ang[i]) * r }
      ringOf[p.id] = ring
    })
    rings.push({
      ring,
      r,
      label: RING_LABELS[Math.min(ring, RING_LABELS.length - 1)],
      count: people.length,
      labelAngle: widestGapAngle(ang)
    })
  }
  if (outsiders.length) {
    const ring = maxRing + 1
    const r = Math.max(
      prevR + ringGap * 1.2,
      base + ring * ringGap * 0.85,
      (outsiders.length * spacing) / TAU
    )
    const ang = relaxAngles(
      outsiders.map((id) => hash01(id) * TAU),
      spacing / r
    )
    outsiders.forEach((id, i) => {
      targets[id] = { x: cx + Math.cos(ang[i]) * r, y: cy + Math.sin(ang[i]) * r }
      ringOf[id] = -1
    })
    rings.push({
      ring: -1,
      r,
      label: OUTSIDERS_LABEL,
      count: outsiders.length,
      labelAngle: widestGapAngle(ang)
    })
  }
  return { targets, rings, ringOf }
}

/** Middle of the widest empty arc between people on a ring (the label's
 *  spot); an empty or single-person ring labels opposite its occupant. */
export function widestGapAngle(angles: number[]): number {
  if (!angles.length) return Math.PI * 0.75
  const a = angles.map(wrap).sort((x, y) => x - y)
  if (a.length === 1) return a[0] + Math.PI
  let best = -1
  let mid = 0
  for (let i = 0; i < a.length; i++) {
    const next = i === a.length - 1 ? a[0] + TAU : a[i + 1]
    const gap = next - a[i]
    if (gap > best) {
      best = gap
      mid = a[i] + gap / 2
    }
  }
  return mid
}

/** Default main character: the most connected person (ties → first). */
export function defaultMainCharacter(index: KinIndex, ids: string[]): string | null {
  let best: string | null = null
  let bestDeg = -1
  for (const id of ids) {
    const d = index.adj.get(id)?.size || 0
    if (d > bestDeg) {
      bestDeg = d
      best = id
    }
  }
  return best
}
