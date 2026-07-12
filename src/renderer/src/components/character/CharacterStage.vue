<template>
  <div ref="wrapRef" class="stage-wrap">
    <canvas
      ref="canvasRef"
      class="stage-canvas"
      :style="{ cursor: cursor }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @wheel.prevent="onWheel"
      @dblclick="resetView"
    ></canvas>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { resolveLayers } from './characterModel'
import { drawLayers, fitRegion, hitTest } from './render/SpriteCompositor2D'

// The live editing stage: draws the current draft through the 2D compositor,
// runs the idle animation (breathing + blinks), and turns clicks on the figure
// into slot selections — the character is the menu. Interaction state stays
// local; the draft itself is owned by CharacterView.

const props = defineProps({
  doc: { type: Object, required: true },
  pack: { type: Object, required: true },
  selectedSlot: { type: String, default: null }
})
const emit = defineEmits(['select-slot'])

const wrapRef = ref(null)
const canvasRef = ref(null)
const cursor = ref('default')

let ctx = null
let dpr = 1
let width = 0
let height = 0
let raf = 0
let accent = '#6c8ef5'

// User camera on top of the fitted figure: zoom about center + pan.
let zoom = 1
let panX = 0
let panY = 0

// Idle animation state
let nextBlinkAt = performance.now() + 2600
let blinkStart = -1
const BLINK_MS = 150

function currentView() {
  const region = {
    cx: props.pack.width / 2,
    cy: props.pack.height / 2,
    span: Math.max(props.pack.width, props.pack.height) * 1.08
  }
  const fit = fitRegion(region, width, height, 24 * dpr)
  const k = fit.k * zoom
  return {
    k,
    tx: width / 2 - region.cx * k + panX,
    ty: height / 2 - region.cy * k + panY
  }
}

function anim(now) {
  if (now >= nextBlinkAt && blinkStart < 0) {
    blinkStart = now
    nextBlinkAt = now + 2400 + Math.random() * 2800
  }
  let blink = 0
  if (blinkStart >= 0) {
    const t = (now - blinkStart) / BLINK_MS
    if (t >= 1) blinkStart = -1
    else blink = t < 0.5 ? t * 2 : (1 - t) * 2
  }
  return { blink, breath: Math.sin((now / 3600) * Math.PI * 2) * 0.5 + 0.5 }
}

function draw(now) {
  raf = requestAnimationFrame(draw)
  if (!ctx || !width || !height) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)
  const view = currentView()

  // Podium + spotlight wash (in character space, under the figure)
  ctx.save()
  ctx.setTransform(view.k, 0, 0, view.k, view.tx, view.ty)
  const g = props.pack.rig.ground
  const spot = ctx.createRadialGradient(g.x, 200, 40, g.x, 220, 320)
  spot.addColorStop(0, hexA(accent, 0.1))
  spot.addColorStop(1, hexA(accent, 0))
  ctx.fillStyle = spot
  ctx.fillRect(g.x - 320, -120, 640, 700)
  ctx.beginPath()
  ctx.ellipse(g.x, g.y + 6, 100, 17, 0, 0, Math.PI * 2)
  ctx.fillStyle = hexA(accent, 0.16)
  ctx.fill()
  ctx.restore()

  const layers = resolveLayers(props.doc, props.pack, anim(now))
  drawLayers(ctx, layers, view, { highlightSlot: props.selectedSlot, highlightColor: accent })
}

function hexA(hex, a) {
  const n = parseInt(hex.replace('#', ''), 16)
  if (!Number.isFinite(n)) return `rgba(108,142,245,${a})`
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

// ── Interaction ───────────────────────────────────────────────────────────────
let pointer = null // { x, y, panX0, panY0, moved }

function devicePoint(e) {
  const rect = canvasRef.value.getBoundingClientRect()
  return { x: (e.clientX - rect.left) * dpr, y: (e.clientY - rect.top) * dpr }
}

function onPointerDown(e) {
  canvasRef.value.setPointerCapture(e.pointerId)
  pointer = { x: e.clientX, y: e.clientY, panX0: panX, panY0: panY, moved: false }
}

function onPointerMove(e) {
  if (pointer) {
    const dx = e.clientX - pointer.x
    const dy = e.clientY - pointer.y
    if (pointer.moved || Math.hypot(dx, dy) > 3) {
      pointer.moved = true
      panX = pointer.panX0 + dx * dpr
      panY = pointer.panY0 + dy * dpr
      cursor.value = 'grabbing'
    }
    return
  }
  if (!ctx) return
  const p = devicePoint(e)
  const layers = resolveLayers(props.doc, props.pack)
  cursor.value = hitTest(ctx, layers, p.x, p.y, currentView()) ? 'pointer' : 'default'
}

function onPointerUp(e) {
  if (!pointer) return
  const wasDrag = pointer.moved
  pointer = null
  cursor.value = 'default'
  if (wasDrag || !ctx) return
  const p = devicePoint(e)
  const layers = resolveLayers(props.doc, props.pack)
  const slot = hitTest(ctx, layers, p.x, p.y, currentView())
  if (slot) emit('select-slot', slot)
}

function onWheel(e) {
  zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12)
}

function zoomBy(f) {
  zoom = Math.min(4, Math.max(0.5, zoom * f))
}

function resetView() {
  zoom = 1
  panX = 0
  panY = 0
}

defineExpose({ zoomBy, resetView })

// ── Lifecycle ─────────────────────────────────────────────────────────────────
let resizeObserver = null

function resize() {
  const el = wrapRef.value
  const canvas = canvasRef.value
  if (!el || !canvas) return
  dpr = window.devicePixelRatio || 1
  width = Math.max(1, Math.round(el.clientWidth * dpr))
  height = Math.max(1, Math.round(el.clientHeight * dpr))
  canvas.width = width
  canvas.height = height
  canvas.style.width = el.clientWidth + 'px'
  canvas.style.height = el.clientHeight + 'px'
}

onMounted(() => {
  ctx = canvasRef.value.getContext('2d')
  accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || accent
  resize()
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(wrapRef.value)
  raf = requestAnimationFrame(draw)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  resizeObserver?.disconnect()
  ctx = null
})

// Re-fit when the person (and so possibly the figure) changes wholesale
watch(
  () => props.doc?.id,
  () => resetView()
)
</script>

<style scoped>
.stage-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.stage-canvas {
  position: absolute;
  inset: 0;
  touch-action: none;
}
</style>
