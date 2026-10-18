import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import en from '../src/renderer/src/i18n/locales/en.js'
import zhHans from '../src/renderer/src/i18n/locales/zh-Hans.js'
import zhHant from '../src/renderer/src/i18n/locales/zh-Hant.js'
import nb from '../src/renderer/src/i18n/locales/nb.js'

// Flatten a message tree into { 'a.b.c': value } (arrays count as leaves).
function flatten(tree, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out)
    else out[key] = v
  }
  return out
}

// Some values legitimately take a language-specific variant of the same
// argument, and the code passes both: English ordinals ({ord} "3rd") vs a bare
// number ({n}) elsewhere; a month NAME ({m}) vs a month NUMBER ({mn}) in CJK
// dates. Compare them as one.
const SAME_ARG = { ord: 'n', mn: 'm' }
const placeholders = (v) =>
  typeof v === 'string'
    ? (v.match(/\{(\w+)\}/g) || [])
        .map((p) => SAME_ARG[p.slice(1, -1)] || p.slice(1, -1))
        .sort()
        .join(',')
    : ''

// Lists whose length may differ per language (e.g. the hero title is split
// into a different number of animated chunks in Chinese).
const FREE_LENGTH = new Set(['home.hero.titleWords'])

const EN = flatten(en)
const OTHERS = { 'zh-Hans': zhHans, 'zh-Hant': zhHant, nb }

describe('locales', () => {
  for (const [code, tree] of Object.entries(OTHERS)) {
    describe(code, () => {
      const flat = flatten(tree)
      it('has exactly the keys of en.js', () => {
        const missing = Object.keys(EN).filter((k) => !(k in flat))
        const extra = Object.keys(flat).filter((k) => !(k in EN))
        expect({ missing, extra }).toEqual({ missing: [], extra: [] })
      })
      it('keeps every {placeholder} of the English string', () => {
        const bad = Object.keys(EN).filter(
          (k) => k in flat && placeholders(EN[k]) !== placeholders(flat[k])
        )
        expect(bad).toEqual([])
      })
      it('keeps list lengths', () => {
        const bad = Object.keys(EN).filter(
          (k) =>
            Array.isArray(EN[k]) &&
            (!Array.isArray(flat[k]) || (!FREE_LENGTH.has(k) && flat[k].length !== EN[k].length))
        )
        expect(bad).toEqual([])
      })
    })
  }
})

// Every literal key passed to t('…') / translate('…') in the renderer must
// exist in en.js — a typo would otherwise render the raw key in the UI.
describe('translation keys used in source', () => {
  const root = join(__dirname, '../src/renderer/src')
  const files = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) {
        if (name !== 'i18n' && name !== 'assets') walk(p)
      } else if (/\.(vue|js|ts)$/.test(name)) files.push(p)
    }
  }
  walk(root)

  it('all exist in en.js', () => {
    const re = /\b(?:t|translate|\$t)\(\s*'([a-zA-Z][\w-]*(?:\.[\w-]+)+)'/g
    const missing = []
    for (const f of files) {
      // Skip comment lines (usage examples in doc comments aren't real calls).
      const src = readFileSync(f, 'utf8')
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join('\n')
      for (const m of src.matchAll(re)) {
        const key = m[1]
        // A key may point at a subtree/list (structured help content) too.
        const node = key.split('.').reduce((n, part) => (n == null ? undefined : n[part]), en)
        if (node === undefined) missing.push(`${f.slice(root.length + 1)}: ${key}`)
      }
    }
    expect(missing).toEqual([])
  })
})
