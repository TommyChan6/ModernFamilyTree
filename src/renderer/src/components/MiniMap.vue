<template>
  <div
    ref="rootEl"
    class="mini-map"
    :class="{ dragging }"
    :style="{ width: width + 'px', height: height + 'px' }"
    title="Overview — drag to move the view"
    @pointerdown.stop.prevent="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @click.stop
    @dblclick.stop
    @wheel.stop
    @contextmenu.prevent
  >
    <canvas ref="canvasEl"></canvas>
  </div>
</template>

<script setup>
// Corner minimap shared by the graph / timeline / groups views (and, with a
// custom viewport painter, the 3D space radar). The view hands in a plain
// (non-reactive) `adapter` object and pokes `redraw()` whenever its camera or
// content moves — the same imperative pattern the WebGL renderers use.
//
// Adapter contract (world coords are whatever the view thinks in):
//   getBounds()                  → {minX,minY,maxX,maxY} | null   content extent
//   getView()                    → {x,y,w,h}                      visible world rect
//   drawContent(g, proj, colors) → paint dots/segments via worldToMap(proj)
//   panTo(wx, wy, {smooth})      → centre the view camera on a world point
//   drawViewport?(g, proj, colors, view) → replace the default frame rectangle
//   onDragEnd?()                 → notified when a minimap drag gesture ends
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useMainStore } from '../store/index.js'
import { createCssColorCache, roundRect, withAlpha } from './webgl/overlayUtils.js'
import {
  rectToBounds,
  unionBounds,
  padBounds,
  fitProjection,
  mapToWorld,
  lerpProjection,
  projectionsClose
} from './webgl/minimapMath'

const props = defineProps({
  adapter: { type: Object, required: true },
  width: { type: Number, default: 208 },
  height: { type: Number, default: 142 },
  preserveAspect: { type: Boolean, default: true }
})

const store = useMainStore()
const rootEl = ref(null)
const canvasEl = ref(null)
const dragging = ref(false)

const css = createCssColorCache()
let g = null
let raf = 0
let proj = null // smoothed projection currently drawn
let targetProj = null // where the smoothing is heading (frozen while dragging)
let grab = { dx: 0, dy: 0 } // world offset pointer ↔ view centre during a drag

function redraw() {
  if (!raf) raf = requestAnimationFrame(draw)
}

function draw() {
  raf = 0
  if (!g || !canvasEl.value) return
  const W = props.width
  const H = props.height
  const dpr = canvasEl.value.width / W
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, W, H)

  const bounds = props.adapter.getBounds()
  const view = props.adapter.getView()
  const fitTo = unionBounds(bounds, view ? rectToBounds(view) : null)
  if (!fitTo) return

  // Reframing glides; while the user drags, the frame is frozen so the world
  // doesn't slide underneath the cursor.
  if (!dragging.value || !targetProj) {
    targetProj = fitProjection(padBounds(fitTo, 0.05), W, H, 8, props.preserveAspect)
  }
  proj = proj ? lerpProjection(proj, targetProj, 0.22) : targetProj

  const colors = css.get()
  props.adapter.drawContent(g, proj, colors)

  if (view) {
    if (props.adapter.drawViewport) {
      props.adapter.drawViewport(g, proj, colors, view)
    } else {
      drawFrame(view, colors, W, H)
    }
  }

  if (!projectionsClose(proj, targetProj)) redraw()
}

// The default viewport marker: everything outside the visible frame dims a
// touch, the frame itself gets a soft accent fill and a crisp outline.
function drawFrame(view, colors, W, H) {
  let x = view.x * proj.sx + proj.ox
  let y = view.y * proj.sy + proj.oy
  let w = view.w * proj.sx
  let h = view.h * proj.sy
  const MIN = 12 // keep the frame grabbable at extreme zoom-in
  if (w < MIN) {
    x -= (MIN - w) / 2
    w = MIN
  }
  if (h < MIN) {
    y -= (MIN - h) / 2
    h = MIN
  }
  g.save()
  g.beginPath()
  g.rect(0, 0, W, H)
  roundRect(g, x, y, w, h, 3)
  g.fillStyle = withAlpha(colors.bg, 0.32)
  g.fill('evenodd')
  g.restore()

  roundRect(g, x, y, w, h, 3)
  g.fillStyle = withAlpha(colors.accent, 0.09)
  g.fill()
  g.strokeStyle = withAlpha(colors.accent, 0.95)
  g.lineWidth = 1.4
  g.stroke()
}

// ── Drag to pan ──────────────────────────────────────────────────────────────
function pointerWorld(e) {
  const rect = canvasEl.value.getBoundingClientRect()
  return mapToWorld(e.clientX - rect.left, e.clientY - rect.top, proj)
}

function onDown(e) {
  if (e.button !== 0 || !proj) return
  const w = pointerWorld(e)
  const view = props.adapter.getView()
  dragging.value = true
  try {
    rootEl.value.setPointerCapture(e.pointerId)
  } catch {
    /* best-effort */
  }
  const inside =
    view && w.x >= view.x && w.x <= view.x + view.w && w.y >= view.y && w.y <= view.y + view.h
  if (inside) {
    const cx = view.x + view.w / 2
    const cy = view.y + view.h / 2
    // Grabbed the frame: keep the offset so it doesn't jump to the cursor.
    grab = { dx: w.x - cx, dy: w.y - cy }
  } else {
    // Pressed elsewhere: glide the view there, then drag from that point.
    grab = { dx: 0, dy: 0 }
    props.adapter.panTo(w.x, w.y, { smooth: true })
  }
  redraw()
}

function onMove(e) {
  if (!dragging.value || !proj) return
  const w = pointerWorld(e)
  props.adapter.panTo(w.x - grab.dx, w.y - grab.dy, { smooth: false })
  redraw()
}

function onUp(e) {
  if (!dragging.value) return
  dragging.value = false
  try {
    rootEl.value.releasePointerCapture(e.pointerId)
  } catch {
    /* best-effort */
  }
  props.adapter.onDragEnd?.()
  redraw()
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvasEl.value.width = Math.round(props.width * dpr)
  canvasEl.value.height = Math.round(props.height * dpr)
  g = canvasEl.value.getContext('2d')
  redraw()
})

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
})

watch(
  () => store.theme,
  () => {
    css.invalidate()
    redraw()
  }
)

defineExpose({ redraw })
</script>

<style scoped>
.mini-map {
  position: absolute;
  top: 14px;
  left: 16px;
  z-index: 6;
  border-radius: 12px;
  background: var(--glass-strong);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  overflow: hidden;
  cursor: grab;
  opacity: 0.88;
  touch-action: none;
  transition:
    opacity 0.18s ease,
    transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  animation: mini-map-in 0.45s cubic-bezier(0.34, 1.4, 0.64, 1);
}

.mini-map:hover,
.mini-map.dragging {
  opacity: 1;
}

.mini-map.dragging {
  cursor: grabbing;
}

.mini-map canvas {
  display: block;
  width: 100%;
  height: 100%;
}

@keyframes mini-map-in {
  from {
    opacity: 0;
    transform: translateY(-10px) scale(0.92);
  }
}
</style>
