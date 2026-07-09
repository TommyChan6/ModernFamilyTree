<template>
  <div class="fx-view">
    <!-- Toolbar -->
    <div class="fx-toolbar">
      <div class="fx-heading">
        <span class="fx-title">Factions</span>
        <span class="fx-count">{{ store.factions.length }}</span>
      </div>
      <div class="fx-actions">
        <span class="fx-hint">Drag people into rings · Drag rings to arrange · Click a person to manage</span>
        <button class="btn btn-sm" @click="store.openForm()">＋ Person</button>
        <button v-if="visibleFactions.length > 1" class="btn btn-sm" title="Arrange factions in a ring" @click="autoArrange">✨ Arrange</button>
        <button class="btn btn-primary btn-sm" @click="handleCreateFaction">＋ New Faction</button>
      </div>
    </div>

    <!-- Stage -->
    <div
      ref="stageEl"
      class="fx-stage"
      :class="{ panning, grabbing: !!dragNode || !!ghost }"
      @pointerdown="onStageDown"
      @wheel.prevent="onWheel"
      @click="onStageClick"
    >
      <svg class="fx-svg" :width="stageW" :height="stageH">
        <defs>
          <!-- Shared avatar clip: resolved in each node's local (translated) space -->
          <clipPath id="fx-avatar-clip"><circle cx="0" cy="0" :r="NODE_R - 2.5" /></clipPath>
        </defs>

        <g :transform="`translate(${tx}, ${ty}) scale(${k})`">
          <!-- Faction zones -->
          <g
            v-for="z in zones"
            :key="z.id"
            class="fx-zone"
            :class="{ dim: zoneDimmed(z.id), lit: zoneLit(z.id), droppable: z.id === dropTargetId }"
            @pointerenter="hoverFactionId = z.id"
            @pointerleave="hoverFactionId = null"
          >
            <circle
              class="fx-zone-fill"
              :cx="z.x" :cy="z.y" :r="z.r"
              :fill="z.color"
              @pointerdown.stop="onZoneDown(z.id, $event)"
            />
            <circle class="fx-zone-ring" :cx="z.x" :cy="z.y" :r="z.r" :stroke="z.color" />
            <circle v-if="z.id === dropTargetId" class="fx-zone-drop-ring" :cx="z.x" :cy="z.y" :r="z.r + 8" :stroke="z.color" />
            <!-- Header pill -->
            <g class="fx-zone-header" @pointerdown.stop="onZoneDown(z.id, $event)">
              <rect
                :x="z.x - z.headerW / 2" :y="z.y - z.r - 30"
                :width="z.headerW" height="26" rx="13"
                :stroke="z.color"
              />
              <text class="fx-zone-name" :x="z.x - z.headerW / 2 + 12" :y="z.y - z.r - 12">{{ z.icon }} {{ z.label }}</text>
              <text class="fx-zone-count" :x="z.x + z.headerW / 2 - 12" :y="z.y - z.r - 12" text-anchor="end" :fill="z.color">{{ z.count }}</text>
            </g>
          </g>

          <!-- Membership links for the hovered / dragged person -->
          <g class="fx-links">
            <line
              v-for="(l, i) in hoverLinks"
              :key="i"
              class="fx-link"
              :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2"
              :stroke="l.color"
            />
          </g>

          <!-- People -->
          <g
            v-for="(n, i) in renderNodes"
            :key="n.id"
            class="fx-person"
            :class="{ dim: personDimmed(n), lit: personLit(n), grabbed: dragNode && dragNode.id === n.id }"
            :transform="`translate(${n.x}, ${n.y})`"
            @pointerdown.stop="onNodeDown(n.id, $event)"
            @pointerenter="hoverPersonId = n.id"
            @pointerleave="hoverPersonId = null"
            @dblclick.stop="pPop = null; store.selectPerson(n.id)"
          >
            <g class="fx-person-inner" :style="{ '--i': i }">
              <path v-for="(a, j) in n.arcs" :key="j" class="fx-arc" :d="a.d" :stroke="a.color" />
              <circle class="fx-node-bg" cx="0" cy="0" :r="NODE_R" :fill="n.color" />
              <image
                v-if="n.img"
                :href="n.img"
                :x="-(NODE_R - 2.5)" :y="-(NODE_R - 2.5)"
                :width="(NODE_R - 2.5) * 2" :height="(NODE_R - 2.5) * 2"
                clip-path="url(#fx-avatar-clip)"
                preserveAspectRatio="xMidYMid slice"
              />
              <path v-else class="fx-node-icon" :d="PERSON_ICON_PATH" transform="translate(-10, -10.5) scale(0.86)" />
              <text class="fx-node-name" x="0" :y="NODE_R + 16" text-anchor="middle">{{ n.label }}</text>
            </g>
          </g>

          <!-- Ghost while dragging someone out of the tray -->
          <g v-if="ghost && ghost.over" class="fx-ghost" :transform="`translate(${ghost.x}, ${ghost.y})`">
            <circle cx="0" cy="0" :r="NODE_R" :fill="ghost.color" />
            <path class="fx-node-icon" :d="PERSON_ICON_PATH" transform="translate(-10, -10.5) scale(0.86)" />
            <text class="fx-node-name" x="0" :y="NODE_R + 16" text-anchor="middle">{{ ghost.label }}</text>
          </g>
        </g>
      </svg>

      <!-- Empty state -->
      <div v-if="!store.factions.length" class="fx-empty">
        <div class="fx-empty-icon">⬡</div>
        <div class="fx-empty-title">No factions yet</div>
        <div class="fx-empty-text">
          Group your people into families, companies, schools, guilds — any camps you like.
          People in several factions settle in the middle ground between them.
        </div>
        <button class="btn btn-primary" @click="handleCreateFaction">＋ Create your first faction</button>
      </div>

      <!-- Zoom controls -->
      <div v-if="store.factions.length" class="fx-controls" @pointerdown.stop @click.stop>
        <button class="fx-ctrl-btn" title="Zoom in" @click="zoomBy(1.3333)">＋</button>
        <button class="fx-ctrl-btn" title="Zoom out" @click="zoomBy(0.75)">－</button>
        <div class="fx-ctrl-sep"></div>
        <button class="fx-ctrl-btn" title="Fit all" @click="fitAll(true)">⊡</button>
        <div class="fx-ctrl-sep"></div>
        <span class="fx-zoom-label">{{ Math.round(k * 100) }}%</span>
      </div>

      <!-- Faction manager panel -->
      <div v-if="store.factions.length" class="fx-manager" @pointerdown.stop @wheel.stop @click.stop>
        <div class="fx-panel-title">Factions</div>
        <div
          v-for="f in store.factions"
          :key="f.id"
          class="fx-mrow"
          :class="{ off: f.visible === false }"
          @mouseenter="hoverFactionId = f.visible === false ? null : f.id"
          @mouseleave="hoverFactionId = null"
        >
          <span class="fx-mdot" :style="{ background: f.color }"></span>
          <span class="fx-mname" :title="f.description || f.name">{{ f.name }}</span>
          <span class="fx-mcount">{{ (f.member_ids || []).length }}</span>
          <button
            class="fx-mbtn"
            :title="f.visible === false ? 'Show faction' : 'Hide faction'"
            @click="toggleVisible(f)"
          >{{ f.visible === false ? '◌' : '👁' }}</button>
          <button class="fx-mbtn" title="Edit faction" @click="openFactionEdit(f.id, $event)">✎</button>
        </div>
        <div v-if="sharedCount" class="fx-mfoot">{{ sharedCount }} in multiple factions</div>
      </div>

      <!-- Unassigned tray -->
      <div v-if="unassigned.length && store.factions.length" class="fx-tray" @wheel.stop @click.stop>
        <div class="fx-tray-title">Unassigned <span class="fx-tray-count">{{ unassigned.length }}</span></div>
        <div class="fx-tray-hint">drag onto a ring</div>
        <div class="fx-tray-chips">
          <div
            v-for="p in unassigned"
            :key="p.id"
            class="fx-chip"
            @pointerdown.stop="onTrayChipDown(p, $event)"
          >
            <span class="fx-chip-dot" :style="{ background: genderColor(p.gender) }"></span>
            <span class="fx-chip-name">{{ trunc(p.name || 'Unnamed', 16) }}</span>
          </div>
        </div>
      </div>

      <!-- Faction edit popup -->
      <Transition name="fxpop">
        <div v-if="fEdit" class="fx-popup fx-fedit" :style="{ left: fEdit.px + 'px', top: fEdit.py + 'px' }" @pointerdown.stop @wheel.stop @click.stop>
          <div class="fx-popup-title">
            <span class="fx-mdot" :style="{ background: fEdit.color }"></span>
            Edit faction
          </div>
          <input ref="fEditNameRef" v-model="fEdit.name" class="fx-input" placeholder="Faction name" @keydown.enter="saveFactionEdit" @keydown.escape="fEdit = null" />
          <textarea v-model="fEdit.description" class="fx-textarea" rows="2" placeholder="Description (optional)"></textarea>
          <div class="fx-swatch-row">
            <button
              v-for="c in PRESET_COLORS"
              :key="c"
              class="fx-swatch"
              :class="{ active: fEdit.color === c }"
              :style="{ background: c }"
              @click="fEdit.color = c"
            ></button>
          </div>
          <div class="fx-icon-row">
            <button
              v-for="ic in ICON_PRESETS"
              :key="ic"
              class="fx-icon-opt"
              :class="{ active: fEdit.icon === ic }"
              @click="fEdit.icon = ic"
            >{{ ic }}</button>
          </div>
          <div class="fx-popup-actions">
            <button class="fx-pbtn danger" @click="handleDeleteFaction">Delete</button>
            <span class="fx-popup-spacer"></span>
            <button class="fx-pbtn" @click="fEdit = null">Cancel</button>
            <button class="fx-pbtn primary" @click="saveFactionEdit">Save</button>
          </div>
        </div>
      </Transition>

      <!-- Person popup -->
      <Transition name="fxpop">
        <div v-if="pPop && pPopPerson" class="fx-popup fx-ppop" :style="{ left: pPop.px + 'px', top: pPop.py + 'px' }" @pointerdown.stop @wheel.stop @click.stop>
          <div class="fx-popup-title">
            <span class="fx-mdot" :style="{ background: genderColor(pPopPerson.gender) }"></span>
            {{ pPopPerson.name || 'Unnamed' }}
          </div>
          <div class="fx-chips">
            <span v-for="f in pPopMemberships" :key="f.id" class="fx-fchip" :style="{ borderColor: f.color }">
              <span class="fx-mdot" :style="{ background: f.color }"></span>
              {{ f.name }}
              <button class="fx-fchip-x" title="Remove from faction" @click="store.removePersonFromFaction(pPop.id, f.id)">✕</button>
            </span>
            <span v-if="!pPopMemberships.length" class="fx-nochips">No factions yet</span>
          </div>
          <select v-if="pPopAddable.length" class="fx-select" @change="onAddToFaction($event)">
            <option value="" disabled selected>＋ Add to faction…</option>
            <option v-for="f in pPopAddable" :key="f.id" :value="f.id">{{ f.icon }} {{ f.name }}</option>
          </select>
          <div class="fx-popup-actions">
            <button class="fx-pbtn" @click="store.selectPerson(pPop.id); pPop = null">Open profile</button>
            <span class="fx-popup-spacer"></span>
            <button class="fx-pbtn" @click="pPop = null">Close</button>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { forceSimulation, forceCollide, forceManyBody } from 'd3'
import { useMainStore } from '../store/index.js'
import { api } from '../api.js'
import { factionRadius, computeTargets, nextFactionPosition, arrangeInRing, membershipArcs } from './factions/factionLayout.js'

const store = useMainStore()

const PERSON_ICON_PATH = 'M12 12.5c2.49 0 4.5-2.01 4.5-4.5S14.49 3.5 12 3.5 7.5 5.51 7.5 8s2.01 4.5 4.5 4.5zm0 2.25c-3 0-9 1.51-9 4.5V22h18v-2.75c0-2.99-6-4.5-9-4.5z'
const NODE_R = 17
const ARC_R = 22.5
const PRESET_COLORS = ['#6c8ef5', '#f06292', '#f5a623', '#4caf72', '#a06cf5', '#26c6da', '#ef5350', '#8bc34a', '#ff8a65', '#7986cb']
const ICON_PRESETS = ['⚑', '🏰', '🛡', '⚔', '👑', '🎓', '🏢', '⚡', '🔥', '💧', '🌿', '🌙']
const MIN_K = 0.2
const MAX_K = 3

// ── Viewport ────────────────────────────────────────────────────────────────
const stageEl = ref(null)
const stageW = ref(0)
const stageH = ref(0)
const tx = ref(0)
const ty = ref(0)
const k = ref(1)
const panning = ref(false)

// ── Interaction state ───────────────────────────────────────────────────────
const hoverPersonId = ref(null)
const hoverFactionId = ref(null)
const dragNode = ref(null)      // sim node being dragged
const ghost = ref(null)         // tray chip being dragged: { id, label, color, x, y, over }
const dropTargetId = ref(null)  // faction ring under the current drag
const fEdit = ref(null)         // faction edit popup model
const pPop = ref(null)          // person popup: { id, px, py }
const fEditNameRef = ref(null)

// ── Simulation (positions live outside Vue; `tick` triggers re-render) ─────
const tick = ref(0)
let sim = null
let simNodes = []
let nodeById = new Map()
let pendingSpawn = null // { id, x, y } — where a freshly dropped person materialises

function forceAttract(alpha) {
  const targets = computeTargets(store.factions)
  for (const n of simNodes) {
    const t = targets[n.id]
    if (!t) continue
    n.vx += (t.x - n.x) * 0.09 * alpha
    n.vy += (t.y - n.y) * 0.09 * alpha
  }
}

function rebuildNodes() {
  const targets = computeTargets(store.factions)
  const next = []
  const nextMap = new Map()
  for (const p of store.persons) {
    const t = targets[p.id]
    if (!t) continue
    let n = nodeById.get(p.id)
    if (!n) {
      const spawn = pendingSpawn && pendingSpawn.id === p.id ? pendingSpawn : null
      n = {
        id: p.id,
        x: spawn ? spawn.x : t.x + (Math.random() - 0.5) * 60,
        y: spawn ? spawn.y : t.y + (Math.random() - 0.5) * 60,
      }
    }
    next.push(n)
    nextMap.set(p.id, n)
  }
  pendingSpawn = null
  simNodes = next
  nodeById = nextMap
  if (sim) {
    sim.nodes(simNodes)
    sim.alpha(0.7).restart()
  }
  tick.value++
}

// Rebuild only when membership / visibility / the roster changes — not on
// every faction x/y mutation during a ring drag (the attract force reads
// positions live each tick anyway).
const membershipKey = computed(() =>
  store.persons.map(p => p.id).join(',') + '|' +
  store.factions.map(f => `${f.id}:${f.visible === false ? 0 : 1}:${(f.member_ids || []).join('.')}`).join(';')
)
watch(membershipKey, rebuildNodes)

// ── Derived display data ────────────────────────────────────────────────────
function genderColor(g) {
  if (g === 'male') return store.graphSettings.maleColor
  if (g === 'female') return store.graphSettings.femaleColor
  return store.graphSettings.unknownColor
}

function trunc(s, n) {
  s = s || 'Unnamed'
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

const factionById = computed(() => {
  const m = new Map()
  store.factions.forEach(f => m.set(f.id, f))
  return m
})

const visibleFactions = computed(() => store.factions.filter(f => f.visible !== false))

const zones = computed(() =>
  visibleFactions.value.map(f => {
    const count = (f.member_ids || []).length
    const label = trunc(f.name, 18)
    return {
      id: f.id,
      x: f.x, y: f.y,
      r: factionRadius(count),
      color: f.color,
      icon: f.icon,
      label,
      count,
      headerW: label.length * 7.2 + String(count).length * 7 + 44,
    }
  })
)

const personById = computed(() => {
  const m = new Map()
  store.persons.forEach(p => m.set(p.id, p))
  return m
})

/** Visible-faction ids for a person */
function factionIdsOf(personId) {
  return visibleFactions.value.filter(f => (f.member_ids || []).includes(personId)).map(f => f.id)
}

const renderNodes = computed(() => {
  tick.value // re-render on every simulation tick
  return simNodes.map(n => {
    const p = personById.value.get(n.id)
    const colors = factionIdsOf(n.id).map(fid => factionById.value.get(fid)?.color).filter(Boolean)
    return {
      id: n.id,
      x: n.x, y: n.y,
      color: genderColor(p?.gender),
      img: p?.primary_image ? (api.getImageUrl(p.primary_image) || null) : null,
      label: trunc(p?.name, 14),
      factionIds: factionIdsOf(n.id),
      arcs: membershipArcs(0, 0, ARC_R, colors),
    }
  })
})

const unassigned = computed(() => {
  const assigned = new Set()
  visibleFactions.value.forEach(f => (f.member_ids || []).forEach(pid => assigned.add(pid)))
  return store.persons
    .filter(p => !assigned.has(p.id))
    .slice()
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
})

const sharedCount = computed(() => {
  const seen = new Map()
  visibleFactions.value.forEach(f => (f.member_ids || []).forEach(pid => seen.set(pid, (seen.get(pid) || 0) + 1)))
  let n = 0
  seen.forEach(count => { if (count > 1) n++ })
  return n
})

// ── Highlights (appearance only — never touches data) ──────────────────────
const activePersonId = computed(() => dragNode.value?.id || ghost.value?.id || hoverPersonId.value)

function personDimmed(n) {
  if (activePersonId.value) {
    if (n.id === activePersonId.value) return false
    const mine = new Set(factionIdsOf(activePersonId.value))
    return !n.factionIds.some(fid => mine.has(fid))
  }
  if (hoverFactionId.value) {
    return !n.factionIds.includes(hoverFactionId.value)
  }
  return false
}

function personLit(n) {
  return hoverFactionId.value ? n.factionIds.includes(hoverFactionId.value) : false
}

function zoneDimmed(fid) {
  if (dropTargetId.value) return fid !== dropTargetId.value && !isActiveMemberZone(fid)
  if (activePersonId.value) return !isActiveMemberZone(fid)
  if (hoverFactionId.value) return fid !== hoverFactionId.value
  return false
}

function zoneLit(fid) {
  return fid === hoverFactionId.value || (activePersonId.value && isActiveMemberZone(fid))
}

function isActiveMemberZone(fid) {
  return activePersonId.value ? factionIdsOf(activePersonId.value).includes(fid) : false
}

const hoverLinks = computed(() => {
  tick.value
  const pid = activePersonId.value
  if (!pid) return []
  const n = nodeById.get(pid)
  if (!n) return []
  return factionIdsOf(pid).map(fid => {
    const f = factionById.value.get(fid)
    return { x1: n.x, y1: n.y, x2: f.x, y2: f.y, color: f.color }
  })
})

// ── Coordinate helpers ──────────────────────────────────────────────────────
function toWorld(e) {
  const rect = stageEl.value.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left - tx.value) / k.value,
    y: (e.clientY - rect.top - ty.value) / k.value,
  }
}

function toScreen(e) {
  const rect = stageEl.value.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

/** Smallest visible ring containing the world point — the intended drop target */
function zoneAt(w) {
  let best = null
  for (const z of zones.value) {
    if (Math.hypot(z.x - w.x, z.y - w.y) <= z.r && (!best || z.r < best.r)) best = z
  }
  return best
}

function clampPopup(x, y, w, h) {
  return {
    px: Math.min(Math.max(8, x), Math.max(8, stageW.value - w - 8)),
    py: Math.min(Math.max(8, y), Math.max(8, stageH.value - h - 8)),
  }
}

// ── Pan & zoom ──────────────────────────────────────────────────────────────
let panStart = null
let suppressClick = false

function onStageDown(e) {
  if (e.button !== 0) return
  cancelTween()
  panning.value = true
  panStart = { x: e.clientX, y: e.clientY, tx: tx.value, ty: ty.value, moved: false }
  window.addEventListener('pointermove', onPanMove)
  window.addEventListener('pointerup', onPanUp)
}

function onPanMove(e) {
  if (!panStart) return
  const dx = e.clientX - panStart.x
  const dy = e.clientY - panStart.y
  if (!panStart.moved && Math.hypot(dx, dy) > 4) panStart.moved = true
  if (!panStart.moved) return
  tx.value = panStart.tx + dx
  ty.value = panStart.ty + dy
}

function onPanUp() {
  suppressClick = !!panStart?.moved
  panStart = null
  panning.value = false
  window.removeEventListener('pointermove', onPanMove)
  window.removeEventListener('pointerup', onPanUp)
}

function onWheel(e) {
  cancelTween()
  const rect = stageEl.value.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const factor = Math.exp(-e.deltaY * 0.0022)
  const nk = Math.min(MAX_K, Math.max(MIN_K, k.value * factor))
  tx.value = mx - (mx - tx.value) * (nk / k.value)
  ty.value = my - (my - ty.value) * (nk / k.value)
  k.value = nk
}

function onStageClick() {
  if (suppressClick) { suppressClick = false; return }
  fEdit.value = null
  pPop.value = null
}

// ── Smooth tween for zoom buttons / fit ─────────────────────────────────────
let tweenRaf = 0
function cancelTween() { if (tweenRaf) { cancelAnimationFrame(tweenRaf); tweenRaf = 0 } }

function tweenView(targetK, targetTx, targetTy, ms = 340) {
  cancelTween()
  const s = { k: k.value, tx: tx.value, ty: ty.value }
  const t0 = performance.now()
  const ease = t => 1 - Math.pow(1 - t, 3)
  const step = (now) => {
    const t = Math.min(1, (now - t0) / ms)
    const e = ease(t)
    k.value = s.k + (targetK - s.k) * e
    tx.value = s.tx + (targetTx - s.tx) * e
    ty.value = s.ty + (targetTy - s.ty) * e
    tweenRaf = t < 1 ? requestAnimationFrame(step) : 0
  }
  tweenRaf = requestAnimationFrame(step)
}

function zoomBy(factor) {
  const nk = Math.min(MAX_K, Math.max(MIN_K, k.value * factor))
  const cx = stageW.value / 2
  const cy = stageH.value / 2
  tweenView(nk, cx - (cx - tx.value) * (nk / k.value), cy - (cy - ty.value) * (nk / k.value))
}

function fitAll(animate = false) {
  if (!stageW.value) return
  if (!zones.value.length) {
    if (animate) tweenView(1, stageW.value / 2, stageH.value / 2)
    else { k.value = 1; tx.value = stageW.value / 2; ty.value = stageH.value / 2 }
    return
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const z of zones.value) {
    minX = Math.min(minX, z.x - z.r)
    minY = Math.min(minY, z.y - z.r - 44) // room for the header pill
    maxX = Math.max(maxX, z.x + z.r)
    maxY = Math.max(maxY, z.y + z.r)
  }
  const w = Math.max(200, maxX - minX)
  const h = Math.max(200, maxY - minY)
  const nk = Math.min(MAX_K, Math.max(MIN_K, Math.min((stageW.value - 120) / w, (stageH.value - 140) / h)))
  const ntx = stageW.value / 2 - ((minX + maxX) / 2) * nk
  const nty = stageH.value / 2 - ((minY + maxY) / 2) * nk
  if (animate) tweenView(nk, ntx, nty)
  else { k.value = nk; tx.value = ntx; ty.value = nty }
}

// ── Faction ring dragging ───────────────────────────────────────────────────
let zoneDrag = null

function onZoneDown(fid, e) {
  if (e.button !== 0) return
  const f = factionById.value.get(fid)
  if (!f) return
  const w = toWorld(e)
  zoneDrag = { f, offX: w.x - f.x, offY: w.y - f.y, moved: false, e }
  sim?.alphaTarget(0.35).restart()
  window.addEventListener('pointermove', onZoneMove)
  window.addEventListener('pointerup', onZoneUp)
}

function onZoneMove(e) {
  if (!zoneDrag) return
  const w = toWorld(e)
  if (!zoneDrag.moved && Math.hypot(w.x - zoneDrag.offX - zoneDrag.f.x, w.y - zoneDrag.offY - zoneDrag.f.y) > 3 / k.value) {
    zoneDrag.moved = true
  }
  if (!zoneDrag.moved) return
  // Optimistic move; persisted once on release
  zoneDrag.f.x = w.x - zoneDrag.offX
  zoneDrag.f.y = w.y - zoneDrag.offY
}

function onZoneUp(e) {
  window.removeEventListener('pointermove', onZoneMove)
  window.removeEventListener('pointerup', onZoneUp)
  if (!zoneDrag) return
  const { f, moved } = zoneDrag
  zoneDrag = null
  sim?.alphaTarget(0)
  // The click that follows this pointerup bubbles to the stage and would
  // close whatever we just opened — suppress it either way
  suppressClick = true
  if (moved) {
    store.updateFaction({ id: f.id, x: f.x, y: f.y })
  } else {
    openFactionEdit(f.id, e)
  }
}

// ── Person node dragging ────────────────────────────────────────────────────
let nodeDrag = null

function onNodeDown(id, e) {
  if (e.button !== 0) return
  const n = nodeById.get(id)
  if (!n) return
  nodeDrag = { n, moved: false }
  window.addEventListener('pointermove', onNodeMove)
  window.addEventListener('pointerup', onNodeUp)
}

function onNodeMove(e) {
  if (!nodeDrag) return
  const w = toWorld(e)
  if (!nodeDrag.moved && Math.hypot(w.x - nodeDrag.n.x, w.y - nodeDrag.n.y) > 4 / k.value) {
    nodeDrag.moved = true
    dragNode.value = nodeDrag.n
    sim?.alphaTarget(0.35).restart()
  }
  if (!nodeDrag.moved) return
  nodeDrag.n.fx = w.x
  nodeDrag.n.fy = w.y
  dropTargetId.value = zoneAt(w)?.id || null
}

function onNodeUp(e) {
  window.removeEventListener('pointermove', onNodeMove)
  window.removeEventListener('pointerup', onNodeUp)
  if (!nodeDrag) return
  const { n, moved } = nodeDrag
  nodeDrag = null
  dragNode.value = null
  dropTargetId.value = null
  suppressClick = true
  if (!moved) {
    openPersonPopup(n.id, e)
    return
  }
  const w = toWorld(e)
  const z = zoneAt(w)
  const memberships = factionIdsOf(n.id)
  n.fx = null
  n.fy = null
  sim?.alphaTarget(0)
  if (z && !memberships.includes(z.id)) {
    // Dropped into a new camp — join it (existing memberships are kept;
    // remove via the person popup)
    store.addPersonToFaction(n.id, z.id)
  } else if (!z && memberships.length === 1) {
    // Deliberately pulled out of their only faction — back to the tray
    store.removePersonFromFaction(n.id, memberships[0])
  }
  // Multi-faction people dropped in open space just spring back — no
  // accidental data loss from a sloppy drag.
}

// ── Tray chip dragging (assign someone new) ─────────────────────────────────
let trayDrag = null

function onTrayChipDown(p, e) {
  if (e.button !== 0) return
  trayDrag = { p, moved: false }
  window.addEventListener('pointermove', onTrayMove)
  window.addEventListener('pointerup', onTrayUp)
}

function onTrayMove(e) {
  if (!trayDrag) return
  if (!trayDrag.moved) trayDrag.moved = true
  const rect = stageEl.value.getBoundingClientRect()
  const over = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom
  const w = toWorld(e)
  ghost.value = {
    id: trayDrag.p.id,
    label: trunc(trayDrag.p.name, 14),
    color: genderColor(trayDrag.p.gender),
    x: w.x, y: w.y, over,
  }
  dropTargetId.value = over ? (zoneAt(w)?.id || null) : null
}

function onTrayUp(e) {
  window.removeEventListener('pointermove', onTrayMove)
  window.removeEventListener('pointerup', onTrayUp)
  if (!trayDrag) return
  const { p, moved } = trayDrag
  trayDrag = null
  ghost.value = null
  const target = dropTargetId.value
  dropTargetId.value = null
  if (!moved) {
    store.selectPerson(p.id)
    return
  }
  if (target) {
    const w = toWorld(e)
    pendingSpawn = { id: p.id, x: w.x, y: w.y }
    store.addPersonToFaction(p.id, target)
  }
}

// ── Faction create / edit / arrange ─────────────────────────────────────────
async function handleCreateFaction() {
  const cx = (stageW.value / 2 - tx.value) / k.value
  const cy = (stageH.value / 2 - ty.value) / k.value
  const pos = nextFactionPosition(store.factions, cx, cy)
  const res = await store.createFaction({
    name: `Faction ${store.factions.length + 1}`,
    color: PRESET_COLORS[store.factions.length % PRESET_COLORS.length],
    icon: ICON_PRESETS[store.factions.length % ICON_PRESETS.length],
    x: Math.round(pos.x),
    y: Math.round(pos.y),
  })
  if (res?.success) {
    openFactionEdit(res.data.id, null)
  }
}

function openFactionEdit(fid, e) {
  const f = factionById.value.get(fid)
  if (!f) return
  pPop.value = null
  const s = e ? toScreen(e) : { x: stageW.value / 2 - 130, y: stageH.value / 2 - 160 }
  const { px, py } = clampPopup(s.x + 12, s.y + 12, 260, 320)
  fEdit.value = {
    id: f.id,
    name: f.name,
    description: f.description || '',
    color: f.color,
    icon: f.icon,
    px, py,
  }
  nextTick(() => fEditNameRef.value?.focus())
}

async function saveFactionEdit() {
  if (!fEdit.value) return
  const { id, name, description, color, icon } = fEdit.value
  fEdit.value = null
  await store.updateFaction({ id, name: name.trim() || 'Unnamed Faction', description, color, icon })
}

async function handleDeleteFaction() {
  if (!fEdit.value) return
  const f = factionById.value.get(fEdit.value.id)
  const count = (f?.member_ids || []).length
  const ok = confirm(`Delete "${f?.name}"?${count ? ` Its ${count} member${count === 1 ? '' : 's'} stay in your tree.` : ''}`)
  if (!ok) return
  const id = fEdit.value.id
  fEdit.value = null
  await store.deleteFaction(id)
}

function toggleVisible(f) {
  hoverFactionId.value = null
  store.updateFaction({ id: f.id, visible: f.visible === false })
}

async function autoArrange() {
  const cx = (stageW.value / 2 - tx.value) / k.value
  const cy = (stageH.value / 2 - ty.value) / k.value
  const placed = arrangeInRing(visibleFactions.value, cx, cy)
  sim?.alphaTarget(0.4).restart()
  await Promise.all(placed.map(p => store.updateFaction({ id: p.id, x: Math.round(p.x), y: Math.round(p.y) })))
  sim?.alphaTarget(0)
  fitAll(true)
}

// ── Person popup ────────────────────────────────────────────────────────────
function openPersonPopup(id, e) {
  fEdit.value = null
  const s = toScreen(e)
  const { px, py } = clampPopup(s.x + 12, s.y + 12, 240, 220)
  pPop.value = { id, px, py }
}

const pPopPerson = computed(() => pPop.value ? personById.value.get(pPop.value.id) : null)
const pPopMemberships = computed(() =>
  pPop.value ? store.factions.filter(f => (f.member_ids || []).includes(pPop.value.id)) : []
)
const pPopAddable = computed(() =>
  pPop.value ? store.factions.filter(f => !(f.member_ids || []).includes(pPop.value.id)) : []
)

function onAddToFaction(e) {
  const fid = e.target.value
  e.target.value = ''
  if (fid && pPop.value) store.addPersonToFaction(pPop.value.id, fid)
}

// ── Lifecycle ───────────────────────────────────────────────────────────────
let ro = null
onMounted(() => {
  const measure = () => {
    stageW.value = stageEl.value?.clientWidth || 0
    stageH.value = stageEl.value?.clientHeight || 0
  }
  measure()
  ro = new ResizeObserver(measure)
  if (stageEl.value) ro.observe(stageEl.value)

  sim = forceSimulation([])
    .force('attract', forceAttract)
    .force('collide', forceCollide().radius(NODE_R + 8).strength(0.85))
    .force('charge', forceManyBody().strength(-26).distanceMax(130))
    .alphaDecay(0.03)
    .on('tick', () => { tick.value++ })
  rebuildNodes()
  nextTick(() => { measure(); fitAll(false) })
})

onBeforeUnmount(() => {
  sim?.stop()
  sim = null
  if (ro) ro.disconnect()
  cancelTween()
  window.removeEventListener('pointermove', onPanMove)
  window.removeEventListener('pointerup', onPanUp)
  window.removeEventListener('pointermove', onZoneMove)
  window.removeEventListener('pointerup', onZoneUp)
  window.removeEventListener('pointermove', onNodeMove)
  window.removeEventListener('pointerup', onNodeUp)
  window.removeEventListener('pointermove', onTrayMove)
  window.removeEventListener('pointerup', onTrayUp)
})
</script>

<style scoped>
.fx-view {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background:
    radial-gradient(1100px 560px at 80% -10%, rgba(108, 142, 245, 0.07), transparent 60%),
    var(--bg);
  min-height: 0;
}

/* ── Toolbar (matches the other views) ───────────────────── */
.fx-toolbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 22px;
  border-bottom: 1px solid var(--border);
  background: var(--glass-soft);
  backdrop-filter: blur(10px);
  flex-wrap: wrap;
  z-index: 2;
}
.fx-heading { display: flex; align-items: center; gap: 10px; }
.fx-title { font-size: 18px; font-weight: 700; letter-spacing: -0.2px; color: var(--t1); }
.fx-count {
  font-size: 12px; font-weight: 700; color: var(--accent);
  background: var(--adim); padding: 2px 9px; border-radius: 20px;
}
.fx-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.fx-hint { font-size: 11px; color: var(--t3); font-weight: 500; }

/* ── Stage ───────────────────────────────────────────────── */
.fx-stage {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
}
.fx-stage.panning { cursor: grabbing; }
.fx-stage.grabbing { cursor: grabbing; }
.fx-svg { display: block; user-select: none; font-family: var(--font); }

/* While anything is being dragged, skip hover hit-testing */
.fx-stage.grabbing .fx-person,
.fx-stage.panning .fx-person { pointer-events: none; }

/* ── Faction zones ───────────────────────────────────────── */
.fx-zone {
  transition: opacity 0.25s ease;
  animation: fx-zone-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  transform-box: fill-box;
  transform-origin: center;
}
.fx-zone.dim { opacity: 0.25; }

.fx-zone-fill {
  fill-opacity: 0.07;
  cursor: move;
  transition: fill-opacity 0.25s ease;
}
.fx-zone.lit .fx-zone-fill,
.fx-zone.droppable .fx-zone-fill { fill-opacity: 0.16; }

.fx-zone-ring {
  fill: none;
  stroke-width: 1.6;
  stroke-opacity: 0.55;
  pointer-events: none;
  transition: stroke-opacity 0.25s ease, stroke-width 0.25s ease;
}
.fx-zone.lit .fx-zone-ring { stroke-opacity: 0.95; stroke-width: 2.4; }

/* Marching-ants halo on the active drop target */
.fx-zone-drop-ring {
  fill: none;
  stroke-width: 2;
  stroke-dasharray: 10 8;
  stroke-opacity: 0.9;
  pointer-events: none;
  animation: fx-ants 1.1s linear infinite;
}

.fx-zone-header { cursor: move; }
.fx-zone-header rect {
  fill: var(--surface);
  stroke-width: 1.4;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.28));
  transition: transform 0.2s cubic-bezier(0.34, 1.4, 0.5, 1);
  transform-box: fill-box;
  transform-origin: center;
}
.fx-zone-header:hover rect { transform: scale(1.05); }
.fx-zone-name { font-size: 12px; font-weight: 700; fill: var(--t1); }
.fx-zone-count { font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; }

/* ── Membership links (hover only) ───────────────────────── */
.fx-link {
  stroke-width: 1.6;
  stroke-dasharray: 3 6;
  stroke-linecap: round;
  opacity: 0.75;
  pointer-events: none;
  animation: fx-fade 0.2s ease backwards;
}

/* ── People ──────────────────────────────────────────────── */
.fx-person {
  cursor: grab;
  transition: opacity 0.25s ease;
}
.fx-person.dim { opacity: 0.22; }
.fx-person.grabbed { cursor: grabbing; }

.fx-person-inner {
  animation: fx-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
  animation-delay: calc(min(var(--i, 0), 30) * 0.025s);
  transform-box: fill-box;
  transform-origin: center;
  transition: transform 0.2s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.fx-person:hover .fx-person-inner,
.fx-person.grabbed .fx-person-inner { transform: scale(1.12); }
.fx-person.lit .fx-person-inner { transform: scale(1.08); }

.fx-node-bg {
  stroke: var(--surface);
  stroke-width: 2.5;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3));
}
.fx-person.grabbed .fx-node-bg { stroke: var(--accent); }
.fx-node-icon { fill: rgba(255, 255, 255, 0.92); pointer-events: none; }
.fx-person image { pointer-events: none; }

.fx-arc {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  opacity: 0.95;
}

.fx-node-name {
  font-size: 10.5px;
  font-weight: 600;
  fill: var(--t2);
  pointer-events: none;
  paint-order: stroke;
  stroke: var(--bg);
  stroke-width: 3px;
  stroke-linejoin: round;
}
.fx-person:hover .fx-node-name,
.fx-person.lit .fx-node-name { fill: var(--t1); }

/* ── Ghost (tray drag) ───────────────────────────────────── */
.fx-ghost { pointer-events: none; opacity: 0.85; }
.fx-ghost circle {
  stroke: var(--accent);
  stroke-width: 2;
  stroke-dasharray: 5 4;
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.35));
}

/* ── Zoom controls (shared control-bar style) ────────────── */
.fx-controls {
  position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%);
  z-index: 5;
  display: flex; align-items: center; gap: 4px;
  background: var(--surface); border: 1px solid var(--border);
  padding: 5px; border-radius: 12px;
  box-shadow: var(--shadow);
  cursor: default;
}
.fx-ctrl-btn {
  border: none; background: transparent; color: var(--t2);
  font-family: var(--font); font-size: 15px;
  width: 30px; height: 30px; border-radius: 7px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.12s, color 0.12s;
}
.fx-ctrl-btn:hover { background: var(--hover); color: var(--t1); }
.fx-zoom-label {
  font-size: 11px; font-weight: 600; color: var(--t3);
  min-width: 42px; text-align: center; font-variant-numeric: tabular-nums;
  padding: 0 6px;
}
.fx-ctrl-sep { width: 1px; align-self: stretch; background: var(--border); margin: 3px 2px; }

/* ── Manager panel ───────────────────────────────────────── */
.fx-manager {
  position: absolute; top: 14px; right: 16px; z-index: 5;
  background: var(--glass-soft);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border); border-radius: 12px;
  padding: 12px 12px 10px;
  box-shadow: var(--shadow);
  display: flex; flex-direction: column; gap: 2px;
  min-width: 190px; max-width: 250px;
  max-height: 45%;
  overflow-y: auto;
  cursor: default;
}
.fx-panel-title {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.8px; color: var(--t3);
  padding: 0 4px 6px;
}
.fx-mrow {
  display: flex; align-items: center; gap: 7px;
  padding: 5px 6px; border-radius: 8px;
  transition: background 0.12s, opacity 0.2s;
}
.fx-mrow:hover { background: var(--hover); }
.fx-mrow.off { opacity: 0.45; }
.fx-mdot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.fx-mname {
  flex: 1; min-width: 0;
  font-size: 12px; font-weight: 600; color: var(--t1);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.fx-mcount { font-size: 11px; font-weight: 700; color: var(--t3); font-variant-numeric: tabular-nums; }
.fx-mbtn {
  border: none; background: transparent; color: var(--t3);
  width: 22px; height: 22px; border-radius: 6px; cursor: pointer;
  font-size: 11px; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; padding: 0;
  transition: background 0.12s, color 0.12s;
  opacity: 0;
}
.fx-mrow:hover .fx-mbtn, .fx-mrow.off .fx-mbtn:first-of-type { opacity: 1; }
.fx-mbtn:hover { background: var(--adim); color: var(--accent); }
.fx-mfoot {
  font-size: 10px; color: var(--t3); font-weight: 500;
  padding: 6px 4px 0; border-top: 1px solid var(--border); margin-top: 6px;
}

/* ── Unassigned tray ─────────────────────────────────────── */
.fx-tray {
  position: absolute; bottom: 18px; left: 16px; z-index: 5;
  background: var(--glass-soft);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border); border-radius: 12px;
  padding: 10px 12px;
  box-shadow: var(--shadow);
  max-width: 300px;
  cursor: default;
}
.fx-tray-title {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.8px; color: var(--t3);
  display: flex; align-items: center; gap: 6px;
}
.fx-tray-count {
  font-size: 10px; font-weight: 700; color: var(--accent);
  background: var(--adim); padding: 0 6px; border-radius: 8px;
}
.fx-tray-hint { font-size: 10px; color: var(--t3); opacity: 0.8; margin: 2px 0 7px; }
.fx-tray-chips {
  display: flex; flex-wrap: wrap; gap: 5px;
  max-height: 96px; overflow-y: auto;
}
.fx-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px 4px 7px;
  background: var(--elevated); border: 1px solid var(--border);
  border-radius: 20px;
  font-size: 11.5px; font-weight: 600; color: var(--t2);
  cursor: grab; user-select: none;
  transition: border-color 0.15s, color 0.15s, transform 0.15s;
}
.fx-chip:hover { border-color: var(--accent); color: var(--t1); transform: translateY(-1px); }
.fx-chip:active { cursor: grabbing; }
.fx-chip-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

/* ── Popups (shared) ─────────────────────────────────────── */
.fx-popup {
  position: absolute; z-index: 6;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 13px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  cursor: default;
  display: flex; flex-direction: column; gap: 9px;
}
.fx-fedit { width: 260px; }
.fx-ppop { width: 240px; }

.fx-popup-title {
  display: flex; align-items: center; gap: 7px;
  font-size: 12.5px; font-weight: 700; color: var(--t1);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.fx-input, .fx-textarea, .fx-select { font-size: 12px; padding: 7px 9px; }
.fx-textarea { min-height: 0; resize: none; }

.fx-swatch-row { display: flex; gap: 5px; flex-wrap: wrap; }
.fx-swatch {
  width: 20px; height: 20px; border-radius: 50%;
  border: 2px solid transparent; cursor: pointer; padding: 0;
  transition: transform 0.15s, border-color 0.15s;
}
.fx-swatch:hover { transform: scale(1.18); }
.fx-swatch.active { border-color: var(--t1); transform: scale(1.12); }

.fx-icon-row { display: flex; gap: 3px; flex-wrap: wrap; }
.fx-icon-opt {
  width: 26px; height: 26px; border-radius: 7px;
  border: 1px solid transparent; background: transparent;
  font-size: 13px; cursor: pointer; padding: 0;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.12s, border-color 0.12s;
}
.fx-icon-opt:hover { background: var(--hover); }
.fx-icon-opt.active { background: var(--adim); border-color: var(--accent); }

.fx-popup-actions { display: flex; align-items: center; gap: 6px; }
.fx-popup-spacer { flex: 1; }
.fx-pbtn {
  border: 1px solid var(--border); background: transparent; color: var(--t2);
  font-family: var(--font); font-size: 11.5px; font-weight: 600;
  padding: 5px 12px; border-radius: 8px; cursor: pointer;
  transition: all 0.13s;
}
.fx-pbtn:hover { background: var(--hover); color: var(--t1); }
.fx-pbtn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.fx-pbtn.primary:hover { filter: brightness(1.1); }
.fx-pbtn.danger { border-color: rgba(239, 83, 80, 0.35); color: #ef5350; }
.fx-pbtn.danger:hover { background: rgba(239, 83, 80, 0.12); }

.fx-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.fx-fchip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 7px;
  background: var(--elevated); border: 1px solid;
  border-radius: 14px;
  font-size: 11px; font-weight: 600; color: var(--t1);
}
.fx-fchip-x {
  border: none; background: transparent; color: var(--t3);
  font-size: 9px; cursor: pointer; padding: 1px 2px; border-radius: 4px;
  transition: color 0.12s;
}
.fx-fchip-x:hover { color: #ef5350; }
.fx-nochips { font-size: 11px; color: var(--t3); font-style: italic; }

.fxpop-enter-active { transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.4, 0.5, 1); }
.fxpop-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.fxpop-enter-from, .fxpop-leave-to { opacity: 0; transform: translateY(6px) scale(0.96); }

/* ── Empty state ─────────────────────────────────────────── */
.fx-empty {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; gap: 10px; color: var(--t2);
}
.fx-empty-icon { font-size: 44px; opacity: 0.55; color: var(--accent); }
.fx-empty-title { font-size: 16px; font-weight: 700; color: var(--t1); }
.fx-empty-text { font-size: 13px; max-width: 340px; margin-bottom: 6px; }

/* ── Keyframes ───────────────────────────────────────────── */
@keyframes fx-pop {
  from { opacity: 0; transform: scale(0.3); }
}
@keyframes fx-fade {
  from { opacity: 0; }
}
@keyframes fx-ants {
  to { stroke-dashoffset: -18; }
}
@keyframes fx-zone-in {
  from { opacity: 0; transform: scale(0.85); }
}
</style>
