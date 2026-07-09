// Small shared helpers for the 2D overlay canvases that sit on top of the
// WebGL views (timeline, factions): theme colours resolved from the CSS design
// tokens, plus canvas drawing/text utilities.

// Cached reads of the CSS variables in styles/global.css. Call invalidate() on
// theme change; get() re-reads lazily.
export function createCssColorCache() {
  let cache = null
  return {
    invalidate() { cache = null },
    get() {
      if (!cache) {
        const cs = getComputedStyle(document.documentElement)
        const v = (name, fallback) => (cs.getPropertyValue(name) || fallback).trim()
        cache = {
          t1: v('--t1', '#e8eaf6'), t2: v('--t2', '#9ea3b8'), t3: v('--t3', '#4a5068'),
          border: v('--border', 'rgba(255,255,255,0.07)'),
          surface: v('--surface', '#181c27'), elevated: v('--elevated', '#1f2437'),
          accent: v('--accent', '#6c8ef5'), adim: v('--adim', 'rgba(108,142,245,0.14)'),
          bg: v('--bg', '#0f1117'),
        }
      }
      return cache
    },
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function trunc(s, n) {
  s = s || 'Unnamed'
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
