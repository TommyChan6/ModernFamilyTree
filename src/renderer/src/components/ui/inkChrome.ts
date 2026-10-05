// 水墨 — small pure helpers the DOM chrome uses in the Ink theme: ink-wash
// avatar discs (instead of the bright blue/pink gradients), ink pigments for
// relationship types, and the single brushed character (字) each built-in
// relationship type is stamped with. No store/DOM dependency — callers pass
// `isInk` and the registry def — so it is unit-testable (tests/inkChrome.test.js).

export type Gender = string | null | undefined

/** A wash of ink pooled in a disc: lighter where the brush first touched. */
const WASH = {
  male: ['#7b93a6', '#3d5a73', '#263c4f'], // 花青 indigo
  female: ['#c78f93', '#a2496a', '#74304b'], // 胭脂 rouge
  other: ['#958c7e', '#5d5850', '#38342e'] // 墨 ink
} as const

/** CSS background for a person's avatar disc in the ink theme. */
export function inkAvatarBg(gender: Gender): string {
  const [a, b, c] = gender === 'male' ? WASH.male : gender === 'female' ? WASH.female : WASH.other
  return `radial-gradient(circle at 34% 30%, ${a}, ${b} 58%, ${c})`
}

/** The single character brushed beside each built-in relationship type. */
export const REL_GLYPHS: Record<string, string> = {
  parent_child: '亲',
  adopted: '养',
  spouse: '婚',
  sibling: '胞',
  partner: '侣',
  friends: '友',
  likes: '慕',
  rival: '敌',
  mentor: '师',
  subordinate: '从'
}

const CJK = /[㐀-鿿豈-﫿]/

/** The brushed glyph for a relationship type: the built-in's character, or
 *  the first CJK character of a custom type's label, else ''. */
export function inkRelGlyph(type: string, label?: string | null): string {
  if (REL_GLYPHS[type]) return REL_GLYPHS[type]
  const m = (label || '').match(CJK)
  return m ? m[0] : ''
}

/** Bonds drawn as the red thread of fate (红线) in the ink theme. */
const ROMANTIC = new Set(['spouse', 'partner', 'likes'])

export function isRomanticType(type: string): boolean {
  return ROMANTIC.has(type)
}

const INK_TYPE_COLOR: Record<string, string> = {
  parent_child: '#2b2722', // 墨 ink
  adopted: '#3d5a73', // 花青 indigo
  spouse: '#b3352a', // 朱 cinnabar — the red thread
  partner: '#b3352a',
  likes: '#a2496a', // 胭脂 rouge
  sibling: '#4c6b5e', // 石绿, dulled
  friends: '#4c8a72', // 石绿 malachite
  rival: '#6b3a2a', // 赭 dark ochre
  mentor: '#b4884c', // 赭石 ochre
  subordinate: '#6e6a61' // 淡墨 pale ink
}

/** The pigment a relationship type is drawn in. Outside ink the caller's
 *  colour passes through; in ink built-ins get their pigment and custom
 *  types keep their hue, ground down with ink so it sits on paper. */
export function inkRelColor(type: string, color: string, isInk: boolean): string {
  if (!isInk) return color
  return INK_TYPE_COLOR[type] || `color-mix(in srgb, ${color} 62%, #2b2722)`
}
