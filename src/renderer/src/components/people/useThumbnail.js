import { ref, watch, computed } from 'vue'
import { api } from '../../api'

// Session-wide avatar thumbnail cache shared by every card.
//
// Two smoothness techniques live here:
//   1. Downscale — each photo is resized once per requested size (in the
//      renderer, off the main thread); we cache the tiny data URL so scrolling
//      never re-decodes the full image.
//   2. Idle gating — actual requests are queued and drained in requestIdleCallback
//      slots. During a fast fling the browser stays busy so the queue naturally
//      waits until the user pauses, keeping the scroll itself jank-free. Cached
//      hits still resolve synchronously.
//
// If the downscale ever fails (unusual format, or the main process is running an
// older build without the handler) we fall back to the full-resolution image, so
// an avatar always shows.

const SIZE = 144 // 2× the 72px avatar → crisp on HiDPI (the default)

const resolved = new Map() // "size|filePath" → final src (data URL or appimg URL)
const inflight = new Map() // "size|filePath" → Promise<string>
const pending = new Map() // "size|filePath" → [resolve, …]  (queued, not yet started)

const keyOf = (filePath, size) => size + '|' + filePath

// Fetch the file's bytes, decode them off the main thread (Chromium handles
// WebP/PNG/JPEG/GIF alike), and paint a square cover-crop into a small canvas.
// The Blob is same-origin, so the canvas isn't tainted and toDataURL works.
// WebP output keeps transparency (character cutouts) and stays tiny.
async function downscale(filePath, size) {
  const res = await api.invoke('images:bytes', { filePath })
  if (!res || !res.success || !res.data) return ''
  const blob = new Blob([res.data])
  const bmp = await createImageBitmap(blob)
  try {
    const s = Math.min(bmp.width, bmp.height)
    if (!s) return ''
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size)
    return canvas.toDataURL('image/webp', 0.8)
  } finally {
    bmp.close?.()
  }
}

function kickOff(filePath, size) {
  const key = keyOf(filePath, size)
  if (resolved.has(key)) return Promise.resolve(resolved.get(key))
  if (inflight.has(key)) return inflight.get(key)
  const p = downscale(filePath, size)
    .catch(() => '')
    .then((url) => {
      // On any failure fall back to the full-resolution image so it still shows.
      const finalUrl = url || api.getImageUrl(filePath) || ''
      resolved.set(key, finalUrl)
      inflight.delete(key)
      return finalUrl
    })
  inflight.set(key, p)
  return p
}

let draining = false
function scheduleDrain() {
  if (draining) return
  draining = true
  const run = (deadline) => {
    draining = false
    while (pending.size && (!deadline || deadline.timeRemaining() > 3)) {
      const key = pending.keys().next().value
      const waiters = pending.get(key)
      pending.delete(key)
      const sep = key.indexOf('|')
      kickOff(key.slice(sep + 1), Number(key.slice(0, sep))).then((url) =>
        waiters.forEach((r) => r(url))
      )
    }
    if (pending.size) scheduleDrain()
  }
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 250 })
  else setTimeout(() => run(null), 32)
}

function request(filePath, size) {
  const key = keyOf(filePath, size)
  if (resolved.has(key)) return Promise.resolve(resolved.get(key))
  if (inflight.has(key)) return inflight.get(key)
  return new Promise((resolve) => {
    const waiters = pending.get(key)
    if (waiters) waiters.push(resolve)
    else pending.set(key, [resolve])
    scheduleDrain()
  })
}

// Reactive avatar source for a (possibly changing) file path.
//   src     — '' until ready, then the image URL
//   loading — true while a photo exists but its thumbnail hasn't resolved yet
//             (drive a skeleton placeholder off this)
// `getSize` (optional): a number or getter for the square edge in px — larger
// card styles (full-art, TCG frames) ask for more pixels than the avatar dot.
export function useThumbnail(getFilePath, getSize = SIZE) {
  const src = ref('')
  const loading = ref(false)
  const sizeOf = typeof getSize === 'function' ? computed(getSize) : computed(() => getSize)
  let token = 0
  watch(
    [typeof getFilePath === 'function' ? computed(getFilePath) : getFilePath, sizeOf],
    ([filePath, size]) => {
      const mine = ++token
      if (!filePath) {
        src.value = ''
        loading.value = false
        return
      }
      const key = keyOf(filePath, size)
      if (resolved.has(key)) {
        src.value = resolved.get(key)
        loading.value = false
        return
      }
      src.value = ''
      loading.value = true
      request(filePath, size).then((url) => {
        if (mine !== token) return // path/size changed out from under us
        src.value = url
        loading.value = false
      })
    },
    { immediate: true }
  )
  return { src, loading }
}
