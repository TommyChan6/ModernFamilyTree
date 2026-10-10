<template>
  <article
    class="bc"
    :class="['mode-' + project.access, { compact, liked }]"
    :style="{ '--h': project.hue, '--d': delay + 'ms' }"
    tabindex="0"
    role="button"
    :aria-label="project.title"
    @click="emit('open', project.id)"
    @keydown.enter.prevent="emit('open', project.id)"
    @pointermove="tilt"
    @pointerleave="untilt"
  >
    <div class="bc-cover">
      <div class="bc-sky"></div>
      <div class="bc-tree">
        <MiniTree :layout="tree" :highlight="hits" />
      </div>
      <UiIcon class="bc-crest" :name="project.crest" :size="40" :stroke="1.5" />
      <span class="bc-mode" :title="t('browse.modes.' + project.access + '.desc')">
        <UiIcon class="bc-mode-icon" :name="ACCESS_ICONS[project.access]" :size="12" />
        {{ t('browse.modes.' + project.access + '.name') }}
      </span>
      <span v-if="project.badge" class="bc-badge" :class="project.badge">
        {{ t('browse.badges.' + project.badge) }}
      </span>
      <div class="bc-quick" @click.stop>
        <button
          class="bc-qbtn"
          :class="{ on: liked, pop: likePop }"
          :title="liked ? t('browse.card.unlike') : t('browse.card.like')"
          :aria-label="liked ? t('browse.card.unlike') : t('browse.card.like')"
          :aria-pressed="liked"
          @click="like"
          @animationend="likePop = false"
        >
          <UiIcon name="heart" :size="14" />
        </button>
        <button
          class="bc-qbtn"
          :class="{ on: saved }"
          :title="saved ? t('browse.card.unsave') : t('browse.card.save')"
          :aria-label="saved ? t('browse.card.unsave') : t('browse.card.save')"
          :aria-pressed="saved"
          @click="emit('save', project.id)"
        >
          <UiIcon name="bookmark" :size="14" />
        </button>
      </div>
    </div>

    <div class="bc-body">
      <h3 class="bc-title">{{ project.title }}</h3>
      <button v-if="author" class="bc-author" @click.stop="emit('author', author.id)">
        <span class="bc-avatar" :style="{ '--ah': author.hue }">
          <UiIcon :name="author.avatar" :size="12" />
        </span>
        <span class="bc-author-name">{{ author.displayName }}</span>
        <UiIcon
          v-if="author.badges.includes('staff')"
          class="bc-verified"
          name="badge-check"
          :size="14"
          :label="t('browse.profile.badges.staff')"
        />
      </button>
      <p v-if="!compact" class="bc-blurb">{{ project.blurb }}</p>
      <p v-if="hits.length" class="bc-hits">
        <span class="bc-hits-label">
          <UiIcon name="search" :size="12" />
          {{ t('browse.card.found') }}
        </span>
        {{ hits.join(' · ') }}
      </p>
      <p v-if="reason" class="bc-reason">
        <UiIcon name="sparkles" :size="13" />
        <span>{{ reason }}</span>
      </p>
      <footer class="bc-stats">
        <span :title="t('browse.stats.people')">
          <UiIcon name="users" :size="14" />
          {{ project.people.length }}
        </span>
        <span :title="t('browse.stats.gens')">
          <UiIcon name="tree-deciduous" :size="14" />
          {{ tree.generations }}
        </span>
        <span :title="t('browse.stats.likes')">
          <UiIcon name="heart" :size="14" />
          {{ compactNum(likes) }}
        </span>
        <span v-if="project.forks" :title="t('browse.stats.forks')">
          <UiIcon name="git-fork" :size="14" />
          {{ compactNum(project.forks) }}
        </span>
        <span class="bc-lang">{{ LANG_SHORT[project.lang] }}</span>
      </footer>
    </div>
  </article>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from '../../i18n'
import MiniTree from './MiniTree.vue'
import UiIcon from '../ui/UiIcon.js'
import { ACCESS_ICONS, treeOf } from './browseModel'

const props = defineProps({
  project: { type: Object, required: true },
  author: { type: Object, default: null },
  liked: { type: Boolean, default: false },
  saved: { type: Boolean, default: false },
  /** Names of people that matched the search. */
  hits: { type: Array, default: () => [] },
  /** Why it was recommended (already translated). */
  reason: { type: String, default: '' },
  compact: { type: Boolean, default: false },
  delay: { type: Number, default: 0 }
})
const emit = defineEmits(['open', 'like', 'save', 'author'])
const { t, locale } = useI18n()

const LANG_SHORT = { en: 'EN', 'zh-Hans': '简', 'zh-Hant': '繁', ja: '日' }

const tree = computed(() => treeOf(props.project))
const likes = computed(() => props.project.likes + (props.liked ? 1 : 0))
const likePop = ref(false)

function like() {
  if (!props.liked) likePop.value = true
  emit('like', props.project.id)
}

function compactNum(n) {
  return new Intl.NumberFormat(locale.value, {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(n)
}

// Gentle 3D tilt toward the pointer.
function tilt(e) {
  if (props.compact) return
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  const px = (e.clientX - r.left) / r.width - 0.5
  const py = (e.clientY - r.top) / r.height - 0.5
  el.style.setProperty('--rx', `${(-py * 5).toFixed(2)}deg`)
  el.style.setProperty('--ry', `${(px * 7).toFixed(2)}deg`)
}
function untilt(e) {
  e.currentTarget.style.setProperty('--rx', '0deg')
  e.currentTarget.style.setProperty('--ry', '0deg')
}
</script>

<style scoped>
.bc {
  --rx: 0deg;
  --ry: 0deg;
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: var(--r-lg);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  cursor: pointer;
  outline: none;
  transform: perspective(900px) rotateX(var(--rx)) rotateY(var(--ry));
  transition:
    transform 0.25s var(--ease-out),
    box-shadow 0.25s ease,
    border-color 0.25s ease;
  animation: bc-rise 0.5s var(--ease-out) both;
  animation-delay: var(--d);
}
.bc:hover,
.bc:focus-visible {
  transform: perspective(900px) rotateX(var(--rx)) rotateY(var(--ry)) translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: hsl(var(--h) 70% 60% / 0.5);
}
.bc:focus-visible {
  box-shadow: var(--shadow-lg), var(--focus-ring);
}
@keyframes bc-rise {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.98);
  }
}

/* ── Cover art (always dark, like a photo) ───────────────────────────────── */
.bc-cover {
  position: relative;
  height: 150px;
  overflow: hidden;
  isolation: isolate;
}
.bc.compact .bc-cover {
  height: 118px;
}
.bc-sky {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(120% 90% at 20% 10%, hsl(calc(var(--h) + 40) 70% 45% / 0.55), transparent 60%),
    radial-gradient(90% 80% at 90% 100%, hsl(calc(var(--h) - 30) 70% 40% / 0.5), transparent 60%),
    linear-gradient(
      150deg,
      hsl(var(--h) 55% 13%),
      hsl(calc(var(--h) + 30) 50% 19%) 60%,
      hsl(calc(var(--h) + 70) 45% 11%)
    );
  transition: transform 0.6s var(--ease-out);
}
.bc:hover .bc-sky {
  transform: scale(1.06);
}
.bc-tree {
  position: absolute;
  inset: 16px 14px 12px;
  transition: transform 0.6s var(--ease-out);
}
.bc:hover .bc-tree {
  transform: scale(1.04) translateY(-2px);
}
.bc-crest {
  position: absolute;
  right: 10px;
  bottom: 8px;
  color: hsl(var(--h) 70% 82%);
  opacity: 0.9;
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.5));
  transform: rotate(-8deg);
  transition: transform 0.45s var(--ease-spring);
}
.bc:hover .bc-crest {
  transform: rotate(4deg) scale(1.15);
}

.bc-mode {
  position: absolute;
  top: 10px;
  left: 10px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px 3px 6px;
  border-radius: var(--r-pill);
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #fff;
  background: rgba(10, 12, 22, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(6px);
}
.mode-glasshouse .bc-mode {
  box-shadow: inset 0 0 0 1px rgba(160, 200, 255, 0.35);
}
.mode-seedbank .bc-mode {
  box-shadow: inset 0 0 0 1px rgba(245, 190, 110, 0.45);
}
.mode-graft .bc-mode {
  box-shadow: inset 0 0 0 1px rgba(120, 230, 150, 0.45);
}
.mode-grove .bc-mode {
  box-shadow: inset 0 0 0 1px rgba(255, 170, 220, 0.5);
}

.bc-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 3px 8px;
  border-radius: var(--r-pill);
  font-size: 11px;
  font-weight: 800;
  color: #1a1d2e;
  background: #ffe27a;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}
.bc-badge.trending {
  background: linear-gradient(90deg, #ffb36b, #ff7a90);
}
.bc-badge.new {
  background: linear-gradient(90deg, #8cf0c1, #7cc7ff);
}

.bc-quick {
  position: absolute;
  left: 10px;
  bottom: 10px;
  display: flex;
  gap: 6px;
  opacity: 0;
  transform: translateY(6px);
  transition:
    opacity 0.2s ease,
    transform 0.25s var(--ease-out);
}
.bc:hover .bc-quick,
.bc:focus-within .bc-quick,
.bc.liked .bc-quick {
  opacity: 1;
  transform: none;
}
.bc-qbtn {
  width: var(--ctl-sm);
  height: var(--ctl-sm);
  padding: 0;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(10, 12, 22, 0.55);
  backdrop-filter: blur(6px);
  color: #fff;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s var(--ease-spring);
}
.bc-qbtn:hover {
  transform: scale(1.12);
}
.bc-qbtn.on .ui-icon {
  fill: currentColor;
}
.bc-qbtn.on:first-child {
  color: var(--danger);
}
.bc-qbtn.pop {
  animation: bc-pop 0.5s var(--ease-spring);
}
@keyframes bc-pop {
  30% {
    transform: scale(1.45) rotate(-10deg);
  }
  60% {
    transform: scale(0.9);
  }
}

/* ── Body ─────────────────────────────────────────────────────────────────── */
.bc-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px 12px;
  flex: 1;
}
.bc-title {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: var(--t1);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.bc.compact .bc-title {
  font-size: 13.5px;
}
.bc-author {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px 2px 2px;
  border: none;
  border-radius: var(--r-pill);
  background: transparent;
  color: var(--t2);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  max-width: 100%;
}
.bc-author:hover {
  background: var(--hover);
  color: var(--t1);
}
.bc-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--t1);
  background: hsl(var(--ah) 60% 50% / 0.22);
  box-shadow: inset 0 0 0 1px hsl(var(--ah) 60% 55% / 0.45);
  flex-shrink: 0;
}
.bc-author-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bc-verified {
  flex-shrink: 0;
  color: var(--accent);
}
.bc-blurb {
  margin: 0;
  font-size: 13px;
  color: var(--t2);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.bc-hits {
  margin: 0;
  font-size: 12.5px;
  color: var(--t1);
  background: rgba(var(--accent-rgb), 0.1);
  border: 1px solid rgba(var(--accent-rgb), 0.25);
  border-radius: var(--r-sm);
  padding: 4px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bc-hits-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  vertical-align: middle;
  color: var(--accent);
  font-weight: 700;
  margin-right: 4px;
}
.bc-reason {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--accent);
}
.bc-reason .ui-icon {
  flex-shrink: 0;
}
.bc-reason span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bc-stats {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  color: var(--t2);
  padding-top: 4px;
}
.bc-stats > span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.bc-stats .ui-icon {
  color: var(--t3);
}
.bc-lang {
  margin-left: auto;
  font-size: 11px;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: var(--r-xs);
  background: var(--elevated);
  color: var(--t2);
}

@media (prefers-reduced-motion: reduce) {
  .bc {
    animation: none;
    transform: none !important;
  }
}

/* ── 水墨 ink theme: each card's cover is a small ink painting — a pale wash
   of the project's hue on paper, distant hills, and the tree in ink ────── */
:root[data-theme='ink'] .bc {
  border-radius: 2px;
  border-color: var(--ink-mount-line);
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  box-shadow:
    0 0 0 3px var(--ink-silk),
    0 0 0 4px rgba(58, 42, 22, 0.2),
    0 6px 16px rgba(60, 40, 15, 0.12);
}
:root[data-theme='ink'] .bc:hover,
:root[data-theme='ink'] .bc:focus-visible {
  border-color: rgba(48, 36, 20, 0.45);
  box-shadow:
    0 0 0 3px var(--ink-silk),
    0 0 0 4px rgba(58, 42, 22, 0.3),
    0 16px 30px rgba(60, 40, 15, 0.2);
}
:root[data-theme='ink'] .bc-sky {
  background:
    radial-gradient(90% 80% at 22% 18%, hsl(var(--h) 35% 55% / 0.22), transparent 62%),
    radial-gradient(70% 70% at 88% 92%, hsl(calc(var(--h) + 30) 25% 40% / 0.16), transparent 60%),
    var(--ink-landscape, none) center bottom / auto 70% repeat-x,
    linear-gradient(180deg, #f3ecdc, #e9dfc8);
}
:root[data-theme='ink'] .bc-sky::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 30%, rgba(245, 239, 224, 0.35));
}
:root[data-theme='ink'] .bc-crest {
  color: var(--t1);
  filter: drop-shadow(0 2px 4px rgba(60, 40, 15, 0.25));
  opacity: 0.75;
}
:root[data-theme='ink'] .bc-mode {
  border-radius: 1px;
  color: var(--t1);
  background: rgba(245, 239, 224, 0.88);
  border-color: var(--ink-mount-line);
  backdrop-filter: none;
  font-family: var(--font-ink-label);
  font-weight: 600;
}
:root[data-theme='ink'] .bc-badge,
:root[data-theme='ink'] .bc-badge.trending,
:root[data-theme='ink'] .bc-badge.new {
  border-radius: 2px 3px 2px 4px;
  color: #fbf4e6;
  background:
    var(--ink-paper-light, none) center / 200px 200px,
    var(--accent);
  background-blend-mode: multiply, normal;
  box-shadow: inset 0 0 0 1px rgba(251, 244, 230, 0.35);
  font-family: var(--font-ink-label);
  font-weight: 600;
}
:root[data-theme='ink'] .bc-title {
  font-family: var(--font-brush);
  font-size: 19px;
  font-weight: 400;
  letter-spacing: 0.01em;
}
:root[data-theme='ink'] .bc-avatar {
  border-radius: 3px 4px 2px 5px / 4px 2px 5px 3px;
}

:root[data-theme='ink'] .bc-qbtn {
  border-radius: 3px;
  background: rgba(245, 239, 224, 0.9);
  border-color: var(--ink-mount-line);
  backdrop-filter: none;
  color: var(--t1);
}
:root[data-theme='ink'] .bc-qbtn.on:first-child {
  color: var(--accent);
}
</style>
