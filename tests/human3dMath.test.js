import { describe, it, expect } from 'vitest'
import {
  applyStencil,
  catmullClark,
  composeStencil,
  quadNormals,
  renderTopology
} from '../src/renderer/src/components/character/human3d/subdivision'
import {
  addModifier,
  ageToMH,
  applyTargets,
  macroTargetWeights,
  triWeights,
  MIN_AGE,
  MAX_AGE
} from '../src/renderer/src/components/character/human3d/humanMorph'
import {
  ALL_SHAPE_GROUPS,
  IDEAL_SHAPE,
  SLIDER_BY_ID,
  shapeTargetWeights
} from '../src/renderer/src/components/character/human3d/catalog'
import {
  buildHull,
  collide,
  curlStrand,
  grow,
  hullRadius,
  resample,
  rng
} from '../src/renderer/src/components/character/human3d/hairGroom'
import {
  browAccept,
  curlParams,
  HAIR_STYLES
} from '../src/renderer/src/components/character/human3d/hairStyles'
import {
  inheritModel3D,
  model3dForPerson,
  model3dFrom2D,
  paletteFrom3D,
  randomizeModel3D,
  seeded,
  PRESETS_3D
} from '../src/renderer/src/components/character/human3d/model3d'
import {
  mirrorOps,
  poseOps,
  POSES,
  expressionWeights,
  EXPRESSIONS
} from '../src/renderer/src/components/character/human3d/poses'
import { defaultModel3D, sanitizeModel3D, DEFAULT_HUMAN3D } from '../src/shared/character3d'
import {
  SCULPT_HANDLES,
  axisResponse,
  axisVector,
  displacementAt,
  resolveHandles,
  solveSlider,
  vertexNormal
} from '../src/renderer/src/components/character/human3d/sculptHandles'

// A unit cube as 6 outward-facing quads over 8 corners
const CUBE_V = [
  [-1, -1, -1],
  [1, -1, -1],
  [1, 1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
  [1, -1, 1],
  [1, 1, 1],
  [-1, 1, 1]
].flat()
const CUBE_Q = [
  [0, 3, 2, 1],
  [4, 5, 6, 7],
  [0, 1, 5, 4],
  [2, 3, 7, 6],
  [1, 2, 6, 5],
  [0, 4, 7, 3]
].flat()
const CUBE_UV = new Float32Array(CUBE_Q.length * 2).map((_, i) => (i % 3) / 3)

describe('Catmull–Clark stencil', () => {
  it('builds V + E + F fine vertices whose weights sum to 1', () => {
    const sub = catmullClark(CUBE_Q, CUBE_Q, CUBE_UV)
    expect(sub.fineCount).toBe(8 + 12 + 6)
    expect(sub.quads.length).toBe(6 * 4 * 4)
    for (let r = 0; r < sub.fineCount; r++) {
      let s = 0
      for (let k = sub.stencil.start[r]; k < sub.stencil.start[r + 1]; k++) s += sub.stencil.w[k]
      expect(s).toBeCloseTo(1, 6)
    }
  })

  it('pulls a cube toward a sphere (corners move in, faces stay)', () => {
    const sub = catmullClark(CUBE_Q, CUBE_Q, CUBE_UV)
    const out = applyStencil(sub.stencil, CUBE_V, new Float32Array(sub.fineCount * 3))
    // corner (vertex point) of a cube: (F + 2R + (n-3)P)/n with n = 3 → 5/9
    expect(Math.abs(out[0])).toBeCloseTo(5 / 9, 5)
    // face point = face centre
    const f = (8 + 12) * 3
    expect(Math.hypot(out[f], out[f + 1], out[f + 2])).toBeCloseTo(1, 5)
  })

  it('keeps open rims with the crease rule and composes levels', () => {
    const quad = [0, 1, 2, 3]
    const V = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]
    const sub = catmullClark(quad, quad, new Float32Array(8))
    const out = applyStencil(sub.stencil, V, new Float32Array(sub.fineCount * 3))
    // a boundary corner: (6v + n1 + n2) / 8 → (0.125, 0.125)
    expect(out[0]).toBeCloseTo(0.125, 6)
    expect(out[1]).toBeCloseTo(0.125, 6)
    const sub2 = catmullClark(sub.quads, sub.quads, new Float32Array(sub.fineCount * 2))
    const two = composeStencil(sub.stencil, sub2.stencil)
    const direct = applyStencil(two, V, new Float32Array(sub2.fineCount * 3))
    const stepwise = applyStencil(sub2.stencil, out, new Float32Array(sub2.fineCount * 3))
    for (let i = 0; i < direct.length; i++) expect(direct[i]).toBeCloseTo(stepwise[i], 5)
  })

  it('splits render vertices only along uv seams and computes normals', () => {
    const sub = catmullClark(CUBE_Q, CUBE_Q, new Float32Array(CUBE_Q.length * 2))
    const topo = renderTopology(sub)
    // one uv everywhere → no seams
    expect(topo.toFine.length).toBe(sub.fineCount)
    expect(topo.index.length).toBe(24 * 6)
    const pos = applyStencil(sub.stencil, CUBE_V, new Float32Array(sub.fineCount * 3))
    const n = quadNormals(sub.quads, pos, new Float32Array(sub.fineCount * 3))
    const f = (8 + 12 + 1) * 3 // the +z face centre
    expect(n[f + 2]).toBeCloseTo(1, 5)
  })
})

describe('MakeHuman macro weights', () => {
  it('maps ages onto MakeHuman’s 0..1 scale', () => {
    expect(ageToMH(25)).toBeCloseTo(0.5)
    expect(ageToMH(90)).toBeCloseTo(1)
    expect(ageToMH(MIN_AGE)).toBeCloseTo(0.1875)
    expect(ageToMH(5)).toBeCloseTo(0.1875) // clamped (no infant targets)
    expect(ageToMH(MAX_AGE + 20)).toBeCloseTo(1)
  })

  it('splits sliders over three anchors', () => {
    expect(triWeights(0)).toEqual([1, 0, 0])
    expect(triWeights(0.5)).toEqual([0, 1, 0])
    expect(triWeights(1)).toEqual([0, 0, 1])
    const [a, b, c] = triWeights(0.25)
    expect(a + b + c).toBeCloseTo(1)
  })

  it('blends ethnic + universal targets with weights summing to one', () => {
    const w = macroTargetWeights({
      ...DEFAULT_HUMAN3D.body,
      gender: 0.3,
      age: 40,
      muscle: 0.8,
      weight: 0.2
    })
    const sum = (prefix) =>
      [...w].filter(([k]) => k.startsWith(prefix)).reduce((a, [, v]) => a + v, 0)
    // the neutral average/average universal target is implicit (MakeHuman ships it empty)
    expect(sum('macro/universal-')).toBeLessThanOrEqual(1 + 1e-6)
    expect(sum('macro/universal-')).toBeGreaterThan(0.5)
    expect(sum('macro/african-') + sum('macro/asian-') + sum('macro/caucasian-')).toBeCloseTo(1, 5)
    expect([...w.keys()].some((k) => k.includes('baby'))).toBe(false)
    // ancestry renormalizes
    const w2 = macroTargetWeights({ ...DEFAULT_HUMAN3D.body, african: 2, asian: 0, caucasian: 0 })
    expect([...w2.keys()].every((k) => !k.startsWith('macro/asian-'))).toBe(true)
  })

  it('applies sparse targets onto the base', () => {
    const base = new Float32Array([0, 0, 0, 1, 1, 1])
    const t = {
      name: 't',
      idx: new Uint16Array([1]),
      d: new Int16Array([32767, 0, -32767]),
      scale: 0.5 / 32767
    }
    const out = applyTargets(
      base,
      new Map([['t', t]]),
      new Map([
        ['t', 2],
        ['missing', 1]
      ]),
      new Float32Array(6)
    )
    expect(Array.from(out)).toEqual([0, 0, 0, 2, 1, 0])
    const m = new Map()
    addModifier(m, { id: 'x', min: 'lo', max: 'hi' }, -0.4)
    expect(m.get('lo')).toBeCloseTo(0.4)
    expect(m.has('hi')).toBe(false)
  })
})

describe('Slider catalogue', () => {
  it('has unique slider ids and symmetric pairs for both sides', () => {
    const ids = ALL_SHAPE_GROUPS.flatMap((g) => g.sliders.map((s) => s.id))
    expect(new Set(ids).size).toBe(ids.length)
    const pair = SLIDER_BY_ID.get('eye-scale-decr-incr')
    expect(pair.max).toEqual(['l-eye-scale-incr', 'r-eye-scale-incr'])
  })

  it('turns state into target weights (symmetric, per-side, unipolar, expression)', () => {
    const s = defaultModel3D()
    s.body.ideal = 0
    s.shape = {
      'eye-scale-decr-incr': 0.5,
      'eye-scale-decr-incr@l': 0.25,
      'head-oval': 0.6,
      'nose-hump-decr-incr': -0.3
    }
    const w = shapeTargetWeights(s, new Map([['expr/mouth-open', 0.4]]))
    expect(w.get('r-eye-scale-incr')).toBeCloseTo(0.5)
    expect(w.get('l-eye-scale-incr')).toBeCloseTo(0.75)
    expect(w.get('head-oval')).toBeCloseTo(0.6)
    expect(w.get('nose-hump-decr')).toBeCloseTo(0.3)
    expect(w.get('expr/mouth-open')).toBeCloseTo(0.4)
  })

  it('layers the idealize beauty pass under the sliders, blended by sex', () => {
    for (const id of Object.keys(IDEAL_SHAPE)) expect(SLIDER_BY_ID.has(id), id).toBe(true)
    const s = defaultModel3D()
    s.body.ideal = 0
    const plain = shapeTargetWeights(s)
    expect(plain.get('l-eye-scale-incr') || 0).toBe(0)
    s.body.ideal = 1
    s.body.gender = 0
    expect(shapeTargetWeights(s).get('l-eye-scale-incr')).toBeCloseTo(
      IDEAL_SHAPE['eye-scale-decr-incr'][0]
    )
    // a negative amount drives the slider's min targets
    expect(shapeTargetWeights(s).get('nose-scale-horiz-decr')).toBeCloseTo(0.25)
    s.body.gender = 1
    expect(shapeTargetWeights(s).get('chin-bones-incr')).toBeCloseTo(
      IDEAL_SHAPE['chin-bones-decr-incr'][1]
    )
    // the user's own slider still adds on top
    s.shape = { 'eye-scale-decr-incr': 0.5 }
    expect(shapeTargetWeights(s).get('r-eye-scale-incr')).toBeCloseTo(
      0.5 + IDEAL_SHAPE['eye-scale-decr-incr'][1]
    )
  })

  it('fills idealize in on old saved looks (sanitize default)', () => {
    const old = JSON.parse(JSON.stringify(DEFAULT_HUMAN3D))
    delete old.body.ideal
    expect(sanitizeModel3D(old).body.ideal).toBe(DEFAULT_HUMAN3D.body.ideal)
  })
})

describe('Hair grooming', () => {
  // a sphere of radius 1 as hull points
  const pts = []
  for (let i = 0; i < 4000; i++) {
    const u = (i * 0.618034) % 1
    const v = ((i * 0.7548776) % 1) * 2 - 1
    const r = Math.sqrt(1 - v * v)
    pts.push(Math.cos(u * Math.PI * 2) * r, v, Math.sin(u * Math.PI * 2) * r)
  }
  const hull = buildHull([0, 0, 0], new Float32Array(pts), 3)

  it('measures a radial hull and pushes points out of it', () => {
    expect(hullRadius(hull, 0, 0, 1)).toBeGreaterThan(0.95)
    const p = [0, 0, 0.5]
    expect(collide(hull, p, 0, 0.1)).toBe(true)
    expect(Math.hypot(...p)).toBeGreaterThanOrEqual(1.04)
    expect(collide(hull, [0, 0, 3], 0, 0.1)).toBe(false)
  })

  it('grows strands that obey gravity, the hull and cut lines', () => {
    const strand = grow(
      {
        root: [0, 1, 0],
        normal: [0, 1, 0],
        length: 3,
        segments: 20,
        dir: [1, 0, 0],
        stiffness: 0.8,
        gravity: 0.6,
        margin: 0.02,
        cutY: -0.5
      },
      hull
    )
    const n = strand.length / 3
    for (let i = 0; i < n; i++) {
      expect(Math.hypot(strand[i * 3], strand[i * 3 + 1], strand[i * 3 + 2])).toBeGreaterThan(0.97)
    }
    expect(strand[strand.length - 2]).toBeGreaterThanOrEqual(-0.5 - 1e-6)
  })

  it('resamples evenly and curls without moving the root', () => {
    const out = resample([0, 0, 0, 1, 0, 0, 3, 0, 0], 4)
    expect(Array.from(out.filter((_, i) => i % 3 === 0))).toEqual([0, 1, 2, 3])
    const before = out.slice(0, 3)
    curlStrand(out, 0, 4, {
      curl: 0.1,
      wave: 0.05,
      frizz: 0.01,
      period: 0.5,
      phase: 0,
      jitter: rng(1)
    })
    expect(Array.from(out.slice(0, 3))).toEqual(Array.from(before))
    const cp = curlParams(1, 0)
    expect(cp.curl).toBeGreaterThan(0.09)
    expect(curlParams(0, 0).wave).toBe(0)
  })

  it('shapes brows by style and lists every hairstyle once', () => {
    const R = rng(3)
    expect(browAccept('natural', 0.5, 0, 0.5, 0, R)).toBe(true)
    expect(browAccept('natural', 0.5, 0, 0.5, 0.3, R)).toBe(false)
    expect(browAccept('none', 0.5, 0, 0.5, 0, R)).toBe(false)
    const ids = HAIR_STYLES.map((h) => h.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(DEFAULT_HUMAN3D.hair.style)
  })
})

describe('3D looks', () => {
  it('seeds sex and age from the person', () => {
    const m = model3dForPerson(
      { gender: 'female', birth: { year: 1950 }, death: { year: 2010 } },
      2026,
      5
    )
    expect(m.body.gender).toBeLessThan(0.2)
    expect(m.body.age).toBe(60)
    const kid = model3dForPerson({ gender_t: 0, birth: { year: 2022 } }, 2026)
    expect(kid.body.age).toBe(11) // clamped to the youngest supported age
    expect(kid.body.gender).toBe(1) // gender_t 0 = the male end
    expect(model3dForPerson({ gender: 'Male', gender_t: 1 }, 2026).body.gender).toBeGreaterThan(0.9)
  })

  it('maps a 2D look to 3D and back', () => {
    const m = model3dFrom2D({
      parts: {
        hair: { partId: 'hair-ponytail' },
        facialHair: { partId: 'beard-full' },
        torso: { partId: 'torso-dress' },
        headwear: { partId: 'hat-crown' }
      },
      palette: { skin: '#a06a48', hair: '#ff0000', outfitA: '#123456' },
      morph: { age: 1 },
      expression: 'happy'
    })
    expect(m.hair.style).toBe('ponytail')
    expect(m.beard.style).toBe('full-beard')
    expect(m.outfit.top).toBe('dress')
    expect(m.outfit.accessories).toEqual(['crown'])
    expect(m.body.age).toBe(80)
    expect(m.expression).toBe('smile')
    const pal = paletteFrom3D(m)
    expect(pal.skin).toBe('#a06a48')
    expect(pal.outfitA).toBe('#123456')
  })

  it('randomizes everything but the locked sections, deterministically', () => {
    const base = defaultModel3D()
    const a = randomizeModel3D(base, seeded(42), ['outfit', 'body'])
    const b = randomizeModel3D(base, seeded(42), ['outfit', 'body'])
    expect(a).toEqual(b)
    expect(a.outfit).toEqual(base.outfit)
    expect(a.body).toEqual(base.body)
    expect(sanitizeModel3D(a)).toEqual(a)
  })

  it('inherits a valid child look from parents', () => {
    const mom = randomizeModel3D(defaultModel3D(), seeded(1))
    const dad = randomizeModel3D(defaultModel3D(), seeded(2))
    const kid = inheritModel3D([mom, dad], defaultModel3D(), { resemblance: 1 }, seeded(3))
    expect(sanitizeModel3D(kid)).toEqual(kid)
    expect([mom.eyes.iris, dad.eyes.iris]).toContain(kid.eyes.iris)
    expect(inheritModel3D([], defaultModel3D())).toEqual(defaultModel3D())
  })

  it('applies every preset to a valid state', () => {
    for (const p of PRESETS_3D) {
      const m = defaultModel3D()
      p.apply(m)
      expect(sanitizeModel3D(m).outfit.top).toBe(m.outfit.top)
    }
  })
})

describe('Poses & expressions', () => {
  it('mirrors left ops onto the right with reflected axes', () => {
    expect(
      mirrorOps([
        ['upperarm01.L', 'z', -40],
        ['upperarm01.L', 'flex', 4],
        ['spine01', 'x', 3]
      ])
    ).toEqual([
      ['upperarm01.R', 'z', 40],
      ['upperarm01.R', 'flex', 4]
    ])
    const relaxed = poseOps(POSES.find((p) => p.id === 'relaxed'))
    expect(relaxed.some(([b]) => b === 'upperarm01.R')).toBe(true)
  })

  it('maps expressions onto expression-unit targets', () => {
    for (const e of EXPRESSIONS) {
      for (const k of expressionWeights(e.id).keys()) expect(k.startsWith('expr/')).toBe(true)
    }
    expect(expressionWeights('neutral').size).toBe(0)
    expect(expressionWeights('smile', 0.5).get('expr/mouth-corner-puller')).toBeCloseTo(0.275)
  })
})

describe('sanitizeModel3D', () => {
  it('fills defaults and clamps everything', () => {
    const m = sanitizeModel3D({
      body: { age: -5, gender: '0.3' },
      skin: { tone: '#ABCDEF', freckles: 9 },
      hair: { style: 'x y z', tip: '' },
      outfit: { accessories: ['glasses', 'glasses', 7, 'cap'] },
      shape: Object.fromEntries(Array.from({ length: 500 }, (_, i) => ['k' + i, 0.5]))
    })
    expect(m.body.age).toBe(11)
    expect(m.body.gender).toBe(0.3)
    expect(m.skin.tone).toBe('#abcdef')
    expect(m.skin.freckles).toBe(1)
    expect(m.hair.style).toBe(DEFAULT_HUMAN3D.hair.style)
    expect(m.hair.tip).toBe('')
    expect(m.outfit.accessories).toEqual(['glasses', 'cap'])
    expect(Object.keys(m.shape)).toHaveLength(400)
    expect(sanitizeModel3D(null)).toEqual(defaultModel3D())
  })
})

describe('Grab handles (direct sculpting)', () => {
  it('solves the slider value that moves a landmark by the pull', () => {
    // max end moves the point +0.4 dm, min end −0.2 dm
    expect(solveSlider(0, 0.2, 0.4, -0.2)).toBeCloseTo(0.5)
    expect(solveSlider(0, -0.1, 0.4, -0.2)).toBeCloseTo(-0.5)
    // continuing from a set value, across zero onto the other end
    expect(solveSlider(0.5, -0.3, 0.4, -0.2)).toBeCloseTo(-0.5)
    expect(solveSlider(0, 9, 0.4, -0.2)).toBe(1)
    // both ends push the same way and the pull asks for the other: rest at 0
    expect(solveSlider(0.5, -0.5, 0.4, 0.3)).toBe(0)
    // targets that barely touch the point: a plain linear response
    expect(solveSlider(0, 0.15, 0, 0)).toBeCloseTo(0.5)
    expect(displacementAt(-0.5, 0.4, -0.2)).toBeCloseTo(-0.1)
  })

  it('points the outward axis away from the midline on each side', () => {
    expect(axisVector('x', 1)).toEqual([1, 0, 0])
    expect(axisVector('x', -1)).toEqual([-1, 0, 0])
    expect(axisVector('z', -1)).toEqual([0, 0, 1])
  })

  it('only drives sliders the catalogue has', () => {
    for (const h of SCULPT_HANDLES)
      for (const id of Object.values(h.axes))
        expect(SLIDER_BY_ID.has(id), h.id + ' → ' + id).toBe(true)
  })

  it('resolves every handle on the real mesh, mirrored and anatomically ordered', async () => {
    const { readFileSync } = await import('fs')
    const { gunzipSync } = await import('zlib')
    const { parseHumanAsset } =
      await import('../src/renderer/src/components/character/human3d/humanAsset')
    const raw = gunzipSync(
      readFileSync('src/renderer/src/components/character/human3d/assets/human3d.bin')
    )
    const a = parseHumanAsset(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength))
    const pts = resolveHandles(a)
    const expected = SCULPT_HANDLES.reduce((n, h) => n + (h.mirror ? 2 : 1), 0)
    expect(pts).toHaveLength(expected)
    const P = (key) => {
      const p = pts.find((x) => x.key === key)
      return [a.base[p.vertex * 3], a.base[p.vertex * 3 + 1], a.base[p.vertex * 3 + 2]]
    }
    // pairs mirror across the midline
    for (const h of SCULPT_HANDLES.filter((x) => x.mirror)) {
      const l = P(h.id + '.l')
      const r = P(h.id + '.r')
      expect(l[0]).toBeGreaterThan(0)
      expect(r[0]).toBeCloseTo(-l[0], 1)
      expect(r[1]).toBeCloseTo(l[1], 1)
    }
    // a face reads top → bottom, and inner corners sit nearer the nose
    expect(P('eyeInner.l')[0]).toBeLessThan(P('eyeOuter.l')[0])
    expect(P('lid.l')[1]).toBeGreaterThan(P('eyeInner.l')[1] - 0.05)
    expect(P('noseTip')[1]).toBeGreaterThan(P('upperLip')[1])
    expect(P('upperLip')[1]).toBeGreaterThan(P('lowerLip')[1])
    expect(P('lowerLip')[1]).toBeGreaterThan(P('chin')[1])
    expect(P('noseTip')[2]).toBeGreaterThan(P('chin')[2])
    expect(P('crown')[1]).toBeGreaterThan(P('forehead')[1])
    // grabbing the nose tip in profile really drives its projection
    const tip = pts.find((x) => x.key === 'noseTip')
    const r = axisResponse(a, tip, 'z')
    expect(r.slider).toBe('nose-scale-depth-decr-incr')
    expect(r.dMax).toBeGreaterThan(0)
    expect(r.dMin).toBeLessThan(0)
    // rest normals face out of the body
    expect(vertexNormal(a, tip.vertex)[2]).toBeGreaterThan(0.5)
  })
})

describe('Bundled human asset', () => {
  it('parses and contains every target the editor references', async () => {
    const { readFileSync } = await import('fs')
    const { gunzipSync } = await import('zlib')
    const { parseHumanAsset } =
      await import('../src/renderer/src/components/character/human3d/humanAsset')
    const raw = gunzipSync(
      readFileSync('src/renderer/src/components/character/human3d/assets/human3d.bin')
    )
    const a = parseHumanAsset(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength))
    expect(a.meshVertexCount).toBeGreaterThan(13000)
    expect(a.bones.length).toBe(163)
    expect(Object.keys(a.groups)).toEqual(
      expect.arrayContaining(['body', 'skirt', 'upper-teeth', 'l-eye', 'r-eyelashes-2'])
    )
    for (const m of ['scalp', 'brow', 'browU', 'browV', 'beard', 'lips', 'flush', 'thin'])
      expect(a.masks[m]).toBeDefined()
    const missing = []
    for (const g of ALL_SHAPE_GROUPS)
      for (const s of g.sliders)
        for (const t of [...s.min, ...s.max]) if (!a.targets.has(t)) missing.push(t)
    for (const e of EXPRESSIONS)
      for (const t of expressionWeights(e.id).keys()) if (!a.targets.has(t)) missing.push(t)
    for (const t of macroTargetWeights(DEFAULT_HUMAN3D.body).keys())
      if (!a.targets.has(t)) missing.push(t)
    expect(missing).toEqual([])
    // bones are parent-first and joint ids point at virtual vertices
    a.bones.forEach((b, i) => {
      expect(b.parent).toBeLessThan(i)
      expect(b.head).toBeGreaterThanOrEqual(a.meshVertexCount)
    })
  })
})
