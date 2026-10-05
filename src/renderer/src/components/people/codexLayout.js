// Pure helpers for the Codex medium (people/CodexView.vue): an illustrated
// bestiary with a windowed index on the left and a composed entry page on the
// right. No Vue, DOM, or store in here — everything is plain data in, plain
// data out, so the geometry and kinship math stay unit-testable.

// ── Index list geometry ─────────────────────────────────────────────────────
export const INDEX_ROW_H = 46 // px per index row
export const INDEX_PAD = 8 // px above the first / below the last row
export const INDEX_OVERSCAN = 6 // extra rows mounted above/below the viewport

// "No. 007": 1-based entry number, zero-padded to at least three digits (and
// to the width of the largest number, so a 12,000-entry codex stays aligned).
export function entryNo(index, total = 0) {
  const width = Math.max(3, String(Math.max(1, total)).length)
  return 'No. ' + String(Math.max(0, index) + 1).padStart(width, '0')
}

// The slice of index rows to mount for a scroll position. Clamped to the real
// row range, so a stale scrollTop after the list shrinks yields a valid (maybe
// empty) window rather than an out-of-bounds slice.
export function indexWindow(scrollTop, viewH, count, opts = {}) {
  const { rowH = INDEX_ROW_H, pad = INDEX_PAD, overscan = INDEX_OVERSCAN } = opts
  const n = Math.max(0, count | 0)
  if (!n) return { start: 0, end: 0 }
  const top = Math.max(0, scrollTop - pad)
  const start = Math.min(n, Math.max(0, Math.floor(top / rowH) - overscan))
  const end = Math.min(n, Math.max(start, Math.ceil((top + Math.max(0, viewH)) / rowH) + overscan))
  return { start, end }
}

// The index list's total scrollable height.
export function indexHeight(count, rowH = INDEX_ROW_H, pad = INDEX_PAD) {
  return count > 0 ? pad * 2 + count * rowH : 0
}

// Where to scroll so row `index` is comfortably visible (a `margin` of rows
// kept around it). Returns null when it is already in view — callers only
// write scrollTop when needed, so a user's manual scrolling isn't fought.
export function scrollToReveal(scrollTop, viewH, index, opts = {}) {
  const { rowH = INDEX_ROW_H, pad = INDEX_PAD, margin = 1.5 } = opts
  const rowTop = pad + index * rowH
  const rowBot = rowTop + rowH
  const m = margin * rowH
  if (viewH <= rowH + 2 * m) return Math.max(0, rowTop - (viewH - rowH) / 2)
  if (rowTop - m < scrollTop) return Math.max(0, rowTop - m)
  if (rowBot + m > scrollTop + viewH) return rowBot + m - viewH
  return null
}

// A–Z quick-jump targets: the first index of each initial, in list order
// (meaningful when sorted by name; harmless otherwise). Non-letters → '#'.
export function letterJumps(persons) {
  const seen = new Map()
  persons.forEach((p, i) => {
    const key = initialKey(p?.name)
    if (!seen.has(key)) seen.set(key, i)
  })
  return [...seen.entries()].map(([ch, index]) => ({ ch, index }))
}
export function initialKey(name) {
  const ch = (name || '').trim().charAt(0).toUpperCase()
  return /[A-ZÀ-Þ]/.test(ch) ? ch : '#'
}

// Monogram fallback: first + last initial ("Ada Lovelace" → "AL").
export function initialsOf(name) {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0] || '?').substring(0, 2).toUpperCase()
}

// A DateValue as a codex would print it, honouring precision: "12 Jun 1950",
// "Jun 1950", "1950", "300 BCE". Unknown → ''.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function prettyDate(d) {
  if (!d || d.year == null || !Number.isFinite(Number(d.year))) return ''
  const y = Number(d.year)
  const year = y < 0 ? `${-y} BCE` : String(y)
  const m = d.precision !== 'year' && d.month >= 1 && d.month <= 12 ? MONTHS[d.month - 1] : ''
  const day = d.precision === 'day' && m && d.day ? d.day + ' ' : ''
  return m ? `${day}${m} ${year}` : year
}

// ── Lifespan scale rule ─────────────────────────────────────────────────────
// Round `max` years up to a tidy scale with at most 10 intervals (10, 20, 25, 50…).
export function lifespanScale(maxYears) {
  const m = Math.max(10, Math.ceil(Number(maxYears) || 0))
  const steps = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]
  let step = steps[steps.length - 1]
  for (const s of steps) {
    if (m / s <= 10) {
      step = s
      break
    }
  }
  const max = Math.ceil(m / step) * step
  const ticks = []
  for (let v = 0; v <= max; v += step) ticks.push(v)
  return { max, step, ticks }
}

// ── Kinship ─────────────────────────────────────────────────────────────────
// Everyone connected to `personId`, grouped the way a codex entry reads:
//   parents / children — edges whose type has symmetryRole 'vertical'
//                        (person_a is the parent)
//   partners           — 'horizontal' edges (spouses, partners)
//   siblings           — derived from shared vertical parents, plus explicit
//                        rows of any type labelled as sibling-like are left to
//                        `others` (they carry their own label)
//   others             — every other edge, labelled by the def's end role for
//                        the *other* person (a mentor's student reads "Student")
//                        or the def label, de-duplicated per (person, label)
// `roleOf(type)` → 'vertical'|'horizontal'|'none'; `defOf(type)` → def|undefined.
export function kinshipOf(personId, relationships, roleOf, defOf = () => undefined) {
  const out = { parents: [], children: [], partners: [], siblings: [], others: [] }
  if (!personId || !Array.isArray(relationships)) return out
  const parents = new Set()
  const children = new Set()
  const partners = new Set()
  const others = new Map() // `${id}|${label}` → entry
  for (const r of relationships) {
    const a = r.person_a_id
    const b = r.person_b_id
    if (a === b || (a !== personId && b !== personId)) continue
    const other = a === personId ? b : a
    const role = roleOf(r.type) || 'none'
    if (role === 'vertical') {
      if (a === personId) children.add(other)
      else parents.add(other)
    } else if (role === 'horizontal') {
      partners.add(other)
    } else {
      const def = defOf(r.type)
      const end = def && def.directed ? (a === personId ? def.role_b : def.role_a) : ''
      const label = r.label || end || def?.label || r.type || 'Bond'
      const key = other + '|' + label
      if (!others.has(key)) {
        others.set(key, {
          id: other,
          label,
          color: def?.color || '',
          glyph: def?.glyph || ''
        })
      }
    }
  }
  // Derived siblings: every other child of any of this person's parents.
  const siblings = new Set()
  if (parents.size) {
    for (const r of relationships) {
      if (roleOf(r.type) !== 'vertical') continue
      if (!parents.has(r.person_a_id)) continue
      const kid = r.person_b_id
      if (kid !== personId && kid !== r.person_a_id) siblings.add(kid)
    }
  }
  out.parents = [...parents]
  out.children = [...children]
  out.partners = [...partners]
  out.siblings = [...siblings].filter((id) => !parents.has(id) && !children.has(id))
  out.others = [...others.values()]
  return out
}

// ── Wax seal outline ────────────────────────────────────────────────────────
// A scalloped disc path (the squashed-wax rim) centred at (cx, cy): `lobes`
// bumps of relative `depth` around radius r. A tiny deterministic wobble from
// `seed` keeps every seal slightly different without randomness.
export function sealPath(cx, cy, r, lobes = 14, depth = 0.08, seed = 0) {
  const steps = lobes * 6
  let d = ''
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2
    const wobble = Math.sin(t * 3 + seed) * 0.025 + Math.sin(t * 5 + seed * 1.7) * 0.015
    const rr = r * (1 - depth / 2 + (depth / 2) * Math.cos(t * lobes) + wobble)
    const x = cx + rr * Math.cos(t)
    const y = cy + rr * Math.sin(t)
    d += (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2)
  }
  return d + 'Z'
}

// Small stable hash (djb2) of a string → non-negative int; seeds the seal's
// wobble and tilt per person.
export function hashOf(str) {
  let h = 5381
  const s = String(str || '')
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

// ── Page-turn keyframes ─────────────────────────────────────────────────────
// The turning leaf pivots on the spine (its left edge). Forward: the current
// page lifts toward the viewer and swings away, 0° → -90° (edge-on, then gone
// behind backface-visibility). Back: the previous page swings in from the
// spine, -90° → 0°. The shadow it casts on the page beneath hugs the leaf's
// projected free edge, which sits at cos(θ) of the page width — sampling both
// from the same eased angle keeps shadow and leaf locked together.
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOut = (t) => 1 - Math.pow(1 - t, 3)
const easeInSoft = (t) => t * t * (1.6 - 0.6 * t)

export function turnKeyframes(dir, steps = 14) {
  const leaf = []
  const shadow = []
  const shade = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    // Forward starts slow (the lift) and flops at the end; back lands softly.
    const k = dir === 'back' ? 1 - easeOut(t) : easeInSoft(easeInOut(t) * 0.35 + t * 0.65)
    const deg = -90 * Math.min(1, Math.max(0, k))
    const edge = Math.cos((deg * Math.PI) / 180) // 1 = flat, 0 = edge-on
    const lift = Math.sin((-deg * Math.PI) / 180) // 0 flat → 1 edge-on
    leaf.push({ offset: t, transform: `rotateY(${deg.toFixed(2)}deg)` })
    shadow.push({
      offset: t,
      transform: `translateX(${(edge * 100).toFixed(2)}%)`,
      opacity: +(Math.sin(Math.PI * Math.min(1, lift * 1.05)) * 0.95).toFixed(3)
    })
    shade.push({ offset: t, opacity: +(lift * 0.55).toFixed(3) })
  }
  return { leaf, shadow, shade }
}
