import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import * as lucide from 'lucide'
import { LUCIDE } from '../src/renderer/src/components/ui/lucideIcons.js'
import {
  LEGACY_GLYPHS,
  ICON_ALIASES,
  ICON_NAMES,
  resolveIcon,
  iconNode
} from '../src/renderer/src/components/ui/icons.js'

const pascal = (n) =>
  n
    .split('-')
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join('')

describe('icon registry', () => {
  it('maps every kebab name to its own Lucide export', () => {
    for (const [name, node] of Object.entries(LUCIDE)) {
      expect(node, name).toBe(lucide[pascal(name)])
      expect(Array.isArray(node) && node.length > 0, name).toBe(true)
    }
  })

  it('resolves every alias and legacy glyph to a real icon', () => {
    for (const [k, v] of [...Object.entries(ICON_ALIASES), ...Object.entries(LEGACY_GLYPHS)]) {
      expect(ICON_NAMES, `${k} → ${v}`).toContain(v)
      expect(iconNode(k), k).not.toBeNull()
    }
  })

  it('ignores emoji variation selectors and skin tones', () => {
    expect(resolveIcon('⚔️')).toBe('swords')
    expect(resolveIcon('⚔')).toBe('swords')
    expect(resolveIcon('👋🏽')).toBe('hand')
  })

  it('passes names through and rejects unknown values', () => {
    expect(resolveIcon('crown')).toBe('crown')
    expect(resolveIcon('graph')).toBe('graph')
    expect(resolveIcon('not-an-icon')).toBeNull()
    expect(resolveIcon('')).toBeNull()
    expect(iconNode('nope')).toBeNull()
  })
})

// Emoji render with per-OS font metrics (they knock button contents off-centre
// and clash with the stroke icon set), so UI code uses <UiIcon> / drawIcon
// names instead. This guards against them creeping back into source (comments
// and the legacy-glyph table in icons.js are exempt).
describe('no emoji icons in UI source', () => {
  const ROOTS = ['src/renderer/src', 'src/shared']
  const EXEMPT = new Set(['src/renderer/src/components/ui/icons.js'])
  // Pictographs + the dingbats the app used as icons (☀–⛿, ✕ ✖ ✦ ✨ ✅ ❌ ➕,
  // ⭐ ⬆ ⬇, ▶ ◀ ▸ ▾) and the emoji presentation selector.
  const EMOJI = new RegExp('(?:[🀀-🫿☀-⛿✕✖✦✨✅❌➕⭐⬆⬇▶◀▸▾]|️)', 'u')
  const files = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(vue|js|ts)$/.test(name) && !name.endsWith('.d.ts')) files.push(p)
    }
  }
  ROOTS.forEach(walk)

  it('finds none outside comments', () => {
    const hits = []
    for (const f of files) {
      const rel = relative('.', f).split(sep).join('/')
      if (EXEMPT.has(rel)) continue
      readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const t = line.trim()
          if (/^(\/\/|\*|\/\*|<!--)/.test(t)) return
          const code = line.replace(/\s\/\/ .*$/, '')
          if (EMOJI.test(code)) hits.push(`${rel}:${i + 1}: ${t.slice(0, 80)}`)
        })
    }
    expect(hits).toEqual([])
  })
})
