import { pathXAt } from './householdRivers'
import { distToPolyline } from './timelineLinks'
import { projectFlat, pinHit } from './timelineTilt'
import { BRUSH } from '../webgl/InkThreadLayer.js'

// Household rivers on the Timeline renderer (layout.rivers, from
// householdRivers.ts): every lifeline is a polyline in world units (years ×
// lane x), drawn as one LifelineLayer capsule per segment so all the lifeline
// looks, the shadow pass and the selection halo keep working; household
// channels are RiverLayer bands. Every point goes through the renderer's own
// sx() / sy() (flat stage px — the time warp and the tilt projection apply
// on top), and the screen polylines are cached per geometry frame for the
// segment-based hit tests.

const SEG = 16 // points per ink thread chunk − 1 (the InkThreadLayer's segments)

/** Per-layout caches + instance counts (call from setData). */
export function riverSetData(r, layout) {
  const R = layout.rivers
  const was = !!r._rv
  if (!R) {
    r._rv = null
    r._rvBands = null
    r._rvExtra = 0
    r._rvInkExtra = 0
    return
  }
  const n = layout.people.length
  const off = new Int32Array(n),
    cnt = new Int32Array(n)
  let pts = 0,
    extra = 0,
    inkExtra = 0,
    dead = 0
  layout.people.forEach((p, i) => {
    const k = p.path ? p.path.length / 2 : 2
    off[i] = pts
    cnt[i] = k
    pts += k
    extra += Math.max(0, k - 2)
    inkExtra += Math.max(0, Math.ceil((k - 1) / SEG) - 1)
    if (p.dead) dead++
  })
  r._rv = {
    off,
    cnt,
    pts: new Float32Array(pts * 2),
    endX: new Float32Array(n),
    bbox: new Float32Array(n * 4),
    segBase: n + dead
  }
  r._rvExtra = extra
  r._rvInkExtra = inkExtra
  r.lines.setCount(n + dead + extra)
  r._rvBands = R.households.map((h) => ({
    h,
    n: h.edges.length / 3,
    pts: new Float32Array((h.edges.length / 3) * 4),
    count: 0,
    bbox: [0, 0, 0, 0],
    alpha: 0
  }))
  if (!was) {
    // bands fade in as the lives glide into their channels
    r._rvSince = r._timeSec
    r._entranceUntil = Math.max(r._entranceUntil, r._timeSec + 0.7)
  }
}

/** World x a person's lifeline has at `year` (glide included). */
function lifeX(r, p, year) {
  const dx = r._lane(p.id, p.laneX) - p.laneX
  return (p.path ? pathXAt(p.path, year) : p.laneX) + dx
}

/** Screen-space (flat px) polylines for every life, clipped at the time-travel
 *  year; also the end points for the death caps / living dots. */
export function buildRiverScreen(r, tYear) {
  const rv = r._rv
  if (!rv) return
  const L = r.layout
  const P = rv.pts
  for (let i = 0; i < L.people.length; i++) {
    const p = L.people[i]
    const a = r._pAnim.get(p.id)
    const yOff = a ? r._entrance(a).yOff : 0
    const dx = r._lane(p.id, p.laneX) - p.laneX
    const endYear = tYear == null ? p.endYear : Math.min(p.endYear, Math.max(tYear, p.birthYear))
    const path = p.path
    const o = rv.off[i],
      c = rv.cnt[i]
    let clipX = null
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity
    for (let k = 0; k < c; k++) {
      let year = path ? path[k * 2] : k ? p.endYear : p.birthYear
      let x = path ? path[k * 2 + 1] : p.laneX
      if (year > endYear) {
        year = endYear
        if (clipX == null) clipX = path ? pathXAt(path, endYear) : x
        x = clipX
      }
      const X = r.sx(x + dx)
      const Y = r.sy(year) + yOff
      P[(o + k) * 2] = X
      P[(o + k) * 2 + 1] = Y
      if (X < x0) x0 = X
      if (X > x1) x1 = X
      if (Y < y0) y0 = Y
      if (Y > y1) y1 = Y
    }
    // the same floor the straight lifelines get (a life is never < 8px long)
    const last = (o + c - 1) * 2
    const top = P[o * 2 + 1]
    if (P[last + 1] < top + 8) {
      P[last + 1] = top + 8
      y1 = Math.max(y1, top + 8)
    }
    rv.endX[i] = P[last]
    rv.bbox[i * 4] = x0
    rv.bbox[i * 4 + 1] = y0
    rv.bbox[i * 4 + 2] = x1
    rv.bbox[i * 4 + 3] = y1
  }
}

/** Write person i's polyline into the lifeline (and shadow) instances: its
 *  first segment in slot i, the rest from `segI` on. Returns the next slot. */
export function writeRiverLife(r, i, segI, lw, rgb, op, lk, seed, halo, shadows) {
  const rv = r._rv
  const P = rv.pts
  const o = rv.off[i],
    c = rv.cnt[i]
  const n = r.layout.people.length
  // Full-opacity joints overlap invisibly; faded ones keep the usual 85%.
  const alpha = op * (c > 2 && op > 0.98 ? 1 : 0.85)
  for (let k = 0; k < c - 1; k++) {
    const idx = k === 0 ? i : segI++
    const ax = P[(o + k) * 2],
      ay = P[(o + k) * 2 + 1],
      bx = P[(o + k + 1) * 2],
      by = P[(o + k + 1) * 2 + 1]
    const a = k > 0 && ax === bx && ay === by ? 0 : alpha
    r.lines.set(idx, ax, ay, bx, by, lw, rgb, a, lk.n, lk.pad, seed, halo)
    if (shadows) r.lineShadows.set(k === 0 ? i : n + (idx - rv.segBase), ax, ay, bx, by, lw, rgb, a)
  }
  return segI
}

/** End-of-life x (flat px) for the death cap / living dot. */
export function riverEndX(r, i) {
  return r._rv ? r._rv.endX[i] : 0
}

/** Rope endpoints of a marriage in rivers mode: where both lives are in its
 *  year (world x, glide included) — the confluence. */
export function riverRopeLanes(r, m) {
  const a = r._pById.get(m.ids[0]),
    b = r._pById.get(m.ids[1])
  return [
    a ? lifeX(r, a, m.year) : r._lane(m.ids[0], m.laneX1),
    b ? lifeX(r, b, m.year) : r._lane(m.ids[1], m.laneX2)
  ]
}

/** Screen x (flat px) of a life at `year` — rivers-aware. */
export function riverScreenX(r, p, year) {
  return r.sx(lifeX(r, p, year))
}

// ── Household bands ──────────────────────────────────────────────────────────
const _hsl = (h, s, l) => {
  const k = (n) => (n + h * 12) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)]
}
function hashUnit(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 3600) / 3600
}
/** A household's tint: a hue hashed from its id, nudged toward the accent,
 *  in the theme's lightness (ink: a near-grey wash). */
function householdRGB(r, h, accent) {
  const theme = r.ink ? 'i' : r.light ? 'l' : 'd'
  const cache = r._rvTint || (r._rvTint = new Map())
  const key = h.id + theme + accent.join(',')
  let c = cache.get(key)
  if (c) return c
  const hue = hashUnit(h.heads.join('|') || h.id)
  const base = r.ink
    ? _hsl(hue, 0.18, 0.36)
    : r.light
      ? _hsl(hue, 0.5, 0.45)
      : _hsl(hue, 0.55, 0.64)
  const t = r.ink ? 0 : 0.22
  c = base.map((v, j) => v + (accent[j] - v) * t)
  if (cache.size > 4000) cache.clear()
  cache.set(key, c)
  return c
}

/** Rebuild the river bands (flat px, clipped at the time-travel year). */
export function writeRiverBands(r, tYear, accentRGB) {
  const layer = r.riverBands
  layer.begin()
  const bands = r._rvBands
  if (!bands) {
    layer.commit()
    return false
  }
  const fb = r.flatBounds()
  const fade = Math.max(0, Math.min(1, (r._timeSec - (r._rvSince ?? 0)) / 0.6))
  const base = r.ink ? 0.1 : r.light ? 0.11 : 0.14
  const hook = r.hooks.householdVisual
  for (const b of bands) {
    const h = b.h
    b.count = 0
    b.alpha = 0
    if (tYear != null && h.start > tYear) continue
    const e = h.edges
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity
    let m = 0
    for (let k = 0; k < b.n; k++) {
      let year = e[k * 3],
        l = e[k * 3 + 1],
        rr = e[k * 3 + 2]
      if (tYear != null && year > tYear) {
        if (k === 0) break
        const py = e[(k - 1) * 3]
        const u = year > py ? (tYear - py) / (year - py) : 1
        l = e[(k - 1) * 3 + 1] + (l - e[(k - 1) * 3 + 1]) * u
        rr = e[(k - 1) * 3 + 2] + (rr - e[(k - 1) * 3 + 2]) * u
        year = tYear
      }
      const y = r.sy(year)
      const lx = r.sx(l),
        rx = r.sx(rr)
      b.pts[m * 4] = lx
      b.pts[m * 4 + 1] = y
      b.pts[m * 4 + 2] = rx
      b.pts[m * 4 + 3] = y
      m++
      if (lx < x0) x0 = lx
      if (rx > x1) x1 = rx
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      if (year === tYear) break
    }
    if (m < 2 || x1 < fb.x0 - 20 || x0 > fb.x1 + 20 || y1 < fb.y0 - 20 || y0 > fb.y1 + 20) continue
    const v = hook ? hook(h) : null
    const alpha = base * (v ? v.opacity : 1) * (v?.lit ? 2.2 : 1) * fade
    b.count = m
    b.alpha = alpha
    b.bbox[0] = x0
    b.bbox[1] = y0
    b.bbox[2] = x1
    b.bbox[3] = y1
    layer.band(b.pts, m, householdRGB(r, h, accentRGB), alpha)
  }
  layer.commit()
  return fade < 1
}

// ── Hit tests (flat stage px, like the renderer's own) ──────────────────────
function tiltScale(r, mx, my) {
  const T = r.tilted ? r._view : null
  const S = T ? projectFlat(mx, my, T) : null
  return { T, S, k: S ? 1 / Math.max(0.08, S.s) : 1 }
}

/** The life under a flat point: its avatar pin, else the nearest polyline. */
export function riverPersonAt(r, mx, my) {
  const rv = r._rv
  const people = r.layout.people
  if (!rv || !people.length) return null
  const { T, S, k } = tiltScale(r, mx, my)
  // Lives in one channel sit close together: a tighter reach than the lanes'
  // 14px keeps the water between them hoverable (the household).
  const tol = Math.max(6, Math.min(14, 56 * r.camera2.ls * 0.3)) * k
  let best = null,
    bestD = tol
  for (let i = 0; i < people.length; i++) {
    const bb = i * 4
    if (
      mx < rv.bbox[bb] - 20 * k ||
      mx > rv.bbox[bb + 2] + 20 * k ||
      my < rv.bbox[bb + 1] - 20 * k ||
      my > rv.bbox[bb + 3] + 14 * k
    )
      continue
    if ((r._pAnim.get(people[i].id)?.op ?? 1) < 0.02) continue
    const o = rv.off[i]
    const px = rv.pts[o * 2],
      py = rv.pts[o * 2 + 1]
    if (S ? pinHit(S.x, S.y, px, py, 17, T) : Math.hypot(mx - px, my - py) <= 17) return people[i]
    const d = distToPolyline(rv.pts, o * 2, rv.cnt[i], mx, my)
    if (d <= bestD) {
      bestD = d
      best = people[i]
    }
  }
  return best
}

/** The household channel under a flat point ({ kind: 'household', household }
 *  — the narrowest one when channels share the spot), null = none. */
export function riverHouseholdAt(r, mx, my) {
  const bands = r._rvBands
  if (!bands) return null
  let best = null,
    bestW = Infinity
  for (const b of bands) {
    if (b.count < 2 || b.alpha < 0.01) continue
    const bb = b.bbox
    if (mx < bb[0] || mx > bb[2] || my < bb[1] || my > bb[3]) continue
    const p = b.pts
    for (let k = 0; k < b.count - 1; k++) {
      const ya = p[k * 4 + 1],
        yb = p[k * 4 + 5]
      if (my < Math.min(ya, yb) || my > Math.max(ya, yb)) continue
      const u = yb !== ya ? (my - ya) / (yb - ya) : 0
      const l = p[k * 4] + (p[k * 4 + 4] - p[k * 4]) * u
      const rr = p[k * 4 + 2] + (p[k * 4 + 6] - p[k * 4 + 2]) * u
      if (mx >= l && mx <= rr && rr - l < bestW) {
        bestW = rr - l
        best = b.h
      }
      break
    }
  }
  return best ? { kind: 'household', household: best } : null
}

// ── 水墨 Ink: each life brushed along its polyline ──────────────────────────
/**
 * Ink threads for the river polylines. Person i's first chunk takes thread
 * slot `slot0 + i` (its Sprout slot, unused here), longer lives continue
 * from `extra0`. `styleOf(i)` → { rgb, op, width, seed, ws, wd } | null.
 */
export function writeInkRiverThreads(r, slot0, extra0, scratch, styleOf) {
  const rv = r._rv
  if (!rv) return
  const L = r.layout
  let j = extra0
  for (let i = 0; i < L.people.length; i++) {
    const s = styleOf(i)
    const o = rv.off[i],
      c = rv.cnt[i]
    const chunks = Math.max(1, Math.ceil((c - 1) / SEG))
    const y0 = rv.pts[o * 2 + 1],
      y1 = rv.pts[(o + c - 1) * 2 + 1]
    for (let q = 0; q < chunks; q++) {
      const slot = q === 0 ? slot0 + i : j++
      const from = q * SEG
      for (let k = 0; k <= SEG; k++) {
        const idx = Math.min(c - 1, from + k)
        scratch[k].x = rv.pts[(o + idx) * 2]
        scratch[k].y = rv.pts[(o + idx) * 2 + 1]
      }
      r.inkThreads.writeCurve(slot, scratch)
      if (!s) {
        r.inkThreads.writeStyle(slot, [0, 0, 0], 0, 1, BRUSH, 0, 0, 0, 0)
        continue
      }
      // the brush reaches each chunk in turn, like the straight stroke
      const fa = y1 > y0 ? (scratch[0].y - y0) / (y1 - y0) : 0
      const fb = y1 > y0 ? (scratch[SEG].y - y0) / (y1 - y0) : 1
      r.inkThreads.writeStyle(
        slot,
        s.rgb,
        s.op,
        s.width,
        BRUSH,
        0,
        s.seed + q,
        s.wd ? s.ws + s.wd * fa : 0,
        s.wd ? Math.max(0.05, s.wd * (fb - fa)) : 0
      )
    }
  }
}
