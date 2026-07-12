// Small shared helpers for the 2D overlay canvases that sit on top of the
// WebGL views (timeline, factions): theme colours resolved from the CSS design
// tokens, plus canvas drawing/text utilities.

// Cached reads of the CSS variables in styles/global.css. Call invalidate() on
// theme change; get() re-reads lazily.
export function createCssColorCache() {
  let cache = null
  return {
    invalidate() {
      cache = null
    },
    get() {
      if (!cache) {
        const cs = getComputedStyle(document.documentElement)
        const v = (name, fallback) => (cs.getPropertyValue(name) || fallback).trim()
        cache = {
          t1: v('--t1', '#e8eaf6'),
          t2: v('--t2', '#9ea3b8'),
          t3: v('--t3', '#4a5068'),
          border: v('--border', 'rgba(255,255,255,0.07)'),
          surface: v('--surface', '#181c27'),
          elevated: v('--elevated', '#1f2437'),
          accent: v('--accent', '#6c8ef5'),
          adim: v('--adim', 'rgba(108,142,245,0.14)'),
          bg: v('--bg', '#0f1117')
        }
      }
      return cache
    }
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

// Re-emit a CSS color (#rgb, #rrggbb or rgb()/rgba()) at the given alpha.
export function withAlpha(color, a) {
  color = (color || '').trim()
  if (color.startsWith('#')) {
    const full = color.length >= 7
    const r = parseInt(full ? color.slice(1, 3) : color[1] + color[1], 16)
    const g = parseInt(full ? color.slice(3, 5) : color[2] + color[2], 16)
    const b = parseInt(full ? color.slice(5, 7) : color[3] + color[3], 16)
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }
  const m = color.match(/^rgba?\(([^)]+)\)$/)
  if (m) {
    const parts = m[1]
      .split(',')
      .slice(0, 3)
      .map((s) => s.trim())
    return `rgba(${parts.join(', ')}, ${a})`
  }
  return color
}
