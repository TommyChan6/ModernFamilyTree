// Kinship quiz — question generation over the real graph (pure; the naming
// function is injected so the quiz speaks whichever kinship language is on).
//
// Three rounds types:
//   name — "What is B to A?"            4 relationship names, one right
//   who  — "Who is A's first cousin?"   4 people, exactly one fits
//   hops — "How many links from A to B?" the six-degrees round

import type { Kin, KinIndex } from './kinshipGraph'
import { kinshipLens, hopsFrom } from './kinshipGraph'

export type QuizKind = 'name' | 'who' | 'hops'
export interface QuizOption {
  key: string
  label: string
  personId?: string
  /** name rounds: the pair this name was read from, so the UI can re-name
   *  the option live when the naming language changes */
  src?: { a: string; b: string }
}
export interface QuizQuestion {
  kind: QuizKind
  a: string
  b: string
  /** the relationship name (name/who rounds) */
  relName?: string
  options: QuizOption[]
  answer: string
}

/** Deterministic PRNG (mulberry32) so a seed replays the same quiz. */
export function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const pick = <T>(arr: T[], rng: () => number) => arr[Math.floor(rng() * arr.length)]

const NAMED = new Set(['blood', 'spouse', 'inlaw', 'affine', 'step', 'coparent'])

export type NameFn = (kin: Kin, anchor: string, target: string) => string

/**
 * Build up to `count` questions. Anchors are sampled (not every person's
 * lens is computed) so this stays fast on large projects.
 */
export function makeQuiz(
  index: KinIndex,
  nameOf: NameFn,
  rng: () => number,
  count = 8
): QuizQuestion[] {
  const people = shuffle([...index.ids], rng).slice(0, 60)
  // anchor → [{ id, name }] of named relatives
  const lenses: { anchor: string; rels: { id: string; name: string }[] }[] = []
  const pool = new Map<string, { a: string; b: string }>()
  for (const a of people) {
    const lens = kinshipLens(index, a)
    const rels: { id: string; name: string }[] = []
    for (const [id, k] of lens) {
      if (id === a || !NAMED.has(k.kind)) continue
      const name = nameOf(k, a, id)
      rels.push({ id, name })
      if (!pool.has(name)) pool.set(name, { a, b: id })
    }
    if (rels.length >= 3) lenses.push({ anchor: a, rels })
    if (lenses.length >= 24) break
  }
  const poolArr = [...pool.keys()]
  const out: QuizQuestion[] = []
  const used = new Set<string>()
  const kinds: QuizKind[] = ['name', 'who', 'name', 'hops', 'who', 'name', 'hops', 'name']

  for (let i = 0, tries = 0; out.length < count && tries < count * 12; tries++, i++) {
    const kind = kinds[i % kinds.length]
    if (kind === 'hops') {
      const q = hopsQuestion(index, rng, used)
      if (q) out.push(q)
      continue
    }
    if (!lenses.length) continue
    const L = pick(lenses, rng)
    const target = pick(L.rels, rng)
    const key = kind + ':' + L.anchor + '>' + target.id
    if (used.has(key)) continue

    if (kind === 'name') {
      const wrong = shuffle(
        [...new Set([...L.rels.map((r) => r.name), ...poolArr])].filter((n) => n !== target.name),
        rng
      ).slice(0, 3)
      if (wrong.length < 2) continue
      used.add(key)
      const srcOf = (n: string) =>
        n === target.name
          ? { a: L.anchor, b: target.id }
          : (() => {
              const own = L.rels.find((r) => r.name === n)
              return own ? { a: L.anchor, b: own.id } : pool.get(n)!
            })()
      const options = shuffle([target.name, ...wrong], rng).map((n, i) => ({
        key: 'n' + i + ':' + n,
        label: n,
        src: srcOf(n)
      }))
      const answer = options.find((o) => o.label === target.name)!.key
      out.push({ kind, a: L.anchor, b: target.id, relName: target.name, options, answer })
    } else {
      // who: decoys must NOT carry the same name from the anchor's view.
      const decoys = shuffle(
        L.rels.filter((r) => r.name !== target.name && r.id !== target.id),
        rng
      ).slice(0, 3)
      if (decoys.length < 2) continue
      used.add(key)
      const options = shuffle([target, ...decoys], rng).map((r) => ({
        key: r.id,
        label: r.id,
        personId: r.id
      }))
      out.push({
        kind,
        a: L.anchor,
        b: target.id,
        relName: target.name,
        options,
        answer: target.id
      })
    }
  }
  return out
}

function hopsQuestion(index: KinIndex, rng: () => number, used: Set<string>): QuizQuestion | null {
  const ids = [...index.ids].filter((id) => index.adj.has(id))
  for (let t = 0; t < 10 && ids.length > 2; t++) {
    const a = pick(ids, rng)
    const dist = hopsFrom(index, a, 9)
    const far = [...dist.entries()].filter(([, d]) => d >= 2)
    if (!far.length) continue
    // Favour longer chains — that's where the fun is.
    far.sort((x, y) => y[1] - x[1])
    const [b, d] = far[Math.floor(rng() * Math.min(far.length, 6))]
    const key = 'hops:' + [a, b].sort().join('~')
    if (used.has(key)) continue
    used.add(key)
    const vals = new Set([d])
    for (const delta of shuffle([-1, 1, 2, -2, 3], rng)) {
      if (vals.size >= 4) break
      if (d + delta >= 1) vals.add(d + delta)
    }
    const options = shuffle([...vals], rng).map((v) => ({ key: String(v), label: String(v) }))
    return { kind: 'hops', a, b, options, answer: String(d) }
  }
  return null
}
