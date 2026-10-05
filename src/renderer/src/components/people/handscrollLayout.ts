// 长卷 — pure layout math for the Handscroll medium (no Vue, DOM, canvas or
// store). A Chinese handscroll reads RIGHT-TO-LEFT, so the composition is
// built as a procession measured from the start (the right end, `u = 0`) and
// mapped onto world x at the end, where x = 0 is the scroll's far LEFT end and
// x = totalW is where reading begins.
//
//   引首 frontispiece (title) │ 隔水 silk seam │ painting: household scenes in
//   chronological order, decade inscriptions in the gaps, 题跋 colophons after
//   scenes whose people have bios │ 隔水 │ 拖尾 end panel
//
// Vertical positions are fractions of the painting band's height so the view
// can size the scroll to any viewport. Landscape features (mountain ranges,
// pines, water, boats, huts, birds) are generated here too, seeded, so the
// painter can draw any tile independently and adjacent tiles agree.

import { rng, hashStr, noise1 } from '../../lib/inkArt'

export interface HsDate {
  year?: number | null
}
export interface HsPerson {
  id: string
  name?: string
  gender?: string
  bio?: string
  birth?: HsDate | null
  death?: HsDate | null
}
export interface HsRel {
  person_a_id: string
  person_b_id: string
  type: string
}
/** relType key → symmetryRole ('vertical' | 'horizontal' | 'none'). */
export type RoleLookup = Map<string, string> | Record<string, string>

export const DIMS = {
  title: 330, // 引首 frontispiece width
  seam: 24, // 隔水 silk separator width
  lead: 90, // breathing room after a seam before the first scene
  headSlot: 132, // horizontal room for one head of household
  childSlot: 112, // … for one child
  scenePad: 44, // padding on each side of a scene
  gapMin: 70, // gap between consecutive scenes
  gapPerYear: 3, // extra gap per year between scenes (time flows as space)
  gapMax: 260,
  markerGap: 150, // a gap that holds a decade inscription is at least this wide
  colophonW: 184,
  colophonGap: 34,
  end: 380, // 拖尾 end panel width
  tile: 512 // landscape tile width (world px)
}

/** Max people per scene before a household is split into consecutive scenes. */
export const MAX_SCENE = 9
/** Colophons attached to one scene at most (the rest live in the profile). */
export const MAX_COLOPHONS = 2

// ── Small helpers ─────────────────────────────────────────────────────────────

export function yearOf(p: HsPerson | null | undefined): number | null {
  const y = p?.birth?.year
  return typeof y === 'number' && Number.isFinite(y) ? y : null
}

const CJK_RE = /[㐀-鿿豈-﫿]/

/** Family name: a CJK name's first character, else the last word. */
export function surnameOf(name: string | undefined): string {
  const n = (name || '').trim()
  if (!n) return ''
  if (CJK_RE.test(n[0])) return n[0]
  const words = n.split(/\s+/)
  return words[words.length - 1]
}

/** The glyph painted in a portrait roundel when there is no photo. */
export function roundelGlyph(name: string | undefined): string {
  const n = (name || '').trim()
  if (!n) return '?'
  const cjk = n.match(/[㐀-鿿豈-﫿]/)
  if (cjk) return cjk[0]
  const words = n.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase()
  return words[0].slice(0, 2).toUpperCase()
}

const CJK_DIGITS = '〇一二三四五六七八九'

/** 1950 → 一九五〇 (digit-by-digit, as dates are written on inscriptions). */
export function cjkYear(year: number): string {
  if (!Number.isFinite(year)) return ''
  const neg = year < 0
  const s = String(Math.abs(Math.trunc(year)))
    .split('')
    .map((d) => CJK_DIGITS[+d])
    .join('')
  return neg ? '前' + s : s
}

export function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10
}

/** "1901 – 1975" / "b. 1901" / "d. 1975" / ''. */
export function lifeSpan(p: HsPerson): string {
  const b = p.birth?.year
  const d = p.death?.year
  if (b != null && d != null) return `${b} – ${d}`
  if (b != null) return `b. ${b}`
  if (d != null) return `d. ${d}`
  return ''
}

/** Trim a bio to something a colophon can hold, on a word boundary. */
export function colophonText(bio: string | undefined, max = 120): string {
  const t = (bio || '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const sp = cut.lastIndexOf(' ')
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[,.;:\s]+$/, '') + '…'
}

/**
 * A colophon sheet sized to its text: taller for longer bios, and as many
 * vertical columns wide as the text needs (≈14px kai, ~6.5px per Latin
 * glyph, measured against a ~600px band), plus one column for the name.
 */
export function colophonSize(text: string, maxW = DIMS.colophonW): { w: number; h: number } {
  const h = 0.32 + Math.min(0.3, text.length / 420)
  const colPx = h * 600 - 40
  const cols = 1 + Math.max(1, Math.ceil((text.length * 6.5) / colPx))
  const w = Math.max(84, Math.min(maxW, 30 + cols * 23))
  return { w, h }
}

function roleOf(roles: RoleLookup, type: string): string | undefined {
  return roles instanceof Map ? roles.get(type) : roles[type]
}

// ── Households → scenes ───────────────────────────────────────────────────────

export interface SceneMember {
  p: HsPerson
  role: 'head' | 'child'
}
export interface Scene {
  id: string
  members: SceneMember[]
  /** Earliest known birth year of its heads (else of anyone), null = undated. */
  year: number | null
  /** Shared family name of the heads, '' when they differ. */
  surname: string
}

/**
 * Group people into household scenes:
 *  1. couples/partners (horizontal bonds) cluster together as the heads;
 *  2. an "unattached" child — no partner and no children of their own in the
 *     set — joins the household of a parent, so families travel together
 *     without whole lineages collapsing into one scene;
 *  3. everyone else stands in a scene of their own.
 * Scenes are ordered by year (undated last), then by first member's name.
 */
export function buildScenes(persons: HsPerson[], rels: HsRel[], roles: RoleLookup): Scene[] {
  const idx = new Map<string, number>()
  persons.forEach((p, i) => idx.set(p.id, i))
  const parent = persons.map((_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  const hasPartner = new Uint8Array(persons.length)
  const hasChild = new Uint8Array(persons.length)
  const parentsOf = new Map<number, number[]>()
  for (const r of rels) {
    const a = idx.get(r.person_a_id)
    const b = idx.get(r.person_b_id)
    if (a == null || b == null || a === b) continue
    const role = roleOf(roles, r.type)
    if (role === 'horizontal') {
      hasPartner[a] = 1
      hasPartner[b] = 1
      const ra = find(a)
      const rb = find(b)
      if (ra !== rb) parent[rb] = ra
    } else if (role === 'vertical') {
      hasChild[a] = 1
      const list = parentsOf.get(b)
      if (list) list.push(a)
      else parentsOf.set(b, [a])
    }
  }
  // Heads clusters are fixed now; children attach to them (non-transitively).
  const headRoot = persons.map((_, i) => find(i))
  const joinTo = new Map<number, number>() // child index → household root
  for (let i = 0; i < persons.length; i++) {
    if (hasPartner[i] || hasChild[i]) continue
    const ps = parentsOf.get(i)
    if (!ps || !ps.length) continue
    // Prefer a household that holds two of the parents (the couple).
    let pick = headRoot[ps[0]]
    if (ps.length > 1) {
      const counts = new Map<number, number>()
      for (const q of ps) counts.set(headRoot[q], (counts.get(headRoot[q]) || 0) + 1)
      let best = -1
      for (const [root, c] of counts) if (c > best) [best, pick] = [c, root]
    }
    if (pick !== i) joinTo.set(i, pick)
  }

  const groups = new Map<number, SceneMember[]>()
  for (let i = 0; i < persons.length; i++) {
    const joined = joinTo.get(i)
    const root = joined ?? headRoot[i]
    const role: SceneMember['role'] = joined != null ? 'child' : 'head'
    const g = groups.get(root)
    if (g) g.push({ p: persons[i], role })
    else groups.set(root, [{ p: persons[i], role }])
  }

  const byYearName = (a: SceneMember, b: SceneMember) =>
    (yearOf(a.p) ?? Infinity) - (yearOf(b.p) ?? Infinity) ||
    (a.p.name || '').localeCompare(b.p.name || '')

  const scenes: Scene[] = []
  for (const members of groups.values()) {
    // A head-less group can't happen (the root is always a head), but a
    // household whose heads are all children-joined is impossible by design.
    members.sort((a, b) => (a.role === b.role ? byYearName(a, b) : a.role === 'head' ? -1 : 1))
    // Split oversized households into consecutive scenes of MAX_SCENE.
    for (let k = 0; k < members.length; k += MAX_SCENE) {
      const part = members.slice(k, k + MAX_SCENE)
      const heads = part.filter((m) => m.role === 'head')
      const dated = (heads.length ? heads : part).map((m) => yearOf(m.p)).filter((y) => y != null)
      const year = dated.length ? Math.min(...(dated as number[])) : null
      const names = new Set(heads.map((m) => surnameOf(m.p.name)).filter(Boolean))
      scenes.push({
        id: part[0].p.id + (k ? ':' + k : ''),
        members: part,
        year,
        surname: names.size === 1 ? [...names][0] : ''
      })
    }
  }
  scenes.sort(
    (a, b) =>
      (a.year ?? Infinity) - (b.year ?? Infinity) ||
      (a.members[0].p.name || '').localeCompare(b.members[0].p.name || '') ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
  return scenes
}

// ── The procession ────────────────────────────────────────────────────────────

export type HsItem =
  | { kind: 'title'; x0: number; x1: number }
  | { kind: 'seam'; x0: number; x1: number }
  | { kind: 'end'; x0: number; x1: number; count: number }
  | {
      kind: 'person'
      x0: number
      x1: number
      /** Horizontal centre of the figure (world px). */
      x: number
      /** Top of the figure as a fraction of the band height. */
      y: number
      scale: number
      role: 'head' | 'child'
      p: HsPerson
      scene: number
    }
  | { kind: 'colophon'; x0: number; x1: number; y: number; h: number; p: HsPerson; text: string }
  | { kind: 'marker'; x0: number; x1: number; x: number; year: number | null; label: string }
  | { kind: 'label'; x0: number; x1: number; x: number; text: string; scene: number }

export interface HsAnchor {
  /** World x of the anchor (scene start, right edge). */
  x: number
  year: number | null
}

export interface HsLayout {
  totalW: number
  /** Sorted by x0 ascending (left → right in world space). */
  items: HsItem[]
  /** Widest item, for windowed lookups. */
  maxItemW: number
  /** Scene anchors sorted by x DESCENDING (reading order). */
  anchors: HsAnchor[]
  /** World spans of every scene, reading order. */
  sceneSpans: { x0: number; x1: number; size: number }[]
  /** Decade marks for the progress strip (world x, reading order). */
  marks: { x: number; label: string }[]
  scenes: number
}

export function layoutHandscroll(
  persons: HsPerson[],
  rels: HsRel[],
  roles: RoleLookup,
  dims: Partial<typeof DIMS> = {}
): HsLayout {
  const D = { ...DIMS, ...dims }
  const scenes = buildScenes(persons, rels, roles)
  // Built in reading distance `u` from the right end; each record keeps its
  // [u0, u1] span and is flipped into world x once the total is known.
  type Rec = { u0: number; u1: number; make: (x0: number, x1: number) => HsItem }
  const recs: Rec[] = []
  const anchorsU: { u: number; year: number | null }[] = []
  const spansU: { u0: number; u1: number; size: number }[] = []
  const marksU: { u: number; label: string }[] = []
  let u = 0

  const push = (w: number, make: Rec['make']) => {
    recs.push({ u0: u, u1: u + w, make })
    u += w
  }

  push(D.title, (x0, x1) => ({ kind: 'title', x0, x1 }))
  push(D.seam, (x0, x1) => ({ kind: 'seam', x0, x1 }))
  u += D.lead

  let lastDecade: number | null | undefined
  let lastYear: number | null = null
  scenes.forEach((sc, si) => {
    // Gap before the scene: grows with the years elapsed; holds a decade mark.
    const decade = sc.year == null ? null : decadeOf(sc.year)
    const needMarker = decade !== lastDecade
    if (si > 0) {
      const dy = sc.year != null && lastYear != null ? Math.max(0, sc.year - lastYear) : 0
      let gap = Math.min(D.gapMax, D.gapMin + dy * D.gapPerYear)
      if (needMarker) gap = Math.max(gap, D.markerGap)
      if (needMarker) placeMarker(u + gap / 2, decade)
      u += gap
    } else if (needMarker) {
      placeMarker(u - D.lead / 2 + 6, decade)
    }
    lastDecade = decade
    if (sc.year != null) lastYear = sc.year

    const start = u
    anchorsU.push({ u: start, year: sc.year })
    u += D.scenePad
    // Household label above the first head (only for families of 2+).
    if (sc.members.length > 1 && sc.surname) {
      const lu = u - 8
      recs.push({
        u0: lu - 14,
        u1: lu + 14,
        make: (x0, x1) => ({ kind: 'label', x0, x1, x: (x0 + x1) / 2, text: sc.surname, scene: si })
      })
    }
    const r = rng(hashStr(sc.id))
    for (const m of sc.members) {
      const slot = m.role === 'head' ? D.headSlot : D.childSlot
      const y = m.role === 'head' ? 0.13 + r() * 0.12 : 0.24 + r() * 0.12
      const scale = m.role === 'head' ? 1 : 0.86
      const p = m.p
      recs.push({
        u0: u,
        u1: u + slot,
        make: (x0, x1) => ({
          kind: 'person',
          x0,
          x1,
          x: x0 + (x1 - x0) / 2,
          y,
          scale,
          role: m.role,
          p,
          scene: si
        })
      })
      u += slot
    }
    u += D.scenePad
    spansU.push({ u0: start, u1: u, size: sc.members.length })

    // Colophons for the scene's storied members.
    let colos = 0
    for (const m of sc.members) {
      if (colos >= MAX_COLOPHONS) break
      const text = colophonText(m.p.bio)
      if (!text) continue
      u += D.colophonGap
      const p = m.p
      const { w, h } = colophonSize(text, D.colophonW)
      const y = 0.12 + r() * 0.06
      push(w, (x0, x1) => ({ kind: 'colophon', x0, x1, y, h, p, text }))
      colos++
    }
  })

  function placeMarker(cu: number, decade: number | null) {
    const label = decade == null ? '年代不詳' : cjkYear(decade)
    recs.push({
      u0: cu - 24,
      u1: cu + 24,
      make: (x0, x1) => ({ kind: 'marker', x0, x1, x: (x0 + x1) / 2, year: decade, label })
    })
    marksU.push({ u: cu, label: decade == null ? '?' : String(decade) })
  }

  u += D.lead
  push(D.seam, (x0, x1) => ({ kind: 'seam', x0, x1 }))
  const count = persons.length
  push(D.end, (x0, x1) => ({ kind: 'end', x0, x1, count }))

  const totalW = Math.ceil(u)
  const items = recs.map((rec) => rec.make(totalW - rec.u1, totalW - rec.u0))
  items.sort((a, b) => a.x0 - b.x0)
  let maxItemW = 0
  for (const it of items) maxItemW = Math.max(maxItemW, it.x1 - it.x0)
  return {
    totalW,
    items,
    maxItemW,
    anchors: anchorsU.map((a) => ({ x: totalW - a.u, year: a.year })),
    sceneSpans: spansU.map((s) => ({ x0: totalW - s.u1, x1: totalW - s.u0, size: s.size })),
    marks: marksU.map((m) => ({ x: totalW - m.u, label: m.label })),
    scenes: scenes.length
  }
}

// ── Windowing / camera helpers ────────────────────────────────────────────────

/** Index of the first item whose x0 ≥ x (items sorted by x0). */
export function lowerBound(items: { x0: number }[], x: number): number {
  let lo = 0
  let hi = items.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (items[mid].x0 < x) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** [start, end) slice of items overlapping the world range [a, b]. */
export function visibleRange(
  items: { x0: number; x1: number }[],
  a: number,
  b: number,
  maxItemW: number
): { start: number; end: number } {
  let start = lowerBound(items, a - maxItemW)
  while (start < items.length && items[start].x1 < a) start++
  const end = lowerBound(items, b + 0.0001)
  return { start: Math.min(start, end), end }
}

/** Camera (world x of the band's right edge) clamped to the scroll. */
export function clampCam(cam: number, totalW: number, viewW: number): number {
  const lo = Math.min(totalW, viewW)
  return Math.max(lo, Math.min(totalW, cam))
}

/** 0 at the start (right end) → 1 at the far left end. */
export function progressOf(cam: number, totalW: number, viewW: number): number {
  const span = totalW - Math.min(totalW, viewW)
  return span > 0 ? Math.max(0, Math.min(1, (totalW - cam) / span)) : 0
}

/** The scene year in view at world x (anchors sorted descending by x). */
export function yearAt(anchors: HsAnchor[], x: number): number | null {
  let best: HsAnchor | null = null
  for (const a of anchors) {
    if (a.x >= x) best = a
    else break
  }
  return (best || anchors[0])?.year ?? null
}

/** Landscape tile indices covering world range [a, b]. */
export function tileRange(a: number, b: number, tile = DIMS.tile): { first: number; last: number } {
  return { first: Math.floor(a / tile), last: Math.floor(b / tile) }
}

/** Roller radius for `remaining` world px still wound on it. */
export function rollerRadius(remaining: number, totalW: number, min = 9, max = 22): number {
  if (!(totalW > 0)) return min
  const f = Math.max(0, Math.min(1, remaining / totalW))
  return min + (max - min) * Math.sqrt(f)
}

// ── Landscape features ────────────────────────────────────────────────────────

export type Feature =
  | {
      kind: 'range'
      layer: 0 | 1 | 2
      x0: number
      x1: number
      x: number
      w: number
      /** Base line and height as fractions of the band height. */
      base: number
      h: number
      alpha: number
      peaks: number
      seed: number
      detail: boolean
      /** Optional 青绿 mineral wash over the peaks. */
      tint: '' | 'azurite' | 'malachite'
    }
  | {
      kind: 'pine'
      layer: 3
      x0: number
      x1: number
      x: number
      base: number
      h: number
      seed: number
      lean: number
    }
  | { kind: 'water'; layer: 1; x0: number; x1: number; y: number; seed: number }
  | { kind: 'boat'; layer: 3; x0: number; x1: number; x: number; y: number; seed: number }
  | { kind: 'hut'; layer: 3; x0: number; x1: number; x: number; base: number; seed: number }
  | { kind: 'birds'; layer: 3; x0: number; x1: number; x: number; y: number; seed: number }

/** Horizontal reach (world px) of the stand-alone motifs — feature bounds. */
const REACH = { pine: 130, boat: 70, hut: 80, birds: 90 }

/**
 * A continuous seeded landscape for a scroll `totalW` px long. Terrain
 * alternates between mountain passages and open water (a slow noise along
 * x); every scene gets a terrace to stand on with pines at its edges; the
 * stretches between scenes are left airy (留白) with the odd boat or birds.
 * Sorted by layer, then x0.
 */
export function landscapeFeatures(
  totalW: number,
  sceneSpans: { x0: number; x1: number; size: number }[],
  seed = 7
): Feature[] {
  const out: Feature[] = []
  const r = rng(seed)
  const terrain = noise1(seed * 7 + 3)
  const mountainous = (x: number) => terrain(x / 1500) + 0.35 * terrain(x / 430 + 50)

  // Far range — pale, continuous, the horizon of the whole scroll.
  for (let x = -200; x < totalW + 200;) {
    const w = 380 + r() * 360
    const tint = r() < 0.12 ? 'azurite' : ''
    out.push({
      kind: 'range',
      layer: 0,
      x0: x - 10,
      x1: x + w + 10,
      x,
      w,
      base: 0.64,
      h: 0.16 + r() * 0.16,
      alpha: 0.09 + r() * 0.06,
      peaks: 3 + Math.floor(r() * 3),
      seed: Math.floor(r() * 1e9),
      detail: false,
      tint
    })
    x += w * (0.45 + r() * 0.3)
  }

  // Middle distance — mountain passages or open water.
  for (let x = -150; x < totalW + 150;) {
    const w = 260 + r() * 300
    const m = mountainous(x + w / 2)
    if (m > 0.02) {
      const tall = 0.14 + r() * 0.14 + Math.max(0, m) * 0.1
      const tint = r() < 0.18 ? (r() < 0.5 ? 'azurite' : 'malachite') : ''
      out.push({
        kind: 'range',
        layer: 1,
        x0: x - 10,
        x1: x + w + 10,
        x,
        w,
        base: 0.86,
        h: tall,
        alpha: 0.18 + r() * 0.1,
        peaks: 2 + Math.floor(r() * 3),
        seed: Math.floor(r() * 1e9),
        detail: true,
        tint
      })
      x += w * (0.5 + r() * 0.35)
    } else {
      const ww = w * 1.4
      out.push({
        kind: 'water',
        layer: 1,
        x0: x,
        x1: x + ww,
        y: 0.8 + r() * 0.06,
        seed: Math.floor(r() * 1e9)
      })
      if (r() < 0.55) {
        const bx = x + ww * (0.2 + r() * 0.6)
        out.push({
          kind: 'boat',
          layer: 3,
          x0: bx - REACH.boat,
          x1: bx + REACH.boat,
          x: bx,
          y: 0.83 + r() * 0.06,
          seed: Math.floor(r() * 1e9)
        })
      }
      x += ww
    }
  }

  // Foreground — a terrace under each scene, pines at its edges, a hut for
  // the bigger households; airy gaps between scenes.
  sceneSpans.forEach((s, i) => {
    const sr = rng(seed * 31 + i * 977)
    const w = s.x1 - s.x0 + 120
    out.push({
      kind: 'range',
      layer: 2,
      x0: s.x0 - 70,
      x1: s.x1 + 70,
      x: s.x0 - 60,
      w,
      base: 1.02,
      h: 0.09 + sr() * 0.06,
      alpha: 0.28 + sr() * 0.1,
      peaks: 2 + Math.floor(sr() * 2),
      seed: Math.floor(sr() * 1e9),
      detail: true,
      tint: sr() < 0.1 ? 'malachite' : ''
    })
    const pine = (px: number, lean: number) =>
      out.push({
        kind: 'pine',
        layer: 3,
        x0: px - REACH.pine,
        x1: px + REACH.pine,
        x: px,
        base: 0.95 + sr() * 0.04,
        h: 0.16 + sr() * 0.1,
        seed: Math.floor(sr() * 1e9),
        lean
      })
    if (sr() < 0.85) pine(s.x1 + 6 - sr() * 30, 0.15 + sr() * 0.25)
    if (sr() < 0.45) pine(s.x0 + 10 + sr() * 30, -(0.1 + sr() * 0.25))
    if (s.size >= 3 && sr() < 0.6) {
      const hx = s.x0 + (s.x1 - s.x0) * (0.3 + sr() * 0.4)
      out.push({
        kind: 'hut',
        layer: 3,
        x0: hx - REACH.hut,
        x1: hx + REACH.hut,
        x: hx,
        base: 0.95,
        seed: Math.floor(sr() * 1e9)
      })
    }
    // Birds over the gap that follows (to the left of) this scene.
    const next = sceneSpans[i + 1]
    if (next && s.x0 - next.x1 > 140 && sr() < 0.4) {
      const bx = (s.x0 + next.x1) / 2
      out.push({
        kind: 'birds',
        layer: 3,
        x0: bx - REACH.birds,
        x1: bx + REACH.birds,
        x: bx,
        y: 0.3 + sr() * 0.1,
        seed: Math.floor(sr() * 1e9)
      })
    }
  })

  out.sort((a, b) => a.layer - b.layer || a.x0 - b.x0)
  return out
}

/** Features overlapping world range [a, b] (any order-preserving filter). */
export function featuresIn(features: Feature[], a: number, b: number): Feature[] {
  return features.filter((f) => f.x1 >= a && f.x0 <= b)
}
