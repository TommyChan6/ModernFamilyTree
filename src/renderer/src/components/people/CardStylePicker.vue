<template>
  <div ref="rootEl" class="csp">
    <!-- Toolbar trigger -->
    <button
      class="csp-btn"
      :class="{ open }"
      :title="'Card style: ' + current.label"
      @click="open = !open"
    >
      <span class="csp-btn-icon">🎴</span>
      {{ current.label }}
      <span class="csp-caret" :class="{ open }">▾</span>
    </button>

    <!-- Floating gallery -->
    <Transition name="csp-pop">
      <div v-if="open" class="csp-panel">
        <div class="csp-head">
          <span class="csp-title">Card style</span>
          <span class="csp-sub">how the directory deals its deck</span>
        </div>
        <div class="csp-row">
          <button
            v-for="(s, i) in STYLES"
            :key="s.id"
            class="csp-item"
            :class="{ active: s.id === store.cardStyle }"
            :style="{ '--i': i }"
            :title="s.blurb"
            @click="pick(s.id)"
          >
            <!-- Miniature card face (pure CSS caricature of each style) -->
            <span class="csp-mini" :class="'m-' + s.id">
              <template v-if="s.id === 'classic'">
                <i class="mc-banner"></i>
                <i class="mc-dot"></i>
                <i class="mc-line w1"></i>
                <i class="mc-line w2"></i>
                <i class="mc-stats"></i>
              </template>
              <template v-else-if="s.id === 'poster'">
                <i class="mp-photo"></i>
                <i class="mp-scrim"></i>
                <i class="mp-line w1"></i>
                <i class="mp-line w2"></i>
              </template>
              <template v-else-if="s.id === 'holo'">
                <i class="mh-art"></i>
                <i class="mh-line w1"></i>
                <i class="mh-line w2"></i>
                <i class="mh-shine"></i>
              </template>
              <template v-else-if="s.id === 'neon'">
                <i class="mn-avatar"></i>
                <i class="mn-line w1"></i>
                <i class="mn-line w2"></i>
                <i class="mn-scan"></i>
              </template>
              <template v-else-if="s.id === 'arcana'">
                <i class="ma-frame"></i>
                <i class="ma-arch"></i>
                <i class="ma-line w1"></i>
                <i class="ma-star">✦</i>
              </template>
              <template v-else-if="s.id === 'scroll'">
                <i class="ms-cord"></i>
                <i class="ms-stave"></i>
                <i class="ms-silk"></i>
                <i class="ms-paper"></i>
                <i class="ms-hill"></i>
                <i class="ms-enso"></i>
                <i class="ms-name"></i>
                <i class="ms-seal"></i>
                <i class="ms-roller"></i>
              </template>
              <template v-else-if="s.id === 'moonfan'">
                <i class="mf-leaf"></i>
                <i class="mf-branch"></i>
                <i class="mf-bloom b1"></i>
                <i class="mf-bloom b2"></i>
                <i class="mf-name"></i>
                <i class="mf-handle"></i>
                <i class="mf-tassel"></i>
              </template>
              <span v-if="s.id === store.cardStyle" class="csp-check">✓</span>
            </span>
            <span class="csp-label">{{ s.label }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMainStore } from '../../store/index.js'

// The Directory's card-style selector: a toolbar chip that opens a small
// gallery of miniature card faces. Picking one restyles the whole grid (the
// view re-deals the cards with that style's entrance animation) and persists
// per project via the store.

const store = useMainStore()
const open = ref(false)
const rootEl = ref(null)

const STYLES = [
  { id: 'classic', label: 'Classic', blurb: 'The original — banner, avatar, and stats.' },
  { id: 'poster', label: 'Full Art', blurb: 'The photo fills the card; info floats in front.' },
  { id: 'holo', label: 'Holo', blurb: 'Gold-foil trading card with HP, attacks, and rarity.' },
  { id: 'neon', label: 'Neon', blurb: 'Cyberpunk dossier — scanlines, glitches, barcodes.' },
  { id: 'arcana', label: 'Arcana', blurb: 'Tarot of the family — gilded frames and starlight.' },
  {
    id: 'scroll',
    label: 'Scroll',
    blurb: '立轴 — hanging ink scrolls with calligraphy and seals.'
  },
  {
    id: 'moonfan',
    label: 'Moon Fan',
    blurb: '团扇 — round silk fans painted with plum, bamboo and moon.'
  }
]

const current = computed(() => STYLES.find((s) => s.id === store.cardStyle) || STYLES[0])

function pick(id) {
  store.setCardStyle(id)
  open.value = false
}

// Close on outside click / Escape — no @blur (unreliable in headless runs).
function onDocPointerDown(e) {
  if (open.value && rootEl.value && !rootEl.value.contains(e.target)) open.value = false
}
function onDocKeydown(e) {
  if (open.value && e.key === 'Escape') {
    e.stopPropagation()
    open.value = false
  }
}
onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown, true)
  document.addEventListener('keydown', onDocKeydown, true)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  document.removeEventListener('keydown', onDocKeydown, true)
})
</script>

<style scoped>
.csp {
  position: relative;
}

/* ── Trigger chip ── */
.csp-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 13px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--elevated);
  color: var(--t2);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.18s,
    background 0.18s,
    border-color 0.18s,
    box-shadow 0.25s;
}
.csp-btn:hover {
  color: var(--t1);
  background: var(--hover);
}
.csp-btn.open {
  color: var(--t1);
  border-color: rgba(var(--accent-rgb), 0.5);
  box-shadow: 0 0 14px rgba(var(--accent-rgb), 0.22);
}
.csp-btn-icon {
  font-size: 14px;
}
.csp-caret {
  font-size: 9px;
  color: var(--t3);
  transition: transform 0.3s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.csp-caret.open {
  transform: rotate(180deg);
}

/* ── Panel ── */
.csp-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 30;
  padding: 12px 13px 11px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--glass-strong);
  backdrop-filter: blur(14px) saturate(1.2);
  box-shadow: var(--shadow);
  transform-origin: top right;
}
.csp-pop-enter-active {
  transition:
    transform 0.32s cubic-bezier(0.34, 1.3, 0.5, 1),
    opacity 0.22s ease;
}
.csp-pop-leave-active {
  transition:
    transform 0.18s ease,
    opacity 0.16s ease;
}
.csp-pop-enter-from,
.csp-pop-leave-to {
  transform: scale(0.9) translateY(-6px);
  opacity: 0;
}

.csp-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 10px;
  white-space: nowrap;
}
.csp-title {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.4px;
  color: var(--t1);
}
.csp-sub {
  font-size: 10.5px;
  color: var(--t3);
}

.csp-row {
  display: flex;
  gap: 9px;
}

/* ── One selectable style ── */
.csp-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: var(--font);
  animation: csp-item-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) calc(var(--i, 0) * 0.05s) backwards;
}
@keyframes csp-item-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.9);
  }
}
.csp-label {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--t3);
  transition: color 0.2s;
}
.csp-item:hover .csp-label,
.csp-item.active .csp-label {
  color: var(--t1);
}

/* Miniature card faces */
.csp-mini {
  position: relative;
  width: 58px;
  height: 82px;
  border-radius: 7px;
  border: 1px solid var(--border);
  overflow: hidden;
  display: block;
  background: var(--surface);
  transition:
    transform 0.28s cubic-bezier(0.34, 1.4, 0.5, 1),
    box-shadow 0.3s ease,
    border-color 0.2s ease;
}
.csp-item:hover .csp-mini {
  transform: translateY(-4px) rotate(-2deg) scale(1.06);
  box-shadow: 0 10px 20px -8px rgba(0, 0, 0, 0.5);
}
.csp-item.active .csp-mini {
  border-color: var(--accent);
  box-shadow:
    0 0 0 2px var(--accent),
    0 0 18px -2px rgba(var(--accent-rgb), 0.5);
  animation: csp-breathe 2.6s ease-in-out infinite;
}
@keyframes csp-breathe {
  0%,
  100% {
    box-shadow:
      0 0 0 2px var(--accent),
      0 0 12px -2px rgba(var(--accent-rgb), 0.4);
  }
  50% {
    box-shadow:
      0 0 0 2px var(--accent),
      0 0 22px 0 rgba(var(--accent-rgb), 0.6);
  }
}
.csp-mini i {
  position: absolute;
  display: block;
}
.csp-check {
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3;
}

/* classic mini */
.m-classic .mc-banner {
  top: 0;
  left: 0;
  right: 0;
  height: 20px;
  background: linear-gradient(115deg, #3a7bd5, #6c8ef5);
}
.m-classic .mc-dot {
  top: 11px;
  left: 50%;
  width: 18px;
  height: 18px;
  margin-left: -9px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6c8ef5, #3a5bb5);
  border: 2px solid var(--surface);
}
.m-classic .mc-line {
  left: 50%;
  height: 3px;
  border-radius: 2px;
  background: var(--t3);
  transform: translateX(-50%);
}
.m-classic .mc-line.w1 {
  top: 38px;
  width: 30px;
}
.m-classic .mc-line.w2 {
  top: 46px;
  width: 20px;
  opacity: 0.55;
}
.m-classic .mc-stats {
  left: 8px;
  right: 8px;
  bottom: 7px;
  height: 6px;
  border-top: 1px solid var(--border);
  background:
    radial-gradient(2.5px 2.5px at 20% 70%, #6c8ef5, transparent 100%),
    radial-gradient(2.5px 2.5px at 50% 70%, #6c8ef5, transparent 100%),
    radial-gradient(2.5px 2.5px at 80% 70%, #6c8ef5, transparent 100%);
}

/* poster mini */
.m-poster .mp-photo {
  inset: 0;
  background:
    radial-gradient(70% 55% at 50% 34%, #c95fa0, transparent 75%),
    linear-gradient(160deg, #38477f, #141a30);
}
.m-poster .mp-scrim {
  inset: 0;
  background: linear-gradient(180deg, transparent 45%, rgba(4, 6, 12, 0.9));
}
.m-poster .mp-line {
  left: 7px;
  height: 3.5px;
  border-radius: 2px;
  background: #fff;
}
.m-poster .mp-line.w1 {
  bottom: 16px;
  width: 34px;
}
.m-poster .mp-line.w2 {
  bottom: 9px;
  width: 22px;
  opacity: 0.55;
}

/* holo mini */
.m-holo {
  background: linear-gradient(145deg, #f4d97c, #b8913a 40%, #f8e6a0 75%, #caa53d);
}
.m-holo .mh-art {
  top: 10px;
  left: 6px;
  right: 6px;
  height: 30px;
  border-radius: 3px;
  background:
    radial-gradient(60% 70% at 50% 45%, #7d9df8, transparent 80%),
    linear-gradient(150deg, #1a2040, #0e1226);
}
.m-holo .mh-line {
  left: 8px;
  height: 3px;
  border-radius: 2px;
  background: rgba(30, 22, 4, 0.55);
}
.m-holo .mh-line.w1 {
  top: 48px;
  width: 32px;
}
.m-holo .mh-line.w2 {
  top: 56px;
  width: 24px;
  opacity: 0.6;
}
.m-holo .mh-shine {
  top: -20%;
  bottom: -20%;
  left: -30%;
  width: 40%;
  transform: rotate(18deg);
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 0, 132, 0.25),
    rgba(255, 255, 255, 0.5),
    rgba(0, 207, 255, 0.25),
    transparent
  );
}
.csp-item:hover .m-holo .mh-shine {
  animation: mh-shine-sweep 1.1s ease-in-out infinite;
}
@keyframes mh-shine-sweep {
  to {
    transform: rotate(18deg) translateX(400%);
  }
}

/* neon mini */
.m-neon {
  background: #090d13;
  border-color: rgba(41, 216, 255, 0.6);
}
.m-neon .mn-avatar {
  top: 12px;
  left: 50%;
  width: 20px;
  height: 20px;
  margin-left: -10px;
  border-radius: 50%;
  border: 1.5px solid #29d8ff;
  box-shadow: 0 0 8px rgba(41, 216, 255, 0.7);
}
.m-neon .mn-line {
  left: 9px;
  height: 2.5px;
  background: rgba(41, 216, 255, 0.7);
}
.m-neon .mn-line.w1 {
  top: 44px;
  width: 30px;
}
.m-neon .mn-line.w2 {
  top: 52px;
  width: 20px;
  opacity: 0.5;
}
.m-neon .mn-scan {
  left: 0;
  right: 0;
  top: 20%;
  height: 10px;
  background: linear-gradient(180deg, transparent, rgba(41, 216, 255, 0.3), transparent);
}
.csp-item:hover .m-neon .mn-scan {
  animation: mn-scan-mini 1.4s linear infinite;
}
@keyframes mn-scan-mini {
  from {
    transform: translateY(-24px);
  }
  to {
    transform: translateY(70px);
  }
}

/* arcana mini */
.m-arcana {
  background: radial-gradient(120% 90% at 50% 0%, #241a44, #0d0920);
  border-color: rgba(212, 175, 55, 0.55);
}
.m-arcana .ma-frame {
  inset: 3px;
  border: 1px solid rgba(212, 175, 55, 0.6);
  border-radius: 4px;
}
.m-arcana .ma-arch {
  top: 12px;
  left: 50%;
  width: 26px;
  height: 30px;
  margin-left: -13px;
  border-radius: 13px 13px 3px 3px;
  border: 1px solid rgba(212, 175, 55, 0.8);
  background: radial-gradient(80% 80% at 50% 20%, #4a3a8a, #1a1338);
}
.m-arcana .ma-line {
  left: 50%;
  height: 3px;
  border-radius: 2px;
  background: rgba(239, 228, 195, 0.75);
  transform: translateX(-50%);
}
.m-arcana .ma-line.w1 {
  top: 50px;
  width: 28px;
}
.m-arcana .ma-star {
  bottom: 6px;
  left: 0;
  right: 0;
  font-size: 8px;
  font-style: normal;
  color: #d4af37;
  text-align: center;
  text-shadow: 0 0 6px rgba(212, 175, 55, 0.8);
}
.csp-item:hover .m-arcana .ma-star {
  animation: ma-star-spin 1.6s ease-in-out infinite;
}
@keyframes ma-star-spin {
  50% {
    transform: rotate(180deg) scale(1.3);
  }
}

/* scroll mini — a hanging scroll on a paper wall */
.m-scroll {
  background: color-mix(in srgb, var(--surface) 70%, #e9dfc8);
}
.m-scroll .ms-cord {
  top: 2px;
  left: 50%;
  width: 26px;
  height: 8px;
  margin-left: -13px;
  border: 1px solid #6b5a44;
  border-bottom: none;
  border-radius: 13px 13px 0 0;
}
.m-scroll .ms-stave {
  top: 8px;
  left: 11px;
  right: 11px;
  height: 3px;
  border-radius: 1px;
  background: #3b2a1d;
}
.m-scroll .ms-silk {
  top: 10px;
  left: 13px;
  right: 13px;
  bottom: 12px;
  background:
    linear-gradient(
        90deg,
        transparent 32%,
        #8c9a93 32% 38%,
        transparent 38% 62%,
        #8c9a93 62% 68%,
        transparent 68%
      )
      0 0 / 100% 12px no-repeat,
    #a9b4ad;
  box-shadow: 0 4px 6px -3px rgba(0, 0, 0, 0.5);
}
.m-scroll .ms-paper {
  top: 23px;
  left: 16px;
  right: 16px;
  bottom: 18px;
  background: #f6f0e2;
  border-top: 1.5px solid #6d5a3e;
  border-bottom: 1.5px solid #6d5a3e;
}
.m-scroll .ms-hill {
  left: 16px;
  bottom: 18px;
  width: 18px;
  height: 12px;
  background: linear-gradient(180deg, rgba(28, 26, 23, 0.55), rgba(28, 26, 23, 0.05));
  clip-path: polygon(0 100%, 0 40%, 30% 0, 55% 45%, 75% 25%, 100% 100%);
}
.m-scroll .ms-enso {
  top: 30px;
  left: 18px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  border: 1.6px solid #1c1a17;
  border-right-color: transparent;
  transform: rotate(-30deg);
  opacity: 0.85;
}
.m-scroll .ms-name {
  top: 27px;
  right: 18px;
  width: 2.6px;
  height: 20px;
  border-radius: 2px;
  background: #1c1a17;
}
.m-scroll .ms-seal {
  top: 50px;
  right: 17px;
  width: 5px;
  height: 5px;
  background: #b3352a;
  border-radius: 1px;
}
.m-scroll .ms-roller {
  bottom: 8px;
  left: 9px;
  right: 9px;
  height: 4px;
  border-radius: 2px;
  background:
    linear-gradient(
      90deg,
      #c9d3c2 0 3px,
      transparent 3px calc(100% - 3px),
      #c9d3c2 calc(100% - 3px)
    ),
    #3b2a1d;
  transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
.csp-item:hover .m-scroll .ms-roller {
  transform: translateY(3px);
}
.csp-item:hover .m-scroll .ms-silk {
  bottom: 9px;
}
.m-scroll .ms-silk {
  transition: bottom 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

/* moon-fan mini */
.m-moonfan {
  background: color-mix(in srgb, var(--surface) 70%, #e9dfc8);
  perspective: 160px;
}
.m-moonfan .mf-leaf {
  top: 7px;
  left: 50%;
  width: 44px;
  height: 44px;
  margin-left: -22px;
  border-radius: 50%;
  background: #f3ead6;
  box-shadow:
    0 0 0 2px #6a4a2f,
    0 4px 6px -2px rgba(0, 0, 0, 0.45);
  transition: transform 0.5s cubic-bezier(0.34, 1.3, 0.5, 1);
}
.csp-item:hover .m-moonfan .mf-leaf {
  transform: rotateY(24deg);
}
.m-moonfan .mf-branch {
  top: 15px;
  left: 30px;
  width: 22px;
  height: 2.5px;
  border-radius: 2px;
  background: #1c1a17;
  transform: rotate(18deg);
}
.m-moonfan .mf-bloom {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #b3352a;
  opacity: 0.8;
}
.m-moonfan .mf-bloom.b1 {
  top: 14px;
  left: 33px;
}
.m-moonfan .mf-bloom.b2 {
  top: 21px;
  left: 42px;
}
.m-moonfan .mf-name {
  top: 18px;
  left: 17px;
  width: 2.4px;
  height: 18px;
  border-radius: 2px;
  background: #1c1a17;
}
.m-moonfan .mf-handle {
  top: 52px;
  left: 50%;
  width: 3px;
  height: 20px;
  margin-left: -1.5px;
  background: linear-gradient(90deg, #6b5232, #c9a96e, #5d4528);
}
.m-moonfan .mf-tassel {
  top: 71px;
  left: 50%;
  width: 4px;
  height: 8px;
  margin-left: -2px;
  background: #b3352a;
  border-radius: 1px 1px 2px 2px;
  transform-origin: 50% 0;
}
.csp-item:hover .m-moonfan .mf-tassel {
  animation: mf-swing 1.4s ease-in-out infinite;
}
@keyframes mf-swing {
  0%,
  100% {
    transform: rotate(-12deg);
  }
  50% {
    transform: rotate(12deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .csp-item:hover .m-moonfan .mf-tassel,
  .csp-item,
  .csp-item.active .csp-mini,
  .csp-item:hover .m-holo .mh-shine,
  .csp-item:hover .m-neon .mn-scan,
  .csp-item:hover .m-arcana .ma-star {
    animation: none;
  }
}
</style>
