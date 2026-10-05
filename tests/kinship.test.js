import { describe, it, expect } from 'vitest'
import {
  buildKinIndex,
  bloodFrom,
  kinshipLens,
  kinshipBetween,
  walkChain,
  makeKinshipCoefficient,
  expectedCM,
  bloodBand,
  ancestorFan,
  pedigreeStats,
  linchpins,
  islands,
  founders,
  tangledCouples,
  sexOf,
  kinRoute
} from '../src/renderer/src/components/kinship/kinshipGraph'
import {
  kinName,
  enBlood,
  chainPhrase,
  toTraditional
} from '../src/renderer/src/components/kinship/kinshipNames'
import { makeQuiz, makeRng } from '../src/renderer/src/components/kinship/kinshipQuiz'

// A three-generation family with every kind of kin the engine names.
const P = (id, gender, year) => ({ id, name: id, gender, birth: year ? { year } : null })
const persons = [
  P('GF', 'male', 1930),
  P('GM', 'female', 1932),
  P('Uncle', 'male', 1955),
  P('Dad', 'male', 1960),
  P('Aunt', 'female', 1963),
  P('Mom', 'female', 1962),
  P('MGM', 'female', 1935),
  P('MomSis', 'female', 1965),
  P('Me', 'male', 1990),
  P('Sis', 'female', 1985),
  P('UncleWife', 'female', 1957),
  P('Cousin', 'male', 1992),
  P('AuntHusband', 'male', 1960),
  P('Cousin2', 'female', 1980),
  P('CousinKid', 'female', 2015),
  P('Wife', 'female', 1991),
  P('WF', 'male', 1961),
  P('WM', 'female', 1963),
  P('WB', 'male', 1980),
  P('Son', 'male', 2018),
  P('Grandson', 'male', 2045),
  P('DIL', 'female', 2019),
  P('DILF', 'male', 1990),
  P('SisHusband', 'male', 1984),
  P('Niece', 'female', 2012),
  P('StepMom', 'female', 1970),
  P('StepBro', 'male', 1995),
  P('HalfBro', 'male', 2000),
  P('Buddy', 'male', 1990),
  P('Stranger', 'male', 1990)
]
let n = 0
const R = (a, b, type = 'parent_child', extra = {}) => ({
  id: 'r' + ++n,
  person_a_id: a,
  person_b_id: b,
  type,
  status: 'active',
  ...extra
})
const rels = [
  R('GF', 'GM', 'spouse'),
  R('GF', 'Uncle'),
  R('GM', 'Uncle'),
  R('GF', 'Dad'),
  R('GM', 'Dad'),
  R('GF', 'Aunt'),
  R('GM', 'Aunt'),
  R('Dad', 'Mom', 'spouse'),
  R('Dad', 'Me'),
  R('Mom', 'Me'),
  R('Dad', 'Sis'),
  R('Mom', 'Sis'),
  R('MGM', 'Mom'),
  R('MGM', 'MomSis'),
  R('Uncle', 'UncleWife', 'spouse'),
  R('Uncle', 'Cousin'),
  R('UncleWife', 'Cousin'),
  R('Aunt', 'AuntHusband', 'spouse'),
  R('Aunt', 'Cousin2'),
  R('AuntHusband', 'Cousin2'),
  R('Cousin', 'CousinKid'),
  R('Me', 'Wife', 'spouse'),
  R('WF', 'WM', 'spouse'),
  R('WF', 'Wife'),
  R('WM', 'Wife'),
  R('WF', 'WB'),
  R('WM', 'WB'),
  R('Me', 'Son'),
  R('Wife', 'Son'),
  R('Son', 'Grandson'),
  R('Son', 'DIL', 'spouse'),
  R('DILF', 'DIL'),
  R('Sis', 'SisHusband', 'spouse'),
  R('Sis', 'Niece'),
  R('SisHusband', 'Niece'),
  R('Dad', 'StepMom', 'spouse'),
  R('StepMom', 'StepBro'),
  R('Dad', 'HalfBro'),
  R('StepMom', 'HalfBro'),
  R('Me', 'Buddy', 'friends')
]
const index = buildKinIndex(persons, rels)
const lens = kinshipLens(index, 'Me')
const socialLabel = (rel) => (rel.type === 'friends' ? 'Friend' : rel.type)
const nameIn = (lang, id, anchor = 'Me', L = lens) =>
  kinName(L.get(id), lang, { index, anchor, target: id, socialLabel })

describe('sexOf', () => {
  it('reads the gender gradient before the label', () => {
    expect(sexOf({ id: 'a', gender_t: 0 })).toBe('m')
    expect(sexOf({ id: 'a', gender_t: 1 })).toBe('f')
    expect(sexOf({ id: 'a', gender_t: 0.5 })).toBe('x')
    expect(sexOf({ id: 'a', gender: 'female' })).toBe('f')
    expect(sexOf({ id: 'a', gender: 'male' })).toBe('m')
    expect(sexOf({ id: 'a', gender: 'unknown' })).toBe('x')
  })
})

describe('bloodFrom', () => {
  it('finds the closest common ancestor on each side', () => {
    const b = bloodFrom(index, 'Me')
    expect(b.get('Dad')).toMatchObject({ up: 1, down: 0 })
    expect(b.get('GF')).toMatchObject({ up: 2, down: 0 })
    expect(b.get('Sis')).toMatchObject({ up: 1, down: 1, half: false })
    expect(b.get('Cousin')).toMatchObject({ up: 2, down: 2 })
    expect(b.get('CousinKid')).toMatchObject({ up: 2, down: 3 })
    expect(b.get('Grandson')).toMatchObject({ up: 0, down: 2 })
    expect(b.get('Wife')).toBeUndefined()
  })
  it('flags half-siblings only when both sides have a second parent', () => {
    expect(bloodFrom(index, 'Me').get('HalfBro')).toMatchObject({ up: 1, down: 1, half: true })
  })
  it('records both shared grandparents of a full cousin', () => {
    expect(bloodFrom(index, 'Me').get('Cousin').cas.sort()).toEqual(['GF', 'GM'])
  })
})

describe('kinshipLens — English', () => {
  const cases = {
    Dad: 'father',
    Mom: 'mother',
    GF: 'grandfather',
    MGM: 'grandmother',
    Uncle: 'uncle',
    Aunt: 'aunt',
    Sis: 'sister',
    HalfBro: 'half-brother',
    Cousin: 'first cousin',
    Cousin2: 'first cousin',
    CousinKid: 'first cousin once removed',
    Niece: 'niece',
    Son: 'son',
    Grandson: 'grandson',
    Wife: 'wife',
    WF: 'father-in-law',
    WM: 'mother-in-law',
    WB: 'brother-in-law',
    SisHusband: 'brother-in-law',
    UncleWife: 'aunt by marriage',
    DIL: 'daughter-in-law',
    DILF: 'co-father-in-law',
    StepMom: 'stepmother',
    StepBro: 'stepbrother',
    Buddy: 'Friend'
  }
  for (const [id, want] of Object.entries(cases)) {
    it(`${id} → ${want}`, () => expect(nameIn('en', id)).toBe(want))
  }
  it('names unrelated people as not connected', () => {
    expect(lens.get('Stranger')).toBeUndefined()
    expect(nameIn('en', 'Stranger')).toBe('not connected')
  })
  it('names the reverse direction too', () => {
    const { ab, ba } = kinshipBetween(index, 'Me', 'CousinKid')
    expect(ab.kind).toBe('blood')
    expect(kinName(ba, 'en', { index, anchor: 'CousinKid', target: 'Me' })).toBe(
      'first cousin once removed'
    )
    const r = kinshipBetween(index, 'Me', 'GF')
    expect(kinName(r.ba, 'en', { index, anchor: 'GF', target: 'Me' })).toBe('grandson')
  })
})

describe('enBlood — the cousin chart', () => {
  it('handles greats, degrees and removals', () => {
    expect(enBlood(3, 0, 'f')).toBe('great-grandmother')
    expect(enBlood(4, 0, 'm')).toBe('great-great-grandfather')
    expect(enBlood(5, 0, 'm')).toBe('3rd great-grandfather')
    expect(enBlood(3, 1, 'm')).toBe('great-uncle')
    expect(enBlood(1, 3, 'f')).toBe('great-niece')
    expect(enBlood(3, 3, 'x')).toBe('second cousin')
    expect(enBlood(3, 5, 'x')).toBe('second cousin twice removed')
    expect(enBlood(2, 2, 'x', true)).toBe('half first cousin')
    expect(enBlood(1, 0, 'm', false, true)).toBe('adoptive father')
  })
})

describe('kinshipLens — Chinese', () => {
  const cases = {
    Dad: '父亲',
    GF: '爷爷',
    MGM: '外婆',
    Uncle: '伯父', // older than Dad
    Aunt: '姑姑',
    MomSis: '姨妈',
    Cousin: '堂弟', // father's brother's son, younger than me
    Cousin2: '表姐', // father's sister's daughter, older
    Sis: '姐姐',
    Niece: '外甥女',
    Grandson: '孙子',
    Wife: '妻子',
    WF: '岳父',
    WB: '大舅子', // older than my wife
    SisHusband: '姐夫',
    UncleWife: '伯母',
    DIL: '儿媳',
    DILF: '亲家公',
    StepMom: '继母',
    HalfBro: '同父异母的弟弟',
    CousinKid: '堂侄女'
  }
  for (const [id, want] of Object.entries(cases)) {
    it(`${id} → ${want}`, () => expect(nameIn('zh-Hans', id)).toBe(want))
  }
  it('converts to Traditional', () => {
    expect(nameIn('zh-Hant', 'GF')).toBe('爺爺')
    expect(nameIn('zh-Hant', 'DILF')).toBe('親家公')
    expect(toTraditional('继母')).toBe('繼母')
  })
})

describe('kinshipLens — Norsk', () => {
  const cases = {
    GF: 'farfar',
    MGM: 'mormor',
    Uncle: 'farbror',
    Aunt: 'faster',
    MomSis: 'moster',
    Cousin: 'fetter',
    Cousin2: 'kusine',
    WF: 'svigerfar',
    WB: 'svoger',
    Grandson: 'sønnesønn',
    DIL: 'svigerdatter',
    StepMom: 'stemor',
    HalfBro: 'halvbror'
  }
  for (const [id, want] of Object.entries(cases)) {
    it(`${id} → ${want}`, () => expect(nameIn('no', id)).toBe(want))
  }
})

describe('walkChain', () => {
  it("follows a spoken chain: mother's sister, father's brother's son", () => {
    expect([...walkChain(index, 'Me', ['M', 'Z'])]).toEqual(['MomSis'])
    expect([...walkChain(index, 'Me', ['F', 'B', 'S'])]).toEqual(['Cousin'])
    expect([...walkChain(index, 'Me', ['W', 'B'])]).toEqual(['WB'])
    expect(walkChain(index, 'Me', ['F', 'F', 'F']).size).toBe(0)
  })
  it('speaks the chain', () => {
    expect(chainPhrase(['M', 'B', 'D'], 'en')).toBe("Mother's brother's daughter")
    expect(chainPhrase(['M', 'B', 'D'], 'no')).toBe('mors brors datter')
    expect(chainPhrase(['M', 'B', 'D'], 'zh-Hans')).toBe('母亲的兄弟的女儿')
  })
})

describe('kinRoute', () => {
  it('arches a cousin route through the common ancestor', () => {
    const r = kinRoute(index, 'Me', 'Cousin', lens.get('Cousin'))
    expect(r.map((p) => p.level)).toEqual([0, 1, 2, 1, 0])
    expect(r.find((p) => p.keystone).id).toMatch(/^G[FM]$/)
    expect(r[r.length - 1].id).toBe('Cousin')
  })
  it('walks marriages as level hops', () => {
    const r = kinRoute(index, 'Me', 'WF', lens.get('WF'))
    expect(r.map((p) => [p.id, p.level, p.via])).toEqual([
      ['Me', 0, 'start'],
      ['Wife', 0, 'marriage'],
      ['WF', 1, 'up']
    ])
    const s = kinRoute(index, 'Me', 'StepBro', lens.get('StepBro'))
    expect(s.map((p) => p.id)).toEqual(['Me', 'Dad', 'StepMom', 'StepBro'])
  })
})

describe('shared blood', () => {
  const c = makeKinshipCoefficient(index)
  it('computes Wright relatedness', () => {
    expect(c.relatedness('Me', 'Dad')).toBeCloseTo(0.5)
    expect(c.relatedness('Me', 'Sis')).toBeCloseTo(0.5)
    expect(c.relatedness('Me', 'HalfBro')).toBeCloseTo(0.25)
    expect(c.relatedness('Me', 'Cousin')).toBeCloseTo(0.125)
    expect(c.relatedness('Me', 'CousinKid')).toBeCloseTo(0.0625)
    expect(c.relatedness('Me', 'Wife')).toBe(0)
  })
  it('estimates shared cM', () => {
    expect(expectedCM(0.125)).toBeGreaterThan(800)
    expect(expectedCM(0.5, true)).toBeLessThan(expectedCM(0.5))
  })
  it('detects a cousin marriage and the child it would inbreed', () => {
    const extra = [
      ...rels,
      R('Cousin', 'Cousin2', 'spouse'),
      R('Cousin', 'Kid'),
      R('Cousin2', 'Kid')
    ]
    const idx = buildKinIndex([...persons, P('Kid', 'female', 2020)], extra)
    const tangled = tangledCouples(idx)
    expect(tangled[0]).toMatchObject({ phi: 1 / 16 })
    expect(makeKinshipCoefficient(idx).F('Kid')).toBeCloseTo(1 / 16)
    expect(bloodBand(1 / 16)).toBe('cousins')
    // …and the lens keeps both ties: wife AND first cousin.
    const l = kinshipLens(idx, 'Cousin')
    expect(l.get('Cousin2').kind).toBe('spouse')
    expect(l.get('Cousin2').also[0]).toMatchObject({ kind: 'blood', up: 2, down: 2 })
  })
  it('bands consanguinity', () => {
    expect(bloodBand(0)).toBe('none')
    expect(bloodBand(0.25)).toBe('habsburg')
    expect(bloodBand(1 / 64)).toBe('distant')
  })
})

describe('pedigree', () => {
  it('lays out the ancestor fan paternal-first', () => {
    const fan = ancestorFan(index, 'Me', 2)
    expect(fan[1].map((s) => s.id)).toEqual(['Dad', 'Mom'])
    expect(fan[2].map((s) => s.id)).toEqual(['GF', 'GM', null, 'MGM'])
  })
  it('measures pedigree collapse', () => {
    const extra = [
      ...rels,
      R('Cousin', 'Cousin2', 'spouse'),
      R('Cousin', 'Kid'),
      R('Cousin2', 'Kid')
    ]
    const idx = buildKinIndex([...persons, P('Kid', 'female', 2020)], extra)
    const s = pedigreeStats(idx, 'Kid', 4)
    expect(s.collapse).toBeGreaterThan(0) // GF + GM fill two slots each
    expect(pedigreeStats(index, 'Me', 4).collapse).toBe(0)
  })
})

describe('structure', () => {
  it('finds bridge people', () => {
    const top = linchpins(index)
    expect(top.length).toBeGreaterThan(0)
    // Me holds my wife's family, my descendants and Buddy to the rest.
    expect(top.find((x) => x.id === 'Me')).toBeTruthy()
    expect(top.find((x) => x.id === 'Stranger')).toBeUndefined()
  })
  it('counts islands and founders', () => {
    const isl = islands(index)
    expect(isl[0].length).toBe(persons.length - 1)
    expect(isl[isl.length - 1]).toEqual(['Stranger'])
    const f = founders(index)
    expect(f[0].id === 'GF' || f[0].id === 'GM').toBe(true)
  })
})

describe('quiz', () => {
  it('builds answerable questions deterministically', () => {
    const nameOf = (k, a, b) => kinName(k, 'en', { index, anchor: a, target: b, socialLabel })
    const q1 = makeQuiz(index, nameOf, makeRng(7), 8)
    const q2 = makeQuiz(index, nameOf, makeRng(7), 8)
    expect(q1.length).toBeGreaterThanOrEqual(5)
    expect(q1).toEqual(q2)
    for (const q of q1) {
      expect(q.options.some((o) => o.key === q.answer)).toBe(true)
      expect(new Set(q.options.map((o) => o.key)).size).toBe(q.options.length)
    }
  })
})
