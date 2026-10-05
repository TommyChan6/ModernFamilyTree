// Hair, brows, lashes and beard for the 3D human: samples roots on the
// subdivided body (by region mask), grows strands with hairStyles.ts, and
// builds skinned ribbon meshes (hairMaterial.ts) on the body's skeleton —
// roots ride their skin, long lengths blend toward the neck/chest so hair
// drapes instead of swinging rigidly with the head.
//
// Scalp hair regenerates when the shape settles (refit) or the hair state
// changes; brows / lashes / beard are cheap and also follow live expression
// changes (follow).

import * as THREE from 'three'
import type { Human3DState } from '../../../../../shared/character3d'
import type { HumanBody, SurfacePart } from './HumanBody'
import { createHairMaterial, POINT_TEX_WIDTH, type HairMaterial } from './hairMaterial'
import {
  buildHull,
  curlStrand,
  resample,
  rng,
  type Collider,
  type Collision,
  type RootSample,
  type V3
} from './hairGroom'
import {
  BEARD_ZONES,
  HAIR_STYLE_BY_ID,
  beardStrand,
  browAccept,
  browStrand,
  curlParams,
  lashStrand,
  scalpStrand,
  type HeadFrame
} from './hairStyles'

interface StrandBatch {
  /** Resampled points, `points` per strand. */
  pts: Float32Array
  count: number
  points: number
  width: Float32Array
  rand: Float32Array
  clump: Float32Array
  /** Per point outerness 0..1 (volumetric shading). */
  outer: Float32Array | null
  lid: Int8Array | null
  eye: Uint8Array | null
  /** Per strand root skin weights (4 + 4). */
  rootIdx: Uint16Array
  rootW: Float32Array
}

type SetName = 'scalp' | 'brows' | 'lashes' | 'beard'

export class HairSystem {
  private body: HumanBody
  private sets = new Map<SetName, { mesh: THREE.SkinnedMesh; mat: HairMaterial }>()
  private state: Human3DState | null = null
  private densityScale = 1
  private lights: {
    key: THREE.DirectionalLight
    rim: THREE.DirectionalLight
    hemi: THREE.HemisphereLight
  } | null = null
  private keys: Partial<Record<SetName, string>> = {}

  constructor(body: HumanBody) {
    this.body = body
  }

  setDensityScale(k: number) {
    this.densityScale = k
    this.keys = {}
    if (this.state) this.setState(this.state)
  }

  setLights(key: THREE.DirectionalLight, rim: THREE.DirectionalLight, hemi: THREE.HemisphereLight) {
    this.lights = { key, rim, hemi }
    for (const s of this.sets.values()) this.applyLights(s.mat)
  }

  private applyLights(m: HairMaterial) {
    const l = this.lights
    if (!l) return
    const u = m.uniforms
    u.uKeyDir.value.copy(l.key.position).sub(l.key.target.position).normalize()
    u.uKeyColor.value.copy(l.key.color).multiplyScalar(l.key.intensity * 0.32)
    u.uRimDir.value.copy(l.rim.position).sub(l.rim.target.position).normalize()
    u.uRimColor.value.copy(l.rim.color).multiplyScalar(l.rim.intensity * 0.3)
    u.uSky.value.copy(l.hemi.color)
    u.uGround.value.copy(l.hemi.groundColor)
    u.uAmbient.value = l.hemi.intensity
  }

  /** Per-frame: keep light uniforms + pixel scale in sync. */
  update(camera: THREE.PerspectiveCamera, viewportH: number) {
    const px = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / Math.max(1, viewportH)
    for (const s of this.sets.values()) {
      s.mat.uniforms.uPxScale.value = px
      this.applyLights(s.mat)
    }
  }

  setState(state: Human3DState) {
    this.state = state
    this.rebuild(false)
  }

  /** Shape settled: everything regrows on the new surface. */
  refit() {
    this.keys = {}
    this.rebuild(false)
  }

  /** Live (expression) reshape: only the cheap face sets follow. */
  follow() {
    delete this.keys.brows
    delete this.keys.lashes
    delete this.keys.beard
    this.rebuild(true)
  }

  setBlink(l: number, r: number) {
    const s = this.sets.get('lashes')
    if (!s) return
    s.mat.uniforms.uBlinkL.value = l
    s.mat.uniforms.uBlinkR.value = r
  }

  private rebuild(faceOnly: boolean) {
    const st = this.state
    const part = this.body.parts.get('body')
    if (!st || !part) return
    const frame = this.headFrame(part)
    let hull: Collision | null = null
    const getHull = () => (hull ||= this.buildCollision(part, frame))
    const scalpKey = JSON.stringify([st.hair, this.densityScale, this.body.version])
    if (!faceOnly && this.keys.scalp !== scalpKey) {
      this.keys.scalp = scalpKey
      this.setBatch('scalp', this.growScalp(part, frame, getHull()), st)
    }
    const browKey = JSON.stringify([st.brows, this.body.version])
    if (this.keys.brows !== browKey) {
      this.keys.brows = browKey
      this.setBatch('brows', this.growBrows(part), st)
    }
    const lashKey = JSON.stringify([
      st.eyes.lashLength,
      st.eyes.lashDensity,
      st.makeup.mascara,
      this.body.version
    ])
    if (this.keys.lashes !== lashKey) {
      this.keys.lashes = lashKey
      this.setBatch('lashes', this.growLashes(part), st)
    }
    const beardKey = JSON.stringify([
      st.beard.style,
      st.beard.length,
      st.beard.density,
      this.densityScale,
      this.body.version
    ])
    if (this.keys.beard !== beardKey) {
      this.keys.beard = beardKey
      this.setBatch('beard', this.growBeard(part, frame, getHull()), st)
    }
    this.applyColors(st)
  }

  // ── Landmarks ─────────────────────────────────────────────────────────────
  private headFrame(part: SurfacePart): HeadFrame {
    const body = this.body
    const P = part.finePos
    const scalp = part.fineMasks.scalp
    let minY = Infinity
    let maxY = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    let maxX = 0
    for (let i = 0; i < scalp.length; i++) {
      if (scalp[i] < 0.5) continue
      const x = P[i * 3]
      const y = P[i * 3 + 1]
      const z = P[i * 3 + 2]
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (z < minZ) minZ = z
      if (z > maxZ) maxZ = z
      if (Math.abs(x) > maxX) maxX = Math.abs(x)
    }
    const eyeY = (body.eyes.l.center.y + body.eyes.r.center.y) / 2
    const cy = (maxY + eyeY) / 2
    const cage = body.cage
    const vy = (ref: [number, number, number]) => cage[body.nearestVertex(ref) * 3 + 1]
    const shoulderY = body.boneHead('upperarm01.L', new THREE.Vector3()).y
    return {
      c: [0, cy, (minZ + maxZ) / 2 + 0.05],
      rx: maxX,
      ry: maxY - cy,
      rz: (maxZ - minZ) / 2,
      eyeY,
      browY: eyeY + 0.18,
      chinY: vy([0, 6.07, 1.25]),
      mouthY: vy([0, 6.61, 1.55]),
      shoulderY,
      chestY: shoulderY - 1.5,
      earX: Math.abs(body.boneHead('head', new THREE.Vector3()).x) + 0.8
    }
  }

  /** The head hull (head vertices only) + capsule/ellipsoid body proxies. */
  private buildCollision(part: SurfacePart, f: HeadFrame): Collision {
    const P = part.finePos
    const body = this.body
    // the ears stick out of the skull — hair lies over them, not out to their tips
    const thin = part.fineMasks.thin
    const hull = buildHull(
      f.c,
      P,
      1.6,
      96,
      64,
      (i) => P[i * 3 + 1] > f.chinY - 0.12 && !(thin && thin[i] > 0.25)
    )
    const J = (name: string) => {
      const v = body.boneHead(name, new THREE.Vector3())
      return [v.x, v.y, v.z] as V3
    }
    const parts: Collider[] = []
    const neckA = J('neck01')
    const headJ = J('head')
    // neck radius: median horizontal distance of skin around mid-neck
    const midY = (neckA[1] + headJ[1]) / 2
    const ds: number[] = []
    for (let i = 0; i < P.length; i += 3) {
      if (Math.abs(P[i + 1] - midY) < 0.12 && Math.abs(P[i]) < 0.8)
        ds.push(Math.hypot(P[i] - neckA[0], P[i + 2] - (neckA[2] + headJ[2]) / 2))
    }
    ds.sort((a, b) => a - b)
    parts.push({
      kind: 'capsule',
      a: neckA,
      b: [headJ[0], headJ[1] - 0.15, headJ[2]],
      r: (ds[Math.floor(ds.length * 0.6)] || 0.5) * 0.98
    })
    // torso: a radial hull around the chest (hair rests on shoulders, chest,
    // back) built from the trunk's vertices, arms excluded
    const shoulder = J('upperarm01.L')
    const hipY = J('upperleg01.L')[1]
    const xLim = Math.abs(shoulder[0]) * 1.05
    let z0 = Infinity
    let z1 = -Infinity
    for (let i = 0; i < P.length; i += 3) {
      const y = P[i + 1]
      if (y < hipY || y > neckA[1] || Math.abs(P[i]) > xLim) continue
      z0 = Math.min(z0, P[i + 2])
      z1 = Math.max(z1, P[i + 2])
    }
    const tc: V3 = [0, hipY + (neckA[1] - hipY) * 0.62, (z0 + z1) / 2]
    const torso = buildHull(tc, P, 6, 96, 64, (i) => {
      const y = P[i * 3 + 1]
      return y > hipY - 0.6 && y < neckA[1] + 0.35 && Math.abs(P[i * 3]) < xLim
    })
    for (const s of ['L', 'R']) {
      const sh = J('upperarm01.' + s)
      // (no arm colliders: hair is groomed in the A-pose and the arms then
      // lower — colliding with where they WERE would flare the hair out)
      parts.push({
        kind: 'ellipsoid',
        c: [sh[0] * 0.85, sh[1] + 0.05, sh[2]],
        r: [0.42, 0.4, 0.46]
      })
    }
    return { hull, torso, parts }
  }

  // ── Root sampling ─────────────────────────────────────────────────────────
  /**
   * Area × mask weighted samples on the fine quads. `accept` may veto a
   * candidate (brow shapes). Deterministic for a given seed.
   */
  private sampleRoots(
    part: SurfacePart,
    mask: (fine: number) => number,
    count: number,
    seed: number,
    meta?: (fine: number[], w: number[]) => { u: number; v: number; tag: number }
  ): RootSample[] & { weights?: never } {
    const q = part.sub.quads
    const P = part.finePos
    const N = part.fineNrm
    const nq = q.length / 4
    const cand: number[] = []
    const cdf: number[] = []
    let total = 0
    for (let i = 0; i < nq; i++) {
      const m = Math.max(mask(q[i * 4]), mask(q[i * 4 + 1]), mask(q[i * 4 + 2]), mask(q[i * 4 + 3]))
      if (m < 0.02) continue
      const a = q[i * 4] * 3
      const c = q[i * 4 + 2] * 3
      const b = q[i * 4 + 1] * 3
      const d = q[i * 4 + 3] * 3
      const area =
        0.5 *
        Math.hypot(
          (P[c + 1] - P[a + 1]) * (P[d + 2] - P[b + 2]) -
            (P[c + 2] - P[a + 2]) * (P[d + 1] - P[b + 1]),
          (P[c + 2] - P[a + 2]) * (P[d] - P[b]) - (P[c] - P[a]) * (P[d + 2] - P[b + 2]),
          (P[c] - P[a]) * (P[d + 1] - P[b + 1]) - (P[c + 1] - P[a + 1]) * (P[d] - P[b])
        )
      total += area * m
      cand.push(i)
      cdf.push(total)
    }
    const out: RootSample[] = []
    if (!cand.length) return out
    const R = rng(seed)
    let guard = count * 6
    while (out.length < count && guard-- > 0) {
      const x = R() * total
      let lo = 0
      let hi = cdf.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (cdf[mid] < x) lo = mid + 1
        else hi = mid
      }
      const qi = cand[lo]
      const s = R()
      const t = R()
      const ids = [q[qi * 4], q[qi * 4 + 1], q[qi * 4 + 2], q[qi * 4 + 3]]
      const w = [(1 - s) * (1 - t), s * (1 - t), s * t, (1 - s) * t]
      let m = 0
      for (let k = 0; k < 4; k++) m += mask(ids[k]) * w[k]
      if (R() > m) continue
      const p: V3 = [0, 0, 0]
      const n: V3 = [0, 0, 0]
      for (let k = 0; k < 4; k++) {
        for (let c = 0; c < 3; c++) {
          p[c] += P[ids[k] * 3 + c] * w[k]
          n[c] += N[ids[k] * 3 + c] * w[k]
        }
      }
      const nl = Math.hypot(...n) || 1
      const extra = meta ? meta(ids, w) : { u: 0, v: 0, tag: 0 }
      const root = { p, n: [n[0] / nl, n[1] / nl, n[2] / nl] as V3, ...extra } as RootSample & {
        fine: number
      }
      // nearest corner carries the skin weights
      let best = 0
      for (let k = 1; k < 4; k++) if (w[k] > w[best]) best = k
      root.fine = ids[best]
      out.push(root)
    }
    return out
  }

  // ── Growers ───────────────────────────────────────────────────────────────
  private growScalp(part: SurfacePart, f: HeadFrame, hull: Collision): StrandBatch | null {
    const st = this.state as Human3DState
    const style = HAIR_STYLE_BY_ID.get(st.hair.style)
    if (!style || !style.count) return null
    const count = Math.round(style.count * (0.35 + st.hair.density * 0.85) * this.densityScale)
    const scalp = part.fineMasks.scalp
    const roots = this.sampleRoots(part, (i) => scalp[i], Math.round(count * 1.15), 7919)
    const R = rng(1337)
    const cp = curlParams(
      style.id === 'curly-short' || style.id === 'curly-long' || style.id === 'afro'
        ? Math.max(st.hair.curl, style.id === 'afro' ? 0.92 : 0.75)
        : st.hair.curl,
      st.hair.frizz
    )
    const paths: number[][] = []
    const used: RootSample[] = []
    for (const root of roots) {
      if (paths.length >= count) break
      const clump = clumpRand(root.p, 0.11)
      const path = scalpStrand(style.id, root, f, st.hair, hull, R, clump)
      if (!path || path.length < 6) continue
      paths.push(path)
      used.push(root)
    }
    return this.toBatch(
      part,
      paths,
      used,
      style.points,
      style.width,
      (b, i, o) => {
        const clump = b.clump[i]
        curlStrand(b.pts, o, b.points, {
          ...cp,
          // even straight hair has a slight per-clump wave + flyaways
          wave: Math.max(cp.wave, 0.012),
          frizz: Math.max(cp.frizz, 0.006),
          phase: clump * 7.3 + b.rand[i] * 0.35,
          jitter: R,
          from: 0.08
        })
      },
      f
    )
  }

  private growBrows(part: SurfacePart): StrandBatch | null {
    const st = this.state as Human3DState
    if (st.brows.style === 'none') return null
    const brow = part.fineMasks.brow
    const bu = part.fineMasks.browU
    const bv = part.fineMasks.browV
    const R = rng(4242)
    const count = Math.round(
      1400 * (0.4 + st.brows.density * 0.9) * (st.brows.style === 'bushy' ? 1.4 : 1)
    )
    const roots = this.sampleRoots(
      part,
      (i) => brow[i],
      count * 3,
      271,
      (ids, w) => {
        let u = 0
        let v = 0
        for (let k = 0; k < 4; k++) {
          u += bu[ids[k]] * w[k]
          v += bv[ids[k]] * w[k]
        }
        return { u, v: (v - 0.5) * 0.5, tag: 0 }
      }
    )
    const paths: number[][] = []
    const used: RootSample[] = []
    for (const r of roots) {
      if (paths.length >= count) break
      if (!browAccept(st.brows.style, st.brows.thickness, st.brows.arch, r.u, r.v, R)) continue
      paths.push(browStrand(st.brows.style, r, R))
      used.push(r)
    }
    return this.toBatch(part, paths, used, 5, 0.0016, null, null)
  }

  /**
   * Lash lines from MakeHuman's eyelash helper strips (part of the cage, so
   * they follow every morph): per angular bin along the lid, the vertex
   * nearest the eye is the root and the farthest gives the lash direction.
   */
  private lashArcs(side: 'l' | 'r', upper: boolean) {
    const group = this.body.asset.groups[`${side}-eyelashes-${upper ? 2 : 1}`]
    if (!group) return null
    const cage = this.body.cage
    const e = this.body.eyes[side].center
    const vs = [...new Set(group.quads)]
    const xs = vs.map((v) => Math.abs(cage[v * 3]))
    const x0 = Math.min(...xs)
    const x1 = Math.max(...xs)
    const BINS = 14
    const roots: (V3 | null)[] = Array(BINS).fill(null)
    const tips: (V3 | null)[] = Array(BINS).fill(null)
    const rd = Array(BINS).fill(Infinity)
    const td = Array(BINS).fill(-Infinity)
    vs.forEach((v, i) => {
      const b = Math.min(BINS - 1, Math.floor(((xs[i] - x0) / Math.max(1e-6, x1 - x0)) * BINS))
      const p: V3 = [cage[v * 3], cage[v * 3 + 1], cage[v * 3 + 2]]
      const d = Math.hypot(p[0] - e.x, p[1] - e.y, p[2] - e.z)
      if (d < rd[b]) {
        rd[b] = d
        roots[b] = p
      }
      if (d > td[b]) {
        td[b] = d
        tips[b] = p
      }
    })
    const r = roots
      .map((p, i) => (p && tips[i] ? { p, t: tips[i] as V3 } : null))
      .filter(Boolean) as { p: V3; t: V3 }[]
    return r.length >= 3 ? r : null
  }

  private growLashes(part: SurfacePart): StrandBatch | null {
    const st = this.state as Human3DState
    const R = rng(99)
    const paths: number[][] = []
    const used: (RootSample & { fine: number })[] = []
    const lids: number[] = []
    const eyes: number[] = []
    const mascara = st.makeup.mascara
    const length = st.eyes.lashLength + mascara * 0.35
    const density = st.eyes.lashDensity + mascara * 0.3
    for (const side of ['l', 'r'] as const) {
      const e = this.body.eyes[side].center
      const eyeC: V3 = [e.x, e.y, e.z]
      for (const upper of [true, false]) {
        const arc = this.lashArcs(side, upper)
        if (!arc) continue
        const count = Math.round((upper ? 110 : 50) * (0.4 + density * 0.9))
        for (let k = 0; k < count; k++) {
          const u = Math.min(0.999, (k + R() * 0.9) / count)
          if (!upper && (u < 0.1 || u > 0.94)) continue
          const f = u * (arc.length - 1)
          const j = Math.min(arc.length - 2, Math.floor(f))
          const t = f - j
          const lerp = (a: V3, b: V3): V3 => [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t
          ]
          const p = lerp(arc[j].p, arc[j + 1].p)
          const tip = lerp(arc[j].t, arc[j + 1].t)
          const dir = [tip[0] - p[0], tip[1] - p[1], tip[2] - p[2]]
          const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1
          const root = {
            p,
            n: [dir[0] / dl, dir[1] / dl, dir[2] / dl] as V3,
            u,
            v: 0,
            tag: 0,
            fine: -1
          }
          paths.push(lashStrand(root, eyeC, upper, length, R))
          used.push(root)
          lids.push(upper ? 1 : -1)
          eyes.push(side === 'l' ? 0 : 1)
        }
      }
    }
    const b = this.toBatch(part, paths, used, 6, 0.0021 + mascara * 0.0012, null, null)
    if (!b) return null
    b.lid = Int8Array.from(lids)
    b.eye = Uint8Array.from(eyes)
    // lids ride the head bone
    const head = this.body.bones.findIndex((x) => x.name === 'head')
    for (let i = 0; i < b.count; i++) {
      b.rootIdx.set([head, 0, 0, 0], i * 4)
      b.rootW.set([1, 0, 0, 0], i * 4)
    }
    return b
  }

  private growBeard(part: SurfacePart, f: HeadFrame, hull: Collision): StrandBatch | null {
    const st = this.state as Human3DState
    const spec = BEARD_ZONES[st.beard.style]
    if (!spec) return null
    const zones = ['beard', 'mustache', 'goatee', 'sideburn', 'neck'] as const
    const masks = zones.map((z) => part.fineMasks[z])
    const weights = zones.map((z) => spec.zones[z] || 0)
    const mask = (i: number) => {
      let m = 0
      for (let k = 0; k < zones.length; k++) m = Math.max(m, masks[k][i] * weights[k])
      return m
    }
    const count = Math.round(spec.count * (0.35 + st.beard.density * 0.9) * this.densityScale)
    const roots = this.sampleRoots(part, mask, count, 5150, (ids, w) => {
      // tag = dominant zone (mustache / goatee / sideburn / neck beat cheeks)
      let tag = 0
      let best = 0
      for (let k = 1; k < zones.length; k++) {
        let m = 0
        for (let c = 0; c < 4; c++) m += masks[k][ids[c]] * w[c]
        m *= weights[k] || 0
        if (m > best + 0.15) {
          best = m
          tag = k
        }
      }
      return { u: 0, v: 0, tag }
    })
    const R = rng(777)
    const paths = roots.map((r) => beardStrand(st.beard.style, r, f, st.beard.length, hull, R))
    const pts = spec.length > 0.15 ? 10 : spec.length > 0.04 ? 6 : 3
    const cp = curlParams(Math.min(0.55, 0.25 + st.hair.curl * 0.3), 0.35)
    return this.toBatch(
      part,
      paths,
      roots,
      pts,
      spec.length < 0.03 ? 0.0016 : 0.0022,
      spec.length > 0.15
        ? (b, i, o) => {
            curlStrand(b.pts, o, b.points, {
              ...cp,
              curl: cp.curl * 0.4,
              period: 0.3,
              phase: b.clump[i] * 5,
              jitter: R,
              from: 0.2
            })
          }
        : null,
      null
    )
  }

  // ── Geometry ──────────────────────────────────────────────────────────────
  private toBatch(
    part: SurfacePart,
    paths: number[][],
    roots: RootSample[],
    points: number,
    width: number,
    post: ((b: StrandBatch, i: number, o: number) => void) | null,
    f: HeadFrame | null
  ): StrandBatch | null {
    const count = paths.length
    if (!count) return null
    const R = rng(31337)
    const b: StrandBatch = {
      pts: new Float32Array(count * points * 3),
      count,
      points,
      width: new Float32Array(count),
      rand: new Float32Array(count),
      clump: new Float32Array(count),
      outer: f ? new Float32Array(count * points) : null,
      lid: null,
      eye: null,
      rootIdx: new Uint16Array(count * 4),
      rootW: new Float32Array(count * 4)
    }
    for (let i = 0; i < count; i++) {
      resample(paths[i], points, b.pts, i * points * 3)
      b.width[i] = width * (0.75 + R() * 0.5)
      b.rand[i] = R()
      b.clump[i] = clumpRand(roots[i].p, 0.11)
      const fine = Math.max(0, (roots[i] as RootSample & { fine?: number }).fine ?? 0)
      for (let k = 0; k < 4; k++) {
        b.rootIdx[i * 4 + k] = part.fineSkinIndex[fine * 4 + k]
        b.rootW[i * 4 + k] = part.fineSkinWeight[fine * 4 + k]
      }
      post?.(b, i, i * points * 3)
    }
    if (f && b.outer) {
      // outerness: distance from the head centre relative to this strand's root
      for (let i = 0; i < count; i++) {
        const o = i * points * 3
        const r0 = Math.hypot(
          b.pts[o] - f.c[0],
          (b.pts[o + 1] - f.c[1]) * 0.9,
          b.pts[o + 2] - f.c[2]
        )
        for (let k = 0; k < points; k++) {
          const a = o + k * 3
          const r = Math.hypot(
            b.pts[a] - f.c[0],
            (b.pts[a + 1] - f.c[1]) * 0.9,
            b.pts[a + 2] - f.c[2]
          )
          b.outer[i * points + k] = Math.min(
            1,
            Math.max(0, (r - r0) / 0.14 + 0.25 + b.rand[i] * 0.3)
          )
        }
      }
    }
    return b
  }

  private setBatch(name: SetName, batch: StrandBatch | null, st: Human3DState) {
    const old = this.sets.get(name)
    if (old) {
      old.mesh.removeFromParent()
      old.mesh.geometry.dispose()
      old.mat.uniforms.uPoints.value?.dispose()
    }
    if (!batch) {
      if (old) {
        old.mat.material.dispose()
        old.mat.depthMaterial.dispose()
      }
      this.sets.delete(name)
      return
    }
    const mat = old?.mat || createHairMaterial()
    const geo = this.buildGeometry(batch, name, mat)
    const mesh = new THREE.SkinnedMesh(geo, mat.material)
    mesh.customDepthMaterial = mat.depthMaterial
    mesh.castShadow = name === 'scalp' || name === 'beard'
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    mesh.name = 'hair-' + name
    mesh.layers.set(1) // HumanStage HAIR_LAYER: drawn, but not in the AO pre-pass
    this.body.rig.add(mesh)
    mesh.bind(this.body.skeleton, this.body.meshes.get('body')?.bindMatrix)
    if (name === 'lashes') {
      mat.uniforms.uEyeL.value.copy(this.body.eyes.l.center)
      mat.uniforms.uEyeR.value.copy(this.body.eyes.r.center)
    }
    this.sets.set(name, { mesh, mat })
    this.applyLights(mat)
    void st
  }

  /**
   * Instanced ribbons: one template ribbon (P points × 2 sides), one instance
   * per strand; points in a float texture, per-strand data as instance
   * attributes (see hairMaterial.ts).
   */
  private buildGeometry(b: StrandBatch, name: SetName, mat: HairMaterial) {
    const P = b.points
    const perRow = Math.max(1, Math.floor(POINT_TEX_WIDTH / P))
    const rows = Math.ceil(b.count / perRow)
    const tex = new Float32Array(perRow * P * rows * 4)
    for (let s = 0; s < b.count; s++) {
      const row = Math.floor(s / perRow)
      const col = (s % perRow) * P
      for (let k = 0; k < P; k++) {
        const o = (row * perRow * P + col + k) * 4
        const src = (s * P + k) * 3
        tex[o] = b.pts[src]
        tex[o + 1] = b.pts[src + 1]
        tex[o + 2] = b.pts[src + 2]
        tex[o + 3] = b.outer ? b.outer[s * P + k] : 0.75
      }
    }
    const dt = new THREE.DataTexture(tex, perRow * P, rows, THREE.RGBAFormat, THREE.FloatType)
    dt.minFilter = THREE.NearestFilter
    dt.magFilter = THREE.NearestFilter
    dt.needsUpdate = true
    const u = mat.uniforms
    u.uPoints.value = dt
    u.uPerRow.value = perRow
    u.uP.value = P
    const body = this.body
    const bi = (n: string) =>
      Math.max(
        0,
        body.bones.findIndex((x) => x.name === n)
      )
    u.uScalpBlend.value = name === 'scalp' ? 1 : 0
    u.uHeadY.value = body.boneHead('head', new THREE.Vector3()).y
    u.uNeckY.value = body.boneHead('neck01', new THREE.Vector3()).y
    u.uBlendBones.value.set(bi('head'), bi('neck02'), bi('spine01'))

    // Template ribbon
    const aK = new Float32Array(P * 2 * 2)
    for (let k = 0; k < P; k++) {
      aK.set([k, -1, k, 1], k * 4)
    }
    const index: number[] = []
    for (let k = 0; k < P - 1; k++) {
      const a = k * 2
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    const g = new THREE.InstancedBufferGeometry()
    g.instanceCount = b.count
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P * 2 * 3), 3))
    g.setAttribute('aK', new THREE.BufferAttribute(aK, 2))
    g.setIndex(index)
    // Per strand
    const kind = name === 'scalp' ? 0 : name === 'brows' ? 1 : name === 'lashes' ? 2 : 3
    const strand = new Float32Array(b.count * 4)
    const lid = new Float32Array(b.count * 2)
    for (let s = 0; s < b.count; s++) {
      strand.set([b.width[s], b.rand[s], b.clump[s], kind], s * 4)
      lid.set([b.lid ? b.lid[s] : 0, b.eye ? b.eye[s] : 0], s * 2)
    }
    g.setAttribute('aStrand', new THREE.InstancedBufferAttribute(strand, 4))
    g.setAttribute('aLid', new THREE.InstancedBufferAttribute(lid, 2))
    g.setAttribute('skinIndex', new THREE.InstancedBufferAttribute(Float32Array.from(b.rootIdx), 4))
    g.setAttribute('skinWeight', new THREE.InstancedBufferAttribute(b.rootW, 4))
    return g
  }

  private applyColors(st: Human3DState) {
    const grey = Math.max(st.hair.grey, Math.min(1, Math.max(0, (st.body.age - 45) / 40)) * 0.6)
    const set = (
      name: SetName,
      root: string,
      tip: string,
      opts: {
        gloss?: number
        tipFade?: number
        dark?: number
        highlight?: string
        hAmt?: number
        grey?: number
      }
    ) => {
      const s = this.sets.get(name)
      if (!s) return
      const u = s.mat.uniforms
      u.uRoot.value.set(root)
      u.uTip.value.set(tip || root)
      if (opts.highlight) u.uHighlight.value.set(opts.highlight)
      u.uHighlightAmt.value = opts.hAmt ?? 0
      u.uGloss.value = opts.gloss ?? 0.5
      u.uTipFade.value = opts.tipFade ?? 0.2
      u.uDarkRoots.value = opts.dark ?? 0.4
      u.uGrey.value = opts.grey ?? 0
    }
    const h = st.hair
    set('scalp', h.color, h.tip || h.color, {
      gloss: h.gloss,
      highlight: h.highlight || h.color,
      hAmt: h.highlight ? 0.22 : 0,
      grey,
      tipFade: h.style === 'buzz' ? 0.5 : 0.22,
      dark: 0.45
    })
    set('brows', st.brows.color, st.brows.color, {
      gloss: 0.3,
      tipFade: 0.5,
      dark: 0.1,
      grey: grey * 0.7
    })
    const lash = new THREE.Color(st.brows.color).lerp(
      new THREE.Color('#050505'),
      0.55 + st.makeup.mascara * 0.45
    )
    set('lashes', '#' + lash.getHexString(), '#' + lash.getHexString(), {
      gloss: 0.2 + st.makeup.mascara * 0.5,
      tipFade: 0.4,
      dark: 0
    })
    set('beard', st.beard.color, st.beard.color, { gloss: 0.35, tipFade: 0.35, dark: 0.3, grey })
  }

  dispose() {
    for (const s of this.sets.values()) {
      s.mesh.removeFromParent()
      s.mesh.geometry.dispose()
      s.mat.uniforms.uPoints.value?.dispose()
      s.mat.material.dispose()
      s.mat.depthMaterial.dispose()
    }
    this.sets.clear()
  }
}

/** A per-clump random in 0..1 from a root position (cells of `cell` dm). */
function clumpRand(p: V3, cell: number) {
  const x = Math.floor(p[0] / cell)
  const y = Math.floor(p[1] / cell)
  const z = Math.floor(p[2] / cell)
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
