import { describe, it, expect } from 'vitest'
import {
  APP_CHAPTERS,
  VIEW_CHAPTERS,
  STYLE_ENTRIES,
  chaptersFor,
  hasViewStyle,
  searchStyleEntries,
  countTuned,
  defaultsPatch,
  chapterDirection,
  foldText
} from '../src/renderer/src/components/style/styleCatalog'
import en from '../src/renderer/src/i18n/locales/en.js'

const lookup = (key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), en)
const label = (e) => lookup(e.labelKey) ?? e.labelKey

describe('style studio catalogue', () => {
  it('every entry points at a real chapter of its scope', () => {
    for (const e of STYLE_ENTRIES) {
      const list = e.scope === 'app' ? APP_CHAPTERS : VIEW_CHAPTERS[e.scope]
      expect(list, e.scope).toBeTruthy()
      expect(
        list.some((c) => c.id === e.chapter),
        `${e.scope}.${e.chapter}`
      ).toBe(true)
    }
  })

  it('every entry and chapter label resolves in the English locale', () => {
    for (const e of STYLE_ENTRIES) expect(typeof lookup(e.labelKey), e.labelKey).toBe('string')
    const chapters = [...APP_CHAPTERS, ...Object.values(VIEW_CHAPTERS).flat()]
    for (const c of chapters) expect(typeof lookup(c.labelKey), c.labelKey).toBe('string')
  })

  it('chapter keys never overlap within one settings source', () => {
    for (const source of ['graph', 'timeline']) {
      const seen = new Set()
      const lists = [APP_CHAPTERS, ...Object.values(VIEW_CHAPTERS)]
      for (const c of lists.flat().filter((c) => c.source === source))
        for (const k of c.keys) {
          expect(seen.has(k), `${source}.${k}`).toBe(false)
          seen.add(k)
        }
    }
  })

  it('gates Advanced-only chapters on caps.style', () => {
    expect(chaptersFor('graph', 'full').some((c) => c.id === 'physics')).toBe(true)
    expect(chaptersFor('graph', 'basic').some((c) => c.id === 'physics')).toBe(false)
    expect(chaptersFor('groups')).toEqual([])
    expect(hasViewStyle('graph')).toBe(true)
    expect(hasViewStyle('relationships')).toBe(false)
  })

  it('search matches labels, chapter names and extra words, prefix hits first', () => {
    const hits = searchStyleEntries(STYLE_ENTRIES, 'glow', label)
    expect(hits.length).toBeGreaterThan(1)
    // "Glow" (exact prefix) ranks above "… on hover" substring hits
    expect(hits[0].score).toBe(0)
    expect(hits.map((h) => h.key)).toContain('glowOnHover')
    // extra words: "dark" finds the theme
    expect(searchStyleEntries(STYLE_ENTRIES, 'dark', label)[0].key).toBe('theme')
    // every word must match
    expect(searchStyleEntries(STYLE_ENTRIES, 'glow zzz', label)).toEqual([])
    expect(searchStyleEntries(STYLE_ENTRIES, '   ', label)).toEqual([])
  })

  it('search puts the app layer, then the current view, first within a score', () => {
    const hits = searchStyleEntries(STYLE_ENTRIES, 'atmosphere', label, () => '', 'timeline')
    const scopes = hits.map((h) => h.scope)
    expect(scopes.indexOf('timeline')).toBeLessThan(scopes.indexOf('graph'))
  })

  it('folds case and accents', () => {
    expect(foldText('Ensō ÆBLE')).toBe('enso æble')
  })

  it('counts tuned keys and builds a chapter reset patch', () => {
    const defaults = { a: 1, b: 'x', c: true }
    expect(countTuned({ a: 1, b: 'y', c: false }, defaults, ['a', 'b', 'c'])).toBe(2)
    expect(countTuned({ a: 1 }, defaults, ['missing'])).toBe(0)
    expect(defaultsPatch(defaults, ['b', 'missing'])).toEqual({ b: 'x' })
  })

  it('knows which way the chapter strip travels', () => {
    const list = VIEW_CHAPTERS.graph
    expect(chapterDirection(list, 'looks', 'lines')).toBe(1)
    expect(chapterDirection(list, 'lines', 'looks')).toBe(-1)
  })
})
