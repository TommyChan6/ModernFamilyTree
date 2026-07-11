// Pure layout math for the Factions view — no D3, no store, no DOM.

/** Zone radius grows gently with member count so small factions stay compact. */
export function factionRadius(memberCount) {
  return 72 + Math.sqrt(Math.max(0, memberCount)) * 24
}

/**
 * Cluster target for every person that belongs to at least one visible
 * faction: the average of their factions' centres, so people in several
 * factions settle in the middle ground between their camps.
 * `getPos` lets callers substitute animated display positions for the
 * persisted faction coordinates (e.g. while zones glide between scenarios).
 * Returns { [personId]: { x, y, factionIds } }.
 */
export function computeTargets(factions, getPos = (f) => f) {
  const acc = {}
  for (const f of factions) {
    if (f.visible === false) continue
    const p = getPos(f) || f
    for (const pid of f.member_ids || []) {
      const t = acc[pid] || (acc[pid] = { x: 0, y: 0, n: 0, factionIds: [] })
      t.x += p.x
      t.y += p.y
      t.n++
      t.factionIds.push(f.id)
    }
  }
  const targets = {}
  for (const [pid, t] of Object.entries(acc)) {
    targets[pid] = { x: t.x / t.n, y: t.y / t.n, factionIds: t.factionIds }
  }
  return targets
}

/**
 * Where to place a newly created faction: the view centre if it is free,
 * otherwise the first spot on an outward spiral that keeps clear of every
 * existing zone.
 */
export function nextFactionPosition(factions, cx, cy) {
  const existing = factions.filter((f) => f.visible !== false)
  const clear = (x, y) =>
    existing.every(
      (f) => Math.hypot(f.x - x, f.y - y) > factionRadius((f.member_ids || []).length) + 160
    )
  if (clear(cx, cy)) return { x: cx, y: cy }
  for (let i = 1; i < 60; i++) {
    const a = i * 2.4 // golden-angle spiral: even spread, no overlapping rays
    const r = 140 * Math.sqrt(i)
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r * 0.75
    if (clear(x, y)) return { x, y }
  }
  return { x: cx, y: cy }
}

/**
 * Evenly space the given factions on an ellipse around (cx, cy) — the
 * one-click "arrange" action. Returns [{ id, x, y }].
 */
export function arrangeInRing(factions, cx, cy) {
  const n = factions.length
  if (n === 0) return []
  if (n === 1) return [{ id: factions[0].id, x: cx, y: cy }]
  const maxR = Math.max(...factions.map((f) => factionRadius((f.member_ids || []).length)))
  // Ring radius keeps neighbouring zones from touching
  const ring = Math.max(260, (maxR * 2 + 90) / (2 * Math.sin(Math.PI / n)))
  return factions.map((f, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return { id: f.id, x: cx + Math.cos(a) * ring, y: cy + Math.sin(a) * ring * 0.72 }
  })
}

/**
 * Arc segments around a node showing its memberships: the ring is split into
 * one arc per faction. A single membership renders as a (near-)full circle.
 * Angles are radians in atan2 space (0 = +x, clockwise on a y-down canvas),
 * ready for the WebGL ArcLayer. Returns [{ a0, a1 }], one per membership.
 */
export function membershipArcSpans(count) {
  if (count <= 0) return []
  const gapDeg = count === 1 ? 0 : Math.min(18, 100 / count)
  const span = 360 / count
  const rad = (deg) => ((deg - 90) * Math.PI) / 180 // 0° = 12 o'clock, clockwise
  return Array.from({ length: count }, (_, i) => ({
    a0: rad(i * span + gapDeg / 2),
    // shave a sliver off a lone arc so the seam doesn't z-fight with itself
    a1: rad((i + 1) * span - gapDeg / 2 - (count === 1 ? 0.1 : 0))
  }))
}
