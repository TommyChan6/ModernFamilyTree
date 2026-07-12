<template>
  <div ref="containerEl" class="space3d">
    <canvas ref="glCanvasEl" class="space3d-gl"></canvas>
    <canvas ref="overlayEl" class="space3d-overlay"></canvas>

    <div class="space3d-badge" :class="{ 'space3d-badge-hidden': store.cleanView }">
      <span class="badge-flask">🧪</span> Experimental · Space
    </div>

    <!-- Star chart: top-down radar over the x/z ground plane. The camera shows
         as an accent eye with its field-of-view cone aimed at the orbit-target
         reticle; dragging slides both across the ground plane. -->
    <MiniMap
      v-if="store.persons.length"
      ref="minimapRef"
      class="space3d-map"
      :class="{ 'space3d-map-hidden': store.cleanView }"
      :adapter="minimapAdapter"
      :width="150"
      :height="150"
    />

    <!-- Controls hints / tutorial card -->
    <Transition name="hints">
      <div v-if="helpOpen" class="hints-scrim" @click.self="closeHelp">
        <div class="hints-card">
          <button class="hints-close" title="Close" @click="closeHelp">✕</button>
          <div class="hints-emblem">🪐</div>
          <div class="hints-title">Navigating Space</div>
          <div class="hints-sub">
            Your tree in three dimensions — the same people and lines, one more axis. Controls
            follow the usual 3D conventions:
          </div>
          <div class="hints-cols">
            <div class="hints-col">
              <div class="hints-col-label">Mouse</div>
              <div class="hint-row"><kbd>Left-drag</kbd><span>Orbit around the family</span></div>
              <div class="hint-row"><kbd>Right-drag</kbd><span>Pan sideways</span></div>
              <div class="hint-row"><kbd>Scroll</kbd><span>Zoom in / out</span></div>
              <div class="hint-row"><kbd>Drag person</kbd><span>Move them in space</span></div>
              <div class="hint-row"><kbd>Click</kbd><span>Select a person or line</span></div>
              <div class="hint-row"><kbd>Dbl-click</kbd><span>Fly to a person</span></div>
            </div>
            <div class="hints-col">
              <div class="hints-col-label">Keys</div>
              <div class="hint-row"><kbd>F</kbd><span>Frame everything</span></div>
              <div class="hint-row"><kbd>R</kbd><span>Auto-rotate on / off</span></div>
              <div class="hint-row"><kbd>G</kbd><span>Generation layers</span></div>
              <div class="hint-row"><kbd>?</kbd><span>Show these hints</span></div>
            </div>
          </div>
          <div class="hints-tip">
            Tip: <strong>Generation layers</strong> (≡ in the toolbar) stacks each generation on its
            own floor — oldest on top.
          </div>
          <button class="hints-gotit" @click="closeHelp">Got it</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import * as d3 from 'd3'
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force-3d'
import { useMainStore } from '../store/index.js'
import { api } from '../api'
import {
  nodeColor,
  getLinkStroke,
  getLinkWidth,
  getLinkEmphOpacity,
  getLinkMarker,
  getDashArray
} from './graph/linkHelpers.js'
import { Graph3DRenderer } from './graph/graph3d/Graph3DRenderer.js'
import {
  seedPositions3D,
  computePivot2D,
  to2DPosition,
  layeredTargets,
  hashUnit
} from './graph/graph3d/layout3D.js'
import { withAlpha } from './webgl/overlayUtils.js'
import MiniMap from './MiniMap.vue'

const props = defineProps({
  sceneId: { type: String, default: null },
  working: { type: Object, default: null }, // the scene's live working copy {positions, config}
  searchQuery: { type: String, default: '' }
})
const emit = defineEmits(['persist'])

const store = useMainStore()
const containerEl = ref(null)
const glCanvasEl = ref(null)
const overlayEl = ref(null)
const helpOpen = ref(false)
const autoRotateOn = ref(false)
const layeredOn = ref(false)

// ── Non-reactive hot state (same philosophy as GraphCanvas's ctx) ────────────
let renderer = null
let sim = null
let nodes3d = []
let links3d = []
let pivot = { x: 0, y: 0 }
// The scene this instance is currently arranged for. writeBack() always
// targets these — props may already point at the NEXT scene by the time a
// switch/unmount flushes the old arrangement.
let boundWorking = null
let boundSceneId = null
let hoverId = null
let drag = null // { node, moved, downX, downY, grab: {dx,dy,dz} }
let pending = null // potential empty-space / line click
let layerTween = null // d3.timer for the layered-y transition
let resizeObserver = null

function gs() {
  return store.graphSettings
}

// ── Star-chart minimap (radar over the x/z ground plane) ────────────────────
// There is no screen rectangle to draw in 3D, so the viewport becomes the
// camera itself: an eye dot with its field-of-view cone aimed at the orbit
// target's reticle. The "view rect" the shared MiniMap needs for framing and
// drag targeting is the ground footprint the camera covers at its distance.
const minimapRef = ref(null)

let radarRaf = 0
function radarPan(wx, wz, smooth) {
  if (!renderer) return
  if (radarRaf) {
    cancelAnimationFrame(radarRaf)
    radarRaf = 0
  }
  const apply = (dx, dz) => {
    renderer.controls.target.x += dx
    renderer.controls.target.z += dz
    renderer.camera.position.x += dx
    renderer.camera.position.z += dz
    renderer.controls.update()
    renderer.requestRedraw()
    minimapRef.value?.redraw()
  }
  const dx = wx - renderer.controls.target.x
  const dz = wz - renderer.controls.target.z
  if (!smooth) {
    apply(dx, dz)
    return
  }
  const t0 = performance.now()
  const ms = 260
  let done = 0
  const ease = (t) => 1 - Math.pow(1 - t, 3)
  const step = (now) => {
    const e = ease(Math.min(1, (now - t0) / ms))
    apply(dx * (e - done), dz * (e - done))
    done = e
    radarRaf = e < 1 ? requestAnimationFrame(step) : 0
  }
  radarRaf = requestAnimationFrame(step)
}

const minimapAdapter = {
  getBounds: () => {
    if (!nodes3d.length) return null
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity
    for (const n of nodes3d) {
      const z = n.z || 0
      if (n.x < minX) minX = n.x
      if (n.x > maxX) maxX = n.x
      if (z < minY) minY = z
      if (z > maxY) maxY = z
    }
    // Keep the camera's ground position on the chart so the cone never clips out.
    if (renderer) {
      const c = renderer.camera.position
      minX = Math.min(minX, c.x)
      maxX = Math.max(maxX, c.x)
      minY = Math.min(minY, c.z)
      maxY = Math.max(maxY, c.z)
    }
    return { minX, minY, maxX, maxY }
  },
  getView: () => {
    if (!renderer) return null
    const cam = renderer.camera
    const tgt = renderer.controls.target
    const r = cam.position.distanceTo(tgt) * Math.tan((cam.fov * Math.PI) / 360)
    return { x: tgt.x - r * cam.aspect, y: tgt.z - r, w: 2 * r * cam.aspect, h: 2 * r }
  },
  drawContent: (g, proj, colors) => {
    const sel = store.selectedPersonId
    let selNode = null
    g.fillStyle = withAlpha(colors.t2, 0.6)
    for (const n of nodes3d) {
      if (n.id === sel) {
        selNode = n
        continue
      }
      g.fillRect(n.x * proj.sx + proj.ox - 1, (n.z || 0) * proj.sy + proj.oy - 1, 2, 2)
    }
    if (selNode) {
      g.fillStyle = colors.accent
      g.beginPath()
      g.arc(
        selNode.x * proj.sx + proj.ox,
        (selNode.z || 0) * proj.sy + proj.oy,
        2.5,
        0,
        Math.PI * 2
      )
      g.fill()
    }
  },
  drawViewport: (g, proj, colors) => {
    if (!renderer) return
    const cam = renderer.camera
    const camX = cam.position.x * proj.sx + proj.ox
    const camY = cam.position.z * proj.sy + proj.oy
    const tgtX = renderer.controls.target.x * proj.sx + proj.ox
    const tgtY = renderer.controls.target.z * proj.sy + proj.oy
    const ang = Math.atan2(tgtY - camY, tgtX - camX)
    const reach = Math.max(18, Math.hypot(tgtX - camX, tgtY - camY) * 1.25)
    const half = Math.min(1.15, ((cam.fov * Math.PI) / 360) * cam.aspect)
    // Field-of-view cone
    g.beginPath()
    g.moveTo(camX, camY)
    g.arc(camX, camY, reach, ang - half, ang + half)
    g.closePath()
    g.fillStyle = withAlpha(colors.accent, 0.1)
    g.fill()
    g.strokeStyle = withAlpha(colors.accent, 0.35)
    g.lineWidth = 1
    g.stroke()
    // Camera eye
    g.beginPath()
    g.arc(camX, camY, 3, 0, Math.PI * 2)
    g.fillStyle = colors.accent
    g.fill()
    // Orbit-target reticle
    g.beginPath()
    g.arc(tgtX, tgtY, 4, 0, Math.PI * 2)
    g.strokeStyle = withAlpha(colors.accent, 0.85)
    g.lineWidth = 1.2
    g.stroke()
    g.beginPath()
    g.arc(tgtX, tgtY, 1.2, 0, Math.PI * 2)
    g.fillStyle = withAlpha(colors.accent, 0.85)
    g.fill()
  },
  panTo: (wx, wz, opts) => radarPan(wx, wz, !!opts?.smooth),
  onDragEnd: () => writeBack()
}

// ── Visual descriptors (selection, hover glow, search dim — reused by draw) ──
function nodeVisual(n) {
  const g = gs()
  const selected = store.selectedPersonId === n.id
  const fill = selected
    ? d3.color(nodeColor(n.gender, g))?.brighter(0.4)?.toString() || nodeColor(n.gender, g)
    : nodeColor(n.gender, g)
  let opacityMul = 1
  const q = (props.searchQuery || '').toLowerCase().trim()
  if (q && !(n.name || '').toLowerCase().includes(q)) opacityMul *= 0.15
  return {
    radius: g.nodeRadius * (selected ? 1.08 : 1),
    fill,
    border: selected ? '#6c8ef5' : '#ffffff',
    borderPx: selected ? 3 : 1.5,
    borderA: selected ? 0.95 : 0.25,
    opacity: g.nodeOpacity * opacityMul,
    selected,
    glow: selected || (hoverId === n.id && g.glowOnHover) ? 1 : 0,
    imageUrl: n.primary_image ? api.getImageUrl(n.primary_image) : null
  }
}

function linkVisual(d) {
  const g = gs()
  const persons = store.persons
  const colorHex = getLinkStroke(d, 'neutral', g, persons)
  const width = getLinkWidth(d, 'neutral', g, persons)
  const opacity = getLinkEmphOpacity(d, 'neutral', g, persons)
  const dashStr = getDashArray(d)
  let dashLen = 0,
    dashGap = 0
  if (dashStr) {
    const p = dashStr.split(',').map(Number)
    dashLen = p[0]
    dashGap = p[1]
  }
  const marker = getLinkMarker(d, 'neutral', persons)
  return {
    colorHex,
    width,
    opacity,
    dashLen,
    dashGap,
    arrowColor: marker ? (d.type === 'adopted' ? g.adoptedColor : g.parentChildColor) : null,
    arrowSize: 9
  }
}

function ageOf(p) {
  if (!p.birth?.year) return null
  const refYear = store.currentDate?.year ?? new Date().getFullYear()
  const endYear = p.death?.year ? Math.min(p.death.year, refYear) : refYear
  const age = endYear - p.birth.year
  return age >= 0 ? age : null
}

// ── Simulation ───────────────────────────────────────────────────────────────
function buildSim() {
  const g = gs()
  sim = forceSimulation([], 3)
    .force(
      'link',
      forceLink()
        .id((d) => d.id)
        .distance(g.linkDistance)
        .strength(0.35)
    )
    .force(
      'charge',
      forceManyBody()
        .strength(g.chargeStrength * 1.05)
        .distanceMax(2200)
    )
    .force('center', forceCenter(0, 0, 0))
    .force('collide', forceCollide(g.nodeRadius + 24))
    .alpha(0)
    .on('tick', () => {
      renderer?.requestRedraw()
      minimapRef.value?.redraw()
    })
    .on('end', () => {
      if (layeredOn.value) syncLayerDiscs()
    })
}

/** Reconcile nodes3d/links3d with the store (keeps live node objects warm). */
function syncData() {
  const byId = new Map(nodes3d.map((n) => [n.id, n]))
  const saved = boundWorking?.positions || {}
  const seeded = seedPositions3D(store.persons, saved, { pivot })
  const next = store.persons.map((p) => {
    const existing = byId.get(p.id)
    if (existing) return Object.assign(existing, p)
    // New person: spawn near a connected node when possible, else the seed.
    const rel = store.relationships.find((r) => r.person_a_id === p.id || r.person_b_id === p.id)
    let pos = seeded[p.id]
    if (rel) {
      const other = byId.get(rel.person_a_id === p.id ? rel.person_b_id : rel.person_a_id)
      if (other) {
        pos = {
          x: other.x + hashUnit(p.id + ':a') * 40,
          y: other.y + hashUnit(p.id + ':b') * 40,
          z: (other.z || 0) + hashUnit(p.id + ':c') * 40
        }
      }
    }
    return { ...p, x: pos.x, y: pos.y, z: pos.z, vx: 0, vy: 0, vz: 0 }
  })
  const hadNew = next.length > nodes3d.length
  nodes3d = next
  links3d = store.relationships.map((r) => ({ ...r, source: r.person_a_id, target: r.person_b_id }))
  if (hoverId && !next.some((n) => n.id === hoverId)) hoverId = null
  if (drag && !next.includes(drag.node)) drag = null
  sim.nodes(nodes3d)
  sim.force('link').links(links3d)
  renderer?.setData(nodes3d, links3d)
  minimapRef.value?.redraw()
  if (nodes3d.length) sim.alpha(hadNew ? 0.25 : 0.08).restart()
}

// ── Scene entry / persistence ────────────────────────────────────────────────
function enterScene() {
  cancelLayerTween()
  boundWorking = props.working
  boundSceneId = props.sceneId
  const saved = boundWorking?.positions || {}
  pivot = computePivot2D(store.persons, saved)
  nodes3d = []
  const cfg = boundWorking?.config?.space || {}
  layeredOn.value = !!cfg.layered
  autoRotateOn.value = !!cfg.autoRotate
  renderer.setAutoRotate(autoRotateOn.value)
  syncData()
  if (layeredOn.value && nodes3d.length) applyLayers(true)
  else renderer.hideLayers()
  // Camera: restore the saved one, else frame the whole tree.
  if (cfg.camera?.pos && cfg.camera?.target) {
    renderer.camera.position.fromArray(cfg.camera.pos)
    renderer.controls.target.fromArray(cfg.camera.target)
    renderer.controls.update()
    renderer.requestRedraw()
  } else {
    renderer.fitAll(true)
  }
}

function writeBack() {
  if (!boundWorking || !nodes3d.length || !renderer) return
  const snap = {}
  nodes3d.forEach((n) => {
    snap[n.id] = to2DPosition(n, pivot)
  })
  boundWorking.positions = snap
  boundWorking.config = {
    ...boundWorking.config,
    space: {
      camera: {
        pos: renderer.camera.position.toArray(),
        target: renderer.controls.target.toArray()
      },
      layered: layeredOn.value,
      autoRotate: autoRotateOn.value
    }
  }
  emit('persist', boundSceneId)
}

// ── Generation layers ────────────────────────────────────────────────────────
function layerSpacing() {
  return Math.max(150, gs().linkDistance * 1.15)
}

function cancelLayerTween() {
  if (layerTween) {
    layerTween.stop()
    layerTween = null
  }
}

function syncLayerDiscs() {
  if (!nodes3d.length) return
  const { layers } = layeredTargets(nodes3d, store.relationships, layerSpacing())
  let cx = 0,
    cz = 0
  nodes3d.forEach((n) => {
    cx += n.x
    cz += n.z || 0
  })
  cx /= nodes3d.length
  cz /= nodes3d.length
  let maxR = 0
  nodes3d.forEach((n) => {
    const dx = n.x - cx,
      dz = (n.z || 0) - cz
    maxR = Math.max(maxR, Math.hypot(dx, dz))
  })
  renderer.setLayers(layers, { x: cx, z: cz }, maxR + 150, layeredOn.value)
}

function applyLayers(immediate = false) {
  cancelLayerTween()
  if (!nodes3d.length) return
  const { yOf } = layeredTargets(nodes3d, store.relationships, layerSpacing())
  if (immediate) {
    nodes3d.forEach((n) => {
      n.y = yOf[n.id] ?? 0
      n.fy = n.y
    })
    syncLayerDiscs()
    renderer.requestRedraw()
    return
  }
  // Smooth descent onto the layer floors, then pin y and relax x/z.
  sim.stop()
  const startY = new Map(nodes3d.map((n) => [n.id, n.y]))
  const duration = 700
  const ease = d3.easeCubicInOut
  layerTween = d3.timer((elapsed) => {
    const t = Math.min(1, ease(elapsed / duration))
    nodes3d.forEach((n) => {
      const s = startY.get(n.id) ?? 0
      const e = yOf[n.id] ?? 0
      n.y = s + (e - s) * t
    })
    renderer.requestRedraw()
    if (t >= 1) {
      layerTween.stop()
      layerTween = null
      nodes3d.forEach((n) => {
        n.fy = yOf[n.id] ?? 0
      })
      sim.alpha(0.35).restart()
    }
  })
  syncLayerDiscs()
}

function releaseLayers() {
  cancelLayerTween()
  nodes3d.forEach((n) => {
    n.fy = null
  })
  renderer.hideLayers()
  sim.alpha(0.3).restart()
}

function toggleLayers() {
  layeredOn.value = !layeredOn.value
  if (layeredOn.value) applyLayers(false)
  else releaseLayers()
  writeBack()
}

function toggleAutoRotate() {
  autoRotateOn.value = !autoRotateOn.value
  renderer.setAutoRotate(autoRotateOn.value)
  writeBack()
}

// ── Toolbar verbs (called from GraphCanvas's tool pill via ref) ──────────────
function dollyIn() {
  renderer?.dollyBy(0.72)
}
function dollyOut() {
  renderer?.dollyBy(1.38)
}
function fitAll() {
  renderer?.fitAll()
}
function resetView() {
  renderer?.resetView()
}
function refreshLayout() {
  if (!nodes3d.length) return
  if (layeredOn.value) applyLayers(false)
  else sim.alpha(0.5).restart()
}
function openHelp() {
  helpOpen.value = true
}
function closeHelp() {
  helpOpen.value = false
  if (!store.spaceHintSeen) store.markSpaceHintSeen()
}

defineExpose({
  dollyIn,
  dollyOut,
  fitAll,
  resetView,
  refreshLayout,
  toggleAutoRotate,
  toggleLayers,
  openHelp,
  writeBack,
  autoRotateOn,
  layeredOn
})

// ── Pointer interaction ──────────────────────────────────────────────────────
// OrbitControls owns orbit/pan/dolly on the overlay canvas. A node drag must
// win over an orbit, so the pointerdown is intercepted on the PARENT container
// in the capture phase (which runs before any listener on the canvas itself)
// and stopped there when it lands on a draggable node.
function localXY(e) {
  const rect = overlayEl.value.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function onPointerDownCapture(e) {
  if (e.button !== 0) return
  const p = localXY(e)
  const node = renderer.pickNode(p.x, p.y, gs().nodeRadius)
  if (node && !store.lockNodes) {
    e.stopPropagation() // this gesture is a node drag — keep it from OrbitControls
    const hit = renderer.dragPoint(p.x, p.y, node, layeredOn.value)
    drag = {
      node,
      moved: false,
      downX: e.clientX,
      downY: e.clientY,
      grab: hit
        ? { dx: hit.x - node.x, dy: hit.y - node.y, dz: hit.z - (node.z || 0) }
        : { dx: 0, dy: 0, dz: 0 }
    }
    try {
      containerEl.value.setPointerCapture(e.pointerId)
    } catch {
      /* pointer capture is best-effort */
    }
    sim.alphaTarget(0.25).restart()
    node.fx = node.x
    node.fy = node.y
    node.fz = node.z || 0
  } else {
    pending = { downX: e.clientX, downY: e.clientY, x: p.x, y: p.y, moved: false }
  }
}

function onPointerMove(e) {
  if (drag) {
    if (!drag.moved && Math.hypot(e.clientX - drag.downX, e.clientY - drag.downY) > 3)
      drag.moved = true
    const p = localXY(e)
    const hit = renderer.dragPoint(p.x, p.y, drag.node, layeredOn.value)
    if (hit) {
      drag.node.fx = hit.x - drag.grab.dx
      drag.node.fz = hit.z - drag.grab.dz
      if (!layeredOn.value) drag.node.fy = hit.y - drag.grab.dy
    }
  } else if (pending) {
    if (Math.hypot(e.clientX - pending.downX, e.clientY - pending.downY) > 3) pending.moved = true
  }
}

function onPointerUp() {
  if (drag) {
    const node = drag.node
    sim.alphaTarget(0)
    if (!drag.moved) {
      // A press without movement is a click → select.
      if (!store.lockNodes) {
        store.relPopup = null
        store.selectPerson(node.id)
      }
    }
    node.fx = null
    node.fz = null
    if (!layeredOn.value) node.fy = null
    if (drag.moved) writeBack()
    drag = null
    return
  }
  if (pending && !pending.moved) {
    const link = store.lockLines ? null : renderer.pickLink(pending.x, pending.y, 8)
    if (link) {
      store.relPopup = { rel: link, x: pending.x, y: pending.y - 10 }
    } else {
      store.selectPerson(null)
      store.relPopup = null
    }
  }
  pending = null
}

function onHoverMove(e) {
  if (drag) return
  const p = localXY(e)
  const node = renderer.pickNode(p.x, p.y, gs().nodeRadius)
  const id = node ? node.id : null
  if (id !== hoverId) {
    hoverId = id
    overlayEl.value.style.cursor = id ? 'grab' : ''
    renderer.markNodeStylesDirty()
    renderer.requestRedraw()
  }
}

function onDblClick(e) {
  const p = localXY(e)
  const node = renderer.pickNode(p.x, p.y, gs().nodeRadius)
  if (node) {
    renderer.flyToNode(node, gs().nodeRadius)
    if (!store.lockNodes) store.selectPerson(node.id)
  }
}

function onKeydown(e) {
  const t = e.target
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  if (e.ctrlKey || e.metaKey || e.altKey) return
  const k = e.key.toLowerCase()
  if (k === 'escape' && helpOpen.value) {
    closeHelp()
  } else if (k === 'f') {
    fitAll()
  } else if (k === 'r') {
    toggleAutoRotate()
  } else if (k === 'g') {
    toggleLayers()
  } else if (e.key === '?') {
    if (helpOpen.value) closeHelp()
    else openHelp()
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
  const container = containerEl.value
  const { width, height } = container.getBoundingClientRect()
  renderer = new Graph3DRenderer({
    glCanvas: glCanvasEl.value,
    overlayCanvas: overlayEl.value,
    hooks: {
      getSettings: gs,
      nodeVisual,
      linkVisual,
      overlayOpts: () => ({
        gs: gs(),
        nodes: nodes3d,
        showLabels: gs().showLabels,
        showAge: gs().showAge,
        selectedId: store.selectedPersonId,
        labelOpacityOf: (n) => Math.min(1, nodeVisual(n).opacity),
        ageOf
      })
    }
  })
  renderer.resize(Math.max(width, 1), Math.max(height, 1))
  applyTheme()
  buildSim()
  enterScene()

  // Persist the camera when an orbit/pan/dolly gesture ends.
  renderer.controls.addEventListener('end', writeBack)
  // Any camera motion (orbit, dolly, damping, auto-rotate) moves the radar cone.
  renderer.controls.addEventListener('change', () => minimapRef.value?.redraw())

  container.addEventListener('pointerdown', onPointerDownCapture, true)
  const el = overlayEl.value
  el.addEventListener('pointermove', onHoverMove)
  el.addEventListener('dblclick', onDblClick)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('keydown', onKeydown)

  resizeObserver = new ResizeObserver(() => {
    const r = container.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) renderer.resize(r.width, r.height)
  })
  resizeObserver.observe(container)

  // First visit: introduce the controls once, unprompted.
  if (!store.spaceHintSeen) {
    setTimeout(() => {
      helpOpen.value = true
    }, 650)
  }
})

onUnmounted(() => {
  writeBack()
  if (radarRaf) {
    cancelAnimationFrame(radarRaf)
    radarRaf = 0
  }
  cancelLayerTween()
  sim?.stop()
  resizeObserver?.disconnect()
  containerEl.value?.removeEventListener('pointerdown', onPointerDownCapture, true)
  const el = overlayEl.value
  if (el) {
    el.removeEventListener('pointermove', onHoverMove)
    el.removeEventListener('dblclick', onDblClick)
  }
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('keydown', onKeydown)
  renderer?.dispose()
  renderer = null
})

function applyTheme() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  renderer?.setTheme({ isLight: store.theme === 'light', bg })
}

// ── Watchers ─────────────────────────────────────────────────────────────────
watch(
  [() => store.persons, () => store.relationships],
  () => {
    if (renderer) syncData()
  },
  { deep: true }
)
watch(
  () => props.sceneId,
  () => {
    if (!renderer) return
    writeBack() // flush the outgoing scene (still bound) before re-binding
    enterScene()
  }
)
watch(
  () => props.searchQuery,
  () => {
    renderer?.markNodeStylesDirty()
    renderer?.requestRedraw()
  }
)
watch(
  () => store.selectedPersonId,
  () => {
    renderer?.markNodeStylesDirty()
    renderer?.requestRedraw()
  }
)
watch(
  () => store.theme,
  () => applyTheme()
)
watch(
  () => store.graphSettings,
  () => {
    if (!sim || !renderer) return
    const g = gs()
    sim.force('link').distance(g.linkDistance)
    sim.force('charge').strength(g.chargeStrength * 1.05)
    sim.force('collide').radius(g.nodeRadius + 24)
    if (nodes3d.length) sim.alpha(0.15).restart()
    renderer.markAllDirty()
    renderer.requestRedraw()
  },
  { deep: true }
)
</script>

<style scoped>
.space3d {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.space3d-gl,
.space3d-overlay {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}
.space3d-overlay {
  touch-action: none;
}

/* Experimental badge */
.space3d-badge {
  position: absolute;
  top: 14px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 20px;
  background: var(--glass-soft);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  color: var(--t3);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  z-index: 5;
  box-shadow: var(--shadow);
  transition:
    transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s ease;
  pointer-events: none;
}
.space3d-badge-hidden {
  transform: translateY(calc(-100% - 30px));
  opacity: 0;
}
.badge-flask {
  font-size: 12px;
}

/* Star chart sits under the Experimental badge (compound selector so it
   outweighs the MiniMap's own base styles) */
.mini-map.space3d-map {
  top: 52px;
}
.mini-map.space3d-map-hidden {
  transform: translateX(calc(-100% - 30px));
  opacity: 0;
  pointer-events: none;
}

/* Hints / tutorial card */
.hints-scrim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
}
.hints-card {
  position: relative;
  width: min(480px, calc(100% - 48px));
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 26px 28px 22px;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.hints-emblem {
  font-size: 30px;
  line-height: 1;
}
.hints-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--t1);
}
.hints-sub {
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--t2);
}
.hints-cols {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 8px 20px;
  margin-top: 4px;
}
.hints-col {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.hints-col-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--t3);
  margin-bottom: 2px;
}
.hint-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--t2);
}
.hint-row kbd {
  flex-shrink: 0;
  min-width: 24px;
  text-align: center;
  padding: 3px 7px;
  border-radius: 6px;
  background: var(--elevated);
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  color: var(--t1);
  font-family: var(--font);
  font-size: 10.5px;
  font-weight: 600;
}
.hints-tip {
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--t3);
  background: var(--adim);
  border-radius: 8px;
  padding: 8px 12px;
}
.hints-tip strong {
  color: var(--accent);
  font-weight: 600;
}
.hints-gotit {
  align-self: flex-end;
  padding: 7px 20px;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    filter 0.15s ease;
}
.hints-gotit:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}
.hints-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 26px;
  height: 26px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: var(--t3);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hints-close:hover {
  background: var(--hover);
  color: var(--t1);
}

/* Hints card entrance */
.hints-enter-active {
  transition: opacity 0.25s ease;
}
.hints-enter-active .hints-card {
  transition:
    transform 0.35s cubic-bezier(0.34, 1.3, 0.64, 1),
    opacity 0.25s ease;
}
.hints-leave-active {
  transition: opacity 0.18s ease;
}
.hints-leave-active .hints-card {
  transition:
    transform 0.18s ease,
    opacity 0.18s ease;
}
.hints-enter-from {
  opacity: 0;
}
.hints-enter-from .hints-card {
  transform: translateY(16px) scale(0.94);
  opacity: 0;
}
.hints-leave-to {
  opacity: 0;
}
.hints-leave-to .hints-card {
  transform: scale(0.97);
  opacity: 0;
}
</style>
