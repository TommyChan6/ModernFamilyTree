<template>
  <div
    ref="rootEl"
    class="aura-stage"
    :class="{ 'is-flat': !gl }"
    :style="{ '--aura-c': look.color, height: height + 'px' }"
    role="img"
    :aria-label="t('auras.preview.sample', { noun: noun })"
  >
    <canvas v-show="gl" ref="canvasEl" class="as-gl"></canvas>
    <div v-if="!gl" class="as-fallback" aria-hidden="true">
      <span class="as-fb-node"><UiIcon :name="ornIcon" :size="26" /></span>
      <i class="as-fb-line"></i>
    </div>
    <span class="as-cap"
      ><i class="as-live" aria-hidden="true"></i>{{ t('auras.preview.label') }}</span
    >
    <button
      v-if="gl && !reduced"
      type="button"
      class="as-replay"
      :title="t('auras.preview.replay')"
      :aria-label="t('auras.preview.replay')"
      @click="replay"
    >
      <UiIcon name="rotate-ccw" :size="13" />
    </button>
  </div>
</template>

<script setup>
// The live preview of one aura: a sample node wearing the ornament, with a
// short lifeline running down from it in the aura's line effect — drawn by
// the SAME NodeLayer / LifelineLayer the graph and timeline use, so what you
// see is what the views will draw. One small WebGL context, paused while
// off-screen, a single still frame under reduced motion, released on unmount.
import * as THREE from 'three'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMainStore } from '../../store/index.js'
import { useI18n } from '../../i18n'
import UiIcon from '../ui/UiIcon.js'
import { NodeLayer } from '../graph/webgl/NodeLayer.js'
import { auraShaderId, nodeShapeId } from '../graph/webgl/NodeMaterial.js'
import { shapeAnchor } from '../graph/webgl/nodeShapes.js'
import { lineFxSpec } from '../graph/webgl/lineFx.js'
import { LifelineLayer, lifelineStyleInfo } from '../timeline/LifelineLayer.js'
import { nounLabel } from '../../lib/dataLabels'
import { hexToRgb01, lookOf, ornamentMeta } from './auraCatalog.js'

const props = defineProps({
  /** { ornament, color, line, tint } */
  aura: { type: Object, required: true },
  /** Ornament strength 0..1 (scaled trait rules). */
  strength: { type: Number, default: 1 },
  height: { type: Number, default: 150 }
})

const store = useMainStore()
const { t } = useI18n()

const rootEl = ref(null)
const canvasEl = ref(null)
const gl = ref(true)
const reduced = ref(!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
const look = computed(() => lookOf(props.aura))
const ornIcon = computed(() => ornamentMeta(look.value.ornament).icon)
const noun = computed(() => nounLabel(store.noun).toLowerCase())

// Same person glyph the avatar atlas bakes into layer 0 (AvatarAtlas.js).
const PERSON_PATH =
  'M12 12.5c2.49 0 4.5-2.01 4.5-4.5S14.49 3.5 12 3.5 7.5 5.51 7.5 8s2.01 4.5 4.5 4.5zm0 2.25c-3 0-9 1.51-9 4.5V22h18v-2.75c0-2.99-6-4.5-9-4.5z'
const NODE_R = 21

let renderer = null
let scene = null
let camera = null
let nodes = null
let lines = null
let silhouette = null
let raf = 0
let onScreen = true
let width = 0
let born = -1e4
let igniteTimer = 0
let io = null
let ro = null
let mql = null
const t0 = performance.now()
const _c = new THREE.Color()

function nowSec() {
  return (performance.now() - t0) / 1000
}

/** A one-layer array texture holding just the silhouette (layer 0) — the
 *  full avatar atlas would allocate ~19 MB for a single sample node. */
function makeSilhouette() {
  const T = 64
  const r = T / 2
  const c = document.createElement('canvas')
  c.width = c.height = T
  const g = c.getContext('2d', { willReadFrequently: true })
  g.translate(r, r)
  const s = r * 0.12
  g.translate(-12 * s, -r * 0.22 - 8 * s)
  g.scale(s, s)
  g.fillStyle = '#ffffff'
  g.fill(new Path2D(PERSON_PATH))
  const data = new Uint8Array(g.getImageData(0, 0, T, T).data)
  const tex = new THREE.DataArrayTexture(data, T, T, 1)
  tex.format = THREE.RGBAFormat
  tex.type = THREE.UnsignedByteType
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

/** A CSS token as [r, g, b] 0..1 (read live, so every theme works). */
function tokenRgb(name, fallback) {
  const el = rootEl.value
  const v = el ? getComputedStyle(el).getPropertyValue(name).trim() : ''
  try {
    _c.set(fallback)
    if (v) _c.setStyle(v)
  } catch {
    _c.set(fallback)
  }
  return [_c.r, _c.g, _c.b]
}

function init() {
  const canvas = canvasEl.value
  if (!canvas) return
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power'
    })
  } catch {
    renderer = null
  }
  // The node shader is GLSL 3 — no WebGL2, no live preview (the flat
  // fallback still shows the ornament's icon in its colour).
  if (!renderer || !renderer.capabilities.isWebGL2) {
    renderer?.dispose()
    renderer = null
    gl.value = false
    return
  }
  renderer.setClearColor(0x000000, 0)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  renderer.setPixelRatio(dpr)
  scene = new THREE.Scene()
  camera = new THREE.OrthographicCamera(0, 1, 0, 1, 0.1, 1000)
  camera.position.z = 100
  silhouette = makeSilhouette()
  nodes = new NodeLayer({ atlasTexture: silhouette, pixelRatio: dpr })
  nodes.mesh.renderOrder = 5
  nodes.setCount(1)
  lines = new LifelineLayer({ renderOrder: 3 })
  lines.setCount(1)
  scene.add(lines.object3d, nodes.object3d)
  canvas.addEventListener('webglcontextlost', onContextLost)
}

function onContextLost(e) {
  e.preventDefault()
  stop()
}

function resize() {
  if (!renderer || !rootEl.value) return
  width = Math.max(1, rootEl.value.clientWidth)
  const h = props.height
  renderer.setSize(width, h, false)
  camera.left = 0
  camera.right = width
  camera.top = 0
  camera.bottom = h
  camera.updateProjectionMatrix()
  writeScene()
}

/** Write the sample's geometry + style (cheap: one node, one lifeline). */
function writeScene() {
  if (!renderer || !width) return
  const gs = store.graphSettings
  const a = look.value
  const h = props.height
  const auraRGB = hexToRgb01(a.color)
  const shape = gs.nodeShape || 'circle'
  const lift = shapeAnchor(shape).lift || 0
  const cx = width / 2
  const cy = h * 0.42 + (lift > 0 ? NODE_R * 0.9 : 0)

  nodes.material.uniforms.uShape.value = nodeShapeId(shape)
  nodes.setView(width, h, 1, lift, 0)
  nodes.setThemeUniforms(store.isLightTheme)

  // The sample wears the shared palette's colour (a neutral token without one).
  const personRGB = gs.femaleColor ? hexToRgb01(gs.femaleColor) : tokenRgb('--t3', '#8792b3')
  const surface = tokenRgb('--surface', '#181c27')
  nodes.setPosition(0, cx, cy)
  nodes.setStyle(0, {
    radius: NODE_R,
    fill: personRGB,
    border: a.tint ? auraRGB : surface,
    borderPx: a.tint ? 3.5 : 2.5,
    borderA: 1,
    opacity: 1,
    selected: false,
    glow: 0,
    avatar: 0,
    auraId: auraShaderId(a.ornament),
    auraK: Math.max(0.05, Math.min(1, props.strength)),
    auraBorn: reduced.value ? -1e4 : born,
    auraRGB
  })
  nodes.commitPositions()
  nodes.commitStyles()

  // The lifeline: in the line effect (birth → down), else a plain line in
  // the tint (or the person's colour).
  const info = lifelineStyleInfo(a.line === 'none' ? 'classic' : a.line)
  const fx = a.line !== 'none'
  const lw = fx ? Math.max(7, lineFxSpec(a.line).body) : 5
  const lineRGB = a.tint ? auraRGB : personRGB
  lines.set(0, cx, cy, cx, h + 40, lw, lineRGB, 0.92, info.n, info.pad, 0.37, 0)
  lines.commit()
  lines.setFx({ speed: reduced.value ? 0 : 1, glow: 1, light: store.isLightTheme })
  lines.material.uniforms.uFxKeep.value = a.tint ? 1 : 0
  kick()
}

function frame() {
  raf = 0
  if (!renderer) return
  // Reduced motion: one settled still (ornament fully lit, nothing moving).
  const time = reduced.value ? 2.4 : nowSec()
  const u = nodes.material.uniforms
  u.uTime.value = time
  u.uDecorTime.value = time
  lines.setTime(time)
  renderer.render(scene, camera)
  if (!reduced.value && onScreen && !document.hidden) raf = requestAnimationFrame(frame)
}

function kick() {
  if (!renderer || raf) return
  raf = requestAnimationFrame(frame)
}
function stop() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}

/** Ignite the ornament again: the shockwave rolls off the rim. */
function ignite() {
  if (reduced.value) return
  born = nowSec()
  writeScene()
}
function replay() {
  ignite()
}

// A new ornament ignites at once; a colour being dragged re-ignites once it
// settles (the colour itself follows the drag live).
watch(
  () => look.value.ornament,
  () => ignite()
)
watch(
  () => look.value.color,
  () => {
    writeScene()
    clearTimeout(igniteTimer)
    igniteTimer = setTimeout(ignite, 280)
  }
)
watch(
  () => [look.value.line, look.value.tint, props.strength, props.height],
  (now, before) => (now[3] !== before?.[3] ? resize() : writeScene())
)
// Theme / palette / node shape changes repaint the sample (tokens are read
// after the theme's CSS has applied).
watch(
  () => [store.theme, store.graphSettings.nodeShape, store.graphSettings.femaleColor],
  () => requestAnimationFrame(writeScene)
)

function onVisibility() {
  if (!document.hidden) kick()
}
function onMotionChange(e) {
  reduced.value = e.matches
  writeScene()
}

onMounted(() => {
  init()
  if (!renderer) return
  resize()
  ignite()
  io = new IntersectionObserver((entries) => {
    onScreen = entries.some((e) => e.isIntersecting)
    if (onScreen) kick()
    else stop()
  })
  io.observe(rootEl.value)
  ro = new ResizeObserver(() => resize())
  ro.observe(rootEl.value)
  document.addEventListener('visibilitychange', onVisibility)
  mql = window.matchMedia?.('(prefers-reduced-motion: reduce)') || null
  mql?.addEventListener?.('change', onMotionChange)
})

onBeforeUnmount(() => {
  stop()
  clearTimeout(igniteTimer)
  io?.disconnect()
  ro?.disconnect()
  document.removeEventListener('visibilitychange', onVisibility)
  mql?.removeEventListener?.('change', onMotionChange)
  canvasEl.value?.removeEventListener('webglcontextlost', onContextLost)
  nodes?.dispose()
  lines?.dispose()
  silhouette?.dispose()
  if (renderer) {
    renderer.dispose()
    // Release the context now, not at GC: cards expand/collapse freely.
    renderer.forceContextLoss()
  }
  renderer = scene = camera = nodes = lines = silhouette = null
})

defineExpose({ replay })
</script>

<style scoped>
.aura-stage {
  position: relative;
  flex: none;
  overflow: hidden;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  /* the stage: the app's own ground, a faint dot grid and a pool of the
     aura's colour under the sample */
  background:
    radial-gradient(
      60% 70% at 50% 42%,
      color-mix(in srgb, var(--aura-c) 16%, transparent),
      transparent 72%
    ),
    radial-gradient(circle at 1px 1px, var(--border-strong) 1px, transparent 1.4px) 0 0 / 16px 16px,
    linear-gradient(180deg, var(--surface), var(--bg));
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--t1) 6%, transparent);
  transition: background var(--dur-slow) ease;
}
.as-gl {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.as-cap {
  position: absolute;
  left: 8px;
  top: 7px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface) 78%, transparent);
  border: 1px solid var(--border);
  color: var(--t2);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  pointer-events: none;
}
.as-live {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--aura-c);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--aura-c) 60%, transparent);
  animation: as-live 1.8s var(--ease-out) infinite;
}
@keyframes as-live {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--aura-c) 60%, transparent);
  }
  100% {
    box-shadow: 0 0 0 7px color-mix(in srgb, var(--aura-c) 0%, transparent);
  }
}
.as-replay {
  position: absolute;
  right: 7px;
  top: 7px;
  display: grid;
  place-items: center;
  width: var(--ctl-xs);
  height: var(--ctl-xs);
  padding: 0;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 78%, transparent);
  color: var(--t2);
  cursor: pointer;
  transition:
    color var(--dur) ease,
    transform 0.4s var(--ease-spring);
}
.as-replay:hover {
  color: var(--t1);
  transform: rotate(-90deg);
}

/* no WebGL2: a still of the idea, in CSS */
.as-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  justify-items: center;
  align-content: start;
  padding-top: 38px;
}
.as-fb-node {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  color: var(--aura-c);
  background: var(--elevated);
  border: 2px solid var(--aura-c);
  box-shadow: 0 0 22px color-mix(in srgb, var(--aura-c) 45%, transparent);
  position: relative;
  z-index: 1;
}
.as-fb-line {
  width: 5px;
  height: 120px;
  margin-top: -4px;
  border-radius: 3px;
  background: linear-gradient(180deg, var(--aura-c), transparent);
}

@media (prefers-reduced-motion: reduce) {
  .as-live {
    animation: none;
  }
}
</style>
