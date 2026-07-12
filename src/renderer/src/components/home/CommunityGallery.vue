<template>
  <div class="gallery">
    <!-- Filter chips -->
    <div class="chips">
      <button
        v-for="f in FILTERS"
        :key="f.id"
        class="chip"
        :class="{ active: filter === f.id }"
        type="button"
        @click="filter = f.id"
      >
        {{ f.label }}
      </button>
    </div>

    <!-- Cards -->
    <TransitionGroup name="cards" tag="div" class="grid">
      <article
        v-for="p in filtered"
        :key="p.id"
        class="card"
        @mousemove="tilt"
        @mouseleave="untilt"
        @click="open(p)"
      >
        <div class="card-inner">
          <div class="cover">
            <canvas :ref="(el) => setCover(el, p)" class="cover-canvas"></canvas>
            <span v-if="p.badge" class="badge-pill" :class="'badge-' + p.badge.replace(' ', '')">
              {{ badgeIcon(p.badge) }} {{ p.badge }}
            </span>
            <span class="cover-meta">{{ p.people }} people · {{ p.generations }} generations</span>
            <div class="cover-glare"></div>
          </div>
          <div class="body">
            <h3 class="title">{{ p.title }}</h3>
            <p class="blurb">{{ p.blurb }}</p>
            <div class="meta">
              <span class="avatar" :style="avatarStyle(p)">{{ p.author[0].toUpperCase() }}</span>
              <span class="author">@{{ p.author }}</span>
              <span class="updated">· {{ p.updated }}</span>
            </div>
            <div class="stats">
              <button
                class="stat like"
                :class="{ liked: liked.has(p.id) }"
                type="button"
                :title="liked.has(p.id) ? 'Liked! (community sync coming soon)' : 'Like'"
                @click.stop="toggleLike(p)"
              >
                <span :key="likeBurst[p.id] || 0" class="heart">{{
                  liked.has(p.id) ? '❤️' : '🤍'
                }}</span>
                {{ fmt(p.likes + (liked.has(p.id) ? 1 : 0)) }}
              </button>
              <span class="stat">💬 {{ fmt(p.comments) }}</span>
              <span class="stat">⭐ {{ fmt(p.stars) }}</span>
              <span class="stat followers">👥 {{ fmt(p.followers) }}</span>
            </div>
          </div>
        </div>
      </article>
    </TransitionGroup>

    <!-- Coming-soon modal -->
    <Transition name="peek">
      <div v-if="peek" class="peek-backdrop" @click.self="peek = null">
        <div class="peek-card">
          <button class="peek-close" type="button" title="Close" @click="peek = null">×</button>
          <div class="peek-cover">
            <canvas :ref="(el) => paintPeek(el)" class="cover-canvas"></canvas>
            <div class="peek-cover-shade"></div>
            <div class="peek-headline">
              <h3>{{ peek.title }}</h3>
              <span>@{{ peek.author }} · {{ peek.people }} people</span>
            </div>
          </div>
          <div class="peek-body">
            <div class="peek-lock">🔭</div>
            <h4>Community browsing is almost here</h4>
            <p>
              Soon you'll be able to step inside trees like this one — explore them view by view,
              follow the makers, leave comments, and favorite the families you love.
            </p>
            <div class="peek-soon">
              <span>👣 Follow</span>
              <span>💬 Comment</span>
              <span>❤️ Like</span>
              <span>⭐ Favorite</span>
            </div>
            <button class="peek-cta" type="button" @click="startFromPeek">
              Start your own tree instead →
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import { MOCK_PROJECTS, drawProjectCover } from './mockProjects'

const emit = defineEmits(['start'])

const FILTERS = [
  { id: 'all', label: '✨ All' },
  { id: 'trending', label: '🔥 Trending' },
  { id: 'fictional', label: '🐉 Fictional' },
  { id: 'historical', label: '🏛 Historical' },
  { id: 'personal', label: '🏡 Personal' }
]

const filter = ref('all')
const liked = reactive(new Set())
const likeBurst = reactive({})
const peek = ref(null)

const filtered = computed(() => {
  if (filter.value === 'all') return MOCK_PROJECTS
  if (filter.value === 'trending') return MOCK_PROJECTS.filter((p) => p.badge === 'Trending')
  return MOCK_PROJECTS.filter((p) => p.category === filter.value)
})

// ── Generated covers ─────────────────────────────────────────────────────────
// Each card's canvas gets painted once it lands in the DOM; repaint on resize
// so the buffer matches the card's real size (they're cheap one-shot draws).
const covers = new Map()

function setCover(el, project) {
  if (!el) {
    covers.delete(project.id)
    return
  }
  if (covers.get(project.id) !== el) {
    covers.set(project.id, el)
    nextTick(() => drawProjectCover(el, project))
  }
}

function paintPeek(el) {
  if (el && peek.value) nextTick(() => drawProjectCover(el, peek.value))
}

let resizeRaf = 0
function onResize() {
  cancelAnimationFrame(resizeRaf)
  resizeRaf = requestAnimationFrame(() => {
    for (const [id, el] of covers) {
      const project = MOCK_PROJECTS.find((p) => p.id === id)
      if (project) drawProjectCover(el, project)
    }
  })
}

onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))

// ── 3D tilt (pointer-tracked, GPU-only transforms) ───────────────────────────
const allowTilt = !window.matchMedia('(prefers-reduced-motion: reduce)').matches

function tilt(e) {
  if (!allowTilt) return
  const card = e.currentTarget
  const rect = card.getBoundingClientRect()
  const nx = (e.clientX - rect.left) / rect.width - 0.5
  const ny = (e.clientY - rect.top) / rect.height - 0.5
  card.style.setProperty('--rx', (-ny * 7).toFixed(2) + 'deg')
  card.style.setProperty('--ry', (nx * 9).toFixed(2) + 'deg')
  card.style.setProperty('--gx', ((nx + 0.5) * 100).toFixed(1) + '%')
  card.style.setProperty('--gy', ((ny + 0.5) * 100).toFixed(1) + '%')
}

function untilt(e) {
  const card = e.currentTarget
  card.style.setProperty('--rx', '0deg')
  card.style.setProperty('--ry', '0deg')
}

// ── Interactions ─────────────────────────────────────────────────────────────
function toggleLike(p) {
  if (liked.has(p.id)) liked.delete(p.id)
  else {
    liked.add(p.id)
    likeBurst[p.id] = (likeBurst[p.id] || 0) + 1 // re-key to replay the pop
  }
}

function open(p) {
  peek.value = p
}

function startFromPeek() {
  peek.value = null
  emit('start')
}

function fmt(n) {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n)
}

function badgeIcon(badge) {
  return badge === 'Trending' ? '🔥' : badge === 'Staff pick' ? '🏅' : '🌱'
}

function avatarStyle(p) {
  return { background: `hsl(${p.hue} 55% 42%)` }
}
</script>

<style scoped>
.gallery {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

/* ── Chips ────────────────────────────────────────────────────────────────── */
.chips {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.chip {
  padding: 7px 15px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease,
    transform 0.15s ease;
}

.chip:hover {
  color: var(--t1);
  transform: translateY(-1px);
}

.chip.active {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 50%, transparent);
  background: var(--adim);
}

/* ── Grid + FLIP shuffle ──────────────────────────────────────────────────── */
.grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(272px, 1fr));
  gap: 20px;
}

.cards-move {
  transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
}

.cards-enter-active {
  transition:
    opacity 0.4s ease,
    transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

.cards-leave-active {
  position: absolute;
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.cards-enter-from,
.cards-leave-to {
  opacity: 0;
  transform: scale(0.92);
}

/* ── Card ─────────────────────────────────────────────────────────────────── */
.card {
  --rx: 0deg;
  --ry: 0deg;
  --gx: 50%;
  --gy: 50%;
  perspective: 800px;
  cursor: pointer;
}

.card-inner {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--surface);
  overflow: hidden;
  transform: rotateX(var(--rx)) rotateY(var(--ry));
  transition:
    transform 0.18s ease-out,
    border-color 0.25s ease,
    box-shadow 0.3s ease;
  will-change: transform;
}

.card:hover .card-inner {
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  box-shadow:
    0 18px 44px rgba(0, 0, 0, 0.35),
    0 0 24px color-mix(in srgb, var(--accent) 14%, transparent);
}

/* ── Cover art ────────────────────────────────────────────────────────────── */
.cover {
  position: relative;
  aspect-ratio: 16 / 8.4;
  overflow: hidden;
}

.cover-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: scale(1.02);
  transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

.card:hover .cover-canvas {
  transform: scale(1.09);
}

/* cursor-tracked glare sweep */
.cover-glare {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    340px circle at var(--gx) var(--gy),
    rgba(255, 255, 255, 0.14),
    transparent 55%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.card:hover .cover-glare {
  opacity: 1;
}

.badge-pill {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 4px 11px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.3px;
  color: #fff;
  background: rgba(10, 12, 20, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(8px);
}

.badge-Trending {
  background: linear-gradient(120deg, rgba(245, 100, 60, 0.75), rgba(240, 60, 110, 0.75));
}

.badge-Staffpick {
  background: linear-gradient(120deg, rgba(108, 142, 245, 0.75), rgba(139, 108, 197, 0.75));
}

.badge-New {
  background: linear-gradient(120deg, rgba(60, 170, 110, 0.78), rgba(60, 190, 170, 0.78));
}

.cover-meta {
  position: absolute;
  bottom: 9px;
  right: 11px;
  font-size: 10.5px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.6);
}

/* ── Body ─────────────────────────────────────────────────────────────────── */
.body {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 14px 16px 13px;
  flex: 1;
}

.title {
  margin: 0;
  font-size: 15.5px;
  font-weight: 700;
  color: var(--t1);
  letter-spacing: 0.1px;
}

.blurb {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--t2);
  flex: 1;
}

.meta {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11.5px;
  color: var(--t2);
}

.avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
}

.author {
  font-weight: 600;
  color: var(--t1);
}

.updated {
  color: var(--t3);
}

/* ── Stats row ────────────────────────────────────────────────────────────── */
.stats {
  display: flex;
  align-items: center;
  gap: 13px;
  padding-top: 9px;
  border-top: 1px solid var(--border);
  font-size: 11.5px;
  font-weight: 600;
  color: var(--t2);
}

.stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.stat.like {
  border: none;
  background: none;
  padding: 2px 4px;
  margin: -2px -4px;
  border-radius: 7px;
  font: inherit;
  color: inherit;
  cursor: pointer;
  transition: color 0.2s ease;
}

.stat.like:hover {
  color: var(--pink);
}

.stat.like.liked {
  color: var(--pink);
}

.heart {
  display: inline-block;
  animation: heart-pop 0.45s cubic-bezier(0.34, 1.8, 0.64, 1);
}

@keyframes heart-pop {
  0% {
    transform: scale(0.4);
  }
  60% {
    transform: scale(1.45);
  }
  100% {
    transform: scale(1);
  }
}

.followers {
  margin-left: auto;
}

/* ── Peek (coming soon) modal ─────────────────────────────────────────────── */
.peek-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(8, 10, 18, 0.6);
  backdrop-filter: blur(10px);
}

.peek-card {
  position: relative;
  width: min(460px, 100%);
  border-radius: 22px;
  border: 1px solid var(--border);
  background: var(--surface);
  overflow: hidden;
  box-shadow: var(--shadow);
}

.peek-close {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: rgba(10, 12, 20, 0.55);
  color: #fff;
  font-size: 17px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.peek-close:hover {
  background: rgba(10, 12, 20, 0.8);
}

.peek-cover {
  position: relative;
  height: 170px;
}

.peek-cover-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 30%, rgba(6, 8, 14, 0.72));
}

.peek-headline {
  position: absolute;
  left: 18px;
  bottom: 12px;
  color: #fff;
}

.peek-headline h3 {
  margin: 0;
  font-size: 19px;
  font-weight: 800;
}

.peek-headline span {
  font-size: 12px;
  opacity: 0.85;
}

.peek-body {
  padding: 22px 24px 24px;
  text-align: center;
}

.peek-lock {
  font-size: 30px;
  animation: peek-bob 2.8s ease-in-out infinite;
}

@keyframes peek-bob {
  50% {
    transform: translateY(-6px) rotate(6deg);
  }
}

.peek-body h4 {
  margin: 8px 0 6px;
  font-size: 16px;
  color: var(--t1);
}

.peek-body p {
  margin: 0 auto;
  max-width: 340px;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--t2);
}

.peek-soon {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
  margin: 16px 0 18px;
}

.peek-soon span {
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px dashed color-mix(in srgb, var(--accent) 45%, transparent);
  background: var(--adim);
  color: var(--t1);
  font-size: 11.5px;
  font-weight: 600;
}

.peek-cta {
  border: none;
  border-radius: 11px;
  padding: 11px 22px;
  background: linear-gradient(135deg, var(--accent), #8b6cc5);
  color: #fff;
  font-family: var(--font);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.25s ease;
}

.peek-cta:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--accent) 40%, transparent);
}

.peek-enter-active,
.peek-leave-active {
  transition: opacity 0.25s ease;
}

.peek-enter-active .peek-card {
  transition: transform 0.35s cubic-bezier(0.34, 1.3, 0.64, 1);
}

.peek-leave-active .peek-card {
  transition: transform 0.2s ease;
}

.peek-enter-from,
.peek-leave-to {
  opacity: 0;
}

.peek-enter-from .peek-card,
.peek-leave-to .peek-card {
  transform: translateY(22px) scale(0.95);
}
</style>
