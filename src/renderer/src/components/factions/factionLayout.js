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
 * Match factions across two scenarios by (case-insensitive) name — "the same
 * faction is present" continuity when switching scenarios. Duplicate names
 * match first-come-first-served. Returns Map<newFactionId, oldFaction>.
 */
export function matchFactionsByName(oldFactions, newFactions) {
  const byName = new Map()
  for (const f of oldFactions) {
    const key = (f.name || '').trim().toLowerCase()
    if (key && !byName.has(key)) byName.set(key, f)
  }
  const matches = new Map()
  for (const f of newFactions) {
    const key = (f.name || '').trim().toLowerCase()
    const old = key ? byName.get(key) : null
    if (old) {
      matches.set(f.id, old)
      byName.delete(key)
    }
  }
  return matches
}

/**
 * Where to place a newly created faction: the view centre if it is free,
 * otherwise the first spot on an outward spiral that keeps clear of every
 * existing zone.
 */
export function nextFactionPosition(factions, cx, cy) {
  const existing = factions.filter(f => f.visible !== false)
  const clear = (x, y) => existing.every(f =>
    Math.hypot(f.x - x, f.y - y) > factionRadius((f.member_ids || []).length) + 160
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
  const maxR = Math.max(...factions.map(f => factionRadius((f.member_ids || []).length)))
  // Ring radius keeps neighbouring zones from touching
  const ring = Math.max(260, (maxR * 2 + 90) / (2 * Math.sin(Math.PI / n)))
  return factions.map((f, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return { id: f.id, x: cx + Math.cos(a) * ring, y: cy + Math.sin(a) * ring * 0.72 }
  })
}

/**
 * SVG arc segments around a node showing its memberships: the ring is split
 * into one arc per faction, in faction colours. A single membership renders
 * as a (near-)full circle. Returns [{ color, d }].
 */
export function membershipArcs(cx, cy, r, colors) {
  const k = colors.length
  if (k === 0) return []
  const gapDeg = k === 1 ? 0 : Math.min(18, 100 / k)
  const span = 360 / k
  const pt = (deg) => {
    const a = ((deg - 90) * Math.PI) / 180
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`
  }
  return colors.map((color, i) => {
    const a0 = i * span + gapDeg / 2
    // 359.9° for a lone arc — a true 360° SVG arc collapses to nothing
    const a1 = (i + 1) * span - gapDeg / 2 - (k === 1 ? 0.1 : 0)
    const large = a1 - a0 > 180 ? 1 : 0
    return { color, d: `M ${pt(a0)} A ${r} ${r} 0 ${large} 1 ${pt(a1)}` }
  })
}
