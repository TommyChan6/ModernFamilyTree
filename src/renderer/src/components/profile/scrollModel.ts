// 卷 — pure layout + text helpers for the handscroll profile (ProfileScroll.vue).
// No DOM, no store: everything here is deterministic and unit-tested
// (tests/profileScroll.test.js).

// ── Chinese numerals & the sexagenary cycle ─────────────────────────────────

const DIGITS = '〇一二三四五六七八九'
const STEMS = '甲乙丙丁戊己庚辛壬癸'
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'

/** A year written digit by digit, the way dates are inscribed: 1902 → 一九〇二.
 *  Years before 1 AD get the 前 ("before") prefix. */
export function chineseYear(y: number): string {
  if (!Number.isFinite(y)) return ''
  const n = Math.trunc(y)
  const body = String(Math.abs(n))
    .split('')
    .map((d) => DIGITS[+d])
    .join('')
  return n < 0 ? '前' + body : body
}

/** A cardinal number in Chinese (0..99 999): 76 → 七十六, 105 → 一百零五,
 *  10 → 十. Larger or negative values fall back to digit-by-digit. */
export function chineseNumber(n: number): string {
  if (!Number.isFinite(n)) return ''
  const v = Math.trunc(n)
  if (v < 0 || v > 99999) return chineseYear(v)
  if (v === 0) return '〇'
  const units = ['', '十', '百', '千', '万']
  const ds = String(v).split('').map(Number)
  let out = ''
  let zero = false
  ds.forEach((d, i) => {
    const pos = ds.length - 1 - i
    if (d === 0) {
      zero = out.length > 0
      return
    }
    if (zero) out += '〇'
    zero = false
    out += DIGITS[d] + units[pos]
  })
  // 一十X reads as 十X when it leads the number
  if (v >= 10 && v < 20) out = out.slice(1)
  return out.replace(/〇/g, '零')
}

/** The stem-branch (干支) name of a year: 1984 → 甲子, 1902 → 壬寅.
 *  Astronomical numbering for BC (1 BC = 0). */
export function ganzhi(y: number): string {
  if (!Number.isFinite(y)) return ''
  const k = (((Math.trunc(y) - 4) % 60) + 60) % 60
  return STEMS[k % 10] + BRANCHES[k % 12]
}

/** True when the text holds any CJK ideograph. */
export function hasCjk(s: string | null | undefined): boolean {
  return /[㐀-鿿豈-﫿]/.test(s || '')
}

export interface InscriptionInput {
  birthYear?: number | null
  deathYear?: number | null
  /** Age now (alive) or at death. */
  age?: number | null
}

/** The vertical inscription beside the portrait, one string per column
 *  (read right → left): birth in the cycle, then death or present age. */
export function inscription({ birthYear, deathYear, age }: InscriptionInput): string[] {
  const cols: string[] = []
  const by = birthYear ?? null
  const dy = deathYear ?? null
  if (by != null) cols.push(`${ganzhi(by)}年生`)
  if (dy != null) {
    let c = `${ganzhi(dy)}年卒`
    const IDEO_SPACE = String.fromCharCode(0x3000)
    if (age != null && age >= 0) c += `${IDEO_SPACE}享年${chineseNumber(age)}`
    cols.push(c)
  } else if (by != null && age != null && age >= 0) {
    cols.push(`今年${chineseNumber(age)}岁`)
  }
  if (!cols.length) cols.push('生卒无考')
  return cols
}

/** The character the monogram paints when there's no portrait: the first
 *  ideograph of a CJK name (the surname), else the first letter. */
export function monogramChar(name: string | null | undefined): string {
  const s = (name || '').trim()
  const cjk = s.match(/[㐀-鿿豈-﫿]/)
  if (cjk) return cjk[0]
  return (s[0] || '?').toUpperCase()
}

// ── Leaf sizing ─────────────────────────────────────────────────────────────

/** Split a list into runs of at most `size` (size < 1 → one run). */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (!arr.length) return []
  if (!(size >= 1)) return [arr.slice()]
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** How many CSS columns a leaf needs to hold `contentPx` of stacked content
 *  in columns `colPx` tall (with a little slack for break-inside: avoid). */
export function columnsFor(contentPx: number, colPx: number, max = 8): number {
  if (!(contentPx > 0)) return 1
  if (!(colPx > 40)) return 1
  return Math.max(1, Math.min(max, Math.ceil((contentPx * 1.12) / colPx)))
}

/** Estimated stacked height of a block of body text. */
export function textHeight(chars: number, colWidth: number, fontPx = 16, lineH = 1.75): number {
  const perLine = Math.max(8, Math.floor(colWidth / (fontPx * 0.47)))
  const lines = Math.ceil(Math.max(0, chars) / perLine)
  return lines * fontPx * lineH
}

/** Greedy column packing for a handscroll leaf: items stack down a column
 *  until the next would overflow `colH`, then a new column starts. Returns
 *  index lists; `colH` of Infinity (the phone layout) gives one column. An
 *  item taller than a column still gets a column of its own. */
export function packColumns(heights: number[], colH: number): number[][] {
  const cols: number[][] = []
  let cur: number[] = []
  let used = 0
  heights.forEach((h, i) => {
    const hh = Math.max(0, h || 0)
    if (cur.length && used + hh > colH) {
      cols.push(cur)
      cur = []
      used = 0
    }
    cur.push(i)
    used += hh
  })
  if (cur.length) cols.push(cur)
  return cols
}

/** Split body text into handscroll columns: paragraphs first, then sentences,
 *  so a column break never cuts a sentence. Each column is a list of
 *  paragraph strings. */
export function packText(
  text: string,
  colH: number,
  colW: number,
  fontPx = 16,
  lineH = 1.75
): string[][] {
  const paras = (text || '')
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (!paras.length) return []
  if (!Number.isFinite(colH)) return [paras]
  // pieces: [paragraphIndex, sentence]
  const pieces: { p: number; s: string }[] = []
  paras.forEach((p, pi) => {
    const sents = p.match(/[^.!?。！？]+[.!?。！？]+["'”’」』)]*\s*|[^.!?。！？]+$/g) || [p]
    sents.forEach((s) => pieces.push({ p: pi, s }))
  })
  const paraGap = fontPx * 0.9
  const cols: string[][] = []
  let col: string[] = []
  let curP = -1
  let buf = ''
  let used = 0
  const flush = () => {
    if (buf.trim()) col.push(buf.trim())
    buf = ''
  }
  const perLine = Math.max(8, Math.floor(colW / (fontPx * 0.47)))
  const linePx = fontPx * lineH
  for (const piece of pieces) {
    const newPara = piece.p !== curP
    // sentences share lines, so measure fractionally; a paragraph start
    // pays half a line of rounding slack plus the paragraph gap
    let h = (piece.s.length / perLine) * linePx
    if (newPara) h += linePx * 0.5 + (col.length || buf ? paraGap : 0)
    if ((col.length || buf) && used + h > colH) {
      flush()
      cols.push(col)
      col = []
      used = 0
    } else if (newPara && buf) {
      flush()
    }
    curP = piece.p
    buf += piece.s
    used += h
  }
  flush()
  if (col.length) cols.push(col)
  return cols
}

// ── Family sketch ───────────────────────────────────────────────────────────

export type KinSide = 'parent' | 'child' | 'spouse' | 'sibling'

export interface SketchChip {
  otherId: string
  name: string
  role: string
  side?: KinSide | null
  ended?: boolean
}

export interface SketchNode {
  otherId: string
  name: string
  role: string
  side: KinSide
  ended: boolean
  x: number
  y: number
}

export interface Sketch {
  w: number
  h: number
  center: { x: number; y: number }
  nodes: SketchNode[]
  /** Brush lines as polylines, in drawing order. */
  lines: { x: number; y: number }[][]
  /** People left off the sketch per side (shown as "+N"). */
  more: Record<KinSide, number>
}

export const SKETCH_CAPS: Record<KinSide, number> = { parent: 4, sibling: 3, spouse: 2, child: 6 }

/** Lay out a small brush-drawn family sketch around the person: parents
 *  above, siblings to the left, spouses to the right, children below. One
 *  node per (person, side); returns null when there's no family to draw. */
export function familySketch(
  chips: SketchChip[],
  opts: { gapX?: number; rowY?: number; margin?: number } = {}
): Sketch | null {
  const gapX = opts.gapX ?? 136
  const rowY = opts.rowY ?? 132
  const margin = opts.margin ?? 64
  const bySide: Record<KinSide, SketchChip[]> = { parent: [], sibling: [], spouse: [], child: [] }
  const seen = new Set<string>()
  for (const c of chips) {
    if (!c.side || !(c.side in bySide)) continue
    const k = c.otherId + '|' + c.side
    if (seen.has(k)) continue
    seen.add(k)
    bySide[c.side].push(c)
  }
  const total =
    bySide.parent.length + bySide.sibling.length + bySide.spouse.length + bySide.child.length
  if (!total) return null

  const more = {} as Record<KinSide, number>
  for (const s of Object.keys(bySide) as KinSide[]) {
    more[s] = Math.max(0, bySide[s].length - SKETCH_CAPS[s])
    bySide[s] = bySide[s].slice(0, SKETCH_CAPS[s])
  }

  // Lay out around (0,0) = the person, then shift into a positive box.
  const nodes: SketchNode[] = []
  const add = (c: SketchChip, side: KinSide, x: number, y: number) =>
    nodes.push({ otherId: c.otherId, name: c.name, role: c.role, side, ended: !!c.ended, x, y })
  const spread = (n: number, i: number, cx: number) => cx + (i - (n - 1) / 2) * gapX

  const P = bySide.parent
  const S = bySide.sibling
  const M = bySide.spouse
  const C = bySide.child
  P.forEach((c, i) => add(c, 'parent', spread(P.length, i, 0), -rowY))
  S.forEach((c, i) => add(c, 'sibling', -gapX * 1.25 - i * gapX, 0))
  M.forEach((c, i) => add(c, 'spouse', gapX * 1.25 + i * gapX, 0))
  const kidsAt = M.length ? (gapX * 1.25) / 2 : 0
  C.forEach((c, i) => add(c, 'child', spread(C.length, i, kidsAt), rowY))

  const lines: { x: number; y: number }[][] = []
  const R = 22 // clearance around a node mark
  const barUp = -rowY + R + 14
  if (P.length) {
    const xs = P.map((_, i) => spread(P.length, i, 0))
    if (P.length > 1) {
      lines.push([
        { x: xs[0], y: -rowY + R },
        { x: xs[0], y: barUp },
        { x: xs[xs.length - 1], y: barUp },
        { x: xs[xs.length - 1], y: -rowY + R }
      ])
    }
    lines.push([
      { x: 0, y: P.length > 1 ? barUp : -rowY + R },
      { x: 0, y: -R }
    ])
  }
  if (S.length) {
    // siblings hang off the same parental line, a little above the row
    const y = -rowY / 2
    const left = -gapX * 1.25 - (S.length - 1) * gapX
    lines.push([
      { x: 0, y },
      { x: left, y }
    ])
    S.forEach((_, i) => {
      const x = -gapX * 1.25 - i * gapX
      lines.push([
        { x, y },
        { x, y: -R }
      ])
    })
  }
  M.forEach((c, i) => {
    const x0 = i === 0 ? R : gapX * 1.25 + (i - 1) * gapX + R
    const x1 = gapX * 1.25 + i * gapX - R
    // a double stroke for a marriage (=), a single faint one once it ended
    lines.push([
      { x: x0, y: -3 },
      { x: x1, y: -3 }
    ])
    if (!c.ended)
      lines.push([
        { x: x0, y: 4 },
        { x: x1, y: 4 }
      ])
  })
  if (C.length) {
    const barDown = rowY - R - 14
    const xs = C.map((_, i) => spread(C.length, i, kidsAt))
    lines.push([
      { x: kidsAt, y: M.length ? 4 : R },
      { x: kidsAt, y: barDown }
    ])
    if (C.length > 1)
      lines.push([
        { x: xs[0], y: barDown },
        { x: xs[xs.length - 1], y: barDown }
      ])
    xs.forEach((x) =>
      lines.push([
        { x, y: barDown },
        { x, y: rowY - R }
      ])
    )
  }

  let minX = -R
  let maxX = R
  let minY = -R
  let maxY = R
  for (const n of nodes) {
    minX = Math.min(minX, n.x)
    maxX = Math.max(maxX, n.x)
    minY = Math.min(minY, n.y)
    maxY = Math.max(maxY, n.y)
  }
  const ox = margin - minX
  const oy = margin - 6 - minY
  const shift = (p: { x: number; y: number }) => ({ x: p.x + ox, y: p.y + oy })
  return {
    w: maxX - minX + margin * 2,
    h: maxY - minY + margin * 2 - 12,
    center: shift({ x: 0, y: 0 }),
    nodes: nodes.map((n) => ({ ...n, ...shift(n) })),
    lines: lines.map((l) => l.map(shift)),
    more
  }
}
