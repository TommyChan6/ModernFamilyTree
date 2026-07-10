import * as THREE from 'three'

// Packs person photos into a WebGL2 array texture (one square layer each) so every node
// avatar is sampled in the single node draw call. Loads are async and best-effort: any
// failure (missing file, tainted canvas) leaves the node on its gender-fill + silhouette
// fallback. A viewport-driven LRU caps live layers well under MAX_ARRAY_TEXTURE_LAYERS.
const TILE = 96
const CAP = 512
// Material "person" silhouette (24×24 viewBox), baked into atlas layer 0 as the fallback.
const PERSON_ICON_PATH =
  'M12 12.5c2.49 0 4.5-2.01 4.5-4.5S14.49 3.5 12 3.5 7.5 5.51 7.5 8s2.01 4.5 4.5 4.5zm0 2.25c-3 0-9 1.51-9 4.5V22h18v-2.75c0-2.99-6-4.5-9-4.5z'

export class AvatarAtlas {
  constructor(onChange) {
    this.onChange = onChange || (() => {})
    this.disposed = false
    this.data = new Uint8Array(TILE * TILE * 4 * CAP)
    this.texture = new THREE.DataArrayTexture(this.data, TILE, TILE, CAP)
    this.texture.format = THREE.RGBAFormat
    this.texture.type = THREE.UnsignedByteType
    this.texture.minFilter = THREE.LinearFilter
    this.texture.magFilter = THREE.LinearFilter

    this.layerOf = new Map() // personId -> layer (>=1)
    this.state = new Map() // personId -> 'loading' | 'loaded' | 'error'
    this.lru = [] // personIds, most-recent last
    this._dirty = false
    this._canvas = document.createElement('canvas')
    this._canvas.width = TILE
    this._canvas.height = TILE
    this._cctx = this._canvas.getContext('2d', { willReadFrequently: true })

    this._bakeSilhouette() // layer 0
    this.texture.needsUpdate = true
  }

  // Draw the person glyph white-on-transparent into layer 0, matching the SVG framed avatar
  // (head in the upper half, shoulders at the bottom) computed for a tile of radius TILE/2.
  _bakeSilhouette() {
    const c = this._cctx,
      r = TILE / 2
    c.clearRect(0, 0, TILE, TILE)
    c.save()
    c.translate(r, r)
    const iconScale = r * 0.12,
      iconHeadY = r * 0.22
    c.translate(-12 * iconScale, -iconHeadY - 8 * iconScale)
    c.scale(iconScale, iconScale)
    c.fillStyle = '#ffffff'
    c.fill(new Path2D(PERSON_ICON_PATH))
    c.restore()
    const px = c.getImageData(0, 0, TILE, TILE).data
    this.data.set(px, 0)
  }

  // Returns the atlas layer for a person, or -1 (draw fallback). Marks it recently used
  // and kicks off a load if we have a url and haven't tried yet.
  request(personId, url) {
    if (!url || this.disposed) return -1
    const st = this.state.get(personId)
    if (st === 'loaded') {
      this._touch(personId)
      return this.layerOf.get(personId)
    }
    if (st === 'error') return -1
    if (st !== 'loading') this._load(personId, url)
    return -1
  }

  _touch(personId) {
    const i = this.lru.indexOf(personId)
    if (i >= 0) this.lru.splice(i, 1)
    this.lru.push(personId)
  }

  _evict() {
    // Evict the least-recently-used loaded avatar to free a layer.
    const victim = this.lru.shift()
    if (victim == null) return -1
    const layer = this.layerOf.get(victim)
    this.layerOf.delete(victim)
    this.state.delete(victim)
    return layer
  }

  _acquireLayer() {
    // Layer 0 is the silhouette; photos occupy 1..CAP-1.
    if (this.layerOf.size < CAP - 1) return this.layerOf.size + 1
    return this._evict()
  }

  _load(personId, url) {
    this.state.set(personId, 'loading')
    const img = new Image()
    img.onload = () => {
      if (this.disposed) return
      try {
        const c = this._cctx
        c.clearRect(0, 0, TILE, TILE)
        // cover-fit (crop to square), matching SVG preserveAspectRatio "slice"
        const s = Math.max(TILE / img.width, TILE / img.height)
        const w = img.width * s,
          h = img.height * s
        c.drawImage(img, (TILE - w) / 2, (TILE - h) / 2, w, h)
        const px = c.getImageData(0, 0, TILE, TILE).data
        const layer = this._acquireLayer()
        if (layer < 0) {
          this.state.set(personId, 'error')
          return
        }
        this.data.set(px, layer * TILE * TILE * 4)
        this.layerOf.set(personId, layer)
        this.state.set(personId, 'loaded')
        this._touch(personId)
        this._dirty = true
        this.onChange()
      } catch {
        this.state.set(personId, 'error') // tainted canvas or other failure -> silhouette
      }
    }
    img.onerror = () => this.state.set(personId, 'error')
    img.src = url
  }

  // Called once per frame by the render loop; uploads at most once per frame.
  flush() {
    if (this._dirty) {
      this.texture.needsUpdate = true
      this._dirty = false
    }
  }

  dispose() {
    this.disposed = true
    this.texture?.dispose()
  }
}
