// Loads the compiled human asset (scripts/human3d/build.py → assets/human3d.bin):
// MakeHuman's CC0 base mesh + morph targets + skeleton + skin weights + region
// masks, gzip-packed. Fetched lazily the first time a 3D look opens, then
// cached for the session. Works in the web build (plain fetch) and the
// packaged Electron app (file:// — fetch refuses that scheme, so XHR).

export interface HumanBone {
  name: string
  parent: number
  /** Virtual vertex ids (joint centroids) of the bone's head and tail. */
  head: number
  tail: number
}

export interface HumanTarget {
  name: string
  /** Compact vertex ids touched by the target. */
  idx: Uint16Array
  /** Quantized deltas (x,y,z per entry); multiply by `scale` for decimetres. */
  d: Int16Array
  scale: number
}

export interface HumanGroup {
  /** 4 compact vertex ids per quad. */
  quads: Uint16Array
  /** 4 uv ids per quad (into HumanAsset.uv). */
  quadUV: Uint16Array
}

export interface HumanAsset {
  /** All vertices incl. one virtual vertex per joint (decimetres). */
  vertexCount: number
  /** Real mesh vertices (joints start at this index). */
  meshVertexCount: number
  base: Float32Array
  uv: Float32Array
  skinIndex: Uint8Array
  skinWeight: Uint8Array
  bones: HumanBone[]
  joints: string[]
  groups: Record<string, HumanGroup>
  targets: Map<string, HumanTarget>
  masks: Record<string, Uint8Array>
}

const ASSET_URL = new URL('./assets/human3d.bin', import.meta.url).href

let pending: Promise<HumanAsset> | null = null

/** The shared asset (loaded once). */
export function loadHumanAsset(): Promise<HumanAsset> {
  if (!pending) {
    pending = fetchBytes(ASSET_URL)
      .then(gunzip)
      .then(parseHumanAsset)
      .catch((err) => {
        pending = null // let a later attempt retry
        throw err
      })
  }
  return pending
}

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  if (!url.startsWith('file:')) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`human3d asset: HTTP ${res.status}`)
    return res.arrayBuffer()
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url)
    xhr.responseType = 'arraybuffer'
    xhr.onload = () => (xhr.response ? resolve(xhr.response) : reject(new Error('empty asset')))
    xhr.onerror = () => reject(new Error('human3d asset: load failed'))
    xhr.send()
  })
}

async function gunzip(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const head = new Uint8Array(buf, 0, 2)
  if (head[0] !== 0x1f || head[1] !== 0x8b) return buf // already inflated (dev servers may)
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).arrayBuffer()
}

type BufferInfo = { off: number; len: number; type: string }

/** Parse an inflated asset payload (exported for tests). */
export function parseHumanAsset(buf: ArrayBuffer): HumanAsset {
  const dv = new DataView(buf)
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3))
  if (magic !== 'HM3D') throw new Error('not a human3d asset')
  const jsonLen = dv.getUint32(8, true)
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 12, jsonLen)))
  const blobStart = 12 + jsonLen
  const view = (info: BufferInfo) => {
    const at = blobStart + info.off
    switch (info.type) {
      case 'float32':
        return new Float32Array(buf, at, info.len)
      case 'uint16':
        return new Uint16Array(buf, at, info.len)
      case 'uint8':
        return new Uint8Array(buf, at, info.len)
      default:
        throw new Error('unknown buffer type ' + info.type)
    }
  }
  const buffers: Record<string, BufferInfo> = header.buffers
  const groups: Record<string, HumanGroup> = {}
  for (const key of Object.keys(header.groups)) {
    groups[key] = {
      quads: view(buffers['quads:' + key]) as Uint16Array,
      quadUV: view(buffers['quadUV:' + key]) as Uint16Array
    }
  }
  const targets = new Map<string, HumanTarget>()
  for (const t of header.targets) {
    targets.set(t.name, {
      name: t.name,
      idx: new Uint16Array(buf, blobStart + t.idx, t.n),
      d: new Int16Array(buf, blobStart + t.d, t.n * 3),
      scale: t.scale
    })
  }
  const masks: Record<string, Uint8Array> = {}
  for (const m of header.masks) masks[m] = view(buffers['mask:' + m]) as Uint8Array
  return {
    vertexCount: header.vertexCount,
    meshVertexCount: header.meshVertexCount,
    base: view(buffers.pos) as Float32Array,
    uv: view(buffers.uv) as Float32Array,
    skinIndex: view(buffers.skinIndex) as Uint8Array,
    skinWeight: view(buffers.skinWeight) as Uint8Array,
    bones: header.bones,
    joints: header.joints,
    groups,
    targets,
    masks
  }
}
