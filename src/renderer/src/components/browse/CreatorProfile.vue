<template>
  <div class="cp-backdrop ink-veil" @click.self="emit('close')">
    <aside
      class="cp-drawer"
      role="dialog"
      aria-modal="true"
      :aria-label="profile.displayName"
      :style="{ '--h': profile.hue }"
    >
      <header class="cp-banner">
        <div class="cp-banner-sky"></div>
        <button class="cp-close" :title="t('browse.detail.close')" @click="emit('close')">✕</button>
        <div class="cp-avatar">{{ profile.avatar }}</div>
      </header>
      <div class="cp-body">
        <div class="cp-id">
          <div>
            <h2 class="cp-name">{{ profile.displayName }}</h2>
            <p class="cp-handle">@{{ profile.username }}</p>
          </div>
          <button
            class="cp-follow"
            :class="{ on: following, burst }"
            @click="toggleFollow"
            @animationend="burst = false"
          >
            <span class="cp-follow-face">{{
              following ? '✓ ' + t('browse.profile.following') : '＋ ' + t('browse.profile.follow')
            }}</span>
            <i v-for="n in 8" :key="n" class="cp-spark" :style="{ '--a': n * 45 + 'deg' }"></i>
          </button>
        </div>
        <div v-if="profile.badges.length" class="cp-badges">
          <span v-for="b in profile.badges" :key="b" class="cp-badge" :class="b">
            {{ BADGE_ICON[b] }} {{ t('browse.profile.badges.' + b) }}
          </span>
        </div>
        <p class="cp-bio">{{ profile.bio }}</p>
        <p class="cp-meta">
          📍 {{ profile.location }} · {{ t('browse.profile.joined', { date: joined }) }}
        </p>
        <div class="cp-stats">
          <div>
            <b>{{ compactNum(profile.followers + (following ? 1 : 0)) }}</b>
            <span>{{ t('browse.profile.followers') }}</span>
          </div>
          <div>
            <b>{{ compactNum(profile.following) }}</b>
            <span>{{ t('browse.profile.followingN') }}</span>
          </div>
          <div>
            <b>{{ trees.length }}</b>
            <span>{{ t('browse.profile.trees') }}</span>
          </div>
          <div>
            <b>{{ compactNum(totalLikes) }}</b>
            <span>{{ t('browse.profile.likes') }}</span>
          </div>
        </div>
        <h3 class="cp-sub">{{ t('browse.profile.theirTrees') }}</h3>
        <div class="cp-trees">
          <BrowseCard
            v-for="(p, i) in trees"
            :key="p.id"
            :project="p"
            :author="profile"
            :liked="signals.isLiked(p.id)"
            :saved="signals.isSaved(p.id)"
            :delay="i * 70"
            compact
            @open="emit('open', $event)"
            @like="signals.toggleLike($event)"
            @save="signals.toggleSave($event)"
          />
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from '../../i18n'
import BrowseCard from './BrowseCard.vue'
import { PROJECTS } from './browseData'

const props = defineProps({
  profile: { type: Object, required: true },
  signals: { type: Object, required: true }
})
const emit = defineEmits(['close', 'open'])
const { t, locale } = useI18n()

const BADGE_ICON = { staff: '✦', historian: '🏛️', otaku: '🎌', critic: '🧐', pioneer: '🚀' }

const trees = computed(() => PROJECTS.filter((p) => p.authorId === props.profile.id))
const totalLikes = computed(() => trees.value.reduce((s, p) => s + p.likes, 0))
const following = computed(() => props.signals.isFollowing(props.profile.id))
const joined = computed(() => {
  const [y, m] = props.profile.joined.split('-').map(Number)
  return new Intl.DateTimeFormat(locale.value, { year: 'numeric', month: 'long' }).format(
    new Date(y, m - 1, 1)
  )
})
const burst = ref(false)

function toggleFollow() {
  if (props.signals.toggleFollow(props.profile.id)) burst.value = true
}
function compactNum(n) {
  return new Intl.NumberFormat(locale.value, {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(n)
}
</script>

<style scoped>
.cp-backdrop {
  position: fixed;
  inset: 0;
  z-index: 270;
  display: flex;
  justify-content: flex-end;
  background: rgba(6, 8, 16, 0.45);
  backdrop-filter: blur(3px);
}
.cp-drawer {
  width: min(460px, 100%);
  height: 100%;
  overflow-y: auto;
  background: var(--bg);
  border-left: 1px solid var(--border-strong);
  box-shadow: var(--shadow-lg);
}
.cp-banner {
  position: relative;
  height: 130px;
}
.cp-banner-sky {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(90% 140% at 0% 0%, hsl(calc(var(--h) + 40) 75% 55% / 0.8), transparent 60%),
    radial-gradient(70% 120% at 100% 100%, hsl(calc(var(--h) - 40) 70% 50% / 0.7), transparent 60%),
    linear-gradient(120deg, hsl(var(--h) 55% 22%), hsl(calc(var(--h) + 35) 50% 30%));
}
.cp-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(10, 12, 22, 0.4);
  color: #fff;
  cursor: pointer;
}
.cp-avatar {
  position: absolute;
  left: 22px;
  bottom: -36px;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 40px;
  background: var(--surface);
  border: 4px solid var(--bg);
  box-shadow:
    0 0 0 2px hsl(var(--h) 65% 55% / 0.6),
    var(--shadow);
  animation: cp-bob 4s ease-in-out infinite;
}
@keyframes cp-bob {
  50% {
    transform: translateY(-3px) rotate(-4deg);
  }
}
.cp-body {
  padding: 46px 22px 28px;
}
.cp-id {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.cp-name {
  margin: 0;
  font-size: 21px;
  font-weight: 900;
  color: var(--t1);
}
.cp-handle {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--t2);
}
.cp-follow {
  position: relative;
  padding: 8px 18px;
  border-radius: var(--r-pill);
  border: none;
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
  color: var(--on-accent);
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: var(--glow);
  flex-shrink: 0;
  transition: transform 0.2s var(--ease-spring);
}
.cp-follow:hover {
  transform: translateY(-1px);
}
.cp-follow.on {
  color: var(--t1);
  background: var(--elevated);
  box-shadow: inset 0 0 0 1px var(--border-strong);
}
.cp-spark {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 6px;
  height: 6px;
  margin: -3px;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0;
  pointer-events: none;
}
.cp-follow.burst .cp-spark {
  animation: cp-spark 0.6s var(--ease-out);
}
.cp-follow.burst {
  animation: cp-press 0.6s var(--ease-spring);
}
@keyframes cp-spark {
  0% {
    opacity: 1;
    transform: rotate(var(--a)) translateX(0);
  }
  100% {
    opacity: 0;
    transform: rotate(var(--a)) translateX(44px) scale(0.4);
  }
}
@keyframes cp-press {
  30% {
    transform: scale(1.1);
  }
}
.cp-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}
.cp-badge {
  font-size: 11px;
  font-weight: 800;
  padding: 3px 10px;
  border-radius: var(--r-pill);
  background: var(--elevated);
  color: var(--t1);
}
.cp-badge.staff {
  background: var(--adim);
  color: var(--accent);
}
.cp-bio {
  margin: 12px 0 0;
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--t1);
}
.cp-meta {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--t2);
}
.cp-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-top: 16px;
}
.cp-stats div {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 4px;
  border-radius: var(--r-md);
  background: var(--surface);
  border: 1px solid var(--border);
}
.cp-stats b {
  font-size: 16px;
  color: var(--t1);
}
.cp-stats span {
  font-size: 10.5px;
  color: var(--t2);
  text-align: center;
}
.cp-sub {
  margin: 22px 0 10px;
  font-size: 14px;
  font-weight: 800;
  color: var(--t1);
}
.cp-trees {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

@media (prefers-reduced-motion: reduce) {
  .cp-avatar {
    animation: none;
  }
}

/* ── 水墨 ink theme: a paper drawer with a painted banner ───────────────── */
:root[data-theme='ink'] .cp-drawer {
  background: var(--ink-sheet), var(--surface);
  background-size: 512px 512px;
  border-left-color: var(--ink-mount-line);
  box-shadow:
    -4px 0 0 var(--ink-silk),
    -5px 0 0 rgba(58, 42, 22, 0.25),
    var(--shadow-lg);
}
:root[data-theme='ink'] .cp-banner-sky {
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
:root[data-theme='ink'] .cp-close {
  border-radius: 3px;
  border-color: var(--ink-mount-line);
  background: rgba(245, 239, 224, 0.85);
  color: var(--t1);
}
:root[data-theme='ink'] .cp-avatar {
  border-radius: 6px 9px 5px 10px / 9px 5px 10px 6px;
  border-color: var(--surface);
  box-shadow:
    0 0 0 2px var(--ink-mount-line),
    var(--shadow);
}
:root[data-theme='ink'] .cp-name {
  font-family: var(--font-brush);
  font-size: 28px;
  font-weight: 400;
}
:root[data-theme='ink'] .cp-follow,
:root[data-theme='ink'] .cp-badge {
  border-radius: 3px 5px 4px 6px / 5px 3px 6px 4px;
  font-family: var(--font-ink-label);
}
:root[data-theme='ink'] .cp-stats b {
  font-family: var(--font-brush);
  font-weight: 400;
}
</style>
