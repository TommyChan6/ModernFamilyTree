// The live 3D human: MakeHuman's base cage morphed on the CPU, Catmull–Clark
// subdivided through a precomputed stencil, skinned to the MakeHuman default
// skeleton (re-fitted to every shape from the joint centroids), with teeth,
// tongue and procedural eyeballs riding the same rig. Materials, hair and
// clothing are attached by HumanStage — this class owns geometry + rig only.
//
// Units: the asset is in decimetres; `root` is scaled by 0.1 so the scene is
// in metres, with the soles resting on y = 0.

import * as THREE from 'three'
import type { HumanAsset } from './humanAsset'
import { applyTargets, targetDelta } from './humanMorph'
import {
  applyStencil,
  catmullClark,
  quadNormals,
  renderTopology,
  type RenderTopology,
  type Subdivided
} from './subdivision'

export const DM = 0.1 // decimetres → metres

const tmpHead = new THREE.Vector3()

/** One subdivided, skinned surface (body, teeth, tongue, skirt). */
export interface SurfacePart {
  key: string
  sub: Subdivided
  topo: RenderTopology
  /** Fine positions / normals (welded, before the UV split). */
  finePos: Float32Array
  fineNrm: Float32Array
  geometry: THREE.BufferGeometry
  /** Per render vertex region masks: name → 0..1 (only for the body). */
  masks: Record<string, Float32Array>
  /** The same masks per fine (welded) vertex. */
  fineMasks: Record<string, Float32Array>
  /** Top-4 skin weights per fine vertex. */
  fineSkinIndex: Uint16Array
  fineSkinWeight: Float32Array
}

/** GPU morph targets kept live on the body (cheap per-frame animation). */
export const GPU_MORPHS = ['expr/eye-left-closure', 'expr/eye-right-closure'] as const

export class HumanBody {
  readonly asset: HumanAsset
  readonly root = new THREE.Group()
  readonly rig = new THREE.Group()
  readonly bones: THREE.Bone[] = []
  readonly boneByName = new Map<string, THREE.Bone>()
  readonly skeleton: THREE.Skeleton
  readonly parts = new Map<string, SurfacePart>()
  readonly meshes = new Map<string, THREE.SkinnedMesh>()
  /** Morphed cage positions (decimetres, incl. virtual joint vertices). */
  readonly cage: Float32Array
  /** Eye centres + radii in rig space (decimetres), refreshed per shape. */
  readonly eyes = {
    l: { center: new THREE.Vector3(), radius: 0.12 },
    r: { center: new THREE.Vector3(), radius: 0.12 }
  }
  /** Lowest sole point (decimetres) of the current shape. */
  ground = 0
  private readonly gpuMorphDeltas: Float32Array[]

  constructor(asset: HumanAsset, materials: Record<string, THREE.Material>) {
    this.asset = asset
    this.cage = new Float32Array(asset.vertexCount * 3)
    this.root.add(this.rig)
    this.rig.scale.setScalar(DM)

    // Bones (parent-first in the asset)
    for (const b of asset.bones) {
      const bone = new THREE.Bone()
      bone.name = b.name
      this.bones.push(bone)
      this.boneByName.set(b.name, bone)
      if (b.parent >= 0) this.bones[b.parent].add(bone)
    }
    this.skeleton = new THREE.Skeleton(this.bones)

    this.gpuMorphDeltas = GPU_MORPHS.map((name) => {
      const t = asset.targets.get(name)
      return t ? targetDelta(t, asset.vertexCount) : new Float32Array(asset.vertexCount * 3)
    })

    for (const key of Object.keys(asset.groups)) {
      if (key.includes('eyelashes') || key.endsWith('-eye')) continue
      const part = this.buildPart(key)
      this.parts.set(key, part)
      const mat = materials[key] || materials.default
      const mesh = new THREE.SkinnedMesh(part.geometry, mat)
      mesh.name = key
      mesh.frustumCulled = false
      mesh.castShadow = true
      mesh.receiveShadow = true
      // The skirt helper is a garment base, shown only by clothing that uses it
      mesh.visible = key !== 'skirt'
      this.meshes.set(key, mesh)
      this.rig.add(mesh)
    }
    // Roots of the bone tree hang off the body mesh so skinning stays local
    const body = this.meshes.get('body') as THREE.SkinnedMesh
    for (const bone of this.bones) if (!(bone.parent instanceof THREE.Bone)) body.add(bone)
  }

  private buildPart(key: string): SurfacePart {
    const g = this.asset.groups[key]
    const sub = catmullClark(g.quads, g.quadUV, this.asset.uv)
    const topo = renderTopology(sub)
    const n = topo.toFine.length
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(topo.uv, 2))
    geometry.setIndex(new THREE.BufferAttribute(topo.index, 1))

    // Skin weights: subdivide the sparse weight vectors, keep the top 4
    const { skinIndex, skinWeight } = this.asset
    const fineIdx = new Uint16Array(sub.fineCount * 4)
    const fineW = new Float32Array(sub.fineCount * 4)
    const acc = new Map<number, number>()
    const st = sub.stencil
    for (let r = 0; r < sub.fineCount; r++) {
      acc.clear()
      for (let k = st.start[r]; k < st.start[r + 1]; k++) {
        const s = st.src[k]
        for (let j = 0; j < 4; j++) {
          const w = skinWeight[s * 4 + j]
          if (!w) continue
          const b = skinIndex[s * 4 + j]
          acc.set(b, (acc.get(b) || 0) + (w / 255) * st.w[k])
        }
      }
      const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4)
      const tot = top.reduce((s, [, w]) => s + w, 0) || 1
      top.forEach(([b, w], j) => {
        fineIdx[r * 4 + j] = b
        fineW[r * 4 + j] = w / tot
      })
    }
    const si = new Uint16Array(n * 4)
    const sw = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) {
      const f = topo.toFine[i]
      si.set(fineIdx.subarray(f * 4, f * 4 + 4), i * 4)
      sw.set(fineW.subarray(f * 4, f * 4 + 4), i * 4)
    }
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4))
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4))

    // Region masks, subdivided like any other per-vertex quantity
    const masks: Record<string, Float32Array> = {}
    const fineMasks: Record<string, Float32Array> = {}
    if (key === 'body') {
      for (const [name, m] of Object.entries(this.asset.masks)) {
        const coarse = new Float32Array(this.asset.vertexCount)
        for (let i = 0; i < m.length; i++) coarse[i] = m[i] / 255
        const fine = new Float32Array(sub.fineCount)
        applyStencil(sub.stencil, coarse, fine, 1)
        fineMasks[name] = fine
        const out = new Float32Array(n)
        for (let i = 0; i < n; i++) out[i] = fine[topo.toFine[i]]
        masks[name] = out
      }
      // Shader attributes: reference-space position + packed masks
      const refFine = applyStencil(
        sub.stencil,
        this.asset.base,
        new Float32Array(sub.fineCount * 3)
      )
      const ref = new Float32Array(n * 3)
      for (let i = 0; i < n; i++)
        ref.set(refFine.subarray(topo.toFine[i] * 3, topo.toFine[i] * 3 + 3), i * 3)
      geometry.setAttribute('aRef', new THREE.BufferAttribute(ref, 3))
      const pack = (names: (string | null)[]) => {
        const a = new Float32Array(n * 4)
        names.forEach((m, c) => {
          const src = m ? masks[m] : null
          if (src) for (let i = 0; i < n; i++) a[i * 4 + c] = src[i]
        })
        return new THREE.BufferAttribute(a, 4)
      }
      geometry.setAttribute('aMaskA', pack(['flush', 'eyeUpper', 'eyeLower', 'thin']))
      geometry.setAttribute('aMaskB', pack([null, null, 'lips', 'brow']))
      geometry.setAttribute('aMaskC', pack(['forehead', 'crow', 'naso', 'scalp']))
      if (this.gpuMorphDeltas.length) {
        geometry.morphAttributes.position = this.gpuMorphDeltas.map(
          () => new THREE.BufferAttribute(new Float32Array(n * 3), 3)
        )
        geometry.morphAttributes.normal = this.gpuMorphDeltas.map(
          () => new THREE.BufferAttribute(new Float32Array(n * 3), 3)
        )
        // our morph attributes are deltas, not absolute positions
        geometry.morphTargetsRelative = true
      }
    }
    return {
      key,
      sub,
      topo,
      finePos: new Float32Array(sub.fineCount * 3),
      fineNrm: new Float32Array(sub.fineCount * 3),
      geometry,
      masks,
      fineMasks,
      fineSkinIndex: fineIdx,
      fineSkinWeight: fineW
    }
  }

  /**
   * Re-shape: target weights → cage → every surface, the skeleton, the eyes.
   * `pose` callbacks re-apply after the rig is re-fitted at rest.
   */
  setShape(weights: Map<string, number>, opts: { fast?: boolean } = {}) {
    applyTargets(this.asset.base, this.asset.targets, weights, this.cage)
    this.fast = !!opts.fast
    for (const part of this.parts.values()) {
      if (this.fast && part.key === 'skirt' && !this.meshes.get('skirt')?.visible) continue
      this.updatePart(part)
    }
    this.updateEyes()
    if (!this.fast) this.refitSkeleton()
    this.version++
  }

  /** Bumps on every reshape (hair/clothing compare it to know when to follow). */
  version = 0
  private fast = false

  /** Standing height in metres (soles → crown). */
  heightMeters() {
    const body = this.parts.get('body')
    if (!body) return 1.7
    let maxY = -Infinity
    for (let i = 1; i < body.finePos.length; i += 3) maxY = Math.max(maxY, body.finePos[i])
    return (maxY - this.ground) * DM
  }

  private anchorCache = new Map<string, number>()

  /** Nearest base-mesh vertex to a reference point (cached). */
  nearestVertex(ref: [number, number, number]) {
    const key = ref.join(',')
    let best = this.anchorCache.get(key)
    if (best === undefined) {
      let bd = Infinity
      const b = this.asset.base
      for (let i = 0; i < this.asset.meshVertexCount; i++) {
        const d =
          (b[i * 3] - ref[0]) ** 2 + (b[i * 3 + 1] - ref[1]) ** 2 + (b[i * 3 + 2] - ref[2]) ** 2
        if (d < bd) {
          bd = d
          best = i
        }
      }
      // keep the anchor's offset from that vertex (anchors can float in front of the skin)
      this.anchorCache.set(key, best as number)
    }
    return best as number
  }

  /** World position of a reference point carried by a bone through shape + pose. */
  anchorWorld(anchor: { bone: string; ref: [number, number, number] }, out: THREE.Vector3) {
    const v = this.nearestVertex(anchor.ref)
    const b = this.asset.base
    // morphed vertex + the anchor's original offset from it
    out.set(
      this.cage[v * 3] + (anchor.ref[0] - b[v * 3]),
      this.cage[v * 3 + 1] + (anchor.ref[1] - b[v * 3 + 1]),
      this.cage[v * 3 + 2] + (anchor.ref[2] - b[v * 3 + 2])
    )
    const bone = this.boneByName.get(anchor.bone)
    if (!bone) return this.rig.localToWorld(out)
    out.sub(this.boneHead(anchor.bone, new THREE.Vector3()))
    bone.updateWorldMatrix(true, false)
    return out.applyMatrix4(bone.matrixWorld)
  }

  /** World position of a cage vertex carried by `bone` through shape + pose. */
  vertexWorld(v: number, bone: string, out: THREE.Vector3) {
    out.set(this.cage[v * 3], this.cage[v * 3 + 1], this.cage[v * 3 + 2])
    const b = this.boneByName.get(bone)
    if (!b) return this.rig.localToWorld(out)
    out.sub(this.boneHead(bone, tmpHead))
    b.updateWorldMatrix(true, false)
    return out.applyMatrix4(b.matrixWorld)
  }

  private updatePart(part: SurfacePart) {
    applyStencil(part.sub.stencil, this.cage, part.finePos)
    quadNormals(part.sub.quads, part.finePos, part.fineNrm)
    const pos = part.geometry.attributes.position.array as Float32Array
    const nrm = part.geometry.attributes.normal.array as Float32Array
    const map = part.topo.toFine
    for (let i = 0; i < map.length; i++) {
      const f = map[i] * 3
      pos[i * 3] = part.finePos[f]
      pos[i * 3 + 1] = part.finePos[f + 1]
      pos[i * 3 + 2] = part.finePos[f + 2]
      nrm[i * 3] = part.fineNrm[f]
      nrm[i * 3 + 1] = part.fineNrm[f + 1]
      nrm[i * 3 + 2] = part.fineNrm[f + 2]
    }
    part.geometry.attributes.position.needsUpdate = true
    part.geometry.attributes.normal.needsUpdate = true
    part.geometry.computeBoundingSphere()
    if (part.key === 'body') {
      let minY = Infinity
      for (let i = 1; i < part.finePos.length; i += 3) minY = Math.min(minY, part.finePos[i])
      if (!this.fast) {
        this.ground = minY
        this.updateGpuMorphs(part)
      }
    }
  }

  /** Fine-level deltas (positions + normals) for the GPU blink morphs. */
  private updateGpuMorphs(part: SurfacePart) {
    const morphPos = part.geometry.morphAttributes.position
    const morphNrm = part.geometry.morphAttributes.normal
    if (!morphPos) return
    const shifted = new Float32Array(this.cage.length)
    const finePos = new Float32Array(part.finePos.length)
    const fineNrm = new Float32Array(part.fineNrm.length)
    const fineDelta = new Float32Array(part.finePos.length)
    this.gpuMorphDeltas.forEach((delta, k) => {
      applyStencil(part.sub.stencil, delta, fineDelta)
      for (let i = 0; i < shifted.length; i++) shifted[i] = this.cage[i] + delta[i]
      applyStencil(part.sub.stencil, shifted, finePos)
      quadNormals(part.sub.quads, finePos, fineNrm)
      const p = morphPos[k].array as Float32Array
      const nn = morphNrm[k].array as Float32Array
      const map = part.topo.toFine
      for (let i = 0; i < map.length; i++) {
        const f = map[i] * 3
        for (let c = 0; c < 3; c++) {
          p[i * 3 + c] = fineDelta[f + c]
          nn[i * 3 + c] = fineNrm[f + c] - part.fineNrm[f + c]
        }
      }
      morphPos[k].needsUpdate = true
      morphNrm[k].needsUpdate = true
    })
  }

  private updateEyes() {
    for (const side of ['l', 'r'] as const) {
      const g = this.asset.groups[`${side}-eye`]
      if (!g) continue
      const ids = new Set(g.quads)
      const c = this.eyes[side].center.set(0, 0, 0)
      for (const i of ids) c.x += this.cage[i * 3]
      for (const i of ids) c.y += this.cage[i * 3 + 1]
      for (const i of ids) c.z += this.cage[i * 3 + 2]
      c.multiplyScalar(1 / ids.size)
      let r = 0
      for (const i of ids) {
        r += Math.hypot(
          this.cage[i * 3] - c.x,
          this.cage[i * 3 + 1] - c.y,
          this.cage[i * 3 + 2] - c.z
        )
      }
      this.eyes[side].radius = r / ids.size
    }
  }

  /** Joint (virtual vertex) position in rig space, decimetres. */
  jointPos(vertex: number, out = new THREE.Vector3()) {
    return out.set(this.cage[vertex * 3], this.cage[vertex * 3 + 1], this.cage[vertex * 3 + 2])
  }

  boneHead(name: string, out = new THREE.Vector3()) {
    const i = this.asset.bones.findIndex((b) => b.name === name)
    return i < 0 ? out.set(0, 0, 0) : this.jointPos(this.asset.bones[i].head, out)
  }

  boneTail(name: string, out = new THREE.Vector3()) {
    const i = this.asset.bones.findIndex((b) => b.name === name)
    return i < 0 ? out.set(0, 0, 0) : this.jointPos(this.asset.bones[i].tail, out)
  }

  /** Move bones to the new joints at rest, recompute bind inverses, keep the pose. */
  private refitSkeleton() {
    const saved = this.bones.map((b) => b.quaternion.clone())
    const head = new THREE.Vector3()
    const parentHead = new THREE.Vector3()
    this.asset.bones.forEach((b, i) => {
      const bone = this.bones[i]
      bone.quaternion.identity()
      this.jointPos(b.head, head)
      if (b.parent >= 0) {
        this.jointPos(this.asset.bones[b.parent].head, parentHead)
        bone.position.copy(head).sub(parentHead)
      } else {
        bone.position.copy(head)
      }
    })
    this.rig.position.y = -this.ground * DM
    this.root.updateMatrixWorld(true)
    for (const mesh of this.meshes.values()) mesh.bind(this.skeleton)
    this.bones.forEach((b, i) => b.quaternion.copy(saved[i]))
    this.root.updateMatrixWorld(true)
  }

  /**
   * Painted hair shadows: stubble = Σ zone weight · zone mask (beard zones),
   * scalp = buzz-cut shading over the scalp mask.
   */
  setShadowHair(zones: Partial<Record<string, number>>, scalp: number) {
    const part = this.parts.get('body')
    if (!part) return
    const attr = part.geometry.attributes.aMaskB as THREE.BufferAttribute
    const a = attr.array as Float32Array
    const n = a.length / 4
    const entries = Object.entries(zones).filter(([k, w]) => w && part.masks[k]) as [
      string,
      number
    ][]
    const scalpMask = part.masks.scalp
    for (let i = 0; i < n; i++) {
      let s = 0
      for (const [k, w] of entries) s = Math.max(s, part.masks[k][i] * w)
      a[i * 4] = s
      a[i * 4 + 1] = scalpMask ? scalpMask[i] * scalp : 0
    }
    attr.needsUpdate = true
  }

  /** Blink weights for the GPU morphs (0 open … 1 closed). */
  setBlink(left: number, right: number) {
    const body = this.meshes.get('body')
    if (!body?.morphTargetInfluences) return
    body.morphTargetInfluences[0] = left
    body.morphTargetInfluences[1] = right
  }

  dispose() {
    for (const p of this.parts.values()) p.geometry.dispose()
  }
}
