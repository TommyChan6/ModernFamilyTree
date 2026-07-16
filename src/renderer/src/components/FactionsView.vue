<template>
  <div class="fx-view">
    <!-- Toolbar -->
    <div class="fx-toolbar">
      <div class="fx-heading">
        <span class="fx-title">Groups</span>
        <span class="fx-count">{{ activeFactions.length }}</span>
      </div>
      <div class="fx-actions">
        <span class="fx-hint"
          >Drag people into rings · Drag rings to arrange · Click a person to manage</span
        >
        <button class="btn btn-sm" @click="store.openForm()">＋ {{ store.noun }}</button>
        <button
          v-if="visibleFactions.length > 1"
          class="btn btn-sm"
          title="Arrange groups in a ring"
          @click="autoArrange"
        >
          ✨ Arrange
        </button>
        <button class="btn btn-primary btn-sm" @click="handleCreateFaction">＋ New Group</button>
      </div>
    </div>

    <!-- Stage: WebGL world + 2D text overlay -->
    <div
      ref="stageEl"
      class="fx-stage"
      :class="{
        panning,
        grabbing: !!dragNode || !!ghost,
        'hover-person': hoverKind === 'person',
        'hover-zone': hoverKind === 'zone'
      }"
      @pointerdown="onStageDown"
      @pointermove="onStageHover"
      @pointerleave="onStageLeave"
      @dblclick="onStageDblClick"
      @wheel.prevent="onWheel"
      @click="onStageClick"
      @dragover.prevent="onSidebarDragOver"
      @dragleave="onSidebarDragLeave"
      @drop.prevent="onSidebarDrop"
    >
      <canvas ref="glEl" class="fx-canvas"></canvas>
      <canvas ref="overlayEl" class="fx-canvas"></canvas>

      <!-- Empty state -->
      <div v-if="!activeFactions.length" class="fx-empty">
        <div class="fx-empty-icon">⬡</div>
        <div class="fx-empty-title">
          {{ store.groupsScenes.length > 1 ? 'No groups in this scene' : 'No groups yet' }}
        </div>
        <div class="fx-empty-text">
          Group your people into families, companies, schools, guilds — any camps you like. People
          in several groups settle in the middle ground between them.
        </div>
        <button class="btn btn-primary" @click="handleCreateFaction">
          ＋ Create {{ store.groupsScenes.length > 1 ? 'a' : 'your first' }} group
        </button>
      </div>

      <!-- Minimap (top-left) -->
      <MiniMap v-if="visibleFactions.length" ref="minimapRef" :adapter="minimapAdapter" />

      <!-- Zoom controls -->
      <div v-if="activeFactions.length" class="fx-controls" @pointerdown.stop @click.stop>
        <button class="fx-ctrl-btn" title="Zoom in" @click="zoomBy(1.3333)">＋</button>
        <button class="fx-ctrl-btn" title="Zoom out" @click="zoomBy(0.75)">－</button>
        <div class="fx-ctrl-sep"></div>
        <button class="fx-ctrl-btn" title="Fit all" @click="fitAll(true)">⊡</button>
        <div class="fx-ctrl-sep"></div>
        <span class="fx-zoom-label">{{ Math.round(k * 100) }}%</span>
      </div>

      <!-- Faction manager panel -->
      <div
        v-if="activeFactions.length"
        class="fx-manager"
        @pointerdown.stop
        @wheel.stop
        @click.stop
      >
        <div class="fx-panel-title">Groups</div>
        <div
          v-for="f in activeFactions"
          :key="f.id"
          class="fx-mrow"
          :class="{ off: f.visible === false }"
          @mouseenter="hoverFactionId = f.visible === false ? null : f.id"
          @mouseleave="hoverFactionId = null"
        >
          <span class="fx-mdot" :style="{ background: f.color }"></span>
          <span class="fx-mname" :title="f.name">{{ f.name }}</span>
          <span class="fx-mcount">{{ (f.member_ids || []).length }}</span>
          <button
            class="fx-mbtn"
            :title="f.visible === false ? 'Show group' : 'Hide group'"
            @click="toggleVisible(f)"
          >
            {{ f.visible === false ? '◌' : '👁' }}
          </button>
          <button class="fx-mbtn" title="Edit group" @click="openFactionEdit(f.id, $event)">
            ✎
          </button>
        </div>
        <div v-if="sharedCount" class="fx-mfoot">{{ sharedCount }} in multiple groups</div>
      </div>

      <!-- Unassigned tray -->
      <div
        v-if="unassigned.length && activeFactions.length"
        class="fx-tray"
        @wheel.stop
        @click.stop
      >
        <div class="fx-tray-title">
          Unassigned <span class="fx-tray-count">{{ unassigned.length }}</span>
        </div>
        <div class="fx-tray-hint">drag onto a ring</div>
        <div class="fx-tray-chips">
          <div
            v-for="p in trayChips"
            :key="p.id"
            class="fx-chip"
            @pointerdown.stop="onTrayChipDown(p, $event)"
          >
            <span class="fx-chip-dot" :style="{ background: genderColor(p.gender) }"></span>
            <span class="fx-chip-name">{{ trunc(p.name || 'Unnamed', 16) }}</span>
          </div>
          <div
            v-if="trayOverflow"
            class="fx-chip fx-chip-more"
            title="Filter the member list on the right and drag people in from there"
          >
            +{{ trayOverflow }} more
          </div>
        </div>
      </div>

      <!-- Faction edit popup -->
      <Transition name="fxpop">
        <div
          v-if="fEdit"
          class="fx-popup fx-fedit"
          :style="{ left: fEdit.px + 'px', top: fEdit.py + 'px' }"
          @pointerdown.stop
          @wheel.stop
          @click.stop
        >
          <div class="fx-popup-title">
            <span class="fx-mdot" :style="{ background: fEdit.color }"></span>
            Edit group
          </div>
          <input
            ref="fEditNameRef"
            v-model="fEdit.name"
            class="fx-input"
            placeholder="Group name"
            @keydown.enter="saveFactionEdit"
            @keydown.escape="fEdit = null"
          />
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
            >
              {{ ic }}
            </button>
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
        <div
          v-if="pPop && pPopPerson"
          class="fx-popup fx-ppop"
          :style="{ left: pPop.px + 'px', top: pPop.py + 'px' }"
          @pointerdown.stop
          @wheel.stop
          @click.stop
        >
          <div class="fx-popup-title">
            <span class="fx-mdot" :style="{ background: genderColor(pPopPerson.gender) }"></span>
            {{ pPopPerson.name || 'Unnamed' }}
          </div>
          <div class="fx-chips">
            <span
              v-for="f in pPopMemberships"
              :key="f.id"
              class="fx-fchip"
              :style="{ borderColor: f.color }"
            >
              <span class="fx-mdot" :style="{ background: f.color }"></span>
              {{ f.name }}
              <button
                class="fx-fchip-x"
                title="Remove from group"
                @click="store.removePersonFromGroup(pPop.id, f.id)"
              >
                ✕
              </button>
            </span>
            <span v-if="!pPopMemberships.length" class="fx-nochips">No groups yet</span>
          </div>
          <select v-if="pPopAddable.length" class="fx-select" @change="onAddToFaction($event)">
            <option value="" disabled selected>＋ Add to group…</option>
            <option v-for="f in pPopAddable" :key="f.id" :value="f.id">
              {{ f.icon }} {{ f.name }}
            </option>
          </select>
          <div class="fx-popup-actions">
            <button class="fx-pbtn" @click="openPersonProfile">Open profile</button>
            <span class="fx-popup-spacer"></span>
            <button class="fx-pbtn" @click="pPop = null">Close</button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Scene tab strip (this view's scenes = the old scenario bar) -->
    <SceneTabs
      ref="sceneTabsRef"
      :scenes="store.groupsScenes"
      :active-id="store.activeSceneId"
      label="Scenes"
      hint="Each scene keeps its own group placements — membership is shared"
      :tooltip="scenarioTooltip"
      add-title="New empty scene"
      duplicate-title="Duplicate current scene"
      delete-title="Delete scene"
      @switch="switchScenario"
      @create="addScenario(false)"
      @duplicate="addScenario(true)"
      @rename="(id, name) => store.renameScene(id, name)"
      @remove="handleDeleteScenario"
    >
      <template #badge="{ scene }">{{ peopleInScenario(scene.id) }}</template>
    </SceneTabs>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { forceSimulation, forceCollide, forceManyBody } from 'd3'
import { useMainStore } from '../store/index.js'
import { api } from '../api'
import {
  factionRadius,
  computeTargets,
  nextFactionPosition,
  arrangeInRing,
  membershipArcSpans
} from './factions/factionLayout.js'
import { FactionsRenderer } from './factions/webgl/FactionsRenderer.js'
import { withAlpha } from './webgl/overlayUtils.js'
import SceneTabs from './SceneTabs.vue'
import MiniMap from './MiniMap.vue'

const store = useMainStore()

// This view stays mounted while hidden (App keeps its GL context alive to avoid a
// white flash on view switches); `active` tells us when it's actually on screen.
const props = defineProps({ active: { type: Boolean, default: true } })

const NODE_R = 17
const PRESET_COLORS = [
  '#6c8ef5',
  '#f06292',
  '#f5a623',
  '#4caf72',
  '#a06cf5',
  '#26c6da',
  '#ef5350',
  '#8bc34a',
  '#ff8a65',
  '#7986cb'
]
const ICON_PRESETS = ['⚑', '🏰', '🛡', '⚔', '👑', '🎓', '🏢', '⚡', '🔥', '💧', '🌿', '🌙']
const MIN_K = 0.2
const MAX_K = 3
const GLIDE_MS = 480

// ── Viewport ────────────────────────────────────────────────────────────────
const stageEl = ref(null)
const glEl = ref(null)
const overlayEl = ref(null)
const stageW = ref(0)
const stageH = ref(0)
const tx = ref(0)
const ty = ref(0)
const k = ref(1)
const panning = ref(false)

let renderer = null
function syncCam() {
  renderer?.setCamera({ x: tx.value, y: ty.value, k: k.value })
  minimapRef.value?.redraw()
}

// ── Minimap (top-left) ──────────────────────────────────────────────────────
// Group rings draw as tinted discs in their own colour, members as small dots;
// dragging the frame pans the same camera the stage gestures drive.
const minimapRef = ref(null)
const minimapAdapter = {
  getBounds: () => {
    const zones = zonesData()
    if (!zones.length && !simNodes.length) return null
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity
    for (const z of zones) {
      minX = Math.min(minX, z.x - z.r)
      minY = Math.min(minY, z.y - z.r)
      maxX = Math.max(maxX, z.x + z.r)
      maxY = Math.max(maxY, z.y + z.r)
    }
    for (const n of simNodes) {
      minX = Math.min(minX, n.x)
      minY = Math.min(minY, n.y)
      maxX = Math.max(maxX, n.x)
      maxY = Math.max(maxY, n.y)
    }
    return { minX, minY, maxX, maxY }
  },
  getView: () => ({
    x: -tx.value / k.value,
    y: -ty.value / k.value,
    w: stageW.value / k.value,
    h: stageH.value / k.value
  }),
  drawContent: (g, proj, colors) => {
    for (const z of zonesData()) {
      const mx = z.x * proj.sx + proj.ox
      const my = z.y * proj.sy + proj.oy
      const mr = Math.max(2, z.r * proj.sx)
      g.beginPath()
      g.arc(mx, my, mr, 0, Math.PI * 2)
      g.fillStyle = withAlpha(z.color, 0.16)
      g.fill()
      g.strokeStyle = withAlpha(z.color, 0.55)
      g.lineWidth = 1
      g.stroke()
    }
    g.fillStyle = withAlpha(colors.t2, 0.7)
    for (const n of simNodes) {
      g.fillRect(n.x * proj.sx + proj.ox - 1, n.y * proj.sy + proj.oy - 1, 2, 2)
    }
  },
  panTo: (wx, wy, opts) => {
    const nk = k.value
    const ntx = stageW.value / 2 - wx * nk
    const nty = stageH.value / 2 - wy * nk
    if (opts?.smooth) {
      tweenView(nk, ntx, nty, 260)
    } else {
      cancelTween()
      tx.value = ntx
      ty.value = nty
      syncCam()
    }
  }
}

// ── Interaction state ───────────────────────────────────────────────────────
const hoverPersonId = ref(null)
const hoverFactionId = ref(null)
const hoverPillId = ref(null)
const hoverKind = ref(null) // 'person' | 'zone' | null — drives the cursor
const dragNode = ref(null) // sim node being dragged
const ghost = ref(null) // incoming person drag: { id, label, color, x, y, over }
const dropTargetId = ref(null) // faction ring under the current drag
const fEdit = ref(null) // faction edit popup model
const pPop = ref(null) // person popup: { id, px, py }
const fEditNameRef = ref(null)
const sceneTabsRef = ref(null)

// "Factions" here are the new Groups: tags placed in the active groups scene
// (identity + members from the tag, position/visibility from the placement).
const activeFactions = computed(() => store.activeGroups)
const visibleFactions = computed(() => activeFactions.value.filter((f) => f.visible !== false))

// ── Zone display positions (outside Vue reactivity; the renderer reads them) ─
// zonePos is what the stage draws and what the simulation steers toward; it
// tracks the persisted faction x/y except while a glide tween or a ring drag
// is animating it. Data coordinates are never mutated for animation.
let zonePos = new Map() // factionId -> { x, y }
const getZonePos = (f) => (f && zonePos.get(f.id)) || f

function syncZonePos() {
  const seen = new Set()
  for (const f of activeFactions.value) {
    seen.add(f.id)
    if (!zonePos.has(f.id)) zonePos.set(f.id, { x: f.x, y: f.y })
  }
  for (const id of [...zonePos.keys()]) {
    if (!seen.has(id)) zonePos.delete(id)
  }
}

// Glide tweens (scenario switch, auto-arrange). New tweens snapshot the
// current display position, so overlapping animations hand over smoothly
// instead of jumping.
let zoneTweens = new Map() // factionId -> { from: {x,y}, to: {x,y} }
let glideRaf = 0
let glideT0 = 0

function repaint() {
  renderer?.markGeomDirty()
  renderer?.requestRedraw()
  minimapRef.value?.redraw()
}

function startZoneTweens(entries) {
  if (!entries.length) return
  for (const e of entries) {
    zoneTweens.set(e.id, { from: { ...e.from }, to: { ...e.to } })
  }
  glideT0 = performance.now()
  sim?.alpha(0.6).restart() // members chase the moving rings
  if (!glideRaf) glideRaf = requestAnimationFrame(glideStep)
}

function glideStep(now) {
  const t = Math.min(1, (now - glideT0) / GLIDE_MS)
  const e = 1 - Math.pow(1 - t, 3)
  for (const [id, tw] of zoneTweens) {
    const p = zonePos.get(id)
    if (!p) {
      zoneTweens.delete(id)
      continue
    }
    p.x = tw.from.x + (tw.to.x - tw.from.x) * e
    p.y = tw.from.y + (tw.to.y - tw.from.y) * e
  }
  repaint()
  if (t < 1 && zoneTweens.size) {
    glideRaf = requestAnimationFrame(glideStep)
  } else {
    zoneTweens.clear()
    glideRaf = 0
  }
}

// ── Simulation (positions live outside Vue; ticks poke the renderer) ────────
let sim = null
let simNodes = []
let nodeById = new Map()
let pendingSpawn = null // { id, x, y } — where a freshly dropped person materialises

function forceAttract(alpha) {
  const targets = computeTargets(activeFactions.value, getZonePos)
  for (const n of simNodes) {
    const t = targets[n.id]
    if (!t) continue
    n.vx += (t.x - n.x) * 0.09 * alpha
    n.vy += (t.y - n.y) * 0.09 * alpha
  }
}

function rebuildNodes() {
  syncZonePos()
  const targets = computeTargets(activeFactions.value, getZonePos)
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
        y: spawn ? spawn.y : t.y + (Math.random() - 0.5) * 60
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
  renderer?.noteDataChange()
}

// Rebuild only when membership / visibility / the roster / the scenario
// changes — not on every faction x/y mutation during a ring drag (the attract
// force reads display positions live each tick anyway).
const membershipKey = computed(
  () =>
    store.persons.map((p) => p.id).join(',') +
    '|' +
    activeFactions.value
      .map((f) => `${f.id}:${f.visible === false ? 0 : 1}:${(f.member_ids || []).join('.')}`)
      .join(';')
)
watch(membershipKey, rebuildNodes)

// ── Scenario switching: zones of the SAME tag glide, everyone else pops ─────
// Group identity is the tag id, shared across scenes, so matching placements
// directly replaces the old fuzzy match-by-name.
watch(
  () => store.activeSceneId,
  (newId, oldId) => {
    fEdit.value = null
    pPop.value = null
    dropTargetId.value = null
    const oldByTag = new Map(
      store.sceneTags.filter((st) => st.scene_id === oldId).map((st) => [st.tag_id, st])
    )
    const newPlacements = store.sceneTags.filter((st) => st.scene_id === newId)
    const tweens = []
    for (const st of newPlacements) {
      const old = oldByTag.get(st.tag_id)
      if (!old) continue
      const from = zonePos.get(st.tag_id) ? { ...zonePos.get(st.tag_id) } : { x: old.x, y: old.y }
      zonePos.set(st.tag_id, { ...from })
      tweens.push({ id: st.tag_id, from, to: { x: st.x, y: st.y } })
    }
    startZoneTweens(tweens)
    if (newPlacements.some((st) => st.visible !== false)) fitAll(true)
  }
)

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
  activeFactions.value.forEach((f) => m.set(f.id, f))
  return m
})

// Live display list for the zones (persisted position unless gliding/dragging).
function zonesData() {
  return visibleFactions.value.map((f) => {
    const p = getZonePos(f)
    const count = (f.member_ids || []).length
    const label = trunc(f.name, 18)
    return {
      id: f.id,
      x: p.x,
      y: p.y,
      r: factionRadius(count),
      color: f.color,
      icon: f.icon,
      label,
      count,
      headerW: label.length * 7.2 + String(count).length * 7 + 44
    }
  })
}

const personById = computed(() => {
  const m = new Map()
  store.persons.forEach((p) => m.set(p.id, p))
  return m
})

/** Visible-faction ids for a person (active scenario) */
function factionIdsOf(personId) {
  return visibleFactions.value
    .filter((f) => (f.member_ids || []).includes(personId))
    .map((f) => f.id)
}

// Static per-person display data — recomputed on membership changes only,
// never per simulation tick (the renderer reads it through a hook).
const nodeMeta = computed(() => {
  const m = new Map()
  for (const p of store.persons) {
    const ids = factionIdsOf(p.id)
    if (!ids.length) continue
    const colors = ids.map((fid) => factionById.value.get(fid)?.color).filter(Boolean)
    const spans = membershipArcSpans(colors.length)
    m.set(p.id, {
      color: genderColor(p.gender),
      imageUrl: p.primary_image ? api.getImageUrl(p.primary_image) || null : null,
      label: trunc(p.name, 14),
      factionIds: ids,
      multi: ids.length > 1,
      count: ids.length,
      arcs: spans.map((s, i) => ({ a0: s.a0, a1: s.a1, color: colors[i] }))
    })
  }
  return m
})

const unassigned = computed(() => {
  const assigned = new Set()
  visibleFactions.value.forEach((f) => (f.member_ids || []).forEach((pid) => assigned.add(pid)))
  return store.persons
    .filter((p) => !assigned.has(p.id))
    .slice()
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
})

// The tray caps its chips — with thousands of unassigned people the sidebar
// member list (searchable, virtualized) is the better drag source anyway.
const TRAY_MAX = 60
const trayChips = computed(() => unassigned.value.slice(0, TRAY_MAX))
const trayOverflow = computed(() => Math.max(0, unassigned.value.length - TRAY_MAX))

const sharedCount = computed(() => {
  const seen = new Map()
  visibleFactions.value.forEach((f) =>
    (f.member_ids || []).forEach((pid) => seen.set(pid, (seen.get(pid) || 0) + 1))
  )
  let n = 0
  seen.forEach((count) => {
    if (count > 1) n++
  })
  return n
})

// ── Highlights (appearance only — never touches data) ──────────────────────
const activePersonId = computed(() => dragNode.value?.id || ghost.value?.id || hoverPersonId.value)

function personDimmed(id, factionIds) {
  if (activePersonId.value) {
    if (id === activePersonId.value) return false
    const mine = new Set(factionIdsOf(activePersonId.value))
    return !factionIds.some((fid) => mine.has(fid))
  }
  if (hoverFactionId.value) {
    return !factionIds.includes(hoverFactionId.value)
  }
  return false
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

// ── Per-item visual targets consumed (and tweened) by the renderer ──────────
function personVisual(id) {
  const factionIds = nodeMeta.value.get(id)?.factionIds || []
  const dimmed = personDimmed(id, factionIds)
  const grabbed = dragNode.value?.id === id
  const hovered = hoverPersonId.value === id
  const lit = hoverFactionId.value ? factionIds.includes(hoverFactionId.value) : false
  return {
    opacity: dimmed ? 0.22 : 1,
    scale: hovered || grabbed ? 1.12 : lit ? 1.08 : 1,
    grabbed,
    lit,
    tetherOp: dimmed ? 0.15 : 1
  }
}

function zoneVisual(id) {
  const lit = zoneLit(id)
  const droppable = id === dropTargetId.value
  return {
    opacity: zoneDimmed(id) ? 0.25 : 1,
    fillA: lit || droppable ? 0.16 : 0.07,
    ringA: lit ? 0.95 : 0.55,
    ringW: lit ? 2.4 : 1.6,
    dropA: droppable ? 1 : 0,
    pillHover: hoverPillId.value === id
  }
}

// Bright membership links for the hovered / dragged person.
function activeLinksData() {
  const pid = activePersonId.value
  if (!pid) return []
  const n = nodeById.get(pid)
  if (!n) return []
  const out = []
  for (const fid of factionIdsOf(pid)) {
    const f = factionById.value.get(fid)
    if (!f) continue
    const p = getZonePos(f)
    out.push({ x1: n.x, y1: n.y, x2: p.x, y2: p.y, color: f.color })
  }
  return out
}

// ── Coordinate helpers ──────────────────────────────────────────────────────
function toWorld(e) {
  const rect = stageEl.value.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left - tx.value) / k.value,
    y: (e.clientY - rect.top - ty.value) / k.value
  }
}

function toScreen(e) {
  const rect = stageEl.value.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

/** Smallest visible ring containing the world point — the intended drop target */
function zoneAt(w) {
  let best = null
  for (const z of zonesData()) {
    if (Math.hypot(z.x - w.x, z.y - w.y) <= z.r && (!best || z.r < best.r)) best = z
  }
  return best
}

function clampPopup(x, y, w, h) {
  return {
    px: Math.min(Math.max(8, x), Math.max(8, stageW.value - w - 8)),
    py: Math.min(Math.max(8, y), Math.max(8, stageH.value - h - 8))
  }
}

// ── Pointer routing: person > header pill > zone > pan ──────────────────────
// Every stage handler bails when the stage ref is gone: during the view-switch
// leave transition the DOM (and its listeners) outlives the component.
function onStageDown(e) {
  if (e.button !== 0 || !stageEl.value || !renderer) return
  cancelTween()
  const w = toWorld(e)
  const person = renderer?.pickPerson(w.x, w.y)
  if (person) {
    startNodeDrag(person, e)
    return
  }
  const s = toScreen(e)
  const pill = renderer?.pillAt(s.x, s.y)
  const zid = pill ? pill.id : zoneAt(w)?.id
  if (zid) {
    startZoneDrag(zid, e)
    return
  }
  startPan(e)
}

function onStageHover(e) {
  if (!stageEl.value || !renderer) return
  if (panning.value || dragNode.value || zoneDrag || trayDrag) return
  const w = toWorld(e)
  const person = renderer?.pickPerson(w.x, w.y)
  if (person) {
    hoverPersonId.value = person.id
    hoverPillId.value = null
    hoverKind.value = 'person'
    return
  }
  hoverPersonId.value = null
  const s = toScreen(e)
  const pill = renderer?.pillAt(s.x, s.y)
  const zid = pill ? pill.id : zoneAt(w)?.id || null
  hoverPillId.value = pill ? pill.id : null
  hoverFactionId.value = zid
  hoverKind.value = zid ? 'zone' : null
}

function onStageLeave() {
  hoverPersonId.value = null
  hoverFactionId.value = null
  hoverPillId.value = null
  hoverKind.value = null
}

function onStageDblClick(e) {
  if (!stageEl.value || !renderer) return
  const w = toWorld(e)
  const person = renderer?.pickPerson(w.x, w.y)
  if (person) {
    pPop.value = null
    store.selectPerson(person.id)
  }
}

// ── Pan & zoom ──────────────────────────────────────────────────────────────
let panStart = null
let suppressClick = false

function startPan(e) {
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
  syncCam()
}

function onPanUp() {
  suppressClick = !!panStart?.moved
  panStart = null
  panning.value = false
  window.removeEventListener('pointermove', onPanMove)
  window.removeEventListener('pointerup', onPanUp)
}

function onWheel(e) {
  if (!stageEl.value) return
  cancelTween()
  const rect = stageEl.value.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const factor = Math.exp(-e.deltaY * 0.0022)
  const nk = Math.min(MAX_K, Math.max(MIN_K, k.value * factor))
  tx.value = mx - (mx - tx.value) * (nk / k.value)
  ty.value = my - (my - ty.value) * (nk / k.value)
  k.value = nk
  syncCam()
}

function onStageClick() {
  if (suppressClick) {
    suppressClick = false
    return
  }
  fEdit.value = null
  pPop.value = null
}

// ── Smooth tween for zoom buttons / fit ─────────────────────────────────────
let tweenRaf = 0
function cancelTween() {
  if (tweenRaf) {
    cancelAnimationFrame(tweenRaf)
    tweenRaf = 0
  }
}

function tweenView(targetK, targetTx, targetTy, ms = 340) {
  cancelTween()
  const s = { k: k.value, tx: tx.value, ty: ty.value }
  const t0 = performance.now()
  const ease = (t) => 1 - Math.pow(1 - t, 3)
  const step = (now) => {
    const t = Math.min(1, (now - t0) / ms)
    const e = ease(t)
    k.value = s.k + (targetK - s.k) * e
    tx.value = s.tx + (targetTx - s.tx) * e
    ty.value = s.ty + (targetTy - s.ty) * e
    syncCam()
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

// Fit uses the persisted (target) faction positions, so fitting during a
// glide frames the final layout rather than a mid-animation snapshot.
function fitAll(animate = false) {
  if (!stageW.value) return
  const fs = visibleFactions.value
  if (!fs.length) {
    if (animate) tweenView(1, stageW.value / 2, stageH.value / 2)
    else {
      k.value = 1
      tx.value = stageW.value / 2
      ty.value = stageH.value / 2
      syncCam()
    }
    return
  }
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const f of fs) {
    const r = factionRadius((f.member_ids || []).length)
    minX = Math.min(minX, f.x - r)
    minY = Math.min(minY, f.y - r - 44) // room for the header pill
    maxX = Math.max(maxX, f.x + r)
    maxY = Math.max(maxY, f.y + r)
  }
  const w = Math.max(200, maxX - minX)
  const h = Math.max(200, maxY - minY)
  const nk = Math.min(
    MAX_K,
    Math.max(MIN_K, Math.min((stageW.value - 120) / w, (stageH.value - 140) / h))
  )
  const ntx = stageW.value / 2 - ((minX + maxX) / 2) * nk
  const nty = stageH.value / 2 - ((minY + maxY) / 2) * nk
  if (animate) tweenView(nk, ntx, nty)
  else {
    k.value = nk
    tx.value = ntx
    ty.value = nty
    syncCam()
  }
}

// ── Image export ────────────────────────────────────────────────────────────
// Capture the whole stage, fit-all, at the requested pixel size (mirrors
// fitAll()'s zone bounds but against the export dimensions, with margins that
// scale with the output instead of the on-screen clamp).
function exportImage({ width, height, light = null }) {
  const fs = visibleFactions.value
  if (!renderer || (!fs.length && !simNodes.length)) return null
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const f of fs) {
    const p = getZonePos(f)
    const r = factionRadius((f.member_ids || []).length)
    minX = Math.min(minX, p.x - r)
    minY = Math.min(minY, p.y - r - 44) // room for the header pill
    maxX = Math.max(maxX, p.x + r)
    maxY = Math.max(maxY, p.y + r)
  }
  for (const n of simNodes) {
    minX = Math.min(minX, n.x - 30)
    minY = Math.min(minY, n.y - 30)
    maxX = Math.max(maxX, n.x + 30)
    maxY = Math.max(maxY, n.y + 40)
  }
  const w = Math.max(200, maxX - minX)
  const h = Math.max(200, maxY - minY)
  const maxK = Math.max(3, (2.5 * width) / 1200)
  const nk = Math.max(0.02, Math.min(maxK, Math.min((width * 0.9) / w, (height * 0.9) / h)))
  const transform = {
    x: width / 2 - ((minX + maxX) / 2) * nk,
    y: height / 2 - ((minY + maxY) / 2) * nk,
    k: nk
  }
  return renderer.exportFrame({ width, height, transform, light })
}

defineExpose({ exportImage })

// ── Faction ring dragging ───────────────────────────────────────────────────
let zoneDrag = null

function startZoneDrag(fid, e) {
  const f = factionById.value.get(fid)
  if (!f) return
  zoneTweens.delete(fid) // a grab overrides any running glide for this ring
  const p = getZonePos(f)
  const w = toWorld(e)
  zoneDrag = { f, offX: w.x - p.x, offY: w.y - p.y, startX: p.x, startY: p.y, moved: false }
  sim?.alphaTarget(0.35).restart()
  window.addEventListener('pointermove', onZoneMove)
  window.addEventListener('pointerup', onZoneUp)
}

function onZoneMove(e) {
  if (!zoneDrag) return
  const w = toWorld(e)
  const nx = w.x - zoneDrag.offX
  const ny = w.y - zoneDrag.offY
  if (!zoneDrag.moved && Math.hypot(nx - zoneDrag.startX, ny - zoneDrag.startY) > 3 / k.value) {
    zoneDrag.moved = true
  }
  if (!zoneDrag.moved) return
  const p = zonePos.get(zoneDrag.f.id)
  if (p) {
    p.x = nx
    p.y = ny
    repaint()
  }
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
    const p = zonePos.get(f.id)
    if (p) store.moveGroup(f.id, Math.round(p.x), Math.round(p.y))
  } else {
    openFactionEdit(f.id, e)
  }
}

// ── Person node dragging ────────────────────────────────────────────────────
let nodeDrag = null

function startNodeDrag(n, e) {
  nodeDrag = { n, moved: false, downX: e.clientX, downY: e.clientY }
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
    store.addPersonToGroup(n.id, z.id)
  } else if (!z && memberships.length === 1) {
    // Deliberately pulled out of their only faction — back to the tray
    store.removePersonFromGroup(n.id, memberships[0])
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
  const over =
    e.clientX >= rect.left &&
    e.clientX <= rect.right &&
    e.clientY >= rect.top &&
    e.clientY <= rect.bottom
  const w = toWorld(e)
  ghost.value = {
    id: trayDrag.p.id,
    label: trunc(trayDrag.p.name, 14),
    color: genderColor(trayDrag.p.gender),
    x: w.x,
    y: w.y,
    over
  }
  dropTargetId.value = over ? zoneAt(w)?.id || null : null
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
    store.addPersonToGroup(p.id, target)
  }
}

// ── Member-list drag-in (HTML5 dnd from the right sidebar) ─────────────────
function onSidebarDragOver(e) {
  const pid = store.draggingPersonId
  if (!pid || !stageEl.value) return
  e.dataTransfer.dropEffect = 'copy'
  const w = toWorld(e)
  // Only ghost people who aren't already on stage — assigned people get the
  // drop-ring highlight without a duplicate avatar
  if (!nodeById.has(pid)) {
    const p = personById.value.get(pid)
    if (p) {
      ghost.value = {
        id: pid,
        label: trunc(p.name, 14),
        color: genderColor(p.gender),
        x: w.x,
        y: w.y,
        over: true
      }
    }
  }
  dropTargetId.value = zoneAt(w)?.id || null
}

function onSidebarDragLeave(e) {
  if (!store.draggingPersonId) return
  if (e.relatedTarget && stageEl.value?.contains(e.relatedTarget)) return
  ghost.value = null
  dropTargetId.value = null
}

function onSidebarDrop(e) {
  const pid = store.draggingPersonId || e.dataTransfer.getData('text/plain')
  ghost.value = null
  const target = dropTargetId.value
  dropTargetId.value = null
  if (!pid || !target || !stageEl.value) return
  const f = factionById.value.get(target)
  if (!f || (f.member_ids || []).includes(pid)) return
  const w = toWorld(e)
  if (!nodeById.has(pid)) pendingSpawn = { id: pid, x: w.x, y: w.y }
  store.addPersonToGroup(pid, target)
}

// Ghost/highlight must not outlive an aborted sidebar drag (Esc, drop outside)
watch(
  () => store.draggingPersonId,
  (pid) => {
    if (!pid && !trayDrag) {
      ghost.value = null
      dropTargetId.value = null
    }
  }
)

// ── Faction create / edit / arrange ─────────────────────────────────────────
async function handleCreateFaction() {
  const cx = (stageW.value / 2 - tx.value) / k.value
  const cy = (stageH.value / 2 - ty.value) / k.value
  const pos = nextFactionPosition(activeFactions.value, cx, cy)
  const res = await store.createGroup({
    name: `Group ${activeFactions.value.length + 1}`,
    color: PRESET_COLORS[activeFactions.value.length % PRESET_COLORS.length],
    icon: ICON_PRESETS[activeFactions.value.length % ICON_PRESETS.length],
    x: Math.round(pos.x),
    y: Math.round(pos.y)
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
    color: f.color,
    icon: f.icon,
    px,
    py
  }
  nextTick(() => fEditNameRef.value?.focus())
}

async function saveFactionEdit() {
  if (!fEdit.value) return
  const { id, name, color, icon } = fEdit.value
  fEdit.value = null
  await store.updateGroup({
    id,
    name: name.trim() || 'Unnamed Group',
    color,
    icon
  })
}

async function handleDeleteFaction() {
  if (!fEdit.value) return
  const f = factionById.value.get(fEdit.value.id)
  const count = (f?.member_ids || []).length
  const ok = confirm(
    `Delete "${f?.name}"?${count ? ` Its ${count} member${count === 1 ? '' : 's'} stay in your project.` : ''}`
  )
  if (!ok) return
  const id = fEdit.value.id
  fEdit.value = null
  await store.deleteGroup(id)
}

function toggleVisible(f) {
  hoverFactionId.value = null
  store.setGroupVisible(f.id, f.visible === false)
}

async function autoArrange() {
  const cx = (stageW.value / 2 - tx.value) / k.value
  const cy = (stageH.value / 2 - ty.value) / k.value
  const placed = arrangeInRing(visibleFactions.value, cx, cy)
  startZoneTweens(
    placed.map((p) => {
      const cur = zonePos.get(p.id) || { x: p.x, y: p.y }
      return { id: p.id, from: cur, to: { x: p.x, y: p.y } }
    })
  )
  await Promise.all(placed.map((p) => store.moveGroup(p.id, Math.round(p.x), Math.round(p.y))))
  fitAll(true)
}

// ── Person popup ────────────────────────────────────────────────────────────
function openPersonPopup(id, e) {
  fEdit.value = null
  const s = toScreen(e)
  const { px, py } = clampPopup(s.x + 12, s.y + 12, 240, 220)
  pPop.value = { id, px, py }
}

const pPopPerson = computed(() => (pPop.value ? personById.value.get(pPop.value.id) : null))
const pPopMemberships = computed(() =>
  pPop.value ? activeFactions.value.filter((f) => (f.member_ids || []).includes(pPop.value.id)) : []
)
const pPopAddable = computed(() =>
  pPop.value
    ? activeFactions.value.filter((f) => !(f.member_ids || []).includes(pPop.value.id))
    : []
)

function onAddToFaction(e) {
  const fid = e.target.value
  e.target.value = ''
  if (fid && pPop.value) store.addPersonToGroup(pPop.value.id, fid)
}

function openPersonProfile() {
  if (!pPop.value) return
  store.selectPerson(pPop.value.id)
  pPop.value = null
}

// ── Scenario bar ────────────────────────────────────────────────────────────
const peopleByScenario = computed(() => {
  const m = new Map()
  for (const st of store.sceneTags) {
    if (st.visible === false) continue
    let set = m.get(st.scene_id)
    if (!set) m.set(st.scene_id, (set = new Set()))
    for (const pid of store.membersOf.get(st.tag_id) || []) set.add(pid)
  }
  return m
})

function peopleInScenario(sid) {
  return peopleByScenario.value.get(sid)?.size || 0
}

function scenarioTooltip(s) {
  const fCount = store.sceneTags.filter((st) => st.scene_id === s.id).length
  return `${fCount} group${fCount === 1 ? '' : 's'} · ${peopleInScenario(s.id)} people in scene`
}

function switchScenario(id) {
  store.setActiveScene('groups', id)
}

async function addScenario(duplicate) {
  const name = `Scene ${store.groupsScenes.length + 1}`
  const res = duplicate
    ? await store.duplicateScene(store.activeSceneId, name)
    : await store.createScene('groups', name)
  if (res?.success) {
    const scene = duplicate ? res.data.scene : res.data
    store.setActiveScene('groups', scene.id)
    sceneTabsRef.value?.startRename(scene)
  }
}

async function handleDeleteScenario(s) {
  const fCount = store.sceneTags.filter((st) => st.scene_id === s.id).length
  const ok = confirm(
    `Delete scene "${s.name}"${fCount ? ` and its ${fCount} group placement${fCount === 1 ? '' : 's'}` : ''}? People and groups stay.`
  )
  if (ok) await store.deleteScene(s.id)
}

// ── Lifecycle ───────────────────────────────────────────────────────────────
let ro = null
let hasFitted = false
onMounted(() => {
  const measure = () => {
    stageW.value = stageEl.value?.clientWidth || 0
    stageH.value = stageEl.value?.clientHeight || 0
    renderer?.resize(stageW.value, stageH.value)
  }
  renderer = new FactionsRenderer({
    glCanvas: glEl.value,
    overlayCanvas: overlayEl.value,
    hooks: {
      getNodes: () => simNodes,
      getMeta: () => nodeMeta.value,
      getZones: zonesData,
      getActiveLinks: activeLinksData,
      getGhost: () => ghost.value,
      personVisual,
      zoneVisual
    }
  })
  renderer.setTheme(store.theme === 'light')
  measure()
  // Ignore size reports while hidden (display:none reports 0×0, which would
  // corrupt the pan/zoom state); re-measure only when actually laid out.
  ro = new ResizeObserver(() => {
    if (!stageEl.value?.clientWidth) return
    measure()
  })
  if (stageEl.value) ro.observe(stageEl.value)

  sim = forceSimulation([])
    .force('attract', forceAttract)
    .force(
      'collide',
      forceCollide()
        .radius(NODE_R + 8)
        .strength(0.85)
    )
    .force('charge', forceManyBody().strength(-26).distanceMax(130))
    .alphaDecay(0.03)
    .on('tick', repaint)
  rebuildNodes()
  nextTick(() => {
    measure()
    if (props.active && stageW.value) {
      fitAll(false)
      syncCam()
      hasFitted = true
    }
  })

  // Coming back into view: fit once (first reveal), otherwise keep the user's
  // pan/zoom and just re-sync to the current stage size.
  watch(
    () => props.active,
    (on) => {
      if (!on) return
      nextTick(() => {
        measure()
        if (!stageW.value) return
        if (!hasFitted) {
          fitAll(false)
          hasFitted = true
        }
        syncCam()
      })
    }
  )
})

// Appearance-only state → re-sync style targets (the renderer tweens toward them).
watch([hoverPersonId, hoverFactionId, hoverPillId, dropTargetId, dragNode, ghost], () =>
  renderer?.markStylesDirty()
)
// Meta changes (memberships, colours, renames) also change arc counts → full rebuild.
watch(nodeMeta, () => {
  renderer?.markAllDirty()
  renderer?.requestRedraw()
})
watch(
  () => store.theme,
  () => renderer?.setTheme(store.theme === 'light')
)

onBeforeUnmount(() => {
  sim?.stop()
  sim = null
  if (ro) ro.disconnect()
  cancelTween()
  if (glideRaf) {
    cancelAnimationFrame(glideRaf)
    glideRaf = 0
  }
  zoneTweens.clear()
  window.removeEventListener('pointermove', onPanMove)
  window.removeEventListener('pointerup', onPanUp)
  window.removeEventListener('pointermove', onZoneMove)
  window.removeEventListener('pointerup', onZoneUp)
  window.removeEventListener('pointermove', onNodeMove)
  window.removeEventListener('pointerup', onNodeUp)
  window.removeEventListener('pointermove', onTrayMove)
  window.removeEventListener('pointerup', onTrayUp)
  renderer?.dispose()
  renderer = null
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
    radial-gradient(1100px 560px at 80% -10%, rgba(108, 142, 245, 0.07), transparent 60%), var(--bg);
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
.fx-heading {
  display: flex;
  align-items: center;
  gap: 10px;
}
.fx-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: var(--t1);
}
.fx-count {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  background: var(--adim);
  padding: 2px 9px;
  border-radius: 20px;
}
.fx-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.fx-hint {
  font-size: 11px;
  color: var(--t3);
  font-weight: 500;
}

/* ── Stage ───────────────────────────────────────────────── */
.fx-stage {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
}
.fx-stage.panning,
.fx-stage.grabbing {
  cursor: grabbing;
}
.fx-stage.hover-person:not(.panning):not(.grabbing) {
  cursor: grab;
}
.fx-stage.hover-zone:not(.panning):not(.grabbing) {
  cursor: move;
}
.fx-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

/* ── Zoom controls (shared control-bar style) ────────────── */
.fx-controls {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 5px;
  border-radius: 12px;
  box-shadow: var(--shadow);
  cursor: default;
}
.fx-ctrl-btn {
  border: none;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 15px;
  width: 30px;
  height: 30px;
  border-radius: 7px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.12s,
    color 0.12s;
}
.fx-ctrl-btn:hover {
  background: var(--hover);
  color: var(--t1);
}
.fx-zoom-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--t3);
  min-width: 42px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  padding: 0 6px;
}
.fx-ctrl-sep {
  width: 1px;
  align-self: stretch;
  background: var(--border);
  margin: 3px 2px;
}

/* ── Manager panel ───────────────────────────────────────── */
.fx-manager {
  position: absolute;
  top: 14px;
  right: 16px;
  z-index: 5;
  background: var(--glass-soft);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 12px 10px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 190px;
  max-width: 250px;
  max-height: 45%;
  overflow-y: auto;
  cursor: default;
}
.fx-panel-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--t3);
  padding: 0 4px 6px;
}
.fx-mrow {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 6px;
  border-radius: 8px;
  transition:
    background 0.12s,
    opacity 0.2s;
}
.fx-mrow:hover {
  background: var(--hover);
}
.fx-mrow.off {
  opacity: 0.45;
}
.fx-mdot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.fx-mname {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--t1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fx-mcount {
  font-size: 11px;
  font-weight: 700;
  color: var(--t3);
  font-variant-numeric: tabular-nums;
}
.fx-mbtn {
  border: none;
  background: transparent;
  color: var(--t3);
  width: 22px;
  height: 22px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  transition:
    background 0.12s,
    color 0.12s;
  opacity: 0;
}
.fx-mrow:hover .fx-mbtn,
.fx-mrow.off .fx-mbtn:first-of-type {
  opacity: 1;
}
.fx-mbtn:hover {
  background: var(--adim);
  color: var(--accent);
}
.fx-mfoot {
  font-size: 10px;
  color: var(--t3);
  font-weight: 500;
  padding: 6px 4px 0;
  border-top: 1px solid var(--border);
  margin-top: 6px;
}

/* ── Unassigned tray ─────────────────────────────────────── */
.fx-tray {
  position: absolute;
  bottom: 18px;
  left: 16px;
  z-index: 5;
  background: var(--glass-soft);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 12px;
  box-shadow: var(--shadow);
  max-width: 300px;
  cursor: default;
}
.fx-tray-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--t3);
  display: flex;
  align-items: center;
  gap: 6px;
}
.fx-tray-count {
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  background: var(--adim);
  padding: 0 6px;
  border-radius: 8px;
}
.fx-tray-hint {
  font-size: 10px;
  color: var(--t3);
  opacity: 0.8;
  margin: 2px 0 7px;
}
.fx-tray-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  max-height: 96px;
  overflow-y: auto;
}
.fx-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 7px;
  background: var(--elevated);
  border: 1px solid var(--border);
  border-radius: 20px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--t2);
  cursor: grab;
  user-select: none;
  transition:
    border-color 0.15s,
    color 0.15s,
    transform 0.15s;
}
.fx-chip:hover {
  border-color: var(--accent);
  color: var(--t1);
  transform: translateY(-1px);
}
.fx-chip:active {
  cursor: grabbing;
}
.fx-chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.fx-chip-more {
  cursor: help;
  color: var(--t3);
  border-style: dashed;
}
.fx-chip-more:hover {
  border-color: var(--border);
  color: var(--t3);
  transform: none;
}

/* ── Popups (shared) ─────────────────────────────────────── */
.fx-popup {
  position: absolute;
  z-index: 6;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 13px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  cursor: default;
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.fx-fedit {
  width: 260px;
}
.fx-ppop {
  width: 240px;
}

.fx-popup-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--t1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fx-input,
.fx-select {
  font-size: 12px;
  padding: 7px 9px;
}

.fx-swatch-row {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}
.fx-swatch {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  transition:
    transform 0.15s,
    border-color 0.15s;
}
.fx-swatch:hover {
  transform: scale(1.18);
}
.fx-swatch.active {
  border-color: var(--t1);
  transform: scale(1.12);
}

.fx-icon-row {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}
.fx-icon-opt {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.12s,
    border-color 0.12s;
}
.fx-icon-opt:hover {
  background: var(--hover);
}
.fx-icon-opt.active {
  background: var(--adim);
  border-color: var(--accent);
}

.fx-popup-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.fx-popup-spacer {
  flex: 1;
}
.fx-pbtn {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 11.5px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.13s;
}
.fx-pbtn:hover {
  background: var(--hover);
  color: var(--t1);
}
.fx-pbtn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.fx-pbtn.primary:hover {
  filter: brightness(1.1);
}
.fx-pbtn.danger {
  border-color: rgba(239, 83, 80, 0.35);
  color: #ef5350;
}
.fx-pbtn.danger:hover {
  background: rgba(239, 83, 80, 0.12);
}

.fx-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.fx-fchip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 7px;
  background: var(--elevated);
  border: 1px solid;
  border-radius: 14px;
  font-size: 11px;
  font-weight: 600;
  color: var(--t1);
}
.fx-fchip-x {
  border: none;
  background: transparent;
  color: var(--t3);
  font-size: 9px;
  cursor: pointer;
  padding: 1px 2px;
  border-radius: 4px;
  transition: color 0.12s;
}
.fx-fchip-x:hover {
  color: #ef5350;
}
.fx-nochips {
  font-size: 11px;
  color: var(--t3);
  font-style: italic;
}

.fxpop-enter-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.fxpop-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}
.fxpop-enter-from,
.fxpop-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.96);
}

/* ── Empty state ─────────────────────────────────────────── */
.fx-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 10px;
  color: var(--t2);
}
.fx-empty-icon {
  font-size: 44px;
  opacity: 0.55;
  color: var(--accent);
}
.fx-empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--t1);
}
.fx-empty-text {
  font-size: 13px;
  max-width: 340px;
  margin-bottom: 6px;
}
</style>
