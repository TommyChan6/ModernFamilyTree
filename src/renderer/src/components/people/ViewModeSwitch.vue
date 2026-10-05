<template>
  <div class="vms" role="tablist" aria-label="Directory view mode">
    <div class="vms-thumb" :style="{ transform: `translateX(${thumbX}px)` }"></div>
    <template v-for="(m, i) in MODES" :key="m.id">
      <!-- Divider between the card modes and the non-card mediums -->
      <i v-if="i === CARD_MODE_COUNT" class="vms-div" aria-hidden="true"></i>
      <button
        class="vms-btn"
        :class="{ active: store.viewMode === m.id }"
        :title="m.label + ' — ' + m.blurb"
        @click="store.setViewMode(m.id)"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <template v-if="m.id === 'grid'">
            <rect x="2" y="2" width="5.2" height="5.2" rx="1" />
            <rect x="8.8" y="2" width="5.2" height="5.2" rx="1" />
            <rect x="2" y="8.8" width="5.2" height="5.2" rx="1" />
            <rect x="8.8" y="8.8" width="5.2" height="5.2" rx="1" />
          </template>
          <template v-else-if="m.id === 'wheel'">
            <ellipse
              cx="8"
              cy="11.4"
              rx="6.2"
              ry="2.2"
              fill="none"
              stroke-width="1.3"
              class="vms-stroke"
            />
            <rect x="5.7" y="2.2" width="4.6" height="7" rx="0.9" />
          </template>
          <template v-else-if="m.id === 'flow'">
            <path d="M1.3 4.6l3.1-1.2v9.2l-3.1-1.2z" opacity="0.55" />
            <path d="M14.7 4.6l-3.1-1.2v9.2l3.1-1.2z" opacity="0.55" />
            <rect x="5.6" y="2.6" width="4.8" height="10.8" rx="1" />
          </template>
          <template v-else-if="m.id === 'fan'">
            <rect
              x="5.8"
              y="4.2"
              width="4.4"
              height="9.6"
              rx="0.9"
              transform="rotate(-26 8 14)"
              opacity="0.5"
            />
            <rect
              x="5.8"
              y="4.2"
              width="4.4"
              height="9.6"
              rx="0.9"
              transform="rotate(26 8 14)"
              opacity="0.5"
            />
            <rect x="5.8" y="2.8" width="4.4" height="10.4" rx="0.9" />
          </template>
          <template v-else-if="m.id === 'deck'">
            <rect
              x="3"
              y="4.6"
              width="8.6"
              height="10"
              rx="1.1"
              transform="rotate(-9 7.3 9.6)"
              opacity="0.45"
            />
            <rect x="5.2" y="2.4" width="8.6" height="10.6" rx="1.1" />
          </template>
          <template v-else-if="m.id === 'sheet'">
            <rect x="1.5" y="2" width="13" height="3" rx="1" />
            <rect x="1.5" y="6.4" width="3.4" height="2.6" rx="0.6" opacity="0.55" />
            <rect x="6" y="6.4" width="8.5" height="2.6" rx="0.6" opacity="0.55" />
            <rect x="1.5" y="10.4" width="3.4" height="2.6" rx="0.6" opacity="0.55" />
            <rect x="6" y="10.4" width="8.5" height="2.6" rx="0.6" opacity="0.55" />
          </template>
          <template v-else-if="m.id === 'hive'">
            <path d="M8 1.6l3.4 1.95v3.9L8 9.4 4.6 7.45v-3.9z" />
            <path d="M3.6 9.2L7 11.15v3.9l-.6.35-2.8-1.6v-3.9z" opacity="0.55" />
            <path d="M12.4 9.2L9 11.15v3.9l.6.35 2.8-1.6v-3.9z" opacity="0.55" />
          </template>
          <template v-else>
            <rect x="2" y="2.4" width="12" height="2.8" rx="1.2" opacity="0.4" />
            <rect x="1" y="6.6" width="14" height="3.2" rx="1.4" />
            <rect x="2" y="11" width="12" height="2.8" rx="1.2" opacity="0.4" />
          </template>
        </svg>
      </button>
    </template>

    <!-- Showcase: one button opening a gallery of the more theatrical mediums -->
    <i class="vms-div" aria-hidden="true"></i>
    <button
      ref="showBtn"
      class="vms-btn vms-show"
      :class="{ active: !!activeShowcase, open: galleryOpen }"
      :title="showTitle"
      :aria-expanded="galleryOpen"
      @click="toggleGallery"
    >
      <svg v-if="activeShowcase" viewBox="0 0 16 16" aria-hidden="true">
        <ShowcaseGlyph :id="activeShowcase.id" />
      </svg>
      <span v-else class="vms-spark">✦</span>
    </button>

    <Transition name="vms-gal">
      <div v-if="galleryOpen" ref="galleryEl" class="vms-gallery" role="menu">
        <div class="vms-gal-head">
          <span class="vms-gal-title">✦ Showcase</span>
          <span class="vms-gal-sub">Other ways to meet everyone</span>
        </div>
        <div class="vms-gal-grid">
          <button
            v-for="(m, i) in SHOWCASE"
            :key="m.id"
            class="vms-tile"
            :class="{ on: store.viewMode === m.id, wide: m.wide }"
            :style="{ '--i': i, '--tc': m.color }"
            role="menuitem"
            @click="pick(m.id)"
          >
            <!-- the Handscroll gets a wide tile: a tiny scroll that unrolls on hover -->
            <span v-if="m.wide" class="vms-hs-art" aria-hidden="true">
              <i class="vhs-roll r"></i>
              <i class="vhs-paper" :style="{ backgroundImage: `url(${scrollArt})` }">
                <i class="vhs-seal"></i>
              </i>
              <i class="vhs-roll l"></i>
            </span>
            <span v-else class="vms-tile-art">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <ShowcaseGlyph :id="m.id" />
              </svg>
            </span>
            <span class="vms-tile-text">
              <span class="vms-tile-label">{{ m.label }}</span>
              <span class="vms-tile-blurb">{{ m.blurb }}</span>
            </span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, ref, watch, onBeforeUnmount, h } from 'vue'
import { useMainStore } from '../../store/index.js'
import { landscapeDataUrl } from '../../lib/inkArt'

// Segmented switch for the Directory's viewing modes — the card modes (grid +
// the CardStage layouts) and, past the divider, the non-card mediums (Hive's
// honeycomb, Reel's strip drum, the editable Sheet). A sliding thumb marks
// the active mode.

const store = useMainStore()

const MODES = [
  { id: 'grid', label: 'Grid', blurb: 'the classic scrolling wall of cards' },
  { id: 'wheel', label: 'Carousel', blurb: 'a 3D ring of cards — drag to spin it' },
  { id: 'flow', label: 'Flow', blurb: 'coverflow with floor reflections' },
  { id: 'fan', label: 'Hand', blurb: 'a fanned hand of cards' },
  { id: 'deck', label: 'Deck', blurb: 'swipe through the deck one card at a time' },
  { id: 'hive', label: 'Hive', blurb: 'a honeycomb — every person a hexagon' },
  { id: 'reel', label: 'Reel', blurb: 'a spinning drum of film strips' },
  { id: 'sheet', label: 'Sheet', blurb: 'a spreadsheet — type, paste and sort every trait' }
]
const CARD_MODE_COUNT = 5

// The showcase mediums live behind one ✦ button (the switch would otherwise
// outgrow the toolbar); its gallery previews each one.
const SHOWCASE = [
  { id: 'roster', label: 'Roster', blurb: 'a fighting-game select screen', color: '#ff6b6b' },
  { id: 'codex', label: 'Codex', blurb: 'an illustrated bestiary, page by page', color: '#e0b458' },
  {
    id: 'board',
    label: 'Evidence',
    blurb: 'polaroids and red yarn on a corkboard',
    color: '#d9534f'
  },
  { id: 'elements', label: 'Elements', blurb: 'a periodic table of the family', color: '#4fc3a1' },
  { id: 'ranks', label: 'Ranks', blurb: 'a podium and a leaderboard race', color: '#f5a623' },
  { id: 'bubbles', label: 'Bubbles', blurb: 'packed bubbles that regroup', color: '#6c8ef5' },
  {
    id: 'handscroll',
    label: 'Handscroll',
    blurb: '长卷 — the family as one painted scroll, read right to left',
    color: '#b3352a',
    wide: true
  }
]
const activeShowcase = computed(() => SHOWCASE.find((m) => m.id === store.viewMode) || null)
const showTitle = computed(() =>
  activeShowcase.value
    ? `${activeShowcase.value.label} — ${activeShowcase.value.blurb}`
    : 'Showcase — more ways to see everyone'
)

// 16×16 glyphs for the showcase mediums (same filled, single-colour language
// as the mode icons above).
const GLYPHS = {
  roster: [
    ['rect', { x: 2, y: 1.6, width: 12, height: 7.4, rx: 1.3 }],
    ['rect', { x: 2, y: 10.6, width: 2.5, height: 3.4, rx: 0.6, opacity: 0.55 }],
    ['rect', { x: 5.2, y: 10.6, width: 2.5, height: 3.4, rx: 0.6 }],
    ['rect', { x: 8.3, y: 10.6, width: 2.5, height: 3.4, rx: 0.6, opacity: 0.55 }],
    ['rect', { x: 11.5, y: 10.6, width: 2.5, height: 3.4, rx: 0.6, opacity: 0.55 }]
  ],
  codex: [
    ['path', { d: 'M1.4 3.2c2.3-.9 4.3-.7 6 .6v9.7c-1.7-1.2-3.7-1.4-6-.6z' }],
    ['path', { d: 'M14.6 3.2c-2.3-.9-4.3-.7-6 .6v9.7c1.7-1.2 3.7-1.4 6-.6z', opacity: 0.55 }]
  ],
  board: [
    ['rect', { x: 3, y: 3.6, width: 8.4, height: 9.6, rx: 0.8, transform: 'rotate(-8 7.2 8.4)' }],
    ['circle', { cx: 6.6, cy: 3.4, r: 1.5, opacity: 0.55 }],
    [
      'path',
      {
        d: 'M10.4 6.2c1.6.6 2.7 2 3.2 4.4',
        fill: 'none',
        'stroke-width': 1.2,
        'stroke-linecap': 'round',
        class: 'vms-stroke'
      }
    ]
  ],
  elements: [
    ['rect', { x: 1.6, y: 1.8, width: 4, height: 4, rx: 0.7 }],
    ['rect', { x: 1.6, y: 6.2, width: 4, height: 4, rx: 0.7, opacity: 0.55 }],
    ['rect', { x: 1.6, y: 10.6, width: 4, height: 3.6, rx: 0.7, opacity: 0.55 }],
    ['rect', { x: 6, y: 10.6, width: 4, height: 3.6, rx: 0.7, opacity: 0.55 }],
    ['rect', { x: 10.4, y: 1.8, width: 4, height: 4, rx: 0.7 }],
    ['rect', { x: 10.4, y: 6.2, width: 4, height: 4, rx: 0.7, opacity: 0.55 }],
    ['rect', { x: 10.4, y: 10.6, width: 4, height: 3.6, rx: 0.7 }]
  ],
  ranks: [
    ['rect', { x: 6, y: 3.6, width: 4, height: 10.6, rx: 0.8 }],
    ['rect', { x: 1.6, y: 7, width: 4, height: 7.2, rx: 0.8, opacity: 0.55 }],
    ['rect', { x: 10.4, y: 9.2, width: 4, height: 5, rx: 0.8, opacity: 0.55 }],
    ['path', { d: 'M6.3 2.6l.9-1.3.8 1 .8-1 .9 1.3z' }]
  ],
  handscroll: [
    ['rect', { x: 0.8, y: 3, width: 2.6, height: 10, rx: 1.2 }],
    ['rect', { x: 12.6, y: 3, width: 2.6, height: 10, rx: 1.2 }],
    ['rect', { x: 3.4, y: 4.2, width: 9.2, height: 7.6, opacity: 0.4 }],
    ['path', { d: 'M3.4 11.8l2.6-3.6 1.6 1.8 2.1-3.2 2.9 5z' }],
    ['rect', { x: 10.4, y: 5.2, width: 1.3, height: 1.3, opacity: 0.85 }]
  ],
  bubbles: [
    ['circle', { cx: 6, cy: 6.6, r: 4.4 }],
    ['circle', { cx: 11.6, cy: 11, r: 3, opacity: 0.55 }],
    ['circle', { cx: 12, cy: 4.2, r: 1.8, opacity: 0.55 }],
    ['circle', { cx: 4.4, cy: 13, r: 1.6, opacity: 0.55 }]
  ]
}
const ShowcaseGlyph = {
  props: { id: { type: String, required: true } },
  setup(props) {
    return () => (GLYPHS[props.id] || []).map(([tag, attrs]) => h(tag, attrs))
  }
}

const galleryOpen = ref(false)
// The Handscroll tile's painting — generated lazily the first time the
// gallery opens (only the open gallery reads it), then cached by inkArt.
const scrollArt = computed(() => (galleryOpen.value ? landscapeDataUrl(560, 96, 33) : ''))
const showBtn = ref(null)
const galleryEl = ref(null)

function toggleGallery() {
  galleryOpen.value = !galleryOpen.value
}
function pick(id) {
  store.setViewMode(id)
  galleryOpen.value = false
}
function onOutside(e) {
  if (galleryEl.value?.contains(e.target) || showBtn.value?.contains(e.target)) return
  galleryOpen.value = false
}
function onKey(e) {
  if (e.key === 'Escape') galleryOpen.value = false
}
function unlisten() {
  window.removeEventListener('pointerdown', onOutside, true)
  window.removeEventListener('keydown', onKey)
}
watch(galleryOpen, (open) => {
  if (!open) return unlisten()
  window.addEventListener('pointerdown', onOutside, true)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(unlisten)

// Thumb offset in px: 34px per button, plus each divider's width once past it
// (the ✦ showcase button sits after a second divider).
const DIV_W = 9
const thumbX = computed(() => {
  if (activeShowcase.value) return MODES.length * 34 + 2 * DIV_W
  const i = Math.max(
    0,
    MODES.findIndex((m) => m.id === store.viewMode)
  )
  return i * 34 + (i >= CARD_MODE_COUNT ? DIV_W : 0)
})
</script>

<style scoped>
.vms {
  position: relative;
  display: flex;
  height: 36px;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--elevated);
}
.vms-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 34px;
  height: calc(100% - 6px);
  border-radius: 7px;
  background: var(--accent);
  box-shadow: 0 2px 10px rgba(var(--accent-rgb), 0.4);
  transition: transform 0.3s cubic-bezier(0.34, 1.4, 0.5, 1);
  pointer-events: none;
}
.vms-btn {
  position: relative;
  z-index: 1;
  width: 34px;
  border: none;
  background: transparent;
  color: var(--t3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  transition:
    color 0.2s,
    transform 0.2s;
}
.vms-btn:hover {
  color: var(--t1);
  transform: translateY(-1px);
}
.vms-btn.active {
  color: #fff;
  transform: none;
}
.vms-btn svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}
.vms-stroke {
  stroke: currentColor;
}
.vms-div {
  width: 1px;
  align-self: stretch;
  margin: 3px 4px;
  background: var(--border);
}

/* ── ✦ Showcase button + gallery ── */
.vms-spark {
  font-size: 14px;
  line-height: 1;
  background: linear-gradient(135deg, #ff9a8b, var(--amber) 40%, var(--accent) 80%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: vms-spark 3.2s ease-in-out infinite;
}
@keyframes vms-spark {
  0%,
  100% {
    transform: rotate(0) scale(1);
  }
  50% {
    transform: rotate(45deg) scale(1.15);
  }
}
.vms-show.open:not(.active) {
  color: var(--t1);
  background: var(--hover);
}

.vms-gallery {
  position: absolute;
  top: calc(100% + 8px);
  /* Opens rightward from the switch's left edge (the Directory sits beside
     the icon rail, so growing leftward would be clipped); it pops out of the
     ✦ button: 8 mode buttons × 34px + 2 dividers + half a button. */
  left: 0;
  z-index: 60;
  width: 372px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--glass-soft);
  backdrop-filter: blur(18px) saturate(1.3);
  box-shadow: var(--shadow);
  transform-origin: 311px -8px;
}
.vms-gal-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 0 4px 10px;
}
.vms-gal-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--t1);
}
.vms-gal-sub {
  font-size: 11px;
  color: var(--t2);
}
.vms-gal-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.vms-tile {
  --tc: var(--accent);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 6px 10px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: var(--elevated);
  color: var(--t1);
  font-family: var(--font);
  cursor: pointer;
  text-align: center;
  animation: vms-tile-in 0.42s cubic-bezier(0.34, 1.4, 0.5, 1) calc(var(--i) * 0.04s) backwards;
  transition:
    transform 0.22s cubic-bezier(0.34, 1.4, 0.5, 1),
    border-color 0.2s,
    box-shadow 0.2s;
}
@keyframes vms-tile-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.9);
  }
}
.vms-tile:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--tc) 55%, transparent);
  box-shadow: 0 8px 22px color-mix(in srgb, var(--tc) 25%, transparent);
}
.vms-tile.on {
  border-color: var(--tc);
  box-shadow: 0 0 0 1px var(--tc);
}
.vms-tile-art {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  color: var(--tc);
  background: radial-gradient(
    circle at 50% 35%,
    color-mix(in srgb, var(--tc) 26%, transparent),
    transparent 72%
  );
  transition: transform 0.3s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.vms-tile:hover .vms-tile-art {
  transform: scale(1.12) rotate(-4deg);
}
.vms-tile-art svg {
  width: 26px;
  height: 26px;
  fill: currentColor;
}
.vms-tile-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.vms-tile-label {
  font-size: 12px;
  font-weight: 700;
}

/* Wide Handscroll tile: art on the left, words on the right */
.vms-tile.wide {
  grid-column: 1 / -1;
  flex-direction: row;
  gap: 14px;
  padding: 10px 14px;
  text-align: left;
}
.vms-tile.wide .vms-tile-text {
  align-items: flex-start;
}
.vms-hs-art {
  position: relative;
  flex: 0 0 168px;
  height: 46px;
  display: block;
}
.vms-hs-art i {
  position: absolute;
  display: block;
}
.vhs-paper {
  top: 6px;
  bottom: 6px;
  right: 6px;
  width: 62%;
  background-color: #efe6d0;
  background-size: cover;
  background-position: right center;
  border-top: 3px solid #8c9a93;
  border-bottom: 3px solid #8c9a93;
  box-shadow: 0 3px 6px -3px rgba(0, 0, 0, 0.5);
  transition: width 0.7s cubic-bezier(0.55, 0.05, 0.25, 1);
}
.vhs-seal {
  right: 8px;
  top: 7px;
  width: 6px;
  height: 6px;
  border-radius: 1px;
  background: #b3352a;
}
.vhs-roll {
  top: 2px;
  bottom: 2px;
  width: 7px;
  border-radius: 3px;
  background:
    linear-gradient(90deg, rgba(0, 0, 0, 0.35), rgba(255, 255, 255, 0.35) 40%, rgba(0, 0, 0, 0.3)),
    linear-gradient(180deg, #3b2a1d 0 4px, #efe6d0 4px calc(100% - 4px), #3b2a1d calc(100% - 4px));
  transition: right 0.7s cubic-bezier(0.55, 0.05, 0.25, 1);
}
.vhs-roll.r {
  right: 2px;
}
.vhs-roll.l {
  right: calc(62% + 2px);
}
.vms-tile.wide:hover .vhs-paper,
.vms-tile.wide.on .vhs-paper {
  width: calc(100% - 12px);
}
.vms-tile.wide:hover .vhs-roll.l,
.vms-tile.wide.on .vhs-roll.l {
  right: calc(100% - 9px);
}
.vms-tile-blurb {
  font-size: 10px;
  line-height: 1.3;
  color: var(--t2);
}

.vms-gal-enter-active {
  transition:
    opacity 0.22s ease,
    transform 0.32s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.vms-gal-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.vms-gal-enter-from,
.vms-gal-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.92);
}

/* Ink: the gallery is a sheet of paper, not frosted glass */
:root[data-theme='ink'] .vms-gallery {
  background:
    var(--ink-paper-light, none) 0 0 / 256px 256px,
    var(--surface);
  backdrop-filter: none;
}

@media (prefers-reduced-motion: reduce) {
  .vms-spark,
  .vms-tile {
    animation: none;
  }
}
</style>
