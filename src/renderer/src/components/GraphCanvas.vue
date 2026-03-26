<template>
  <div class="graph-area" ref="containerRef">
    <svg ref="svgRef" class="graph-svg"></svg>
    <div class="graph-search">
      <span class="search-icon">🔍</span>
      <input v-model="searchQuery" placeholder="Search family members…" @input="highlightSearch" />
    </div>
    <div class="graph-controls">
      <button class="ctrl-btn" @click="zoomIn" title="Zoom in">＋</button>
      <button class="ctrl-btn" @click="zoomOut" title="Zoom out">－</button>
      <div class="ctrl-sep"></div>
      <button class="ctrl-btn" @click="fitAll" title="Fit all">⊡</button>
      <button class="ctrl-btn" @click="resetZoom" title="Reset view">⊕</button>
      <div class="ctrl-sep"></div>
      <button
        v-for="m in modes"
        :key="m.id"
        class="ctrl-btn ctrl-btn-wide"
        :class="{ 'ctrl-btn-active': currentMode === m.id }"
        @click="switchMode(m.id)"
        :title="m.title"
      >{{ m.label }}</button>
      <div class="ctrl-sep"></div>
      <button
        class="ctrl-btn ctrl-btn-wide"
        :class="emphBtnClass('neutral')"
        @click="cycleEmphasis('neutral')"
        title="No emphasis"
      >◯ Neutral</button>
      <button
        class="ctrl-btn ctrl-btn-wide"
        :class="emphBtnClass('paternal')"
        @click="cycleEmphasis('paternal')"
        title="Paternal emphasis — click twice to save layout"
      ><span class="emph-label">♂ Paternal</span><span v-if="isHardPaternal" class="emph-bar emph-bar-pat"></span></button>
      <button
        class="ctrl-btn ctrl-btn-wide"
        :class="emphBtnClass('maternal')"
        @click="cycleEmphasis('maternal')"
        title="Maternal emphasis — click twice to save layout"
      ><span class="emph-label">♀ Maternal</span><span v-if="isHardMaternal" class="emph-bar emph-bar-mat"></span></button>
      <div class="ctrl-sep"></div>
      <button
        class="ctrl-btn"
        :class="{ 'ctrl-btn-lock': store.lockNodes }"
        @click="store.lockNodes = !store.lockNodes"
        title="Lock/unlock node clicks"
      >{{ store.lockNodes ? '🔒' : '👤' }}</button>
      <button
        class="ctrl-btn"
        :class="{ 'ctrl-btn-lock': store.lockLines }"
        @click="store.lockLines = !store.lockLines"
        title="Lock/unlock line clicks"
      >{{ store.lockLines ? '🔒' : '🔗' }}</button>
    </div>
    <!-- Relationship popup -->
    <Transition name="relpop">
      <div v-if="store.relPopup" class="rel-popup" :style="relPopupStyle" @click.stop>
        <button class="rel-popup-close" @click="store.relPopup = null">✕</button>
        <div class="rel-popup-type">{{ relPopupTypeLabel }}</div>
        <div class="rel-popup-people">{{ relPopupPersonA }} — {{ relPopupPersonB }}</div>
        <div v-if="relPopupFormedLabel" class="rel-popup-date">{{ relPopupFormedLabel }}</div>
        <div v-if="relPopupStatus" class="rel-popup-status" :class="relPopupStatus">{{ relPopupStatus }}</div>
      </div>
    </Transition>
    <div class="graph-legend">
      <div class="leg-row"><div class="leg-dot" style="background:#3a7bd5"></div>Male</div>
      <div class="leg-row"><div class="leg-dot" style="background:#c95fa0"></div>Female</div>
      <div class="leg-row"><div class="leg-line" style="background:#8b6cc5"></div>Parent/Child</div>
      <div class="leg-row"><div class="leg-line leg-dashed" style="border-color:#f06292"></div>Spouse</div>
      <div class="leg-row"><div class="leg-line leg-dashed" style="border-color:#f5a623"></div>Adopted</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import * as d3 from 'd3'
import { useMainStore } from '../store/index.js'

const store = useMainStore()

// Relationship popup computed properties
const relPopupStyle = computed(() => {
  if (!store.relPopup) return {}
  return { left: store.relPopup.x + 'px', top: store.relPopup.y + 'px' }
})
const relPopupTypeLabel = computed(() => {
  if (!store.relPopup) return ''
  const r = store.relPopup.rel
  if (r.type === 'spouse') return r.status === 'divorced' ? 'Divorced' : 'Married'
  if (r.type === 'parent_child') return 'Parent / Child'
  if (r.type === 'adopted') return 'Adopted'
  return r.type
})
const relPopupPersonA = computed(() => {
  if (!store.relPopup) return ''
  const p = store.persons.find(x => x.id === store.relPopup.rel.person_a_id)
  return p ? p.name : '?'
})
const relPopupPersonB = computed(() => {
  if (!store.relPopup) return ''
  const p = store.persons.find(x => x.id === store.relPopup.rel.person_b_id)
  return p ? p.name : '?'
})
const relPopupFormedLabel = computed(() => {
  if (!store.relPopup) return ''
  const r = store.relPopup.rel
  if (r.formed_date) {
    if (r.type === 'spouse') return `Married: ${r.formed_date}`
    return `Since: ${r.formed_date}`
  }
  // For parent_child, use child's birth year
  if (r.type === 'parent_child') {
    const child = store.persons.find(x => x.id === r.person_b_id)
    if (child?.birth_year) return `Born: ${child.birth_year}`
  }
  return ''
})
const relPopupStatus = computed(() => {
  if (!store.relPopup) return ''
  return store.relPopup.rel.status === 'divorced' ? 'divorced' : ''
})
const svgRef = ref(null)
const containerRef = ref(null)
const searchQuery = ref('')
const currentMode = ref('auto')

const modes = [
  { id: 'custom', label: '✋ Custom', title: 'Freely position nodes' },
  { id: 'auto', label: '⚡ Auto', title: 'Force-directed layout' },
  { id: 'age', label: '📅 Age', title: 'Sort by birth year' },
  { id: 'generation', label: '🏛 Gen', title: 'Generational layout' }
]

// Emphasis: neutral | paternal | hard_paternal | maternal | hard_maternal
// Per-mode emphasis memory
const modeEmphasis = { custom: 'neutral', auto: 'neutral', age: 'neutral', generation: 'neutral' }
const activeEmphasis = ref('neutral')

const isHardPaternal = computed(() => activeEmphasis.value === 'hard_paternal')
const isHardMaternal = computed(() => activeEmphasis.value === 'hard_maternal')
const isHard = computed(() => isHardPaternal.value || isHardMaternal.value)

// Per-mode hard state position snapshots
const hardSnapshots = {
  custom: { paternal: null, maternal: null },
  auto: { paternal: null, maternal: null },
  age: { paternal: null, maternal: null },
  generation: { paternal: null, maternal: null },
}

function emphBtnClass(which) {
  const e = activeEmphasis.value
  if (which === 'neutral') {
    return { 'ctrl-btn-emph-active': e === 'neutral' }
  }
  if (which === 'paternal') {
    return {
      'ctrl-btn-emph-active': e === 'paternal' || e === 'hard_paternal',
      'ctrl-btn-paternal': e === 'paternal' || e === 'hard_paternal',
      'ctrl-btn-hard': e === 'hard_paternal',
    }
  }
  if (which === 'maternal') {
    return {
      'ctrl-btn-emph-active': e === 'maternal' || e === 'hard_maternal',
      'ctrl-btn-maternal': e === 'maternal' || e === 'hard_maternal',
      'ctrl-btn-hard': e === 'hard_maternal',
    }
  }
  return {}
}

// Emphasis visual type for rendering (soft paternal/maternal or hard use same visuals)
function emphVisual() {
  const e = activeEmphasis.value
  if (e === 'paternal' || e === 'hard_paternal') return 'paternal'
  if (e === 'maternal' || e === 'hard_maternal') return 'maternal'
  return 'neutral'
}

// D3 internal state — plain JS, NOT reactive
let simulation = null
let zoomBehavior = null
let svgSelection = null
let rootGroup = null
let nodesData = []
let linksData = []
let resizeObserver = null
let animTimer = null
let dragBehavior = null

// Per-mode saved positions: { custom: {id:{x,y}}, auto: {…}, age: {…}, generation: {…} }
const modeSnapshots = { custom: null, auto: null, age: null, generation: null }

// Generation row Y-values for snapping (set when entering generation mode)
let genRowYValues = []
let genRowSpacing = 140  // spacing between gen rows
let genPreviewLine = null // d3 selection for the preview "new gen" line
let guideLineElements = [] // [{lineEl, textEl}] for live width updates

function nodeColor(gender) {
  const gs = store.graphSettings
  if (gender === 'male') return gs.maleColor
  if (gender === 'female') return gs.femaleColor
  return gs.unknownColor
}

// ── Snapshot / Restore ──────────────────────────────────────────────────────

function snapshotMode(mode) {
  const snap = {}
  nodesData.forEach(n => { snap[n.id] = { x: n.x, y: n.y } })
  modeSnapshots[mode] = snap
}

function hasSnapshot(mode) {
  return modeSnapshots[mode] && Object.keys(modeSnapshots[mode]).length > 0
}

// ── Init ────────────────────────────────────────────────────────────────────

function initGraph() {
  const container = containerRef.value
  if (!container) return
  const { width, height } = container.getBoundingClientRect()

  svgSelection = d3.select(svgRef.value)
    .attr('width', width)
    .attr('height', height)

  const defs = svgSelection.append('defs')

  // Arrow markers: normal, adopted, paternal, maternal
  const nodeR = store.graphSettings.nodeRadius
  const markerDefs = [
    { id: 'arr', fill: '#8b6cc5' },
    { id: 'arr-a', fill: '#f5a623' },
    { id: 'arr-pat', fill: '#4a90d9' },
    { id: 'arr-mat', fill: '#d94a8a' },
  ]
  markerDefs.forEach(({ id, fill }) => {
    defs.append('marker')
      .attr('id', id).attr('markerWidth', 6).attr('markerHeight', 6)
      .attr('refX', Math.round(nodeR / 1.8) + 6).attr('refY', 3).attr('orient', 'auto')
      .attr('viewBox', '0 0 6 6')
      .append('path').attr('d', 'M0,0 L0,6 L6,3z').attr('fill', fill).attr('opacity', 0.9)
  })

  const glowFilter = defs.append('filter').attr('id', 'glow')
  glowFilter.append('feGaussianBlur').attr('stdDeviation', 3).attr('result', 'coloredBlur')
  const feMerge = glowFilter.append('feMerge')
  feMerge.append('feMergeNode').attr('in', 'coloredBlur')
  feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

  zoomBehavior = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => { rootGroup.attr('transform', event.transform) })
  svgSelection.call(zoomBehavior)
  svgSelection.on('click', () => { store.selectPerson(null); store.relPopup = null })

  rootGroup = svgSelection.append('g').attr('class', 'root-group')
  rootGroup.append('g').attr('class', 'guides-layer')
  rootGroup.append('g').attr('class', 'links-layer')
  rootGroup.append('g').attr('class', 'nodes-layer')

  simulation = d3.forceSimulation()
    .force('link', d3.forceLink().id(d => d.id).distance(160).strength(0.4))
    .force('charge', d3.forceManyBody().strength(-380))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide(52))
    .on('tick', ticked)

  resizeObserver = new ResizeObserver(() => {
    if (!container) return
    const r = container.getBoundingClientRect()
    svgSelection.attr('width', r.width).attr('height', r.height)
    if (currentMode.value === 'auto') {
      simulation.force('center', d3.forceCenter(r.width / 2, r.height / 2))
      simulation.alpha(0.1).restart()
    }
  })
  resizeObserver.observe(container)
}

// ── Data sync ───────────────────────────────────────────────────────────────

function updateGraph() {
  if (!simulation || !rootGroup) return

  const persons = store.persons
  const relationships = store.relationships

  const existingById = {}
  nodesData.forEach(n => { existingById[n.id] = n })

  const newNodes = persons.map(p => {
    if (existingById[p.id]) return Object.assign(existingById[p.id], p)
    const connectedRel = relationships.find(r => r.person_a_id === p.id || r.person_b_id === p.id)
    let startX = (containerRef.value?.offsetWidth || 800) / 2
    let startY = (containerRef.value?.offsetHeight || 600) / 2
    if (connectedRel) {
      const connectedId = connectedRel.person_a_id === p.id ? connectedRel.person_b_id : connectedRel.person_a_id
      const connNode = existingById[connectedId]
      if (connNode) {
        startX = connNode.x + (Math.random() - 0.5) * 40
        startY = connNode.y + (Math.random() - 0.5) * 40
      }
    }
    return { ...p, x: startX, y: startY, vx: 0, vy: 0 }
  })

  const hadNewNodes = newNodes.length > nodesData.length
  nodesData = newNodes

  linksData = relationships.map(r => ({ ...r, source: r.person_a_id, target: r.person_b_id }))

  simulation.nodes(nodesData)
  simulation.force('link').links(linksData)

  if (currentMode.value === 'auto') {
    simulation.alpha(hadNewNodes ? 0.3 : 0.1).restart()
  }

  renderLinks()
  renderNodes()
}

// ── Rendering ───────────────────────────────────────────────────────────────

function renderLinks() {
  const layer = rootGroup.select('.links-layer')
  const link = layer.selectAll('g.graph-link-group').data(linksData, d => d.id)
  link.exit().remove()

  const entered = link.enter().append('g').attr('class', 'graph-link-group')
  // Invisible wide hit area for clicking
  entered.append('path').attr('class', 'link-hit').attr('fill', 'none')
    .attr('stroke', 'transparent').attr('stroke-width', 14).attr('cursor', 'pointer')
  // Visible line
  entered.append('path').attr('class', 'graph-link').attr('fill', 'none')
    .attr('pointer-events', 'none')
    .attr('stroke-linecap', 'round')
    .attr('stroke-linejoin', 'round')

  // Click handler on hit area
  entered.select('.link-hit').on('click', (event, d) => {
    event.stopPropagation()
    if (store.lockLines) return
    const container = containerRef.value
    if (!container) return
    const rect = container.getBoundingClientRect()
    store.relPopup = {
      rel: d,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top - 10
    }
  })

  const gs = store.graphSettings
  const emph = emphVisual()
  const merged = entered.merge(link)

  merged.select('.graph-link')
    .attr('stroke', d => getLinkStroke(d, emph, gs))
    .attr('stroke-width', d => getLinkWidth(d, emph, gs))
    .attr('stroke-dasharray', d => {
      if (d.status === 'divorced') return '3,3'
      if (d.type === 'spouse') return '6,4'
      if (d.type === 'adopted') return '4,3'
      return null
    })
    .attr('marker-end', d => getLinkMarker(d, emph))
    .attr('opacity', d => getLinkEmphOpacity(d, emph, gs))
}

function linkPath(d) {
  const sx = d.source.x, sy = d.source.y, tx = d.target.x, ty = d.target.y
  const dx = tx - sx, dy = ty - sy
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  let hash = 0
  const idStr = d.id || ''
  for (let i = 0; i < idStr.length; i++) hash = ((hash << 5) - hash + idStr.charCodeAt(i)) | 0
  const sign = (hash & 1) ? 1 : -1
  const baseCurve = store.graphSettings.lineCurvature
  const bendFactor = baseCurve + (Math.abs(hash % 100) / 100) * (baseCurve * 0.6)
  const offset = dist * bendFactor * sign
  const px = -dy / dist, py = dx / dist
  const mx = (sx + tx) / 2 + px * offset
  const my = (sy + ty) / 2 + py * offset
  return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`
}

function renderNodes() {
  const layer = rootGroup.select('.nodes-layer')
  const node = layer.selectAll('g.graph-node').data(nodesData, d => d.id)

  node.exit().transition().duration(300).attr('opacity', 0).remove()

  const entered = node.enter().append('g')
    .attr('class', 'graph-node').attr('opacity', 0).attr('cursor', 'pointer')

  const gs = store.graphSettings
  const r = gs.nodeRadius

  entered.append('circle').attr('class', 'node-shadow').attr('r', r + 2)
    .attr('fill', 'rgba(0,0,0,0.25)').attr('transform', 'translate(2,3)')
  entered.append('circle').attr('class', 'node-circle').attr('r', r)
    .attr('stroke', 'rgba(255,255,255,0.18)').attr('stroke-width', 1.5)
  entered.append('text').attr('class', 'node-initials')
    .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
    .attr('fill', '#fff').attr('font-size', Math.max(9, r * 0.55)).attr('font-weight', 700)
    .attr('font-family', 'system-ui, sans-serif').attr('pointer-events', 'none')
  entered.append('text').attr('class', 'node-label')
    .attr('text-anchor', 'middle').attr('y', r + 14).attr('font-size', gs.labelSize).attr('font-weight', 500)
    .attr('font-family', 'system-ui, sans-serif').attr('pointer-events', 'none')

  entered
    .on('mouseenter', function () {
      if (store.graphSettings.glowOnHover) d3.select(this).select('.node-circle').attr('filter', 'url(#glow)')
    })
    .on('mouseleave', function () {
      const d = d3.select(this).datum()
      if (store.selectedPersonId !== d.id) d3.select(this).select('.node-circle').attr('filter', null)
    })
    .on('click', (event, d) => {
      event.stopPropagation()
      if (store.lockNodes) return
      store.relPopup = null
      store.selectPerson(d.id)
    })

  entered.transition().duration(400).attr('opacity', 1)

  const merged = entered.merge(node)

  const gs2 = store.graphSettings
  merged.attr('opacity', gs2.nodeOpacity)

  merged.select('.node-shadow').attr('r', gs2.nodeRadius + 2)
  merged.select('.node-circle')
    .attr('r', gs2.nodeRadius)
    .attr('fill', d => {
      if (store.selectedPersonId === d.id) {
        const c = d3.color(nodeColor(d.gender))
        return c ? c.brighter(0.4).toString() : nodeColor(d.gender)
      }
      return nodeColor(d.gender)
    })
    .attr('stroke', d => store.selectedPersonId === d.id ? '#6c8ef5' : 'rgba(255,255,255,0.18)')
    .attr('stroke-width', d => store.selectedPersonId === d.id ? 3 : 1.5)
    .attr('filter', d => store.selectedPersonId === d.id ? 'url(#glow)' : null)

  merged.select('.node-initials')
    .attr('font-size', Math.max(9, gs2.nodeRadius * 0.55))
    .text(d => {
      const parts = d.name.trim().split(/\s+/)
      return parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : d.name.substring(0, 2).toUpperCase()
    })

  merged.select('.node-label')
    .attr('y', gs2.nodeRadius + 14)
    .attr('font-size', gs2.labelSize)
    .attr('display', gs2.showLabels ? null : 'none')
    .text(d => d.name.split(' ')[0])
    .attr('fill', d => store.selectedPersonId === d.id ? '#6c8ef5' : 'rgba(232,234,246,0.85)')

  // Apply current drag behavior
  applyDrag(merged)
}

function ticked() {
  if (!rootGroup) return
  rootGroup.selectAll('g.graph-link-group').each(function(d) {
    const p = linkPath(d)
    d3.select(this).select('.link-hit').attr('d', p)
    d3.select(this).select('.graph-link').attr('d', p)
  })
  rootGroup.selectAll('g.graph-node').attr('transform', d => `translate(${d.x},${d.y})`)
  // Smoothly resize guide lines to match content width
  updateGuideWidths()
}

// ── Drag behaviors per mode ─────────────────────────────────────────────────

function applyDrag(selection) {
  // Remove old drag
  selection.on('.drag', null)

  const mode = currentMode.value
  const hardKey = isHardPaternal.value ? 'paternal' : isHardMaternal.value ? 'maternal' : null

  // Shared filter: block drag when nodes are locked
  const filterDrag = () => !store.lockNodes

  // Wrap drag-end to also save hard snapshot when in hard state
  const onDragEndHard = () => { if (hardKey) snapshotHard(mode, hardKey) }

  if (mode === 'auto') {
    selection.call(d3.drag()
      .filter(filterDrag)
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x; d.fy = d.y
      })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        if (hardKey) { d.fx = d.x; d.fy = d.y; onDragEndHard() }
        else { d.fx = null; d.fy = null }
      })
    )
  } else if (mode === 'custom') {
    selection.call(d3.drag()
      .filter(filterDrag)
      .on('start', (event, d) => { d.fx = d.x; d.fy = d.y })
      .on('drag', (event, d) => {
        d.x = event.x; d.y = event.y
        d.fx = event.x; d.fy = event.y
        ticked()
      })
      .on('end', () => {
        hardKey ? onDragEndHard() : snapshotMode('custom')
      })
    )
  } else if (mode === 'age') {
    selection.call(d3.drag()
      .filter(filterDrag)
      .on('start', (event, d) => { d.fx = d.x })
      .on('drag', (event, d) => {
        d.x = event.x; d.fx = event.x
        ticked()
      })
      .on('end', () => { hardKey ? onDragEndHard() : snapshotMode('age') })
    )
  } else if (mode === 'generation') {
    selection.call(d3.drag()
      .filter(filterDrag)
      .on('start', (event, d) => {
        d.fx = d.x; d.fy = d.y
        removeGenPreview()
      })
      .on('drag', (event, d) => {
        d.x = event.x; d.y = event.y
        d.fx = event.x; d.fy = event.y
        ticked()
        // Show preview line if dragged outside existing rows
        updateGenPreview(d.y)
      })
      .on('end', (event, d) => {
        removeGenPreview()
        // Determine target: snap to existing row or create new one
        const targetY = resolveGenTarget(d.y)
        const startY = d.y
        d.fx = d.x

        // Snap to target Y
        d.fy = targetY; d.y = targetY
        ticked()
        cleanupEmptyGenRows()
        onDragEndHard()
      })
    )
  }
}

// ── Mode switching ──────────────────────────────────────────────────────────

function switchMode(newMode) {
  if (newMode === currentMode.value) return
  cancelAnimation()
  if (!nodesData.length) { currentMode.value = newMode; return }

  const oldMode = currentMode.value
  const oldEmph = activeEmphasis.value

  // Save hard state snapshot if leaving a hard state
  if (oldEmph === 'hard_paternal' || oldEmph === 'hard_maternal') {
    const hardKey = oldEmph === 'hard_paternal' ? 'paternal' : 'maternal'
    snapshotHard(oldMode, hardKey)
  }

  // Save current mode positions (for neutral/soft states)
  if (oldEmph !== 'hard_paternal' && oldEmph !== 'hard_maternal') {
    snapshotMode(oldMode)
  }

  // Clean up old mode visuals
  removeGuides()

  // Save emphasis for old mode
  modeEmphasis[oldMode] = activeEmphasis.value

  currentMode.value = newMode

  // Restore emphasis for new mode
  const restoredEmph = modeEmphasis[newMode] || 'neutral'
  activeEmphasis.value = restoredEmph

  if (newMode === 'auto') enterAutoMode()
  else if (newMode === 'custom') enterCustomMode()
  else if (newMode === 'age') enterAgeMode()
  else if (newMode === 'generation') enterGenerationMode()

  // If returning to a hard state, chain after mode animation
  if (restoredEmph === 'hard_paternal' || restoredEmph === 'hard_maternal') {
    const hardKey = restoredEmph === 'hard_paternal' ? 'paternal' : 'maternal'
    const snap = hardSnapshots[newMode][hardKey]
    if (snap) {
      // Wait for enter animation, then animate to hard snap
      setTimeout(() => {
        animateToPositionsWithReset(snap, () => {
          nodesData.forEach(n => { n.fx = n.x; n.fy = n.y })
          applyEmphasis()
          reapplyDrag()
        })
      }, 520)
      return
    }
  }

  applyEmphasis()
}

function enterAutoMode() {
  simulation.stop()

  if (hasSnapshot('auto')) {
    animateToPositionsWithReset(modeSnapshots['auto'], () => {
      nodesData.forEach(n => { n.fx = null; n.fy = null; n.vx = 0; n.vy = 0 })
      simulation.alpha(0.15).restart()
      reapplyDrag()
    })
  } else {
    // No saved auto state — just release pins and let sim settle
    nodesData.forEach(n => { n.fx = null; n.fy = null })
    simulation.alpha(0.3).restart()
    reapplyDrag()
  }
}

function enterCustomMode() {
  simulation.stop()

  if (hasSnapshot('custom')) {
    animateToPositionsWithReset(modeSnapshots['custom'], () => {
      nodesData.forEach(n => { n.fx = n.x; n.fy = n.y })
      reapplyDrag()
    })
  } else {
    // First time: pin at current positions
    nodesData.forEach(n => { n.fx = n.x; n.fy = n.y })
    snapshotMode('custom')
    reapplyDrag()
  }
}

function enterAgeMode() {
  simulation.stop()
  const container = containerRef.value
  if (!container) return
  const { width, height } = container.getBoundingClientRect()

  // Always recompute exact Y from birth years
  const ageInfo = computeAgeYPositions(height)

  if (hasSnapshot('age')) {
    // Restore saved X positions but enforce correct birth-year Y
    const snap = modeSnapshots['age']
    const targets = {}
    nodesData.forEach(n => {
      targets[n.id] = {
        x: snap[n.id]?.x ?? n.x,
        y: ageInfo.yMap[n.id]  // always use exact year Y
      }
    })
    animateToPositionsWithReset(targets, () => {
      nodesData.forEach(n => {
        n.fx = n.x
        n.fy = ageInfo.yMap[n.id]
      })
      drawYearGuides(ageInfo.minYear, ageInfo.maxYear, ageInfo.padding, ageInfo.usableHeight)
      reapplyDrag()
    })
    return
  }

  // First time: compute layout
  const customSnap = modeSnapshots['custom']

  // Group by year band for horizontal spacing
  const byYear = {}
  nodesData.forEach(n => {
    const year = n.birth_year || ageInfo.maxYear
    if (!byYear[year]) byYear[year] = []
    byYear[year].push(n)
  })

  const bandThreshold = 3
  const bands = []
  const sortedYears = Object.keys(byYear).map(Number).sort((a, b) => a - b)
  sortedYears.forEach(year => {
    const lastBand = bands[bands.length - 1]
    if (lastBand && year - lastBand.maxYear <= bandThreshold) {
      lastBand.maxYear = year
      lastBand.nodes.push(...byYear[year])
    } else {
      bands.push({ minYear: year, maxYear: year, nodes: [...byYear[year]] })
    }
  })

  bands.forEach(band => {
    band.nodes.sort((a, b) => {
      const ax = customSnap?.[a.id]?.x ?? a.x
      const bx = customSnap?.[b.id]?.x ?? b.x
      return ax - bx
    })
  })

  const minGap = 80
  const usableWidth = width - 160
  const targets = {}

  nodesData.forEach(n => {
    const year = n.birth_year || ageInfo.maxYear
    const ty = ageInfo.yMap[n.id]

    const band = bands.find(b => year >= b.minYear && year <= b.maxYear)
    const row = band ? band.nodes : [n]
    const idx = row.indexOf(n)
    const count = row.length
    const spacing = Math.max(minGap, Math.min(120, usableWidth / Math.max(count, 1)))
    const rowWidth = (count - 1) * spacing

    let tx
    if (customSnap?.[n.id]) {
      tx = customSnap[n.id].x
    } else {
      tx = (width - rowWidth) / 2 + idx * spacing
    }

    targets[n.id] = { x: tx, y: ty }
  })

  drawYearGuides(ageInfo.minYear, ageInfo.maxYear, ageInfo.padding, ageInfo.usableHeight)

  animateToPositionsWithReset(targets, () => {
    nodesData.forEach(n => {
      n.fx = n.x
      n.fy = ageInfo.yMap[n.id]
    })
    snapshotMode('age')
    reapplyDrag()
  })
}

function enterGenerationMode() {
  simulation.stop()
  const container = containerRef.value
  if (!container) return
  const { width, height } = container.getBoundingClientRect()

  const genInfo = computeGenLayout(width, height)
  // Store row Y values and spacing for snapping during drag
  genRowYValues = genInfo.genLabels.map(g => g.y)
  genRowSpacing = genInfo.rowHeight || 140

  if (hasSnapshot('generation')) {
    // Restore saved positions but snap each node's Y to nearest gen row
    const snap = modeSnapshots['generation']
    const targets = {}
    nodesData.forEach(n => {
      const savedX = snap[n.id]?.x ?? genInfo.targets[n.id]?.x ?? n.x
      const savedY = snap[n.id]?.y ?? genInfo.targets[n.id]?.y ?? n.y
      const snappedY = nearestGenRowY(savedY)
      targets[n.id] = { x: savedX, y: snappedY }
    })
    animateToPositionsWithReset(targets, () => {
      nodesData.forEach(n => {
        n.fx = n.x
        n.fy = n.y
      })
      drawGenGuides(genInfo)
      reapplyDrag()
    })
    return
  }

  drawGenGuides(genInfo)

  animateToPositionsWithReset(genInfo.targets, () => {
    nodesData.forEach(n => {
      n.fx = n.x
      n.fy = genInfo.targets[n.id]?.y ?? n.y
    })
    snapshotMode('generation')
    reapplyDrag()
  })
}

// ── Age helpers ─────────────────────────────────────────────────────────────

function computeAgeYPositions(height) {
  const padding = 80
  const usableHeight = height - padding * 2
  const years = nodesData.filter(n => n.birth_year).map(n => n.birth_year)
  const minYear = years.length ? Math.min(...years) : 1950
  const maxYear = years.length ? Math.max(...years) : 2000
  const yearSpan = maxYear - minYear || 1

  const yMap = {}
  nodesData.forEach(n => {
    const year = n.birth_year || maxYear
    const yRatio = (year - minYear) / yearSpan
    yMap[n.id] = padding + yRatio * usableHeight
  })
  return { yMap, minYear, maxYear, padding, usableHeight }
}

function drawYearGuides(minYear, maxYear, padding, usableHeight) {
  if (!rootGroup) return
  removeGuides()
  guideLineElements = []
  const guidesGroup = rootGroup.select('.guides-layer').append('g').attr('class', 'mode-guides')
  const { x1, x2 } = getGuideExtentX()

  const range = maxYear - minYear
  let interval = 10
  if (range <= 30) interval = 5
  if (range <= 10) interval = 2
  if (range <= 4) interval = 1

  const startYear = Math.floor(minYear / interval) * interval
  const endYear = Math.ceil(maxYear / interval) * interval

  for (let year = startYear; year <= endYear; year += interval) {
    const yRatio = (year - minYear) / (maxYear - minYear || 1)
    const y = padding + yRatio * usableHeight

    const lineEl = guidesGroup.append('line')
      .attr('x1', x1).attr('x2', x2).attr('y1', y).attr('y2', y)
      .attr('stroke', 'rgba(232, 234, 246, 0.12)').attr('stroke-width', 1)
      .attr('stroke-dasharray', '6,4')
      .attr('opacity', 0).transition().duration(600).delay(400).attr('opacity', 1)

    const textEl = guidesGroup.append('text')
      .attr('x', x1 - 14).attr('y', y + 4)
      .attr('fill', 'rgba(232, 234, 246, 0.3)').attr('font-size', 10)
      .attr('font-family', 'system-ui, sans-serif').attr('font-weight', 600)
      .text(year)
      .attr('opacity', 0).transition().duration(600).delay(400).attr('opacity', 1)

    guideLineElements.push({ lineEl: guidesGroup.select(`line:last-child`).empty() ? lineEl : lineEl, textEl })
  }
  // Re-select all for proper live references
  guideLineElements = []
  guidesGroup.selectAll('line').each(function() { guideLineElements.push({ lineEl: d3.select(this) }) })
  guidesGroup.selectAll('text').each(function(_, i) {
    if (guideLineElements[i]) guideLineElements[i].textEl = d3.select(this)
  })
}

// ── Generation helpers ──────────────────────────────────────────────────────

function computeGenLayout(width, height) {
  const relationships = store.relationships
  const padding = 80
  const usableHeight = height - padding * 2
  const usableWidth = width - 160

  // Build parent→child map
  const childOf = {}
  relationships.forEach(r => {
    if (r.type === 'parent_child' || r.type === 'adopted') {
      const childId = r.person_b_id
      if (!childOf[childId]) childOf[childId] = new Set()
      childOf[childId].add(r.person_a_id)
    }
  })

  // Assign generation depth
  const genMap = {}
  function getGen(id, visited) {
    if (genMap[id] !== undefined) return genMap[id]
    if (visited.has(id)) return 0
    visited.add(id)
    const parents = childOf[id]
    if (!parents || parents.size === 0) { genMap[id] = 0; return 0 }
    let maxP = 0
    parents.forEach(pid => { maxP = Math.max(maxP, getGen(pid, visited)) })
    genMap[id] = maxP + 1
    return genMap[id]
  }
  nodesData.forEach(n => getGen(n.id, new Set()))

  // Group by generation
  const gens = {}
  nodesData.forEach(n => {
    const g = genMap[n.id] || 0
    if (!gens[g]) gens[g] = []
    gens[g].push(n)
  })
  const genKeys = Object.keys(gens).map(Number).sort((a, b) => a - b)

  // Sort within generation: spouses adjacent, then by birth year
  const spouseOf = {}
  relationships.forEach(r => {
    if (r.type === 'spouse') {
      spouseOf[r.person_a_id] = r.person_b_id
      spouseOf[r.person_b_id] = r.person_a_id
    }
  })

  genKeys.forEach(g => {
    gens[g].sort((a, b) => (a.birth_year || 9999) - (b.birth_year || 9999))
    // Pull spouses together
    const ordered = []
    const placed = new Set()
    gens[g].forEach(n => {
      if (placed.has(n.id)) return
      ordered.push(n)
      placed.add(n.id)
      const sid = spouseOf[n.id]
      if (sid) {
        const spouse = gens[g].find(x => x.id === sid)
        if (spouse && !placed.has(sid)) {
          ordered.push(spouse)
          placed.add(sid)
        }
      }
    })
    gens[g] = ordered
  })

  // Compute positions
  const rowHeight = Math.min(140, usableHeight / Math.max(genKeys.length, 1))
  const startY = (height - (genKeys.length - 1) * rowHeight) / 2
  const minGap = 80

  const targets = {}
  const yMap = {}
  const genLabels = []

  genKeys.forEach((g, ri) => {
    const row = gens[g]
    const count = row.length
    const spacing = Math.max(minGap, Math.min(120, usableWidth / Math.max(count, 1)))
    const rowWidth = (count - 1) * spacing
    const y = startY + ri * rowHeight

    genLabels.push({ label: `Gen ${g + 1}`, y })

    row.forEach((n, ci) => {
      const x = (width - rowWidth) / 2 + ci * spacing
      targets[n.id] = { x, y }
      yMap[n.id] = y
    })
  })

  return { targets, yMap, genLabels, padding, usableHeight, rowHeight }
}

function drawGenGuides(genInfo) {
  if (!rootGroup) return
  removeGuides()
  guideLineElements = []
  const guidesGroup = rootGroup.select('.guides-layer').append('g').attr('class', 'mode-guides')
  const { x1, x2 } = getGuideExtentX()

  genInfo.genLabels.forEach(({ label, y }) => {
    guidesGroup.append('line')
      .attr('x1', x1).attr('x2', x2).attr('y1', y).attr('y2', y)
      .attr('stroke', 'rgba(232, 234, 246, 0.10)').attr('stroke-width', 1)
      .attr('stroke-dasharray', '8,5')
      .attr('opacity', 0).transition().duration(600).delay(400).attr('opacity', 1)

    guidesGroup.append('text')
      .attr('x', x1 - 14).attr('y', y + 4)
      .attr('fill', 'rgba(232, 234, 246, 0.25)').attr('font-size', 10)
      .attr('font-family', 'system-ui, sans-serif').attr('font-weight', 600)
      .text(label)
      .attr('opacity', 0).transition().duration(600).delay(400).attr('opacity', 1)
  })

  guidesGroup.selectAll('line').each(function() { guideLineElements.push({ lineEl: d3.select(this) }) })
  guidesGroup.selectAll('text').each(function(_, i) {
    if (guideLineElements[i]) guideLineElements[i].textEl = d3.select(this)
  })
}

// ── Shared helpers ──────────────────────────────────────────────────────────

function nearestGenRowY(y) {
  if (!genRowYValues.length) return y
  let best = genRowYValues[0]
  let bestDist = Math.abs(y - best)
  for (let i = 1; i < genRowYValues.length; i++) {
    const dist = Math.abs(y - genRowYValues[i])
    if (dist < bestDist) { best = genRowYValues[i]; bestDist = dist }
  }
  return best
}

// Compute where a new gen line would appear if node is dragged outside rows
function getNewGenY(y) {
  if (!genRowYValues.length) return null
  const sorted = [...genRowYValues].sort((a, b) => a - b)
  const threshold = genRowSpacing * 0.45

  // Above the top row
  if (y < sorted[0] - threshold) {
    return sorted[0] - genRowSpacing
  }
  // Below the bottom row
  if (y > sorted[sorted.length - 1] + threshold) {
    return sorted[sorted.length - 1] + genRowSpacing
  }
  // Between two rows — if far enough from both, offer a new row in the middle
  for (let i = 0; i < sorted.length - 1; i++) {
    const mid = (sorted[i] + sorted[i + 1]) / 2
    const halfGap = (sorted[i + 1] - sorted[i]) / 2
    if (y > sorted[i] + threshold && y < sorted[i + 1] - threshold && halfGap > 50) {
      return mid
    }
  }
  return null
}

function updateGenPreview(y) {
  const newY = getNewGenY(y)
  if (!rootGroup) return
  const { x1, x2 } = getGuideExtentX()

  if (newY !== null) {
    if (!genPreviewLine) {
      const guidesLayer = rootGroup.select('.guides-layer')
      genPreviewLine = guidesLayer.append('g').attr('class', 'gen-preview')
        .attr('opacity', 0)
      genPreviewLine.append('line')
        .attr('x1', x1).attr('x2', x2)
        .attr('stroke', 'rgba(108, 142, 245, 0.35)').attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6,4')
      genPreviewLine.append('text')
        .attr('x', x1 - 14)
        .attr('fill', 'rgba(108, 142, 245, 0.45)').attr('font-size', 10)
        .attr('font-family', 'system-ui, sans-serif').attr('font-weight', 600)
        .text('New Gen')
      // Animate in
      genPreviewLine.transition().duration(200).attr('opacity', 1)
    }
    // Update position and width
    genPreviewLine.select('line').attr('y1', newY).attr('y2', newY).attr('x1', x1).attr('x2', x2)
    genPreviewLine.select('text').attr('y', newY + 4).attr('x', x1 - 14)
    // Ensure visible (may have been faded out)
    genPreviewLine.interrupt().attr('opacity', 1)
  } else {
    if (genPreviewLine) {
      genPreviewLine.transition().duration(150).attr('opacity', 0)
    }
  }
}

function removeGenPreview() {
  if (genPreviewLine) {
    genPreviewLine.transition().duration(150).attr('opacity', 0).remove()
    genPreviewLine = null
  }
}

// Resolve where a dropped node should snap: existing row or new row
function resolveGenTarget(y) {
  const newY = getNewGenY(y)
  if (newY !== null) {
    // Add new row temporarily at this Y — redistribution will fix positions
    genRowYValues.push(newY)
    genRowYValues.sort((a, b) => a - b)
    return newY
  }
  return nearestGenRowY(y)
}

// After a node is dropped: remove empty rows, redistribute evenly
function cleanupEmptyGenRows() {
  const tolerance = 15

  // Remove rows with no nodes
  genRowYValues = genRowYValues.filter(rowY => {
    return nodesData.some(n => Math.abs(n.y - rowY) < tolerance)
  })

  // Redistribute rows to equal spacing
  redistributeGenRows()

  // Only save to mode snapshot if NOT in a hard state
  // (hard state saves are handled by onDragEndHard)
  if (!isHard.value) {
    snapshotMode('generation')
  }
}

// Redistribute all gen rows with fixed spacing, centered in the viewport
function redistributeGenRows() {
  if (!genRowYValues.length || !containerRef.value) return
  const { height } = containerRef.value.getBoundingClientRect()
  const count = genRowYValues.length

  // Sort current rows to map old -> new
  const oldSorted = [...genRowYValues].sort((a, b) => a - b)

  // Use the fixed spacing from initial layout — total height = (count-1) * spacing
  const totalSpan = (count - 1) * genRowSpacing
  const startY = (height - totalSpan) / 2  // center vertically

  const newYValues = oldSorted.map((_, i) => startY + i * genRowSpacing)

  // Build old->new mapping
  const yMapping = {} // oldY -> newY
  oldSorted.forEach((oldY, i) => { yMapping[oldY] = newYValues[i] })

  // Update genRowYValues
  genRowYValues = [...newYValues]

  // Move nodes to new Y positions (map each node's closest old row → new row)
  nodesData.forEach(n => {
    let closestOld = oldSorted[0]
    let closestDist = Math.abs(n.y - closestOld)
    oldSorted.forEach(oy => {
      const dist = Math.abs(n.y - oy)
      if (dist < closestDist) { closestOld = oy; closestDist = dist }
    })
    n.y = yMapping[closestOld]
    n.fy = n.y
  })
  ticked()

  // Redraw guides at new positions
  redrawGenGuidesAnimated(oldSorted, newYValues)
}

// Animate guide lines from old Y positions to new Y positions
function redrawGenGuidesAnimated(oldYValues, newYValues) {
  if (!rootGroup) return
  guideLineElements = []

  // Remove old guides immediately
  rootGroup.selectAll('.mode-guides').remove()

  const guidesGroup = rootGroup.select('.guides-layer').append('g').attr('class', 'mode-guides')
  const { x1, x2 } = getGuideExtentX()

  oldYValues.forEach((oldY, i) => {
    const newY = newYValues[i]

    const lineEl = guidesGroup.append('line')
      .attr('x1', x1).attr('x2', x2).attr('y1', oldY).attr('y2', oldY)
      .attr('stroke', 'rgba(232, 234, 246, 0.10)').attr('stroke-width', 1)
      .attr('stroke-dasharray', '8,5')
      .attr('opacity', 1)

    lineEl.transition().duration(400).ease(d3.easeCubicInOut)
      .attr('y1', newY).attr('y2', newY)

    const textEl = guidesGroup.append('text')
      .attr('x', x1 - 14).attr('y', oldY + 4)
      .attr('fill', 'rgba(232, 234, 246, 0.25)').attr('font-size', 10)
      .attr('font-family', 'system-ui, sans-serif').attr('font-weight', 600)
      .text(`Gen ${i + 1}`)
      .attr('opacity', 1)

    textEl.transition().duration(400).ease(d3.easeCubicInOut)
      .attr('y', newY + 4)

    guideLineElements.push({ lineEl, textEl })
  })
}

function getGuideExtentX() {
  if (!nodesData.length) return { x1: 30, x2: 800 }
  const xs = nodesData.map(d => d.x)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const pad = 120
  return { x1: minX - pad, x2: maxX + pad }
}

function updateGuideWidths() {
  if (!guideLineElements.length) return
  const { x1, x2 } = getGuideExtentX()
  guideLineElements.forEach(({ lineEl, textEl }) => {
    if (lineEl) lineEl.attr('x1', x1).attr('x2', x2)
    if (textEl) textEl.attr('x', x1 - 14)
  })
}

function removeGuides() {
  if (!rootGroup) return
  guideLineElements = []
  rootGroup.selectAll('.mode-guides')
    .transition().duration(300).attr('opacity', 0).remove()
}

function cancelAnimation() {
  if (animTimer) { animTimer.stop(); animTimer = null }
}

function animateToPositions(targets, onDone) {
  cancelAnimation()
  const duration = 500
  const ease = d3.easeCubicOut
  const startPos = {}
  nodesData.forEach(n => { startPos[n.id] = { x: n.x, y: n.y } })

  animTimer = d3.timer((elapsed) => {
    const t = Math.min(1, ease(elapsed / duration))
    nodesData.forEach(n => {
      const s = startPos[n.id]
      const e = targets[n.id]
      if (!s || !e) return
      n.x = s.x + (e.x - s.x) * t
      n.y = s.y + (e.y - s.y) * t
      n.fx = n.x
      n.fy = n.y
    })
    ticked()
    if (t >= 1) {
      animTimer.stop()
      animTimer = null
      if (onDone) onDone()
    }
  })
}

// Animate nodes to targets AND simultaneously pan the view to stay centered
function animateToPositionsWithReset(targets, onDone) {
  cancelAnimation()

  const duration = 500
  const ease = d3.easeCubicOut
  const startPos = {}
  nodesData.forEach(n => { startPos[n.id] = { x: n.x, y: n.y } })

  const container = containerRef.value
  const w = container ? container.getBoundingClientRect().width : 800
  const h = container ? container.getBoundingClientRect().height : 600

  // Compute center of current nodes → start transform
  const startXs = nodesData.map(n => n.x), startYs = nodesData.map(n => n.y)
  const startCx = startXs.length ? (Math.min(...startXs) + Math.max(...startXs)) / 2 : w / 2
  const startCy = startYs.length ? (Math.min(...startYs) + Math.max(...startYs)) / 2 : h / 2
  const startTx = w / 2 - startCx
  const startTy = h / 2 - startCy

  // Compute center of target nodes → end transform
  const tVals = Object.values(targets)
  const endXs = tVals.map(t => t.x), endYs = tVals.map(t => t.y)
  const endCx = endXs.length ? (Math.min(...endXs) + Math.max(...endXs)) / 2 : w / 2
  const endCy = endYs.length ? (Math.min(...endYs) + Math.max(...endYs)) / 2 : h / 2
  const endTx = w / 2 - endCx
  const endTy = h / 2 - endCy

  // Set initial view centered on current nodes (reset scale to 1)
  svgSelection.call(zoomBehavior.transform, d3.zoomIdentity.translate(startTx, startTy))

  animTimer = d3.timer((elapsed) => {
    const t = Math.min(1, ease(elapsed / duration))

    // Interpolate node positions
    nodesData.forEach(n => {
      const s = startPos[n.id]
      const e = targets[n.id]
      if (!s || !e) return
      n.x = s.x + (e.x - s.x) * t
      n.y = s.y + (e.y - s.y) * t
      n.fx = n.x
      n.fy = n.y
    })
    ticked()

    // Linearly interpolate the view transform to follow the moving center
    const tx = startTx + (endTx - startTx) * t
    const ty = startTy + (endTy - startTy) * t
    svgSelection.call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty))

    if (t >= 1) {
      animTimer.stop()
      animTimer = null
      if (onDone) onDone()
    }
  })
}

function reapplyDrag() {
  if (!rootGroup) return
  const allNodes = rootGroup.selectAll('g.graph-node')
  applyDrag(allNodes)
}

// ── Zoom / search ───────────────────────────────────────────────────────────

function cycleEmphasis(which) {
  cancelAnimation()
  const cur = activeEmphasis.value
  const mode = currentMode.value
  const curIsHard = cur === 'hard_paternal' || cur === 'hard_maternal'
  let next = 'neutral'

  if (which === 'neutral') {
    next = 'neutral'
  } else if (which === 'paternal') {
    if (cur === 'paternal') next = 'hard_paternal'
    else if (cur === 'hard_paternal') next = 'paternal'
    else next = 'paternal'
  } else if (which === 'maternal') {
    if (cur === 'maternal') next = 'hard_maternal'
    else if (cur === 'hard_maternal') next = 'maternal'
    else next = 'maternal'
  }

  const nextIsHard = next === 'hard_paternal' || next === 'hard_maternal'

  // Case 1: soft → soft (no position change, just visual)
  if (!curIsHard && !nextIsHard) {
    activeEmphasis.value = next
    modeEmphasis[mode] = next
    applyEmphasis()
    return
  }

  // Case 2: soft → hard (save base positions, load hard positions)
  if (!curIsHard && nextIsHard) {
    const hardKey = next === 'hard_paternal' ? 'paternal' : 'maternal'
    // Save current as the base/neutral snapshot for this mode
    snapshotMode(mode)
    if (mode === 'auto') simulation.stop()

    if (hardSnapshots[mode][hardKey]) {
      animateToPositionsWithReset(hardSnapshots[mode][hardKey], () => {
        nodesData.forEach(n => { n.fx = n.x; n.fy = n.y })
        activeEmphasis.value = next
        modeEmphasis[mode] = next
        applyEmphasis()
        reapplyDrag()
      })
    } else {
      // First time: current positions become the hard state
      snapshotHard(mode, hardKey)
      activeEmphasis.value = next
      modeEmphasis[mode] = next
      applyEmphasis()
      reapplyDrag()
    }
    return
  }

  // Case 3: hard → soft (save hard positions, restore base positions)
  if (curIsHard && !nextIsHard) {
    const hardKey = cur === 'hard_paternal' ? 'paternal' : 'maternal'
    snapshotHard(mode, hardKey)

    const baseSnap = modeSnapshots[mode]
    if (baseSnap) {
      animateToPositionsWithReset(baseSnap, () => {
        restoreModeConstraints(mode)
        activeEmphasis.value = next
        modeEmphasis[mode] = next
        applyEmphasis()
        reapplyDrag()
      })
    } else {
      activeEmphasis.value = next
      modeEmphasis[mode] = next
      applyEmphasis()
      reapplyDrag()
    }
    return
  }

  // Case 4: hard → different hard (save old hard, load new hard)
  if (curIsHard && nextIsHard) {
    const oldKey = cur === 'hard_paternal' ? 'paternal' : 'maternal'
    const newKey = next === 'hard_paternal' ? 'paternal' : 'maternal'
    snapshotHard(mode, oldKey)

    if (hardSnapshots[mode][newKey]) {
      animateToPositionsWithReset(hardSnapshots[mode][newKey], () => {
        nodesData.forEach(n => { n.fx = n.x; n.fy = n.y })
        activeEmphasis.value = next
        modeEmphasis[mode] = next
        applyEmphasis()
        reapplyDrag()
      })
    } else {
      snapshotHard(mode, newKey)
      activeEmphasis.value = next
      modeEmphasis[mode] = next
      applyEmphasis()
      reapplyDrag()
    }
    return
  }
}

// Restore fx/fy constraints appropriate for the current mode after returning from hard
function restoreModeConstraints(mode) {
  if (mode === 'auto') {
    nodesData.forEach(n => { n.fx = null; n.fy = null })
    simulation.alpha(0.15).restart()
  } else if (mode === 'age' && containerRef.value) {
    const { height } = containerRef.value.getBoundingClientRect()
    const ageInfo = computeAgeYPositions(height)
    nodesData.forEach(n => { n.fx = n.x; n.fy = ageInfo.yMap[n.id] })
  } else if (mode === 'generation') {
    // Snap each node to nearest gen row
    nodesData.forEach(n => {
      n.fy = nearestGenRowY(n.y)
      n.y = n.fy
      n.fx = n.x
    })
  } else {
    nodesData.forEach(n => { n.fx = n.x; n.fy = n.y })
  }
}

function snapshotHard(mode, hardKey) {
  const snap = {}
  nodesData.forEach(n => { snap[n.id] = { x: n.x, y: n.y } })
  hardSnapshots[mode][hardKey] = snap
}

function applyEmphasis() {
  if (!rootGroup) return
  const emph = emphVisual()
  const gs = store.graphSettings

  rootGroup.selectAll('g.graph-link-group').select('.graph-link')
    .transition().duration(250).ease(d3.easeCubicOut)
    .attr('stroke', d => getLinkStroke(d, emph, gs))
    .attr('stroke-width', d => getLinkWidth(d, emph, gs))
    .attr('opacity', d => getLinkEmphOpacity(d, emph, gs))
    .attr('marker-end', d => getLinkMarker(d, emph))
}

function isPaternal(d) {
  if (d.type !== 'parent_child' && d.type !== 'adopted') return false
  const parent = store.persons.find(p => p.id === d.person_a_id)
  return parent && parent.gender === 'male'
}

function isMaternal(d) {
  if (d.type !== 'parent_child' && d.type !== 'adopted') return false
  const parent = store.persons.find(p => p.id === d.person_a_id)
  return parent && parent.gender === 'female'
}

function getLinkStroke(d, emph, gs) {
  if (emph === 'paternal' && isPaternal(d)) return '#4a90d9'
  if (emph === 'maternal' && isMaternal(d)) return '#d94a8a'
  if (d.type === 'spouse') return gs.spouseColor
  if (d.type === 'adopted') return gs.adoptedColor
  return gs.parentChildColor
}

function getLinkWidth(d, emph, gs) {
  const base = d.type === 'spouse' ? gs.spouseWidth : d.type === 'adopted' ? gs.adoptedWidth : gs.parentChildWidth
  if (emph === 'paternal' && isPaternal(d)) return base * 2.2
  if (emph === 'maternal' && isMaternal(d)) return base * 2.2
  return base
}

function getLinkEmphOpacity(d, emph, gs) {
  const base = d.status === 'divorced' ? gs.linkOpacity * 0.5 : gs.linkOpacity
  if (emph === 'neutral') return base
  if (emph === 'paternal' && isPaternal(d)) return Math.min(1, base * 1.3)
  if (emph === 'maternal' && isMaternal(d)) return Math.min(1, base * 1.3)
  return base
}

function getLinkMarker(d, emph) {
  if (d.type === 'parent_child' || d.type === 'adopted') {
    if (emph === 'paternal' && isPaternal(d)) return 'url(#arr-pat)'
    if (emph === 'maternal' && isMaternal(d)) return 'url(#arr-mat)'
    return d.type === 'adopted' ? 'url(#arr-a)' : 'url(#arr)'
  }
  return null
}

function zoomIn() { svgSelection?.transition().duration(300).call(zoomBehavior.scaleBy, 1.3) }
function zoomOut() { svgSelection?.transition().duration(300).call(zoomBehavior.scaleBy, 0.77) }
function resetZoom() {
  if (!nodesData.length || !containerRef.value) {
    svgSelection?.transition().duration(400).call(zoomBehavior.transform, d3.zoomIdentity)
    return
  }
  const { width, height } = containerRef.value.getBoundingClientRect()
  const xs = nodesData.map(d => d.x), ys = nodesData.map(d => d.y)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const tx = width / 2 - cx
  const ty = height / 2 - cy
  svgSelection?.transition().duration(400).call(
    zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty)
  )
}

function fitAll() {
  if (!nodesData.length || !containerRef.value) return
  const { width, height } = containerRef.value.getBoundingClientRect()
  const xs = nodesData.map(d => d.x), ys = nodesData.map(d => d.y)
  const x0 = Math.min(...xs) - 60, x1 = Math.max(...xs) + 60
  const y0 = Math.min(...ys) - 60, y1 = Math.max(...ys) + 60
  const scale = Math.min(0.9 * width / (x1 - x0), 0.9 * height / (y1 - y0), 2)
  const tx = width / 2 - scale * (x0 + x1) / 2
  const ty = height / 2 - scale * (y0 + y1) / 2
  svgSelection?.transition().duration(600).call(
    zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale)
  )
}

function highlightSearch() {
  if (!rootGroup) return
  const q = searchQuery.value.toLowerCase().trim()
  rootGroup.selectAll('g.graph-node').attr('opacity', d =>
    !q || d.name.toLowerCase().includes(q) ? 1 : 0.2
  )
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(() => { initGraph(); updateGraph() })
onUnmounted(() => { simulation?.stop(); resizeObserver?.disconnect(); if (animTimer) animTimer.stop() })

watch(
  [() => store.persons, () => store.relationships],
  () => { updateGraph() },
  { deep: true }
)

watch(() => store.selectedPersonId, () => { if (rootGroup) renderNodes() })

// Reapply drag when lock state changes
watch(() => store.lockNodes, () => { reapplyDrag() })

// React to graph settings changes
watch(() => store.graphSettings, () => {
  if (!rootGroup || !simulation) return
  const gs = store.graphSettings

  // Update arrow markers refX based on node radius
  const refX = Math.round(gs.nodeRadius / 1.8) + 6
  ;['#arr', '#arr-a', '#arr-pat', '#arr-mat'].forEach(id => {
    svgSelection?.select(id).attr('refX', refX)
  })

  // Update arrow colors
  svgSelection?.select('#arr path').attr('fill', gs.parentChildColor)
  svgSelection?.select('#arr-a path').attr('fill', gs.adoptedColor)
  svgSelection?.select('#arr-pat path').attr('fill', '#4a90d9')
  svgSelection?.select('#arr-mat path').attr('fill', '#d94a8a')

  // Update simulation forces
  if (currentMode.value === 'auto') {
    simulation.force('link').distance(gs.linkDistance)
    simulation.force('charge').strength(gs.chargeStrength)
    simulation.force('collide').radius(gs.nodeRadius + 30)
    simulation.alpha(0.2).restart()
  }

  renderLinks()
  renderNodes()
}, { deep: true })
</script>

<style scoped>
.graph-area {
  position: relative;
  background: var(--bg);
  overflow: hidden;
}

.graph-svg {
  display: block;
  width: 100%;
  height: 100%;
}

.graph-search {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 7px 14px;
  min-width: 260px;
  z-index: 5;
  box-shadow: var(--shadow);
}

.graph-search input {
  background: none;
  border: none;
  outline: none;
  font: inherit;
  font-size: 13px;
  color: var(--t1);
  flex: 1;
  padding: 0;
  box-shadow: none;
  width: auto;
}

.graph-search input::placeholder {
  color: var(--t3);
}

.search-icon {
  font-size: 13px;
  flex-shrink: 0;
}

.graph-controls {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 5px;
  box-shadow: var(--shadow);
  z-index: 5;
}

.ctrl-btn {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--t2);
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s;
  font-family: var(--font);
}

.ctrl-btn:hover {
  background: var(--hover);
  color: var(--t1);
}

.ctrl-btn-wide {
  width: auto;
  padding: 0 10px;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  position: relative;
}

.ctrl-btn-active {
  background: var(--adim);
  color: var(--accent);
  border: 1px solid rgba(108, 142, 245, 0.3);
}

.ctrl-sep {
  width: 1px;
  background: var(--border);
  margin: 3px 2px;
}

.graph-legend {
  position: absolute;
  bottom: 18px;
  right: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 11px;
  color: var(--t2);
  z-index: 5;
}

.leg-row {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 5px;
}

.leg-row:last-child {
  margin-bottom: 0;
}

.leg-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.leg-line {
  width: 22px;
  height: 2px;
  flex-shrink: 0;
}

.leg-dashed {
  height: 0;
  border-top: 2px dashed;
}

/* Emphasis buttons */
.ctrl-btn-emph-active {
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.ctrl-btn-emph-active.ctrl-btn-paternal {
  background: rgba(74, 144, 217, 0.18);
  color: #4a90d9;
  border-color: rgba(74, 144, 217, 0.35);
}

.ctrl-btn-emph-active.ctrl-btn-maternal {
  background: rgba(217, 74, 138, 0.18);
  color: #d94a8a;
  border-color: rgba(217, 74, 138, 0.35);
}

.emph-label {
  pointer-events: none;
}

/* Hard state: glowing bottom bar + stronger background */
.emph-bar {
  position: absolute;
  bottom: 0;
  left: 3px;
  right: 3px;
  height: 3px;
  border-radius: 2px 2px 0 0;
}

.emph-bar-pat {
  background: #4a90d9;
  box-shadow: 0 0 8px rgba(74, 144, 217, 0.7);
}

.emph-bar-mat {
  background: #d94a8a;
  box-shadow: 0 0 8px rgba(217, 74, 138, 0.7);
}

.ctrl-btn-hard.ctrl-btn-paternal {
  background: rgba(74, 144, 217, 0.25);
  color: #5ca3ef;
  border-color: rgba(74, 144, 217, 0.5);
}

.ctrl-btn-hard.ctrl-btn-maternal {
  background: rgba(217, 74, 138, 0.25);
  color: #e86aab;
  border-color: rgba(217, 74, 138, 0.5);
}

/* Lock button */
.ctrl-btn-lock {
  background: rgba(239, 83, 80, 0.15);
  color: #ef5350;
}

/* Relationship popup */
.rel-popup {
  position: absolute;
  z-index: 20;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 18px;
  min-width: 180px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
  transform: translateX(-50%) translateY(-100%);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rel-popup-close {
  position: absolute;
  top: 6px;
  right: 8px;
  width: 22px;
  height: 22px;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: var(--t3);
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rel-popup-close:hover {
  background: var(--hover);
  color: var(--t1);
}

.rel-popup-type {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--accent);
}

.rel-popup-people {
  font-size: 13px;
  font-weight: 600;
  color: var(--t1);
}

.rel-popup-date {
  font-size: 12px;
  color: var(--t2);
}

.rel-popup-status.divorced {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #ef5350;
  background: rgba(239, 83, 80, 0.12);
  padding: 2px 8px;
  border-radius: 6px;
  align-self: flex-start;
}

/* Popup transition */
.relpop-enter-active {
  transition: opacity 0.18s ease, transform 0.22s cubic-bezier(0.34, 1.3, 0.64, 1);
}
.relpop-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.relpop-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-90%) scale(0.92);
}
.relpop-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-100%) scale(0.95);
}
</style>
