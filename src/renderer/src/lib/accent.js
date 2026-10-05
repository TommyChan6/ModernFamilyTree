// The user-selectable accent color (Settings → General → Accent).
//
// Pure color math: from one hex color derive the whole accent token family
// that styles/global.css defines (`--accent`, `--accent-rgb`, `--accent-hover`,
// `--accent-2`, `--adim`). The store applies the result to <html> inline, so it
// wins over the stylesheet defaults in both themes.

export const DEFAULT_ACCENT = '#6c8ef5'

export const ACCENT_PRESETS = [
  { id: 'periwinkle', hex: '#6c8ef5' },
  { id: 'violet', hex: '#9b7cf5' },
  { id: 'rose', hex: '#f06292' },
  { id: 'coral', hex: '#ff7a59' },
  { id: 'amber', hex: '#f0a020' },
  { id: 'emerald', hex: '#2fbf82' },
  { id: 'teal', hex: '#22b3c4' },
  { id: 'sky', hex: '#3fa2f5' }
]

/** '#abc' | '#aabbcc' (any case, optional #) → [r,g,b], or null. */
export function parseHex(hex) {
  const s = String(hex ?? '')
    .trim()
    .replace(/^#/, '')
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return null
  const full = s.length === 3 ? [...s].map((c) => c + c).join('') : s
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function toHex([r, g, b]) {
  const h = (v) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

/** Normalize to a lowercase 6-digit hex, or null when unparseable. */
export function normalizeHex(hex) {
  const rgb = parseHex(hex)
  return rgb ? toHex(rgb) : null
}

function rgbToHsl([r, g, b]) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h * 60, s, l]
}

function hslToRgb([h, s, l]) {
  h = (((h % 360) + 360) % 360) / 360
  if (s === 0) return [l * 255, l * 255, l * 255]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]
}

/** Relative luminance (WCAG) of an [r,g,b] color, 0..1. */
export function luminance([r, g, b]) {
  const c = (v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b)
}

/**
 * The CSS custom properties for an accent. Invalid input falls back to the
 * default accent. `--on-accent` flips to near-black for very light accents so
 * primary-button labels stay readable.
 */
export function accentVars(hex) {
  const rgb = parseHex(hex) ?? parseHex(DEFAULT_ACCENT)
  const [h, s, l] = rgbToHsl(rgb)
  const hover = hslToRgb([h, s, Math.max(0, l - 0.07)])
  // Gradient partner: a hue step toward violet/pink, same energy.
  const partner = hslToRgb([h + 38, Math.min(1, s * 1.05), Math.min(0.72, l + 0.02)])
  return {
    '--accent': toHex(rgb),
    '--accent-rgb': rgb.join(', '),
    '--accent-hover': toHex(hover),
    '--accent-2': toHex(partner),
    '--on-accent': luminance(rgb) > 0.6 ? '#11131c' : '#ffffff',
    '--adim': `rgba(${rgb.join(', ')}, 0.14)`
  }
}
