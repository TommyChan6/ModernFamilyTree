// 水墨 ink-painting look for the graph — pure decisions + colour math, no
// D3/Three/store dependency (tests: tests/graphMath.test.js).
//
// Two independent switches drive it, so the look is reachable from ANY theme:
//   • brush links  — the app's Ink theme, or linkRoute 'brush'
//   • wash nodes   — the app's Ink theme, or nodeDecor 'enso'
// and the backdrop (rice paper + distant misty mountains) shows in the Ink theme
// or whenever the atmosphere is 'mist'. On the dark theme the same strokes become
// "moonlit ink": pale ink on night paper.

/** Ink palette used by the graph (mirrors lib/inkArt INK + ink.css pigments). */
export const GRAPH_INK = {
  ink: '#1f1b16',
  wash: '#5a554c',
  paper: '#ece3cf',
  paperHalo: 'rgba(240,232,214,0.92)',
  cinnabar: '#b3352a',
  cinnabarMoon: '#d4604f',
  moonInk: '#e4dccb',
  azurite: '#2f5f8a',
  rouge: '#9a3b4a'
}

/**
 * Which parts of the ink look are live.
 * @param {object} gs   graph settings
 * @param {string} theme app theme ('dark' | 'light' | 'ink')
 * @returns {{ links: boolean, nodes: boolean, backdrop: boolean, mode: 'paper'|'moon'|'light'|'off' }}
 *   mode: 'paper' = Ink theme (toned to ink on rice paper), 'moon' = dark theme
 *   (pale ink), 'light' = light theme (preset colours as-is), 'off' = no ink parts.
 */
export function inkLook(gs, theme) {
  const isInk = theme === 'ink'
  const links = isInk || gs?.linkRoute === 'brush'
  const nodes = isInk || gs?.nodeDecor === 'enso'
  const backdrop = isInk || gs?.ambientFx === 'mist'
  const any = links || nodes || backdrop
  const mode = !any ? 'off' : isInk ? 'paper' : theme === 'dark' ? 'moon' : 'light'
  return { links, nodes, backdrop, mode }
}

// ── colour helpers ───────────────────────────────────────────────────────────

export function hexToRgb(hex) {
  let h = String(hex || '').trim()
  if (h[0] === '#') h = h.slice(1)
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  const n = parseInt(h.slice(0, 6), 16)
  if (!Number.isFinite(n) || h.length < 6) return [0.5, 0.5, 0.5]
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export function rgbToHex(c) {
  const to = (v) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0')
  return '#' + to(c[0]) + to(c[1]) + to(c[2])
}

export function mixRgb(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

export function luminance(c) {
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

export function saturation(c) {
  const mx = Math.max(c[0], c[1], c[2]),
    mn = Math.min(c[0], c[1], c[2])
  return mx <= 0 ? 0 : (mx - mn) / mx
}

// Lineage-focus emphasis colours (linkHelpers getLinkStroke) re-cast as mineral
// pigments so the paternal/maternal lens still reads on paper.
const EMPHASIS_PIGMENT = {
  '#4a90d9': GRAPH_INK.azurite,
  '#7bb8f0': '#5b85a8',
  '#d94a8a': GRAPH_INK.rouge,
  '#eda0c4': '#b8707c'
}

/**
 * A link's colour in ink. `role` is the edge's symmetryRole ('vertical' |
 * 'horizontal' | 'none'); `ended` marks a finished bond.
 *  paper: structural lines are near-black ink with a whisper of their hue,
 *         couples are the cinnabar red thread (红线), social overlays a muted
 *         coloured ink (花青-like); emphasis colours become mineral pigments.
 *  moon:  dark inks lift to pale moonlit ink; saturated pigments brighten.
 *  light / off: unchanged.
 */
export function inkLinkColor(hex, role, mode, ended = false) {
  const key = String(hex || '').toLowerCase()
  if (mode === 'paper') {
    if (EMPHASIS_PIGMENT[key]) return EMPHASIS_PIGMENT[key]
    const c = hexToRgb(hex)
    if (role === 'horizontal')
      return ended
        ? rgbToHex(mixRgb(hexToRgb(GRAPH_INK.cinnabar), hexToRgb(GRAPH_INK.wash), 0.45))
        : GRAPH_INK.cinnabar
    if (role === 'vertical') return rgbToHex(mixRgb(hexToRgb(GRAPH_INK.ink), c, 0.2))
    return rgbToHex(mixRgb(hexToRgb(GRAPH_INK.wash), c, 0.45))
  }
  if (mode === 'moon') {
    const c = hexToRgb(hex)
    const L = luminance(c),
      S = saturation(c)
    if (L >= 0.55) return rgbToHex(c)
    const pale = hexToRgb(GRAPH_INK.moonInk)
    // Greys lift almost all the way to pale ink; pigments keep their hue but brighten.
    const lift = Math.min(1, ((0.55 - L) / 0.55) * (1 - S * 0.7) * 1.05)
    const out = mixRgb(c, pale, lift)
    const boost = S > 0.35 ? 1 + 0.45 * S * (1 - L) : 1
    return rgbToHex([out[0] * boost, out[1] * boost, out[2] * boost])
  }
  return hex
}

/**
 * A node's wash fill on rice paper: the gender / custom hue diluted into a pale
 * tinted wash (a little darker than the paper so the roundel reads). Moon and
 * light modes keep the preset fill.
 */
export function inkNodeFill(hex, mode) {
  if (mode !== 'paper') return hex
  const c = hexToRgb(hex)
  const L = luminance(c)
  const grey = [L, L, L]
  const muted = mixRgb(grey, c, 0.45) // mostly-desaturated pigment
  const paper = hexToRgb('#d6cab1')
  // Dilute toward the paper — further for dark pigments, so every wash lands in
  // the same pale-to-mid band (luminance ≥ ~0.56) and the reserved figure reads.
  const lm = luminance(muted),
    lp = luminance(paper)
  const need = lp > lm ? (0.56 - lm) / (lp - lm) : 0
  const t = Math.max(0.45, Math.min(0.85, need))
  return rgbToHex(mixRgb(muted, paper, t))
}

/** Seal / selection red for the active mode. */
export function inkSealColor(mode) {
  return mode === 'moon' ? GRAPH_INK.cinnabarMoon : GRAPH_INK.cinnabar
}

/**
 * Staggered birth times (seconds on the renderer clock) for a batch of new
 * strokes/washes so a fresh graph paints itself in as a wave rather than all
 * at once. Total spread is capped so big trees don't take forever.
 */
export function staggerBirth(now, index, count, { delay = 0, step = 0.035, maxSpread = 1.1 } = {}) {
  const st = count > 1 ? Math.min(step, maxSpread / (count - 1)) : 0
  return now + delay + index * st
}

/** Parallax offset (px) of a backdrop layer for a camera transform. `depth`
 *  0..1: 0 = pinned to the screen, 1 = moves with the world. */
export function backdropOffset(t, depth) {
  const x = (t?.x || 0) * depth
  const y = (t?.y || 0) * depth
  return { x, y }
}
