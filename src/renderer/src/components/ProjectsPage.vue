<template>
  <Teleport to="body">
    <Transition name="ppage">
      <div v-if="store.projectsPageOpen && store.authUser" class="pp-root">
        <!-- Living night sky: parallax starfield + shooting stars (canvas) -->
        <canvas ref="skyRef" class="pp-sky"></canvas>
        <div class="pp-aurora">
          <div class="pp-blob pp-blob-a"></div>
          <div class="pp-blob pp-blob-b"></div>
          <div class="pp-blob pp-blob-c"></div>
        </div>
        <!-- 水墨 ink theme: paper, hills and a 天地 watermark instead of the sky -->
        <InkBackdrop watermark="天地" />

        <header class="pp-topbar">
          <button class="pp-back" @click="close">
            <UiIcon class="pp-back-arrow" name="arrow-left" :size="16" />
            {{ t('projectsPage.back') }}
          </button>
          <div class="pp-topbar-spacer"></div>
          <div
            v-if="store.authUsage"
            class="pp-quota"
            :title="t('projectsPage.quota', { used: quota.used, max: quota.max })"
          >
            <svg viewBox="0 0 32 32" class="pp-quota-ring">
              <circle class="pp-quota-track" cx="16" cy="16" r="13" />
              <circle
                class="pp-quota-fill"
                :class="{ warn: quota.ratio > 0.85 }"
                cx="16"
                cy="16"
                r="13"
                :style="{ strokeDashoffset: 81.7 * (1 - Math.min(1, quota.ratio)) }"
              />
            </svg>
            <span class="pp-quota-label">{{ quota.used }}/{{ quota.max }}</span>
          </div>
          <button class="pp-new" @click="newProject">
            <UiIcon class="pp-new-plus" name="plus" :size="16" :stroke="2.4" />
            {{ t('projectsPage.new') }}
          </button>
        </header>

        <main class="pp-scroll">
          <div class="pp-content">
            <!-- ── Hero ─────────────────────────────────────────────────── -->
            <section class="pp-hero">
              <h1 class="pp-title">{{ t('projectsPage.title') }}</h1>
              <p class="pp-subtitle">{{ t('projectsPage.subtitle') }}</p>
              <div class="pp-stats">
                <div
                  v-for="(s, i) in heroStats"
                  :key="s.key"
                  class="pp-stat"
                  :style="{ '--d': 120 + i * 90 + 'ms' }"
                >
                  <span class="pp-stat-num">{{ s.shown }}</span>
                  <span class="pp-stat-label">{{ s.label }}</span>
                </div>
              </div>
            </section>

            <!-- ── Toolbar: search / filters / sort / view ──────────────── -->
            <div class="pp-toolbar">
              <SearchField
                v-model="query"
                class="pp-search"
                size="sm"
                :placeholder="t('projectsPage.searchPh')"
              />
              <div class="pp-chips">
                <button
                  v-for="f in FILTERS"
                  :key="f.key"
                  class="pp-chip"
                  :class="{ active: filter === f.key }"
                  @click="filter = f.key"
                >
                  <UiIcon class="pp-chip-icon" :name="f.icon" :size="14" />
                  {{ t('projectsPage.filters.' + f.key) }}
                  <span class="pp-chip-n">{{ countFor(f.key) }}</span>
                </button>
              </div>
              <div class="pp-toolbar-right">
                <label class="pp-sort">
                  <UiIcon class="pp-sort-glyph" name="arrow-down-up" :size="16" />
                  <select v-model="sortBy" class="pp-sort-select">
                    <option v-for="s in SORTS" :key="s" :value="s">
                      {{ t('projectsPage.sort.' + s) }}
                    </option>
                  </select>
                </label>
                <div class="pp-viewtoggle" :class="{ list: layout === 'list' }">
                  <span class="pp-viewslider"></span>
                  <button
                    class="pp-viewbtn"
                    :class="{ on: layout === 'grid' }"
                    :title="t('projectsPage.view.grid')"
                    :aria-label="t('projectsPage.view.grid')"
                    @click="layout = 'grid'"
                  >
                    <UiIcon name="layout-grid" :size="14" />
                  </button>
                  <button
                    class="pp-viewbtn"
                    :class="{ on: layout === 'list' }"
                    :title="t('projectsPage.view.list')"
                    :aria-label="t('projectsPage.view.list')"
                    @click="layout = 'list'"
                  >
                    <UiIcon name="layout-list" :size="14" />
                  </button>
                </div>
              </div>
            </div>

            <!-- ── Card grid ────────────────────────────────────────────── -->
            <TransitionGroup v-if="layout === 'grid'" name="pgrid" tag="div" class="pp-grid">
              <article
                v-for="(p, i) in shown"
                :key="p.id"
                class="pp-card"
                :class="{
                  live: p.id === store.activeProjectId,
                  confirming: confirmId === p.id,
                  fav: p.favorite,
                  cloning: duplicatingId === p.id,
                  fresh: freshId === p.id
                }"
                :style="cardVars(p, i)"
                @pointermove="tiltMove"
                @pointerleave="tiltLeave"
                @click="openProject(p)"
              >
                <div class="pp-card-inner">
                  <!-- front -->
                  <div class="pp-face pp-front">
                    <div class="pp-const">
                      <svg :viewBox="'0 0 200 90'" preserveAspectRatio="xMidYMid slice">
                        <line
                          v-for="(e, li) in constellationOf(p).edges"
                          :key="'l' + li"
                          class="pp-const-line"
                          :x1="e.x1"
                          :y1="e.y1"
                          :x2="e.x2"
                          :y2="e.y2"
                          pathLength="1"
                          :style="{ animationDelay: 0.25 + li * 0.09 + 's' }"
                        />
                        <circle
                          v-for="(st, si) in constellationOf(p).stars"
                          :key="'s' + si"
                          class="pp-const-star"
                          :class="{ big: st.big }"
                          :cx="st.x"
                          :cy="st.y"
                          :r="st.r"
                          :style="{ animationDelay: st.tw + 's', animationDuration: st.dur + 's' }"
                        />
                      </svg>
                    </div>
                    <div class="pp-glare"></div>

                    <header class="pp-card-head">
                      <button
                        class="pp-star-btn"
                        :class="{ on: p.favorite, bursting: burstId === p.id }"
                        :title="t('projectsPage.favorite')"
                        :aria-label="t('projectsPage.favorite')"
                        :aria-pressed="!!p.favorite"
                        @click.stop="toggleFavorite(p)"
                      >
                        <UiIcon name="star" :size="16" />
                      </button>
                      <span v-if="renamingId !== p.id" class="pp-name">
                        {{ p.name }}
                      </span>
                      <input
                        v-else
                        ref="renameInputRef"
                        v-model="renameValue"
                        class="pp-rename"
                        @click.stop
                        @keydown.enter.stop="confirmRename(p)"
                        @keydown.escape.stop="cancelRename"
                        @blur="cancelRename"
                      />
                      <span v-if="p.id === store.activeProjectId" class="pp-live">
                        <span class="pp-live-dot"></span>{{ t('projectsPage.live') }}
                      </span>
                      <button
                        class="pp-kebab"
                        :title="t('projectsPage.actions')"
                        :aria-label="t('projectsPage.actions')"
                        @click.stop="toggleMenu(p.id)"
                      >
                        <UiIcon name="ellipsis" :size="16" />
                      </button>
                      <Transition name="pp-menu">
                        <div v-if="menuId === p.id" class="pp-menu" @click.stop>
                          <button class="pp-menu-item" @click="menuOpen(p)">
                            <UiIcon name="arrow-up-right" :size="14" />{{
                              t('projectsPage.menu.open')
                            }}
                          </button>
                          <button class="pp-menu-item" @click="menuRename(p)">
                            <UiIcon name="pencil" :size="14" />{{ t('projectsPage.menu.rename') }}
                          </button>
                          <button class="pp-menu-item" @click="openEdit(p)">
                            <UiIcon name="square-pen" :size="14" />{{ t('projectsPage.menu.edit') }}
                          </button>
                          <button class="pp-menu-item" @click="duplicate(p)">
                            <UiIcon name="copy" :size="14" />{{ t('projectsPage.menu.duplicate') }}
                          </button>
                          <button
                            class="pp-menu-item danger"
                            :disabled="cards.length <= 1"
                            @click="menuDelete(p)"
                          >
                            <UiIcon name="trash-2" :size="14" />{{ t('projectsPage.menu.delete') }}
                          </button>
                        </div>
                      </Transition>
                    </header>

                    <p class="pp-desc" :class="{ empty: !p.description }">
                      {{ p.description || t('projectsPage.noDesc') }}
                    </p>

                    <div class="pp-counts">
                      <span :title="t('account.usage.people')">
                        <UiIcon name="users" :size="14" />
                        {{ p.counts.persons }}
                      </span>
                      <span :title="t('rail.relationships')">
                        <UiIcon name="link" :size="14" />
                        {{ p.counts.relationships }}
                      </span>
                      <span :title="t('account.usage.photos')">
                        <UiIcon name="image" :size="14" />
                        {{ p.counts.images }}
                      </span>
                    </div>

                    <footer class="pp-card-foot">
                      <button
                        class="pp-vis"
                        :class="p.visibility === 'public' ? 'pub' : 'priv'"
                        :title="t('projectsPage.visibilityHint')"
                        @click.stop="toggleVisibility(p)"
                      >
                        <Transition name="visflip" mode="out-in">
                          <span :key="p.visibility || 'private'" class="pp-vis-face">
                            <UiIcon
                              :name="p.visibility === 'public' ? 'earth' : 'lock'"
                              :size="12"
                            />
                            {{ t('projectsPage.visibility.' + (p.visibility || 'private')) }}
                          </span>
                        </Transition>
                      </button>
                      <span class="pp-date">{{
                        t('projectsPage.updated', { date: fmtDate(p.updated_at) })
                      }}</span>
                      <span class="pp-open">
                        {{ t('projectsPage.open') }}
                        <UiIcon name="arrow-right" :size="14" />
                      </span>
                    </footer>
                  </div>

                  <!-- back (delete confirm) -->
                  <div class="pp-face pp-backface" @click.stop>
                    <UiIcon class="pp-back-warn" name="triangle-alert" :size="26" />
                    <h3 class="pp-back-title">
                      {{ t('projectsPage.deleteTitle', { name: p.name }) }}
                    </h3>
                    <p class="pp-back-body">
                      {{
                        t('projectsPage.deleteBody', {
                          persons: p.counts.persons,
                          relationships: p.counts.relationships,
                          images: p.counts.images
                        })
                      }}
                    </p>
                    <div class="pp-back-actions">
                      <button class="pp-back-keep" @click="confirmId = null">
                        {{ t('projectsPage.deleteCancel') }}
                      </button>
                      <button
                        class="pp-back-del"
                        :disabled="deletingId === p.id"
                        @click="doDelete(p)"
                      >
                        {{ t('projectsPage.deleteConfirm') }}
                      </button>
                    </div>
                  </div>
                </div>
              </article>

              <!-- new project portal -->
              <button
                key="__new"
                class="pp-card pp-card-new"
                :style="{ '--d': shown.length * 45 + 'ms' }"
                @click="newProject"
              >
                <span class="pp-portal">
                  <span class="pp-portal-ring"></span>
                  <UiIcon class="pp-portal-plus" name="plus" :size="24" />
                </span>
                <span class="pp-new-label">{{ t('projectsPage.new') }}</span>
                <span v-if="store.authUsage" class="pp-new-quota">
                  {{ t('projectsPage.quota', { used: quota.used, max: quota.max }) }}
                </span>
              </button>
            </TransitionGroup>

            <!-- ── List view ────────────────────────────────────────────── -->
            <TransitionGroup v-else name="plist" tag="div" class="pp-list">
              <article
                v-for="(p, i) in shown"
                :key="p.id"
                class="pp-row"
                :class="{
                  live: p.id === store.activeProjectId,
                  confirming: confirmId === p.id,
                  cloning: duplicatingId === p.id,
                  fresh: freshId === p.id
                }"
                :style="cardVars(p, i)"
                @click="openProject(p)"
              >
                <template v-if="confirmId !== p.id">
                  <div class="pp-row-const">
                    <svg viewBox="0 0 200 90" preserveAspectRatio="xMidYMid slice">
                      <line
                        v-for="(e, li) in constellationOf(p).edges"
                        :key="'l' + li"
                        class="pp-const-line"
                        :x1="e.x1"
                        :y1="e.y1"
                        :x2="e.x2"
                        :y2="e.y2"
                        pathLength="1"
                      />
                      <circle
                        v-for="(st, si) in constellationOf(p).stars"
                        :key="'s' + si"
                        class="pp-const-star"
                        :class="{ big: st.big }"
                        :cx="st.x"
                        :cy="st.y"
                        :r="st.r"
                        :style="{ animationDelay: st.tw + 's', animationDuration: st.dur + 's' }"
                      />
                    </svg>
                  </div>
                  <div class="pp-row-main">
                    <div class="pp-row-toprow">
                      <span v-if="renamingId !== p.id" class="pp-name">{{ p.name }}</span>
                      <input
                        v-else
                        ref="renameInputRef"
                        v-model="renameValue"
                        class="pp-rename"
                        @click.stop
                        @keydown.enter.stop="confirmRename(p)"
                        @keydown.escape.stop="cancelRename"
                        @blur="cancelRename"
                      />
                      <span v-if="p.id === store.activeProjectId" class="pp-live">
                        <span class="pp-live-dot"></span>{{ t('projectsPage.live') }}
                      </span>
                    </div>
                    <span class="pp-row-desc" :class="{ empty: !p.description }">
                      {{ p.description || t('projectsPage.noDesc') }}
                    </span>
                  </div>
                  <div class="pp-counts pp-row-counts">
                    <span :title="t('account.usage.people')">
                      <UiIcon name="users" :size="14" />
                      {{ p.counts.persons }}
                    </span>
                    <span :title="t('rail.relationships')">
                      <UiIcon name="link" :size="14" />
                      {{ p.counts.relationships }}
                    </span>
                    <span :title="t('account.usage.photos')">
                      <UiIcon name="image" :size="14" />
                      {{ p.counts.images }}
                    </span>
                  </div>
                  <button
                    class="pp-vis"
                    :class="p.visibility === 'public' ? 'pub' : 'priv'"
                    @click.stop="toggleVisibility(p)"
                  >
                    <Transition name="visflip" mode="out-in">
                      <span :key="p.visibility || 'private'" class="pp-vis-face">
                        <UiIcon :name="p.visibility === 'public' ? 'earth' : 'lock'" :size="12" />
                        {{ t('projectsPage.visibility.' + (p.visibility || 'private')) }}
                      </span>
                    </Transition>
                  </button>
                  <span class="pp-date pp-row-date">{{ fmtDate(p.updated_at) }}</span>
                  <button
                    class="pp-star-btn"
                    :class="{ on: p.favorite, bursting: burstId === p.id }"
                    :title="t('projectsPage.favorite')"
                    :aria-label="t('projectsPage.favorite')"
                    :aria-pressed="!!p.favorite"
                    @click.stop="toggleFavorite(p)"
                  >
                    <UiIcon name="star" :size="16" />
                  </button>
                  <div class="pp-row-kebabwrap">
                    <button
                      class="pp-kebab"
                      :title="t('projectsPage.actions')"
                      :aria-label="t('projectsPage.actions')"
                      @click.stop="toggleMenu(p.id)"
                    >
                      <UiIcon name="ellipsis" :size="16" />
                    </button>
                    <Transition name="pp-menu">
                      <div v-if="menuId === p.id" class="pp-menu" @click.stop>
                        <button class="pp-menu-item" @click="menuOpen(p)">
                          <UiIcon name="arrow-up-right" :size="14" />{{
                            t('projectsPage.menu.open')
                          }}
                        </button>
                        <button class="pp-menu-item" @click="menuRename(p)">
                          <UiIcon name="pencil" :size="14" />{{ t('projectsPage.menu.rename') }}
                        </button>
                        <button class="pp-menu-item" @click="openEdit(p)">
                          <UiIcon name="square-pen" :size="14" />{{ t('projectsPage.menu.edit') }}
                        </button>
                        <button class="pp-menu-item" @click="duplicate(p)">
                          <UiIcon name="copy" :size="14" />{{ t('projectsPage.menu.duplicate') }}
                        </button>
                        <button
                          class="pp-menu-item danger"
                          :disabled="cards.length <= 1"
                          @click="menuDelete(p)"
                        >
                          <UiIcon name="trash-2" :size="14" />{{ t('projectsPage.menu.delete') }}
                        </button>
                      </div>
                    </Transition>
                  </div>
                </template>
                <template v-else>
                  <div class="pp-row-confirm" @click.stop>
                    <UiIcon class="pp-back-warn small" name="triangle-alert" :size="18" />
                    <span class="pp-row-confirm-text">
                      {{
                        t('projectsPage.deleteBody', {
                          persons: p.counts.persons,
                          relationships: p.counts.relationships,
                          images: p.counts.images
                        })
                      }}
                    </span>
                    <button class="pp-back-keep" @click="confirmId = null">
                      {{ t('projectsPage.deleteCancel') }}
                    </button>
                    <button
                      class="pp-back-del"
                      :disabled="deletingId === p.id"
                      @click="doDelete(p)"
                    >
                      {{ t('projectsPage.deleteConfirm') }}
                    </button>
                  </div>
                </template>
              </article>
            </TransitionGroup>

            <!-- ── Empty state ──────────────────────────────────────────── -->
            <div v-if="shown.length === 0" class="pp-empty">
              <UiIcon class="pp-empty-scope" name="telescope" :size="44" :stroke="1.6" />
              <p class="pp-empty-title">{{ t('projectsPage.emptyTitle') }}</p>
              <p class="pp-empty-sub">{{ t('projectsPage.emptySub') }}</p>
            </div>

            <!-- Sponsored strip (free plans only; hides itself otherwise) -->
            <AdSlot class="pp-ad" placement="strip" :seed="1" />
          </div>
        </main>

        <!-- ── Edit details dialog ─────────────────────────────────────── -->
        <Transition name="pp-modal">
          <div v-if="editDraft" class="pp-modal-backdrop ink-veil" @click.self="editDraft = null">
            <div class="pp-modal ink-mount ink-unroll ink-rollers">
              <h2 class="pp-modal-title">
                <UiIcon name="square-pen" :size="18" />
                {{ t('projectsPage.editTitle') }}
              </h2>

              <label class="pp-label">{{ t('projectsPage.editName') }}</label>
              <input v-model="editDraft.name" class="pp-input" maxlength="60" />

              <label class="pp-label">{{ t('projectsPage.editDesc') }}</label>
              <textarea
                v-model="editDraft.description"
                class="pp-input pp-textarea"
                rows="3"
                maxlength="200"
                :placeholder="t('projectsPage.editDescPh')"
              ></textarea>
              <div class="pp-charcount">{{ (editDraft.description || '').length }} / 200</div>

              <label class="pp-label">{{ t('projectsPage.editColor') }}</label>
              <div class="pp-swatches">
                <button
                  class="pp-swatch pp-swatch-auto"
                  :class="{ active: editDraft.hue === null }"
                  @click="editDraft.hue = null"
                >
                  A
                </button>
                <button
                  v-for="h in HUES"
                  :key="h"
                  class="pp-swatch"
                  :class="{ active: editDraft.hue === h }"
                  :style="{ background: `hsl(${h}, 72%, 55%)` }"
                  @click="editDraft.hue = h"
                ></button>
              </div>

              <label class="pp-label">{{ t('projectsPage.editVisibility') }}</label>
              <div class="pp-seg" :class="{ pub: editDraft.visibility === 'public' }">
                <span class="pp-seg-slider"></span>
                <button
                  class="pp-seg-btn"
                  :class="{ on: editDraft.visibility !== 'public' }"
                  @click="editDraft.visibility = 'private'"
                >
                  <UiIcon name="lock" :size="14" />
                  {{ t('projectsPage.visibility.private') }}
                </button>
                <button
                  class="pp-seg-btn"
                  :class="{ on: editDraft.visibility === 'public' }"
                  @click="editDraft.visibility = 'public'"
                >
                  <UiIcon name="earth" :size="14" />
                  {{ t('projectsPage.visibility.public') }}
                </button>
              </div>
              <p class="pp-modal-note">{{ t('projectsPage.publicNote') }}</p>

              <Transition name="pp-fade">
                <div v-if="editDraft.visibility === 'public'" class="pp-access">
                  <label class="pp-label">{{ t('projectsPage.editAccess') }}</label>
                  <div class="pp-access-grid">
                    <button
                      v-for="m in ACCESS_MODES"
                      :key="m"
                      class="pp-access-opt"
                      :class="{ on: editDraft.access === m }"
                      :title="t('browse.modes.' + m + '.desc')"
                      @click="editDraft.access = m"
                    >
                      <UiIcon class="pp-access-icon" :name="ACCESS_ICONS[m]" :size="18" />
                      <span class="pp-access-name">{{ t('browse.modes.' + m + '.name') }}</span>
                      <span class="pp-access-short">{{ t('browse.modes.' + m + '.short') }}</span>
                    </button>
                  </div>
                </div>
              </Transition>

              <div class="pp-modal-actions">
                <Transition name="pp-fade">
                  <span v-if="editError" class="pp-modal-error">{{ editError }}</span>
                </Transition>
                <button class="pp-btn-ghost" @click="editDraft = null">
                  {{ t('projectsPage.cancel') }}
                </button>
                <button class="pp-btn-primary" :disabled="editSaving" @click="saveEdit">
                  {{ t('projectsPage.save') }}
                </button>
              </div>
            </div>
          </div>
        </Transition>

        <!-- ── Toast ───────────────────────────────────────────────────── -->
        <Transition name="pp-toast">
          <div v-if="toast" :key="toast.key" class="pp-toast" :class="toast.kind">
            {{ toast.text }}
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useMainStore } from '../store/index.js'
import { useI18n } from '../i18n'
import { ACCESS_ICONS, ACCESS_MODES } from './browse/browseModel'
import AdSlot from './billing/AdSlot.vue'
import InkBackdrop from './ui/InkBackdrop.vue'
import SearchField from './ui/SearchField.vue'
import UiIcon from './ui/UiIcon.js'

const store = useMainStore()
const { t, locale } = useI18n()

const FILTERS = [
  { key: 'all', icon: 'layers' },
  { key: 'favorites', icon: 'star' },
  { key: 'public', icon: 'earth' },
  { key: 'private', icon: 'lock' }
]
const SORTS = ['updated', 'nameAsc', 'nameDesc', 'people', 'newest', 'oldest']
const HUES = [0, 30, 55, 90, 140, 175, 205, 230, 260, 290, 320, 345]

// ── Card data (ProjectOverview[] — fetched fresh on open + after mutations) ──
const cards = ref([])
const query = ref('')
const filter = ref('all')
const sortBy = ref(localStorage.getItem('pp:sort') || 'updated')
const layout = ref(localStorage.getItem('pp:layout') || 'grid')
watch(sortBy, (v) => localStorage.setItem('pp:sort', v))
watch(layout, (v) => localStorage.setItem('pp:layout', v))

const menuId = ref(null) // project id whose ⋯ menu is open
const confirmId = ref(null) // project id showing the delete confirm (card flip)
const renamingId = ref(null)
const renameValue = ref('')
const renameInputRef = ref(null)
const burstId = ref(null) // favorite-star burst animation target
const duplicatingId = ref(null)
const deletingId = ref(null)
const freshId = ref(null) // newly created/duplicated card highlight
const editDraft = ref(null) // { id, name, description, hue, visibility, access } or null
const editError = ref('')
const editSaving = ref(false)

async function load() {
  cards.value = await store.fetchProjectsOverview()
}

// ── Filter + sort ─────────────────────────────────────────────────────────────
function countFor(key) {
  if (key === 'all') return cards.value.length
  if (key === 'favorites') return cards.value.filter((p) => p.favorite).length
  if (key === 'public') return cards.value.filter((p) => p.visibility === 'public').length
  return cards.value.filter((p) => p.visibility !== 'public').length
}

const shown = computed(() => {
  let list = cards.value
  const q = query.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)
    )
  }
  if (filter.value === 'favorites') list = list.filter((p) => p.favorite)
  else if (filter.value === 'public') list = list.filter((p) => p.visibility === 'public')
  else if (filter.value === 'private') list = list.filter((p) => p.visibility !== 'public')
  const cmp = {
    updated: (a, b) => String(b.updated_at).localeCompare(String(a.updated_at)),
    nameAsc: (a, b) => a.name.localeCompare(b.name),
    nameDesc: (a, b) => b.name.localeCompare(a.name),
    people: (a, b) => b.counts.persons - a.counts.persons,
    newest: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
    oldest: (a, b) => String(a.created_at).localeCompare(String(b.created_at))
  }[sortBy.value]
  // Favorites always float to the top of whatever ordering is chosen.
  return [...list].sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || cmp(a, b))
})

// ── Hero stats (count-up on open) ─────────────────────────────────────────────
const displayed = reactive({ projects: 0, people: 0, bonds: 0, photos: 0 })
let countRaf = 0

const totals = computed(() => ({
  projects: cards.value.length,
  people: cards.value.reduce((n, p) => n + p.counts.persons, 0),
  bonds: cards.value.reduce((n, p) => n + p.counts.relationships, 0),
  photos: cards.value.reduce((n, p) => n + p.counts.images, 0)
}))

const heroStats = computed(() => [
  { key: 'projects', shown: displayed.projects, label: t('projectsPage.stats.projects') },
  { key: 'people', shown: displayed.people, label: t('projectsPage.stats.people') },
  { key: 'bonds', shown: displayed.bonds, label: t('projectsPage.stats.bonds') },
  { key: 'photos', shown: displayed.photos, label: t('projectsPage.stats.photos') }
])

function animateCounts() {
  cancelAnimationFrame(countRaf)
  const from = { ...displayed }
  const to = totals.value
  const t0 = performance.now()
  const dur = 950
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur)
    const e = 1 - Math.pow(1 - k, 3)
    for (const key of Object.keys(displayed)) {
      displayed[key] = Math.round(from[key] + (to[key] - from[key]) * e)
    }
    if (k < 1) countRaf = requestAnimationFrame(step)
  }
  countRaf = requestAnimationFrame(step)
}
watch(totals, animateCounts)

// ── Quota ring ────────────────────────────────────────────────────────────────
const quota = computed(() => {
  const u = store.authUsage
  if (!u) return { used: 0, max: 0, ratio: 0 }
  return { used: u.projects, max: u.maxProjects, ratio: u.projects / u.maxProjects }
})

// ── Per-project accent + constellation (seeded by project id) ────────────────
function hashOf(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hueOf(p) {
  return p.hue ?? hashOf(p.id) % 360
}

function cardVars(p, i) {
  const h = hueOf(p)
  return {
    '--ph': h,
    '--pa': `hsl(${h}, 74%, 62%)`,
    '--pa-soft': `hsla(${h}, 74%, 62%, 0.14)`,
    '--d': Math.min(i * 45, 500) + 'ms'
  }
}

// One unique little constellation per project — its people as stars. Cached
// by id + person count so it only regenerates when the family grows.
const constCache = new Map()
function constellationOf(p) {
  const key = `${p.id}:${p.counts.persons}`
  if (constCache.has(key)) return constCache.get(key)
  const rand = mulberry32(hashOf(p.id))
  const n = Math.max(5, Math.min(13, 4 + Math.round(Math.sqrt(p.counts.persons || 1) * 1.6)))
  const stars = []
  for (let i = 0; i < n; i++) {
    stars.push({
      x: Math.round((12 + rand() * 176) * 10) / 10,
      y: Math.round((10 + rand() * 68) * 10) / 10,
      r: Math.round((1 + rand() * 1.7) * 10) / 10,
      big: i < 2,
      tw: Math.round(rand() * 30) / 10,
      dur: Math.round(18 + rand() * 22) / 10
    })
  }
  const edges = []
  for (let i = 1; i < n; i++) {
    let best = 0
    let bd = Infinity
    for (let j = 0; j < i; j++) {
      const d = (stars[i].x - stars[j].x) ** 2 + (stars[i].y - stars[j].y) ** 2
      if (d < bd) {
        bd = d
        best = j
      }
    }
    edges.push({ x1: stars[i].x, y1: stars[i].y, x2: stars[best].x, y2: stars[best].y })
  }
  const result = { stars, edges }
  constCache.set(key, result)
  return result
}

// ── 3D tilt + glare (plain style writes — no reactivity on pointermove) ─────
function tiltMove(e) {
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  const px = (e.clientX - r.left) / r.width
  const py = (e.clientY - r.top) / r.height
  el.style.setProperty('--rx', `${((0.5 - py) * 7).toFixed(2)}deg`)
  el.style.setProperty('--ry', `${((px - 0.5) * 10).toFixed(2)}deg`)
  el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`)
  el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`)
  el.style.setProperty('--gop', '1')
}

function tiltLeave(e) {
  const el = e.currentTarget
  el.style.setProperty('--rx', '0deg')
  el.style.setProperty('--ry', '0deg')
  el.style.setProperty('--gop', '0')
}

// ── Actions ───────────────────────────────────────────────────────────────────
let suppressOpen = false // a click that only closed a menu must not open a card
let renameJustEnded = 0

function close() {
  store.toggleProjectsPage(false)
}

async function openProject(p, force = false) {
  if (!force) {
    if (suppressOpen || confirmId.value === p.id || renamingId.value === p.id) return
    if (Date.now() - renameJustEnded < 350) return
  }
  close()
  if (p.id !== store.activeProjectId) await store.switchProject(p.id)
}

async function newProject() {
  const project = await store.createProject()
  if (!project) return
  await load()
  freshId.value = project.id
  setTimeout(() => (freshId.value = null), 1800)
  showToast(t('projectsPage.created'), 'ok')
}

function toggleMenu(id) {
  menuId.value = menuId.value === id ? null : id
}

function menuOpen(p) {
  menuId.value = null
  openProject(p, true)
}

function menuRename(p) {
  menuId.value = null
  startRename(p)
}

function menuDelete(p) {
  menuId.value = null
  confirmId.value = p.id
}

async function toggleFavorite(p) {
  burstId.value = p.favorite ? null : p.id
  setTimeout(() => (burstId.value = null), 650)
  const res = await store.updateProject(p.id, { favorite: !p.favorite })
  if (res.success) patchCard(res.data)
}

async function toggleVisibility(p) {
  const next = p.visibility === 'public' ? 'private' : 'public'
  const res = await store.updateProject(p.id, { visibility: next })
  if (res.success) {
    patchCard(res.data)
    if (next === 'public') showToast(t('projectsPage.publicNote'), 'ok')
  }
}

function patchCard(project) {
  const idx = cards.value.findIndex((c) => c.id === project.id)
  if (idx !== -1) cards.value[idx] = { ...cards.value[idx], ...project }
}

function startRename(p) {
  renamingId.value = p.id
  renameValue.value = p.name
  nextTick(() => {
    const el = Array.isArray(renameInputRef.value) ? renameInputRef.value[0] : renameInputRef.value
    el?.focus?.()
    el?.select?.()
  })
}

async function confirmRename(p) {
  const name = renameValue.value.trim()
  renamingId.value = null
  renameJustEnded = Date.now()
  if (!name || name === p.name) return
  const res = await store.updateProject(p.id, { name })
  if (res.success) patchCard(res.data)
  else showToast(res.error || 'Could not rename', 'err')
}

function cancelRename() {
  if (renamingId.value) renameJustEnded = Date.now()
  renamingId.value = null
}

function openEdit(p) {
  menuId.value = null
  editError.value = ''
  editDraft.value = {
    id: p.id,
    name: p.name,
    description: p.description || '',
    hue: p.hue ?? null,
    visibility: p.visibility === 'public' ? 'public' : 'private',
    access: p.access || 'glasshouse'
  }
}

async function saveEdit() {
  const d = editDraft.value
  if (!d) return
  editSaving.value = true
  editError.value = ''
  const res = await store.updateProject(d.id, {
    name: d.name,
    description: d.description,
    hue: d.hue,
    visibility: d.visibility,
    access: d.access
  })
  editSaving.value = false
  if (res.success) {
    patchCard(res.data)
    editDraft.value = null
    showToast(t('projectsPage.saved'), 'ok')
  } else {
    editError.value = res.error || 'Could not save'
  }
}

async function duplicate(p) {
  menuId.value = null
  duplicatingId.value = p.id
  const res = await store.duplicateProject(p.id)
  duplicatingId.value = null
  if (res.success) {
    await load()
    freshId.value = res.data.id
    setTimeout(() => (freshId.value = null), 1800)
    showToast(t('projectsPage.duplicated'), 'ok')
  } else {
    showToast(res.error || 'Could not duplicate', 'err')
  }
}

async function doDelete(p) {
  deletingId.value = p.id
  await store.deleteProject(p.id)
  deletingId.value = null
  confirmId.value = null
  await load()
  store.refreshUsage()
  showToast(t('projectsPage.deleted'), 'ok')
}

// ── Toast ─────────────────────────────────────────────────────────────────────
const toast = ref(null)
let toastTimer = 0
let toastKey = 0

function showToast(text, kind = 'ok') {
  clearTimeout(toastTimer)
  toast.value = { key: ++toastKey, text, kind }
  toastTimer = setTimeout(() => (toast.value = null), 2600)
}

// ── Starfield canvas ─────────────────────────────────────────────────────────
const skyRef = ref(null)
let sky = null

function startSky() {
  const canvas = skyRef.value
  // The ink theme paints a still paper backdrop instead — no rAF loop at all.
  if (!canvas || sky || store.isInk) return
  const ctx = canvas.getContext('2d')
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  const state = {
    ctx,
    raf: 0,
    w: 0,
    h: 0,
    dpr: Math.min(2, window.devicePixelRatio || 1),
    mouse: { x: 0.5, y: 0.5 },
    stars: [],
    shots: [],
    nextShot: performance.now() + 2500,
    reduced
  }
  const resize = () => {
    state.w = canvas.clientWidth
    state.h = canvas.clientHeight
    canvas.width = state.w * state.dpr
    canvas.height = state.h * state.dpr
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0)
    const n = Math.min(230, Math.round((state.w * state.h) / 8200))
    state.stars = []
    const rand = mulberry32(1234567)
    for (let i = 0; i < n; i++) {
      state.stars.push({
        x: rand() * state.w,
        y: rand() * state.h,
        z: 0.25 + rand() * 0.75,
        r: 0.4 + rand() * 1.3,
        a: 0.25 + rand() * 0.55,
        tw: 0.5 + rand() * 2.2,
        ph: rand() * Math.PI * 2,
        hueShift: rand() < 0.22
      })
    }
    if (reduced) draw(performance.now())
  }
  const onMove = (e) => {
    state.mouse.x = e.clientX / window.innerWidth
    state.mouse.y = e.clientY / window.innerHeight
  }
  const draw = (now) => {
    const { w, h } = state
    const dark = store.theme === 'dark'
    ctx.clearRect(0, 0, w, h)
    const t = now / 1000
    const ox = (state.mouse.x - 0.5) * 34
    const oy = (state.mouse.y - 0.5) * 22
    for (const s of state.stars) {
      const tw = state.reduced ? 1 : 0.62 + 0.38 * Math.sin(t * s.tw + s.ph)
      const a = s.a * tw * (dark ? 1 : 0.55)
      ctx.beginPath()
      ctx.arc(s.x + ox * s.z, s.y + oy * s.z, s.r, 0, Math.PI * 2)
      ctx.fillStyle = s.hueShift
        ? `hsla(${(t * 14 + s.ph * 60) % 360}, 80%, ${dark ? 74 : 48}%, ${a})`
        : dark
          ? `rgba(235, 240, 255, ${a})`
          : `rgba(70, 90, 170, ${a})`
      ctx.fill()
    }
    if (!state.reduced) {
      // Shooting stars: rare, diagonal, with a fading gradient tail
      if (now > state.nextShot && state.shots.length < 2) {
        state.nextShot = now + 3800 + Math.random() * 5200
        const fromLeft = Math.random() < 0.5
        state.shots.push({
          x: fromLeft ? -40 : Math.random() * w * 0.7 + w * 0.3,
          y: Math.random() * h * 0.4,
          vx: 340 + Math.random() * 260,
          vy: 120 + Math.random() * 90,
          life: 1
        })
      }
      for (let i = state.shots.length - 1; i >= 0; i--) {
        const sh = state.shots[i]
        sh.x += sh.vx / 60
        sh.y += sh.vy / 60
        sh.life -= 0.011
        if (sh.life <= 0 || sh.x > w + 60 || sh.y > h + 60) {
          state.shots.splice(i, 1)
          continue
        }
        const len = 90
        const nx = sh.vx / Math.hypot(sh.vx, sh.vy)
        const ny = sh.vy / Math.hypot(sh.vx, sh.vy)
        const grad = ctx.createLinearGradient(sh.x, sh.y, sh.x - nx * len, sh.y - ny * len)
        const head = dark ? '255, 255, 255' : '90, 110, 200'
        grad.addColorStop(0, `rgba(${head}, ${0.85 * sh.life})`)
        grad.addColorStop(1, `rgba(${head}, 0)`)
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(sh.x, sh.y)
        ctx.lineTo(sh.x - nx * len, sh.y - ny * len)
        ctx.stroke()
      }
      state.raf = requestAnimationFrame(draw)
    }
  }
  window.addEventListener('resize', resize)
  window.addEventListener('pointermove', onMove)
  state.cleanup = () => {
    cancelAnimationFrame(state.raf)
    window.removeEventListener('resize', resize)
    window.removeEventListener('pointermove', onMove)
  }
  sky = state
  resize()
  if (!reduced) state.raf = requestAnimationFrame(draw)
}

function stopSky() {
  sky?.cleanup?.()
  sky = null
}

// Switching into / out of ink while the page is open swaps sky ⇄ paper.
watch(
  () => store.isInk,
  (ink) => {
    if (!store.projectsPageOpen) return
    if (ink) stopSky()
    else nextTick(startSky)
  }
)

// ── Open/close plumbing ──────────────────────────────────────────────────────
watch(
  () => store.projectsPageOpen,
  async (open) => {
    if (!open) {
      stopSky()
      return
    }
    menuId.value = null
    confirmId.value = null
    renamingId.value = null
    editDraft.value = null
    toast.value = null
    for (const key of Object.keys(displayed)) displayed[key] = 0
    store.refreshUsage()
    await load()
    await nextTick()
    startSky()
  }
)

function onKeydown(e) {
  if (!store.projectsPageOpen || store.curtain.active) return
  if (e.key !== 'Escape') return
  if (menuId.value) menuId.value = null
  else if (editDraft.value) editDraft.value = null
  else if (confirmId.value) confirmId.value = null
  else if (renamingId.value) cancelRename()
  else close()
}

// Any pointerdown outside an open menu closes it — and that same click must
// not fall through onto the card underneath and open the project.
function onPointerdown(e) {
  if (!menuId.value) return
  if (e.target.closest?.('.pp-menu') || e.target.closest?.('.pp-kebab')) return
  menuId.value = null
  suppressOpen = true
  setTimeout(() => (suppressOpen = false), 0)
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('pointerdown', onPointerdown, true)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('pointerdown', onPointerdown, true)
  stopSky()
  cancelAnimationFrame(countRaf)
  clearTimeout(toastTimer)
})

function fmtDate(s) {
  if (!s) return ''
  const d = new Date(String(s).replace(' ', 'T') + (s.includes('T') ? '' : 'Z'))
  const loc = locale.value === 'zh-Hans' ? 'zh-CN' : locale.value === 'zh-Hant' ? 'zh-TW' : 'en'
  return d.toLocaleDateString(loc, { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.pp-root {
  position: fixed;
  inset: 0;
  z-index: 240;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Sky & aurora ────────────────────────────────────────────────────────── */
.pp-sky {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.pp-aurora {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.pp-blob {
  position: absolute;
  width: 52vmax;
  height: 52vmax;
  border-radius: 50%;
  filter: blur(95px);
  opacity: 0.13;
}

.pp-blob-a {
  background: var(--accent);
  top: -24vmax;
  left: -14vmax;
  animation: pp-drift-a 28s ease-in-out infinite alternate;
}

.pp-blob-b {
  background: #8b6cc5;
  bottom: -28vmax;
  right: -16vmax;
  animation: pp-drift-b 34s ease-in-out infinite alternate;
}

.pp-blob-c {
  background: #2bb3a3;
  top: 30%;
  left: 55%;
  width: 34vmax;
  height: 34vmax;
  opacity: 0.07;
  animation: pp-drift-c 40s ease-in-out infinite alternate;
}

@keyframes pp-drift-a {
  to {
    transform: translate(10vmax, 7vmax) scale(1.15);
  }
}

@keyframes pp-drift-b {
  to {
    transform: translate(-9vmax, -8vmax) scale(0.92);
  }
}

@keyframes pp-drift-c {
  to {
    transform: translate(-14vmax, 6vmax) scale(1.25);
  }
}

/* ── Top bar ─────────────────────────────────────────────────────────────── */
.pp-topbar {
  flex: 0 0 54px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  position: relative;
  z-index: 3;
}

.pp-topbar-spacer {
  flex: 1;
}

.pp-back {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  height: var(--ctl-md);
  padding: 0 14px 0 11px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.pp-back:hover {
  color: var(--t1);
  background: var(--hover);
  border-color: rgba(var(--accent-rgb), 0.4);
}

.pp-back-arrow {
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.pp-back:hover .pp-back-arrow {
  transform: translateX(-3px);
}

.pp-quota {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--t3);
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.pp-quota-ring {
  width: 26px;
  height: 26px;
  transform: rotate(-90deg);
}

.pp-quota-track {
  fill: none;
  stroke: var(--border);
  stroke-width: 3.5;
}

.pp-quota-fill {
  fill: none;
  stroke: var(--accent);
  stroke-width: 3.5;
  stroke-linecap: round;
  stroke-dasharray: 81.7;
  transition: stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1);
}

.pp-quota-fill.warn {
  stroke: var(--amber);
}

/* CTA with a travelling shine sweep */
.pp-new {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(120deg, var(--accent), var(--accent-2));
  color: var(--on-accent);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 700;
  height: var(--ctl-md);
  padding: 0 18px 0 14px;
  cursor: pointer;
  overflow: hidden;
  box-shadow: 0 4px 18px rgba(var(--accent-rgb), 0.35);
  transition:
    transform 0.18s ease,
    box-shadow 0.25s ease;
}

.pp-new:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 26px rgba(var(--accent-rgb), 0.5);
}

.pp-new::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 40%;
  left: -60%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.45), transparent);
  transform: skewX(-20deg);
  animation: pp-shine 3.4s ease-in-out infinite;
}

@keyframes pp-shine {
  0%,
  60% {
    left: -60%;
  }
  100% {
    left: 130%;
  }
}

.pp-new-plus {
  flex-shrink: 0;
}

/* ── Scroll body ─────────────────────────────────────────────────────────── */
.pp-scroll {
  flex: 1;
  overflow-y: auto;
  position: relative;
  z-index: 2;
}

.pp-content {
  max-width: 1060px;
  margin: 0 auto;
  padding: 8px 26px 80px;
}

/* ── Hero ────────────────────────────────────────────────────────────────── */
.pp-hero {
  text-align: center;
  padding: 22px 0 8px;
}

.pp-title {
  margin: 0;
  font-size: clamp(32px, 5vw, 52px);
  font-weight: 900;
  letter-spacing: -1px;
  background: linear-gradient(110deg, var(--t1) 20%, var(--accent) 42%, #b58cf0 55%, var(--t1) 78%);
  background-size: 240% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation:
    pp-sheen 7s ease-in-out infinite,
    pp-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes pp-sheen {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

.pp-subtitle {
  margin: 8px 0 0;
  color: var(--t3);
  font-size: 14px;
  animation: pp-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) 90ms both;
}

@keyframes pp-rise {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.pp-stats {
  display: flex;
  justify-content: center;
  gap: 38px;
  margin-top: 20px;
  flex-wrap: wrap;
}

.pp-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  animation: pp-rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) var(--d, 0ms) both;
}

.pp-stat-num {
  color: var(--t1);
  font-size: 26px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.5px;
}

.pp-stat-label {
  color: var(--t3);
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

/* ── Toolbar ─────────────────────────────────────────────────────────────── */
.pp-toolbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 26px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  animation: pp-rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) 180ms both;
}

/* every toolbar control shares one height (--ctl-md) */
.pp-toolbar .pp-search {
  --sf-h: var(--ctl-md);
  width: 220px;
}

.pp-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.pp-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--t3);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  height: var(--ctl-md);
  padding: 0 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pp-chip:hover {
  color: var(--t1);
  background: var(--hover);
}

.pp-chip.active {
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.5);
  background: var(--adim);
  box-shadow: 0 0 12px rgba(var(--accent-rgb), 0.22);
}

.pp-chip-icon {
  flex-shrink: 0;
}

.pp-chip-n {
  font-size: 11px;
  font-weight: 800;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--elevated);
  color: var(--t3);
  font-variant-numeric: tabular-nums;
}

.pp-chip.active .pp-chip-n {
  background: rgba(var(--accent-rgb), 0.22);
  color: var(--accent);
}

.pp-toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.pp-sort {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--t3);
}

.pp-sort-glyph {
  flex-shrink: 0;
}

.pp-sort-select {
  height: var(--ctl-md);
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 500;
  outline: none;
  cursor: pointer;
}

.pp-viewtoggle {
  position: relative;
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--elevated);
  padding: 3px;
}

.pp-viewslider {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 3px;
  width: calc(50% - 3px);
  border-radius: 7px;
  background: var(--adim);
  border: 1px solid rgba(var(--accent-rgb), 0.4);
  transition: transform 0.28s cubic-bezier(0.34, 1.3, 0.64, 1);
}

.pp-viewtoggle.list .pp-viewslider {
  transform: translateX(100%);
}

.pp-viewbtn {
  position: relative;
  border: none;
  background: transparent;
  color: var(--t3);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  width: 30px;
  height: 24px;
  cursor: pointer;
  border-radius: 7px;
  transition: color 0.2s ease;
}

.pp-viewbtn.on {
  color: var(--accent);
}

/* ── Card grid ───────────────────────────────────────────────────────────── */
.pp-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(252px, 1fr));
  gap: 18px;
  margin-top: 22px;
}

.pp-card {
  position: relative;
  min-height: 208px;
  border-radius: 18px;
  cursor: pointer;
  perspective: 1100px;
  background: transparent;
  border: none;
  padding: 0;
  text-align: left;
  transform: perspective(1000px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
  transition: transform 0.16s ease-out;
  animation: pp-card-in 0.65s cubic-bezier(0.22, 1, 0.36, 1) var(--d, 0ms) both;
}

@keyframes pp-card-in {
  from {
    opacity: 0;
    transform: translateY(26px) scale(0.94);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Rotating conic halo, revealed on hover through the 1px gap around faces */
.pp-card::before {
  content: '';
  position: absolute;
  inset: -45%;
  border-radius: 50%;
  background: conic-gradient(
    transparent 0deg,
    transparent 250deg,
    var(--pa) 310deg,
    transparent 360deg
  );
  animation: pp-orbit 3.6s linear infinite;
  opacity: 0;
  transition: opacity 0.35s ease;
  pointer-events: none;
}

.pp-card:hover::before {
  opacity: 1;
}

@keyframes pp-orbit {
  to {
    transform: rotate(360deg);
  }
}

.pp-card {
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
  outline: 1px solid color-mix(in srgb, var(--pa) 20%, var(--border));
  outline-offset: -1px;
  transition:
    transform 0.16s ease-out,
    box-shadow 0.3s ease,
    outline-color 0.3s ease;
}

.pp-card:hover {
  box-shadow:
    0 18px 44px rgba(0, 0, 0, 0.32),
    0 0 30px var(--pa-soft);
  outline-color: color-mix(in srgb, var(--pa) 55%, var(--border));
}

.pp-card.fav {
  outline-color: color-mix(in srgb, #ffd24a 35%, var(--border));
}

.pp-card.fresh {
  animation: pp-fresh 1.6s ease-out;
}

@keyframes pp-fresh {
  0%,
  55% {
    box-shadow:
      0 0 0 3px var(--pa),
      0 0 42px var(--pa-soft);
  }
  100% {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
  }
}

/* Flip container */
.pp-card-inner {
  position: absolute;
  inset: 1px;
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.32, 1.15, 0.42, 1);
}

.pp-card.confirming .pp-card-inner {
  transform: rotateY(180deg);
}

.pp-face {
  position: absolute;
  inset: 0;
  border-radius: 17px;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pp-front {
  background: linear-gradient(180deg, var(--pa-soft), transparent 42%), var(--surface);
  padding: 0 16px 13px;
}

.pp-backface {
  transform: rotateY(180deg);
  background:
    linear-gradient(165deg, rgba(var(--danger-rgb), 0.16), transparent 55%), var(--surface);
  border: 1px solid rgba(var(--danger-rgb), 0.45);
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 18px;
  gap: 8px;
}

/* Constellation band */
.pp-const {
  height: 66px;
  margin: 0 -16px;
  position: relative;
}

.pp-const svg {
  width: 100%;
  height: 100%;
  display: block;
}

.pp-const-line {
  stroke: var(--pa);
  stroke-width: 0.7;
  opacity: 0.5;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: pp-draw 0.9s ease-out forwards;
}

@keyframes pp-draw {
  to {
    stroke-dashoffset: 0;
  }
}

.pp-const-star {
  fill: var(--pa);
  transform-box: fill-box;
  transform-origin: center;
  animation: pp-twinkle 2.4s ease-in-out infinite alternate;
}

.pp-const-star.big {
  filter: drop-shadow(0 0 4px var(--pa));
}

@keyframes pp-twinkle {
  from {
    opacity: 0.35;
    transform: scale(0.7);
  }
  to {
    opacity: 1;
    transform: scale(1.15);
  }
}

/* Cursor-following glare */
.pp-glare {
  position: absolute;
  inset: 0;
  border-radius: 17px;
  background: radial-gradient(
    300px circle at var(--gx, 50%) var(--gy, 50%),
    rgba(255, 255, 255, 0.13),
    transparent 55%
  );
  opacity: var(--gop, 0);
  transition: opacity 0.35s ease;
  pointer-events: none;
}

/* Card header */
.pp-card-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 2px;
}

.pp-name {
  color: var(--t1);
  font-size: 14.5px;
  font-weight: 800;
  letter-spacing: -0.2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}

.pp-rename {
  flex: 1;
  min-width: 0;
  background: var(--elevated);
  border: 1px solid var(--accent);
  border-radius: 7px;
  color: var(--t1);
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font);
  padding: 3px 7px;
  outline: none;
}

.pp-star-btn {
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  padding: 0;
  transition:
    color 0.25s ease,
    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.pp-star-btn:hover {
  color: var(--t1);
  transform: scale(1.25) rotate(18deg);
}

.pp-star-btn.on {
  color: #ffd24a;
  filter: drop-shadow(0 0 6px rgba(255, 210, 74, 0.65));
}

.pp-star-btn.on .ui-icon {
  fill: currentColor;
}

.pp-star-btn.bursting {
  animation: pp-star-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.pp-star-btn.bursting::after {
  content: '';
  position: absolute;
  inset: -7px;
  border-radius: 50%;
  border: 2px solid #ffd24a;
  animation: pp-star-ring 0.55s ease-out forwards;
}

@keyframes pp-star-pop {
  0% {
    transform: scale(0.4) rotate(-40deg);
  }
  60% {
    transform: scale(1.5) rotate(14deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
  }
}

@keyframes pp-star-ring {
  from {
    opacity: 0.9;
    transform: scale(0.4);
  }
  to {
    opacity: 0;
    transform: scale(1.9);
  }
}

.pp-live {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--adim);
  border: 1px solid rgba(var(--accent-rgb), 0.4);
  color: var(--accent);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.6px;
  text-transform: uppercase;
}

.pp-live-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  animation: pp-pulse 1.8s ease-in-out infinite;
}

@keyframes pp-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(var(--accent-rgb), 0.7);
  }
  55% {
    box-shadow: 0 0 0 5px rgba(var(--accent-rgb), 0);
  }
}

.pp-kebab {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--t3);
  width: 24px;
  height: 24px;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pp-kebab:hover {
  background: var(--hover);
  color: var(--t1);
}

/* Action menu */
.pp-menu {
  position: absolute;
  top: 28px;
  right: 0;
  z-index: 8;
  display: flex;
  flex-direction: column;
  min-width: 160px;
  padding: 5px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--elevated) 92%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.35);
}

.pp-menu-item {
  display: flex;
  align-items: center;
  gap: 9px;
  border: none;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.14s ease;
}

.pp-menu-item .ui-icon {
  flex-shrink: 0;
  color: var(--t3);
}

.pp-menu-item.danger .ui-icon {
  color: inherit;
}

.pp-menu-item:hover {
  background: var(--hover);
  color: var(--t1);
  transform: translateX(2px);
}

.pp-menu-item.danger {
  color: var(--danger);
}

.pp-menu-item.danger:hover {
  background: rgba(var(--danger-rgb), 0.12);
}

.pp-menu-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.pp-menu-enter-active {
  transition:
    opacity 0.18s ease,
    transform 0.24s cubic-bezier(0.34, 1.4, 0.64, 1);
}

.pp-menu-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.pp-menu-enter-from,
.pp-menu-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.92);
}

/* Body */
.pp-desc {
  margin: 9px 0 0;
  color: var(--t2);
  font-size: 12.5px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 34px;
}

.pp-desc.empty {
  color: var(--t3);
  font-style: italic;
  opacity: 0.65;
}

.pp-counts {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 10px;
  color: var(--t2);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}

.pp-counts > span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.pp-counts .ui-icon {
  color: var(--t3);
}

.pp-card-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding-top: 11px;
}

.pp-vis {
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--elevated);
  color: var(--t3);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 700;
  padding: 3px 9px;
  cursor: pointer;
  transition: all 0.2s ease;
  perspective: 200px;
}

.pp-vis:hover {
  border-color: var(--accent);
  color: var(--t1);
}

.pp-vis.pub {
  border-color: rgba(43, 179, 163, 0.55);
  color: var(--green, #2bb385);
  background: rgba(43, 179, 163, 0.1);
  box-shadow: 0 0 10px rgba(43, 179, 163, 0.18);
}

.pp-vis-face {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.visflip-enter-active,
.visflip-leave-active {
  transition:
    transform 0.18s ease,
    opacity 0.18s ease;
}

.visflip-enter-from {
  transform: rotateX(90deg);
  opacity: 0;
}

.visflip-leave-to {
  transform: rotateX(-90deg);
  opacity: 0;
}

.pp-date {
  color: var(--t3);
  font-size: 12px;
  margin-left: auto;
}

.pp-open {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--pa);
  font-size: 12px;
  font-weight: 800;
  opacity: 0;
  transform: translateX(-6px);
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.pp-card:hover .pp-open {
  opacity: 1;
  transform: translateX(0);
}

/* Cloning shimmer */
.pp-card.cloning .pp-front::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    100deg,
    transparent 20%,
    color-mix(in srgb, var(--pa) 22%, transparent) 50%,
    transparent 80%
  );
  background-size: 220% 100%;
  animation: pp-clone-sweep 1.1s linear infinite;
}

@keyframes pp-clone-sweep {
  from {
    background-position: 130% 0;
  }
  to {
    background-position: -130% 0;
  }
}

/* Delete back face */
.pp-back-warn {
  flex-shrink: 0;
  color: var(--danger);
  animation: pp-wobble 1.6s ease-in-out infinite;
}

.pp-back-warn.small {
  animation: none;
}

@keyframes pp-wobble {
  0%,
  100% {
    transform: rotate(-7deg) scale(1);
  }
  50% {
    transform: rotate(7deg) scale(1.1);
  }
}

.pp-back-title {
  margin: 0;
  color: var(--t1);
  font-size: 13.5px;
  font-weight: 800;
}

.pp-back-body {
  margin: 0;
  color: var(--t2);
  font-size: 13px;
  line-height: 1.55;
}

.pp-back-actions {
  display: flex;
  gap: 9px;
  margin-top: 6px;
}

.pp-back-keep {
  min-height: var(--ctl-md);
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 700;
  padding: 0 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pp-back-keep:hover {
  background: var(--hover);
}

.pp-back-del {
  min-height: var(--ctl-md);
  border: none;
  border-radius: 9px;
  background: var(--danger);
  color: var(--on-accent);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 700;
  padding: 0 14px;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 3px 14px rgba(var(--danger-rgb), 0.4);
}

.pp-back-del:hover:not(:disabled) {
  filter: brightness(1.12);
  transform: translateY(-1px);
}

.pp-back-del:disabled {
  opacity: 0.6;
  cursor: wait;
}

/* New-project portal card */
.pp-card-new {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 208px;
  border-radius: 18px;
  outline: 1.5px dashed var(--border);
  outline-offset: -1.5px;
  background: transparent;
  color: var(--t3);
  font-family: var(--font);
  cursor: pointer;
  overflow: visible;
  box-shadow: none;
  transition:
    outline-color 0.25s ease,
    color 0.25s ease,
    transform 0.2s ease;
}

.pp-card-new::before {
  display: none;
}

.pp-card-new:hover {
  outline-color: var(--accent);
  color: var(--accent);
  transform: translateY(-3px);
}

.pp-portal {
  position: relative;
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
}

.pp-portal-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1.5px dashed var(--border);
  transition: border-color 0.25s ease;
  animation: pp-orbit 14s linear infinite;
}

.pp-card-new:hover .pp-portal-ring {
  border-color: var(--accent);
  animation-duration: 3.2s;
  box-shadow: 0 0 22px rgba(var(--accent-rgb), 0.35);
}

.pp-portal-plus {
  transition: transform 0.35s cubic-bezier(0.34, 1.4, 0.64, 1);
}

.pp-card-new:hover .pp-portal-plus {
  transform: rotate(90deg) scale(1.2);
}

.pp-new-label {
  font-size: 13px;
  font-weight: 700;
}

.pp-new-quota {
  font-size: 11.5px;
  color: var(--t3);
  font-variant-numeric: tabular-nums;
}

/* Grid FLIP + leave */
.pgrid-move {
  transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
}

.pgrid-leave-active {
  position: absolute;
  transition:
    opacity 0.3s ease,
    transform 0.35s ease;
}

.pgrid-leave-to {
  opacity: 0;
  transform: scale(0.8) rotate(2deg);
}

.pgrid-enter-active {
  transition:
    opacity 0.4s ease,
    transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

.pgrid-enter-from {
  opacity: 0;
  transform: translateY(22px) scale(0.92);
}

/* ── List view ───────────────────────────────────────────────────────────── */
.pp-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 22px;
}

.pp-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px 10px 10px;
  border: 1px solid color-mix(in srgb, var(--pa) 16%, var(--border));
  border-radius: 14px;
  background: linear-gradient(90deg, var(--pa-soft), transparent 30%), var(--surface);
  cursor: pointer;
  animation: pp-row-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) var(--d, 0ms) both;
  transition:
    transform 0.2s ease,
    border-color 0.25s ease,
    box-shadow 0.25s ease;
}

@keyframes pp-row-in {
  from {
    opacity: 0;
    transform: translateX(-24px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.pp-row:hover {
  transform: translateX(5px);
  border-color: color-mix(in srgb, var(--pa) 50%, var(--border));
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
}

.pp-row.live {
  border-color: rgba(var(--accent-rgb), 0.5);
}

.pp-row.confirming {
  border-color: rgba(var(--danger-rgb), 0.55);
  background: linear-gradient(90deg, rgba(var(--danger-rgb), 0.1), transparent 60%), var(--surface);
  animation: pp-shake 0.4s ease;
}

@keyframes pp-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-5px);
  }
  75% {
    transform: translateX(5px);
  }
}

.pp-row-const {
  flex-shrink: 0;
  width: 86px;
  height: 40px;
  border-radius: 9px;
  overflow: hidden;
  background: color-mix(in srgb, var(--pa) 7%, transparent);
}

.pp-row-const svg {
  width: 100%;
  height: 100%;
  display: block;
}

.pp-row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pp-row-toprow {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.pp-row-toprow .pp-name {
  flex: 0 1 auto;
}

.pp-row-desc {
  color: var(--t3);
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pp-row-desc.empty {
  font-style: italic;
  opacity: 0.6;
}

.pp-row-counts {
  margin-top: 0;
  flex-shrink: 0;
}

.pp-row-date {
  margin-left: 0;
  flex-shrink: 0;
  min-width: 78px;
  text-align: right;
}

.pp-row-kebabwrap {
  position: relative;
  flex-shrink: 0;
}

.pp-row-confirm {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 40px;
}

.pp-row-confirm-text {
  flex: 1;
  color: var(--t2);
  font-size: 12.5px;
  line-height: 1.4;
}

.plist-move {
  transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

.plist-leave-active {
  position: absolute;
  width: 100%;
  transition:
    opacity 0.28s ease,
    transform 0.32s ease;
}

.plist-leave-to {
  opacity: 0;
  transform: translateX(40px);
}

.plist-enter-active {
  transition:
    opacity 0.35s ease,
    transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

.plist-enter-from {
  opacity: 0;
  transform: translateX(-24px);
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
.pp-empty {
  text-align: center;
  padding: 70px 0 30px;
}

.pp-empty-scope {
  display: inline-block;
  color: var(--t3);
  animation: pp-float 3.2s ease-in-out infinite;
}

@keyframes pp-float {
  0%,
  100% {
    transform: translateY(0) rotate(-6deg);
  }
  50% {
    transform: translateY(-12px) rotate(6deg);
  }
}

.pp-empty-title {
  margin: 14px 0 2px;
  color: var(--t1);
  font-size: 15px;
  font-weight: 700;
}

.pp-empty-sub {
  margin: 0;
  color: var(--t3);
  font-size: 13px;
}

/* ── Edit dialog ─────────────────────────────────────────────────────────── */
.pp-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  padding: 20px;
}

.pp-modal {
  width: min(430px, 100%);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.pp-modal-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 4px;
  color: var(--t1);
  font-size: 17px;
  font-weight: 800;
}

.pp-modal-title .ui-icon {
  flex-shrink: 0;
  color: var(--accent);
}

.pp-label {
  color: var(--t2);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 5px;
}

.pp-input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  font-size: 13px;
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.pp-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--adim);
}

.pp-textarea {
  resize: vertical;
  line-height: 1.5;
}

.pp-charcount {
  align-self: flex-end;
  color: var(--t3);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  margin-top: -4px;
}

.pp-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.pp-swatch {
  width: 25px;
  height: 25px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  transition:
    transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1),
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.pp-swatch:hover {
  transform: scale(1.2);
}

.pp-swatch.active {
  border-color: var(--t1);
  transform: scale(1.2);
  box-shadow: 0 0 0 3px var(--adim);
}

.pp-swatch-auto {
  background: var(--elevated);
  border: 2px dashed var(--border);
  color: var(--t2);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pp-swatch-auto.active {
  border-style: solid;
  border-color: var(--accent);
  color: var(--accent);
}

.pp-seg {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: var(--elevated);
  padding: 3px;
}

.pp-seg-slider {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 3px;
  width: calc(50% - 3px);
  border-radius: 8px;
  background: var(--adim);
  border: 1px solid rgba(var(--accent-rgb), 0.4);
  transition: transform 0.3s cubic-bezier(0.34, 1.3, 0.64, 1);
}

.pp-seg.pub .pp-seg-slider {
  transform: translateX(100%);
}

.pp-seg-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: var(--ctl-md);
  border: none;
  background: transparent;
  color: var(--t3);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 700;
  padding: 0;
  cursor: pointer;
  border-radius: 8px;
  transition: color 0.2s ease;
}

.pp-seg-btn.on {
  color: var(--accent);
}

.pp-ad {
  margin-top: 28px;
}

.pp-access-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.pp-access-opt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    transform 0.2s ease;
}

.pp-access-opt:hover {
  transform: translateY(-1px);
  color: var(--t1);
}

.pp-access-opt.on {
  border-color: rgba(var(--accent-rgb), 0.6);
  background: var(--adim);
  color: var(--accent);
}

.pp-access-icon {
  flex-shrink: 0;
  margin-bottom: 2px;
}

.pp-access-name {
  font-size: 12.5px;
  font-weight: 800;
}

.pp-access-short {
  font-size: 11.5px;
  color: var(--t3);
  text-align: center;
  line-height: 1.3;
}

.pp-modal-note {
  margin: 2px 0 0;
  color: var(--t3);
  font-size: 12.5px;
  line-height: 1.5;
}

.pp-modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
}

.pp-modal-error {
  margin-right: auto;
  color: var(--danger);
  font-size: 12.5px;
}

.pp-btn-ghost {
  min-height: var(--ctl-md);
  border: 1px solid var(--border);
  border-radius: 10px;
  background: transparent;
  color: var(--t2);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 700;
  padding: 0 16px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pp-btn-ghost:hover {
  background: var(--hover);
  color: var(--t1);
}

.pp-btn-primary {
  min-height: var(--ctl-md);
  border: none;
  border-radius: 10px;
  background: var(--accent);
  color: var(--on-accent);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 700;
  padding: 0 18px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pp-btn-primary:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.pp-btn-primary:disabled {
  opacity: 0.5;
  cursor: wait;
}

.pp-modal-enter-active {
  transition: opacity 0.25s ease;
}

.pp-modal-enter-active .pp-modal {
  transition: transform 0.35s cubic-bezier(0.34, 1.3, 0.64, 1);
}

.pp-modal-leave-active {
  transition: opacity 0.18s ease;
}

.pp-modal-enter-from,
.pp-modal-leave-to {
  opacity: 0;
}

.pp-modal-enter-from .pp-modal {
  transform: translateY(24px) scale(0.94);
}

.pp-fade-enter-active,
.pp-fade-leave-active {
  transition: opacity 0.2s ease;
}

.pp-fade-enter-from,
.pp-fade-leave-to {
  opacity: 0;
}

/* ── Toast ───────────────────────────────────────────────────────────────── */
.pp-toast {
  position: absolute;
  bottom: 26px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  padding: 9px 18px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid rgba(var(--accent-rgb), 0.45);
  box-shadow:
    0 10px 32px rgba(0, 0, 0, 0.35),
    0 0 18px rgba(var(--accent-rgb), 0.2);
  color: var(--t1);
  font-size: 12.5px;
  font-weight: 700;
  max-width: min(520px, 86vw);
  text-align: center;
  pointer-events: none;
}

.pp-toast.err {
  border-color: rgba(var(--danger-rgb), 0.55);
  box-shadow:
    0 10px 32px rgba(0, 0, 0, 0.35),
    0 0 18px rgba(var(--danger-rgb), 0.25);
}

.pp-toast-enter-active {
  transition:
    opacity 0.25s ease,
    transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.pp-toast-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.pp-toast-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(18px) scale(0.9);
}

.pp-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px) scale(0.96);
}

/* ── Page enter/leave ────────────────────────────────────────────────────── */
.ppage-enter-active {
  transition:
    opacity 0.32s ease,
    transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
}

.ppage-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.ppage-enter-from {
  opacity: 0;
  transform: translateY(24px) scale(0.99);
}

.ppage-leave-to {
  opacity: 0;
  transform: scale(1.015);
}

@media (max-width: 760px) {
  .pp-toolbar-right {
    margin-left: 0;
  }
  .pp-stats {
    gap: 22px;
  }
  .pp-row-counts,
  .pp-row-date {
    display: none;
  }
}

/* ── 水墨 ink theme ───────────────────────────────────────────────────────
   The library is an album of small mounted paintings on rice paper (the
   <InkBackdrop> replaces the starfield, whose rAF loop never starts in ink).
   Each project card is a leaf in a silk mount; its constellation is drawn in
   ink with the project's colour ground into it. */
:root[data-theme='ink'] .pp-root {
  background: var(--bg);
}
:root[data-theme='ink'] .pp-sky,
:root[data-theme='ink'] .pp-aurora {
  display: none;
}
:root[data-theme='ink'] .pp-back,
:root[data-theme='ink'] .pp-search :deep(.sf-input),
:root[data-theme='ink'] .pp-chip,
:root[data-theme='ink'] .pp-sort-select,
:root[data-theme='ink'] .pp-viewtoggle,
:root[data-theme='ink'] .pp-viewbtn,
:root[data-theme='ink'] .pp-vis,
:root[data-theme='ink'] .pp-live,
:root[data-theme='ink'] .pp-kebab,
:root[data-theme='ink'] .pp-menu-item,
:root[data-theme='ink'] .pp-btn-ghost,
:root[data-theme='ink'] .pp-input,
:root[data-theme='ink'] .pp-seg,
:root[data-theme='ink'] .pp-seg-btn,
:root[data-theme='ink'] .pp-access-opt,
:root[data-theme='ink'] .pp-back-keep,
:root[data-theme='ink'] .pp-back-del,
:root[data-theme='ink'] .pp-row {
  border-radius: 3px 5px 4px 6px / 5px 3px 6px 4px;
}
:root[data-theme='ink'] .pp-back,
:root[data-theme='ink'] .pp-chip,
:root[data-theme='ink'] .pp-btn-ghost,
:root[data-theme='ink'] .pp-menu-item,
:root[data-theme='ink'] .pp-seg-btn {
  font-family: var(--font-ink-label);
  font-size: 13px;
}
:root[data-theme='ink'] .pp-back {
  background: rgba(255, 251, 240, 0.55);
}
/* the CTA is a seal impression */
:root[data-theme='ink'] .pp-new,
:root[data-theme='ink'] .pp-btn-primary {
  border-radius: 2px 4px 3px 5px / 4px 2px 5px 3px;
  background:
    var(--ink-paper-light, none) center / 256px 256px,
    var(--accent);
  background-blend-mode: multiply, normal;
  box-shadow:
    inset 0 0 0 1px rgba(90, 15, 10, 0.3),
    inset 0 0 6px rgba(90, 15, 10, 0.25),
    0 3px 10px rgba(140, 36, 28, 0.25);
  font-family: var(--font-ink-label);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--on-accent);
}
:root[data-theme='ink'] .pp-new::after {
  background: linear-gradient(100deg, transparent, rgba(60, 10, 5, 0.22), transparent);
}
:root[data-theme='ink'] .pp-quota-fill {
  stroke: var(--accent);
}

:root[data-theme='ink'] .pp-title {
  position: relative;
  display: inline-block;
  font-family: var(--font-brush);
  font-weight: 400;
  font-size: clamp(40px, 6vw, 64px);
  letter-spacing: 0.01em;
  background: none;
  -webkit-text-fill-color: currentColor;
  color: var(--t1);
  animation: pp-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}
:root[data-theme='ink'] .pp-title::after {
  content: '';
  position: absolute;
  left: 4%;
  right: -2%;
  bottom: -2px;
  height: 14px;
  background-color: var(--accent);
  opacity: 0.7;
  -webkit-mask: var(--ink-underline) center / 100% 100% no-repeat;
  mask: var(--ink-underline) center / 100% 100% no-repeat;
  animation: pp-ink-write 1.1s 0.35s var(--ease-out) backwards;
}
@keyframes pp-ink-write {
  from {
    clip-path: inset(0 100% 0 0);
  }
  to {
    clip-path: inset(0 0 0 0);
  }
}
:root[data-theme='ink'] .pp-subtitle {
  font-size: 16px;
  font-style: italic;
  color: var(--t2);
}
:root[data-theme='ink'] .pp-stat-num {
  font-family: var(--font-brush);
  font-weight: 400;
  font-size: 34px;
}
:root[data-theme='ink'] .pp-stat-label,
:root[data-theme='ink'] .pp-label {
  font-family: var(--font-ink-label);
  font-size: 12.5px;
  font-weight: 600;
  font-variant: small-caps;
  text-transform: lowercase;
  letter-spacing: 0.14em;
}
:root[data-theme='ink'] .pp-toolbar {
  border-radius: 2px;
  border-color: var(--ink-mount-line);
  background: var(--ink-sheet), color-mix(in srgb, var(--surface) 90%, transparent);
  background-size: 512px 512px;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow:
    0 0 0 3px var(--ink-silk),
    0 0 0 4px rgba(58, 42, 22, 0.2),
    0 8px 20px rgba(60, 40, 15, 0.1);
}
:root[data-theme='ink'] .pp-search :deep(.sf-input) {
  background: rgba(255, 251, 240, 0.55);
}
:root[data-theme='ink'] .pp-chip.active {
  background: rgba(179, 53, 42, 0.08);
}

/* cards: leaves of an album, each in a narrow silk mount */
:root[data-theme='ink'] .pp-card {
  border-radius: 2px;
  outline-color: var(--ink-mount-line);
  box-shadow:
    0 0 0 3px var(--ink-silk),
    0 0 0 4px rgba(58, 42, 22, 0.22),
    0 8px 18px rgba(60, 40, 15, 0.14);
}
:root[data-theme='ink'] .pp-card:hover {
  outline-color: rgba(48, 36, 20, 0.45);
  box-shadow:
    0 0 0 3px var(--ink-silk),
    0 0 0 4px rgba(58, 42, 22, 0.3),
    0 18px 34px rgba(60, 40, 15, 0.22);
}
:root[data-theme='ink'] .pp-card.fav {
  outline-color: rgba(179, 53, 42, 0.45);
}
:root[data-theme='ink'] .pp-card::before,
:root[data-theme='ink'] .pp-glare {
  display: none;
}
:root[data-theme='ink'] .pp-face {
  border-radius: 1px;
}
:root[data-theme='ink'] .pp-front {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--pa) 13%, transparent), transparent 40%),
    var(--ink-sheet), var(--surface);
  background-size:
    100% 100%,
    512px 512px;
}
:root[data-theme='ink'] .pp-const-line {
  stroke: var(--ink-black);
  stroke-width: 0.9;
  opacity: 0.45;
}
:root[data-theme='ink'] .pp-const-star {
  fill: color-mix(in srgb, var(--pa) 35%, var(--ink-black));
}
:root[data-theme='ink'] .pp-const-star.big {
  filter: none;
}
:root[data-theme='ink'] .pp-name {
  font-family: var(--font-brush);
  font-size: 19px;
  font-weight: 400;
  letter-spacing: 0.01em;
}
:root[data-theme='ink'] .pp-desc {
  font-size: 13px;
}
:root[data-theme='ink'] .pp-live {
  background: transparent;
  font-family: var(--font-ink-label);
  font-size: 11px;
  letter-spacing: 0.12em;
}
:root[data-theme='ink'] .pp-live-dot {
  border-radius: 46% 54% 40% 60% / 55% 42% 58% 45%;
}
:root[data-theme='ink'] .pp-menu {
  border-radius: 2px;
  border-color: var(--ink-mount-line);
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow:
    0 0 0 2px var(--ink-silk),
    0 0 0 3px rgba(58, 42, 22, 0.2),
    var(--shadow-lg);
}
:root[data-theme='ink'] .pp-backface {
  background:
    linear-gradient(165deg, rgba(var(--danger-rgb), 0.1), transparent 55%), var(--ink-sheet),
    var(--surface);
  background-size:
    100% 100%,
    512px 512px;
}
:root[data-theme='ink'] .pp-back-title,
:root[data-theme='ink'] .pp-modal-title,
:root[data-theme='ink'] .pp-empty-title {
  font-family: var(--font-brush);
  font-size: 22px;
  font-weight: 400;
}
/* the "new project" leaf: an empty sheet with an ensō waiting */
:root[data-theme='ink'] .pp-card-new {
  border-radius: 2px;
  outline: 1px dashed rgba(48, 36, 20, 0.35);
  background: rgba(255, 251, 240, 0.35);
}
:root[data-theme='ink'] .pp-card-new:hover {
  outline-color: rgba(179, 53, 42, 0.6);
  background: rgba(255, 251, 240, 0.6);
}
:root[data-theme='ink'] .pp-portal {
  width: 74px;
  height: 74px;
}
:root[data-theme='ink'] .pp-portal-ring {
  inset: 0;
  border: none;
  border-radius: 0;
  background-color: var(--ink-black);
  opacity: 0.7;
  -webkit-mask: var(--ink-enso) center / contain no-repeat;
  mask: var(--ink-enso) center / contain no-repeat;
  animation: pp-orbit 40s linear infinite;
}
:root[data-theme='ink'] .pp-card-new:hover .pp-portal-ring {
  background-color: var(--accent);
  box-shadow: none;
  animation-duration: 12s;
}
:root[data-theme='ink'] .pp-new-label {
  font-family: var(--font-brush);
  font-size: 18px;
  font-weight: 400;
}
:root[data-theme='ink'] .pp-row {
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
}
:root[data-theme='ink'] .pp-modal {
  position: relative;
}
:root[data-theme='ink'] .pp-toast {
  border-radius: 2px;
  font-family: var(--font-ink-label);
}
@media (prefers-reduced-motion: reduce) {
  :root[data-theme='ink'] .pp-title::after {
    animation: none;
  }
}
</style>
