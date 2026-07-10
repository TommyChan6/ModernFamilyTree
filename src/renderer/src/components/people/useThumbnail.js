import { ref, watch } from 'vue'
import { api } from '../../api'

// Session-wide avatar thumbnail cache shared by every card.
//
// Two smoothness techniques live here:
//   1. Downscale — the main process resizes each photo once (native, cheap); we
//      cache the tiny data URL so scrolling never re-decodes the full image.
//   2. Idle gating — actual requests are queued and drained in requestIdleCallback
//      slots. During a fast fling the browser stays busy so the queue naturally
//      waits until the user pauses, keeping the scroll itself jank-free. Cached
//      hits still resolve synchronously.
//
// If the downscale ever fails (unusual format, or the main process is running an
// older build without the handler) we fall back to the full-resolution image, so
// an avatar always shows.

const SIZE = 144 // 2× the 72px avatar → crisp on HiDPI

const resolved = new Map() // filePath → final src (data URL or appimg URL)
const inflight = new Map() // filePath → Promise<string>
const pending = new Map() // filePath → [resolve, …]  (queued, not yet started)

// Fetch the file's bytes, decode them off the main thread (Chromium handles
// WebP/PNG/JPEG/GIF alike), and paint a square cover-crop into a small canvas.
// The Blob is same-origin, so the canvas isn't tainted and toDataURL works.
// WebP output keeps transparency (character cutouts) and stays tiny.
async function downscale(filePath) {
  const res = await api.invoke('images:bytes', { filePath })
  if (!res || !res.success || !res.data) return ''
  const blob = new Blob([res.data])
  const bmp = await createImageBitmap(blob)
  try {
    const s = Math.min(bmp.width, bmp.height)
    if (!s) return ''
    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, SIZE, SIZE)
    return canvas.toDataURL('image/webp', 0.8)
  } finally {
    bmp.close?.()
  }
}

function kickOff(filePath) {
  if (resolved.has(filePath)) return Promise.resolve(resolved.get(filePath))
  if (inflight.has(filePath)) return inflight.get(filePath)
  const p = downscale(filePath)
    .catch(() => '')
    .then((url) => {
      // On any failure fall back to the full-resolution image so it still shows.
      const finalUrl = url || api.getImageUrl(filePath) || ''
      resolved.set(filePath, finalUrl)
      inflight.delete(filePath)
      return finalUrl
    })
  inflight.set(filePath, p)
  return p
}

let draining = false
function scheduleDrain() {
  if (draining) return
  draining = true
  const run = (deadline) => {
    draining = false
    while (pending.size && (!deadline || deadline.timeRemaining() > 3)) {
      const filePath = pending.keys().next().value
      const waiters = pending.get(filePath)
      pending.delete(filePath)
      kickOff(filePath).then((url) => waiters.forEach((r) => r(url)))
    }
    if (pending.size) scheduleDrain()
  }
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 250 })
  else setTimeout(() => run(null), 32)
}

function request(filePath) {
  if (resolved.has(filePath)) return Promise.resolve(resolved.get(filePath))
  if (inflight.has(filePath)) return inflight.get(filePath)
  return new Promise((resolve) => {
    const waiters = pending.get(filePath)
    if (waiters) waiters.push(resolve)
    else pending.set(filePath, [resolve])
    scheduleDrain()
  })
}

// Reactive avatar source for a (possibly changing) file path.
//   src     — '' until ready, then the image URL
//   loading — true while a photo exists but its thumbnail hasn't resolved yet
//             (drive a skeleton placeholder off this)
export function useThumbnail(getFilePath) {
  const src = ref('')
  const loading = ref(false)
  let token = 0
  watch(
    getFilePath,
    (filePath) => {
      const mine = ++token
      if (!filePath) {
        src.value = ''
        loading.value = false
        return
      }
      if (resolved.has(filePath)) {
        src.value = resolved.get(filePath)
        loading.value = false
        return
      }
      src.value = ''
      loading.value = true
      request(filePath).then((url) => {
        if (mine !== token) return // path changed out from under us
        src.value = url
        loading.value = false
      })
    },
    { immediate: true }
  )
  return { src, loading }
}
