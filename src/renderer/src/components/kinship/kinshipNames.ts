// Kinship naming — turns the structural Kin records from kinshipGraph.ts into
// words, in four naming systems that genuinely think differently:
//
//  • English   — the cousin chart: degree + "removed", greats, -in-law.
//  • Norsk     — compositional: farfar / mormor, farbror / moster, fetter /
//                kusine, tremenning, svoger / svigerinne.
//  • 简体/繁體  — Chinese kinship distinguishes paternal vs maternal side (堂 /
//                表, 爷爷 / 外公), relative age (伯父 / 叔叔, 哥哥 / 弟弟) and
//                who married in (嫂子 / 弟媳). Names are read off the actual
//                link chain, relationship.js-style, with a "的" chain fallback
//                ("表哥的女儿") so any relative gets a correct phrase.
//
// Pure: everything it needs about people comes through the KinIndex.

import type { Kin, KinIndex, KRel, Sex, Tok, ChainStep } from './kinshipGraph'
import { kinChain, isOlder } from './kinshipGraph'

export type KinLang = 'en' | 'no' | 'zh-Hans' | 'zh-Hant'
export const KIN_LANGS: { code: KinLang; label: string; short: string }[] = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'no', label: 'Norsk', short: 'NO' },
  { code: 'zh-Hans', label: '简体中文', short: '简' },
  { code: 'zh-Hant', label: '繁體中文', short: '繁' }
]

export interface NameCtx {
  index: KinIndex
  anchor: string
  target: string
  /** a social edge's role from the anchor's side ("Mentor", "Rival") */
  socialLabel?: (rel: KRel, anchor: string) => string
}

const by = (sex: Sex, m: string, f: string, x: string) => (sex === 'm' ? m : sex === 'f' ? f : x)

// ── English ─────────────────────────────────────────────────────────────────

const ORD = [
  'zeroth',
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth'
]
function ordNum(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
const ordinal = (n: number) => ORD[n] || ordNum(n)
const times = (n: number) =>
  n === 1 ? 'once' : n === 2 ? 'twice' : n === 3 ? 'thrice' : `${n} times`
/** great- prefixes: 1 → great-, 2 → great-great-, 3+ → "3rd great-" */
function greats(n: number) {
  if (n <= 0) return ''
  if (n === 1) return 'great-'
  if (n === 2) return 'great-great-'
  return `${ordNum(n)} great-`
}

/** The bare cousin-chart name for (up, down). */
export function enBlood(up: number, down: number, sex: Sex, half = false, adoptive = false) {
  let core: string
  let halfable = true
  if (up === 0 && down === 0) return 'themself'
  if (down === 0) {
    halfable = false
    const w = by(sex, 'father', 'mother', 'parent')
    core = up === 1 ? w : `${greats(up - 2)}grand${w}`
  } else if (up === 0) {
    halfable = false
    const w = by(sex, 'son', 'daughter', 'child')
    core = down === 1 ? w : `${greats(down - 2)}grand${w}`
  } else if (up === 1 && down === 1) {
    core = by(sex, 'brother', 'sister', 'sibling')
  } else if (down === 1) {
    core = greats(up - 2) + by(sex, 'uncle', 'aunt', 'aunt/uncle')
  } else if (up === 1) {
    core = greats(down - 2) + by(sex, 'nephew', 'niece', 'niece/nephew')
  } else {
    const deg = Math.min(up, down) - 1
    const rem = Math.abs(up - down)
    core = `${ordinal(deg)} cousin${rem ? ` ${times(rem)} removed` : ''}`
    if (half) return 'half ' + core + (adoptive ? ' (by adoption)' : '')
  }
  if (half && halfable) core = 'half-' + core
  if (adoptive) {
    if (down === 0) return 'adoptive ' + core
    if (up === 0) return 'adopted ' + core
    return core + ' (by adoption)'
  }
  return core
}

const EN_SPOUSE_POS: Record<Sex, string> = { m: "husband's", f: "wife's", x: "spouse's" }
const EN_SPOUSE: Record<Sex, string> = { m: 'husband', f: 'wife', x: 'spouse' }

function enSpouse(k: Kin) {
  const partner = k.spouseType && k.spouseType !== 'spouse'
  if (k.ended) return partner ? 'ex-partner' : 'ex-' + EN_SPOUSE[k.sex]
  if (k.status === 'engaged') return by(k.sex, 'fiancé', 'fiancée', 'betrothed')
  if (partner) return 'partner'
  return EN_SPOUSE[k.sex]
}

function enStep(k: Kin) {
  const pre = k.viaEnded ? 'former ' : ''
  if (k.down === 0)
    return pre + (k.up === 1 ? 'step' : 'step-grand') + by(k.sex, 'father', 'mother', 'parent')
  if (k.up === 0)
    return pre + (k.down === 1 ? 'step' : 'step-grand') + by(k.sex, 'son', 'daughter', 'child')
  return pre + 'step' + by(k.sex, 'brother', 'sister', 'sibling')
}

function enInlaw(k: Kin, ctx: NameCtx) {
  const pre = k.viaEnded ? 'former ' : ''
  const core = enBlood(k.up, k.down, k.sex, k.half)
  if (k.up === 0) return pre + 'step-' + core
  if (!core.includes(' ')) return pre + core + '-in-law'
  const via = ctx.index.sex.get(k.via!) || 'x'
  return `${pre}${EN_SPOUSE_POS[via]} ${core}`
}

function enAffine(k: Kin) {
  const pre = k.viaEnded ? 'former ' : ''
  const { up, down, sex } = k
  if (down === 0) return pre + 'step-' + enBlood(up, 0, sex)
  if (up === 0 || (up === 1 && down >= 1)) {
    // son-in-law, grandson-in-law, brother-in-law, nephew-in-law
    return pre + enBlood(up, down, sex) + '-in-law'
  }
  if (down === 1) return pre + enBlood(up, down, sex) + ' by marriage'
  // A cousin's spouse: "first cousin's wife"
  const rel = enBlood(up, down, 'x')
  return `${pre}${rel}'s ${EN_SPOUSE[sex]}`
}

function enName(k: Kin, ctx: NameCtx): string {
  switch (k.kind) {
    case 'self':
      return 'themself'
    case 'blood':
      return enBlood(k.up, k.down, k.sex, k.half, k.adoptive)
    case 'spouse':
      return enSpouse(k)
    case 'step':
      return enStep(k)
    case 'inlaw':
      return enInlaw(k, ctx)
    case 'affine':
      return enAffine(k)
    case 'coparent':
      return 'co-' + by(k.sex, 'father', 'mother', 'parent') + '-in-law'
    case 'social':
      return (k.rel && ctx.socialLabel?.(k.rel, ctx.anchor)) || k.rel?.type || 'connection'
    case 'distant':
      return k.hops === 1 ? 'linked' : `${k.hops} links away`
  }
}

// ── Norsk ───────────────────────────────────────────────────────────────────

const NO_SPOUSE: Record<Sex, string> = { m: 'mann', f: 'kone', x: 'ektefelle' }
const NO_SPOUSE_GEN: Record<Sex, string> = { m: 'mannens', f: 'konas', x: 'ektefellens' }
const gen = (w: string) => (/[sx]$/.test(w) ? w : w + 's')

function noBlood(
  up: number,
  down: number,
  sex: Sex,
  half: boolean,
  adoptive: boolean,
  side: Sex,
  firstChild: Sex
) {
  if (up === 0 && down === 0) return 'seg selv'
  let w: string
  let removedNote = ''
  if (down === 0) {
    if (up === 1) w = by(sex, 'far', 'mor', 'forelder')
    else if (up === 2) {
      if (side === 'm') w = by(sex, 'farfar', 'farmor', 'besteforelder')
      else if (side === 'f') w = by(sex, 'morfar', 'mormor', 'besteforelder')
      else w = by(sex, 'bestefar', 'bestemor', 'besteforelder')
    } else w = 'tipp'.repeat(Math.max(0, up - 3)) + by(sex, 'oldefar', 'oldemor', 'oldeforelder')
    if (adoptive) return 'adoptiv' + w
    return w
  }
  if (up === 0) {
    if (down === 1) w = by(sex, 'sønn', 'datter', 'barn')
    else if (down === 2) {
      if (firstChild === 'm') w = by(sex, 'sønnesønn', 'sønnedatter', 'sønnebarn')
      else if (firstChild === 'f') w = by(sex, 'dattersønn', 'datterdatter', 'datterbarn')
      else w = 'barnebarn'
    } else w = 'tipp'.repeat(Math.max(0, down - 3)) + 'oldebarn'
    if (adoptive) return 'adoptiv' + w
    return w
  }
  if (up === 1 && down === 1) {
    w = by(sex, 'bror', 'søster', 'søsken')
    return (half ? 'halv' + w : w) + (adoptive ? ' (adoptiv)' : '')
  }
  if (down === 1) {
    if (up === 2) {
      if (side === 'm') w = by(sex, 'farbror', 'faster', 'onkel/tante')
      else if (side === 'f') w = by(sex, 'morbror', 'moster', 'onkel/tante')
      else w = by(sex, 'onkel', 'tante', 'onkel/tante')
    } else {
      w = 'grand' + by(sex, 'onkel', 'tante', 'onkel/tante')
      if (up > 3) removedNote = ` (${up - 2}. ledd)`
    }
  } else if (up === 1) {
    w = (down === 2 ? '' : 'grand') + by(sex, 'nevø', 'niese', 'nevø/niese')
    if (down > 3) removedNote = ` (${down - 2}. ledd)`
  } else {
    const deg = Math.min(up, down) - 1
    const rem = Math.abs(up - down)
    const words = ['', '', 'tremenning', 'firmenning', 'femmenning', 'seksmenning', 'sjumenning']
    w = deg === 1 ? by(sex, 'fetter', 'kusine', 'søskenbarn') : words[deg] || `${deg + 1}-menning`
    if (rem) removedNote = ` (${rem} generasjon${rem > 1 ? 'er' : ''} forskjøvet)`
  }
  if (half) w = 'halv' + w
  return w + removedNote + (adoptive ? ' (adoptiv)' : '')
}

function noSide(k: Kin, index: KinIndex) {
  return (k.upPath[1] && index.sex.get(k.upPath[1])) || 'x'
}
function noFirstChild(k: Kin, index: KinIndex) {
  return (k.downPath[1] && index.sex.get(k.downPath[1])) || 'x'
}

function noName(k: Kin, ctx: NameCtx): string {
  const I = ctx.index
  switch (k.kind) {
    case 'self':
      return 'seg selv'
    case 'blood':
      return noBlood(k.up, k.down, k.sex, k.half, k.adoptive, noSide(k, I), noFirstChild(k, I))
    case 'spouse': {
      const partner = k.spouseType && k.spouseType !== 'spouse'
      if (k.ended)
        return partner
          ? 'tidligere partner'
          : by(k.sex, 'eksmann', 'ekskone', 'tidligere ektefelle')
      if (k.status === 'engaged') return 'forlovede'
      if (partner) return 'partner'
      return by(k.sex, 'ektemann', 'kone', 'ektefelle')
    }
    case 'step': {
      const pre = k.viaEnded ? 'tidligere ' : ''
      if (k.down === 0)
        return (
          pre +
          (k.up === 1
            ? by(k.sex, 'stefar', 'stemor', 'steforelder')
            : by(k.sex, 'stebestefar', 'stebestemor', 'stebesteforelder'))
        )
      if (k.up === 0)
        return pre + (k.down === 1 ? by(k.sex, 'stesønn', 'stedatter', 'stebarn') : 'stebarnebarn')
      return pre + by(k.sex, 'stebror', 'stesøster', 'stesøsken')
    }
    case 'inlaw': {
      const pre = k.viaEnded ? 'tidligere ' : ''
      if (k.up === 1 && k.down === 0)
        return pre + by(k.sex, 'svigerfar', 'svigermor', 'svigerforelder')
      if (k.up === 1 && k.down === 1)
        return pre + by(k.sex, 'svoger', 'svigerinne', 'svoger/svigerinne')
      const core = noBlood(k.up, k.down, k.sex, k.half, false, noSide(k, I), noFirstChild(k, I))
      if (k.up === 0) return pre + 'ste' + core
      const via = I.sex.get(k.via!) || 'x'
      return `${pre}${NO_SPOUSE_GEN[via]} ${core}`
    }
    case 'affine': {
      const pre = k.viaEnded ? 'tidligere ' : ''
      const { up, down, sex } = k
      if (up === 0 && down === 1) return pre + by(sex, 'svigersønn', 'svigerdatter', 'svigerbarn')
      if (up === 1 && down === 1) return pre + by(sex, 'svoger', 'svigerinne', 'svoger/svigerinne')
      if (down === 0) return pre + 'ste' + noBlood(up, 0, sex, false, false, noSide(k, I), 'x')
      if (down === 1) return pre + by(sex, 'onkel', 'tante', 'onkel/tante') + ' (inngiftet)'
      const relSex = (k.downPath.length && I.sex.get(k.downPath[k.downPath.length - 1])) || 'x'
      const rel = noBlood(up, down, relSex, false, false, noSide(k, I), noFirstChild(k, I))
      return `${pre}${gen(rel.split(' ')[0])} ${NO_SPOUSE[sex]}`
    }
    case 'coparent': {
      const cs = I.sex.get(k.downPath[2]) || 'x'
      const w = by(cs, 'svigersønnens', 'svigerdatterens', 'svigerbarnets')
      return `${w} ${by(k.sex, 'far', 'mor', 'forelder')}`
    }
    case 'social':
      return (k.rel && ctx.socialLabel?.(k.rel, ctx.anchor)) || k.rel?.type || 'forbindelse'
    case 'distant':
      return `${k.hops} ledd unna`
  }
}

// ── Chinese ─────────────────────────────────────────────────────────────────

const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
const cn = (n: number) => (n <= 10 ? CN[n] : n < 20 ? '十' + CN[n - 10] : String(n))

interface ZhCtx {
  index: KinIndex
  /** the person the chain starts from (age comparisons for cousin terms) */
  from: string
}

const isPar = (t: Tok) => t === 'F' || t === 'M' || t === 'P'
const isChi = (t: Tok) => t === 'S' || t === 'D' || t === 'C'
const isSib = (t: Tok) => t === 'B' || t === 'Z' || t === 'X'

/** 哥/弟 · 姐/妹 by age against the chain's starting person. */
function ageWord(step: ChainStep, z: ZhCtx, male: boolean) {
  const o = isOlder(z.index, step.id, z.from)
  if (male) return o == null ? '兄弟' : o ? '哥' : '弟'
  return o == null ? '姐妹' : o ? '姐' : '妹'
}

/** A known Chinese term for the WHOLE chain, or null. */
function zhKnown(steps: ChainStep[], z: ZhCtx): string | null {
  const n = steps.length
  if (!n) return null
  const t = steps.map((s) => s.t)
  const T = t.join('')
  const sx = (i: number) => z.index.sex.get(steps[i].id) || 'x'
  const last = steps[n - 1]

  // Direct ancestors.
  if (t.every(isPar)) {
    const maternal = t[0] === 'M'
    const ls = last.t === 'F' ? 'm' : last.t === 'M' ? 'f' : sx(n - 1)
    if (n === 1) return last.t === 'F' ? '父亲' : last.t === 'M' ? '母亲' : '父母'
    if (n === 2)
      return maternal ? by(ls, '外公', '外婆', '外祖父母') : by(ls, '爷爷', '奶奶', '祖父母')
    const w = n === 3 ? '曾祖' : n === 4 ? '高祖' : `${cn(n)}世祖`
    return (maternal ? '外' : '') + w + by(ls, '父', '母', '')
  }
  // Direct descendants.
  if (t.every(isChi)) {
    const viaDaughter = t[0] === 'D'
    const ls = last.t === 'S' ? 'm' : last.t === 'D' ? 'f' : 'x'
    if (n === 1) return by(ls, '儿子', '女儿', '子女')
    const w = n === 2 ? '孙' : n === 3 ? '曾孙' : n === 4 ? '玄孙' : `${cn(n)}代孙`
    return (viaDaughter ? '外' : '') + w + by(ls, n === 2 ? '子' : '', '女', '辈')
  }
  // Siblings.
  if (n === 1 && isSib(t[0])) {
    const o = steps[0].older
    if (t[0] === 'B') return o == null ? '兄弟' : o ? '哥哥' : '弟弟'
    if (t[0] === 'Z') return o == null ? '姐妹' : o ? '姐姐' : '妹妹'
    return '兄弟姐妹'
  }
  // Spouse.
  if (n === 1) return T === 'H' ? '丈夫' : T === 'W' ? '妻子' : T === 'E' ? '配偶' : null

  const o1 = steps[1]?.older
  switch (T) {
    // Parents' siblings.
    case 'FB':
    case 'PB':
      return o1 == null ? '叔伯' : o1 ? '伯父' : '叔叔'
    case 'FZ':
    case 'PZ':
      return '姑姑'
    case 'MB':
      return '舅舅'
    case 'MZ':
      return '姨妈'
    // Grandparents' siblings.
    case 'FFB':
      return steps[2].older ? '伯祖父' : '叔祖父'
    case 'FFZ':
      return '姑奶奶'
    case 'FMB':
      return '舅爷爷'
    case 'FMZ':
      return '姨奶奶'
    case 'MFB':
      return steps[2].older ? '伯外公' : '叔外公'
    case 'MFZ':
      return '姑婆'
    case 'MMB':
      return '舅公'
    case 'MMZ':
      return '姨婆'
    // Nephews & nieces.
    case 'BS':
      return '侄子'
    case 'BD':
      return '侄女'
    case 'ZS':
      return '外甥'
    case 'ZD':
      return '外甥女'
    case 'BSS':
      return '侄孙'
    case 'BSD':
      return '侄孙女'
    case 'BDS':
      return '侄外孙'
    case 'BDD':
      return '侄外孙女'
    case 'ZSS':
    case 'ZDS':
      return '外甥孙'
    case 'ZSD':
    case 'ZDD':
      return '外甥孙女'
    // In-laws through my spouse.
    case 'HF':
      return '公公'
    case 'HM':
      return '婆婆'
    case 'WF':
      return '岳父'
    case 'WM':
      return '岳母'
    case 'HB':
      return o1 == null ? null : o1 ? '大伯子' : '小叔子'
    case 'HZ':
      return o1 == null ? null : o1 ? '大姑子' : '小姑子'
    case 'WB':
      return o1 == null ? null : o1 ? '大舅子' : '小舅子'
    case 'WZ':
      return o1 == null ? null : o1 ? '大姨子' : '小姨子'
    case 'HS':
    case 'WS':
    case 'ES':
      return '继子'
    case 'HD':
    case 'WD':
    case 'ED':
      return '继女'
    // Spouses of my relatives.
    case 'SW':
      return '儿媳'
    case 'DH':
      return '女婿'
    case 'SSW':
      return '孙媳妇'
    case 'SDH':
      return '孙女婿'
    case 'DSW':
      return '外孙媳妇'
    case 'DDH':
      return '外孙女婿'
    case 'BW':
      return steps[0].older == null ? null : steps[0].older ? '嫂子' : '弟媳'
    case 'ZH':
      return steps[0].older == null ? null : steps[0].older ? '姐夫' : '妹夫'
    case 'FBW':
      return steps[1].older ? '伯母' : '婶婶'
    case 'FZH':
      return '姑父'
    case 'MBW':
      return '舅妈'
    case 'MZH':
      return '姨父'
    case 'FW':
      return '继母'
    case 'MH':
      return '继父'
    case 'BSW':
      return '侄媳妇'
    case 'BDH':
      return '侄女婿'
    case 'ZSW':
      return '外甥媳妇'
    case 'ZDH':
      return '外甥女婿'
  }

  // Cousins: parent · sibling · child. 堂 = father's brother's line, else 表.
  if (n === 3 && isPar(t[0]) && (t[1] === 'B' || t[1] === 'Z') && isChi(t[2])) {
    const tang = t[0] === 'F' && t[1] === 'B' ? '堂' : '表'
    if (t[2] === 'C') return tang + '兄弟姐妹'
    return tang + ageWord(steps[2], z, t[2] === 'S')
  }
  // Step-siblings: parent · their spouse · that spouse's child.
  if (n === 3 && isPar(t[0]) && 'HWE'.includes(t[1]) && isChi(t[2])) {
    if (t[2] === 'C') return '继兄弟姐妹'
    const o = isOlder(z.index, steps[2].id, z.from)
    return '继' + (t[2] === 'S' ? (o ? '兄' : '弟') : o ? '姐' : '妹')
  }
  // Co-parents-in-law: child · their spouse · that spouse's parent.
  if (n === 3 && isChi(t[0]) && 'HWE'.includes(t[1]) && isPar(t[2])) {
    return t[2] === 'F' ? '亲家公' : t[2] === 'M' ? '亲家母' : '亲家'
  }
  // A cousin's spouse.
  if (
    n === 4 &&
    isPar(t[0]) &&
    (t[1] === 'B' || t[1] === 'Z') &&
    isChi(t[2]) &&
    'HW'.includes(t[3])
  ) {
    const tang = t[0] === 'F' && t[1] === 'B' ? '堂' : '表'
    const o = isOlder(z.index, steps[2].id, z.from)
    if (t[2] === 'S' && t[3] === 'W') return tang + (o ? '嫂' : '弟媳')
    if (t[2] === 'D' && t[3] === 'H') return tang + (o ? '姐夫' : '妹夫')
    return null
  }
  // A cousin's child.
  if (n === 4 && isPar(t[0]) && (t[1] === 'B' || t[1] === 'Z') && isChi(t[2]) && isChi(t[3])) {
    const tang = t[0] === 'F' && t[1] === 'B' ? '堂' : '表'
    const male = t[2] === 'S'
    if (t[3] === 'S') return tang + (male ? '侄' : '外甥')
    if (t[3] === 'D') return tang + (male ? '侄女' : '外甥女')
    return null
  }
  // A parent's cousin: parent · grandparent · sibling · child.
  if (n === 4 && isPar(t[0]) && isPar(t[1]) && (t[2] === 'B' || t[2] === 'Z') && isChi(t[3])) {
    const tang = t[0] === 'F' && t[1] === 'F' && t[2] === 'B' ? '堂' : '表'
    if (t[0] === 'M') return t[3] === 'S' ? '表舅' : t[3] === 'D' ? '表姨' : null
    if (t[3] === 'S') return tang + (isOlder(z.index, steps[3].id, steps[0].id) ? '伯' : '叔')
    if (t[3] === 'D') return tang + '姑'
    return null
  }
  // Second cousins: 远房堂/表.
  if (
    n === 5 &&
    isPar(t[0]) &&
    isPar(t[1]) &&
    (t[2] === 'B' || t[2] === 'Z') &&
    isChi(t[3]) &&
    isChi(t[4])
  ) {
    const tang = t[0] === 'F' && t[1] === 'F' && t[2] === 'B' && t[3] === 'S' ? '堂' : '表'
    if (t[4] === 'C') return '远房' + tang + '兄弟姐妹'
    return '远房' + tang + ageWord(steps[4], z, t[4] === 'S')
  }
  return null
}

/** Greedy longest-known-prefix, joined with 的 — any chain gets a phrase. */
function zhChain(steps: ChainStep[], z: ZhCtx): string {
  if (!steps.length) return '自己'
  for (let k = steps.length; k >= 1; k--) {
    const head = zhKnown(steps.slice(0, k), z)
    if (!head) continue
    if (k === steps.length) return head
    const rest = zhChain(steps.slice(k), { index: z.index, from: steps[k - 1].id })
    return head + '的' + rest
  }
  // Shouldn't happen (every single step is known) — fall back per token.
  return steps.map((s) => ZH_TOKEN[s.t]).join('的')
}

const ZH_TOKEN: Record<Tok, string> = {
  F: '父亲',
  M: '母亲',
  P: '父母',
  S: '儿子',
  D: '女儿',
  C: '孩子',
  B: '兄弟',
  Z: '姐妹',
  X: '兄弟姐妹',
  H: '丈夫',
  W: '妻子',
  E: '配偶'
}

function zhName(k: Kin, ctx: NameCtx): string {
  const I = ctx.index
  switch (k.kind) {
    case 'self':
      return '自己'
    case 'social':
      return (k.rel && ctx.socialLabel?.(k.rel, ctx.anchor)) || k.rel?.type || '关系人'
    case 'distant':
      return `相隔${cn(k.hops || 0)}层关系`
    case 'spouse': {
      const partner = k.spouseType && k.spouseType !== 'spouse'
      if (k.ended) return partner ? '前任伴侣' : by(k.sex, '前夫', '前妻', '前任配偶')
      if (k.status === 'engaged') return by(k.sex, '未婚夫', '未婚妻', '未婚伴侣')
      if (partner) return '伴侣'
      return by(k.sex, '丈夫', '妻子', '配偶')
    }
  }
  if (k.kind === 'blood' && k.adoptive) {
    if (k.up === 1 && k.down === 0) return by(k.sex, '养父', '养母', '养父母')
    if (k.up === 0 && k.down === 1) return by(k.sex, '养子', '养女', '养子女')
  }
  const steps = kinChain(I, ctx.anchor, ctx.target, k)
  let name = zhChain(steps, { index: I, from: ctx.anchor })
  if (k.kind === 'blood' && k.half && k.up === 1 && k.down === 1) {
    const caSex = I.sex.get(k.cas[0]) || 'x'
    name = (caSex === 'm' ? '同父异母的' : caSex === 'f' ? '同母异父的' : '半血缘') + name
  }
  if (k.kind === 'blood' && k.adoptive) name += '（收养）'
  if (k.viaEnded && (k.kind === 'inlaw' || k.kind === 'affine' || k.kind === 'step'))
    name = '前' + name
  return name
}

// Simplified → Traditional for every character the terms above use.
const TRAD: Record<string, string> = {
  亲: '親',
  爷: '爺',
  孙: '孫',
  儿: '兒',
  侄: '姪',
  婶: '嬸',
  妈: '媽',
  远: '遠',
  继: '繼',
  侣: '侶',
  养: '養',
  异: '異',
  层: '層',
  关: '關',
  系: '係',
  伯: '伯',
  辈: '輩',
  缘: '緣',
  前: '前',
  妇: '婦',
  门: '門',
  们: '們'
}
export const toTraditional = (s: string) => s.replace(/./g, (c) => TRAD[c] || c)

// ── Public API ──────────────────────────────────────────────────────────────

/** What `ctx.target` is to `ctx.anchor`, in the chosen naming system. */
export function kinName(k: Kin | null | undefined, lang: KinLang, ctx: NameCtx): string {
  if (!k)
    return lang === 'no'
      ? 'ingen forbindelse'
      : lang.startsWith('zh')
        ? lang === 'zh-Hant'
          ? '沒有關係'
          : '没有关系'
        : 'not connected'
  if (lang === 'no') return noName(k, ctx)
  if (lang === 'zh-Hans') return zhName(k, ctx)
  if (lang === 'zh-Hant') return toTraditional(zhName(k, ctx))
  return enName(k, ctx)
}

const EN_TOKEN: Record<Tok, string> = {
  F: 'father',
  M: 'mother',
  P: 'parent',
  S: 'son',
  D: 'daughter',
  C: 'child',
  B: 'brother',
  Z: 'sister',
  X: 'sibling',
  H: 'husband',
  W: 'wife',
  E: 'spouse'
}
const NO_TOKEN: Record<Tok, string> = {
  F: 'far',
  M: 'mor',
  P: 'forelder',
  S: 'sønn',
  D: 'datter',
  C: 'barn',
  B: 'bror',
  Z: 'søster',
  X: 'søsken',
  H: 'mann',
  W: 'kone',
  E: 'ektefelle'
}
const ZH_WALK: Record<Tok, string> = { ...ZH_TOKEN, B: '兄弟', Z: '姐妹' }

/** A walker chain spoken aloud: "mother's brother's daughter", "mors brors
 *  datter", "妈妈的兄弟的女儿". */
export function chainPhrase(tokens: Tok[], lang: KinLang): string {
  if (!tokens.length) return ''
  if (lang === 'no') {
    return tokens.map((t, i) => (i < tokens.length - 1 ? gen(NO_TOKEN[t]) : NO_TOKEN[t])).join(' ')
  }
  if (lang === 'zh-Hans' || lang === 'zh-Hant') {
    const s = tokens.map((t) => ZH_WALK[t]).join('的')
    return lang === 'zh-Hant' ? toTraditional(s) : s
  }
  const s = tokens
    .map((t, i) => (i < tokens.length - 1 ? EN_TOKEN[t] + "'s" : EN_TOKEN[t]))
    .join(' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Token labels for the walker chips, per language. */
export function tokenLabel(t: Tok, lang: KinLang): string {
  if (lang === 'no') return NO_TOKEN[t]
  if (lang === 'zh-Hans') return ZH_WALK[t]
  if (lang === 'zh-Hant') return toTraditional(ZH_WALK[t])
  return EN_TOKEN[t]
}

/** The civil-law degree of a blood relation (generations counted through the
 *  common ancestor) — "a 4th-degree relative". */
export function civilDegree(k: Kin | null | undefined) {
  if (!k || k.kind !== 'blood') return null
  return k.up + k.down
}
