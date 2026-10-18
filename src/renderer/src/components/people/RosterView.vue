<template>
  <div class="roster" :class="{ 'is-entering': entering }" :style="{ '--pc': focusColor }">
    <div v-if="!persons.length" class="roster-empty">
      <div class="roster-empty-icon">
        <UiIcon name="gamepad-2" :size="44" :stroke="1.5" />
      </div>
      <div class="roster-empty-title">{{ t('directory.roster.emptyTitle') }}</div>
      <div class="roster-empty-text">{{ t('directory.roster.emptyText') }}</div>
    </div>

    <template v-else>
      <!-- ── Splash: the focused fighter ── -->
      <section class="splash">
        <div class="sp-bg" aria-hidden="true">
          <div class="sp-lines sp-lines-a"></div>
          <div class="sp-lines sp-lines-b"></div>
          <div class="sp-streaks">
            <i v-for="n in 5" :key="n" :style="{ '--n': n }"></i>
          </div>
        </div>

        <Transition
          name="sp"
          appear
          appear-from-class="sp-appear-from"
          appear-active-class="sp-appear-active"
          appear-to-class="sp-appear-to"
        >
          <div
            v-if="focused"
            :key="focused.id"
            class="sp-card"
            :class="{ dead: focusDead }"
            :style="{ '--pc': focusColor, '--ns': nameScale }"
          >
            <div class="sp-tint" aria-hidden="true"></div>
            <div class="sp-watermark" aria-hidden="true">{{ focusInitials }}</div>

            <div class="sp-portrait-wrap" @click="lockFocused">
              <div class="sp-plate" aria-hidden="true"></div>
              <div class="sp-frame">
                <div class="sp-portrait">
                  <SplashArt :person="focused" />
                  <div class="sp-portrait-shine" aria-hidden="true"></div>
                </div>
              </div>
            </div>

            <div class="sp-info">
              <div class="sp-top">
                <span class="sp-p1">P1</span>
                <span class="sp-no">
                  {{ t('directory.roster.no', { n: String(focusIdx + 1).padStart(3, '0') }) }}
                  <small>/ {{ persons.length }}</small>
                </span>
                <span v-if="focusDead" class="sp-fallen">
                  <UiIcon name="moon" :size="12" :stroke="2.4" />
                  {{ t('directory.roster.departed') }}
                </span>
              </div>
              <h2 class="sp-name">{{ focused.name || t('directory.roster.unnamed') }}</h2>
              <div class="sp-epithet">{{ focusEpithet }}</div>
              <div v-if="focusLife" class="sp-life">{{ focusLife }}</div>

              <div class="sp-stats">
                <div
                  v-for="s in focusStats"
                  :key="s.key"
                  class="sp-stat"
                  :style="{ '--v': s.f, '--d': s.d }"
                >
                  <span class="sp-stat-k">{{ s.label }}</span>
                  <span class="sp-stat-bar"><i></i></span>
                  <span class="sp-stat-v">{{ s.text }}</span>
                </div>
              </div>

              <div v-if="focusTags.list.length || focusPartner" class="sp-tags">
                <span
                  v-for="(tag, k) in focusTags.list"
                  :key="tag.id"
                  class="sp-tag"
                  :style="{ '--tc': tag.color || 'var(--accent)', '--k': k }"
                >
                  <span>
                    <UiIcon v-if="tag.icon" class="sp-tag-icon" :name="tag.icon" :size="12" />
                    {{ defaultNameLabel(tag.label) }}
                  </span>
                </span>
                <span v-if="focusTags.more" class="sp-tag sp-tag-more" :style="{ '--k': 5 }">
                  <span>+{{ focusTags.more }}</span>
                </span>
                <span v-if="focusPartner" class="sp-partner" :style="{ '--k': 6 }">
                  <UiIcon name="heart" :size="12" :stroke="2.4" />
                  {{ focusPartner }}
                </span>
              </div>
            </div>

            <div v-if="lockedId === focused.id" class="sp-stamp">
              <span>{{ t('directory.roster.selected') }}</span>
            </div>
          </div>
        </Transition>

        <div v-if="wipeKey" :key="'w' + wipeKey" class="sp-wipe" aria-hidden="true"></div>
        <div v-if="lockKey" :key="'f' + lockKey" class="sp-flash" aria-hidden="true"></div>

        <button class="sp-lock" type="button" @click="lockFocused">
          {{ t('directory.roster.lockIn') }} <kbd>Enter</kbd>
        </button>
      </section>

      <!-- ── Divider rail ── -->
      <div class="rail">
        <span class="rail-title">{{ t('directory.roster.selectTitle') }}</span>
        <span class="rail-hint">
          <kbd
            ><UiIcon
              name="arrow-left"
              :size="11"
              :stroke="2.6"
              :label="t('directory.roster.keys.left')"
          /></kbd>
          <kbd
            ><UiIcon
              name="arrow-up"
              :size="11"
              :stroke="2.6"
              :label="t('directory.roster.keys.up')"
          /></kbd>
          <kbd
            ><UiIcon
              name="arrow-down"
              :size="11"
              :stroke="2.6"
              :label="t('directory.roster.keys.down')"
          /></kbd>
          <kbd
            ><UiIcon
              name="arrow-right"
              :size="11"
              :stroke="2.6"
              :label="t('directory.roster.keys.right')"
          /></kbd>
          {{ t('directory.roster.hintMove') }} <kbd>Enter</kbd> {{ t('directory.roster.hintLock') }}
        </span>
        <span class="rail-count">{{
          t(
            persons.length === 1
              ? 'directory.roster.fighters.one'
              : 'directory.roster.fighters.other',
            { n: persons.length }
          )
        }}</span>
      </div>

      <!-- ── Select grid (row-windowed) ── -->
      <div
        ref="gridEl"
        class="grid"
        :style="{ flexBasis: metrics.totalH + 'px' }"
        @scroll.passive="onScroll"
        @pointermove="onGridMove"
        @click="onGridClick"
      >
        <div class="grid-fade" aria-hidden="true"></div>
        <div class="sizer" :style="{ height: metrics.totalH + 'px' }">
          <div
            v-for="tile in tiles"
            :key="tile.p.id"
            class="tile"
            :class="{
              on: tile.i === focusIdx,
              dead: tile.dead,
              selected: store.selectedPersonId === tile.p.id,
              locked: lockedId === tile.p.id
            }"
            :data-i="tile.i"
            :style="tile.style"
            :aria-label="tile.p.name || unnamed"
          >
            <div class="tile-in" :style="{ '--tc': tile.color }">
              <div class="tile-body">
                <TileArt :person="tile.p" />
                <div class="tile-scrim"></div>
                <div class="tile-name">{{ tile.p.name || unnamed }}</div>
                <UiIcon v-if="tile.dead" class="tile-moon" name="moon" :size="12" :stroke="2.4" />
              </div>
            </div>
          </div>

          <!-- The P1 cursor: one element that glides between tiles -->
          <div class="cursor" :style="cursorStyle" aria-hidden="true">
            <svg
              class="cursor-svg"
              :width="TILE_W + 12"
              :height="TILE_H + 12"
              :viewBox="`-6 -6 ${TILE_W + 12} ${TILE_H + 12}`"
            >
              <polygon class="cur-glow" :points="tilePoints" />
              <polygon class="cur-line" :points="tilePoints" />
              <polygon class="cur-march" :points="tilePoints" />
            </svg>
            <span class="cursor-tag">P1</span>
            <div v-if="lockKey" :key="'b' + lockKey" class="cursor-burst">
              <svg
                :width="TILE_W + 12"
                :height="TILE_H + 12"
                :viewBox="`-6 -6 ${TILE_W + 12} ${TILE_H + 12}`"
              >
                <polygon :points="tilePoints" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, h } from 'vue'
import { useMainStore } from '../../store/index.js'
import { isDeceased, ageOf } from './peopleLayout.js'
import UiIcon from '../ui/UiIcon.js'
import { useThumbnail } from './useThumbnail.js'
import { useI18n } from '../../i18n'
import { genderLabel, defaultNameLabel } from '../../lib/dataLabels'
import {
  TILE_W,
  TILE_H,
  SLANT,
  PITCH_Y,
  gridMetrics,
  tileXY,
  visibleRows,
  stepCursor,
  revealScroll,
  rosterMaxima,
  statFraction,
  epithet,
  initialsOf
} from './rosterLayout.js'

// The Roster: a fighting-game character select screen. The top splash shows
// the focused person big (portrait, slammed-in name, stat meters, tags) over
// speed lines tinted in their color; below, a row-windowed grid of slanted
// portrait tiles with a gliding P1 cursor. Hover or arrow keys move the
// cursor; click / Enter "locks in" (flash + stamp) and opens the profile.

const props = defineProps({
  persons: { type: Array, required: true },
  statsOf: { type: Function, required: true },
  refYear: { type: Number, required: true }
})

const store = useMainStore()
const { t } = useI18n()
const gridEl = ref(null)
const unnamed = computed(() => t('directory.roster.unnamed'))

const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ── Art components (each visible item owns its reactive thumbnail) ─────────
const TileArt = {
  props: { person: { type: Object, required: true } },
  setup(p) {
    const { src } = useThumbnail(() => p.person.primary_image || '', 168)
    return () =>
      src.value
        ? h('img', { class: 'tile-img', src: src.value, alt: '', draggable: false })
        : h('div', { class: 'tile-mono' }, initialsOf(p.person.name))
  }
}
const SplashArt = {
  props: { person: { type: Object, required: true } },
  setup(p) {
    const { src, loading } = useThumbnail(() => p.person.primary_image || '', 512)
    return () =>
      src.value
        ? h('img', { class: 'sp-img', src: src.value, alt: '', draggable: false })
        : h('div', { class: ['sp-mono', loading.value && 'is-loading'] }, [
            h('span', loading.value ? '' : initialsOf(p.person.name))
          ])
  }
}

const genderColor = (p) =>
  p.gender === 'male'
    ? store.graphSettings.maleColor
    : p.gender === 'female'
      ? store.graphSettings.femaleColor
      : store.graphSettings.unknownColor

// ── Grid geometry + windowing ───────────────────────────────────────────────
const viewW = ref(0)
const viewH = ref(0)
const scrollTop = ref(0)

const metrics = computed(() => gridMetrics(viewW.value, props.persons.length))
const tilePoints = `${SLANT},0 ${TILE_W},0 ${TILE_W - SLANT},${TILE_H} 0,${TILE_H}`

let raf = 0
function onScroll() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    scrollTop.value = gridEl.value?.scrollTop || 0
  })
}
function remeasure() {
  const el = gridEl.value
  if (!el) return
  viewW.value = el.clientWidth
  viewH.value = el.clientHeight
  scrollTop.value = el.scrollTop
}

const tiles = computed(() => {
  const m = metrics.value
  const n = props.persons.length
  if (!n) return []
  const { first, last } = visibleRows(scrollTop.value, viewH.value, m.rows)
  const out = []
  const end = Math.min(n, last * m.cols)
  for (let i = first * m.cols; i < end; i++) {
    const p = props.persons[i]
    const { x, y, row, col } = tileXY(i, m)
    out.push({
      i,
      p,
      dead: isDeceased(p, props.refYear),
      color: genderColor(p),
      style: {
        transform: `translate(${x}px, ${y}px)`,
        '--td': Math.min((row - first) * 2 + col, 34)
      }
    })
  }
  return out
})

// ── Focus (the P1 cursor) ───────────────────────────────────────────────────
const focusIdx = ref(0)
const wipeKey = ref(0)
const focused = computed(() => props.persons[focusIdx.value] || null)

function setFocus(i) {
  const n = props.persons.length
  if (!n) return
  const next = Math.max(0, Math.min(n - 1, i))
  if (next === focusIdx.value) return
  focusIdx.value = next
  if (!reduceMotion) wipeKey.value++
}

const cursorStyle = computed(() => {
  const { x, y } = tileXY(focusIdx.value, metrics.value)
  return { transform: `translate(${x}px, ${y}px)` }
})

const focusColor = computed(() => (focused.value ? genderColor(focused.value) : 'var(--accent)'))
const focusDead = computed(() => !!focused.value && isDeceased(focused.value, props.refYear))
const focusInitials = computed(() => initialsOf(focused.value?.name))
const focusEpithet = computed(() => {
  const p = focused.value
  if (!p) return ''
  return epithet(p) || genderText(p.gender)
})
// peopleLayout's genderLabel() stays English; translate at the call site.
function genderText(g) {
  return g === 'male' || g === 'female' ? genderLabel(g) : t('data.noun.person')
}
// "1901 – 1975" / "b. 1901" / "d. 1975" — rosterLayout's lifeLine(), localized.
function lifeText(p) {
  const b = p?.birth?.year
  const d = p?.death?.year
  if (b != null && d != null) return t('directory.roster.life.span', { b, d })
  if (b != null) return t('directory.roster.life.born', { y: b })
  if (d != null) return t('directory.roster.life.died', { y: d })
  return ''
}
const focusLife = computed(() => {
  const p = focused.value
  if (!p) return ''
  const life = lifeText(p)
  const age = ageOf(p, props.refYear)
  const agePart =
    age == null
      ? ''
      : focusDead.value
        ? t('directory.roster.diedAged', { n: age })
        : t('directory.roster.ageN', { n: age })
  return [life, agePart].filter(Boolean).join('  ·  ')
})
// Long names shrink so the display type never overflows the splash.
const nameScale = computed(() => {
  const len = (focused.value?.name || 'Unnamed').length
  return len <= 10 ? 1 : len <= 16 ? 0.82 : len <= 24 ? 0.66 : 0.52
})

const maxima = computed(() =>
  rosterMaxima(props.persons, props.statsOf, (p) => ageOf(p, props.refYear))
)
const focusStats = computed(() => {
  const p = focused.value
  if (!p) return []
  const s = props.statsOf(p.id) || { kin: 0, children: 0 }
  const age = ageOf(p, props.refYear)
  const m = maxima.value
  return [
    {
      key: 'age',
      label: t('directory.roster.stats.age'),
      text: age == null ? '—' : age,
      f: statFraction(age, m.age),
      d: 0
    },
    {
      key: 'kin',
      label: t('directory.roster.stats.kin'),
      text: s.kin,
      f: statFraction(s.kin, m.kin),
      d: 1
    },
    {
      key: 'children',
      label: t('directory.roster.stats.children'),
      text: s.children,
      f: statFraction(s.children, m.children),
      d: 2
    }
  ]
})
const focusTags = computed(() => {
  const all = (focused.value && store.tagsOf.get(focused.value.id)) || []
  return { list: all.slice(0, 5), more: Math.max(0, all.length - 5) }
})

const personById = computed(() => new Map(store.persons.map((p) => [p.id, p])))
const focusPartner = computed(() => {
  const id = focused.value?.id
  if (!id) return ''
  const roles = store.relTypeRoles
  const names = []
  for (const r of store.relationships) {
    if (roles.get(r.type) !== 'horizontal') continue
    const other = r.person_a_id === id ? r.person_b_id : r.person_b_id === id ? r.person_a_id : null
    if (!other) continue
    const o = personById.value.get(other)
    if (o && !names.includes(o.name)) names.push(o.name || unnamed.value)
    if (names.length >= 2) break
  }
  return names.join(' & ')
})

// ── Pointer ─────────────────────────────────────────────────────────────────
// pointermove (not mouseenter) so tiles scrolling under a still mouse during
// keyboard navigation don't steal the cursor back.
function tileIndexOf(e) {
  const el = e.target?.closest?.('.tile')
  if (!el) return -1
  const i = Number(el.dataset.i)
  return Number.isFinite(i) ? i : -1
}
function onGridMove(e) {
  const i = tileIndexOf(e)
  if (i >= 0) setFocus(i)
}
function onGridClick(e) {
  const i = tileIndexOf(e)
  if (i >= 0) lockIn(i)
}

// ── Lock in: flash + stamp, then open the profile ──────────────────────────
const lockedId = ref(null)
const lockKey = ref(0)
let lockTimer = 0
let unlockTimer = 0
function lockIn(i) {
  const p = props.persons[i]
  if (!p) return
  setFocus(i)
  clearTimeout(lockTimer)
  clearTimeout(unlockTimer)
  lockedId.value = p.id
  if (!reduceMotion) lockKey.value++
  lockTimer = setTimeout(
    () => {
      store.selectPerson(p.id)
      unlockTimer = setTimeout(() => (lockedId.value = null), 500)
    },
    reduceMotion ? 0 : 480
  )
}
function lockFocused() {
  lockIn(focusIdx.value)
}

// ── Keyboard ────────────────────────────────────────────────────────────────
const NAV_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End'
])
function reveal(i) {
  const el = gridEl.value
  if (!el) return
  const top = revealScroll(i, metrics.value.cols, el.scrollTop, el.clientHeight)
  if (top != null) el.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' })
}
function onKeydown(e) {
  if (store.activeView !== 'directory') return
  if (store.modalOpen || store.formOpen || store.curtain?.active) return
  if (store.appSettingsOpen || store.userPageOpen || store.projectsPageOpen || store.browsePageOpen)
    return
  if (e.ctrlKey || e.metaKey || e.altKey) return
  const t = e.target
  if (
    t &&
    (t.tagName === 'INPUT' ||
      t.tagName === 'TEXTAREA' ||
      t.tagName === 'SELECT' ||
      t.isContentEditable)
  )
    return
  if (!props.persons.length) return
  if (NAV_KEYS.has(e.key)) {
    e.preventDefault()
    const pageRows = Math.max(1, Math.floor((viewH.value || PITCH_Y) / PITCH_Y) - 1)
    const next = stepCursor(
      focusIdx.value,
      e.key,
      metrics.value.cols,
      props.persons.length,
      pageRows
    )
    setFocus(next)
    reveal(next)
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (!e.repeat) lockFocused()
  }
}

// ── Lifecycle ───────────────────────────────────────────────────────────────
let ro = null
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  nextTick(() => {
    remeasure()
    if (gridEl.value) {
      ro = new ResizeObserver(remeasure)
      ro.observe(gridEl.value)
    }
  })
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  ro?.disconnect()
  if (raf) cancelAnimationFrame(raf)
  clearTimeout(enterTimer)
  clearTimeout(lockTimer)
  clearTimeout(unlockTimer)
})

// The grid element only exists while the roster is non-empty.
watch(gridEl, (el, old) => {
  if (old) ro?.unobserve(old)
  if (el) {
    ro?.observe(el)
    nextTick(remeasure)
  }
})

// Entrance ripple on mount and whenever the roster changes (search, sort,
// filter); tiles mounted later by scrolling just appear.
const entering = ref(true)
let enterTimer = setTimeout(() => (entering.value = false), 1500)
watch(
  () => props.persons,
  (list, oldList) => {
    entering.value = true
    clearTimeout(enterTimer)
    enterTimer = setTimeout(() => (entering.value = false), 1500)
    // Keep the cursor on the same person when they survive the change.
    const prevId = oldList?.[focusIdx.value]?.id
    const keep = prevId ? list.findIndex((p) => p.id === prevId) : -1
    focusIdx.value = keep >= 0 ? keep : 0
    nextTick(() => {
      if (!gridEl.value) return
      if (keep >= 0) reveal(keep)
      else gridEl.value.scrollTop = 0
    })
  }
)
</script>

<style scoped>
.roster {
  --cur: var(--amber);
  container: roster / inline-size;
  position: relative;
  background: var(--bg);
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
}

/* ═════════════ Splash ═════════════ */
.splash {
  position: relative;
  /* At least ~56% of the view; grows into whatever the grid doesn't need
     (small rosters), capped so the grid always keeps a strip. */
  flex: 1 0 auto;
  min-height: clamp(240px, 56%, 540px);
  max-height: 68%;
  overflow: hidden;
  isolation: isolate;
  container-type: size;
  background: var(--bg);
}

/* Speed lines: two parallax layers of skewed stripes, each scrolling exactly
   one pattern period per loop so the motion is seamless. */
.sp-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
.sp-lines {
  position: absolute;
  top: -10%;
  bottom: -10%;
  left: -30%;
  right: -30%;
  will-change: transform;
}
.sp-lines-a {
  background: repeating-linear-gradient(
    90deg,
    transparent 0 26px,
    color-mix(in srgb, var(--pc) 16%, transparent) 26px 28px,
    transparent 28px 44px,
    color-mix(in srgb, var(--pc) 9%, transparent) 44px 45px,
    transparent 45px 72px
  );
  animation: sp-lines-run 0.9s linear infinite;
}
.sp-lines-b {
  background: repeating-linear-gradient(
    90deg,
    transparent 0 120px,
    color-mix(in srgb, var(--pc) 10%, transparent) 120px 150px,
    transparent 150px 240px
  );
  animation: sp-lines-run-b 2.6s linear infinite;
}
@keyframes sp-lines-run {
  from {
    transform: skewX(-28deg) translateX(0);
  }
  to {
    transform: skewX(-28deg) translateX(72px);
  }
}
@keyframes sp-lines-run-b {
  from {
    transform: skewX(-28deg) translateX(0);
  }
  to {
    transform: skewX(-28deg) translateX(240px);
  }
}

/* Light streaks that shoot across now and then */
.sp-streaks i {
  position: absolute;
  left: 0;
  top: calc(var(--n) * 17% - 6%);
  width: 34%;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--pc) 70%, var(--t1)),
    transparent
  );
  opacity: 0.55;
  transform: translateX(-110%);
  animation: sp-streak calc(2.2s + var(--n) * 0.55s) cubic-bezier(0.6, 0, 0.3, 1)
    calc(var(--n) * -0.9s) infinite;
}
.sp-streaks i:nth-child(even) {
  height: 1px;
  width: 22%;
}
@keyframes sp-streak {
  0%,
  45% {
    transform: translateX(-110%);
  }
  100% {
    transform: translateX(420%);
  }
}

/* ── One splash card (keyed by person; old one slides out while new slams in) ── */
.sp-card {
  --pc: var(--accent);
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: stretch;
  gap: clamp(18px, 3.5cqw, 48px);
  padding: 18px clamp(18px, 4cqw, 56px) 20px;
}
.sp-tint {
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(
      60% 90% at 18% 55%,
      color-mix(in srgb, var(--pc) 34%, transparent),
      transparent 70%
    ),
    linear-gradient(
      100deg,
      color-mix(in srgb, var(--pc) 22%, transparent) 0%,
      transparent 55%,
      color-mix(in srgb, var(--pc) 10%, transparent) 100%
    );
}
/* Focus change = one slanted wipe: the new card is revealed left→right while
   the old one is erased along the same moving seam (the .sp-wipe band rides
   it). Appear (mount) just fades. */
.sp-appear-active {
  transition: opacity 0.25s ease-out;
}
.sp-appear-from {
  opacity: 0;
}
.sp-enter-active {
  animation: sp-reveal 0.34s cubic-bezier(0.5, 0, 0.3, 1);
}
.sp-leave-active {
  z-index: 0;
  animation: sp-erase 0.34s cubic-bezier(0.5, 0, 0.3, 1) forwards;
}
@keyframes sp-reveal {
  from {
    clip-path: polygon(-25% 0, 0% 0, -25% 100%, -25% 100%);
  }
  to {
    clip-path: polygon(-25% 0, 125% 0, 100% 100%, -25% 100%);
  }
}
@keyframes sp-erase {
  from {
    clip-path: polygon(0% 0, 125% 0, 125% 100%, -25% 100%);
    transform: translateX(0);
  }
  to {
    clip-path: polygon(125% 0, 125% 0, 125% 100%, 100% 100%);
    transform: translateX(-4%);
  }
}

.sp-watermark {
  position: absolute;
  right: 3cqw;
  bottom: 2cqh;
  z-index: -1;
  font-size: 62cqh;
  line-height: 1;
  font-weight: 900;
  font-style: italic;
  letter-spacing: -0.04em;
  color: transparent;
  -webkit-text-stroke: 1.5px color-mix(in srgb, var(--pc) 30%, transparent);
  opacity: 0.55;
  pointer-events: none;
  white-space: nowrap;
  animation: sp-watermark-in 0.6s cubic-bezier(0.2, 0.9, 0.3, 1) backwards;
}
@keyframes sp-watermark-in {
  from {
    opacity: 0;
    transform: translateX(14%);
  }
}

/* Portrait: slanted frame over an offset colored plate */
.sp-portrait-wrap {
  position: relative;
  flex: 0 0 auto;
  height: 100%;
  aspect-ratio: 1.08 / 1;
  max-width: 44%;
  cursor: pointer;
  animation: sp-portrait-in 0.42s cubic-bezier(0.18, 1.35, 0.4, 1) backwards;
}
@keyframes sp-portrait-in {
  from {
    opacity: 0;
    transform: translateX(-26%) skewX(-10deg) scale(1.06);
  }
}
.sp-plate {
  position: absolute;
  inset: 0;
  transform: translate(16px, 12px);
  clip-path: polygon(14% 0, 100% 0, 86% 100%, 0 100%);
  background:
    repeating-linear-gradient(
      -62deg,
      transparent 0 6px,
      color-mix(in srgb, var(--pc) 30%, transparent) 6px 8px
    ),
    color-mix(in srgb, var(--pc) 28%, transparent);
}
.sp-frame {
  position: absolute;
  inset: 0;
  clip-path: polygon(14% 0, 100% 0, 86% 100%, 0 100%);
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--pc) 45%, var(--t1)),
    var(--pc) 45%,
    color-mix(in srgb, var(--pc) 45%, var(--bg))
  );
  filter: drop-shadow(0 0 22px color-mix(in srgb, var(--pc) 55%, transparent));
}
.sp-portrait {
  position: absolute;
  inset: 3px 4px;
  clip-path: polygon(14% 0, 100% 0, 86% 100%, 0 100%);
  overflow: hidden;
  background: var(--surface);
}
.sp-card :deep(.sp-img) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation: sp-img-in 0.9s cubic-bezier(0.2, 0.9, 0.3, 1) backwards;
}
@keyframes sp-img-in {
  from {
    transform: scale(1.14);
  }
}
.sp-card.dead :deep(.sp-img) {
  filter: grayscale(0.85) contrast(1.05);
}
.sp-card :deep(.sp-mono) {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    repeating-conic-gradient(
      from 0deg at 50% 60%,
      color-mix(in srgb, var(--pc) 22%, transparent) 0deg 6deg,
      transparent 6deg 18deg
    ),
    radial-gradient(
      circle at 50% 38%,
      color-mix(in srgb, var(--pc) 55%, white) 0%,
      var(--pc) 34%,
      color-mix(in srgb, var(--pc) 35%, black) 100%
    );
}
.sp-card :deep(.sp-mono span) {
  font-size: 34cqh;
  font-weight: 900;
  font-style: italic;
  letter-spacing: -0.04em;
  color: color-mix(in srgb, var(--pc) 12%, white);
  text-shadow:
    0 6px 0 color-mix(in srgb, var(--pc) 45%, black),
    0 0 40px color-mix(in srgb, var(--pc) 60%, white);
  transform: skewX(-8deg);
}
.sp-card :deep(.sp-mono.is-loading) {
  animation: sp-loading 1s ease-in-out infinite alternate;
}
@keyframes sp-loading {
  to {
    opacity: 0.7;
  }
}
.sp-card.dead :deep(.sp-mono) {
  filter: grayscale(0.7);
}
.sp-portrait-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 30%,
    color-mix(in srgb, white 32%, transparent) 45%,
    transparent 60%
  );
  transform: translateX(-120%);
  animation: sp-shine 0.8s cubic-bezier(0.3, 0, 0.2, 1) 0.18s forwards;
  pointer-events: none;
}
@keyframes sp-shine {
  to {
    transform: translateX(120%);
  }
}

/* Info column */
.sp-info {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 7px;
}
.sp-top {
  display: flex;
  align-items: center;
  gap: 10px;
  animation: sp-slide-in 0.3s cubic-bezier(0.2, 1, 0.3, 1) 0.02s backwards;
}
.sp-p1 {
  display: inline-block;
  padding: 2px 11px 2px 9px;
  font-size: 12.5px;
  font-weight: 900;
  font-style: italic;
  letter-spacing: 0.06em;
  color: var(--bg);
  background: var(--cur);
  clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
  box-shadow: 0 0 16px var(--cur);
}
.sp-no {
  font-size: 12.5px;
  font-weight: 800;
  font-style: italic;
  letter-spacing: 0.08em;
  color: var(--t2);
  font-variant-numeric: tabular-nums;
}
.sp-no small {
  font-size: 11px;
  color: var(--t3);
}
.sp-fallen {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 700;
  color: var(--t2);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.sp-name {
  margin: 0;
  font-size: calc(clamp(30px, 17cqh, 84px) * var(--ns, 1));
  line-height: 0.95;
  font-weight: 900;
  font-style: italic;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  padding-right: 0.15em;
  color: var(--t1);
  background: linear-gradient(
    180deg,
    var(--t1) 38%,
    color-mix(in srgb, var(--pc) 70%, var(--t1)) 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(3px 4px 0 color-mix(in srgb, var(--pc) 55%, transparent));
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  animation: sp-name-in 0.36s cubic-bezier(0.16, 1.3, 0.4, 1) 0.04s backwards;
}
@keyframes sp-name-in {
  from {
    opacity: 0;
    transform: translateX(22%) skewX(-24deg);
  }
}
.sp-epithet {
  font-size: 14px;
  font-weight: 700;
  font-style: italic;
  color: color-mix(in srgb, var(--pc) 45%, var(--t1));
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  animation: sp-slide-in 0.34s cubic-bezier(0.2, 1, 0.3, 1) 0.09s backwards;
}
.sp-life {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--t2);
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
  white-space: pre;
  animation: sp-slide-in 0.34s cubic-bezier(0.2, 1, 0.3, 1) 0.12s backwards;
}
@keyframes sp-slide-in {
  from {
    opacity: 0;
    transform: translateX(48px);
  }
}

/* Stat meters */
.sp-stats {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 6px;
}
.sp-stat {
  display: grid;
  grid-template-columns: 70px minmax(90px, 300px) 40px;
  align-items: center;
  gap: 10px;
  animation: sp-slide-in 0.3s cubic-bezier(0.2, 1, 0.3, 1) calc(0.14s + var(--d) * 0.04s) backwards;
}
.sp-stat-k {
  font-size: 11.5px;
  font-weight: 800;
  font-style: italic;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--t2);
}
.sp-stat-bar {
  position: relative;
  height: 11px;
  transform: skewX(-24deg);
  background: color-mix(in srgb, var(--t3) 22%, transparent);
  border: 1px solid color-mix(in srgb, var(--pc) 30%, var(--border));
  overflow: hidden;
}
.sp-stat-bar i {
  position: absolute;
  inset: 0;
  transform-origin: left center;
  transform: scaleX(var(--v));
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--pc) 55%, transparent),
    var(--pc) 70%,
    color-mix(in srgb, var(--pc) 45%, white)
  );
  box-shadow: 0 0 12px var(--pc);
  animation: sp-fill 0.65s cubic-bezier(0.2, 0.9, 0.25, 1) calc(0.2s + var(--d) * 0.08s) backwards;
}
/* segment notches, like a power meter */
.sp-stat-bar::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(90deg, transparent 0 13px, var(--bg) 13px 15px);
  opacity: 0.85;
}
@keyframes sp-fill {
  from {
    transform: scaleX(0);
  }
}
.sp-stat-v {
  font-size: 15px;
  font-weight: 900;
  font-style: italic;
  color: var(--t1);
  font-variant-numeric: tabular-nums;
}

/* Tags + partner */
.sp-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
  max-height: 52px;
  overflow: hidden;
}
.sp-tag {
  display: inline-block;
  padding: 3px 11px;
  transform: skewX(-14deg);
  border: 1px solid color-mix(in srgb, var(--tc) 55%, transparent);
  background: color-mix(in srgb, var(--tc) 18%, transparent);
  animation: sp-pop 0.3s cubic-bezier(0.3, 1.6, 0.5, 1) calc(0.26s + var(--k) * 0.04s) backwards;
}
.sp-tag > span {
  display: inline-block;
  transform: skewX(14deg);
  font-size: 11.5px;
  font-weight: 800;
  color: var(--t1);
  white-space: nowrap;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
}
.sp-tag-more {
  --tc: var(--t3);
}
.sp-partner {
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 800;
  font-style: italic;
  color: var(--pink);
  white-space: nowrap;
  animation: sp-pop 0.3s cubic-bezier(0.3, 1.6, 0.5, 1) calc(0.26s + var(--k) * 0.04s) backwards;
}
@keyframes sp-pop {
  from {
    opacity: 0;
    transform: skewX(-14deg) scale(0.4);
  }
}

/* Wipe band that sweeps across on every focus change */
.sp-wipe {
  position: absolute;
  top: -10%;
  bottom: -10%;
  left: 0;
  width: 26%;
  z-index: 3;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--pc) 45%, transparent) 40%,
    color-mix(in srgb, var(--pc) 30%, var(--t1)) 50%,
    color-mix(in srgb, var(--pc) 45%, transparent) 60%,
    transparent
  );
  opacity: 0.7;
  transform: skewX(-30deg) translateX(-100%);
  animation: sp-wipe 0.34s cubic-bezier(0.5, 0, 0.3, 1) forwards;
}
@keyframes sp-wipe {
  80% {
    opacity: 0.7;
  }
  to {
    transform: skewX(-30deg) translateX(385%);
    opacity: 0;
  }
}

/* Lock-in flash + stamp */
.sp-flash {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  background: radial-gradient(
    circle at 30% 50%,
    color-mix(in srgb, var(--pc) 30%, white),
    color-mix(in srgb, var(--pc) 40%, transparent) 45%,
    transparent 80%
  );
  opacity: 0;
  animation: sp-flash 0.5s ease-out;
}
@keyframes sp-flash {
  0% {
    opacity: 0.95;
  }
  100% {
    opacity: 0;
  }
}
.sp-stamp {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 5;
  pointer-events: none;
  transform: translate(-50%, -50%) rotate(-9deg);
  animation: sp-stamp 0.34s cubic-bezier(0.2, 1.5, 0.4, 1) backwards;
}
.sp-stamp span {
  display: block;
  padding: 6px 26px 8px 22px;
  font-size: clamp(30px, 15cqh, 72px);
  font-weight: 900;
  font-style: italic;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--cur);
  border: 4px solid var(--cur);
  background: color-mix(in srgb, var(--bg) 70%, transparent);
  text-shadow: 0 0 22px color-mix(in srgb, var(--cur) 70%, transparent);
  box-shadow:
    0 0 30px color-mix(in srgb, var(--cur) 50%, transparent),
    inset 0 0 22px color-mix(in srgb, var(--cur) 30%, transparent);
  clip-path: polygon(4% 0, 100% 0, 96% 100%, 0 100%);
}
@keyframes sp-stamp {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(-9deg) scale(2.6);
  }
}

.sp-lock {
  position: absolute;
  right: 18px;
  bottom: 14px;
  z-index: 6;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px 6px 14px;
  border: 1px solid color-mix(in srgb, var(--cur) 60%, transparent);
  background: color-mix(in srgb, var(--cur) 14%, var(--glass-strong));
  color: var(--t1);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 900;
  font-style: italic;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
  backdrop-filter: blur(8px);
  transition:
    background 0.15s,
    transform 0.2s cubic-bezier(0.3, 1.5, 0.5, 1);
}
.sp-lock:hover {
  background: color-mix(in srgb, var(--cur) 32%, var(--glass-strong));
  transform: scale(1.06);
}
.sp-lock kbd,
.rail kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 16px;
  font-family: var(--font);
  font-size: 11px;
  font-weight: 800;
  font-style: normal;
  padding: 0 5px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--elevated);
  color: var(--t2);
}

/* Short splash: drop the least important rows first */
@container (max-height: 320px) {
  .sp-tags {
    display: none;
  }
}
@container (max-height: 270px) {
  .sp-life {
    display: none;
  }
}
@container (max-width: 620px) {
  .sp-portrait-wrap {
    max-width: 36%;
  }
  .sp-stat {
    grid-template-columns: 58px minmax(60px, 1fr) 30px;
  }
  .sp-lock {
    display: none;
  }
}

/* ═════════════ Rail ═════════════ */
.rail {
  position: relative;
  z-index: 2;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 16px;
  height: 30px;
  padding: 0 18px;
  border-top: 1px solid color-mix(in srgb, var(--pc) 55%, transparent);
  border-bottom: 1px solid var(--border);
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--pc) 20%, var(--surface)),
    var(--surface) 45%
  );
  box-shadow: 0 -2px 18px -4px color-mix(in srgb, var(--pc) 45%, transparent);
  font-size: 11.5px;
  font-weight: 800;
  font-style: italic;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--t2);
  white-space: nowrap;
  overflow: hidden;
  transition:
    border-color 0.3s,
    box-shadow 0.3s;
}
.rail-title {
  color: var(--t1);
}
.rail-hint {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--t3);
  letter-spacing: 0.1em;
}
.rail-hint kbd:nth-of-type(4) {
  margin-right: 6px;
}
.rail-hint kbd:nth-of-type(5) {
  margin-left: 10px;
}
.rail-count {
  color: var(--t2);
  font-variant-numeric: tabular-nums;
}
@container roster (max-width: 680px) {
  .rail-hint {
    visibility: hidden;
  }
}

/* ═════════════ Grid ═════════════ */
.grid {
  position: relative;
  /* basis = content height (inline); shrinks + scrolls when the roster is big */
  flex: 0 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
  background:
    radial-gradient(circle, color-mix(in srgb, var(--t3) 16%, transparent) 1px, transparent 1.5px) 0
      0 / 14px 14px,
    linear-gradient(180deg, color-mix(in srgb, var(--pc) 7%, var(--bg)), var(--bg) 60%);
}
.sizer {
  position: relative;
  width: 100%;
}
/* Soft edge under the rail: sticky + zero-height so it rides the viewport */
.grid-fade {
  position: sticky;
  top: 0;
  height: 0;
  z-index: 6;
  pointer-events: none;
}
.grid-fade::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 16px;
  background: linear-gradient(180deg, var(--bg), transparent);
}

/* One tile: slanted parallelogram with a thin gender-tinted rim */
.tile {
  position: absolute;
  top: 0;
  left: 0;
  width: 84px;
  height: 78px;
  cursor: pointer;
}
.tile-in {
  --tc: var(--accent);
  position: absolute;
  inset: 0;
  clip-path: polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%);
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--tc) 70%, var(--t1)),
    color-mix(in srgb, var(--tc) 55%, transparent) 50%,
    color-mix(in srgb, var(--tc) 25%, transparent)
  );
  transition:
    transform 0.2s cubic-bezier(0.3, 1.4, 0.5, 1),
    filter 0.2s;
}
.is-entering .tile-in {
  animation: tile-in 0.42s cubic-bezier(0.2, 1.3, 0.4, 1) calc(var(--td, 0) * 0.024s) backwards;
}
@keyframes tile-in {
  from {
    opacity: 0;
    transform: translateY(22px) skewX(-12deg) scale(0.6);
  }
}
.tile-body {
  position: absolute;
  inset: 2px;
  clip-path: polygon(12.5px 0, 100% 0, calc(100% - 12.5px) 100%, 0 100%);
  overflow: hidden;
  background: var(--surface);
}
.tile :deep(.tile-img) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition:
    transform 0.3s cubic-bezier(0.2, 1, 0.3, 1),
    filter 0.2s;
}
.tile :deep(.tile-mono) {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-bottom: 12px;
  font-size: 22px;
  font-weight: 900;
  font-style: italic;
  letter-spacing: -0.03em;
  color: color-mix(in srgb, var(--tc) 14%, white);
  text-shadow: 0 2px 0 color-mix(in srgb, var(--tc) 50%, black);
  background: radial-gradient(
    circle at 50% 32%,
    color-mix(in srgb, var(--tc) 70%, white) 0%,
    var(--tc) 42%,
    color-mix(in srgb, var(--tc) 40%, black) 100%
  );
}
.tile-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 52%, color-mix(in srgb, black 72%, transparent));
  pointer-events: none;
}
.tile-name {
  position: absolute;
  left: 5px;
  right: 17px;
  bottom: 3px;
  font-size: 9.5px;
  font-weight: 800;
  font-style: italic;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 3px black;
}
.tile-moon {
  position: absolute;
  top: 4px;
  right: 8px;
  color: white;
  filter: drop-shadow(0 0 2px black);
}
.tile.dead :deep(.tile-img),
.tile.dead :deep(.tile-mono) {
  filter: grayscale(1) brightness(0.8);
}
.tile.dead .tile-in {
  filter: saturate(0.2);
}

/* Focused / selected / locked */
.tile.on {
  z-index: 3;
}
.tile.on .tile-in {
  transform: scale(1.08);
}
.tile.on :deep(.tile-img) {
  transform: scale(1.12);
}
.tile.on.dead :deep(.tile-img),
.tile.on.dead :deep(.tile-mono) {
  filter: grayscale(0.4);
}
.tile.selected {
  z-index: 2;
  filter: drop-shadow(0 0 7px color-mix(in srgb, var(--accent) 85%, transparent));
}
.tile.selected .tile-in {
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--accent) 50%, var(--t1)),
    var(--accent)
  );
}
.tile.locked .tile-in {
  animation: tile-lock 0.45s ease-out;
}
@keyframes tile-lock {
  0% {
    filter: brightness(2.4) saturate(1.4);
    transform: scale(1.22);
  }
  100% {
    filter: none;
    transform: scale(1.08);
  }
}

/* The gliding P1 cursor */
.cursor {
  position: absolute;
  top: 0;
  left: 0;
  width: 84px;
  height: 78px;
  z-index: 7;
  pointer-events: none;
  transition: transform 0.19s cubic-bezier(0.3, 1.25, 0.5, 1);
  will-change: transform;
}
.cursor-svg,
.cursor-burst svg {
  position: absolute;
  left: -6px;
  top: -6px;
  overflow: visible;
}
.cursor-svg polygon,
.cursor-burst polygon {
  fill: none;
  stroke-linejoin: miter;
  transform: scale(1.08);
  transform-origin: 42px 39px;
}
.cur-glow {
  stroke: var(--cur);
  stroke-width: 9;
  opacity: 0.28;
  animation: cur-glow 1.1s ease-in-out infinite alternate;
}
.cur-line {
  stroke: var(--cur);
  stroke-width: 3;
}
.cur-march {
  stroke: color-mix(in srgb, var(--cur) 25%, white);
  stroke-width: 3;
  stroke-dasharray: 14 30;
  animation: cur-march 0.9s linear infinite;
}
@keyframes cur-glow {
  to {
    opacity: 0.6;
  }
}
@keyframes cur-march {
  to {
    stroke-dashoffset: -44;
  }
}
.cursor-tag {
  position: absolute;
  left: -2px;
  top: -20px;
  padding: 1px 9px 1px 7px;
  font-size: 11px;
  font-weight: 900;
  font-style: italic;
  letter-spacing: 0.06em;
  line-height: 14px;
  color: var(--bg);
  background: var(--cur);
  clip-path: polygon(5px 0, 100% 0, calc(100% - 5px) 100%, 0 100%);
  animation: cur-bob 1.1s ease-in-out infinite alternate;
}
@keyframes cur-bob {
  to {
    transform: translateY(-3px);
  }
}
.cursor-burst {
  position: absolute;
  inset: 0;
  animation: cur-burst 0.5s cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
}
.cursor-burst polygon {
  stroke: var(--cur);
  stroke-width: 4;
}
@keyframes cur-burst {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(1.7);
  }
}

/* ── Empty state ── */
.roster-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--t2);
  pointer-events: none;
}
.roster-empty-icon {
  display: flex;
  color: var(--t3);
}
.roster-empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--t1);
}
.roster-empty-text {
  font-size: 13px;
  max-width: 280px;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .sp-lines,
  .sp-streaks i,
  .sp-watermark,
  .sp-portrait-wrap,
  .sp-card :deep(.sp-img),
  .sp-portrait-shine,
  .sp-top,
  .sp-name,
  .sp-epithet,
  .sp-life,
  .sp-stat,
  .sp-stat-bar i,
  .sp-tag,
  .sp-partner,
  .sp-stamp,
  .is-entering .tile-in,
  .tile.locked .tile-in,
  .cur-glow,
  .cur-march,
  .cursor-tag {
    animation: none;
  }
  .sp-portrait-shine {
    display: none;
  }
  .cursor,
  .tile-in {
    transition: none;
  }
  .sp-leave-active {
    transition: none;
  }
}
</style>
