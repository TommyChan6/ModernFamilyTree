<template>
  <div class="timeline-view">
    <!-- Toolbar -->
    <div class="tl-toolbar">
      <div class="tl-heading">
        <span class="tl-title">{{ tr('rail.timeline') }}</span>
        <span class="tl-count">{{ placedCount }}</span>
        <span v-if="undatedCount" class="tl-undated" :title="tr('timeline.undatedHint')">{{
          tr('timeline.undated', { n: undatedCount })
        }}</span>
      </div>

      <div class="tl-actions">
        <span class="tl-hint">{{ tr('timeline.hint') }}</span>
        <CanvasToggles
          show-focus
          show-chronicle
          show-style
          show-kinship
          :focus="focusOpen"
          :legend="legendOpen"
          :chronicle="chronicleOpen"
          :style-pane="store.settingsOpen"
          :kinship="kinOpen"
          show-time-drag
          :time-drag="store.timeDrag"
          :modes="toolModes"
          :active-mode-id="tool"
          :mode-gear="false"
          @update:focus="focusOpen = $event"
          @update:legend="legendOpen = $event"
          @update:chronicle="chronicleOpen = $event"
          @update:style-pane="toggleStyle"
          @update:kinship="kinOpen = $event"
          @update:time-drag="store.timeDrag = $event"
          @pick-mode="pickTool"
        />
      </div>
    </div>

    <!-- Stage: three stacked canvases (grid · WebGL world · gutter/labels) -->
    <div
      ref="stageEl"
      class="tl-stage"
      :class="[
        tool ? 'tool-' + tool : '',
        {
          dragging: panning,
          hoverable: !!hoverId || !!hoverBadge || !!hoverLink,
          'tool-grab': retimeHover,
          'lane-grab': !tool && !!hoverId && timelineMode === 'lanes',
          'time-grab': !tool && !!hoverId && store.timeDrag,
          'tool-grabbing': handleDragging
        }
      ]"
      @pointerdown="onPointerDown"
      @wheel.prevent="onWheel"
      @pointermove="onStageMove"
      @pointerleave="onStageLeave"
      @click="onStageClick"
      @dblclick="onStageDblClick"
    >
      <canvas ref="bgEl" class="tl-canvas"></canvas>
      <canvas ref="glEl" class="tl-canvas"></canvas>
      <canvas ref="fgEl" class="tl-canvas"></canvas>
      <canvas ref="fxEl" class="tl-canvas tl-fx"></canvas>

      <!-- Empty state -->
      <div v-if="!placedCount" class="tl-empty">
        <UiIcon class="tl-empty-icon" name="calendar" :size="44" :stroke="1.6" />
        <div class="tl-empty-title">
          {{
            store.persons.length ? tr('timeline.empty.noDatable') : tr('timeline.empty.noPeople')
          }}
        </div>
        <div class="tl-empty-text">
          {{
            store.persons.length
              ? tr('timeline.empty.noDatableText')
              : tr('timeline.empty.noPeopleText')
          }}
        </div>
      </div>

      <!-- Minimap (top-left, past the year gutter) -->
      <MiniMap
        v-if="placedCount"
        ref="minimapRef"
        class="tl-minimap"
        :class="{ 'tl-cv-hide': store.cleanView }"
        :adapter="minimapAdapter"
        :width="158"
        :height="180"
        :preserve-aspect="false"
      />

      <!-- Floating search (matches the tree view) -->
      <div
        v-if="placedCount"
        class="tl-search"
        :class="{ 'tl-cv-hide': store.cleanView }"
        @pointerdown.stop
        @click.stop
        @wheel.stop
      >
        <SearchField
          v-model="searchQuery"
          class="tl-search-field"
          :placeholder="tr('timeline.searchPh')"
        />
      </div>

      <!-- Zoom controls (matches the tree view's control bar) -->
      <div
        v-if="placedCount"
        class="tl-controls"
        :class="{ 'tl-cv-hide': store.cleanView }"
        @pointerdown.stop
        @click.stop
      >
        <button
          class="tl-ctrl-btn"
          :title="tr('timeline.zoomIn')"
          :aria-label="tr('timeline.zoomIn')"
          @click="zoomBy(1.3333)"
        >
          <UiIcon name="zoom-in" :size="16" />
        </button>
        <button
          class="tl-ctrl-btn"
          :title="tr('timeline.zoomOut')"
          :aria-label="tr('timeline.zoomOut')"
          @click="zoomBy(0.75)"
        >
          <UiIcon name="zoom-out" :size="16" />
        </button>
        <div class="tl-ctrl-sep"></div>
        <button
          v-for="m in timelineModes"
          :key="m.id"
          class="tl-ctrl-btn tl-ctrl-wide"
          :class="{ 'tl-ctrl-active': timelineMode === m.id }"
          :title="tr(`timeline.modes.${m.id}.title`)"
          :aria-pressed="timelineMode === m.id"
          @click="setTimelineMode(m.id)"
        >
          <UiIcon :name="m.icon" :size="16" />{{ tr(`timeline.modes.${m.id}.label`) }}
        </button>
        <div class="tl-ctrl-sep"></div>
        <!-- The coordinate pipeline's two knobs: stretch busy years, tilt to 3D -->
        <button
          class="tl-ctrl-btn"
          :class="{ 'tl-ctrl-active': warpOn }"
          :title="tr('timeline.warpToggle')"
          :aria-label="tr('timeline.warpToggle')"
          :aria-pressed="warpOn"
          @click="toggleWarp"
        >
          <UiIcon name="unfold-vertical" :size="16" />
        </button>
        <button
          class="tl-ctrl-btn"
          :class="{ 'tl-ctrl-active': tiltOn }"
          :title="tr('timeline.tiltToggle')"
          :aria-label="tr('timeline.tiltToggle')"
          :aria-pressed="tiltOn"
          @click="toggleTilt"
        >
          <UiIcon name="rotate-3d" :size="16" />
        </button>
        <div class="tl-ctrl-sep"></div>
        <button
          class="tl-ctrl-btn"
          :title="tr('timeline.fitAll')"
          :aria-label="tr('timeline.fitAll')"
          @click="fitAll(true)"
        >
          <UiIcon name="maximize" :size="16" />
        </button>
        <button
          class="tl-ctrl-btn tl-ctrl-refresh"
          :class="{ 'tl-ctrl-refreshing': refreshSpinning }"
          :title="tr('timeline.refresh')"
          :aria-label="tr('timeline.refreshAria')"
          @click="refreshLayout"
        >
          <UiIcon class="tl-refresh-icon" name="refresh-cw" :size="16" />
        </button>
        <div class="tl-ctrl-sep"></div>
        <span v-if="zoomParts.same" class="tl-zoom-label">{{ zoomParts.v }}</span>
        <span
          v-else
          class="tl-zoom-label"
          :title="tr('timeline.zoomAxes', { v: zoomParts.v, h: zoomParts.h })"
        >
          <UiIcon name="move-vertical" :size="12" />{{ zoomParts.v }}
          <UiIcon name="move-horizontal" :size="12" />{{ zoomParts.h }}
        </span>
      </div>

      <!-- Right-docked overlay panes: Focus + Legend (shared toggle cluster) -->
      <div
        v-if="placedCount"
        class="canvas-pane-stack tl-pane-stack"
        :class="{ 'clean-hidden': store.cleanView }"
      >
        <Transition name="pane"> </Transition>
        <Transition name="pane">
          <KinshipPane
            v-if="kinOpen"
            v-model:anchor-id="kinAnchor"
            v-model:lens-on="kinLensOn"
            v-model:filter="kinFilter"
            :selected-id="store.selectedPersonId"
            @highlight="kinWalkSet = $event"
            @focus-person="kinFocus"
            @trace-pair="tracePair"
            @quiz="quizOpen = true"
          />
        </Transition>
        <Transition name="pane">
          <ChroniclePane
            v-if="chronicleOpen"
            @jump="jumpToYear"
            @hover="(id) => (paneHoverId = id)"
          />
        </Transition>
        <Transition name="pane">
          <div
            v-if="focusOpen"
            class="canvas-pane tl-focus-pane"
            @pointerdown.stop
            @wheel.stop
            @click.stop
          >
            <div class="tl-panel-title">{{ tr('timeline.focus.title') }}</div>
            <div class="tl-focus-row">
              <span class="tl-focus-label">{{ tr('timeline.focus.gender') }}</span>
              <div class="tl-focus-chips">
                <button
                  v-for="o in genderFocusOpts"
                  :key="o.id"
                  class="tl-focus-chip"
                  :class="{ on: focusGender === o.id, 'is-icon': !!o.icon }"
                  :title="o.icon ? tr(o.labelKey) : undefined"
                  :aria-label="tr(o.labelKey)"
                  @click="focusGender = o.id"
                >
                  <UiIcon v-if="o.icon" :name="o.icon" :size="14" />
                  <template v-else>{{ tr(o.labelKey) }}</template>
                </button>
              </div>
            </div>
            <div class="tl-focus-row" :class="{ 'tl-focus-off': !store.currentDate }">
              <span class="tl-focus-label">{{ tr('timeline.focus.life') }}</span>
              <div class="tl-focus-chips">
                <button
                  v-for="o in lifeFocusOpts"
                  :key="o.id"
                  class="tl-focus-chip"
                  :class="{ on: focusLife === o.id }"
                  :disabled="o.id !== 'all' && !store.currentDate"
                  :title="o.id !== 'all' && !store.currentDate ? tr('timeline.focus.needYear') : ''"
                  @click="focusLife = o.id"
                >
                  {{ tr(o.labelKey) }}
                </button>
              </div>
            </div>
          </div>
        </Transition>

        <Transition name="pane">
          <div v-if="legendOpen" class="canvas-pane tl-legend-panel" @pointerdown.stop @wheel.stop>
            <div class="tl-panel-title">{{ tr('timeline.legend.title') }}</div>
            <div class="tl-leg-section">
              <div class="tl-leg-label">{{ tr('timeline.legend.people') }}</div>
              <div class="tl-leg-row">
                <span class="tl-leg-dot" :style="{ background: legendColors.male }"></span
                >{{ tr('data.gender.male') }}
              </div>
              <div class="tl-leg-row">
                <span class="tl-leg-dot" :style="{ background: legendColors.female }"></span
                >{{ tr('data.gender.female') }}
              </div>
            </div>
            <div class="tl-leg-section">
              <div class="tl-leg-label">{{ tr('timeline.legend.lines') }}</div>
              <div class="tl-leg-row">
                <span class="tl-leg-line" :style="{ background: legendColors.spouse }"></span
                >{{ tr('timeline.legend.marriage') }}
              </div>
              <div class="tl-leg-row">
                <span
                  class="tl-leg-line tl-leg-dashed"
                  :style="{ borderColor: legendColors.spouse }"
                ></span
                >{{ tr('timeline.legend.divorced') }}
              </div>
              <div class="tl-leg-row">
                <span class="tl-leg-line" :style="{ background: legendColors.parentChild }"></span
                >{{ tr('timeline.legend.birth') }}
              </div>
              <div class="tl-leg-row">
                <span
                  class="tl-leg-line tl-leg-dashed"
                  :style="{ borderColor: legendColors.parentChild }"
                ></span
                >{{ tr('timeline.legend.adopted') }}
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Chronicle hover card: an era or an event under the cursor -->
      <Transition name="chtip">
        <div
          v-if="chronTip"
          :key="chronTip.key"
          class="tl-chtip"
          :style="{ left: chronTip.x + 'px', top: chronTip.y + 'px', '--c': chronTip.color }"
        >
          <div class="tl-chtip-head">
            <span class="tl-chtip-ic"><UiIcon :name="chronTip.icon" :size="14" /></span>
            <b>{{ chronTip.title }}</b>
          </div>
          <div class="tl-chtip-when">{{ chronTip.when }}</div>
          <div v-if="chronTip.cast" class="tl-chtip-cast">
            <UiIcon name="users" :size="13" />{{ chronTip.cast }}
          </div>
          <div v-if="chronTip.text" class="tl-chtip-text">{{ chronTip.text }}</div>
          <div class="tl-chtip-hint">
            {{ tool === 'retime' ? tr('timeline.tip.dragToMove') : tr('timeline.tip.clickToEdit') }}
          </div>
        </div>
      </Transition>

      <!-- Family-line hover card: whose branch / stem this is -->
      <Transition name="chtip">
        <div
          v-if="bondTip && !chronTip"
          :key="bondTip.key"
          class="tl-chtip"
          :style="{ left: bondTip.x + 'px', top: bondTip.y + 'px', '--c': bondTip.color }"
        >
          <div class="tl-chtip-head">
            <span class="tl-chtip-ic"><UiIcon :name="bondTip.icon" :size="14" /></span>
            <b>{{ bondTip.title }}</b>
          </div>
          <div class="tl-chtip-when">{{ bondTip.when }}</div>
          <div v-for="(line, i) in bondTip.lines" :key="i" class="tl-chtip-cast">
            <UiIcon :name="line.icon" :size="13" />{{ line.text }}
          </div>
        </div>
      </Transition>

      <!-- Marriage year edit popup -->
      <Transition name="medit">
        <div
          v-if="mEdit"
          class="tl-medit"
          :style="{ left: mEdit.px + 'px', top: mEdit.py + 'px' }"
          @pointerdown.stop
          @wheel.stop
          @click.stop
        >
          <div class="tl-medit-title">
            <UiIcon name="heart-handshake" :size="14" /><span>{{ mEdit.names }}</span>
          </div>
          <div class="tl-medit-row">
            <input
              ref="meditInputRef"
              v-model.number="mEdit.year"
              type="number"
              class="tl-medit-input"
              :placeholder="tr('timeline.marriage.year')"
              min="1"
              max="2200"
              @keydown.enter="saveMarriageEdit"
              @keydown.escape="mEdit = null"
            />
            <select v-model="mEdit.status" class="tl-medit-select">
              <option value="active">{{ tr('timeline.marriage.married') }}</option>
              <option value="divorced">{{ tr('timeline.marriage.divorced') }}</option>
            </select>
          </div>
          <div class="tl-medit-actions">
            <button class="tl-medit-btn" @click="mEdit = null">{{ tr('dialog.cancel') }}</button>
            <button class="tl-medit-btn primary" @click="saveMarriageEdit">
              {{ tr('timeline.marriage.save') }}
            </button>
          </div>
        </div>
      </Transition>

      <!-- Selection: the same action pane the graph uses (details, edit, focus,
           trace, kin lens, link two, delete) — graph-only verbs hidden. -->
      <GraphActionPane
        v-if="!tool"
        :spotlight="false"
        :node-style="false"
        @focus-person="focusPerson"
        @trace="traceFrom"
        @trace-pair="tracePair"
        @kin-lens="openKinLens"
      />

      <!-- The traced chain's meaning: kinship headline, arch, DNA + hops -->
      <TraceCard
        :anchor-id="pathAnchor"
        :info="pathInfo"
        :armed-hint="tr('timeline.traceArmed')"
        @close="clearPath"
        @pick="kinFocus"
      />

      <!-- Edit-tool HUD: which tool is live and its next step -->
      <Transition name="tlhud">
        <div
          v-if="toolDef"
          :key="toolDef.id"
          class="tl-hud"
          :style="{ '--mc': toolDef.color }"
          @pointerdown.stop
          @click.stop
        >
          <span class="tl-hud-badge">
            <span class="tl-hud-ring"></span>
            <UiIcon class="tl-hud-ic" :name="toolDef.icon" :size="16" />
          </span>
          <div class="tl-hud-text">
            <div class="tl-hud-label">
              {{ tr(toolDef.labelKey) }} <kbd>{{ toolDef.key }}</kbd>
            </div>
            <div class="tl-hud-hint">{{ hudHint }}</div>
          </div>
          <button
            class="tl-hud-btn"
            :title="tr('timeline.hud.exit')"
            :aria-label="tr('timeline.hud.exitAria')"
            @click="setTool(null)"
          >
            <UiIcon name="x" :size="14" />
          </button>
        </div>
      </Transition>

      <!-- Add / Child: name the life you just placed -->
      <div
        v-if="nameBubble"
        class="tl-bubble"
        :style="{ left: nameBubble.sx + 'px', top: nameBubble.sy + 'px', '--mc': nameBubble.color }"
        @pointerdown.stop
        @click.stop
        @dblclick.stop
        @wheel.stop
      >
        <div class="tl-bubble-head">
          <UiIcon v-if="nameBubble.icon" :name="nameBubble.icon" :size="14" />{{ nameBubble.title }}
        </div>
        <input
          ref="bubbleInputEl"
          v-model="nameBubble.value"
          class="tl-bubble-input"
          :placeholder="tr('timeline.bubble.namePh', { noun: nounLabel(store.noun).toLowerCase() })"
          @keydown.enter.prevent="commitBubble(true)"
        />
        <div v-if="nameBubble.coParents.length" class="tl-bubble-co">
          <span class="tl-bubble-co-label">{{ tr('timeline.bubble.with') }}</span>
          <button
            v-for="c in nameBubble.coParents"
            :key="c.id"
            class="tl-co-chip"
            :class="{ on: nameBubble.coParentId === c.id }"
            :style="{ '--pc': c.color }"
            @click="toggleCoParent(c.id)"
          >
            {{ c.name }}
          </button>
        </div>
        <div class="tl-bubble-actions">
          <button class="btn btn-xs btn-ghost" @click="commitBubble(false)">
            {{ tr('dialog.cancel') }}
          </button>
          <button
            class="btn btn-xs btn-primary"
            :title="tr('timeline.bubble.createHint')"
            @click="commitBubble(true)"
          >
            {{ tr('timeline.bubble.create') }}
          </button>
        </div>
      </div>

      <!-- Link: what binds the two lives? -->
      <div
        v-if="linkPick"
        class="tl-linkpick"
        :class="{ up: linkPick.up }"
        :style="{ left: linkPick.x + 'px', top: linkPick.y + 'px' }"
        @pointerdown.stop
        @click.stop
        @dblclick.stop
        @wheel.stop
      >
        <div class="tl-lp-head">
          <b :style="{ color: genderColor(personById.get(linkPick.a)?.gender) }">{{
            shortName(linkPick.a)
          }}</b>
          <button
            class="tl-lp-swap"
            :title="tr('timeline.link.swap')"
            :aria-label="tr('timeline.link.swapAria')"
            @click="swapLink"
          >
            <UiIcon name="arrow-right-left" :size="13" />
          </button>
          <b :style="{ color: genderColor(personById.get(linkPick.b)?.gender) }">{{
            shortName(linkPick.b)
          }}</b>
          <span class="tl-lp-year">{{ linkPick.year }}</span>
        </div>
        <div class="tl-lp-chips">
          <button
            v-for="(d, i) in linkTypes"
            :key="d.key"
            class="tl-lp-chip"
            :style="{ '--rc': relColor(d), '--i': i }"
            :title="
              d.directed
                ? tr('timeline.link.directed', {
                    a: shortName(linkPick.a),
                    role: relRoleLabel(d, 'a'),
                    b: shortName(linkPick.b)
                  })
                : relTypeLabel(d)
            "
            @click="commitLink(d)"
          >
            <UiIcon class="tl-lp-glyph" :name="d.glyph" :size="13" />{{ relTypeLabel(d) }}
          </button>
        </div>
      </div>
    </div>

    <KinshipQuiz :open="quizOpen" @close="quizOpen = false" />

    <!-- Scene tab strip (a single default scene for now — manual positions
         and per-scene arrangements come later) -->
    <SceneTabs
      v-if="store.caps.scenes"
      :scenes="store.timelineScenes"
      :active-id="store.activeSceneIds.timeline"
      :label="tr('timeline.scenes.label')"
      :add-title="tr('timeline.scenes.add')"
      :duplicate-title="tr('timeline.scenes.duplicate')"
      :delete-title="tr('timeline.scenes.delete')"
      @switch="(id) => store.setActiveScene('timeline', id)"
      @create="addTimelineScene"
      @duplicate="duplicateTimelineScene"
      @rename="(id, name) => store.renameScene(id, name)"
      @remove="removeTimelineScene"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useMainStore } from '../store/index.js'
import { api } from '../api'
import { yearDate } from '../../../shared/calendarMath'
import {
  computeTimelineLayout,
  computeLaneOrder,
  TIMELINE_MODES,
  GUTTER,
  Y_PAD,
  X0,
  LANE_W
} from './timeline/timelineLayout.js'
import { TimelineRenderer } from './timeline/TimelineRenderer.js'
import ChroniclePane from './chronicle/ChroniclePane.vue'
import { chronicleViewModel } from './chronicle/chronicleModel.js'
import { toOrdinal, format as fmtDate } from '../../../shared/calendarMath'
import { erasAt } from '../../../shared/chronicle'
import { hasIcon } from './ui/icons.js'
import UiIcon from './ui/UiIcon.js'
import SearchField from './ui/SearchField.vue'
import { useTimeTravel } from './time/useTimeTravel'
import { withAlpha } from './webgl/overlayUtils.js'
import { inkPigment, rgbToHex, hexToRgb01 } from './webgl/inkMath'
import SceneTabs from './SceneTabs.vue'
import MiniMap from './MiniMap.vue'
import CanvasToggles from './CanvasToggles.vue'
import { confirmDialog, toast } from '../lib/dialogs.js'
import { undoToast } from '../lib/undoToast.js'
import { translate as tr, locale } from '../i18n'
import { relTypeLabel, relRoleLabel, nounLabel, defaultNameLabel } from '../lib/dataLabels'
import { TimelineFx } from './timeline/TimelineFx.js'
import {
  TIMELINE_TOOLS,
  timelineTool,
  insertLane,
  retimeSlotValue,
  shiftLivesUpdates,
  clampRetime,
  spanFromDrag,
  traceSegments,
  moveLanes,
  laneSlotAt,
  laneSlotOf,
  sameOrder
} from './timeline/timelineEdit.js'
import GraphActionPane from './graph/GraphActionPane.vue'
import KinshipPane from './kinship/KinshipPane.vue'
import KinshipQuiz from './kinship/KinshipQuiz.vue'
import TraceCard from './kinship/TraceCard.vue'
import { useKinship, kinClass, kinPalette } from './kinship/useKinship'
import { shortestPath } from './graph/graphInsights.js'
import { auraShaderId } from './graph/webgl/NodeMaterial.js'
import { TILT_MAX } from './graph/webgl/coords.js'

const store = useMainStore()
const tt = useTimeTravel()

// ── Scenes (a single default scene for now; manual positions come later) ────
async function addTimelineScene() {
  const res = await store.createScene('timeline', `Scene ${store.timelineScenes.length + 1}`)
  if (res?.success) store.setActiveScene('timeline', res.data.id)
}

async function duplicateTimelineScene() {
  const id = store.activeSceneIds.timeline
  if (!id) return
  const res = await store.duplicateScene(id)
  if (res?.success) store.setActiveScene('timeline', res.data.scene.id)
}

async function removeTimelineScene(scene) {
  if (store.timelineScenes.length <= 1) return
  const ok = await confirmDialog({
    title: tr('confirm.deleteScene', { name: scene.name }),
    message: tr('confirm.deleteSceneBody'),
    tone: 'danger'
  })
  if (ok) await store.deleteScene(scene.id)
}

// Make sure the project has its default timeline scene once data is in.
watch(
  () => store.persons.length,
  (n) => {
    if (n > 0 && !store.timelineScenes.length) store.ensureScene('timeline', 'Timeline')
  },
  { immediate: true }
)

// This view stays mounted while hidden (App keeps its GL context alive to avoid a
// white flash on view switches); `active` tells us when it's actually on screen.
const props = defineProps({ active: { type: Boolean, default: true } })

// ── Zoom constants ──────────────────────────────────────────────────────────
const MIN_PX = 0.02 // min pixels per year (near-boundless zoom out)
const MAX_PX = 64 // max pixels per year (zoomed all the way in)
const BASE_PX = 8 // "100%" zoom reference
const MIN_LS = 0.05 // min horizontal lane scale
const MAX_LS = 3 // max horizontal lane scale
const KEEP = 100 // min pixels of world that must stay in view

// ── Viewport state ──────────────────────────────────────────────────────────
const stageEl = ref(null)
const bgEl = ref(null)
const glEl = ref(null)
const fgEl = ref(null)
const fxEl = ref(null)
const stageW = ref(0)
const stageH = ref(0)
const pxPerYear = ref(BASE_PX)
const laneScale = ref(1)
const tx = ref(GUTTER + 40)
const ty = ref(0)
const panning = ref(false)
const hoverId = ref(null)
const hoverBadge = ref(null)
// A family line under the cursor: { key, famId, branchIds: Set, ids: Set }
// (a child's branch, or a couple's stem = the whole family).
const hoverLink = ref(null)
const bondTip = ref(null)
const mEdit = ref(null)
const meditInputRef = ref(null)
const searchQuery = ref('')

let renderer = null

const searchOn = computed(() => searchQuery.value.trim().length > 0)
const searchSet = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const s = new Set()
  if (!q) return s
  store.persons.forEach((p) => {
    if (
      (p.name || '').toLowerCase().includes(q) ||
      (p.occupation || '').toLowerCase().includes(q) ||
      (p.location || '').toLowerCase().includes(q)
    )
      s.add(p.id)
  })
  return s
})

// ── Overlay panes (shared header toggle cluster) ────────────────────────────
const focusOpen = ref(false)
const legendOpen = ref(true)
// The toolbar's Style toggle opens the Style Studio on the timeline's own layer.
function toggleStyle(open) {
  store.toggleSettings(open, { layer: 'view' })
}
// Focus emphasis: dim the people who don't match. Applied through the same
// dimming path the renderer already tweens (no renderer changes needed).
const focusGender = ref('all') // 'all' | 'male' | 'female' | 'unknown'
const focusLife = ref('all') // 'all' | 'living' | 'deceased'
const genderFocusOpts = [
  { id: 'all', labelKey: 'timeline.focus.all' },
  { id: 'male', labelKey: 'data.gender.male', icon: 'mars' },
  { id: 'female', labelKey: 'data.gender.female', icon: 'venus' },
  { id: 'unknown', labelKey: 'timeline.focus.unknown', icon: 'circle-help' }
]
const lifeFocusOpts = [
  { id: 'all', labelKey: 'timeline.focus.all' },
  { id: 'living', labelKey: 'timeline.focus.living' },
  { id: 'deceased', labelKey: 'timeline.focus.remembered' }
]
const focusActive = computed(() => focusGender.value !== 'all' || focusLife.value !== 'all')
const personById = computed(() => {
  const m = new Map()
  store.persons.forEach((p) => m.set(p.id, p))
  return m
})
function focusDimmed(id) {
  const p = personById.value.get(id)
  if (!p) return false
  if (focusGender.value !== 'all') {
    const g = p.gender === 'male' || p.gender === 'female' ? p.gender : 'unknown'
    if (g !== focusGender.value) return true
  }
  if (focusLife.value !== 'all') {
    const dead = !!(p.death?.year && store.currentDate && p.death.year <= store.currentDate.year)
    if (focusLife.value === 'deceased' && !dead) return true
    if (focusLife.value === 'living' && dead) return true
  }
  return false
}

function isDimmed(id) {
  if (pathActive.value) return !pathIdSet.value.has(id)
  if (hoverLink.value) return !hoverLink.value.ids.has(id)
  if (kinWalkSet.value) return !kinWalkSet.value.has(id)
  if (kinLensMap.value && !hoverId.value) return !kinIncluded(kinLensMap.value.get(id))
  if (hoverId.value) return !relatedSet.value.has(id)
  if (searchOn.value) return !searchSet.value.has(id)
  if (focusActive.value) return focusDimmed(id)
  return false
}
function connDimmed(ids) {
  if (pathActive.value) return !ids.every((id) => pathIdSet.value.has(id))
  if (hoverLink.value) return !ids.every((id) => hoverLink.value.ids.has(id))
  if (kinWalkSet.value) return !ids.every((id) => kinWalkSet.value.has(id))
  if (kinLensMap.value && !hoverId.value)
    return !ids.every((id) => kinIncluded(kinLensMap.value.get(id)))
  if (hoverId.value) return !ids.includes(hoverId.value)
  if (searchOn.value) return !ids.some((id) => searchSet.value.has(id))
  if (focusActive.value) return ids.every((id) => focusDimmed(id))
  return false
}

const fmtPct = (v) => (v >= 10 ? `${Math.round(v)}` : `${Math.max(0.1, Math.round(v * 10) / 10)}`)
// Zoom readout: one % when both axes match, else per-axis (time · lanes).
const zoomParts = computed(() => {
  const v = fmtPct((pxPerYear.value / BASE_PX) * 100)
  const h = fmtPct(laneScale.value * 100)
  return { v: `${v}%`, h: `${h}%`, same: v === h }
})

// ── Colors follow the graph settings so every view speaks the same language ─
const colors = computed(() => ({
  male: store.graphSettings.maleColor,
  female: store.graphSettings.femaleColor,
  unknown: store.graphSettings.unknownColor,
  spouse: store.graphSettings.spouseColor,
  parentChild: store.graphSettings.parentChildColor
}))

// The legend speaks the renderer's language: in ink the lifelines are pigment
// ground into ink and marriages are the cinnabar red thread.
const legendColors = computed(() => {
  if (!store.isInk) return colors.value
  const pig = (hex) => rgbToHex(inkPigment(hexToRgb01(hex), { sat: 0.55, ink: 0.58 }))
  return {
    male: pig(colors.value.male),
    female: pig(colors.value.female),
    unknown: pig(colors.value.unknown),
    spouse: 'var(--ink-cinnabar)',
    parentChild: '#5c5750'
  }
})

function genderColor(g) {
  if (g === 'male') return colors.value.male
  if (g === 'female') return colors.value.female
  return colors.value.unknown
}

// ── Layout (world units; recomputed on data changes only, never on zoom) ────
// Lane order is frozen once data arrives, so day-to-day edits never shuffle the
// lanes (new people simply append on the right). The refresh button re-runs the
// family-tree layout algorithm on demand and the lanes glide into place.
const refYear = computed(() => store.currentDate?.year ?? new Date().getFullYear())
const laneOrder = ref(null)
const laneOrderFor = () =>
  computeLaneOrder(store.persons, store.relationships, store.relTypeRoles, refYear.value)
// A life created from the canvas claims the lane it was placed in (instead of
// appending on the far right): { before: Set<id>, opts } until it arrives.
let pendingLane = null
// Each timeline scene keeps its own lane arrangement (scene.config.laneOrder):
// dragging lives around, a refresh, or a newcomer's chosen lane all persist,
// and switching scenes switches arrangements.
const activeTimelineScene = computed(
  () => store.timelineScenes.find((sc) => sc.id === store.activeSceneIds.timeline) || null
)
const savedLaneOrder = computed(() => {
  const o = activeTimelineScene.value?.config?.laneOrder
  return Array.isArray(o) && o.length ? o : null
})
// ── Modes (like the graph's layout types, one per timeline scene) ───────────
// Lanes: every life keeps its own lane; family stems + bridged branches show
// who descends from whom. Sprout: lives grow out of their parents' stem into
// lanes reused once their occupant is gone (computed — no lane dragging).
// Rivers: channels are households — children are born inside their parents'
// channel and lives only cross when they marry or leave home (computed too).
const timelineModes = [
  { id: 'lanes', icon: 'columns-3' },
  { id: 'sprout', icon: 'sprout' },
  { id: 'rivers', icon: 'waves' }
]
const modeFallback = ref('lanes') // no scene yet (the default scene arrives with data)
const timelineMode = computed(() => {
  const scene = activeTimelineScene.value
  const m = scene ? scene.config?.mode : modeFallback.value
  return TIMELINE_MODES.includes(m) ? m : 'lanes'
})
async function setTimelineMode(mode) {
  if (mode === timelineMode.value) return
  const scene = activeTimelineScene.value
  modeFallback.value = mode
  hoverLink.value = null
  if (!scene) return
  await store.saveScene({
    id: scene.id,
    config: JSON.parse(JSON.stringify({ ...(scene.config || {}), mode }))
  })
}
let lanesSaving = 0 // our own writes in flight — don't echo them back
function freshLaneOrder() {
  return savedLaneOrder.value ? [...savedLaneOrder.value] : laneOrderFor()
}
watch(
  () => store.activeProjectId,
  () => {
    laneOrder.value = null
  }
)
watch(
  () => store.persons,
  () => {
    if (store.persons.length && !laneOrder.value) laneOrder.value = freshLaneOrder()
    if (pendingLane && laneOrder.value) {
      const fresh = store.persons.filter((p) => !pendingLane.before.has(p.id))
      if (fresh.length === 1) {
        laneOrder.value = insertLane(
          laneOrder.value,
          layout.value.people,
          fresh[0].id,
          pendingLane.opts
        )
        pendingLane = null
        persistLanes(laneOrder.value)
      }
    }
  },
  { immediate: true, deep: true }
)
watch([() => store.activeSceneIds.timeline, savedLaneOrder], ([sid, saved], [prevSid]) => {
  if (lanesSaving || !store.persons.length) return
  if (sid !== prevSid) laneOrder.value = freshLaneOrder()
  else if (saved && !sameOrder(saved, laneOrder.value)) laneOrder.value = [...saved]
})

/** The full lane order as shown (dated lanes on screen, then undated ids). */
function fullLaneOrder() {
  const shown = layout.value.people.map((p) => p.id)
  const set = new Set(shown)
  return [...shown, ...(laneOrder.value || []).filter((id) => !set.has(id))]
}
async function persistLanes(order) {
  const scene = activeTimelineScene.value
  if (!scene || !order) return
  lanesSaving++
  try {
    await store.saveScene({
      id: scene.id,
      config: JSON.parse(JSON.stringify({ ...(scene.config || {}), laneOrder: order }))
    })
  } finally {
    lanesSaving--
  }
}
/** Apply a new lane order as one undoable arrangement step. */
function commitLanes(next, { prev = fullLaneOrder(), label = 'move' } = {}) {
  if (sameOrder(prev, next)) return false
  const scene = activeTimelineScene.value
  if (scene) store.recordLayoutStep({ view: 'timeline', sceneId: scene.id, order: prev }, label)
  laneOrder.value = next
  persistLanes(next)
  return true
}
/** Undo/redo of a lane step (the store calls this through the journal). */
async function restoreLanes(state) {
  if (!store.timelineScenes.some((sc) => sc.id === state.sceneId)) return null
  store.activeView = 'timeline'
  if (store.activeSceneIds.timeline !== state.sceneId) {
    store.setActiveScene('timeline', state.sceneId)
    await nextTick()
  }
  const inverse = { view: 'timeline', sceneId: state.sceneId, order: fullLaneOrder() }
  laneOrder.value = [...state.order]
  persistLanes(state.order)
  return inverse
}

const refreshSpinning = ref(false)
let refreshSpinTimer = 0
function refreshLayout() {
  commitLanes(laneOrderFor(), { label: 'layout' })
  refreshSpinning.value = true
  if (refreshSpinTimer) clearTimeout(refreshSpinTimer)
  refreshSpinTimer = setTimeout(() => {
    refreshSpinning.value = false
    refreshSpinTimer = 0
  }, 700)
}

// Dated story events stretch the axis so none falls off either end.
const eventYears = computed(() =>
  store.events.flatMap((ev) => [toOrdinal(ev.date), toOrdinal(ev.end)]).filter((y) => y != null)
)
const layout = computed(() =>
  computeTimelineLayout(
    store.persons,
    store.relationships,
    refYear.value,
    laneOrder.value,
    store.relTypeRoles,
    eventYears.value,
    { mode: timelineMode.value, leaveHomeAge: store.timelineSettings.leaveHomeAge ?? 25 }
  )
)

// ── Chronicle (eras + story events) ─────────────────────────────────────────
const chronicleOpen = ref(false)
const hoverChron = ref(null) // { kind: 'era' | 'event', id } under the cursor
const paneHoverId = ref(null) // an event hovered in the Chronicle pane
const chronTip = ref(null)
const chronModel = computed(() => chronicleViewModel(store.eras, store.events))
const chronHover = computed(() =>
  paneHoverId.value ? { kind: 'event', id: paneHoverId.value } : hoverChron.value
)
// Open the pane by default once the project has a chronicle to show.
let chronicleSeen = false
watch(
  () => store.eras.length + store.events.length > 0,
  (has) => {
    if (has && !chronicleSeen) chronicleOpen.value = true
    chronicleSeen = chronicleSeen || has
  },
  { immediate: true }
)
watch([chronModel, chronHover], () => renderer?.refreshChronicle())
// Canvas text (names, years, badges, era headers) is translated at draw time.
watch(locale, () => renderer?.refreshChronicle())

function chronTipFor(hit, p) {
  if (!hit) return null
  if (hit.kind === 'era') {
    const e = store.eras.find((x) => x.id === hit.id)
    if (!e) return null
    return {
      key: 'era:' + e.id,
      icon: hasIcon(e.icon) ? e.icon : 'diamond',
      title: defaultNameLabel(e.name),
      color: e.color,
      when: `${fmtDate(e.start) || '…'} – ${fmtDate(e.end) || tr('timeline.tip.now')}`,
      cast: '',
      text: e.description,
      x: Math.min((p.sx ?? p.x) + 14, stageW.value - 260),
      y: (p.sy ?? p.y) + 16
    }
  }
  const ev = store.events.find((x) => x.id === hit.id)
  if (!ev) return null
  const m = chronModel.value.events.find((x) => x.id === ev.id)
  const names = ev.person_ids.map((id) => personById.value.get(id)?.name).filter(Boolean)
  const when = fmtDate(ev.date)
    ? fmtDate(ev.end)
      ? `${fmtDate(ev.date)} – ${fmtDate(ev.end)}`
      : fmtDate(ev.date)
    : tr('timeline.tip.undated')
  const era = erasAt(store.eras, toOrdinal(ev.date))[0]
  return {
    key: 'ev:' + ev.id,
    icon: hasIcon(m?.icon) ? m.icon : m?.kindIcon || 'sparkle',
    title: defaultNameLabel(ev.title),
    color: m?.color || 'var(--accent)',
    when: `${when}${ev.place ? ' · ' + ev.place : ''}${era ? ' · ' + defaultNameLabel(era.name) : ''}`,
    cast:
      names.length > 4 ? `${names.slice(0, 3).join(', ')} +${names.length - 3}` : names.join(', '),
    text: ev.description,
    x: Math.min((p.sx ?? p.x) + 14, stageW.value - 260),
    y: (p.sy ?? p.y) + 16
  }
}

/** Glide the camera so a year sits mid-stage (keeps the current zoom). */
function jumpToYear(year) {
  if (year == null || !Number.isFinite(year)) return
  const px = pxPerYear.value
  const nty = stageH.value / 2 - ((axisOf(year) - layout.value.minYear) * px + Y_PAD)
  tweenTo(px, laneScale.value, tx.value, nty, 420)
}

/** The real year at a flat stage y (through the time warp, if on). */
function yearAtY(y) {
  if (renderer) return renderer.yearAt(y)
  return (y - ty.value - Y_PAD) / pxPerYear.value + layout.value.minYear
}
/** A real year's position on the (possibly warped) axis, in axis years —
 *  what the linear camera math (ty = … (axis − minYear) · px …) works in. */
function axisOf(year) {
  return renderer ? renderer.axisOf(year) : year
}

// Double-click empty timeline: a new event at that year (the person under
// the cursor, if any, joins its cast).
function onStageDblClick(e) {
  if (!stageEl.value || !renderer || tool.value) return
  const p = stagePoint(e)
  if (p.x < GUTTER || renderer.chronicleAt(p.x, p.y)) return
  const person = renderer.personAt(p.x, p.y)
  // Double-click a life → its profile card.
  if (person && livePersonAt(p)) {
    store.selectPerson(person.id)
    return
  }
  const year = Math.round(yearAtY(p.y))
  store.openEventEditor({
    date: { year, month: null, day: null, precision: 'year', calendar: 'gregorian' },
    person_ids: person ? [person.id] : []
  })
}
const placedCount = computed(() => layout.value.people.length)
const undatedCount = computed(() => layout.value.undatedCount)

// ── Hover neighbourhood ─────────────────────────────────────────────────────
const relatedSet = computed(() => {
  const s = new Set()
  if (!hoverId.value) return s
  s.add(hoverId.value)
  store.relationships.forEach((r) => {
    if (r.person_a_id === hoverId.value) s.add(r.person_b_id)
    if (r.person_b_id === hoverId.value) s.add(r.person_a_id)
  })
  return s
})

// ── Per-item visual targets consumed (and tweened) by the renderer ──────────
// Time travel: anything that appears after the scrubbed year fades to 0 (the
// renderer tweens the change); lifeline *growth* up to the year is handled by
// the renderer itself via the getTimeYear hook.
function personVisual(p) {
  const hovered = hoverId.value === p.id || !!hoverLink.value?.ids.has(p.id)
  const lit = searchOn.value && searchSet.value.has(p.id)
  const selected = selectedSet.value.has(p.id)
  const onPath = pathIdSet.value.has(p.id)
  const anchored = linkAnchor.value?.id === p.id || pathAnchor.value === p.id
  const lifted = !!liftedSet.value?.has(p.id)
  const notYet = p.birthYear > tt.gateYear.value || p.birthYear < tt.gateStartYear.value
  // Kinship lens: every relative rings in their kin colour.
  const k = kinLensMap.value ? kinLensMap.value.get(p.id) : null
  const kinRing = k && kinIncluded(k) ? kinColors.value[kinClass(k)] : null
  // Aura (a tag/trait's special effect): an ornament on the pin, an optional
  // line effect on the lifeline, and an optional tint for the lifeline + ring.
  const au = store.auraOf?.get(p.id)
  const tint = au?.tint || null
  const ring = kinRing || tint
  const strong = hovered || lit || selected || onPath || anchored || lifted
  return {
    opacity: notYet ? 0 : isDimmed(p.id) ? 0.22 : 1,
    lineWidth: strong ? 9 : 6,
    avatarScale: notYet
      ? 0.6
      : lifted
        ? 1.3
        : hovered || anchored
          ? 1.15
          : k?.kind === 'self'
            ? 1.12
            : 1,
    glow: hovered ? 0.5 : 0,
    selected,
    halo: selected || onPath || anchored || lifted ? 1 : hovered ? 0.55 : 0,
    ring,
    color: tint || genderColor(p.gender),
    // The pin keeps the gender fill; a tint only rings it (as on the graph).
    pinColor: tint ? genderColor(p.gender) : null,
    imageUrl: p.image ? api.getImageUrl(p.image) || null : null,
    aura:
      au && au.ornament !== 'none'
        ? { id: auraShaderId(au.ornament), k: au.intensity, color: au.color, ornament: au.ornament }
        : null,
    auraLine: au && au.line && au.line !== 'none' ? au.line : null
  }
}

function marriageVisual(m) {
  const notYet = m.year > tt.gateYear.value || m.year < tt.gateStartYear.value
  const group = notYet ? 0 : connDimmed(m.ids) ? 0.12 : 1
  const lit = hoverId.value && m.ids.includes(hoverId.value)
  const base = m.estimated ? 0.35 : m.divorced ? 0.5 : 0.8
  const dash = m.estimated ? [2, 5] : m.divorced ? [6, 5] : [0, 0]
  return {
    lineOpacity: (lit ? 1 : base) * group,
    width: lit ? 2.5 : 2.4,
    dashLen: dash[0],
    dashGap: dash[1],
    dotOpacity: (m.estimated ? 0.4 : 1) * group,
    badgeOpacity: group,
    color: colors.value.spouse
  }
}

// A family line is on a trace / kin walk when a parent AND a child are (the
// chain runs through one parent, not necessarily both).
function linkDimmed(children, parents, ids = [...parents, ...children]) {
  const on = (set) => children.some((id) => set.has(id)) && parents.some((id) => set.has(id))
  if (pathActive.value) return !on(pathIdSet.value)
  if (kinWalkSet.value) return !on(kinWalkSet.value)
  return connDimmed(ids)
}

// A child's branch (b.ids = its parents, then the child).
function birthVisual(b) {
  const notYet = b.year > tt.gateYear.value || b.year < tt.gateStartYear.value
  const hl = hoverLink.value
  const lit = hl ? hl.branchIds.has(b.id) : hoverId.value && b.ids.includes(hoverId.value)
  const group = notYet ? 0 : (hl ? !lit : linkDimmed([b.childId], b.parents)) ? 0.08 : 1
  return {
    lineOpacity: (lit ? 0.95 : 0.55) * group,
    width: lit ? 2.2 : 1.8,
    dashLen: b.adopted ? 4 : 0,
    dashGap: b.adopted ? 4 : 0,
    dotOpacity: 0.8 * group,
    color: colors.value.parentChild
  }
}

// A couple's stem (and co-parent bar): lit with any of its family.
function familyVisual(f) {
  const notYet = f.firstYear > tt.gateYear.value || f.lastYear < tt.gateStartYear.value
  const hl = hoverLink.value
  const ids = [...f.parents, ...f.children]
  const lit = hl
    ? hl.famId === f.id
    : !!hoverId.value && (f.parents.includes(hoverId.value) || f.children.includes(hoverId.value))
  const dim = hl ? !lit : !lit && linkDimmed(f.children, f.parents, ids)
  const group = notYet ? 0 : dim ? 0.08 : 1
  return {
    lineOpacity: (lit ? 0.95 : 0.55) * group,
    width: lit ? 2.2 : 1.8,
    dashLen: f.adopted ? 4 : 0,
    dashGap: f.adopted ? 4 : 0,
    color: colors.value.parentChild
  }
}

// A household channel (rivers): brighter while hovered, faded with its people.
function householdVisual(h) {
  const hl = hoverLink.value
  const lit = hl ? hl.householdId === h.id : !!hoverId.value && h.members.includes(hoverId.value)
  const notYet = h.start > tt.gateYear.value || h.end < tt.gateStartYear.value
  const dim = hl ? !lit : !lit && connDimmed(h.members)
  return { opacity: notYet ? 0 : dim ? 0.35 : 1, lit }
}

// ── Pan / zoom mechanics ────────────────────────────────────────────────────
let startX = 0,
  startY = 0,
  startTx = 0,
  startTy = 0,
  moved = false,
  suppressClick = false

function syncCamera() {
  renderer?.setCamera({ px: pxPerYear.value, ls: laneScale.value, tx: tx.value, ty: ty.value })
  minimapRef.value?.redraw()
}

// ── Minimap (top-left) ──────────────────────────────────────────────────────
// Minimap world = (laneX in unscaled px, year): the two axes share no unit, so
// the projection stretches each independently (preserve-aspect off). Lifelines
// draw as tiny gender-coloured strokes batched into one path per colour.
const minimapRef = ref(null)
const minimapAdapter = {
  getBounds: () => {
    const L = layout.value
    if (!L.people.length) return null
    return { minX: 0, minY: L.minYear, maxX: L.worldWBase, maxY: L.maxYear }
  },
  getView: () => ({
    x: -tx.value / laneScale.value,
    y: (-ty.value - Y_PAD) / pxPerYear.value + layout.value.minYear,
    w: stageW.value / laneScale.value,
    h: stageH.value / pxPerYear.value
  }),
  drawContent: (g, proj, colors) => {
    void colors
    const byColor = new Map()
    for (const p of layout.value.people) {
      const c = genderColor(p.gender)
      let list = byColor.get(c)
      if (!list) byColor.set(c, (list = []))
      list.push(p)
    }
    g.lineWidth = 1.4
    g.lineCap = 'round'
    for (const [c, list] of byColor) {
      g.strokeStyle = withAlpha(c, 0.6)
      g.beginPath()
      for (const p of list) {
        if (p.path) {
          // rivers: the life's polyline
          for (let k = 0; k < p.path.length; k += 2) {
            const X = p.path[k + 1] * proj.sx + proj.ox,
              Y = axisOf(p.path[k]) * proj.sy + proj.oy
            if (k) g.lineTo(X, Y)
            else g.moveTo(X, Y)
          }
          continue
        }
        // (minimap y is axis years, like its view box — the warp included)
        const mx = p.laneX * proj.sx + proj.ox
        g.moveTo(mx, axisOf(p.birthYear) * proj.sy + proj.oy)
        g.lineTo(mx, axisOf(Math.max(p.endYear, p.birthYear + 1)) * proj.sy + proj.oy)
      }
      g.stroke()
    }
  },
  panTo: (wx, wy, opts) => {
    const px = pxPerYear.value
    const ls = laneScale.value
    const ntx = stageW.value / 2 - wx * ls
    const nty = stageH.value / 2 - ((wy - layout.value.minYear) * px + Y_PAD) // wy: axis years
    if (opts?.smooth) {
      tweenTo(px, ls, ntx, nty, 260)
    } else {
      cancelTween()
      const c = clampVals(px, ls, ntx, nty)
      tx.value = c.x
      ty.value = c.y
      syncCamera()
    }
  }
}

function clampVals(px, ls, x, y) {
  // Free pan/zoom, tree-view style: zooming out just reveals more of the
  // year grid around a shrinking timeline. Only stop the world from being
  // pushed entirely off-screen.
  const wW = layout.value.worldWBase * ls
  const wH = layout.value.yearSpan * px + Y_PAD * 2
  const cx = Math.min(stageW.value - KEEP, Math.max(GUTTER + KEEP - wW, x))
  const cy = Math.min(stageH.value - KEEP, Math.max(KEEP - wH, y))
  return { x: cx, y: cy }
}

function clampPan() {
  const c = clampVals(pxPerYear.value, laneScale.value, tx.value, ty.value)
  tx.value = c.x
  ty.value = c.y
}

// Stage handlers bail when the stage ref is gone: during the view-switch leave
// transition the DOM (and its listeners) outlives the component.
function onPointerDown(e) {
  if (e.button !== 0 || !stageEl.value) return
  // Alt-drag tilts / turns the board (as on the graph)
  if (e.altKey && renderer) return beginTiltDrag(e)
  if (!tool.value && renderer && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    const p = stagePoint(e)
    if (p.x > GUTTER && !renderer.chronicleAt(p.x, p.y) && !renderer.badgeAt(p.x, p.y)) {
      const person = livePersonAt(p)
      // Sprout lanes are computed: there a life only drags in time.
      if (person && (timelineMode.value === 'lanes' || store.timeDrag))
        return startLaneDrag(person, p, e)
    }
  }
  if (tool.value && renderer && !nameBubble.value && !linkPick.value) {
    const p = stagePoint(e)
    if (tool.value === 'retime') {
      const h = retimeTarget(p)
      if (h) return startDrag('retime', p, { h }, e)
    } else if (tool.value === 'event' && p.x > GUTTER && !renderer.chronicleAt(p.x, p.y)) {
      return startDrag('span', p, {}, e)
    }
  }
  panning.value = true
  moved = false
  cancelTween()
  startX = e.clientX
  startY = e.clientY
  startTx = tx.value
  startTy = ty.value
  startFlat = flatOfClient(e.clientX, e.clientY)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}
// The flat stage point under a client position (tilted: the board point).
// Independent of the camera's pan/zoom, so a drag can pin the grabbed spot.
let startFlat = null
function flatOfClient(cx, cy) {
  const rect = stageEl.value?.getBoundingClientRect()
  const x = cx - (rect?.left || 0),
    y = cy - (rect?.top || 0)
  return renderer ? renderer.toFlat(x, y) : { x, y }
}
function onPointerMove(e) {
  const dx = e.clientX - startX,
    dy = e.clientY - startY
  if (!moved && Math.hypot(dx, dy) > 4) moved = true
  if (!moved) return
  // Flat: the screen delta. Tilted: the grabbed board point stays under the
  // cursor exactly (the flat delta between where it was and where it is).
  const f = startFlat && renderer?.tilted ? flatOfClient(e.clientX, e.clientY) : null
  tx.value = startTx + (f ? f.x - startFlat.x : dx)
  ty.value = startTy + (f ? f.y - startFlat.y : dy)
  clampPan()
  syncCamera()
}
function onPointerUp() {
  panning.value = false
  suppressClick = moved
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

// Scroll = zoom (map-app style; panning is drag-only):
//   plain scroll → uniform zoom, hold Z → vertical (time) only, X → horizontal
//   (lanes) only. The axis keys are ignored while a text field is focused.
const stretchKeys = new Set() // 'x' (horizontal) and/or 'z' (vertical) held
function isTypingTarget(el) {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true
}
function onStretchKeyDown(e) {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
  if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return
  const k = e.key.toLowerCase()
  if (k === 'x' || k === 'z') stretchKeys.add(k)
}
function onStretchKeyUp(e) {
  const k = e.key.toLowerCase()
  if (k === 'x' || k === 'z') stretchKeys.delete(k)
}
function clearStretchKeys() {
  stretchKeys.clear()
}
function onWheel(e) {
  if (!stageEl.value) return
  cancelTween()
  // (tilted: zoom about the board point under the cursor)
  const { x: mx, y: my } = flatOfClient(e.clientX, e.clientY)
  const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX
  const factor = Math.exp(-delta * 0.0022)

  // Hold X → horizontal only, Z → vertical only; neither → uniform (both).
  const armed = !isTypingTarget(document.activeElement) && stretchKeys.size > 0
  const onlyX = armed && stretchKeys.has('x') && !stretchKeys.has('z')
  const onlyZ = armed && stretchKeys.has('z') && !stretchKeys.has('x')
  const vertical = !onlyX
  const horizontal = !onlyZ

  const oldPx = pxPerYear.value,
    oldLs = laneScale.value
  const newPx = vertical ? Math.min(MAX_PX, Math.max(MIN_PX, oldPx * factor)) : oldPx
  const newLs = horizontal ? Math.min(MAX_LS, Math.max(MIN_LS, oldLs * factor)) : oldLs
  // Keep the point under the cursor fixed on each zoomed axis
  if (vertical) ty.value = anchorTy(my, ty.value, newPx / oldPx)
  if (horizontal) tx.value = mx - (mx - tx.value) * (newLs / oldLs)
  pxPerYear.value = newPx
  laneScale.value = newLs
  clampPan()
  syncCamera()
}

// New ty that keeps screen point `my` over the same year after scaling by k.
// World y = (year − minYear) · px + Y_PAD, and Y_PAD doesn't scale — naive
// proportional scaling drifts by Y_PAD·(k−1) per step.
function anchorTy(my, oldTy, k) {
  return my - ((my - oldTy - Y_PAD) * k + Y_PAD)
}

// ── Hover / click hit-testing against the renderer ──────────────────────────
// A pointer on the stage, in FLAT stage px (x, y — what hit tests, edit tools
// and ghosts work in; the board point under the cursor when tilted) plus the
// raw screen px (sx, sy — for placing DOM popups). Identical when flat.
function stagePoint(e) {
  const rect = stageEl.value.getBoundingClientRect()
  const sx = e.clientX - rect.left,
    sy = e.clientY - rect.top
  const f = renderer ? renderer.toFlat(sx, sy) : { x: sx, y: sy }
  return { x: f.x, y: f.y, sx, sy }
}
/** Screen px of a flat stage point (for DOM popups anchored to the canvas). */
function screenOf(x, y) {
  return renderer ? renderer.project(x, y) : { x, y, s: 1 }
}

function onStageMove(e) {
  if (!stageEl.value || !renderer) return
  const p = stagePoint(e)
  renderer?.setMouseY(panning.value ? null : p.y)
  if (panning.value) {
    chronTip.value = null
    setHoverLink(null)
    return
  }
  if (tool.value) {
    toolGhost(p)
    if (tool.value !== 'retime') {
      chronTip.value = null
      hoverChron.value = null
    }
  }
  // Chronicle items (event pills, era headers) sit above people.
  const ch = renderer.chronicleAt(p.x, p.y)
  const chKey = ch ? ch.kind + ':' + ch.id : null
  const curKey = hoverChron.value ? hoverChron.value.kind + ':' + hoverChron.value.id : null
  if (chKey !== curKey) hoverChron.value = ch ? { kind: ch.kind, id: ch.id } : null
  chronTip.value = tool.value && tool.value !== 'retime' ? null : chronTipFor(ch, p)
  if (ch) {
    if (hoverId.value) {
      hoverId.value = null
      renderer.markStylesDirty()
    }
    setHoverLink(null)
    return
  }
  const badge = renderer?.badgeAt(p.x, p.y) || null
  hoverBadge.value = badge ? badge.id : null
  renderer?.setHoverBadge(hoverBadge.value)
  let person = badge ? null : renderer?.personAt(p.x, p.y)
  // hidden by Time travel — outside the framed [start, end] window
  if (person && (person.birthYear > tt.gateYear.value || person.birthYear < tt.gateStartYear.value))
    person = null
  const id = person ? person.id : null
  if (id !== hoverId.value) {
    hoverId.value = id
    renderer?.markStylesDirty()
  }
  // A family line under the cursor (only where no life or badge is, and not
  // through an overlay like the control bar).
  const onCanvas = e.target instanceof HTMLCanvasElement
  setHoverLink(onCanvas && !id && !badge && !tool.value ? renderer.linkAt(p.x, p.y) : null, p)
}

// ── Family-line hover: light the line + its people, explain it in a card ────
const placedById = computed(() => new Map(layout.value.people.map((q) => [q.id, q])))
function setHoverLink(hit, p) {
  const key = hit
    ? hit.kind === 'household'
      ? 'h:' + hit.household.id
      : hit.kind === 'family'
        ? 'f:' + hit.family.id
        : 'b:' + hit.branch.id
    : null
  if (key !== (hoverLink.value?.key ?? null)) {
    if (!hit) hoverLink.value = null
    else if (hit.kind === 'household') {
      // Rivers: a household channel lights everyone who ever lived in it.
      const h = hit.household
      hoverLink.value = {
        key,
        famId: null,
        householdId: h.id,
        heads: h.heads,
        branchIds: new Set(),
        ids: new Set(h.members)
      }
    } else if (hit.kind === 'family') {
      const f = hit.family
      hoverLink.value = {
        key,
        famId: f.id,
        branchIds: new Set(layout.value.branches.filter((b) => b.famId === f.id).map((b) => b.id)),
        ids: new Set([...f.parents, ...f.children])
      }
    } else {
      const b = hit.branch
      hoverLink.value = { key, famId: b.famId, branchIds: new Set([b.id]), ids: new Set(b.ids) }
    }
  }
  bondTip.value = hit && p ? bondTipFor(hit, p) : null
}
function fullName(id) {
  return personById.value.get(id)?.name || tr('timeline.canvas.unnamed')
}
function bondTipFor(hit, p) {
  const base = {
    x: Math.min((p.sx ?? p.x) + 14, stageW.value - 260),
    y: (p.sy ?? p.y) + 16,
    color: colors.value.parentChild
  }
  if (hit.kind === 'household') return householdTip(hit.household, base)
  if (hit.kind === 'branch') {
    const b = hit.branch
    const names = b.parents.map(fullName).join(' & ')
    const ages = b.parents
      .map((id) => {
        const q = placedById.value.get(id)
        const age = q ? Math.floor(b.year - q.birthYear) : -1
        return age >= 0 ? tr('timeline.bond.ageAt', { name: shortName(id), age }) : null
      })
      .filter(Boolean)
      .join(' · ')
    const lines = [
      {
        icon: 'users',
        text: tr(b.adopted ? 'timeline.bond.adoptedBy' : 'timeline.bond.childOf', { names })
      }
    ]
    if (ages) lines.push({ icon: 'cake', text: ages })
    return {
      ...base,
      key: 'b:' + b.id,
      icon: b.adopted ? 'heart-handshake' : 'baby',
      title: fullName(b.childId),
      when: tr('timeline.bond.born', { year: Math.floor(b.year) }),
      lines
    }
  }
  const f = hit.family
  const kids = f.children.map(shortName)
  const n = kids.length
  return {
    ...base,
    key: 'f:' + f.id,
    icon: 'users',
    title: f.parents.map(fullName).join(' & '),
    when: tr(n === 1 ? 'timeline.bond.oneChild' : 'timeline.bond.children', { n }),
    lines: [
      {
        icon: 'baby',
        text: n > 5 ? `${kids.slice(0, 4).join(', ')} +${n - 4}` : kids.join(', ')
      }
    ]
  }
}

// Rivers: "Household of A & B · 1850–1910 · 6 children".
function householdTip(h, base) {
  const kids = h.children.map(shortName)
  const n = kids.length
  const lines = []
  if (n)
    lines.push({
      icon: 'baby',
      text:
        tr(n === 1 ? 'timeline.bond.oneChild' : 'timeline.bond.children', { n }) +
        ' · ' +
        (n > 5 ? `${kids.slice(0, 4).join(', ')} +${n - 4}` : kids.join(', '))
    })
  const joined = h.members.filter((id) => !h.heads.includes(id) && !h.children.includes(id))
  if (joined.length)
    lines.push({
      icon: 'users',
      text: tr('timeline.river.joined', { names: joined.map(shortName).join(', ') })
    })
  const to = Math.floor(h.end) >= refYear.value ? tr('timeline.tip.now') : Math.floor(h.end)
  return {
    ...base,
    key: 'h:' + h.id,
    icon: 'waves',
    title:
      h.kind === 'solo'
        ? tr('timeline.river.own', { name: fullName(h.heads[0]) })
        : tr('timeline.river.household', { names: h.heads.map(fullName).join(' & ') }),
    when: `${Math.floor(h.start)}–${to}`,
    lines
  }
}

function onStageLeave() {
  renderer?.setMouseY(null)
  hoverChron.value = null
  chronTip.value = null
  setHoverLink(null)
  if (hoverId.value) {
    hoverId.value = null
    renderer?.markStylesDirty()
  }
  hoverBadge.value = null
  renderer?.setHoverBadge(null)
}

function onStageClick(e) {
  if (suppressClick) {
    suppressClick = false
    return
  }
  if (!stageEl.value || !renderer) return
  const p = stagePoint(e)
  if (tool.value) {
    onToolClick(p)
    return
  }
  const ch = renderer.chronicleAt(p.x, p.y)
  if (ch) {
    chronTip.value = null
    if (ch.kind === 'era') store.openEraEditor({ id: ch.id })
    else store.openEventEditor({ id: ch.id })
    return
  }
  const badge = renderer?.badgeAt(p.x, p.y)
  if (badge) {
    openMarriageEdit(badge.m, e)
    return
  }
  mEdit.value = null
  const person = livePersonAt(p)
  if (!person && hoverLink.value && !e.ctrlKey && !e.metaKey) {
    // A branch selects its child; a stem selects the couple.
    const hl = hoverLink.value
    if (hl.heads) {
      // a household channel selects the people whose household it is
      store.selectPerson(hl.heads[0], { modal: false })
      if (hl.heads[1]) store.toggleSelectPerson(hl.heads[1])
      return
    }
    const fam = layout.value.families.find((f) => f.id === hl.famId)
    const branch = hl.branchIds.size === 1 ? [...hl.branchIds][0] : null
    const b = branch ? layout.value.branches.find((x) => x.id === branch) : null
    if (b && hl.key.startsWith('b:')) store.selectPerson(b.childId, { modal: false })
    else if (fam) {
      store.selectPerson(fam.parents[0], { modal: false })
      if (fam.parents[1]) store.toggleSelectPerson(fam.parents[1])
    }
    return
  }
  if (person) {
    // ctrl-click (or an armed trace) → trace; shift → multi-select; plain →
    // select (the action pane); double-click opens the profile.
    if (e.ctrlKey || e.metaKey || pathAnchor.value) handlePathClick(person.id)
    else if (e.shiftKey) store.toggleSelectPerson(person.id)
    else store.selectPerson(person.id, { modal: false })
    return
  }
  if (!e.shiftKey) {
    store.relPopup = null
    if (store.selectedPersonIds.length) store.selectPerson(null, { modal: false })
  }
}

// ── Smooth tween for zoom buttons / fit ─────────────────────────────────────
let tweenRaf = 0
function cancelTween() {
  if (tweenRaf) {
    cancelAnimationFrame(tweenRaf)
    tweenRaf = 0
  }
}

function tweenTo(targetPx, targetLs, targetTx, targetTy, ms = 320) {
  cancelTween()
  const c = clampVals(targetPx, targetLs, targetTx, targetTy)
  const s = { px: pxPerYear.value, ls: laneScale.value, tx: tx.value, ty: ty.value }
  const d = { px: targetPx, ls: targetLs, tx: c.x, ty: c.y }
  const t0 = performance.now()
  const ease = (t) => 1 - Math.pow(1 - t, 3)
  const step = (now) => {
    const t = Math.min(1, (now - t0) / ms)
    const k = ease(t)
    pxPerYear.value = s.px + (d.px - s.px) * k
    laneScale.value = s.ls + (d.ls - s.ls) * k
    tx.value = s.tx + (d.tx - s.tx) * k
    ty.value = s.ty + (d.ty - s.ty) * k
    syncCamera()
    tweenRaf = t < 1 ? requestAnimationFrame(step) : 0
  }
  tweenRaf = requestAnimationFrame(step)
}

function zoomBy(factor) {
  const cx = stageW.value / 2
  const cy = stageH.value / 2
  const oldPx = pxPerYear.value,
    oldLs = laneScale.value
  const newPx = Math.min(MAX_PX, Math.max(MIN_PX, oldPx * factor))
  const newLs = Math.min(MAX_LS, Math.max(MIN_LS, oldLs * factor))
  const newTy = anchorTy(cy, ty.value, newPx / oldPx)
  const newTx = cx - (cx - tx.value) * (newLs / oldLs)
  tweenTo(newPx, newLs, newTx, newTy)
}

function fitAll(animate = false) {
  if (!stageH.value) return
  const L = layout.value
  const px = Math.min(MAX_PX, Math.max(MIN_PX, (stageH.value - 160) / L.yearSpan))
  const ls = Math.min(1, Math.max(MIN_LS, (stageW.value - GUTTER - 100) / L.worldWBase))
  // The clamp no longer auto-centers, so center explicitly
  const txT = GUTTER + Math.max(20, (stageW.value - GUTTER - L.worldWBase * ls) / 2)
  const tyT = Math.max(40, (stageH.value - (L.yearSpan * px + Y_PAD * 2)) / 2)
  if (animate) {
    tweenTo(px, ls, txT, tyT)
  } else {
    pxPerYear.value = px
    laneScale.value = ls
    tx.value = txT
    ty.value = tyT
    clampPan()
    syncCamera()
  }
}

// ── Image export ────────────────────────────────────────────────────────────
// Capture the whole timeline, fit-all, at the requested pixel size (mirrors
// fitAll() but against the export dimensions instead of the stage).
function exportImage({ width, height, light = null }) {
  const L = layout.value
  if (!renderer || !L.people.length) return null
  const px = Math.min(MAX_PX, Math.max(MIN_PX, (height - 160) / L.yearSpan))
  const ls = Math.min(1, Math.max(MIN_LS, (width - GUTTER - 100) / L.worldWBase))
  const cam = {
    px,
    ls,
    tx: GUTTER + Math.max(20, (width - GUTTER - L.worldWBase * ls) / 2),
    ty: Math.max(40, (height - (L.yearSpan * px + Y_PAD * 2)) / 2)
  }
  return renderer.exportFrame({ width, height, camera2: cam, light })
}

defineExpose({ exportImage })

// ── Marriage year editing ───────────────────────────────────────────────────
function trunc(s, n) {
  s = s || tr('timeline.canvas.unnamed')
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function openMarriageEdit(m, e) {
  const p = stagePoint(e)
  mEdit.value = {
    relId: m.id,
    names: trunc(m.names, 34),
    year: m.realYear,
    status: m.status,
    px: Math.min(Math.max(8, p.sx - 110), stageW.value - 230),
    py: Math.min(Math.max(8, p.sy + 14), stageH.value - 140)
  }
  nextTick(() => meditInputRef.value?.focus())
}

async function saveMarriageEdit() {
  if (!mEdit.value) return
  const year = mEdit.value.year
  await store.updateRelationship({
    id: mEdit.value.relId,
    formed: year && year > 0 ? yearDate(year) : null,
    status: mEdit.value.status
  })
  mEdit.value = null
}

// ── Selection ───────────────────────────────────────────────────────────────
// The store's selection is shared with the graph: a click selects (the action
// pane rises), shift-click builds a set, ctrl-click traces.
const selectedSet = computed(() => {
  const ids = store.selectedPersonIds
  if (ids.length) return new Set(ids)
  return new Set(store.selectedPersonId ? [store.selectedPersonId] : [])
})

/** The person under a screen point, unless time travel hides them. */
function livePersonAt(p) {
  const person = renderer?.personAt(p.x, p.y)
  if (!person) return null
  if (person.birthYear > tt.gateYear.value || person.birthYear < tt.gateStartYear.value) return null
  return person
}
function shortName(id) {
  return (personById.value.get(id)?.name || tr('timeline.canvas.unnamed')).split(/\s+/)[0]
}
function cssVar(name, fallback = '#6c8ef5') {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

/** Glide the camera so a life's first years sit in the upper middle. */
function focusPerson(id) {
  const p = layout.value.people.find((x) => x.id === id)
  if (!p) return
  const px = pxPerYear.value,
    ls = laneScale.value
  const ntx = (stageW.value + GUTTER) / 2 - p.laneX * ls
  const nty = stageH.value * 0.32 - ((axisOf(p.birthYear) - layout.value.minYear) * px + Y_PAD)
  tweenTo(px, ls, ntx, nty, 520)
}

// ── Kinship lens (see the family through one person's eyes) ─────────────────
// Same lens as the graph: each relative's portrait rings in their kin colour
// and a pill names what they are to the viewpoint ("second cousin", 表姐,
// farmor…), revealed nearest-kin first with a ripple; outsiders recede.
const kinship = useKinship()
const kinOpen = ref(false)
const kinAnchor = ref(null)
const kinLensOn = ref(false)
const kinFilter = ref('all') // all | blood | marriage | ancestors | descendants
const kinWalkSet = ref(null)
const quizOpen = ref(false)
const KIN_REDUCED = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const KIN_STEP_MS = 115

const kinLensMap = computed(() =>
  kinLensOn.value && kinAnchor.value ? kinship.lensOf(kinAnchor.value) : null
)
const kinColors = computed(() => {
  void store.theme
  void store.accent
  return kinPalette()
})
function kinIncluded(k) {
  if (!k) return false
  if (k.kind === 'self') return true
  switch (kinFilter.value) {
    case 'blood':
      return k.kind === 'blood'
    case 'marriage':
      return ['spouse', 'inlaw', 'affine', 'coparent', 'step'].includes(k.kind)
    case 'ancestors':
      return k.kind === 'blood' && k.down === 0
    case 'descendants':
      return k.kind === 'blood' && k.up === 0
    default:
      return true
  }
}
function kinRank(k) {
  if (!k) return 12
  switch (k.kind) {
    case 'self':
      return 0
    case 'blood':
      return k.up + k.down
    case 'spouse':
      return 1
    case 'social':
      return 3
    case 'distant':
      return 6 + Math.min(4, k.hops || 0)
    default:
      return k.up + k.down + 1
  }
}
let kinRevealT0 = 0
let kinNow = 0
function kinRevealP(k) {
  if (!kinRevealT0) return 1
  const t = (kinNow - kinRevealT0 - Math.min(kinRank(k), 10) * KIN_STEP_MS) / 380
  return t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3)
}
function startKinReveal() {
  if (KIN_REDUCED) return
  kinRevealT0 = performance.now()
  kinNow = kinRevealT0
  const total = 10 * KIN_STEP_MS + 1500
  const loop = () => {
    kinNow = performance.now()
    renderer?.markUiDirty()
    if (kinNow - kinRevealT0 < total && kinLensMap.value) requestAnimationFrame(loop)
    else {
      kinRevealT0 = 0
      renderer?.markUiDirty()
    }
  }
  requestAnimationFrame(loop)
}
const kinLabels = computed(() => {
  const L = kinLensMap.value
  if (!L) return null
  void kinship.kinLang.value
  const out = new Map()
  for (const [id, k] of L) {
    if (k.kind === 'self' || k.kind === 'distant' || !kinIncluded(k)) continue
    out.set(id, {
      text: kinship.nameOf(k, kinAnchor.value, id),
      color: kinColors.value[kinClass(k)]
    })
  }
  return out
})
function kinOverlay() {
  const L = kinLensMap.value
  if (!L || pathActive.value) return null
  let wave = null
  if (kinRevealT0) {
    const e = kinNow - kinRevealT0
    if (e < 1500)
      wave = {
        id: kinAnchor.value,
        r: 18 + e * 0.5,
        alpha: 1 - e / 1500,
        color: kinColors.value.self
      }
  }
  return { labels: kinLabels.value, reveal: (id) => kinRevealP(L.get(id)), wave }
}
let kinPrevKey = ''
watch([kinLensMap, kinFilter], () => {
  const key = kinLensMap.value ? kinAnchor.value + ':' + kinFilter.value : ''
  if (key && key !== kinPrevKey) startKinReveal()
  kinPrevKey = key
  renderer?.markStylesDirty()
})
watch([() => kinship.kinLang.value, kinWalkSet, kinColors], () => renderer?.markStylesDirty())
watch(kinOpen, (open) => {
  if (open && !kinAnchor.value) kinAnchor.value = store.selectedPersonId
  if (!open) {
    kinLensOn.value = false
    kinWalkSet.value = null
  }
})
watch(
  () => store.persons.length,
  () => {
    if (kinAnchor.value && !personById.value.has(kinAnchor.value)) {
      kinAnchor.value = null
      kinLensOn.value = false
    }
  }
)
/** Action pane's 🧬 Kin: look through this person's eyes. */
function openKinLens(id) {
  kinAnchor.value = id
  kinOpen.value = true
  kinLensOn.value = true
}
/** Select + glide to a person named in a kinship surface. */
function kinFocus(id) {
  if (!id) return
  store.selectPerson(id, { modal: false })
  focusPerson(id)
}

// ── Connection trace ────────────────────────────────────────────────────────
// ctrl-click two lives (or the pane's Trace) → the shortest chain lights up:
// glowing bonds flow hop by hop between the lifelines at the years that made
// them, everyone else recedes, and the trace card names the relation.
const pathAnchor = ref(null)
const pathInfo = ref(null)
const pathActive = computed(() => !!pathInfo.value && !pathInfo.value.none)
const pathIdSet = computed(() => new Set(pathActive.value ? pathInfo.value.ids : []))
function handlePathClick(id) {
  store.relPopup = null
  if (!pathAnchor.value || pathInfo.value) {
    pathInfo.value = null
    pathAnchor.value = id
  } else if (pathAnchor.value === id) {
    pathAnchor.value = null
  } else {
    tracePair([pathAnchor.value, id])
  }
}
function traceFrom(id) {
  pathInfo.value = null
  pathAnchor.value = id
}
function tracePair([a, b]) {
  pathAnchor.value = null
  pathInfo.value = shortestPath(a, b, store.relationships) || { none: true, fromId: a, toId: b }
}
function clearPath() {
  pathInfo.value = null
  pathAnchor.value = null
}
function syncTrace() {
  if (!fx) return
  if (!pathActive.value) {
    fx.setTrace(null)
    return
  }
  const people = new Map(layout.value.people.map((p) => [p.id, p]))
  const segs = traceSegments(pathInfo.value, people, (t) => store.relTypeRoles.get(t))
  fx.setTrace(segs, cssVar('--accent'))
}
watch(pathInfo, () => {
  syncTrace()
  renderer?.markStylesDirty()
})
watch(
  () => store.relationships.length + ':' + store.persons.length,
  () => {
    if (pathInfo.value || pathAnchor.value) clearPath()
    if (linkAnchor.value && !personById.value.has(linkAnchor.value.id)) linkAnchor.value = null
  }
)

// ── Edit tools (the "Edit" rail + keys 1–6) ─────────────────────────────────
const tool = ref(null)
const toolDef = computed(() => timelineTool(tool.value))
// The Edit rail's catalog with labels / hints in the UI language.
const toolModes = computed(() =>
  TIMELINE_TOOLS.map((m) => ({ ...m, label: tr(m.labelKey), hint: tr(m.hintKey) }))
)
const nameBubble = ref(null) // { mode, x, y, year, title, value, color, … }
const bubbleInputEl = ref(null)
const linkAnchor = ref(null) // { id, year } — link tool's first life
const linkPick = ref(null) // { a, ay, b, year, x, y } — choosing the bond
const retimeHover = ref(false)
const handleDragging = ref(false)
let fx = null

function pickTool(m) {
  setTool(tool.value === m.id ? null : m.id)
}
function setTool(id) {
  tool.value = id
  nameBubble.value = null
  linkAnchor.value = null
  linkPick.value = null
  retimeHover.value = false
  fx?.setGhost(null)
  if (id) {
    chronTip.value = null
    mEdit.value = null
  }
}
const hudHint = computed(() => {
  const t = toolDef.value
  if (!t) return ''
  if (t.id === 'link' && linkPick.value) return tr('timeline.hud.linkPick')
  if (t.id === 'link' && linkAnchor.value)
    return tr('timeline.hud.linkNext', { name: shortName(linkAnchor.value.id) })
  return tr(t.hintKey)
})
const yearY = (y) => (renderer ? renderer.sy(y) : 0)

// Ghost previews under the cursor for the live tool (drawn on the FX layer).
function toolGhost(p) {
  if (!fx || !renderer) return
  const t = toolDef.value
  if (!t || drag || nameBubble.value || linkPick.value) return
  if (p.x < GUTTER) {
    fx.setGhost(null)
    retimeHover.value = false
    return
  }
  const c = t.color
  const year = Math.round(yearAtY(p.y))
  const person = livePersonAt(p)
  const g = []
  switch (t.id) {
    case 'add':
      g.push({
        kind: 'yearline',
        y: yearY(year),
        icon: 'user-plus',
        label: tr('timeline.ghost.born', { year }),
        color: c,
        x0: GUTTER
      })
      g.push({ kind: 'ring', x: p.x, y: yearY(year), r: 15, color: c })
      break
    case 'child': {
      if (person) {
        const s = renderer.personScreen(person.id)
        const y = Math.max(year, Math.ceil(person.birthYear))
        g.push({
          kind: 'yearline',
          y: yearY(y),
          icon: 'baby',
          label: tr('timeline.ghost.born', { year: y }),
          color: c,
          x0: GUTTER
        })
        if (s) g.push({ kind: 'ring', x: s.x, y: yearY(y), r: 11, color: c })
      }
      break
    }
    case 'link': {
      if (linkAnchor.value) {
        const a = renderer.personScreen(linkAnchor.value.id)
        const b = person ? renderer.personScreen(person.id) : null
        if (a) {
          g.push({
            kind: 'line',
            x1: a.x,
            y1: yearY(linkAnchor.value.year),
            x2: b ? b.x : p.x,
            y2: p.y,
            color: c
          })
        }
      }
      if (person) {
        const s = renderer.personScreen(person.id)
        if (s) g.push({ kind: 'ring', x: s.x, y: p.y, r: 10, color: c })
        g.push({ kind: 'yearline', y: yearY(year), label: String(year), color: c, x0: GUTTER })
      }
      break
    }
    case 'event':
      g.push({
        kind: 'yearline',
        y: yearY(year),
        icon: 'calendar-plus',
        label: String(year),
        color: c,
        x0: GUTTER
      })
      break
    case 'retime': {
      const h = retimeTarget(p)
      retimeHover.value = !!h
      if (h) {
        g.push({ kind: 'handle', x: h.x, y: h.y, color: c })
        g.push({ kind: 'bubble', x: h.x, y: h.y - 16, text: h.label, icon: h.icon, color: c })
      }
      break
    }
    case 'delete': {
      const d = deleteTarget(p)
      if (d) g.push(d.ghost)
      break
    }
  }
  fx.setGhost(g)
}

function onToolClick(p) {
  if (nameBubble.value) {
    commitBubble(!!nameBubble.value.value.trim())
    return
  }
  if (linkPick.value) {
    linkPick.value = null
    return
  }
  if (p.x < GUTTER) return
  const t = toolDef.value
  const year = Math.round(yearAtY(p.y))
  const person = livePersonAt(p)
  switch (t?.id) {
    case 'add':
      openBubble({
        mode: 'add',
        x: p.x,
        y: yearY(year),
        year,
        worldX: (p.x - tx.value) / laneScale.value,
        icon: 'user-plus',
        title: tr('timeline.bubble.newLife', { year }),
        color: t.color,
        coParents: []
      })
      break
    case 'child': {
      if (!person) {
        fx?.ripple(p.x, p.y, cssVar('--danger', '#ef5350'))
        return
      }
      const y = Math.max(year, Math.ceil(person.birthYear))
      const s = renderer.personScreen(person.id)
      const coParents = partnersOf(person.id, y)
      openBubble({
        mode: 'child',
        parentId: person.id,
        x: s ? s.x : p.x,
        y: yearY(y),
        year: y,
        icon: 'baby',
        title: tr('timeline.bubble.childOf', { name: shortName(person.id), year: y }),
        color: t.color,
        coParents,
        coParentId: coParents.find((c) => c.likely)?.id || null
      })
      break
    }
    case 'link':
      if (!person) {
        linkAnchor.value = null
        return
      }
      if (!linkAnchor.value) {
        linkAnchor.value = { id: person.id, year }
        fx?.ripple(renderer.personScreen(person.id)?.x ?? p.x, yearY(year), t.color)
      } else if (linkAnchor.value.id === person.id) {
        linkAnchor.value = null
      } else {
        linkPick.value = {
          a: linkAnchor.value.id,
          ay: linkAnchor.value.year,
          b: person.id,
          year,
          x: Math.min(Math.max(160, p.sx ?? p.x), stageW.value - 170),
          // Open upward in the lower half so it never covers the tool HUD.
          y: (p.sy ?? p.y) > stageH.value * 0.5 ? (p.sy ?? p.y) - 18 : (p.sy ?? p.y) + 18,
          up: (p.sy ?? p.y) > stageH.value * 0.5
        }
        fx?.setGhost(null)
      }
      break
    case 'delete': {
      const d = deleteTarget(p)
      if (d) d.run()
      break
    }
  }
}

// ── Add / Child: the christening bubble ─────────────────────────────────────
function openBubble(b) {
  // b.x / b.y are flat (the ghost's); sx / sy place the DOM bubble on screen
  const at = screenOf(b.x, b.y)
  nameBubble.value = { value: '', ...b, sx: at.x, sy: at.y }
  fx?.setGhost([
    { kind: 'yearline', y: b.y, label: String(b.year), color: b.color, x0: GUTTER },
    { kind: 'ring', x: b.x, y: b.y, r: 15, color: b.color }
  ])
  nextTick(() => bubbleInputEl.value?.focus())
}
/** Spouses/partners of a parent, the one married at that year flagged likely. */
function partnersOf(id, year) {
  const out = []
  for (const r of store.relationships) {
    if (store.relTypeRoles.get(r.type) !== 'horizontal') continue
    const other = r.person_a_id === id ? r.person_b_id : r.person_b_id === id ? r.person_a_id : null
    if (!other || out.some((o) => o.id === other)) continue
    const p = personById.value.get(other)
    if (!p) continue
    const from = toOrdinal(r.formed)
    const ended = toOrdinal(r.ended)
    const likely =
      r.status !== 'divorced' && (from == null || from <= year) && (ended == null || ended >= year)
    out.push({
      id: other,
      name: (p.name || tr('timeline.canvas.unnamed')).split(/\s+/)[0],
      color: genderColor(p.gender),
      likely
    })
  }
  return out.sort((a, b) => b.likely - a.likely).slice(0, 4)
}
function toggleCoParent(id) {
  const b = nameBubble.value
  if (b) b.coParentId = b.coParentId === id ? null : id
}
/** Where a life placed at world x joins the lane order. Sprout lanes are
 *  shared, so there it simply follows whoever's lane it landed in. */
function laneHintAt(worldX) {
  if (timelineMode.value === 'lanes') return { worldX }
  let best = null
  for (const q of layout.value.people)
    if (!best || Math.abs(q.laneX - worldX) < Math.abs(best.laneX - worldX)) best = q
  return best ? { afterId: best.id } : { worldX }
}
async function commitBubble(ok) {
  const b = nameBubble.value
  nameBubble.value = null
  fx?.setGhost(null)
  if (!ok || !b) return
  pendingLane = {
    before: new Set(store.persons.map((p) => p.id)),
    opts: b.mode === 'child' ? { afterId: b.parentId } : laneHintAt(b.worldX)
  }
  const res = await store.createPerson({ name: b.value.trim(), birth: yearDate(b.year) })
  pendingLane = null
  if (!res?.success) return
  const id = res.data.id
  fx?.birth(id, b.color)
  if (b.mode === 'child') {
    for (const pid of [b.parentId, b.coParentId].filter(Boolean)) {
      const r = await store.createRelationship({
        person_a_id: pid,
        person_b_id: id,
        type: 'parent_child'
      })
      if (r?.success) fx?.spark({ id: pid, year: b.year }, { id }, b.color)
    }
  }
  store.selectPerson(id, { modal: false })
}

// ── Link: choose the bond ───────────────────────────────────────────────────
const linkTypes = computed(() =>
  store.caps.relTypePicker ? store.relTypes : store.relTypes.filter((d) => d.band === 'family')
)
function relColor(d) {
  const gs = store.graphSettings
  if (d.color) return d.color
  if (d.key === 'spouse') return gs.spouseColor
  if (d.key === 'parent_child') return gs.parentChildColor
  if (d.key === 'adopted') return gs.adoptedColor || gs.parentChildColor
  return cssVar('--accent')
}
function swapLink() {
  const L = linkPick.value
  if (L) linkPick.value = { ...L, a: L.b, b: L.a, ay: L.year, year: L.ay }
}
async function commitLink(d) {
  const L = linkPick.value
  linkPick.value = null
  linkAnchor.value = null
  if (!L) return
  const data = { person_a_id: L.a, person_b_id: L.b, type: d.key }
  if (d.symmetryRole === 'horizontal') data.formed = yearDate(L.year)
  const res = await store.createRelationship(data)
  if (!res?.success) {
    toast(res?.error || tr('timeline.link.failed'), { tone: 'warning' })
    return
  }
  fx?.spark({ id: L.a, year: L.ay }, { id: L.b, year: L.year }, relColor(d))
  undoToast(`${shortName(L.a)} & ${shortName(L.b)} — ${relTypeLabel(d)}`, 'relationships:create')
}

// ── Delete: lives, marriages, events ────────────────────────────────────────
function deleteTarget(p) {
  const danger = cssVar('--danger', '#ef5350')
  const badge = renderer.badgeAt(p.x, p.y)
  if (badge) {
    return {
      ghost: { kind: 'glowRect', x: badge.x, y: badge.y, w: badge.w, h: badge.h, color: danger },
      run: () => deleteMarriage(badge.m, badge)
    }
  }
  const ch = renderer.chronicleAt(p.x, p.y)
  if (ch?.kind === 'event') {
    return {
      ghost: { kind: 'glowRect', x: ch.x, y: ch.y, w: ch.w, h: ch.h, color: danger },
      run: () => deleteEventItem(ch.id, ch)
    }
  }
  const person = livePersonAt(p)
  if (person) {
    const s = renderer.personScreen(person.id)
    if (!s) return null
    return {
      ghost: { kind: 'glowLife', x: s.x, y0: s.y0, y1: s.y1, color: danger },
      run: () => deleteLife(person.id)
    }
  }
  return null
}
async function deleteLife(id) {
  const rec = personById.value.get(id)
  const name = rec?.name || tr('timeline.canvas.unnamed')
  const ok = await confirmDialog({
    title: tr('confirm.deletePerson', { name }),
    message: tr('confirm.deletePersonBody') + ' ' + tr('dialog.undoHint'),
    tone: 'danger'
  })
  if (!ok) return
  const s = renderer?.personScreen(id)
  const res = await store.deletePerson(id)
  if (!res?.success) return
  fx?.setGhost(null)
  if (s) fx?.dissolve(s.x, s.y0, s.y1, genderColor(rec?.gender))
  undoToast(tr('toasts.deletedPerson', { name }), 'persons:delete')
}
async function deleteMarriage(m, rect) {
  const ok = await confirmDialog({
    title: tr('timeline.confirm.deleteMarriage', { names: m.names }),
    message: tr('timeline.confirm.deleteMarriageBody') + ' ' + tr('dialog.undoHint'),
    tone: 'danger'
  })
  if (!ok) return
  const res = await store.deleteRelationship(m.id)
  if (!res?.success) return
  fx?.setGhost(null)
  fx?.ripple(rect.x + rect.w / 2, rect.y + rect.h / 2, cssVar('--danger', '#ef5350'))
  undoToast(tr('timeline.toasts.marriageRemoved'), 'relationships:delete')
}
async function deleteEventItem(id, rect) {
  const ev = store.events.find((e) => e.id === id)
  if (!ev) return
  const ok = await confirmDialog({
    title: tr('timeline.confirm.deleteEvent', { name: defaultNameLabel(ev.title) }),
    message: tr('dialog.undoHint'),
    tone: 'danger'
  })
  if (!ok) return
  const res = await store.deleteEvent(id)
  if (!res?.success) return
  fx?.setGhost(null)
  fx?.ripple(rect.x + 10, rect.y + rect.h / 2, cssVar('--danger', '#ef5350'))
  undoToast(tr('chronicle.deleted', { name: defaultNameLabel(ev.title) }), 'events:delete')
}

// ── Retime: drag births, deaths, whole lives, marriages and events ──────────
function retimeTarget(p) {
  const badge = renderer.badgeAt(p.x, p.y)
  if (badge) {
    const m = badge.m
    return {
      kind: 'marriage',
      m,
      x: badge.x + badge.w / 2,
      y: badge.y + badge.h / 2,
      year: m.year,
      icon: 'heart-handshake',
      label: m.realYear ? String(m.realYear) : tr('timeline.ghost.dragToDate')
    }
  }
  const ch = renderer.chronicleAt(p.x, p.y)
  if (ch?.kind === 'event') {
    const ev = store.events.find((e) => e.id === ch.id)
    const y0 = toOrdinal(ev?.date)
    if (ev && y0 != null) {
      return {
        kind: 'event',
        ev,
        x: ch.x + ch.h / 2,
        y: ch.y + ch.h / 2,
        year: y0,
        icon: 'calendar',
        label: fmtDate(ev.date)
      }
    }
  }
  const person = livePersonAt(p)
  if (!person) return null
  const s = renderer.personScreen(person.id)
  if (!s) return null
  if (Math.abs(p.y - s.y0) <= 16)
    return {
      kind: 'birth',
      person,
      x: s.x,
      y: s.y0,
      year: person.birthYear,
      label: tr('timeline.ghost.born', { year: Math.floor(person.birthYear) })
    }
  if (Math.abs(p.y - s.y1) <= 12)
    return {
      kind: 'death',
      person,
      x: s.x1 ?? s.x,
      y: s.y1,
      year: person.endYear,
      label: person.dead
        ? tr('timeline.ghost.died', { year: Math.floor(person.endYear) })
        : tr('timeline.ghost.dragToEnd')
    }
  return {
    kind: 'life',
    person,
    x: s.x,
    y: p.y,
    year: yearAtY(p.y),
    icon: 'move-vertical',
    label: tr('timeline.ghost.shiftLife')
  }
}

let drag = null // { kind: 'retime' | 'span', start, last, moved, h? }
function startDrag(kind, p, data, e) {
  e?.preventDefault() // no text selection while dragging a handle / span
  drag = { kind, start: p, last: p, moved: false, ...data }
  handleDragging.value = kind === 'retime'
  cancelTween()
  chronTip.value = null
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragUp)
  if (kind === 'span') spanGhost()
  else if (kind === 'retime') retimeGhost()
}
function onDragMove(e) {
  if (!drag || !stageEl.value) return
  const p = stagePoint(e)
  drag.last = p
  if (!drag.moved && Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > 4) {
    drag.moved = true
    // Time drag: a mostly-vertical pull on a life shifts it (and the selection
    // it belongs to) in time; a sideways one still moves its lane.
    if (
      drag.kind === 'lane' &&
      store.timeDrag &&
      Math.abs(p.y - drag.start.y) > Math.abs(p.x - drag.start.x)
    ) {
      drag.kind = 'shift'
      handleDragging.value = true
      hoverId.value = null
    }
  }
  if (drag.kind === 'span') spanGhost()
  else if (drag.kind === 'lane') laneDragMove()
  else if (drag.kind === 'shift') shiftGhost()
  else retimeGhost()
}
function onDragUp() {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragUp)
  const d = drag
  drag = null
  handleDragging.value = false
  stopAutoPan()
  // The click that follows this pointerup belongs to the drag (a lane grab
  // that never moved is a plain click — it still selects).
  if (d && (d.kind !== 'lane' || d.moved)) {
    suppressClick = true
    setTimeout(() => (suppressClick = false), 0)
  }
  if (!d) return
  if (d.kind === 'span') finishSpan(d)
  else if (d.kind === 'lane') finishLaneDrag(d)
  else if (d.kind === 'shift') finishShift(d)
  else finishRetime(d)
}
function cancelDrag() {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragUp)
  const d = drag
  drag = null
  handleDragging.value = false
  stopAutoPan()
  fx?.setGhost(null)
  if (d?.kind === 'lane') {
    laneOrder.value = d.orig // Esc: everyone glides back
    renderer?.setLaneOverride(null)
    liftedSet.value = null
  }
}

// ── Lane drag: pick a life up and carry it to another lane ──────────────────
// The life (or the whole selection, if it's part of one) follows the cursor in
// a light column; the other lanes slide apart live to open its landing slot;
// dropping commits one undoable arrangement step, saved with the scene.
const liftedSet = ref(null) // ids being carried (Set) | null
let autoPanRaf = 0
function startLaneDrag(person, p, e) {
  const display = layout.value.people.map((x) => x.id)
  const sel = selectedSet.value
  const group =
    sel.has(person.id) && sel.size > 1 ? display.filter((id) => sel.has(id)) : [person.id]
  const s = renderer.personScreen(person.id)
  startDrag(
    'lane',
    p,
    {
      id: person.id,
      group,
      display,
      orig: fullLaneOrder(),
      grab: s ? p.x - s.x : 0,
      idx: group.indexOf(person.id),
      slot: laneSlotOf(display, group)
    },
    e
  )
}
function laneDragMove() {
  const d = drag
  if (!d || !d.moved || !renderer || timelineMode.value !== 'lanes') return
  if (!liftedSet.value) {
    liftedSet.value = new Set(d.group)
    handleDragging.value = true
    hoverId.value = null
  }
  // World x of the grabbed lane under the cursor.
  const wx = (d.last.x - d.grab - tx.value) / laneScale.value
  renderer.setLaneOverride(new Map(d.group.map((id, j) => [id, wx + (j - d.idx) * LANE_W])))
  const others = d.display.length - d.group.length
  const slot = laneSlotAt(wx, others, d.idx)
  if (slot !== d.slot) {
    d.slot = slot
    laneOrder.value = moveLanes(d.orig, d.display, d.group, slot)
  }
  laneGhost(d, wx, slot)
  // Near an edge: keep scrolling the lanes under the carried life.
  const edge = d.last.x < GUTTER + 50 ? -1 : d.last.x > stageW.value - 50 ? 1 : 0
  if (edge && !autoPanRaf) autoPanRaf = requestAnimationFrame(autoPanTick)
}
function autoPanTick() {
  autoPanRaf = 0
  const d = drag
  if (!d || d.kind !== 'lane' || !d.moved) return
  const edge = d.last.x < GUTTER + 50 ? -1 : d.last.x > stageW.value - 50 ? 1 : 0
  if (!edge) return
  tx.value -= edge * 9
  clampPan()
  syncCamera()
  laneDragMove()
  autoPanRaf = requestAnimationFrame(autoPanTick)
}
function stopAutoPan() {
  if (autoPanRaf) cancelAnimationFrame(autoPanRaf)
  autoPanRaf = 0
}
function laneGhost(d, wx, slot) {
  if (!fx) return
  const c = cssVar('--accent')
  const others = d.display.filter((id) => !d.group.includes(id))
  const left = others[slot - 1],
    right = others[slot]
  const where =
    left && right
      ? tr('timeline.ghost.between', { a: shortName(left), b: shortName(right) })
      : left
        ? tr('timeline.ghost.after', { name: shortName(left) })
        : right
          ? tr('timeline.ghost.before', { name: shortName(right) })
          : tr('timeline.ghost.firstLane')
  const n = d.group.length
  const label = `↔ ${n > 1 ? tr('timeline.ghost.lives', { n, where }) : where}`
  const sx = wx * laneScale.value + tx.value
  const top = renderer.personScreen(d.id)?.y0 ?? d.last.y
  // The landing slot: midway between the lanes the block will sit between.
  const slotX = (X0 + (slot - 0.5) * LANE_W) * laneScale.value + tx.value
  const g = [{ kind: 'column', x: sx, y: Math.max(40, top - 26), color: c, label }]
  if (left || right) g.push({ kind: 'slot', x: slotX, y0: 30, y1: stageH.value - 30, color: c })
  fx.setGhost(g)
}
function finishLaneDrag(d) {
  fx?.setGhost(null)
  liftedSet.value = null
  if (!renderer) return
  // Let go: the carried lanes glide from the drop point into their slot.
  renderer.setLaneOverride(null)
  if (!d.moved) return
  const next = laneOrder.value
  if (commitLanes(next, { prev: d.orig })) {
    const s = renderer.personScreen(d.id)
    if (s) fx?.ripple(d.last.x - d.grab, s.y0, cssVar('--accent'))
  }
}
/** Shift+←/→: nudge the selected lives one lane over. */
function nudgeLanes(dir) {
  if (timelineMode.value !== 'lanes') return false
  const display = layout.value.people.map((x) => x.id)
  const group = display.filter((id) => selectedSet.value.has(id))
  if (!group.length) return false
  const others = display.length - group.length
  const slot = laneSlotOf(display, group)
  const next = Math.max(0, Math.min(others, slot + dir))
  if (next === slot) return true
  commitLanes(moveLanes(fullLaneOrder(), display, group, next))
  return true
}

// ── Time drag: pull lives up/down to retime them ────────────────────────────
// With the header's Time drag toggle on, a vertical drag on a life (or the
// selection it's part of) shifts birth + death by whole years; dropping writes
// every life as ONE batch, so a single Ctrl+Z puts them all back.
// Whole years between where a drag started and where it is — read off the
// axis, so it stays exact when time is warped (years aren't evenly spaced).
const yearsDragged = (d) => Math.round(yearAtY(d.last.y) - yearAtY(d.start.y))
const shiftDelta = yearsDragged
// A flat y riding a year, moved `delta` years along the (possibly warped) axis.
const shiftedY = (y, year, delta) => y + yearY(year + delta) - yearY(year)
const signed = (n) => (n > 0 ? `+${n}` : String(n))
function shiftGhost() {
  const d = drag
  if (!d || !fx || !renderer) return
  const c = cssVar('--accent')
  const delta = shiftDelta(d)
  const g = []
  for (const id of d.group) {
    const s = renderer.personScreen(id)
    if (s)
      g.push({
        kind: 'life',
        x: s.x,
        y0: shiftedY(s.y0, s.p.birthYear, delta),
        y1: shiftedY(s.y1, s.p.endYear, delta),
        color: c
      })
  }
  const s = renderer.personScreen(d.id)
  if (!s) return fx.setGhost(g)
  let label
  if (d.group.length > 1) {
    label = tr('graph.timeDrag.badgeMany', { n: d.group.length, delta: signed(delta) })
  } else {
    const b = personById.value.get(d.id)
    const end = b?.death?.year != null ? b.death.year + delta : tr('timeline.tip.now')
    label = `${(b?.birth?.year ?? Math.floor(s.p?.birthYear ?? 0)) + delta}–${end} (${signed(delta)})`
  }
  const hy = shiftedY(s.y0, s.p.birthYear, delta)
  g.push({ kind: 'yearline', y: hy, label, color: c, x0: GUTTER })
  g.push({ kind: 'handle', x: s.x, y: hy, color: c, active: true })
  fx.setGhost(g)
}
async function finishShift(d) {
  fx?.setGhost(null)
  const delta = shiftDelta(d)
  if (!delta) return
  const placed = new Map(layout.value.people.map((x) => [x.id, x]))
  const valueOf = (id, fid) => store.fieldValuesOf.get(id)?.get(fid)?.value
  const { updates, unsupported } = shiftLivesUpdates(
    store.fieldDefs,
    valueOf,
    d.group,
    delta,
    (id) => {
      const y = placed.get(id)?.birthYear
      return Number.isFinite(y) ? Math.floor(y) : null
    }
  )
  if (unsupported) toast(tr('timeline.toasts.calendarUnsupported'), { tone: 'warning' })
  if (!updates.length) return
  const res = await store.setFieldValuesBatch(updates)
  if (!res?.success) return
  fx?.ripple(d.last.x, d.last.y, cssVar('--accent'))
  const n = Math.abs(delta)
  const later = delta > 0
  const msg =
    d.group.length > 1
      ? tr(later ? 'graph.timeDrag.movedManyLater' : 'graph.timeDrag.movedManyEarlier', {
          count: d.group.length,
          n
        })
      : tr(later ? 'timeline.toasts.movedLater' : 'timeline.toasts.movedEarlier', {
          name: shortName(d.id),
          n
        })
  undoToast(msg, 'fields:setValuesBatch')
}

/** Years the drag has moved (rounded) and the retimed values it implies. */
function retimeResult(d) {
  const h = d.h
  const delta = yearsDragged(d)
  const rec = h.person ? personById.value.get(h.person.id) : null
  const b0 = rec?.birth?.year ?? null
  const d0 = rec?.death?.year ?? null
  switch (h.kind) {
    case 'birth': {
      const end = d0 ?? refYear.value
      const year = clampRetime('birth', (b0 ?? Math.round(h.year)) + delta, { end })
      return { year, changes: { birth: year }, changed: year !== b0 }
    }
    case 'death': {
      const base = d0 ?? refYear.value
      const year = clampRetime('death', base + delta, { birth: b0 })
      const living = d0 == null && year >= refYear.value
      return { year, living, changes: { death: year }, changed: !living && year !== d0 }
    }
    case 'life':
      return {
        delta,
        changes: { birth: b0 + delta, death: d0 == null ? undefined : d0 + delta },
        changed: delta !== 0 && b0 != null
      }
    case 'marriage': {
      const year = Math.round(h.year) + delta
      return { year, changed: year !== h.m.realYear }
    }
    case 'event':
      return { delta, year: Math.floor(h.year) + delta, changed: delta !== 0 }
  }
  return { changed: false }
}
function retimeGhost() {
  const d = drag
  if (!d || !fx) return
  const h = d.h
  const c = toolDef.value?.color || cssVar('--accent')
  const r = retimeResult(d)
  const sign = (n) => (n > 0 ? `+${n}` : String(n))
  const g = []
  if (h.person) {
    const s = renderer.personScreen(h.person.id)
    if (!s) return
    const dl = r.delta ?? 0
    let y0 = s.y0,
      y1 = s.y1,
      hy = d.last.y,
      text = ''
    if (h.kind === 'birth') {
      y0 = yearY(r.year)
      hy = y0
      text = tr('timeline.ghost.born', { year: r.year })
    } else if (h.kind === 'death') {
      y1 = r.living ? yearY(refYear.value) : yearY(r.year)
      hy = y1
      text = r.living
        ? tr('timeline.ghost.stillLiving')
        : tr('timeline.ghost.died', { year: r.year })
    } else {
      y0 = shiftedY(y0, s.p.birthYear, dl)
      y1 = shiftedY(y1, s.p.endYear, dl)
      const b = personById.value.get(h.person.id)
      text = `${(b?.birth?.year ?? 0) + r.delta}–${b?.death?.year != null ? b.death.year + r.delta : tr('timeline.tip.now')} (${sign(r.delta)})`
    }
    g.push({ kind: 'life', x: s.x, y0, y1, color: c })
    g.push({ kind: 'yearline', y: hy, label: text, color: c, x0: GUTTER })
    g.push({ kind: 'handle', x: s.x, y: hy, color: c, active: true })
  } else if (h.kind === 'marriage') {
    const y = yearY(r.year)
    g.push({
      kind: 'yearline',
      y,
      icon: 'heart-handshake',
      label: String(r.year),
      color: c,
      x0: GUTTER
    })
    g.push({ kind: 'handle', x: h.x, y, color: c, active: true })
  } else if (h.kind === 'event') {
    const y = yearY(r.year)
    const end = toOrdinal(h.ev.end)
    if (end != null) {
      g.push({
        kind: 'span',
        x: h.x - 14,
        y0: y,
        y1: yearY(Math.floor(end) + r.delta),
        color: c,
        a: String(r.year),
        b: String(Math.floor(end) + r.delta),
        x0: GUTTER
      })
    } else
      g.push({
        kind: 'yearline',
        y,
        icon: 'calendar',
        label: String(r.year),
        color: c,
        x0: GUTTER
      })
    g.push({ kind: 'handle', x: h.x, y, color: c, active: true })
  }
  fx.setGhost(g)
}
async function finishRetime(d) {
  fx?.setGhost(null)
  if (!d.moved) return
  const r = retimeResult(d)
  if (!r.changed) return
  const h = d.h
  const c = toolDef.value?.color || cssVar('--accent')
  let res = null,
    channel = '',
    msg = ''
  if (h.person) {
    res = await retimePerson(h.person.id, r.changes)
    channel = 'fields:setValues'
    const name = shortName(h.person.id)
    msg =
      h.kind === 'birth'
        ? tr('timeline.toasts.bornIn', { name, year: r.year })
        : h.kind === 'death'
          ? tr('timeline.toasts.diesIn', { name, year: r.year })
          : tr(r.delta > 0 ? 'timeline.toasts.movedLater' : 'timeline.toasts.movedEarlier', {
              name,
              n: Math.abs(r.delta)
            })
  } else if (h.kind === 'marriage') {
    const rel = store.relationships.find((x) => x.id === h.m.id)
    const formed = rel?.formed ? { ...rel.formed, year: r.year } : yearDate(r.year)
    res = await store.updateRelationship({ id: h.m.id, formed })
    channel = 'relationships:update'
    msg = tr('timeline.toasts.marriedIn', { year: r.year })
  } else if (h.kind === 'event') {
    const shift = (v) => (v ? { ...v, year: v.year + r.delta } : null)
    res = await store.saveEvent({ id: h.ev.id, date: shift(h.ev.date), end: shift(h.ev.end) })
    channel = 'events:save'
    msg = tr('timeline.toasts.eventMoved', { name: defaultNameLabel(h.ev.title), year: r.year })
  }
  if (!res?.success) return
  fx?.ripple(d.last.x, d.last.y, c)
  undoToast(msg, channel)
}
/** Write birth/death years through whichever traits fill those slots. */
async function retimePerson(id, changes) {
  const values = []
  for (const [slot, year] of Object.entries(changes)) {
    if (year === undefined || year === null) continue
    const def = store.fieldDefs.find((x) => x.slot === slot)
    if (!def) continue
    const cur = store.fieldValuesOf.get(id)?.get(def.id)?.value ?? null
    const value = retimeSlotValue(def, cur, year)
    if (value === undefined) {
      toast(tr('timeline.toasts.calendarUnsupported'), { tone: 'warning' })
      return null
    }
    values.push({ field_id: def.id, value })
  }
  if (!values.length) return null
  return store.setFieldValues(id, JSON.parse(JSON.stringify(values)))
}

// ── Event: click = a moment, drag = a span ──────────────────────────────────
function spanGhost() {
  const d = drag
  if (!d || !fx) return
  const c = toolDef.value?.color || cssVar('--accent')
  const sp = spanFromDrag(yearAtY(d.start.y), yearAtY(d.last.y))
  if (!d.moved || sp.end == null) {
    fx.setGhost([
      {
        kind: 'yearline',
        y: yearY(sp.start),
        icon: 'calendar-plus',
        label: String(sp.start),
        color: c,
        x0: GUTTER
      }
    ])
  } else {
    fx.setGhost([
      {
        kind: 'span',
        x: d.start.x,
        y0: yearY(sp.start),
        y1: yearY(sp.end),
        color: c,
        aIcon: 'calendar-plus',
        a: String(sp.start),
        b: String(sp.end),
        x0: GUTTER
      }
    ])
  }
}
function finishSpan(d) {
  fx?.setGhost(null)
  const sp = d.moved
    ? spanFromDrag(yearAtY(d.start.y), yearAtY(d.last.y))
    : spanFromDrag(yearAtY(d.start.y), yearAtY(d.start.y))
  const person = livePersonAt(d.start)
  fx?.ripple(d.start.x, yearY(sp.start), toolDef.value?.color || cssVar('--accent'))
  store.openEventEditor({
    date: yearDate(sp.start),
    end: sp.end != null ? yearDate(sp.end) : null,
    person_ids: person ? [person.id] : []
  })
}

// ── Keys: Esc peels one layer at a time; 1–6 pick tools ─────────────────────
// Capture phase, so a consumed Esc never also reaches the global handlers.
function onToolKeydown(e) {
  if (!props.active || store.activeView !== 'timeline') return
  if (store.modalOpen || store.formOpen || store.chronicleEditor) return
  if (document.querySelector('.dh-backdrop')) return // a confirm dialog owns the keys
  if (e.key === 'Escape') {
    let consumed = true
    if (quizOpen.value) quizOpen.value = false
    else if (mEdit.value) mEdit.value = null
    else if (nameBubble.value) commitBubble(false)
    else if (drag) cancelDrag()
    else if (linkPick.value) linkPick.value = null
    else if (linkAnchor.value) linkAnchor.value = null
    else if (tool.value) setTool(null)
    else if (pathInfo.value || pathAnchor.value) clearPath()
    else if (kinLensOn.value) kinLensOn.value = false
    else if (store.relPopup) store.relPopup = null
    else if (store.selectedPersonIds.length) store.selectPerson(null, { modal: false })
    else consumed = false
    if (consumed) {
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    return
  }
  if (
    e.shiftKey &&
    !tool.value &&
    (e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    !isTypingTarget(e.target) &&
    !isTypingTarget(document.activeElement)
  ) {
    if (nudgeLanes(e.key === 'ArrowLeft' ? -1 : 1)) e.preventDefault()
    return
  }
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
  if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return
  const t = TIMELINE_TOOLS.find((x) => x.key === e.key)
  if (t) {
    e.preventDefault()
    setTool(tool.value === t.id ? null : t.id)
  }
}

function syncFxTheme() {
  fx?.setTheme(store.isLightTheme, {
    surface: cssVar('--surface', '#181c27'),
    text: cssVar('--t1', '#e8eaf6')
  })
}

// ── The coordinate pipeline's knobs: perspective tilt + time warp ───────────
// Tilt: the graph's board tilt laid over the timeline (timelineTilt.ts): the
// bottom bar / T toggles it, Q / E turn it, Alt-drag sets angle (up/down) and
// turn (left/right); it glides in ~0.7 s (snaps under reduced motion). The
// camera stays the flat one — pan/zoom pin the board point under the cursor.
// Warp: the year axis stretches where births cluster (timeWarp.ts); toggling
// or retuning it re-flows the axis smoothly, the year at the stage's centre
// holding still.
const TL_DEG = Math.PI / 180
const TL_TILT_MAX_DEG = Math.round((TILT_MAX * 180) / Math.PI)
const tiltOn = computed(() => !!store.timelineSettings.viewTilt)
const warpOn = computed(() => !!store.timelineSettings.timeWarp)
const tlTiltAngle = () =>
  Math.min(TL_TILT_MAX_DEG, Math.max(8, Number(store.timelineSettings.tiltAngle) || 48))
const tlTiltYaw = () => Number(store.timelineSettings.tiltYaw) || 0
const tlWrapDeg = (d) => ((((d + 180) % 360) + 360) % 360) - 180
const tlReduced = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
let tiltNow = { tl: 0, yw: 0 }
let tiltRaf = 0
let tiltDrag = null // { x0, y0, a0, w0, angle, yaw } while Alt-dragging

function setViewTilt(tl, yw) {
  tiltNow = { tl, yw }
  renderer?.setTilt(tl, yw)
  fx?.setTilt(renderer?.tilted ? renderer.view : null)
  minimapRef.value?.redraw()
}
// Glide tilt AND turn to their targets (ease-out with a whisper of overshoot,
// like the graph's); the turn takes the short way round.
function animateTilt() {
  cancelAnimationFrame(tiltRaf)
  if (!renderer) return
  const on = tiltOn.value
  const toT = on ? tlTiltAngle() * TL_DEG : 0
  const fromT = tiltNow.tl,
    fromY = tiltNow.yw
  const toY = fromY + tlWrapDeg((on ? tlTiltYaw() : 0) - fromY / TL_DEG) * TL_DEG
  if ((Math.abs(toT - fromT) < 1e-4 && Math.abs(toY - fromY) < 1e-4) || tlReduced()) {
    setViewTilt(toT, toY)
    return
  }
  const t0 = performance.now()
  const dur = 720
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur)
    const c = 1.2 // easeOutBack, gentle
    const e = 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2)
    setViewTilt(Math.max(0, fromT + (toT - fromT) * e), fromY + (toY - fromY) * e)
    if (k < 1) tiltRaf = requestAnimationFrame(step)
  }
  tiltRaf = requestAnimationFrame(step)
}
watch(tiltOn, animateTilt)
watch(
  () => [store.timelineSettings.tiltAngle, store.timelineSettings.tiltYaw],
  () => {
    if (tiltOn.value && !tiltDrag) animateTilt()
  }
)
function toggleTilt() {
  store.updateTimelineSetting('viewTilt', !tiltOn.value)
}
// Turn the board by `deg` (Q / E). Turning a flat view tilts it first.
function turnTilt(deg) {
  const yaw = Math.round(tlWrapDeg(tlTiltYaw() + deg))
  if (tiltOn.value) store.updateTimelineSetting('tiltYaw', yaw)
  else store.applyTimelineSettings({ viewTilt: true, tiltYaw: yaw })
}
// Alt-drag: up/down tilts, left/right turns — the board follows the hand.
function beginTiltDrag(e) {
  e.preventDefault()
  cancelAnimationFrame(tiltRaf)
  const a = tiltNow.tl / TL_DEG,
    w = tiltNow.yw / TL_DEG
  tiltDrag = { x0: e.clientX, y0: e.clientY, a0: a, w0: w, angle: a, yaw: w }
  suppressClick = true
  window.addEventListener('pointermove', moveTiltDrag)
  window.addEventListener('pointerup', endTiltDrag)
}
function moveTiltDrag(e) {
  if (!tiltDrag) return
  const a = Math.min(TL_TILT_MAX_DEG, Math.max(0, tiltDrag.a0 + (tiltDrag.y0 - e.clientY) * 0.32))
  const w = tiltDrag.w0 - (e.clientX - tiltDrag.x0) * 0.4
  tiltDrag.angle = a
  tiltDrag.yaw = w
  setViewTilt(a * TL_DEG, w * TL_DEG)
}
function endTiltDrag() {
  window.removeEventListener('pointermove', moveTiltDrag)
  window.removeEventListener('pointerup', endTiltDrag)
  if (!tiltDrag) return
  const { angle: a, yaw } = tiltDrag
  tiltDrag = null
  setTimeout(() => (suppressClick = false), 0)
  const w = Math.round(tlWrapDeg(yaw))
  // Nearly flat snaps flat (and switches the tilt off, keeping the turn for
  // next time); otherwise keep both by hand.
  if (a < 6) {
    store.applyTimelineSettings({ viewTilt: false, tiltYaw: w })
    animateTilt()
  } else store.applyTimelineSettings({ viewTilt: true, tiltAngle: Math.round(a), tiltYaw: w })
}
// T / Q / E — only while the timeline is the live view and nothing else (a
// dialog, a full-screen page, a text field) owns the keys.
function onTiltKey(e) {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
  const k = e.key.toLowerCase()
  if (k !== 't' && k !== 'q' && k !== 'e') return
  if (!props.active || store.activeView !== 'timeline') return
  if (store.modalOpen || store.formOpen || store.chronicleEditor) return
  if (
    !store.authUser ||
    store.curtain?.active ||
    store.userPageOpen ||
    store.projectsPageOpen ||
    store.browsePageOpen
  )
    return
  if (document.querySelector('.home') || document.querySelector('.dh-backdrop')) return
  if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return
  e.preventDefault()
  if (k === 't') toggleTilt()
  else turnTilt(k === 'q' ? 30 : -30)
}

let warpNow = 0
let warpRaf = 0
const warpTarget = () =>
  warpOn.value ? Math.min(1, Math.max(0, Number(store.timelineSettings.warpStrength) || 0)) : 0
// Re-flow the axis to blend k, holding the year at the stage's centre still.
function setWarpK(k) {
  warpNow = k
  if (!renderer) return
  const cy = stageH.value / 2
  const year = renderer.yearAt(cy)
  renderer.setWarp(k)
  if (stageH.value && Number.isFinite(year)) ty.value += cy - renderer.sy(year)
  clampPan()
  syncCamera()
}
function animateWarp() {
  cancelAnimationFrame(warpRaf)
  const to = warpTarget(),
    from = warpNow
  if (Math.abs(to - from) < 1e-4 || tlReduced() || !renderer) {
    setWarpK(to)
    return
  }
  const t0 = performance.now()
  const dur = 650
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur)
    setWarpK(from + (to - from) * (1 - Math.pow(1 - k, 3)))
    if (k < 1) warpRaf = requestAnimationFrame(step)
  }
  warpRaf = requestAnimationFrame(step)
}
watch(() => [warpOn.value, store.timelineSettings.warpStrength], animateWarp)
function toggleWarp() {
  store.updateTimelineSetting('timeWarp', !warpOn.value)
}

// ── Lifecycle ───────────────────────────────────────────────────────────────
let ro = null
let hasFitted = false
let unregisterLaneHistory = null
onMounted(() => {
  const measure = () => {
    stageW.value = stageEl.value?.clientWidth || 0
    stageH.value = stageEl.value?.clientHeight || 0
    renderer?.resize(stageW.value, stageH.value)
    fx?.resize(stageW.value, stageH.value)
    fx?.setTilt(renderer?.tilted ? renderer.view : null)
  }
  renderer = new TimelineRenderer({
    bgCanvas: bgEl.value,
    glCanvas: glEl.value,
    fgCanvas: fgEl.value,
    hooks: {
      personVisual,
      marriageVisual,
      birthVisual,
      familyVisual,
      householdVisual,
      getRefYear: () => refYear.value,
      getTimeYear: () => tt.year.value, // null = time travel off
      getChronicle: () => ({
        ...chronModel.value,
        hover: chronHover.value,
        eraIntensity: store.timelineSettings.eraIntensity,
        markers: store.timelineSettings.eventMarkers
      }),
      getStyle: () => store.timelineSettings,
      getOverlay: () => ({ kin: kinOverlay() })
    }
  })
  fx = new TimelineFx(fxEl.value, {
    person: (id) => renderer?.personScreen(id) || null,
    yearY: (y) => (renderer ? renderer.sy(y) : 0)
  })
  syncFxTheme()
  renderer.setTheme(store.isLightTheme)
  renderer.setInk(store.isInk)
  renderer.setHidden(!props.active)
  renderer.setData(layout.value)
  measure()
  // The saved tilt / warp apply straight away (no glide on the first frame).
  warpNow = warpTarget()
  renderer.setWarp(warpNow)
  if (tiltOn.value) setViewTilt(tlTiltAngle() * TL_DEG, tlTiltYaw() * TL_DEG)
  nextTick(() => {
    measure()
    if (props.active && stageW.value) {
      fitAll(false)
      hasFitted = true
    }
  })
  // Ignore size reports while hidden (display:none reports 0×0, which would
  // corrupt the pan/zoom state); re-measure only when actually laid out.
  ro = new ResizeObserver(() => {
    if (!stageEl.value?.clientWidth) return
    measure()
    clampPan()
    syncCamera()
  })
  if (stageEl.value) ro.observe(stageEl.value)

  window.addEventListener('keydown', onStretchKeyDown)
  window.addEventListener('keyup', onStretchKeyUp)
  window.addEventListener('blur', clearStretchKeys)
  window.addEventListener('keydown', onToolKeydown, true)
  window.addEventListener('keydown', onTiltKey)
  unregisterLaneHistory = store.registerLayoutHistory(restoreLanes, 'timeline')

  watch(
    () => props.active,
    (on) => renderer?.setHidden(!on)
  )

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
        } else {
          clampPan()
          syncCamera()
        }
        // 水墨: the sheet is brushed in afresh each time the view is entered
        if (store.isInk) renderer?.inkWrite()
      })
    }
  )
})

watch(layout, (L) => {
  if (!renderer) return
  if (hoverId.value && !L.people.some((p) => p.id === hoverId.value)) hoverId.value = null
  renderer.setData(L)
  nextTick(() => {
    clampPan()
    syncCamera()
  })
})
watch(
  [
    hoverId,
    searchSet,
    () => store.selectedPersonId,
    selectedSet,
    colors,
    focusGender,
    focusLife,
    linkAnchor,
    pathAnchor,
    liftedSet,
    hoverLink
  ],
  () => renderer?.markStylesDirty()
)
// Auras: the store rebuilds the person → aura Map on any tag/trait/aura edit,
// so watching the Map ref (not deep) catches every change; the renderer
// ignites the people whose ornament changed.
watch(
  () => store.auraOf,
  () => renderer?.markStylesDirty()
)
// Style pane edits: every look/canvas option re-renders (one shallow watch —
// updateTimelineSetting replaces the object).
watch(
  () => store.timelineSettings,
  () => {
    renderer?.markAllDirty()
    renderer?.requestRedraw()
  }
)
// Time travel: re-sync per scrub/playback step while on screen; switching back
// in re-syncs too (the view stays mounted, hidden, and time may have moved).
watch([() => tt.year.value, () => tt.startYear.value, () => props.active], ([, , on]) => {
  if (on) renderer?.markStylesDirty()
})
function syncTheme() {
  renderer?.setTheme(store.isLightTheme)
  renderer?.setInk(store.isInk)
  syncFxTheme()
}
watch([() => store.theme, () => store.accent], syncTheme)

onBeforeUnmount(() => {
  if (ro) ro.disconnect()
  cancelTween()
  if (refreshSpinTimer) clearTimeout(refreshSpinTimer)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('keydown', onStretchKeyDown)
  window.removeEventListener('keyup', onStretchKeyUp)
  window.removeEventListener('blur', clearStretchKeys)
  window.removeEventListener('keydown', onToolKeydown, true)
  window.removeEventListener('keydown', onTiltKey)
  window.removeEventListener('pointermove', moveTiltDrag)
  window.removeEventListener('pointerup', endTiltDrag)
  cancelAnimationFrame(tiltRaf)
  cancelAnimationFrame(warpRaf)
  unregisterLaneHistory?.()
  stopAutoPan()
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragUp)
  fx?.dispose()
  fx = null
  renderer?.dispose()
  renderer = null
})
</script>

<style scoped>
.timeline-view {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background:
    radial-gradient(1200px 600px at 20% -10%, rgba(139, 108, 197, 0.08), transparent 60%), var(--bg);
  min-height: 0;
}

/* ── Toolbar (matches PeopleView) ────────────────────────── */
.tl-toolbar {
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
.tl-heading {
  display: flex;
  align-items: center;
  gap: 10px;
}
.tl-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: var(--t1);
}
.tl-count {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--accent);
  background: var(--adim);
  padding: 2px 9px;
  border-radius: 20px;
}
.tl-undated {
  font-size: 12px;
  font-weight: 600;
  color: #f5a623;
  background: rgba(245, 166, 35, 0.12);
  padding: 2px 9px;
  border-radius: 20px;
  cursor: help;
}

.tl-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.tl-hint {
  font-size: 12px;
  color: var(--t3);
  font-weight: 500;
}

/* Clean view fades the floating overlays away (the header cluster stays so it
   can be toggled back). */
.tl-cv-hide {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

/* ── Stage ───────────────────────────────────────────────── */
.tl-stage {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
}
.tl-stage.dragging {
  cursor: grabbing;
}
/* 水墨: the timeline is a sheet of rice paper (the canvases are transparent) */
:root[data-theme='ink'] .timeline-view {
  background: var(--bg);
}
:root[data-theme='ink'] .tl-stage {
  background-color: var(--bg);
  background-image: var(--ink-paper, none);
  background-size: 512px 512px;
}
:root[data-theme='ink'] .tl-title {
  font-family: var(--font-brush);
  font-weight: 400;
  font-size: 22px;
}
.tl-stage.hoverable:not(.dragging) {
  cursor: pointer;
}
.tl-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

/* Interaction effects (ghosts, bursts, traced chains) ride above the labels. */
.tl-fx {
  pointer-events: none;
  z-index: 1;
}

/* Edit tools: each one has its own cursor. */
.tl-stage.tool-add,
.tl-stage.tool-child,
.tl-stage.tool-link,
.tl-stage.tool-event {
  cursor: crosshair;
}
.tl-stage.tool-delete {
  cursor: not-allowed;
}
.tl-stage.tool-delete.hoverable {
  cursor: pointer;
}
.tl-stage.lane-grab:not(.dragging) {
  cursor: grab;
}
/* Time drag on: a life goes sideways (lane) or up/down (retime) */
.tl-stage.time-grab:not(.dragging) {
  cursor: move;
}
.tl-stage.tool-retime.tool-grab {
  cursor: ns-resize;
}
.tl-stage.tool-grabbing,
.tl-stage.tool-grabbing * {
  cursor: grabbing !important;
}

/* Tool HUD: the floating chip naming the live tool (matches the graph's). */
.tl-hud {
  --mc: var(--accent);
  position: absolute;
  left: 50%;
  bottom: 26px;
  transform: translateX(-50%);
  z-index: 8;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 9px 7px 8px;
  background: var(--glass-strong);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  border: 1px solid color-mix(in srgb, var(--mc) 35%, var(--border));
  border-radius: 999px;
  box-shadow:
    var(--shadow),
    0 0 18px color-mix(in srgb, var(--mc) 16%, transparent);
}
.tl-hud-badge {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--mc) 16%, transparent);
  flex-shrink: 0;
}
.tl-hud-ic {
  color: var(--mc);
}
/* A comet orbiting the badge — "this tool is live". */
.tl-hud-ring {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    transparent 0 68%,
    color-mix(in srgb, var(--mc) 90%, transparent) 90%,
    transparent 100%
  );
  -webkit-mask: radial-gradient(
    farthest-side,
    transparent calc(100% - 2.5px),
    #000 calc(100% - 2px)
  );
  mask: radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px));
  animation: tl-hud-orbit 2.4s linear infinite;
}
@keyframes tl-hud-orbit {
  to {
    transform: rotate(360deg);
  }
}
.tl-hud-text {
  min-width: 0;
  padding-right: 2px;
}
.tl-hud-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--t1);
  white-space: nowrap;
}
.tl-hud-label kbd {
  font-size: 10.5px;
  padding: 0 5px;
}
.tl-hud-hint {
  font-size: 11.5px;
  color: var(--t3);
  white-space: nowrap;
  max-width: 380px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tl-hud-btn {
  width: var(--ctl-xs);
  height: var(--ctl-xs);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background var(--dur) ease,
    color var(--dur) ease,
    transform 0.18s var(--ease-spring);
}
.tl-hud-btn:hover {
  background: var(--hover);
  color: var(--t1);
  transform: scale(1.08);
}
.tlhud-enter-active {
  transition:
    opacity 0.24s ease,
    transform 0.38s cubic-bezier(0.22, 1.3, 0.36, 1),
    filter 0.24s ease;
}
.tlhud-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.18s ease;
}
.tlhud-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(14px) scale(0.9);
  filter: blur(4px);
}
.tlhud-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px) scale(0.95);
}

/* Christening bubble: name the life you just placed. */
.tl-bubble {
  --mc: var(--accent);
  position: absolute;
  z-index: 21;
  width: 236px;
  transform: translate(-50%, calc(-100% - 30px));
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 9px 10px;
  background: var(--glass-strong);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  border: 1px solid color-mix(in srgb, var(--mc) 50%, var(--border));
  border-radius: 14px;
  box-shadow:
    var(--shadow),
    0 0 26px color-mix(in srgb, var(--mc) 22%, transparent);
  animation: tl-bubble-in 0.36s cubic-bezier(0.34, 1.4, 0.5, 1) backwards;
}
.tl-bubble::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -6px;
  width: 10px;
  height: 10px;
  transform: translateX(-50%) rotate(45deg);
  background: var(--glass-strong);
  border-right: 1px solid color-mix(in srgb, var(--mc) 50%, var(--border));
  border-bottom: 1px solid color-mix(in srgb, var(--mc) 50%, var(--border));
}
@keyframes tl-bubble-in {
  from {
    opacity: 0;
    transform: translate(-50%, calc(-100% - 16px)) scale(0.82);
  }
}
.tl-bubble-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: var(--mc);
}
.tl-bubble-input {
  width: 100%;
  height: 30px;
  padding: 0 9px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 650;
  outline: none;
  transition:
    border-color var(--dur) ease,
    box-shadow var(--dur) ease;
}
.tl-bubble-input:focus {
  border-color: var(--mc);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--mc) 22%, transparent);
}
.tl-bubble-co {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.tl-bubble-co-label {
  font-size: 11.5px;
  color: var(--t3);
  margin-right: 2px;
}
.tl-co-chip {
  --pc: var(--accent);
  padding: 2px 9px;
  border-radius: var(--r-pill);
  border: 1px solid color-mix(in srgb, var(--pc) 40%, var(--border));
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
  transition:
    background var(--dur) ease,
    color var(--dur) ease;
}
.tl-co-chip.on {
  background: color-mix(in srgb, var(--pc) 22%, transparent);
  color: var(--t1);
  border-color: var(--pc);
}
.tl-bubble-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

/* Link chooser: what binds the two lives. */
.tl-linkpick {
  position: absolute;
  z-index: 21;
  width: 300px;
  transform: translateX(-50%);
  padding: 10px;
  background: var(--glass-strong);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
  animation: tl-lp-in 0.32s cubic-bezier(0.34, 1.4, 0.5, 1) backwards;
}
.tl-linkpick.up {
  transform: translate(-50%, -100%);
  animation-name: tl-lp-in-up;
}
@keyframes tl-lp-in-up {
  from {
    opacity: 0;
    transform: translate(-50%, -100%) translateY(8px) scale(0.9);
  }
}
@keyframes tl-lp-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-8px) scale(0.9);
  }
}
.tl-lp-head {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  margin-bottom: 8px;
}
.tl-lp-swap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t2);
  border-radius: 50%;
  width: var(--ctl-xs);
  height: var(--ctl-xs);
  cursor: pointer;
  transition: transform 0.3s var(--ease-spring);
}
.tl-lp-swap:hover {
  transform: rotate(180deg);
  color: var(--t1);
}
.tl-lp-year {
  margin-left: auto;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--t3);
}
.tl-lp-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  max-height: 180px;
  overflow-y: auto;
}
.tl-lp-chip {
  --rc: var(--accent);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px 4px 7px;
  border-radius: var(--r-pill);
  border: 1px solid color-mix(in srgb, var(--rc) 45%, var(--border));
  background: color-mix(in srgb, var(--rc) 10%, transparent);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 650;
  cursor: pointer;
  animation: cp-row-in 0.36s var(--ease-out) backwards;
  animation-delay: calc(var(--i) * 0.025s);
  transition:
    transform 0.18s var(--ease-spring),
    box-shadow var(--dur) ease,
    background var(--dur) ease;
}
.tl-lp-chip:hover {
  transform: translateY(-2px);
  background: color-mix(in srgb, var(--rc) 22%, transparent);
  box-shadow: 0 5px 14px color-mix(in srgb, var(--rc) 30%, transparent);
}
.tl-lp-glyph {
  color: var(--rc);
}

@media (prefers-reduced-motion: reduce) {
  .tl-hud-ring,
  .tl-bubble,
  .tl-linkpick,
  .tl-lp-chip {
    animation: none;
  }
}

/* ── Floating search (tree-view style) ───────────────────── */
/* Minimap sits past the year-axis gutter so it never hides the year labels
   (compound selector so it outweighs the MiniMap's own base styles) */
.mini-map.tl-minimap {
  left: 78px;
}

.tl-search {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  width: 280px;
  z-index: 5;
  border-radius: var(--r-md);
  box-shadow: var(--shadow);
  cursor: default;
}
.tl-search-field :deep(.sf-input) {
  background: var(--surface);
}

/* ── Zoom controls (tree-view control bar style) ─────────── */
.tl-controls {
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
.tl-ctrl-btn {
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
.tl-ctrl-btn:hover {
  background: var(--hover);
  color: var(--t1);
}
.tl-ctrl-wide {
  width: auto;
  padding: 0 10px;
  gap: 6px;
  font-size: var(--fs-sm);
  font-weight: 600;
  border: 1px solid transparent;
}
.tl-ctrl-active,
.tl-ctrl-active:hover {
  background: var(--adim);
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.3);
}
.tl-zoom-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 12px;
  font-weight: 600;
  color: var(--t3);
  min-width: 42px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  padding: 0 6px;
}
.tl-ctrl-sep {
  width: 1px;
  align-self: stretch;
  background: var(--border);
  margin: 3px 2px;
}
.tl-ctrl-refresh .tl-refresh-icon {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.tl-ctrl-refresh:hover .tl-refresh-icon {
  transform: rotate(45deg);
}
.tl-ctrl-refreshing .tl-refresh-icon {
  animation: tl-refresh-spin 0.65s cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes tl-refresh-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Legend/Focus now live in .canvas-pane-stack (glass chrome + spring-in from
   global.css); these classes only carry inner layout. */
.tl-pane-stack {
  cursor: default;
}
.tl-legend-panel {
  padding: 12px 16px;
  font-size: 12px;
  color: var(--t2);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 150px;
}
.tl-focus-pane {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  min-width: 210px;
}
.tl-focus-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.tl-focus-row.tl-focus-off {
  opacity: 0.55;
}
.tl-focus-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--t2);
  min-width: 46px;
}
.tl-focus-chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.tl-focus-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  padding: 0 10px;
  border-radius: 16px;
  cursor: pointer;
  transition:
    background 0.16s ease,
    color 0.16s ease,
    border-color 0.16s ease,
    transform 0.16s cubic-bezier(0.34, 1.5, 0.5, 1);
}
.tl-focus-chip.is-icon {
  width: 30px;
  padding: 0;
}
.tl-focus-chip:hover:not(:disabled) {
  color: var(--t1);
  transform: translateY(-1px);
}
.tl-focus-chip.on {
  background: var(--adim);
  border-color: color-mix(in srgb, var(--accent) 50%, transparent);
  color: var(--accent);
}
.tl-focus-chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.tl-panel-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--t3);
}
.tl-leg-section {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.tl-leg-label {
  font-size: var(--fs-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--t3);
}
.tl-leg-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}
.tl-leg-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.tl-leg-line {
  width: 22px;
  height: 2px;
  flex-shrink: 0;
  border-radius: 1px;
}
.tl-leg-dashed {
  height: 0;
  border-top: 2px dashed;
  background: none !important;
}

/* ── Marriage edit popup ─────────────────────────────────── */
.tl-medit {
  position: absolute;
  z-index: 6;
  width: 220px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  cursor: default;
}
.tl-medit-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--t1);
  margin-bottom: 9px;
}
.tl-medit-title span {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tl-medit-row {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}
.tl-medit-input {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.tl-medit-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(var(--accent-rgb), 0.15);
}
.tl-medit-select {
  flex: 1;
  min-width: 0;
  padding: 6px 6px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  outline: none;
  cursor: pointer;
}
.tl-medit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
.tl-medit-btn {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.13s;
}
.tl-medit-btn:hover {
  background: var(--hover);
  color: var(--t1);
}
.tl-medit-btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.tl-medit-btn.primary:hover {
  filter: brightness(1.1);
}

.medit-enter-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.medit-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}
.medit-enter-from,
.medit-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.96);
}

/* ── Empty state ─────────────────────────────────────────── */
.tl-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
  color: var(--t2);
  pointer-events: none;
}
.tl-empty-icon {
  color: var(--t3);
}
.tl-empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--t1);
}
.tl-empty-text {
  font-size: 13px;
  max-width: 300px;
}

/* ── Chronicle hover card ─────────────────────────────────────────────── */
.tl-chtip {
  --c: var(--accent);
  position: absolute;
  z-index: 9;
  width: 250px;
  padding: 9px 11px;
  border-radius: var(--r-md);
  background: var(--glass-soft);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid color-mix(in srgb, var(--c) 60%, var(--border));
  box-shadow:
    var(--shadow),
    0 0 24px color-mix(in srgb, var(--c) 22%, transparent);
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.tl-chtip-head {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: var(--t1);
}
.tl-chtip-ic {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--c) 25%, transparent);
  flex-shrink: 0;
}
.tl-chtip-when {
  font-size: 12px;
  font-weight: 650;
  color: var(--c);
}
.tl-chtip-cast {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--t2);
}
.tl-chtip-text {
  font-size: 12.5px;
  color: var(--t2);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tl-chtip-hint {
  font-size: var(--fs-xs);
  color: var(--t3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-top: 2px;
}
.chtip-enter-active {
  transition:
    opacity 0.16s ease,
    transform 0.22s var(--ease-out);
}
.chtip-leave-active {
  transition: opacity 0.1s ease;
}
.chtip-enter-from {
  opacity: 0;
  transform: translateY(4px) scale(0.97);
}
.chtip-leave-to {
  opacity: 0;
}
</style>
