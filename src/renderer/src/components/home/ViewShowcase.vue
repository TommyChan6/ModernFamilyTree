<template>
  <div class="showcase" :class="'mode-' + active">
    <!-- View picker -->
    <div class="tabs" role="tablist">
      <button
        v-for="view in VIEWS"
        :key="view.id"
        class="tab"
        :class="{ active: active === view.id }"
        type="button"
        role="tab"
        :aria-selected="active === view.id"
        @click="pick(view.id)"
      >
        <span class="tab-icon">{{ view.icon }}</span>
        <span class="tab-name">{{ view.name }}</span>
        <span v-if="autoplay && active === view.id" :key="cycle" class="tab-progress"></span>
      </button>
    </div>

    <!-- The stage: one family, morphing between five layouts -->
    <div class="stage-frame">
      <div class="stage-tilt" :class="{ tilted: active === 'space' }">
        <div class="stage-spin" :class="{ spinning: active === 'space' }">
          <!-- Group zone discs (groups view only) -->
          <div
            v-for="(g, gi) in GROUPS"
            :key="'g' + gi"
            class="disc"
            :class="'disc-' + gi"
            :style="discStyle(g)"
          >
            <span class="disc-label">{{ g.label }}</span>
          </div>

          <!-- Timeline year grid (timeline view only) -->
          <div v-for="year in YEARS" :key="'y' + year" class="yearline" :style="yearStyle(year)">
            <span class="yearline-label">{{ year }}</span>
          </div>

          <!-- Orbit rings (space view only) -->
          <div class="orbit orbit-a"></div>
          <div class="orbit orbit-b"></div>

          <!-- Family links (tree view only) -->
          <div
            v-for="(link, li) in LINKS"
            :key="'l' + li"
            class="link"
            :class="'link-' + link.kind"
            :style="linkStyle(link)"
          ></div>

          <!-- The twelve family members -->
          <div
            v-for="(p, i) in PEOPLE"
            :key="p.id"
            class="dot"
            :class="'c' + p.c"
            :style="dotStyle(p, i)"
          >
            <span class="dot-label">
              <span class="dot-name">{{ p.name }}</span>
              <span class="dot-sub">b. {{ p.birth }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Caption -->
    <Transition name="caption" mode="out-in">
      <p :key="active" class="caption">
        <strong>{{ activeView.title }}</strong> — {{ activeView.caption }}
      </p>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

// ── One tiny family, five layouts ────────────────────────────────────────────
// Positions live in a 100×60 design space; the stage keeps that aspect ratio,
// so x/y units map to identical pixel scales and link angles stay honest.

const PEOPLE = [
  { id: 0, name: 'Astrid', gen: 0, birth: 1921, death: 1996, group: 0, c: 0 },
  { id: 1, name: 'Henrik', gen: 0, birth: 1918, death: 1989, group: 0, c: 2 },
  { id: 2, name: 'Nora', gen: 1, birth: 1946, death: 2011, group: 1, c: 1 },
  { id: 3, name: 'Emil', gen: 1, birth: 1949, death: null, group: 0, c: 0 },
  { id: 4, name: 'Ingrid', gen: 1, birth: 1952, death: null, group: 2, c: 3 },
  { id: 5, name: 'Jonas', gen: 1, birth: 1950, death: 2019, group: 1, c: 2 },
  { id: 6, name: 'Sofia', gen: 2, birth: 1975, death: null, group: 1, c: 1 },
  { id: 7, name: 'Mateo', gen: 2, birth: 1978, death: null, group: 2, c: 0 },
  { id: 8, name: 'Freya', gen: 2, birth: 1981, death: null, group: 0, c: 3 },
  { id: 9, name: 'Kai', gen: 2, birth: 1984, death: null, group: 2, c: 2 },
  { id: 10, name: 'Vera', gen: 2, birth: 1987, death: null, group: 1, c: 1 },
  { id: 11, name: 'Theo', gen: 2, birth: 1990, death: null, group: 0, c: 0 }
]

const TREE_POS = {
  0: { x: 44, y: 9 },
  1: { x: 56, y: 9 },
  2: { x: 20, y: 29 },
  5: { x: 30, y: 29 },
  3: { x: 52, y: 30 },
  4: { x: 74, y: 29 },
  6: { x: 10, y: 50 },
  7: { x: 21, y: 52 },
  10: { x: 32, y: 50 },
  8: { x: 47, y: 51 },
  11: { x: 58, y: 50 },
  9: { x: 74, y: 50 }
}

const LINKS = [
  { kind: 'union', from: TREE_POS[0], to: TREE_POS[1] },
  { kind: 'union', from: TREE_POS[2], to: TREE_POS[5] },
  { kind: 'child', from: { x: 50, y: 9 }, to: TREE_POS[2] },
  { kind: 'child', from: { x: 50, y: 9 }, to: TREE_POS[3] },
  { kind: 'child', from: { x: 50, y: 9 }, to: TREE_POS[4] },
  { kind: 'child', from: { x: 25, y: 29 }, to: TREE_POS[6] },
  { kind: 'child', from: { x: 25, y: 29 }, to: TREE_POS[7] },
  { kind: 'child', from: { x: 25, y: 29 }, to: TREE_POS[10] },
  { kind: 'child', from: TREE_POS[3], to: TREE_POS[8] },
  { kind: 'child', from: TREE_POS[3], to: TREE_POS[11] },
  { kind: 'child', from: TREE_POS[4], to: TREE_POS[9] }
]

const GROUPS = [
  { label: '🌾 The farm', x: 21, y: 34, r: 13.5 },
  { label: '⚓ Seafarers', x: 52, y: 32, r: 14.5 },
  { label: '🎻 Musicians', x: 81, y: 30, r: 11.5 }
]

const YEARS = [1920, 1940, 1960, 1980, 2000]
const yearToX = (year) => 8 + ((year - 1915) / (2026 - 1915)) * 84

const VIEWS = [
  {
    id: 'tree',
    icon: '🕸',
    name: 'Graph',
    title: 'The living graph',
    caption: 'a physics-driven web of everyone — drag someone and the whole family sways.'
  },
  {
    id: 'timeline',
    icon: '⏳',
    name: 'Timeline',
    title: 'Lifelines',
    caption: 'every person becomes a lifespan — see who overlapped, who never met.'
  },
  {
    id: 'groups',
    icon: '🫧',
    name: 'Groups',
    title: 'Houses & clans',
    caption: 'tag people into groups and watch them gather into glowing constellations.'
  },
  {
    id: 'grid',
    icon: '📇',
    name: 'Directory',
    title: 'The directory',
    caption: 'a searchable card index of your whole cast — built to scroll thousands.'
  },
  {
    id: 'space',
    icon: '🌌',
    name: '3D Space',
    title: 'Space mode',
    caption: 'the experimental lens — your dynasty floating in three dimensions.'
  }
]

const active = ref('tree')
const autoplay = ref(true)
const cycle = ref(0)
const activeView = computed(() => VIEWS.find((v) => v.id === active.value))

let timer = 0
function pick(id) {
  // A human touched the tabs — hand them the wheel for good.
  autoplay.value = false
  clearInterval(timer)
  active.value = id
}

onMounted(() => {
  timer = setInterval(() => {
    const idx = VIEWS.findIndex((v) => v.id === active.value)
    active.value = VIEWS[(idx + 1) % VIEWS.length].id
    cycle.value++
  }, 4600)
})
onUnmounted(() => clearInterval(timer))

// ── Layout math (design units → CSS percentages) ─────────────────────────────

const pct = (x, y, w, h) => ({
  left: x + '%',
  top: (y / 60) * 100 + '%',
  width: w + '%',
  height: (h / 60) * 100 + '%'
})

// Row order for the timeline: sorted by birth year.
const rowOf = {}
;[...PEOPLE].sort((a, b) => a.birth - b.birth).forEach((p, i) => (rowOf[p.id] = i))

// Ring slot inside each group disc.
const groupSlot = {}
GROUPS.forEach((g, gi) => {
  const members = PEOPLE.filter((p) => p.group === gi)
  members.forEach((p, i) => {
    const angle = (i / members.length) * Math.PI * 2 - Math.PI / 2
    groupSlot[p.id] = {
      x: g.x + Math.cos(angle) * g.r * 0.55,
      y: g.y + Math.sin(angle) * g.r * 0.55
    }
  })
})

// Fixed per-person depth for the 3D lens.
const DEPTHS = [-70, 40, -30, 60, -55, 25, 70, -45, 35, -65, 50, -20]

function dotLayout(p) {
  switch (active.value) {
    case 'timeline': {
      const x0 = yearToX(p.birth)
      const x1 = yearToX(p.death ?? 2026)
      return { x: (x0 + x1) / 2, y: 7 + rowOf[p.id] * 4.3, w: x1 - x0, h: 2.6, round: true }
    }
    case 'groups': {
      const s = groupSlot[p.id]
      return { x: s.x, y: s.y, w: 3.4, h: 3.4, round: true }
    }
    case 'grid': {
      const col = p.id % 4
      const row = Math.floor(p.id / 4)
      return { x: 12.5 + col * 25, y: 12 + row * 18, w: 22, h: 14, round: false }
    }
    case 'space': {
      const t = TREE_POS[p.id]
      return {
        x: 50 + (t.x - 50) * 1.12,
        y: 30 + (t.y - 30) * 1.12,
        w: 3.8,
        h: 3.8,
        round: true,
        z: DEPTHS[p.id]
      }
    }
    default: {
      const t = TREE_POS[p.id]
      const size = p.gen === 0 ? 4.6 : 3.6
      return { x: t.x, y: t.y, w: size, h: size, round: true }
    }
  }
}

function dotStyle(p, i) {
  const l = dotLayout(p)
  return {
    ...pct(l.x, l.y, l.w, l.h),
    borderRadius: l.round ? '999px' : '10px',
    transform: `translate(-50%, -50%) translateZ(${l.z ?? 0}px)`,
    transitionDelay: i * 36 + 'ms'
  }
}

function linkStyle(link) {
  const dx = link.to.x - link.from.x
  const dy = link.to.y - link.from.y
  return {
    left: link.from.x + '%',
    top: (link.from.y / 60) * 100 + '%',
    width: Math.hypot(dx, dy) + '%',
    transform: `translateY(-50%) rotate(${Math.atan2(dy, dx)}rad)`
  }
}

function discStyle(g) {
  return pct(g.x, g.y, g.r * 2, g.r * 2)
}

function yearStyle(year) {
  return { left: yearToX(year) + '%' }
}
</script>

<style scoped>
.showcase {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* ── Tabs ─────────────────────────────────────────────────────────────────── */
.tabs {
  display: flex;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
}

.tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 15px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  overflow: hidden;
  transition:
    color 0.25s ease,
    border-color 0.25s ease,
    background 0.25s ease,
    transform 0.2s ease;
}

.tab:hover {
  color: var(--t1);
  transform: translateY(-1px);
}

.tab.active {
  color: var(--t1);
  border-color: color-mix(in srgb, var(--accent) 50%, transparent);
  background: var(--adim);
  box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 22%, transparent);
}

.tab-icon {
  font-size: 14px;
}

/* autoplay countdown sweeping along the bottom edge of the active tab */
.tab-progress {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  background: var(--accent);
  animation: tab-progress 4.6s linear forwards;
  opacity: 0.8;
}

@keyframes tab-progress {
  from {
    width: 0;
  }
  to {
    width: 100%;
  }
}

/* ── Stage ────────────────────────────────────────────────────────────────── */
.stage-frame {
  position: relative;
  aspect-ratio: 100 / 60;
  max-width: 860px;
  width: 100%;
  margin: 0 auto;
  border: 1px solid var(--border);
  border-radius: 20px;
  background:
    radial-gradient(
      ellipse 90% 70% at 50% 0%,
      color-mix(in srgb, var(--accent) 7%, transparent),
      transparent
    ),
    var(--surface);
  overflow: hidden;
  perspective: 900px;
}

.stage-tilt {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  transition: transform 1.1s cubic-bezier(0.22, 1, 0.36, 1);
}

.stage-tilt.tilted {
  transform: rotateX(14deg) rotateY(-8deg) scale(0.92);
}

.stage-spin {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
}

.stage-spin.spinning {
  animation: stage-drift 11s ease-in-out infinite;
}

@keyframes stage-drift {
  0%,
  100% {
    transform: rotateY(0deg);
  }
  25% {
    transform: rotateY(7deg) rotateX(2deg);
  }
  75% {
    transform: rotateY(-7deg) rotateX(-2deg);
  }
}

/* ── People dots (they morph: star → lifeline → orbiter → card) ───────────── */
.dot {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition:
    left 0.85s cubic-bezier(0.22, 1, 0.36, 1),
    top 0.85s cubic-bezier(0.22, 1, 0.36, 1),
    width 0.85s cubic-bezier(0.22, 1, 0.36, 1),
    height 0.85s cubic-bezier(0.22, 1, 0.36, 1),
    border-radius 0.85s ease,
    transform 0.85s cubic-bezier(0.22, 1, 0.36, 1),
    background 0.5s ease,
    box-shadow 0.5s ease;
}

.dot.c0 {
  --dot: var(--accent);
}
.dot.c1 {
  --dot: var(--pink);
}
.dot.c2 {
  --dot: var(--green);
}
.dot.c3 {
  --dot: var(--amber);
}

.dot {
  background: linear-gradient(135deg, var(--dot), color-mix(in srgb, var(--dot) 55%, #fff));
  box-shadow: 0 0 12px color-mix(in srgb, var(--dot) 55%, transparent);
}

.mode-space .dot {
  box-shadow:
    0 0 18px color-mix(in srgb, var(--dot) 80%, transparent),
    0 0 46px color-mix(in srgb, var(--dot) 30%, transparent);
}

/* Directory mode: the dot IS the card */
.mode-grid .dot {
  background: var(--elevated);
  border: 1px solid var(--border);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  justify-content: flex-start;
  padding-left: 9%;
}

.dot-label {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  opacity: 0;
  transform: translateY(4px);
  transition:
    opacity 0.4s ease 0.3s,
    transform 0.4s ease 0.3s;
  pointer-events: none;
  white-space: nowrap;
}

.mode-grid .dot-label {
  opacity: 1;
  transform: translateY(0);
}

.dot-name {
  font-size: clamp(8px, 1.5vw, 13px);
  font-weight: 700;
  color: var(--t1);
}

.dot-sub {
  font-size: clamp(7px, 1.1vw, 10.5px);
  color: var(--t2);
}

/* a color chip on each directory card, painted with the person's hue */
.mode-grid .dot::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--dot);
}

/* Timeline mode: name floats inside the lifeline pill */
.mode-timeline .dot-label {
  opacity: 1;
  transform: none;
  flex-direction: row;
  align-items: center;
}

.mode-timeline .dot-name {
  font-size: 8.5px;
  color: rgba(255, 255, 255, 0.92);
}

.mode-timeline .dot-sub {
  display: none;
}

/* ── Links (tree view only) ───────────────────────────────────────────────── */
.link {
  position: absolute;
  height: 1.5px;
  transform-origin: 0 50%;
  border-radius: 2px;
  opacity: 0;
  transition:
    opacity 0.5s ease,
    left 0.85s cubic-bezier(0.22, 1, 0.36, 1),
    top 0.85s cubic-bezier(0.22, 1, 0.36, 1),
    width 0.85s cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: none;
}

.link-child {
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--accent) 65%, transparent),
    color-mix(in srgb, var(--accent) 25%, transparent)
  );
}

.link-union {
  background: var(--pink);
  height: 2px;
  box-shadow: 0 0 8px color-mix(in srgb, var(--pink) 60%, transparent);
}

.mode-tree .link {
  opacity: 0.75;
}

/* ── Group discs ──────────────────────────────────────────────────────────── */
.disc {
  --disc-c: var(--accent);
  position: absolute;
  transform: translate(-50%, -50%) scale(0.7);
  border-radius: 50%;
  background: color-mix(in srgb, var(--disc-c) 6%, transparent);
  opacity: 0;
  transition:
    opacity 0.55s ease,
    transform 0.75s cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: none;
}

/* the dashed rim spins on its own layer so the label pill can stay upright */
.disc::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1.5px dashed color-mix(in srgb, var(--disc-c) 42%, transparent);
}

.disc-1 {
  --disc-c: var(--pink);
}

.disc-2 {
  --disc-c: var(--amber);
}

.mode-groups .disc {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

.mode-groups .disc::before {
  animation: disc-spin 40s linear infinite;
}

@keyframes disc-spin {
  to {
    transform: rotate(360deg);
  }
}

.disc-label {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--glass-soft);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px 11px;
  font-size: 11px;
  font-weight: 700;
  color: var(--t1);
  white-space: nowrap;
  backdrop-filter: blur(6px);
}

/* ── Timeline year grid ───────────────────────────────────────────────────── */
.yearline {
  position: absolute;
  top: 4%;
  bottom: 4%;
  width: 1px;
  background: linear-gradient(
    180deg,
    transparent,
    var(--border) 20%,
    var(--border) 80%,
    transparent
  );
  opacity: 0;
  transition: opacity 0.55s ease;
  pointer-events: none;
}

.mode-timeline .yearline {
  opacity: 1;
}

.yearline-label {
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  font-weight: 600;
  color: var(--t3);
}

/* ── Space orbit rings ────────────────────────────────────────────────────── */
.orbit {
  position: absolute;
  left: 50%;
  top: 50%;
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.7s ease;
  pointer-events: none;
}

.orbit-a {
  width: 64%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%) rotateX(72deg);
}

.orbit-b {
  width: 88%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%) rotateX(72deg) rotateY(14deg);
  border-color: color-mix(in srgb, var(--pink) 22%, transparent);
}

.mode-space .orbit {
  opacity: 1;
}

/* ── Caption ──────────────────────────────────────────────────────────────── */
.caption {
  text-align: center;
  font-size: 14px;
  color: var(--t2);
  margin: 0;
  min-height: 22px;
}

.caption strong {
  color: var(--t1);
}

.caption-enter-active,
.caption-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.caption-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.caption-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (prefers-reduced-motion: reduce) {
  .dot,
  .link,
  .disc,
  .stage-tilt,
  .stage-spin {
    transition: none;
    animation: none !important;
  }
}
</style>
