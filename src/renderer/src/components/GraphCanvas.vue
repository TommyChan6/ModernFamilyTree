<template>
  <div class="graph-area" ref="containerEl">
    <svg ref="svgEl" class="graph-svg"></svg>
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
      <button class="ctrl-btn ctrl-btn-wide" :class="emphBtnClass('neutral')" @click="cycleEmphasis('neutral')" title="No emphasis">◯ Neutral</button>
      <button class="ctrl-btn ctrl-btn-wide" :class="emphBtnClass('paternal')" @click="cycleEmphasis('paternal')" title="Paternal emphasis">♂ Paternal</button>
      <button class="ctrl-btn ctrl-btn-wide" :class="emphBtnClass('maternal')" @click="cycleEmphasis('maternal')" title="Maternal emphasis">♀ Maternal</button>
      <div class="ctrl-sep"></div>
      <button class="ctrl-btn" :class="{ 'ctrl-btn-lock': store.lockNodes }" @click="store.lockNodes = !store.lockNodes" title="Lock/unlock node clicks">{{ store.lockNodes ? '🔒' : '👤' }}</button>
      <button class="ctrl-btn" :class="{ 'ctrl-btn-lock': store.lockLines }" @click="store.lockLines = !store.lockLines" title="Lock/unlock line clicks">{{ store.lockLines ? '🔒' : '🔗' }}</button>
    </div>
    <Transition name="relpop">
      <div v-if="store.relPopup" class="rel-popup" :style="relPopupStyle" @click.stop>
        <button class="rel-popup-close" @click="store.relPopup = null">✕</button>
        <div class="rel-popup-type">{{ relPopupTypeLabel }}</div>
        <div class="rel-popup-people">{{ relPopupPersonA }} — {{ relPopupPersonB }}</div>
        <div v-if="relPopupFormedLabel" class="rel-popup-date">{{ relPopupFormedLabel }}</div>
        <div v-if="relPopupStatus" class="rel-popup-status" :class="relPopupStatus">{{ relPopupStatus }}</div>
      </div>
    </Transition>
    <!-- Highlights panel -->
    <div class="highlights-panel">
      <div class="highlights-title">Highlights</div>
      <div class="highlight-group">
        <div class="highlight-label">Lineage</div>
        <div class="seg-slider">
          <div class="seg-track">
            <div class="seg-thumb" :class="'seg-pos-' + lineageIndex"></div>
          </div>
          <button
            v-for="(opt, i) in lineageOptions"
            :key="opt.id"
            class="seg-option"
            :class="{ 'seg-active': activeEmphasis === opt.id }"
            @click="cycleEmphasis(opt.id)"
          >{{ opt.label }}</button>
        </div>
      </div>
    </div>

    <div class="graph-legend">
      <div class="panel-title">Legend</div>
      <div class="leg-section">
        <div class="leg-section-label">Nodes</div>
        <div class="leg-row"><div class="leg-dot" style="background:#3a7bd5"></div>Male</div>
        <div class="leg-row"><div class="leg-dot" style="background:#c95fa0"></div>Female</div>
      </div>
      <div class="leg-section">
        <div class="leg-section-label">Lines</div>
        <div class="leg-row"><div class="leg-line" style="background:#8b6cc5"></div>Parent / Child</div>
        <div class="leg-row"><div class="leg-line leg-dashed" style="border-color:#f06292"></div>Spouse</div>
        <div class="leg-row"><div class="leg-line leg-dashed" style="border-color:#f5a623"></div>Adopted</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import * as d3 from 'd3'
import { useMainStore } from '../store/index.js'
import { nodeColor, linkPath, getLinkStroke, getLinkWidth, getLinkEmphOpacity, getLinkMarker, getDashArray } from './graph/linkHelpers.js'
import { computeAgeYPositions } from './graph/layoutAge.js'
import { computeGenLayout } from './graph/layoutGeneration.js'
import { drawYearGuides, drawGenGuides, removeGuides, updateGuideWidths, nearestGenRowY, updateGenPreview, removeGenPreview, resolveGenTarget, cleanupEmptyGenRows } from './graph/guideLines.js'
import { useGraphAnimation } from './graph/useGraphAnimation.js'

const store = useMainStore()
const svgEl = ref(null)
const containerEl = ref(null)
const searchQuery = ref('')
const currentMode = ref('auto')
const activeEmphasis = ref('neutral')

const modes = [
  { id: 'custom', label: '✋ Custom', title: 'Freely position nodes' },
  { id: 'auto', label: '⚡ Auto', title: 'Force-directed layout' },
  { id: 'age', label: '📅 Age', title: 'Sort by birth year' },
  { id: 'generation', label: '🏛 Gen', title: 'Generational layout' }
]

// ── Shared mutable context ──────────────────────────────────────────────────
const ctx = {
  simulation: null, zoomBehavior: null, svgSelection: null, rootGroup: null,
  nodesData: [], linksData: [],
  animTimer: null, resizeObserver: null,
  genRowYValues: [], genRowSpacing: 140, genPreviewLine: null, guideLineElements: [],
  modeSnapshots: { custom: null, auto: null, age: null, generation: null },
  containerRef: null,  // set in onMounted
  ticked: null,        // set below
}

const modeEmphasis = { custom: 'neutral', auto: 'neutral', age: 'neutral', generation: 'neutral' }

const { cancelAnimation, animateToPositions, animateToPositionsWithReset } = useGraphAnimation(ctx)

// ── Emphasis ────────────────────────────────────────────────────────────────
function emphVisual() { return activeEmphasis.value }

const lineageOptions = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'paternal', label: 'Paternal' },
  { id: 'maternal', label: 'Maternal' },
]
const lineageIndex = computed(() => {
  const idx = lineageOptions.findIndex(o => o.id === activeEmphasis.value)
  return idx >= 0 ? idx : 0
})

function emphBtnClass(which) {
  const e = activeEmphasis.value
  if (which === 'neutral') return { 'ctrl-btn-emph-active': e === 'neutral' }
  if (which === 'paternal') return { 'ctrl-btn-emph-active': e === 'paternal', 'ctrl-btn-paternal': e === 'paternal' }
  if (which === 'maternal') return { 'ctrl-btn-emph-active': e === 'maternal', 'ctrl-btn-maternal': e === 'maternal' }
  return {}
}

// ── Popup computeds ─────────────────────────────────────────────────────────
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
  return store.persons.find(x => x.id === store.relPopup.rel.person_a_id)?.name || '?'
})
const relPopupPersonB = computed(() => {
  if (!store.relPopup) return ''
  return store.persons.find(x => x.id === store.relPopup.rel.person_b_id)?.name || '?'
})
const relPopupFormedLabel = computed(() => {
  if (!store.relPopup) return ''
  const r = store.relPopup.rel
  if (r.formed_date) return r.type === 'spouse' ? `Married: ${r.formed_date}` : `Since: ${r.formed_date}`
  if (r.type === 'parent_child') {
    const child = store.persons.find(x => x.id === r.person_b_id)
    if (child?.birth_year) return `Born: ${child.birth_year}`
  }
  return ''
})
const relPopupStatus = computed(() => store.relPopup?.rel?.status === 'divorced' ? 'divorced' : '')

// ── Snapshot helpers ────────────────────────────────────────────────────────
function snapshotMode(mode) {
  const snap = {}
  ctx.nodesData.forEach(n => { snap[n.id] = { x: n.x, y: n.y } })
  ctx.modeSnapshots[mode] = snap
}
function hasSnapshot(mode) { return ctx.modeSnapshots[mode] && Object.keys(ctx.modeSnapshots[mode]).length > 0 }


// ── Ticked ──────────────────────────────────────────────────────────────────
function ticked() {
  if (!ctx.rootGroup) return
  ctx.rootGroup.selectAll('g.graph-link-group').each(function (d) {
    const p = linkPath(d, store.graphSettings.lineCurvature)
    d3.select(this).select('.link-hit').attr('d', p)
    d3.select(this).select('.graph-link').attr('d', p)
  })
  ctx.rootGroup.selectAll('g.graph-node').attr('transform', d => `translate(${d.x},${d.y})`)
  updateGuideWidths(ctx)
}
ctx.ticked = ticked
ctx.theme = store.theme

// ── Init graph ──────────────────────────────────────────────────────────────
function initGraph() {
  const container = containerEl.value
  if (!container) return
  ctx.containerRef = container
  const { width, height } = container.getBoundingClientRect()

  ctx.svgSelection = d3.select(svgEl.value).attr('width', width).attr('height', height)
  const defs = ctx.svgSelection.append('defs')

  const nodeR = store.graphSettings.nodeRadius
  ;[{ id: 'arr', fill: '#8b6cc5' }, { id: 'arr-a', fill: '#f5a623' }, { id: 'arr-pat', fill: '#4a90d9' }, { id: 'arr-mat', fill: '#d94a8a' }, { id: 'arr-pat-ad', fill: '#7bb8f0' }, { id: 'arr-mat-ad', fill: '#eda0c4' }]
    .forEach(({ id, fill }) => {
      defs.append('marker').attr('id', id)
        .attr('markerWidth', 10).attr('markerHeight', 10)
        .attr('refX', nodeR + 10).attr('refY', 5)
        .attr('orient', 'auto').attr('markerUnits', 'userSpaceOnUse')
        .attr('viewBox', '0 0 10 10')
        .append('path').attr('d', 'M0,0 L0,10 L10,5z').attr('fill', fill).attr('opacity', 0.9)
    })

  const glowFilter = defs.append('filter').attr('id', 'glow')
  glowFilter.append('feGaussianBlur').attr('stdDeviation', 3).attr('result', 'coloredBlur')
  const fm = glowFilter.append('feMerge')
  fm.append('feMergeNode').attr('in', 'coloredBlur')
  fm.append('feMergeNode').attr('in', 'SourceGraphic')

  // Gradient drop shadow for nodes — dark mode
  const shadowDark = defs.append('filter').attr('id', 'node-shadow-dark')
    .attr('x', '-40%').attr('y', '-40%').attr('width', '180%').attr('height', '180%')
  shadowDark.append('feGaussianBlur').attr('in', 'SourceAlpha').attr('stdDeviation', 4).attr('result', 'blur')
  shadowDark.append('feOffset').attr('dx', 2).attr('dy', 3).attr('result', 'offsetBlur')
  shadowDark.append('feComponentTransfer').attr('in', 'offsetBlur').attr('result', 'shadow')
    .append('feFuncA').attr('type', 'linear').attr('slope', 0.35)
  const fmDark = shadowDark.append('feMerge')
  fmDark.append('feMergeNode').attr('in', 'shadow')
  fmDark.append('feMergeNode').attr('in', 'SourceGraphic')

  // Gradient drop shadow for nodes — light mode (softer, more diffuse)
  const shadowLight = defs.append('filter').attr('id', 'node-shadow-light')
    .attr('x', '-40%').attr('y', '-40%').attr('width', '180%').attr('height', '180%')
  shadowLight.append('feGaussianBlur').attr('in', 'SourceAlpha').attr('stdDeviation', 6).attr('result', 'blur')
  shadowLight.append('feOffset').attr('dx', 1).attr('dy', 2).attr('result', 'offsetBlur')
  shadowLight.append('feComponentTransfer').attr('in', 'offsetBlur').attr('result', 'shadow')
    .append('feFuncA').attr('type', 'linear').attr('slope', 0.15)
  const fmLight = shadowLight.append('feMerge')
  fmLight.append('feMergeNode').attr('in', 'shadow')
  fmLight.append('feMergeNode').attr('in', 'SourceGraphic')

  ctx.zoomBehavior = d3.zoom().scaleExtent([0.1, 4]).on('zoom', e => ctx.rootGroup.attr('transform', e.transform))
  ctx.svgSelection.call(ctx.zoomBehavior)
  ctx.svgSelection.on('click', () => { store.selectPerson(null); store.relPopup = null })

  ctx.rootGroup = ctx.svgSelection.append('g').attr('class', 'root-group')
  ctx.rootGroup.append('g').attr('class', 'guides-layer')
  ctx.rootGroup.append('g').attr('class', 'links-layer')
  ctx.rootGroup.append('g').attr('class', 'nodes-layer')

  ctx.simulation = d3.forceSimulation()
    .force('link', d3.forceLink().id(d => d.id).distance(160).strength(0.4))
    .force('charge', d3.forceManyBody().strength(-380))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide(52))
    .on('tick', ticked)

  ctx.resizeObserver = new ResizeObserver(() => {
    if (!container) return
    const r = container.getBoundingClientRect()
    ctx.svgSelection.attr('width', r.width).attr('height', r.height)
    if (currentMode.value === 'auto') {
      ctx.simulation.force('center', d3.forceCenter(r.width / 2, r.height / 2))
      ctx.simulation.alpha(0.1).restart()
    }
  })
  ctx.resizeObserver.observe(container)
}

// ── Data sync ───────────────────────────────────────────────────────────────
function updateGraph() {
  if (!ctx.simulation || !ctx.rootGroup) return
  const existingById = {}
  ctx.nodesData.forEach(n => { existingById[n.id] = n })

  const newNodes = store.persons.map(p => {
    if (existingById[p.id]) return Object.assign(existingById[p.id], p)
    const rel = store.relationships.find(r => r.person_a_id === p.id || r.person_b_id === p.id)
    let sx = (ctx.containerRef?.offsetWidth || 800) / 2, sy = (ctx.containerRef?.offsetHeight || 600) / 2
    if (rel) {
      const cid = rel.person_a_id === p.id ? rel.person_b_id : rel.person_a_id
      const cn = existingById[cid]
      if (cn) { sx = cn.x + (Math.random() - 0.5) * 40; sy = cn.y + (Math.random() - 0.5) * 40 }
    }
    return { ...p, x: sx, y: sy, vx: 0, vy: 0 }
  })

  const hadNew = newNodes.length > ctx.nodesData.length
  ctx.nodesData = newNodes
  ctx.linksData = store.relationships.map(r => ({ ...r, source: r.person_a_id, target: r.person_b_id }))
  ctx.simulation.nodes(ctx.nodesData)
  ctx.simulation.force('link').links(ctx.linksData)
  if (currentMode.value === 'auto') ctx.simulation.alpha(hadNew ? 0.3 : 0.1).restart()
  renderLinks()
  renderNodes()
}

// ── Rendering ───────────────────────────────────────────────────────────────
function renderLinks() {
  const layer = ctx.rootGroup.select('.links-layer')
  const link = layer.selectAll('g.graph-link-group').data(ctx.linksData, d => d.id)
  link.exit().remove()

  const entered = link.enter().append('g').attr('class', 'graph-link-group')
  entered.append('path').attr('class', 'link-hit').attr('fill', 'none')
    .attr('stroke', 'transparent').attr('stroke-width', 14).attr('cursor', 'pointer')
  entered.append('path').attr('class', 'graph-link').attr('fill', 'none')
    .attr('pointer-events', 'none').attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round')

  entered.select('.link-hit').on('click', (event, d) => {
    event.stopPropagation()
    if (store.lockLines) return
    const rect = ctx.containerRef.getBoundingClientRect()
    store.relPopup = { rel: d, x: event.clientX - rect.left, y: event.clientY - rect.top - 10 }
  })

  const gs = store.graphSettings, emph = emphVisual(), persons = store.persons
  entered.merge(link).select('.graph-link')
    .attr('stroke', d => getLinkStroke(d, emph, gs, persons))
    .attr('stroke-width', d => getLinkWidth(d, emph, gs, persons))
    .attr('stroke-dasharray', d => getDashArray(d))
    .attr('marker-end', d => getLinkMarker(d, emph, persons))
    .attr('opacity', d => getLinkEmphOpacity(d, emph, gs, persons))
}

function renderNodes() {
  const layer = ctx.rootGroup.select('.nodes-layer')
  const node = layer.selectAll('g.graph-node').data(ctx.nodesData, d => d.id)
  node.exit().transition().duration(300).attr('opacity', 0).remove()

  const gs = store.graphSettings, r = gs.nodeRadius
  const entered = node.enter().append('g').attr('class', 'graph-node').attr('opacity', 0).attr('cursor', 'pointer')
  const isLight = store.theme === 'light'
  entered.append('circle').attr('class', 'node-circle').attr('r', r).attr('stroke', 'rgba(255,255,255,0.18)').attr('stroke-width', 1.5)
    .attr('filter', isLight ? 'url(#node-shadow-light)' : 'url(#node-shadow-dark)')
  entered.append('text').attr('class', 'node-initials').attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
    .attr('fill', '#fff').attr('font-size', Math.max(9, r * 0.55)).attr('font-weight', 700)
    .attr('font-family', 'system-ui, sans-serif').attr('pointer-events', 'none')
  entered.append('text').attr('class', 'node-label').attr('text-anchor', 'middle').attr('y', r + 14)
    .attr('font-size', gs.labelSize).attr('font-weight', 500)
    .attr('font-family', 'system-ui, sans-serif').attr('pointer-events', 'none')

  entered
    .on('mouseenter', function () { if (gs.glowOnHover) d3.select(this).select('.node-circle').attr('filter', 'url(#glow)') })
    .on('mouseleave', function () { const d = d3.select(this).datum(); if (store.selectedPersonId !== d.id) d3.select(this).select('.node-circle').attr('filter', store.theme === 'light' ? 'url(#node-shadow-light)' : 'url(#node-shadow-dark)') })
    .on('click', (event, d) => { event.stopPropagation(); if (store.lockNodes) return; store.relPopup = null; store.selectPerson(d.id) })
  entered.transition().duration(400).attr('opacity', 1)

  const merged = entered.merge(node)
  merged.attr('opacity', gs.nodeOpacity)
  const isLightTheme = store.theme === 'light'
  const shadowFilter = isLightTheme ? 'url(#node-shadow-light)' : 'url(#node-shadow-dark)'
  merged.select('.node-circle').attr('r', gs.nodeRadius)
    .attr('fill', d => { const c = store.selectedPersonId === d.id ? d3.color(nodeColor(d.gender, gs))?.brighter(0.4)?.toString() : null; return c || nodeColor(d.gender, gs) })
    .attr('stroke', d => store.selectedPersonId === d.id ? '#6c8ef5' : 'rgba(255,255,255,0.18)')
    .attr('stroke-width', d => store.selectedPersonId === d.id ? 3 : 1.5)
    .attr('filter', d => store.selectedPersonId === d.id ? 'url(#glow)' : shadowFilter)
  merged.select('.node-initials').attr('font-size', Math.max(9, gs.nodeRadius * 0.55))
    .text(d => { const p = d.name.trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : d.name.substring(0, 2).toUpperCase() })
  merged.select('.node-label').attr('y', gs.nodeRadius + 14).attr('font-size', gs.labelSize)
    .attr('display', gs.showLabels ? null : 'none')
    .text(d => d.name.split(' ')[0])
    .attr('fill', d => store.selectedPersonId === d.id ? '#6c8ef5' : (isLightTheme ? '#4a5068' : 'rgba(232,234,246,0.85)'))
  applyDrag(merged)
}

// ── Drag ────────────────────────────────────────────────────────────────────
function applyDrag(sel) {
  sel.on('.drag', null)
  const mode = currentMode.value
  const filterDrag = () => !store.lockNodes

  if (mode === 'auto') {
    sel.call(d3.drag().filter(filterDrag)
      .on('start', (e, d) => { if (!e.active) ctx.simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y })
      .on('end', (e, d) => { if (!e.active) ctx.simulation.alphaTarget(0); d.fx = null; d.fy = null }))
  } else if (mode === 'custom') {
    sel.call(d3.drag().filter(filterDrag)
      .on('start', (e, d) => { d.fx = d.x; d.fy = d.y })
      .on('drag', (e, d) => { d.x = e.x; d.y = e.y; d.fx = e.x; d.fy = e.y; ticked() })
      .on('end', () => { snapshotMode('custom') }))
  } else if (mode === 'age') {
    sel.call(d3.drag().filter(filterDrag)
      .on('start', (e, d) => { d.fx = d.x })
      .on('drag', (e, d) => { d.x = e.x; d.fx = e.x; ticked() })
      .on('end', () => { snapshotMode('age') }))
  } else if (mode === 'generation') {
    sel.call(d3.drag().filter(filterDrag)
      .on('start', (e, d) => { d.fx = d.x; d.fy = d.y; removeGenPreview(ctx) })
      .on('drag', (e, d) => { d.x = e.x; d.y = e.y; d.fx = e.x; d.fy = e.y; ticked(); updateGenPreview(d.y, ctx) })
      .on('end', (e, d) => {
        removeGenPreview(ctx)
        const ty = resolveGenTarget(d.y, ctx); d.fx = d.x; d.fy = ty; d.y = ty; ticked()
        cleanupEmptyGenRows(ctx, snapshotGenMode, ticked)
      }))
  }
}
function reapplyDrag() { if (ctx.rootGroup) applyDrag(ctx.rootGroup.selectAll('g.graph-node')) }

// ── Mode switching ──────────────────────────────────────────────────────────
function switchMode(newMode) {
  if (newMode === currentMode.value) return
  cancelAnimation()
  if (!ctx.nodesData.length) { currentMode.value = newMode; return }

  const oldMode = currentMode.value
  if (oldMode === 'generation') snapshotGenMode()
  else snapshotMode(oldMode)
  removeGuides(ctx)
  modeEmphasis[oldMode] = activeEmphasis.value
  currentMode.value = newMode
  activeEmphasis.value = modeEmphasis[newMode] || 'neutral'

  if (newMode === 'auto') enterAutoMode()
  else if (newMode === 'custom') enterCustomMode()
  else if (newMode === 'age') enterAgeMode()
  else if (newMode === 'generation') enterGenerationMode()

  applyEmphasis()
}

function enterAutoMode() {
  ctx.simulation.stop()
  if (hasSnapshot('auto')) {
    animateToPositionsWithReset(ctx.modeSnapshots['auto'], () => { ctx.nodesData.forEach(n => { n.fx = null; n.fy = null; n.vx = 0; n.vy = 0 }); ctx.simulation.alpha(0.15).restart(); reapplyDrag() })
  } else { ctx.nodesData.forEach(n => { n.fx = null; n.fy = null }); ctx.simulation.alpha(0.3).restart(); reapplyDrag() }
}

function enterCustomMode() {
  ctx.simulation.stop()
  if (hasSnapshot('custom')) {
    animateToPositionsWithReset(ctx.modeSnapshots['custom'], () => { ctx.nodesData.forEach(n => { n.fx = n.x; n.fy = n.y }); reapplyDrag() })
  } else { ctx.nodesData.forEach(n => { n.fx = n.x; n.fy = n.y }); snapshotMode('custom'); reapplyDrag() }
}

function enterAgeMode() {
  ctx.simulation.stop()
  const container = ctx.containerRef; if (!container) return
  const { width, height } = container.getBoundingClientRect()
  const ageInfo = computeAgeYPositions(ctx.nodesData, height)

  if (hasSnapshot('age')) {
    const snap = ctx.modeSnapshots['age'], targets = {}
    ctx.nodesData.forEach(n => { targets[n.id] = { x: snap[n.id]?.x ?? n.x, y: ageInfo.yMap[n.id] } })
    animateToPositionsWithReset(targets, () => { ctx.nodesData.forEach(n => { n.fx = n.x; n.fy = ageInfo.yMap[n.id] }); drawYearGuides(ctx, ageInfo.minYear, ageInfo.maxYear, ageInfo.padding, ageInfo.usableHeight); reapplyDrag() })
    return
  }

  const customSnap = ctx.modeSnapshots['custom'], byYear = {}, targets = {}
  ctx.nodesData.forEach(n => { const y = n.birth_year || ageInfo.maxYear; if (!byYear[y]) byYear[y] = []; byYear[y].push(n) })
  const bands = [], sortedYears = Object.keys(byYear).map(Number).sort((a, b) => a - b)
  sortedYears.forEach(yr => { const lb = bands[bands.length - 1]; if (lb && yr - lb.maxYear <= 3) { lb.maxYear = yr; lb.nodes.push(...byYear[yr]) } else bands.push({ minYear: yr, maxYear: yr, nodes: [...byYear[yr]] }) })
  bands.forEach(b => b.nodes.sort((a, c) => (customSnap?.[a.id]?.x ?? a.x) - (customSnap?.[c.id]?.x ?? c.x)))

  ctx.nodesData.forEach(n => {
    const yr = n.birth_year || ageInfo.maxYear, ty = ageInfo.yMap[n.id]
    const band = bands.find(b => yr >= b.minYear && yr <= b.maxYear), row = band ? band.nodes : [n]
    const idx = row.indexOf(n), cnt = row.length
    const sp = Math.max(80, Math.min(120, (width - 160) / Math.max(cnt, 1))), rw = (cnt - 1) * sp
    targets[n.id] = { x: customSnap?.[n.id] ? customSnap[n.id].x : (width - rw) / 2 + idx * sp, y: ty }
  })

  drawYearGuides(ctx, ageInfo.minYear, ageInfo.maxYear, ageInfo.padding, ageInfo.usableHeight)
  animateToPositionsWithReset(targets, () => { ctx.nodesData.forEach(n => { n.fx = n.x; n.fy = ageInfo.yMap[n.id] }); snapshotMode('age'); reapplyDrag() })
}

function enterGenerationMode() {
  ctx.simulation.stop()
  const container = ctx.containerRef; if (!container) return
  const { width, height } = container.getBoundingClientRect()

  if (hasSnapshot('generation')) {
    // Restore saved positions and saved row state exactly as they were
    const snap = ctx.modeSnapshots['generation']
    if (snap._genRowYValues) ctx.genRowYValues = [...snap._genRowYValues]
    if (snap._genRowSpacing) ctx.genRowSpacing = snap._genRowSpacing

    const targets = {}
    ctx.nodesData.forEach(n => { targets[n.id] = snap[n.id] ? { x: snap[n.id].x, y: snap[n.id].y } : { x: n.x, y: n.y } })

    // Build genInfo-like object for drawing guides from saved rows
    const savedGenInfo = { genLabels: ctx.genRowYValues.map((y, i) => ({ label: `Gen ${i + 1}`, y })) }
    animateToPositionsWithReset(targets, () => {
      ctx.nodesData.forEach(n => { n.fx = n.x; n.fy = n.y })
      drawGenGuides(ctx, savedGenInfo)
      reapplyDrag()
    })
    return
  }

  // First time: compute layout from relationships
  const genInfo = computeGenLayout(ctx.nodesData, store.relationships, width, height)
  ctx.genRowYValues = genInfo.genLabels.map(g => g.y)
  ctx.genRowSpacing = genInfo.rowHeight || 140

  drawGenGuides(ctx, genInfo)
  animateToPositionsWithReset(genInfo.targets, () => {
    ctx.nodesData.forEach(n => { n.fx = n.x; n.fy = genInfo.targets[n.id]?.y ?? n.y })
    snapshotGenMode()
    reapplyDrag()
  })
}

// Save generation snapshot including row state
function snapshotGenMode() {
  const snap = {}
  ctx.nodesData.forEach(n => { snap[n.id] = { x: n.x, y: n.y } })
  snap._genRowYValues = [...ctx.genRowYValues]
  snap._genRowSpacing = ctx.genRowSpacing
  ctx.modeSnapshots['generation'] = snap
}

// ── Emphasis ────────────────────────────────────────────────────────────────
function applyEmphasis() {
  if (!ctx.rootGroup || !ctx.svgSelection) return
  const emph = emphVisual(), gs = store.graphSettings, persons = store.persons

  ctx.rootGroup.selectAll('g.graph-link-group').select('.graph-link')
    .transition().duration(250).ease(d3.easeCubicOut)
    .attr('stroke', d => getLinkStroke(d, emph, gs, persons))
    .attr('stroke-width', d => getLinkWidth(d, emph, gs, persons))
    .attr('opacity', d => getLinkEmphOpacity(d, emph, gs, persons))
    .attr('marker-end', d => getLinkMarker(d, emph, persons))

  // Animate paternal/maternal marker sizes
  const isEmphPat = emph === 'paternal'
  const isEmphMat = emph === 'maternal'
  const patSize = isEmphPat ? 16 : 10
  const matSize = isEmphMat ? 16 : 10
  const nodeR = gs.nodeRadius

  ;['#arr-pat', '#arr-pat-ad'].forEach(id => {
    ctx.svgSelection.select(id).transition().duration(250).ease(d3.easeCubicOut)
      .attr('markerWidth', patSize).attr('markerHeight', patSize)
      .attr('refX', nodeR + (isEmphPat ? 14 : 10))
  })
  ;['#arr-mat', '#arr-mat-ad'].forEach(id => {
    ctx.svgSelection.select(id).transition().duration(250).ease(d3.easeCubicOut)
      .attr('markerWidth', matSize).attr('markerHeight', matSize)
      .attr('refX', nodeR + (isEmphMat ? 14 : 10))
  })
}

function cycleEmphasis(which) {
  const mode = currentMode.value
  // Clicking the same state again = no-op
  if (activeEmphasis.value === which) return
  activeEmphasis.value = which
  modeEmphasis[mode] = which
  applyEmphasis()
}

// ── Zoom / search ───────────────────────────────────────────────────────────
function zoomIn() { ctx.svgSelection?.transition().duration(300).call(ctx.zoomBehavior.scaleBy, 1.3) }
function zoomOut() { ctx.svgSelection?.transition().duration(300).call(ctx.zoomBehavior.scaleBy, 0.77) }
function resetZoom() {
  if (!ctx.nodesData.length || !ctx.containerRef) { ctx.svgSelection?.transition().duration(400).call(ctx.zoomBehavior.transform, d3.zoomIdentity); return }
  const { width, height } = ctx.containerRef.getBoundingClientRect()
  const xs = ctx.nodesData.map(d => d.x), ys = ctx.nodesData.map(d => d.y)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2
  ctx.svgSelection?.transition().duration(400).call(ctx.zoomBehavior.transform, d3.zoomIdentity.translate(width / 2 - cx, height / 2 - cy))
}
function fitAll() {
  if (!ctx.nodesData.length || !ctx.containerRef) return
  const { width, height } = ctx.containerRef.getBoundingClientRect()
  const xs = ctx.nodesData.map(d => d.x), ys = ctx.nodesData.map(d => d.y)
  const x0 = Math.min(...xs) - 60, x1 = Math.max(...xs) + 60, y0 = Math.min(...ys) - 60, y1 = Math.max(...ys) + 60
  const scale = Math.min(0.9 * width / (x1 - x0), 0.9 * height / (y1 - y0), 2)
  ctx.svgSelection?.transition().duration(600).call(ctx.zoomBehavior.transform, d3.zoomIdentity.translate(width / 2 - scale * (x0 + x1) / 2, height / 2 - scale * (y0 + y1) / 2).scale(scale))
}
function highlightSearch() {
  if (!ctx.rootGroup) return
  const q = searchQuery.value.toLowerCase().trim()
  ctx.rootGroup.selectAll('g.graph-node').attr('opacity', d => !q || d.name.toLowerCase().includes(q) ? 1 : 0.2)
}

// ── Lifecycle & watchers ────────────────────────────────────────────────────
onMounted(() => { initGraph(); updateGraph() })
onUnmounted(() => { ctx.simulation?.stop(); ctx.resizeObserver?.disconnect(); cancelAnimation() })

watch([() => store.persons, () => store.relationships], () => updateGraph(), { deep: true })
watch(() => store.selectedPersonId, () => { if (ctx.rootGroup) renderNodes() })
watch(() => store.lockNodes, () => reapplyDrag())
watch(() => store.theme, () => {
  ctx.theme = store.theme
  if (!ctx.rootGroup) return
  renderNodes(); renderLinks()
  // Update guide line colors for new theme
  const light = store.theme === 'light'
  const guideStroke = light ? 'rgba(0, 0, 0, 0.10)' : 'rgba(232, 234, 246, 0.12)'
  const guideFill = light ? 'rgba(0, 0, 0, 0.22)' : 'rgba(232, 234, 246, 0.25)'
  ctx.rootGroup.selectAll('.mode-guides line').attr('stroke', guideStroke)
  ctx.rootGroup.selectAll('.mode-guides text').attr('fill', guideFill)
})
watch(() => store.graphSettings, () => {
  if (!ctx.rootGroup || !ctx.simulation) return
  const gs = store.graphSettings, refX = gs.nodeRadius + 10
  ;['#arr', '#arr-a', '#arr-pat', '#arr-mat', '#arr-pat-ad', '#arr-mat-ad'].forEach(id => ctx.svgSelection?.select(id).attr('refX', refX))
  ctx.svgSelection?.select('#arr path').attr('fill', gs.parentChildColor)
  ctx.svgSelection?.select('#arr-a path').attr('fill', gs.adoptedColor)
  if (currentMode.value === 'auto') { ctx.simulation.force('link').distance(gs.linkDistance); ctx.simulation.force('charge').strength(gs.chargeStrength); ctx.simulation.force('collide').radius(gs.nodeRadius + 30); ctx.simulation.alpha(0.2).restart() }
  renderLinks(); renderNodes()
}, { deep: true })
</script>

<style scoped>
.graph-area { position: relative; background: var(--bg); overflow: hidden; }
.graph-svg { display: block; width: 100%; height: 100%; }
.graph-search { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 7px 14px; min-width: 260px; z-index: 5; box-shadow: var(--shadow); }
.graph-search input { background: none; border: none; outline: none; font: inherit; font-size: 13px; color: var(--t1); flex: 1; padding: 0; box-shadow: none; width: auto; }
.graph-search input::placeholder { color: var(--t3); }
.search-icon { font-size: 13px; flex-shrink: 0; }
.graph-controls { position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 5px; box-shadow: var(--shadow); z-index: 5; }
.ctrl-btn { width: 30px; height: 30px; border-radius: 7px; border: none; background: transparent; cursor: pointer; color: var(--t2); font-size: 15px; display: flex; align-items: center; justify-content: center; transition: background 0.12s; font-family: var(--font); }
.ctrl-btn:hover { background: var(--hover); color: var(--t1); }
.ctrl-btn-wide { width: auto; padding: 0 10px; gap: 4px; font-size: 11px; font-weight: 600; position: relative; }
.ctrl-btn-active { background: var(--adim); color: var(--accent); border: 1px solid rgba(108, 142, 245, 0.3); }
.ctrl-sep { width: 1px; background: var(--border); margin: 3px 2px; }
.graph-legend { position: absolute; bottom: 18px; right: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; font-size: 11px; color: var(--t2); z-index: 5; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 10px; min-width: 140px; }
.panel-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--t3); }
.leg-section { display: flex; flex-direction: column; gap: 5px; }
.leg-section-label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: var(--t3); opacity: 0.7; }
.leg-row { display: flex; align-items: center; gap: 8px; font-weight: 500; }
.leg-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.leg-line { width: 22px; height: 2px; flex-shrink: 0; border-radius: 1px; }
.leg-dashed { height: 0; border-top: 2px dashed; background: none !important; }
.ctrl-btn-emph-active { border: 1px solid rgba(255, 255, 255, 0.12); }
.ctrl-btn-emph-active.ctrl-btn-paternal { background: rgba(74, 144, 217, 0.18); color: #4a90d9; border-color: rgba(74, 144, 217, 0.35); }
.ctrl-btn-emph-active.ctrl-btn-maternal { background: rgba(217, 74, 138, 0.18); color: #d94a8a; border-color: rgba(217, 74, 138, 0.35); }
.ctrl-btn-lock { background: rgba(239, 83, 80, 0.15); color: #ef5350; }
.rel-popup { position: absolute; z-index: 20; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 18px; min-width: 180px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45); transform: translateX(-50%) translateY(-100%); display: flex; flex-direction: column; gap: 6px; }
.rel-popup-close { position: absolute; top: 6px; right: 8px; width: 22px; height: 22px; border-radius: 5px; border: none; background: transparent; color: var(--t3); font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.rel-popup-close:hover { background: var(--hover); color: var(--t1); }
.rel-popup-type { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--accent); }
.rel-popup-people { font-size: 13px; font-weight: 600; color: var(--t1); }
.rel-popup-date { font-size: 12px; color: var(--t2); }
.rel-popup-status.divorced { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #ef5350; background: rgba(239, 83, 80, 0.12); padding: 2px 8px; border-radius: 6px; align-self: flex-start; }
.relpop-enter-active { transition: opacity 0.18s ease, transform 0.22s cubic-bezier(0.34, 1.3, 0.64, 1); }
.relpop-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.relpop-enter-from { opacity: 0; transform: translateX(-50%) translateY(-90%) scale(0.92); }
.relpop-leave-to { opacity: 0; transform: translateX(-50%) translateY(-100%) scale(0.95); }

/* Highlights panel */
.highlights-panel {
  position: absolute;
  top: 14px;
  right: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 16px;
  z-index: 5;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 180px;
}

.highlights-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--t3);
}

.highlight-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.highlight-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--t2);
}

/* Segmented slider */
.seg-slider {
  position: relative;
  display: flex;
  background: var(--elevated);
  border-radius: 8px;
  padding: 2px;
  gap: 0;
}

.seg-track {
  position: absolute;
  inset: 2px;
  pointer-events: none;
}

.seg-thumb {
  position: absolute;
  top: 0;
  bottom: 0;
  width: calc(100% / 3);
  background: var(--accent);
  border-radius: 6px;
  opacity: 0.18;
  transition: left 0.25s cubic-bezier(0.4, 0.0, 0.2, 1), background 0.25s;
}

.seg-pos-0 { left: 0; }
.seg-pos-1 { left: calc(100% / 3); background: #4a90d9; }
.seg-pos-2 { left: calc(200% / 3); background: #d94a8a; }

.seg-option {
  flex: 1;
  padding: 5px 0;
  border: none;
  background: transparent;
  font-family: var(--font);
  font-size: 11px;
  font-weight: 500;
  color: var(--t3);
  cursor: pointer;
  text-align: center;
  position: relative;
  z-index: 1;
  border-radius: 6px;
  transition: color 0.2s;
}

.seg-option:hover {
  color: var(--t1);
}

.seg-option.seg-active {
  color: var(--t1);
  font-weight: 700;
}
</style>
