<template>
  <div class="bd-backdrop ink-veil" @click.self="emit('close')">
    <div
      class="bd-panel ink-mount ink-unroll"
      role="dialog"
      aria-modal="true"
      :aria-label="project.title"
      :style="{ '--h': project.hue }"
    >
      <!-- ── Hero band ────────────────────────────────────────────────────── -->
      <header class="bd-hero">
        <div class="bd-hero-sky"></div>
        <UiIcon class="bd-hero-crest" :name="project.crest" :size="110" :stroke="1.25" />
        <button
          class="bd-close"
          :title="t('browse.detail.close')"
          :aria-label="t('browse.detail.close')"
          @click="emit('close')"
        >
          <UiIcon name="x" :size="18" />
        </button>
        <div class="bd-hero-text">
          <div class="bd-hero-meta">
            <span class="bd-pill mode" :class="'mode-' + project.access">
              <UiIcon :name="ACCESS_ICONS[project.access]" :size="13" />
              {{ t('browse.modes.' + project.access + '.name') }}
            </span>
            <span v-if="project.badge" class="bd-pill">{{
              t('browse.badges.' + project.badge)
            }}</span>
            <span class="bd-pill">{{ t('browse.genres.' + project.genre) }}</span>
            <span class="bd-pill">{{ t('browse.langs.' + project.lang) }}</span>
            <span class="bd-pill">
              <UiIcon name="calendar" :size="13" />
              {{ project.era }}
            </span>
          </div>
          <h2 class="bd-title">{{ project.title }}</h2>
          <p class="bd-blurb">{{ project.blurb }}</p>
          <div class="bd-hero-row">
            <button v-if="author" class="bd-author" @click="emit('author', author.id)">
              <span class="bd-avatar" :style="{ '--ah': author.hue }">
                <UiIcon :name="author.avatar" :size="16" />
              </span>
              <span>
                <span class="bd-author-name">{{ author.displayName }}</span>
                <span class="bd-author-handle">@{{ author.username }}</span>
              </span>
            </button>
            <span class="bd-updated">{{
              t('browse.detail.updated', { ago: ago(project.updatedAgo) })
            }}</span>
            <div class="bd-hero-actions">
              <button
                class="bd-heart"
                :class="{ on: liked, pop: likePop }"
                :title="liked ? t('browse.card.unlike') : t('browse.card.like')"
                :aria-pressed="liked"
                @click="like"
                @animationend="likePop = false"
              >
                <UiIcon name="heart" :size="16" />
                <span>{{ compactNum(project.likes + (liked ? 1 : 0)) }}</span>
              </button>
              <button
                class="bd-save"
                :class="{ on: saved }"
                :aria-pressed="saved"
                @click="signals.toggleSave(project.id)"
              >
                <UiIcon name="bookmark" :size="16" />
                {{ saved ? t('browse.detail.saved') : t('browse.card.save') }}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div class="bd-scroll">
        <div class="bd-body">
          <!-- ── Left: the tree itself ─────────────────────────────────── -->
          <section class="bd-left">
            <div class="bd-tree">
              <MiniTree
                ref="treeRef"
                :layout="tree"
                variant="full"
                :selected="selectedId"
                :highlight="highlight"
                @pick="selectedId = $event"
              />
              <div class="bd-tree-tools">
                <button
                  class="bd-tool"
                  :title="t('browse.detail.zoomIn')"
                  :aria-label="t('browse.detail.zoomIn')"
                  @click="treeRef?.zoomIn()"
                >
                  <UiIcon name="zoom-in" :size="14" />
                </button>
                <button
                  class="bd-tool"
                  :title="t('browse.detail.zoomOut')"
                  :aria-label="t('browse.detail.zoomOut')"
                  @click="treeRef?.zoomOut()"
                >
                  <UiIcon name="zoom-out" :size="14" />
                </button>
                <button class="bd-tool wide" @click="treeRef?.fit()">
                  <UiIcon name="maximize" :size="14" />
                  {{ t('browse.detail.fit') }}
                </button>
              </div>
              <div class="bd-legend">
                <span><i class="lg parent"></i>{{ t('browse.detail.legend.parent') }}</span>
                <span><i class="lg spouse"></i>{{ t('browse.detail.legend.spouse') }}</span>
                <span><i class="lg rival"></i>{{ t('browse.detail.legend.rival') }}</span>
                <span><i class="lg other"></i>{{ t('browse.detail.legend.other') }}</span>
              </div>
              <p class="bd-tree-hint">{{ t('browse.detail.zoomHint') }}</p>

              <!-- Person inspector -->
              <Transition name="bd-pop">
                <aside v-if="selected" :key="selected.id" class="bd-person">
                  <button
                    class="bd-person-x"
                    :title="t('browse.detail.close')"
                    :aria-label="t('browse.detail.close')"
                    @click="selectedId = null"
                  >
                    <UiIcon name="x" :size="14" />
                  </button>
                  <div class="bd-person-head">
                    <span class="bd-person-dot" :class="selected[2]">{{
                      [...selected[1]][0]
                    }}</span>
                    <div>
                      <h4>{{ selected[1] }}</h4>
                      <p v-if="selected[5]">{{ selected[5] }}</p>
                    </div>
                  </div>
                  <p v-if="lifespan(selected)" class="bd-person-years">{{ lifespan(selected) }}</p>
                  <p v-if="selected[6]" class="bd-person-bio">{{ selected[6] }}</p>
                  <h5>{{ t('browse.detail.bonds') }}</h5>
                  <ul v-if="bondsOf(selected[0]).length" class="bd-bonds">
                    <li v-for="(b, i) in bondsOf(selected[0])" :key="i">
                      <span class="bd-bond-verb" :class="'t-' + b.type">{{ b.verb }}</span>
                      <button class="bd-bond-who" @click="selectedId = b.otherId">
                        {{ b.other }}
                      </button>
                      <em v-if="b.label">· {{ b.label }}</em>
                    </li>
                  </ul>
                  <p v-else class="bd-muted">{{ t('browse.detail.noBonds') }}</p>
                </aside>
              </Transition>
            </div>

            <!-- Cast -->
            <div class="bd-card">
              <div class="bd-card-head">
                <h3>
                  <UiIcon name="users" :size="16" />
                  {{ t('browse.detail.cast') }}
                  <span class="bd-count">{{ project.people.length }}</span>
                </h3>
                <SearchField
                  v-model="castQuery"
                  class="bd-cast-search"
                  size="sm"
                  :placeholder="t('browse.detail.castPh')"
                />
              </div>
              <div class="bd-cast">
                <button
                  v-for="p in cast"
                  :key="p[0]"
                  class="bd-cast-chip"
                  :class="[p[2], { on: p[0] === selectedId }]"
                  @click="selectedId = p[0] === selectedId ? null : p[0]"
                >
                  <span class="bd-cast-dot">{{ [...p[1]][0] }}</span>
                  <span class="bd-cast-name">{{ p[1] }}</span>
                  <span v-if="p[5]" class="bd-cast-role">{{ p[5] }}</span>
                </button>
                <p v-if="!cast.length" class="bd-muted">{{ t('browse.emptyTitle') }}</p>
              </div>
            </div>
          </section>

          <!-- ── Right: access, stats, facts, comments ─────────────────── -->
          <section class="bd-right">
            <div class="bd-card bd-access" :class="'mode-' + project.access">
              <div class="bd-access-head">
                <span class="bd-access-icon">
                  <UiIcon :name="ACCESS_ICONS[project.access]" :size="24" />
                </span>
                <div>
                  <p class="bd-eyebrow">{{ t('browse.detail.access') }}</p>
                  <h3>{{ t('browse.modes.' + project.access + '.name') }}</h3>
                  <p class="bd-access-desc">{{ t('browse.modes.' + project.access + '.desc') }}</p>
                </div>
              </div>
              <ul class="bd-caps">
                <li v-for="c in CAPABILITIES" :key="c" :class="{ ok: can(project.access, c) }">
                  <span class="bd-cap-mark">
                    <UiIcon :name="can(project.access, c) ? 'check' : 'lock'" :size="14" />
                  </span>
                  <span class="bd-cap-name">{{ t('browse.caps.' + c) }}</span>
                  <span class="bd-cap-note">
                    {{
                      can(project.access, c) ? t('browse.capsYes.' + c) : t('browse.capsNo.' + c)
                    }}
                  </span>
                </li>
              </ul>
              <div class="bd-actions">
                <button v-if="can(project.access, 'export')" class="bd-act" @click="download">
                  <UiIcon name="download" :size="16" />
                  {{ t('browse.detail.download') }}
                </button>
                <template v-if="can(project.access, 'fork')">
                  <button v-if="graftCopy" class="bd-act primary" @click="openCopy(graftCopy.id)">
                    <UiIcon name="external-link" :size="16" />
                    {{ t('browse.detail.openCopy') }}
                  </button>
                  <button v-else class="bd-act primary" :disabled="busy === 'graft'" @click="graft">
                    <span v-if="busy === 'graft'" class="bd-spin"></span>
                    <UiIcon v-else name="git-fork" :size="16" />
                    {{ busy === 'graft' ? t('browse.detail.grafting') : t('browse.detail.graft') }}
                  </button>
                </template>
                <template v-if="can(project.access, 'edit')">
                  <button v-if="!grove" class="bd-act grove" @click="join">
                    <UiIcon name="users" :size="16" />
                    {{ t('browse.detail.join') }}
                  </button>
                  <div v-else class="bd-grove" :class="grove">
                    <span v-if="grove === 'pending'" class="bd-spin"></span>
                    <UiIcon v-else name="check" :size="16" />
                    <span>{{
                      grove === 'pending' ? t('browse.detail.pending') : t('browse.detail.member')
                    }}</span>
                  </div>
                </template>
                <p v-if="!can(project.access, 'export')" class="bd-muted">
                  {{ t('browse.detail.glassNote') }}
                </p>
                <p v-if="grove === 'member'" class="bd-muted">
                  {{ t('browse.detail.memberNote') }}
                </p>
              </div>
            </div>

            <div class="bd-stats">
              <div v-for="s in stats" :key="s.key" class="bd-stat">
                <span class="bd-stat-num">{{ s.value }}</span>
                <span class="bd-stat-label">{{ s.label }}</span>
              </div>
            </div>

            <div class="bd-card">
              <h3>
                <UiIcon name="sparkles" :size="16" />
                {{ t('browse.detail.facts') }}
              </h3>
              <ul class="bd-facts">
                <li v-for="f in facts" :key="f.key" :style="{ '--i': facts.indexOf(f) }">
                  <span class="bd-fact-icon"><UiIcon :name="f.icon" :size="16" /></span>
                  <span>{{ t('browse.facts.' + f.key, { name: f.name, n: f.n }) }}</span>
                </li>
              </ul>
              <div v-if="project.groups" class="bd-groups">
                <span v-for="(members, g) in project.groups" :key="g" class="bd-group">
                  {{ g }} <b>{{ members.length }}</b>
                </span>
              </div>
              <div class="bd-tags">
                <button
                  v-for="tag in project.tags"
                  :key="tag"
                  class="bd-tag"
                  @click="emit('search', tag)"
                >
                  #{{ tag }}
                </button>
              </div>
            </div>

            <div class="bd-card">
              <h3>
                <UiIcon name="message-circle" :size="16" />
                {{ t('browse.detail.comments') }}
                <span class="bd-count">{{ comments.length }}</span>
              </h3>
              <ul class="bd-comments">
                <li v-for="(c, i) in comments" :key="i" :class="{ mine: c.mine }">
                  <span class="bd-avatar sm" :style="{ '--ah': c.hue }">
                    <UiIcon :name="c.avatar" :size="14" />
                  </span>
                  <div>
                    <p class="bd-c-head">
                      <button
                        v-if="c.profileId"
                        class="bd-c-name"
                        @click="emit('author', c.profileId)"
                      >
                        {{ c.name }}
                      </button>
                      <b v-else class="bd-c-name">{{ c.name }}</b>
                      <span>{{ c.when }}</span>
                    </p>
                    <p class="bd-c-text">{{ c.text }}</p>
                  </div>
                </li>
              </ul>
              <form class="bd-c-form" @submit.prevent="postComment">
                <input
                  v-model="draft"
                  maxlength="280"
                  :placeholder="t('browse.detail.commentPh')"
                />
                <button class="bd-act primary sm" :disabled="!draft.trim()">
                  {{ t('browse.detail.post') }}
                </button>
              </form>
            </div>
          </section>
        </div>

        <!-- ── Similar ────────────────────────────────────────────────────── -->
        <section class="bd-similar">
          <h3>{{ t('browse.detail.similar') }}</h3>
          <div class="bd-similar-row">
            <BrowseCard
              v-for="(p, i) in similar"
              :key="p.id"
              :project="p"
              :author="profileById.get(p.authorId)"
              :liked="signals.isLiked(p.id)"
              :saved="signals.isSaved(p.id)"
              :delay="i * 60"
              compact
              @open="emit('open', $event)"
              @like="signals.toggleLike($event)"
              @save="signals.toggleSave($event)"
              @author="emit('author', $event)"
            />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useMainStore } from '../../store/index.js'
import { useI18n } from '../../i18n'
import { toast } from '../../lib/dialogs.js'
import MiniTree from './MiniTree.vue'
import BrowseCard from './BrowseCard.vue'
import SearchField from '../ui/SearchField.vue'
import UiIcon from '../ui/UiIcon.js'
import { PROFILES, PROJECTS } from './browseData'
import {
  ACCESS_ICONS,
  CAPABILITIES,
  can,
  fold,
  funFacts,
  relsOf,
  similarProjects,
  toProjectFile,
  treeOf
} from './browseModel'

const props = defineProps({
  project: { type: Object, required: true },
  signals: { type: Object, required: true },
  /** Person names to glow (from the search that led here). */
  highlight: { type: Array, default: () => [] }
})
const emit = defineEmits(['close', 'author', 'open', 'search'])
const store = useMainStore()
const { t, locale } = useI18n()

const profileById = new Map(PROFILES.map((p) => [p.id, p]))
const author = computed(() => profileById.get(props.project.authorId))
const tree = computed(() => treeOf(props.project))
const facts = computed(() => funFacts(props.project))
const similar = computed(() => similarProjects(props.project, PROJECTS, 4))
const liked = computed(() => props.signals.isLiked(props.project.id))
const saved = computed(() => props.signals.isSaved(props.project.id))
const grove = computed(() => props.signals.state.grove[props.project.id] || null)
// The graft only counts while its project still exists (it may have been deleted).
const graftCopy = computed(() => {
  const id = props.signals.state.grafts[props.project.id]
  return id ? store.projects.find((p) => p.id === id) || null : null
})

const treeRef = ref(null)
const selectedId = ref(null)
const castQuery = ref('')
const busy = ref(null)
const likePop = ref(false)
const draft = ref('')

// A new project in the same dialog (a "similar" click) starts fresh.
watch(
  () => props.project.id,
  () => {
    selectedId.value = null
    castQuery.value = ''
    draft.value = ''
    props.signals.markViewed(props.project.id)
  },
  { immediate: true }
)

const selected = computed(() => props.project.people.find((p) => p[0] === selectedId.value) || null)
const cast = computed(() => {
  const q = fold(castQuery.value.trim())
  const list = props.project.people
  return q ? list.filter((p) => fold(`${p[1]} ${p[5] || ''}`).includes(q)) : list
})

const nameOf = computed(() => new Map(props.project.people.map((p) => [p[0], p[1]])))
function bondsOf(id) {
  const out = []
  for (const r of relsOf(props.project)) {
    if (r.a !== id && r.b !== id) continue
    const fwd = r.a === id
    const otherId = fwd ? r.b : r.a
    out.push({
      type: r.type,
      verb: t(`browse.bonds.${r.type}.${fwd ? 'fwd' : 'back'}`),
      other: nameOf.value.get(otherId),
      otherId,
      label: r.label
    })
  }
  return out
}
function lifespan(p) {
  if (p[3] == null && p[4] == null) return ''
  return `${p[3] ?? '?'} – ${p[4] ?? ''}`
}

const stats = computed(() => [
  { key: 'people', value: props.project.people.length, label: t('browse.stats.people') },
  { key: 'gens', value: tree.value.generations, label: t('browse.stats.gens') },
  { key: 'forks', value: compactNum(props.project.forks), label: t('browse.stats.forks') },
  { key: 'views', value: compactNum(props.project.views), label: t('browse.stats.views') }
])

function compactNum(n) {
  return new Intl.NumberFormat(locale.value, {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(n)
}
function ago(days) {
  const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
  if (days < 1 / 24) return rtf.format(-Math.max(1, Math.round(days * 1440)), 'minute')
  if (days < 1) return rtf.format(-Math.round(days * 24), 'hour')
  if (days < 30) return rtf.format(-Math.round(days), 'day')
  return rtf.format(-Math.round(days / 30), 'month')
}

// Mock comments + the viewer's own (stored locally until the backend lands).
const comments = computed(() => {
  const base = props.project.comments.map(([pid, text, days]) => {
    const p = profileById.get(pid)
    return {
      profileId: pid,
      name: p?.displayName,
      avatar: p?.avatar,
      hue: p?.hue,
      text,
      when: ago(days),
      sortKey: -days
    }
  })
  const mine = (props.signals.state.comments[props.project.id] || []).map((c) => ({
    mine: true,
    name: store.authUser?.display_name || store.authUser?.username || t('browse.detail.you'),
    avatar: 'sprout',
    hue: store.authUser?.avatar_hue ?? 200,
    text: c.text,
    when: ago((Date.now() - c.at) / 86400000),
    sortKey: c.at
  }))
  return [...base.sort((a, b) => a.sortKey - b.sortKey), ...mine]
})
function postComment() {
  const text = draft.value.trim()
  if (!text) return
  props.signals.addComment(props.project.id, text)
  draft.value = ''
}

function like() {
  if (!liked.value) likePop.value = true
  props.signals.toggleLike(props.project.id)
}

function nowStr() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function download() {
  const file = toProjectFile(props.project, author.value, nowStr())
  const name = `${props.project.title.replace(/[\\/:*?"<>|]+/g, '').trim() || 'project'}.familytree.json`
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  toast(t('browse.detail.downloaded', { file: name }), { tone: 'success', icon: 'download' })
}

// Graft = import the project file as a brand-new project of the viewer's —
// exactly the path Project ▾ → Import takes, quotas included.
async function graft() {
  busy.value = 'graft'
  const file = toProjectFile(props.project, author.value, nowStr())
  const res = await store.importProjectFile(JSON.stringify(file))
  busy.value = null
  if (!res.success) {
    toast(t('browse.detail.graftFailed', { error: res.error }), { tone: 'error' })
    return
  }
  props.signals.setGraft(props.project.id, res.data.id)
  const copyId = res.data.id
  toast(t('browse.detail.grafted', { name: res.data.name }), {
    tone: 'success',
    icon: 'git-fork',
    duration: 7000,
    action: { label: t('browse.detail.openCopy'), run: () => openCopy(copyId) }
  })
}

// Straight to the editor. The graph layout was flushed when Browse opened
// and nothing on this page touches it, so switching directly is safe. (Store
// calls, not an emit: the toast's action may outlive this dialog.)
async function openCopy(projectId) {
  store.toggleBrowsePage(false)
  await store.switchProject(projectId)
}

// Co-editing needs the hosted backend; the request/approval is simulated.
function join() {
  const id = props.project.id
  props.signals.setGrove(id, 'pending')
  setTimeout(() => {
    if (props.signals.state.grove[id] === 'pending') props.signals.setGrove(id, 'member')
  }, 1800)
}
</script>

<style scoped>
.bd-backdrop {
  position: fixed;
  inset: 0;
  z-index: 260;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(6, 8, 16, 0.55);
  backdrop-filter: blur(6px);
}
.bd-panel {
  width: min(1180px, 100%);
  height: min(92vh, 980px);
  display: flex;
  flex-direction: column;
  background: var(--bg);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-xl);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */
.bd-hero {
  position: relative;
  flex-shrink: 0;
  padding: 22px 26px 18px;
  color: #fff;
  overflow: hidden;
  isolation: isolate;
}
.bd-hero-sky {
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(80% 140% at 10% 0%, hsl(calc(var(--h) + 40) 75% 45% / 0.6), transparent 60%),
    radial-gradient(
      60% 120% at 100% 100%,
      hsl(calc(var(--h) - 40) 70% 45% / 0.55),
      transparent 60%
    ),
    linear-gradient(120deg, hsl(var(--h) 55% 14%), hsl(calc(var(--h) + 35) 50% 20%));
}
.bd-hero-crest {
  position: absolute;
  right: 60px;
  top: 50%;
  color: hsl(var(--h) 70% 82%);
  opacity: 0.35;
  transform: translateY(-50%) rotate(-10deg);
  animation: bd-float 6s ease-in-out infinite;
  pointer-events: none;
}
@keyframes bd-float {
  50% {
    transform: translateY(-56%) rotate(-4deg);
  }
}
.bd-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: var(--ctl-md);
  height: var(--ctl-md);
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(10, 12, 22, 0.45);
  color: #fff;
  cursor: pointer;
}
.bd-close:hover {
  background: rgba(10, 12, 22, 0.7);
}
.bd-hero-text {
  max-width: 820px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bd-hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.bd-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: var(--r-pill);
  font-size: 12px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.18);
}
.bd-pill.mode {
  background: rgba(255, 255, 255, 0.22);
}
.bd-title {
  margin: 2px 0 0;
  font-size: clamp(22px, 3vw, 32px);
  font-weight: 900;
  letter-spacing: -0.01em;
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.4);
}
.bd-blurb {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.85);
}
.bd-hero-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 4px;
}
.bd-author {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 4px 4px;
  border-radius: var(--r-pill);
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(10, 12, 22, 0.35);
  color: #fff;
  cursor: pointer;
  text-align: left;
}
.bd-author:hover {
  background: rgba(10, 12, 22, 0.55);
}
.bd-author > span:last-child {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.bd-author-name {
  font-size: 13px;
  font-weight: 800;
}
.bd-author-handle {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
}
.bd-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: inherit;
  background: hsl(var(--ah) 60% 50% / 0.3);
  box-shadow: inset 0 0 0 1.5px hsl(var(--ah) 60% 60% / 0.6);
  flex-shrink: 0;
}
.bd-avatar.sm {
  width: 28px;
  height: 28px;
  color: var(--t1);
}
.bd-updated {
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.75);
}
.bd-hero-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
.bd-heart,
.bd-save {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: var(--ctl-md);
  padding: 0 14px;
  border-radius: var(--r-pill);
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(10, 12, 22, 0.4);
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: transform 0.2s var(--ease-spring);
}
.bd-heart:hover,
.bd-save:hover {
  transform: translateY(-1px);
}
.bd-heart.on .ui-icon,
.bd-save.on .ui-icon {
  fill: currentColor;
}
.bd-heart.on {
  background: rgba(240, 98, 146, 0.35);
  border-color: rgba(240, 98, 146, 0.6);
}
.bd-save.on {
  background: rgba(245, 166, 35, 0.3);
  border-color: rgba(245, 166, 35, 0.6);
}
.bd-heart.pop {
  animation: bd-pop 0.5s var(--ease-spring);
}
@keyframes bd-pop {
  35% {
    transform: scale(1.18) rotate(-4deg);
  }
}

/* ── Body ─────────────────────────────────────────────────────────────────── */
.bd-scroll {
  flex: 1;
  overflow-y: auto;
}
.bd-body {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(300px, 1fr);
  gap: 18px;
  padding: 18px 22px 8px;
}
.bd-left,
.bd-right {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.bd-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 14px 16px;
}
.bd-card h3 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 800;
  color: var(--t1);
  display: flex;
  align-items: center;
  gap: 6px;
}
.bd-count {
  font-size: 12px;
  font-weight: 700;
  color: var(--t2);
  background: var(--elevated);
  border-radius: var(--r-pill);
  padding: 1px 8px;
}
.bd-muted {
  margin: 0;
  font-size: 12.5px;
  color: var(--t2);
  line-height: 1.5;
}

/* Tree stage — dark artwork panel in both themes */
.bd-tree {
  position: relative;
  height: 470px;
  border-radius: var(--r-lg);
  overflow: hidden;
  background:
    radial-gradient(70% 60% at 50% 0%, hsl(var(--h) 60% 30% / 0.55), transparent 70%),
    radial-gradient(1px 1px at 20% 30%, rgba(255, 255, 255, 0.5), transparent),
    radial-gradient(1px 1px at 70% 60%, rgba(255, 255, 255, 0.4), transparent),
    radial-gradient(1px 1px at 40% 80%, rgba(255, 255, 255, 0.35), transparent),
    linear-gradient(180deg, hsl(var(--h) 40% 10%), hsl(calc(var(--h) + 30) 35% 7%));
  border: 1px solid var(--border);
}
.bd-tree-tools {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  gap: 6px;
}
.bd-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: var(--ctl-sm);
  height: var(--ctl-sm);
  padding: 0;
  border-radius: var(--r-sm);
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(10, 12, 22, 0.55);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
  backdrop-filter: blur(6px);
}
.bd-tool.wide {
  padding: 0 10px;
  font-size: 12.5px;
}
.bd-tool:hover {
  background: rgba(10, 12, 22, 0.8);
}
.bd-legend {
  position: absolute;
  left: 10px;
  bottom: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.75);
  background: rgba(10, 12, 22, 0.5);
  padding: 5px 10px;
  border-radius: var(--r-pill);
  backdrop-filter: blur(6px);
  pointer-events: none;
}
.bd-legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.lg {
  width: 16px;
  height: 0;
  border-top: 2px solid rgba(255, 255, 255, 0.45);
}
.lg.spouse {
  border-top-color: rgba(255, 255, 255, 0.85);
  border-top-width: 3px;
}
.lg.rival {
  border-top: 2px dashed var(--danger);
}
.lg.other {
  border-top: 2px dashed var(--accent-2);
}
.bd-tree-hint {
  position: absolute;
  right: 12px;
  bottom: 10px;
  margin: 0;
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.72);
  pointer-events: none;
}

.bd-person {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 250px;
  max-height: calc(100% - 20px);
  overflow-y: auto;
  padding: 14px;
  border-radius: var(--r-lg);
  background: var(--glass-soft);
  backdrop-filter: blur(14px);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow);
  color: var(--t1);
}
.bd-person-x {
  position: absolute;
  top: 6px;
  right: 6px;
  width: var(--ctl-xs);
  height: var(--ctl-xs);
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-sm);
  border: none;
  background: transparent;
  color: var(--t2);
  cursor: pointer;
}
.bd-person-head {
  display: flex;
  gap: 10px;
  align-items: center;
}
.bd-person-head h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
}
.bd-person-head p {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: var(--t2);
}
.bd-person-dot {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 800;
  flex-shrink: 0;
  background: var(--elevated);
  box-shadow: inset 0 0 0 2px rgba(var(--accent-rgb), 0.5);
}
.bd-person-dot.m {
  box-shadow: inset 0 0 0 2px rgba(108, 142, 245, 0.7);
}
.bd-person-dot.f {
  box-shadow: inset 0 0 0 2px rgba(240, 98, 146, 0.7);
}
.bd-person-years {
  margin: 10px 0 0;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--accent);
}
.bd-person-bio {
  margin: 6px 0 0;
  font-size: 12.5px;
  color: var(--t2);
}
.bd-person h5 {
  margin: 12px 0 6px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--t3);
}
.bd-bonds {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12.5px;
}
.bd-bonds em {
  color: var(--t2);
  font-size: 12px;
}
.bd-bond-verb {
  color: var(--t2);
  margin-right: 4px;
}
.bd-bond-verb.t-rival {
  color: var(--danger);
}
.bd-bond-verb.t-spouse {
  color: var(--pink);
}
.bd-bond-who {
  border: none;
  background: none;
  padding: 0;
  color: var(--accent);
  font-weight: 700;
  cursor: pointer;
  font-size: 12.5px;
}
.bd-bond-who:hover {
  text-decoration: underline;
}
.bd-pop-enter-active,
.bd-pop-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.25s var(--ease-out);
}
.bd-pop-enter-from,
.bd-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}

/* Cast */
.bd-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.bd-card-head h3 {
  margin: 0;
}
.bd-cast-search {
  width: 180px;
  flex-shrink: 0;
}
.bd-cast {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 180px;
  overflow-y: auto;
}
.bd-cast-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px 3px 3px;
  border-radius: var(--r-pill);
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t1);
  font-size: 12.5px;
  cursor: pointer;
  max-width: 100%;
  transition:
    background var(--dur) ease,
    border-color var(--dur) ease;
}
.bd-cast-chip:hover {
  background: var(--hover);
}
.bd-cast-chip.on {
  border-color: var(--accent);
  background: var(--adim);
}
.bd-cast-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 800;
  background: var(--surface);
  box-shadow: inset 0 0 0 1.5px var(--border-strong);
}
.bd-cast-chip.m .bd-cast-dot {
  box-shadow: inset 0 0 0 1.5px rgba(108, 142, 245, 0.7);
}
.bd-cast-chip.f .bd-cast-dot {
  box-shadow: inset 0 0 0 1.5px rgba(240, 98, 146, 0.7);
}
.bd-cast-name {
  font-weight: 700;
  white-space: nowrap;
}
.bd-cast-role {
  color: var(--t2);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 130px;
}

/* Access */
.bd-access {
  position: relative;
  overflow: hidden;
}
.bd-access::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 3px;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
}
.bd-access-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.bd-access-icon {
  color: var(--accent);
  width: 50px;
  height: 50px;
  border-radius: var(--r-md);
  display: grid;
  place-items: center;
  background: var(--elevated);
  flex-shrink: 0;
}
.bd-eyebrow {
  margin: 0;
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--t3);
}
.bd-access-head h3 {
  margin: 2px 0 2px;
  font-size: 18px;
}
.bd-access-desc {
  margin: 0;
  font-size: 13px;
  color: var(--t2);
  line-height: 1.5;
}
.bd-caps {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bd-caps li {
  display: grid;
  grid-template-columns: 22px 78px 1fr;
  align-items: start;
  line-height: 1.5;
  gap: 6px;
  font-size: 12.5px;
  color: var(--t3);
}
.bd-caps li.ok {
  color: var(--t1);
}
.bd-cap-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 1.5em;
}
.bd-caps li.ok .bd-cap-mark {
  color: var(--green);
}
.bd-cap-name {
  font-weight: 800;
}
.bd-cap-note {
  color: var(--t2);
  font-size: 12.5px;
}
.bd-caps li:not(.ok) .bd-cap-note {
  color: var(--t3);
}
.bd-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}
.bd-act {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: var(--ctl-lg);
  padding: 0 16px;
  border-radius: var(--r-md);
  border: 1px solid var(--border-strong);
  background: var(--elevated);
  color: var(--t1);
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
  transition:
    transform 0.2s var(--ease-spring),
    background var(--dur) ease;
}
.bd-act:hover:not(:disabled) {
  transform: translateY(-1px);
  background: var(--hover);
}
.bd-act:disabled {
  opacity: 0.6;
  cursor: default;
}
.bd-act.primary {
  border-color: transparent;
  color: var(--on-accent);
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: var(--glow);
}
.bd-act.primary:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--accent-hover), var(--accent-2));
}
.bd-act.grove {
  border-color: rgba(76, 175, 114, 0.5);
  background: rgba(76, 175, 114, 0.14);
}
.bd-act.sm {
  height: var(--ctl-md);
  padding: 0 12px;
  font-size: 12.5px;
}
.bd-grove {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: var(--ctl-lg);
  padding: 0 14px;
  border-radius: var(--r-md);
  font-size: 13px;
  font-weight: 700;
  background: var(--elevated);
  color: var(--t2);
}
.bd-grove.member {
  color: var(--green);
  background: rgba(76, 175, 114, 0.14);
  animation: bd-pop 0.5s var(--ease-spring);
}
.bd-spin {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: bd-rot 0.7s linear infinite;
}
@keyframes bd-rot {
  to {
    transform: rotate(360deg);
  }
}

/* Stats */
.bd-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.bd-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 4px;
  border-radius: var(--r-md);
  background: var(--surface);
  border: 1px solid var(--border);
}
.bd-stat-num {
  font-size: 18px;
  font-weight: 900;
  color: var(--t1);
}
.bd-stat-label {
  font-size: 11.5px;
  color: var(--t2);
}

/* Facts */
.bd-facts {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bd-facts li {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 13px;
  color: var(--t1);
  animation: bd-slide 0.4s var(--ease-out) both;
  animation-delay: calc(var(--i) * 60ms);
}
@keyframes bd-slide {
  from {
    opacity: 0;
    transform: translateX(8px);
  }
}
.bd-fact-icon {
  width: 30px;
  height: 30px;
  border-radius: var(--r-sm);
  display: grid;
  place-items: center;
  color: var(--accent);
  background: var(--elevated);
  flex-shrink: 0;
}
.bd-groups {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}
.bd-group {
  font-size: 12.5px;
  padding: 3px 10px;
  border-radius: var(--r-pill);
  background: var(--adim);
  color: var(--t1);
}
.bd-group b {
  color: var(--accent);
  margin-left: 2px;
}
.bd-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 10px;
}
.bd-tag {
  border: none;
  background: transparent;
  color: var(--t2);
  font-size: 12.5px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: var(--r-xs);
}
.bd-tag:hover {
  color: var(--accent);
  background: var(--adim);
}

/* Comments */
.bd-comments {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.bd-comments li {
  display: flex;
  gap: 10px;
}
.bd-comments li.mine .bd-c-text {
  background: var(--adim);
}
.bd-c-head {
  margin: 0;
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 12px;
  color: var(--t3);
}
.bd-c-name {
  border: none;
  background: none;
  padding: 0;
  font-size: 12.5px;
  font-weight: 800;
  color: var(--t1);
  cursor: pointer;
}
button.bd-c-name:hover {
  color: var(--accent);
}
.bd-c-text {
  margin: 3px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--t1);
  padding: 6px 10px;
  border-radius: 4px var(--r-md) var(--r-md) var(--r-md);
  background: var(--elevated);
}
.bd-c-form {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.bd-c-form input {
  flex: 1;
  min-width: 0;
  height: var(--ctl-md);
  padding: 0 12px;
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t1);
  outline: none;
  font-size: 13px;
}
.bd-c-form input:focus {
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}

/* Similar */
.bd-similar {
  padding: 8px 22px 24px;
}
.bd-similar h3 {
  margin: 8px 0 12px;
  font-size: 15px;
  font-weight: 800;
  color: var(--t1);
}
.bd-similar-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 14px;
}

@media (max-width: 900px) {
  .bd-backdrop {
    padding: 0;
  }
  .bd-panel {
    height: 100vh;
    border-radius: 0;
  }
  .bd-body {
    grid-template-columns: 1fr;
    padding: 14px 16px 8px;
  }
  .bd-tree {
    height: 380px;
  }
  .bd-hero {
    padding: 18px 16px 14px;
  }
  .bd-hero-crest {
    width: 70px;
    height: 70px;
    right: 20px;
  }
  .bd-hero-actions {
    margin-left: 0;
  }
  .bd-person {
    width: auto;
    left: 10px;
    top: auto;
    bottom: 44px;
    max-height: 55%;
  }
  .bd-similar {
    padding: 8px 16px 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bd-hero-crest,
  .bd-facts li {
    animation: none;
  }
}

/* ── 水墨 ink theme: the detail sheet is mounted (.ink-mount/.ink-unroll);
   its hero and tree stage are paintings on paper, not dark photographs ─── */
:root[data-theme='ink'] .bd-panel {
  border-radius: 2px;
}
:root[data-theme='ink'] .bd-hero {
  color: var(--t1);
  border-bottom: 1px solid rgba(48, 36, 20, 0.18);
}
:root[data-theme='ink'] .bd-hero-sky {
  background:
    radial-gradient(70% 140% at 12% 0%, hsl(var(--h) 35% 50% / 0.24), transparent 62%),
    radial-gradient(
      60% 120% at 100% 100%,
      hsl(calc(var(--h) - 40) 25% 40% / 0.16),
      transparent 60%
    ),
    var(--ink-landscape, none) right bottom / auto 90% repeat-x,
    linear-gradient(180deg, #f3ecdc, #e9dfc8);
}
:root[data-theme='ink'] .bd-hero-crest {
  color: var(--t1);
  opacity: 0.18;
}
:root[data-theme='ink'] .bd-close {
  border-radius: 3px;
  border-color: var(--ink-mount-line);
  background: rgba(245, 239, 224, 0.85);
  color: var(--t1);
}
:root[data-theme='ink'] .bd-pill {
  border-radius: 2px;
  background: rgba(255, 251, 240, 0.7);
  border-color: rgba(48, 36, 20, 0.2);
  font-family: var(--font-ink-label);
}
:root[data-theme='ink'] .bd-pill.mode {
  background: rgba(179, 53, 42, 0.08);
  border-color: rgba(179, 53, 42, 0.35);
  color: var(--accent);
}
:root[data-theme='ink'] .bd-title {
  font-family: var(--font-brush);
  font-weight: 400;
  font-size: clamp(28px, 3.6vw, 40px);
  text-shadow: none;
}
:root[data-theme='ink'] .bd-blurb {
  color: var(--t2);
  font-style: italic;
}
:root[data-theme='ink'] .bd-author-handle,
:root[data-theme='ink'] .bd-updated {
  color: var(--t3);
}
:root[data-theme='ink'] .bd-card {
  border-radius: 2px;
  border-color: var(--ink-mount-line);
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  box-shadow:
    0 0 0 3px var(--ink-silk),
    0 0 0 4px rgba(58, 42, 22, 0.18);
}
:root[data-theme='ink'] .bd-card h3 {
  font-family: var(--font-brush);
  font-size: 19px;
  font-weight: 400;
}
:root[data-theme='ink'] .bd-tree {
  border-radius: 2px;
  background:
    radial-gradient(70% 60% at 50% 0%, hsl(var(--h) 30% 55% / 0.16), transparent 70%),
    var(--ink-landscape, none) center bottom / auto 45% repeat-x,
    var(--ink-sheet),
    var(--surface);
  background-size:
    100% 100%,
    auto 45%,
    512px 512px;
}
:root[data-theme='ink'] .bd-tool {
  border-radius: 3px;
  border-color: var(--ink-mount-line);
  background: rgba(245, 239, 224, 0.9);
  color: var(--t1);
  backdrop-filter: none;
}
:root[data-theme='ink'] .bd-legend {
  color: var(--t2);
}
:root[data-theme='ink'] .bd-act,
:root[data-theme='ink'] .bd-grove,
:root[data-theme='ink'] .bd-cast-chip,
:root[data-theme='ink'] .bd-tag,
:root[data-theme='ink'] .bd-cast-search :deep(.sf-input),
:root[data-theme='ink'] .bd-c-form input {
  border-radius: 3px 5px 4px 6px / 5px 3px 6px 4px;
  font-family: var(--font-ink-label);
}
:root[data-theme='ink'] .bd-act.primary {
  background:
    var(--ink-paper-light, none) center / 256px 256px,
    var(--accent);
  background-blend-mode: multiply, normal;
  box-shadow: inset 0 0 0 1px rgba(90, 15, 10, 0.3);
}
:root[data-theme='ink'] .bd-person-head h4 {
  font-family: var(--font-brush);
  font-size: 20px;
  font-weight: 400;
}
:root[data-theme='ink'] .bd-stat-num {
  font-family: var(--font-brush);
  font-weight: 400;
}

/* the hills stay behind a veil of mist so the hero text reads */
:root[data-theme='ink'] .bd-hero-sky {
  background:
    linear-gradient(
      90deg,
      rgba(243, 236, 220, 0.94) 25%,
      rgba(243, 236, 220, 0.6) 65%,
      rgba(243, 236, 220, 0.35)
    ),
    radial-gradient(70% 140% at 12% 0%, hsl(var(--h) 35% 50% / 0.24), transparent 62%),
    var(--ink-landscape, none) right bottom / auto 70% repeat-x,
    linear-gradient(180deg, #f3ecdc, #e9dfc8);
}
:root[data-theme='ink'] .bd-tree {
  background:
    linear-gradient(rgba(245, 239, 224, 0.5), rgba(245, 239, 224, 0.5)),
    radial-gradient(70% 60% at 50% 0%, hsl(var(--h) 30% 55% / 0.16), transparent 70%),
    var(--ink-landscape, none) center bottom / auto 40% repeat-x,
    var(--ink-sheet),
    var(--surface);
  background-size:
    100% 100%,
    100% 100%,
    auto 40%,
    512px 512px;
}
:root[data-theme='ink'] .bd-author,
:root[data-theme='ink'] .bd-heart,
:root[data-theme='ink'] .bd-save {
  border-radius: 3px 5px 4px 6px / 5px 3px 6px 4px;
  border-color: var(--ink-mount-line);
  background: rgba(255, 251, 240, 0.85);
  color: var(--t1);
  font-family: var(--font-ink-label);
}
:root[data-theme='ink'] .bd-author:hover {
  background: rgba(255, 251, 240, 1);
}
:root[data-theme='ink'] .bd-heart.on,
:root[data-theme='ink'] .bd-save.on {
  background: rgba(179, 53, 42, 0.1);
  border-color: rgba(179, 53, 42, 0.45);
}
:root[data-theme='ink'] .bd-avatar {
  border-radius: 3px 5px 2px 6px / 5px 2px 6px 3px;
}
:root[data-theme='ink'] .bd-legend {
  color: var(--t2);
  background: rgba(245, 239, 224, 0.9);
  border-radius: 2px;
  box-shadow: inset 0 0 0 1px var(--ink-mount-line);
  backdrop-filter: none;
}
:root[data-theme='ink'] .lg {
  border-top-color: rgba(28, 26, 23, 0.45);
}
:root[data-theme='ink'] .lg.spouse {
  border-top-color: rgba(179, 53, 42, 0.75);
}
:root[data-theme='ink'] .bd-tree-hint {
  color: var(--t3);
}

:root[data-theme='ink'] .bd-close:hover,
:root[data-theme='ink'] .bd-tool:hover {
  background: rgba(255, 251, 240, 1);
}
</style>
