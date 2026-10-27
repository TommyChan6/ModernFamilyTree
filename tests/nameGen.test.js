import { describe, it, expect } from 'vitest'
import {
  makeRng,
  trainModel,
  generateNames,
  capitalizeName,
  editDistance,
  isDegenerate,
  normalizeName,
  splitSyllables,
  ngramProfile,
  profileSimilarity,
  closestCorpus,
  suggestNames,
  splitFullName,
  detectSurnameFirst,
  mostCommon,
  genderSurname,
  patronym,
  genderFromT,
  tagShare
} from '../src/renderer/src/lib/nameGen'
import { NAME_CORPORA, corpusById } from '../src/renderer/src/lib/nameCorpora'

const english = corpusById('english')
const japanese = corpusById('japanese')
const chinese = corpusById('chinese')
const norse = corpusById('norse')
const slavic = corpusById('slavic')

const overlap = (names, corpusNames) =>
  profileSimilarity(ngramProfile(names, 3), ngramProfile(corpusNames, 3))

describe('rng', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const a = makeRng(42)
    const b = makeRng(42)
    const c = makeRng('other')
    const sa = [a(), a(), a()]
    expect([b(), b(), b()]).toEqual(sa)
    expect([c(), c(), c()]).not.toEqual(sa)
    for (const v of sa) expect(v >= 0 && v < 1).toBe(true)
  })
})

describe('corpora', () => {
  it('have ids, label keys and enough names', () => {
    const ids = new Set()
    for (const c of NAME_CORPORA) {
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.labelKey).toBe(`nameGen.corpus.${c.id}`)
      expect(c.male.length).toBeGreaterThanOrEqual(30)
      expect(c.female.length).toBeGreaterThanOrEqual(30)
      if (!c.patronymic) expect(c.surnames.length).toBeGreaterThanOrEqual(20)
    }
  })
})

describe('generateNames', () => {
  const model = trainModel([{ names: english.male }])

  it('is reproducible with a seed', () => {
    const a = generateNames(model, { count: 8, seed: 7 })
    const b = generateNames(model, { count: 8, seed: 7 })
    const c = generateNames(model, { count: 8, seed: 8 })
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
    expect(a).toHaveLength(8)
    expect(new Set(a).size).toBe(8)
  })

  it('never returns training names or near-copies of short ones', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const name of generateNames(model, { count: 6, seed, relax: false })) {
        const n = normalizeName(name)
        for (const t of english.male.map(normalizeName)) {
          expect(n).not.toBe(t)
          if (n.length <= 7 && n.length > 3) expect(editDistance(n, t)).toBeGreaterThan(1)
        }
      }
    }
  })

  it('respects length bounds', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const out = generateNames(model, { count: 6, seed, minLen: 5, maxLen: 7 })
      expect(out.length).toBeGreaterThan(0)
      for (const n of out) {
        expect(n.length).toBeGreaterThanOrEqual(5)
        expect(n.length).toBeLessThanOrEqual(7)
      }
    }
  })

  it('rejects degenerate output', () => {
    expect(isDegenerate('bbbo')).toBe(true)
    expect(isDegenerate('brkt')).toBe(true) // no vowel in a Latin corpus
    expect(isDegenerate("o'")).toBe(true)
    expect(isDegenerate('momomoko')).toBe(true)
    expect(isDegenerate('edric')).toBe(false)
    for (let seed = 1; seed <= 10; seed++) {
      for (const n of generateNames(model, { count: 6, seed })) {
        expect(isDegenerate(n)).toBe(false)
      }
    }
  })
})

describe('capitalisation', () => {
  it('handles hyphens, apostrophes and Mc', () => {
    expect(capitalizeName('jean-luc')).toBe('Jean-Luc')
    expect(capitalizeName("o'neill")).toBe("O'Neill")
    expect(capitalizeName("d'arcy")).toBe("D'Arcy")
    expect(capitalizeName("ji'an")).toBe("Ji'an")
    expect(capitalizeName('mcleod')).toBe('McLeod')
    expect(capitalizeName('ÁSGEIR')).toBe('Ásgeir')
    expect(capitalizeName('mary ann')).toBe('Mary Ann')
  })

  it('every generated name starts with a capital', () => {
    const celtic = corpusById('celtic')
    const model = trainModel([{ names: celtic.surnames }])
    for (const n of generateNames(model, { count: 12, seed: 3 })) {
      expect(n[0]).toBe(n[0].toUpperCase())
      expect(n.slice(1)).not.toMatch(/[A-Z]{2}/)
    }
  })
})

describe('syllable mode', () => {
  it('splits pinyin and romaji', () => {
    expect(splitSyllables('Xiuying', 'pinyin')).toEqual(['xiu', 'ying'])
    expect(splitSyllables('Shangguan', 'pinyin')).toEqual(['shang', 'guan'])
    expect(splitSyllables('Jianan', 'pinyin')).toEqual(['jia', 'nan'])
    expect(splitSyllables('Hattori', 'romaji')).toEqual(['ha', 't', 'to', 'ri'])
    expect(splitSyllables('Kenji', 'romaji')).toEqual(['ke', 'n', 'ji'])
  })

  it('builds names out of whole corpus syllables', () => {
    const syl = new Set(
      [...chinese.male, ...chinese.female].flatMap((n) => splitSyllables(n, 'pinyin'))
    )
    const model = trainModel([{ names: [...chinese.male, ...chinese.female] }], {
      mode: 'syllable',
      scheme: 'pinyin',
      maxSyllables: 2
    })
    const out = generateNames(model, { count: 10, seed: 5 })
    expect(out.length).toBe(10)
    const train = new Set([...chinese.male, ...chinese.female].map(normalizeName))
    for (const n of out) {
      const parts = splitSyllables(n, 'pinyin')
      expect(parts.length).toBeGreaterThanOrEqual(1)
      expect(parts.length).toBeLessThanOrEqual(2)
      for (const p of parts) expect(syl.has(p)).toBe(true)
      expect(train.has(normalizeName(n).replace(/'/g, ''))).toBe(false)
    }
  })

  it('Japanese suggestions put the surname first', () => {
    const s = suggestNames({ corpus: japanese, gender: 'f', seed: 2 })
    expect(s.length).toBe(6)
    for (const x of s) {
      expect(x.surnameFirst).toBe(true)
      expect(x.full).toBe(`${x.surname} ${x.given}`)
    }
  })

  it('Chinese surnames are drawn from the closed list', () => {
    for (const x of suggestNames({ corpus: chinese, seed: 9 })) {
      expect(chinese.surnames).toContain(x.surname)
    }
  })
})

describe('per-tag training', () => {
  // A "house" whose names are all Japanese-sounding, blended with English.
  const house = {
    given: [
      'Akira',
      'Haruto',
      'Kenji',
      'Takumi',
      'Hiroshi',
      'Satoshi',
      'Daisuke',
      'Makoto',
      'Yusuke',
      'Kazuki',
      'Ryota',
      'Shota',
      'Naoki',
      'Kenta'
    ].map((name) => ({ name, gender: 'm' })),
    surnames: ['Tanaka', 'Tanaka', 'Tanaka', 'Mori']
  }

  it('shifts the output toward the tag', () => {
    const plain = []
    const tagged = []
    for (let seed = 1; seed <= 8; seed++) {
      plain.push(...suggestNames({ corpus: english, gender: 'm', seed }).map((s) => s.given))
      tagged.push(
        ...suggestNames({ corpus: english, gender: 'm', tag: house, seed }).map((s) => s.given)
      )
    }
    const tagNames = house.given.map((g) => g.name)
    expect(overlap(tagged, tagNames)).toBeGreaterThan(overlap(plain, tagNames))
    expect(overlap(tagged, tagNames)).toBeGreaterThan(overlap(tagged, english.male) * 0.8)
  })

  it('weights the tag by its sample count', () => {
    expect(tagShare(0)).toBe(0)
    expect(tagShare(2)).toBeLessThan(tagShare(20))
    expect(tagShare(1000)).toBeGreaterThan(0.95)
  })

  it('uses the most common tag surname', () => {
    for (const s of suggestNames({ corpus: english, tag: house, seed: 4 })) {
      expect(s.surname).toBe('Tanaka')
      expect(s.surnameFrom).toBe('tag')
    }
  })

  it('finds the culture a tag sounds like', () => {
    expect(closestCorpus(['Ragnar', 'Sigrid', 'Thorstein', 'Gunnhild'], NAME_CORPORA).id).toBe(
      'norse'
    )
    expect(closestCorpus(['Tullius', 'Aurelia', 'Marcus', 'Cornelia'], NAME_CORPORA).id).toBe(
      'roman'
    )
    // a shared house surname counts once, not once per member
    const andersons = ['Lucas', 'Sarah', 'James', 'Dorothy', 'Robert'].map((g) => `${g} Anderson`)
    expect(closestCorpus(andersons, NAME_CORPORA).id).toBe('english')
    expect(closestCorpus(['Tanaka Hiroshi', 'Tanaka Yumi', 'Mori Kenji'], NAME_CORPORA).id).toBe(
      'japanese'
    )
    expect(closestCorpus([], NAME_CORPORA)).toBe(null)
  })

  it('never re-suggests the tag members themselves', () => {
    const tagNames = new Set(house.given.map((g) => normalizeName(g.name)))
    for (let seed = 1; seed <= 5; seed++) {
      for (const s of suggestNames({ corpus: japanese, tag: house, seed })) {
        expect(tagNames.has(normalizeName(s.given))).toBe(false)
      }
    }
  })
})

describe('surnames and gender', () => {
  it("prefers the parents' surname, father first", () => {
    const s = suggestNames({
      corpus: english,
      gender: 'm',
      parents: [
        { given: 'Maud', surname: 'Fairfax', gender: 'f' },
        { given: 'Hugh', surname: 'Thornton', gender: 'm' }
      ],
      seed: 1
    })
    expect(s[0].surname).toBe('Thornton')
    expect(s[0].surnameFrom).toBe('parent')
    expect(s.map((x) => x.surname)).toContain('Fairfax')
  })

  it("keeps the parents' own name order for an inherited surname", () => {
    const s = suggestNames({
      corpus: japanese,
      gender: 'f',
      parents: [{ given: 'Sarah', surname: 'Anderson', gender: 'f' }],
      familySurnameFirst: false,
      seed: 1
    })
    for (const x of s) {
      expect(x.surname).toBe('Anderson')
      expect(x.surnameFirst).toBe(false)
      expect(x.full).toBe(`${x.given} Anderson`)
    }
  })

  it('builds Norse patronymics from the father', () => {
    const s = suggestNames({
      corpus: norse,
      gender: 'f',
      parents: [{ given: 'Harald', surname: '', gender: 'm' }],
      seed: 1
    })
    for (const x of s) expect(x.surname).toBe('Haraldsdottir')
    expect(patronym('Magnus', 'm', norse.patronymic)).toBe('Magnusson')
  })

  it('genders Slavic surnames', () => {
    expect(genderSurname('Ivanov', 'f', slavic.femSurname)).toBe('Ivanova')
    expect(genderSurname('Kowalski', 'f', slavic.femSurname)).toBe('Kowalska')
    expect(genderSurname('Dubrovsky', 'f', slavic.femSurname)).toBe('Dubrovskaya')
    expect(genderSurname('Ivanova', 'm', slavic.femSurname)).toBe('Ivanov')
    expect(genderSurname('Novak', 'f', slavic.femSurname)).toBe('Novak')
    const s = suggestNames({
      corpus: slavic,
      gender: 'f',
      parents: [{ given: 'Ivan', surname: 'Petrov', gender: 'm' }],
      seed: 1
    })
    for (const x of s) expect(x.surname).toBe('Petrova')
  })

  it('draws gendered given names from the right sub-corpus', () => {
    const f = []
    const m = []
    for (let seed = 1; seed <= 6; seed++) {
      f.push(...suggestNames({ corpus: english, gender: 'f', seed }).map((s) => s.given))
      m.push(...suggestNames({ corpus: english, gender: 'm', seed }).map((s) => s.given))
    }
    expect(overlap(f, english.female)).toBeGreaterThan(overlap(f, english.male))
    expect(overlap(m, english.male)).toBeGreaterThan(overlap(m, english.female))
  })

  it('maps gender_t and parses names', () => {
    expect(genderFromT(0)).toBe('m')
    expect(genderFromT(1)).toBe('f')
    expect(genderFromT(0.5)).toBe(null)
    expect(genderFromT(null)).toBe(null)
    expect(splitFullName('Ellen Louise Ripley')).toEqual({ given: 'Ellen', surname: 'Ripley' })
    expect(splitFullName('Wang Xiuying', true)).toEqual({ given: 'Xiuying', surname: 'Wang' })
    expect(splitFullName('Cher')).toEqual({ given: 'Cher', surname: '' })
    expect(detectSurnameFirst(['Arya Stark', 'Sansa Stark', 'Jon Snow', 'Robb Stark'])).toBe(false)
    expect(detectSurnameFirst(['Wang Wei', 'Wang Fang', 'Wang Lei', 'Li Na'])).toBe(true)
    expect(detectSurnameFirst(['A B'])).toBe(null)
    expect(mostCommon(['Snow', 'stark', 'Stark', 'Snow', 'Stark'])).toBe('stark')
  })
})
