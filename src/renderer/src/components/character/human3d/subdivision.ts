// Catmull–Clark subdivision as a precomputed linear STENCIL. Subdividing is
// linear in the control points, so one level over a quad mesh is a fixed
// sparse matrix S: fine = S · coarse. We build S once from topology (pure,
// no THREE), then every morph update is a cheap sparse mat-vec — the human
// stays a smooth ~55k-quad surface while the morph math runs on the 13k-vertex
// cage. UVs are face-varying and interpolated linearly (the standard
// "smooth positions, linear UVs" rule), so UV seams never crack.
//
// Tests: tests/human3dMath.test.js

export interface Stencil {
  /** CSR row starts (length rows + 1). */
  start: Uint32Array
  /** Source vertex ids (into the coarse array). */
  src: Uint32Array
  w: Float32Array
}

export interface Subdivided {
  /** fine vertex = Σ w · coarse vertex (coarse ids index the FULL input array). */
  stencil: Stencil
  /** Fine quads over fine vertex ids (4 per quad). */
  quads: Uint32Array
  /** Per fine-quad corner uv (u,v) — 8 floats per quad. */
  cornerUV: Float32Array
  fineCount: number
}

type Row = Map<number, number>

function addTo(row: Row, src: number, w: number) {
  row.set(src, (row.get(src) || 0) + w)
}

function addRow(row: Row, other: Row, scale: number) {
  for (const [s, w] of other) addTo(row, s, w * scale)
}

/**
 * One Catmull–Clark level over `quads` (4 coarse vertex ids each) with
 * per-corner uv ids `quadUV` into `uv` (2 floats per id). Boundary edges
 * (eye holes, the mouth seam) use the standard crease rules so open rims stay
 * put instead of shrinking.
 */
export function catmullClark(
  quads: ArrayLike<number>,
  quadUV: ArrayLike<number>,
  uv: ArrayLike<number>
): Subdivided {
  const nq = quads.length / 4
  // Local ids for the coarse vertices this group uses
  const local = new Map<number, number>()
  const coarse: number[] = []
  for (let i = 0; i < quads.length; i++) {
    const v = quads[i]
    if (!local.has(v)) {
      local.set(v, coarse.length)
      coarse.push(v)
    }
  }
  const nv = coarse.length

  // Edges: key = lo * nv + hi → { id, faces[] }
  const edgeId = new Map<number, number>()
  const edgeVerts: number[] = []
  const edgeFaces: number[][] = []
  const quadEdges = new Uint32Array(nq * 4)
  for (let f = 0; f < nq; f++) {
    for (let c = 0; c < 4; c++) {
      const a = local.get(quads[f * 4 + c]) as number
      const b = local.get(quads[f * 4 + ((c + 1) & 3)]) as number
      const lo = Math.min(a, b)
      const hi = Math.max(a, b)
      const key = lo * nv + hi
      let id = edgeId.get(key)
      if (id === undefined) {
        id = edgeVerts.length / 2
        edgeId.set(key, id)
        edgeVerts.push(lo, hi)
        edgeFaces.push([])
      }
      edgeFaces[id].push(f)
      quadEdges[f * 4 + c] = id
    }
  }
  const ne = edgeVerts.length / 2

  // Face points: average of the 4 corners
  const facePts: Row[] = []
  for (let f = 0; f < nq; f++) {
    const r: Row = new Map()
    for (let c = 0; c < 4; c++) addTo(r, coarse[local.get(quads[f * 4 + c]) as number], 0.25)
    facePts.push(r)
  }

  // Edge points
  const edgePts: Row[] = []
  const isBoundaryEdge = new Uint8Array(ne)
  for (let e = 0; e < ne; e++) {
    const r: Row = new Map()
    const a = coarse[edgeVerts[e * 2]]
    const b = coarse[edgeVerts[e * 2 + 1]]
    const fs = edgeFaces[e]
    if (fs.length === 2) {
      addTo(r, a, 0.25)
      addTo(r, b, 0.25)
      addRow(r, facePts[fs[0]], 0.25)
      addRow(r, facePts[fs[1]], 0.25)
    } else {
      isBoundaryEdge[e] = 1
      addTo(r, a, 0.5)
      addTo(r, b, 0.5)
    }
    edgePts.push(r)
  }

  // Vertex adjacency (faces + edges per vertex)
  const vFaces: number[][] = Array.from({ length: nv }, () => [])
  const vEdges: number[][] = Array.from({ length: nv }, () => [])
  for (let f = 0; f < nq; f++) {
    for (let c = 0; c < 4; c++) vFaces[local.get(quads[f * 4 + c]) as number].push(f)
  }
  for (let e = 0; e < ne; e++) {
    vEdges[edgeVerts[e * 2]].push(e)
    vEdges[edgeVerts[e * 2 + 1]].push(e)
  }

  const vertPts: Row[] = []
  for (let v = 0; v < nv; v++) {
    const r: Row = new Map()
    const me = coarse[v]
    const boundary = vEdges[v].filter((e) => isBoundaryEdge[e])
    if (boundary.length >= 2) {
      // Crease rule: (6v + n1 + n2) / 8 along the two rim neighbours
      addTo(r, me, 0.75)
      for (const e of boundary.slice(0, 2)) {
        const other = edgeVerts[e * 2] === v ? edgeVerts[e * 2 + 1] : edgeVerts[e * 2]
        addTo(r, coarse[other], 0.125)
      }
    } else {
      const n = vEdges[v].length
      // (F + 2R + (n − 3)P) / n
      for (const f of vFaces[v]) addRow(r, facePts[f], 1 / vFaces[v].length / n)
      for (const e of vEdges[v]) {
        addTo(r, coarse[edgeVerts[e * 2]], 1 / n / n)
        addTo(r, coarse[edgeVerts[e * 2 + 1]], 1 / n / n)
      }
      addTo(r, me, (n - 3) / n)
    }
    vertPts.push(r)
  }

  // Fine vertex order: [vertex points][edge points][face points]
  const rows = vertPts.concat(edgePts, facePts)
  const start = new Uint32Array(rows.length + 1)
  let nnz = 0
  for (let i = 0; i < rows.length; i++) {
    start[i] = nnz
    nnz += rows[i].size
  }
  start[rows.length] = nnz
  const src = new Uint32Array(nnz)
  const w = new Float32Array(nnz)
  let k = 0
  for (const r of rows) {
    for (const [s, wt] of r) {
      src[k] = s
      w[k++] = wt
    }
  }

  // Fine quads + face-varying linear uvs
  const fq = new Uint32Array(nq * 16)
  const cuv = new Float32Array(nq * 32)
  const E0 = nv
  const F0 = nv + ne
  for (let f = 0; f < nq; f++) {
    const cu = [0, 0, 0, 0]
    const cv = [0, 0, 0, 0]
    let fu = 0
    let fv = 0
    for (let c = 0; c < 4; c++) {
      const t = quadUV[f * 4 + c]
      cu[c] = uv[t * 2]
      cv[c] = uv[t * 2 + 1]
      fu += cu[c] / 4
      fv += cv[c] / 4
    }
    for (let c = 0; c < 4; c++) {
      const prev = (c + 3) & 3
      const q = (f * 4 + c) * 4
      // corner c, edge(c→c+1), face, edge(c−1→c)
      fq[q] = local.get(quads[f * 4 + c]) as number
      fq[q + 1] = E0 + quadEdges[f * 4 + c]
      fq[q + 2] = F0 + f
      fq[q + 3] = E0 + quadEdges[f * 4 + prev]
      const n = (c + 1) & 3
      const o = q * 2
      cuv[o] = cu[c]
      cuv[o + 1] = cv[c]
      cuv[o + 2] = (cu[c] + cu[n]) / 2
      cuv[o + 3] = (cv[c] + cv[n]) / 2
      cuv[o + 4] = fu
      cuv[o + 5] = fv
      cuv[o + 6] = (cu[c] + cu[prev]) / 2
      cuv[o + 7] = (cv[c] + cv[prev]) / 2
    }
  }
  return { stencil: { start, src, w }, quads: fq, cornerUV: cuv, fineCount: rows.length }
}

/** out[row] = Σ w · input[src] for `dim`-component vectors. */
export function applyStencil(
  st: Stencil,
  input: ArrayLike<number>,
  out: Float32Array,
  dim = 3
): Float32Array {
  const rows = st.start.length - 1
  for (let r = 0; r < rows; r++) {
    let x = 0
    let y = 0
    let z = 0
    for (let k = st.start[r], end = st.start[r + 1]; k < end; k++) {
      const s = st.src[k] * dim
      const wt = st.w[k]
      x += input[s] * wt
      if (dim > 1) y += input[s + 1] * wt
      if (dim > 2) z += input[s + 2] * wt
    }
    const o = r * dim
    out[o] = x
    if (dim > 1) out[o + 1] = y
    if (dim > 2) out[o + 2] = z
  }
  return out
}

/** Compose two stencils: (b ∘ a) — a second level expressed on the coarse cage. */
export function composeStencil(a: Stencil, b: Stencil): Stencil {
  const rowsB = b.start.length - 1
  const rows: Row[] = []
  for (let r = 0; r < rowsB; r++) {
    const row: Row = new Map()
    for (let k = b.start[r]; k < b.start[r + 1]; k++) {
      const mid = b.src[k]
      const wb = b.w[k]
      for (let j = a.start[mid]; j < a.start[mid + 1]; j++) addTo(row, a.src[j], a.w[j] * wb)
    }
    rows.push(row)
  }
  const start = new Uint32Array(rows.length + 1)
  let nnz = 0
  rows.forEach((r, i) => {
    start[i] = nnz
    nnz += r.size
  })
  start[rows.length] = nnz
  const src = new Uint32Array(nnz)
  const w = new Float32Array(nnz)
  let k = 0
  for (const r of rows) {
    for (const [s, wt] of r) {
      src[k] = s
      w[k++] = wt
    }
  }
  return { start, src, w }
}

export interface RenderTopology {
  /** render vertex → fine vertex id. */
  toFine: Uint32Array
  uv: Float32Array
  /** Triangle indices over render vertices. */
  index: Uint32Array
}

/**
 * Split fine vertices along UV seams: one render vertex per distinct
 * (fine vertex, uv) pair; quads become two triangles.
 */
export function renderTopology(sub: Subdivided): RenderTopology {
  const key = new Map<string, number>()
  const toFine: number[] = []
  const uvs: number[] = []
  const nq = sub.quads.length / 4
  const index = new Uint32Array(nq * 6)
  const corner = [0, 0, 0, 0]
  for (let q = 0; q < nq; q++) {
    for (let c = 0; c < 4; c++) {
      const fv = sub.quads[q * 4 + c]
      const u = sub.cornerUV[(q * 4 + c) * 2]
      const v = sub.cornerUV[(q * 4 + c) * 2 + 1]
      const k = fv + ':' + Math.round(u * 1e5) + ':' + Math.round(v * 1e5)
      let id = key.get(k)
      if (id === undefined) {
        id = toFine.length
        key.set(k, id)
        toFine.push(fv)
        uvs.push(u, v)
      }
      corner[c] = id
    }
    index.set([corner[0], corner[1], corner[2], corner[0], corner[2], corner[3]], q * 6)
  }
  return { toFine: Uint32Array.from(toFine), uv: Float32Array.from(uvs), index }
}

/** Area-weighted vertex normals over quads (fine ids), written into `out`. */
export function quadNormals(
  quads: Uint32Array,
  pos: Float32Array,
  out: Float32Array
): Float32Array {
  out.fill(0)
  const nq = quads.length / 4
  for (let q = 0; q < nq; q++) {
    const a = quads[q * 4] * 3
    const b = quads[q * 4 + 1] * 3
    const c = quads[q * 4 + 2] * 3
    const d = quads[q * 4 + 3] * 3
    // Quad normal = cross of the diagonals (2× area-weighted)
    const ux = pos[c] - pos[a]
    const uy = pos[c + 1] - pos[a + 1]
    const uz = pos[c + 2] - pos[a + 2]
    const vx = pos[d] - pos[b]
    const vy = pos[d + 1] - pos[b + 1]
    const vz = pos[d + 2] - pos[b + 2]
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    for (const i of [a, b, c, d]) {
      out[i] += nx
      out[i + 1] += ny
      out[i + 2] += nz
    }
  }
  for (let i = 0; i < out.length; i += 3) {
    const l = Math.hypot(out[i], out[i + 1], out[i + 2]) || 1
    out[i] /= l
    out[i + 1] /= l
    out[i + 2] /= l
  }
  return out
}
