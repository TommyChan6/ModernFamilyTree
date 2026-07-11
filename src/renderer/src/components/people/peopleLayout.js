// Pure layout math + display helpers for the People view — no Vue, DOM, or store.
//
// The card grid is virtualized over a native scroll container: only the rows near
// the viewport exist in the DOM. These geometry constants are the single source of
// truth — the view feeds them to CSS via custom properties, so the JS windowing
// math and the CSS grid can never disagree about card size or spacing.

import { toOrdinal } from '../../../../shared/calendarMath'

export const CARD_W = 196 // card width (px)
export const CARD_H = 330 // card height (px)
export const GAP = 22 // gap between cards, both axes (px)
export const PAD = 24 // padding around the grid (px)
export const OVERSCAN_ROWS = 2 // extra card rows kept mounted above/below the viewport

export const ROW_H = CARD_H + GAP // vertical distance between card rows (px)

// How many columns of fixed-width cards fit in `availWidth` px of content box
// (the grid's horizontal padding has already been subtracted). Always ≥ 1 so the
// layout never collapses while the container is still being measured (width 0).
export function columnCount(availWidth, cardW = CARD_W, gap = GAP) {
  if (!(availWidth > 0)) return 1
  return Math.max(1, Math.floor((availWidth + gap) / (cardW + gap)))
}

// Total scrollable height for `count` cards laid out in `cols` columns — the
// height of the sizer element that gives the scroll container its scrollbar.
export function gridHeight(count, cols, rowH = ROW_H, pad = PAD, gap = GAP) {
  if (count <= 0 || cols <= 0) return 0
  const rows = Math.ceil(count / cols)
  return pad * 2 + rows * rowH - gap // no trailing gap after the last row
}

// The window of items to render for a given scroll position. The result is
// row-aligned (startIndex is always a multiple of cols) so the first rendered
// card starts a fresh grid row and columns stay aligned. `offsetY` is where the
// rendered block sits, applied as a single translateY on the grid container.
//
// Everything is clamped to the real row range, so a stale scrollTop (e.g. right
// after the list shrinks and the browser clamps the scroll position) can only
// ever produce an empty window — never an out-of-bounds slice.
export function rowWindow(scrollTop, viewH, count, cols, opts = {}) {
  const { rowH = ROW_H, pad = PAD, overscan = OVERSCAN_ROWS } = opts
  const rows = cols > 0 ? Math.ceil(Math.max(0, count) / cols) : 0
  if (rows === 0) return { firstRow: 0, lastRow: 0, startIndex: 0, endIndex: 0, offsetY: pad }

  const top = scrollTop - pad
  const firstRow = Math.min(rows, Math.max(0, Math.floor(top / rowH) - overscan))
  const lastRow = Math.min(rows, Math.max(firstRow, Math.ceil((top + viewH) / rowH) + overscan))

  return {
    firstRow,
    lastRow,
    startIndex: firstRow * cols,
    endIndex: Math.min(count, lastRow * cols),
    offsetY: pad + firstRow * rowH
  }
}

// ── Person display helpers ──────────────────────────────────────────────────
// Deceased only if a death date exists and is at or before the reference year
// (people with a future "death" date are still alive as of `refYear`).
export function isDeceased(p, refYear) {
  const death = toOrdinal(p.death)
  return death != null && death <= refYear
}

// Age at the reference year, capped at the death date; null when unknown or
// nonsensical (birth after the reference year).
export function ageOf(p, refYear) {
  const birth = toOrdinal(p.birth)
  if (birth == null) return null
  const death = toOrdinal(p.death)
  const end = death != null ? Math.min(death, refYear) : refYear
  const age = Math.floor(end - birth)
  return age >= 0 ? age : null
}

export function genderLabel(g) {
  if (g === 'male') return '♂ Male'
  if (g === 'female') return '♀ Female'
  return '● Person'
}
