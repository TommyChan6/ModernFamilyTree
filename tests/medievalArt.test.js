import { describe, it, expect } from 'vitest'
import {
  TINCTURES,
  DIVISIONS,
  blazonFor,
  genderTincture,
  heraldicFieldCss,
  medievalAvatarBg,
  hillWaves,
  hillHeight,
  castlePlan,
  roseRays,
  nibWidth,
  volute,
  MED
} from '../src/renderer/src/lib/medievalArt'
import { windColor } from '../src/renderer/src/components/graph/MedievalBackdrop.js'
import { GRAPH_THEMES } from '../src/renderer/src/components/graph/graphThemes.js'

// The canvas painters need a DOM; these cover the pure heraldry and geometry
// they are built on — every texture is redrawn from its seed, and every
// person's arms must stay the same across sessions.

describe('medieval heraldry', () => {
  it('blazons the gender as the colour, never a metal', () => {
    expect(genderTincture('male')).toBe('azure')
    expect(genderTincture('female')).toBe('gules')
    expect(genderTincture(null)).toBe('vert')
    expect(genderTincture('other')).toBe('vert')
  })

  it('gives each id stable arms that keep the rule of tincture', () => {
    const a = blazonFor('person-1', 'female')
    expect(blazonFor('person-1', 'female')).toEqual(a)
    expect(a.colour).toBe('gules')
    for (let i = 0; i < 200; i++) {
      const b = blazonFor('p' + i, i % 2 ? 'male' : 'female')
      expect(['or', 'argent']).toContain(b.metal) // metal on colour
      expect(['or', 'argent']).not.toContain(b.colour)
      expect(DIVISIONS).toContain(b.division)
    }
  })

  it('spreads ids across the divisions', () => {
    const seen = new Set()
    for (let i = 0; i < 300; i++) seen.add(blazonFor('id-' + i).division)
    expect(seen.size).toBeGreaterThanOrEqual(DIVISIONS.length - 1)
  })

  it('renders every division as a CSS background in its two tinctures', () => {
    for (const division of DIVISIONS) {
      const css = heraldicFieldCss({ colour: 'azure', metal: 'or', division })
      expect(css).toContain(TINCTURES.azure)
      expect(css).toMatch(/gradient\(/)
      if (division !== 'plain') expect(css).toContain(TINCTURES.or)
    }
  })

  it('avatars fall back to a plain field without an id', () => {
    expect(medievalAvatarBg('male')).toContain(TINCTURES.azure)
    expect(medievalAvatarBg('male')).not.toContain(TINCTURES.or + ' 50%')
    expect(medievalAvatarBg('female', 'x')).toBe(medievalAvatarBg('female', 'x'))
    expect(medievalAvatarBg('female', 'x')).toContain(TINCTURES.gules)
  })
})

describe('medieval geometry', () => {
  it('hill ridges tile seamlessly and stay in 0..1', () => {
    for (const seed of [1, 7, 31, 99]) {
      const w = hillWaves(seed)
      expect(w.every((v) => Number.isInteger(v.k) && v.k >= 1)).toBe(true)
      expect(hillHeight(w, 0, 1400)).toBeCloseTo(hillHeight(w, 1400, 1400), 9)
      for (let x = 0; x <= 1400; x += 37) {
        const h = hillHeight(w, x, 1400)
        expect(h).toBeGreaterThanOrEqual(0)
        expect(h).toBeLessThanOrEqual(1)
      }
    }
    expect(hillHeight([], 10, 100)).toBe(0.5)
  })

  it('castles keep their towers on the wall and the keep tallest', () => {
    for (let seed = 1; seed < 40; seed++) {
      const { wallW, towers } = castlePlan(seed)
      expect(towers.length).toBeGreaterThanOrEqual(3)
      const keep = towers[towers.length - 1]
      for (const t of towers) {
        expect(Math.abs(t.dx)).toBeLessThanOrEqual(wallW / 2 + 1e-9)
        expect(t.h).toBeLessThanOrEqual(keep.h)
      }
      expect(castlePlan(seed)).toEqual(castlePlan(seed))
    }
  })

  it('the compass rose starts at north with long cardinal points', () => {
    const rays = roseRays(16)
    expect(rays).toHaveLength(16)
    expect(rays[0][0]).toBeCloseTo(-Math.PI / 2) // north is up
    expect(rays[0][1]).toBe(1)
    expect(rays[4][1]).toBe(1)
    expect(rays[2][1]).toBeLessThan(1)
    expect(rays[1][1]).toBeLessThan(rays[2][1])
  })

  it('the broad nib is widest across its angle and never below the hairline', () => {
    const angle = Math.PI / 4
    expect(nibWidth(angle + Math.PI / 2, angle, 10, 1)).toBeCloseTo(10)
    expect(nibWidth(angle, angle, 10, 1)).toBe(1)
    expect(nibWidth(0, angle, 10, 1)).toBeGreaterThan(1)
  })

  it('a volute spirals inward from its radius', () => {
    const pts = volute(0, 0, 10, 1)
    expect(Math.hypot(pts[0].x, pts[0].y)).toBeCloseTo(10)
    const end = pts[pts.length - 1]
    expect(Math.hypot(end.x, end.y)).toBeLessThan(3)
  })

  it('rhumb lines are coloured by wind, as on a portolan', () => {
    expect(windColor(0)).toBe(MED.ink) // the eight winds
    expect(windColor(4)).toBe(MED.ink)
    expect(windColor(2)).toBe(MED.verdigris) // half-winds
    expect(windColor(1)).toBe(MED.vermilion) // quarter-winds
    expect(windColor(3)).toBe(MED.vermilion)
  })
})

describe('medieval graph presets', () => {
  it('coordinate the same keys as every other preset', () => {
    const keys = Object.keys(GRAPH_THEMES[0].settings).sort()
    for (const id of ['heraldry', 'illuminated']) {
      const th = GRAPH_THEMES.find((t) => t.id === id)
      expect(th).toBeTruthy()
      expect(Object.keys(th.settings).sort()).toEqual(keys)
    }
    expect(GRAPH_THEMES.find((t) => t.id === 'heraldry').settings.nodeShape).toBe('shield')
  })
})
