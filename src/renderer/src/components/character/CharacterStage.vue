<template>
  <div ref="wrapRef" class="stage-wrap">
    <canvas
      ref="canvasRef"
      class="stage-canvas"
      :style="{ cursor }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerLeave"
      @wheel.prevent="onWheel"
      @dblclick="resetView"
    ></canvas>
    <Transition name="stage-tip">
      <div
        v-if="hoverSlot && !dragging"
        class="stage-tip"
        :style="{ left: tipX + 'px', top: tipY + 'px' }"
      >
        <UiIcon v-if="slotIcon(hoverSlot)" :name="slotIcon(hoverSlot)" :size="14" />
        {{ t('character.slots.' + hoverSlot) }}
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from '../../i18n'
import { resolveLayers, fullRegion, slotOf } from './characterModel'
import { drawLayers, fitRegion, hitTest, outlineSlot } from './render/SpriteCompositor2D'
import { paintBackdrop, backdropOf } from './render/backdrops'
import { paperCanvas } from '../../lib/inkArt'
import UiIcon from '../ui/UiIcon.js'

// The live editing stage — the "character select screen". Draws the doc
// through the 2D compositor over an animated backdrop and runs everything
// that makes it feel alive: a tweened camera that glides to what you edit,
// eyes that follow the cursor (with idle glances), blinks, breathing, hair/
// cape sway, squash-and-stretch pops + sparkles on part swaps, an iris-wipe
// style transition and a shutter flash. Clicking the figure selects a slot —
// the character is the menu. All per-frame state is plain JS (no Vue
// reactivity in the hot path); the loop idles at ~30fps once nothing is
// being touched and stops entirely while the tab is hidden.

const props = defineProps({
  doc: { type: Object, required: true },
  pack: { type: Object, required: true },
  selectedSlot: { type: String, default: null },
  /** Camera target region { cx, cy, span } in character space (null = full body). */
  focus: { type: Object, default: null },
  backdrop: { type: String, default: 'studio' },
  /** Ambient motion + particles (off = reduced motion). */
  fx: { type: Boolean, default: true },
  /** Transient expression (emote preview) — wins over doc.expression. */
  emote: { type: String, default: null }
})
const emit = defineEmits(['select-slot'])
const { t } = useI18n()

const wrapRef = ref(null)
const canvasRef = ref(null)
const cursor = ref('grab')
const hoverSlot = ref(null)
const tipX = ref(0)
const tipY = ref(0)
const dragging = ref(false)

let ctx = null
let dpr = 1
let width = 0
let height = 0
let raf = 0
let accent = '#6c8ef5'
// Ink theme: a rice-paper tile multiplied over whatever backdrop is chosen,
// so every stage reads as painted on 宣纸 (one pattern fill per frame).
let inkPaper = null
let base = '#1a1b26'
const reducedMotion =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

// ── Camera: current region eases toward the target region ────────────────────
const cam = { cx: 0, cy: 0, span: 1 }
const target = { cx: 0, cy: 0, span: 1 }
let userZoom = 1 // wheel zoom on top of the focus target
let panX = 0 // user pan, character units
let panY = 0

function aimAt(region, snap = false) {
  const r = region || fullRegion(props.pack)
  target.cx = r.cx
  target.cy = r.cy
  target.span = r.span
  userZoom = 1
  panX = 0
  panY = 0
  if (snap) Object.assign(cam, target)
  poke()
}

function currentView() {
  return fitRegion(cam, width, height, 18 * dpr)
}

// ── Animation state ───────────────────────────────────────────────────────────
let last = performance.now()
let lastDraw = 0
let lastInteraction = performance.now()
let nextBlinkAt = performance.now() + 2200
let blinkStart = -1
let doubleBlink = false
const BLINK_MS = 140

const look = { x: 0, y: 0 } // smoothed
const lookTarget = { x: 0, y: 0 }
let pointerInside = false
let nextGlanceAt = performance.now() + 3000

let selectAt = -1e9 // when the selected slot last changed (glow fade)
const pops = new Map() // slot → start time
const POP_MS = 460
const sparkles = [] // { x, y, vx, vy, born, life, size, hue }
let transition = null // { start, snapshot }
let flashStart = -1
let pendingHover = null // { x, y, clientX, clientY } processed once per frame

function blinkAmount(now) {
  if (now >= nextBlinkAt && blinkStart < 0) {
    blinkStart = now
    doubleBlink = Math.random() < 0.18
    nextBlinkAt = now + 2300 + Math.random() * 3200
  }
  if (blinkStart < 0) return 0
  const span = doubleBlink ? BLINK_MS * 2.4 : BLINK_MS
  const p = Math.max(0, (now - blinkStart) / span)
  if (p >= 1) {
    blinkStart = -1
    return 0
  }
  const q = doubleBlink ? (p < 0.5 ? p * 2 : (p - 0.5) * 2) : p
  return q < 0.5 ? q * 2 : (1 - q) * 2
}

function popScales(now) {
  if (!pops.size) return undefined
  const out = {}
  for (const [slot, start] of pops) {
    const p = Math.max(0, (now - start) / POP_MS)
    if (p >= 1) {
      pops.delete(slot)
      continue
    }
    out[slot] = 1 + 0.16 * Math.sin(p * Math.PI * 2.2) * (1 - p) ** 2
  }
  return out
}

function updateLook(now, dt) {
  if (!pointerInside && props.fx && !reducedMotion && now >= nextGlanceAt) {
    // Idle glances: look somewhere, then back to center
    const away = Math.random() < 0.6
    lookTarget.x = away ? (Math.random() * 2 - 1) * 0.7 : 0
    lookTarget.y = away ? (Math.random() * 2 - 1) * 0.35 : 0
    nextGlanceAt = now + 1600 + Math.random() * 2600
  }
  const k = 1 - Math.exp(-dt * 10)
  look.x += (lookTarget.x - look.x) * k
  look.y += (lookTarget.y - look.y) * k
}

function hexA(hex, a) {
  const n = parseInt(String(hex).replace('#', ''), 16)
  if (!Number.isFinite(n)) return `rgba(108,142,245,${a})`
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

// ── The frame ─────────────────────────────────────────────────────────────────
function frame(now) {
  raf = requestAnimationFrame(frame)
  if (!ctx || !width || !height) return
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now

  // Camera ease (critically-damped feel)
  const tx = target.cx + panX
  const ty = target.cy + panY
  const ts = target.span / userZoom
  const k = 1 - Math.exp(-dt * 7)
  cam.cx += (tx - cam.cx) * k
  cam.cy += (ty - cam.cy) * k
  cam.span += (ts - cam.span) * k
  const camMoving =
    Math.abs(tx - cam.cx) > 0.05 || Math.abs(ty - cam.cy) > 0.05 || Math.abs(ts - cam.span) > 0.05

  const busy =
    camMoving ||
    pops.size ||
    sparkles.length ||
    transition ||
    flashStart >= 0 ||
    blinkStart >= 0 ||
    now - selectAt < 1900
  // Idle throttle: nothing touched for 2s → ~30fps is plenty for breathing
  if (!busy && now - lastInteraction > 2000 && now - lastDraw < 32) return
  if (!busy && !props.fx && now - lastInteraction > 400 && now - lastDraw < 250) return
  lastDraw = now

  updateLook(now, dt)
  const motion = props.fx && !reducedMotion
  const secs = now / 1000

  // 1. Backdrop (device space)
  paintBackdrop(ctx, props.backdrop, width, height, secs, { accent, base, motion })
  if (inkPaper) {
    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = 0.55
    ctx.fillStyle = inkPaper
    ctx.fillRect(0, 0, width / dpr, height / dpr)
    ctx.restore()
  }

  const view = currentView()
  const { pack } = props

  // 2. Ground shadow + podium ring
  ctx.save()
  ctx.setTransform(view.k, 0, 0, view.k, view.tx, view.ty)
  const g = pack.rig.ground
  const floor = backdropOf(props.backdrop).floor
  const floorColor = floor === 'accent' ? accent : floor
  const rx = pack.width * 0.3
  const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, rx)
  grad.addColorStop(0, hexA(floorColor, 0.42))
  grad.addColorStop(1, hexA(floorColor, 0))
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.ellipse(g.x, g.y + 4, rx, rx * 0.16, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = hexA(accent, 0.28 + (motion ? 0.12 * Math.sin(secs * 2) : 0))
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.ellipse(g.x, g.y + 4, rx * 0.82, rx * 0.13, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  // 3. The figure
  const anim = {
    blink: blinkAmount(now),
    breath: motion ? Math.sin((secs / 3.6) * Math.PI * 2) * 0.5 + 0.5 : 0,
    look: { x: look.x, y: look.y },
    time: motion ? secs : undefined,
    pop: popScales(now),
    expression: props.emote || undefined
  }
  const layers = resolveLayers(props.doc, pack, anim)
  // Selection glow: pulses when a slot is picked, then gets out of the way
  const since = now - selectAt
  const glow = since < 1100 ? 1 : Math.max(0, 1 - (since - 1100) / 700)
  const pulse = motion ? 0.65 + 0.35 * Math.sin(secs * 6) : 1
  drawLayers(ctx, layers, view, {
    highlightSlot: glow > 0 ? props.selectedSlot : null,
    highlightColor: accent,
    highlightAlpha: pulse * 0.8 * glow
  })

  // Hover: hit-test once per frame, outline the hovered part
  if (pendingHover) {
    const h = pendingHover
    pendingHover = null
    const slot = hitTest(ctx, layers, h.x, h.y, view)
    hoverSlot.value = slot
    cursor.value = slot ? 'pointer' : 'grab'
    tipX.value = h.localX + 14
    tipY.value = h.localY + 12
  }
  if (hoverSlot.value && hoverSlot.value !== props.selectedSlot) {
    outlineSlot(ctx, layers, view, hoverSlot.value, '#ffffff', 0.35)
  }

  // 4. Sparkles (character space)
  if (sparkles.length) drawSparkles(now, view)

  // 5. Style-swap iris wipe: the old frame shrinks away inside a glowing ring
  if (transition) {
    const p = Math.max(0, Math.min(1, (now - transition.start) / 620))
    const e = 1 - (1 - p) ** 3
    const cx = width / 2
    const cy = height / 2
    const maxR = Math.hypot(width, height) / 2
    const r = e * maxR
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.beginPath()
    ctx.rect(0, 0, width, height)
    ctx.arc(cx, cy, r, 0, Math.PI * 2, true)
    ctx.clip('evenodd')
    ctx.drawImage(transition.snapshot, 0, 0)
    ctx.restore()
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.strokeStyle = hexA(accent, 0.9 * (1 - p))
    ctx.lineWidth = (14 * (1 - p) + 2) * dpr
    ctx.shadowColor = accent
    ctx.shadowBlur = 24 * dpr * (1 - p)
    ctx.beginPath()
    ctx.arc(cx, cy, Math.max(1, r), 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    if (p >= 1) transition = null
  }

  // 6. Shutter flash
  if (flashStart >= 0) {
    const p = Math.max(0, (now - flashStart) / 420)
    if (p >= 1) flashStart = -1
    else {
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - p) ** 2})`
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }
  }
}

function drawSparkles(now, view) {
  ctx.save()
  ctx.setTransform(view.k, 0, 0, view.k, view.tx, view.ty)
  for (let i = sparkles.length - 1; i >= 0; i--) {
    const s = sparkles[i]
    const age = Math.max(0, (now - s.born) / s.life)
    if (age >= 1) {
      sparkles.splice(i, 1)
      continue
    }
    const tt = Math.max(0, (now - s.born) / 1000)
    const x = s.x + s.vx * tt
    const y = s.y + s.vy * tt + 40 * tt * tt
    const r = s.size * (1 - age) * (age < 0.15 ? age / 0.15 : 1)
    ctx.globalAlpha = 1 - age
    ctx.fillStyle = s.color
    ctx.beginPath()
    // Four-point star
    ctx.moveTo(x, y - r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.quadraticCurveTo(x, y, x, y + r)
    ctx.quadraticCurveTo(x, y, x - r, y)
    ctx.quadraticCurveTo(x, y, x, y - r)
    ctx.fill()
  }
  ctx.restore()
}

// ── Effects API (called by CharacterView) ─────────────────────────────────────
/** Squash-and-stretch a slot (a part was swapped); optional sparkle burst. */
function pop(slotId, { sparkle = true } = {}) {
  const now = performance.now()
  pops.set(slotId, now)
  poke()
  if (!sparkle || !props.fx || reducedMotion) return
  const s = slotOf(props.pack, slotId)
  if (!s) return
  const colors = [accent, '#ffffff', '#ffe27a']
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.4
    const v = 60 + Math.random() * 90
    sparkles.push({
      x: s.socket.x + Math.cos(a) * 10,
      y: s.socket.y + Math.sin(a) * 10,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 30,
      born: now,
      life: 520 + Math.random() * 380,
      size: 3 + Math.random() * 4,
      color: colors[i % colors.length]
    })
  }
  if (sparkles.length > 90) sparkles.splice(0, sparkles.length - 90)
}

/** Pop every slot at once (randomize / inherit landings). */
function popAll(opts) {
  for (const s of props.pack.slots) pop(s.id, { sparkle: false })
  if (opts?.sparkle) pop('head', { sparkle: true })
}

/** Capture the current frame; the next frames iris-wipe from it. */
function beginTransition() {
  if (!ctx || !width || reducedMotion) return
  const snap = document.createElement('canvas')
  snap.width = width
  snap.height = height
  snap.getContext('2d').drawImage(canvasRef.value, 0, 0)
  transition = { start: performance.now(), snapshot: snap }
  poke()
}

function flash() {
  flashStart = performance.now()
  poke()
}

function zoomBy(f) {
  userZoom = Math.min(5, Math.max(0.45, userZoom * f))
  poke()
}

function resetView() {
  aimAt(props.focus)
}

defineExpose({ pop, popAll, beginTransition, flash, zoomBy, resetView })

function poke() {
  lastInteraction = performance.now()
}

// ── Interaction ───────────────────────────────────────────────────────────────
let pointer = null // { x, y, panX0, panY0, moved }

function onPointerDown(e) {
  canvasRef.value.setPointerCapture(e.pointerId)
  pointer = { x: e.clientX, y: e.clientY, panX0: panX, panY0: panY, moved: false }
  poke()
}

function onPointerMove(e) {
  poke()
  const rect = canvasRef.value.getBoundingClientRect()
  const localX = e.clientX - rect.left
  const localY = e.clientY - rect.top
  pointerInside = true
  // Eyes follow the cursor relative to the face on screen
  const view = currentView()
  const face = props.pack.face
  const fx = (face.cx * view.k + view.tx) / dpr
  const fy = (face.cy * view.k + view.ty) / dpr
  const reach = Math.max(120, rect.width * 0.35)
  lookTarget.x = Math.max(-1, Math.min(1, (localX - fx) / reach))
  lookTarget.y = Math.max(-1, Math.min(1, (localY - fy) / reach))

  if (pointer) {
    const dx = e.clientX - pointer.x
    const dy = e.clientY - pointer.y
    if (pointer.moved || Math.hypot(dx, dy) > 3) {
      pointer.moved = true
      dragging.value = true
      const perPx = cam.span / Math.min(width / dpr, height / dpr)
      panX = pointer.panX0 - dx * perPx
      panY = pointer.panY0 - dy * perPx
      cursor.value = 'grabbing'
    }
    return
  }
  pendingHover = { x: localX * dpr, y: localY * dpr, localX, localY }
}

function onPointerUp(e) {
  if (!pointer) return
  const wasDrag = pointer.moved
  pointer = null
  dragging.value = false
  cursor.value = hoverSlot.value ? 'pointer' : 'grab'
  if (wasDrag || !ctx) return
  const rect = canvasRef.value.getBoundingClientRect()
  const x = (e.clientX - rect.left) * dpr
  const y = (e.clientY - rect.top) * dpr
  const layers = resolveLayers(props.doc, props.pack)
  const slot = hitTest(ctx, layers, x, y, currentView())
  if (slot) emit('select-slot', slot)
}

function onPointerLeave() {
  pointerInside = false
  hoverSlot.value = null
  lookTarget.x = 0
  lookTarget.y = 0
}

function onWheel(e) {
  zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12)
}

function slotIcon(id) {
  return slotOf(props.pack, id)?.icon || ''
}

// ── Theme tokens ──────────────────────────────────────────────────────────────
function readTheme() {
  const cs = getComputedStyle(document.documentElement)
  accent = cs.getPropertyValue('--accent').trim() || accent
  base = cs.getPropertyValue('--bg').trim() || base
  if (!/^#[0-9a-f]{6}$/i.test(accent)) accent = '#6c8ef5'
  const ink = document.documentElement.dataset.theme === 'ink'
  if (ink && !inkPaper && ctx) {
    inkPaper = ctx.createPattern(
      paperCanvas(512, 512, { tone: '#f3ecdc', fiber: 0.6, seed: 13 }),
      'repeat'
    )
  } else if (!ink) inkPaper = null
  poke()
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
let resizeObserver = null
let themeObserver = null

function resize() {
  const el = wrapRef.value
  const canvas = canvasRef.value
  if (!el || !canvas) return
  dpr = Math.min(2, window.devicePixelRatio || 1)
  width = Math.max(1, Math.round(el.clientWidth * dpr))
  height = Math.max(1, Math.round(el.clientHeight * dpr))
  canvas.width = width
  canvas.height = height
  canvas.style.width = el.clientWidth + 'px'
  canvas.style.height = el.clientHeight + 'px'
  poke()
}

onMounted(() => {
  ctx = canvasRef.value.getContext('2d')
  readTheme()
  themeObserver = new MutationObserver(readTheme)
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme', 'style']
  })
  resize()
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(wrapRef.value)
  aimAt(props.focus, true)
  raf = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  resizeObserver?.disconnect()
  themeObserver?.disconnect()
  ctx = null
})

// Glide to a new focus; snap on a new look / style (proportions change)
watch(
  () => props.focus,
  (r) => aimAt(r)
)
watch(
  () => [props.doc?.id, props.pack.id],
  () => aimAt(props.focus, true)
)
watch(
  () => [props.backdrop, props.fx, props.emote],
  () => poke()
)
watch(
  () => props.selectedSlot,
  () => {
    selectAt = performance.now()
    poke()
  },
  { immediate: true }
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

.stage-tip {
  position: absolute;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  pointer-events: none;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--glass-strong);
  border: 1px solid var(--border);
  color: var(--t1);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: var(--shadow);
  backdrop-filter: blur(8px);
}

.stage-tip-enter-active,
.stage-tip-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}

.stage-tip-enter-from,
.stage-tip-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.96);
}

/* ── 水墨 ink theme: the hover tip is a little paper tag ────────────────── */
:root[data-theme='ink'] .stage-tip {
  border-radius: 1px;
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  backdrop-filter: none;
  border-color: var(--ink-mount-line);
  box-shadow:
    0 0 0 2px var(--ink-silk),
    var(--shadow-sm);
  font-family: var(--font-ink-label);
  font-size: 13px;
}
</style>
