<template>
  <Transition name="studio">
    <aside
      v-if="store.settingsOpen"
      ref="rootEl"
      class="studio"
      :data-layer="layer"
      role="dialog"
      :aria-label="t('styleStudio.title')"
      @pointerdown.stop
      @wheel.stop
      @keydown="onKeydown"
    >
      <!-- ── Header ── -->
      <header class="st-head">
        <span class="st-mark" aria-hidden="true"><UiIcon name="style" :size="17" /></span>
        <div class="st-head-text">
          <h3 class="st-title">{{ t('styleStudio.title') }}</h3>
          <Transition name="st-fade" mode="out-in">
            <span :key="crumb" class="st-crumb">{{ crumb }}</span>
          </Transition>
        </div>
        <button
          class="icon-btn sm"
          :title="t('styleStudio.close')"
          :aria-label="t('styleStudio.close')"
          @click="store.toggleSettings(false)"
        >
          <UiIcon name="x" :size="16" />
        </button>
      </header>

      <SearchField
        v-model="query"
        class="st-search"
        size="sm"
        :placeholder="t('styleStudio.search')"
      />

      <!-- ── The layer deck: the app sheet underneath, the view sheet on top.
           The sheet in front is the one you're editing; click the one behind
           to shuffle it forward. ── -->
      <div class="st-deck" :class="{ 'is-searching': searching }">
        <button
          v-for="c in deck"
          :key="c.id"
          class="st-card"
          :class="[
            'st-card-' + c.id,
            layer === c.id ? 'is-front' : 'is-back',
            { 'is-pulsing': c.id === 'app' && appPulse }
          ]"
          :aria-pressed="layer === c.id"
          :title="layer === c.id ? '' : t('styleStudio.layers.bringForward')"
          @click="setLayer(c.id)"
        >
          <span class="st-card-row">
            <span class="st-card-ic">
              <Transition name="st-roll" mode="out-in">
                <UiIcon :key="c.icon" :name="c.icon" :size="15" />
              </Transition>
            </span>
            <Transition name="st-roll" mode="out-in">
              <b :key="c.title" class="st-card-title">{{ c.title }}</b>
            </Transition>
            <span class="st-card-tag">{{ c.tag }}</span>
          </span>
          <span class="st-card-row st-card-sub">
            <span class="st-card-desc">{{ c.desc }}</span>
            <!-- reach: which views this layer paints -->
            <span class="st-reach" :aria-label="t('styleStudio.reach')">
              <UiIcon
                v-for="v in railViews"
                :key="v"
                :name="v"
                :size="11"
                :class="{ lit: c.reach === 'all' || c.reach === v }"
              />
            </span>
          </span>
        </button>
      </div>

      <!-- ── Search results ── -->
      <div v-if="searching" class="st-body st-results">
        <template v-if="hitGroups.length">
          <section v-for="g in hitGroups" :key="g.id" class="st-hit-group">
            <h4 class="st-sec-title">{{ g.title }}</h4>
            <button
              v-for="(h, i) in g.hits"
              :key="h.scope + h.chapter + h.key"
              class="st-hit"
              :style="{ '--i': i }"
              @click="goto(h.scope, h.chapter, h.key)"
            >
              <UiIcon class="st-hit-ic" :name="chapterIcon(h)" :size="15" />
              <span class="st-hit-label">{{ h.label }}</span>
              <span class="st-hit-crumb">{{ hitCrumb(h) }}</span>
              <UiIcon class="st-hit-go" name="arrow-right" :size="14" />
            </button>
          </section>
        </template>
        <div v-else class="st-empty">
          <UiIcon name="search" :size="22" />
          <p>{{ t('styleStudio.noResults', { q: query }) }}</p>
        </div>
      </div>

      <template v-else>
        <!-- ── Chapters of the front layer ── -->
        <nav
          v-if="chapters.length"
          class="st-chapters"
          :class="{ 'is-wide': chapters.length <= 3 }"
          role="tablist"
        >
          <button
            v-for="(c, i) in chapters"
            :key="layerKey + c.id"
            class="st-ch"
            :class="{ on: c.id === chapter }"
            :style="{ '--i': i }"
            role="tab"
            :aria-selected="c.id === chapter"
            :title="t(c.labelKey)"
            @click="setChapter(c.id)"
          >
            <UiIcon :name="c.icon" :size="15" />
            <span class="st-ch-label">{{ t(c.labelKey) }}</span>
            <i v-if="tunedOf(c)" class="st-ch-dot" aria-hidden="true"></i>
          </button>
        </nav>

        <!-- ── Scope ribbon: where this chapter is saved + chapter reset ── -->
        <div v-if="chapters.length" class="st-scope">
          <UiIcon :name="savedIcon" :size="13" />
          <span class="st-scope-text">{{ savedText }}</span>
          <Transition name="st-fade">
            <button
              v-if="tunedNow"
              class="st-reset"
              :title="t('styleStudio.resetChapterHint')"
              @click="resetChapter"
            >
              <UiIcon name="rotate-ccw" :size="12" />{{ t('styleStudio.tuned', { n: tunedNow }) }}
            </button>
          </Transition>
        </div>

        <!-- ── The chapter itself ── -->
        <div ref="bodyEl" class="st-body">
          <Transition :name="bodyTransition" mode="out-in">
            <div v-if="!sheet" :key="'empty-' + store.activeView" class="st-inherit">
              <div class="st-inherit-art" aria-hidden="true">
                <span class="st-inherit-base"><UiIcon name="globe" :size="16" /></span>
                <span class="st-inherit-glass"><UiIcon :name="store.activeView" :size="18" /></span>
              </div>
              <h4>{{ t('styleStudio.inherit.title', { view: viewName }) }}</h4>
              <p>{{ t('styleStudio.inherit.body') }}</p>
              <button class="btn btn-soft btn-sm" @click="setLayer('app')">
                <UiIcon name="globe" :size="14" />{{ t('styleStudio.inherit.cta') }}
              </button>
            </div>
            <component
              :is="sheet"
              v-else
              :key="layerKey + ':' + chapter"
              :chapter="chapter"
              @goto="goto"
              @touch-app="pulseApp"
            />
          </Transition>
        </div>
      </template>
    </aside>
  </Transition>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useMainStore } from '../../store/index.js'
import { useI18n } from '../../i18n'
import UiIcon from '../ui/UiIcon.js'
import SearchField from '../ui/SearchField.vue'
import { THEME_KEYS } from '../graph/graphThemes.js'
import AppStyleSheet from './AppStyleSheet.vue'
import GraphStyleSheet from './GraphStyleSheet.vue'
import TimelineStyleSheet from './TimelineStyleSheet.vue'
import DirectoryStyleSheet from './DirectoryStyleSheet.vue'
import MapStyleSheet from './MapStyleSheet.vue'
import {
  RAIL_VIEWS,
  STYLE_ENTRIES,
  chaptersFor,
  chapterDirection,
  countTuned,
  defaultsPatch,
  hasViewStyle,
  searchStyleEntries
} from './styleCatalog'
import './studio.css'

// The Style Studio: one place for every look in the app, split into the two
// layers it actually has — the WHOLE-APP foundation (theme, accent, shared
// palette, profiles) and the CURRENT VIEW's own style on top of it — drawn
// as two stacked sheets you shuffle between, each split into chapters.

const store = useMainStore()
const { t } = useI18n()

const SHEETS = {
  graph: GraphStyleSheet,
  timeline: TimelineStyleSheet,
  directory: DirectoryStyleSheet,
  map: MapStyleSheet
}

const rootEl = ref(null)
const bodyEl = ref(null)
const query = ref('')
const appPulse = ref(false)
// The chapter each layer was last on (per view, so graph + timeline keep theirs).
const chapterOf = reactive({})
const bodyTransition = ref('st-slide-next')

const layer = computed(() => store.styleLayer)
const layerKey = computed(() => (layer.value === 'app' ? 'app' : store.activeView))
const capsStyle = computed(() => store.caps.style)
const railViews = computed(() => RAIL_VIEWS.filter((v) => store.caps.views.includes(v)))
const viewName = computed(() => t('rail.' + store.activeView))

const chapters = computed(() =>
  layer.value === 'view' && !hasViewStyle(store.activeView)
    ? []
    : chaptersFor(layerKey.value, capsStyle.value)
)
const chapter = computed(() => {
  const want = chapterOf[layerKey.value]
  return chapters.value.some((c) => c.id === want) ? want : chapters.value[0]?.id || ''
})
const chapterMeta = computed(() => chapters.value.find((c) => c.id === chapter.value) || null)
const sheet = computed(() =>
  layer.value === 'app' ? AppStyleSheet : SHEETS[store.activeView] || null
)

const deck = computed(() => {
  const own = hasViewStyle(store.activeView)
  return [
    {
      id: 'app',
      icon: 'globe',
      title: t('styleStudio.layers.app'),
      tag: t('styleStudio.layers.appTag'),
      desc: t('styleStudio.layers.appDesc'),
      reach: 'all'
    },
    {
      id: 'view',
      icon: store.activeView,
      title: viewName.value,
      tag: t('styleStudio.layers.viewTag'),
      desc: own
        ? t('styleStudio.layers.viewDesc', { view: viewName.value })
        : t('styleStudio.layers.viewNone'),
      reach: store.activeView
    }
  ]
})

const crumb = computed(() => {
  const base = layer.value === 'app' ? t('styleStudio.layers.app') : viewName.value
  return chapterMeta.value ? `${base} · ${t(chapterMeta.value.labelKey)}` : base
})

// ── where the open chapter is saved ──
const savedKind = computed(() => {
  if (layer.value === 'app') return chapter.value === 'theme' ? 'device' : 'project'
  return store.activeView === 'map' ? 'map' : 'project'
})
const savedIcon = computed(
  () => ({ device: 'monitor', project: 'folder', map: 'map' })[savedKind.value]
)
const savedText = computed(() =>
  layer.value === 'app'
    ? t('styleStudio.saved.' + savedKind.value + 'All')
    : t('styleStudio.saved.' + savedKind.value + 'View', { view: viewName.value })
)

// ── tuned dots + chapter reset ──
function sourceOf(c) {
  if (c.source === 'graph') return [store.graphSettings, store.GRAPH_SETTING_DEFAULTS]
  if (c.source === 'timeline') return [store.timelineSettings, store.TIMELINE_SETTING_DEFAULTS]
  return null
}
function tunedOf(c) {
  const src = sourceOf(c)
  return src ? countTuned(src[0], src[1], c.keys) : 0
}
const tunedNow = computed(() => (chapterMeta.value ? tunedOf(chapterMeta.value) : 0))
function resetChapter() {
  const c = chapterMeta.value
  const src = c && sourceOf(c)
  if (!src) return
  const patch = defaultsPatch(src[1], c.keys)
  if (c.source === 'timeline') store.applyTimelineSettings(patch)
  else {
    if (Object.keys(patch).some((k) => THEME_KEYS.has(k))) patch.themePreset = 'custom'
    store.applyGraphSettings(patch)
  }
}

// ── navigation ──
function setLayer(id) {
  if (id === layer.value) return
  bodyTransition.value = id === 'app' ? 'st-sink' : 'st-rise'
  store.styleLayer = id
}
function setChapter(id) {
  if (id === chapter.value) return
  bodyTransition.value =
    chapterDirection(chapters.value, chapter.value, id) > 0 ? 'st-slide-next' : 'st-slide-prev'
  chapterOf[layerKey.value] = id
}
// The view changed under an open studio: the view sheet morphs in place.
watch(
  () => store.activeView,
  () => {
    bodyTransition.value = 'st-morph'
  }
)

/** Jump to a control anywhere — another layer, chapter or even view — and
 *  flash it. Used by search results and the "open palette" links. */
async function goto(scope, chap, key) {
  query.value = ''
  if (scope === 'app') setLayer('app')
  else {
    if (scope !== store.activeView && store.caps.views.includes(scope)) store.activeView = scope
    setLayer('view')
  }
  const lk = scope === 'app' ? 'app' : scope
  chapterOf[lk] = chap
  if (!key) return
  await nextTick()
  // the body swaps with an out-in transition: wait for the control to exist
  let tries = 0
  const seek = () => {
    const el = bodyEl.value?.querySelector(`[data-skey="${key}"]`)
    if (el) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
      el.classList.remove('st-flash')
      void el.offsetWidth // restart the flash if it's already running
      el.classList.add('st-flash')
      setTimeout(() => el.classList.remove('st-flash'), 1600)
    } else if (tries++ < 60) requestAnimationFrame(seek)
  }
  requestAnimationFrame(seek)
}

/** A view edit that also repainted the app layer (a graph look sets the
 *  shared palette): ripple the app sheet so the reach is visible. */
let pulseTimer = null
function pulseApp() {
  appPulse.value = false
  clearTimeout(pulseTimer)
  requestAnimationFrame(() => {
    appPulse.value = true
    pulseTimer = setTimeout(() => (appPulse.value = false), 1100)
  })
}

// ── search ──
const searching = computed(() => query.value.trim().length > 0)
const visibleEntries = computed(() =>
  STYLE_ENTRIES.filter((e) => {
    if (e.scope !== 'app' && !store.caps.views.includes(e.scope)) return false
    return chaptersFor(e.scope, capsStyle.value).some((c) => c.id === e.chapter)
  })
)
function chapterFor(e) {
  return chaptersFor(e.scope, capsStyle.value).find((c) => c.id === e.chapter)
}
function chapterIcon(e) {
  return chapterFor(e)?.icon || 'style'
}
function scopeName(scope) {
  return scope === 'app' ? t('styleStudio.layers.app') : t('rail.' + scope)
}
function hitCrumb(h) {
  const c = chapterFor(h)
  return c ? `${scopeName(h.scope)} › ${t(c.labelKey)}` : scopeName(h.scope)
}
const hitGroups = computed(() => {
  const hits = searchStyleEntries(
    visibleEntries.value,
    query.value,
    (e) => t(e.labelKey),
    (e) => {
      const c = chapterFor(e)
      return (c ? t(c.labelKey) + ' ' : '') + scopeName(e.scope)
    },
    store.activeView
  )
  const groups = [
    { id: 'app', title: t('styleStudio.results.app'), hits: [] },
    { id: 'view', title: t('styleStudio.results.view', { view: viewName.value }), hits: [] },
    { id: 'other', title: t('styleStudio.results.other'), hits: [] }
  ]
  for (const h of hits.slice(0, 24)) {
    const g = h.scope === 'app' ? 0 : h.scope === store.activeView ? 1 : 2
    groups[g].hits.push(h)
  }
  return groups.filter((g) => g.hits.length)
})

// Escape closes the studio when focus is inside it (and search is empty —
// the search field's own Esc clears it first).
function onKeydown(e) {
  if (e.key !== 'Escape' || e.defaultPrevented) return
  if (query.value) return
  e.stopPropagation()
  store.toggleSettings(false)
}

// A fresh open starts on the view's own layer when it has one; a view with
// nothing of its own opens straight onto the app layer.
watch(
  () => store.settingsOpen,
  (open) => {
    if (!open) return
    query.value = ''
    bodyTransition.value = 'st-slide-next'
    if (store.styleLayer === 'view' && !hasViewStyle(store.activeView)) store.styleLayer = 'app'
  }
)
</script>
