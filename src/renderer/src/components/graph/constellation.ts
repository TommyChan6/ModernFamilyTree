// Constellation / night-sky skin — the pure math behind the `star` node shape.
//
// People are stars: a star's MAGNITUDE (0 dim … 1 brightest) grows with how
// many descendants that person has, on a log scale so a patriarch with 200
// descendants is the brightest star in the sky without blowing everyone else
// out. Departed people twinkle (the shader animates that off its clock).
// No THREE / Vue / store imports: GraphCanvas feeds it the kinship index's
// children map, NodeLayer packs its output into a free slot of iState.

/** A child edge as the kinship index stores it (only the id matters here). */
interface ChildLink {
  id: string
}

/** Descendant count at which a star reaches full magnitude. Log-scaled, so
 *  1 child already shows, ~a dozen reads bright and 64+ saturates. */
export const STAR_FULL_AT = 64

/**
 * Distinct descendants of every person, following parent → child edges
 * (`children`: the kinship index's map — vertical symmetryRole edges, so
 * adoptive lines count too). Cycles (bad data) can't loop: each walk keeps
 * its own visited stamp. People missing from `children` get 0.
 */
export function descendantCounts(
  ids: Iterable<string>,
  children: Map<string, ChildLink[]>
): Map<string, number> {
  const list = [...ids]
  const index = new Map<string, number>()
  list.forEach((id, i) => index.set(id, i))
  // Adjacency as integer lists, once.
  const kids: number[][] = list.map((id) => {
    const out: number[] = []
    for (const c of children.get(id) || []) {
      const j = index.get(c.id)
      if (j != null) out.push(j)
    }
    return out
  })
  const stamp = new Int32Array(list.length).fill(-1)
  const stack: number[] = []
  const counts = new Map<string, number>()
  for (let i = 0; i < list.length; i++) {
    let n = 0
    if (kids[i].length) {
      stamp[i] = i // never count yourself (a cycle back to the root)
      stack.length = 0
      for (const k of kids[i]) stack.push(k)
      while (stack.length) {
        const v = stack.pop() as number
        if (stamp[v] === i) continue
        stamp[v] = i
        n++
        for (const k of kids[v]) if (stamp[k] !== i) stack.push(k)
      }
    }
    counts.set(list[i], n)
  }
  return counts
}

/** Descendant count → star magnitude 0..1 (log scale, saturating at
 *  STAR_FULL_AT). Non-finite / negative counts read as 0. */
export function starMagnitude(count: number, fullAt = STAR_FULL_AT): number {
  const c = Number.isFinite(count) && count > 0 ? count : 0
  const k = Math.log2(1 + c) / Math.log2(1 + Math.max(1, fullAt))
  return Math.max(0, Math.min(1, k))
}

/** Magnitude → node radius multiplier: the faintest star is a little smaller
 *  than a normal node, the brightest 1.7× (the bloom and spikes then have
 *  room to reach out). */
export function starSizeMul(k: number): number {
  const m = Math.max(0, Math.min(1, Number.isFinite(k) ? k : 0))
  return 0.9 + 0.8 * Math.sqrt(m)
}

/** Magnitude levels the shader can tell apart (packed as an integer). */
export const STAR_LEVELS = 1023

/**
 * Pack (selected, magnitude, twinkle) into ONE float — iState.x, which used to
 * hold just selected 0/1. The node shader sits at the vertex-attribute limit
 * (desktop ANGLE/D3D11 spends a slot on gl_InstanceID), so the star rides in
 * an existing attribute: x = selected + 2·(twinkle + 2·level). Every value is
 * a small integer (≤ 4095), exact in float32; non-star nodes pack to 0 / 1.
 */
export function packStarState(selected: boolean, k: number | null = null, twinkle = false): number {
  const sel = selected ? 1 : 0
  if (k == null) return sel
  const level = Math.round(Math.max(0, Math.min(1, Number.isFinite(k) ? k : 0)) * STAR_LEVELS)
  return sel + 2 * ((twinkle ? 1 : 0) + 2 * level)
}

/** Inverse of packStarState — mirrors the vertex shader's decode (tests). */
export function unpackStarState(x: number): { selected: boolean; k: number; twinkle: boolean } {
  const code = Math.floor(x * 0.5 + 0.01)
  const sel = x - 2 * code
  const level = Math.floor(code * 0.5 + 0.01)
  const tw = code - 2 * level
  return { selected: sel > 0.5, k: level / STAR_LEVELS, twinkle: tw > 0.5 }
}

/** The GLSL decode of packStarState, for the node vertex shader. Expects
 *  `iState`; writes `vSelected` and `vStar` (magnitude, twinkle). */
export const STAR_DECODE_GLSL = /* glsl */ `
        float stCode = floor(iState.x * 0.5 + 0.01);
        vSelected = iState.x - 2.0 * stCode;
        float stLevel = floor(stCode * 0.5 + 0.01);
        vStar = vec2(stLevel / ${STAR_LEVELS.toFixed(1)}, stCode - 2.0 * stLevel);
`
