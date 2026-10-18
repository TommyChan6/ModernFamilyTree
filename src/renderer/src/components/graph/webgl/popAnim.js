// The "pop" a person makes when they first appear on the graph — pure timing
// curves (no Three/canvas). The node's scale runs on the GPU (NodeMaterial
// mirrors popScale in GLSL off the iPop start time); the ripple ring and the
// name's fade-in are drawn by the text overlay from the same clock.

export const POP_DUR = 0.55 // s — node springs from nothing to full size
export const RING_DUR = 0.75 // s — the ripple ring expands and fades
export const POP_STAGGER = 0.06 // s between people arriving together
export const POP_MAX_STAGGER = 0.6 // s — a batch never waits longer than this
export const POP_OVERSHOOT = 2.2 // easeOutBack strength (~15% past full size)

/** Node scale at progress k (0..1): 0 → springs ~15% past 1 → settles at 1. */
export function popScale(k) {
  const t = Math.min(1, Math.max(0, k))
  const c1 = POP_OVERSHOOT,
    c3 = c1 + 1,
    q = t - 1
  return 1 + c3 * q * q * q + c1 * q * q
}

/** The ripple ring at ring progress k (0..1): radius factor (× node radius),
 *  alpha and stroke width (screen px, before perspective). null when done. */
export function popRing(k) {
  if (!(k >= 0) || k >= 1) return null
  const e = 1 - Math.pow(1 - k, 3)
  const fade = Math.pow(1 - k, 1.6)
  return { r: 1 + 1.4 * e, alpha: 0.85 * fade, width: 0.75 + 2.5 * (1 - k) }
}

/** The name fades in as the pop lands (0 before / early, 1 once settled). */
export function popLabelReveal(k) {
  return Math.min(1, Math.max(0, (k - 0.45) / 0.55))
}

/** Start offset (s) of the i-th person in a batch arriving together. */
export function popDelay(i) {
  return Math.min(i * POP_STAGGER, POP_MAX_STAGGER)
}
