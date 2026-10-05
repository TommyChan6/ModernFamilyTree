import { describe, it, expect } from 'vitest'
import {
  toScreen,
  toWorld,
  zoomAt,
  fitCamera,
  lerpCamera,
  bboxOf,
  polygonArea,
  polygonCentroid,
  pointInPolygon,
  distToPolyline,
  pointAlong,
  simplify,
  chaikin,
  scatterInPolygon,
  windowAlpha,
  tokenStateAt,
  upsertKey,
  shiftKeys,
  lifeAlpha,
  mapTimeRange,
  fanOut,
  hitFeature,
  hitVertex,
  niceLength,
  MAX_ZOOM
} from '../src/renderer/src/components/map/mapMath'
import { generateWorld } from '../src/renderer/src/components/map/mapGen'
import { MAP_KIND_GEOMETRY } from '../src/renderer/src/components/map/mapKinds'
import { sanitizeFeature, MAP_FEATURE_KINDS } from '../src/shared/maps'

const square = [0, 0, 100, 0, 100, 100, 0, 100]
const geoOf = (k) => MAP_KIND_GEOMETRY[k]

describe('map camera', () => {
  it('round-trips world ↔ screen', () => {
    const cam = { x: 30, y: -10, k: 2.5 }
    const [sx, sy] = toScreen(cam, 12, 34)
    const [wx, wy] = toWorld(cam, sx, sy)
    expect(wx).toBeCloseTo(12)
    expect(wy).toBeCloseTo(34)
  })

  it('zoomAt keeps the anchor point fixed and clamps the zoom', () => {
    const cam = { x: 0, y: 0, k: 1 }
    const before = toWorld(cam, 200, 150)
    const z = zoomAt(cam, 200, 150, 3)
    const after = toWorld(z, 200, 150)
    expect(z.k).toBe(3)
    expect(after[0]).toBeCloseTo(before[0])
    expect(after[1]).toBeCloseTo(before[1])
    expect(zoomAt(cam, 0, 0, 1e6).k).toBe(MAX_ZOOM)
  })

  it('fitCamera frames a box inside the viewport, centred', () => {
    const cam = fitCamera({ x0: 0, y0: 0, x1: 2400, y1: 1600 }, 1240, 840, 20)
    expect(cam.k).toBeCloseTo(0.5)
    const [cx, cy] = toWorld(cam, 620, 420)
    expect(cx).toBeCloseTo(1200)
    expect(cy).toBeCloseTo(800)
  })

  it('lerpCamera hits both ends exactly', () => {
    const a = { x: 0, y: 0, k: 1 }
    const b = { x: -500, y: -300, k: 4 }
    const s = lerpCamera(a, b, 0, 800, 600)
    const e = lerpCamera(a, b, 1, 800, 600)
    expect(s.k).toBeCloseTo(1)
    expect(e.k).toBeCloseTo(4)
    expect(e.x).toBeCloseTo(-500)
    expect(e.y).toBeCloseTo(-300)
  })
})

describe('map geometry', () => {
  it('area, centroid, bbox, point-in-polygon', () => {
    expect(Math.abs(polygonArea(square))).toBe(10000)
    expect(polygonCentroid(square)).toEqual([50, 50])
    expect(bboxOf(square)).toEqual({ x0: 0, y0: 0, x1: 100, y1: 100 })
    expect(pointInPolygon(50, 50, square)).toBe(true)
    expect(pointInPolygon(150, 50, square)).toBe(false)
  })

  it('distance to a polyline, open vs closed', () => {
    const line = [0, 0, 100, 0]
    expect(distToPolyline(50, 10, line)).toBeCloseTo(10)
    // the closing edge only counts when closed
    expect(distToPolyline(-10, 50, square, false)).toBeGreaterThan(10)
    expect(distToPolyline(-10, 50, square, true)).toBeCloseTo(10)
  })

  it('pointAlong walks the length of the line', () => {
    const p = pointAlong([0, 0, 100, 0, 100, 100], 0.75)
    expect(p.x).toBeCloseTo(100)
    expect(p.y).toBeCloseTo(50)
    expect(p.angle).toBeCloseTo(Math.PI / 2)
  })

  it('simplify drops near-collinear vertices but keeps corners', () => {
    const pts = [0, 0, 10, 0.1, 20, -0.1, 30, 0, 30, 30]
    expect(simplify(pts, 1)).toEqual([0, 0, 30, 0, 30, 30])
  })

  it('chaikin smooths but keeps open-line endpoints', () => {
    const out = chaikin([0, 0, 50, 50, 100, 0], false, 2)
    expect(out.slice(0, 2)).toEqual([0, 0])
    expect(out.slice(-2)).toEqual([100, 0])
    expect(out.length).toBeGreaterThan(6)
  })

  it('scatter is deterministic, inside the shape, and sorted top-down', () => {
    const a = scatterInPolygon(square, 10, 42)
    const b = scatterInPolygon(square, 10, 42)
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(20)
    for (let i = 0; i < a.length; i += 3) expect(pointInPolygon(a[i], a[i + 1], square)).toBe(true)
    for (let i = 3; i < a.length; i += 3) expect(a[i + 1]).toBeGreaterThanOrEqual(a[i - 2])
  })
})

describe('map time', () => {
  it('windowAlpha shows unwindowed features always and fades windowed ones', () => {
    expect(windowAlpha({}, 5)).toBe(1)
    const f = { from: 1200, to: 1210 }
    expect(windowAlpha(f, 1199)).toBe(0)
    expect(windowAlpha(f, 1200)).toBe(1)
    expect(windowAlpha(f, 1210)).toBe(1) // `to` is inclusive
    expect(windowAlpha(f, 1211.6)).toBe(0)
    const mid = windowAlpha(f, 1199.75)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
    expect(windowAlpha(f, null)).toBe(1)
  })

  it('tokenStateAt rests at stops and eases between them', () => {
    const keys = [
      { t: 1200, x: 0, y: 0 },
      { t: 1210, x: 100, y: 0 }
    ]
    expect(tokenStateAt(keys, 1190)).toMatchObject({ x: 0, y: 0, leg: -1 })
    expect(tokenStateAt(keys, 1220)).toMatchObject({ x: 100, y: 0, leg: -1, from: 1 })
    const mid = tokenStateAt(keys, 1205)
    expect(mid.x).toBeCloseTo(50)
    expect(mid.leg).toBeCloseTo(0.5)
    expect(tokenStateAt(keys, 1201).x).toBeLessThan(10) // eased: slow start
    expect(tokenStateAt(keys, null)).toMatchObject({ x: 100 })
  })

  it('upsertKey replaces a same-year stop, inserts sorted, never mutates', () => {
    const keys = [
      { t: 1200, x: 0, y: 0, note: 'born' },
      { t: 1220, x: 5, y: 5 }
    ]
    const a = upsertKey(keys, 1210.4, 9, 9)
    expect(a.map((k) => k.t)).toEqual([1200, 1210, 1220])
    const b = upsertKey(keys, 1200, 3, 3)
    expect(b[0]).toEqual({ t: 1200, x: 3, y: 3, note: 'born' })
    expect(keys[0].x).toBe(0)
    expect(shiftKeys(keys, 1, 2).map((k) => [k.x, k.y])).toEqual([
      [1, 2],
      [6, 7]
    ])
  })

  it('lifeAlpha hides the unborn and ghosts the dead', () => {
    expect(lifeAlpha(1200, 1260, 1150)).toBe(0)
    expect(lifeAlpha(1200, 1260, 1230)).toBe(1)
    expect(lifeAlpha(1200, 1260, 1300)).toBeCloseTo(0.4)
    expect(lifeAlpha(null, null, 5)).toBe(1)
  })

  it('mapTimeRange widens the project range by journeys and windows', () => {
    const r = mapTimeRange([{ from: 1100 }, { to: 1400 }], [{ keys: [{ t: 1000 }, { t: 1050 }] }], {
      min: 1200,
      max: 1300
    })
    expect(r).toEqual({ min: 1000, max: 1400 })
    // a single-stop token isn't a journey — it doesn't stretch the range
    expect(mapTimeRange([], [{ keys: [{ t: 5 }] }], null)).toBeNull()
    // tiny ranges are padded so the track is usable
    expect(mapTimeRange([{ from: 1200 }], [], null)).toEqual({ min: 1195, max: 1205 })
  })
})

describe('map picking', () => {
  const feats = [
    { id: 'land', kind: 'land', pts: [0, 0, 1000, 0, 1000, 1000, 0, 1000] },
    { id: 'realm', kind: 'territory', pts: [0, 0, 600, 0, 600, 600, 0, 600] },
    { id: 'wood', kind: 'forest', pts: [100, 100, 200, 100, 200, 200, 100, 200] },
    { id: 'road', kind: 'road', pts: [0, 400, 600, 400] },
    { id: 'town', kind: 'place', pts: [300, 402] },
    { id: 'later', kind: 'place', pts: [800, 800], from: 1500 }
  ]
  it('prefers points, then lines, then the smallest area, then land', () => {
    expect(hitFeature(feats, 301, 401, 5, null, geoOf)).toBe('town')
    expect(hitFeature(feats, 100, 401, 5, null, geoOf)).toBe('road')
    expect(hitFeature(feats, 150, 150, 5, null, geoOf)).toBe('wood')
    expect(hitFeature(feats, 500, 100, 5, null, geoOf)).toBe('realm')
    expect(hitFeature(feats, 900, 100, 5, null, geoOf)).toBe('land')
    expect(hitFeature(feats, 900, 100, 5, null, geoOf, { skipBase: true })).toBeNull()
  })
  it('ignores features the timeline has hidden', () => {
    expect(hitFeature(feats, 800, 800, 5, 1400, geoOf, { skipBase: true })).toBeNull()
    expect(hitFeature(feats, 800, 800, 5, 1500, geoOf)).toBe('later')
  })
  it('hitVertex finds the nearest control point', () => {
    expect(hitVertex(square, 98, 3, 5)).toBe(1)
    expect(hitVertex(square, 50, 50, 5)).toBe(-1)
  })
  it('fanOut spreads stacked tokens and leaves loners alone', () => {
    const out = fanOut([
      { x: 100, y: 100 },
      { x: 101, y: 99 },
      { x: 400, y: 400 }
    ])
    expect(out[2]).toEqual({ x: 400, y: 400 })
    expect(Math.hypot(out[0].x - out[1].x, out[0].y - out[1].y)).toBeGreaterThan(20)
  })
  it('niceLength rounds to 1/2/5 steps', () => {
    expect(niceLength(130)).toBe(100)
    expect(niceLength(260)).toBe(200)
    expect(niceLength(7.3)).toBe(5)
  })
})

describe('world generator', () => {
  let n = 0
  const uuid = () => 'id' + ++n
  const gen = (seed, flavor) => generateWorld({ width: 2400, height: 1600, seed, flavor, uuid })

  it('is deterministic per seed and differs across seeds', () => {
    const strip = (fs) => fs.map((f) => ({ ...f, id: '' }))
    expect(strip(gen(7))).toEqual(strip(gen(7)))
    expect(strip(gen(7))).not.toEqual(strip(gen(8)))
  })

  it('builds a complete, valid starter world', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const fs = gen(seed)
      const kinds = new Set(fs.map((f) => f.kind))
      for (const k of ['land', 'forest', 'place', 'road', 'territory', 'label'])
        expect(kinds.has(k)).toBe(true)
      expect(fs.filter((f) => f.kind === 'place' && f.icon === 'capital')).toHaveLength(1)
      for (const f of fs) {
        expect(MAP_FEATURE_KINDS).toContain(f.kind)
        // everything survives the data layer's sanitizer untouched
        const clean = sanitizeFeature(f, uuid)
        expect(clean.pts).toEqual(f.pts)
        for (let i = 0; i < f.pts.length; i++) expect(Number.isFinite(f.pts[i])).toBe(true)
      }
    }
  })

  it('names places in Chinese for the ink flavor', () => {
    const cap = gen(5, 'eastern').find((f) => f.icon === 'capital')
    expect(cap.name).toMatch(/[一-鿿]/)
  })
})

// ── 山水 painted styles: the pure half (inkPaint.ts) ──────────────────────────
describe('ink painting maths', async () => {
  const ink = await import('../src/renderer/src/components/map/inkPaint')
  const { MAP_STYLE_LIST, MAP_STYLES } =
    await import('../src/renderer/src/components/map/mapStyles')
  const { MAP_STYLE_IDS } = await import('../src/shared/maps')
  const big = [0, 0, 900, 0, 900, 600, 0, 600]

  it('places sprites deterministically, back to front', () => {
    const a = ink.paintingPlacements(big, 'mountains', 7)
    const b = ink.paintingPlacements(big, 'mountains', 7)
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(8)
    for (let i = 1; i < a.length; i++) expect(a[i].y).toBeGreaterThanOrEqual(a[i - 1].y)
    for (const p of a) {
      expect(p.pick).toBeGreaterThanOrEqual(0)
      expect(p.pick).toBeLessThan(1)
      expect(p.scale).toBeGreaterThanOrEqual(0.78)
      expect(p.scale).toBeLessThanOrEqual(1.22)
      expect(p.x).toBeGreaterThan(0)
      expect(p.x).toBeLessThan(900)
    }
    expect(ink.paintingPlacements(big, 'mountains', 8)).not.toEqual(a)
  })

  it('packs a small range into a cluster rather than a lone peak', () => {
    const small = [0, 0, 260, 0, 260, 140, 0, 140]
    expect(ink.paintingPlacements(small, 'mountains', 3).length).toBeGreaterThanOrEqual(3)
  })

  it('picks a sprite index within the set', () => {
    expect(ink.pickIndex(0, 5)).toBe(0)
    expect(ink.pickIndex(0.999, 5)).toBe(4)
    expect(ink.pickIndex(0.5, 0)).toBe(-1)
  })

  it('splits a coast into pressure runs that cover every segment', () => {
    const ring = []
    for (let i = 0; i < 40; i++) ring.push(Math.cos(i / 6.4) * 100, Math.sin(i / 6.4) * 100)
    const runs = ink.brushRuns(ring, true, 11)
    expect(runs[0].i0).toBe(0)
    expect(runs[runs.length - 1].i1).toBe(40) // wraps back to the first vertex
    // consecutive runs share their joint vertex, so the line never breaks
    for (let i = 1; i < runs.length; i++) expect(runs[i].i0).toBe(runs[i - 1].i1)
    for (const r of runs) expect(r.w).toBeGreaterThan(0.4)
    expect(ink.vertexAt(ring, 40)).toEqual(ink.vertexAt(ring, 0))
    expect(ink.brushRuns([0, 0], false, 1)).toEqual([])
  })

  it('cross-fades two wave octaves that keep the tile a steady screen size', () => {
    for (const k of [0.07, 0.3, 0.5, 1, 1.7, 6]) {
      const o = ink.waveOctaves(k, 0.62)
      const sum = o.reduce((s, x) => s + x.alpha, 0)
      expect(sum).toBeCloseTo(1, 5)
      for (const x of o) {
        const screen = x.scale * k
        expect(screen).toBeGreaterThanOrEqual(0.3)
        expect(screen).toBeLessThan(1.25)
      }
    }
  })

  it('flies a skein of geese across now and then', () => {
    const W = 2400
    const H = 1600
    const f = ink.flockAt(10, 3, W, H)
    expect(f).not.toBeNull()
    expect(f.birds.length).toBeGreaterThanOrEqual(5)
    expect(f.alpha).toBeGreaterThan(0)
    expect(f.alpha).toBeLessThanOrEqual(1)
    expect(f.y).toBeLessThan(H * 0.6)
    expect(ink.flockAt(10, 3, W, H)).toEqual(f)
    expect(ink.flockAt(45, 3, W, H)).toBeNull() // between crossings
    // successive crossings alternate direction
    const a = ink.flockAt(5, 3, W, H)
    const b = ink.flockAt(56 + 5, 3, W, H)
    expect(Math.sign(Math.cos(a.angle))).not.toBe(Math.sign(Math.cos(b.angle)))
  })

  it('sails a boat out and back along its route', () => {
    const route = [0, 0, 400, 0]
    const seen = new Set()
    for (let t = 0; t < 200; t += 5) {
      const b = ink.boatAt(route, t, 5, 0.1)
      expect(b.x).toBeGreaterThanOrEqual(0)
      expect(b.x).toBeLessThanOrEqual(400)
      expect(b.y).toBe(0)
      seen.add(b.dir)
    }
    expect(seen).toEqual(new Set([1, -1]))
    expect(ink.boatAt([5, 5, 5, 5], 3, 5, 0)).toBeNull()
  })

  it('blooms each blot from 0 to 1, staggered', () => {
    expect(ink.bloomProgress(0, 0)).toBe(0)
    expect(ink.bloomProgress(5, 0)).toBe(1)
    expect(ink.bloomProgress(0.1, 2)).toBe(0)
    let prev = 0
    for (let t = 0; t <= 2; t += 0.05) {
      const p = ink.bloomProgress(t, 1)
      expect(p).toBeGreaterThanOrEqual(prev)
      prev = p
    }
  })

  it('registers the painted styles everywhere a style id is checked', () => {
    expect(MAP_STYLE_LIST.map((s) => s.id).sort()).toEqual([...MAP_STYLE_IDS].sort())
    for (const id of ['shanshui', 'qinglu']) {
      const st = MAP_STYLES[id]
      expect(st.eastern).toBe(true)
      expect(st.painting).toBeTruthy()
      expect(st.frame).toBe('scroll')
      expect(st.mount).toBeTruthy()
    }
    expect(MAP_STYLES.ink.eastern).toBe(true)
    expect(MAP_STYLES.parchment.painting).toBeUndefined()
  })
})
