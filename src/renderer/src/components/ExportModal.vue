<template>
  <Teleport to="body">
    <Transition name="exp">
      <div v-if="open" class="exp-backdrop" @click.self="onBackdrop">
        <div class="exp-box" role="dialog" aria-modal="true" aria-label="Export image">
          <header class="exp-header">
            <div>
              <h2 class="exp-h2">Export image</h2>
              <p class="exp-sub">Compose a picture of your project and save it anywhere</p>
            </div>
            <button class="exp-close" title="Close (Esc)" @click="emit('close')">×</button>
          </header>

          <div class="exp-body">
            <!-- ── Preview ─────────────────────────────────────────────── -->
            <div class="exp-preview-pane">
              <div
                ref="previewBoxEl"
                class="exp-preview-box"
                :class="{ 'exp-checker': scheme === 'transparent' }"
              >
                <canvas
                  ref="previewCanvasEl"
                  class="exp-preview-canvas"
                  :class="{ 'exp-dim': rendering }"
                ></canvas>
                <div
                  v-if="cropMode && !empty"
                  class="exp-crop-layer"
                  @pointerdown="onCropDown"
                  @pointermove="onCropMove"
                  @pointerup="onCropUp"
                  @pointercancel="onCropUp"
                >
                  <div v-if="cropDraft" class="exp-crop-rect" :style="cropRectStyle">
                    <span class="exp-crop-hint">drag to reframe</span>
                  </div>
                  <div v-else class="exp-crop-cta">Drag to frame the part you want</div>
                </div>
                <div v-if="empty && !rendering" class="exp-empty">
                  <span class="exp-empty-icon">{{ viewMeta[srcView].icon }}</span>
                  <p>Nothing to picture in the {{ viewMeta[srcView].label }} view yet.</p>
                </div>
                <div v-if="rendering" class="exp-shimmer"></div>
              </div>
              <div class="exp-preview-meta">
                <span class="exp-dims">{{ exportW }} × {{ exportH }} px</span>
                <span v-if="crop && !cropMode" class="exp-crop-tag">
                  cropped
                  <button class="exp-mini-btn" @click="resetCrop">reset</button>
                </span>
              </div>
            </div>

            <!-- ── Controls ────────────────────────────────────────────── -->
            <aside class="exp-controls">
              <section class="exp-group">
                <h3 class="exp-label">View</h3>
                <div class="exp-seg">
                  <button
                    v-for="v in exportableViews"
                    :key="v"
                    class="exp-seg-btn"
                    :class="{ on: srcView === v }"
                    @click="srcView = v"
                  >
                    {{ viewMeta[v].icon }} {{ viewMeta[v].label }}
                  </button>
                </div>
              </section>

              <section class="exp-group">
                <h3 class="exp-label">Size</h3>
                <select v-model="presetId" class="exp-select">
                  <option v-for="p in RESOLUTION_PRESETS" :key="p.id" :value="p.id">
                    {{ p.label }} — {{ p.hint }}
                  </option>
                  <option value="custom">Custom…</option>
                </select>
                <div v-if="presetId === 'custom'" class="exp-row">
                  <input
                    v-model.number="customW"
                    type="number"
                    class="exp-num"
                    :min="MIN_DIMENSION"
                    :max="MAX_DIMENSION"
                    @change="customW = clampDimension(customW)"
                  />
                  <span class="exp-x">×</span>
                  <input
                    v-model.number="customH"
                    type="number"
                    class="exp-num"
                    :min="MIN_DIMENSION"
                    :max="MAX_DIMENSION"
                    @change="customH = clampDimension(customH)"
                  />
                  <span class="exp-unit">px</span>
                </div>
              </section>

              <section class="exp-group">
                <h3 class="exp-label">Format</h3>
                <div class="exp-seg">
                  <button
                    v-for="f in EXPORT_FORMATS"
                    :key="f.id"
                    class="exp-seg-btn"
                    :class="{ on: formatId === f.id }"
                    @click="formatId = f.id"
                  >
                    {{ f.label }}
                  </button>
                </div>
                <label v-if="format.hasQuality" class="exp-slider-row">
                  <span class="exp-slider-label">Quality</span>
                  <input v-model.number="quality" type="range" min="0.5" max="1" step="0.01" />
                  <span class="exp-slider-val">{{ Math.round(quality * 100) }}%</span>
                </label>
              </section>

              <section class="exp-group">
                <h3 class="exp-label">Colours</h3>
                <div class="exp-seg">
                  <button
                    v-for="s in schemeOptions"
                    :key="s.id"
                    class="exp-seg-btn"
                    :class="{ on: scheme === s.id }"
                    :disabled="s.id === 'transparent' && !format.alpha"
                    :title="
                      s.id === 'transparent' && !format.alpha
                        ? 'JPEG has no transparency — pick PNG or WebP'
                        : s.label
                    "
                    @click="scheme = s.id"
                  >
                    {{ s.label }}
                  </button>
                </div>
                <label class="exp-check-row" :class="{ 'exp-disabled': scheme === 'transparent' }">
                  <input v-model="tintOn" type="checkbox" :disabled="scheme === 'transparent'" />
                  Ambient colour wash
                </label>
                <label class="exp-slider-row">
                  <span class="exp-slider-label">Margin</span>
                  <input
                    v-model.number="paddingFrac"
                    type="range"
                    min="0"
                    max="0.15"
                    step="0.005"
                  />
                  <span class="exp-slider-val">{{ Math.round(paddingFrac * 100) }}%</span>
                </label>
              </section>

              <section class="exp-group">
                <h3 class="exp-label">Text</h3>
                <input v-model="title" class="exp-input" placeholder="Title (shown in the image)" />
                <input v-model="subtitle" class="exp-input" placeholder="Subtitle (optional)" />
                <label class="exp-check-row">
                  <input v-model="stampOn" type="checkbox" />
                  Corner stamp — {{ stampText }}
                </label>
              </section>

              <section class="exp-group">
                <h3 class="exp-label">Crop</h3>
                <div class="exp-row">
                  <button
                    class="btn btn-sm"
                    :class="{ 'exp-crop-on': cropMode }"
                    @click="toggleCropMode"
                  >
                    {{ cropMode ? '✓ Done' : '✂ Crop' }}
                  </button>
                  <button v-if="crop" class="btn btn-ghost btn-sm" @click="resetCrop">Reset</button>
                </div>
              </section>
            </aside>
          </div>

          <footer class="exp-footer">
            <div class="exp-file">
              <input
                v-model="filename"
                class="exp-input exp-file-input"
                @input="filenameEdited = true"
              />
              <span class="exp-ext">.{{ format.ext }}</span>
            </div>
            <div class="exp-actions">
              <button class="btn btn-ghost" @click="emit('close')">Cancel</button>
              <button
                class="btn btn-primary exp-download"
                :class="{ 'exp-saved': justSaved }"
                :disabled="empty || exporting"
                @click="doExport"
              >
                <span v-if="justSaved">✓ Saved</span>
                <span v-else-if="exporting">Rendering…</span>
                <span v-else>⬇ Download</span>
              </button>
            </div>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { useMainStore } from '../store/index.js'
import {
  RESOLUTION_PRESETS,
  EXPORT_FORMATS,
  MIN_DIMENSION,
  MAX_DIMENSION,
  clampDimension,
  computeComposeLayout,
  captureSizeFor,
  fitRectContain,
  clampCrop,
  composeExport,
  sanitizeFilename
} from './export/exportCompose'

const props = defineProps({
  open: { type: Boolean, default: false },
  // (viewId, { width, height, light }) => HTMLCanvasElement | null
  capture: { type: Function, required: true }
})
const emit = defineEmits(['close'])

const store = useMainStore()

const viewMeta = {
  graph: { icon: '🕸', label: 'Graph' },
  timeline: { icon: '📅', label: 'Timeline' },
  groups: { icon: '⬡', label: 'Groups' }
}
const exportableViews = computed(() =>
  ['graph', 'timeline', 'groups'].filter((v) => store.caps.views.includes(v))
)

const schemeOptions = [
  { id: 'app', label: 'Match app' },
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'transparent', label: 'None' }
]

// The views' signature ambient wash colours (see each view's CSS background).
const VIEW_TINT = {
  graph: 'rgba(108, 142, 245, 0.08)',
  timeline: 'rgba(139, 108, 197, 0.08)',
  groups: 'rgba(108, 142, 245, 0.07)'
}

// ── Options state ────────────────────────────────────────────────────────────
const srcView = ref('graph')
const presetId = ref('fhd')
const customW = ref(1920)
const customH = ref(1080)
const formatId = ref('png')
const quality = ref(0.92)
const scheme = ref('app')
const tintOn = ref(true)
const paddingFrac = ref(0.05)
const title = ref('')
const subtitle = ref('')
const stampOn = ref(false)
const filename = ref('')
const filenameEdited = ref(false)
const crop = ref(null) // committed CropRect (scene fractions) or null
const cropMode = ref(false)
const cropDraft = ref(null) // rect being dragged (scene fractions)

const format = computed(() => EXPORT_FORMATS.find((f) => f.id === formatId.value))
const exportW = computed(() =>
  presetId.value === 'custom'
    ? clampDimension(customW.value)
    : RESOLUTION_PRESETS.find((p) => p.id === presetId.value).width
)
const exportH = computed(() =>
  presetId.value === 'custom'
    ? clampDimension(customH.value)
    : RESOLUTION_PRESETS.find((p) => p.id === presetId.value).height
)
const stampText = computed(() => {
  const name = store.activeProject?.name || 'Family tree'
  return `${name} · ${new Date().getFullYear()}`
})

// JPEG cannot hold transparency — bounce back to the app scheme.
watch(formatId, () => {
  if (!format.value.alpha && scheme.value === 'transparent') scheme.value = 'app'
})

// ── Open/close lifecycle ─────────────────────────────────────────────────────
watch(
  () => props.open,
  (on) => {
    if (!on) {
      cropMode.value = false
      window.removeEventListener('keydown', onKeydown)
      return
    }
    window.addEventListener('keydown', onKeydown)
    const active = store.activeView
    srcView.value = exportableViews.value.includes(active)
      ? active
      : exportableViews.value[0] || 'graph'
    title.value = store.activeProject?.name || ''
    filenameEdited.value = false
    crop.value = null
    justSaved.value = false
    syncFilename()
    nextTick(() => {
      measurePreviewBox()
      renderPreview()
      // Hidden views may still be loading avatar photos into their texture
      // atlas — take a second pass once those have had a moment to land.
      setTimeout(() => props.open && renderPreview(), 750)
    })
  }
)
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

function onKeydown(e) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    if (cropMode.value) cropMode.value = false
    else emit('close')
  }
}

function onBackdrop() {
  if (!cropMode.value) emit('close')
}

function syncFilename() {
  if (filenameEdited.value) return
  const project = sanitizeFilename(store.activeProject?.name || '', 'family-tree')
  filename.value = `${project} ${viewMeta[srcView.value].label}`.toLowerCase().replace(/\s+/g, '-')
}
watch(srcView, syncFilename)

// ── Preview rendering ────────────────────────────────────────────────────────
const previewBoxEl = ref(null)
const previewCanvasEl = ref(null)
const rendering = ref(false)
const empty = ref(false)
const exporting = ref(false)
const justSaved = ref(false)

let boxW = 0
let boxH = 0
let ro = null
// Where the scene landed inside the preview canvas (canvas px) — used to map
// crop drags back to scene fractions.
let sceneDstRect = null
let renderToken = 0
let debounceTimer = 0

function measurePreviewBox() {
  boxW = previewBoxEl.value?.clientWidth || 0
  boxH = previewBoxEl.value?.clientHeight || 0
  if (previewBoxEl.value && !ro) {
    ro = new ResizeObserver(() => {
      const w = previewBoxEl.value?.clientWidth || 0
      const h = previewBoxEl.value?.clientHeight || 0
      if (w !== boxW || h !== boxH) {
        boxW = w
        boxH = h
        scheduleRender()
      }
    })
    ro.observe(previewBoxEl.value)
  }
}
onUnmounted(() => ro?.disconnect())

function lightFor(schemeId) {
  if (schemeId === 'dark') return false
  if (schemeId === 'light') return true
  return null // match the app / transparent keeps current labels readable
}

// Read the design tokens for the chosen scheme (briefly flipping the document
// theme when it differs — synchronous, so nothing ever paints mid-flip).
function resolveColors(schemeId) {
  const doc = document.documentElement
  const prev = doc.dataset.theme
  const want = schemeId === 'dark' ? 'dark' : schemeId === 'light' ? 'light' : prev
  if (want !== prev) doc.dataset.theme = want
  const cs = getComputedStyle(doc)
  const v = (n, f) => (cs.getPropertyValue(n) || f).trim()
  const out = {
    bg: v('--bg', '#0f1117'),
    t1: v('--t1', '#e8eaf6'),
    t2: v('--t2', '#9ea3b8'),
    t3: v('--t3', '#4a5068'),
    tint: tintOn.value && schemeId !== 'transparent' ? VIEW_TINT[srcView.value] : null
  }
  if (want !== prev) doc.dataset.theme = prev
  return out
}

function composeOpts(width, height, { forCropOverlay = false } = {}) {
  return {
    width,
    height,
    transparent: scheme.value === 'transparent',
    colors: resolveColors(scheme.value),
    paddingFrac: paddingFrac.value,
    title: title.value,
    subtitle: subtitle.value,
    stamp: stampOn.value ? stampText.value : '',
    crop: forCropOverlay ? null : crop.value
  }
}

function scheduleRender() {
  if (!props.open) return
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(renderPreview, 120)
}

watch(
  [
    srcView,
    presetId,
    customW,
    customH,
    scheme,
    tintOn,
    paddingFrac,
    title,
    subtitle,
    stampOn,
    crop,
    cropMode,
    formatId
  ],
  scheduleRender
)

function renderPreview() {
  if (!props.open || !previewCanvasEl.value) return
  const token = ++renderToken
  rendering.value = true
  requestAnimationFrame(() => {
    if (token !== renderToken || !props.open) return
    try {
      drawPreview()
    } finally {
      if (token === renderToken) rendering.value = false
    }
  })
}

function drawPreview() {
  const canvas = previewCanvasEl.value
  if (!canvas || !boxW || !boxH) return
  // Fit the export aspect into the preview box, dpr-crisp.
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const aspect = exportW.value / exportH.value
  let cssW = boxW
  let cssH = cssW / aspect
  if (cssH > boxH) {
    cssH = boxH
    cssW = cssH * aspect
  }
  const pw = Math.max(2, Math.round(cssW * dpr))
  const ph = Math.max(2, Math.round(cssH * dpr))
  canvas.width = pw
  canvas.height = ph
  canvas.style.width = `${Math.round(cssW)}px`
  canvas.style.height = `${Math.round(cssH)}px`

  const inCropMode = cropMode.value
  const opts = composeOpts(pw, ph, { forCropOverlay: inCropMode })
  const L = computeComposeLayout(opts)
  // Capture at the FULL export content size — label LOD, line widths and text
  // sizes then match the downloaded file exactly; compose downscales it into
  // the preview (the content rects share an aspect, so nothing shifts).
  const FL = computeComposeLayout(
    composeOpts(exportW.value, exportH.value, { forCropOverlay: inCropMode })
  )
  const cap = captureSizeFor(FL.content, inCropMode ? null : crop.value)
  const scene = props.capture(srcView.value, {
    width: cap.width,
    height: cap.height,
    light: lightFor(scheme.value)
  })
  empty.value = !scene
  sceneDstRect = scene ? fitRectContain(scene.width, scene.height, L.content) : null

  const composed = composeExport(scene, opts)
  const g = canvas.getContext('2d')
  g.clearRect(0, 0, pw, ph)
  g.drawImage(composed, 0, 0)
}

// ── Crop interactions ────────────────────────────────────────────────────────
const cropRectStyle = computed(() => {
  const c = cropDraft.value
  const canvas = previewCanvasEl.value
  if (!c || !sceneDstRect || !canvas) return {}
  // scene fractions → canvas px → CSS px
  const scale = canvas.clientWidth / canvas.width || 1
  const x = (sceneDstRect.x + c.x * sceneDstRect.w) * scale
  const y = (sceneDstRect.y + c.y * sceneDstRect.h) * scale
  const w = c.w * sceneDstRect.w * scale
  const h = c.h * sceneDstRect.h * scale
  return { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` }
})

let cropGesture = null // { mode: 'draw'|'move', startFx, startFy, orig }

function pointToSceneFrac(e) {
  const canvas = previewCanvasEl.value
  if (!canvas || !sceneDstRect) return null
  const rect = canvas.getBoundingClientRect()
  const px = ((e.clientX - rect.left) / rect.width) * canvas.width
  const py = ((e.clientY - rect.top) / rect.height) * canvas.height
  return {
    fx: (px - sceneDstRect.x) / sceneDstRect.w,
    fy: (py - sceneDstRect.y) / sceneDstRect.h
  }
}

function toggleCropMode() {
  cropMode.value = !cropMode.value
  if (cropMode.value) cropDraft.value = crop.value ? { ...crop.value } : null
  else commitCrop()
}

function resetCrop() {
  crop.value = null
  cropDraft.value = null
  if (!cropMode.value) scheduleRender()
}

function commitCrop() {
  const c = cropDraft.value
  crop.value = c && c.w > 0.02 && c.h > 0.02 && (c.w < 0.995 || c.h < 0.995) ? clampCrop(c) : null
  cropDraft.value = null
}

function onCropDown(e) {
  const p = pointToSceneFrac(e)
  if (!p) return
  e.currentTarget.setPointerCapture(e.pointerId)
  const d = cropDraft.value
  const inside = d && p.fx >= d.x && p.fx <= d.x + d.w && p.fy >= d.y && p.fy <= d.y + d.h
  cropGesture = inside
    ? { mode: 'move', startFx: p.fx, startFy: p.fy, orig: { ...d } }
    : { mode: 'draw', startFx: p.fx, startFy: p.fy }
  if (!inside) cropDraft.value = { x: p.fx, y: p.fy, w: 0, h: 0 }
}

function onCropMove(e) {
  if (!cropGesture) return
  const p = pointToSceneFrac(e)
  if (!p) return
  if (cropGesture.mode === 'move') {
    const o = cropGesture.orig
    cropDraft.value = clampCrop({
      x: o.x + (p.fx - cropGesture.startFx),
      y: o.y + (p.fy - cropGesture.startFy),
      w: o.w,
      h: o.h
    })
  } else {
    const x0 = Math.max(0, Math.min(cropGesture.startFx, p.fx))
    const y0 = Math.max(0, Math.min(cropGesture.startFy, p.fy))
    const x1 = Math.min(1, Math.max(cropGesture.startFx, p.fx))
    const y1 = Math.min(1, Math.max(cropGesture.startFy, p.fy))
    cropDraft.value = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  }
}

function onCropUp() {
  if (
    cropGesture?.mode === 'draw' &&
    cropDraft.value &&
    (cropDraft.value.w < 0.02 || cropDraft.value.h < 0.02)
  ) {
    cropDraft.value = null // a stray click, not a real selection
  }
  cropGesture = null
}

// ── Download ─────────────────────────────────────────────────────────────────
let savedTimer = 0
function doExport() {
  if (empty.value || exporting.value) return
  exporting.value = true
  // Let the button state paint before the heavy synchronous render.
  requestAnimationFrame(() => {
    setTimeout(() => {
      try {
        const opts = composeOpts(exportW.value, exportH.value)
        const L = computeComposeLayout(opts)
        const cap = captureSizeFor(L.content, crop.value)
        const scene = props.capture(srcView.value, {
          width: cap.width,
          height: cap.height,
          light: lightFor(scheme.value)
        })
        const out = composeExport(scene, opts)
        const name = `${sanitizeFilename(filename.value)}.${format.value.ext}`
        out.toBlob(
          (blob) => {
            exporting.value = false
            if (!blob) return
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = name
            a.click()
            URL.revokeObjectURL(url)
            justSaved.value = true
            clearTimeout(savedTimer)
            savedTimer = setTimeout(() => (justSaved.value = false), 1800)
          },
          format.value.mime,
          format.value.hasQuality ? quality.value : undefined
        )
      } catch (err) {
        console.error('Image export failed:', err)
        exporting.value = false
      }
    }, 20)
  })
}
onUnmounted(() => {
  clearTimeout(savedTimer)
  clearTimeout(debounceTimer)
})
</script>

<style scoped>
.exp-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.exp-box {
  width: min(1060px, calc(100vw - 48px));
  height: min(700px, calc(100vh - 48px));
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Enter/leave: the app's modal pop */
.exp-enter-active,
.exp-leave-active {
  transition: opacity 0.22s ease;
}
.exp-enter-active .exp-box,
.exp-leave-active .exp-box {
  transition:
    transform 0.28s cubic-bezier(0.34, 1.3, 0.64, 1),
    opacity 0.22s ease;
}
.exp-enter-from,
.exp-leave-to {
  opacity: 0;
}
.exp-enter-from .exp-box,
.exp-leave-to .exp-box {
  transform: translateY(18px) scale(0.97);
  opacity: 0;
}

/* ── Header ─────────────────────────────────────────────── */
.exp-header {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 18px 22px 14px;
  border-bottom: 1px solid var(--border);
}
.exp-h2 {
  font-size: 17px;
  font-weight: 700;
  color: var(--t1);
  margin: 0;
}
.exp-sub {
  font-size: 12px;
  color: var(--t2);
  margin: 3px 0 0;
}
.exp-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--t3);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  transition:
    background 0.13s,
    color 0.13s;
}
.exp-close:hover {
  background: var(--hover);
  color: var(--t1);
}

/* ── Body ───────────────────────────────────────────────── */
.exp-body {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
}

.exp-preview-pane {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 18px;
  gap: 10px;
}
.exp-preview-box {
  flex: 1 1 0;
  min-height: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}
/* checkerboard behind transparent exports */
.exp-checker {
  background-image:
    linear-gradient(45deg, rgba(128, 128, 128, 0.16) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(128, 128, 128, 0.16) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(128, 128, 128, 0.16) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(128, 128, 128, 0.16) 75%);
  background-size: 18px 18px;
  background-position:
    0 0,
    0 9px,
    9px -9px,
    -9px 0;
}
.exp-preview-canvas {
  border-radius: 4px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35);
  transition: opacity 0.18s ease;
}
.exp-dim {
  opacity: 0.45;
}

.exp-shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    100deg,
    transparent 30%,
    rgba(255, 255, 255, 0.05) 50%,
    transparent 70%
  );
  background-size: 220% 100%;
  animation: exp-sweep 1s linear infinite;
  pointer-events: none;
}
@keyframes exp-sweep {
  from {
    background-position: 130% 0;
  }
  to {
    background-position: -90% 0;
  }
}

.exp-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--t2);
  font-size: 13px;
  text-align: center;
  padding: 24px;
}
.exp-empty-icon {
  font-size: 34px;
  opacity: 0.5;
}

/* crop */
.exp-crop-layer {
  position: absolute;
  inset: 0;
  cursor: crosshair;
  touch-action: none;
}
.exp-crop-rect {
  position: absolute;
  border: 1.5px solid var(--accent);
  border-radius: 3px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45);
  cursor: move;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.exp-crop-hint {
  font-size: 10px;
  font-weight: 600;
  color: var(--accent);
  background: var(--surface);
  border-radius: 6px;
  padding: 2px 7px;
  margin-bottom: 6px;
  opacity: 0.9;
  pointer-events: none;
  white-space: nowrap;
}
.exp-crop-cta {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11.5px;
  font-weight: 600;
  color: var(--t1);
  background: var(--glass-soft, rgba(24, 28, 39, 0.82));
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 5px 12px;
  pointer-events: none;
}

.exp-preview-meta {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11.5px;
  color: var(--t3);
  min-height: 18px;
}
.exp-crop-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--accent);
  font-weight: 600;
}
.exp-mini-btn {
  border: none;
  background: var(--adim);
  color: var(--accent);
  font-size: 10.5px;
  font-weight: 600;
  border-radius: 6px;
  padding: 1px 7px;
  cursor: pointer;
}
.exp-mini-btn:hover {
  background: var(--hover);
}

/* ── Controls rail ──────────────────────────────────────── */
.exp-controls {
  flex: 0 0 268px;
  border-left: 1px solid var(--border);
  padding: 16px 18px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.exp-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.exp-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: var(--t3);
  margin: 0;
}

.exp-seg {
  display: flex;
  gap: 4px;
  background: var(--elevated);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 3px;
}
.exp-seg-btn {
  flex: 1 1 0;
  border: none;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 11.5px;
  font-weight: 600;
  padding: 5px 4px;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 0.15s,
    color 0.15s;
}
.exp-seg-btn:hover:not(:disabled) {
  color: var(--t1);
}
.exp-seg-btn.on {
  background: var(--adim);
  color: var(--accent);
}
.exp-seg-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.exp-select,
.exp-input {
  width: 100%;
}
.exp-row {
  display: flex;
  align-items: center;
  gap: 7px;
}
.exp-num {
  width: 82px;
}
.exp-x,
.exp-unit {
  font-size: 12px;
  color: var(--t3);
}

.exp-slider-row {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 12px;
  color: var(--t2);
}
.exp-slider-row input[type='range'] {
  flex: 1 1 0;
  padding: 0;
  accent-color: var(--accent);
  background: transparent;
  border: none;
}
.exp-slider-label {
  flex: 0 0 auto;
}
.exp-slider-val {
  flex: 0 0 36px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--t3);
  font-size: 11px;
}

.exp-check-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--t2);
  cursor: pointer;
}
.exp-check-row input {
  accent-color: var(--accent);
}
.exp-disabled {
  opacity: 0.45;
}

.exp-crop-on {
  background: var(--adim);
  color: var(--accent);
}

/* ── Footer ─────────────────────────────────────────────── */
.exp-footer {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 13px 18px;
  border-top: 1px solid var(--border);
}
.exp-file {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 0;
}
.exp-file-input {
  max-width: 320px;
}
.exp-ext {
  font-size: 12px;
  color: var(--t3);
}
.exp-actions {
  display: flex;
  gap: 8px;
}
.exp-download {
  min-width: 122px;
  transition:
    background 0.2s,
    box-shadow 0.2s;
}
.exp-download.exp-saved {
  background: var(--green);
  box-shadow: 0 2px 12px rgba(76, 175, 114, 0.35);
}

/* Narrow windows: stack the controls under the preview */
@media (max-width: 780px) {
  .exp-body {
    flex-direction: column;
    overflow-y: auto;
  }
  .exp-preview-pane {
    min-height: 260px;
  }
  .exp-controls {
    border-left: none;
    border-top: 1px solid var(--border);
    flex: 0 0 auto;
  }
}
</style>
