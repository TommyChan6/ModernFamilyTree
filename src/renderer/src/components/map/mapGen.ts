// "🎲 Generate a world" — a seeded, pure procedural starter map: a continent
// with islands, a mountain range feeding a river, forests / hills / desert /
// swamp, settlements linked by roads (a spanning tree) and one railway, and
// kingdoms carved out of the continent as Voronoi cells around their seats.
// Everything it returns is ordinary editable features. Same seed → same world.

import type { MapFeature } from '../../../../shared/types'
import {
  bboxOf,
  distToPolyline,
  pointInPolygon,
  polygonArea,
  polygonCentroid,
  rng,
  simplify
} from './mapMath'

export type NameFlavor = 'western' | 'eastern'

interface GenOpts {
  width: number
  height: number
  seed: number
  flavor?: NameFlavor
  uuid: () => string
}

const TAU = Math.PI * 2

// ── names ─────────────────────────────────────────────────────────────────────
const W_START = [
  'Ar',
  'Bel',
  'Cor',
  'Dun',
  'El',
  'Fal',
  'Gal',
  'Har',
  'Ist',
  'Kel',
  'Lor',
  'Mar',
  'Nor',
  'Or',
  'Pel',
  'Quel',
  'Ros',
  'Sil',
  'Thal',
  'Ul',
  'Val',
  'Wyn',
  'Yr',
  'Zan',
  'Bran',
  'Cael',
  'Dra',
  'Ever',
  'Fen',
  'Grim'
]
const W_MID = ['a', 'e', 'i', 'o', 'ae', 'ia', 'or', 'an', 'en', 'il', '']
const W_END = [
  'dor',
  'heim',
  'mar',
  'wick',
  'ford',
  'gard',
  'ris',
  'mont',
  'vale',
  'holm',
  'rath',
  'stead',
  'port',
  'by',
  'ton',
  'mere',
  'fell',
  'moor',
  'reach',
  'haven'
]
const E_FIRST = [
  '青',
  '洛',
  '长',
  '云',
  '金',
  '玉',
  '白',
  '龙',
  '凤',
  '临',
  '安',
  '定',
  '平',
  '江',
  '南',
  '北',
  '东',
  '西',
  '天',
  '苍',
  '雁',
  '鹤',
  '松',
  '梅',
  '紫',
  '赤'
]
const E_CITY = ['州', '城', '阳', '安', '京', '陵', '川', '宁', '关', '镇']
const E_REALM = ['齐', '楚', '燕', '赵', '魏', '韩', '秦', '吴', '越', '蜀', '周', '晋']

function namer(rand: () => number, flavor: NameFlavor) {
  const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)]
  const used = new Set<string>()
  const unique = (make: () => string) => {
    for (let i = 0; i < 20; i++) {
      const n = make()
      if (!used.has(n)) {
        used.add(n)
        return n
      }
    }
    return make()
  }
  const root = () =>
    flavor === 'eastern' ? pick(E_FIRST) + pick(E_FIRST) : pick(W_START) + pick(W_MID) + pick(W_END)
  const e2 = () => pick(E_FIRST)
  return {
    city: () => unique(() => (flavor === 'eastern' ? e2() + pick(E_CITY) : root())),
    realm: () =>
      unique(() =>
        flavor === 'eastern'
          ? pick(E_REALM) + '国'
          : pick([
              (r: string) => `Kingdom of ${r}`,
              (r: string) => `${r} Empire`,
              (r: string) => `Duchy of ${r}`,
              (r: string) => `${r} Dominion`,
              (r: string) => `Free March of ${r}`
            ])(pick(W_START) + pick(W_END))
      ),
    sea: () =>
      unique(() =>
        flavor === 'eastern' ? e2() + '海' : pick(['The ', 'Sea of ']) + pick(W_START) + pick(W_END)
      ),
    range: () =>
      unique(() =>
        flavor === 'eastern'
          ? e2() + e2() + '山'
          : `${pick(W_START)}${pick(W_END)} ${pick(['Peaks', 'Range', 'Spine', 'Teeth'])}`
      ),
    wood: () =>
      unique(() =>
        flavor === 'eastern'
          ? e2() + '林'
          : `${pick(W_START)}${pick(W_MID)} ${pick(['Wood', 'Forest', 'Thicket', 'Weald'])}`
      ),
    waste: () =>
      unique(() =>
        flavor === 'eastern'
          ? e2() + '漠'
          : `The ${pick(W_START)}${pick(W_END)} ${pick(['Wastes', 'Sands', 'Dunes'])}`
      ),
    river: () =>
      unique(() =>
        flavor === 'eastern'
          ? e2() + pick(['河', '江', '水'])
          : `${pick(W_START)}${pick(W_MID)} River`
      )
  }
}

// ── shape helpers ─────────────────────────────────────────────────────────────
/** A closed, organic blob: a circle whose radius is modulated by a handful of
 *  periodic sine harmonics (so the outline closes seamlessly) plus jitter. */
function blob(
  rand: () => number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  roughness = 0.35,
  n = 120
): number[] {
  const harmonics: [number, number, number][] = []
  for (let f = 2; f <= 11; f++)
    harmonics.push([f, (roughness * (rand() * 0.9 + 0.1)) / (f * 0.55), rand() * TAU])
  const pts: number[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU
    let r = 1
    for (const [f, amp, ph] of harmonics) r += amp * Math.sin(f * a + ph)
    r *= 1 + (rand() - 0.5) * 0.04
    r = Math.max(0.25, r)
    pts.push(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r)
  }
  return pts
}

/** Recursive midpoint displacement — turns a straight run into a meander. */
function meander(rand: () => number, pts: number[], depth: number, amount: number): number[] {
  let cur = pts
  for (let d = 0; d < depth; d++) {
    const out: number[] = [cur[0], cur[1]]
    for (let i = 0; i < cur.length - 2; i += 2) {
      const ax = cur[i]
      const ay = cur[i + 1]
      const bx = cur[i + 2]
      const by = cur[i + 3]
      const len = Math.hypot(bx - ax, by - ay)
      const nx = -(by - ay) / (len || 1)
      const ny = (bx - ax) / (len || 1)
      const off = (rand() - 0.5) * len * amount
      out.push((ax + bx) / 2 + nx * off, (ay + by) / 2 + ny * off, bx, by)
    }
    cur = out
  }
  return cur
}

/** Sutherland–Hodgman clip against the half-plane n·p ≤ c. */
function clipHalf(poly: number[], nx: number, ny: number, c: number): number[] {
  const out: number[] = []
  const n = poly.length
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n
    const ax = poly[i]
    const ay = poly[i + 1]
    const bx = poly[j]
    const by = poly[j + 1]
    const da = nx * ax + ny * ay - c
    const db = nx * bx + ny * by - c
    if (da <= 0) out.push(ax, ay)
    if (da <= 0 !== db <= 0) {
      const t = da / (da - db)
      out.push(ax + (bx - ax) * t, ay + (by - ay) * t)
    }
  }
  return out
}

const round = (pts: number[]) => pts.map((v) => Math.round(v * 10) / 10)

export const KINGDOM_COLORS = ['#c0392b', '#2e86de', '#27ae60', '#8e44ad', '#d68910', '#16a085']

export function generateWorld(opts: GenOpts): MapFeature[] {
  const { width: W, height: H, seed, uuid } = opts
  const flavor = opts.flavor || 'western'
  const rand = rng(seed)
  const names = namer(rand, flavor)
  const feats: MapFeature[] = []
  const add = (f: Omit<MapFeature, 'id'>) => {
    const full = { id: uuid(), ...f, pts: round(f.pts) } as MapFeature
    feats.push(full)
    return full
  }
  const S = Math.min(W, H)

  // ── the continent + islands ────────────────────────────────────────────────
  const cont = blob(
    rand,
    W * (0.46 + rand() * 0.08),
    H * (0.48 + rand() * 0.06),
    W * 0.33,
    H * 0.34,
    0.42,
    180
  )
  add({ kind: 'land', pts: cont, name: '' })
  const islands: number[][] = []
  for (let tries = 0; islands.length < 3 + Math.floor(rand() * 3) && tries < 60; tries++) {
    const cx = W * (0.06 + rand() * 0.88)
    const cy = H * (0.08 + rand() * 0.84)
    const r = S * (0.03 + rand() * 0.05)
    if (distToPolyline(cx, cy, cont, true) < r * 1.8 || pointInPolygon(cx, cy, cont)) continue
    if (islands.some((isl) => distToPolyline(cx, cy, isl, true) < r * 1.6)) continue
    const isl = blob(rand, cx, cy, r * (0.8 + rand() * 0.6), r, 0.5, 60)
    islands.push(isl)
    add({ kind: 'land', pts: isl })
  }

  // interior sample points: the candidates every later decision picks from
  const box = bboxOf(cont)
  const interior: [number, number][] = []
  const step = S / 28
  for (let y = box.y0; y < box.y1; y += step) {
    for (let x = box.x0; x < box.x1; x += step) {
      const jx = x + (rand() - 0.5) * step
      const jy = y + (rand() - 0.5) * step
      if (pointInPolygon(jx, jy, cont) && distToPolyline(jx, jy, cont, true) > step * 1.2) {
        interior.push([jx, jy])
      }
    }
  }
  const takeInterior = () => interior[Math.floor(rand() * interior.length)] || [W / 2, H / 2]
  const coastDist = (x: number, y: number) => distToPolyline(x, y, cont, true)

  // ── the mountain spine ─────────────────────────────────────────────────────
  const spine: number[] = []
  {
    let [x, y] = takeInterior()
    let a = rand() * TAU
    const stepLen = S * 0.055
    for (let i = 0; i < 9; i++) {
      if (!pointInPolygon(x, y, cont) || coastDist(x, y) < S * 0.04) break
      spine.push(x, y)
      a += (rand() - 0.5) * 0.7
      x += Math.cos(a) * stepLen
      y += Math.sin(a) * stepLen
    }
  }
  if (spine.length >= 6) {
    const left: number[] = []
    const right: number[] = []
    const n = spine.length / 2
    for (let i = 0; i < n; i++) {
      const px = spine[i * 2]
      const py = spine[i * 2 + 1]
      const j0 = Math.max(0, i - 1)
      const j1 = Math.min(n - 1, i + 1)
      const dx = spine[j1 * 2] - spine[j0 * 2]
      const dy = spine[j1 * 2 + 1] - spine[j0 * 2 + 1]
      const len = Math.hypot(dx, dy) || 1
      const taper = Math.sin(((i + 0.5) / n) * Math.PI)
      const w = S * 0.03 * (0.55 + rand() * 0.5) * (0.35 + taper * 0.65)
      left.push(px - (dy / len) * w, py + (dx / len) * w)
      right.push(px + (dy / len) * w, py - (dx / len) * w)
    }
    const ridge: number[] = [...left]
    for (let i = right.length - 2; i >= 0; i -= 2) ridge.push(right[i], right[i + 1])
    add({ kind: 'mountains', pts: ridge, name: names.range() })
    // foothills flank the range
    const [hx, hy] = [spine[Math.floor(n / 2) * 2], spine[Math.floor(n / 2) * 2 + 1]]
    add({
      kind: 'hills',
      pts: blob(rand, hx + S * 0.07 * (rand() - 0.5), hy + S * 0.08, S * 0.08, S * 0.05, 0.3, 50)
    })

    // ── a river from the range to the nearest coast ──────────────────────────
    const sx = spine[2]
    const sy = spine[3]
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < cont.length; i += 2) {
      const d = Math.hypot(cont[i] - sx, cont[i + 1] - sy)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    const river = meander(rand, [sx, sy, cont[best], cont[best + 1]], 5, 0.45)
    add({ kind: 'river', pts: simplify(river, 1.5), name: names.river() })
  }

  // ── forests, desert, swamp, grassland ──────────────────────────────────────
  const onRidge = (x: number, y: number) =>
    spine.length >= 4 && distToPolyline(x, y, spine) < S * 0.07
  const blobAt = (kind: MapFeature['kind'], r: number, name?: string) => {
    for (let t = 0; t < 30; t++) {
      const [x, y] = takeInterior()
      if (onRidge(x, y)) continue
      const pts = blob(rand, x, y, r * (0.9 + rand() * 0.6), r * (0.6 + rand() * 0.4), 0.45, 70)
      add({ kind, pts, ...(name ? { name } : {}) })
      return
    }
  }
  const forests = 3 + Math.floor(rand() * 2)
  for (let i = 0; i < forests; i++)
    blobAt('forest', S * (0.05 + rand() * 0.04), i === 0 ? names.wood() : undefined)
  blobAt('grass', S * 0.09)
  if (rand() < 0.8) blobAt('desert', S * 0.08, names.waste())
  if (rand() < 0.7) blobAt('swamp', S * 0.035)
  // an inland lake
  if (rand() < 0.75) {
    const [x, y] = takeInterior()
    if (!onRidge(x, y)) add({ kind: 'water', pts: blob(rand, x, y, S * 0.03, S * 0.02, 0.4, 48) })
  }
  // frozen north on islands near the top edge
  for (const isl of islands) {
    const [, cy] = polygonCentroid(isl)
    if (cy < H * 0.2) add({ kind: 'snow', pts: isl.slice() })
  }

  // ── settlements ────────────────────────────────────────────────────────────
  interface Site {
    x: number
    y: number
    glyph: string
    name: string
  }
  const sites: Site[] = []
  const minGap = S * 0.12
  for (let t = 0; t < 400 && sites.length < 9; t++) {
    const [x, y] = takeInterior()
    if (onRidge(x, y)) continue
    if (sites.some((s) => Math.hypot(s.x - x, s.y - y) < minGap)) continue
    const glyph =
      sites.length === 0
        ? 'capital'
        : sites.length < 3
          ? 'city'
          : coastDist(x, y) < S * 0.07
            ? 'port'
            : sites.length < 6
              ? 'town'
              : 'village'
    sites.push({ x, y, glyph, name: names.city() })
  }
  // a castle guarding the range, a ruin, a temple
  if (spine.length >= 6) {
    const i = Math.floor(spine.length / 4) * 2
    sites.push({
      x: spine[i] + S * 0.04,
      y: spine[i + 1] + S * 0.03,
      glyph: 'castle',
      name: names.city()
    })
  }
  for (const glyph of ['ruin', 'temple']) {
    for (let t = 0; t < 40; t++) {
      const [x, y] = takeInterior()
      if (sites.some((s) => Math.hypot(s.x - x, s.y - y) < minGap * 0.6)) continue
      sites.push({ x, y, glyph, name: names.city() })
      break
    }
  }

  // ── roads: a spanning tree over the towns (Prim) ────────────────────────────
  const towns = sites.filter((s) =>
    ['capital', 'city', 'town', 'port', 'village', 'castle'].includes(s.glyph)
  )
  if (towns.length > 1) {
    const inTree = new Set([0])
    while (inTree.size < towns.length) {
      let bi = -1
      let bj = -1
      let bd = Infinity
      for (const i of inTree) {
        for (let j = 0; j < towns.length; j++) {
          if (inTree.has(j)) continue
          const d = Math.hypot(towns[i].x - towns[j].x, towns[i].y - towns[j].y)
          if (d < bd) {
            bd = d
            bi = i
            bj = j
          }
        }
      }
      inTree.add(bj)
      const a = towns[bi]
      const b = towns[bj]
      add({ kind: 'road', pts: simplify(meander(rand, [a.x, a.y, b.x, b.y], 3, 0.22), 1) })
    }
    // one railway: capital → the farthest big settlement
    const cap = towns[0]
    let far = towns[1]
    for (const s of towns) {
      if (s.glyph === 'village') continue
      if (Math.hypot(s.x - cap.x, s.y - cap.y) > Math.hypot(far.x - cap.x, far.y - cap.y)) far = s
    }
    add({ kind: 'rail', pts: meander(rand, [cap.x, cap.y, far.x, far.y], 2, 0.08), name: '' })
    // a sea route from a port to the nearest island
    const port = sites.find((s) => s.glyph === 'port')
    if (port && islands.length) {
      let bestIsl = islands[0]
      let bestD = Infinity
      for (const isl of islands) {
        const [cx, cy] = polygonCentroid(isl)
        const d = Math.hypot(cx - port.x, cy - port.y)
        if (d < bestD) {
          bestD = d
          bestIsl = isl
        }
      }
      const [ix, iy] = polygonCentroid(bestIsl)
      add({ kind: 'searoute', pts: meander(rand, [port.x, port.y, ix, iy], 2, 0.3) })
      sites.push({ x: ix, y: iy, glyph: 'village', name: names.city() })
    }
  }
  for (const s of sites) add({ kind: 'place', icon: s.glyph, pts: [s.x, s.y], name: s.name })

  // ── kingdoms: Voronoi cells of the continent around their seats ───────────
  const seats = sites.filter((s) => s.glyph === 'capital' || s.glyph === 'city').slice(0, 3)
  seats.forEach((seat, i) => {
    let cell = cont.slice()
    for (let j = 0; j < seats.length && cell.length >= 6; j++) {
      if (j === i) continue
      const o = seats[j]
      const nx = o.x - seat.x
      const ny = o.y - seat.y
      const mx = (o.x + seat.x) / 2
      const my = (o.y + seat.y) / 2
      cell = clipHalf(cell, nx, ny, nx * mx + ny * my)
    }
    if (cell.length < 6 || Math.abs(polygonArea(cell)) < S * S * 0.002) return
    add({
      kind: 'territory',
      pts: simplify(cell, 0.5),
      name: names.realm(),
      color: KINGDOM_COLORS[i % KINGDOM_COLORS.length]
    })
  })

  // ── a name for the sea ─────────────────────────────────────────────────────
  add({
    kind: 'label',
    pts: [W * 0.12 + rand() * W * 0.05, H * 0.86],
    name: names.sea(),
    size: 1.2,
    icon: 'sea'
  })
  return feats
}
