<template>
  <div
    ref="rootEl"
    class="board"
    :class="{ light: isLight, 'is-far': lod === 'far' }"
    @pointerdown="onDown"
    @pointermove="onHoverMove"
    @pointerleave="onBoardLeave"
    @wheel.prevent="onWheel"
  >
    <!-- Cork: tiled procedural grain, moved/scaled with the camera by applyCam() -->
    <div ref="corkEl" class="cork" aria-hidden="true"></div>

    <div v-if="!persons.length" class="board-empty">
      <div class="board-empty-card">
        <div class="board-empty-pin"></div>
        <div class="board-empty-title">No leads yet</div>
        <div class="board-empty-text">No people match — clear the search or add someone.</div>
      </div>
    </div>

    <!-- The world: ONE transform for pan/zoom; items only re-render on cull. -->
    <div ref="worldEl" class="world">
      <svg ref="svgEl" class="yarn" width="1" height="1" overflow="visible" aria-hidden="true">
        <g v-for="e in edgeViews" :key="e.key" class="y" :class="e.cls" :style="e.style">
          <path class="y-shadow" :d="e.d" />
          <path class="y-core" :d="e.d" pathLength="1" />
          <path class="y-hi" :d="e.d" />
        </g>
      </svg>

      <div
        v-for="v in polViews"
        :key="v.id"
        class="pol"
        :class="v.cls"
        :data-pid="v.id"
        :style="v.style"
        @pointerenter="onPolEnter(v.id)"
        @pointerleave="onPolLeave(v.id)"
      >
        <div class="pol-in" :style="v.inStyle">
          <div v-if="lod === 'far'" class="pol-far" :style="{ '--pin': v.pin }">
            <i></i>
          </div>
          <PolaroidCard v-else :person="v.p" :dead="v.dead" :pin="v.pin" :tags="v.tags" />

          <svg v-if="v.selected" class="pol-mark" :viewBox="MARK_BOX" aria-hidden="true">
            <path :d="markD(v.id)" pathLength="1" />
          </svg>

          <div
            v-if="v.hover && !v.cls.lifted && lod !== 'far' && caseLines(v.p).length"
            class="pol-case"
          >
            <div v-for="(l, i) in caseLines(v.p)" :key="i" class="pol-case-line">{{ l }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Lighting: a desk-lamp pool that trails the cursor, plus a vignette -->
    <div ref="lampEl" class="lamp" aria-hidden="true"></div>
    <div class="vignette" aria-hidden="true"></div>

    <template v-if="persons.length">
      <div class="board-tag" @pointerdown.stop>
        <span class="board-tag-hole"></span>
        <b>EVIDENCE</b>
        <span>{{ persons.length }} {{ persons.length === 1 ? 'subject' : 'subjects' }}</span>
        <span class="board-tag-sep">·</span>
        <span>{{ edges.length }} {{ edges.length === 1 ? 'string' : 'strings' }}</span>
      </div>

      <div class="board-ui" @pointerdown.stop @wheel.stop.prevent>
        <button class="bu-btn" title="Zoom out" @click="zoomOut">−</button>
        <span ref="zoomText" class="bu-zoom">100%</span>
        <button class="bu-btn" title="Zoom in" @click="zoomIn">+</button>
        <span class="bu-sep"></span>
        <button class="bu-btn bu-wide" title="Fit everyone on screen" @click="fitAnimated">
          ⤢ Fit
        </button>
        <button
          class="bu-btn bu-wide"
          :disabled="!hasMoved"
          title="Put every photo back in its family spot"
          @click="tidyUp"
        >
          ✦ Tidy up
        </button>
      </div>

      <div class="board-hint" :class="{ gone: hintGone }">
        Drag the board to pan · scroll to zoom · drag photos to rearrange
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, nextTick, h } from 'vue'
import { useMainStore } from '../../store/index.js'
import { isDeceased, ageOf } from './peopleLayout.js'
import { useThumbnail } from './useThumbnail.js'
import {
  POL_W,
  POL_H,
  PIN_DY,
  MIN_K,
  MAX_K,
  autoLayout,
  rotationOf,
  yarnPath,
  yarnBox,
  worldRect,
  rectsOverlap,
  rectContains,
  polaroidInRect,
  boundsOf,
  fitCamera,
  zoomAt,
  markerPath,
  sanitizePositions
} from './boardLayout.js'

// The Evidence Board: every person is a polaroid pinned to a corkboard, with
// red yarn strung between relatives. Pan/zoom is ONE transform on the world
// container written straight to the DOM (no reactive churn while panning);
// the reactive part is a culled window of polaroids/strings that is only
// recomputed when the camera leaves the last culled rect. Dragged positions
// are a per-viewer convenience kept in localStorage per project.

const props = defineProps({
  persons: { type: Array, required: true },
  statsOf: { type: Function, required: true },
  refYear: { type: Number, required: true }
})

const store = useMainStore()
const rootEl = ref(null)
const corkEl = ref(null)
const worldEl = ref(null)
const svgEl = ref(null)
const lampEl = ref(null)
const zoomText = ref(null)

const reduceMotion =
  typeof window !== 'undefined' &&
  !!window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const isLight = computed(() => store.isLightTheme)

// ── One polaroid's paper: photo (cached thumbnail) or monogram, handwritten
// caption, DECEASED stamp, tag sticky notes, pushpin. Own component so each
// visible polaroid owns its thumbnail and only re-renders when its props do.
function lifeText(p) {
  const b = p.birth?.year
  const d = p.death?.year
  if (b && d) return `${b} – ${d}`
  if (b) return `b. ${b}`
  if (d) return `d. ${d}`
  return '—'
}
const PolaroidCard = {
  props: {
    person: { type: Object, required: true },
    dead: Boolean,
    pin: { type: String, default: '' },
    tags: { type: Array, default: null }
  },
  setup(pr) {
    const { src } = useThumbnail(() => pr.person.primary_image || '', 192)
    const initials = computed(() => {
      const parts = (pr.person.name || '?').trim().split(/\s+/).filter(Boolean)
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      return (parts[0] || '?').substring(0, 2).toUpperCase()
    })
    return () => {
      const p = pr.person
      const tags = pr.tags ? pr.tags.slice(0, 2) : []
      return h('div', { class: ['pc', { 'pc-dead': pr.dead }], style: { '--pin': pr.pin } }, [
        h('div', { class: 'pc-photo' }, [
          src.value
            ? h('img', { class: 'pc-img', src: src.value, alt: '', draggable: false })
            : h('div', { class: 'pc-mono' }, initials.value),
          h('div', { class: 'pc-gloss' }),
          pr.dead ? h('div', { class: 'pc-stamp' }, 'DECEASED') : null
        ]),
        h('div', { class: 'pc-cap' }, [
          h('div', { class: 'pc-name' }, p.name || 'Unnamed'),
          h('div', { class: 'pc-year' }, lifeText(p))
        ]),
        ...tags.map((t, i) =>
          h(
            'div',
            {
              class: 'pc-note',
              style: { '--nc': t.color || 'var(--amber)', '--ni': i }
            },
            (t.icon ? t.icon + ' ' : '') + (t.label || '')
          )
        ),
        h('div', { class: 'pc-pin' })
      ])
    }
  }
}

const genderColor = (p) =>
  p.gender === 'male'
    ? store.graphSettings.maleColor
    : p.gender === 'female'
      ? store.graphSettings.femaleColor
      : store.graphSettings.unknownColor

// ── Layout: auto (families clustered) + per-viewer overrides ────────────────
// Laid out over the whole project roster so a search/filter only hides
// polaroids — everyone else stays exactly where they were pinned.
const layoutPersons = computed(() => {
  const all = store.persons
  const known = new Set(all.map((p) => p.id))
  const extra = props.persons.filter((p) => !known.has(p.id))
  return extra.length ? all.concat(extra) : all
})
const auto = computed(() =>
  autoLayout(layoutPersons.value, store.relationships, store.relTypeRoles)
)

const overrides = shallowRef({}) // id → {x, y, z}
const hasMoved = computed(() => Object.keys(overrides.value).length > 0)
let savedCam = null

const storageKey = () => 'familytree.board.v1:' + (store.activeProjectId || 'default')
function loadSaved() {
  savedCam = null
  let raw = null
  try {
    raw = JSON.parse(localStorage.getItem(storageKey()) || 'null')
  } catch {
    raw = null
  }
  overrides.value = sanitizePositions(raw?.pos)
  const c = raw?.cam
  if (c && [c.x, c.y, c.k].every(Number.isFinite) && c.k >= MIN_K && c.k <= MAX_K) savedCam = c
}
function persist() {
  try {
    localStorage.setItem(
      storageKey(),
      JSON.stringify({ pos: overrides.value, cam: { x: cam.x, y: cam.y, k: cam.k } })
    )
  } catch {
    /* storage blocked / full — positions are a convenience only */
  }
}
let camSaveTimer = 0
function scheduleCamSave() {
  clearTimeout(camSaveTimer)
  camSaveTimer = setTimeout(persist, 500)
}

const basePos = (id) => overrides.value[id] || auto.value.get(id)

// A glide animates people from `from` positions to wherever basePos now says
// (Tidy up, or the auto layout shifting after a relationship edit).
const glide = shallowRef(null) // { from: Map id → {x,y}, t0 }
const glideT = ref(0)
const GLIDE_MS = 850
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

const drag = ref(null) // { id, x, y } while a polaroid is being dragged
const dragId = ref(null)
const hoverId = ref(null)

function posOf(id) {
  const d = drag.value
  if (d && d.id === id) return d
  const base = basePos(id)
  const g = glide.value
  if (g && base) {
    const f = g.from.get(id)
    if (f) {
      const e = easeInOut(glideT.value)
      return { x: f.x + (base.x - f.x) * e, y: f.y + (base.y - f.y) * e }
    }
  }
  return base
}

// ── Strings ─────────────────────────────────────────────────────────────────
const shownIds = computed(() => new Set(props.persons.map((p) => p.id)))
const edges = computed(() => {
  const ids = shownIds.value
  const pairs = new Map()
  const out = []
  for (const r of store.relationships) {
    const a = r.person_a_id
    const b = r.person_b_id
    if (a === b || !ids.has(a) || !ids.has(b)) continue
    const pk = a < b ? a + '|' + b : b + '|' + a
    const k = pairs.get(pk) || 0
    pairs.set(pk, k + 1)
    const role = store.relTypeRoles.get(r.type) || 'none'
    const def = store.relTypeByKey.get(r.type)
    const color = def?.color || (role === 'horizontal' ? 'var(--yarn-gold)' : 'var(--yarn-red)')
    out.push({ id: r.id, a, b, color, role, slack: 1 + k * 0.5, ended: !!r.ended })
  }
  return out
})
const adjacency = computed(() => {
  const m = new Map()
  const add = (x, y) => {
    let s = m.get(x)
    if (!s) m.set(x, (s = new Set()))
    s.add(y)
  }
  for (const e of edges.value) {
    add(e.a, e.b)
    add(e.b, e.a)
  }
  return m
})
const hotSet = computed(() => {
  const id = hoverId.value
  if (!id) return null
  const s = new Set(adjacency.value.get(id) || [])
  s.add(id)
  return s
})

// ── Camera (plain object — never reactive) ─────────────────────────────────
const cam = { x: 0, y: 0, k: 1 }
let viewW = 0
let viewH = 0
let vel = { x: 0, y: 0 }
let zoomTarget = null // { k, sx, sy }
let camTween = null // { from, to, t0, dur }
const lamp = { x: 0, y: 0, tx: 0, ty: 0, init: false }
let raf = 0
let movingTimer = 0
let swBucket = null

const lod = ref('near')
const cullRect = shallowRef(null)

function applyCam() {
  const w = worldEl.value
  if (w) w.style.transform = `translate3d(${cam.x}px, ${cam.y}px, 0) scale(${cam.k})`
  const c = corkEl.value
  if (c) {
    const s = Math.max(0.6, Math.min(1.7, Math.sqrt(cam.k)))
    c.style.backgroundPosition = `${cam.x}px ${cam.y}px`
    c.style.setProperty('--gs', s.toFixed(3))
  }
  if (zoomText.value) zoomText.value.textContent = Math.round(cam.k * 100) + '%'
  // Yarn keeps a readable on-screen thickness when zoomed far out.
  const bucket = Math.round(Math.log2(cam.k) * 2)
  if (bucket !== swBucket && svgEl.value) {
    swBucket = bucket
    const k = Math.pow(2, bucket / 2)
    svgEl.value.style.setProperty('--sw', Math.max(1, Math.pow(0.85 / k, 0.8)).toFixed(2))
  }
  if (lod.value === 'near' && cam.k < 0.3) lod.value = 'far'
  else if (lod.value === 'far' && cam.k > 0.34) lod.value = 'near'
  maybeRecull()
}

// Compositor hint only while moving — dropping it on settle re-rasterizes crisp.
function markMoving() {
  const w = worldEl.value
  if (!w) return
  w.classList.add('moving')
  clearTimeout(movingTimer)
  movingTimer = setTimeout(() => w.classList.remove('moving'), 160)
}

function maybeRecull(force = false) {
  if (!(viewW > 0) || !(viewH > 0)) return
  const view = worldRect(cam, viewW, viewH)
  const cur = cullRect.value
  if (!force && cur && rectContains(cur, view)) {
    const va = (view.x1 - view.x0) * (view.y1 - view.y0)
    const ca = (cur.x1 - cur.x0) * (cur.y1 - cur.y0)
    if (ca < va * 9) return // still a sensible window
  }
  cullRect.value = worldRect(cam, viewW, viewH, Math.max(viewW, viewH) * 0.35)
}

const toWorld = (sx, sy) => ({ x: (sx - cam.x) / cam.k, y: (sy - cam.y) / cam.k })

function fitTarget() {
  const pts = props.persons.map((p) => basePos(p.id))
  return fitCamera(boundsOf(pts), viewW, viewH, 70)
}
function flyTo(to, dur = 700) {
  zoomTarget = null
  vel = { x: 0, y: 0 }
  if (reduceMotion) {
    Object.assign(cam, to)
    applyCam()
    scheduleCamSave()
    return
  }
  camTween = { from: { ...cam }, to, t0: performance.now(), dur }
  kick()
}
function fitAnimated() {
  if (viewW) flyTo(fitTarget())
}
function zoomAroundCenter(f) {
  const base = zoomTarget ? zoomTarget.k : cam.k
  camTween = null
  zoomTarget = { k: Math.max(minZoom(), Math.min(MAX_K, base * f)), sx: viewW / 2, sy: viewH / 2 }
  kick()
}
// Never zoom out much past "everyone fits" — below that is just empty cork.
function minZoom() {
  if (!viewW) return MIN_K
  return Math.max(MIN_K, Math.min(0.5, fitTarget().k * 0.45))
}
const zoomIn = () => zoomAroundCenter(1.3)
const zoomOut = () => zoomAroundCenter(1 / 1.3)

// ── The frame loop: gestures, easing, momentum, lamp, glides ───────────────
function kick() {
  if (!raf) raf = requestAnimationFrame(tick)
}
function tick(now) {
  raf = 0
  let active = false
  let moved = false

  // Pending pointer input (coalesced to one update per frame).
  if (gesture && gesture.pending) {
    gesture.pending = false
    if (gesture.kind === 'pan' && gesture.moved) {
      const dx = gesture.cx - gesture.lx
      const dy = gesture.cy - gesture.ly
      const dt = Math.max(1, now - (gesture.lt || now - 16))
      cam.x += dx
      cam.y += dy
      vel = { x: vel.x * 0.5 + (dx / dt) * 16 * 0.5, y: vel.y * 0.5 + (dy / dt) * 16 * 0.5 }
      gesture.lx = gesture.cx
      gesture.ly = gesture.cy
      gesture.lt = now
      moved = true
    } else if (gesture.kind === 'pol' && gesture.moved) {
      updateDragPos()
    }
  }
  // Edge auto-pan while carrying a polaroid near the viewport border.
  if (gesture && gesture.kind === 'pol' && gesture.moved) {
    const sx = gesture.cx - gesture.rx
    const sy = gesture.cy - gesture.ry
    const m = 44
    const ex = sx < m ? m - sx : sx > viewW - m ? viewW - m - sx : 0
    const ey = sy < m ? m - sy : sy > viewH - m ? viewH - m - sy : 0
    if (ex || ey) {
      cam.x += ex * 0.3
      cam.y += ey * 0.3
      updateDragPos()
      moved = true
      active = true
    }
  }

  if (camTween) {
    const t = Math.min(1, (now - camTween.t0) / camTween.dur)
    const e = easeInOut(t)
    const { from, to } = camTween
    // Interpolate zoom geometrically so the fly feels even at every scale.
    const k = from.k * Math.pow(to.k / from.k, e)
    const cxW = (viewW / 2 - from.x) / from.k
    const cyW = (viewH / 2 - from.y) / from.k
    const txW = (viewW / 2 - to.x) / to.k
    const tyW = (viewH / 2 - to.y) / to.k
    const wx = cxW + (txW - cxW) * e
    const wy = cyW + (tyW - cyW) * e
    cam.k = k
    cam.x = viewW / 2 - wx * k
    cam.y = viewH / 2 - wy * k
    moved = true
    if (t < 1) active = true
    else camTween = null
  } else {
    if (zoomTarget) {
      const nk = cam.k + (zoomTarget.k - cam.k) * (reduceMotion ? 1 : 0.24)
      Object.assign(cam, zoomAt(cam, zoomTarget.sx, zoomTarget.sy, nk))
      if (Math.abs(zoomTarget.k - cam.k) < zoomTarget.k * 0.0008) {
        Object.assign(cam, zoomAt(cam, zoomTarget.sx, zoomTarget.sy, zoomTarget.k))
        zoomTarget = null
      } else active = true
      moved = true
    }
    if (!gesture && (Math.abs(vel.x) > 0.08 || Math.abs(vel.y) > 0.08)) {
      cam.x += vel.x
      cam.y += vel.y
      vel.x *= 0.93
      vel.y *= 0.93
      moved = true
      active = true
    }
  }
  if (moved) {
    applyCam()
    markMoving()
  }

  // Desk lamp trails the cursor with a little lag.
  if (lamp.init) {
    const dx = lamp.tx - lamp.x
    const dy = lamp.ty - lamp.y
    if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) {
      const f = reduceMotion ? 1 : 0.075
      lamp.x += dx * f
      lamp.y += dy * f
      active = true
    } else {
      lamp.x = lamp.tx
      lamp.y = lamp.ty
    }
    if (lampEl.value) lampEl.value.style.transform = `translate3d(${lamp.x}px, ${lamp.y}px, 0)`
  }

  if (glide.value) {
    const t = Math.min(1, (now - glide.value.t0) / GLIDE_MS)
    glideT.value = t
    if (t < 1) active = true
    else glide.value = null
  }

  if (moved) camDirty = true
  if (active || (gesture && gesture.pending)) raf = requestAnimationFrame(tick)
  else if (camDirty && !gesture) {
    camDirty = false
    scheduleCamSave()
  }
}
let camDirty = false

function startGlide(from) {
  if (reduceMotion || !from.size) return
  glide.value = { from, t0: performance.now() }
  glideT.value = 0
  kick()
}

// ── Pointer: pan the board, or drag / click a polaroid ─────────────────────
let gesture = null
function localXY(e) {
  const r = rootEl.value.getBoundingClientRect()
  return { sx: e.clientX - r.left, sy: e.clientY - r.top, r }
}
function onDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  if (e.target.closest('.board-ui, .board-tag')) return
  e.preventDefault()
  const { sx, sy, r } = localXY(e)
  vel = { x: 0, y: 0 }
  zoomTarget = null
  camTween = null
  const polEl = e.target.closest('.pol')
  gesture = {
    kind: polEl ? 'pol' : 'pan',
    id: polEl ? polEl.dataset.pid : null,
    x0: e.clientX,
    y0: e.clientY,
    cx: e.clientX,
    cy: e.clientY,
    lx: e.clientX,
    ly: e.clientY,
    lt: 0,
    rx: r.left,
    ry: r.top,
    moved: false,
    pending: false,
    offX: 0,
    offY: 0
  }
  if (polEl) {
    const b = posOf(gesture.id)
    const w = toWorld(sx, sy)
    gesture.offX = w.x - (b?.x || 0)
    gesture.offY = w.y - (b?.y || 0)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}
function updateDragPos() {
  const w = toWorld(gesture.cx - gesture.rx, gesture.cy - gesture.ry)
  drag.value = { id: gesture.id, x: w.x - gesture.offX, y: w.y - gesture.offY }
}
function onMove(e) {
  if (!gesture) return
  gesture.cx = e.clientX
  gesture.cy = e.clientY
  if (!gesture.moved && Math.hypot(e.clientX - gesture.x0, e.clientY - gesture.y0) > 5) {
    gesture.moved = true
    gesture.lx = gesture.x0
    gesture.ly = gesture.y0
    rootEl.value?.classList.add(gesture.kind === 'pan' ? 'panning' : 'carrying')
    if (gesture.kind === 'pol') {
      dragId.value = gesture.id
      hoverId.value = gesture.id
      updateDragPos()
    } else {
      hoverId.value = null
    }
    hintGone.value = true
  }
  gesture.pending = true
  kick()
}
function onUp() {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
  const g = gesture
  if (!g) return
  rootEl.value?.classList.remove('panning', 'carrying')
  if (g.kind === 'pol') {
    if (!g.moved) {
      gesture = null
      store.selectPerson(g.id)
      return
    }
    updateDragPos()
    const d = drag.value
    let z = 0
    for (const v of Object.values(overrides.value)) z = Math.max(z, v.z || 0)
    overrides.value = { ...overrides.value, [g.id]: { x: d.x, y: d.y, z: z + 1 } }
    drag.value = null
    dragId.value = null
    gesture = null
    persist()
    return
  }
  // Pan release: keep the fling only if the pointer was still moving.
  if (!g.moved || performance.now() - (g.lt || 0) > 90 || reduceMotion) vel = { x: 0, y: 0 }
  gesture = null
  kick()
}

function onWheel(e) {
  const { sx, sy } = localXY(e)
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
  const dy = Math.max(-240, Math.min(240, e.deltaY * unit))
  const f = Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018))
  const base = zoomTarget ? zoomTarget.k : cam.k
  camTween = null
  vel = { x: 0, y: 0 }
  zoomTarget = { k: Math.max(minZoom(), Math.min(MAX_K, base * f)), sx, sy }
  hintGone.value = true
  kick()
}

function onHoverMove(e) {
  if (!rootEl.value) return
  const { sx, sy } = localXY(e)
  lamp.tx = sx
  lamp.ty = sy
  if (!lamp.init) {
    lamp.x = sx
    lamp.y = sy
    lamp.init = true
  }
  kick()
}
function onBoardLeave() {
  lamp.tx = viewW / 2
  lamp.ty = viewH * 0.42
  kick()
}
function onPolEnter(id) {
  if (gesture) return
  hoverId.value = id
}
function onPolLeave(id) {
  if (gesture) return
  if (hoverId.value === id) hoverId.value = null
}

// ── Tidy up ────────────────────────────────────────────────────────────────
function tidyUp() {
  const from = new Map()
  for (const [id, p] of Object.entries(overrides.value)) from.set(id, { x: p.x, y: p.y })
  overrides.value = {}
  persist()
  startGlide(from)
  if (viewW) {
    const pts = props.persons.map((p) => auto.value.get(p.id))
    flyTo(fitCamera(boundsOf(pts), viewW, viewH, 70), 900)
  }
}

// When relationships change the auto layout, glide un-pinned people over.
watch(auto, (next, prev) => {
  if (!prev) return
  const from = new Map()
  const r = cullRect.value
  for (const p of props.persons) {
    if (overrides.value[p.id]) continue
    const a = prev.get(p.id)
    const b = next.get(p.id)
    if (!a || !b || (a.x === b.x && a.y === b.y)) continue
    if (r && !polaroidInRect(b.x, b.y, r) && !polaroidInRect(a.x, a.y, r)) continue
    from.set(p.id, a)
  }
  startGlide(from)
})

// ── Culled render window ───────────────────────────────────────────────────
const entering = ref(!reduceMotion)
let enterTimer = 0
const mountMode = new Map() // id → 'drop' | 'pop' (fixed for an item's mounted life)
const dropRank = new Map()
let dropCounter = 0
let dropStagger = 0.04
// Small boards drop one-by-one; big ones ripple through within ~1.8s.
const dropDelay = (rank) => Math.min(rank * dropStagger, 1.8)
const edgeMode = new Map()

const visible = computed(() => {
  const r = cullRect.value
  if (!r) return []
  const dId = dragId.value
  const out = []
  for (const p of props.persons) {
    const b = basePos(p.id)
    if ((b && polaroidInRect(b.x, b.y, r)) || p.id === dId) out.push(p)
  }
  // Entrance order: top-to-bottom, left-to-right, for newly mounted items.
  const ids = new Set(out.map((p) => p.id))
  for (const id of [...mountMode.keys()]) if (!ids.has(id)) mountMode.delete(id)
  const fresh = out.filter((p) => !mountMode.has(p.id))
  if (entering.value && fresh.length) {
    if (!dropCounter) dropStagger = Math.max(0.028, Math.min(0.11, 1.4 / fresh.length))
    fresh
      .map((p) => ({ id: p.id, b: basePos(p.id) || { x: 0, y: 0 } }))
      .sort((a, b) => Math.round(a.b.y / 120) - Math.round(b.b.y / 120) || a.b.x - b.b.x)
      .forEach(({ id }) => {
        mountMode.set(id, 'drop')
        dropRank.set(id, dropCounter++)
      })
  } else fresh.forEach((p) => mountMode.set(p.id, 'pop'))
  return out
})

const visibleEdges = computed(() => {
  const r = cullRect.value
  if (!r) return []
  // The SVG renders before the polaroids: make sure their mount modes (drop
  // ranks) exist first so strings know to wait for both pins to land.
  void visible.value
  const dId = dragId.value
  const out = []
  for (const e of edges.value) {
    const a = basePos(e.a)
    const b = basePos(e.b)
    if (!a || !b) continue
    if (
      e.a === dId ||
      e.b === dId ||
      rectsOverlap(yarnBox(a.x, a.y + PIN_DY, b.x, b.y + PIN_DY, e.slack), r)
    )
      out.push(e)
  }
  const keys = new Set(out.map((e) => e.id))
  for (const k of [...edgeMode.keys()]) if (!keys.has(k)) edgeMode.delete(k)
  for (const e of out) {
    if (edgeMode.has(e.id)) continue
    const ra = dropRank.get(e.a)
    const rb = dropRank.get(e.b)
    edgeMode.set(
      e.id,
      entering.value && mountMode.get(e.a) === 'drop'
        ? { mode: 'draw', delay: 0.5 + dropDelay(Math.max(ra || 0, rb || 0)) }
        : { mode: 'fade', delay: 0 }
    )
  }
  return out
})

const polViews = computed(() => {
  const hot = hotSet.value
  const hid = hoverId.value
  const sel = store.selectedPersonId
  const dId = drag.value?.id
  const far = lod.value === 'far'
  return visible.value.map((p) => {
    const pos = posOf(p.id) || { x: 0, y: 0 }
    const isDrag = dId === p.id
    const isHover = hid === p.id
    const mode = mountMode.get(p.id)
    const o = overrides.value[p.id]
    return {
      id: p.id,
      p,
      dead: isDeceased(p, props.refYear),
      pin: genderColor(p),
      tags: far ? null : store.tagsOf.get(p.id) || null,
      selected: sel === p.id,
      hover: isHover,
      cls: {
        drop: mode === 'drop',
        pop: mode === 'pop',
        lifted: isDrag,
        hover: isHover && !isDrag,
        linked: !!hot && hot.has(p.id) && !isHover,
        dim: !!hot && !hot.has(p.id),
        selected: sel === p.id
      },
      style: {
        transform: `translate(${pos.x - POL_W / 2}px, ${pos.y - POL_H / 2}px)`,
        zIndex: isDrag ? 100000 : isHover ? 99999 : o?.z ? o.z : undefined
      },
      inStyle: {
        '--r': rotationOf(p.id) + 'deg',
        '--pd': dropDelay(dropRank.get(p.id) || 0).toFixed(3) + 's'
      }
    }
  })
})

const edgeViews = computed(() => {
  const hid = hoverId.value
  const dId = drag.value?.id
  const gliding = !!glide.value
  return visibleEdges.value.map((e) => {
    const a = posOf(e.a)
    const b = posOf(e.b)
    const isHot = !!hid && (e.a === hid || e.b === hid)
    const live = gliding || (!!dId && (e.a === dId || e.b === dId))
    const m = edgeMode.get(e.id) || { mode: 'fade', delay: 0 }
    return {
      key: e.id,
      d: yarnPath(a.x, a.y + PIN_DY, b.x, b.y + PIN_DY, isHot ? 0.85 : 0, e.slack),
      cls: {
        [m.mode]: true,
        hot: isHot,
        dim: !!hid && !isHot,
        live,
        ended: e.ended,
        horizontal: e.role === 'horizontal'
      },
      style: { '--yc': e.color, '--yd': m.delay.toFixed(3) + 's' }
    }
  })
})

// ── Selection marker + hover case-file card ────────────────────────────────
const MARK_PAD = 30
const MARK_BOX = `0 0 ${POL_W + MARK_PAD * 2} ${POL_H + MARK_PAD * 2}`
const markCache = new Map()
function markD(id) {
  let d = markCache.get(id)
  if (!d) {
    d = markerPath(POL_W / 2 + MARK_PAD, POL_H / 2 + MARK_PAD, POL_W / 2 + 20, POL_H / 2 + 18, id)
    markCache.set(id, d)
  }
  return d
}
function caseLines(p) {
  const out = []
  if (p.occupation) out.push(p.occupation)
  if (p.location) out.push('⌖ ' + p.location)
  const age = ageOf(p, props.refYear)
  if (age != null) out.push(isDeceased(p, props.refYear) ? `† at ${age}` : `Age ${age}`)
  const s = props.statsOf(p.id)
  if (s && (s.kin || s.children))
    out.push(
      `${s.kin || 0} kin` +
        (s.children ? ` · ${s.children} ${s.children === 1 ? 'child' : 'children'}` : '')
    )
  return out
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
const hintGone = ref(false)
let hintTimer = 0
let ro = null

function measure() {
  const el = rootEl.value
  if (!el) return
  const w = el.clientWidth
  const hh = el.clientHeight
  const first = !(viewW > 0)
  viewW = w
  viewH = hh
  if (!(w > 0) || !(hh > 0)) return
  if (first) {
    if (savedCam) Object.assign(cam, savedCam)
    else Object.assign(cam, fitTarget())
    lamp.tx = w / 2
    lamp.ty = hh * 0.42
    if (!lamp.init) {
      lamp.x = lamp.tx
      lamp.y = lamp.ty
      lamp.init = true
    }
    applyCam()
    maybeRecull(true)
    kick()
    clearTimeout(enterTimer)
    enterTimer = setTimeout(() => (entering.value = false), 2800)
  } else {
    applyCam()
    maybeRecull(true)
  }
}

watch(
  () => store.activeProjectId,
  (next, prev) => {
    clearTimeout(camSaveTimer)
    camSaveTimer = 0
    loadSaved()
    if (prev !== undefined && viewW > 0) {
      if (savedCam) Object.assign(cam, savedCam)
      else Object.assign(cam, fitTarget())
      applyCam()
      maybeRecull(true)
    }
  },
  { immediate: true }
)

// A different roster (search, filter, add/remove) → glide the camera to fit it.
// (A re-sort or an edit keeps the same set, so the camera stays put.)
let rosterIds = new Set(props.persons.map((p) => p.id))
watch(
  () => props.persons,
  (list) => {
    const sameSet = list.length === rosterIds.size && list.every((p) => rosterIds.has(p.id))
    rosterIds = new Set(list.map((p) => p.id))
    if (sameSet || !viewW) return
    nextTick(() => {
      maybeRecull(true)
      if (list.length) fitAnimated()
    })
  }
)

onMounted(() => {
  nextTick(measure)
  ro = new ResizeObserver(measure)
  if (rootEl.value) ro.observe(rootEl.value)
  hintTimer = setTimeout(() => (hintGone.value = true), 7000)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  if (raf) cancelAnimationFrame(raf)
  clearTimeout(enterTimer)
  clearTimeout(hintTimer)
  clearTimeout(movingTimer)
  if (camSaveTimer) {
    clearTimeout(camSaveTimer)
    persist()
  }
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
})
</script>

<style scoped>
/* ── Surface + material palette ─────────────────────────────────────────── */
.board {
  /* Dark theme: a dim, lamp-lit board */
  --cork: color-mix(in srgb, var(--amber) 22%, #2b1d12);
  --frame: color-mix(in srgb, var(--amber) 16%, #1d130b);
  --paper: color-mix(in srgb, #ebe4d6 94%, var(--amber));
  --paper-edge: color-mix(in srgb, #cfc5b1 90%, var(--amber));
  --ink: #2a2733;
  --ink-soft: #5d5866;
  --yarn-red: #d23030;
  --yarn-gold: color-mix(in srgb, var(--amber) 80%, #fff 5%);
  --shade: rgba(0, 0, 0, 0.55);
  --hand: 'Segoe Print', 'Bradley Hand', 'Comic Sans MS', 'Chalkboard SE', cursive;
  --type: 'Courier New', 'Courier', ui-monospace, monospace;

  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  touch-action: none;
  background: var(--cork);
  isolation: isolate;
}
.board.light {
  --cork: color-mix(in srgb, var(--amber) 34%, #b98a5c);
  --frame: color-mix(in srgb, var(--amber) 22%, #6e4a2c);
  --paper: color-mix(in srgb, #fdfbf6 96%, var(--amber));
  --paper-edge: color-mix(in srgb, #e3dccd 94%, var(--amber));
  --yarn-red: #c21f24;
  --yarn-gold: color-mix(in srgb, var(--amber) 70%, #8a5a00);
  --shade: rgba(60, 30, 5, 0.42);
}
.board.panning {
  cursor: grabbing;
}
.board.carrying {
  cursor: grabbing;
}

/* Cork grain: fine dark flecks + light granules (feTurbulence, inline SVG),
   plus big soft blotches — all tiles, so the camera can slide and scale them. */
.cork {
  --gs: 1;
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-color: var(--cork);
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' seed='4' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .1 0 0 0 0 .06 0 0 0 0 .03 0 0 0 2.4 -1.05'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.55' numOctaves='2' seed='9' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 .86 0 0 0 0 .62 2.6 0 0 0 -1.5'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='640'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.0047' numOctaves='3' seed='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .06 0 0 0 0 .035 0 0 0 0 .01 0 0 0 1.5 -0.5'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size:
    calc(180px * var(--gs)) calc(180px * var(--gs)),
    calc(240px * var(--gs)) calc(240px * var(--gs)),
    calc(640px * var(--gs)) calc(640px * var(--gs));
  opacity: 1;
}
.board.light .cork {
  filter: saturate(0.95);
}

/* ── World ──────────────────────────────────────────────────────────────── */
.world {
  position: absolute;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  z-index: 1;
  transform-origin: 0 0;
}
.world.moving {
  will-change: transform;
}

/* ── Yarn ───────────────────────────────────────────────────────────────── */
.yarn {
  --sw: 1;
  position: absolute;
  left: 0;
  top: 0;
  overflow: visible;
  pointer-events: none;
}
.y path {
  fill: none;
  stroke-linecap: round;
  transition:
    d 0.42s cubic-bezier(0.34, 1.35, 0.5, 1),
    stroke-width 0.25s,
    opacity 0.25s;
}
.y.live path {
  transition:
    stroke-width 0.25s,
    opacity 0.25s;
}
.y {
  transition: opacity 0.25s;
}
.y-shadow {
  stroke: var(--shade);
  stroke-width: calc(3.6px * var(--sw));
  opacity: 0.45;
  transform: translate(3px, 7px);
}
.y-core {
  stroke: var(--yc);
  stroke-width: calc(3.1px * var(--sw));
}
.y.horizontal .y-core {
  stroke-width: calc(2.8px * var(--sw));
}
.y-hi {
  stroke: rgba(255, 255, 255, 0.4);
  stroke-width: calc(0.9px * var(--sw));
  stroke-dasharray: 2.2 3.2;
}
.board:not(.light) .y-core {
  filter: saturate(1.1);
}
.y.hot .y-core {
  stroke-width: calc(4.2px * var(--sw));
  filter: drop-shadow(0 0 5px var(--yc)) drop-shadow(0 0 2px var(--yc));
}
.y.hot .y-hi {
  stroke: rgba(255, 255, 255, 0.65);
}
.y.dim {
  opacity: 0.22;
}
.y.ended {
  opacity: 0.5;
}
.y.ended .y-hi {
  display: none;
}
.board.is-far .y-hi,
.board.is-far .y-shadow {
  display: none;
}
/* Entrance: strings draw themselves between the pins */
.y.draw .y-core {
  stroke-dasharray: 1;
  animation: yarn-draw 0.9s cubic-bezier(0.45, 0, 0.2, 1) var(--yd) backwards;
}
.y.draw .y-shadow,
.y.draw .y-hi {
  animation: yarn-fade 0.5s ease var(--yd) backwards;
}
.y.fade {
  animation: yarn-fade 0.35s ease backwards;
}
@keyframes yarn-draw {
  from {
    stroke-dashoffset: 1;
  }
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes yarn-fade {
  from {
    opacity: 0;
  }
}

/* ── Polaroid wrapper (position) → pol-in (tilt, lift, entrance) ────────── */
.pol {
  position: absolute;
  left: 0;
  top: 0;
  width: 148px;
  height: 178px;
  cursor: pointer;
}
.pol-in {
  position: absolute;
  inset: 0;
  /* Pinned at the top: the photo pivots around its pushpin. */
  transform-origin: 50% 8px;
  transform: rotate(var(--r));
  transition:
    transform 0.34s cubic-bezier(0.34, 1.45, 0.5, 1),
    opacity 0.28s,
    filter 0.28s;
}
.pol.hover .pol-in {
  transform: rotate(calc(var(--r) * 0.35)) scale(1.07);
}
.pol.lifted {
  cursor: grabbing;
}
.pol.lifted .pol-in {
  transform: rotate(calc(var(--r) * 0.2)) scale(1.1);
  transition:
    transform 0.2s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.2s;
}
.pol.dim .pol-in {
  opacity: 0.5;
  filter: saturate(0.55) brightness(0.78);
}
.pol.drop .pol-in {
  animation: pol-drop 0.62s cubic-bezier(0.3, 1.2, 0.5, 1) var(--pd) backwards;
}
.pol.pop .pol-in {
  animation: pol-pop 0.3s ease backwards;
}
@keyframes pol-drop {
  0% {
    opacity: 0;
    transform: translate(-18px, -70px) rotate(calc(var(--r) * 4)) scale(1.28);
  }
  55% {
    opacity: 1;
  }
  75% {
    transform: translate(0, 4px) rotate(calc(var(--r) * 0.8)) scale(0.97);
  }
  100% {
    transform: rotate(var(--r));
  }
}
@keyframes pol-pop {
  from {
    opacity: 0;
  }
}

/* Paper */
.pol :deep(.pc) {
  position: absolute;
  inset: 0;
  border-radius: 2px;
  background: linear-gradient(170deg, var(--paper) 60%, var(--paper-edge));
  box-shadow:
    0 1px 1px rgba(0, 0, 0, 0.28),
    0 5px 10px -3px var(--shade),
    0 16px 26px -16px var(--shade);
  transition: box-shadow 0.3s;
}
.pol.hover :deep(.pc),
.pol.linked :deep(.pc) {
  box-shadow:
    0 2px 3px rgba(0, 0, 0, 0.25),
    0 14px 22px -6px var(--shade),
    0 30px 40px -22px var(--shade);
}
.pol.lifted :deep(.pc) {
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.2),
    0 26px 34px -8px var(--shade),
    0 48px 60px -28px var(--shade);
}
.pol :deep(.pc-photo) {
  position: absolute;
  left: 10px;
  right: 10px;
  top: 10px;
  height: 128px;
  overflow: hidden;
  background: #1c1a20;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.18);
}
.pol :deep(.pc-img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  filter: sepia(0.14) contrast(1.04) saturate(0.9);
}
.pol :deep(.pc-dead .pc-img) {
  filter: grayscale(0.85) sepia(0.2) contrast(1.05);
}
.pol :deep(.pc-mono) {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--hand);
  font-size: 40px;
  font-weight: 700;
  color: color-mix(in srgb, var(--pin) 55%, #fff);
  background:
    radial-gradient(
      90% 80% at 35% 25%,
      color-mix(in srgb, var(--pin) 42%, transparent),
      transparent
    ),
    linear-gradient(160deg, #2c2a33, #17161b);
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
}
.pol :deep(.pc-dead .pc-mono) {
  filter: grayscale(0.7);
}
/* Faint print gloss */
.pol :deep(.pc-gloss) {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    125deg,
    rgba(255, 255, 255, 0.16),
    transparent 38%,
    transparent 70%,
    rgba(255, 255, 255, 0.06)
  );
  pointer-events: none;
}
/* Rubber stamp */
.pol :deep(.pc-stamp) {
  position: absolute;
  left: 50%;
  top: 56%;
  transform: translate(-50%, -50%) rotate(-17deg);
  padding: 2px 8px 1px;
  border: 2.5px solid var(--yarn-red);
  border-radius: 4px;
  box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--yarn-red) 40%, transparent);
  color: var(--yarn-red);
  font-family: Impact, 'Arial Black', 'Franklin Gothic Heavy', sans-serif;
  font-size: 17px;
  letter-spacing: 2.5px;
  line-height: 1.15;
  background: color-mix(in srgb, #fff 18%, transparent);
  opacity: 0.88;
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='60'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.7' numOctaves='2' seed='3'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -3 2.2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='60'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.7' numOctaves='2' seed='3'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -3 2.2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  white-space: nowrap;
}
/* Handwritten caption */
.pol :deep(.pc-cap) {
  position: absolute;
  left: 8px;
  right: 8px;
  top: 139px;
  bottom: 3px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: var(--hand);
  color: var(--ink);
  line-height: 1.12;
  text-align: center;
}
.pol :deep(.pc-name) {
  max-width: 100%;
  font-size: 12.5px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transform: rotate(-1.2deg);
}
.pol :deep(.pc-year) {
  font-size: 10.5px;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}
.pol :deep(.pc-dead .pc-year) {
  text-decoration: line-through;
  text-decoration-color: color-mix(in srgb, var(--yarn-red) 70%, transparent);
  text-decoration-thickness: 1.5px;
}
/* Tags: sticky notes stuck on the right edge */
.pol :deep(.pc-note) {
  position: absolute;
  right: -30px;
  top: calc(22px + var(--ni) * 38px);
  width: 52px;
  min-height: 30px;
  padding: 4px 4px 5px;
  font-family: var(--hand);
  font-size: 8.5px;
  font-weight: 700;
  line-height: 1.15;
  color: var(--ink);
  background: linear-gradient(
    175deg,
    color-mix(in srgb, var(--nc) 38%, #fff4a6),
    color-mix(in srgb, var(--nc) 50%, #f5e47e)
  );
  box-shadow:
    0 1px 1px rgba(0, 0, 0, 0.2),
    2px 5px 8px -3px var(--shade);
  transform: rotate(calc(7deg - var(--ni) * 12deg));
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}
/* Pushpin (gender-coloured) with its cast shadow */
.pol :deep(.pc-pin) {
  position: absolute;
  left: 50%;
  top: 0;
  width: 16px;
  height: 16px;
  margin-left: -8px;
  border-radius: 50%;
  background: radial-gradient(
    circle at 34% 30%,
    color-mix(in srgb, var(--pin) 30%, #fff) 0,
    var(--pin) 42%,
    color-mix(in srgb, var(--pin) 55%, #000) 100%
  );
  box-shadow:
    inset -1px -2px 3px rgba(0, 0, 0, 0.35),
    3px 6px 5px -1px rgba(0, 0, 0, 0.45);
  z-index: 3;
}
.pol :deep(.pc-pin)::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 3px;
  width: 5px;
  height: 3px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.75);
  transform: rotate(-30deg);
}
.pol.drop :deep(.pc-pin) {
  animation: pin-press 0.34s cubic-bezier(0.3, 1.5, 0.5, 1) calc(var(--pd) + 0.42s) backwards;
}
@keyframes pin-press {
  from {
    opacity: 0;
    transform: translate(10px, -22px) scale(1.7);
  }
}

/* Far LOD: a plain paper chip + pin — no photo, no text */
.pol-far {
  position: absolute;
  inset: 0;
  background: var(--paper);
  box-shadow: 0 6px 12px -4px var(--shade);
}
.pol-far i {
  position: absolute;
  left: 10px;
  right: 10px;
  top: 10px;
  height: 128px;
  background: linear-gradient(160deg, color-mix(in srgb, var(--pin) 55%, #2c2a33), #1c1a20);
}
.pol-far::after {
  content: '';
  position: absolute;
  left: 50%;
  top: -6px;
  width: 30px;
  height: 30px;
  margin-left: -15px;
  border-radius: 50%;
  background: var(--pin);
}

/* Selected: a red marker loop drawn around the photo */
.pol-mark {
  position: absolute;
  left: -30px;
  top: -30px;
  width: 208px;
  height: 238px;
  overflow: visible;
  pointer-events: none;
  z-index: 4;
}
.pol-mark path {
  fill: none;
  stroke: var(--yarn-red);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.9;
  stroke-dasharray: 1;
  animation: yarn-draw 0.7s cubic-bezier(0.5, 0, 0.3, 1) backwards;
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.25));
}
.board.is-far .pol-mark path {
  stroke-width: 14;
}

/* Hover: a typed index card slides out from under the photo */
.pol-case {
  position: absolute;
  left: 6px;
  right: 6px;
  top: calc(100% - 8px);
  z-index: -1;
  padding: 14px 9px 7px;
  font-family: var(--type);
  font-size: 10px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--ink);
  background:
    repeating-linear-gradient(
      180deg,
      transparent 0 13px,
      color-mix(in srgb, #4a7bd0 22%, transparent) 13px 14px
    ),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--yarn-red) 30%, transparent) 0 1px,
      transparent 1px
    ),
    #f7f4ec;
  background-position:
    0 4px,
    0 10px,
    0 0;
  box-shadow: 0 8px 14px -6px var(--shade);
  transform: rotate(calc(var(--r) * -1.4));
  animation: case-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  pointer-events: none;
}
.pol-case-line {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
@keyframes case-in {
  from {
    opacity: 0;
    transform: translateY(-26px) rotate(0deg);
  }
}

/* ── Lighting ───────────────────────────────────────────────────────────── */
.lamp {
  position: absolute;
  left: 0;
  top: 0;
  width: 300vmax;
  height: 300vmax;
  margin-left: -150vmax;
  margin-top: -150vmax;
  z-index: 2;
  pointer-events: none;
  background: radial-gradient(
    circle at center,
    rgba(255, 214, 150, 0.1) 0,
    rgba(255, 196, 120, 0.05) 200px,
    rgba(10, 6, 2, 0.12) 380px,
    rgba(8, 5, 2, 0.36) 760px,
    rgba(6, 4, 2, 0.6) 1300px
  );
  will-change: transform;
}
.board.light .lamp {
  background: radial-gradient(
    circle at center,
    rgba(255, 250, 235, 0.2) 0,
    rgba(255, 246, 225, 0.08) 320px,
    transparent 640px,
    rgba(70, 40, 10, 0.1) 1200px
  );
}
.vignette {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0, 0, 0, 0.42) 100%);
  box-shadow:
    inset 0 0 0 6px var(--frame),
    inset 0 0 0 7px rgba(255, 255, 255, 0.06),
    inset 0 0 26px 8px rgba(0, 0, 0, 0.45);
}
.board.light .vignette {
  background: radial-gradient(ellipse at 50% 45%, transparent 60%, rgba(60, 30, 5, 0.26) 100%);
  box-shadow:
    inset 0 0 0 6px var(--frame),
    inset 0 0 0 7px rgba(255, 255, 255, 0.18),
    inset 0 0 22px 6px rgba(60, 30, 5, 0.28);
}

/* ── Chrome: evidence tag, zoom cluster, hint ───────────────────────────── */
.board-tag {
  position: absolute;
  left: 20px;
  bottom: 18px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 12px 6px 22px;
  font-family: var(--type);
  font-size: 11px;
  color: var(--ink);
  background: color-mix(in srgb, #e9d3a3 86%, var(--amber));
  clip-path: polygon(10px 0, 100% 0, 100% 100%, 10px 100%, 0 50%);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
  transform: rotate(-1.5deg);
  cursor: default;
  animation: chrome-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.5s backwards;
}
.board-tag b {
  letter-spacing: 2px;
  color: var(--yarn-red);
}
.board-tag-hole {
  position: absolute;
  left: 11px;
  top: 50%;
  width: 6px;
  height: 6px;
  margin-top: -3px;
  border-radius: 50%;
  background: var(--cork);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.5);
}
.board-tag-sep {
  opacity: 0.5;
}

.board-ui {
  position: absolute;
  right: 18px;
  bottom: 16px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--glass-strong);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow);
  cursor: default;
  animation: chrome-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.6s backwards;
}
.bu-btn {
  height: 28px;
  min-width: 28px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s,
    transform 0.15s;
}
.bu-btn:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--hover);
  transform: translateY(-1px);
}
.bu-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.bu-wide {
  font-size: 11.5px;
  padding: 0 10px;
}
.bu-zoom {
  min-width: 46px;
  text-align: center;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--t2);
  font-variant-numeric: tabular-nums;
}
.bu-sep {
  width: 1px;
  height: 18px;
  margin: 0 3px;
  background: var(--border);
}

.board-hint {
  position: absolute;
  left: 50%;
  top: 14px;
  z-index: 5;
  transform: translateX(-50%);
  padding: 5px 14px;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.45);
  color: rgba(255, 255, 255, 0.85);
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
  backdrop-filter: blur(6px);
  transition:
    opacity 0.6s,
    transform 0.6s;
  animation: chrome-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) 1.2s backwards;
}
.board-hint.gone {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}
@keyframes chrome-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}

/* ── Empty state ────────────────────────────────────────────────────────── */
.board-empty {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.board-empty-card {
  position: relative;
  padding: 26px 30px 22px;
  max-width: 300px;
  text-align: center;
  font-family: var(--hand);
  color: var(--ink);
  background: #f7f4ec;
  box-shadow: 0 16px 30px -12px rgba(0, 0, 0, 0.55);
  transform: rotate(-2deg);
}
.board-empty-pin {
  position: absolute;
  left: 50%;
  top: 6px;
  width: 16px;
  height: 16px;
  margin-left: -8px;
  border-radius: 50%;
  background: radial-gradient(circle at 34% 30%, #ff9d9d, var(--yarn-red) 45%, #5e0d0d);
  box-shadow: 3px 6px 5px -1px rgba(0, 0, 0, 0.45);
}
.board-empty-title {
  font-size: 18px;
  font-weight: 700;
}
.board-empty-text {
  margin-top: 4px;
  font-size: 12.5px;
  color: var(--ink-soft);
}

@media (max-width: 640px) {
  .board-tag {
    display: none;
  }
  .board-hint {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pol.drop .pol-in,
  .pol.pop .pol-in,
  .pol.drop :deep(.pc-pin),
  .y.draw .y-core,
  .y.draw .y-shadow,
  .y.draw .y-hi,
  .y.fade,
  .pol-mark path,
  .pol-case,
  .board-ui,
  .board-tag,
  .board-hint {
    animation: none;
  }
  .pol-in,
  .y path {
    transition: none;
  }
}
</style>
