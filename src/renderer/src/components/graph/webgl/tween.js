// Frame-rate-independent exponential smoothing toward a target. `tau` is the time constant
// in seconds (~0.09 settles smoothly in ~250ms, matching the old d3 250–400ms transitions).
// dt is clamped by the caller so a stale frame after idle can't produce a jump.
export const TWEEN_TAU = 0.09
export const TWEEN_EPS = 0.001

export function approach(cur, target, dt, tau = TWEEN_TAU) {
  if (cur === target) return target
  const a = 1 - Math.exp(-dt / tau)
  const next = cur + (target - cur) * a
  return Math.abs(next - target) < TWEEN_EPS ? target : next
}
