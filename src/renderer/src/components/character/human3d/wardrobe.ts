// Procedural clothing + accessories for the 3D human.
//
// Garments are SHELLS of the subdivided body: each fine vertex gets a
// continuous coverage value from body coordinates (bone-group weights, the
// parameter along each arm / leg, landmark heights), the shell is offset
// along the normal by the fabric's thickness and relaxed with constrained
// Laplacian smoothing so cloth bridges hollows instead of shrink-wrapping
// (navel, cleavage, spine). Hems are crisp: the fabric shader alpha-clips the
// interpolated coverage at 0.5. Shells share the body's skin weights, so they
// pose with it. Skirts, dresses and robes use MakeHuman's skirt helper, cut
// to length in the shader. Accessories are small procedural meshes fitted to
// landmarks and parented to bones.

import * as THREE from 'three'
import type { Human3DState } from '../../../../../shared/character3d'
import type { HumanBody, SurfacePart } from './HumanBody'
import { createFabricMaterial, type Fabric, type FabricMaterial } from './fabricMaterial'
import { applyStencil } from './subdivision'

// ── Catalogue ────────────────────────────────────────────────────────────────
export interface GarmentInfo {
  id: string
  label: string
}

export const TOPS: GarmentInfo[] = [
  { id: 'none', label: 'None' },
  { id: 'tank', label: 'Tank top' },
  { id: 'tee', label: 'T-shirt' },
  { id: 'longsleeve', label: 'Long sleeve' },
  { id: 'shirt', label: 'Button shirt' },
  { id: 'sweater', label: 'Sweater' },
  { id: 'turtleneck', label: 'Turtleneck' },
  { id: 'vneck', label: 'V-neck' },
  { id: 'crop', label: 'Crop top' },
  { id: 'dress', label: 'Dress' },
  { id: 'gown', label: 'Gown' },
  { id: 'robe', label: 'Robe' },
  { id: 'armor', label: 'Plate armour' }
]

export const BOTTOMS: GarmentInfo[] = [
  { id: 'none', label: 'Underwear' },
  { id: 'trousers', label: 'Trousers' },
  { id: 'jeans', label: 'Jeans' },
  { id: 'shorts', label: 'Shorts' },
  { id: 'leggings', label: 'Leggings' },
  { id: 'skirt', label: 'Skirt' },
  { id: 'midi-skirt', label: 'Midi skirt' },
  { id: 'long-skirt', label: 'Long skirt' }
]

export const SHOES: GarmentInfo[] = [
  { id: 'none', label: 'Barefoot' },
  { id: 'sneakers', label: 'Sneakers' },
  { id: 'boots', label: 'Boots' },
  { id: 'loafers', label: 'Loafers' },
  { id: 'socks', label: 'Socks' }
]

export const ACCESSORIES: GarmentInfo[] = [
  { id: 'glasses', label: 'Glasses' },
  { id: 'sunglasses', label: 'Sunglasses' },
  { id: 'earrings', label: 'Earrings' },
  { id: 'necklace', label: 'Necklace' },
  { id: 'beanie', label: 'Beanie' },
  { id: 'cap', label: 'Cap' },
  { id: 'crown', label: 'Crown' },
  { id: 'headband', label: 'Headband' },
  { id: 'watch', label: 'Watch' }
]

export const TOP_FABRIC: Record<string, Fabric> = {
  tank: 'cotton',
  tee: 'cotton',
  longsleeve: 'cotton',
  shirt: 'cotton',
  sweater: 'knit',
  turtleneck: 'knit',
  vneck: 'cotton',
  crop: 'cotton',
  dress: 'silk',
  gown: 'silk',
  robe: 'canvas',
  armor: 'metal'
}
export const BOTTOM_FABRIC: Record<string, Fabric> = {
  none: 'cotton',
  trousers: 'canvas',
  jeans: 'denim',
  shorts: 'canvas',
  leggings: 'silk',
  skirt: 'cotton',
  'midi-skirt': 'silk',
  'long-skirt': 'silk'
}

// ── Body coordinates ─────────────────────────────────────────────────────────
interface Coords {
  n: number
  P: Float32Array
  N: Float32Array
  torso: Float32Array
  neck: Float32Array
  head: Float32Array
  arm: Float32Array
  hand: Float32Array
  leg: Float32Array
  foot: Float32Array
  armT: Float32Array
  legT: Float32Array
  L: {
    neckY: number
    shoulderY: number
    chestY: number
    waistY: number
    hipY: number
    crotchY: number
    kneeY: number
    ankleY: number
  }
}

const S = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function groupOf(
  name: string
): keyof Pick<Coords, 'torso' | 'neck' | 'head' | 'arm' | 'hand' | 'leg' | 'foot'> {
  if (
    /^(head|jaw|eye|tongue|levator|oris|oculi|orbicularis|risorius|temporalis|special)/.test(name)
  )
    return 'head'
  if (name.startsWith('neck')) return 'neck'
  if (/^(wrist|metacarpal|finger)/.test(name)) return 'hand'
  if (/^(shoulder|upperarm|lowerarm)/.test(name)) return 'arm'
  if (/^(foot|toe)/.test(name)) return 'foot'
  if (/^(upperleg|lowerleg)/.test(name)) return 'leg'
  return 'torso'
}

function bodyCoords(body: HumanBody, part: SurfacePart): Coords {
  const n = part.finePos.length / 3
  const c: Coords = {
    n,
    P: part.finePos,
    N: part.fineNrm,
    torso: new Float32Array(n),
    neck: new Float32Array(n),
    head: new Float32Array(n),
    arm: new Float32Array(n),
    hand: new Float32Array(n),
    leg: new Float32Array(n),
    foot: new Float32Array(n),
    armT: new Float32Array(n),
    legT: new Float32Array(n),
    L: { neckY: 0, shoulderY: 0, chestY: 0, waistY: 0, hipY: 0, crotchY: 0, kneeY: 0, ankleY: 0 }
  }
  const groups = body.asset.bones.map((b) => groupOf(b.name))
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 4; k++) {
      const w = part.fineSkinWeight[i * 4 + k]
      if (!w) continue
      c[groups[part.fineSkinIndex[i * 4 + k]]][i] += w
    }
  }
  const J = (name: string) => body.boneHead(name, new THREE.Vector3())
  const shL = J('upperarm01.L')
  const shR = J('upperarm01.R')
  const wrL = J('wrist.L')
  const wrR = J('wrist.R')
  const hipL = J('upperleg01.L')
  const hipR = J('upperleg01.R')
  const anL = J('foot.L')
  const anR = J('foot.R')
  const proj = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) => {
    const ab = b.clone().sub(a)
    return p.clone().sub(a).dot(ab) / ab.lengthSq()
  }
  const p = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    p.set(c.P[i * 3], c.P[i * 3 + 1], c.P[i * 3 + 2])
    const left = p.x >= 0
    c.armT[i] = proj(p, left ? shL : shR, left ? wrL : wrR)
    c.legT[i] = proj(p, left ? hipL : hipR, left ? anL : anR)
  }
  const neck = J('neck01')
  c.L = {
    neckY: neck.y,
    shoulderY: shL.y,
    chestY: shL.y - 1.1,
    waistY: (shL.y + hipL.y) / 2 - 0.35,
    hipY: hipL.y,
    crotchY: hipL.y - 0.75,
    kneeY: J('lowerleg01.L').y,
    ankleY: anL.y
  }
  return c
}

// ── Coverage functions (per fine vertex, 0..1) ──────────────────────────────
type Cover = (c: Coords, i: number) => number

function topCover(opts: {
  sleeve: number
  hemDrop: number
  neck: 'crew' | 'v' | 'scoop' | 'turtle' | 'collar'
  strap?: boolean
}): Cover {
  return (c, i) => {
    const y = c.P[i * 3 + 1]
    const x = c.P[i * 3]
    const z = c.P[i * 3 + 2]
    const L = c.L
    const hemY = L.hipY + 0.25 - opts.hemDrop
    let torso = S(hemY - 0.03, hemY + 0.03, y) * (1 - S(0.4, 0.75, c.leg[i] + c.foot[i]))
    // neckline
    const neckW = c.neck[i] + c.head[i]
    if (opts.neck === 'turtle') {
      torso *= 1 - S(0.75, 0.95, c.head[i]) * 1
      torso *= 1 - S(L.neckY + 1.05, L.neckY + 1.12, y)
    } else {
      const depth =
        opts.neck === 'v'
          ? 0.75
          : opts.neck === 'scoop'
            ? 0.55
            : opts.neck === 'collar'
              ? 0.05
              : 0.12
      torso *= 1 - S(0.2, 0.45, neckW)
      // front opening: below the neck base, in front
      const front = S(0.15, 0.5, z)
      const openY = L.neckY - depth + (opts.neck === 'v' ? Math.abs(x) * 1.6 : 0)
      const open = front * S(openY - 0.03, openY + 0.03, y) * (1 - S(0.55, 0.75, Math.abs(x)))
      torso *= 1 - open
      if (opts.neck === 'scoop')
        torso *= 1 - S(L.neckY - 0.25, L.neckY - 0.18, y) * (1 - front) * 0.6
    }
    const arm = c.arm[i] + c.hand[i]
    const t = c.armT[i]
    let sleeve = 1 - S(opts.sleeve - 0.012, opts.sleeve + 0.012, t)
    if (opts.strap) {
      // sleeveless: the armhole cuts in from the shoulder
      sleeve = 0
      torso *= 1 - S(0.08, 0.3, arm)
      torso *= 1 - S(0.62, 0.72, Math.abs(x) / Math.max(0.1, Math.abs(c.L.shoulderY))) * 0
    }
    return torso * (1 - arm) + arm * sleeve * (1 - S(0.3, 0.6, c.hand[i]))
  }
}

function bottomCover(legEnd: number, rise = 0): Cover {
  return (c, i) => {
    const y = c.P[i * 3 + 1]
    const L = c.L
    const top = L.waistY - 0.1 + rise
    const below = 1 - S(top - 0.03, top + 0.03, y)
    const leg = c.leg[i] + c.foot[i]
    const legCover = 1 - S(legEnd - 0.012, legEnd + 0.012, c.legT[i])
    const torsoPart = (1 - leg) * (1 - S(0.3, 0.6, c.arm[i] + c.hand[i]))
    return below * (torsoPart + leg * legCover * (1 - S(0.3, 0.6, c.foot[i])))
  }
}

const briefsCover: Cover = (c, i) => {
  const y = c.P[i * 3 + 1]
  const L = c.L
  const top = L.hipY - 0.15
  const below = 1 - S(top - 0.03, top + 0.03, y)
  const leg = c.leg[i] + c.foot[i]
  return (
    below *
    (1 - leg + leg * (1 - S(0.06, 0.08, c.legT[i] - Math.max(0, c.P[i * 3 + 2]) * 0.05))) *
    (1 - S(0.3, 0.6, c.arm[i] + c.hand[i]))
  )
}

const braCover: Cover = (c, i) => {
  const y = c.P[i * 3 + 1]
  const L = c.L
  const band = S(L.chestY - 0.75, L.chestY - 0.68, y) * (1 - S(L.chestY + 0.45, L.chestY + 0.52, y))
  const arm = c.arm[i] + c.hand[i]
  return band * (1 - S(0.1, 0.3, arm)) * (1 - S(0.2, 0.4, c.neck[i] + c.head[i]))
}

function shoeCover(fromT: number): Cover {
  return (c, i) => {
    const foot = c.foot[i]
    const leg = c.leg[i]
    return Math.min(1, foot * 1.4 + leg * S(fromT - 0.012, fromT + 0.012, c.legT[i]))
  }
}

interface ShellSpec {
  cover: Cover
  thickness: number
  /** Constrained smoothing passes (looseness). */
  ease: number
  /** Extra thickness for downward-facing faces (shoe soles). */
  sole?: number
  fabric: Fabric
  colorKey: 'top' | 'bottom' | 'shoes' | 'under'
  /** How much the shader gathers folds (0..1). */
  folds?: number
  /** Reference-space y below which the shoe sole colour shows (dm). */
  soleY?: number
}

function topSpec(id: string): ShellSpec | null {
  const f = TOP_FABRIC[id] || 'cotton'
  switch (id) {
    case 'tank':
      return {
        cover: topCover({ sleeve: 0, hemDrop: 0, neck: 'scoop', strap: true }),
        thickness: 0.035,
        ease: 2,
        fabric: f,
        colorKey: 'top'
      }
    case 'tee':
      return {
        cover: topCover({ sleeve: 0.32, hemDrop: 0, neck: 'crew' }),
        thickness: 0.05,
        ease: 7,
        fabric: f,
        colorKey: 'top'
      }
    case 'vneck':
      return {
        cover: topCover({ sleeve: 0.3, hemDrop: 0, neck: 'v' }),
        thickness: 0.045,
        ease: 4,
        fabric: f,
        colorKey: 'top'
      }
    case 'crop':
      return {
        cover: topCover({ sleeve: 0.28, hemDrop: -1.0, neck: 'scoop' }),
        thickness: 0.035,
        ease: 2,
        fabric: f,
        colorKey: 'top'
      }
    case 'longsleeve':
      return {
        cover: topCover({ sleeve: 0.94, hemDrop: 0.05, neck: 'crew' }),
        thickness: 0.05,
        ease: 4,
        fabric: f,
        colorKey: 'top'
      }
    case 'shirt':
      return {
        cover: topCover({ sleeve: 0.95, hemDrop: 0.15, neck: 'collar' }),
        thickness: 0.06,
        ease: 9,
        fabric: f,
        colorKey: 'top'
      }
    case 'sweater':
      return {
        cover: topCover({ sleeve: 0.95, hemDrop: 0.1, neck: 'crew' }),
        thickness: 0.1,
        ease: 7,
        fabric: f,
        colorKey: 'top',
        folds: 0.6
      }
    case 'turtleneck':
      return {
        cover: topCover({ sleeve: 0.95, hemDrop: 0.1, neck: 'turtle' }),
        thickness: 0.09,
        ease: 6,
        fabric: f,
        colorKey: 'top',
        folds: 0.6
      }
    case 'dress':
    case 'gown':
      return {
        cover: topCover({
          sleeve: id === 'gown' ? 0 : 0.18,
          hemDrop: 0.4,
          neck: 'scoop',
          strap: id === 'gown'
        }),
        thickness: 0.05,
        ease: 4,
        fabric: f,
        colorKey: 'top'
      }
    case 'robe':
      return {
        cover: topCover({ sleeve: 0.9, hemDrop: 0.5, neck: 'v' }),
        thickness: 0.09,
        ease: 8,
        fabric: f,
        colorKey: 'top'
      }
    case 'armor':
      return {
        cover: topCover({ sleeve: 0.45, hemDrop: 0.3, neck: 'crew' }),
        thickness: 0.16,
        ease: 10,
        fabric: 'metal',
        colorKey: 'top',
        folds: 0
      }
    default:
      return null
  }
}

function bottomSpec(id: string): ShellSpec | null {
  const f = BOTTOM_FABRIC[id] || 'canvas'
  switch (id) {
    case 'trousers':
      return { cover: bottomCover(0.97), thickness: 0.05, ease: 5, fabric: f, colorKey: 'bottom' }
    case 'jeans':
      return { cover: bottomCover(0.96), thickness: 0.045, ease: 3, fabric: f, colorKey: 'bottom' }
    case 'shorts':
      return { cover: bottomCover(0.33), thickness: 0.045, ease: 4, fabric: f, colorKey: 'bottom' }
    case 'leggings':
      return {
        cover: bottomCover(0.99, 0.05),
        thickness: 0.018,
        ease: 0,
        fabric: f,
        colorKey: 'bottom'
      }
    default:
      return null
  }
}

function shoeSpec(id: string): ShellSpec | null {
  switch (id) {
    case 'sneakers':
      return {
        cover: shoeCover(0.94),
        thickness: 0.11,
        ease: 16,
        sole: 0.2,
        fabric: 'canvas',
        colorKey: 'shoes',
        folds: 0.2,
        soleY: -8.1
      }
    case 'boots':
      return {
        cover: shoeCover(0.62),
        thickness: 0.1,
        ease: 16,
        sole: 0.22,
        fabric: 'leather',
        colorKey: 'shoes',
        folds: 0.2,
        soleY: -8.1
      }
    case 'loafers':
      return {
        cover: shoeCover(1.0),
        thickness: 0.08,
        ease: 14,
        sole: 0.14,
        fabric: 'leather',
        colorKey: 'shoes',
        folds: 0,
        soleY: -8.12
      }
    case 'socks':
      return { cover: shoeCover(0.8), thickness: 0.015, ease: 0, fabric: 'knit', colorKey: 'shoes' }
    default:
      return null
  }
}

/** Skirt-helper garments: reference-space cut height (dm, base mesh). */
const SKIRT_CUT: Record<string, number> = {
  skirt: -2.4,
  'midi-skirt': -4.6,
  'long-skirt': -7.2,
  dress: -3.6,
  gown: -99,
  robe: -99
}

// ── The wardrobe ─────────────────────────────────────────────────────────────
interface Layer {
  key: string
  mesh: THREE.SkinnedMesh
  mat: FabricMaterial
}

export class Wardrobe {
  private body: HumanBody
  private layers = new Map<string, Layer>()
  private skirtMat: FabricMaterial | null = null
  private accessories = new THREE.Group()
  private accKey = ''
  private state: Human3DState | null = null
  private keyOf = new Map<string, string>()
  private adjacency: Int32Array[] | null = null
  private metal = new THREE.MeshPhysicalMaterial({
    color: 0xc9a45c,
    metalness: 1,
    roughness: 0.25,
    clearcoat: 0.5
  })
  private lens = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.02,
    transparent: true,
    opacity: 0.12,
    clearcoat: 1,
    depthWrite: false
  })

  constructor(body: HumanBody) {
    this.body = body
    this.accessories.name = 'accessories'
  }

  setState(state: Human3DState) {
    this.state = state
    this.rebuild(false)
  }

  refit() {
    this.keyOf.clear()
    this.accKey = ''
    this.rebuild(false)
  }

  /** Live reshape (expressions): garments keep their last fit; nothing to do. */
  follow() {}

  private rebuild(_fast: boolean) {
    const st = this.state
    const part = this.body.parts.get('body')
    if (!st || !part) return
    const o = st.outfit
    const v = this.body.version
    let coords: Coords | null = null
    const C = () => (coords ||= bodyCoords(this.body, part))
    const female = st.body.gender < 0.5

    const want: Record<string, { spec: ShellSpec | null; key: string }> = {
      under: {
        spec:
          o.bottom === 'none' || SKIRT_CUT[o.bottom] !== undefined || SKIRT_CUT[o.top] !== undefined
            ? { cover: briefsCover, thickness: 0.014, ease: 0, fabric: 'cotton', colorKey: 'under' }
            : null,
        key: 'briefs'
      },
      bra: {
        spec:
          female && (o.top === 'none' || o.top === 'tank' || o.top === 'crop')
            ? { cover: braCover, thickness: 0.022, ease: 1, fabric: 'cotton', colorKey: 'under' }
            : null,
        key: 'bra'
      },
      // full-length tops (dresses, gowns, robes) replace trousers/shorts
      bottom: {
        spec:
          SKIRT_CUT[o.top] !== undefined && o.bottom !== 'leggings' ? null : bottomSpec(o.bottom),
        key: SKIRT_CUT[o.top] !== undefined ? 'hidden-' + o.bottom : o.bottom
      },
      top: { spec: topSpec(o.top), key: o.top },
      shoes: { spec: shoeSpec(o.shoes), key: o.shoes }
    }
    for (const [slot, { spec, key }] of Object.entries(want)) {
      const k = `${key}|${v}`
      if (this.keyOf.get(slot) !== k) {
        this.keyOf.set(slot, k)
        this.setLayer(slot, spec ? this.buildShell(part, C(), spec, slot) : null)
      }
      const layer = this.layers.get(slot)
      if (layer && spec) layer.mat.setLook(this.lookFor(spec, st))
    }
    this.updateSkirt(st)
    this.updateAccessories(st)
  }

  private lookFor(spec: ShellSpec, st: Human3DState) {
    const o = st.outfit
    switch (spec.colorKey) {
      case 'top':
        return {
          color: o.topColor,
          color2: o.topColor2,
          pattern: o.topPattern,
          fabric: spec.fabric
        }
      case 'bottom':
        return {
          color: o.bottomColor,
          color2: shade(o.bottomColor, 0.25),
          pattern: 'solid',
          fabric: spec.fabric
        }
      case 'shoes':
        return {
          color: o.shoesColor,
          color2: spec.fabric === 'leather' ? '#2a211c' : '#f2efe8',
          pattern: 'solid',
          fabric: spec.fabric,
          soleY: spec.soleY
        }
      default:
        return { color: '#e9e4dc', color2: '#d8d0c4', pattern: 'solid', fabric: 'cotton' as Fabric }
    }
  }

  private setLayer(slot: string, layer: Layer | null) {
    const old = this.layers.get(slot)
    if (old) {
      old.mesh.removeFromParent()
      old.mesh.geometry.dispose()
      old.mat.material.dispose()
      this.layers.delete(slot)
    }
    if (layer) this.layers.set(slot, layer)
  }

  /** Fine-vertex neighbour lists (built once). */
  private neighbours(part: SurfacePart): Int32Array[] {
    if (this.adjacency) return this.adjacency
    const n = part.finePos.length / 3
    const sets: Set<number>[] = Array.from({ length: n }, () => new Set())
    const q = part.sub.quads
    for (let i = 0; i < q.length; i += 4) {
      for (let k = 0; k < 4; k++) {
        const a = q[i + k]
        const b = q[i + ((k + 1) & 3)]
        sets[a].add(b)
        sets[b].add(a)
      }
    }
    this.adjacency = sets.map((s) => Int32Array.from(s))
    return this.adjacency
  }

  private buildShell(part: SurfacePart, c: Coords, spec: ShellSpec, slot: string): Layer {
    const n = c.n
    let cover = new Float32Array(n)
    for (let i = 0; i < n; i++) cover[i] = spec.cover(c, i)
    // relax the coverage field so hems run smoothly between vertices
    const nbs = this.neighbours(part)
    for (let it = 0; it < 2; it++) {
      const next = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        const list = nbs[i]
        let s = 0
        for (let j = 0; j < list.length; j++) s += cover[list[j]]
        next[i] = cover[i] * 0.5 + (s / list.length) * 0.5
      }
      cover = next
    }
    // offset positions (+ sole), then constrained relaxation
    const pos = new Float32Array(n * 3)
    const minOff = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const ny = c.N[i * 3 + 1]
      // tops sit over waistbands: a little extra loft where they overlap
      const overlap =
        slot === 'top' ? 0.03 * (1 - S(c.L.waistY + 0.4, c.L.waistY + 0.8, c.P[i * 3 + 1])) : 0
      const off = spec.thickness + overlap + (spec.sole ? spec.sole * S(-0.3, -0.85, ny) : 0)
      minOff[i] = off
      for (let k = 0; k < 3; k++) pos[i * 3 + k] = c.P[i * 3 + k] + c.N[i * 3 + k] * off
    }
    if (spec.ease > 0) {
      const nb = this.neighbours(part)
      const tmp = new Float32Array(n * 3)
      const active = new Uint8Array(n)
      for (let i = 0; i < n; i++) if (cover[i] > 0.05) active[i] = 1
      for (let it = 0; it < spec.ease; it++) {
        tmp.set(pos)
        for (let i = 0; i < n; i++) {
          if (!active[i]) continue
          const list = nb[i]
          let sx = 0
          let sy = 0
          let sz = 0
          for (let j = 0; j < list.length; j++) {
            const v = list[j] * 3
            sx += tmp[v]
            sy += tmp[v + 1]
            sz += tmp[v + 2]
          }
          const k = 1 / list.length
          pos[i * 3] = tmp[i * 3] * 0.4 + sx * k * 0.6
          pos[i * 3 + 1] = tmp[i * 3 + 1] * 0.4 + sy * k * 0.6
          pos[i * 3 + 2] = tmp[i * 3 + 2] * 0.4 + sz * k * 0.6
          // never sink below the skin + thickness
          const dx = pos[i * 3] - c.P[i * 3]
          const dy = pos[i * 3 + 1] - c.P[i * 3 + 1]
          const dz = pos[i * 3 + 2] - c.P[i * 3 + 2]
          const along = dx * c.N[i * 3] + dy * c.N[i * 3 + 1] + dz * c.N[i * 3 + 2]
          if (along < minOff[i]) {
            const push = minOff[i] - along
            pos[i * 3] += c.N[i * 3] * push
            pos[i * 3 + 1] += c.N[i * 3 + 1] * push
            pos[i * 3 + 2] += c.N[i * 3 + 2] * push
          }
        }
      }
    }
    // fold gathering: elbows / knees / waist
    const fold = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const a = c.arm[i] * Math.exp(-(((c.armT[i] - 0.5) / 0.12) ** 2))
      const l = c.leg[i] * Math.exp(-(((c.legT[i] - 0.5) / 0.1) ** 2))
      const w = Math.exp(-(((c.P[i * 3 + 1] - c.L.waistY) / 0.35) ** 2)) * c.torso[i]
      fold[i] = Math.min(1, (a + l + w) * (spec.folds ?? 1))
    }
    // geometry: the body's render topology, only covered triangles
    const topo = part.topo
    const nr = topo.toFine.length
    const rpos = new Float32Array(nr * 3)
    const rcov = new Float32Array(nr)
    const rfold = new Float32Array(nr)
    for (let r = 0; r < nr; r++) {
      const f = topo.toFine[r]
      rpos[r * 3] = pos[f * 3]
      rpos[r * 3 + 1] = pos[f * 3 + 1]
      rpos[r * 3 + 2] = pos[f * 3 + 2]
      rcov[r] = cover[f]
      rfold[r] = fold[f]
    }
    const index: number[] = []
    const ti = topo.index
    for (let t = 0; t < ti.length; t += 3) {
      const a = ti[t]
      const b = ti[t + 1]
      const d = ti[t + 2]
      if (Math.max(rcov[a], rcov[b], rcov[d]) > 0.5) index.push(a, b, d)
    }
    const src = part.geometry
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(rpos, 3))
    g.setAttribute('uv', src.attributes.uv)
    g.setAttribute('aRef', src.attributes.aRef)
    g.setAttribute('skinIndex', src.attributes.skinIndex)
    g.setAttribute('skinWeight', src.attributes.skinWeight)
    g.setAttribute('aCover', new THREE.BufferAttribute(rcov, 1))
    g.setAttribute('aFold', new THREE.BufferAttribute(rfold, 1))
    g.setIndex(index)
    g.computeVertexNormals()
    const mat = createFabricMaterial()
    const mesh = new THREE.SkinnedMesh(g, mat.material)
    mesh.name = 'garment-' + slot
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    this.body.rig.add(mesh)
    mesh.bind(this.body.skeleton, this.body.meshes.get('body')?.bindMatrix)
    return { key: slot, mesh, mat }
  }

  /** Dresses / skirts / robes: MakeHuman's skirt helper in fabric. */
  private updateSkirt(st: Human3DState) {
    const skirt = this.body.meshes.get('skirt')
    const part = this.body.parts.get('skirt')
    if (!skirt || !part) return
    const cut = SKIRT_CUT[st.outfit.top] ?? SKIRT_CUT[st.outfit.bottom]
    if (cut === undefined) {
      skirt.visible = false
      return
    }
    if (!this.skirtMat) {
      this.skirtMat = createFabricMaterial()
      const g = part.geometry
      const n = g.attributes.position.count
      // reference positions + full coverage for the fabric shader
      const fine = applyStencil(
        part.sub.stencil,
        this.body.asset.base,
        new Float32Array(part.sub.fineCount * 3)
      )
      const ref = new Float32Array(n * 3)
      for (let i = 0; i < n; i++)
        ref.set(fine.subarray(part.topo.toFine[i] * 3, part.topo.toFine[i] * 3 + 3), i * 3)
      g.setAttribute('aRef', new THREE.BufferAttribute(ref, 3))
      g.setAttribute('aCover', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1))
      g.setAttribute('aFold', new THREE.BufferAttribute(new Float32Array(n).fill(0.4), 1))
    }
    skirt.material = this.skirtMat.material
    skirt.visible = true
    const isTop = SKIRT_CUT[st.outfit.top] !== undefined
    const o = st.outfit
    this.skirtMat.setLook({
      color: isTop ? o.topColor : o.bottomColor,
      color2: isTop ? o.topColor2 : shade(o.bottomColor, 0.25),
      pattern: isTop ? o.topPattern : 'solid',
      fabric: isTop ? TOP_FABRIC[o.top] || 'silk' : BOTTOM_FABRIC[o.bottom] || 'silk',
      cutY: cut
    })
  }

  // ── Accessories ─────────────────────────────────────────────────────────
  private updateAccessories(st: Human3DState) {
    const key = JSON.stringify([
      st.outfit.accessories,
      st.outfit.metal,
      this.body.version,
      st.hair.style
    ])
    this.metal.color.set(st.outfit.metal)
    if (key === this.accKey) return
    this.accKey = key
    for (const ch of [...this.accessories.children]) {
      ch.removeFromParent()
      ;(ch as THREE.Mesh).geometry?.dispose()
    }
    const head = this.body.boneByName.get('head')
    if (!head) return
    if (this.accessories.parent !== head) head.add(this.accessories)
    const H = this.body.boneHead('head', new THREE.Vector3())
    const local = (v: THREE.Vector3) => v.clone().sub(H)
    const set = new Set(st.outfit.accessories)
    const eyes = this.body.eyes
    if (set.has('glasses') || set.has('sunglasses'))
      this.accessories.add(this.glasses(local, eyes, set.has('sunglasses')))
    if (set.has('earrings')) {
      for (const sx of [1, -1]) {
        const lobe = this.cagePoint([0.8 * sx, 6.98, 0.38]).add(
          new THREE.Vector3(0.035 * sx, -0.06, 0.02)
        )
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.009, 10, 40), this.metal)
        ring.position.copy(local(lobe))
        ring.rotation.y = Math.PI / 2
        this.accessories.add(ring)
      }
    }
    for (const hat of ['beanie', 'cap', 'crown', 'headband'] as const) {
      if (set.has(hat)) this.accessories.add(this.headwear(hat, local, st))
    }
    // neck / wrist pieces ride other bones
    for (const node of this.extraNodes) {
      node.removeFromParent()
      node.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
    }
    this.extraNodes = []
    if (set.has('necklace')) {
      const neck = this.body.boneByName.get('neck01')
      if (neck) {
        const chain = new THREE.Mesh(this.necklaceGeometry(), this.metal)
        chain.position.set(0, -0.12, 0.08)
        chain.name = 'acc-necklace'
        neck.add(chain)
        this.extraNodes.push(chain)
      }
    }
    if (set.has('watch')) {
      const wrist = this.body.boneByName.get('wrist.L')
      if (wrist) {
        const w = new THREE.Group()
        const band = new THREE.Mesh(
          new THREE.TorusGeometry(0.27, 0.05, 10, 40),
          new THREE.MeshPhysicalMaterial({ color: 0x1b1b1e, roughness: 0.6 })
        )
        const face = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 32), this.metal)
        const dir = this.body
          .boneTail('wrist.L', new THREE.Vector3())
          .sub(this.body.boneHead('wrist.L', new THREE.Vector3()))
          .normalize()
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)
        band.quaternion.copy(q)
        face.position.set(0, 0.29, 0)
        face.quaternion
          .copy(q)
          .multiply(
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
          )
        w.add(band, face)
        w.position.copy(dir.clone().multiplyScalar(-0.3))
        w.name = 'acc-watch'
        wrist.add(w)
        this.extraNodes.push(w)
      }
    }
  }

  private extraNodes: THREE.Object3D[] = []

  /** Cage point near a reference position (follows morphs). */
  private cagePoint(ref: [number, number, number]) {
    const v = this.body.nearestVertex(ref)
    const c = this.body.cage
    const b = this.body.asset.base
    return new THREE.Vector3(
      c[v * 3] + ref[0] - b[v * 3],
      c[v * 3 + 1] + ref[1] - b[v * 3 + 1],
      c[v * 3 + 2] + ref[2] - b[v * 3 + 2]
    )
  }

  private glasses(
    local: (v: THREE.Vector3) => THREE.Vector3,
    eyes: HumanBody['eyes'],
    sun: boolean
  ) {
    const g = new THREE.Group()
    g.name = 'acc-glasses'
    const frame = sun
      ? new THREE.MeshPhysicalMaterial({ color: 0x111114, roughness: 0.3, clearcoat: 1 })
      : this.metal
    const lensMat = sun
      ? new THREE.MeshPhysicalMaterial({
          color: 0x0b0d10,
          roughness: 0.05,
          metalness: 0.3,
          clearcoat: 1,
          transparent: true,
          opacity: 0.88
        })
      : this.lens
    const rimW = 0.27
    const rimH = 0.2
    for (const side of ['l', 'r'] as const) {
      const e = eyes[side].center
      const c = local(new THREE.Vector3(e.x * 1.05, e.y - 0.01, e.z + eyes[side].radius * 1.55))
      // superellipse rim as a tube
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2
        const cx = Math.cos(a)
        const sy = Math.sin(a)
        const px = Math.sign(cx) * Math.pow(Math.abs(cx), 0.6) * rimW
        const py =
          Math.sign(sy) * Math.pow(Math.abs(sy), 0.7) * rimH - (sy < 0 ? Math.abs(cx) * 0.03 : 0)
        pts.push(new THREE.Vector3(c.x + px, c.y + py, c.z - Math.abs(px) * 0.25))
      }
      const curve = new THREE.CatmullRomCurve3(pts, true)
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 96, sun ? 0.022 : 0.014, 8, true), frame))
      const lensShape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x - c.x, p.y - c.y)))
      const lens = new THREE.Mesh(new THREE.ShapeGeometry(lensShape, 24), lensMat)
      lens.position.copy(c).add(new THREE.Vector3(0, 0, -0.02))
      g.add(lens)
      // temple arm back to the ear
      const sx = side === 'l' ? 1 : -1
      const hinge = new THREE.Vector3(c.x + rimW * sx, c.y + rimH * 0.4, c.z - rimW * 0.25)
      const ear = local(this.cagePoint([0.74 * sx, 7.28, 0.42]))
      const temple = new THREE.CatmullRomCurve3([
        hinge,
        new THREE.Vector3(hinge.x + 0.05 * sx, hinge.y, (hinge.z + ear.z) / 2),
        ear,
        ear.clone().add(new THREE.Vector3(0, -0.12, -0.1))
      ])
      g.add(new THREE.Mesh(new THREE.TubeGeometry(temple, 32, 0.012, 6, false), frame))
    }
    const l = local(eyes.l.center)
    const r = local(eyes.r.center)
    const z = Math.max(l.z, r.z) + eyes.l.radius * 1.55
    const bridge = new THREE.CatmullRomCurve3([
      new THREE.Vector3(l.x * 1.05 - rimW, l.y + 0.06, z - 0.05),
      new THREE.Vector3(0, l.y + 0.11, z + 0.02),
      new THREE.Vector3(r.x * 1.05 + rimW, r.y + 0.06, z - 0.05)
    ])
    g.add(new THREE.Mesh(new THREE.TubeGeometry(bridge, 20, 0.014, 6, false), frame))
    return g
  }

  private headwear(
    kind: 'beanie' | 'cap' | 'crown' | 'headband',
    local: (v: THREE.Vector3) => THREE.Vector3,
    st: Human3DState
  ) {
    const part = this.body.parts.get('body') as SurfacePart
    const g = new THREE.Group()
    g.name = 'acc-' + kind
    // head ellipsoid from the scalp
    const scalp = part.fineMasks.scalp
    const P = part.finePos
    let minY = Infinity
    let maxY = -Infinity
    let maxX = 0
    let minZ = Infinity
    let maxZ = -Infinity
    for (let i = 0; i < scalp.length; i++) {
      if (scalp[i] < 0.5) continue
      minY = Math.min(minY, P[i * 3 + 1])
      maxY = Math.max(maxY, P[i * 3 + 1])
      maxX = Math.max(maxX, Math.abs(P[i * 3]))
      minZ = Math.min(minZ, P[i * 3 + 2])
      maxZ = Math.max(maxZ, P[i * 3 + 2])
    }
    const hairPad =
      st.hair.style === 'bald' || st.hair.style === 'buzz'
        ? 0.02
        : st.hair.style === 'afro'
          ? 0.5
          : 0.12 + st.hair.volume * 0.15
    const eyeY = this.body.eyes.l.center.y
    const cy = (maxY + eyeY) / 2
    const c = local(new THREE.Vector3(0, cy, (minZ + maxZ) / 2 + 0.05))
    const rx = maxX + hairPad
    const ry = maxY - cy + hairPad
    const rz = (maxZ - minZ) / 2 + hairPad
    const fabric = createFabricMaterial()
    const o = st.outfit
    if (kind === 'beanie' || kind === 'cap') {
      fabric.setLook({
        color: o.topColor2,
        color2: o.topColor,
        pattern: 'solid',
        fabric: kind === 'beanie' ? 'knit' : 'canvas'
      })
      const geo = new THREE.SphereGeometry(
        1,
        64,
        40,
        0,
        Math.PI * 2,
        0,
        Math.PI * (kind === 'beanie' ? 0.56 : 0.5)
      )
      const n = geo.attributes.position.count
      geo.setAttribute(
        'aRef',
        new THREE.BufferAttribute(
          Float32Array.from(geo.attributes.position.array as Float32Array).map((v) => v * 1.0),
          3
        )
      )
      geo.setAttribute('aCover', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1))
      geo.setAttribute('aFold', new THREE.BufferAttribute(new Float32Array(n).fill(0.2), 1))
      const dome = new THREE.Mesh(geo, fabric.material)
      dome.scale.set(rx * 1.04, ry * 1.08, rz * 1.04)
      dome.position.copy(c).add(new THREE.Vector3(0, kind === 'beanie' ? -0.12 : -0.05, 0))
      dome.rotation.x = -0.18
      dome.castShadow = true
      g.add(dome)
      if (kind === 'cap') {
        const brim = new THREE.Mesh(
          new THREE.CylinderGeometry(
            rx * 0.95,
            rx * 0.95,
            0.04,
            48,
            1,
            false,
            -Math.PI * 0.4,
            Math.PI * 0.8
          ),
          fabric.material
        )
        const bgeo = brim.geometry
        const bn = bgeo.attributes.position.count
        bgeo.setAttribute('aRef', bgeo.attributes.position.clone())
        bgeo.setAttribute('aCover', new THREE.BufferAttribute(new Float32Array(bn).fill(1), 1))
        bgeo.setAttribute('aFold', new THREE.BufferAttribute(new Float32Array(bn).fill(0), 1))
        brim.scale.set(1, 1, 1.25)
        brim.position.copy(c).add(new THREE.Vector3(0, -0.12, rz * 0.75))
        brim.rotation.x = 0.12
        brim.castShadow = true
        g.add(brim)
      }
    } else if (kind === 'crown') {
      const shape = new THREE.Shape()
      const W = Math.PI * 2 * Math.max(rx, rz)
      const H = 0.55
      shape.moveTo(0, 0)
      const spikes = 10
      for (let i = 0; i < spikes; i++) {
        const x0 = (i / spikes) * W
        shape.lineTo(x0 + W / spikes / 2, H * (i % 2 ? 0.75 : 1))
        shape.lineTo(x0 + W / spikes, H * 0.45)
      }
      shape.lineTo(W, 0)
      shape.lineTo(0, 0)
      const flat = new THREE.ExtrudeGeometry(shape, {
        depth: 0.04,
        bevelEnabled: true,
        bevelSize: 0.01,
        bevelThickness: 0.01,
        bevelSegments: 2,
        curveSegments: 4
      })
      // wrap around the head
      const p = flat.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < p.count; i++) {
        const a = (p.getX(i) / W) * Math.PI * 2
        const r = 1 + p.getZ(i) * 0.6
        p.setXYZ(i, Math.sin(a) * rx * 0.98 * r, p.getY(i), Math.cos(a) * rz * 0.98 * r)
      }
      flat.computeVertexNormals()
      const crown = new THREE.Mesh(flat, this.metal)
      crown.position.copy(c).add(new THREE.Vector3(0, ry * 0.45, -0.04))
      crown.rotation.x = -0.12
      crown.castShadow = true
      g.add(crown)
      // gems
      for (let i = 0; i < spikes; i += 2) {
        const a = ((i + 0.5) / spikes) * Math.PI * 2
        const gem = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.05),
          new THREE.MeshPhysicalMaterial({
            color: i % 4 ? 0x2a6bd8 : 0xd8283a,
            roughness: 0.05,
            transmission: 0.2,
            clearcoat: 1
          })
        )
        gem.position.set(Math.sin(a) * rx * 1.02, 0.18, Math.cos(a) * rz * 1.02).add(crown.position)
        g.add(gem)
      }
    } else {
      fabric.setLook({ color: o.topColor2, color2: o.topColor, pattern: 'solid', fabric: 'knit' })
      const band = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 12, 64), fabric.material)
      const bg = band.geometry
      bg.setAttribute('aRef', bg.attributes.position.clone())
      bg.setAttribute(
        'aCover',
        new THREE.BufferAttribute(new Float32Array(bg.attributes.position.count).fill(1), 1)
      )
      bg.setAttribute(
        'aFold',
        new THREE.BufferAttribute(new Float32Array(bg.attributes.position.count).fill(0), 1)
      )
      band.scale.set(rx * 0.98, rz * 0.98, 1)
      band.rotation.x = Math.PI / 2 - 0.35
      band.position.copy(c).add(new THREE.Vector3(0, ry * 0.42, 0))
      g.add(band)
    }
    return g
  }

  private necklaceGeometry() {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * Math.PI * 2
      const drop = Math.max(0, Math.cos(a)) ** 3 * 0.35
      pts.push(
        new THREE.Vector3(
          Math.sin(a) * 0.62,
          -drop - 0.1 * Math.max(0, Math.cos(a)),
          Math.cos(a) * 0.55
        )
      )
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 0.012, 6, true)
  }

  dispose() {
    for (const slot of [...this.layers.keys()]) this.setLayer(slot, null)
    this.skirtMat?.material.dispose()
    this.accessories.removeFromParent()
    for (const n of this.extraNodes) n.removeFromParent()
    this.metal.dispose()
    this.lens.dispose()
  }
}

function shade(hex: string, k: number) {
  const c = new THREE.Color(hex)
  return '#' + c.lerp(new THREE.Color(k > 0 ? '#ffffff' : '#000000'), Math.abs(k)).getHexString()
}

void TOPS
