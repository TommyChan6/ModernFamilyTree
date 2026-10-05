// Pure layout math for the Roster (fighting-game character select) medium —
// no Vue, DOM, or store. The select grid is a field of slanted parallelogram
// tiles laid out in rows; slants line up row to row so the column seams read
// as continuous diagonals. Only rows near the viewport are mounted, so every
// position the view needs (tiles, the gliding cursor, scroll targets) comes
// from these functions.

export const TILE_W = 84 // tile bounding-box width (px)
export const TILE_H = 78 // tile height (px)
export const SLANT = 14 // horizontal offset of the parallelogram's top edge (px)
export const GAP_X = 5 // gap between neighbouring slanted edges (px)
export const GAP_Y = 9 // gap between rows (px)
export const PAD_X = 28 // minimum side padding of the grid (px)
export const PAD_Y = 28 // top/bottom padding of the grid (px)
export const OVERSCAN = 2 // extra rows kept mounted above/below the viewport
export const MAX_COLS = 22 // wide screens stop adding columns here

// Tiles overlap by their slant so the diagonal seams stay a constant GAP_X apart.
export const PITCH_X = TILE_W - SLANT + GAP_X
export const PITCH_Y = TILE_H + GAP_Y

// Column count, row count, centred x offset and scroll height for `count`
// tiles in a container `viewW` px wide. Always ≥ 1 column so a not-yet-measured
// container (width 0) never divides by zero.
export function gridMetrics(viewW, count, maxCols = MAX_COLS) {
  const avail = Math.max(0, (viewW || 0) - PAD_X * 2 - TILE_W)
  const fit = Math.floor(avail / PITCH_X) + 1
  const cols = Math.max(1, Math.min(maxCols, fit, Math.max(1, count)))
  const rows = count > 0 ? Math.ceil(count / cols) : 0
  const gridW = (cols - 1) * PITCH_X + TILE_W
  const offsetX = Math.max(PAD_X, Math.round(((viewW || 0) - gridW) / 2))
  const totalH = rows ? PAD_Y * 2 + (rows - 1) * PITCH_Y + TILE_H : 0
  return { cols, rows, gridW, offsetX, totalH }
}

// Top-left corner (in sizer coordinates) of the tile at index `i`.
export function tileXY(i, m) {
  const col = i % m.cols
  const row = Math.floor(i / m.cols)
  return { x: m.offsetX + col * PITCH_X, y: PAD_Y + row * PITCH_Y, row, col }
}

// Row window [first, last) to mount for a scroll position, clamped to the
// real row range so a stale scrollTop only ever yields an empty window.
export function visibleRows(scrollTop, viewH, rows, overscan = OVERSCAN) {
  if (!(rows > 0)) return { first: 0, last: 0 }
  const top = (scrollTop || 0) - PAD_Y
  const first = Math.min(rows, Math.max(0, Math.floor(top / PITCH_Y) - overscan))
  const last = Math.min(rows, Math.max(first, Math.ceil((top + (viewH || 0)) / PITCH_Y) + overscan))
  return { first, last }
}

// Where the select cursor lands after a navigation key. Left/right walk the
// roster in reading order (wrapping across rows, like most select screens);
// up/down keep the column, and ArrowDown from the row above a short final
// row drops onto its last tile rather than getting stuck.
export function stepCursor(index, key, cols, count, pageRows = 1) {
  if (!(count > 0)) return 0
  const last = count - 1
  const i = Math.max(0, Math.min(last, index | 0))
  const c = Math.max(1, cols | 0)
  const page = Math.max(1, pageRows | 0) * c
  switch (key) {
    case 'ArrowRight':
      return Math.min(last, i + 1)
    case 'ArrowLeft':
      return Math.max(0, i - 1)
    case 'ArrowDown':
      if (i + c <= last) return i + c
      return Math.floor(i / c) < Math.floor(last / c) ? last : i
    case 'ArrowUp':
      return i - c >= 0 ? i - c : i
    case 'PageDown':
      return Math.min(last, i + page)
    case 'PageUp':
      return i - page >= 0 ? i - page : i % c
    case 'Home':
      return 0
    case 'End':
      return last
    default:
      return i
  }
}

// The scrollTop that brings tile `index`'s row fully into view (with a little
// breathing room), or null when it's already visible.
export function revealScroll(index, cols, scrollTop, viewH, margin = PAD_Y) {
  const row = Math.floor(index / Math.max(1, cols))
  const top = PAD_Y + row * PITCH_Y
  const bottom = top + TILE_H
  if (top - margin < scrollTop) return Math.max(0, top - margin)
  if (bottom + margin > scrollTop + viewH) return Math.max(0, bottom + margin - viewH)
  return null
}

// Roster-wide maxima for the stat bars (each ≥ 1 so fractions never divide
// by zero). `ageFn(p)` returns an age or null.
export function rosterMaxima(persons, statsOf, ageFn) {
  let age = 1
  let kin = 1
  let children = 1
  for (const p of persons) {
    const a = ageFn(p)
    if (a != null && a > age) age = a
    const s = statsOf(p.id)
    if (s) {
      if (s.kin > kin) kin = s.kin
      if (s.children > children) children = s.children
    }
  }
  return { age, kin, children }
}

// 0..1 fill for a stat bar.
export function statFraction(value, max) {
  if (!(value > 0) || !(max > 0)) return 0
  return Math.min(1, value / max)
}

// "1901 – 1975" / "b. 1901" / "d. 1975" / ''.
export function lifeLine(p) {
  const b = p?.birth?.year
  const d = p?.death?.year
  if (b != null && d != null) return `${b} – ${d}`
  if (b != null) return `b. ${b}`
  if (d != null) return `d. ${d}`
  return ''
}

// The splash's subtitle: occupation · location (whichever exist).
export function epithet(p) {
  return [p?.occupation, p?.location]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join(' · ')
}

export function initialsOf(name) {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0] || '?').substring(0, 2).toUpperCase()
}
