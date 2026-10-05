<template>
  <Teleport to="body">
    <Transition name="bpage">
      <div v-if="store.browsePageOpen && store.authUser" class="bp-root">
        <!-- Ambient canopy: drifting light pools + fireflies (CSS only) -->
        <div class="bp-canopy" aria-hidden="true">
          <div class="bp-pool a"></div>
          <div class="bp-pool b"></div>
          <div class="bp-pool c"></div>
          <span v-for="f in FIREFLIES" :key="f.i" class="bp-fly" :style="f.style"></span>
        </div>
        <!-- 水墨 ink theme: a paper forest — 山林 brushed down the side -->
        <InkBackdrop watermark="山林" />

        <header class="bp-topbar">
          <button class="bp-back" @click="close">
            <span class="bp-back-arrow">←</span>
            {{ t('browse.back') }}
          </button>
          <span class="bp-brand">🧭 {{ t('browse.brand') }}</span>
          <div class="bp-ticker" aria-live="polite">
            <Transition name="tick" mode="out-in">
              <button
                v-if="tickLine"
                :key="tickIdx"
                class="bp-tick"
                @click="openProject(tickLine.projectId)"
              >
                <span class="bp-tick-dot"></span>
                <span class="bp-tick-av">{{ tickLine.avatar }}</span>
                <b>{{ tickLine.name }}</b>
                {{ tickLine.verb }}
                <em>{{ tickLine.title }}</em>
              </button>
            </Transition>
          </div>
          <button class="bp-surprise" :class="{ rolling }" @click="surprise">
            <span class="bp-dice">🎲</span>
            {{ t('browse.surprise') }}
          </button>
        </header>

        <main ref="scrollRef" class="bp-scroll">
          <div class="bp-content">
            <!-- ── Hero ────────────────────────────────────────────────── -->
            <section class="bp-hero">
              <div class="bp-hero-crests" aria-hidden="true">
                <span v-for="(c, i) in heroCrests" :key="i" :style="c.style">{{ c.glyph }}</span>
              </div>
              <p class="bp-eyebrow">{{ t('browse.eyebrow') }}</p>
              <h1 class="bp-title">{{ t('browse.title') }}</h1>
              <p class="bp-subtitle">{{ t('browse.subtitle') }}</p>
              <div class="bp-search" :class="{ focused: searchFocused }">
                <span class="bp-search-icon">🔍</span>
                <input
                  ref="searchRef"
                  v-model="query"
                  class="bp-search-input"
                  :placeholder="placeholder"
                  spellcheck="false"
                  @focus="searchFocused = true"
                  @blur="searchFocused = false"
                  @keydown.esc.stop="clearQuery"
                />
                <button v-if="query" class="bp-search-clear" @click="clearQuery">×</button>
                <kbd v-else class="bp-kbd">/</kbd>
              </div>
              <div class="bp-try">
                <span>{{ t('browse.try') }}</span>
                <button v-for="s in SUGGESTIONS" :key="s" class="bp-try-chip" @click="query = s">
                  {{ s }}
                </button>
              </div>
              <p class="bp-mock-note">🧪 {{ t('browse.mockNote') }}</p>
            </section>

            <!-- ── Access ladder ───────────────────────────────────────── -->
            <section class="bp-ladder">
              <div class="bp-ladder-head">
                <h2>{{ t('browse.ladderTitle') }}</h2>
                <p>{{ t('browse.ladderHint') }}</p>
              </div>
              <div class="bp-ladder-steps">
                <button
                  v-for="(m, i) in ACCESS_MODES"
                  :key="m"
                  class="bp-step"
                  :class="['mode-' + m, { on: filters.access.includes(m) }]"
                  :style="{ '--i': i }"
                  :aria-pressed="filters.access.includes(m)"
                  @click="toggleAccess(m)"
                >
                  <span class="bp-step-icon">{{ ACCESS_ICONS[m] }}</span>
                  <span class="bp-step-name">{{ t('browse.modes.' + m + '.name') }}</span>
                  <span class="bp-step-short">{{ t('browse.modes.' + m + '.short') }}</span>
                  <span class="bp-step-pips">
                    <i
                      v-for="c in CAPABILITIES"
                      :key="c"
                      :class="{ ok: can(m, c) }"
                      :title="t('browse.caps.' + c)"
                    ></i>
                  </span>
                  <span class="bp-step-count">{{ modeCount(m) }}</span>
                </button>
              </div>
            </section>

            <!-- ── Filter bar ──────────────────────────────────────────── -->
            <div class="bp-filters">
              <div class="bp-genres">
                <button
                  v-for="g in GENRES"
                  :key="g"
                  class="bp-genre"
                  :class="{ on: filters.genre === g }"
                  @click="filters.genre = g"
                >
                  <span>{{ GENRE_ICON[g] }}</span>
                  {{ t('browse.genres.' + g) }}
                  <span class="bp-genre-n">{{ genreCount(g) }}</span>
                </button>
              </div>
              <div class="bp-filter-right">
                <div class="bp-seg" role="group" :aria-label="t('browse.sizeLabel')">
                  <button
                    v-for="s in SIZES"
                    :key="s"
                    class="bp-seg-btn"
                    :class="{ on: filters.size === s }"
                    :title="t('browse.sizesHint.' + s)"
                    @click="filters.size = s"
                  >
                    {{ t('browse.sizes.' + s) }}
                  </button>
                </div>
                <select
                  v-model="filters.lang"
                  class="bp-select"
                  :aria-label="t('browse.langs.any')"
                >
                  <option v-for="l in LANGS" :key="l" :value="l">
                    {{ t('browse.langs.' + l) }}
                  </option>
                </select>
                <label class="bp-sort">
                  <span>⇅</span>
                  <select
                    v-model="sortBy"
                    class="bp-select bare"
                    :aria-label="t('browse.sortLabel')"
                  >
                    <option v-for="s in SORT_KEYS" :key="s" :value="s">
                      {{
                        s === 'forYou' && query.trim()
                          ? t('browse.sort.relevance')
                          : t('browse.sort.' + s)
                      }}
                    </option>
                  </select>
                </label>
              </div>
            </div>

            <!-- ── Discovery shelves (only when not searching) ─────────── -->
            <template v-if="!filtering">
              <section class="bp-shelf">
                <div class="bp-shelf-head">
                  <h2>✨ {{ t('browse.shelves.forYou') }}</h2>
                  <p>{{ t('browse.shelves.forYouHint') }}</p>
                </div>
                <div class="bp-row">
                  <BrowseCard
                    v-for="(r, i) in recs"
                    :key="r.project.id"
                    class="bp-row-card"
                    :project="r.project"
                    :author="profileById.get(r.project.authorId)"
                    :liked="signals.isLiked(r.project.id)"
                    :saved="signals.isSaved(r.project.id)"
                    :reason="reasonText(r.reason)"
                    :delay="i * 60"
                    compact
                    @open="openProject"
                    @like="signals.toggleLike"
                    @save="signals.toggleSave"
                    @author="openProfile"
                  />
                </div>
              </section>

              <section class="bp-shelf">
                <div class="bp-shelf-head">
                  <h2>📚 {{ t('browse.shelves.collections') }}</h2>
                  <p>{{ t('browse.shelves.collectionsHint') }}</p>
                </div>
                <div class="bp-collections">
                  <button
                    v-for="(c, i) in COLLECTIONS"
                    :key="c.id"
                    class="bp-coll"
                    :style="{ '--h': c.hue, '--i': i }"
                    @click="openCollection(c.id)"
                  >
                    <span class="bp-coll-emoji">{{ c.emoji }}</span>
                    <span class="bp-coll-title">{{ collTitle(c) }}</span>
                    <span class="bp-coll-stack">
                      <span
                        v-for="(pid, j) in c.projectIds.slice(0, 5)"
                        :key="pid"
                        class="bp-coll-crest"
                        :style="{ '--j': j, '--ch': projectById.get(pid).hue }"
                        >{{ projectById.get(pid).crest }}</span
                      >
                    </span>
                    <span class="bp-coll-n">{{
                      t('browse.results', { n: c.projectIds.length })
                    }}</span>
                  </button>
                </div>
              </section>

              <AdSlot class="bp-ad-banner" placement="banner" :seed="0" :exclude="['browse']" />

              <section class="bp-shelf">
                <div class="bp-shelf-head">
                  <h2>🌟 {{ t('browse.shelves.creators') }}</h2>
                  <p>{{ t('browse.shelves.creatorsHint') }}</p>
                </div>
                <div class="bp-row">
                  <div
                    v-for="(p, i) in creators"
                    :key="p.id"
                    class="bp-creator"
                    :style="{ '--h': p.hue, '--d': i * 50 + 'ms' }"
                    role="button"
                    tabindex="0"
                    @click="openProfile(p.id)"
                    @keydown.enter="openProfile(p.id)"
                  >
                    <span class="bp-creator-av">{{ p.avatar }}</span>
                    <span class="bp-creator-name">{{ p.displayName }}</span>
                    <span class="bp-creator-handle">@{{ p.username }}</span>
                    <span class="bp-creator-crests">
                      <span v-for="tr in treesBy(p.id)" :key="tr.id">{{ tr.crest }}</span>
                    </span>
                    <span class="bp-creator-meta">
                      {{ compactNum(p.followers + (signals.isFollowing(p.id) ? 1 : 0)) }}
                      {{ t('browse.profile.followers') }}
                    </span>
                    <button
                      class="bp-creator-follow"
                      :class="{ on: signals.isFollowing(p.id) }"
                      @click.stop="signals.toggleFollow(p.id)"
                    >
                      {{
                        signals.isFollowing(p.id)
                          ? '✓ ' + t('browse.profile.following')
                          : '＋ ' + t('browse.profile.follow')
                      }}
                    </button>
                  </div>
                </div>
              </section>

              <section class="bp-shelf">
                <div class="bp-shelf-head">
                  <h2>🪴 {{ t('browse.shelves.yours') }}</h2>
                  <p>{{ t('browse.shelves.yoursHint') }}</p>
                </div>
                <div class="bp-yours">
                  <button
                    v-for="p in myPublic"
                    :key="p.id"
                    class="bp-mine"
                    :style="{ '--h': hueOf(p) }"
                    @click="manageMine"
                  >
                    <span class="bp-mine-mode">{{ ACCESS_ICONS[p.access || 'glasshouse'] }}</span>
                    <span class="bp-mine-name">{{ p.name }}</span>
                    <span class="bp-mine-sub">
                      {{ t('browse.modes.' + (p.access || 'glasshouse') + '.name') }} ·
                      {{ t('browse.modes.' + (p.access || 'glasshouse') + '.short') }}
                    </span>
                  </button>
                  <button class="bp-mine add" @click="manageMine">
                    <span class="bp-mine-mode">＋</span>
                    <span class="bp-mine-name">{{
                      myPublic.length ? t('browse.yoursManage') : t('browse.yoursEmpty')
                    }}</span>
                    <span class="bp-mine-sub">{{
                      t('browse.yoursPrivate', { n: store.projects.length - myPublic.length })
                    }}</span>
                  </button>
                </div>
              </section>
            </template>

            <!-- ── Results ─────────────────────────────────────────────── -->
            <section class="bp-results">
              <div class="bp-results-head">
                <h2>
                  <template v-if="!filtering">🌲 {{ t('browse.shelves.all') }}</template>
                  <template v-else-if="query.trim()">{{
                    t('browse.resultsFor', { n: results.length, q: query.trim() })
                  }}</template>
                  <template v-else>{{ t('browse.results', { n: results.length }) }}</template>
                </h2>
                <span v-if="activeCollection" class="bp-active-coll">
                  {{ activeCollection.emoji }} {{ collTitle(activeCollection) }}
                  <button @click="collectionId = null">×</button>
                </span>
                <button v-if="filtering" class="bp-clear" @click="clearAll">
                  {{ t('browse.clear') }}
                </button>
              </div>
              <TransitionGroup v-if="results.length" name="bgrid" tag="div" class="bp-grid">
                <template v-for="item in gridItems" :key="item.key">
                  <!-- Sponsored slot (free plans only) — card-shaped, in the flow -->
                  <AdSlot v-if="item.ad" placement="card" :seed="2" :exclude="['browse']" />
                  <BrowseCard
                    v-else
                    :project="item.h.project"
                    :author="profileById.get(item.h.project.authorId)"
                    :liked="signals.isLiked(item.h.project.id)"
                    :saved="signals.isSaved(item.h.project.id)"
                    :hits="item.h.people"
                    :delay="Math.min(item.i, 12) * 40"
                    @open="openProject($event, item.h.people)"
                    @like="signals.toggleLike"
                    @save="signals.toggleSave"
                    @author="openProfile"
                  />
                </template>
              </TransitionGroup>
              <div v-else class="bp-empty">
                <span class="bp-empty-art">🍂</span>
                <h3>{{ t('browse.emptyTitle') }}</h3>
                <p>{{ t('browse.emptyBody') }}</p>
                <button class="bp-clear" @click="clearAll">{{ t('browse.clear') }}</button>
              </div>
            </section>
          </div>
        </main>

        <Transition name="bd-modal">
          <BrowseDetail
            v-if="detailProject"
            :project="detailProject"
            :signals="signals"
            :highlight="detailHits"
            @close="detailId = null"
            @author="openProfile"
            @open="openProject"
            @search="searchTag"
          />
        </Transition>
        <Transition name="cp-drawer">
          <CreatorProfile
            v-if="profile"
            :profile="profile"
            :signals="signals"
            @close="profileId = null"
            @open="openProject"
          />
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, reactive, ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useMainStore } from '../store/index.js'
import { useI18n } from '../i18n'
import BrowseCard from './browse/BrowseCard.vue'
import BrowseDetail from './browse/BrowseDetail.vue'
import CreatorProfile from './browse/CreatorProfile.vue'
import AdSlot from './billing/AdSlot.vue'
import InkBackdrop from './ui/InkBackdrop.vue'
import { ACTIVITY, COLLECTIONS, PROFILES, PROJECTS } from './browse/browseData'
import {
  ACCESS_ICONS,
  ACCESS_MODES,
  CAPABILITIES,
  EMPTY_FILTERS,
  SORT_KEYS,
  can,
  matchesFilters,
  recommend,
  searchProjects,
  sortProjects
} from './browse/browseModel'
import { useBrowseSignals } from './browse/browseSignals'

const store = useMainStore()
const { t, locale } = useI18n()

const GENRES = ['all', 'anime', 'tv', 'history', 'dynasty', 'sitcom', 'myth']
const GENRE_ICON = {
  all: '✦',
  anime: '🍥',
  tv: '📺',
  history: '👑',
  dynasty: '🐉',
  sitcom: '🛋️',
  myth: '⚡'
}
const SIZES = ['any', 'cozy', 'clan', 'dynasty']
const LANGS = ['any', 'en', 'zh-Hans', 'zh-Hant', 'ja']
const SUGGESTIONS = ['Uchiha', '唐朝', 'Henry VIII', '@tudor_rose', '皆大歡喜', '慈禧', 'Zeus']

const profileById = new Map(PROFILES.map((p) => [p.id, p]))
const projectById = new Map(PROJECTS.map((p) => [p.id, p]))

// Deterministic decoration so the page paints the same every time.
const FIREFLIES = Array.from({ length: 18 }, (_, i) => {
  const r = (n) => ((Math.sin(i * 97.13 + n * 13.7) + 1) / 2) % 1
  return {
    i,
    style: {
      left: `${(r(1) * 100).toFixed(1)}%`,
      top: `${(r(2) * 100).toFixed(1)}%`,
      animationDelay: `${(r(3) * 8).toFixed(2)}s`,
      animationDuration: `${(7 + r(4) * 7).toFixed(2)}s`
    }
  }
})
const heroCrests = PROJECTS.slice(0, 10).map((p, i) => ({
  glyph: p.crest,
  style: {
    left: `${6 + ((i * 37) % 88)}%`,
    top: `${10 + ((i * 53) % 70)}%`,
    animationDelay: `${i * 0.7}s`,
    fontSize: `${22 + ((i * 7) % 18)}px`
  }
}))

// ── Viewer signals ───────────────────────────────────────────────────────────
// One store per account; follows sign-out / sign-in as a different user.
const signals = computed(() => useBrowseSignals(store.authUser?.id || 'guest'))

// ── Query, filters, sort ─────────────────────────────────────────────────────
const query = ref('')
const filters = reactive({ ...EMPTY_FILTERS, access: [] })
const collectionId = ref(null)
const sortBy = ref(readPref('browse:sort', 'forYou'))
watch(sortBy, (v) => writePref('browse:sort', v))

function readPref(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v && SORT_KEYS.includes(v) ? v : fallback
  } catch {
    return fallback
  }
}
function writePref(key, v) {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* ignore */
  }
}

const activeCollection = computed(
  () => COLLECTIONS.find((c) => c.id === collectionId.value) || null
)
const filtering = computed(
  () =>
    !!query.value.trim() ||
    filters.genre !== 'all' ||
    filters.access.length > 0 ||
    filters.size !== 'any' ||
    filters.lang !== 'any' ||
    !!collectionId.value
)

const ownText = computed(() =>
  store.projects.map((p) => `${p.name} ${p.description || ''}`).join(' ')
)
const signalInput = computed(() => ({
  liked: signals.value.state.liked,
  saved: signals.value.state.saved,
  viewed: signals.value.state.viewed,
  followed: signals.value.state.followed,
  grafted: Object.keys(signals.value.state.grafts),
  locale: locale.value,
  ownText: ownText.value
}))
const recs = computed(() => recommend(PROJECTS, signalInput.value, 8))
const forYouScores = computed(() => {
  const all = recommend(PROJECTS, { ...signalInput.value, liked: [], grafted: [] }, PROJECTS.length)
  return new Map(all.map((r) => [r.project.id, r.score]))
})

const searchHits = computed(() => searchProjects(PROJECTS, PROFILES, query.value))
const inCollection = (p) =>
  !activeCollection.value || activeCollection.value.projectIds.includes(p.id)

const results = computed(() => {
  const hits = searchHits.value.filter(
    (h) => matchesFilters(h.project, filters) && inCollection(h.project)
  )
  if (query.value.trim() && sortBy.value === 'forYou') return hits // relevance order
  const hitOf = new Map(hits.map((h) => [h.project.id, h]))
  return sortProjects(
    hits.map((h) => h.project),
    sortBy.value,
    forYouScores.value
  ).map((p) => hitOf.get(p.id))
})

// One sponsored card joins the grid after the 6th tree (free plans only).
const AD_AFTER = 6
const gridItems = computed(() => {
  const items = results.value.map((h, i) => ({ key: h.project.id, h, i }))
  if (!store.adFree && items.length > AD_AFTER) items.splice(AD_AFTER, 0, { key: '__ad', ad: true })
  return items
})

// Facet counts honour every other active filter.
function genreCount(g) {
  return searchHits.value.filter(
    (h) => matchesFilters(h.project, { ...filters, genre: g }) && inCollection(h.project)
  ).length
}
function modeCount(m) {
  return searchHits.value.filter(
    (h) => matchesFilters(h.project, { ...filters, access: [m] }) && inCollection(h.project)
  ).length
}
function toggleAccess(m) {
  const i = filters.access.indexOf(m)
  if (i === -1) filters.access.push(m)
  else filters.access.splice(i, 1)
}

function clearQuery() {
  query.value = ''
}
function clearAll() {
  query.value = ''
  Object.assign(filters, { ...EMPTY_FILTERS, access: [] })
  collectionId.value = null
}

// Rotating placeholder: cycle through suggestions while the box is empty.
const phIdx = ref(0)
const placeholder = computed(() =>
  searchFocused.value
    ? t('browse.searchPh')
    : `${t('browse.searchPh')}  —  ${SUGGESTIONS[phIdx.value]}`
)
const searchFocused = ref(false)

// ── Shelves ──────────────────────────────────────────────────────────────────
const creators = computed(() =>
  [...PROFILES].sort(
    (a, b) =>
      Number(signals.value.isFollowing(a.id)) - Number(signals.value.isFollowing(b.id)) ||
      b.followers - a.followers
  )
)
function treesBy(id) {
  return PROJECTS.filter((p) => p.authorId === id)
}
const myPublic = computed(() => store.projects.filter((p) => p.visibility === 'public'))
function hueOf(p) {
  if (p.hue != null) return p.hue
  let h = 0
  for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}
function collTitle(c) {
  return c.title[locale.value] || c.title.en
}
function reasonText(r) {
  switch (r.kind) {
    case 'because':
      return t('browse.reasons.because', { title: projectById.get(r.ref)?.title })
    case 'creator':
      return t('browse.reasons.creator', { name: profileById.get(r.ref)?.displayName })
    case 'yours':
      return t('browse.reasons.yours', { word: r.ref })
    case 'lang':
      return t('browse.reasons.lang')
    default:
      return t('browse.reasons.trending')
  }
}
function compactNum(n) {
  return new Intl.NumberFormat(locale.value, {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(n)
}

// ── Dialogs ──────────────────────────────────────────────────────────────────
const detailId = ref(null)
const detailHits = ref([])
const profileId = ref(null)
const detailProject = computed(() => (detailId.value ? projectById.get(detailId.value) : null))
const profile = computed(() => (profileId.value ? profileById.get(profileId.value) : null))

function openProject(id, hits = []) {
  profileId.value = null
  detailHits.value = Array.isArray(hits) ? hits : []
  detailId.value = id
}
function openProfile(id) {
  profileId.value = id
}
function openCollection(id) {
  collectionId.value = id
  nextTick(() =>
    document.querySelector('.bp-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  )
}
function searchTag(tag) {
  detailId.value = null
  query.value = tag
  scrollRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

// Sharing settings live on the Projects page (edit details → visibility).
function manageMine() {
  store.toggleBrowsePage(false)
  store.toggleProjectsPage(true)
}

const rolling = ref(false)
function surprise() {
  if (rolling.value) return
  const pool = (results.value.length ? results.value.map((h) => h.project) : PROJECTS).filter(
    (p) => p.id !== detailId.value
  )
  const pick = pool[Math.floor(Math.random() * pool.length)]
  rolling.value = true
  setTimeout(() => {
    rolling.value = false
    if (pick) openProject(pick.id)
  }, 650)
}

function close() {
  store.toggleBrowsePage(false)
}

// ── Activity ticker ──────────────────────────────────────────────────────────
const tickIdx = ref(0)
const tickLine = computed(() => {
  const [who, verb, pid] = ACTIVITY[tickIdx.value % ACTIVITY.length]
  const p = profileById.get(who)
  return {
    avatar: p.avatar,
    name: p.displayName,
    verb: t('browse.activity.' + verb),
    title: projectById.get(pid).title,
    projectId: pid
  }
})
let timer = null
function startTimers() {
  stopTimers()
  timer = setInterval(() => {
    tickIdx.value++
    if (!query.value) phIdx.value = (phIdx.value + 1) % SUGGESTIONS.length
  }, 3600)
}
function stopTimers() {
  if (timer) clearInterval(timer)
  timer = null
}

// ── Open / close & keys ──────────────────────────────────────────────────────
const scrollRef = ref(null)
const searchRef = ref(null)
watch(
  () => store.browsePageOpen,
  async (open) => {
    if (!open) {
      stopTimers()
      return
    }
    detailId.value = null
    profileId.value = null
    startTimers()
    await nextTick()
    scrollRef.value?.scrollTo({ top: 0 })
  },
  { immediate: true }
)

function onKeydown(e) {
  if (!store.browsePageOpen || store.curtain.active) return
  const el = e.target
  const typing =
    el &&
    (el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      el.isContentEditable)
  if (e.key === 'Escape') {
    if (profileId.value) profileId.value = null
    else if (detailId.value) detailId.value = null
    else if (!typing) close()
    return
  }
  if (e.key === '/' && !typing && !detailId.value && !profileId.value) {
    e.preventDefault()
    searchRef.value?.focus()
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  stopTimers()
})
</script>

<style scoped>
.bp-root {
  position: fixed;
  inset: 0;
  z-index: 240;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  overflow: hidden;
}

/* ── Canopy (ambient) ─────────────────────────────────────────────────────── */
.bp-canopy {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.bp-pool {
  position: absolute;
  width: 55vmax;
  height: 55vmax;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.22;
  animation: bp-drift 26s ease-in-out infinite alternate;
}
.bp-pool.a {
  left: -15vmax;
  top: -20vmax;
  background: radial-gradient(circle, var(--accent), transparent 65%);
}
.bp-pool.b {
  right: -20vmax;
  top: 10vmax;
  background: radial-gradient(circle, var(--green), transparent 65%);
  animation-delay: -8s;
}
.bp-pool.c {
  left: 25vmax;
  bottom: -30vmax;
  background: radial-gradient(circle, var(--accent-2), transparent 65%);
  animation-delay: -16s;
}
@keyframes bp-drift {
  to {
    transform: translate(6vmax, 4vmax) scale(1.12);
  }
}
.bp-fly {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--amber);
  box-shadow: 0 0 10px 3px rgba(245, 166, 35, 0.45);
  opacity: 0;
  animation: bp-fly 10s ease-in-out infinite;
}
@keyframes bp-fly {
  0%,
  100% {
    opacity: 0;
    transform: translate(0, 0);
  }
  20% {
    opacity: 0.8;
  }
  50% {
    opacity: 0.35;
    transform: translate(30px, -40px);
  }
  80% {
    opacity: 0.7;
    transform: translate(-20px, -70px);
  }
}

/* ── Top bar ──────────────────────────────────────────────────────────────── */
.bp-topbar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border);
  background: var(--glass-strong);
  backdrop-filter: blur(14px);
}
.bp-back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border-radius: var(--r-pill);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--t1);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}
.bp-back:hover .bp-back-arrow {
  transform: translateX(-3px);
}
.bp-back-arrow {
  transition: transform 0.2s var(--ease-out);
}
.bp-brand {
  font-weight: 900;
  font-size: 15px;
  color: var(--t1);
  white-space: nowrap;
}
.bp-ticker {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: center;
}
.bp-tick {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 5px 12px;
  border-radius: var(--r-pill);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--t2);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bp-tick b {
  color: var(--t1);
}
.bp-tick em {
  color: var(--accent);
  font-style: normal;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bp-tick-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 0 0 rgba(76, 175, 114, 0.6);
  animation: bp-live 1.8s ease-out infinite;
  flex-shrink: 0;
}
@keyframes bp-live {
  70% {
    box-shadow: 0 0 0 7px rgba(76, 175, 114, 0);
  }
}
.tick-enter-active,
.tick-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.35s var(--ease-out);
}
.tick-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.tick-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
.bp-surprise {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: var(--r-pill);
  border: none;
  color: var(--on-accent);
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: var(--glow);
  white-space: nowrap;
  transition: transform 0.2s var(--ease-spring);
}
.bp-surprise:hover {
  transform: translateY(-1px) scale(1.03);
}
.bp-dice {
  display: inline-block;
}
.bp-surprise.rolling .bp-dice {
  animation: bp-roll 0.65s var(--ease-out);
}
@keyframes bp-roll {
  to {
    transform: rotate(720deg) scale(1.3);
  }
}

/* ── Scroll + content ─────────────────────────────────────────────────────── */
.bp-scroll {
  position: relative;
  z-index: 1;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
.bp-content {
  max-width: 1320px;
  margin: 0 auto;
  padding: 0 28px 60px;
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */
.bp-hero {
  position: relative;
  text-align: center;
  padding: 46px 0 26px;
}
.bp-hero-crests {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.bp-hero-crests span {
  position: absolute;
  opacity: 0.16;
  animation: bp-bob 7s ease-in-out infinite;
  filter: saturate(0.8);
}
@keyframes bp-bob {
  50% {
    transform: translateY(-14px) rotate(8deg);
    opacity: 0.28;
  }
}
.bp-eyebrow {
  position: relative;
  margin: 0;
  font-size: 11.5px;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
}
.bp-title {
  position: relative;
  margin: 8px 0 0;
  font-size: clamp(30px, 5vw, 54px);
  font-weight: 900;
  letter-spacing: -0.02em;
  line-height: 1.05;
  background: linear-gradient(120deg, var(--t1) 20%, var(--accent) 55%, var(--accent-2) 80%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.bp-subtitle {
  position: relative;
  max-width: 640px;
  margin: 12px auto 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--t2);
}
.bp-search {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 680px;
  margin: 24px auto 0;
  padding: 6px 8px 6px 18px;
  border-radius: var(--r-pill);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow);
  transition:
    box-shadow 0.25s ease,
    transform 0.25s var(--ease-out);
}
.bp-search.focused {
  box-shadow:
    var(--shadow-lg),
    0 0 0 4px rgba(var(--accent-rgb), 0.22);
  transform: translateY(-1px);
}
.bp-search-icon {
  font-size: 17px;
}
.bp-search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--t1);
  font-size: 16px;
  padding: 10px 0;
  font-family: var(--font);
}
.bp-search-input::placeholder {
  color: var(--t3);
}
.bp-search-clear {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: var(--elevated);
  color: var(--t2);
  font-size: 18px;
  cursor: pointer;
}
.bp-kbd {
  margin-right: 8px;
}
.bp-try {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  font-size: 12px;
  color: var(--t3);
}
.bp-try-chip {
  padding: 4px 11px;
  border-radius: var(--r-pill);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--t2);
  font-size: 12px;
  cursor: pointer;
  transition:
    color var(--dur) ease,
    border-color var(--dur) ease,
    transform 0.2s var(--ease-spring);
}
.bp-try-chip:hover {
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.5);
  transform: translateY(-1px);
}
.bp-mock-note {
  position: relative;
  margin: 14px 0 0;
  font-size: 11.5px;
  color: var(--t3);
}

/* ── Ladder ───────────────────────────────────────────────────────────────── */
.bp-ladder {
  margin-top: 10px;
  padding: 18px;
  border-radius: var(--r-xl);
  background: var(--glass-soft);
  border: 1px solid var(--border);
  backdrop-filter: blur(10px);
}
.bp-ladder-head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 900;
  color: var(--t1);
}
.bp-ladder-head p {
  margin: 4px 0 0;
  font-size: 12.5px;
  color: var(--t2);
}
.bp-ladder-steps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 14px;
}
.bp-step {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 14px 14px 12px;
  border-radius: var(--r-lg);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--t1);
  cursor: pointer;
  text-align: left;
  overflow: hidden;
  /* Each rung sits a little higher than the last — a literal ladder. */
  transform: translateY(calc((3 - var(--i)) * 4px));
  transition:
    transform 0.3s var(--ease-spring),
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}
.bp-step::after {
  content: '';
  position: absolute;
  inset: auto 0 0 0;
  height: 3px;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  transform: scaleX(calc((var(--i) + 1) / 4));
  transform-origin: left;
  opacity: 0.55;
}
.bp-step:hover {
  transform: translateY(calc((3 - var(--i)) * 4px - 3px));
  box-shadow: var(--shadow);
}
.bp-step.on {
  border-color: var(--accent);
  background: var(--adim);
  box-shadow: var(--glow);
}
.bp-step-icon {
  font-size: 26px;
  transition: transform 0.35s var(--ease-spring);
}
.bp-step:hover .bp-step-icon {
  transform: scale(1.18) rotate(-8deg);
}
.bp-step-name {
  font-size: 15px;
  font-weight: 900;
}
.bp-step-short {
  font-size: 12px;
  color: var(--t2);
}
.bp-step-pips {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}
.bp-step-pips i {
  width: 18px;
  height: 5px;
  border-radius: 3px;
  background: var(--elevated);
  box-shadow: inset 0 0 0 1px var(--border-strong);
}
.bp-step-pips i.ok {
  background: var(--green);
  box-shadow: none;
}
.bp-step-count {
  position: absolute;
  top: 12px;
  right: 12px;
  font-size: 11px;
  font-weight: 800;
  color: var(--t2);
  background: var(--elevated);
  border-radius: var(--r-pill);
  padding: 1px 8px;
}

/* ── Filters ──────────────────────────────────────────────────────────────── */
.bp-filters {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 18px -28px 0;
  padding: 12px 28px;
  background: var(--glass-strong);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border);
}
.bp-genres {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.bp-genre {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--r-pill);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--t2);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition:
    background var(--dur) ease,
    color var(--dur) ease,
    border-color var(--dur) ease;
}
.bp-genre:hover {
  color: var(--t1);
  background: var(--hover);
}
.bp-genre.on {
  color: var(--on-accent);
  background: var(--accent);
  border-color: var(--accent);
}
.bp-genre-n {
  font-size: 10.5px;
  opacity: 0.75;
}
.bp-filter-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.bp-seg {
  display: inline-flex;
  padding: 3px;
  border-radius: var(--r-pill);
  background: var(--elevated);
  border: 1px solid var(--border);
}
.bp-seg-btn {
  padding: 5px 11px;
  border: none;
  border-radius: var(--r-pill);
  background: transparent;
  color: var(--t2);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.bp-seg-btn.on {
  background: var(--surface);
  color: var(--accent);
  box-shadow: var(--shadow-sm);
}
.bp-select {
  width: auto;
  padding: 7px 10px;
  border-radius: var(--r-pill);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--t1);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  outline: none;
}
.bp-select.bare {
  border: none;
  background: transparent;
  padding-left: 2px;
}
.bp-sort {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding-left: 12px;
  border-radius: var(--r-pill);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--t2);
  font-size: 13px;
}

/* ── Shelves ──────────────────────────────────────────────────────────────── */
.bp-shelf {
  margin-top: 30px;
}
.bp-ad-banner {
  margin-top: 30px;
}
.bp-shelf-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.bp-shelf-head h2,
.bp-results-head h2 {
  margin: 0;
  font-size: 19px;
  font-weight: 900;
  color: var(--t1);
}
.bp-shelf-head p {
  margin: 0;
  font-size: 12.5px;
  color: var(--t2);
}
.bp-row {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 232px;
  gap: 14px;
  overflow-x: auto;
  padding: 6px 4px 14px;
  margin: 0 -4px;
  scroll-snap-type: x proximity;
}
.bp-row > * {
  scroll-snap-align: start;
}

.bp-collections {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
}
.bp-coll {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-height: 128px;
  padding: 14px;
  border-radius: var(--r-lg);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
  text-align: left;
  overflow: hidden;
  background:
    radial-gradient(90% 120% at 100% 0%, hsl(calc(var(--h) + 40) 75% 50% / 0.55), transparent 60%),
    linear-gradient(140deg, hsl(var(--h) 55% 18%), hsl(calc(var(--h) + 30) 50% 12%));
  box-shadow: var(--shadow-sm);
  animation: bc-rise 0.5s var(--ease-out) both;
  animation-delay: calc(var(--i) * 50ms);
  transition:
    transform 0.3s var(--ease-spring),
    box-shadow 0.25s ease;
}
@keyframes bc-rise {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}
.bp-coll:hover {
  transform: translateY(-4px) rotate(-0.6deg);
  box-shadow: var(--shadow-lg);
}
.bp-coll-emoji {
  font-size: 28px;
}
.bp-coll-title {
  font-size: 15px;
  font-weight: 900;
}
.bp-coll-n {
  font-size: 11.5px;
  opacity: 0.75;
}
.bp-coll-stack {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: flex;
}
.bp-coll-crest {
  width: 30px;
  height: 30px;
  margin-left: -9px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 15px;
  background: hsl(var(--ch) 50% 20%);
  border: 2px solid rgba(255, 255, 255, 0.25);
  transition: transform 0.3s var(--ease-spring);
  transition-delay: calc(var(--j) * 30ms);
}
.bp-coll:hover .bp-coll-crest {
  transform: translateY(-6px);
}

.bp-creator {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 18px 14px 14px;
  border-radius: var(--r-lg);
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  text-align: center;
  overflow: hidden;
  animation: bc-rise 0.5s var(--ease-out) both;
  animation-delay: var(--d);
  transition:
    transform 0.25s var(--ease-out),
    box-shadow 0.25s ease;
}
.bp-creator::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 54px;
  background: linear-gradient(
    120deg,
    hsl(var(--h) 65% 50% / 0.35),
    hsl(calc(var(--h) + 50) 65% 55% / 0.2)
  );
}
.bp-creator:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow);
}
.bp-creator-av {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 28px;
  background: var(--surface);
  box-shadow:
    0 0 0 3px var(--surface),
    0 0 0 5px hsl(var(--h) 65% 55% / 0.55);
  transition: transform 0.35s var(--ease-spring);
}
.bp-creator:hover .bp-creator-av {
  transform: rotate(-10deg) scale(1.08);
}
.bp-creator-name {
  margin-top: 6px;
  font-size: 14px;
  font-weight: 800;
  color: var(--t1);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bp-creator-handle {
  font-size: 11.5px;
  color: var(--t2);
}
.bp-creator-crests {
  display: flex;
  gap: 4px;
  font-size: 16px;
  margin-top: 4px;
}
.bp-creator-meta {
  font-size: 11px;
  color: var(--t3);
}
.bp-creator-follow {
  margin-top: 8px;
  padding: 6px 14px;
  border-radius: var(--r-pill);
  border: 1px solid rgba(var(--accent-rgb), 0.5);
  background: var(--adim);
  color: var(--accent);
  font-weight: 800;
  font-size: 12px;
  cursor: pointer;
}
.bp-creator-follow.on {
  border-color: var(--border);
  background: var(--elevated);
  color: var(--t2);
}

.bp-yours {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.bp-mine {
  display: grid;
  grid-template-columns: 40px 1fr;
  grid-template-rows: auto auto;
  column-gap: 10px;
  align-items: center;
  padding: 12px 14px;
  border-radius: var(--r-lg);
  border: 1px solid var(--border);
  background:
    linear-gradient(120deg, hsl(var(--h, 220) 60% 50% / 0.12), transparent 70%), var(--surface);
  color: var(--t1);
  cursor: pointer;
  text-align: left;
  transition: transform 0.25s var(--ease-out);
}
.bp-mine:hover {
  transform: translateY(-2px);
}
.bp-mine.add {
  border-style: dashed;
  background: transparent;
}
.bp-mine-mode {
  grid-row: span 2;
  width: 40px;
  height: 40px;
  border-radius: var(--r-md);
  display: grid;
  place-items: center;
  font-size: 20px;
  background: var(--elevated);
}
.bp-mine-name {
  font-weight: 800;
  font-size: 13.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bp-mine-sub {
  font-size: 11.5px;
  color: var(--t2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Results ──────────────────────────────────────────────────────────────── */
.bp-results {
  margin-top: 34px;
  scroll-margin-top: 80px;
}
.bp-results-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}
.bp-active-coll {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px 4px 12px;
  border-radius: var(--r-pill);
  background: var(--adim);
  color: var(--t1);
  font-size: 12.5px;
  font-weight: 700;
}
.bp-active-coll button {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: var(--surface);
  color: var(--t2);
  cursor: pointer;
}
.bp-clear {
  margin-left: auto;
  padding: 6px 14px;
  border-radius: var(--r-pill);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--t2);
  font-weight: 700;
  font-size: 12.5px;
  cursor: pointer;
}
.bp-clear:hover {
  color: var(--accent);
}
.bp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  gap: 18px;
}
.bgrid-move {
  transition: transform 0.4s var(--ease-out);
}
/* Filtered-out cards leave at once: the survivors glide (bgrid-move) and new
   ones rise in. No leave animation — the card's own entrance animation would
   otherwise make Vue wait for an animationend that never comes. */
.bgrid-leave-active {
  display: none;
  animation: none;
  transition: none;
}
.bp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 60px 20px;
  text-align: center;
  color: var(--t2);
}
.bp-empty-art {
  font-size: 56px;
  animation: bp-fall 3s ease-in-out infinite;
}
@keyframes bp-fall {
  50% {
    transform: translateY(8px) rotate(24deg);
  }
}
.bp-empty h3 {
  margin: 6px 0 0;
  color: var(--t1);
}
.bp-empty p {
  margin: 0 0 8px;
  font-size: 13px;
}
.bp-empty .bp-clear {
  margin-left: 0;
}

/* ── Page & dialog transitions ────────────────────────────────────────────── */
.bpage-enter-active {
  transition:
    opacity 0.32s ease,
    transform 0.42s var(--ease-out);
}
.bpage-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}
.bpage-enter-from {
  opacity: 0;
  transform: translateY(24px) scale(0.99);
}
.bpage-leave-to {
  opacity: 0;
  transform: scale(1.015);
}
.bd-modal-enter-active,
.bd-modal-leave-active {
  transition: opacity 0.25s ease;
}
.bd-modal-enter-active :deep(.bd-panel),
.bd-modal-leave-active :deep(.bd-panel) {
  transition: transform 0.35s var(--ease-out);
}
.bd-modal-enter-from,
.bd-modal-leave-to {
  opacity: 0;
}
.bd-modal-enter-from :deep(.bd-panel) {
  transform: translateY(30px) scale(0.97);
}
.bd-modal-leave-to :deep(.bd-panel) {
  transform: scale(0.98);
}
.cp-drawer-enter-active,
.cp-drawer-leave-active {
  transition: opacity 0.25s ease;
}
.cp-drawer-enter-active :deep(.cp-drawer),
.cp-drawer-leave-active :deep(.cp-drawer) {
  transition: transform 0.35s var(--ease-out);
}
.cp-drawer-enter-from,
.cp-drawer-leave-to {
  opacity: 0;
}
.cp-drawer-enter-from :deep(.cp-drawer),
.cp-drawer-leave-to :deep(.cp-drawer) {
  transform: translateX(100%);
}

@media (max-width: 900px) {
  .bp-ladder-steps {
    grid-template-columns: repeat(2, 1fr);
  }
  .bp-step {
    transform: none;
  }
  .bp-ticker {
    display: none;
  }
}
@media (max-width: 640px) {
  .bp-topbar {
    padding: 10px 16px;
    gap: 8px;
  }
  .bp-brand {
    display: none;
  }
  .bp-surprise {
    margin-left: auto;
  }
  .bp-content {
    padding: 0 16px 40px;
  }
  .bp-filters {
    margin: 14px -16px 0;
    padding: 10px 16px;
  }
  .bp-genres {
    flex-wrap: nowrap;
    overflow-x: auto;
    width: 100%;
    padding-bottom: 2px;
  }
  .bp-genre {
    flex-shrink: 0;
  }
  .bp-hero {
    padding-top: 28px;
  }
  .bp-grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bp-pool,
  .bp-fly,
  .bp-hero-crests span,
  .bp-empty-art,
  .bp-tick-dot {
    animation: none;
  }
}

/* ── 水墨 ink theme ───────────────────────────────────────────────────────
   The community forest as an album of paintings on rice paper (<InkBackdrop>
   replaces the canopy and fireflies). Collections become hue-tinted washes,
   panels sit in narrow silk mounts, the hero title is brushed. */
:root[data-theme='ink'] .bp-canopy,
:root[data-theme='ink'] .bp-hero-crests {
  display: none;
}
:root[data-theme='ink'] .bp-topbar {
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  border-bottom-color: rgba(48, 36, 20, 0.16);
  backdrop-filter: none;
}
:root[data-theme='ink'] .bp-back,
:root[data-theme='ink'] .bp-tick,
:root[data-theme='ink'] .bp-try-chip,
:root[data-theme='ink'] .bp-genre,
:root[data-theme='ink'] .bp-seg,
:root[data-theme='ink'] .bp-seg-btn,
:root[data-theme='ink'] .bp-select,
:root[data-theme='ink'] .bp-clear,
:root[data-theme='ink'] .bp-active-coll,
:root[data-theme='ink'] .bp-creator-follow,
:root[data-theme='ink'] .bp-mine {
  border-radius: 3px 5px 4px 6px / 5px 3px 6px 4px;
  font-family: var(--font-ink-label);
}
:root[data-theme='ink'] .bp-brand {
  font-family: var(--font-brush);
  font-size: 19px;
  font-weight: 400;
}
:root[data-theme='ink'] .bp-surprise {
  border-radius: 2px 4px 3px 5px / 4px 2px 5px 3px;
  background:
    var(--ink-paper-light, none) center / 256px 256px,
    var(--accent);
  background-blend-mode: multiply, normal;
  box-shadow: inset 0 0 0 1px rgba(90, 15, 10, 0.3);
  font-family: var(--font-ink-label);
  color: var(--on-accent);
}
:root[data-theme='ink'] .bp-eyebrow {
  font-family: var(--font-ink-label);
  font-weight: 600;
  font-variant: small-caps;
  text-transform: lowercase;
  letter-spacing: 0.14em;
  font-size: 13px;
}
:root[data-theme='ink'] .bp-title {
  font-family: var(--font-brush);
  font-weight: 400;
  font-size: clamp(40px, 6vw, 66px);
  letter-spacing: 0.01em;
  background: none;
  color: var(--t1);
}
:root[data-theme='ink'] .bp-subtitle {
  font-size: 16px;
  font-style: italic;
}
:root[data-theme='ink'] .bp-search {
  border-radius: 3px;
  border-color: var(--ink-mount-line);
  background: rgba(255, 251, 240, 0.8);
  box-shadow:
    0 0 0 3px var(--ink-silk),
    0 0 0 4px rgba(58, 42, 22, 0.2),
    var(--shadow);
}
:root[data-theme='ink'] .bp-search.focused {
  box-shadow:
    0 0 0 3px var(--ink-silk),
    0 0 0 4px rgba(179, 53, 42, 0.45),
    var(--shadow-lg);
}
:root[data-theme='ink'] .bp-search-input {
  font-size: 17px;
  background: none;
  box-shadow: none;
}
:root[data-theme='ink'] .bp-search-icon,
:root[data-theme='ink'] .bp-step-icon,
:root[data-theme='ink'] .bp-coll-emoji,
:root[data-theme='ink'] .bp-dice,
:root[data-theme='ink'] .bp-empty-art {
  filter: grayscale(1) sepia(0.4) contrast(1.1);
}
:root[data-theme='ink'] .bp-ladder {
  border-radius: 2px;
  border-color: var(--ink-mount-line);
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow:
    0 0 0 3px var(--ink-silk),
    0 0 0 4px rgba(58, 42, 22, 0.2),
    0 8px 20px rgba(60, 40, 15, 0.12);
}
:root[data-theme='ink'] .bp-ladder-head h2,
:root[data-theme='ink'] .bp-shelf-head h2,
:root[data-theme='ink'] .bp-results-head h2,
:root[data-theme='ink'] .bp-empty h3 {
  font-family: var(--font-brush);
  font-size: 22px;
  font-weight: 400;
}
:root[data-theme='ink'] .bp-step {
  border-radius: 2px;
  background: rgba(255, 251, 240, 0.6);
  border-color: rgba(48, 36, 20, 0.18);
}
:root[data-theme='ink'] .bp-step::after {
  height: 5px;
  background: var(--accent);
  -webkit-mask: var(--ink-underline) center / 100% 100% no-repeat;
  mask: var(--ink-underline) center / 100% 100% no-repeat;
}
:root[data-theme='ink'] .bp-step.on {
  background: rgba(179, 53, 42, 0.06);
  box-shadow: inset 0 0 0 1px rgba(179, 53, 42, 0.3);
}
:root[data-theme='ink'] .bp-step-name {
  font-family: var(--font-brush);
  font-size: 17px;
  font-weight: 400;
}
:root[data-theme='ink'] .bp-step-pips i {
  border-radius: 1px;
}
:root[data-theme='ink'] .bp-filters {
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  backdrop-filter: none;
  border-color: rgba(48, 36, 20, 0.16);
}
:root[data-theme='ink'] .bp-genre.on {
  background: var(--accent);
  border-color: transparent;
  color: var(--on-accent);
}
/* collections: a pale wash of their hue on paper, brushed titles */
:root[data-theme='ink'] .bp-coll {
  border-radius: 2px;
  border: 1px solid var(--ink-mount-line);
  color: var(--t1);
  background:
    radial-gradient(90% 120% at 100% 0%, hsl(var(--h) 35% 50% / 0.22), transparent 62%),
    radial-gradient(80% 90% at 0% 100%, hsl(calc(var(--h) + 30) 25% 40% / 0.12), transparent 60%),
    var(--ink-sheet), var(--surface);
  background-size:
    100% 100%,
    100% 100%,
    512px 512px;
  box-shadow:
    0 0 0 3px var(--ink-silk),
    0 0 0 4px rgba(58, 42, 22, 0.2),
    var(--shadow-sm);
}
:root[data-theme='ink'] .bp-coll-title {
  font-family: var(--font-brush);
  font-size: 19px;
  font-weight: 400;
}
:root[data-theme='ink'] .bp-coll-crest {
  border-radius: 3px;
  background: var(--surface);
  border-color: rgba(48, 36, 20, 0.25);
  filter: grayscale(0.7) sepia(0.3);
}
:root[data-theme='ink'] .bp-creator {
  border-radius: 2px;
  border-color: var(--ink-mount-line);
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow:
    0 0 0 3px var(--ink-silk),
    0 0 0 4px rgba(58, 42, 22, 0.2),
    0 8px 20px rgba(60, 40, 15, 0.12);
}
:root[data-theme='ink'] .bp-creator::before {
  opacity: 0.35;
}
:root[data-theme='ink'] .bp-creator-av {
  border-radius: 4px 6px 3px 7px / 6px 3px 7px 4px;
}
:root[data-theme='ink'] .bp-creator-name,
:root[data-theme='ink'] .bp-mine-name {
  font-family: var(--font-brush);
  font-size: 17px;
  font-weight: 400;
}
:root[data-theme='ink'] .bp-mine {
  background: rgba(255, 251, 240, 0.55);
}
</style>
