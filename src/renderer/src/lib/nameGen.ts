// Culture-aware name generator (WILD_IDEAS C2) — pure: no Vue, store or DOM.
//
// An order-k Markov chain over characters (or syllables, for pinyin/romaji)
// with backoff to lower orders when a context was never seen, start/end
// tokens and a seeded RNG, so a seed always yields the same names. Output is
// filtered: exact copies and near-copies of the training names, degenerate
// strings (triple letters, no vowels in a Latin corpus) and out-of-range
// lengths are rejected. On top sits `suggestNames`, which blends a culture
// corpus with a tag's own members ("House Stark names sound like this"),
// honours gender, and picks the surname from the parents, the tag, or the
// chain. Corpora live in nameCorpora.ts.

export type NameMode = 'char' | 'syllable'
export type SyllableScheme = 'pinyin' | 'romaji'
export type NameGender = 'm' | 'f'

export interface NameCorpus {
  id: string
  /** i18n key of the culture's display name (translated where it is shown). */
  labelKey: string
  mode: NameMode
  /** Syllable splitter for mode 'syllable'. */
  scheme?: SyllableScheme
  male: readonly string[]
  female: readonly string[]
  unisex?: readonly string[]
  surnames: readonly string[]
  /** Native order is "Surname Given" (Chinese, Japanese). */
  surnameFirst?: boolean
  /** Surnames are drawn from the list, never generated (a closed set). */
  pickSurnames?: boolean
  /** Children are named after their father: Erik → Eriksson / Eriksdottir. */
  patronymic?: { m: string; f: string }
  /** Gendered surname forms, masculine suffix → feminine (Ivanov → Ivanova). */
  femSurname?: readonly (readonly [string, string])[]
  /** Hard cap on syllables per name in syllable mode. */
  maxSyllables?: number
}

// ── RNG ─────────────────────────────────────────────────────────────────────

/** FNV-1a for string seeds; numbers pass through as uint32. */
export function hashSeed(seed: number | string): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) return Math.floor(seed) >>> 0
  let h = 2166136261
  const s = String(seed)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32 — tiny, fast, good enough for names. Returns [0, 1). */
export function makeRng(seed: number | string): () => number {
  let a = hashSeed(seed) || 0x9e3779b9
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Text helpers ────────────────────────────────────────────────────────────

/** Lowercase, NFC, letters + apostrophe/hyphen/space only, single spaces. */
export function normalizeName(raw: string): string {
  return String(raw ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’ʼ`]/g, "'")
    .replace(/[^\p{L}\p{M}'\- ]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const stripMarks = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '')

const PINYIN_RE =
  /(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?[aeiouv]+(?:ng(?![aeiouv])|n(?![aeiouv])|r(?![aeiouv]))?/g
const ROMAJI_RE =
  /(?:(?:ky|gy|sh|ch|ts|ny|hy|my|ry|by|py|[kgsztdnhbpmyrwfj])?[aeiou]|n(?![aeiouy])|([kstpgdbcmhrzj])(?=\1))/g

/** Split a (normalized) name into syllables for the given scheme. */
export function splitSyllables(name: string, scheme: SyllableScheme): string[] {
  const s = stripMarks(normalizeName(name)).replace(/ü/g, 'v')
  const out: string[] = []
  for (const part of s.split(/[\s'-]+/)) {
    if (!part) continue
    const re = scheme === 'pinyin' ? PINYIN_RE : ROMAJI_RE
    out.push(...(part.match(re) || []))
  }
  return out
}

/** Training tokens of one name. Char mode drops spaces (one word per name). */
export function tokenize(name: string, mode: NameMode, scheme?: SyllableScheme): string[] {
  if (mode === 'syllable') return splitSyllables(name, scheme || 'pinyin')
  return Array.from(normalizeName(name).replace(/ /g, ''))
}

/** Join tokens back into a name (pinyin marks a vowel-initial syllable with '). */
export function joinTokens(tokens: readonly string[], mode: NameMode, scheme?: SyllableScheme) {
  if (mode !== 'syllable' || scheme !== 'pinyin') return tokens.join('')
  let out = ''
  tokens.forEach((tok, i) => {
    out += i > 0 && /^[aoe]/.test(tok) ? `'${tok}` : tok
  })
  return out
}

/** Proper-case a name: every word and hyphen part, O'Neill/D'Arcy, McLeod. */
export function capitalizeName(s: string): string {
  const chars = Array.from(String(s ?? '').toLocaleLowerCase())
  let out = ''
  for (let i = 0; i < chars.length; i++) {
    const prev = chars[i - 1]
    let up = i === 0 || prev === ' ' || prev === '-'
    // after an apostrophe only when it follows a one-letter prefix (O', D', L')
    if (prev === "'") up = i === 2 || (i >= 3 && (chars[i - 3] === ' ' || chars[i - 3] === '-'))
    out += up ? chars[i].toLocaleUpperCase() : chars[i]
  }
  return out.replace(
    /(^|[ -])Mc(\p{Ll})/gu,
    (_m, a: string, b: string) => `${a}Mc${b.toUpperCase()}`
  )
}

/** Levenshtein distance, early-exiting once it must exceed `max`. */
export function editDistance(a: string, b: string, max = Infinity): number {
  const A = Array.from(a)
  const B = Array.from(b)
  if (Math.abs(A.length - B.length) > max) return max + 1
  let prev = Array.from({ length: B.length + 1 }, (_, j) => j)
  for (let i = 1; i <= A.length; i++) {
    const cur = [i]
    let best = i
    for (let j = 1; j <= B.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1))
      cur.push(v)
      if (v < best) best = v
    }
    if (best > max) return max + 1
    prev = cur
  }
  return prev[B.length]
}

const VOWELS = 'aeiouyæøœå'
const VOWEL_RE = new RegExp(`[${VOWELS}]`)
const CONS_RUN_RE = new RegExp(`[^${VOWELS}'\\- ]{5,}`)
const VOWEL_RUN_RE = new RegExp(`[${VOWELS}]{4,}`)

/** Junk output: triple letters, stray punctuation, and — for Latin-script
 *  corpora — no vowel at all, 5+ consonants or 4+ vowels in a row. */
export function isDegenerate(s: string, latin = true): boolean {
  const n = normalizeName(s)
  if (!n) return true
  if (/(.)\1\1/u.test(n) || /(..+)\1\1/u.test(n)) return true
  if (/^['\- ]|['\- ]$|['\- ]{2}/.test(n)) return true
  if (latin) {
    const base = stripMarks(n)
    if (!VOWEL_RE.test(base)) return true
    if (CONS_RUN_RE.test(base) || VOWEL_RUN_RE.test(base)) return true
  }
  return false
}

const isLatinText = (names: readonly string[]): boolean => {
  let latin = 0
  let total = 0
  for (const n of names) {
    for (const ch of n) {
      if (!/\p{L}/u.test(ch)) continue
      total++
      if (/\p{Script=Latin}/u.test(ch)) latin++
    }
  }
  return total === 0 || latin / total >= 0.8
}

// ── The Markov model ────────────────────────────────────────────────────────

const START = '\u0002'
const END = '\u0003'
const SEP = '\u0001'
/** Chance to skip a context with a single continuation (forces some novelty). */
const NOVELTY = 0.3

export interface NameModel {
  order: number
  /** Lowest order consulted: 0 (unigram) for syllables; for characters 2
   *  (when order >= 2), so every letter triple of the output occurs in some
   *  training name — that floor is what keeps the output pronounceable. */
  minOrder: number
  mode: NameMode
  scheme?: SyllableScheme
  /** tables[o] — context of the last o tokens → next token → weight. */
  tables: Map<string, Map<string, number>>[]
  /** Normalized, joined training names (the copy filter). */
  training: string[]
  trainingSet: Set<string>
  latin: boolean
  maxSyllables: number
  /** Training-name length percentiles (chars): the default length window. */
  lenLo: number
  lenHi: number
}

export interface TrainSource {
  names: readonly string[]
  /** Total weight of the source (spread evenly over its names); default = count. */
  weight?: number
}

export interface TrainOptions {
  order?: number
  mode?: NameMode
  scheme?: SyllableScheme
  maxSyllables?: number
}

export function trainModel(sources: readonly TrainSource[], opts: TrainOptions = {}): NameModel {
  const mode = opts.mode || 'char'
  const scheme = opts.scheme
  const order = Math.max(1, opts.order ?? (mode === 'syllable' ? 1 : 3))
  const minOrder = mode === 'syllable' ? 0 : Math.min(2, order)
  const tables: Map<string, Map<string, number>>[] = Array.from(
    { length: order + 1 },
    () => new Map()
  )
  const training = new Set<string>()
  const raw: string[] = []
  for (const src of sources) {
    const names = src.names.filter((n) => normalizeName(n))
    if (!names.length) continue
    const total = src.weight ?? names.length
    if (!(total > 0)) continue
    const w = total / names.length
    for (const name of names) {
      const toks = tokenize(name, mode, scheme)
      if (!toks.length) continue
      raw.push(name)
      training.add(joinTokens(toks, mode, scheme).replace(/'/g, ''))
      const seq = [...Array(order).fill(START), ...toks, END]
      for (let i = order; i < seq.length; i++) {
        for (let o = minOrder; o <= order; o++) {
          const ctx = seq.slice(i - o, i).join(SEP)
          let dist = tables[o].get(ctx)
          if (!dist) tables[o].set(ctx, (dist = new Map()))
          dist.set(seq[i], (dist.get(seq[i]) || 0) + w)
        }
      }
    }
  }
  const lens = [...training].map((n) => Array.from(n).length).sort((a, b) => a - b)
  const pct = (q: number): number => lens[Math.min(lens.length - 1, Math.floor(q * lens.length))]
  return {
    order,
    minOrder,
    mode,
    scheme,
    tables,
    training: [...training],
    trainingSet: training,
    latin: isLatinText(raw),
    maxSyllables: opts.maxSyllables ?? 3,
    lenLo: lens.length ? Math.max(mode === 'syllable' ? 2 : 3, pct(0.1)) : 3,
    lenHi: lens.length ? pct(0.95) + 1 : 12
  }
}

function pick(dist: Map<string, number>, rng: () => number, banEnd: boolean): string | null {
  let total = 0
  for (const [tok, w] of dist) if (!(banEnd && tok === END)) total += w
  if (total <= 0) return banEnd ? pick(dist, rng, false) : null
  let r = rng() * total
  let last: string | null = null
  for (const [tok, w] of dist) {
    if (banEnd && tok === END) continue
    last = tok
    r -= w
    if (r < 0) return tok
  }
  return last
}

/** One raw sample (lowercase, joined) or null when it ran out of bounds. */
export function sampleRaw(
  model: NameModel,
  rng: () => number,
  minLen = 3,
  maxLen = 12
): string | null {
  const { order, minOrder, tables, mode, scheme } = model
  const hist: string[] = Array(order).fill(START)
  const toks: string[] = []
  for (let step = 0; step < 48; step++) {
    let dist: Map<string, number> | undefined
    for (let o = order; o >= minOrder && !dist; o--) {
      const d = tables[o].get(hist.slice(hist.length - o).join(SEP))
      if (!d) continue
      // a lone continuation would just replay a training name — sometimes
      // drop one order (only from the top) to recombine instead
      // (never at the very start: onsets stay the corpus's own)
      const opening = toks.length < order
      if (!opening && o === order && o > minOrder && d.size === 1 && rng() < NOVELTY) continue
      dist = d
    }
    if (!dist) return null
    const len = joinTokens(toks, mode, scheme).length
    const tok = pick(dist, rng, len < minLen || toks.length === 0)
    if (tok == null) return null
    if (tok === END) return joinTokens(toks, mode, scheme)
    toks.push(tok)
    hist.push(tok)
    if (joinTokens(toks, mode, scheme).length > maxLen) return null
    if (mode === 'syllable' && toks.length > model.maxSyllables) return null
  }
  return null
}

/** How far a char-mode candidate must be from every training name. */
const nearCopyDistance = (len: number): number => (len <= 3 ? 0 : len <= 7 ? 1 : 2)

export function isNearCopy(candidate: string, model: NameModel): boolean {
  const c = normalizeName(candidate).replace(/'/g, '')
  if (model.trainingSet.has(c)) return true
  if (model.mode === 'syllable') return false // recombining syllables IS the novelty
  const d = nearCopyDistance(Array.from(c).length)
  if (d === 0) return false
  return model.training.some((t) => editDistance(c, t, d) <= d)
}

export interface GenerateOptions {
  count?: number
  seed?: number | string
  rng?: () => number
  minLen?: number
  maxLen?: number
  /** Names never to return (already used in the project…), any case. */
  exclude?: Iterable<string>
  /** Allow near-copies in a second pass when too few novel names came out
   *  (tiny corpora). Exact copies are never returned. Default true. */
  relax?: boolean
  attemptsPerName?: number
}

/** Generate up to `count` distinct, capitalized, novel names. */
export function generateNames(model: NameModel, opts: GenerateOptions = {}): string[] {
  const count = opts.count ?? 6
  const rng = opts.rng || makeRng(opts.seed ?? 1)
  // default window: the training names' own length spread
  const minLen = opts.minLen ?? model.lenLo
  const maxLen = Math.max(minLen, opts.maxLen ?? model.lenHi)
  const exclude = new Set([...(opts.exclude || [])].map((s) => normalizeName(s)))
  const budget = count * (opts.attemptsPerName ?? 60)
  const out: string[] = []
  const seen = new Set<string>()
  const passes = opts.relax === false ? [true] : [true, false]
  for (const strict of passes) {
    for (let i = 0; i < budget && out.length < count; i++) {
      const raw = sampleRaw(model, rng, minLen, maxLen)
      if (!raw || seen.has(raw)) continue
      const len = Array.from(raw).length
      if (len < minLen || len > maxLen) continue
      if (exclude.has(raw) || model.trainingSet.has(raw.replace(/'/g, ''))) continue
      if (isDegenerate(raw, model.latin)) continue
      if (strict && isNearCopy(raw, model)) continue
      seen.add(raw)
      out.push(capitalizeName(raw))
    }
    if (out.length >= count) break
  }
  return out
}

// ── Corpus similarity (which culture does a tag sound like?) ────────────────

export function ngramProfile(names: readonly string[], n = 2): Map<string, number> {
  const prof = new Map<string, number>()
  for (const name of names) {
    const s = Array.from(`^${stripMarks(normalizeName(name)).replace(/[ '-]/g, '')}$`)
    for (let i = 0; i + n <= s.length; i++) {
      const g = s.slice(i, i + n).join('')
      prof.set(g, (prof.get(g) || 0) + 1)
    }
  }
  return prof
}

/** Cosine similarity of two n-gram profiles, 0..1. */
export function profileSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (const [g, v] of a) {
    na += v * v
    const w = b.get(g)
    if (w) dot += v * w
  }
  for (const v of b.values()) nb += v * v
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

export const corpusNames = (c: NameCorpus): string[] => [
  ...c.male,
  ...c.female,
  ...(c.unisex || []),
  ...c.surnames
]

const corpusProfiles = new WeakMap<NameCorpus, Map<string, number>[]>()

/** The corpus whose letters these names share most (null when no names).
 *  Full names are split into DISTINCT words first, so a house surname shared
 *  by every member counts once; score = bigram + trigram cosine. */
export function closestCorpus(
  names: readonly string[],
  corpora: readonly NameCorpus[]
): NameCorpus | null {
  const words = [...new Set(names.flatMap((n) => normalizeName(n).split(' ')).filter(Boolean))]
  if (!words.length || !corpora.length) return null
  const mine = [ngramProfile(words, 2), ngramProfile(words, 3)]
  let best: NameCorpus | null = null
  let bestScore = -1
  for (const c of corpora) {
    let prof = corpusProfiles.get(c)
    if (!prof) {
      const all = corpusNames(c)
      prof = [ngramProfile(all, 2), ngramProfile(all, 3)]
      corpusProfiles.set(c, prof)
    }
    const s = profileSimilarity(mine[0], prof[0]) + profileSimilarity(mine[1], prof[1])
    if (s > bestScore) {
      bestScore = s
      best = c
    }
  }
  return best
}

// ── Name parts, gender, surnames ────────────────────────────────────────────

/** A gender-slot gradient position → 'm' (left) / 'f' (right) / null. */
export function genderFromT(t: number | null | undefined): NameGender | null {
  if (t == null || !Number.isFinite(t)) return null
  if (t <= 0.34) return 'm'
  if (t >= 0.66) return 'f'
  return null
}

/** "Erik Bloodaxe" → given Erik, surname Bloodaxe (or reversed order). */
export function splitFullName(
  full: string,
  surnameFirst = false
): { given: string; surname: string } {
  const toks = String(full ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!toks.length) return { given: '', surname: '' }
  if (toks.length === 1) return { given: toks[0], surname: '' }
  return surnameFirst
    ? { surname: toks[0], given: toks[1] }
    : { given: toks[0], surname: toks[toks.length - 1] }
}

/** Family names repeat across a house; given names vary. Whichever end of
 *  the multi-word names repeats more is the surname. null = can't tell. */
export function detectSurnameFirst(fulls: readonly string[]): boolean | null {
  const multi = fulls
    .map((f) =>
      String(f ?? '')
        .trim()
        .split(/\s+/)
    )
    .filter((t) => t.length >= 2)
  if (multi.length < 3) return null
  const firsts = new Set(multi.map((t) => normalizeName(t[0])))
  const lasts = new Set(multi.map((t) => normalizeName(t[t.length - 1])))
  if (firsts.size === lasts.size) return null
  return firsts.size < lasts.size
}

/** The most frequent entry (case-insensitive), first-seen wins ties. */
export function mostCommon(list: readonly string[]): string | null {
  const counts = new Map<string, { v: string; n: number; at: number }>()
  list.forEach((v, at) => {
    const k = normalizeName(v)
    if (!k) return
    const e = counts.get(k)
    if (e) e.n++
    else counts.set(k, { v: v.trim(), n: 1, at })
  })
  let best: { v: string; n: number; at: number } | null = null
  for (const e of counts.values()) {
    if (!best || e.n > best.n || (e.n === best.n && e.at < best.at)) best = e
  }
  return best ? best.v : null
}

const swapSuffix = (s: string, from: string, to: string): string => {
  const head = s.slice(0, s.length - from.length)
  const tail = s.slice(s.length - from.length)
  return head + (tail === tail.toUpperCase() && tail !== tail.toLowerCase() ? to.toUpperCase() : to)
}

/** Put a surname into the form a person of `gender` carries. */
export function genderSurname(
  surname: string,
  gender: NameGender | null | undefined,
  rules?: NameCorpus['femSurname']
): string {
  if (!surname || !gender || !rules?.length) return surname
  const low = surname.toLowerCase()
  // longest suffix first so 'sky' beats a shorter rule it contains
  const sorted = [...rules].sort((a, b) =>
    gender === 'f' ? b[0].length - a[0].length : b[1].length - a[1].length
  )
  for (const [masc, fem] of sorted) {
    if (gender === 'f') {
      if (low.endsWith(fem)) return surname
      if (low.endsWith(masc)) return swapSuffix(surname, masc, fem)
    } else if (low.endsWith(fem)) {
      return swapSuffix(surname, fem, masc)
    }
  }
  return surname
}

/** Erik + m → Eriksson; Hans + f → Hansdottir. */
export function patronym(
  fatherGiven: string,
  gender: NameGender | null | undefined,
  rule: { m: string; f: string }
): string {
  const base = String(fatherGiven ?? '').trim()
  if (!base) return ''
  const gen = /s$/i.test(base) ? base : `${base}s`
  return gen + (gender === 'f' ? rule.f : rule.m)
}

// ── Suggestions ─────────────────────────────────────────────────────────────

/** A tag's members, as name samples. */
export interface NameSampleSet {
  given: readonly { name: string; gender: NameGender | null }[]
  surnames: readonly string[]
  surnameFirst?: boolean | null
}

export interface ParentName {
  given: string
  surname: string
  gender: NameGender | null
}

export type SurnameSource = 'patronym' | 'parent' | 'tag' | 'generated' | 'none'

export interface NameSuggestion {
  given: string
  surname: string
  surnameFirst: boolean
  full: string
  surnameFrom: SurnameSource
}

export interface SuggestOptions {
  /** The culture corpus (a tag source blends with it, weighted by sample count). */
  corpus: NameCorpus
  tag?: NameSampleSet | null
  gender?: NameGender | null
  parents?: readonly ParentName[]
  count?: number
  seed?: number | string
  minLen?: number
  maxLen?: number
  /** Given names already in use — never suggested again. */
  exclude?: readonly string[]
  /** The name order the parents' family writes in; a surname inherited from
   *  the parents keeps it (null/absent = the source's order). */
  familySurnameFirst?: boolean | null
}

/** Pseudo-sample size at which a tag and its base corpus weigh the same. */
export const TAG_PRIOR = 6

/** The tag's share of the blend: n / (n + prior). */
export function tagShare(n: number, prior = TAG_PRIOR): number {
  return n <= 0 ? 0 : n / (n + prior)
}

export function givenPool(corpus: NameCorpus, gender: NameGender | null | undefined): string[] {
  const uni = corpus.unisex || []
  if (gender === 'm') return [...corpus.male, ...uni]
  if (gender === 'f') return [...corpus.female, ...uni]
  return [...corpus.male, ...corpus.female, ...uni]
}

const dedupe = (list: readonly string[]): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of list) {
    const k = normalizeName(v)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(v.trim())
  }
  return out
}

/** Blend a base list with a tag's own samples into one model. */
export function blendModel(
  corpus: NameCorpus,
  base: readonly string[],
  tagNames: readonly string[]
): NameModel {
  const tag = dedupe(tagNames)
  const share = tagShare(tag.length)
  const total = base.length + tag.length
  return trainModel(
    [
      { names: base, weight: 1 - share },
      { names: tag, weight: share }
    ],
    {
      mode: corpus.mode,
      scheme: corpus.scheme,
      order: corpus.mode === 'syllable' ? 1 : total >= 30 ? 3 : 2,
      maxSyllables: corpus.maxSyllables
    }
  )
}

/** `count` full-name suggestions for one person. Deterministic per seed. */
export function suggestNames(opts: SuggestOptions): NameSuggestion[] {
  const { corpus, tag } = opts
  const gender = opts.gender ?? null
  const count = opts.count ?? 6
  const rng = makeRng(opts.seed ?? 1)
  const surnameFirst = tag?.surnameFirst ?? corpus.surnameFirst ?? false

  // given names: the tag's own (same gender when there are enough), blended
  const tagAll = tag ? tag.given.map((g) => g.name) : []
  const tagSame =
    tag && gender ? tag.given.filter((g) => g.gender === gender).map((g) => g.name) : []
  const tagGiven = tagSame.length >= 2 ? tagSame : tagAll
  const givenModel = blendModel(corpus, givenPool(corpus, gender), tagGiven)
  const given = generateNames(givenModel, {
    count,
    rng,
    minLen: opts.minLen,
    maxLen: opts.maxLen,
    exclude: [...(opts.exclude || []), ...tagAll]
  })

  // surname: parents → the tag's most common → generated
  const parents = [...(opts.parents || [])].sort(
    (a, b) => (a.gender === 'm' ? 0 : 1) - (b.gender === 'm' ? 0 : 1)
  )
  let fixed: string[] = []
  let from: SurnameSource = 'none'
  const father = parents.find((p) => p.gender === 'm' && p.given)
  if (corpus.patronymic && !tag && father) {
    fixed = [patronym(father.given, gender, corpus.patronymic)]
    from = 'patronym'
  } else if (parents.some((p) => p.surname)) {
    fixed = dedupe(parents.map((p) => genderSurname(p.surname, gender, corpus.femSurname)))
    from = 'parent'
  } else if (tag && tag.surnames.length) {
    const top = mostCommon(tag.surnames)
    if (top) {
      fixed = [genderSurname(top, gender, corpus.femSurname)]
      from = 'tag'
    }
  }
  let generated: string[] = []
  if (!fixed.length) {
    if (corpus.patronymic && !corpus.surnames.length) {
      const fathers = generateNames(blendModel(corpus, corpus.male, []), { count, rng })
      generated = fathers.map((f) => patronym(f, gender, corpus.patronymic!))
    } else if (corpus.pickSurnames && corpus.surnames.length) {
      const pool = [...corpus.surnames]
      for (let i = 0; i < count && pool.length; i++) {
        generated.push(pool.splice(Math.floor(rng() * pool.length), 1)[0])
      }
    } else if (corpus.surnames.length) {
      const model = blendModel(corpus, corpus.surnames, [])
      generated = generateNames(model, { count, rng }).map((s) =>
        genderSurname(s, gender, corpus.femSurname)
      )
    }
    if (generated.length) from = 'generated'
  }

  return given.map((g, i) => {
    const surname = fixed.length
      ? fixed[i % fixed.length]
      : generated.length
        ? generated[i % generated.length]
        : ''
    const sf =
      from === 'parent' && opts.familySurnameFirst != null ? opts.familySurnameFirst : surnameFirst
    const parts = surname ? (sf ? [surname, g] : [g, surname]) : [g]
    return {
      given: g,
      surname,
      surnameFirst: sf,
      full: parts.join(' '),
      surnameFrom: surname ? from : 'none'
    }
  })
}
